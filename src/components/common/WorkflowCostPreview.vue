<!--
  WorkflowCostPreview — 编辑期成本累计预览(W4.1)

  Props:
    workflow  当前编辑的工作流对象 { nodes, edges }

  自动调用 estimateWorkflowCost,显示:
    - 总 LLM 调用次数
    - 预估总耗时
    - 字节数(粗估)
    - 警告(>20 LLM、>1 分钟、需要人工)
    - 节点 breakdown(可折叠)
-->
<template>
  <div class="wcp-root">
    <header class="wcp-head">
      <span class="wcp-icon">💰</span>
      <span class="wcp-title">成本预估</span>
      <span class="wcp-node-count">{{ cost.nodeCount }} 节点</span>
    </header>

    <div class="wcp-metrics">
      <div class="wcp-metric" :class="{ warn: cost.llmCalls > 20 }">
        <span class="wcp-m-label">LLM 调用</span>
        <span class="wcp-m-value">{{ cost.llmCalls }}</span>
        <span class="wcp-m-unit">次</span>
      </div>
      <div class="wcp-metric" :class="{ warn: cost.ms > 60000 }">
        <span class="wcp-m-label">预估耗时</span>
        <span class="wcp-m-value">{{ formatMs(cost.ms) }}</span>
      </div>
      <div class="wcp-metric">
        <span class="wcp-m-label">字节</span>
        <span class="wcp-m-value">{{ formatBytes(cost.bytes) }}</span>
      </div>
    </div>

    <ul v-if="cost.warnings.length" class="wcp-warnings">
      <li v-for="(w, i) in cost.warnings" :key="i">⚠ {{ w }}</li>
    </ul>

    <details class="wcp-breakdown">
      <summary>逐节点 breakdown ({{ cost.perNodeBreakdown.length }})</summary>
      <table class="wcp-table">
        <thead><tr><th>节点</th><th>type</th><th>LLM</th><th>ms</th></tr></thead>
        <tbody>
          <tr v-for="b in cost.perNodeBreakdown" :key="b.nodeId">
            <td><code>{{ b.nodeId }}</code></td>
            <td><code>{{ b.type }}</code></td>
            <td>{{ b.llmCalls }}</td>
            <td>{{ b.ms }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </div>
</template>

<script>
import { estimateWorkflowCost } from '../../utils/workflow/workflowToolsP1.js'

export default {
  name: 'WorkflowCostPreview',
  props: {
    workflow: { type: Object, required: true }
  },
  computed: {
    cost() {
      try {
        return estimateWorkflowCost(this.workflow) || {
          llmCalls: 0, ms: 0, bytes: 0, perNodeBreakdown: [], warnings: [], nodeCount: 0
        }
      } catch (_) {
        return { llmCalls: 0, ms: 0, bytes: 0, perNodeBreakdown: [], warnings: [], nodeCount: 0 }
      }
    }
  },
  methods: {
    formatMs(ms) {
      if (ms < 1000) return `${ms}ms`
      if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
      return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`
    },
    formatBytes(b) {
      if (b < 1024) return `${b}B`
      if (b < 1048576) return `${(b / 1024).toFixed(1)}KB`
      return `${(b / 1048576).toFixed(2)}MB`
    }
  }
}
</script>

<style scoped>
.wcp-root {
  padding: 12px 14px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 8px;
  background: var(--chy-ink-50, #fafbfc);
  font-family: var(--font-base);
}
.wcp-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.wcp-icon { font-size: 16px; }
.wcp-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.wcp-node-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  padding: 1px 8px;
  background: var(--chy-ink-100, #f0f1f4);
  border-radius: 999px;
}

.wcp-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.wcp-metric {
  padding: 8px 10px;
  background: var(--color-bg-elevated, #fff);
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.wcp-metric.warn { border-color: var(--chy-amber-400, #ecb84e); background: rgba(212, 160, 23, 0.05); }
.wcp-m-label { font-size: 10px; color: var(--color-text-muted); }
.wcp-m-value { font-size: 18px; font-weight: 700; font-feature-settings: 'tnum'; color: var(--color-text-primary); }
.wcp-m-unit { font-size: 10px; color: var(--color-text-muted); }

.wcp-warnings {
  list-style: none;
  padding: 8px 10px;
  margin: 10px 0 0;
  background: rgba(212, 160, 23, 0.10);
  border-left: 3px solid var(--chy-amber-500, #d4a017);
  border-radius: 4px;
  font-size: 11px;
  color: var(--chy-amber-700, #a06800);
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.wcp-breakdown { margin-top: 10px; font-size: 11px; }
.wcp-breakdown summary {
  cursor: pointer;
  color: var(--color-text-secondary);
  padding: 4px 0;
}
.wcp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  margin-top: 4px;
}
.wcp-table th, .wcp-table td {
  text-align: left;
  padding: 4px 8px;
  border-bottom: 1px dashed var(--chy-ink-200, #e6e8ec);
}
.wcp-table th { color: var(--color-text-muted); font-weight: 500; }
.wcp-table code { font-family: var(--font-mono); }
</style>
