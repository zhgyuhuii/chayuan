<!--
  WorkflowTimeline — 历史运行 gantt 时间线(W4.3)

  Props:
    snapshot   instance.snapshot 对象 { nodeId: { startedAt, endedAt, status, ... } }
    nodes      工作流节点定义(获取 type / title)
    showLive   true 时订阅 live progress 事件,实时更新
    instanceId  live 模式必填
-->
<template>
  <div class="wtl-root">
    <header class="wtl-head">
      <span class="wtl-title">运行时间线</span>
      <span class="wtl-stats">{{ doneCount }}/{{ totalCount }} 已完成 · 总用时 {{ formatMs(totalDuration) }}</span>
    </header>

    <div v-if="!entries.length" class="wtl-empty">暂无运行数据</div>

    <div v-else class="wtl-gantt">
      <div
        v-for="entry in entries"
        :key="entry.nodeId"
        class="wtl-row"
        :class="`status-${entry.status}`"
        :title="`${entry.nodeId} · ${formatMs(entry.duration)}`"
      >
        <div class="wtl-label">
          <span class="wtl-status-dot" :class="`status-${entry.status}`" />
          <code>{{ entry.nodeId }}</code>
          <span class="wtl-type">{{ entry.type }}</span>
        </div>
        <div class="wtl-bar-track">
          <div
            class="wtl-bar"
            :class="`status-${entry.status}`"
            :style="{
              left: entry.leftPct + '%',
              width: entry.widthPct + '%'
            }"
          >
            <span class="wtl-bar-text">{{ formatMs(entry.duration) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { onlyInstance } from '../../utils/workflow/workflowProgressChannel.js'

export default {
  name: 'WorkflowTimeline',
  props: {
    snapshot:   { type: Object, default: () => ({}) },
    nodes:      { type: Array,  default: () => [] },
    showLive:   { type: Boolean, default: false },
    instanceId: { type: String, default: '' }
  },
  data() {
    return { liveSnapshot: { ...this.snapshot } }
  },
  computed: {
    activeSnapshot() {
      return this.showLive ? this.liveSnapshot : this.snapshot
    },
    timeline() {
      // 计算时间窗
      const allTs = []
      for (const s of Object.values(this.activeSnapshot)) {
        if (s?.startedAt) allTs.push(s.startedAt)
        if (s?.endedAt) allTs.push(s.endedAt)
      }
      if (allTs.length === 0) return { min: 0, max: 1 }
      return {
        min: Math.min(...allTs),
        max: Math.max(...allTs)
      }
    },
    totalDuration() {
      return this.timeline.max - this.timeline.min
    },
    entries() {
      const nodeMap = new Map(this.nodes.map(n => [n.id, n]))
      const span = this.totalDuration || 1
      return Object.entries(this.activeSnapshot).map(([nodeId, snap]) => {
        const node = nodeMap.get(nodeId)
        const startedAt = snap.startedAt || this.timeline.min
        const endedAt = snap.endedAt || (snap.status === 'running' ? Date.now() : startedAt)
        const duration = Math.max(0, endedAt - startedAt)
        return {
          nodeId,
          type: node?.type || snap.type || 'unknown',
          status: snap.status || 'pending',
          duration,
          leftPct: ((startedAt - this.timeline.min) / span) * 100,
          widthPct: Math.max(1, (duration / span) * 100)
        }
      }).sort((a, b) => a.leftPct - b.leftPct)
    },
    doneCount() {
      return Object.values(this.activeSnapshot).filter(s => s?.status === 'done').length
    },
    totalCount() {
      return Object.keys(this.activeSnapshot).length
    }
  },
  mounted() {
    if (this.showLive && this.instanceId) {
      this._unsub = onlyInstance(this.instanceId, msg => {
        if (!msg.nodeId) return
        const slot = { ...(this.liveSnapshot[msg.nodeId] || {}) }
        if (msg.eventType === 'node:run') {
          slot.status = 'running'
          slot.startedAt = msg.startedAt || Date.now()
          slot.type = msg.nodeType
        } else if (msg.eventType === 'node:done') {
          slot.status = 'done'
          slot.endedAt = Date.now()
        } else if (msg.eventType === 'node:error') {
          slot.status = 'failed'
          slot.endedAt = Date.now()
        }
        this.liveSnapshot = { ...this.liveSnapshot, [msg.nodeId]: slot }
      })
    }
  },
  beforeUnmount() {
    this._unsub?.()
  },
  methods: {
    formatMs(ms) {
      if (!ms) return '—'
      if (ms < 1000) return `${ms}ms`
      if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
      return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`
    }
  }
}
</script>

<style scoped>
.wtl-root {
  padding: 10px 12px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 8px;
  background: var(--color-bg-elevated, #fff);
  font-family: var(--font-base);
}
.wtl-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--chy-ink-100, #f0f1f4);
}
.wtl-title { font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--color-text-secondary); }
.wtl-stats { font-size: 11px; color: var(--color-text-muted); font-family: var(--font-mono); }

.wtl-empty { padding: 24px; text-align: center; color: var(--color-text-muted); font-size: 12px; }

.wtl-gantt { display: flex; flex-direction: column; gap: 4px; }
.wtl-row {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 8px;
  align-items: center;
  font-size: 11px;
}
.wtl-label { display: flex; align-items: center; gap: 4px; min-width: 0; overflow: hidden; }
.wtl-label code { font-family: var(--font-mono); font-size: 10px; }
.wtl-type { font-size: 9px; color: var(--color-text-muted); padding: 1px 4px; background: var(--chy-ink-100, #f0f1f4); border-radius: 3px; }

.wtl-status-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.wtl-status-dot.status-pending { background: var(--chy-ink-300, #c5c8cf); }
.wtl-status-dot.status-running { background: var(--chy-violet-500, #7c6cdc); animation: wtl-pulse 1.2s ease-in-out infinite; }
.wtl-status-dot.status-done    { background: var(--chy-celadon-500, #3fae82); }
.wtl-status-dot.status-failed  { background: var(--chy-rouge-500, #e26a58); }
.wtl-status-dot.status-skipped { background: var(--chy-ink-200, #e6e8ec); }

@keyframes wtl-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%      { transform: scale(1.4); opacity: 0.6; }
}

.wtl-bar-track {
  position: relative;
  height: 18px;
  background: var(--chy-ink-50, #f6f7f9);
  border-radius: 3px;
}
.wtl-bar {
  position: absolute;
  height: 100%;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-family: var(--font-mono);
  color: #fff;
  min-width: 4px;
  transition: width 200ms;
}
.wtl-bar.status-running { background: var(--chy-violet-500, #7c6cdc); }
.wtl-bar.status-done    { background: var(--chy-celadon-500, #3fae82); }
.wtl-bar.status-failed  { background: var(--chy-rouge-500, #e26a58); }
.wtl-bar.status-pending { background: var(--chy-ink-300, #c5c8cf); }
.wtl-bar.status-skipped { background: var(--chy-ink-200, #e6e8ec); }
.wtl-bar-text { white-space: nowrap; padding: 0 4px; overflow: hidden; }
</style>
