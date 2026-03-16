import type { ThHTMLAttributes, TdHTMLAttributes, HTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

export function Table({ className, children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 pb-[10px]">
      <table className={twMerge('w-full text-left text-sm', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={twMerge('border-b border-neutral-200 bg-neutral-50', className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={twMerge('divide-y divide-neutral-100 bg-white', className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ className, children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={twMerge('transition-colors hover:bg-neutral-50/60', className)} {...props}>
      {children}
    </tr>
  );
}

export function Th({ className, children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={twMerge('px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500', className)}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({ className, children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={twMerge('px-4 py-3 text-sm text-neutral-700', className)} {...props}>
      {children}
    </td>
  );
}

export function TableEmpty({ colSpan, message }: { colSpan: number; message?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-neutral-500">
        {message || 'No data found.'}
      </td>
    </tr>
  );
}

export function TableLoading({ colSpan, rows = 3 }: { colSpan: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          <td colSpan={colSpan} className="px-4 py-3">
            <div className="h-5 w-full rounded skeleton-shimmer" />
          </td>
        </tr>
      ))}
    </>
  );
}
