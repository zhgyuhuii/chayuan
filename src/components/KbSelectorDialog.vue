<template>
  <div v-if="visible" class="kb-selector-overlay" @click.self="close">
    <div class="kb-selector-modal">
      <header class="kb-sel-head">
        <h4>选择知识库</h4>
        <button type="button" class="btn-close" @click="close" aria-label="关闭">×</button>
      </header>

      <div v-if="!hasConnection" class="kb-sel-empty">
        <p>尚未配置知识库连接。</p>
        <button class="btn-primary" @click="goToSettings">前往设置</button>
      </div>

      <template v-else>
        <div class="kb-sel-toolbar">
          <input
            v-model="filterText"
            class="kb-sel-search"
            placeholder="搜索知识库名称..."
          />
          <button class="btn-link" @click="refresh" :disabled="loading">
            {{ loading ? '加载中…' : '刷新' }}
          </button>
        </div>

        <div v-if="error" class="kb-sel-error">{{ error }}</div>

        <div class="kb-sel-tree-wrap">
          <ul v-if="filteredTree.length" class="kb-sel-tree">
            <li v-for="group in filteredTree" :key="group.id" class="kb-sel-group">
              <div class="kb-sel-group-head" @click="toggleGroup(group.id)">
                <span class="kb-sel-collapse">{{ collapsed[group.id] ? '▶' : '▼' }}</span>
                <span class="kb-sel-group-name">{{ group.name }}</span>
                <span class="kb-sel-group-count">({{ group.children.length }})</span>
                <button
                  type="button"
                  class="btn-link kb-sel-group-action"
                  @click.stop="selectAllInGroup(group)"
                >全选</button>
              </div>
              <ul v-if="!collapsed[group.id]" class="kb-sel-items">
                <li
                  v-for="kb in group.children"
                  :key="kb.id"
                  class="kb-sel-item"
                  :class="{ disabled: isExpired(kb), selected: isSelected(kb.id) }"
                >
                  <label class="kb-sel-row">
                    <input
                      type="checkbox"
                      :checked="isSelected(kb.id)"
                      :disabled="isExpired(kb)"
                      @change="toggleSelection(kb)"
                    />
                    <span class="kb-sel-icon">📚</span>
                    <span class="kb-sel-name" :title="kb.name">{{ kb.name }}</span>
                    <span
                      v-if="kb.role"
                      class="kb-role-badge"
                      :data-role="kb.role"
                      :title="roleTooltip(kb)"
                    >{{ roleLabel(kb.role) }}</span>
                    <span v-if="kb.kb?.visibility === 'public'" class="kb-vis-badge">公开</span>
                    <span v-if="isExpired(kb)" class="kb-expired-badge">已过期</span>
                  </label>
                </li>
                <li v-if="!group.children.length" class="kb-sel-empty-item">该分组暂无可见知识库</li>
              </ul>
            </li>
          </ul>
          <div v-else-if="!loading" class="kb-sel-empty-tip">
            {{ filterText ? '没有匹配的知识库' : '暂无可见知识库；请联系管理员授权。' }}
          </div>
        </div>

        <fieldset class="kb-sel-config">
          <legend>检索配置</legend>
          <div class="kb-sel-cfg-grid">
            <label>
              <span>topK / 每条查询</span>
              <input v-model.number="config.topK" type="number" min="1" max="20" class="kb-input" />
            </label>
            <label>
              <span>融合方式</span>
              <select v-model="config.fusion" class="kb-input">
                <option value="rrf">RRF（推荐）</option>
                <option value="weighted">Weighted</option>
              </select>
            </label>
            <label>
              <span>启用 hybrid（向量+关键词）</span>
              <input v-model="config.hybrid" type="checkbox" />
            </label>
            <label>
              <span>启用 rerank</span>
              <input v-model="config.rerank" type="checkbox" />
            </label>
          </div>
        </fieldset>

        <footer class="kb-sel-foot">
          <span class="kb-sel-summary">
            已选 <strong>{{ selectedNames.length }}</strong> 个知识库
            <template v-if="selectedNames.length">
              · <a href="#" @click.prevent="clearAll">清空</a>
            </template>
          </span>
          <div class="kb-sel-actions">
            <button class="btn-secondary" @click="close">取消</button>
            <button class="btn-primary" :disabled="!selectedNames.length" @click="confirm">
              确定 ({{ selectedNames.length }})
            </button>
          </div>
        </footer>
      </template>
    </div>
  </div>
</template>

<script>
import services from '../services/index.js'

const { connectionStore, kbCatalog } = services.kb

