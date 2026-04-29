<!--
  WorkflowVariablesPanel — 变量实时面板(W4.2)

  Props:
    instanceId   订阅哪个 instance(由 progressChannel 推送变化)
    initialVars  初始变量(本地编辑用)
    editable     是否允许手改(暂停时 true)

  Emits:
    'update:vars'(newVars)  用户手改变量后触发
-->
<template>
  <div class="wvp-root">
    <header class="wvp-head">
      <span class="wvp-title">变量</span>
      <span class="wvp-count">{{ entries.length }}</span>
      <button class="wvp-add" @click="showAdd = !showAdd">+</button>
    </header>

    <div v-if="showAdd" class="wvp-add-row">
      <input v-model="newKey" placeholder="key" class="wvp-input" />
      <input v-model="newValue" placeholder="value (JSON)" class="wvp-input" />
      <button class="wvp-btn primary" @click="onAdd" :disabled="!newKey">添加</button>
    </div>

    <ul v-if="entries.length" class="wvp-list">
      <li v-for="entry in entries" :key="entry.key" class="wvp-item">
        <code class="wvp-key">{{ entry.key }}</code>
        <input
          v-if="editable"
          :value="formatValue(entry.value)"
          class="wvp-value-input"
          @change="onEdit(entry.key, $event.target.value)"
        />
        <span v-else class="wvp-value">{{ formatValue(entry.value) }}</span>
        <span class="wvp-type">{{ valueType(entry.value) }}</span>
        <button v-if="editable" class="wvp-del" @click="onDelete(entry.key)">×</button>
      </li>
    </ul>
    <p v-else class="wvp-empty">暂无变量</p>

    <details v-if="watchExprs.length" class="wvp-watch">
      <summary>监视表达式 ({{ watchExprs.length }})</summary>
      <ul class="wvp-watch-list">
        <li v-for="(w, i) in watchExprs" :key="i">
          <code>{{ w.expr }}</code> = <strong>{{ w.value }}</strong>
        </li>
      </ul>
    </details>
  </div>
</template>

<script>
import { onlyInstance } from '../../utils/workflow/workflowProgressChannel.js'

export default {
  name: 'WorkflowVariablesPanel',
  props: {
    instanceId:  { type: String, default: '' },
    initialVars: { type: Object, default: () => ({}) },
    editable:    { type: Boolean, default: false },
    watchList:   { type: Array,   default: () => [] }   // ['vars.x > 3', ...]
  },
  emits: ['update:vars'],
  data() {
    return {
      vars: { ...this.initialVars },
      showAdd: false,
      newKey: '',
      newValue: ''
    }
  },
  computed: {
    entries() {
      return Object.entries(this.vars).map(([key, value]) => ({ key, value }))
    },
    watchExprs() {
      return this.watchList.map(expr => {
        let value = ''
        try {
          // 简单 expr eval(只允许 vars.* 访问)
          const fn = new Function('vars', `with(vars) { return ${expr} }`)
          value = String(fn(this.vars))
        } catch { value = '<error>' }
        return { expr, value }
      })
    }
  },
  mounted() {
    if (this.instanceId) {
      this._unsub = onlyInstance(this.instanceId, msg => {
        if (msg.eventType === 'node:done' && msg.varsSnapshot) {
          this.vars = { ...msg.varsSnapshot }
        }
      })
    }
  },
  beforeUnmount() {
    this._unsub?.()
  },
  methods: {
    formatValue(v) {
      if (v == null) return ''
      if (typeof v === 'string') return v
      try { return JSON.stringify(v) } catch { return String(v) }
    },
    valueType(v) {
      if (v === null) return 'null'
      if (Array.isArray(v)) return 'array'
      return typeof v
    },
    onAdd() {
      const k = this.newKey.trim()
      if (!k) return
      let v = this.newValue
      try { v = JSON.parse(this.newValue) } catch { /* keep as string */ }
      this.vars = { ...this.vars, [k]: v }
      this.newKey = ''
      this.newValue = ''
      this.$emit('update:vars', this.vars)
    },
    onEdit(key, raw) {
      let v = raw
      try { v = JSON.parse(raw) } catch { /* keep as string */ }
      this.vars = { ...this.vars, [key]: v }
      this.$emit('update:vars', this.vars)
    },
    onDelete(key) {
      const next = { ...this.vars }
      delete next[key]
      this.vars = next
      this.$emit('update:vars', this.vars)
    }
  }
}
</script>

<style scoped>
.wvp-root {
  padding: 10px 12px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 8px;
  background: var(--color-bg-elevated, #fff);
  font-family: var(--font-base);
}
.wvp-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--chy-ink-100, #f0f1f4);
}
.wvp-title { font-size: 12px; font-weight: 600; color: var(--color-text-secondary); text-transform: uppercase; }
.wvp-count {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-muted);
}
.wvp-add {
  width: 22px; height: 22px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}
.wvp-add-row {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}
.wvp-input {
  flex: 1;
  padding: 4px 8px;
  font-size: 11px;
  font-family: var(--font-mono);
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 4px;
}
.wvp-btn {
  padding: 4px 10px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}
.wvp-btn.primary { background: var(--chy-violet-500, #7c6cdc); color: #fff; border-color: var(--chy-violet-500, #7c6cdc); }
.wvp-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.wvp-list { list-style: none; padding: 0; margin: 0; max-height: 280px; overflow-y: auto; }
.wvp-item {
  display: grid;
  grid-template-columns: 80px 1fr auto auto;
  gap: 6px;
  align-items: center;
  padding: 4px 0;
  font-size: 11px;
  border-bottom: 1px dashed var(--chy-ink-100, #f0f1f4);
}
.wvp-key { font-family: var(--font-mono); font-weight: 500; color: var(--chy-violet-700, #5d4ec0); }
.wvp-value, .wvp-value-input {
  font-family: var(--font-mono);
  color: var(--color-text-primary);
  word-break: break-all;
}
.wvp-value-input {
  border: 1px solid transparent;
  background: transparent;
  padding: 2px 4px;
  font-size: 11px;
  width: 100%;
}
.wvp-value-input:focus {
  outline: none;
  border-color: var(--chy-violet-300, #c4b9f0);
  background: var(--chy-ink-50, #f6f7f9);
}
.wvp-type {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-text-muted);
  padding: 1px 4px;
  background: var(--chy-ink-100, #f0f1f4);
  border-radius: 3px;
}
.wvp-del {
  width: 18px; height: 18px;
  border: none;
  background: transparent;
  font-size: 14px;
  color: var(--color-text-muted);
  cursor: pointer;
}
.wvp-del:hover { color: var(--chy-rouge-500, #e26a58); }

.wvp-empty {
  margin: 12px 0;
  text-align: center;
  font-size: 11px;
  color: var(--color-text-muted);
  font-style: italic;
}

.wvp-watch { margin-top: 8px; font-size: 11px; }
.wvp-watch summary { cursor: pointer; color: var(--color-text-secondary); }
.wvp-watch-list { list-style: none; padding: 6px 0 0; margin: 0; }
.wvp-watch-list li {
  font-family: var(--font-mono);
  padding: 2px 0;
  font-size: 10px;
}
</style>
