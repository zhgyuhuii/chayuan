<!--
  CommandPalette — Raycast 风格 ⌘K 全局命令面板

  把 80+ 散落的操作收敛到一个搜索入口:
    - WPS 直接操作(保存/插表/字体/对齐...)
    - 智能助手(扩写/缩写/摘要/翻译...)
    - 任务(打开任务清单/编排)
    - 设置(模型/路径/助手...)
    - 历史会话快速跳转

  特性:
  - ⌘K / Ctrl+K 唤起,Esc 关闭
  - 模糊搜索(子序列匹配)
  - 上下键导航,Enter 执行
  - 键盘优先,鼠标兼容
  - 命令分组 + 快捷键提示
  - 最近使用置顶
-->
<template>
  <transition name="palette">
    <div
      v-if="visible"
      class="palette-overlay"
      role="presentation"
      @click.self="close"
    >
      <div
        class="palette"
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
      >
        <header class="palette-search">
          <span class="palette-icon" aria-hidden="true">🔍</span>
          <input
            ref="inputRef"
            v-model="query"
            class="palette-input"
            type="text"
            :placeholder="placeholder"
            spellcheck="false"
            autocomplete="off"
            @keydown="onKeydown"
          />
          <kbd class="palette-hint">esc</kbd>
        </header>

        <div v-if="filteredGroups.length === 0" class="palette-empty">
          没有匹配的命令
        </div>

        <ul
          v-else
          class="palette-list"
          ref="listRef"
          role="listbox"
        >
          <template v-for="group in filteredGroups" :key="group.label">
            <li class="palette-group-label">{{ group.label }}</li>
            <li
              v-for="(cmd, i) in group.items"
              :key="cmd.id"
              :class="['palette-item', { active: cmd._index === activeIndex }]"
              role="option"
              :aria-selected="cmd._index === activeIndex"
              @mouseenter="activeIndex = cmd._index"
              @click="execute(cmd)"
            >
              <span class="palette-item-icon">{{ cmd.icon || '·' }}</span>
              <span class="palette-item-text">
                <span class="palette-item-title">{{ cmd.title }}</span>
                <span v-if="cmd.subtitle" class="palette-item-subtitle">
                  {{ cmd.subtitle }}
                </span>
              </span>
              <span v-if="cmd.shortcut" class="palette-item-shortcut">
                <kbd v-for="(k, kIdx) in cmd.shortcut.split('+')" :key="kIdx">{{ k }}</kbd>
              </span>
              <span v-else-if="cmd._lastUsed" class="palette-item-meta">{{ cmd._lastUsed }}</span>
            </li>
          </template>
        </ul>

        <footer class="palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> 导航</span>
          <span><kbd>↵</kbd> 执行</span>
          <span><kbd>esc</kbd> 关闭</span>
        </footer>
      </div>
    </div>
  </transition>
</template>

<script>
const RECENT_KEY = 'chayuan/v2/commandPaletteRecent'
const MAX_RECENT = 6

/**
 * 子序列模糊匹配:把 query 拆字符,看能否在 target 顺序出现。
 * 命中即评分(连续命中 + 头匹配 + 词首加成)
 */
function fuzzyScore(target, query) {
  if (!query) return 0
  const t = String(target || '').toLowerCase()
  const q = String(query || '').toLowerCase()
  if (!t) return -1
  if (t.includes(q)) return 1000 + (t.startsWith(q) ? 300 : 0)

  let ti = 0
  let qi = 0
  let consecutive = 0
  let score = 0
  while (ti < t.length && qi < q.length) {
    if (t[ti] === q[qi]) {
      consecutive++
      score += 10 + consecutive * 5
      qi++
    } else {
      consecutive = 0
    }
    ti++
  }
  return qi === q.length ? score : -1
}

function loadRecent() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch (_) {
    return []
  }
}
function saveRecent(list) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)))
  } catch (_) {}
}