export default {
  name: 'KbSelectorDialog',
  props: {
    visible: { type: Boolean, default: false },
    initialBinding: { type: Object, default: () => ({ kbNames: [], config: {} }) }
  },
  data() {
    return {
      tree: [],
      loading: false,
      error: '',
      selected: new Set(),
      filterText: '',
      collapsed: {},
      config: {
        topK: 5,
        fusion: 'rrf',
        hybrid: true,
        rerank: false
      },
      hasConnection: true
    }
  },
  computed: {
    selectedNames() {
      return Array.from(this.selected)
    },
    filteredTree() {
      if (!this.filterText) return this.tree
      const q = this.filterText.toLowerCase()
      return this.tree
        .map(group => ({
          ...group,
          children: group.children.filter(kb =>
            String(kb.name || '').toLowerCase().includes(q) ||
            String(kb.id || '').toLowerCase().includes(q)
          )
        }))
        .filter(group => group.children.length > 0)
    }
  },
  watch: {
    visible(v) {
      if (v) this.init()
    }
  },
  mounted() {
    if (this.visible) this.init()
  },
  methods: {
    async init() {
      this.error = ''
      this.selected = new Set(this.initialBinding?.kbNames || [])
      const cfg = this.initialBinding?.config || {}
      this.config = {
        topK: Number(cfg.topK) || 5,
        fusion: cfg.fusion || 'rrf',
        hybrid: cfg.hybrid !== false,
        rerank: cfg.rerank === true
      }
      const conn = await connectionStore.getCurrentConnection()
      if (!conn) {
        this.hasConnection = false
        return
      }
      this.hasConnection = true
      await this.loadTree(conn)
    },
    async refresh() {
      const conn = await connectionStore.getCurrentConnection()
      if (!conn) return
      await this.loadTree(conn, /*force*/ true)
    },
    async loadTree(conn, force = false) {
      this.loading = true
      this.error = ''
      try {
        this.tree = await kbCatalog.fetchTree(conn, { force })
        for (const g of this.tree) {
          if (this.collapsed[g.id] === undefined) this.collapsed[g.id] = false
        }
      } catch (e) {
        this.error = `加载知识库列表失败：${e.message || e}`
      } finally {
        this.loading = false
      }
    },
    toggleGroup(id) {
      this.collapsed = { ...this.collapsed, [id]: !this.collapsed[id] }
    },
    toggleSelection(kb) {
      const next = new Set(this.selected)
      if (next.has(kb.id)) next.delete(kb.id)
      else next.add(kb.id)
      this.selected = next
    },
    selectAllInGroup(group) {
      const next = new Set(this.selected)
      let hadAny = false
      for (const kb of group.children) {
        if (!this.isExpired(kb)) {
          if (next.has(kb.id)) hadAny = true
          else next.add(kb.id)
        }
      }
      // 全选已生效则改为全反选(取消该组所有)
      if (hadAny && group.children.every(kb => this.isExpired(kb) || next.has(kb.id))) {
        for (const kb of group.children) next.delete(kb.id)
      }
      this.selected = next
    },
    clearAll() { this.selected = new Set() },
    isSelected(id) { return this.selected.has(id) },
    isExpired(kb) {
      if (!kb?.kb?.grantExpiresAt) return false
      try {
        return new Date(kb.kb.grantExpiresAt).getTime() < Date.now()
      } catch (e) { return false }
    },
    roleLabel(role) {
      switch (role) {
        case 'owner':  return 'O'
        case 'editor': return 'E'
        case 'reader': return 'R'
        case 'admin':  return 'A'
        default:       return '?'
      }
    },
    roleTooltip(kb) {
      const role = kb.role
      const src = kb.grantSource
      const exp = kb.kb?.grantExpiresAt
      const map = { owner: '所有者', editor: '可编辑', reader: '只读', admin: '管理员' }
      let text = map[role] || role || '未知角色'
      if (src) text += ` · ${src === 'public' ? '公开' : src === 'grant' ? '授权' : src}`
      if (exp) text += ` · 过期: ${exp}`
      return text
    },
    close() { this.$emit('close') },
    confirm() {
      this.$emit('confirm', {
        kbNames: this.selectedNames,
        config: { ...this.config }
      })
      this.$emit('close')
    },
    goToSettings() {
      this.$emit('goto-settings')
      this.close()
    }
  }
}
</script>

