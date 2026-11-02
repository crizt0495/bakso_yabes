"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CookingPot, Lock, User } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const search = useSearchParams();
  const next = search.get("next") ?? "/dashboard";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (username.trim().length < 3 || password.length < 6) {
      setError("Username minimal 3 karakter dan password minimal 6 karakter.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Gagal login. Coba lagi.");
        return;
      }
      toast.success("Selamat datang kembali!");
      // full reload supaya middleware redirect berdasarkan cookie fresh
      window.location.assign(next.startsWith("/") ? next : "/dashboard");
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi internet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-brand-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center text-white">
          <div className="mx-auto mb-3 flex size-24 items-center justify-center rounded-3xl bg-white/10">
            <CookingPot className="size-12" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">BaksoKu</h1>
          <p className="mt-1 text-sm text-brand-200">Kasir & manajemen warung bakso</p>
        </div>

        <Card className="shadow-xl">
          <CardContent className="p-6">
            <form onSubmit={onSubmit} noValidate>
              <Field label="Username">
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-3 size-4 text-gray-400" />
                  <Input
                    className="pl-9"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    autoCapitalize="none"
                    placeholder="masukkan username"
                    inputMode="text"
                  />
                </div>
              </Field>
              <Field label="Password">
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-3 size-4 text-gray-400" />
                  <Input
                    className="pl-9"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="password"
                  />
                </div>
              </Field>

              {error && (
                <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Memproses…" : "Masuk"}
              </Button>
            </form>
            <p className="mt-4 text-center text-xs text-gray-400">
              Login hanya untuk pemilik warung. Tidak ada pendaftaran publik.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
