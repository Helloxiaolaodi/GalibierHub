<div align="center"><a name="readme-top"></a>

<img src="./public/seqedge-github-img-readme.jpg" alt="SeqEdge Screenshot — Overview" width="100%">

<br/>

<img src="./public/seqedge-github-img-02-readme.jpg" alt="SeqEdge Screenshot — Genome Browser" width="100%">

# SeqEdge

**Scalable Genomics at the Edge**

A modern, open-source template for building interactive genomic databases.

**🚀 Primary**: [https://seq-edge.vercel.app](https://seq-edge.vercel.app) | **Mirror (China-friendly)**: [https://seqedge.pages.dev](https://seqedge.pages.dev) · [GitHub][github-repo-link]

**English** | [简体中文](./README.zh-CN.md) | [Issues][github-issues-link]

> ?? **Detailed Build Guide**: [SeqEdge Developer Notes](https://www.cnblogs.com/Helloxiaolaodi/p/21776736) — In-depth walkthrough from fork to deployment.

Stack: Next.js | Supabase | Cloudflare R2 | JBrowse 2 | TanStack Table | ECharts

<!-- SHIELD GROUP -->

[![][github-license-shield]][github-license-link]
[![][github-stars-shield]][github-stars-link]
[![][github-forks-shield]][github-forks-link]
[![][github-issues-shield]][github-issues-link]<br/>
[![][nextjs-shield]][nextjs-link]
[![][supabase-shield]][supabase-link]
[![][vercel-shield]][vercel-link]

**Share SeqEdge Repository**

[![][share-x-shield]][share-x-link]
[![][share-reddit-shield]][share-reddit-link]
[![][share-weibo-shield]][share-weibo-link]

<sup>Open-source genomic database template</sup>

</div>

<details>
<summary><kbd>Table of contents</kbd></summary>

#### TOC

- [SeqEdge](#seqedge)
  - [What is SeqEdge?](#what-is-seqedge)
  - [Architecture](#architecture)
  - [Quick Start](#quick-start)
  - [Customization](#customization)
  - [Feature Modules](#feature-modules)
  - [Cost Estimate](#cost-estimate)
  - [Cloud Service Setup](#cloud-service-setup)
  - [Tech Stack](#tech-stack)
  - [Acknowledgments](#acknowledgments)
  - [License](#license)

<br/>

</details>

## What is SeqEdge?

SeqEdge is a **template repository** for creating interactive web databases that display predicted promoters, whole genome annotations, and related genomic data. It uses a fully serverless, edge-native architecture that can run on free-tier cloud services.

If you have promoter predictions, gene annotations, or any coordinate-based genomic data, you can fork this repo, configure your data sources, and deploy your own database website in under an hour.

The name combines **Seq** (Sequencing / Sequence) and **Edge** (Edge Computing / Edge Network), representing the fusion of genomic data with modern cloud-native infrastructure.

> [!IMPORTANT]
>
> SeqEdge is designed to be forked and adapted quickly. If the repository is useful for your lab or project, star it to track future updates.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## Architecture

```text
+-----------------------------------------------------------+
|  Vercel (Primary)          Cloudflare Pages (Mirror)      |
|  Global CDN                 Edge network for China        |
|  Next.js frontend + API    Next.js frontend + API        |
|   +-----------+             +-----------+                 |
|   | ECharts   |             | ECharts   |                 |
|   | TanStack  |             | TanStack  |                 |
|   | Browser   |             | Browser   |                 |
|   +-----------+             +-----------+                 |
+------------------------+----------------------+-----------+
                         |                      |
                         v                      v
          +------------------------+   +------------------------+
          | Supabase (Free)        |   | Cloudflare R2 (Free*) |
          | PostgreSQL metadata    |   | Object storage         |
          | - genome_samples       |   | - FASTA files          |
          | - promoters            |   | - BED / BigBed tracks  |
          | - variant_index        |   | - BigWig signal tracks |
          +------------------------+   | - VCF files + indexes  |
                                       +------------------------+
```

**Deployment model**

- **Vercel** (Primary) — serves the majority of global traffic through its CDN.
- **Cloudflare Pages** (Mirror) — provides an alternate deployment optimized for users in mainland China, served from Cloudflare's edge network via `opennextjs-cloudflare`.

**Data flow**

1. A visitor opens the site through Vercel's global CDN (or Cloudflare Pages in China).
2. The frontend queries Supabase for metadata such as coordinates, scores, and gene names.
3. When a user opens a locus or promoter, the genome browser fetches only the required byte ranges from R2.
4. Large genomic files stay in object storage instead of being copied into the relational database.

**Genomic input data types read by SeqEdge:**

The following table lists the genomic input data formats supported by SeqEdge, along with their storage location and purpose:

| Data Type | File Format | Storage | Purpose |
|---|---|---|---|
| Reference genome sequence | FASTA (.fa, .fasta) + .fai index | Cloudflare R2 | JBrowse 2 reference sequence track providing chromosomal coordinate reference |
| Gene annotations / promoter regions | BED (.bed) | Cloudflare R2 | JBrowse 2 annotation track displaying predicted promoter and gene positions |
| Alignment reads | BAM (.bam) + .bai index | Cloudflare R2 | JBrowse 2 alignment track showing sequencing read alignments to the reference |
| Signal coverage | BigWig (.bw, .bigwig) | Cloudflare R2 | JBrowse 2 quantitative track (XYPlot) displaying read depth or signal intensity |
| Variant data | VCF (.vcf) + .tbi index | Cloudflare R2 | JBrowse 2 variant track showing SNP/InDel and other variant sites |
| Metadata | PostgreSQL tables | Supabase | Queried via API routes to drive the overview dashboard, promoter table, search and filtering |

In short:
- **Metadata** (sample info, promoter scores/sequences, variant annotations) is stored in three Supabase PostgreSQL tables (`genome_samples`, `promoters`, `variants`), queried by Next.js API routes and returned as JSON to the frontend.
- **Large files** (FASTA, BED, BAM, BigWig, VCF with their corresponding index files) are stored on Cloudflare R2 and read directly by the JBrowse 2 genome browser via HTTP Range requests, on demand.
- In demo mode, all metadata uses hardcoded sample data and the genome browser uses JBrowse built-in example data, allowing the full experience without any external services.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Git](https://git-scm.com/)
- A [Supabase](https://supabase.com/) account
- A [Vercel](https://vercel.com/) account
- A [Cloudflare](https://cloudflare.com/) account for R2 (optional during local development)

### Step 1 - Fork and Clone

```bash
# Fork this repo on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/SeqEdge.git
cd SeqEdge
npm install
```

### Step 2 - Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_R2_PUBLIC_URL=https://your-r2-bucket.r2.dev
```

### Step 3 - Set Up Database

1. Go to your Supabase project dashboard.
2. Open the **SQL Editor**.
3. Copy and paste the contents of `schema.sql`.
4. Click **Run** to create the tables, indexes, and sample data.

### Step 4 - Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the demo data locally.

### Step 5 - Deploy

SeqEdge supports deployment on **Vercel** (recommended) or **Cloudflare Pages** (experimental edge deployment).

**Option A: Vercel**

1. Push your code to GitHub.
2. Import the repository on [vercel.com/new](https://vercel.com/new).
3. Add your environment variables in the Vercel dashboard.
4. Deploy and publish the site.

**Option B: Cloudflare Pages**

1. Build locally and verify: `npm run build:cf`
2. In Cloudflare Pages dashboard ? Settings ? Build & deployments:
   - **Framework preset**: `None`
   - **Build command**: `npm run build:cf`
   - **Build output directory**: `.open-next/assets`
3. **Open-source safe setup: inject variables from Cloudflare** (never commit real secrets to the GitHub repo)

   * Confirm `.gitignore` includes `.env*.local` and `.env.production` so no keys leak.
   * If `wrangler.toml` has a `[vars]` block with `NEXT_PUBLIC_*` values, remove that block, commit, and push to unlock the Cloudflare dashboard.
   * Open Cloudflare Dashboard → Workers & Pages → seqedge → Settings → Variables and Secrets, delete any old gray/conflicting `NEXT_PUBLIC_*` entries, then add these three as **Plaintext** (enable **"Available at build time"** / select **Build**):

   | Variable name | Value | Type |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://mqpbkfdtnlrsvxzagpa.supabase.co` | Plaintext |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<your Supabase anon public key>` | Plaintext |
   | `NEXT_PUBLIC_R2_PUBLIC_URL` | `https://pub-e730b1fa4454168b689c626bd07881.r2.dev` | Plaintext |

   For the full four-step workflow, see `SeqEdge Developer Notes` chapter "Open-Source Template Standard".

> [!TIP]
>
> For the first working deployment, keep the demo dataset and verify the Supabase and R2 connections before importing your full production data.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## Customization

### The One File You Must Edit

`src/site-config.ts` is the central configuration file. Change these values to personalize your database:

```typescript
export const SiteConfig = {
  title: 'MyGenomeDB',
  subtitle: 'A Promoter Database',
  colors: {
    primary: '#1E3A8A',
  },
  jbrowse: {
    defaultAssembly: 'hg38',
    storageBaseUrl: process.env.NEXT_PUBLIC_R2_PUBLIC_URL,
  },
  chromosomes: ['chr1', 'chr2'],
  // ...
};
```

### Connecting Real Data

1. Upload genome files to Cloudflare R2, including required index files such as `.fai`, `.bai`, and `.tbi`.
2. Import metadata into Supabase, including promoter predictions, sample information, and optional variant summaries.
3. Update `src/site-config.ts` with your assembly name and track definitions.
4. Replace demo queries in `src/app/page.tsx` with your real Supabase queries.

### Storage Configuration

SeqEdge is **storage-agnostic**. It never hard-codes a provider — every genome file is
addressed by a URL that resolves through a single base prefix, so you can host on
**Cloudflare R2**, **Hugging Face Datasets**, **AWS S3**, or any CORS-enabled object
store that supports HTTP range requests. Pick whichever fits your data volume.

| Provider | Free single-file limit | Free total capacity | Best for |
| --- | --- | --- | --- |
| Cloudflare R2 | 5 TB/object | 10 GB free tier | Small–medium demo track sets |
| Hugging Face Datasets | 50 GB/file (Git LFS) | No hard cap (100s of GB is routine) | Hundreds of GB of whole-genome CRAM/VCF |
| AWS S3 | 5 TB/object | Pay-as-you-go | Existing AWS pipelines |

**Set one environment variable** — the storage-agnostic name is preferred; the legacy
`NEXT_PUBLIC_R2_PUBLIC_URL` still works as a backward-compatible fallback:

```env
# Cloudflare R2
NEXT_PUBLIC_STORAGE_BASE_URL=https://pub-xxxxxxxx.r2.dev

# — or — Hugging Face Datasets (note the /resolve/main suffix, NOT /blob/main)
NEXT_PUBLIC_STORAGE_BASE_URL=https://huggingface.co/datasets/<user>/<repo>/resolve/main
```

#### Two hosting modes

1. **Single-source hosting (recommended).** Store **relative paths** in Supabase
   (e.g. `tracks/sample1.bb`) and set `NEXT_PUBLIC_STORAGE_BASE_URL` to your bucket
   root. Every file resolves against that one prefix. Zero code changes to switch
   providers — just change the env var and redeploy.

2. **Mixed-source hosting (advanced).** Keep small files on R2 but park a 50 GB+ CRAM
   on Hugging Face by storing its **full `https://` URL** directly in Supabase. The
   `getStorageUrl()` helper (`src/lib/storage.ts`) detects the leading scheme and
   returns absolute URLs untouched, so the file loads cross-origin with no extra
   config. You can freely mix providers per-file.

#### Hosting large genomes on Hugging Face (step by step)

Hugging Face Datasets is the most generous free option for large omics data: 50 GB
per file via Git LFS, no hard cap on total repo size, free global CDN, native CORS +
HTTP range support — exactly what JBrowse 2 needs.

**1. Install Git LFS (one-time)**

```bash
# macOS
brew install git-lfs
# Debian/Ubuntu
sudo apt-get install git-lfs
# Windows (Git for Windows already bundles it; otherwise)
#   download from https://git-lfs.com
git lfs install
```

**2. Create a public Dataset repo**

Sign in at [huggingface.co](https://huggingface.co), then **New → Dataset**. Give it a
name (e.g. `my-genome-tracks`) and set visibility to **Public** so the site can read
it without a token.

**3. Clone, add files, push**

```bash
git clone https://huggingface.co/datasets/<user>/my-genome-tracks
cd my-genome-tracks

# Track large binary formats with LFS so they upload as real files, not pointers
git lfs track "*.cram" "*.crai" "*.bam" "*.bai" "*.bb" "*.bw" \
              "*.vcf.gz" "*.vcf.gz.tbi" "*.fa" "*.fa.fai" "*.gz" "*.gzi"
git add .gitattributes

# IMPORTANT: keep each index file next to its data file, same base name
#   volvox.fa            volvox.fa.fai
#   sample1.cram         sample1.cram.crai
#   variants.vcf.gz      variants.vcf.gz.tbi
cp /path/to/*.cram* /path/to/*.vcf.gz* .
git add .
git commit -m "add genome tracks"
git push
```

**4. Get the raw file URL prefix**

The URL pattern is:

```
https://huggingface.co/datasets/<user>/<repo>/resolve/main/<path>
```

Set the **prefix** (everything up to and including `/resolve/main`) as your base URL:

```env
NEXT_PUBLIC_STORAGE_BASE_URL=https://huggingface.co/datasets/<user>/my-genome-tracks/resolve/main
```

**5. Verify CORS + range support**

```bash
# 206 Partial Content + accept-ranges: bytes means JBrowse can stream it
curl -sI -H "Range: bytes=0-0" \
  "https://huggingface.co/datasets/<user>/my-genome-tracks/resolve/main/volvox.fa.fai"
```

> [!IMPORTANT]
> Two Hugging Face gotchas that cause most failures:
> - Use **`/resolve/main`**, never **`/blob/main`**. `blob` returns an HTML preview
>   page; `resolve` returns the raw byte stream JBrowse needs.
> - Keep each **index file** (`.fai` / `.tbi` / `.crai` / `.bai`) in the **same
>   directory with the same base name** as its data file. JBrowse derives the index
>   URL by appending the extension, so the paths must line up exactly.
>
> Hugging Face answers large-file requests with a `302` redirect to its CDN. SeqEdge's
> reachability probe issues a `Range` GET (not a bare `HEAD`) specifically so it
> follows that redirect correctly.

### Data Format Requirements

**Supabase `predicted_promoters` table columns**

| Column | Type | Required | Example |
| --- | --- | --- | --- |
| `sample_id` | `text` | yes | `SAMPLE-001` |
| `chrom` | `text` | yes | `chr17` |
| `start` | `integer` | yes | `43044295` |
| `end_pos` | `integer` | yes | `43045800` |
| `score` | `numeric(0-1)` | yes | `0.95` |
| `strand` | `text (+/-)` | yes | `+` |
| `gene_symbol` | `text` | no | `BRCA1` |
| `sequence` | `text` | no | `ATGCGTAC...` |

**Cloudflare R2 file structure**

```text
your-bucket/
  genomes/
    hg38.fa
    hg38.fa.fai
    hg38.fa.dict
  tracks/
    predicted_promoters.bed.gz
    predicted_promoters.bed.gz.tbi
    rnaseq_coverage.bw
    chipseq_peaks.bed.gz
    chipseq_peaks.bed.gz.tbi
```

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## Feature Modules

The codebase is designed to be modular. Each feature is implemented as a separate component or surface.

| Component | File | Purpose |
| --- | --- | --- |
| Stats Dashboard | `src/components/stats-chart.tsx` | Pie chart for species distribution and bar chart for score distribution |
| Search Filters | `src/components/search-filters.tsx` | Multi-faceted promoter search |
| Data Table | `src/components/promoter-table.tsx` | Sortable, filterable, paginated table |
| Promoter Detail | `src/components/promoter-detail.tsx` | Modal with coordinates, score, sequence, and BED/FASTA export |
| Genome Browser | `src/components/genome-browser.tsx` | Custom genome viewer with JBrowse 2 integration path |

To disable a feature, update `src/site-config.ts`:

```typescript
features: {
  enableGenomeBrowser: false,
  enableStatsCharts: true,
  enableVariantSearch: false,
}
```

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## Cost Estimate

| Service | Free Tier | Paid Tier |
| --- | --- | --- |
| Vercel (Primary) | 100 GB bandwidth / month | Pro $20 / month |
| Cloudflare Pages (Mirror) | 500 builds / month, unlimited bandwidth | $5 / month for higher limits |
| Supabase | 500 MB DB, 2 GB bandwidth | Pro $25 / month |
| Cloudflare R2 | 10 GB storage, free egress | $0.015 / GB / month storage |
| Domain | `.vercel.app` / `.pages.dev` free | Custom domain ~$10 / year |

> [!NOTE]
>
> A typical paper-supporting portal can usually stay on the free tiers during development and review. Production use with persistent traffic is still inexpensive if metadata remains in Supabase and only large assets are stored in R2.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

---

## Cloud Service Setup

This section walks through the three cloud services SeqEdge depends on. All three have free tiers that are enough for development and early sharing.

### A. Supabase (PostgreSQL Database)

Supabase stores promoter metadata, sample information, and variant indexes.

**Step 1 - Create an account**

1. Go to [supabase.com](https://supabase.com/) and click **Start your project**.
2. Sign up with GitHub or email.

**Step 2 - Create a project**

1. Click **New Project**.
2. Fill in:
   - **Name**: `seqedge-db`
   - **Database Password**: create and save a strong password
   - **Region**: choose the region closest to your users
3. Wait for the project to initialize.

**Step 3 - Get your credentials**

1. Open **Settings -> API**.
2. Copy:
   - **Project URL**
   - **anon public key**
3. Add them to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

**Step 4 - Create database tables**

1. Open **SQL Editor**.
2. Create a new query.
3. Paste the contents of `schema.sql`.
4. Run the script.
5. Verify the expected tables and sample rows in **Table Editor**.

**Step 5 - Import your real data**

For small datasets, use the dashboard insert tools.

For larger imports, use Python:

```python
import pandas as pd
from supabase import create_client

url = "https://abcdefgh.supabase.co"
key = "eyJhbGciOi..."
supabase = create_client(url, key)

df = pd.read_csv("your_promoters.csv")
records = df.to_dict("records")

for i in range(0, len(records), 500):
    batch = records[i:i + 500]
    supabase.table("predicted_promoters").insert(batch).execute()
    print(f"Inserted {min(i + 500, len(records))}/{len(records)}")
```

> [!NOTE]
>
> Free tier limits: 500 MB database storage, 2 GB bandwidth per month, and auto-pause after inactivity.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

### B. Cloudflare R2 (Genome File Storage)

R2 stores large genome assets such as FASTA, BED, BigWig, BAM, and indexed track files. JBrowse-compatible range requests depend on these files being directly accessible and correctly indexed.

**Step 1 - Create an account**

1. Go to [cloudflare.com](https://cloudflare.com/) and sign up.
2. You can use R2 without moving your domain DNS to Cloudflare.

**Step 2 - Create an R2 bucket**

1. Open **R2 Object Storage**.
2. Click **Create bucket**.
3. Use a globally unique bucket name such as `seqedge-genomic-data`.
4. Choose a location hint close to your users.

**Step 3 - Enable public access**

1. Open the bucket settings.
2. Enable the `r2.dev` public development URL for testing.
3. Copy the public URL into `.env.local`:

```env
NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-xxxxxxxxx.r2.dev
```

**Step 4 - Configure CORS**

Add a policy similar to this:

```json
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
```

**Step 5 - Upload genome files**

For small tests, use the dashboard uploader.

For larger uploads, `rclone` is a practical choice:

```bash
rclone config
rclone copy ./local-genomes/ r2:seqedge-genomic-data/test-data/ --progress --transfers 4
rclone copy ./local-tracks/ r2:seqedge-genomic-data/test-data/ --progress --transfers 4
```

**Required file structure in R2**

```text
seqedge-genomic-data/
  test-data/
    volvox.fa
    volvox.fa.fai
    reference.fa
    reference.fa.fai
    volvox-bed12.bed.gz
    volvox-bed12.bed.gz.tbi
    volvox-sorted.bam
    volvox-sorted.bam.bai
    volvox.gff3
    volvox.bb
```

> [!WARNING]
>
> Every indexed file such as `BED.gz`, `BAM`, and `VCF` must have its companion index file in the same directory. Range requests fail without the matching index.

> [!NOTE]
>
> Free tier highlights: 10 GB storage and zero egress fees, which is the main reason SeqEdge uses R2 instead of standard S3 for public genome data delivery.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

### C. Vercel (Frontend Deployment)

Vercel hosts the Next.js app and handles preview and production deployments from GitHub.

**Step 1 - Create an account**

1. Go to [vercel.com](https://vercel.com/) and sign up with GitHub.

**Step 2 - Import your repository**

1. Click **Add New -> Project**.
2. Select your SeqEdge fork.
3. Keep the **Next.js** preset.
4. Deploy.

**Step 3 - Add environment variables**

Open **Settings -> Environment Variables** and add:

| Variable | Example | Source |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://abcdefgh.supabase.co` | Supabase API settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Supabase API settings |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | `https://pub-xxxxxxxxx.r2.dev` | Cloudflare R2 bucket settings |

Enable the variables for **Production**, **Preview**, and **Development**.

<details>
<summary><kbd>How to find your R2 public URL</kbd></summary>

1. Open the Cloudflare dashboard.
2. Go to **R2 Object Storage** and select your bucket.
3. Open **Settings**.
4. Copy the **Public Development URL**.
5. Paste it into `NEXT_PUBLIC_R2_PUBLIC_URL` without a trailing slash.

</details>

<details>
<summary><kbd>Redeploy after changing environment variables</kbd></summary>

1. Open your Vercel project.
2. Go to the **Deployments** tab.
3. Find the latest deployment.
4. Open the menu and click **Redeploy**.
5. Wait for the rebuild to finish.

</details>

**Step 4 - Add a custom domain (optional)**

1. Open **Settings -> Domains**.
2. Add your domain, for example `seqedge.yourlab.org`.
3. If the domain uses Cloudflare DNS, add the recommended CNAME record.
4. Let Vercel provision the SSL certificate.

> [!NOTE]
>
> Free tier highlights: 100 GB bandwidth per month, unlimited deployments, and automatic HTTPS on the default `.vercel.app` domain.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

### D. Cloudflare Pages (Mirror Deployment for China)

SeqEdge can be deployed to Cloudflare's global edge network via `opennextjs-cloudflare`. This mirror is optimized for users in mainland China where Vercel access is limited.

> All API routes (`/api/stats`, `/api/promoters`, `/api/variants`) and dynamic routes (`/promoter/[id]`) are automatically recognized as server functions by the OpenNext adapter and will work on Cloudflare's edge infrastructure.

**Step 1 - Build locally and verify**

```bash
npm run build:cf
```

This produces deployable assets in `.open-next/assets`.

**Step 2 - Configure Cloudflare Pages**

In the Cloudflare Pages dashboard, go to **Settings → Build & deployments** and set:

| Setting | Value |
| --- | --- |
| Framework preset | `None` |
| Build command | `npm run build:cf` |
| Build output directory | `.open-next/assets` |

> **Important**: Confirm that all three environment variables are configured under **Settings → Environment variables**:
> - `NEXT_PUBLIC_SUPABASE_URL`
> - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
> - `NEXT_PUBLIC_R2_PUBLIC_URL`

**Step 3 - Commit and push**

Push your code to GitHub. Cloudflare Pages will automatically trigger a new deployment. The build log should show `next build` followed by `opennextjs-cloudflare build`, with final output in `.open-next/assets`.

**Troubleshooting: Build fails with `supabaseUrl is required`**

This error means the three `NEXT_PUBLIC_` environment variables are missing from the Cloudflare Pages dashboard. Next.js needs these at build time to generate static pages.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | Cloudflare R2 public file URL |

To fix:

1. Go to Cloudflare Dashboard → Pages → SeqEdge → Settings → Environment variables
2. Add all three variables with the same values as your local `.env.local`
3. Check both **Production** and **Preview** environments
4. Save and trigger a new deployment

**Files modified for Cloudflare compatibility:**

| File | Change |
| --- | --- |
| `.gitignore` | Added `.open-next/` and `.wrangler/` |
| `package.json` | Replaced with OpenNext scripts and pinned dependency versions |
| `package-lock.json` | Regenerated lock file after reinstall |
| `next.config.ts` | Cleaned empty comments |
| `wrangler.toml` | Added Cloudflare compatibility configuration |
| `open-next.config.ts` | Added OpenNext full configuration |

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## Tech Stack

| Category | Technology | Description |
| --- | --- | --- |
| Framework | [Next.js][nextjs-link] | React 19 and App Router |
| Database | [Supabase][supabase-link] | PostgreSQL and REST APIs |
| File Storage | [Cloudflare R2][r2-link] | S3-compatible object storage with free egress |
| Genome Browser | [JBrowse 2][jbrowse-link] | Embeddable genome browser workflow |
| Data Table | [TanStack Table][tanstack-link] | Sorting, filtering, and scalable table rendering |
| Charts | [Apache ECharts][echarts-link] | Interactive genomic summary charts |
| Styling | [Tailwind CSS][tailwind-link] | Utility-first styling |
| Primary Deploy | [Vercel][vercel-link] | Global CDN and Git-based deployment |
| Mirror Deploy | [Cloudflare Pages](https://pages.cloudflare.com/) | Edge network for China access |

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## Acknowledgments

SeqEdge builds on a strong open-source ecosystem. These projects make the template practical for research-facing genomic applications.

| Project | Role |
| --- | --- |
| [Next.js](https://nextjs.org/) | Frontend framework and application runtime |
| [Supabase](https://supabase.com/) | Hosted PostgreSQL and API layer |
| [JBrowse 2](https://jbrowse.org/jb2/) | Interactive genome browser foundation |
| [Cloudflare R2](https://www.cloudflare.com/products/r2/) | Storage layer for large genomic assets |
| [Vercel](https://vercel.com/) | Deployment and edge delivery |
| [TanStack Table](https://tanstack.com/table) | Data grid behavior for promoter and locus tables |
| [Apache ECharts](https://echarts.apache.org/) | Chart rendering for summary analytics |
| [Tailwind CSS](https://tailwindcss.com/) | Consistent UI styling |

SeqEdge also draws inspiration from classic genomic databases such as [EPD](https://epd.epfl.ch/), [DBTSS](https://dbtss.hgc.jp/), and [RegulonDB](https://regulondb.ccg.unam.mx/), updated with a cloud-native deployment model.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

---

## License

MIT - use freely for academic and commercial projects.

Part of the SeqEdge project: [github.com/Helloxiaolaodi/SeqEdge][github-repo-link]

<!-- LINK GROUP -->

[back-to-top]: https://img.shields.io/badge/-BACK_TO_TOP-151515?style=flat-square
[echarts-link]: https://echarts.apache.org/
[github-forks-link]: https://github.com/Helloxiaolaodi/SeqEdge/network/members
[github-forks-shield]: https://img.shields.io/github/forks/Helloxiaolaodi/SeqEdge?color=8ae8ff&labelColor=black&style=flat-square
[github-issues-link]: https://github.com/Helloxiaolaodi/SeqEdge/issues
[github-issues-shield]: https://img.shields.io/github/issues/Helloxiaolaodi/SeqEdge?color=ff80eb&labelColor=black&style=flat-square
[github-license-link]: https://github.com/Helloxiaolaodi/SeqEdge/blob/main/LICENSE
[github-license-shield]: https://img.shields.io/badge/license-MIT-white?labelColor=black&style=flat-square
[github-repo-link]: https://github.com/Helloxiaolaodi/SeqEdge
[github-stars-link]: https://github.com/Helloxiaolaodi/SeqEdge/stargazers
[github-stars-shield]: https://img.shields.io/github/stars/Helloxiaolaodi/SeqEdge?color=ffcb47&labelColor=black&style=flat-square
[image-banner]: ./public/seqedge-banner.svg
[jbrowse-link]: https://jbrowse.org/jb2/
[nextjs-link]: https://nextjs.org/
[nextjs-shield]: https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white&style=flat-square
[r2-link]: https://www.cloudflare.com/products/r2/
[share-reddit-link]: https://www.reddit.com/submit?title=SeqEdge%20-%20Scalable%20Genomics%20at%20the%20Edge&url=https%3A%2F%2Fgithub.com%2FHelloxiaolaodi%2FSeqEdge
[share-reddit-shield]: https://img.shields.io/badge/-share%20on%20reddit-black?labelColor=black&logo=reddit&logoColor=white&style=flat-square
[share-weibo-link]: http://service.weibo.com/share/share.php?sharesource=weibo&title=Check%20this%20GitHub%20repository%20out%20SeqEdge%20-%20A%20modern%2C%20open-source%20template%20for%20building%20genomic%20databases.&url=https%3A%2F%2Fgithub.com%2FHelloxiaolaodi%2FSeqEdge
[share-weibo-shield]: https://img.shields.io/badge/-share%20on%20weibo-black?labelColor=black&logo=sinaweibo&logoColor=white&style=flat-square
[share-x-link]: https://x.com/intent/tweet?text=Check%20out%20SeqEdge%20-%20A%20modern%2C%20open-source%20template%20for%20building%20genomic%20databases.&url=https%3A%2F%2Fgithub.com%2FHelloxiaolaodi%2FSeqEdge
[share-x-shield]: https://img.shields.io/badge/-share%20on%20x-black?labelColor=black&logo=x&logoColor=white&style=flat-square
[supabase-link]: https://supabase.com/
[supabase-shield]: https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white&labelColor=black&style=flat-square
[tailwind-link]: https://tailwindcss.com/
[tanstack-link]: https://tanstack.com/table
[vercel-link]: https://vercel.com/
[vercel-shield]: https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white&labelColor=black&style=flat-square
