import {
  BarChart3,
  Boxes,
  ChefHat,
  ClipboardList,
  Gauge,
  Package,
  QrCode,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** tampil di bottom-nav HP (5 utama) */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/pos", label: "Kasir", icon: ShoppingCart, primary: true },
  { href: "/transactions", label: "Transaksi", icon: Receipt, primary: true },
  { href: "/products", label: "Produk", icon: Package, primary: true },
  { href: "/orders", label: "Pesanan", icon: ClipboardList, primary: true },
  { href: "/recipes", label: "Resep & HPP", icon: ChefHat },
  { href: "/inventory", label: "Stok Bahan", icon: Boxes },
  { href: "/purchases", label: "Pembelian", icon: Truck },
  { href: "/finance", label: "Keuangan", icon: Wallet, primary: true },
  { href: "/customers", label: "Pelanggan", icon: Users },
  { href: "/qr-menu", label: "QR Menu", icon: QrCode },
  { href: "/reports", label: "Laporan", icon: BarChart3 },
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

export const BOTTOM_ITEMS = NAV_ITEMS.filter((i) => i.primary);
export const OTHER_ITEMS = NAV_ITEMS.filter((i) => !i.primary);
