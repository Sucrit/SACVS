import { twMerge } from 'tailwind-merge';

type BadgeStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'ISSUED'
  | 'REVOKED'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'COMPLETED'
  | 'CANCELLED';

interface BadgeProps {
  status: BadgeStatus;
  className?: string;
}

const statusStyles: Record<BadgeStatus, string> = {
  PENDING: 'text-warning-700',
  APPROVED: 'text-success-700',
  REJECTED: 'text-error-700',
  ISSUED: 'text-primary-700',
  REVOKED: 'text-neutral-500 line-through',
  SUSPENDED: 'text-warning-700',
  EXPIRED: 'text-neutral-500',
  COMPLETED: 'text-success-700',
  CANCELLED: 'text-neutral-500',
};

export default function Badge({ status, className }: BadgeProps) {
  return (
    <span
      className={twMerge(
        'inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.08em]',
        statusStyles[status] || 'text-neutral-600',
        className
      )}
    >
      {status.toLowerCase().replace(/_/g, ' ')}
    </span>
  );
}
