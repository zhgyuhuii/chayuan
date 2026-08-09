/**
 * Best-effort sidecar start from WPS settings.
 * MVP: probe healthz; try ShellExecute on bundled start script; else return manual command.
 */
import { MCP_BASE_URL, MCP_HEALTHZ_URL, MCP_DEFAULT_PORT } from './config.js'
import { probeSidecar, syncTokenFromSidecar, setStoredToken, getStoredToken } from './agentClient.js'

function resolveAddonRoot() {
  try {
    const href = String(window.location?.href || '')
    // file:///.../jsaddons/chayuan_x.y.z/index.html#/...
    const noHash = href.split('#')[0]
    const idx = noHash.lastIndexOf('/')
    if (idx > 0) return noHash.slice(0, idx)
  } catch { /* ignore */ }
  return ''
}

/**
 * Candidates for start script / server entry (file URLs or paths).
 */
export function getSidecarStartCandidates() {
  const root = resolveAddonRoot()
  const list = []
  if (root) {
    list.push(`${root}/mcp-sidecar/start-mcp.cmd`)
    list.push(`${root}/mcp-sidecar/server.mjs`)
  }
  // Dev: common relative from vite
  list.push('mcp-sidecar/start-mcp.cmd')
  list.push('mcp-sidecar/server.mjs')
  return list
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
    note: 'MVP：请在本机终端启动 sidecar；设置页可探测状态并同步 token。Windows 静默自启为后续迭代。'
  }
}

function fileUrlToPath(url) {
  let s = String(url || '')
  if (/^file:\/\//i.test(s)) {
    s = s.replace(/^file:\/\//i, '')
    s = s.replace(/^\/+/, '')
    if (/^localhost\//i.test(s)) s = s.replace(/^localhost\//i, '')
    try { s = decodeURIComponent(s) } catch { /* ignore */ }
  }
  return s.includes('\\') ? s : s.replace(/\//g, '\\')
}

async function tryShellExecute(target) {
  try {
    const app = window.Application
    if (app?.OAAssist?.ShellExecute) {
      const pathLike = fileUrlToPath(target)
      app.OAAssist.ShellExecute(pathLike)
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
  for (const candidate of getSidecarStartCandidates()) {
    // Only try .cmd / http(s)/file paths that look absolute-ish
    const pathLike = candidate.replace(/^file:\/\//i, '')
    if (/\.cmd$/i.test(candidate) || /\.exe$/i.test(candidate)) {
      launched = await tryShellExecute(pathLike)
      if (launched) break
    }
  }

  // Wait briefly for healthz
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 500))
    const h = await probeSidecar()
    if (h.online) {
      await syncTokenFromSidecar()
      return { ok: true, started: launched, alreadyRunning: false, ...h }
    }
  }

  return {
    ok: false,
    started: launched,
    code: 'SIDECAR_NOT_RUNNING',
    message: launched
      ? '已尝试拉起，但 healthz 未就绪；请检查本机是否安装 Node.js，或手动运行 npm run mcp:sidecar'
      : '无法从 WPS 内自动拉起 sidecar（常见于 ShellExecute 受限）。请按手动命令启动。',
    manual: getManualStartCommand()
  }
}

export async function stopSidecarHint() {
  // MVP: cannot reliably kill remote process from WebView; document only.
  return {
    ok: false,
    code: 'NOT_SUPPORTED',
    message: '请在运行 sidecar 的终端按 Ctrl+C 停止，或结束 chayuan-mcp / node server.mjs 进程。'
  }
}

export { probeSidecar, syncTokenFromSidecar, setStoredToken, getStoredToken, MCP_HEALTHZ_URL, MCP_BASE_URL }

export default {
  startSidecarBestEffort,
  stopSidecarHint,
  getManualStartCommand,
  probeSidecar,
  syncTokenFromSidecar
}
