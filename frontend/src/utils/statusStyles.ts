/**
 * Shared status styling utility.
 * Single source of truth for all status-related text colors across the application.
 */

import type { RiskReviewStatus, RiskBand } from '../services/risk.service';
import type { UserRole } from '../services/user.service';

// ---------------------------------------------------------------------------
// General status styles (used by Badge component and any table status column)
// Covers: UserStatus, CredentialRequestStatus, CredentialStatus
// ---------------------------------------------------------------------------

export type GeneralStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'ISSUED'
  | 'REVOKED'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'COMPLETED'
  | 'CANCELLED';

const GENERAL_STATUS_STYLES: Record<GeneralStatus, string> = {
  PENDING: 'text-warning-700',
  APPROVED: 'text-success-700',
  REJECTED: 'text-error-700',
  ISSUED: 'text-emerald-700',
  REVOKED: 'text-rose-700',
  SUSPENDED: 'text-warning-700',
  EXPIRED: 'text-neutral-600',
  COMPLETED: 'text-success-700',
  CANCELLED: 'text-neutral-700',
};

export const getStatusStyle = (status: GeneralStatus): string =>
  GENERAL_STATUS_STYLES[status] || 'text-neutral-600';

// ---------------------------------------------------------------------------
// Risk review status styles
// ---------------------------------------------------------------------------

const RISK_REVIEW_STYLES: Record<RiskReviewStatus, string> = {
  PENDING_REVIEW: 'text-amber-500',
  CONFIRMED_ABUSE: 'text-rose-700',
  BENIGN: 'text-emerald-700',
  UNCERTAIN: 'text-amber-700',
};

export const getRiskReviewStyle = (reviewStatus: RiskReviewStatus): string =>
  RISK_REVIEW_STYLES[reviewStatus] || 'text-neutral-700';

// ---------------------------------------------------------------------------
// Risk band styles
// ---------------------------------------------------------------------------

const RISK_BAND_STYLES: Record<RiskBand, string> = {
  CRITICAL: 'text-rose-700',
  HIGH: 'text-amber-700',
  MEDIUM: 'text-cyan-700',
  LOW: 'text-neutral-700',
};

export const getRiskBandStyle = (riskBand: RiskBand): string =>
  RISK_BAND_STYLES[riskBand] || 'text-neutral-700';

// ---------------------------------------------------------------------------
// User role styles
// ---------------------------------------------------------------------------

const ROLE_STYLES: Record<UserRole, string> = {
  ADMIN: 'text-neutral-800',
  INSTITUTION: 'text-neutral-800',
  STUDENT: 'text-neutral-800',
};

export const getRoleStyle = (role: UserRole): string =>
  ROLE_STYLES[role] || 'text-neutral-700';
