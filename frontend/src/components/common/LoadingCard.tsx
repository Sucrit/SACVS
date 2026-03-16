import { twMerge } from 'tailwind-merge';

interface LoadingCardProps {
  className?: string;
  rows?: number;
}

export default function LoadingCard({ className, rows = 3 }: LoadingCardProps) {
  return (
    <div className={twMerge('rounded-xl border border-neutral-200 bg-white p-5 shadow-sm', className)}>
      <div className="flex items-start justify-between">
        <div className="skeleton-shimmer h-4 w-32 rounded-md" />
        <div className="skeleton-shimmer h-5 w-5 rounded-full" />
      </div>
      
      <div className="mt-4 mb-3">
        <div className="skeleton-shimmer h-9 w-24 rounded-md" />
        <div className="skeleton-shimmer mt-2 h-3 w-40 rounded-md" />
      </div>

      <div className="mb-3 h-8 w-full">
        <div className="skeleton-shimmer h-full w-full rounded-md opacity-40" />
      </div>

      <div className="mt-auto space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton-shimmer h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton-shimmer h-3 w-full rounded-md" />
              <div className="skeleton-shimmer h-2.5 w-2/3 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LoadingTableCard({ className, rows = 5 }: { className?: string; rows?: number }) {
  return (
    <div className={twMerge('rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden', className)}>
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
        <div className="flex gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton-shimmer h-3 flex-1 rounded-md" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-neutral-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="skeleton-shimmer h-8 w-8 rounded-full shrink-0" />
                <div className="skeleton-shimmer h-4 w-32 rounded-md" />
              </div>
              <div className="skeleton-shimmer h-4 flex-1 rounded-md hidden sm:block" />
              <div className="skeleton-shimmer h-4 flex-1 rounded-md hidden md:block" />
              <div className="skeleton-shimmer h-4 w-20 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
