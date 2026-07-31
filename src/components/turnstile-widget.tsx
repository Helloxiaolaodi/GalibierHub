'use client';

import { useEffect, useRef, useState } from 'react';

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
  const [fallbackVerified, setFallbackVerified] = useState(false);
  const resolvedSiteKey =
    siteKey ||
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    '';

  useEffect(() => {
    if (!resolvedSiteKey) {
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

  if (!resolvedSiteKey) {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={fallbackVerified}
        onClick={() => {
          if (!fallbackVerified) {
            setFallbackVerified(true);
            onToken(DEV_TOKEN);
          }
        }}
        className={`flex w-full items-center gap-3 rounded-lg border bg-white px-3 py-2.5 text-left text-sm font-medium transition-colors ${fallbackVerified ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        style={{ minHeight: 65 }}
      >
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border ${fallbackVerified ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-400 bg-white'}`}>
          {fallbackVerified ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : null}
        </span>
        <span>{fallbackVerified ? 'Verified' : "I'm not a robot"}</span>
      </button>
    );
  }

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