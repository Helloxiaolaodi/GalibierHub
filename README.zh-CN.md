<a id="readme-top"></a>

# SeqEdge

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
- 通过统一的下载弹窗下载参考序列包、发布归档文件与样本级文件，并查看浏览器下载、`wget`、`curl` 与 `hf download` 命令。
- 在下载弹窗中查看文件名、文件类型、文件大小、创建 / 更新时间、下载次数、访问模式、MD5 与 SHA256。
- 一键复制 SHA256，并使用支持断点续传的命令行方式下载大文件。
- 为公开的样本级文件生成批量下载脚本，导出为 `.sh` 与 `.bat`。
- 通过 `讨论` 标签页提交公开或仅创建者可见的留言，并在同一页面查看帖子状态。
- 使用被授权的 GitHub 创建者账号登录并发布官方回复。
- 在讨论区上传图片，看到提交成功 / 失败提示，并点击已发布图片进行放大查看。
- 在帖子卡片与详情视图中查看点赞和收藏情况。
- 在页面底部查看站点运行时长计数器。

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 当前下载策略

SeqEdge 采用适合免费层级的拆分式流程：

- 单文件下载：统一弹出一个下载窗口，同时提供浏览器下载、`wget -c`、`curl -L -C -` 与 `hf download`
- 大文件：明确提供支持断点续传的命令行方案；对于 Hugging Face 大文件，优先推荐 `hf download`
- JBrowse 流式读取：使用代理/回退链进行索引化浏览器读取
- 批量下载：仅为公开文件生成 `.sh` 与 `.bat` 脚本
- 完整性与元数据：在弹窗中显示下载次数、MD5、SHA256、访问模式、隐藏/密码标记与区域提示
- 私有下载：若文件存放于 Supabase 私有 bucket，则可通过 `/api/download-metadata/resolve` 动态签发带时效的 signed URL

这样可以把数 GB 级别的传输排除在代理路径之外，同时保留可续传的命令行下载体验；当文件迁移到 Supabase 私有存储时，也能启用真正的私有下载链路。

## 上传数据到 Hugging Face

SeqEdge 的大体量文件（发布归档、参考序列包、样本级文件）托管在 Hugging Face 的数据集仓库中，默认为 `https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data`。项目创建者用 Hugging Face 命令行工具上传这些文件。

### 1. 安装命令行工具

`hf` 命令随 `huggingface_hub` 一起提供：

```bash
pip install -q "huggingface_hub"
```

Windows 上，可执行文件可能装在当前用户的 `Scripts` 目录下（未加入 PATH）。可将该目录加入 PATH，或直接用全路径调用，例如 `C:\Users\<你>\AppData\Local\Packages\PythonSoftwareFoundation.Python.3.13_...\LocalCache\local-packages\Python313\Scripts\hf.exe`。

### 2. 登录

两种方式：

```bash
hf auth login          # 粘贴 https://huggingface.co/settings/tokens 里的令牌
# 或者用环境变量：
export HF_TOKEN=hf_xxxxxxxxxxxx   # Linux/macOS
$env:HF_TOKEN = "hf_xxxxxxxxxxxx" # Windows PowerShell
```

用 `hf auth whoami` 验证，会输出 `user=<你的用户名>`。

### 3. 上传文件或文件夹

通用格式：

```bash
hf upload <用户名/数据集名> <本地路径> <仓库内目标路径> --repo-type dataset
```

示例（把约 590 MB 的压缩包传到数据集的某个子文件夹，不存在会自动创建）：

```bash
hf upload Helloxiaolaodi/seqedge-data "E:\data\817-food-biochem-materials.zip" "817-food-biochem/817-food-biochem-materials.zip" --repo-type dataset
```

- `--repo-type dataset` 表示数据集仓库（而非模型仓库）。
- 子文件夹在上传时隐式创建。
- 成功后会打印一个 commit 链接，形如 `https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/commit/<sha>`。

### 4. 断点续传

`hf upload`（以及 `hf download`）会复用已传完的暂存分片，中途中断不会从零开始。若运行超时或报网络错误，直接重跑同一命令即可续传。

### 5. 加速与 Xet 引擎

新版 `huggingface_hub`（>= 0.30）用 Xet 引擎取代了旧的 `hf_transfer` 包。开启高性能传输：

```bash
export HF_XET_HIGH_PERFORMANCE=1    # Linux/macOS
$env:HF_XET_HIGH_PERFORMANCE = "1"  # Windows PowerShell
```

