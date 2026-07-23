# SeqEdge Hugging Face Proxy Worker

解决 Hugging Face Datasets 作为 JBrowse 2 数据源时加载缓慢（5 分钟 vs 10 秒）的 Cloudflare Worker 代理。

## 问题根源

Hugging Face Datasets 的 `resolve/main` 链接会 302 重定向到 Xet CDN 桥接层，导致：

- 浏览器先和 `huggingface.co` 握手 -> 再和 `xethub.hf.co` 做 CORS 预检 -> 再发真实 Range GET
- 每次 Track 初始化卡 3-4 轮往返，累积延迟从 10 秒膨胀到 5 分钟
- CORS 头不全导致 JBrowse Worker 内部 fetch 反复重试/超时

## 这个 Worker 做什么

1. **抹平协议差异**：在后端处理所有 302 重定向、CORS 预检和 Xet CDN 握手，对前端表现为一个普通的、支持 Range 的对象存储
2. **修复 CORS 头**：确保 `Access-Control-Expose-Headers` 包含 `Content-Range`、`Accept-Ranges` 等 JBrowse 必需的头
3. **边缘缓存索引文件**：`.bai`、`.tbi`、`.fai`、`.csi`、`.crai` 等高频索引文件在 Cloudflare 边缘节点缓存 24 小时
4. **数据文件缓存**：`.bam`、`.vcf.gz`、`.fa` 等数据文件缓存 1 小时

## 部署步骤

### 1. 确保 Wrangler 可用

```bash
npm install -g wrangler   # 或使用项目已有的 wrangler
wrangler login
```

### 2. 配置 HF 仓库地址

编辑 `wrangler.toml`，将 `HF_REPO_BASE` 改为你的 HF 数据集 `resolve/main` 地址：

```toml
[vars]
HF_REPO_BASE = "https://huggingface.co/datasets/你的用户名/你的仓库/resolve/main"
```

如果数据放在子目录下，直接包含子目录前缀：

```toml
HF_REPO_BASE = "https://huggingface.co/datasets/你的用户名/你的仓库/resolve/main/genomic-data"
```

### 3. 部署

```bash
cd cloudflare-templates/hf-proxy
npx wrangler deploy
```

部署完成后你会得到一个 `*.workers.dev` 地址，例如：

```
https://seqedge-hf-proxy.你的用户名.workers.dev
```

### 4. 接入 SeqEdge

#### 方案 A：纯 HF 模式（全部文件通过 Worker 代理 HF）

在 SeqEdge 项目的 `.env.local` 中：

```bash
NEXT_PUBLIC_STORAGE_BASE_URL=https://seqedge-hf-proxy.你的用户名.workers.dev
```

数据库里依然存相对路径，一切透明。

#### 方案 B：混合模式（推荐 - 索引放 R2，大文件走代理）

```bash
# 索引和小文件走 R2
NEXT_PUBLIC_STORAGE_BASE_URL=https://你的桶.r2.dev

# 开启自动 HF URL 重写：数据库中任何 huggingface.co 绝对地址自动走代理
NEXT_PUBLIC_HF_PROXY_URL=https://seqedge-hf-proxy.你的用户名.workers.dev
```

数据库中大文件的 `file_path` 列继续存原始 HF `resolve/main` 地址。SeqEdge 的 `storage.ts` 会自动检测并重写为代理地址。

### 5. 验证

打开 SeqEdge 网站的 Genome Browser 页面，在浏览器 DevTools -> Network：

- 过滤 `workers.dev` 域名
- Range GET 请求应直接返回 **206 Partial Content**，不再出现 302
- Response Headers 应包含 `Access-Control-Expose-Headers: Content-Range, Accept-Ranges`
- OPTIONS 预检应返回 **204**，不再出现 403/405

## 成本

- Cloudflare Workers 免费层：每天 10 万请求
- 对于个人/小型实验室的基因组数据库绰绰有余
- 超出免费层后按请求计费，极低

## 性能预期

| 模式                           | 典型首屏加载 | 说明                       |
| ------------------------------ | ------------ | -------------------------- |
| 纯 R2                          | ~10 秒       | 已经是正常水平             |
| 纯 HF（直连，无代理）          | ~5 分钟      | 302 + CORS 灾难            |
| 纯 HF -> Worker 代理            | ~20-30 秒    | 去掉了 302 延时和 CORS 卡顿 |
| 混合（索引 R2 + 数据走代理 HF） | ~10-15 秒    | 索引秒回，数据渐进加载     |

## 多个 HF 仓库

如果你的数据分散在多个 HF 仓库，有两种方式：

1. **部署多个 Worker**：每个仓库一个 Worker，修改 `wrangler.toml` 的 `name` 和 `HF_REPO_BASE`
2. **传参模式**：修改 Worker 接受查询参数指定仓库（需要改 `worker.js`）

## 故障排查

**Worker 返回 502**：检查 `HF_REPO_BASE` 是否正确，确保 `resolve/main`（不是 `blob/main`）

**仍然很慢**：检查 DevTools，确认请求真的走到了 `workers.dev` 而不是直接 `huggingface.co`

**索引文件没有被缓存**：检查 Response Headers 中是否有 `Cache-Control: public, max-age=86400`；确认 Cloudflare 缓存未因其他配置被覆盖

**某些文件 404**：确认 `HF_REPO_BASE` 是否包含了你的文件所在子目录前缀
