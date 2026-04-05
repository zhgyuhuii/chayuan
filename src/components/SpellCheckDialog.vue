<template>
  <div class="spell-check-dialog">
    <div class="header">
      <div class="header-main">
        <div class="title-row">
          <h2>{{ mode === 'all' ? '拼写与语法检查' : '拼写与语法检查（选中）' }}</h2>
          <span class="status-badge" :class="statusBadgeClass">{{ statusBadgeText }}</span>
        </div>
        <p class="header-subtitle">任务可关闭提示窗继续执行，只有点击停止才会中止任务。</p>
      </div>
      <div class="header-actions">
        <button
          v-if="task && task.status === 'running'"
          type="button"
          class="btn-stop"
          @click="stopTask"
        >停止任务</button>
        <button type="button" class="btn-close" @click="closeWindow">关闭</button>
      </div>
    </div>
    <div class="body">
      <div class="progress-meta">
        <div class="progress-text" :class="{ error: status === 'error' }">
          <span v-if="status === 'starting'">正在创建任务...</span>
          <span v-else-if="status === 'running'">{{ total > 0 ? '正在检查：第 ' + current + ' / ' + total + ' 段' : '正在初始化...' }}</span>
          <span v-else-if="status === 'done'">已完成，共添加 {{ commentCount }} 处批注</span>
          <span v-else-if="status === 'cancelled'">任务已停止</span>
          <span v-else-if="status === 'abnormal'">{{ errorMsg || '任务异常结束' }}</span>
          <span v-else-if="status === 'error'">{{ errorMsg }}</span>
        </div>
        <div class="progress-percent">{{ progressPercent }}%</div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <div v-if="currentContent" class="preview-card">
        <div class="preview-label">当前检查内容</div>
        <div class="preview-content">{{ currentContent }}</div>
      </div>
      <div class="task-footer">
        <p class="task-list-hint">可在「任务清单」中查看详细进度；关闭此提示窗不会停止任务。</p>
        <span v-if="status === 'done'" class="auto-close-hint">即将自动关闭</span>
      </div>
    </div>
  </div>
</template>

<script>
import { initSync, subscribe, getTaskById, syncTasksFromStorage, updateTask } from '../utils/taskListStore.js'
import { stopSpellCheckTask } from '../utils/spellCheckService.js'
import { getSpellCheckTaskBridge } from '../utils/spellCheckTaskBridge.js'

export default {
  name: 'SpellCheckDialog',
  computed: {
    mode() {
      return this.$route?.query?.mode === 'selection' ? 'selection' : 'all'
    },
    progressPercent() {
      if (this.task?.progress != null) return Number(this.task.progress || 0)
      if (this.total <= 0) return this.status === 'starting' ? 5 : 0
      return Math.round((this.current / this.total) * 100)
    },
    statusBadgeText() {
      if (this.status === 'done') return '已完成'
      if (this.status === 'error') return '失败'
      if (this.status === 'abnormal') return '异常结束'
      if (this.status === 'cancelled') return '已停止'
      if (this.status === 'running') return '进行中'
      return '准备中'
    },
    statusBadgeClass() {
      if (this.status === 'done') return 'done'
      if (this.status === 'error') return 'error'
      if (this.status === 'abnormal') return 'abnormal'
      if (this.status === 'cancelled') return 'cancelled'
      if (this.status === 'running') return 'running'
      return 'loading'
    }
  },
  data() {
    return {
      taskId: '',
      task: null,
      status: 'starting',
      current: 0,
      total: 0,
      commentCount: 0,
      currentContent: '',
      errorMsg: '',
      unsub: null,
      pollTimer: null,
      autoCloseTimer: null
    }
  },
  mounted() {
    initSync()
    this.unsub = subscribe(() => {
      if (!this.taskId) return
      this.syncTaskState()
    })
    this.start()
  },
  beforeUnmount() {
    this.unsub?.()
    this.stopPolling()
    this.clearAutoCloseTimer()
  },
  methods: {
    startPolling() {
      this.stopPolling()
      this.pollTimer = window.setInterval(() => {
        if (!this.taskId) return
        this.syncTaskState()
      }, 400)
    },
    stopPolling() {
      if (this.pollTimer) {
        window.clearInterval(this.pollTimer)
        this.pollTimer = null
      }
    },
    clearAutoCloseTimer() {
      if (this.autoCloseTimer) {
        window.clearTimeout(this.autoCloseTimer)
        this.autoCloseTimer = null
      }
    },
    scheduleAutoClose() {
      if (this.autoCloseTimer || this.status !== 'done') return
      this.autoCloseTimer = window.setTimeout(() => {
        this.closeWindow()
      }, 900)
    },
    syncTaskState() {
      const task = getTaskById(this.taskId)
      if (!task) return
      this.task = task
      this.current = Number(task.current || 0)
      this.total = Number(task.total || 0)
      this.commentCount = Number(task.data?.commentCount || 0)
      this.currentContent = String(task.data?.currentChunk || '')
      if (task.status === 'completed') {
        this.status = 'done'
        this.scheduleAutoClose()
        return
      }
      this.clearAutoCloseTimer()
      if (task.status === 'cancelled') {
        this.status = 'cancelled'
        this.errorMsg = task.error || '任务已停止'
        return
      }
      if (task.status === 'failed') {
        this.status = 'error'
        this.errorMsg = task.error || '检查失败'
        return
      }
      if (task.status === 'abnormal') {
        this.status = 'abnormal'
        this.errorMsg = task.error || '任务异常结束'
        return
      }
      this.status = task.status === 'running' ? 'running' : 'starting'
    },
    async start() {
      this.status = 'starting'
      this.current = 0
      this.total = 0
      this.commentCount = 0
      this.currentContent = ''
      this.errorMsg = ''
      try {
        const bridge = getSpellCheckTaskBridge()
        const result = bridge?.start
          ? bridge.start(this.mode)
          : null
        if (!result?.taskId) {
          throw new Error('任务启动失败，未能创建任务')
        }
        this.taskId = result.taskId
        this.syncTaskState()
        this.startPolling()
      } catch (e) {
        console.error('拼写检查失败:', e)
        this.status = 'error'
        this.errorMsg = e.message || '检查失败'
      }
    },
    stopTask() {
      if (!this.taskId) return
      const bridge = getSpellCheckTaskBridge()
      const ok = bridge?.stop ? bridge.stop(this.taskId) : stopSpellCheckTask(this.taskId)
      if (!ok) {
        const latest = getTaskById(this.taskId)
        if (latest && (latest.status === 'running' || latest.status === 'pending')) {
          updateTask(this.taskId, {
            status: 'abnormal',
            error: latest.error || '任务已结束或进程已退出，已标记为异常结束'
          })
          syncTasksFromStorage()
        }
        this.syncTaskState()
      }
    },
    closeWindow() {
      this.clearAutoCloseTimer()
      try {
        if (window.close) window.close()
      } catch (_) {}
    }
  }
}
</script>

