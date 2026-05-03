/**
 * 在当前 dialog 内叠加显示提示/确认框,不再调用 window.confirm/window.alert。
 *
 * 背景:WPS 加载项里我们大量使用 ShowDialog 作为对话窗口(AIAssistantDialog 等),
 * 在这种内嵌 webview 里调用 window.confirm/alert 会被 WPS 宿主当成新模态窗弹出,
 * 视觉上会"关闭"或者"切走"原对话框 — 用户感受为"晃眼/把上一个窗口关掉了"。
 *
 * 解决:用 DOM 注入一个 overlay + card,z-index 极高,本窗口内显示,Promise 化结果。
 *  - inAppConfirm(message, opts) -> Promise<boolean>
 *  - inAppAlert(message, opts)   -> Promise<void>
 *
 * 设计要点:
 *  - 不依赖 Vue,直接 DOM API — 在不同 ShowDialog(各自一份 Vue 实例)里都能用
 *  - 支持 ESC 取消、Enter 确定、点击背景取消
 *  - 焦点自动落到主按钮,关闭后自然回到打开它的元素附近
 *  - 样式只注入一次,使用稳定 id 防止重复
 */

const STYLE_ID = 'in-app-dialog-styles'
const CONTAINER_CLASS = 'in-app-dialog-container'

function ensureStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .${CONTAINER_CLASS} {
      position: fixed; inset: 0; pointer-events: none;
      z-index: 2147483600;
    }
    .in-app-dialog-overlay {
      position: fixed; inset: 0;
      background: rgba(15, 23, 42, 0.42);
      display: flex; align-items: center; justify-content: center;
      pointer-events: auto;
      opacity: 0;
      transition: opacity 0.16s ease-out;
      backdrop-filter: blur(2px);
    }
    .in-app-dialog-overlay.is-open { opacity: 1; }
    .in-app-dialog-card {
      min-width: 320px;
      max-width: min(520px, calc(100vw - 32px));
      background: #ffffff;
      border-radius: 10px;
      box-shadow: 0 24px 60px -16px rgba(15, 23, 42, 0.45),
                  0 8px 16px -8px rgba(15, 23, 42, 0.25);
      overflow: hidden;
      transform: translateY(8px) scale(0.98);
      opacity: 0;
      transition: transform 0.18s cubic-bezier(.2,.8,.4,1), opacity 0.18s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
                   "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      color: #1f2a44;
    }
    .in-app-dialog-overlay.is-open .in-app-dialog-card {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
    .in-app-dialog-head {
      padding: 16px 20px 4px;
      font-size: 14.5px;
      font-weight: 600;
      letter-spacing: 0.01em;
    }
    .in-app-dialog-body {
      padding: 6px 20px 16px;
      font-size: 13.5px;
      line-height: 1.6;
      color: #344056;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: min(60vh, 420px);
      overflow-y: auto;
    }
    .in-app-dialog-foot {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 10px 16px 14px;
      background: #f8fafc;
      border-top: 1px solid #eef2f7;
    }
    .in-app-dialog-btn {
      min-width: 76px;
      padding: 6px 14px;
      font-size: 13px;
      border-radius: 6px;
      border: 1px solid #d6dbe6;
      background: #ffffff;
      color: #1f2a44;
      cursor: pointer;
      transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
    }
    .in-app-dialog-btn:hover { background: #f1f5f9; }
    .in-app-dialog-btn:focus-visible {
      outline: 2px solid #2a6ddf;
      outline-offset: 1px;
    }
    .in-app-dialog-btn-primary {
      background: #2a6ddf; border-color: #2a6ddf; color: #ffffff;
    }
    .in-app-dialog-btn-primary:hover { background: #2057bd; border-color: #2057bd; }
    .in-app-dialog-btn-danger {
      background: #d04848; border-color: #d04848; color: #ffffff;
    }
    .in-app-dialog-btn-danger:hover { background: #b03a3a; border-color: #b03a3a; }
  `
  document.head.appendChild(style)
}

function ensureContainer() {
  ensureStyles()
  let el = document.querySelector('.' + CONTAINER_CLASS)
  if (el && document.body.contains(el)) return el
  el = document.createElement('div')
  el.className = CONTAINER_CLASS
  document.body.appendChild(el)
  return el
}

function buildOverlay() {
  const container = ensureContainer()
  const overlay = document.createElement('div')
  overlay.className = 'in-app-dialog-overlay'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  container.appendChild(overlay)
  // 进场动画 — 下一帧加 is-open
  requestAnimationFrame(() => overlay.classList.add('is-open'))
  return overlay
}

function teardown(overlay) {
  if (!overlay || !overlay.parentNode) return
  overlay.classList.remove('is-open')
  setTimeout(() => {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay)
  }, 200)
}

function createButton(label, variant) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'in-app-dialog-btn' + (variant ? ' in-app-dialog-btn-' + variant : '')
  btn.textContent = String(label || '')
  return btn
}

/**
 * 在原 dialog 之上叠加显示一个确认框。
 * @param {string} message
 * @param {{ title?: string, okText?: string, cancelText?: string, danger?: boolean }} [opts]
 * @returns {Promise<boolean>} true=确定 / false=取消
 */
export function inAppConfirm(message, opts = {}) {
  const title = String(opts.title || '请确认')
  const okText = String(opts.okText || '确定')
  const cancelText = String(opts.cancelText || '取消')
  const variant = opts.danger ? 'danger' : 'primary'
  return new Promise(resolve => {
    if (typeof document === 'undefined') {
      // node 环境 fallback — 直接拒绝避免悬挂
      resolve(false); return
    }
    const overlay = buildOverlay()
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null
    let settled = false
    const finish = (ok) => {
      if (settled) return
      settled = true
      document.removeEventListener('keydown', onKey, true)
      teardown(overlay)
      try { previousActive?.focus?.() } catch (_) { /* 元素已卸载或不可聚焦,忽略 */ }
      resolve(!!ok)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false) }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); finish(true) }
    }
    document.addEventListener('keydown', onKey, true)

    const card = document.createElement('div')
    card.className = 'in-app-dialog-card'
    const head = document.createElement('div'); head.className = 'in-app-dialog-head'; head.textContent = title
    const body = document.createElement('div'); body.className = 'in-app-dialog-body'; body.textContent = String(message || '')
    const foot = document.createElement('div'); foot.className = 'in-app-dialog-foot'
    const cancelBtn = createButton(cancelText)
    const okBtn = createButton(okText, variant)
    cancelBtn.addEventListener('click', () => finish(false))
    okBtn.addEventListener('click', () => finish(true))
    foot.appendChild(cancelBtn); foot.appendChild(okBtn)
    card.appendChild(head); card.appendChild(body); card.appendChild(foot)
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(false) })
    overlay.appendChild(card)

    // 焦点延迟一帧,等动画完成,避免被 transition 抖动吃掉
    setTimeout(() => { try { okBtn.focus() } catch (_) { /* 焦点失败不影响主流程 */ } }, 30)
  })
}

/**
 * 在原 dialog 之上叠加显示一个提示框。
 * @param {string} message
 * @param {{ title?: string, okText?: string }} [opts]
 * @returns {Promise<void>}
 */
export function inAppAlert(message, opts = {}) {
  const title = String(opts.title || '提示')
  const okText = String(opts.okText || '我知道了')
  return new Promise(resolve => {
    if (typeof document === 'undefined') { resolve(); return }
    const overlay = buildOverlay()
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      document.removeEventListener('keydown', onKey, true)
      teardown(overlay)
      try { previousActive?.focus?.() } catch (_) { /* 元素已卸载或不可聚焦,忽略 */ }
      resolve()
    }
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation(); finish()
      }
    }
    document.addEventListener('keydown', onKey, true)

    const card = document.createElement('div')
    card.className = 'in-app-dialog-card'
    const head = document.createElement('div'); head.className = 'in-app-dialog-head'; head.textContent = title
    const body = document.createElement('div'); body.className = 'in-app-dialog-body'; body.textContent = String(message || '')
    const foot = document.createElement('div'); foot.className = 'in-app-dialog-foot'
    const okBtn = createButton(okText, 'primary')
    okBtn.addEventListener('click', finish)
    foot.appendChild(okBtn)
    card.appendChild(head); card.appendChild(body); card.appendChild(foot)
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish() })
    overlay.appendChild(card)

    setTimeout(() => { try { okBtn.focus() } catch (_) { /* 焦点失败不影响主流程 */ } }, 30)
  })
}
