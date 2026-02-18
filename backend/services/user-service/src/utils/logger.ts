import { AuditLogRepository } from '../repository/audit.repository';
import { AuditAction, AuditSeverity, Role } from '@prisma/client';

const auditRepo = new AuditLogRepository();

export interface AuditContext {
  actorId?: string;
  actorEmail?: string;
  actorRole?: Role;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(
  action: AuditAction,
  context: AuditContext,
  options?: {
    severity?: AuditSeverity;
    targetType?: string;
    targetId?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await auditRepo.create({
      action,
      severity: options?.severity || AuditSeverity.INFO,
      actorId: context.actorId,
      actorEmail: context.actorEmail,
      actorRole: context.actorRole,
      targetType: options?.targetType,
      targetId: options?.targetId,
      description: options?.description,
      metadata: options?.metadata as any,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  } catch (err) {
    // Audit logging should never crash the main flow
    console.error('[AUDIT] Failed to write audit log:', err);
  }
}

export function logger(service: string) {
  return {
    info: (message: string, meta?: Record<string, unknown>) => {
      console.log(`[${service}] [INFO] ${message}`, meta || '');
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      console.warn(`[${service}] [WARN] ${message}`, meta || '');
    },
    error: (message: string, meta?: Record<string, unknown>) => {
      console.error(`[${service}] [ERROR] ${message}`, meta || '');
    },
  };
}
