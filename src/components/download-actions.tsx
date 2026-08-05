'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildDownloadResolvedInfo,
  DEFAULT_DOWNLOAD_METADATA,
  formatDownloadBytes,
  normalizeDownloadKey,
  type DownloadMetadataPayload,
  type DownloadResolvedInfo,
  type DownloadStorageProvider,
} from '@/lib/download-info';
import { NOT_DIRECT_FILE_URL_MESSAGE } from '@/lib/storage';
import {
  getPreferredDownloadRegion,
  resolveBrowserDownload,
  triggerBrowserDownload,
  type DownloadRegion,
} from '@/lib/download-region';

interface DownloadActionsProps {
  url: string;
  label: string;
  sizeLabel?: string | null;
  initialSizeBytes?: number | null;
  initialUpdatedAt?: string | null;
  description?: string | null;
  showCli?: boolean;
  isAdmin?: boolean;
  accessToken?: string | null;
  className?: string;
  initialHidden?: boolean;
  onMetadataSaved?: (next: DownloadMetadataPayload) => void;
  compact?: boolean;
}

type FileMeta = { size: number | null; sha256: string | null; loading: boolean };

type EditDraft = {
  custom_label: string;
  custom_file_type: string;
  custom_description: string;
  custom_size_bytes: string;
  hidden: boolean;
  password: string;
  storage_provider: DownloadStorageProvider;
  storage_bucket: string;
  storage_path: string;
  signed_url_ttl_seconds: string;
  md5_checksum: string;
  sha256_checksum: string;
};

async function readDbMeta(key: string, downloadUrl: string): Promise<DownloadMetadataPayload> {
  try {
    const res = await fetch(`/api/download-metadata?key=${encodeURIComponent(key)}&url=${encodeURIComponent(downloadUrl)}`);
    if (!res.ok) throw new Error('failed');
    const data = (await res.json()) as Partial<DownloadMetadataPayload>;
    return { ...DEFAULT_DOWNLOAD_METADATA, ...data };
  } catch {
    return DEFAULT_DOWNLOAD_METADATA;
  }
}

