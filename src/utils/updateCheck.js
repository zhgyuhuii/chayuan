/**
 * 官网检查更新（察元AI文档助手 · 对话窗升级提醒）
 * 打开对话窗时静默请求 aidooo.com；有新版返回 {version,url}，否则 null。
 * 断网/超时/解析失败一律静默返回 null，绝不抛错。
 */
const SITE = (window.CHAYUAN_SITE || 'https://aidooo.com').replace(/\/+$/, '')
export function platformKey() {
  const ua = navigator.userAgent || ''
  if (/Windows/i.test(ua)) return /arm64/i.test(ua) ? 'windows-arm64' : 'windows-amd64'
  if (/Macintosh|Mac OS/i.test(ua)) return 'mac-arm64'
  return 'linux-amd64'
}
export function currentVersion() {
  try { return (typeof WPS !== 'undefined' && WPS.PluginVersion) || '0.0.0' } catch { return '0.0.0' }
}
export async function checkUpdate(explicitVersion) {
  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 8000)
    const url = `${SITE}/api/update/check?product=chayuan&platform=${platformKey()}&channel=addon&version=${encodeURIComponent(explicitVersion || currentVersion())}`
    const res = await fetch(url, { signal: ac.signal })
    clearTimeout(t)
    if (!res.ok) return null
    const j = await res.json()
    return j && j.updateAvailable && j.latest && j.latest.url
      ? { version: j.latest.version, url: j.latest.url, notes: j.latest.notes || '' }
      : null
  } catch { return null }
}
