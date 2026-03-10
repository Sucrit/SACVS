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
  PENDING: 'bg-warning-50 text-warning-700 border-warning-100',
  APPROVED: 'bg-success-50 text-success-700 border-success-100',
  REJECTED: 'bg-error-50 text-error-700 border-error-100',
  ISSUED: 'bg-primary-50 text-primary-700 border-primary-100',
  REVOKED: 'bg-neutral-100 text-neutral-500 border-neutral-200 line-through',
  SUSPENDED: 'bg-warning-50 text-warning-700 border-warning-100',
  EXPIRED: 'bg-neutral-100 text-neutral-500 border-neutral-200',
  COMPLETED: 'bg-success-50 text-success-700 border-success-100',
  CANCELLED: 'bg-neutral-100 text-neutral-500 border-neutral-200',
};

export default function Badge({ status, className }: BadgeProps) {
  return (
    <span
      className={twMerge(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize',
        statusStyles[status] || 'bg-neutral-100 text-neutral-600 border-neutral-200',
        className
      )}
    >
      {status.toLowerCase()}
    </span>
  );
}
