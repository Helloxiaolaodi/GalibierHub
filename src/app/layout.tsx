import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SeqEdge",
  description: "Interactive database for browsing predicted promoters, whole genome annotations, and genomic data. Powered by Next.js, Supabase, Cloudflare R2, and JBrowse 2.",
  keywords: ["promoter", "genome", "bioinformatics", "transcription factor", "TFBS", "gene regulation", "seqedge"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-screen bg-gray-50 font-sans">
        {children}
      </body>
    </html>
  );
}
