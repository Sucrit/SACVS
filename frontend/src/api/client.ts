import axios from 'axios';

const API_BASE_URLS = Array.from(
  new Set(
    [
      import.meta.env.VITE_GATEWAY_URL,
      import.meta.env.VITE_API_URL,
      'http://localhost:4900',
      'http://localhost:4000',
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
  ),
);

let activeBaseUrlIndex = 0;

const getActiveBaseUrl = () => API_BASE_URLS[activeBaseUrlIndex] ?? 'http://localhost:4900';

const getFallbackBaseUrl = (current?: string) => {
  if (API_BASE_URLS.length <= 1) {
    return null;
  }

  const currentIndex = typeof current === 'string' ? API_BASE_URLS.indexOf(current) : -1;
  const sourceIndex = currentIndex >= 0 ? currentIndex : activeBaseUrlIndex;
  const nextIndex = (sourceIndex + 1) % API_BASE_URLS.length;

  if (nextIndex === sourceIndex) {
    return null;
  }

  return API_BASE_URLS[nextIndex];
};

type TokenGetter = (() => Promise<string | null>) | null;
type RetryableRequestConfig = {
  baseURL?: string;
  __retryWithFallbackBaseUrl?: boolean;
};

let authTokenGetter: TokenGetter = null;

export const api = axios.create({
  baseURL: getActiveBaseUrl(),
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

api.interceptors.response.use(
  response => response,
  async error => {
    const config = (error?.config ?? {}) as RetryableRequestConfig;
    const hasHttpResponse = Boolean(error?.response);

    if (hasHttpResponse || config.__retryWithFallbackBaseUrl) {
      return Promise.reject(error);
    }

    const fallbackBaseUrl = getFallbackBaseUrl(config.baseURL);
    if (!fallbackBaseUrl) {
      return Promise.reject(error);
    }

    activeBaseUrlIndex = API_BASE_URLS.indexOf(fallbackBaseUrl);
    config.__retryWithFallbackBaseUrl = true;
    config.baseURL = fallbackBaseUrl;

    return api.request(config);
  },
);
