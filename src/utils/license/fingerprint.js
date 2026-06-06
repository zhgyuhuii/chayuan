// src/utils/license/fingerprint.js
// WPS 端机器指纹生成与持久化。
//
// 格式：16 字符 hex（8 字节），与 desktop fingerprint.py 格式一致（SHA-256 前8字节hex）。
// 持久化优先级：
//   1. WPS FileSystem（写本地文件 ~/.chayuan/machine.id）—— 最强持久化
//   2. OPFS（navigator.storage.getDirectory）—— 浏览器沙箱内持久化
//   3. localStorage key=cy_machine_id —— 最后兜底（清缓存会丢）
//
// 同一台机器多次调用返回相同值（只要文件/OPFS/localStorage 未被删除）。

const LS_KEY = 'cy_machine_id'
const FILE_NAME = 'machine.id'

function getApplication() {
  return (
    (typeof window !== 'undefined' && window.Application) ||
    window?.opener?.Application ||
    window?.parent?.Application ||
    null
  )
}

/** 探测 OS 类型 + 用户主目录 + 路径分隔符（WPS Env，FileSystem 路径拼接用）。 */
function _resolveHomeOs() {
  try {
    const app = getApplication()
    if (!app?.Env) return null

    let osType = 'linux'
    if (typeof ActiveXObject !== 'undefined') {
      osType = 'windows'
    } else {
      const ua = navigator?.userAgent || ''
      const platform = navigator?.platform || ''
      if (/Mac|iPod|iPhone|iPad/.test(platform) || /Macintosh/.test(ua)) osType = 'mac'
      else if (/Linux/.test(platform)) osType = 'linux'
    }
    const sep = osType === 'windows' ? '\\' : '/'

    let userHome = null
    if (typeof app.Env.GetHomePath === 'function') {
      const hp = String(app.Env.GetHomePath() || '').replace(/^file:\/\//i, '').trim()
      if (hp) userHome = hp.replace(/[/\\]+$/, '').replace(/[/\\]+/g, sep)
    }
    if (!userHome && typeof app.Env.GetDownloadPath === 'function') {
      const dl = String(app.Env.GetDownloadPath() || '').replace(/^file:\/\//i, '')
      const parts = dl.replace(/\\/g, '/').replace(/\/+$/, '').split('/').filter(Boolean)
      if (osType === 'windows' && parts.length >= 3) userHome = parts.slice(0, 3).join('\\')
      else if (parts.length >= 2) userHome = '/' + parts.slice(0, -1).join('/')
    }
    if (!userHome) return null

    return { osType, sep, userHome }
  } catch (e) {
    return null
  }
}

/**
 * WPS 自身 machine.id 路径：
 * Windows %APPDATA%\chayuan\machine.id；macOS ~/Library/Application Support/chayuan/machine.id；
 * Linux ~/.config/chayuan/machine.id
 */
function getMachineIdPath() {
  const r = _resolveHomeOs()
  if (!r) return null
  const { osType, sep, userHome } = r
  let configDir
  if (osType === 'windows') configDir = userHome + sep + 'AppData' + sep + 'Roaming' + sep + 'chayuan'
  else if (osType === 'mac') configDir = userHome + sep + 'Library' + sep + 'Application Support' + sep + 'chayuan'
  else configDir = userHome + sep + '.config' + sep + 'chayuan'
  return configDir + sep + FILE_NAME
}

/**
 * chayuan-desktop 的 machine.id 路径（其数据目录 <dataDir>/license/machine.id）。
 * 数据目录对齐 desktop chayuan/paths.py：
 *   Windows %APPDATA%\chayuan（=~\AppData\Roaming\chayuan）；
 *   macOS ~/Library/Application Support/chayuan；Linux ~/.local/share/chayuan
 * 文件内容是原始系统标识（machine-id/MachineGuid/uuid），desktop 指纹 = SHA-256(内容)[前8字节hex]。
 */
function getDesktopMachineIdPath() {
  const r = _resolveHomeOs()
  if (!r) return null
  const { osType, sep, userHome } = r
  let dataDir
  if (osType === 'windows') dataDir = userHome + sep + 'AppData' + sep + 'Roaming' + sep + 'chayuan'
  else if (osType === 'mac') dataDir = userHome + sep + 'Library' + sep + 'Application Support' + sep + 'chayuan'
  else dataDir = userHome + sep + '.local' + sep + 'share' + sep + 'chayuan'
  return dataDir + sep + 'license' + sep + FILE_NAME
}

/**
 * 生成随机 8 字节并返回 16 字符 hex。
 * 先用 crypto.getRandomValues 生成随机 → SHA-256 → 取前 8 字节 hex（与 desktop 同格式）。
 */
async function generateRandom16Hex() {
  const rand = crypto.getRandomValues(new Uint8Array(32))
  // SHA-256 → 取前 8 字节 hex
  const hashBuf = await crypto.subtle.digest('SHA-256', rand)
  const bytes = new Uint8Array(hashBuf).subarray(0, 8)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 校验 hex 格式（16 字符，仅 0-9a-f）。
 */
function isValid16Hex(s) {
  return typeof s === 'string' && /^[0-9a-f]{16}$/i.test(s.trim())
}

// ──────────── 三层持久化 ────────────

function readFromFileSystem() {
  try {
    const app = getApplication()
    const fs = app?.FileSystem
    if (!fs) return null
    const path = getMachineIdPath()
    if (!path) return null
    const content = (fs.readFileString ? fs.readFileString(path) : fs.ReadFile?.(path)) || ''
    const hex = String(content).trim().toLowerCase()
    return isValid16Hex(hex) ? hex : null
  } catch (e) {
    return null
  }
}

/**
 * 读 chayuan-desktop 的 machine.id 并算出其指纹（若本机装了 desktop）。
 * desktop 文件内容是原始系统标识；指纹 = SHA-256(utf8(内容)) 前 8 字节 hex（对齐 fingerprint.py）。
 * @returns {Promise<string|null>} 16 hex 或 null（未装 desktop / 读不到）
 */
async function readDesktopFingerprint() {
  try {
    const app = getApplication()
    const fs = app?.FileSystem
    if (!fs) return null
    const path = getDesktopMachineIdPath()
    if (!path) return null
    const content = (fs.readFileString ? fs.readFileString(path) : fs.ReadFile?.(path)) || ''
    const raw = String(content).trim()
    if (!raw) return null
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
    const bytes = new Uint8Array(buf).subarray(0, 8)
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    return isValid16Hex(hex) ? hex : null
  } catch (e) {
    return null
  }
}

function writeToFileSystem(hex) {
  try {
    const app = getApplication()
    const fs = app?.FileSystem
    if (!fs) return false
    const path = getMachineIdPath()
    if (!path) return false
    // 确保目录存在（参照 dataPathSettings.ensureDir）
    const sep = path.includes('\\') ? '\\' : '/'
    const dir = path.substring(0, path.lastIndexOf(sep))
    if (dir && fs.Mkdir) {
      try { fs.Mkdir(dir) } catch (_) {
        // 可能已存在，递归创建
        const parts = dir.split(/[/\\]/).filter(Boolean)
        let current = path.includes('\\') ? (parts[0] + ':') : ('/' + parts[0])
        for (let i = 1; i < parts.length; i++) {
          current = current + sep + parts[i]
          try { fs.Mkdir(current) } catch (_2) { /* already exists */ }
        }
      }
    }
    if (fs.writeFileString) {
      fs.writeFileString(path, hex)
    } else if (fs.WriteFile) {
      fs.WriteFile(path, hex)
    } else {
      return false
    }
    return true
  } catch (e) {
    return false
  }
}

async function readFromOPFS() {
  try {
    if (!navigator?.storage?.getDirectory) return null
    const root = await navigator.storage.getDirectory()
    const handle = await root.getFileHandle('cy_machine_id')
    const file = await handle.getFile()
    const text = (await file.text()).trim().toLowerCase()
    return isValid16Hex(text) ? text : null
  } catch (e) {
    return null
  }
}

async function writeToOPFS(hex) {
  try {
    if (!navigator?.storage?.getDirectory) return false
    const root = await navigator.storage.getDirectory()
    const handle = await root.getFileHandle('cy_machine_id', { create: true })
    const writable = await handle.createWritable()
    await writable.write(hex)
    await writable.close()
    return true
  } catch (e) {
    return false
  }
}

function readFromLocalStorage() {
  try {
    const val = (typeof localStorage !== 'undefined' && localStorage.getItem(LS_KEY)) || ''
    const hex = val.trim().toLowerCase()
    return isValid16Hex(hex) ? hex : null
  } catch (e) {
    return null
  }
}

function writeToLocalStorage(hex) {
  try {
    if (typeof localStorage === 'undefined') return false
    localStorage.setItem(LS_KEY, hex)
    return true
  } catch (e) {
    return false
  }
}

// ──────────── 主入口 ────────────

/** 内存缓存（同次 WPS 会话内不重复生成） */
let _cached = null
let _cachedMain = null

/**
 * WPS 自身指纹（三层持久化：FileSystem 文件 → OPFS → localStorage，随机生成兜底）。
 * @returns {Promise<string>} 16 字符小写 hex
 */
async function getWpsOwnFingerprint() {
  if (_cached) return _cached

  // 1. 尝试从 FileSystem 读
  const fromFile = readFromFileSystem()
  if (fromFile) {
    _cached = fromFile
    // 尽量同步写 OPFS + localStorage（确保多存一份）
    writeToLocalStorage(fromFile)
    writeToOPFS(fromFile).catch(() => {})
    return _cached
  }

  // 2. 尝试从 OPFS 读
  const fromOPFS = await readFromOPFS()
  if (fromOPFS) {
    _cached = fromOPFS
    writeToFileSystem(fromOPFS)
    writeToLocalStorage(fromOPFS)
    return _cached
  }

  // 3. 尝试从 localStorage 读
  const fromLS = readFromLocalStorage()
  if (fromLS) {
    _cached = fromLS
    writeToFileSystem(fromLS)
    writeToOPFS(fromLS).catch(() => {})
    return _cached
  }

  // 4. 全无 → 生成新指纹
  const hex = await generateRandom16Hex()
  _cached = hex
  writeToFileSystem(hex)
  await writeToOPFS(hex).catch(() => {})
  writeToLocalStorage(hex)

  return _cached
}

/**
 * 获取本机指纹（购买/显示用）。优先 chayuan-desktop 指纹（若本机装了 desktop，与其共用同一指纹），
 * 否则用 WPS 自身指纹。
 * @returns {Promise<string>} 16 字符小写 hex
 */
export async function getFingerprint() {
  if (_cachedMain) return _cachedMain
  const dfp = await readDesktopFingerprint()
  _cachedMain = isValid16Hex(dfp) ? dfp.toLowerCase() : await getWpsOwnFingerprint()
  return _cachedMain
}

/**
 * 返回所有候选指纹（激活时多指纹验证用）：desktop 指纹（若有）在前、WPS 自身指纹在后，去重去空。
 * 让「用 desktop 指纹购买」与「用 WPS 指纹购买」的序列号都能在本机激活。
 * @returns {Promise<string[]>}
 */
export async function getCandidateFingerprints() {
  const list = []
  try {
    const dfp = await readDesktopFingerprint()
    if (isValid16Hex(dfp)) list.push(dfp.toLowerCase())
  } catch (e) { /* ignore */ }
  try {
    const wfp = await getWpsOwnFingerprint()
    if (isValid16Hex(wfp) && !list.includes(wfp.toLowerCase())) list.push(wfp.toLowerCase())
  } catch (e) { /* ignore */ }
  return list
}

/**
 * 仅用于测试：清除内存缓存（不影响持久化）。
 */
export function _resetFingerprintCache() {
  _cached = null
  _cachedMain = null
}
