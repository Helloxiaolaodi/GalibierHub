import { createHash } from "crypto";
import type { User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/utils/supabase";

type CreatorAuthResult =
  | { ok: true; githubLogin: string; user: User }
  | { ok: false; error: string };

function readStringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractGithubLogin(user: User): string | null {
  const metadata = user.user_metadata && typeof user.user_metadata === "object"
    ? user.user_metadata as Record<string, unknown>
    : {};

  const direct = readStringField(metadata, "user_name")
    || readStringField(metadata, "preferred_username")
    || readStringField(metadata, "login")
    || readStringField(metadata, "name");

  if (direct) {
    return direct;
  }

  const githubIdentity = user.identities?.find((identity) => identity.provider === "github");
  if (!githubIdentity || !githubIdentity.identity_data || typeof githubIdentity.identity_data !== "object") {
    return null;
  }

  const identityData = githubIdentity.identity_data as Record<string, unknown>;
  return readStringField(identityData, "user_name")
    || readStringField(identityData, "preferred_username")
    || readStringField(identityData, "login")
    || readStringField(identityData, "name");
}

export async function requireCreatorGithubAuth(accessToken: string | null): Promise<CreatorAuthResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const expectedGithubLogin = (process.env.GITHUB_ADMIN_USERNAME || "").trim().toLowerCase();
  if (!expectedGithubLogin) {
    return { ok: false, error: "GITHUB_ADMIN_USERNAME is not configured." };
  }

  if (!accessToken) {
    return { ok: false, error: "Sign in with the creator GitHub account to reply." };
  }

  const { data, error } = await getSupabase().auth.getUser(accessToken);
  if (error || !data.user) {
    return { ok: false, error: "GitHub login could not be verified. Please sign in again." };
  }

  const provider = data.user.app_metadata?.provider;
  if (provider !== "github" && !data.user.identities?.some((identity) => identity.provider === "github")) {
    return { ok: false, error: "Only GitHub login is allowed for creator replies." };
  }

  const githubLogin = extractGithubLogin(data.user);
  if (!githubLogin) {
    const rawMeta = JSON.stringify(data.user.user_metadata || {}).slice(0, 120);
    return { ok: false, error: `The GitHub account login name could not be read from Supabase Auth. Metadata preview: ${rawMeta}` };
  }

  if (githubLogin.toLowerCase() !== expectedGithubLogin) {
    return { ok: false, error: `This GitHub account (@${githubLogin}) does not have creator reply access. Expected: @${process.env.GITHUB_ADMIN_USERNAME || "unknown"}.` };
  }

  return { ok: true, githubLogin, user: data.user };
}

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) {
    return null;
  }
  return token.trim();
}

export function hashVisitorFingerprint(fingerprint: string): string {
  return createHash("sha256").update(fingerprint).digest("hex");
}
