<!--
  MarketplacePage — /marketplace 路由

  统一展示 4 类助手,可搜索 + 按 group/source 过滤:
    - builtin     assistantRegistry 内置(spell-check / translate / summary 等)
    - extra       builtinAssistantsExtra(P3 的 8 个通用助手)
    - p5          builtinAssistantsP5(P5 的 8 个领域助手)
    - external    用户脚本通过 registerExternalAssistant 注册的

  纯展示页,不修改 customAssistants 仓库 — 用户启用某助手仍走原 SettingsDialog 流程。
  本页是「我现在能用哪些助手」的总览。
-->
<template>
  <div class="mp-page">
    <header class="mp-header">
      <div>
        <h1>助手市场</h1>
        <p class="subtitle">
          {{ stats.total }} 个助手 ·
          <span class="src builtin">内置 {{ stats.builtin }}</span> ·
          <span class="src extra">扩展 {{ stats.extra }}</span> ·
          <span class="src p5">领域 {{ stats.p5 }}</span> ·
          <span class="src external">第三方 {{ stats.external }}</span>
        </p>
      </div>
      <div class="mp-header-actions">
        <input
          v-model="query"
          class="mp-search"
          placeholder="搜索助手名 / 标签 / 描述…"
        />
        <select v-model="filterGroup" class="mp-select">
          <option value="">所有分组</option>
          <option v-for="g in groups" :key="g" :value="g">{{ g }}</option>
        </select>
        <select v-model="filterSource" class="mp-select">
          <option value="">所有来源</option>
          <option value="builtin">内置</option>
          <option value="extra">扩展</option>
          <option value="p5">领域</option>
          <option value="external">第三方</option>
        </select>
        <button class="mp-btn" @click="goBack">返回</button>
      </div>
    </header>

    <div v-if="!filtered.length" class="mp-empty">
      <p>没有匹配的助手。</p>
    </div>

    <main v-else class="mp-grid">
      <article
        v-for="a in filtered"
        :key="a.id"
        class="mp-card"
        :class="`src-${a._mpSource}`"
      >
        <div class="mp-card-head">
          <span class="mp-icon">{{ a.icon || '🧩' }}</span>
          <div class="mp-card-title">
            <div class="mp-name">{{ a.label || a.id }}</div>
            <div class="mp-id" :title="a.id">{{ a.id }}</div>
          </div>
          <span class="mp-src-tag" :class="`src-${a._mpSource}`">
            {{ sourceLabel(a._mpSource) }}
          </span>
        </div>
        <p v-if="a.description" class="mp-desc">{{ a.description }}</p>
        <div class="mp-meta">
          <span v-if="a.group" class="mp-tag">{{ a.group }}</span>
          <span v-if="a.defaultAction" class="mp-tag">动作:{{ a.defaultAction }}</span>
          <span v-if="a.defaultOutputFormat" class="mp-tag">输出:{{ a.defaultOutputFormat }}</span>
        </div>
      </article>
    </main>
  </div>
</template>

<script>
import { getBuiltinAssistants } from '../utils/assistantRegistry.js'
import { EXTRA_BUILTIN_ASSISTANTS } from '../utils/assistant/builtinAssistantsExtra.js'
import { P5_BUILTIN_ASSISTANTS } from '../utils/assistant/builtinAssistantsP5.js'
import { listExternalAssistants, subscribe } from '../utils/assistant/externalAssistants.js'

export default {
  name: 'MarketplacePage',
  data() {
    return {
      query: '',
      filterGroup: '',
      filterSource: '',
      externals: listExternalAssistants()
    }
  },
  computed: {
    /** 4 类合并后给每条打上 _mpSource 标签 */
    all() {
      const result = []

      const builtin = (() => {
        try { return getBuiltinAssistants() || [] } catch { return [] }
      })()
      const extraIds = new Set(EXTRA_BUILTIN_ASSISTANTS.map(a => a.id))
      const p5Ids = new Set(P5_BUILTIN_ASSISTANTS.map(a => a.id))

      for (const a of builtin) {
        // builtin 列表中可能已经合并了 extra/p5(取决于 caller)
        let src = 'builtin'
        if (extraIds.has(a.id)) src = 'extra'
        else if (p5Ids.has(a.id)) src = 'p5'
        result.push({ ...a, _mpSource: src })
      }
      // 补 extra/p5 中未在 builtin 出现的
      for (const a of EXTRA_BUILTIN_ASSISTANTS) {
        if (!result.find(x => x.id === a.id)) result.push({ ...a, _mpSource: 'extra' })
      }
      for (const a of P5_BUILTIN_ASSISTANTS) {
        if (!result.find(x => x.id === a.id)) result.push({ ...a, _mpSource: 'p5' })
      }
      for (const a of this.externals) {
        if (!result.find(x => x.id === a.id)) result.push({ ...a, _mpSource: 'external' })
      }

      return result
    },
    stats() {
      const s = { total: this.all.length, builtin: 0, extra: 0, p5: 0, external: 0 }
      for (const a of this.all) s[a._mpSource] = (s[a._mpSource] || 0) + 1
      return s
    },
    groups() {
      const set = new Set()
      for (const a of this.all) {
        if (a.group) set.add(a.group)
      }
      return Array.from(set).sort()
    },
    filtered() {
      const q = this.query.trim().toLowerCase()
      return this.all
        .filter(a => !this.filterGroup || a.group === this.filterGroup)
        .filter(a => !this.filterSource || a._mpSource === this.filterSource)
        .filter(a => {
          if (!q) return true
          const hay = [
            a.id, a.label, a.shortLabel, a.description, a.group,
            ...(Array.isArray(a.keywords) ? a.keywords : [])
          ].filter(Boolean).join(' ').toLowerCase()
          return hay.includes(q)
        })
    }
  },
  mounted() {
    this._unsubExt = subscribe(list => { this.externals = list })
  },
  beforeUnmount() {
    this._unsubExt?.()
  },
  methods: {
    sourceLabel(src) {
      return ({ builtin: '内置', extra: '扩展', p5: '领域', external: '第三方' })[src] || src
    },
    goBack() {
      if (window.history.length > 1) window.history.back()
      else this.$router.push('/')
    }
  }
}
</script>

