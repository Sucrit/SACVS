import Card from '../../../components/common/Card';

interface InstitutionOverviewSectionProps {
  pendingCount: number;
  processedCount: number;
  studentCount: number;
  duplicateEmailCount: number;
}

export default function InstitutionOverviewSection({
  pendingCount,
  processedCount,
  studentCount,
  duplicateEmailCount,
}: InstitutionOverviewSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      <Card title="Pending Review" className="border-slate-900 bg-slate-900 text-white">
        <p className="text-3xl font-bold text-white">{pendingCount}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-300">Awaiting decision</p>
      </Card>
      <Card title="Processed">
        <p className="text-3xl font-bold text-emerald-700">{processedCount}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-500">Approved/rejected/completed</p>
      </Card>
      <Card title="Students">
        <p className="text-3xl font-bold text-cyan-700">{studentCount}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-500">Institution Members</p>
      </Card>
      <Card title="Security Flags">
        <p className="text-3xl font-bold text-rose-700">{duplicateEmailCount}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-500">Duplicate emails detected</p>
      </Card>
    </div>
  );
}
