import { Prisma, AuditAction, AuditSeverity, Role } from '@prisma/client';
import { prisma } from '../db/prisma';

export type AuditLog = Prisma.AuditLogGetPayload<{}>;

export class AuditLogRepository {
  async create(data: {
    action: AuditAction;
    severity?: AuditSeverity;
    actorId?: string;
    actorEmail?: string;
    actorRole?: Role;
    targetType?: string;
    targetId?: string;
    description?: string;
    metadata?: Prisma.InputJsonValue;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLog> {
    return prisma.auditLog.create({
      data: {
        action: data.action,
        severity: data.severity || AuditSeverity.INFO,
        actorId: data.actorId,
        actorEmail: data.actorEmail,
        actorRole: data.actorRole,
        targetType: data.targetType,
        targetId: data.targetId,
        description: data.description,
        metadata: data.metadata,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  async list(options?: {
    action?: AuditAction;
    severity?: AuditSeverity;
    actorId?: string;
    skip?: number;
    take?: number;
    from?: Date;
    to?: Date;
  }): Promise<{ data: AuditLog[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {};

    if (options?.action) where.action = options.action;
    if (options?.severity) where.severity = options.severity;
    if (options?.actorId) where.actorId = options.actorId;
    if (options?.from || options?.to) {
      where.createdAt = {};
      if (options?.from) where.createdAt.gte = options.from;
      if (options?.to) where.createdAt.lte = options.to;
    }

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: options?.skip,
        take: options?.take,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { data, total };
  }
}
