import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';

export type Credential = Prisma.CredentialGetPayload<{}>;

export class CredentialRepository {
  async create(data: Prisma.CredentialCreateInput): Promise<Credential> {
    return prisma.credential.create({ data });
  }

  async findById(id: string): Promise<Credential | null> {
    return prisma.credential.findUnique({ where: { id } });
  }

  async list(): Promise<Credential[]> {
    return prisma.credential.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async listByUploaderClerkId(uploaderClerkId: string): Promise<Credential[]> {
    return prisma.credential.findMany({
      where: { uploaderClerkId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
