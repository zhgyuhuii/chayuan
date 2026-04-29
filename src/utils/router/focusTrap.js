/**
 * focusTrap — 把 Tab 焦点限制在某个 dialog 内
 *
 * 解决 P6 问题:dialog 打开后,Tab 会跳到底层页面焦点,无障碍体验差。
 * 标准 modal 行为:Tab 在 dialog 内循环;Esc 关闭。
 *
 * 用法:
 *   const trap = createFocusTrap(dialogElement)
 *   trap.activate()    // 当前焦点存到 trap.previousFocus,首个 focusable 自动聚焦
 *   trap.deactivate()  // Esc 或关闭时调,焦点还原
 *
 * Vue 组件用:
 *   <DialogShell v-focus-trap>...</DialogShell>
 *   App.vue 注册指令:app.directive('focus-trap', focusTrapDirective)
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

export function createFocusTrap(rootEl) {
  if (!rootEl || typeof rootEl.querySelectorAll !== 'function') {
    return { activate() {}, deactivate() {}, isActive() { return false } }
  }
  let active = false
  let previousFocus = null

  const handler = (e) => {
    if (!active) return
    if (e.key !== 'Tab') return
    const elements = Array.from(rootEl.querySelectorAll(FOCUSABLE)).filter(el => !el.hidden)
    if (elements.length === 0) {
      e.preventDefault()
      return
    }
    const first = elements[0]
    const last = elements[elements.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      last.focus()
      e.preventDefault()
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus()
      e.preventDefault()
    }
  }

  return {
    activate() {
      if (active) return
      previousFocus = document.activeElement
      const elements = Array.from(rootEl.querySelectorAll(FOCUSABLE))
      if (elements[0]) elements[0].focus()
      document.addEventListener('keydown', handler)
      active = true
    },
    deactivate() {
      if (!active) return
      document.removeEventListener('keydown', handler)
      try { previousFocus?.focus?.() } catch {}
      previousFocus = null
      active = false
    },
    isActive() { return active }
  }
}

/**
 * Vue 3 自定义指令 v-focus-trap。
 *   app.directive('focus-trap', focusTrapDirective)
 */
export const focusTrapDirective = {
  mounted(el, binding) {
    el._focusTrap = createFocusTrap(el)
    if (binding.value !== false) el._focusTrap.activate()
  },
  updated(el, binding) {
    if (!el._focusTrap) return
    if (binding.value === false && el._focusTrap.isActive()) el._focusTrap.deactivate()
    else if (binding.value !== false && !el._focusTrap.isActive()) el._focusTrap.activate()
  },
  beforeUnmount(el) {
    el._focusTrap?.deactivate()
    delete el._focusTrap
  }
}

export default {
  createFocusTrap,
  focusTrapDirective
}
