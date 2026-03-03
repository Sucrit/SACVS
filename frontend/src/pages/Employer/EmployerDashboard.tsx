import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import {
  BriefcaseBusiness,
  Clock3,
  ClipboardList,
  AlertCircle,
  QrCode,
  Camera,
  CameraOff,
} from 'lucide-react';
import {
  CredentialRequest,
  CredentialService,
  QrVerificationResult,
} from '../../services/credential.service';
import { AuditAction, AuditLogEntry, AuditService, AuditSeverity } from '../../services/audit.service';
import { realtimeService } from '../../services/realtime.service';

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
  const [hasLoadedRequests, setHasLoadedRequests] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [hasLoadedAuditLogs, setHasLoadedAuditLogs] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState<'ALL' | AuditAction>('ALL');
  const [auditSeverityFilter, setAuditSeverityFilter] = useState<'ALL' | AuditSeverity>('ALL');
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(20);
  const [qrInput, setQrInput] = useState('');
  const [isVerifyingQr, setIsVerifyingQr] = useState(false);
  const [qrVerificationResult, setQrVerificationResult] = useState<QrVerificationResult | null>(null);
  const [qrVerificationError, setQrVerificationError] = useState<string | null>(null);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);
  const refreshTimersRef = useRef<Record<'requests' | 'logs', number | null>>({
    requests: null,
    logs: null,
  });

  const extractToken = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    try {
      const parsed = new URL(trimmed);
      const parts = parsed.pathname.split('/').filter(Boolean);
      const token = parts[parts.length - 1] || '';
      return decodeURIComponent(token);
    } catch {
      return decodeURIComponent(trimmed);
    }
  };

  const handleVerifyQr = useCallback(
    async (value?: string) => {
      const source = typeof value === 'string' ? value : qrInput;
      const token = extractToken(source);
      if (!token) {
        setQrVerificationError('Enter a QR verification URL or token.');
        setQrVerificationResult(null);
        return;
      }

      setIsVerifyingQr(true);
      setQrVerificationError(null);
      try {
        const result = await CredentialService.verifyQrEmployer(token);
        setQrVerificationResult(result);
      } catch (error: any) {
        const message =
          error?.response?.data?.error ||
          error?.message ||
          'Unable to verify one-time QR token.';
        setQrVerificationError(message);
        setQrVerificationResult(null);
      } finally {
        setIsVerifyingQr(false);
      }
    },
    [qrInput],
  );

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      await scanner.stop();
      await scanner.clear();
    } catch {
      // Ignore scanner stop/clear failures.
    } finally {
      scannerRef.current = null;
      setIsScannerActive(false);
    }
  }, []);

  const startScanner = useCallback(async () => {
    setScannerError(null);
    if (isScannerActive) {
      await stopScanner();
      return;
    }

    try {
      const moduleName = 'html5-qrcode';
      const scannerModule: any = await import(/* @vite-ignore */ moduleName);
      const Html5Qrcode = scannerModule.Html5Qrcode;
      const scanner = new Html5Qrcode('employer-qr-scanner');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 220 },
        async (decodedText: string) => {
          setQrInput(decodedText);
          await handleVerifyQr(decodedText);
          await stopScanner();
        },
        () => {
          // no-op decode error callback
        },
      );
      setIsScannerActive(true);
    } catch {
      setScannerError('Camera scan unavailable. You can still paste token or URL.');
      setIsScannerActive(false);
      scannerRef.current = null;
    }
  }, [handleVerifyQr, isScannerActive, stopScanner]);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  const loadRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    setRequestsError(null);

    try {
      const data = await CredentialService.listRequests();
      setRequests(data.filter(request => getRequesterLabel(request) === 'EMPLOYER'));
      setHasLoadedRequests(true);
    } catch (error) {
      console.error('Failed to load employer requests:', error);
      setRequests([]);
      setRequestsError('Unable to load employer request activity from the server.');
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    if (section === 'logs' || hasLoadedRequests) return;
    void loadRequests();
  }, [hasLoadedRequests, loadRequests, section]);

  const loadAuditLogs = useCallback(async () => {
    setIsLoadingAuditLogs(true);
    setRequestsError(null);
    try {
      const data = await AuditService.list();
      setAuditLogs(data);
      setHasLoadedAuditLogs(true);
    } catch (error) {
      console.error('Failed to load employer audit logs:', error);
      setAuditLogs([]);
      setRequestsError('Unable to load employer audit logs from the server.');
    } finally {
      setIsLoadingAuditLogs(false);
    }
  }, []);

  useEffect(() => {
    if (section !== 'logs' || hasLoadedAuditLogs) return;
    void loadAuditLogs();
  }, [hasLoadedAuditLogs, loadAuditLogs, section]);

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

  const scheduleRefresh = useCallback((key: 'requests' | 'logs') => {
    if (refreshTimersRef.current[key]) return;
    refreshTimersRef.current[key] = window.setTimeout(() => {
      refreshTimersRef.current[key] = null;
      if (key === 'requests' && section !== 'logs') {
        void loadRequests();
      }
      if (key === 'logs' && section === 'logs') {
        void loadAuditLogs();
      }
    }, 350);
  }, [loadAuditLogs, loadRequests, section]);

  useEffect(() => {
    const unsubscribe = realtimeService.subscribe(event => {
      if (event.domain === 'credentialRequests' || event.domain === 'credentials') {
        scheduleRefresh('requests');
      }
      if (event.domain === 'audit') {
        scheduleRefresh('logs');
      }
    });
    return () => {
      unsubscribe();
      (Object.keys(refreshTimersRef.current) as Array<'requests' | 'logs'>).forEach(key => {
        const timer = refreshTimersRef.current[key];
        if (timer) {
          window.clearTimeout(timer);
          refreshTimersRef.current[key] = null;
        }
      });
    };
  }, [scheduleRefresh]);

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

      <Card title="Verify Student Credential via One-Time QR">
        <div className="space-y-3">
          <div className="flex flex-col gap-2 md:flex-row">
            <input
              type="text"
              value={qrInput}
              onChange={event => setQrInput(event.target.value)}
              placeholder="Paste one-time QR URL or raw token"
              className="h-10 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:border-slate-300"
            />
            <button
              onClick={() => void handleVerifyQr()}
              disabled={isVerifyingQr}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-900 bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <QrCode size={16} />
              {isVerifyingQr ? 'Verifying...' : 'Verify'}
            </button>
            <button
              onClick={() => void startScanner()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              {isScannerActive ? <CameraOff size={16} /> : <Camera size={16} />}
              {isScannerActive ? 'Stop Camera' : 'Scan with Camera'}
            </button>
          </div>

          <div
            id="employer-qr-scanner"
            className={`${isScannerActive ? 'min-h-[260px]' : 'h-0'} overflow-hidden rounded-lg border border-slate-200 bg-slate-50`}
          />

          {scannerError && (
            <p className="text-xs text-amber-700">{scannerError}</p>
          )}
          {qrVerificationError && (
            <p className="text-sm text-rose-700">{qrVerificationError}</p>
          )}

          {qrVerificationResult && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                qrVerificationResult.valid
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              {qrVerificationResult.valid && qrVerificationResult.credential ? (
                <div className="space-y-1">
                  <p className="font-semibold">Credential is valid.</p>
                  <p>{qrVerificationResult.credential.title}</p>
                  <p>Type: {qrVerificationResult.credential.type}</p>
                  <p>Status: {qrVerificationResult.credential.status}</p>
                  <p>Institution: {qrVerificationResult.credential.institutionName}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-semibold">
                    {qrVerificationResult.reason === 'EXPIRED' ? 'Token expired' : 'Token invalid or already used'}
                  </p>
                  <p>Ask the student to generate a new one-time QR code.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

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
