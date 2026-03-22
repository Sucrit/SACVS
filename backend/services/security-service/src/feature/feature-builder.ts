import { AuditAction } from '../../../../db/node_modules/@prisma/client';
import { ENV } from '../config/env';
import { FeatureContext, FeatureVectorResult, RiskScoreResult } from '../types/risk';

const FAILURE_ACTIONS = new Set<AuditAction>([
  AuditAction.ACCESS_DENIED,
  AuditAction.SECURITY_ALERT,
  AuditAction.QR_TOKEN_INVALID,
  AuditAction.QR_TOKEN_EXPIRED,
  AuditAction.REQUEST_RECEIPT_INVALID,
  AuditAction.REQUEST_RECEIPT_EXPIRED,
]);

const TOKEN_ABUSE_ACTIONS = new Set<AuditAction>([
  AuditAction.QR_TOKEN_INVALID,
  AuditAction.QR_TOKEN_EXPIRED,
  AuditAction.REQUEST_RECEIPT_INVALID,
  AuditAction.REQUEST_RECEIPT_EXPIRED,
]);

const POSITIVE_WEAK_LABEL_ACTIONS = new Set<AuditAction>([
  AuditAction.ACCESS_DENIED,
  AuditAction.SECURITY_ALERT,
  AuditAction.QR_TOKEN_INVALID,
  AuditAction.QR_TOKEN_EXPIRED,
  AuditAction.REQUEST_RECEIPT_INVALID,
  AuditAction.REQUEST_RECEIPT_EXPIRED,
]);

function clampScore(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value * 100) / 100;
}

