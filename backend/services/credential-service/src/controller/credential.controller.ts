import { Request, Response } from 'express';
import { CredentialService } from '../service/credential.service';
import { asyncHandler } from '../utils/asyncHandler';
import { CredentialStatus, CredentialType, CredentialRequestStatus } from '@prisma/client';
import { Role } from '@prisma/client';

const credentialService = new CredentialService();

type AuthenticatedRequest = Request & {
  auth?: { userId?: string };
  user?: { id: string; role: Role; clerkId: string };
};

function getRouteParam(value: string | string[] | undefined, name: string): string {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized) throw { status: 400, message: `Missing route parameter: ${name}` };
  return normalized;
}

// ─── Credential Endpoints ────────────────────────────────────

export const createCredential = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const clerkId = req.auth?.userId;
  if (!clerkId) throw { status: 401, message: 'Unauthorized' };

  const payload = { ...req.body, issuerClerkId: clerkId };
  const created = await credentialService.createCredential(payload);
  res.status(201).json(created);
});

export const getCredentials = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { status, type, studentId, search, page, limit } = req.query;
  const result = await credentialService.getCredentials({
    status: status as CredentialStatus | undefined,
    type: type as CredentialType | undefined,
    studentId: studentId as string | undefined,
    search: search as string | undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  res.json(result);
});

export const getStudentCredentials = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const clerkId = req.auth?.userId;
  if (!clerkId) throw { status: 401, message: 'Unauthorized' };
  const list = await credentialService.getStudentCredentials(clerkId);
  res.json(list);
});

export const getCredential = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = getRouteParam(req.params.id, 'id');
  const item = await credentialService.getCredentialById(id);
  res.json(item);
});

export const updateCredentialStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = getRouteParam(req.params.id, 'id');
  const updated = await credentialService.updateCredentialStatus(id, req.body);
  res.json(updated);
});

export const deleteCredential = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = getRouteParam(req.params.id, 'id');
  await credentialService.deleteCredential(id);
  res.status(204).send();
});

export const getStats = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const stats = await credentialService.getStats();
  res.json(stats);
});

// ─── Credential Request Endpoints ────────────────────────────

export const createRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const clerkId = req.auth?.userId;
  if (!clerkId) throw { status: 401, message: 'Unauthorized' };

  const created = await credentialService.createRequest(clerkId, req.body);
  res.status(201).json(created);
});

export const getMyRequests = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const clerkId = req.auth?.userId;
  if (!clerkId) throw { status: 401, message: 'Unauthorized' };

  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const result = await credentialService.getMyRequests(clerkId, page, limit);
  res.json(result);
});

export const getRequestById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = getRouteParam(req.params.id, 'id');
  const item = await credentialService.getRequestById(id);
  res.json(item);
});

export const getPendingRequests = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const result = await credentialService.getPendingRequests(page, limit);
  res.json(result);
});

export const getAllRequests = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { status, page, limit } = req.query;
  const result = await credentialService.getAllRequests(
    status as CredentialRequestStatus | undefined,
    page ? Number(page) : 1,
    limit ? Number(limit) : 20,
  );
  res.json(result);
});

export const processRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const clerkId = req.auth?.userId;
  if (!clerkId) throw { status: 401, message: 'Unauthorized' };

  const requestId = getRouteParam(req.params.id, 'id');
  const result = await credentialService.processRequest(requestId, clerkId, req.body);
  res.json(result);
});

export const CredentialController = {
  createCredential,
  getCredentials,
  getStudentCredentials,
  getCredential,
  updateCredentialStatus,
  deleteCredential,
  getStats,
  createRequest,
  getMyRequests,
  getRequestById,
  getPendingRequests,
  getAllRequests,
  processRequest,
};
