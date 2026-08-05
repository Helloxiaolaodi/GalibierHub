"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/theme-toggle";

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-600 ${className ?? ""}`}
      title="Copy code"
    >
      {copied ? (
        <><svg className="h-3 w-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg><span className="text-emerald-600">Copied!</span></>
      ) : (
        <><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>Copy</>
      )}
    </button>
  );
}

function TabbedCode({ tabs }: { tabs: { label: string; lang: string; code: string }[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="group/code my-5 overflow-hidden rounded-lg border border-[var(--color-border)] shadow-sm">
      <div className="flex items-center border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
        <div className="flex flex-1">
          {tabs.map((t, i) => (
            <button
              key={t.label}
              onClick={() => setActive(i)}
              className={`px-4 py-2.5 text-xs font-medium transition-colors ${i === active ? "border-b-2 border-[var(--color-accent)] bg-[var(--color-surface)] text-[var(--color-text)]" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-[var(--color-text-muted)] dark:hover:text-[var(--color-text-secondary)] dark:hover:bg-[var(--color-surface-muted)]"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <CopyButton text={tabs[active].code} />
      </div>
      <div className="overflow-x-auto bg-[var(--color-surface-muted)] px-5 py-4">
        <pre className="text-[13px] leading-7 text-gray-800"><code>{tabs[active].code}</code></pre>
      </div>
    </div>
  );
}

function TerminalBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="group my-4 overflow-hidden rounded-lg border border-gray-700 shadow-sm">
      <div className="flex items-center gap-1.5 bg-gray-800 px-4 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[11px] text-gray-400">Output</span>
      </div>
      <div className="overflow-x-auto bg-gray-900 px-5 py-3">
        <pre className="text-[13px] leading-7 text-emerald-400"><code>{children}</code></pre>
      </div>
    </div>
  );
}

