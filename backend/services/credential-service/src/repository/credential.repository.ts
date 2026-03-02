import {
  AiDecision,
  AiReviewStatus,
  CredentialType,
  CredentialStatus,
  FraudLabel,
  FraudLabelSource,
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

const credentialWithIssuerInclude = {
  issuedBy: {
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
      institution: {
        select: {
          institutionName: true,
        },
      },
    },
  },
  student: {
    select: {
      id: true,
      institutionId: true,
    },
  },
} satisfies Prisma.CredentialInclude;

type CredentialWithIssuer = Prisma.CredentialGetPayload<{
  include: typeof credentialWithIssuerInclude;
}>;

export class CredentialRepository {
  async listInstitutionReviewerIds(institutionId: string): Promise<Array<{ id: string }>> {
    return prisma.user.findMany({
      where: {
        OR: [
          {
            role: Role.ADMIN,
            status: Status.APPROVED,
          },
          {
            role: Role.INSTITUTION,
            status: Status.APPROVED,
            institutionId,
          },
        ],
      },
      select: {
        id: true,
      },
    });
  }

  async createAuditLog(data: {
    action: Prisma.AuditLogUncheckedCreateInput['action'];
    severity?: Prisma.AuditLogUncheckedCreateInput['severity'];
    actorId?: string | null;
    actorRole?: Prisma.AuditLogUncheckedCreateInput['actorRole'];
    targetType?: string;
    targetId?: string;
    description?: string;
    metadata?: Prisma.InputJsonValue | null;
  }): Promise<void> {
    await prisma.auditLog.create({
      data: {
        action: data.action,
        severity: data.severity ?? 'INFO',
        actorId: data.actorId ?? null,
        actorRole: data.actorRole,
        targetType: data.targetType,
        targetId: data.targetId,
        description: data.description,
        metadata: data.metadata ?? undefined,
      },
    });
  }

  async isStorageKeyRevoked(storageKey: string): Promise<boolean> {
    const revoked = await prisma.credential.findFirst({
      where: {
        storageKey,
        status: CredentialStatus.REVOKED,
      },
      select: {
        id: true,
      },
    });

    return Boolean(revoked);
  }

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
  ): Promise<CredentialWithIssuer[]> {
    return prisma.credential.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: credentialWithIssuerInclude,
    });
  }

  async createCredential(data: Prisma.CredentialUncheckedCreateInput): Promise<CredentialWithIssuer> {
    return prisma.credential.create({
      data,
      include: credentialWithIssuerInclude,
    });
  }

  async getCredentialById(credentialId: string): Promise<CredentialWithIssuer | null> {
    return prisma.credential.findUnique({
      where: { id: credentialId },
      include: credentialWithIssuerInclude,
    });
  }

  async getCredentialScopeById(credentialId: string): Promise<{
    id: string;
    title: string;
    type: CredentialType;
    status: CredentialStatus;
    aiDecision: AiDecision | null;
    aiReviewStatus: AiReviewStatus | null;
    issuedById: string;
    studentId: string;
    fileHash: string | null;
    chain: string | null;
    txHash: string | null;
    blockNumber: number | null;
    anchoredAt: Date | null;
    issuedDate: Date | null;
    expiryDate: Date | null;
    metadata: Prisma.JsonValue | null;
    aiReviewedById: string | null;
    aiReviewedAt: Date | null;
    aiOverrideReason: string | null;
    student: {
      institutionId: string | null;
    };
  } | null> {
    return prisma.credential.findUnique({
      where: { id: credentialId },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        aiDecision: true,
        aiReviewStatus: true,
        issuedById: true,
        studentId: true,
        fileHash: true,
        chain: true,
        txHash: true,
        blockNumber: true,
        anchoredAt: true,
        issuedDate: true,
        expiryDate: true,
        metadata: true,
        aiReviewedById: true,
        aiReviewedAt: true,
        aiOverrideReason: true,
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
  ): Promise<CredentialWithIssuer> {
    return prisma.credential.update({
      where: { id: credentialId },
      data,
      include: credentialWithIssuerInclude,
    });
  }

  async listAiReviewQueue(
    where: Prisma.CredentialWhereInput,
    skip: number,
    take: number,
  ): Promise<CredentialWithIssuer[]> {
    return prisma.credential.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
      include: credentialWithIssuerInclude,
    });
  }

  async createFraudReviewLabel(data: {
    credentialId: string;
    reviewedById: string;
    label: FraudLabel;
    source: FraudLabelSource;
    notes?: string | null;
  }): Promise<void> {
    await prisma.fraudReviewLabel.create({
      data: {
        credentialId: data.credentialId,
        reviewedById: data.reviewedById,
        label: data.label,
        source: data.source,
        notes: data.notes ?? null,
      },
    });
  }

  async getCredentialForAiDocument(credentialId: string): Promise<{
    id: string;
    studentId: string;
    title: string;
    filename: string | null;
    mimeType: string | null;
    storageKey: string | null;
    fileHash: string | null;
    student: {
      institutionId: string | null;
    };
  } | null> {
    return prisma.credential.findUnique({
      where: { id: credentialId },
      select: {
        id: true,
        studentId: true,
        title: true,
        filename: true,
        mimeType: true,
        storageKey: true,
        fileHash: true,
        student: {
          select: {
            institutionId: true,
          },
        },
      },
    });
  }
}
