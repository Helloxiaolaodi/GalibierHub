<div align="center"><a name="readme-top"></a>

![SeqEdge Screenshot](./seqedge-github-img-readme.jpg)

# SeqEdge

**Edge-Native Genomics Database Template**

An open-source template for deploying interactive genomic and coordinate-based research databases with a serverless, storage-decoupled architecture.

**Primary**: [https://seq-edge.vercel.app](https://seq-edge.vercel.app) | **Mirror (China-friendly)**: [https://seqedge.pages.dev](https://seqedge.pages.dev) | **GitHub**: [https://github.com/Helloxiaolaodi/SeqEdge](https://github.com/Helloxiaolaodi/SeqEdge)

**English** | [简体中文](./README.zh-CN.md) | [Issues](https://github.com/Helloxiaolaodi/SeqEdge/issues)

> **Detailed Build Guide**: [SeqEdge Developer Notes](https://www.cnblogs.com/Helloxiaolaodi/p/21776736) - full technical walkthrough from fork to production deployment.

Stack: Next.js | Supabase | Cloudflare R2 | Hugging Face Datasets | Cloudflare Workers | JBrowse 2 | TanStack Table | ECharts

![License](https://img.shields.io/github/license/Helloxiaolaodi/SeqEdge?style=flat-square)
![Stars](https://img.shields.io/github/stars/Helloxiaolaodi/SeqEdge?style=flat-square)
![Forks](https://img.shields.io/github/forks/Helloxiaolaodi/SeqEdge?style=flat-square)
![Issues](https://img.shields.io/github/issues/Helloxiaolaodi/SeqEdge?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-15.5.21-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-2.110.7-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?style=flat-square&logo=vercel)

**Share SeqEdge**

[X / Twitter](https://twitter.com/intent/tweet?text=SeqEdge%20-%20Open-source%20genomic%20database%20template&url=https://github.com/Helloxiaolaodi/SeqEdge) · [Reddit](https://www.reddit.com/submit?url=https://github.com/Helloxiaolaodi/SeqEdge&title=SeqEdge%20-%20Open-source%20genomic%20database%20template) · [Weibo](https://service.weibo.com/share/share.php?title=SeqEdge%20-%20Open-source%20genomic%20database%20template&url=https://github.com/Helloxiaolaodi/SeqEdge)

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
  - [Deployment Self-Check](#deployment-self-check)
  - [Tech Stack](#tech-stack)
  - [Test Data & Attribution](#test-data--attribution)
  - [License](#license)

<br/>

</details>

## What is SeqEdge?

SeqEdge is a template repository for building public-facing genomic databases that combine metadata search, coordinate-based records, and browser-native genome visualization. It is designed for research groups that want a deployable site without maintaining a traditional server stack.

The template separates three concerns cleanly:

- relational metadata in Supabase / PostgreSQL;
- large genomic files in object storage;
- interactive rendering in the browser through JBrowse 2.

That separation is the core design choice. It keeps the database small, lets large BAM/CRAM/VCF/FASTA assets remain in cheap object storage, and allows the site to scale without coupling all data to one platform.

## Architecture

```text
+-----------------------------------------------------------+
|  Vercel (Primary)          Cloudflare Pages (Mirror)      |
|  Global CDN                 Edge network for China        |
|  Next.js frontend + API    Next.js frontend + API         |
|   +-----------+             +-----------+                 |
|   | ECharts   |             | ECharts   |                 |
|   | TanStack  |             | TanStack  |                 |
|   | Browser   |             | Browser   |                 |
|   +-----------+             +-----------+                 |
+------------------------+----------------------+-----------+
                         |                      |
                         v                      v
          +------------------------+   +------------------------+
          | Supabase               |   | Object storage         |
          | PostgreSQL metadata    |   | R2 / HF / S3-compatible|
          | - genome_samples       |   | - FASTA + indexes      |
          | - promoters            |   | - BAM / CRAM + indexes |
          | - variant_index        |   | - BED / BigBed / VCF   |
          +------------------------+   +------------------------+
```

**Delivery path**

1. The page shell is served from Vercel or Cloudflare Pages.
2. Search and statistics queries go to Next.js API routes backed by Supabase.
3. JBrowse requests only the byte ranges needed for the current genomic locus.
4. Large files remain in object storage instead of being duplicated into PostgreSQL.

## Quick Start

### Prerequisites

- Node.js `18+`
- npm
- A Supabase project
- A storage backend with CORS and HTTP range support

### Step 1 - Fork and clone

```bash
git clone https://github.com/<your-account>/SeqEdge.git
cd SeqEdge
npm install
```

### Step 2 - Configure environment variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_STORAGE_BASE_URL=https://your-bucket.your-account.r2.dev/test-data
```

Legacy fallback remains supported:

```bash
NEXT_PUBLIC_R2_PUBLIC_URL=https://your-bucket.your-account.r2.dev/test-data
```

If you use the Hugging Face proxy Worker in mixed mode:

```bash
NEXT_PUBLIC_STORAGE_BASE_URL=https://your-bucket.your-account.r2.dev/test-data
NEXT_PUBLIC_HF_PROXY_URL=https://seqedge-hf-proxy.your-account.workers.dev
```

### Step 3 - Initialize the database

Run `schema.sql` in Supabase and import your own metadata tables.

### Step 4 - Run locally

```bash
npm run dev
```

### Step 5 - Deploy

Recommended production layout:

- **Vercel** for the primary site
- **Cloudflare Pages** for the mirror site
- **Cloudflare Worker** for Hugging Face proxying when HF-hosted files are used by JBrowse

Cloudflare Pages settings:

- build command: `npm run build:cf`
- output directory: `.open-next`
- keep `public/demo-data` in the repository so the packaged same-origin fallback remains available

## Customization

### Core files to edit

- `src/site-config.ts`: branding, assemblies, default locus, demo behavior
- `.env.local`: storage and platform configuration
- `schema.sql`: initial database schema

### Storage configuration

SeqEdge now supports four storage modes without code changes:

1. **Pure Cloudflare R2**
2. **Pure Hugging Face Datasets** using `resolve/main`
3. **Mixed hosting** with relative paths for common assets and absolute `https://` URLs for very large files
4. **HF proxy mode** using `NEXT_PUBLIC_HF_PROXY_URL` and the Worker under `cloudflare-templates/hf-proxy/`

If your files live under a bucket prefix such as `test-data/`, include that prefix directly in `NEXT_PUBLIC_STORAGE_BASE_URL`.

### Hugging Face proxy deployment

Direct Hugging Face `resolve/main` links are often slow for JBrowse because the request path goes through 302 redirects, Xet bridge layers, and stricter CORS handling. SeqEdge includes a Cloudflare Worker template that rewrites those requests into a stable range-friendly endpoint. The proxy now applies both when your database stores absolute Hugging Face URLs and when `NEXT_PUBLIC_STORAGE_BASE_URL` itself points to a Hugging Face `resolve/main` base.

Current deployed example in this repository:

```text
https://seqedge-hf-proxy.helloxiaolaodi.workers.dev
```

Deployment procedure:

1. Edit `cloudflare-templates/hf-proxy/wrangler.toml` and set `HF_REPO_BASE` to your Hugging Face `resolve/main` base.
2. Authenticate Cloudflare:
   ```bash
   cd cloudflare-templates/hf-proxy
   npx wrangler login
   ```
3. Deploy the Worker:
   ```bash
   npx wrangler deploy
   ```
4. Configure SeqEdge:
   ```bash
   # Pure HF through proxy
   NEXT_PUBLIC_STORAGE_BASE_URL=https://seqedge-hf-proxy.your-account.workers.dev

   # Mixed mode (recommended)
   NEXT_PUBLIC_STORAGE_BASE_URL=https://your-bucket.your-account.r2.dev/test-data
   NEXT_PUBLIC_HF_PROXY_URL=https://seqedge-hf-proxy.your-account.workers.dev
   ```

Mixed mode is the recommended production strategy: keep high-frequency indexes such as `.fai`, `.bai`, `.tbi`, `.csi`, and `.crai` on R2, and keep very large data files on Hugging Face.

### Configurable JBrowse demo tracks

Default demo assemblies and track files are configured in `src/site-config.ts`, not hard-coded in the viewer component. The runtime probes storage targets in this order:

1. `NEXT_PUBLIC_STORAGE_BASE_URL` or legacy `NEXT_PUBLIC_R2_PUBLIC_URL`
2. the packaged same-origin demo bundle in `public/demo-data`
3. the public JBrowse volvox demo as a last-resort fallback

The current code defaults to the bundled SARS-CoV-2 assembly `NC_045512.2`, not `volvox`. `volvox` remains in the template as an alternate validation assembly and as the final public fallback dataset.

Current bundled assemblies:

- `volvox` with `volvox.fa` and `volvox.fa.fai`
- `NC_045512.2` with `scov2.fa` and `scov2.fa.fai`

Configured optional tracks include:

- `volvox.sort.gff3.gz` and `volvox.sort.gff3.gz.tbi`
- `volvox-sorted.bam` and `volvox-sorted.bam.bai`
- `volvox.bb`
- `scov2.genes.bed`
- `scov2.genes.gff3`

Optional tracks are probed independently. If one track is missing a companion file, only that track stays hidden.

## Feature Modules

- **Overview**: summary cards and charts
- **Promoters**: searchable coordinate-based records
- **Genome Browser**: JBrowse 2 integration
- **User Guide**: embedded instructions for end users

## Cost Estimate

For typical template usage, SeqEdge usually fits within free tiers or low-cost plans:

- Vercel for frontend delivery
- Cloudflare Pages / Workers for mirror delivery and HF proxying
- Supabase for metadata storage
- Cloudflare R2 or Hugging Face Datasets for genomic files

## Cloud Service Setup

### 1. Supabase

Use Supabase for structured metadata and filterable tables. Keep only query-oriented data in PostgreSQL; do not store BAM, CRAM, VCF, or FASTA binaries in the database.

### 2. Cloudflare R2

Use R2 for low-latency assets and especially for index files needed during JBrowse startup. Public `r2.dev` URLs or a custom domain both work.

### 3. Hugging Face Datasets

Use Hugging Face Datasets for large public files when storage cost matters. For browser-based genomics, always use `resolve/main`, never `blob/main`.

### 4. Vercel and Cloudflare Pages

Use Vercel as the primary deployment and Cloudflare Pages as the mirror. On Pages, ensure `/demo-data/*` remains a static route so the same-origin browser fallback works in production.

## Deployment Self-Check

Run this checklist after every deployment.

### 1. Core health checks

- Open `/` and confirm the site renders normally.
- Open `/api/stats` and confirm it returns `200`.
- Confirm the browser console is free of repeated `Reference data unreachable` errors.

### 2. Same-origin demo fallback checks

These URLs must work from the deployed domain:

- `/demo-data/volvox.fa`
- `/demo-data/volvox.fa.fai`
- `/demo-data/scov2.fa`
- `/demo-data/scov2.fa.fai`

If Cloudflare Pages returns `404`, verify:

- build command is `npm run build:cf`
- output directory is `.open-next`
- `.open-next/_routes.json` excludes `/demo-data/*`
- `.open-next/demo-data` contains the expected files

### 3. Object storage checks

- Confirm `NEXT_PUBLIC_STORAGE_BASE_URL` points to a CORS-enabled host.
- If files live under a subfolder, include that subpath in the base URL.
- For Hugging Face, confirm all public links use `resolve/main`.
- Validate range requests against at least one reference index and one alignment index.

Examples:

```bash
curl -I https://your-bucket.r2.dev/test-data/volvox.fa.fai
curl -H "Range: bytes=0-0" -I https://your-bucket.r2.dev/test-data/volvox.fa.fai
curl -I https://huggingface.co/datasets/<user>/<repo>/resolve/main/scov2.fa.fai
curl -H "Range: bytes=0-0" -I https://seqedge-hf-proxy.helloxiaolaodi.workers.dev/scov2.fa.fai
```

### 4. Genome browser checks

- Confirm the default assembly loads.
- Confirm optional track failures stay local to the missing track.
- Confirm the browser can fall back to `public/demo-data` if the configured storage is unavailable.
- If HF proxying is enabled, confirm requests hit your `workers.dev` host and return `206 Partial Content` without an intermediate `302` in the browser-visible path.

## Tech Stack

- Next.js `15.5.21`
- React `19.2.4`
- `@supabase/supabase-js` `^2.110.7`
- `@jbrowse/product-core` `^4.3.0`
- `@jbrowse/react-linear-genome-view` `^3.1.0`
- `@tanstack/react-table` `^8.21.3`
- `echarts` `^6.1.0`
- `@opennextjs/cloudflare` `^1.20.2`
- `wrangler` `^4.113.0`

## Test Data & Attribution

### 1. Default template demo data

The repository ships a same-origin fallback demo bundle in `public/demo-data` so the browser remains usable even when external storage is temporarily unavailable or misconfigured.

Bundled files include:

- `volvox.fa`
- `volvox.fa.fai`
- `volvox.sort.gff3.gz`
- `volvox-sorted.bam`
- `volvox-sorted.bam.bai`
- `volvox.bb`
- `scov2.fa`
- `scov2.fa.fai`
- `scov2.genes.bed`
- `scov2.genes.gff3`

Primary sources:

- GMOD / JBrowse example data: `https://github.com/GMOD/jbrowse-components/tree/main/test_data`
- JBrowse public demo host: `https://jbrowse.org/code/jb2/main/demos/volvox`

### 2. SARS-CoV-2 validation data

The template was validated against a small SARS-CoV-2 dataset during development.

Files:

- `scov2.fa`
- `scov2.fa.fai`
- `scov2.gb`
- `scov2.genes.bed`
- `scov2.genes.gff3`

Primary sources:

- NCBI RefSeq accession `NC_045512.2`
- corresponding GenBank record and annotations

Recommended citation:

- Wu F, Zhao S, Yu B, et al. *A new coronavirus associated with human respiratory disease in China*. Nature. 2020;579(7798):265-269. DOI: `10.1038/s41586-020-2008-3`

### 3. E. coli K-12 MG1655 validation data

A lightweight *Escherichia coli* reference was used while validating FASTA indexing and browser compatibility.

Files:

- `reference.fa`
- `reference.fa.fai`
- `ecoli_k12_genomic.fna.gz`

Primary sources:

- NCBI RefSeq assembly `GCF_000005845.2`
- chromosome accession `NC_000913.3`

Recommended citation:

- Blattner FR, Plunkett G 3rd, Bloch CA, et al. *The complete genome sequence of Escherichia coli K-12*. Science. 1997;277(5331):1453-1462. DOI: `10.1126/science.277.5331.1453`

## License

Released under the license declared in this repository.
