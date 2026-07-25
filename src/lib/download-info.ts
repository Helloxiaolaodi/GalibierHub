import { getDirectDownloadUrl, NOT_DIRECT_FILE_URL_MESSAGE, validateDirectFileUrl } from '@/lib/storage';

export type DownloadStorageProvider = 'public_url' | 'supabase_private';

export interface DownloadMetadataPayload {
  custom_label: string | null;
  custom_size_bytes: number | null;
  custom_file_type: string | null;
  custom_description: string | null;
  hidden: boolean;
  password_protected: boolean;
  download_count: number;
  created_at: string | null;
  updated_at: string | null;
  storage_provider: DownloadStorageProvider;
  storage_bucket: string | null;
  storage_path: string | null;
  signed_url_ttl_seconds: number;
  md5_checksum: string | null;
  sha256_checksum: string | null;
}

export interface DownloadResolvedInfo extends DownloadMetadataPayload {
  download_key: string;
  public_url: string | null;
  normalized_public_url: string | null;
  file_name: string;
  file_type: string;
  display_name: string;
  description: string | null;
  size_bytes: number | null;
  access_mode: DownloadStorageProvider;
  cli_supported: boolean;
  resume_supported: boolean;
  hf_cli_command: string | null;
  wget_command: string | null;
  curl_command: string | null;
  access_note: string | null;
  region_hint: string | null;
  direct_url_valid: boolean;
  invalid_reason: string | null;
}

export const DEFAULT_DOWNLOAD_METADATA: DownloadMetadataPayload = {
  custom_label: null,
  custom_size_bytes: null,
  custom_file_type: null,
  custom_description: null,
  hidden: false,
  password_protected: false,
  download_count: 0,
  created_at: null,
  updated_at: null,
  storage_provider: 'public_url',
  storage_bucket: null,
  storage_path: null,
  signed_url_ttl_seconds: 900,
  md5_checksum: null,
  sha256_checksum: null,
};

export const HF_REGION_HINT =
  'Hosted on Hugging Face (US-East). In Asia, use the Hugging Face CLI for more reliable resumed large-file downloads.';

export const PRIVATE_ACCESS_NOTE =
  'This file uses a private Supabase signed URL. Browser download works. Public CLI commands are hidden.';

export function normalizeDownloadKey(key: string): string {
  return key.split('?')[0].trim();
}

export function isHttpUrl(value: string | null | undefined): value is string {
  return Boolean(value) && /^https?:\/\//i.test(String(value));
}

export function extractDownloadFileName(value: string | null | undefined): string {
  if (!value) return 'download.file';
  const normalized = value.split('?')[0];
  const name = normalized.split('/').pop() || 'download.file';
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

export function inferDownloadFileType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    zip: 'Archive (zip)',
    tar: 'Archive (tar)',
    gz: 'Archive (gzip)',
    vcf: 'VCF',
    fasta: 'FASTA',
    fa: 'FASTA',
    fna: 'FASTA',
    gb: 'GenBank',
    genbank: 'GenBank',
    bed: 'BED',
    gff3: 'GFF3',
    gff: 'GFF',
  };
  return map[ext] || ext.toUpperCase() || 'File';
}

export function formatDownloadBytes(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return value >= 100 || unitIndex === 0
    ? `${Math.round(value)} ${units[unitIndex]}`
    : `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function parseHfDownloadCommand(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const datasetsIndex = parts.indexOf('datasets');
    const resolveIndex = parts.indexOf('resolve');
    if (datasetsIndex !== -1 && resolveIndex !== -1 && resolveIndex > datasetsIndex + 2) {
      const repo = `${parts[datasetsIndex + 1]}/${parts[datasetsIndex + 2]}`;
      const filePath = parts.slice(resolveIndex + 2).join('/');
      if (repo && filePath) {
        return `hf download ${repo} ${filePath} --repo-type dataset --local-dir .`;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function buildWgetCommand(url: string): string {
  return `wget -c -O "${extractDownloadFileName(url)}" "${url}"`;
}

export function buildCurlCommand(url: string): string {
  return `curl -L -C - -o "${extractDownloadFileName(url)}" "${url}"`;
}

export function getPublicDownloadUrl(downloadKey: string, accessMode: DownloadStorageProvider): string | null {
  if (accessMode !== 'public_url') return null;
  const url = getDirectDownloadUrl(downloadKey);
  return url || null;
}

export function buildDownloadResolvedInfo(
  downloadKey: string,
  meta: DownloadMetadataPayload,
  fallbackLabel?: string | null,
  fallbackDescription?: string | null,
): DownloadResolvedInfo {
  const accessMode = meta.storage_provider || 'public_url';
  const publicUrl = getPublicDownloadUrl(downloadKey, accessMode);
  const validation = accessMode === 'public_url'
    ? validateDirectFileUrl(publicUrl)
    : { normalizedUrl: '', valid: true, reason: null as string | null };
  const pathLike = meta.storage_path || downloadKey;
  const fileName = meta.custom_label || extractDownloadFileName(pathLike);
  const fileType = meta.custom_file_type || inferDownloadFileType(fileName);
  const description = meta.custom_description ?? fallbackDescription ?? null;
  const effectivePublicUrl = accessMode === 'public_url' && validation.valid ? (publicUrl || null) : null;
  const hfCli = effectivePublicUrl ? parseHfDownloadCommand(effectivePublicUrl) : null;
  const cliSupported = Boolean(effectivePublicUrl) && accessMode === 'public_url';
  const resumeSupported = cliSupported;
  const regionHint = hfCli ? HF_REGION_HINT : null;
  const accessNote = accessMode === 'supabase_private'
    ? PRIVATE_ACCESS_NOTE
    : (!validation.valid ? NOT_DIRECT_FILE_URL_MESSAGE : null);

  return {
    ...meta,
    download_key: downloadKey,
    public_url: effectivePublicUrl,
    normalized_public_url: publicUrl,
    file_name: fileName,
    file_type: fileType,
    display_name: fallbackLabel || fileName,
    description,
    size_bytes: meta.custom_size_bytes,
    access_mode: accessMode,
    cli_supported: cliSupported,
    resume_supported: resumeSupported,
    hf_cli_command: hfCli,
    wget_command: effectivePublicUrl ? buildWgetCommand(effectivePublicUrl) : null,
    curl_command: effectivePublicUrl ? buildCurlCommand(effectivePublicUrl) : null,
    access_note: accessNote,
    region_hint: regionHint,
    direct_url_valid: accessMode !== 'public_url' ? true : validation.valid,
    invalid_reason: accessMode !== 'public_url' ? null : validation.reason,
  };
}
