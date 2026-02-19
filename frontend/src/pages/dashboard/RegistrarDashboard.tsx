import { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { Check, X, FileText, BrainCircuit, Activity, AlertCircle, RefreshCw } from 'lucide-react';
import { CredentialRequest, CredentialService } from '../../services/credential.service';

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

const isToday = (value: string | null | undefined) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

const extractAiScore = (request: CredentialRequest) => {
  if (typeof request.aiScore === 'number') return request.aiScore;

  const metadata = request.metadata;
  if (metadata && typeof metadata.aiScore === 'number') {
    return metadata.aiScore;
  }

  return null;
};

export default function RegistrarDashboard() {
  const [requests, setRequests] = useState<CredentialRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    setRequestsError(null);

    try {
      const data = await CredentialService.listRequests();
      setRequests(data);
    } catch (error) {
      console.error('Failed to load registrar requests:', error);
      setRequests([]);
      setRequestsError('Unable to load verification requests from the backend.');
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const pendingCount = requests.filter(request => request.status === 'PENDING').length;
  const processedTodayCount = requests.filter(
    request =>
      (request.status === 'APPROVED' || request.status === 'REJECTED' || request.status === 'COMPLETED') &&
      isToday(request.processedAt || request.updatedAt),
  ).length;
  const aiFlagCount = requests.filter(request => {
    const score = extractAiScore(request);
    return typeof score === 'number' && score < 70;
  }).length;
  const newTodayCount = requests.filter(request => isToday(request.createdAt)).length;

  const aiStream = useMemo(() => {
    return [...requests]
      .filter(request => extractAiScore(request) !== null)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 4);
  }, [requests]);

  const handleAction = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    setUpdatingRequestId(requestId);
    setRequestsError(null);

    const nextStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    try {
      const updatedRequest = await CredentialService.updateRequestStatus(
        requestId,
        nextStatus,
        action === 'REJECT' ? 'Rejected by registrar review.' : undefined,
      );

      setRequests(previous =>
        previous.map(request => (request.id === requestId ? { ...request, ...updatedRequest } : request)),
      );
    } catch (error) {
      console.error('Failed to update request status:', error);
      setRequestsError('Unable to update request status.');
    } finally {
      setUpdatingRequestId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Pending Review" className="border-slate-900 bg-slate-900 text-white">
          <p className="text-3xl font-bold text-white">{pendingCount}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-300">Awaiting decision</p>
        </Card>

        <Card title="Processed Today">
          <p className="text-3xl font-bold text-emerald-700">{processedTodayCount}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-500">Approved/rejected</p>
        </Card>

        <Card title="AI Flags">
          <p className="text-3xl font-bold text-rose-700">{aiFlagCount}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-500">Score below threshold</p>
        </Card>

        <Card title="New Today">
          <p className="text-3xl font-bold text-slate-900">{newTodayCount}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-500">Incoming requests</p>
        </Card>
      </div>

      {requestsError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} />
          {requestsError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card
            title="Credential Verification Requests"
            action={
              <button
                onClick={loadRequests}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            }
          >
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Student</th>
                    <th className="px-5 py-3">Document</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3 text-center">AI Score</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoadingRequests && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                        Loading verification requests...
                      </td>
                    </tr>
                  )}
                  {!isLoadingRequests && requests.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                        No requests available.
                      </td>
                    </tr>
                  )}
                  {!isLoadingRequests &&
                    requests.map(request => {
                      const aiScore = extractAiScore(request);

                      return (
                        <tr key={request.id} className="hover:bg-slate-50/70">
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-900">{request.studentId}</p>
                            <p className="mt-1 text-xs text-slate-500">Request ID: {request.id}</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                              <FileText size={14} />
                              {request.type}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-600">{formatDate(request.createdAt)}</td>
                          <td className="px-5 py-4 text-center">
                            {typeof aiScore === 'number' ? (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                  aiScore > 90
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                    : aiScore > 70
                                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                                      : 'border-rose-200 bg-rose-50 text-rose-800'
                                }`}
                              >
                                <BrainCircuit size={13} />
                                {aiScore}%
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">N/A</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <Badge status={request.status} />
                          </td>
                          <td className="px-5 py-4 text-right">
                            {request.status === 'PENDING' ? (
                              <div className="inline-flex gap-2">
                                <button
                                  disabled={updatingRequestId === request.id}
                                  onClick={() => void handleAction(request.id, 'APPROVE')}
                                  className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  title="Approve"
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  disabled={updatingRequestId === request.id}
                                  onClick={() => void handleAction(request.id, 'REJECT')}
                                  className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  title="Reject"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">Completed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="AI Analysis Stream">
            <div className="space-y-3">
              {aiStream.length === 0 && <p className="text-sm text-slate-500">No AI analysis events available.</p>}
              {aiStream.map(request => {
                const aiScore = extractAiScore(request);

                return (
                  <div key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-2 text-slate-900">
                      <Activity size={14} />
                      <p className="text-sm font-semibold">{request.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      AI score: {typeof aiScore === 'number' ? `${aiScore}%` : 'not available'} | status: {request.status}
                    </p>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.08em] text-slate-400">{formatDate(request.updatedAt)}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
