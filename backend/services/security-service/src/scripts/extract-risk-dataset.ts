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

function safeRatio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
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
  const diagnosticsPath = resolveArtifactPath(
    'datasets',
    outputName.replace(/\.csv$/i, '_diagnostics.json'),
  );
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

  const rows: string[] = [];
  const datasetRows: Array<{
    eventId: string;
    eventTs: string;
    weakLabel: number;
    labelSource: string;
    reviewStatus: string;
  }> = [];
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
    'velocity_1h',
    'velocity_24h',
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
    'dormancy_gap_hours',
    'hour_of_day',
    'day_of_week',
    'telemetry_velocity_1m',
    'telemetry_velocity_5m',
    'telemetry_velocity_15m',
    'telemetry_velocity_1h',
    'telemetry_velocity_24h',
    'telemetry_401_15m',
    'telemetry_403_15m',
    'telemetry_429_15m',
    'telemetry_5xx_15m',
    'telemetry_failure_ratio_15m',
    'telemetry_rate_limit_hits_15m',
    'telemetry_unique_routes_15m',
    'telemetry_public_verify_hits_15m',
    'telemetry_avg_duration_15m',
    'telemetry_distinct_ip_hashes_15m',
    'telemetry_distinct_user_agents_15m',
    'telemetry_distinct_ip_hashes_24h',
    'telemetry_distinct_user_agents_24h',
    'institution_active_students_total',
    'institution_age_days',
    'institution_student_creations_30d',
    'institution_credential_issues_30d',
    'institution_request_velocity_30d',
    'institution_notification_broadcasts_30d',
    'institution_days_since_last_activity',
    'institution_credential_to_student_ratio_30d',
    'target_touches_15m',
    'target_verification_count_15m',
    'target_verification_count_1h',
    'target_verification_count_24h',
    'target_verification_failure_count_15m',
    'target_verification_failure_count_1h',
    'target_verification_failure_count_24h',
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
    const from1h = new Date(event.createdAt.getTime() - 60 * 60_000);
    const from24h = new Date(event.createdAt.getTime() - 24 * 60 * 60_000);
    const until15m = new Date(event.createdAt.getTime() + 15 * 60_000);
    const actorEvents1m = sliceWindow(actorEvents, from1m, event.createdAt);
    const actorEvents5m = sliceWindow(actorEvents, from5m, event.createdAt);
    const actorEvents15m = sliceWindow(actorEvents, from15m, event.createdAt);
    const actorEvents1h = sliceWindow(actorEvents, from1h, event.createdAt);
    const actorEvents24h = sliceWindow(actorEvents, from24h, event.createdAt);
    const actorEventsFuture15m = sliceFutureWindow(actorEvents, event.createdAt, until15m);

    const uniqueTargets15m = new Set(actorEvents15m.map((item) => item.targetId).filter(Boolean)).size;

    const metadata = parseMetadata(event.metadata);
    const ipRaw = pickString(metadata, ['ip', 'usedByIp', 'requestIp']);
    const userAgentRaw = pickString(metadata, ['userAgent']);
    const correlationId = pickString(metadata, ['correlationId', 'x-correlation-id']);
    const institutionIdFromMetadata = pickString(metadata, [
      'institutionId',
      'actorInstitutionId',
      'studentInstitutionId',
    ]);
    const ipHash = hashNullable(ipRaw);
    const userAgentHash = hashNullable(userAgentRaw);
    const [stepUpStats, actorFirstSeenAt, actorPreviousEventAt, actorInstitutionId] = event.actorId
      ? await Promise.all([
          repository.getActorStepUpStats(event.actorId, event.createdAt),
          repository.getActorFirstSeenAt(event.actorId),
          repository.getActorPreviousEventAt(event.actorId, event.createdAt),
          repository.getActorInstitutionId(event.actorId),
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
    const [institutionStats, targetStats] = await Promise.all([
      institutionId ? repository.getInstitutionAggregateStats(institutionId, event.createdAt) : Promise.resolve(null),
      event.targetId ? repository.getTargetActivityStats(event.targetId, event.createdAt) : Promise.resolve(null),
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
      uniqueRouteKeys15m: new Set(telemetryEvents15m.map((item) => item.routeKey).filter(Boolean)).size,
      institutionStats,
      targetStats,
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
      vector.features.velocity_1h,
      vector.features.velocity_24h,
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
      vector.features.dormancy_gap_hours,
      vector.features.hour_of_day,
      vector.features.day_of_week,
      vector.features.telemetry_velocity_1m,
      vector.features.telemetry_velocity_5m,
      vector.features.telemetry_velocity_15m,
      vector.features.telemetry_velocity_1h,
      vector.features.telemetry_velocity_24h,
      vector.features.telemetry_401_15m,
      vector.features.telemetry_403_15m,
      vector.features.telemetry_429_15m,
      vector.features.telemetry_5xx_15m,
      vector.features.telemetry_failure_ratio_15m,
      vector.features.telemetry_rate_limit_hits_15m,
      vector.features.telemetry_unique_routes_15m,
      vector.features.telemetry_public_verify_hits_15m,
      vector.features.telemetry_avg_duration_15m,
      vector.features.telemetry_distinct_ip_hashes_15m,
      vector.features.telemetry_distinct_user_agents_15m,
      vector.features.telemetry_distinct_ip_hashes_24h,
      vector.features.telemetry_distinct_user_agents_24h,
      vector.features.institution_active_students_total,
      vector.features.institution_age_days,
      vector.features.institution_student_creations_30d,
      vector.features.institution_credential_issues_30d,
      vector.features.institution_request_velocity_30d,
      vector.features.institution_notification_broadcasts_30d,
      vector.features.institution_days_since_last_activity,
      vector.features.institution_credential_to_student_ratio_30d,
      vector.features.target_touches_15m,
      vector.features.target_verification_count_15m,
      vector.features.target_verification_count_1h,
      vector.features.target_verification_count_24h,
      vector.features.target_verification_failure_count_15m,
      vector.features.target_verification_failure_count_1h,
      vector.features.target_verification_failure_count_24h,
      seedSignals.join('|'),
      labelSource,
      reviewedLabel?.status ?? '',
      reviewedLabel?.reasonCode ?? '',
      weakLabel,
    ]
      .map((value) => csvEscape(value))
      .join(',');

    rows.push(record);
    datasetRows.push({
      eventId: event.id,
      eventTs: event.createdAt.toISOString(),
      weakLabel,
      labelSource,
      reviewStatus: reviewedLabel?.status ?? '',
    });
  }

  fs.writeFileSync(outputPath, rows.join('\n'), 'utf-8');
  const labelSourceCounts = datasetRows.reduce<Record<string, number>>((counts, row) => {
    counts[row.labelSource] = (counts[row.labelSource] ?? 0) + 1;
    return counts;
  }, {});
  const labelCounts = datasetRows.reduce(
    (counts, row) => {
      if (row.weakLabel === 1) counts.positive += 1;
      else counts.negative += 1;
      return counts;
    },
    { positive: 0, negative: 0 },
  );
  const sortedRows = [...datasetRows].sort((left, right) => left.eventTs.localeCompare(right.eventTs));
  const trainEnd = Math.floor(sortedRows.length * 0.7);
  const validEnd = Math.floor(sortedRows.length * 0.85);
  const splitBuckets = {
    train: sortedRows.slice(0, trainEnd),
    valid: sortedRows.slice(trainEnd, validEnd),
    test: sortedRows.slice(validEnd),
  };
  const splitCounts = Object.fromEntries(
    Object.entries(splitBuckets).map(([name, bucket]) => [
      name,
      {
        total: bucket.length,
        positive: bucket.filter((row) => row.weakLabel === 1).length,
        negative: bucket.filter((row) => row.weakLabel === 0).length,
        positiveRate: safeRatio(
          bucket.filter((row) => row.weakLabel === 1).length,
          bucket.length,
        ),
      },
    ]),
  );
  const monthCounts = sortedRows.reduce<Record<string, { total: number; positive: number; negative: number }>>(
    (counts, row) => {
      const month = row.eventTs.slice(0, 7);
      const bucket = counts[month] ?? { total: 0, positive: 0, negative: 0 };
      bucket.total += 1;
      if (row.weakLabel === 1) bucket.positive += 1;
      else bucket.negative += 1;
      counts[month] = bucket;
      return counts;
    },
    {},
  );
  const weekCounts = sortedRows.reduce<Record<string, { total: number; positive: number; negative: number }>>(
    (counts, row) => {
      const eventDate = new Date(row.eventTs);
      const day = eventDate.getUTCDay() || 7;
      eventDate.setUTCDate(eventDate.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(eventDate.getUTCFullYear(), 0, 1));
      const week = Math.ceil((((eventDate.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
      const key = `${eventDate.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
      const bucket = counts[key] ?? { total: 0, positive: 0, negative: 0 };
      bucket.total += 1;
      if (row.weakLabel === 1) bucket.positive += 1;
      else bucket.negative += 1;
      counts[key] = bucket;
      return counts;
    },
    {},
  );
  const diagnostics = {
    generatedAt: new Date().toISOString(),
    lookbackHours,
    outputPath,
    totalRows: datasetRows.length,
    labelCounts,
    labelSourceCounts,
    splitCounts,
    monthCounts,
    weekCounts,
  };
  fs.writeFileSync(diagnosticsPath, JSON.stringify(diagnostics, null, 2), 'utf-8');
  // eslint-disable-next-line no-console
  console.log(
    `Extracted ${events.length} events into ${outputPath} (lookbackHours=${lookbackHours}).`,
  );
  // eslint-disable-next-line no-console
  console.log(`Dataset diagnostics written to ${diagnosticsPath}.`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('dataset:extract failed', error);
  process.exit(1);
});
