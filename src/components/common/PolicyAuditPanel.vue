<!--
  PolicyAuditPanel — 策略 / 配额 / 审计 统一面板

  v2 计划 P4 项「策略/配额/审计 UI 统一面板」。一处看到:
    - 进化系统状态 + scheduler / 灰度配额(getQuotaStatus)
    - 主权设置(用户对每个助手的暂停/永不/冻结/anchor reset)
    - perfTracker 状态
    - 网络状态 + 自动暂停状态

  纯展示页(不修改任何状态),用于审计 / 故障排查。
-->
<template>
  <DialogShell title="策略 / 配额 / 审计" subtitle="进化、灰度、限流、网络全局状态总览" @close="$emit('close')">
    <template #header-actions>
      <button class="pa-btn" @click="onRefresh">↻ 刷新</button>
    </template>

    <!-- 系统层 -->
    <section class="pa-section">
      <h3>系统状态</h3>
      <div class="pa-grid">
        <div class="pa-card">
          <span class="pa-label">进化系统</span>
          <span class="pa-value" :class="{ on: system.evolutionBooted }">
            {{ system.evolutionBooted ? '已启动' : '未启动' }}
          </span>
        </div>
        <div class="pa-card">
          <span class="pa-label">每日调度</span>
          <span class="pa-value" :class="{ on: system.schedulerEnabled }">
            {{ system.schedulerEnabled ? `开 (${system.schedulerHour}:00)` : '关' }}
          </span>
        </div>
        <div class="pa-card">
          <span class="pa-label">网络</span>
          <span class="pa-value" :class="{ on: system.online }">
            {{ system.online ? '在线' : '离线' }}
          </span>
        </div>
        <div class="pa-card">
          <span class="pa-label">主题</span>
          <span class="pa-value">{{ system.theme }}</span>
        </div>
      </div>
    </section>

    <!-- 灰度配额 -->
    <section class="pa-section">
      <h3>灰度配额</h3>
      <div class="pa-quota">
        <div class="pa-quota-bar">
          <div class="pa-quota-fill" :style="{ width: quotaPct + '%' }"></div>
        </div>
        <div class="pa-quota-detail">
          已用 <strong>{{ quota.used }}</strong> / {{ quota.max }} ·
          剩 {{ quota.remaining }} ·
          <span class="dim">{{ quotaResetText }}</span>
        </div>
      </div>
    </section>

    <!-- 主权状态 -->
    <section class="pa-section">
      <h3>用户主权</h3>
      <div v-if="!sovereignty.length" class="pa-empty">所有助手均处于默认(完全自动)状态</div>
      <table v-else class="pa-table">
        <thead>
          <tr><th>助手</th><th>暂停</th><th>永不建议</th><th>冻结版本</th><th>Anchor 待重置</th></tr>
        </thead>
        <tbody>
          <tr v-for="s in sovereignty" :key="s.assistantId">
            <td><code>{{ s.assistantId }}</code></td>
            <td>{{ s.paused ? `是(${formatUntil(s.pauseUntil)})` : '否' }}</td>
            <td>{{ s.neverSuggest ? '是' : '否' }}</td>
            <td><code v-if="s.frozenAt">{{ s.frozenAt }}</code><span v-else>—</span></td>
            <td>{{ s.anchorResetPending ? '是' : '否' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- 性能 -->
    <section class="pa-section">
      <h3>LLM 调用性能</h3>
      <div class="pa-grid">
        <div class="pa-card"><span class="pa-label">总数</span><span class="pa-value">{{ perfStats.count }}</span></div>
        <div class="pa-card"><span class="pa-label">P50</span><span class="pa-value">{{ perfStats.p50 }}<small>ms</small></span></div>
        <div class="pa-card" :class="latencyClass(perfStats.p95)">
          <span class="pa-label">P95</span><span class="pa-value">{{ perfStats.p95 }}<small>ms</small></span>
        </div>
        <div class="pa-card" :class="latencyClass(perfStats.p99)">
          <span class="pa-label">P99</span><span class="pa-value">{{ perfStats.p99 }}<small>ms</small></span>
        </div>
      </div>
    </section>
  </DialogShell>
</template>

<script>
import DialogShell from './DialogShell.vue'
import { getEvolutionStatus } from '../../utils/assistant/evolution/evolutionBoot.js'
import { getQuotaStatus } from '../../utils/assistant/evolution/shadowRunner.js'
import { listAllSovereignty } from '../../utils/assistant/evolution/sovereigntyStore.js'
import { getStats as getPerfStats } from '../../utils/perfTracker.js'
import { getEffectiveTheme } from '../../utils/router/themeToggle.js'

export default {
  name: 'PolicyAuditPanel',
  components: { DialogShell },
  data() {
    return {
      system: { evolutionBooted: false, schedulerEnabled: false, schedulerHour: 3, online: true, theme: 'light' },
      quota: { used: 0, max: 0, remaining: 0, resetAt: 0 },
      sovereignty: [],
      perfStats: { count: 0, p50: 0, p95: 0, p99: 0 }
    }
  },
  computed: {
    quotaPct() {
      if (!this.quota.max) return 0
      return Math.round((this.quota.used / this.quota.max) * 100)
    },
    quotaResetText() {
      if (!this.quota.resetAt) return ''
      const left = this.quota.resetAt - Date.now()
      if (left <= 0) return '即将重置'
      const days = Math.ceil(left / 86400_000)
      return days > 1 ? `${days} 天后重置` : '今日内重置'
    }
  },
  mounted() { this.onRefresh() },
  methods: {
    onRefresh() {
      try {
        const evo = getEvolutionStatus()
        this.system.evolutionBooted = !!evo?.booted
        this.system.schedulerEnabled = !!evo?.scheduler?.enabled
        this.system.schedulerHour = evo?.scheduler?.triggerHour || 3
      } catch (_) {}
      try { this.quota = getQuotaStatus() || this.quota } catch (_) {}
      try { this.sovereignty = listAllSovereignty() || [] } catch (_) {}
      try { this.perfStats = getPerfStats() || this.perfStats } catch (_) {}
      this.system.online = typeof navigator === 'undefined' || navigator.onLine !== false
      this.system.theme = getEffectiveTheme()
    },
    latencyClass(ms) {
      if (!ms) return ''
      if (ms < 1000) return 'fast'
      if (ms < 3000) return 'mid'
      return 'slow'
    },
    formatUntil(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      const pad = n => String(n).padStart(2, '0')
      return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
  }
}
</script>

<style scoped>
.pa-section { margin-bottom: 18px; }
.pa-section h3 { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
.pa-empty { font-size: 12px; color: var(--color-text-muted); padding: 8px 0; }

.pa-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
.pa-card {
  display: flex; flex-direction: column; gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 8px;
  background: var(--color-bg-elevated, #fff);
}
.pa-card.fast { border-color: var(--chy-celadon-300, #a4dac1); }
.pa-card.mid  { border-color: var(--chy-amber-300, #f5d495); }
.pa-card.slow { border-color: var(--chy-rouge-300, #f0bcb3); }
.pa-label { font-size: 11px; color: var(--color-text-muted); }
.pa-value { font-size: 18px; font-weight: 600; font-feature-settings: 'tnum'; }
.pa-value.on { color: var(--chy-celadon-600, #2c8d68); }
.pa-value small { font-size: 10px; color: var(--color-text-muted); margin-left: 2px; }

.pa-quota-bar {
  width: 100%;
  height: 8px;
  background: var(--chy-ink-100, #f0f1f4);
  border-radius: 4px;
  overflow: hidden;
}
.pa-quota-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--chy-violet-500, #7c6cdc), var(--chy-violet-600, #6f5fd0));
  transition: width 280ms;
}
.pa-quota-detail {
  margin-top: 6px;
  font-size: 12px;
  font-family: var(--font-mono);
}
.pa-quota-detail .dim { color: var(--color-text-muted); }

.pa-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.pa-table th { text-align: left; padding: 6px 10px; font-weight: 500; color: var(--color-text-muted); border-bottom: 1px solid var(--chy-ink-200, #e6e8ec); }
.pa-table td { padding: 6px 10px; border-bottom: 1px dashed var(--chy-ink-100, #f0f1f4); }
.pa-table code { font-family: var(--font-mono); font-size: 11px; }

.pa-btn { padding: 4px 10px; border: 1px solid var(--chy-ink-200, #e6e8ec); background: transparent; border-radius: 6px; font-size: 12px; cursor: pointer; }
.pa-btn:hover { background: var(--chy-ink-50, #f6f7f9); }
</style>
