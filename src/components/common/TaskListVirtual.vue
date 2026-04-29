<!--
  TaskListVirtual — 虚拟滚动任务列表(T-3.1)

  关键:
    - 只渲染 viewport 内 + 缓冲区(默认 ±10 项)
    - 按时间分组(今天 / 昨天 / 本周 / 本月 / 更早)
    - row 高度固定(60px)便于计算
    - 选中态(批量操作)
    - 状态色 + 收藏标
-->
<template>
  <div class="tlv-root" ref="scroller" @scroll="onScroll">
    <div class="tlv-spacer" :style="{ height: totalHeight + 'px' }">
      <div class="tlv-rendered" :style="{ transform: `translateY(${offsetY}px)` }">
        <template v-for="row in visibleRows" :key="row.key">
          <div v-if="row.kind === 'group'" class="tlv-group" :style="{ height: ROW_HEIGHT_GROUP + 'px' }">
            <span class="tlv-group-label">{{ row.label }}</span>
            <span class="tlv-group-count">{{ row.count }}</span>
          </div>
          <div
            v-else
            class="tlv-row"
            :class="[`status-${row.task.status}`, { selected: selectedIds.includes(row.task.id), focused: row.task.id === focusedId }]"
            :style="{ height: ROW_HEIGHT_TASK + 'px' }"
            @click="onRowClick(row.task, $event)"
          >
            <input
              type="checkbox"
              class="tlv-check"
              :checked="selectedIds.includes(row.task.id)"
              @click.stop
              @change="onSelect(row.task, $event.target.checked)"
            />
            <span class="tlv-status-dot" :class="`status-${row.task.status}`" />
            <span class="tlv-icon">{{ kindIcon(row.task.kind) }}</span>
            <div class="tlv-body">
              <div class="tlv-line1">
                <span class="tlv-title" :title="row.task.title">{{ row.task.title || '(无标题)' }}</span>
                <span v-if="row.task.starred" class="tlv-star">★</span>
              </div>
              <div class="tlv-line2">
                <span class="tlv-status-label">{{ statusLabel(row.task.status) }}</span>
                <span v-if="row.task.startedAt" class="tlv-time">· {{ formatTime(row.task.startedAt) }}</span>
                <span v-if="row.task.status === 'running' && row.task.progress > 0" class="tlv-progress">· {{ Math.round(row.task.progress * 100) }}%</span>
                <span v-if="row.task.error?.userMessage" class="tlv-error" :title="row.task.error.userMessage">· ⚠ {{ row.task.error.userMessage }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
    <div v-if="!tasks.length" class="tlv-empty">{{ emptyHint }}</div>
  </div>
</template>

<script>
const ROW_HEIGHT_TASK = 60
const ROW_HEIGHT_GROUP = 28
const BUFFER = 10

const STATUS_LABELS = {
  pending: '等待', queued: '排队', running: '执行中', paused: '已暂停',
  completed: '已完成', failed: '失败', cancelled: '已取消', archived: '已归档'
}
const KIND_ICONS = {
  assistant: '🤖', workflow: '⚙️', 'spell-check': '✓',
  multimodal: '🎨', evaluation: '📊', evolution: '🌱', custom: '·'
}

export default {
  name: 'TaskListVirtual',
  props: {
    tasks:      { type: Array, default: () => [] },
    selectedIds:{ type: Array, default: () => [] },
    focusedId:  { type: String, default: '' },
    height:     { type: [Number, String], default: 480 },
    emptyHint:  { type: String, default: '暂无任务' }
  },
  emits: ['select-toggle', 'task-click', 'select-range'],
  data() {
    return {
      scrollTop: 0,
      viewportHeight: 480,
      ROW_HEIGHT_TASK,
      ROW_HEIGHT_GROUP
    }
  },
  computed: {
    /** 把 tasks 按时间分组,展开成一个连续的 row 数组(group + tasks) */
    rows() {
      const buckets = { today: [], yesterday: [], week: [], month: [], earlier: [] }
      const now = Date.now()
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const startOfYesterday = startOfToday.getTime() - 86400000
      const startOfWeek = startOfToday.getTime() - 6 * 86400000
      const startOfMonth = startOfToday.getTime() - 29 * 86400000

      for (const t of this.tasks) {
        const ts = t.endedAt || t.startedAt || t.createdAt || 0
        if (ts >= startOfToday.getTime()) buckets.today.push(t)
        else if (ts >= startOfYesterday) buckets.yesterday.push(t)
        else if (ts >= startOfWeek) buckets.week.push(t)
        else if (ts >= startOfMonth) buckets.month.push(t)
        else buckets.earlier.push(t)
      }

      const labels = { today: '今天', yesterday: '昨天', week: '本周', month: '本月', earlier: '更早' }
      const out = []
      for (const key of ['today', 'yesterday', 'week', 'month', 'earlier']) {
        const list = buckets[key]
        if (!list.length) continue
        out.push({ kind: 'group', key: 'g_' + key, label: labels[key], count: list.length })
        for (const task of list) out.push({ kind: 'task', key: task.id, task })
      }
      return out
    },
    rowHeights() {
      return this.rows.map(r => r.kind === 'group' ? ROW_HEIGHT_GROUP : ROW_HEIGHT_TASK)
    },
    cumOffsets() {
      const out = [0]
      for (let i = 0; i < this.rowHeights.length; i++) {
        out.push(out[i] + this.rowHeights[i])
      }
      return out
    },
    totalHeight() {
      return this.cumOffsets[this.cumOffsets.length - 1] || 0
    },
    visibleRange() {
      const top = this.scrollTop
      const bottom = top + this.viewportHeight
      // 二分找 startIndex
      let start = 0
      let end = this.rows.length
      const co = this.cumOffsets
      // linear pass — rows 通常 < 1000 时性能足够
      for (let i = 0; i < co.length; i++) {
        if (co[i] >= top) { start = Math.max(0, i - 1 - BUFFER); break }
      }
      for (let i = start; i < co.length; i++) {
        if (co[i] >= bottom) { end = Math.min(this.rows.length, i + BUFFER); break }
      }
      return { start, end }
    },
    visibleRows() {
      const { start, end } = this.visibleRange
      return this.rows.slice(start, end)
    },
    offsetY() {
      return this.cumOffsets[this.visibleRange.start] || 0
    }
  },
  mounted() {
    this.measureViewport()
    window.addEventListener('resize', this.measureViewport)
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.measureViewport)
  },
  methods: {
    measureViewport() {
      const el = this.$refs.scroller
      if (el) this.viewportHeight = el.clientHeight || 480
    },
    onScroll() {
      const el = this.$refs.scroller
      if (el) this.scrollTop = el.scrollTop
    },
    onRowClick(task, e) {
      this.$emit('task-click', { task, shift: e.shiftKey, meta: e.ctrlKey || e.metaKey })
    },
    onSelect(task, checked) {
      this.$emit('select-toggle', { task, checked })
    },
    statusLabel(s) { return STATUS_LABELS[s] || s },
    kindIcon(k)    { return KIND_ICONS[k] || '·' },
    formatTime(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      const now = new Date()
      const sameDay = d.toDateString() === now.toDateString()
      const pad = n => String(n).padStart(2, '0')
      if (sameDay) return `${pad(d.getHours())}:${pad(d.getMinutes())}`
      return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
  }
}
</script>

<style scoped>
.tlv-root {
  position: relative;
  overflow-y: auto;
  height: 100%;
  font-family: var(--font-base);
  background: var(--color-bg-elevated, #fff);
}
.tlv-spacer { position: relative; }
.tlv-rendered { position: absolute; top: 0; left: 0; right: 0; }

.tlv-empty {
  padding: 60px 0;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
  font-style: italic;
}

/* group row */
.tlv-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--chy-ink-50, #f6f7f9);
  border-bottom: 1px solid var(--chy-ink-100, #f0f1f4);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-text-muted);
  letter-spacing: 0.04em;
}
.tlv-group-count {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
}

/* task row */
.tlv-row {
  display: grid;
  grid-template-columns: auto auto auto 1fr;
  gap: 10px;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid var(--chy-ink-100, #f0f1f4);
  cursor: pointer;
  transition: background 120ms;
}
.tlv-row:hover { background: var(--chy-ink-50, #f6f7f9); }
.tlv-row.selected { background: var(--chy-violet-100, #ebe7fa); }
.tlv-row.focused {
  outline: 2px solid var(--chy-violet-500, #7c6cdc);
  outline-offset: -2px;
}

.tlv-check { margin: 0; }
.tlv-status-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
}
.tlv-status-dot.status-pending  { background: var(--chy-ink-300, #c5c8cf); }
.tlv-status-dot.status-queued   { background: var(--chy-amber-500, #d4a017); }
.tlv-status-dot.status-running  { background: var(--chy-violet-500, #7c6cdc); animation: tlv-pulse 1.2s infinite; }
.tlv-status-dot.status-paused   { background: var(--chy-amber-500, #d4a017); }
.tlv-status-dot.status-completed{ background: var(--chy-celadon-500, #3fae82); }
.tlv-status-dot.status-failed   { background: var(--chy-rouge-500, #e26a58); }
.tlv-status-dot.status-cancelled{ background: var(--chy-ink-300, #c5c8cf); }
.tlv-status-dot.status-archived { background: var(--chy-ink-200, #e6e8ec); }
@keyframes tlv-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.4); } }

.tlv-icon { font-size: 14px; }

.tlv-body { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.tlv-line1 {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  min-width: 0;
}
.tlv-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tlv-star {
  color: var(--chy-amber-500, #d4a017);
  font-size: 12px;
}
.tlv-line2 {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  min-width: 0;
}
.tlv-status-label { color: var(--color-text-secondary); }
.tlv-time, .tlv-progress {}
.tlv-error {
  color: var(--chy-rouge-600, #c44b3a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
</style>
