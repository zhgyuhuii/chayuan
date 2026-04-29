<!--
  EvolutionStatusPanel — 助手进化状态总览面板

  能看到:
    - 每个助手当前 RACE 健康分(R/A/C/E + total)
    - 是否在灰度(灰度版本号 / 灰度起止)
    - 是否在观察期(版本 / 已采样次数 / 剩余天数)
    - 锚点是否注册

  能做:
    - 「立即触发」当前助手的进化评估
    - 「立即触发」全量评估周期(同 daily cron)
    - 观察期内一键「回滚到上一版」
    - 灰度配额(getQuotaStatus)展示

  Props:
    deps    — promotionFlow 所需的 deps(必须含 model + runOnSamples)
    autoRefreshMs — 自动刷新周期(默认 30 秒)

  Emits:
    'rollback'   { assistantId, ok, reason }
    'triggered'  { assistantId, action, reason }
    'cycle-done' { ... runDailyEvaluationCycle 的结果 }
-->
<template>
  <DialogShell
    :title="title"
    subtitle="进化系统会自动评估每个助手的失败聚类、灰度候选、观察晋升与回滚"
    @close="$emit('close')"
  >
    <template #header-actions>
      <button
        class="evo-btn primary"
        :disabled="cycleRunning || !isBooted"
        @click="onRunCycle"
      >
        {{ cycleRunning ? '运行中…' : '立即触发全量周期' }}
      </button>
      <button class="evo-btn ghost" @click="refresh" title="刷新">↻</button>
    </template>

    <div v-if="!isBooted" class="evo-not-booted">
      ⚠ 进化系统尚未启动 — 请在 main.js 调用 <code>bootEvolutionSystem({ model })</code>。
    </div>

    <div class="evo-quota">
      灰度配额:<strong>{{ quota.used }}/{{ quota.cap }}</strong>
      ({{ quota.remaining }} 剩余,{{ quotaResetText }})
    </div>

    <div v-if="lastCycle" class="evo-last-cycle">
      <span>上次周期 · {{ formatTime(lastCycleAt) }}</span>
      <span>评估 {{ lastCycle.evaluated || 0 }}</span>
      <span class="dot promoted">晋升 {{ lastCycle.promoted || 0 }}</span>
      <span class="dot shadow">入灰 {{ lastCycle.shadowStarted || 0 }}</span>
      <span class="dot rollback">回滚 {{ lastCycle.rolledBack || 0 }}</span>
      <span v-if="(lastCycle.errors || []).length" class="dot error">
        异常 {{ lastCycle.errors.length }}
      </span>
    </div>

    <div v-if="!snapshot.length" class="evo-empty">
      暂无可进化的自定义助手。
    </div>

    <div v-else class="evo-list">
      <div
        v-for="row in snapshot"
        :key="row.id"
        class="evo-row"
        :class="{ 'in-shadow': row.shadow, 'in-obs': row.observation, 'rolled-back': row.observation && row.observation.rolledBack }"
      >
        <div class="evo-row-head">
          <span class="evo-id" :title="row.id">{{ shorten(row.id) }}</span>

          <span v-if="row.health" class="evo-health" :class="healthClass(row.health.total)">
            <span class="t">{{ row.health.total }}</span>
            <span class="bd">R{{ row.health.R }}</span>
            <span class="bd">A{{ row.health.A }}</span>
            <span class="bd">C{{ row.health.C }}</span>
            <span class="bd">E{{ row.health.E }}</span>
          </span>
          <span v-else class="evo-health no-data">无信号</span>

          <span v-if="row.shadow" class="evo-tag shadow" :title="`since ${formatTime(row.shadow.setAt)}`">
            灰度中 · {{ shorten(row.shadow.versionId) }}
          </span>
          <span v-if="row.observation" class="evo-tag obs" :title="`截止 ${formatTime(row.observation.expiresAt)}`">
            观察中 · {{ shorten(row.observation.versionId) }}
            ({{ row.observation.sampleCount }} 样本 / {{ daysLeft(row.observation.expiresAt) }} 天剩余)
          </span>
          <span v-if="row.anchorRegistered" class="evo-tag anchor">已锚定</span>
          <span v-else class="evo-tag warn" title="未注册锚点 — 候选漂移检测会失效">⚠ 未锚定</span>
        </div>

        <div class="evo-row-actions">
          <button
            class="evo-btn ghost"
            :disabled="cycleRunning || !!triggerRunning[row.id]"
            @click="onTriggerOne(row.id)"
          >{{ triggerRunning[row.id] ? '…' : '触发评估' }}</button>

          <button
            v-if="row.observation && !row.observation.rolledBack"
            class="evo-btn warn"
            :disabled="!!rollbackRunning[row.id]"
            @click="onRollback(row.id)"
          >{{ rollbackRunning[row.id] ? '回滚中…' : '回滚到上一版' }}</button>
        </div>
      </div>
    </div>

    <template #footer>
      <span class="evo-hint">
        💡 进化系统使用 4 维 RACE 评估 + 双判官 LLM 仲裁,候选必须先通过灰度比对再晋升;
        晋升后进入 7 天观察期,连续 3 次维度跌破阈值会自动回滚。
      </span>
    </template>
  </DialogShell>