export function buildFeatureVector(context: FeatureContext): FeatureVectorResult {
  const total15m = context.actorEvents15m.length;
  const total1h = context.actorEvents1h.length;
  const total24h = context.actorEvents24h.length;
  const failures15m = context.actorEvents15m.filter((event) => FAILURE_ACTIONS.has(event.action)).length;
  const tokenAbuse15m = context.actorEvents15m.filter((event) => TOKEN_ABUSE_ACTIONS.has(event.action)).length;
  const denied15m = context.actorEvents15m.filter((event) => event.action === AuditAction.ACCESS_DENIED).length;
  const securityAlerts15m = context.actorEvents15m.filter(
    (event) => event.action === AuditAction.SECURITY_ALERT,
  ).length;
  const telemetry15m = context.telemetryEvents15m.length;
  const telemetry1h = context.telemetryEvents1h.length;
  const telemetry24h = context.telemetryEvents24h.length;
  const telemetry40115m = context.telemetryEvents15m.filter((event) => event.is401).length;
  const telemetry40315m = context.telemetryEvents15m.filter((event) => event.is403).length;
  const telemetry42915m = context.telemetryEvents15m.filter((event) => event.is429).length;
  const telemetry5xx15m = context.telemetryEvents15m.filter((event) => event.is5xx).length;
  const telemetryRateLimited15m = context.telemetryEvents15m.filter(
    (event) => event.rateLimitOutcome !== 'ALLOWED',
  ).length;
  const telemetryPublicVerify15m = context.telemetryEvents15m.filter(
    (event) => event.routeClass === 'PUBLIC_VERIFY',
  ).length;
  const telemetryAvgDuration15m =
    telemetry15m > 0
      ? context.telemetryEvents15m.reduce((total, event) => total + event.durationMs, 0) / telemetry15m
      : 0;

  const actorAgeHours = context.actorFirstSeenAt
    ? Math.max(0, (context.event.createdAt.getTime() - context.actorFirstSeenAt.getTime()) / 3_600_000)
    : 0;
  const dormancyGapHours = context.actorPreviousEventAt
    ? Math.max(0, (context.event.createdAt.getTime() - context.actorPreviousEventAt.getTime()) / 3_600_000)
    : actorAgeHours;
  const distinctIpHashes15m = new Set(
    context.telemetryEvents15m.map((event) => event.ipHash).filter(Boolean),
  ).size;
  const distinctUserAgents15m = new Set(
    context.telemetryEvents15m.map((event) => event.userAgentHash).filter(Boolean),
  ).size;
  const distinctIpHashes24h = new Set(
    context.telemetryEvents24h.map((event) => event.ipHash).filter(Boolean),
  ).size;
  const distinctUserAgents24h = new Set(
    context.telemetryEvents24h.map((event) => event.userAgentHash).filter(Boolean),
  ).size;
  const institutionStats = context.institutionStats;
  const targetStats = context.targetStats;
  const institutionActiveStudents = institutionStats?.activeStudentCount ?? 0;
  const institutionCredentialIssues30d = institutionStats?.credentialIssues30d ?? 0;
  const institutionRequestVelocity30d = institutionStats?.requestVelocity30d ?? 0;
  const institutionNotificationBroadcasts30d = institutionStats?.notificationBroadcasts30d ?? 0;
  const institutionStudentCreations30d = institutionStats?.studentCreations30d ?? 0;
  const institutionAgeDays = institutionStats?.institutionAgeDays ?? 0;
  const institutionDaysSinceLastActivity = institutionStats?.daysSinceLastInstitutionActivity ?? 0;
  const institutionCredentialToStudentRatio =
    institutionActiveStudents > 0
      ? institutionCredentialIssues30d / institutionActiveStudents
      : institutionCredentialIssues30d;
  const targetTouches15m = targetStats?.targetTouches15m ?? 0;
  const targetVerificationCount15m = targetStats?.verificationCount15m ?? 0;
  const targetVerificationCount1h = targetStats?.verificationCount1h ?? 0;
  const targetVerificationCount24h = targetStats?.verificationCount24h ?? 0;
  const targetVerificationFailureCount15m = targetStats?.verificationFailureCount15m ?? 0;
  const targetVerificationFailureCount1h = targetStats?.verificationFailureCount1h ?? 0;
  const targetVerificationFailureCount24h = targetStats?.verificationFailureCount24h ?? 0;

  const features = {
    velocity_1m: context.actorEvents1m.length,
    velocity_5m: context.actorEvents5m.length,
    velocity_15m: total15m,
    velocity_1h: total1h,
    velocity_24h: total24h,
    failures_15m: failures15m,
    failure_ratio_15m: total15m > 0 ? failures15m / total15m : 0,
    token_abuse_15m: tokenAbuse15m,
    access_denied_15m: denied15m,
    security_alerts_15m: securityAlerts15m,
    unique_targets_15m: context.uniqueTargets15m,
    stepup_challenges_15m: context.actorStepUpChallengeCount15m,
    stepup_failures_15m: context.actorStepUpFailedCount15m,
    stepup_locked_24h: context.actorStepUpLockedCount24h,
    actor_age_hours: actorAgeHours,
    is_first_seen_actor: actorAgeHours <= 1 ? 1 : 0,
    dormancy_gap_hours: dormancyGapHours,
    hour_of_day: context.event.createdAt.getUTCHours(),
    day_of_week: context.event.createdAt.getUTCDay(),
    telemetry_velocity_1m: context.telemetryEvents1m.length,
    telemetry_velocity_5m: context.telemetryEvents5m.length,
    telemetry_velocity_15m: telemetry15m,
    telemetry_velocity_1h: telemetry1h,
    telemetry_velocity_24h: telemetry24h,
    telemetry_401_15m: telemetry40115m,
    telemetry_403_15m: telemetry40315m,
    telemetry_429_15m: telemetry42915m,
    telemetry_5xx_15m: telemetry5xx15m,
    telemetry_failure_ratio_15m:
      telemetry15m > 0 ? (telemetry40115m + telemetry40315m + telemetry42915m + telemetry5xx15m) / telemetry15m : 0,
    telemetry_rate_limit_hits_15m: telemetryRateLimited15m,
    telemetry_unique_routes_15m: context.uniqueRouteKeys15m,
    telemetry_public_verify_hits_15m: telemetryPublicVerify15m,
    telemetry_avg_duration_15m: telemetryAvgDuration15m,
    telemetry_distinct_ip_hashes_15m: distinctIpHashes15m,
    telemetry_distinct_user_agents_15m: distinctUserAgents15m,
    telemetry_distinct_ip_hashes_24h: distinctIpHashes24h,
    telemetry_distinct_user_agents_24h: distinctUserAgents24h,
    institution_active_students_total: institutionActiveStudents,
    institution_age_days: institutionAgeDays,
    institution_student_creations_30d: institutionStudentCreations30d,
    institution_credential_issues_30d: institutionCredentialIssues30d,
    institution_request_velocity_30d: institutionRequestVelocity30d,
    institution_notification_broadcasts_30d: institutionNotificationBroadcasts30d,
    institution_days_since_last_activity: institutionDaysSinceLastActivity,
    institution_credential_to_student_ratio_30d: institutionCredentialToStudentRatio,
    target_touches_15m: targetTouches15m,
    target_verification_count_15m: targetVerificationCount15m,
    target_verification_count_1h: targetVerificationCount1h,
    target_verification_count_24h: targetVerificationCount24h,
    target_verification_failure_count_15m: targetVerificationFailureCount15m,
    target_verification_failure_count_1h: targetVerificationFailureCount1h,
    target_verification_failure_count_24h: targetVerificationFailureCount24h,
  };

  // Weak labels should come from the current security outcome, not the same
  // rolling-window features we train on. Otherwise the model learns a leaked proxy.
  const weakLabel = POSITIVE_WEAK_LABEL_ACTIONS.has(context.event.action) ? 1 : 0;

  const topSignalsSeed: string[] = [];
  if (features.failure_ratio_15m >= 0.5) topSignalsSeed.push('high_failure_ratio_15m');
  if (features.token_abuse_15m >= 3) topSignalsSeed.push('token_abuse_burst_15m');
  if (features.stepup_failures_15m >= 3) topSignalsSeed.push('stepup_verify_failures_15m');
  if (features.access_denied_15m >= 4) topSignalsSeed.push('access_denied_burst_15m');
  if (features.velocity_1m >= 8) topSignalsSeed.push('high_velocity_1m');
  if (features.unique_targets_15m >= 5) topSignalsSeed.push('wide_target_spread_15m');
  if (features.telemetry_429_15m >= 3) topSignalsSeed.push('gateway_rate_limit_hits_15m');
  if (features.telemetry_failure_ratio_15m >= 0.45) topSignalsSeed.push('gateway_failure_ratio_15m');
  if (features.telemetry_unique_routes_15m >= 6) topSignalsSeed.push('wide_route_probe_15m');
  if (features.telemetry_public_verify_hits_15m >= 5) topSignalsSeed.push('public_verify_burst_15m');
  if (features.is_first_seen_actor === 1 && features.velocity_5m >= 6) {
    topSignalsSeed.push('new_actor_high_velocity_5m');
  }
  if (features.institution_age_days >= 30 && features.institution_active_students_total <= 1) {
    topSignalsSeed.push('institution_single_student_long_lived');
  }
  if (
    features.institution_active_students_total <= 2 &&
    features.institution_credential_issues_30d >= 5
  ) {
    topSignalsSeed.push('institution_low_student_high_issuance');
  }
  if (features.dormancy_gap_hours >= 24 * 14 && features.velocity_15m >= 6) {
    topSignalsSeed.push('post_dormancy_spike');
  }
  if (features.target_verification_count_15m >= 3 || features.target_verification_count_1h >= 6) {
    topSignalsSeed.push('verification_burst_anomaly');
  }
  if (
    features.telemetry_distinct_ip_hashes_15m >= 3 &&
    (features.target_verification_count_15m >= 2 || features.telemetry_public_verify_hits_15m >= 5)
  ) {
    topSignalsSeed.push('multi_origin_access_anomaly');
  }
  if (
    features.target_verification_failure_count_15m >= 3 ||
    features.target_verification_failure_count_1h >= 5
  ) {
    topSignalsSeed.push('credential_replay_anomaly');
  }
  if (features.target_touches_15m >= 4 && features.unique_targets_15m <= 1) {
    topSignalsSeed.push('student_request_burst_anomaly');
  }

  return {
    features,
    topSignalsSeed,
    weakLabel,
  };
}

