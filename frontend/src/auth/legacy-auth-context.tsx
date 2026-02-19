import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { setAuthTokenGetter } from '../api/client';
import { User, UserService } from '../services/user.service';

interface LegacyAuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isSessionAuthenticated: boolean;
  isLoading: boolean;
  refreshUser: () => Promise<User | null>;
  logout: () => Promise<void>;
}

const LegacyAuthContext = createContext<LegacyAuthContextValue | undefined>(undefined);

export const LegacyAuthProvider = ({ children }: { children: ReactNode }) => {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    if (!isSignedIn) {
      setUser(null);
      return null;
    }

    try {
      setAuthTokenGetter(async () => {
        const token = await getToken();
        return token ?? null;
      });
      const currentUser = await UserService.getMe();
      setUser(currentUser);
      return currentUser;
    } catch (error) {
      setUser(null);
      return null;
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      setAuthTokenGetter(null);
      setUser(null);
      setIsLoading(false);
      return;
    }

    setAuthTokenGetter(async () => {
      const token = await getToken();
      return token ?? null;
    });

    const initialize = async () => {
      setIsLoading(true);
      await refreshUser();
      setIsLoading(false);
    };

    void initialize();
  }, [getToken, isLoaded, isSignedIn, refreshUser]);

  const logout = useCallback(async () => {
    await signOut({ redirectUrl: '/' });
    setAuthTokenGetter(null);
    setUser(null);
  }, [signOut]);

  const value = useMemo<LegacyAuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!isSignedIn && !!user,
      isSessionAuthenticated: !!isSignedIn,
      isLoading: !isLoaded || isLoading,
      refreshUser,
      logout,
    }),
    [isLoaded, isLoading, isSignedIn, refreshUser, user, logout],
  );

  return <LegacyAuthContext.Provider value={value}>{children}</LegacyAuthContext.Provider>;
};

export const useLegacyAuth = (): LegacyAuthContextValue => {
  const context = useContext(LegacyAuthContext);
  if (!context) {
    throw new Error('useLegacyAuth must be used within LegacyAuthProvider');
  }

  return context;
};
