import React, { useEffect } from 'react';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function AuthSuccess() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getToken, isLoaded: isAuthLoaded } = useAuth();
  const { isLoaded, isSignedIn } = useUser();

  const rawRole = (searchParams.get('role') || '').toLowerCase();
  const roleFromPath = location.pathname === '/admin-auth/success' ? 'admin' : '';
  const role = roleFromPath || (['student', 'registrar', 'admin'].includes(rawRole) ? rawRole : '');
  const dashboardPath = role ? `/${role}-dashboard` : '/';
  const authPath = role === 'admin' ? '/admin-auth' : role ? `/auth?role=${encodeURIComponent(role)}` : '/auth';

  useEffect(() => {
    if (!isLoaded || !isAuthLoaded) return;

    let cancelled = false;

    async function finalizeAuthRedirect() {
      if (isSignedIn) {
        navigate(dashboardPath, { replace: true });
        return;
      }

      // First-login OAuth can take a few seconds before Clerk cookie/session is readable.
      for (let attempt = 1; attempt <= 60; attempt += 1) {
        if (cancelled) return;
        const token = await getToken();
        if (token) {
          navigate(dashboardPath, { replace: true });
          return;
        }
        await sleep(250);
      }

      if (!cancelled) {
        navigate(authPath, { replace: true });
      }
    }

    finalizeAuthRedirect();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isAuthLoaded, isSignedIn, getToken, authPath, dashboardPath, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div>Signing you in... Redirecting to your dashboard.</div>
    </div>
  );
}