export function scoreFeatureVector(
  features: Record<string, number>,
  topSignalsSeed: string[],
): RiskScoreResult {
  const supervisedRaw =
    features.failure_ratio_15m * 58 +
    Math.min(features.velocity_1m, 12) * 2.5 +
    Math.min(features.velocity_5m, 30) * 1.1 +
    Math.min(features.stepup_failures_15m, 10) * 5 +
    Math.min(features.stepup_locked_24h, 5) * 8 +
    Math.min(features.token_abuse_15m, 8) * 6 +
    Math.min(features.access_denied_15m, 12) * 2.2 +
    Math.min(features.unique_targets_15m, 10) * 1.6 +
    Math.min(features.telemetry_429_15m, 12) * 3 +
    Math.min(features.telemetry_403_15m, 12) * 2 +
    Math.min(features.telemetry_unique_routes_15m, 12) * 1.4 +
    Math.min(features.telemetry_public_verify_hits_15m, 12) * 1.8 +
    Math.min(features.target_verification_count_15m, 8) * 3 +
    Math.min(features.target_verification_failure_count_15m, 8) * 3.5 +
    Math.min(features.telemetry_distinct_ip_hashes_15m, 6) * 2.5 +
    Math.min(features.target_touches_15m, 8) * 1.5;

  const anomalyRaw =
    Math.min(features.velocity_1m / 10, 1) * 35 +
    Math.min(features.velocity_15m / 40, 1) * 20 +
    (features.is_first_seen_actor === 1 ? 20 : 0) +
    Math.min(features.failure_ratio_15m, 1) * 25 +
    Math.min(features.telemetry_velocity_1m / 10, 1) * 20 +
    Math.min(features.telemetry_failure_ratio_15m, 1) * 20 +
    Math.min(features.dormancy_gap_hours / 24, 1) * (features.velocity_15m >= 6 ? 18 : 0) +
    (features.institution_age_days >= 30 && features.institution_active_students_total <= 1 ? 18 : 0) +
    (features.institution_active_students_total <= 2 && features.institution_credential_issues_30d >= 5 ? 22 : 0) +
    (features.target_verification_count_15m >= 3 ? 20 : 0) +
    (features.target_verification_failure_count_15m >= 3 ? 22 : 0) +
    (features.telemetry_distinct_ip_hashes_15m >= 3 ? 15 : 0);

  const blended =
    supervisedRaw * ENV.RISK_SUPERVISED_WEIGHT + anomalyRaw * ENV.RISK_ANOMALY_WEIGHT;
  const riskScore = clampScore(blended);

  let riskBand: RiskScoreResult['riskBand'] = 'LOW';
  if (riskScore >= ENV.RISK_BAND_CRITICAL_THRESHOLD) {
    riskBand = 'CRITICAL';
  } else if (riskScore >= ENV.RISK_BAND_HIGH_THRESHOLD) {
    riskBand = 'HIGH';
  } else if (riskScore >= 40) {
    riskBand = 'MEDIUM';
  }

  return {
    riskScore,
    riskBand,
    topSignals: topSignalsSeed.slice(0, 5),
    modelVersion: 'shadow-heuristic-v1',
    inferenceTs: new Date().toISOString(),
  };
}
