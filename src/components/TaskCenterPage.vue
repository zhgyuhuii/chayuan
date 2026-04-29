<!--
  TaskCenterPage — 任务中心(T-5.1)

  /task-center 路由,集成所有任务组件:
    - 顶部 TaskFilters 过滤栏
    - 左侧 TaskListVirtual 虚拟滚动列表
    - 右侧 TaskDetailCard 详情卡
    - 底部浮动 TaskBatchActions

  数据源:taskListStore.getTasks() + taskTieredStorage.listColdTasks(按需)
  事件源:taskEventBus.onEvent
-->
<template>
  <div class="tc-page" :class="{ 'has-detail': !!focusedTask }">
    <header class="tc-head">
      <div>
        <h1>任务中心</h1>
        <p class="subtitle">所有助手 / 工作流 / 拼写 / 进化任务在此统一管理</p>
      </div>
      <div class="tc-head-actions">
        <button class="tc-btn primary" @click="onOpenOrchestration" title="把多助手 / 工作流串成流水线">⚙️ 任务编排</button>
        <button class="tc-btn" @click="onShowCapsule">📅 时间胶囊</button>
        <button class="tc-btn" @click="onShowAchievements">🏆 成就</button>
        <button class="tc-btn" @click="goBack">返回</button>
      </div>
    </header>

    <TaskFilters :counts="counts" @change="onFilterChange" />

    <main class="tc-body">
      <div class="tc-list">
        <TaskListVirtual
          :tasks="filteredTasks"
          :selected-ids="selectedIds"
          :focused-id="focusedTask?.id || ''"
          @task-click="onTaskClick"
          @select-toggle="onSelectToggle"
        />
      </div>

      <aside v-if="focusedTask" class="tc-detail">
        <button class="tc-detail-close" @click="focusedTask = null" aria-label="关闭">×</button>
        <TaskDetailCard
          :task="focusedTask"
          @retry="onRetry"
          @rerun="onRerun"
          @star-toggle="onStarToggle"
          @rewriteBack="onRewriteBack"
          @cancel="onCancel"
        />
      </aside>
    </main>

    <TaskBatchActions
      :selected-ids="selectedIds"
      :selected-tasks="selectedTasks"
      @star-toggle="onBatchStarToggle"
      @archive="onBatchArchive"
      @retry="onBatchRetry"
      @cancel="onBatchCancel"
      @delete="onBatchDelete"
      @clear="selectedIds = []"
    />

    <!-- 时间胶囊 modal -->
    <Teleport v-if="showCapsule" to="body">
      <div class="tc-modal-overlay" @click.self="showCapsule = false">
        <div class="tc-modal">
          <header><h2>时间胶囊</h2><button class="tc-detail-close" @click="showCapsule = false">×</button></header>
          <pre class="tc-capsule-md">{{ capsuleMarkdown || '生成中…' }}</pre>
          <footer><button class="tc-btn" @click="onCopyCapsule">复制为 Markdown</button></footer>
        </div>
      </div>
    </Teleport>

    <!-- 成就 modal -->
    <Teleport v-if="showAchievements" to="body">
      <div class="tc-modal-overlay" @click.self="showAchievements = false">
        <div class="tc-modal">
          <header><h2>成就 ({{ unlockedCount }} / {{ achievementsList.length }})</h2><button class="tc-detail-close" @click="showAchievements = false">×</button></header>
          <ul class="tc-ach-list">
            <li v-for="a in achievementsList" :key="a.id" :class="{ unlocked: a.unlocked }">
              <span class="tc-ach-icon">{{ a.icon }}</span>
              <div>
                <strong>{{ a.label }}</strong>
                <p>{{ a.detail }}</p>
              </div>
              <span v-if="a.unlocked" class="tc-ach-badge">✓</span>
            </li>
          </ul>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import TaskFilters from './common/TaskFilters.vue'
import TaskListVirtual from './common/TaskListVirtual.vue'
import TaskDetailCard from './common/TaskDetailCard.vue'
import TaskBatchActions from './common/TaskBatchActions.vue'

import { getTasks, subscribe, removeTask, updateTask } from '../utils/taskListStore.js'
import { adaptTask } from '../utils/task/taskKernel.js'
import { onEvent, emit } from '../utils/task/taskEventBus.js'
import { archiveMany } from '../utils/task/taskTieredStorage.js'
import { listAchievements } from '../utils/task/taskAchievement.js'
import { generateCapsule, renderCapsuleMarkdown } from '../utils/task/taskTimeCapsule.js'
import toast from '../utils/toastService.js'

