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

function parseRiskFilters(req: Request): {
  riskBand?: RiskBand;
  reviewStatus?: RiskReviewStatus;
  reviewedOnly: boolean;
} {
  const riskBandValue = typeof req.query.riskBand === 'string' ? req.query.riskBand : '';
  const reviewStatusValue =
    typeof req.query.reviewStatus === 'string' ? req.query.reviewStatus : '';
  const reviewedOnly =
    typeof req.query.reviewedOnly === 'string' && req.query.reviewedOnly.toLowerCase() === 'true';

  return {
    riskBand: VALID_RISK_BANDS.has(riskBandValue as RiskBand)
      ? (riskBandValue as RiskBand)
      : undefined,
    reviewStatus: VALID_REVIEW_STATUSES.has(reviewStatusValue as RiskReviewStatus)
      ? (reviewStatusValue as RiskReviewStatus)
      : undefined,
    reviewedOnly,
  };
}

function serializeRiskEvent(item: Awaited<ReturnType<RiskRepository['getRiskEventRecordById']>>) {
  if (!item) {
    return null;
  }

  return {
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
    featuresWindowStart: item.featuresSnapshot.featuresWindowStart?.toISOString() ?? null,
    featuresWindowEnd: item.featuresSnapshot.featuresWindowEnd?.toISOString() ?? null,
    ipHash: item.featuresSnapshot.ipHash,
    userAgentHash: item.featuresSnapshot.userAgentHash,
    featureSnapshotId: item.featuresSnapshot.id,
    features: item.featuresSnapshot.features,
  };
}

export class RiskController {
  async listRiskEvents(req: Request, res: Response): Promise<Response> {
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = Math.min(parsePositiveInt(req.query.pageSize, 20), 100);
    const { riskBand, reviewStatus, reviewedOnly } = parseRiskFilters(req);

    const result = await repository.listRiskEventRecords({
      page,
      pageSize,
      riskBand,
      reviewStatus,
      reviewedOnly,
    });

    return res.json({
      items: result.items.map(item => serializeRiskEvent(item)),
      total: result.total,
      page,
      pageSize,
      summary: result.summary,
    });
  }

  async getRiskEventDetails(req: Request, res: Response): Promise<Response> {
    const id = typeof req.params.id === 'string' ? req.params.id : '';

    if (!id) {
      return res.status(400).json({ error: 'Risk event id is required.' });
    }

    const item = await repository.getRiskEventRecordById(id);
    if (!item) {
      return res.status(404).json({ error: 'Risk event not found.' });
    }

    return res.json(serializeRiskEvent(item));
  }

  async exportReviewedRiskEvents(req: Request, res: Response): Promise<Response> {
    const { riskBand, reviewStatus, reviewedOnly } = parseRiskFilters(req);
    const rows = await repository.listReviewedRiskEventRecords({
      riskBand,
      reviewStatus,
      reviewedOnly,
    });

    const header = [
      'id',
      'eventId',
      'correlationId',
      'actorId',
      'actorRole',
      'action',
      'riskScore',
      'riskBand',
      'reviewStatus',
      'reviewedById',
      'reviewedAt',
      'modelVersion',
      'targetType',
      'targetId',
      'institutionId',
      'observedAt',
      'topSignals',
    ];

    const escapeCsv = (value: unknown) => {
      if (value === null || value === undefined) {
        return '';
      }
      const stringValue = Array.isArray(value) ? value.join(' | ') : String(value);
      if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const lines = [
      header.join(','),
      ...rows.map(row =>
        [
          row.id,
          row.eventId,
          row.correlationId,
          row.actorId,
          row.featuresSnapshot.actorRole,
          row.action,
          row.riskScore.toFixed(2),
          row.riskBand,
          row.reviewStatus,
          row.reviewedById,
          row.reviewedAt?.toISOString() ?? '',
          row.modelVersion,
          row.featuresSnapshot.targetType,
          row.featuresSnapshot.targetId,
          row.featuresSnapshot.institutionId,
          row.featuresSnapshot.observedAt.toISOString(),
          Array.isArray(row.topSignals) ? row.topSignals : [],
        ]
          .map(escapeCsv)
          .join(','),
      ),
    ];

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="risk-review-report-${stamp}.csv"`,
    );

    return res.send(lines.join('\n'));
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
