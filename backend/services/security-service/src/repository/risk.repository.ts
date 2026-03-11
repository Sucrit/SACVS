import { PrismaPg } from '@prisma/adapter-pg';
import {
  AuditAction,
  GatewayRequestTelemetry,
  Prisma,
  PrismaClient,
  RiskBand,
  RiskModelType,
  RiskReviewReasonCode,
  RiskReviewStatus,
  Role,
} from '../../../../db/node_modules/@prisma/client';
import { ENV } from '../config/env';
import { GatewayTelemetryEvent, ReviewedLabel, SourceAuditEvent } from '../types/risk';

const prismaAdapter = new PrismaPg({ connectionString: ENV.DATABASE_URL });
const prisma = new PrismaClient({ adapter: prismaAdapter });

const riskEventSelect = {
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
  reviewReasonCode: true,
  reviewReasonDetail: true,
  reviewNotes: true,
  createdAt: true,
  featuresSnapshot: {
    select: {
      id: true,
      actorRole: true,
      institutionId: true,
      targetType: true,
      targetId: true,
      observedAt: true,
      featuresWindowStart: true,
      featuresWindowEnd: true,
      ipHash: true,
      userAgentHash: true,
      features: true,
    },
  },
} satisfies Prisma.RiskEventRecordSelect;

type RiskEventRecordRow = Prisma.RiskEventRecordGetPayload<{ select: typeof riskEventSelect }>;

export type RiskEventListQuery = {
  page: number;
  pageSize: number;
  riskBand?: RiskBand;
  reviewStatus?: RiskReviewStatus;
  reviewedOnly?: boolean;
};

type RiskEventFilterQuery = {
  riskBand?: RiskBand;
  reviewStatus?: RiskReviewStatus;
  reviewedOnly?: boolean;
};

type StepUpStats = {
  challengeCount15m: number;
  failedCount15m: number;
  lockedCount24h: number;
};

export class RiskRepository {
  private readonly riskEventSelect = riskEventSelect;

  private buildRiskEventWhere(query: RiskEventFilterQuery): Prisma.RiskEventRecordWhereInput {
    return {
      ...(query.riskBand ? { riskBand: query.riskBand } : {}),
      ...(query.reviewStatus ? { reviewStatus: query.reviewStatus } : {}),
      ...(query.reviewedOnly && !query.reviewStatus
        ? {
            reviewStatus: {
              in: [
                RiskReviewStatus.CONFIRMED_ABUSE,
                RiskReviewStatus.BENIGN,
                RiskReviewStatus.UNCERTAIN,
              ],
            },
          }
        : {}),
    };
  }

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

  async listAuditLogsSince(since: Date, limit?: number): Promise<SourceAuditEvent[]> {
    const rows = await prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: since,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      ...(typeof limit === 'number' && limit > 0 ? { take: limit } : {}),
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

  async getLatestProcessedObservedAt(): Promise<Date | null> {
    const row = await prisma.riskEventRecord.findFirst({
      orderBy: [{ inferenceTs: 'desc' }, { createdAt: 'desc' }],
      select: {
        featuresSnapshot: {
          select: {
            observedAt: true,
          },
        },
      },
    });

    return row?.featuresSnapshot.observedAt ?? null;
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

  async listReviewedLabelsSince(since: Date): Promise<Map<string, ReviewedLabel>> {
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
        reviewReasonCode: true,
      },
    });

