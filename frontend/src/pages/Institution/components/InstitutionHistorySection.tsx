import Card from '../../../components/common/Card';
import { ActivityEvent } from '../types';
import { formatDateTime } from '../utils';

interface InstitutionHistorySectionProps {
  events: ActivityEvent[];
  duplicateEmailCount: number;
  suspendedCount: number;
  rejectedRequestCount: number;
}

export default function InstitutionHistorySection({
  events,
  duplicateEmailCount,
  suspendedCount,
  rejectedRequestCount,
}: InstitutionHistorySectionProps) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="xl:col-span-2">
        <Card title="Institution Activity Timeline">
          <div className="space-y-3">
            {events.length === 0 && <p className="text-sm text-slate-500">No activity yet.</p>}
            {events.map(event => (
              <div key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                    <p className="mt-1 text-xs text-slate-600">{event.description}</p>
                  </div>
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">
                    {event.type}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">{formatDateTime(event.createdAt)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Security Monitor">
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-800">Duplicate student emails</p>
              <p className="mt-1 text-slate-600">{duplicateEmailCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-800">Suspended accounts</p>
              <p className="mt-1 text-slate-600">{suspendedCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-800">Rejected requests</p>
              <p className="mt-1 text-slate-600">{rejectedRequestCount}</p>
            </div>
          </div>
        </Card>

        <Card title="Audit Endpoint Note">
          <p className="text-sm text-slate-600">
            This timeline is currently frontend-generated. It will be connected to backend audit logs in the next step.
          </p>
        </Card>
      </div>
    </div>
  );
}