</template>

<script>
import DialogShell from './DialogShell.vue'
import {
  triggerEvaluation,
  runDailyEvaluationCycle,
  rollbackByUser,
  getFlowSnapshot
} from '../../utils/assistant/evolution/promotionFlow.js'
import { getQuotaStatus } from '../../utils/assistant/evolution/shadowRunner.js'
import { getCurrentEvolutionDeps } from '../../utils/assistant/evolution/evolutionBoot.js'

export default {
  name: 'EvolutionStatusPanel',
  components: { DialogShell },
  props: {
    /** 进化系统的 deps;不传则尝试从 evolutionBoot 全局取 */
    deps:          { type: Object, default: null },
    autoRefreshMs: { type: Number, default: 30000 },
    title:         { type: String, default: '助手进化状态' }
  },
  data() {
    return {
      snapshot: [],
      quota: { used: 0, cap: 0, remaining: 0, resetAt: 0 },
      lastCycle: null,
      lastCycleAt: 0,
      cycleRunning: false,
      triggerRunning: {},
      rollbackRunning: {},
      refreshTimer: null
    }
  },
  computed: {
    effectiveDeps() {
      return this.deps || getCurrentEvolutionDeps()
    },
    isBooted() {
      return !!this.effectiveDeps
    },
    quotaResetText() {
      if (!this.quota?.resetAt) return ''
      const left = this.quota.resetAt - Date.now()
      if (left <= 0) return '即将重置'
      const h = Math.floor(left / 3600_000)
      return h > 0 ? `${h} 小时后重置` : '不到 1 小时后重置'
    }
  },
  mounted() {
    this.refresh()
    if (this.autoRefreshMs > 0) {
      this.refreshTimer = setInterval(() => this.refresh(), this.autoRefreshMs)
    }
  },
  beforeUnmount() {
    if (this.refreshTimer) clearInterval(this.refreshTimer)
  },
  methods: {
    refresh() {
      if (!this.effectiveDeps) { this.snapshot = []; return }
      try {
        this.snapshot = getFlowSnapshot({ deps: this.effectiveDeps }) || []
      } catch (_) { this.snapshot = [] }
      try {
        this.quota = getQuotaStatus() || this.quota
      } catch (_) { /* keep last */ }
    },
    async onRunCycle() {
      if (!this.effectiveDeps) return
      this.cycleRunning = true
      try {
        const result = await runDailyEvaluationCycle({ deps: this.effectiveDeps })
        this.lastCycle = result
        this.lastCycleAt = Date.now()
        this.$emit('cycle-done', result)
      } finally {
        this.cycleRunning = false
        this.refresh()
      }
    },
    async onTriggerOne(id) {
      if (!this.effectiveDeps) return
      this.triggerRunning = { ...this.triggerRunning, [id]: true }
      try {
        const r = await triggerEvaluation(id, { deps: this.effectiveDeps })
        this.$emit('triggered', r)
      } finally {
        this.triggerRunning = { ...this.triggerRunning, [id]: false }
        this.refresh()
      }
    },
    async onRollback(id) {
      if (!this.effectiveDeps) return
      this.rollbackRunning = { ...this.rollbackRunning, [id]: true }
      try {
        const r = await rollbackByUser(id, { deps: this.effectiveDeps })
        this.$emit('rollback', { assistantId: id, ...r })
      } finally {
        this.rollbackRunning = { ...this.rollbackRunning, [id]: false }
        this.refresh()
      }
    },
    healthClass(total) {
      if (total >= 85) return 'good'
      if (total >= 70) return 'mid'
      return 'bad'
    },
    shorten(s) {
      const t = String(s || '')
      if (t.length <= 24) return t
      return t.slice(0, 12) + '…' + t.slice(-8)
    },
    daysLeft(expiresAt) {
      const left = (expiresAt || 0) - Date.now()
      if (left <= 0) return 0
      return Math.ceil(left / 86400_000)
    },
    formatTime(ts) {
      if (!ts) return '—'
      const d = new Date(ts)
      const pad = (n) => String(n).padStart(2, '0')
      return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
  }
}
</script>

<style scoped>
.evo-not-booted {
  font-size: var(--fz-13, 13px);
  color: var(--chy-amber-700, #a06800);
  background: rgba(212, 160, 23, 0.08);
  border: 1px solid rgba(212, 160, 23, 0.25);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 12px;
}
.evo-not-booted code {
  font-family: var(--font-mono);
  background: rgba(0, 0, 0, 0.06);
  padding: 1px 6px;
  border-radius: 3px;
}

.evo-quota {
  font-family: var(--font-mono);
  font-size: var(--fz-12, 12px);
  color: var(--color-text-secondary);
  padding: 8px 12px;
  background: var(--chy-ink-50, #f6f7f9);
  border-radius: 6px;
  margin-bottom: 12px;
}

.evo-last-cycle {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: var(--fz-12, 12px);
  color: var(--color-text-secondary);
  margin-bottom: 12px;
}
.evo-last-cycle .dot {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.evo-last-cycle .promoted { color: var(--chy-celadon-600, #2c8d68); }
.evo-last-cycle .shadow   { color: var(--chy-violet-600, #6f5fd0); }
.evo-last-cycle .rollback { color: var(--chy-amber-600, #c08000); }
.evo-last-cycle .error    { color: var(--chy-rouge-600, #c44b3a); }

.evo-empty {
  padding: 32px 0;
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--fz-13, 13px);
}

.evo-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.evo-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px 16px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 8px;
  background: var(--color-bg-elevated, #fff);
  transition: border-color 200ms;
}
.evo-row.in-shadow  { border-color: var(--chy-violet-300, #c4b9f0); }
.evo-row.in-obs     { border-color: var(--chy-amber-300, #f5d495); }
.evo-row.rolled-back { opacity: 0.65; }

.evo-row-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  min-width: 0;
}
.evo-id {
  font-family: var(--font-mono);
  font-size: var(--fz-12, 12px);
  color: var(--color-text-primary);
  font-weight: 600;
}

.evo-health {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-family: var(--font-mono);
  padding: 2px 8px;
  border-radius: 999px;
  font-size: var(--fz-11, 11px);
  background: var(--chy-ink-50, #f6f7f9);
}
.evo-health .t { font-size: var(--fz-13, 13px); font-weight: 700; }
.evo-health .bd { color: var(--color-text-muted); }
.evo-health.good .t { color: var(--chy-celadon-600, #2c8d68); }
.evo-health.mid  .t { color: var(--chy-amber-600, #c08000); }
.evo-health.bad  .t { color: var(--chy-rouge-600, #c44b3a); }
.evo-health.no-data { color: var(--color-text-muted); font-style: italic; }

.evo-tag {
  font-size: var(--fz-11, 11px);
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 500;
}
.evo-tag.shadow { background: rgba(111, 95, 208, 0.12); color: var(--chy-violet-600, #6f5fd0); }
.evo-tag.obs    { background: rgba(192, 128, 0, 0.10);  color: var(--chy-amber-600, #c08000); }
.evo-tag.anchor { background: rgba(44, 141, 104, 0.10); color: var(--chy-celadon-600, #2c8d68); }
.evo-tag.warn   { background: rgba(196, 75, 58, 0.10);  color: var(--chy-rouge-600, #c44b3a); }

.evo-row-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.evo-btn {
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: var(--fz-12, 12px);
  cursor: pointer;
  transition: all 160ms;
}
.evo-btn:hover:not(:disabled) {
  background: var(--chy-ink-50, #f6f7f9);
  border-color: var(--chy-ink-400, #b8bcc4);
}
.evo-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.evo-btn.primary {
  background: var(--chy-violet-500, #7c6cdc);
  border-color: var(--chy-violet-500, #7c6cdc);
  color: #fff;
}
.evo-btn.primary:hover:not(:disabled) {
  background: var(--chy-violet-600, #6f5fd0);
}
.evo-btn.warn {
  color: var(--chy-rouge-600, #c44b3a);
  border-color: var(--chy-rouge-300, #f0bcb3);
}
.evo-btn.warn:hover:not(:disabled) {
  background: var(--chy-rouge-50, #fdf3f1);
}

.evo-hint {
  font-size: var(--fz-12, 12px);
  color: var(--color-text-muted);
}
</style>
