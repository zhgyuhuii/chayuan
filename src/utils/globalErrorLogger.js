import { ensureDir, getDefaultLogDir, getEffectiveDataDir, normalizeDataPath, pathJoin } from './dataPathSettings.js'

/** 已配置「数据路径」时，日志放在该目录下的子文件夹名 */
const LOG_SUBDIR = 'logs'

/** 单文件最大字节数（超出则同一天的下一个分片：YYYY-M-D.2.log …） */
const MAX_LOG_FILE_BYTES = 5 * 1024 * 1024

/** 保留最近 N 个自然日的日志文件，更早的删除 */
const RETENTION_DAYS = 30

/** 自动清理最小间隔，避免每次写日志都扫目录 */
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000

/** 同一天最多分片数量（防止异常循环占满磁盘） */
const MAX_PARTS_PER_DAY = 500

/** 磁盘写入失败时写入 PluginStorage/localStorage，键名（JSON 字符串数组） */
const FALLBACK_STORAGE_KEY = 'NdErrorLogFallback'
const MAX_FALLBACK_LINES = 100

/**
 * 尽量解析 WPS Application（iframe / 多窗时可能在 parent、top 上）
 */
function getApplication() {
  if (typeof window === 'undefined') return null
  if (window.Application) return window.Application
  try {
    if (window.top && window.top !== window && window.top.Application) {
      return window.top.Application
    }
  } catch (e) {
    void e
  }
  if (window.opener?.Application) return window.opener.Application
  if (window.parent?.Application) return window.parent.Application
  try {
    let w = window.parent
    for (let i = 0; i < 6 && w; i++) {
      if (w.Application) return w.Application
      if (w === w.parent) break
      w = w.parent
    }
  } catch (e) {
    void e
  }
  return null
}

let lastCleanupAt = 0

/** 本次 writeLogLine 未写盘原因：'no_fs' | '' */
let lastDiskSkipReason = ''

let warnedFileSystemUnavailable = false

function warnFileSystemUnavailableOnce() {
  if (warnedFileSystemUnavailable) return
  warnedFileSystemUnavailable = true
  const app = getApplication()
  if (!app) {
    console.warn(
      '[GlobalErrorLogger] 无 WPS Application.FileSystem（常见于用浏览器直接打开本地调试页）。异常仍会写入 NdErrorLogFallback；在 WPS 内打开加载项后可写磁盘日志。'
    )
  } else {
    console.warn('[GlobalErrorLogger] Application 已找到但 FileSystem 不可用，异常已写入 NdErrorLogFallback。')
  }
}

function isAbsoluteFsPath(p) {
  if (!p || typeof p !== 'string') return false
  const s = p.trim()
  if (s.startsWith('/')) return true
  return /^[A-Za-z]:[\\/]/.test(s)
}

/** 将相对路径转为绝对路径（WPS FileSystem 对相对路径常写入失败） */
function resolveAbsoluteFsPath(fs, p) {
  if (!p) return p
  const s = String(p).trim()
  if (isAbsoluteFsPath(s)) return s.replace(/[/\\]+$/, '')
  if (fs && typeof fs.absoluteFilePath === 'function') {
    try {
      const abs = fs.absoluteFilePath(s)
      if (abs && isAbsoluteFsPath(String(abs))) {
        return String(abs).replace(/[/\\]+$/, '')
      }
    } catch (e) {
      void e
    }
  }
  return s
}

/** WPS FileSystem 在 macOS 上常要求原生分隔符 */
function normalizeFsPathForWps(fs, p) {
  if (!p || !fs) return p
  if (typeof fs.toNativeSeparators === 'function') {
    try {
      return String(fs.toNativeSeparators(p))
    } catch (e) {
      void e
    }
  }
  return p
}

/** 启动探测写入后删除，用于确认目录可写 */
const LOG_DIR_PROBE_FILE = '.chayuan_log_dir_probe'

function tryEnsureLogDir(fs, dirPath) {
  let p = normalizeFsPathForWps(fs, resolveAbsoluteFsPath(fs, dirPath))
  ensureDir(fs, p)
  if (typeof fs.mkdirSync === 'function') {
    try {
      fs.mkdirSync(p)
    } catch (e) {
      void e
    }
  }
  if (typeof fs.existsSync === 'function' && !fs.existsSync(p)) {
    ensureDir(fs, p)
  }
  return p
}

