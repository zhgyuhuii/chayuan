/**
 * skillPackImport — 技能包导入（收割自 chayuan-office @chaoffice/agent-core
 * skills-store.ts 的 web 形态规则，适配 WPS webview：无主进程 fs，输入一律
 * 来自浏览器 File API 的字节，存储为「技能包对象」）。
 *
 * 收割的核心规则（与 office 逐条对齐）：
 *   - 单包导入上限 MAX_IMPORT_BYTES（2026-11-21 按用户口径放宽至 10240MB=10GB）：
 *     大文件在「读取进内存之前」由 File.size 预检拦截（面板侧三入口都做），
 *     解析函数内的字节级校验作为最后防线
 *   - 条目名安全：拒绝对路径 / .. / 反斜杠 / 空段 / 点开头文件；拒 __MACOSX
 *   - SKILL.md 必须在包根，或恰在一个顶层文件夹下（技能名随该文件夹）
 *   - frontmatter 需 name + description（复用 skillLibrary.parseImportedSkill）
 *   - 重名拒绝由调用方（skillSettings.upsertCustomSkill）按现有覆盖语义处理
 *   - 原子性：webview 无 fs，等价语义 = 全部校验通过后才一次性写入存储
 *
 * 存储形态（技能包对象，为技能市场下载铺路）：
 *   { name, description, category, version, body, entries:[{path, bytesB64}], addedAt }
 * body 恒为 SKILL.md 正文（对话注入只取它，与 office readSkillBody 同语义）；
 * entries 保留整包（附属模板/表格随包），market 下载的包天然就是这个形态。
 *
 * webview 存储约束：PluginStorage/localStorage 配额远小于磁盘，整包原始字节
 * 追加上限收紧为 MAX_STORE_BYTES（office 的 10MB 是磁盘语义，这里不照抄）。
 */

import JSZip from 'jszip'
import { parseImportedSkill } from './skillLibrary.js'

export const MAX_IMPORT_BYTES = 10240 * 1024 * 1024
export const MAX_FILE_COUNT = 512
export const MAX_STORE_BYTES = 2 * 1024 * 1024

function bytesToB64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let out = ''
  const CH = 0x8000
  for (let i = 0; i < u8.length; i += CH) {
    out += String.fromCharCode.apply(null, u8.subarray(i, i + CH))
  }
  return btoa(out)
}

function bytesText(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  } catch {
    return String.fromCharCode.apply(null, new Uint8Array(bytes))
  }
}

/** 声明的未压缩大小（JSZip 内部字段，取不到返回 0——交给解压后累计兜底） */
function declaredSize(entry) {
  try { return Number(entry._data?.uncompressedSize) || 0 } catch { return 0 }
}

/** 条目名安全（office importDirBytes 同款）：绝对路径 / 反斜杠 / .. / 空段 / 点开头全拒 */
function checkEntryNames(paths) {
  for (const p of paths) {
    const parts = String(p).split('/')
    if (String(p).startsWith('/') || String(p).includes('\\') ||
        parts.some(seg => seg === '..' || seg === '') ||
        parts.some(seg => seg.startsWith('.'))) {
      return `技能包含不安全的条目名：${String(p).slice(0, 80)}`
    }
  }
  return ''
}

/** 布局规则（office importDirBytes/importZipBytes 同语义）：
 *  SKILL.md 精确位于包根 → 名随 zip/导入 stem，其余顶层目录照收；
 *  否则恰一个顶层文件夹含 SKILL.md → 名随该文件夹；两者皆非 → 拒 */
function resolvePackLayout(paths, fallbackName) {
  const atRoot = paths.includes('SKILL.md')
  const tops = [...new Set(paths.map(p => p.split('/')[0]))]
  if (atRoot) {
    const stem = String(fallbackName || '').replace(/\.zip$/i, '').replace(/\.md$/i, '') || 'imported-skill'
    return { prefix: '', name: stem, ok: true }
  }
  if (tops.length === 1 && paths.includes(`${tops[0]}/SKILL.md`)) {
    return { prefix: `${tops[0]}/`, name: tops[0], ok: true }
  }
  return { ok: false, message: '未找到 SKILL.md：它需在压缩包根目录，或恰在一个顶层文件夹下。' }
}

/** 由 SKILL.md 文本产出包卡片（frontmatter 必填 name+description） */
function packCard(mdText) {
  const parsed = parseImportedSkill(mdText)
  if (!parsed.ok) {
    return { ok: false, message: 'SKILL.md 缺少有效 frontmatter（需以 --- 开头的 YAML 块，且含 name 与 description）。' }
  }
  return { ok: true, card: parsed.card }
}

