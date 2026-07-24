'use client';

import { useState } from 'react';

interface DownloadActionsProps {
  url: string;
  label: string;
  sizeLabel?: string | null;
  description?: string | null;
  showCli?: boolean;
  className?: string;
}

function buildWgetCommand(url: string) {
  return `wget -O "${url.split('?')[0].split('/').pop() || 'download.file'}" "${url}"`;
}

function buildCurlCommand(url: string) {
  return `curl -L -O "${url}"`;
}

export default function DownloadActions({
  url,
  label,
  sizeLabel,
  description,
  showCli = false,
  className = '',
}: DownloadActionsProps) {
  const [copied, setCopied] = useState<'wget' | 'curl' | null>(null);

  if (!url) {
    return null;
  }

  const handleCopy = async (mode: 'wget' | 'curl') => {
    const command = mode === 'wget' ? buildWgetCommand(url) : buildCurlCommand(url);
    try {
      await navigator.clipboard.writeText(command);
      setCopied(mode);
      window.setTimeout(() => {
        setCopied((current) => (current === mode ? null : current));
      }, 1600);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      {(description || sizeLabel) && (
        <div className="space-y-1">
          {description && <p className="text-sm text-gray-600">{description}</p>}
          {sizeLabel && (
            <div>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {sizeLabel}
              </span>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-w-[9rem] items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          {label}
        </a>
        {showCli && (
          <>
            <button
              type="button"
              onClick={() => handleCopy('wget')}
              className="inline-flex min-w-[9rem] items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {copied === 'wget' ? 'Copied wget' : 'Copy wget'}
            </button>
            <button
              type="button"
              onClick={() => handleCopy('curl')}
              className="inline-flex min-w-[9rem] items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {copied === 'curl' ? 'Copied curl' : 'Copy curl'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
