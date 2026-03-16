import { twMerge } from 'tailwind-merge';

interface UserAvatarProps {
  initials: string;
  size?: 'sm' | 'md' | 'lg'; // sm: h-7 w-7, md: h-8 w-8, lg: h-12 w-12
  className?: string;
}

/**
 * Shared UserAvatar component for consistent profile initials styling.
 * Uses a dark slate background as requested for global consistency.
 */
export default function UserAvatar({ initials, size = 'md', className }: UserAvatarProps) {
  const sizeClasses = {
    sm: 'h-7 w-7 text-[10px]',
    md: 'h-8 w-8 text-xs',
    lg: 'h-12 w-12 text-base'
  }[size];

  return (
    <div
      className={twMerge(
        'flex shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-slate-700 font-bold text-white shadow-sm',
        sizeClasses,
        className
      )}
    >
      {initials}
    </div>
  );
}
