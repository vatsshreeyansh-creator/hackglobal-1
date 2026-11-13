import { Type, type FunctionDeclaration } from '@google/genai';
import type {
  ExecutionLogEntry,
  ExecutionPlanArtifact,
  WebhookActionItem,
} from '../src/types/omniagent.ts';
import { appendLog, searchSessionIndex, type SessionSandbox } from './rag.ts';

export const omniAgentToolDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_vector_index',
    description:
      'Perform semantic cosine-similarity search across the local session vector index of ingested codebases, PDFs, spreadsheets, images, and audio artifacts.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Semantic search query targeting specific symbols, bottlenecks, schemas, or requirements.',
        },
        topK: {
          type: Type.INTEGER,
          description: 'Number of top matching chunks to retrieve (1 to 10).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'analyze_tabular_schema',
    description:
      'Inspect parsed column schemas, inferred types, null counts, and sample rows for an ingested CSV or Excel spreadsheet.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        fileName: {
          type: Type.STRING,
          description: 'Exact filename of the ingested CSV or Excel artifact.',
        },
      },
      required: ['fileName'],
    },
  },
  {
    name: 'generate_execution_plan',
    description:
      'Create a structured multi-step engineering execution blueprint in the Execution Logs & Agent Actions sidebar, breaking down identified bottlenecks into actionable phases.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: 'Concise title of the execution plan.',
        },
        bottleneckSummary: {
          type: Type.STRING,
          description: 'Technical summary of the root-cause bottlenecks or architectural gaps identified.',
        },
        steps: {
          type: Type.ARRAY,
          description: 'Ordered execution steps.',
          items: {
            type: Type.OBJECT,
            properties: {
              stepNumber: { type: Type.INTEGER },
              phase: { type: Type.STRING, description: 'e.g., Security, Database, Async Refactor, CI/CD' },
              title: { type: Type.STRING },
              actionType: { type: Type.STRING, description: 'e.g., Code Patch, Migration, Pipeline, Webhook' },
              targetArtifact: { type: Type.STRING },
              estimatedEffort: { type: Type.STRING, description: 'e.g., 15m, 1h' },
            },
            required: ['stepNumber', 'phase', 'title', 'actionType', 'targetArtifact', 'estimatedEffort'],
          },
        },
      },
      required: ['title', 'bottleneckSummary', 'steps'],
    },
  },
  {
    name: 'dispatch_webhook_action',
    description:
      'Stage a secure local webhook hook and runnable script routine targeting Git, CI/CD, Storage Buckets, Task Managers, or Databases.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetSystem: {
          type: Type.STRING,
          description: 'One of: git, cicd, storage, tasks, database',
        },
        operation: {
          type: Type.STRING,
          description: 'Action verb & resource, e.g., Create Pull Request, Provision GitHub Workflow, Apply Migration',
        },
        endpointPath: {
          type: Type.STRING,
          description: 'Mock local webhook route, e.g., /hooks/git/create-pr or /hooks/tasks/sprint-sync',
        },
        summary: {
          type: Type.STRING,
          description: 'One-sentence summary of what the staged webhook payload executes.',
        },
        payloadJson: {
          type: Type.STRING,
          description: 'Valid JSON string payload for the webhook body.',
        },
        scriptFilename: {
          type: Type.STRING,
          description: 'Optional filename for the generated automation script (e.g., ci-pipeline.yml, migrate.sql, fix.py).',
        },
        scriptContent: {
          type: Type.STRING,
          description: 'Optional production-ready script or config content ready for local execution or download.',
        },
      },
      required: ['targetSystem', 'operation', 'endpointPath', 'summary', 'payloadJson'],
    },
  },
];

export interface ToolExecutionResult {
  responseObj: Record<string, unknown>;
  log: ExecutionLogEntry;
  newPlan?: ExecutionPlanArtifact;
  newAction?: WebhookActionItem;
}

