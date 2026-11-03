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

  // Senkronisasi dari luar (edit/reset): hanya update jika angka berubah
  React.useEffect(() => {
    const extDigits = digitNominal(String(value));
    const extNum = extDigits ? Number(extDigits) : 0;
    const dispDigits = digitNominal(display);
    const dispNum = dispDigits ? Number(dispDigits) : 0;
    if (extNum !== dispNum) {
      setDisplay(extDigits ? ribuan(extDigits) : "");
    }
  }, [value, display]);

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