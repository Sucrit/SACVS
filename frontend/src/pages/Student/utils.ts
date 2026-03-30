import { Credential, CredentialType, DeliveryMethod } from '../../services/credential.service';
import { StudentSection } from './types';

export { formatDate, formatDateTime, shortenHash } from '../../utils/formatting';
export { getApiErrorMessage } from '../../utils/errors';

export const CREDENTIAL_TYPES: CredentialType[] = ['TRANSCRIPT', 'DIPLOMA', 'CERTIFICATE', 'DEGREE', 'LICENSE'];
export const DELIVERY_METHODS: DeliveryMethod[] = ['DIGITAL', 'PHYSICAL', 'BOTH'];

export const getStatusLabel = (status: Credential['status']) => {
  switch (status) {
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

export const getStudentStatusTextClass = (status: string) => {
  switch (status) {
    case 'APPROVED':
    case 'COMPLETED':
    case 'ISSUED':
      return 'text-emerald-600';
    case 'PENDING':
      return 'text-amber-600';
    case 'REVOKED':
    case 'REJECTED':
    case 'CANCELLED':
    case 'EXPIRED':
      return 'text-rose-600';
    default:
      return 'text-neutral-500';
  }
};

export const formatStudentStatusLabel = (status: string) =>
  status.toLowerCase().replace(/_/g, ' ');

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
