/**
 * 在 WPS CEF 内展示错误详情：仅用当前文档内的 DOM，不使用 window.open / document.write，
 * 降低触发 CrBrowserMain 宿主崩溃的概率。
 *
 * 与官方「加载项网页调试」一致：异常处理遵循标准 Web API（见 MDN：error / unhandledrejection）。
 * WPS 文档中 InvokeAsHttp 等接口需在回调里判断 res.status；此处为页面内 JS 全局兜底。
 *
 * 说明：若宿主 native 层已 abort()，JS 无法拦截，只能通过避免危险调用与缩小同步负载来降低概率。
 */

/** CEF 主线程上单次赋值过大字符串或剪贴板 API 可能诱发宿主不稳定，偏小保守上限 */
const MAX_DETAIL_CHARS = 24000
const FLUSH_MS = 500

let overlayRoot = null
let flushTimer = null
let pendingLines = []

function truncateDetail(text) {
  const s = String(text ?? '')
  if (s.length <= MAX_DETAIL_CHARS) return s
  return `${s.slice(0, MAX_DETAIL_CHARS)}\n\n…[已截断，总长度约 ${s.length} 字符]`
}

function ensureOverlay() {
  if (overlayRoot && document.body.contains(overlayRoot)) return overlayRoot

  const root = document.createElement('div')
  root.id = 'nd-safe-error-overlay'
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  root.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483646',
    'background:rgba(0,0,0,.45)',
    'display:none',
    'align-items:center',
    'justify-content:center',
    'padding:16px',
    'box-sizing:border-box',
    'font-family:system-ui,-apple-system,sans-serif'
  ].join(';')

  const panel = document.createElement('div')
  panel.style.cssText = [
    'width:min(720px,100%)',
    'max-height:min(88vh,820px)',
    'background:#fff',
    'border-radius:10px',
    'box-shadow:0 8px 32px rgba(0,0,0,.2)',
    'display:flex',
    'flex-direction:column',
    'overflow:hidden'
  ].join(';')

  const head = document.createElement('div')
  head.style.cssText = 'padding:14px 16px;border-bottom:1px solid #e8e8e8;font-weight:600;font-size:15px;'
  head.textContent = '错误'

  const hint = document.createElement('p')
  hint.style.cssText = 'margin:0 0 8px;padding:0 16px;font-size:12px;color:#666;line-height:1.4;'
  hint.textContent = '可复制下方全文用于排障。若弹窗异常，请查看日志目录中的按日日志文件。'

  const ta = document.createElement('textarea')
  ta.readOnly = true
  ta.spellcheck = false
  ta.style.cssText = [
    'margin:0 16px 12px',
    'flex:1',
    'min-height:220px',
    'max-height:52vh',
    'resize:vertical',
    'font-size:12px',
    'line-height:1.45',
    'font-family:ui-monospace,SFMono-Regular,monospace',
    'padding:10px',
    'box-sizing:border-box',
    'border:1px solid #ccc',
    'border-radius:6px'
  ].join(';')

  const row = document.createElement('div')
  row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;padding:0 16px 16px;'

  const copyBtn = document.createElement('button')
  copyBtn.type = 'button'
  copyBtn.textContent = '复制全部'
  copyBtn.style.cssText = 'padding:8px 14px;font-size:13px;cursor:pointer;'

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.textContent = '关闭'
  closeBtn.style.cssText = 'padding:8px 14px;font-size:13px;cursor:pointer;'

  const close = () => {
    try {
      root.style.display = 'none'
      ta.value = ''
    } catch (e) {
      void e
    }
  }

  copyBtn.addEventListener('click', () => {
    const text = ta.value || ''
    try {
      const p = navigator.clipboard?.writeText?.(text)
      if (p && typeof p.then === 'function') {
        p.then(() => {
          try {
            console.info('[chayuan] 已复制错误详情到剪贴板')
          } catch (e) {
            void e
          }
        }, () => {
          try {
            ta.focus()
            ta.select()
            document.execCommand('copy')
          } catch (e) {
            void e
          }
        })
      } else {
        ta.focus()
        ta.select()
        document.execCommand('copy')
      }
    } catch (e) {
      void e
    }
  })

  closeBtn.addEventListener('click', close)
  root.addEventListener('click', (ev) => {
    if (ev.target === root) close()
  })

  row.appendChild(copyBtn)
  row.appendChild(closeBtn)
  panel.appendChild(head)
  panel.appendChild(hint)
  panel.appendChild(ta)
  panel.appendChild(row)
  root.appendChild(panel)

  try {
    document.body.appendChild(root)
  } catch (e) {
    void e
    return null
  }

  overlayRoot = root
  overlayRoot._ndTitleEl = head
  overlayRoot._ndTa = ta
  return overlayRoot
}

function flushPending() {
  flushTimer = null
  if (pendingLines.length === 0) return
  const merged = pendingLines.join('\n\n---\n\n')
  pendingLines = []
  showSafeErrorDetailSync({ title: '发生错误', detail: merged })
}

/**
 * @param {{ title?: string, detail: string, merge?: boolean }} opts
 */
export function showSafeErrorDetail(opts = {}) {
  try {
    const title = String(opts.title || '错误').trim() || '错误'
    const detail = truncateDetail(opts.detail != null ? String(opts.detail) : '')
    const merge = opts.merge !== false

    if (merge) {
      pendingLines.push(`【${title}】\n${detail}`)
      clearTimeout(flushTimer)
      flushTimer = setTimeout(flushPending, FLUSH_MS)
      return
    }
    showSafeErrorDetailSync({ title, detail })
  } catch (e) {
    void e
    try {
      alert(String(opts?.detail || opts || '未知错误').slice(0, 2500))
    } catch (e2) {
      void e2
    }
  }
}

function showSafeErrorDetailSync({ title, detail }) {
  const full = truncateDetail(detail)
  // 打开弹窗时不要写剪贴板：避免与 WPS 宿主在主线程序列化竞态。

  try {
    const root = ensureOverlay()
    if (!root || !root._ndTitleEl || !root._ndTa) {
      alert(`${title}\n\n${String(full).slice(0, 2400)}`)
      return
    }
    root._ndTitleEl.textContent = title
    root._ndTa.value = full
    root.style.display = 'flex'
    setTimeout(() => {
      try {
        root._ndTa.focus()
        root._ndTa.select()
      } catch (e) {
        void e
      }
    }, 0)
  } catch (e) {
    void e
    try {
      alert(`${title}\n\n${String(full).slice(0, 2400)}`)
    } catch (e2) {
      void e2
    }
  }
}
