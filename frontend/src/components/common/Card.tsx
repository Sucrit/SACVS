import React from 'react';
import { twMerge } from 'tailwind-merge';

export default function Card({ title, children, className, action }: { title?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  const hasHeader = Boolean((title && title.trim().length > 0) || action);

  return (
    <div
      className={twMerge(
        'rounded-lg border border-neutral-200 bg-white p-3 sm:p-5',
        className,
      )}
    >
      {hasHeader && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4 sm:gap-3">
          {title ? <h3 className="text-sm font-semibold text-neutral-900">{title}</h3> : <div></div>}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
