import React from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { LogIn, LogOut, Upload, FileCheck, Shield, AlertTriangle, Settings, UserPlus, UserCog, Eye } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const actionIcons = {
  login: LogIn,
  logout: LogOut,
  credential_upload: Upload,
  credential_issued: FileCheck,
  credential_verified: Shield,
  verification_requested: Eye,
  access_denied: AlertTriangle,
  settings_changed: Settings,
  user_created: UserPlus,
  role_changed: UserCog,
  security_alert: AlertTriangle,
};

const actionColors = {
  login: 'bg-slate-500/10 text-slate-400',
  logout: 'bg-slate-500/10 text-slate-400',
  credential_upload: 'bg-cyan-500/10 text-cyan-400',
  credential_issued: 'bg-cyan-500/10 text-cyan-400',
  credential_verified: 'bg-blue-500/10 text-blue-400',
  verification_requested: 'bg-indigo-500/10 text-indigo-400',
  access_denied: 'bg-destructive/10 text-destructive',
  settings_changed: 'bg-violet-500/10 text-violet-400',
  user_created: 'bg-violet-500/10 text-violet-400',
  role_changed: 'bg-violet-500/10 text-violet-400',
  security_alert: 'bg-destructive/10 text-destructive',
};

const severityColors = {
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
};

const roleColors = {
  student: 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20',
  employee: 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20',
  admin: 'bg-violet-500/10 text-violet-400 hover:bg-violet-500/20',
};

export default function AuditLogTable({ logs = [], className }) {
  return (
    <div className={cn('bg-card rounded-xl border border-border overflow-hidden', className)}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50 border-border">
            <TableHead className="w-48 text-muted-foreground">Timestamp</TableHead>
            <TableHead className="w-40 text-muted-foreground">Action</TableHead>
            <TableHead className="text-muted-foreground">Actor</TableHead>
            <TableHead className="w-28 text-muted-foreground">Role</TableHead>
            <TableHead className="w-32 text-muted-foreground">Severity</TableHead>
            <TableHead className="text-muted-foreground">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                No audit logs available
              </TableCell>
            </TableRow>
          ) : (
            logs.map((log) => {
              const ActionIcon = actionIcons[log.action] || Eye;
              return (
                <TableRow key={log.id} className="hover:bg-muted/30 transition-colors border-border">
                  <TableCell className="font-mono text-sm text-foreground/80">{format(new Date(log.created_date), 'PP p')}</TableCell>
                  <TableCell>
                    <div
                      className={cn(
                        'inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border border-transparent',
                        actionColors[log.action] || 'bg-muted text-muted-foreground'
                      )}
                    >
                      <ActionIcon className="w-3.5 h-3.5" />
                      {log.action?.replace(/_/g, ' ')}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-foreground">{log.actor_email}</TableCell>
                  <TableCell>
                    {(() => {
                      const displayRole = log.actor_role && ['institution','employer'].includes(log.actor_role) ? 'employee' : log.actor_role;
                      return (
                        <Badge variant="secondary" className={cn('capitalize border-0', roleColors[displayRole])}>
                          {displayRole}
                        </Badge>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(severityColors[log.severity])}>
                      {log.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {log.target_type && `${log.target_type}: ${log.target_id || 'N/A'}`}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
