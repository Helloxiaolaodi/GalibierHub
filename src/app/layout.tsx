import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GalibierHub",
  description: "Interactive database for browsing predicted promoters, whole genome annotations, and genomic data. Powered by Next.js, Supabase, Cloudflare R2, and JBrowse 2.",
  keywords: ["promoter", "genome", "bioinformatics", "transcription factor", "TFBS", "gene regulation", "galibierhub"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="antialiased">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-screen bg-gray-50 font-sans">
        {children}
      </body>
    </html>
  );
}
