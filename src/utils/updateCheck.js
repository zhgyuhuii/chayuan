/**
 * 官网检查更新（察元AI文档助手 · 对话窗升级提醒）
 * 打开对话窗时静默请求 aidooo.com /api/update/check（addon 通道）：
 *   - 版本口径：本插件运行版本 = package.json 经 vite define 注入的 __APP_VERSION__
 *     （与 runtimeSync.js / mcpBridge config.js 同源）。只有服务端最新版严格高于
 *     运行版本时才返回 {version,url,notes}；相同版本 / 运行版本更高 → null 不提示。
 *   - 安装包口径：按探测到的安装平台下发对应安装包；该平台暂无已发布包时回退
 *     同系另一架构目录（加载项本体是架构无关的 JS 包，服务端仅按目录归档）。
 *   - 拿不到运行版本（异常兜底）时直接返回 null —— 宁可不提醒，绝不误报。
 * 断网/超时/解析失败一律静默返回 null，绝不抛错。
 */
/* global __APP_VERSION__ */
const SITE = (window.CHAYUAN_SITE || 'https://aidooo.com').replace(/\/+$/, '')

export function platformKey() {
  const ua = navigator.userAgent || ''
  if (/Windows/i.test(ua)) return /arm64/i.test(ua) ? 'windows-arm64' : 'windows-amd64'
  if (/Macintosh|Mac OS/i.test(ua)) return 'mac-arm64'
  return 'linux-amd64'
}

/** 同系另一架构：WPS 内嵌 CEF 的 UA 不暴露 CPU 架构，探测键可能落到空目录 */
export function siblingPlatform(key) {
  const pair = {
    'mac-arm64': 'mac-x64', 'mac-x64': 'mac-arm64',
    'windows-arm64': 'windows-amd64', 'windows-amd64': 'windows-arm64',
    'linux-arm64': 'linux-amd64', 'linux-amd64': 'linux-arm64'
  }
  return pair[key] || null
}

/** 运行版本真源：__APP_VERSION__（构建期替换为 package.json version 字面量） */
export function currentVersion() {
  try {
    if (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) return String(__APP_VERSION__)
  } catch { /* 未注入：留空 */ }
  return ''
}

async function askServer(platform, version) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 8000)
  try {
    const url = `${SITE}/api/update/check?product=chayuan&platform=${platform}&channel=addon&version=${encodeURIComponent(version)}`
    const res = await fetch(url, { signal: ac.signal })
    if (!res.ok) return null
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

export async function checkUpdate(explicitVersion) {
  const version = String(explicitVersion || currentVersion() || '').trim()
  if (!version) return null // 运行版本未知：不提示，避免同版本误报
  try {
    const plat = platformKey()
    let j = await askServer(plat, version)
    if (!j) return null
    // 探测平台目录暂无已发布包 → 试同系另一架构（不因 updateAvailable=false 重试）
    if (j.ok && !j.latest && siblingPlatform(plat)) {
      j = await askServer(siblingPlatform(plat), version) || j
    }
    return j && j.updateAvailable && j.latest && j.latest.url
      ? { version: j.latest.version, url: j.latest.url, notes: j.latest.notes || '' }
      : null
  } catch { return null }
}
