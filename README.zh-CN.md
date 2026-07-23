<div align="center"><a name="readme-top"></a>

![SeqEdge 截图](./seqedge-github-img-readme.jpg)

# SeqEdge

**面向边缘架构的可扩展基因组数据库模板**

一个现代化、开源、可快速二次开发的交互式基因组数据库模板。

**主力部署**: [https://seq-edge.vercel.app](https://seq-edge.vercel.app) | **国内镜像**: [https://seqedge.pages.dev](https://seqedge.pages.dev) · [GitHub](https://github.com/Helloxiaolaodi/SeqEdge)

**English** | **简体中文** | [问题反馈](https://github.com/Helloxiaolaodi/SeqEdge/issues)

> **详细搭建指南**：[https://www.cnblogs.com/Helloxiaolaodi/p/21776373](https://www.cnblogs.com/Helloxiaolaodi/p/21776373) —— 从 fork 到部署的完整流程。

技术栈：Next.js | Supabase | Cloudflare R2 / Hugging Face Datasets | JBrowse 2 | TanStack Table | ECharts

![License](https://img.shields.io/github/license/Helloxiaolaodi/SeqEdge?style=flat-square)
![Stars](https://img.shields.io/github/stars/Helloxiaolaodi/SeqEdge?style=flat-square)
![Forks](https://img.shields.io/github/forks/Helloxiaolaodi/SeqEdge?style=flat-square)
![Issues](https://img.shields.io/github/issues/Helloxiaolaodi/SeqEdge?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-15.5.21-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-2.110.7-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?style=flat-square&logo=vercel)

**分享 SeqEdge 仓库**

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

SeqEdge 是一个用于搭建交互式基因组数据库网站的**模板仓库**。它适合展示预测启动子、全基因组注释以及其他基于坐标的组学数据，并采用完全无服务器、边缘优先的架构。

如果你已经有启动子预测结果、基因注释或任何基于坐标的基因组数据，你可以 fork 本仓库、替换数据源，并在较短时间内发布自己的数据库网站。

## 架构

SeqEdge 采用以下核心分层：

- **Next.js + React**：前端页面、交互逻辑和 API 路由
- **Supabase / PostgreSQL**：存储结构化元数据，如启动子坐标、基因名称、统计信息
- **Cloudflare R2 / Hugging Face Datasets**：存储 FASTA、BAM、BigBed、VCF 等大文件
- **JBrowse 2**：负责参考基因组和轨道浏览
- **TanStack Table + ECharts**：负责筛选、表格展示和科研图形导出

## 快速开始

### 环境准备

- Node.js `18+`
- npm
- 一个 Supabase 项目
- 一个支持 CORS 和 Range 请求的对象存储（Cloudflare R2、Hugging Face Datasets、S3 等）

### 第 1 步：Fork 并克隆仓库

```bash
git clone https://github.com/<your-account>/SeqEdge.git
cd SeqEdge
npm install
```

### 第 2 步：配置环境变量

在 `.env.local` 中填写：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_STORAGE_BASE_URL=https://your-bucket.your-account.r2.dev
```

兼容旧变量名：

```bash
NEXT_PUBLIC_R2_PUBLIC_URL=https://your-bucket.your-account.r2.dev
```

### 第 3 步：初始化数据库

执行 `schema.sql` 中的建表语句，并导入你的元数据。

### 第 4 步：本地运行

```bash
npm run dev
```

### 第 5 步：部署

可部署到：

- **Vercel**：主站
- **Cloudflare Pages**：中国大陆更友好的镜像站

Cloudflare Pages 部署说明：

- Cloudflare 的构建命令请设置为 `npm run build:cf`。
- Pages 的输出目录请设置为 `.open-next`。
- 请保留仓库中的 `public/demo-data`。Cloudflare 的 postbuild 步骤会把这些同源 demo 回退文件复制进 `.open-next`，并在路由中排除 `/demo-data/*`，这样 Pages 才会把它们当作静态资源直接返回。
- 如果你的对象文件实际位于 `test-data/` 之类的子目录下，请把这个前缀直接写进 `NEXT_PUBLIC_STORAGE_BASE_URL`。

## 自定义配置

### 必改的核心文件

- `src/site-config.ts`（尤其是 `jbrowse.defaultAssembly` 与 `jbrowse.assemblies`）
- `.env.local`
- `schema.sql`

### 真实数据接入方式

SeqEdge 目前支持四种存储模式：

1. **纯 Cloudflare R2**：环境变量指向 R2，数据库保存相对路径
2. **纯 Hugging Face Datasets**：环境变量指向 `resolve/main` 前缀，数据库保存相对路径
3. **混合模式**：环境变量指向常规对象存储，数据库中的超大文件直接保存完整 `https://` 地址

4. **HF 代理模式**：部署 Cloudflare Worker 代理（见 `cloudflare-templates/hf-proxy/`），设置 `NEXT_PUBLIC_HF_PROXY_URL`，数据库中的 HF 绝对地址会自动重写通过代理，解决 5 分钟加载问题

如果你的对象文件实际放在 `test-data/` 之类的子目录下，那么 `NEXT_PUBLIC_STORAGE_BASE_URL` 应直接包含这个前缀，例如 `https://your-bucket.r2.dev/test-data`。


### Hugging Face 加速代理（解决 5 分钟加载问题）

纯 Hugging Face Datasets 作为 JBrowse 2 数据源时，由于 HF 的 `resolve/main` 链接会 302 重定向到 Xet CDN 桥接层，加上 CORS 预检与 Range 请求支持不完整，Genome Browser 从 10 秒慢到 5 分钟。详情见 `cloudflare-templates/hf-proxy/README.md`。

SeqEdge 内置了 HF 代理支持，零代码改动：

1. 部署代理 Worker：
   ```bash
   cd cloudflare-templates/hf-proxy
   # 编辑 wrangler.toml 中的 HF_REPO_BASE
   npx wrangler deploy
   ```

2. 在 `.env.local` 中配置：
   ```bash
   # 方案 A - 纯 HF 模式：直接以 Worker 为存储基址
   NEXT_PUBLIC_STORAGE_BASE_URL=https://seqedge-hf-proxy.你的用户名.workers.dev

   # 方案 B - 混合模式（推荐）：索引放 R2，大文件自动走代理
   NEXT_PUBLIC_STORAGE_BASE_URL=https://你的桶.r2.dev
   NEXT_PUBLIC_HF_PROXY_URL=https://seqedge-hf-proxy.你的用户名.workers.dev
   ```

3. 混合模式下，数据库中的 HF 绝对地址（`https://huggingface.co/datasets/.../resolve/main/...`）会被 `storage.ts` 自动重写为代理地址，无需迁移数据。

4. 验证：打开 Genome Browser 页面，在浏览器 DevTools -> Network 过滤 `workers.dev` 域名，Range GET 请求应直接返回 **206 Partial Content**（不再出现 302），Response Headers 应有 `Access-Control-Expose-Headers: Content-Range`。

性能预期：

| 模式                           | 首屏加载    |
| ------------------------------ | ----------- |
| 纯 R2                          | ~10 秒      |
| 纯 HF（直连 huggingface.co）   | ~5 分钟     |
| 纯 HF -> Worker 代理            | ~20-30 秒   |
| 混合（索引 R2 + 数据走代理 HF） | ~10-15 秒   |
### JBrowse demo 现在如何配置

默认 demo 装配和轨道文件已经从组件硬编码中抽离到 `src/site-config.ts`。未来使用者主要修改 `jbrowse.defaultAssembly`、`jbrowse.assemblies` 和对象存储基址，而不需要改 `src/components/jbrowse-viewer.tsx`。浏览器现在会按装配与存储基址逐层探测：

1. 先尝试用户配置的 `NEXT_PUBLIC_STORAGE_BASE_URL` 或兼容旧部署的 `NEXT_PUBLIC_R2_PUBLIC_URL`；
2. 若失败，则尝试项目内置的同源 demo 数据 `public/demo-data`；
3. 若仍失败，最后才回退到官方公开 JBrowse volvox demo。

当前内置装配包括：

- `volvox`，参考文件为 `volvox.fa` + `volvox.fa.fai`
- `NC_045512.2`，参考文件为 `scov2.fa` + `scov2.fa.fai`

当前已配置的可选轨道包括：

- `volvox.sort.gff3.gz` + `volvox.sort.gff3.gz.tbi`
- `volvox-sorted.bam` + `volvox-sorted.bam.bai`
- `volvox.bb`
- `scov2.genes.bed`
- `scov2.genes.gff3`

应用现在会按装配逐条探测这些可选轨道是否可达：缺哪个轨道，就只隐藏哪个轨道，而不是让整个浏览器报错。

## 功能模块

- **Overview**：展示统计信息与摘要图表
- **Promoters**：多条件筛选与详情跳转
- **Genome Browser**：JBrowse 2 浏览参考序列与注释轨道
- **User Guide**：内置使用说明

## 成本估算

在模板模式下，若访问量中等，通常可以依靠免费层或极低成本运行：

- Vercel：前端与 API 免费层可覆盖轻中量演示用途
- Cloudflare Pages / Workers：适合做镜像与边缘访问
- Supabase：免费层可承载模板与中小规模元数据
- Hugging Face Datasets：适合低成本托管较大公开文件

## 云服务配置

### A. Supabase

用于结构化元数据表和筛选查询。

### B. Cloudflare R2

适合存储常用小中型基因组文件，配合 `r2.dev` 或公开自定义域名。

### C. Hugging Face Datasets

适合托管大体积公开文件。若用于 JBrowse，请使用 `resolve/main`，不要使用 `blob/main`。

### D. Vercel 与 Cloudflare Pages

推荐 Vercel 作为主站，Cloudflare Pages 作为镜像站。

对 Cloudflare Pages，稳定可用的配置是：

- 构建命令：`npm run build:cf`
- 输出目录：`.open-next`
- 运行时要求：`/demo-data/*` 必须作为静态资源直接返回，不能被 worker 拦截

这样配置的原因是：当你配置的对象存储被 CORS 拦截、基址漏写子目录前缀，或者远端文件暂时不可达时，Genome Browser 会自动回退到 `public/demo-data` 里的同源演示数据。

## 部署后自检清单

每次部署到 Vercel 或 Cloudflare Pages 之后，建议先完成下面这组检查，再对外分享链接。

### A. 基础可用性检查

- 打开网站首页 `/`，确认页面正常渲染，没有空白页。
- 打开 `/api/stats`，确认返回 `200`。
- 打开浏览器开发者工具，确认没有持续出现 `Reference data unreachable` 报错。

### B. 同源 demo 回退检查

以下地址在部署域名下必须能直接访问：

- `/demo-data/volvox.fa`
- `/demo-data/volvox.fa.fai`
- `/demo-data/scov2.fa`
- `/demo-data/scov2.fa.fai`

对于 Cloudflare Pages，若这些地址返回 `404`，优先检查：

- Pages 的构建命令是否为 `npm run build:cf`；
- 输出目录是否为 `.open-next`；
- 生成后的 `.open-next/_routes.json` 是否排除了 `/demo-data/*`；
- 生成后的 `.open-next/demo-data` 目录里是否真的有这些文件。

### C. 对象存储检查

- 确认 `NEXT_PUBLIC_STORAGE_BASE_URL` 指向支持 CORS 的对象存储地址。
- 如果文件实际放在某个子目录下，确认基址已包含该前缀。
- 若使用 Hugging Face Datasets，确认使用的是 `resolve/main`，而不是 `blob/main`。
- 对参考序列索引、BAM/CRAM 索引做一次 Range 请求验证。

示例：

```bash
curl -I https://your-bucket.r2.dev/test-data/volvox.fa.fai
curl -H "Range: bytes=0-0" -I https://your-bucket.r2.dev/test-data/volvox.fa.fai
curl -I https://huggingface.co/datasets/<user>/<repo>/resolve/main/scov2.fa.fai
```

### D. Genome Browser 检查

- 确认默认装配能够加载，参考序列能够正常渲染。
- 确认可选轨道缺失时只静默隐藏该轨道，而不会让整个浏览器崩溃。
- 若某条轨道缺少伴随索引文件，应该只隐藏该轨道。
- 若外部对象存储暂时失败，浏览器应能通过 `public/demo-data` 自动回退并继续工作。

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

### A. 模板默认演示数据

SeqEdge 现在在 `public/demo-data` 中内置了一套同源回退 demo，因此即使外部对象存储配置错误、CORS 被拦截，或者存储基址漏写了 `test-data` 这类子目录前缀，模板也仍然可以正常打开 Genome Browser。默认浏览器配置已经改为装配感知，并通过 `src/site-config.ts` 统一管理，而不是写死在 JBrowse 组件内部。

当前内置 demo 文件包括：

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

运行时行为：

- `volvox` 仍然是模板默认装配
- `NC_045512.2` 作为额外验证装配一并内置
- 可选轨道只有在所有伴随文件都可达时才会显示

来源：

- GMOD / JBrowse 示例数据仓库：`https://github.com/GMOD/jbrowse-components/tree/main/test_data`
- 官方公开 demo 兜底地址：`https://jbrowse.org/code/jb2/main/demos/volvox`

致谢：

- 感谢 GMOD 与 JBrowse 维护团队持续公开提供这些示例资源，帮助社区开发和验证基因组浏览器应用。

### B. SARS-CoV-2 开发验证数据

模板开发过程中，还使用了一套 SARS-CoV-2 小型验证数据来验证 R2 / Hugging Face 双存储、`resolve/main` 下载路径以及参考序列与注释文件的组织方式。

涉及文件：

- `scov2.fa`
- `scov2.fa.fai`
- `scov2.gb`
- `scov2.genes.bed`
- `scov2.genes.gff3`

来源：

- NCBI RefSeq 参考序列 `NC_045512.2`
- 对应的 NCBI GenBank 记录与注释

推荐引用文献：

- Wu F, Zhao S, Yu B, et al. *A new coronavirus associated with human respiratory disease in China*. Nature. 2020;579(7798):265-269. DOI: `10.1038/s41586-020-2008-3`

致谢：

- 感谢原始研究作者、数据提交实验室，以及 NCBI / GenBank / RefSeq 对 SARS-CoV-2 公共参考数据的开放整理。

### C. E. coli K-12 MG1655 验证数据

在 FASTA 索引与装配调试阶段，还使用过一套轻量级的大肠杆菌验证数据。

涉及文件：

- `reference.fa`
- `reference.fa.fai`
- `ecoli_k12_genomic.fna.gz`

来源：

- NCBI RefSeq 装配 `GCF_000005845.2`
- 染色体登录号 `NC_000913.3`

推荐引用文献：

- Blattner FR, Plunkett G 3rd, Bloch CA, et al. *The complete genome sequence of Escherichia coli K-12*. Science. 1997;277(5331):1453-1462. DOI: `10.1126/science.277.5331.1453`

致谢：

- 感谢原始作者和 NCBI 保存并开放这一经典细菌参考基因组。

## 许可证

本项目基于仓库中声明的许可证发布。
