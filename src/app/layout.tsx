import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "STRATAPROOF MVP 0.1 — Geological Evidence Assurance",
  description:
    "Petroleum Exploration Geological Evidence-Assurance & Falsification Platform",
  openGraph: {
    title: "STRATAPROOF MVP 0.1 — Geological Evidence Assurance",
    description:
      "Petroleum Exploration Geological Evidence-Assurance & Falsification Platform",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
