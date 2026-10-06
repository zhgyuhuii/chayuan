#!/usr/bin/env node
/** 会话存储体检（Mac/VM 通用）：列 sidecar 持久层所有 scope 的会话概况 */
import fs from 'node:fs'
import path from 'node:path'
const dataDir = process.env.CHAYUAN_DATA_DIR || path.join(process.env.HOME || '', '.config/chayuan-wps/mcp')
const dir = path.join(dataDir, 'session-store')
if (!fs.existsSync(dir)) { console.log('无 session-store 目录'); process.exit(0) }
for (const f of fs.readdirSync(dir)) {
  const p = path.join(dir, f)
  try {
    const d = JSON.parse(fs.readFileSync(p, 'utf8'))
    const arr = JSON.parse(d.historyJson || '[]')
    const msgs = arr.flatMap(c => c.messages || [])
    const first = (msgs.find(m => m.role === 'user') || {}).content || ''
    const upd = d.updatedAt ? new Date(d.updatedAt).toISOString().slice(0, 16) : '?'
    console.log(`${decodeURIComponent(f).slice(0, 48)}  conv=${arr.length} msgs=${msgs.length} 更新=${upd} 首问="${String(first).slice(0, 30)}"`)
  } catch (e) { console.log(`${f} 解析失败 ${e.message}`) }
}
