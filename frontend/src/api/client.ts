import axios from 'axios';

const API_URL =
  import.meta.env.VITE_GATEWAY_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:4900';

type TokenGetter = (() => Promise<string | null>) | null;

let authTokenGetter: TokenGetter = null;

export const api = axios.create({
  baseURL: API_URL,
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
