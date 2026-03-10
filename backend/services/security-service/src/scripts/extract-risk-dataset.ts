import fs from 'fs';
import { AuditAction, RiskReviewStatus } from '../../../../db/node_modules/@prisma/client';
import { ENV } from '../config/env';
import { buildFeatureVector } from '../feature/feature-builder';
import { RiskRepository } from '../repository/risk.repository';
import { GatewayTelemetryEvent, SourceAuditEvent } from '../types/risk';
import { hashNullable } from '../utils/hash';
import { csvEscape, parseArgs, parseMetadata, pickString, resolveArtifactPath } from './helpers';

const POSITIVE_WEAK_LABEL_ACTIONS = new Set<AuditAction>([
  AuditAction.ACCESS_DENIED,
  AuditAction.SECURITY_ALERT,
  AuditAction.QR_TOKEN_INVALID,
  AuditAction.QR_TOKEN_EXPIRED,
  AuditAction.REQUEST_RECEIPT_INVALID,
  AuditAction.REQUEST_RECEIPT_EXPIRED,
]);

function sliceWindow(events: SourceAuditEvent[], start: Date, end: Date): SourceAuditEvent[] {
  return events.filter((event) => event.createdAt >= start && event.createdAt < end);
}

function sliceFutureWindow(events: SourceAuditEvent[], start: Date, end: Date): SourceAuditEvent[] {
  return events.filter((event) => event.createdAt > start && event.createdAt <= end);
}

