import { ENV } from '../config/env';
import { AiFraudProvider } from './ai-provider';
import { FraudAnalysisInput, FraudAnalysisResult } from '../types/analysis';
import { RuleOnlyProvider } from './rule-only.provider';

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

export class ManagedProvider implements AiFraudProvider {
  readonly name = 'managed_provider';
  private readonly fallback = new RuleOnlyProvider();

  async analyze(input: FraudAnalysisInput): Promise<FraudAnalysisResult> {
    const endpoint = ENV.AI_MANAGED_ENDPOINT?.trim();
    if (!endpoint) {
      throw new Error('MANAGED_PROVIDER_NOT_CONFIGURED');
    }

    const baseline = await this.fallback.analyze(input);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        credentialId: input.credentialId,
        title: input.title,
        filename: input.filename,
        mimeType: input.mimeType,
        fileHash: input.fileHash,
        fileBase64: input.fileBytes.toString('base64'),
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`MANAGED_PROVIDER_FAILED:${response.status}:${responseText}`);
    }

    const managedPayload = (await response.json()) as {
      riskScore?: number;
      summary?: string;
      signals?: Array<{
        signalId: string;
        severity: 'LOW' | 'MEDIUM' | 'HIGH';
        confidence: number;
        evidence: string;
      }>;
      model?: string;
      modelVersion?: string;
    };

    const managedScore = typeof managedPayload.riskScore === 'number'
      ? clamp(managedPayload.riskScore)
      : baseline.score;
    const fusedScore = clamp((baseline.score * 0.4) + (managedScore * 0.6));

    let decision: FraudAnalysisResult['decision'] = 'REVIEW_REQUIRED';
    if (fusedScore < ENV.AI_SCORE_CLEAR_THRESHOLD) {
      decision = 'CLEAR';
    } else if (fusedScore >= ENV.AI_SCORE_BLOCK_THRESHOLD) {
      decision = 'BLOCK';
    }

    return {
      decision,
      score: fusedScore,
      status: decision === 'CLEAR' ? 'AUTO_CLEAR' : 'MANUAL_REVIEW_REQUIRED',
      model: managedPayload.model || ENV.AI_MODEL,
      modelVersion: managedPayload.modelVersion || ENV.AI_MODEL_VERSION,
      signals: [
        ...baseline.signals,
        ...(Array.isArray(managedPayload.signals) ? managedPayload.signals : []),
      ],
      report: {
        summary: managedPayload.summary || baseline.report.summary,
        stages: {
          deterministicChecks: baseline.report.stages,
          managedProvider: {
            endpoint,
            managedScore,
            fusedScore,
          },
        },
      },
    };
  }
}

