import { useUser } from '@clerk/clerk-react';
import { useEffect } from 'react';
import axios from 'axios';
import { ENV } from '../config/env.js';

/**
 * @param {string} role - One of 'STUDENT', 'EMPLOYEE', 'ADMIN'
 */
export function useSyncUserToBackend(role) {
  const { user, isSignedIn } = useUser();

  useEffect(() => {
    // allow role from localStorage for flows that redirect after sign-in
    const storedRole = role || localStorage.getItem('pending_role');
    if (!isSignedIn || !user || !storedRole) return;

    const payload = { clerkId: user.id, role: storedRole.toUpperCase() };
    axios.post(`${ENV.GATEWAY_URL}/users`, payload)
      .then(() => {
        localStorage.removeItem('pending_role');
      })
      .catch((err) => {
        console.error('failed to sync user to backend', err?.response?.data || err.message);
      });
  }, [isSignedIn, user, role]);
}
