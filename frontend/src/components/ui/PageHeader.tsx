import type { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export default function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={twMerge('flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4', className)}>
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-neutral-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
