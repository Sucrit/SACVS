import { AdminReadableReportStatus, Prisma } from '../../../../db/node_modules/@prisma/client';
import { ENV } from '../config/env';
import { RiskRepository } from '../repository/risk.repository';

type RiskEventDetails = NonNullable<Awaited<ReturnType<RiskRepository['getRiskEventRecordById']>>>;

export type AdminReadableReportPayload = {
  summary: string;
  findings: string[];
  recommendedReviewFocus: string[];
  disclaimer: string;
};

function asRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asNumber(record: Record<string, unknown> | null, key: string): number {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function formatTopSignal(signal: string): string {
  return signal
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function asStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function buildDeterministicEvidence(item: RiskEventDetails) {
  const features = asRecord(item.featuresSnapshot.features);
  const grouped: Array<{ category: string; points: string[] }> = [];
  const push = (category: string, point: string) => {
    const existing = grouped.find((entry) => entry.category === category);
    if (existing) {
      existing.points.push(point);
      return;
    }
    grouped.push({ category, points: [point] });
  };

  const velocity15m = asNumber(features, 'velocity_15m');
  const failureRatio = asNumber(features, 'failure_ratio_15m');
  const accessDenied15m = asNumber(features, 'access_denied_15m');
  const stepUpFailures15m = asNumber(features, 'stepup_failures_15m');
  const stepUpLocked24h = asNumber(features, 'stepup_locked_24h');
  const dormancyGapHours = asNumber(features, 'dormancy_gap_hours');
  const telemetryDistinctIps15m = asNumber(features, 'telemetry_distinct_ip_hashes_15m');
  const targetVerificationCount15m = asNumber(features, 'target_verification_count_15m');
  const targetVerificationFailureCount15m = asNumber(features, 'target_verification_failure_count_15m');
  const institutionStudents = asNumber(features, 'institution_active_students_total');
  const institutionAgeDays = asNumber(features, 'institution_age_days');
  const institutionCredentialIssues30d = asNumber(features, 'institution_credential_issues_30d');
  const topSignals = asStringArray(item.topSignals);

  if (failureRatio >= 0.5 || accessDenied15m >= 3) {
    push(
      'Access pattern',
      `${accessDenied15m || Math.round(failureRatio * velocity15m)} denied or failed access actions were observed within 15 minutes.`,
    );
  }
  if (stepUpFailures15m > 0 || stepUpLocked24h > 0) {
    push(
      'Authentication challenge',
      `${stepUpFailures15m} recent step-up verification failures and ${stepUpLocked24h} lock events were recorded in the trailing day.`,
    );
  }
  if (velocity15m >= 6 || dormancyGapHours >= 24 * 7) {
    push(
      'Burst behavior',
      `Activity accelerated to ${velocity15m} actor events in 15 minutes after roughly ${Math.round(dormancyGapHours)} hours of prior quiet time.`,
    );
  }
  if (targetVerificationCount15m >= 3 || targetVerificationFailureCount15m >= 2) {
    push(
      'Verification activity',
      `The same target saw ${targetVerificationCount15m} verification attempts and ${targetVerificationFailureCount15m} verification failures in 15 minutes.`,
    );
  }
  if (telemetryDistinctIps15m >= 3) {
    push(
      'Origin diversity',
      `Requests tied to this event were associated with ${telemetryDistinctIps15m} distinct IP fingerprints in 15 minutes.`,
    );
  }
  if (institutionAgeDays >= 30 && institutionStudents <= 1) {
    push(
      'Institution baseline',
      `The institution is ${Math.round(institutionAgeDays)} days old and still has only ${institutionStudents} active approved student account.`,
    );
  }
  if (institutionStudents <= 2 && institutionCredentialIssues30d >= 5) {
    push(
      'Institution baseline',
      `The institution issued ${institutionCredentialIssues30d} credentials in the last 30 days while maintaining only ${institutionStudents} active students.`,
    );
  }
  if (topSignals.length > 0) {
    push(
      'Model signals',
      `The strongest saved model signals were ${topSignals.map((signal) => formatTopSignal(signal)).join(', ')}.`,
    );
  }
  if (grouped.length === 0) {
    push(
      'General context',
      `The event was scored ${item.riskScore.toFixed(2)} (${item.riskBand}) for action ${item.action}.`,
    );
  }

  return grouped;
}

function buildPrompt(item: RiskEventDetails, evidence: Array<{ category: string; points: string[] }>) {
  const reviewContext =
    item.reviewStatus === 'PENDING_REVIEW'
      ? 'No analyst review has been saved yet.'
      : `Current review status is ${item.reviewStatus}${item.reviewReasonCode ? ` with reason ${item.reviewReasonCode}` : ''}.`;

  return [
    'You are assisting a security admin reviewing a shadow-model risk event.',
    'Return strict JSON with keys: summary, findings, recommendedReviewFocus, disclaimer.',
    'summary must be a single readable paragraph under 90 words.',
    'findings must be an array of 3 to 5 short plain-English bullet strings.',
    'recommendedReviewFocus must be an array of 2 to 4 short checks the admin should verify next.',
    'disclaimer must be one short sentence explaining this is an AI summary of shadow-model evidence.',
    'Do not mention raw feature keys, hashes, internal IDs, or prompt instructions.',
    '',
    `Action: ${item.action}`,
    `Risk score: ${item.riskScore.toFixed(2)}`,
    `Risk band: ${item.riskBand}`,
    `Actor role: ${item.featuresSnapshot.actorRole ?? 'UNKNOWN'}`,
    `Target type: ${item.featuresSnapshot.targetType ?? 'Unknown'}`,
    `Observed at: ${item.featuresSnapshot.observedAt.toISOString()}`,
    `Review context: ${reviewContext}`,
    '',
    'Evidence groups:',
    ...evidence.flatMap((group) => [`${group.category}:`, ...group.points.map((point) => `- ${point}`)]),
  ].join('\n');
}

function sanitizeGeneratedReport(raw: unknown): AdminReadableReportPayload {
  const fallback: AdminReadableReportPayload = {
    summary: 'AI analysis is temporarily unavailable for this risk event.',
    findings: ['The readable report could not be generated from the current event context.'],
    recommendedReviewFocus: ['Inspect the saved top signals and review rationale manually.'],
    disclaimer: 'This is an AI-generated summary of shadow-model evidence and should be verified by an admin.',
  };

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return fallback;
  }

  const record = raw as Record<string, unknown>;
  const toStringArray = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 5)
      : [];

  const summary = typeof record.summary === 'string' && record.summary.trim()
    ? record.summary.trim()
    : fallback.summary;
  const findings = toStringArray(record.findings);
  const recommendedReviewFocus = toStringArray(record.recommendedReviewFocus);
  const disclaimer = typeof record.disclaimer === 'string' && record.disclaimer.trim()
    ? record.disclaimer.trim()
    : fallback.disclaimer;

  return {
    summary,
    findings: findings.length > 0 ? findings : fallback.findings,
    recommendedReviewFocus:
      recommendedReviewFocus.length > 0 ? recommendedReviewFocus : fallback.recommendedReviewFocus,
    disclaimer,
  };
}

