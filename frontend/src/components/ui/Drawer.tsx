import { useId, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  width?: string;
}

export default function Drawer({ open, onClose, title, description, children, footer, className, width = 'max-w-md' }: DrawerProps) {
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
          className="fixed inset-0 z-50 flex justify-end bg-neutral-900/40 backdrop-blur-[2px]"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className={twMerge(
              'flex h-full w-full flex-col border-l border-neutral-200 bg-white shadow-overlay',
              width,
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
                  aria-label="Close drawer"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
            {footer && (
              <div className="border-t border-neutral-200 bg-neutral-50 px-5 py-4 shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