export async function executeOmniAgentTool(
  sandbox: SessionSandbox,
  name: string,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const start = Date.now();

  if (name === 'search_vector_index') {
    const query = String(args.query ?? '').trim();
    const topK = Math.min(10, Math.max(1, Number(args.topK ?? 5)));
    const result = await searchSessionIndex(sandbox, query, topK);
    const log = appendLog(sandbox, {
      phase: 'RAG_RETRIEVAL',
      title: `Tool search_vector_index("${query.slice(0, 48)}")`,
      detail: `Retrieved ${result.matches.length} chunks via ${result.mode} similarity in ${result.durationMs}ms.`,
      durationMs: result.durationMs,
      status: 'completed',
      metadata: {
        topMatches: result.matches.map((m) => ({
          file: m.artifactName,
          lineRange: m.lineRange,
          score: m.score,
        })),
      },
    });

    return {
      responseObj: {
        mode: result.mode,
        matchCount: result.matches.length,
        matches: result.matches.map((m) => ({
          file: m.artifactName,
          lineRange: m.lineRange,
          score: m.score,
          excerpt: m.excerpt,
        })),
      },
      log,
    };
  }

  if (name === 'analyze_tabular_schema') {
    const fileName = String(args.fileName ?? '').trim();
    const artifact = Array.from(sandbox.artifacts.values()).find(
      (a) => a.name.toLowerCase() === fileName.toLowerCase()
    );
    if (!artifact || !artifact.tabularMeta) {
      const log = appendLog(sandbox, {
        phase: 'TOOL_CALL',
        title: `Tool analyze_tabular_schema("${fileName}")`,
        detail: `No parsed tabular artifact found matching "${fileName}".`,
        durationMs: Date.now() - start,
        status: 'warning',
      });
      return {
        responseObj: {
          error: `Tabular file "${fileName}" not found in sandbox.`,
          availableFiles: Array.from(sandbox.artifacts.values())
            .filter((a) => a.modality === 'tabular')
            .map((a) => a.name),
        },
        log,
      };
    }

    const log = appendLog(sandbox, {
      phase: 'TOOL_CALL',
      title: `Inspected tabular schema: ${artifact.name}`,
      detail: `${artifact.tabularMeta.rowCount} rows × ${artifact.tabularMeta.columnCount} columns analyzed.`,
      durationMs: Date.now() - start,
      status: 'completed',
    });

    return {
      responseObj: {
        fileName: artifact.name,
        tabularMeta: artifact.tabularMeta,
      },
      log,
    };
  }

  if (name === 'generate_execution_plan') {
    const rawSteps = Array.isArray(args.steps) ? args.steps : [];
    const plan: ExecutionPlanArtifact = {
      id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: String(args.title ?? 'Autonomous Execution Blueprint'),
      bottleneckSummary: String(args.bottleneckSummary ?? ''),
      steps: rawSteps.map((s: Record<string, unknown>, index: number) => ({
        stepNumber: Number(s.stepNumber ?? index + 1),
        phase: String(s.phase ?? 'Engineering'),
        title: String(s.title ?? `Step ${index + 1}`),
        actionType: String(s.actionType ?? 'Execution'),
        targetArtifact: String(s.targetArtifact ?? 'Workspace'),
        estimatedEffort: String(s.estimatedEffort ?? '15m'),
        status: 'ready',
      })),
      createdAt: new Date().toISOString(),
    };
    sandbox.plans.unshift(plan);
    if (sandbox.plans.length > 20) sandbox.plans = sandbox.plans.slice(0, 20);

    const log = appendLog(sandbox, {
      phase: 'REASONING',
      title: `Structured plan generated: ${plan.title}`,
      detail: `Decomposed into ${plan.steps.length} execution steps.`,
      durationMs: Date.now() - start,
      status: 'completed',
    });

    return {
      responseObj: {
        planId: plan.id,
        status: 'staged_in_ui',
        stepCount: plan.steps.length,
      },
      log,
      newPlan: plan,
    };
  }

  if (name === 'dispatch_webhook_action') {
    const rawTarget = String(args.targetSystem ?? 'git').toLowerCase();
    const targetSystem = (
      ['git', 'cicd', 'storage', 'tasks', 'database'].includes(rawTarget) ? rawTarget : 'git'
    ) as WebhookActionItem['targetSystem'];

    let formattedPayload = String(args.payloadJson ?? '{}');
    try {
      formattedPayload = JSON.stringify(JSON.parse(formattedPayload), null, 2);
    } catch {
      // Keep raw string if not strict JSON
    }

    const action: WebhookActionItem = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      targetSystem,
      operation: String(args.operation ?? 'Stage Automation Hook'),
      endpointPath: String(args.endpointPath ?? `/hooks/${targetSystem}/execute`),
      summary: String(args.summary ?? ''),
      payloadJson: formattedPayload,
      scriptFilename: args.scriptFilename ? String(args.scriptFilename) : undefined,
      scriptContent: args.scriptContent ? String(args.scriptContent) : undefined,
      status: 'staged',
      createdAt: new Date().toISOString(),
    };

    sandbox.actions.unshift(action);
    if (sandbox.actions.length > 30) sandbox.actions = sandbox.actions.slice(0, 30);

    const log = appendLog(sandbox, {
      phase: 'WEBHOOK_HOOK',
      title: `Staged ${targetSystem.toUpperCase()} hook: ${action.operation}`,
      detail: `Target ${action.endpointPath} ready for sandbox dispatch.`,
      durationMs: Date.now() - start,
      status: 'completed',
    });

    return {
      responseObj: {
        actionId: action.id,
        status: 'staged_for_user_dispatch',
        endpointPath: action.endpointPath,
      },
      log,
      newAction: action,
    };
  }

  const log = appendLog(sandbox, {
    phase: 'TOOL_CALL',
    title: `Unknown tool invocation: ${name}`,
    detail: 'Tool name was not registered in OmniAgent sandbox.',
    durationMs: Date.now() - start,
    status: 'error',
  });

  return {
    responseObj: { error: `Unknown tool "${name}"` },
    log,
  };
}