旧的 `HF_HUB_ENABLE_HF_TRANSFER` 已废弃。如果你的代理无法与 `*.xethub.hf.co` 完成 TLS 握手，可退回兼容的 HTTP 通道：

```bash
export HF_HUB_DISABLE_XET=1         # Linux/macOS
$env:HF_HUB_DISABLE_XET = "1"       # Windows PowerShell
```

### 6. 代理技巧

Hugging Face 的长期数据存储在 AWS S3（美东）。亚洲直连或走亚洲节点代理都要跨太平洋骨干网，上行通常只有数百 KB/s。**改用美国节点**代理，路径变为 `本地 -> 美国节点 -> 美国区内网络 -> Hugging Face`，速度有质的提升。

在终端设置 HTTP 代理（用 HTTP 协议兼容性最好）：

```bash
export HTTP_PROXY=http://127.0.0.1:7897 HTTPS_PROXY=http://127.0.0.1:7897   # Linux/macOS
$env:HTTP_PROXY="http://127.0.0.1:7897"; $env:HTTPS_PROXY="http://127.0.0.1:7897" # Windows PowerShell
```

上传前先确认代理是否真正生效：

```bash
curl -I https://huggingface.co   # 出现 "HTTP/1.1 200 Connection established" 即代理 CONNECT 成功
```

### 7. 实战经验

在亚洲地区上传约 592 MB 压缩包，使用美国节点代理并设置 `HF_HUB_DISABLE_XET=1`（当地代理对 Xet 端点 TLS 握手失败），约十分钟一次成功（含超时后自动续传）。可用列出数据集目录树的方式核对已传文件：

```bash
curl -sL "https://huggingface.co/api/datasets/Helloxiaolaodi/seqedge-data/tree/main/817-food-biochem"
```

返回中包含 `size`（字节数）与 LFS 的 `oid`，后者即为文件的 SHA-256。

### 8. 下载大文件（给使用者）

下载是上传的镜像。几百 MB 到数 GB 的文件优先用 HF 命令行工具，支持断点续传且多并发：

```bash
pip install -q "huggingface_hub"
hf download Helloxiaolaodi/seqedge-data 817-food-biochem/817-food-biochem-materials.zip --repo-type dataset --local-dir .
```

经典命令同样支持断点续传：

```bash
wget -c -O <文件名> "<resolve url>"        # -c 续传未完成的下载
curl -L -C - -o <文件名> "<resolve url>"   # -C - 续传
```

三种方式都支持断点续传；亚洲用户用 HF 命令行工具吞吐最高、手动重试最少。
## 部署模型

SeqEdge 将三部分解耦：

- 元数据存放于 Supabase / PostgreSQL
- 大型基因组文件存放于对象存储或 Hugging Face Datasets
- 应用 UI 部署在 Vercel 或 Cloudflare Pages

推荐的生产环境布局：

1. Vercel 作为主站
2. Cloudflare Pages 作为镜像站
3. Cloudflare Worker 用于 Hugging Face 代理

主界面当前已有四个标签页：**Overview**、**Records**（记录表格 + 基因组浏览器）、**Discussion** 与 **Downloads**。

