// Button OnLoading State Interface

interface ButtonLoadingContentProps {
  label?: string;
  sizeClassName?: string;
}

export default function ButtonLoadingContent({
  label = 'Loading',
  sizeClassName = 'h-3.5 w-3.5',
}: ButtonLoadingContentProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`${sizeClassName} animate-spin rounded-full border-2 border-current border-t-transparent`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}
