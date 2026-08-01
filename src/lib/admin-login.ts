import { SiteConfig } from '@/site-config';

export function normalizeGithubLogin(value: string | null | undefined): string {
  return (value || '').trim().replace(/^@/, '').toLowerCase();
}

function splitGithubLogins(value: string | null | undefined): string[] {
  return String(value || '')
    .split(',')
    .map(normalizeGithubLogin)
    .filter(Boolean);
}

export function resolveExpectedAdminGithubLogins(options?: {
  serverLogin?: string | null;
  clientLogin?: string | null;
  fallbackLabel?: string | null;
}): string[] {
  const values = [
    options?.serverLogin ?? process.env.GITHUB_ADMIN_USERNAME,
    process.env.GITHUB_ADMIN_USERNAMES,
    options?.clientLogin ?? process.env.NEXT_PUBLIC_GITHUB_ADMIN_USERNAME,
    options?.fallbackLabel ?? SiteConfig.adminGithubLoginFallback,
  ];
  return [...new Set(values.flatMap(splitGithubLogins))];
}

export function resolveExpectedAdminGithubLogin(options?: {
  serverLogin?: string | null;
  clientLogin?: string | null;
  fallbackLabel?: string | null;
}): string {
  return resolveExpectedAdminGithubLogins(options)[0] || '';
}
