/**
 * webviewFsProbe — WPS 加载项 webview 的文件系统旁路探针。
 *
 * 背景（2026-09-09 排障）：WPS 12.1.28492 的 jsaddons 安全层可把加载项到
 * 127.0.0.1 的环回 fetch 全部拦截（jsaddinblockhost.ini 拉黑），此时页内
 * healthz 失败会被误报为「本机文档服务未就绪」，而 sidecar 进程其实健在。
 *
 * 本模块用 Application.FileSystem（文档编辑器天然可读用户路径）做旁路判定：
 *   - probeSidecarHeartbeat：读 sidecar 每 3s 写的 runtime/sidecar-heartbeat.json
 *     → alive=true 且 healthz fetch 失败 = 环回被掐；alive=false = 进程没起
 *   - readJsaddinBlocklist：读 WPS 的 jsaddons 拦截表条目数（仅诊断展示）
 *
 * 全部 best-effort：dev（http origin）或 FileSystem 不可用时返回 null，
 * 调用方回落原有行为。
 */

const HEARTBEAT_MAX_AGE_MS = 15000 // sidecar 3s 一写，15s 内视为存活

function isWindowsLike() {
  const ua = String(navigator?.userAgent || '').toLowerCase()
  const plat = String(navigator?.platform || '').toLowerCase()
  return /windows|win32|win64|wow64/.test(ua) || /^win/.test(plat)
}

/** 从 file:// 加载项路径推导用户主目录（macOS/Linux/Windows 各自的 jsaddons 布局） */
function guessHomeDir() {
  const hrefs = [
    String(window.location?.href || ''),
    String(window.Application?.PluginStorage?.getItem?.('AddinBaseUrl') || '')
  ].join(' ')
  const flat = hrefs.replace(/\\/g, '/')
  // macOS / Linux: /Users/<u>/… 或 /home/<u>/…
  const unix = flat.match(/(?:file:\/\/)?\/(Users|home)\/([^/]+)\//i)
  if (unix) return `/${unix[1]}/${unix[2]}`
  // Windows: C:/Users/<u>/…
  const win = flat.match(/([A-Za-z]:)\/Users\/([^/]+)\//i)
  if (win) return `${win[1]}\\Users\\${win[2]}`
  return ''
}

function readTextViaHost(filePath) {
  try {
    const fs = window.Application?.FileSystem
    if (!fs) return null
    const raw = fs.readFileString ? fs.readFileString(filePath) : fs.ReadFile(filePath)
    if (raw === undefined || raw === null || raw === '') return null
    return String(raw)
  } catch {
    return null
  }
}

/**
 * @returns {{alive: boolean, ageMs: number, at: number, pid: number}|null}
 *   null = 无法探测（非 file 安装 / FileSystem 不可用 / 找不到文件）
 */
export function probeSidecarHeartbeat() {
  try {
    if (window.location?.protocol !== 'file:') return null
    const home = guessHomeDir()
    if (!home) return null
    const candidates = isWindowsLike()
      ? [`${home}\\AppData\\Local\\chayuan-wps\\mcp\\runtime\\sidecar-heartbeat.json`]
      : [`${home}/.config/chayuan-wps/mcp/runtime/sidecar-heartbeat.json`]
    for (const p of candidates) {
      const raw = readTextViaHost(p)
      if (!raw) continue
      const data = JSON.parse(raw)
      const at = Number(data?.at || 0)
      if (!at) continue
      const ageMs = Date.now() - at
      return { alive: ageMs >= 0 && ageMs < HEARTBEAT_MAX_AGE_MS, ageMs, at, pid: Number(data?.pid || 0) }
    }
    return null
  } catch {
    return null
  }
}

/**
 * 读 WPS jsaddons 拦截表（.ini，键=值 哈希行）。仅统计条目数供诊断展示。
 * @returns {{present: boolean, entries: number}|null} null = 读不到（http dev / 非文件安装）
 */
export function readJsaddinBlocklist() {
  try {
    if (window.location?.protocol !== 'file:') return null
    const home = guessHomeDir()
    let iniPath = ''
    if (home) {
      iniPath = isWindowsLike()
        ? `${home}\\AppData\\Roaming\\kingsoft\\wps\\jsaddons\\jsaddinblockhost.ini`
        : `${home}/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons/jsaddinblockhost.ini`
    } else {
      // 兜底：从自身 file:// URL 反推 jsaddons 目录（…/jsaddons/<addon>/index.html）
      const dir = String(window.location?.href || '').split('#')[0].replace(/\/[^/]*$/, '')
      const m = dir.match(/^(.*jsaddons)\/[^/]+$/i)
      if (!m) return null
      iniPath = `${m[1]}/jsaddinblockhost.ini`
    }
    const raw = readTextViaHost(iniPath)
    if (raw === null) return { present: false, entries: 0 }
    const entries = raw
      .split(/\r?\n/)
      .filter((line) => line.includes('=') && !line.trim().startsWith('[') && line.trim().length > 0)
      .length
    return { present: entries > 0, entries }
  } catch {
    return null
  }
}
