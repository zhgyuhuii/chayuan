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

/* global ActiveXObject */
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

// ──────────── 与 desktop fingerprint.py 对齐:同一原始系统标识派生 ────────────

async function sha256First8Hex(raw) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(raw)))
  const bytes = new Uint8Array(buf).subarray(0, 8)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

// 读共享 machine.id(原始标识,desktop 与 WPS 共用同一文件)
function readSharedRawId() {
  try {
    const fs = getApplication()?.FileSystem
    if (!fs) return ''
    const path = getDesktopMachineIdPath()
    if (!path) return ''
    const content = (fs.readFileString ? fs.readFileString(path) : fs.ReadFile?.(path)) || ''
    return String(content).trim()
  } catch (e) { return '' }
}

// 读 OS 原始机器标识:Linux /etc/machine-id;Windows 注册表 MachineGuid(与 fingerprint.py 同源)
function readOsRawId() {
  const r = _resolveHomeOs()
  const osType = r?.osType
  const fs = getApplication()?.FileSystem
  if (osType === 'linux' && fs) {
    for (const p of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
      try {
        const c = (fs.readFileString ? fs.readFileString(p) : fs.ReadFile?.(p)) || ''
        const v = String(c).trim()
        if (v) return v
      } catch (_) { /* next */ }
    }
  }
  if (osType === 'windows') {
    try {
      if (typeof ActiveXObject !== 'undefined') {
        const sh = new ActiveXObject('WScript.Shell')
        const v = String(sh.RegRead('HKLM\\SOFTWARE\\Microsoft\\Cryptography\\MachineGuid') || '').trim()
        if (v) return v
      }
    } catch (_) { /* ignore */ }
  }
  return ''
}

async function randomUuidHex() {
  const rand = new Uint8Array(16)
  crypto.getRandomValues(rand)
  return Array.from(rand).map(b => b.toString(16).padStart(2, '0')).join('')
}

// 固定共享 machine.id(与 CHAYUAN_ROOT 无关;desktop fingerprint.py 同读写,保证两端一致)
function getFixedMachineIdPath() {
  const r = _resolveHomeOs()
  if (!r) return null
  const { sep, userHome } = r
  return userHome + sep + '.chayuan' + sep + FILE_NAME
}
function readFixedRawId() {
  try {
    const fs = getApplication()?.FileSystem
    if (!fs) return ''
    const path = getFixedMachineIdPath()
    if (!path) return ''
    const content = (fs.readFileString ? fs.readFileString(path) : fs.ReadFile?.(path)) || ''
    return String(content).trim()
  } catch (e) { return '' }
}
function writeFixedRawId(raw) {
  try {
    const fs = getApplication()?.FileSystem
    if (!fs) return false
    const path = getFixedMachineIdPath()
    if (!path) return false
    const sep = path.includes('\\') ? '\\' : '/'
    const dir = path.substring(0, path.lastIndexOf(sep))
    if (dir && fs.Mkdir) {
      try { fs.Mkdir(dir) } catch (_) {
        const parts = dir.split(/[/\\]/).filter(Boolean)
        let current = path.includes('\\') ? (parts[0] + ':') : ('/' + parts[0])
        for (let i = 1; i < parts.length; i++) { current = current + sep + parts[i]; try { fs.Mkdir(current) } catch (_2) { /* exists */ } }
      }
    }
    if (fs.writeFileString) fs.writeFileString(path, raw)
    else if (fs.WriteFile) fs.WriteFile(path, raw)
    else return false
    return true
  } catch (e) { return false }
}

// 对齐 fingerprint.py 的 _stable_machine_id:共享文件 → OS 标识 → 随机,并落盘共享文件
async function getRawMachineId() {
  // 1) 固定共享文件(与 CHAYUAN_ROOT 无关,desktop 同读)——最高优先,保证两端一致
  let raw = readFixedRawId()
  if (raw) return raw
  // 2) 兼容:老桌面 OS 默认 <dataDir>/license/machine.id
  raw = readSharedRawId()
  // 3) OS 硬件标识(machine-id / MachineGuid)
  if (!raw) raw = readOsRawId()
  // 4) 兜底随机
  if (!raw) raw = await randomUuidHex()
  // 落盘固定共享文件,让 desktop 也读到同一值
  writeFixedRawId(raw)
  return raw
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
  try {
    const raw = await getRawMachineId()
    if (raw) { _cachedMain = await sha256First8Hex(raw); return _cachedMain }
  } catch (e) { /* 退到旧 WPS 自身指纹 */ }
  _cachedMain = await getWpsOwnFingerprint()
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
    const main = await getFingerprint()
    if (isValid16Hex(main)) list.push(main.toLowerCase())
  } catch (e) { /* ignore */ }
  // 兼容老安装:旧 WPS 自身随机指纹(只读,不新生成)
  try {
    const legacy = readFromFileSystem() || (await readFromOPFS()) || readFromLocalStorage()
    if (isValid16Hex(legacy) && !list.includes(String(legacy).toLowerCase())) list.push(String(legacy).toLowerCase())
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
