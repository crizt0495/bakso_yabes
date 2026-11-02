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
 * Nilai yang dikirim ke onChange selalu berupa angka bulat.
 */
export function RupiahInput({ value, onChange, className, ...props }: RupiahInputProps) {
  const [display, setDisplay] = React.useState(() => ribuan(value));

  // Ikuti perubahan nilai dari luar (edit/reset form) tanpa mengganggu ketikan.
  React.useEffect(() => {
    setDisplay((prev) => {
      const prevNum = digitNominal(prev) ? Number(digitNominal(prev)) : 0;
      const nextDigits = digitNominal(value);
      const nextNum = nextDigits ? Number(nextDigits) : 0;
      return prevNum === nextNum ? prev : ribuan(value);
    });
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
        const digits = digitNominal(e.target.value);
        setDisplay(digits ? ribuan(digits) : "");
        onChange?.(digits ? Number(digits) : 0);
      }}
    />
  );
}
