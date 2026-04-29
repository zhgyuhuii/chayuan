<!--
  DiffPreviewCard — 写回前的"所答即所见"预演卡

  搭配 documentActions.applyDocumentAction({ dryRun: true }) 的 writeTargets。
  在用户点击"应用到文档"前,把"将在第 N 段执行替换 / 旧文 / 新文"清晰展示。

  用法:
    <DiffPreviewCard
      v-for="t in writeTargets"
      :key="t.locateKey"
      :action="t.action"
      :paragraph-index="t.paragraphIndex"
      :original-text="t.originalText"
      :output-text="t.outputText"
      :downgraded="t.downgraded"
      :char-range="[t.start, t.end]"
      @apply="onApply(t)"
      @cancel="onCancel(t)"
      @locate="onLocate(t)"
    />
-->
<template>
  <article class="diff-card" :class="['action-' + action, { downgraded }]">
    <header class="diff-head">
      <div class="diff-head-main">
        <span class="diff-action-badge">{{ actionLabel }}</span>
        <span class="diff-locate" v-if="locateText">{{ locateText }}</span>
      </div>
      <button
        v-if="locatable"
        class="diff-locate-btn"
        type="button"
        title="跳到文档对应位置"
        @click="$emit('locate')"
      >→</button>
    </header>

    <div v-if="downgraded && downgradeReason" class="diff-downgrade-hint">
      ⚠ 已降级:{{ downgradeReason }}
    </div>

    <div class="diff-body">
      <div v-if="showOriginal" class="diff-line diff-old" :title="originalText">
        <span class="diff-marker">−</span>
        <span class="diff-text">{{ originalDisplay }}</span>
      </div>
      <div v-if="showOutput" class="diff-line diff-new" :title="outputText">
        <span class="diff-marker">+</span>
        <span class="diff-text">{{ outputDisplay }}</span>
      </div>
    </div>

    <footer class="diff-foot">
      <button class="diff-btn" type="button" @click="$emit('cancel')">关闭</button>
      <button class="diff-btn primary" type="button" @click="$emit('apply')">
        ✓ 应用到文档
      </button>
    </footer>
  </article>
</template>

<script>
const ACTION_LABELS = {
  replace:        '替换',
  insert:         '插入',
  'insert-after': '段后插入',
  'insert-before':'段前插入',
  prepend:        '插入到文档最前',
  append:         '追加到文末',
  comment:        '添加批注',
  'link-comment': '链接批注',
  'comment-replace': '批注 + 替换',
  'paste-text':    '粘贴文本',
  'replace-selection-text': '替换选区',
  'append-text-to-document': '追加文末'
}

export default {
  name: 'DiffPreviewCard',
  props: {
    action:         { type: String, default: 'replace' },
    paragraphIndex: { type: Number, default: 0 },
    charRange:      { type: Array,  default: () => [] },
    originalText:   { type: String, default: '' },
    outputText:     { type: String, default: '' },
    downgraded:     { type: Boolean, default: false },
    downgradeReason:{ type: String, default: '' },
    locatable:      { type: Boolean, default: true },
    maxPreviewLength: { type: Number, default: 240 }
  },
  emits: ['apply', 'cancel', 'locate'],
  computed: {
    actionLabel() {
      return ACTION_LABELS[this.action] || this.action || '写回'
    },
    locateText() {
      const parts = []
      if (this.paragraphIndex > 0) parts.push(`第 ${this.paragraphIndex} 段`)
      if (Array.isArray(this.charRange) && this.charRange.length === 2) {
        const [start, end] = this.charRange.map(n => Number(n) || 0)
        if (end > start) parts.push(`第 ${start}–${end} 字`)
      }
      return parts.length ? `将在 ${parts.join(' · ')}` : ''
    },
    showOriginal() {
      const a = this.action || ''
      return a === 'replace' || a === 'comment-replace' || a === 'replace-selection-text'
    },
    showOutput() {
      return this.action !== 'none'
    },
    originalDisplay() {
      return this.truncate(this.originalText)
    },
    outputDisplay() {
      return this.truncate(this.outputText)
    }
  },
  methods: {
    truncate(text) {
      const s = String(text || '').replace(/\s+/g, ' ').trim()
      if (s.length <= this.maxPreviewLength) return s
      return s.slice(0, this.maxPreviewLength) + '…'
    }
  }
}
</script>

