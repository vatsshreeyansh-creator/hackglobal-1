import type {
  ChatMessage,
  ExecutionLogEntry,
  ExecutionPlanArtifact,
  IngestedArtifact,
  RagMatch,
  SessionStateResponse,
  WebhookActionItem,
} from '../src/types/omniagent.ts';
import { getGeminiClient, withRetry } from './geminiClient.ts';
import type { InternalArtifactRecord, ParsedChunk } from './ingestion.ts';

interface VectorRecord {
  chunk: ParsedChunk;
  vector: number[] | null;
}

export interface SessionSandbox {
  sessionId: string;
  version: number;
  lastAccessedAt: number;
  artifacts: Map<string, InternalArtifactRecord>;
  vectors: VectorRecord[];
  logs: ExecutionLogEntry[];
  plans: ExecutionPlanArtifact[];
  actions: WebhookActionItem[];
  messages: ChatMessage[];
  embeddingDims: number;
}

const sessions = new Map<string, SessionSandbox>();
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours inactivity TTL
const MAX_ACTIVE_SESSIONS = 100;

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [id, sandbox] of sessions.entries()) {
    if (now - sandbox.lastAccessedAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
  if (sessions.size > MAX_ACTIVE_SESSIONS) {
    const sorted = Array.from(sessions.entries()).sort(
      (a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt
    );
    const excess = sessions.size - MAX_ACTIVE_SESSIONS;
    for (let i = 0; i < excess; i++) {
      sessions.delete(sorted[i][0]);
    }
  }
}

export function getOrCreateSession(sessionId: string): SessionSandbox {
  pruneExpiredSessions();
  const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default';
  let sandbox = sessions.get(safeId);
  if (!sandbox) {
    sandbox = {
      sessionId: safeId,
      version: 1,
      lastAccessedAt: Date.now(),
      artifacts: new Map(),
      vectors: [],
      logs: [
        {
          id: `log_init_${Date.now()}`,
          timestamp: new Date().toISOString(),
          phase: 'SECURITY',
          title: 'Local sandbox initialized',
          detail:
            'Session memory isolated. Ingested codebases, schematics, and tabular files remain strictly scoped to this local sandbox.',
          status: 'completed',
        },
      ],
      plans: [],
      actions: [],
      messages: [],
      embeddingDims: 0,
    };
    sessions.set(safeId, sandbox);
  } else {
    sandbox.lastAccessedAt = Date.now();
  }
  return sandbox;
}

export function purgeSession(sessionId: string): SessionSandbox {
  const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default';
  const prevVersion = sessions.get(safeId)?.version ?? 0;
  sessions.delete(safeId);
  const fresh = getOrCreateSession(safeId);
  fresh.version = prevVersion + 1;
  fresh.logs.push({
    id: `log_purge_${Date.now()}`,
    timestamp: new Date().toISOString(),
    phase: 'SECURITY',
    title: 'Sandbox sanitized & purged',
    detail: 'All vector embeddings, chat history, binary buffers, and webhook payloads cleared from local memory.',
    status: 'completed',
  });
  return fresh;
}

export function appendLog(
  sandbox: SessionSandbox,
  entry: Omit<ExecutionLogEntry, 'id' | 'timestamp'>
): ExecutionLogEntry {
  const log: ExecutionLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  sandbox.logs.push(log);
  if (sandbox.logs.length > 150) {
    sandbox.logs = sandbox.logs.slice(-150);
  }
  return log;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function lexicalScore(query: string, text: string): number {
  const qTokens = query
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length > 2);
  if (qTokens.length === 0) return 0.1;
  const hay = text.toLowerCase();
  let hits = 0;
  for (const tok of qTokens) {
    if (hay.includes(tok)) hits++;
  }
  return Math.min(0.95, (hits / qTokens.length) * 0.85 + 0.05);
}

export async function indexArtifactVectors(
  sandbox: SessionSandbox,
  artifact: InternalArtifactRecord
): Promise<{ usedFallback: boolean; dims: number; durationMs: number }> {
  const start = Date.now();
  sandbox.artifacts.set(artifact.id, artifact);

  if (artifact.status === 'error' || artifact.chunks.length === 0) {
    return { usedFallback: false, dims: 0, durationMs: Date.now() - start };
  }

  let usedFallback = false;
  let dims = 0;

  try {
    const ai = getGeminiClient();

    // Remove previous vectors for this artifact if re-uploaded
    sandbox.vectors = sandbox.vectors.filter((v) => v.chunk.artifactId !== artifact.id);

    if (
      (artifact.modality === 'image' ||
        artifact.modality === 'audio' ||
        artifact.mimeType === 'application/pdf') &&
      artifact.inlineBase64
    ) {
      const chunk = artifact.chunks[0];
      const result = await withRetry(
        () =>
          ai.models.embedContent({
            model: 'gemini-embedding-2',
            contents: [
              `Artifact filename: ${artifact.name}. ${chunk.text}`,
              {
                inlineData: {
                  data: artifact.inlineBase64!,
                  mimeType: artifact.mimeType,
                },
              },
            ],
          }),
        1
      );
      const vector = result.embeddings?.[0]?.values ?? null;
      if (vector && vector.length > 0) {
        dims = vector.length;
        sandbox.embeddingDims = dims;
        artifact.embeddingDims = dims;
      } else {
        usedFallback = true;
      }
      sandbox.vectors.push({ chunk, vector });
    } else {
      // Batch embed text/code/tabular chunks cleanly (up to 64 vector chunks; remaining chunks preserved for lexical search)
      const MAX_EMBED_CHUNKS = 64;
      const chunksToEmbed = artifact.chunks.slice(0, MAX_EMBED_CHUNKS);
      const remainingChunks = artifact.chunks.slice(MAX_EMBED_CHUNKS);
      const batchSize = 8;
      for (let i = 0; i < chunksToEmbed.length; i += batchSize) {
        const slice = chunksToEmbed.slice(i, i + batchSize);
        const result = await withRetry(
          () =>
            ai.models.embedContent({
              model: 'gemini-embedding-2',
              contents: slice.map((c) => `File: ${c.artifactName} (${c.lineRange ?? ''})\n${c.text}`),
            }),
          1
        );
        const embeddings = result.embeddings ?? [];
        slice.forEach((chunk, idx) => {
          const vector = embeddings[idx]?.values ?? null;
          if (vector && vector.length > 0) {
            dims = vector.length;
            sandbox.embeddingDims = dims;
            artifact.embeddingDims = dims;
          } else {
            usedFallback = true;
          }
          sandbox.vectors.push({ chunk, vector });
        });
      }
      for (const tailChunk of remainingChunks) {
        sandbox.vectors.push({ chunk: tailChunk, vector: null });
      }
    }
  } catch (err) {
    usedFallback = true;
    artifact.status = 'fallback';
    for (const chunk of artifact.chunks) {
      sandbox.vectors.push({ chunk, vector: null });
    }
    appendLog(sandbox, {
      phase: 'EMBEDDING',
      title: `Lexical fallback activated for ${artifact.name}`,
      detail:
        err instanceof Error
          ? `Vector embedding fell back to local lexical indexing (${err.message}).`
          : 'Vector embedding fell back to local lexical indexing.',
      status: 'warning',
    });
  }

  return { usedFallback, dims, durationMs: Date.now() - start };
}

export async function searchSessionIndex(
  sandbox: SessionSandbox,
  query: string,
  topK = 6
): Promise<{ matches: RagMatch[]; mode: 'vector' | 'lexical'; durationMs: number }> {
  const start = Date.now();
  if (sandbox.vectors.length === 0) {
    return { matches: [], mode: 'vector', durationMs: 0 };
  }

  let queryVector: number[] | null = null;
  let mode: 'vector' | 'lexical' = 'vector';

  const hasAnyVectors = sandbox.vectors.some((v) => v.vector && v.vector.length > 0);
  if (hasAnyVectors) {
    try {
      const ai = getGeminiClient();
      const res = await withRetry(
        () =>
          ai.models.embedContent({
            model: 'gemini-embedding-2',
            contents: [query],
          }),
        1
      );
      queryVector = res.embeddings?.[0]?.values ?? null;
    } catch {
      mode = 'lexical';
    }
  } else {
    mode = 'lexical';
  }

  const scored: RagMatch[] = sandbox.vectors.map((record) => {
    const score =
      queryVector && record.vector
        ? cosineSimilarity(queryVector, record.vector)
        : lexicalScore(query, `${record.chunk.artifactName} ${record.chunk.text}`) *
          (queryVector ? 0.85 : 1);
    return {
      chunkId: record.chunk.chunkId,
      artifactId: record.chunk.artifactId,
      artifactName: record.chunk.artifactName,
      modality: record.chunk.modality,
      score: Number(Math.max(0, Math.min(1, score)).toFixed(4)),
      excerpt: record.chunk.text,
      lineRange: record.chunk.lineRange,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return {
    matches: scored.slice(0, topK),
    mode: queryVector ? 'vector' : 'lexical',
    durationMs: Date.now() - start,
  };
}

export function removeArtifactFromSandbox(sandbox: SessionSandbox, artifactId: string): boolean {
  const existed = sandbox.artifacts.delete(artifactId);
  sandbox.vectors = sandbox.vectors.filter((v) => v.chunk.artifactId !== artifactId);
  return existed;
}

export function serializeArtifactSummary(record: InternalArtifactRecord): IngestedArtifact {
  return {
    id: record.id,
    name: record.name,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    modality: record.modality,
    status: record.status,
    errorMessage: record.errorMessage,
    chunkCount: record.chunkCount,
    embeddingModel: record.embeddingModel,
    embeddingDims: record.embeddingDims,
    textPreview: record.textPreview,
    tabularMeta: record.tabularMeta,
    imageDataUrl: record.imageDataUrl,
    createdAt: record.createdAt,
  };
}

export function getSessionStateResponse(sandbox: SessionSandbox): SessionStateResponse {
  const artifacts = Array.from(sandbox.artifacts.values()).map(serializeArtifactSummary);
  const totalVectors = sandbox.vectors.filter((v) => v.vector !== null).length;
  return {
    sessionId: sandbox.sessionId,
    artifacts,
    logs: sandbox.logs,
    plans: sandbox.plans,
    actions: sandbox.actions,
    messages: sandbox.messages,
    vectorStats: {
      totalChunks: sandbox.vectors.length,
      totalVectors,
      embeddingDims: sandbox.embeddingDims,
      embeddingModel: 'gemini-embedding-2',
    },
  };
}