<style scoped>
.spell-check-dialog {
  padding: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', sans-serif;
  min-width: 420px;
  color: #111827;
  background: #f6f8fb;
}
.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
}
.header-main {
  min-width: 0;
  flex: 1;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.header h2 {
  margin: 0;
  font-size: 17px;
  line-height: 1.3;
}
.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
}
.status-badge.running {
  color: #1d4ed8;
  background: #dbeafe;
  border-color: #bfdbfe;
}
.status-badge.done {
  color: #047857;
  background: #d1fae5;
  border-color: #a7f3d0;
}
.status-badge.error {
  color: #b91c1c;
  background: #fee2e2;
  border-color: #fecaca;
}
.status-badge.cancelled {
  color: #92400e;
  background: #fef3c7;
  border-color: #fde68a;
}
.status-badge.abnormal {
  color: #b45309;
  background: #fffbeb;
  border-color: #fcd34d;
}
.status-badge.loading {
  color: #4b5563;
  background: #f3f4f6;
  border-color: #e5e7eb;
}
.header-subtitle {
  margin: 6px 0 0 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.btn-close {
  min-height: 30px;
  padding: 0 10px;
  font-size: 12px;
  color: #374151;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
}
.btn-close:hover {
  background: #f9fafb;
}
.btn-stop {
  min-height: 30px;
  padding: 0 10px;
  font-size: 12px;
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #ef4444;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
}
.btn-stop:hover {
  background: #fee2e2;
}
.body {
  padding: 12px 14px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
}
.progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.progress-text {
  font-size: 13px;
  font-weight: 500;
  color: #111827;
  line-height: 1.5;
}
.progress-text.error {
  color: #ef4444;
}
.progress-percent {
  flex-shrink: 0;
  min-width: 44px;
  text-align: right;
  font-size: 12px;
  font-weight: 700;
  color: #1d4ed8;
}
.progress-bar {
  height: 8px;
  background: #edf2f7;
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 12px;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #60a5fa 0%, #2563eb 55%, #1d4ed8 100%);
  transition: width 0.3s;
}
.preview-card {
  margin-bottom: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f8fafc;
  overflow: hidden;
}
.preview-label {
  padding: 8px 10px 0;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 4px;
}
.preview-content {
  max-height: 120px;
  overflow-y: auto;
  padding: 0 10px 10px;
  background: transparent;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.55;
}
.task-footer {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.task-list-hint {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
}
.auto-close-hint {
  font-size: 12px;
  color: #047857;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 999px;
  padding: 3px 8px;
}
@media (max-width: 640px) {
  .header,
  .progress-meta {
    flex-direction: column;
    align-items: stretch;
  }
  .header-actions {
    justify-content: flex-start;
  }
  .progress-percent {
    text-align: left;
  }
  .task-footer {
    align-items: stretch;
  }
}
</style>
