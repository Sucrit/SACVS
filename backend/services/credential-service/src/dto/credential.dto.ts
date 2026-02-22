export interface CreateCredentialDto {
  studentId: string;
  title: string;
  type: 'TRANSCRIPT' | 'DIPLOMA' | 'CERTIFICATE' | 'DEGREE' | 'LICENSE';
  description?: string;
  issuedById: string;
}

export interface ListCredentialsQueryDto {
  studentId?: string;
  status?: 'PENDING' | 'VERIFIED' | 'AI_REVIEW' | 'ISSUED' | 'REVOKED' | 'EXPIRED';
  type?: 'TRANSCRIPT' | 'DIPLOMA' | 'CERTIFICATE' | 'DEGREE' | 'LICENSE';
  page?: number;
  pageSize?: number;
  scope?: 'mine';
}

export interface UpdateCredentialStatusDto {
  status: 'PENDING' | 'VERIFIED' | 'AI_REVIEW' | 'ISSUED' | 'REVOKED' | 'EXPIRED';
}
  
