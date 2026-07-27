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

interface DownloadActionsProps {
  url: string;
  label: string;
  sizeLabel?: string | null;
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

async function readFileMeta(url: string): Promise<{ size: number | null; sha256: string | null }> {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const datasetsIndex = parts.indexOf('datasets');
    const resolveIndex = parts.indexOf('resolve');
    if (datasetsIndex === -1 || resolveIndex === -1 || resolveIndex <= datasetsIndex + 2) {
      return { size: null, sha256: null };
    }
    const repo = `${parts[datasetsIndex + 1]}/${parts[datasetsIndex + 2]}`;
    const dirPath = parts.slice(resolveIndex + 2, -1).join('/');
    const fileName = parts[parts.length - 1];
    const api = `https://huggingface.co/api/datasets/${repo}/tree/main${dirPath ? `/${dirPath}` : ''}?recursive=false`;
    const res = await fetch(api);
    if (!res.ok) return { size: null, sha256: null };
    const data = (await res.json()) as Array<{ path: string; size?: number; lfs?: { oid?: string } }>;
    const hit = data.find((item) => item.path.split('/').pop() === fileName);
    return { size: hit?.size ?? null, sha256: hit?.lfs?.oid ?? null };
  } catch {
    return { size: null, sha256: null };
  }
}

