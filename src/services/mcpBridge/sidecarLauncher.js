/**
 * Best-effort sidecar start from WPS settings / assistant page.
 * Prefer packaged native binary (no Node.js); fall back to start-mcp.cmd / node.
 * Never pass http(s) URLs to ShellExecute (WPS opens them as web pages).
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

function detectHostPlatform() {
  try {
    const ua = String(navigator?.userAgent || navigator?.platform || '').toLowerCase()
    const plat = String(navigator?.platform || '').toLowerCase()
    if (/windows|win32|win64|wow64/.test(ua) || /^win/.test(plat)) return 'windows'
    if (/mac os x|macintosh|macintel|macppc|mac68k/.test(ua) || /mac/.test(plat)) return 'macos'
    if (/linux|x11|cros/.test(ua) || /linux/.test(plat)) return 'linux'
  } catch { /* ignore */ }
  return 'unknown'
}

function detectCpuArch() {
  try {
    const ua = String(navigator?.userAgent || '').toLowerCase()
    const plat = String(navigator?.platform || '').toLowerCase()
    // Apple Silicon often reports MacIntel in browsers; prefer ua hints then fallback.
    if (/arm64|aarch64/.test(ua) || /arm64|aarch64/.test(plat)) return 'arm64'
    if (/x86_64|win64|wow64|amd64|intel/.test(ua) || /x86_64|intel|macintel/.test(plat)) return 'x64'
  } catch { /* ignore */ }
  // macOS packaged installs are predominantly arm64 in 2024+
  return detectHostPlatform() === 'macos' ? 'arm64' : 'x64'
}

