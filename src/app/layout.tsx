import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ABHI Careers & HR", template: "%s · ABHI HR" },
  description: "ABHI Microfinance Bank: careers, recruitment and onboarding portal",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0e7c66" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
