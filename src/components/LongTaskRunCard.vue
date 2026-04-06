<template>
  <template v-if="run">
    <div v-if="mode === 'inline'">
      <div v-if="showActionBar" class="message-confirm-actions run-action-bar">
        <button
          v-if="showApply"
          type="button"
          class="run-icon-btn success"
          title="确认写回"
          aria-label="确认写回"
          @click.stop="$emit('apply')"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M9.55 18L3.85 12.3l1.4-1.4l4.3 4.3l9.2-9.2l1.4 1.4z"/></svg>
        </button>
        <button
          v-if="showStop && run.status === 'running'"
          type="button"
          class="run-icon-btn danger"
          title="停止处理"
          aria-label="停止处理"
          @click.stop="$emit('stop')"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M6 6h12v12H6z"/></svg>
        </button>
        <button
          v-if="showUndo"
          type="button"
          class="run-icon-btn"
          title="撤销本次改动"
          aria-label="撤销本次改动"
          @click.stop="$emit('undo')"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12.5 8A6.5 6.5 0 0 1 19 14.5A6.5 6.5 0 0 1 8.27 19.46l1.5-1.5A4.5 4.5 0 1 0 12.5 10H7.83l2.08 2.09L8.5 13.5L4 9l4.5-4.5l1.41 1.41L7.83 8z"/></svg>
        </button>
        <button
          v-if="showRetry"
          type="button"
          class="run-icon-btn"
          title="重新处理"
          aria-label="重新处理"
          @click.stop="$emit('retry')"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 5V2L7 7l5 5V9c3.31 0 6 2.69 6 6a6 6 0 0 1-10.24 4.24l-1.42 1.42A8 8 0 0 0 20 15c0-4.42-3.58-8-8-8"/></svg>
        </button>
        <button
          v-if="hasDetails || hasTaskDetail"
          type="button"
          class="run-icon-btn"
          :title="detailActionTitle"
          :aria-label="detailActionTitle"
          @click.stop="handleDetailClick"
        >
          <svg v-if="!run.showDetails || hasTaskDetail" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 5c5.5 0 9.5 4.5 10.5 6c-1 1.5-5 6-10.5 6S2.5 12.5 1.5 11C2.5 9.5 6.5 5 12 5m0 2C8.73 7 5.94 9.38 4.13 11C5.94 12.62 8.73 15 12 15s6.06-2.38 7.87-4C18.06 9.38 15.27 7 12 7m0 1.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 0 1 0-5"/></svg>
          <svg v-else viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M19 13H5v-2h14z"/></svg>
        </button>
      </div>
      <div v-if="run.showDetails && hasDetails" class="message-confirm-status">
        <div v-for="detail in run.details" :key="detail.id">{{ dlgText(detail.text) }}</div>
      </div>
      <label v-if="showBackupOption" class="run-backup-toggle">
        <input
          type="checkbox"
          :checked="run.backupEnabled === true"
          @change="$emit('toggle-backup', $event.target.checked)"
        />
        <span>{{ dlgText(run.backupLabel || '写回前备份源文件') }}</span>
      </label>
    </div>
    <div v-else class="message-confirm-card" :class="`is-${run.status || 'pending'}`">
      <div class="run-card-head">
        <div class="message-confirm-summary">
          {{ dlgText(summaryText) }}
        </div>
        <div v-if="showActionBar" class="run-action-bar">
          <button
            v-if="showApply"
            type="button"
            class="run-icon-btn success"
            title="确认写回"
            aria-label="确认写回"
            @click.stop="$emit('apply')"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M9.55 18L3.85 12.3l1.4-1.4l4.3 4.3l9.2-9.2l1.4 1.4z"/></svg>
          </button>
          <button
            v-if="showStop && run.status === 'running'"
            type="button"
            class="run-icon-btn danger"
            title="停止处理"
            aria-label="停止处理"
            @click.stop="$emit('stop')"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M6 6h12v12H6z"/></svg>
          </button>
          <button
            v-if="showUndo"
            type="button"
            class="run-icon-btn"
            title="撤销本次改动"
            aria-label="撤销本次改动"
            @click.stop="$emit('undo')"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12.5 8A6.5 6.5 0 0 1 19 14.5A6.5 6.5 0 0 1 8.27 19.46l1.5-1.5A4.5 4.5 0 1 0 12.5 10H7.83l2.08 2.09L8.5 13.5L4 9l4.5-4.5l1.41 1.41L7.83 8z"/></svg>
          </button>
          <button
            v-if="showRetry"
            type="button"
            class="run-icon-btn"
            title="重新处理"
            aria-label="重新处理"
            @click.stop="$emit('retry')"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 5V2L7 7l5 5V9c3.31 0 6 2.69 6 6a6 6 0 0 1-10.24 4.24l-1.42 1.42A8 8 0 0 0 20 15c0-4.42-3.58-8-8-8"/></svg>
          </button>
          <button
            v-if="hasDetails || hasTaskDetail"
            type="button"
            class="run-icon-btn"
            :title="detailActionTitle"
            :aria-label="detailActionTitle"
            @click.stop="handleDetailClick"
          >
            <svg v-if="!run.showDetails || hasTaskDetail" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 5c5.5 0 9.5 4.5 10.5 6c-1 1.5-5 6-10.5 6S2.5 12.5 1.5 11C2.5 9.5 6.5 5 12 5m0 2C8.73 7 5.94 9.38 4.13 11C5.94 12.62 8.73 15 12 15s6.06-2.38 7.87-4C18.06 9.38 15.27 7 12 7m0 1.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 0 1 0-5"/></svg>
            <svg v-else viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M19 13H5v-2h14z"/></svg>
          </button>
        </div>
      </div>
      <div v-if="run.statusMessage" class="message-confirm-status">
        {{ dlgText(run.statusMessage) }}
      </div>
      <div v-if="showProgressMeta" class="message-confirm-status run-progress-meta">
        <span v-if="showCurrentTotal">当前 {{ run.current }}/{{ run.total }}</span>
        <span v-if="showEta">{{ etaText }}</span>
      </div>
      <div v-if="showProgressBar" class="run-progress-bar" aria-hidden="true">
        <span class="run-progress-bar-fill" :style="{ width: `${progressPercent}%` }"></span>
      </div>
      <label v-if="showBackupOption" class="run-backup-toggle">
        <input
          type="checkbox"
          :checked="run.backupEnabled === true"
          @change="$emit('toggle-backup', $event.target.checked)"
        />
        <span>{{ dlgText(run.backupLabel || '写回前备份源文件') }}</span>
      </label>
      <div v-if="run.previewText" class="message-confirm-status run-preview-text">
        {{ dlgText(run.previewText) }}
      </div>
      <div v-if="hasMetaLines" class="message-confirm-status run-meta-lines">
        <div v-for="line in run.metaLines" :key="line">{{ dlgText(line) }}</div>
      </div>
      <div v-if="run.showDetails && hasDetails" class="message-confirm-status">
        <div v-for="detail in run.details" :key="detail.id">{{ dlgText(detail.text) }}</div>
      </div>
    </div>
  </template>
