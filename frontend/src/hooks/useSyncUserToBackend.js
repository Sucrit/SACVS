import { useUser, useAuth } from '@clerk/clerk-react';
import { useEffect, useRef } from 'react';
import axios from 'axios';
import { ENV } from '../config/env.js';

/**
 * Sync Clerk user to backend after sign-in.
 * - Prevents duplicate/in-flight requests
 * - Retries transient failures with exponential backoff
 * - Treats 409 (already exists) as success
 * - Uses pending_role when present, but can sync without role
 *
 * @param {string|null} role
 */
export function useSyncUserToBackend(role) {
  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const inFlightRef = useRef(false);

  useEffect(() => {
    const storedRole = role || localStorage.getItem('pending_role');
    if (!isSignedIn || !user) return;
    if (inFlightRef.current) return; // avoid duplicate calls

    const controller = new AbortController();
    inFlightRef.current = true;

    const payload = storedRole
      ? { clerkId: user.id, role: storedRole.toUpperCase() }
      : { clerkId: user.id };
    const maxAttempts = 3;
    const baseDelay = 500; // ms

    async function trySync() {
      try {
        const token = getToken ? await getToken() : null;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
  }, [isSignedIn, user, role, getToken]);
}
