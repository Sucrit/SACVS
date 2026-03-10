export type CredentialRequestStatus = 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
export type CredentialType = 'TRANSCRIPT' | 'DIPLOMA' | 'CERTIFICATE' | 'DEGREE' | 'LICENSE';
export type RequesterType = 'STUDENT' | 'INSTITUTION';
export type DeliveryMethod = 'DIGITAL' | 'PHYSICAL' | 'BOTH';

export interface ListCredentialRequestsQueryDto {
  status?: CredentialRequestStatus;
  studentId?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateCredentialRequestDto {
  studentId?: string;
  credentialId?: string;
  type: CredentialType;
  title: string;
  description?: string;
  purpose?: string;
  deliveryMethod?: DeliveryMethod;
  institutionId?: string;
}

export interface UpdateCredentialRequestStatusDto {
  status: Exclude<CredentialRequestStatus, 'PENDING'>;
  rejectionReason?: string;
  notes?: string;
  credentialId?: string;
}

export interface CredentialRequestResponseDto {
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
  metadata: {
    requesterType: RequesterType;
    requesterId: string;
    institutionId: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalReceiptResponseDto {
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

export interface ApprovalReceiptVerificationResultDto {
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

