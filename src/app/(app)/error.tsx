"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Layout Error Boundary caught:", error);
  }, [error]);

  return (
    <div className="flex h-64 flex-col items-center justify-center p-6 text-center">
      <h3 className="text-lg font-bold text-brand-900">Gagal memuat halaman</h3>
      <p className="mt-1 text-sm text-gray-500">Terjadi kesalahan pada modul ini.</p>
      <Button className="mt-4" size="sm" onClick={() => reset()}>Segarkan Halaman</Button>
    </div>
  );
}
