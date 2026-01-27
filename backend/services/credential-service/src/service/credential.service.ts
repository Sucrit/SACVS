import { CredentialRepository } from '../repository/credential.repository';
import { CreateCredentialDto, CredentialResponseDto } from '../dto/credential.dto';

const credentialRepository = new CredentialRepository();

export class CredentialService {
  private toDto(entity: any): CredentialResponseDto {
    const { id, uploaderClerkId, title, filename, metadata, createdAt, updatedAt } = entity;
    return { id, uploaderClerkId, title, filename, metadata, createdAt, updatedAt };
  }

  async createCredential(data: CreateCredentialDto): Promise<CredentialResponseDto> {
    if (!data.uploaderClerkId || !data.title) {
      throw { status: 400, message: 'uploaderClerkId and title are required' };
    }
    const created = await credentialRepository.create({
      uploaderClerkId: data.uploaderClerkId,
      title: data.title,
      filename: data.filename || null,
      metadata: data.metadata || null,
    });
    return this.toDto(created);
  }

  async getAllCredentials(): Promise<CredentialResponseDto[]> {
    const items = await credentialRepository.list();
    return items.map((i: any) => this.toDto(i));
  }

  async getCredentialById(id: string): Promise<CredentialResponseDto> {
    if (!id) throw { status: 400, message: 'id required' };
    const item = await credentialRepository.findById(id);
    if (!item) throw { status: 404, message: 'Credential not found' };
    return this.toDto(item);
  }
}
