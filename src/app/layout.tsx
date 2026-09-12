import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LegalMetrix — Scan · Review · Report | Packaged Commodity Compliance",
  description:
    "AI-assisted, human-decided compliance checks for packaged commodities under the Legal Metrology (Packaged Commodities) Rules, 2011. Built for enforcement officers.",
  keywords: ["Legal Metrology", "Compliance", "Packaged Commodities", "Label inspection", "GovTech"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
