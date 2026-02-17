export interface CreateCredentialDto {
  uploaderClerkId: string;
  title: string;
  filename?: string | null;
  metadata?: Record<string, unknown> | null;
  type?: string;
  institution_name?: string;
  student_name?: string;
  student_email?: string;
  issue_date?: string;
  expiry_date?: string;
  status?: string;
  document_url?: string;
  document_base64?: string;
  document_mime_type?: string;
  document_original_name?: string;
}

export interface CredentialResponseDto {
  id: string;
  uploaderClerkId: string;
  title: string;
  filename?: string | null;
  metadata?: Record<string, unknown> | null;
  type?: string;
  institution_name?: string;
  student_name?: string;
  student_email?: string;
  issue_date?: string;
  expiry_date?: string;
  status?: string;
  document_url?: string;
  created_date?: string;
  ai_confidence_score?: number;
  ai_fraud_flags?: string[];
  blockchain_hash?: string;
  blockchain_timestamp?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}
