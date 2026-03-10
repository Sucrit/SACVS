import { RiskBand, RiskModelType } from '../../../../db/node_modules/@prisma/client';
import { buildFeatureVector, scoreFeatureVector } from '../feature/feature-builder';
import { RiskRepository } from '../repository/risk.repository';
import { SourceAuditEvent } from '../types/risk';
import { hashNullable } from '../utils/hash';
import { parseMetadata, pickString } from '../scripts/helpers';

function sliceWindow(events: SourceAuditEvent[], start: Date, end: Date): SourceAuditEvent[] {
  return events.filter((event) => event.createdAt >= start && event.createdAt < end);
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
    const events = await this.repository.listAuditLogsSince(options.since, options.limit);
    const scoredSet = await this.repository.listAlreadyScoredEventIds(options.since);
    const actorMap = new Map<string, SourceAuditEvent[]>();

    for (const event of events) {
      if (!event.actorId) continue;
      const bucket = actorMap.get(event.actorId) ?? [];
      bucket.push(event);
      actorMap.set(event.actorId, bucket);
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

      const vector = buildFeatureVector({
        event,
        actorEvents1m,
        actorEvents5m,
        actorEvents15m,
        actorStepUpChallengeCount15m: stepUpStats.challengeCount15m,
        actorStepUpFailedCount15m: stepUpStats.failedCount15m,
        actorStepUpLockedCount24h: stepUpStats.lockedCount24h,
        actorFirstSeenAt,
        ipHash: hashNullable(ipRaw),
        userAgentHash: hashNullable(userAgentRaw),
        uniqueTargets15m,
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
        ipHash: hashNullable(ipRaw),
        userAgentHash: hashNullable(userAgentRaw),
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
