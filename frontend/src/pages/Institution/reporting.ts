import { jsPDF } from 'jspdf';
import type {
  Credential,
  CredentialRequest,
  CredentialRequestStatus,
  CredentialType,
  DeliveryMethod,
} from '../../services/credential.service';
import type { User, UserStatus } from '../../services/user.service';

export type InstitutionReportDateRangePreset =
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'LAST_90_DAYS'
  | 'LAST_180_DAYS'
  | 'ALL_TIME'
  | 'CUSTOM';

export interface InstitutionReportConfig {
  reportTitle: string;
  dateRangePreset: InstitutionReportDateRangePreset;
  customStartDate: string;
  customEndDate: string;
  includeSections: {
    executiveSummary: boolean;
    studentOperations: boolean;
    requestOperations: boolean;
    credentialIssuance: boolean;
    deliveryCompletion: boolean;
    departmentBreakdown: boolean;
    credentialTypeBreakdown: boolean;
    operationalHighlights: boolean;
  };
  includeTables: {
    students: boolean;
    requests: boolean;
    credentials: boolean;
  };
  filters: {
    studentStatuses: UserStatus[];
    requestStatuses: CredentialRequestStatus[];
    credentialTypes: CredentialType[];
    department: string;
  };
}

export interface InstitutionReportMetric {
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'warning';
}

export interface InstitutionReportSummaryCard {
  title: string;
  value: string;
  subtitle: string;
}

export interface InstitutionReportStudentRow {
  id: string;
  name: string;
  studentNumber: string;
  department: string;
  status: string;
  activityDate: string;
}

