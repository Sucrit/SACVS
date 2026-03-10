import { RiskBand, RiskModelType } from '../../../../db/node_modules/@prisma/client';
import { buildFeatureVector, scoreFeatureVector } from '../feature/feature-builder';
import { RiskRepository } from '../repository/risk.repository';
import { GatewayTelemetryEvent, SourceAuditEvent } from '../types/risk';
import { hashNullable } from '../utils/hash';
import { parseMetadata, pickString } from '../scripts/helpers';

function sliceWindow(events: SourceAuditEvent[], start: Date, end: Date): SourceAuditEvent[] {
  return events.filter((event) => event.createdAt >= start && event.createdAt < end);
}

function sliceTelemetryWindow(
  events: GatewayTelemetryEvent[],
  start: Date,
  end: Date,
): GatewayTelemetryEvent[] {
  return events.filter((event) => event.requestTs >= start && event.requestTs < end);
}

function toRiskBand(value: string): RiskBand {
  switch (value) {
    case 'CRITICAL':
      return RiskBand.CRITICAL;
    case 'HIGH':
      return RiskBand.HIGH;
    case 'MEDIUM':
      return RiskBand.MEDIUM;
    default:
      return RiskBand.LOW;
  }
}

function appendTelemetryIndex(
  map: Map<string, GatewayTelemetryEvent[]>,
  key: string | null | undefined,
  event: GatewayTelemetryEvent,
) {
  if (!key) return;
  const bucket = map.get(key) ?? [];
  bucket.push(event);
  map.set(key, bucket);
}

export type ShadowRiskRunOptions = {
  since: Date;
  modelVersion: string;
  limit?: number;
};

export type ShadowRiskRunResult = {
  scanned: number;
  inserted: number;
  skipped: number;
  latestObservedAt: Date | null;
  inferenceTs: Date;
};

export class ShadowRiskService {
  constructor(private readonly repository = new RiskRepository()) {}

