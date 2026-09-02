import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { ToastProvider } from "@/components/toast-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sistem Manajemen Inventaris",
  description: "Sistem manajemen inventaris siap pakai untuk merek pakaian",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-zinc-950">
        <ToastProvider>
          <Navigation />
          <main className="flex-1">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