export interface InstitutionReportRequestRow {
  id: string;
  title: string;
  student: string;
  type: string;
  delivery: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionReportCredentialRow {
  id: string;
  title: string;
  student: string;
  type: string;
  status: string;
  issuedAt: string;
  expiryDate: string;
  anchored: string;
}

export interface InstitutionGeneratedReport {
  title: string;
  institutionName: string;
  generatedAt: string;
  periodLabel: string;
  filterSummary: string[];
  summaryCards: InstitutionReportSummaryCard[];
  highlights: string[];
  executiveSummary: InstitutionReportMetric[];
  studentOperations: {
    metrics: InstitutionReportMetric[];
    previewRows: InstitutionReportStudentRow[];
    allRows: InstitutionReportStudentRow[];
  };
  requestOperations: {
    metrics: InstitutionReportMetric[];
    previewRows: InstitutionReportRequestRow[];
    allRows: InstitutionReportRequestRow[];
  };
  credentialIssuance: {
    metrics: InstitutionReportMetric[];
    previewRows: InstitutionReportCredentialRow[];
    allRows: InstitutionReportCredentialRow[];
  };
  deliveryCompletion: InstitutionReportMetric[];
  departmentBreakdown: Array<{ department: string; students: number; requests: number; issued: number }>;
  credentialTypeBreakdown: Array<{ type: string; requests: number; issued: number }>;
  includedSections: InstitutionReportConfig['includeSections'];
  includeTables: InstitutionReportConfig['includeTables'];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TABLE_ROWS = 12;

export const REPORT_DATE_RANGE_OPTIONS: Array<{ value: InstitutionReportDateRangePreset; label: string }> = [
  { value: 'LAST_7_DAYS', label: 'Last 7 days' },
  { value: 'LAST_30_DAYS', label: 'Last 30 days' },
  { value: 'LAST_90_DAYS', label: 'Last 90 days' },
  { value: 'LAST_180_DAYS', label: 'Last 180 days' },
  { value: 'ALL_TIME', label: 'All time' },
  { value: 'CUSTOM', label: 'Custom range' },
];

export const DEFAULT_REPORT_CONFIG: InstitutionReportConfig = {
  reportTitle: 'Institution Operations Report',
  dateRangePreset: 'LAST_30_DAYS',
  customStartDate: '',
  customEndDate: '',
  includeSections: {
    executiveSummary: true,
    studentOperations: true,
    requestOperations: true,
    credentialIssuance: true,
    deliveryCompletion: true,
    departmentBreakdown: true,
    credentialTypeBreakdown: true,
    operationalHighlights: true,
  },
  includeTables: {
    students: true,
    requests: true,
    credentials: true,
  },
  filters: {
    studentStatuses: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'],
    requestStatuses: ['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED'],
    credentialTypes: ['TRANSCRIPT', 'DIPLOMA', 'CERTIFICATE', 'DEGREE', 'LICENSE'],
    department: 'ALL',
  },
};

export const STUDENT_REPORT_STATUS_OPTIONS: UserStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];
export const REQUEST_REPORT_STATUS_OPTIONS: CredentialRequestStatus[] = ['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED'];
export const CREDENTIAL_REPORT_TYPE_OPTIONS: CredentialType[] = ['TRANSCRIPT', 'DIPLOMA', 'CERTIFICATE', 'DEGREE', 'LICENSE'];

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

const formatDateTime = (value: string) => {
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

const labelize = (value: string) => value.replace(/_/g, ' ');

const getStudentFullName = (student: User) =>
  [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ').trim() || student.email;

const getStudentActivityDate = (student: User) => student.approvedAt || student.createdAt;
const getCredentialActivityDate = (credential: Credential) =>
  credential.issuedDate || credential.anchoredAt || credential.updatedAt || credential.createdAt;
const isBlockchainCredential = (credential: Credential) =>
  credential.status === 'ISSUED' && Boolean(credential.chain || credential.txHash || credential.anchoredAt || credential.blockNumber !== null);

const buildDateRange = (config: InstitutionReportConfig) => {
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

  const daysByPreset: Record<Exclude<InstitutionReportDateRangePreset, 'ALL_TIME' | 'CUSTOM'>, number> = {
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

const formatPeriodLabel = (config: InstitutionReportConfig, range: { start: Date | null; end: Date | null }) => {
  if (config.dateRangePreset === 'ALL_TIME') return 'All time';
  if (config.dateRangePreset === 'CUSTOM') {
    const start = range.start ? formatDate(range.start.toISOString()) : 'Start';
    const end = range.end ? formatDate(range.end.toISOString()) : 'End';
    return `${start} - ${end}`;
  }
  const option = REPORT_DATE_RANGE_OPTIONS.find(item => item.value === config.dateRangePreset);
  return option?.label || 'Selected period';
};

const getDepartment = (student: User | undefined | null) => student?.profile?.department || 'Unassigned';

const percentage = (value: number, total: number) => (total === 0 ? '0%' : `${((value / total) * 100).toFixed(1)}%`);

const compactNumber = (value: number) => new Intl.NumberFormat().format(value);

const topDepartment = (entries: Array<{ department: string; requests: number }>) =>
  [...entries].sort((a, b) => b.requests - a.requests)[0] || null;

const deriveHighlights = (params: {
  requestCreatedCount: number;
  pendingRequests: number;
  completedByOutcome: number;
  approvedByOutcome: number;
  issuedCredentials: number;
  anchoredCredentials: number;
  expiringSoonCount: number;
  departmentBreakdown: Array<{ department: string; students: number; requests: number; issued: number }>;
  approvalsInRange: number;
}) => {
  const items: string[] = [];

  if (params.requestCreatedCount > 0) {
    items.push(
      `${percentage(params.pendingRequests, params.requestCreatedCount)} of requests created in this period are still pending.`
    );
  } else {
    items.push('No new request activity was recorded in the selected period.');
  }

  if (params.approvedByOutcome > 0) {
    items.push(
      `${percentage(params.completedByOutcome, params.approvedByOutcome)} of approved requests reached completion in the selected period.`
    );
  }

  if (params.issuedCredentials > 0) {
    items.push(
      `${percentage(params.anchoredCredentials, params.issuedCredentials)} of issued credentials were anchored to blockchain.`
    );
  }

  if (params.expiringSoonCount > 0) {
    items.push(`${compactNumber(params.expiringSoonCount)} issued credentials are expiring within the next 30 days.`);
  }

  if (params.approvalsInRange > 0) {
    items.push(`${compactNumber(params.approvalsInRange)} student approvals were recorded in the selected period.`);
  }

  const busiestDepartment = topDepartment(params.departmentBreakdown);
  if (busiestDepartment && busiestDepartment.requests > 0) {
    items.push(`${busiestDepartment.department} generated the highest request volume in the selected period.`);
  }

  return items.slice(0, 5);
};

export const getReportDepartmentOptions = (students: User[]) => [
  'ALL',
  ...Array.from(new Set(students.map(student => student.profile?.department).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
];

export const buildInstitutionReport = (
  config: InstitutionReportConfig,
  data: { students: User[]; requests: CredentialRequest[]; credentials: Credential[] },
  institutionName: string,
): InstitutionGeneratedReport => {
  const range = buildDateRange(config);
  const periodLabel = formatPeriodLabel(config, range);
  const studentById = new Map(data.students.map(student => [student.id, student] as const));

  const scopedStudents = data.students.filter(student => {
    const matchesStatus = config.filters.studentStatuses.includes(student.status);
    const matchesDepartment = config.filters.department === 'ALL' || getDepartment(student) === config.filters.department;
    return matchesStatus && matchesDepartment;
  });

  const scopedRequests = data.requests.filter(request => {
    const student = studentById.get(request.studentId);
    const matchesStatus = config.filters.requestStatuses.includes(request.status);
    const matchesDepartment = config.filters.department === 'ALL' || getDepartment(student) === config.filters.department;
    return matchesStatus && matchesDepartment;
  });

  const scopedCredentials = data.credentials.filter(credential => {
    const student = studentById.get(credential.studentId);
    const matchesType = config.filters.credentialTypes.includes(credential.type);
    const matchesDepartment = config.filters.department === 'ALL' || getDepartment(student) === config.filters.department;
    return matchesType && matchesDepartment;
  });

  const studentActivityRows = scopedStudents
    .filter(student => isWithinRange(getStudentActivityDate(student), range))
    .sort((a, b) => new Date(getStudentActivityDate(b)).getTime() - new Date(getStudentActivityDate(a)).getTime());

  const requestCreatedInRange = scopedRequests
    .filter(request => isWithinRange(request.createdAt, range))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const requestOutcomesInRange = scopedRequests.filter(request =>
    request.status !== 'PENDING' && isWithinRange(request.updatedAt || request.createdAt, range)
  );

  const credentialActivityInRange = scopedCredentials
    .filter(credential => isWithinRange(getCredentialActivityDate(credential), range))
    .sort((a, b) => new Date(getCredentialActivityDate(b)).getTime() - new Date(getCredentialActivityDate(a)).getTime());

  const approvalsInRange = scopedStudents.filter(student => student.status === 'APPROVED' && isWithinRange(getStudentActivityDate(student), range)).length;
  const pendingStudents = scopedStudents.filter(student => student.status === 'PENDING').length;
  const suspendedStudents = scopedStudents.filter(student => student.status === 'SUSPENDED').length;

  const requestCreatedCount = requestCreatedInRange.length;
  const pendingRequests = scopedRequests.filter(request => request.status === 'PENDING').length;
  const approvedByOutcome = requestOutcomesInRange.filter(request => request.status === 'APPROVED' || request.status === 'COMPLETED').length;
  const completedByOutcome = requestOutcomesInRange.filter(request => request.status === 'COMPLETED').length;
  const rejectedByOutcome = requestOutcomesInRange.filter(request => request.status === 'REJECTED' || request.status === 'CANCELLED').length;

  const issuedCredentials = credentialActivityInRange.filter(credential => credential.status === 'ISSUED').length;
  const anchoredCredentials = credentialActivityInRange.filter(isBlockchainCredential).length;
  const now = Date.now();
  const expiringSoonCount = credentialActivityInRange.filter(credential => {
    if (credential.status !== 'ISSUED' || !credential.expiryDate) return false;
    const expiryTime = new Date(credential.expiryDate).getTime();
    return !Number.isNaN(expiryTime) && expiryTime >= now && expiryTime <= now + 30 * DAY_MS;
  }).length;

  const requestByDelivery = (deliveryMethod: DeliveryMethod) => requestCreatedInRange.filter(request => request.deliveryMethod === deliveryMethod).length;

  const departmentMap = new Map<string, { department: string; students: number; requests: number; issued: number }>();
  scopedStudents.forEach(student => {
    const department = getDepartment(student);
    const entry = departmentMap.get(department) || { department, students: 0, requests: 0, issued: 0 };
    entry.students += 1;
    departmentMap.set(department, entry);
  });
  requestCreatedInRange.forEach(request => {
    const department = getDepartment(studentById.get(request.studentId));
    const entry = departmentMap.get(department) || { department, students: 0, requests: 0, issued: 0 };
    entry.requests += 1;
    departmentMap.set(department, entry);
  });
  credentialActivityInRange.filter(credential => credential.status === 'ISSUED').forEach(credential => {
    const department = getDepartment(studentById.get(credential.studentId));
    const entry = departmentMap.get(department) || { department, students: 0, requests: 0, issued: 0 };
    entry.issued += 1;
    departmentMap.set(department, entry);
  });

  const departmentBreakdown = Array.from(departmentMap.values()).sort((a, b) => {
    const totalA = a.requests + a.issued + a.students;
    const totalB = b.requests + b.issued + b.students;
    return totalB - totalA;
  });

  const credentialTypeBreakdown = CREDENTIAL_REPORT_TYPE_OPTIONS.filter(type => config.filters.credentialTypes.includes(type)).map(type => ({
    type: labelize(type),
    requests: requestCreatedInRange.filter(request => request.type === type).length,
    issued: credentialActivityInRange.filter(credential => credential.type === type && credential.status === 'ISSUED').length,
  }));

  const studentOperationRows: InstitutionReportStudentRow[] = studentActivityRows.map(student => ({
    id: student.id,
    name: getStudentFullName(student),
    studentNumber: student.profile?.studentNumber || '--',
    department: getDepartment(student),
    status: labelize(student.status),
    activityDate: formatDate(getStudentActivityDate(student)),
  }));

  const fallbackStudent = (studentId: string): User => ({
    id: studentId,
    firstName: 'Unknown',
    middleName: null,
    lastName: 'Student',
    email: '',
    role: 'STUDENT',
    status: 'PENDING',
    institutionId: null,
    approvedById: null,
    createdAt: '',
    updatedAt: '',
    approvedAt: null,
  });

  const requestOperationRows: InstitutionReportRequestRow[] = requestCreatedInRange.map(request => ({
    id: request.id,
    title: request.title,
    student: getStudentFullName(studentById.get(request.studentId) || fallbackStudent(request.studentId)),
    type: labelize(request.type),
    delivery: labelize(request.deliveryMethod),
    status: labelize(request.status),
    createdAt: formatDate(request.createdAt),
    updatedAt: formatDate(request.updatedAt),
  }));

  const credentialIssuanceRows: InstitutionReportCredentialRow[] = credentialActivityInRange.map(credential => ({
    id: credential.id,
    title: credential.title,
    student: getStudentFullName(studentById.get(credential.studentId) || fallbackStudent(credential.studentId)),
    type: labelize(credential.type),
    status: labelize(credential.status),
    issuedAt: formatDate(getCredentialActivityDate(credential)),
    expiryDate: formatDate(credential.expiryDate),
    anchored: isBlockchainCredential(credential) ? 'Yes' : 'No',
  }));

  const filterSummary = [
    `Reporting period: ${periodLabel}`,
    `Department: ${config.filters.department === 'ALL' ? 'All departments' : config.filters.department}`,
    `Student statuses: ${config.filters.studentStatuses.map(labelize).join(', ')}`,
    `Request statuses: ${config.filters.requestStatuses.map(labelize).join(', ')}`,
    `Credential types: ${config.filters.credentialTypes.map(labelize).join(', ')}`,
  ];

  const summaryCards: InstitutionReportSummaryCard[] = [
    {
      title: 'Students in Scope',
      value: compactNumber(scopedStudents.length),
      subtitle: `${compactNumber(approvalsInRange)} approvals recorded in period`,
    },
    {
      title: 'Requests Created',
      value: compactNumber(requestCreatedCount),
      subtitle: `${compactNumber(pendingRequests)} currently pending`,
    },
    {
      title: 'Credentials Issued',
      value: compactNumber(issuedCredentials),
      subtitle: `${compactNumber(anchoredCredentials)} anchored to blockchain`,
    },
    {
      title: 'Completion Rate',
      value: percentage(completedByOutcome, Math.max(approvedByOutcome, 0)),
      subtitle: `${compactNumber(completedByOutcome)} completed from ${compactNumber(approvedByOutcome)} approvals`,
    },
  ];

  const executiveSummary: InstitutionReportMetric[] = [
    { label: 'Managed students', value: compactNumber(scopedStudents.length) },
    { label: 'Approvals in period', value: compactNumber(approvalsInRange), tone: 'success' },
    { label: 'Requests created', value: compactNumber(requestCreatedCount) },
    { label: 'Pending requests', value: compactNumber(pendingRequests), tone: pendingRequests > 0 ? 'warning' : 'neutral' },
    { label: 'Issued credentials', value: compactNumber(issuedCredentials), tone: 'success' },
    { label: 'Blockchain anchored', value: compactNumber(anchoredCredentials) },
  ];

  const highlights = deriveHighlights({
    requestCreatedCount,
    pendingRequests,
    completedByOutcome,
    approvedByOutcome,
    issuedCredentials,
    anchoredCredentials,
    expiringSoonCount,
    departmentBreakdown,
    approvalsInRange,
  });

  return {
    title: config.reportTitle.trim() || 'Institution Operations Report',
    institutionName,
    generatedAt: new Date().toISOString(),
    periodLabel,
    filterSummary,
    summaryCards,
    highlights,
    executiveSummary,
    studentOperations: {
      metrics: [
        { label: 'Approved students', value: compactNumber(scopedStudents.filter(student => student.status === 'APPROVED').length), tone: 'success' },
        { label: 'Pending students', value: compactNumber(pendingStudents), tone: pendingStudents > 0 ? 'warning' : 'neutral' },
        { label: 'Suspended students', value: compactNumber(suspendedStudents) },
        { label: 'Approvals in period', value: compactNumber(approvalsInRange), tone: 'success' },
      ],
      previewRows: studentOperationRows.slice(0, MAX_TABLE_ROWS),
      allRows: studentOperationRows,
    },
    requestOperations: {
      metrics: [
        { label: 'Created in period', value: compactNumber(requestCreatedCount) },
        { label: 'Pending queue', value: compactNumber(pendingRequests), tone: pendingRequests > 0 ? 'warning' : 'neutral' },
        { label: 'Approved outcomes', value: compactNumber(approvedByOutcome), tone: 'success' },
        { label: 'Rejected outcomes', value: compactNumber(rejectedByOutcome) },
      ],
      previewRows: requestOperationRows.slice(0, MAX_TABLE_ROWS),
      allRows: requestOperationRows,
    },
    credentialIssuance: {
      metrics: [
        { label: 'Issued in period', value: compactNumber(issuedCredentials), tone: 'success' },
        { label: 'Anchored in period', value: compactNumber(anchoredCredentials), tone: anchoredCredentials > 0 ? 'success' : 'neutral' },
        { label: 'Expiring in 30 days', value: compactNumber(expiringSoonCount), tone: expiringSoonCount > 0 ? 'warning' : 'neutral' },
        { label: 'Revoked or expired', value: compactNumber(credentialActivityInRange.filter(credential => credential.status === 'REVOKED' || credential.status === 'EXPIRED').length) },
      ],
      previewRows: credentialIssuanceRows.slice(0, MAX_TABLE_ROWS),
      allRows: credentialIssuanceRows,
    },
    deliveryCompletion: [
      { label: 'Digital requests', value: compactNumber(requestByDelivery('DIGITAL')) },
      { label: 'Physical requests', value: compactNumber(requestByDelivery('PHYSICAL')) },
      { label: 'Both delivery', value: compactNumber(requestByDelivery('BOTH')) },
      { label: 'Completed outcomes', value: compactNumber(completedByOutcome), tone: 'success' },
    ],
    departmentBreakdown,
    credentialTypeBreakdown,
    includedSections: config.includeSections,
    includeTables: config.includeTables,
  };
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'institution-operations-report';

const addFooter = (doc: jsPDF) => {
  const totalPages = doc.getNumberOfPages();
  for (let index = 1; index <= totalPages; index += 1) {
    doc.setPage(index);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Page ${index} of ${totalPages}`, doc.internal.pageSize.getWidth() - 72, doc.internal.pageSize.getHeight() - 24, { align: 'right' });
  }
};

export const downloadInstitutionReportPdf = (report: InstitutionGeneratedReport) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  const sectionTopGap = 18;
  const sectionBottomGap = 4;
  const blockBottomGap = 4;
  let cursorY = margin;

  const ensureSpace = (height: number) => {
    if (cursorY + height <= pageHeight - margin - 24) return;
    doc.addPage();
    cursorY = margin;
  };

  const drawSectionTitle = (title: string, subtitle?: string) => {
    cursorY += sectionTopGap;
    ensureSpace(48);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(22, 28, 45);
    doc.text(title, margin, cursorY);
    cursorY += 16;
    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(92, 101, 120);
      const lines = doc.splitTextToSize(subtitle, contentWidth);
      doc.text(lines, margin, cursorY);
      cursorY += lines.length * 12;
    }
    cursorY += sectionBottomGap;
  };

  const drawParagraph = (text: string) => {
    const lines = doc.splitTextToSize(text, contentWidth);
    ensureSpace(lines.length * 12 + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(70, 77, 92);
    doc.text(lines, margin, cursorY);
    cursorY += lines.length * 12 + blockBottomGap;
  };

  const drawMetricGrid = (items: InstitutionReportMetric[] | InstitutionReportSummaryCard[]) => {
    const columns = 2;
    const gap = 12;
    const cardWidth = (contentWidth - gap) / columns;
    for (let index = 0; index < items.length; index += columns) {
      const rowItems = items.slice(index, index + columns);
      const prepared = rowItems.map(item => {
        const title = 'title' in item ? item.title : item.label;
        const titleLines = doc.splitTextToSize(title, cardWidth - 24);
        const subtitleLines = 'subtitle' in item ? doc.splitTextToSize(item.subtitle, cardWidth - 24) : [];
        const cardHeight = Math.max(70, 24 + titleLines.length * 11 + 18 + subtitleLines.length * 10 + 18);
        return { item, titleLines, subtitleLines, cardHeight };
      });

      const rowHeight = Math.max(...prepared.map(entry => entry.cardHeight));
      ensureSpace(rowHeight + gap);

      prepared.forEach((entry, offset) => {
        const x = margin + offset * (cardWidth + gap);
        const y = cursorY;
        doc.setDrawColor(225, 229, 236);
        doc.setFillColor(250, 251, 252);
        doc.roundedRect(x, y, cardWidth, rowHeight, 10, 10, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(91, 102, 121);
        doc.text(entry.titleLines, x + 12, y + 18);

        const titleHeight = entry.titleLines.length * 11;
        const valueY = y + 18 + titleHeight + 10;
        doc.setFontSize(16);
        doc.setTextColor(22, 28, 45);
        doc.text(entry.item.value, x + 12, valueY);

        if (entry.subtitleLines.length > 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(110, 118, 136);
          doc.text(entry.subtitleLines, x + 12, valueY + 12);
        }
      });

      cursorY += rowHeight + gap;
    }

    cursorY += blockBottomGap;
  };

  const drawTable = (title: string, headers: string[], rows: string[][]) => {
    drawSectionTitle(title);
    if (rows.length === 0) {
      drawParagraph('No data available for the selected period.');
      return;
    }

    const columnWidth = contentWidth / headers.length;
    const drawHeader = () => {
      const headerLines = headers.map(header => doc.splitTextToSize(header, columnWidth - 12));
      const headerHeight = Math.max(20, ...headerLines.map(lines => 10 + lines.length * 9));
      ensureSpace(headerHeight + 12);
      doc.setFillColor(245, 247, 250);
      doc.setDrawColor(225, 229, 236);
      doc.rect(margin, cursorY, contentWidth, headerHeight, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(82, 91, 109);
      headerLines.forEach((lines, index) => {
        doc.text(lines, margin + index * columnWidth + 8, cursorY + 12);
      });
      cursorY += headerHeight;
    };

    drawHeader();

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(54, 63, 82);
    rows.forEach(row => {
      const cellLines = row.map(cell => doc.splitTextToSize(cell || '--', columnWidth - 12).slice(0, 3));
      const rowHeight = Math.max(18, ...cellLines.map(lines => 8 + lines.length * 10));
      if (cursorY + rowHeight > pageHeight - margin - 24) {
        doc.addPage();
        cursorY = margin;
        drawHeader();
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(54, 63, 82);
      }
      doc.setDrawColor(235, 238, 242);
      doc.line(margin, cursorY, margin + contentWidth, cursorY);
      cellLines.forEach((text, index) => {
        doc.text(text, margin + index * columnWidth + 8, cursorY + 12);
      });
      cursorY += rowHeight;
    });
    doc.line(margin, cursorY, margin + contentWidth, cursorY);
    cursorY += blockBottomGap;
  };

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, cursorY, contentWidth, 92, 16, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(report.title, margin + 20, cursorY + 30);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(report.institutionName, margin + 20, cursorY + 50);
  doc.text(`Reporting period: ${report.periodLabel}`, margin + 20, cursorY + 66);
  doc.text(`Generated: ${formatDateTime(report.generatedAt)}`, margin + 20, cursorY + 80);
  cursorY += 112;

  drawSectionTitle('Summary');
  drawMetricGrid(report.summaryCards);

  drawSectionTitle('Applied filters');
  report.filterSummary.forEach(drawParagraph);

  if (report.includedSections.operationalHighlights) {
    drawSectionTitle('Operational highlights');
    if (report.highlights.length === 0) {
      drawParagraph('No notable highlights were generated for the selected period.');
    } else {
      report.highlights.forEach(item => drawParagraph(`- ${item}`));
    }
  }

  if (report.includedSections.executiveSummary) {
    drawSectionTitle('Executive summary');
    drawMetricGrid(report.executiveSummary);
  }

  if (report.includedSections.studentOperations) {
    drawSectionTitle('Students Account List');
    drawMetricGrid(report.studentOperations.metrics);
    if (report.includeTables.students) {
      drawTable(
        'Students Account List',
        ['Name', 'Student No.', 'Department', 'Status', 'Activity'],
        report.studentOperations.allRows.map(row => [row.name, row.studentNumber, row.department, row.status, row.activityDate]),
      );
    }
  }

  if (report.includedSections.requestOperations) {
    drawSectionTitle('Request operations');
    drawMetricGrid(report.requestOperations.metrics);
    if (report.includeTables.requests) {
      drawTable(
        'Requests List',
        ['Title', 'Student', 'Type', 'Delivery', 'Status', 'Created'],
        report.requestOperations.allRows.map(row => [row.title, row.student, row.type, row.delivery, row.status, row.createdAt]),
      );
    }
  }

  if (report.includedSections.credentialIssuance) {
    drawSectionTitle('Credential issuance');
    drawMetricGrid(report.credentialIssuance.metrics);
    if (report.includeTables.credentials) {
      drawTable(
        'Credentials List',
        ['Title', 'Student', 'Type', 'Status', 'Issued', 'Anchored'],
        report.credentialIssuance.allRows.map(row => [row.title, row.student, row.type, row.status, row.issuedAt, row.anchored]),
      );
    }
  }

  if (report.includedSections.deliveryCompletion) {
    drawSectionTitle('Delivery and completion');
    drawMetricGrid(report.deliveryCompletion);
  }

  if (report.includedSections.departmentBreakdown) {
    drawTable(
      'Department breakdown',
      ['Department', 'Students', 'Requests', 'Issued'],
      report.departmentBreakdown.map(entry => [entry.department, String(entry.students), String(entry.requests), String(entry.issued)]),
    );
  }

  if (report.includedSections.credentialTypeBreakdown) {
    drawTable(
      'Credential type breakdown',
      ['Credential type', 'Requests', 'Issued'],
      report.credentialTypeBreakdown.map(entry => [entry.type, String(entry.requests), String(entry.issued)]),
    );
  }

  addFooter(doc);
  const filenameDate = new Date(report.generatedAt).toISOString().slice(0, 10);
  doc.save(`${slugify(report.title)}-${filenameDate}.pdf`);
};
