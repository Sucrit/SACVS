import React from 'react';
import { useClerk } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';

export default function PendingApproval() {
  const { signOut } = useClerk();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-lg w-full rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Account Pending Approval</h1>
        <p className="mt-3 text-muted-foreground">
          Your account has been created but is not yet approved by an administrator.
          Please wait for approval before accessing dashboards.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => window.location.assign('/')}>
            Back to Home
          </Button>
          <Button onClick={() => signOut({ redirectUrl: '/' })}>
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
