import React from 'react';
import { CodeBlock } from './code-block';


// KaTeX-inspired math rendering (lightweight, no external dependency)
function renderMathExpression(formula: string): React.ReactNode {
  return React.createElement("span", { className: "font-mono text-sm text-slate-700 bg-slate-100 rounded px-1.5 py-0.5 italic" }, formula);
}
function renderDisplayMath(formula: string): React.ReactNode {
  return React.createElement("div", { className: "my-3 p-3 bg-slate-50 rounded-lg border border-slate-200 overflow-x-auto text-center" },
    React.createElement("span", { className: "font-mono text-sm text-slate-700 italic" }, formula));
}
function processMathExpressions(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const displayMathRe = /\$\$([\s\S]+?)\$\$/g;
  let lastIdx = 0, kid = 0;
  let dm: RegExpExecArray | null;
  while ((dm = displayMathRe.exec(text)) !== null) {
    if (dm.index > lastIdx) parts.push(renderInlineMath(text.substring(lastIdx, dm.index), kid++));
    parts.push(React.createElement("span", { key: "dm-" + (kid++) }, renderDisplayMath((dm[1]||"").trim())));
    lastIdx = dm.index + dm[0].length;
  }
  if (lastIdx < text.length) parts.push(renderInlineMath(text.substring(lastIdx), kid++));
  return parts.length > 1 ? React.createElement(React.Fragment, null, ...parts) : parts[0] || null;
}
function renderInlineMath(text: string, baseKey: number): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /\$(.+?)\$/g;
  let lastIdx = 0, kid = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push(React.createElement("span", { key: "imt-" + baseKey + "-" + (kid++) }, text.substring(lastIdx, m.index)));
    parts.push(React.createElement("span", { key: "imm-" + baseKey + "-" + (kid++) }, renderMathExpression(m[1]||"")));
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) parts.push(React.createElement("span", { key: "imt-" + baseKey + "-" + (kid++) }, text.substring(lastIdx)));
  return parts.length > 1 ? React.createElement(React.Fragment, null, ...parts) : parts[0] || null;
}
export function htmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderInlineText(text: string, key: string): React.ReactNode {
  let html = htmlEscape(text);
  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-slate-800 font-mono">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-slate-700 hover:underline">$1</a>');
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
    parts.push(<img key={`${pf}-img-${pi++}`} src={imgSrc} alt={imgAlt} className="my-2 max-w-full max-h-36 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity" loading="lazy" onClick={() => onImageClick?.(imgSrc, imgAlt)} />);
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) parts.push(renderInlineText(text.substring(lastIdx), `${pf}-it-${pi++}`));
  return parts.length > 1 ? <>{parts}</> : parts[0] || null;
}

export function renderMarkdown(text: string, onImageClick?: (src: string, alt: string) => void): React.ReactNode {
  if (!text) return null;
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let inCodeBlock = false, codeContent = '', lang = '';
  let listState: { ordered: boolean; items: string[]; key: string } | null = null;

  const flushList = () => {
    if (!listState) return;
    const items = listState.items.map((item, index) =>
      React.createElement('li', { key: `${listState!.key}-${index}` },
        renderInline(item, onImageClick, `${listState!.key}-${index}-`)));
    result.push(React.createElement(listState.ordered ? 'ol' : 'ul', { key: listState.key, className: 'my-1.5 space-y-1' }, ...items));
    listState = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flushList();
      if (inCodeBlock) {
        result.push(<CodeBlock key={`cb-${i}`} code={codeContent} language={lang} />);
        inCodeBlock = false; codeContent = ''; lang = '';
      } else { inCodeBlock = true; lang = line.replace(/^```/, '').trim() || ''; }
      continue;
    }
    if (inCodeBlock) { codeContent += (codeContent ? '\n' : '') + line; continue; }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const headingClass = level === 1
        ? 'text-xl font-bold text-gray-900 mt-4 mb-2'
        : level === 2
          ? 'text-lg font-bold text-gray-900 mt-4 mb-2'
          : 'text-base font-semibold text-gray-900 mt-3 mb-2';
      result.push(React.createElement(`h${level}`, { key: `h-${i}`, className: headingClass },
        renderInline(heading[2], onImageClick, `hi-${i}-`)));
      continue;
    }
    const listMatch = /^\s*(?:[-*+]|\d+\.)\s+(.+)$/.exec(line);
    if (listMatch) {
      if (!listState) {
        listState = { ordered: /^\s*\d+\./.test(line), items: [], key: `list-${i}` };
      }
      listState.items.push(listMatch[1]);
      continue;
    }
    if (line.startsWith('> ')) {
      flushList();
      result.push(<div key={`bq-${i}`} className="my-1 border-l-4 border-slate-300 pl-3 italic text-gray-600">{renderInline(line.substring(2), onImageClick, `bqi-${i}`)}</div>);
      continue;
    }
    if (line.trim() === '') {
      flushList();
      result.push(<div key={`br-${i}`} className="h-2" />);
      continue;
    }
    flushList();
    result.push(<div key={`ln-${i}`}>{renderInline(line, onImageClick, `lni-${i}`)}</div>);
  }
  flushList();
  return <div className="markdown-content">{result}</div>;
}
