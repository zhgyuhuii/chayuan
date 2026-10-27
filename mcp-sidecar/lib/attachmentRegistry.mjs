/**
 * attachmentRegistry — 面板附件落盘路径注册表（file_parse 的「附件N」别名源）。
 *
 * 数据：dataDir/attachments.json，LRU ≤50 条，TTL 默认 30 分钟（与面板模板
 * 记忆同龄）。写入方是 webview（PUT /attachments/register，trusted 通道）——
 * 面板把非纯文本附件 materialize 到 数据目录/_temp 后登记；
 * 读取方是 mcpHandler（file_parse 别名解析）与 GET /attachments/list。
 *
 * 纯 fs JSON 实现（sidecar 零 npm 依赖红线），读写都做全量重写 + 过期清理。
 */

import fs from 'node:fs'
import path from 'node:path'

const MAX_ENTRIES = 50
const DEFAULT_TTL_MS = 30 * 60 * 1000

function registryPath(dataDir) {
  return path.join(dataDir, 'attachments.json')
}

function loadRaw(dataDir) {
  try {
    const raw = JSON.parse(fs.readFileSync(registryPath(dataDir), 'utf8'))
    if (Array.isArray(raw?.entries)) return raw
  } catch { /* 首次/损坏均按空表 */ }
  return { entries: [] }
}

function saveRaw(dataDir, raw) {
  fs.writeFileSync(registryPath(dataDir), JSON.stringify(raw, null, 2))
}

function prune(raw, now = Date.now(), ttlMs = DEFAULT_TTL_MS) {
  raw.entries = (raw.entries || []).filter(e => now - Number(e.savedAt || 0) < ttlMs)
  while (raw.entries.length > MAX_ENTRIES) raw.entries.shift()
}

function normalizeAlias(alias) {
  return String(alias || '').trim().toLowerCase()
}

/** 别名匹配：附件N / 精确文件名 / 最近同名（大小写不敏感，取最新） */
function findByAlias(raw, alias) {
  const a = normalizeAlias(alias)
  if (!a) return null
  const hits = raw.entries.filter(e =>
    normalizeAlias(e.alias) === a || normalizeAlias(e.name) === a
  )
  if (hits.length) return hits[hits.length - 1]
  return null
}

export function createAttachmentRegistry({ dataDir }) {
  function register({ alias, name, path: filePath, bytes, scopeKey }) {
    const raw = loadRaw(dataDir)
    const entry = {
      alias: String(alias || '').trim(),
      name: String(name || '').trim(),
      path: String(filePath || '').trim(),
      bytes: Number(bytes) || 0,
      scopeKey: String(scopeKey || '').trim(),
      savedAt: Date.now()
    }
    if (!entry.path || !entry.name) return { ok: false, error: 'name/path 必填' }
    // 同 alias 覆盖（附件1 重新上传）；同路径去重
    raw.entries = raw.entries.filter(e =>
      normalizeAlias(e.alias) !== normalizeAlias(entry.alias) && e.path !== entry.path
    )
    raw.entries.push(entry)
    prune(raw)
    saveRaw(dataDir, raw)
    return { ok: true, entry }
  }

  function list() {
    const raw = loadRaw(dataDir)
    prune(raw)
    return {
      ok: true,
      entries: raw.entries.map(e => ({ ...e, ageMs: Date.now() - Number(e.savedAt || 0) }))
    }
  }

  /** file_parse 路径解析：绝对路径原样返回；否则按别名/文件名查（带 TTL 剩余） */
  function resolve(input) {
    const s = String(input || '').trim()
    if (!s) return { ok: false, error: '空引用' }
    if (/^([a-zA-Z]:[\\/]|\\\\|\/)/.test(s)) return { ok: true, path: s, via: 'absolute' }
    const raw = loadRaw(dataDir)
    prune(raw)
    const hit = findByAlias(raw, s)
    if (hit) return { ok: true, path: hit.path, via: 'registry', entry: hit }
    return {
      ok: false,
      error: `「${s}」不在附件记忆中（记忆有效期 30 分钟）。当前记忆：${
        raw.entries.length
          ? raw.entries.map(e => `${e.alias}=${e.name}`).join('；')
          : '（空）'
      }。也可以直接传文件绝对路径。`
    }
  }

  return { register, list, resolve }
}

export default { createAttachmentRegistry }
