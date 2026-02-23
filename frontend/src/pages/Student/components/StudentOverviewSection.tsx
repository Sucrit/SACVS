import { RefreshCw } from 'lucide-react';
import Card from '../../../components/common/Card';

interface StudentOverviewSectionProps {
  displayName: string;
  fallbackEmail?: string;
  onRefresh: () => void;
}

export default function StudentOverviewSection({
  displayName,
  fallbackEmail,
  onRefresh,
}: StudentOverviewSectionProps) {
  return (
    <Card className="border-slate-900 bg-slate-900 text-white" title="Student Overview">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Welcome back, {displayName || fallbackEmail || 'Student'}</h2>
          <p className="mt-1 text-sm text-slate-300">Track your credential requests and issuance progress in one place.</p>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
        >
          <RefreshCw size={16} />
          Refresh Data
        </button>
      </div>
    </Card>
  );
}

