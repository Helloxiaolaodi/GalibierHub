import type { Metadata } from "next";
import "./globals.css";
import CommandPalette from "@/components/command-palette";
import { LoadingProvider } from "@/contexts/LoadingContext";

export const metadata: Metadata = {
  title: "GalibierHub",
  description: "Interactive database for browsing predicted promoters, whole genome annotations, and genomic data. Powered by Next.js, Supabase, Cloudflare R2, and JBrowse 2.",
  keywords: ["promoter", "genome", "bioinformatics", "transcription factor", "TFBS", "gene regulation", "galibierhub"],
};

import NextTopLoader from 'nextjs-toploader';
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('galibierhub-theme');var dark=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);}catch(e){}})();`,
          }}
        />
        <link rel="icon" href="/galibierhub-logo.svg" type="image/svg+xml" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-screen bg-background font-sans">
        <NextTopLoader color="#0D9488" height={2} showSpinner={false} />
        <LoadingProvider>
        {children}
        </LoadingProvider>
        <CommandPalette />
      </body>
    </html>
  );
}
