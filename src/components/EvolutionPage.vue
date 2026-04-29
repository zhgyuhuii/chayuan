<!--
  EvolutionPage — /evolution 路由的主面板

  纯展示外壳:
    - 顶部:进化系统启动状态 + 调度器开关
    - 中部:EvolutionStatusPanel(逐助手健康分 + 灰度/观察期/锚点)
    - 底部:操作日志(最近 N 次周期 / 触发 / 回滚事件)

  这是一个独立路由,不出现在 DIALOG_ROUTES 中,所以会和 CommandPaletteHost 共存,
  用户可以在本页直接 ⌘K 跑 evo.cycle.run 等命令。
-->
<template>
  <div class="evo-page">
    <header class="evo-page-header">
      <div>
        <h1>助手进化中心</h1>
        <p class="subtitle">RACE 4 维健康评估 · 双判官仲裁 · 灰度晋升 · 7 天观察期 · 自动回滚</p>
      </div>
      <div class="evo-page-status">
        <span class="status-pill" :class="{ 'is-on': status.booted }">
          <span class="dot" />
          {{ status.booted ? '系统已启动' : '系统未启动' }}
        </span>
        <span class="scheduler-pill" :class="{ 'is-on': status.scheduler.enabled }">
          调度器 {{ status.scheduler.enabled ? '开' : '关' }} · {{ status.scheduler.triggerHour }}:00
        </span>
        <button
          v-if="status.booted"
          class="evo-page-btn"
          :class="{ primary: status.scheduler.enabled }"
          @click="onToggleScheduler"
        >
          {{ status.scheduler.enabled ? '禁用每日自动评估' : '启用每日自动评估' }}
        </button>
      </div>
    </header>

    <div v-if="!status.booted" class="evo-page-bootstrap">
      <h3>进化系统未启动</h3>
      <p>在 <code>src/main.js</code> 调用一次:</p>
      <pre><code>import { bootEvolutionSystem } from '@/utils/assistant/evolution/evolutionBoot.js'
