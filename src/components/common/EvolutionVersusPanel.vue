<!--
  EvolutionVersusPanel — 进化对决面板

  v2 计划 P3「进化对决面板 UI」。展示 baseline vs candidate 的 RACE 4 维比对
  + judge 评分(若已 arbitrate 过)。

  用法:
    <EvolutionVersusPanel
      :assistant-id="id"
      :baseline-version="'1.0.0'"
      :candidate-version="'1.1.0-shadow'"
      :judge-result="{ candidateScore: 78, baselineScore: 72, winner: 'candidate' }"
      @promote="..."   :: 用户点 "采纳候选"
      @reject="..."    :: 用户点 "驳回"
    />

  数据源:raceEvaluator.compareCandidate(...)
-->
<template>
  <DialogShell title="进化对决" :subtitle="subtitle" @close="$emit('close')">
    <template #header-actions>
      <button class="ev-btn" :disabled="!comparison" @click="onRefresh">↻ 刷新</button>
    </template>

    <div v-if="!comparison" class="ev-empty">
      <p>暂无对比数据。等候选累积足够灰度样本后再来查看。</p>
    </div>

    <div v-else class="ev-content">
      <!-- 顶栏:总分对决 -->
      <div class="ev-headline">
        <div class="ev-side baseline" :class="{ winner: winner === 'baseline' }">
          <div class="ev-tag">基线 · {{ baselineVersion }}</div>
          <div class="ev-total">{{ comparison.baseline?.total ?? '—' }}</div>
        </div>
        <div class="ev-vs">vs</div>
        <div class="ev-side candidate" :class="{ winner: winner === 'candidate' }">
          <div class="ev-tag">候选 · {{ candidateVersion }}</div>
          <div class="ev-total">{{ comparison.candidate?.total ?? '—' }}</div>
        </div>
      </div>

      <!-- RACE 4 维对比 -->
      <table class="ev-race">
        <thead>
          <tr>
            <th>维度</th>
            <th class="num">基线</th>
            <th class="num">候选</th>
            <th class="num">Δ</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="dim in dims" :key="dim.key">
            <td>{{ dim.label }} <code>{{ dim.key }}</code></td>
            <td class="num">{{ comparison.baseline?.[dim.key] ?? '—' }}</td>
            <td class="num">{{ comparison.candidate?.[dim.key] ?? '—' }}</td>
            <td class="num" :class="deltaClass(dim.key)">{{ formatDelta(dim.key) }}</td>
          </tr>
          <tr class="total-row">
            <td><strong>总分</strong></td>
            <td class="num"><strong>{{ comparison.baseline?.total ?? '—' }}</strong></td>
            <td class="num"><strong>{{ comparison.candidate?.total ?? '—' }}</strong></td>
            <td class="num" :class="deltaClass('total')"><strong>{{ formatDelta('total') }}</strong></td>
          </tr>
        </tbody>
      </table>

      <!-- 判官打分(若有) -->
      <section v-if="judgeResult" class="ev-judge">
        <h3>双判官仲裁</h3>
        <div class="ev-judge-score">
          基线 <strong>{{ judgeResult.baselineScore }}</strong> ·
          候选 <strong>{{ judgeResult.candidateScore }}</strong> ·
          胜者: <span class="winner-tag" :class="`win-${judgeResult.winner}`">
            {{ judgeWinnerLabel }}
          </span>
        </div>
        <p v-if="judgeResult.disagreement" class="hint">⚠ 双判官分歧,建议人工 review</p>
      </section>

      <!-- 操作 -->
      <div class="ev-actions">
        <button
          class="ev-btn primary"
          :disabled="winner !== 'candidate'"
          @click="$emit('promote')"
        >采纳候选({{ winner === 'candidate' ? '建议' : '不建议' }})</button>
        <button class="ev-btn ghost" @click="$emit('reject')">驳回</button>
        <button class="ev-btn link" @click="$emit('hold')">先保持灰度</button>
      </div>
    </div>
  </DialogShell>
</template>

<script>
import DialogShell from './DialogShell.vue'
import { compareCandidate } from '../../utils/assistant/evolution/raceEvaluator.js'

const DIMS = [
  { key: 'R', label: '可靠性' },
  { key: 'A', label: '准确性' },
  { key: 'C', label: '合规性' },
  { key: 'E', label: '效率' }
]

