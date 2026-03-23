import { existsSync } from 'node:fs';
import path from 'node:path';
import { Request, Response } from 'express';
import { Prisma } from '../../../../db/node_modules/@prisma/client';
import { CredentialService } from '../service/credential.service';
import {
  ConsumeQrTokenDto,
  CreateCredentialDto,
  GeneratedQrTokenResponseDto,
  IssueCredentialDto,
  ListCredentialsQueryDto,
  ConsumeQrTokenResponseDto,
  UpdateCredentialStatusDto,
} from '../dto/credential.dto';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { CREDENTIAL_UPLOADS_DIR } from '../config/uploads';
import {
  createEncryptedStorageName,
  decryptFileToBuffer,
  encryptBufferToFile,
  sha256Hex,
} from '../service/secure-file.service';

const credentialService = new CredentialService();

const VALID_CREDENTIAL_STATUSES = ['PENDING', 'ISSUED', 'REVOKED', 'EXPIRED'] as const;
const VALID_CREDENTIAL_TYPES = ['TRANSCRIPT', 'DIPLOMA', 'CERTIFICATE', 'DEGREE', 'LICENSE'] as const;

type RequestWithFile = Request & { file?: Express.Multer.File };

export class CredentialController {
  private getActor(req: Request) {
    const auth = (req as AuthenticatedRequest).auth;
    return {
      userId: auth?.sub ?? null,
      role: auth?.role,
      institutionId: auth?.institutionId,
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

    if (!uploaded.buffer || uploaded.buffer.length === 0) {
      throw new Error('EMPTY_CREDENTIAL_FILE');
    }

    const encryptedStorageName = createEncryptedStorageName(uploaded.originalname);
    const outputPath = path.resolve(CREDENTIAL_UPLOADS_DIR, encryptedStorageName);
    encryptBufferToFile(uploaded.buffer, outputPath);

    const fileHash = sha256Hex(uploaded.buffer);

    return {
      filename: uploaded.originalname,
      mimeType: uploaded.mimetype,
      storageKey: `/credentials/uploads/${encryptedStorageName}`,
      fileHash,
    };
  }

  private resolveStoragePathOrThrow(storageKey: string): string {
    const relativeStorage = storageKey.replace(/^\/credentials\/uploads\//, '');
    const absolutePath = path.resolve(CREDENTIAL_UPLOADS_DIR, relativeStorage);
    const normalizedRoot = `${path.resolve(CREDENTIAL_UPLOADS_DIR)}${path.sep}`;
    if (!(`${absolutePath}${path.sep}`).startsWith(normalizedRoot)) {
      throw new Error('CREDENTIAL_FILE_INVALID');
    }
    return absolutePath;
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
    if ('chain' in body) payload.chain = this.normalizeString(body.chain);
    if ('txHash' in body) payload.txHash = this.normalizeString(body.txHash);
    if ('blockNumber' in body) payload.blockNumber = this.normalizeNumber(body.blockNumber, 'INVALID_BLOCK_NUMBER');
    if ('anchoredAt' in body) payload.anchoredAt = this.normalizeString(body.anchoredAt);
    if ('issuedDate' in body) payload.issuedDate = this.normalizeString(body.issuedDate);
    if ('expiryDate' in body) payload.expiryDate = this.normalizeString(body.expiryDate);

    return payload;
  }

  private parseConsumeQrTokenPayload(rawBody: unknown): ConsumeQrTokenDto {
    const body = (rawBody ?? {}) as Record<string, unknown>;
    const token = this.normalizeString(body.token);
    if (!token) {
      throw new Error('QR_TOKEN_MALFORMED');
    }
    return { token };
  }

  private parseGenerateQrOptionsPayload(rawBody: unknown): {
    allowDocumentPreview?: boolean;
    allowDocumentDownload?: boolean;
  } {
    const body = (rawBody ?? {}) as Record<string, unknown>;
    const asBoolean = (value: unknown): boolean | undefined => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
      }
      if (typeof value === 'undefined') return undefined;
      throw new Error('INVALID_QR_OPTIONS');
    };

    const allowDocumentPreview = asBoolean(body.allowDocumentPreview);
    const allowDocumentDownload = asBoolean(body.allowDocumentDownload);
    return {
      allowDocumentPreview,
      allowDocumentDownload,
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
      STATUS_UNCHANGED: { code: 409, error: 'Credential is already in the selected status.' },
      EXPIRED_STATUS_SYSTEM_MANAGED: {
        code: 400,
        error: 'EXPIRED status is system-managed and cannot be set manually.',
      },
      CREDENTIAL_REVOKED_IMMUTABLE: { code: 409, error: 'Revoked credentials are immutable and cannot be updated.' },
      CREDENTIAL_EXPIRED_IMMUTABLE: { code: 409, error: 'Expired credentials are locked. Use Re-issue to renew.' },
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
      INVALID_METADATA_JSON: { code: 400, error: 'Invalid metadata JSON value.' },
      INVALID_FILE_TYPE: { code: 400, error: 'Invalid file type. Use PNG, JPEG, WEBP, or PDF.' },
      EMPTY_CREDENTIAL_FILE: { code: 400, error: 'Uploaded credential file is empty.' },
      FILE_ENCRYPTION_KEY_MISSING: {
        code: 500,
        error: 'Credential file encryption key is not configured.',
      },
      FILE_ENCRYPTION_KEY_INVALID: {
        code: 500,
        error: 'Credential file encryption key format is invalid.',
      },
      CREDENTIAL_FILE_INVALID: { code: 500, error: 'Credential file payload is invalid.' },
        CREDENTIAL_FILE_TAMPERED: {
          code: 409,
          error: 'Credential file integrity check failed.',
        },
        CREDENTIAL_FILE_DUPLICATE: {
          code: 409,
          error: 'This document has already been used for another credential in your institution. Use the existing credential instead of uploading it again.',
        },
        MISSING_CREDENTIAL_FILE: { code: 400, error: 'A credential file is required before issuing.' },
        DIRECT_ISSUED_CREATE_NOT_ALLOWED: {
          code: 400,
        error: 'Create credentials as pending and use the issue endpoint to issue them.',
      },
      CREDENTIAL_NOT_ISSUED: {
        code: 409,
        error: 'Only issued credentials can be shared via one-time QR.',
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
      QR_TOKEN_INVALID: {
        code: 400,
        error: 'QR token is invalid.',
      },
      QR_TOKEN_EXPIRED: {
        code: 410,
        error: 'QR token has expired.',
      },
      QR_TOKEN_USED: {
        code: 409,
        error: 'QR token was already used.',
      },
      QR_TOKEN_MALFORMED: {
        code: 400,
        error: 'QR token payload is malformed.',
      },
      QR_TOKEN_PEPPER_MISSING: {
        code: 500,
        error: 'QR token secret is not configured.',
      },
      INVALID_QR_OPTIONS: {
        code: 400,
        error: 'Invalid QR share options.',
      },
      QR_DOCUMENT_ACCESS_NOT_ALLOWED: {
        code: 403,
        error: 'Document access is not allowed for this token.',
      },
      STEP_UP_REQUIRED: {
        code: 403,
        error: 'STEP_UP_REQUIRED',
      },
      STEP_UP_TOKEN_INVALID: {
        code: 403,
        error: 'STEP_UP_TOKEN_INVALID',
      },
      STEP_UP_TOKEN_EXPIRED: {
        code: 403,
        error: 'STEP_UP_TOKEN_EXPIRED',
      },
      INTERNAL_AUTH_MISCONFIGURED: {
        code: 500,
        error: 'INTERNAL_AUTH_MISCONFIGURED',
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

    try {
      const created = await credentialService.createCredential(
        {
          userId: actor.userId,
          role: actor.role,
          institutionId: actor.institutionId,
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

    try {
      const updated = await credentialService.updateCredentialStatus(
        {
          userId: actor.userId,
          role: actor.role,
          institutionId: actor.institutionId,
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

      const absolutePath = this.resolveStoragePathOrThrow(credential.storageKey);
      if (!existsSync(absolutePath)) {
        return res.status(404).json({ error: 'Credential file is missing on storage.' });
      }

      const fileBuffer = decryptFileToBuffer(absolutePath);
      const computedHash = sha256Hex(fileBuffer);
      if (credential.fileHash && credential.fileHash !== computedHash) {
        throw new Error('CREDENTIAL_FILE_TAMPERED');
      }
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

  async getCredentialDocument(req: Request, res: Response): Promise<Response> {
    const actor = this.getActor(req);
    if (!actor.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const credentialId: string = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const actorContext = {
      userId: actor.userId,
      role: actor.role,
      institutionId: actor.institutionId,
    };

    try {
      const credential = await credentialService.getCredentialById(actorContext, credentialId);
      if (!credential) {
        await credentialService.auditCredentialDocumentAccess({
          actorId: actor.userId,
          actorRole: actor.role,
          institutionId: actor.institutionId,
          ipAddress: req.ip || req.socket.remoteAddress || null,
          credentialId,
          outcome: 'DENIED',
          reason: 'CREDENTIAL_NOT_FOUND',
        });
        return res.status(404).json({ error: 'Credential not found' });
      }
      if (!credential.storageKey) {
        return res.status(400).json({ error: 'Credential file is not available.' });
      }

      const absolutePath = this.resolveStoragePathOrThrow(credential.storageKey);
      if (!existsSync(absolutePath)) {
        return res.status(404).json({ error: 'Credential file is missing on storage.' });
      }

      const fileBuffer = decryptFileToBuffer(absolutePath);
      const computedHash = sha256Hex(fileBuffer);
      if (credential.fileHash && credential.fileHash !== computedHash) {
        throw new Error('CREDENTIAL_FILE_TAMPERED');
      }

      await credentialService.auditCredentialDocumentAccess({
        actorId: actor.userId,
        actorRole: actor.role,
        institutionId: actor.institutionId,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        credentialId,
        outcome: 'GRANTED',
      });

      if (credential.mimeType) {
        res.setHeader('Content-Type', credential.mimeType);
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
      const safeFileName = (credential.filename || 'credential')
        .replace(/[\r\n"]/g, '')
        .trim();
      res.setHeader('Content-Disposition', `inline; filename="${safeFileName || 'credential'}"`);
      return res.status(200).send(fileBuffer);
    } catch (error) {
      if (error instanceof Error && error.message === 'FORBIDDEN_SCOPE') {
        await credentialService.auditCredentialDocumentAccess({
          actorId: actor.userId,
          actorRole: actor.role,
          institutionId: actor.institutionId,
          ipAddress: req.ip || req.socket.remoteAddress || null,
          credentialId,
          outcome: 'DENIED',
          reason: 'FORBIDDEN_SCOPE',
        });
      }

      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error fetching credential document:', error);
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
    };

    const payload = {
      ...this.parseIssuePayload(req.body),
      ...this.extractUploadFields(req),
    } as IssueCredentialDto;

    if (typeof payload.blockNumber !== 'undefined' && !Number.isInteger(payload.blockNumber)) {
      return res.status(400).json({ error: 'Invalid blockNumber value.' });
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

  async generateCredentialQrToken(req: Request, res: Response): Promise<Response> {
    const actor = this.getActor(req);
    if (!actor.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const credentialId: string = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const options = this.parseGenerateQrOptionsPayload(req.body);
      const generated: GeneratedQrTokenResponseDto = await credentialService.generateStudentQrTokenWithOptions(
        {
          userId: actor.userId,
          role: actor.role,
          institutionId: actor.institutionId,
        },
        credentialId,
        options,
      );

      return res.status(200).json(generated);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error generating one-time credential QR token:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async verifyCredentialQrPublic(req: Request, res: Response): Promise<Response> {
    try {
      const payload = this.parseConsumeQrTokenPayload(req.body);
      const result: ConsumeQrTokenResponseDto = await credentialService.consumeQrToken(payload.token, {
        consumerType: 'PUBLIC',
        ipAddress: req.ip || req.socket.remoteAddress || null,
      });
      return res.status(200).json(result);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error verifying public one-time credential QR token:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async getCredentialDocumentByQrToken(req: Request, res: Response): Promise<Response> {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    const mode = req.query.download === '1' ? 'download' : 'preview';

    try {
      const consumed = await credentialService.consumeQrDocumentToken(
        token,
        mode,
        req.ip || req.socket.remoteAddress || null,
      );
      const credential = await credentialService.getCredentialDocumentContext(consumed.credentialId);
      if (!credential) {
        return res.status(404).json({ error: 'Credential not found.' });
      }
      if (!credential.storageKey) {
        return res.status(400).json({ error: 'Credential file is not available.' });
      }

      const absolutePath = this.resolveStoragePathOrThrow(credential.storageKey);
      if (!existsSync(absolutePath)) {
        return res.status(404).json({ error: 'Credential file is missing on storage.' });
      }

      const fileBuffer = decryptFileToBuffer(absolutePath);
      const computedHash = sha256Hex(fileBuffer);
      if (credential.fileHash && credential.fileHash !== computedHash) {
        throw new Error('CREDENTIAL_FILE_TAMPERED');
      }

      if (credential.mimeType) {
        res.setHeader('Content-Type', credential.mimeType);
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
      const safeFileName = (credential.filename || 'credential').replace(/[\r\n"]/g, '').trim();
      const disposition = mode === 'download' ? 'attachment' : 'inline';
      res.setHeader('Content-Disposition', `${disposition}; filename="${safeFileName || 'credential'}"`);
      return res.status(200).send(fileBuffer);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error fetching credential document by one-time QR token:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
