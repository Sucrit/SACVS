import crypto from 'node:crypto';
import {
  CredentialType,
  CredentialStatus,
  Prisma,
  Role,
} from '../../../../db/node_modules/@prisma/client';
import { CredentialRepository } from '../repository/credential.repository';
import {
  CreateCredentialDto,
  IssueCredentialDto,
  ListCredentialsQueryDto,
  QrTokenConsumerContext,
  QrVerificationCredentialViewDto,
  UpdateCredentialStatusDto,
} from '../dto/credential.dto';
import { notificationClient } from '../client/notification.client';
import { blockchainClient } from '../client/blockchain.client';
import { ENV } from '../config/env';
import { realtimeClient } from '../client/realtime.client';

const credentialRepository = new CredentialRepository();

const NO_RESULTS_SCOPE = '__no_results__';

const VALID_TRANSITIONS: Record<CredentialStatus, CredentialStatus[]> = {
  PENDING: ['ISSUED', 'REVOKED', 'EXPIRED'],
  ISSUED: ['REVOKED', 'EXPIRED'],
  REVOKED: [],
  EXPIRED: [],
};

const NON_EXPIRING_TYPES = new Set<CredentialType>([
  CredentialType.TRANSCRIPT,
  CredentialType.DIPLOMA,
  CredentialType.DEGREE,
]);
const CERTIFICATE_CATEGORIES = new Set(['ACADEMIC', 'PROFESSIONAL'] as const);
type CertificateCategory = 'ACADEMIC' | 'PROFESSIONAL';

const parseOptionalString = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const hasField = <T extends object>(obj: T, field: keyof T): boolean =>
  Object.prototype.hasOwnProperty.call(obj, field);

const parseOptionalDate = (
  value: string | undefined,
  errorCode: string,
): Date | null => {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(errorCode);
  }
  return date;
};

const extractCertificateCategory = (metadata: unknown): CertificateCategory | null => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const rawValue = (metadata as Record<string, unknown>).certificateCategory;
  if (typeof rawValue !== 'string') {
    return null;
  }

  const normalized = rawValue.trim().toUpperCase();
  if (!CERTIFICATE_CATEGORIES.has(normalized as CertificateCategory)) {
    return null;
  }

  return normalized as CertificateCategory;
};

const validateCertificateCategoryIfPresent = (metadata: unknown): void => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return;
  }

  const rawValue = (metadata as Record<string, unknown>).certificateCategory;
  if (typeof rawValue === 'undefined' || rawValue === null || rawValue === '') {
    return;
  }

  if (typeof rawValue !== 'string') {
    throw new Error('INVALID_CERTIFICATE_CATEGORY');
  }

  const normalized = rawValue.trim().toUpperCase();
  if (!CERTIFICATE_CATEGORIES.has(normalized as CertificateCategory)) {
    throw new Error('INVALID_CERTIFICATE_CATEGORY');
  }
};

export interface CredentialActor {
  userId: string;
  role?: `${Role}`;
  institutionId?: string | null;
  employerId?: string | null;
}

interface UpdateCredentialStatusOptions {
  notifyIssued?: boolean;
}

export class CredentialService {
  private getQrTokenPepperOrThrow(): string {
    const pepper = ENV.QR_TOKEN_PEPPER?.trim();
    if (!pepper) {
      throw new Error('QR_TOKEN_PEPPER_MISSING');
    }
    return pepper;
  }

  private hashQrToken(rawToken: string): string {
    const pepper = this.getQrTokenPepperOrThrow();
    return crypto.createHash('sha256').update(`${rawToken}:${pepper}`).digest('hex');
  }

  private buildVerificationUrl(rawToken: string): string {
    const baseUrl = ENV.QR_VERIFY_BASE_URL.replace(/\/+$/, '');
    return `${baseUrl}/verify/qr/${encodeURIComponent(rawToken)}`;
  }

