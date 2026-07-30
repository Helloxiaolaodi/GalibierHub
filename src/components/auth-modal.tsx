"use client";

import { useCallback, useState } from "react";
import { getBrowserSupabase } from "@/utils/supabase-browser";

type AuthMode = "github" | "email-login" | "email-signup" | "forgot-password";

export default function AuthModal({
  open,
  onClose,
  onSignInError,
}: {
  open: boolean;
  onClose: () => void;
  onSignInError?: (msg: string) => void;
}) {
  const [mode, setMode] = useState<AuthMode>("github");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const handleGithubSignIn = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const sb = getBrowserSupabase();
      if (!sb) {
        setAuthError("Supabase client not initialized. Check environment variables.");
        return;
      }
      const { error } = await sb.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: window.location.origin },
      });
      if (error) {
        if (error.message?.includes("not enabled") || error.message?.includes("provider")) {
          setAuthError("GitHub OAuth is not enabled. Enable it under Authentication -> Sign In / Providers in Supabase.");
        } else {
          setAuthError(error.message);
        }
        onSignInError?.(error.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "GitHub sign-in failed.";
      setAuthError(msg);
      onSignInError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [onSignInError]);

  const handleEmailSignIn = useCallback(async () => {
    if (!email || !password) {
      setAuthError("Please enter both email and password.");
      return;
    }
    setLoading(true);
    setAuthError(null);
    try {
      const sb = getBrowserSupabase();
      if (!sb) {
        setAuthError("Supabase client not initialized.");
        return;
      }
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setAuthError(error.message);
      } else {
        onClose();
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }, [email, password, onClose]);

  const handleEmailSignUp = useCallback(async () => {
    if (!email || !password) {
      setAuthError("Please enter both email and password.");
      return;
    }
    if (password.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setAuthError(null);
    try {
      const sb = getBrowserSupabase();
      if (!sb) {
        setAuthError("Supabase client not initialized.");
        return;
      }
      const { error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        setAuthError(error.message);
      } else {
        setSignupSuccess(true);
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Sign-up failed.");
    } finally {
      setLoading(false);
    }
  }, [email, password, confirmPassword, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-slate-800">Sign in to GalibierHub</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => { setMode("github"); setAuthError(null); setSignupSuccess(false); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${mode === "github" ? "text-slate-800 border-b-2 border-slate-800" : "text-gray-500 hover:text-gray-700"}`}
          >
            <svg className="inline-block h-4 w-4 mr-1.5 -mt-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            GitHub
          </button>
          <button
            onClick={() => { setMode("email-login"); setAuthError(null); setSignupSuccess(false); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${mode.startsWith("email") ? "text-slate-800 border-b-2 border-slate-800" : "text-gray-500 hover:text-gray-700"}`}
          >
            <svg className="inline-block h-4 w-4 mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Email
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {mode === "github" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Sign in with your GitHub account to access discussions, notifications, and community features.</p>
              {authError && (
                <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{authError}</div>
              )}
              <button
                onClick={handleGithubSignIn}
                disabled={loading}
                className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                ) : (
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                )}
                {loading ? "Redirecting..." : "Continue with GitHub"}
              </button>
            </div>
          )}

          {(mode === "email-login" || mode === "email-signup") && (
            <div className="space-y-4">
              {signupSuccess ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    <p className="font-medium">Check your email</p>
                    <p className="mt-1">A confirmation link has been sent to <strong>{email}</strong>. Click the link to activate your account, then sign in.</p>
                  </div>
                  <button onClick={() => { setSignupSuccess(false); setMode("email-login"); }} className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Email address</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors"
                        autoComplete="email" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors"
                        autoComplete={mode === "email-signup" ? "new-password" : "current-password"} />
                    </div>
                    {mode === "email-signup" && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Confirm password</label>
                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors"
                          autoComplete="new-password" />
                      </div>
                    )}
                  </div>

                  {authError && (
                    <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{authError}</div>
                  )}

                  <button
                    onClick={mode === "email-login" ? handleEmailSignIn : handleEmailSignUp}
                    disabled={loading}
                    className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {loading && <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                    {mode === "email-login" ? (loading ? "Signing in..." : "Sign In with Email") : (loading ? "Creating account..." : "Create Account")}
                  </button>

                  <p className="text-center text-xs text-gray-500">
                    {mode === "email-login" ? (
                      <>No account? <button onClick={() => { setMode("email-signup"); setAuthError(null); }} className="text-slate-700 font-medium hover:underline">Sign up</button></>
                    ) : (
                      <>Already have an account? <button onClick={() => { setMode("email-login"); setAuthError(null); }} className="text-slate-700 font-medium hover:underline">Sign in</button></>
                    )}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
