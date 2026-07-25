import { NextResponse } from "next/server";
import { scryptSync, timingSafeEqual, createHash } from "crypto";
import { getSupabase, isSupabaseConfigured } from "@/utils/supabase";

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const salt = Buffer.from(parts[0], "hex");
  const expected = Buffer.from(parts[1], "hex");
  const hash = scryptSync(password, salt, expected.length);
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

function clientIpHash(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for") || request.headers.get("X-Forwarded-For");
  if (!fwd) return null;
  const first = fwd.split(",")[0].trim();
  if (!first) return null;
  return createHash("sha256").update(first).digest("hex");
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: true, count: 0 }, { status: 200 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = body as { download_key?: unknown; password?: unknown };
  const key = typeof payload.download_key === "string" ? payload.download_key.trim() : "";
  if (!key) {
    return NextResponse.json({ error: "Missing download_key." }, { status: 400 });
  }

  const sb = getSupabase();

  // If protected, require correct password before counting/unlocking.
  const { data: meta } = await sb
    .from("download_metadata")
    .select("password_hash")
    .eq("download_key", key)
    .maybeSingle();

  if (meta?.password_hash) {
    const password = typeof payload.password === "string" ? payload.password : "";
    if (!verifyPassword(password, String(meta.password_hash))) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 403 });
    }
  }

  const ipHash = clientIpHash(request);
  const { data: inserted, error } = await sb
    .from("download_events")
    .insert({ download_key: key, ip_hash: ipHash })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count } = await sb
    .from("download_events")
    .select("id", { count: "exact", head: true })
    .eq("download_key", key);

  return NextResponse.json({ ok: true, count: count ?? (inserted ? 1 : 0) }, { status: 200 });
}
