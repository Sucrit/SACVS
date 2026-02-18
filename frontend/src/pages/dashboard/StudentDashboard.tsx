import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import {
  FileText,
  Download,
  CheckCircle,
  Clock,
  Plus,
  GraduationCap,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  Credential,
  CredentialService,
  CredentialType,
  CreateCredentialRequestPayload,
  DeliveryMethod,
} from '../../services/credential.service';
import { useLegacyAuth } from '../../auth/legacy-auth-context';

const CREDENTIAL_TYPES: CredentialType[] = ['TRANSCRIPT', 'DIPLOMA', 'CERTIFICATE', 'DEGREE', 'LICENSE'];
const DELIVERY_METHODS: DeliveryMethod[] = ['DIGITAL', 'PHYSICAL', 'BOTH'];

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

const getStatusLabel = (status: Credential['status']) => {
  switch (status) {
    case 'AI_REVIEW':
      return 'AI review in progress';
    case 'VERIFIED':
      return 'Credential verified';
    case 'ISSUED':
      return 'Credential issued';
    case 'REVOKED':
      return 'Credential revoked';
    case 'EXPIRED':
      return 'Credential expired';
    default:
      return 'Credential pending';
  }
};

export default function StudentDashboard() {
  const { user } = useLegacyAuth();
  const displayName = user ? [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ') : '';
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(true);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [requestForm, setRequestForm] = useState<CreateCredentialRequestPayload>({
    type: 'TRANSCRIPT',
    title: '',
    description: '',
    purpose: '',
    deliveryMethod: 'DIGITAL',
  });

  const loadCredentials = useCallback(async () => {
    setIsLoadingCredentials(true);
    setCredentialsError(null);

    try {
      const data = await CredentialService.listMine();
      setCredentials(data);
    } catch (error) {
      console.error('Failed to load credentials:', error);
      setCredentials([]);
      setCredentialsError('Unable to load credentials from the backend.');
    } finally {
      setIsLoadingCredentials(false);
    }
  }, []);

  useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  const totalCredentials = credentials.length;
  const pendingCredentials = credentials.filter(
    credential => credential.status === 'PENDING' || credential.status === 'AI_REVIEW',
  ).length;
  const actionRequiredCount = credentials.filter(
    credential => credential.status === 'REVOKED' || credential.status === 'EXPIRED',
  ).length;

  const recentActivity = useMemo(() => {
    return [...credentials]
      .sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt).getTime();
        return dateB - dateA;
      })
      .slice(0, 3);
  }, [credentials]);

  const handleRequestSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRequestError(null);
    setRequestSuccess(null);
    setIsSubmittingRequest(true);

    try {
      await CredentialService.createRequest({
        type: requestForm.type,
        title: requestForm.title.trim(),
        description: requestForm.description?.trim() || undefined,
        purpose: requestForm.purpose?.trim() || undefined,
        deliveryMethod: requestForm.deliveryMethod,
      });

      setRequestSuccess('Credential request submitted successfully.');
      setRequestForm({
        type: 'TRANSCRIPT',
        title: '',
        description: '',
        purpose: '',
        deliveryMethod: 'DIGITAL',
      });
    } catch (error) {
      console.error('Failed to submit credential request:', error);
      setRequestError('Unable to submit your request to the backend.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-display font-bold text-gray-800">
            Welcome back, {displayName || user?.email || 'Student'}
          </h2>
          <p className="text-gray-500 mt-1">Track your academic progress and manage your digital credentials.</p>
        </div>
        <button
          onClick={loadCredentials}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-1 flex items-center gap-2"
        >
          <RefreshCw size={20} />
          Refresh Data
        </button>
      </div>

      {credentialsError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} />
          {credentialsError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Total Credentials" className="border-l-4 border-indigo-500">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-4xl font-bold font-display text-gray-800">{totalCredentials}</div>
              <p className="text-sm font-medium text-gray-400 mt-1 uppercase tracking-wider">Acquired</p>
            </div>
            <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-500">
              <GraduationCap size={32} />
            </div>
          </div>
        </Card>
        <Card title="Applications Status" className="border-l-4 border-amber-500">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-4xl font-bold font-display text-gray-800">{pendingCredentials}</div>
              <p className="text-sm font-medium text-gray-400 mt-1 uppercase tracking-wider">Pending</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-2xl text-amber-500">
              <Clock size={32} />
            </div>
          </div>
        </Card>
        <Card title="Action Required" className="border-l-4 border-emerald-500">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-4xl font-bold font-display text-gray-800">{actionRequiredCount}</div>
              <p className="text-sm font-medium text-gray-400 mt-1 uppercase tracking-wider">Alerts</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-500">
              <CheckCircle size={32} />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card
            title="My Credentials"
            action={
              <button
                onClick={loadCredentials}
                className="text-sm text-indigo-600 font-medium hover:underline flex items-center gap-1"
              >
                <Plus size={14} />
                Reload
              </button>
            }
          >
            <div className="overflow-hidden rounded-xl border border-gray-100">
              <table className="min-w-full text-left">
                <thead className="bg-gray-50/50">
                  <tr className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                    <th className="px-6 py-4">Credential</th>
                    <th className="px-6 py-4">Issuer</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {isLoadingCredentials && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                        Loading credentials...
                      </td>
                    </tr>
                  )}
                  {!isLoadingCredentials && credentials.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                        No credentials found.
                      </td>
                    </tr>
                  )}
                  {!isLoadingCredentials &&
                    credentials.map(credential => (
                      <tr key={credential.id} className="group hover:bg-gray-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-800 group-hover:text-indigo-600 transition-colors">
                            {credential.title}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">{credential.type}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{credential.issuedById}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                          {formatDate(credential.issuedDate || credential.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <Badge status={credential.status} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          {credential.status === 'ISSUED' ? (
                            <button
                              disabled={!credential.storageKey}
                              className="text-gray-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              title={credential.storageKey ? 'Download credential' : 'File not available'}
                            >
                              <Download size={18} />
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
                              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                              {credential.status.replace('_', ' ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Quick Request" className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-none">
            <p className="text-indigo-100 text-sm mb-4 leading-relaxed">
              Submit a new credential request. Form data is sent directly to backend API endpoints.
            </p>
            <form className="space-y-3" onSubmit={handleRequestSubmit}>
              <select
                value={requestForm.type}
                onChange={event => setRequestForm(prev => ({ ...prev, type: event.target.value as CredentialType }))}
                className="w-full rounded-lg border border-indigo-200/40 bg-white/95 px-3 py-2 text-sm text-slate-800"
              >
                {CREDENTIAL_TYPES.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <input
                value={requestForm.title}
                onChange={event => setRequestForm(prev => ({ ...prev, title: event.target.value }))}
                placeholder="Request title"
                required
                className="w-full rounded-lg border border-indigo-200/40 bg-white/95 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
              />
              <input
                value={requestForm.purpose || ''}
                onChange={event => setRequestForm(prev => ({ ...prev, purpose: event.target.value }))}
                placeholder="Purpose"
                className="w-full rounded-lg border border-indigo-200/40 bg-white/95 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
              />
              <select
                value={requestForm.deliveryMethod}
                onChange={event =>
                  setRequestForm(prev => ({ ...prev, deliveryMethod: event.target.value as DeliveryMethod }))
                }
                className="w-full rounded-lg border border-indigo-200/40 bg-white/95 px-3 py-2 text-sm text-slate-800"
              >
                {DELIVERY_METHODS.map(method => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={isSubmittingRequest}
                className="w-full py-3 bg-white text-indigo-600 rounded-xl hover:bg-indigo-50 transition shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingRequest ? (
                  <span className="animate-spin h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full"></span>
                ) : (
                  <>
                    <FileText size={18} />
                    Submit Request
                  </>
                )}
              </button>
            </form>
            {requestError && <p className="text-xs text-rose-100 mt-3">{requestError}</p>}
            {requestSuccess && <p className="text-xs text-emerald-100 mt-3">{requestSuccess}</p>}
          </Card>

          <Card title="Recent Activity">
            <div className="relative pl-4 border-l-2 border-dashed border-gray-200 space-y-6 my-2">
              {recentActivity.length === 0 && <p className="text-sm text-gray-500">No recent activity yet.</p>}
              {recentActivity.map(item => (
                <div className="relative" key={item.id}>
                  <div className="absolute -left-[21px] top-1 w-3 h-3 bg-indigo-500 rounded-full ring-4 ring-white shadow-sm"></div>
                  <p className="text-sm font-bold text-gray-800">{getStatusLabel(item.status)}</p>
                  <p className="text-xs text-gray-500 mt-1">{item.title}</p>
                  <span className="text-[10px] uppercase font-bold text-gray-300 mt-2 block">
                    {formatDate(item.updatedAt || item.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
