import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Highland Kilt & Clothing Hire Application",
  description: "Automated QR-code based management system for kilt and formal highland clothing rentals",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-100 text-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
