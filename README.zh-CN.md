# SeqEdge

![SeqEdge 截图](./seqedge-github-img-readme.jpg)

面向边缘部署的基因组数据库模板

一个用于搭建交互式基因组与坐标型科研数据库的开源模板，采用无服务器、存储解耦、面向对象存储优化的架构设计。

主站: [https://seq-edge.vercel.app](https://seq-edge.vercel.app)  
镜像站: [https://seqedge.pages.dev](https://seqedge.pages.dev)  
GitHub: [https://github.com/Helloxiaolaodi/SeqEdge](https://github.com/Helloxiaolaodi/SeqEdge)

语言: [English](./README.md) | 简体中文 | [问题反馈](https://github.com/Helloxiaolaodi/SeqEdge/issues)

> 详细搭建指南: [SeqEdge 网站搭建的详细解读](https://www.cnblogs.com/Helloxiaolaodi/p/21776373)

技术栈: Next.js | React | Supabase | Cloudflare R2 | Hugging Face Datasets | Cloudflare Workers | JBrowse 2 | TanStack Table | ECharts

![License](https://img.shields.io/github/license/Helloxiaolaodi/SeqEdge?style=flat-square)
![Stars](https://img.shields.io/github/stars/Helloxiaolaodi/SeqEdge?style=flat-square)
![Forks](https://img.shields.io/github/forks/Helloxiaolaodi/SeqEdge?style=flat-square)
![Issues](https://img.shields.io/github/issues/Helloxiaolaodi/SeqEdge?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-15.5.21-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-2.110.7-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?style=flat-square&logo=vercel)

## 1. 项目概览

SeqEdge 是一个面向公开科研数据库的模板仓库，适合同时承载元数据检索、坐标型记录浏览、图表概览和浏览器端基因组可视化。它的目标是让研究团队在不维护传统重型后端的前提下，也能交付一个可部署、可扩展、可 fork 的数据库网站。

仓库把三个核心职责拆分得比较清楚：

- 结构化元数据存放在 Supabase / PostgreSQL；
- 大体积基因组文件存放在对象存储；
- 浏览器端通过 JBrowse 2、TanStack Table 和 ECharts 完成交互式呈现。

这种拆分让数据库保持轻量，也让 BAM、CRAM、VCF、FASTA 等大文件继续留在更适合它们的存储层中，同时保留一条对 Vercel 和 Cloudflare 都足够直接的部署路径。

## 2. 架构

![SeqEdge Architecture](./docs/architecture.gif)

### 2.1 请求路径

1. 页面外壳由 Vercel 或 Cloudflare Pages 提供。
2. 检索与统计请求进入 Next.js API 路由，再访问 Supabase。
3. JBrowse 只按需请求当前基因组区间所需的字节范围。
4. 大体积组学文件继续保留在对象存储中，而不写入 PostgreSQL。

## 3. 快速开始

### 3.1 环境准备

- Node.js `18+`
- npm
- 一个 Supabase 项目
- 一个支持 CORS 和 HTTP Range 请求的对象存储

### 3.2 Fork 并克隆仓库

```bash
git clone https://github.com/<your-account>/SeqEdge.git
cd SeqEdge
npm install
```

### 3.3 配置环境变量

创建 `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_STORAGE_BASE_URL=https://your-bucket.your-account.r2.dev/test-data
```

兼容旧变量名:

```bash
NEXT_PUBLIC_R2_PUBLIC_URL=https://your-bucket.your-account.r2.dev/test-data
```

如果启用 Hugging Face 代理 Worker:

```bash
NEXT_PUBLIC_STORAGE_BASE_URL=https://your-bucket.your-account.r2.dev/test-data
NEXT_PUBLIC_HF_PROXY_URL=https://seqedge-hf-proxy.your-account.workers.dev
```

### 3.4 初始化数据库

在 Supabase 中执行 `schema.sql`，然后导入你的元数据表。

### 3.5 本地运行

```bash
npm run dev
```

### 3.6 部署

推荐的生产部署组合：

- Vercel 作为主站
- Cloudflare Pages 作为镜像站
- Cloudflare Worker 作为 Hugging Face 代理层

Cloudflare Pages 建议配置：

- 构建命令: `npm run build:cf`
- 预览命令: `npm run preview:cf`
- 部署命令: `npm run deploy:cf`
- 输出目录: `.open-next`
- 保留 `public/demo-data`，确保同源演示回退在生产环境中可用

## 4. 当前实现状态

### 4.1 检索与分页

SeqEdge 现在已经使用前后端打通的服务端分页。页面层会把 `limit` 和 `offset` 传给 `/api/promoters`，API 路由通过 Supabase 的 `range()` 执行真实分页，而 TanStack Table 则运行在受控的手动分页模式下。这样可以避免早期那种“界面看起来有很多页，但实际只拿到第一批数据”的错配。

### 4.2 表型筛选

像 species、tissue、cohort、BMI 这类样本层条件，通过两跳查询接到启动子结果上。API 会先筛选 `genome_samples`，再把匹配到的 `sample_id` 列表应用到 `predicted_promoters`。

中国成人 BMI 阈值已经统一放在 `src/site-config.ts` 中：

- 偏瘦: `< 18.5`
- 正常: `18.5 - 24.0`
- 超重: `24.0 - 28.0`
- 肥胖: `>= 28.0`

### 4.3 User Guide 侧边栏

站内 User Guide 目前聚焦四部分内容：

1. Overview
2. Promoters & Features
3. Genome Browser
4. Data & Storage

在其末尾还追加了开源工具出处与致谢列表，用于说明 SeqEdge 依赖的核心组件与参考来源。

## 5. 自定义配置

### 5.1 优先修改的文件

- `src/site-config.ts`: 站点名称、装配、默认 locus、BMI 阈值、分页大小、功能开关
- `.env.local`: 平台与存储配置
- `schema.sql`: 初始化数据库结构

### 5.2 存储模式

SeqEdge 支持四种存储模式，无需改业务代码：

1. 纯 Cloudflare R2
2. 纯 Hugging Face Datasets，使用 `resolve/main`
3. 混合模式，常规文件走相对路径，超大文件使用完整 `https://` 地址
4. HF 代理模式，通过 `NEXT_PUBLIC_HF_PROXY_URL` 与 `cloudflare-templates/hf-proxy/` 的 Worker 模板接管请求

如果文件位于 `test-data/` 等子目录下，请把该前缀直接写进 `NEXT_PUBLIC_STORAGE_BASE_URL`。

### 5.3 Hugging Face 代理部署

直接使用 Hugging Face `resolve/main` 作为 JBrowse 数据源时，请求可能经过重定向、Xet 桥接层和更严格的 CORS 检查，因此对浏览器侧基因组读取并不理想。SeqEdge 已提供一个 Cloudflare Worker 模板，用来把这些请求重写成稳定、支持 Range 的代理端点。

部署步骤：

1. 编辑 `cloudflare-templates/hf-proxy/wrangler.toml`，将 `HF_REPO_BASE` 设为你的 Hugging Face `resolve/main` 基址。
2. 登录 Cloudflare:
   ```bash
   cd cloudflare-templates/hf-proxy
   npx wrangler login
   ```
3. 部署 Worker:
   ```bash
   npx wrangler deploy
   ```
4. 在 SeqEdge 中配置:
   ```bash
   NEXT_PUBLIC_STORAGE_BASE_URL=https://your-bucket.your-account.r2.dev/test-data
   NEXT_PUBLIC_HF_PROXY_URL=https://seqedge-hf-proxy.your-account.workers.dev
   ```

## 6. 功能模块

- Overview: 摘要卡片与图表
- Promoters: 支持服务端分页的坐标型记录检索
- Genome Browser: JBrowse 2 联动浏览
- User Guide: 站内说明与开源工具出处

## 7. 部署后自检

### 7.1 基础检查

- 打开 `/`，确认站点能正常渲染。
- 打开 `/api/stats`，确认返回 `200`。
- 确认浏览器控制台没有反复出现对象存储或参考数据错误。

### 7.2 同源 demo 回退检查

以下路径必须能在部署域名下直接访问：

- `/demo-data/volvox.fa`
- `/demo-data/volvox.fa.fai`
- `/demo-data/scov2.fa`
- `/demo-data/scov2.fa.fai`

若 Cloudflare Pages 返回 `404`，重点检查：

- 构建命令是否为 `npm run build:cf`
- 输出目录是否为 `.open-next`
- `.open-next/_routes.json` 是否排除了 `/demo-data/*`
- `.open-next/demo-data` 是否包含预期文件

### 7.3 对象存储检查

- 确认 `NEXT_PUBLIC_STORAGE_BASE_URL` 指向支持 CORS 的地址。
- 如果文件位于子目录下，确认基址已包含该子路径。
- 若使用 Hugging Face，确认公开链接全部为 `resolve/main`。
- 至少验证一个参考序列索引和一个比对索引的 Range 请求。

## 8. 技术栈

- [Next.js](https://nextjs.org/docs) `15.5.21`
- [React](https://react.dev/learn) `19.2.4`
- [`@supabase/supabase-js`](https://supabase.com/docs/reference/javascript/introduction) `^2.110.7`
- [`@jbrowse/product-core`](https://jbrowse.org/jb2/docs/) `^4.3.0`
- [`@jbrowse/react-linear-genome-view`](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view) `^3.1.0`
- [`@tanstack/react-table`](https://tanstack.com/table/latest/docs/guide/introduction) `^8.21.3`
- [ECharts](https://echarts.apache.org/handbook/en/get-started/) `^6.1.0`
- [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) `^1.20.2`
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) `^4.113.0`

### 8.1 工具出处与致谢

| 工具 | 版本 | 出处 |
|---|---|---|
| [Next.js](https://nextjs.org/docs) | `15.5.21` | 官方文档 |
| [React](https://react.dev/learn) | `19.2.4` | 官方学习文档 |
| [`@supabase/supabase-js`](https://supabase.com/docs/reference/javascript/introduction) | `^2.110.7` | Supabase JavaScript 客户端官方文档 |
| [`@jbrowse/product-core`](https://jbrowse.org/jb2/docs/) | `^4.3.0` | JBrowse 2 官方文档 |
| [`@jbrowse/react-linear-genome-view`](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view) | `^3.1.0` | npm 包说明 |
| [JBrowse 2](https://jbrowse.org/jb2/) | 集成运行时 | Buels R, et al. *JBrowse 2: a modular genome browser with views of synteny and structural variation*. Nature Biotechnology. 2023 |
| [`@tanstack/react-table`](https://tanstack.com/table/latest/docs/guide/introduction) | `^8.21.3` | 官方文档 |
| [ECharts](https://echarts.apache.org/handbook/en/get-started/) | `^6.1.0` | 官方入门手册 |
| [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) | `^1.20.2` | OpenNext Cloudflare 官方文档 |
| [Wrangler](https://developers.cloudflare.com/workers/wrangler/) | `^4.113.0` | Cloudflare Workers CLI 官方文档 |

## 9. 测试数据与出处

### 9.1 模板默认演示数据

仓库内置了 `public/demo-data` 这一套同源回退演示数据，使模板在外部对象存储暂时不可用或配置错误时仍可继续展示浏览器。

### 9.2 SARS-CoV-2 验证数据

推荐引用：

- Wu F, Zhao S, Yu B, et al. *A new coronavirus associated with human respiratory disease in China*. Nature. 2020;579(7798):265-269. DOI: `10.1038/s41586-020-2008-3`

### 9.3 E. coli K-12 MG1655 验证数据

推荐引用：

- Blattner FR, Plunkett G 3rd, Bloch CA, et al. *The complete genome sequence of Escherichia coli K-12*. Science. 1997;277(5331):1453-1462. DOI: `10.1126/science.277.5331.1453`

## 10. 许可证

本项目依据仓库中声明的许可证发布。
