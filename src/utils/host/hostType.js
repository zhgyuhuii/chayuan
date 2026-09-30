/**
 * WPS 宿主类型识别（wps=文字 / et=表格 / wpp=演示）。
 *
 * 依据官方 office_v19：window.Application 由宿主动态注入，即当前宿主的根对象——
 * 同一段网页代码在 ET 宿主里拿到的就是 ET Application。三个对象模型各有独有
 * 集合：ET=Workbooks、WPP=Presentations、文字=Documents，据此互斥判定。
 * 识别结果在单个 webview 生命周期内不会变化（Application 不随文档切换换型），缓存。
 */
let _cached = null

export function detectAddonType() {
  if (_cached) return _cached
  let type = 'wps'
  try {
    const app = window.Application
    if (app) {
      const has = (key) => {
        try { return !!app[key] } catch { return false }
      }
      if (has('Workbooks')) type = 'et'
      else if (has('Presentations')) type = 'wpp'
      else type = 'wps'
    }
  } catch {
    type = 'wps'
  }
  _cached = type
  return type
}

/** 仅供测试/热重载使用 */
export function resetAddonTypeCache() {
  _cached = null
}

export function normalizeHostType(raw) {
  const s = String(raw || '').toLowerCase().trim()
  return s === 'et' || s === 'wpp' ? s : 'wps'
}

export const HOST_LABELS = { wps: '文字', et: '表格', wpp: '演示' }

export function hostLabel(type) {
  return HOST_LABELS[normalizeHostType(type)] || '文字'
}
