import { Prisma } from '../../../../db/node_modules/@prisma/client';

export type CredentialTypeValue =
  | 'TRANSCRIPT'
  | 'DIPLOMA'
  | 'CERTIFICATE'
  | 'DEGREE'
  | 'LICENSE';

export type CredentialStatusValue =
  | 'PENDING'
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
  chain?: string;
  txHash?: string;
  blockNumber?: number;
  anchoredAt?: string;
  issuedDate?: string;
  expiryDate?: string;
}

export interface GenerateQrTokenDto {
  credentialId: string;
  allowDocumentPreview?: boolean;
  allowDocumentDownload?: boolean;
}

export interface ConsumeQrTokenDto {
  token: string;
}

export interface QrTokenConsumerContext {
  consumerType: 'PUBLIC' | 'EMPLOYER';
  consumerId?: string | null;
  ipAddress?: string | null;
}

export interface GeneratedQrTokenResponseDto {
  tokenId: string;
  verificationUrl: string;
  expiresAt: string;
  ttlSeconds: number;
  allowDocumentPreview: boolean;
  allowDocumentDownload: boolean;
}

export interface QrVerificationCredentialViewDto {
  id: string;
  title: string;
  type: CredentialTypeValue;
  status: CredentialStatusValue;
  studentOwner: string;
  studentEmail: string;
  studentNumber: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  institutionName: string;
  chain: string | null;
  txHash: string | null;
  blockNumber: number | null;
}

export interface QrDocumentAccessDto {
  previewEnabled: boolean;
  downloadEnabled: boolean;
  token: string | null;
  expiresAt: string | null;
}

export interface ConsumeQrTokenResponseDto {
  valid: boolean;
  credential: QrVerificationCredentialViewDto | null;
  documentAccess?: QrDocumentAccessDto;
  reason?: 'INVALID' | 'EXPIRED' | 'USED';
}
