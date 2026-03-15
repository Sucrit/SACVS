import { jsPDF } from 'jspdf';
import type { AuditLogEntry, AuditSeverity } from '../../services/audit.service';
import type { CredentialRequest, CredentialRequestStatus } from '../../services/credential.service';
import type { AppNotification } from '../../services/notification.service';
import type { RiskBand, RiskEventRecord, RiskReviewStatus } from '../../services/risk.service';
import type { User, UserRole, UserStatus } from '../../services/user.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TABLE_ROWS = 12;
const PDF_SECTION_TOP_GAP = 14;

export type AdminReportDateRangePreset =
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'LAST_90_DAYS'
  | 'LAST_180_DAYS'
  | 'ALL_TIME'
  | 'CUSTOM';

export interface AdminReportConfig {
  reportTitle: string;
  dateRangePreset: AdminReportDateRangePreset;
  customStartDate: string;
  customEndDate: string;
  institutionId: string | 'ALL';
  includeSections: {
    executiveSummary: boolean;
    onboardingOversight: boolean;
    requestOversight: boolean;
    riskReviewSummary: boolean;
    auditActivitySummary: boolean;
    notificationActivitySummary: boolean;
    operationalHighlights: boolean;
  };
  includeTables: {
    users: boolean;
    requests: boolean;
    riskEvents: boolean;
    auditEntries: boolean;
  };
  filters: {
    userRoles: UserRole[];
    userStatuses: UserStatus[];
    requestStatuses: CredentialRequestStatus[];
    riskBands: RiskBand[];
    riskReviewStatuses: RiskReviewStatus[];
    auditSeverities: AuditSeverity[];
  };
}

export interface AdminReportMetric {
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'warning';
}

export interface AdminReportSummaryCard {
  title: string;
  value: string;
  subtitle: string;
}

export interface AdminReportUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  institution: string;
  activityDate: string;
}

