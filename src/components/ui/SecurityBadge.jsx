import React from 'react';
import { Shield, ShieldCheck, ShieldAlert, ShieldX, Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';

const variants = {
  secure: {
    icon: ShieldCheck,
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    iconColor: 'text-emerald-500',
  },
  warning: {
    icon: ShieldAlert,
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    iconColor: 'text-amber-500',
  },
  danger: {
    icon: ShieldX,
    bg: 'bg-destructive/10',
    border: 'border-destructive/20',
    text: 'text-destructive',
    iconColor: 'text-destructive',
  },
  neutral: {
    icon: Shield,
    bg: 'bg-secondary/50',
    border: 'border-secondary',
    text: 'text-muted-foreground',
    iconColor: 'text-muted-foreground',
  },
  locked: {
    icon: Lock,
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
    text: 'text-indigo-400',
    iconColor: 'text-indigo-400',
  },
  unlocked: {
    icon: Unlock,
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    text: 'text-orange-400',
    iconColor: 'text-orange-400',
  },
};

export default function SecurityBadge({ variant = 'neutral', label, size = 'sm', showIcon = true, className }) {
  const config = variants[variant] || variants.neutral;
  const Icon = config.icon;

  const sizeClasses = {
    xs: 'text-xs px-2 py-0.5',
    sm: 'text-xs px-2.5 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full border',
        config.bg,
        config.border,
        config.text,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Icon className={cn(iconSizes[size], config.iconColor)} />}
      {label}
    </span>
  );
}
