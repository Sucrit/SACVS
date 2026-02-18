import { PrismaClient, Credential, CredentialStatus } from '@prisma/client';
import { CreateCredentialDto } from '../dto/credential.dto';

const prisma = new PrismaClient();

export class CredentialRepository {
  // Create a new credential
  async createCredential(data: CreateCredentialDto): Promise<Credential> {
    return prisma.credential.create({
      data: {
        ...data,
        status: CredentialStatus.PENDING,  
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  // Get a credential by ID
  async getCredentialById(credentialId: string): Promise<Credential | null> {
    return prisma.credential.findUnique({
      where: { id: credentialId },
    });
  }

  // Update the status of a credential
  async updateCredentialStatus(credentialId: string, status: string): Promise<Credential> {
    return prisma.credential.update({
      where: { id: credentialId },
      data: { status: CredentialStatus[status as keyof typeof CredentialStatus], updatedAt: new Date() },
    });
  }
}
