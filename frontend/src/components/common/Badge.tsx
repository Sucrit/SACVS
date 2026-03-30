import { twMerge } from 'tailwind-merge';
import { getStatusStyle, type GeneralStatus } from '../../utils/statusStyles';

interface BadgeProps {
  status: GeneralStatus;
  className?: string;
}

export default function Badge({ status, className }: BadgeProps) {
  return (
    <span
      className={twMerge(
        'inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.08em]',
        getStatusStyle(status),
        className
      )}
    >
      {status.toLowerCase().replace(/_/g, ' ')}
    </span>
  );
}

