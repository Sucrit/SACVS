import { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { BriefcaseBusiness, Clock3, ClipboardList, RefreshCw, AlertCircle } from 'lucide-react';
import { CredentialRequest, CredentialService } from '../../services/credential.service';

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
  const [requests, setRequests] = useState<CredentialRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);

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
    void loadRequests();
  }, [loadRequests]);

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
