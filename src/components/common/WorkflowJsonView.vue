<!--
  WorkflowJsonView — JSON ↔ 表单切换(W4.4,无 Monaco 依赖)

  Props:
    workflow      当前工作流对象
    readonly

  Emits:
    'update'(newWorkflow)   解析成功且有变化时

  关键:
    - textarea 编辑 JSON
    - 实时 lint:JSON 解析失败 → 红框
    - 失焦时若合法且变了 → emit update
-->
<template>
  <div class="wjv-root">
    <header class="wjv-head">
      <span class="wjv-title">JSON 视图</span>
      <span class="wjv-status" :class="{ ok: !error, bad: !!error }">
        {{ error ? '⚠ ' + error : '✓ 合法 JSON' }}
      </span>
      <button class="wjv-btn" @click="onFormat" :disabled="!!error || readonly">格式化</button>
      <button class="wjv-btn" @click="onCopy">复制</button>
    </header>
    <textarea
      v-model="raw"
      class="wjv-textarea"
      :class="{ error: !!error }"
      :readonly="readonly"
      spellcheck="false"
      @blur="onCommit"
      @input="onParse"
    />
    <p v-if="lineCount" class="wjv-meta">{{ lineCount }} 行 · {{ raw.length }} 字符</p>
  </div>
</template>

<script>
export default {
  name: 'WorkflowJsonView',
  props: {
    workflow: { type: Object, required: true },
    readonly: { type: Boolean, default: false }
  },
  emits: ['update'],
  data() {
    return {
      raw: this.serialize(this.workflow),
      parsed: this.workflow,
      error: ''
    }
  },
  computed: {
    lineCount() { return this.raw.split('\n').length }
  },
  watch: {
    workflow: {
      deep: true,
      handler(newVal) {
        // 外部变更同步进来(避免循环:仅 raw 当前值不能反向解析时)
        try {
          const cur = JSON.parse(this.raw)
          if (JSON.stringify(cur) === JSON.stringify(newVal)) return
        } catch {}
        this.raw = this.serialize(newVal)
        this.parsed = newVal
        this.error = ''
      }
    }
  },
  methods: {
    serialize(obj) {
      try { return JSON.stringify(obj, null, 2) } catch { return '{}' }
    },
    onParse() {
      try {
        this.parsed = JSON.parse(this.raw)
        this.error = ''
      } catch (e) {
        this.error = String(e?.message || e).slice(0, 80)
      }
    },
    onCommit() {
      if (this.error) return
      const newWorkflow = this.parsed
      if (JSON.stringify(newWorkflow) !== JSON.stringify(this.workflow)) {
        this.$emit('update', newWorkflow)
      }
    },
    onFormat() {
      try {
        this.raw = JSON.stringify(JSON.parse(this.raw), null, 2)
      } catch {}
    },
    async onCopy() {
      try { await navigator.clipboard.writeText(this.raw) } catch {}
    }
  }
}
</script>

<style scoped>
.wjv-root {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 8px;
  background: var(--color-bg-elevated, #fff);
}
.wjv-head { display: flex; align-items: center; gap: 8px; font-size: 11px; }
.wjv-title { font-weight: 600; color: var(--color-text-secondary); text-transform: uppercase; }
.wjv-status { font-family: var(--font-mono); padding: 1px 6px; border-radius: 3px; flex: 1; }
.wjv-status.ok { color: var(--chy-celadon-700, #1f6e51); background: rgba(63, 174, 130, 0.10); }
.wjv-status.bad { color: var(--chy-rouge-700, #a3392a); background: rgba(226, 106, 88, 0.10); }
.wjv-btn {
  padding: 3px 8px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}
.wjv-btn:hover:not(:disabled) { background: var(--chy-ink-50, #f6f7f9); }
.wjv-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.wjv-textarea {
  width: 100%;
  min-height: 280px;
  padding: 8px 10px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 4px;
  background: var(--chy-ink-50, #fafbfc);
  color: var(--color-text-primary);
  resize: vertical;
  outline: none;
}
.wjv-textarea:focus {
  border-color: var(--chy-violet-400, #a397e8);
  box-shadow: 0 0 0 2px rgba(124, 108, 220, 0.10);
}
.wjv-textarea.error {
  border-color: var(--chy-rouge-500, #e26a58);
  background: rgba(226, 106, 88, 0.04);
}
.wjv-meta { margin: 0; font-size: 10px; color: var(--color-text-muted); font-family: var(--font-mono); text-align: right; }
</style>
