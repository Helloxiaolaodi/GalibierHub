"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useCallback, useState } from "react";
import { getBrowserSupabase } from "@/utils/supabase-browser";

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "your email address";
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResend = useCallback(async () => {
    if (!email || !email.includes("@")) return;
    setResending(true);
    setError(null);
    try {
      const sb = getBrowserSupabase();
      if (!sb) throw new Error("Client not initialized");
      const { error: sbError } = await sb.auth.resend({
        type: "signup",
        email: email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (sbError) throw new Error(sbError.message);
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend.");
    } finally {
      setResending(false);
    }
  }, [email]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] px-4">
      <div className="w-full max-w-md text-center">
        {/* Envelope icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
          <svg className="h-10 w-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h1>
        <p className="text-sm text-gray-600 mb-6">
          A confirmation link has been sent to{" "}
          <strong className="text-slate-800">{email}</strong>. Click the link in the email to activate your account, then you can sign in.
        </p>

        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 mb-6 text-left">
          <p className="text-xs font-medium text-amber-800 mb-1">Didn&apos;t receive the email?</p>
          <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
            <li>Check your <strong>spam</strong> or <strong>junk</strong> folder.</li>
            <li>Make sure <strong>{email}</strong> is spelled correctly.</li>
            <li>It may take a few minutes to arrive.</li>
            <li>If you still can&apos;t find it, you can request a new one below.</li>
          </ul>
        </div>

        {resent && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 mb-4">
            A new confirmation email has been sent. Please check your inbox.
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleResend}
            disabled={resending}
            className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {resending ? "Sending..." : "Resend confirmation email"}
          </button>

          <Link
            href="/discussions"
            className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors text-center"
          >
            Go to Discussions
          </Link>

          <Link
            href="/"
            className="block text-xs text-slate-600 hover:text-slate-800 font-medium hover:underline"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>}>
      <CheckEmailContent />
    </Suspense>
  );
}
