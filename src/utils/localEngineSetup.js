/**
 * localEngineSetup — 本地推理引擎（Ollama / LM Studio）检测与一键安装引导。
 *
 * 能力边界（WPS webview 沙盒）：
 *   - 检测：webview 内 fetch http://127.0.0.1:<port> 即可（与 chatApi 同源策略
 *     无关，127.0.0.1 目标不受页面协议影响；被 WPS 安全层拦截时降级为「无法确认」）
 *   - 安装：webview 无权限静默安装软件。提供两级引导：
 *     ① ShellExecute 拉起（Windows 官方安装器直装 / macOS 复制 brew 或拖拽安装）
 *     ② 全部失败时复制安装命令到剪贴板 + 打开官网下载页
 *
 * 国内网络适配（2026-09-10）：
 *   - github.com 常年不可达（brew install ollama 的 formula 也要拉 GitHub 源码，
 *     被墙环境下同样失败）；ollama.com 官网/下载 CDN、gitee、modelscope 通常可达
 *     但偶发波动——不猜哪个源可用，运行时并发探测主源与镜像源，谁通用谁
 *   - 引擎装好后 `ollama pull` 默认从 registry.ollama.ai 拉模型权重，国内速度
 *     可能很慢：提示用户可设 OLLAMA_HOST 无关的镜像环境变量/用 ModelScope 下载
 */

const ENGINES = {
  ollama: {
    name: 'Ollama',
    ports: [11434],
    apiUrl: 'http://localhost:11434',
    // 主源与国内备用源（download 页主源通常可达；modelscope 提供 GPU 版指南）
    sources: [
      { id: 'official', label: 'Ollama 官网', url: 'https://ollama.com/download' },
      { id: 'modelscope', label: 'ModelScope 镜像指南', url: 'https://modelscope.cn/docs/models/MaaS-llm/ollama-quick-start' }
    ],
    // 安装命令：剪贴板兜底用。linux 用官方脚本（走 ollama.com CDN，国内可达）；
    // macos brew formula 依赖 GitHub，被墙环境易失败，故排在官网下载之后
    installCommand: {
      macos: 'curl -fsSL https://ollama.com/install.sh | sh',
      linux: 'curl -fsSL https://ollama.com/install.sh | sh',
      windows: ''
    },
    probePath: '/api/version',
    // 模型拉取（引擎装好后的下一步，同样受网络影响）
    pullHint: '拉取模型若速度慢，可从 ModelScope（modelscope.cn）搜索模型名下载 GGUF 后导入，或为 Ollama 配置国内镜像加速。'
  },
  'lm-studio': {
    name: 'LM Studio',
    ports: [1234],
    apiUrl: 'http://localhost:1234',
    sources: [
      { id: 'official', label: 'LM Studio 官网', url: 'https://lmstudio.ai/download' }
    ],
    installCommand: {},
    probePath: '/v1/models',
    pullHint: 'LM Studio 内置模型搜索走 HuggingFace，国内速度慢时可在设置中切换 hf-mirror.com 镜像。'
  }
}

/** 源可达性快速探测（HEAD/GET 6s 超时，无 CORS 依赖——只看 resolve+响应头） */
async function isSourceReachable(url, timeoutMs = 6000) {
  try {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
    const res = await fetch(url, { method: 'GET', signal: ctrl?.signal, redirect: 'follow' })
    if (timer) clearTimeout(timer)
    // 2xx/3xx/4xx 都算「网络可达」（4xx 说明站点在，只是路径限制）
    return res.status < 500 || res.status >= 200
  } catch {
    return false
  }
}

/**
 * 并发探测源列表，返回第一个可达的源；全部不可达返回第一个（让用户看到错误本身）。
 */
export async function pickReachableSource(sources) {
  if (!Array.isArray(sources) || !sources.length) return null
  if (sources.length === 1) return sources[0]
  const results = await Promise.all(
    sources.map(async (s) => ({ s, ok: await isSourceReachable(s.url) }))
  )
  const hit = results.find(r => r.ok)
  return (hit || results[0]).s
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
 * 一键安装：按平台最优路径引导，源经运行时可达性探测择优（国内网络适配）。
 * @returns {Promise<{mode: 'shell'|'download'|'clipboard', message: string}>}
 */
export async function installLocalEngine(providerId) {
  const spec = getLocalEngineSpec(providerId)
  if (!spec) return { mode: 'clipboard', message: '该引擎暂不支持一键安装，请访问官网。' }
  const platform = detectPlatform()
  const source = await pickReachableSource(spec.sources || [])
  const url = source?.url || (spec.sources || [])[0]?.url || ''
  const viaLabel = source && source.id !== 'official' ? `（${source.label}）` : ''

  // Windows：ShellExecute 直接拉起下载页（exe 下载后双击安装）
  if (platform === 'windows') {
    const shelled = shellExecute(url)
    if (shelled) {
      return { mode: 'shell', message: `已为你打开 ${spec.name} 下载页${viaLabel}，下载后双击安装即可。` }
    }
    const copied = await copyToClipboard(url)
    return {
      mode: 'clipboard',
      message: copied ? `下载链接已复制${viaLabel}：${url}。请粘贴到浏览器下载安装。` : `请访问 ${url} 下载安装。`
    }
  }

  // macOS：官网下载页优先（直连 CDN 国内通常可达）；安装命令为剪贴板备选。
  // 注意不用 brew install ollama——其 formula 需拉 GitHub 源码，被墙环境常失败
  const cmd = spec.installCommand[platform] || ''
  const copied = cmd ? await copyToClipboard(cmd) : false
  const opened = shellExecute(url)
  if (copied || opened) {
    const parts = []
    if (opened) parts.push(`已打开下载页${viaLabel}`)
    if (copied) parts.push(`安装命令已复制（终端粘贴执行）：${cmd}`)
    return { mode: opened ? 'shell' : 'clipboard', message: parts.join('；') + '。' }
  }
  return { mode: 'clipboard', message: `请访问 ${url} 下载安装 ${spec.name}。` }
}

/**
 * 引擎装好后的模型拉取提示（模型权重下载同样受国内网络影响）。
 */
export function getPullHint(providerId) {
  const spec = getLocalEngineSpec(providerId)
  return spec?.pullHint || ''
}
