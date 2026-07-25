import { SiteConfig } from '@/site-config';

export function normalizeGithubLogin(value: string | null | undefined): string {
  return (value || '').trim().replace(/^@/, '').toLowerCase();
}

export function resolveExpectedAdminGithubLogin(options?: {
  serverLogin?: string | null;
  clientLogin?: string | null;
  fallbackLabel?: string | null;
}): string {
  const serverLogin = normalizeGithubLogin(options?.serverLogin ?? process.env.GITHUB_ADMIN_USERNAME);
  if (serverLogin) return serverLogin;

  const clientLogin = normalizeGithubLogin(options?.clientLogin ?? process.env.NEXT_PUBLIC_GITHUB_ADMIN_USERNAME);
  if (clientLogin) return clientLogin;

  return normalizeGithubLogin(options?.fallbackLabel ?? SiteConfig.creatorCreditLabel);
}