function assemblePack(card, files, packName) {
  const rawTotal = files.reduce((n, f) => n + f.bytes.length, 0)
  if (rawTotal > MAX_STORE_BYTES) {
    return { ok: false, message: `技能包共 ${Math.round(rawTotal / 1024)}KB，超过面板存储上限（${Math.round(MAX_STORE_BYTES / 1024)}KB），未导入。` }
  }
  return {
    ok: true,
    pack: {
      // zip/文件夹导入：技能名随顶层文件夹（office 同语义）；md 单文件：frontmatter 名
      name: packName || card.name,
      description: card.description,
      category: card.category,
      version: card.version,
      body: card.body,
      entries: files.map(f => ({ path: f.name, bytesB64: bytesToB64(f.bytes) }))
    }
  }
}

/** 单 SKILL.md 文件导入（字节数形态，与 office importMdBytes 对齐） */
export function parsePackFromMdBytes(fileName, bytes) {
  if (bytes.length > MAX_IMPORT_BYTES) {
    return { ok: false, message: `技能超过 ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)}MB 导入上限。` }
  }
  const parsed = packCard(bytesText(bytes))
  if (!parsed.ok) return parsed
  const files = [{ name: 'SKILL.md', bytes }]
  const assembled = assemblePack(parsed.card, files)
  if (!assembled.ok) return assembled
  return { ok: true, pack: assembled.pack }
}

/** zip 导入（office importZipBytes 对齐：布局规则 + 解压中限额 + 条目名安全） */
export async function parsePackFromZipBytes(fileName, bytes) {
  if (bytes.length > MAX_IMPORT_BYTES) {
    return { ok: false, message: `压缩包超过 ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)}MB 导入上限。` }
  }
  let zip
  try {
    zip = await JSZip.loadAsync(bytes)
  } catch {
    return { ok: false, message: '文件不是有效的 zip 压缩包。' }
  }
  const listed = Object.values(zip.files).filter(f => !f.dir && !String(f.name).startsWith('__MACOSX/'))
  if (!listed.length) return { ok: false, message: '压缩包内没有文件。' }
  if (listed.length > MAX_FILE_COUNT) {
    return { ok: false, message: `压缩包内文件超过 ${MAX_FILE_COUNT} 个，未导入。` }
  }
  const bad = checkEntryNames(listed.map(f => String(f.name)))
  if (bad) return { ok: false, message: bad }
  const layout = resolvePackLayout(listed.map(f => String(f.name)), String(fileName || 'skill.zip'))
  if (!layout.ok) return { ok: false, message: layout.message }

  const files = []
  let total = 0
  for (const entry of listed) {
    const pre = declaredSize(entry)
    if (pre && total + pre > MAX_IMPORT_BYTES) {
      return { ok: false, message: `技能超过 ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)}MB 导入上限（解压后）。` }
    }
    let data
    try {
      data = await entry.async('uint8array')
    } catch {
      return { ok: false, message: '压缩包内条目无法解压。' }
    }
    total += data.length
    if (total > MAX_IMPORT_BYTES) {
      return { ok: false, message: `技能超过 ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)}MB 导入上限（解压后）。` }
    }
    files.push({ name: String(entry.name).slice(layout.prefix.length), bytes: data })
  }
  const mdEntry = files.find(f => f.name === 'SKILL.md')
  if (!mdEntry) return { ok: false, message: '压缩包内未找到 SKILL.md。' }
  const parsed = packCard(bytesText(mdEntry.bytes))
  if (!parsed.ok) return parsed
  const assembled = assemblePack(parsed.card, files, layout.name)
  if (!assembled.ok) return assembled
  return { ok: true, pack: assembled.pack }
}

/** 文件夹导入（office importDirBytes 对齐：webkitdirectory 的 {relativePath, bytes} 对） */
export function parsePackFromDirFiles(files) {
  const list = (Array.isArray(files) ? files : [])
    .map(f => ({ path: String(f?.relativePath ?? f?.path ?? '').replace(/\\/g, '/'), bytes: f?.bytes }))
    .filter(f => f.path && f.bytes)
  if (!list.length) return { ok: false, message: '没有读到文件夹内容。' }
  if (list.length > MAX_FILE_COUNT) {
    return { ok: false, message: `文件夹内文件超过 ${MAX_FILE_COUNT} 个，未导入。` }
  }
  if (list.reduce((n, f) => n + f.bytes.length, 0) > MAX_IMPORT_BYTES) {
    return { ok: false, message: `技能超过 ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)}MB 导入上限。` }
  }
  const bad = checkEntryNames(list.map(f => f.path))
  if (bad) return { ok: false, message: bad }
  const layout = resolvePackLayout(list.map(f => f.path), 'imported-skill')
  if (!layout.ok) return { ok: false, message: layout.message }
  const files2 = list.map(f => ({ name: f.path.slice(layout.prefix.length), bytes: f.bytes }))
  const mdEntry = files2.find(f => f.name === 'SKILL.md')
  if (!mdEntry) return { ok: false, message: '文件夹内未找到 SKILL.md。' }
  const parsed = packCard(bytesText(mdEntry.bytes))
  if (!parsed.ok) return parsed
  const assembled = assemblePack(parsed.card, files2, layout.name)
  if (!assembled.ok) return assembled
  return { ok: true, pack: assembled.pack }
}
