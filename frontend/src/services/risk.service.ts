import { api } from '../api/client';

export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RiskReviewStatus = 'PENDING_REVIEW' | 'CONFIRMED_ABUSE' | 'BENIGN' | 'UNCERTAIN';
export type RiskActorRole = 'STUDENT' | 'ADMIN' | 'EMPLOYER' | 'INSTITUTION' | null;

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
  reviewNotes: string | null;
  createdAt: string;
  actorRole: RiskActorRole;
  institutionId: string | null;
  targetType: string | null;
  targetId: string | null;
  observedAt: string;
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

export const RiskService = {
  list: async (query: {
    page?: number;
    pageSize?: number;
    riskBand?: RiskBand | 'ALL';
    reviewStatus?: RiskReviewStatus | 'ALL';
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

  updateReviewStatus: async (
    id: string,
    payload: { reviewStatus: RiskReviewStatus; reviewNotes?: string | null },
  ) => {
    const response = await api.put<{
      id: string;
      reviewStatus: RiskReviewStatus;
      reviewedById: string | null;
      reviewedAt: string | null;
      reviewNotes: string | null;
    }>(`/security/risk-events/${id}/review`, payload);
    return response.data;
  },
};
