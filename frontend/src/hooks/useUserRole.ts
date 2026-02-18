import { useUser } from '@clerk/clerk-react';

export type UserRole = 'STUDENT' | 'REGISTRAR' | 'ADMIN';

export const useUserRole = () => {
  const { user, isLoaded } = useUser();

  if (!isLoaded || !user) {
    return { role: null, isLoaded };
  }

  // Check public metadata for role
  const role = user.publicMetadata.role as UserRole | undefined;

  // Default to STUDENT if no role is set (for demo/fallback)
  // In a real app, you might want to force a role selection or show a "pending approval" state
  return { role: role || 'STUDENT', isLoaded };
};