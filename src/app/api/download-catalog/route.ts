import { NextRequest, NextResponse } from 'next/server';
import { SiteConfig } from '@/site-config';
import { getDirectDownloadUrl, validateDirectFileUrl } from '@/lib/storage';
import { normalizeDownloadKey } from '@/lib/download-info';
import { resolveHttpChecksum } from '@/lib/http-checksum';
import { isExcludedSampleId } from '@/lib/sample-exclusions';
import { getSupabase, isSupabaseConfigured } from '@/utils/supabase';
import { getBearerToken, requireCreatorGithubAuth } from '@/lib/feedback-admin';

type CatalogSourceScope = 'featured' | 'sample' | 'mixed';

type DownloadCatalogItem = {
  id: string;
  url: string;
  label: string;
  description: string;
  sizeLabel: string;
  sizeBytes: number | null;
  showCli: boolean;
  providerLabel: string;
  sourceScope: CatalogSourceScope;
  sampleCount: number;
  sampleIds: string[];
  kinds: string[];
  hidden?: boolean;
  updatedAt?: string | null;
  sha256Checksum?: string | null;
  md5Checksum?: string | null;
};

type MutableCatalogItem = DownloadCatalogItem & {
  _scopes: Set<'featured' | 'sample'>;
  _sampleIds: Set<string>;
  _kinds: Set<string>;
};

const SAMPLE_FIELDS = 'sample_id, vcf_download_url, fasta_download_url, gb_download_url, bed_download_url, gff3_download_url, vcf_download_mode, fasta_download_mode';
const PAGE_SIZE = 1000;
const CATALOG_CACHE_MS = 5 * 60 * 1000;
const catalogCache = new Map<string, { expiresAt: number; payload: unknown }>();

function inferProviderLabel(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('huggingface.co')) return 'Hugging Face';
    if (host.includes('r2.dev') || host.includes('workers.dev') || host.includes('cloudflare')) return 'Cloudflare';
    if (host.includes('supabase.co')) return 'Supabase';
    return host;
  } catch {
    return 'Configured storage';
  }
}

function kindLabel(kind: string): string {
  if (kind === 'vcf') return 'VCF';
  if (kind === 'fasta') return 'FASTA';
  if (kind === 'gb') return 'GenBank';
  if (kind === 'bed') return 'BED';
  if (kind === 'gff3') return 'GFF3';
  return kind.toUpperCase();
}

function upsertItem(
  map: Map<string, MutableCatalogItem>,
  input: {
    url: string;
    label: string;
    description: string;
    sizeLabel?: string;
    sizeBytes?: number | null;
    showCli?: boolean;
    sourceScope: 'featured' | 'sample';
    sampleId?: string;
    kind?: string;
  },
) {
  const normalizedUrl = getDirectDownloadUrl(input.url);
  const validation = validateDirectFileUrl(normalizedUrl);
  if (!validation.valid) return;

  const key = normalizeDownloadKey(validation.normalizedUrl);
  if (!key) return;

  const current = map.get(key);
  if (current) {
    current.showCli = current.showCli || Boolean(input.showCli);
    if (!current.sizeLabel && input.sizeLabel) current.sizeLabel = input.sizeLabel;
    if (current.sizeBytes == null && typeof input.sizeBytes === 'number') current.sizeBytes = input.sizeBytes;
    if (current.label.startsWith('Download ') && !input.label.startsWith('Download ')) current.label = input.label;
    if ((!current.description || current.description.includes('configured storage host') || current.description.includes('configured storage location')) && input.description) current.description = input.description;
    current._scopes.add(input.sourceScope);
    if (input.sampleId) current._sampleIds.add(input.sampleId);
    if (input.kind) current._kinds.add(input.kind);
    return;
  }

  map.set(key, {
    id: key,
    url: validation.normalizedUrl,
    label: input.label,
    description: input.description,
    sizeLabel: input.sizeLabel || '',
    sizeBytes: typeof input.sizeBytes === 'number' ? input.sizeBytes : null,
    showCli: Boolean(input.showCli),
    providerLabel: inferProviderLabel(validation.normalizedUrl),
    sourceScope: input.sourceScope,
    sampleCount: input.sampleId ? 1 : 0,
    sampleIds: input.sampleId ? [input.sampleId] : [],
    kinds: input.kind ? [input.kind] : [],
    _scopes: new Set([input.sourceScope]),
    _sampleIds: new Set(input.sampleId ? [input.sampleId] : []),
    _kinds: new Set(input.kind ? [input.kind] : []),
  });
}