export interface AdminReportRequestRow {
  id: string;
  title: string;
  student: string;
  institution: string;
  status: string;
  deliveryMethod: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminReportRiskRow {
  id: string;
  action: string;
  institution: string;
  riskBand: string;
  reviewStatus: string;
  score: string;
  observedAt: string;
}

export interface AdminReportAuditRow {
  id: string;
  action: string;
  severity: string;
  actor: string;
  institution: string;
  createdAt: string;
}

export interface AdminGeneratedReport {
  title: string;
  generatedAt: string;
  periodLabel: string;
  scopeLabel: string;
  filterSummary: string[];
  summaryCards: AdminReportSummaryCard[];
  highlights: string[];
  executiveSummary: AdminReportMetric[];
  onboardingOversight: {
    metrics: AdminReportMetric[];
    previewRows: AdminReportUserRow[];
    allRows: AdminReportUserRow[];
  };
  requestOversight: {
    metrics: AdminReportMetric[];
    previewRows: AdminReportRequestRow[];
    allRows: AdminReportRequestRow[];
  };
  riskReviewSummary: {
    metrics: AdminReportMetric[];
    previewRows: AdminReportRiskRow[];
    allRows: AdminReportRiskRow[];
  };
  auditActivitySummary: {
    metrics: AdminReportMetric[];
    previewRows: AdminReportAuditRow[];
    allRows: AdminReportAuditRow[];
  };
  notificationActivitySummary: AdminReportMetric[];
  includedSections: AdminReportConfig['includeSections'];
  includeTables: AdminReportConfig['includeTables'];
}

export const ADMIN_REPORT_DATE_RANGE_OPTIONS: Array<{ value: AdminReportDateRangePreset; label: string }> = [
  { value: 'LAST_7_DAYS', label: 'Last 7 days' },
  { value: 'LAST_30_DAYS', label: 'Last 30 days' },
  { value: 'LAST_90_DAYS', label: 'Last 90 days' },
  { value: 'LAST_180_DAYS', label: 'Last 180 days' },
  { value: 'ALL_TIME', label: 'All time' },
  { value: 'CUSTOM', label: 'Custom range' },
];

export const ADMIN_REPORT_ROLE_OPTIONS: UserRole[] = ['ADMIN', 'INSTITUTION', 'STUDENT'];
export const ADMIN_REPORT_STATUS_OPTIONS: UserStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];
export const ADMIN_REPORT_REQUEST_STATUS_OPTIONS: CredentialRequestStatus[] = ['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED'];
export const ADMIN_REPORT_RISK_BAND_OPTIONS: RiskBand[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const ADMIN_REPORT_RISK_REVIEW_OPTIONS: RiskReviewStatus[] = ['PENDING_REVIEW', 'CONFIRMED_ABUSE', 'BENIGN', 'UNCERTAIN'];
export const ADMIN_REPORT_AUDIT_SEVERITY_OPTIONS: AuditSeverity[] = ['INFO', 'WARNING', 'CRITICAL'];

export const DEFAULT_ADMIN_REPORT_CONFIG: AdminReportConfig = {
  reportTitle: 'Admin Governance Report',
  dateRangePreset: 'LAST_30_DAYS',
  customStartDate: '',
  customEndDate: '',
  institutionId: 'ALL',
  includeSections: {
    executiveSummary: true,
    onboardingOversight: true,
    requestOversight: true,
    riskReviewSummary: true,
    auditActivitySummary: true,
    notificationActivitySummary: true,
    operationalHighlights: true,
  },
  includeTables: {
    users: true,
    requests: true,
    riskEvents: true,
    auditEntries: true,
  },
  filters: {
    userRoles: ['ADMIN', 'INSTITUTION', 'STUDENT'],
    userStatuses: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'],
    requestStatuses: ['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED'],
    riskBands: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    riskReviewStatuses: ['PENDING_REVIEW', 'CONFIRMED_ABUSE', 'BENIGN', 'UNCERTAIN'],
    auditSeverities: ['INFO', 'WARNING', 'CRITICAL'],
  },
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const compactNumber = (value: number) => new Intl.NumberFormat().format(value);
const percentage = (value: number, total: number) => (total === 0 ? '0%' : `${((value / total) * 100).toFixed(1)}%`);
const labelize = (value: string) => value.replace(/_/g, ' ');

const getFullName = (user: User) =>
  [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ').trim() || user.email;

const buildDateRange = (config: AdminReportConfig) => {
  if (config.dateRangePreset === 'ALL_TIME') {
    return { start: null as Date | null, end: null as Date | null };
  }

  if (config.dateRangePreset === 'CUSTOM') {
    const start = config.customStartDate ? new Date(`${config.customStartDate}T00:00:00`) : null;
    const end = config.customEndDate ? new Date(`${config.customEndDate}T23:59:59.999`) : null;
    return {
      start: start && !Number.isNaN(start.getTime()) ? start : null,
      end: end && !Number.isNaN(end.getTime()) ? end : null,
    };
  }

  const daysByPreset: Record<Exclude<AdminReportDateRangePreset, 'ALL_TIME' | 'CUSTOM'>, number> = {
    LAST_7_DAYS: 7,
    LAST_30_DAYS: 30,
    LAST_90_DAYS: 90,
    LAST_180_DAYS: 180,
  };

  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setTime(now.getTime() - (daysByPreset[config.dateRangePreset] - 1) * DAY_MS);
  start.setHours(0, 0, 0, 0);
  return { start, end };
};

const isWithinRange = (value: string | null | undefined, range: { start: Date | null; end: Date | null }) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (range.start && date < range.start) return false;
  if (range.end && date > range.end) return false;
  return true;
};

const formatPeriodLabel = (config: AdminReportConfig, range: { start: Date | null; end: Date | null }) => {
  if (config.dateRangePreset === 'ALL_TIME') return 'All time';
  if (config.dateRangePreset === 'CUSTOM') {
    const start = range.start ? formatDate(range.start.toISOString()) : 'Start';
    const end = range.end ? formatDate(range.end.toISOString()) : 'End';
    return `${start} - ${end}`;
  }
  return ADMIN_REPORT_DATE_RANGE_OPTIONS.find(option => option.value === config.dateRangePreset)?.label || 'Selected period';
};

const parseMetadataString = (metadata: Record<string, unknown> | null | undefined, key: string) => {
  if (!metadata) return null;
  const value = metadata[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

const createUserMaps = (users: User[]) => ({
  byId: new Map(users.map(user => [user.id, user] as const)),
  institutionNames: new Map(
    users
      .filter(user => user.role === 'INSTITUTION' && user.institutionId && user.institution?.institutionName)
      .map(user => [user.institutionId as string, user.institution?.institutionName as string] as const),
  ),
});

export const getAdminInstitutionOptions = (users: User[]) => {
  const deduped = new Map<string, string>();
  users
    .filter(user => user.role === 'INSTITUTION' && user.institutionId && user.institution?.institutionName)
    .forEach(user => {
      if (!deduped.has(user.institutionId as string)) {
        deduped.set(user.institutionId as string, user.institution?.institutionName as string);
      }
    });

  return [
    { value: 'ALL' as const, label: 'All institutions' },
    ...Array.from(deduped.entries())
      .sort((left, right) => left[1].localeCompare(right[1]))
      .map(([value, label]) => ({ value, label })),
  ];
};

const getRequestInstitutionId = (request: CredentialRequest, userMap: Map<string, User>) =>
  userMap.get(request.studentId)?.institutionId || null;

const getRequestInstitutionName = (
  request: CredentialRequest,
  userMap: Map<string, User>,
  institutionNameMap: Map<string, string>,
) => {
  const institutionId = getRequestInstitutionId(request, userMap);
  if (!institutionId) return 'Platform-wide';
  return institutionNameMap.get(institutionId) || 'Institution';
};

const getNotificationInstitutionId = (notification: AppNotification, userMap: Map<string, User>) =>
  parseMetadataString(notification.metadata, 'institutionId') || userMap.get(notification.userId)?.institutionId || null;

const getAuditInstitutionId = (entry: AuditLogEntry, userMap: Map<string, User>) => {
  const metadataInstitutionId = parseMetadataString(entry.metadata, 'institutionId');
  if (metadataInstitutionId) return metadataInstitutionId;
  const actorInstitutionId = entry.actorId ? userMap.get(entry.actorId)?.institutionId : null;
  if (actorInstitutionId) return actorInstitutionId;
  return entry.targetId ? userMap.get(entry.targetId)?.institutionId || null : null;
};

const getAuditInstitutionName = (
  entry: AuditLogEntry,
  userMap: Map<string, User>,
  institutionNameMap: Map<string, string>,
) => {
  const metadataInstitutionName = parseMetadataString(entry.metadata, 'institutionName');
  if (metadataInstitutionName) return metadataInstitutionName;
  const institutionId = getAuditInstitutionId(entry, userMap);
  if (!institutionId) return 'Platform-wide';
  return institutionNameMap.get(institutionId) || 'Institution';
};

const buildRowHeight = (doc: jsPDF, row: string[], columnWidths: number[]) => {
  const heights = row.map((value, index) => {
    const lines = doc.splitTextToSize(String(value || '--'), columnWidths[index] - 8);
    return Math.max(18, lines.length * 10 + 8);
  });
  return Math.max(...heights);
};

const drawTable = (doc: jsPDF, startY: number, title: string, headers: string[], rows: string[][]) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 28;
  const tableWidth = pageWidth - 56;
  const columnWidths = headers.map(() => tableWidth / headers.length);
  let y = startY + PDF_SECTION_TOP_GAP;

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - 28) return;
    doc.addPage();
    y = 32;
  };

  const drawTitle = () => {
    ensureSpace(24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(title, left, y);
    y += 14;
  };

  const drawHeader = () => {
    ensureSpace(22);
    doc.setFillColor(248, 250, 252);
    doc.rect(left, y, tableWidth, 20, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(left, y, tableWidth, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    headers.forEach((header, index) => {
      const cellX = left + index * columnWidths[index];
      const headerLines = doc.splitTextToSize(header, columnWidths[index] - 8);
      doc.text(headerLines, cellX + 4, y + 11);
    });
    y += 20;
  };

  drawTitle();
  drawHeader();

  rows.forEach(row => {
    const rowHeight = buildRowHeight(doc, row, columnWidths);
    ensureSpace(rowHeight + 2);
    if (y === 32) {
      drawTitle();
      drawHeader();
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(left, y, tableWidth, rowHeight);
    row.forEach((value, index) => {
      const cellX = left + index * columnWidths[index];
      const lines = doc.splitTextToSize(String(value || '--'), columnWidths[index] - 8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(lines, cellX + 4, y + 11);
    });
    y += rowHeight;
  });

  return y + 12;
};

const drawMetricSection = (doc: jsPDF, startY: number, title: string, metrics: AdminReportMetric[]) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 28;
  const gap = 12;
  const cols = 2;
  const width = (pageWidth - 56 - gap) / cols;
  let y = startY + PDF_SECTION_TOP_GAP;

  if (y + 28 > pageHeight - 32) {
    doc.addPage();
    y = 32;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(title, left, y);
  y += 10;

  metrics.forEach((metric, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const boxX = left + col * (width + gap);
    const boxY = y + row * 40;
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(boxX, boxY, width, 32, 4, 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(metric.label, boxX + 8, boxY + 10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(metric.value, boxX + 8, boxY + 24);
  });

  return y + Math.ceil(metrics.length / cols) * 40 + 10;
};

const drawListSection = (doc: jsPDF, startY: number, title: string, items: string[]) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 28;
  let y = startY + PDF_SECTION_TOP_GAP;

  if (y + 28 > pageHeight - 32) {
    doc.addPage();
    y = 32;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(title, left, y);
  y += 12;

  items.forEach(item => {
    const lines = doc.splitTextToSize(`- ${item}`, doc.internal.pageSize.getWidth() - 56);
    if (y + lines.length * 12 > pageHeight - 28) {
      doc.addPage();
      y = 32;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text(lines, left, y);
    y += lines.length * 12;
  });

  return y + 8;
};

export const buildAdminReport = (
  config: AdminReportConfig,
  data: {
    users: User[];
    requests: CredentialRequest[];
    riskEvents: RiskEventRecord[];
    auditLogs: AuditLogEntry[];
    notifications: AppNotification[];
  },
): AdminGeneratedReport => {
  const range = buildDateRange(config);
  const periodLabel = formatPeriodLabel(config, range);
  const { byId: userMap, institutionNames } = createUserMaps(data.users);

  const scopedUsers = data.users.filter(user => {
    if (!config.filters.userRoles.includes(user.role)) return false;
    if (!config.filters.userStatuses.includes(user.status)) return false;
    if (config.institutionId === 'ALL') return true;
    if (user.role === 'INSTITUTION') return user.institutionId === config.institutionId;
    return user.institutionId === config.institutionId;
  });

  const scopedRequests = data.requests.filter(request => {
    if (!config.filters.requestStatuses.includes(request.status)) return false;
    const institutionId = getRequestInstitutionId(request, userMap);
    if (config.institutionId !== 'ALL' && institutionId !== config.institutionId) return false;
    return true;
  });

  const scopedRiskEvents = data.riskEvents.filter(event => {
    if (!config.filters.riskBands.includes(event.riskBand)) return false;
    if (!config.filters.riskReviewStatuses.includes(event.reviewStatus)) return false;
    if (config.institutionId !== 'ALL' && event.institutionId !== config.institutionId) return false;
    return true;
  });

  const scopedAuditLogs = data.auditLogs.filter(entry => {
    if (!config.filters.auditSeverities.includes(entry.severity)) return false;
    const institutionId = getAuditInstitutionId(entry, userMap);
    if (config.institutionId !== 'ALL' && institutionId !== config.institutionId) return false;
    return true;
  });

  const scopedNotifications = data.notifications.filter(notification => {
    const institutionId = getNotificationInstitutionId(notification, userMap);
    if (config.institutionId !== 'ALL' && institutionId !== config.institutionId) return false;
    return true;
  });

  const usersInRange = scopedUsers.filter(user => isWithinRange(user.approvedAt || user.createdAt, range));
  const requestsCreatedInRange = scopedRequests.filter(request => isWithinRange(request.createdAt, range));
  const requestsUpdatedInRange = scopedRequests.filter(request => isWithinRange(request.updatedAt, range));
  const riskObservedInRange = scopedRiskEvents.filter(event => isWithinRange(event.observedAt, range));
  const riskReviewedInRange = scopedRiskEvents.filter(event => isWithinRange(event.reviewedAt, range));
  const auditInRange = scopedAuditLogs.filter(entry => isWithinRange(entry.createdAt, range));
  const notificationsInRange = scopedNotifications.filter(notification => isWithinRange(notification.createdAt, range));

  const pendingInstitutions = scopedUsers.filter(user => user.role === 'INSTITUTION' && user.status === 'PENDING');
  const approvedInstitutions = scopedUsers.filter(user => user.role === 'INSTITUTION' && user.status === 'APPROVED');
  const pendingReviews = riskObservedInRange.filter(event => event.reviewStatus === 'PENDING_REVIEW');
  const confirmedAbuse = riskReviewedInRange.filter(event => event.reviewStatus === 'CONFIRMED_ABUSE');
  const criticalRisk = riskObservedInRange.filter(event => event.riskBand === 'CRITICAL');
  const highRisk = riskObservedInRange.filter(event => event.riskBand === 'HIGH');
  const approvedRequests = requestsUpdatedInRange.filter(request => request.status === 'APPROVED');
  const completedRequests = requestsUpdatedInRange.filter(request => request.status === 'COMPLETED');

  const scopeLabel = config.institutionId === 'ALL'
    ? 'Platform-wide'
    : institutionNames.get(config.institutionId) || 'Selected institution';

  const filterSummary = [
    `Reporting period: ${periodLabel}`,
    `Institution scope: ${scopeLabel}`,
    `User roles: ${config.filters.userRoles.map(labelize).join(', ')}`,
    `User statuses: ${config.filters.userStatuses.map(labelize).join(', ')}`,
    `Request statuses: ${config.filters.requestStatuses.map(labelize).join(', ')}`,
    `Risk bands: ${config.filters.riskBands.map(labelize).join(', ')}`,
    `Risk reviews: ${config.filters.riskReviewStatuses.map(labelize).join(', ')}`,
    `Audit severities: ${config.filters.auditSeverities.map(labelize).join(', ')}`,
  ];

  const userRows = usersInRange
    .sort((left, right) => new Date(right.approvedAt || right.createdAt).getTime() - new Date(left.approvedAt || left.createdAt).getTime())
    .map(user => ({
      id: user.id,
      name: getFullName(user),
      email: user.email,
      role: labelize(user.role),
      status: labelize(user.status),
      institution: user.institution?.institutionName || (user.institutionId ? institutionNames.get(user.institutionId) || 'Institution' : 'Platform-wide'),
      activityDate: formatDate(user.approvedAt || user.createdAt),
    }));

  const requestRows = requestsCreatedInRange
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map(request => ({
      id: request.id,
      title: request.title,
      student: userMap.get(request.studentId) ? getFullName(userMap.get(request.studentId) as User) : request.studentId,
      institution: getRequestInstitutionName(request, userMap, institutionNames),
      status: labelize(request.status),
      deliveryMethod: labelize(request.deliveryMethod),
      createdAt: formatDate(request.createdAt),
      updatedAt: formatDate(request.updatedAt),
    }));

  const riskRows = riskObservedInRange
    .sort((left, right) => new Date(right.observedAt).getTime() - new Date(left.observedAt).getTime())
    .map(event => ({
      id: event.id,
      action: event.action,
      institution: event.institutionId ? institutionNames.get(event.institutionId) || 'Institution' : 'Platform-wide',
      riskBand: labelize(event.riskBand),
      reviewStatus: labelize(event.reviewStatus),
      score: event.riskScore.toFixed(2),
      observedAt: formatDateTime(event.observedAt),
    }));

  const auditRows = auditInRange
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map(entry => ({
      id: entry.id,
      action: labelize(entry.action),
      severity: labelize(entry.severity),
      actor: entry.actorEmail || 'System',
      institution: getAuditInstitutionName(entry, userMap, institutionNames),
      createdAt: formatDateTime(entry.createdAt),
    }));

  return {
    title: config.reportTitle.trim() || 'Admin Governance Report',
    generatedAt: new Date().toISOString(),
    periodLabel,
    scopeLabel,
    filterSummary,
    summaryCards: [
      {
        title: 'Users in scope',
        value: compactNumber(scopedUsers.length),
        subtitle: `${compactNumber(usersInRange.length)} active in selected period`,
      },
      {
        title: 'Pending institutions',
        value: compactNumber(pendingInstitutions.length),
        subtitle: `${compactNumber(approvedInstitutions.length)} approved institutions`,
      },
      {
        title: 'Risk events',
        value: compactNumber(riskObservedInRange.length),
        subtitle: `${compactNumber(criticalRisk.length)} critical, ${compactNumber(highRisk.length)} high`,
      },
      {
        title: 'Audit entries',
        value: compactNumber(auditInRange.length),
        subtitle: `${compactNumber(notificationsInRange.length)} notifications in range`,
      },
    ],
    highlights: [
      `${percentage(pendingInstitutions.length, scopedUsers.filter(user => user.role === 'INSTITUTION').length)} of institution accounts in scope are still pending approval.`,
      `${percentage(completedRequests.length, requestsCreatedInRange.length)} of requests created in the selected period reached completion.`,
      `${percentage(confirmedAbuse.length, riskReviewedInRange.length)} of reviewed risk events were confirmed as abuse.`,
      `${compactNumber(pendingReviews.length)} risk events remain pending analyst review.`,
      `${compactNumber(auditInRange.length)} governance audit entries were recorded in the selected period.`,
    ],
    executiveSummary: [
      { label: 'Users approved in period', value: compactNumber(usersInRange.filter(user => user.status === 'APPROVED').length) },
      { label: 'Pending institution approvals', value: compactNumber(pendingInstitutions.length), tone: pendingInstitutions.length > 0 ? 'warning' : 'success' },
      { label: 'Requests created', value: compactNumber(requestsCreatedInRange.length) },
      { label: 'Risk events observed', value: compactNumber(riskObservedInRange.length), tone: riskObservedInRange.length > 0 ? 'warning' : 'success' },
      { label: 'Critical risk events', value: compactNumber(criticalRisk.length), tone: criticalRisk.length > 0 ? 'warning' : 'success' },
      { label: 'Audit entries logged', value: compactNumber(auditInRange.length) },
    ],
    onboardingOversight: {
      metrics: [
        { label: 'Users created', value: compactNumber(usersInRange.length) },
        { label: 'Institution signups', value: compactNumber(usersInRange.filter(user => user.role === 'INSTITUTION').length) },
        { label: 'Pending approvals', value: compactNumber(scopedUsers.filter(user => user.status === 'PENDING').length), tone: scopedUsers.some(user => user.status === 'PENDING') ? 'warning' : 'success' },
        { label: 'Suspended users', value: compactNumber(scopedUsers.filter(user => user.status === 'SUSPENDED').length), tone: scopedUsers.some(user => user.status === 'SUSPENDED') ? 'warning' : 'neutral' },
      ],
      previewRows: userRows.slice(0, MAX_TABLE_ROWS),
      allRows: userRows,
    },
    requestOversight: {
      metrics: [
        { label: 'Created in period', value: compactNumber(requestsCreatedInRange.length) },
        { label: 'Approved in period', value: compactNumber(approvedRequests.length) },
        { label: 'Completed in period', value: compactNumber(completedRequests.length), tone: completedRequests.length > 0 ? 'success' : 'neutral' },
        { label: 'Pending backlog', value: compactNumber(scopedRequests.filter(request => request.status === 'PENDING').length), tone: scopedRequests.some(request => request.status === 'PENDING') ? 'warning' : 'success' },
      ],
      previewRows: requestRows.slice(0, MAX_TABLE_ROWS),
      allRows: requestRows,
    },
    riskReviewSummary: {
      metrics: [
        { label: 'Observed in period', value: compactNumber(riskObservedInRange.length) },
        { label: 'Pending review', value: compactNumber(pendingReviews.length), tone: pendingReviews.length > 0 ? 'warning' : 'success' },
        { label: 'Confirmed abuse', value: compactNumber(confirmedAbuse.length), tone: confirmedAbuse.length > 0 ? 'warning' : 'neutral' },
        { label: 'Critical or high', value: compactNumber(criticalRisk.length + highRisk.length), tone: criticalRisk.length + highRisk.length > 0 ? 'warning' : 'success' },
      ],
      previewRows: riskRows.slice(0, MAX_TABLE_ROWS),
      allRows: riskRows,
    },
    auditActivitySummary: {
      metrics: [
        { label: 'Audit entries', value: compactNumber(auditInRange.length) },
        { label: 'Critical entries', value: compactNumber(auditInRange.filter(entry => entry.severity === 'CRITICAL').length), tone: auditInRange.some(entry => entry.severity === 'CRITICAL') ? 'warning' : 'success' },
        { label: 'Warnings', value: compactNumber(auditInRange.filter(entry => entry.severity === 'WARNING').length) },
        { label: 'Info entries', value: compactNumber(auditInRange.filter(entry => entry.severity === 'INFO').length) },
      ],
      previewRows: auditRows.slice(0, MAX_TABLE_ROWS),
      allRows: auditRows,
    },
    notificationActivitySummary: [
      { label: 'Notifications sent', value: compactNumber(notificationsInRange.length) },
      { label: 'Unread notifications', value: compactNumber(notificationsInRange.filter(notification => !notification.read).length), tone: notificationsInRange.some(notification => !notification.read) ? 'warning' : 'success' },
      { label: 'Security alerts', value: compactNumber(notificationsInRange.filter(notification => notification.type === 'SECURITY_ALERT').length) },
      { label: 'Account decisions', value: compactNumber(notificationsInRange.filter(notification => notification.type === 'ACCOUNT_APPROVED' || notification.type === 'ACCOUNT_REJECTED').length) },
    ],
    includedSections: config.includeSections,
    includeTables: config.includeTables,
  };
};

export const downloadAdminReportPdf = (report: AdminGeneratedReport) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 28;
  let y = 34;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 108, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(report.title, left, 46);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Scope: ${report.scopeLabel}`, left, 66);
  doc.text(`Reporting period: ${report.periodLabel}`, left, 82);
  doc.text(`Generated: ${formatDateTime(report.generatedAt)}`, left, 98);
  y = 126;

  y = drawListSection(doc, y, 'Applied Filters', report.filterSummary);
  if (report.includedSections.operationalHighlights) {
    y = drawListSection(doc, y, 'Operational Highlights', report.highlights);
  }
  if (report.includedSections.executiveSummary) {
    y = drawMetricSection(doc, y, 'Executive Summary', report.executiveSummary);
  }
  if (report.includedSections.onboardingOversight) {
    y = drawMetricSection(doc, y, 'Onboarding Oversight', report.onboardingOversight.metrics);
    if (report.includeTables.users) {
      y = drawTable(doc, y, 'Users List', ['Name', 'Email', 'Role', 'Status', 'Institution', 'Activity'], report.onboardingOversight.allRows.map(row => [row.name, row.email, row.role, row.status, row.institution, row.activityDate]));
    }
  }
  if (report.includedSections.requestOversight) {
    y = drawMetricSection(doc, y, 'Request Oversight', report.requestOversight.metrics);
    if (report.includeTables.requests) {
      y = drawTable(doc, y, 'Requests List', ['Title', 'Student', 'Institution', 'Status', 'Delivery', 'Created', 'Updated'], report.requestOversight.allRows.map(row => [row.title, row.student, row.institution, row.status, row.deliveryMethod, row.createdAt, row.updatedAt]));
    }
  }
  if (report.includedSections.riskReviewSummary) {
    y = drawMetricSection(doc, y, 'Risk Review Summary', report.riskReviewSummary.metrics);
    if (report.includeTables.riskEvents) {
      y = drawTable(doc, y, 'Risk Events List', ['Action', 'Institution', 'Band', 'Review', 'Score', 'Observed'], report.riskReviewSummary.allRows.map(row => [row.action, row.institution, row.riskBand, row.reviewStatus, row.score, row.observedAt]));
    }
  }
  if (report.includedSections.auditActivitySummary) {
    y = drawMetricSection(doc, y, 'Audit Activity Summary', report.auditActivitySummary.metrics);
    if (report.includeTables.auditEntries) {
      y = drawTable(doc, y, 'Audit Entries List', ['Action', 'Severity', 'Actor', 'Institution', 'Timestamp'], report.auditActivitySummary.allRows.map(row => [row.action, row.severity, row.actor, row.institution, row.createdAt]));
    }
  }
  if (report.includedSections.notificationActivitySummary) {
    y = drawMetricSection(doc, y, 'Notification Activity Summary', report.notificationActivitySummary);
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated ${formatDateTime(report.generatedAt)}`, 28, doc.internal.pageSize.getHeight() - 14);
    doc.text(`Page ${page} of ${pageCount}`, doc.internal.pageSize.getWidth() - 74, doc.internal.pageSize.getHeight() - 14);
  }

  doc.save(`admin-governance-report-${new Date().toISOString().slice(0, 10)}.pdf`);
};
