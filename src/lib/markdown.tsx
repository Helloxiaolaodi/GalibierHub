import React from 'react';

export function htmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderInlineText(text: string, key: string): React.ReactNode {
  let html = htmlEscape(text);
  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-pink-600 font-mono">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-blue-600 hover:underline">$1</a>');
  return <span key={key} dangerouslySetInnerHTML={{ __html: html }} className="whitespace-pre-wrap break-words" />;
}

export function renderInline(text: string, onImageClick?: (src: string, alt: string) => void, prefix?: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const imgRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let lastIdx = 0, pi = 0;
  let m: RegExpExecArray | null;
  const pf = prefix || '';
  while ((m = imgRe.exec(text)) !== null) {
    const imgSrc = m[2], imgAlt = m[1] || 'image';
    if (m.index > lastIdx) parts.push(renderInlineText(text.substring(lastIdx, m.index), `${pf}-it-${pi++}`));
    parts.push(<img key={`${pf}-img-${pi++}`} src={imgSrc} alt={imgAlt} className="my-2 max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity" loading="lazy" onClick={() => onImageClick?.(imgSrc, imgAlt)} />);
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) parts.push(renderInlineText(text.substring(lastIdx), `${pf}-it-${pi++}`));
  return parts.length > 1 ? <>{parts}</> : parts[0] || null;
}

export function renderMarkdown(text: string, onImageClick?: (src: string, alt: string) => void): React.ReactNode {
  if (!text) return null;
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let inCodeBlock = false, codeContent = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      if (inCodeBlock) {
        result.push(<pre key={`cb-${i}`} className="my-2 rounded-lg bg-slate-900 text-green-400 p-3 text-sm overflow-x-auto whitespace-pre-wrap font-mono">{codeContent}</pre>);
        inCodeBlock = false; codeContent = '';
      } else { inCodeBlock = true; }
      continue;
    }
    if (inCodeBlock) { codeContent += (codeContent ? '\n' : '') + line; continue; }
    if (line.startsWith('> ')) { result.push(<div key={`bq-${i}`} className="my-1 border-l-4 border-blue-300 pl-3 italic text-gray-600">{renderInline(line.substring(2), onImageClick, `bqi-${i}`)}</div>); continue; }
    if (line.trim() === '') { result.push(<div key={`br-${i}`} className="h-2" />); continue; }
    result.push(<div key={`ln-${i}`}>{renderInline(line, onImageClick, `lni-${i}`)}</div>);
  }
  return <div className="markdown-content">{result}</div>;
}
