"use client";

import { useState, useCallback } from "react";

// Simple keyword-based syntax highlighting for common languages
function highlightCode(code: string, language: string): string {
  const escaped = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const lang = language.toLowerCase();

  // Common keywords for Python, R, bash, JavaScript/TypeScript
  const keywords = [
    "import", "from", "def", "class", "return", "if", "else", "elif", "for", "while",
    "try", "except", "finally", "with", "as", "yield", "lambda", "pass", "break",
    "continue", "and", "or", "not", "in", "is", "None", "True", "False",
    "function", "const", "let", "var", "export", "default", "async", "await",
    "library", "require", "source", "setwd", "ggplot", "aes", "geom_",
    "curl", "wget", "echo", "export", "sudo", "apt", "pip", "conda",
    "print", "range", "len", "list", "dict", "set", "tuple", "str", "int",
    "typeof", "instanceof", "new", "this", "super", "extends",
    "SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "CREATE", "TABLE",
    "JOIN", "LEFT", "RIGHT", "INNER", "GROUP", "BY", "ORDER", "LIMIT",
  ];

  let result = escaped;

  // Highlight strings (single and double quoted)
  result = result.replace(/(["'`])(?:(?!\1|\\).|\\.)*\1/g, '<span class="text-amber-300">$&</span>');

  // Highlight comments (# for Python/R/bash, // for JS/TS)
  result = result.replace(/(#.*$)/gm, '<span class="text-gray-500 italic">$1</span>');
  result = result.replace(/(\/\/.*$)/gm, '<span class="text-gray-500 italic">$1</span>');

  // Highlight numbers
  result = result.replace(/\b(\d+\.?\d*)\b/g, '<span class="text-orange-300">$1</span>');

  // Highlight keywords
  const kwPattern = new RegExp("\\b(" + keywords.join("|") + ")\\b", "g");
  result = result.replace(kwPattern, '<span class="text-cyan-300">$1</span>');

  return result;
}

export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  const lineCount = code.split("\n").length;
  const isLong = lineCount > 20;
  const displayCode = collapsed && isLong
    ? code.split("\n").slice(0, 20).join("\n") + "\n..."
    : code;

  const highlighted = highlightCode(displayCode, language || "");

  return (
    <div className="my-3 rounded-xl border border-slate-700 bg-slate-900 overflow-hidden group">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>
          {language && (
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider ml-2">
              {language}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-slate-400 hover:text-white hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
        >
          {copied ? (
            <>
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      {/* Code content */}
      <pre className="p-4 text-sm overflow-x-auto font-mono leading-relaxed">
        <code
          className="text-green-400"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
      {/* Collapse/expand toggle for long code */}
      {isLong && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full px-4 py-1.5 text-center text-[10px] font-medium text-slate-500 hover:text-slate-300 bg-slate-800/50 hover:bg-slate-800 transition-colors border-t border-slate-700"
        >
          {collapsed ? `Show all ${lineCount} lines` : "Collapse"}
        </button>
      )}
    </div>
  );
}
