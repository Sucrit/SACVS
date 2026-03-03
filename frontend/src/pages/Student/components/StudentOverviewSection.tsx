import Card from '../../../components/common/Card';

interface StudentOverviewSectionProps {
  displayName: string;
  fallbackEmail?: string;
}

export default function StudentOverviewSection({
  displayName,
  fallbackEmail,
}: StudentOverviewSectionProps) {
  return (
    <Card className="border-slate-900 bg-slate-900 text-white" title="Student Overview">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Welcome back, {displayName || fallbackEmail || 'Student'}</h2>
          <p className="mt-1 text-sm text-slate-300">Track your credential requests and issuance progress in one place.</p>
        </div>
      </div>
    </Card>
  );
}
