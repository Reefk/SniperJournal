import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent-strong text-white hover:brightness-110 active:brightness-95',
  secondary: 'border border-line bg-raised text-fg hover:border-line-strong',
  ghost: 'text-muted hover:bg-raised hover:text-fg',
  danger: 'border border-loss/30 bg-loss/10 text-loss hover:bg-loss/20',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-2.5 text-xs',
  md: 'h-9 gap-2 px-3.5 text-sm',
  icon: 'size-8',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md font-medium transition disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  );
});
