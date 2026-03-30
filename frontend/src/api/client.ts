import axios from 'axios';

const API_BASE_URL = [import.meta.env.VITE_GATEWAY_URL, import.meta.env.VITE_API_URL].find(
  (value): value is string => typeof value === 'string' && value.trim().length > 0,
);

if (!API_BASE_URL) {
  throw new Error('Missing APi base url');
}

type TokenGetter = (() => Promise<string | null>) | null;

let authTokenGetter: TokenGetter = null;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setAuthTokenGetter = (getter: TokenGetter) => {
  authTokenGetter = getter;
};

api.interceptors.request.use(async config => {
  if (!authTokenGetter) {
    delete config.headers.Authorization;
    return config;
  }

  const token = await authTokenGetter();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }

  return config;
});

import { clearCachedIssuanceToken } from '../hooks/useStepUp';

api.interceptors.response.use(
  response => response,
  error => {
    // Clear cached issuance step-up tokens when the server rejects them.
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      const serverError = error.response.data?.error;
      if (serverError === 'STEP_UP_TOKEN_INVALID' || serverError === 'STEP_UP_TOKEN_EXPIRED') {
        clearCachedIssuanceToken();
      }
    }
    return Promise.reject(error);
  },
);