export default {
  name: 'EvolutionVersusPanel',
  components: { DialogShell },
  props: {
    assistantId:      { type: String, required: true },
    baselineVersion:  { type: String, required: true },
    candidateVersion: { type: String, required: true },
    judgeResult:      { type: Object, default: null }
  },
  emits: ['promote', 'reject', 'hold', 'close'],
  data() {
    return {
      comparison: null,
      dims: DIMS
    }
  },
  computed: {
    subtitle() {
      return `${this.assistantId} · ${this.baselineVersion} → ${this.candidateVersion}`
    },
    winner() {
      return this.comparison?.winner || 'tie'
    },
    judgeWinnerLabel() {
      if (!this.judgeResult) return '—'
      return ({
        candidate: '候选',
        baseline: '基线',
        tie: '平局',
        inconclusive: '不确定'
      })[this.judgeResult.winner] || this.judgeResult.winner
    }
  },
  mounted() { this.onRefresh() },
  methods: {
    onRefresh() {
      try {
        this.comparison = compareCandidate(
          this.assistantId,
          this.baselineVersion,
          this.candidateVersion
        )
      } catch (_) { this.comparison = null }
    },
    formatDelta(key) {
      if (!this.comparison) return ''
      let delta
      if (key === 'total') {
        delta = this.comparison.deltaTotal
      } else {
        delta = this.comparison.deltaByDim?.[key]
      }
      if (typeof delta !== 'number') return ''
      const sign = delta > 0 ? '+' : ''
      return `${sign}${delta}`
    },
    deltaClass(key) {
      let delta
      if (key === 'total') {
        delta = this.comparison?.deltaTotal
      } else {
        delta = this.comparison?.deltaByDim?.[key]
      }
      if (typeof delta !== 'number') return ''
      if (delta >= 3) return 'good'
      if (delta <= -3) return 'bad'
      return 'flat'
    }
  }
}
</script>

<style scoped>
.ev-empty { padding: 32px 0; text-align: center; color: var(--color-text-muted); }
.ev-content { display: flex; flex-direction: column; gap: 16px; }

.ev-headline {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
}
.ev-side {
  padding: 14px 16px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 10px;
  text-align: center;
  background: var(--color-bg-elevated, #fff);
  transition: border-color 200ms, box-shadow 200ms;
}
.ev-side.winner { border-color: var(--chy-celadon-500, #3fae82); box-shadow: 0 0 0 2px rgba(63, 174, 130, 0.18); }
.ev-tag { font-size: 11px; color: var(--color-text-muted); margin-bottom: 4px; }
.ev-total { font-size: 36px; font-weight: 700; font-feature-settings: 'tnum'; }
.ev-vs { font-family: var(--font-mono); color: var(--color-text-muted); font-weight: 600; }

.ev-race { width: 100%; border-collapse: collapse; font-size: 13px; }
.ev-race th { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--chy-ink-200, #e6e8ec); font-weight: 500; color: var(--color-text-muted); }
.ev-race th.num, .ev-race td.num { text-align: right; font-feature-settings: 'tnum'; }
.ev-race td { padding: 6px 10px; border-bottom: 1px dashed var(--chy-ink-100, #f0f1f4); }
.ev-race td code { font-family: var(--font-mono); font-size: 11px; color: var(--color-text-muted); margin-left: 6px; }
.ev-race td.good { color: var(--chy-celadon-600, #2c8d68); font-weight: 600; }
.ev-race td.bad { color: var(--chy-rouge-600, #c44b3a); font-weight: 600; }
.ev-race tr.total-row td { background: var(--chy-ink-50, #f6f7f9); border-bottom: none; }

.ev-judge {
  background: var(--chy-violet-50, #f3effd);
  border: 1px solid var(--chy-violet-200, #d4cbf2);
  border-radius: 8px;
  padding: 12px 14px;
}
.ev-judge h3 { margin: 0 0 8px; font-size: 13px; }
.ev-judge-score { font-size: 13px; }
.ev-judge .hint { margin: 6px 0 0; font-size: 11px; color: var(--chy-amber-700, #a06800); }
.winner-tag { padding: 2px 8px; border-radius: 999px; font-weight: 600; font-size: 11px; }
.winner-tag.win-candidate { background: rgba(63, 174, 130, 0.15); color: var(--chy-celadon-700, #1f6e51); }
.winner-tag.win-baseline { background: rgba(196, 75, 58, 0.10); color: var(--chy-rouge-600, #c44b3a); }
.winner-tag.win-tie, .winner-tag.win-inconclusive { background: var(--chy-ink-100, #f0f1f4); color: var(--color-text-muted); }

.ev-actions { display: flex; gap: 8px; }
.ev-btn { padding: 6px 14px; border: 1px solid var(--chy-ink-200, #e6e8ec); background: transparent; border-radius: 6px; cursor: pointer; font-size: 12px; }
.ev-btn:hover:not(:disabled) { background: var(--chy-ink-50, #f6f7f9); }
.ev-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ev-btn.primary { background: var(--chy-violet-500, #7c6cdc); border-color: var(--chy-violet-500, #7c6cdc); color: #fff; }
.ev-btn.primary:disabled { opacity: 0.4; }
.ev-btn.link { border: none; color: var(--color-text-muted); }
.ev-btn.link:hover { color: var(--color-text-primary); text-decoration: underline; }
</style>
