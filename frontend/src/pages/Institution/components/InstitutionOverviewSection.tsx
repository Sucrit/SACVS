import { AlertCircle, Boxes, Download, GraduationCap, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import { Credential, CredentialRequest } from '../../../services/credential.service';
import { User } from '../../../services/user.service';
import { getStudentFullName } from '../utils';

interface InstitutionOverviewSectionProps {
  students: User[];
  requests: CredentialRequest[];
  credentials: Credential[];
  isLoadingStudents: boolean;
  isLoadingRequests: boolean;
  isLoadingCredentials: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

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

  const pendingRequests = requests.filter(request => request.status === 'PENDING').length;
  const activeStudents = students.filter(student => student.status === 'APPROVED').length;
  const blockchainCredentials = credentials.filter(credential => credential.status === 'ISSUED').length;

  const issuedWithin = (fromTs: number, toTs: number) =>
    credentials.filter(credential => {
      const ts = new Date(credential.issuedDate || credential.updatedAt).getTime();
      return !Number.isNaN(ts) && ts >= fromTs && ts < toTs;
    }).length;

  const currentWindowStart = now - 30 * DAY_MS;
  const previousWindowStart = now - 60 * DAY_MS;
  const currentIssued = issuedWithin(currentWindowStart, now);
  const previousIssued = issuedWithin(previousWindowStart, currentWindowStart);
  const issuanceTrendPercent =
    previousIssued === 0
      ? (currentIssued > 0 ? 100 : 0)
      : ((currentIssued - previousIssued) / previousIssued) * 100;

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
    .slice(0, 6);

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
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <AlertCircle size={18} />
            </span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Pending Requests</p>
          <p className="mt-2 text-4xl font-bold text-slate-900">{pendingRequests}</p>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <GraduationCap size={18} />
            </span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Total Authorized Students</p>
          <p className="mt-2 text-4xl font-bold text-slate-900">{activeStudents.toLocaleString()}</p>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Boxes size={18} />
            </span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Blockchain Credentials</p>
          <p className="mt-2 text-4xl font-bold text-slate-900">{blockchainCredentials.toLocaleString()}</p>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <TrendingUp size={18} />
            </span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Issuance Trend</p>
          <p className="mt-2 text-4xl font-bold text-slate-900">{formatPercent(issuanceTrendPercent)}</p>
        </Card>
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <p className="text-xl font-semibold text-slate-900">Institution's Student Directory</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/institution/students')}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
            >
              See More
            </button>
            <button
              type="button"
              onClick={handleDownloadStudentDirectory}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Download full student directory"
              title="Download full student directory"
            >
              <Download size={16} />
              Download Student List
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-2 px-5 py-4">
            {[1, 2, 3, 4, 5].map(key => (
              <div key={key} className="h-12 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
            ))}
          </div>
        )}

        {!isLoading && directoryRows.length === 0 && (
          <div className="px-5 py-10 text-sm text-slate-500">No students found.</div>
        )}

        {!isLoading && directoryRows.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-slate-500">
                    <th className="px-5 py-3 font-semibold">Student Name</th>
                    <th className="px-5 py-3 font-semibold">Student ID</th>
                    <th className="px-5 py-3 font-semibold">Program</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Last Issued</th>
                  </tr>
                </thead>
                <tbody>
                  {directoryRows.map(student => (
                    <tr key={student.id} className="border-t border-slate-100 text-sm text-slate-700">
                      <td className="px-5 py-3 align-top">
                        <p className="font-semibold text-slate-900">{getStudentFullName(student)}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{student.email}</p>
                      </td>
                      <td className="px-5 py-3 align-top text-slate-600">
                        {student.profile?.studentNumber || '--'}
                      </td>
                      <td className="px-5 py-3 align-top text-slate-600">
                        {student.profile?.courseOfStudy || '--'}
                      </td>
                      <td className="px-5 py-3 align-top">
                        <Badge status={student.status} />
                      </td>
                      <td className="px-5 py-3 align-top text-slate-600">
                        {formatShortDate(lastIssuedByStudentId.get(student.id))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
              Showing {directoryRows.length} of {students.length.toLocaleString()} students
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
