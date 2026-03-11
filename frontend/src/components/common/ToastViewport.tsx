import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useToastContext, ToastItem } from './ToastProvider';

const getToastStyle = (variant: ToastItem['variant']) => {
  if (variant === 'success') {
    return {
      container: 'border-zinc-800 bg-zinc-900 text-zinc-50 shadow-2xl shadow-black/20',
      icon: CheckCircle2,
      iconClassName: 'text-emerald-400',
    };
  }
  if (variant === 'error') {
    return {
      container: 'border-zinc-800 bg-zinc-900 text-zinc-50 shadow-2xl shadow-black/20',
      icon: AlertCircle,
      iconClassName: 'text-rose-400',
    };
  }
  if (variant === 'warning') {
    return {
      container: 'border-zinc-800 bg-zinc-900 text-zinc-50 shadow-2xl shadow-black/20',
      icon: AlertTriangle,
      iconClassName: 'text-amber-400',
    };
  }
  return {
    container: 'border-zinc-800 bg-zinc-900 text-zinc-50 shadow-2xl shadow-black/20',
    icon: Info,
    iconClassName: 'text-sky-400',
  };
};

export default function ToastViewport() {
  const { toasts, dismissToast, pauseToast, resumeToast } = useToastContext();

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-full max-w-sm flex-col justify-end gap-3">
      <AnimatePresence initial={false}>
        {toasts.map(toast => {
          const style = getToastStyle(toast.variant);
          const Icon = style.icon;
          const ariaLive = toast.variant === 'error' ? 'assertive' : 'polite';

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`pointer-events-auto w-full rounded-xl border shadow-lg ${style.container}`}
              role={toast.variant === 'error' ? 'alert' : 'status'}
              aria-live={ariaLive}
              onMouseEnter={() => pauseToast(toast.id)}
              onMouseLeave={() => resumeToast(toast.id)}
              onFocusCapture={() => pauseToast(toast.id)}
              onBlurCapture={() => resumeToast(toast.id)}
            >
              <div className="flex items-start gap-3.5 px-4 py-3.5 relative overflow-hidden">
                <Icon size={20} className={`mt-0.5 shrink-0 ${style.iconClassName}`} />
                <div className="min-w-0 flex-1 pr-6">
                  {toast.title && <p className="text-sm font-semibold tracking-tight text-white">{toast.title}</p>}
                  <p className="text-sm leading-relaxed text-zinc-300">{toast.message}</p>
                  {toast.actionLabel && toast.onAction && (
                    <button
                      type="button"
                      onClick={toast.onAction}
                      className="mt-2.5 inline-flex items-center justify-center rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 shadow-sm hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors"
                    >
                      {toast.actionLabel}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-600"
                  aria-label="Dismiss notification"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
