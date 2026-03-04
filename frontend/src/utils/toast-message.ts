import { isAxiosError } from 'axios';

export const toErrorMessage = (error: unknown, fallback: string): string => {
  if (!isAxiosError(error)) {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }
    return fallback;
  }

  if (typeof error.response?.data === 'string' && error.response.data.trim().length > 0) {
    return error.response.data;
  }

  const responseData = error.response?.data as
    | { error?: string; message?: string }
    | undefined;

  if (typeof responseData?.error === 'string' && responseData.error.trim().length > 0) {
    return responseData.error;
  }

  if (typeof responseData?.message === 'string' && responseData.message.trim().length > 0) {
    return responseData.message;
  }

  if (typeof error.message === 'string' && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
};

export const toSuccessMessage = (entity: string, action: string): string => `${entity} ${action} successfully.`;
