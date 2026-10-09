import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const inputClass =
  'h-10 md:h-9 w-full rounded-md border border-line bg-app px-3 text-sm text-fg placeholder:text-faint transition focus:border-accent/70 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60';

/**
 * What a Field tells the control inside it, so a screen reader announces the
 * input by its label and reads out its error. Input, Select, Textarea and
 * TagInput pick it up; a group of buttons (the long/short switch) ignores it.
 */
interface FieldLink {
  id: string;
  errorId?: string;
}
const FieldContext = createContext<FieldLink | null>(null);

/** the id, aria-describedby and aria-invalid a control inside a Field should carry */
export function useFieldLink(own?: { id?: string; invalid?: boolean }) {
  const link = useContext(FieldContext);
  return {
    id: own?.id ?? link?.id,
    'aria-describedby': link?.errorId,
    'aria-invalid': own?.invalid || link?.errorId ? true : undefined,
  };
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <FieldContext.Provider value={{ id, errorId }}>
      <div className={cn('min-w-0', className)}>
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          <label htmlFor={id} className="font-medium text-muted">
            {label}
          </label>
          {hint && <span className="truncate text-faint">{hint}</span>}
        </div>
        {children}
        {error && (
          <p id={errorId} className="mt-1 text-xs text-loss">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, id, ...rest }, ref) {
    const link = useFieldLink({ id, invalid });
    return <input ref={ref} className={cn(inputClass, invalid && 'border-loss/60', className)} {...link} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, id, ...rest },
  ref,
) {
  const link = useFieldLink({ id });
  return (
    <div className={cn('relative', className)}>
      <select ref={ref} className={cn(inputClass, 'cursor-pointer appearance-none pr-8')} {...link} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, id, ...rest },
  ref,
) {
  const link = useFieldLink({ id });
  return (
    <textarea
      ref={ref}
      className={cn(inputClass, 'h-auto min-h-[84px] resize-y py-2 leading-relaxed md:h-auto', className)}
      {...link}
      {...rest}
    />
  );
});
