import React from 'react';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const permissions = [
  { id: 'view_own_credentials', label: 'View Own Credentials' },
  { id: 'upload_credentials', label: 'Upload Credentials' },
  { id: 'issue_credentials', label: 'Issue Credentials' },
  { id: 'verify_credentials', label: 'Verify Credentials' },
  { id: 'request_verification', label: 'Request Verification' },
  { id: 'view_verification_history', label: 'View Verification History' },
  { id: 'manage_users', label: 'Manage Users' },
  { id: 'view_audit_logs', label: 'View Audit Logs' },
  { id: 'manage_security', label: 'Manage Security Settings' },
  { id: 'system_configuration', label: 'System Configuration' },
];

const rolePermissions = {
  student: ['view_own_credentials', 'upload_credentials', 'view_verification_history'],
  registrar: ['view_own_credentials', 'upload_credentials', 'issue_credentials', 'verify_credentials', 'request_verification', 'view_verification_history'],
  admin: [
    'view_own_credentials',
    'upload_credentials',
    'issue_credentials',
    'verify_credentials',
    'request_verification',
    'view_verification_history',
    'manage_users',
    'view_audit_logs',
    'manage_security',
    'system_configuration',
  ],
};

const roleColors = {
  student: 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20',
  registrar: 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border-indigo-500/20',
  admin: 'bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border-violet-500/20',
};

export default function AccessControlMatrix({ highlightRole, className }) {
  const roles = ['student', 'registrar', 'admin'];

  const hasPermission = (role, permissionId) => rolePermissions[role]?.includes(permissionId);

  return (
    <div className={cn('bg-card rounded-xl border border-border overflow-hidden', className)}>
      <div className="px-6 py-4 border-b border-border bg-muted/50">
        <h3 className="font-semibold text-foreground">Role-Based Access Control (RBAC)</h3>
        <p className="text-sm text-muted-foreground mt-1">Permission matrix for all system roles</p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-border after:hover:bg-transparent">
              <TableHead className="w-64 text-muted-foreground">Permission</TableHead>
              {roles.map((role) => (
                <TableHead key={role} className="text-center capitalize w-28">
                  <span
                    className={cn(
                      'inline-block px-3 py-1 rounded-full text-xs font-medium border border-transparent',
                      roleColors[role],
                      highlightRole === role && 'ring-2 ring-offset-2 ring-indigo-500 ring-offset-background'
                    )}
                  >
                    {role}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.map((permission) => (
              <TableRow key={permission.id} className="hover:bg-muted/50 transition-colors border-border">
                <TableCell className="font-medium text-sm text-foreground/90">{permission.label}</TableCell>
                {roles.map((role) => (
                  <TableCell key={role} className="text-center">
                    {hasPermission(role, permission.id) ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-emerald-500/10 rounded-full">
                        <Check className="w-4 h-4 text-emerald-400" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-muted rounded-full">
                        <X className="w-4 h-4 text-muted-foreground/50" />
                      </span>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