function sidecarBinaryName(platform = detectHostPlatform(), arch = detectCpuArch()) {
  if (platform === 'windows') return 'chayuan-mcp-windows-x64.exe'
  if (platform === 'macos') return `chayuan-mcp-macos-${arch}`
  if (platform === 'linux') return `chayuan-mcp-linux-${arch}`
  return ''
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

function guessHomeDirFromUrls() {
  try {
    const href = `${stripHash(window.location?.href || '')} ${pluginGet('AddinBaseUrl')}`
    // Windows: C:/Users/<name> or C:\Users\<name>
    const win = href.match(/\/([A-Za-z]:\/Users\/[^/]+)\//i) || href.match(/\/([A-Za-z]:\\Users\\[^\\]+)\\/i)
    if (win?.[1]) return win[1].replace(/\//g, '\\')
    // macOS / Linux: /Users/<name> or /home/<name>
    const unix = href.match(/\/(Users\/[^/]+)\//) || href.match(/\/(home\/[^/]+)\//)
    if (unix?.[1]) return `/${unix[1]}`
  } catch { /* ignore */ }
  return ''
}

function guessWindowsUserLocalAppData() {
  const home = guessHomeDirFromUrls()
  if (home && /^[A-Za-z]:\\/.test(home)) return `${home}\\AppData\\Local`
  return ''
}

function pushUnique(list, seen, value) {
  if (!value || isHttpUrl(value)) return
  const key = String(value).toLowerCase()
  if (seen.has(key)) return
  seen.add(key)
  list.push(value)
}

/**
 * Candidates for start binary / script — local filesystem / file:// / known install paths only.
 * Order: remembered → native binary (installer / addon) → legacy start-mcp.cmd.
 */
export function getSidecarStartCandidates() {
  const list = []
  const seen = new Set()
  const platform = detectHostPlatform()
  const arch = detectCpuArch()
  const binName = sidecarBinaryName(platform, arch)
  const altBinName = platform === 'macos' && arch === 'arm64'
    ? sidecarBinaryName('macos', 'x64')
    : (platform === 'macos' && arch === 'x64' ? sidecarBinaryName('macos', 'arm64') : '')

  const remembered = pluginGet(START_CMD_STORAGE_KEY)
  pushUnique(list, seen, remembered)

  const root = resolveLocalAddonRootFileUrl()
  if (root && binName) {
    pushUnique(list, seen, `${root}/mcp-sidecar/bin/${binName}`)
    if (altBinName) pushUnique(list, seen, `${root}/mcp-sidecar/bin/${altBinName}`)
  }

  if (platform === 'windows') {
    if (root) {
      pushUnique(list, seen, `${root}/mcp-sidecar/start-mcp.cmd`)
      pushUnique(list, seen, `${root}/mcp-sidecar/spike-shell-marker.cmd`)
    }
    const local = guessWindowsUserLocalAppData()
    if (local) {
      // SFX/exe installer: runtime\chayuan-mcp-windows-x64.exe
      pushUnique(list, seen, `${local}\\chayuan-wps\\mcp\\runtime\\${binName}`)
      // autostart ps1: runtime\bin\chayuan-mcp-windows-x64.exe
      pushUnique(list, seen, `${local}\\chayuan-wps\\mcp\\runtime\\bin\\${binName}`)
      pushUnique(list, seen, `${local}\\chayuan-wps\\mcp\\runtime\\start-mcp.cmd`)
    }
    // ShellExecute on Windows often expands env vars
    pushUnique(list, seen, `%LOCALAPPDATA%\\chayuan-wps\\mcp\\runtime\\${binName}`)
    pushUnique(list, seen, `%LOCALAPPDATA%\\chayuan-wps\\mcp\\runtime\\bin\\${binName}`)
    pushUnique(list, seen, '%LOCALAPPDATA%\\chayuan-wps\\mcp\\runtime\\start-mcp.cmd')
  } else if (platform === 'macos') {
    const home = guessHomeDirFromUrls() || ''
    const runtime = home ? `${home}/.config/chayuan-wps/mcp/runtime` : ''
    if (runtime && binName) {
      pushUnique(list, seen, `${runtime}/bin/${binName}`)
      if (altBinName) pushUnique(list, seen, `${runtime}/bin/${altBinName}`)
      pushUnique(list, seen, `${runtime}/start-mcp.sh`)
    }
    if (root) {
      pushUnique(list, seen, `${root}/mcp-sidecar/start-mcp.sh`)
    }
  } else if (platform === 'linux') {
    const home = guessHomeDirFromUrls() || ''
    const runtime = home ? `${home}/.config/chayuan-wps/mcp/runtime` : ''
    if (runtime && binName) {
      pushUnique(list, seen, `${runtime}/bin/${binName}`)
      pushUnique(list, seen, `${runtime}/start-mcp.sh`)
    }
    if (root) {
      pushUnique(list, seen, `${root}/mcp-sidecar/start-mcp.sh`)
    }
  }

  return list
}

export function getManualStartCommand() {
  const platform = detectHostPlatform()
  const binName = sidecarBinaryName(platform)
  const commands = []
  if (platform === 'windows') {
    commands.push(
      `%LOCALAPPDATA%\\chayuan-wps\\mcp\\runtime\\${binName || 'chayuan-mcp-windows-x64.exe'}`,
      `%LOCALAPPDATA%\\chayuan-wps\\mcp\\runtime\\bin\\${binName || 'chayuan-mcp-windows-x64.exe'}`,
      'mcp-sidecar\\start-mcp.cmd'
    )
  } else if (platform === 'macos') {
    commands.push(
      `~/.config/chayuan-wps/mcp/runtime/bin/${binName || 'chayuan-mcp-macos-arm64'}`,
      'bash ~/.config/chayuan-wps/mcp/runtime/autostart/install-macos-launchagent.sh',
      'bash mcp-sidecar/start-mcp.sh'
    )
  } else if (platform === 'linux') {
    commands.push(
      `~/.config/chayuan-wps/mcp/runtime/bin/${binName || 'chayuan-mcp-linux-x64'}`,
      'bash ~/.config/chayuan-wps/mcp/runtime/autostart/install-linux-user.sh',
      'bash mcp-sidecar/start-mcp.sh'
    )
  }
  commands.push('npm run mcp:sidecar', 'node mcp-sidecar/server.mjs')
  return {
    port: MCP_DEFAULT_PORT,
    url: `${MCP_BASE_URL}/mcp`,
    healthz: MCP_HEALTHZ_URL,
    commands,
    note: '打包安装后请优先运行安装目录中的 chayuan-mcp 二进制（无需 Node）。开发态可在仓库根目录执行 npm run mcp:sidecar。'
  }
}

/**
 * Convert file:// / mixed path to an OS path ShellExecute can open.
 * Keeps Unix absolute paths (macOS/Linux); normalizes Windows drive paths.
 */
function fileUrlToPath(url) {
  let s = String(url || '')
  if (isHttpUrl(s)) return ''
  if (isFileUrl(s)) {
    s = s.replace(/^file:\/\//i, '')
    if (/^localhost\//i.test(s)) s = s.replace(/^localhost\//i, '')
    try { s = decodeURIComponent(s) } catch { /* ignore */ }
    // file:///C:/... → /C:/... → C:/...
    if (/^\/[A-Za-z]:\//.test(s)) s = s.slice(1)
    // file:///Users/... → /Users/... (keep leading slash)
  }
  if (!s) return ''
  // Keep %LOCALAPPDATA% style paths for ShellExecute
  if (s.includes('%')) {
    return s.includes('/') && !s.includes('\\') ? s.replace(/\//g, '\\') : s
  }
  // Windows drive path
  if (/^[a-zA-Z]:[\\/]/.test(s) || s.startsWith('\\\\')) {
    return s.includes('\\') ? s : s.replace(/\//g, '\\')
  }
  // Unix absolute path
  if (s.startsWith('/')) return s
  return ''
}

function isLaunchablePath(pathLike) {
  const probe = String(pathLike || '').replace(/%[^%]+%/g, 'x')
  if (!probe) return false
  if (/\.(cmd|bat|exe|sh)$/i.test(probe)) return true
  // Packaged native binary without extension (macOS / Linux)
  if (/(^|[\\/])chayuan-mcp-[^\\/]+$/i.test(probe)) return true
  return false
}

async function tryShellExecute(target) {
  if (isHttpUrl(target)) {
    console.warn('[sidecarLauncher] refuse ShellExecute on http(s) URL:', target)
    return false
  }
  const pathLike = fileUrlToPath(target) || String(target || '')
  if (!isLaunchablePath(pathLike)) return false
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
    launched = await tryShellExecute(candidate)
    if (launched) break
  }

  // Wait briefly for healthz
  for (let i = 0; i < 16; i++) {
    await new Promise(r => setTimeout(r, 500))
    const h = await probeSidecar()
    if (h.online) {
      await syncTokenFromSidecar()
      return { ok: true, started: launched, alreadyRunning: false, ...h }
    }
  }

  const onViteHttp = isHttpUrl(stripHash(window.location?.href || ''))
  const manual = getManualStartCommand()
  return {
    ok: false,
    started: launched,
    code: 'SIDECAR_NOT_RUNNING',
    message: launched
      ? '已尝试拉起 sidecar，但 62588 端口仍未就绪。请确认安装包内的 chayuan-mcp 二进制已释放，或按下方命令手动启动。'
      : onViteHttp
        ? '本机 MCP sidecar（127.0.0.1:62588）未运行。开发态无法自动启动，请在仓库根目录终端执行：npm run mcp:sidecar'
        : '本机 MCP sidecar（127.0.0.1:62588）未运行，且无法自动拉起。请点击「启动本机服务」，或运行安装目录中的 chayuan-mcp 二进制（无需 Node.js）。',
    manual
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
  getSidecarStartCandidates,
  probeSidecar,
  syncTokenFromSidecar
}
