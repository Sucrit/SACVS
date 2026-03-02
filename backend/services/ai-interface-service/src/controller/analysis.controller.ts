import { Request, Response } from 'express';
import { analysisService } from '../service/analysis.service';

const VALID_DECISIONS = ['PENDING', 'CLEAR', 'REVIEW_REQUIRED', 'BLOCK', 'FAILED'] as const;

export class AnalysisController {
  async queueAnalyze(req: Request, res: Response): Promise<Response> {
    const credentialId =
      typeof req.body?.credentialId === 'string' ? req.body.credentialId.trim() : '';
    const reason = req.body?.reason === 'REISSUE' || req.body?.reason === 'REANALYZE'
      ? req.body.reason
      : 'CREATE';

    if (!credentialId) {
      return res.status(400).json({ error: 'Missing required field: credentialId' });
    }

    try {
      const queued = await analysisService.queueAnalyze(credentialId, reason);
      return res.status(202).json(queued);
    } catch (error) {
      console.error('Failed queueing AI analyze job:', error);
      return res.status(500).json({ error: 'Failed to queue AI analysis job.' });
    }
  }

  async applyInternalResult(req: Request, res: Response): Promise<Response> {
    const credentialId =
      typeof req.body?.credentialId === 'string' ? req.body.credentialId.trim() : '';
    const aiDecision =
      typeof req.body?.aiDecision === 'string' ? req.body.aiDecision.trim() : '';
    const aiStatus = typeof req.body?.aiStatus === 'string' ? req.body.aiStatus.trim() : '';
    const aiScore = typeof req.body?.aiScore === 'number' ? req.body.aiScore : 0;

    if (!credentialId) {
      return res.status(400).json({ error: 'Missing required field: credentialId' });
    }
    if (!aiDecision || !VALID_DECISIONS.includes(aiDecision as (typeof VALID_DECISIONS)[number])) {
      return res.status(400).json({ error: 'Invalid aiDecision value.' });
    }
    if (!aiStatus) {
      return res.status(400).json({ error: 'Missing required field: aiStatus' });
    }

    try {
      await analysisService.applyInternalResult({
        credentialId,
        aiDecision: aiDecision as 'PENDING' | 'CLEAR' | 'REVIEW_REQUIRED' | 'BLOCK' | 'FAILED',
        aiStatus,
        aiScore,
        aiReport: (req.body?.aiReport ?? {}) as Record<string, unknown>,
        aiSignals: (req.body?.aiSignals ?? []) as Array<Record<string, unknown>>,
        aiModel:
          typeof req.body?.aiModel === 'string' ? req.body.aiModel : 'managed-fraud-v1',
        aiModelVersion:
          typeof req.body?.aiModelVersion === 'string' ? req.body.aiModelVersion : 'v1',
        aiValidatedAt:
          typeof req.body?.aiValidatedAt === 'string'
            ? req.body.aiValidatedAt
            : new Date().toISOString(),
        provider:
          typeof req.body?.provider === 'string' ? req.body.provider : 'internal',
        error: typeof req.body?.error === 'string' ? req.body.error : undefined,
        raw: req.body?.raw as Record<string, unknown> | undefined,
      });
      return res.status(200).json({ status: 'ok' });
    } catch (error) {
      console.error('Failed applying AI result via ai-interface-service:', error);
      return res.status(500).json({ error: 'Failed to apply AI result.' });
    }
  }
}

