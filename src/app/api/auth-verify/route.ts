import { NextResponse, type NextRequest } from "next/server";
import {
  checkRateLimit,
  clientIpKey,
  readTurnstileSecret,
  verifyTurnstile,
} from "@/lib/anti-bot";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ip = clientIpKey(request);
  const rate = checkRateLimit(`auth-verify:${ip}`, 30, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many verification attempts. Please wait a minute." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } },
    );
  }

  let body: { token?: unknown; action?: unknown } = {};
  try {
    body = await request.json() as { token?: unknown; action?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid verification payload." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const action = typeof body.action === "string" ? body.action.trim() : "auth";
  if (!token) {
    return NextResponse.json({ ok: false, error: "Turnstile token required." }, { status: 400 });
  }

  const secret = readTurnstileSecret();
  if (!secret) {
    if (token === "dev-token-localhost") {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { ok: false, error: "Turnstile is not configured. Set NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET." },
      { status: 503 },
    );
  }

  if (process.env.NODE_ENV === "development" && token === "dev-token-localhost") {
    return NextResponse.json({ ok: true });
  }

  const result = await verifyTurnstile(token, secret, ip);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: "Human verification failed. Please try again." },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true, action });
}
