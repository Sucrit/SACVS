import { useUser } from '@clerk/clerk-react';
import { useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:4000'; // Use gateway/proxy (mounted under /api)

/**
 * Syncs the Clerk user to the backend user-service database.
 * @param {string} role - One of 'STUDENT', 'EMPLOYEE', 'ADMIN'
 */
export function useSyncUserToBackend(role) {
  const { user, isSignedIn } = useUser();

  useEffect(() => {
    // allow role from localStorage for flows that redirect after sign-in
    const storedRole = role || localStorage.getItem('pending_role');
    if (!isSignedIn || !user || !storedRole) return;

    const payload = { clerkId: user.id, role: storedRole.toUpperCase() };
    axios.post(`${API_BASE_URL}/users`, payload)
      .then(() => {
        localStorage.removeItem('pending_role');
      })
      .catch((err) => {
        console.error('failed to sync user to backend', err?.response?.data || err.message);
      });
  }, [isSignedIn, user, role]);
}
