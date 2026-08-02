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

const HF_TREE_MAX_DIRECTORIES = 1000;
const HF_TREE_MAX_FILES = 20000;
const ROOT_HIDDEN_FILES = new Set(["README.md", ".gitattributes"]);

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
    const apiTreeUrl = `${parsed.origin}/api/datasets/${repo}/tree/${revision}`;
    const resolveBaseUrl = `${parsed.origin}/${parts.slice(0, resolveIndex + 2).join("/")}`;

    return { repo, revision, rootPath, resolveBaseUrl, apiTreeUrl };
  } catch {
    return null;
  }
}

function encodePathSegments(path: string): string {
  return path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

function fullRepoPath(ref: HuggingFaceDatasetRef, entryPath: string): string {
  const normalized = entryPath.replace(/^\/+/, "");
  if (!normalized) return "";
  if (ref.rootPath && normalized !== ref.rootPath && !normalized.startsWith(`${ref.rootPath}/`)) {
    return `${ref.rootPath}/${normalized}`;
  }
  return normalized;
}

function resolveEntryPath(
  ref: HuggingFaceDatasetRef,
  directory: string,
  entryPath: string,
): string {
  const prefixed = fullRepoPath(ref, entryPath);
  if (!prefixed) return "";
  if (directory && prefixed !== directory && !prefixed.startsWith(`${directory}/`)) {
    return `${directory}/${prefixed}`;
  }
  return prefixed;
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

export async function listHuggingFaceDatasetFiles(
  baseUrl: string = STORAGE_BASE_URL,
  forceRefresh = false,
): Promise<HuggingFaceDatasetFile[]> {
  const ref = parseHuggingFaceDatasetRef(baseUrl);
  if (!ref) return [];

  const files: HuggingFaceDatasetFile[] = [];
  const seenFiles = new Set<string>();
  const seenDirectories = new Set<string>();
  const queue: string[] = [];
  const rootPath = ref.rootPath;

  seenDirectories.add(rootPath);
  queue.push(rootPath);

  while (
    queue.length > 0 &&
    seenDirectories.size <= HF_TREE_MAX_DIRECTORIES &&
    files.length < HF_TREE_MAX_FILES
  ) {
    const directory = queue.shift() as string;
    const apiUrl = new URL(
      ref.apiTreeUrl + (directory ? `/${encodePathSegments(directory)}` : ""),
    );
    apiUrl.searchParams.set("recursive", "false");
    if (forceRefresh) {
      apiUrl.searchParams.set("_", Date.now().toString());
    }
    let pageUrl: string | null = apiUrl.toString();

    while (pageUrl) {
      const url: URL = new URL(pageUrl);
      let response: Response = await fetch(url, {
        headers: { "User-Agent": "GalibierHub/1.0", Accept: "application/json" },
        cache: "no-store",
        redirect: "follow",
      });

      if (!response.ok && response.status === 400 && url.searchParams.has("recursive")) {
        url.searchParams.delete("recursive");
        response = await fetch(url, {
          headers: { "User-Agent": "GalibierHub/1.0", Accept: "application/json" },
          cache: "no-store",
          redirect: "follow",
        });
      }
      if (!response.ok) {
        throw new Error(`Hugging Face tree API returned ${response.status}`);
      }

      const entries = (await response.json()) as HfTreeEntry[];
      for (const entry of entries) {
        if (!entry.path) continue;
        const path = resolveEntryPath(ref, directory, entry.path);
        if (!path) continue;
        const relativePath = ref.rootPath ? path.slice(ref.rootPath.length + 1) : path;
        if (ROOT_HIDDEN_FILES.has(relativePath)) continue;

        if (entry.type === "directory") {
          if (!seenDirectories.has(path)) {
            seenDirectories.add(path);
            queue.push(path);
          }
          continue;
        }

        if (entry.type !== "file" || seenFiles.has(path)) continue;
        seenFiles.add(path);
        const base = ref.resolveBaseUrl.endsWith("/")
          ? ref.resolveBaseUrl
          : `${ref.resolveBaseUrl}/`;
        files.push({
          path,
          url: new URL(path, base).toString(),
          size: typeof entry.size === "number" ? entry.size : null,
          sha256Checksum: entry.lfs?.oid ?? entry.oid ?? null,
          updatedAt: (() => { const lc = entry.lastCommit; if (lc && typeof lc === 'object') { const d = (lc as Record<string,unknown>).date; if (typeof d === 'string') return d; } if (typeof lc === 'string') return lc; return null; })(),
        });
      }

      const nextFromLink = extractNextUrl(response.headers.get("link"), url);
      const nextHeader = response.headers.get("x-next-link") || response.headers.get("next-link");
      pageUrl = nextFromLink || (nextHeader ? new URL(nextHeader, url).toString() : null);
    }
  }

  return files;
}
