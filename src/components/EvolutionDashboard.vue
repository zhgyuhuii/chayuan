<!--
  EvolutionDashboard — 组织级进化大盘

  v2 计划 P5 项「进化大盘(组织级数据分析)」。汇总:
    - 助手 Health League(按总分排名,top 10 + 危险 5)
    - 全局趋势(本周 vs 上周,promotion / rollback / shadow / 失败信号 数)
    - 灰度配额走势
    - 策略统计(被暂停 / 永不建议 / 冻结 的助手计数)

  数据来自:
    - listAllSovereignty()
    - getFlowSnapshot()
    - getQuotaStatus()
    - listObservations / listSignals
-->
<template>
  <div class="ed-page">
    <header class="ed-head">
      <div>
        <h1>进化大盘</h1>
        <p class="subtitle">组织级 RACE 健康总览 · 趋势分析 · 政策统计</p>
      </div>
      <div class="ed-head-actions">
        <button class="ed-btn" @click="onRefresh">↻ 刷新</button>
        <button class="ed-btn" @click="goBack">返回</button>
      </div>
    </header>

    <!-- 指标卡片 -->
    <section class="ed-metrics">
      <div class="ed-metric">
        <div class="ed-m-label">助手总数</div>
        <div class="ed-m-value">{{ snapshot.length }}</div>
      </div>
      <div class="ed-metric">
        <div class="ed-m-label">已锚定</div>
        <div class="ed-m-value">{{ stats.anchored }}</div>
      </div>
      <div class="ed-metric">
        <div class="ed-m-label">灰度中</div>
        <div class="ed-m-value violet">{{ stats.shadowing }}</div>
      </div>
      <div class="ed-metric">
        <div class="ed-m-label">观察中</div>
        <div class="ed-m-value amber">{{ stats.observing }}</div>
      </div>
      <div class="ed-metric">
        <div class="ed-m-label">健康分中位数</div>
        <div class="ed-m-value" :class="medianClass">{{ stats.medianHealth || '—' }}</div>
      </div>
      <div class="ed-metric">
        <div class="ed-m-label">配额已用</div>
        <div class="ed-m-value">{{ quota.used }}/{{ quota.max }}</div>
      </div>
    </section>

    <!-- Health League -->
    <section class="ed-section">
      <h2>健康榜</h2>
      <div class="ed-league">
        <div class="ed-league-col">
          <h3>Top 5</h3>
          <ol class="ed-league-list">
            <li v-for="row in topAssistants" :key="row.id">
              <code>{{ row.id }}</code>
              <span class="score good">{{ row.health?.total ?? '—' }}</span>
            </li>
          </ol>
        </div>
        <div class="ed-league-col">
          <h3>危险 5</h3>
          <ol class="ed-league-list">
            <li v-for="row in atRiskAssistants" :key="row.id">
              <code>{{ row.id }}</code>
              <span class="score bad">{{ row.health?.total ?? '—' }}</span>
            </li>
          </ol>
        </div>
      </div>
    </section>

    <!-- 政策统计 -->
    <section class="ed-section">
      <h2>用户主权</h2>
      <div class="ed-policy">
        <div class="ed-policy-item">
          <span class="label">暂停建议</span>
          <strong>{{ policyStats.paused }}</strong> 个助手
        </div>
        <div class="ed-policy-item">
          <span class="label">永不建议</span>
          <strong>{{ policyStats.neverSuggest }}</strong> 个
        </div>
        <div class="ed-policy-item">
          <span class="label">已冻结版本</span>
          <strong>{{ policyStats.frozen }}</strong> 个
        </div>
        <div class="ed-policy-item">
          <span class="label">Anchor 待重置</span>
          <strong>{{ policyStats.anchorResetPending }}</strong> 个
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import { getFlowSnapshot } from '../utils/assistant/evolution/promotionFlow.js'
import { getQuotaStatus } from '../utils/assistant/evolution/shadowRunner.js'
import { listAllSovereignty } from '../utils/assistant/evolution/sovereigntyStore.js'
import { getCurrentEvolutionDeps } from '../utils/assistant/evolution/evolutionBoot.js'

