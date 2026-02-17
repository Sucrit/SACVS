import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function MetricCard({ title, value, subtitle, icon: Icon, trend, trendValue, className }) {
  return (
    <div className={cn('surface-card p-6 text-foreground', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-heading font-bold tracking-tight text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {Icon && (
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        )}
      </div>
      {(trend || trendValue) && (
        <div className="mt-4 flex items-center gap-2 text-sm text-primary">
          {/* Only use primary color for trend icon/text */}
          {trend === 'up' && <TrendingUp className="w-4 h-4" />}
          {trend === 'down' && <TrendingDown className="w-4 h-4" />}
          {!trend && <Minus className="w-4 h-4" />}
          <span className="font-medium">{trendValue}</span>
        </div>
      )}
    </div>
  );
}
