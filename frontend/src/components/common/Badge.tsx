import { twMerge } from 'tailwind-merge';

type BadgeStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'ISSUED'
  | 'REVOKED'
  | 'SUSPENDED'
  | 'AI_REVIEW'
  | 'EXPIRED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'CLEAR'
  | 'REVIEW_REQUIRED'
  | 'BLOCK'
  | 'FAILED'
  | 'OVERRIDDEN';

interface BadgeProps {
  status: BadgeStatus;
  className?: string;
}

const statusStyles: Record<BadgeStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-800 border-rose-200',
  ISSUED: 'bg-slate-100 text-slate-800 border-slate-300',
  REVOKED: 'bg-slate-100 text-slate-500 border-slate-300 line-through decoration-slate-400',
  SUSPENDED: 'bg-orange-50 text-orange-800 border-orange-200',
  AI_REVIEW: 'bg-violet-50 text-violet-800 border-violet-200',
  EXPIRED: 'bg-zinc-100 text-zinc-700 border-zinc-300',
  COMPLETED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  CANCELLED: 'bg-neutral-100 text-neutral-700 border-neutral-300',
  CLEAR: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  REVIEW_REQUIRED: 'bg-amber-50 text-amber-800 border-amber-200',
  BLOCK: 'bg-rose-50 text-rose-800 border-rose-200',
  FAILED: 'bg-orange-50 text-orange-800 border-orange-200',
  OVERRIDDEN: 'bg-cyan-50 text-cyan-800 border-cyan-200',
};

export default function Badge({ status, className }: BadgeProps) {
  return (
    <span
      className={twMerge(
        'inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-bold border uppercase tracking-widest shadow-sm',
        statusStyles[status] || 'bg-gray-100 text-gray-800 border-gray-200',
        className
      )}
    >
      <span className={`w-1.5 h-1.5 rounded-full mr-2 ${status === 'REVOKED' ? 'bg-slate-400' : 'bg-current opacity-60'}`}></span>
      {status}
    </span>
  );
}
