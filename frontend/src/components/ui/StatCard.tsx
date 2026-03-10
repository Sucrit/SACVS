import type { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: number; label?: string };
  className?: string;
}

export default function StatCard({ label, value, icon, trend, className }: StatCardProps) {
  const trendIsPositive = trend && trend.value >= 0;

  return (
    <div
      className={twMerge(
        'rounded-lg border border-neutral-200 bg-white px-5 py-4',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        {icon && <span className="text-neutral-400">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-semibold text-neutral-900 tracking-tight">{value}</p>
      {trend && (
        <p className={`mt-1 text-xs font-medium ${trendIsPositive ? 'text-success-600' : 'text-error-600'}`}>
          {trendIsPositive ? '+' : ''}{trend.value.toFixed(1)}%
          {trend.label && <span className="text-neutral-400 ml-1">{trend.label}</span>}
        </p>
      )}
    </div>
  );
}
