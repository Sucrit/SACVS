import React from 'react';
// import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Users,
  FileCheck,
  Activity,
  AlertTriangle,
  Lock,
  Server,
  Database,
  Cpu,
  CheckCircle2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import SecurityStatusPanel from '@/components/dashboard/SecurityStatusPanel';
import AuditLogTable from '@/components/audit/AuditLogTable';
import ThreatIndicator from '@/components/security/ThreatIndicator';
import AccessControlMatrix from '@/components/security/AccessControlMatrix';
import SystemArchitecturePanel from '@/components/architecture/SystemArchitecturePanel';
import SecurityBadge from '@/components/ui/SecurityBadge';
import RiskBadge from '@/components/ui/RiskBadge';

export default function AdminDashboard() {
  // Demo data for users, credentials, and securityEvents
  const users = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Charlie' },
  ];
  const credentials = [
    { id: 1, status: 'issued' },
    { id: 2, status: 'pending' },
    { id: 3, status: 'verified' },
  ];
  const securityEvents = [
    { id: 1, status: 'active', type: 'Spoofing', desc: 'Identity falsification', risk: 'high' },
    { id: 2, status: 'resolved', type: 'Tampering', desc: 'Data modification', risk: 'high' },
  ];
  // Demo data for audit logs
  const auditLogs = [
    { id: 1, user: 'Alice', action: 'Logged in', timestamp: '2026-01-20 09:00' },
    { id: 2, user: 'Bob', action: 'Issued credential', timestamp: '2026-01-20 09:15' },
    { id: 3, user: 'Charlie', action: 'Verified credential', timestamp: '2026-01-20 09:30' },
  ];

  const stats = {
    totalUsers: users.length || 12,
    totalCredentials: credentials.length,
    activeThreats: securityEvents.filter((e) => e.status === 'active').length,
    securityScore: 98,
  };

  const systemHealth = [
    { label: 'API Response', value: '45ms', status: 'healthy' },
    { label: 'Database', value: '99.9%', status: 'healthy' },
    { label: 'Blockchain Node', value: 'Connected', status: 'healthy' },
    { label: 'AI Service', value: 'Online', status: 'healthy' },
  ];

  // Demo user for highlighting access control
  const user = { user_role: 'admin', full_name: 'Demo Admin', email: 'admin@secvault.local' };

  return (
    <DashboardLayout
      title="System Administration"
      subtitle="Security monitoring and system operations"
      actions={[
        <SecurityBadge key="secure" variant="secure" label="System Secure" size="md" />,
        <SecurityBadge key="admin" variant="locked" label="Admin Access" size="md" />,
      ]}
      stats={[
        { title: 'Total Users', value: stats.totalUsers, icon: Users },
        { title: 'Credentials Issued', value: stats.totalCredentials, icon: FileCheck },
        { title: 'Active Threats', value: stats.activeThreats, icon: AlertTriangle },
        { title: 'Security Score', value: `${stats.securityScore}%`, icon: Shield },
      ]}
    >
      <Card className="bg-card border border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Activity className="w-5 h-5 text-primary" />
            System Health Indicators
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {systemHealth.map((item) => (
              <div key={item.label} className="bg-muted/30 border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                </div>
                <p className="text-lg font-bold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="security" className="space-y-6">
        <TabsList className="bg-muted border border-border">
          <TabsTrigger value="security">Security Status</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          <TabsTrigger value="threats">Threat Monitoring</TabsTrigger>
          <TabsTrigger value="access">Access Control</TabsTrigger>
          <TabsTrigger value="architecture">Architecture</TabsTrigger>
        </TabsList>

        <TabsContent value="security" className="space-y-6">
          <SecurityStatusPanel />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card border border-border">
              <CardHeader className="border-b border-border">
                <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                  <Lock className="w-5 h-5 text-primary" />
                  Encryption Status
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {[
                  { label: 'Data at Rest', algorithm: 'AES-256', status: 'Active' },
                  { label: 'Data in Transit', algorithm: 'TLS 1.3', status: 'Active' },
                  { label: 'Credential Hashing', algorithm: 'SHA-256', status: 'Active' },
                  { label: 'Session Tokens', algorithm: 'JWT RS256', status: 'Active' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-lg">
                    <div>
                      <p className="font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.algorithm}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-primary rounded-full" />
                      <span className="text-sm text-primary">{item.status}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-card border border-border">
              <CardHeader className="border-b border-border">
                <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                  <Server className="w-5 h-5 text-primary" />
                  Service Status
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {[
                  { label: 'Authentication Service', uptime: '99.99%', icon: Lock },
                  { label: 'Verification Engine', uptime: '99.95%', icon: Shield },
                  { label: 'AI Validation Module', uptime: '99.90%', icon: Cpu },
                  { label: 'Blockchain Interface', uptime: '99.85%', icon: Database },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <item.icon className="w-4 h-4 text-muted-foreground" />
                      <p className="font-medium text-foreground">{item.label}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{item.uptime}</span>
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogTable logs={auditLogs} />
          {auditLogs.length === 0 && (
            <Card className="text-center py-12 bg-card border border-border">
              <CardContent>
                <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No audit logs recorded yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">User activities will appear here</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="threats" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">STRIDE Threat Monitoring</h3>
            <SecurityBadge
              variant={stats.activeThreats > 0 ? 'warning' : 'secure'}
              label={stats.activeThreats > 0 ? `${stats.activeThreats} Active` : 'All Clear'}
            />
          </div>

          {securityEvents.length > 0 ? (
            <div className="space-y-4">
              {securityEvents.map((event) => (
                <motion.div key={event.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <ThreatIndicator event={event} />
                </motion.div>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12 bg-card border border-border">
              <CardContent>
                <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
                <p className="text-primary font-medium">No Active Threats Detected</p>
                <p className="text-sm text-muted-foreground mt-1">All security controls are functioning normally</p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card border border-border">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg text-foreground">STRIDE Threat Categories</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Spoofing', desc: 'Identity falsification', risk: 'high' },
                  { label: 'Tampering', desc: 'Data modification', risk: 'high' },
                  { label: 'Repudiation', desc: 'Action denial', risk: 'medium' },
                  { label: 'Info Disclosure', desc: 'Data exposure', risk: 'high' },
                  { label: 'DoS', desc: 'Service disruption', risk: 'medium' },
                  { label: 'Privilege Escalation', desc: 'Access elevation', risk: 'critical' },
                ].map((item) => (
                  <div key={item.label} className="bg-muted/30 border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-foreground">{item.label}</span>
                      <RiskBadge level={item.risk} />
                    </div>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access">
          <AccessControlMatrix highlightRole={user?.user_role} />
        </TabsContent>

        <TabsContent value="architecture">
          <SystemArchitecturePanel />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
