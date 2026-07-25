import { NextResponse } from 'next/server';
import { scryptSync, timingSafeEqual } from 'crypto';
import { getSupabase, isSupabaseConfigured } from '@/utils/supabase';
import {
  buildDownloadResolvedInfo,
  DEFAULT_DOWNLOAD_METADATA,
  normalizeDownloadKey,
  type DownloadMetadataPayload,
} from '@/lib/download-info';

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const salt = Buffer.from(parts[0], 'hex');
  const expected = Buffer.from(parts[1], 'hex');
  const hash = scryptSync(password, salt, expected.length);
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const payload = body as {
    download_key?: unknown;
    password?: unknown;
    label?: unknown;
    description?: unknown;
  };

  const downloadKey = normalizeDownloadKey(typeof payload.download_key === 'string' ? payload.download_key : '');
  const fallbackLabel = typeof payload.label === 'string' ? payload.label : null;
  const fallbackDescription = typeof payload.description === 'string' ? payload.description : null;
  const password = typeof payload.password === 'string' ? payload.password : '';

  if (!downloadKey) {
    return NextResponse.json({ error: 'Missing download_key.' }, { status: 400 });
  }

  if (!isSupabaseConfigured) {
    const resolved = buildDownloadResolvedInfo(downloadKey, DEFAULT_DOWNLOAD_METADATA, fallbackLabel, fallbackDescription);
    return NextResponse.json({ ok: true, resolved, url: resolved.public_url }, { status: 200 });
  }

  const sb = getSupabase();
  const { data: row, error } = await sb
    .from('download_metadata')
    .select('custom_label, custom_size_bytes, custom_file_type, custom_description, hidden, password_hash, created_at, updated_at, storage_provider, storage_bucket, storage_path, signed_url_ttl_seconds, md5_checksum, sha256_checksum')
    .eq('download_key', downloadKey)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const meta: DownloadMetadataPayload = {
    ...DEFAULT_DOWNLOAD_METADATA,
    custom_label: row?.custom_label ?? null,
    custom_size_bytes: row?.custom_size_bytes ?? null,
    custom_file_type: row?.custom_file_type ?? null,
    custom_description: row?.custom_description ?? null,
    hidden: row?.hidden ?? false,
    password_protected: Boolean(row?.password_hash),
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
    storage_provider: row?.storage_provider === 'supabase_private' ? 'supabase_private' : 'public_url',
    storage_bucket: row?.storage_bucket ?? null,
    storage_path: row?.storage_path ?? null,
    signed_url_ttl_seconds: typeof row?.signed_url_ttl_seconds === 'number' ? row.signed_url_ttl_seconds : 900,
    md5_checksum: row?.md5_checksum ?? null,
    sha256_checksum: row?.sha256_checksum ?? null,
    download_count: 0,
  };

  if (meta.hidden) {
    return NextResponse.json({ error: 'This file is hidden by the creator.' }, { status: 403 });
  }

  if (row?.password_hash) {
    if (!password || !verifyPassword(password, String(row.password_hash))) {
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 403 });
    }
  }

  if (meta.storage_provider === 'supabase_private') {
    if (!meta.storage_bucket || !meta.storage_path) {
      return NextResponse.json({ error: 'Private storage is not configured for this file.' }, { status: 400 });
    }
    const { data: signed, error: signedError } = await sb.storage
      .from(meta.storage_bucket)
      .createSignedUrl(meta.storage_path, meta.signed_url_ttl_seconds);

    if (signedError || !signed?.signedUrl) {
      return NextResponse.json({ error: signedError?.message || 'Failed to create signed URL.' }, { status: 500 });
    }

    const resolved = buildDownloadResolvedInfo(downloadKey, meta, fallbackLabel, fallbackDescription);
    return NextResponse.json({ ok: true, resolved, url: signed.signedUrl }, { status: 200 });
  }

  const resolved = buildDownloadResolvedInfo(downloadKey, meta, fallbackLabel, fallbackDescription);
  if (!resolved.public_url) {
    return NextResponse.json({ error: 'This file does not have a usable public URL.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, resolved, url: resolved.public_url }, { status: 200 });
}
