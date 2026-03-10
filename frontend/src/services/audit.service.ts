import { api } from '../api/client';

export type AuditAction =
  | 'USER_CREATED'
  | 'USER_APPROVED'
  | 'USER_REJECTED'
  | 'USER_SUSPENDED'
  | 'USER_DELETED'
  | 'CREDENTIAL_CREATED'
  | 'CREDENTIAL_ISSUED'
  | 'CREDENTIAL_VERIFIED'
  | 'CREDENTIAL_REVOKED'
  | 'CREDENTIAL_REQUESTED'
  | 'CREDENTIAL_REQUEST_APPROVED'
  | 'CREDENTIAL_REQUEST_REJECTED'
  | 'CREDENTIAL_REQUEST_PENDING'
  | 'CREDENTIAL_REQUEST_COMPLETED'
  | 'BLOCKCHAIN_ANCHORED'
  | 'BLOCKCHAIN_ANCHORING_FAILED'
  | 'ROLE_CHANGED'
  | 'ROLE_ASSIGNED'
  | 'ROLE_REMOVED'
  | 'USER_PERMISSIONS_UPDATED'
  | 'CREDENTIAL_REQUEST_VERIFIED'
  | 'CREDENTIAL_VERIFIED_BY_BLOCKCHAIN'
  | 'ACCESS_GRANTED'
  | 'ACCESS_DENIED'
  | 'SUSPICIOUS_ACTIVITY_DETECTED'
  | 'SECURITY_INCIDENT'
  | 'SETTINGS_CHANGED'
  | 'SECURITY_ALERT';

export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AuditActorRole = 'STUDENT' | 'ADMIN' | 'INSTITUTION' | null;

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  severity: AuditSeverity;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: AuditActorRole;
  targetType: string | null;
  targetId: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export const AuditService = {
  list: async () => {
    const response = await api.get<AuditLogEntry[]>('/users/audit');
    return response.data;
  },
};

