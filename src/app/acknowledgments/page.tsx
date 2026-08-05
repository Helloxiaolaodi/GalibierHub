import type { Metadata } from "next";
import Link from "next/link";
import ThemeToggle from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Security Acknowledgments - GalibierHub",
  description: "Public acknowledgments for validated GalibierHub security reports.",
};

export default function SecurityAcknowledgmentsPage() {
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
          <h1 className="text-2xl font-bold text-gray-900">Security Acknowledgments</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            This page recognizes researchers who report validated security issues after coordinated
            disclosure is complete.
          </p>
        </div>

        <section className="mt-8 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold text-gray-900">Submission</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Please report through the{" "}
            <a className="text-teal-700 hover:underline" href="https://github.com/Helloxiaolaodi/GalibierHub/security/advisories">
              GitHub Security Advisories
            </a>{" "}
            page or by email to{" "}
            <a className="text-teal-700 hover:underline" href="mailto:yanglun2019@126.com">
              yanglun2019@126.com
            </a>
            . Validated reporters may be listed here after the issue is resolved.
          </p>
        </section>

        <div className="mt-8 border-t border-gray-200 pt-5 text-sm text-gray-500">
          <Link className="hover:text-gray-700" href="/security">
            Read the security policy
          </Link>
        </div>
      </div>
    </main>
  );
}
