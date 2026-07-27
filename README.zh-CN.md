<a id="readme-top"></a>

# SeqEdge

边缘原生基因组数据库模板

SeqEdge 是一个用于构建坐标型基因组门户的开源模板，整合了可检索元数据、嵌入式基因组浏览器、图表、讨论区工作流，以及大文件与前端解耦的部署方式。

**主站：** [https://seq-edge.vercel.app](https://seq-edge.vercel.app)  
**镜像：** [https://seqedge.pages.dev](https://seqedge.pages.dev)  
**GitHub：** [https://github.com/Helloxiaolaodi/SeqEdge](https://github.com/Helloxiaolaodi/SeqEdge)

语言：**简体中文** | [English](./README.md) | [问题反馈](https://github.com/Helloxiaolaodi/SeqEdge/issues)

详细搭建指南：[SeqEdge 开发者笔记](https://www.cnblogs.com/Administrator/p/21776736)

技术栈：Next.js | React | Supabase | Cloudflare R2 | Hugging Face Datasets | Cloudflare Workers | JBrowse 2 | TanStack Table | ECharts

![License](https://img.shields.io/github/license/Helloxiaolaodi/SeqEdge?style=flat-square)
![Stars](https://img.shields.io/github/stars/Helloxiaolaodi/SeqEdge?style=flat-square)
![Forks](https://img.shields.io/github/forks/Helloxiaolaodi/SeqEdge?style=flat-square)
![Issues](https://img.shields.io/github/issues/Helloxiaolaodi/SeqEdge?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-15.5.21-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-2.110.7-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?style=flat-square&logo=vercel)

## 目录

1. [项目概览](#项目概览)
2. [SeqEdge 当前包含的能力](#seqedge-当前包含的能力)
3. [协作与署名说明](#协作与署名说明)
4. [架构与部署模型](#架构与部署模型)
5. [快速开始](#快速开始)
6. [数据与下载工作流](#数据与下载工作流)
7. [讨论区与管理员运维](#讨论区与管理员运维)
8. [维护说明](#维护说明)
9. [技术栈与参考资料](#技术栈与参考资料)
10. [已知限制：数据访问控制](#已知限制数据访问控制)
11. [许可证](#许可证)

## 项目概览

SeqEdge 当前主要包含四个核心界面：

- **Overview**：首页概览、统计卡片、特色下载入口与图表。
- **Records**：记录表格、筛选、详情面板与嵌入式基因组浏览器。
- **Discussion**：公开或仅管理员可见的留言讨论区，支持图片、点赞、收藏与回帖。
- **Downloads**：站点级文件目录，可浏览层级结构并统一调用下载弹窗。

需要说明的是，当前默认数据结构与界面命名仍然偏向 promoter / genome 的基因组场景。后续 fork 使用者可以自行泛化，但仓库目前仍以基因组数据库模板为主。

### 预览媒体

![SeqEdge 架构图](./docs/architecture.gif)

*README 中使用的架构演示 GIF。媒体署名：由 **Gemini 3.1 Pro** 生成。*

![SeqEdge 界面与主要功能总览](./docs/media/seqedge-ui-overview.png)

*README 中使用的界面与主要功能总览图。媒体署名：由 **Gemini 3.1 Pro** 生成。*

## SeqEdge 当前包含的能力

### 访客与使用者可完成的操作

- 按位点、基因、评分、样本、物种、组织、队列与 BMI 分级检索和筛选记录。
- 打开嵌入式基因组浏览器，并从记录直接跳转到对应区域。
- 在可悬浮、可缩放的详情面板中查看记录细节，而不遮挡浏览器主体。
- 通过统一下载弹窗获取参考序列包、发布归档与样本级文件。
- 在同一弹窗中查看浏览器下载、`wget`、`curl` 与 `hf download` 命令。
- 查看文件名、类型、大小、创建与更新时间、下载次数、访问模式、MD5 与 SHA256。
- 一键复制 SHA256，并通过支持断点续传的命令行下载大文件。
- 为公开样本文件生成 `.sh` 与 `.bat` 批量下载脚本。
- 在 `Discussion` 标签页提交公开留言或仅管理员可见留言。
- 使用被授权的 GitHub 管理员账号登录并发布官方回复。
- 在讨论区上传图片，并通过可放大的灯箱查看已发布图片。
- 在列表与详情中查看点赞和收藏。
- 在页脚查看同时包含站点运行时长与累积独立访客人数的计数器。

### 对 fork 使用者的价值

- 已经把元数据、前端界面和大文件存储拆分清楚。
- 已经具备免费层级可落地的部署路线。
- 同时覆盖研究数据展示与轻量互动交流。
- 暴露了足够多的配置入口，方便二次改造，而不是要求你从零重写。

## 协作与署名说明

### 仓库搭建者

这个 SeqEdge GitHub 仓库由 **Helloxiaolaodi** 与 **yangsanduo** 两个 GitHub 账号共同搭建、维护和迭代。这两个账号均为同一项目拥有者本人使用，用于该仓库及相关部署工作的协同维护。

### 参与本仓库搭建的 AI 工具

在本仓库的方案设计、实现、文档编写与迭代过程中，也共同使用了以下 AI 工具：

- **GLM 5.1**
- **GPT 5.4**
- **DeepSeek V4 Pro**

### README 媒体素材署名

- `docs/architecture.gif`：由 **Gemini 3.1 Pro** 生成。
- `docs/media/seqedge-ui-overview.png`：由 **Gemini 3.1 Pro** 生成。

## 架构与部署模型

SeqEdge 将三部分解耦：

- 元数据存放在 Supabase / PostgreSQL
- 大型基因组文件存放在对象存储或 Hugging Face Datasets
- 应用界面部署在 Vercel 或 Cloudflare Pages

推荐的生产环境布局：

1. Vercel 作为主站
2. Cloudflare Pages 作为镜像站
3. Cloudflare Worker 用于 Hugging Face 代理

### 当前下载策略

SeqEdge 采用适合免费层级的拆分式下载流程：

- 单文件下载统一通过一个弹窗展示浏览器下载、`wget -c`、`curl -L -C -` 与 `hf download`。
- 大文件优先展示支持断点续传的命令行方案，其中 `hf download` 是 Hugging Face 大文件的推荐方式。
- JBrowse 流式读取走代理与回退链路。
- 批量下载仅为公开文件生成 `.sh` 与 `.bat` 脚本。
- 下载弹窗中同时展示下载次数、MD5、SHA256、访问模式、隐藏/密码标识与区域提示。
- 若文件位于 Supabase 私有 bucket，可通过 `/api/download-metadata/resolve` 生成带时效的 signed URL。

这样可以避免多 GB 文件走代理路径，同时保留终端断点续传体验，并在文件迁移到私有存储后实现真正的私有下载。

## 快速开始

### 1. 安装

```bash
git clone https://github.com/<your-account>/SeqEdge.git
cd SeqEdge
npm install
```

### 2. 配置环境变量

将 `.env.example` 复制为 `.env.local`，再替换其中占位内容。

必填数据库变量：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

必填基因组存储变量：

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

管理员回帖与邮件通知相关变量：

```bash
GITHUB_ADMIN_USERNAME=your-github-login
NEXT_PUBLIC_GITHUB_ADMIN_USERNAME=your-github-login
FEEDBACK_EMAIL_API_URL=https://your-mail-service.example/send
FEEDBACK_EMAIL_API_KEY=your_mail_api_key
FEEDBACK_EMAIL_TO=owner@example.org
```

重要说明：

- `SUPABASE_SERVICE_ROLE_KEY` 是管理员写操作所必需的变量，用于隐藏或显示下载文件、保存 `download_metadata`、签发私有下载 URL，以及对 discussion 执行置顶、隐藏、删除、发布官方回复、隐藏或删除后续回复等服务端操作。
- 获取方式：Supabase Dashboard -> **Settings** -> **API** -> **Project API keys** -> `service_role`。
- 该变量只能保留在服务端，不能放进任何 `NEXT_PUBLIC_*` 变量。
- 不重新部署的话，新的环境变量不会进入当前构建产物。
- 若文件位于子目录，请把子目录前缀写入 `NEXT_PUBLIC_STORAGE_BASE_URL`。
- 支持直接读取 Hugging Face，但 Worker 是更稳定的 JBrowse 读取路径。
- 若要启用管理员回帖，需要在 Supabase 中启用 GitHub 认证，并将 `GITHUB_ADMIN_USERNAME` 与 `NEXT_PUBLIC_GITHUB_ADMIN_USERNAME` 设为同一个 GitHub 登录名。

### 3. 初始化数据库

在 Supabase SQL 编辑器中运行 `schema.sql`，然后至少导入以下真实数据表：

- `genome_samples`
- `predicted_promoters`
- `variant_index`

对于当前功能集，`schema.sql` 还需要创建以下交互与下载控制相关对象：

- `site_feedback`
- `feedback_comments`
- `site_reactions`
- `site_visitors`
- `download_metadata`
- `feedback-images` 的 storage bucket 与策略

只创建 schema 并不会自动填充首页统计信息。

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
- Output: Next.js 默认输出

Cloudflare Pages：

- Build command: `npm run build:cf`
- Preview command: `npm run preview:cf`
- Deploy command: `npm run deploy:cf`
- Output directory: `.open-next`

## 数据与下载工作流

### 在哪里配置下载功能

- Overview 标签页的特色下载卡片：`src/site-config.ts`
- 样本级下载字段：`genome_samples.vcf_download_url`、`genome_samples.fasta_download_url`、`genome_samples.gb_download_url`、`genome_samples.bed_download_url`、`genome_samples.gff3_download_url` 及相关 `*_download_mode`
- 统一下载元数据模型与 CLI 生成逻辑：`src/lib/download-info.ts`
- 单文件下载弹窗与管理员编辑控制：`src/components/download-actions.tsx`
- 公开文件的批量脚本生成：`src/components/promoter-table.tsx` 与 `/api/samples/batch`
- 站点级下载目录与层级浏览：`src/components/download-catalog-panel.tsx` 与 `/api/download-catalog`
- 私有 signed URL 解析：`/api/download-metadata/resolve`，后端依赖 `download_metadata` 表

### Downloads 页面现在支持什么

- 标准面包屑路径导航，例如 `Downloads / seqedge-data / reference_genomes / scov2`，其中每一级父目录都可点击返回。
- 紧凑的控制栏，将目录搜索、`Copy Folder CLI`、`Export Manifest CSV`、README 按钮、批量下载 以及网格/表格视图切换集中在同一层。
- 适合大目录的表格视图，支持按 `Name`、`Size`、`Updated`、`Actions` 排序。
- 信息密度更高的卡片视图，在保留视觉浏览体验的同时补充大小与更新时间。
- 单文件操作入口拆分为浏览器下载与 CLI/详情两类按钮，避免一个按钮承载过多动作。
- 可导出机器可读的 Manifest，字段固定为 `Directory_Path`、`File_Name`、`File_Type`、`Size_Bytes`、`Direct_URL`、`SHA-256`。
- 分页显示，每页 20 个文件，大目录也能保持可浏览性。
- 批量选择与下载，支持勾选文件后统一生成浏览器下载、`wget` 和 `curl` 命令。
- README 按钮动态生成当前目录的文件结构与基本信息。

### 当前下载弹窗实际会展示什么

对于能够解析出稳定原始直链的公开文件，`Download options` 弹窗现在会在同一个窗口里统一提供四类交付入口：

- 浏览器下载
- 可直接复制给 `Free Download Manager`、`Motrix`、`IDM` 等工具使用的公开直链
- 基于 `huggingface.co` 的 `Global (Official)` 断点续传命令
- 基于 `hf-mirror.com` 的 `Asia-Pacific (Mirror)` 断点续传命令

以 `817-food-biochem-materials.zip` 为例，弹窗会在不改变数据集路径的前提下，同时提供官方线路和亚洲镜像线路。

官方线路：

```bash
wget -c -O "817-food-biochem-materials.zip" "https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/817-food-biochem/817-food-biochem-materials.zip?download=true"
curl -L -C - -o "817-food-biochem-materials.zip" "https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/817-food-biochem/817-food-biochem-materials.zip?download=true"
hf download Helloxiaolaodi/seqedge-data 817-food-biochem/817-food-biochem-materials.zip --repo-type dataset --local-dir .
```

亚洲镜像线路：

```bash
wget -c -O "817-food-biochem-materials.zip" "https://hf-mirror.com/datasets/Helloxiaolaodi/seqedge-data/resolve/main/817-food-biochem/817-food-biochem-materials.zip?download=true"
curl -L -C - -o "817-food-biochem-materials.zip" "https://hf-mirror.com/datasets/Helloxiaolaodi/seqedge-data/resolve/main/817-food-biochem/817-food-biochem-materials.zip?download=true"
HF_ENDPOINT=https://hf-mirror.com hf download Helloxiaolaodi/seqedge-data 817-food-biochem/817-food-biochem-materials.zip --repo-type dataset --local-dir .
```

这样做的目的，是让站点展示的不是名义上的下载入口，而是真正更贴近不同地区网络条件的可执行交付路径。

### 如何把 Hugging Face 文件接入 SeqEdge

当前代码支持三种常见接入方式：

1. 首页特色下载卡片
2. 记录详情中的样本级下载入口
3. `Downloads` 标签页中的站点级文件目录

#### 1. 使用正确的文件直链

不要使用包含 `/blob/main/` 的 Hugging Face 页面链接。

- 页面链接示例：`https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/blob/main/817-food-biochem/817-food-biochem-materials.zip`
- 文件直链示例：`https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/817-food-biochem/817-food-biochem-materials.zip`

SeqEdge 现在会自动把常见的 Hugging Face `blob` 链接规范化成 `resolve` 链接，但数据库和环境变量里仍建议保存真正的直链 URL。

#### 2. 让文件显示在首页

配置特色归档环境变量：

```bash
NEXT_PUBLIC_RELEASE_ARCHIVE_LABEL=Download 817 Food Biochem Materials
NEXT_PUBLIC_RELEASE_ARCHIVE_DESCRIPTION=Public Hugging Face dataset package for large-file download, browser delivery, and resume-capable CLI retrieval.
NEXT_PUBLIC_RELEASE_ARCHIVE_URL=https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/817-food-biochem/817-food-biochem-materials.zip
NEXT_PUBLIC_RELEASE_ARCHIVE_SIZE=~700 MB
NEXT_PUBLIC_RELEASE_ARCHIVE_MODE=cli
```

这样会驱动 Overview 页面上的特色下载卡片，并调用统一下载弹窗。如果该文件也被写入站点级目录，它还会出现在 `Downloads` 标签页中。

#### 3. 让同一个文件显示为样本级下载入口

当前 UI 会在浮动详情面板和独立详情页中渲染以下样本级文件槽位：

- `vcf_download_url`
- `fasta_download_url`
- `gb_download_url`
- `bed_download_url`
- `gff3_download_url`

如果是通用压缩包，在当前 schema 中最少改动的做法是使用 `gb_download_url` 作为通用文件槽位，界面中会把它显示为 `Download Package`。

示例 SQL：

```sql
update genome_samples
set gb_download_url = 'https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/817-food-biochem/817-food-biochem-materials.zip'
where sample_id = 'CNhs10881';
```

同一个文件也可以通过 `download_metadata` 接入 `Downloads` 标签页，这样无论访客从 Overview、Records 还是 Downloads 进入，都会看到一致的下载弹窗。

#### 4. 补充隐藏、密码与私有传输元数据

即使文件本身公开托管在 Hugging Face，也可以通过 `download_metadata` 叠加站点层的标签、描述、哈希、隐藏标记与密码提示等信息。

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

重要说明：对于公开的 Hugging Face `resolve` 链接，隐藏和密码仍然只是站内 UI 层控制，无法阻止知道直链的人直接匿名下载。

#### 5. 什么时候才算真正的私密下载

如果需要真正受控的下载链路，请把文件存进 Supabase 私有 bucket，并将 `download_metadata.storage_provider` 设为 `supabase_private`。此时 SeqEdge 会通过 `/api/download-metadata/resolve` 返回短时有效的 signed URL。

这也是当前代码中唯一完整实现的真实私有下载路径。

### 如何上传数据到 Hugging Face

SeqEdge 的大体量文件，例如发布归档、参考序列包和样本级文件，默认托管在 Hugging Face dataset 仓库 `https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data`。

#### 1. 安装 CLI

`hf` 命令随 `huggingface_hub` 一起安装：

```bash
pip install -q "huggingface_hub"
```

Windows 上它可能位于当前用户的 `Scripts` 目录中，必要时请手动加入 PATH 或直接使用完整路径。

#### 2. 登录

```bash
hf auth login
# 或环境变量方式：
export HF_TOKEN=hf_xxxxxxxxxxxx   # Linux/macOS
$env:HF_TOKEN = "hf_xxxxxxxxxxxx" # Windows PowerShell
```

可通过 `hf auth whoami` 验证。

#### 3. 上传文件或文件夹

```bash
hf upload <用户名/数据集名> <本地路径> <仓库内目标路径> --repo-type dataset
```

示例：

```bash
hf upload Helloxiaolaodi/seqedge-data "E:\data\817-food-biochem-materials.zip" "817-food-biochem/817-food-biochem-materials.zip" --repo-type dataset
```

#### 4. 断点续传

`hf upload` 与 `hf download` 都会复用已传输的中间数据。如果超时或网络中断，直接重新运行同一命令即可续传。

#### 5. 加速与 Xet 引擎

```bash
export HF_XET_HIGH_PERFORMANCE=1    # Linux/macOS
$env:HF_XET_HIGH_PERFORMANCE = "1"  # Windows PowerShell
```

如果代理无法与 `*.xethub.hf.co` 正常完成 TLS 握手，可改用兼容的 HTTP 通道：

```bash
export HF_HUB_DISABLE_XET=1         # Linux/macOS
$env:HF_HUB_DISABLE_XET = "1"       # Windows PowerShell
```

#### 6. 网络与代理建议

Hugging Face 长期数据位于 AWS S3 美东区域。对于亚洲网络环境，美国节点代理通常比本地或近邻节点更快。

```bash
export HTTP_PROXY=http://127.0.0.1:7897 HTTPS_PROXY=http://127.0.0.1:7897   # Linux/macOS
$env:HTTP_PROXY="http://127.0.0.1:7897"; $env:HTTPS_PROXY="http://127.0.0.1:7897" # Windows PowerShell
```

上传前可先验证代理是否生效：

```bash
curl -I https://huggingface.co
```

#### 7. 给使用者下载大文件的建议

对于数百 MB 到数 GB 的文件，更建议使用 HF CLI：

```bash
pip install -q "huggingface_hub"
hf download Helloxiaolaodi/seqedge-data 817-food-biochem/817-food-biochem-materials.zip --repo-type dataset --local-dir .
```

传统命令也支持断点续传：

```bash
wget -c -O <文件名> "<resolve url>"
curl -L -C - -o <文件名> "<resolve url>"
```

对于中国和部分亚太网络环境，镜像线路往往比官方域名更稳定，因此 SeqEdge 当前会在下载弹窗里同时展示两套命令，而不是只给一套默认说明。

### 基因组浏览器说明

为了获得更稳定的 JBrowse 体验，建议配置 Cloudflare Worker 代理。SeqEdge 的探测顺序如下：

1. 外部 `NEXT_PUBLIC_HF_PROXY_URL`
2. 内置 `/api/hf-proxy/<file>` 路由
3. 直接读取 Hugging Face

如果浏览器仍提示 `Reference data unreachable`，通常是以下任一项配置有误：

- `NEXT_PUBLIC_STORAGE_BASE_URL`
- `NEXT_PUBLIC_REFERENCE_FASTA_INDEX`
- Hugging Face dataset 子目录路径
- Worker 部署或 `HF_REPO_BASE`

当真实轨道可用时，SeqEdge 还会自动打开首个可达注释轨道，避免落在 `No tracks active` 状态。

## 讨论区与管理员运维

### 讨论区模块

SeqEdge 内置了轻量研究交流区：

- 点击 `Discussion` 标签页即可浏览讨论并打开浮动的 `New Discussion` 编辑器。
- 编辑器采用 Markdown 输入框、可视化工具栏以及 `Write` / `Preview` 双标签页，既保留纯文本效率，也能方便地插入代码块、引用、列表、表格和图片说明。
- 留言支持标题、姓名或昵称、邮箱、单位、分类、评分与可见性。
- 留言可设为 `Public` 或 `Administrator only`。
- `Discussion` 页面会按 `In progress` 与 `Completed` 归类展示讨论。
- 支持排序，包括 `Most liked` 视图。
- 左侧统计区已压缩为紧凑徽标样式，把更多横向空间让给讨论标题和较长的技术日志内容。
- 每一条讨论留言和每一个后续评论都会在站内同一条 discussion 视图下显示出来。
- 管理员回复会直接显示在站内，并以内联方式出现在对应 discussion 中。
- 访客后续评论会写入 `feedback_comments`，并在展开 discussion 后显示在页面中。
- 管理员登录后可以在 `In progress` 和 `Completed` 两个区域中置顶或取消置顶 discussion，也可以隐藏、显示或永久删除 discussion。
- 管理员还可以对单条后续回复执行隐藏、显示和删除操作。
- 被隐藏的 discussion 和回复在管理员登录后仍然可见，便于在同一界面中恢复显示；普通访客仍只会看到可见内容。
- 无论留言被设为 `Public` 还是 `Administrator only`，新的顶层 discussion 都会向管理员发送邮件通知。
- 已有 discussion 中的新评论也会向管理员发送邮件通知。
- 回复与管理权限受 `GITHUB_ADMIN_USERNAME` 限制，浏览器中的管理员操作界面同时依赖 `NEXT_PUBLIC_GITHUB_ADMIN_USERNAME`。
- discussion 的发布时间与回复时间都会显示。
- 访客可进行 `Like` 与 `Bookmark` 操作。
- 图片上传过程中会显示成功或失败反馈。

相关数据库对象已包含在 `schema.sql` 中，所需环境变量见 `.env.example`。

### 管理员回帖设置

若要让站点管理员在浏览器中登录并进行 discussion 管理：

#### 1. 在 Supabase 中启用 GitHub 认证

进入 Supabase Dashboard -> **Authentication** -> **Sign In / Providers**，找到 **GitHub** 并启用 **Sign in with GitHub**。

#### 2. 配置 Supabase 认证 URL

1. 打开 Supabase Dashboard -> **Authentication** -> **URL Configuration**。
2. 将 **Site URL** 设为生产域名，例如 `https://seq-edge.vercel.app`。
3. 在 **Redirect URLs** 中加入所有部署域名：
   - `https://seq-edge.vercel.app`
   - `https://seq-edge.vercel.app/**`
   - `https://seqedge.pages.dev`
   - `https://seqedge.pages.dev/**`
4. 保存。

如果仍保留 `http://localhost:3000`，生产环境中的 OAuth 登录会被错误重定向到本地地址。

#### 3. 获取 GitHub OAuth 凭据

1. 打开 GitHub -> **Settings** -> **Developer settings** -> **OAuth Apps** -> **New OAuth App**。
2. 设置应用名称，例如 `SeqEdge Auth`。
3. 将 **Homepage URL** 设为生产地址或本地开发地址。
4. 将 **Authorization callback URL** 设为 `https://<your-project>.supabase.co/auth/v1/callback`。
5. 注册应用并生成 client secret。
6. 将 **Client ID** 与 **Client Secret** 填回 Supabase 并保存。

#### 4. 配置环境变量

在 `.env.local` 或部署平台后台中，把 `GITHUB_ADMIN_USERNAME` 与 `NEXT_PUBLIC_GITHUB_ADMIN_USERNAME` 设为同一个允许发布官方回复并使用管理控件的 GitHub 登录名。

### 邮件通知设置（Resend）

SeqEdge 使用 [Resend](https://resend.com) 向站点管理员发送反馈通知邮件。

当前实现中，若邮件配置完整，则会发送以下几类通知：

- 每一条新的顶层 discussion，都会发邮件通知管理员；
- 上述顶层 discussion 通知同时覆盖 `Administrator only` 私有留言，而不只是公开留言；
- 每一条新的 discussion 评论，都会发邮件通知管理员；
- 当管理员发布官方回复且访客填写了邮箱时，系统会向访客发送回复通知邮件。

#### 测试模式

1. 在 [resend.com](https://resend.com) 注册并进入 **API Keys**。
2. 创建新的 API key。
3. 使用测试发件地址 `onboarding@resend.dev`。
4. 测试模式下，邮件只会投递到你自己已验证的邮箱。

#### 环境变量

```bash
FEEDBACK_EMAIL_API_URL=https://api.resend.com/emails
FEEDBACK_EMAIL_API_KEY=re_xxxxxxxxxxxx
FEEDBACK_EMAIL_TO=owner@example.org
```

#### 切换到生产模式

若要向任意访客发送回复邮件，需要在 Resend 中验证自有域名。如果你目前只部署在 `pages.dev` 或 `vercel.app`，由于并不拥有这些域名的 DNS 管理权，仍然需要额外准备自己的注册域名才能启用生产邮件发送。

## 维护说明

### fork 使用者最常关心的仓库结构

- `src/`：主应用代码
- `public/`：静态资源
- `docs/`：README 媒体与项目说明
- `schema.sql`：数据库结构与相关 SQL 对象
- `cloudflare-templates/hf-proxy/`：Cloudflare Worker 代理模板
- `scripts/`：项目脚本

### 当前功能所需保留的最小文件集

建议至少保留：

- `src/`
- `schema.sql`
- `README.md`
- `README.zh-CN.md`
- `cloudflare-templates/hf-proxy/`
- `scripts/`

`public/` 下未被当前部署使用的默认模板 SVG 资源可以自行删除。

### 站点运行时长

页脚会同时显示实时运行时长与累积访客人数：

`Site uptime: X d X h X m X s | Visitors: N`

`src/components/site-uptime.tsx` 会读取配置中的起始时间戳来显示运行时长，同时调用 `/api/visitors`，基于保存在 `localStorage` 中的持久浏览器访客 ID 计算哈希后写入 `site_visitors`，统计累积独立访客人数。这个指标更接近 `Visitors`，而不是 `Page views`：同一浏览器配置文件反复刷新通常不会重复计数，但无痕或隐私窗口由于使用隔离存储，通常会被记作新的访客。即使只配置匿名 Supabase key，首次访问也可以被计入；如果同时配置了服务端 role key，则还可以为重复访问刷新 `last_seen_at`。

起始时间戳请在 `src/site-config.ts` 的 `uptime.startAt` 中设置。

### 验证

推送前建议执行：

```bash
npm run lint
npm run build
```

如果在真实环境变量下两项都通过，则仓库已具备部署测试条件。

## 技术栈与参考资料

SeqEdge 基于一组开源工具构建，用于完成界面渲染、数据访问、基因组浏览器集成与部署发布。

| 工具 | 版本 | 功能 | 参考 |
| --- | --- | --- | --- |
| [Next.js](https://nextjs.org/docs) | `15.5.21` | 应用框架与运行时 | 官方文档 |
| [React](https://react.dev/learn) | `19.2.4` | 组件渲染与客户端状态管理 | 官方学习文档 |
| [`@supabase/supabase-js`](https://supabase.com/docs/reference/javascript/introduction) | `^2.110.7` | 数据库、认证与存储访问 | Supabase JavaScript 文档 |
| [`@jbrowse/product-core`](https://jbrowse.org/jb2/docs/) | `^4.3.0` | 嵌入式参考浏览器核心 | JBrowse 2 文档 |
| [`@jbrowse/react-linear-genome-view`](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view) | `^3.1.0` | 线性浏览器的 React 封装 | npm 页面 |
| [`@tanstack/react-table`](https://tanstack.com/table/latest/docs/guide/introduction) | `^8.21.3` | 记录表格渲染与交互 | 官方文档 |
| [ECharts](https://echarts.apache.org/handbook/en/get-started/) | `^6.1.0` | 概览图表与可视化 | 官方手册 |
| [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) | `^1.20.2` | Cloudflare 构建适配器 | OpenNext Cloudflare 文档 |
| [Wrangler](https://developers.cloudflare.com/workers/wrangler/) | `^4.113.0` | Cloudflare 部署 CLI | Cloudflare Workers CLI 文档 |

附加社区链接：

- [LINUX DO](https://linux.do/) - 新一代 Linux 社区

## 已知限制：数据访问控制

只有当文件通过 signed URL 路径分发时，单文件的 **隐藏** 和 **下载密码** 控制才构成真正的访问控制。当前代码中，这条真实的受控下载路径已经实现给 `download_metadata.storage_provider = supabase_private` 的条目：站点会先校验可选密码，再由后端生成短时有效的 Supabase signed URL。

如果底层文件仍托管在公开可读的 Hugging Face dataset 仓库中，那么隐藏和密码仍然只是站内 UI 层的便捷控制。任何知道 `https://huggingface.co/datasets/<用户>/<仓库>/resolve/main/<路径>` 的人，都可以直接用 `wget`、`curl` 或 `hf download` 绕过站点下载。

如果你需要真正的访问控制，请选择以下方案之一：

- 将大文件放入私有 Supabase Storage bucket，并通过鉴权 API 动态下发带时效的 signed URL。
- 将 Hugging Face dataset 仓库设为 private，同时接受站内公开下载不再可用，除非你额外实现自己的受控代理层。
- 将敏感文件迁移到具备内建访问控制能力的存储平台。

一句话概括：公开 HF URL 加隐藏/密码，只能阻止站内随手下载；私有 signed storage 才能阻止匿名直链下载。

## 许可证

本项目基于 [MIT 许可证](LICENSE) 授权。

[返回顶部](#readme-top)
