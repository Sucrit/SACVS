import { Request, Response } from 'express';
import { RiskBand, RiskReviewStatus } from '../../../../db/node_modules/@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { RiskRepository } from '../repository/risk.repository';

const repository = new RiskRepository();

const VALID_RISK_BANDS = new Set<RiskBand>(Object.values(RiskBand));
const VALID_REVIEW_STATUSES = new Set<RiskReviewStatus>(Object.values(RiskReviewStatus));

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

export class RiskController {
  async listRiskEvents(req: Request, res: Response): Promise<Response> {
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = Math.min(parsePositiveInt(req.query.pageSize, 20), 100);
    const riskBandValue = typeof req.query.riskBand === 'string' ? req.query.riskBand : '';
    const reviewStatusValue =
      typeof req.query.reviewStatus === 'string' ? req.query.reviewStatus : '';

    const riskBand = VALID_RISK_BANDS.has(riskBandValue as RiskBand)
      ? (riskBandValue as RiskBand)
      : undefined;
    const reviewStatus = VALID_REVIEW_STATUSES.has(reviewStatusValue as RiskReviewStatus)
      ? (reviewStatusValue as RiskReviewStatus)
      : undefined;

    const result = await repository.listRiskEventRecords({
      page,
      pageSize,
      riskBand,
      reviewStatus,
    });

    return res.json({
      items: result.items.map(item => ({
        id: item.id,
        eventId: item.eventId,
        correlationId: item.correlationId,
        actorId: item.actorId,
        action: item.action,
        riskScore: item.riskScore,
        riskBand: item.riskBand,
        topSignals: Array.isArray(item.topSignals) ? item.topSignals : [],
        modelVersion: item.modelVersion,
        inferenceTs: item.inferenceTs.toISOString(),
        reviewStatus: item.reviewStatus,
        reviewedById: item.reviewedById,
        reviewedAt: item.reviewedAt?.toISOString() ?? null,
        reviewNotes: item.reviewNotes,
        createdAt: item.createdAt.toISOString(),
        actorRole: item.featuresSnapshot.actorRole,
        institutionId: item.featuresSnapshot.institutionId,
        targetType: item.featuresSnapshot.targetType,
        targetId: item.featuresSnapshot.targetId,
        observedAt: item.featuresSnapshot.observedAt.toISOString(),
      })),
      total: result.total,
      page,
      pageSize,
      summary: result.summary,
    });
  }

  async updateRiskReviewStatus(req: Request, res: Response): Promise<Response> {
    const auth = (req as AuthenticatedRequest).auth;
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const reviewStatus =
      typeof req.body?.reviewStatus === 'string' ? req.body.reviewStatus : undefined;
    const reviewNotes =
      typeof req.body?.reviewNotes === 'string' && req.body.reviewNotes.trim().length > 0
        ? req.body.reviewNotes.trim()
        : null;

    if (!auth?.sub) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!id) {
      return res.status(400).json({ error: 'Risk event id is required.' });
    }

    if (!reviewStatus || !VALID_REVIEW_STATUSES.has(reviewStatus as RiskReviewStatus)) {
      return res.status(400).json({ error: 'Invalid reviewStatus value.' });
    }

    const updated = await repository.updateRiskReviewStatus({
      id,
      reviewStatus: reviewStatus as RiskReviewStatus,
      reviewedById: auth.sub,
      reviewNotes,
    });

    return res.json({
      id: updated.id,
      reviewStatus: updated.reviewStatus,
      reviewedById: updated.reviewedById,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      reviewNotes: updated.reviewNotes,
    });
  }
}
