# SeqEdge

![SeqEdge Screenshot](./seqedge-github-img-readme.jpg)

Edge-Native Genomics Database Template

An open-source template for interactive genomic and coordinate-based research databases with a serverless, storage-decoupled architecture.

Primary: [https://seq-edge.vercel.app](https://seq-edge.vercel.app)  
Mirror: [https://seqedge.pages.dev](https://seqedge.pages.dev)  
GitHub: [https://github.com/Helloxiaolaodi/SeqEdge](https://github.com/Helloxiaolaodi/SeqEdge)

Language: English | [简体中文](./README.zh-CN.md) | [Issues](https://github.com/Helloxiaolaodi/SeqEdge/issues)

> Detailed build guide: [SeqEdge Developer Notes](https://www.cnblogs.com/Helloxiaolaodi/p/21776736)

Stack: Next.js | React | Supabase | Cloudflare R2 | Hugging Face Datasets | Cloudflare Workers | JBrowse 2 | TanStack Table | ECharts

![License](https://img.shields.io/github/license/Helloxiaolaodi/SeqEdge?style=flat-square)
![Stars](https://img.shields.io/github/stars/Helloxiaolaodi/SeqEdge?style=flat-square)
![Forks](https://img.shields.io/github/forks/Helloxiaolaodi/SeqEdge?style=flat-square)
![Issues](https://img.shields.io/github/issues/Helloxiaolaodi/SeqEdge?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-15.5.21-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-2.110.7-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?style=flat-square&logo=vercel)

## 1. Overview

SeqEdge is a template repository for public-facing genomic databases that combine metadata search, coordinate-based records, interactive charts, and browser-native genome visualization. It is designed for research groups that want a deployable site without maintaining a traditional long-running backend.

The repository separates three responsibilities clearly:

- structured metadata in Supabase / PostgreSQL;
- large genomic assets in object storage;
- interactive rendering in the browser through JBrowse 2, TanStack Table, and ECharts.

That split keeps the database lean, lets BAM/CRAM/VCF/FASTA assets remain in storage built for large files, and preserves a simple deployment path for both Vercel and Cloudflare.

## 2. Architecture

![SeqEdge Architecture](./docs/architecture.gif)

### 2.1 Delivery path

1. The page shell is served from Vercel or Cloudflare Pages.
2. Search and statistics queries go to Next.js API routes backed by Supabase.
3. JBrowse requests only the byte ranges needed for the current genomic locus.
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

### 3.4 Initialize the database

Run `schema.sql` in Supabase and import your metadata tables.

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
- keep `public/demo-data` in the repository so the same-origin fallback remains available

## 4. Current Application Behavior

### 4.1 Search and pagination

SeqEdge now uses end-to-end server-side pagination for promoter queries. The page layer sends `limit` and `offset` to `/api/promoters`, the API applies `range()` in Supabase, and the TanStack table runs in controlled manual pagination mode. This avoids the earlier mismatch where the UI could show multiple client pages while only the first API slice had been fetched.

### 4.2 Phenotype filtering

Sample-level filters such as species, tissue, cohort, and BMI are resolved through a two-step query path. The API first narrows `genome_samples`, then applies the resulting `sample_id` list to `predicted_promoters`.

Chinese adult BMI thresholds are centralized in `src/site-config.ts`:

- underweight: `< 18.5`
- normal: `18.5 - 24.0`
- overweight: `24.0 - 28.0`
- obese: `>= 28.0`

### 4.3 User guide drawer

The in-app User Guide now focuses on four sections:

1. Overview
2. Promoters & Features
3. Genome Browser
4. Data & Storage

Its final section also lists the open-source components used by SeqEdge as references and acknowledgements.

## 5. Customization

### 5.1 Core files to edit

- `src/site-config.ts`: branding, assemblies, default locus, BMI bands, page size, feature flags
- `.env.local`: platform and storage configuration
- `schema.sql`: initial database schema

### 5.2 Storage modes

SeqEdge supports four storage modes without code changes:

1. Pure Cloudflare R2
2. Pure Hugging Face Datasets using `resolve/main`
3. Mixed hosting with relative paths for common assets and absolute `https://` URLs for very large files
4. HF proxy mode using `NEXT_PUBLIC_HF_PROXY_URL` and the Worker under `cloudflare-templates/hf-proxy/`

If files live under a bucket prefix such as `test-data/`, include that prefix directly in `NEXT_PUBLIC_STORAGE_BASE_URL`.

### 5.3 Hugging Face proxy deployment

Direct Hugging Face `resolve/main` links are often slower for JBrowse because requests can pass through redirects, Xet bridge layers, and stricter CORS handling. SeqEdge includes a Cloudflare Worker template that rewrites those requests into a stable range-friendly endpoint.

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
   NEXT_PUBLIC_STORAGE_BASE_URL=https://your-bucket.your-account.r2.dev/test-data
   NEXT_PUBLIC_HF_PROXY_URL=https://seqedge-hf-proxy.your-account.workers.dev
   ```

## 6. Feature Modules

- Overview: summary cards and charts
- Promoters: searchable coordinate-based records with server-side pagination
- Genome Browser: JBrowse 2 integration with synchronized navigation
- User Guide: embedded instructions plus open-source references

## 7. Deployment Self-Check

### 7.1 Core checks

- Open `/` and confirm the site renders normally.
- Open `/api/stats` and confirm it returns `200`.
- Confirm the browser console is free of repeated storage or reference-data errors.

### 7.2 Same-origin demo fallback checks

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

### 7.3 Object storage checks

- Confirm `NEXT_PUBLIC_STORAGE_BASE_URL` points to a CORS-enabled host.
- If files live under a subfolder, include that subpath in the base URL.
- For Hugging Face, confirm all public links use `resolve/main`.
- Validate range requests against at least one reference index and one alignment index.

## 8. Tech Stack

- [Next.js](https://nextjs.org/docs) `15.5.21`
- [React](https://react.dev/learn) `19.2.4`
- [`@supabase/supabase-js`](https://supabase.com/docs/reference/javascript/introduction) `^2.110.7`
- [`@jbrowse/product-core`](https://jbrowse.org/jb2/docs/) `^4.3.0`
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
| [`@jbrowse/product-core`](https://jbrowse.org/jb2/docs/) | `^4.3.0` | JBrowse 2 official documentation |
| [`@jbrowse/react-linear-genome-view`](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view) | `^3.1.0` | Package documentation |
| [JBrowse 2](https://www.nature.com/articles/s41587-023-01780-9) | integrated runtime | Buels R, et al. *JBrowse 2: a modular genome browser with views of synteny and structural variation*. Nature Biotechnology. 2023 |
| [`@tanstack/react-table`](https://tanstack.com/table/latest/docs/guide/introduction) | `^8.21.3` | Official documentation |
| [ECharts](https://echarts.apache.org/handbook/en/get-started/) | `^6.1.0` | Official handbook |
| [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) | `^1.20.2` | OpenNext Cloudflare documentation |
| [Wrangler](https://developers.cloudflare.com/workers/wrangler/) | `^4.113.0` | Cloudflare Workers CLI documentation |

## 9. Test Data and Attribution

### 9.1 Default template demo data

The repository ships a same-origin fallback demo bundle in `public/demo-data` so the browser remains usable even when external storage is temporarily unavailable or misconfigured.

### 9.2 SARS-CoV-2 validation data

Recommended citation:

- Wu F, Zhao S, Yu B, et al. *A new coronavirus associated with human respiratory disease in China*. Nature. 2020;579(7798):265-269. DOI: `10.1038/s41586-020-2008-3`

### 9.3 E. coli K-12 MG1655 validation data

Recommended citation:

- Blattner FR, Plunkett G 3rd, Bloch CA, et al. *The complete genome sequence of Escherichia coli K-12*. Science. 1997;277(5331):1453-1462. DOI: `10.1126/science.277.5331.1453`

## 10. License

Released under the license declared in this repository.
