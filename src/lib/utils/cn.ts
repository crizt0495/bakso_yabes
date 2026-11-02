import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return (
    "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (
        Number(c) ^
        ((crypto.getRandomValues(new Uint8Array(1))[0] ?? 0) & (15 >> (Number(c) / 4)))
      ).toString(16),
    )
  );
}
