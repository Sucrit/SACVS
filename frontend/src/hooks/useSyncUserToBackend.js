import { useUser, useAuth } from '@clerk/clerk-react';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { ENV } from '../config/env.js';

/**
 * @param {string|null} role
 */
export function useSyncUserToBackend(role) {
  const { user, isSignedIn, isLoaded: isUserLoaded } = useUser();
  const { getToken, isLoaded: isAuthLoaded } = useAuth();
  const location = useLocation();
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!isUserLoaded || !isAuthLoaded || !isSignedIn || !user) return;
    const pendingRoleRaw = role || localStorage.getItem('pending_role');
    const pendingRole = typeof pendingRoleRaw === 'string' ? pendingRoleRaw.toUpperCase() : '';
    const queryRole = new URLSearchParams(location.search).get('role');
    const queryRoleUpper = typeof queryRole === 'string' ? queryRole.toUpperCase() : '';
    const isAdminFlow =
      pendingRole === 'ADMIN' ||
      queryRoleUpper === 'ADMIN' ||
      location.pathname.startsWith('/admin');

    // Admin accounts are login-only in a separate Clerk project and are never stored in user-service DB.
    if (isAdminFlow) return;
    if (inFlightRef.current) return; // avoid duplicate calls

    const controller = new AbortController();
    inFlightRef.current = true;

    const requestedRole =
      pendingRole === 'REGISTRAR' ? 'REGISTRAR' : pendingRole === 'STUDENT' ? 'STUDENT' : undefined;
    const payload = requestedRole ? { clerkId: user.id, role: requestedRole } : { clerkId: user.id };
    const maxAttempts = 5;
    const baseDelay = 500; // ms

    async function trySync() {
      try {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          const token = getToken ? await getToken() : null;
          if (!token) {
            const delay = baseDelay * 2 ** (attempt - 1);
            await new Promise((res) => setTimeout(res, delay));
            continue;
          }

          const headers = { Authorization: `Bearer ${token}` };

          try {
            await axios.post(`${ENV.GATEWAY_URL}/users`, payload, {
              headers,
              signal: controller.signal,
            });
            // success
            localStorage.removeItem('pending_role');
            inFlightRef.current = false;
            return;
          } catch (err) {
            // aborted
            if (err.name === 'CanceledError' || axios.isCancel?.(err)) throw err;

            const status = err?.response?.status;

            // treat already-created as success
            if (status === 409) {
              localStorage.removeItem('pending_role');
              inFlightRef.current = false;
              return;
            }

            // auth race with Clerk token/session can happen right after sign-in
            if (status === 401 || status === 403) {
              const delay = baseDelay * 2 ** (attempt - 1);
              await new Promise((res) => setTimeout(res, delay));
              continue;
            }

            // don't retry client errors
            if (status && status >= 400 && status < 500) {
              console.error('sync failed (non-retryable):', err?.response?.data || err.message);
              inFlightRef.current = false;
              return;
            }

            // transient -> wait then retry
            const delay = baseDelay * 2 ** (attempt - 1);
            await new Promise((res) => setTimeout(res, delay));
          }
        }

        console.error('failed to sync user to backend after retries');
      } catch (err) {
        if (err.name === 'CanceledError') {
          // ignore
        } else {
          console.error('failed to sync user to backend', err?.response?.data || err.message);
        }
      } finally {
        inFlightRef.current = false;
      }
    }

    trySync();

    return () => {
      controller.abort();
      inFlightRef.current = false;
    };
  }, [isSignedIn, user, role, getToken, isAuthLoaded, isUserLoaded, location.pathname, location.search]);
}
