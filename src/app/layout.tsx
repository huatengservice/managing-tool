import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/provider";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";

export const metadata: Metadata = {
  title: "華騰工程行 — 工作管理系統",
  description: "水電工程行案件、報價、排程與請款管理",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen bg-slate-50 text-slate-800 antialiased">
        <LanguageProvider>{children}</LanguageProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
