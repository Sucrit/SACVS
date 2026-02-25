import { isAxiosError } from 'axios';
import { Credential, CredentialType, DeliveryMethod } from '../../services/credential.service';
import { StudentSection } from './types';

export const CREDENTIAL_TYPES: CredentialType[] = ['TRANSCRIPT', 'DIPLOMA', 'CERTIFICATE', 'DEGREE', 'LICENSE'];
export const DELIVERY_METHODS: DeliveryMethod[] = ['DIGITAL', 'PHYSICAL', 'BOTH'];

export const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export const shortenHash = (value: string | null | undefined) => {
  if (!value) return '-';
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
};

export const getStatusLabel = (status: Credential['status']) => {
  switch (status) {
    case 'AI_REVIEW':
      return 'AI review in progress';
    case 'VERIFIED':
      return 'Credential verified';
    case 'ISSUED':
      return 'Credential issued';
    case 'REVOKED':
      return 'Credential revoked';
    case 'EXPIRED':
      return 'Credential expired';
    default:
      return 'Credential pending';
  }
};

export const getCredentialFileUrl = (storageKey: string | null): string | null => {
  if (!storageKey) return null;
  if (/^https?:\/\//i.test(storageKey)) return storageKey;

  const baseUrl = (
    import.meta.env.VITE_GATEWAY_URL ||
    import.meta.env.VITE_API_URL ||
    'http://localhost:4900'
  ).replace(/\/+$/, '');
  const normalizedPath = storageKey.startsWith('/') ? storageKey : `/${storageKey}`;
  return `${baseUrl}${normalizedPath}`;
};

export const getApiErrorMessage = (error: unknown): string | null => {
  if (!isAxiosError(error)) {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }
    return null;
  }

  if (typeof error.response?.data === 'string' && error.response.data.trim().length > 0) {
    return error.response.data;
  }

  if (!error.response) {
    return 'Network error: API gateway is unreachable. Make sure backend services are running.';
  }

  const responseData = error.response?.data as { error?: string; message?: string } | undefined;

  if (typeof responseData?.error === 'string' && responseData.error.trim().length > 0) {
    return responseData.error;
  }

  if (typeof responseData?.message === 'string' && responseData.message.trim().length > 0) {
    return responseData.message;
  }

  if (typeof error.message === 'string' && error.message.trim().length > 0) {
    return error.message;
  }

  return null;
};

export const getStudentSection = (pathname: string): StudentSection => {
  if (pathname.startsWith('/student/requests')) return 'requests';
  if (pathname.startsWith('/student/credentials')) return 'credentials';
  if (pathname.startsWith('/student/notifications')) return 'notifications';
  if (pathname.startsWith('/student/profile')) return 'profile';
  return 'overview';
};

export const getStudentCredentialDetailId = (pathname: string): string | null => {
  const match = pathname.match(/^\/student\/credentials\/([^/]+)/);
  if (!match || !match[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};
