/**
 * Best-effort sidecar start from WPS settings / assistant page.
 * MVP: probe healthz; try ShellExecute only on real local .cmd paths;
 * never pass http(s) URLs (WPS ShellExecute opens them as web pages).
 */
import { MCP_BASE_URL, MCP_HEALTHZ_URL, MCP_DEFAULT_PORT } from './config.js'
import { probeSidecar, syncTokenFromSidecar, setStoredToken, getStoredToken } from './agentClient.js'

const START_CMD_STORAGE_KEY = 'chayuan_mcp_start_cmd'

function stripHash(href) {
  return String(href || '').split('#')[0]
}

function isHttpUrl(s) {
  return /^https?:\/\//i.test(String(s || ''))
}

function isFileUrl(s) {
  return /^file:\/\//i.test(String(s || ''))
}

function pluginGet(key) {
  try {
    return String(window.Application?.PluginStorage?.getItem?.(key) || '').trim()
  } catch {
    return ''
  }
}

function pluginSet(key, value) {
  try {
    window.Application?.PluginStorage?.setItem?.(key, String(value || ''))
  } catch { /* ignore */ }
}

/**
 * Addon directory as file:// URL when running from disk install.
 * Vite http://127.0.0.1:xxxx must NOT be used as a ShellExecute target.
 */
function resolveLocalAddonRootFileUrl() {
  try {
    const stored = pluginGet('AddinBaseUrl')
    const storedClean = stripHash(stored).replace(/\/?index\.html$/i, '').replace(/\/+$/, '')
    if (storedClean && isFileUrl(storedClean)) return storedClean

    const href = stripHash(window.location?.href || '')
    if (window.location?.protocol === 'file:' && href) {
      return href.replace(/\/?index\.html$/i, '').replace(/\/+$/, '')
    }
  } catch { /* ignore */ }
  return ''
}