async function readDbMeta(key: string): Promise<DownloadMetadataPayload> {
  try {
    const res = await fetch(`/api/download-metadata?key=${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error('failed');
    const data = (await res.json()) as Partial<DownloadMetadataPayload>;
    return { ...DEFAULT_DOWNLOAD_METADATA, ...data };
  } catch {
    return DEFAULT_DOWNLOAD_METADATA;
  }
}

export default function DownloadActions({
  url,
  label,
  sizeLabel,
  description,
  showCli = false,
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
  const [unlocked, setUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saveState, setSaveState] = useState<{ ok: boolean; text: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadRegion, setDownloadRegion] = useState<'global' | 'apac'>('global');

  const key = normalizeDownloadKey(url);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setHfMeta({ size: null, sha256: null, loading: true });
    setDbMeta(DEFAULT_DOWNLOAD_METADATA);
    setResolvedInfo(null);
    setUnlocked(false);
    setPwError(null);
    setEditing(false);
    setDraft(null);
    setSaveState(null);
    setDownloadRegion('global');
    if (url.includes('huggingface.co')) {
      readFileMeta(url).then((meta) => {
        if (active) setHfMeta({ ...meta, loading: false });
      });
    } else {
      setHfMeta({ size: null, sha256: null, loading: false });
    }
    readDbMeta(key).then((meta) => {
      if (!active) return;
      setDbMeta(meta);
      setResolvedInfo(buildDownloadResolvedInfo(key, meta, label, description));
    });
    return () => {
      active = false;
    };
  }, [open, key, url, label, description]);

  useEffect(() => {
    setDbMeta((current) => (current.hidden === initialHidden ? current : { ...current, hidden: initialHidden ?? false }));
  }, [initialHidden]);

  const effectiveInfo = useMemo(() => {
    const base = resolvedInfo || buildDownloadResolvedInfo(key, dbMeta, label, description);
    return {
      ...base,
      size_bytes: dbMeta.custom_size_bytes ?? hfMeta.size ?? base.size_bytes,
      sha256_checksum: dbMeta.sha256_checksum ?? hfMeta.sha256 ?? base.sha256_checksum,
    };
  }, [resolvedInfo, key, dbMeta, label, description, hfMeta.size, hfMeta.sha256]);

  const displaySize = hfMeta.loading ? 'Loading...' : formatDownloadBytes(effectiveInfo.size_bytes) || sizeLabel || '';
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
  const cliOptionsVisible = publicRouteAvailable && (showCli || effectiveInfo.cli_supported);

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
      const res = await fetch('/api/download-metadata/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ download_key: key, password: pwInput || undefined, label, description }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        setPwError(data?.error || 'Failed to prepare download URL.');
        return;
      }
      await recordDownload();
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch {
      setPwError('Failed to prepare download URL.');
    } finally {
      setDownloading(false);
    }
  }, [key, pwInput, label, description, recordDownload]);

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
      const nextMeta = await readDbMeta(key);
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
      const nextMeta = await readDbMeta(key);
      setDbMeta(nextMeta);
      setResolvedInfo(buildDownloadResolvedInfo(key, nextMeta, label, description));
      onMetadataSaved?.(nextMeta);
      setSaveState({ ok: true, text: nextMeta.hidden ? 'Hidden.' : 'Visible.' });
    } catch (error) {
      setSaveState({ ok: false, text: error instanceof Error ? error.message : 'Update failed.' });
    }
  }, [isAdmin, accessToken, hidden, key, label, description, onMetadataSaved]);

  if (!url) return null;

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      {(!open && !hidden) && (description || sizeLabel) && (
        <div className="space-y-1">
          {description && <p className="text-sm text-gray-600">{description}</p>}
          {sizeLabel && (
            <div><span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{sizeLabel}</span></div>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {hidden && !isAdmin ? (
          <span className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-400">Hidden by Administrator</span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void handleBrowserDownload()}
              disabled={downloading || (hidden && !isAdmin)}
              className={`inline-flex items-center justify-center rounded-lg bg-blue-600 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 ${compact ? 'min-w-[7.25rem] px-3 py-2' : 'min-w-[9rem] px-4 py-2'}`}
            >
              {downloading ? 'Preparing...' : label}
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={`inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 ${compact ? 'min-w-[2.75rem] px-3 py-2' : 'min-w-[7rem] px-4 py-2'}`}
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
            className="inline-flex min-w-[8rem] items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
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
          <div className="my-8 w-full max-w-3xl rounded-lg border border-gray-200 bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-3">
              <h3 className="text-base font-semibold text-gray-900">{effectiveInfo.display_name}</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-5 px-5 py-4">
              <div className="space-y-3 rounded border border-gray-100 bg-gray-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 break-all">{effectiveInfo.file_name}</span>
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{effectiveInfo.file_type}</span>
                  {displaySize && <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">{displaySize}</span>}
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{dbMeta.download_count} downloads</span>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{effectiveInfo.access_mode === 'supabase_private' ? 'Private URL' : 'Public URL'}</span>
                  {hidden && <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Hidden</span>}
                  {passwordProtected && <span className="rounded bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">Password</span>}
                  {isAdmin && <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Administrator</span>}
                </div>
                {effectiveInfo.description && <p className="text-sm text-gray-700">{effectiveInfo.description}</p>}
                <div className="grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
                  <div>Created: {effectiveInfo.created_at ? new Date(effectiveInfo.created_at).toLocaleString() : 'N/A'}</div>
                  <div>Updated: {effectiveInfo.updated_at ? new Date(effectiveInfo.updated_at).toLocaleString() : 'N/A'}</div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">SHA-256:</span>
                    <code className="block max-w-full truncate font-mono text-xs text-gray-700">{effectiveInfo.sha256_checksum || 'Unavailable'}</code>
                    {effectiveInfo.sha256_checksum && <button type="button" onClick={() => handleCopy('sha256', effectiveInfo.sha256_checksum)} className="text-xs text-blue-600 hover:underline">{copied === 'sha256' ? 'Copied' : 'Copy SHA-256'}</button>}
                  </div>
                </div>
              </div>

              {hidden && !isAdmin && (
                <p className="text-sm text-gray-500">This file is not publicly available.</p>
              )}

              {passwordProtected && !unlocked && !isAdmin && (
                <div className="space-y-2 rounded border border-rose-200 bg-rose-50 p-3">
                  <label className="block text-sm font-medium text-gray-700">Password required</label>
                  <input type="password" value={pwInput} onChange={(event) => setPwInput(event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" placeholder="Enter password" />
                  {pwError && <p className="text-xs text-red-600">{pwError}</p>}
                  <button type="button" onClick={verifyPassword} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Unlock</button>
                </div>
              )}

              {(linksVisible || isAdmin) && (
                <>
                  <button type="button" onClick={handleBrowserDownload} disabled={downloading || directUrlInvalid} className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50">{downloading ? 'Preparing...' : 'Download'}</button>

                  {directUrlInvalid && (
                    <p className="text-xs text-amber-700">{effectiveInfo.invalid_reason || NOT_DIRECT_FILE_URL_MESSAGE}</p>
                  )}

                  <div className="rounded border border-gray-100 bg-gray-50 p-3 space-y-3">
                    <div className="text-sm font-medium text-gray-800">Download options</div>
                    <div className="text-xs text-gray-600">Browser download is always available. Public direct URLs also support resumable CLI transfers and download managers.</div>
                    {effectiveInfo.access_mode === 'supabase_private' ? (
                      <p className="text-xs text-amber-700">{effectiveInfo.access_note}</p>
                    ) : directUrlInvalid ? (
                      <p className="text-xs text-amber-700">{effectiveInfo.invalid_reason || NOT_DIRECT_FILE_URL_MESSAGE}</p>
                    ) : publicRouteAvailable ? (
                      <div className="space-y-3">
                        {(effectiveInfo.public_url || effectiveInfo.mirror_public_url) && (
                          <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-blue-900">Regional download routing</div>
                                <div className="text-xs text-blue-800">
                                  Pick the endpoint that matches the downloader network location.
                                </div>
                              </div>
                              <div className="inline-flex rounded-lg border border-blue-200 bg-white p-1">
                                <button
                                  type="button"
                                  onClick={() => setDownloadRegion('global')}
                                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${downloadRegion === 'global' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-50'}`}
                                >
                                  Global (Official)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDownloadRegion('apac')}
                                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${downloadRegion === 'apac' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:bg-emerald-50'}`}
                                >
                                  Asia-Pacific (Mirror)
                                </button>
                              </div>
                            </div>
                            <div className={`rounded-md border px-3 py-3 ${downloadRegion === 'apac' ? 'border-emerald-200 bg-emerald-100' : 'border-blue-200 bg-white'}`}>
                              <div className="flex items-center justify-between gap-3">
                                <span className={`text-sm font-medium ${downloadRegion === 'apac' ? 'text-emerald-900' : 'text-blue-900'}`}>
                                  {downloadRegion === 'apac' ? 'Mirror direct URL for Free Download Manager and similar tools' : 'Official direct URL for Free Download Manager and similar tools'}
                                </span>
                                <button type="button" onClick={() => handleCopy('public-url', activePublicUrl)} className={`text-xs hover:underline ${downloadRegion === 'apac' ? 'text-emerald-700' : 'text-blue-700'}`}>{copied === 'public-url' ? 'Copied' : 'Copy direct URL'}</button>
                              </div>
                              <p className={`mt-2 text-xs leading-5 ${downloadRegion === 'apac' ? 'text-emerald-800' : 'text-blue-800'}`}>
                                {downloadRegion === 'apac'
                                  ? 'Optimized routing via community mirrors for faster and more reliable downloads in China and the Asia-Pacific region. Paste this link into Free Download Manager, Motrix, IDM, or another resumable download client.'
                                  : 'Direct downloads from official servers. Paste this public direct link into Free Download Manager, Motrix, IDM, or another resumable download client.'}
                              </p>
                              <code className={`mt-2 block break-all rounded px-3 py-2 font-mono text-[11px] ring-1 ${downloadRegion === 'apac' ? 'bg-emerald-100 text-emerald-950 ring-emerald-200' : 'bg-blue-50 text-blue-950 ring-blue-100'}`}>{activePublicUrl}</code>
                            </div>
                          </div>
                        )}
                        {cliOptionsVisible && activeWgetCommand && (
                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700">Linux/macOS: wget (resume)</span>
                              <button type="button" onClick={() => handleCopy('wget', activeWgetCommand)} className={`text-xs hover:underline ${downloadRegion === 'apac' ? 'text-emerald-600' : 'text-blue-600'}`}>{copied === 'wget' ? 'Copied' : 'Copy'}</button>
                            </div>
                            <code className={`block rounded px-3 py-2 font-mono text-xs ring-1 ${downloadRegion === 'apac' ? 'bg-emerald-50 text-emerald-950 ring-emerald-100' : 'bg-blue-50 text-blue-950 ring-blue-100'}`}>{activeWgetCommand}</code>
                          </div>
                        )}
                        {cliOptionsVisible && activeCurlCommand && (
                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700">Windows/Linux/macOS: curl (resume)</span>
                              <button type="button" onClick={() => handleCopy('curl', activeCurlCommand)} className={`text-xs hover:underline ${downloadRegion === 'apac' ? 'text-emerald-600' : 'text-blue-600'}`}>{copied === 'curl' ? 'Copied' : 'Copy'}</button>
                            </div>
                            <code className={`block rounded px-3 py-2 font-mono text-xs ring-1 ${downloadRegion === 'apac' ? 'bg-emerald-50 text-emerald-950 ring-emerald-100' : 'bg-blue-50 text-blue-950 ring-blue-100'}`}>{activeCurlCommand}</code>
                          </div>
                        )}
                        {cliOptionsVisible && activeHfCliCommand && (
                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700">{downloadRegion === 'apac' ? 'CLI (mirror endpoint)' : 'CLI (recommended)'}</span>
                              <button type="button" onClick={() => handleCopy('hf', activeHfCliCommand)} className={`text-xs hover:underline ${downloadRegion === 'apac' ? 'text-emerald-600' : 'text-blue-600'}`}>{copied === 'hf' ? 'Copied' : 'Copy'}</button>
                            </div>
                            <code className={`block rounded px-3 py-2 font-mono text-xs ring-1 ${downloadRegion === 'apac' ? 'bg-emerald-50 text-emerald-950 ring-emerald-100' : 'bg-blue-50 text-blue-950 ring-blue-100'}`}>{activeHfCliCommand}</code>
                          </div>
                        )}
                        {activeRegionHint && <p className="text-xs text-gray-500">{activeRegionHint}</p>}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">CLI download is not available for this file.</p>
                    )}
                  </div>
                </>
              )}

              {isAdmin && (
                <div className="space-y-3 rounded border border-amber-200 bg-amber-50/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-amber-800">Administrator controls</span>
                    {!editing ? (
                      <button type="button" onClick={startEdit} className="text-xs text-blue-600 hover:underline">Edit metadata</button>
                    ) : (
                      <div className="flex gap-2">
                        <button type="button" onClick={saveEdit} className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700">Save</button>
                        <button type="button" onClick={() => setEditing(false)} className="rounded border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100">Cancel</button>
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
