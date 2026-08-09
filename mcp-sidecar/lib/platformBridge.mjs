/**
 * Cross-platform WPS executable discovery + OS spawn (not WebView ShellExecute).
 */
import { spawn, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function which(cmd) {
  try {
    const out = execSync(
      process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    )
    return String(out || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0] || ''
  } catch {
    return ''
  }
}

export function normalizePath(p) {
  let s = String(p || '').trim()
  if (!s) return ''
  if (process.platform === 'win32') {
    s = s.replace(/\//g, '\\')
  }
  return path.normalize(s)
}

export function findWpsExecutable(mcpServerJsonPath) {
  // 1) mcp-server.json override
  try {
    if (mcpServerJsonPath && fs.existsSync(mcpServerJsonPath)) {
      const j = JSON.parse(fs.readFileSync(mcpServerJsonPath, 'utf8'))
      const exe = normalizePath(j.wpsExecutable || '')
      if (exe && fs.existsSync(exe)) return exe
    }
  } catch { /* ignore */ }

  if (process.platform === 'win32') {
    try {
      const out = execSync(
        'REG QUERY HKEY_CLASSES_ROOT\\KWPS.Document.12\\shell\\open\\command /ve',
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
      )
      const m = out.match(/"(.*?wps\.exe)"/i) || out.match(/"(.*?wpsoffice\.exe)"/i)
      if (m?.[1] && fs.existsSync(m[1])) return m[1]
    } catch { /* ignore */ }

    const local = path.join(
      process.env.LOCALAPPDATA || '',
      'Kingsoft',
      'WPS Office'
    )
    if (local && fs.existsSync(local)) {
      try {
        const vers = fs.readdirSync(local)
          .filter(n => /^\d+\./.test(n))
          .sort()
          .reverse()
        for (const v of vers) {
          const candidate = path.join(local, v, 'office6', 'wps.exe')
          if (fs.existsSync(candidate)) return candidate
        }
      } catch { /* ignore */ }
    }
    return which('wps.exe') || which('wps')
  }

  // Linux
  const linuxCandidates = [
    '/opt/kingsoft/wps-office/wps',
    '/usr/bin/wps',
    '/opt/apps/cn.wps.wps-office-pro/files/kingsoft/wps-office/wps',
    which('wps')
  ]
  for (const c of linuxCandidates) {
    if (c && fs.existsSync(c)) return c
  }

  // macOS — WPS often under /Applications
  const macCandidates = [
    '/Applications/wpsoffice.app/Contents/MacOS/wpsoffice',
    '/Applications/WPS Office.app/Contents/MacOS/wpsoffice',
    which('wps')
  ]
  for (const c of macCandidates) {
    if (c && fs.existsSync(c)) return c
  }
  return ''
}

/**
 * Launch WPS Writer (best-effort). Returns { ok, pid?, exe, error? }
 */
export function launchWps(exePath, { args } = {}) {
  const exe = normalizePath(exePath)
  if (!exe || !fs.existsSync(exe)) {
    return { ok: false, code: 'WPS_EXECUTABLE_NOT_FOUND', error: 'WPS executable not found' }
  }
  const launchArgs = Array.isArray(args) && args.length
    ? args
    : (process.platform === 'win32' ? ['/prometheus', '/wps'] : [])

  try {
    const child = spawn(exe, launchArgs, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    })
    child.unref()
    return { ok: true, pid: child.pid, exe, args: launchArgs }
  } catch (e) {
    return { ok: false, code: 'WPS_SPAWN_FAILED', error: e.message || String(e), exe }
  }
}

/**
 * Open a local file with the OS shell so it lands in a normal interactive WPS window.
 * Agent Documents.Open alone can succeed inside a headless Preview/-Embedding host
 * (ActiveDocument set, but no user-visible window).
 */
export function openPathWithOs(filePath, { wpsExe } = {}) {
  const p = normalizePath(filePath)
  if (!p) {
    return { ok: false, code: 'INVALID_PARAMS', error: 'path required' }
  }
  if (!fs.existsSync(p)) {
    return { ok: false, code: 'FILE_NOT_FOUND', error: `File not found: ${p}` }
  }

  try {
    if (process.platform === 'win32') {
      const exe = normalizePath(wpsExe || '') || findWpsExecutable()
      if (exe && fs.existsSync(exe)) {
        // Prefer explicit writer entry — more likely to create a visible document window.
        const child = spawn(exe, ['/wps', p], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true
        })
        child.unref()
        return { ok: true, method: 'wps-/wps', pid: child.pid, exe, path: p }
      }
      const child = spawn('cmd.exe', ['/c', 'start', '', p], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      })
      child.unref()
      return { ok: true, method: 'cmd-start', pid: child.pid, path: p }
    }

    if (process.platform === 'darwin') {
      const child = spawn('open', [p], { detached: true, stdio: 'ignore' })
      child.unref()
      return { ok: true, method: 'open', pid: child.pid, path: p }
    }

    const child = spawn('xdg-open', [p], { detached: true, stdio: 'ignore' })
    child.unref()
    return { ok: true, method: 'xdg-open', pid: child.pid, path: p }
  } catch (e) {
    return { ok: false, code: 'OS_OPEN_FAILED', error: e.message || String(e), path: p }
  }
}

