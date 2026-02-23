import Card from '../../../components/common/Card';
import { Credential } from '../../../services/credential.service';
import { formatDate, getStatusLabel } from '../utils';

interface StudentRecentActivitySectionProps {
  recentActivity: Credential[];
}

export default function StudentRecentActivitySection({
  recentActivity,
}: StudentRecentActivitySectionProps) {
  return (
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
  );
}

