import { Check, ClipboardCheck, FileText, RefreshCw, Search, X } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import { CredentialRequest } from '../../../services/credential.service';
import { REQUEST_STATUS_OPTIONS, RequestStatusFilter } from '../types';
import { formatDate } from '../utils';

interface InstitutionRequestsSectionProps {
  requests: CredentialRequest[];
  isLoadingRequests: boolean;
  requestSearch: string;
  requestStatusFilter: RequestStatusFilter;
  selectedRequestIds: string[];
  rejectionReasonByRequestId: Record<string, string>;
  issueFileByRequestId: Record<string, File | null>;
  updatingRequestId: string | null;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: RequestStatusFilter) => void;
  onToggleRequest: (requestId: string) => void;
  onReasonChange: (requestId: string, reason: string) => void;
  onIssueFileChange: (requestId: string, file: File | null) => void;
  onRequestAction: (requestId: string, action: 'APPROVE' | 'REJECT' | 'ISSUE') => Promise<void>;
  onBulkAction: (action: 'APPROVE' | 'REJECT' | 'ISSUE') => Promise<void>;
}

export default function InstitutionRequestsSection({
  requests,
  isLoadingRequests,
  requestSearch,
  requestStatusFilter,
  selectedRequestIds,
  rejectionReasonByRequestId,
  issueFileByRequestId,
  updatingRequestId,
  onRefresh,
  onSearchChange,
  onFilterChange,
  onToggleRequest,
  onReasonChange,
  onIssueFileChange,
  onRequestAction,
  onBulkAction,
}: InstitutionRequestsSectionProps) {
  return (
    <div className="space-y-6">
      <Card
        title="Request Filters & Bulk Actions"
        action={
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2 relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={requestSearch}
              onChange={event => onSearchChange(event.target.value)}
              placeholder="Search request ID, student, title, type..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none"
            />
          </div>
          <select
            value={requestStatusFilter}
            onChange={event => onFilterChange(event.target.value as RequestStatusFilter)}
            className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
          >
            {REQUEST_STATUS_OPTIONS.map(status => (
              <option key={status} value={status}>
                {status === 'ALL' ? 'All statuses' : status}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <button onClick={() => void onBulkAction('APPROVE')} className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">Bulk Approve</button>
            <button onClick={() => void onBulkAction('REJECT')} className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-800 hover:bg-rose-100">Bulk Reject</button>
            <button onClick={() => void onBulkAction('ISSUE')} className="inline-flex h-10 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100">Bulk Issue</button>
          </div>
        </div>
      </Card>

      <Card title="Credential Verification Requests">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Pick</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoadingRequests && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-500">
                    Loading verification requests...
                  </td>
                </tr>
              )}
              {!isLoadingRequests && requests.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-500">
                    No requests available.
                  </td>
                </tr>
              )}
              {!isLoadingRequests && requests.map(request => (
                <tr key={request.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRequestIds.includes(request.id)}
                      onChange={() => onToggleRequest(request.id)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{request.studentId}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                      <FileText size={14} />
                      {request.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDate(request.createdAt)}</td>
                  <td className="px-4 py-3"><Badge status={request.status} /></td>
                  <td className="px-4 py-3">
                    <input
                      value={rejectionReasonByRequestId[request.id] || ''}
                      onChange={event => onReasonChange(request.id, event.target.value)}
                      placeholder="Reason if rejecting..."
                      className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs outline-none"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {request.status === 'PENDING' ? (
                      <div className="inline-flex gap-2">
                        <button disabled={updatingRequestId === request.id} onClick={() => void onRequestAction(request.id, 'APPROVE')} className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50" title="Approve"><Check size={16} /></button>
                        <button disabled={updatingRequestId === request.id} onClick={() => void onRequestAction(request.id, 'REJECT')} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 disabled:opacity-50" title="Reject"><X size={16} /></button>
                      </div>
                    ) : request.status === 'APPROVED' ? (
                      <div className="inline-flex items-center justify-end gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                            className="hidden"
                            onChange={event => onIssueFileChange(request.id, event.target.files?.[0] ?? null)}
                          />
                          {issueFileByRequestId[request.id]?.name ? 'Change File' : 'Attach File'}
                        </label>
                        <button
                          disabled={updatingRequestId === request.id || (!request.credentialId && !issueFileByRequestId[request.id])}
                          onClick={() => void onRequestAction(request.id, 'ISSUE')}
                          className="rounded-lg border border-cyan-200 bg-cyan-50 p-2 text-cyan-700 hover:bg-cyan-100 disabled:opacity-50"
                          title={!request.credentialId && !issueFileByRequestId[request.id] ? 'Attach a file to issue this credential.' : 'Issue'}
                        >
                          <ClipboardCheck size={16} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">Completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
