import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import { CredentialRequest } from '../../../services/credential.service';
import { formatDateTime } from '../utils';

interface StudentRequestHistorySectionProps {
  requests: CredentialRequest[];
  isLoadingRequests: boolean;
}

export default function StudentRequestHistorySection({
  requests,
  isLoadingRequests,
}: StudentRequestHistorySectionProps) {
  return (
    <Card title="My Request History">
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="min-w-full text-left">
          <thead className="bg-slate-50">
            <tr className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Status</th>
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
            {!isLoadingRequests && requests.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">
                  No requests submitted yet.
                </td>
              </tr>
            )}
            {!isLoadingRequests &&
              requests.map(request => (
                <tr key={request.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">{request.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{request.id}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{request.type}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDateTime(request.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Badge status={request.status} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

