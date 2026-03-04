import {
  AuditAction,
  AuditSeverity,
  CredentialRequest,
  CredentialRequestApprovalReceipt,
  CredentialRequestStatus,
  DeliveryMethod,
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
  deliveryMethod: DeliveryMethod;
  processedAt: Date | null;
  type: string;
  student: {
    institutionId: string | null;
    firstName: string;
    middleName: string | null;
    lastName: string;
    profile: {
      studentNumber: string;
    } | null;
  };
  institution: {
    institutionName: string;
  } | null;
}

export interface ApprovalReceiptVerificationView {
  receiptId: string;
  requestId: string;
  receiptCode: string;
  studentName: string;
  studentNumber: string | null;
  type: string;
  deliveryMethod: DeliveryMethod;
  approvedAt: Date | null;
  institutionName: string;
}

type ReceiptConsumeResult =
  | { outcome: 'INVALID' | 'EXPIRED' | 'USED'; receipt: null }
  | { outcome: 'VALID'; receipt: ApprovalReceiptVerificationView };

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
        deliveryMethod: true,
        processedAt: true,
        type: true,
        student: {
          select: {
            institutionId: true,
            firstName: true,
            middleName: true,
            lastName: true,
            profile: {
              select: {
                studentNumber: true,
              },
            },
          },
        },
        institution: {
          select: {
            institutionName: true,
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

  async invalidateActiveApprovalReceiptsForRequest(requestId: string, now: Date): Promise<number> {
    const result = await prisma.credentialRequestApprovalReceipt.updateMany({
      where: {
        requestId,
        usedAt: null,
        invalidatedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        invalidatedAt: now,
      },
    });
    return result.count;
  }

  async createApprovalReceiptForApprovedRequest(data: {
    requestId: string;
    tokenHash: string;
    receiptCode: string;
    expiresAt: Date;
  }): Promise<{ request: CredentialRequestScope; receipt: CredentialRequestApprovalReceipt }> {
    const now = new Date();
    return prisma.$transaction(async tx => {
      const request = await tx.credentialRequest.findUnique({
        where: { id: data.requestId },
        select: {
          id: true,
          studentId: true,
          credentialId: true,
          requesterId: true,
          status: true,
          institutionId: true,
          employerId: true,
          deliveryMethod: true,
          processedAt: true,
          type: true,
          student: {
            select: {
              institutionId: true,
              firstName: true,
              middleName: true,
              lastName: true,
              profile: {
                select: {
                  studentNumber: true,
                },
              },
            },
          },
          institution: {
            select: {
              institutionName: true,
            },
          },
        },
      });

      if (!request) {
        throw new Error('REQUEST_NOT_FOUND');
      }
      if (request.status !== CredentialRequestStatus.APPROVED) {
        throw new Error('REQUEST_NOT_APPROVED');
      }
      if (request.deliveryMethod === DeliveryMethod.DIGITAL) {
        throw new Error('RECEIPT_NOT_REQUIRED');
      }

      const institutionId = request.institutionId ?? request.student.institutionId;
      if (!institutionId) {
        throw new Error('INSTITUTION_CONTEXT_MISSING');
      }

      await tx.credentialRequestApprovalReceipt.updateMany({
        where: {
          requestId: request.id,
          usedAt: null,
          invalidatedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          invalidatedAt: now,
        },
      });

      const receipt = await tx.credentialRequestApprovalReceipt.create({
        data: {
          requestId: request.id,
          studentId: request.studentId,
          institutionId,
          receiptCode: data.receiptCode,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
        },
      });

      return { request, receipt };
    });
  }

  async consumeApprovalReceiptTokenAtomically(tokenHash: string, now: Date): Promise<ReceiptConsumeResult> {
    return prisma.$transaction(async tx => {
      const candidate = await tx.credentialRequestApprovalReceipt.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          requestId: true,
          receiptCode: true,
          usedAt: true,
          invalidatedAt: true,
          expiresAt: true,
        },
      });

      if (!candidate) {
        return { outcome: 'INVALID', receipt: null };
      }
      if (candidate.invalidatedAt) {
        return { outcome: 'INVALID', receipt: null };
      }
      if (candidate.usedAt) {
        return { outcome: 'USED', receipt: null };
      }
      if (candidate.expiresAt <= now) {
        return { outcome: 'EXPIRED', receipt: null };
      }

      const consumed = await tx.credentialRequestApprovalReceipt.updateMany({
        where: {
          id: candidate.id,
          usedAt: null,
          invalidatedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          usedAt: now,
        },
      });

      if (consumed.count !== 1) {
        return { outcome: 'USED', receipt: null };
      }

      const view = await tx.credentialRequestApprovalReceipt.findUnique({
        where: { id: candidate.id },
        select: {
          id: true,
          requestId: true,
          receiptCode: true,
          request: {
            select: {
              type: true,
              deliveryMethod: true,
              processedAt: true,
              student: {
                select: {
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  profile: {
                    select: {
                      studentNumber: true,
                    },
                  },
                },
              },
              institution: {
                select: {
                  institutionName: true,
                },
              },
            },
          },
        },
      });

      if (!view) {
        return { outcome: 'INVALID', receipt: null };
      }

      const studentName = [
        view.request.student.firstName,
        view.request.student.middleName,
        view.request.student.lastName,
      ]
        .filter(Boolean)
        .join(' ');

      return {
        outcome: 'VALID',
        receipt: {
          receiptId: view.id,
          requestId: view.requestId,
          receiptCode: view.receiptCode,
          studentName,
          studentNumber: view.request.student.profile?.studentNumber ?? null,
          type: view.request.type,
          deliveryMethod: view.request.deliveryMethod,
          approvedAt: view.request.processedAt,
          institutionName: view.request.institution?.institutionName ?? '-',
        },
      };
    });
  }
}
