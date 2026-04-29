<!--
  PerfStatsPanel — LLM 调用延迟可视化

  数据来源:perfTracker.js
  自动订阅 + 节流刷新(perfTracker 内部 200ms throttle)

  显示:
    总览:count / ok / fail · avg / p50 / p95 / p99
    按 kind:每种 kind(stream / once / once.router / once.judge 等)的 count + avg
    按 model:每个 providerId/modelId 组合的 count + avg
    最近 20 条:时间 · kind · model · 耗时 · ok/fail · note(失败时)

  Props:
    autoSubscribe (bool, default true)
-->
<template>
  <DialogShell title="LLM 调用延迟统计" subtitle="enhancedChatApi 入口的实时观测" @close="$emit('close')">
    <template #header-actions>
      <button class="ps-btn" @click="onClear">清空</button>
    </template>

    <div v-if="!stats.count" class="ps-empty">
      <p>暂无数据。</p>
      <p class="hint">
        enhancedStream / enhancedOnce 调用一次后即开始记录。其它路径(原 chatApi.js)不在此统计里。
      </p>
    </div>

    <div v-else class="ps-content">
      <div class="ps-overview">
        <div class="ps-card">
          <span class="ps-label">总调用</span>
          <span class="ps-value">{{ stats.count }}</span>
          <span class="ps-sub">
            <span class="good">{{ stats.ok }}</span> ·
            <span class="bad">{{ stats.fail }}</span>
          </span>
        </div>
        <div class="ps-card"><span class="ps-label">平均</span><span class="ps-value">{{ stats.avg }}<small>ms</small></span></div>
        <div class="ps-card"><span class="ps-label">P50</span><span class="ps-value">{{ stats.p50 }}<small>ms</small></span></div>
        <div class="ps-card" :class="latencyClass(stats.p95)"><span class="ps-label">P95</span><span class="ps-value">{{ stats.p95 }}<small>ms</small></span></div>
        <div class="ps-card" :class="latencyClass(stats.p99)"><span class="ps-label">P99</span><span class="ps-value">{{ stats.p99 }}<small>ms</small></span></div>
      </div>

      <section v-if="sendRecords.length" class="ps-section">
        <h3>发送链路最近 {{ sendRecords.length }} 条</h3>
        <div class="ps-send-list">
          <div v-for="(r, i) in sendRecords" :key="`send-${i}-${r.ts}`" class="ps-send-item" :class="{ bad: !r.ok }">
            <div class="ps-send-head">
              <span class="ps-r-time">{{ formatTime(r.ts) }}</span>
              <code>{{ r.kind }}</code>
              <span class="ps-r-dur" :class="latencyTextClass(r.durationMs)">{{ r.durationMs }}ms</span>
              <span class="ps-r-status">{{ r.ok ? 'OK' : 'FAIL' }}</span>
            </div>
            <div class="ps-send-bar">
              <span :style="{ width: sendBarWidth(r.durationMs) }"></span>
            </div>
            <div class="ps-send-meta">
              <span>{{ r.providerId || 'local' }}/{{ r.modelId || 'none' }}</span>
              <span v-if="r.bytes">bytes {{ r.bytes }}</span>
              <span v-if="r.note">{{ r.note }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="ps-section">
        <h3>按调用类型</h3>
        <table class="ps-table">
          <thead><tr><th>kind</th><th>次数</th><th>失败</th><th>平均(ms)</th></tr></thead>
          <tbody>
            <tr v-for="(stat, kind) in stats.byKind" :key="kind">
              <td><code>{{ kind }}</code></td>
              <td>{{ stat.count }}</td>
              <td :class="stat.fail > 0 ? 'bad' : ''">{{ stat.fail }}</td>
              <td :class="latencyTextClass(stat.avg)">{{ stat.avg }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="ps-section">
        <h3>按模型</h3>
        <table class="ps-table">
          <thead><tr><th>provider/model</th><th>次数</th><th>失败</th><th>平均(ms)</th></tr></thead>
          <tbody>
            <tr v-for="(stat, model) in stats.byModel" :key="model">
              <td><code>{{ model }}</code></td>
              <td>{{ stat.count }}</td>
              <td :class="stat.fail > 0 ? 'bad' : ''">{{ stat.fail }}</td>
              <td :class="latencyTextClass(stat.avg)">{{ stat.avg }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="ps-section">
        <h3>最近 {{ stats.recent.length }} 条</h3>
        <ul class="ps-recent">
          <li v-for="(r, i) in stats.recent" :key="i" :class="{ bad: !r.ok }">
            <span class="ps-r-time">{{ formatTime(r.ts) }}</span>
            <span class="ps-r-kind">{{ r.kind }}</span>
            <span class="ps-r-model">{{ r.providerId }}/{{ r.modelId }}</span>
            <span class="ps-r-dur" :class="latencyTextClass(r.durationMs)">{{ r.durationMs }}ms</span>
            <span class="ps-r-status">{{ r.ok ? '✓' : '✗' }}</span>
            <span v-if="r.note" class="ps-r-note">{{ r.note }}</span>
          </li>
        </ul>
      </section>
    </div>
  </DialogShell>
</template>

<script>
import DialogShell from './DialogShell.vue'
import { getStats, subscribe, clear } from '../../utils/perfTracker.js'

export default {
  name: 'PerfStatsPanel',
  components: { DialogShell },
  props: {
    autoSubscribe: { type: Boolean, default: true }
  },
  emits: ['close'],
  data() {
    return {
      stats: getStats()
    }
  },
  computed: {
    sendRecords() {
      return (this.stats.recent || [])
        .filter(item => String(item?.kind || '').startsWith('send.'))
        .slice(0, 12)
    },
    sendMaxDuration() {
      return Math.max(1, ...this.sendRecords.map(item => Number(item.durationMs || 0)))
    }
  },
  mounted() {
    if (this.autoSubscribe) {
      this._unsub = subscribe(s => { this.stats = s })
    }
  },
  beforeUnmount() {
    this._unsub?.()
  },
  methods: {
    onClear() {
      clear()
      this.stats = getStats()
    },
    latencyClass(ms) {
      if (!ms) return ''
      if (ms < 1000) return 'fast'
      if (ms < 3000) return 'mid'
      return 'slow'
    },
    latencyTextClass(ms) {
      if (!ms) return ''
      if (ms < 1000) return 'good'
      if (ms < 3000) return 'mid'
      return 'bad'
    },
    formatTime(ts) {
      const d = new Date(ts)
      const pad = (n) => String(n).padStart(2, '0')
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    },
    sendBarWidth(ms) {
      return `${Math.max(4, Math.min(100, Math.round((Number(ms || 0) / this.sendMaxDuration) * 100)))}%`
    }
  }
}
</script>

<style scoped>
.ps-empty {
  padding: 32px 0;
  text-align: center;
  color: var(--color-text-muted);
}
.ps-empty .hint {
  font-size: var(--fz-12, 12px);
  font-style: italic;
}

.ps-content { display: flex; flex-direction: column; gap: 16px; }

.ps-overview {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}
.ps-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 8px;
  background: var(--color-bg-elevated, #fff);
}
.ps-card.fast  { border-color: var(--chy-celadon-300, #a4dac1); }
.ps-card.mid   { border-color: var(--chy-amber-300, #f5d495); }
.ps-card.slow  { border-color: var(--chy-rouge-300, #f0bcb3); }
.ps-label {
  font-size: var(--fz-11, 11px);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}
.ps-value {
  font-size: 22px;
  font-weight: 600;
  font-feature-settings: "tnum";
}
.ps-value small {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-left: 2px;
  font-weight: 400;
}
.ps-sub {
  font-family: var(--font-mono);
  font-size: var(--fz-11, 11px);
}
.ps-sub .good { color: var(--chy-celadon-600, #2c8d68); }
.ps-sub .bad  { color: var(--chy-rouge-600, #c44b3a); }

.ps-section h3 {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.ps-send-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ps-send-item {
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--color-bg-elevated, #fff);
}
.ps-send-item.bad {
  border-color: var(--chy-rouge-300, #f0bcb3);
}
.ps-send-head,
.ps-send-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: var(--fz-11, 11px);
}
.ps-send-head code {
  font-family: var(--font-mono);
  color: var(--chy-violet-600, #6f5fd0);
}
.ps-send-meta {
  color: var(--color-text-muted);
  margin-top: 4px;
}
.ps-send-bar {
  height: 6px;
  border-radius: 999px;
  background: var(--chy-ink-100, #f0f1f4);
  overflow: hidden;
  margin-top: 6px;
}
.ps-send-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--chy-celadon-400, #69c49a), var(--chy-violet-400, #9b8de5));
}
.ps-table {
  width: 100%;
  font-size: var(--fz-12, 12px);
  border-collapse: collapse;
}
.ps-table th {
  text-align: left;
  font-weight: 500;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--chy-ink-200, #e6e8ec);
  padding: 4px 8px;
}
.ps-table td {
  padding: 4px 8px;
  border-bottom: 1px dashed var(--chy-ink-100, #f0f1f4);
}
.ps-table code { font-family: var(--font-mono); font-size: 11px; }
.ps-table td.good { color: var(--chy-celadon-600, #2c8d68); }
.ps-table td.mid  { color: var(--chy-amber-600, #c08000); }
.ps-table td.bad  { color: var(--chy-rouge-600, #c44b3a); }

.ps-recent {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 280px;
  overflow-y: auto;
}
.ps-recent li {
  display: grid;
  grid-template-columns: auto auto 1fr auto auto;
  gap: 8px;
  align-items: baseline;
  font-size: var(--fz-11, 11px);
  padding: 3px 4px;
  border-bottom: 1px dashed var(--chy-ink-100, #f0f1f4);
}
.ps-recent li.bad { color: var(--chy-rouge-600, #c44b3a); }
.ps-r-time, .ps-r-kind, .ps-r-dur, .ps-r-model { font-family: var(--font-mono); }
.ps-r-time { color: var(--color-text-muted); }
.ps-r-kind { color: var(--chy-violet-600, #6f5fd0); }
.ps-r-dur.good { color: var(--chy-celadon-600, #2c8d68); }
.ps-r-dur.mid  { color: var(--chy-amber-600, #c08000); }
.ps-r-dur.bad  { color: var(--chy-rouge-600, #c44b3a); }
.ps-r-status { font-weight: 600; }
.ps-r-note {
  grid-column: 1 / -1;
  margin-left: 24px;
  font-style: italic;
  color: var(--color-text-muted);
  font-size: 10px;
}

.ps-btn {
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 6px;
  padding: 4px 12px;
  font-size: var(--fz-12, 12px);
  cursor: pointer;
}
.ps-btn:hover { background: var(--chy-ink-50, #f6f7f9); }
</style>
