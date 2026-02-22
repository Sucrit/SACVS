import { Request, Response } from 'express';
import { CredentialService } from '../service/credential.service';
import {
  CreateCredentialDto,
  ListCredentialsQueryDto,
  UpdateCredentialStatusDto,
} from '../dto/credential.dto';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const credentialService = new CredentialService();

const VALID_CREDENTIAL_STATUSES = ['PENDING', 'VERIFIED', 'AI_REVIEW', 'ISSUED', 'REVOKED', 'EXPIRED'] as const;
const VALID_CREDENTIAL_TYPES = ['TRANSCRIPT', 'DIPLOMA', 'CERTIFICATE', 'DEGREE', 'LICENSE'] as const;

export class CredentialController {
  private getAuthUserId(req: Request): string | null {
    return (req as AuthenticatedRequest).auth?.sub ?? null;
  }

  private parseListQuery(query: Request['query']): ListCredentialsQueryDto {
    const studentId = typeof query.studentId === 'string' ? query.studentId : undefined;
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
      status: status as ListCredentialsQueryDto['status'],
      type: type as ListCredentialsQueryDto['type'],
      page,
      pageSize,
      scope,
    };
  }

  async listCredentials(req: Request, res: Response): Promise<Response> {
    const userId = this.getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const query = this.parseListQuery(req.query);
      const credentials = await credentialService.listCredentials(
        { userId, role: (req as AuthenticatedRequest).auth?.role },
        query,
      );
      return res.status(200).json(credentials);
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_STATUS') {
        return res.status(400).json({ error: 'Invalid status query value.' });
      }
      if (error instanceof Error && error.message === 'INVALID_TYPE') {
        return res.status(400).json({ error: 'Invalid type query value.' });
      }
      console.error('Error listing credentials:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // Create a new credential
  async createCredential(req: Request, res: Response): Promise<Response> {
    const credentialData: CreateCredentialDto = req.body;
    const newCredential = await credentialService.createCredential(credentialData);
    return res.status(201).json(newCredential);
  }

  // Get a credential by ID
  async getCredentialById(req: Request, res: Response): Promise<Response> {
    const credentialId: string = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const credential = await credentialService.getCredentialById(credentialId);
    if (credential) {
      return res.status(200).json(credential);
    } else {
      return res.status(404).json({ error: 'Credential not found' });
    }
  }

  // Update credential status
  async updateCredentialStatus(req: Request, res: Response): Promise<Response> {
    const credentialId: string = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { status }: UpdateCredentialStatusDto = req.body;
    const updatedCredential = await credentialService.updateCredentialStatus(credentialId, { status });
    return res.status(200).json(updatedCredential);
  }
}
