/**
 * taskKernel — 统一任务内核(T-1.1)
 *
 * 给 5 类 runner(assistant / multimodal / spell-check / workflow / 自定义)提供:
 *   - 统一状态机(8 状态)
 *   - 统一进度模型(0..1 + 文字 stage)
 *   - 统一控制接口(start / pause / resume / cancel / retry / archive)
 *   - 统一 ID 命名(<kind>_<timestamp>_<rand>)
 *   - 统一元数据(kind / starter / docPath / parentTaskId / tags)
 *
 * 现有 runner 通过 `adaptTask(legacyTask, runner)` 接入,改动量近零。
 * 新 runner 直接基于 kernel 创建。
 *
 * 不动 taskListStore — kernel 是 wrapper 层,保留 store 的 sync 能力。
 */

/* ────────── 状态机 ────────── */

export const STATUS = Object.freeze({
  PENDING:   'pending',     // 创建后未开始
  QUEUED:    'queued',      // 在 opQueue 等 leader
  RUNNING:   'running',     // 正在执行
  PAUSED:    'paused',      // 暂停(human-confirm 等)
  COMPLETED: 'completed',
  FAILED:    'failed',
  CANCELLED: 'cancelled',
  ARCHIVED:  'archived'     // 归档(老任务移出主列表)
})

const VALID_TRANSITIONS = {
  [STATUS.PENDING]:   [STATUS.QUEUED, STATUS.RUNNING, STATUS.CANCELLED],
  [STATUS.QUEUED]:    [STATUS.RUNNING, STATUS.CANCELLED],
  [STATUS.RUNNING]:   [STATUS.PAUSED, STATUS.COMPLETED, STATUS.FAILED, STATUS.CANCELLED],
  [STATUS.PAUSED]:    [STATUS.RUNNING, STATUS.CANCELLED, STATUS.FAILED],
  [STATUS.COMPLETED]: [STATUS.ARCHIVED],
  [STATUS.FAILED]:    [STATUS.RUNNING, STATUS.ARCHIVED],   // 允许重试 + 归档
  [STATUS.CANCELLED]: [STATUS.ARCHIVED],
  [STATUS.ARCHIVED]:  []  // 终态
}

export function canTransition(from, to) {
  return VALID_TRANSITIONS[from]?.includes(to) || false
}

/* ────────── Task 标准化 ────────── */

export const TASK_KINDS = Object.freeze([
  'assistant',     // 助手任务
  'workflow',      // 工作流
  'spell-check',
  'multimodal',
  'evaluation',
  'evolution',     // 进化系统的 cycle
  'custom'
])

