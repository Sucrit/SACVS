import { PrismaPg } from '@prisma/adapter-pg';
import {
  AuditAction,
  Prisma,
  PrismaClient,
  RiskBand,
  RiskModelType,
  RiskReviewStatus,
  Role,
} from '../../../../db/node_modules/@prisma/client';
import { ENV } from '../config/env';
import { SourceAuditEvent } from '../types/risk';

const prismaAdapter = new PrismaPg({ connectionString: ENV.DATABASE_URL });
const prisma = new PrismaClient({ adapter: prismaAdapter });

export type RiskEventListQuery = {
  page: number;
  pageSize: number;
  riskBand?: RiskBand;
  reviewStatus?: RiskReviewStatus;
};

type StepUpStats = {
  challengeCount15m: number;
  failedCount15m: number;
  lockedCount24h: number;
};

export class RiskRepository {
  async getUserAuthContext(userId: string): Promise<{ role: Role; status: string } | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });

    if (!user) {
      return null;
    }

    return {
      role: user.role,
      status: user.status,
    };
  }

  async listAuditLogsSince(since: Date): Promise<SourceAuditEvent[]> {
    const rows = await prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: since,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        action: true,
        actorId: true,
        actorRole: true,
        targetType: true,
        targetId: true,
        metadata: true,
        createdAt: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      actorId: row.actorId,
      actorRole: row.actorRole as Role | null,
      targetType: row.targetType,
      targetId: row.targetId,
      metadata: row.metadata,
      createdAt: row.createdAt,
    }));
  }

  async getActorStepUpStats(actorId: string, eventAt: Date): Promise<StepUpStats> {
    const window15m = new Date(eventAt.getTime() - 15 * 60_000);
    const window24h = new Date(eventAt.getTime() - 24 * 60 * 60_000);

    const [challengeCount15m, failedCount15m, lockedCount24h] = await Promise.all([
      prisma.stepUpChallenge.count({
        where: {
          userId: actorId,
          createdAt: {
            gte: window15m,
            lt: eventAt,
          },
        },
      }),
      prisma.stepUpChallenge.count({
        where: {
          userId: actorId,
          createdAt: {
            gte: window15m,
            lt: eventAt,
          },
          verifiedAt: null,
          attempts: {
            gt: 0,
          },
        },
      }),
      prisma.stepUpChallenge.count({
        where: {
          userId: actorId,
          lockedAt: {
            gte: window24h,
            lt: eventAt,
          },
        },
      }),
    ]);

    return {
      challengeCount15m,
      failedCount15m,
      lockedCount24h,
    };
  }

  async getActorFirstSeenAt(actorId: string): Promise<Date | null> {
    const row = await prisma.auditLog.findFirst({
      where: { actorId },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    return row?.createdAt ?? null;
  }

  async listAlreadyScoredEventIds(since: Date): Promise<Set<string>> {
    const rows = await prisma.riskEventRecord.findMany({
      where: {
        inferenceTs: {
          gte: since,
        },
        eventId: {
          not: null,
        },
      },
      select: {
        eventId: true,
      },
    });

    const ids = new Set<string>();
    for (const row of rows) {
      if (row.eventId) {
        ids.add(row.eventId);
      }
    }
    return ids;
  }

  async listReviewedLabelsSince(since: Date): Promise<Map<string, RiskReviewStatus>> {
    const rows = await prisma.riskEventRecord.findMany({
      where: {
        inferenceTs: {
          gte: since,
        },
        eventId: {
          not: null,
        },
        reviewStatus: {
          in: [RiskReviewStatus.CONFIRMED_ABUSE, RiskReviewStatus.BENIGN],
        },
      },
      orderBy: {
        reviewedAt: 'desc',
      },
      select: {
        eventId: true,
        reviewStatus: true,
      },
    });

    const labels = new Map<string, RiskReviewStatus>();
    for (const row of rows) {
      if (row.eventId && !labels.has(row.eventId)) {
        labels.set(row.eventId, row.reviewStatus);
      }
    }
    return labels;
  }

  async createFeatureSnapshot(data: {
    eventId: string;
    correlationId?: string | null;
    actorId?: string | null;
    actorRole?: Role | null;
    institutionId?: string | null;
    action: AuditAction | string;
    targetType?: string | null;
    targetId?: string | null;
    ipHash?: string | null;
    userAgentHash?: string | null;
    features: Prisma.InputJsonValue;
    featuresWindowStart?: Date | null;
    featuresWindowEnd?: Date | null;
    observedAt: Date;
  }): Promise<{ id: string }> {
    return prisma.riskFeatureSnapshot.create({
      data: {
        eventId: data.eventId,
        correlationId: data.correlationId ?? null,
        actorId: data.actorId ?? null,
        actorRole: data.actorRole ?? null,
        institutionId: data.institutionId ?? null,
        action: String(data.action),
        targetType: data.targetType ?? null,
        targetId: data.targetId ?? null,
        ipHash: data.ipHash ?? null,
        userAgentHash: data.userAgentHash ?? null,
        features: data.features,
        featuresWindowStart: data.featuresWindowStart ?? null,
        featuresWindowEnd: data.featuresWindowEnd ?? null,
        observedAt: data.observedAt,
      },
      select: { id: true },
    });
  }

  async createRiskEventRecord(data: {
    eventId: string;
    correlationId?: string | null;
    actorId?: string | null;
    action: AuditAction | string;
    featuresSnapshotRef: string;
    riskScore: number;
    riskBand: RiskBand;
    topSignals: Prisma.InputJsonValue;
    modelVersion: string;
    modelVersionId?: string | null;
    inferenceTs: Date;
    reviewStatus?: RiskReviewStatus;
  }): Promise<void> {
    await prisma.riskEventRecord.create({
      data: {
        eventId: data.eventId,
        correlationId: data.correlationId ?? null,
        actorId: data.actorId ?? null,
        action: String(data.action),
        featuresSnapshotRef: data.featuresSnapshotRef,
        riskScore: data.riskScore,
        riskBand: data.riskBand,
        topSignals: data.topSignals,
        modelVersion: data.modelVersion,
        modelVersionId: data.modelVersionId ?? null,
        inferenceTs: data.inferenceTs,
        reviewStatus: data.reviewStatus ?? RiskReviewStatus.PENDING_REVIEW,
      },
    });
  }

  async upsertModelVersion(data: {
    modelVersion: string;
    modelType: RiskModelType;
    description?: string | null;
    featureSchema?: Prisma.InputJsonValue | null;
    metrics?: Prisma.InputJsonValue | null;
    artifactPath?: string | null;
    isActive?: boolean;
  }): Promise<{ id: string }> {
    if (data.isActive) {
      await prisma.riskModelVersion.updateMany({
        data: { isActive: false },
        where: { isActive: true },
      });
    }

    return prisma.riskModelVersion.upsert({
      where: { modelVersion: data.modelVersion },
      update: {
        modelType: data.modelType,
        description: data.description ?? null,
        featureSchema: data.featureSchema ?? Prisma.JsonNull,
        metrics: data.metrics ?? Prisma.JsonNull,
        artifactPath: data.artifactPath ?? null,
        isActive: data.isActive ?? false,
      },
      create: {
        modelVersion: data.modelVersion,
        modelType: data.modelType,
        description: data.description ?? null,
        featureSchema: data.featureSchema ?? Prisma.JsonNull,
        metrics: data.metrics ?? Prisma.JsonNull,
        artifactPath: data.artifactPath ?? null,
        isActive: data.isActive ?? false,
      },
      select: {
        id: true,
      },
    });
  }

  async findModelVersion(modelVersion: string): Promise<{ id: string } | null> {
    return prisma.riskModelVersion.findUnique({
      where: { modelVersion },
      select: { id: true },
    });
  }

  async listRiskEventRecords(query: RiskEventListQuery) {
    const where: Prisma.RiskEventRecordWhereInput = {
      ...(query.riskBand ? { riskBand: query.riskBand } : {}),
      ...(query.reviewStatus ? { reviewStatus: query.reviewStatus } : {}),
    };

    const [total, items, pendingReviewCount, highRiskCount, criticalRiskCount, confirmedAbuseCount] =
      await Promise.all([
        prisma.riskEventRecord.count({ where }),
        prisma.riskEventRecord.findMany({
          where,
          orderBy: [{ inferenceTs: 'desc' }, { createdAt: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: {
            id: true,
            eventId: true,
            correlationId: true,
            actorId: true,
            action: true,
            riskScore: true,
            riskBand: true,
            topSignals: true,
            modelVersion: true,
            inferenceTs: true,
            reviewStatus: true,
            reviewedById: true,
            reviewedAt: true,
            reviewNotes: true,
            createdAt: true,
            featuresSnapshot: {
              select: {
                actorRole: true,
                institutionId: true,
                targetType: true,
                targetId: true,
                observedAt: true,
                features: true,
              },
            },
          },
        }),
        prisma.riskEventRecord.count({
          where: { reviewStatus: RiskReviewStatus.PENDING_REVIEW },
        }),
        prisma.riskEventRecord.count({
          where: { riskBand: RiskBand.HIGH },
        }),
        prisma.riskEventRecord.count({
          where: { riskBand: RiskBand.CRITICAL },
        }),
        prisma.riskEventRecord.count({
          where: { reviewStatus: RiskReviewStatus.CONFIRMED_ABUSE },
        }),
      ]);

    return {
      total,
      items,
      summary: {
        pendingReviewCount,
        highRiskCount,
        criticalRiskCount,
        confirmedAbuseCount,
      },
    };
  }

  async updateRiskReviewStatus(input: {
    id: string;
    reviewStatus: RiskReviewStatus;
    reviewedById: string;
    reviewNotes?: string | null;
  }) {
    return prisma.riskEventRecord.update({
      where: { id: input.id },
      data: {
        reviewStatus: input.reviewStatus,
        reviewedById: input.reviewedById,
        reviewedAt: new Date(),
        reviewNotes: input.reviewNotes ?? null,
      },
      select: {
        id: true,
        reviewStatus: true,
        reviewedById: true,
        reviewedAt: true,
        reviewNotes: true,
      },
    });
  }
}
