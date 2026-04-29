<!--
  DialogShell — 28 个对话框的统一骨架

  特性:
  - 统一头部(标题 + ✕ 关闭)
  - 统一底部(主操作 / 取消 槽位)
  - 自适应主体(滚动 + 留白)
  - 玻璃材质背景 + 三层阴影
  - aria-modal / 焦点陷阱预留
  - 兼容 WPS Dialog 与浏览器预览两种宿主

  用法:
    <DialogShell title="文档脱密" @close="onClose">
      <template #subtitle>请确认操作前已备份原件</template>
      <p>主体内容...</p>
      <template #actions>
        <button class="dlg-btn">取消</button>
        <button class="dlg-btn primary">确认</button>
      </template>
    </DialogShell>
-->
<template>
  <section
    ref="shellRoot"
    class="dialog-shell"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="titleId"
    :class="{ 'is-borderless': borderless }"
  >
    <header v-if="!hideHeader" class="dialog-header">
      <div class="dialog-title-wrap">
        <slot name="icon" />
        <h3 :id="titleId" class="dialog-title">
          <slot name="title">{{ title }}</slot>
        </h3>
      </div>
      <button
        v-if="closable"
        type="button"
        class="dialog-close"
        :aria-label="closeLabel"
        @click="emitClose"
      >×</button>
    </header>

    <div v-if="$slots.subtitle" class="dialog-subtitle">
      <slot name="subtitle" />
    </div>

    <main
      class="dialog-body"
      :class="{ 'no-padding': flushBody }"
      :data-scroll-shadow="scrollShadow"
    >
      <slot />
    </main>

    <footer v-if="$slots.actions || $slots.footer" class="dialog-footer">
      <slot name="footer">
        <div class="dialog-actions">
          <slot name="actions" />
        </div>
      </slot>
    </footer>
  </section>
</template>

<script>
let dialogShellSeq = 0

export default {
  name: 'DialogShell',
  props: {
    title:         { type: String, default: '' },
    closable:      { type: Boolean, default: true },
    closeLabel:    { type: String,  default: '关闭' },
    hideHeader:    { type: Boolean, default: false },
    flushBody:     { type: Boolean, default: false },
    borderless:    { type: Boolean, default: false },
    scrollShadow:  { type: String,  default: 'true' }   // 'true' | 'false'
  },
  emits: ['close'],
  data() {
    dialogShellSeq += 1
    return {
      titleId: `chy-dlg-title-${dialogShellSeq}`
    }
  },
  async mounted() {
    window.addEventListener('keydown', this._onKeydown)
    // 焦点限制:Tab 不会跳出 dialog,Esc 关闭(无障碍)
    try {
      const { createFocusTrap } = await import('../../utils/router/focusTrap.js')
      this._focusTrap = createFocusTrap(this.$refs.shellRoot)
      this._focusTrap.activate()
    } catch (_) { /* focusTrap 缺失静默 */ }
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this._onKeydown)
    if (this._focusTrap) { try { this._focusTrap.deactivate() } catch (_) {} this._focusTrap = null }
  },
  methods: {
    emitClose() {
      this.$emit('close')
    },
    _onKeydown(e) {
      if (e.key === 'Escape' && this.closable) {
        this.emitClose()
      }
    }
  }
}
</script>

<style scoped>
.dialog-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--color-bg-card, #fff);
  color: var(--color-text-primary, #0F1115);
  font-family: var(--font-ui);
  font-size: var(--fz-14, 14px);
  line-height: var(--lh-normal, 1.5);
  border-radius: var(--r-4, 14px);
  box-shadow: var(--chy-elev-2);
  overflow: hidden;
}
.dialog-shell.is-borderless {
  border-radius: 0;
  box-shadow: none;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--s-4, 16px) var(--s-5, 24px);
  border-bottom: 1px solid var(--color-border);
  flex: 0 0 auto;
}
.dialog-title-wrap {
  display: flex;
  align-items: center;
  gap: var(--s-2, 8px);
  min-width: 0;
}
.dialog-title {
  margin: 0;
  font-size: var(--fz-16, 16px);
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dialog-close {
  appearance: none;
  border: 0;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--r-2, 6px);
  transition: background var(--chy-motion-fast, 180ms) var(--chy-ease-out);
}
.dialog-close:hover {
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
}

.dialog-subtitle {
  padding: var(--s-2, 8px) var(--s-5, 24px) 0;
  font-size: var(--fz-13, 13px);
  color: var(--color-text-secondary);
}

.dialog-body {
  flex: 1 1 auto;
  overflow: auto;
  padding: var(--s-4, 16px) var(--s-5, 24px);
  scroll-behavior: smooth;
}
.dialog-body.no-padding {
  padding: 0;
}
/* 滚动阴影提示(顶/底) */
.dialog-body[data-scroll-shadow="true"] {
  background:
    linear-gradient(var(--color-bg-card) 30%, rgba(255,255,255,0)),
    linear-gradient(rgba(255,255,255,0), var(--color-bg-card) 70%) 0 100%,
    radial-gradient(farthest-side at 50% 0, rgba(15,17,21,.08), transparent),
    radial-gradient(farthest-side at 50% 100%, rgba(15,17,21,.08), transparent) 0 100%;
  background-repeat: no-repeat;
  background-color: var(--color-bg-card);
  background-size: 100% 32px, 100% 32px, 100% 16px, 100% 16px;
  background-attachment: local, local, scroll, scroll;
}

.dialog-footer {
  padding: var(--s-3, 12px) var(--s-5, 24px);
  border-top: 1px solid var(--color-border);
  flex: 0 0 auto;
  background: var(--color-bg-card);
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--s-2, 8px);
}

/* 标准按钮样式(供 actions 槽内用) */
:deep(.dlg-btn) {
  appearance: none;
  border: 1px solid var(--color-border-strong);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  padding: 7px 16px;
  border-radius: var(--r-2, 6px);
  font-size: var(--fz-13, 13px);
  cursor: pointer;
  transition: all var(--chy-motion-fast, 180ms) var(--chy-ease-out);
}
:deep(.dlg-btn:hover) {
  background: var(--color-bg-subtle);
}
:deep(.dlg-btn.primary) {
  background: var(--chy-brand-600);
  color: #fff;
  border-color: transparent;
}
:deep(.dlg-btn.primary:hover) {
  background: var(--chy-brand-700);
}
:deep(.dlg-btn.danger) {
  background: var(--chy-rouge-500);
  color: #fff;
  border-color: transparent;
}
:deep(.dlg-btn:disabled) {
  opacity: .55;
  cursor: not-allowed;
}
</style>
