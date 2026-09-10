/**
 * localEngineSetup — 本地推理引擎（Ollama / LM Studio）检测与一键安装引导。
 *
 * 能力边界（WPS webview 沙盒）：
 *   - 检测：webview 内 fetch http://127.0.0.1:<port> 即可（与 chatApi 同源策略
 *     无关，127.0.0.1 目标不受页面协议影响；被 WPS 安全层拦截时降级为「无法确认」）
 *   - 安装：webview 无权限静默安装软件。提供两级引导：
 *     ① ShellExecute 拉起（Windows 官方安装器直装 / macOS 复制 brew 或拖拽安装）
 *     ② 全部失败时复制安装命令到剪贴板 + 打开官网下载页
 */

const ENGINES = {
  ollama: {
    name: 'Ollama',
    ports: [11434],
    apiUrl: 'http://localhost:11434',
    docsUrl: 'https://ollama.com/',
    downloadUrl: {
      windows: 'https://ollama.com/download/windows',
      macos: 'https://ollama.com/download/mac',
      linux: 'https://ollama.com/download/linux'
    },
    // 安装命令（剪贴板兜底用）
    installCommand: {
      macos: 'brew install ollama',
      linux: 'curl -fsSL https://ollama.com/install.sh | sh',
      windows: ''
    },
    probePath: '/api/version'
  },
  'lm-studio': {
    name: 'LM Studio',
    ports: [1234],
    apiUrl: 'http://localhost:1234',
    docsUrl: 'https://lmstudio.ai/',
    downloadUrl: {
      windows: 'https://lmstudio.ai/download',
      macos: 'https://lmstudio.ai/download',
      linux: 'https://lmstudio.ai/download'
    },
    installCommand: {},
    probePath: '/v1/models'
  }
}

function detectPlatform() {
  const ua = String(navigator?.userAgent || '').toLowerCase()
  const plat = String(navigator?.platform || '').toLowerCase()
  if (/windows|win32|win64/.test(ua) || /^win/.test(plat)) return 'windows'
  if (/mac os x|macintosh|macintel/.test(ua) || /mac/.test(plat)) return 'macos'
  if (/linux|x11/.test(ua) || /linux/.test(plat)) return 'linux'
  return 'unknown'
}

export function getLocalEngineSpec(providerId) {
  const key = String(providerId || '').toLowerCase()
  return ENGINES[key] || null
}

/**
 * 探测本地引擎是否已安装并运行。
 * @returns {Promise<{status: 'running'|'unreachable'|'unknown', port?: number, version?: string}>}
 *   running=端口可访问；unreachable=端口无响应（未安装或未启动）；unknown=环境无法探测
 */
export async function probeLocalEngine(providerId, { timeoutMs = 2500 } = {}) {
  const spec = getLocalEngineSpec(providerId)
  if (!spec) return { status: 'unknown' }
  for (const port of spec.ports) {
    try {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
      const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
      const res = await fetch(`http://127.0.0.1:${port}${spec.probePath}`, {
        method: 'GET',
        signal: ctrl?.signal
      })
      if (timer) clearTimeout(timer)
      if (res.ok || res.status === 404 || res.status === 401) {
        // 401/404 也证明服务在（有响应即已安装）
        let version = ''
        try {
          const data = await res.json()
          version = String(data?.version || '')
        } catch { /* ignore */ }
        return { status: 'running', port, version }
      }
    } catch {
      // 试下一个端口
    }
  }
  return { status: 'unreachable' }
}

function shellExecute(target) {
  try {
    const app = window.Application || window.opener?.Application || window.parent?.Application
    if (app?.OAAssist?.ShellExecute) {
      app.OAAssist.ShellExecute(target)
      return true
    }
  } catch { /* ignore */ }
  return false
}

async function copyToClipboard(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* ignore */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/**
 * 一键安装：按平台最优路径引导。
 * @returns {Promise<{mode: 'shell'|'download'|'clipboard', message: string}>}
 */
export async function installLocalEngine(providerId) {
  const spec = getLocalEngineSpec(providerId)
  if (!spec) return { mode: 'clipboard', message: '该引擎暂不支持一键安装，请访问官网。' }
  const platform = detectPlatform()

  // macOS：brew 命令复制到剪贴板（终端粘贴执行），并打开官网下载页备选
  if (platform === 'macos') {
    const cmd = spec.installCommand.macos
    const copied = cmd ? await copyToClipboard(cmd) : false
    const opened = shellExecute(spec.downloadUrl[platform] || spec.docsUrl)
    return {
      mode: 'clipboard',
      message: copied
        ? `安装命令已复制：${cmd}。已为你打开下载页；在终端粘贴命令或从下载页安装均可。`
        : `请从打开的页面下载 ${spec.name} 安装。`
    }
  }

  // Windows：ShellExecute 直接拉起官方安装器下载页（exe 下载后双击安装）
  const url = spec.downloadUrl[platform] || spec.docsUrl
  const shelled = shellExecute(url)
  if (shelled) {
    return { mode: 'shell', message: `已为你打开 ${spec.name} 下载页，下载后双击安装即可。` }
  }

  // 全部失败：复制下载链接
  const copied = await copyToClipboard(url)
  return {
    mode: 'clipboard',
    message: copied ? `下载链接已复制：${url}。请粘贴到浏览器下载安装。` : `请访问 ${url} 下载安装。`
  }
}
