import type { Metadata } from "next";
import { AppShell } from "@/components/layout";
import "./globals.css";

export const metadata: Metadata = {
  title: "KASI Agri Agencies | Enterprise Management System",
  description: "Enterprise Agri-business Management Platform - Prop. R. Balamurugan",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-[#F7F9F6] text-slate-900">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
