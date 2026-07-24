# SeqEdge Hugging Face Proxy Worker

A Cloudflare Worker that resolves slow loading (5 min vs 10 sec) when using Hugging Face Datasets as a JBrowse 2 data source.

## Root Cause

Hugging Face Datasets resolve/main links 302-redirect through a Xet CDN bridge layer, causing:

- Browser handshake with huggingface.co then CORS preflight with xethub.hf.co then actual Range GET
- Each Track init stalls for 3-4 round-trips, ballooning cumulative latency from 10 seconds to 5 minutes
- Incomplete CORS headers cause JBrowse internal Worker fetch to retry/timeout repeatedly

## What This Worker Does

1. Flatten protocol differences: handle all 302 redirects, CORS preflights, and Xet CDN handshakes server-side, presenting a plain, Range-capable object store to the frontend.
2. Repair CORS headers: ensure Access-Control-Expose-Headers includes Content-Range, Accept-Ranges, and other headers JBrowse requires.
3. Edge-cache index files: .bai, .tbi, .fai, .csi, .crai, and other high-frequency index files are cached at Cloudflare edge nodes for 24 hours.
4. Cache data files: .bam, .vcf.gz, .fa, and other data files cached for 1 hour.

## Deployment Steps

### 1. Ensure Wrangler Is Available

    npm install -g wrangler
    wrangler login

### 2. Configure HF Repo Base URL

Edit wrangler.toml, change HF_REPO_BASE to your HF dataset resolve/main URL:

    [vars]
    HF_REPO_BASE = "https://huggingface.co/datasets/your-username/your-repo/resolve/main"

If data is stored in a subdirectory, include the prefix directly:

    HF_REPO_BASE = "https://huggingface.co/datasets/your-username/your-repo/resolve/main/genomic-data"

### 3. Deploy

    cd cloudflare-templates/hf-proxy
    npx wrangler deploy

After deployment you will get a *.workers.dev address, for example:

    https://seqedge-hf-proxy.your-username.workers.dev

### 4. Connect to SeqEdge

#### Option A: Pure HF mode (all files proxied through Worker)

In SeqEdge project .env.local:

    NEXT_PUBLIC_STORAGE_BASE_URL=https://seqedge-hf-proxy.your-username.workers.dev

The database continues to store relative paths; everything is transparent.

#### Option B: Hybrid mode (recommended; indexes on R2, large files proxied)

    NEXT_PUBLIC_STORAGE_BASE_URL=https://your-bucket.r2.dev
    NEXT_PUBLIC_HF_PROXY_URL=https://seqedge-hf-proxy.your-username.workers.dev

Large file file_path columns continue to store raw HF resolve/main URLs. SeqEdge storage.ts auto-detects and rewrites them to the proxy URL.

### 5. Verify

Open SeqEdge Genome Browser page, check browser DevTools then Network:

- Filter by workers.dev domain
- Range GET requests should directly return 206 Partial Content, no more 302s
- Response Headers should include Access-Control-Expose-Headers: Content-Range, Accept-Ranges
- OPTIONS preflight should return 204, no more 403/405

## Cost

- Cloudflare Workers free tier: 100,000 requests/day
- More than sufficient for personal/small-lab genomic databases
- After the free tier, billed per request at extremely low cost

## Expected Performance

| Mode                          | Typical initial load | Notes                                  |
| ----------------------------- | -------------------- | -------------------------------------- |
| Pure R2                       | ~10 s                | Already the normal baseline            |
| Pure HF (direct, no proxy)    | ~5 min               | 302 + CORS disaster                    |
| Pure HF via Worker proxy      | ~20-30 s             | 302 latency and CORS stalls eliminated |
| Hybrid (indexes R2 + HF data) | ~10-15 s             | Indexes return instantly, data progressive |

## Multiple HF Repos

If your data is spread across multiple HF repos, there are two approaches:

1. Deploy multiple Workers: one Worker per repo, modify wrangler.toml name and HF_REPO_BASE.
2. Query-parameter mode: modify the Worker to accept a query parameter specifying the repo (requires editing worker.js).

## Troubleshooting

Worker returns 502: check that HF_REPO_BASE is correct, ensure it uses resolve/main (not blob/main).

Still slow: check DevTools, confirm requests are genuinely hitting workers.dev instead of huggingface.co directly.

Index files not cached: check that Response Headers include Cache-Control: public, max-age=86400; confirm Cloudflare caching is not overridden by other configuration.

Some files return 404: confirm that HF_REPO_BASE includes your file subdirectory prefix.
