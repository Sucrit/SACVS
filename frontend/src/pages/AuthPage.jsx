import React from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { useLocation, useSearchParams } from 'react-router-dom';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const role = (searchParams.get('role') || '').toLowerCase();
  const mode = (searchParams.get('mode') || 'signin').toLowerCase();
  const isAdminLogin = location.pathname === '/admin-auth' || role === 'admin';
  const isSignUpMode = !isAdminLogin && mode === 'signup';

  const roleQuery = role ? `?role=${encodeURIComponent(role)}` : '';
  const signInUrl = `/auth${roleQuery}${role ? '&' : '?'}mode=signin`;
  const signUpUrl = `/auth${roleQuery}${role ? '&' : '?'}mode=signup`;
  const defaultAfter = role ? `/auth/success?role=${encodeURIComponent(role)}` : '/auth/success';
  const after = isAdminLogin ? '/admin-dashboard' : defaultAfter;

  return (
    <div className={`min-h-screen flex items-center justify-center bg-background ${isAdminLogin ? 'admin-auth-signin' : ''}`}>
      {isSignUpMode ? (
        <SignUp
          key={`signup-${role || 'default'}`}
          afterSignUpUrl={after}
          forceRedirectUrl={after}
          fallbackRedirectUrl={after}
          signInUrl={signInUrl}
        />
      ) : (
        <SignIn
          key={`${isAdminLogin ? 'admin' : 'user'}-signin-${role || 'default'}`}
          afterSignInUrl={after}
          forceRedirectUrl={after}
          fallbackRedirectUrl={after}
          withSignUp={false}
          signUpUrl={isAdminLogin ? undefined : signUpUrl}
        />
      )}
    </div>
  );
}
