import { twMerge } from 'tailwind-merge';

// Define styles for the upload dropzone and its call-to-action text
export const UPLOAD_DROPZONE_CTA_CLASS = 'font-semibold text-cyan-700';

const UPLOAD_DROPZONE_IDLE_CLASS = 'border-neutral-300 bg-neutral-50 hover:border-cyan-300 hover:bg-cyan-50/40';
const UPLOAD_DROPZONE_ACTIVE_CLASS = 'border-cyan-400 bg-cyan-50/60 text-cyan-700';
const UPLOAD_DROPZONE_DISABLED_CLASS = 'cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-400';

export const getUploadDropzoneClass = ({
  active = false,
  disabled = false,
  className,
}: {
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) => twMerge(
  active ? UPLOAD_DROPZONE_ACTIVE_CLASS : disabled ? UPLOAD_DROPZONE_DISABLED_CLASS : UPLOAD_DROPZONE_IDLE_CLASS,
  className,
);
