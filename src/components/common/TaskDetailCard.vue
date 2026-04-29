<!--
  TaskDetailCard — 任务详情卡(T-2.3)

  设计:
    - 用户层错误优先(技术栈折叠)
    - 输出 max-width 720px 行长 ≤ 65 字符
    - 操作按钮:重跑(若 canRetry)/ 复制为 Markdown / 复制原文 / 重新写回 / 收藏

  Props:
    task   标准 task 对象(经 taskKernel.adaptTask 后)

  Emits:
    'retry' / 'rerun' / 'star-toggle' / 'rewriteBack'
-->
<template>
  <article class="tdc-root">
    <header class="tdc-head">
      <span class="tdc-status" :class="`status-${task.status}`">
        <span class="tdc-status-dot" />
        {{ statusLabel }}
      </span>
      <h2 class="tdc-title">{{ task.title || '(无标题)' }}</h2>
      <button
        class="tdc-star"
        :class="{ active: task.starred }"
        @click="$emit('star-toggle', task)"
        :aria-label="task.starred ? '取消收藏' : '收藏'"
        title="收藏"
      >{{ task.starred ? '★' : '☆' }}</button>
    </header>

    <p v-if="task.description" class="tdc-desc">{{ task.description }}</p>

    <!-- 关键 metadata -->
    <dl class="tdc-meta">
      <div><dt>类型</dt><dd>{{ kindLabel }}</dd></div>
      <div><dt>启动方</dt><dd>{{ starterLabel }}</dd></div>
      <div v-if="task.docPath"><dt>文档</dt><dd class="tdc-mono" :title="task.docPath">{{ shortenPath(task.docPath) }}</dd></div>
      <div><dt>开始</dt><dd>{{ formatTime(task.startedAt || task.createdAt) }}</dd></div>
      <div v-if="task.endedAt"><dt>结束</dt><dd>{{ formatTime(task.endedAt) }}</dd></div>
      <div v-if="durationMs"><dt>用时</dt><dd>{{ formatDur(durationMs) }}</dd></div>
      <div v-if="task.total > 1"><dt>子项</dt><dd>{{ task.current }}/{{ task.total }}</dd></div>
    </dl>

    <!-- 进度条(running 时) -->
    <div v-if="task.status === 'running'" class="tdc-progress">
      <div class="tdc-progress-track">
        <div class="tdc-progress-fill chy-shimmer-bar" :style="{ width: progressPct + '%' }"></div>
      </div>
      <span class="tdc-progress-label">{{ progressPct }}% · {{ task.stage || '处理中' }}</span>
    </div>

    <!-- 错误显示(分用户层 / 技术层) -->
    <section v-if="task.error" class="tdc-error">
      <div class="tdc-err-user">
        <span class="tdc-err-icon">⚠</span>
        <strong>{{ task.error.userMessage || task.error.message || '执行失败' }}</strong>
      </div>
      <details v-if="task.error.technicalMessage" class="tdc-err-tech">
        <summary>技术详情</summary>
        <pre class="tdc-err-pre">{{ task.error.technicalMessage }}{{ task.error.code ? '\n[code]: ' + task.error.code : '' }}</pre>
      </details>
    </section>

    <!-- 输出预览 -->
    <section v-if="task.outputPreview || task.output" class="tdc-output">
      <header class="tdc-output-head">
        <span>输出</span>
        <button class="tdc-link" @click="onCopyOutput">复制</button>
        <button class="tdc-link" @click="onCopyMarkdown">复制为 Markdown</button>
      </header>
      <pre class="tdc-output-pre">{{ task.outputPreview || formatOutput(task.output) }}</pre>
    </section>

    <!-- 标签 -->
    <div v-if="task.tags && task.tags.length" class="tdc-tags">
      <span v-for="t in task.tags" :key="t" class="tdc-tag">{{ t }}</span>
    </div>

    <!-- 操作 -->
    <footer class="tdc-actions">
      <button v-if="task.canRetry && (task.status === 'failed')" class="tdc-btn primary" @click="$emit('retry', task)">重试</button>
      <button v-if="task.status === 'completed'" class="tdc-btn" @click="$emit('rerun', task)">再次执行</button>
      <button v-if="task.output && task.status === 'completed'" class="tdc-btn" @click="$emit('rewriteBack', task)">重新写回文档</button>
      <button v-if="task.canCancel && (task.status === 'running' || task.status === 'queued')" class="tdc-btn warn" @click="$emit('cancel', task)">取消</button>
    </footer>
  </article>
