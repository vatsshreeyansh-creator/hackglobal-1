export type ModalityType = 'code' | 'document' | 'tabular' | 'image' | 'audio';

export type ArtifactStatus = 'indexed' | 'fallback' | 'error';

export interface TabularColumnMeta {
  name: string;
  inferredType: 'number' | 'string' | 'boolean' | 'date' | 'mixed';
  nullCount: number;
  sampleValues: string[];
}

export interface TabularMeta {
  sheetNames: string[];
  activeSheet: string;
  rowCount: number;
  columnCount: number;
  columns: TabularColumnMeta[];
  previewRows: Record<string, string | number | boolean | null>[];
}

export interface IngestedArtifact {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  modality: ModalityType;
  status: ArtifactStatus;
  errorMessage?: string;
  chunkCount: number;
  embeddingModel: string;
  embeddingDims: number;
  textPreview?: string;
  tabularMeta?: TabularMeta;
  imageDataUrl?: string;
  mediaDataUrl?: string;
  createdAt: string;
}

export interface RagMatch {
  chunkId: string;
  artifactId: string;
  artifactName: string;
  modality: ModalityType;
  score: number;
  excerpt: string;
  lineRange?: string;
}

export type LogPhase =
  | 'INGESTION'
  | 'EMBEDDING'
  | 'RAG_RETRIEVAL'
  | 'REASONING'
  | 'TOOL_CALL'
  | 'WEBHOOK_HOOK'
  | 'SYNTHESIS'
  | 'SECURITY';

export interface ExecutionLogEntry {
  id: string;
  timestamp: string;
  phase: LogPhase;
  title: string;
  detail: string;
  durationMs?: number;
  status: 'completed' | 'running' | 'warning' | 'error';
  metadata?: Record<string, unknown>;
}

export interface ExecutionStepItem {
  stepNumber: number;
  phase: string;
  title: string;
  actionType: string;
  targetArtifact: string;
  estimatedEffort: string;
  status: 'ready' | 'executed';
}

export interface ExecutionPlanArtifact {
  id: string;
  title: string;
  bottleneckSummary: string;
  steps: ExecutionStepItem[];
  createdAt: string;
}

export interface WebhookActionItem {
  id: string;
  targetSystem: 'git' | 'cicd' | 'storage' | 'tasks' | 'database';
  operation: string;
  endpointPath: string;
  summary: string;
  payloadJson: string;
  scriptFilename?: string;
  scriptContent?: string;
  status: 'staged' | 'dispatched';
  createdAt: string;
  dispatchedAt?: string;
  dispatchReceipt?: string;
  targetUrl?: string;
  httpStatus?: number;
}

export interface ToolTraceEntry {
  id: string;
  phase: LogPhase;
  title: string;
  detail: string;
  durationMs?: number;
  status: 'completed' | 'running' | 'warning' | 'error';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachedArtifactNames?: string[];
  ragMatches?: RagMatch[];
  toolTraces?: ToolTraceEntry[];
  reasoningDepth?: 'standard' | 'deep';
  isStreaming?: boolean;
  error?: string;
}

export interface SessionStateResponse {
  sessionId: string;
  artifacts: IngestedArtifact[];
  logs: ExecutionLogEntry[];
  plans: ExecutionPlanArtifact[];
  actions: WebhookActionItem[];
  messages: ChatMessage[];
  vectorStats: {
    totalChunks: number;
    totalVectors: number;
    embeddingDims: number;
    embeddingModel: string;
  };
}
