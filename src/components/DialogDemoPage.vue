<!--
  DialogDemoPage — /dialog-demo 路由

  v2 计划 P2 项「主对话框三栏 + Selection Chip + Intent Pill + Diff 预演」
  实际接入 AIAssistantDialog.vue 风险过高(19111 行),这里改为
  独立 demo 路由:用 mock 数据展示三栏布局 + 4 个 P2 共用组件如何组合,
  开发者可以参考此页把组件接到自己的 dialog。

  布局:
    ┌─────────────────────────────────────────────────────────┐
    │ Header: 标题 + Selection Chip(显示当前选区元数据)     │
    ├──────────┬──────────────────────────┬─────────────────┤
    │ 左:历史 │ 中:消息流 + Diff 预演    │ 右:意图候选    │
    │ 助手列表 │   ↳ 当前 message 用 Diff │ Intent Pill 列  │
    │          │      Card 展示前后对比   │                 │
    └──────────┴──────────────────────────┴─────────────────┘
-->
<template>
  <div class="dd-page">
    <header class="dd-head">
      <div>
        <h1>对话框三栏 Demo</h1>
        <p class="subtitle">
          P2 共用组件 SelectionChip / IntentPill / DiffPreviewCard / AssistantBadgeRow 的组合示例
        </p>
      </div>
      <div class="dd-head-actions">
        <SelectionContextChip
          :kind="selection.kind"
          :preview="selection.preview"
          :length="selection.length"
        />
        <button class="dd-btn" @click="goBack">返回</button>
      </div>
    </header>

    <div class="dd-grid">
      <!-- 左侧:助手列表(用 P2 AssistantBadgeRow) -->
      <aside class="dd-left">
        <h3>已启用助手</h3>
        <AssistantBadgeRow
          v-for="a in assistants"
          :key="a.id"
          :assistant="a"
          :scores="a._scores"
          :current-score="a._scores[a._scores.length - 1]"
          :trend="a._trend"
          :advise-evolve="a._adviseEvolve"
          :evolution-state="a._evoState"
          :selected="a.id === activeId"
          :compact="true"
          @click="onSelectAssistant"
        />
      </aside>

      <!-- 中间:消息流 + Diff 预演 -->
      <main class="dd-center">
        <div class="dd-msg user">
          <div class="dd-msg-role">你</div>
          <div class="dd-msg-body">{{ userText }}</div>
        </div>

        <div class="dd-msg assistant">
          <div class="dd-msg-role">{{ activeAssistant?.label || '助手' }}</div>
          <div class="dd-msg-body">
            <p>已经准备好执行此次操作。下面是建议的修改预览:</p>
            <DiffPreviewCard
              :before-text="diff.before"
              :after-text="diff.after"
              title="建议修改"
              :show-actions="true"
              @accept="onAcceptDiff"
              @reject="onRejectDiff"
            />
          </div>
        </div>

        <div class="dd-composer">
          <textarea v-model="composerText" placeholder="试试输入一段话…" rows="3" />
          <button class="dd-btn primary" :disabled="!composerText.trim()" @click="onSend">发送</button>
        </div>
      </main>

      <!-- 右侧:意图候选 -->
      <aside class="dd-right">
        <h3>意图预测</h3>
        <p class="hint">本地分类器(localIntentClassifier)对当前输入的判定:</p>
        <div class="dd-intents">
          <IntentPill
            v-for="(intent, idx) in intentCandidates"
            :key="intent.kind + idx"
            :kind="intent.kind"
            :confidence="intent.confidence"
            :score="intent.score"
            @click="onPickIntent(intent)"
          />
        </div>
        <p class="hint">
          按 <kbd>Tab</kbd> 在候选间循环。高置信(score≥85)且 kind=chat 时,主链路会自动 shortcut。
        </p>
      </aside>
    </div>
  </div>
</template>

<script>
import SelectionContextChip from './common/SelectionContextChip.vue'
import IntentPill from './common/IntentPill.vue'
import DiffPreviewCard from './common/DiffPreviewCard.vue'
import AssistantBadgeRow from './common/AssistantBadgeRow.vue'
import { classifyIntent } from '../utils/router/localIntentClassifier.js'