async function fetchAllSampleRows() {
  if (!isSupabaseConfigured) return [] as Array<Record<string, unknown>>;

  const sb = getSupabase();
  const rows: Array<Record<string, unknown>> = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await sb
      .from('genome_samples')
      .select(SAMPLE_FIELDS)
      .range(from, to);

    if (error) {
      throw error;
    }

    const batch = (data ?? []) as Array<Record<string, unknown>>;
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

export async function GET(request: NextRequest) {
  const cacheKey = getBearerToken(request) ? "admin" : "public";
  const cached = catalogCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  }

  const items = new Map<string, MutableCatalogItem>();

  for (const featured of SiteConfig.downloads.featured) {
    if (!featured.href) continue;
    upsertItem(items, {
      url: featured.href,
      label: featured.label,
      description: featured.description,
      sizeLabel: featured.sizeLabel,
      showCli: featured.mode === 'cli',
      sourceScope: 'featured',
    });
  }

  let sampleWarning: string | null = null;
  try {
    const sampleRows = await fetchAllSampleRows();
    for (const row of sampleRows) {
      const sampleId = typeof row.sample_id === 'string' ? row.sample_id.trim() : '';
      if (!sampleId || isExcludedSampleId(sampleId)) continue;

      const entries: Array<{ kind: string; url: unknown; showCli: boolean }> = [
        { kind: 'vcf', url: row.vcf_download_url, showCli: row.vcf_download_mode === 'cli' },
        { kind: 'fasta', url: row.fasta_download_url, showCli: row.fasta_download_mode === 'cli' },
        { kind: 'gb', url: row.gb_download_url, showCli: true },
        { kind: 'bed', url: row.bed_download_url, showCli: true },
        { kind: 'gff3', url: row.gff3_download_url, showCli: true },
      ];

      for (const entry of entries) {
        if (typeof entry.url !== 'string' || !entry.url.trim()) continue;
        upsertItem(items, {
          url: entry.url,
          label: `Download ${kindLabel(entry.kind)}`,
          description: 'Sample-level file available from the configured storage location.',
          showCli: entry.showCli,
          sourceScope: 'sample',
          sampleId,
          kind: entry.kind,
        });
      }
    }
  } catch (error) {
    sampleWarning = error instanceof Error ? error.message : 'Failed to load sample-linked downloads.';
  }

  let result = Array.from(items.values())
    .map(({ _scopes, _sampleIds, _kinds, ...item }) => ({
      ...item,
      sourceScope: _scopes.size === 2 ? 'mixed' : (_scopes.has('featured') ? 'featured' : 'sample'),
      sampleCount: _sampleIds.size,
      sampleIds: Array.from(_sampleIds).sort(),
      kinds: Array.from(_kinds).sort(),
    }))
    .sort((a, b) => a.url.localeCompare(b.url));

  let metadataWarning: string | null = sampleWarning;
  let isAdmin = false;

  if (result.length > 0 && isSupabaseConfigured) {
    const creatorAuth = await requireCreatorGithubAuth(getBearerToken(request));
    isAdmin = creatorAuth.ok;

    try {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('download_metadata')
        .select('download_key, hidden, custom_size_bytes, updated_at, sha256_checksum, md5_checksum')
        .in('download_key', result.map((item) => item.id));

      if (error) {
        throw error;
      }

      const metadataMap = new Map(
        (data ?? [])
          .filter((row) => typeof row.download_key === 'string')
          .map((row) => [normalizeDownloadKey(String(row.download_key)), row]),
      );

      const hiddenKeys = new Set(
        (data ?? [])
          .filter((row) => Boolean(row.hidden) && typeof row.download_key === 'string')
          .map((row) => normalizeDownloadKey(String(row.download_key))),
      );

      result = result.map((item) => ({
        ...item,
        hidden: hiddenKeys.has(item.id),
        sizeBytes: typeof metadataMap.get(item.id)?.custom_size_bytes === 'number'
          ? metadataMap.get(item.id)?.custom_size_bytes ?? null
          : item.sizeBytes,
        updatedAt: typeof metadataMap.get(item.id)?.updated_at === 'string'
          ? metadataMap.get(item.id)?.updated_at ?? null
          : null,
        sha256Checksum: typeof metadataMap.get(item.id)?.sha256_checksum === 'string'
          ? metadataMap.get(item.id)?.sha256_checksum ?? null
          : null,
        md5Checksum: typeof metadataMap.get(item.id)?.md5_checksum === 'string'
          ? metadataMap.get(item.id)?.md5_checksum ?? null
          : null,
      }));

      if (!isAdmin && hiddenKeys.size > 0) {
        result = result.filter((item) => !hiddenKeys.has(item.id));
      }
    } catch (error) {
      metadataWarning = metadataWarning || (error instanceof Error ? error.message : 'Failed to load download visibility metadata.');
    }
  }

  // Auto-fetch file sizes for items that still have no sizeBytes
  const itemsWithoutSize = result.filter((item) => item.sizeBytes == null && !item.sizeLabel);
  if (itemsWithoutSize.length > 0 && itemsWithoutSize.length <= 30) {
    const sizePromises = itemsWithoutSize.map(async (item) => {
      try {
        const directUrl = getDirectDownloadUrl(item.url);
        if (!validateDirectFileUrl(directUrl)) return;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const headRes = await fetch(directUrl, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeout);
        const contentLength = headRes.headers.get('content-length');
        if (contentLength && /^\d+$/.test(contentLength)) {
          item.sizeBytes = parseInt(contentLength, 10);
        }
      } catch {
        // Silently ignore - size will remain null / show 'Unknown'
      }
    });
    await Promise.allSettled(sizePromises);
  }

  // Resolve missing SHA-256 checksums from Hugging Face for items without DB metadata
  const missingChecksums = result.filter(
    (item) => !item.sha256Checksum && item.providerLabel !== 'Supabase' && /^https?:\/\//i.test(item.url),
  );
  if (missingChecksums.length > 0) {
    const checksumPromises = missingChecksums.map(async (item) => {
      const checksum = await resolveHttpChecksum(item.url);
      if (checksum) item.sha256Checksum = checksum;
    });
    await Promise.allSettled(checksumPromises);
  }

  const payload = { items: result, warning: metadataWarning, isAdmin };
  catalogCache.set(cacheKey, { expiresAt: Date.now() + CATALOG_CACHE_MS, payload });
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
