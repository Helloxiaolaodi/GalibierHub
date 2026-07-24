# SeqEdge

![SeqEdge Screenshot](./seqedge-github-img-readme.jpg)

SeqEdge is a lightweight template for building a public genomics site with searchable metadata, an embedded JBrowse view, and direct dataset downloads.

Primary: [https://seq-edge.vercel.app](https://seq-edge.vercel.app)
Mirror: [https://seqedge.pages.dev](https://seqedge.pages.dev)

Chinese README: [README.zh-CN.md](./README.zh-CN.md)

## What Users Can Do

- Search and filter promoter records by locus, gene, score, sample, species, tissue, cohort, and BMI class.
- Open the embedded genome browser and jump directly from a promoter record to the matching region.
- Inspect promoter details in a floating, resizable panel without hiding the browser.
- Download reference bundles, release archives, and sample-level files from public storage.
- Leave public or creator-only messages, react with like/bookmark, and follow reply status in the on-page feedback area.
- Check the site uptime counter at the bottom of the page.

## Current Download Strategy

SeqEdge uses a free-tier friendly split workflow:

- Small files: show `Download`
- Large files: show `Download`, `Copy wget`, and `Copy curl`
- JBrowse streaming: use the proxy/fallback chain for indexed browser reads
- Bulk downloads: go directly to the public file host with `?download=true`

This keeps multi-GB transfers off the proxy path and is the recommended setup when large files live on Hugging Face Datasets.

## Deployment Model

SeqEdge separates three parts:

- Metadata in Supabase / PostgreSQL
- Large genome files in object storage or Hugging Face Datasets
- App UI on Vercel or Cloudflare Pages

Recommended production layout:

1. Vercel for the primary site
2. Cloudflare Pages for the mirror site
3. Cloudflare Worker for Hugging Face proxying

## Quick Start

### 1. Install

```bash
git clone https://github.com/<your-account>/SeqEdge.git
cd SeqEdge
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and replace placeholders.

Required database variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Required storage variables:

```bash
NEXT_PUBLIC_STORAGE_BASE_URL=https://huggingface.co/datasets/<user>/<repo>/resolve/main/<optional-subdir>
NEXT_PUBLIC_REFERENCE_ASSEMBLY=NC_045512.2
NEXT_PUBLIC_REFERENCE_DEFAULT_LOCUS=NC_045512.2:1-5000
NEXT_PUBLIC_REFERENCE_FASTA=scov2.fa
NEXT_PUBLIC_REFERENCE_FASTA_INDEX=scov2.fa.fai
NEXT_PUBLIC_REFERENCE_BED=scov2.genes.bed
NEXT_PUBLIC_REFERENCE_GFF3=scov2.genes.gff3
```

Optional but recommended:

```bash
NEXT_PUBLIC_HF_PROXY_URL=https://seqedge-hf-proxy.your-account.workers.dev
NEXT_PUBLIC_RELEASE_ARCHIVE_URL=https://huggingface.co/datasets/<user>/<repo>/resolve/main/releases/seqedge-release.tar.gz
NEXT_PUBLIC_RELEASE_ARCHIVE_SIZE=12.5 GB
NEXT_PUBLIC_RELEASE_ARCHIVE_MODE=cli
NEXT_PUBLIC_REFERENCE_BUNDLE_URL=https://huggingface.co/datasets/<user>/<repo>/resolve/main/reference/reference-bundle.zip
NEXT_PUBLIC_REFERENCE_BUNDLE_SIZE=180 MB
NEXT_PUBLIC_REFERENCE_BUNDLE_MODE=direct
```

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` is recommended for production API routes.
- If files live in a subfolder, include that prefix in `NEXT_PUBLIC_STORAGE_BASE_URL`.
- Direct Hugging Face reads are supported, but the Worker is the most reliable JBrowse path.

### 3. Initialize the database

Run `schema.sql` in Supabase, then import your real metadata into at least:

- `genome_samples`
- `predicted_promoters`
- `variant_index`

Creating the schema alone will not populate the homepage statistics.

### 4. Run locally

```bash
npm run dev
```

### 5. Build for production

```bash
npm run build
npm run start
```

### 6. Deploy

Vercel:

- Build command: `npm run build`
- Output: Next.js default

Cloudflare Pages:

- Build command: `npm run build:cf`
- Preview command: `npm run preview:cf`
- Deploy command: `npm run deploy:cf`
- Output directory: `.open-next`

## Genome Browser Notes

SeqEdge now probes browser storage in this order:

1. External `NEXT_PUBLIC_HF_PROXY_URL`
2. Built-in `/api/hf-proxy/<file>` route
3. Direct Hugging Face reads

If the browser still shows `Reference data unreachable`, usually one of these is wrong:

- `NEXT_PUBLIC_STORAGE_BASE_URL`
- `NEXT_PUBLIC_REFERENCE_FASTA_INDEX`
- Hugging Face dataset subdirectory
- Worker deployment or `HF_REPO_BASE`

SeqEdge also opens the first reachable annotation track automatically so the viewer does not land in `No tracks active` when real tracks are available.

## Where To Configure Downloads

- Overview download cards: `src/site-config.ts`
- Sample-level download metadata: `genome_samples.vcf_download_url`, `genome_samples.fasta_download_url`
- Large-file CLI actions: set `vcf_download_mode` or `fasta_download_mode` to `cli`

## User Guide Content

The in-app User Guide now includes:

1. Overview
2. Promoters & Features
3. Genome Browser
4. Data & Storage
5. Downloading Data
6. Community Feedback

This is where end users can learn the difference between browser downloads and CLI downloads for large files, and how to use the built-in feedback channel.

## Community Feedback

SeqEdge now includes a lightweight interaction area for research communication:

- Visitors can submit a message with name or nickname, email, optional affiliation, category, rating, and visibility.
- Messages can be `Public` or `Creator only`.
- Threads are split into `In progress` and `Completed`.
- Creator replies are shown on the site and can also trigger an email reply when the email API is configured.
- Posted and replied timestamps are displayed for each thread.
- Visitors can also leave `Like` and `Bookmark` reactions.

Required database objects for this feature are included in `schema.sql`.

Optional environment variables for admin reply and email delivery are listed in `.env.example`.

## Site Uptime

The footer now shows a live uptime counter:

`This site has been running: X d X h X m X s`

Set the start timestamp in `src/site-config.ts` under `uptime.startAt`.

## Minimal Files To Keep

Keep these for the current feature set:

- `src/`
- `schema.sql`
- `README.md`
- `README.zh-CN.md`
- `docs/data-compression-guide.md`
- `cloudflare-templates/hf-proxy/`
- `scripts/build-cloudflare.mjs`
- `public/demo-data/`
- `public/seqedge-github-img-readme.jpg`

The default template SVG assets under `public/` are not used by the current UI and can be removed safely.

## Validation

Recommended checks before push:

```bash
npm run lint
npm run build
```

If both pass with your real environment values, the repo is ready for deployment testing.
