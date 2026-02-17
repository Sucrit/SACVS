import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function AdminSignupDisabled() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-lg w-full rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Admin Sign-Up Disabled</h1>
        <p className="mt-3 text-muted-foreground">
          Admin accounts are provisioned manually for security. Please contact an existing administrator.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
