import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { ServiceWorkerRegister } from "@/components/pwa-register";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "BaksoKu",
    template: "%s · BaksoKu",
  },
  description: "Aplikasi manajemen warung bakso: kasir, stok, resep HPP, keuangan, QR menu.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon.svg" },
  appleWebApp: {
    capable: true,
    title: "BaksoKu",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#265c39",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={inter.className}>
        {children}
        <Toaster position="top-center" richColors closeButton />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
