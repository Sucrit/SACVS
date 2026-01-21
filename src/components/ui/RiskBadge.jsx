import React from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, AlertOctagon, Info, ShieldAlert } from 'lucide-react';

const riskConfig = {
  low: {
    icon: Info,
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    label: 'Low Risk',
  },
  medium: {
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    label: 'Medium Risk',
  },
  high: {
    icon: ShieldAlert,
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    label: 'High Risk',
  },
  critical: {
    icon: AlertOctagon,
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    label: 'Critical',
  },
};

export default function RiskBadge({ level = 'low', className }) {
  const config = riskConfig[level] || riskConfig.low;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border',
        config.bg,
        config.border,
        config.text,
        className
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}
