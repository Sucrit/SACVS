import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { BriefcaseBusiness, Clock3, ClipboardList, RefreshCw, AlertCircle } from 'lucide-react';
import { CredentialRequest, CredentialService } from '../../services/credential.service';
import { AuditAction, AuditLogEntry, AuditService, AuditSeverity } from '../../services/audit.service';

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

const getRequesterLabel = (request: CredentialRequest) => {
  if (request.metadata && typeof request.metadata.requesterType === 'string') {
    return request.metadata.requesterType;
  }

  return 'EMPLOYER';
};

export default function EmployerDashboard() {
  const location = useLocation();
  const section = location.pathname.includes('/employer/logs') ? 'logs' : 'overview';
  const [requests, setRequests] = useState<CredentialRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState<'ALL' | AuditAction>('ALL');
  const [auditSeverityFilter, setAuditSeverityFilter] = useState<'ALL' | AuditSeverity>('ALL');
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(20);

  const loadRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    setRequestsError(null);

    try {
      const data = await CredentialService.listRequests();
      setRequests(data.filter(request => getRequesterLabel(request) === 'EMPLOYER'));
    } catch (error) {
      console.error('Failed to load employer requests:', error);
      setRequests([]);
      setRequestsError('Unable to load employer request activity from the server.');
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    if (section === 'logs') return;
    void loadRequests();
  }, [loadRequests, section]);

  const loadAuditLogs = useCallback(async () => {
    setIsLoadingAuditLogs(true);
    setRequestsError(null);
    try {
      const data = await AuditService.list();
      setAuditLogs(data);
    } catch (error) {
      console.error('Failed to load employer audit logs:', error);
      setAuditLogs([]);
      setRequestsError('Unable to load employer audit logs from the server.');
    } finally {
      setIsLoadingAuditLogs(false);
    }
  }, []);

  useEffect(() => {
    if (section !== 'logs') return;
    void loadAuditLogs();
  }, [loadAuditLogs, section]);

  const employerAuditActionOptions = useMemo(
    () =>
      ['ALL', ...Array.from(new Set(auditLogs.map(log => log.action))).sort()] as Array<
        'ALL' | AuditAction
      >,
    [auditLogs],
  );

  const filteredEmployerAuditLogs = useMemo(
    () =>
      auditLogs.filter(log => {
        if (auditActionFilter !== 'ALL' && log.action !== auditActionFilter) return false;
        if (auditSeverityFilter !== 'ALL' && log.severity !== auditSeverityFilter) return false;
        return true;
      }),
    [auditActionFilter, auditLogs, auditSeverityFilter],
  );

  const totalEmployerAuditPages = Math.max(1, Math.ceil(filteredEmployerAuditLogs.length / auditPageSize));
  const currentEmployerAuditPage = Math.min(auditPage, totalEmployerAuditPages);
  const pagedEmployerAuditLogs = useMemo(() => {
    const start = (currentEmployerAuditPage - 1) * auditPageSize;
    return filteredEmployerAuditLogs.slice(start, start + auditPageSize);
  }, [auditPageSize, currentEmployerAuditPage, filteredEmployerAuditLogs]);

  useEffect(() => {
    setAuditPage(1);
  }, [auditActionFilter, auditSeverityFilter, auditPageSize]);

  const totalRequests = requests.length;
  const pendingRequests = requests.filter(request => request.status === 'PENDING').length;
  const completedRequests = requests.filter(
    request => request.status === 'COMPLETED' || request.status === 'APPROVED',
  ).length;

  const recentRequests = useMemo(() => {
    return [...requests]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8);
  }, [requests]);

  if (section === 'logs') {
    return (
      <div className="space-y-6">
        {requestsError && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle size={16} />
            {requestsError}
          </div>
        )}

        <Card
          title="Employer Audit Logs"
          action={
            <button
              onClick={loadAuditLogs}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          }
        >
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Action</label>
              <select
                value={auditActionFilter}
                onChange={event => setAuditActionFilter(event.target.value as 'ALL' | AuditAction)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
              >
                {employerAuditActionOptions.map(action => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Severity</label>
              <select
                value={auditSeverityFilter}
                onChange={event => setAuditSeverityFilter(event.target.value as 'ALL' | AuditSeverity)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
              >
                {(['ALL', 'INFO', 'WARNING', 'CRITICAL'] as const).map(severity => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Page Size</label>
              <select
                value={auditPageSize}
                onChange={event => setAuditPageSize(Number(event.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
              >
                {[10, 20, 50].map(size => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {filteredEmployerAuditLogs.length} entries
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Severity</th>
                  <th className="px-5 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {isLoadingAuditLogs && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">
                      Loading audit logs...
                    </td>
                  </tr>
                )}
                {!isLoadingAuditLogs && filteredEmployerAuditLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">
                      No employer audit logs found.
                    </td>
                  </tr>
                )}
                {!isLoadingAuditLogs &&
                  pagedEmployerAuditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4 text-sm text-slate-600">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">{log.action}</td>
                      <td className="px-5 py-4 text-sm text-slate-700">{log.severity}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{log.description || '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!isLoadingAuditLogs && filteredEmployerAuditLogs.length > 0 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Page {currentEmployerAuditPage} of {totalEmployerAuditPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAuditPage(previous => Math.max(1, previous - 1))}
                  disabled={currentEmployerAuditPage <= 1}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setAuditPage(previous => Math.min(totalEmployerAuditPages, previous + 1))}
                  disabled={currentEmployerAuditPage >= totalEmployerAuditPages}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-900 bg-slate-900 text-white" title="Employer Overview">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-2xl font-semibold text-white">Employer Verification Workspace</p>
            <p className="mt-1 text-sm text-slate-300">Track your credential verification requests and responses.</p>
          </div>
          <button
            onClick={loadRequests}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </Card>

      {requestsError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} />
          {requestsError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Card title="Total Requests">
          <div className="flex items-center justify-between">
            <p className="text-3xl font-bold text-slate-900">{totalRequests}</p>
            <BriefcaseBusiness size={20} className="text-slate-700" />
          </div>
        </Card>

        <Card title="Pending">
          <div className="flex items-center justify-between">
            <p className="text-3xl font-bold text-amber-700">{pendingRequests}</p>
            <Clock3 size={20} className="text-amber-700" />
          </div>
        </Card>

        <Card title="Processed">
          <div className="flex items-center justify-between">
            <p className="text-3xl font-bold text-emerald-700">{completedRequests}</p>
            <ClipboardList size={20} className="text-emerald-700" />
          </div>
        </Card>
      </div>

      <Card title="Recent Employer Requests">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoadingRequests && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">
                    Loading requests...
                  </td>
                </tr>
              )}
              {!isLoadingRequests && recentRequests.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">
                    No employer requests found.
                  </td>
                </tr>
              )}
              {!isLoadingRequests &&
                recentRequests.map(request => (
                  <tr key={request.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">{request.title}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{request.type}</td>
                    <td className="px-5 py-4">
                      <Badge status={request.status} />
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{formatDate(request.updatedAt)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
