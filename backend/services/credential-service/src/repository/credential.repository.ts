import {
  CredentialStatus,
  Credential,
  Prisma,
  PrismaClient,
  Role,
  Status,
} from '../../../../db/node_modules/@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ENV } from '../config/env';

if (!ENV.DATABASE_URL) {
  throw new Error('DATABASE_URL is not configured for credential-service.');
}

const prismaAdapter = new PrismaPg({ connectionString: ENV.DATABASE_URL });
const prisma = new PrismaClient({ adapter: prismaAdapter });

export class CredentialRepository {
  async getStudentContextById(studentId: string): Promise<{
    id: string;
    role: Role;
    status: Status;
    institutionId: string | null;
  } | null> {
    return prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        role: true,
        status: true,
        institutionId: true,
      },
    });
  }

  async listCredentials(
    where: Prisma.CredentialWhereInput,
    skip: number,
    take: number,
  ): Promise<Credential[]> {
    return prisma.credential.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async createCredential(data: Prisma.CredentialUncheckedCreateInput): Promise<Credential> {
    return prisma.credential.create({
      data,
    });
  }

  async getCredentialById(credentialId: string): Promise<Credential | null> {
    return prisma.credential.findUnique({
      where: { id: credentialId },
    });
  }

  async getCredentialScopeById(credentialId: string): Promise<{
    id: string;
    status: CredentialStatus;
    issuedById: string;
    studentId: string;
    issuedDate: Date | null;
    student: {
      institutionId: string | null;
    };
  } | null> {
    return prisma.credential.findUnique({
      where: { id: credentialId },
      select: {
        id: true,
        status: true,
        issuedById: true,
        studentId: true,
        issuedDate: true,
        student: {
          select: {
            institutionId: true,
          },
        },
      },
    });
  }

  async updateCredential(
    credentialId: string,
    data: Prisma.CredentialUncheckedUpdateInput,
  ): Promise<Credential> {
    return prisma.credential.update({
      where: { id: credentialId },
      data,
    });
  }
}
