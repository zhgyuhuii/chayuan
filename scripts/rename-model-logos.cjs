/**
 * 将 public/images/models/logos 下的图标重命名为「模型名.扩展名」
 * 规则：文件名格式为 name-HASH.ext 或 name_dark-HASH.ext 时，去掉 HASH 段，改为 name.ext / name_dark.ext
 * HASH 段：最后一个 hyphen 后的部分，且匹配 [A-Za-z0-9_]{5,}
 */
const fs = require('fs')
const path = require('path')

const LOGOS_DIR = path.join(__dirname, '../public/images/models/logos')
const MANIFEST_PATH = path.join(__dirname, '../public/images/models/logos-manifest.json')

function isHashSegment(s) {
  return /^[A-Za-z0-9_]{5,}$/.test(s) && s.length <= 32
}

function getNewBasename(filename) {
  const lastDot = filename.lastIndexOf('.')
  const ext = lastDot >= 0 ? filename.slice(lastDot) : ''
  const base = lastDot >= 0 ? filename.slice(0, lastDot) : filename
  const lastHyphen = base.lastIndexOf('-')
  if (lastHyphen < 0) return base + ext
  const afterHyphen = base.slice(lastHyphen + 1)
  if (!isHashSegment(afterHyphen)) return base + ext
  let namePart = base.slice(0, lastHyphen)
  while (namePart.length > 1 && namePart.endsWith('-')) namePart = namePart.slice(0, -1)
  return namePart + ext
}

function main() {
  if (!fs.existsSync(LOGOS_DIR)) {
    console.error('Logos dir not found:', LOGOS_DIR)
    process.exit(1)
  }
  const files = fs.readdirSync(LOGOS_DIR)
  const manifest = {}
  let renamed = 0
  for (const f of files) {
    const fullPath = path.join(LOGOS_DIR, f)
    if (!fs.statSync(fullPath).isFile()) continue
    const newName = getNewBasename(f)
    if (newName === f) {
      const ext = path.extname(f).slice(1)
      const base = path.basename(f, path.extname(f))
      manifest[base] = ext
      continue
    }
    const targetPath = path.join(LOGOS_DIR, newName)
    if (targetPath === fullPath) continue
    if (fs.existsSync(targetPath)) {
      console.warn('Skip (target exists):', f, '->', newName)
      continue
    }
    try {
      fs.renameSync(fullPath, targetPath)
      console.log('Renamed:', f, '->', newName)
      renamed++
      const base = path.basename(newName, path.extname(newName))
      const ext = path.extname(newName).slice(1)
      manifest[base] = ext
    } catch (e) {
      console.error('Rename failed:', f, e.message)
    }
  }
  // Write manifest: basename -> extension (for first occurrence; if multiple we keep one)
  const existing = fs.readdirSync(LOGOS_DIR)
  const out = {}
  for (const f of existing) {
    if (!fs.statSync(path.join(LOGOS_DIR, f)).isFile()) continue
    const base = path.basename(f, path.extname(f))
    const ext = path.extname(f).slice(1)
    if (!out[base]) out[base] = ext
  }
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(out, null, 2), 'utf8')
  console.log('Manifest written:', MANIFEST_PATH)
  console.log('Total renamed:', renamed)
}

main()