let _seqCounter = 0
function makeTaskId(kind = 'task') {
  return `${kind}_${Date.now().toString(36)}_${(++_seqCounter).toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

/**
 * 创建一个标准 task 记录。给 runner 用。
 */
export function createTask(input = {}) {
  const kind = TASK_KINDS.includes(input.kind) ? input.kind : 'custom'
  const now = Date.now()
  return {
    id: input.id || makeTaskId(kind),
    kind,
    title: String(input.title || '').slice(0, 120),
    description: String(input.description || '').slice(0, 500),
    status: STATUS.PENDING,
    progress: 0,           // 0..1
    stage: '',             // 文字 stage 标签
    current: 0, total: 0,  // 子项进度(分段任务)

    // 元数据
    starter: input.starter || 'user',     // user / system / scheduled / auto-evolution
    starterUserId: input.starterUserId || '',
    parentTaskId: input.parentTaskId || '',  // 子任务时指向父
    docPath: input.docPath || '',
    tags: Array.isArray(input.tags) ? [...input.tags] : [],

    // 业务字段(各 kind 自定义,但放在标准 metadata 里避免散乱)
    metadata: input.metadata && typeof input.metadata === 'object' ? { ...input.metadata } : {},

    // 趣味性字段
    starred: input.starred === true,
    achievement: '',  // 触发的成就(若有)

    // 时间戳
    createdAt: now,
    startedAt: 0,
    endedAt: 0,
    updatedAt: now,

    // 输出
    output: null,           // 结果(纯文本 / JSON 都可)
    outputPreview: '',
    error: null,            // { userMessage, technicalMessage, code, stack }

    // 控制
    canCancel: input.canCancel !== false,
    canRetry: input.canRetry !== false,
    canPause: input.canPause === true,    // 默认不可暂停
    abortController: null   // 由 runner 注入
  }
}

/* ────────── 状态变更 ────────── */

/**
 * 安全转换状态。返回 { ok, error }。
 * 不写入存储(由 runner 自己调 store.updateTask),但更新 task 对象的字段。
 */
export function transitionStatus(task, nextStatus, options = {}) {
  if (!task) return { ok: false, error: 'task 为空' }
  const cur = task.status
  if (cur === nextStatus) return { ok: true, noChange: true }
  if (!canTransition(cur, nextStatus)) {
    return { ok: false, error: `不允许的状态转换: ${cur} → ${nextStatus}` }
  }
  task.status = nextStatus
  task.updatedAt = Date.now()
  if (nextStatus === STATUS.RUNNING && !task.startedAt) {
    task.startedAt = task.updatedAt
  }
  if (nextStatus === STATUS.COMPLETED || nextStatus === STATUS.FAILED || nextStatus === STATUS.CANCELLED) {
    task.endedAt = task.updatedAt
  }
  if (options.error) task.error = options.error
  if (options.output != null) task.output = options.output
  return { ok: true, prev: cur, next: nextStatus }
}

/* ────────── 进度更新 ────────── */

/**
 * 更新进度。0..1 之间;不到 1 不算 done。
 */
export function updateProgress(task, progress, stage = '', current = 0, total = 0) {
  if (!task) return
  task.progress = Math.max(0, Math.min(1, Number(progress) || 0))
  if (stage) task.stage = String(stage).slice(0, 60)
  if (current >= 0) task.current = current
  if (total >= 0) task.total = total
  task.updatedAt = Date.now()
}

/* ────────── 错误归一化 ────────── */

const TECH_TO_USER_HINT = [
  { match: /ENOTFOUND|ECONNREFUSED|fetch failed/i, user: '网络异常,请检查 API 地址 / 网络连接' },
  { match: /401|unauthorized|invalid api key/i,    user: 'API key 无效或已过期,请到设置中重新配置' },
  { match: /403|forbidden/i,                        user: '当前账户无权访问此模型,请在设置中检查 provider 权限' },
  { match: /429|rate limit|too many requests/i,    user: '请求过于频繁,稍等几秒再试,或在设置中切换 provider' },
  { match: /500|internal server error/i,            user: '服务端异常,请稍后再试' },
  { match: /503|overloaded/i,                       user: '模型当前过载,稍后再试或切换其它模型' },
  { match: /timeout|timed out/i,                    user: '请求超时,文档过大或网络慢;可尝试缩小选区' },
  { match: /aborted|AbortError/i,                   user: '已取消' },
  { match: /context length|maximum.+tokens/i,       user: '内容过长,请缩小选区或分段处理' },
  { match: /quota/i,                                user: '当前配额已用尽,请联系管理员' },
  { match: /JSON|parse/i,                           user: '模型输出格式异常,可在设置中开启「强制 JSON 输出」' }
]

export function normalizeError(err) {
  if (!err) return null
  const msg = String(err?.message || err || '')
  let userMessage = '执行失败,请查看技术详情'
  for (const rule of TECH_TO_USER_HINT) {
    if (rule.match.test(msg)) {
      userMessage = rule.user
      break
    }
  }
  return {
    userMessage,
    technicalMessage: msg.slice(0, 300),
    code: err?.code || '',
    stack: typeof err?.stack === 'string' ? err.stack.slice(0, 500) : ''
  }
}

/* ────────── 辅助 ────────── */

/**
 * 计算耗时(ms)
 */
export function getDuration(task) {
  if (!task?.startedAt) return 0
  return (task.endedAt || Date.now()) - task.startedAt
}

/**
 * 把 task 简化为 toast 友好的摘要
 */
export function summarizeForToast(task) {
  if (!task) return ''
  const tdur = getDuration(task)
  const dur = tdur >= 1000 ? `${(tdur / 1000).toFixed(1)}s` : `${tdur}ms`
  switch (task.status) {
    case STATUS.COMPLETED: return `${task.title}(${dur})`
    case STATUS.FAILED:    return `${task.title}失败:${task.error?.userMessage || ''}`
    case STATUS.CANCELLED: return `${task.title}已取消`
    case STATUS.RUNNING:   return `${task.title}进行中…(${Math.round(task.progress * 100)}%)`
    default: return task.title
  }
}

/**
 * 适配旧 task 对象到 kernel 标准。
 * 用于现有 runner:`adaptTask(legacyAssistantTask) → standardTask`。
 */
export function adaptTask(legacyTask) {
  if (!legacyTask) return null
  // 旧 status 映射
  const statusMap = {
    pending: STATUS.PENDING,
    queued: STATUS.QUEUED,
    running: STATUS.RUNNING,
    paused: STATUS.PAUSED,
    completed: STATUS.COMPLETED,
    done: STATUS.COMPLETED,
    finished: STATUS.COMPLETED,
    failed: STATUS.FAILED,
    error: STATUS.FAILED,
    cancelled: STATUS.CANCELLED,
    canceled: STATUS.CANCELLED,
    archived: STATUS.ARCHIVED
  }
  const status = statusMap[String(legacyTask.status || '').toLowerCase()] || STATUS.PENDING
  return {
    ...createTask({
      id: legacyTask.id,
      kind: legacyTask.kind || legacyTask.type || 'custom',
      title: legacyTask.title || legacyTask.name || '',
      description: legacyTask.description || '',
      starter: legacyTask.starter || (legacyTask.launchSource ? 'user' : 'system'),
      starterUserId: legacyTask.starterUserId,
      docPath: legacyTask.docPath || legacyTask.documentPath,
      tags: legacyTask.tags || [],
      metadata: legacyTask.data || legacyTask.metadata || {},
      starred: legacyTask.starred,
      canCancel: legacyTask.canCancel !== false,
      canRetry: legacyTask.canRetry !== false
    }),
    status,
    progress: typeof legacyTask.progress === 'number'
      ? Math.max(0, Math.min(1, legacyTask.progress > 1 ? legacyTask.progress / 100 : legacyTask.progress))
      : 0,
    stage: legacyTask.data?.progressStage || legacyTask.stage || '',
    current: legacyTask.current || 0,
    total: legacyTask.total || 0,
    output: legacyTask.output || legacyTask.data?.fullOutput || null,
    outputPreview: legacyTask.outputPreview || legacyTask.data?.outputPreview || '',
    createdAt: legacyTask.createdAt || legacyTask.timestamp || Date.now(),
    startedAt: legacyTask.startedAt || 0,
    endedAt: legacyTask.endedAt || 0,
    updatedAt: legacyTask.updatedAt || Date.now()
  }
}

export default {
  STATUS,
  TASK_KINDS,
  canTransition,
  createTask,
  transitionStatus,
  updateProgress,
  normalizeError,
  getDuration,
  summarizeForToast,
  adaptTask
}
