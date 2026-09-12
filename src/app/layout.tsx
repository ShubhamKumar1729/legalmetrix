import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PackComply - AI-Powered Packaged Commodity Compliance | SIH 26034",
  description: "Government-grade AI platform for Legal Metrology enforcement under Packaged Commodities Rules, 2011",
  keywords: ["Legal Metrology", "SIH", "Compliance", "Packaged Commodities", "GovTech"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">
        {children}
      </body>
    </html>
  );
}
