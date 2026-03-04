import { useToastContext, ToastPayload } from '../components/common/ToastProvider';

export type { ToastPayload };

export function useToast() {
  const { showToast, dismissToast, clearToasts } = useToastContext();
  return {
    showToast,
    dismissToast,
    clearToasts,
  };
}
