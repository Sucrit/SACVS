import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-neutral-900 text-white hover:bg-neutral-800 active:bg-neutral-950 disabled:bg-neutral-200 disabled:text-neutral-400',
  secondary:
    'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 active:bg-neutral-100 disabled:bg-neutral-50 disabled:text-neutral-400',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-neutral-200 disabled:text-neutral-400',
  ghost:
    'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-200 disabled:text-neutral-300',
  danger:
    'bg-error-600 text-white hover:bg-error-700 active:bg-error-800 disabled:bg-neutral-200 disabled:text-neutral-400',
  outline:
    'bg-transparent text-neutral-700 border border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50 active:bg-neutral-100 disabled:text-neutral-400 disabled:border-neutral-200',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-10 px-5 text-sm gap-2',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', icon, iconRight, loading, children, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={twMerge(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed select-none',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {!loading && icon && <span className="shrink-0">{icon}</span>}
      {children && <span>{children}</span>}
      {iconRight && <span className="shrink-0">{iconRight}</span>}
    </button>
  ),
);

Button.displayName = 'Button';
export default Button;
