<a id="readme-top"></a>

# SeqEdge

Edge-Native Genomics Database Template

An open-source template for coordinate-based genomics portals that combine searchable metadata, genome browser views, charts, and storage-decoupled deployment.

**Primary:** [https://seq-edge.vercel.app](https://seq-edge.vercel.app)
**Mirror:** [https://seqedge.pages.dev](https://seqedge.pages.dev)
**GitHub:** [https://github.com/Helloxiaolaodi/SeqEdge](https://github.com/Helloxiaolaodi/SeqEdge)

Language: **English** | [简体中文](./README.zh-CN.md) | [Issues](https://github.com/Helloxiaolaodi/SeqEdge/issues)

Detailed build guide: [SeqEdge Developer Notes](https://www.cnblogs.com/Helloxiaolaodi/p/21776736)

Stack: Next.js | React | Supabase | Cloudflare R2 | Hugging Face Datasets | Cloudflare Workers | JBrowse 2 | TanStack Table | ECharts

![License](https://img.shields.io/github/license/Helloxiaolaodi/SeqEdge?style=flat-square)
![Stars](https://img.shields.io/github/stars/Helloxiaolaodi/SeqEdge?style=flat-square)
![Forks](https://img.shields.io/github/forks/Helloxiaolaodi/SeqEdge?style=flat-square)
![Issues](https://img.shields.io/github/issues/Helloxiaolaodi/SeqEdge?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-15.5.21-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-2.110.7-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?style=flat-square&logo=vercel)

![SeqEdge Architecture](./docs/architecture.gif)

## What Users Can Do

- Search and filter promoter records by locus, gene, score, sample, species, tissue, cohort, and BMI class.
- Open the embedded genome browser and jump directly from a promoter record to the matching region.
- Inspect promoter details in a floating, resizable panel without hiding the browser.
- Open a unified download modal for reference bundles, release archives, and sample-level files, with browser download, `wget`, `curl`, and `hf download` commands.
- See file name, type, size, created / updated time, download count, access mode, MD5, and SHA256 in the same download modal.
- Copy SHA256 with one click, and use resume-capable CLI commands for large-file transfer.
- Generate batch download scripts for public sample files as `.sh` and `.bat` outputs.
- Submit public or creator-only messages via the `Discussion` tab, then review thread status on the same page.
- Sign in with the allowed GitHub creator account to publish official replies.
- Upload images in discussion threads, view success / failure submission feedback, and click posted images to zoom them.
- See likes and bookmarks on thread cards and inside the thread detail view.
- Check the site uptime counter at the bottom of the page.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## Current Download Strategy

SeqEdge uses a free-tier friendly split workflow:

- Single-file downloads: open one modal that shows browser download plus `wget -c`, `curl -L -C -`, and `hf download`
- Large files: explicitly present resume-capable CLI commands; `hf download` is the recommended option for large Hugging Face assets
- JBrowse streaming: use the proxy/fallback chain for indexed browser reads
- Bulk downloads: generate `.sh` and `.bat` scripts for public files only
- Integrity and metadata: show download count, MD5, SHA256, access mode, hidden/password badges, and region hints in the modal
- Private delivery: if a file is stored in a private Supabase bucket, SeqEdge can mint a signed URL through `/api/download-metadata/resolve`

This keeps multi-GB transfers off the proxy path, preserves resumable CLI flows for end users, and allows genuinely private delivery when large files are moved from public storage to Supabase private storage.

## Uploading Data to Hugging Face

SeqEdge hosts large data files (release archives, reference bundles, sample-level files) on a Hugging Face dataset repository, by default `https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data`. The project creator uploads these files with the Hugging Face CLI.

### 1. Install the CLI

The `hf` command is bundled with `huggingface_hub`.

```bash
pip install -q "huggingface_hub"
```

On Windows the executable may land in the per-user `Scripts` folder (not on PATH). Either add that folder to PATH or call it by full path, e.g. `C:\Users\<you>\AppData\Local\Packages\PythonSoftwareFoundation.Python.3.13_...\LocalCache\local-packages\Python313\Scripts\hf.exe`.

### 2. Log in

Two options:

```bash
hf auth login          # paste a token from https://huggingface.co/settings/tokens
# or set it as an environment variable:
export HF_TOKEN=hf_xxxxxxxxxxxx   # Linux/macOS
$env:HF_TOKEN = "hf_xxxxxxxxxxxx" # Windows PowerShell
```

Verify with `hf auth whoami`, which prints `user=<your-username>`.

### 3. Upload a file or folder

General form:

```bash
hf upload <namespace/dataset-name> <local-path> <path-in-repo> --repo-type dataset
```

Example (uploading a ~590 MB archive into a subfolder of the dataset; the subfolder is created if needed):

```bash
hf upload Helloxiaolaodi/seqedge-data "E:\data\817-food-biochem-materials.zip" "817-food-biochem/817-food-biochem-materials.zip" --repo-type dataset
```

- `--repo-type dataset` selects a dataset repository (not a model).
- Subfolders are created implicitly.
- On success a commit URL like `https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/commit/<sha>` is printed.

### 4. Resumable transfer

Both `hf upload` and `hf download` reuse the staging already transmitted, so an interrupted run does not restart from zero. If a run times out or a network error appears, simply run the same command again and it continues.

### 5. Acceleration and the Xet engine

The current `huggingface_hub` (>= 0.30) replaces the old `hf_transfer` package with the Xet engine. To enable high-performance transfer set:

```bash
export HF_XET_HIGH_PERFORMANCE=1    # Linux/macOS
$env:HF_XET_HIGH_PERFORMANCE = "1"  # Windows PowerShell
```

The legacy `HF_HUB_ENABLE_HF_TRANSFER` is deprecated. If your proxy cannot complete the TLS handshake to `*.xethub.hf.co`, fall back to the compatible HTTP channel:

```bash
export HF_HUB_DISABLE_XET=1         # Linux/macOS
$env:HF_HUB_DISABLE_XET = "1"       # Windows PowerShell
```

### 6. Network / proxy tips

Hugging Face stores long-term data in AWS S3 (US-East). From Asia, a direct connection or an Asian-noded proxy routes across the trans-Pacific backbone and usually saturates at a few hundred KB/s. Use a **United States** proxy node so the path becomes `local -> US node -> US region network -> Hugging Face`, which is dramatically faster.

In a terminal set an HTTP proxy (HTTP scheme works best with the CLI):

```bash
export HTTP_PROXY=http://127.0.0.1:7897 HTTPS_PROXY=http://127.0.0.1:7897   # Linux/macOS
$env:HTTP_PROXY="http://127.0.0.1:7897"; $env:HTTPS_PROXY="http://127.0.0.1:7897" # Windows PowerShell
```

Confirm the proxy is actually taking effect before uploading:

```bash
curl -I https://huggingface.co   # look for "HTTP/1.1 200 Connection established"
```

### 7. Field experience

Uploading ~592 MB from an Asia location using a US proxy node together with `HF_HUB_DISABLE_XET=1` (the local proxy failed the Xet endpoint TLS handshake) finished in about ten minutes in one run, including an automatic resume after a timeout. Verify the uploaded file by listing the dataset tree:

```bash
curl -sL "https://huggingface.co/api/datasets/Helloxiaolaodi/seqedge-data/tree/main/817-food-biochem"
```

The response includes `size` (bytes) and the LFS `oid`, which is the file's SHA-256.

### 8. Downloading large files (for users)

Downloading mirrors uploading. For multi-hundred-MB to GB files prefer the HF CLI, which is resumable and multi-stream:

```bash
pip install -q "huggingface_hub"
hf download Helloxiaolaodi/seqedge-data 817-food-biochem/817-food-biochem-materials.zip --repo-type dataset --local-dir .
```

The classic commands also resume:

```bash
wget -c -O <name> "<resolve url>"        # -c continues a partial download
curl -L -C - -o <name> "<resolve url>"   # -C - resumes
```

All three methods support resumable downloads; from Asia the HF CLI gives the best throughput with the least manual retry.
## Deployment Model

SeqEdge separates three parts:

- Metadata in Supabase / PostgreSQL
- Large genome files in object storage or Hugging Face Datasets
- App UI on Vercel or Cloudflare Pages

Recommended production layout:

1. Vercel for the primary site
2. Cloudflare Pages for the mirror site
3. Cloudflare Worker for Hugging Face proxying

The main interface now has four tabs: **Overview**, **Records** (record table + genome browser), **Discussion**, and **Downloads**.

The current shipped UI and default schema are still genomics-oriented. Template users can generalize the project later, but the repository in its present state still uses promoter- and genome-related naming in the main data surfaces.

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

Required genome storage variables:

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

Optional creator-reply and email variables:

```bash
GITHUB_ADMIN_USERNAME=your-github-login
NEXT_PUBLIC_GITHUB_ADMIN_USERNAME=your-github-login
FEEDBACK_EMAIL_API_URL=https://your-mail-service.example/send
FEEDBACK_EMAIL_API_KEY=your_mail_api_key
FEEDBACK_EMAIL_TO=owner@example.org
```

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` is recommended for production API routes.
- If files live in a subfolder, include that prefix in `NEXT_PUBLIC_STORAGE_BASE_URL`.
- Direct Hugging Face reads are supported, but the Worker is the most reliable JBrowse path.
- To enable creator replies: enable GitHub auth provider in Supabase (see [Creator Reply Setup](#creator-reply-setup)), set `GITHUB_ADMIN_USERNAME` for server-side reply authorization, and set `NEXT_PUBLIC_GITHUB_ADMIN_USERNAME` for the client-side creator controls.

### 3. Initialize the database

Run `schema.sql` in Supabase SQL Editor, then import your real metadata into at least:

- `genome_samples`
- `predicted_promoters`
- `variant_index`

For the current feature set, `schema.sql` also needs to create the interaction and download-control objects used by the live UI:

- `site_feedback`
- `feedback_comments`
- `site_reactions`
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

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## Genome Browser Notes

For best JBrowse performance, configure a Cloudflare Worker proxy. SeqEdge probes in order:

1. External `NEXT_PUBLIC_HF_PROXY_URL`
2. Built-in `/api/hf-proxy/<file>` route
3. Direct Hugging Face reads

If the browser still shows `Reference data unreachable`, usually one of these is wrong:

- `NEXT_PUBLIC_STORAGE_BASE_URL`
- `NEXT_PUBLIC_REFERENCE_FASTA_INDEX`
- Hugging Face dataset subdirectory
- Worker deployment or `HF_REPO_BASE`

SeqEdge also opens the first reachable annotation track automatically so the viewer does not land in `No tracks active` when real tracks are available.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## Where To Configure Downloads

- Featured download cards on the Overview tab: `src/site-config.ts`
- Sample-level download metadata: `genome_samples.vcf_download_url`, `genome_samples.fasta_download_url`, `genome_samples.gb_download_url`, `genome_samples.bed_download_url`, `genome_samples.gff3_download_url`, and related `*_download_mode` fields
- Unified download metadata model and CLI generation: `src/lib/download-info.ts`
- Single-file modal behavior and creator edit controls: `src/components/download-actions.tsx`
- Batch script generation for public entries: `src/components/promoter-table.tsx` and `/api/samples/batch`
- Dedicated site-wide download catalog with hierarchical folder browsing: `src/components/download-catalog-panel.tsx` and `/api/download-catalog`
- Private signed-URL resolution: `/api/download-metadata/resolve` backed by the `download_metadata` table

## Add a Hugging Face File to SeqEdge

The current codebase supports three practical Hugging Face integration points:

1. a homepage featured download card
2. a sample-level download entry shown inside the record detail panel and detail page
3. the dedicated `Downloads` tab, which lets users browse downloadable files by folder level in the path hierarchy and opens the same unified download modal

### 1. Use the correct direct file URL

Do not paste the Hugging Face page URL that contains `/blob/main/`.

- Page URL example: `https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/blob/main/817-food-biochem/817-food-biochem-materials.zip`
- Direct file URL example: `https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/817-food-biochem/817-food-biochem-materials.zip`

SeqEdge now normalizes common Hugging Face `blob` links to `resolve` links, but you should still store the direct file URL in your database and environment variables.

### 2. Show the file on the homepage

Set the featured archive environment variables:

```bash
NEXT_PUBLIC_RELEASE_ARCHIVE_LABEL=Download 817 Food Biochem Materials
NEXT_PUBLIC_RELEASE_ARCHIVE_DESCRIPTION=Public Hugging Face dataset package for large-file download, browser delivery, and resume-capable CLI retrieval.
NEXT_PUBLIC_RELEASE_ARCHIVE_URL=https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/817-food-biochem/817-food-biochem-materials.zip
NEXT_PUBLIC_RELEASE_ARCHIVE_SIZE=~700 MB
NEXT_PUBLIC_RELEASE_ARCHIVE_MODE=cli
```

This powers the featured card on the Overview tab and opens the unified download modal. The same file can also appear in the dedicated `Downloads` tab when it is present in the site-wide catalog, where visitors browse folders level by level from the dataset root.

### 3. Show the same file as a sample-level download entry

The current UI now renders these sample-level file slots in both the floating detail panel and the standalone detail page:

- `vcf_download_url`
- `fasta_download_url`
- `gb_download_url`
- `bed_download_url`
- `gff3_download_url`

For a generic package from Hugging Face, the least disruptive option in the current schema is to use `gb_download_url` as a generic package slot. The UI labels this slot as `Download Package`.

Example SQL:

```sql
update genome_samples
set gb_download_url = 'https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/817-food-biochem/817-food-biochem-materials.zip'
where sample_id = 'CNhs10881';
```

If you want the same row to prefer CLI hints in the modal, keep using a large-file host such as Hugging Face and open the modal from the record detail view.

You can also attach the same file to the dedicated `Downloads` tab through `download_metadata`, so the site exposes one consistent single-file modal whether the visitor enters from Overview, Records, or Downloads.

### 4. Add hidden / password / private delivery metadata

If the file is public on Hugging Face, you can still attach site-level metadata and UI controls through `download_metadata`, for example custom label, description, hashes, hidden flag, and password prompt.

Example:

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
  'https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/817-food-biochem/817-food-biochem-materials.zip',
  '817 Food Biochem Materials',
  'Public Hugging Face dataset package exposed through the SeqEdge unified download modal.',
  'Archive (zip)',
  734003200,
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

### 5. When you need real private downloads

For actual gated delivery, store the file in a private Supabase bucket and set the matching `download_metadata.storage_provider` to `supabase_private`. SeqEdge then resolves the file through `/api/download-metadata/resolve` and returns a short-lived signed URL.

That is the only fully implemented private-download path in the current codebase.

## User Guide Content

The in-app User Guide is now visitor-facing and concise. It explains only how to use the four main tabs:

1. Overview
2. Records
3. Discussion
4. Downloads

Its purpose is to help a visitor start using the site quickly, not to document deployment or creator-only setup.

## Discussion

SeqEdge includes a lightweight interaction area for research communication:

- Click the `Discussion` tab to browse threads and open the floating composer. Anyone can sign in with GitHub to post.
- Messages support a title, name or nickname, email, optional affiliation, category, rating, and visibility.
- Messages can be `Public` or `Creator only` (private).
- The `Discussion` tab shows threads split into `In progress` and `Completed`.
- Threads can be sorted, including a `Most liked` view.
- Creator replies appear on the site and can also be emailed when the email API is configured.
- The reply action is restricted to the GitHub account matching `GITHUB_ADMIN_USERNAME`, while the creator UI in the browser also expects `NEXT_PUBLIC_GITHUB_ADMIN_USERNAME` to match the same login.
- Posted and replied timestamps are displayed for each thread.
- Visitors can leave `Like` and `Bookmark` reactions, and those counts remain visible in both list and detail views.
- Image uploads show success or failure feedback during submission.
- Submitted messages show explicit success feedback, and posted images can be opened in a zoomable lightbox.

Required database objects for this feature are included in `schema.sql`.
Required environment variables are listed in `.env.example`.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## Creator Reply Setup

To let the site owner sign in and reply from the browser:

### 1. Enable GitHub Auth in Supabase

In Supabase Dashboard, go to **Authentication** → **Sign In / Providers** (under CONFIGURATION, not OAuth Server). Find **GitHub** in the provider list, expand it, and enable **Sign in with GitHub**.

### 2. Configure Supabase Auth URLs (critical for production)

After enabling GitHub Auth, update the URL configuration so OAuth redirects land on your production site instead of localhost:

1. In Supabase Dashboard, go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your production domain, e.g. https://seq-edge.vercel.app
3. Under **Redirect URLs**, add all deployed domains (one per line):
   - https://seq-edge.vercel.app
   - https://seq-edge.vercel.app/**
   - https://seqedge.pages.dev
   - https://seqedge.pages.dev/**
4. Click **Save**

If the Site URL is left as the default http://localhost:3000, OAuth sign-in will redirect users there, which does not exist in production and will show a connection-refused page.

### 3. Get GitHub OAuth Credentials

1. Go to GitHub → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**
2. **Application name**: e.g. `SeqEdge Auth`
3. **Homepage URL**: `https://seq-edge.vercel.app` (or `http://localhost:3000` for local dev)
4. **Authorization callback URL**: `https://<your-project>.supabase.co/auth/v1/callback`
5. Click **Register application**, then **Generate a new client secret** (save immediately — shown only once)
6. Copy the **Client ID** and **Client Secret** back into Supabase and click **Save**

### 4. Configure Environment

Set both `GITHUB_ADMIN_USERNAME` and `NEXT_PUBLIC_GITHUB_ADMIN_USERNAME` in `.env.local` or your deployment dashboard to the same GitHub login that may reply. Any other signed-in GitHub account can read but cannot send creator replies.

Then sign in from the top-right `Log in with GitHub` button on the site.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## Email Notification Setup (Resend)

SeqEdge uses [Resend](https://resend.com) to deliver feedback notification emails to the site creator.

### Test Mode (no domain required)

Resend provides a free test mode that works without DNS domain verification:

1. Sign up at [resend.com](https://resend.com) and go to **API Keys**
2. Create a new API key and copy it
3. The test sender address is `onboarding@resend.dev` — no domain verification needed
4. In test mode, emails are only delivered to your own verified email address

### Environment Variables

```bash
FEEDBACK_EMAIL_API_URL=https://api.resend.com/emails
FEEDBACK_EMAIL_API_KEY=re_xxxxxxxxxxxx
FEEDBACK_EMAIL_TO=1641454426@qq.com
```

- `FEEDBACK_EMAIL_API_URL` — Resend API endpoint (always `https://api.resend.com/emails`)
- `FEEDBACK_EMAIL_API_KEY` — Your Resend API key (starts with `re_`)
- `FEEDBACK_EMAIL_TO` — The email address that receives feedback notifications

### Getting an API Key

1. Go to [resend.com/api-keys](https://resend.com/api-keys)
2. Click **Create API Key**
3. Give it a name (e.g. `SeqEdge`)
4. Set permission to **Sending access**
5. Copy the key immediately — it is shown only once

### Moving to Production (requires your own domain)

Test mode only delivers to your own verified email. To send reply emails to any visitor, you need a verified custom domain.

**Step-by-step domain verification:**

1. Go to [resend.com/domains](https://resend.com/domains)
2. Click **Add Domain**
3. Enter a sending subdomain, e.g. `mail.yourdomain.com` (Resend recommends a subdomain, not the root)
4. Choose your region (`us-east-1` unless you are in Europe)
5. Click **Add** — Resend generates three DNS records:
   - **DKIM TXT record** — host: `resend._domainkey.mail`, value: a long TXT string (unique to your domain)
   - **SPF TXT record** — host: `mail`, value: `v=spf1 include:spf.resend.io ~all`
   - **Return-path MX record** — host: `mail`, value: `feedback.resend.io`, priority: `10`
6. Go to your DNS provider (Cloudflare, Namecheap, Alibaba Cloud DNS, etc.)
7. Add each record exactly as shown — leave TTL at default or 3600
8. Return to the Resend Domains page and click **Verify DNS Records**
9. DNS propagation may take a few minutes; Resend shows green checkmarks when done
10. Once verified, update your sender address from `onboarding@resend.dev` to `seqedge@mail.yourdomain.com`

**Limitation for free domains:** If you deploy on `pages.dev` or `vercel.app`, you cannot add DNS records for these domains because you do not own them. You need your own registered domain to use production mode. Until then, test mode works perfectly for receiving feedback notifications.

**Recommended sender setup:**

- **Plan A (production):** Own domain + verified Resend domain → can send to anyone
- **Plan B (test, current):** No domain needed → `onboarding@resend.dev` sender → only delivers to `FEEDBACK_EMAIL_TO`

If you are just starting out, Plan B is all you need. Switch to Plan A when you have a custom domain.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## Site Uptime

The footer shows a live uptime counter:

`This site has been running: X d X h X m X s`

Set the start timestamp in `src/site-config.ts` under `uptime.startAt`.

## Tech Stack

- See the unified tool reference below.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## Acknowledgments

SeqEdge builds on an open-source stack for UI rendering, data access, browser-based reference viewing, and deployment.

### Sources & Citations

| Tool | Version | Function | Reference |
| --- | --- | --- | --- |
| [Next.js](https://nextjs.org/docs) | `15.5.21` | App framework and runtime | Official documentation |
| [React](https://react.dev/learn) | `19.2.4` | Component rendering and client UI state | Official learning docs |
| [`@supabase/supabase-js`](https://supabase.com/docs/reference/javascript/introduction) | `^2.110.7` | Database, auth, and storage client access | Supabase JavaScript client docs |
| [`@jbrowse/product-core`](https://jbrowse.org/jb2/docs/) | `^4.3.0` | Embedded reference browser core | JBrowse 2 docs |
| [`@jbrowse/react-linear-genome-view`](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view) | `^3.1.0` | React wrapper for the linear browser view | npm package page |
| [`@tanstack/react-table`](https://tanstack.com/table/latest/docs/guide/introduction) | `^8.21.3` | Record table rendering and interactions | Official docs |
| [ECharts](https://echarts.apache.org/handbook/en/get-started/) | `^6.1.0` | Summary charts and dashboard visuals | Official getting-started handbook |
| [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) | `^1.20.2` | Cloudflare build adapter | OpenNext Cloudflare docs |
| [Wrangler](https://developers.cloudflare.com/workers/wrangler/) | `^4.113.0` | Cloudflare deployment CLI | Cloudflare Workers CLI docs |

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## Friend Links

- [LINUX DO](https://linux.do/) - A next-generation Linux community

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## Minimal Files To Keep

Keep these for the current feature set:

- `src/`
- `schema.sql`
- `README.md`
- `README.zh-CN.md`
- `cloudflare-templates/hf-proxy/`
- `scripts/`

Default template SVG assets under `public/` (file, globe, etc.) are unused and can be removed.

## Validation

Recommended checks before push:

```bash
npm run lint
npm run build
```

If both pass with your real environment values, the repo is ready for deployment testing.

<div align="right">

[![][back-to-top]](#readme-top)

</div>


## License

This project is licensed under the [MIT License](LICENSE).

<div align="right">

[![][back-to-top]](#readme-top)

</div>


---

## Data access control: honest limitation

The per-file **Hide** and **Download password** controls are only genuine access control when the file is delivered through the signed-URL path. In the current codebase, that real protected flow is implemented for entries whose `download_metadata.storage_provider` is `supabase_private`: the site verifies optional passwords and then mints a short-lived Supabase signed URL.

If the underlying file still lives on a **publicly readable** Hugging Face dataset repository, hide/password remain an **in-page convenience only**. Anyone who knows a `https://huggingface.co/datasets/<user>/<repo>/resolve/main/<path>` URL can fetch it directly with `wget`/`curl`/`hf download`, bypassing the site entirely. The same limitation applies to reusable batch scripts for public Hugging Face URLs.

If you need **real access control**, choose one of:

- Keep large files in a **private** Supabase Storage bucket and serve **signed, time-limited URLs** generated by an authenticated API route. This is the protection model already wired into the current code.
- Set the Hugging Face dataset repository to **private** (only authenticated, authorized users can read). Note: the default `resolve` URL then requires an HF access token, so public website downloads stop working until you add your own gated proxy layer.
- Move sensitive files to a provider with built-in gating (e.g. a gated dataset on Hugging Face, with token-bearing downloaders).

In short: public HF URL + hide/password = discourage casual on-site download; private signed storage = prevent direct anonymous download.

<!-- LINK GROUP -->
[back-to-top]: https://img.shields.io/badge/Back_to_Top-⬆-blue?style=flat-square
