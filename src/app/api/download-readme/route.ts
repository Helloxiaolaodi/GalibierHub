import { NextResponse } from 'next/server';

const CACHE_MAX_AGE = 600; // 10 minutes
 
 export async function GET() {
   const storageBaseUrl =
     process.env.NEXT_PUBLIC_STORAGE_BASE_URL ||
     process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
     '';
 
   // Only works for HuggingFace datasets
   const hfMatch = storageBaseUrl.match(/huggingface\.co\/datasets\/([^/]+\/[^/]+)/);
   if (!hfMatch) {
     return NextResponse.json(
       { content: '', source: 'none' },
       { headers: { 'Cache-Control': `public, max-age=${CACHE_MAX_AGE}` } },
     );
   }
 
   const repoId = hfMatch[1];
   const readmeUrl = `https://huggingface.co/datasets/${repoId}/raw/main/README.md`;
 
   try {
     const res = await fetch(readmeUrl, { signal: AbortSignal.timeout(8000) });
     if (!res.ok) {
       return NextResponse.json(
         { content: '', source: 'none' },
        { headers: { 'Cache-Control': `public, max-age=${CACHE_MAX_AGE}` } },
       );
     }
     const content = await res.text();
     return NextResponse.json(
       { content, source: `huggingface-${repoId}` },
       { headers: { 'Cache-Control': `public, max-age=${CACHE_MAX_AGE}` } },
     );
   } catch {
     return NextResponse.json(
       { content: '', source: 'none' },
       { headers: { 'Cache-Control': `public, max-age=${CACHE_MAX_AGE}` } },
     );
   }
 }
