import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { isAxiosError } from 'axios';
import { setAuthTokenGetter } from '../api/client';
import { queryClient } from '../lib/queryClient';
import { appQueryKeys } from '../lib/queryKeys';
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

const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

export const LegacyAuthProvider = ({ children }: { children: ReactNode }) => {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshInFlightRef = useRef<Promise<User | null> | null>(null);
  const lastResolvedUserIdRef = useRef<string | null>(null);

  const resetSessionCache = useCallback(() => {
    queryClient.clear();
    lastResolvedUserIdRef.current = null;
  }, []);

  const resolveAuthToken = useCallback(async (): Promise<string | null> => {
    const retryDelaysMs = [0, 150, 350, 750];

    for (const delayMs of retryDelaysMs) {
      if (delayMs > 0) {
        await wait(delayMs);
      }

      const token = await getToken();
      if (token) {
        return token;
      }
    }

    return null;
  }, [getToken]);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    if (!isSignedIn) {
      setAuthTokenGetter(null);
      realtimeService.stop();
      resetSessionCache();
      setUser(null);
      return null;
    }

    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const request = (async (): Promise<User | null> => {
      try {
        const currentUser = await queryClient.fetchQuery({
          queryKey: appQueryKeys.auth.currentUser(),
          staleTime: 1000 * 60,
          queryFn: async () => {
            setAuthTokenGetter(resolveAuthToken);

            try {
              return await UserService.getMe();
            } catch (error) {
              if (isAxiosError(error) && error.response?.status === 401) {
                await wait(300);
                return await UserService.getMe();
              }
              if (isAxiosError(error) && error.response?.status === 404) {
                return null;
              }
              throw error;
            }
          },
        });

        if (!currentUser) {
          resetSessionCache();
          setUser(null);
          return null;
        }

        if (lastResolvedUserIdRef.current && lastResolvedUserIdRef.current !== currentUser.id) {
          resetSessionCache();
          queryClient.setQueryData(appQueryKeys.auth.currentUser(), currentUser);
        }
        lastResolvedUserIdRef.current = currentUser.id;
        setUser(currentUser);
        return currentUser;
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 404) {
          resetSessionCache();
          setUser(null);
          return null;
        }

        throw error;
      } finally {
        refreshInFlightRef.current = null;
      }
    })();

    refreshInFlightRef.current = request;
    return request;
  }, [isSignedIn, resetSessionCache, resolveAuthToken]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      setAuthTokenGetter(null);
      realtimeService.stop();
      resetSessionCache();
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
  }, [isLoaded, isSignedIn, refreshUser, resetSessionCache]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setAuthTokenGetter(null);
      return;
    }

    setAuthTokenGetter(resolveAuthToken);
  }, [isLoaded, isSignedIn, resolveAuthToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      realtimeService.stop();
      return;
    }
    realtimeService.start(async () => {
      return resolveAuthToken();
    });
    return () => realtimeService.stop();
  }, [isLoaded, isSignedIn, resolveAuthToken]);

  const logout = useCallback(async () => {
    await signOut({ redirectUrl: '/' });
    setAuthTokenGetter(null);
    realtimeService.stop();
    resetSessionCache();
    setUser(null);
  }, [resetSessionCache, signOut]);

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
