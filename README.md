# SeqEdge

> **A modern, open-source template for building genomic databases**  
> Stack: Next.js + Supabase + Cloudflare R2 + JBrowse 2 + TanStack Table + ECharts  
> Tagline: _Bringing 100k+ Genomes to the Edge._

## What is SeqEdge?

SeqEdge is a **template repository** for creating interactive web databases that display predicted promoters, whole genome annotations, and related genomic data. It uses a fully serverless, edge-native architecture that can run on free-tier cloud services.

If you have promoter predictions, gene annotations, or any coordinate-based genomic data, you can fork this repo, configure your data sources, and deploy your own database website in under an hour.

The name combines **Seq** (Sequencing / Sequence) and **Edge** (Edge Computing / Edge Network) — representing the fusion of genomic data with modern cloud-native infrastructure.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Vercel (Free)                     │
│           Next.js — Frontend + API Routes            │
│   ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│   │  ECharts  │ │ TanStack │ │ Genome Browser    │   │
│   │  Stats    │ │  Table   │ │ (JBrowse / custom)│   │
│   └──────────┘ └──────────┘ └──────────────────┘   │
└────────────┬──────────────────────────┬───────────────┘
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
```

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

```bash
# Fork this repo on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/SeqEdge.git
cd SeqEdge
npm install
```

### Step 2: Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_R2_PUBLIC_URL=https://your-r2-bucket.r2.dev
```

### Step 3: Set Up Database

1. Go to your Supabase project dashboard
2. Open the **SQL Editor**
3. Copy and paste the contents of `schema.sql`
4. Click **Run** — all tables, indexes, and sample data will be created

### Step 4: Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the site with demo data.

### Step 5: Deploy to Vercel

