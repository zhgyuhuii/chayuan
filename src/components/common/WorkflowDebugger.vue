<!--
  WorkflowDebugger — 调试器面板(W4.5)

  小地图 + 调试控制 + breakpoint。
  独立组件,可挂在 TaskOrchestrationDialog 内,或单独路由展示。

  Props:
    instanceId
    workflow
    breakpoints      数组,nodeId
    paused           当前是否暂停

  Emits:
    'step'           单步
    'continue'       继续
    'stop'           终止
    'breakpoint-toggle'(nodeId)
-->
<template>
  <div class="wdb-root">
    <header class="wdb-head">
      <span class="wdb-title">调试器</span>
      <span v-if="paused" class="wdb-status paused">已暂停</span>
      <span v-else-if="instanceId" class="wdb-status running">运行中</span>
      <span v-else class="wdb-status idle">空闲</span>
    </header>

    <!-- 控制按钮 -->
    <div class="wdb-controls">
      <button class="wdb-btn" :disabled="!instanceId || !paused" @click="$emit('step')">单步</button>
      <button class="wdb-btn primary" :disabled="!instanceId" @click="$emit(paused ? 'continue' : 'stop')">
        {{ paused ? '继续' : '停止' }}
      </button>
    </div>

    <!-- 小地图 minimap -->
    <div class="wdb-minimap">
      <div class="wdb-mm-title">小地图({{ workflow.nodes?.length || 0 }} 节点)</div>
      <div class="wdb-mm-grid">
        <div
          v-for="node in normalizedNodes"
          :key="node.id"
          class="wdb-mm-cell"
          :class="[
            `mm-status-${getStatus(node.id)}`,
            { 'mm-breakpoint': breakpoints.includes(node.id) }
          ]"
          :title="`${node.id} · ${node.type}`"
          @click="$emit('breakpoint-toggle', node.id)"
        ></div>
      </div>
    </div>

    <!-- breakpoint 列表 -->
    <details v-if="breakpoints.length" class="wdb-bps">
      <summary>{{ breakpoints.length }} 个断点</summary>
      <ul class="wdb-bp-list">
        <li v-for="id in breakpoints" :key="id">
          <code>{{ id }}</code>
          <button class="wdb-bp-del" @click="$emit('breakpoint-toggle', id)">×</button>
        </li>
      </ul>
    </details>
  </div>
</template>

<script>
import { onlyInstance } from '../../utils/workflow/workflowProgressChannel.js'

export default {
  name: 'WorkflowDebugger',
  props: {
    instanceId:  { type: String, default: '' },
    workflow:    { type: Object, default: () => ({ nodes: [] }) },
    breakpoints: { type: Array,  default: () => [] },
    paused:      { type: Boolean, default: false }
  },
  emits: ['step', 'continue', 'stop', 'breakpoint-toggle'],
  data() {
    return { liveStatus: {} }
  },
  computed: {
    normalizedNodes() {
      return (this.workflow?.nodes || []).filter(n => n && n.id)
    }
  },
  mounted() {
    if (this.instanceId) {
      this._unsub = onlyInstance(this.instanceId, msg => {
        if (!msg.nodeId) return
        const status = ({
          'node:ready': 'pending',
          'node:run': 'running',
          'node:done': 'done',
          'node:error': 'failed'
        })[msg.eventType]
        if (status) {
          this.liveStatus = { ...this.liveStatus, [msg.nodeId]: status }
        }
      })
    }
  },
  beforeUnmount() {
    this._unsub?.()
  },
  methods: {
    getStatus(nodeId) {
      return this.liveStatus[nodeId] || 'pending'
    }
  }
}
</script>

<style scoped>
.wdb-root {
  padding: 10px 12px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 8px;
  background: var(--color-bg-elevated, #fff);
  font-family: var(--font-base);
}
.wdb-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--chy-ink-100, #f0f1f4);
}
.wdb-title { font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--color-text-secondary); }
.wdb-status {
  margin-left: auto;
  font-size: 10px;
  padding: 1px 8px;
  border-radius: 999px;
}
.wdb-status.idle    { background: var(--chy-ink-100, #f0f1f4); color: var(--color-text-muted); }
.wdb-status.running { background: var(--chy-violet-100, #ebe7fa); color: var(--chy-violet-700, #5d4ec0); }
.wdb-status.paused  { background: var(--chy-amber-100, #faecd0); color: var(--chy-amber-700, #a06800); }

.wdb-controls { display: flex; gap: 6px; margin-bottom: 10px; }
.wdb-btn {
  flex: 1;
  padding: 5px 10px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}
.wdb-btn.primary { background: var(--chy-violet-500, #7c6cdc); color: #fff; border-color: var(--chy-violet-500, #7c6cdc); }
.wdb-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.wdb-minimap { margin-bottom: 8px; }
.wdb-mm-title {
  font-size: 10px;
  color: var(--color-text-muted);
  margin-bottom: 4px;
  font-family: var(--font-mono);
}
.wdb-mm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14px, 1fr));
  gap: 2px;
  padding: 6px;
  background: var(--chy-ink-50, #f6f7f9);
  border-radius: 4px;
}
.wdb-mm-cell {
  width: 14px; height: 14px;
  border-radius: 2px;
  cursor: pointer;
  border: 1px solid transparent;
}
.wdb-mm-cell:hover { border-color: var(--chy-violet-400, #a397e8); }
.wdb-mm-cell.mm-breakpoint { box-shadow: inset 0 0 0 2px var(--chy-rouge-500, #e26a58); }
.wdb-mm-cell.mm-status-pending { background: var(--chy-ink-200, #e6e8ec); }
.wdb-mm-cell.mm-status-running { background: var(--chy-violet-500, #7c6cdc); animation: wdb-pulse 1.2s ease-in-out infinite; }
.wdb-mm-cell.mm-status-done    { background: var(--chy-celadon-500, #3fae82); }
.wdb-mm-cell.mm-status-failed  { background: var(--chy-rouge-500, #e26a58); }
.wdb-mm-cell.mm-status-skipped { background: var(--chy-ink-100, #f0f1f4); }

@keyframes wdb-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

.wdb-bps { font-size: 11px; }
.wdb-bps summary { cursor: pointer; color: var(--color-text-secondary); padding: 4px 0; }
.wdb-bp-list { list-style: none; padding: 0; margin: 0; }
.wdb-bp-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 0;
  font-family: var(--font-mono);
}
.wdb-bp-del {
  width: 18px; height: 18px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  color: var(--chy-rouge-500, #e26a58);
}
</style>
