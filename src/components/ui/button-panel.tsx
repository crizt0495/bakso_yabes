"use client";

import type { LucideIcon } from "lucide-react";
import { Button } from "./button";

/** Deret tombol aksi horizontal/wrap yang praktis dipakai di kartu pengaturan. */
export function ButtonPanel({
  items,
}: {
  items: { icon: LucideIcon; label: string; onClick: () => void }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <Button key={it.label} variant="outline" onClick={it.onClick}>
          <it.icon className="size-4" />
          {it.label}
        </Button>
      ))}
    </div>
  );
}
