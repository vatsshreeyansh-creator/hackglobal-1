import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Paperclip,
  Square,
  Sun,
  Moon,
  X,
} from 'lucide-react';
import type { ChatMessage, IngestedArtifact } from '../types/omniagent';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  artifacts: IngestedArtifact[];
  reasoningDepth: 'standard' | 'deep';
  onChangeReasoningDepth: (depth: 'standard' | 'deep') => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isStreaming: boolean;
  errorBanner: string | null;
  onDismissError: () => void;
  onSendMessage: (prompt: string) => void;
  onStopStreaming: () => void;
  onAttachFiles: (files: FileList | File[]) => void;
  onLoadSampleAndRun?: (customPrompt?: string) => void;
  onExportReport?: () => void;
}

const STARTER_PROMPTS = [
  {
    title: 'Bottleneck Audit & Remediation Plan',
    prompt:
      'Audit all ingested artifacts for latency, security, and database bottlenecks. Generate a structured execution plan, output production-ready refactored code, and stage GitHub Actions CI + Git PR webhook hooks.',
  },
  {
    title: 'Wireframe & Telemetry Synthesis',
    prompt:
      'Correlate the service topology wireframe with the telemetry CSV and architecture spec. Identify the highest-risk endpoint, write a SQL migration script, and stage sprint tickets.',
  },
  {
    title: 'CI/CD Pipeline & Storage Hook Generation',
    prompt:
      'Build a hardened Docker + GitHub Actions pipeline with automated security scanning and stage deployment webhooks for our codebase.',
  },
];

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  messages,
  artifacts,
  reasoningDepth,
  onChangeReasoningDepth,
  isDark,
  onToggleTheme,
  isStreaming,
  errorBanner,
  onDismissError,
  onSendMessage,
  onStopStreaming,
  onAttachFiles,
  onLoadSampleAndRun,
  onExportReport,
}) => {
  const [input, setInput] = useState('');
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});
  const [expandedTraces, setExpandedTraces] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const indexedCount = artifacts.filter((a) => a.status !== 'error').length;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isStreaming) return;
    const trimmed = input.trim();
    if (!trimmed) {
      onSendMessage('');
      return;
    }
    setInput('');
    onSendMessage(trimmed);
  };

  const toggleCitations = (msgId: string) => {
    setExpandedCitations((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const toggleTraces = (msgId: string) => {
    setExpandedTraces((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Workspace Toolbar */}
      <div className="h-12 shrink-0 px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 truncate tabular-nums">
          <span className="font-medium text-slate-900 dark:text-slate-100">
            Execution Stream
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {indexedCount} {indexedCount === 1 ? 'artifact' : 'artifacts'} grounded
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {messages.length > 0 && onExportReport && !isStreaming && (
            <button
              type="button"
              onClick={onExportReport}
              title="Download full Markdown audit report"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Report</span>
            </button>
          )}

          {/* Segmented reasoning depth */}
          <div
            role="group"
            aria-label="Reasoning depth"
            className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          >
            <button
              type="button"
              onClick={() => onChangeReasoningDepth('standard')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                reasoningDepth === 'standard'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => onChangeReasoningDepth('deep')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                reasoningDepth === 'deep'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Deep Reasoning
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Dismissible error banner */}
      {errorBanner && (
        <div
          role="alert"
          className="mx-5 mt-3 px-4 py-2.5 rounded-lg border border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/50 flex items-center justify-between gap-3 text-xs text-red-800 dark:text-red-200"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span className="truncate">{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={onDismissError}
            aria-label="Dismiss error"
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/50 shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Message stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="max-w-2xl mx-auto pt-8 space-y-6">
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 text-balance">
                Autonomous Multi-Modal Execution
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Ingest source repositories, telemetry CSV/Excel sheets, PDF specs, audio notes, or UI wireframes. OmniAgent grounds context via local vector embeddings and orchestrates structured execution plans, production patches, and webhook hooks.
              </p>
            </div>

            {indexedCount === 0 && onLoadSampleAndRun && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Start with the HackGlobal Engineering Bundle
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Loads FastAPI service code, latency CSV telemetry, Markdown spec, and topology wireframe PNG.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onLoadSampleAndRun()}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Load & Audit Bundle
                </button>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Operational Workflows {indexedCount === 0 ? '(auto-loads sample bundle)' : ''}
              </p>
              <div className="grid grid-cols-1 gap-2.5">
                {STARTER_PROMPTS.map((starter) => (
                  <button
                    key={starter.title}
                    type="button"
                    onClick={() => {
                      if (indexedCount === 0 && onLoadSampleAndRun) {
                        onLoadSampleAndRun(starter.prompt);
                      } else {
                        onSendMessage(starter.prompt);
                      }
                    }}
                    className="text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-600 transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {starter.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                      {starter.prompt}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={
                  msg.role === 'user'
                    ? 'flex justify-end'
                    : 'flex justify-start'
                }
              >
                {msg.role === 'user' ? (
                  <div className="max-w-[85%] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 space-y-1.5">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      Operator · {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {msg.attachedArtifactNames && msg.attachedArtifactNames.length > 0 && (
                        <> · {msg.attachedArtifactNames.length} artifacts active</>
                      )}
                    </div>
                    <p className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                ) : (
                  <div className="w-full space-y-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        OmniAgent
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {msg.reasoningDepth === 'deep' ? 'Deep Reasoning' : 'Standard'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {msg.isStreaming && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            Streaming response
                          </span>
                        </>
                      )}
                    </div>

                    {msg.toolTraces && msg.toolTraces.length > 0 && (
                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <button
                          type="button"
                          onClick={() => toggleTraces(msg.id)}
                          className="w-full px-3.5 py-2 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg transition-colors cursor-pointer"
                        >
                          <span className="font-medium tabular-nums">
                            Agentic Reasoning & Tool Trace: {msg.toolTraces.length} step
                            {msg.toolTraces.length === 1 ? '' : 's'}
                          </span>
                          {expandedTraces[msg.id] ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                          )}
                        </button>
                        {expandedTraces[msg.id] && (
                          <div className="border-t border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
                            {msg.toolTraces.map((trace) => (
                              <div key={trace.id} className="px-3.5 py-2 text-xs space-y-0.5">
                                <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums">
                                  <span className="inline-flex items-center gap-1.5 font-mono font-medium text-slate-700 dark:text-slate-300">
                                    {trace.status === 'error' ? (
                                      <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                                    ) : trace.status === 'warning' ? (
                                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                    ) : (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    )}
                                    <span>{trace.phase}</span>
                                  </span>
                                  {typeof trace.durationMs === 'number' && (
                                    <span className="font-mono text-slate-400 dark:text-slate-500">
                                      {trace.durationMs}ms
                                    </span>
                                  )}
                                </div>
                                <div className="font-medium text-slate-900 dark:text-slate-100">
                                  {trace.title}
                                </div>
                                <div className="text-slate-600 dark:text-slate-400">
                                  {trace.detail}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {msg.ragMatches && msg.ragMatches.length > 0 && (
                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <button
                          type="button"
                          onClick={() => toggleCitations(msg.id)}
                          className="w-full px-3.5 py-2 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg transition-colors cursor-pointer"
                        >
                          <span className="font-medium tabular-nums">
                            RAG Grounding: {msg.ragMatches.length} matched chunks
                          </span>
                          {expandedCitations[msg.id] ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                          )}
                        </button>
                        {expandedCitations[msg.id] && (
                          <div className="border-t border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
                            {msg.ragMatches.map((m) => (
                              <div key={m.chunkId} className="px-3.5 py-2 text-xs space-y-1">
                                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 tabular-nums">
                                  <span className="font-mono font-medium text-slate-900 dark:text-slate-200">
                                    {m.artifactName} ({m.lineRange || m.modality})
                                  </span>
                                  <span className="font-mono">
                                    score {m.score.toFixed(3)}
                                  </span>
                                </div>
                                <pre className="font-mono text-[11px] text-slate-600 dark:text-slate-400 overflow-x-auto whitespace-pre-wrap line-clamp-3">
                                  {m.excerpt}
                                </pre>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4">
                      {msg.error ? (
                        <div className="text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{msg.error}</span>
                        </div>
                      ) : msg.content ? (
                        <MarkdownRenderer content={msg.content} />
                      ) : (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Retrieving vector context and planning tool execution...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prompt composer */}
      <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 focus-within:border-blue-600 dark:focus-within:border-blue-500 transition-colors p-2.5 flex flex-col gap-2">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Describe the engineering bottleneck, schema task, or deployment automation..."
              className="w-full resize-none bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none px-1.5 py-1"
            />
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".py,.js,.jsx,.ts,.tsx,.cpp,.cc,.c,.h,.go,.rs,.java,.sql,.sh,.yaml,.yml,.json,.md,.txt,.pdf,.csv,.tsv,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.mp3,.wav,.ogg,.m4a,.webm"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      onAttachFiles(e.target.files);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Attach</span>
                </button>
                <span className="hidden sm:inline text-[11px] text-slate-400 dark:text-slate-500">
                  Enter to execute · Shift+Enter for newline
                </span>
              </div>

              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStopStreaming}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                >
                  <span>Execute</span>
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </main>
  );
};
