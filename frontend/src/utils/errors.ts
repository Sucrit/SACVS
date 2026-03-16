/**
 * Shared error extraction utilities.
 * Consolidates getApiErrorMessage from Student/utils, Institution/utils,
 * and toErrorMessage from utils/toast-message.ts.
 */
import { isAxiosError } from 'axios';

/**
 * Extract a human-friendly error message from an unknown error.
 * Returns `null` when no message can be determined.
 */
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
    return 'Network error: API gateway is unreachable.';
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

/**
 * Same as `getApiErrorMessage` but returns a fallback string instead of `null`.
 * Drop-in replacement for the old `toErrorMessage()` from `utils/toast-message.ts`.
 */
export const toErrorMessage = (error: unknown, fallback: string): string =>
  getApiErrorMessage(error) ?? fallback;
