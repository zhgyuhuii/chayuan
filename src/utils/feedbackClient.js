// src/utils/feedbackClient.js
// 反馈客户端基础模块:诊断信息收集、HMAC 请求签名、提交/列表/上传接口调用、离线草稿持久化与重试。

import pkg from '../../package.json'
import { getFingerprint } from './license/fingerprint.js'
import { getErrorLogFallbackLines } from './globalErrorLogger.js'

// ──────────── 常量 ────────────

const APP = 'wps'
const APP_NAME = '察元AI文档助手' // 察元AI文档助手
const DRAFTS_KEY = 'cy_feedback_drafts'
const FETCH_TIMEOUT_MS = 15000

// aidooo.com 经 XOR 0x5a + base64 混淆(与 runtimeSync.js 同源)
const _H = 'OzM+NTU1dDk1Nw=='

// HMAC 密钥:base64 编码存储,运行时解码(源码混淆,非加密)
// 原文:cy-fb-sign-2026-7Qx9Kp2Vw8Lm4Zr
const _SK = 'Y3ktZmItc2lnbi0yMDI2LTdReDlLcDJWdzhMbTRacg=='

// ──────────── 内部工具 ────────────

function _deobfuscateDomain() {
  const raw = atob(_H)
  let h = ''
  for (let i = 0; i < raw.length; i++) {
    h += String.fromCharCode(raw.charCodeAt(i) ^ 0x5a)
  }
  return h
}

function _getBaseUrl() {
  try {
    return 'https://' + _deobfuscateDomain()
  } catch (e) {
    return 'https://aidooo.com'
  }
}

function _getSecretBytes() {
  const str = atob(_SK)
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i)
  }
  return bytes
}

function _toHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

const _enc = new TextEncoder()

async function _sha256hex(content) {
  const buf = await crypto.subtle.digest('SHA-256', _enc.encode(String(content)))
  return _toHex(buf)
}

/**
 * HMAC-SHA256(secret, message) → lowercase hex。
 */
async function _hmacHex(secretBytes, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, _enc.encode(message))
  return _toHex(sig)
}

/**
 * 构造带超时的 fetch AbortController。返回 { signal, clear } 供 finally 清理。
 */
function _withTimeout(ms) {
  try {
    const ac = new AbortController()
    const tid = setTimeout(() => ac.abort(), ms)
    return { signal: ac.signal, clear: () => clearTimeout(tid) }
  } catch (e) {
    return { signal: undefined, clear: () => {} }
  }
}

