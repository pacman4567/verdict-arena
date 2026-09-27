import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verdict — Competitive programming",
  description: "Solve original programming challenges and create your own custom judges.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
