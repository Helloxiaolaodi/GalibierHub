import { NextResponse } from "next/server";
import { randomBytes, scryptSync } from "crypto";
import { getSupabase, isSupabaseConfigured } from "@/utils/supabase";
import { requireCreatorGithubAuth, getBearerToken } from "@/lib/feedback-admin";
import { DEFAULT_DOWNLOAD_METADATA, normalizeDownloadKey, type DownloadStorageProvider } from "@/lib/download-info";

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return salt.toString("hex") + ":" + hash.toString("hex");
}

export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(DEFAULT_DOWNLOAD_METADATA, { status: 200 });
  }

  const url = new URL(request.url);
  const key = normalizeDownloadKey(url.searchParams.get("key") || "");
  if (!key) {
    return NextResponse.json({ error: "Missing download key." }, { status: 400 });
  }

  const sb = getSupabase();

  const { data: meta, error: metaErr } = await sb
    .from("download_metadata")
    .select("custom_label, custom_size_bytes, custom_file_type, custom_description, hidden, password_hash, created_at, updated_at, storage_provider, storage_bucket, storage_path, signed_url_ttl_seconds, md5_checksum, sha256_checksum")
    .eq("download_key", key)
    .maybeSingle();

  const { count, error: countErr } = await sb
    .from("download_events")
    .select("id", { count: "exact", head: true })
    .eq("download_key", key);

  if (metaErr || countErr) {
    return NextResponse.json(
      { error: (metaErr || countErr)?.message || "Failed to load download metadata." },
      { status: 500 },
    );
  }

  const row = meta ?? null;
  return NextResponse.json(
    {
      custom_label: row?.custom_label ?? null,
      custom_size_bytes: row?.custom_size_bytes ?? null,
      custom_file_type: row?.custom_file_type ?? null,
      custom_description: row?.custom_description ?? null,
      hidden: row?.hidden ?? false,
      password_protected: Boolean(row?.password_hash),
      download_count: count ?? 0,
      created_at: row?.created_at ?? null,
      updated_at: row?.updated_at ?? null,
      storage_provider: (row?.storage_provider as DownloadStorageProvider | null) ?? 'public_url',
      storage_bucket: row?.storage_bucket ?? null,
      storage_path: row?.storage_path ?? null,
      signed_url_ttl_seconds: typeof row?.signed_url_ttl_seconds === 'number' ? row.signed_url_ttl_seconds : 900,
      md5_checksum: row?.md5_checksum ?? null,
      sha256_checksum: row?.sha256_checksum ?? null,
    },
    { status: 200 },
  );
}

export async function PUT(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const token = getBearerToken(request);
  const auth = await requireCreatorGithubAuth(token);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  const payload = body as {
    download_key?: unknown;
    custom_label?: unknown;
    custom_size_bytes?: unknown;
    custom_file_type?: unknown;
    custom_description?: unknown;
    hidden?: unknown;
    password?: unknown;
    clear_password?: unknown;
    storage_provider?: unknown;
    storage_bucket?: unknown;
    storage_path?: unknown;
    signed_url_ttl_seconds?: unknown;
    md5_checksum?: unknown;
    sha256_checksum?: unknown;
  };

  const key = typeof payload.download_key === "string" ? payload.download_key.trim() : "";
  if (!key) {
    return NextResponse.json({ error: "Missing download_key." }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof payload.custom_label === "string") patch.custom_label = payload.custom_label.trim();
  if (payload.custom_size_bytes === null || typeof payload.custom_size_bytes === "number") {
    patch.custom_size_bytes = payload.custom_size_bytes;
  }
  if (typeof payload.custom_file_type === "string") patch.custom_file_type = payload.custom_file_type.trim();
  if (typeof payload.custom_description === "string") patch.custom_description = payload.custom_description.trim();
  if (typeof payload.hidden === "boolean") patch.hidden = payload.hidden;
  if (payload.storage_provider === 'public_url' || payload.storage_provider === 'supabase_private') {
    patch.storage_provider = payload.storage_provider;
  }
  if (typeof payload.storage_bucket === "string") patch.storage_bucket = payload.storage_bucket.trim() || null;
  if (typeof payload.storage_path === "string") patch.storage_path = payload.storage_path.trim() || null;
  if (typeof payload.signed_url_ttl_seconds === 'number' && Number.isFinite(payload.signed_url_ttl_seconds)) {
    patch.signed_url_ttl_seconds = Math.max(60, Math.min(86400, Math.round(payload.signed_url_ttl_seconds)));
  }
  if (typeof payload.md5_checksum === 'string') patch.md5_checksum = payload.md5_checksum.trim() || null;
  if (typeof payload.sha256_checksum === 'string') patch.sha256_checksum = payload.sha256_checksum.trim() || null;

  if (payload.clear_password === true) {
    patch.password_hash = null;
  } else if (typeof payload.password === "string" && payload.password.trim().length >= 4) {
    patch.password_hash = hashPassword(payload.password.trim());
  }

  const sb = getSupabase();
  const { data: existing } = await sb
    .from("download_metadata")
    .select("download_key")
    .eq("download_key", key)
    .maybeSingle();

  if (existing) {
    const { error } = await sb.from("download_metadata").update(patch).eq("download_key", key);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await sb.from("download_metadata").insert({ download_key: key, ...patch });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
