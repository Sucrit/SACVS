import React from 'react';
import { useClerk } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function PendingApproval() {
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const handleBackToHome = () => {
    localStorage.removeItem('pending_role');
    localStorage.removeItem('clerk_signed_in_path');
    navigate('/', { replace: true });
  };

  const handleSignOut = () => {
    localStorage.removeItem('pending_role');
    localStorage.removeItem('clerk_signed_in_path');
    signOut({ redirectUrl: '/' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-lg w-full rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Account Pending Approval</h1>
        <p className="mt-3 text-muted-foreground">
          Your account has been created but is not yet approved by an administrator.
          Please wait for approval before accessing dashboards.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="outline" onClick={handleBackToHome}>
            Back to Home
          </Button>
          <Button onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
