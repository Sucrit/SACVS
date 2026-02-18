import { CredentialType, CredentialStatus, CredentialRequestStatus, DeliveryMethod } from '@prisma/client';

// ─── Credential DTOs ─────────────────────────────────────────

export interface CreateCredentialDto {
  issuerClerkId: string;
  studentId: string;
  title: string;
  type?: CredentialType | string;
  description?: string;
  filename?: string | null;
  metadata?: Record<string, unknown> | null;
  institution_name?: string;
  student_name?: string;
  student_email?: string;
  issue_date?: string;
  expiry_date?: string;
  document_url?: string;
  document_base64?: string;
  document_mime_type?: string;
  document_original_name?: string;
}

export interface UpdateCredentialStatusDto {
  status: CredentialStatus | string;
}

export interface CredentialResponseDto {
  id: string;
  studentId: string;
  issuedById: string;
  title: string;
  type: string;
  status: string;
  description?: string | null;
  filename?: string | null;
  metadata?: Record<string, unknown> | null;
  institution_name?: string;
  student_name?: string;
  student_email?: string;
  issue_date?: string;
  expiry_date?: string;
  document_url?: string;
  // AI fields
  aiStatus?: string | null;
  aiScore?: number | null;
  aiReport?: Record<string, unknown> | null;
  aiValidatedAt?: string | null;
  // Blockchain fields
  chain?: string | null;
  txHash?: string | null;
  blockNumber?: number | null;
  anchoredAt?: string | null;
  // Timestamps
  createdAt: string | Date;
  updatedAt: string | Date;
}

// ─── Credential Request DTOs ─────────────────────────────────

export interface CreateCredentialRequestDto {
  type: CredentialType | string;
  title: string;
  description?: string;
  purpose?: string;
  deliveryMethod?: DeliveryMethod | string;
}

export interface UpdateCredentialRequestDto {
  status: CredentialRequestStatus | string;
  rejectionReason?: string;
  notes?: string;
}

export interface CredentialRequestResponseDto {
  id: string;
  studentId: string;
  credentialId?: string | null;
  type: string;
  title: string;
  description?: string | null;
  purpose?: string | null;
  deliveryMethod: string;
  status: string;
  processedById?: string | null;
  processedAt?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CredentialListQuery {
  status?: CredentialStatus;
  type?: CredentialType;
  studentId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
