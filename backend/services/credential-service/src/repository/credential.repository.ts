import {
  CredentialType,
  CredentialStatus,
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

  async invalidateActiveQrTokens(credentialId: string, studentId: string, now: Date): Promise<number> {
    const result = await prisma.credentialQrToken.updateMany({
      where: {
        credentialId,
        studentId,
        usedAt: null,
        invalidatedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        invalidatedAt: now,
      },
    });
    return result.count;
  }

  async createQrToken(data: {
    credentialId: string;
    studentId: string;
    tokenHash: string;
    allowDocumentPreview?: boolean;
    allowDocumentDownload?: boolean;
    expiresAt: Date;
  }): Promise<{ id: string; expiresAt: Date; allowDocumentPreview: boolean; allowDocumentDownload: boolean }> {
    const created = await prisma.credentialQrToken.create({
      data: {
        credentialId: data.credentialId,
        studentId: data.studentId,
        tokenHash: data.tokenHash,
        allowDocumentPreview: Boolean(data.allowDocumentPreview),
        allowDocumentDownload: Boolean(data.allowDocumentDownload),
        expiresAt: data.expiresAt,
      },
      select: {
        id: true,
        expiresAt: true,
        allowDocumentPreview: true,
        allowDocumentDownload: true,
      },
    });
    return created;
  }

  async consumeQrTokenAtomically(
    tokenHash: string,
    now: Date,
    consumer: {
      consumerType: 'PUBLIC' | 'EMPLOYER';
      consumerId?: string | null;
      ipAddress?: string | null;
    },
  ): Promise<
    | {
        outcome: 'CONSUMED';
        qrTokenId: string;
        credentialId: string;
        allowDocumentPreview: boolean;
        allowDocumentDownload: boolean;
      }
    | {
        outcome: 'INVALID' | 'EXPIRED' | 'USED';
      }
  > {
    return prisma.$transaction(async tx => {
      const candidate = await tx.credentialQrToken.findUnique({
        where: {
          tokenHash,
        },
        select: {
          id: true,
          credentialId: true,
          allowDocumentPreview: true,
          allowDocumentDownload: true,
          expiresAt: true,
          usedAt: true,
          invalidatedAt: true,
        },
      });

      if (!candidate || candidate.invalidatedAt) {
        return { outcome: 'INVALID' as const };
      }

      if (candidate.usedAt) {
        return { outcome: 'USED' as const };
      }

      if (candidate.expiresAt <= now) {
        return { outcome: 'EXPIRED' as const };
      }

      const updated = await tx.credentialQrToken.updateMany({
        where: {
          id: candidate.id,
          usedAt: null,
          invalidatedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          usedAt: now,
          usedByType: consumer.consumerType,
          usedById: consumer.consumerId ?? null,
          usedByIp: consumer.ipAddress ?? null,
        },
      });

      if (updated.count !== 1) {
        return { outcome: 'USED' as const };
      }

      return {
        outcome: 'CONSUMED' as const,
        qrTokenId: candidate.id,
        credentialId: candidate.credentialId,
        allowDocumentPreview: candidate.allowDocumentPreview,
        allowDocumentDownload: candidate.allowDocumentDownload,
      };
    });
  }

  async createQrDocumentToken(data: {
    qrTokenId: string;
    credentialId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<{ id: string; expiresAt: Date }> {
    return prisma.credentialQrDocumentToken.create({
      data: {
        qrTokenId: data.qrTokenId,
        credentialId: data.credentialId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
      select: {
        id: true,
        expiresAt: true,
      },
    });
  }

  async consumeQrDocumentTokenAtomically(
    tokenHash: string,
    now: Date,
    mode: 'preview' | 'download',
    ipAddress?: string | null,
  ): Promise<
    | {
        outcome: 'CONSUMED';
        credentialId: string;
        allowDocumentPreview: boolean;
        allowDocumentDownload: boolean;
      }
    | {
        outcome: 'INVALID' | 'EXPIRED' | 'USED' | 'NOT_ALLOWED';
      }
  > {
    return prisma.$transaction(async tx => {
      const candidate = await tx.credentialQrDocumentToken.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          credentialId: true,
          expiresAt: true,
          usedAt: true,
          qrToken: {
            select: {
              allowDocumentPreview: true,
              allowDocumentDownload: true,
            },
          },
        },
      });

      if (!candidate) {
        return { outcome: 'INVALID' as const };
      }
      if (candidate.usedAt) {
        return { outcome: 'USED' as const };
      }
      if (candidate.expiresAt <= now) {
        return { outcome: 'EXPIRED' as const };
      }
      if (mode === 'preview' && !candidate.qrToken.allowDocumentPreview) {
        return { outcome: 'NOT_ALLOWED' as const };
      }
      if (mode === 'download' && !candidate.qrToken.allowDocumentDownload) {
        return { outcome: 'NOT_ALLOWED' as const };
      }

      const updated = await tx.credentialQrDocumentToken.updateMany({
        where: {
          id: candidate.id,
          usedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          usedAt: now,
          usedByIp: ipAddress ?? null,
        },
      });

      if (updated.count !== 1) {
        return { outcome: 'USED' as const };
      }

      return {
        outcome: 'CONSUMED' as const,
        credentialId: candidate.credentialId,
        allowDocumentPreview: candidate.qrToken.allowDocumentPreview,
        allowDocumentDownload: candidate.qrToken.allowDocumentDownload,
      };
    });
  }

  async getCredentialVerificationView(credentialId: string): Promise<{
    id: string;
    title: string;
    type: CredentialType;
    status: CredentialStatus;
    issuedDate: Date | null;
    expiryDate: Date | null;
    chain: string | null;
    txHash: string | null;
    blockNumber: number | null;
    student: {
      firstName: string;
      middleName: string | null;
      lastName: string;
      email: string;
      profile: {
        studentNumber: string;
      } | null;
    };
    issuedBy: {
      institution: {
        institutionName: string;
      } | null;
      firstName: string;
      lastName: string;
    };
  } | null> {
    return prisma.credential.findUnique({
      where: { id: credentialId },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        issuedDate: true,
        expiryDate: true,
        chain: true,
        txHash: true,
        blockNumber: true,
        student: {
          select: {
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
            profile: {
              select: {
                studentNumber: true,
              },
            },
          },
        },
        issuedBy: {
          select: {
            firstName: true,
            lastName: true,
            institution: {
              select: {
                institutionName: true,
              },
            },
          },
        },
      },
    });
  }
}
