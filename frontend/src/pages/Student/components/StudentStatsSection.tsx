import { CheckCircle, Clock, GraduationCap, ShieldCheck } from 'lucide-react';
import Card from '../../../components/common/Card';

interface StudentStatsSectionProps {
  totalCredentials: number;
  pendingCredentials: number;
  issuedCredentials: number;
  actionRequiredCount: number;
}

export default function StudentStatsSection({
  totalCredentials,
  pendingCredentials,
  issuedCredentials,
  actionRequiredCount,
}: StudentStatsSectionProps) {
  return (
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
  );
}

