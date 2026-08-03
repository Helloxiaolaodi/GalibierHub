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
    <div className="rounded-md border border-slate-200 bg-white">
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
        <div className="border-t border-slate-100 px-3 py-3">
          {loading ? (
            <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded border border-gray-200 text-gray-500">Loading...</span>
          ) : unavailable ? (
            <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded border border-gray-200 text-gray-400">{unavailable}</span>
          ) : value ? (
            <div className="flex items-start gap-3">
              <code className="min-w-0 flex-1 break-all rounded px-3 py-2 font-mono text-[11px] ring-1 bg-gray-50 text-gray-900 ring-gray-200">{value}</code>
              <button
                type="button"
                onClick={() => onCopy(rowKey, value)}
                className="flex-shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
              >
                {copied === rowKey ? 'Copied' : 'Copy'}
              </button>
            </div>
          ) : null}
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
    const [activeTab, setActiveTab] = useState<'download'|'preview'|'checksum'|'cite'|'script'>('download');
  const [filePreview, setFilePreview] = useState<{loading:boolean;content:string|null;error:string|null}>({loading:false,content:null,error:null});
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
    readDbMeta(key, url).then((meta) => {
      if (!active) return;
      setDbMeta(meta);
      setResolvedInfo(buildDownloadResolvedInfo(key, meta, label, description));
    });
    return () => {
      active = false;
    };
  }, [open, key, url, label, description, initialSizeBytes]);

  useEffect(() => {
    setDbMeta((current) => (current.hidden === initialHidden ? current : { ...current, hidden: initialHidden ?? false }));
  }, [initialHidden]);

  const effectiveInfo = useMemo(() => {
    const base = resolvedInfo || buildDownloadResolvedInfo(key, dbMeta, label, description);
    return {
      ...base,
      size_bytes: dbMeta.custom_size_bytes ?? hfMeta.size ?? base.size_bytes ?? initialSizeBytes ?? null,
      sha256_checksum: dbMeta.sha256_checksum ?? hfMeta.sha256 ?? base.sha256_checksum,
    };
  }, [resolvedInfo, key, dbMeta, label, description, initialSizeBytes, hfMeta.size, hfMeta.sha256]);

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
          <span className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-400">Hidden by Administrator</span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void handleBrowserDownload()}
              disabled={downloading || (hidden && !isAdmin)}
              className={`inline-flex items-center justify-center rounded-lg bg-slate-800 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:opacity-50 ${compact ? 'min-w-[7.25rem] px-3 py-2' : 'min-w-[9rem] px-4 py-2'}`}
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
                {(['download','preview','checksum','cite','script'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={"px-4 py-2 text-xs font-medium border-b-2 transition-colors " + (activeTab === tab ? "border-teal-600 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300")}>
                    {tab === 'download' ? 'Download' : tab === 'preview' ? 'File Preview' : tab === 'checksum' ? 'Checksum' : tab === 'cite' ? 'Cite' : 'Batch Script'}
                  </button>
                ))}
              </div></div>

              {hidden && !isAdmin && (
                <p className="text-sm text-gray-500">This file is not publicly available.</p>
              )}

              {passwordProtected && !unlocked && !isAdmin && (
                <div className="space-y-2 rounded border border-rose-200 bg-rose-50 p-3">
                  <label className="block text-sm font-medium text-gray-700">Password required</label>
                  <input type="password" value={pwInput} onChange={(event) => setPwInput(event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" placeholder="Enter password" />
                  {pwError && <p className="text-xs text-red-600">{pwError}</p>}
                  <button type="button" onClick={verifyPassword} className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900">Unlock</button>
                </div>
              )}

              {/* File Preview Tab */}
              {activeTab === "download" && (linksVisible || isAdmin) && (
                <div className="space-y-4">
                  {directUrlInvalid && (
                    <p className="text-xs text-amber-700">{effectiveInfo.invalid_reason || NOT_DIRECT_FILE_URL_MESSAGE}</p>
                  )}
                  <div className="rounded border border-gray-100 bg-gray-50 p-3 space-y-3">
                    <div className="text-sm font-medium text-gray-800">Download options</div>
                    {effectiveInfo.access_mode === 'supabase_private' ? (
                      <p className="text-xs text-amber-700">{effectiveInfo.access_note}</p>
                    ) : directUrlInvalid ? (
                      <p className="text-xs text-amber-700">{effectiveInfo.invalid_reason || NOT_DIRECT_FILE_URL_MESSAGE}</p>
                    ) : publicRouteAvailable ? (
                      <div className="space-y-3">
                        {(effectiveInfo.public_url || effectiveInfo.mirror_public_url) && (
                          <div className="space-y-3 rounded-md border border-slate-200 bg-white px-3 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-slate-800">Regional download routing</div>
                                <div className="text-xs text-slate-800">
                                  Automatically selected from your timezone; override it for this transfer if needed.
                                </div>
                              </div>
                              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                                <button
                                  type="button"
                                  onClick={() => setDownloadRegion('global')}
                                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${downloadRegion === 'global' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'}`}
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
                            <RevealRow
                              rowKey="public-url"
                              label={downloadRegion === 'apac' ? 'Mirror direct URL for Free Download Manager and similar tools' : 'Official direct URL for Free Download Manager and similar tools'}
                              value={activePublicUrl}
                              copied={copied}
                              onCopy={handleCopy}
                            />
                          </div>
                        )}
                        {cliOptionsVisible && activeWgetCommand && (
                          <RevealRow
                            rowKey="wget"
                            label="Linux/macOS: wget (resume)"
                            value={activeWgetCommand}
                            copied={copied}
                            onCopy={handleCopy}
                          />
                        )}
                        {cliOptionsVisible && activeCurlCommand && (
                          <RevealRow
                            rowKey="curl"
                            label="Windows/Linux/macOS: curl (resume)"
                            value={activeCurlCommand}
                            copied={copied}
                            onCopy={handleCopy}
                          />
                        )}
                        {cliOptionsVisible && activeHfCliCommand && (
                          <RevealRow
                            rowKey="hf"
                            label={downloadRegion === 'apac' ? 'CLI (mirror endpoint)' : 'CLI (recommended)'}
                            value={activeHfCliCommand}
                            copied={copied}
                            onCopy={handleCopy}
                          />
                        )}
                        {activeRegionHint && <p className="text-xs text-gray-500">{activeRegionHint}</p>}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">CLI download is not available for this file.</p>
                    )}
                    <div className="border-t border-gray-200 pt-3">
                      <button
                        type="button"
                        onClick={() => void handleBrowserDownload()}
                        disabled={downloading}
                        className="inline-flex items-center justify-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-slate-700 active:bg-slate-900 active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        {downloading ? 'Preparing...' : 'Download to browser'}
                      </button>
                      <p className="mt-2 text-xs text-gray-500">Uses the selected region and keeps the original file name.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "preview" && (linksVisible || isAdmin) && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">Preview the first ~2KB of this file (text-based formats only).</p>
                  <button type="button" onClick={async () => {
                    setFilePreview({loading:true,content:null,error:null});
                    try {
                      const resp = await fetch(effectiveInfo.public_url || effectiveInfo.mirror_public_url || url, { headers: { Range: "bytes=0-2047" } });
                      if (!resp.ok) throw new Error("Preview not available");
                      const text = await resp.text();
                      setFilePreview({loading:false,content:text.slice(0,2048),error:null});
                    } catch (e) {
                      setFilePreview({loading:false,content:null,error: e instanceof Error ? e.message : "Preview failed"});
                    }
                  }} disabled={filePreview.loading} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50">
                    {filePreview.loading ? "Loading..." : "Fetch Preview"}
                  </button>
                  {filePreview.error && <p className="text-xs text-red-600">{filePreview.error}</p>}
                  {filePreview.content && (
                    <pre className="max-h-64 overflow-auto rounded-lg border border-gray-200 bg-slate-50 p-3 text-xs font-mono text-gray-700 whitespace-pre-wrap">{filePreview.content}</pre>
                  )}
                  <p className="text-xs text-gray-400">Transfers only the first 2KB via HTTP Range request. Large binary files (.bam, .h5ad, .zip) will not preview correctly.</p>
                </div>
              )}

              {/* Checksum Tab */}
              {activeTab === "checksum" && (linksVisible || isAdmin) && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-gray-800">File Integrity Verification</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs font-medium text-gray-600">SHA-256:</span>
                      <code className="ml-2 block max-w-full break-all rounded px-2 py-1 font-mono text-xs bg-slate-50 text-slate-800 ring-1 ring-slate-200">{hfMeta.loading ? "Loading..." : (effectiveInfo.sha256_checksum || "Not available yet")}</code>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-600">MD5:</span>
                      <code className="ml-2 block max-w-full break-all rounded px-2 py-1 font-mono text-xs bg-slate-50 text-slate-800 ring-1 ring-slate-200">{dbMeta.md5_checksum || "Not available yet"}</code>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">Use the verification commands in the Download tab to confirm file integrity after transfer.</p>
                </div>
              )}

              {/* Citation Tab */}
              {activeTab === "cite" && (linksVisible || isAdmin) && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-gray-800">Cite this Dataset</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600">BibTeX</span>
                        <button type="button" onClick={() => handleCopy('cite-bibtex', `@dataset{${effectiveInfo.file_name.replace(/[^a-zA-Z0-9]/g,'_')},\n  author = {GalibierHub},\n  title = {${effectiveInfo.file_name}},\n  year = {${new Date().getFullYear()}},\n  publisher = {GalibierHub},\n  url = {${url}}\n}`)} className="text-xs text-teal-600 hover:underline">{copied === 'cite-bibtex' ? 'Copied' : 'Copy'}</button>
                      </div>
                      <pre className="rounded bg-slate-50 p-2 text-xs font-mono text-gray-700 ring-1 ring-slate-200 whitespace-pre-wrap">@dataset{"{"}{effectiveInfo.file_name.replace(/[^a-zA-Z0-9]/g,"_")},{"\n"}  author = {"{"}GalibierHub{"}"},{"\n"}  title = {"{"}{effectiveInfo.file_name}{"}"},{"\n"}  year = {"{"}{new Date().getFullYear()}{"}"},{"\n"}  publisher = {"{"}GalibierHub{"}"},{"\n"}  url = {"{"}{url}{"}"},{"\n"}{"}"}</pre>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600">APA</span>
                        <button type="button" onClick={() => handleCopy('cite-apa', `GalibierHub. (${new Date().getFullYear()}). ${effectiveInfo.file_name} [Data set]. ${url}`)} className="text-xs text-teal-600 hover:underline">{copied === 'cite-apa' ? 'Copied' : 'Copy'}</button>
                      </div>
                      <pre className="rounded bg-slate-50 p-2 text-xs font-mono text-gray-700 ring-1 ring-slate-200 whitespace-pre-wrap">GalibierHub. ({new Date().getFullYear()}). {effectiveInfo.file_name} [Data set]. {url}</pre>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600">Plain Text</span>
                        <button type="button" onClick={() => handleCopy('cite-plain', `${effectiveInfo.file_name} - GalibierHub (${new Date().getFullYear()}). Available at: ${url}`)} className="text-xs text-teal-600 hover:underline">{copied === 'cite-plain' ? 'Copied' : 'Copy'}</button>
                      </div>
                      <pre className="rounded bg-slate-50 p-2 text-xs font-mono text-gray-700 ring-1 ring-slate-200 whitespace-pre-wrap">{effectiveInfo.file_name} - GalibierHub ({new Date().getFullYear()}). Available at: {url}</pre>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600">RIS</span>
                        <button type="button" onClick={() => handleCopy('cite-ris', `TY  - DATA\nTI  - ${effectiveInfo.file_name}\nAU  - GalibierHub\nPY  - ${new Date().getFullYear()}\nPB  - GalibierHub\nUR  - ${url}\nER  - `)} className="text-xs text-teal-600 hover:underline">{copied === 'cite-ris' ? 'Copied' : 'Copy'}</button>
                      </div>
                      <pre className="rounded bg-slate-50 p-2 text-xs font-mono text-gray-700 ring-1 ring-slate-200 whitespace-pre-wrap">{`TY  - DATA\nTI  - ${effectiveInfo.file_name}\nAU  - GalibierHub\nPY  - ${new Date().getFullYear()}\nPB  - GalibierHub\nUR  - ${url}\nER  - `}</pre>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600">DataCite</span>
                        <button type="button" onClick={() => handleCopy('cite-datacite', `<?xml version="1.0" encoding="UTF-8"?>\n<resource xmlns="http://datacite.org/schema/kernel-4">\n  <identifier identifierType="URL">${url}</identifier>\n  <titles><title>${effectiveInfo.file_name}</title></titles>\n  <publisher>GalibierHub</publisher>\n  <publicationYear>${new Date().getFullYear()}</publicationYear>\n</resource>`)} className="text-xs text-teal-600 hover:underline">{copied === 'cite-datacite' ? 'Copied' : 'Copy'}</button>
                      </div>
                      <pre className="rounded bg-slate-50 p-2 text-xs font-mono text-gray-700 ring-1 ring-slate-200 whitespace-pre-wrap">{`<?xml version="1.0" encoding="UTF-8"?>\n<resource xmlns="http://datacite.org/schema/kernel-4">\n  <identifier identifierType="URL">${url}</identifier>\n  <titles><title>${effectiveInfo.file_name}</title></titles>\n  <publisher>GalibierHub</publisher>\n  <publicationYear>${new Date().getFullYear()}</publicationYear>\n</resource>`}</pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Batch Script Tab */}
              {activeTab === "script" && (linksVisible || isAdmin) && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-gray-800">Batch Download Script Generator</h4>
                  <p className="text-sm text-gray-600">Generate optimized download scripts for high-performance computing and cluster environments.</p>
                  <div className="space-y-4">
                    {/* aria2c */}
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700">aria2c (multi-threaded)</span>
                        <button type="button" onClick={() => handleCopy('script-aria2c', `aria2c -x 16 -s 16 -c "${activePublicUrl}" -o "${effectiveInfo.file_name}"\n# -x 16: max 16 connections per server\n# -s 16: split file into 16 chunks\n# -c : continue/resume partial download`)} className="text-xs text-teal-600 hover:underline">{copied === 'script-aria2c' ? 'Copied!' : 'Copy'}</button>
                      </div>
                      <pre className="rounded bg-slate-50 p-3 text-xs font-mono text-gray-700 ring-1 ring-slate-200 whitespace-pre-wrap overflow-x-auto">{`aria2c -x 16 -s 16 -c "${activePublicUrl}" -o "${effectiveInfo.file_name}"\n# -x 16: max 16 connections per server\n# -s 16: split file into 16 chunks\n# -c : continue/resume partial download`}</pre>
                    </div>
                    {/* wget batch */}
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700">wget -i batch list</span>
                        <button type="button" onClick={() => handleCopy('script-wget', `# Save URL list to urls.txt:\necho "${activePublicUrl}" > urls.txt\n# Download all files in list:\nwget -c -i urls.txt`)} className="text-xs text-teal-600 hover:underline">{copied === 'script-wget' ? 'Copied!' : 'Copy'}</button>
                      </div>
                      <pre className="rounded bg-slate-50 p-3 text-xs font-mono text-gray-700 ring-1 ring-slate-200 whitespace-pre-wrap overflow-x-auto">{`# Save URL list to urls.txt:\necho "${activePublicUrl}" > urls.txt\n# Download all files in list:\nwget -c -i urls.txt`}</pre>
                    </div>
                    {/* Python requests */}
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700">Python (requests)</span>
                        <button type="button" onClick={() => handleCopy('script-python', `import requests\n\nurl = "${activePublicUrl}"\noutput = "${effectiveInfo.file_name}"\n\nwith requests.get(url, stream=True) as r:\n    r.raise_for_status()\n    with open(output, 'wb') as f:\n        for chunk in r.iter_content(chunk_size=8192):\n            f.write(chunk)\n\nprint(f"Downloaded: {output}")`)} className="text-xs text-teal-600 hover:underline">{copied === 'script-python' ? 'Copied!' : 'Copy'}</button>
                      </div>
                      <pre className="rounded bg-slate-50 p-3 text-xs font-mono text-gray-700 ring-1 ring-slate-200 whitespace-pre-wrap overflow-x-auto">{`import requests\n\nurl = "${activePublicUrl}"\noutput = "${effectiveInfo.file_name}"\n\nwith requests.get(url, stream=True) as r:\n    r.raise_for_status()\n    with open(output, 'wb') as f:\n        for chunk in r.iter_content(chunk_size=8192):\n            f.write(chunk)\n\nprint(f"Downloaded: {output}")`}</pre>
                    </div>
                    {/* R download.file */}
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700">R (download.file)</span>
                        <button type="button" onClick={() => handleCopy('script-r', `url <- "${activePublicUrl}"\noutput <- "${effectiveInfo.file_name}"\n\ndownload.file(url, destfile = output, method = "auto", mode = "wb")\ncat("Downloaded:", output, "\\n")`)} className="text-xs text-teal-600 hover:underline">{copied === 'script-r' ? 'Copied!' : 'Copy'}</button>
                      </div>
                      <pre className="rounded bg-slate-50 p-3 text-xs font-mono text-gray-700 ring-1 ring-slate-200 whitespace-pre-wrap overflow-x-auto">{`url <- "${activePublicUrl}"\noutput <- "${effectiveInfo.file_name}"\n\ndownload.file(url, destfile = output, method = "auto", mode = "wb")\ncat("Downloaded:", output, "\\n")`}</pre>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">These scripts are generated from the current URL. For batch downloading multiple files, open the Download &amp; CLI Usage Guide at /docs/download-cli.</p>
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
