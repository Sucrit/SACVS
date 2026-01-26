import React from 'react';
import { cn } from '@/lib/utils';
import { UserX, FileWarning, Undo2, Eye, ServerCrash, ShieldOff, AlertOctagon, Activity } from 'lucide-react';
import RiskBadge from '@/components/ui/RiskBadge';

const strideConfig = {
  spoofing: { icon: UserX, label: 'Spoofing', description: 'Identity falsification attempt', color: 'bg-destructive/20 text-destructive' },
  tampering: { icon: FileWarning, label: 'Tampering', description: 'Data integrity compromise', color: 'bg-orange-500/20 text-orange-500' },
  repudiation: { icon: Undo2, label: 'Repudiation', description: 'Action denial attempt', color: 'bg-amber-500/20 text-amber-500' },
  information_disclosure: { icon: Eye, label: 'Info Disclosure', description: 'Unauthorized data exposure', color: 'bg-amber-500/20 text-amber-500' },
  denial_of_service: { icon: ServerCrash, label: 'Denial of Service', description: 'Service availability threat', color: 'bg-violet-500/20 text-violet-500' },
  elevation_of_privilege: { icon: ShieldOff, label: 'Privilege Escalation', description: 'Unauthorized access level', color: 'bg-destructive/20 text-destructive' },
  unauthorized_access: { icon: AlertOctagon, label: 'Unauthorized Access', description: 'Access control violation', color: 'bg-destructive/20 text-destructive' },
  suspicious_activity: { icon: Activity, label: 'Suspicious Activity', description: 'Anomalous behavior detected', color: 'bg-amber-500/20 text-amber-500' },
};

const statusColors = {
  active: 'bg-destructive/10 text-destructive border-destructive/20',
  investigating: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  mitigated: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

export default function ThreatIndicator({ event, className }) {
  const config = strideConfig[event.event_type] || strideConfig.suspicious_activity;
  const ThreatIcon = config.icon;

  return (
    <div className={cn('bg-card rounded-xl border border-border p-4 hover:shadow-md transition-all', className)}>
      <div className="flex items-start gap-4">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', config.color)}>
          <ThreatIcon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-foreground">{config.label}</h4>
            <RiskBadge level={event.risk_level} />
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border capitalize', statusColors[event.status])}>
              {event.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{event.description}</p>

          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            {event.source_ip && (
              <span>
                Source: <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground/80">{event.source_ip}</code>
              </span>
            )}
            {event.affected_resource && <span>Resource: {event.affected_resource}</span>}
          </div>

          {event.mitigations_applied?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs font-medium text-foreground mb-1">Mitigations Applied:</p>
              <div className="flex flex-wrap gap-1">
                {event.mitigations_applied.map((mitigation, idx) => (
                  <span key={idx} className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">
                    {mitigation}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
