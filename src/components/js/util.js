//在后续的wps版本中，wps的所有枚举值都会通过wps.Enum对象来自动支持，现阶段先人工定义
var WPS_Enum = {
  msoCTPDockPositionLeft: 0,
  msoCTPDockPositionRight: 2,
  // 文档保护类型
  wdNoProtection: -1,
  wdAllowOnlyFormFields: 2,
  // 内容控件类型与外观
  wdContentControlText: 1,
  wdContentControlHidden: 2
}

function GetUrlPath() {
  // 在本地网页的情况下获取路径（与 index.html 同目录）
  if (window.location.protocol === 'file:') {
    const path = String(window.location.href || '').split('#')[0]
    return path.substring(0, path.lastIndexOf('/'))
  }

  // http(s)：包含 pathname，子路径部署时 ShowDialog 与资源根才正确
  const { protocol, hostname, port, pathname } = window.location
  const portPart = port ? `:${port}` : ''
  let p = pathname || '/'
  p = p.replace(/\/?index\.html$/i, '') || '/'
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  const pathPart = p === '/' ? '' : p
  return `${protocol}//${hostname}${portPart}${pathPart}`
}

/**
 * Vue 使用 hash 路由。离线 file:// 下必须带入口文件名，否则会变成「目录 + 路由名」的假路径，
 * ShowDialog / CreateTaskPane 无法加载 index.html，页面与图标资源全部失效。
 * 例：file:///.../chayuan_1.0.1/index.html#/ai-assistant
 */
function GetRouterHash() {
  if (window.location.protocol === 'file:') {
    return '/index.html#'
  }

  return '/#'
}

/**
 * 从 PluginStorage 的 AddinBaseUrl（目录，可含尾部 /）拼出与 hash 路由一致的 SPA URL。
 * @param {string} base - AddinBaseUrl
 * @param {string} hashRouteAndQuery - 如 dialog-delete-text?mode=row（无开头的 /）
 */
function addonSpaUrlFromStorageBase(base, hashRouteAndQuery) {
  const clean = String(base || '')
    .replace(/#.*$/, '')
    .replace(/\/index\.html$/i, '')
    .replace(/\/+$/, '')
  const path = String(hashRouteAndQuery || '').replace(/^\//, '')
  if (!path || !clean) return ''
  return clean.startsWith('file:')
    ? `${clean}/index.html#/${path}`
    : `${clean}/#/${path}`
}

export default {
  WPS_Enum,
  GetUrlPath,
  GetRouterHash,
  addonSpaUrlFromStorageBase
}
