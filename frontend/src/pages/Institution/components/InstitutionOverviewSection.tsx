import { BookCheck, Clock3, FileCheck2, GraduationCap, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import Card from '../../../components/common/Card';
import { Credential, CredentialRequest } from '../../../services/credential.service';
import { User } from '../../../services/user.service';
import { formatDateTime, getStudentFullName } from '../utils';

interface InstitutionOverviewSectionProps {
  students: User[];
  requests: CredentialRequest[];
  credentials: Credential[];
  isLoadingStudents: boolean;
  isLoadingRequests: boolean;
  isLoadingCredentials: boolean;
}

const isToday = (value: string | null | undefined) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
  );
};

export default function InstitutionOverviewSection({
  students,
  requests,
  credentials,
  isLoadingStudents,
  isLoadingRequests,
  isLoadingCredentials,
}: InstitutionOverviewSectionProps) {
  const isLoading = isLoadingStudents || isLoadingRequests || isLoadingCredentials;
  const studentById = new Map(students.map(student => [student.id, student] as const));

  const approvedStudents = students.filter(student => student.status === 'APPROVED').length;
  const pendingStudents = students.filter(student => student.status === 'PENDING').length;
  const pendingRequests = requests.filter(request => request.status === 'PENDING').length;
  const approvedRequests = requests.filter(request => request.status === 'APPROVED').length;
  const completedRequests = requests.filter(request => request.status === 'COMPLETED').length;
  const issuedCredentials = credentials.filter(credential => credential.status === 'ISSUED').length;
  const requestsProcessedToday = requests.filter(request => isToday(request.processedAt || request.updatedAt)).length;

  const latestRequests = [...requests]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const latestIssuedCredentials = credentials
    .filter(credential => credential.status === 'ISSUED')
    .sort((a, b) => {
      const aTime = new Date(a.issuedDate || a.updatedAt).getTime();
      const bTime = new Date(b.issuedDate || b.updatedAt).getTime();
      return bTime - aTime;
    })
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="flex h-full flex-col border-slate-200 bg-white text-slate-900 shadow-[0_10px_28px_rgba(15,23,42,0.08)] hover:shadow-[0_14px_34px_rgba(15,23,42,0.12)]">
          <div className="flex items-center gap-2 text-slate-700">
            <GraduationCap size={18} />
            <p className="text-lg font-semibold">Students</p>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Manage student records and onboarding from one place.
          </p>
          <p className="mt-4 text-3xl font-bold">{students.length}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.08em] text-slate-500">
            {approvedStudents} approved · {pendingStudents} pending
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
            <Link
              to="/institution/students"
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-black"
            >
              Add Student
            </Link>
            <Link
              to="/institution/students"
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Manage
            </Link>
          </div>
        </Card>

        <Card className="flex h-full flex-col border-slate-200 bg-white text-slate-900 shadow-[0_10px_28px_rgba(15,23,42,0.08)] hover:shadow-[0_14px_34px_rgba(15,23,42,0.12)]">
          <div className="flex items-center gap-2 text-slate-700">
            <Clock3 size={18} />
            <p className="text-lg font-semibold">Requests Queue</p>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Review and process credential requests faster.
          </p>
          <p className="mt-4 text-3xl font-bold">{pendingRequests}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.08em] text-slate-500">
            {approvedRequests} ready to issue
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
            <Link
              to="/institution/requests"
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-black"
            >
              Review Requests
            </Link>
            <Link
              to="/institution/requests"
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Open Queue
            </Link>
          </div>
        </Card>

        <Card className="flex h-full flex-col border-slate-200 bg-white text-slate-900 shadow-[0_10px_28px_rgba(15,23,42,0.08)] hover:shadow-[0_14px_34px_rgba(15,23,42,0.12)]">
          <div className="flex items-center gap-2 text-slate-700">
            <FileCheck2 size={18} />
            <p className="text-lg font-semibold">Credential Issuance</p>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Issue and re-issue credentials for approved requests.
          </p>
          <p className="mt-4 text-3xl font-bold">{issuedCredentials}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.08em] text-slate-500">
            {completedRequests} completed requests
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
            <Link
              to="/institution/issue"
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-black"
            >
              Issue Credential
            </Link>
            <Link
              to="/institution/issue"
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Open Issuance
            </Link>
          </div>
        </Card>

        <Card className="flex h-full flex-col border-slate-200 bg-white text-slate-900 shadow-[0_10px_28px_rgba(15,23,42,0.08)] hover:shadow-[0_14px_34px_rgba(15,23,42,0.12)]">
          <div className="flex items-center gap-2 text-slate-700">
            <BookCheck size={18} />
            <p className="text-lg font-semibold">Operations</p>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Monitor today&apos;s processing and institution activity.
          </p>
          <p className="mt-4 text-3xl font-bold">{requestsProcessedToday}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.08em] text-slate-500">
            Processed today · {requests.length} total requests
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
            <Link
              to="/institution/analytics"
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-black"
            >
              View Analytics
            </Link>
            <Link
              to="/institution/logs"
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Audit Logs
            </Link>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Latest Requests">
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(key => (
                <div key={key} className="h-14 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
              ))}
            </div>
          )}
          {!isLoading && latestRequests.length === 0 && (
            <p className="text-sm text-slate-500">No requests yet.</p>
          )}
          {!isLoading && latestRequests.length > 0 && (
            <div className="space-y-2">
              {latestRequests.map(request => {
                const student = studentById.get(request.studentId);
                return (
                  <div key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{request.title}</p>
                        <p className="text-xs text-slate-500">
                          {student ? getStudentFullName(student) : request.studentId}
                        </p>
                      </div>
                      <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                        {request.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{formatDateTime(request.createdAt)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Recent Issued Credentials">
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(key => (
                <div key={key} className="h-14 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
              ))}
            </div>
          )}
          {!isLoading && latestIssuedCredentials.length === 0 && (
            <p className="text-sm text-slate-500">No issued credentials yet.</p>
          )}
          {!isLoading && latestIssuedCredentials.length > 0 && (
            <div className="space-y-2">
              {latestIssuedCredentials.map(credential => {
                const student = studentById.get(credential.studentId);
                return (
                  <div key={credential.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{credential.title}</p>
                        <p className="text-xs text-slate-500">
                          {student ? getStudentFullName(student) : credential.studentId}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                        <ShieldCheck size={12} />
                        ISSUED
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {formatDateTime(credential.issuedDate || credential.updatedAt)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
