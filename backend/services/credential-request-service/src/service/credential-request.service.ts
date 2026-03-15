import crypto from 'node:crypto';
import {
  AuditAction,
  CredentialRequest as PrismaCredentialRequest,
  CredentialRequestStatus,
  DeliveryMethod,
  NotificationType,
  Prisma,
  RequesterType,
  Role,
} from '../../../../db/node_modules/@prisma/client';
import {
  ApprovalReceiptResponseDto,
  ApprovalReceiptVerificationResultDto,
  CreateCredentialRequestDto,
  CredentialRequestResponseDto,
  ListCredentialRequestsQueryDto,
  ReceiptLookupResultDto,
  UpdateCredentialRequestStatusDto,
} from '../dto/credential-request.dto';
import {
  ApprovalReceiptVerificationView,
  CredentialRequestRepository,
  UserContext,
} from '../repository/credential-request.repository';
import { notificationClient } from '../client/notification.client';
import { realtimeClient } from '../client/realtime.client';
import { ENV } from '../config/env';

const credentialRequestRepository = new CredentialRequestRepository();

const parseOptionalString = (value?: string): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const RECEIPT_TOKEN_MIN_TTL_SECONDS = 30;
const RECEIPT_TOKEN_MAX_TTL_SECONDS = 300;

const toCredentialRequestResponse = (
  request: PrismaCredentialRequest,
): CredentialRequestResponseDto => ({
  id: request.id,
  studentId: request.studentId,
  credentialId: request.credentialId,
  type: request.type,
  title: request.title,
  description: request.description,
  purpose: request.purpose,
  deliveryMethod: request.deliveryMethod,
  status: request.status,
  processedById: request.processedById,
  processedAt: request.processedAt ? request.processedAt.toISOString() : null,
  rejectionReason: request.rejectionReason,
  notes: null,
  metadata: {
    requesterType: request.requesterType === 'STUDENT' ? 'STUDENT' : 'INSTITUTION',
    requesterId: request.requesterId,
    institutionId: request.institutionId,
  },
  createdAt: request.createdAt.toISOString(),
  updatedAt: request.updatedAt.toISOString(),
});

export class CredentialRequestService {
  private getReceiptTokenPepperOrThrow(): string {
    const pepper = ENV.REQUEST_RECEIPT_TOKEN_PEPPER?.trim();
    if (!pepper) {
      throw new Error('REQUEST_RECEIPT_TOKEN_PEPPER_MISSING');
    }
    return pepper;
  }

  private getReceiptVerifyBaseUrlOrThrow(): string {
    const baseUrl = ENV.REQUEST_RECEIPT_VERIFY_BASE_URL?.trim();
    if (!baseUrl) {
      throw new Error('REQUEST_RECEIPT_VERIFY_BASE_URL_MISSING');
    }
    return baseUrl.replace(/\/+$/, '');
  }

  private getReceiptTokenTtlSeconds(): number {
    const parsed = Number(ENV.REQUEST_RECEIPT_TOKEN_TTL_SECONDS || 300);
    if (!Number.isFinite(parsed)) {
      return RECEIPT_TOKEN_MAX_TTL_SECONDS;
    }
    return Math.max(
      RECEIPT_TOKEN_MIN_TTL_SECONDS,
      Math.min(RECEIPT_TOKEN_MAX_TTL_SECONDS, Math.floor(parsed)),
    );
  }

  private hashReceiptToken(rawToken: string): string {
    const pepper = this.getReceiptTokenPepperOrThrow();
    return crypto.createHash('sha256').update(`${rawToken}:${pepper}`).digest('hex');
  }