function Admonition({ type, title, children }: { type: "note" | "tip" | "warning"; title: string; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    note: "border-blue-400 bg-blue-50 text-blue-900",
    tip: "border-emerald-400 bg-emerald-50 text-emerald-900",
    warning: "border-amber-400 bg-amber-50 text-amber-900",
  };
  const icons: Record<string, string> = { note: "\u2139\uFE0F", tip: "\uD83D\uDCA1", warning: "\u26A0\uFE0F" };
  return (
    <div className={`my-5 rounded-lg border-l-4 p-4 ${styles[type]}`}>
      <p className="mb-1 text-sm font-semibold"><span className="mr-1.5">{icons[type]}</span>{title}</p>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function StepHeading({ id, step, title }: { id: string; step: string; title: string }) {
  return (
    <h2 id={id} className="group scroll-mt-20 flex items-baseline gap-3 border-b border-gray-200 pb-3 pt-2">
      <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-bold text-white">{step}</span>
      <a href={`#${id}`} className="text-lg font-bold text-gray-900 no-underline hover:underline decoration-gray-300 underline-offset-4">
        {title}
        <span className="ml-2 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity text-base font-normal">#</span>
      </a>
    </h2>
  );
}

const SECTIONS = [
  { id: "option-1-download-to-browser", label: "Download to Browser", step: "1" },
  { id: "option-2-command-line-interface", label: "CLI", step: "2" },
  { id: "option-3-file-integrity-verification", label: "Integrity Check", step: "3" },
  { id: "option-4-cluster-batch-download", label: "Cluster Batch", step: "4" },
  { id: "records-folder", label: "Records Folder", step: "\u2B50" },
];

export default function DownloadCliGuidePage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{id:string;label:string;snippet:string}[]>([]);
  const [activeSection, setActiveSection] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px" }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const doSearch = useCallback((q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    const lower = q.toLowerCase();
    const hits: {id:string;label:string;snippet:string}[] = [];
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) {
        const text = el.parentElement?.innerText || "";
        if (text.toLowerCase().includes(lower)) {
          const idx = text.toLowerCase().indexOf(lower);
          const start = Math.max(0, idx - 40);
          const end = Math.min(text.length, idx + q.length + 40);
          hits.push({ id: s.id, label: s.label, snippet: "..." + text.slice(start, end).replace(/\n/g, " ") + "..." });
        }
      }
    });
    setSearchResults(hits);
  }, []);

  const jumpTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); setSearchOpen(false); setSearchQuery(""); setSearchResults([]); }
  }, []);

  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/20 bg-white/70 px-4 py-2.5 backdrop-blur-xl saturate-150 shadow-sm dark:bg-[#16203A]/80 dark:border-[#334155]/90 sm:px-6 lg:px-8">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Download &amp; CLI Usage Guide</span>
        <ThemeToggle />
      </header>

      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-16" onClick={() => setSearchOpen(false)}>
          <div className="w-full max-w-xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input ref={searchInputRef} value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); doSearch(e.target.value); }} placeholder="Search this guide..." className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400" autoFocus />
              <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[10px] font-mono text-gray-500">ESC</kbd>
            </div>
            {searchResults.length > 0 && (
              <div className="max-h-72 overflow-y-auto px-4 py-2">
                {searchResults.map((r) => (
                  <button key={r.id} onClick={() => jumpTo(r.id)} className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left hover:bg-slate-50">
                    <span className="text-sm font-medium text-gray-900">{r.label}</span>
                    <span className="text-xs text-gray-500 line-clamp-1">{r.snippet}</span>
                  </button>
                ))}
              </div>
            )}
            {searchQuery.trim() && searchResults.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-500">No results found.</div>
            )}
            <div className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400">Press <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-1 py-0.5 font-mono text-[10px]">Ctrl</kbd>+<kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-1 py-0.5 font-mono text-[10px]">F</kbd> to open search at any time</div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
        <Link href="/" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          Back to GalibierHub
        </Link>

        <div className="mt-6 flex gap-8">
          <div ref={contentRef} className="min-w-0 flex-1 max-w-3xl">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm sm:p-10">
              <h1 className="text-2xl font-bold text-gray-900">Download &amp; CLI Usage Guide</h1>
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                <span>Last updated: Aug 2026</span>
                <span className="text-gray-300">|</span>
                <span>5 min read</span>
              </div>
              <p className="mt-4 text-sm leading-7 text-gray-600">Use the Downloads interface to save individual files, generate command-line commands, or run batch downloads on a cluster. This guide walks through each workflow using <Link href="/downloads/?folder=Learning-Resources&select=rrnDB-5.10_16S_rRNA.fasta" className="font-mono text-blue-700 underline decoration-blue-300 hover:bg-blue-50 hover:text-blue-900 transition-colors">rrnDB-5.10_16S_rRNA.fasta</Link> (419 MB) as a running example.</p>

              <Admonition type="note" title="About the Records Folder">The <strong>Records</strong> folder in Downloads is specifically the collection of all files shown in the Records interface. Files inside it can be downloaded, selected, exported, and batch-downloaded exactly like files in other Downloads folders.</Admonition>

              <div className="mt-12 rounded-xl border border-gray-100 bg-[var(--color-surface-muted)] p-5 sm:p-6">
                <StepHeading id="option-1-download-to-browser" step="1" title="Download to Browser" />
                <p className="mt-3 text-sm leading-7 text-gray-700">The simplest way to obtain a file is directly through your web browser. This method is ideal for single files or users who are not comfortable with the command line.</p>
                <p className="mt-3 text-sm leading-7 text-gray-700">For this example, let us locate <Link href="/downloads/?folder=Learning-Resources&select=rrnDB-5.10_16S_rRNA.fasta" className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-blue-700 underline decoration-blue-300 hover:bg-blue-50 hover:text-blue-900 transition-colors">rrnDB-5.10_16S_rRNA.fasta</Link> (419 MB) in the <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-800">Learning-Resources</code> directory.</p>
                <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-7 text-gray-700">
                  <li>Find the file in the Downloads file list. You can expand a folder to browse its contents.</li>
                  <li>Click the dark <strong>Download to Browser</strong> button next to the file.</li>
                  <li>In the popup window, select your <strong>Network Routing</strong>:
                    <ul className="mt-1 list-disc pl-5 text-gray-600">
                      <li><strong>Global (Official)</strong> connects to <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[11px] text-gray-800">huggingface.co</code></li>
                      <li><strong>Asia-Pacific (Mirror)</strong> uses <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[11px] text-gray-800">hf-mirror.com</code>, recommended for users in China and nearby regions</li>
                    </ul>
                  </li>
                </ol>
                <Admonition type="tip" title="Slow speeds in Asia?">If you are accessing the site from China or nearby regions and experiencing slow speeds on Global (Official), switch to Asia-Pacific (Mirror) for a significant speed improvement.</Admonition>
              </div>

              <div className="mt-12 rounded-xl border border-gray-100 bg-[var(--color-surface-muted)] p-5 sm:p-6">
                <StepHeading id="option-2-command-line-interface" step="2" title="Command Line Interface (CLI)" />
                <p className="mt-3 text-sm leading-7 text-gray-700">For large files like our 419 MB example, or when working directly on a Linux server, using the CLI is highly recommended. The GalibierHub interface provides ready-to-use commands tailored to your operating system.</p>
                <p className="mt-3 text-sm leading-7 text-gray-700">Click the white <strong>CLI</strong> button next to <Link href="/downloads/?folder=Learning-Resources&select=rrnDB-5.10_16S_rRNA.fasta" className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-blue-700 underline decoration-blue-300 hover:bg-blue-50 hover:text-blue-900 transition-colors">rrnDB-5.10_16S_rRNA.fasta</Link>. Below are the most common methods you will see in the panel:</p>
                <TabbedCode tabs={[
                  { label: "Hugging Face CLI", lang: "bash", code: "# Install the Hugging Face CLI (one-time setup)\npip install -U \"huggingface_hub[cli]\"\n\n# Download a single file (Global node)\nhf download Helloxiaolaodi/seqedge-data \\\n  Learning-Resources/rrnDB-5.10_16S_rRNA.fasta \\\n  --repo-type dataset \\\n  --local-dir .\n\n# Using Asia-Pacific mirror\nexport HF_ENDPOINT=\"https://hf-mirror.com\"\nhf download Helloxiaolaodi/seqedge-data \\\n  Learning-Resources/rrnDB-5.10_16S_rRNA.fasta \\\n  --repo-type dataset \\\n  --local-dir ." },
                  { label: "Python API", lang: "python", code: "from huggingface_hub import hf_hub_download\nimport os\n\n# Global node\npath = hf_hub_download(\n    repo_id=\"Helloxiaolaodi/seqedge-data\",\n    filename=\"Learning-Resources/rrnDB-5.10_16S_rRNA.fasta\",\n    repo_type=\"dataset\",\n    local_dir=\".\",\n)\nprint(f\"Downloaded to: {path}\")\n\n# Asia-Pacific mirror\nos.environ[\"HF_ENDPOINT\"] = \"https://hf-mirror.com\"\npath = hf_hub_download(\n    repo_id=\"Helloxiaolaodi/seqedge-data\",\n    filename=\"Learning-Resources/rrnDB-5.10_16S_rRNA.fasta\",\n    repo_type=\"dataset\",\n    local_dir=\".\",\n)" },
                  { label: "Windows PowerShell", lang: "powershell", code: "# Using curl.exe (bundled with Windows 10+)\n$url = \"https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/Learning-Resources/rrnDB-5.10_16S_rRNA.fasta\"\ncurl.exe -L -o \"rrnDB-5.10_16S_rRNA.fasta\" $url\n\n# Using Asia-Pacific mirror\n$mirrorUrl = \"https://hf-mirror.com/datasets/Helloxiaolaodi/seqedge-data/resolve/main/Learning-Resources/rrnDB-5.10_16S_rRNA.fasta\"\ncurl.exe -L -o \"rrnDB-5.10_16S_rRNA.fasta\" $mirrorUrl" },
                  { label: "wget / curl", lang: "bash", code: "# Using wget\nwget \"https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/Learning-Resources/rrnDB-5.10_16S_rRNA.fasta\" -O rrnDB-5.10_16S_rRNA.fasta\n\n# Using curl\ncurl -L \"https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main/Learning-Resources/rrnDB-5.10_16S_rRNA.fasta\" -o rrnDB-5.10_16S_rRNA.fasta\n\n# Using Asia-Pacific mirror\nwget \"https://hf-mirror.com/datasets/Helloxiaolaodi/seqedge-data/resolve/main/Learning-Resources/rrnDB-5.10_16S_rRNA.fasta\" -O rrnDB-5.10_16S_rRNA.fasta" },
                ]} />
                <Admonition type="tip" title="Resume interrupted downloads">The Hugging Face CLI (<code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[11px] text-gray-800">hf download</code>) automatically resumes interrupted downloads. Plain <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[11px] text-gray-800">wget</code>/<code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[11px] text-gray-800">curl</code> do not, so add <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[11px] text-gray-800">-c</code> or <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[11px] text-gray-800">-C -</code> respectively for resume support.</Admonition>
              </div>

              <div className="mt-12 rounded-xl border border-gray-100 bg-[var(--color-surface-muted)] p-5 sm:p-6">
                <StepHeading id="option-3-file-integrity-verification" step="3" title="File Integrity Verification" />
                <p className="mt-3 text-sm leading-7 text-gray-700">Data corruption can silently ruin downstream bioinformatics analyses. We strongly encourage verifying the integrity of large files after downloading.</p>
                <p className="mt-3 text-sm leading-7 text-gray-700">Switch to the <strong>Checksum</strong> tab in the download modal. You can copy the exact SHA-256 validation command and run it in the directory where your file was downloaded.</p>
                <TabbedCode tabs={[
                  { label: "Linux / macOS", lang: "bash", code: "# Verify SHA-256 checksum (replace the hash with the one shown in the modal)\necho \"43337ffb77551e53f00a59c2b954e683a95b87d86b937332e7345508fa961901  rrnDB-5.10_16S_rRNA.fasta\" | sha256sum -c -" },
                  { label: "Windows PowerShell", lang: "powershell", code: "# Verify SHA-256 checksum in PowerShell\n$hash = \"43337ffb77551e53f00a59c2b954e683a95b87d86b937332e7345508fa961901\"\n$result = Get-FileHash -Path \".\\rrnDB-5.10_16S_rRNA.fasta\" -Algorithm SHA256\nif ($result.Hash -eq $hash) { Write-Host \"OK: checksum verified\" } else { Write-Host \"MISMATCH: download is corrupted\" }" },
                ]} />
                <p className="mt-3 text-sm leading-7 text-gray-600">Expected output if the file is intact:</p>
                <TerminalBlock>rrnDB-5.10_16S_rRNA.fasta: OK</TerminalBlock>
                <Admonition type="note" title="Where to find the checksum">The SHA-256 checksum for each file is displayed in the CLI modal under the <strong>Checksum</strong> tab. The checksums are also available in the <strong>Cluster Batch Download</strong> manifest for bulk verification.</Admonition>
              </div>

              <div className="mt-12 rounded-xl border border-gray-100 bg-[var(--color-surface-muted)] p-5 sm:p-6">
                <StepHeading id="option-4-cluster-batch-download" step="4" title="Cluster Batch Download" />
                <p className="mt-3 text-sm leading-7 text-gray-700">When you need to download multiple genomes or an entire directory, downloading them one by one is inefficient. GalibierHub provides a built-in <strong>Cluster Batch Download</strong> tool that generates complete Python and SLURM scripts.</p>
                <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-7 text-gray-700">
                  <li>Use the checkboxes on the left to select multiple files (e.g., check <Link href="/downloads/?folder=Learning-Resources&select=rrnDB-5.10_16S_rRNA.fasta" className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-blue-700 underline decoration-blue-300 hover:bg-blue-50 hover:text-blue-900 transition-colors">rrnDB-5.10_16S_rRNA.fasta</Link> and <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-800">scov2.fa</code>).</li>
                  <li>Click the black <strong>Cluster Batch Download</strong> button at the top of the table.</li>
                  <li>A modal will appear with two tabs: <strong>Python Script</strong> and <strong>SLURM Job Script</strong>. Copy each script to your cluster.</li>
                </ol>
                <TabbedCode tabs={[
                  { label: "Python Script", lang: "python", code: "import os\nfrom huggingface_hub import snapshot_download\n\n# Asia-Pacific mirror (remove these two lines for Global node)\nos.environ[\"HF_ENDPOINT\"] = \"https://hf-mirror.com\"\nos.environ[\"HF_HUB_ENABLE_HF_TRANSFER\"] = \"1\"\n\nrepo_id = \"Helloxiaolaodi/seqedge-data\"\ntarget_folder_pattern = \"Learning-Resources/*\"\nlocal_dir = \"./\"\n\nfolder_path = snapshot_download(\n    repo_id=repo_id,\n    repo_type=\"dataset\",\n    allow_patterns=target_folder_pattern,\n    local_dir=local_dir,\n    local_dir_use_symlinks=False,\n)\nprint(f\"Downloaded to: {folder_path}\")" },
                  { label: "SLURM Job Script", lang: "bash", code: "#!/bin/bash\n#SBATCH --job-name=GalibierHub-dl\n#SBATCH --partition=cu\n#SBATCH --ntasks=1\n#SBATCH --mem=16G\n#SBATCH --time=12:00:00\n\nset -euo pipefail\nexport HF_ENDPOINT=\"https://hf-mirror.com\"\nexport HF_HUB_ENABLE_HF_TRANSFER=\"1\"\n\npython GalibierHub-download-folder.py | tee download_task.log" },
                ]} />
                <Admonition type="warning" title="Remember to verify after download">After the batch download completes, navigate to your download directory and run <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[11px] text-gray-800">sha256sum -c SHA256SUMS</code> to verify every file. The manifest is automatically included in the generated script.</Admonition>
              </div>

              <div className="mt-12 rounded-xl border border-gray-100 bg-[var(--color-surface-muted)] p-5 sm:p-6" id="records-folder-section">
                <StepHeading id="records-folder" step="\u2B50" title="The Records Folder" />
                <p className="mt-3 text-sm leading-7 text-gray-700">The <strong>Records</strong> folder in the Downloads interface is a dedicated directory containing all files shown in the Records interface. It is always listed first among the download folders.</p>
                <p className="mt-3 text-sm leading-7 text-gray-700">Every file inside the Records folder supports the same workflows as files in other folders:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-7 text-gray-700">
                  <li><strong>Download to Browser</strong> &mdash; single-file direct download</li>
                  <li><strong>CLI</strong> &mdash; copy exact commands with repo ID, filename, URL, and checksum</li>
                  <li><strong>Cluster Batch Download</strong> &mdash; generate Python and SLURM scripts for bulk download</li>
                </ul>
                <p className="mt-3 text-sm leading-7 text-gray-700">When you click the <strong>Download</strong> button on a row in the Records interface, it jumps directly to the corresponding file in the Records folder in Downloads, automatically selecting it for batch operations.</p>
              </div>

              <div className="mt-12 border-t border-gray-200 pt-6">
                <p className="text-sm text-gray-500">Have questions or suggestions? <Link href="/discussions" className="text-blue-600 underline decoration-blue-300 hover:text-blue-800">Ask in Discussions</Link></p>
              </div>
            </div>
          </div>

          <aside className="hidden xl:block w-52 flex-shrink-0">
            <div className="sticky top-6">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Contents</h3>
              <ul className="space-y-1">
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className={`block rounded px-2 py-1.5 text-sm transition-colors ${activeSection === s.id ? "bg-blue-50 font-medium text-blue-700" : "text-gray-500 hover:bg-slate-50 hover:text-gray-900"}`}
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <button onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }} className="flex w-full items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 transition-colors">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  Search guide...
                  <kbd className="ml-auto rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-0.5 text-[10px] font-mono text-gray-400">Ctrl+F</kbd>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
