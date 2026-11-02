"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./button";

/**
 * Dialog sederhana (overlay fokus-permission ringan).
 * Klik latar / Esc / tombol X untutup.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-[min(96vw,900px)] h-[90dvh]",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 w-full overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl",
          "max-h-[92dvh] flex flex-col",
          sizes[size],
        )}
      >
        <div className="flex items-center justify-between border-b border-brand-100 px-5 py-3">
          <h2 className="text-base font-semibold text-brand-900">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Tutup">
            <X />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
