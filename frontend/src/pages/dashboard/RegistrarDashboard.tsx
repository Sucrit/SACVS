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
      .slice(0, 3);
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
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden">
          <div className="absolute right-0 top-0 p-6 opacity-10">
            <FileText size={100} />
          </div>
          <p className="text-indigo-100 font-medium text-sm uppercase tracking-wider">Pending Review</p>
          <h2 className="text-4xl font-display font-bold mt-2">{pendingCount}</h2>
          <div className="mt-4 flex items-center gap-2 text-sm text-indigo-100 bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-sm">
            <Activity size={14} /> {newTodayCount} new today
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-lg shadow-gray-200/50">
          <p className="text-gray-400 font-medium text-sm uppercase tracking-wider">Processed Today</p>
          <h2 className="text-4xl font-display font-bold text-emerald-600 mt-2">{processedTodayCount}</h2>
          <p className="text-sm text-gray-400 mt-2">approved, rejected, and completed requests</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-lg shadow-gray-200/50">
          <p className="text-gray-400 font-medium text-sm uppercase tracking-wider">AI Flags</p>
          <h2 className="text-4xl font-display font-bold text-rose-500 mt-2">{aiFlagCount}</h2>
          <p className="text-sm text-gray-400 mt-2">requests below AI threshold</p>
        </div>
      </div>

      {requestsError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} />
          {requestsError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card
            title="Credential Verification Requests"
            action={
              <button onClick={loadRequests} className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-1">
                <RefreshCw size={14} />
                Refresh
              </button>
            }
          >
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50/50 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-4">Student</th>
                    <th className="px-6 py-4">Document</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4 text-center">AI Score</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {isLoadingRequests && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">
                        Loading verification requests...
                      </td>
                    </tr>
                  )}
                  {!isLoadingRequests && requests.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">
                        No requests available.
                      </td>
                    </tr>
                  )}
                  {!isLoadingRequests &&
                    requests.map(request => {
                      const aiScore = extractAiScore(request);

                      return (
                        <tr key={request.id} className="hover:bg-gray-50/80 transition-all">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-gray-900">{request.studentId}</div>
                            <div className="text-xs text-gray-400">Request ID: {request.id}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-gray-700 bg-gray-100 w-fit px-2 py-1 rounded-md text-xs font-medium border border-gray-200">
                              <FileText size={14} className="text-indigo-500" />
                              {request.type}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 font-mono">{formatDate(request.createdAt)}</td>
                          <td className="px-6 py-4 text-center">
                            {typeof aiScore === 'number' ? (
                              <div
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                  aiScore > 90
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : aiScore > 70
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                <BrainCircuit size={14} />
                                {aiScore}%
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">N/A</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <Badge status={request.status} />
                          </td>
                          <td className="px-6 py-4 text-right">
                            {request.status === 'PENDING' ? (
                              <div className="flex justify-end gap-2">
                                <button
                                  disabled={updatingRequestId === request.id}
                                  onClick={() => void handleAction(request.id, 'APPROVE')}
                                  className="p-2 text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 hover:scale-110 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Approve"
                                >
                                  <Check size={18} />
                                </button>
                                <button
                                  disabled={updatingRequestId === request.id}
                                  onClick={() => void handleAction(request.id, 'REJECT')}
                                  className="p-2 text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 hover:scale-110 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Reject"
                                >
                                  <X size={18} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Completed</span>
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
          <Card title="AI Analysis Stream" className="h-full border-indigo-100">
            <div className="space-y-6 mt-4 relative">
              <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gray-100"></div>

              {aiStream.length === 0 && <p className="text-sm text-gray-500">No AI analysis events available.</p>}
              {aiStream.map(request => {
                const aiScore = extractAiScore(request);

                return (
                  <div key={request.id} className="relative pl-12 group">
                    <div className="absolute left-0 top-0 p-2 bg-white border border-gray-100 rounded-full shadow-sm z-10 group-hover:border-indigo-200 transition-colors">
                      <BrainCircuit size={16} className="text-indigo-500" />
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 group-hover:bg-indigo-50/30 transition-colors">
                      <p className="text-sm font-bold text-gray-800">{request.title}</p>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        AI score: {typeof aiScore === 'number' ? `${aiScore}%` : 'not available'} | status: {request.status}
                      </p>
                      <span className="text-[10px] font-mono text-gray-300 mt-2 block">
                        {formatDate(request.updatedAt)}
                      </span>
                    </div>
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
