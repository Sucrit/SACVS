import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Request, Response } from 'express';
import { Prisma } from '../../../../db/node_modules/@prisma/client';
import { CredentialService } from '../service/credential.service';
import {
  AiReviewCredentialDto,
  CreateCredentialDto,
  CredentialAiQueueQueryDto,
  InternalAiResultDto,
  IssueCredentialDto,
  ListCredentialsQueryDto,
  UpdateCredentialStatusDto,
} from '../dto/credential.dto';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { CREDENTIAL_UPLOADS_DIR } from '../config/uploads';

const credentialService = new CredentialService();

const VALID_CREDENTIAL_STATUSES = ['PENDING', 'AI_REVIEW', 'ISSUED', 'REVOKED', 'EXPIRED'] as const;
const VALID_CREDENTIAL_TYPES = ['TRANSCRIPT', 'DIPLOMA', 'CERTIFICATE', 'DEGREE', 'LICENSE'] as const;
const VALID_AI_REVIEW_ACTIONS = ['APPROVE', 'REJECT', 'OVERRIDE'] as const;
const VALID_AI_DECISIONS = ['PENDING', 'CLEAR', 'REVIEW_REQUIRED', 'BLOCK', 'FAILED'] as const;

type RequestWithFile = Request & { file?: Express.Multer.File };

export class CredentialController {
  private getActor(req: Request) {
    const auth = (req as AuthenticatedRequest).auth;
    return {
      userId: auth?.sub ?? null,
      role: auth?.role,
      institutionId: auth?.institutionId,
      employerId: auth?.employerId,
    };
  }

