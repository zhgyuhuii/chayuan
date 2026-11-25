/**
 * appSettingsStore — 全局设置磁盘真源（sidecar 侧，~/.config/chayuan/settings.json）。
 *
 * 背景（2026-11-21 真机实锤）：模型配置的 webview 文件层（Application.FileSystem 写
 * ~/Library/Application Support/chayuan/settings.json）在 macOS 沙盒 WPS 上从未成功
 * 过——该目录在磁盘上根本不存在；配置实际只活在 CEF localStorage 里，重装插件/
 * 清 CEF 缓存即丢（2026-09-30 VM 实测丢过一次），于是「重装一次就要重新配置一次」。
 *
 * sidecar 跑在用户态无沙盒，这里成为配置的持久真源：webview 保存时 POST
 * /app-settings/save 落盘；重装后 localStorage 为空，seedFromSidecar 经
 * GET /app-settings 拉回——重装不用重新配置。
 *
 * 路径沿用既有 /app-settings GET 端点的约定：dataDir 的兄弟目录 chayuan
 * （~/.config/chayuan/settings.json），重装 WPS/插件都不动它。
 * 零 npm 依赖（Bun 编译约束）。
 */

import fs from 'node:fs'
import path from 'node:path'
import { getDataDir } from './config.mjs'

export function appSettingsPath() {
  return path.join(getDataDir(), '..', 'chayuan', 'settings.json')
}

export function loadAppSettings() {
  try {
    return JSON.parse(fs.readFileSync(appSettingsPath(), 'utf8'))
  } catch (_) {
    return {}
  }
}

export function saveAppSettings(obj) {
  const p = appSettingsPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  // 原子写：tmp + rename。半途失败不产生半截 JSON（播种读到坏文件会静默回 {}
  // 并把用户带回未配置态——原子性是恢复语义的一部分）
  const tmp = `${p}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8')
  fs.renameSync(tmp, p)
  return { ok: true, path: p }
}
