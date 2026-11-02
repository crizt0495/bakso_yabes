"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Halaman setup pemilik pertama (sekali saja, butuh SETUP_SECRET).
 * Setelah selesai, halaman ini tak lagi diperlukan.
 */
export default function SetupPage() {
  const [form, setForm] = useState({
    setup_secret: "",
    business_name: "",
    full_name: "",
    username: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Gagal setup");
        return;
      }
      setResult(`${data.message}\nUsername: ${form.username}\nQR Menu code: ${data.qr_menu_code}`);
      toast.success("Pemilik berhasil dibuat!");
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <h1 className="text-xl font-bold text-brand-900">Setup Pemilik Pertama</h1>
          <p className="mt-1 text-sm text-gray-500">
            Jalankan sekali setelah database Supabase diinisialisasi. Butuh <code>SETUP_SECRET</code>{" "}
            dari .env.server.
          </p>
          <form onSubmit={onSubmit} className="mt-5">
            <Field label="Setup Secret">
              <Input value={form.setup_secret} onChange={set("setup_secret")} type="password" />
            </Field>
            <Field label="Nama Warung">
              <Input value={form.business_name} onChange={set("business_name")} placeholder="BaksoKu" />
            </Field>
            <Field label="Nama Lengkap">
              <Input value={form.full_name} onChange={set("full_name")} placeholder="Pak Budi" />
            </Field>
            <Field label="Username" hint="3–30 karakter: huruf, angka, titik, garis bawah">
              <Input value={form.username} onChange={set("username")} autoCapitalize="none" />
            </Field>
            <Field label="Password" hint="Minimal 8 karakter">
              <Input value={form.password} onChange={set("password")} type="password" />
            </Field>
            {error && (
              <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            {result && (
              <pre className="mb-3 whitespace-pre-wrap rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800">
                {result}
              </pre>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Memproses…" : "Buat Akun Pemilik"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
