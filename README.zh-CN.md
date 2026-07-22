<div align="center"><a name="readme-top"></a>

<img src="../deploy-notes/seqedge-github-img-readme.jpg" alt="SeqEdge 截图 — 总览页面" width="100%">

# SeqEdge

**面向边缘架构的可扩展基因组数据库模板**

一个现代化、开源、可快速二次开发的交互式基因组数据库模板。

**🚀 主力部署**: [https://seq-edge.vercel.app](https://seq-edge.vercel.app) | **国内镜像**: [https://seqedge.pages.dev](https://seqedge.pages.dev) · [GitHub][github-repo-link]

**English** | **简体中文** | [问题反馈][github-issues-link]

> 📘 **详细搭建指南**：[https://www.cnblogs.com/Helloxiaolaodi/p/21776373](https://www.cnblogs.com/Helloxiaolaodi/p/21776373) —— 从 fork 到部署的完整流程。

技术栈：Next.js | Supabase | Cloudflare R2 / Hugging Face Datasets | JBrowse 2 | TanStack Table | ECharts

[![][github-license-shield]][github-license-link]
[![][github-stars-shield]][github-stars-link]
[![][github-forks-shield]][github-forks-link]
[![][github-issues-shield]][github-issues-link]<br/>
[![][nextjs-shield]][nextjs-link]
[![][supabase-shield]][supabase-link]
[![][vercel-shield]][vercel-link]

**分享 SeqEdge 仓库**

[![][share-x-shield]][share-x-link]
[![][share-reddit-shield]][share-reddit-link]
[![][share-weibo-shield]][share-weibo-link]

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

## 自定义配置

### 必改的核心文件

- `src/site-config.ts`
- `.env.local`
- `schema.sql`

### 真实数据接入方式

SeqEdge 目前支持三种存储模式：

1. **纯 Cloudflare R2**：环境变量指向 R2，数据库保存相对路径
2. **纯 Hugging Face Datasets**：环境变量指向 `resolve/main` 前缀，数据库保存相对路径
3. **混合模式**：环境变量指向常规对象存储，数据库中的超大文件直接保存完整 `https://` 地址

### JBrowse demo 现在如何配置

默认 demo 文件名已经从组件硬编码中抽离到 `src/site-config.ts`。未来使用者只需要改配置，不需要修改 `src/components/jbrowse-viewer.tsx`。

默认 demo 当前配置的参考文件为：

- `volvox.fa`
- `volvox.fa.fai`

默认可选轨道为：

- `volvox.sort.gff3.gz` + `volvox.sort.gff3.gz.tbi`
- `volvox-sorted.bam` + `volvox-sorted.bam.bai`
- `volvox.bb`

应用现在会自动探测这些可选轨道文件是否可达：缺哪个轨道，就隐藏哪个轨道，而不是让整个浏览器报错。

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

SeqEdge 作为模板仓库，需要保证用户 fork 后即使还没有上传真实组学文件，也能立刻打开并体验 Genome Browser。因此当前默认演示数据仍保留为公开 demo，并且已经把文件名配置从组件硬编码中抽离到 `src/site-config.ts`。

默认演示配置当前使用以下文件：

- `volvox.fa`
- `volvox.fa.fai`
- `volvox.sort.gff3.gz`
- `volvox.sort.gff3.gz.tbi`
- `volvox-sorted.bam`
- `volvox-sorted.bam.bai`
- `volvox.bb`

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
