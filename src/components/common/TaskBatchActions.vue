<!--
  TaskBatchActions — 任务批量操作工具栏(T-2.4)

  当任务列表选中 ≥1 项时浮起,提供:
    - 删除选中
    - 归档选中(移到 cold 存储)
    - 收藏 / 取消收藏选中
    - 导出 JSON
    - 重跑失败的(若选中含 failed)
    - 全部取消(若选中含 running/queued)
-->
<template>
  <transition name="tba">
    <div v-if="selectedIds.length > 0" class="tba-root">
      <span class="tba-count">已选 {{ selectedIds.length }}</span>
      <button class="tba-btn" @click="$emit('star-toggle', selectedIds)">★ 收藏</button>
      <button class="tba-btn" @click="$emit('archive', selectedIds)">📦 归档</button>
      <button v-if="hasRetryable" class="tba-btn" @click="$emit('retry', selectedIds)">🔁 重跑失败</button>
      <button v-if="hasCancelable" class="tba-btn warn" @click="$emit('cancel', selectedIds)">✕ 取消运行中</button>
      <button class="tba-btn" @click="onExport">⬇ 导出 JSON</button>
      <button class="tba-btn warn" @click="$emit('delete', selectedIds)">🗑 删除</button>
      <button class="tba-btn ghost" @click="$emit('clear')">取消选择</button>
    </div>
  </transition>
</template>

<script>
import toast from '../../utils/toastService.js'

export default {
  name: 'TaskBatchActions',
  props: {
    selectedIds: { type: Array,  default: () => [] },
    selectedTasks: { type: Array, default: () => [] }   // 完整 task 对象,用于判断状态
  },
  emits: ['star-toggle', 'archive', 'retry', 'cancel', 'delete', 'clear'],
  computed: {
    hasRetryable() {
      return this.selectedTasks.some(t => t?.status === 'failed' && t?.canRetry !== false)
    },
    hasCancelable() {
      return this.selectedTasks.some(t => ['running', 'queued', 'paused'].includes(t?.status))
    }
  },
  methods: {
    onExport() {
      const json = JSON.stringify(this.selectedTasks, null, 2)
      navigator.clipboard?.writeText(json).then(
        () => toast.success(`${this.selectedTasks.length} 条任务已复制为 JSON`),
        e => toast.error('复制失败', { detail: String(e?.message || e) })
      )
    }
  }
}
</script>

<style scoped>
.tba-root {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-bg-elevated, #fff);
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.12);
  font-family: var(--font-base);
  font-size: 12px;
}
.tba-count {
  padding: 2px 10px;
  background: var(--chy-violet-500, #7c6cdc);
  color: #fff;
  border-radius: 999px;
  font-weight: 500;
}
.tba-btn {
  padding: 5px 12px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.tba-btn:hover { background: var(--chy-ink-50, #f6f7f9); }
.tba-btn.warn {
  color: var(--chy-rouge-600, #c44b3a);
  border-color: var(--chy-rouge-300, #f0bcb3);
}
.tba-btn.warn:hover { background: var(--chy-rouge-50, #fdf3f1); }
.tba-btn.ghost { border: none; color: var(--color-text-muted); }

.tba-enter-active, .tba-leave-active {
  transition: transform 240ms var(--chy-ease-out-spring, cubic-bezier(.34,1.56,.64,1)),
              opacity 240ms;
}
.tba-enter-from { transform: translateX(-50%) translateY(20px); opacity: 0; }
.tba-leave-to   { transform: translateX(-50%) translateY(20px); opacity: 0; }
</style>
