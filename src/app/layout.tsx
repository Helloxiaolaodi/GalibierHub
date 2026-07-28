import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SeqEdge",
  description: "Interactive database for browsing predicted promoters, whole genome annotations, and genomic data. Powered by Next.js, Supabase, Cloudflare R2, and JBrowse 2.",
  keywords: ["promoter", "genome", "bioinformatics", "transcription factor", "TFBS", "gene regulation", "seqedge"],
};

function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function(){try{var t=localStorage.getItem('seqedge-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}document.documentElement.classList.add('no-transitions');window.setTimeout(function(){document.documentElement.classList.remove('no-transitions')},300)}catch(e){}})();
        `.trim(),
      }}
    />
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="antialiased">
      <head>
        <ThemeScript />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-screen bg-gray-50 font-sans">
        {children}
      </body>
    </html>
  );
}