</template>

<script>
import { prepareDialogDisplayText } from '../utils/dialogTextDisplay.js'

export default {
  name: 'LongTaskRunCard',
  props: {
    run: {
      type: Object,
      default: null
    },
    summaryText: {
      type: String,
      default: ''
    },
    mode: {
      type: String,
      default: 'card'
    },
    showStop: {
      type: Boolean,
      default: true
    }
  },
  emits: ['stop', 'undo', 'retry', 'apply', 'toggle-details', 'open-task-detail', 'toggle-backup'],
  computed: {
    hasDetails() {
      return Array.isArray(this.run?.details) && this.run.details.length > 0
    },
    hasTaskDetail() {
      return !!String(this.run?.taskId || '').trim()
    },
    detailActionTitle() {
      if (this.hasTaskDetail) return '查看任务详情'
      return this.run?.showDetails ? '收起处理详情' : '查看处理详情'
    },
    showUndo() {
      return this.run?.canUndo === true
    },
    showRetry() {
      return this.run?.canRetry === true
    },
    showApply() {
      return this.run?.canApplyPlan === true
    },
    showBackupOption() {
      return this.run?.showBackupOption === true && this.showApply
    },
    showActionBar() {
      return this.showApply || (this.showStop && this.run?.status === 'running') || this.showUndo || this.showRetry || this.hasDetails || this.hasTaskDetail
    },
    hasMetaLines() {
      return Array.isArray(this.run?.metaLines) && this.run.metaLines.length > 0
    },
    progressPercent() {
      const value = Number(this.run?.progress || 0)
      if (!Number.isFinite(value)) return 0
      return Math.max(0, Math.min(100, value))
    },
    showCurrentTotal() {
      return Number(this.run?.total || 0) > 0
    },
    showProgressBar() {
      return this.progressPercent > 0 && this.run?.status === 'running'
    },
    showEta() {
      return Number(this.run?.estimatedRemainingMs || 0) > 0
    },
    etaText() {
      const ms = Number(this.run?.estimatedRemainingMs || 0)
      if (!Number.isFinite(ms) || ms <= 0) return ''
      const seconds = Math.max(1, Math.ceil(ms / 1000))
      return `预计剩余 ${seconds} 秒`
    },
    showProgressMeta() {
      return this.showCurrentTotal || this.showEta
    }
  },
  methods: {
    dlgText(value) {
      return prepareDialogDisplayText(value == null ? '' : String(value))
    },
    handleDetailClick() {
      if (this.hasTaskDetail) {
        this.$emit('open-task-detail')
        return
      }
      this.$emit('toggle-details')
    }
  }
}
</script>

<style scoped>
.run-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.run-action-bar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.run-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  color: #64748b;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.run-icon-btn:hover {
  color: #0f172a;
  border-color: rgba(59, 130, 246, 0.28);
  background: rgba(59, 130, 246, 0.08);
}

.run-icon-btn.danger {
  color: #dc2626;
}

.run-icon-btn.danger:hover {
  border-color: rgba(239, 68, 68, 0.28);
  background: rgba(239, 68, 68, 0.1);
}

.run-icon-btn.success {
  color: #16a34a;
}

.run-icon-btn.success:hover {
  border-color: rgba(34, 197, 94, 0.28);
  background: rgba(34, 197, 94, 0.1);
}

.run-icon-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);
}

.run-preview-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.run-progress-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.run-progress-bar {
  height: 6px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
  overflow: hidden;
}

.run-progress-bar-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #60a5fa 0%, #2563eb 100%);
}

.run-backup-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  color: #475569;
  font-size: 12px;
}

.run-backup-toggle input {
  margin: 0;
}
</style>
