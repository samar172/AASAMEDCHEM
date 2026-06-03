import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AasaMedChem — Inventory & Orders",
  description:
    "Inventory and order management with unit-aware INR pricing (Next.js + Neon Postgres).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
