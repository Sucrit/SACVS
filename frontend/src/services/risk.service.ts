import { api } from '../api/client';

export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RiskReviewStatus = 'PENDING_REVIEW' | 'CONFIRMED_ABUSE' | 'BENIGN' | 'UNCERTAIN';
export type RiskActorRole = 'STUDENT' | 'ADMIN' | 'EMPLOYER' | 'INSTITUTION' | null;
export type RiskReviewReasonCode =
  | 'OTP_BRUTE_FORCE'
  | 'TOKEN_ABUSE'
  | 'RATE_LIMIT_ABUSE'
  | 'CROSS_SCOPE_ACCESS'
  | 'PRIVILEGE_MISUSE'
  | 'AUTOMATED_PROBING'
  | 'SUSPICIOUS_BULK_ACTIVITY'
  | 'OTHER_ABUSE'
  | 'USER_MISTAKE'
  | 'TEST_ACTIVITY'
  | 'EXPECTED_ADMIN_ACTION'
  | 'EXPECTED_INSTITUTION_FLOW'
  | 'FALSE_POSITIVE_PATTERN'
  | 'OTHER_BENIGN'
  | 'NEEDS_MORE_CONTEXT'
  | 'INSUFFICIENT_EVIDENCE'
  | 'MIXED_SIGNALS';

export interface RiskEventRecord {
  id: string;
  eventId: string | null;
  correlationId: string | null;
  actorId: string | null;
  action: string;
  riskScore: number;
  riskBand: RiskBand;
  topSignals: string[];
  modelVersion: string;
  inferenceTs: string;
  reviewStatus: RiskReviewStatus;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewReasonCode: RiskReviewReasonCode | null;
  reviewReasonDetail: string | null;
  reviewNotes: string | null;
  createdAt: string;
  actorRole: RiskActorRole;
  institutionId: string | null;
  targetType: string | null;
  targetId: string | null;
  observedAt: string;
  featuresWindowStart?: string | null;
  featuresWindowEnd?: string | null;
  ipHash?: string | null;
  userAgentHash?: string | null;
  featureSnapshotId?: string;
  features?: Record<string, unknown> | null;
}

export interface RiskEventListResponse {
  items: RiskEventRecord[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    pendingReviewCount: number;
    highRiskCount: number;
    criticalRiskCount: number;
    confirmedAbuseCount: number;
  };
}

export interface RiskWorkerStatus {
  autorunEnabled: boolean;
  isRunning: boolean;
  intervalMs: number;
  overlapMinutes: number;
  batchLimit: number;
  lastProcessedAt: string | null;
  lastRunStartedAt: string | null;
  lastRunCompletedAt: string | null;
  lastSuccessfulRunAt: string | null;
  lastFailureAt: string | null;
  lastErrorMessage: string | null;
  lastInsertedCount: number;
  lastScannedCount: number;
}

export const RiskService = {
  list: async (query: {
    page?: number;
    pageSize?: number;
    riskBand?: RiskBand | 'ALL';
    reviewStatus?: RiskReviewStatus | 'ALL';
    reviewedOnly?: boolean;
  } = {}) => {
    const response = await api.get<RiskEventListResponse>('/security/risk-events', {
      params: {
        ...query,
        riskBand: query.riskBand === 'ALL' ? undefined : query.riskBand,
        reviewStatus: query.reviewStatus === 'ALL' ? undefined : query.reviewStatus,
      },
    });
    return response.data;
  },

  getWorkerStatus: async () => {
    const response = await api.get<RiskWorkerStatus>('/security/risk-worker/status');
    return response.data;
  },

  updateReviewStatus: async (
    id: string,
    payload: {
      reviewStatus: RiskReviewStatus;
      reviewReasonCode?: RiskReviewReasonCode | null;
      reviewReasonDetail?: string | null;
      reviewNotes?: string | null;
    },
  ) => {
    const response = await api.put<{
      id: string;
      reviewStatus: RiskReviewStatus;
      reviewedById: string | null;
      reviewedAt: string | null;
      reviewReasonCode: RiskReviewReasonCode | null;
      reviewReasonDetail: string | null;
      reviewNotes: string | null;
    }>(`/security/risk-events/${id}/review`, payload);
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get<RiskEventRecord>(`/security/risk-events/${id}`);
    return response.data;
  },

  exportReviewed: async (query: {
    riskBand?: RiskBand | 'ALL';
    reviewStatus?: RiskReviewStatus | 'ALL';
    reviewedOnly?: boolean;
  } = {}) => {
    const response = await api.get<Blob>('/security/risk-events/export', {
      params: {
        reviewedOnly: query.reviewedOnly ? true : undefined,
        riskBand: query.riskBand === 'ALL' ? undefined : query.riskBand,
        reviewStatus: query.reviewStatus === 'ALL' ? undefined : query.reviewStatus,
      },
      responseType: 'blob',
    });
    return response.data;
  },
};