export default {
  name: 'TaskCenterPage',
  components: { TaskFilters, TaskListVirtual, TaskDetailCard, TaskBatchActions },
  data() {
    return {
      rawTasks: [],
      filterState: { filter: 'all', search: '', sort: 'newest', kind: '' },
      selectedIds: [],
      focusedTask: null,
      showCapsule: false,
      showAchievements: false,
      capsuleMarkdown: '',
      achievementsList: []
    }
  },
  computed: {
    tasks() {
      return this.rawTasks.map(adaptTask).filter(Boolean)
    },
    counts() {
      const c = { all: this.tasks.length, running: 0, starred: 0, failed: 0, completed: 0, auto: 0 }
      for (const t of this.tasks) {
        if (t.status === 'running') c.running += 1
        if (t.starred) c.starred += 1
        if (t.status === 'failed') c.failed += 1
        if (t.status === 'completed') c.completed += 1
        if (['auto-evolution', 'scheduled', 'system'].includes(t.starter)) c.auto += 1
      }
      return c
    },
    filteredTasks() {
      const { filter, search, sort, kind } = this.filterState
      let result = [...this.tasks]
      // by filter
      switch (filter) {
        case 'running':   result = result.filter(t => t.status === 'running' || t.status === 'queued'); break
        case 'starred':   result = result.filter(t => t.starred); break
        case 'failed':    result = result.filter(t => t.status === 'failed'); break
        case 'completed': result = result.filter(t => t.status === 'completed'); break
        case 'auto':      result = result.filter(t => ['auto-evolution', 'scheduled', 'system'].includes(t.starter)); break
      }
      if (kind) result = result.filter(t => t.kind === kind)
      if (search) {
        const q = search.toLowerCase()
        result = result.filter(t => {
          return (t.title || '').toLowerCase().includes(q)
            || (t.docPath || '').toLowerCase().includes(q)
            || (t.error?.userMessage || '').toLowerCase().includes(q)
            || (t.error?.technicalMessage || '').toLowerCase().includes(q)
        })
      }
      // sort
      switch (sort) {
        case 'oldest':         result.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); break
        case 'duration-desc':  result.sort((a, b) => durationOf(b) - durationOf(a)); break
        case 'duration-asc':   result.sort((a, b) => durationOf(a) - durationOf(b)); break
        case 'status':         result.sort((a, b) => String(a.status).localeCompare(String(b.status))); break
        default:               result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      }
      return result
    },
    selectedTasks() {
      return this.filteredTasks.filter(t => this.selectedIds.includes(t.id))
    },
    unlockedCount() {
      return this.achievementsList.filter(a => a.unlocked).length
    }
  },
  mounted() {
    this.refresh()
    this._unsubStore = subscribe(() => this.refresh())
    this._unsubBus = onEvent(msg => {
      // 任务事件 → 自动刷新
      if (msg.eventType === 'task:progress') this.refresh()
      if (msg.eventType === 'task:completed' || msg.eventType === 'task:failed' || msg.eventType === 'task:cancelled') this.refresh()
    })
  },
  beforeUnmount() {
    this._unsubStore?.()
    this._unsubBus?.()
  },
  methods: {
    refresh() {
      try { this.rawTasks = getTasks() || [] } catch { this.rawTasks = [] }
    },
    onFilterChange(state) { this.filterState = state },
    onTaskClick({ task, shift, meta }) {
      if (shift || meta) {
        this.onSelectToggle({ task, checked: !this.selectedIds.includes(task.id) })
      } else {
        this.focusedTask = task
      }
    },
    onSelectToggle({ task, checked }) {
      if (checked) {
        if (!this.selectedIds.includes(task.id)) this.selectedIds = [...this.selectedIds, task.id]
      } else {
        this.selectedIds = this.selectedIds.filter(id => id !== task.id)
      }
    },
    onStarToggle(task) {
      try { updateTask(task.id, { starred: !task.starred }) } catch {}
      emit('task:starred', { taskId: task.id, kind: task.kind, starred: !task.starred })
    },
    onRetry(task) {
      toast.info('重试请求已发出', { detail: task.title })
      emit('task:retried', { taskId: task.id, kind: task.kind })
    },
    onRerun(task) {
      toast.info('再次执行请求已发出', { detail: task.title })
      emit('task:retried', { taskId: task.id, kind: task.kind })
    },
    onCancel(task) {
      toast.info('取消请求已发出', { detail: task.title })
      emit('task:cancelled', { taskId: task.id, kind: task.kind, reason: 'user-detail-cancel' })
    },
    onRewriteBack(task) {
      toast.info('重新写回请求', { detail: '由 caller 实现' })
    },
    onBatchStarToggle(ids) {
      for (const id of ids) {
        const t = this.rawTasks.find(x => x.id === id)
        if (t) updateTask(id, { starred: !t.starred })
      }
      this.selectedIds = []
    },
    async onBatchArchive(ids) {
      const items = this.tasks.filter(t => ids.includes(t.id))
      try { await archiveMany(items); ids.forEach(id => removeTask(id)) }
      catch (e) { toast.error('归档失败', { detail: String(e?.message || e) }); return }
      toast.success(`已归档 ${ids.length} 条任务`)
      this.selectedIds = []
    },
    onBatchRetry(ids) { toast.info(`重跑 ${ids.length} 条失败任务`) ; this.selectedIds = [] },
    onBatchCancel(ids) { toast.info(`取消 ${ids.length} 条运行中任务`); this.selectedIds = [] },
    onBatchDelete(ids) {
      ids.forEach(id => removeTask(id))
      toast.success(`已删除 ${ids.length} 条`)
      this.selectedIds = []
    },
    onOpenOrchestration() {
      try { this.$router.push('/task-orchestration') } catch (_) {
        if (typeof window !== 'undefined') {
          const base = window.location.href.split('#')[0]
          window.location.href = base + '#/task-orchestration'
        }
      }
    },
    async onShowCapsule() {
      this.showCapsule = true
      this.capsuleMarkdown = '生成中…'
      try {
        const c = await generateCapsule({ period: 'month', hotTasks: this.rawTasks })
        this.capsuleMarkdown = renderCapsuleMarkdown(c)
      } catch (e) {
        this.capsuleMarkdown = '生成失败:' + (e?.message || e)
      }
    },
    async onCopyCapsule() {
      try { await navigator.clipboard.writeText(this.capsuleMarkdown); toast.success('已复制') }
      catch { toast.error('复制失败') }
    },
    onShowAchievements() {
      this.showAchievements = true
      this.achievementsList = listAchievements()
    },
    goBack() {
      if (window.history.length > 1) window.history.back()
      else this.$router.push('/')
    }
  }
}

