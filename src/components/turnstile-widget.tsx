'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: string | HTMLElement, opts: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  action?: string;
  siteKey?: string;
}

const DEV_TOKEN = 'dev-token-localhost';

export default function TurnstileWidget({
  onToken,
  action = 'default',
  siteKey,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const resolvedSiteKey =
    siteKey ||
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    '';

  useEffect(() => {
    if (!resolvedSiteKey) {
      if (process.env.NODE_ENV === 'development') {
        onToken(DEV_TOKEN);
      }
      return;
    }

    let attempts = 0;
    const maxAttempts = 60;

    const tryRender = () => {
      attempts += 1;
      const container = containerRef.current;
      if (!container) return;

      if (window.turnstile) {
        if (widgetIdRef.current) {
          try { window.turnstile.remove(widgetIdRef.current); } catch { /* ok */ }
        }
        widgetIdRef.current = window.turnstile.render(container, {
          sitekey: resolvedSiteKey,
          action,
          cData: '',
          callback: (token: string) => onToken(token),
          'error-callback': () => {
            if (process.env.NODE_ENV === 'development') {
              onToken(DEV_TOKEN);
            }
          },
          appearance: 'always',
          theme: 'auto',
        });
        return;
      }

      if (attempts < maxAttempts) {
        setTimeout(tryRender, 100);
      }
    };

    if (!document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => tryRender();
      script.onerror = () => {
        if (process.env.NODE_ENV === 'development') {
          onToken(DEV_TOKEN);
        }
      };
      document.head.appendChild(script);
    } else {
      tryRender();
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* ok */ }
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSiteKey, action]);

  return (
    <div
      ref={containerRef}
      className="cf-turnstile"
      data-sitekey={resolvedSiteKey || undefined}
      data-action={action}
      style={{ minHeight: 65 }}
    />
  );
}