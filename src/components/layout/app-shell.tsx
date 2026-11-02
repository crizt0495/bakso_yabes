"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { CookingPot, LayoutGrid, LogOut } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { BOTTOM_ITEMS, NAV_ITEMS, OTHER_ITEMS } from "./nav-items";
import { StatusBadge } from "@/components/ui/status-badge";
import { Dialog } from "@/components/ui/dialog";

/**
 * Shell dashboard:
 * - Laptop ≥ lg : sidebar tetap di kiri + header atas.
 * - HP          : header ringkas + bottom navigation (4 utama + Lainnya).
 */
export function AppShell({ userName, businessName, children }: { userName: string; businessName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [othersOpen, setOthersOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const othersActive = OTHER_ITEMS.some((i) => isActive(i.href));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const header = (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-brand-800 px-4 text-white lg:px-6">
      <div className="flex items-center gap-2">
        <CookingPot className="size-6" />
        <span className="text-lg font-bold tracking-tight">Bakso Yabes</span>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge />
        <button
          type="button"
          onClick={logout}
          className="rounded-full p-2 hover:bg-white/10"
          aria-label="Keluar"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  );

  return (
    <div className="min-h-dvh bg-cream">
      <div className="hidden lg:block">
        {/* ---------- Laptop: sidebar ---------- */}
        <div className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-brand-900 text-white">
          <div className="flex items-center gap-2 px-5 py-5">
            <CookingPot className="size-7" />
            <div>
              <p className="text-lg font-bold leading-tight">Bakso Yabes</p>
              <p className="truncate text-xs text-brand-300">{businessName}</p>
            </div>
          </div>
          <nav className="scroll-thin flex-1 space-y-1 overflow-y-auto px-3 pb-4">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-brand-700 text-white"
                    : "text-brand-100 hover:bg-brand-800",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-brand-800 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="truncate text-brand-100">{userName}</span>
              <button onClick={logout} className="rounded-lg p-2 hover:bg-brand-800" aria-label="Keluar">
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="pl-60">
          {header}
          <main className="mx-auto max-w-6xl p-6">{children}</main>
        </div>
      </div>

      {/* ---------- HP ---------- */}
      <div className="lg:hidden">
        {header}
        <main className="mx-auto p-4 pb-24">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="grid grid-cols-5">
            {BOTTOM_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
                  isActive(item.href) ? "text-brand-700" : "text-gray-500",
                )}
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => setOthersOpen(true)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-gray-500",
                othersActive && "text-brand-700",
              )}
            >
              <LayoutGrid className="size-5" />
              Lainnya
            </button>
          </div>
        </nav>

        <Dialog open={othersOpen} onClose={() => setOthersOpen(false)} title="Menu Lainnya" size="sm">
          <div className="grid grid-cols-3 gap-2">
            {OTHER_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOthersOpen(false)}
                className="flex flex-col items-center gap-2 rounded-xl border border-brand-100 bg-cream p-4 text-center text-xs font-medium text-brand-900 hover:bg-brand-50"
              >
                <item.icon className="size-6 text-brand-600" />
                {item.label}
              </Link>
            ))}
          </div>
        </Dialog>
      </div>
    </div>
  );
}
