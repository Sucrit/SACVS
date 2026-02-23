import { Prisma } from '../../../../db/node_modules/@prisma/client';

export type CredentialTypeValue =
  | 'TRANSCRIPT'
  | 'DIPLOMA'
  | 'CERTIFICATE'
  | 'DEGREE'
  | 'LICENSE';

export type CredentialStatusValue =
  | 'PENDING'
  | 'VERIFIED'
  | 'AI_REVIEW'
  | 'ISSUED'
  | 'REVOKED'
  | 'EXPIRED';

export interface CreateCredentialDto {
  studentId: string;
  title: string;
  type: CredentialTypeValue;
  description?: string;
  issuedById?: string;
  status?: CredentialStatusValue;
  filename?: string;
  mimeType?: string;
  storageKey?: string;
  fileHash?: string;
  metadata?: Prisma.InputJsonValue | null;
  aiStatus?: string;
  aiScore?: number;
  aiReport?: Prisma.InputJsonValue | null;
  aiValidatedAt?: string;
  chain?: string;
  txHash?: string;
  blockNumber?: number;
  anchoredAt?: string;
  issuedDate?: string;
  expiryDate?: string;
}

export interface ListCredentialsQueryDto {
  studentId?: string;
  issuedById?: string;
  status?: CredentialStatusValue;
  type?: CredentialTypeValue;
  page?: number;
  pageSize?: number;
  scope?: 'mine';
}

export interface UpdateCredentialStatusDto {
  status: CredentialStatusValue;
  description?: string;
  filename?: string;
  mimeType?: string;
  storageKey?: string;
  fileHash?: string;
  metadata?: Prisma.InputJsonValue | null;
  aiStatus?: string;
  aiScore?: number;
  aiReport?: Prisma.InputJsonValue | null;
  aiValidatedAt?: string;
  chain?: string;
  txHash?: string;
  blockNumber?: number;
  anchoredAt?: string;
  issuedDate?: string;
  expiryDate?: string;
}

export interface IssueCredentialDto {
  description?: string;
  filename?: string;
  mimeType?: string;
  storageKey?: string;
  fileHash?: string;
  metadata?: Prisma.InputJsonValue | null;
  aiStatus?: string;
  aiScore?: number;
  aiReport?: Prisma.InputJsonValue | null;
  aiValidatedAt?: string;
  chain?: string;
  txHash?: string;
  blockNumber?: number;
  anchoredAt?: string;
  issuedDate?: string;
  expiryDate?: string;
}
