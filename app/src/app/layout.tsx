import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdBridge — Smart Ad Placement for YouTube",
  description: "Convert disruptive ads into native sponsorships, intelligently placed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
