import type { Transition, Variants } from 'framer-motion';

export const MODAL_BACKDROP_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const MODAL_PANEL_VARIANTS: Variants = {
  initial: { opacity: 0, y: 12, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 12, scale: 0.985 },
};

export const MODAL_TRANSITION: Transition = {
  duration: 0.22,
  ease: 'easeOut',
};
