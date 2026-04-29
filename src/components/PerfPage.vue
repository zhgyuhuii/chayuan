<!--
  PerfPage — /perf 路由的主面板

  专门展示 enhancedChatApi 入口的 LLM 调用延迟数据。
  数据由 perfTracker.js 提供(环形缓冲 500 条);本页没有"重置"按钮以外的副作用,
  所以可以放心当作"打开看一下"的诊断仪表板。
-->
<template>
  <div class="perf-page">
    <header class="perf-page-header">
      <div>
        <h1>LLM 调用延迟监控</h1>
        <p class="subtitle">
          enhancedChatApi 入口的 P50 / P95 / P99 实时统计 ·
          仅本会话(刷新页面后清零) · 不写入 localStorage
        </p>
      </div>
      <div class="perf-page-actions">
        <span v-if="stats.count" class="perf-pill">{{ stats.count }} 条 · 上次 {{ formatTime(stats.recent[0]?.ts) }}</span>
        <button class="perf-page-btn" @click="goBack">返回</button>
      </div>
    </header>

    <div v-if="!stats.count" class="perf-page-bootstrap">
      <h3>暂无 LLM 调用记录</h3>
      <p>perfTracker 只跟踪通过 <code>enhancedStream</code> / <code>enhancedOnce</code> 入口的调用。</p>
      <p>原 <code>chatApi.streamChatCompletion</code> 不记录(避免侵入大文件)。</p>
      <p class="hint">
        若要让现有助手任务也走统计:在调用方 <code>import { enhancedOnce } from '@/utils/router/enhancedChatApi.js'</code> 替换原 <code>chatCompletion</code> 入口。
      </p>
    </div>

    <main v-else class="perf-page-body">
      <PerfStatsPanel @close="goBack" />
    </main>
  </div>
</template>

<script>
import PerfStatsPanel from './common/PerfStatsPanel.vue'
import { getStats, subscribe } from '../utils/perfTracker.js'

export default {
  name: 'PerfPage',
  components: { PerfStatsPanel },
  data() {
    return {
      stats: getStats()
    }
  },
  mounted() {
    this._unsub = subscribe(s => { this.stats = s })
  },
  beforeUnmount() {
    this._unsub?.()
  },
  methods: {
    goBack() {
      if (window.history.length > 1) window.history.back()
      else this.$router.push('/')
    },
    formatTime(ts) {
      if (!ts) return '—'
      const d = new Date(ts)
      const pad = (n) => String(n).padStart(2, '0')
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    }
  }
}
</script>

<style scoped>
.perf-page {
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px 28px 80px;
  font-family: var(--font-base);
  color: var(--color-text-primary);
}
.perf-page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  flex-wrap: wrap;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--chy-ink-200, #e6e8ec);
}
.perf-page-header h1 {
  margin: 0 0 4px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.perf-page-header .subtitle {
  margin: 0;
  font-size: var(--fz-13, 13px);
  color: var(--color-text-secondary);
}
.perf-page-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.perf-pill {
  font-family: var(--font-mono);
  font-size: var(--fz-12, 12px);
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--chy-violet-50, #f3effd);
  color: var(--chy-violet-600, #6f5fd0);
}
.perf-page-btn {
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 6px;
  padding: 4px 12px;
  font-size: var(--fz-12, 12px);
  cursor: pointer;
  transition: background 160ms;
}
.perf-page-btn:hover { background: var(--chy-ink-50, #f6f7f9); }
.perf-page-bootstrap {
  background: var(--chy-ink-50, #f6f7f9);
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 8px;
  padding: 16px 20px;
  color: var(--color-text-secondary);
}
.perf-page-bootstrap h3 { margin: 0 0 8px; font-size: 15px; color: var(--color-text-primary); }
.perf-page-bootstrap p { margin: 6px 0; font-size: var(--fz-13, 13px); }
.perf-page-bootstrap code { font-family: var(--font-mono); background: rgba(0, 0, 0, 0.05); padding: 1px 6px; border-radius: 3px; }
.perf-page-bootstrap .hint { font-style: italic; font-size: var(--fz-12, 12px); margin-top: 12px; }
.perf-page-body { margin-top: 12px; }
</style>
