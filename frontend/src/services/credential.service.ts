import { api } from '../api/client';

export type CredentialType = 'TRANSCRIPT' | 'DIPLOMA' | 'CERTIFICATE' | 'DEGREE' | 'LICENSE';
export type CredentialStatus = 'PENDING' | 'VERIFIED' | 'AI_REVIEW' | 'ISSUED' | 'REVOKED' | 'EXPIRED';
export type CredentialRequestStatus = 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
export type DeliveryMethod = 'DIGITAL' | 'PHYSICAL' | 'BOTH';

export interface Credential {
  id: string;
  title: string;
  type: CredentialType;
  status: CredentialStatus;
  description: string | null;
  studentId: string;
  issuedById: string;
  filename: string | null;
  mimeType: string | null;
  storageKey: string | null;
  fileHash: string | null;
  metadata: Record<string, unknown> | null;
  aiStatus: string | null;
  aiScore: number | null;
  aiReport: Record<string, unknown> | null;
  aiValidatedAt: string | null;
  chain: string | null;
  txHash: string | null;
  blockNumber: number | null;
  anchoredAt: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialRequest {
  id: string;
  studentId: string;
  credentialId: string | null;
  type: CredentialType;
  title: string;
  description: string | null;
  purpose: string | null;
  deliveryMethod: DeliveryMethod;
  status: CredentialRequestStatus;
  processedById: string | null;
  processedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  metadata?: Record<string, unknown> | null;
  aiScore?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCredentialPayload {
  studentId: string;
  title: string;
  type: CredentialType;
  description?: string;
  issuedById?: string;
  status?: CredentialStatus;
  issuedDate?: string;
  expiryDate?: string;
  metadata?: Record<string, unknown> | null;
  file?: File;
}

export interface IssueCredentialPayload {
  description?: string;
  issuedDate?: string;
  expiryDate?: string;
  metadata?: Record<string, unknown> | null;
  file?: File;
}

export interface CredentialListQuery {
  studentId?: string;
  status?: CredentialStatus;
  type?: CredentialType;
  page?: number;
  pageSize?: number;
  scope?: 'mine';
}

export interface CreateCredentialRequestPayload {
  credentialId?: string;
  type: CredentialType;
  title: string;
  description?: string;
  purpose?: string;
  deliveryMethod?: DeliveryMethod;
}

export interface CredentialRequestListQuery {
  status?: CredentialRequestStatus;
  studentId?: string;
  page?: number;
  pageSize?: number;
}

const toMultipartPayload = (data: CreateCredentialPayload | IssueCredentialPayload) => {
  const formData = new FormData();

  Object.entries(data as Record<string, unknown>).forEach(([key, value]) => {
    if (typeof value === 'undefined' || value === null) {
      return;
    }

    if (value instanceof File) {
      formData.append(key, value);
      return;
    }

    if (typeof value === 'object') {
      formData.append(key, JSON.stringify(value));
      return;
    }

    formData.append(key, String(value));
  });

  return formData;
};

export const CredentialService = {
  list: async (query: CredentialListQuery = {}) => {
    const response = await api.get<Credential[]>('/credentials', { params: query });
    return response.data;
  },

  listMine: async () => {
    const response = await api.get<Credential[]>('/credentials', { params: { scope: 'mine' } });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get<Credential>(`/credentials/${id}`);
    return response.data;
  },

  create: async (data: CreateCredentialPayload) => {
    const hasFile = data.file instanceof File;
    const response = await api.post<Credential>(
      '/credentials',
      hasFile ? toMultipartPayload(data) : data,
      hasFile ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined,
    );
    return response.data;
  },

  updateStatus: async (id: string, status: CredentialStatus) => {
    const response = await api.put<Credential>(`/credentials/${id}/status`, { status });
    return response.data;
  },

  issue: async (id: string, data: IssueCredentialPayload = {}) => {
    const hasFile = data.file instanceof File;
    const response = await api.put<Credential>(
      `/credentials/${id}/issue`,
      hasFile ? toMultipartPayload(data) : data,
      hasFile ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined,
    );
    return response.data;
  },

  listRequests: async (query: CredentialRequestListQuery = {}) => {
    const response = await api.get<CredentialRequest[]>('/credentials/requests', { params: query });
    return response.data;
  },

  createRequest: async (data: CreateCredentialRequestPayload) => {
    const response = await api.post<CredentialRequest>('/credentials/requests', data);
    return response.data;
  },

  updateRequestStatus: async (
    requestId: string,
    status: Exclude<CredentialRequestStatus, 'PENDING' | 'CANCELLED'>,
    rejectionReason?: string,
    notes?: string,
  ) => {
    const response = await api.patch<CredentialRequest>(`/credentials/requests/${requestId}/status`, {
      status,
      rejectionReason,
      notes,
    });
    return response.data;
  },
};
