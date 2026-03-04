import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import ToastViewport from './ToastViewport';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastPayload {
  id?: string;
  variant: ToastVariant;
  title?: string;
  message: string;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
}

export interface ToastItem extends Omit<ToastPayload, 'id'> {
  id: string;
  durationMs: number;
}

interface ToastContextValue {
  showToast: (payload: ToastPayload) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
  toasts: ToastItem[];
  pauseToast: (id: string) => void;
  resumeToast: (id: string) => void;
}

const MAX_VISIBLE_TOASTS = 4;
const DEFAULT_DURATION_BY_VARIANT: Record<ToastVariant, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 6000,
};

const ToastContext = createContext<ToastContextValue | null>(null);

const createToastId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const timeoutRef = useRef<Record<string, number>>({});
  const startedAtRef = useRef<Record<string, number>>({});
  const remainingRef = useRef<Record<string, number>>({});
  const pausedRef = useRef<Record<string, boolean>>({});

  const clearToastTimer = useCallback((toastId: string) => {
    const timeout = timeoutRef.current[toastId];
    if (timeout) {
      window.clearTimeout(timeout);
      delete timeoutRef.current[toastId];
    }
  }, []);

  const cleanupToastRefs = useCallback((toastId: string) => {
    clearToastTimer(toastId);
    delete startedAtRef.current[toastId];
    delete remainingRef.current[toastId];
    delete pausedRef.current[toastId];
  }, [clearToastTimer]);

  const dismissToast = useCallback((toastId: string) => {
    setQueue(previous => previous.filter(toast => toast.id !== toastId));
    cleanupToastRefs(toastId);
  }, [cleanupToastRefs]);

  const startToastTimer = useCallback((toast: ToastItem, durationMs?: number) => {
    const timeoutDuration = Math.max(0, durationMs ?? remainingRef.current[toast.id] ?? toast.durationMs);
    if (timeoutDuration === 0) {
      dismissToast(toast.id);
      return;
    }

    clearToastTimer(toast.id);
    startedAtRef.current[toast.id] = Date.now();
    remainingRef.current[toast.id] = timeoutDuration;
    timeoutRef.current[toast.id] = window.setTimeout(() => dismissToast(toast.id), timeoutDuration);
  }, [clearToastTimer, dismissToast]);

  const showToast = useCallback((payload: ToastPayload) => {
    const id = payload.id || createToastId();
    const durationMs = payload.durationMs ?? DEFAULT_DURATION_BY_VARIANT[payload.variant];

    const nextToast: ToastItem = {
      ...payload,
      id,
      durationMs,
    };

    setQueue(previous => [...previous, nextToast]);
    return id;
  }, []);

  const clearToasts = useCallback(() => {
    setQueue([]);
    Object.keys(timeoutRef.current).forEach(clearToastTimer);
    startedAtRef.current = {};
    remainingRef.current = {};
    pausedRef.current = {};
  }, [clearToastTimer]);

  const pauseToast = useCallback((toastId: string) => {
    if (pausedRef.current[toastId]) return;
    const startedAt = startedAtRef.current[toastId];
    const remaining = remainingRef.current[toastId];
    if (!startedAt || remaining === undefined) return;

    const elapsed = Date.now() - startedAt;
    remainingRef.current[toastId] = Math.max(0, remaining - elapsed);
    pausedRef.current[toastId] = true;
    clearToastTimer(toastId);
  }, [clearToastTimer]);

  const resumeToast = useCallback((toastId: string) => {
    if (!pausedRef.current[toastId]) return;
    pausedRef.current[toastId] = false;
    const toast = queue.find(item => item.id === toastId);
    if (!toast) {
      cleanupToastRefs(toastId);
      return;
    }
    startToastTimer(toast, remainingRef.current[toastId]);
  }, [cleanupToastRefs, queue, startToastTimer]);

  const visibleToasts = useMemo(() => queue.slice(0, MAX_VISIBLE_TOASTS), [queue]);

  useEffect(() => {
    const visibleToastIds = new Set(visibleToasts.map(toast => toast.id));
    visibleToasts.forEach(toast => {
      if (!timeoutRef.current[toast.id] && !pausedRef.current[toast.id]) {
        startToastTimer(toast);
      }
    });

    Object.keys(timeoutRef.current).forEach(toastId => {
      if (!visibleToastIds.has(toastId)) {
        clearToastTimer(toastId);
      }
    });
  }, [clearToastTimer, startToastTimer, visibleToasts]);

  useEffect(() => () => {
    Object.keys(timeoutRef.current).forEach(clearToastTimer);
  }, [clearToastTimer]);

  const value = useMemo<ToastContextValue>(() => ({
    showToast,
    dismissToast,
    clearToasts,
    toasts: visibleToasts,
    pauseToast,
    resumeToast,
  }), [clearToasts, dismissToast, pauseToast, resumeToast, showToast, visibleToasts]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
}

export function useToastContext() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within ToastProvider');
  }
  return context;
}
