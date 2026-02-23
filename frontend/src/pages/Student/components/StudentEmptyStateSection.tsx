import { ReactNode } from 'react';
import Card from '../../../components/common/Card';

interface StudentEmptyStateSectionProps {
  title: string;
  description: string;
  icon?: ReactNode;
}

export default function StudentEmptyStateSection({
  title,
  description,
  icon,
}: StudentEmptyStateSectionProps) {
  return (
    <Card title={title}>
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
        {icon && <div className="mb-3 text-slate-400">{icon}</div>}
        <p className="max-w-xl text-sm text-slate-500">{description}</p>
      </div>
    </Card>
  );
}
