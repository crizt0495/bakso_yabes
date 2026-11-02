"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { digitNominal, ribuan } from "@/lib/utils/format";

export interface RupiahInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "type" | "value" | "onChange" | "inputMode"
  > {
  value: number | string | null | undefined;
  onChange?: (value: number) => void;
}

/**
 * Input nominal rupiah dengan pemisah ribuan otomatis (1.000.000).
 * - Awal input KOSONG (bukan "0"), user ketik mulai dari angka pertama.
 * - Setiap ketikan → format otomatis ribuan (1000 → 1.000).
 * - Hapus semua → input kosong, onChange menerima 0 (bisa direset form).
 * - Mengetik "0" → tetap menampilkan "0".
 */
export function RupiahInput({
  value,
  onChange,
  className,
  ...props
}: RupiahInputProps) {
  // Mulai KOSONG sama sekali, terlepas dari value 0/null/undefined.
  // User akan ketik angka pertama dan ribuan akan muncul.
  const initialDisplay = "";

  const [display, setDisplay] = React.useState(initialDisplay);

  // Senkronisasi dari luar (mis. reset form): reset ke kosong jika value berubah jadi null/undefined
  React.useEffect(() => {
    if (value === null || value === undefined) {
      setDisplay("");
      return;
    }
    // Jika value berubah jadi angka tertentu, tetap jaga tapi jangan reset ke "0"
    // karena kita mulai dari kosong; user yang akan mengisi.
    const curDigits = digitNominal(String(value));
    const curNum = curDigits ? Number(curDigits) : 0;
    // Jika ada nilai numeric dan display masih kosong, kita bisa isi awalnya
    // tapi biarkan user kontrol. Hanya jaga agar tidak terjadi berkipas.
    if (display === "") {
      // Jika value ada dan user belum ketik apa-apa, tampilkan angka asli tanpa ribuan dulu
      // atau biarkan kosong bi user ketik.
      setDisplay(""); // biarkan kosong, user akan ketik
    }
  }, [value]);

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={className}
      value={display}
      onChange={(e) => {
        const raw = e.target.value;
        const digits = digitNominal(raw);
        // Jika user hapus semua atau kosongkan → kirim 0 ke parent
        if (!raw || raw.trim() === "") {
          setDisplay("");
          onChange?.(0);
          return;
        }
        // Jika user ketikan, tampilkan format ribuan
        setDisplay(digits ? ribuan(digits) : "");
        onChange?.(digits ? Number(digits) : 0);
      }}
    />
  );
}