import Link from "next/link";

export default function DownloadCliGuidePage() {
  return (
    <main className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to GalibierHub
        </Link>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900">Download &amp; CLI Usage Guide</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Use the Downloads interface to save individual files, generate command-line commands, or run batch downloads on a cluster.
            The Records folder in Downloads contains every file from the Records interface and supports the same workflows as other folders.
          </p>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-gray-900">1. Download to Browser</h2>
            <p className="mt-2 text-sm text-gray-600">
              Click Download to Browser on a file to download it directly through your browser while preserving the original filename.
              This is the quickest option for individual files.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-gray-900">2. CLI</h2>
            <p className="mt-2 text-sm text-gray-600">
              Click CLI on a file to copy the exact command for that file. The panel provides options for Linux/macOS and Windows PowerShell,
              and includes the correct repo ID, filename, URL, checksum, and verification command.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-gray-900">3. Cluster Batch Download</h2>
            <p className="mt-2 text-sm text-gray-600">
              Select one or more files, open Cluster Batch Download, and generate Python and SLURM scripts for recursive folder downloads.
              The generated workflow includes an integrity verification step so the downloaded files can be checked after transfer.
            </p>
          </section>

          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-700">
              The Records folder in Downloads is specifically the collection of all files shown in the Records interface.
              Files inside it can be downloaded, selected, exported, and batch-downloaded exactly like files in other Downloads folders.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
