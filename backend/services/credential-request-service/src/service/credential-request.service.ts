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
  CreateCredentialRequestDto,
  CredentialRequestResponseDto,
  ListCredentialRequestsQueryDto,
  UpdateCredentialRequestStatusDto,
} from '../dto/credential-request.dto';
import {
  CredentialRequestRepository,
  UserContext,
} from '../repository/credential-request.repository';
import { notificationClient } from '../client/notification.client';

const credentialRequestRepository = new CredentialRequestRepository();

const parseOptionalString = (value?: string): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

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
    requesterType: request.requesterType,
    requesterId: request.requesterId,
    institutionId: request.institutionId,
    employerId: request.employerId,
  },
  createdAt: request.createdAt.toISOString(),
  updatedAt: request.updatedAt.toISOString(),
});

export class CredentialRequestService {
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
    if (!['STUDENT', 'EMPLOYER', 'INSTITUTION'].includes(actor.role)) {
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

    if (actor.role === Role.EMPLOYER) {
      return {
        AND: [
          where,
          actor.employerId
            ? { OR: [{ employerId: actor.employerId }, { requesterId: actor.id }] }
            : { requesterId: actor.id },
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
    let employerId: string | null = null;

    if (actor.role === Role.STUDENT) {
      studentId = actor.id;
      requesterType = RequesterType.STUDENT;
      institutionId = actor.institutionId ?? null;
    } else if (actor.role === Role.EMPLOYER) {
      if (!studentId) {
        throw new Error('STUDENT_ID_REQUIRED');
      }
      requesterType = RequesterType.EMPLOYER;
      employerId = actor.employerId ?? parseOptionalString(data.employerId);
      institutionId = parseOptionalString(data.institutionId);
      if (!employerId) {
        throw new Error('EMPLOYER_CONTEXT_MISSING');
      }
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
        employerId,
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
          employerId: created.employerId,
        },
      });

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
        employerId: updated.employerId,
      },
    });

    return toCredentialRequestResponse(updated);
  }
}
