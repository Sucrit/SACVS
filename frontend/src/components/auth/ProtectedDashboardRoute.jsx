import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import axios from 'axios';
import { fetchCurrentUser } from '@/api/users';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function roleDashboardPath(role) {
  if (role === 'ADMIN') return '/admin-dashboard';
  if (role === 'REGISTRAR') return '/registrar-dashboard';
  return '/student-dashboard';
}

export default function ProtectedDashboardRoute({ allowedRoles, children }) {
  const { isSignedIn, isLoaded: isUserLoaded } = useUser();
  const { getToken, isLoaded: isAuthLoaded } = useAuth();
  const [state, setState] = useState({ loading: true, user: null, error: null });
  const normalizedAllowedRoles = useMemo(
    () => (Array.isArray(allowedRoles) ? allowedRoles.map((r) => String(r).toUpperCase()) : []),
    [allowedRoles]
  );
  const isAdminOnlyRoute =
    normalizedAllowedRoles.length > 0 && normalizedAllowedRoles.every((role) => role === 'ADMIN');

  useEffect(() => {
    if (isAdminOnlyRoute) {
      return;
    }

    if (!isUserLoaded || !isAuthLoaded || !isSignedIn) {
      return;
    }

    const controller = new AbortController();
    let mounted = true;

    async function loadCurrentUser() {
      if (mounted) {
        setState({ loading: true, user: null, error: null });
      }

      const maxAttempts = 6;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const token = await getToken();
          if (!token) {
            await sleep(250 * attempt);
            continue;
          }

          const user = await fetchCurrentUser(token, controller.signal);
          if (!mounted) return;
          setState({ loading: false, user, error: null });
          return;
        } catch (err) {
          if (!mounted) return;
          if (err.name === 'CanceledError' || axios.isCancel?.(err)) return;

          const status = err?.response?.status;
          if (status === 404 || status === 401 || status === 403) {
            await sleep(300 * attempt);
            continue;
          }

          setState({ loading: false, user: null, error: err });
          return;
        }
      }

      if (mounted) {
        setState({ loading: false, user: null, error: new Error('Unable to load account access state.') });
      }
    }

    loadCurrentUser();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [isSignedIn, isUserLoaded, isAuthLoaded, getToken, isAdminOnlyRoute]);

  if (!isUserLoaded || !isAuthLoaded || (!isAdminOnlyRoute && state.loading)) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Checking account access...</div>;
  }

  if (!isSignedIn) {
    if (isAdminOnlyRoute) {
      return <Navigate to="/admin-auth" replace />;
    }
    return <Navigate to="/" replace />;
  }

  if (isAdminOnlyRoute) {
    return <>{children}</>;
  }

  if (state.error || !state.user) {
    return <Navigate to="/" replace />;
  }

  if (state.user.status !== 'APPROVED') {
    return <Navigate to="/pending-approval" replace />;
  }

  if (normalizedAllowedRoles.length > 0 && !normalizedAllowedRoles.includes(String(state.user.role).toUpperCase())) {
    return <Navigate to={roleDashboardPath(state.user.role)} replace />;
  }

  return <>{children}</>;
}
