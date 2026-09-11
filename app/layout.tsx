import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { ToastProvider } from "@/components/toast-provider";
import { AuthProvider } from "@/contexts/auth-context";
import { PWARegister } from "@/components/pwa-register";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sistem Manajemen Inventaris",
  description: "Sistem manajemen inventaris siap pakai untuk merek pakaian",
  viewport: "width=device-width, initial-scale=1, maximum-scale=5",
  manifest: "/manifest.json",
  themeColor: "#0f172a",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Gudang App",
  },
  icons: {
    icon: "/icon-192x192.png",
    apple: "/icon-192x192.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-zinc-950">
        <AuthProvider>
          <ToastProvider>
            <PWARegister />
            <Navigation />
            <main className="flex-1">{children}</main>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