function sliceTelemetryWindow(events: GatewayTelemetryEvent[], start: Date, end: Date): GatewayTelemetryEvent[] {
  return events.filter((event) => event.requestTs >= start && event.requestTs < end);
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

function toActionName(action: AuditAction): string {
  return String(action);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const parsedLookbackHours =
    typeof args.lookbackHours === 'string' ? Number(args.lookbackHours) : NaN;
  const lookbackHours = Number.isFinite(parsedLookbackHours)
    ? parsedLookbackHours
    : ENV.RISK_DATASET_LOOKBACK_HOURS;
  const outputName = args.output ?? `risk_dataset_${new Date().toISOString().slice(0, 10)}.csv`;
  const outputPath = resolveArtifactPath('datasets', outputName);
  const since = new Date(Date.now() - lookbackHours * 60 * 60_000);

  const repository = new RiskRepository();
  const [events, telemetryEvents, reviewedLabels] = await Promise.all([
    repository.listAuditLogsSince(since),
    repository.listGatewayTelemetrySince(since),
    repository.listReviewedLabelsSince(since),
  ]);
  const actorMap = new Map<string, SourceAuditEvent[]>();
  const telemetryByCorrelationId = new Map<string, GatewayTelemetryEvent[]>();
  const telemetryByActorId = new Map<string, GatewayTelemetryEvent[]>();
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
    appendTelemetryIndex(telemetryByIpHash, event.ipHash, event);
    appendTelemetryIndex(telemetryByUserAgentHash, event.userAgentHash, event);
  }

  const rows: string[] = [];
  const headers = [
    'eventId',
    'eventTs',
    'action',
    'actorId',
    'actorRole',
    'targetType',
    'targetId',
    'ipHash',
    'userAgentHash',
    'velocity_1m',
    'velocity_5m',
    'velocity_15m',
    'failures_15m',
    'failure_ratio_15m',
    'token_abuse_15m',
    'access_denied_15m',
    'security_alerts_15m',
    'unique_targets_15m',
    'stepup_challenges_15m',
    'stepup_failures_15m',
    'stepup_locked_24h',
    'actor_age_hours',
    'is_first_seen_actor',
    'hour_of_day',
    'day_of_week',
    'telemetry_velocity_1m',
    'telemetry_velocity_5m',
    'telemetry_velocity_15m',
    'telemetry_401_15m',
    'telemetry_403_15m',
    'telemetry_429_15m',
    'telemetry_5xx_15m',
    'telemetry_failure_ratio_15m',
    'telemetry_rate_limit_hits_15m',
    'telemetry_unique_routes_15m',
    'telemetry_public_verify_hits_15m',
    'telemetry_avg_duration_15m',
    'seedSignals',
    'labelSource',
    'reviewStatus',
    'reviewReasonCode',
    'weakLabel',
  ];

  rows.push(headers.join(','));

  for (const event of events) {
    const actorEvents = event.actorId ? actorMap.get(event.actorId) ?? [] : [];
    const from1m = new Date(event.createdAt.getTime() - 60_000);
    const from5m = new Date(event.createdAt.getTime() - 5 * 60_000);
    const from15m = new Date(event.createdAt.getTime() - 15 * 60_000);
    const until15m = new Date(event.createdAt.getTime() + 15 * 60_000);
    const actorEvents1m = sliceWindow(actorEvents, from1m, event.createdAt);
    const actorEvents5m = sliceWindow(actorEvents, from5m, event.createdAt);
    const actorEvents15m = sliceWindow(actorEvents, from15m, event.createdAt);
    const actorEventsFuture15m = sliceFutureWindow(actorEvents, event.createdAt, until15m);

    const uniqueTargets15m = new Set(actorEvents15m.map((item) => item.targetId).filter(Boolean)).size;

    const stepUpStats = event.actorId
      ? await repository.getActorStepUpStats(event.actorId, event.createdAt)
      : { challengeCount15m: 0, failedCount15m: 0, lockedCount24h: 0 };

    const actorFirstSeenAt = event.actorId ? await repository.getActorFirstSeenAt(event.actorId) : null;
    const metadata = parseMetadata(event.metadata);
    const ipRaw = pickString(metadata, ['ip', 'usedByIp', 'requestIp']);
    const userAgentRaw = pickString(metadata, ['userAgent']);
    const correlationId = pickString(metadata, ['correlationId', 'x-correlation-id']);
    const ipHash = hashNullable(ipRaw);
    const userAgentHash = hashNullable(userAgentRaw);
    const telemetryCandidateMap = new Map<string, GatewayTelemetryEvent>();
    const candidateBuckets = [
      correlationId ? telemetryByCorrelationId.get(correlationId) ?? [] : [],
      event.actorId ? telemetryByActorId.get(event.actorId) ?? [] : [],
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
      uniqueRouteKeys15m: new Set(telemetryEvents15m.map((item) => item.routeKey).filter(Boolean)).size,
    });

    const futurePositiveCount15m = actorEventsFuture15m.filter((item) =>
      POSITIVE_WEAK_LABEL_ACTIONS.has(item.action),
    ).length;
    const seedSignals = vector.topSignalsSeed.slice();
    if (futurePositiveCount15m > 0) {
      seedSignals.push('future_security_followup_15m');
    }
    const reviewedLabel = reviewedLabels.get(event.id) ?? null;

    let weakLabel = vector.weakLabel === 1 || futurePositiveCount15m > 0 ? 1 : 0;
    let labelSource = futurePositiveCount15m > 0 ? 'future_followup' : 'weak_seed';

    if (reviewedLabel?.status === RiskReviewStatus.CONFIRMED_ABUSE) {
      weakLabel = 1;
      labelSource = 'analyst_review';
      seedSignals.push('analyst_confirmed_abuse');
    } else if (reviewedLabel?.status === RiskReviewStatus.BENIGN) {
      weakLabel = 0;
      labelSource = 'analyst_review';
      seedSignals.push('analyst_benign');
    }

    const record = [
      event.id,
      event.createdAt.toISOString(),
      toActionName(event.action),
      event.actorId ?? '',
      event.actorRole ?? '',
      event.targetType ?? '',
      event.targetId ?? '',
      ipHash ?? '',
      userAgentHash ?? '',
      vector.features.velocity_1m,
      vector.features.velocity_5m,
      vector.features.velocity_15m,
      vector.features.failures_15m,
      vector.features.failure_ratio_15m,
      vector.features.token_abuse_15m,
      vector.features.access_denied_15m,
      vector.features.security_alerts_15m,
      vector.features.unique_targets_15m,
      vector.features.stepup_challenges_15m,
      vector.features.stepup_failures_15m,
      vector.features.stepup_locked_24h,
      vector.features.actor_age_hours,
      vector.features.is_first_seen_actor,
      vector.features.hour_of_day,
      vector.features.day_of_week,
      vector.features.telemetry_velocity_1m,
      vector.features.telemetry_velocity_5m,
      vector.features.telemetry_velocity_15m,
      vector.features.telemetry_401_15m,
      vector.features.telemetry_403_15m,
      vector.features.telemetry_429_15m,
      vector.features.telemetry_5xx_15m,
      vector.features.telemetry_failure_ratio_15m,
      vector.features.telemetry_rate_limit_hits_15m,
      vector.features.telemetry_unique_routes_15m,
      vector.features.telemetry_public_verify_hits_15m,
      vector.features.telemetry_avg_duration_15m,
      seedSignals.join('|'),
      labelSource,
      reviewedLabel?.status ?? '',
      reviewedLabel?.reasonCode ?? '',
      weakLabel,
    ]
      .map((value) => csvEscape(value))
      .join(',');

    rows.push(record);
  }

  fs.writeFileSync(outputPath, rows.join('\n'), 'utf-8');
  // eslint-disable-next-line no-console
  console.log(
    `Extracted ${events.length} events into ${outputPath} (lookbackHours=${lookbackHours}).`,
  );
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('dataset:extract failed', error);
  process.exit(1);
});
