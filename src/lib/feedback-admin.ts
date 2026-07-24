import { createHash } from 'crypto';

export function isAdminTokenValid(token: string | null): boolean {
  const expected = process.env.SITE_ADMIN_REPLY_TOKEN || '';
  return Boolean(expected) && Boolean(token) && token === expected;
}

export function requireAdminToken(token: string | null): { ok: true } | { ok: false; error: string } {
  if (!process.env.SITE_ADMIN_REPLY_TOKEN) {
    return { ok: false, error: 'SITE_ADMIN_REPLY_TOKEN is not configured.' };
  }
  if (!isAdminTokenValid(token)) {
    return { ok: false, error: 'Invalid admin token.' };
  }
  return { ok: true };
}

export function hashVisitorFingerprint(fingerprint: string): string {
  return createHash('sha256').update(fingerprint).digest('hex');
}
