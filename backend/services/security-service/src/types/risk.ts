import { Role, AuditAction } from '../../../../db/node_modules/@prisma/client';

export type NumericFeatureMap = Record<string, number>;

export type SourceAuditEvent = {
  id: string;
  action: AuditAction;
  actorId: string | null;
  actorRole: Role | null;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: Date;
};

export type FeatureContext = {
  event: SourceAuditEvent;
  actorEvents15m: SourceAuditEvent[];
  actorEvents5m: SourceAuditEvent[];
  actorEvents1m: SourceAuditEvent[];
  actorStepUpChallengeCount15m: number;
  actorStepUpFailedCount15m: number;
  actorStepUpLockedCount24h: number;
  actorFirstSeenAt: Date | null;
  ipHash: string | null;
  userAgentHash: string | null;
  uniqueTargets15m: number;
};

export type FeatureVectorResult = {
  features: NumericFeatureMap;
  topSignalsSeed: string[];
  weakLabel: 0 | 1;
};

export type RiskScoreResult = {
  riskScore: number;
  riskBand: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  topSignals: string[];
  modelVersion: string;
  inferenceTs: string;
};
