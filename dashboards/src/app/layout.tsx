import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nutrio - لوحات التحكم",
  description: "نظام إدارة شامل لتطبيق Nutrio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-arabic">
        {children}
      </body>
    </html>
  );
}