/** Best-effort: any wps.exe with a non-empty main window title (user-visible frame). */
export function listVisibleWpsWindows() {
  if (process.platform !== 'win32') return []
  try {
    // Force UTF-8 so Chinese titles (答辩状.docx - WPS Office) survive into Node.
    const ps = [
      '$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false);',
      "Get-Process wps -ErrorAction SilentlyContinue |",
      "Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } |",
      "Select-Object Id,MainWindowTitle |",
      "ConvertTo-Json -Compress"
    ].join(' ')
    const out = execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 8000
    }).trim()
    if (!out) return []
    const parsed = JSON.parse(out)
    return (Array.isArray(parsed) ? parsed : [parsed]).map((x) => ({
      pid: x.Id,
      title: String(x.MainWindowTitle || '')
    }))
  } catch {
    return []
  }
}

/** True if a visible WPS frame looks like it hosts the given document path/name. */
export function isDocumentVisibleInWindows(filePath, windows = listVisibleWpsWindows()) {
  const base = String(filePath || '')
    .split(/[/\\]/)
    .pop() || ''
  if (!base) return false
  const stem = base.replace(/\.(docx?|wps)$/i, '')
  return windows.some((w) => {
    const t = String(w.title || '')
    if (!t) return false
    if (t.includes(base) || (stem && t.includes(stem))) return true
    // Encoding-fallback: any titled writer window (not bare homepage)
    return /\.(docx?|wps)\b/i.test(t) && !/^WPS Office$/i.test(t.trim())
  })
}

export function defaultMcpServerJson(dataDir, port) {
  return {
    name: 'chayuan-wps',
    version: '0.4.0',
    url: `http://127.0.0.1:${port}/mcp`,
    port,
    authRequired: false,
    transport: 'streamable-http',
    wpsExecutable: findWpsExecutable(path.join(dataDir, 'mcp-server.json')) || '',
    dataDir,
    updatedAt: new Date().toISOString()
  }
}

export function writeMcpServerJson(dataDir, port) {
  fs.mkdirSync(dataDir, { recursive: true })
  const file = path.join(dataDir, 'mcp-server.json')
  let prev = {}
  try {
    if (fs.existsSync(file)) prev = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch { /* ignore */ }
  const next = {
    ...defaultMcpServerJson(dataDir, port),
    ...prev,
    url: `http://127.0.0.1:${port}/mcp`,
    port,
    authRequired: false,
    updatedAt: new Date().toISOString()
  }
  if (!next.wpsExecutable) {
    next.wpsExecutable = findWpsExecutable(file) || ''
  }
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n', 'utf8')
  return { file, config: next }
}

export default {
  normalizePath,
  findWpsExecutable,
  launchWps,
  openPathWithOs,
  listVisibleWpsWindows,
  isDocumentVisibleInWindows,
  writeMcpServerJson
}
