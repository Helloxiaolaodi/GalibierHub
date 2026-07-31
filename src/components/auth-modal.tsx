"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/utils/supabase-browser";
import TurnstileWidget from "@/components/turnstile-widget";

type AuthMode = "github" | "google" | "email-login" | "email-signup" | "forgot-password";

export default function AuthModal({
  open,
  onClose,
  onSignInError,
  initialMode = "github",
}: {
  open: boolean;
  onClose: () => void;
  onSignInError?: (msg: string) => void;
  initialMode?: "github" | "email-signup" | "email-login";
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // Reset mode when modal opens with new initialMode
  useEffect(() => { if (open) { setMode(initialMode); setAuthError(null); setSignupSuccess(false); } }, [open, initialMode]);

  useEffect(() => {
    if (open) setTurnstileToken(null);
  }, [open, mode]);

  const verifyAuthChallenge = useCallback(async (action: string): Promise<string | null> => {
    if (!turnstileToken) {
      return "Please complete the human verification checkbox before continuing.";
    }
    try {
      const response = await fetch("/api/auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: turnstileToken, action }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        return data.error || "Human verification failed. Please try again.";
      }
      return null;
    } catch {
      return "Human verification failed. Please try again.";
    }
  }, [turnstileToken]);

  const handleGithubSignIn = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const sb = getBrowserSupabase();
      if (!sb) {
        setAuthError("Supabase client not initialized. Check environment variables.");
        return;
      }
      const verifyError = await verifyAuthChallenge("auth-github");
      if (verifyError) {
        setAuthError(verifyError);
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
  }, [onSignInError, verifyAuthChallenge]);

  const handleGoogleSignIn = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const sb = getBrowserSupabase();
      if (!sb) {
        setAuthError("Supabase client not initialized.");
        return;
      }
      const verifyError = await verifyAuthChallenge("auth-google");
      if (verifyError) {
        setAuthError(verifyError);
        return;
      }
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) {
        if (error.message?.includes("not enabled") || error.message?.includes("provider")) {
          setAuthError("Google OAuth is not enabled. Enable it under Authentication -> Sign In / Providers in Supabase.");
        } else {
          setAuthError(error.message);
        }
        onSignInError?.(error.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed.";
      setAuthError(msg);
      onSignInError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [onSignInError, verifyAuthChallenge]);

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
      const verifyError = await verifyAuthChallenge("auth-email-login");
      if (verifyError) {
        setAuthError(verifyError);
        return;
      }
      const { data: signInData, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setAuthError(error.message);
      } else {
        const userId = signInData.session?.user?.id;
        const username = email.trim().split("@")[0] || "user";
        if (userId) {
          try {
            const { data: existingProfile } = await sb
              .from("profiles")
              .select("id")
              .eq("id", userId)
              .maybeSingle();
            if (!existingProfile) {
              await sb.from("profiles").insert({
                id: userId,
                username,
                display_name: username,
                full_name: username,
                email: email.trim(),
              });
            }
          } catch {}
        }
        onClose();
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }, [email, password, onClose, verifyAuthChallenge]);

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
      const verifyError = await verifyAuthChallenge("auth-email-signup");
      if (verifyError) {
        setAuthError(verifyError);
        return;
      }
      const username = email.trim().split("@")[0] || "user";
      const { error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            username,
            display_name: username,
            full_name: username,
            name: username,
          },
        },
      });
      if (error) {
        setAuthError(error.message);
      } else {
        const emailParam = encodeURIComponent(email.trim());
        window.location.href = '/check-email?email=' + emailParam;
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Sign-up failed.");
    } finally {
      setLoading(false);
    }
  }, [email, password, confirmPassword, verifyAuthChallenge]);

  const handleForgotPassword = useCallback(async () => {
    if (!email || !email.includes("@")) {
      setAuthError("Please enter your email address first.");
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
      const verifyError = await verifyAuthChallenge("auth-forgot-password");
      if (verifyError) {
        setAuthError(verifyError);
        return;
      }
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: "https://galibierhub.org/update-password",
      });
      if (error) {
        setAuthError(error.message);
      } else {
        const emailParam = encodeURIComponent(email.trim());
        window.location.href = '/check-email?email=' + emailParam;
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  }, [email, verifyAuthChallenge]);

  if (!open) return null;

  const isOAuthMode = mode === "github" || mode === "google";
  const isEmailMode = mode === "email-login" || mode === "email-signup" || mode === "forgot-password";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-slate-800">
            {mode === "forgot-password" ? "Reset your password" : mode === "email-signup" ? "Create your account" : "Sign in to GalibierHub"}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => { setMode("github"); setAuthError(null); setSignupSuccess(false); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${isOAuthMode ? "text-slate-800 border-b-2 border-slate-800" : "text-gray-500 hover:text-gray-700"}`}
          >
            <svg className="inline-block h-4 w-4 mr-1.5 -mt-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            OAuth
          </button>
          <button
            onClick={() => { setMode("email-login"); setAuthError(null); setSignupSuccess(false); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${isEmailMode ? "text-slate-800 border-b-2 border-slate-800" : "text-gray-500 hover:text-gray-700"}`}
          >
            <svg className="inline-block h-4 w-4 mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Email
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* === OAuth (GitHub + Google) === */}
          {isOAuthMode && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Sign in with your {mode === "google" ? "Google" : "GitHub"} account to access discussions, notifications, and community features.</p>
              {authError && (
                <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{authError}</div>
              )}
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                <p className="mb-2 text-xs font-medium text-gray-600">Please verify you are human before continuing.</p>
                <TurnstileWidget
                  onToken={setTurnstileToken}
                  action={mode === "google" ? "auth-google" : "auth-github"}
                />
              </div>
              {/* GitHub button */}
              <button
                onClick={handleGithubSignIn}
                disabled={loading || !turnstileToken}
                className="w-full rounded-xl bg-[#24292e] px-4 py-3 text-sm font-medium text-white hover:bg-[#1b1f23] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                ) : (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                )}
                {loading ? "Redirecting..." : "Continue with GitHub"}
              </button>
              {/* Google button */}
              <button
                onClick={handleGoogleSignIn}
                disabled={loading || !turnstileToken}
                className="w-full rounded-xl bg-white border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                )}
                {loading ? "Redirecting..." : "Continue with Google"}
              </button>
            </div>
          )}

          {/* === Email: Login, Signup, Forgot Password === */}
          {isEmailMode && (
            <div className="space-y-4">
              {signupSuccess ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    <p className="font-medium">{mode === "forgot-password" ? "Password reset email sent" : "Check your email"}</p>
                    <p className="mt-1">{mode === "forgot-password" ? "A password reset link has been sent to" : "A confirmation link has been sent to"} <strong>{email}</strong>. {mode === "forgot-password" ? "Click the link to set a new password." : "Click the link to activate your account, then sign in."}</p>
                  </div>
                  <button onClick={() => { setSignupSuccess(false); setMode("email-login"); }} className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    Back to Sign In
                  </button>
                </div>
              ) : mode === "forgot-password" ? (
                /* Forgot Password View */
                <>
                  <p className="text-sm text-gray-600">Enter your email and we&apos;ll send you a link to reset your password.</p>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email address</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors"
                      autoComplete="email" />
                  </div>
                  {authError && (
                    <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{authError}</div>
                  )}
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                    <p className="mb-2 text-xs font-medium text-gray-600">Please verify you are human before continuing.</p>
                    <TurnstileWidget
                      onToken={setTurnstileToken}
                      action="auth-forgot-password"
                    />
                  </div>
                  <button onClick={handleForgotPassword} disabled={loading || !turnstileToken}
                    className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {loading && <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                    {loading ? "Sending..." : "Send Reset Link"}
                  </button>
                  <button onClick={() => { setMode("email-login"); setAuthError(null); }} className="w-full text-center text-xs text-slate-600 hover:text-slate-800 font-medium hover:underline">
                    Back to Sign In
                  </button>
                </>
              ) : (
                /* Login / Signup View */
                <>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Email address</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors"
                        autoComplete="email" />
                    </div>
                    <div className="relative">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                      <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters"
                        className="w-full rounded-lg border border-gray-200 bg-white pl-3 pr-10 py-2.5 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors"
                        autoComplete={mode === "email-signup" ? "new-password" : "current-password"} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 focus:outline-none">
                        {showPassword ? (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243 3 3 0 01-4.243-4.243zM9.878 9.878l4.242 4.242"/></svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>
                    {mode === "email-signup" && (
                      <div className="relative">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Confirm password</label>
                        <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-white pl-3 pr-10 py-2.5 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors"
                          autoComplete="new-password" />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 focus:outline-none">
                          {showConfirmPassword ? (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243 3 3 0 01-4.243-4.243zM9.878 9.878l4.242 4.242"/></svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {authError && (
                    <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{authError}</div>
                  )}

                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                    <p className="mb-2 text-xs font-medium text-gray-600">Please verify you are human before continuing.</p>
                    <TurnstileWidget
                      onToken={setTurnstileToken}
                      action={mode === "email-signup" ? "auth-email-signup" : "auth-email-login"}
                    />
                  </div>

                  <button
                    onClick={mode === "email-login" ? handleEmailSignIn : handleEmailSignUp}
                    disabled={loading || !turnstileToken}
                    className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {loading && <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                   {mode === "email-login" ? (loading ? "Signing in..." : "Sign In with Email") : (loading ? "Creating account..." : "Create Account")}
                  </button>

                  {mode === "email-login" && (
                    <p className="text-center">
                      <button
                        type="button"
                        onClick={() => { setMode("forgot-password"); setAuthError(null); setSignupSuccess(false); }}
                        className="text-xs text-slate-600 hover:text-slate-800 font-medium hover:underline"
                      >
                        Forgot password?
                      </button>
                    </p>
                  )}

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