</template>

<script>
const STATUS_LABELS = {
  pending: '等待中', queued: '排队中', running: '执行中', paused: '已暂停',
  completed: '已完成', failed: '失败', cancelled: '已取消', archived: '已归档'
}
const KIND_LABELS = {
  assistant: '助手任务', workflow: '工作流', 'spell-check': '拼写检查',
  multimodal: '多模态', evaluation: '评测', evolution: '进化', custom: '自定义'
}

export default {
  name: 'TaskDetailCard',
  props: {
    task: { type: Object, required: true }
  },
  emits: ['retry', 'rerun', 'star-toggle', 'rewriteBack', 'cancel'],
  computed: {
    statusLabel() {
      return STATUS_LABELS[this.task.status] || this.task.status
    },
    kindLabel() {
      return KIND_LABELS[this.task.kind] || this.task.kind || '—'
    },
    starterLabel() {
      const map = { user: '用户手动', system: '系统', scheduled: '定时', 'auto-evolution': '自动进化' }
      return map[this.task.starter] || this.task.starter || '—'
    },
    progressPct() {
      return Math.round((Number(this.task.progress) || 0) * 100)
    },
    durationMs() {
      if (!this.task.startedAt) return 0
      return (this.task.endedAt || Date.now()) - this.task.startedAt
    }
  },
  methods: {
    shortenPath(p) {
      if (!p) return ''
      if (p.length <= 50) return p
      return '...' + p.slice(-47)
    },
    formatTime(ts) {
      if (!ts) return '—'
      const d = new Date(ts)
      const pad = n => String(n).padStart(2, '0')
      return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    },
    formatDur(ms) {
      if (!ms) return '—'
      if (ms < 1000) return `${ms}ms`
      if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
      const m = Math.floor(ms / 60000)
      const s = Math.round((ms % 60000) / 1000)
      return `${m}m${s}s`
    },
    formatOutput(o) {
      if (o == null) return ''
      if (typeof o === 'string') return o.slice(0, 2000)
      try { return JSON.stringify(o, null, 2).slice(0, 2000) } catch { return String(o) }
    },
    async onCopyOutput() {
      const text = String(this.task.outputPreview || this.formatOutput(this.task.output))
      try { await navigator.clipboard.writeText(text) } catch (_) {}
    },
    async onCopyMarkdown() {
      const md = [
        `## ${this.task.title}`,
        `**类型**: ${this.kindLabel} · **状态**: ${this.statusLabel}`,
        '',
        String(this.task.outputPreview || this.formatOutput(this.task.output))
      ].join('\n')
      try { await navigator.clipboard.writeText(md) } catch (_) {}
    }
  }
}
</script>

