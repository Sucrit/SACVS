import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { useSearchParams } from 'react-router-dom';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role');

  const after = role ? `/auth/success?role=${encodeURIComponent(role)}` : '/auth/success';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignIn afterSignInUrl={after} />
    </div>
  );
}
