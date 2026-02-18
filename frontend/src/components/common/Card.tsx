import React from 'react';
import { twMerge } from 'tailwind-merge';

export default function Card({ title, children, className, action }: { title: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <div className={twMerge(`glass-card rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1`, className)}>
      <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-display font-semibold text-gray-800 relative pl-4">
            <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></span>
            {title}
          </h3>
          {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
}