export default {
  name: 'EvolutionDashboard',
  data() {
    return {
      snapshot: [],
      quota: { used: 0, max: 0, remaining: 0 },
      sovereignty: []
    }
  },
  computed: {
    stats() {
      const s = {
        anchored: 0,
        shadowing: 0,
        observing: 0,
        rolledBack: 0,
        medianHealth: 0
      }
      const healthScores = []
      for (const row of this.snapshot) {
        if (row.anchorRegistered) s.anchored += 1
        if (row.shadow) s.shadowing += 1
        if (row.observation) s.observing += 1
        if (row.observation?.rolledBack) s.rolledBack += 1
        if (typeof row.health?.total === 'number') healthScores.push(row.health.total)
      }
      if (healthScores.length) {
        const sorted = [...healthScores].sort((a, b) => a - b)
        s.medianHealth = sorted[Math.floor(sorted.length / 2)]
      }
      return s
    },
    topAssistants() {
      return [...this.snapshot]
        .filter(r => typeof r.health?.total === 'number')
        .sort((a, b) => (b.health.total || 0) - (a.health.total || 0))
        .slice(0, 5)
    },
    atRiskAssistants() {
      return [...this.snapshot]
        .filter(r => typeof r.health?.total === 'number')
        .sort((a, b) => (a.health.total || 0) - (b.health.total || 0))
        .slice(0, 5)
    },
    medianClass() {
      const m = this.stats.medianHealth
      if (!m) return ''
      if (m >= 85) return 'good'
      if (m >= 70) return 'mid'
      return 'bad'
    },
    policyStats() {
      const p = { paused: 0, neverSuggest: 0, frozen: 0, anchorResetPending: 0 }
      for (const s of this.sovereignty) {
        if (s.paused) p.paused += 1
        if (s.neverSuggest) p.neverSuggest += 1
        if (s.frozenAt) p.frozen += 1
        if (s.anchorResetPending) p.anchorResetPending += 1
      }
      return p
    }
  },
  mounted() { this.onRefresh() },
  methods: {
    onRefresh() {
      const deps = getCurrentEvolutionDeps()
      try { this.snapshot = deps ? (getFlowSnapshot({ deps }) || []) : [] }
      catch { this.snapshot = [] }
      try { this.quota = getQuotaStatus() || this.quota } catch {}
      try { this.sovereignty = listAllSovereignty() || [] } catch {}
    },
    goBack() {
      if (window.history.length > 1) window.history.back()
      else this.$router.push('/')
    }
  }
}
</script>

<style scoped>
.ed-page { max-width: 1080px; margin: 0 auto; padding: 24px 28px 80px; font-family: var(--font-base); color: var(--color-text-primary); }
.ed-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--chy-ink-200, #e6e8ec); }
.ed-head h1 { margin: 0 0 4px; font-size: 22px; font-weight: 700; }
.ed-head .subtitle { margin: 0; font-size: var(--fz-13, 13px); color: var(--color-text-secondary); }
.ed-head-actions { display: flex; gap: 8px; }
.ed-btn { padding: 6px 12px; border: 1px solid var(--chy-ink-200, #e6e8ec); background: transparent; border-radius: 6px; font-size: 12px; cursor: pointer; }
.ed-btn:hover { background: var(--chy-ink-50, #f6f7f9); }

.ed-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-bottom: 24px; }
.ed-metric { padding: 12px 14px; border: 1px solid var(--chy-ink-200, #e6e8ec); border-radius: 10px; background: var(--color-bg-elevated, #fff); }
.ed-m-label { font-size: 11px; color: var(--color-text-muted); }
.ed-m-value { font-size: 24px; font-weight: 700; font-feature-settings: 'tnum'; margin-top: 2px; }
.ed-m-value.good { color: var(--chy-celadon-600, #2c8d68); }
.ed-m-value.mid { color: var(--chy-amber-600, #c08000); }
.ed-m-value.bad { color: var(--chy-rouge-600, #c44b3a); }
.ed-m-value.violet { color: var(--chy-violet-600, #6f5fd0); }
.ed-m-value.amber { color: var(--chy-amber-600, #c08000); }

.ed-section { margin-bottom: 24px; }
.ed-section h2 { margin: 0 0 12px; font-size: 16px; font-weight: 600; }
.ed-league { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.ed-league-col h3 { margin: 0 0 8px; font-size: 13px; color: var(--color-text-secondary); }
.ed-league-list { list-style: decimal inside; padding: 0; margin: 0; }
.ed-league-list li {
  padding: 6px 8px;
  border-bottom: 1px dashed var(--chy-ink-100, #f0f1f4);
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 12px;
}
.ed-league-list code { font-family: var(--font-mono); font-size: 11px; }
.ed-league-list .score { font-weight: 600; font-feature-settings: 'tnum'; }
.ed-league-list .score.good { color: var(--chy-celadon-600, #2c8d68); }
.ed-league-list .score.bad { color: var(--chy-rouge-600, #c44b3a); }

.ed-policy { display: flex; flex-wrap: wrap; gap: 12px; }
.ed-policy-item {
  padding: 8px 14px;
  background: var(--chy-ink-50, #f6f7f9);
  border-radius: 8px;
  font-size: 13px;
}
.ed-policy-item .label { color: var(--color-text-muted); margin-right: 6px; }
.ed-policy-item strong { font-feature-settings: 'tnum'; font-size: 16px; }
</style>
