/**
 * Sync docs/user-manual.zh-CN.md → packaged locations so Vite / WPS builds
 * never miss the in-app help manual.
 *
 * - src/assets/manuals/…  (imported via ?raw, inlined into JS)
 * - public/docs/…         (copied into dist as a standalone .md asset)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const SRC = path.join(root, 'docs', 'user-manual.zh-CN.md')
const DEST_ASSET = path.join(root, 'src', 'assets', 'manuals', 'user-manual.zh-CN.md')
const DEST_PUBLIC = path.join(root, 'public', 'docs', 'user-manual.zh-CN.md')

export function syncUserManual() {
  if (!fs.existsSync(SRC)) {
    console.warn('[sync-user-manual] missing source:', SRC)
    return false
  }
  const text = fs.readFileSync(SRC, 'utf8')
  fs.mkdirSync(path.dirname(DEST_ASSET), { recursive: true })
  fs.mkdirSync(path.dirname(DEST_PUBLIC), { recursive: true })
  fs.writeFileSync(DEST_ASSET, text, 'utf8')
  fs.writeFileSync(DEST_PUBLIC, text, 'utf8')
  return true
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  const ok = syncUserManual()
  if (ok) console.log('[sync-user-manual] synced to src/assets/manuals and public/docs')
  else process.exitCode = 1
}