function durationOf(t) {
  return (t.endedAt || Date.now()) - (t.startedAt || 0)
}
</script>

<style scoped>
.tc-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: var(--font-base);
  color: var(--color-text-primary);
}
.tc-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 18px 24px 12px;
  border-bottom: 1px solid var(--chy-ink-200, #e6e8ec);
}
.tc-head h1 { margin: 0 0 4px; font-size: 22px; font-weight: 700; }
.tc-head .subtitle { margin: 0; font-size: 13px; color: var(--color-text-secondary); }
.tc-head-actions { display: flex; gap: 6px; }
.tc-btn {
  padding: 6px 12px;
  font-size: 12px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
}
.tc-btn:hover { background: var(--chy-ink-50, #f6f7f9); }
.tc-btn.primary {
  background: var(--chy-violet-500, #7c6cdc);
  border-color: var(--chy-violet-500, #7c6cdc);
  color: #fff;
}
.tc-btn.primary:hover { background: var(--chy-violet-600, #6f5fd0); }

.tc-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr;
  min-height: 0;
}
.tc-page.has-detail .tc-body {
  grid-template-columns: 1fr min(720px, 50vw);
}
.tc-list { min-height: 0; overflow: hidden; }
.tc-detail {
  position: relative;
  border-left: 1px solid var(--chy-ink-200, #e6e8ec);
  background: var(--chy-ink-50, #fafbfc);
  overflow-y: auto;
  padding: 16px;
}
.tc-detail-close {
  position: absolute;
  top: 8px; right: 8px;
  width: 28px; height: 28px;
  border: none; background: transparent;
  font-size: 18px; cursor: pointer;
  border-radius: 4px;
  color: var(--color-text-muted);
}
.tc-detail-close:hover { background: var(--chy-ink-100); color: var(--color-text-primary); }

/* modal */
.tc-modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 9998;
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(3px);
}
.tc-modal {
  background: var(--color-bg-elevated, #fff);
  border-radius: 12px;
  width: min(640px, 92vw);
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.18);
}
.tc-modal header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--chy-ink-100);
}
.tc-modal header h2 { margin: 0; font-size: 16px; font-weight: 600; }
.tc-modal footer {
  padding: 12px 20px;
  border-top: 1px solid var(--chy-ink-100);
  text-align: right;
}
.tc-capsule-md {
  margin: 0; padding: 16px 20px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-y: auto;
  background: var(--chy-ink-50, #fafbfc);
}
.tc-ach-list {
  list-style: none; padding: 0; margin: 0;
  overflow-y: auto;
  flex: 1;
}
.tc-ach-list li {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid var(--chy-ink-100);
  opacity: 0.45;
}
.tc-ach-list li.unlocked { opacity: 1; }
.tc-ach-icon { font-size: 24px; }
.tc-ach-list strong { font-size: 13px; }
.tc-ach-list p { margin: 2px 0 0; font-size: 11px; color: var(--color-text-muted); }
.tc-ach-badge {
  margin-left: auto;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: var(--chy-celadon-500, #3fae82);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700;
}
</style>