<style scoped>
.tdc-root {
  max-width: 720px;
  padding: 16px 20px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 10px;
  background: var(--color-bg-elevated, #fff);
  font-family: var(--font-base);
  color: var(--color-text-primary);
  line-height: 1.55;
}
.tdc-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.tdc-title {
  flex: 1;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.tdc-star {
  width: 28px; height: 28px;
  border: none; background: transparent;
  font-size: 18px; cursor: pointer;
  color: var(--chy-ink-300, #c5c8cf);
}
.tdc-star.active { color: var(--chy-amber-500, #d4a017); }

.tdc-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
}
.tdc-status-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.tdc-status.status-pending  { color: var(--color-text-muted); background: var(--chy-ink-100); }
.tdc-status.status-queued   { color: var(--chy-amber-700, #a06800); background: rgba(212, 160, 23, 0.12); }
.tdc-status.status-running  { color: var(--chy-violet-700, #5d4ec0); background: rgba(124, 108, 220, 0.12); }
.tdc-status.status-running .tdc-status-dot { animation: tdc-pulse 1.2s ease-in-out infinite; }
.tdc-status.status-paused   { color: var(--chy-amber-700, #a06800); background: rgba(212, 160, 23, 0.12); }
.tdc-status.status-completed{ color: var(--chy-celadon-700, #1f6e51); background: rgba(63, 174, 130, 0.12); }
.tdc-status.status-failed   { color: var(--chy-rouge-700, #a3392a); background: rgba(226, 106, 88, 0.12); }
.tdc-status.status-cancelled{ color: var(--color-text-muted); background: var(--chy-ink-100); }
@keyframes tdc-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

.tdc-desc {
  margin: 0 0 12px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.tdc-meta {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px 16px;
  margin: 0 0 14px;
  font-size: 12px;
}
.tdc-meta div { display: flex; gap: 6px; }
.tdc-meta dt { color: var(--color-text-muted); min-width: 50px; }
.tdc-meta dd { margin: 0; color: var(--color-text-primary); flex: 1; min-width: 0; word-break: break-all; }
.tdc-mono { font-family: var(--font-mono); font-size: 11px; }

.tdc-progress { margin-bottom: 14px; }
.tdc-progress-track {
  height: 4px;
  background: var(--chy-ink-100, #f0f1f4);
  border-radius: 2px;
  overflow: hidden;
}
.tdc-progress-fill {
  height: 100%;
  background: var(--chy-gradient-shimmer, linear-gradient(90deg, var(--chy-violet-400), var(--chy-violet-600)));
  transition: width 280ms;
}
.tdc-progress-label {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.tdc-error { margin-bottom: 14px; }
.tdc-err-user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(226, 106, 88, 0.08);
  border-left: 3px solid var(--chy-rouge-500, #e26a58);
  border-radius: 0 4px 4px 0;
  font-size: 13px;
  color: var(--chy-rouge-700, #a3392a);
}
.tdc-err-icon { font-size: 14px; }
.tdc-err-tech { margin-top: 6px; }
.tdc-err-tech summary { cursor: pointer; color: var(--color-text-muted); font-size: 11px; }
.tdc-err-pre {
  margin: 4px 0 0;
  padding: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--chy-ink-50, #f6f7f9);
  border-radius: 4px;
  white-space: pre-wrap;
  max-height: 180px;
  overflow-y: auto;
}

.tdc-output { margin-bottom: 14px; }
.tdc-output-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
}
.tdc-link {
  border: none;
  background: transparent;
  color: var(--chy-violet-600, #6f5fd0);
  font-size: 11px;
  cursor: pointer;
  padding: 0;
}
.tdc-link:hover { text-decoration: underline; }
.tdc-output-pre {
  margin: 0;
  padding: 10px 12px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  background: var(--chy-ink-50, #fafbfc);
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 320px;
  overflow-y: auto;
  color: var(--color-text-primary);
}

.tdc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 12px;
}
.tdc-tag {
  font-size: 10px;
  padding: 2px 8px;
  background: var(--chy-ink-100, #f0f1f4);
  color: var(--color-text-secondary);
  border-radius: 999px;
  font-family: var(--font-mono);
}

.tdc-actions {
  display: flex;
  gap: 6px;
  margin: 0;
  padding-top: 10px;
  border-top: 1px solid var(--chy-ink-100, #f0f1f4);
}
.tdc-btn {
  padding: 5px 14px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
.tdc-btn:hover { background: var(--chy-ink-50, #f6f7f9); }
.tdc-btn.primary {
  background: var(--chy-violet-500, #7c6cdc);
  border-color: var(--chy-violet-500, #7c6cdc);
  color: #fff;
}
.tdc-btn.primary:hover { background: var(--chy-violet-600, #6f5fd0); }
.tdc-btn.warn {
  color: var(--chy-rouge-600, #c44b3a);
  border-color: var(--chy-rouge-300, #f0bcb3);
}
.tdc-btn.warn:hover { background: var(--chy-rouge-50, #fdf3f1); }
</style>
