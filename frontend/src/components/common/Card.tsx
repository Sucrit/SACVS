import React from 'react';
import { twMerge } from 'tailwind-merge';

export default function Card({ title, children, className, action }: { title: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <div
      className={twMerge(
        'rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_28px_rgba(15,23,42,0.05)] transition-shadow duration-200 hover:shadow-[0_14px_32px_rgba(15,23,42,0.08)]',
        className,
      )}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
}
