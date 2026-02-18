import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BadgeProps {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'VERIFIED' | 'ISSUED' | 'REVOKED' | 'SUSPENDED';
  className?: string;
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  APPROVED: 'bg-green-100 text-green-800 border-green-200',
  REJECTED: 'bg-red-100 text-red-800 border-red-200',
  VERIFIED: 'bg-blue-100 text-blue-800 border-blue-200',
  ISSUED: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  REVOKED: 'bg-gray-100 text-gray-800 border-gray-200 line-through',
  SUSPENDED: 'bg-orange-100 text-orange-800 border-orange-200'
};

export default function Badge({ status, className }: BadgeProps) {
  return (
    <span
      className={twMerge(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border uppercase tracking-wide',
        statusColors[status] || 'bg-gray-100 text-gray-800 border-gray-200',
        className
      )}
    >
      {status}
    </span>
  );
}