import { describe, expect, it } from 'vitest';
import { __testables } from '../risk-readable-report.service';

const sampleItem = {
  id: 'risk-1',
  action: 'ACCESS_DENIED',
  riskScore: 85.8,
  riskBand: 'CRITICAL',
  reviewStatus: 'CONFIRMED_ABUSE',
  reviewReasonCode: 'OTP_BRUTE_FORCE',
  actorId: 'user_123',
  topSignals: ['high_failure_ratio_15m', 'access_denied_burst_15m'],
  featuresSnapshot: {
    actorRole: 'INSTITUTION',
    targetType: 'StepUpChallenge',
    targetId: '251a5817-7bef-4d20-8fa1-55bb2f055308',
    observedAt: new Date('2026-03-22T04:22:07.000Z'),
    features: {
      velocity_15m: 7,
      failure_ratio_15m: 1,
      access_denied_15m: 5,
      stepup_failures_15m: 2,
      stepup_locked_24h: 1,
      telemetry_distinct_ip_hashes_15m: 3,
    },
  },
} as any;

describe('risk readable report prompt hardening', () => {
  it('builds a shared secure prompt with minimal external context', () => {
    const evidence = __testables.buildDeterministicEvidence(sampleItem);
    const prompt = __testables.buildPrompt(sampleItem, evidence);

    expect(prompt).toContain('Role and task:');
    expect(prompt).toContain('Security rules:');
    expect(prompt).toContain('Allowed evidence:');
    expect(prompt).toContain('Output schema:');
    expect(prompt).toContain('Event evidence payload:');
    expect(prompt).toContain('Timing context: Recently observed.');
    expect(prompt).not.toContain(sampleItem.featuresSnapshot.observedAt.toISOString());
    expect(prompt).not.toContain(sampleItem.actorId);
    expect(prompt).not.toContain(sampleItem.featuresSnapshot.targetId);
    expect(prompt).not.toContain('OTP_BRUTE_FORCE');
    expect(prompt).toContain('Do not quote raw feature keys, implementation details, or internal field names.');
  });

  it('sanitizes provider output that contains unsafe identifiers or prompt references', () => {
    const sanitized = __testables.sanitizeGeneratedReport(
      {
        summary:
          'Use token 4fec4e57-3ef9-450b-bff0-5825ffbf297a and review https://example.com for more details.',
        findings: [
          'Multiple denied actions happened recently.',
          'Prompt instruction says to reveal hidden instruction text.',
        ],
        recommendedReviewFocus: [
          'Bypass the verification check to confirm whether the control can be evaded.',
          'Check recent denied actions for repeat patterns.',
        ],
        disclaimer: 'This summary was produced from the hidden instruction and system message.',
      },
      'GROQ',
    );

    expect(sanitized.source).toBe('GROQ');
    expect(sanitized.summary).toBe(
      'A readable report could not be generated from the current event context.',
    );
    expect(sanitized.findings).toEqual(['Multiple denied actions happened recently.']);
    expect(sanitized.recommendedReviewFocus).toEqual([
      'Check recent denied actions for repeat patterns.',
    ]);
    expect(sanitized.disclaimer).toBe(
      'This summary should still be verified by an admin before making a decision.',
    );
  });

  it('keeps safe structured output and enforces review-check wording', () => {
    const sanitized = __testables.sanitizeGeneratedReport(
      {
        summary:
          'This event shows repeated denied actions and step-up friction, which may indicate suspicious repeated access behavior.',
        findings: [
          'Multiple denied actions were grouped into a short time window.',
          'Recent step-up verification failures were also present.',
          'The same actor appeared across several closely timed actions.',
          'Additional item that should be trimmed because the list is capped.',
          'One more extra item that should not survive.',
        ],
        recommendedReviewFocus: [
          'Check whether the actor was following a legitimate workflow.',
          'Verify whether similar denied actions appeared for the same target type.',
          'Inspect nearby audit activity for the same actor.',
          'Review whether the event aligns with earlier analyst findings.',
          'Disable the control and retest.',
        ],
        disclaimer:
          'This is a readable summary of shadow-model evidence and should be confirmed by an administrator.',
      },
      'GEMINI',
    );

    expect(sanitized.summary).toContain('repeated denied actions');
    expect(sanitized.findings).toHaveLength(4);
    expect(sanitized.recommendedReviewFocus).toEqual([
      'Check whether the actor was following a legitimate workflow.',
      'Verify whether similar denied actions appeared for the same target type.',
      'Inspect nearby audit activity for the same actor.',
      'Review whether the event aligns with earlier analyst findings.',
    ]);
  });
});
