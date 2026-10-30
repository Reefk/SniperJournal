import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent-strong text-white hover:brightness-110 active:brightness-95',
  secondary: 'border border-line bg-raised text-fg hover:border-line-strong',
  ghost: 'text-muted hover:bg-raised hover:text-fg',
  // a 20% tint on hover took the red text below 4.5:1 in both themes; 15% keeps it above
  danger: 'border border-loss/30 bg-loss/10 text-loss hover:bg-loss/15',
};

// a finger needs more room than a pointer: larger below md, unchanged above
const SIZES: Record<Size, string> = {
  sm: 'h-9 gap-1.5 px-2.5 text-xs md:h-8',
  md: 'h-10 gap-2 px-3.5 text-sm md:h-9',
  icon: 'size-11 md:size-8',
};

// the same heights as a floor, for a label that may take two lines (one line,
// its padding and a border stay inside the floor); max-w-full lets it narrow in
// a flex row, where shrink-0 alone keeps it as wide as its one-line label
const WRAP_SIZES: Record<Size, string> = {
  sm: 'min-h-9 gap-1.5 px-2.5 py-1 text-xs md:min-h-8',
  md: 'min-h-10 gap-2 px-3.5 py-1.5 text-sm md:min-h-9',
  icon: SIZES.icon,
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** a long label wraps instead of widening the page: "Освободить место…" on a phone */
  wrap?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', wrap = false, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-medium transition disabled:pointer-events-none disabled:opacity-50',
        wrap ? 'max-w-full text-start' : 'whitespace-nowrap',
        VARIANTS[variant],
        wrap ? WRAP_SIZES[size] : SIZES[size],
        className,
      )}
      {...rest}
    />
  );
});
