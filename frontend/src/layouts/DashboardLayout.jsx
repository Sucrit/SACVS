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

  const actionItems = Array.isArray(actions) ? actions : actions ? [actions] : [];

  return (
    <div className="space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="surface-card p-6 md:p-7">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-semibold mb-2">Control Panel</p>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground">{title}</h1>
            {subtitle && <p className="text-muted-foreground mt-2 text-base md:text-lg max-w-2xl">{subtitle}</p>}
          </div>
          {actionItems.length > 0 && <div className="flex flex-wrap items-center gap-3">{actionItems}</div>}
        </div>
      </div>

      {stats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map(({ title, value, icon: Icon }, i) => (
            <div 
              key={title} 
              className="surface-card p-5 animate-enter-up"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="mb-3 flex items-center justify-between w-full">
                <div className="text-sm text-muted-foreground font-medium">{title}</div>
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                 {Icon && <Icon className="w-5 h-5" />}
                </div>
              </div>
              <div className="text-3xl font-heading font-bold text-foreground leading-none">{value}</div>
            </div>
          ))}
        </div>
      )}
      
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}
