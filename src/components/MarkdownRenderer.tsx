import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, Download } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

const CodeBlock: React.FC<{
  language: string;
  codeText: string;
}> = ({ language, codeText }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleDownload = () => {
    const extMap: Record<string, string> = {
      python: 'py',
      py: 'py',
      typescript: 'ts',
      ts: 'ts',
      javascript: 'js',
      js: 'js',
      sql: 'sql',
      yaml: 'yml',
      yml: 'yml',
      json: 'json',
      bash: 'sh',
      sh: 'sh',
      dockerfile: 'Dockerfile',
    };
    const ext = extMap[language.toLowerCase()] || 'txt';
    const filename = ext === 'Dockerfile' ? 'Dockerfile' : `omniagent_artifact.${ext}`;
    const blob = new Blob([codeText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-3 rounded-lg border border-slate-200 dark:border-slate-700/80 overflow-hidden bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-800 bg-slate-900">
        <span className="font-mono text-xs text-slate-400">
          {language || 'text'}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
        </div>
      </div>
      <pre className="p-3.5 overflow-x-auto text-[13px] leading-relaxed font-mono text-slate-100">
        <code>{codeText}</code>
      </pre>
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="text-[14.5px] leading-relaxed text-slate-800 dark:text-slate-200 max-w-[75ch] space-y-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50 pt-2 pb-1 border-b border-slate-200 dark:border-slate-800">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 pt-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 pt-1">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1.5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-700"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="pl-4 py-1 text-slate-600 dark:text-slate-300 bg-slate-100/70 dark:bg-slate-800/50 rounded-r border border-slate-200 dark:border-slate-700">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
              <table className="w-full text-left border-collapse text-xs tabular-nums">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700">
              {children}
            </thead>
          ),
          th: ({ children }) => <th className="px-3 py-2">{children}</th>,
          td: ({ children }) => (
            <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-800">
              {children}
            </td>
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const rawText = String(children).replace(/\n$/, '');
            const isBlock = Boolean(match) || rawText.includes('\n');
            if (isBlock) {
              return <CodeBlock language={match?.[1] || 'text'} codeText={rawText} />;
            }
            return (
              <code
                {...props}
                className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-[12.5px] border border-slate-200/70 dark:border-slate-700/70"
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
