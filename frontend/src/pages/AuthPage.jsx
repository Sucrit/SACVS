import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { useUser } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useUser();
  const role = (searchParams.get('role') || '').toLowerCase();
  const normalizedRole = role === 'student' || role === 'registrar' ? role : '';
  const isAdminLogin = location.pathname.startsWith('/admin-auth');
  const isAdminSsoCallback = location.pathname.startsWith('/admin-auth/sso-callback');
  const after = isAdminLogin
    ? '/admin-auth/success'
    : normalizedRole
      ? `/auth/success?role=${encodeURIComponent(normalizedRole)}`
      : '/auth/success';

  useEffect(() => {
    if (!isAdminSsoCallback || !isLoaded) return;
    if (isSignedIn) return;

    const timerId = window.setTimeout(() => {
      navigate('/admin-auth', { replace: true });
    }, 1500);

    return () => window.clearTimeout(timerId);
  }, [isAdminSsoCallback, isLoaded, isSignedIn, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignIn
        key={`${isAdminLogin ? 'admin' : 'user'}-signin-${normalizedRole || 'default'}`}
        routing="path"
        path={isAdminLogin ? '/admin-auth' : '/auth'}
        afterSignInUrl={after}
        forceRedirectUrl={after}
        fallbackRedirectUrl={after}
        withSignUp={false}
        transferable={false}
        oauthFlow="popup"
      />
    </div>
  );
}
