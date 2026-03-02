import { ENV } from '../config/env';
import { credentialClient } from '../client/credential.client';
import { analysisRepository } from '../repository/analysis.repository';
import { ANALYZE_JOB_NAME, pgBoss } from '../queue/boss';
import { AiFraudProvider } from '../providers/ai-provider';
import { ManagedProvider } from '../providers/managed.provider';
import { RuleOnlyProvider } from '../providers/rule-only.provider';
import { FraudAnalysisResult } from '../types/analysis';

type AnalyzeReason = 'CREATE' | 'REISSUE' | 'REANALYZE';

const resolveProvider = (): AiFraudProvider => {
  if (ENV.AI_PROVIDER === 'rule_only') {
    return new RuleOnlyProvider();
  }
  if (ENV.AI_PROVIDER === 'ml') {
    const { MlProvider } = require('../providers/ml.provider');
    return new MlProvider();
  }
  return new ManagedProvider();
};

export class AnalysisService {
  private readonly managedProvider = resolveProvider();
  private readonly fallbackProvider = new RuleOnlyProvider();

  async queueAnalyze(credentialId: string, reason: AnalyzeReason): Promise<{ jobId: string }> {
    const created = await analysisRepository.createAnalysisJob(credentialId);
    await pgBoss.send(
      ANALYZE_JOB_NAME,
      {
        jobId: created.id,
        credentialId,
        reason,
      },
      {
        retryLimit: ENV.AI_QUEUE_RETRY_LIMIT,
        retryDelay: ENV.AI_QUEUE_RETRY_DELAY_SECONDS,
        retryBackoff: true,
      },
    );

    return {
      jobId: created.id,
    };
  }

  private async runProviders(credentialId: string): Promise<{
    result: FraudAnalysisResult;
    provider: string;
    raw?: Record<string, unknown>;
  }> {
    const document = await credentialClient.getCredentialDocument(credentialId);
    const input = {
      credentialId: document.credentialId,
      studentId: document.studentId,
      institutionId: document.institutionId,
      title: document.title,
      filename: document.filename,
      mimeType: document.mimeType,
      fileHash: document.fileHash,
      fileBytes: Buffer.from(document.fileBase64, 'base64'),
    };

    try {
      const result = await this.managedProvider.analyze(input);
      return {
        result,
        provider: this.managedProvider.name,
      };
    } catch (error) {
      console.error('Managed provider failed, switching to fallback rule provider:', error);
      const fallback = await this.fallbackProvider.analyze(input);
      return {
        result: fallback,
        provider: this.fallbackProvider.name,
        raw: {
          managedProviderError: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async processAnalyzeJob(jobPayload: { jobId: string; credentialId: string; reason: AnalyzeReason }): Promise<void> {
    const { jobId, credentialId } = jobPayload;
    await analysisRepository.markJobProcessing(jobId);

    try {
      const { result, provider, raw } = await this.runProviders(credentialId);
      await credentialClient.applyAiResult({
        credentialId,
        aiDecision: result.decision,
        aiStatus: result.status,
        aiScore: result.score,
        aiReport: result.report,
        aiSignals: result.signals.map(signal => ({ ...signal })),
        aiModel: result.model,
        aiModelVersion: result.modelVersion,
        aiValidatedAt: new Date().toISOString(),
        provider,
        raw,
      });
      await analysisRepository.markJobCompleted(jobId, result.report.stages, provider);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown AI analysis error';
      await analysisRepository.markJobFailed(jobId, message);

      try {
        await credentialClient.applyAiResult({
          credentialId,
          aiDecision: 'FAILED',
          aiStatus: 'FAILED',
          aiScore: 1,
          aiReport: {
            summary: 'AI analysis failed after retries.',
            stages: {},
          },
          aiSignals: [],
          aiModel: ENV.AI_MODEL,
          aiModelVersion: ENV.AI_MODEL_VERSION,
          aiValidatedAt: new Date().toISOString(),
          provider: 'none',
          error: message,
        });
      } catch (applyError) {
        console.error('Failed applying AI failure result to credential-service:', applyError);
      }

      throw error;
    }
  }

  async applyInternalResult(payload: {
    credentialId: string;
    aiDecision: 'PENDING' | 'CLEAR' | 'REVIEW_REQUIRED' | 'BLOCK' | 'FAILED';
    aiStatus: string;
    aiScore: number;
    aiReport: Record<string, unknown>;
    aiSignals: unknown[];
    aiModel: string;
    aiModelVersion: string;
    aiValidatedAt: string;
    provider: string;
    error?: string;
    raw?: Record<string, unknown>;
  }): Promise<void> {
    await credentialClient.applyAiResult(payload);
  }
}

export const analysisService = new AnalysisService();