  private normalizeString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private normalizeNumber(value: unknown, errorCode: string): number | undefined {
    if (typeof value === 'undefined' || value === null || value === '') {
      return undefined;
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new Error(errorCode);
      }
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        throw new Error(errorCode);
      }
      return parsed;
    }

    throw new Error(errorCode);
  }

  private normalizeJson(
    value: unknown,
    errorCode: string,
  ): Prisma.InputJsonValue | null | undefined {
    if (typeof value === 'undefined') {
      return undefined;
    }
    if (value === null) {
      return null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return undefined;
      }

      try {
        return JSON.parse(trimmed) as Prisma.InputJsonValue | null;
      } catch {
        throw new Error(errorCode);
      }
    }

    if (typeof value === 'object') {
      return value as Prisma.InputJsonValue;
    }

    throw new Error(errorCode);
  }

  private extractUploadFields(req: Request): Partial<CreateCredentialDto> {
    const uploaded = (req as RequestWithFile).file;
    if (!uploaded) {
      return {};
    }

    const fileHash = createHash('sha256').update(readFileSync(uploaded.path)).digest('hex');

    return {
      filename: uploaded.originalname,
      mimeType: uploaded.mimetype,
      storageKey: `/credentials/uploads/${uploaded.filename}`,
      fileHash,
    };
  }

  private parseCreatePayload(rawBody: unknown): Partial<CreateCredentialDto> {
    const body = (rawBody ?? {}) as Record<string, unknown>;
    const status = this.normalizeString(body.status);
    const type = this.normalizeString(body.type);

    return {
      studentId: this.normalizeString(body.studentId),
      title: this.normalizeString(body.title),
      type: type as CreateCredentialDto['type'],
      description: this.normalizeString(body.description),
      issuedById: this.normalizeString(body.issuedById),
      status: status as CreateCredentialDto['status'],
      filename: this.normalizeString(body.filename),
      mimeType: this.normalizeString(body.mimeType),
      storageKey: this.normalizeString(body.storageKey),
      fileHash: this.normalizeString(body.fileHash),
      metadata: this.normalizeJson(body.metadata, 'INVALID_METADATA_JSON'),
      aiStatus: this.normalizeString(body.aiStatus),
      aiScore: this.normalizeNumber(body.aiScore, 'INVALID_AI_SCORE'),
      aiReport: this.normalizeJson(body.aiReport, 'INVALID_AI_REPORT_JSON'),
      aiValidatedAt: this.normalizeString(body.aiValidatedAt),
      aiDecision: this.normalizeString(body.aiDecision) as CreateCredentialDto['aiDecision'],
      aiReviewStatus: this.normalizeString(body.aiReviewStatus) as CreateCredentialDto['aiReviewStatus'],
      aiModel: this.normalizeString(body.aiModel),
      aiModelVersion: this.normalizeString(body.aiModelVersion),
      aiSignals: this.normalizeJson(body.aiSignals, 'INVALID_AI_SIGNALS_JSON'),
      aiReviewedById: this.normalizeString(body.aiReviewedById),
      aiReviewedAt: this.normalizeString(body.aiReviewedAt),
      aiOverrideReason: this.normalizeString(body.aiOverrideReason),
      chain: this.normalizeString(body.chain),
      txHash: this.normalizeString(body.txHash),
      blockNumber: this.normalizeNumber(body.blockNumber, 'INVALID_BLOCK_NUMBER'),
      anchoredAt: this.normalizeString(body.anchoredAt),
      issuedDate: this.normalizeString(body.issuedDate),
      expiryDate: this.normalizeString(body.expiryDate),
    };
  }

  private parseUpdateStatusPayload(rawBody: unknown): Partial<UpdateCredentialStatusDto> {
    const body = (rawBody ?? {}) as Record<string, unknown>;
    const payload: Partial<UpdateCredentialStatusDto> = {};

    if ('status' in body) payload.status = this.normalizeString(body.status) as UpdateCredentialStatusDto['status'];
    if ('description' in body) payload.description = this.normalizeString(body.description);
    if ('filename' in body) payload.filename = this.normalizeString(body.filename);
    if ('mimeType' in body) payload.mimeType = this.normalizeString(body.mimeType);
    if ('storageKey' in body) payload.storageKey = this.normalizeString(body.storageKey);
    if ('fileHash' in body) payload.fileHash = this.normalizeString(body.fileHash);
    if ('metadata' in body) payload.metadata = this.normalizeJson(body.metadata, 'INVALID_METADATA_JSON');
    if ('aiStatus' in body) payload.aiStatus = this.normalizeString(body.aiStatus);
    if ('aiScore' in body) payload.aiScore = this.normalizeNumber(body.aiScore, 'INVALID_AI_SCORE');
    if ('aiReport' in body) payload.aiReport = this.normalizeJson(body.aiReport, 'INVALID_AI_REPORT_JSON');
    if ('aiValidatedAt' in body) payload.aiValidatedAt = this.normalizeString(body.aiValidatedAt);
    if ('aiDecision' in body) payload.aiDecision = this.normalizeString(body.aiDecision) as UpdateCredentialStatusDto['aiDecision'];
    if ('aiReviewStatus' in body) payload.aiReviewStatus = this.normalizeString(body.aiReviewStatus) as UpdateCredentialStatusDto['aiReviewStatus'];
    if ('aiModel' in body) payload.aiModel = this.normalizeString(body.aiModel);
    if ('aiModelVersion' in body) payload.aiModelVersion = this.normalizeString(body.aiModelVersion);
    if ('aiSignals' in body) payload.aiSignals = this.normalizeJson(body.aiSignals, 'INVALID_AI_SIGNALS_JSON');
    if ('aiReviewedById' in body) payload.aiReviewedById = this.normalizeString(body.aiReviewedById);
    if ('aiReviewedAt' in body) payload.aiReviewedAt = this.normalizeString(body.aiReviewedAt);
    if ('aiOverrideReason' in body) payload.aiOverrideReason = this.normalizeString(body.aiOverrideReason);
    if ('chain' in body) payload.chain = this.normalizeString(body.chain);
    if ('txHash' in body) payload.txHash = this.normalizeString(body.txHash);
    if ('blockNumber' in body) payload.blockNumber = this.normalizeNumber(body.blockNumber, 'INVALID_BLOCK_NUMBER');
    if ('anchoredAt' in body) payload.anchoredAt = this.normalizeString(body.anchoredAt);
    if ('issuedDate' in body) payload.issuedDate = this.normalizeString(body.issuedDate);
    if ('expiryDate' in body) payload.expiryDate = this.normalizeString(body.expiryDate);

    return payload;
  }

  private parseIssuePayload(rawBody: unknown): Partial<IssueCredentialDto> {
    const body = (rawBody ?? {}) as Record<string, unknown>;
    const payload: Partial<IssueCredentialDto> = {};

    if ('description' in body) payload.description = this.normalizeString(body.description);
    if ('filename' in body) payload.filename = this.normalizeString(body.filename);
    if ('mimeType' in body) payload.mimeType = this.normalizeString(body.mimeType);
    if ('storageKey' in body) payload.storageKey = this.normalizeString(body.storageKey);
    if ('fileHash' in body) payload.fileHash = this.normalizeString(body.fileHash);
    if ('metadata' in body) payload.metadata = this.normalizeJson(body.metadata, 'INVALID_METADATA_JSON');
    if ('aiStatus' in body) payload.aiStatus = this.normalizeString(body.aiStatus);
    if ('aiScore' in body) payload.aiScore = this.normalizeNumber(body.aiScore, 'INVALID_AI_SCORE');
    if ('aiReport' in body) payload.aiReport = this.normalizeJson(body.aiReport, 'INVALID_AI_REPORT_JSON');
    if ('aiValidatedAt' in body) payload.aiValidatedAt = this.normalizeString(body.aiValidatedAt);
    if ('aiDecision' in body) payload.aiDecision = this.normalizeString(body.aiDecision) as IssueCredentialDto['aiDecision'];
    if ('aiReviewStatus' in body) payload.aiReviewStatus = this.normalizeString(body.aiReviewStatus) as IssueCredentialDto['aiReviewStatus'];
    if ('aiModel' in body) payload.aiModel = this.normalizeString(body.aiModel);
    if ('aiModelVersion' in body) payload.aiModelVersion = this.normalizeString(body.aiModelVersion);
    if ('aiSignals' in body) payload.aiSignals = this.normalizeJson(body.aiSignals, 'INVALID_AI_SIGNALS_JSON');
    if ('aiReviewedById' in body) payload.aiReviewedById = this.normalizeString(body.aiReviewedById);
    if ('aiReviewedAt' in body) payload.aiReviewedAt = this.normalizeString(body.aiReviewedAt);
    if ('aiOverrideReason' in body) payload.aiOverrideReason = this.normalizeString(body.aiOverrideReason);
    if ('chain' in body) payload.chain = this.normalizeString(body.chain);
    if ('txHash' in body) payload.txHash = this.normalizeString(body.txHash);
    if ('blockNumber' in body) payload.blockNumber = this.normalizeNumber(body.blockNumber, 'INVALID_BLOCK_NUMBER');
    if ('anchoredAt' in body) payload.anchoredAt = this.normalizeString(body.anchoredAt);
    if ('issuedDate' in body) payload.issuedDate = this.normalizeString(body.issuedDate);
    if ('expiryDate' in body) payload.expiryDate = this.normalizeString(body.expiryDate);

    return payload;
  }

  private parseAiQueueQuery(query: Request['query']): CredentialAiQueueQueryDto {
    const decision = typeof query.decision === 'string' ? query.decision : undefined;
    const page = typeof query.page === 'string' ? Number(query.page) : undefined;
    const pageSize = typeof query.pageSize === 'string' ? Number(query.pageSize) : undefined;

    if (decision && !VALID_AI_DECISIONS.includes(decision as (typeof VALID_AI_DECISIONS)[number])) {
      throw new Error('INVALID_AI_DECISION');
    }

    return {
      decision: decision as CredentialAiQueueQueryDto['decision'],
      page,
      pageSize,
    };
  }

  private parseAiReviewPayload(rawBody: unknown): AiReviewCredentialDto {
    const body = (rawBody ?? {}) as Record<string, unknown>;
    const action = this.normalizeString(body.action);
    const reason = this.normalizeString(body.reason);
    const label = this.normalizeString(body.label);

    if (!action || !VALID_AI_REVIEW_ACTIONS.includes(action as (typeof VALID_AI_REVIEW_ACTIONS)[number])) {
      throw new Error('INVALID_AI_REVIEW_ACTION');
    }

    return {
      action: action as AiReviewCredentialDto['action'],
      reason,
      label: label as AiReviewCredentialDto['label'],
    };
  }

  private parseInternalAiResultPayload(rawBody: unknown): InternalAiResultDto {
    const body = (rawBody ?? {}) as Record<string, unknown>;
    const decision = this.normalizeString(body.aiDecision);
    const credentialId = this.normalizeString(body.credentialId);

    if (!credentialId) {
      throw new Error('CREDENTIAL_ID_REQUIRED');
    }
    if (!decision || !VALID_AI_DECISIONS.includes(decision as (typeof VALID_AI_DECISIONS)[number])) {
      throw new Error('INVALID_AI_DECISION');
    }

    return {
      credentialId,
      aiDecision: decision as InternalAiResultDto['aiDecision'],
      aiStatus: this.normalizeString(body.aiStatus),
      aiScore: this.normalizeNumber(body.aiScore, 'INVALID_AI_SCORE'),
      aiReport: this.normalizeJson(body.aiReport, 'INVALID_AI_REPORT_JSON'),
      aiSignals: this.normalizeJson(body.aiSignals, 'INVALID_AI_SIGNALS_JSON'),
      aiModel: this.normalizeString(body.aiModel),
      aiModelVersion: this.normalizeString(body.aiModelVersion),
      aiValidatedAt: this.normalizeString(body.aiValidatedAt),
      provider: this.normalizeString(body.provider),
      raw: this.normalizeJson(body.raw, 'INVALID_AI_REPORT_JSON'),
      error: this.normalizeString(body.error),
    };
  }

  private mapError(error: unknown, res: Response): Response | null {
    if (!(error instanceof Error)) {
      return null;
    }

    const map: Record<string, { code: number; error: string }> = {
      INVALID_STATUS: { code: 400, error: 'Invalid status value.' },
      INVALID_TYPE: { code: 400, error: 'Invalid type value.' },
      TITLE_REQUIRED: { code: 400, error: 'Missing required field: title' },
      STUDENT_NOT_FOUND: { code: 404, error: 'Student not found.' },
      TARGET_NOT_STUDENT: { code: 400, error: 'Target user is not a student.' },
      CREDENTIAL_NOT_FOUND: { code: 404, error: 'Credential not found.' },
      FORBIDDEN_ROLE: { code: 403, error: 'Forbidden' },
      FORBIDDEN_SCOPE: { code: 403, error: 'Not allowed to access this credential.' },
      FORBIDDEN_ISSUER_OVERRIDE: { code: 403, error: 'Institution accounts cannot override issuedById.' },
      INSTITUTION_CONTEXT_MISSING: { code: 403, error: 'Institution context is missing for this account.' },
      FOREIGN_KEY_CONSTRAINT: { code: 400, error: 'One or more referenced records do not exist.' },
      INVALID_STATUS_TRANSITION: { code: 400, error: 'Invalid credential status transition.' },
      CREDENTIAL_REVOKED_IMMUTABLE: { code: 409, error: 'Revoked credentials are immutable and cannot be updated.' },
      INVALID_AI_VALIDATED_AT: { code: 400, error: 'Invalid aiValidatedAt value.' },
      INVALID_ANCHORED_AT: { code: 400, error: 'Invalid anchoredAt value.' },
      INVALID_ISSUED_DATE: { code: 400, error: 'Invalid issuedDate value.' },
      INVALID_EXPIRY_DATE: { code: 400, error: 'Invalid expiryDate value.' },
      EXPIRY_DATE_REQUIRED: {
        code: 400,
        error: 'expiryDate is required when issuing license or professional certificate credentials.',
      },
      INVALID_CERTIFICATE_CATEGORY: {
        code: 400,
        error: 'Invalid certificateCategory. Use ACADEMIC or PROFESSIONAL.',
      },
      INVALID_BLOCK_NUMBER: { code: 400, error: 'Invalid blockNumber value.' },
      INVALID_AI_SCORE: { code: 400, error: 'Invalid aiScore value.' },
      INVALID_METADATA_JSON: { code: 400, error: 'Invalid metadata JSON value.' },
      INVALID_AI_REPORT_JSON: { code: 400, error: 'Invalid aiReport JSON value.' },
      INVALID_AI_SIGNALS_JSON: { code: 400, error: 'Invalid aiSignals JSON value.' },
      INVALID_AI_DECISION: { code: 400, error: 'Invalid aiDecision value.' },
      INVALID_AI_REVIEW_ACTION: { code: 400, error: 'Invalid AI review action.' },
      AI_OVERRIDE_REASON_REQUIRED: { code: 400, error: 'Override reason is required for AI overrides.' },
      AI_REVIEW_REQUIRED_BEFORE_ISSUE: {
        code: 409,
        error: 'AI review must be approved or overridden before issuing this credential.',
      },
      CREDENTIAL_ID_REQUIRED: { code: 400, error: 'Missing required field: credentialId' },
      INVALID_FILE_TYPE: { code: 400, error: 'Invalid file type. Use PNG, JPEG, WEBP, or PDF.' },
      MISSING_CREDENTIAL_FILE: { code: 400, error: 'A credential file is required before issuing.' },
      DIRECT_ISSUED_CREATE_NOT_ALLOWED: {
        code: 400,
        error: 'Create credentials as pending and use the issue endpoint to issue them.',
      },
      BLOCKCHAIN_ANCHOR_FAILED: {
        code: 502,
        error: 'Failed to anchor credential to blockchain.',
      },
      BLOCKCHAIN_REVOKE_FAILED: {
        code: 502,
        error: 'Failed to revoke credential on blockchain.',
      },
      BLOCKCHAIN_INTERFACE_UNREACHABLE: {
        code: 503,
        error: 'Blockchain interface service is unreachable. Please try again in a moment.',
      },
    };

    const mapped = map[error.message];
    if (mapped) {
      return res.status(mapped.code).json({ error: mapped.error });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        return res.status(400).json({ error: 'One or more referenced records do not exist.' });
      }
      return res.status(400).json({ error: `Database request failed (${error.code}).` });
    }

    return null;
  }

  private parseListQuery(query: Request['query']): ListCredentialsQueryDto {
    const studentId = typeof query.studentId === 'string' ? query.studentId : undefined;
    const issuedById = typeof query.issuedById === 'string' ? query.issuedById : undefined;
    const status = typeof query.status === 'string' ? query.status : undefined;
    const type = typeof query.type === 'string' ? query.type : undefined;
    const page = typeof query.page === 'string' ? Number(query.page) : undefined;
    const pageSize = typeof query.pageSize === 'string' ? Number(query.pageSize) : undefined;
    const scope = query.scope === 'mine' ? 'mine' : undefined;

    if (status && !VALID_CREDENTIAL_STATUSES.includes(status as (typeof VALID_CREDENTIAL_STATUSES)[number])) {
      throw new Error('INVALID_STATUS');
    }
    if (type && !VALID_CREDENTIAL_TYPES.includes(type as (typeof VALID_CREDENTIAL_TYPES)[number])) {
      throw new Error('INVALID_TYPE');
    }

    return {
      studentId,
      issuedById,
      status: status as ListCredentialsQueryDto['status'],
      type: type as ListCredentialsQueryDto['type'],
      page,
      pageSize,
      scope,
    };
  }

  async listCredentials(req: Request, res: Response): Promise<Response> {
    const actor = this.getActor(req);
    if (!actor.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const query = this.parseListQuery(req.query);
      const credentials = await credentialService.listCredentials(
        {
          userId: actor.userId,
          role: actor.role,
          institutionId: actor.institutionId,
          employerId: actor.employerId,
        },
        query,
      );
      return res.status(200).json(credentials);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error listing credentials:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async createCredential(req: Request, res: Response): Promise<Response> {
    const actor = this.getActor(req);
    if (!actor.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = {
      ...this.parseCreatePayload(req.body),
      ...this.extractUploadFields(req),
    } as Partial<CreateCredentialDto>;

    if (!payload.studentId || typeof payload.studentId !== 'string') {
      return res.status(400).json({ error: 'Missing required field: studentId' });
    }
    if (!payload.title || typeof payload.title !== 'string' || payload.title.trim().length === 0) {
      return res.status(400).json({ error: 'Missing required field: title' });
    }
    if (!payload.type || !VALID_CREDENTIAL_TYPES.includes(payload.type)) {
      return res.status(400).json({ error: 'Missing required field: type' });
    }
    if (payload.status && !VALID_CREDENTIAL_STATUSES.includes(payload.status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }
    if (typeof payload.blockNumber !== 'undefined' && !Number.isInteger(payload.blockNumber)) {
      return res.status(400).json({ error: 'Invalid blockNumber value.' });
    }
    if (typeof payload.aiScore !== 'undefined' && typeof payload.aiScore !== 'number') {
      return res.status(400).json({ error: 'Invalid aiScore value.' });
    }

    try {
      const created = await credentialService.createCredential(
        {
          userId: actor.userId,
          role: actor.role,
          institutionId: actor.institutionId,
          employerId: actor.employerId,
        },
        payload as CreateCredentialDto,
      );
      return res.status(201).json(created);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error creating credential:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async getCredentialById(req: Request, res: Response): Promise<Response> {
    const actor = this.getActor(req);
    if (!actor.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const credentialId: string = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const credential = await credentialService.getCredentialById(
        {
          userId: actor.userId,
          role: actor.role,
          institutionId: actor.institutionId,
          employerId: actor.employerId,
        },
        credentialId,
      );
      if (!credential) {
        return res.status(404).json({ error: 'Credential not found' });
      }
      return res.status(200).json(credential);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error fetching credential:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async updateCredentialStatus(req: Request, res: Response): Promise<Response> {
    const actor = this.getActor(req);
    if (!actor.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const credentialId: string = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const payload = this.parseUpdateStatusPayload(req.body);

    if (!payload?.status || !VALID_CREDENTIAL_STATUSES.includes(payload.status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }
    if (typeof payload.blockNumber !== 'undefined' && !Number.isInteger(payload.blockNumber)) {
      return res.status(400).json({ error: 'Invalid blockNumber value.' });
    }
    if (typeof payload.aiScore !== 'undefined' && typeof payload.aiScore !== 'number') {
      return res.status(400).json({ error: 'Invalid aiScore value.' });
    }

    try {
      const updated = await credentialService.updateCredentialStatus(
        {
          userId: actor.userId,
          role: actor.role,
          institutionId: actor.institutionId,
          employerId: actor.employerId,
        },
        credentialId,
        payload as UpdateCredentialStatusDto,
      );
      return res.status(200).json(updated);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error updating credential status:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async listAiQueue(req: Request, res: Response): Promise<Response> {
    const actor = this.getActor(req);
    if (!actor.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const query = this.parseAiQueueQuery(req.query);
      const queue = await credentialService.listAiQueue(
        {
          userId: actor.userId,
          role: actor.role,
          institutionId: actor.institutionId,
          employerId: actor.employerId,
        },
        query,
      );
      return res.status(200).json(queue);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error listing AI queue:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async getCredentialAiReport(req: Request, res: Response): Promise<Response> {
    const actor = this.getActor(req);
    if (!actor.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const credentialId: string = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const report = await credentialService.getCredentialAiReport(
        {
          userId: actor.userId,
          role: actor.role,
          institutionId: actor.institutionId,
          employerId: actor.employerId,
        },
        credentialId,
      );
      if (!report) {
        return res.status(404).json({ error: 'Credential not found' });
      }
      return res.status(200).json(report);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error fetching AI report:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async reviewCredentialAi(req: Request, res: Response): Promise<Response> {
    const actor = this.getActor(req);
    if (!actor.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const credentialId: string = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const payload = this.parseAiReviewPayload(req.body);
      const updated = await credentialService.reviewCredentialAi(
        {
          userId: actor.userId,
          role: actor.role,
          institutionId: actor.institutionId,
          employerId: actor.employerId,
        },
        credentialId,
        payload,
      );
      return res.status(200).json(updated);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error reviewing AI decision:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async queueCredentialAiReanalyze(req: Request, res: Response): Promise<Response> {
    const actor = this.getActor(req);
    if (!actor.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const credentialId: string = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const updated = await credentialService.queueCredentialAiReanalyze(
        {
          userId: actor.userId,
          role: actor.role,
          institutionId: actor.institutionId,
          employerId: actor.employerId,
        },
        credentialId,
      );
      return res.status(200).json(updated);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error queueing AI reanalysis:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async applyInternalAiResult(req: Request, res: Response): Promise<Response> {
    try {
      const payload = this.parseInternalAiResultPayload(req.body);
      const updated = await credentialService.applyInternalAiResult(payload);
      return res.status(200).json(updated);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error applying internal AI result:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async getInternalCredentialDocument(req: Request, res: Response): Promise<Response> {
    const credentialId: string = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const credential = await credentialService.getCredentialDocumentContext(credentialId);
      if (!credential) {
        return res.status(404).json({ error: 'Credential not found.' });
      }
      if (!credential.storageKey) {
        return res.status(400).json({ error: 'Credential file is not available.' });
      }

      const relativeStorage = credential.storageKey.replace(/^\/credentials\/uploads\//, '');
      const absolutePath = path.resolve(CREDENTIAL_UPLOADS_DIR, relativeStorage);
      if (!existsSync(absolutePath)) {
        return res.status(404).json({ error: 'Credential file is missing on storage.' });
      }

      const fileBuffer = readFileSync(absolutePath);
      return res.status(200).json({
        credentialId: credential.id,
        studentId: credential.studentId,
        institutionId: credential.student.institutionId,
        title: credential.title,
        filename: credential.filename,
        mimeType: credential.mimeType,
        fileHash: credential.fileHash,
        storageKey: credential.storageKey,
        fileBase64: fileBuffer.toString('base64'),
      });
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error fetching internal credential document:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async issueCredential(req: Request, res: Response): Promise<Response> {
    const actor = this.getActor(req);
    if (!actor.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const credentialId: string = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const actorContext = {
      userId: actor.userId,
      role: actor.role,
      institutionId: actor.institutionId,
      employerId: actor.employerId,
    };

    const payload = {
      ...this.parseIssuePayload(req.body),
      ...this.extractUploadFields(req),
    } as IssueCredentialDto;

    if (typeof payload.blockNumber !== 'undefined' && !Number.isInteger(payload.blockNumber)) {
      return res.status(400).json({ error: 'Invalid blockNumber value.' });
    }
    if (typeof payload.aiScore !== 'undefined' && typeof payload.aiScore !== 'number') {
      return res.status(400).json({ error: 'Invalid aiScore value.' });
    }

    try {
      if (!payload.storageKey || !payload.filename || !payload.mimeType || !payload.fileHash) {
        const existing = await credentialService.getCredentialById(actorContext, credentialId);
        if (!existing) {
          return res.status(404).json({ error: 'Credential not found' });
        }
        const hasExistingFile =
          Boolean(existing.storageKey) &&
          Boolean(existing.filename) &&
          Boolean(existing.mimeType) &&
          Boolean(existing.fileHash);
        if (!hasExistingFile) {
          throw new Error('MISSING_CREDENTIAL_FILE');
        }
      }

      const issued = await credentialService.issueCredential(actorContext, credentialId, payload);
      return res.status(200).json(issued);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error issuing credential:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

