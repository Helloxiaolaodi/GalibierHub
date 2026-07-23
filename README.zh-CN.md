<div align="center"><a name="readme-top"></a>

![SeqEdge 截图](./seqedge-github-img-readme.jpg)

# SeqEdge

**面向边缘部署的基因组数据库模板**

一个用于搭建交互式基因组与坐标型科研数据库的开源模板，采用无服务器、存储解耦、面向对象存储优化的架构设计。

**主站**: [https://seq-edge.vercel.app](https://seq-edge.vercel.app) | **国内镜像**: [https://seqedge.pages.dev](https://seqedge.pages.dev) | **GitHub**: [https://github.com/Helloxiaolaodi/SeqEdge](https://github.com/Helloxiaolaodi/SeqEdge)

**English** | **简体中文** | [问题反馈](https://github.com/Helloxiaolaodi/SeqEdge/issues)

> **详细搭建指南**：[SeqEdge 网站搭建的详细解读](https://www.cnblogs.com/Helloxiaolaodi/p/21776373) - 从 fork、配置到生产部署的完整技术说明。

技术栈：Next.js | Supabase | Cloudflare R2 | Hugging Face Datasets | Cloudflare Workers | JBrowse 2 | TanStack Table | ECharts

![License](https://img.shields.io/github/license/Helloxiaolaodi/SeqEdge?style=flat-square)
![Stars](https://img.shields.io/github/stars/Helloxiaolaodi/SeqEdge?style=flat-square)
![Forks](https://img.shields.io/github/forks/Helloxiaolaodi/SeqEdge?style=flat-square)
![Issues](https://img.shields.io/github/issues/Helloxiaolaodi/SeqEdge?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-15.5.21-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-2.110.7-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?style=flat-square&logo=vercel)

**分享 SeqEdge**

[X / Twitter](https://twitter.com/intent/tweet?text=SeqEdge%20-%20Open-source%20genomic%20database%20template&url=https://github.com/Helloxiaolaodi/SeqEdge) · [Reddit](https://www.reddit.com/submit?url=https://github.com/Helloxiaolaodi/SeqEdge&title=SeqEdge%20-%20Open-source%20genomic%20database%20template) · [微博](https://service.weibo.com/share/share.php?title=SeqEdge%20-%20Open-source%20genomic%20database%20template&url=https://github.com/Helloxiaolaodi/SeqEdge)

<sup>开源基因组数据库模板</sup>

</div>

<details>
<summary><kbd>目录</kbd></summary>

#### TOC

- [SeqEdge](#seqedge)
  - [什么是 SeqEdge？](#什么是-seqedge)
  - [架构](#架构)
  - [快速开始](#快速开始)
  - [自定义配置](#自定义配置)
  - [功能模块](#功能模块)
  - [成本估算](#成本估算)
  - [云服务配置](#云服务配置)
  - [部署后自检清单](#部署后自检清单)
  - [技术栈](#技术栈)
  - [测试数据、来源与致谢](#测试数据来源与致谢)
  - [许可证](#许可证)

<br/>

</details>

## 什么是 SeqEdge？

SeqEdge 是一个面向科研项目的模板仓库，用于快速搭建包含元数据检索、坐标型记录展示和基因组浏览器的数据库网站。它的目标不是提供某一类固定数据，而是提供一套可以直接复用的工程骨架。

整个模板围绕三个边界展开：

- 结构化元数据放在 Supabase / PostgreSQL；
- 大体积组学文件放在对象存储；
- 浏览器端通过 JBrowse 2 按需读取所需字节范围并完成可视化。

这种拆分让数据库保持轻量，也让 BAM、CRAM、VCF、FASTA 等大文件能够继续留在成本更低、扩展性更高的对象存储中。

## 架构

```text
+-----------------------------------------------------------+
|  Vercel（主站）            Cloudflare Pages（镜像）       |
|  全球 CDN                 中国大陆更友好的边缘网络       |
|  Next.js 前端 + API       Next.js 前端 + API             |
|   +-----------+            +-----------+                 |
|   | ECharts   |            | ECharts   |                 |
|   | TanStack  |            | TanStack  |                 |
|   | Browser   |            | Browser   |                 |
|   +-----------+            +-----------+                 |
+------------------------+----------------------+-----------+
                         |                      |
                         v                      v
          +------------------------+   +------------------------+
          | Supabase               |   | 对象存储               |
          | PostgreSQL 元数据      |   | R2 / HF / S3 兼容服务  |
          | - genome_samples       |   | - FASTA + 索引         |
          | - promoters            |   | - BAM / CRAM + 索引    |
          | - variant_index        |   | - BED / BigBed / VCF   |
          +------------------------+   +------------------------+
```

**请求路径**

1. 页面外壳由 Vercel 或 Cloudflare Pages 提供。
2. 检索、统计和详情查询由 Next.js API 路由转发到 Supabase。
3. JBrowse 仅请求当前基因组区间所需的字节范围。
4. 大文件继续保留在对象存储中，不写入关系型数据库。

## 快速开始

### 环境准备

- Node.js `18+`
- npm
- 一个 Supabase 项目
- 一个支持 CORS 和 HTTP Range 请求的对象存储

### 第 1 步：Fork 并克隆仓库

```bash
git clone https://github.com/<your-account>/SeqEdge.git
cd SeqEdge
npm install
```

### 第 2 步：配置环境变量

创建 `.env.local`：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_STORAGE_BASE_URL=https://your-bucket.your-account.r2.dev/test-data
```

兼容旧变量名：

```bash
NEXT_PUBLIC_R2_PUBLIC_URL=https://your-bucket.your-account.r2.dev/test-data
```

如果你要启用 Hugging Face 代理：

```bash
NEXT_PUBLIC_STORAGE_BASE_URL=https://your-bucket.your-account.r2.dev/test-data
NEXT_PUBLIC_HF_PROXY_URL=https://seqedge-hf-proxy.your-account.workers.dev
```

### 第 3 步：初始化数据库

在 Supabase 中执行 `schema.sql`，然后导入你的元数据表。

### 第 4 步：本地运行

```bash
npm run dev
```

### 第 5 步：部署

推荐的生产部署组合：

- **Vercel**：主站
- **Cloudflare Pages**：镜像站
- **Cloudflare Worker**：当 JBrowse 需要访问 HF 文件时作为代理层

Cloudflare Pages 建议配置：

- 构建命令：`npm run build:cf`
- 输出目录：`.open-next`
- 保留 `public/demo-data`，确保同源演示回退在生产环境中可用

## 自定义配置

### 需要优先修改的文件

- `src/site-config.ts`：站点名称、装配、默认 locus、演示数据行为
- `.env.local`：平台与存储配置
- `schema.sql`：数据库结构

### 存储模式

SeqEdge 目前支持四种存储模式，无需改代码：

1. **纯 Cloudflare R2**
2. **纯 Hugging Face Datasets**，使用 `resolve/main`
3. **混合模式**，常规文件走相对路径，超大文件使用完整 `https://` 地址
4. **HF 代理模式**，通过 `NEXT_PUBLIC_HF_PROXY_URL` 与 `cloudflare-templates/hf-proxy/` 的 Worker 模板接管 HF 请求

如果你的文件存放在 `test-data/` 等子目录下，请直接把该前缀写入 `NEXT_PUBLIC_STORAGE_BASE_URL`。

### Hugging Face 代理部署

直接使用 Hugging Face `resolve/main` 作为 JBrowse 数据源时，请求通常会经历 302 重定向、Xet 桥接层和更严格的 CORS 检查，因此在浏览器中明显慢于 R2。SeqEdge 已包含一个 Cloudflare Worker 模板，用于把这些请求改写为稳定的、支持 Range 的代理端点。现在代理不仅会重写数据库中的 Hugging Face 绝对 URL，也会在 `NEXT_PUBLIC_STORAGE_BASE_URL` 本身就是 Hugging Face `resolve/main` 基址时自动接管该基址。

本仓库当前已部署的示例地址：

```text
https://seqedge-hf-proxy.helloxiaolaodi.workers.dev
```

部署步骤：

1. 编辑 `cloudflare-templates/hf-proxy/wrangler.toml`，将 `HF_REPO_BASE` 设置为你的 Hugging Face `resolve/main` 基址。
2. 登录 Cloudflare：
   ```bash
   cd cloudflare-templates/hf-proxy
   npx wrangler login
   ```
3. 部署 Worker：
   ```bash
   npx wrangler deploy
   ```
4. 在 SeqEdge 中配置：
   ```bash
   # 纯 HF 代理模式
   NEXT_PUBLIC_STORAGE_BASE_URL=https://seqedge-hf-proxy.your-account.workers.dev

   # 混合模式（推荐）
   NEXT_PUBLIC_STORAGE_BASE_URL=https://your-bucket.your-account.r2.dev/test-data
   NEXT_PUBLIC_HF_PROXY_URL=https://seqedge-hf-proxy.your-account.workers.dev
   ```

推荐将 `.fai`、`.bai`、`.tbi`、`.csi`、`.crai` 等高频索引文件保留在 R2，把真正体积较大的数据文件放在 Hugging Face。

### JBrowse demo 配置

默认演示装配和轨道文件已经集中到 `src/site-config.ts`，而不是写死在组件内部。运行时会按以下顺序探测存储位置：

1. `NEXT_PUBLIC_STORAGE_BASE_URL` 或兼容旧部署的 `NEXT_PUBLIC_R2_PUBLIC_URL`
2. 项目内置的 `public/demo-data`
3. 官方公开 JBrowse volvox demo 作为最后回退

当前代码默认装配已经切换为内置的 SARS-CoV-2 参考 `NC_045512.2`，而不是 `volvox`。`volvox` 仍保留为模板中的备用验证装配，以及最终的公开回退数据源。

当前内置装配：

- `volvox`，对应 `volvox.fa` 和 `volvox.fa.fai`
- `NC_045512.2`，对应 `scov2.fa` 和 `scov2.fa.fai`

当前可选轨道：

- `volvox.sort.gff3.gz` 和 `volvox.sort.gff3.gz.tbi`
- `volvox-sorted.bam` 和 `volvox-sorted.bam.bai`
- `volvox.bb`
- `scov2.genes.bed`
- `scov2.genes.gff3`

这些轨道会逐条探测。若某条轨道缺少伴随文件，只会隐藏该轨道，不会让整个浏览器失效。

## 功能模块

- **Overview**：摘要统计与图表
- **Promoters**：坐标型记录检索与筛选
- **Genome Browser**：JBrowse 2 浏览参考序列和轨道
- **User Guide**：面向最终用户的内置说明

## 成本估算

对模板级别的访问量而言，SeqEdge 通常可以在免费层或较低成本范围内运行：

- Vercel：前端交付
- Cloudflare Pages / Workers：镜像交付与 HF 代理
- Supabase：元数据存储
- Cloudflare R2 或 Hugging Face Datasets：组学文件存储

## 云服务配置

### 1. Supabase

使用 Supabase 存储结构化元数据和筛选查询结果。不要把 BAM、CRAM、VCF、FASTA 等二进制大文件直接写入数据库。

### 2. Cloudflare R2

R2 适合存放低延迟访问的文件，尤其适合 JBrowse 启动阶段高频请求的索引文件。

### 3. Hugging Face Datasets

Hugging Face Datasets 适合托管大型公开文件。当它作为浏览器数据源时，必须使用 `resolve/main`，不能使用 `blob/main`。

### 4. Vercel 与 Cloudflare Pages

推荐 Vercel 作为主站，Cloudflare Pages 作为镜像站。对 Pages 来说，`/demo-data/*` 必须保持为静态资源路由，确保同源回退在生产环境中可用。

## 部署后自检清单

每次部署后都建议做一次快速自检。

### 1. 基础可用性检查

- 打开 `/`，确认站点正常渲染。
- 打开 `/api/stats`，确认返回 `200`。
- 确认浏览器控制台没有反复出现 `Reference data unreachable`。

### 2. 同源 demo 回退检查

以下路径必须能在部署域名下直接访问：

- `/demo-data/volvox.fa`
- `/demo-data/volvox.fa.fai`
- `/demo-data/scov2.fa`
- `/demo-data/scov2.fa.fai`

若 Cloudflare Pages 返回 `404`，重点检查：

- 构建命令是否为 `npm run build:cf`
- 输出目录是否为 `.open-next`
- `.open-next/_routes.json` 是否排除了 `/demo-data/*`
- `.open-next/demo-data` 是否包含这些文件

### 3. 对象存储检查

- 确认 `NEXT_PUBLIC_STORAGE_BASE_URL` 指向支持 CORS 的地址。
- 如果文件位于子目录下，确认基址已包含该子路径。
- 若使用 Hugging Face，确认公开链接全部为 `resolve/main`。
- 至少验证一个参考序列索引和一个比对索引的 Range 请求。

示例：

```bash
curl -I https://your-bucket.r2.dev/test-data/volvox.fa.fai
curl -H "Range: bytes=0-0" -I https://your-bucket.r2.dev/test-data/volvox.fa.fai
curl -I https://huggingface.co/datasets/<user>/<repo>/resolve/main/scov2.fa.fai
curl -H "Range: bytes=0-0" -I https://seqedge-hf-proxy.helloxiaolaodi.workers.dev/scov2.fa.fai
```

### 4. Genome Browser 检查

- 确认默认装配能够正常加载。
- 确认可选轨道失败时只影响对应轨道。
- 确认外部存储异常时浏览器仍可回退到 `public/demo-data`。
- 若启用 HF 代理，确认请求命中 `workers.dev` 域名，并直接返回 `206 Partial Content`，而不是在浏览器可见链路中再次出现 `302`。

## 技术栈

- Next.js `15.5.21`
- React `19.2.4`
- `@supabase/supabase-js` `^2.110.7`
- `@jbrowse/product-core` `^4.3.0`
- `@jbrowse/react-linear-genome-view` `^3.1.0`
- `@tanstack/react-table` `^8.21.3`
- `echarts` `^6.1.0`
- `@opennextjs/cloudflare` `^1.20.2`
- `wrangler` `^4.113.0`

## 测试数据、来源与致谢

### 1. 模板默认演示数据

仓库内置了 `public/demo-data` 这一套同源回退演示数据，使模板在外部对象存储临时不可用或配置错误时仍可继续展示浏览器。

内置文件包括：

- `volvox.fa`
- `volvox.fa.fai`
- `volvox.sort.gff3.gz`
- `volvox-sorted.bam`
- `volvox-sorted.bam.bai`
- `volvox.bb`
- `scov2.fa`
- `scov2.fa.fai`
- `scov2.genes.bed`
- `scov2.genes.gff3`

主要来源：

- GMOD / JBrowse 示例数据：`https://github.com/GMOD/jbrowse-components/tree/main/test_data`
- JBrowse 官方公开 demo：`https://jbrowse.org/code/jb2/main/demos/volvox`

### 2. SARS-CoV-2 验证数据

模板开发阶段使用了一套小型 SARS-CoV-2 数据集做结构与浏览验证。

涉及文件：

- `scov2.fa`
- `scov2.fa.fai`
- `scov2.gb`
- `scov2.genes.bed`
- `scov2.genes.gff3`

主要来源：

- NCBI RefSeq `NC_045512.2`
- 对应 GenBank 记录与注释

推荐引用：

- Wu F, Zhao S, Yu B, et al. *A new coronavirus associated with human respiratory disease in China*. Nature. 2020;579(7798):265-269. DOI: `10.1038/s41586-020-2008-3`

### 3. E. coli K-12 MG1655 验证数据

在验证 FASTA 索引和浏览器兼容性时，还使用过一套轻量级 *Escherichia coli* 参考数据。

涉及文件：

- `reference.fa`
- `reference.fa.fai`
- `ecoli_k12_genomic.fna.gz`

主要来源：

- NCBI RefSeq 装配 `GCF_000005845.2`
- 染色体登录号 `NC_000913.3`

推荐引用：

- Blattner FR, Plunkett G 3rd, Bloch CA, et al. *The complete genome sequence of Escherichia coli K-12*. Science. 1997;277(5331):1453-1462. DOI: `10.1126/science.277.5331.1453`

## 许可证

本项目依据仓库中声明的许可证发布。