/** 安全 fetch:超时 + 非 2xx 视为失败(抛出 Error)。 */
async function _fetch(url, opts) {
  const { signal, clear } = _withTimeout(FETCH_TIMEOUT_MS)
  try {
    const resp = await fetch(url, { ...(signal ? { signal } : {}), ...opts })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`)
    }
    return resp
  } finally {
    clear()
  }
}

// ──────────── 公开 API ────────────

/**
 * 收集客户端诊断信息。
 * @returns {{ appVersion, os, osVer, arch, logJson }}
 */
export async function collectDiagnostics() {
  const appVersion = pkg.version || ''

  let os = 'unknown'
  let osVer = ''
  let arch = ''
  try {
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
    if (/Windows NT ([0-9.]+)/.test(ua)) {
      os = 'windows'
      osVer = RegExp.$1
    } else if (/Mac OS X ([0-9_]+)/.test(ua)) {
      os = 'macos'
      osVer = RegExp.$1.replace(/_/g, '.')
    } else if (/Android[ /]([0-9.]+)/.test(ua)) {
      os = 'android'
      osVer = RegExp.$1
    } else if (/Linux/.test(ua)) {
      os = 'linux'
    }
    if (/arm64|aarch64/i.test(ua)) arch = 'arm64'
    else if (/x64|Win64|WOW64|x86_64|amd64/i.test(ua)) arch = 'x64'
  } catch (e) {
    void e
  }

  let recentErrors = []
  try {
    const lines = getErrorLogFallbackLines()
    if (Array.isArray(lines)) {
      recentErrors = lines.slice(-30)
    }
  } catch (e) {
    recentErrors = []
  }

  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
  const logObj = {
    version: appVersion,
    ua,
    ts: Date.now(),
    recentErrors
  }
  let logJson = ''
  try {
    logJson = JSON.stringify(logObj)
    if (logJson.length > 8000) {
      // 缩短 recentErrors 再序列化
      logObj.recentErrors = recentErrors.slice(-5)
      logJson = JSON.stringify(logObj)
      if (logJson.length > 8000) {
        logObj.recentErrors = []
        logJson = JSON.stringify(logObj)
      }
    }
  } catch (e) {
    logJson = JSON.stringify({ version: appVersion, ua, ts: Date.now(), recentErrors: [] })
  }

  return { appVersion, os, osVer, arch, logJson }
}

/**
 * 对反馈内容生成 HMAC-SHA256 签名。
 * canonical = mid + "\n" + app + "\n" + ts + "\n" + sha256hex(content)
 * sig = HMAC_SHA256(secret, canonical) 作为小写 hex。
 *
 * @param {string} mid    - 设备指纹
 * @param {string} app    - 应用标识(如 'wps')
 * @param {number} ts     - 时间戳 ms(Date.now())
 * @param {string} content - 反馈正文
 * @returns {Promise<string>} 小写 hex 签名
 */
export async function signFeedback(mid, app, ts, content) {
  const contentHash = await _sha256hex(content)
  const canonical = `${mid}\n${app}\n${ts}\n${contentHash}`
  return _hmacHex(_getSecretBytes(), canonical)
}

/**
 * 提交用户反馈。
 * 网络失败时将草稿保存到 localStorage 并抛出 { offline: true, message }。
 *
 * @param {{ content: string, attachments?: Array, type?: string }} param0
 * @returns {Promise<{ ok, id, status }>}
 */
export async function submitFeedback({ content, attachments = [], type = 'suggestion' }) {
  const mid = await getFingerprint()
  const { appVersion, os, osVer, arch, logJson } = await collectDiagnostics()
  const ts = Date.now()
  const sig = await signFeedback(mid, APP, ts, content)

  const body = {
    mid,
    app: APP,
    appName: APP_NAME,
    appVersion,
    os,
    osVer,
    arch,
    type,
    content,
    attachments: Array.isArray(attachments) ? attachments : [],
    logJson
  }

  try {
    const resp = await _fetch(`${_getBaseUrl()}/api/feedback`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cy-ts': String(ts),
        'x-cy-sig': sig
      },
      body: JSON.stringify(body)
    })
    return await resp.json()
  } catch (e) {
    saveDraft({ content, attachments, type })
    const err = new Error(e && e.message ? e.message : 'network error')
    err.offline = true
    throw err
  }
}

/**
 * 上传附件(原始 Blob/File)。不需要签名。
 * @param {File|Blob} file
 * @returns {Promise<{ id, url, kind, size, name }>}
 */
export async function uploadAttachment(file) {
  const name = (file && file.name) ? file.name : 'attachment'
  const mime = (file && file.type) ? file.type : 'application/octet-stream'
  const resp = await _fetch(`${_getBaseUrl()}/api/feedback/upload`, {
    method: 'POST',
    headers: {
      'content-type': mime,
      'x-filename': name
    },
    body: file
  })
  return await resp.json()
}

/**
 * 列出当前设备的历史反馈。失败时返回空数组(不抛出)。
 * @returns {Promise<Array>}
 */
export async function listMyFeedback() {
  try {
    const mid = await getFingerprint()
    const resp = await _fetch(
      `${_getBaseUrl()}/api/feedback?mid=${encodeURIComponent(mid)}`,
      { method: 'GET' }
    )
    const data = await resp.json()
    return Array.isArray(data && data.items) ? data.items : []
  } catch (e) {
    return []
  }
}

// ──────────── 草稿持久化 ────────────

/**
 * 保存草稿到 localStorage。
 * @param {{ content, attachments?, type? }} draft
 */
export function saveDraft(draft) {
  try {
    if (typeof localStorage === 'undefined') return
    const existing = loadDrafts()
    const localId = `d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    existing.push({
      localId,
      content: draft.content || '',
      attachments: Array.isArray(draft.attachments) ? draft.attachments : [],
      type: draft.type || 'suggestion',
      createdAt: new Date().toISOString()
    })
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(existing))
  } catch (e) {
    void e
  }
}

/**
 * 读取所有本地草稿。
 * @returns {Array<{ localId, content, attachments, type, createdAt }>}
 */
export function loadDrafts() {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(DRAFTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    return []
  }
}

/**
 * 删除指定 localId 的草稿。
 * @param {string} localId
 */
export function clearDraft(localId) {
  try {
    if (typeof localStorage === 'undefined') return
    const drafts = loadDrafts().filter(d => d.localId !== localId)
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts))
  } catch (e) {
    void e
  }
}

/**
 * 尝试重新提交所有本地草稿。
 * 每条成功则删除,失败则保留。
 * @returns {Promise<number>} 成功提交的条数
 */
export async function retryDrafts() {
  const drafts = loadDrafts()
  let submitted = 0
  for (const draft of drafts) {
    try {
      await submitFeedback({
        content: draft.content,
        attachments: draft.attachments,
        type: draft.type
      })
      clearDraft(draft.localId)
      submitted++
    } catch (e) {
      // 仍离线或失败:保留草稿,继续下一条
    }
  }
  return submitted
}
