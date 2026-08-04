<a id="readme-top"></a>

# GalibierHub

Edge-Native Genomics Database Template

**Primary:** [https://seq-edge.vercel.app](https://seq-edge.vercel.app)  
**Mirror:** [https://galibierhub.pages.dev](https://seqedge.pages.dev/)  
**GitHub:** [https://github.com/Helloxiaolaodi/GalibierHub](https://github.com/Helloxiaolaodi/GalibierHub)

Language: **English** | [简体中文](./README.zh-CN.md) | [Issues](https://github.com/Helloxiaolaodi/GalibierHub/issues)

Detailed build guide: [GalibierHub Developer Notes](https://www.cnblogs.com/Helloxiaolaodi/p/22134246)

Stack: Next.js | React | Supabase | Cloudflare R2 | Hugging Face Datasets | Cloudflare Workers | JBrowse 2 | TanStack Table | ECharts

![License](https://img.shields.io/github/license/Helloxiaolaodi/GalibierHub?style=flat-square)
![Stars](https://img.shields.io/github/stars/Helloxiaolaodi/GalibierHub?style=flat-square)
![Forks](https://img.shields.io/github/forks/Helloxiaolaodi/GalibierHub?style=flat-square)
![Issues](https://img.shields.io/github/issues/Helloxiaolaodi/GalibierHub?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-15.5.21-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-2.110.7-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?style=flat-square&logo=vercel)

## Contents

1. [Overview](#overview)
2. [What GalibierHub Includes](#what-galibierhub-includes)
3. [Architecture and Deployment Model](#architecture-and-deployment-model)
4. [Quick Start](#quick-start)
5. [Data and Download Workflows](#data-and-download-workflows)
6. [Discussion and Administrator Operations](#discussion-and-administrator-operations)
7. [Maintenance Notes](#maintenance-notes)
8. [Tech Stack and References](#tech-stack-and-references)
9. [Security Considerations](#security-considerations)
10. [Acknowledgements](#acknowledgements)
11. [License](#license)

## Recent Updates

- Downloads now includes a `Cluster Batch Download` workflow for recursively downloading an entire folder through Python and SLURM scripts, with `Global (Official)` and `Asia-Pacific (Mirror)` templates.
- The Downloads CLI modal now has Linux/macOS and Windows PowerShell tabs, one-click all-in-one command copying, and a dedicated `hfd` mirror accelerator option.
- Browser downloads preserve the original filename and automatically route Asia-Pacific visitors through the Hugging Face mirror.
- The Downloads table now shows real `Updated` dates and keeps the `Name` and `Actions` columns focused on file identity and `Download to Browser` / `CLI` actions.
- Downloads `Files:` displays the actual file count for the currently selected folder.
- The `Download & CLI Usage Guide` now covers `Download to Browser`, `CLI`, and `Cluster Batch Download` in that order, and explains that `Downloads > Records` contains every file from the Records interface.
- Records is the first folder in Downloads. Records files are exposed under `Downloads > Records` at the top of the folder list, where they support the same browse, select, export, browser download, CLI, and cluster batch workflows as other Downloads folders.
- The Records table now includes a `Download` column that jumps to `Downloads > Records` and preselects the matching sample files.
- The User Guide is concise. The user menu provides `Mark all read` for Notifications, Replies, Likes, and Following, plus `View saved profile` in Settings.
- Genome Browser borders and Records controls use the site's neutral slate button and border scheme.
- Site uptime now counts from August 1, 2026.
- A standalone Cloudflare Worker (`cloudflare-templates/supabase-keepalive`) runs every 3 days and queries Supabase to prevent the free-tier 7-day auto-suspension.

## Overview

GalibierHub currently ships with five main product surfaces:

- **Overview**: StatsChart dashboard metrics and interactive hover-flip feature cards (Search & Discovery, Genome Browser, File Distribution, Community & Moderation).
- **Records**: searchable promoter table with inline filtering, pagination, and record detail panel.
- **Genome Browser**: standalone JBrowse 2 linear genome view with fullscreen zen mode, multi-track annotation, and locus navigation accessible via the top navigation bar.
- **Downloads**: academic-grade file catalog with browser/CLI download, file preview (head 20 lines), SHA-256 checksum verification, citation export (BibTeX/RIS/DataCite), batch script generator (aria2c/wget/Python/R), and a dedicated Download & CLI Usage Guide.
- **Discussion**: public or Administrator-only discussions with image upload, likes, bookmarks, follow-up replies, and administrator moderation.
- **World Clock**: global timezone command palette (Ctrl+K) with major research hub defaults and full city search, plus sidebar widget on discussion detail pages.
- **Auth System**: dual GitHub OAuth and email/password authentication with Turnstile bot protection, split Log In / Sign Up flow, auto-saved drafts, forgot-password reset, and post-signup onboarding.
- **User Profiles**: public profile pages at /user/[username] with research tags, activity dashboards (Profile & Threads & Replies tabs), follow/unfollow system persisted to Supabase, and online-status indicators (Online / Away / Busy).
- **Notification Center**: In-app notification bell with real-time Supabase subscriptions for @mentions, replies, and likes.
- **Badge System**: Gamification with 16+ badge types covering onboarding, engagement, tech, and milestone achievements, displayed as micro-badges next to usernames.
- **Security.txt**: RFC 9116 vulnerability disclosure file at `/.well-known/security.txt`, with `/security` policy and `/acknowledgments` pages.
- **Settings & Preferences**: Protected /settings/preferences page with avatar photo upload, profile editing, email notification opt-ins, and theme switching (Light / Dark / System).

The current default schema and UI are still genomics-oriented. Template users can generalize the project later, but the repository in its present state still uses promoter- and genome-related naming in the main data surfaces.

### Preview Media

![GalibierHub logo](./docs/media/galibierhub-ui-overview.png)

*GalibierHub website logo.*

![GalibierHub Architecture](./docs/architecture.gif)

*Architecture walkthrough used in the README. Media credit: generated with **Gemini 3.1 Pro**.*

(For detailed setup guide, project naming story and in-depth technical discussion, please refer to [GalibierHub Developer Notes](https://www.cnblogs.com/Helloxiaolaodi/p/22134246). ) *

## What GalibierHub Includes

### End-user capabilities

#### Search & Discovery

- Search and filter promoter records by locus, gene, score, sample, species, tissue, cohort, and BMI class.

#### Data Visualization

- Open the embedded genome browser and jump directly from a promoter record to the matching region.
- Inspect promoter details in a floating, resizable panel without hiding the browser.
- Enter fullscreen zen mode (Esc to exit) for distraction-free genome browsing.

#### File Distribution

- Download reference bundles, release archives, and sample-level files from one unified modal.
- View browser download, `wget`, `curl`, and `hf download` commands in the same file dialog.
 
- See file name, type, size, created and updated time, download count, access mode, MD5, and SHA256 together.
- Keep SHA-256 in the Checksum tab and reveal resume-capable CLI commands behind copy buttons for large-file transfer.
- Generate `.sh` and `.bat` batch download scripts for public sample files.

#### Community & Moderation

*   **Authentication** -- GitHub OAuth or email/password with Cloudflare Turnstile bot protection.
*   **Onboarding** -- Guided profile setup after first login with research field, preferred tools, and affiliation.
*   **User profiles** -- Public `/user/[username]` pages with badges, activity feeds, and follow/unfollow.
*   **Badge system** -- Gamified reputation with bronze/silver/gold/platinum tiers earned through community contributions.
*   **World clock** -- Timezone companion panel and command-palette global time search (relevant defaults, click-outside close, `Clear` search button).
*   **Real-time notifications** -- Realtime WebSocket delivery plus a polling fallback for replies, follows, likes, @mentions, and badge unlocks.
*   **Password reset** -- Full self-service flow at `/update-password` with styled email templates via Resend.
*   **Admin dashboard** -- Total registered users, weekly sign-up trend, GitHub vs email origin chart, recent joiners, discussion/download/visitor stats, and a Badges analytics tab.
*   **View tracking** -- Per-discussion view counts synchronized to the server.
*   **Profile sync** -- Profile data persisted to Supabase and restored across devices and sessions.
*   **AI crawler controls** -- `robots.txt` blocks known AI training and SEO scrapers while allowing academic indexers; Cloudflare zone toggles are documented in `docs/cloudflare-security-configuration.md`.
*   **Password visibility** -- Show/hide toggles for the sign-in and create-account password fields.
*   **Consistent usernames** -- The same profile username appears across every page; email sign-ups default to the part of the email before `@`.
*   **Comment reactions** -- Like counts on posts and individual replies update in real time without red heart icons.
*   **Discussion views & profiles** -- Real per-post view counts, hover profile cards with online status and follow/unfollow, plus working `/user/[username]` profile and activity pages.
*   **Notification events** -- Follows, unfollows, comment likes, and @mentions notify the target user through the in-app notification center.
*   **Timeline interactions** -- The timeline rail is draggable, stays synchronized with browser scrolling, and shows the dates of the post and every reply.

- Submit public or Administrator-only discussions from the `Discussion` tab with a floating rich-text Markdown composer (bold, italic, code blocks, quotes, links, lists, image upload).
- Toggle between Edit and Preview modes before posting, with full Markdown rendering including syntax-highlighted code blocks.
- Upload images via the toolbar and view them in a zoomable lightbox by clicking.
- Sign in with the allowed GitHub Administrator account to publish official replies, hide/delete posts, and pin discussions.
- Upload images in discussions and open posted images in a zoomable lightbox.
- Like and unlike posts with numeric like toggles, and share discussions via a modal with Twitter/X, Facebook, Email, LinkedIn, and copy-link options.
- Like and unlike individual replies with numeric like controls; every message count updates in real time.
- Use the ordered-list toolbar button to insert `1.` and cycle to `2.`, `3.` as you add list items.
- Filter by `All Categories`, `Issue`, or `Tutorials`; only administrators can post new `Tutorials`, and the Downloads guide is at `/docs/download-cli`.
- Filter discussions by status (All, In Progress, Resolved) and sort by Newest, Oldest, or Most Liked.
- Earn badges through community participation: Ice Breaker (first post), Nice Reply (10 likes), Markdown Master (code blocks), and 13+ more.
- See a footer counter that shows live site uptime, cumulative unique visitors, views, links, and participants.
- macOS-inspired design language with glass-morphism navigation, Apple gray (#F5F5F7) backgrounds, custom scrollbar, smooth focus rings, and subtle button micro-interactions.
 

## Architecture and Deployment Model

GalibierHub separates three layers:

- Metadata in Supabase / PostgreSQL
- Large genome files in object storage or Hugging Face Datasets
- App UI on Vercel or Cloudflare Pages

Recommended production layout:

1. Vercel for the primary site
2. Cloudflare Pages for the mirror site
3. Cloudflare Worker for Hugging Face proxying

### Current download strategy

GalibierHub uses a free-tier-friendly split workflow:

- Single-file downloads open one modal that shows browser download plus `wget -c`, `curl -L -C -`, and `hf download`.
- Large files are presented with resume-capable CLI commands, and `hf download` is the recommended option for large Hugging Face assets.
- JBrowse streaming uses the proxy and fallback chain for indexed browser reads.
- Bulk downloads generate `.sh` and `.bat` scripts for public files only.
- The modal shows download count, MD5, SHA256, access mode, hidden/password badges, and region hints.
- If a file is stored in a private Supabase bucket, GalibierHub can mint a signed URL through `/api/download-metadata/resolve`.

This keeps multi-GB transfers off the proxy path, preserves resumable CLI flows for end users, and allows genuinely private delivery when large files are moved from public storage to Supabase private storage.

## Quick Start

### 1. Install

```bash
git clone https://github.com/<your-account>/GalibierHub.git
cd GalibierHub
npm install
```

### 2. Configure environment variables

#### Minimal Setup (for local development)

Copy `.env.example` to `.env.local` and replace placeholders.

The bare minimum to compile and render the homepage:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
NEXT_PUBLIC_STORAGE_BASE_URL=https://huggingface.co/datasets/<user>/<repo>/resolve/main/<optional-subdir>
NEXT_PUBLIC_REFERENCE_ASSEMBLY=NC_045512.2
NEXT_PUBLIC_REFERENCE_DEFAULT_LOCUS=NC_045512.2:1-5000
```

#### Full Production Setup

Add these for genome browser, downloads, authentication, and email:

Required genome storage variables:

```bash
NEXT_PUBLIC_REFERENCE_FASTA=Records/Reference_Genomes/reference.fasta
NEXT_PUBLIC_REFERENCE_FASTA_INDEX=Records/Reference_Genomes/reference.fasta.fai
NEXT_PUBLIC_REFERENCE_BED=Records/Reference_Genomes/reference.bed
NEXT_PUBLIC_REFERENCE_GFF3=Records/Reference_Genomes/annotation.gff3
```

Optional but recommended:

```bash
NEXT_PUBLIC_HF_PROXY_URL=https://galibierhub-hf-proxy.your-account.workers.dev
NEXT_PUBLIC_RELEASE_ARCHIVE_URL=https://huggingface.co/datasets/<user>/<repo>/resolve/main/releases/galibierhub-release.tar.gz
NEXT_PUBLIC_RELEASE_ARCHIVE_SIZE=12.5 GB
NEXT_PUBLIC_RELEASE_ARCHIVE_MODE=cli
NEXT_PUBLIC_REFERENCE_BUNDLE_URL=https://huggingface.co/datasets/<user>/<repo>/resolve/main/reference/reference-bundle.zip
NEXT_PUBLIC_REFERENCE_BUNDLE_SIZE=180 MB
NEXT_PUBLIC_REFERENCE_BUNDLE_MODE=direct
```

Optional Administrator-reply and email variables:

```bash
GITHUB_ADMIN_USERNAME=your-github-login
NEXT_PUBLIC_GITHUB_ADMIN_USERNAME=your-github-login
FEEDBACK_EMAIL_API_URL=https://your-mail-service.example/send
FEEDBACK_EMAIL_API_KEY=your_mail_api_key
FEEDBACK_EMAIL_TO=owner@example.org
```

Important notes:

- `SUPABASE_SERVICE_ROLE_KEY` is required for Administrator-only write actions such as hiding or showing files in `Downloads`, saving `download_metadata`, issuing private signed URLs, pinning or hiding discussions, deleting discussions, posting official discussion replies, and hiding or deleting follow-up replies.
- Get it from Supabase Dashboard -> **Settings** -> **API** -> **Project API keys** -> `service_role`.
- Keep it server-side only. Never expose it through any `NEXT_PUBLIC_*` variable.
- Without a new deployment, the current build does not receive the new value.
- If files live in a subfolder, include that prefix in `NEXT_PUBLIC_STORAGE_BASE_URL`.
- Direct Hugging Face reads are supported, but the Worker is the most reliable JBrowse path.
- To enable Administrator replies, enable GitHub auth in Supabase and set both `GITHUB_ADMIN_USERNAME` and `NEXT_PUBLIC_GITHUB_ADMIN_USERNAME` to the same login.

### 3. Initialize the database

Run `schema.sql` in Supabase SQL Editor, then import your real metadata into at least:

- `genome_samples`
- `predicted_promoters`
- `variant_index`

For the current feature set, `schema.sql` also needs to create the interaction and download-control objects used by the live UI:

- `site_feedback`
- `feedback_comments`
- `site_reactions`
- `site_visitors`
- `download_metadata`
- storage bucket and policies for `feedback-images`

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

## Data and Download Workflows

### Where to configure downloads

- Featured download cards on the Overview tab: `src/site-config.ts`
- Sample-level download metadata: `genome_samples.vcf_download_url`, `genome_samples.fasta_download_url`, `genome_samples.gb_download_url`, `genome_samples.bed_download_url`, `genome_samples.gff3_download_url`, and related `*_download_mode` fields
- Unified download metadata model and CLI generation: `src/lib/download-info.ts`
- Single-file modal behavior and Administrator edit controls: `src/components/download-actions.tsx`
- Batch script generation for public entries: `src/components/promoter-table.tsx` and `/api/samples/batch`
- Dedicated site-wide download catalog with hierarchical folder browsing: `src/components/download-catalog-panel.tsx` and `/api/download-catalog`
- Private signed-URL resolution: `/api/download-metadata/resolve` backed by the `download_metadata` table

### What the Downloads view now supports

- Breadcrumb navigation such as `Downloads / seqedge-data / Records / Variant_Calling_VCF`, where every parent level remains clickable.
- A compact control bar that combines folder search, `Copy Folder CLI`, `Export Manifest CSV`, a README button, batch download, and grid or table view switching.
- A table view with sortable `Name`, `Size`, `Updated`, and `Actions` columns for directories that would become unwieldy in card mode.
- A denser grid view that still shows size and updated time so card browsing does not hide basic metadata.
- Split single-file actions into separate browser download and CLI/details entry points.
- Manifest export with stable machine-readable columns: `Directory_Path`, `File_Name`, `File_Type`, `Size_Bytes`, `Direct_URL`, and `SHA-256`.
- Manifest CSV and CLI/checksum dialogs resolve real SHA-256 values from catalog metadata.
- The consolidated `Tutorials` menu exposes `View all Tutorials` and `Download & CLI Usage Guide`, with the guide at `/docs/download-cli`.
- Pagination with 20 files per page, so large directories stay scannable.
- Batch selection with checkboxes and a `Download Selected` button that shows browser download, `wget`, and `curl` commands for the selected files.
- A README button that dynamically generates a directory overview listing all files with sizes and dates.
- `Records` is the first folder in Downloads. It contains the Records demo dataset in three subfolders: `Reference_Genomes`, `Variant_Calling_VCF`, and `ML_Ready_FASTA`, with the same browse, select, export, browser download, CLI, and cluster batch workflows as other folders.

### What the download modal now exposes

For public files with a stable raw URL, the `Download options` modal now uses a tabbed structure exposing:

- **Download & CLI**: Browser download plus reveal-on-demand copy buttons for direct URLs and Global (Official) or Asia-Pacific (Mirror) resumable commands.
- **File Preview**: Head preview (first 20 lines) for text-based files (FASTA, GFF3, CSV, TSV, R scripts) using HTTP Range Requests with syntax highlighting.
- **Checksum**: SHA-256 hash display with a copyable terminal verification command.
- **Cite Dataset**: BibTeX, RIS, DataCite, and Plain Text citation format export.
- **Batch Script**: Generate `.sh` and `.bat` download scripts for public sample files.

A static `/docs/download-cli` page provides browser download, CLI, checksum, and download-tool guidance.

For a Records sample file such as `CNhs13076.vcf.gz`, that means the modal can show both the official route and the Asia-friendly mirror route without changing the dataset path itself.

Official route:

```bash
wget -c -O "CNhs13076.vcf.gz" "https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/Records/Variant_Calling_VCF/CNhs13076.vcf.gz?download=true"
curl -L -C - -o "CNhs13076.vcf.gz" "https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/Records/Variant_Calling_VCF/CNhs13076.vcf.gz?download=true"
hf download Helloxiaolaodi/seqedge-data Records/Variant_Calling_VCF/CNhs13076.vcf.gz --repo-type dataset --local-dir .
```

Asia-Pacific mirror route:

```bash
wget -c -O "CNhs13076.vcf.gz" "https://hf-mirror.com/datasets/Helloxiaolaodi/seqedge-data/resolve/main/Records/Variant_Calling_VCF/CNhs13076.vcf.gz?download=true"
curl -L -C - -o "CNhs13076.vcf.gz" "https://hf-mirror.com/datasets/Helloxiaolaodi/seqedge-data/resolve/main/Records/Variant_Calling_VCF/CNhs13076.vcf.gz?download=true"
HF_ENDPOINT=https://hf-mirror.com hf download Helloxiaolaodi/seqedge-data Records/Variant_Calling_VCF/CNhs13076.vcf.gz --repo-type dataset --local-dir .
```

This keeps the UI aligned with real network conditions.

### Add a Hugging Face file to GalibierHub

The current codebase supports three practical Hugging Face integration points:

1. A homepage featured download card
2. A sample-level download entry shown inside the record detail panel and detail page
3. The dedicated `Downloads` tab, which lets users browse downloadable files by folder level in the path hierarchy and opens the same unified download modal

#### 1. Use the correct direct file URL

Do not paste the Hugging Face page URL that contains `/blob/main/`.

- Page URL example: `https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/blob/main/Records/Variant_Calling_VCF/CNhs13076.vcf.gz`
- Direct file URL example: `https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/Records/Variant_Calling_VCF/CNhs13076.vcf.gz`

GalibierHub now normalizes common Hugging Face `blob` links to `resolve` links, but you should still store the direct file URL in your database and environment variables.

#### 2. Show the file on the homepage

Set the featured archive environment variables:

```bash
NEXT_PUBLIC_RELEASE_ARCHIVE_LABEL=Download Records Reference Genome
NEXT_PUBLIC_RELEASE_ARCHIVE_DESCRIPTION=Public Hugging Face Records dataset package for reference, variant, and sequence-file delivery.
NEXT_PUBLIC_RELEASE_ARCHIVE_URL=https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/Records/Reference_Genomes/reference.fasta
NEXT_PUBLIC_RELEASE_ARCHIVE_SIZE=~700 MB
NEXT_PUBLIC_RELEASE_ARCHIVE_MODE=cli
```

This powers the featured card on the Overview tab and opens the unified download modal. The same file can also appear in the dedicated `Downloads` tab when it is present in the site-wide catalog, where visitors browse folders level by level from the dataset root.

#### 3. Show the same file as a sample-level download entry

The current UI renders these sample-level file slots in both the floating detail panel and the standalone detail page:

- `vcf_download_url`
- `fasta_download_url`
- `gb_download_url`
- `bed_download_url`
- `gff3_download_url`

For the Records demo dataset, set the sample VCF and FASTA slots to the matching files under `Records/Variant_Calling_VCF` and `Records/ML_Ready_FASTA`. The same folder and file are then available from the Downloads catalog.

Example SQL:

```sql
update genome_samples
set vcf_download_url = 'https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/Records/Variant_Calling_VCF/CNhs13076.vcf.gz',
    fasta_download_url = 'https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/Records/ML_Ready_FASTA/CNhs13076.fasta',
    vcf_download_mode = 'cli',
    fasta_download_mode = 'cli'
where sample_id = 'CNhs13076';
```

You can also attach the same file to the dedicated `Downloads` tab through `download_metadata`, so the site exposes one consistent single-file modal whether the visitor enters from Overview, Records, or Downloads.

#### 4. Add hidden, password, and private-delivery metadata

If the file is public on Hugging Face, you can still attach site-level metadata and UI controls through `download_metadata`, for example custom label, description, hashes, hidden flag, and password prompt.

```sql
insert into download_metadata (
  download_key,
  custom_label,
  custom_description,
  custom_file_type,
  custom_size_bytes,
  storage_provider,
  hidden,
  md5_checksum,
  sha256_checksum
)
values (
  'https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/Records/Variant_Calling_VCF/CNhs13076.vcf.gz',
  'CNhs13076 Variant Calls (VCF)',
  'Public Hugging Face Records sample file exposed through the GalibierHub unified download modal.',
  'VCF (.vcf.gz)',
  1024,
  'public_url',
  false,
  null,
  null
)
on conflict (download_key) do update set
  custom_label = excluded.custom_label,
  custom_description = excluded.custom_description,
  custom_file_type = excluded.custom_file_type,
  custom_size_bytes = excluded.custom_size_bytes,
  storage_provider = excluded.storage_provider,
  hidden = excluded.hidden,
  md5_checksum = excluded.md5_checksum,
  sha256_checksum = excluded.sha256_checksum;
```

Important: for a public Hugging Face `resolve` URL, hidden/password remain only site-level UI controls. They do not stop direct anonymous download if someone already knows the public URL.

#### 5. When you need real private downloads

For actual gated delivery, store the file in a private Supabase bucket and set the matching `download_metadata.storage_provider` to `supabase_private`. GalibierHub then resolves the file through `/api/download-metadata/resolve` and returns a short-lived signed URL.

That is the only fully implemented private-download path in the current codebase.

### Uploading data to Hugging Face

GalibierHub hosts large data files such as release archives, reference bundles, and sample-level files on a Hugging Face dataset repository, by default `https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data`.

### Records demo data and sources

The current `Records` demo dataset is exposed in `Downloads > Records` as the first folder. It stores files under three subfolders:

- `Records/Reference_Genomes/`: `reference.fasta` and `annotation.gff3`
- `Records/Variant_Calling_VCF/`: 12 sample VCF files, one per allowed Records sample
- `Records/ML_Ready_FASTA/`: 12 sample FASTA files, one per allowed Records sample

The 12 demo samples are `CNhs13076`, `CNhs13080`, `CNhs13195`, `CNhs13202`, `CNhs13203`, `CNhs13204`, `CNhs13205`, `CNhs13206`, `CNhs13207`, `CNhs13208`, `CNhs13215`, and `CNhs13216`. Each sample has a `.vcf.gz` file under `Variant_Calling_VCF` and a `.fasta` file under `ML_Ready_FASTA`, for a total of 24 sample files plus the reference FASTA and GFF3. These are public test files converted from FANTOM5 human primary-cell CAGE data (hg19), cohort `FANTOM5 human.primary_cell.hCAGE`, platform `HeliScope CAGE`:

- FANTOM5: https://fantom.gsc.riken.jp/5/
- FANTOM5 reference publication: https://www.nature.com/articles/sdata2017112

Records rows still open their locus in Genome Browser when the record itself is clicked. The new `Download` column and selected-row batch actions route the matching files to `Downloads > Records`, where the destination folder is expanded and the corresponding files are checked, highlighted, and scrolled into view.

#### 1. Install the CLI

The `hf` command is bundled with `huggingface_hub`.

```bash
pip install -q "huggingface_hub"
```

On Windows the executable may land in the per-user `Scripts` folder. Either add that folder to PATH or call it by full path.

#### 2. Log in

```bash
hf auth login
# or set it as an environment variable:
export HF_TOKEN=hf_xxxxxxxxxxxx   # Linux/macOS
$env:HF_TOKEN = "hf_xxxxxxxxxxxx" # Windows PowerShell
```

Verify with `hf auth whoami`.

#### 3. Upload a file or folder

```bash
hf upload <namespace/dataset-name> <local-path> <path-in-repo> --repo-type dataset
```

Example:

```bash
hf upload Helloxiaolaodi/seqedge-data "E:\data\CNhs13076.vcf.gz" "Records/Variant_Calling_VCF/CNhs13076.vcf.gz" --repo-type dataset
```

#### 4. Resumable transfer

Both `hf upload` and `hf download` reuse already transmitted staging data. If a run times out or a network error appears, simply run the same command again and it continues.

#### 5. Acceleration and the Xet engine

```bash
export HF_XET_HIGH_PERFORMANCE=1    # Linux/macOS
$env:HF_XET_HIGH_PERFORMANCE = "1"  # Windows PowerShell
```

If your proxy cannot complete the TLS handshake to `*.xethub.hf.co`, fall back to the compatible HTTP channel:

```bash
export HF_HUB_DISABLE_XET=1         # Linux/macOS
$env:HF_HUB_DISABLE_XET = "1"       # Windows PowerShell
```

#### 6. Network and proxy tips

Hugging Face stores long-term data in AWS S3 in the US-East region. From Asia, a United States proxy node usually performs much better than a local or nearby node.

```bash
export HTTP_PROXY=http://127.0.0.1:7897 HTTPS_PROXY=http://127.0.0.1:7897   # Linux/macOS
$env:HTTP_PROXY="http://127.0.0.1:7897"; $env:HTTPS_PROXY="http://127.0.0.1:7897" # Windows PowerShell
```

Confirm the proxy is actually taking effect before uploading:

```bash
curl -I https://huggingface.co
```

#### 7. Downloading large files for users

For multi-hundred-MB to GB files prefer the HF CLI:

```bash
pip install -q "huggingface_hub"
hf download Helloxiaolaodi/seqedge-data Records/Variant_Calling_VCF/CNhs13076.vcf.gz --repo-type dataset --local-dir .
```

Classic commands also resume:

```bash
wget -c -O <name> "<resolve url>"
curl -L -C - -o <name> "<resolve url>"
```

For users in China and some Asia-Pacific networks, the mirror route may be materially more reliable than the official domain. GalibierHub therefore exposes both command sets in the modal.

### Genome browser notes

For best JBrowse performance, configure a Cloudflare Worker proxy. GalibierHub probes in order:

1. External `NEXT_PUBLIC_HF_PROXY_URL`
2. Built-in `/api/hf-proxy/<file>` route
3. Direct Hugging Face reads

If the browser still shows `Reference data unreachable`, usually one of these is wrong:

- `NEXT_PUBLIC_STORAGE_BASE_URL`
- `NEXT_PUBLIC_REFERENCE_FASTA_INDEX`
- Hugging Face dataset subdirectory
- Worker deployment or `HF_REPO_BASE`

GalibierHub also opens the first reachable annotation track automatically so the viewer does not land in `No tracks active` when real tracks are available.

## Discussion and Administrator Operations

### Discussion module

GalibierHub includes a lightweight interaction area for research communication:

- Click the `Discussion` tab to browse discussions and open the floating `New Discussion` composer.
- The composer now combines a Markdown editor, a formatting toolbar, and `Write` / `Preview` tabs so users can stay in plain text while still getting code blocks, quotes, lists, tables, and image-friendly formatting.
- Messages support a title, name or nickname, email, optional affiliation, category, rating, and visibility.
- Messages can be `Public` or `Administrator only`.
- The `Discussion` tab shows discussions split into `In progress` and `Completed`.
- Discussions can be sorted, including a `Most liked` view.
- The left-side summary has been compacted into badges so more horizontal space stays available for real discussion titles and long technical logs.
- Every posted discussion and every follow-up comment is rendered back on the site inside the same discussion view.
- Administrator replies appear on the site and are shown inline in the discussion once saved.
- Follow-up comments from visitors remain visible under the discussion and are loaded from `feedback_comments`.
- Administrators can pin or unpin discussions in both `In progress` and `Completed`, hide or show discussions, and permanently delete discussions after signing in with the configured GitHub account.
- Administrators can also hide, show, and delete follow-up replies on individual discussions.
- Hidden discussions and hidden replies remain visible to the Administrator after sign-in so moderation can be reversed from the same UI, while public visitors continue to see only visible content.
- New top-level discussions send an Administrator notification email whether the discussion is `Public` or `Administrator only`.
- New follow-up comments in an existing discussion also send an Administrator notification email.
- Administrator moderation actions and official replies are restricted to the GitHub account matching `GITHUB_ADMIN_USERNAME`, while the Administrator UI in the browser also expects `NEXT_PUBLIC_GITHUB_ADMIN_USERNAME` to match the same login.
- Posted and replied timestamps are displayed for each discussion.
- Visitors can leave `Like` and `Bookmark` reactions.
- Image uploads show success or failure feedback during submission.

Required database objects for this feature are included in `schema.sql`. Required environment variables are listed in `.env.example`.

### Administrator reply setup

To let the site owner sign in and moderate discussions from the browser:

#### 1. Enable GitHub Auth in Supabase

In Supabase Dashboard, go to **Authentication** -> **Sign In / Providers**. Find **GitHub** in the provider list and enable **Sign in with GitHub**.

#### 2. Configure Supabase Auth URLs

1. In Supabase Dashboard, go to **Authentication** -> **URL Configuration**.
2. Set **Site URL** to your production domain, for example `https://seq-edge.vercel.app`.
3. Under **Redirect URLs**, add all deployed domains:
   - `https://seq-edge.vercel.app`
   - `https://seq-edge.vercel.app/**`
   - `https://galibierhub.pages.dev`
   - `https://galibierhub.pages.dev/**`
4. Save.

If the Site URL is left as `http://localhost:3000`, OAuth sign-in will redirect users there in production.

#### 3. Get GitHub OAuth credentials

1. Go to GitHub -> **Settings** -> **Developer settings** -> **OAuth Apps** -> **New OAuth App**.
2. Set an application name such as `GalibierHub Auth`.
3. Set **Homepage URL** to your production URL or local dev URL.
4. Set **Authorization callback URL** to `https://<your-project>.supabase.co/auth/v1/callback`.
5. Register the application and generate a client secret.
6. Copy the **Client ID** and **Client Secret** into Supabase and save.

#### 4. Configure environment

Set both `GITHUB_ADMIN_USERNAME` and `NEXT_PUBLIC_GITHUB_ADMIN_USERNAME` in `.env.local` or your deployment dashboard to the same GitHub login that may post official replies and use the moderation controls.

### Email notification setup (Resend)

GalibierHub uses [Resend](https://resend.com) to deliver feedback notification emails to the site Administrator.

When configured, the current implementation sends:

- an Administrator notification email for each new top-level discussion;
- that top-level discussion notification also covers `Administrator only` discussions, not only public discussions;
- an Administrator notification email for each new follow-up comment in a discussion;
- a visitor reply email when the Administrator posts an official reply and the visitor supplied an email address.

#### Test mode

1. Sign up at [resend.com](https://resend.com) and open **API Keys**.
2. Create a new API key.
3. Use the test sender address `onboarding@resend.dev`.
4. In test mode, emails are only delivered to your own verified email address.

#### Environment variables

```bash
FEEDBACK_EMAIL_API_URL=https://api.resend.com/emails
FEEDBACK_EMAIL_API_KEY=re_xxxxxxxxxxxx
FEEDBACK_EMAIL_TO=owner@example.org
```

#### Moving to production

To send reply emails to any visitor, you need a verified custom domain in Resend. If you deploy only on `pages.dev` or `vercel.app`, you do not control those DNS zones, so you still need your own registered domain for production email sending.

## Maintenance Notes

### Repository structure that fork users usually care about

- `src/`: main application code
- `public/`: static assets
- `docs/`: README media and project notes
- `schema.sql`: database schema and related SQL objects
- `cloudflare-templates/hf-proxy/`: Cloudflare Worker proxy template
- `cloudflare-templates/supabase-keepalive/`: Cloudflare Worker keep-alive template
- `scripts/`: project utility scripts

### Minimal files to keep

Keep these for the current feature set:

- `src/`
- `schema.sql`
- `README.md`
- `README.zh-CN.md`
- `cloudflare-templates/hf-proxy/`
- `cloudflare-templates/supabase-keepalive/`
- `scripts/`

Default template SVG assets under `public/` that are not used by your deployment can be removed.

### Site uptime

The footer shows a live uptime counter together with a cumulative visitor counter:

`Site uptime: X d X h X m X s | Visitors: N`

`src/components/site-uptime.tsx` reads the configured start timestamp for the uptime display and also calls `/api/visitors` to show the cumulative unique visitor count derived from a persistent browser visitor id stored in `localStorage` and hashed before insertion into `site_visitors`. This metric is intentionally closer to `Visitors` than to `Page views`: refreshing the same browser profile should usually not increment the count again, while an incognito or private window will usually be counted separately because it starts from isolated storage. First-time visits can still be counted with the anonymous Supabase key, while the service-role key additionally allows refreshing `last_seen_at` for repeat visits.

Set the start timestamp in `src/site-config.ts` under `uptime.startAt`.

### Supabase keep-alive worker

The standalone Cloudflare Worker at `cloudflare-templates/supabase-keepalive` prevents a free Supabase project from being paused after 7 days without activity. Its cron trigger runs at `00:00 UTC` every 3 days (`0 0 */3 * *`) and performs one lightweight Supabase REST `SELECT id ... limit=1` against `genome_samples` with the anonymous key.

Deploy it once from the template directory:

```bash
cd cloudflare-templates/supabase-keepalive
npx wrangler login
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put KEEPALIVE_SECRET
npx wrangler deploy
```

Use the Supabase project URL and anon key, not the service-role key. The optional `KEEPALIVE_SECRET` protects the manual trigger endpoint. If your main Supabase table has a different name, set `SUPABASE_KEEPALIVE_TABLE` as a Worker variable before deploying.

### Validation

Recommended checks before push:

```bash
npm run lint
npm run build
```

If both pass with your real environment values, the repo is ready for deployment testing.

## Security Considerations

Per-file **Hide** and **Download password** controls are only genuine access control when the file is delivered through the signed-URL path. In the current codebase, that real protected flow is implemented for entries whose `download_metadata.storage_provider` is `supabase_private`: the site verifies optional passwords and then mints a short-lived Supabase signed URL.

If the underlying file still lives on a publicly readable Hugging Face dataset repository, hide/password remain an in-page convenience only. Anyone who knows a `https://huggingface.co/datasets/<user>/<repo>/resolve/main/<path>` URL can fetch it directly with `wget`, `curl`, or `hf download`, bypassing the site entirely.

If you need real access control, choose one of:

- Keep large files in a private Supabase Storage bucket and serve signed, time-limited URLs generated by an authenticated API route.
- Set the Hugging Face dataset repository to private and accept that public website downloads stop working until you add your own gated proxy layer.
- Move sensitive files to a provider with built-in gating.

In short: public HF URL plus hide/password only discourages casual on-site download; private signed storage prevents direct anonymous download.


### Anti-Bot Defense Layers

- **Turnstile**: Cloudflare Turnstile (Managed mode, 1M verifications/month free) is deployed on login, sign-up, feedback submission, download triggers, and image upload. The client widget (src/components/turnstile-widget.tsx) renders an always-visible managed checkbox ("Verify you are human"); tokens are verified server-side via src/lib/anti-bot.ts calling the Cloudflare siteverify endpoint. A dev fallback token is used in local development without a real site key.
- **Rate Limiting**: Primary: Cloudflare WAF Rate Limiting Rules on /api/search, /api/export, and other heavyweight paths (configured in the Cloudflare Dashboard). Secondary: an in-memory rate limiter in Next.js middleware (src/middleware.ts) provides edge-level fallback with configurable windows.
- **Honeypot Field**: A visually hidden company form field detects auto-fill bots. If filled, the submission is silently accepted by the route handler but discarded by middleware before reaching Supabase.
- **Time-Trap**: Each form POST carries a _rendered_at timestamp. Middleware rejects submissions arriving less than 2 seconds after page load, blocking automated POST requests that never rendered the browser UI.
- **Cursor-Based Pagination**: Search endpoints use cursor (UUID) pagination rather than deep SQL OFFSET, preventing OFFSET 100000-style database scraping. The cursor is exposed as 
extCursor in API responses for paginated consumption.

### Anti-Crash Architecture

- **Supavisor Pool**: All Supabase connections go through *.pooler.supabase.com:6543 (transaction mode), not the direct db.*.supabase.co:5432 endpoint, to avoid the 60-connection ceiling on Supabase Free.
- **Singleton Supabase Client**: src/utils/supabase.ts creates a single Supabase client instance with persistSession: false, reused across all API routes rather than instantiated per-request.
- **Cache Headers**: Read endpoints (/api/promoters, /api/samples, /api/download-catalog) emit Cache-Control: public, s-maxage=300, stale-while-revalidate=600, allowing Cloudflare CDN to serve repeated identical queries without forwarding them to Vercel or Supabase.
- **R2 Signed URLs**: Large binary downloads (FASTQ, BAM, VCF, reference archives) are delivered via Cloudflare R2 pre-signed URLs with a 60-second TTL. Vercel never proxies file bytes; bandwidth stays within Cloudflare's free tier.
- **Supabase Keep-Alive**: A standalone Cloudflare Worker (`cloudflare-templates/supabase-keepalive`) uses a cron trigger to query Supabase every 3 days, preventing free-tier 7-day inactivity auto-suspension. The existing Vercel `/api/cron/heartbeat` route remains available as a secondary option.
- **Materialized Views**: Heavy aggregate queries (per-species counts, yearly publication stats) use pre-computed materialized views refreshed by cron rather than ad-hoc COUNT(*) on base tables, keeping Nano-instance CPU within budget.


### Security Headers & CORS

- **Content-Security-Policy**: A strict CSP (configured in `next.config.ts`) restricts script sources, style sources, image sources, and connect sources to known domains only. This neutralizes most XSS injection vectors.
- **HSTS & Frame Protections**: `Strict-Transport-Security` with a 63072000-second max age ensures HTTPS-only access. `X-Frame-Options: DENY` prevents clickjacking via iframe embedding.
- **CORS Middleware**: Next.js middleware restricts `Access-Control-Allow-Origin` to the production domain and localhost, blocking unauthorized cross-origin API calls. COOP and CORP headers further isolate the browsing context.

### Input Validation & Database Enforcement

- **Zod Schema Validation**: All API route handlers validate incoming query parameters, request bodies, and URL params using Zod schemas before any database interaction. Malformed inputs return 400 without touching the database.
- **Row-Level Security (RLS)**: `schema.sql` enforces RLS policies on all public-facing tables. Anonymous users can only `SELECT`; `INSERT`, `UPDATE`, and `DELETE` are locked to the `service_role`. This ensures that even if the anon key is extracted from the browser, raw Supabase REST API calls cannot modify data.
- **Service Role Isolation**: The `SUPABASE_SERVICE_ROLE_KEY` is server-only (never prefixed with `NEXT_PUBLIC_`). Only authenticated API routes and server-side utilities can use it, providing defense-in-depth for admin operations.

### API Key & Programmatic Access

- **api_keys Table**: schema.sql defines an pi_keys table (key_hash, label, contact_email, 
ate_limit_rpm, is_active) with RLS policies that restrict all access to the service_role. Researchers receive API keys for programmatic bulk retrieval.
- **Dual Channel**: Browser users pass through Turnstile to route handler. API key holders pass through X-API-Key header to per-key rate limiter (middleware) to route handler. Both channels are independently tracked and throttled, separating human browsing from machine-to-machine access.

### Infrastructure Security Additions

- **security.txt**: public/security.txt provides an RFC 9116 vulnerability disclosure contact and canonical URL.
- **robots.txt**: public/robots.txt blocks AI training crawlers (GPTBot, anthropic-ai, CCBot, PerplexityBot) and SEO scrapers (AhrefsBot, SemrushBot) while allowing academic crawlers (Google Scholar, Semantic Scholar, Internet Archive).
- **Dependabot**: .github/dependabot.yml enables automated dependency vulnerability scanning and PR-based version bumping for npm packages and GitHub Actions.


## Tech Stack and References

GalibierHub builds on an open-source stack for UI rendering, data access, browser-based reference viewing, and deployment.

| Tool | Version | Function | Reference |
| --- | --- | --- | --- |
| [Next.js](https://nextjs.org/docs) | `15.5.21` | App framework and runtime | Official documentation |
| [React](https://react.dev/learn) | `19.2.4` | Component rendering and client UI state | Official learning docs |
| [`@supabase/supabase-js`](https://supabase.com/docs/reference/javascript/introduction) | `^2.110.7` | Database, auth, and storage client access | Supabase JavaScript client docs |
| [`@jbrowse/product-core`](https://jbrowse.org/jb2/docs/) | `^4.3.0` | Embedded reference browser core | JBrowse 2 docs |
| [`@jbrowse/react-linear-genome-view`](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view) | `^3.1.0` | React wrapper for the linear browser view | npm package page |
| [`@tanstack/react-table`](https://tanstack.com/table/latest/docs/guide/introduction) | `^8.21.3` | Record table rendering and interactions | Official docs |
| [ECharts](https://echarts.apache.org/handbook/en/get-started/) | `^6.1.0` | Summary charts and dashboard visuals | Official handbook |
| [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) | `^1.20.2` | Cloudflare build adapter | OpenNext Cloudflare docs |
| [Wrangler](https://developers.cloudflare.com/workers/wrangler/) | `^4.113.0` | Cloudflare deployment CLI | Cloudflare Workers CLI docs |

Additional community link:

- [LINUX DO](https://linux.do/) - A next-generation Linux community


## Acknowledgements

### Repository builders

This GalibierHub repository has been jointly built and iterated by the GitHub accounts **Helloxiaolaodi** and **yangsanduo**. Both accounts belong to the same project owner and are used as parallel maintainer identities for this repository and its surrounding deployment workflow.

### AI tools used during repository construction

GalibierHub has also been developed with support from the following AI tools during planning, implementation, documentation, and iteration work:

- **GLM 5.1**
- **GPT 5.4**
- **DeepSeek V4 Pro**

### README media attribution

- `docs/architecture.gif`: generated with **Gemini 3.1 Pro**.
- `docs/media/galibierhub-ui-overview.png`: generated with **Gemini 3.1 Pro**.


## License

This project is licensed under the [MIT License](LICENSE).

[Back to top](#readme-top)