<style scoped>
.kb-selector-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center; z-index: 9000;
}
.kb-selector-modal {
  width: 560px; max-height: 80vh;
  background: white; border-radius: 8px;
  display: flex; flex-direction: column;
  box-shadow: 0 12px 32px rgba(0,0,0,0.18);
  font-size: 13px; color: #2a2a2a;
}
.kb-sel-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 18px; border-bottom: 1px solid #e6e8ec;
}
.kb-sel-head h4 { margin: 0; font-size: 15px; font-weight: 600; }
.btn-close {
  background: transparent; border: none; font-size: 22px;
  cursor: pointer; color: #888; line-height: 1;
}
.btn-close:hover { color: #333; }

.kb-sel-toolbar {
  display: flex; gap: 8px; align-items: center;
  padding: 10px 18px; border-bottom: 1px solid #f0f2f5;
}
.kb-sel-search {
  flex: 1; padding: 6px 10px;
  border: 1px solid #cfd4db; border-radius: 4px; font-size: 13px; outline: none;
}
.kb-sel-search:focus { border-color: #2a6ddf; }

.kb-sel-error {
  margin: 8px 18px; padding: 8px 10px;
  background: #fcf3f2; color: #c0392b;
  border-radius: 4px; font-size: 12px;
}

.kb-sel-tree-wrap {
  flex: 1; overflow-y: auto; padding: 8px 18px;
}
.kb-sel-tree { list-style: none; margin: 0; padding: 0; }
.kb-sel-group { margin-bottom: 8px; }
.kb-sel-group-head {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 4px; cursor: pointer; user-select: none;
  font-weight: 600;
}
.kb-sel-group-head:hover { background: #f7f8fa; }
.kb-sel-collapse { width: 12px; text-align: center; color: #888; font-size: 10px; }
.kb-sel-group-name { flex: 1; }
.kb-sel-group-count { color: #999; font-weight: normal; font-size: 11px; }
.kb-sel-group-action { margin-left: auto; }
.kb-sel-items { list-style: none; margin: 4px 0 0 18px; padding: 0; }
.kb-sel-item { padding: 2px 0; }
.kb-sel-item.disabled { opacity: 0.5; }
.kb-sel-item.selected { background: #f0f6ff; border-radius: 3px; }
.kb-sel-row {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 6px; cursor: pointer;
}
.kb-sel-item.disabled .kb-sel-row { cursor: not-allowed; }
.kb-sel-icon { font-size: 14px; }
.kb-sel-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.kb-role-badge {
  font-size: 10px; font-weight: 600;
  padding: 1px 6px; border-radius: 8px;
  background: #e3e6eb; color: #555;
}
.kb-role-badge[data-role='owner']  { background: #ffe9c2; color: #b76e00; }
.kb-role-badge[data-role='editor'] { background: #cfe6ff; color: #1856b2; }
.kb-role-badge[data-role='reader'] { background: #d8f0d8; color: #2aa353; }
.kb-role-badge[data-role='admin']  { background: #f5d6e8; color: #a4337a; }
.kb-vis-badge {
  font-size: 10px; padding: 1px 6px; border-radius: 8px;
  background: #f0f4fa; color: #555;
}
.kb-expired-badge {
  font-size: 10px; padding: 1px 6px; border-radius: 8px;
  background: #f5e0e0; color: #b04545;
}

.kb-sel-empty-item, .kb-sel-empty-tip {
  padding: 12px 8px; color: #999; text-align: center; font-size: 12px;
}
.kb-sel-empty {
  padding: 28px; text-align: center; color: #888;
  display: flex; flex-direction: column; gap: 12px; align-items: center;
}

.kb-sel-config {
  margin: 0 18px 8px;
  padding: 8px 12px; border: 1px solid #e6e8ec; border-radius: 6px;
}
.kb-sel-config legend { font-size: 12px; color: #555; padding: 0 4px; }
.kb-sel-cfg-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px;
}
.kb-sel-cfg-grid label {
  display: flex; align-items: center; gap: 8px; font-size: 12px;
}
.kb-sel-cfg-grid label > span { min-width: 130px; color: #555; }
.kb-input {
  border: 1px solid #cfd4db; border-radius: 4px; padding: 4px 6px;
  font-size: 12px; outline: none; flex: 1;
}
.kb-input:focus { border-color: #2a6ddf; }

.kb-sel-foot {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 18px; border-top: 1px solid #e6e8ec;
}
.kb-sel-summary { color: #555; font-size: 12px; }
.kb-sel-summary a { color: #2a6ddf; text-decoration: none; }
.kb-sel-summary a:hover { text-decoration: underline; }
.kb-sel-actions { display: flex; gap: 8px; }

.btn-primary, .btn-secondary, .btn-link {
  border-radius: 4px; padding: 6px 14px; font-size: 13px;
  cursor: pointer; border: 1px solid transparent;
}
.btn-primary { background: #2a6ddf; color: white; border-color: #2a6ddf; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary { background: white; color: #333; border-color: #cfd4db; }
.btn-secondary:hover { background: #f0f4fa; }
.btn-link {
  background: transparent; color: #2a6ddf; text-decoration: none;
  border: none; padding: 0; font-size: 12px;
}
.btn-link:hover { text-decoration: underline; }
.btn-link:disabled { color: #999; cursor: not-allowed; }
</style>
