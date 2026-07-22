<div align="center"><a name="readme-top"></a>

![SeqEdge Screenshot](./seqedge-github-img-readme.jpg)

# SeqEdge

**Scalable Genomics at the Edge**

A modern, open-source template for building interactive genomic databases.

**Primary**: [https://seq-edge.vercel.app](https://seq-edge.vercel.app) | **Mirror (China-friendly)**: [https://seqedge.pages.dev](https://seqedge.pages.dev) · [GitHub](https://github.com/Helloxiaolaodi/SeqEdge)

**English** | [简体中文](./README.zh-CN.md) | [Issues](https://github.com/Helloxiaolaodi/SeqEdge/issues)

> **Detailed Build Guide**: [SeqEdge Developer Notes](https://www.cnblogs.com/Helloxiaolaodi/p/21776736) - In-depth walkthrough from fork to deployment.

Stack: Next.js | Supabase | Cloudflare R2 / Hugging Face Datasets | JBrowse 2 | TanStack Table | ECharts

![License](https://img.shields.io/github/license/Helloxiaolaodi/SeqEdge?style=flat-square)
![Stars](https://img.shields.io/github/stars/Helloxiaolaodi/SeqEdge?style=flat-square)
![Forks](https://img.shields.io/github/forks/Helloxiaolaodi/SeqEdge?style=flat-square)
![Issues](https://img.shields.io/github/issues/Helloxiaolaodi/SeqEdge?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-15.5.21-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-2.110.7-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?style=flat-square&logo=vercel)

**Share SeqEdge Repository**

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

SeqEdge is a **template repository** for creating interactive web databases that display predicted promoters, whole genome annotations, and related genomic data. It uses a fully serverless, edge-native architecture that can run on free-tier cloud services.

If you have promoter predictions, gene annotations, or any coordinate-based genomic data, you can fork this repo, configure your data sources, and deploy your own database website in under an hour.

The name combines **Seq** (Sequencing / Sequence) and **Edge** (Edge Computing / Edge Network), representing the fusion of genomic data with modern cloud-native infrastructure.

> [!IMPORTANT]
>
> SeqEdge is designed to be forked and adapted quickly. If the repository is useful for your lab or project, star it to track future updates.

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
          | Supabase (Free)        |   | Cloudflare R2 (Free*) |
          | PostgreSQL metadata    |   | Object storage         |
          | - genome_samples       |   | - FASTA files          |
          | - promoters            |   | - BED / BigBed tracks  |
          | - variant_index        |   | - BigWig signal tracks |
          +------------------------+   | - VCF files + indexes  |
                                       +------------------------+
```

**Deployment model**

- **Vercel** (Primary) serves the majority of global traffic through its CDN.
- **Cloudflare Pages** (Mirror) provides an alternate deployment optimized for users in mainland China, served from Cloudflare's edge network via `opennextjs-cloudflare`.

**Data flow**

1. A visitor opens the site through Vercel's global CDN, or Cloudflare Pages in China.
2. The frontend queries Supabase for metadata such as coordinates, scores, and gene names.
3. When a user opens a locus or promoter, the genome browser fetches only the required byte ranges from object storage.
4. Large genomic files stay in object storage instead of being copied into the relational database.

## Quick Start

### Prerequisites

- Node.js `18+`
- npm
- A Supabase project
- An object store that supports CORS and HTTP range requests

### Step 1 - Fork and Clone

```bash
git clone https://github.com/<your-account>/SeqEdge.git
cd SeqEdge
npm install
```

### Step 2 - Configure Environment

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_STORAGE_BASE_URL=https://your-bucket.your-account.r2.dev
```

Legacy fallback remains supported:

```bash
NEXT_PUBLIC_R2_PUBLIC_URL=https://your-bucket.your-account.r2.dev
```

### Step 3 - Set Up Database

Run the schema in `schema.sql` and import your metadata tables.

### Step 4 - Run Locally

```bash
npm run dev
```

### Step 5 - Deploy

Recommended targets:

- **Vercel** for the primary site
- **Cloudflare Pages** for the mirror deployment

Cloudflare Pages deployment note:

- Set the Cloudflare build command to `npm run build:cf`.
- Set the Pages output directory to `.open-next`.
- Keep `public/demo-data` in the repository. The Cloudflare postbuild step copies these same-origin fallback files into `.open-next` and excludes `/demo-data/*` from the worker route so Pages can serve them as static assets.
- If you use a bucket subfolder such as `test-data/`, include that subpath directly in `NEXT_PUBLIC_STORAGE_BASE_URL`.

## Customization

### The One File You Must Edit

The main configuration entry is `src/site-config.ts`. In most forks, this is where users should define `jbrowse.defaultAssembly`, `jbrowse.assemblies`, the default locus for each assembly, demo storage behavior, and branding values.

### Storage Configuration

SeqEdge supports three hosting modes without code changes:

1. **Pure Cloudflare R2**
2. **Pure Hugging Face Datasets**
3. **Mixed hosting** with relative paths for common files and absolute `https://` links for very large files

If your objects live under a bucket prefix such as `test-data/`, include that prefix directly in `NEXT_PUBLIC_STORAGE_BASE_URL`, for example `https://your-bucket.r2.dev/test-data`.

### Configurable JBrowse demo tracks

Default demo assemblies and track files are now configured in `src/site-config.ts` instead of being hard-coded inside `src/components/jbrowse-viewer.tsx`. The browser probes assemblies in order, starting with `jbrowse.defaultAssembly`, and then tries storage bases in this order:

1. your configured `NEXT_PUBLIC_STORAGE_BASE_URL` or legacy `NEXT_PUBLIC_R2_PUBLIC_URL`;
2. the packaged same-origin demo bundle at `public/demo-data`;
3. the official public JBrowse volvox demo as a last-resort fallback.

Current bundled assemblies:

- `volvox` with `volvox.fa` + `volvox.fa.fai`
- `NC_045512.2` with `scov2.fa` + `scov2.fa.fai`

Configured optional tracks currently include:

- `volvox.sort.gff3.gz` + `volvox.sort.gff3.gz.tbi`
- `volvox-sorted.bam` + `volvox-sorted.bam.bai`
- `volvox.bb`
- `scov2.genes.bed`
- `scov2.genes.gff3`

The app now probes these optional tracks per assembly. If one required file is missing, only that track is hidden; the reference assembly and other healthy tracks continue to render.

## Feature Modules

- **Overview** for summary statistics and charts
- **Promoters** for searchable coordinate-based records
- **Genome Browser** for JBrowse 2 track rendering
- **User Guide** for inline usage help

## Cost Estimate

With moderate usage, SeqEdge usually fits within free tiers or very low-cost hosting:

- Vercel for frontend and API delivery
- Cloudflare Pages / Workers for mirrored access
- Supabase for metadata
- Hugging Face Datasets for larger public files

## Cloud Service Setup

### A. Supabase

Stores structured metadata and powers filtering queries.

### B. Cloudflare R2

Best for common small-to-medium genomic files, especially when you want low-latency object delivery.

### C. Hugging Face Datasets

Best for large public files. For JBrowse and similar tools, always use `resolve/main`, not `blob/main`.

### D. Vercel and Cloudflare Pages

Use Vercel as the primary deployment and Cloudflare Pages as the mirror deployment.

For Cloudflare Pages, the production-safe setup is:

- build command: `npm run build:cf`
- output directory: `.open-next`
- runtime expectation: `/demo-data/*` must be served as static assets, not intercepted by the worker

This matters because the genome browser now uses a same-origin fallback bundle in `public/demo-data` whenever your configured object storage is blocked, missing CORS headers, or missing a bucket prefix.

## Deployment Self-Check

After every Vercel or Cloudflare Pages deployment, run this checklist before sharing the site.

### A. Core health checks

- Open `/` and confirm the home page renders without a blank screen.
- Open `/api/stats` and confirm it returns `200`.
- Open the browser developer tools and confirm there is no repeated `Reference data unreachable` error.

### B. Same-origin demo fallback checks

These URLs must work on the deployed domain itself:

- `/demo-data/volvox.fa`
- `/demo-data/volvox.fa.fai`
- `/demo-data/scov2.fa`
- `/demo-data/scov2.fa.fai`

For Cloudflare Pages specifically, these requests must not return `404` from the worker. If they do, check that:

- the Pages build command is `npm run build:cf`;
- the output directory is `.open-next`;
- the generated `.open-next/_routes.json` excludes `/demo-data/*`;
- the generated `.open-next/demo-data` directory actually contains the bundled files.

### C. Object storage checks

- Confirm `NEXT_PUBLIC_STORAGE_BASE_URL` points to a CORS-enabled host.
- If your files live in a bucket subfolder, include that prefix in the base URL.
- For Hugging Face Datasets, use `resolve/main`, not `blob/main`.
- Verify range requests against your reference index and alignment indexes.

Examples:

```bash
curl -I https://your-bucket.r2.dev/test-data/volvox.fa.fai
curl -H "Range: bytes=0-0" -I https://your-bucket.r2.dev/test-data/volvox.fa.fai
curl -I https://huggingface.co/datasets/<user>/<repo>/resolve/main/scov2.fa.fai
```

### D. Genome browser checks

- Confirm the default assembly loads and the reference sequence renders.
- Confirm missing optional tracks fail quietly instead of crashing the whole browser.
- If one optional track is missing its companion index, only that track should stay hidden.
- If the configured storage fails, the browser should still recover through `public/demo-data`.

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

### A. Default template demo data

SeqEdge now ships a same-origin fallback demo bundle in `public/demo-data` so the template remains runnable even when an external object store is misconfigured, blocked by CORS, or missing a folder prefix such as `test-data/`. The default genome browser configuration is assembly-aware and file-name configurable through `src/site-config.ts`, rather than being hard-coded inside the JBrowse React component.

Current bundled demo files:

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

Runtime behavior:

- `volvox` remains the default template assembly
- `NC_045512.2` is also bundled as an alternate validation assembly
- optional tracks are rendered only when every required companion file is reachable

Sources:

- GMOD / JBrowse example data: `https://github.com/GMOD/jbrowse-components/tree/main/test_data`
- Canonical public demo host: `https://jbrowse.org/code/jb2/main/demos/volvox`

Acknowledgment:

- Thanks to the JBrowse and GMOD maintainers for publishing and maintaining these example assets for the community.

### B. SARS-CoV-2 validation data

During development, SeqEdge was also validated against a small SARS-CoV-2 dataset hosted on Hugging Face Datasets.

Files:

- `scov2.fa`
- `scov2.fa.fai`
- `scov2.gb`
- `scov2.genes.bed`
- `scov2.genes.gff3`

Primary sources:

- NCBI RefSeq accession `NC_045512.2`
- The corresponding NCBI GenBank record

Recommended citation:

- Wu F, Zhao S, Yu B, et al. *A new coronavirus associated with human respiratory disease in China*. Nature. 2020;579(7798):265-269. DOI: `10.1038/s41586-020-2008-3`

Acknowledgment:

- Thanks to the original authors, submitting laboratories, and NCBI / GenBank / RefSeq.

### C. E. coli K-12 MG1655 validation data

A lightweight *Escherichia coli* validation genome was used while checking FASTA indexing and browser compatibility.

Files:

- `reference.fa`
- `reference.fa.fai`
- `ecoli_k12_genomic.fna.gz`

Primary sources:

- NCBI RefSeq assembly `GCF_000005845.2`
- Chromosome accession `NC_000913.3`

Recommended citation:

- Blattner FR, Plunkett G 3rd, Bloch CA, et al. *The complete genome sequence of Escherichia coli K-12*. Science. 1997;277(5331):1453-1462. DOI: `10.1126/science.277.5331.1453`

Acknowledgment:

- Thanks to the original authors and NCBI for preserving and distributing this foundational bacterial reference genome.

## License

Released under the license declared in this repository.
