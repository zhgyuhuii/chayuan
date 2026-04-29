<!--
  SelectionContextChip — 当前接入助手的上下文胶囊

  显示用户即将传给 AI 的"上下文"是什么:选区 / 段落 / 全文 / 表格单元格 / 附件。
  解决"用户不知道这次助手到底拿什么去运行"的盲区。

  用法:
    <SelectionContextChip
      :kind="ctxKind"
      :char-count="86"
      :paragraph-index="3"
      removable
      @remove="onRemove"
      @click="onExpandPreview"
    />

  对应 documentContext.getSelectionContextSnapshot() 的 kind 字段:
    'selection' / 'document' / 'paragraph' / 'table-cell' / 'image' / 'unknown'
-->
<template>
  <button
    type="button"
    class="ctx-chip"
    :class="['kind-' + safeKind, { compact, danger }]"
    :title="title || description"
    @click="$emit('click', $event)"
  >
    <span class="ctx-icon" :aria-hidden="true">{{ icon }}</span>
    <span class="ctx-label">{{ label }}</span>
    <span v-if="charCount" class="ctx-count">·&nbsp;{{ charCountText }}</span>
    <span
      v-if="removable"
      class="ctx-remove"
      role="button"
      tabindex="0"
      aria-label="移除上下文"
      @click.stop="$emit('remove')"
      @keydown.enter.stop="$emit('remove')"
    >×</span>
  </button>
</template>

<script>
const KIND_META = {
  selection:  { icon: '✂', label: '选区',     color: 'brand'   },
  paragraph:  { icon: '¶', label: '段落',     color: 'brand'   },
  document:   { icon: '📄', label: '全文',    color: 'violet'  },
  'table-cell': { icon: '⊞', label: '表格单元格', color: 'celadon' },
  image:      { icon: '🖼', label: '图像',     color: 'amber'   },
  attachment: { icon: '📎', label: '附件',     color: 'amber'   },
  unknown:    { icon: '⌖', label: '上下文',   color: 'ink'     }
}

export default {
  name: 'SelectionContextChip',
  props: {
    kind:           { type: String, default: 'unknown' },
    label:          { type: String, default: '' },
    charCount:      { type: Number, default: 0 },
    paragraphIndex: { type: Number, default: 0 },
    description:    { type: String, default: '' },
    removable:      { type: Boolean, default: false },
    compact:        { type: Boolean, default: false },
    danger:         { type: Boolean, default: false },
    title:          { type: String, default: '' }
  },
  emits: ['click', 'remove'],
  computed: {
    safeKind() {
      return KIND_META[this.kind] ? this.kind : 'unknown'
    },
    icon() {
      const meta = KIND_META[this.safeKind]
      return meta?.icon || '⌖'
    },
    charCountText() {
      const n = Number(this.charCount) || 0
      if (n > 9999) return `${(n / 1000).toFixed(1)}k 字`
      return `${n} 字`
    }
  }
}
</script>

<style scoped>
.ctx-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--r-pill);
  font-size: var(--fz-12, 12px);
  font-family: var(--font-ui);
  line-height: 1.4;
  background: var(--chy-brand-50);
  color: var(--chy-brand-700);
  border: 1px solid transparent;
  cursor: pointer;
  user-select: none;
  transition: transform var(--chy-motion-fast, 180ms) var(--chy-ease-out-spring),
              background var(--chy-motion-fast, 180ms) var(--chy-ease-out),
              box-shadow var(--chy-motion-fast, 180ms) var(--chy-ease-out);
  white-space: nowrap;
}
.ctx-chip:hover {
  transform: translateY(-1px);
  background: var(--chy-brand-100);
  box-shadow: var(--chy-elev-1);
}
.ctx-chip:focus-visible {
  outline: 2px solid var(--chy-brand-400);
  outline-offset: 2px;
}
.ctx-chip.compact {
  padding: 2px 8px;
  font-size: 11px;
}

/* 按 kind 上色 */
.ctx-chip.kind-selection,
.ctx-chip.kind-paragraph {
  background: var(--chy-brand-50);
  color: var(--chy-brand-700);
}
.ctx-chip.kind-document {
  background: var(--chy-violet-100);
  color: var(--chy-violet-700);
}
.ctx-chip.kind-table-cell {
  background: var(--chy-celadon-100);
  color: var(--chy-celadon-700);
}
.ctx-chip.kind-image,
.ctx-chip.kind-attachment {
  background: var(--chy-amber-100);
  color: var(--chy-amber-700);
}
.ctx-chip.kind-unknown {
  background: var(--color-bg-subtle);
  color: var(--color-text-secondary);
  border-color: var(--color-border);
}
.ctx-chip.danger {
  background: var(--chy-rouge-100);
  color: var(--chy-rouge-700);
  border-color: var(--chy-rouge-300);
}

.ctx-icon {
  font-size: 13px;
  display: inline-block;
}
.ctx-label {
  font-weight: 500;
}
.ctx-count {
  font-family: var(--font-mono);
  color: currentColor;
  opacity: .7;
}
.ctx-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.06);
  color: currentColor;
  font-size: 14px;
  line-height: 1;
  margin-left: 2px;
  cursor: pointer;
  transition: background var(--chy-motion-fast, 180ms);
}
.ctx-remove:hover {
  background: rgba(0, 0, 0, 0.18);
}
</style>
