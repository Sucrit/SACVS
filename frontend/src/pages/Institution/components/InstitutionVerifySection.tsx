import { ClipboardCheck, ShieldCheck, X } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import { CredentialRequest } from '../../../services/credential.service';
import { formatDateTime } from '../utils';

interface InstitutionVerifySectionProps {
  pendingCount: number;
  approvedCount: number;
  completedCount: number;
  requests: CredentialRequest[];
  isLoadingRequests: boolean;
  onRequestAction: (requestId: string, action: 'APPROVE' | 'REJECT' | 'ISSUE') => Promise<void>;
}

export default function InstitutionVerifySection({
  pendingCount,
  approvedCount,
  completedCount,
  requests,
  isLoadingRequests,
  onRequestAction,
}: InstitutionVerifySectionProps) {
  const verifyQueue = requests.filter(request => request.status === 'PENDING' || request.status === 'APPROVED');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Card title="Pending Verify"><p className="text-3xl font-bold text-amber-700">{pendingCount}</p></Card>
        <Card title="Approved Ready to Issue"><p className="text-3xl font-bold text-cyan-700">{approvedCount}</p></Card>
        <Card title="Issued / Completed"><p className="text-3xl font-bold text-emerald-700">{completedCount}</p></Card>
      </div>

      <Card title="Verification Queue">
        <div className="space-y-3">
          {verifyQueue.map(request => (
            <div key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{request.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Student: {request.studentId} | Type: {request.type} | Created: {formatDateTime(request.createdAt)}
                  </p>
                  <div className="mt-2"><Badge status={request.status} /></div>
                </div>
                <div className="flex items-center gap-2">
                  {request.status === 'PENDING' && (
                    <>
                      <button onClick={() => void onRequestAction(request.id, 'APPROVE')} className="inline-flex h-9 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"><ShieldCheck size={13} />Approve</button>
                      <button onClick={() => void onRequestAction(request.id, 'REJECT')} className="inline-flex h-9 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-800 hover:bg-rose-100"><X size={13} />Reject</button>
                    </>
                  )}
                  {request.status === 'APPROVED' && (
                    <button onClick={() => void onRequestAction(request.id, 'ISSUE')} className="inline-flex h-9 items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100"><ClipboardCheck size={13} />Issue Credential</button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {!isLoadingRequests && verifyQueue.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No verification tasks available.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

