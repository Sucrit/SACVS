export interface CreateCredentialDto {
  studentId: string;
  title: string;
  type: 'TRANSCRIPT' | 'DIPLOMA' | 'CERTIFICATE' | 'DEGREE' | 'LICENSE';
  description?: string;
  issuedById: string;
}

export interface UpdateCredentialStatusDto {
  status: 'PENDING' | 'VERIFIED' | 'ISSUED' | 'REVOKED' | 'EXPIRED';
}
  