    const labels = new Map<string, ReviewedLabel>();
    for (const row of rows) {
      if (row.eventId && !labels.has(row.eventId)) {
        const status =
          row.reviewStatus === RiskReviewStatus.CONFIRMED_ABUSE
            ? 'CONFIRMED_ABUSE'
            : 'BENIGN';
        labels.set(row.eventId, {
          status,
          reasonCode: row.reviewReasonCode,
        });
      }
    }
    return labels;
  }

  async listGatewayTelemetrySince(since: Date, limit?: number): Promise<GatewayTelemetryEvent[]> {
    const rows = await prisma.gatewayRequestTelemetry.findMany({
      where: {
        requestTs: {
          gte: since,
        },
      },
      orderBy: {
        requestTs: 'asc',
      },
      ...(typeof limit === 'number' && limit > 0 ? { take: limit } : {}),
    });

    return rows.map((row: GatewayRequestTelemetry) => ({
      id: row.id,
      eventId: row.eventId,
      correlationId: row.correlationId,
      requestTs: row.requestTs,
      routeKey: row.routeKey,
      routeClass: row.routeClass,
      method: row.method,
      statusCode: row.statusCode,
      durationMs: row.durationMs,
      rateLimitOutcome: row.rateLimitOutcome,
      actorId: row.actorId,
      actorRole: row.actorRole,
      actorIdentityHash: row.actorIdentityHash,
      ipHash: row.ipHash,
      userAgentHash: row.userAgentHash,
      is401: row.is401,
      is403: row.is403,
      is429: row.is429,
      is5xx: row.is5xx,
      createdAt: row.createdAt,
    }));
  }

  async deleteGatewayTelemetryOlderThan(cutoff: Date): Promise<number> {
    const result = await prisma.gatewayRequestTelemetry.deleteMany({
      where: {
        requestTs: {
          lt: cutoff,
        },
      },
    });

    return result.count;
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
    reviewReasonCode?: RiskReviewReasonCode | null;
    reviewReasonDetail?: string | null;
    reviewNotes?: string | null;
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
        reviewReasonCode: data.reviewReasonCode ?? null,
        reviewReasonDetail: data.reviewReasonDetail ?? null,
        reviewNotes: data.reviewNotes ?? null,
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
    const where = this.buildRiskEventWhere(query);

    const [total, items, pendingReviewCount, highRiskCount, criticalRiskCount, confirmedAbuseCount] =
      await Promise.all([
        prisma.riskEventRecord.count({ where }),
        prisma.riskEventRecord.findMany({
          where,
          orderBy: [{ inferenceTs: 'desc' }, { createdAt: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: this.riskEventSelect,
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

  async getRiskOverviewSummary(): Promise<{
    pendingReviewCount: number;
    highRiskCount: number;
    criticalRiskCount: number;
    confirmedAbuseCount: number;
    highAndCriticalTrendLast7Days: number[];
    recentHighAndCriticalScores: number[];
    recentPendingHighRiskEvents: RiskEventRecordRow[];
  }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const trendCounts = Array.from({ length: 7 }, (_, index) => {
      const dayStart = new Date(todayStart);
      dayStart.setDate(todayStart.getDate() - (6 - index));

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);

      return prisma.riskEventRecord.count({
        where: {
          riskBand: { in: [RiskBand.HIGH, RiskBand.CRITICAL] },
          inferenceTs: {
            gte: dayStart,
            lt: dayEnd,
          },
        },
      });
    });

    const [
      pendingReviewCount,
      highRiskCount,
      criticalRiskCount,
      confirmedAbuseCount,
      recentPendingHighRiskEvents,
      recentHighAndCriticalEvents,
      ...highAndCriticalTrendLast7Days
    ] = await Promise.all([
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
      prisma.riskEventRecord.findMany({
        where: {
          riskBand: { in: [RiskBand.HIGH, RiskBand.CRITICAL] },
          reviewStatus: RiskReviewStatus.PENDING_REVIEW,
        },
        orderBy: [{ inferenceTs: 'desc' }, { createdAt: 'desc' }],
        take: 5,
        select: this.riskEventSelect,
      }),
      prisma.riskEventRecord.findMany({
        where: {
          riskBand: { in: [RiskBand.HIGH, RiskBand.CRITICAL] },
        },
        orderBy: [{ inferenceTs: 'desc' }, { createdAt: 'desc' }],
        take: 7,
        select: {
          riskScore: true,
        },
      }),
      ...trendCounts,
    ]);

    return {
      pendingReviewCount,
      highRiskCount,
      criticalRiskCount,
      confirmedAbuseCount,
      highAndCriticalTrendLast7Days,
      recentHighAndCriticalScores: recentHighAndCriticalEvents
        .map(event => event.riskScore)
        .reverse(),
      recentPendingHighRiskEvents,
    };
  }

  async getRiskEventRecordById(id: string) {
    return prisma.riskEventRecord.findUnique({
      where: { id },
      select: this.riskEventSelect,
    });
  }

  async listReviewedRiskEventRecords(query: RiskEventFilterQuery) {
    const where = {
      ...this.buildRiskEventWhere(query),
      reviewStatus: query.reviewStatus ?? {
        in: [
          RiskReviewStatus.CONFIRMED_ABUSE,
          RiskReviewStatus.BENIGN,
          RiskReviewStatus.UNCERTAIN,
        ],
      },
    } satisfies Prisma.RiskEventRecordWhereInput;

    return prisma.riskEventRecord.findMany({
      where,
      orderBy: [{ reviewedAt: 'desc' }, { inferenceTs: 'desc' }],
      select: this.riskEventSelect,
    });
  }

  async updateRiskReviewStatus(input: {
    id: string;
    reviewStatus: RiskReviewStatus;
    reviewedById: string;
    reviewReasonCode?: RiskReviewReasonCode | null;
    reviewReasonDetail?: string | null;
    reviewNotes?: string | null;
  }) {
    return prisma.riskEventRecord.update({
      where: { id: input.id },
      data: {
        reviewStatus: input.reviewStatus,
        reviewedById: input.reviewedById,
        reviewedAt: new Date(),
        reviewReasonCode: input.reviewReasonCode ?? null,
        reviewReasonDetail: input.reviewReasonDetail ?? null,
        reviewNotes: input.reviewNotes ?? null,
      },
      select: {
        id: true,
        reviewStatus: true,
        reviewedById: true,
        reviewedAt: true,
        reviewReasonCode: true,
        reviewReasonDetail: true,
        reviewNotes: true,
      },
    });
  }
}
