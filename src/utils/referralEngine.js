/**
 * referralEngine — 分享 / 引荐机制
 *
 * 解决 P6 问题:
 *   - 一个好用的助手怎么分享给同事?当前 teamShare 只 export JSON
 *   - 用 N 天后"邀请同事"无机制
 *
 * 提供 3 种分享形态:
 *   1. shareLink           复制 chayuan://install?pkg=base64(JSON) 协议链接
 *   2. shareToClipboard    复制为可读 markdown(便于贴到聊天)
 *   3. shareQrCode         生成 data URL 二维码图片(供截图分享)
 *
 * + 简易引荐计数:用户每分享一次记一笔,达到阈值可解锁徽章 / 主题。
 */

import { exportAssistantJSON } from './assistant/teamShare.js'
import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'

const REFERRAL_KEY = 'referralCount'
const SHARE_LOG_KEY = 'shareLog'
const MAX_SHARE_LOG = 100

/* ────────── 分享形态 ────────── */

/**
 * 生成 deeplink 字符串(chayuan://install?pkg=...)。
 * 调用方负责 navigator.clipboard.writeText。
 */
export function buildShareLink(assistant) {
  if (!assistant) return ''
  try {
    const json = exportAssistantJSON(assistant)
    const b64 = (typeof btoa !== 'undefined')
      ? btoa(unescape(encodeURIComponent(json)))
      : Buffer.from(json, 'utf-8').toString('base64')
    return `chayuan://install?pkg=${b64}`
  } catch { return '' }
}

/**
 * 复制到剪贴板 — markdown 格式(可贴到 IM)。
 *   ## 推荐助手:法务条款审核
 *   描述...
 *   导入命令:`chayuan://install?pkg=...`
 */
export async function shareToClipboard(assistant) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return { ok: false, error: '剪贴板不可用' }
  }
  const link = buildShareLink(assistant)
  const md = [
    `## 推荐助手:**${assistant.label || assistant.id}**`,
    '',
    assistant.description ? `> ${assistant.description}` : '',
    '',
    `导入链接(在 察元 ⌘K 输入"导入" → 粘贴):`,
    `\`\`\`\n${link}\n\`\`\``
  ].filter(Boolean).join('\n')
  try {
    await navigator.clipboard.writeText(md)
    recordShare(assistant.id, 'clipboard')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}

/**
 * 二维码:返回 data URL(用 inline canvas 自绘极简版)。
 * 真要更美观可以接 qrcode.js 库。
 */
export function buildQrCodeDataURL(text, size = 200) {
  // 极简占位:不真生成 QR,而是返回 svg base64(开发者后续接库)
  // 这里只 stub,真实使用提示开发者接入 qrcode 库
  if (typeof document === 'undefined') return ''
  const safe = String(text || '').slice(0, 256)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="100%" height="100%" fill="#fff" />
    <foreignObject x="10" y="10" width="${size - 20}" height="${size - 20}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:monospace;font-size:8px;word-break:break-all;color:#000">${safe}</div>
    </foreignObject>
  </svg>`
  return `data:image/svg+xml;base64,${typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(svg))) : ''}`
}

/* ────────── 引荐计数 ────────── */

function loadCount() {
  const s = loadGlobalSettings()
  return Number(s[REFERRAL_KEY]) || 0
}
function loadLog() {
  const s = loadGlobalSettings()
  return Array.isArray(s[SHARE_LOG_KEY]) ? s[SHARE_LOG_KEY] : []
}
function saveAll(count, log) {
  saveGlobalSettings({ [REFERRAL_KEY]: count, [SHARE_LOG_KEY]: log })
}

export function recordShare(assistantId, channel) {
  const count = loadCount() + 1
  const log = loadLog()
  log.unshift({ assistantId, channel, ts: Date.now() })
  if (log.length > MAX_SHARE_LOG) log.length = MAX_SHARE_LOG
  saveAll(count, log)
  return count
}

export function getReferralCount() {
  return loadCount()
}

export function listShareLog(limit = 20) {
  return loadLog().slice(0, limit)
}

/**
 * 解锁徽章:5 / 20 / 50 次解锁不同等级。
 */
export function getBadge() {
  const n = loadCount()
  if (n >= 50) return { level: 'gold', label: '⭐ 金牌推荐人', count: n }
  if (n >= 20) return { level: 'silver', label: '🥈 银牌推荐人', count: n }
  if (n >= 5) return { level: 'bronze', label: '🥉 铜牌推荐人', count: n }
  return { level: 'none', label: '', count: n }
}

export function reset() {
  saveAll(0, [])
}

export default {
  buildShareLink,
  shareToClipboard,
  buildQrCodeDataURL,
  recordShare,
  getReferralCount,
  listShareLog,
  getBadge,
  reset
}
