import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

interface ModalFooterProps {
  leftActions?: ReactNode;
  rightActions?: ReactNode;
  className?: string;
}

export function ModalFooter({ leftActions, rightActions, className }: ModalFooterProps) {
  const alignmentClass = leftActions && rightActions
    ? 'sm:justify-between'
    : rightActions
      ? 'sm:justify-end'
      : 'sm:justify-start';

  return (
    <div className={twMerge('flex flex-col gap-3 sm:flex-row sm:items-center', alignmentClass, className)}>
      {leftActions ? <div className="flex flex-wrap items-center gap-2">{leftActions}</div> : null}
      {rightActions ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{rightActions}</div> : null}
    </div>
  );
}

export default function Modal({ open, onClose, title, description, children, footer, className, size = 'md' }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-900/50 px-4 py-4 backdrop-blur-[2px] sm:px-6 sm:py-8"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={twMerge(
              'my-auto flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-overlay sm:max-h-[calc(100vh-4rem)]',
              sizeClasses[size],
              className,
            )}
            onClick={e => e.stopPropagation()}
          >
            {title && (
              <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
                  {description && <p className="mt-0.5 text-sm text-neutral-500">{description}</p>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
            {footer ? <div className="border-t border-neutral-200 px-5 py-4">{footer}</div> : null}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
