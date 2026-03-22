import { Request, Response } from 'express';
import {
  RiskBand,
  Prisma,
  RiskReviewReasonCode,
  RiskReviewStatus,
} from '../../../../db/node_modules/@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { RiskRepository } from '../repository/risk.repository';
import { shadowRiskWorker } from '../runtime/shadow-risk.worker';
import { riskReadableReportService } from '../service/risk-readable-report.service';

const repository = new RiskRepository();

const VALID_RISK_BANDS = new Set<RiskBand>(Object.values(RiskBand));
const VALID_REVIEW_STATUSES = new Set<RiskReviewStatus>(Object.values(RiskReviewStatus));
const VALID_REVIEW_REASON_CODES = new Set<RiskReviewReasonCode>(Object.values(RiskReviewReasonCode));

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
    reviewReasonCode: item.reviewReasonCode,
    reviewReasonDetail: item.reviewReasonDetail,
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
    readableReport: {
      status: item.adminReadableReportStatus,
      generatedAt: item.adminReadableReportGeneratedAt?.toISOString() ?? null,
      model: item.adminReadableReportModel,
      error: item.adminReadableReportError,
      ...(item.adminReadableReport && typeof item.adminReadableReport === 'object' && !Array.isArray(item.adminReadableReport)
        ? item.adminReadableReport
        : {}),
    },
  };
}

export class RiskController {
  private mapError(error: unknown, res: Response): Response | null {
    const map: Record<string, { code: number; error: string }> = {
      INVALID_RISK_EVENT_ID: { code: 400, error: 'Risk event id is required.' },
      INVALID_REVIEW_STATUS: { code: 400, error: 'Invalid reviewStatus value.' },
      INVALID_REVIEW_REASON_CODE: { code: 400, error: 'Invalid reviewReasonCode value.' },
    };

    if (error instanceof Error) {
      const mapped = map[error.message];
      if (mapped) {
        return res.status(mapped.code).json({ error: mapped.error });
      }
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2025'
    ) {
      return res.status(404).json({ error: 'Risk event not found.' });
    }

    return null;
  }

  async getWorkerStatus(_req: Request, res: Response): Promise<Response> {
    const status = shadowRiskWorker.getStatus();

    return res.json({
      autorunEnabled: status.autorunEnabled,
      isRunning: status.isRunning,
      intervalMs: status.intervalMs,
      overlapMinutes: status.overlapMinutes,
      batchLimit: status.batchLimit,
      lastProcessedAt: status.lastProcessedAt?.toISOString() ?? null,
      lastRunStartedAt: status.lastRunStartedAt?.toISOString() ?? null,
      lastRunCompletedAt: status.lastRunCompletedAt?.toISOString() ?? null,
      lastSuccessfulRunAt: status.lastSuccessfulRunAt?.toISOString() ?? null,
      lastFailureAt: status.lastFailureAt?.toISOString() ?? null,
      lastErrorMessage: status.lastErrorMessage,
      lastInsertedCount: status.lastInsertedCount,
      lastScannedCount: status.lastScannedCount,
    });
  }

  async listRiskEvents(req: Request, res: Response): Promise<Response> {
    try {
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
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error listing risk events:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async getRiskEventDetails(req: Request, res: Response): Promise<Response> {
    const id = typeof req.params.id === 'string' ? req.params.id : '';

    if (!id) {
      return res.status(400).json({ error: 'Risk event id is required.' });
    }

    try {
      const item = await repository.getRiskEventRecordById(id);
      if (!item) {
        return res.status(404).json({ error: 'Risk event not found.' });
      }

      return res.json(serializeRiskEvent(item));
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error fetching risk event details:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async regenerateReadableReport(req: Request, res: Response): Promise<Response> {
    const id = typeof req.params.id === 'string' ? req.params.id : '';

    if (!id) {
      return res.status(400).json({ error: 'Risk event id is required.' });
    }

    try {
      const item = await riskReadableReportService.ensureReadableReport(id, { force: true });
      if (!item) {
        return res.status(404).json({ error: 'Risk event not found.' });
      }

      return res.json(serializeRiskEvent(item));
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error regenerating readable risk report:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async exportReviewedRiskEvents(req: Request, res: Response): Promise<Response> {
    try {
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
        'reviewReasonCode',
        'reviewReasonDetail',
        'reviewNotes',
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
            row.reviewReasonCode,
            row.reviewReasonDetail,
            row.reviewNotes,
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
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error exporting reviewed risk events:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
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
    const reviewReasonCode =
      typeof req.body?.reviewReasonCode === 'string' ? req.body.reviewReasonCode : null;
    const reviewReasonDetail =
      typeof req.body?.reviewReasonDetail === 'string' && req.body.reviewReasonDetail.trim().length > 0
        ? req.body.reviewReasonDetail.trim()
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

    if (reviewReasonCode && !VALID_REVIEW_REASON_CODES.has(reviewReasonCode as RiskReviewReasonCode)) {
      return res.status(400).json({ error: 'Invalid reviewReasonCode value.' });
    }

    try {
      const updated = await repository.updateRiskReviewStatus({
        id,
        reviewStatus: reviewStatus as RiskReviewStatus,
        reviewedById: auth.sub,
        reviewReasonCode: (reviewReasonCode as RiskReviewReasonCode | null) ?? null,
        reviewReasonDetail,
        reviewNotes,
      });

      return res.json({
        id: updated.id,
        reviewStatus: updated.reviewStatus,
        reviewedById: updated.reviewedById,
        reviewedAt: updated.reviewedAt?.toISOString() ?? null,
        reviewReasonCode: updated.reviewReasonCode,
        reviewReasonDetail: updated.reviewReasonDetail,
        reviewNotes: updated.reviewNotes,
      });
    } catch (error) {
      const mapped = this.mapError(error, res);
      if (mapped) return mapped;

      console.error('Error updating risk review status:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
