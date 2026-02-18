import { Request, Response } from 'express';
import { CredentialService } from '../service/credential.service';
import { CreateCredentialDto, UpdateCredentialStatusDto } from '../dto/credential.dto';

const credentialService = new CredentialService();

export class CredentialController {
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