  private mapCredentialVerificationView(view: {
    id: string;
    title: string;
    type: CredentialType;
    status: CredentialStatus;
    issuedDate: Date | null;
    expiryDate: Date | null;
    chain: string | null;
    txHash: string | null;
    blockNumber: number | null;
    student: {
      firstName: string;
      middleName: string | null;
      lastName: string;
      email: string;
      profile: {
        studentNumber: string;
      } | null;
    };
    issuedBy: {
      institution: {
        institutionName: string;
      } | null;
      firstName: string;
      lastName: string;
    };
  }): QrVerificationCredentialViewDto {
    const institutionName =
      view.issuedBy?.institution?.institutionName?.trim() ||
      `${view.issuedBy?.firstName ?? ''} ${view.issuedBy?.lastName ?? ''}`.trim() ||
      'Issuing institution';
    const studentOwner = [view.student.firstName, view.student.middleName, view.student.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return {
      id: view.id,
      title: view.title,
      type: view.type,
      status: view.status,
      studentOwner: studentOwner || 'Student',
      studentEmail: view.student.email,
      studentNumber: view.student.profile?.studentNumber ?? null,
      issuedDate: view.issuedDate ? view.issuedDate.toISOString() : null,
      expiryDate: view.expiryDate ? view.expiryDate.toISOString() : null,
      institutionName,
      chain: view.chain,
      txHash: view.txHash,
      blockNumber: view.blockNumber,
    };
  }

  private isInstitutionScopedRole(role?: `${Role}`): boolean {
    return role === Role.INSTITUTION;
  }

  private ensureCanCreateCredentials(actor: CredentialActor): void {
    if (actor.role !== Role.ADMIN && actor.role !== Role.INSTITUTION) {
      throw new Error('FORBIDDEN_ROLE');
    }
  }

  private ensureCanManageCredentials(actor: CredentialActor): void {
    if (actor.role !== Role.ADMIN && !this.isInstitutionScopedRole(actor.role)) {
      throw new Error('FORBIDDEN_ROLE');
    }
  }

  private canAccessCredential(
    actor: CredentialActor,
    credentialScope: {
      studentId: string;
      issuedById: string;
      student: { institutionId: string | null };
    },
  ): boolean {
    if (actor.role === Role.ADMIN) return true;
    if (actor.role === Role.STUDENT) return credentialScope.studentId === actor.userId;

    if (this.isInstitutionScopedRole(actor.role)) {
      if (!actor.institutionId) {
        throw new Error('INSTITUTION_CONTEXT_MISSING');
      }

      return (
        credentialScope.issuedById === actor.userId ||
        credentialScope.student.institutionId === actor.institutionId
      );
    }

    return false;
  }

  private isValidTransition(current: CredentialStatus, next: CredentialStatus): boolean {
    if (current === next) return true;
    return VALID_TRANSITIONS[current].includes(next);
  }

  private formatIssuerInstitutionName(
    issuer: {
      firstName: string;
      middleName: string | null;
      lastName: string;
      email: string;
      institution?: {
        institutionName: string;
      } | null;
    } | null | undefined,
  ): string {
    const institutionName = issuer?.institution?.institutionName?.trim();
    if (institutionName) {
      return institutionName;
    }
    return 'your institution';
  }

  private async emitIssuedNotification(payload: {
    userId: string;
    credentialId: string;
    credentialType: string;
    credentialTitle: string;
    institutionName: string;
    isReissue: boolean;
  }): Promise<void> {
    try {
      await notificationClient.sendCredentialIssuedNotification(payload);
    } catch (error) {
      console.error('Failed to send credential issued notification:', error);
    }
  }

  private async emitStatusChangedNotification(payload: {
    userId: string;
    credentialId: string;
    credentialType: string;
    credentialTitle: string;
    institutionName: string;
    previousStatus: CredentialStatus;
    nextStatus: CredentialStatus;
  }): Promise<void> {
    try {
      await notificationClient.sendCredentialStatusChangedNotification({
        userId: payload.userId,
        credentialId: payload.credentialId,
        credentialType: payload.credentialType,
        credentialTitle: payload.credentialTitle,
        institutionName: payload.institutionName,
        previousStatus: payload.previousStatus,
        nextStatus: payload.nextStatus,
      });
    } catch (error) {
      console.error('Failed to send credential status notification:', error);
    }
  }

  private async createAuditEntry(payload: {
    action: Prisma.AuditLogUncheckedCreateInput['action'];
    actorId?: string | null;
    actorRole?: `${Role}`;
    targetType?: string;
    targetId?: string;
    description?: string;
    metadata?: Prisma.InputJsonValue | null;
    severity?: Prisma.AuditLogUncheckedCreateInput['severity'];
  }): Promise<void> {
    try {
      await credentialRepository.createAuditLog({
        action: payload.action,
        actorId: payload.actorId,
        actorRole: payload.actorRole,
        targetType: payload.targetType,
        targetId: payload.targetId,
        description: payload.description,
        metadata: payload.metadata,
        severity: payload.severity,
      });
    } catch (error) {
      console.error('Failed to write credential audit entry:', error);
    }
  }

  async auditCredentialDocumentAccess(payload: {
    actorId?: string | null;
    actorRole?: `${Role}`;
    credentialId: string;
    outcome: 'GRANTED' | 'DENIED';
    reason?: string;
  }): Promise<void> {
    await this.createAuditEntry({
      action: payload.outcome === 'GRANTED' ? 'ACCESS_GRANTED' : 'ACCESS_DENIED',
      actorId: payload.actorId,
      actorRole: payload.actorRole,
      targetType: 'CredentialDocument',
      targetId: payload.credentialId,
      description:
        payload.outcome === 'GRANTED'
          ? `Credential document access granted for ${payload.credentialId}`
          : `Credential document access denied for ${payload.credentialId}${payload.reason ? ` (${payload.reason})` : ''}`,
      metadata: {
        outcome: payload.outcome,
        reason: payload.reason ?? null,
      },
      severity: payload.outcome === 'GRANTED' ? 'INFO' : 'WARNING',
    });
  }

  private buildListWhere(
    actor: CredentialActor,
    query: ListCredentialsQueryDto,
  ): Prisma.CredentialWhereInput {
    const where: Prisma.CredentialWhereInput = {};

    if (query.studentId) {
      where.studentId = query.studentId;
    }
    if (query.issuedById) {
      where.issuedById = query.issuedById;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.type) {
      where.type = query.type;
    }

    if (query.scope === 'mine') {
      if (actor.role === Role.STUDENT) {
        return { ...where, studentId: actor.userId };
      }
      if (this.isInstitutionScopedRole(actor.role) || actor.role === Role.ADMIN) {
        return { ...where, issuedById: actor.userId };
      }
      return { ...where, id: NO_RESULTS_SCOPE };
    }

    if (actor.role === Role.ADMIN) {
      return where;
    }

    if (actor.role === Role.STUDENT) {
      return { ...where, studentId: actor.userId };
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
              { issuedById: actor.userId },
              { student: { institutionId: actor.institutionId } },
            ],
          },
        ],
      };
    }

    return { ...where, id: NO_RESULTS_SCOPE };
  }

  async listCredentials(actor: CredentialActor, query: ListCredentialsQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 100));
    const skip = (page - 1) * pageSize;
    const where = this.buildListWhere(actor, query);

    return credentialRepository.listCredentials(where, skip, pageSize);
  }

  async createCredential(actor: CredentialActor, data: CreateCredentialDto) {
    this.ensureCanCreateCredentials(actor);

    const title = parseOptionalString(data.title);
    if (!title) {
      throw new Error('TITLE_REQUIRED');
    }

    const student = await credentialRepository.getStudentContextById(data.studentId);
    if (!student) {
      throw new Error('STUDENT_NOT_FOUND');
    }

    if (student.role !== Role.STUDENT) {
      throw new Error('TARGET_NOT_STUDENT');
    }

    if (this.isInstitutionScopedRole(actor.role)) {
      if (!actor.institutionId) {
        throw new Error('INSTITUTION_CONTEXT_MISSING');
      }
      if (student.institutionId !== actor.institutionId) {
        throw new Error('FORBIDDEN_SCOPE');
      }
    }

    const payloadIssuerId = parseOptionalString(data.issuedById);
    const issuedById = actor.role === Role.ADMIN ? payloadIssuerId ?? actor.userId : actor.userId;

    if (this.isInstitutionScopedRole(actor.role) && payloadIssuerId && payloadIssuerId !== actor.userId) {
      throw new Error('FORBIDDEN_ISSUER_OVERRIDE');
    }

    const anchoredAt = parseOptionalDate(data.anchoredAt, 'INVALID_ANCHORED_AT');
    let issuedDate = parseOptionalDate(data.issuedDate, 'INVALID_ISSUED_DATE');
    let expiryDate = parseOptionalDate(data.expiryDate, 'INVALID_EXPIRY_DATE');
    if (NON_EXPIRING_TYPES.has(data.type as CredentialType)) {
      expiryDate = null;
    }
    if (data.type === CredentialType.CERTIFICATE) {
      validateCertificateCategoryIfPresent(data.metadata);
    }

    const requestedStatus = (data.status ?? CredentialStatus.PENDING) as CredentialStatus;
    const status = requestedStatus;
    if (status === CredentialStatus.ISSUED) {
      throw new Error('DIRECT_ISSUED_CREATE_NOT_ALLOWED');
    }
    const createData: Prisma.CredentialUncheckedCreateInput = {
      title,
      type: data.type,
      status,
      description: parseOptionalString(data.description),
      studentId: data.studentId,
      issuedById,
      filename: parseOptionalString(data.filename),
      mimeType: parseOptionalString(data.mimeType),
      storageKey: parseOptionalString(data.storageKey),
      fileHash: parseOptionalString(data.fileHash),
      metadata: data.metadata ?? undefined,
      chain: parseOptionalString(data.chain),
      txHash: parseOptionalString(data.txHash),
      blockNumber: Number.isInteger(data.blockNumber) ? data.blockNumber : null,
      anchoredAt,
      issuedDate,
      expiryDate,
    };

    try {
      const created = await credentialRepository.createCredential(createData);
      await this.createAuditEntry({
        action: 'CREDENTIAL_CREATED',
        actorId: actor.userId,
        actorRole: actor.role,
        targetType: 'Credential',
        targetId: created.id,
        description: `Credential "${created.title}" created`,
        metadata: {
          studentId: created.studentId,
          type: created.type,
          status: created.status,
        },
      });
      void realtimeClient.publishMany([
        {
          domain: 'credentials',
          action: 'credential.created',
          entityId: created.id,
          scope: {
            userIds: [created.studentId],
            roles: ['ADMIN', 'INSTITUTION'],
            institutionIds: created.student.institutionId ? [created.student.institutionId] : [],
          },
        },
        {
          domain: 'audit',
          action: 'log.created',
          scope: { roles: ['ADMIN', 'INSTITUTION'] },
        },
      ]);
      return created;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new Error('FOREIGN_KEY_CONSTRAINT');
      }
      throw error;
    }
  }

  async getCredentialById(actor: CredentialActor, credentialId: string) {
    const scope = await credentialRepository.getCredentialScopeById(credentialId);
    if (!scope) {
      return null;
    }

    if (!this.canAccessCredential(actor, scope)) {
      throw new Error('FORBIDDEN_SCOPE');
    }

    return credentialRepository.getCredentialById(credentialId);
  }

  async updateCredentialStatus(
    actor: CredentialActor,
    credentialId: string,
    statusData: UpdateCredentialStatusDto,
    options?: UpdateCredentialStatusOptions,
  ) {
    this.ensureCanManageCredentials(actor);

    const scope = await credentialRepository.getCredentialScopeById(credentialId);
    if (!scope) {
      throw new Error('CREDENTIAL_NOT_FOUND');
    }

    if (!this.canAccessCredential(actor, scope)) {
      throw new Error('FORBIDDEN_SCOPE');
    }

    const currentStatus = scope.status;
    const nextStatus = statusData.status as CredentialStatus;

    if (currentStatus === CredentialStatus.REVOKED) {
      throw new Error('CREDENTIAL_REVOKED_IMMUTABLE');
    }

    if (!this.isValidTransition(currentStatus, nextStatus)) {
      throw new Error('INVALID_STATUS_TRANSITION');
    }

    const updateData: Prisma.CredentialUncheckedUpdateInput = {
      status: nextStatus,
    };
    const isNonExpiringCredential = NON_EXPIRING_TYPES.has(scope.type);
    let parsedExpiryDate: Date | null | undefined;
    let certificateCategory: CertificateCategory = 'ACADEMIC';

    if (hasField(statusData, 'description')) {
      updateData.description = parseOptionalString(statusData.description) ?? null;
    }
    if (hasField(statusData, 'filename')) {
      updateData.filename = parseOptionalString(statusData.filename) ?? null;
    }
    if (hasField(statusData, 'mimeType')) {
      updateData.mimeType = parseOptionalString(statusData.mimeType) ?? null;
    }
    if (hasField(statusData, 'storageKey')) {
      updateData.storageKey = parseOptionalString(statusData.storageKey) ?? null;
    }
    if (hasField(statusData, 'fileHash')) {
      updateData.fileHash = parseOptionalString(statusData.fileHash) ?? null;
    }
    if (hasField(statusData, 'metadata')) {
      updateData.metadata = statusData.metadata === null ? Prisma.JsonNull : statusData.metadata;
      if (scope.type === CredentialType.CERTIFICATE) {
        validateCertificateCategoryIfPresent(statusData.metadata);
      }
    }
    if (scope.type === CredentialType.CERTIFICATE) {
      if (hasField(statusData, 'metadata')) {
        certificateCategory = extractCertificateCategory(statusData.metadata) ?? 'ACADEMIC';
      } else {
        validateCertificateCategoryIfPresent(scope.metadata);
        certificateCategory = extractCertificateCategory(scope.metadata) ?? 'ACADEMIC';
      }
    }
    if (hasField(statusData, 'chain')) {
      updateData.chain = parseOptionalString(statusData.chain) ?? null;
    }
    if (hasField(statusData, 'txHash')) {
      updateData.txHash = parseOptionalString(statusData.txHash) ?? null;
    }
    if (hasField(statusData, 'blockNumber')) {
      if (
        typeof statusData.blockNumber !== 'undefined' &&
        !Number.isInteger(statusData.blockNumber)
      ) {
        throw new Error('INVALID_BLOCK_NUMBER');
      }
      updateData.blockNumber = statusData.blockNumber ?? null;
    }
    if (hasField(statusData, 'anchoredAt')) {
      updateData.anchoredAt = parseOptionalDate(statusData.anchoredAt, 'INVALID_ANCHORED_AT');
    }
    if (hasField(statusData, 'issuedDate')) {
      updateData.issuedDate = parseOptionalDate(statusData.issuedDate, 'INVALID_ISSUED_DATE');
    }
    if (hasField(statusData, 'expiryDate')) {
      parsedExpiryDate = isNonExpiringCredential
        ? null
        : parseOptionalDate(statusData.expiryDate, 'INVALID_EXPIRY_DATE');
      updateData.expiryDate = parsedExpiryDate;
    }

    if (nextStatus === CredentialStatus.ISSUED && !hasField(statusData, 'issuedDate') && !scope.issuedDate) {
      updateData.issuedDate = new Date();
    }

    if (nextStatus === CredentialStatus.ISSUED) {
      if (isNonExpiringCredential) {
        updateData.expiryDate = null;
      } else if (scope.type === CredentialType.LICENSE) {
        const effectiveExpiryDate = hasField(statusData, 'expiryDate')
          ? parsedExpiryDate ?? null
          : scope.expiryDate;

        if (!effectiveExpiryDate) {
          throw new Error('EXPIRY_DATE_REQUIRED');
        }
      } else if (scope.type === CredentialType.CERTIFICATE && certificateCategory === 'PROFESSIONAL') {
        const effectiveExpiryDate = hasField(statusData, 'expiryDate')
          ? parsedExpiryDate ?? null
          : scope.expiryDate;

        if (!effectiveExpiryDate) {
          throw new Error('EXPIRY_DATE_REQUIRED');
        }
      }
    }

    const hasOnChainRecord = Boolean(scope.chain || scope.txHash || scope.blockNumber || scope.anchoredAt);
    const incomingFileHash = hasField(statusData, 'fileHash')
      ? parseOptionalString(statusData.fileHash) ?? null
      : null;
    const effectiveFileHash = incomingFileHash ?? scope.fileHash;
    const fileHashChanged = incomingFileHash !== null && incomingFileHash !== scope.fileHash;
    const shouldAnchor =
      nextStatus === CredentialStatus.ISSUED &&
      (currentStatus !== CredentialStatus.ISSUED || fileHashChanged || !hasOnChainRecord);

    if (shouldAnchor) {
      if (!effectiveFileHash) {
        throw new Error('MISSING_CREDENTIAL_FILE');
      }

      try {
        const anchored = await blockchainClient.anchorCredential({
          credentialId: scope.id,
          studentId: scope.studentId,
          fileHash: effectiveFileHash,
          allowReissue: true,
        });

        updateData.chain = anchored.chain;
        updateData.txHash = anchored.txHash;
        updateData.blockNumber = Number.isInteger(anchored.blockNumber)
          ? anchored.blockNumber
          : null;
        updateData.anchoredAt =
          parseOptionalDate(anchored.anchoredAt, 'INVALID_ANCHORED_AT') ?? new Date();
      } catch (error) {
        console.error('Blockchain anchor failed:', error);
        if (error instanceof Error && error.message === 'BLOCKCHAIN_INTERFACE_UNREACHABLE') {
          throw new Error('BLOCKCHAIN_INTERFACE_UNREACHABLE');
        }
        if (error instanceof Error && error.message === 'INTERNAL_AUTH_MISCONFIGURED') {
          throw new Error('INTERNAL_AUTH_MISCONFIGURED');
        }
        throw new Error('BLOCKCHAIN_ANCHOR_FAILED');
      }
    }

    if (
      nextStatus === CredentialStatus.REVOKED &&
      hasOnChainRecord
    ) {
      try {
        await blockchainClient.revokeCredential({
          credentialId: scope.id,
        });
      } catch (error) {
        console.error('Blockchain revoke failed:', error);
        if (error instanceof Error && error.message === 'BLOCKCHAIN_INTERFACE_UNREACHABLE') {
          throw new Error('BLOCKCHAIN_INTERFACE_UNREACHABLE');
        }
        if (error instanceof Error && error.message === 'INTERNAL_AUTH_MISCONFIGURED') {
          throw new Error('INTERNAL_AUTH_MISCONFIGURED');
        }
        throw new Error('BLOCKCHAIN_REVOKE_FAILED');
      }
    }

    const updated = await credentialRepository.updateCredential(credentialId, updateData);

    if (nextStatus === CredentialStatus.ISSUED) {
      await this.createAuditEntry({
        action: 'CREDENTIAL_ISSUED',
        actorId: actor.userId,
        actorRole: actor.role,
        targetType: 'Credential',
        targetId: updated.id,
        description: 'Credential issued',
      });
    }

    if (currentStatus !== nextStatus && nextStatus !== CredentialStatus.ISSUED) {
      await this.createAuditEntry({
        action:
          nextStatus === CredentialStatus.REVOKED
            ? 'CREDENTIAL_REVOKED'
            : nextStatus === CredentialStatus.PENDING
              ? 'SETTINGS_CHANGED'
              : 'CREDENTIAL_VERIFIED',
        actorId: actor.userId,
        actorRole: actor.role,
        targetType: 'Credential',
        targetId: updated.id,
        description: `Credential status changed from ${currentStatus} to ${nextStatus}`,
        metadata: {
          previousStatus: currentStatus,
          nextStatus,
        },
      });
    }

    if (options?.notifyIssued && nextStatus === CredentialStatus.ISSUED) {
      const isReissue = currentStatus === CredentialStatus.ISSUED;
      const institutionName = this.formatIssuerInstitutionName(updated.issuedBy);

      void this.emitIssuedNotification({
        userId: scope.studentId,
        credentialId: updated.id,
        credentialType: scope.type,
        credentialTitle: updated.title,
        institutionName,
        isReissue,
      });
      void realtimeClient.publishMany([
        {
          domain: 'credentials',
          action: 'credential.issued',
          entityId: updated.id,
          scope: {
            userIds: [updated.studentId],
            roles: ['ADMIN', 'INSTITUTION', 'EMPLOYER'],
            institutionIds: updated.student.institutionId ? [updated.student.institutionId] : [],
          },
        },
        {
          domain: 'audit',
          action: 'log.created',
          scope: { roles: ['ADMIN', 'INSTITUTION', 'EMPLOYER'] },
        },
      ]);
      return updated;
    }

    if (currentStatus !== nextStatus) {
      const institutionName = this.formatIssuerInstitutionName(updated.issuedBy);
      void this.emitStatusChangedNotification({
        userId: scope.studentId,
        credentialId: updated.id,
        credentialType: scope.type,
        credentialTitle: updated.title,
        institutionName,
        previousStatus: currentStatus,
        nextStatus,
      });
      void realtimeClient.publishMany([
        {
          domain: 'credentials',
          action: 'credential.status.updated',
          entityId: updated.id,
          scope: {
            userIds: [updated.studentId],
            roles: ['ADMIN', 'INSTITUTION', 'EMPLOYER'],
            institutionIds: updated.student.institutionId ? [updated.student.institutionId] : [],
          },
        },
        {
          domain: 'audit',
          action: 'log.created',
          scope: { roles: ['ADMIN', 'INSTITUTION', 'EMPLOYER'] },
        },
      ]);
    }

    return updated;
  }

  async getCredentialDocumentContext(credentialId: string) {
    return credentialRepository.getCredentialForAiDocument(credentialId);
  }

  async issueCredential(actor: CredentialActor, credentialId: string, data: IssueCredentialDto) {
    const scope = await credentialRepository.getCredentialScopeById(credentialId);
    if (!scope) {
      throw new Error('CREDENTIAL_NOT_FOUND');
    }

    if (!this.canAccessCredential(actor, scope)) {
      throw new Error('FORBIDDEN_SCOPE');
    }

    const statusData: UpdateCredentialStatusDto = {
      ...data,
      status: 'ISSUED',
    };

    return this.updateCredentialStatus(actor, credentialId, statusData, {
      notifyIssued: true,
    });
  }

  async generateStudentQrToken(actor: CredentialActor, credentialId: string): Promise<{
    tokenId: string;
    verificationUrl: string;
    expiresAt: string;
    ttlSeconds: number;
    allowDocumentPreview: boolean;
    allowDocumentDownload: boolean;
  }> {
    return this.generateStudentQrTokenWithOptions(actor, credentialId, {});
  }

  async generateStudentQrTokenWithOptions(
    actor: CredentialActor,
    credentialId: string,
    options: {
      allowDocumentPreview?: boolean;
      allowDocumentDownload?: boolean;
    },
  ): Promise<{
    tokenId: string;
    verificationUrl: string;
    expiresAt: string;
    ttlSeconds: number;
    allowDocumentPreview: boolean;
    allowDocumentDownload: boolean;
  }> {
    if (actor.role !== Role.STUDENT) {
      throw new Error('FORBIDDEN_ROLE');
    }

    const scope = await credentialRepository.getCredentialScopeById(credentialId);
    if (!scope) {
      throw new Error('CREDENTIAL_NOT_FOUND');
    }

    if (!this.canAccessCredential(actor, scope)) {
      throw new Error('FORBIDDEN_SCOPE');
    }

    if (scope.status !== CredentialStatus.ISSUED) {
      throw new Error('CREDENTIAL_NOT_ISSUED');
    }

    const ttlSeconds = Math.max(30, Math.min(300, Math.floor(ENV.QR_TOKEN_TTL_SECONDS)));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = this.hashQrToken(rawToken);
    const allowDocumentPreview = Boolean(options.allowDocumentPreview);
    const allowDocumentDownload = allowDocumentPreview && Boolean(options.allowDocumentDownload);

    await credentialRepository.invalidateActiveQrTokens(scope.id, scope.studentId, now);
    const tokenRecord = await credentialRepository.createQrToken({
      credentialId: scope.id,
      studentId: scope.studentId,
      tokenHash,
      allowDocumentPreview,
      allowDocumentDownload,
      expiresAt,
    });

    await this.createAuditEntry({
      action: 'QR_TOKEN_GENERATED',
      actorId: actor.userId,
      actorRole: actor.role,
      targetType: 'CredentialQrToken',
      targetId: tokenRecord.id,
      description: `One-time QR token generated for credential ${scope.id}`,
      metadata: {
        credentialId: scope.id,
        studentId: scope.studentId,
        expiresAt: tokenRecord.expiresAt.toISOString(),
        ttlSeconds,
        allowDocumentPreview,
        allowDocumentDownload,
      },
      severity: 'INFO',
    });
    void realtimeClient.publishMany([
      {
        domain: 'credentials',
        action: 'credential.qr.generated',
        entityId: scope.id,
        scope: { userIds: [scope.studentId] },
      },
      {
        domain: 'audit',
        action: 'log.created',
        scope: { roles: ['ADMIN', 'INSTITUTION', 'EMPLOYER'] },
      },
    ]);

    return {
      tokenId: tokenRecord.id,
      verificationUrl: this.buildVerificationUrl(rawToken),
      expiresAt: tokenRecord.expiresAt.toISOString(),
      ttlSeconds,
      allowDocumentPreview,
      allowDocumentDownload,
    };
  }

  async consumeQrToken(
    rawToken: string,
    consumer: QrTokenConsumerContext,
  ): Promise<{
    valid: boolean;
    credential: QrVerificationCredentialViewDto | null;
    documentAccess?: {
      previewEnabled: boolean;
      downloadEnabled: boolean;
      token: string | null;
      expiresAt: string | null;
    };
    reason?: 'INVALID' | 'EXPIRED' | 'USED';
  }> {
    const normalizedToken = rawToken.trim();
    if (!normalizedToken) {
      throw new Error('QR_TOKEN_MALFORMED');
    }
    if (normalizedToken.length < 20 || normalizedToken.length > 512) {
      throw new Error('QR_TOKEN_MALFORMED');
    }

    const now = new Date();
    const tokenHash = this.hashQrToken(normalizedToken);
    const consumeResult = await credentialRepository.consumeQrTokenAtomically(tokenHash, now, {
      consumerType: consumer.consumerType,
      consumerId: consumer.consumerId,
      ipAddress: consumer.ipAddress,
    });

    if (consumeResult.outcome !== 'CONSUMED') {
      const reason = consumeResult.outcome;
      await this.createAuditEntry({
        action: reason === 'EXPIRED' ? 'QR_TOKEN_EXPIRED' : 'QR_TOKEN_INVALID',
        actorId: consumer.consumerId ?? null,
        actorRole: consumer.consumerType === 'EMPLOYER' ? Role.EMPLOYER : undefined,
        targetType: 'CredentialQrToken',
        description: `QR token verification failed: ${reason}`,
        metadata: {
          outcome: reason,
          consumerType: consumer.consumerType,
          ipAddress: consumer.ipAddress ?? null,
        },
        severity: 'WARNING',
      });

      return {
        valid: false,
        credential: null,
        reason,
      };
    }

    const view = await credentialRepository.getCredentialVerificationView(consumeResult.credentialId);
    if (!view) {
      await this.createAuditEntry({
        action: 'QR_TOKEN_INVALID',
        actorId: consumer.consumerId ?? null,
        actorRole: consumer.consumerType === 'EMPLOYER' ? Role.EMPLOYER : undefined,
        targetType: 'CredentialQrToken',
        description: 'QR token consumed but credential was not found',
        metadata: {
          credentialId: consumeResult.credentialId,
          consumerType: consumer.consumerType,
          ipAddress: consumer.ipAddress ?? null,
        },
        severity: 'WARNING',
      });

      return {
        valid: false,
        credential: null,
        reason: 'INVALID',
      };
    }

    const credential = this.mapCredentialVerificationView(view);
    let documentAccessToken: string | null = null;
    let documentAccessExpiresAt: string | null = null;

    if (consumeResult.allowDocumentPreview || consumeResult.allowDocumentDownload) {
      const rawDocumentToken = crypto.randomBytes(32).toString('base64url');
      const documentTokenHash = this.hashQrToken(rawDocumentToken);
      const documentTtlSeconds = Math.max(30, Math.min(300, Math.floor(ENV.QR_TOKEN_TTL_SECONDS)));
      const documentExpiresAt = new Date(now.getTime() + documentTtlSeconds * 1000);
      await credentialRepository.createQrDocumentToken({
        qrTokenId: consumeResult.qrTokenId,
        credentialId: consumeResult.credentialId,
        tokenHash: documentTokenHash,
        expiresAt: documentExpiresAt,
      });
      documentAccessToken = rawDocumentToken;
      documentAccessExpiresAt = documentExpiresAt.toISOString();
    }

    await this.createAuditEntry({
      action: 'QR_TOKEN_CONSUMED',
      actorId: consumer.consumerId ?? null,
      actorRole: consumer.consumerType === 'EMPLOYER' ? Role.EMPLOYER : undefined,
      targetType: 'Credential',
      targetId: view.id,
      description: 'One-time QR token consumed successfully',
      metadata: {
        credentialId: view.id,
        consumerType: consumer.consumerType,
        ipAddress: consumer.ipAddress ?? null,
      },
      severity: 'INFO',
    });

    return {
      valid: true,
      credential,
      documentAccess: {
        previewEnabled: consumeResult.allowDocumentPreview,
        downloadEnabled: consumeResult.allowDocumentDownload,
        token: documentAccessToken,
        expiresAt: documentAccessExpiresAt,
      },
    };
  }

  async consumeQrDocumentToken(rawToken: string, mode: 'preview' | 'download', ipAddress?: string | null): Promise<{
    credentialId: string;
  }> {
    const normalizedToken = rawToken.trim();
    if (!normalizedToken || normalizedToken.length < 20 || normalizedToken.length > 512) {
      throw new Error('QR_TOKEN_MALFORMED');
    }

    const now = new Date();
    const tokenHash = this.hashQrToken(normalizedToken);
    const result = await credentialRepository.consumeQrDocumentTokenAtomically(tokenHash, now, mode, ipAddress);
    if (result.outcome === 'INVALID') throw new Error('QR_TOKEN_INVALID');
    if (result.outcome === 'EXPIRED') throw new Error('QR_TOKEN_EXPIRED');
    if (result.outcome === 'USED') throw new Error('QR_TOKEN_USED');
    if (result.outcome === 'NOT_ALLOWED') throw new Error('QR_DOCUMENT_ACCESS_NOT_ALLOWED');
    if (result.outcome !== 'CONSUMED') throw new Error('QR_TOKEN_INVALID');

    return {
      credentialId: result.credentialId,
    };
  }
}
