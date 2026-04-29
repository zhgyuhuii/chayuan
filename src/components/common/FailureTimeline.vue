<!--
  FailureTimeline — 失败证据时间轴

  v2 计划 P3「失败证据时间轴 UI」。逐条展示某个助手的失败 signal,按时间倒序。
  支持高亮聚类(同一 cluster 的项用同色边)。

  Props:
    assistantId       要看的助手 id
    days              窗口天数(默认 7)
    clusters          可选,failureCluster.clusterFailuresForAssistant 的结果
                      传入则按 cluster 染色

  Emits:
    'select'(signal)  点击单条信号
    'cluster-click'(cluster)
-->
<template>
  <DialogShell title="失败证据时间轴" :subtitle="subtitle" @close="$emit('close')">
    <template #header-actions>
      <button class="ft-btn" @click="onRefresh">↻ 刷新</button>
    </template>

    <div v-if="!signals.length" class="ft-empty">
      <p>窗口内没有失败信号。</p>
    </div>

    <div v-else>
      <div v-if="clusters && clusters.length" class="ft-clusters">
        <div
          v-for="c in clusters"
          :key="c.cluster"
          class="ft-cluster-tag"
          :style="{ borderColor: clusterColor(c.cluster) }"
          @click="$emit('cluster-click', c)"
        >
          <span class="dot" :style="{ background: clusterColor(c.cluster) }" />
          {{ c.cluster }} <span class="count">×{{ c.count }}</span>
        </div>
      </div>

      <ul class="ft-list">
        <li
          v-for="(s, idx) in signals"
          :key="s.id || idx"
          class="ft-item"
          :class="{ 'is-failure': isFail(s) }"
          :style="clusterId(s) ? { borderLeftColor: clusterColor(clusterId(s)) } : {}"
          @click="$emit('select', s)"
        >
          <div class="ft-time">{{ formatTime(s.timestamp) }}</div>
          <div class="ft-detail">
            <span class="ft-type">{{ s.type }}</span>
            <span v-if="s.failureCode" class="ft-code">{{ s.failureCode }}</span>
            <span v-if="s.userNote" class="ft-note">{{ s.userNote }}</span>
            <span v-if="s.duration" class="ft-dur">{{ s.duration }}ms</span>
          </div>
          <div v-if="clusterId(s)" class="ft-cluster" :style="{ color: clusterColor(clusterId(s)) }">
            {{ clusterId(s) }}
          </div>
        </li>
      </ul>
    </div>
  </DialogShell>
</template>

<script>
import DialogShell from './DialogShell.vue'
import { listSignalsByAssistant } from '../../utils/assistant/evolution/signalStore.js'
import { isFailure } from '../../utils/assistant/evolution/failureCluster.js'

const PALETTE = ['#7c6cdc', '#3fae82', '#d4a017', '#c44b3a', '#3b7fd9', '#c45c98', '#5fa68a', '#8e6ec5']

export default {
  name: 'FailureTimeline',
  components: { DialogShell },
  props: {
    assistantId: { type: String, required: true },
    days:        { type: Number, default: 7 },
    clusters:    { type: Array,  default: () => [] }
  },
  emits: ['select', 'cluster-click', 'close'],
  data() {
    return {
      signals: []
    }
  },
  computed: {
    subtitle() {
      return `${this.assistantId} · 最近 ${this.days} 天 · ${this.signals.filter(this.isFail).length} 个失败`
    },
    /** signal.id → cluster name 反查表(从 props.clusters 派生) */
    clusterMap() {
      const m = new Map()
      for (const c of (this.clusters || [])) {
        for (const s of (c.samples || [])) {
          if (s.id) m.set(s.id, c.cluster)
        }
      }
      return m
    }
  },
  mounted() { this.onRefresh() },
  methods: {
    onRefresh() {
      try {
        const all = listSignalsByAssistant(this.assistantId, { days: this.days }) || []
        // 按时间倒序
        this.signals = [...all].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      } catch (_) { this.signals = [] }
    },
    isFail(s) { return isFailure(s) },
    clusterId(s) { return this.clusterMap.get(s.id) || '' },
    clusterColor(name) {
      let h = 0
      for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
      return PALETTE[Math.abs(h) % PALETTE.length]
    },
    formatTime(ts) {
      if (!ts) return '—'
      const d = new Date(ts)
      const pad = n => String(n).padStart(2, '0')
      return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    }
  }
}
</script>

<style scoped>
.ft-empty { padding: 32px 0; text-align: center; color: var(--color-text-muted); }
.ft-btn {
  padding: 4px 10px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
.ft-btn:hover { background: var(--chy-ink-50, #f6f7f9); }

.ft-clusters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.ft-cluster-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 11px;
  cursor: pointer;
  transition: background 160ms;
}
.ft-cluster-tag:hover { background: var(--chy-ink-50, #f6f7f9); }
.ft-cluster-tag .dot { width: 8px; height: 8px; border-radius: 50%; }
.ft-cluster-tag .count { color: var(--color-text-muted); font-family: var(--font-mono); }

.ft-list { list-style: none; padding: 0; margin: 0; max-height: 480px; overflow-y: auto; }
.ft-item {
  display: grid;
  grid-template-columns: 100px 1fr auto;
  gap: 12px;
  align-items: baseline;
  padding: 8px 12px;
  margin-bottom: 4px;
  border-radius: 6px;
  border-left: 3px solid var(--chy-ink-200, #e6e8ec);
  background: var(--color-bg-elevated, #fff);
  font-size: 12px;
  cursor: pointer;
  transition: background 160ms;
}
.ft-item:hover { background: var(--chy-ink-50, #f6f7f9); }
.ft-item.is-failure { background: rgba(196, 75, 58, 0.04); border-left-color: var(--chy-rouge-500, #e26a58); }
.ft-time { font-family: var(--font-mono); color: var(--color-text-muted); white-space: nowrap; }
.ft-detail { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; align-items: center; }
.ft-type {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 6px;
  background: var(--chy-ink-100, #f0f1f4);
  border-radius: 3px;
  color: var(--color-text-muted);
}
.ft-code {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 6px;
  background: rgba(196, 75, 58, 0.10);
  color: var(--chy-rouge-600, #c44b3a);
  border-radius: 3px;
}
.ft-note { color: var(--color-text-secondary); }
.ft-dur { font-family: var(--font-mono); color: var(--color-text-muted); font-size: 10px; }
.ft-cluster {
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 600;
}
</style>
