import { describe, expect, it } from "vitest";
import { hariIni, localDay, num, rupiah, jakartaDayStart } from "@/lib/utils/format";

describe("format uang (Rupiah Indonesia)", () => {
  it("rupiah memakai format id-ID", () => {
    expect(rupiah(15000)).toContain("15.000");
    expect(rupiah("15000")).toContain("15.000");
  });
  it("num konversi numeric-string Postgres", () => {
    expect(num("15000.50")).toBe(15000.5);
    expect(num(null)).toBe(0);
    expect(num("abc")).toBe(0);
  });
});

describe("zona waktu Asia/Jakarta", () => {
  it("hariIni & localDay konsisten kalender Jakarta", () => {
    // 2026-11-01T22:00Z = 2026-11-02 05:00 WIB
    expect(localDay("2026-11-01T22:00:00.000Z")).toBe("2026-11-02");
  });
  it("range harian memakai offset +07:00", () => {
    expect(jakartaDayStart("2026-11-02")).toBe("2026-11-02T00:00:00+07:00");
    expect(hariIni()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
