<a id="readme-top"></a>

# SeqEdge

![SeqEdge 截图](./seqedge-github-img-readme.jpg)

边缘原生子基因组数据库模板

一个开源模板，用于构建基于坐标的子基因组门户，整合可检索的元数据、基因组浏览器视图、图表与存储解耦的部署方式。

**主站：** [https://seq-edge.vercel.app](https://seq-edge.vercel.app)
**镜像：** [https://seqedge.pages.dev](https://seqedge.pages.dev)
**GitHub：** [https://github.com/Helloxiaolaodi/SeqEdge](https://github.com/Helloxiaolaodi/SeqEdge)

语言：**简体中文** | [English](./README.md) | [问题反馈](https://github.com/Helloxiaolaodi/SeqEdge/issues)

详细搭建指南：[SeqEdge 开发者笔记](https://www.cnblogs.com/Helloxiaolaodi/p/21776736)

技术栈：Next.js | React | Supabase | Cloudflare R2 | Hugging Face Datasets | Cloudflare Workers | JBrowse 2 | TanStack Table | ECharts

![License](https://img.shields.io/github/license/Helloxiaolaodi/SeqEdge?style=flat-square)
![Stars](https://img.shields.io/github/stars/Helloxiaolaodi/SeqEdge?style=flat-square)
![Forks](https://img.shields.io/github/forks/Helloxiaolaodi/SeqEdge?style=flat-square)
![Issues](https://img.shields.io/github/issues/Helloxiaolaodi/SeqEdge?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-15.5.21-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-2.110.7-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?style=flat-square&logo=vercel)

![SeqEdge 架构图](./docs/architecture.gif)

## 用户可执行的操作

- 按位点、基因、评分、样本、物种、组织、队列与 BMI 分级检索并筛选子记录。
- 打开嵌入式基因组浏览器，从一条子记录直接跳转到对应区域。
- 在可悬浮、可缩放的面板中查看子详情，浏览器视图不会被遮挡。
- 从公共存储下载参考序列包、发布归档文件与样本级文件。
- 通过 `讨论` 标签页提交公开或仅创建者可见的留言，并在同一页面查看帖子状态。
- 使用被授权的 GitHub 创建者账号登录并发布官方回复。
- 在页面底部查看站点运行时长计数器。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 当前下载策略

SeqEdge 采用适合免费层级的拆分式流程：

- 小文件：显示 `下载`
- 大文件：显示 `下载`、`复制 wget` 与 `复制 curl`
- JBrowse 流式读取：使用代理/回退链进行索引化浏览器读取
- 批量下载：直接访问公共文件主机并通过 `?download=true` 下载

这样可以把数 GB 级别的传输排除在代理路径之外，是大文件托管在 Hugging Face Datasets 时的推荐方案。

## 部署模型

SeqEdge 将三部分解耦：

- 元数据存放于 Supabase / PostgreSQL
- 大型基因组文件存放于对象存储或 Hugging Face Datasets
- 应用 UI 部署在 Vercel 或 Cloudflare Pages

推荐的生产环境布局：

1. Vercel 作为主站
2. Cloudflare Pages 作为镜像站
3. Cloudflare Worker 用于 Hugging Face 代理

主界面有三个标签页：**总览**、**子**（子表格 + 基因组浏览器）与 **讨论**。

## 快速开始

### 1. 安装

```bash
git clone https://github.com/<your-account>/SeqEdge.git
cd SeqEdge
npm install
```

### 2. 配置环境变量

将 `.env.example` 复制为 `.env.local` 并替换其中的占位符。

必填的数据库变量：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

必填的基因组存储变量：

```bash
NEXT_PUBLIC_STORAGE_BASE_URL=https://huggingface.co/datasets/<user>/<repo>/resolve/main/<optional-subdir>
NEXT_PUBLIC_REFERENCE_ASSEMBLY=NC_045512.2
NEXT_PUBLIC_REFERENCE_DEFAULT_LOCUS=NC_045512.2:1-5000
NEXT_PUBLIC_REFERENCE_FASTA=scov2.fa
NEXT_PUBLIC_REFERENCE_FASTA_INDEX=scov2.fa.fai
NEXT_PUBLIC_REFERENCE_BED=scov2.genes.bed
NEXT_PUBLIC_REFERENCE_GFF3=scov2.genes.gff3
```

可选但建议配置：

```bash
NEXT_PUBLIC_HF_PROXY_URL=https://seqedge-hf-proxy.your-account.workers.dev
NEXT_PUBLIC_RELEASE_ARCHIVE_URL=https://huggingface.co/datasets/<user>/<repo>/resolve/main/releases/seqedge-release.tar.gz
NEXT_PUBLIC_RELEASE_ARCHIVE_SIZE=12.5 GB
NEXT_PUBLIC_RELEASE_ARCHIVE_MODE=cli
NEXT_PUBLIC_REFERENCE_BUNDLE_URL=https://huggingface.co/datasets/<user>/<repo>/resolve/main/reference/reference-bundle.zip
NEXT_PUBLIC_REFERENCE_BUNDLE_SIZE=180 MB
NEXT_PUBLIC_REFERENCE_BUNDLE_MODE=direct
```

可选的创建者回复与邮件变量：

```bash
GITHUB_ADMIN_USERNAME=your-github-login
FEEDBACK_EMAIL_API_URL=https://your-mail-service.example/send
FEEDBACK_EMAIL_API_KEY=your_mail_api_key
FEEDBACK_EMAIL_TO=owner@example.org
```

注意事项：

- 生产环境的 API 路由建议使用 `SUPABASE_SERVICE_ROLE_KEY`。
- 若文件存放在子目录，请在 `NEXT_PUBLIC_STORAGE_BASE_URL` 中包含该前缀。
- 支持直接读取 Hugging Face，但 Worker 是最可靠的 JBrowse 读取路径。
- 启用创建者回复：在 Supabase 中启用 GitHub 身份认证（见 [创建者回帖设置](#创建者回帖设置)），并将 `GITHUB_ADMIN_USERNAME` 设为唯一被允许回帖的 GitHub 登录名。

### 3. 初始化数据库

在 Supabase SQL 编辑器中运行 `schema.sql`，随后将真实元数据至少导入到以下表：

- `genome_samples`
- `predicted_promoters`
- `variant_index`

仅创建 schema 不会填充首页统计数据。

### 4. 本地运行

```bash
npm run dev
```

### 5. 生产环境构建

```bash
npm run build
npm run start
```

### 6. 部署

Vercel：

- 构建命令：`npm run build`
- 输出：Next.js 默认

Cloudflare Pages：

- 构建命令：`npm run build:cf`
- 预览命令：`npm run preview:cf`
- 部署命令：`npm run deploy:cf`
- 输出目录：`.open-next`

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 基因组浏览器说明

为获得最佳 JBrowse 性能，请配置 Cloudflare Worker 代理。SeqEdge 按以下顺序探测：

1. 外部 `NEXT_PUBLIC_HF_PROXY_URL`
2. 内置 `/api/hf-proxy/<file>` 路由
3. 直接读取 Hugging Face

若浏览器仍提示 `参考数据不可达`，通常是以下其中一项配置有误：

- `NEXT_PUBLIC_STORAGE_BASE_URL`
- `NEXT_PUBLIC_REFERENCE_FASTA_INDEX`
- Hugging Face 数据集子目录
- Worker 部署或 `HF_REPO_BASE`

当存在真实轨道时，SeqEdge 也会自动打开首个可访问的注释轨道，避免浏览器落入 `无活动轨道` 状态。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 在何处配置下载

- 总览下载卡片：`src/site-config.ts`
- 样本级下载元数据：`genome_samples.vcf_download_url`、`genome_samples.fasta_download_url`
- 大文件 CLI 操作：将 `vcf_download_mode` 或 `fasta_download_mode` 设为 `cli`

## 用户指南内容

应用内的用户指南涵盖四个部分：

1. 浏览数据
2. 下载数据
3. 讨论
4. 站点创建者指南

用户可在此了解大文件的浏览器下载与 CLI 下载的区别，以及如何使用内置反馈渠道。

## 讨论

SeqEdge 内置了一个面向科研交流的轻量互动区域：

- 点击 `讨论` 标签页浏览帖子并打开悬浮编辑器。任何人都可以用 GitHub 登录发帖。
- 留言支持标题、姓名或昵称、邮箱、可选所属机构、分类、评分与可见性。
- 留言可为 `公开` 或 `仅创建者`（私密）。
- `讨论` 标签页将帖子分为 `进行中` 与 `已完成` 两类展示。
- 创建者回复会显示在站点上，配置邮件 API 时也可同时发送邮件。
- 回复操作仅限与 `GITHUB_ADMIN_USERNAME` 匹配的 GitHub 账号。
- 每条帖子都会显示发布与回复的时间戳。
- 访客还可以留下 `点赞` 与 `收藏` 反馈。

该功能所需的数据库对象已包含在 `schema.sql` 中。
所需环境变量已在 `.env.example` 中列出。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 创建者回帖设置

要让站点所有者在浏览器中登录并回复：

### 1. 在 Supabase 中启用 GitHub 认证

在 Supabase 控制台，进入 **Authentication** → **Sign In / Providers**（位于 CONFIGURATION 下，而非 OAuth Server）。在服务商列表中找到 **GitHub**，展开并启用 **Sign in with GitHub**。

### 2. 配置 Supabase 认证 URL（生产环境关键步骤）

启用 GitHub 认证后，请更新 URL 配置，使 OAuth 回调跳转到生产站点而非本地：

1. 在 Supabase 控制台，进入 **Authentication** → **URL Configuration**
2. 将 **Site URL** 设为生产域名，例如 https://seq-edge.vercel.app
3. 在 **Redirect URLs** 中添加所有已部署域名（每行一个）：
   - https://seq-edge.vercel.app
   - https://seq-edge.vercel.app/**
   - https://seqedge.pages.dev
   - https://seqedge.pages.dev/**
4. 点击 **Save**

若 Site URL 仍保持默认的 http://localhost:3000，OAuth 登录会把用户重定向到该地址，而该地址在生产环境中并不存在，会显示连接被拒绝的页面。

### 3. 获取 GitHub OAuth 凭据

1. 进入 GitHub → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**
2. **Application name**：例如 `SeqEdge Auth`
3. **Homepage URL**：`https://seq-edge.vercel.app`（本地开发可填 `http://localhost:3000`）
4. **Authorization callback URL**：`https://<your-project>.supabase.co/auth/v1/callback`
5. 点击 **Register application**，随后点击 **Generate a new client secret**（请立即保存——仅显示一次）
6. 将 **Client ID** 与 **Client Secret** 复制回 Supabase 并点击 **Save**

### 4. 配置环境

在 `.env.local` 或部署控制台中将 `GITHUB_ADMIN_USERNAME` 设为允许回帖的 GitHub 登录名。任何其他已登录的 GitHub 账号可查看但不能发布创建者回复。

随后通过站点右上角的 `使用 GitHub 登录` 按钮登录。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 邮件通知设置（Resend）

SeqEdge 使用 [Resend](https://resend.com) 向站点创建者发送反馈通知邮件。

### 测试模式（无需域名）

Resend 提供无需 DNS 域名验证的免费测试模式：

1. 在 [resend.com](https://resend.com) 注册并进入 **API Keys**
2. 创建新的 API 密钥并复制
3. 测试发件地址为 `onboarding@resend.dev`——无需域名验证
4. 测试模式下，邮件仅会投递到你自己已验证的邮箱地址

### 环境变量

```bash
FEEDBACK_EMAIL_API_URL=https://api.resend.com/emails
FEEDBACK_EMAIL_API_KEY=re_xxxxxxxxxxxx
FEEDBACK_EMAIL_TO=1641454426@qq.com
```

- `FEEDBACK_EMAIL_API_URL`——Resend API 端点（始终为 `https://api.resend.com/emails`）
- `FEEDBACK_EMAIL_API_KEY`——你的 Resend API 密钥（以 `re_` 开头）
- `FEEDBACK_EMAIL_TO`——接收反馈通知的邮箱地址

### 获取 API 密钥

1. 进入 [resend.com/api-keys](https://resend.com/api-keys)
2. 点击 **Create API Key**
3. 为其命名（例如 `SeqEdge`）
4. 将权限设为 **Sending access**
5. 立即复制密钥——仅显示一次

### 转为生产模式（需自有域名）

测试模式仅投递至你自己已验证的邮箱。若要将回复邮件发送给任意访客，需要验证一个自有自定义域名。

**域名验证分步指引：**

1. 进入 [resend.com/domains](https://resend.com/domains)
2. 点击 **Add Domain**
3. 输入发件子域名，例如 `mail.yourdomain.com`（Resend 建议使用子域名而非根域名）
4. 选择区域（若不在欧洲则选 `us-east-1`）
5. 点击 **Add**——Resend 会生成三条 DNS 记录：
   - **DKIM TXT 记录**——主机：`resend._domainkey.mail`，值：一串长 TXT 字符串（每个域名唯一）
   - **SPF TXT 记录**——主机：`mail`，值：`v=spf1 include:spf.resend.io ~all`
   - **Return-path MX 记录**——主机：`mail`，值：`feedback.resend.io`，优先级：`10`
6. 进入你的 DNS 服务商（Cloudflare、Namecheap、阿里云 DNS 等）
7. 按所示逐条添加记录——TTL 保持默认或 3600
8. 返回 Resend 域名页面并点击 **Verify DNS Records**
9. DNS 生效可能需要几分钟；Resend 会在完成时显示绿色对勾
10. 验证通过后，将发件地址从 `onboarding@resend.dev` 改为 `seqedge@mail.yourdomain.com`

**免费域名的限制：** 若部署在 `pages.dev` 或 `vercel.app`，由于你不拥有这些域名，无法为其添加 DNS 记录。要使用生产模式需要自有已注册域名。在此之前，测试模式足以接收反馈通知。

**推荐的发件配置：**

- **方案 A（生产）：** 自有域名 + 已验证的 Resend 域名 → 可发送给任意人
- **方案 B（测试，当前）：** 无需域名 → `onboarding@resend.dev` 发件人 → 仅投递至 `FEEDBACK_EMAIL_TO`

如果你刚开始使用，方案 B 就足够了。拥有自定义域名后再切换到方案 A。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 站点运行时长

页脚会显示实时的运行时长计数器：

`本站点已运行：X d X h X m X s`

请在 `src/site-config.ts` 的 `uptime.startAt` 中设置起始时间戳。

## 技术栈

- [Next.js](https://nextjs.org/docs) `15.5.21`
- [React](https://react.dev/learn) `19.2.4`
- [`@supabase/supabase-js`](https://supabase.com/docs/reference/javascript/introduction) `^2.110.7`
- [`@jbrowse/product-core`](https://jbrowse.org/jb2/docs/) `^4.3.0`
- [`@jbrowse/react-linear-genome-view`](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view) `^3.1.0`
- [`@tanstack/react-table`](https://tanstack.com/table/latest/docs/guide/introduction) `^8.21.3`
- [ECharts](https://echarts.apache.org/handbook/en/get-started/) `^6.1.0`
- [`@opennextjs/cloudflare`](https://open.nextjs.org/cloudflare) `^1.20.2`
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) `^4.113.0`

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 致谢

SeqEdge 构建于强大的开源生态系统。这些项目使模板在面向科研的子基因组应用中切实可用。

| 项目 | 作用 |
| --- | --- |
| [Next.js](https://nextjs.org/) | 前端框架与应用运行时 |
| [Supabase](https://supabase.com/) | 托管 PostgreSQL 与 API 层 |
| [JBrowse 2](https://jbrowse.org/jb2/) | 交互式基因组浏览器基础 |
| [Cloudflare R2](https://www.cloudflare.com/products/r2/) | 大型基因组资源的存储层 |
| [Vercel](https://vercel.com/) | 部署与边缘分发 |
| [TanStack Table](https://tanstack.com/table) | 子与位点表格的数据网格行为 |
| [Apache ECharts](https://echarts.apache.org/) | 汇总分析的图表渲染 |
| [Tailwind CSS](https://tailwindcss.com/) | 一致的 UI 样式 |

### 工具出处与引用

| 工具 | 版本 | 出处 |
| --- | --- | --- |
| [Next.js](https://nextjs.org/docs) | `15.5.21` | 官方文档 |
| [React](https://react.dev/learn) | `19.2.4` | 官方学习文档 |
| [`@supabase/supabase-js`](https://supabase.com/docs/reference/javascript/introduction) | `^2.110.7` | Supabase JavaScript 客户端官方文档 |
| [`@jbrowse/product-core`](https://jbrowse.org/jb2/docs/) | `^4.3.0` | JBrowse 2 官方文档 |
| [`@jbrowse/react-linear-genome-view`](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view) | `^3.1.0` | npm 包说明 |
| [JBrowse 2](https://www.nature.com/articles/s41587-023-01780-9) | 集成运行时 | Buels R, et al. *JBrowse 2: a modular genome browser with views of synteny and structural variation*. Nature Biotechnology. 2023 |
| [`@tanstack/react-table`](https://tanstack.com/table/latest/docs/guide/introduction) | `^8.21.3` | 官方文档 |
| [ECharts](https://echarts.apache.org/handbook/en/get-started/) | `^6.1.0` | 官方入门手册 |
| [`@opennextjs/cloudflare`](https://open.nextjs.org/cloudflare) | `^1.20.2` | OpenNext Cloudflare 官方文档 |
| [Wrangler](https://developers.cloudflare.com/workers/wrangler/) | `^4.113.0` | Cloudflare Workers CLI 官方文档 |

SeqEdge 也借鉴了 [EPD](https://epd.fl.ch/)、[DBTSS](https://dbtss.hgc.jp/) 与 [RegulonDB](https://regulondb.ccg.unam.mx/) 等经典子基因组数据库，并采用云原生部署模型进行了更新。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 必要保留文件

为保留当前功能集，请保留以下文件：

- `src/`
- `schema.sql`
- `README.md`
- `README.zh-CN.md`
- `cloudflare-templates/hf-proxy/`
- `scripts/`
- `public/seqedge-github-img-readme.jpg`

`public/` 下默认的模板 SVG 资源（文件、地球等）未被使用，可删除。

## 验证

推送前建议检查：

```bash
npm run lint
npm run build
```

若在填入真实环境变量后两者均通过，则仓库已准备好进行部署测试。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

<!-- LINK GROUP -->
[back-to-top]: https://img.shields.io/badge/Back_to_Top-⬆-blue?style=flat-square
