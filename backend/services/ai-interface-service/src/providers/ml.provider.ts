import { AiFraudProvider } from './ai-provider';
import { FraudAnalysisInput, FraudAnalysisResult } from '../types/analysis';
import { ENV } from '../config/env';

export class MlProvider implements AiFraudProvider {
  readonly name = 'ml_model';

  async analyze(input: FraudAnalysisInput): Promise<FraudAnalysisResult> {
    const endpoint = ENV.AI_MODEL_SERVICE_URL?.trim();
    if (!endpoint) {
      throw new Error('ML_PROVIDER_NOT_CONFIGURED');
    }

    const response = await fetch(`${endpoint}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      const body = await response.text();
      throw new Error(`ML_PROVIDER_FAILED:${response.status}:${body}`);
    }

    const payload = (await response.json()) as {
      riskScore: number;
      summary: string;
      signals: Array<{ signalId: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; confidence: number; evidence: string }>;
      model: string;
      modelVersion: string;
    };

    return {
      decision: payload.riskScore < ENV.AI_SCORE_CLEAR_THRESHOLD ? 'CLEAR' : payload.riskScore >= ENV.AI_SCORE_BLOCK_THRESHOLD ? 'BLOCK' : 'REVIEW_REQUIRED',
      score: payload.riskScore,
      status: payload.riskScore < ENV.AI_SCORE_CLEAR_THRESHOLD ? 'AUTO_CLEAR' : 'MANUAL_REVIEW_REQUIRED',
      model: payload.model,
      modelVersion: payload.modelVersion,
      signals: payload.signals,
      report: {
        summary: payload.summary,
        stages: { mlModel: { endpoint, score: payload.riskScore } },
      },
    };
  }
}
