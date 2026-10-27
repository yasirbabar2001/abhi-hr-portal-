import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ABHI EX · Careers & HR", template: "%s · ABHI EX" },
  description: "ABHI Microfinance Bank: careers, recruitment and onboarding portal",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#08182e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
