import { CredentialRepository } from '../repository/credential.repository';
import { CreateCredentialDto, CredentialResponseDto } from '../dto/credential.dto';
import { archiveCredentialDocument } from '../utils/credentialArchive';
import { Prisma } from '@prisma/client';

const credentialRepository = new CredentialRepository();

export class CredentialService {
  private normalizeMetadata(metadata: unknown): Record<string, unknown> {
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      return metadata as Record<string, unknown>;
    }
    return {};
  }

  private toOptionalString(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) return value;
    return undefined;
  }

  private toOptionalStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    return value.filter((item): item is string => typeof item === 'string');
  }

  private toDto(entity: any): CredentialResponseDto {
    const { id, uploaderClerkId, title, filename, metadata, createdAt, updatedAt } = entity;
    const normalizedMetadata = this.normalizeMetadata(metadata);
    const createdDate = createdAt instanceof Date ? createdAt.toISOString() : String(createdAt);

    return {
      id,
      uploaderClerkId,
      title,
      filename,
      metadata: normalizedMetadata,
      type: this.toOptionalString(normalizedMetadata.type),
      institution_name: this.toOptionalString(normalizedMetadata.institution_name),
      student_name: this.toOptionalString(normalizedMetadata.student_name),
      student_email: this.toOptionalString(normalizedMetadata.student_email),
      issue_date: this.toOptionalString(normalizedMetadata.issue_date),
      expiry_date: this.toOptionalString(normalizedMetadata.expiry_date),
      status: this.toOptionalString(normalizedMetadata.status) || 'pending',
      document_url: this.toOptionalString(normalizedMetadata.document_url),
      created_date: createdDate,
      ai_confidence_score:
        typeof normalizedMetadata.ai_confidence_score === 'number'
          ? normalizedMetadata.ai_confidence_score
          : undefined,
      ai_fraud_flags: this.toOptionalStringArray(normalizedMetadata.ai_fraud_flags),
      blockchain_hash: this.toOptionalString(normalizedMetadata.blockchain_hash),
      blockchain_timestamp: this.toOptionalString(normalizedMetadata.blockchain_timestamp),
      createdAt,
      updatedAt,
    };
  }

  async createCredential(data: CreateCredentialDto): Promise<CredentialResponseDto> {
    if (!data.uploaderClerkId || !data.title) {
      throw { status: 400, message: 'uploaderClerkId and title are required' };
    }

    const baseMetadata = this.normalizeMetadata(data.metadata);

    let documentArchivePath: string | undefined;
    if (data.document_base64) {
      documentArchivePath = await archiveCredentialDocument({
        documentBase64: data.document_base64,
        mimeType: data.document_mime_type,
        originalName: data.document_original_name,
        tag: data.title,
      });
    }

    const mergedMetadata: Record<string, unknown> = {
      ...baseMetadata,
      type: data.type ?? baseMetadata.type ?? 'certificate',
      institution_name: data.institution_name ?? baseMetadata.institution_name,
      student_name: data.student_name ?? baseMetadata.student_name,
      student_email: data.student_email ?? baseMetadata.student_email,
      issue_date: data.issue_date ?? baseMetadata.issue_date,
      expiry_date: data.expiry_date ?? baseMetadata.expiry_date,
      status: data.status ?? baseMetadata.status ?? 'pending',
      document_url: data.document_url ?? baseMetadata.document_url,
      ...(documentArchivePath ? { document_archive_path: documentArchivePath } : {}),
    };

    const created = await credentialRepository.create({
      uploaderClerkId: data.uploaderClerkId,
      title: data.title,
      filename: data.filename || data.document_original_name || null,
      metadata: mergedMetadata as Prisma.InputJsonValue,
    });

    return this.toDto(created);
  }

  async getAllCredentials(): Promise<CredentialResponseDto[]> {
    const items = await credentialRepository.list();
    return items.map((i: any) => this.toDto(i));
  }

  async getStudentCredentials(clerkId?: string): Promise<CredentialResponseDto[]> {
    const items = clerkId
      ? await credentialRepository.listByUploaderClerkId(clerkId)
      : await credentialRepository.list();
    return items.map((i: any) => this.toDto(i));
  }

  async getCredentialById(id: string): Promise<CredentialResponseDto> {
    if (!id) throw { status: 400, message: 'id required' };
    const item = await credentialRepository.findById(id);
    if (!item) throw { status: 404, message: 'Credential not found' };
    return this.toDto(item);
  }
}
