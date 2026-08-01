import { createHash } from "crypto";

const CHECKSUM_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_COMPUTE_BYTES = 64 * 1024 * 1024;

const checksumCache = new Map<string, { checksum: string; expiresAt: number }>();

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

async function resolveHuggingFaceChecksum(url: string): Promise<string | null> {
  const ref = parseHfFileUrl(url);
  if (!ref) return null;
  const api = `https://huggingface.co/api/datasets/${ref.repo}/tree/main${ref.dirPath ? `/${ref.dirPath}` : ""}?recursive=false`;
  const timeout = withTimeout(15000);
  try {
    const res = await fetch(api, { signal: timeout.signal, cache: "force-cache" });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ path: string; lfs?: { oid?: string } }>;
    const hit = data.find((item) => item.path.split("/").pop() === ref.fileName);
    return hit?.lfs?.oid ?? null;
  } catch {
    return null;
  } finally {
    timeout.clear();
  }
}

async function computeChecksumFromBody(url: string): Promise<string | null> {
  const headTimeout = withTimeout(15000);
  let head: Response | null = null;
  try {
    head = await fetch(url, { method: "HEAD", signal: headTimeout.signal, redirect: "follow" });
  } catch {
    head = null;
  } finally {
    headTimeout.clear();
  }

  if (head?.ok) {
    const length = Number(head.headers.get("content-length") || "0");
    if (Number.isFinite(length) && length > MAX_COMPUTE_BYTES) return null;
  }

  const bodyTimeout = withTimeout(60000);
  try {
    const res = await fetch(url, { signal: bodyTimeout.signal, redirect: "follow" });
    if (!res.ok || !res.body) return null;
    const hash = createHash("sha256");
    const reader = res.body.getReader();
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_COMPUTE_BYTES) {
          await reader.cancel();
          return null;
        }
        hash.update(value);
      }
    }
    return hash.digest("hex");
  } catch {
    return null;
  } finally {
    bodyTimeout.clear();
  }
}

export async function resolveHttpChecksum(url: string): Promise<string | null> {
  if (!url) return null;
  const cached = checksumCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.checksum;

  const checksum = (await resolveHuggingFaceChecksum(url)) || (await computeChecksumFromBody(url));
  if (checksum) {
    checksumCache.set(url, { checksum, expiresAt: Date.now() + CHECKSUM_CACHE_TTL_MS });
  }
  return checksum;
}
