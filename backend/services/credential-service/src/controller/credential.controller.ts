import { Request, Response } from 'express';
import { CredentialService } from '../service/credential.service';
import { asyncHandler } from '../utils/asyncHandler';

const credentialService = new CredentialService();

export const createCredential = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body;
  const created = await credentialService.createCredential(payload);
  res.status(201).json(created);
});

export const getCredentials = asyncHandler(async (_req: Request, res: Response) => {
  const list = await credentialService.getAllCredentials();
  res.json(list);
});

export const getStudentCredentials = asyncHandler(async (req: Request, res: Response) => {
  const rawClerkId = req.query.clerkId;
  const clerkId = Array.isArray(rawClerkId) ? rawClerkId[0] : rawClerkId;
  const list = await credentialService.getStudentCredentials(typeof clerkId === 'string' ? clerkId : undefined);
  res.json(list);
});

export const getCredential = asyncHandler(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const item = await credentialService.getCredentialById(id);
  res.json(item);
});

export const CredentialController = {
  createCredential,
  getCredentials,
  getStudentCredentials,
  getCredential,
};
