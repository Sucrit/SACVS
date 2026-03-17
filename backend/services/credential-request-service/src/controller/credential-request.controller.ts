import { Request, Response } from 'express';
import { Prisma } from '../../../../db/node_modules/@prisma/client';
import {
  CreateCredentialRequestDto,
  ListCredentialRequestsQueryDto,
  UpdateCredentialRequestStatusDto,
} from '../dto/credential-request.dto';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { CredentialRequestService } from '../service/credential-request.service';

const credentialRequestService = new CredentialRequestService();

const VALID_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED'] as const;
const VALID_UPDATE_STATUSES = ['APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED'] as const;
const VALID_CREDENTIAL_TYPES = ['TRANSCRIPT', 'DIPLOMA', 'CERTIFICATE', 'DEGREE', 'LICENSE'] as const;
const VALID_DELIVERY_METHODS = ['DIGITAL', 'PHYSICAL', 'BOTH'] as const;

export class CredentialRequestController {
  private getAuthUserId(req: Request): string | null {
    return (req as AuthenticatedRequest).auth?.sub ?? null;
  }

  private mapError(
    error: unknown,
    res: Response,
    overrides: Record<string, { code: number; error: string }> = {},
  ): Response | null {
    if (!(error instanceof Error)) {
      return null;
    }

    const baseMap: Record<string, { code: number; error: string }> = {
      INVALID_STATUS: { code: 400, error: 'Invalid status query value.' },
      INVALID_REQUEST_PAYLOAD: { code: 400, error: 'Invalid request payload.' },
      ACTOR_NOT_FOUND: { code: 404, error: 'Authenticated user record was not found.' },
      INSTITUTION_CONTEXT_MISSING: {
        code: 403,
        error: 'Institution context is missing for this account.',
      },
      REQUEST_NOT_FOUND: { code: 404, error: 'Credential request not found.' },
      REQUEST_NOT_APPROVED: {
        code: 400,
        error: 'Receipt is available only for approved requests.',
      },
      RECEIPT_NOT_REQUIRED: {
        code: 400,
        error: 'Receipt is not required for DIGITAL delivery.',
      },
      REQUEST_RECEIPT_TOKEN_PEPPER_MISSING: {
        code: 500,
        error: 'REQUEST_RECEIPT_TOKEN_PEPPER_MISSING',
      },
      REQUEST_RECEIPT_VERIFY_BASE_URL_MISSING: {
        code: 500,
        error: 'REQUEST_RECEIPT_VERIFY_BASE_URL_MISSING',
      },
      FOREIGN_KEY_CONSTRAINT: {
        code: 400,
        error: 'One or more referenced records do not exist.',
      },
      DATABASE_SCHEMA_MISMATCH: {
        code: 500,
        error: 'Database schema is out of sync with the service.',
      },
      RELATED_RECORD_NOT_FOUND: {
        code: 400,
        error: 'One or more related records were not found.',
      },
    };

    const mapped = { ...baseMap, ...overrides }[error.message];
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

  private parseListQuery(query: Request['query']): ListCredentialRequestsQueryDto {
    const status = typeof query.status === 'string' ? query.status : undefined;
    const studentId = typeof query.studentId === 'string' ? query.studentId : undefined;
    const page = typeof query.page === 'string' ? Number(query.page) : undefined;
    const pageSize = typeof query.pageSize === 'string' ? Number(query.pageSize) : undefined;

    if (status && !VALID_REQUEST_STATUSES.includes(status as (typeof VALID_REQUEST_STATUSES)[number])) {
      throw new Error('INVALID_STATUS');
    }

    return {
      status: status as ListCredentialRequestsQueryDto['status'],
      studentId,
      page,
      pageSize,
    };
  }

  async listCredentialRequests(req: Request, res: Response): Promise<Response> {
    const userId = this.getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const query = this.parseListQuery(req.query);
      const requests = await credentialRequestService.listCredentialRequests(userId, query);
      return res.status(200).json(requests);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error listing credential requests:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async createCredentialRequest(req: Request, res: Response): Promise<Response> {
    const userId = this.getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = req.body as Partial<CreateCredentialRequestDto>;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid request payload.' });
    }
    if (!payload.title || typeof payload.title !== 'string' || payload.title.trim().length === 0) {
      return res.status(400).json({ error: 'Missing required field: title' });
    }
    if (!payload.type || !VALID_CREDENTIAL_TYPES.includes(payload.type)) {
      return res.status(400).json({ error: 'Missing required field: type' });
    }
    if (
      payload.deliveryMethod &&
      !VALID_DELIVERY_METHODS.includes(payload.deliveryMethod)
    ) {
      return res.status(400).json({ error: 'Invalid deliveryMethod value.' });
    }

    try {
      const created = await credentialRequestService.createCredentialRequest(userId, payload as CreateCredentialRequestDto);
      return res.status(201).json(created);
    } catch (error) {
      const mapped = this.mapError(error, res, {
        FORBIDDEN_ROLE: { code: 403, error: 'This role cannot create credential requests.' },
        TITLE_REQUIRED: { code: 400, error: 'Missing required field: title' },
        STUDENT_ID_REQUIRED: { code: 400, error: 'Missing required field: studentId' },
      });
      if (mapped) return mapped;

      console.error('Error creating credential request:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async getCredentialRequestById(req: Request, res: Response): Promise<Response> {
    const userId = this.getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const requestId: string = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const request = await credentialRequestService.getCredentialRequestById(userId, requestId);
      if (!request) {
        return res.status(404).json({ error: 'Credential request not found' });
      }
      return res.status(200).json(request);
    } catch (error) {
      const mapped = this.mapError(error, res, {
        FORBIDDEN_SCOPE: { code: 403, error: 'Not allowed to access this credential request.' },
      });
      if (mapped) return mapped;

      console.error('Error fetching credential request:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async updateCredentialRequestStatus(req: Request, res: Response): Promise<Response> {
    const userId = this.getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const requestId: string = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const payload = req.body as Partial<UpdateCredentialRequestStatusDto>;
    if (!payload?.status || !VALID_UPDATE_STATUSES.includes(payload.status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, 'credentialId') &&
      payload.credentialId !== undefined &&
      payload.credentialId !== null &&
      typeof payload.credentialId !== 'string'
    ) {
      return res.status(400).json({ error: 'Invalid credentialId value.' });
    }

    try {
      const updated = await credentialRequestService.updateCredentialRequestStatus(
        userId,
        requestId,
        payload as UpdateCredentialRequestStatusDto,
      );
      return res.status(200).json(updated);
    } catch (error) {
      const mapped = this.mapError(error, res, {
        FORBIDDEN_ROLE: {
          code: 403,
          error: 'This account is not allowed to update request status.',
        },
        FORBIDDEN_STATUS_FOR_ROLE: {
          code: 403,
          error: 'Student accounts can only cancel requests.',
        },
        CANNOT_CANCEL_NON_PENDING: {
          code: 400,
          error: 'Only pending requests can be cancelled.',
        },
        FORBIDDEN_SCOPE: {
          code: 403,
          error: 'Not allowed to modify this credential request.',
        },
        REJECTION_REASON_REQUIRED: {
          code: 400,
          error: 'Rejection reason is required for rejected requests.',
        },
        CREDENTIAL_ID_REQUIRED_FOR_COMPLETION: {
          code: 400,
          error: 'A credential must be linked before completing this request.',
        },
        INVALID_STATUS_TRANSITION: { code: 400, error: 'Invalid status transition.' },
      });
      if (mapped) return mapped;

      console.error('Error updating credential request status:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async getApprovalReceipt(req: Request, res: Response): Promise<Response> {
    const userId = this.getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const requestId: string = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const receipt = await credentialRequestService.getApprovalReceipt(userId, requestId);
      return res.status(200).json(receipt);
    } catch (error) {
      const mapped = this.mapError(error, res, {
        FORBIDDEN_SCOPE: {
          code: 403,
          error: 'Not allowed to access this approval receipt.',
        },
        FORBIDDEN_ROLE: {
          code: 403,
          error: 'This account is not allowed to access approval receipts.',
        },
      });
      if (mapped) return mapped;

      console.error('Error fetching request approval receipt:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async verifyApprovalReceipt(req: Request, res: Response): Promise<Response> {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    if (!token.trim()) {
      return res.status(400).json({ error: 'Missing token.' });
    }

    try {
      const result = await credentialRequestService.verifyApprovalReceiptToken(token);
      return res.status(200).json(result);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error verifying request approval receipt:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async lookupReceiptByCode(req: Request, res: Response): Promise<Response> {
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    if (!code.trim()) {
      return res.status(400).json({ error: 'Missing receipt code.' });
    }

    try {
      const result = await credentialRequestService.lookupReceiptByCode(code);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error looking up receipt by code:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async markPhysicalClaimed(req: Request, res: Response): Promise<Response> {
    const userId = this.getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const requestId: string = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;

    try {
      const updated = await credentialRequestService.markPhysicalClaimed(userId, requestId, notes);
      return res.status(200).json(updated);
    } catch (error) {
      const mapped = this.mapError(error, res, {
        FORBIDDEN_ROLE: {
          code: 403,
          error: 'This account is not allowed to mark physical claims.',
        },
        FORBIDDEN_SCOPE: {
          code: 403,
          error: 'Not allowed to modify this credential request.',
        },
        PHYSICAL_CLAIM_NOT_APPLICABLE: {
          code: 400,
          error: 'Physical claim action applies only to PHYSICAL or BOTH delivery requests.',
        },
        REQUEST_NOT_APPROVED: {
          code: 400,
          error: 'Only approved requests can be marked as physically claimed.',
        },
        DIGITAL_ISSUANCE_REQUIRED_BEFORE_PHYSICAL_CLAIM: {
          code: 400,
          error: 'For BOTH delivery, issue/link the digital credential before marking physical claim.',
        },
      });
      if (mapped) return mapped;

      console.error('Error marking physical claim:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
