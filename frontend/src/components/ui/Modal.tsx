import { useId, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export default function Modal({ open, onClose, title, description, children, className, size = 'md' }: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();

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
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descriptionId : undefined}
            onClick={e => e.stopPropagation()}
          >
            {title && (
              <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
                <div>
                  <h2 id={titleId} className="text-base font-semibold text-neutral-900">{title}</h2>
                  {description && <p id={descriptionId} className="mt-0.5 text-sm text-neutral-500">{description}</p>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
