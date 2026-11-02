"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("App Error Boundary caught:", error);
  }, [error]);

  return (
    <div className="flex h-screen flex-col items-center justify-center p-6 text-center">
      <h2 className="text-xl font-bold text-brand-900">Oops, ada error tak terduga!</h2>
      <p className="mt-2 text-gray-500">Coba muat ulang aplikasi ini.</p>
      <Button className="mt-4" onClick={() => reset()}>Coba Lagi</Button>
    </div>
  );
}
