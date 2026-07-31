// ============================================================
// GalibierHub Anti-Bot & Security Utilities
// ============================================================
// Shared by src/middleware.ts (edge runtime) and route handlers.
// Provides: in-memory rate limiter, Turnstile verification,
// honeypot/time-trap detection, API key hashing.
//
// Primary rate limiting should be configured in Cloudflare
// Dashboard: Security -> WAF -> Rate Limiting Rules.
// The in-memory limiter here is a secondary fallback.

import { type NextRequest } from "next/server";


// ---- Constants ----

export const API_KEY_HEADER = "X-API-Key";
export const HONEYPOT_FIELD_NAME = "company";
export const TIME_TRAP_FIELD = "_rendered_at";

/** Paths that require Turnstile verification for non-GET requests. */
export const TURNSTILE_PROTECTED_PATHS = [
  "/api/feedback",
  "/api/upload-image",
  "/api/download-metadata/inc",
  "/api/reactions",
];

/** Paths that are subject to rate limiting. */
export const RATE_LIMITED_PATHS = [
  "/api/promoters",
  "/api/samples",
  "/api/variants",
  "/api/download-catalog",
  "/api/download-metadata",
  "/api/download-readme",
  "/api/reactions",
  "/api/feedback",
  "/api/stats",
  "/api/auth-verify",
];

// ---- In-Memory Rate Limiter ----

interface RateEntry {
  count: number;
  resetAt: number;
}

const rateStore = new Map<string, RateEntry>();

// Periodic cleanup every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateStore) {
      if (entry.resetAt <= now) rateStore.delete(key);
    }
  }, 300_000);
}

export function checkRateLimit(
  key: string,
  maxReqs: number,
  windowSecs: number,
): { allowed: boolean; resetAt: number } {
  const now = Date.now();
  const entry = rateStore.get(key);
  const resetAt = entry && entry.resetAt > now ? entry.resetAt : now + windowSecs * 1000;
  if (entry && entry.resetAt > now) {
    entry.count += 1;
  } else {
    rateStore.set(key, { count: 1, resetAt });
  }
  return {
    allowed: (rateStore.get(key)?.count ?? 0) <= maxReqs,
    resetAt,
  };
}

// ---- IP Extraction ----

export function clientIpKey(request: NextRequest): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "127.0.0.1";
}

// ---- Turnstile ----

export function readTurnstileSecret(): string | null {
  return process.env.TURNSTILE_SECRET || null;
}

export async function verifyTurnstile(
  token: string,
  secret: string,
  remoteip: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const j = (await r.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!r.ok || !j.success) {
      return { ok: false, error: (j["error-codes"] ?? ["verification-failed"]).join(", ") };
    }
    return { ok: true };
  } catch {
    if (process.env.NODE_ENV === "development") return { ok: true };
    return { ok: false, error: "turnstile-unreachable" };
  }
}

// ---- API Key Hashing ----

export function hashApiKey(key: string): string {
  // Deterministic byte hash for rate-limit key differentiation.
  try {
    return Array.from(new TextEncoder().encode(key))
      .reduce((s, b) => s + b.toString(16).padStart(2, "0"), "")
      .slice(0, 32);
  } catch {
    return key.slice(0, 32);
  }
}

// ---- Honeypot Detection ----

export function isHoneypotFilledJson(body: Record<string, unknown>): boolean {
  const value = body[HONEYPOT_FIELD_NAME];
  if (value === undefined || value === null || value === "") return false;
  if (typeof value === "string") return value.length > 0;
  return true;
}

// ---- Time-Trap Validation ----

const MIN_FORM_TIME_MS = 2000;

export function validateTimeTrap(
  renderedAt: unknown,
): { ok: boolean; reason?: string } {
  if (typeof renderedAt !== "number") {
    return { ok: false, reason: "missing render timestamp" };
  }
  const elapsed = Date.now() - renderedAt;
  if (elapsed < MIN_FORM_TIME_MS) {
    return { ok: false, reason: "form submitted too quickly" };
  }
  if (elapsed > 7200_000) {
    return { ok: false, reason: "form expired" };
  }
  return { ok: true };
}