export default {
  name: 'DialogDemoPage',
  components: { SelectionContextChip, IntentPill, DiffPreviewCard, AssistantBadgeRow },
  data() {
    return {
      composerText: '',
      userText: '请帮我把这一段写得更正式一些。',
      activeId: 'demo.rewriter',
      assistants: [
        {
          id: 'demo.rewriter', label: '风格改写', icon: '✍️', description: '把文本调整到指定语气',
          _scores: [78, 80, 82, 84, 85, 87, 88, 87, 88, 89, 88, 87, 88, 89],
          _trend: 'up', _adviseEvolve: false, _evoState: 'observing'
        },
        {
          id: 'demo.summarizer', label: '智能摘要', icon: '📋', description: '抽出 3-5 个关键要点',
          _scores: [72, 70, 68, 71, 70, 72, 73, 71, 72, 70, 71, 70, 71, 70],
          _trend: 'flat', _adviseEvolve: false, _evoState: 'idle'
        },
        {
          id: 'demo.spell', label: '拼写校对', icon: '✓', description: '识别错别字与标点误用',
          _scores: [88, 86, 82, 78, 75, 70, 68, 65, 62, 60, 58, 55, 52, 50],
          _trend: 'down', _adviseEvolve: true, _evoState: 'shadowing'
        }
      ],
      selection: {
        kind: 'paragraph',
        preview: '历史唯物主义是马克思主义哲学的重要组成部分,它揭示了人类社会发展的客观规律…',
        length: 187
      },
      diff: {
        before: '历史唯物主义是马克思主义哲学的重要组成部分,它揭示了人类社会发展的客观规律。',
        after:  '历史唯物主义作为马克思主义哲学的重要组成部分,深刻揭示了人类社会发展的客观规律。'
      }
    }
  },
  computed: {
    activeAssistant() {
      return this.assistants.find(a => a.id === this.activeId)
    },
    intentCandidates() {
      const text = this.composerText.trim() || this.userText
      const result = classifyIntent(text, { hasSelection: this.selection.length > 0 })
      const candidates = (result.allCandidates || [])
        .slice(0, 4)
        .map(c => ({
          kind: c.kind,
          score: c.score,
          confidence: c.score >= 85 ? 'high' : c.score >= 60 ? 'mid' : 'low'
        }))
      // 至少显示当前 winner
      if (candidates.length === 0) {
        candidates.push({ kind: result.kind || 'chat', score: result.score || 0, confidence: result.confidence || 'low' })
      }
      return candidates
    }
  },
  methods: {
    onSelectAssistant(a) { this.activeId = a.id },
    onSend() {
      if (this.composerText.trim()) {
        this.userText = this.composerText
        this.composerText = ''
      }
    },
    onAcceptDiff() { /* demo: no-op */ },
    onRejectDiff() { /* demo: no-op */ },
    onPickIntent(intent) {
      console.info('[demo] picked intent', intent)
    },
    goBack() {
      if (window.history.length > 1) window.history.back()
      else this.$router.push('/')
    }
  }
}
</script>

<style scoped>
.dd-page {
  max-width: 1280px;
  margin: 0 auto;
  padding: 20px 24px 60px;
  font-family: var(--font-base);
  color: var(--color-text-primary);
}
.dd-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--chy-ink-200, #e6e8ec);
}
.dd-head h1 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
.dd-head .subtitle { margin: 0; font-size: var(--fz-12, 12px); color: var(--color-text-secondary); }
.dd-head-actions { display: flex; align-items: center; gap: 8px; }

.dd-grid {
  display: grid;
  grid-template-columns: 240px 1fr 220px;
  gap: 16px;
  min-height: 560px;
}

.dd-left, .dd-right {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: var(--fz-12, 12px);
}
.dd-left h3, .dd-right h3 {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.dd-right .hint { font-size: 11px; color: var(--color-text-muted); margin: 4px 0; line-height: 1.5; }
.dd-right kbd {
  display: inline-flex;
  padding: 0 4px;
  font-size: 10px;
  font-family: var(--font-mono);
  background: rgba(0, 0, 0, 0.06);
  border-radius: 3px;
}
.dd-intents { display: flex; flex-direction: column; gap: 4px; }

.dd-center {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dd-msg {
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--color-bg-elevated, #fff);
  border: 1px solid var(--chy-ink-200, #e6e8ec);
}
.dd-msg.user { border-left: 3px solid var(--chy-violet-500, #7c6cdc); }
.dd-msg.assistant { border-left: 3px solid var(--chy-celadon-500, #3fae82); }
.dd-msg-role {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  margin-bottom: 4px;
}
.dd-msg-body { font-size: var(--fz-13, 13px); line-height: 1.5; }
.dd-msg-body p { margin: 0 0 8px; }

.dd-composer {
  display: flex;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 10px;
  background: var(--color-bg-elevated, #fff);
}
.dd-composer textarea {
  flex: 1;
  font: inherit;
  font-size: var(--fz-13, 13px);
  border: none;
  resize: vertical;
  outline: none;
  padding: 4px 6px;
  background: transparent;
  color: inherit;
}

.dd-btn {
  padding: 6px 12px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 6px;
  font-size: var(--fz-12, 12px);
  cursor: pointer;
}
.dd-btn:hover { background: var(--chy-ink-50, #f6f7f9); }
.dd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.dd-btn.primary {
  background: var(--chy-violet-500, #7c6cdc);
  color: #fff;
  border-color: var(--chy-violet-500, #7c6cdc);
}
</style>
