import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SeqEdge — A Modern Edge-Native Portal for Genomic Databases",
  description: "Interactive database for browsing predicted promoters, whole genome annotations, and genomic data. Powered by Next.js, Supabase, Cloudflare R2, and JBrowse 2.",
  keywords: ["promoter", "genome", "bioinformatics", "transcription factor", "TFBS", "gene regulation", "seqedge"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-screen bg-gray-50 font-sans">
        {children}
      </body>
    </html>
  );
}