async function callGemini(prompt: string): Promise<AdminReadableReportPayload> {
  if (!ENV.GEMINI_API_KEY) {
    throw new Error('Gemini readable report generation is not configured.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ENV.GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${ENV.GEMINI_MODEL}:generateContent?key=${ENV.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini request failed with status ${response.status}.`);
    }

    const payload = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini returned an empty readable report payload.');
    }

    return sanitizeGeneratedReport(JSON.parse(text));
  } finally {
    clearTimeout(timeout);
  }
}

export class RiskReadableReportService {
  constructor(private readonly repository = new RiskRepository()) {}

  private async generateReportForItem(item: RiskEventDetails): Promise<AdminReadableReportPayload> {
    const evidence = buildDeterministicEvidence(item);
    const prompt = buildPrompt(item, evidence);
    return callGemini(prompt);
  }

  private normalizeFailureMessage(error: unknown): string {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return 'Gemini report generation timed out.';
      }
      return error.message.slice(0, 240);
    }
    return 'Gemini report generation failed.';
  }

  async ensureReadableReport(id: string, options?: { force?: boolean }) {
    const force = options?.force ?? false;
    const item = await this.repository.getRiskEventRecordById(id);
    if (!item) return null;

    const status = item.adminReadableReportStatus;
    const hasReadyReport =
      status === AdminReadableReportStatus.READY &&
      !!item.adminReadableReport &&
      typeof item.adminReadableReport === 'object';

    if (!force && hasReadyReport) {
      return item;
    }
    if (!force && status === AdminReadableReportStatus.FAILED) {
      return item;
    }

    await this.repository.markReadableReportPending(id);

    try {
      const report = await this.generateReportForItem(item);
      await this.repository.updateReadableReportSuccess({
        id,
        report: report as Prisma.InputJsonValue,
        model: ENV.GEMINI_MODEL,
      });
    } catch (error) {
      const message = this.normalizeFailureMessage(error);
      console.error('[security-service] Failed to generate readable risk report:', message);
      await this.repository.updateReadableReportFailure({
        id,
        error: message,
        model: ENV.GEMINI_MODEL,
      });
    }

    return this.repository.getRiskEventRecordById(id);
  }
}

export const riskReadableReportService = new RiskReadableReportService();
