import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-10 w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[72px] w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
      className,
    )}
    {...props}
  />
));
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("mb-1 block text-sm font-medium text-brand-900", className)} {...props} />
  );
}

export function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string[];
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && error.length > 0 && (
        <p className="mt-1 text-xs font-medium text-red-600">{error[0]}</p>
      )}
    </div>
  );
}
