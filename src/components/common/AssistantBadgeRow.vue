<!--
  AssistantBadgeRow — 助手列表行通用组件

  视觉:
    [icon] 助手名                                                  ▏ 操作槽
            描述一句话(可选)
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            ▁▂▃▅▆▇  87↑   [doc-op]   ●灰度中

  组合关系:
    本组件 = 视觉壳 + AssistantHealthSparkline + IntentPill + 进化徽章
    业务字段都通过 props 传入,不读 store / signalStore — 复用安全

  Props:
    assistant         { id, label, icon, description }   必填
    scores            number[]                       sparkline 数据(0-100)
    currentScore      number
    trend             'up' | 'down' | 'flat'
    adviseEvolve      boolean
    intent            'chat'|'doc-op'|'gen'|'asst'|''   ← IntentPill 的 kind,留空则不显示
    intentConfidence  'high'|'mid'|'low'
    evolutionState    'idle'|'shadowing'|'observing'|'rolled-back'
    evolutionVersion  string (短)
    selected          boolean   选中态(高亮边框)
    interactive       boolean   是否响应 hover / click(默认 true)
    compact           boolean   紧凑布局(省略描述行)

  Slots:
    actions           右侧操作区(按钮等)

  Emits:
    'click'           整行点击
    'open-evolution'  点击进化徽章
-->
<template>
  <div
    class="abr"
    :class="{
      selected,
      interactive,
      compact,
      [`evo-${evolutionState}`]: evolutionState && evolutionState !== 'idle'
    }"
    @click="interactive ? $emit('click', assistant) : null"
    role="button"
    :aria-pressed="selected"
    :tabindex="interactive ? 0 : -1"
  >
    <div class="abr-icon" :style="iconStyle">
      <span v-if="iconKind === 'emoji'">{{ assistant.icon }}</span>
      <span v-else-if="iconKind === 'text'">{{ initials }}</span>
      <img v-else :src="assistant.icon" :alt="assistant.label || ''" />
    </div>

    <div class="abr-body">
      <div class="abr-head">
        <span class="abr-name" :title="assistant.label">{{ assistant.label || assistant.id }}</span>
        <span v-if="assistant.shortLabel && assistant.shortLabel !== assistant.label" class="abr-short">
          {{ assistant.shortLabel }}
        </span>
        <IntentPill
          v-if="intent"
          :kind="intent"
          :confidence="intentConfidence"
          :compact="true"
        />
      </div>

      <div v-if="!compact && assistant.description" class="abr-desc">
        {{ assistant.description }}
      </div>

      <div class="abr-footer">
        <AssistantHealthSparkline
          v-if="hasScores"
          :scores="scores"
          :current-score="currentScore || 0"
          :trend="trend || 'flat'"
          :advise-evolve="!!adviseEvolve"
          :width="56"
          :height="22"
        />
        <span v-else class="abr-empty">暂无健康数据</span>

        <span
          v-if="evolutionState && evolutionState !== 'idle'"
          class="abr-evo"
          :class="`evo-${evolutionState}`"
          @click.stop="$emit('open-evolution', assistant)"
          :title="evolutionTitle"
        >
          <span class="abr-evo-dot" />
          {{ evolutionLabel }}
          <span v-if="evolutionVersion" class="abr-evo-ver">· {{ shortVersion }}</span>
        </span>
      </div>
    </div>

    <div class="abr-actions" @click.stop>
      <slot name="actions" />
    </div>
  </div>
</template>

<script>
import IntentPill from './IntentPill.vue'
import AssistantHealthSparkline from './AssistantHealthSparkline.vue'

const EVO_LABEL = {
  shadowing:    '灰度中',
  observing:    '观察中',
  'rolled-back': '已回滚'
}
const EVO_TITLE = {
  shadowing:    '候选版本灰度中,正在累积比对样本',
  observing:    '已晋升,7 天观察期',
  'rolled-back': '观察期内自动回滚到上一版'
}

