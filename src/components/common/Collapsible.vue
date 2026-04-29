<!--
  Collapsible — 可折叠区块通用组件

  解决"页面一打开砸全部数据"的体验问题。
  长页面用此组件包裹各 section,默认折叠,标题可点击展开。

  用法:
    <Collapsible title="灰度配额" :default-open="false" badge="3 / 100">
      <SomeContent />
    </Collapsible>

  Props:
    title          头部文字
    badge          头部右侧小标(数字 / 状态)
    defaultOpen    初始展开?(默认 false)
    persistKey     若给定,展开状态写入 localStorage
    icon           头部图标(emoji)
-->
<template>
  <section class="cl-root" :class="{ open: isOpen }">
    <button class="cl-head" @click="toggle" :aria-expanded="isOpen">
      <span class="cl-chevron" :class="{ open: isOpen }">▸</span>
      <span v-if="icon" class="cl-icon">{{ icon }}</span>
      <span class="cl-title">{{ title }}</span>
      <span v-if="badge" class="cl-badge">{{ badge }}</span>
    </button>
    <transition name="cl">
      <div v-show="isOpen" class="cl-body">
        <slot />
      </div>
    </transition>
  </section>
</template>

<script>
export default {
  name: 'Collapsible',
  props: {
    title:       { type: String, required: true },
    badge:       { type: [String, Number], default: '' },
    defaultOpen: { type: Boolean, default: false },
    persistKey:  { type: String, default: '' },
    icon:        { type: String, default: '' }
  },
  emits: ['toggle'],
  data() {
    return { isOpen: this.loadInitial() }
  },
  methods: {
    loadInitial() {
      if (!this.persistKey) return this.defaultOpen
      try {
        const v = window?.localStorage?.getItem(`chayuanCollapsible_${this.persistKey}`)
        if (v === '1') return true
        if (v === '0') return false
      } catch {}
      return this.defaultOpen
    },
    toggle() {
      this.isOpen = !this.isOpen
      if (this.persistKey) {
        try {
          window?.localStorage?.setItem(
            `chayuanCollapsible_${this.persistKey}`,
            this.isOpen ? '1' : '0'
          )
        } catch {}
      }
      this.$emit('toggle', this.isOpen)
    }
  }
}
</script>

<style scoped>
.cl-root {
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 8px;
  background: var(--color-bg-elevated, #fff);
  margin-bottom: 8px;
  overflow: hidden;
}
.cl-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
  color: var(--color-text-primary);
  text-align: left;
  font-size: 13px;
  font-weight: 500;
  transition: background 160ms;
}
.cl-head:hover { background: var(--chy-ink-50, #f6f7f9); }
.cl-chevron {
  transition: transform 200ms var(--chy-ease-out, cubic-bezier(.32,.72,0,1));
  display: inline-block;
  font-size: 10px;
  color: var(--color-text-muted);
}
.cl-chevron.open { transform: rotate(90deg); }
.cl-icon { font-size: 14px; }
.cl-title { flex: 1; }
.cl-badge {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--color-text-muted);
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--chy-ink-50, #f6f7f9);
}
.cl-body {
  padding: 4px 14px 14px;
  border-top: 1px solid var(--chy-ink-100, #f0f1f4);
}
.cl-enter-active, .cl-leave-active {
  transition: opacity 200ms, max-height 200ms;
  overflow: hidden;
}
.cl-enter-from, .cl-leave-to {
  opacity: 0;
  max-height: 0;
}
.cl-enter-to, .cl-leave-from {
  opacity: 1;
  max-height: 1000px;
}
</style>
