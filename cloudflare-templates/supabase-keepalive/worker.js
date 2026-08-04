// GalibierHub Supabase Keep-Alive Worker
// ============================================================
// Prevents a free Supabase project from pausing after 7 days
// without activity. Cloudflare Cron Triggers call this Worker,
// which performs one lightweight anonymous SELECT through the
// Supabase REST API.

const DEFAULT_TABLE = "genome_samples";
const REQUEST_TIMEOUT_MS = 10000;
const MAX_ATTEMPTS = 3;

export default {
  async scheduled(_event, env, _ctx) {
    try {
      const result = await runKeepAlive(env);
      console.log(JSON.stringify({ source: "scheduled", ...result }));
    } catch (error) {
      console.error(
        JSON.stringify({
          source: "scheduled",
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }
  },

  async fetch(request, env, _ctx) {
    if (request.method !== "POST" && request.method !== "GET") {
      return jsonResponse({ status: "method_not_allowed" }, 405);
    }

    const url = new URL(request.url);
    const authHeader = request.headers.get("authorization") || "";
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    const manualToken = bearerToken || url.searchParams.get("token") || "";

    if (env.KEEPALIVE_SECRET && manualToken !== env.KEEPALIVE_SECRET) {
      return jsonResponse({ status: "unauthorized" }, 401);
    }

    try {
      const result = await runKeepAlive(env);
      const status = result.status === "ok" ? 200 : 500;
      return jsonResponse(result, status);
    } catch (error) {
      return jsonResponse(
        {
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
};

async function runKeepAlive(env) {
  const baseUrl = (env.SUPABASE_URL || "").replace(/\/+$/, "");
  const anonKey = env.SUPABASE_ANON_KEY || "";

  if (!baseUrl || !anonKey) {
    return {
      status: "skipped",
      reason: "SUPABASE_URL or SUPABASE_ANON_KEY is not configured",
      timestamp: new Date().toISOString(),
    };
  }

  const table = env.SUPABASE_KEEPALIVE_TABLE || DEFAULT_TABLE;
  const endpoint = `${baseUrl}/rest/v1/${encodeURIComponent(table)}?select=${encodeURIComponent("id")}&limit=1`;
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchWithTimeout(endpoint, { headers });
      if (response.ok) {
        return {
          status: "ok",
          table,
          supabaseStatus: response.status,
          timestamp: new Date().toISOString(),
        };
      }

      const body = await response.text();
      lastError = new Error(
        `Supabase REST request failed (${response.status}): ${body.slice(0, 300)}`,
      );

      // Do not retry request-level configuration errors such as 401/403.
      if (response.status < 500) {
        break;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    if (attempt < MAX_ATTEMPTS) {
      await sleep(attempt * 1000);
    }
  }

  throw lastError || new Error("Supabase keep-alive request failed");
}

async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
