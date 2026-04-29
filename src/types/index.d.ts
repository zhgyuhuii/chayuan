/**
 * 项目核心模块的 TypeScript 类型声明
 *
 * 即使主代码是 .js,IDE(VSCode)读 .d.ts 即能 autocomplete 和 type-check。
 * 此文件不参与运行,纯静态辅助。
 */

/* ────────── modelSettings ────────── */

export type ProviderId = 'OPENAI' | 'OLLAMA' | 'aliyun-bailian' | 'anthropic' | 'google' | 'deepseek' | 'zhipu' | 'moonshot' | 'doubao' | string

export interface ModelRecord {
  id: string                    // 'PROVIDER|model-id'
  providerId: ProviderId
  modelId: string
  name: string
  type?: 'chat' | 'embedding' | 'vision' | 'audio'
}

export interface ChatModel {
  providerId: ProviderId
  modelId: string
  ribbonModelId?: string
}

/* ────────── chatApi ────────── */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
  tool_call_id?: string
}

export interface ChatCompletionRequest extends ChatModel {
  messages: ChatMessage[]
  temperature?: number
  max_tokens?: number
  top_p?: number
  signal?: AbortSignal
  response_format?: { type: 'json_schema' | 'json_object'; json_schema?: object }
}

export type ChatCompletionResponse = string

/* ────────── 进化系统 ────────── */

export interface SignalRecord {
  id: string
  type: 'task' | 'thumbs' | 'accept' | 'reject' | 'audit' | 'feedback'
  assistantId: string
  version: string
  timestamp: number
  taskId?: string
  duration?: number
  success: boolean
  failureCode?: string
  userNote?: string
  documentAction?: string
  metadata?: Record<string, unknown>
}

export interface RaceHealth {
  R: number  // 0..100 Reliability
  A: number  // 0..100 Accuracy
  C: number  // 0..100 Compliance
  E: number  // 0..100 Efficiency
  total: number
  profile: string
  weights: { R: number; A: number; C: number; E: number }
  thresholds: { R: number; A: number; C: number; E: number; total: number }
  sampleCount: number
  driftScore: number
  drifted: boolean
  releaseGate: { allowed: boolean; reason: string }
  recommendedAction: 'publish' | 'review' | 'revise'
}

export interface CandidatePayload {
  candidate: {
    systemPrompt: string
    userPromptTemplate?: string
    description?: string
    persona?: string
    outputFormat?: string
    temperature?: number
  }
  rootCause?: string
  repairReason?: string
  diffSummary?: string[]
  sourceCluster?: string
}

export interface PromotionFlowDeps {
  listAssistants: () => unknown[] | Promise<unknown[]>
  getAssistant: (id: string) => unknown | Promise<unknown>
  addCandidateVersion: (id: string, candidateAssistant: unknown) => string | Promise<string>
  setActiveVersion: (id: string, versionId: string) => void | Promise<void>
  getActiveVersionId: (id: string) => string | Promise<string>
  runOnSamples: (candidateAssistant: unknown, samples: { input: string }[]) => Promise<string[]>
  model: ChatModel
}

export interface FlowSnapshot {
  id: string
  health: { R: number; A: number; C: number; E: number; total: number } | null
  shadow: { versionId: string; setAt: number; expiresAt: number } | null
  observation: {
    versionId: string
    previousVersionId: string
    startedAt: number
    expiresAt: number
    rolledBack: boolean
    sampleCount: number
  } | null
  anchorRegistered: boolean
}

/* ────────── ⌘K 命令面板 ────────── */

export interface CommandDescriptor {
  id: string
  title: string
  subtitle?: string
  icon?: string
  group?: string
  shortcut?: string
  keywords?: string[]
  handler: () => void | Promise<void>
  when?: () => boolean
  priority?: number
}

/* ────────── 助手 ────────── */

export interface AssistantDefinition {
  id: string
  label: string
  shortLabel?: string
  icon?: string
  group?: string
  modelType?: 'chat' | 'embedding' | 'vision'
  defaultModelCategory?: string
  supportsRibbon?: boolean
  defaultDisplayLocations?: string[]
  allowedActions?: string[]
  defaultAction?: string
  defaultOutputFormat?: 'plain' | 'markdown' | 'bullet-list' | 'json'
  defaultInputSource?: 'selection-preferred' | 'selection-only' | 'document'
  description?: string
  systemPrompt: string
  userPromptTemplate?: string
  temperature?: number
  gateProfile?: string
}

/* ────────── perfTracker ────────── */

export interface PerfRecord {
  ts: number
  kind: string
  providerId: string
  modelId: string
  durationMs: number
  ok: boolean
  bytes?: number
  note?: string
}

export interface PerfStats {
  count: number
  ok: number
  fail: number
  avg: number
  p50: number
  p95: number
  p99: number
  byKind: Record<string, { count: number; sum: number; fail: number; avg: number }>
  byModel: Record<string, { count: number; sum: number; fail: number; avg: number }>
  recent: PerfRecord[]
}

/* ────────── feature flags ────────── */

export type FeatureFlag =
  | 'enhancedSend'
  | 'shadowDoubleRun'
  | 'parallelChunksAuto'
  | 'rolloutBucketing'
  | 'personalMemoryInject'
  | 'rateLimiter'
  | 'experimentalAbortV2'