<style scoped>
.mp-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 28px 80px;
  font-family: var(--font-base);
  color: var(--color-text-primary);
}
.mp-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  flex-wrap: wrap;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--chy-ink-200, #e6e8ec);
}
.mp-header h1 { margin: 0 0 4px; font-size: 22px; font-weight: 700; }
.mp-header .subtitle {
  margin: 0;
  font-size: var(--fz-13, 13px);
  color: var(--color-text-secondary);
}
.mp-header .src.builtin { color: var(--color-text-primary); font-weight: 600; }
.mp-header .src.extra { color: var(--chy-violet-600, #6f5fd0); }
.mp-header .src.p5 { color: var(--chy-celadon-600, #2c8d68); }
.mp-header .src.external { color: var(--chy-amber-600, #c08000); }

.mp-header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.mp-search, .mp-select {
  font: inherit;
  font-size: var(--fz-13, 13px);
  padding: 6px 10px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 6px;
  background: var(--color-bg-elevated, #fff);
  color: var(--color-text-primary);
}
.mp-search { min-width: 220px; }
.mp-search:focus, .mp-select:focus {
  outline: none;
  border-color: var(--chy-violet-400, #a397e8);
}
.mp-btn {
  padding: 6px 12px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 6px;
  font-size: var(--fz-13, 13px);
  cursor: pointer;
}
.mp-btn:hover { background: var(--chy-ink-50, #f6f7f9); }

.mp-empty {
  padding: 64px 0;
  text-align: center;
  color: var(--color-text-muted);
}

.mp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.mp-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 10px;
  background: var(--color-bg-elevated, #fff);
  transition: border-color 160ms, box-shadow 160ms;
}
.mp-card:hover {
  border-color: var(--chy-violet-300, #c4b9f0);
  box-shadow: 0 2px 8px rgba(124, 108, 220, 0.06);
}
.mp-card.src-extra    { border-left: 3px solid var(--chy-violet-500, #7c6cdc); }
.mp-card.src-p5       { border-left: 3px solid var(--chy-celadon-500, #3fae82); }
.mp-card.src-external { border-left: 3px solid var(--chy-amber-500, #d4a017); }

.mp-card-head {
  display: flex;
  gap: 10px;
  align-items: center;
}
.mp-icon {
  font-size: 22px;
  flex-shrink: 0;
}
.mp-card-title { flex: 1; min-width: 0; }
.mp-name {
  font-size: var(--fz-14, 14px);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mp-id {
  font-family: var(--font-mono);
  font-size: var(--fz-11, 11px);
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mp-src-tag {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--chy-ink-50, #f6f7f9);
  color: var(--color-text-muted);
  font-weight: 500;
  flex-shrink: 0;
}
.mp-src-tag.src-extra    { background: rgba(124, 108, 220, 0.12); color: var(--chy-violet-600, #6f5fd0); }
.mp-src-tag.src-p5       { background: rgba(63, 174, 130, 0.12);  color: var(--chy-celadon-600, #2c8d68); }
.mp-src-tag.src-external { background: rgba(212, 160, 23, 0.12); color: var(--chy-amber-600, #c08000); }

.mp-desc {
  margin: 0;
  font-size: var(--fz-12, 12px);
  color: var(--color-text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.mp-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: auto;
}
.mp-tag {
  font-size: 10px;
  padding: 1px 8px;
  border-radius: 4px;
  background: var(--chy-ink-50, #f6f7f9);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}
</style>
