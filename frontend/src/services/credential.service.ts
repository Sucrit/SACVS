import { api } from '../api/client';

export type CredentialType = 'TRANSCRIPT' | 'DIPLOMA' | 'CERTIFICATE' | 'DEGREE' | 'LICENSE';
export type CredentialStatus = 'PENDING' | 'ISSUED' | 'REVOKED' | 'EXPIRED';
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
  chain: string | null;
  txHash: string | null;
  blockNumber: number | null;
  anchoredAt: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  createdAt: string;
  updatedAt: string;
  issuedBy?: {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    email: string;
    institution?: {
      institutionName: string;
    } | null;
  } | null;
  student?: {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    email: string;
    institutionId?: string | null;
    profile?: {
      studentNumber?: string | null;
      courseOfStudy?: string | null;
    } | null;
  } | null;
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

export interface GeneratedQrTokenResponse {
  tokenId: string;
  verificationUrl: string;
  expiresAt: string;
  ttlSeconds: number;
  allowDocumentPreview: boolean;
  allowDocumentDownload: boolean;
}

export interface QrVerificationCredentialView {
  id: string;
  title: string;
  type: CredentialType;
  status: CredentialStatus;
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

export interface QrVerificationResult {
  valid: boolean;
  credential: QrVerificationCredentialView | null;
  documentAccess?: {
    previewEnabled: boolean;
    downloadEnabled: boolean;
    token: string | null;
    expiresAt: string | null;
  };
  reason?: 'INVALID' | 'EXPIRED' | 'USED';
}

export interface ApprovalReceipt {
  receiptId: string;
  requestId: string;
  receiptCode: string;
  verificationUrl: string;
  expiresAt: string;
  ttlSeconds: number;
  studentName: string;
  studentNumber: string | null;
  type: CredentialType;
  deliveryMethod: DeliveryMethod;
  approvedAt: string | null;
  institutionName: string;
}

export interface ApprovalReceiptVerificationResult {
  valid: boolean;
  reason?: 'INVALID' | 'EXPIRED' | 'USED';
  receipt: null | {
    requestId: string;
    receiptCode: string;
    studentName: string;
    studentNumber: string | null;
    type: CredentialType;
    deliveryMethod: DeliveryMethod;
    approvedAt: string | null;
    institutionName: string;
  };
}

export interface ReceiptLookupResult {
  found: boolean;
  lookupOnly: true;
  tokenStatus?: 'ACTIVE' | 'EXPIRED' | 'USED' | 'INVALIDATED';
  receipt: null | {
    receiptCode: string;
    requestId: string;
    studentName: string;
    studentNumber: string | null;
    type: CredentialType;
    deliveryMethod: DeliveryMethod;
    approvedAt: string | null;
    institutionName: string;
  };
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

  issue: async (id: string, data: IssueCredentialPayload = {}, stepUpToken?: string) => {
    const hasFile = data.file instanceof File;
    const response = await api.put<Credential>(
      `/credentials/${id}/issue`,
      hasFile ? toMultipartPayload(data) : data,
      {
        headers: {
          ...(hasFile ? { 'Content-Type': 'multipart/form-data' } : {}),
          ...(stepUpToken ? { 'x-step-up-token': stepUpToken } : {}),
        },
      },
    );
    return response.data;
  },

  listRequests: async (query: CredentialRequestListQuery = {}) => {
    const response = await api.get<CredentialRequest[]>('/credentials/requests', { params: query });
    return response.data;
  },

  getRequestById: async (requestId: string) => {
    const response = await api.get<CredentialRequest>(`/credentials/requests/${requestId}`);
    return response.data;
  },

  createRequest: async (data: CreateCredentialRequestPayload) => {
    const response = await api.post<CredentialRequest>('/credentials/requests', data);
    return response.data;
  },

  updateRequestStatus: async (
    requestId: string,
    status: Exclude<CredentialRequestStatus, 'PENDING'>,
    rejectionReason?: string,
    notes?: string,
    credentialId?: string,
  ) => {
    const response = await api.patch<CredentialRequest>(`/credentials/requests/${requestId}/status`, {
      status,
      rejectionReason,
      notes,
      credentialId,
    });
    return response.data;
  },

  markPhysicalClaimed: async (requestId: string, notes?: string) => {
    const response = await api.post<CredentialRequest>(
      `/credentials/requests/${encodeURIComponent(requestId)}/mark-physical-claimed`,
      notes ? { notes } : {},
    );
    return response.data;
  },

  getApprovalReceipt: async (requestId: string) => {
    const response = await api.get<ApprovalReceipt>(`/credentials/requests/${encodeURIComponent(requestId)}/approval-receipt`);
    return response.data;
  },

  verifyApprovalReceipt: async (token: string) => {
    const response = await api.post<ApprovalReceiptVerificationResult>('/credentials/requests/verify-receipt', { token });
    return response.data;
  },

  lookupReceiptByCode: async (code: string) => {
    const response = await api.post<ReceiptLookupResult>('/credentials/requests/lookup-receipt', { code });
    return response.data;
  },

  getDocumentBlob: async (credentialId: string) => {
    const response = await api.get<Blob>(`/credentials/${encodeURIComponent(credentialId)}/document`, {
      responseType: 'blob',
    });
    return response.data;
  },

  generateQrToken: async (
    credentialId: string,
    options?: {
      allowDocumentPreview?: boolean;
      allowDocumentDownload?: boolean;
    },
    stepUpToken?: string,
  ) => {
    const response = await api.post<GeneratedQrTokenResponse>(
      `/credentials/${encodeURIComponent(credentialId)}/qr-token`,
      options || {},
      {
        headers: stepUpToken ? { 'x-step-up-token': stepUpToken } : undefined,
      },
    );
    return response.data;
  },

  verifyQrPublic: async (token: string) => {
    const response = await api.post<QrVerificationResult>('/credentials/verify/qr', { token });
    return response.data;
  },

  getQrSharedDocumentBlob: async (token: string, mode: 'preview' | 'download') => {
    const response = await api.get<Blob>(
      `/credentials/verify/qr/document/${encodeURIComponent(token)}${mode === 'download' ? '?download=1' : ''}`,
      { responseType: 'blob' },
    );
    return response.data;
  },
};
