// ============================================================
// SeqEdge Middleware -- Edge-layer defense
// ============================================================
// Runs on Cloudflare Edge (opennextjs-cloudflare edge wrapper).
// Handles: CORS enforcement, Turnstile verification for write
// endpoints, honeypot/time-trap on feedback POST, and optional
// in-memory rate limiting for search/download paths.
//
// Primary rate limiting should be configured in the Cloudflare
// dashboard: Security -> WAF -> Rate Limiting Rules.
// The in-memory limiter here is a secondary fallback.

import { NextResponse, type NextRequest } from "next/server";
import {
  checkRateLimit,
  clientIpKey,
  verifyTurnstile,
  readTurnstileSecret,
  API_KEY_HEADER,
  hashApiKey,
  TURNSTILE_PROTECTED_PATHS,
  RATE_LIMITED_PATHS,
  TIME_TRAP_FIELD,
  isHoneypotFilledJson,
  validateTimeTrap,
} from "@/lib/anti-bot";

// ---- Config ----

const ALLOWED_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL || ""
).replace(/\/+$/, "");

const RATE_WINDOW_SECS = 10;
const RATE_MAX_REQS = 10;
const APIKEY_RATE_MAX = 30;

export const config = {
  matcher: ["/api/:path*"],
};

// ---- Helpers ----

function isProtected(pathname: string): boolean {
  return TURNSTILE_PROTECTED_PATHS.some((p) => pathname.startsWith(p));
}

function isRateLimited(pathname: string): boolean {
  return RATE_LIMITED_PATHS.some((p) => pathname.startsWith(p));
}

function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowed = ALLOWED_ORIGIN
    ? [ALLOWED_ORIGIN, "http://localhost:3000", "http://localhost:3001"]
    : ["http://localhost:3000", "http://localhost:3001"];

  if (origin && allowed.some((a) => origin.startsWith(a) || a === "*")) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-API-Key, X-Turnstile-Token",
      "Access-Control-Max-Age": "86400",
    };
  }
  return {};
}

// ---- Middleware ----

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = clientIpKey(request);

  // --- Preflight CORS ---
  if (request.method === "OPTIONS") {
    const corsHeaders = getCorsHeaders(request);
    if (Object.keys(corsHeaders).length === 0) {
      return new NextResponse(null, { status: 204 });
    }
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  // --- Reject unknown cross-origin API calls ---
  if (pathname.startsWith("/api/")) {
    const corsHeaders = getCorsHeaders(request);
    if (
      request.headers.get("origin") &&
      !corsHeaders["Access-Control-Allow-Origin"]
    ) {
      return new NextResponse(
        JSON.stringify({ error: "CORS not allowed" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // --- Rate Limiting (secondary fallback) ---
  if (isRateLimited(pathname)) {
    const apiKey = request.headers.get(API_KEY_HEADER);
    const rateKey = apiKey
      ? "apikey:" + hashApiKey(apiKey)
      : pathname + ":" + ip;
    const maxReqs = apiKey ? APIKEY_RATE_MAX : RATE_MAX_REQS;
    const rl = checkRateLimit(rateKey, maxReqs, RATE_WINDOW_SECS);
    if (!rl.allowed) {
      const retryAfter = Math.max(
        1,
        Math.ceil((rl.resetAt - Date.now()) / 1000),
      );
      return new NextResponse(
        JSON.stringify({ error: "Too many requests. Please slow down." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfter),
          },
        },
      );
    }
  }

  // --- Proceed with Turnstile + Honeypot checks ---
  return await withSecurityChecks(
    NextResponse.next(),
    request,
    ip,
    pathname,
  );
}

async function withSecurityChecks(
  res: NextResponse,
  request: NextRequest,
  ip: string,
  pathname: string,
): Promise<NextResponse> {
  const apiKey = request.headers.get(API_KEY_HEADER);

  // Turnstile verification for write/heavy endpoints (non-GET, no API key)
  if (isProtected(pathname) && !apiKey) {
    if (request.method !== "GET") {
      const token = request.headers.get("x-turnstile-token");
      const secret = readTurnstileSecret();
      if (secret && token) {
        const result = await verifyTurnstile(token, secret, ip);
        if (!result.ok) {
          return new NextResponse(
            JSON.stringify({ error: "Turnstile: " + (result.error || "failed") }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }
      }
      // If no token and secret is configured, reject
      // (except during local dev where secret may not be set)
      if (secret && !token) {
        return new NextResponse(
          JSON.stringify({ error: "Turnstile token required." }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
    }
  }

  // Honeypot + Time-trap on feedback POST
  if (pathname === "/api/feedback" && request.method === "POST") {
    let body: Record<string, unknown> = {};
    try {
      body = await request.clone().json();
    } catch {
      // Can not parse body, let the route handler deal with it
    }

    // Honeypot check: silently accept but discard
    if (isHoneypotFilledJson(body)) {
      return NextResponse.json({ ok: true });
    }

    // Time-trap check
    const renderedAt = body[TIME_TRAP_FIELD];
    if (renderedAt !== undefined) {
      const trap = validateTimeTrap(renderedAt);
      if (!trap.ok) {
        return new NextResponse(
          JSON.stringify({ error: trap.reason || "Submission too fast." }),
          { status: 422, headers: { "Content-Type": "application/json" } },
        );
      }
    }
  }

  return res;
}
