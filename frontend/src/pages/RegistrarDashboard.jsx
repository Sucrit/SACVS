import React from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Building2, Briefcase } from 'lucide-react';

export default function RegistrarDashboard() {
  const navigate = useNavigate();

  return (
    <DashboardLayout
      title="Registrar Dashboard"
      subtitle="Issue and verify credentials for your organization"
      actions={[]}
      stats={[]}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><Building2 className="w-5 h-5 text-primary" /> Issue Credentials</h3>
          <p className="text-sm text-muted-foreground mb-4">Create and issue credentials to students and manage issuing records.</p>
          <Button onClick={() => navigate('/institution-dashboard')} className="bg-primary hover:bg-primary/90">Go to Issuing</Button>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><Briefcase className="w-5 h-5 text-primary" /> Verify Credentials</h3>
          <p className="text-sm text-muted-foreground mb-4">Request and verify candidate credentials submitted for review.</p>
          <Button onClick={() => navigate('/registrar-verification-dashboard')} className="bg-primary hover:bg-primary/90">Go to Verification</Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
