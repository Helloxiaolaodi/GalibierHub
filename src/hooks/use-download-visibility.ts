'use client';

import { useEffect, useMemo, useState } from 'react';
import { normalizeDownloadKey } from '@/lib/download-info';

type VisibilityMap = Record<string, boolean>;

export function useDownloadVisibility(urls: Array<string | null | undefined>, isAdmin = false) {
  const keys = useMemo(
    () => [...new Set(urls.map((url) => normalizeDownloadKey(url || '')).filter(Boolean))],
    [urls],
  );
  const [hiddenMap, setHiddenMap] = useState<VisibilityMap>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    if (isAdmin || keys.length === 0) {
      setHiddenMap({});
      setLoaded(true);
      return () => {
        active = false;
      };
    }

    setLoaded(false);

    void Promise.all(
      keys.map(async (key) => {
        try {
          const response = await fetch(`/api/download-metadata?key=${encodeURIComponent(key)}`);
          if (!response.ok) {
            return [key, false] as const;
          }
          const data = (await response.json()) as { hidden?: boolean };
          return [key, Boolean(data.hidden)] as const;
        } catch {
          return [key, false] as const;
        }
      }),
    ).then((entries) => {
      if (!active) return;
      setHiddenMap(Object.fromEntries(entries));
      setLoaded(true);
    });

    return () => {
      active = false;
    };
  }, [isAdmin, keys]);

  const isVisible = (url: string | null | undefined) => {
    if (!url) return false;
    if (isAdmin) return true;
    const key = normalizeDownloadKey(url);
    if (!key) return false;
    return !hiddenMap[key];
  };

  return { hiddenMap, isVisible, loaded };
}
