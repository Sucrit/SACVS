import {
  CredentialRequest,
  CredentialRequestStatus,
  Prisma,
  PrismaClient,
  Role,
  Status,
} from '../../../../db/node_modules/@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ENV } from '../config/env';

if (!ENV.DATABASE_URL) {
  throw new Error('DATABASE_URL is not configured for credential-request-service.');
}

const prismaAdapter = new PrismaPg({ connectionString: ENV.DATABASE_URL });
const prisma = new PrismaClient({ adapter: prismaAdapter });

export interface UserContext {
  id: string;
  role: Role;
  status: Status;
  institutionId: string | null;
  employerId: string | null;
}

export interface CredentialRequestScope {
  id: string;
  studentId: string;
  credentialId: string | null;
  requesterId: string;
  status: CredentialRequestStatus;
  institutionId: string | null;
  employerId: string | null;
  student: {
    institutionId: string | null;
  };
}

export class CredentialRequestRepository {
  async getUserContextById(userId: string): Promise<UserContext | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        institutionId: true,
        employerId: true,
      },
    });
  }

  async listCredentialRequests(
    where: Prisma.CredentialRequestWhereInput,
    skip: number,
    take: number,
  ): Promise<CredentialRequest[]> {
    return prisma.credentialRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async createCredentialRequest(
    data: Prisma.CredentialRequestUncheckedCreateInput,
  ): Promise<CredentialRequest> {
    return prisma.credentialRequest.create({
      data,
    });
  }

  async getCredentialRequestById(id: string): Promise<CredentialRequest | null> {
    return prisma.credentialRequest.findUnique({
      where: { id },
    });
  }

  async getCredentialRequestScopeById(id: string): Promise<CredentialRequestScope | null> {
    return prisma.credentialRequest.findUnique({
      where: { id },
      select: {
        id: true,
        studentId: true,
        credentialId: true,
        requesterId: true,
        status: true,
        institutionId: true,
        employerId: true,
        student: {
          select: {
            institutionId: true,
          },
        },
      },
    });
  }

  async updateCredentialRequestStatus(
    id: string,
    data: Prisma.CredentialRequestUncheckedUpdateInput,
  ): Promise<CredentialRequest> {
    return prisma.credentialRequest.update({
      where: { id },
      data,
    });
  }
}