/**
 * 探测目录是否可写：写入短文件再删除（与真实日志同一 API）
 */
function probeLogDirWritable(fs, logsDir) {
  if (!logsDir || !fs) return false
  const probePath = normalizeFsPathForWps(fs, pathJoin(logsDir, LOG_DIR_PROBE_FILE))
  const write = fs.writeFileString || fs.WriteFile
  if (typeof write !== 'function') return false
  try {
    if (!write.call(fs, probePath, 'ok')) return false
    try {
      if (typeof fs.unlinkSync === 'function') fs.unlinkSync(probePath)
      else if (typeof fs.Remove === 'function') fs.Remove(probePath)
    } catch (e) {
      void e
    }
    return true
  } catch (e) {
    void e
    return false
  }
}

/** 启动时：对每个候选路径解析为绝对路径、递归创建目录、探测可写 */
function prepareLogDirectoriesOnInstall() {
  const fs = getApplication()?.FileSystem
  if (!fs) return
  const candidates = collectLogDirCandidates()
  const tried = []
  for (const raw of candidates) {
    if (!raw) continue
    let dir = tryEnsureLogDir(fs, raw)
    dir = resolveAbsoluteFsPath(fs, dir)
    dir = normalizeFsPathForWps(fs, dir)
    tryEnsureLogDir(fs, dir)
    const ok = probeLogDirWritable(fs, dir)
    tried.push({ dir, ok })
    if (ok) {
      return
    }
  }
  if (tried.length > 0) {
    console.warn('[GlobalErrorLogger] 启动时未能创建或可写任一日志目录（已尝试创建路径）', {
      tried,
      hint: '请确认「数据路径」所在磁盘可写，或检查 WPS 对路径的访问权限'
    })
  }
}

/**
 * 主目录失败时依次尝试：用户配置 logs → 系统默认日志目录 → %TEMP%/chayuan/logs
 */
function collectLogDirCandidates() {
  const seen = new Set()
  const out = []
  const push = (p) => {
    if (!p || typeof p !== 'string') return
    const t = p.trim()
    if (!t || seen.has(t)) return
    seen.add(t)
    out.push(t)
  }
  try {
    push(getLogsDir())
  } catch (e) {
    void e
  }
  try {
    push(getDefaultLogDir())
  } catch (e) {
    void e
  }
  try {
    const app = getApplication()
    if (app?.Env && typeof app.Env.GetTempPath === 'function') {
      const raw = String(app.Env.GetTempPath() || '')
        .replace(/^file:\/\//i, '')
        .replace(/[/\\]+$/g, '')
      if (raw) push(pathJoin(raw, 'chayuan', 'logs'))
    }
  } catch (e) {
    void e
  }
  return out
}

/**
 * 磁盘不可用时保留最近若干条 JSON 行，便于排查（闪退时仍可能丢失）
 */
function appendFallbackStorage(line) {
  try {
    const app = getApplication()
    let rows = []
    try {
      const raw = app?.PluginStorage?.getItem(FALLBACK_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) rows = parsed
      }
    } catch (e) {
      void e
    }
    if (rows.length === 0 && typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(FALLBACK_STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) rows = parsed
        }
      } catch (e) {
        void e
      }
    }
    rows.push(line)
    while (rows.length > MAX_FALLBACK_LINES) rows.shift()
    const out = JSON.stringify(rows)
    try {
      app?.PluginStorage?.setItem(FALLBACK_STORAGE_KEY, out)
    } catch (e) {
      void e
    }
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(FALLBACK_STORAGE_KEY, out)
    } catch (e) {
      void e
    }
  } catch (e) {
    void e
  }
}

/** 供调试：读取备用缓冲中的原始 JSON 行 */
export function getErrorLogFallbackLines() {
  try {
    const raw =
      getApplication()?.PluginStorage?.getItem(FALLBACK_STORAGE_KEY) ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem(FALLBACK_STORAGE_KEY) : null)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    return []
  }
}

function utf8ByteLength(s) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(s).length
  }
  try {
    return unescape(encodeURIComponent(s)).length
  } catch (e) {
    return String(s).length
  }
}

function normalizeValue(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    }
  }
  if (value && typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value))
    } catch (e) {
      return String(value)
    }
  }
  return value
}

function formatDateBaseName(date = new Date()) {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  return { y, m, d, base: `${y}-${m}-${d}` }
}

