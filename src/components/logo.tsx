import Link from "next/link";

export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5 shrink-0" aria-label="GalibierHub home">
      <img
        src="/galibierhub-logo.svg"
        alt=""
        width={compact ? 28 : 32}
        height={compact ? 28 : 32}
        className={`${compact ? "h-7 w-7" : "h-8 w-8"} shrink-0 rounded-md shadow-sm transition-transform group-hover:scale-[1.03]`}
      />
      <span className="text-lg font-bold leading-none text-slate-900">
        Galibier<span className="font-normal text-blue-600">Hub</span>
      </span>
    </Link>
  );
}
