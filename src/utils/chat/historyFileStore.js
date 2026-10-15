/**
 * 会话历史文件持久层（直写 Application.FileSystem，不经过 sidecar/环回 fetch）。
 *
 * 背景（真机缺陷："关闭 WPS 历史对话消失"，2026-10-15 第三轮）：
 * sidecar session-store 走 127.0.0.1 环回 fetch，而 WPS jsaddons 安全层会把
 * 加载项到环回的 fetch 全部拦截（webviewFsProbe.js 开篇注释，jsaddinblockhost.ini
 * 拉黑真机实证）；sidecar 未启动、token 缺失同样让持久层失效。三层故障面
 * （环回拦截/sidecar 未起/token 失效）任一命中 = 历史只在 PluginStorage 内存
 * 副本里，退出 WPS 即全部蒸发。
 *
 * 本层用 Application.FileSystem 直写用户数据目录（与模板库落盘同款 API，
 * 真机验证可用：documentTemplates.writeFileString/WriteFile）：
 *   <数据目录>/chat-history/<base64url(scopeKey)>.json
 *   内容与 sidecar 协议一致：{ historyJson, currentChatId, savedAt }
 * 数据目录复用 dataPathSettings（用户可配置；未配置用 OS 默认：
 *   mac=~/Library/Application Support/chayuan  win=%APPDATA%\chayuan  linux=~/.config/chayuan）
 *
 * 与 sidecar 层互为冗余：面板写穿双写、回读双源（savedAt 取新）。
 * 写序保护与 sidecar 同语义：existing.savedAt > savedAt 时拒写（乱序不盖新）。
 */
import { ensureDir, getDefaultDataPath, getEffectiveDataDir, pathJoin } from '../dataPathSettings.js'

function getFs() {
  try {
    return window.Application?.FileSystem || null
  } catch (_) {
    return null
  }
}

let _cachedDir = ''
let _dirFailed = false

/** 会话历史目录：<数据目录>/chat-history；解析失败返回 ''（调用方降级） */
export function getChatHistoryDir() {
  if (_cachedDir) return _cachedDir
  if (_dirFailed) return ''
  const fs = getFs()
  if (!fs) return ''
  try {
    const base = getEffectiveDataDir() || getDefaultDataPath()
    if (!base) {
      _dirFailed = true
      return ''
    }
    const dir = pathJoin(base, 'chat-history')
    try {
      ensureDir(fs, dir)
    } catch (_) { /* 已存在或失败——写入时再验证 */ }
    _cachedDir = dir
    return dir
  } catch (_) {
    _dirFailed = true
    return ''
  }
}

/** scopeKey → 安全文件名（base64url 防路径穿越/特殊字符；与 sidecar 落盘命名同构） */
export function historyFileName(scopeKey) {
  const raw = String(scopeKey || '').trim()
  if (!raw || raw.length > 200) return ''
  try {
    const b64 = typeof btoa === 'function'
      ? btoa(unescape(encodeURIComponent(raw)))
      : Buffer.from(raw, 'utf8').toString('base64url')
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '.json'
  } catch (_) {
    return ''
  }
}

function historyFilePath(scopeKey) {
  const dir = getChatHistoryDir()
  const name = historyFileName(scopeKey)
  if (!dir || !name) return ''
  return pathJoin(dir, name)
}

/** 诊断：报告文件层可用性（面板 scope_debug 探针用） */
export function describeHistoryFileStore() {
  const fs = getFs()
  const dir = getChatHistoryDir()
  return { fs: !!fs, dir }
}

/**
 * 写穿到文件层。savedAt 单调写序（旧不盖新）；fire-and-forget，失败静默。
 * 返回 true=已写入（诊断用，调用方一般不 await）。
 */
export function putHistoryFile(scopeKey, { historyJson, currentChatId, savedAt } = {}) {
  const filePath = historyFilePath(scopeKey)
  const fs = getFs()
  if (!filePath || !fs) return false
  try {
    const at = Number(savedAt) > 0 ? Number(savedAt) : Date.now()
    // 写序保护：拒旧（与 sidecar 同语义——双通道乱序到达时旧不盖新）
    try {
      const existingRaw = fs.readFileString
        ? fs.readFileString(filePath)
        : fs.ReadFile(filePath)
      if (existingRaw) {
        const existingAt = Number(JSON.parse(String(existingRaw)).savedAt || 0)
        if (existingAt > at) return false
      }
    } catch (_) { /* 无既存文件，直接写 */ }
    const payload = JSON.stringify({
      historyJson: String(historyJson || '[]'),
      currentChatId: String(currentChatId || ''),
      savedAt: at
    })
    const ok = fs.writeFileString
      ? !!fs.writeFileString(filePath, payload)
      : !!fs.WriteFile(filePath, payload)
    return ok
  } catch (_) {
    return false
  }
}

/**
 * 回读文件层。
 * @returns {Promise<{historyJson:string, currentChatId:string, savedAt:number}|null>} 未命中返回 null
 */
export async function fetchHistoryFile(scopeKey) {
  try {
    const filePath = historyFilePath(scopeKey)
    const fs = getFs()
    if (!filePath || !fs) return null
    const raw = fs.readFileString ? fs.readFileString(filePath) : fs.ReadFile(filePath)
    if (!raw) return null
    const data = JSON.parse(String(raw))
    if (!data || typeof data !== 'object') return null
    const historyJson = String(data.historyJson || '[]')
    if (!historyJson || historyJson === '[]') return null
    return {
      historyJson,
      currentChatId: String(data.currentChatId || ''),
      savedAt: Number(data.savedAt || 0)
    }
  } catch (_) {
    return null
  }
}
