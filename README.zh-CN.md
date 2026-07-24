# SeqEdge

![SeqEdge Screenshot](./seqedge-github-img-readme.jpg)

SeqEdge is a lightweight template for building a public genomics site with searchable metadata, an embedded JBrowse view, and direct dataset downloads.

Primary: [https://seq-edge.vercel.app](https://seq-edge.vercel.app)
Mirror: [https://seqedge.pages.dev](https://seqedge.pages.dev)

English README: [README.md](./README.md)

## What Users Can Do

- Search and filter promoter records by locus, gene, score, sample, species, tissue, cohort, and BMI class.
- Open the embedded genome browser and jump directly from a promoter record to the matching region.
- Inspect promoter details in a floating, resizable panel without hiding the browser.
- Download reference bundles, release archives, and sample-level files from public storage.
- Submit public or creator-only messages via the `Community Feedback` tab, then review thread status on the same page.
- Sign in with the allowed GitHub creator account to publish official replies.
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

The main interface has three tabs: **Overview**, **Promoters** (promoter table + genome browser), and **Community Feedback**.

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
FEEDBACK_EMAIL_API_URL=https://your-mail-service.example/send
FEEDBACK_EMAIL_API_KEY=your_mail_api_key
FEEDBACK_EMAIL_TO=owner@example.org
```

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` is recommended for production API routes.
- If files live in a subfolder, include that prefix in `NEXT_PUBLIC_STORAGE_BASE_URL`.
- Direct Hugging Face reads are supported, but the Worker is the most reliable JBrowse path.
- To enable creator replies: enable GitHub auth provider in Supabase (see [Creator Reply Setup](#creator-reply-setup)) and set `GITHUB_ADMIN_USERNAME` to the single GitHub login allowed to reply.

### 3. Initialize the database

Run `schema.sql` in Supabase SQL Editor, then import your real metadata into at least:

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

## Where To Configure Downloads

- Overview download cards: `src/site-config.ts`
- Sample-level download metadata: `genome_samples.vcf_download_url`, `genome_samples.fasta_download_url`
- Large-file CLI actions: set `vcf_download_mode` or `fasta_download_mode` to `cli`

## User Guide Content

The in-app User Guide covers four sections:

1. Browsing Data
2. Downloading Data
3. Community Feedback
4. For Site Creators

This is where end users can learn the difference between browser downloads and CLI downloads for large files, and how to use the built-in feedback channel.

## Community Feedback

SeqEdge includes a lightweight interaction area for research communication:

- Click the `Community Feedback` tab to browse threads and open the floating composer.
- Messages support a title, name or nickname, email, optional affiliation, category, rating, and visibility.
- Messages can be `Public` or `Creator only` (private).
- The `Community Feedback` tab shows threads split into `In progress` and `Completed`.
- Creator replies appear on the site and can also be emailed when the email API is configured.
- The reply action is restricted to the GitHub account matching `GITHUB_ADMIN_USERNAME`.
- Posted and replied timestamps are displayed for each thread.
- Visitors can also leave `Like` and `Bookmark` reactions.

Required database objects for this feature are included in `schema.sql`.
Required environment variables are listed in `.env.example`.

## Creator Reply Setup

To let the site owner sign in and reply from the browser:

### 1. Enable GitHub Auth in Supabase

In Supabase Dashboard, go to **Authentication** → **Sign In / Providers** (under CONFIGURATION, not OAuth Server). Find **GitHub** in the provider list, expand it, and enable **Sign in with GitHub**.

### 2. Get GitHub OAuth Credentials

1. Go to GitHub → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**
2. **Application name**: e.g. `SeqEdge Auth`
3. **Homepage URL**: `https://seq-edge.vercel.app` (or `http://localhost:3000` for local dev)
4. **Authorization callback URL**: `https://<your-project>.supabase.co/auth/v1/callback`
5. Click **Register application**, then **Generate a new client secret** (save immediately — shown only once)
6. Copy the **Client ID** and **Client Secret** back into Supabase and click **Save**

### 3. Configure Environment

Set `GITHUB_ADMIN_USERNAME` in `.env.local` or your deployment dashboard to the GitHub login that may reply. Any other signed-in GitHub account can read but cannot send creator replies.

Then sign in from the top-right `Creator Sign In` button on the site.

﻿## 邮件通知配置（Resend）

SeqEdge 使用 [Resend](https://resend.com) 向网站创建者发送留言通知邮件。

### 测试模式（无需域名）

Resend 提供免费测试模式，无需 DNS 域名验证即可使用：

1. 在 [resend.com](https://resend.com) 注册并进入 **API Keys**
2. 创建新的 API 密钥并复制
3. 测试发件地址为 `onboarding@resend.dev`，无需域名验证
4. 测试模式下邮件只会发送到你自己已验证的邮箱地址（`FEEDBACK_EMAIL_TO`）

### 环境变量

```bash
FEEDBACK_EMAIL_API_URL=https://api.resend.com/emails
FEEDBACK_EMAIL_API_KEY=re_xxxxxxxxxxxx
FEEDBACK_EMAIL_TO=1641454426@qq.com
```

- `FEEDBACK_EMAIL_API_URL` — Resend API 端点（始终为 `https://api.resend.com/emails`）
- `FEEDBACK_EMAIL_API_KEY` — 你的 Resend API 密钥（以 `re_` 开头）
- `FEEDBACK_EMAIL_TO` — 接收留言通知的邮箱地址

### 获取 API 密钥

1. 进入 [resend.com/api-keys](https://resend.com/api-keys)
2. 点击 **Create API Key**
3. 命名（例如 `SeqEdge`）
4. 权限设为 **Sending access**
5. 立即复制密钥 — 只显示一次，刷新后不可见

### 生产模式（需要有自有域名）

测试模式下邮件只能发给自己的已验证邮箱。要向任意留言者发送回复邮件，需要已验证的自有域名。

**域名验证详细步骤：**

1. 进入 [resend.com/domains](https://resend.com/domains)
2. 点击 **Add Domain**
3. 填入发送子域名，例如 `mail.yourdomain.com`（Resend 推荐使用子域名而非根域名）
4. 选择区域（非欧洲用户选 `us-east-1`）
5. 点击 **Add** — Resend 生成三条 DNS 记录：
   - **DKIM TXT 记录** — 主机: `resend._domainkey.mail`，值: 一长串 TXT 字符串（每个域名唯一）
   - **SPF TXT 记录** — 主机: `mail`，值: `v=spf1 include:spf.resend.io ~all`
   - **Return-path MX 记录** — 主机: `mail`，值: `feedback.resend.io`，优先级: `10`
6. 前往你的 DNS 管理商（Cloudflare、阿里云 DNS、Namecheap 等）
7. 逐条添加上述 DNS 记录，TTL 保持默认或设为 3600
8. 回到 Resend Domains 页面，点击 **Verify DNS Records**
9. DNS 传播需要几分钟，验证通过后 Resend 显示绿色勾号
10. 验证完成后，将发件地址从 `onboarding@resend.dev` 改为 `seqedge@mail.yourdomain.com`

**免费域名的限制：** 如果你部署在 `pages.dev` 或 `vercel.app` 上，无法为这些域名添加 DNS 记录（不拥有域名所有权）。需要有自己注册的域名才能使用生产模式。在此之前，测试模式完全够用。

**推荐发送方案：**

- **方案 A（生产模式）：** 自有域名 + Resend 域名验证 → 可向任意邮箱发送
- **方案 B（测试模式，当前）：** 无需域名 → `onboarding@resend.dev` 发件 → 仅发送到 `FEEDBACK_EMAIL_TO`

如果你刚起步，方案 B 完全满足需求。拥有自有域名后再切换到方案 A。

## Site Uptime

The footer shows a live uptime counter:

`This site has been running: X d X h X m X s`

Set the start timestamp in `src/site-config.ts` under `uptime.startAt`.

## Minimal Files To Keep

Keep these for the current feature set:

- `src/`
- `schema.sql`
- `README.md`
- `README.zh-CN.md`
- `cloudflare-templates/hf-proxy/`
- `scripts/`
- `public/demo-data/`
- `public/seqedge-github-img-readme.jpg`

Default template SVG assets under `public/` (file, globe, etc.) are unused and can be removed.

## Validation

Recommended checks before push:

```bash
npm run lint
npm run build
```

If both pass with your real environment values, the repo is ready for deployment testing.
