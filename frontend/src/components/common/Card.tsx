import React from 'react';
import { twMerge } from 'tailwind-merge';

// PAGE TITLE - A card component that can be used to display content
// in a card-like layout. It accepts a title, children, an optional 
// className for styling, and an optional action element that can be 
// displayed in the header of the card.

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
          {title ? <h6 className="text-lg  font-semibold text-neutral-900">{title}</h6> : <div></div>}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
