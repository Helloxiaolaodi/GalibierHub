# SeqEdge

![SeqEdge Screenshot](./seqedge-github-img-readme.jpg)

Edge-Native Genomics Database Template

An open-source template for coordinate-based genomics portals that combine searchable metadata, genome browser views, charts, and storage-decoupled deployment.

Primary: [https://seq-edge.vercel.app](https://seq-edge.vercel.app)
Mirror: [https://seqedge.pages.dev](https://seqedge.pages.dev)
GitHub: [https://github.com/Helloxiaolaodi/SeqEdge](https://github.com/Helloxiaolaodi/SeqEdge)

Language: English | [Simplified Chinese](./README.zh-CN.md) | [Issues](https://github.com/Helloxiaolaodi/SeqEdge/issues)

Detailed build guide: [SeqEdge Developer Notes](https://www.cnblogs.com/Helloxiaolaodi/p/21776736)

Stack: Next.js | React | Supabase | Cloudflare R2 | Hugging Face Datasets | Cloudflare Workers | JBrowse 2 | TanStack Table | ECharts

![License](https://img.shields.io/github/license/Helloxiaolaodi/SeqEdge?style=flat-square)
![Stars](https://img.shields.io/github/stars/Helloxiaolaodi/SeqEdge?style=flat-square)
![Forks](https://img.shields.io/github/forks/Helloxiaolaodi/SeqEdge?style=flat-square)
![Issues](https://img.shields.io/github/issues/Helloxiaolaodi/SeqEdge?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-15.5.21-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-2.110.7-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?style=flat-square&logo=vercel)

## 1. Overview

SeqEdge is a deployable template for research teams that need a public-facing genomics database without maintaining a traditional long-running backend. The repository separates three responsibilities:

- structured metadata in Supabase / PostgreSQL;
- large genomic assets in object storage;
- interactive rendering in the browser through JBrowse 2, TanStack Table, and ECharts.

This split keeps the relational database small, leaves FASTA and annotation assets in storage designed for large files, and supports both Vercel and Cloudflare deployment targets.

## 2. Architecture

![SeqEdge Architecture](./docs/architecture.gif)

### 2.1 Delivery path

1. The application shell is served from Vercel or Cloudflare Pages.
2. Search and statistics requests are handled by Next.js API routes backed by Supabase.
3. JBrowse requests only the byte ranges required for the current locus.
4. Large genomic files remain in object storage instead of being duplicated into PostgreSQL.

## 3. Quick Start

### 3.1 Prerequisites

- Node.js `18+`
- npm
- A Supabase project
- A storage backend with CORS and HTTP range support

### 3.2 Fork and clone

```bash
git clone https://github.com/<your-account>/SeqEdge.git
cd SeqEdge
npm install
```

### 3.3 Configure environment variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_STORAGE_BASE_URL=https://huggingface.co/datasets/<user>/<repo>/resolve/main
NEXT_PUBLIC_HF_PROXY_URL=https://seqedge-hf-proxy.your-account.workers.dev
NEXT_PUBLIC_REFERENCE_ASSEMBLY=NC_045512.2
NEXT_PUBLIC_REFERENCE_DEFAULT_LOCUS=NC_045512.2:1-5000
NEXT_PUBLIC_REFERENCE_FASTA=scov2.fa
NEXT_PUBLIC_REFERENCE_FASTA_INDEX=scov2.fa.fai
NEXT_PUBLIC_REFERENCE_BED=scov2.genes.bed
NEXT_PUBLIC_REFERENCE_GFF3=scov2.genes.gff3
```

Legacy compatibility remains supported:

```bash
NEXT_PUBLIC_R2_PUBLIC_URL=https://your-bucket.your-account.r2.dev/test-data
```

Recommended production strategy:

- store large genomic files in Hugging Face Datasets;
- expose browser traffic through `NEXT_PUBLIC_HF_PROXY_URL`;
- keep Cloudflare R2 as a mirror or fallback for selected files when needed.

If your files live under a bucket prefix such as `test-data/`, include that prefix directly in `NEXT_PUBLIC_STORAGE_BASE_URL`.

### 3.4 Initialize the database

Run `schema.sql` in Supabase, then import only your real metadata and genomic annotation records.

### 3.5 Run locally

```bash
npm run dev
```

### 3.6 Deploy

Recommended production layout:

- Vercel for the primary site
- Cloudflare Pages for the mirror site
- Cloudflare Worker for Hugging Face proxying when HF-hosted files are used by JBrowse

Cloudflare Pages settings:

- build command: `npm run build:cf`
- preview command: `npm run preview:cf`
- deploy command: `npm run deploy:cf`
- output directory: `.open-next`

## 4. Current Application Behavior

### 4.1 Search and pagination

SeqEdge uses end-to-end server-side pagination for promoter queries. The page sends `limit` and `offset` to `/api/promoters`, the API applies `range()` in Supabase, and the table runs in controlled manual pagination mode.

### 4.2 Metadata filtering

Sample-level filters such as species, tissue, cohort, and BMI are resolved through a two-step query path. The API first narrows `genome_samples`, then applies the matching `sample_id` list to `predicted_promoters`.

Chinese adult BMI thresholds are centralized in `src/site-config.ts`:

- underweight: `< 18.5`
- normal: `18.5 - 24.0`
- overweight: `24.0 - 28.0`
- obese: `>= 28.0`

### 4.3 User Guide drawer

The in-app User Guide currently focuses on four sections:

1. Overview
2. Promoters & Features
3. Genome Browser
4. Data & Storage

Its final section lists the open-source components used by SeqEdge as references and acknowledgements.

## 5. Customization

### 5.1 Core files to edit

- `src/site-config.ts`: branding, default reference assembly names, default locus, BMI bands, page size, feature flags
- `.env.local`: deployment and storage configuration
- `schema.sql`: database schema and access policies

### 5.2 Storage modes

SeqEdge supports four storage modes without code changes:

1. Pure Cloudflare R2
2. Pure Hugging Face Datasets using `resolve/main`
3. Mixed hosting with relative paths for common assets and absolute `https://` URLs for very large files
4. HF proxy mode using `NEXT_PUBLIC_HF_PROXY_URL` and the Worker under `cloudflare-templates/hf-proxy/`

### 5.3 Hugging Face proxy deployment

Direct Hugging Face `resolve/main` links are often slower for JBrowse because requests may pass through redirects, Xet bridge layers, and stricter CORS handling. SeqEdge includes a Cloudflare Worker template that rewrites those requests into a stable range-friendly endpoint.

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
NEXT_PUBLIC_STORAGE_BASE_URL=https://huggingface.co/datasets/<user>/<repo>/resolve/main
NEXT_PUBLIC_HF_PROXY_URL=https://seqedge-hf-proxy.your-account.workers.dev
```

## 6. Feature Modules

- Overview: summary cards and charts
- Promoters: searchable coordinate-based records with server-side pagination
- Genome Browser: JBrowse 2 integration with synchronized navigation
- User Guide: embedded operational notes plus open-source references

## 7. Deployment Self-Check

### 7.1 Core checks

- Open `/` and confirm the site renders normally.
- Open `/api/stats` and confirm it returns `200`.
- Confirm the browser console is free of repeated storage or reference-data errors.

### 7.2 Real genome storage checks

The configured storage targets must be reachable for the deployed site:

- the FASTA file declared by `NEXT_PUBLIC_REFERENCE_FASTA`
- the corresponding FASTA index declared by `NEXT_PUBLIC_REFERENCE_FASTA_INDEX`
- any BED, GFF3, BAM, VCF, or other track files configured for JBrowse
- each corresponding index file such as `.fai`, `.bai`, `.tbi`, or `.csi`

If Cloudflare Pages or Vercel shows an empty browser panel, verify:

- build command is correct for the target platform
- output directory is `.open-next` for Cloudflare Pages
- `NEXT_PUBLIC_STORAGE_BASE_URL` points to a public CORS-enabled origin
- the configured filenames in environment variables match the deployed object keys exactly
- Supabase contains only real rows intended for publication

### 7.3 Object storage checks

- Confirm `NEXT_PUBLIC_STORAGE_BASE_URL` points to a CORS-enabled host.
- If files live under a subfolder, include that subpath in the base URL.
- For Hugging Face, confirm public links use `resolve/main`.
- If `NEXT_PUBLIC_HF_PROXY_URL` is enabled, confirm the Worker is deployed and reachable.
- Validate range requests against at least one reference index and one annotation or alignment index.

## 8. Tech Stack

- [Next.js](https://nextjs.org/docs) `15.5.21`
- [React](https://react.dev/learn) `19.2.4`
- [`@supabase/supabase-js`](https://supabase.com/docs/reference/javascript/introduction) `^2.110.7`
- [`@jbrowse/product-core`](https://jbrowse.org/jb2/) `^4.3.0`
- [`@jbrowse/react-linear-genome-view`](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view) `^3.1.0`
- [`@tanstack/react-table`](https://tanstack.com/table/latest/docs/guide/introduction) `^8.21.3`
- [ECharts](https://echarts.apache.org/handbook/en/get-started/) `^6.1.0`
- [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) `^1.20.2`
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) `^4.113.0`

### 8.1 Tool references and acknowledgements

| Tool | Version | Reference |
|---|---|---|
| [Next.js](https://nextjs.org/docs) | `15.5.21` | Official documentation |
| [React](https://react.dev/learn) | `19.2.4` | Official learning resources |
| [`@supabase/supabase-js`](https://supabase.com/docs/reference/javascript/introduction) | `^2.110.7` | Official JavaScript client documentation |
| [`@jbrowse/product-core`](https://jbrowse.org/jb2/) | `^4.3.0` | JBrowse 2 official documentation |
| [`@jbrowse/react-linear-genome-view`](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view) | `^3.1.0` | Package documentation |
| [JBrowse 2](https://jbrowse.org/jb2/) | integrated runtime | Buels R, et al. *JBrowse 2: a modular genome browser with views of synteny and structural variation*. Nature Biotechnology. 2023 |
| [`@tanstack/react-table`](https://tanstack.com/table/latest/docs/guide/introduction) | `^8.21.3` | Official documentation |
| [ECharts](https://echarts.apache.org/handbook/en/get-started/) | `^6.1.0` | Official handbook |
| [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) | `^1.20.2` | OpenNext Cloudflare documentation |
| [Wrangler](https://developers.cloudflare.com/workers/wrangler/) | `^4.113.0` | Cloudflare Workers CLI documentation |

## 9. Data Policy

### 9.1 Real-data-only runtime

SeqEdge now uses only real configured data sources. If storage or metadata backends are unreachable, the UI shows an explicit empty or error state instead of rendering fallback records.

### 9.2 Test Data

To keep the live site responsive, SeqEdge streams large genomic assets through an object-storage-style delivery path such as Cloudflare R2, Hugging Face Datasets, or an HF proxy Worker.

For local deployment, testing, or reproducible onboarding, publish a packaged test dataset through GitHub Releases.

- Download: fetch the latest `seqedge-test-data.zip` asset from the repository Releases page.
- Included files: the package should contain reference sequences such as `.fa` and `.fai`, annotation files such as `.gff3`, `.bed`, or indexed variants, and any small companion tracks used for browser validation.
- Setup: extract the archive, upload the contents to your preferred object storage, then update `NEXT_PUBLIC_STORAGE_BASE_URL` and the related `NEXT_PUBLIC_REFERENCE_*` variables so the deployed site points to those real files.

GitHub Releases are suitable for downloadable test bundles. Production browser streaming should still use a public CORS-enabled object store with range-request support.

## 10. License

Released under the license declared in this repository.
