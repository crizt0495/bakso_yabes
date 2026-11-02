import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/**
 * Kit komponen gaya shadcn/ui: API serupa (cva + cn), implementasi ringan
 * tanpa dependensi berat — mudah dipelihara (docs/ARCHITECTURE.md).
 */

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900",
        secondary: "bg-brand-100 text-brand-900 hover:bg-brand-200",
        outline: "border border-brand-200 bg-white text-brand-800 hover:bg-brand-50",
        ghost: "text-brand-800 hover:bg-brand-100",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        success: "bg-brand-500 text-white hover:bg-brand-600",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        xl: "h-16 px-8 text-lg rounded-2xl",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
