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
            GalibierHub public datasets can be downloaded from the browser or with resumable command-line tools.
            Each dataset row in the Downloads tab provides a CLI button with the exact URL, checksum, and commands
            for that file.
          </p>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-gray-900">Recommended tools</h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              <li className="rounded-lg bg-slate-50 px-3 py-2">wget -c resumes interrupted downloads on Linux and macOS.</li>
              <li className="rounded-lg bg-slate-50 px-3 py-2">curl -L -C - resumes interrupted downloads on Windows, Linux, and macOS.</li>
              <li className="rounded-lg bg-slate-50 px-3 py-2">aria2c adds multi-threaded parallel downloads for large files.</li>
              <li className="rounded-lg bg-slate-50 px-3 py-2">Free Download Manager and similar tools accept the official direct URL.</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-gray-900">Verify integrity</h2>
            <p className="mt-2 text-sm text-gray-600">
              After downloading a file, compare its SHA-256 value with the checksum shown in the CLI details panel.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs font-mono text-slate-100">
{`sha256sum "downloaded-file"
# macOS fallback: shasum -a 256 "downloaded-file"
# Windows fallback: certutil -hashfile "downloaded-file" SHA256`}
            </pre>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-gray-900">Command examples</h2>
            <p className="mt-2 text-sm text-gray-600">
              Replace the placeholder URL and filename with the values from the CLI details panel for the dataset you
              selected.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs font-mono text-slate-100">
{`# Linux/macOS: wget (resume)
wget -c -O "file.bam" "https://example.galibierhub.com/file.bam"

# Windows/Linux/macOS: curl (resume)
curl -L -C - -o "file.bam" "https://example.galibierhub.com/file.bam"

# Multi-threaded download with aria2c
aria2c -x 16 -s 16 -c "https://example.galibierhub.com/file.bam" -o "file.bam"`}
            </pre>
          </section>

          <div className="mt-8 rounded-xl border border-teal-200 bg-teal-50 p-4">
            <p className="text-sm text-teal-900">
              Always use the official direct URL shown in the CLI details panel. If a download is interrupted, run the
              same command again to resume instead of starting over.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