function partFileName(base, part) {
  if (part <= 1) return `${base}.log`
  return `${base}.${part}.log`
}

/** 当前实际写入错误日志的目录（与运行时一致） */
export function getEffectiveLogDir() {
  const configured = getEffectiveDataDir()
  if (configured) {
    return pathJoin(configured, LOG_SUBDIR)
  }
  return getDefaultLogDir()
}

/**
 * 根据设置页「数据路径」输入框内容，预览错误日志所在目录（留空则与未配置数据路径时的系统默认日志目录一致）
 */
export function getErrorLogDirectoryForDataPath(dataPathField) {
  const t = (dataPathField || '').trim()
  if (t) {
    return pathJoin(normalizeDataPath(t), LOG_SUBDIR)
  }
  return getDefaultLogDir()
}

function getLogsDir() {
  return getEffectiveLogDir()
}

function safeStringify(payload) {
  try {
    return JSON.stringify(payload)
  } catch (e) {
    return JSON.stringify({
      type: 'logger_serialize_failed',
      reason: String(e?.message || e)
    })
  }
}

function getFileSize(fs, path) {
  try {
    if (typeof fs.stat === 'function') {
      const st = fs.stat(path)
      if (st && typeof st.size === 'number') return st.size
    }
  } catch (e) {
    void e
  }
  return 0
}

function fileExists(fs, path) {
  try {
    if (typeof fs.existsSync === 'function') return fs.existsSync(path)
    if (typeof fs.Exists === 'function') return fs.Exists(path)
  } catch (e) {
    void e
  }
  return false
}

function appendToFile(fs, path, line) {
  const p = normalizeFsPathForWps(fs, path)
  try {
    const exists = fileExists(fs, p)
    const payload = exists ? `\n${line}` : line
    // 部分 WPS 版本对「不存在文件」调用 AppendFile 会失败，仅对已存在文件追加
    if (exists && typeof fs.AppendFile === 'function') {
      if (fs.AppendFile(p, payload)) return true
    }
    const readFile = fs.readFileString || fs.ReadFile
    let old = ''
    if (exists && typeof readFile === 'function') {
      try {
        old = String(readFile.call(fs, p) || '')
      } catch (e) {
        old = ''
      }
    }
    const content = old ? `${old}${payload}` : line
    if (typeof fs.writeFileString === 'function' && fs.writeFileString(p, content)) return true
    if (typeof fs.WriteFile === 'function' && fs.WriteFile(p, content)) return true
    const writeAny = fs.writeFileString || fs.WriteFile
    if (typeof writeAny === 'function') {
      return !!writeAny.call(fs, p, content)
    }
    return false
  } catch (e) {
    return false
  }
}

function removeFile(fs, path) {
  try {
    if (typeof fs.unlinkSync === 'function') return fs.unlinkSync(path)
    if (typeof fs.Remove === 'function') {
      fs.Remove(path)
      return true
    }
  } catch (e) {
    void e
  }
  return false
}

/**
 * 选择当日可写入的分片路径：优先已有未满文件，否则新建下一分片
 */
function resolveLogPathForLine(fs, logsDir, line) {
  const { base } = formatDateBaseName()

  for (let part = 1; part <= MAX_PARTS_PER_DAY; part++) {
    const name = partFileName(base, part)
    const full = normalizeFsPathForWps(fs, pathJoin(logsDir, name))
    const exists = fileExists(fs, full)
    if (!exists) {
      return full
    }
    const size = getFileSize(fs, full)
    const appendPayload = size > 0 ? `\n${line}` : line
    const addBytes = utf8ByteLength(appendPayload)
    if (size + addBytes <= MAX_LOG_FILE_BYTES) {
      return full
    }
  }
  return null
}

const LOG_NAME_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:\.(\d+))?\.log$/

function parseLogFileDate(name) {
  const m = String(name).match(LOG_NAME_RE)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!y || !mo || !d) return null
  return new Date(y, mo - 1, d)
}

