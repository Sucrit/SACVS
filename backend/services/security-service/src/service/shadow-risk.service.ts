import { NotificationType, RiskBand, RiskModelType } from '../../../../db/node_modules/@prisma/client';
import { notificationClient } from '../client/notification.client';
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

  private shouldNotifyAdmins(riskBand: RiskBand): boolean {
    return riskBand === RiskBand.HIGH || riskBand === RiskBand.CRITICAL;
  }

  private buildRiskNotificationContent(input: {
    riskBand: RiskBand;
    action: string;
    riskScore: number;
  }): { title: string; message: string } {
    const actionLabel = input.action.replaceAll('_', ' ').toLowerCase();
    const scoreLabel = Math.round(input.riskScore);

    if (input.riskBand === RiskBand.CRITICAL) {
      return {
        title: 'Critical risk activity detected',
        message: `A critical-risk event was detected for ${actionLabel} (score: ${scoreLabel}).`,
      };
    }

    return {
      title: 'High risk activity detected',
      message: `A high-risk event was detected for ${actionLabel} (score: ${scoreLabel}).`,
    };
  }

  private async notifyApprovedAdminsAboutRiskEvent(input: {
    riskEventId: string;
    sourceEvent: SourceAuditEvent;
    riskBand: RiskBand;
    riskScore: number;
    action: string;
  }): Promise<void> {
    if (!this.shouldNotifyAdmins(input.riskBand)) {
      return;
    }

    try {
      const recipients = await this.repository.listApprovedAdminNotificationRecipients();
      if (recipients.length === 0) {
        return;
      }

      const content = this.buildRiskNotificationContent({
        riskBand: input.riskBand,
        action: input.action,
        riskScore: input.riskScore,
      });

      await Promise.allSettled(
        recipients.map((recipient) =>
          notificationClient.createSystemNotification({
            userId: recipient.id,
            type: NotificationType.SECURITY_ALERT,
            title: content.title,
            message: content.message,
            metadata: {
              event: 'RISK_EVENT_DETECTED',
              riskEventId: input.riskEventId,
              eventId: input.sourceEvent.id,
              actorId: input.sourceEvent.actorId,
              targetId: input.sourceEvent.targetId,
              action: input.action,
              riskBand: input.riskBand,
              riskScore: input.riskScore,
            },
          }),
        ),
      );
    } catch (error) {
      console.error('[security-service] Failed to notify admins about risk event:', error);
    }
  }

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
        velocity_1h: 'number',
        velocity_24h: 'number',
        failures_15m: 'number',
        failure_ratio_15m: 'number',
        stepup_failures_15m: 'number',
        stepup_challenges_15m: 'number',
        stepup_locked_24h: 'number',
        token_abuse_15m: 'number',
        access_denied_15m: 'number',
        security_alerts_15m: 'number',
        unique_targets_15m: 'number',
        actor_age_hours: 'number',
        is_first_seen_actor: 'number',
        dormancy_gap_hours: 'number',
        hour_of_day: 'number',
        day_of_week: 'number',
        telemetry_velocity_1m: 'number',
        telemetry_velocity_5m: 'number',
        telemetry_velocity_15m: 'number',
        telemetry_velocity_1h: 'number',
        telemetry_velocity_24h: 'number',
        telemetry_401_15m: 'number',
        telemetry_403_15m: 'number',
        telemetry_429_15m: 'number',
        telemetry_5xx_15m: 'number',
        telemetry_failure_ratio_15m: 'number',
        telemetry_rate_limit_hits_15m: 'number',
        telemetry_unique_routes_15m: 'number',
        telemetry_public_verify_hits_15m: 'number',
        telemetry_avg_duration_15m: 'number',
        telemetry_distinct_ip_hashes_15m: 'number',
        telemetry_distinct_user_agents_15m: 'number',
        telemetry_distinct_ip_hashes_24h: 'number',
        telemetry_distinct_user_agents_24h: 'number',
        institution_active_students_total: 'number',
        institution_age_days: 'number',
        institution_student_creations_30d: 'number',
        institution_credential_issues_30d: 'number',
        institution_request_velocity_30d: 'number',
        institution_notification_broadcasts_30d: 'number',
        institution_days_since_last_activity: 'number',
        institution_credential_to_student_ratio_30d: 'number',
        target_touches_15m: 'number',
        target_verification_count_15m: 'number',
        target_verification_count_1h: 'number',
        target_verification_count_24h: 'number',
        target_verification_failure_count_15m: 'number',
        target_verification_failure_count_1h: 'number',
        target_verification_failure_count_24h: 'number',
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
      const from1h = new Date(event.createdAt.getTime() - 60 * 60_000);
      const from24h = new Date(event.createdAt.getTime() - 24 * 60 * 60_000);
      const actorEvents1m = sliceWindow(actorEvents, from1m, event.createdAt);
      const actorEvents5m = sliceWindow(actorEvents, from5m, event.createdAt);
      const actorEvents15m = sliceWindow(actorEvents, from15m, event.createdAt);
      const actorEvents1h = sliceWindow(actorEvents, from1h, event.createdAt);
      const actorEvents24h = sliceWindow(actorEvents, from24h, event.createdAt);
      const uniqueTargets15m = new Set(
        actorEvents15m.map((item) => item.targetId).filter(Boolean),
      ).size;

      const metadata = parseMetadata(event.metadata);
      const ipRaw = pickString(metadata, ['ip', 'usedByIp', 'requestIp']);
      const userAgentRaw = pickString(metadata, ['userAgent']);
      const correlationId = pickString(metadata, ['correlationId', 'x-correlation-id']);
      const ipHash = hashNullable(ipRaw);
      const userAgentHash = hashNullable(userAgentRaw);
      const institutionIdFromMetadata = pickString(metadata, [
        'institutionId',
        'actorInstitutionId',
        'studentInstitutionId',
      ]);
      const [
        stepUpStats,
        actorFirstSeenAt,
        actorPreviousEventAt,
        actorInstitutionId,
      ] = event.actorId
        ? await Promise.all([
            this.repository.getActorStepUpStats(event.actorId, event.createdAt),
            this.repository.getActorFirstSeenAt(event.actorId),
            this.repository.getActorPreviousEventAt(event.actorId, event.createdAt),
            this.repository.getActorInstitutionId(event.actorId),
          ])
        : [
            { challengeCount15m: 0, failedCount15m: 0, lockedCount24h: 0 },
            null,
            null,
            null,
          ];
      const institutionId = institutionIdFromMetadata ?? actorInstitutionId;

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
      const telemetryEvents1h = sliceTelemetryWindow(telemetryActorEvents, from1h, event.createdAt);
      const telemetryEvents24h = sliceTelemetryWindow(telemetryActorEvents, from24h, event.createdAt);
      const uniqueRouteKeys15m = new Set(
        telemetryEvents15m.map((item) => item.routeKey).filter(Boolean),
      ).size;
      const [institutionStats, targetStats] = await Promise.all([
        institutionId
          ? this.repository.getInstitutionAggregateStats(institutionId, event.createdAt)
          : Promise.resolve(null),
        event.targetId
          ? this.repository.getTargetActivityStats(event.targetId, event.createdAt)
          : Promise.resolve(null),
      ]);

      const vector = buildFeatureVector({
        event,
        actorEvents1m,
        actorEvents5m,
        actorEvents15m,
        actorEvents1h,
        actorEvents24h,
        actorStepUpChallengeCount15m: stepUpStats.challengeCount15m,
        actorStepUpFailedCount15m: stepUpStats.failedCount15m,
        actorStepUpLockedCount24h: stepUpStats.lockedCount24h,
        actorFirstSeenAt,
        actorPreviousEventAt,
        ipHash,
        userAgentHash,
        uniqueTargets15m,
        telemetryEvents1m,
        telemetryEvents5m,
        telemetryEvents15m,
        telemetryEvents1h,
        telemetryEvents24h,
        uniqueRouteKeys15m,
        institutionStats,
        targetStats,
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

      const createdRiskEvent = await this.repository.createRiskEventRecord({
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

      await this.notifyApprovedAdminsAboutRiskEvent({
        riskEventId: createdRiskEvent.id,
        sourceEvent: event,
        riskBand: toRiskBand(scored.riskBand),
        riskScore: scored.riskScore,
        action: String(event.action),
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
