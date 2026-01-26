import React from 'react';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2,
  Eye,
  FileCheck,
  Link2,
} from 'lucide-react';

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    label: 'Pending',
  },
  ai_review: {
    icon: Eye,
    color: 'text-purple-500',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    label: 'AI Review',
  },
  verified: {
    icon: FileCheck,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    label: 'Verified',
  },
  issued: {
    icon: CheckCircle2,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    label: 'Issued',
  },
  rejected: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-50',
    border: 'border-red-200',
    label: 'Rejected',
  },
  revoked: {
    icon: XCircle,
    color: 'text-gray-500',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    label: 'Revoked',
  },
  processing: {
    icon: Loader2,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    label: 'Processing',
    animate: true,
  },
  blockchain_verified: {
    icon: Link2,
    color: 'text-indigo-500',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    label: 'Blockchain Verified',
  },
  authentic: {
    icon: CheckCircle2,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    label: 'Authentic',
  },
  suspicious: {
    icon: AlertTriangle,
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    label: 'Suspicious',
  },
  fraudulent: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-50',
    border: 'border-red-200',
    label: 'Fraudulent',
  },
};

export default function StatusIndicator({ status, showLabel = true, size = 'sm', className }) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  const sizeClasses = {
    xs: 'text-xs px-2 py-0.5',
    sm: 'text-xs px-2.5 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full border',
        config.bg,
        config.border,
        config.color,
        sizeClasses[size],
        className
      )}
    >
      <Icon className={cn(iconSizes[size], config.animate && 'animate-spin')} />
      {showLabel && config.label}
    </span>
  );
}
