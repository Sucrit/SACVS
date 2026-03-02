import {
  AiDecision,
  AiReviewStatus,
  CredentialType,
  CredentialStatus,
  FraudLabel,
  FraudLabelSource,
  NotificationType,
  Prisma,
  Role,
} from '../../../../db/node_modules/@prisma/client';
import { CredentialRepository } from '../repository/credential.repository';
import {
  AiReviewCredentialDto,
  CreateCredentialDto,
  CredentialAiQueueQueryDto,
  InternalAiResultDto,
  IssueCredentialDto,
  ListCredentialsQueryDto,
  UpdateCredentialStatusDto,
} from '../dto/credential.dto';
import { notificationClient } from '../client/notification.client';
import { blockchainClient } from '../client/blockchain.client';
import { aiClient } from '../client/ai.client';
import { ENV } from '../config/env';

const credentialRepository = new CredentialRepository();

const NO_RESULTS_SCOPE = '__no_results__';

const VALID_TRANSITIONS: Record<CredentialStatus, CredentialStatus[]> = {
  PENDING: ['AI_REVIEW', 'ISSUED', 'REVOKED', 'EXPIRED'],
  AI_REVIEW: ['ISSUED', 'REVOKED', 'EXPIRED'],
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
const AI_SCORE_CLEAR_THRESHOLD = ENV.AI_SCORE_CLEAR_THRESHOLD;
const AI_SCORE_BLOCK_THRESHOLD = ENV.AI_SCORE_BLOCK_THRESHOLD;

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

  private async queueAiAnalysis(credentialId: string, reason: 'CREATE' | 'REISSUE' | 'REANALYZE'): Promise<void> {
    if (!ENV.AI_ENABLED) {
      return;
    }

    try {
      await aiClient.queueAnalyze({ credentialId, reason });
      await this.createAuditEntry({
        action: 'AI_VALIDATION_RUN',
        targetType: 'Credential',
        targetId: credentialId,
        description: `Queued AI analysis (${reason})`,
        metadata: {
          reason,
        },
      });
    } catch (error) {
      await this.createAuditEntry({
        action: 'AI_VALIDATION_FAILED',
        severity: 'WARNING',
        targetType: 'Credential',
        targetId: credentialId,
        description: `Failed to queue AI analysis (${reason})`,
      });
      console.error('Failed queueing AI analysis:', error);
    }
  }

  private canIssueWithAiGate(scope: {
    status: CredentialStatus;
    aiDecision: AiDecision | null;
    aiReviewStatus: AiReviewStatus | null;
  }): boolean {
    if (!ENV.AI_ENABLED || !ENV.AI_ENFORCE_GATE) return true;
    if (scope.aiReviewStatus === AiReviewStatus.OVERRIDDEN) return true;
    if (scope.aiReviewStatus === AiReviewStatus.APPROVED) return true;
    return scope.aiDecision === AiDecision.CLEAR;
  }

  private mapScoreDecision(score: number | null): AiDecision {
    if (typeof score !== 'number') return AiDecision.PENDING;
    if (score < AI_SCORE_CLEAR_THRESHOLD) return AiDecision.CLEAR;
    if (score >= AI_SCORE_BLOCK_THRESHOLD) return AiDecision.BLOCK;
    return AiDecision.REVIEW_REQUIRED;
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

    const aiValidatedAt = parseOptionalDate(data.aiValidatedAt, 'INVALID_AI_VALIDATED_AT');
    const anchoredAt = parseOptionalDate(data.anchoredAt, 'INVALID_ANCHORED_AT');
    let issuedDate = parseOptionalDate(data.issuedDate, 'INVALID_ISSUED_DATE');
    let expiryDate = parseOptionalDate(data.expiryDate, 'INVALID_EXPIRY_DATE');
    if (NON_EXPIRING_TYPES.has(data.type as CredentialType)) {
      expiryDate = null;
    }
    if (data.type === CredentialType.CERTIFICATE) {
      validateCertificateCategoryIfPresent(data.metadata);
    }

    const hasFile = Boolean(data.fileHash && data.filename && data.mimeType && data.storageKey);
    const requestedStatus = (data.status ?? CredentialStatus.PENDING) as CredentialStatus;
    const status =
      ENV.AI_ENABLED && hasFile ? CredentialStatus.AI_REVIEW : requestedStatus;
    if (status === CredentialStatus.ISSUED) {
      throw new Error('DIRECT_ISSUED_CREATE_NOT_ALLOWED');
    }
    const aiScore = typeof data.aiScore === 'number' ? data.aiScore : null;
    const aiDecision = ENV.AI_ENABLED
      ? hasFile
        ? AiDecision.PENDING
        : this.mapScoreDecision(aiScore)
      : null;
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
      aiStatus: parseOptionalString(data.aiStatus),
      aiScore,
      aiReport: data.aiReport ?? undefined,
      aiValidatedAt,
      aiDecision,
      aiReviewStatus:
        ENV.AI_ENABLED && hasFile
          ? AiReviewStatus.PENDING
          : data.aiReviewStatus ?? null,
      aiModel: parseOptionalString(data.aiModel),
      aiModelVersion: parseOptionalString(data.aiModelVersion),
      aiSignals: data.aiSignals ?? undefined,
      aiReviewedById: parseOptionalString(data.aiReviewedById),
      aiReviewedAt: parseOptionalDate(data.aiReviewedAt, 'INVALID_AI_VALIDATED_AT'),
      aiOverrideReason: parseOptionalString(data.aiOverrideReason),
      chain: parseOptionalString(data.chain),
      txHash: parseOptionalString(data.txHash),
      blockNumber: Number.isInteger(data.blockNumber) ? data.blockNumber : null,
      anchoredAt,
      issuedDate,
      expiryDate,
    };

    try {
      const created = await credentialRepository.createCredential(createData);
      if (ENV.AI_ENABLED && hasFile) {
        await this.queueAiAnalysis(created.id, 'CREATE');
        if (created.student?.institutionId) {
          const recipients = await credentialRepository.listInstitutionReviewerIds(
            created.student.institutionId,
          );
          await Promise.allSettled(
            recipients.map(recipient =>
              notificationClient.createSystemNotification({
                userId: recipient.id,
                type: NotificationType.CREDENTIAL_REQUEST_UPDATE,
                title: 'Credential requires AI review',
                message: `Credential "${created.title}" is awaiting AI fraud review.`,
                metadata: {
                  credentialId: created.id,
                  event: 'AI_REVIEW_REQUIRED',
                },
              }),
            ),
          );
        }
      }
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
    if (hasField(statusData, 'aiStatus')) {
      updateData.aiStatus = parseOptionalString(statusData.aiStatus) ?? null;
    }
    if (hasField(statusData, 'aiScore')) {
      updateData.aiScore = typeof statusData.aiScore === 'number' ? statusData.aiScore : null;
    }
    if (hasField(statusData, 'aiReport')) {
      updateData.aiReport = statusData.aiReport === null ? Prisma.JsonNull : statusData.aiReport;
    }
    if (hasField(statusData, 'aiValidatedAt')) {
      updateData.aiValidatedAt = parseOptionalDate(statusData.aiValidatedAt, 'INVALID_AI_VALIDATED_AT');
    }
    if (hasField(statusData, 'aiDecision')) {
      updateData.aiDecision = statusData.aiDecision ?? null;
    }
    if (hasField(statusData, 'aiReviewStatus')) {
      updateData.aiReviewStatus = statusData.aiReviewStatus ?? null;
    }
    if (hasField(statusData, 'aiModel')) {
      updateData.aiModel = parseOptionalString(statusData.aiModel) ?? null;
    }
    if (hasField(statusData, 'aiModelVersion')) {
      updateData.aiModelVersion = parseOptionalString(statusData.aiModelVersion) ?? null;
    }
    if (hasField(statusData, 'aiSignals')) {
      updateData.aiSignals = statusData.aiSignals === null ? Prisma.JsonNull : statusData.aiSignals;
    }
    if (hasField(statusData, 'aiReviewedById')) {
      updateData.aiReviewedById = parseOptionalString(statusData.aiReviewedById) ?? null;
    }
    if (hasField(statusData, 'aiReviewedAt')) {
      updateData.aiReviewedAt = parseOptionalDate(statusData.aiReviewedAt, 'INVALID_AI_VALIDATED_AT');
    }
    if (hasField(statusData, 'aiOverrideReason')) {
      updateData.aiOverrideReason = parseOptionalString(statusData.aiOverrideReason) ?? null;
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

    if (nextStatus === CredentialStatus.ISSUED && !this.canIssueWithAiGate(scope)) {
      const overrideReason = parseOptionalString(statusData.aiOverrideReason) ?? null;
      if (overrideReason && (actor.role === Role.ADMIN || this.isInstitutionScopedRole(actor.role))) {
        updateData.aiReviewStatus = AiReviewStatus.OVERRIDDEN;
        updateData.aiReviewedById = actor.userId;
        updateData.aiReviewedAt = new Date();
        updateData.aiOverrideReason = overrideReason;
      } else {
        throw new Error('AI_REVIEW_REQUIRED_BEFORE_ISSUE');
      }
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
        throw new Error('BLOCKCHAIN_REVOKE_FAILED');
      }
    }

    const updated = await credentialRepository.updateCredential(credentialId, updateData);

    if (nextStatus === CredentialStatus.ISSUED) {
      await this.createAuditEntry({
        action: 'CREDENTIAL_VERIFIED_BY_AI',
        actorId: actor.userId,
        actorRole: actor.role,
        targetType: 'Credential',
        targetId: updated.id,
        description:
          updateData.aiReviewStatus === AiReviewStatus.OVERRIDDEN
            ? 'Credential issued with AI override'
            : 'Credential issued after AI validation',
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
    }

    return updated;
  }

  async getCredentialAiReport(actor: CredentialActor, credentialId: string) {
    const credential = await this.getCredentialById(actor, credentialId);
    if (!credential) {
      return null;
    }

    return {
      id: credential.id,
      aiDecision: credential.aiDecision ?? null,
      aiReviewStatus: credential.aiReviewStatus ?? null,
      aiStatus: credential.aiStatus ?? null,
      aiScore: credential.aiScore ?? null,
      aiModel: credential.aiModel ?? null,
      aiModelVersion: credential.aiModelVersion ?? null,
      aiValidatedAt: credential.aiValidatedAt ? credential.aiValidatedAt.toISOString() : null,
      aiReviewedById: credential.aiReviewedById ?? null,
      aiReviewedAt: credential.aiReviewedAt ? credential.aiReviewedAt.toISOString() : null,
      aiOverrideReason: credential.aiOverrideReason ?? null,
      aiSignals: credential.aiSignals ?? null,
      aiReport: credential.aiReport ?? null,
    };
  }

  async reviewCredentialAi(
    actor: CredentialActor,
    credentialId: string,
    data: AiReviewCredentialDto,
  ) {
    this.ensureCanManageCredentials(actor);
    const scope = await credentialRepository.getCredentialScopeById(credentialId);
    if (!scope) {
      throw new Error('CREDENTIAL_NOT_FOUND');
    }
    if (!this.canAccessCredential(actor, scope)) {
      throw new Error('FORBIDDEN_SCOPE');
    }

    if (scope.status === CredentialStatus.REVOKED) {
      throw new Error('CREDENTIAL_REVOKED_IMMUTABLE');
    }

    const label = data.label ?? 'UNSURE';
    const source = actor.role === Role.ADMIN ? FraudLabelSource.ADMIN : FraudLabelSource.INSTITUTION;
    const action = data.action;
    const reason = parseOptionalString(data.reason);
    const updateData: Prisma.CredentialUncheckedUpdateInput = {
      aiReviewedById: actor.userId,
      aiReviewedAt: new Date(),
    };

    if (action === 'APPROVE') {
      updateData.aiReviewStatus = AiReviewStatus.APPROVED;
      updateData.aiDecision = AiDecision.CLEAR;
    } else if (action === 'REJECT') {
      updateData.aiReviewStatus = AiReviewStatus.REJECTED;
      updateData.aiDecision = AiDecision.BLOCK;
      updateData.status = CredentialStatus.REVOKED;
      updateData.aiOverrideReason = null;
    } else if (action === 'OVERRIDE') {
      if (!reason) {
        throw new Error('AI_OVERRIDE_REASON_REQUIRED');
      }
      updateData.aiReviewStatus = AiReviewStatus.OVERRIDDEN;
      updateData.aiOverrideReason = reason;
    } else {
      throw new Error('INVALID_AI_REVIEW_ACTION');
    }

    const updated = await credentialRepository.updateCredential(credentialId, updateData);
    await credentialRepository.createFraudReviewLabel({
      credentialId,
      reviewedById: actor.userId,
      label: label as FraudLabel,
      source,
      notes: reason,
    });

    await this.createAuditEntry({
      action: action === 'REJECT' ? 'AI_VALIDATION_FAILED' : 'CREDENTIAL_VERIFIED_BY_AI',
      actorId: actor.userId,
      actorRole: actor.role,
      targetType: 'Credential',
      targetId: credentialId,
      description: `AI review action: ${action}`,
      metadata: {
        action,
        label,
        reason,
      },
    });

    if (action === 'REJECT') {
      const institutionName = this.formatIssuerInstitutionName(updated.issuedBy);
      void notificationClient.createSystemNotification({
        userId: updated.studentId,
        type: NotificationType.CREDENTIAL_REVOKED,
        title: 'Credential rejected by fraud review',
        message: `Your credential "${updated.title}" was rejected during fraud review by ${institutionName}.`,
        metadata: {
          credentialId: updated.id,
          event: 'AI_REVIEW_REJECTED',
          reason,
        },
      });
    }

    return updated;
  }

  async queueCredentialAiReanalyze(actor: CredentialActor, credentialId: string) {
    this.ensureCanManageCredentials(actor);
    const scope = await credentialRepository.getCredentialScopeById(credentialId);
    if (!scope) {
      throw new Error('CREDENTIAL_NOT_FOUND');
    }
    if (!this.canAccessCredential(actor, scope)) {
      throw new Error('FORBIDDEN_SCOPE');
    }

    const updated = await credentialRepository.updateCredential(credentialId, {
      status: CredentialStatus.AI_REVIEW,
      aiDecision: AiDecision.PENDING,
      aiReviewStatus: AiReviewStatus.PENDING,
      aiReviewedById: null,
      aiReviewedAt: null,
      aiOverrideReason: null,
    });
    await this.queueAiAnalysis(credentialId, 'REANALYZE');
    return updated;
  }

  async listAiQueue(actor: CredentialActor, query: CredentialAiQueueQueryDto) {
    this.ensureCanManageCredentials(actor);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 100));
    const skip = (page - 1) * pageSize;
    const baseWhere: Prisma.CredentialWhereInput = {
      status: CredentialStatus.AI_REVIEW,
      ...(query.decision ? { aiDecision: query.decision } : {}),
    };
    const where = this.buildListWhere(actor, {
      page,
      pageSize,
      status: 'AI_REVIEW',
    });
    return credentialRepository.listAiReviewQueue(
      {
        AND: [baseWhere, where],
      },
      skip,
      pageSize,
    );
  }

  async applyInternalAiResult(data: InternalAiResultDto) {
    const scope = await credentialRepository.getCredentialScopeById(data.credentialId);
    if (!scope) {
      throw new Error('CREDENTIAL_NOT_FOUND');
    }

    const aiValidatedAt = parseOptionalDate(data.aiValidatedAt, 'INVALID_AI_VALIDATED_AT') ?? new Date();
    const aiScore = typeof data.aiScore === 'number' ? data.aiScore : null;
    const nextDecision = data.aiDecision ?? this.mapScoreDecision(aiScore);
    const nextStatus =
      nextDecision === AiDecision.CLEAR ? CredentialStatus.PENDING : CredentialStatus.AI_REVIEW;

    const updated = await credentialRepository.updateCredential(data.credentialId, {
      aiStatus: parseOptionalString(data.aiStatus) ?? nextDecision,
      aiScore,
      aiReport: data.aiReport ?? undefined,
      aiSignals: data.aiSignals ?? undefined,
      aiDecision: nextDecision,
      aiModel: parseOptionalString(data.aiModel) ?? null,
      aiModelVersion: parseOptionalString(data.aiModelVersion) ?? null,
      aiValidatedAt,
      aiReviewStatus:
        nextDecision === AiDecision.CLEAR ? AiReviewStatus.APPROVED : AiReviewStatus.PENDING,
      status: nextStatus,
    });

    await this.createAuditEntry({
      action:
        nextDecision === AiDecision.FAILED ? 'AI_VALIDATION_FAILED' : 'CREDENTIAL_VERIFIED_BY_AI',
      targetType: 'Credential',
      targetId: data.credentialId,
      description: `Applied AI result: ${nextDecision}`,
      metadata: {
        decision: nextDecision,
        provider: data.provider,
        error: data.error,
      },
      severity: nextDecision === AiDecision.FAILED ? 'WARNING' : 'INFO',
    });

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

    const hasNewFile = Boolean(data.fileHash && data.filename && data.mimeType && data.storageKey);
    if (ENV.AI_ENABLED && hasNewFile) {
      const updated = await credentialRepository.updateCredential(credentialId, {
        description: parseOptionalString(data.description) ?? undefined,
        filename: parseOptionalString(data.filename) ?? undefined,
        mimeType: parseOptionalString(data.mimeType) ?? undefined,
        storageKey: parseOptionalString(data.storageKey) ?? undefined,
        fileHash: parseOptionalString(data.fileHash) ?? undefined,
        metadata: data.metadata ?? undefined,
        aiDecision: AiDecision.PENDING,
        aiReviewStatus: AiReviewStatus.PENDING,
        aiOverrideReason: null,
        aiReviewedById: null,
        aiReviewedAt: null,
        status: CredentialStatus.AI_REVIEW,
      });
      await this.queueAiAnalysis(credentialId, 'REISSUE');
      return updated;
    }

    const statusData: UpdateCredentialStatusDto = {
      ...data,
      status: 'ISSUED',
    };

    return this.updateCredentialStatus(actor, credentialId, statusData, {
      notifyIssued: true,
    });
  }
}
