import {
  AuditAction,
  AuditSeverity,
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
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
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
  async createAuditLog(data: {
    action: AuditAction;
    actorId?: string | null;
    severity?: AuditSeverity;
    targetType?: string | null;
    targetId?: string | null;
    description?: string | null;
    metadata?: Prisma.InputJsonValue | null;
  }): Promise<void> {
    let actorEmail: string | null = null;
    let actorRole: Role | null = null;

    if (data.actorId) {
      const actor = await prisma.user.findUnique({
        where: { id: data.actorId },
        select: {
          email: true,
          role: true,
        },
      });
      actorEmail = actor?.email ?? null;
      actorRole = actor?.role ?? null;
    }

    await prisma.auditLog.create({
      data: {
        action: data.action,
        severity: data.severity ?? AuditSeverity.INFO,
        actorId: data.actorId ?? null,
        actorEmail,
        actorRole,
        targetType: data.targetType ?? null,
        targetId: data.targetId ?? null,
        description: data.description ?? null,
        metadata: data.metadata ?? undefined,
      },
    });
  }

  async getUserContextById(userId: string): Promise<UserContext | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        firstName: true,
        middleName: true,
        lastName: true,
        email: true,
        institutionId: true,
        employerId: true,
      },
    });
  }

  async listInstitutionNotificationRecipients(institutionId: string): Promise<Array<{ id: string }>> {
    return prisma.user.findMany({
      where: {
        institutionId,
        role: Role.INSTITUTION,
        status: Status.APPROVED,
      },
      select: {
        id: true,
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
