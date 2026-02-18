import { twMerge } from 'tailwind-merge';

type BadgeStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'VERIFIED'
  | 'ISSUED'
  | 'REVOKED'
  | 'SUSPENDED'
  | 'AI_REVIEW'
  | 'EXPIRED'
  | 'COMPLETED'
  | 'CANCELLED';

interface BadgeProps {
  status: BadgeStatus;
  className?: string;
}

const statusStyles: Record<BadgeStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700 border-amber-200 shadow-amber-500/10',
  APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200 shadow-emerald-500/10',
  REJECTED: 'bg-rose-100 text-rose-700 border-rose-200 shadow-rose-500/10',
  VERIFIED: 'bg-blue-100 text-blue-700 border-blue-200 shadow-blue-500/10',
  ISSUED: 'bg-indigo-100 text-indigo-700 border-indigo-200 shadow-indigo-500/10',
  REVOKED: 'bg-slate-100 text-slate-600 border-slate-200 line-through decoration-slate-400',
  SUSPENDED: 'bg-orange-100 text-orange-700 border-orange-200 shadow-orange-500/10',
  AI_REVIEW: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 shadow-fuchsia-500/10',
  EXPIRED: 'bg-zinc-100 text-zinc-700 border-zinc-200 shadow-zinc-400/10',
  COMPLETED: 'bg-teal-100 text-teal-700 border-teal-200 shadow-teal-500/10',
  CANCELLED: 'bg-neutral-100 text-neutral-700 border-neutral-200 shadow-neutral-500/10',
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
