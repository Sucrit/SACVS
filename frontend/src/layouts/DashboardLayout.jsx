import React, { useEffect } from 'react';

/**
 * DashboardLayout - Unified dashboard layout for all roles
 * Props:
 *  - title: string (main heading)
 *  - subtitle: string (subheading/description)
 *  - actions: ReactNode (action buttons, badges, etc.)
 *  - stats: array of { title, value, icon } (for MetricCard)
 *  - children: main dashboard content
 */
export default function DashboardLayout({ title, subtitle, actions, stats = [], children }) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h1>
            {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
        {stats.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map(({ title, value, icon: Icon }, i) => (
              <div key={title} className="bg-card border border-border rounded-xl p-6 flex flex-col items-start gap-2">
                {Icon && <Icon className="w-6 h-6 text-primary mb-2" />}
                <div className="text-xs text-muted-foreground font-medium">{title}</div>
                <div className="text-2xl font-bold text-foreground">{value}</div>
              </div>
            ))}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
