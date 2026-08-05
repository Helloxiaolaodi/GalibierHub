import type { Metadata } from "next";
import Link from "next/link";
import ThemeToggle from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Security Policy - GalibierHub",
  description: "GalibierHub vulnerability disclosure and coordinated security response policy.",
};

export default function SecurityPolicyPage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-700">
            Back to GalibierHub
          </Link>
          <ThemeToggle />
        </div>

        <div className="mt-6">
          <h1 className="text-2xl font-bold text-gray-900">Security Policy</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            GalibierHub coordinates security issues privately and follows a responsible disclosure
            process. This page is linked from the site&apos;s <code>.well-known/security.txt</code> file.
          </p>
        </div>

        <section className="mt-8 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold text-gray-900">Report a Vulnerability</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Use the GitHub Security Advisories page or email the maintainer directly. Include the
            affected URL, relevant versions, reproduction steps, impact, and any remediation notes.
          </p>
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
              <a className="text-teal-700 hover:underline" href="https://github.com/Helloxiaolaodi/GalibierHub/security/advisories">
                GitHub Security Advisories
              </a>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
              <a className="text-teal-700 hover:underline" href="mailto:yanglun2019@126.com">
                yanglun2019@126.com
              </a>
            </div>
          </div>
        </section>

        <section className="mt-8 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold text-gray-900">Response and Disclosure</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Reports are acknowledged within three business days. We follow coordinated disclosure,
            so validated reports are not published publicly until the maintainer has had a reasonable
            opportunity to prepare a fix.
          </p>
        </section>

        <section className="mt-8 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold text-gray-900">Scope and Safe Harbor</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Testing is limited to GalibierHub application code, public routes, and the documented
            Supabase, Cloudflare, Vercel, and Hugging Face integration points. Do not disrupt other
            users, destroy data, or access private production data outside the scope of a report.
          </p>
        </section>

        <div className="mt-8 border-t border-gray-200 pt-5 text-sm text-gray-500">
          <Link className="hover:text-gray-700" href="/acknowledgments">
            View security acknowledgments
          </Link>
        </div>
      </div>
    </main>
  );
}
