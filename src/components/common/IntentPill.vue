<!--
  IntentPill — 输入框内的"意图预告标签"

  解决用户"按下回车前不知道会发生什么"的盲区。

  与 utils/router/localIntentClassifier.js 配合:
    <IntentPill
      :kind="classifyResult.kind"
      :sub-kind="classifyResult.subKind"
      :confidence="classifyResult.confidence"
      :user-locked="userLockedKind"
      @cycle="onTabCycle"
    />

  键盘:Tab 在三种意图间循环(对话 / 操作 / 助手)。
  五种 kind 映射到三档颜色:
    chat               → 灰
    document-operation → 青(brand)
    wps-capability     → 青
    generated-output   → 紫(violet)
    assistant-task     → 紫
-->
<template>
  <button
    type="button"
    class="intent-pill"
    :class="['kind-' + visualKind, { locked: !!userLocked }]"
    :title="tooltip"
    :aria-label="tooltip"
    @click="$emit('cycle')"
  >
    <span class="pill-icon" :aria-hidden="true">{{ display.icon }}</span>
    <span class="pill-text">{{ display.text }}</span>
    <span v-if="confidence === 'low'" class="pill-suffix">?</span>
    <span v-if="userLocked" class="pill-lock" :aria-hidden="true">🔒</span>
  </button>
</template>

<script>
const KIND_VISUAL = {
  chat:                 { visual: 'chat',     icon: '💬', text: '对话',           hint: '将作为普通对话回复'              },
  'document-operation': { visual: 'doc-op',   icon: '⚡', text: '操作',           hint: '将对当前文档执行操作'             },
  'wps-capability':     { visual: 'doc-op',   icon: '⚡', text: '操作',           hint: '将调用 WPS 原生能力'              },
  'generated-output':   { visual: 'gen',      icon: '✨', text: '生成',           hint: '将生成图 / 音 / 视频 / 报告'      },
  'assistant-task':     { visual: 'asst',     icon: '🤖', text: '助手',           hint: '将运行某个智能助手'                }
}

export default {
  name: 'IntentPill',
  props: {
    kind:       { type: String, default: 'chat' },
    subKind:    { type: String, default: '' },
    confidence: { type: String, default: 'medium' },     // 'high' | 'medium' | 'low'
    userLocked: { type: Boolean, default: false }        // 用户手动锁定意图 → 不要被规则覆盖
  },
  emits: ['cycle'],
  computed: {
    visualKind() {
      return (KIND_VISUAL[this.kind] || KIND_VISUAL.chat).visual
    },
    display() {
      const meta = KIND_VISUAL[this.kind] || KIND_VISUAL.chat
      // 如果有 subKind(具体助手名),把 subKind 拼到 text 后面
      const text = this.subKind
        ? `${meta.text} · ${this.formatSubKind(this.subKind)}`
        : meta.text
      return {
        icon: meta.icon,
        text,
        hint: meta.hint
      }
    },
    tooltip() {
      const lockHint = this.userLocked ? '(已锁定,Tab 解除)' : '(Tab 切换意图)'
      return `${this.display.hint}${lockHint}`
    }
  },
  methods: {
    formatSubKind(subKind) {
      // 把 'analysis.rewrite' / 'spell-check' 转成可读名
      const map = {
        'analysis.rewrite': '改写',
        'analysis.expand': '扩写',
        'analysis.abbreviate': '缩写',
        'analysis.polish': '润色',
        'analysis.formalize': '正式化',
        'analysis.simplify': '通俗化',
        'analysis.security-check': '保密检查',
        'analysis.extract-keywords': '关键词',
        'spell-check': '拼写检查',
        'summary': '摘要',
        'translate': '翻译',
        'text-to-image': '文转图',
        'text-to-video': '文转视频',
        'text-to-audio': '文转语音',
        'save-document': '保存',
        'insert-table': '插表格',
        'toggle-bold': '加粗',
        'set-font-size': '字号',
        'set-alignment': '对齐'
      }
      return map[subKind] || subKind
    }
  }
}
</script>

<style scoped>
.intent-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: var(--r-pill);
  font-size: var(--fz-12, 12px);
  font-family: var(--font-ui);
  line-height: 1.4;
  border: 1px solid transparent;
  cursor: pointer;
  user-select: none;
  background: var(--color-bg-subtle);
  color: var(--color-text-secondary);
  transition: background var(--chy-motion-fast, 180ms) var(--chy-ease-out),
              color var(--chy-motion-fast, 180ms) var(--chy-ease-out),
              transform var(--chy-motion-fast, 180ms) var(--chy-ease-out-spring);
  white-space: nowrap;
}
.intent-pill:hover {
  transform: scale(1.04);
}
.intent-pill:active {
  transform: scale(0.96);
}
.intent-pill.kind-chat {
  background: var(--chy-ink-100);
  color: var(--chy-ink-600);
}
.intent-pill.kind-doc-op {
  background: var(--chy-brand-50);
  color: var(--chy-brand-700);
}
.intent-pill.kind-gen {
  background: var(--chy-violet-100);
  color: var(--chy-violet-700);
}
.intent-pill.kind-asst {
  background: var(--chy-violet-100);
  color: var(--chy-violet-700);
}
.intent-pill.locked {
  border-color: currentColor;
  box-shadow: 0 0 0 2px rgba(74, 108, 247, .12);
}

.pill-icon  { font-size: 13px; }
.pill-text  { font-weight: 500; }
.pill-suffix {
  font-family: var(--font-mono);
  font-size: 10px;
  opacity: .6;
}
.pill-lock { font-size: 10px; opacity: .7; }

/* 切换时的形变(同款 Apple 系统 transition) */
.intent-pill {
  view-transition-name: intent-pill;
}
</style>
