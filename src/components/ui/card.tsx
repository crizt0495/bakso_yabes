import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-brand-100 bg-white shadow-card", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-2", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold text-brand-900", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-gray-500", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-2", className)} {...props} />;
}

export function Badge({
  className,
  tone = "gray",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "gray" | "green" | "red" | "yellow" | "blue" }) {
  const tones: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700",
    green: "bg-brand-100 text-brand-800",
    red: "bg-red-100 text-red-700",
    yellow: "bg-amber-100 text-amber-800",
    blue: "bg-sky-100 text-sky-800",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