export default {
  name: 'AssistantBadgeRow',
  components: { IntentPill, AssistantHealthSparkline },
  props: {
    assistant:        { type: Object, required: true },
    scores:           { type: Array,  default: () => [] },
    currentScore:     { type: Number, default: 0 },
    trend:            { type: String, default: 'flat' },
    adviseEvolve:     { type: Boolean, default: false },
    intent:           { type: String, default: '' },
    intentConfidence: { type: String, default: 'mid' },
    evolutionState:   { type: String, default: 'idle' },
    evolutionVersion: { type: String, default: '' },
    selected:         { type: Boolean, default: false },
    interactive:      { type: Boolean, default: true },
    compact:          { type: Boolean, default: false }
  },
  emits: ['click', 'open-evolution'],
  computed: {
    iconKind() {
      const v = String(this.assistant?.icon || '').trim()
      if (!v) return 'text'
      if (/^https?:|^\/|^\.\.?\/|\.png$|\.svg$|\.jpg$|\.webp$/i.test(v)) return 'image'
      // 单字符或两个 unicode 视为 emoji
      if (Array.from(v).length <= 2) return 'emoji'
      return 'text'
    },
    initials() {
      const label = String(this.assistant?.label || this.assistant?.id || '?')
      const arr = Array.from(label).filter(c => c && c !== ' ')
      if (arr.length === 0) return '?'
      // 中文 → 取首字;英文 → 取首字母大写
      const first = arr[0]
      if (/[A-Za-z]/.test(first)) return (arr[0] + (arr[1] || '')).toUpperCase()
      return first
    },
    iconStyle() {
      const palette = ['#7c6cdc', '#3fae82', '#c08000', '#c44b3a', '#3b7fd9', '#c45c98']
      const seed = String(this.assistant?.id || this.assistant?.label || '')
      let hash = 0
      for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
      const color = palette[Math.abs(hash) % palette.length]
      return this.iconKind === 'image'
        ? {}
        : { background: `linear-gradient(135deg, ${color}22, ${color}44)`, color }
    },
    hasScores() {
      return Array.isArray(this.scores) && this.scores.length >= 2
    },
    evolutionLabel() {
      return EVO_LABEL[this.evolutionState] || ''
    },
    evolutionTitle() {
      return EVO_TITLE[this.evolutionState] || ''
    },
    shortVersion() {
      const v = String(this.evolutionVersion || '')
      if (v.length <= 12) return v
      return v.slice(0, 6) + '…' + v.slice(-4)
    }
  }
}
</script>

<style scoped>
.abr {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  background: var(--color-bg-elevated, #fff);
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 10px;
  transition: border-color 180ms, box-shadow 180ms, transform 180ms;
}
.abr.interactive {
  cursor: pointer;
}
.abr.interactive:hover {
  border-color: var(--chy-violet-300, #c4b9f0);
  box-shadow: 0 2px 8px rgba(124, 108, 220, 0.06);
}
.abr.interactive:active {
  transform: translateY(1px);
}
.abr.selected {
  border-color: var(--chy-violet-500, #7c6cdc);
  box-shadow: 0 0 0 2px rgba(124, 108, 220, 0.15);
}
.abr.compact { padding: 8px 10px; }

.abr.evo-shadowing  { border-left: 3px solid var(--chy-violet-500, #7c6cdc); }
.abr.evo-observing  { border-left: 3px solid var(--chy-amber-500, #d4a017); }
.abr.evo-rolled-back { opacity: 0.7; }

.abr-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  flex-shrink: 0;
  overflow: hidden;
}
.abr-icon img { width: 100%; height: 100%; object-fit: cover; }

.abr-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.abr-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.abr-name {
  font-size: var(--fz-14, 14px);
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.abr-short {
  font-size: var(--fz-11, 11px);
  color: var(--color-text-muted);
  background: var(--chy-ink-50, #f6f7f9);
  padding: 1px 6px;
  border-radius: 4px;
}

.abr-desc {
  font-size: var(--fz-12, 12px);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.abr-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
  font-size: var(--fz-12, 12px);
  flex-wrap: wrap;
}
.abr-empty {
  font-size: var(--fz-11, 11px);
  font-style: italic;
  color: var(--color-text-muted);
}

.abr-evo {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fz-11, 11px);
  padding: 2px 8px;
  border-radius: 999px;
  cursor: pointer;
  transition: background 160ms;
}
.abr-evo:hover { background: rgba(0, 0, 0, 0.04); }
.abr-evo-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}
.abr-evo.evo-shadowing { color: var(--chy-violet-600, #6f5fd0); }
.abr-evo.evo-shadowing .abr-evo-dot {
  background: var(--chy-violet-500, #7c6cdc);
  animation: abr-pulse 1.6s ease-in-out infinite;
}
.abr-evo.evo-observing { color: var(--chy-amber-600, #c08000); }
.abr-evo.evo-observing .abr-evo-dot {
  background: var(--chy-amber-500, #d4a017);
}
.abr-evo.evo-rolled-back { color: var(--chy-rouge-600, #c44b3a); }
.abr-evo.evo-rolled-back .abr-evo-dot {
  background: var(--chy-rouge-500, #e26a58);
}
.abr-evo-ver { color: var(--color-text-muted); font-family: var(--font-mono); }

@keyframes abr-pulse {
  0%, 100% { transform: scale(1);   opacity: 1; }
  50%      { transform: scale(1.4); opacity: 0.55; }
}

.abr-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
</style>
