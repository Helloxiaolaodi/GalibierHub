"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Major research hub timezones for default display
const HUBS: { city: string; tz: string }[] = [
  { city: "New York", tz: "America/New_York" },
  { city: "London", tz: "Europe/London" },
  { city: "Beijing", tz: "Asia/Shanghai" },
  { city: "Tokyo", tz: "Asia/Tokyo" },
  { city: "Zurich", tz: "Europe/Zurich" },
];

const ALL_CITIES: { city: string; country: string; tz: string }[] = [
  { city: "New York", country: "USA", tz: "America/New_York" },
  { city: "Los Angeles", country: "USA", tz: "America/Los_Angeles" },
  { city: "Chicago", country: "USA", tz: "America/Chicago" },
  { city: "San Francisco", country: "USA", tz: "America/Los_Angeles" },
  { city: "Boston", country: "USA", tz: "America/New_York" },
  { city: "London", country: "UK", tz: "Europe/London" },
  { city: "Paris", country: "France", tz: "Europe/Paris" },
  { city: "Berlin", country: "Germany", tz: "Europe/Berlin" },
  { city: "Zurich", country: "Switzerland", tz: "Europe/Zurich" },
  { city: "Amsterdam", country: "Netherlands", tz: "Europe/Amsterdam" },
  { city: "Copenhagen", country: "Denmark", tz: "Europe/Copenhagen" },
  { city: "Stockholm", country: "Sweden", tz: "Europe/Stockholm" },
  { city: "Beijing", country: "China", tz: "Asia/Shanghai" },
  { city: "Shanghai", country: "China", tz: "Asia/Shanghai" },
  { city: "Tokyo", country: "Japan", tz: "Asia/Tokyo" },
  { city: "Seoul", country: "South Korea", tz: "Asia/Seoul" },
  { city: "Singapore", country: "Singapore", tz: "Asia/Singapore" },
  { city: "Sydney", country: "Australia", tz: "Australia/Sydney" },
  { city: "Melbourne", country: "Australia", tz: "Australia/Melbourne" },
  { city: "Mumbai", country: "India", tz: "Asia/Kolkata" },
  { city: "Bangalore", country: "India", tz: "Asia/Kolkata" },
  { city: "Dubai", country: "UAE", tz: "Asia/Dubai" },
  { city: "Sao Paulo", country: "Brazil", tz: "America/Sao_Paulo" },
  { city: "Toronto", country: "Canada", tz: "America/Toronto" },
  { city: "Vancouver", country: "Canada", tz: "America/Vancouver" },
  { city: "Moscow", country: "Russia", tz: "Europe/Moscow" },
  { city: "Cape Town", country: "South Africa", tz: "Africa/Johannesburg" },
  { city: "Nairobi", country: "Kenya", tz: "Africa/Nairobi" },
  { city: "Tel Aviv", country: "Israel", tz: "Asia/Jerusalem" },
  { city: "Mexico City", country: "Mexico", tz: "America/Mexico_City" },
  { city: "Buenos Aires", country: "Argentina", tz: "America/Argentina/Buenos_Aires" },
  { city: "Istanbul", country: "Turkey", tz: "Europe/Istanbul" },
  { city: "Bangkok", country: "Thailand", tz: "Asia/Bangkok" },
  { city: "Jakarta", country: "Indonesia", tz: "Asia/Jakarta" },
  { city: "Hong Kong", country: "China", tz: "Asia/Hong_Kong" },
];

function getTimeParts(tz: string) {
  try {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const parts = fmt.formatToParts(now);
    const map: Record<string, string> = {};
    parts.forEach((p) => { if (p.type !== "literal") map[p.type] = p.value; });
    const hour24Fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hour12: false });
    const h24 = parseInt(hour24Fmt.format(now), 10);
    return {
      time: `${map.hour}:${map.minute} ${map.dayPeriod?.toUpperCase() || ""}`,
      date: `${map.weekday}, ${map.month} ${map.day}`,
      hour: h24,
      minute: parseInt(map.minute || "0", 10),
      isDaytime: h24 >= 6 && h24 < 20,
    };
  } catch {
    return null;
  }
}

export default function WorldClock() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return HUBS;
    return ALL_CITIES.filter(
      (c) =>
        c.city.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.tz.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((p) => !p);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-slate-800 hover:border-gray-300 transition-colors"
        title="World Clock (Ctrl+K)"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
          <ellipse cx="12" cy="12" rx="4" ry="10" strokeWidth={1.5} />
          <path strokeWidth={1.5} d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10M12 2a15.3 15.3 0 00-4 10 15.3 15.3 0 004 10" />
        </svg>
        <span className="hidden sm:inline">World Clock</span>
        <kbd className="hidden sm:inline-flex items-center rounded border border-gray-300 bg-gray-100 px-1.5 py-0 text-[10px] font-mono text-gray-500">Ctrl+K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search city or timezone..."
                className="flex-1 border-0 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
              />
              {query && (
                <button onClick={() => setQuery("")} className="rounded px-2 py-0.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                  Clear
                </button>
              )}
              <button onClick={() => setOpen(false)} className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="max-h-[400px] overflow-y-auto p-2">
              {!query && (
                <div className="px-3 pt-1 pb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Major Research Hubs</span>
                </div>
              )}
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">No cities found for &quot;{query}&quot;</div>
              ) : (
                filtered.map((item) => {
                  const parts = getTimeParts(item.tz);
                  if (!parts) return null;
                  return (
                    <div key={item.city + item.tz} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg flex-shrink-0">{parts.isDaytime ? "\u2600\uFE0F" : "\u{1F31C}"}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{item.city}</div>
                          <div className="text-[10px] text-gray-400 truncate">{"country" in item ? (item as typeof ALL_CITIES[0]).country : item.tz}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="text-sm font-mono font-semibold text-gray-900">{parts.time}</div>
                        <div className="text-[10px] text-gray-400">{parts.date}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between text-[10px] text-gray-400">
              <span>Click outside to close</span>
              <span className="flex items-center gap-1">{new Date(now).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })} your time</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
