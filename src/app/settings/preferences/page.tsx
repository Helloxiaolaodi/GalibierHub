"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabase } from "@/utils/supabase-browser";
import type { Session } from "@supabase/supabase-js";

export default function PreferencesPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Profile fields
  const [displayName, setDisplayName] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [researchField, setResearchField] = useState("");
  const [role, setRole] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Email notification prefs
  const [emailReply, setEmailReply] = useState(true);
  const [emailMention, setEmailMention] = useState(true);
  const [emailNewsletter, setEmailNewsletter] = useState(false);

  // Theme
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Check auth + load profile
  useEffect(() => {
    const init = async () => {
      const sb = getBrowserSupabase();
      if (!sb) { setLoading(false); return; }
      const { data } = await sb.auth.getSession();
      if (!data.session) {
        router.push("/");
        return;
      }
      setSession(data.session);

      const userId = data.session.user.id;
      // Try from profiles table
      const { data: profile } = await sb.from("profiles").select("*").eq("id", userId).single();
      if (profile) {
        setDisplayName(profile.display_name || "");
        setAffiliation(profile.affiliation || "");
        setResearchField(profile.research_field || "");
        setRole(profile.role || "");
        setBio(profile.bio || "");
        setAvatarUrl(profile.avatar_url || null);
      } else {
        // Fallback to localStorage
        setAffiliation(localStorage.getItem("galibierhub-affiliation") || "");
        setResearchField(localStorage.getItem("galibierhub-research-field") || "");
        setRole(localStorage.getItem("galibierhub-role") || "");
        setBio(localStorage.getItem("galibierhub-bio") || "");
      }

      // Load prefs from localStorage
      setTheme((localStorage.getItem("galibierhub-theme") as "light" | "dark" | "system") || "system");
      setEmailReply(localStorage.getItem("galibierhub-email-reply") !== "false");
      setEmailMention(localStorage.getItem("galibierhub-email-mention") !== "false");
      setEmailNewsletter(localStorage.getItem("galibierhub-email-newsletter") === "true");

      setLoading(false);
    };
    init();
  }, [router]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const sb = getBrowserSupabase();

      // Save to localStorage
      localStorage.setItem("galibierhub-affiliation", affiliation);
      localStorage.setItem("galibierhub-research-field", researchField);
      localStorage.setItem("galibierhub-role", role);
      localStorage.setItem("galibierhub-bio", bio);
      localStorage.setItem("galibierhub-theme", theme);
      localStorage.setItem("galibierhub-email-reply", String(emailReply));
      localStorage.setItem("galibierhub-email-mention", String(emailMention));
      localStorage.setItem("galibierhub-email-newsletter", String(emailNewsletter));

      // Save to Supabase profiles if user exists
      if (sb && session?.user) {
        const userId = session.user.id;
        const { data: existing } = await sb.from("profiles").select("id").eq("id", userId).single();
        const payload = {
          id: userId,
          display_name: displayName,
          affiliation,
          research_field: researchField,
          role,
          bio,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        };
        if (existing) {
          await sb.from("profiles").update(payload).eq("id", userId);
        } else {
          await sb.from("profiles").insert(payload);
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }, [affiliation, researchField, role, bio, theme, emailReply, emailMention, emailNewsletter, displayName, avatarUrl, session]);

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch("/api/upload-image", { method: "POST", body: formData });
      const data = await resp.json() as { url?: string; error?: string };
      if (data.url) {
        setAvatarUrl(data.url);
        localStorage.setItem("galibierhub-avatar-url", data.url);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to upload avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  }, []);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-slate-300 border-t-slate-600 rounded-full"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Back nav */}
        <Link href="/" className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 mb-4">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Home
        </Link>

        <h1 className="text-xl font-semibold text-slate-800 mb-6">Settings</h1>

        {/* Edit Profile */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Edit Profile</h2>
          <div className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border-2 border-gray-100">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-slate-500 text-lg font-semibold">
                    {displayName ? displayName.substring(0, 2).toUpperCase() : "?"}
                  </span>
                )}
              </div>
              <label className="inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">
                {uploadingAvatar ? "Uploading..." : "Change Avatar"}
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </label>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Display Name</label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors" />
            </div>

            {/* Affiliation */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Affiliation</label>
              <input type="text" value={affiliation} onChange={(e) => setAffiliation(e.target.value)} placeholder="e.g., Stanford University"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors" />
            </div>

            {/* Research Field */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Research Field</label>
              <input type="text" value={researchField} onChange={(e) => setResearchField(e.target.value)} placeholder="e.g., Gut Microbiome"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors" />
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g., Researcher, PI"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors" />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bio</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="Tell others about yourself..."
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors resize-y" />
            </div>
          </div>
        </div>

        {/* Interface Theme */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Interface</h2>
          <div className="flex gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                  theme === t
                    ? "bg-slate-800 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Email Settings */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Email Notifications</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={emailReply} onChange={(e) => setEmailReply(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-slate-800 focus:ring-slate-400" />
              <span className="text-sm text-gray-700">Email me when someone replies to my posts</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={emailMention} onChange={(e) => setEmailMention(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-slate-800 focus:ring-slate-400" />
              <span className="text-sm text-gray-700">Email me when someone @mentions me</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={emailNewsletter} onChange={(e) => setEmailNewsletter(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-slate-800 focus:ring-slate-400" />
              <span className="text-sm text-gray-700">Send me platform updates and newsletters</span>
            </label>
          </div>
        </div>

        {/* Error / Success */}
        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>
        )}
        {saved && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 mb-4">Settings saved successfully.</div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {saving && (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