<style scoped>
.diff-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--r-3, 10px);
  margin-bottom: var(--s-3, 12px);
  overflow: hidden;
  box-shadow: var(--chy-elev-1);
  font-family: var(--font-ui);
  animation: diffEnter var(--chy-motion-normal, 280ms) var(--chy-ease-out-spring);
}
.diff-card.downgraded {
  border-color: var(--chy-amber-500);
}

.diff-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--s-2, 8px) var(--s-3, 12px);
  background: var(--color-bg-subtle);
  border-bottom: 1px solid var(--color-border);
}
.diff-head-main {
  display: flex;
  align-items: center;
  gap: var(--s-2, 8px);
  min-width: 0;
}
.diff-action-badge {
  font-size: var(--fz-12, 12px);
  font-weight: 600;
  color: var(--chy-brand-700);
  background: var(--chy-brand-50);
  padding: 2px 8px;
  border-radius: var(--r-pill);
}
.action-comment .diff-action-badge,
.action-link-comment .diff-action-badge {
  color: var(--chy-amber-700);
  background: var(--chy-amber-100);
}
.action-comment-replace .diff-action-badge {
  color: var(--chy-violet-700);
  background: var(--chy-violet-100);
}

.diff-locate {
  font-size: var(--fz-12, 12px);
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.diff-locate-btn {
  appearance: none;
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  width: 22px;
  height: 22px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: all var(--chy-motion-fast, 180ms);
}
.diff-locate-btn:hover {
  background: var(--color-bg-card);
  color: var(--chy-brand-600);
  border-color: var(--chy-brand-400);
}

.diff-downgrade-hint {
  padding: 6px 12px;
  background: var(--chy-amber-100);
  color: var(--chy-amber-700);
  font-size: var(--fz-12, 12px);
  border-bottom: 1px solid var(--color-border);
}

.diff-body {
  padding: var(--s-2, 8px) var(--s-3, 12px);
  font-family: var(--font-mono);
  font-size: var(--fz-13, 13px);
  line-height: 1.55;
}
.diff-line {
  display: flex;
  gap: var(--s-2, 8px);
  padding: 4px 6px;
  border-left: 3px solid transparent;
  border-radius: var(--r-1, 4px);
  margin: 2px 0;
  white-space: pre-wrap;
  word-break: break-word;
  animation: diffLineEnter var(--chy-motion-normal, 280ms) var(--chy-ease-out);
}
.diff-line.diff-old {
  background: rgba(225, 71, 60, 0.08);
  border-left-color: var(--chy-rouge-500);
  color: var(--chy-rouge-700);
  animation-delay: 80ms;
}
.diff-line.diff-new {
  background: rgba(63, 174, 130, 0.10);
  border-left-color: var(--chy-celadon-500);
  color: var(--chy-celadon-700);
  animation-delay: 160ms;
}
.diff-marker {
  flex: 0 0 auto;
  font-weight: 700;
  color: currentColor;
}
.diff-text { flex: 1 1 auto; }

.diff-foot {
  display: flex;
  justify-content: flex-end;
  gap: var(--s-2, 8px);
  padding: var(--s-2, 8px) var(--s-3, 12px);
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-card);
  animation: diffLineEnter var(--chy-motion-normal, 280ms) var(--chy-ease-out);
  animation-delay: 240ms;
  animation-fill-mode: backwards;
}
.diff-btn {
  appearance: none;
  border: 1px solid var(--color-border-strong);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  padding: 5px 14px;
  border-radius: var(--r-2, 6px);
  font-size: var(--fz-13, 13px);
  cursor: pointer;
  transition: all var(--chy-motion-fast, 180ms);
}
.diff-btn:hover { background: var(--color-bg-subtle); }
.diff-btn.primary {
  background: var(--chy-brand-600);
  color: #fff;
  border-color: transparent;
}
.diff-btn.primary:hover { background: var(--chy-brand-700); }

@keyframes diffEnter {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes diffLineEnter {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
}
</style>
