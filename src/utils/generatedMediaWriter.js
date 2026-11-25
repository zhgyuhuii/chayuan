/**
 * generatedMediaWriter — 生成媒体（生图/条码等 base64 产物）落到 WPS 容器内
 * 可读路径的轻量写入层。从 documentActions.js 抽出为独立模块（2026-11-25）：
 * agent 生图链（services/imagery/agentImageTier）需要它做 sidecar 落盘失败后
 * 的 webview 兜底，但 documentActions 本体拖着重依赖（spellCheckService 等），
 * 冒烟打包会撞 stub 缺口。
 *
 * 落点优先级：WPS jsapi Env.GetTempPath()（沙盒容器内，AddPicture 真机可读）
 * → 有效数据目录 _generated_media → 系统临时目录。写用 FileSystem.writeAsBinaryString
 * （手动文生图同款通道）。
 */
import { ensureDir, getEffectiveDataDir, pathJoin, pathSep } from './dataPathSettings.js'
import { getApp } from './host/hostBridge.js'

function arrayBufferToBinaryString(bytes) {
  let bin = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)))
  }
  return bin
}

function base64ToBinaryString(base64) {
  return atob(String(base64 || '').trim())
}

function getGeneratedMediaDir() {
  const app = getApp()
  const fs = app?.FileSystem
  if (!fs) throw new Error('FileSystem 不可用，无法保存生成媒体')
  let dir = ''
  if (app?.Env?.GetTempPath) {
    dir = String(app.Env.GetTempPath() || '').replace(/^file:\/\//i, '').replace(/\\/g, '/').replace(/\/+$/, '')
  }
  if (!dir && getEffectiveDataDir()) {
    dir = pathJoin(getEffectiveDataDir(), '_generated_media')
  }
  if (!dir) {
    dir = pathJoin(pathSep() === '\\' ? 'C:\\Temp' : '/tmp', 'chayuan_generated_media')
  }
  ensureDir(fs, dir)
  return pathSep() === '\\' ? dir.replace(/\//g, '\\') : dir.replace(/\\/g, '/')
}

function buildGeneratedMediaPath(extension = 'bin', prefix = 'chayuan_media') {
  const dir = getGeneratedMediaDir()
  const ext = String(extension || 'bin').replace(/^\.+/, '') || 'bin'
  return pathJoin(dir, `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`)
}

/**
 * 把生成媒体（{base64} 或 {bytes: ArrayBuffer}）写到容器内可读路径，返回文件路径。
 * 失败 throw（调用方决定降级）。
 */
export function saveGeneratedAssetToFile(asset, options = {}) {
  const app = getApp()
  const fs = app?.FileSystem
  if (!fs?.writeAsBinaryString) {
    throw new Error('当前环境不支持保存生成媒体文件')
  }
  const filePath = buildGeneratedMediaPath(asset?.extension || options.extension || 'bin', options.prefix || 'chayuan_media')
  const content = asset?.bytes
    ? arrayBufferToBinaryString(asset.bytes)
    : base64ToBinaryString(asset?.base64 || '')
  if (!content) {
    throw new Error('生成媒体内容为空，无法保存')
  }
  const ok = fs.writeAsBinaryString(filePath, content)
  if (!ok) {
    throw new Error('保存生成媒体文件失败')
  }
  return filePath
}
