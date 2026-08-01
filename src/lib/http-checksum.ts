import { createHash } from "crypto";

const FILE_META_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_COMPUTE_BYTES = 64 * 1024 * 1024;

type FileMeta = {
  sha256Checksum: string | null;
  sizeBytes: number | null;
};

type CachedFileMeta = FileMeta & {
  expiresAt: number;
};

const fileMetaCache = new Map<string, CachedFileMeta>();

type HfFileRef = {
  repo: string;
  dirPath: string;
  fileName: string;
};

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

function parseHfFileUrl(url: string): HfFileRef | null {
  try {
    const normalized = url.replace(/\/blob\/main\//, "/resolve/main/");
    const parsed = new URL(normalized);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const datasetsIndex = parts.indexOf("datasets");
    const resolveIndex = parts.indexOf("resolve");
    if (datasetsIndex === -1 || resolveIndex === -1 || resolveIndex <= datasetsIndex + 2) return null;
    return {
      repo: `${parts[datasetsIndex + 1]}/${parts[datasetsIndex + 2]}`,
      dirPath: parts.slice(resolveIndex + 2, -1).join("/"),
      fileName: parts[parts.length - 1],
    };
  } catch {
    return null;
  }
}

async function resolveHuggingFaceMeta(url: string): Promise<FileMeta | null> {
  const ref = parseHfFileUrl(url);
  if (!ref) return null;
  const api = `https://huggingface.co/api/datasets/${ref.repo}/tree/main${ref.dirPath ? `/${ref.dirPath}` : ""}?recursive=false`;
  const timeout = withTimeout(15000);
  try {
    const res = await fetch(api, { signal: timeout.signal, cache: "force-cache" });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ path: string; size?: number; lfs?: { oid?: string } }>;
    const hit = data.find((item) => item.path.split("/").pop() === ref.fileName);
    if (!hit) return null;
    return {
      sha256Checksum: hit.lfs?.oid ?? null,
      sizeBytes: typeof hit.size === "number" ? hit.size : null,
    };
  } catch {
    return null;
  } finally {
    timeout.clear();
  }
}

async function computeMetaFromBody(url: string): Promise<FileMeta> {
  const headTimeout = withTimeout(15000);
  let head: Response | null = null;
  let headSize: number | null = null;
  try {
    head = await fetch(url, { method: "HEAD", signal: headTimeout.signal, redirect: "follow" });
    if (head.ok) {
      const length = Number(head.headers.get("content-length") || "0");
      if (Number.isFinite(length) && length > 0) headSize = length;
    }
  } catch {
    head = null;
  } finally {
    headTimeout.clear();
  }

  if (headSize != null && headSize > MAX_COMPUTE_BYTES) {
    return { sha256Checksum: null, sizeBytes: headSize };
  }

  const bodyTimeout = withTimeout(60000);
  try {
    const res = await fetch(url, { signal: bodyTimeout.signal, redirect: "follow" });
    if (!res.ok || !res.body) return { sha256Checksum: null, sizeBytes: headSize };
    const hash = createHash("sha256");
    const reader = res.body.getReader();
    let total = headSize ?? 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_COMPUTE_BYTES) {
          await reader.cancel();
          return { sha256Checksum: null, sizeBytes: total };
        }
        hash.update(value);
      }
    }
    return { sha256Checksum: hash.digest("hex"), sizeBytes: total };
  } catch {
    return { sha256Checksum: null, sizeBytes: headSize };
  } finally {
    bodyTimeout.clear();
  }
}

export async function resolveHttpFileMeta(url: string): Promise<FileMeta> {
  if (!url) return { sha256Checksum: null, sizeBytes: null };
  const cached = fileMetaCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return { sha256Checksum: cached.sha256Checksum, sizeBytes: cached.sizeBytes };
  }

  const hfMeta = await resolveHuggingFaceMeta(url);
  const meta: FileMeta = {
    sha256Checksum: hfMeta?.sha256Checksum ?? null,
    sizeBytes: hfMeta?.sizeBytes ?? null,
  };

  if (!meta.sha256Checksum) {
    const computed = await computeMetaFromBody(url);
    meta.sha256Checksum = computed.sha256Checksum;
    meta.sizeBytes = computed.sizeBytes ?? meta.sizeBytes;
  }

  if (meta.sha256Checksum || meta.sizeBytes != null) {
    fileMetaCache.set(url, { ...meta, expiresAt: Date.now() + FILE_META_CACHE_TTL_MS });
  }
  return meta;
}

export async function resolveHttpChecksum(url: string): Promise<string | null> {
  const meta = await resolveHttpFileMeta(url);
  return meta.sha256Checksum;
}

export async function resolveHttpFileSize(url: string): Promise<number | null> {
  const meta = await resolveHttpFileMeta(url);
  return meta.sizeBytes;
}
