import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useToastContext, ToastItem } from './ToastProvider';

const getToastStyle = (variant: ToastItem['variant']) => {
  if (variant === 'success') {
    return {
      container: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      icon: CheckCircle2,
      iconClassName: 'text-emerald-600',
    };
  }
  if (variant === 'error') {
    return {
      container: 'border-rose-200 bg-rose-50 text-rose-900',
      icon: AlertCircle,
      iconClassName: 'text-rose-600',
    };
  }
  if (variant === 'warning') {
    return {
      container: 'border-amber-200 bg-amber-50 text-amber-900',
      icon: AlertTriangle,
      iconClassName: 'text-amber-600',
    };
  }
  return {
    container: 'border-sky-200 bg-sky-50 text-sky-900',
    icon: Info,
    iconClassName: 'text-sky-600',
  };
};

export default function ToastViewport() {
  const { toasts, dismissToast, pauseToast, resumeToast } = useToastContext();

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map(toast => {
          const style = getToastStyle(toast.variant);
          const Icon = style.icon;
          const ariaLive = toast.variant === 'error' ? 'assertive' : 'polite';

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={`pointer-events-auto rounded-xl border shadow-lg ${style.container}`}
              role={toast.variant === 'error' ? 'alert' : 'status'}
              aria-live={ariaLive}
              onMouseEnter={() => pauseToast(toast.id)}
              onMouseLeave={() => resumeToast(toast.id)}
              onFocusCapture={() => pauseToast(toast.id)}
              onBlurCapture={() => resumeToast(toast.id)}
            >
              <div className="relative flex items-start gap-3 px-3 py-3 pr-10">
                <Icon size={18} className={`mt-0.5 shrink-0 ${style.iconClassName}`} />
                <div className="min-w-0 flex-1">
                  {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
                  <p className="text-sm leading-relaxed">{toast.message}</p>
                  {toast.actionLabel && toast.onAction && (
                    <button
                      type="button"
                      onClick={toast.onAction}
                      className="mt-2 inline-flex rounded-lg border border-current/20 bg-white/80 px-2.5 py-1 text-xs font-semibold hover:bg-white"
                    >
                      {toast.actionLabel}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-md border border-current/15 bg-white/70 hover:bg-white"
                  aria-label="Dismiss notification"
                >
                  <X size={11} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
