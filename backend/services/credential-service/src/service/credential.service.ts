import { CredentialRepository } from '../repository/credential.repository';
import { CreateCredentialDto, UpdateCredentialStatusDto } from '../dto/credential.dto';

const credentialRepository = new CredentialRepository();

export class CredentialService {
  // Create a new credential
  async createCredential(data: CreateCredentialDto) {
    return credentialRepository.createCredential(data);
  }

  // Get a credential by ID
  async getCredentialById(credentialId: string) {
    return credentialRepository.getCredentialById(credentialId);
  }

  // Update credential status
  async updateCredentialStatus(credentialId: string, statusData: UpdateCredentialStatusDto) {
    return credentialRepository.updateCredentialStatus(credentialId, statusData.status);
  }
}
