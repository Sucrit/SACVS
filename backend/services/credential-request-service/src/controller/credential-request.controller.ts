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
      if (error instanceof Error && error.message === 'INVALID_STATUS') {
        return res.status(400).json({ error: 'Invalid status query value.' });
      }
      if (error instanceof Error && error.message === 'ACTOR_NOT_FOUND') {
        return res.status(404).json({ error: 'Authenticated user record was not found.' });
      }
      if (error instanceof Error && error.message === 'INSTITUTION_CONTEXT_MISSING') {
        return res.status(403).json({ error: 'Institution context is missing for this account.' });
      }

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
      if (error instanceof Error && error.message === 'ACTOR_NOT_FOUND') {
        return res.status(404).json({ error: 'Authenticated user record was not found.' });
      }
      if (error instanceof Error && error.message === 'FORBIDDEN_ROLE') {
        return res.status(403).json({ error: 'This role cannot create credential requests.' });
      }
      if (error instanceof Error && error.message === 'TITLE_REQUIRED') {
        return res.status(400).json({ error: 'Missing required field: title' });
      }
      if (error instanceof Error && error.message === 'STUDENT_ID_REQUIRED') {
        return res.status(400).json({ error: 'Missing required field: studentId' });
      }
      if (error instanceof Error && error.message === 'INSTITUTION_CONTEXT_MISSING') {
        return res.status(403).json({ error: 'Institution context is missing for this account.' });
      }
      if (error instanceof Error && error.message === 'FOREIGN_KEY_CONSTRAINT') {
        return res.status(400).json({ error: 'One or more referenced records do not exist.' });
      }
      if (error instanceof Error && error.message === 'DATABASE_SCHEMA_MISMATCH') {
        return res.status(500).json({ error: 'Database schema is out of sync with the service.' });
      }
      if (error instanceof Error && error.message === 'RELATED_RECORD_NOT_FOUND') {
        return res.status(400).json({ error: 'One or more related records were not found.' });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return res.status(400).json({ error: `Database request failed (${error.code}).` });
      }

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
      if (error instanceof Error && error.message === 'ACTOR_NOT_FOUND') {
        return res.status(404).json({ error: 'Authenticated user record was not found.' });
      }
      if (error instanceof Error && error.message === 'FORBIDDEN_SCOPE') {
        return res.status(403).json({ error: 'Not allowed to access this credential request.' });
      }

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
      if (error instanceof Error && error.message === 'ACTOR_NOT_FOUND') {
        return res.status(404).json({ error: 'Authenticated user record was not found.' });
      }
      if (error instanceof Error && error.message === 'FORBIDDEN_ROLE') {
        return res.status(403).json({ error: 'This account is not allowed to update request status.' });
      }
      if (error instanceof Error && error.message === 'FORBIDDEN_STATUS_FOR_ROLE') {
        return res.status(403).json({ error: 'Student accounts can only cancel requests.' });
      }
      if (error instanceof Error && error.message === 'CANNOT_CANCEL_NON_PENDING') {
        return res.status(400).json({ error: 'Only pending requests can be cancelled.' });
      }
      if (error instanceof Error && error.message === 'INSTITUTION_CONTEXT_MISSING') {
        return res.status(403).json({ error: 'Institution context is missing for this account.' });
      }
      if (error instanceof Error && error.message === 'FORBIDDEN_SCOPE') {
        return res.status(403).json({ error: 'Not allowed to modify this credential request.' });
      }
      if (error instanceof Error && error.message === 'REQUEST_NOT_FOUND') {
        return res.status(404).json({ error: 'Credential request not found.' });
      }
      if (error instanceof Error && error.message === 'REJECTION_REASON_REQUIRED') {
        return res.status(400).json({ error: 'Rejection reason is required for rejected requests.' });
      }
      if (error instanceof Error && error.message === 'CREDENTIAL_ID_REQUIRED_FOR_COMPLETION') {
        return res.status(400).json({ error: 'A credential must be linked before completing this request.' });
      }
      if (error instanceof Error && error.message === 'INVALID_STATUS_TRANSITION') {
        return res.status(400).json({ error: 'Invalid status transition.' });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        return res.status(400).json({ error: 'One or more referenced records do not exist.' });
      }

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
      if (error instanceof Error && error.message === 'ACTOR_NOT_FOUND') {
        return res.status(404).json({ error: 'Authenticated user record was not found.' });
      }
      if (error instanceof Error && error.message === 'REQUEST_NOT_FOUND') {
        return res.status(404).json({ error: 'Credential request not found.' });
      }
      if (error instanceof Error && error.message === 'REQUEST_NOT_APPROVED') {
        return res.status(400).json({ error: 'Receipt is available only for approved requests.' });
      }
      if (error instanceof Error && error.message === 'RECEIPT_NOT_REQUIRED') {
        return res.status(400).json({ error: 'Receipt is not required for DIGITAL delivery.' });
      }
      if (error instanceof Error && error.message === 'FORBIDDEN_SCOPE') {
        return res.status(403).json({ error: 'Not allowed to access this approval receipt.' });
      }
      if (error instanceof Error && error.message === 'FORBIDDEN_ROLE') {
        return res.status(403).json({ error: 'This account is not allowed to access approval receipts.' });
      }
      if (error instanceof Error && error.message === 'INSTITUTION_CONTEXT_MISSING') {
        return res.status(403).json({ error: 'Institution context is missing for this account.' });
      }
      if (error instanceof Error && error.message === 'REQUEST_RECEIPT_TOKEN_PEPPER_MISSING') {
        return res.status(500).json({ error: 'REQUEST_RECEIPT_TOKEN_PEPPER_MISSING' });
      }
      if (error instanceof Error && error.message === 'REQUEST_RECEIPT_VERIFY_BASE_URL_MISSING') {
        return res.status(500).json({ error: 'REQUEST_RECEIPT_VERIFY_BASE_URL_MISSING' });
      }

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
      if (error instanceof Error && error.message === 'REQUEST_RECEIPT_TOKEN_PEPPER_MISSING') {
        return res.status(500).json({ error: 'REQUEST_RECEIPT_TOKEN_PEPPER_MISSING' });
      }

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
      if (error instanceof Error && error.message === 'ACTOR_NOT_FOUND') {
        return res.status(404).json({ error: 'Authenticated user record was not found.' });
      }
      if (error instanceof Error && error.message === 'REQUEST_NOT_FOUND') {
        return res.status(404).json({ error: 'Credential request not found.' });
      }
      if (error instanceof Error && error.message === 'FORBIDDEN_ROLE') {
        return res.status(403).json({ error: 'This account is not allowed to mark physical claims.' });
      }
      if (error instanceof Error && error.message === 'FORBIDDEN_SCOPE') {
        return res.status(403).json({ error: 'Not allowed to modify this credential request.' });
      }
      if (error instanceof Error && error.message === 'INSTITUTION_CONTEXT_MISSING') {
        return res.status(403).json({ error: 'Institution context is missing for this account.' });
      }
      if (error instanceof Error && error.message === 'PHYSICAL_CLAIM_NOT_APPLICABLE') {
        return res.status(400).json({
          error: 'Physical claim action applies only to PHYSICAL or BOTH delivery requests.',
        });
      }
      if (error instanceof Error && error.message === 'REQUEST_NOT_APPROVED') {
        return res.status(400).json({ error: 'Only approved requests can be marked as physically claimed.' });
      }
      if (error instanceof Error && error.message === 'DIGITAL_ISSUANCE_REQUIRED_BEFORE_PHYSICAL_CLAIM') {
        return res.status(400).json({
          error: 'For BOTH delivery, issue/link the digital credential before marking physical claim.',
        });
      }

      console.error('Error marking physical claim:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
