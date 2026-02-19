import { useLegacyAuth } from '../auth/auth-context';

export type UserRole = 'STUDENT' | 'REGISTRAR' | 'ADMIN';

export const useUserRole = () => {
  const { user, isLoading } = useLegacyAuth();
  const isLoaded = !isLoading;

  if (!isLoaded || !user) {
    return { role: null, isLoaded };
  }

  const role = user.role;
  const allowedRoles: UserRole[] = ['STUDENT', 'REGISTRAR', 'ADMIN'];

  if (typeof role === 'string' && allowedRoles.includes(role as UserRole)) {
    return { role: role as UserRole, isLoaded };
  }

  return { role: null, isLoaded };
};
