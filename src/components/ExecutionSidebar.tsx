import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Download,
  Play,
  Search,
  Terminal,
  Webhook,
  Workflow,
} from 'lucide-react';
import type {
  ExecutionLogEntry,
  ExecutionPlanArtifact,
  RagMatch,
  WebhookActionItem,
} from '../types/omniagent';

export type SidebarTab = 'logs' | 'actions' | 'vectors';

interface ExecutionSidebarProps {
  activeTab: SidebarTab;
  onChangeTab: (tab: SidebarTab) => void;
  logs: ExecutionLogEntry[];
  plans: ExecutionPlanArtifact[];
  actions: WebhookActionItem[];
  onDispatchAction: (actionId: string, targetUrl?: string) => Promise<void> | void;
  onTogglePlanStep: (planId: string, stepNumber: number) => void;
  onVectorSearch: (query: string) => Promise<{ matches: RagMatch[]; mode: string }>;
}

export const ExecutionSidebar: React.FC<ExecutionSidebarProps> = ({
  activeTab,
  onChangeTab,
  logs,
  plans,
  actions,
  onDispatchAction,
  onTogglePlanStep,
  onVectorSearch,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [targetWebhookUrl, setTargetWebhookUrl] = useState('');
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RagMatch[]>([]);
  const [searchMode, setSearchMode] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleDownloadScript = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await onVectorSearch(searchQuery.trim());
      setSearchResults(res.matches);
      setSearchMode(res.mode);
    } finally {
      setIsSearching(false);
    }
  };

  const orderedLogs = [...logs].reverse();

  return (
    <aside className="w-full lg:w-[350px] xl:w-[390px] shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Execution Logs & Agent Actions
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {actions.length} hooks
          </span>
        </div>

        <div
          role="tablist"
          aria-label="Execution inspector tabs"
          className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'logs'}
            onClick={() => onChangeTab('logs')}
            className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Logs ({logs.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'actions'}
            onClick={() => onChangeTab('actions')}
            className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'actions'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Actions ({plans.length + actions.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'vectors'}
            onClick={() => onChangeTab('vectors')}
            className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'vectors'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Vectors
          </button>
        </div>
      </div>

      {/* Pinned Target Webhook URL bar when Actions tab has staged hooks */}
      {activeTab === 'actions' && actions.length > 0 && (
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 space-y-1.5 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="webhook-target-url"
              className="text-[11px] font-medium text-slate-700 dark:text-slate-300"
            >
              Target Webhook URL (optional)
            </label>
            <button
              type="button"
              onClick={() => {
                document
                  .getElementById('staged-webhooks-section')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Jump to {actions.length} {actions.length === 1 ? 'hook' : 'hooks'} ↓
            </button>
          </div>
          <input
            id="webhook-target-url"
            type="url"
            value={targetWebhookUrl}
            onChange={(e) => setTargetWebhookUrl(e.target.value)}
            placeholder="https://webhook.site/... (blank = sandbox simulation)"
            className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
          />
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'logs' && (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {orderedLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                No execution events recorded yet.
              </div>
            ) : (
              orderedLogs.map((log) => (
                <div key={log.id} className="px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums">
                    <div className="flex items-center gap-1.5 font-mono font-medium text-slate-600 dark:text-slate-300">
                      {log.status === 'error' ? (
                        <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                      ) : log.status === 'warning' ? (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      )}
                      <span>{log.phase}</span>
                    </div>
                    <span className="font-mono text-slate-400 dark:text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                      {typeof log.durationMs === 'number' ? ` · ${log.durationMs}ms` : ''}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-900 dark:text-slate-100">
                    {log.title}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {log.detail}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="p-4 space-y-5">

            {plans.length === 0 && actions.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <Workflow className="w-6 h-6 mx-auto text-slate-400 dark:text-slate-600" />
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  No staged plans or webhook hooks
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Execute an audit or automation prompt to generate structured task breakdowns, CI/CD scripts, and Git/storage webhooks.
                </p>
              </div>
            ) : (
              <>
                {plans.map((plan) => {
                  const completedSteps = plan.steps.filter((s) => s.status === 'executed').length;
                  return (
                    <section
                      key={plan.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between text-[11px] font-medium text-blue-700 dark:text-blue-400 tabular-nums">
                          <span>Execution Blueprint · {plan.steps.length} steps</span>
                          <span>
                            {completedSteps}/{plan.steps.length} done
                          </span>
                        </div>
                        <h3 className="mt-0.5 font-display text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {plan.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          {plan.bottleneckSummary}
                        </p>
                      </div>
                      <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {plan.steps.map((step) => {
                          const isDone = step.status === 'executed';
                          return (
                            <button
                              key={step.stepNumber}
                              type="button"
                              onClick={() => onTogglePlanStep(plan.id, step.stepNumber)}
                              className="w-full text-left px-4 py-2.5 text-xs space-y-0.5 hover:bg-slate-100/70 dark:hover:bg-slate-900/60 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                <span className="inline-flex items-center gap-1.5">
                                  {isDone ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  ) : (
                                    <Circle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
                                  )}
                                  <span>
                                    {String(step.stepNumber).padStart(2, '0')}. {step.phase} · {step.actionType}
                                  </span>
                                </span>
                                <span className="font-mono">{step.estimatedEffort}</span>
                              </div>
                              <div
                                className={`font-medium pl-5 ${
                                  isDone
                                    ? 'line-through text-slate-500 dark:text-slate-500'
                                    : 'text-slate-900 dark:text-slate-100'
                                }`}
                              >
                                {step.title}
                              </div>
                              <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 pl-5">
                                Target: {step.targetArtifact}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}

                {actions.length > 0 && (
                  <div id="staged-webhooks-section" className="space-y-3 pt-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Staged Webhook Hooks ({actions.length})
                    </div>
                    {actions.map((action) => (
                      <section
                        key={action.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
                      >
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1.5 font-mono font-medium text-slate-700 dark:text-slate-300">
                          <Webhook className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          {action.targetSystem.toUpperCase()} · {action.endpointPath}
                        </span>
                        <span
                          className={`font-medium ${
                            action.status === 'dispatched'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {action.status === 'dispatched' ? 'Dispatched' : 'Staged'}
                        </span>
                      </div>
                      <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {action.operation}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {action.summary}
                      </p>
                    </div>

                    <div className="p-3 bg-slate-950 text-slate-100 space-y-2">
                      <pre className="font-mono text-[11px] leading-relaxed overflow-x-auto max-h-36">
                        {action.scriptContent || action.payloadJson}
                      </pre>
                    </div>

                    {action.dispatchReceipt && (
                      <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-emerald-50/70 dark:bg-emerald-950/30 font-mono text-[11px] text-emerald-800 dark:text-emerald-300">
                        {action.dispatchReceipt}
                      </div>
                    )}

                    <div className="px-3 py-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(action.id, action.scriptContent || action.payloadJson)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                        >
                          {copiedId === action.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedId === action.id ? 'Copied' : 'Copy'}</span>
                        </button>
                        {action.scriptFilename && action.scriptContent && (
                          <button
                            type="button"
                            onClick={() =>
                              handleDownloadScript(action.scriptFilename!, action.scriptContent!)
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{action.scriptFilename}</span>
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          setDispatchingId(action.id);
                          try {
                            await onDispatchAction(
                              action.id,
                              targetWebhookUrl.trim() || undefined
                            );
                          } finally {
                            setDispatchingId(null);
                          }
                        }}
                        disabled={action.status === 'dispatched' || dispatchingId === action.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 dark:disabled:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>
                          {dispatchingId === action.id
                            ? 'Sending...'
                            : action.status === 'dispatched'
                            ? 'Executed'
                            : targetWebhookUrl.trim()
                            ? 'Send Live'
                            : 'Dispatch Hook'}
                        </span>
                      </button>
                    </div>
                  </section>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'vectors' && (
          <div className="p-4 space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Query local vector embeddings..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
              >
                {isSearching ? 'Searching...' : 'Query'}
              </button>
            </form>

            {searchMode && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                Matched {searchResults.length} chunks via {searchMode} similarity
              </p>
            )}

            {searchResults.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Terminal className="w-5 h-5 mx-auto text-slate-400 dark:text-slate-600" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Run a semantic query across your ingested files using gemini-embedding-2.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                {searchResults.map((match) => (
                  <div key={match.chunkId} className="p-3 space-y-1.5 bg-white dark:bg-slate-900">
                    <div className="flex items-center justify-between text-[11px] tabular-nums">
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {match.artifactName} · {match.lineRange || match.modality}
                      </span>
                      <span className="font-mono text-blue-700 dark:text-blue-400 shrink-0">
                        {match.score.toFixed(4)}
                      </span>
                    </div>
                    <pre className="font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap line-clamp-4">
                      {match.excerpt}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
