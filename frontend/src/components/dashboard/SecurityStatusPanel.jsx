import React from 'react';
import { Shield, Lock, Key, Fingerprint, Server, Database, Wifi, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import SecurityBadge from '@/components/ui/SecurityBadge';

const securityItems = [
  { id: 'https', label: 'HTTPS Communication', icon: Lock, status: 'active', detail: 'TLS 1.3 Encrypted' },
  { id: 'mfa', label: 'Multi-Factor Auth', icon: Fingerprint, status: 'active', detail: 'TOTP Enabled' },
  { id: 'session', label: 'Session Management', icon: Key, status: 'active', detail: 'Token-based' },
  { id: 'encryption', label: 'Data Encryption', icon: Shield, status: 'active', detail: 'AES-256' },
  { id: 'api', label: 'API Security', icon: Server, status: 'active', detail: 'Rate Limited' },
  { id: 'database', label: 'Database Security', icon: Database, status: 'active', detail: 'Encrypted at Rest' },
];

export default function SecurityStatusPanel({ className }) {
  return (
    <div className={cn('bg-card rounded-xl border border-border overflow-hidden', className)}>
      <div className="px-6 py-4 border-b border-border bg-muted/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <Shield className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Security Status</h3>
              <p className="text-xs text-muted-foreground">Real-time security monitoring</p>
            </div>
          </div>
          <SecurityBadge variant="secure" label="All Systems Secure" />
        </div>
      </div>

      <div className="divide-y divide-border">
        {securityItems.map((item) => (
          <div key={item.id} className="px-6 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <item.icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{item.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{item.detail}</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_theme('colors.emerald.500')]" />
                <span className="text-xs font-medium text-emerald-500">Active</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-6 py-4 bg-muted/20 border-t border-border">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wifi className="w-4 h-4" />
            <span>Last security scan: 2 minutes ago</span>
          </div>
          <span className="text-emerald-500 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" />
            No threats detected
          </span>
        </div>
      </div>
    </div>
  );
}
