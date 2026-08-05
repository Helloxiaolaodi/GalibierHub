"use client";

import { useCallback, useEffect, useState } from "react";

function resolveDark(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem("galibierhub-theme");
  if (stored === "dark") return true;
  if (stored === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(resolveDark());
    applyTheme(resolveDark());

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const stored = localStorage.getItem("galibierhub-theme");
      if (stored !== "light" && stored !== "dark") {
        setDark(media.matches);
      }
    };
    const syncSettings = () => {
      const stored = localStorage.getItem("galibierhub-theme");
      const next = stored === "dark" || (stored !== "light" && media.matches);
      setDark(next);
      applyTheme(next);
    };

    media.addEventListener("change", sync);
    window.addEventListener("galibierhub-settings-updated", syncSettings);
    window.addEventListener("storage", syncSettings);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("galibierhub-settings-updated", syncSettings);
      window.removeEventListener("storage", syncSettings);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = !dark;
    localStorage.setItem("galibierhub-theme", next ? "dark" : "light");
    setDark(next);
    applyTheme(next);
    window.dispatchEvent(new Event("galibierhub-theme-changed"));
  }, [dark]);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] shadow-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
    >
      {dark ? (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36 6.36-1.42-1.42M7.06 8.06 5.64 6.64m12.72 0-1.42 1.42M7.06 15.94l-1.42 1.42M12 8a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}
