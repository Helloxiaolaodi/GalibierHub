"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/utils/supabase-browser";

const RESEARCH_FIELDS = [
  "Nutrition and Food Hygiene",
  "Gut Microbiome",
  "Oral Microbiome",
  "Metagenomics",
  "Metabolomics",
  "Bioinformatics",
  "Computational Biology",
  "Systems Biology",
  "Epidemiology",
  "Immunology",
  "Environmental Microbiology",
  "Clinical Research",
  "Pharmacomicrobiomics",
  "Genomics",
  "Transcriptomics",
  "Proteomics",
];

const PREFERRED_TOOLS = [
  "R", "Python", "QIIME 2", "MaAsLin3", "LEfSe",
  "BLAST", "MEGAN", "Kraken2", "HUMAnN", "MetaPhlAn",
  "DADA2", "phyloseq", "DESeq2", "edgeR", "STAR",
  "Bowtie2", "GATK", "DeepVariant", "JBrowse", "IGV",
  "Snakemake", "Nextflow", "Slurm", "Docker",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [researchField, setResearchField] = useState("");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [affiliation, setAffiliation] = useState("");
  const [bio, setBio] = useState("");

  // Check authentication
  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) { setLoading(false); return; }
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace("/"); return; }
      setSession(data.session);
      // Check if user already onboarded
      sb.from("profiles").select("onboarded").eq("id", data.session.user.id).single().then(({ data: profile }) => {
        if (profile?.onboarded) { router.replace("/"); }
      }, () => {});
      setLoading(false);
    });
  }, [router]);

  const toggleTool = useCallback((tool: string) => {
    setSelectedTools((prev) => prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!researchField) { setError("Please select a research field."); return; }
    if (!session?.user?.id) { setError("Not authenticated."); return; }

    setSaving(true);
    setError(null);

    try {
      const sb = getBrowserSupabase();
      if (!sb) throw new Error("Supabase client not available");

      const userId = session.user.id;
      const displayName = session.user.user_metadata?.full_name || session.user.user_metadata?.user_name || session.user.email?.split("@")[0] || "User";

      const { error: upsertErr } = await sb.from("profiles").upsert({
        id: userId,
        display_name: displayName,
        research_field: researchField,
        preferred_tools: selectedTools,
        affiliation: affiliation,
        bio: bio,
        onboarded: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

      if (upsertErr) throw new Error(upsertErr.message);

      // Save to localStorage for immediate UI sync
      localStorage.setItem("galibierhub-affiliation", affiliation);
      localStorage.setItem("galibierhub-research-field", researchField);
      localStorage.setItem("galibierhub-bio", bio);

      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }, [researchField, selectedTools, affiliation, bio, session, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-lg p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 mb-4">
            <svg className="h-7 w-7 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-slate-800">Welcome to GalibierHub</h1>
          <p className="text-sm text-gray-500 mt-2">Personalize your profile to connect with the community.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Research Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Research Field</label>
            <select
              value={researchField}
              onChange={(e) => setResearchField(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors"
              required
            >
              <option value="">Select your research field...</option>
              {RESEARCH_FIELDS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Preferred Tools */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Tools (select all that apply)</label>
            <div className="flex flex-wrap gap-2">
              {PREFERRED_TOOLS.map((tool) => (
                <button
                  key={tool}
                  type="button"
                  onClick={() => toggleTool(tool)}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selectedTools.includes(tool)
                      ? "bg-slate-800 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {tool}
                </button>
              ))}
            </div>
            {selectedTools.length > 0 && (
              <p className="text-xs text-gray-400 mt-2">{selectedTools.length} tool{selectedTools.length > 1 ? "s" : ""} selected</p>
            )}
          </div>

          {/* Affiliation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Affiliation / Institution</label>
            <input
              type="text"
              value={affiliation}
              onChange={(e) => setAffiliation(e.target.value)}
              placeholder="e.g. Peking University, NIH, EMBL..."
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bio (optional)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="A short introduction about yourself and your research interests..."
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-colors resize-y"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <button
            type="submit"
            disabled={saving || !researchField}
            className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {saving ? "Saving..." : "Complete Profile"}
          </button>

          <p className="text-center text-xs text-gray-400">
            You can update these anytime in Settings.
            <button type="button" onClick={() => router.push("/")} className="ml-1 text-slate-600 hover:underline">Skip for now</button>
          </p>
        </form>
      </div>
    </div>
  );
}