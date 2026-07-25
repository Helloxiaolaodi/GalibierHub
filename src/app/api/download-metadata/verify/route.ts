import { NextResponse } from "next/server";
import { scryptSync, timingSafeEqual } from "crypto";
import { getSupabase, isSupabaseConfigured } from "@/utils/supabase";

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const salt = Buffer.from(parts[0], "hex");
  const expected = Buffer.from(parts[1], "hex");
  const hash = scryptSync(password, salt, expected.length);
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ verified: true }, { status: 200 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = body as { download_key?: unknown; password?: unknown };
  const key = typeof payload.download_key === "string" ? payload.download_key.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!key || !password) {
    return NextResponse.json({ error: "Missing key or password." }, { status: 400 });
  }

  const sb = getSupabase();
  const { data: row, error } = await sb
    .from("download_metadata")
    .select("password_hash")
    .eq("download_key", key)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row?.password_hash) {
    // not protected
    return NextResponse.json({ verified: true }, { status: 200 });
  }

  if (!verifyPassword(password, String(row.password_hash))) {
    return NextResponse.json({ verified: false, error: "Incorrect password." }, { status: 403 });
  }

  return NextResponse.json({ verified: true }, { status: 200 });
}