function formatRelativeTime(ts) {
  const diff = Date.now() - Number(ts || 0)
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${Math.floor(diff / 86400000)} 天前`
}

export default {
  name: 'CommandPalette',
  props: {
    /**
     * 命令源数组,每条:
     * {
     *   id, title, subtitle?, icon?, group?,
     *   shortcut?, keywords?,
     *   handler: () => void
     * }
     */
    commands:    { type: Array,  default: () => [] },
    placeholder: { type: String, default: '搜索命令、助手或操作…' },
    /** 受控显示开关。也支持非受控模式(自带 ⌘K 监听) */
    show:        { type: Boolean, default: false },
    autoBind:    { type: Boolean, default: true }       // 自动绑定 ⌘K / Ctrl+K
  },
  emits: ['update:show', 'execute', 'close'],
  data() {
    return {
      visible: this.show,
      query: '',
      activeIndex: 0,
      recent: loadRecent()
    }
  },
  computed: {
    filteredGroups() {
      const q = this.query.trim()
      const recentMap = new Map(this.recent.map(r => [r.id, r]))

      const enriched = this.commands.map(c => {
        const used = recentMap.get(c.id)
        const haystack = [c.title, c.subtitle, ...(c.keywords || [])].join(' ')
        const score = q ? fuzzyScore(haystack, q) : (used ? 800 - this.recent.findIndex(r => r.id === c.id) : 0)
        return {
          ...c,
          _score: score,
          _lastUsed: used ? formatRelativeTime(used.usedAt) : ''
        }
      }).filter(c => c._score >= 0)

      enriched.sort((a, b) => b._score - a._score)

      // 没搜索时把"最近使用"列在最前
      const groups = new Map()
      if (!q && this.recent.length) {
        const recentItems = enriched
          .filter(c => recentMap.has(c.id))
          .slice(0, MAX_RECENT)
        if (recentItems.length) {
          groups.set('最近使用', recentItems)
        }
      }

      for (const c of enriched) {
        if (!q && groups.get('最近使用')?.includes(c)) continue
        const g = c.group || '操作'
        const arr = groups.get(g) || []
        arr.push(c)
        groups.set(g, arr)
      }

      // 给每个 cmd 编 _index,用于上下键导航
      let idx = 0
      const result = []
      for (const [label, items] of groups) {
        result.push({
          label,
          items: items.map(item => ({ ...item, _index: idx++ }))
        })
      }
      return result
    },
    flatList() {
      const out = []
      for (const g of this.filteredGroups) {
        for (const item of g.items) out.push(item)
      }
      return out
    }
  },
  watch: {
    show(v) {
      this.visible = v
      if (v) this.openInternal()
      else this.closeInternal()
    },
    query() {
      this.activeIndex = 0
    }
  },
  mounted() {
    if (this.autoBind) {
      window.addEventListener('keydown', this._onGlobalKey)
    }
  },
  beforeUnmount() {
    if (this.autoBind) {
      window.removeEventListener('keydown', this._onGlobalKey)
    }
  },
  methods: {
    open() {
      this.visible = true
      this.openInternal()
      this.$emit('update:show', true)
    },
    close() {
      this.visible = false
      this.closeInternal()
      this.$emit('update:show', false)
      this.$emit('close')
    },
    openInternal() {
      this.query = ''
      this.activeIndex = 0
      this.$nextTick(() => {
        this.$refs.inputRef?.focus()
      })
    },
    closeInternal() { /* placeholder for future */ },
    onKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        this.close()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        this.activeIndex = (this.activeIndex + 1) % Math.max(1, this.flatList.length)
        this.$nextTick(() => this.scrollToActive())
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const len = Math.max(1, this.flatList.length)
        this.activeIndex = (this.activeIndex - 1 + len) % len
        this.$nextTick(() => this.scrollToActive())
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = this.flatList[this.activeIndex]
        if (cmd) this.execute(cmd)
      }
    },
    scrollToActive() {
      const list = this.$refs.listRef
      if (!list) return
      const el = list.querySelector('.palette-item.active')
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'nearest' })
      }
    },
    execute(cmd) {
      // 记录最近使用
      const next = [{ id: cmd.id, usedAt: Date.now() },
        ...this.recent.filter(r => r.id !== cmd.id)
      ].slice(0, MAX_RECENT)
      this.recent = next
      saveRecent(next)

      this.$emit('execute', cmd)
      this.close()
      try {
        if (typeof cmd.handler === 'function') cmd.handler()
      } catch (e) {
        console.warn('CommandPalette execute fail:', e)
      }
    },
    _onGlobalKey(e) {
      const k = e.key?.toLowerCase()
      if ((e.metaKey || e.ctrlKey) && k === 'k') {
        e.preventDefault()
        if (this.visible) this.close()
        else this.open()
      }
    }
  }
}
</script>

<style scoped>
.palette-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  background: rgba(15, 17, 21, 0.42);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: var(--z-palette, 4000);
}
.palette {
  width: min(640px, 92vw);
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-card);
  border-radius: var(--r-4, 14px);
  box-shadow: var(--chy-elev-3);
  overflow: hidden;
  font-family: var(--font-ui);
}

.palette-search {
  display: flex;
  align-items: center;
  gap: var(--s-3, 12px);
  padding: var(--s-3, 12px) var(--s-4, 16px);
  border-bottom: 1px solid var(--color-border);
}
.palette-icon {
  font-size: 18px;
  color: var(--color-text-secondary);
}
.palette-input {
  flex: 1;
  border: 0;
  background: transparent;
  outline: none;
  font-size: var(--fz-15, 15px);
  color: var(--color-text-primary);
}
.palette-input::placeholder {
  color: var(--color-text-secondary);
}
.palette-hint, .palette-item-shortcut kbd, .palette-footer kbd {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--color-bg-subtle);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--r-1, 4px);
  padding: 1px 6px;
  line-height: 1.4;
}

.palette-list {
  flex: 1;
  margin: 0;
  padding: 4px 0;
  overflow: auto;
  list-style: none;
}
.palette-empty {
  padding: var(--s-5, 24px);
  text-align: center;
  color: var(--color-text-secondary);
  font-size: var(--fz-13, 13px);
}
.palette-group-label {
  padding: var(--s-2, 8px) var(--s-4, 16px) 4px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary);
}
.palette-item {
  display: flex;
  align-items: center;
  gap: var(--s-3, 12px);
  padding: 8px var(--s-4, 16px);
  cursor: pointer;
  transition: background var(--chy-motion-fast, 180ms);
}
.palette-item:hover,
.palette-item.active {
  background: var(--chy-brand-50);
}
.palette-item-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
  flex: 0 0 auto;
}
.palette-item-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.palette-item-title {
  font-size: var(--fz-14, 14px);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.palette-item-subtitle {
  font-size: var(--fz-12, 12px);
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.palette-item-shortcut {
  display: flex;
  gap: 3px;
  flex: 0 0 auto;
}
.palette-item-meta {
  font-size: 11px;
  color: var(--color-text-secondary);
  flex: 0 0 auto;
}

.palette-footer {
  display: flex;
  gap: var(--s-4, 16px);
  padding: var(--s-2, 8px) var(--s-4, 16px);
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-subtle);
  font-size: 11px;
  color: var(--color-text-secondary);
}
.palette-footer kbd { margin-right: 2px; }

/* 入场:scale + opacity + blur,macOS Spotlight 同款 */
.palette-enter-active, .palette-leave-active {
  transition: opacity var(--chy-motion-normal, 280ms);
}
.palette-enter-active .palette,
.palette-leave-active .palette {
  transition:
    transform var(--chy-motion-normal, 280ms) var(--chy-ease-out-spring),
    opacity   var(--chy-motion-normal, 280ms) var(--chy-ease-out);
}
.palette-enter-from, .palette-leave-to {
  opacity: 0;
}
.palette-enter-from .palette,
.palette-leave-to   .palette {
  transform: translateY(-12px) scale(0.96);
  opacity: 0;
}
</style>
