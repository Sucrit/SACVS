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
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-1 text-lg">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>

      {stats.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(({ title, value, icon: Icon }, i) => (
            <div 
              key={title} 
              className="bg-card/50 backdrop-blur border border-border/50 rounded-xl p-6 flex flex-col items-start gap-2 shadow-sm transition-all hover:shadow-md hover:border-primary/20"
            >
              <div className="p-2 rounded-lg bg-primary/10 text-primary mb-2">
                 {Icon && <Icon className="w-5 h-5" />}
              </div>
              <div className="text-sm text-muted-foreground font-medium">{title}</div>
              <div className="text-2xl font-bold text-foreground">{value}</div>
            </div>
          ))}
        </div>
      )}
      
      <div className="bg-transparent">
        {children}
      </div>
    </div>
  );
}
