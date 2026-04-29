<!--
  MessageList — 助手对话框消息流(独立可复用版)

  v2 计划 P3「AIAssistantDialog 拆 6 子组件」第一刀。
  完全独立的 stub:不依赖 AIAssistantDialog 内部 state,通过 props 接收 messages。

  Props:
    messages         [{ id, role, content, timestamp, status?, error? }]
    isStreaming      boolean,有助手在流式生成
    streamingId      正在 stream 的 message id(配合 chy-thinking-cursor)
    showAvatars      显示头像(默认 true)
    autoScroll       自动滚到底(新消息或流式时;默认 true)

  Events:
    'message-click'(message)     点击单条消息
    'message-action'(action, message)    操作按钮(如复制 / 重生成 / 删除)

  Slots:
    bubble(message)              覆盖默认 bubble 渲染
    actions(message)             消息右侧操作区
    empty                        空状态
-->
<template>
  <div class="ml-root" :class="{ streaming: isStreaming }" @scroll="onScroll" ref="scroller">
    <slot v-if="!messages.length" name="empty">
      <div class="ml-empty">开始对话…</div>
    </slot>

    <div
      v-for="msg in messages"
      :key="msg.id"
      class="ml-msg"
      :class="[`role-${msg.role}`, { streaming: msg.id === streamingId, error: msg.status === 'error' }]"
      @click="$emit('message-click', msg)"
    >
      <div v-if="showAvatars" class="ml-avatar" :class="`role-${msg.role}`">
        <span>{{ avatarChar(msg) }}</span>
      </div>

      <div class="ml-bubble-wrap">
        <slot name="bubble" :message="msg">
          <div class="ml-bubble chy-bubble-in" :data-from="msg.role">
            <div class="ml-content">
              {{ msg.content }}<span v-if="msg.id === streamingId" class="chy-thinking-cursor"></span>
            </div>
            <div v-if="msg.error" class="ml-error">⚠ {{ msg.error }}</div>
            <div v-if="msg.timestamp" class="ml-time">{{ formatTime(msg.timestamp) }}</div>
          </div>
        </slot>

        <div v-if="$slots.actions" class="ml-actions">
          <slot name="actions" :message="msg" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MessageList',
  props: {
    messages:    { type: Array,  default: () => [] },
    isStreaming: { type: Boolean, default: false },
    streamingId: { type: String, default: '' },
    showAvatars: { type: Boolean, default: true },
    autoScroll:  { type: Boolean, default: true }
  },
  emits: ['message-click', 'message-action'],
  data() {
    return { _userScrolled: false }
  },
  watch: {
    messages: {
      handler() { this.maybeScrollToBottom() },
      flush: 'post'
    },
    isStreaming(val) {
      if (val) this.maybeScrollToBottom()
    }
  },
  mounted() { this.maybeScrollToBottom(true) },
  methods: {
    onScroll() {
      const el = this.$refs.scroller
      if (!el) return
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30
      this._userScrolled = !atBottom
    },
    maybeScrollToBottom(force = false) {
      if (!this.autoScroll && !force) return
      if (this._userScrolled && !force) return
      this.$nextTick(() => {
        const el = this.$refs.scroller
        if (el) el.scrollTop = el.scrollHeight
      })
    },
    avatarChar(msg) {
      if (msg.role === 'user') return '你'
      if (msg.role === 'system') return '系'
      if (msg.role === 'assistant') return msg.assistantIcon || '助'
      return '?'
    },
    formatTime(ts) {
      const d = new Date(ts)
      const pad = n => String(n).padStart(2, '0')
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
  }
}
</script>

<style scoped>
.ml-root {
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  padding: 12px 16px;
  font-family: var(--font-base);
}
.ml-empty { padding: 32px 0; text-align: center; color: var(--color-text-muted); font-size: 13px; }

.ml-msg {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: flex-start;
}
.ml-msg.role-user { grid-template-columns: 1fr auto; }
.ml-msg.role-user .ml-avatar { order: 2; }
.ml-msg.role-user .ml-bubble-wrap { order: 1; align-items: flex-end; }

.ml-avatar {
  width: 28px; height: 28px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600;
  background: var(--chy-ink-100, #f0f1f4);
  color: var(--color-text-muted);
  flex-shrink: 0;
}
.ml-avatar.role-user      { background: rgba(124, 108, 220, 0.15); color: var(--chy-violet-700, #5d4ec0); }
.ml-avatar.role-assistant { background: rgba(63, 174, 130, 0.15); color: var(--chy-celadon-700, #1f6e51); }
.ml-avatar.role-system    { background: rgba(212, 160, 23, 0.15); color: var(--chy-amber-700, #a06800); }

.ml-bubble-wrap { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ml-bubble {
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--color-bg-elevated, #fff);
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  font-size: 13px;
  line-height: 1.6;
  max-width: 80%;
  word-break: break-word;
}
.ml-msg.role-user .ml-bubble {
  background: var(--chy-violet-500, #7c6cdc);
  color: #fff;
  border-color: var(--chy-violet-500, #7c6cdc);
  border-top-right-radius: 4px;
}
.ml-msg.role-assistant .ml-bubble {
  border-top-left-radius: 4px;
}
.ml-msg.error .ml-bubble {
  border-color: var(--chy-rouge-500, #e26a58);
  background: rgba(226, 106, 88, 0.04);
}

.ml-content { white-space: pre-wrap; }
.ml-error { margin-top: 4px; font-size: 11px; color: var(--chy-rouge-600, #c44b3a); }
.ml-time {
  margin-top: 2px;
  font-size: 10px;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}
.ml-actions { display: flex; gap: 4px; margin-top: 2px; }
</style>