function RevealRow({ rowKey, label, value, copied, onCopy, loading, unavailable }: {
  rowKey: string;
  label: string;
  value?: string | null;
  copied?: string | null;
  onCopy: (key: string, text: string) => void;
  loading?: boolean;
  unavailable?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors"
      >
        <span>{label}</span>
        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
          {open ? 'Hide' : 'Show'}
          <svg className={"h-3.5 w-3.5 transition-transform " + (open ? "rotate-180" : "")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="border-t border-[var(--color-border)] px-3 py-3">
          {loading ? (
            <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded border border-gray-200 text-gray-500">Loading...</span>
          ) : unavailable ? (
            <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded border border-gray-200 text-gray-400">{unavailable}</span>
          ) : value ? (
            <div className="flex items-start gap-3">
              <code className="code-panel min-w-0 flex-1 break-all rounded-lg px-3 py-2 font-mono text-[11px] text-gray-900">{value}</code>
              <button
                type="button"
                onClick={() => onCopy(rowKey, value)}
                className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                {copied === rowKey ? (
                  <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3" /></svg>
                )}
                {copied === rowKey ? 'Copied' : 'Copy'}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function parseHfRepoAndPath(
  url: string | null | undefined,
  fallbackFileName: string,
): { repo: string; filePath: string } {
  if (!url) return { repo: 'Helloxiaolaodi/seqedge-data', filePath: fallbackFileName || 'download.file' };
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const datasetsIndex = parts.indexOf('datasets');
    const marker = '/resolve/main/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (datasetsIndex !== -1 && parts.length > datasetsIndex + 2 && markerIndex !== -1) {
      let filePath = parsed.pathname.slice(markerIndex + marker.length);
      try {
        filePath = decodeURIComponent(filePath);
      } catch {
        // Keep the raw path when Hugging Face returns invalid escaping.
      }
      return {
        repo: `${parts[datasetsIndex + 1]}/${parts[datasetsIndex + 2]}`,
        filePath: filePath || fallbackFileName || 'download.file',
      };
    }
  } catch {
    // Fall through to defaults.
  }
  return { repo: 'Helloxiaolaodi/seqedge-data', filePath: fallbackFileName || 'download.file' };
}

function CliSection({
  title,
  badge,
  description,
  code,
  expanded,
  onToggle,
  copyKey,
  copied,
  onCopy,
}: {
  title: string;
  badge?: string;
  description?: string;
  code: string;
  expanded: boolean;
  onToggle: () => void;
  copyKey: string;
  copied: string | null;
  onCopy: (key: string, text: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50"
      >
        <span className="min-w-0">
          <span className="text-sm font-medium text-slate-800">{title}</span>
          {badge && <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">{badge}</span>}
          {description && <span className="mt-0.5 block text-xs text-gray-500">{description}</span>}
        </span>
        <span className="flex-shrink-0 text-xs text-slate-500">{expanded ? 'Hide' : 'Show'}</span>
      </button>
      {expanded && (
        <div className="bg-[var(--color-surface-muted)] px-3 py-3">
          <pre className="code-panel overflow-auto whitespace-pre-wrap break-all rounded-lg px-3 py-3 font-mono text-xs text-gray-800">{code}</pre>
          <button
            type="button"
            onClick={() => onCopy(copyKey, code)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
          >
            {copied === copyKey ? (
              <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3" /></svg>
            )}
            {copied === copyKey ? 'Copied' : 'Copy All'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function DownloadActions({
  url,
  label,
  sizeLabel,
  initialSizeBytes,
  initialUpdatedAt,
  description,
  isAdmin = false,
  accessToken = null,
  className = '',
  initialHidden,
  onMetadataSaved,
  compact = false,
}: DownloadActionsProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [hfMeta, setHfMeta] = useState<FileMeta>({ size: null, sha256: null, loading: false });
  const [dbMeta, setDbMeta] = useState<DownloadMetadataPayload>(DEFAULT_DOWNLOAD_METADATA);
  const [resolvedInfo, setResolvedInfo] = useState<DownloadResolvedInfo | null>(null);
    const [activeTab, setActiveTab] = useState<'download'|'checksum'|'cite'>('download');
  const [cliOs, setCliOs] = useState<'linux' | 'windows'>('linux');
  const [expandedCliSection, setExpandedCliSection] = useState<'hf' | 'basic' | 'hfd' | 'url' | null>(null);
const [unlocked, setUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saveState, setSaveState] = useState<{ ok: boolean; text: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadRegion, setDownloadRegion] = useState<DownloadRegion>(() => getPreferredDownloadRegion());

  const key = normalizeDownloadKey(url);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setHfMeta({ size: initialSizeBytes ?? null, sha256: null, loading: false });
    setDbMeta(DEFAULT_DOWNLOAD_METADATA);
    setResolvedInfo(null);
    setUnlocked(false);
    setPwError(null);
    setEditing(false);
    setDraft(null);
    setSaveState(null);
    setDownloadRegion(getPreferredDownloadRegion());
    setCliOs('linux');
    setExpandedCliSection(null);
    readDbMeta(key, url).then((meta) => {
      if (!active) return;
      setDbMeta(meta);
      setResolvedInfo(buildDownloadResolvedInfo(key, meta, label, description));
    });
    return () => {
      active = false;
    };
  }, [open, key, url, label, description, initialSizeBytes, initialUpdatedAt]);

  useEffect(() => {
    setDbMeta((current) => (current.hidden === initialHidden ? current : { ...current, hidden: initialHidden ?? false }));
  }, [initialHidden]);

  const effectiveInfo = useMemo(() => {
    const base = resolvedInfo || buildDownloadResolvedInfo(key, dbMeta, label, description);
    return {
      ...base,
      size_bytes: dbMeta.custom_size_bytes ?? hfMeta.size ?? base.size_bytes ?? initialSizeBytes ?? null,
      sha256_checksum: dbMeta.sha256_checksum ?? hfMeta.sha256 ?? base.sha256_checksum,
      created_at: dbMeta.created_at ?? initialUpdatedAt ?? base.created_at,
      updated_at: dbMeta.updated_at ?? initialUpdatedAt ?? base.updated_at,
    };
  }, [resolvedInfo, key, dbMeta, label, description, initialSizeBytes, initialUpdatedAt, hfMeta.size, hfMeta.sha256]);

  const displaySize = hfMeta.loading ? 'Loading...' : formatDownloadBytes(effectiveInfo.size_bytes) || sizeLabel || '';
  const linuxVerifyCommand = effectiveInfo.sha256_checksum && effectiveInfo.file_name
    ? `echo "${effectiveInfo.sha256_checksum}  ${effectiveInfo.file_name}" | sha256sum -c -`
    : '';
  const hidden = dbMeta.hidden ?? initialHidden ?? false;
  const passwordProtected = dbMeta.password_protected;
  const linksVisible = isAdmin || (!hidden && (!passwordProtected || unlocked));
  const directUrlInvalid = effectiveInfo.access_mode === 'public_url' && !effectiveInfo.direct_url_valid;
  const publicRouteAvailable = effectiveInfo.access_mode === 'public_url' && !directUrlInvalid && Boolean(effectiveInfo.public_url || effectiveInfo.mirror_public_url);
  const activePublicUrl = downloadRegion === 'apac' ? (effectiveInfo.mirror_public_url || effectiveInfo.public_url) : effectiveInfo.public_url;
  const activeWgetCommand = downloadRegion === 'apac' ? (effectiveInfo.mirror_wget_command || effectiveInfo.wget_command) : effectiveInfo.wget_command;
  const activeCurlCommand = downloadRegion === 'apac' ? (effectiveInfo.mirror_curl_command || effectiveInfo.curl_command) : effectiveInfo.curl_command;
  const activeHfCliCommand = downloadRegion === 'apac' ? (effectiveInfo.mirror_hf_cli_command || effectiveInfo.hf_cli_command) : effectiveInfo.hf_cli_command;
  const activeRegionHint = downloadRegion === 'apac' ? (effectiveInfo.mirror_region_hint || effectiveInfo.region_hint) : effectiveInfo.region_hint;
  const hfRepoInfo = parseHfRepoAndPath(effectiveInfo.public_url || effectiveInfo.mirror_public_url, effectiveInfo.file_name);
  const hfEndpoint = 'https://hf-mirror.com';
  const hfCliBaseCommand = activeHfCliCommand?.replace(/^HF_ENDPOINT=\S+\s+/, '') || null;
  const hfLinuxCommand = hfCliBaseCommand
    ? (downloadRegion === 'apac' ? `export HF_ENDPOINT="${hfEndpoint}"\n${hfCliBaseCommand}` : hfCliBaseCommand)
    : null;
  const hfWindowsCommand = hfCliBaseCommand
    ? (downloadRegion === 'apac' ? `$env:HF_ENDPOINT = "${hfEndpoint}"\n${hfCliBaseCommand}` : hfCliBaseCommand)
    : null;
  const windowsCurlCommand = activeCurlCommand?.replace(/^curl /, 'curl.exe ') || null;
  const basicLinuxCommand = [
    activeWgetCommand ? `# Using wget\n${activeWgetCommand}` : '',
    activeCurlCommand ? `# Using curl\n${activeCurlCommand}` : '',
  ].filter(Boolean).join('\n\n') || null;
  const basicWindowsCommand = windowsCurlCommand
    ? `# Using curl.exe (bundled with Windows 10+)\n${windowsCurlCommand}`
    : null;
  const hfdInstall = 'wget https://hf-mirror.com/hfd/hfd.sh && chmod a+x hfd.sh';
  const hfdEnvLine = downloadRegion === 'apac' ? `export HF_ENDPOINT="${hfEndpoint}"` : '';
  const hfdRun = `./hfd.sh ${hfRepoInfo.repo} --dataset --include ${hfRepoInfo.filePath}`;
  const hfdLinuxCommand = hfdEnvLine ? `${hfdInstall}\n${hfdEnvLine}\n${hfdRun}` : `${hfdInstall}\n${hfdRun}`;
  const hfdWindowsCommand = `# Run the lines below in Git Bash or WSL\n${hfdInstall}\n${hfdEnvLine ? `${hfdEnvLine}\n` : ''}${hfdRun}`;

  const handleCopy = useCallback(async (copyKey: string, text: string | null | undefined) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(copyKey);
      window.setTimeout(() => setCopied((current) => (current === copyKey ? null : current)), 1600);
    } catch {
      setCopied(null);
    }
  }, []);

  const recordDownload = useCallback(async () => {
    try {
      await fetch('/api/download-metadata/inc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ download_key: key, password: pwInput || undefined }),
      });
      setDbMeta((current) => ({ ...current, download_count: current.download_count + 1 }));
      setResolvedInfo((current) => current ? { ...current, download_count: current.download_count + 1 } : current);
    } catch {
      return;
    }
  }, [key, pwInput]);

  const verifyPassword = useCallback(async () => {
    setPwError(null);
    try {
      const res = await fetch('/api/download-metadata/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ download_key: key, password: pwInput }),
      });
      const data = await res.json();
      if (res.ok && data.verified) {
        setUnlocked(true);
      } else {
        setPwError(data.error || 'Wrong password.');
      }
    } catch {
      setPwError('Verification failed. Please try again.');
    }
  }, [key, pwInput]);

  const handleBrowserDownload = useCallback(async () => {
    setDownloading(true);
    setPwError(null);
    try {
      const { url: downloadUrl, filename } = await resolveBrowserDownload({
        download_key: key,
        password: pwInput || undefined,
        label,
        description,
        region: downloadRegion,
      });
      await recordDownload();
      triggerBrowserDownload(downloadUrl, filename);
    } catch {
      setPwError('Failed to prepare download URL.');
    } finally {
      setDownloading(false);
    }
  }, [key, pwInput, label, description, downloadRegion, recordDownload]);

  const startEdit = () => {
    setEditing(true);
    setSaveState(null);
    setDraft({
      custom_label: dbMeta.custom_label || '',
      custom_file_type: dbMeta.custom_file_type || effectiveInfo.file_type,
      custom_description: dbMeta.custom_description || description || '',
      custom_size_bytes: (dbMeta.custom_size_bytes ?? hfMeta.size ?? null)?.toString() ?? '',
      hidden: dbMeta.hidden,
      password: '',
      storage_provider: dbMeta.storage_provider,
      storage_bucket: dbMeta.storage_bucket || '',
      storage_path: dbMeta.storage_path || '',
      signed_url_ttl_seconds: String(dbMeta.signed_url_ttl_seconds || 900),
      md5_checksum: dbMeta.md5_checksum || '',
      sha256_checksum: (dbMeta.sha256_checksum ?? hfMeta.sha256) || '',
    });
  };

  const saveEdit = async () => {
    if (!draft) return;
    setSaveState({ ok: false, text: 'Saving...' });
    try {
      const body: Record<string, unknown> = {
        download_key: key,
        custom_label: draft.custom_label,
        custom_file_type: draft.custom_file_type,
        custom_description: draft.custom_description,
        hidden: draft.hidden,
        storage_provider: draft.storage_provider,
        storage_bucket: draft.storage_bucket,
        storage_path: draft.storage_path,
        md5_checksum: draft.md5_checksum,
        sha256_checksum: draft.sha256_checksum,
      };
      if (draft.custom_size_bytes.trim() === '') body.custom_size_bytes = null;
      else {
        const parsed = Number(draft.custom_size_bytes);
        body.custom_size_bytes = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
      }
      const ttl = Number(draft.signed_url_ttl_seconds);
      if (Number.isFinite(ttl)) body.signed_url_ttl_seconds = ttl;
      if (draft.password.trim()) body.password = draft.password.trim();

      const res = await fetch('/api/download-metadata', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSaveState({ ok: false, text: data.error || 'Save failed.' });
        return;
      }
      const nextMeta = await readDbMeta(key, url);
      setDbMeta(nextMeta);
      setResolvedInfo(buildDownloadResolvedInfo(key, nextMeta, label, description));
      onMetadataSaved?.(nextMeta);
      setSaveState({ ok: true, text: 'Saved.' });
      setEditing(false);
    } catch (error) {
      setSaveState({ ok: false, text: error instanceof Error ? error.message : 'Save failed.' });
    }
  };

  const toggleHiddenQuickly = useCallback(async () => {
    if (!isAdmin || !accessToken) return;
    setSaveState({ ok: false, text: hidden ? 'Showing...' : 'Hiding...' });
    try {
      const res = await fetch('/api/download-metadata', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ download_key: key, hidden: !hidden }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSaveState({ ok: false, text: data.error || 'Update failed.' });
        return;
      }
      const nextMeta = await readDbMeta(key, url);
      setDbMeta(nextMeta);
      setResolvedInfo(buildDownloadResolvedInfo(key, nextMeta, label, description));
      onMetadataSaved?.(nextMeta);
      setSaveState({ ok: true, text: nextMeta.hidden ? 'Hidden.' : 'Visible.' });
    } catch (error) {
      setSaveState({ ok: false, text: error instanceof Error ? error.message : 'Update failed.' });
    }
  }, [isAdmin, accessToken, hidden, key, url, label, description, onMetadataSaved]);

  if (!url) return null;

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      {(!open && !hidden && !compact) && (description || sizeLabel) && (
        <div className="space-y-1">
          {description && <p className="text-sm text-gray-600">{description}</p>}
          {sizeLabel && (
            <div><span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{sizeLabel}</span></div>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {hidden && !isAdmin ? (
          <span className="inline-flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-2 text-sm text-[var(--color-text-muted)]">Hidden by Administrator</span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void handleBrowserDownload()}
              disabled={downloading || (hidden && !isAdmin)}
              className={`inline-flex items-center justify-center rounded-lg bg-[var(--color-accent)] text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-dark)] disabled:opacity-50 ${compact ? 'min-w-[7.25rem] px-3 py-2' : 'min-w-[9rem] px-4 py-2'}`}
            >
              {downloading ? 'Preparing...' : label}
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={`inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] ${compact ? 'min-w-[2.75rem] px-3 py-2' : 'min-w-[7rem] px-4 py-2'}`}
              aria-label="Open CLI and file details"
              title="Open CLI and file details"
            >
              {compact ? 'CLI' : 'CLI / Details'}
            </button>
          </>
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={() => void toggleHiddenQuickly()}
            className="inline-flex min-w-[8rem] items-center justify-center rounded-lg border border-slate-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-100"
          >
            {hidden ? 'Show to visitors' : 'Hide from visitors'}
          </button>
        )}
      </div>
      {isAdmin && saveState && !open && (
        <p className={`text-xs ${saveState.ok ? 'text-emerald-700' : 'text-red-600'}`}>
          {saveState.text}
          {saveState.ok && hidden ? ' Visible to the administrator only.' : ''}
        </p>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="my-8 w-full max-w-3xl rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[var(--color-border)] px-5 py-3">
              <h3 className="text-base font-semibold text-gray-900">{effectiveInfo.display_name}</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-5 px-5 py-4">
              <div className="space-y-3 rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 break-all">{effectiveInfo.file_name}</span>
                  <span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">{effectiveInfo.file_type}</span>
                  {displaySize && <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">{displaySize}</span>}
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{dbMeta.download_count} downloads</span>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{effectiveInfo.access_mode === 'supabase_private' ? 'Private URL' : 'Public URL'}</span>
                  {hidden && <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Hidden</span>}
                  {passwordProtected && <span className="rounded bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">Password</span>}
                  {isAdmin && <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Administrator</span>}
                </div>
                {effectiveInfo.description && <p className="text-sm text-gray-700">{effectiveInfo.description}</p>}
                <div className="grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
                  <div>Created: {effectiveInfo.created_at ? new Date(effectiveInfo.created_at).toLocaleString() : 'Unknown'}</div>
                  <div>Updated: {effectiveInfo.updated_at ? new Date(effectiveInfo.updated_at).toLocaleString() : 'Unknown'}</div>
                </div>
              
              {/* Tab Navigation */}
              <div className="flex border-b border-gray-200 -mx-5 px-5">
                {(['download','checksum','cite'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={"relative px-4 py-2 text-xs font-medium transition-colors " + (activeTab === tab ? "text-slate-900 after:absolute after:inset-x-2 after:-bottom-px after:h-[3px] after:rounded-t after:bg-slate-900" : "text-slate-400 hover:text-slate-700")}>
                    {tab === 'download' ? 'Download' : tab === 'checksum' ? 'Checksum' : 'Cite'}
                  </button>
                ))}
              </div></div>

              {hidden && !isAdmin && (
                <p className="text-sm text-gray-500">This file is not publicly available.</p>
              )}

              {passwordProtected && !unlocked && !isAdmin && (
                <div className="space-y-2 rounded border border-rose-200 bg-rose-50 p-3">
                  <label className="block text-sm font-medium text-gray-700">Password required</label>
                  <input type="password" value={pwInput} onChange={(event) => setPwInput(event.target.value)} className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]" placeholder="Enter password" />
                  {pwError && <p className="text-xs text-red-600">{pwError}</p>}
                  <button type="button" onClick={verifyPassword} className="rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-dark)]">Unlock</button>
                </div>
              )}

              {/* Download Tab */}
                            {activeTab === "download" && (linksVisible || isAdmin) && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Download options for {effectiveInfo.display_name || effectiveInfo.file_name}</h4>
                    <p className="mt-1 text-xs text-gray-500">Copy the complete command block for your operating system and network route.</p>
                  </div>
                  {effectiveInfo.access_mode === 'supabase_private' ? (
                    <p className="text-xs text-amber-700">{effectiveInfo.access_note}</p>
                  ) : directUrlInvalid ? (
                    <p className="text-xs text-amber-700">{effectiveInfo.invalid_reason || NOT_DIRECT_FILE_URL_MESSAGE}</p>
                  ) : publicRouteAvailable ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                          <div className="text-xs font-medium text-gray-700">Network Routing</div>
                          <div className="mt-2 inline-flex rounded-lg border border-slate-200 bg-gray-50 p-1">
                            <button
                              type="button"
                              onClick={() => setDownloadRegion('global')}
                              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${downloadRegion === 'global' ? 'bg-[var(--color-accent)] text-white shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]'}`}
                            >
                              Global (Official)
                            </button>
                            <button
                              type="button"
                              onClick={() => setDownloadRegion('apac')}
                              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${downloadRegion === 'apac' ? 'bg-[var(--color-accent)] text-white shadow-sm' : 'text-[var(--color-accent)] hover:bg-[var(--color-surface-muted)]'}`}
                            >
                              Asia-Pacific (Mirror)
                            </button>
                          </div>
                        </div>
                        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                          <div className="text-xs font-medium text-gray-700">Operating System</div>
                          <div className="mt-2 inline-flex rounded-lg border border-slate-200 bg-gray-50 p-1">
                            <button
                              type="button"
                              onClick={() => setCliOs('linux')}
                              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${cliOs === 'linux' ? 'bg-[var(--color-accent)] text-white shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]'}`}
                            >
                              Linux / macOS
                            </button>
                            <button
                              type="button"
                              onClick={() => setCliOs('windows')}
                              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${cliOs === 'windows' ? 'bg-[var(--color-accent)] text-white shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]'}`}
                            >
                              Windows (PowerShell)
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {cliOs === 'linux' && hfLinuxCommand && (
                          <CliSection
                            title="Hugging Face CLI (Recommended)"
                            badge="Recommended"
                            description="Supports resume and multi-thread acceleration; suitable for large files and stable transfers."
                            code={hfLinuxCommand}
                            expanded={expandedCliSection === 'hf'}
                            onToggle={() => setExpandedCliSection(current => current === 'hf' ? null : 'hf')}
                            copyKey="hf-linux"
                            copied={copied}
                            onCopy={handleCopy}
                          />
                        )}
                        {cliOs === 'windows' && hfWindowsCommand && (
                          <CliSection
                            title="Hugging Face CLI (Recommended)"
                            badge="Recommended"
                            description="Supports resume and multi-thread acceleration; suitable for large files and stable transfers."
                            code={hfWindowsCommand}
                            expanded={expandedCliSection === 'hf'}
                            onToggle={() => setExpandedCliSection(current => current === 'hf' ? null : 'hf')}
                            copyKey="hf-windows"
                            copied={copied}
                            onCopy={handleCopy}
                          />
                        )}
                        {cliOs === 'linux' && basicLinuxCommand && (
                          <CliSection
                            title="Basic Tools (wget / curl)"
                            description="Lightweight single-file download without installing extra libraries."
                            code={basicLinuxCommand}
                            expanded={expandedCliSection === 'basic'}
                            onToggle={() => setExpandedCliSection(current => current === 'basic' ? null : 'basic')}
                            copyKey="basic-linux"
                            copied={copied}
                            onCopy={handleCopy}
                          />
                        )}
                        {cliOs === 'windows' && basicWindowsCommand && (
                          <CliSection
                            title="Basic Tools (curl.exe)"
                            description="Lightweight single-file download using the curl.exe bundled with Windows 10+."
                            code={basicWindowsCommand}
                            expanded={expandedCliSection === 'basic'}
                            onToggle={() => setExpandedCliSection(current => current === 'basic' ? null : 'basic')}
                            copyKey="basic-windows"
                            copied={copied}
                            onCopy={handleCopy}
                          />
                        )}
                        {cliOs === 'linux' && hfdLinuxCommand && (
                          <CliSection
                            title="Advanced Tool: hfd accelerator"
                            description="Third-party accelerator built on the aria2 engine; useful for highly unstable networks."
                            code={hfdLinuxCommand}
                            expanded={expandedCliSection === 'hfd'}
                            onToggle={() => setExpandedCliSection(current => current === 'hfd' ? null : 'hfd')}
                            copyKey="hfd-linux"
                            copied={copied}
                            onCopy={handleCopy}
                          />
                        )}
                        {cliOs === 'windows' && hfdWindowsCommand && (
                          <CliSection
                            title="Advanced Tool: hfd accelerator"
                            description="Third-party accelerator built on the aria2 engine; useful for highly unstable networks."
                            code={hfdWindowsCommand}
                            expanded={expandedCliSection === 'hfd'}
                            onToggle={() => setExpandedCliSection(current => current === 'hfd' ? null : 'hfd')}
                            copyKey="hfd-windows"
                            copied={copied}
                            onCopy={handleCopy}
                          />
                        )}
                        {activePublicUrl && (
                          <CliSection
                            title={downloadRegion === 'apac' ? 'Mirror Direct URL' : 'Official Direct URL'}
                            description="For Free Download Manager (FDM), IDM, and similar graphical download tools."
                            code={activePublicUrl}
                            expanded={expandedCliSection === 'url'}
                            onToggle={() => setExpandedCliSection(current => current === 'url' ? null : 'url')}
                            copyKey="direct-url"
                            copied={copied}
                            onCopy={handleCopy}
                          />
                        )}
                        {activeRegionHint && <p className="text-xs text-gray-500">{activeRegionHint}</p>}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500">CLI download is not available for this file.</p>
                  )}
                </div>
              )}
                            {/* Checksum Tab */}
              {activeTab === "checksum" && (linksVisible || isAdmin) && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-gray-800">File Integrity Verification</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs font-medium text-gray-600">SHA-256:</span>
                      <code className="code-panel ml-2 block max-w-full break-all rounded-lg px-2 py-1 font-mono text-xs text-slate-800">{hfMeta.loading ? "Loading..." : (effectiveInfo.sha256_checksum || "Not available yet")}</code>
                    </div>
                  </div>
                  <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-gray-700">Linux Terminal Quick Verify</span>
                      <button type="button" onClick={() => handleCopy('checksum-verify', linuxVerifyCommand)} disabled={!linuxVerifyCommand} className="text-xs text-teal-600 hover:underline disabled:opacity-50">
                        {copied === 'checksum-verify' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="code-panel overflow-auto whitespace-pre-wrap break-all rounded-lg px-3 py-2 font-mono text-xs text-gray-800">{linuxVerifyCommand || '# SHA-256 checksum is not available yet.'}</pre>
                  </div>
                  <p className="text-xs text-gray-400">Download the file to a Linux server, then copy and run the command above. If the output shows OK, the file is 100% complete.</p>
                </div>
              )}

              {/* Citation Tab */}
              {activeTab === "cite" && (linksVisible || isAdmin) && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-gray-800">Cite this Dataset</h4>
                  <RevealRow rowKey="cite-bibtex" label="BibTeX" value={`@dataset{${effectiveInfo.file_name.replace(/[^a-zA-Z0-9]/g,'_')},\n  author = {GalibierHub},\n  title = {${effectiveInfo.file_name}},\n  year = {${new Date().getFullYear()}},\n  publisher = {GalibierHub},\n  url = {${url}}\n}`} copied={copied} onCopy={handleCopy} />
                  <RevealRow rowKey="cite-apa" label="APA" value={`GalibierHub. (${new Date().getFullYear()}). ${effectiveInfo.file_name} [Data set]. ${url}`} copied={copied} onCopy={handleCopy} />
                  <RevealRow rowKey="cite-plain" label="Plain Text" value={`${effectiveInfo.file_name} - GalibierHub (${new Date().getFullYear()}). Available at: ${url}`} copied={copied} onCopy={handleCopy} />
                  <RevealRow rowKey="cite-ris" label="RIS" value={`TY  - DATA\nTI  - ${effectiveInfo.file_name}\nAU  - GalibierHub\nPY  - ${new Date().getFullYear()}\nPB  - GalibierHub\nUR  - ${url}\nER  - `} copied={copied} onCopy={handleCopy} />
                  <RevealRow rowKey="cite-datacite" label="DataCite" value={`<?xml version="1.0" encoding="UTF-8"?>\n<resource xmlns="http://datacite.org/schema/kernel-4">\n  <identifier identifierType="URL">${url}</identifier>\n  <titles><title>${effectiveInfo.file_name}</title></titles>\n  <publisher>GalibierHub</publisher>\n  <publicationYear>${new Date().getFullYear()}</publicationYear>\n</resource>`} copied={copied} onCopy={handleCopy} />
                </div>
              )}
{isAdmin && (
                <div className="space-y-3 rounded border border-amber-200 bg-amber-50/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-amber-800">Administrator controls</span>
                    {!editing ? (
                      <button type="button" onClick={startEdit} className="text-xs text-teal-600 hover:underline">Edit metadata</button>
                    ) : (
                      <div className="flex gap-2">
                        <button type="button" onClick={saveEdit} className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700">Save</button>
                        <button type="button" onClick={() => setEditing(false)} className="rounded border border-slate-200 bg-teal-50 px-3 py-1 text-xs text-teal-700 hover:bg-teal-100">Cancel</button>
                      </div>
                    )}
                  </div>
                  {saveState && <p className={`text-xs ${saveState.ok ? 'text-emerald-700' : 'text-red-600'}`}>{saveState.text}</p>}
                  {editing && draft && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block text-xs text-gray-700">Label<input value={draft.custom_label} onChange={(event) => setDraft({ ...draft, custom_label: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" /></label>
                      <label className="block text-xs text-gray-700">File type<input value={draft.custom_file_type} onChange={(event) => setDraft({ ...draft, custom_file_type: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" /></label>
                      <label className="block text-xs text-gray-700">Size (bytes)<input value={draft.custom_size_bytes} onChange={(event) => setDraft({ ...draft, custom_size_bytes: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" placeholder="Leave blank to auto-detect" /></label>
                      <label className="block text-xs text-gray-700">Signed URL TTL (seconds)<input value={draft.signed_url_ttl_seconds} onChange={(event) => setDraft({ ...draft, signed_url_ttl_seconds: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" /></label>
                      <label className="block text-xs text-gray-700 sm:col-span-2">Description<textarea value={draft.custom_description} onChange={(event) => setDraft({ ...draft, custom_description: event.target.value })} rows={2} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" /></label>
                      <label className="block text-xs text-gray-700">Storage provider<select value={draft.storage_provider} onChange={(event) => setDraft({ ...draft, storage_provider: event.target.value as DownloadStorageProvider })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"><option value="public_url">Public URL</option><option value="supabase_private">Supabase private</option></select></label>
                      <label className="block text-xs text-gray-700">Storage bucket<input value={draft.storage_bucket} onChange={(event) => setDraft({ ...draft, storage_bucket: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" placeholder="private-files" /></label>
                      <label className="block text-xs text-gray-700 sm:col-span-2">Storage path<input value={draft.storage_path} onChange={(event) => setDraft({ ...draft, storage_path: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" placeholder="datasets/example/file.zip" /></label>
                      <label className="block text-xs text-gray-700">SHA-256 checksum<input value={draft.sha256_checksum} onChange={(event) => setDraft({ ...draft, sha256_checksum: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" /></label>
                      <label className="flex items-center gap-2 text-xs text-gray-700 sm:col-span-2"><input type="checkbox" checked={draft.hidden} onChange={(event) => setDraft({ ...draft, hidden: event.target.checked })} /> Hide this file from public view</label>
                      <label className="block text-xs text-gray-700 sm:col-span-2">Set or change password (leave blank to keep)<input type="text" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" placeholder="Set a new password (min 4 chars)" /></label>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-gray-400">Download counts mainly reflect in-site downloads. Direct URL and CLI transfers may be undercounted.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
