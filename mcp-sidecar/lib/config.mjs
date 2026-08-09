import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

export const PROTOCOL_VERSION = 1
export const DEFAULT_PORT = 62588
export const MCP_PATH = '/mcp'
export const HEALTHZ_PATH = '/healthz'

export function getDataDir() {
  const override = process.env.CHAYUAN_MCP_DATA_DIR
  if (override) return path.resolve(override)
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
    return path.join(base, 'chayuan-wps', 'mcp')
  }
  return path.join(os.homedir(), '.config', 'chayuan-wps', 'mcp')
}

export function ensureDataDir() {
  const dir = getDataDir()
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function tokenFilePath() {
  return path.join(getDataDir(), 'token')
}

export function lockFilePath() {
  return path.join(getDataDir(), 'sidecar.lock')
}

export function loadOrCreateToken() {
  ensureDataDir()
  const file = tokenFilePath()
  const fromEnv = String(process.env.CHAYUAN_MCP_TOKEN || '').trim()
  if (fromEnv) {
    try { fs.writeFileSync(file, fromEnv, 'utf8') } catch { /* ignore */ }
    return fromEnv
  }
  try {
    if (fs.existsSync(file)) {
      const t = String(fs.readFileSync(file, 'utf8') || '').trim()
      if (t) return t
    }
  } catch { /* ignore */ }
  const token = crypto.randomBytes(24).toString('hex')
  fs.writeFileSync(file, token, 'utf8')
  return token
}

export function getPort() {
  const n = Number(process.env.CHAYUAN_MCP_PORT || DEFAULT_PORT)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PORT
}
