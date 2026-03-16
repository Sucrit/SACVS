import type { ReactNode } from 'react';
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

export default function Drawer({ open, onClose, title, description, children, footer, className, width = 'max-w-lg' }: DrawerProps) {
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
            onClick={e => e.stopPropagation()}
          >
            {title && (
              <div className="flex items-start justify-between border-b border-neutral-200 px-4 py-4 sm:px-7 sm:py-6">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
                  {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-neutral-400 transition hover:text-neutral-900"
                  aria-label="Close drawer"
                >
                  <X size={24} strokeWidth={1.8} />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-7 sm:py-6">{children}</div>
            {footer && (
              <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-4 sm:px-7 shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
