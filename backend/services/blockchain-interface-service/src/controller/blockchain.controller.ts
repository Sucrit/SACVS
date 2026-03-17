import { Request, Response } from 'express';
import { blockchainService } from '../service/blockchain.service';

export class BlockchainController {
  private mapError(error: unknown, res: Response): Response | null {
    if (!(error instanceof Error)) return null;

    const map: Record<string, { code: number; error: string }> = {
      CREDENTIAL_ALREADY_EXISTS_ON_CHAIN: {
        code: 409,
        error: 'Credential already exists on chain.',
      },
      CREDENTIAL_ALREADY_REVOKED_ON_CHAIN: {
        code: 409,
        error: 'Credential is already revoked on chain.',
      },
      'INTERNAL_SERVICE_TOKEN is required for blockchain-interface-service.': {
        code: 500,
        error: 'Blockchain interface service is misconfigured.',
      },
      'Blockchain contract is not initialized.': {
        code: 502,
        error: 'Failed to reach blockchain contract.',
      },
    };

    const mapped = map[error.message];
    if (mapped) {
      return res.status(mapped.code).json({ error: mapped.error });
    }

    if (
      error.message.includes('Unable to resolve blockchain contract address') ||
      error.message.includes('BLOCKCHAIN_PRIVATE_KEY is not configured')
    ) {
      return res.status(500).json({ error: 'Blockchain interface service is misconfigured.' });
    }

    return null;
  }

  async anchorCredential(req: Request, res: Response): Promise<Response> {
    const credentialId =
      typeof req.body?.credentialId === 'string' ? req.body.credentialId.trim() : '';
    const studentId = typeof req.body?.studentId === 'string' ? req.body.studentId.trim() : '';
    const fileHash = typeof req.body?.fileHash === 'string' ? req.body.fileHash.trim() : '';
    const allowReissue = req.body?.allowReissue === true || req.body?.allowReissue === 'true';

    if (!credentialId) {
      return res.status(400).json({ error: 'Missing required field: credentialId' });
    }
    if (!studentId) {
      return res.status(400).json({ error: 'Missing required field: studentId' });
    }
    if (!fileHash) {
      return res.status(400).json({ error: 'Missing required field: fileHash' });
    }

    try {
      const result = await blockchainService.anchorCredential({
        credentialId,
        studentId,
        fileHash,
        allowReissue,
      });
      return res.status(200).json(result);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;
      console.error('Failed to anchor credential on chain:', error);
      return res.status(502).json({ error: 'Failed to anchor credential on blockchain.' });
    }
  }

  async revokeCredential(req: Request, res: Response): Promise<Response> {
    const credentialId =
      typeof req.body?.credentialId === 'string' ? req.body.credentialId.trim() : '';

    if (!credentialId) {
      return res.status(400).json({ error: 'Missing required field: credentialId' });
    }

    try {
      const result = await blockchainService.revokeCredential({ credentialId });
      return res.status(200).json(result);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;
      console.error('Failed to revoke credential on chain:', error);
      return res.status(502).json({ error: 'Failed to revoke credential on blockchain.' });
    }
  }

  async verifyCredential(req: Request, res: Response): Promise<Response> {
    const credentialId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!credentialId?.trim()) {
      return res.status(400).json({ error: 'Missing credential id.' });
    }

    try {
      const result = await blockchainService.verifyCredential(credentialId);
      return res.status(200).json(result);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;
      console.error('Failed to verify credential on chain:', error);
      return res.status(502).json({ error: 'Failed to verify credential on blockchain.' });
    }
  }

  async verifyCredentialDocument(req: Request, res: Response): Promise<Response> {
    const credentialId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const fileHash =
      typeof req.query.fileHash === 'string'
        ? req.query.fileHash.trim()
        : typeof req.body?.fileHash === 'string'
          ? req.body.fileHash.trim()
          : '';

    if (!credentialId?.trim()) {
      return res.status(400).json({ error: 'Missing credential id.' });
    }
    if (!fileHash) {
      return res.status(400).json({ error: 'Missing required field: fileHash' });
    }

    try {
      const result = await blockchainService.verifyCredentialDocument(credentialId, fileHash);
      return res.status(200).json(result);
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;
      console.error('Failed to verify credential document hash on chain:', error);
      return res
        .status(502)
        .json({ error: 'Failed to verify credential document hash on blockchain.' });
    }
  }
}