  async run(options: ShadowRiskRunOptions): Promise<ShadowRiskRunResult> {
    const inferenceTs = new Date();
    const [events, telemetryEvents, scoredSet] = await Promise.all([
      this.repository.listAuditLogsSince(options.since, options.limit),
      this.repository.listGatewayTelemetrySince(options.since),
      this.repository.listAlreadyScoredEventIds(options.since),
    ]);
    const actorMap = new Map<string, SourceAuditEvent[]>();
    const telemetryByCorrelationId = new Map<string, GatewayTelemetryEvent[]>();
    const telemetryByActorId = new Map<string, GatewayTelemetryEvent[]>();
    const telemetryByActorIdentityHash = new Map<string, GatewayTelemetryEvent[]>();
    const telemetryByIpHash = new Map<string, GatewayTelemetryEvent[]>();
    const telemetryByUserAgentHash = new Map<string, GatewayTelemetryEvent[]>();

    for (const event of events) {
      if (!event.actorId) continue;
      const bucket = actorMap.get(event.actorId) ?? [];
      bucket.push(event);
      actorMap.set(event.actorId, bucket);
    }

    for (const event of telemetryEvents) {
      appendTelemetryIndex(telemetryByCorrelationId, event.correlationId, event);
      appendTelemetryIndex(telemetryByActorId, event.actorId, event);
      appendTelemetryIndex(telemetryByActorIdentityHash, event.actorIdentityHash, event);
      appendTelemetryIndex(telemetryByIpHash, event.ipHash, event);
      appendTelemetryIndex(telemetryByUserAgentHash, event.userAgentHash, event);
    }

    const modelRef = await this.repository.upsertModelVersion({
      modelVersion: options.modelVersion,
      modelType: RiskModelType.ENSEMBLE,
      description:
        'Shadow-only v1 heuristic scorer matching feature schema for LightGBM+IsolationForest handoff.',
      featureSchema: {
        velocity_1m: 'number',
        velocity_5m: 'number',
        velocity_15m: 'number',
        failure_ratio_15m: 'number',
        stepup_failures_15m: 'number',
        token_abuse_15m: 'number',
        access_denied_15m: 'number',
        unique_targets_15m: 'number',
        actor_age_hours: 'number',
        telemetry_velocity_1m: 'number',
        telemetry_velocity_5m: 'number',
        telemetry_velocity_15m: 'number',
        telemetry_401_15m: 'number',
        telemetry_403_15m: 'number',
        telemetry_429_15m: 'number',
        telemetry_5xx_15m: 'number',
        telemetry_failure_ratio_15m: 'number',
        telemetry_rate_limit_hits_15m: 'number',
        telemetry_unique_routes_15m: 'number',
        telemetry_public_verify_hits_15m: 'number',
        telemetry_avg_duration_15m: 'number',
      },
      metrics: {
        mode: 'shadow',
        note: 'heuristic baseline while supervised + anomaly models are trained offline',
      },
      isActive: false,
    });

    let inserted = 0;
    let skipped = 0;
    let latestObservedAt: Date | null = null;

    for (const event of events) {
      if (scoredSet.has(event.id)) {
        skipped += 1;
        continue;
      }

      const actorEvents = event.actorId ? actorMap.get(event.actorId) ?? [] : [];
      const from1m = new Date(event.createdAt.getTime() - 60_000);
      const from5m = new Date(event.createdAt.getTime() - 5 * 60_000);
      const from15m = new Date(event.createdAt.getTime() - 15 * 60_000);
      const actorEvents1m = sliceWindow(actorEvents, from1m, event.createdAt);
      const actorEvents5m = sliceWindow(actorEvents, from5m, event.createdAt);
      const actorEvents15m = sliceWindow(actorEvents, from15m, event.createdAt);
      const uniqueTargets15m = new Set(
        actorEvents15m.map((item) => item.targetId).filter(Boolean),
      ).size;

      const stepUpStats = event.actorId
        ? await this.repository.getActorStepUpStats(event.actorId, event.createdAt)
        : { challengeCount15m: 0, failedCount15m: 0, lockedCount24h: 0 };
      const actorFirstSeenAt = event.actorId
        ? await this.repository.getActorFirstSeenAt(event.actorId)
        : null;
      const metadata = parseMetadata(event.metadata);
      const ipRaw = pickString(metadata, ['ip', 'usedByIp', 'requestIp']);
      const userAgentRaw = pickString(metadata, ['userAgent']);
      const correlationId = pickString(metadata, ['correlationId', 'x-correlation-id']);
      const institutionId = pickString(metadata, ['institutionId', 'actorInstitutionId']);
      const ipHash = hashNullable(ipRaw);
      const userAgentHash = hashNullable(userAgentRaw);

      const telemetryCandidateMap = new Map<string, GatewayTelemetryEvent>();
      const candidateBuckets = [
        correlationId ? telemetryByCorrelationId.get(correlationId) ?? [] : [],
        event.actorId ? telemetryByActorId.get(event.actorId) ?? [] : [],
        event.actorId ? telemetryByActorIdentityHash.get(hashNullable(event.actorId) ?? '') ?? [] : [],
        ipHash ? telemetryByIpHash.get(ipHash) ?? [] : [],
        userAgentHash ? telemetryByUserAgentHash.get(userAgentHash) ?? [] : [],
      ];

      for (const bucket of candidateBuckets) {
        for (const telemetryEvent of bucket) {
          telemetryCandidateMap.set(telemetryEvent.eventId, telemetryEvent);
        }
      }
      const telemetryActorEvents = Array.from(telemetryCandidateMap.values()).sort(
        (left, right) => left.requestTs.getTime() - right.requestTs.getTime(),
      );
      const telemetryEvents1m = sliceTelemetryWindow(telemetryActorEvents, from1m, event.createdAt);
      const telemetryEvents5m = sliceTelemetryWindow(telemetryActorEvents, from5m, event.createdAt);
      const telemetryEvents15m = sliceTelemetryWindow(telemetryActorEvents, from15m, event.createdAt);
      const uniqueRouteKeys15m = new Set(
        telemetryEvents15m.map((item) => item.routeKey).filter(Boolean),
      ).size;

      const vector = buildFeatureVector({
        event,
        actorEvents1m,
        actorEvents5m,
        actorEvents15m,
        actorStepUpChallengeCount15m: stepUpStats.challengeCount15m,
        actorStepUpFailedCount15m: stepUpStats.failedCount15m,
        actorStepUpLockedCount24h: stepUpStats.lockedCount24h,
        actorFirstSeenAt,
        ipHash,
        userAgentHash,
        uniqueTargets15m,
        telemetryEvents1m,
        telemetryEvents5m,
        telemetryEvents15m,
        uniqueRouteKeys15m,
      });

      const scored = scoreFeatureVector(vector.features, vector.topSignalsSeed);
      const snapshot = await this.repository.createFeatureSnapshot({
        eventId: event.id,
        correlationId,
        actorId: event.actorId,
        actorRole: event.actorRole,
        institutionId,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        ipHash,
        userAgentHash,
        features: vector.features,
        featuresWindowStart: from15m,
        featuresWindowEnd: event.createdAt,
        observedAt: event.createdAt,
      });

      await this.repository.createRiskEventRecord({
        eventId: event.id,
        correlationId,
        actorId: event.actorId,
        action: event.action,
        featuresSnapshotRef: snapshot.id,
        riskScore: scored.riskScore,
        riskBand: toRiskBand(scored.riskBand),
        topSignals: scored.topSignals,
        modelVersion: options.modelVersion,
        modelVersionId: modelRef.id,
        inferenceTs,
      });

      inserted += 1;
      if (!latestObservedAt || event.createdAt > latestObservedAt) {
        latestObservedAt = event.createdAt;
      }
    }

    return {
      scanned: events.length,
      inserted,
      skipped,
      latestObservedAt,
      inferenceTs,
    };
  }
}
