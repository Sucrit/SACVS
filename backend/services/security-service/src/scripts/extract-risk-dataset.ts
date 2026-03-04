import fs from 'fs';
import { AuditAction } from '../../../../db/node_modules/@prisma/client';
import { ENV } from '../config/env';
import { buildFeatureVector } from '../feature/feature-builder';
import { RiskRepository } from '../repository/risk.repository';
import { SourceAuditEvent } from '../types/risk';
import { hashNullable } from '../utils/hash';
import { csvEscape, parseArgs, parseMetadata, pickString, resolveArtifactPath } from './helpers';

function sliceWindow(events: SourceAuditEvent[], start: Date, end: Date): SourceAuditEvent[] {
  return events.filter((event) => event.createdAt >= start && event.createdAt <= end);
}

function toActionName(action: AuditAction): string {
  return String(action);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const lookbackHours = args.lookbackHours
    ? Number(args.lookbackHours)
    : ENV.RISK_DATASET_LOOKBACK_HOURS;
  const outputName = args.output ?? `risk_dataset_${new Date().toISOString().slice(0, 10)}.csv`;
  const outputPath = resolveArtifactPath(outputName);
  const since = new Date(Date.now() - lookbackHours * 60 * 60_000);

  const repository = new RiskRepository();
  const events = await repository.listAuditLogsSince(since);
  const actorMap = new Map<string, SourceAuditEvent[]>();

  for (const event of events) {
    if (!event.actorId) continue;
    const bucket = actorMap.get(event.actorId) ?? [];
    bucket.push(event);
    actorMap.set(event.actorId, bucket);
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
    'seedSignals',
    'weakLabel',
  ];

  rows.push(headers.join(','));

  for (const event of events) {
    const actorEvents = event.actorId ? actorMap.get(event.actorId) ?? [] : [];
    const from1m = new Date(event.createdAt.getTime() - 60_000);
    const from5m = new Date(event.createdAt.getTime() - 5 * 60_000);
    const from15m = new Date(event.createdAt.getTime() - 15 * 60_000);
    const actorEvents1m = sliceWindow(actorEvents, from1m, event.createdAt);
    const actorEvents5m = sliceWindow(actorEvents, from5m, event.createdAt);
    const actorEvents15m = sliceWindow(actorEvents, from15m, event.createdAt);

    const uniqueTargets15m = new Set(actorEvents15m.map((item) => item.targetId).filter(Boolean)).size;

    const stepUpStats = event.actorId
      ? await repository.getActorStepUpStats(event.actorId, event.createdAt)
      : { challengeCount15m: 0, failedCount15m: 0, lockedCount24h: 0 };

    const actorFirstSeenAt = event.actorId ? await repository.getActorFirstSeenAt(event.actorId) : null;
    const metadata = parseMetadata(event.metadata);
    const ipRaw = pickString(metadata, ['ip', 'usedByIp', 'requestIp']);
    const userAgentRaw = pickString(metadata, ['userAgent']);

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

    const record = [
      event.id,
      event.createdAt.toISOString(),
      toActionName(event.action),
      event.actorId ?? '',
      event.actorRole ?? '',
      event.targetType ?? '',
      event.targetId ?? '',
      hashNullable(ipRaw) ?? '',
      hashNullable(userAgentRaw) ?? '',
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
      vector.topSignalsSeed.join('|'),
      vector.weakLabel,
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
