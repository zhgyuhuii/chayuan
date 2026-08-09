import fs from 'node:fs'
import path from 'node:path'

export function createAuditLog(dataDir) {
  const file = path.join(dataDir, 'audit.jsonl')

  function append(entry) {
    const line = JSON.stringify({
      at: new Date().toISOString(),
      ...entry
    }) + '\n'
    try {
      fs.mkdirSync(dataDir, { recursive: true })
      fs.appendFileSync(file, line, 'utf8')
    } catch (e) {
      console.warn('[audit]', e.message)
    }
  }

  function readTail(limit = 50) {
    try {
      if (!fs.existsSync(file)) return []
      const text = fs.readFileSync(file, 'utf8')
      const lines = text.trim().split(/\n+/).filter(Boolean)
      return lines.slice(-limit).map(l => {
        try { return JSON.parse(l) } catch { return { raw: l } }
      })
    } catch {
      return []
    }
  }

  return { append, readTail, file }
}
