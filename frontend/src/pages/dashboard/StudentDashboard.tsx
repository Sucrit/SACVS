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
  ShieldCheck,
} from 'lucide-react';
import {
  Credential,
  CredentialService,
  CredentialType,
  CreateCredentialRequestPayload,
  DeliveryMethod,
} from '../../services/credential.service';
import { useLegacyAuth } from '../../auth/auth-context';

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
  const issuedCredentials = credentials.filter(credential => credential.status === 'ISSUED').length;
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
      .slice(0, 4);
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
      void loadCredentials();
    } catch (error) {
      console.error('Failed to submit credential request:', error);
      setRequestError('Unable to submit your request to the backend.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-900 bg-slate-900 text-white" title="Student Overview">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Welcome back, {displayName || user?.email || 'Student'}</h2>
            <p className="mt-1 text-sm text-slate-300">Track your credential requests and issuance progress in one place.</p>
          </div>
          <button
            onClick={loadCredentials}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            <RefreshCw size={16} />
            Refresh Data
          </button>
        </div>
      </Card>

      {credentialsError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} />
          {credentialsError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Total Credentials">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-slate-900">{totalCredentials}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">All records</p>
            </div>
            <div className="rounded-xl bg-slate-100 p-3 text-slate-900">
              <GraduationCap size={22} />
            </div>
          </div>
        </Card>

        <Card title="Pending">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-amber-700">{pendingCredentials}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">Under review</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-amber-700">
              <Clock size={22} />
            </div>
          </div>
        </Card>

        <Card title="Issued">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-emerald-700">{issuedCredentials}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">Download ready</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
              <CheckCircle size={22} />
            </div>
          </div>
        </Card>

        <Card title="Action Required">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-rose-700">{actionRequiredCount}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">Needs attention</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 text-rose-700">
              <ShieldCheck size={22} />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card
            title="My Credentials"
            action={
              <button
                onClick={loadCredentials}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Plus size={14} />
                Reload
              </button>
            }
          >
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full text-left">
                <thead className="bg-slate-50">
                  <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                    <th className="px-5 py-3">Credential</th>
                    <th className="px-5 py-3">Issuer</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoadingCredentials && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                        Loading credentials...
                      </td>
                    </tr>
                  )}
                  {!isLoadingCredentials && credentials.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                        No credentials found.
                      </td>
                    </tr>
                  )}
                  {!isLoadingCredentials &&
                    credentials.map(credential => (
                      <tr key={credential.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">{credential.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{credential.type}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{credential.issuedById}</td>
                        <td className="px-5 py-4 text-sm text-slate-600">{formatDate(credential.issuedDate || credential.createdAt)}</td>
                        <td className="px-5 py-4">
                          <Badge status={credential.status} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          {credential.status === 'ISSUED' ? (
                            <button
                              disabled={!credential.storageKey}
                              className="inline-flex items-center rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                              title={credential.storageKey ? 'Download credential' : 'File not available'}
                            >
                              <Download size={16} />
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500">{credential.status.replace('_', ' ')}</span>
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
          <Card title="New Credential Request">
            <p className="mb-4 text-sm text-slate-600">Submit a request to the registrar for new credential issuance.</p>
            <form className="space-y-3" onSubmit={handleRequestSubmit}>
              <select
                value={requestForm.type}
                onChange={event => setRequestForm(prev => ({ ...prev, type: event.target.value as CredentialType }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800"
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400"
              />
              <input
                value={requestForm.purpose || ''}
                onChange={event => setRequestForm(prev => ({ ...prev, purpose: event.target.value }))}
                placeholder="Purpose"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400"
              />
              <select
                value={requestForm.deliveryMethod}
                onChange={event =>
                  setRequestForm(prev => ({ ...prev, deliveryMethod: event.target.value as DeliveryMethod }))
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800"
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmittingRequest ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                ) : (
                  <>
                    <FileText size={16} />
                    Submit Request
                  </>
                )}
              </button>
            </form>
            {requestError && <p className="mt-3 text-xs text-rose-700">{requestError}</p>}
            {requestSuccess && <p className="mt-3 text-xs text-emerald-700">{requestSuccess}</p>}
          </Card>

          <Card title="Recent Activity">
            <div className="space-y-4">
              {recentActivity.length === 0 && <p className="text-sm text-slate-500">No recent activity yet.</p>}
              {recentActivity.map(item => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">{getStatusLabel(item.status)}</p>
                  <p className="mt-1 text-xs text-slate-600">{item.title}</p>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.08em] text-slate-400">{formatDate(item.updatedAt || item.createdAt)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