function maybeCleanupOldLogs(fs, logsDir) {
  const now = Date.now()
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return
  lastCleanupAt = now

  if (!logsDir || typeof fs.readdirSync !== 'function') return

  let names = []
  try {
    names = fs.readdirSync(logsDir) || []
  } catch (e) {
    return
  }
  if (!Array.isArray(names) || names.length === 0) return

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const name of names) {
    if (!name || typeof name !== 'string' || !name.endsWith('.log')) continue
    const fileDate = parseLogFileDate(name)
    if (!fileDate) continue
    fileDate.setHours(0, 0, 0, 0)
    const diffDays = Math.floor((today - fileDate) / 86400000)
    if (diffDays > RETENTION_DAYS) {
      removeFile(fs, pathJoin(logsDir, name))
    }
  }
}

function writeLogLine(line) {
  lastDiskSkipReason = ''
  try {
    const app = getApplication()
    const fs = app?.FileSystem
    if (!fs) {
      appendFallbackStorage(line)
      lastDiskSkipReason = 'no_fs'
      warnFileSystemUnavailableOnce()
      return false
    }

    const candidates = collectLogDirCandidates()
    if (candidates.length === 0) {
      appendFallbackStorage(line)
      console.error('[GlobalErrorLogger] 日志未写入磁盘：无法解析日志目录')
      return false
    }

    const tried = []
    for (const rawDir of candidates) {
      let logsDir = tryEnsureLogDir(fs, rawDir)
      logsDir = resolveAbsoluteFsPath(fs, logsDir)

      const path = resolveLogPathForLine(fs, logsDir, line)
      if (!path) {
        tried.push({ dir: logsDir, error: 'no_shard' })
        continue
      }

      const targetPath = resolveAbsoluteFsPath(fs, path)
      const ok = appendToFile(fs, targetPath, line)
      if (ok) {
        maybeCleanupOldLogs(fs, logsDir)
        return true
      }
      tried.push({ dir: logsDir, file: targetPath, error: 'write_failed' })
    }

    appendFallbackStorage(line)
    console.error('[GlobalErrorLogger] 日志未写入磁盘：已尝试所有候选目录仍失败', {
      tried,
      hint: '若主目录不可写，请检查系统默认日志目录或 %TEMP%/chayuan/logs'
    })
    return false
  } catch (e) {
    appendFallbackStorage(line)
    console.error('[GlobalErrorLogger] 日志写入异常', e)
    return false
  }
}

function logError(type, payload) {
  const line = safeStringify({
    ts: new Date().toISOString(),
    type,
    ...payload
  })

  const ok = writeLogLine(line)
  if (!ok && lastDiskSkipReason !== 'no_fs') {
    console.error('[GlobalErrorLogger] 日志写入失败', line)
  }
}

export function installGlobalErrorLogger(app) {
  if (!app) return

  try {
    prepareLogDirectoriesOnInstall()
    const fs = getApplication()?.FileSystem
    const dir = getLogsDir()
    if (fs && dir) {
      const abs = tryEnsureLogDir(fs, dir)
      maybeCleanupOldLogs(fs, abs)
    }
  } catch (e) {
    void e
  }

  try {
    writeLogLine(
      safeStringify({
        ts: new Date().toISOString(),
        type: 'logger_boot',
        logsDir: getLogsDir(),
        ua: typeof navigator !== 'undefined' ? navigator.userAgent : ''
      })
    )
  } catch (e) {
    void e
  }

  app.config.errorHandler = (err, instance, info) => {
    logError('vue_error', {
      info: String(info || ''),
      error: normalizeValue(err),
      component: instance?.$options?.name || instance?.type?.name || ''
    })
    console.error('[Vue Error]', info, err)
    // 不在此处弹层：避免渲染期错误 → 弹窗 → 再次触发 Vue 更新形成递归。
  }

  // 仅记录日志，不在此处弹 DOM/剪贴板：在 CrBrowserMain 上与 WPS 桥并发时曾观察到宿主 abort（与 ksolite 崩溃报告一致）。
  window.addEventListener(
    'error',
    (event) => {
      logError('window_error', {
        message: String(event?.message || ''),
        filename: String(event?.filename || ''),
        lineno: Number(event?.lineno || 0),
        colno: Number(event?.colno || 0),
        error: normalizeValue(event?.error)
      })
      try {
        console.error('[window.error]', event?.message, event?.error)
      } catch (e) {
        void e
      }
    },
    true
  )

  window.addEventListener('unhandledrejection', (event) => {
    logError('unhandled_rejection', {
      reason: normalizeValue(event?.reason)
    })
    try {
      console.error('[unhandledrejection]', event?.reason)
    } catch (e) {
      void e
    }
  })
}
