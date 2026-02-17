import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function AuthSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const role = searchParams.get('role');
  const dashboardPath = role ? `/${role.toLowerCase()}-dashboard` : '/';

  useEffect(() => {
    try {
      // also write to localStorage as a reliable cross-tab signal
      try {
        localStorage.setItem('clerk_signed_in_path', dashboardPath);
      } catch {
        // ignore storage errors
      }
      // If this tab was opened by the app, notify the opener so it can navigate
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'clerk_signed_in', path: dashboardPath }, window.location.origin);
        // Give the opener a moment to process, then close this tab
        setTimeout(() => window.close(), 500);
      } else {
        // Otherwise navigate this tab to the dashboard
        navigate(dashboardPath, { replace: true });
      }
    } catch {
      // fallback: navigate here
      navigate(dashboardPath, { replace: true });
    }
  }, [dashboardPath, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div>Signing you in… Redirecting to your dashboard.</div>
    </div>
  );
}