1. Push your code to GitHub
2. Import the repo on [vercel.com/new](https://vercel.com/new)
3. Add your environment variables in the Vercel dashboard
4. Deploy — your site goes live automatically

## Customization

### The One File You Must Edit

`src/site-config.ts` is the central configuration file. Change these values to personalize your database:

```typescript
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
```

### Connecting Real Data

1. **Upload genome files to Cloudflare R2** (FASTA, BED, BigWig, etc.) with their index files (.fai, .bai, .tbi)
2. **Import metadata into Supabase** — your promoter predictions, sample info, etc.
3. **Update `src/site-config.ts`** with your assembly name and track definitions
4. **Replace demo data** in `src/app/page.tsx` with real Supabase queries (the API routes already show how)

### Data Format Requirements

**Supabase `predicted_promoters` table columns:**

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

```
your-bucket/
  genomes/
    hg38.fa              # Reference genome FASTA
    hg38.fa.fai          # FASTA index
    hg38.fa.dict         # Sequence dictionary
  tracks/
    predicted_promoters.bed.gz        # Predicted promoter BED track
    predicted_promoters.bed.gz.tbi    # Tabix index
    rnaseq_coverage.bw                # RNA-seq coverage BigWig
    chipseq_peaks.bed.gz              # ChIP-seq peaks BED
    chipseq_peaks.bed.gz.tbi          # Tabix index
```

## Feature Modules

The codebase is designed to be modular. Each feature is a self-contained component:

| Component | File | Purpose |
|---|---|---|
| Stats Dashboard | `src/components/stats-chart.tsx` | Pie chart (species) + bar chart (score distribution) |
| Search Filters | `src/components/search-filters.tsx` | Multi-faceted promoter search |
| Data Table | `src/components/promoter-table.tsx` | Sortable, filterable, paginated table |
| Promoter Detail | `src/components/promoter-detail.tsx` | Modal with coordinates, score, sequence, BED/FASTA export |
| Genome Browser | `src/components/genome-browser.tsx` | Custom genome viewer (JBrowse 2 drop-in ready) |

**To disable a feature**, edit `src/site-config.ts`:

```typescript
features: {
  enableGenomeBrowser: false,  // hides the Genome Browser tab
  enableStatsCharts: true,
  enableVariantSearch: false,
}
```

## Cost Estimate

| Service | Free Tier | Paid Tier (if needed) |
|---|---|---|
| Vercel | 100 GB bandwidth/mo | Pro $20/mo |
| Supabase | 500 MB DB, 2 GB bandwidth | Pro $25/mo (8 GB DB, no auto-pause) |
| Cloudflare R2 | 10 GB storage, free egress | $0.015/GB/mo storage, egress always free |
| Domain | .vercel.app free | Custom domain ~$10/year |

**Typical scenario for a published paper:** Free tier covers development and review. Once published, ~$25/month for production with R2 storage for large datasets.


---

## Cloud Service Setup

This section walks you through registering and configuring the three cloud services SeqEdge depends on. All three have free tiers sufficient for development.

### 1. Supabase (PostgreSQL Database)

Supabase provides the PostgreSQL database that stores your promoter metadata, sample information, and variant indexes.

**Step 1 — Create an account**

1. Go to [supabase.com](https://supabase.com/) and click **Start your project**
2. Sign up with your GitHub account (fastest) or email

**Step 2 — Create a project**

1. Click **New Project**
2. Fill in:
   - **Name**: seqedge-db (or any name you prefer)
   - **Database Password**: generate a strong password and save it somewhere safe
   - **Region**: choose the region closest to your target users
3. Wait ~2 minutes for the project to initialize

**Step 3 — Get your credentials**

1. Go to **Settings → API** (left sidebar)
2. Copy two values:
   - **Project URL**: looks like https://abcdefgh.supabase.co
   - **anon public** key: a long string starting with eyJ...
3. These go into your .env.local file:
   `env
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   `

**Step 4 — Create database tables**

1. Go to **SQL Editor** (left sidebar)
2. Click **New query**
3. Copy the entire contents of schema.sql from the SeqEdge repo and paste it in
4. Click **Run** — this creates all tables, indexes, RLS policies, and inserts sample data
5. Verify: go to **Table Editor** — you should see genome_samples (6 rows), predicted_promoters (12 rows)

**Step 5 — Import your real data**

For small datasets, use the Table Editor's **Insert** button in the Supabase Dashboard.

For large datasets, use Python:
`python
import pandas as pd
from supabase import create_client, Client

url = "https://abcdefgh.supabase.co"
key = "eyJhbGciOi..."  # your anon key or service_role key for writes
supabase = create_client(url, key)

df = pd.read_csv("your_promoters.csv")
records = df.to_dict("records")

for i in range(0, len(records), 500):
    batch = records[i:i+500]
    supabase.table("predicted_promoters").insert(batch).execute()
    print(f"Inserted {min(i+500, len(records))}/{len(records)}")
`

**Free tier limits:**
- 500 MB database storage (enough for millions of metadata rows)
- 2 GB bandwidth per month
- Auto-pauses after 7 days of inactivity (manual resume or upgrade to Pro for $25/mo)

### 2. Cloudflare R2 (Genome File Storage)

R2 stores your large genome files (FASTA, BED, BigWig, BAM) and serves them via HTTP range requests — the mechanism JBrowse 2 uses to stream only the bytes it needs.

**Step 1 — Create an account**

1. Go to [cloudflare.com](https://cloudflare.com/) and sign up (free)
2. You do NOT need to transfer your domain's DNS to Cloudflare — you can use R2 independently

**Step 2 — Create an R2 bucket**

1. In the Cloudflare Dashboard, go to **R2 Object Storage** (left sidebar)
2. Click **Create bucket**
3. Bucket name: seqedge-genomes (must be globally unique)
4. Choose a location hint close to your users
5. Click **Create bucket**

**Step 3 — Enable public access**

1. Go to your bucket → **Settings → Public access**
2. For development: enable **R2.dev subdomain**
   - This gives you a URL like https://seqedge-genomes.your-account.r2.dev
   - Click **Allow access** and confirm
3. For production: bind a **Custom domain** (e.g. data.yourdomain.org)
   - Requires the domain's DNS to be on Cloudflare
4. Copy the public URL — it goes into .env.local:
   `env
   NEXT_PUBLIC_R2_PUBLIC_URL=https://seqedge-genomes.your-account.r2.dev
   `

**Step 4 — Configure CORS**

1. In your bucket → **Settings → CORS policy**
2. Add this policy:
   `json
   [
     {
       "AllowedOrigins": [
         "https://your-deployment.vercel.app",
         "http://localhost:3000"
       ],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 86400
     }
   ]
   `
3. Replace https://your-deployment.vercel.app with your actual Vercel URL after deployment

**Step 5 — Upload genome files**

For small test files, use the Cloudflare Dashboard's **Upload** button.

For large uploads, use [rclone](https://rclone.org/):
`ash
# Install rclone, then configure Cloudflare R2 backend:
rclone config
# Choose "s3" as storage type
# Use Cloudflare R2 endpoint: https://<account_id>.r2.cloudflarestorage.com
# Use your Cloudflare API token as the secret

# Upload your files:
rclone copy ./local-genomes/ r2:seqedge-genomes/genomes/ --progress --transfers 4
rclone copy ./local-tracks/ r2:seqedge-genomes/tracks/ --progress --transfers 4
`

**Required file structure in R2:**
`
seqedge-genomes/
  genomes/
    hg38.fa              # Reference genome FASTA
    hg38.fa.fai          # FASTA index (REQUIRED for JBrowse)
    hg38.fa.dict         # Sequence dictionary (optional)
  tracks/
    predicted_promoters.bed.gz        # BED track
    predicted_promoters.bed.gz.tbi    # Tabix index (REQUIRED)
    rnaseq_coverage.bw                # BigWig signal track
    chipseq_peaks.bed.gz              # Annotation track
    chipseq_peaks.bed.gz.tbi          # Tabix index
`

> **Critical**: Every indexed file (BED.gz, BAM, VCF) MUST have its companion index file (.tbi, .bai) in the same directory. JBrowse's range requests will fail without them.

**Free tier limits:**
- 10 GB storage (enough for a few reference genomes + tracks)
- 1 million Class A operations/month (writes)
- 10 million Class B operations/month (reads)
- **Egress is always free** — this is the #1 reason to use R2 over AWS S3

### 3. Vercel (Frontend Deployment)

Vercel hosts your Next.js app and serves it through a global CDN. Pushing to GitHub triggers automatic redeployment.

**Step 1 — Create an account**

1. Go to [vercel.com](https://vercel.com/) and sign up with your GitHub account

**Step 2 — Import your repo**

1. Click **Add New → Project**
2. Under **Import Git Repository**, find your SeqEdge fork
3. Framework Preset: **Next.js** (auto-detected)
4. Click **Deploy** (we will add env vars next)

**Step 3 — Add environment variables**

1. After the first deploy, go to **Settings → Environment Variables**
2. Add all three variables:

| Variable | Example | Where to find it |
|----------|---------|------------------|
| NEXT_PUBLIC_SUPABASE_URL | https://abcdefgh.supabase.co | Supabase → Settings → API |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | eyJhbGciOi... | Supabase → Settings → API |
| NEXT_PUBLIC_R2_PUBLIC_URL | https://seqedge-genomes.your-account.r2.dev | Cloudflare R2 → bucket settings |

3. Click **Save**
4. Go to **Deployments** → click the three dots on the latest deploy → **Redeploy**
5. Your site is now live at https://your-project.vercel.app

**Step 4 — Custom domain (optional)**

1. Go to **Settings → Domains**
2. Add your domain (e.g. seqedge.yourlab.org)
3. If your domain uses Cloudflare DNS:
   - Add a CNAME record: seqedge → cname.vercel-dns.com (orange cloud/proxied)
   - SSL/TLS → set encryption mode to **Full (Strict)**
4. Vercel will provision an SSL certificate automatically

**Free tier limits:**
- 100 GB bandwidth per month (more than enough for a database portal)
- Unlimited deployments
- Automatic HTTPS on .vercel.app subdomain

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

SeqEdge builds on the architecture and design principles of databases like [EPD](https://epd.epfl.ch/), [DBTSS](https://dbtss.hgc.jp/), and [RegulonDB](https://regulondb.ccg.unam.mx/), modernized with cloud-native infrastructure.
