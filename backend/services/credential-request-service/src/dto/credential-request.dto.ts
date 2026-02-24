export type CredentialRequestStatus = 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
export type CredentialType = 'TRANSCRIPT' | 'DIPLOMA' | 'CERTIFICATE' | 'DEGREE' | 'LICENSE';
export type RequesterType = 'STUDENT' | 'EMPLOYER' | 'INSTITUTION';
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
  employerId?: string;
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
    employerId: string | null;
  };
  createdAt: string;
  updatedAt: string;
}
