# Genomes & Promoters

> **A modern, open-source template for building bioinformatics databases**  
> Stack: Next.js + Supabase + Cloudflare R2 + JBrowse 2 + TanStack Table + ECharts

## What is this?

Genomes & Promoters is a **template repository** for creating interactive web databases that display predicted promoters, whole genome annotations, and related genomic data. It uses a fully serverless, zero-maintenance architecture that can run on free-tier cloud services.

If you have promoter predictions, gene annotations, or any coordinate-based genomic data, you can fork this repo, configure your data sources, and deploy your own database website in under an hour.

## Architecture

`
┌─────────────────────────────────────────────────────┐
│                    Vercel (Free)                     │
│           Next.js — Frontend + API Routes            │
│   ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│   │  ECharts  │ │ TanStack │ │ Genome Browser    │   │
│   │  Stats    │ │  Table   │ │ (JBrowse / custom)│   │
│   └──────────┘ └──────────┘ └──────────────────┘   │
└────────────┬──────────────────────────┬─────────────┘
             │                          │
             ▼                          ▼
┌────────────────────┐   ┌──────────────────────────┐
│  Supabase (Free)   │   │  Cloudflare R2 (Free*)  │
│  PostgreSQL DB     │   │  Object Storage          │
│  - genome_samples  │   │  - FASTA files            │
│  - promoters       │   │  - BED/BIGBED tracks      │
│  - variant_index   │   │  - BigWig signal tracks   │
└────────────────────┘   │  - VCF files + indexes    │
                         └──────────────────────────┘
`

**Data flow:**  
1. Visitor opens the site (served by Vercel's global CDN)  
2. Frontend queries Supabase for metadata (coordinates, scores, gene names)  
3. When a user clicks a promoter, the genome browser fetches only the needed byte range from R2  
4. Large files are never stored in or proxied through the database

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ 
- [Git](https://git-scm.com/)
- A [Supabase](https://supabase.com/) account (free tier)
- A [Vercel](https://vercel.com/) account (free tier)
- A [Cloudflare](https://cloudflare.com/) account for R2 (optional for development)

### Step 1: Fork and Clone

``bash
# Fork this repo on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/genomes-promoters.git
cd genomes-promoters
npm install
``

### Step 2: Configure Environment

``bash
cp .env.example .env.local
``

Edit .env.local:

`env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_R2_PUBLIC_URL=https://your-r2-bucket.r2.dev
`

### Step 3: Set Up Database

1. Go to your Supabase project dashboard
2. Open the **SQL Editor**
3. Copy and paste the contents of schema.sql
4. Click **Run** — all tables, indexes, and sample data will be created

### Step 4: Run Locally

``bash
npm run dev
``

Open [http://localhost:3000](http://localhost:3000) to see the site with demo data.

### Step 5: Deploy to Vercel

1. Push your code to GitHub
2. Import the repo on [vercel.com/new](https://vercel.com/new)
3. Add your environment variables in the Vercel dashboard
4. Deploy — your site goes live automatically

## Customization

### The One File You Must Edit

src/site-config.ts is the central configuration file. Change these values to personalize your database:

`	ypescript
export const SiteConfig = {
  title: 'MyGenomeDB',           // your database name
  subtitle: 'A Promoter Database', // your tagline
  colors: {
    primary: '#1E3A8A',           // change your main brand color
  },
  jbrowse: {
    defaultAssembly: 'hg38',     // change to match your species
    storageBaseUrl: process.env.NEXT_PUBLIC_R2_PUBLIC_URL,
  },
  chromosomes: ['chr1', ...],    // change to match your assembly
  // ...
};
`

### Connecting Real Data

1. **Upload genome files to Cloudflare R2** (FASTA, BED, BigWig, etc.) with their index files (.fai, .bai, .tbi)
2. **Import metadata into Supabase** — your promoter predictions, sample info, etc.
3. **Update src/site-config.ts** with your assembly name and track definitions
4. **Replace demo data** in src/app/page.tsx with real Supabase queries (the API routes already show how)

### Data Format Requirements

**Supabase predicted_promoters table columns:**

| Column | Type | Required | Example |
|---|---|---|---|
| sample_id | text | yes | SAMPLE-001 |
| chrom | text | yes | chr17 |
| start | integer | yes | 43044295 |
| end | integer | yes | 43045800 |
| score | numeric(0-1) | yes | 0.95 |
| strand | text (+/-) | yes | + |
| gene_symbol | text | no | BRCA1 |
| sequence | text | no | ATGCGTAC... |

**Cloudflare R2 file structure:**

`
your-bucket/
  genomes/
    hg38.fa              # Reference genome FASTA
    hg38.fa.fai          # FASTA index
    hg38.fa.dict         # Sequence dictionary
  tracks/
    predicted_promoters.bed.gz
    predicted_promoters.bed.gz.tbi
    rnaseq_coverage.bw
    chipseq_peaks.bed.gz
    chipseq_peaks.bed.gz.tbi
`

## Feature Modules

The codebase is designed to be modular. Each feature is a self-contained component:

| Component | File | Purpose |
|---|---|---|
| Stats Dashboard | src/components/stats-chart.tsx | Pie chart (species) + bar chart (score distribution) |
| Search Filters | src/components/search-filters.tsx | Multi-faceted promoter search |
| Data Table | src/components/promoter-table.tsx | Sortable, filterable, paginated table |
| Promoter Detail | src/components/promoter-detail.tsx | Modal with coordinates, score, sequence, BED/FASTA export |
| Genome Browser | src/components/genome-browser.tsx | Custom genome viewer (drop-in JBrowse 2 replacement) |

**To disable a feature**, edit src/site-config.ts:

`	ypescript
features: {
  enableGenomeBrowser: false,  // hides the Genome Browser tab
  enableStatsCharts: true,
  enableVariantSearch: false,
}
`

## Cost Estimate

| Service | Free Tier | Paid Tier (if needed) |
|---|---|---|
| Vercel | 100 GB bandwidth/mo | Pro /mo |
| Supabase | 500 MB DB, 2 GB bandwidth | Pro /mo (8 GB DB, no auto-pause) |
| Cloudflare R2 | 10 GB storage, free egress | .015/GB/mo storage, egress always free |
| Domain | .vercel.app free | Custom domain ~/year |

**Typical scenario for a published paper:** Free tier covers development and review. Once published, ~/month for production with R2 storage for large datasets.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (React 19, App Router)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL + REST API)
- **File Storage**: [Cloudflare R2](https://www.cloudflare.com/products/r2/) (S3-compatible, free egress)
- **Genome Browser**: Custom component (JBrowse 2 drop-in ready)
- **Data Table**: [TanStack Table](https://tanstack.com/table) (virtual scrolling support)
- **Charts**: [Apache ECharts](https://echarts.apache.org/) via echarts-for-react
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) v4
- **Deployment**: [Vercel](https://vercel.com/)

## License

MIT — use freely for academic and commercial projects.

## Acknowledgments

This template builds on the architecture and design principles of databases like [EPD](https://epd.epfl.ch/), [DBTSS](https://dbtss.hgc.jp/), and [RegulonDB](https://regulondb.ccg.unam.mx/), modernized with cloud-native infrastructure.