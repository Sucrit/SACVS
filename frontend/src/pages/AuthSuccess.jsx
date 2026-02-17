import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';

export default function AuthSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useUser();

  const rawRole = (searchParams.get('role') || '').toLowerCase();
  const role = ['student', 'registrar', 'admin'].includes(rawRole) ? rawRole : '';
  const dashboardPath = role ? `/${role}-dashboard` : '/';
  const authPath = role ? `/auth?role=${encodeURIComponent(role)}` : '/auth';

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      navigate(authPath, { replace: true });
      return;
    }

    try {
      try {
        localStorage.setItem('clerk_signed_in_path', dashboardPath);
      } catch {
        // ignore storage errors
      }

      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'clerk_signed_in', path: dashboardPath }, window.location.origin);
        setTimeout(() => window.close(), 500);
      } else {
        navigate(dashboardPath, { replace: true });
      }
    } catch {
      navigate(dashboardPath, { replace: true });
    }
  }, [isLoaded, isSignedIn, authPath, dashboardPath, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div>Signing you in... Redirecting to your dashboard.</div>
    </div>
  );
}
