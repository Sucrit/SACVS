export interface CreateCredentialDto {
  uploaderClerkId: string;
  title: string;
  filename?: string | null;
  metadata?: any;
}

export interface CredentialResponseDto {
  id: string;
  uploaderClerkId: string;
  title: string;
  filename?: string | null;
  metadata?: any;
  createdAt: string | Date;
  updatedAt: string | Date;
}