function guessWindowsUserLocalAppData() {
  // Browser cannot expand %LOCALAPPDATA%; approximate from file URL user folder if present.
  try {
    const href = stripHash(window.location?.href || '') + ' ' + pluginGet('AddinBaseUrl')
    const m = href.match(/\/([A-Za-z]:\/Users\/[^/]+)\//i) || href.match(/\/([A-Za-z]:\\Users\\[^\\]+)\\/i)
    if (m?.[1]) {
      const home = m[1].replace(/\//g, '\\')
      return `${home}\\AppData\\Local`
    }
  } catch { /* ignore */ }
  return ''
}

/**
 * Candidates for start script — local filesystem / file:// / known install paths only.
 */
export function getSidecarStartCandidates() {
  const list = []
  const remembered = pluginGet(START_CMD_STORAGE_KEY)
  if (remembered && !isHttpUrl(remembered)) list.push(remembered)

  const root = resolveLocalAddonRootFileUrl()
  if (root) {
    list.push(`${root}/mcp-sidecar/start-mcp.cmd`)
    list.push(`${root}/mcp-sidecar/spike-shell-marker.cmd`)
  }

  // Staged runtime from installer (Windows)
  const local = guessWindowsUserLocalAppData()
  if (local) {
    list.push(`${local}\\chayuan-wps\\mcp\\runtime\\start-mcp.cmd`)
  }
  // ShellExecute on Windows often expands env vars
  list.push('%LOCALAPPDATA%\\chayuan-wps\\mcp\\runtime\\start-mcp.cmd')

  // de-dupe
  const seen = new Set()
  return list.filter((p) => {
    if (!p || isHttpUrl(p)) return false
    const key = String(p).toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function getManualStartCommand() {
  return {
    port: MCP_DEFAULT_PORT,
    url: `${MCP_BASE_URL}/mcp`,
    healthz: MCP_HEALTHZ_URL,
    commands: [
      'npm run mcp:sidecar',
      'node mcp-sidecar/server.mjs',
      'cd mcp-sidecar && npm start'
    ],
    note: '请在本机终端启动 sidecar 后再点「测试连接」。开发态（Vite http 页）通常无法自动拉起进程。'
  }
}

function fileUrlToPath(url) {
  let s = String(url || '')
  if (isHttpUrl(s)) return ''
  if (isFileUrl(s)) {
    s = s.replace(/^file:\/\//i, '')
    s = s.replace(/^\/+/, '')
    if (/^localhost\//i.test(s)) s = s.replace(/^localhost\//i, '')
    try { s = decodeURIComponent(s) } catch { /* ignore */ }
  }
  if (!s) return ''
  // Keep %LOCALAPPDATA% style paths for ShellExecute
  if (s.includes('%')) return s.includes('/') && !s.includes('\\') ? s.replace(/\//g, '\\') : s
  // Windows drive path: C:/... or C:\...
  if (/^[a-zA-Z]:[\\/]/.test(s) || s.startsWith('\\\\')) {
    return s.includes('\\') ? s : s.replace(/\//g, '\\')
  }
  return ''
}

async function tryShellExecute(target) {
  if (isHttpUrl(target)) {
    console.warn('[sidecarLauncher] refuse ShellExecute on http(s) URL:', target)
    return false
  }
  const pathLike = fileUrlToPath(target) || String(target || '')
  if (!pathLike || !/\.(cmd|bat|exe)$/i.test(pathLike.replace(/%[^%]+%/g, 'x'))) {
    return false
  }
  try {
    const app = window.Application
    if (app?.OAAssist?.ShellExecute) {
      app.OAAssist.ShellExecute(pathLike)
      pluginSet(START_CMD_STORAGE_KEY, pathLike)
      return true
    }
  } catch (e) {
    console.warn('[sidecarLauncher] ShellExecute failed:', e)
  }
  return false
}

/**
 * Attempt to start sidecar. Returns status object.
 */
export async function startSidecarBestEffort() {
  const already = await probeSidecar()
  if (already.online) {
    await syncTokenFromSidecar()
    return { ok: true, started: false, alreadyRunning: true, ...already }
  }

  let launched = false
  const candidates = getSidecarStartCandidates()
  for (const candidate of candidates) {
    if (/\.cmd$/i.test(candidate) || /\.bat$/i.test(candidate) || /\.exe$/i.test(candidate) || /%LOCALAPPDATA%/i.test(candidate)) {
      launched = await tryShellExecute(candidate)
      if (launched) break
    }
  }

  // Wait briefly for healthz
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 500))
    const h = await probeSidecar()
    if (h.online) {
      await syncTokenFromSidecar()
      return { ok: true, started: launched, alreadyRunning: false, ...h }
    }
  }

  const onViteHttp = isHttpUrl(stripHash(window.location?.href || ''))
  return {
    ok: false,
    started: launched,
    code: 'SIDECAR_NOT_RUNNING',
    message: launched
      ? '已尝试拉起 sidecar，但 62588 端口仍未就绪。请确认已安装 Node.js，或在仓库根目录手动执行：npm run mcp:sidecar'
      : onViteHttp
        ? '本机 MCP sidecar（127.0.0.1:62588）未运行。开发态无法自动启动，请在仓库根目录终端执行：npm run mcp:sidecar'
        : '本机 MCP sidecar（127.0.0.1:62588）未运行，且无法自动拉起。请点击「启动本机服务」或手动执行：npm run mcp:sidecar',
    manual: getManualStartCommand()
  }
}

export async function ensureSidecarForProbe() {
  const result = await startSidecarBestEffort()
  if (result.ok) return result
  const err = new Error(result.message || 'SIDECAR_NOT_RUNNING')
  err.code = result.code || 'SIDECAR_NOT_RUNNING'
  err.manual = result.manual
  throw err
}

export async function stopSidecarHint() {
  return {
    ok: false,
    code: 'NOT_SUPPORTED',
    message: '请在运行 sidecar 的终端按 Ctrl+C 停止，或结束 chayuan-mcp / node server.mjs 进程。'
  }
}

export { probeSidecar, syncTokenFromSidecar, setStoredToken, getStoredToken, MCP_HEALTHZ_URL, MCP_BASE_URL }

export default {
  startSidecarBestEffort,
  ensureSidecarForProbe,
  stopSidecarHint,
  getManualStartCommand,
  probeSidecar,
  syncTokenFromSidecar
}