需要说明的是：仓库当前已发布的默认 UI 和默认数据模型仍然是偏基因组 / promoter 场景的命名。未来模板使用者可以再做泛化，但当前代码本身仍以 promoter 和 genome 相关字段为主。

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
NEXT_PUBLIC_GITHUB_ADMIN_USERNAME=your-github-login
FEEDBACK_EMAIL_API_URL=https://your-mail-service.example/send
FEEDBACK_EMAIL_API_KEY=your_mail_api_key
FEEDBACK_EMAIL_TO=owner@example.org
```

注意事项：

- 生产环境的 API 路由建议使用 `SUPABASE_SERVICE_ROLE_KEY`。
- 若文件存放在子目录，请在 `NEXT_PUBLIC_STORAGE_BASE_URL` 中包含该前缀。
- 支持直接读取 Hugging Face，但 Worker 是最可靠的 JBrowse 读取路径。
- 启用创建者回复：在 Supabase 中启用 GitHub 身份认证（见 [创建者回帖设置](#创建者回帖设置)），同时将 `GITHUB_ADMIN_USERNAME` 用于服务端回帖鉴权，并将 `NEXT_PUBLIC_GITHUB_ADMIN_USERNAME` 用于前端创建者控制界面的鉴权。

### 3. 初始化数据库

在 Supabase SQL 编辑器中运行 `schema.sql`，随后将真实元数据至少导入到以下表：

- `genome_samples`
- `predicted_promoters`
- `variant_index`

对于当前这套功能，`schema.sql` 还需要同时创建前端真实使用到的互动与下载控制对象：

- `site_feedback`
- `feedback_comments`
- `site_reactions`
- `download_metadata`
- `feedback-images` 存储桶及其策略

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

- Overview 标签页中的精选下载卡片：`src/site-config.ts`
- 样本级下载元数据：`genome_samples.vcf_download_url`、`genome_samples.fasta_download_url`、`genome_samples.gb_download_url`、`genome_samples.bed_download_url`、`genome_samples.gff3_download_url` 及相关 `*_download_mode` 字段
- 统一下载元数据结构与命令生成：`src/lib/download-info.ts`
- 单文件下载弹窗与创建者编辑能力：`src/components/download-actions.tsx`
- 公开文件的批量脚本生成：`src/components/promoter-table.tsx` 与 `/api/samples/batch`
- 独立的站内下载目录与按路径层级逐层浏览展示：`src/components/download-catalog-panel.tsx` 与 `/api/download-catalog`
- 私有 signed URL 解析：`/api/download-metadata/resolve`，底层依赖 `download_metadata` 表

## 如何把 Hugging Face 文件接入 SeqEdge

当前代码里，Hugging Face 文件有三个实用接入点：

1. 首页精选下载卡片
2. 样本级下载入口（显示在记录详情浮层和独立详情页中）
3. 独立的 `Downloads` 标签页，按路径层级逐层浏览站内可下载文件，并复用同一套统一下载弹窗

### 1. 先使用正确的直链 URL

不要把包含 `/blob/main/` 的 Hugging Face 页面地址直接填入数据库。

- 页面地址示例：`https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/blob/main/817-food-biochem/817-food-biochem-materials.zip`
- 直链地址示例：`https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/817-food-biochem/817-food-biochem-materials.zip`

SeqEdge 现在会把常见的 Hugging Face `blob` 链接自动规范化为 `resolve` 链接，但数据库和环境变量里仍然建议直接保存真正的文件直链。

### 2. 让文件显示在首页

设置首页精选下载对应的环境变量：

```bash
NEXT_PUBLIC_RELEASE_ARCHIVE_LABEL=Download 817 Food Biochem Materials
NEXT_PUBLIC_RELEASE_ARCHIVE_DESCRIPTION=Public Hugging Face dataset package for large-file download, browser delivery, and resume-capable CLI retrieval.
NEXT_PUBLIC_RELEASE_ARCHIVE_URL=https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/817-food-biochem/817-food-biochem-materials.zip
NEXT_PUBLIC_RELEASE_ARCHIVE_SIZE=~700 MB
NEXT_PUBLIC_RELEASE_ARCHIVE_MODE=cli
```

这样 Overview 标签页中的精选下载卡片就会显示该文件，并打开统一下载弹窗。只要该文件同时进入站内下载目录，它也可以出现在独立的 `Downloads` 标签页中，供访问者从数据集根目录开始逐层浏览。

### 3. 让同一个文件显示为样本级下载入口

当前 UI 已经会在悬浮详情面板和独立详情页里渲染以下样本级文件槽位：

- `vcf_download_url`
- `fasta_download_url`
- `gb_download_url`
- `bed_download_url`
- `gff3_download_url`

对于来自 Hugging Face 的通用压缩包，当前 schema 下最稳妥的做法是把它接到 `gb_download_url` 这个槽位。当前 UI 会把这个槽位显示成 `Download Package`。

示例 SQL：

```sql
update genome_samples
set gb_download_url = 'https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/817-food-biochem/817-food-biochem-materials.zip'
where sample_id = 'CNhs10881';
```

这样访问对应记录时，就能在详情浮层和详情页中看到这个样本级下载入口。

如果你还希望同一个文件在独立 `Downloads` 标签页中出现，可继续通过 `download_metadata` 绑定这条文件记录。这样用户无论从 Overview、Records 还是 Downloads 进入，最终看到的都是同一套单文件下载弹窗结构。

### 4. 补充隐藏 / 密码 / 元数据控制

如果文件仍然放在公开 Hugging Face 仓库中，你仍然可以通过 `download_metadata` 表给它补充站内元数据和 UI 控制，例如自定义标题、描述、哈希值、隐藏标记和密码提示。

示例：

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

需要明确的是：如果底层仍然是公开 Hugging Face `resolve` URL，那么隐藏/密码依然只是站内 UI 控制，不能阻止别人绕过网站直接匿名下载。

### 5. 什么时候才算真正的私密下载

如果你需要真正受控的下载链路，应把文件放到 Supabase 私有 bucket 中，并把对应 `download_metadata.storage_provider` 设为 `supabase_private`。SeqEdge 会通过 `/api/download-metadata/resolve` 动态签发短时有效的 signed URL。

这才是当前代码里已经完整落地的真实私密下载方案。

## 用户指南内容

应用内的用户指南现在只面向网站访问者，并保持简洁。它只解释四个主界面的用法：

1. Overview
2. Records
3. Discussion
4. Downloads

它的目标是让访问者快速上手使用网站，而不是承担部署说明或创建者专用配置文档的角色。

## 讨论

SeqEdge 内置了一个面向科研交流的轻量互动区域：

- 点击 `讨论` 标签页浏览帖子并打开悬浮编辑器。任何人都可以用 GitHub 登录发帖。
- 留言支持标题、姓名或昵称、邮箱、可选所属机构、分类、评分与可见性。
- 留言可为 `公开` 或 `仅创建者`（私密）。
- `讨论` 标签页将帖子分为 `进行中` 与 `已完成` 两类展示。
- 帖子支持排序，包含 `Most liked` 视图。
- 创建者回复会显示在站点上，配置邮件 API 时也可同时发送邮件。
- 回复操作仅限与 `GITHUB_ADMIN_USERNAME` 匹配的 GitHub 账号；同时浏览器中的创建者控制界面还要求 `NEXT_PUBLIC_GITHUB_ADMIN_USERNAME` 与其保持一致。
- 每条帖子都会显示发布与回复的时间戳。
- 访客可以留下 `点赞` 与 `收藏`，并且这些计数会在列表视图和详情视图中同时显示。
- 图片上传和留言提交都会显示成功 / 失败提示。
- 已发布图片支持点击后放大查看。

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

在 `.env.local` 或部署控制台中，将 `GITHUB_ADMIN_USERNAME` 与 `NEXT_PUBLIC_GITHUB_ADMIN_USERNAME` 都设为同一个允许回帖的 GitHub 登录名。任何其他已登录的 GitHub 账号可查看但不能发布创建者回复。

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

## 友情链接

- [LINUX DO](https://linux.do/) — 下一代 Linux 社区

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


## 许可证

本项目基于 [MIT 许可证](LICENSE) 授权。

<div align="right">

[![][back-to-top]](#readme-top)

</div>


---

## 数据访问控制：诚实说明的限制

只有当文件走 signed URL 这条链路时，「隐藏文件」与「下载密码」才构成真正的访问控制。当前代码中，这条真实的私有下载路径已经实现给 `download_metadata.storage_provider = supabase_private` 的条目：站点会先校验可选密码，再由后端签发短时有效的 Supabase signed URL。

如果底层文件仍然放在**公开可读**的 Hugging Face dataset 仓库中，那么隐藏/密码依旧只是**站内 UI 层面的便捷控制**。任何人只要拿到 `https://huggingface.co/datasets/<用户>/<仓库>/resolve/main/<路径>` 这个 URL，就能用 `wget`/`curl`/`hf download` 直接下载，完全绕过站点。公开 Hugging Face URL 生成的批量下载脚本同样存在这个限制。

如果需要**真正的访问控制**，二选一/三选一：

- 把大文件放在 **私有** Supabase Storage bucket，由经过鉴权的 API 路由生成**带签名、有时限的 URL** 下发。这也是当前代码已经接入的保护方案。
- 将 Hugging Face dataset 仓库设为 **private**（仅持有授权令牌的用户可读）。注意：此时默认 `resolve` URL 需要 HF access token，公网的站内下载会失效，除非你另外实现自己的受控代理层。
- 把敏感文件迁移到自带 gating 的平台（如 Hugging Face 的 gated dataset，由携带令牌的用户下载）。

一句话：公开 HF URL + 隐藏/密码 = 劝退站内随手下载；私有 signed storage = 阻止匿名用户直接下载。

<!-- LINK GROUP -->
[back-to-top]: https://img.shields.io/badge/Back_to_Top-⬆-blue?style=flat-square
