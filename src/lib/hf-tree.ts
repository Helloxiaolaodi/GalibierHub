import { STORAGE_BASE_URL } from "@/lib/storage";

type HfTreeEntry = {
  type?: string;
  path?: string;
  size?: number | null;
  oid?: string | null;
  lfs?: { oid?: string | null } | null;
  lastCommit?: string | { date?: string | null } | null;
};

export type HuggingFaceDatasetFile = {
  path: string;
  url: string;
  size: number | null;
  sha256Checksum: string | null;
  updatedAt: string | null;
};

type HuggingFaceDatasetRef = {
  repo: string;
  revision: string;
  rootPath: string;
  resolveBaseUrl: string;
  apiTreeUrl: string;
};

const HF_TREE_PAGE_SIZE = 1000;
const HF_TREE_MAX_PAGES = 100;
const HF_TREE_MAX_FILES = 20000;

function parseHuggingFaceDatasetRef(baseUrl: string = STORAGE_BASE_URL): HuggingFaceDatasetRef | null {
  try {
    const parsed = new URL(baseUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const datasetsIndex = parts.indexOf("datasets");
    const resolveIndex = parts.indexOf("resolve");
    if (datasetsIndex === -1 || resolveIndex === -1 || resolveIndex < datasetsIndex + 3) return null;

    const repo = `${parts[datasetsIndex + 1]}/${parts[datasetsIndex + 2]}`;
    const revision = parts[resolveIndex + 1] || "main";
    const rootPath = parts.slice(resolveIndex + 2).join("/");
    const apiTreeUrl = `${parsed.origin}/api/datasets/${repo}/tree/${revision}${
      rootPath ? `/${rootPath.split("/").map(encodeURIComponent).join("/")}` : ""
    }`;
    const resolveBaseUrl = `${parsed.origin}/${parts.slice(0, resolveIndex + 2).join("/")}`;

    return { repo, revision, rootPath, resolveBaseUrl, apiTreeUrl };
  } catch {
    return null;
  }
}

function fullRepoPath(ref: HuggingFaceDatasetRef, entryPath: string): string {
  const normalized = entryPath.replace(/^\/+/, "");
  if (!normalized) return "";
  if (ref.rootPath && normalized !== ref.rootPath && !normalized.startsWith(`${ref.rootPath}/`)) {
    return `${ref.rootPath}/${normalized}`;
  }
  return normalized;
}

function extractNextUrl(linkHeader: string | null, currentUrl: URL): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    const urlMatch = part.match(/<([^>]+)>/);
    const relMatch = part.match(/rel\s*=\s*"?next"?/i);
    if (urlMatch && relMatch) return new URL(urlMatch[1], currentUrl).toString();
  }
  return null;
}

function parseUpdatedAt(value: string | { date?: string | null } | null | undefined): string | null {
  if (!value) return null;
  const raw = typeof value === "string" ? value : value.date;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function listHuggingFaceDatasetFiles(
  baseUrl: string = STORAGE_BASE_URL,
): Promise<HuggingFaceDatasetFile[]> {
  const ref = parseHuggingFaceDatasetRef(baseUrl);
  if (!ref) return [];

  const files: HuggingFaceDatasetFile[] = [];
  const seen = new Set<string>();
  let currentUrl: string | null = ref.apiTreeUrl;
  let offset = 0;
  let pages = 0;

  while (currentUrl && pages < HF_TREE_MAX_PAGES && files.length < HF_TREE_MAX_FILES) {
    const url: URL = new URL(currentUrl);
    url.searchParams.set("recursive", "true");
    url.searchParams.set("expand", "true");
    url.searchParams.set("limit", String(HF_TREE_PAGE_SIZE));
    if (offset > 0 && !url.searchParams.has("offset")) {
      url.searchParams.set("offset", String(offset));
    }

    const response: Response = await fetch(url, {
      headers: { "User-Agent": "GalibierHub/1.0", Accept: "application/json" },
      cache: "no-store",
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`Hugging Face tree API returned ${response.status}`);
    }

    const entries = (await response.json()) as HfTreeEntry[];
    const previousFileCount = files.length;
    for (const entry of entries) {
      if (!entry.path || entry.type !== "file") continue;
      const path = fullRepoPath(ref, entry.path);
      if (!path || seen.has(path)) continue;
      seen.add(path);
      const base = ref.resolveBaseUrl.endsWith("/") ? ref.resolveBaseUrl : `${ref.resolveBaseUrl}/`;
      files.push({
        path,
        url: new URL(path, base).toString(),
        size: typeof entry.size === "number" ? entry.size : null,
        sha256Checksum: entry.lfs?.oid ?? entry.oid ?? null,
        updatedAt: parseUpdatedAt(entry.lastCommit),
      });
    }
    pages += 1;

    const nextFromLink: string | null = extractNextUrl(response.headers.get("link"), url);
    const nextHeader: string | null = response.headers.get("x-next-link") || response.headers.get("next-link");
    if (nextFromLink) {
      currentUrl = nextFromLink;
      continue;
    }
    if (nextHeader) {
      currentUrl = new URL(nextHeader, url).toString();
      continue;
    }
    if (files.length === previousFileCount && offset > 0) {
      break;
    }
    if (entries.length >= HF_TREE_PAGE_SIZE) {
      offset += entries.length;
      currentUrl = url.toString();
      continue;
    }
    currentUrl = null;
  }

  return files;
}
