/**
 * Shared date/time and display formatting utilities.
 * Consolidates duplicated helpers from Student/utils, Institution/utils, and AdminDashboard.
 */

export const formatDate = (value: string | null | undefined): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export const shortenHash = (value: string | null | undefined): string => {
  if (!value) return '-';
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
};

export const formatRiskReviewStatus = (status: string): string => {
  if (!status) return '-';
  
  // Strip _REVIEW suffix for brevity, e.g. PENDING_REVIEW -> PENDING
  const shortened = status.replace(/_REVIEW$/, '');
  
  // Format as uppercase, e.g. CONFIRMED_ABUSE -> CONFIRMED ABUSE
  return shortened.toUpperCase().replace(/_/g, ' ');
};