bootEvolutionSystem({ model: { providerId: 'openai', modelId: 'gpt-4o-mini' } })</code></pre>
      <p class="hint">
        启动后本页才能展示助手健康度;现在已注册的 ⌘K 命令(evo.cycle.run / evo.snapshot.log 等)也将可用。
      </p>
    </div>

    <main class="evo-page-body">
      <EvolutionStatusPanel
        :auto-refresh-ms="20000"
        title="所有自定义助手"
        @cycle-done="onCycleDone"
        @triggered="onTriggered"
        @rollback="onRollback"
        @close="goBack"
      />
    </main>

    <section v-if="events.length" class="evo-page-events">
      <h3>最近事件</h3>
      <ul>
        <li v-for="(ev, idx) in events" :key="idx" :class="`ev-${ev.kind}`">
          <span class="ev-time">{{ formatTime(ev.at) }}</span>
          <span class="ev-kind">{{ ev.kind }}</span>
          <span class="ev-detail">{{ ev.detail }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<script>
import EvolutionStatusPanel from './common/EvolutionStatusPanel.vue'
import { getEvolutionStatus } from '../utils/assistant/evolution/evolutionBoot.js'
import { setSchedulerEnabled } from '../utils/assistant/evolution/scheduler.js'

const MAX_EVENTS = 30

export default {
  name: 'EvolutionPage',
  components: { EvolutionStatusPanel },
  data() {
    return {
      status: { booted: false, scheduler: { enabled: false, triggerHour: 3 } },
      events: [],
      refreshTimer: null
    }
  },
  mounted() {
    this.refreshStatus()
    this.refreshTimer = setInterval(() => this.refreshStatus(), 10000)
  },
  beforeUnmount() {
    if (this.refreshTimer) clearInterval(this.refreshTimer)
  },
  methods: {
    refreshStatus() {
      try { this.status = getEvolutionStatus() } catch (_) {}
    },
    pushEvent(kind, detail) {
      this.events.unshift({ kind, detail: String(detail || ''), at: Date.now() })
      if (this.events.length > MAX_EVENTS) this.events.length = MAX_EVENTS
    },
    onToggleScheduler() {
      const next = !this.status.scheduler.enabled
      setSchedulerEnabled(next)
      this.refreshStatus()
      this.pushEvent('scheduler', `调度器已 ${next ? '启用' : '禁用'}`)
    },
    onCycleDone(result) {
      this.pushEvent('cycle', `周期完成 · 评估 ${result.evaluated || 0} · 晋升 ${result.promoted || 0} · 入灰 ${result.shadowStarted || 0} · 回滚 ${result.rolledBack || 0}`)
    },
    onTriggered(result) {
      this.pushEvent('trigger', `${result.assistantId}: ${result.action}(${result.reason || ''})`)
    },
    onRollback(result) {
      this.pushEvent('rollback', `${result.assistantId}: ${result.ok ? '回滚成功' : `失败 — ${result.reason || ''}`}`)
    },
    goBack() {
      if (window.history.length > 1) window.history.back()
      else this.$router.push('/')
    },
    formatTime(ts) {
      const d = new Date(ts)
      const pad = (n) => String(n).padStart(2, '0')
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    }
  }
}
</script>

<style scoped>
.evo-page {
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px 28px 80px;
  font-family: var(--font-base);
  color: var(--color-text-primary);
}

.evo-page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  flex-wrap: wrap;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--chy-ink-200, #e6e8ec);
}
.evo-page-header h1 {
  margin: 0 0 4px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.evo-page-header .subtitle {
  margin: 0;
  font-size: var(--fz-13, 13px);
  color: var(--color-text-secondary);
}

.evo-page-status {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.status-pill, .scheduler-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fz-12, 12px);
  font-family: var(--font-mono);
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--chy-ink-50, #f6f7f9);
  color: var(--color-text-muted);
}
.status-pill.is-on {
  background: rgba(63, 174, 130, 0.10);
  color: var(--chy-celadon-700, #1f6e51);
}
.status-pill .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-muted);
}
.status-pill.is-on .dot {
  background: var(--chy-celadon-500, #3fae82);
  box-shadow: 0 0 0 3px rgba(63, 174, 130, 0.18);
}
.scheduler-pill.is-on {
  background: rgba(124, 108, 220, 0.10);
  color: var(--chy-violet-600, #6f5fd0);
}

.evo-page-btn {
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 6px;
  padding: 4px 12px;
  font-size: var(--fz-12, 12px);
  cursor: pointer;
  transition: all 160ms;
}
.evo-page-btn:hover { background: var(--chy-ink-50, #f6f7f9); }
.evo-page-btn.primary {
  background: var(--chy-violet-500, #7c6cdc);
  border-color: var(--chy-violet-500, #7c6cdc);
  color: #fff;
}
.evo-page-btn.primary:hover { background: var(--chy-violet-600, #6f5fd0); }

.evo-page-bootstrap {
  background: rgba(212, 160, 23, 0.08);
  border: 1px solid rgba(212, 160, 23, 0.25);
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 20px;
  color: var(--chy-amber-700, #a06800);
}
.evo-page-bootstrap h3 { margin: 0 0 8px; font-size: 15px; }
.evo-page-bootstrap p { margin: 6px 0; font-size: var(--fz-13, 13px); }
.evo-page-bootstrap pre {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  padding: 10px 12px;
  margin: 8px 0;
  font-size: var(--fz-12, 12px);
  overflow-x: auto;
}
.evo-page-bootstrap code {
  font-family: var(--font-mono);
}
.evo-page-bootstrap .hint {
  font-style: italic;
  color: var(--chy-amber-800, #7c4f00);
  font-size: var(--fz-12, 12px);
}

.evo-page-body { margin-bottom: 24px; }

.evo-page-events {
  margin-top: 28px;
  padding-top: 16px;
  border-top: 1px solid var(--chy-ink-200, #e6e8ec);
}
.evo-page-events h3 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
}
.evo-page-events ul { list-style: none; padding: 0; margin: 0; }
.evo-page-events li {
  display: grid;
  grid-template-columns: auto auto 1fr;
  gap: 12px;
  align-items: baseline;
  font-size: var(--fz-12, 12px);
  padding: 6px 0;
  border-bottom: 1px dashed var(--chy-ink-100, #f0f1f4);
}
.evo-page-events li:last-child { border-bottom: none; }
.evo-page-events .ev-time {
  font-family: var(--font-mono);
  color: var(--color-text-muted);
}
.evo-page-events .ev-kind {
  font-family: var(--font-mono);
  font-weight: 600;
  text-transform: uppercase;
  font-size: 10px;
  padding: 1px 8px;
  border-radius: 4px;
  background: var(--chy-ink-50, #f6f7f9);
}
.evo-page-events .ev-cycle .ev-kind    { background: rgba(124, 108, 220, 0.12); color: var(--chy-violet-600, #6f5fd0); }
.evo-page-events .ev-trigger .ev-kind  { background: rgba(63, 174, 130, 0.12);  color: var(--chy-celadon-600, #2c8d68); }
.evo-page-events .ev-rollback .ev-kind { background: rgba(196, 75, 58, 0.10);   color: var(--chy-rouge-600, #c44b3a); }
.evo-page-events .ev-scheduler .ev-kind { background: rgba(212, 160, 23, 0.10); color: var(--chy-amber-700, #a06800); }
.evo-page-events .ev-detail { color: var(--color-text-secondary); }
</style>
