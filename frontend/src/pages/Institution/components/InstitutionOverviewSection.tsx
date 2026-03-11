import { AlertCircle, Boxes, ClipboardCheck, Download, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../components/common/Card';
import { Credential, CredentialRequest } from '../../../services/credential.service';
import { User } from '../../../services/user.service';
import { getStudentFullName, getUserInitials } from '../utils';

interface InstitutionOverviewSectionProps {
  students: User[];
  requests: CredentialRequest[];
  credentials: Credential[];
  isLoadingStudents: boolean;
  isLoadingRequests: boolean;
  isLoadingCredentials: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const getControlPoint = (
  current: { x: number; y: number },
  previous: { x: number; y: number } | undefined,
  next: { x: number; y: number } | undefined,
  reverse?: boolean,
) => {
  const p = previous || current;
  const n = next || current;
  const smoothing = 0.15;
  const lengthX = n.x - p.x;
  const lengthY = n.y - p.y;
  const length = Math.sqrt(lengthX ** 2 + lengthY ** 2) * smoothing;
  const angle = Math.atan2(lengthY, lengthX) + (reverse ? Math.PI : 0);

  return {
    x: current.x + Math.cos(angle) * length,
    y: current.y + Math.sin(angle) * length,
  };
};

const generateSmoothPath = (points: Array<{ x: number; y: number }>) => {
  if (points.length === 0) return '';

  return points.reduce((acc, point, index, allPoints) => {
    if (index === 0) return `M ${point.x},${point.y}`;
    const cps = getControlPoint(allPoints[index - 1], allPoints[index - 2], point);
    const cpe = getControlPoint(point, allPoints[index - 1], allPoints[index + 1], true);
    return `${acc} C ${cps.x},${cps.y} ${cpe.x},${cpe.y} ${point.x},${point.y}`;
  }, '');
};

const buildSparkline = (counts: number[]) => {
  const max = Math.max(...counts, 1);
  const min = Math.min(...counts, 0);
  const range = Math.max(max - min, 1);
  const points = counts.map((count, index) => {
    const x = (index / Math.max(counts.length - 1, 1)) * 100;
    const normalized = (count - min) / range;
    const y = 92 - normalized * 64;
    return { x, y: Number.isFinite(y) ? y : 100 };
  });
  const pathD = generateSmoothPath(points);
  const areaD = `${pathD} L ${points[points.length - 1].x},100 L ${points[0].x},100 Z`;

  return {
    areaD,
    pathD,
    peak: Math.max(...counts, 0),
  };
};

const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

const formatShortDate = (value: string | null | undefined) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const toCsvCell = (value: string | null | undefined) => {
  const text = (value ?? '').replace(/"/g, '""');
  return `"${text}"`;
};

const mapUserStatusLabel = (status: User['status']) => {
  switch (status) {
    case 'APPROVED':
      return 'Approved';
    case 'PENDING':
      return 'Pending';
    case 'REJECTED':
      return 'Rejected';
    case 'SUSPENDED':
      return 'Suspended';
    default:
      return status;
  }
};

const getOverviewStatusTextClass = (status: User['status'] | CredentialRequest['status']) => {
  switch (status) {
    case 'APPROVED':
    case 'COMPLETED':
      return 'text-emerald-600';
    case 'PENDING':
      return 'text-amber-600';
    case 'REJECTED':
    case 'CANCELLED':
      return 'text-rose-600';
    case 'SUSPENDED':
      return 'text-orange-600';
    default:
      return 'text-neutral-500';
  }
};

const formatStatusText = (status: User['status'] | CredentialRequest['status']) =>
  status.toLowerCase().replace(/_/g, ' ');

export default function InstitutionOverviewSection({
  students,
  requests,
  credentials,
  isLoadingStudents,
  isLoadingRequests,
  isLoadingCredentials,
}: InstitutionOverviewSectionProps) {
  const navigate = useNavigate();
  const isLoading = isLoadingStudents || isLoadingRequests || isLoadingCredentials;
  const now = Date.now();

  const studentById = new Map(students.map(student => [student.id, student]));
  const pendingRequestRecords = requests.filter(request => request.status === 'PENDING');
  const pendingRequests = pendingRequestRecords.length;
  const activeStudents = students.filter(student => student.status === 'APPROVED').length;
  const pendingStudents = students.filter(student => student.status === 'PENDING').length;
  const suspendedStudents = students.filter(student => student.status === 'SUSPENDED').length;
  const isBlockchainCredential = (credential: Credential) =>
    credential.status === 'ISSUED' &&
    Boolean(credential.chain || credential.txHash || credential.anchoredAt || credential.blockNumber !== null);
  const blockchainCredentials = credentials.filter(isBlockchainCredential).length;

  const currentWindowStart = now - 30 * DAY_MS;
  const previousWindowStart = now - 60 * DAY_MS;

  const last7DaysPendingRequestCounts = Array(7).fill(0);
  let previous7DaysPendingRequests = 0;
  pendingRequestRecords.forEach(request => {
    const timeMs = new Date(request.createdAt).getTime();
    const daysAgo = Math.floor((now - timeMs) / DAY_MS);
    if (daysAgo >= 0 && daysAgo < 7) {
      last7DaysPendingRequestCounts[6 - daysAgo] += 1;
    } else if (daysAgo >= 7 && daysAgo < 14) {
      previous7DaysPendingRequests += 1;
    }
  });
  const recentPendingRequests = last7DaysPendingRequestCounts.reduce((sum, value) => sum + value, 0);
  const pendingRequestGrowth = previous7DaysPendingRequests === 0
    ? (recentPendingRequests > 0 ? 100 : 0)
    : ((recentPendingRequests - previous7DaysPendingRequests) / previous7DaysPendingRequests) * 100;
  const pendingRequestGrowthClassName = pendingRequestGrowth >= 0 ? 'text-amber-500' : 'text-rose-500';

  const last7DaysAuthorizedStudentCounts = Array(7).fill(0);
  let previous30DayApprovedStudents = 0;
  let approvedStudentsLast30Days = 0;
  students
    .filter(student => student.status === 'APPROVED')
    .forEach(student => {
      const timeMs = new Date(student.createdAt).getTime();
      const daysAgo = Math.floor((now - timeMs) / DAY_MS);

      if (daysAgo >= 0 && daysAgo < 7) {
        last7DaysAuthorizedStudentCounts[6 - daysAgo] += 1;
      }

      if (timeMs >= currentWindowStart) {
        approvedStudentsLast30Days += 1;
      } else if (timeMs >= previousWindowStart && timeMs < currentWindowStart) {
        previous30DayApprovedStudents += 1;
      }
    });
  const authorizedStudentGrowth = previous30DayApprovedStudents === 0
    ? (approvedStudentsLast30Days > 0 ? 100 : 0)
    : ((approvedStudentsLast30Days - previous30DayApprovedStudents) / previous30DayApprovedStudents) * 100;
  const authorizedStudentGrowthClassName = authorizedStudentGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500';

  const awaitingIssuanceRequests = requests.filter(request => request.status === 'APPROVED');
  const completedRequestRecords = requests.filter(request => request.status === 'COMPLETED');
  const awaitingIssuanceCount = awaitingIssuanceRequests.length;
  const completedRequestsCount = completedRequestRecords.length;

  const last30DaysAwaitingCounts = Array(30).fill(0);
  const last30DaysCompletedCounts = Array(30).fill(0);
  let previous30DaysBlockchainCount = 0;
  let blockchainCredentialsLast30Days = 0;
  const last30DaysBlockchainCounts = Array(30).fill(0);
  let recentAwaitingCount = 0;
  let recentCompletedCount = 0;
  credentials.forEach(credential => {
    const issuedAt = new Date(credential.issuedDate || credential.updatedAt).getTime();
    if (Number.isNaN(issuedAt)) {
      return;
    }

    const daysAgo = Math.floor((now - issuedAt) / DAY_MS);
    if (daysAgo >= 0 && daysAgo < 30) {
      if (isBlockchainCredential(credential)) {
        last30DaysBlockchainCounts[29 - daysAgo] += 1;
        blockchainCredentialsLast30Days += 1;
      }
    } else if (daysAgo >= 30 && daysAgo < 60 && isBlockchainCredential(credential)) {
      previous30DaysBlockchainCount += 1;
    }
  });

  requests.forEach(request => {
    const statusAt = new Date(request.updatedAt || request.createdAt).getTime();
    if (Number.isNaN(statusAt)) {
      return;
    }

    const daysAgo = Math.floor((now - statusAt) / DAY_MS);
    if (daysAgo < 0 || daysAgo >= 30) {
      return;
    }

    if (request.status === 'APPROVED') {
      last30DaysAwaitingCounts[29 - daysAgo] += 1;
      recentAwaitingCount += 1;
    }

    if (request.status === 'COMPLETED') {
      last30DaysCompletedCounts[29 - daysAgo] += 1;
      recentCompletedCount += 1;
    }
  });

  const blockchainGrowth = previous30DaysBlockchainCount === 0
    ? (blockchainCredentialsLast30Days > 0 ? 100 : 0)
    : ((blockchainCredentialsLast30Days - previous30DaysBlockchainCount) / previous30DaysBlockchainCount) * 100;
  const blockchainGrowthClassName = blockchainGrowth >= 0 ? 'text-cyan-500' : 'text-rose-500';

  const awaitingComparisonPercent = completedRequestsCount === 0
    ? (awaitingIssuanceCount > 0 ? 100 : 0)
    : ((awaitingIssuanceCount - completedRequestsCount) / completedRequestsCount) * 100;
  const awaitingComparisonClassName = awaitingComparisonPercent > 0
    ? 'text-amber-500'
    : awaitingComparisonPercent < 0
      ? 'text-emerald-500'
      : 'text-neutral-400';

  const pendingRequestSparkline = buildSparkline(last7DaysPendingRequestCounts);
  const authorizedStudentsSparkline = buildSparkline(last7DaysAuthorizedStudentCounts);
  const blockchainSparkline = buildSparkline(last30DaysBlockchainCounts);
  const awaitingCompletedTotal = awaitingIssuanceCount + completedRequestsCount;
  const awaitingSharePercent = awaitingCompletedTotal === 0
    ? 0
    : (awaitingIssuanceCount / awaitingCompletedTotal) * 100;
  const completedSharePercent = awaitingCompletedTotal === 0
    ? 0
    : (completedRequestsCount / awaitingCompletedTotal) * 100;

  const recentPendingRequestStudents = Array.from(
    new Set(
      [...pendingRequestRecords]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map(request => request.studentId),
    ),
  )
    .map(studentId => studentById.get(studentId))
    .filter((student): student is User => Boolean(student));

  const recentRequestRows = [...requests]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map(request => ({
      request,
      student: studentById.get(request.studentId) || null,
    }));

  const lastIssuedByStudentId = new Map<string, string>();
  credentials
    .filter(credential => credential.status === 'ISSUED')
    .sort(
      (a, b) =>
        new Date(b.issuedDate || b.updatedAt).getTime() -
        new Date(a.issuedDate || a.updatedAt).getTime(),
    )
    .forEach(credential => {
      if (!lastIssuedByStudentId.has(credential.studentId)) {
        lastIssuedByStudentId.set(credential.studentId, credential.issuedDate || credential.updatedAt);
      }
    });

  const directoryRows = [...students]
    .sort((a, b) => {
      const aTs = new Date(lastIssuedByStudentId.get(a.id) || a.updatedAt).getTime();
      const bTs = new Date(lastIssuedByStudentId.get(b.id) || b.updatedAt).getTime();
      if (Number.isNaN(aTs) && Number.isNaN(bTs)) return 0;
      if (Number.isNaN(aTs)) return 1;
      if (Number.isNaN(bTs)) return -1;
      return bTs - aTs;
    })
    .slice(0, 5);

  const handleDownloadStudentDirectory = () => {
    const rows = [...students]
      .sort((a, b) => getStudentFullName(a).localeCompare(getStudentFullName(b)))
      .map(student => {
        const lastIssued = lastIssuedByStudentId.get(student.id) || '';
        return [
          getStudentFullName(student),
          student.email,
          student.profile?.studentNumber || '',
          student.profile?.courseOfStudy || '',
          student.profile?.department || '',
          student.profile?.yearLevel || '',
          mapUserStatusLabel(student.status),
          formatShortDate(lastIssued),
        ];
      });

    const header = [
      'Student Name',
      'Email',
      'Student ID',
      'Program',
      'Department',
      'Year Level',
      'Status',
      'Last Issued',
    ];

    const csv = [header, ...rows]
      .map(columns => columns.map(value => toCsvCell(value)).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `institution-student-directory-${stamp}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <h3 className="text-[13px] font-semibold text-neutral-500">Pending Requests</h3>
            <AlertCircle size={18} className="text-amber-500" />
          </div>
          <div className="mt-4 mb-3">
            <p className="text-3xl font-bold tracking-tight text-neutral-900">{pendingRequests.toLocaleString()}</p>
            <p className="mt-1 text-[11px] font-bold text-neutral-400">
              <span className={pendingRequestGrowthClassName}>{formatPercent(pendingRequestGrowth)}</span> LAST 7 DAYS
            </p>
          </div>
          <div className="mb-3 h-8 w-full">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
              <defs>
                <linearGradient id="institutionPendingSparkline" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgb(245 158 11)" stopOpacity="0.24" />
                  <stop offset="100%" stopColor="rgb(245 158 11)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {!isLoadingRequests && (
                <g className="animate-sparkline">
                  <path fill="url(#institutionPendingSparkline)" d={pendingRequestSparkline.areaD} />
                  <path
                    vectorEffect="non-scaling-stroke"
                    fill="none"
                    stroke="rgb(245 158 11)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={pendingRequestSparkline.pathD}
                  />
                </g>
              )}
            </svg>
          </div>
          <div className="mt-auto flex items-center justify-between gap-3">
            <div className="flex h-7 items-center">
              {recentPendingRequestStudents.length > 0 ? (
                <>
                  {recentPendingRequestStudents.slice(0, 2).map((student, index) => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => navigate('/institution/requests')}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-700 text-[10px] font-bold text-white shadow-sm transition-transform hover:-translate-y-0.5 ${index > 0 ? '-ml-2' : ''}`}
                      title={`Open requests for ${getStudentFullName(student)}`}
                    >
                      {getUserInitials(student)}
                    </button>
                  ))}
                  {recentPendingRequestStudents.length > 2 && (
                    <button
                      type="button"
                      onClick={() => navigate('/institution/requests')}
                      className="-ml-2 flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-neutral-100 px-1.5 text-[10px] font-bold text-neutral-600 shadow-sm transition-colors hover:bg-neutral-200"
                      title={`View ${pendingRequests} pending requests`}
                    >
                      +{recentPendingRequestStudents.length - 2}
                    </button>
                  )}
                </>
              ) : (
                <span className="text-[11px] text-neutral-400">No pending queue</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate('/institution/requests')}
              className="text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-400 transition hover:text-neutral-600"
            >
              Open queue
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <h3 className="text-[13px] font-semibold text-neutral-500">Authorized Students</h3>
            <GraduationCap size={18} className="text-cyan-600" />
          </div>
          <div className="mt-4 mb-3">
            <p className="text-3xl font-bold tracking-tight text-neutral-900">{activeStudents.toLocaleString()}</p>
            <p className="mt-1 text-[11px] font-bold text-neutral-400">
              <span className={authorizedStudentGrowthClassName}>{formatPercent(authorizedStudentGrowth)}</span> LAST MONTH
            </p>
          </div>
          <div className="mb-3 h-8 w-full">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
              <defs>
                <linearGradient id="institutionStudentsSparkline" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgb(8 145 178)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="rgb(8 145 178)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {!isLoadingStudents && (
                <g className="animate-sparkline">
                  <path fill="url(#institutionStudentsSparkline)" d={authorizedStudentsSparkline.areaD} />
                  <path
                    vectorEffect="non-scaling-stroke"
                    fill="none"
                    stroke="rgb(8 145 178)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={authorizedStudentsSparkline.pathD}
                  />
                </g>
              )}
            </svg>
          </div>
          <div className="mt-auto text-[10px] font-medium text-neutral-500">
            Pending: {pendingStudents.toLocaleString()} &nbsp; Suspended: {suspendedStudents.toLocaleString()}
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <h3 className="text-[13px] font-semibold text-neutral-500">Blockchain Credentials</h3>
            <Boxes size={18} className="text-cyan-600" />
          </div>
          <div className="mt-4 mb-3">
            <p className="text-3xl font-bold tracking-tight text-neutral-900">{blockchainCredentials.toLocaleString()}</p>
            <p className="mt-1 text-[11px] font-bold text-neutral-400">
              <span className={blockchainGrowthClassName}>{formatPercent(blockchainGrowth)}</span> LAST MONTH
            </p>
          </div>
          <div className="mb-3 h-8 w-full">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
              <defs>
                <linearGradient id="institutionBlockchainSparkline" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgb(6 182 212)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="rgb(6 182 212)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {!isLoadingCredentials && (
                <g className="animate-sparkline">
                  <path fill="url(#institutionBlockchainSparkline)" d={blockchainSparkline.areaD} />
                  <path
                    vectorEffect="non-scaling-stroke"
                    fill="none"
                    stroke="rgb(6 182 212)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={blockchainSparkline.pathD}
                  />
                </g>
              )}
            </svg>
          </div>
          <div className="mt-auto flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-400">
            <span>Anchored</span>
            <span>{blockchainSparkline.peak} peak</span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <h3 className="text-[13px] font-semibold text-neutral-500">Awaiting Issuance</h3>
            <ClipboardCheck size={18} className="text-emerald-500" />
          </div>
          <div className="mt-4 mb-3">
            <p className="text-3xl font-bold tracking-tight text-neutral-900">{awaitingIssuanceCount.toLocaleString()}</p>
            <p className="mt-1 text-[11px] font-bold text-neutral-400">
              <span className={awaitingComparisonClassName}>{formatPercent(awaitingComparisonPercent)}</span> VS COMPLETED
            </p>
          </div>
          <div className="mb-3 space-y-2.5">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-[11px] font-semibold">
                <span className="uppercase tracking-[0.08em] text-amber-500">
                  Awaiting {awaitingIssuanceCount.toLocaleString()}
                </span>
                <span className="text-amber-500">{awaitingSharePercent.toFixed(0)}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-amber-500 transition-[width] duration-500 ease-out"
                  style={{ width: `${awaitingSharePercent}%` }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-[11px] font-semibold">
                <span className="uppercase tracking-[0.08em] text-emerald-500">
                  Completed {completedRequestsCount.toLocaleString()}
                </span>
                <span className="text-emerald-500">{completedSharePercent.toFixed(0)}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width] duration-500 ease-out"
                  style={{ width: `${completedSharePercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 xl:h-full">
          <Card
            className="flex h-full flex-col"
            title="Institution Student Directory"
            action={
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/institution/students')}
                  className="inline-flex h-9 items-center rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                >
                  See More
                </button>
                <button
                  type="button"
                  onClick={handleDownloadStudentDirectory}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                  aria-label="Download full student directory"
                  title="Download full student directory"
                >
                  <Download size={16} />
                  Download List
                </button>
              </div>
            }
          >
            {isLoading && (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(key => (
                  <div key={key} className="h-14 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />
                ))}
              </div>
            )}

            {!isLoading && directoryRows.length === 0 && (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-12 text-sm text-neutral-500">
                No students found.
              </div>
            )}

            {!isLoading && directoryRows.length > 0 && (
              <div className="flex h-full flex-col">
                <div className="overflow-x-auto rounded-lg border border-neutral-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-neutral-50 text-xs font-semibold text-neutral-500">
                      <tr>
                        <th className="px-4 py-3">Student</th>
                        <th className="hidden px-4 py-3 sm:table-cell">Student ID</th>
                        <th className="hidden px-4 py-3 md:table-cell">Program</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 bg-white">
                      {directoryRows.map(student => (
                        <tr key={student.id} className="hover:bg-neutral-50/50">
                          <td className="px-4 py-3 font-medium text-neutral-900">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-xs font-bold text-neutral-700">
                                {getUserInitials(student)}
                              </div>
                              <div>
                                <p className="font-semibold text-neutral-900">{getStudentFullName(student)}</p>
                                <p className="text-xs text-neutral-500">{student.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 text-neutral-600 sm:table-cell">
                            {student.profile?.studentNumber || '--'}
                          </td>
                          <td className="hidden px-4 py-3 text-neutral-600 md:table-cell">
                            {student.profile?.courseOfStudy || '--'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${getOverviewStatusTextClass(student.status)}`}>
                              {formatStatusText(student.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-auto border-t border-neutral-200 pt-3 text-xs text-neutral-500">
                  Showing {directoryRows.length} of {students.length.toLocaleString()} students
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="xl:h-full">
          <Card
            className="flex h-full flex-col"
            title="Recent Requests"
            action={
              <button
                type="button"
                onClick={() => navigate('/institution/requests')}
                className="inline-flex h-9 items-center rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
              >
                See More
              </button>
            }
          >
            {isLoadingRequests && (
              <div className="space-y-3">
                {[1, 2, 3].map(key => (
                  <div key={key} className="h-16 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />
                ))}
              </div>
            )}

            {!isLoadingRequests && recentRequestRows.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 px-4 py-10 text-center">
                <AlertCircle size={24} className="mb-2 text-neutral-400" />
                <p className="text-sm font-medium text-neutral-600">No recent credential requests</p>
                <p className="mt-1 text-xs text-neutral-400">New request activity will appear here.</p>
              </div>
            )}

            {!isLoadingRequests && recentRequestRows.length > 0 && (
              <div className="flex h-full flex-col">
                <div className="space-y-2">
                  {recentRequestRows.map(({ request, student }) => (
                    <div key={request.id} className="rounded-lg border border-neutral-200 bg-white px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-xs font-bold text-neutral-700">
                              {student ? getUserInitials(student) : 'NA'}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-neutral-900">
                                {student ? getStudentFullName(student) : 'Student unavailable'}
                              </p>
                              <p className="truncate text-xs text-neutral-500">{request.title || request.type}</p>
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-neutral-500">
                            {formatShortDate(request.createdAt)} · {request.deliveryMethod}
                          </p>
                        </div>
                        <span className={`shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] ${getOverviewStatusTextClass(request.status)}`}>
                          {formatStatusText(request.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
