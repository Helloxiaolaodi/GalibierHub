# SeqEdge

![SeqEdge 截图](./seqedge-github-img-readme.jpg)

SeqEdge 是一个面向科研数据库场景的轻量模板，用来搭建带有元数据检索、JBrowse 内嵌浏览器和数据下载入口的基因组网站。

主站: [https://seq-edge.vercel.app](https://seq-edge.vercel.app)

镜像站: [https://seqedge.pages.dev](https://seqedge.pages.dev)

English README: [README.md](./README.md)

## 网站现在能做什么

- 按坐标、基因名、分数、样本、物种、组织、队列、BMI 等条件筛选 promoter。
- 从 promoter 表格直接联动到内嵌 JBrowse 浏览器。
- 在不遮挡浏览器的情况下，用可拖动、可拉伸的浮动卡片查看 promoter 详情。
- 下载参考数据包、整包发布数据和样本级文件。
- 通过右上角 `Leave Feedback` 按钮提交公开留言或仅创建者可见的留言，并在 `Community Feedback` 页面查看回复状态。
- 创建者可通过右上角 `Creator Sign In` 使用 GitHub 登录后发布正式回复。
- 在页面底部查看网站运行时长。

## 当前推荐的数据下载方案

SeqEdge 现在采用免费方案友好的双轨制：

- 小文件：只显示 `Download`
- 大文件：显示 `Download`、`Copy wget`、`Copy curl`
- JBrowse 在线浏览：走代理或回退链路
- 用户主动下载：直连公开存储地址，并附加 `?download=true`

这样可以把多 GB 文件下载流量从代理链路中分离出去，更适合把大文件放在 Hugging Face Datasets 上。

## 部署结构

SeqEdge 把系统拆成三部分：

- Supabase / PostgreSQL 存元数据
- 对象存储或 Hugging Face Datasets 存大文件
- Vercel 或 Cloudflare Pages 部署前端站点

推荐正式部署组合：

1. Vercel 作为主站
2. Cloudflare Pages 作为镜像站
3. Cloudflare Worker 作为 Hugging Face 代理层

## 快速开始

### 1. 安装

```bash
git clone https://github.com/<your-account>/SeqEdge.git
cd SeqEdge
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`，再把占位值替换成真实配置。

数据库必填项：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

基因组存储必填项：

```bash
NEXT_PUBLIC_STORAGE_BASE_URL=https://huggingface.co/datasets/<user>/<repo>/resolve/main/<optional-subdir>
NEXT_PUBLIC_REFERENCE_ASSEMBLY=NC_045512.2
NEXT_PUBLIC_REFERENCE_DEFAULT_LOCUS=NC_045512.2:1-5000
NEXT_PUBLIC_REFERENCE_FASTA=scov2.fa
NEXT_PUBLIC_REFERENCE_FASTA_INDEX=scov2.fa.fai
NEXT_PUBLIC_REFERENCE_BED=scov2.genes.bed
NEXT_PUBLIC_REFERENCE_GFF3=scov2.genes.gff3
```

推荐补充项：

```bash
NEXT_PUBLIC_HF_PROXY_URL=https://seqedge-hf-proxy.your-account.workers.dev
NEXT_PUBLIC_RELEASE_ARCHIVE_URL=https://huggingface.co/datasets/<user>/<repo>/resolve/main/releases/seqedge-release.tar.gz
NEXT_PUBLIC_RELEASE_ARCHIVE_SIZE=12.5 GB
NEXT_PUBLIC_RELEASE_ARCHIVE_MODE=cli
NEXT_PUBLIC_REFERENCE_BUNDLE_URL=https://huggingface.co/datasets/<user>/<repo>/resolve/main/reference/reference-bundle.zip
NEXT_PUBLIC_REFERENCE_BUNDLE_SIZE=180 MB
NEXT_PUBLIC_REFERENCE_BUNDLE_MODE=direct
```

创建者回复相关可选项：

```bash
GITHUB_ADMIN_USERNAME=your-github-login
FEEDBACK_EMAIL_API_URL=https://your-mail-service.example/send
FEEDBACK_EMAIL_API_KEY=your_mail_api_key
FEEDBACK_EMAIL_TO=owner@example.org
```

说明：

- `SUPABASE_SERVICE_ROLE_KEY` 建议用于正式环境 API 路由。
- 如果文件在子目录中，记得把子目录前缀写进 `NEXT_PUBLIC_STORAGE_BASE_URL`。
- 虽然 SeqEdge 支持直接读取 Hugging Face，但 JBrowse 正式使用时仍建议优先配 Worker。
- 如果要启用创建者在线回复，需要在 Supabase 中开启 GitHub Auth Provider，并把 `GITHUB_ADMIN_USERNAME` 设为唯一允许回复的 GitHub 用户名。

### 3. 初始化数据库

先在 Supabase 执行 `schema.sql`，再导入真实数据，至少包括：

- `genome_samples`
- `predicted_promoters`
- `variant_index`

只创建表结构不会自动生成首页统计数据。

### 4. 本地运行

```bash
npm run dev
```

### 5. 生产构建

```bash
npm run build
npm run start
```

### 6. 部署

Vercel：

- Build command: `npm run build`

Cloudflare Pages：

- Build command: `npm run build:cf`
- Preview command: `npm run preview:cf`
- Deploy command: `npm run deploy:cf`
- Output directory: `.open-next`

## JBrowse 相关说明

SeqEdge 现在会按以下顺序探测浏览器使用的参考数据：

1. 外部 `NEXT_PUBLIC_HF_PROXY_URL`
2. 站内 `/api/hf-proxy/<file>`
3. Hugging Face 直连

如果页面仍然出现 `Reference data unreachable`，通常需要检查：

- `NEXT_PUBLIC_STORAGE_BASE_URL`
- `NEXT_PUBLIC_REFERENCE_FASTA_INDEX`
- Hugging Face 数据集子目录是否写对
- Worker 是否已部署，以及 `HF_REPO_BASE` 是否一致

另外，SeqEdge 现在会自动打开第一个可达轨道，尽量避免 JBrowse 一上来停在 `No tracks active`。

## 下载功能在哪里配置

- Overview 顶部下载卡片：`src/site-config.ts`
- 样本级下载地址：`genome_samples.vcf_download_url`、`genome_samples.fasta_download_url`
- 大文件命令行按钮：把 `vcf_download_mode` 或 `fasta_download_mode` 设为 `cli`

## 站内 User Guide 现在包含

1. Overview
2. Promoters & Features
3. Genome Browser
4. Data & Storage
5. Downloading Data
6. Community Feedback

其中 `Downloading Data` 说明浏览器下载和命令行下载的区别，`Community Feedback` 说明站内互动区的使用方式。

## 站内互动区

SeqEdge 现在带有一个轻量的科研交流区：

- 访问者通过右上角 `Leave Feedback` 弹出窗口提交带标题的留言，可填写姓名或昵称、邮箱、可选单位、分类、评分和正文内容。
- 留言可以选择 `Public` 或 `Creator only`。
- `Community Feedback` 是单独的第四个页面，主要用于查看留言线程、互动状态和创建者回复。
- 留言线程会分成 `In progress` 和 `Completed`。
- 创建者回复后，会直接显示在网站上；如果邮件接口已配置，也可以把回复发送到留言者邮箱。
- 创建者回复权限只开放给 `GITHUB_ADMIN_USERNAME` 对应的 GitHub 账号。
- 每条留言和回复都显示日期时间。
- 访问者还可以使用 `Like` 和 `Bookmark` 做轻量互动。

这一部分需要的数据库表已经写入 `schema.sql`。

Supabase GitHub OAuth 和邮件发送相关环境变量已经写入 `.env.example`。

## 创建者回复如何启用

如需让网站创建者在前端直接回复留言，需要完成以下配置：

1. 在 Supabase 开启 GitHub 登录。
2. 在 Supabase Auth 中配置 GitHub OAuth 回调地址。
3. 在部署环境变量中设置 `GITHUB_ADMIN_USERNAME`。
4. 由创建者在网站右上角点击 `Creator Sign In` 登录。

其他 GitHub 账号即使登录，也只能浏览，不能发送创建者回复。

## 网站运行时长

页面底部现在会显示实时运行时长：

`This site has been running: X d X h X m X s`

起始时间在 `src/site-config.ts` 的 `uptime.startAt` 中配置。

## 仓库最少需要保留的内容

为了保留当前网站功能，建议至少保留：

- `src/`
- `schema.sql`
- `README.md`
- `README.zh-CN.md`
- `docs/data-compression-guide.md`
- `cloudflare-templates/hf-proxy/`
- `scripts/build-cloudflare.mjs`
- `public/demo-data/`
- `public/seqedge-github-img-readme.jpg`

`public/` 下面那几份默认模板 SVG 目前没有被站点引用，可以直接删除。

## 推送前建议校验

```bash
npm run lint
npm run build
```

如果这两个检查通过，并且环境变量已经换成真实值，就可以推送并测试部署效果。
