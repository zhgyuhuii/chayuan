<!--
  TaskFilters — 任务过滤栏(T-2.2)

  顶部 chip 风格过滤 + 搜索框 + 排序。
  Emits 'change'(filterState) 给父组件。
-->
<template>
  <div class="tf-root">
    <div class="tf-row">
      <button
        v-for="filter in FILTERS"
        :key="filter.key"
        class="tf-chip"
        :class="{ active: state.filter === filter.key }"
        @click="setFilter(filter.key)"
      >
        <span class="tf-chip-icon">{{ filter.icon }}</span>
        <span>{{ filter.label }}</span>
        <span v-if="counts[filter.key] != null" class="tf-chip-count">{{ counts[filter.key] }}</span>
      </button>
    </div>

    <div class="tf-row tf-row-tools">
      <input
        v-model="state.search"
        type="search"
        placeholder="搜索任务标题、错误、文档路径…"
        class="tf-search"
        @input="emitChange"
      />
      <select v-model="state.sort" class="tf-select" @change="emitChange">
        <option value="newest">最新优先</option>
        <option value="oldest">最旧优先</option>
        <option value="duration-desc">用时降序</option>
        <option value="duration-asc">用时升序</option>
        <option value="status">按状态</option>
      </select>
      <select v-model="state.kind" class="tf-select" @change="emitChange">
        <option value="">所有类型</option>
        <option value="assistant">助手</option>
        <option value="workflow">工作流</option>
        <option value="spell-check">拼写</option>
        <option value="multimodal">多模态</option>
        <option value="evolution">进化</option>
      </select>
      <button class="tf-clear" @click="reset">清空筛选</button>
    </div>
  </div>
</template>

<script>
const FILTERS = [
  { key: 'all',        label: '全部',     icon: '📋' },
  { key: 'running',    label: '进行中',   icon: '⟳' },
  { key: 'starred',    label: '已收藏',   icon: '★' },
  { key: 'failed',     label: '失败',     icon: '✗' },
  { key: 'completed',  label: '已完成',   icon: '✓' },
  { key: 'auto',       label: '自动触发', icon: '⚙' }
]

const DEFAULT_STATE = {
  filter: 'all',
  search: '',
  sort: 'newest',
  kind: ''
}

export default {
  name: 'TaskFilters',
  props: {
    counts: { type: Object, default: () => ({}) }   // { all: 12, running: 2, failed: 1, ... }
  },
  emits: ['change'],
  data() {
    return {
      state: { ...DEFAULT_STATE },
      FILTERS
    }
  },
  methods: {
    setFilter(key) {
      this.state.filter = key
      this.emitChange()
    },
    emitChange() {
      this.$emit('change', { ...this.state })
    },
    reset() {
      this.state = { ...DEFAULT_STATE }
      this.emitChange()
    }
  }
}
</script>

<style scoped>
.tf-root {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px;
  background: var(--color-bg-elevated, #fff);
  border-bottom: 1px solid var(--chy-ink-200, #e6e8ec);
  font-family: var(--font-base);
}
.tf-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.tf-row-tools { gap: 8px; }

.tf-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  transition: all 160ms;
  color: var(--color-text-secondary);
}
.tf-chip:hover { background: var(--chy-ink-50, #f6f7f9); }
.tf-chip.active {
  background: var(--chy-violet-500, #7c6cdc);
  border-color: var(--chy-violet-500, #7c6cdc);
  color: #fff;
}
.tf-chip-icon { font-size: 11px; }
.tf-chip-count {
  margin-left: 2px;
  font-size: 10px;
  font-family: var(--font-mono);
  padding: 0 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.08);
}
.tf-chip.active .tf-chip-count { background: rgba(255, 255, 255, 0.20); }

.tf-search {
  flex: 1;
  min-width: 220px;
  padding: 6px 10px;
  font-size: 12px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 6px;
  background: var(--color-bg-elevated, #fff);
  color: var(--color-text-primary);
}
.tf-search:focus {
  outline: none;
  border-color: var(--chy-violet-400, #a397e8);
}
.tf-select {
  padding: 6px 10px;
  font-size: 12px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 6px;
  background: var(--color-bg-elevated, #fff);
  color: var(--color-text-primary);
}
.tf-clear {
  padding: 6px 10px;
  font-size: 12px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: var(--color-text-muted);
}
.tf-clear:hover { background: var(--chy-ink-50, #f6f7f9); color: var(--color-text-primary); }
</style>
