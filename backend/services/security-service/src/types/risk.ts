import { Role, AuditAction, RiskReviewReasonCode } from '../../../../db/node_modules/@prisma/client';

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
  actorEvents24h: SourceAuditEvent[];
  actorEvents1h: SourceAuditEvent[];
  actorEvents15m: SourceAuditEvent[];
  actorEvents5m: SourceAuditEvent[];
  actorEvents1m: SourceAuditEvent[];
  telemetryEvents24h: GatewayTelemetryEvent[];
  telemetryEvents1h: GatewayTelemetryEvent[];
  telemetryEvents15m: GatewayTelemetryEvent[];
  telemetryEvents5m: GatewayTelemetryEvent[];
  telemetryEvents1m: GatewayTelemetryEvent[];
  actorStepUpChallengeCount15m: number;
  actorStepUpFailedCount15m: number;
  actorStepUpLockedCount24h: number;
  actorFirstSeenAt: Date | null;
  actorPreviousEventAt: Date | null;
  ipHash: string | null;
  userAgentHash: string | null;
  uniqueTargets15m: number;
  uniqueRouteKeys15m: number;
  institutionStats: InstitutionAggregateStats | null;
  targetStats: TargetActivityStats | null;
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

export type GatewayTelemetryEvent = {
  id: string;
  eventId: string;
  correlationId: string | null;
  requestTs: Date;
  routeKey: string;
  routeClass: string;
  method: string;
  statusCode: number;
  durationMs: number;
  rateLimitOutcome: string;
  actorId: string | null;
  actorRole: Role | null;
  actorIdentityHash: string | null;
  ipHash: string | null;
  userAgentHash: string | null;
  is401: boolean;
  is403: boolean;
  is429: boolean;
  is5xx: boolean;
  createdAt: Date;
};

export type ReviewedLabel = {
  status: 'CONFIRMED_ABUSE' | 'BENIGN';
  reasonCode: RiskReviewReasonCode | null;
};

export type InstitutionAggregateStats = {
  institutionId: string;
  activeStudentCount: number;
  institutionAgeDays: number;
  studentCreations30d: number;
  credentialIssues30d: number;
  requestVelocity30d: number;
  notificationBroadcasts30d: number;
  daysSinceLastInstitutionActivity: number | null;
};

export type TargetActivityStats = {
  targetId: string;
  targetTouches15m: number;
  verificationCount15m: number;
  verificationCount1h: number;
  verificationCount24h: number;
  verificationFailureCount15m: number;
  verificationFailureCount1h: number;
  verificationFailureCount24h: number;
};
