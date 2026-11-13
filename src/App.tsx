import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ChatMessage,
  ExecutionLogEntry,
  ExecutionPlanArtifact,
  IngestedArtifact,
  RagMatch,
  SessionStateResponse,
  WebhookActionItem,
} from './types/omniagent';
import { TopBar, type NavSection } from './components/TopBar';
import { IngestionPanel } from './components/IngestionPanel';
import { ChatWorkspace } from './components/ChatWorkspace';
import { ExecutionSidebar, type SidebarTab } from './components/ExecutionSidebar';
import { ArtifactPreviewModal } from './components/ArtifactPreviewModal';
import { PrivacyModal } from './components/PrivacyModal';

function createSessionId(): string {
  const stored = sessionStorage.getItem('omniagent_session_id');
  if (stored) return stored;
  const fresh = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  sessionStorage.setItem('omniagent_session_id', fresh);
  return fresh;
}

export default function App() {
  const [sessionId] = useState<string>(() => createSessionId());
  const [activeNav, setActiveNav] = useState<NavSection>('workbench');
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('logs');
  const [mobilePane, setMobilePane] = useState<'context' | 'chat' | 'execution'>('chat');

  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('omniagent_theme') === 'dark';
  });
  const [reasoningDepth, setReasoningDepth] = useState<'standard' | 'deep'>('standard');

  const [artifacts, setArtifacts] = useState<IngestedArtifact[]>([]);
  const [logs, setLogs] = useState<ExecutionLogEntry[]>([]);
  const [plans, setPlans] = useState<ExecutionPlanArtifact[]>([]);
  const [actions, setActions] = useState<WebhookActionItem[]>([]);
  const [vectorStats, setVectorStats] = useState<SessionStateResponse['vectorStats']>({
    totalChunks: 0,
    totalVectors: 0,
    embeddingDims: 0,
    embeddingModel: 'gemini-embedding-2',
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [previewArtifact, setPreviewArtifact] = useState<
    (IngestedArtifact & { fullTextContent?: string }) | null
  >(null);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const abortReasonRef = useRef<'user_stop' | 'sandbox_purge' | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('omniagent_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const applySessionState = useCallback((state: SessionStateResponse) => {
    setArtifacts(state.artifacts);
    setLogs(state.logs);
    setPlans(state.plans);
    setActions(state.actions);
    setVectorStats(state.vectorStats);
    if (Array.isArray(state.messages)) {
      setMessages(state.messages);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`/api/session/${sessionId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load session'))))
      .then((data: SessionStateResponse) => {
        if (active) applySessionState(data);
      })
      .catch(() => {
        if (active) setErrorBanner('Unable to synchronize local sandbox state with server.');
      });
    return () => {
      active = false;
    };
  }, [sessionId, applySessionState]);

  const handleSelectNav = (section: NavSection) => {
    setActiveNav(section);
    if (section === 'vectors') {
      setSidebarTab('vectors');
      setMobilePane('execution');
    } else if (section === 'automations') {
      setSidebarTab('actions');
      setMobilePane('execution');
    } else if (section === 'security') {
      setIsPrivacyOpen(true);
    } else {
      setMobilePane('chat');
    }
  };

  const handleUploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsUploading(true);
    setErrorBanner(null);

    try {
      const formData = new FormData();
      for (const f of files) {
        formData.append('files', f);
      }

      const res = await fetch(`/api/session/${sessionId}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed during ingestion.');
      }

      if (data.state) {
        applySessionState(data.state);
      }
      const rejected = (data.uploaded as IngestedArtifact[] | undefined)?.filter(
        (a) => a.status === 'error'
      );
      if (rejected && rejected.length > 0) {
        setErrorBanner(
          `${rejected.length} file(s) rejected by sandbox validation: ${rejected[0].name} (${rejected[0].errorMessage})`
        );
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'File upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleLoadSample = async (): Promise<SessionStateResponse | null> => {
    setIsLoadingSample(true);
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/session/${sessionId}/load-sample`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load sample bundle.');
      applySessionState(data);
      return data as SessionStateResponse;
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to load sample bundle.');
      return null;
    } finally {
      setIsLoadingSample(false);
    }
  };

  const handleInspectArtifact = async (artifactId: string) => {
    try {
      const res = await fetch(`/api/session/${sessionId}/artifacts/${artifactId}/preview`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Preview unavailable.');
      setPreviewArtifact(data);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to inspect artifact.');
    }
  };

  const handleDeleteArtifact = async (artifactId: string) => {
    try {
      const res = await fetch(`/api/session/${sessionId}/artifacts/${artifactId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) applySessionState(data);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to remove artifact.');
    }
  };

  const handleResetSandbox = async () => {
    if (isStreaming) {
      abortReasonRef.current = 'sandbox_purge';
      abortRef.current?.abort();
    }
    setIsResetting(true);
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/session/${sessionId}/purge`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        applySessionState(data);
        setMessages([]);
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to purge sandbox.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleTogglePlanStep = async (planId: string, stepNumber: number) => {
    try {
      const res = await fetch(
        `/api/session/${sessionId}/plans/${planId}/steps/${stepNumber}`,
        { method: 'PATCH' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update step status.');
      if (data.state) {
        setPlans(data.state.plans);
        setLogs(data.state.logs);
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to update plan step.');
    }
  };

  const handleDispatchAction = async (actionId: string, targetUrl?: string) => {
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/session/${sessionId}/actions/${actionId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Webhook dispatch failed.');
      if (data.state) {
        setActions(data.state.actions);
        setLogs(data.state.logs);
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Webhook dispatch failed.');
    }
  };

  const handleVectorSearch = async (query: string) => {
    const res = await fetch(`/api/session/${sessionId}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, topK: 6 }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorBanner(data.error || 'Vector query failed.');
      return { matches: [], mode: 'vector' };
    }
    if (Array.isArray(data.logs)) {
      setLogs(data.logs);
    }
    return {
      matches: (data.matches ?? []) as RagMatch[],
      mode: String(data.mode ?? 'vector'),
    };
  };

  const handleStopStreaming = () => {
    abortReasonRef.current = 'user_stop';
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  const handleSendMessage = async (prompt: string) => {
    if (!prompt.trim()) {
      setErrorBanner('Enter a technical objective or question before executing.');
      return;
    }

    setErrorBanner(null);
    const activeNames = artifacts.filter((a) => a.status !== 'error').map((a) => a.name);

    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
      attachedArtifactNames: activeNames,
    };

    const assistantId = `msg_a_${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      reasoningDepth,
      isStreaming: true,
    };

    const historySnapshot = messages.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    abortReasonRef.current = null;

    try {
      const response = await fetch('/api/agent/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          prompt,
          reasoningDepth,
          history: historySnapshot,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(errPayload.error || `Server returned HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processEventBlock = (block: string) => {
        const lines = block.split('\n');
        let eventName = 'message';
        const dataLines: string[] = [];
        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
          }
        }
        if (dataLines.length === 0) return;

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
        } catch {
          return;
        }

        if (eventName === 'rag_retrieval') {
          const matches = (parsed.matches ?? []) as RagMatch[];
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, ragMatches: matches } : m))
          );
        } else if (eventName === 'agent_step') {
          const logEntry = parsed as unknown as ExecutionLogEntry;
          setLogs((prev) => [...prev, logEntry]);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    toolTraces: [
                      ...(m.toolTraces ?? []),
                      {
                        id: logEntry.id,
                        phase: logEntry.phase,
                        title: logEntry.title,
                        detail: logEntry.detail,
                        durationMs: logEntry.durationMs,
                        status: logEntry.status,
                      },
                    ],
                  }
                : m
            )
          );
        } else if (eventName === 'execution_plan') {
          const plan = parsed as unknown as ExecutionPlanArtifact;
          setPlans((prev) => [plan, ...prev]);
          setSidebarTab('actions');
        } else if (eventName === 'webhook_action') {
          const action = parsed as unknown as WebhookActionItem;
          setActions((prev) => [action, ...prev]);
          setSidebarTab('actions');
        } else if (eventName === 'markdown_delta') {
          const delta = String(parsed.text ?? '');
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + delta } : m
            )
          );
        } else if (eventName === 'error') {
          const errMsg = String(parsed.message ?? 'Streaming error occurred.');
          setErrorBanner(errMsg);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, error: errMsg, isStreaming: false } : m
            )
          );
        } else if (eventName === 'done') {
          if (parsed.state) {
            applySessionState(parsed.state as SessionStateResponse);
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const block of parts) {
          if (block.trim()) processEventBlock(block);
        }
      }
      if (buffer.trim()) {
        processEventBlock(buffer);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (abortReasonRef.current !== 'sandbox_purge') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: m.content || 'Execution aborted by operator.',
                    isStreaming: false,
                  }
                : m
            )
          );
        }
      } else {
        const message = err instanceof Error ? err.message : 'Execution request failed.';
        setErrorBanner(message);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, error: message, isStreaming: false } : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
      );
      abortRef.current = null;
      abortReasonRef.current = null;
    }
  };

  const handleLoadSampleAndRun = async (customPrompt?: string) => {
    const state = await handleLoadSample();
    if (state) {
      await handleSendMessage(
        customPrompt ||
          'Audit the loaded service_topology_wireframe.png, order_service.py, latency_telemetry.csv, and architecture_spec.md. Generate a structured execution plan, refactored async Python implementation, SQL index migration, and stage GitHub Actions CI + Git PR webhook hooks.'
      );
    }
  };

  const handleExportReport = () => {
    const lines: string[] = [];
    lines.push(`# OmniAgent Engineering Audit Report`);
    lines.push(`Session: \`${sessionId}\` · Exported: ${new Date().toISOString()}`);
    lines.push('');
    lines.push(`## Indexed Artifacts (${artifacts.length})`);
    for (const art of artifacts) {
      lines.push(
        `- **${art.name}** (${art.modality}, ${(art.sizeBytes / 1024).toFixed(1)} KB, ${art.chunkCount} chunks, status=${art.status})`
      );
    }
    if (plans.length > 0) {
      lines.push('');
      lines.push(`## Execution Blueprints (${plans.length})`);
      for (const plan of plans) {
        lines.push(`### ${plan.title}`);
        lines.push(plan.bottleneckSummary);
        lines.push('');
        for (const s of plan.steps) {
          const box = s.status === 'executed' ? 'x' : ' ';
          lines.push(
            `- [${box}] **Step ${s.stepNumber}** (${s.phase} · ${s.actionType} · ${s.estimatedEffort}): ${s.title} — \`${s.targetArtifact}\``
          );
        }
      }
    }
    if (actions.length > 0) {
      lines.push('');
      lines.push(`## Staged Automation Hooks & Scripts (${actions.length})`);
      for (const act of actions) {
        lines.push(`### ${act.targetSystem.toUpperCase()}: ${act.operation} (${act.status})`);
        lines.push(act.summary);
        if (act.dispatchReceipt) lines.push(`Receipt: \`${act.dispatchReceipt}\``);
        if (act.scriptFilename && act.scriptContent) {
          lines.push(`\n**${act.scriptFilename}**\n\`\`\`\n${act.scriptContent}\n\`\`\``);
        }
      }
    }
    lines.push('');
    lines.push(`## Conversation & Synthesis Stream`);
    for (const msg of messages) {
      lines.push(`### ${msg.role === 'user' ? 'Operator' : 'OmniAgent'} (${msg.timestamp})`);
      lines.push(msg.content || msg.error || '');
      lines.push('');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omniagent_audit_${sessionId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <TopBar
        activeSection={activeNav}
        onSelectSection={handleSelectNav}
        onResetSandbox={handleResetSandbox}
        isResetting={isResetting}
      />

      {/* Mobile/Tablet segmented pane switcher */}
      <div className="lg:hidden px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-1">
        {(['context', 'chat', 'execution'] as const).map((pane) => (
          <button
            key={pane}
            type="button"
            onClick={() => setMobilePane(pane)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
              mobilePane === pane
                ? 'bg-slate-900 dark:bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {pane === 'context'
              ? `Files (${artifacts.length})`
              : pane === 'chat'
              ? 'Copilot'
              : `Logs & Actions (${actions.length})`}
          </button>
        ))}
      </div>

      {/* 3-Pane Desktop Workbench */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div
          className={`${
            mobilePane === 'context' ? 'flex w-full' : 'hidden'
          } lg:flex lg:w-auto h-full`}
        >
          <IngestionPanel
            artifacts={artifacts}
            vectorStats={vectorStats}
            isUploading={isUploading}
            isLoadingSample={isLoadingSample}
            onUploadFiles={handleUploadFiles}
            onLoadSample={handleLoadSample}
            onInspectArtifact={handleInspectArtifact}
            onDeleteArtifact={handleDeleteArtifact}
          />
        </div>

        <div
          className={`${
            mobilePane === 'chat' ? 'flex' : 'hidden'
          } lg:flex flex-1 min-w-0 h-full`}
        >
          <ChatWorkspace
            messages={messages}
            artifacts={artifacts}
            reasoningDepth={reasoningDepth}
            onChangeReasoningDepth={setReasoningDepth}
            isDark={isDark}
            onToggleTheme={() => setIsDark((d) => !d)}
            isStreaming={isStreaming}
            errorBanner={errorBanner}
            onDismissError={() => setErrorBanner(null)}
            onSendMessage={handleSendMessage}
            onStopStreaming={handleStopStreaming}
            onAttachFiles={handleUploadFiles}
            onLoadSampleAndRun={handleLoadSampleAndRun}
            onExportReport={handleExportReport}
          />
        </div>

        <div
          className={`${
            mobilePane === 'execution' ? 'flex w-full' : 'hidden'
          } lg:flex lg:w-auto h-full`}
        >
          <ExecutionSidebar
            activeTab={sidebarTab}
            onChangeTab={setSidebarTab}
            logs={logs}
            plans={plans}
            actions={actions}
            onDispatchAction={handleDispatchAction}
            onTogglePlanStep={handleTogglePlanStep}
            onVectorSearch={handleVectorSearch}
          />
        </div>
      </div>

      <ArtifactPreviewModal
        artifact={previewArtifact}
        onClose={() => setPreviewArtifact(null)}
      />

      <PrivacyModal
        isOpen={isPrivacyOpen}
        sessionId={sessionId}
        artifactCount={artifacts.length}
        vectorCount={vectorStats.totalVectors}
        onClose={() => {
          setIsPrivacyOpen(false);
          setActiveNav('workbench');
        }}
        onPurge={handleResetSandbox}
      />
    </div>
  );
}
