<!--
  AssistantHealthSparkline — 助手卡片右侧的 14 天健康分心电图

  数据来源:utils/assistant/evolution/raceEvaluator + signalStore 滚动窗口

  视觉:
    扩写  ▁▂▃▅▆▇▆▅▆▇▇▆▆▅  87  ↑
    保密  ▆▇▆▆▇▆▇▆▇▇▇▇▆▇  94  ─
    拼写  ▇▆▅▄▃▂▂▃▄▃▂▁▂▁  62  ↓ ⚠ 建议进化

  用法:
    <AssistantHealthSparkline
      :scores="[78, 80, 82, 79, ...]"  // 14 个数字,0-100
      :current-score="87"
      :trend="up"                       // 'up' | 'down' | 'flat'
      :advise-evolve="false"
      width="60"
      height="24"
    />
-->
<template>
  <div class="health-spark" :class="['trend-' + trend, scoreClass]">
    <svg
      v-if="hasData"
      :width="width"
      :height="height"
      :viewBox="`0 0 ${vbWidth} ${vbHeight}`"
      class="spark-svg"
      role="img"
      :aria-label="`14天健康分: ${currentScore},趋势${trendLabel}`"
    >
      <!-- 阈值参考线(浅色) -->
      <line
        :x1="0" :y1="thresholdY"
        :x2="vbWidth" :y2="thresholdY"
        class="spark-threshold"
      />
      <!-- 折线 -->
      <polyline
        :points="linePoints"
        fill="none"
        class="spark-line"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      <!-- 区域填充(渐变) -->
      <polyline
        :points="areaPoints"
        class="spark-area"
        stroke="none"
      />
      <!-- 末点高亮 -->
      <circle
        :cx="lastPoint.x" :cy="lastPoint.y"
        r="2"
        class="spark-dot"
      />
    </svg>
    <span v-else class="spark-empty">— —</span>
    <span class="spark-score">{{ currentScore || '—' }}</span>
    <span class="spark-trend" :title="trendLabel">{{ trendIcon }}</span>
    <span v-if="adviseEvolve" class="spark-advice" title="建议进化">⚠</span>
  </div>
</template>

<script>
export default {
  name: 'AssistantHealthSparkline',
  props: {
    scores:        { type: Array,  default: () => [] },
    currentScore:  { type: Number, default: 0 },
    trend:         { type: String, default: 'flat' },     // 'up' | 'down' | 'flat'
    adviseEvolve:  { type: Boolean, default: false },
    width:         { type: [Number, String], default: 60 },
    height:        { type: [Number, String], default: 24 },
    threshold:     { type: Number, default: 70 },          // 健康阈值参考线
    minVal:        { type: Number, default: 0 },
    maxVal:        { type: Number, default: 100 }
  },
  computed: {
    vbWidth()  { return Number(this.width)  || 60 },
    vbHeight() { return Number(this.height) || 24 },
    hasData() {
      return Array.isArray(this.scores) && this.scores.length >= 2
    },
    points() {
      if (!this.hasData) return []
      const n = this.scores.length
      const range = Math.max(1, this.maxVal - this.minVal)
      return this.scores.map((s, i) => {
        const x = (i / (n - 1)) * this.vbWidth
        const y = this.vbHeight - ((Number(s) - this.minVal) / range) * this.vbHeight
        return { x, y }
      })
    },
    linePoints() {
      return this.points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
    },
    areaPoints() {
      if (this.points.length === 0) return ''
      const head = `0,${this.vbHeight}`
      const tail = `${this.vbWidth},${this.vbHeight}`
      return [head, ...this.points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`), tail].join(' ')
    },
    lastPoint() {
      return this.points[this.points.length - 1] || { x: 0, y: 0 }
    },
    thresholdY() {
      const range = Math.max(1, this.maxVal - this.minVal)
      return this.vbHeight - ((this.threshold - this.minVal) / range) * this.vbHeight
    },
    scoreClass() {
      const s = Number(this.currentScore) || 0
      if (s >= 85) return 'score-good'
      if (s >= 70) return 'score-mid'
      return 'score-bad'
    },
    trendIcon() {
      if (this.trend === 'up')   return '↑'
      if (this.trend === 'down') return '↓'
      return '─'
    },
    trendLabel() {
      if (this.trend === 'up')   return '上升'
      if (this.trend === 'down') return '下降'
      return '平稳'
    }
  }
}
</script>

<style scoped>
.health-spark {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: var(--fz-12, 12px);
  color: var(--color-text-secondary);
}
.spark-svg {
  display: block;
  flex: 0 0 auto;
}
.spark-line {
  stroke-width: 1.4;
  stroke: currentColor;
  fill: none;
  transition: stroke var(--chy-motion-normal, 280ms);
}
.spark-area {
  fill: currentColor;
  opacity: 0.10;
}
.spark-threshold {
  stroke: var(--chy-ink-300);
  stroke-width: 0.6;
  stroke-dasharray: 2 2;
}
.spark-dot {
  fill: currentColor;
}
.spark-empty {
  font-style: italic;
  opacity: .5;
}
.spark-score {
  font-size: var(--fz-13, 13px);
  font-weight: 600;
  color: var(--color-text-primary);
  font-feature-settings: "tnum";
  min-width: 22px;
  text-align: right;
}
.spark-trend {
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  font-weight: 600;
}
.spark-advice {
  font-size: 13px;
  color: var(--chy-amber-500);
  animation: advice-pulse 2.4s ease-in-out infinite;
}

/* 分数色阶 */
.score-good { color: var(--chy-celadon-500); }
.score-mid  { color: var(--chy-amber-500); }
.score-bad  { color: var(--chy-rouge-500); }

/* 趋势细微动效 */
.trend-up    .spark-trend { color: var(--chy-celadon-500); }
.trend-down  .spark-trend { color: var(--chy-rouge-500); animation: shake .6s ease-in-out 1; }
.trend-flat  .spark-trend { color: var(--chy-ink-400); }

@keyframes advice-pulse {
  0%, 100% { transform: scale(1);   opacity: .9; }
  50%      { transform: scale(1.12); opacity: 1;  }
}
@keyframes shake {
  0%, 100% { transform: translateY(0); }
  30%      { transform: translateY(2px); }
  60%      { transform: translateY(-1px); }
}
</style>
