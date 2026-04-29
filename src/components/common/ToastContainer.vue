<!--
  ToastContainer — 全局 Toast 渲染容器

  挂在 App.vue 顶层,订阅 toastService。
-->
<template>
  <Teleport to="body">
    <div class="tc-root" :class="{ empty: !toasts.length }" aria-live="polite">
      <transition-group name="toast" tag="div">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast"
          :class="`level-${t.level}`"
          role="alert"
        >
          <span class="toast-icon" aria-hidden="true">{{ iconFor(t.level) }}</span>
          <div class="toast-body">
            <div class="toast-msg">{{ t.message }}</div>
            <div v-if="t.detail" class="toast-detail">{{ t.detail }}</div>
          </div>
          <button
            v-if="t.actionLabel && t.onAction"
            class="toast-action"
            @click="onAction(t)"
          >{{ t.actionLabel }}</button>
          <button class="toast-close" @click="onDismiss(t.id)" aria-label="关闭">×</button>
        </div>
      </transition-group>
    </div>
  </Teleport>
</template>

<script>
import toast, { subscribe, dismiss } from '../../utils/toastService.js'

export default {
  name: 'ToastContainer',
  data() {
    return { toasts: toast.list() }
  },
  mounted() {
    this._unsub = subscribe(list => { this.toasts = list })
  },
  beforeUnmount() {
    this._unsub?.()
  },
  methods: {
    iconFor(level) {
      return ({ success: '✓', info: 'i', warn: '!', error: '✗' })[level] || '·'
    },
    onAction(t) {
      try { t.onAction?.() } catch (_) {}
      dismiss(t.id)
    },
    onDismiss(id) { dismiss(id) }
  }
}
</script>

<style scoped>
.tc-root {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 360px;
  pointer-events: none;
}
.tc-root.empty { display: none; }

.toast {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--color-bg-elevated, #fff);
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  pointer-events: auto;
  font-family: var(--font-base);
  font-size: 13px;
  color: var(--color-text-primary);
}
.toast.level-success { border-left: 3px solid var(--chy-celadon-500, #3fae82); }
.toast.level-info    { border-left: 3px solid var(--chy-violet-500, #7c6cdc); }
.toast.level-warn    { border-left: 3px solid var(--chy-amber-500, #d4a017); }
.toast.level-error   { border-left: 3px solid var(--chy-rouge-500, #e26a58); }

.toast-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
  font-size: 12px;
  line-height: 1;
}
.toast.level-success .toast-icon { background: var(--chy-celadon-500, #3fae82); color: #fff; }
.toast.level-info    .toast-icon { background: var(--chy-violet-500, #7c6cdc); color: #fff; font-style: italic; }
.toast.level-warn    .toast-icon { background: var(--chy-amber-500, #d4a017); color: #fff; }
.toast.level-error   .toast-icon { background: var(--chy-rouge-500, #e26a58); color: #fff; }

.toast-body { min-width: 0; }
.toast-msg { font-weight: 500; line-height: 1.4; word-break: break-word; }
.toast-detail { margin-top: 2px; font-size: 11px; color: var(--color-text-muted); line-height: 1.5; }

.toast-action {
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}
.toast-action:hover { background: var(--chy-ink-50, #f6f7f9); }

.toast-close {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  border-radius: 4px;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  color: var(--color-text-muted);
}
.toast-close:hover { background: var(--chy-ink-50, #f6f7f9); color: var(--color-text-primary); }

.toast-enter-active, .toast-leave-active {
  transition: transform 240ms var(--chy-ease-out, cubic-bezier(.32,.72,0,1)),
              opacity 240ms var(--chy-ease-out, cubic-bezier(.32,.72,0,1));
}
.toast-enter-from { transform: translateX(20px); opacity: 0; }
.toast-leave-to   { transform: translateX(20px); opacity: 0; }
</style>