  private generateReceiptToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private generateReceiptCode(): string {
    return `APR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private buildReceiptVerificationUrl(rawToken: string): string {
    const base = this.getReceiptVerifyBaseUrlOrThrow();
    return `${base}/verify/receipt/${encodeURIComponent(rawToken)}`;
  }

  private mapApprovalReceiptView(
    receiptView: ApprovalReceiptVerificationView,
    verificationUrl: string,
    expiresAt: Date,
    ttlSeconds: number,
  ): ApprovalReceiptResponseDto {
    return {
      receiptId: receiptView.receiptId,
      requestId: receiptView.requestId,
      receiptCode: receiptView.receiptCode,
      verificationUrl,
      expiresAt: expiresAt.toISOString(),
      ttlSeconds,
      studentName: receiptView.studentName,
      studentNumber: receiptView.studentNumber,
      type: receiptView.type as ApprovalReceiptResponseDto['type'],
      deliveryMethod: receiptView.deliveryMethod,
      approvedAt: receiptView.approvedAt ? receiptView.approvedAt.toISOString() : null,
      institutionName: receiptView.institutionName,
    };
  }

  private async createApprovalReceiptTokenForRequest(
    requestId: string,
    actorId: string,
  ): Promise<ApprovalReceiptResponseDto> {
    const ttlSeconds = this.getReceiptTokenTtlSeconds();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const rawToken = this.generateReceiptToken();
      const tokenHash = this.hashReceiptToken(rawToken);
      const receiptCode = this.generateReceiptCode();

      try {
        const created = await credentialRequestRepository.createApprovalReceiptForApprovedRequest({
          requestId,
          tokenHash,
          receiptCode,
          expiresAt,
        });
        const studentName = [
          created.request.student.firstName,
          created.request.student.middleName,
          created.request.student.lastName,
        ]
          .filter(Boolean)
          .join(' ');

        const receiptView: ApprovalReceiptVerificationView = {
          receiptId: created.receipt.id,
          requestId: created.request.id,
          receiptCode: created.receipt.receiptCode,
          studentName,
          studentNumber: created.request.student.profile?.studentNumber ?? null,
          type: created.request.type,
          deliveryMethod: created.request.deliveryMethod,
          approvedAt: created.request.processedAt,
          institutionName:
            created.request.institution?.institutionName ||
            'Issuing institution',
        };

        const mapped = this.mapApprovalReceiptView(
          receiptView,
          this.buildReceiptVerificationUrl(rawToken),
          expiresAt,
          ttlSeconds,
        );

        await this.createAuditEntry({
          action: AuditAction.REQUEST_RECEIPT_GENERATED,
          actorId,
          targetType: 'CredentialRequest',
          targetId: created.request.id,
          description: `Approval receipt generated for request ${created.request.id}`,
          metadata: {
            requestId: created.request.id,
            receiptId: created.receipt.id,
            receiptCode: created.receipt.receiptCode,
            deliveryMethod: created.request.deliveryMethod,
            expiresAt: expiresAt.toISOString(),
          },
        });

        return mapped;
      } catch (error) {
        lastError = error;
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('RECEIPT_GENERATION_FAILED');
  }

  private async createAuditEntry(payload: {
    action: AuditAction;
    actorId?: string | null;
    targetType?: string;
    targetId?: string;
    description?: string;
    metadata?: Prisma.InputJsonValue | null;
  }): Promise<void> {
    try {
      await credentialRequestRepository.createAuditLog({
        action: payload.action,
        actorId: payload.actorId,
        targetType: payload.targetType,
        targetId: payload.targetId,
        description: payload.description,
        metadata: payload.metadata,
      });
    } catch (error) {
      console.error('Failed to write credential-request audit entry:', error);
    }
  }

  private formatEnumLabel(value: string): string {
    return value
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  private formatFullName(user: Pick<UserContext, 'firstName' | 'middleName' | 'lastName'>): string {
    return [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');
  }

  private async notifyInstitutionAboutStudentRequest(
    institutionId: string,
    actor: UserContext,
    request: PrismaCredentialRequest,
  ): Promise<void> {
    try {
      const recipients = await credentialRequestRepository.listInstitutionNotificationRecipients(
        institutionId,
      );
      if (recipients.length === 0) {
        return;
      }

      const studentName = this.formatFullName(actor);
      const requestType = request.type.toLowerCase();
      const title = 'New student credential request';
      const message = `${studentName} (${actor.email}) submitted a ${requestType} request: "${request.title}".`;

      await Promise.allSettled(
        recipients.map(recipient =>
          notificationClient.createSystemNotification({
            userId: recipient.id,
            type: NotificationType.CREDENTIAL_REQUEST_UPDATE,
            title,
            message,
            metadata: {
              event: 'STUDENT_REQUEST_CREATED',
              requestId: request.id,
              requestType: request.type,
              studentId: actor.id,
              studentName,
              studentEmail: actor.email,
              institutionId,
            },
          }),
        ),
      );
    } catch (error) {
      console.error('Failed to notify institution about student credential request:', error);
    }
  }

  private buildStudentStatusNotification(
    status: CredentialRequestStatus,
    request: PrismaCredentialRequest,
    actor: UserContext,
    rejectionReason?: string | null,
  ): { title: string; message: string } | null {
    const actorName = this.formatFullName(actor) || actor.email;
    const requestType = this.formatEnumLabel(request.type);

    switch (status) {
      case CredentialRequestStatus.APPROVED:
        return {
          title: 'Credential request approved',
          message: `Your ${requestType} request "${request.title}" was approved by ${actorName}.`,
        };
      case CredentialRequestStatus.REJECTED:
        return {
          title: 'Credential request rejected',
          message: rejectionReason
            ? `Your ${requestType} request "${request.title}" was rejected by ${actorName}. Reason: ${rejectionReason}`
            : `Your ${requestType} request "${request.title}" was rejected by ${actorName}.`,
        };
      case CredentialRequestStatus.COMPLETED:
        return {
          title: 'Credential request completed',
          message: `Your ${requestType} request "${request.title}" has been completed by ${actorName}.`,
        };
      case CredentialRequestStatus.CANCELLED:
        return {
          title: 'Credential request cancelled',
          message: `Your ${requestType} request "${request.title}" was cancelled by ${actorName}.`,
        };
      default:
        return null;
    }
  }

  private async notifyStudentAboutRequestStatusUpdate(
    request: PrismaCredentialRequest,
    previousStatus: CredentialRequestStatus,
    actor: UserContext,
  ): Promise<void> {
    if (request.status === previousStatus) {
      return;
    }

    const content = this.buildStudentStatusNotification(
      request.status,
      request,
      actor,
      request.rejectionReason,
    );
    if (!content) {
      return;
    }

    try {
      await notificationClient.createSystemNotification({
        userId: request.studentId,
        type: NotificationType.CREDENTIAL_REQUEST_UPDATE,
        title: content.title,
        message: content.message,
        metadata: {
          event: 'REQUEST_STATUS_UPDATED',
          requestId: request.id,
          previousStatus,
          nextStatus: request.status,
          requestType: request.type,
          requestTitle: request.title,
          processedById: actor.id,
          processedByName: this.formatFullName(actor),
          processedByEmail: actor.email,
          credentialId: request.credentialId,
          rejectionReason: request.rejectionReason,
        },
      });
    } catch (error) {
      console.error('Failed to notify student about credential request status update:', error);
    }
  }

  private isInstitutionScopedRole(role: Role): boolean {
    return role === Role.INSTITUTION;
  }

  private ensureCanCreateForRole(actor: UserContext): void {
    if (!['STUDENT', 'INSTITUTION'].includes(actor.role)) {
      throw new Error('FORBIDDEN_ROLE');
    }
  }

  private buildListScopeWhere(
    actor: UserContext,
    query: ListCredentialRequestsQueryDto,
  ): Prisma.CredentialRequestWhereInput {
    const where: Prisma.CredentialRequestWhereInput = {};

    if (query.status) {
      where.status = query.status as CredentialRequestStatus;
    }
    if (query.studentId) {
      where.studentId = query.studentId;
    }

    if (actor.role === Role.ADMIN) {
      return where;
    }

    if (actor.role === Role.STUDENT) {
      return {
        AND: [
          where,
          {
            OR: [{ studentId: actor.id }, { requesterId: actor.id }],
          },
        ],
      };
    }

    if (this.isInstitutionScopedRole(actor.role)) {
      if (!actor.institutionId) {
        throw new Error('INSTITUTION_CONTEXT_MISSING');
      }

      return {
        AND: [
          where,
          {
            OR: [
              { institutionId: actor.institutionId },
              { student: { institutionId: actor.institutionId } },
            ],
          },
        ],
      };
    }

    throw new Error('FORBIDDEN_ROLE');
  }

  async listCredentialRequests(
    actorUserId: string,
    query: ListCredentialRequestsQueryDto,
  ): Promise<CredentialRequestResponseDto[]> {
    const actor = await credentialRequestRepository.getUserContextById(actorUserId);
    if (!actor) {
      throw new Error('ACTOR_NOT_FOUND');
    }

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 100));
    const skip = (page - 1) * pageSize;
    const where = this.buildListScopeWhere(actor, query);

    const requests = await credentialRequestRepository.listCredentialRequests(where, skip, pageSize);
    return requests.map(toCredentialRequestResponse);
  }

  async createCredentialRequest(
    actorUserId: string,
    data: CreateCredentialRequestDto,
  ): Promise<CredentialRequestResponseDto> {
    const actor = await credentialRequestRepository.getUserContextById(actorUserId);
    if (!actor) {
      throw new Error('ACTOR_NOT_FOUND');
    }

    this.ensureCanCreateForRole(actor);

    const title = data.title.trim();
    if (!title) {
      throw new Error('TITLE_REQUIRED');
    }

    const type = data.type;
    const deliveryMethod = (data.deliveryMethod ?? 'DIGITAL') as DeliveryMethod;

    let studentId = parseOptionalString(data.studentId);
    let requesterType: RequesterType = RequesterType.STUDENT;
    let institutionId: string | null = null;

    if (actor.role === Role.STUDENT) {
      studentId = actor.id;
      requesterType = RequesterType.STUDENT;
      institutionId = actor.institutionId ?? null;
    } else if (this.isInstitutionScopedRole(actor.role)) {
      if (!studentId) {
        throw new Error('STUDENT_ID_REQUIRED');
      }
      requesterType = RequesterType.INSTITUTION;
      institutionId = actor.institutionId;
      if (!institutionId) {
        throw new Error('INSTITUTION_CONTEXT_MISSING');
      }
    }

    if (!studentId) {
      throw new Error('STUDENT_ID_REQUIRED');
    }

    try {
      const created = await credentialRequestRepository.createCredentialRequest({
        studentId,
        credentialId: parseOptionalString(data.credentialId),
        type,
        title,
        description: parseOptionalString(data.description),
        purpose: parseOptionalString(data.purpose),
        deliveryMethod,
        status: CredentialRequestStatus.PENDING,
        requesterType,
        requesterId: actor.id,
        institutionId,
      });

      if (actor.role === Role.STUDENT && institutionId) {
        void this.notifyInstitutionAboutStudentRequest(institutionId, actor, created);
      }

      await this.createAuditEntry({
        action: AuditAction.CREDENTIAL_REQUESTED,
        actorId: actor.id,
        targetType: 'CredentialRequest',
        targetId: created.id,
        description: `${actor.role} created credential request "${created.title}"`,
        metadata: {
          requestId: created.id,
          requestType: created.type,
          requesterType: created.requesterType,
          studentId: created.studentId,
          institutionId: created.institutionId,
        },
      });
      void realtimeClient.publishMany([
        {
          domain: 'credentialRequests',
          action: 'credential-request.created',
          entityId: created.id,
          scope: {
            userIds: [created.studentId],
            roles: ['ADMIN', 'INSTITUTION'],
            institutionIds: created.institutionId ? [created.institutionId] : [],
          },
        },
        {
          domain: 'audit',
          action: 'log.created',
          scope: { roles: ['ADMIN', 'INSTITUTION'] },
        },
      ]);

      return toCredentialRequestResponse(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new Error('FOREIGN_KEY_CONSTRAINT');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') {
        throw new Error('DATABASE_SCHEMA_MISMATCH');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new Error('RELATED_RECORD_NOT_FOUND');
      }
      throw error;
    }
  }

  async getCredentialRequestById(
    actorUserId: string,
    requestId: string,
  ): Promise<CredentialRequestResponseDto | null> {
    const actor = await credentialRequestRepository.getUserContextById(actorUserId);
    if (!actor) {
      throw new Error('ACTOR_NOT_FOUND');
    }

    const request = await credentialRequestRepository.getCredentialRequestById(requestId);
    if (!request) {
      return null;
    }

    const visible = this.buildListScopeWhere(actor, { studentId: request.studentId });
    const scoped = await credentialRequestRepository.listCredentialRequests(
      {
        AND: [visible, { id: requestId }],
      },
      0,
      1,
    );

    if (scoped.length === 0) {
      throw new Error('FORBIDDEN_SCOPE');
    }

    return toCredentialRequestResponse(request);
  }

  async updateCredentialRequestStatus(
    actorUserId: string,
    requestId: string,
    data: UpdateCredentialRequestStatusDto,
  ): Promise<CredentialRequestResponseDto> {
    const actor = await credentialRequestRepository.getUserContextById(actorUserId);
    if (!actor) {
      throw new Error('ACTOR_NOT_FOUND');
    }

    const target = await credentialRequestRepository.getCredentialRequestScopeById(requestId);
    if (!target) {
      throw new Error('REQUEST_NOT_FOUND');
    }

    const status = data.status as CredentialRequestStatus;
    const providedCredentialId = parseOptionalString(data.credentialId);

    if (status === CredentialRequestStatus.PENDING) {
      throw new Error('INVALID_STATUS_TRANSITION');
    }

    if (actor.role === Role.STUDENT) {
      const canAccess = target.studentId === actor.id || target.requesterId === actor.id;
      if (!canAccess) {
        throw new Error('FORBIDDEN_SCOPE');
      }
      if (status !== CredentialRequestStatus.CANCELLED) {
        throw new Error('FORBIDDEN_STATUS_FOR_ROLE');
      }
      if (target.status !== CredentialRequestStatus.PENDING) {
        throw new Error('CANNOT_CANCEL_NON_PENDING');
      }

      const updatedByStudent = await credentialRequestRepository.updateCredentialRequestStatus(requestId, {
        status,
        processedById: null,
        processedAt: null,
        rejectionReason: null,
      });

      await this.createAuditEntry({
        action: AuditAction.CREDENTIAL_REQUEST_REJECTED,
        actorId: actor.id,
        targetType: 'CredentialRequest',
        targetId: requestId,
        description: `Student cancelled credential request "${updatedByStudent.title}"`,
        metadata: {
          status: updatedByStudent.status,
          requestId,
        },
      });
      void realtimeClient.publishMany([
        {
          domain: 'credentialRequests',
          action: 'credential-request.status.updated',
          entityId: updatedByStudent.id,
          scope: {
            userIds: [updatedByStudent.studentId],
            roles: ['ADMIN', 'INSTITUTION'],
            institutionIds: updatedByStudent.institutionId ? [updatedByStudent.institutionId] : [],
          },
        },
        {
          domain: 'audit',
          action: 'log.created',
          scope: { roles: ['ADMIN', 'INSTITUTION'] },
        },
      ]);

      return toCredentialRequestResponse(updatedByStudent);
    }

    if (actor.role !== Role.ADMIN && !this.isInstitutionScopedRole(actor.role)) {
      throw new Error('FORBIDDEN_ROLE');
    }

    if (this.isInstitutionScopedRole(actor.role)) {
      if (!actor.institutionId) {
        throw new Error('INSTITUTION_CONTEXT_MISSING');
      }
      const targetInstitutionId = target.institutionId ?? target.student.institutionId;
      if (!targetInstitutionId || targetInstitutionId !== actor.institutionId) {
        throw new Error('FORBIDDEN_SCOPE');
      }
    }

    if (status === CredentialRequestStatus.REJECTED && !parseOptionalString(data.rejectionReason)) {
      throw new Error('REJECTION_REASON_REQUIRED');
    }

    const completionCredentialId =
      status === CredentialRequestStatus.COMPLETED
        ? providedCredentialId ?? target.credentialId
        : null;

    if (status === CredentialRequestStatus.COMPLETED && !completionCredentialId) {
      throw new Error('CREDENTIAL_ID_REQUIRED_FOR_COMPLETION');
    }

    const processedStatuses = new Set<CredentialRequestStatus>([
      CredentialRequestStatus.APPROVED,
      CredentialRequestStatus.COMPLETED,
      CredentialRequestStatus.REJECTED,
      CredentialRequestStatus.CANCELLED,
    ]);

    const updated = await credentialRequestRepository.updateCredentialRequestStatus(requestId, {
      status,
      processedById: processedStatuses.has(status) ? actor.id : null,
      processedAt: processedStatuses.has(status) ? new Date() : null,
      rejectionReason: status === CredentialRequestStatus.REJECTED
        ? parseOptionalString(data.rejectionReason)
        : null,
      ...(status === CredentialRequestStatus.COMPLETED
        ? { credentialId: completionCredentialId }
        : Object.prototype.hasOwnProperty.call(data, 'credentialId')
          ? { credentialId: providedCredentialId }
          : {}),
    });

    if (
      updated.status === CredentialRequestStatus.APPROVED &&
      (target.deliveryMethod === DeliveryMethod.PHYSICAL || target.deliveryMethod === DeliveryMethod.BOTH)
    ) {
      await this.createApprovalReceiptTokenForRequest(updated.id, actor.id);
    }

    if (actor.role === Role.ADMIN || this.isInstitutionScopedRole(actor.role)) {
      void this.notifyStudentAboutRequestStatusUpdate(updated, target.status, actor);
    }

    const auditActionByStatus: Partial<Record<CredentialRequestStatus, AuditAction>> = {
      APPROVED: AuditAction.CREDENTIAL_REQUEST_APPROVED,
      COMPLETED: AuditAction.CREDENTIAL_REQUEST_COMPLETED,
      REJECTED: AuditAction.CREDENTIAL_REQUEST_REJECTED,
      CANCELLED: AuditAction.CREDENTIAL_REQUEST_REJECTED,
    };

    await this.createAuditEntry({
      action: auditActionByStatus[updated.status] ?? AuditAction.SETTINGS_CHANGED,
      actorId: actor.id,
      targetType: 'CredentialRequest',
      targetId: updated.id,
      description: `${actor.role} changed request "${updated.title}" status from ${target.status} to ${updated.status}`,
      metadata: {
        requestId: updated.id,
        previousStatus: target.status,
        nextStatus: updated.status,
        studentId: updated.studentId,
        institutionId: updated.institutionId,
      },
    });
    void realtimeClient.publishMany([
      {
        domain: 'credentialRequests',
        action: 'credential-request.status.updated',
        entityId: updated.id,
        scope: {
          userIds: [updated.studentId],
          roles: ['ADMIN', 'INSTITUTION'],
          institutionIds: updated.institutionId ? [updated.institutionId] : [],
        },
      },
      {
        domain: 'audit',
        action: 'log.created',
        scope: { roles: ['ADMIN', 'INSTITUTION'] },
      },
    ]);

    return toCredentialRequestResponse(updated);
  }

  async markPhysicalClaimed(
    actorUserId: string,
    requestId: string,
    notes?: string,
  ): Promise<CredentialRequestResponseDto> {
    const actor = await credentialRequestRepository.getUserContextById(actorUserId);
    if (!actor) {
      throw new Error('ACTOR_NOT_FOUND');
    }

    const target = await credentialRequestRepository.getCredentialRequestScopeById(requestId);
    if (!target) {
      throw new Error('REQUEST_NOT_FOUND');
    }

    if (actor.role !== Role.ADMIN && !this.isInstitutionScopedRole(actor.role)) {
      throw new Error('FORBIDDEN_ROLE');
    }

    if (this.isInstitutionScopedRole(actor.role)) {
      if (!actor.institutionId) {
        throw new Error('INSTITUTION_CONTEXT_MISSING');
      }
      const targetInstitutionId = target.institutionId ?? target.student.institutionId;
      if (!targetInstitutionId || targetInstitutionId !== actor.institutionId) {
        throw new Error('FORBIDDEN_SCOPE');
      }
    }

    if (target.deliveryMethod !== DeliveryMethod.PHYSICAL && target.deliveryMethod !== DeliveryMethod.BOTH) {
      throw new Error('PHYSICAL_CLAIM_NOT_APPLICABLE');
    }
    if (target.status !== CredentialRequestStatus.APPROVED) {
      throw new Error('REQUEST_NOT_APPROVED');
    }
    if (target.deliveryMethod === DeliveryMethod.BOTH && !target.credentialId) {
      throw new Error('DIGITAL_ISSUANCE_REQUIRED_BEFORE_PHYSICAL_CLAIM');
    }

    const now = new Date();
    const updated = await credentialRequestRepository.updateCredentialRequestStatus(requestId, {
      status: CredentialRequestStatus.COMPLETED,
      processedById: actor.id,
      processedAt: now,
      rejectionReason: null,
    });

    const invalidatedCount = await credentialRequestRepository.invalidateActiveApprovalReceiptsForRequest(
      requestId,
      now,
    );

    if (actor.role === Role.ADMIN || this.isInstitutionScopedRole(actor.role)) {
      void this.notifyStudentAboutRequestStatusUpdate(updated, target.status, actor);
    }

    await this.createAuditEntry({
      action: AuditAction.CREDENTIAL_REQUEST_COMPLETED,
      actorId: actor.id,
      targetType: 'CredentialRequest',
      targetId: updated.id,
      description: `${actor.role} marked request "${updated.title}" as physically claimed`,
      metadata: {
        requestId: updated.id,
        previousStatus: target.status,
        nextStatus: updated.status,
        deliveryMethod: target.deliveryMethod,
        credentialId: updated.credentialId,
        notes: parseOptionalString(notes),
        invalidatedReceiptTokens: invalidatedCount,
      },
    });

    void realtimeClient.publishMany([
      {
        domain: 'credentialRequests',
        action: 'credential-request.status.updated',
        entityId: updated.id,
        scope: {
          userIds: [updated.studentId],
          roles: ['ADMIN', 'INSTITUTION'],
          institutionIds: updated.institutionId ? [updated.institutionId] : [],
        },
      },
      {
        domain: 'audit',
        action: 'log.created',
        scope: { roles: ['ADMIN', 'INSTITUTION'] },
      },
    ]);

    return toCredentialRequestResponse(updated);
  }

  async getApprovalReceipt(
    actorUserId: string,
    requestId: string,
  ): Promise<ApprovalReceiptResponseDto> {
    const actor = await credentialRequestRepository.getUserContextById(actorUserId);
    if (!actor) {
      throw new Error('ACTOR_NOT_FOUND');
    }

    const target = await credentialRequestRepository.getCredentialRequestScopeById(requestId);
    if (!target) {
      throw new Error('REQUEST_NOT_FOUND');
    }
    if (target.status !== CredentialRequestStatus.APPROVED) {
      throw new Error('REQUEST_NOT_APPROVED');
    }
    if (target.deliveryMethod === DeliveryMethod.DIGITAL) {
      throw new Error('RECEIPT_NOT_REQUIRED');
    }

    if (actor.role === Role.STUDENT && target.studentId !== actor.id) {
      throw new Error('FORBIDDEN_SCOPE');
    }
    if (this.isInstitutionScopedRole(actor.role)) {
      if (!actor.institutionId) {
        throw new Error('INSTITUTION_CONTEXT_MISSING');
      }
      const targetInstitutionId = target.institutionId ?? target.student.institutionId;
      if (!targetInstitutionId || targetInstitutionId !== actor.institutionId) {
        throw new Error('FORBIDDEN_SCOPE');
      }
    }
    if (actor.role !== Role.STUDENT && actor.role !== Role.ADMIN && !this.isInstitutionScopedRole(actor.role)) {
      throw new Error('FORBIDDEN_ROLE');
    }

    return this.createApprovalReceiptTokenForRequest(requestId, actor.id);
  }

  async verifyApprovalReceiptToken(
    rawToken: string,
  ): Promise<ApprovalReceiptVerificationResultDto> {
    const token = rawToken.trim();
    if (!token || token.length < 20) {
      await this.createAuditEntry({
        action: AuditAction.REQUEST_RECEIPT_INVALID,
        targetType: 'CredentialRequestApprovalReceipt',
        description: 'Malformed receipt verification token',
        metadata: { reason: 'MALFORMED' },
      });
      return { valid: false, reason: 'INVALID', receipt: null };
    }

    const now = new Date();
    const tokenHash = this.hashReceiptToken(token);
    const consumed = await credentialRequestRepository.consumeApprovalReceiptTokenAtomically(tokenHash, now);

    if (consumed.outcome === 'VALID' && consumed.receipt) {
      await this.createAuditEntry({
        action: AuditAction.REQUEST_RECEIPT_VERIFIED,
        targetType: 'CredentialRequestApprovalReceipt',
        targetId: consumed.receipt.receiptId,
        description: `Receipt ${consumed.receipt.receiptCode} verified`,
        metadata: {
          requestId: consumed.receipt.requestId,
          receiptCode: consumed.receipt.receiptCode,
        },
      });
      return {
        valid: true,
        receipt: {
          requestId: consumed.receipt.requestId,
          receiptCode: consumed.receipt.receiptCode,
          studentName: consumed.receipt.studentName,
          studentNumber: consumed.receipt.studentNumber,
          type: consumed.receipt.type as ApprovalReceiptResponseDto['type'],
          deliveryMethod: consumed.receipt.deliveryMethod,
          approvedAt: consumed.receipt.approvedAt ? consumed.receipt.approvedAt.toISOString() : null,
          institutionName: consumed.receipt.institutionName,
        },
      };
    }

    const auditAction =
      consumed.outcome === 'EXPIRED'
        ? AuditAction.REQUEST_RECEIPT_EXPIRED
        : AuditAction.REQUEST_RECEIPT_INVALID;
    await this.createAuditEntry({
      action: auditAction,
      targetType: 'CredentialRequestApprovalReceipt',
      description: 'Failed receipt verification attempt',
      metadata: {
        reason: consumed.outcome,
      },
    });

    return {
      valid: false,
      reason: consumed.outcome,
      receipt: null,
    };
  }

  private isReceiptCode(value: string): boolean {
    return /^APR-[0-9A-Fa-f]{8}$/i.test(value);
  }

  async lookupReceiptByCode(
    rawCode: string,
  ): Promise<ReceiptLookupResultDto> {
    const code = rawCode.trim().toUpperCase();

    if (!code || !this.isReceiptCode(code)) {
      await this.createAuditEntry({
        action: AuditAction.REQUEST_RECEIPT_INVALID,
        targetType: 'CredentialRequestApprovalReceipt',
        description: 'Malformed receipt code lookup attempt',
        metadata: { reason: 'MALFORMED', lookupOnly: true },
      });
      return { found: false, lookupOnly: true, receipt: null };
    }

    const result = await credentialRequestRepository.findApprovalReceiptByCode(code);

    if (!result) {
      await this.createAuditEntry({
        action: AuditAction.REQUEST_RECEIPT_INVALID,
        targetType: 'CredentialRequestApprovalReceipt',
        description: 'Receipt code lookup: not found',
        metadata: { reason: 'NOT_FOUND', lookupOnly: true },
      });
      return { found: false, lookupOnly: true, receipt: null };
    }

    await this.createAuditEntry({
      action: AuditAction.REQUEST_RECEIPT_VERIFIED,
      targetType: 'CredentialRequestApprovalReceipt',
      targetId: result.receipt.receiptId,
      description: `Receipt code lookup: ${result.receipt.receiptCode}`,
      metadata: {
        receiptCode: result.receipt.receiptCode,
        requestId: result.receipt.requestId,
        tokenStatus: result.tokenStatus,
        lookupOnly: true,
      },
    });

    return {
      found: true,
      lookupOnly: true,
      tokenStatus: result.tokenStatus,
      receipt: {
        receiptCode: result.receipt.receiptCode,
        requestId: result.receipt.requestId,
        studentName: result.receipt.studentName,
        studentNumber: result.receipt.studentNumber,
        type: result.receipt.type as 'TRANSCRIPT' | 'DIPLOMA' | 'CERTIFICATE' | 'DEGREE' | 'LICENSE',
        deliveryMethod: result.receipt.deliveryMethod,
        approvedAt: result.receipt.approvedAt ? result.receipt.approvedAt.toISOString() : null,
        institutionName: result.receipt.institutionName,
      },
    };
  }
}
