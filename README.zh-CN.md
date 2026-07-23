# SeqEdge

![SeqEdge 截图](./seqedge-github-img-readme.jpg)

面向边缘部署的基因组数据库模板

这是一个开源模板，用于搭建支持坐标检索、图表概览、基因组浏览器和对象存储分离部署的科研数据库网站。

主站: [https://seq-edge.vercel.app](https://seq-edge.vercel.app)
镜像站: [https://seqedge.pages.dev](https://seqedge.pages.dev)
GitHub: [https://github.com/Helloxiaolaodi/SeqEdge](https://github.com/Helloxiaolaodi/SeqEdge)

语言: [English](./README.md) | 简体中文 | [问题反馈](https://github.com/Helloxiaolaodi/SeqEdge/issues)

详细搭建指南: [SeqEdge 网站搭建的详细解读](https://www.cnblogs.com/Helloxiaolaodi/p/21776373)

技术栈: Next.js | React | Supabase | Cloudflare R2 | Hugging Face Datasets | Cloudflare Workers | JBrowse 2 | TanStack Table | ECharts

![License](https://img.shields.io/github/license/Helloxiaolaodi/SeqEdge?style=flat-square)
![Stars](https://img.shields.io/github/stars/Helloxiaolaodi/SeqEdge?style=flat-square)
![Forks](https://img.shields.io/github/forks/Helloxiaolaodi/SeqEdge?style=flat-square)
![Issues](https://img.shields.io/github/issues/Helloxiaolaodi/SeqEdge?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-15.5.21-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-2.110.7-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?style=flat-square&logo=vercel)

## 1. 项目概览

SeqEdge 是一个可直接部署的科研数据库模板，适合需要公开展示基因组数据、预测位点、样本元数据和浏览器联动结果的研究团队。仓库将三类职责拆开处理：

- 结构化元数据存放在 Supabase / PostgreSQL；
- 大体积基因组文件存放在对象存储；
- 浏览器端通过 JBrowse 2、TanStack Table 和 ECharts 完成交互式展示。

这种拆分方式可以让关系型数据库保持轻量，也便于把 FASTA、注释文件和其他大文件放在更适合流式读取的存储层中，同时兼容 Vercel 与 Cloudflare 两类部署平台。

## 2. 架构

![SeqEdge Architecture](./docs/architecture.gif)

### 2.1 请求路径

1. 页面外壳由 Vercel 或 Cloudflare Pages 提供。
2. 检索和统计请求由 Next.js API 路由转发到 Supabase。
3. JBrowse 只按需请求当前基因组区间需要的字节范围。
4. 大体积基因组文件保留在对象存储中，而不是写入 PostgreSQL。

## 3. 快速开始

### 3.1 环境准备

- Node.js `18+`
- npm
- 一个 Supabase 项目
- 一个支持 CORS 和 HTTP Range 请求的对象存储

### 3.2 Fork 与克隆仓库

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
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
NEXT_PUBLIC_STORAGE_BASE_URL=https://huggingface.co/datasets/<user>/<repo>/resolve/main
NEXT_PUBLIC_HF_PROXY_URL=https://seqedge-hf-proxy.your-account.workers.dev
NEXT_PUBLIC_REFERENCE_ASSEMBLY=NC_045512.2
NEXT_PUBLIC_REFERENCE_DEFAULT_LOCUS=NC_045512.2:1-5000
NEXT_PUBLIC_REFERENCE_FASTA=scov2.fa
NEXT_PUBLIC_REFERENCE_FASTA_INDEX=scov2.fa.fai
NEXT_PUBLIC_REFERENCE_BED=scov2.genes.bed
NEXT_PUBLIC_REFERENCE_GFF3=scov2.genes.gff3
```

正式部署时强烈建议同时配置 `SUPABASE_SERVICE_ROLE_KEY`。SeqEdge 的统计、promoter 查询、variant 查询和样本详情读取都走服务端 API 路由；有了 service role key，即使 anon 的 RLS 策略暂时没有完全配置好，也能稳定读取真实数据。

同时兼容旧变量名:

```bash
NEXT_PUBLIC_R2_PUBLIC_URL=https://your-bucket.your-account.r2.dev/test-data
```

推荐的正式部署策略:

- 将大体积基因组文件存放在 Hugging Face Datasets；
- 让浏览器访问通过 `NEXT_PUBLIC_HF_PROXY_URL` 指向的 Cloudflare Worker；
- 将 Cloudflare R2 作为镜像或备用入口，而不是默认主链路。

如果文件位于 `test-data/` 等子目录下，请把这个前缀直接写进 `NEXT_PUBLIC_STORAGE_BASE_URL`。

### 3.4 初始化数据库

在 Supabase 中执行 `schema.sql`，然后只导入你自己的真实元数据和注释记录。

仅创建表结构并不会自动生成首页统计。下载得到的测试数据包主要用于浏览器与对象存储链路验证，它不会自动填充 `genome_samples`、`predicted_promoters` 或 `variant_index`。如果希望首页显示非零统计值，仍然需要额外把真实元数据导入这三张表。

### 3.5 本地运行

```bash
npm run dev
```

本地开发必须使用真实可用的环境变量。`.env.local` 示例里的占位值会被系统视为“未配置”，因此在没有替换成真实 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 之前，`/api/stats`、`/api/promoters` 等服务端路由会直接返回明确的错误信息。

如果 `NEXT_PUBLIC_STORAGE_BASE_URL` 或 `NEXT_PUBLIC_R2_PUBLIC_URL` 仍然指向占位对象存储地址，Genome Browser 现在会快速失败并直接显示配置提示，而不会像之前那样因为探测不可达主机而让页面看起来长时间卡住。

实际排查本地启动问题时，通常可以先分成两类：

- 缺少 Supabase 凭据：dashboard 与 promoter API 会明确返回 `Supabase is not configured`。
- 缺少基因组对象存储基地址：Genome Browser 会显示 `Reference data unreachable` 或 `No real genome storage base is configured`，并直接点名相关环境变量。

如果要在本地验证接近生产环境的运行方式，不要对同一个 `.next` 目录混用 `npm run dev` 和 `npm run start`。推荐按下面的顺序执行：

```bash
Remove-Item -Recurse -Force .next
npm run build
$env:PORT=3000
npm run start
```

当前仓库中的 `npm run start` 已回到标准的 `next start` 启动流程。这是目前最稳定的本地生产式验证方式，也可以避免在链接目录或 junction 工作区中额外走自定义 standalone 路径时出现的路径歧义。

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

## 4. 当前应用行为

### 4.1 检索与分页

SeqEdge 当前使用前后端打通的服务端分页。页面层将 `limit` 与 `offset` 传递给 `/api/promoters`，API 在 Supabase 中通过 `range()` 执行真实分页，表格组件使用受控分页模式展示结果。

当前表格已经按“大结果集检索”场景优化，而不是只适用于少量演示记录。用户现在可以在 `score_desc`、`score_asc`、`chrom_start`、`sample_id` 之间切换服务端排序方式，也可以在 `20`、`50`、`100` 行之间切换 page size，直接跳转到指定页，同时查看当前可见区间，并通过 first / previous / next / last 完成连续翻页而不丢失当前筛选条件。

为了让上万条记录更容易核对，表格区还会显示 Active filters 摘要，以及当前页中最常见 chromosome 和 sample ID 的统计摘要。另外，Quick view 可以在 overview、group by sample 和 group by chromosome 之间切换，用来快速重看当前页结果的结构分布。

### 4.2 元数据筛选

像 species、tissue、cohort、BMI 这类样本层条件，会先筛选 `genome_samples`，再把匹配到的 `sample_id` 列表应用到 `predicted_promoters`。

中国成人 BMI 阈值统一定义在 `src/site-config.ts` 中：

- 偏瘦: `< 18.5`
- 正常: `18.5 - 24.0`
- 超重: `24.0 - 28.0`
- 肥胖: `>= 28.0`

### 4.3 User Guide 侧边栏

站内 User Guide 当前包含四部分：

1. Overview
2. Promoters & Features
3. Genome Browser
4. Data & Storage

Promoters & Features 小节现在已经覆盖当前实际可用的筛选维度：chromosome、coordinate range、gene symbol、minimum score、sample ID、species、tissue、cohort 和 BMI class，同时补充了大结果集导航说明。

末尾还列出了 SeqEdge 使用的开源组件出处与致谢信息。

### 4.4 Genome Browser 联动

现在从 Promoter 表格中连续点击不同记录时，浏览器会在现有 JBrowse 视图状态中直接跳转到新的 locus，而不会每次都重新回到默认初始位置再重建浏览器。这更适合连续核对多个 promoter 的真实使用场景。

详情视图也不再是完全遮挡页面的全屏弹窗，而是改成左侧浮动面板。桌面端可以拖动位置，从而在查看记录细节时仍然保留对 Genome Browser 区域的可见性。

## 5. 自定义配置

### 5.1 优先修改的文件

- `src/site-config.ts`: 品牌信息、默认参考组装名称、默认 locus、BMI 阈值、分页大小、功能开关
- `.env.local`: 部署与存储配置
- `schema.sql`: 数据库结构与访问策略

### 5.2 存储模式

SeqEdge 支持四种存储模式，无需改业务代码：

1. 纯 Cloudflare R2
2. 纯 Hugging Face Datasets，使用 `resolve/main`
3. 混合模式，小文件走相对路径，大文件使用完整 `https://` 地址
4. HF 代理模式，通过 `NEXT_PUBLIC_HF_PROXY_URL` 和 `cloudflare-templates/hf-proxy/` 中的 Worker 模板接管请求

### 5.3 Hugging Face 代理部署

直接使用 Hugging Face `resolve/main` 作为 JBrowse 数据源时，请求可能经过重定向、Xet 桥接层和更严格的 CORS 处理，因此对浏览器端基因组读取不够稳定。SeqEdge 提供了一个 Cloudflare Worker 模板，可将这些请求改写成支持 Range 的代理端点。

部署步骤：

1. 编辑 `cloudflare-templates/hf-proxy/wrangler.toml`，将 `HF_REPO_BASE` 设为你的 Hugging Face `resolve/main` 基地址。
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
NEXT_PUBLIC_STORAGE_BASE_URL=https://huggingface.co/datasets/<user>/<repo>/resolve/main
NEXT_PUBLIC_HF_PROXY_URL=https://seqedge-hf-proxy.your-account.workers.dev
```

## 6. 功能模块

- Overview: 摘要卡片与统计图表
- Promoters: 支持服务端分页的坐标型记录检索
- Genome Browser: JBrowse 2 联动浏览
- User Guide: 站内操作说明与开源工具出处

## 7. 部署后自检

### 7.1 基础检查

- 打开 `/`，确认站点可以正常渲染。
- 打开 `/api/stats`，确认返回 `200`。
- 确认浏览器控制台没有重复的对象存储或参考数据错误。

### 7.2 真实基因组存储检查

部署站点必须可以访问这些目标文件：

- `NEXT_PUBLIC_REFERENCE_FASTA` 指向的 FASTA 文件
- `NEXT_PUBLIC_REFERENCE_FASTA_INDEX` 指向的 FASTA 索引文件
- JBrowse 配置所用的 BED、GFF3、BAM、VCF 等轨道文件
- 上述轨道对应的 `.fai`、`.bai`、`.tbi`、`.csi` 等索引文件

如果 Cloudflare Pages 或 Vercel 中的浏览器面板为空，重点检查：

- 对应平台的构建命令是否正确
- Cloudflare Pages 的输出目录是否为 `.open-next`
- `NEXT_PUBLIC_STORAGE_BASE_URL` 是否指向支持 CORS 的公开地址
- 环境变量中的文件名是否与对象存储中的真实键名完全一致
- Supabase 中是否只保留需要公开展示的真实记录

### 7.3 对象存储检查

- 确认 `NEXT_PUBLIC_STORAGE_BASE_URL` 指向支持 CORS 的地址。
- 如果文件位于子目录下，确认基地址已包含该子路径。
- 若使用 Hugging Face，确认公开链接使用 `resolve/main`。
- 若启用了 `NEXT_PUBLIC_HF_PROXY_URL`，确认对应 Worker 已部署且可访问。
- 至少验证一个参考序列索引和一个注释或比对索引的 Range 请求。

## 8. 技术栈

- [Next.js](https://nextjs.org/docs) `15.5.21`
- [React](https://react.dev/learn) `19.2.4`
- [`@supabase/supabase-js`](https://supabase.com/docs/reference/javascript/introduction) `^2.110.7`
- [`@jbrowse/product-core`](https://jbrowse.org/jb2/) `^4.3.0`
- [`@jbrowse/react-linear-genome-view`](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view) `^3.1.0`
- [`@tanstack/react-table`](https://tanstack.com/table/latest/docs/guide/introduction) `^8.21.3`
- [ECharts](https://echarts.apache.org/handbook/en/get-started/) `^6.1.0`
- [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) `^1.20.2`
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) `^4.113.0`

### 8.1 工具出处与致谢

| 工具 | 版本 | 出处 |
|---|---|---|
| [Next.js](https://nextjs.org/docs) | `15.5.21` | 官方文档 |
| [React](https://react.dev/learn) | `19.2.4` | 官方学习资源 |
| [`@supabase/supabase-js`](https://supabase.com/docs/reference/javascript/introduction) | `^2.110.7` | 官方 JavaScript 客户端文档 |
| [`@jbrowse/product-core`](https://jbrowse.org/jb2/) | `^4.3.0` | JBrowse 2 官方文档 |
| [`@jbrowse/react-linear-genome-view`](https://www.npmjs.com/package/@jbrowse/react-linear-genome-view) | `^3.1.0` | npm 包说明 |
| [JBrowse 2](https://jbrowse.org/jb2/) | 集成运行时 | Buels R, et al. *JBrowse 2: a modular genome browser with views of synteny and structural variation*. Nature Biotechnology. 2023 |
| [`@tanstack/react-table`](https://tanstack.com/table/latest/docs/guide/introduction) | `^8.21.3` | 官方文档 |
| [ECharts](https://echarts.apache.org/handbook/en/get-started/) | `^6.1.0` | 官方手册 |
| [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) | `^1.20.2` | OpenNext Cloudflare 官方文档 |
| [Wrangler](https://developers.cloudflare.com/workers/wrangler/) | `^4.113.0` | Cloudflare Workers CLI 官方文档 |

## 9. 数据策略

### 9.1 仅使用真实数据源

SeqEdge 当前只使用真实配置的数据源。如果对象存储或元数据后端不可达，界面会明确显示空状态或错误提示，而不会回退显示模板记录。

当前运行时还会在 API 层统一排除已知的历史模板样本 ID。这用于保护那些曾经导入过旧版演示种子的部署环境，例如 `SCOV2-REF-001`、`SAMPLE-001` 到 `SAMPLE-006`，以及带有 `P-SAMPLE-*`、`C-SAMPLE-*`、`V-SAMPLE-*` 前缀的历史样本。对正式站点来说，最稳妥的做法仍然是在 Supabase 中直接删除这些旧记录，而不是只依赖应用层过滤。

### 9.2 Test Data

为了保证在线站点的响应速度，当前更推荐的正式链路是：把 Hugging Face Datasets 作为主文件仓库，把 `NEXT_PUBLIC_HF_PROXY_URL` 指向的 Cloudflare Worker 作为浏览器访问主入口，再把 Cloudflare R2 作为镜像或备用入口，而不是默认主链路。

如果你要做本地部署、测试验证或给其他使用者提供可重复试跑的数据，建议把测试数据整理为 GitHub Releases 附件。

- 下载方式：从仓库 Releases 页面下载最新的 `seqedge-test-data.zip`。
- 命名建议：发布 Releases 附件时，建议使用带日期的版本化名称，例如 `seqedge-test-data-20260724.zip`，并可额外保留 `seqedge-test-data.zip` 作为“最新版本”下载别名。
- 包含内容：这个数据包主要用于参考序列与浏览器链路验证。当前最终数据包已经整理为两套真实数据。
- `sars-cov-2-lite`：包含 `scov2.fa`、`scov2.fa.fai`、`scov2.gb`、`scov2.genes.bed`、`scov2.genes.gff3`，用于 SeqEdge 默认轻量参考链路验证。
- `volvox-advanced`：包含 `volvox.fa`、`volvox.fa.fai`、`volvox.gff3`、`volvox.sort.gff3.gz`、`volvox-bed12.bed.gz`、`volvox-bed12.bed.gz.tbi`、`volvox.bb`、`volvox-sorted.bam`、`volvox-sorted.bam.bai`，用于验证更完整的 JBrowse 能力，包括索引注释轨道、BigBed 和 BAM 比对轨道。
- 当前用途：这套数据既适合验证最新部署流程中的 SARS-CoV-2 参考文件读取，也适合验证更丰富的 JBrowse 轨道栈。
- 公开出处：
  - `sars-cov-2-lite` | SeqEdge 当前部署所用的 SARS-CoV-2 浏览器验证数据 | Wu F, Zhao S, Yu B, et al. *A new coronavirus associated with human respiratory disease in China*. Nature. 2020;579(7798):265-269. DOI: `10.1038/s41586-020-2008-3`
  - `volvox-advanced` | GMOD / JBrowse 公开示例数据生态 | [JBrowse 2 官方文档](https://jbrowse.org/jb2/) 以及 Buels R, et al. *JBrowse 2: a modular genome browser with views of synteny and structural variation*. Nature Biotechnology. 2023.
- 重要边界：该压缩包不会自动填充 Supabase 的元数据表。即使你已经把文件上传到对象存储，`genome_samples`、`predicted_promoters`、`variant_index` 仍然需要单独导入真实记录，否则首页统计和检索结果会保持为空。
- 使用方式：解压后上传到你自己的对象存储，将 `NEXT_PUBLIC_STORAGE_BASE_URL` 设为对应公开基地址，更新相关 `NEXT_PUBLIC_REFERENCE_*` 环境变量，并在需要首页统计与检索结果时把真实元数据导入 Supabase。
- 配套元数据包：同一套发布流程还应同时提供 `deploy-notes/test-data-final/test-csv/` 下的 CSV 导入包，因为对象存储文件只能验证 JBrowse 链路，不能自动填充首页统计和 Promoter 表格。

对于元数据层，SeqEdge 现在还提供了一套基于 FANTOM5 公开数据整理的真实 CSV 导入包。这个数据包用于直接导入 Supabase，让首页统计卡片、Promoter 表格和 Sample 详情页显示真实内容，而不是空状态。

- 建议存放位置：可将这些 CSV 与发布附件一起整理，例如放在 `deploy-notes/test-data-final/test-csv/`，必要时与主测试压缩包一并提供。
- 直接导入文件：
  - `genome_samples.csv`：`200` 个真实的人类 primary cell 样本，字段已对齐当前 `genome_samples` 表结构。
  - `predicted_promoters.csv`：`24000` 条真实 promoter 记录，字段已对齐当前 `predicted_promoters` 表结构。
- 仅用于溯源的文件：
  - `predicted_promoters_with_source.csv`：与上述 promoter 子集相同，但额外保留 `raw_count` 和 `source_peak_id`。该文件适合做溯源审计或后续扩展，不应直接导入当前生产用的 `predicted_promoters` 表，除非先扩展对应字段。
- 数据来源网址：
  - 样本元数据：`https://fantom.gsc.riken.jp/5/datafiles/latest/basic/human.primary_cell.hCAGE/00_human.primary_cell.hCAGE.hg19.assay_sdrf.txt`
  - promoter 矩阵：`https://fantom.gsc.riken.jp/5/datafiles/latest/extra/CAGE_peaks/hg19.cage_peak_phase1and2combined_counts_ann.osc.txt.gz`
- 真实数据整理说明：
  - 当前子集保留了 `200` 个真实样本，并为每个样本保留评分最高的 `120` 条 promoter；
  - `score` 由原始 FANTOM5 计数经过对数归一化后映射到 SeqEdge 需要的 `0-1` 区间；
  - `total_variants` 固定为 `0`，因为这套最小公开数据包不包含变异元数据；
  - `sequence` 与 `motif_sequence` 为空，因为源文件本身不提供这些字段。
- 建议导入顺序：
  1. 先清空 `predicted_promoters`、`genome_samples`、`variant_index` 中的旧记录；
  2. 将 `genome_samples.csv` 导入 `genome_samples`；
  3. 将 `predicted_promoters.csv` 导入 `predicted_promoters`。
- 导入后的基线结果：
  - `genome_samples_count = 200`
  - `predicted_promoters_count = 24000`
  - `variant_index_count = 0`
  - `/api/stats` 中 score distribution 各分箱的总和应为 `24000`

FANTOM5 出处：

- Lizio M, Harshbarger J, Shimoji H, et al. *Gateways to the FANTOM5 promoter level mammalian expression atlas*. Genome Biology. 2015;16:22.
- FANTOM5 数据门户：`https://fantom.gsc.riken.jp/5/`

本次真实元数据包的发布说明可写成：

- 建议压缩包名称：`seqedge-test-data-20260724.zip`
- 元数据 CSV 位置：`deploy-notes/test-data-final/test-csv/`
- 本次附带的导入文件：
  - `genome_samples.csv`
  - `predicted_promoters.csv`
  - `predicted_promoters_with_source.csv`，仅用于溯源保留
- 面向维护者的导入步骤：
  1. 执行 `truncate table predicted_promoters restart identity cascade;`
  2. 执行 `truncate table genome_samples restart identity cascade;`
  3. 执行 `truncate table variant_index restart identity cascade;`
  4. 将 `genome_samples.csv` 导入 `public.genome_samples`
  5. 将 `predicted_promoters.csv` 导入 `public.predicted_promoters`
  6. 不要把 `predicted_promoters_with_source.csv` 直接导入当前生产表，除非先扩展表结构
- 导入后的验证目标：
  - `/api/stats` 应返回 `total_samples = 200`、`total_promoters = 24000`、`total_variants = 0`
  - 首页 score distribution 图表的各分箱总和应与 promoter 总数一致，而不是只反映被截断的子集

GitHub Releases 适合提供整包测试数据下载；正式站点的在线浏览仍应继续使用支持 CORS 和 Range 请求的公开对象存储。更稳妥的优先级是 `HF 主存储 -> Worker 主访问 -> 可选 R2 镜像`。

## 10. 许可证

本项目按照仓库中声明的许可证发布。
