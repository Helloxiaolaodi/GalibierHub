import Link from "next/link";

export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5 shrink-0" aria-label="GalibierHub home">
      <svg
        viewBox="0 0 64 64"
        aria-hidden="true"
        className={`${compact ? "h-7 w-7" : "h-8 w-8"} shrink-0 rounded-md shadow-sm transition-transform group-hover:scale-[1.03]`}
      >
        <rect
          width="64"
          height="64"
          rx="10"
          style={{ fill: "var(--color-surface)", stroke: "var(--color-border)" }}
        />
        <path d="M16 52V12h32v18H26v8h14v14H16z" style={{ fill: "var(--color-text)" }} />
        <path
          d="M30 46 40 34 34 28 46 18"
          style={{ stroke: "var(--color-accent)", strokeWidth: 5 }}
          fill="none"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      </svg>
      <span className="text-lg font-bold leading-none" style={{ color: "var(--color-text)" }}>
        Galibier<span className="font-normal" style={{ color: "var(--color-accent)" }}>Hub</span>
      </span>
    </Link>
  );
}
