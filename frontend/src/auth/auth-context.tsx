import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { isAxiosError } from 'axios';
import { setAuthTokenGetter } from '../api/client';
import { User, UserService } from '../services/user.service';
import { realtimeService } from '../services/realtime.service';

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
      setAuthTokenGetter(null);
      realtimeService.stop();
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
      if (isAxiosError(error) && error.response?.status === 404) {
        setUser(null);
        return null;
      }

      throw error;
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      setAuthTokenGetter(null);
      realtimeService.stop();
      setUser(null);
      setIsLoading(false);
      return;
    }

    const initialize = async () => {
      setIsLoading(true);
      try {
        await refreshUser();
      } catch (error) {
        console.error('Failed to refresh current user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void initialize();
  }, [isLoaded, isSignedIn, refreshUser]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      realtimeService.stop();
      return;
    }
    realtimeService.start(async () => {
      const token = await getToken();
      return token ?? null;
    });
    return () => realtimeService.stop();
  }, [getToken, isLoaded, isSignedIn]);

  const logout = useCallback(async () => {
    await signOut({ redirectUrl: '/' });
    setAuthTokenGetter(null);
    realtimeService.stop();
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
