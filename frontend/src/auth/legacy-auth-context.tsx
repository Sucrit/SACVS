import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setAuthToken } from '../api/client';
import {
  AuthChallengeResponse,
  RegisterPayload,
  User,
  UserService,
  VerifyOtpPayload,
  LoginPayload,
} from '../services/user.service';

const TOKEN_STORAGE_KEY = 'sacvs_legacy_auth_token';

interface LegacyAuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  register: (payload: RegisterPayload) => Promise<AuthChallengeResponse>;
  login: (payload: LoginPayload) => Promise<AuthChallengeResponse>;
  verifyOtp: (payload: VerifyOtpPayload) => Promise<User>;
  refreshUser: () => Promise<User | null>;
  logout: () => void;
}

const LegacyAuthContext = createContext<LegacyAuthContextValue | undefined>(undefined);

const persistToken = (token: string | null) => {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
};

export const LegacyAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyToken = useCallback((nextToken: string | null) => {
    setToken(nextToken);
    setAuthToken(nextToken);
    persistToken(nextToken);
  }, []);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    if (!token) {
      setUser(null);
      return null;
    }

    try {
      const currentUser = await UserService.getMe();
      setUser(currentUser);
      return currentUser;
    } catch (error) {
      console.error('Failed to refresh authenticated user:', error);
      applyToken(null);
      setUser(null);
      return null;
    }
  }, [applyToken, token]);

  useEffect(() => {
    const initialize = async () => {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!storedToken) {
        setAuthToken(null);
        setIsLoading(false);
        return;
      }

      applyToken(storedToken);
      try {
        const currentUser = await UserService.getMe();
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to initialize legacy auth session:', error);
        applyToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    void initialize();
  }, [applyToken]);

  const register = useCallback(async (payload: RegisterPayload) => {
    return UserService.register(payload);
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    return UserService.login(payload);
  }, []);

  const verifyOtp = useCallback(
    async (payload: VerifyOtpPayload) => {
      const response = await UserService.verifyOtp(payload);
      applyToken(response.token);
      setUser(response.user);
      return response.user;
    },
    [applyToken],
  );

  const logout = useCallback(() => {
    applyToken(null);
    setUser(null);
  }, [applyToken]);

  const value = useMemo<LegacyAuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: !!token && !!user,
      isLoading,
      register,
      login,
      verifyOtp,
      refreshUser,
      logout,
    }),
    [user, token, isLoading, register, login, verifyOtp, refreshUser, logout],
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
