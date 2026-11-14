import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KASI Agri Agencies Management System",
  description: "Enterprise Agri-business Management Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

