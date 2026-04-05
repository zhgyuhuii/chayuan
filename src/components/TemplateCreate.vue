<template>
  <div class="template-create">
    <div class="toolbar">
      <div class="search-wrap">
        <input
          v-model="searchText"
          class="search-input"
          placeholder="按名称、标签搜索..."
          type="text"
        />
      </div>
      <div class="btn-group">
        <button class="btn btn-primary" @click="openAddForm">
          <span class="icon">+</span> 添加
        </button>
        <button class="btn btn-secondary" @click="openSmartExtract">
          智能提取
        </button>
        <button class="btn btn-secondary" :disabled="!selectedId" @click="openEditForm">
          修改
        </button>
        <button class="btn btn-danger" :disabled="!selectedId" @click="deleteSelected">
          删除
        </button>
      </div>
    </div>

    <div class="table-wrap">
      <table class="rules-table">
        <thead>
          <tr>
            <th class="col-action">应用</th>
            <th class="col-name">书签名称</th>
            <th class="col-required">必填</th>
            <th class="col-tag">标签</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="item in filteredRules" :key="item.id">
            <tr
              :class="{ selected: selectedId === item.id }"
              title="单击选中，双击在当前文档位置创建书签"
              @click="selectedId = item.id"
              @dblclick="insertTag(item)"
            >
              <td class="col-action">
                <button
                  class="btn-action"
                  title="在当前选区或光标处应用该规则"
                  @click.stop="insertTag(item)"
                >应用</button>
              </td>
              <td class="col-name">
                <div class="name-cell">
                  <button
                    type="button"
                    class="tree-toggle"
                    :class="{ expanded: isRuleExpanded(item.id) }"
                    :title="isRuleExpanded(item.id) ? '折叠关联书签' : '展开关联书签'"
                    @click.stop="toggleRuleExpand(item)"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
                    </svg>
                  </button>
                  <span
                    class="name-link"
                    :title="isRuleExpanded(item.id) ? '点击折叠关联书签' : '点击展开关联书签'"
                    @click.stop="toggleRuleExpand(item)"
                  >{{ item.name }}</span>
                  <span
                    v-if="getBookmarkCount(item.id) > 0"
                    class="count-badge"
                    :title="`文档中共 ${getBookmarkCount(item.id)} 处关联书签`"
                  >
                    {{ getBookmarkCount(item.id) }}
                  </span>
                </div>
              </td>
              <td class="col-required">{{ item.required ? '是' : '否' }}</td>
              <td class="col-tag" :title="item.tag || '-'">{{ item.tag || '-' }}</td>
            </tr>
            <tr v-if="isRuleExpanded(item.id)" class="bookmark-tree-row">
              <td></td>
              <td colspan="3" class="bookmark-tree-cell">
                <div class="bookmark-tree-panel">
                  <div class="bookmark-tree-header">
                    <span class="bookmark-tree-title">关联书签</span>
                    <span class="bookmark-tree-count">共 {{ getBookmarkCount(item.id) }} 处</span>
                    <button
                      type="button"
                      class="tree-action danger"
                      @click.stop="deleteRule(item)"
                    >删除规则</button>
                  </div>
                  <div v-if="getRuleBookmarks(item.id).length === 0" class="bookmark-empty">
                    当前规则还没有关联书签。可点击“应用”或双击规则行，在当前选区/光标处创建新书签。
                  </div>
                  <div v-else class="bookmark-tree-list">
                    <div
                      v-for="(bookmark, bookmarkIndex) in getRuleBookmarks(item.id)"
                      :key="bookmark.bookmarkName"
                      class="bookmark-node"
                    >
                      <div class="bookmark-node-main">
                        <div class="bookmark-node-title-row">
                          <span class="bookmark-node-order">第 {{ bookmarkIndex + 1 }} 处</span>
                          <button
                            type="button"
                            class="bookmark-link"
                            :title="`定位到 ${bookmark.bookmarkName}`"
                            @click.stop="goToBookmark(bookmark)"
                          >{{ bookmark.bookmarkName }}</button>
                        </div>
                        <div class="bookmark-node-meta">
                          <span>位置：{{ bookmark.position }}</span>
                          <span>内容：{{ bookmark.content || '（空）' }}</span>
                        </div>
                      </div>
                      <div class="bookmark-node-actions">
                        <button
                          type="button"
                          class="tree-action"
                          @click.stop="goToBookmark(bookmark)"
                        >定位</button>
                        <button
                          type="button"
                          class="tree-action danger"
                          @click.stop="deleteBookmark(bookmark)"
                        >删除书签</button>
                      </div>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </template>
          <tr v-if="!filteredRules.length">
            <td colspan="4" class="empty">{{ searchText ? '无匹配结果' : '暂无规则，点击「添加」创建' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { loadRulesFromDoc, saveRulesToDoc, onRulesStorageSync } from '../utils/templateRules.js'

function normalizeRuleList() {
  return loadRulesFromDoc().map(rule => ({
    ...rule,
    reviewType: rule.reviewType || 'none',
    tag: rule.tag || ''
  }))
}

function trimBookmarkText(value) {
  return String(value || '')
    .replace(/\r\n$/g, '')
    .replace(/\r$/g, '')
    .replace(/\n$/g, '')
    .replace(/\x07$/g, '')
    .trim()
}

function parseBookmarkMeta(fullName) {
  const normalized = String(fullName || '').trim()
  if (!normalized) {
    return {
      bookmarkName: '',
      displayName: '',
      ruleId: '',
      seq: null
    }
  }
  const parts = normalized.split('_')
  if (parts.length >= 3 && /^\d+$/.test(parts[parts.length - 1])) {
    return {
      bookmarkName: normalized,
      displayName: parts.slice(0, -2).join('_') || normalized,
      ruleId: String(parts[parts.length - 2] || ''),
      seq: Number(parts[parts.length - 1])
    }
  }
  if (parts.length >= 2) {
    return {
      bookmarkName: normalized,
      displayName: parts.slice(0, -1).join('_') || normalized,
      ruleId: String(parts[parts.length - 1] || ''),
      seq: null
    }
  }
  return {
    bookmarkName: normalized,
    displayName: normalized,
    ruleId: '',
    seq: null
  }
}

export default {
  name: 'TemplateCreate',
  data() {
    return {
      rules: normalizeRuleList(),
      bookmarks: [],
      selectedId: null,
      searchText: '',
      expandedRuleIds: {}
    }
  },
  computed: {
    filteredRules() {
      const q = (this.searchText || '').trim().toLowerCase()
      if (!q) return this.rules
      return this.rules.filter(rule => {
        const name = String(rule.name || '').toLowerCase()
        const tag = String(rule.tag || '').toLowerCase()
        const tags = tag.split(',').map(item => item.trim()).filter(Boolean)
        if (name.includes(q)) return true
        if (tag.includes(q)) return true
        return tags.some(item => item.includes(q))
      })
    },
    bookmarksByRuleId() {
      return this.bookmarks.reduce((map, bookmark) => {
        const key = String(bookmark.ruleId || '').trim()
        if (!key) return map
        if (!map[key]) map[key] = []
        map[key].push(bookmark)
        return map
      }, {})
    }
  },
  mounted() {
    this.refreshAll()
    window.addEventListener('focus', this.refreshAll)
    this._unsubStorage = onRulesStorageSync(this.refreshAll)
  },
  beforeUnmount() {
    window.removeEventListener('focus', this.refreshAll)
    if (this._unsubStorage) this._unsubStorage()
  },
  methods: {
    refreshAll() {
      const previousSelectedId = this.selectedId
      this.rules = normalizeRuleList()
      this.loadBookmarks()
      if (previousSelectedId && !this.rules.find(rule => rule.id === previousSelectedId)) {
        this.selectedId = null
      }
      Object.keys(this.expandedRuleIds).forEach((ruleId) => {
        if (!this.rules.find(rule => rule.id === ruleId)) {
          delete this.expandedRuleIds[ruleId]
        }
      })
    },
    loadBookmarks() {
      const doc = window.Application?.ActiveDocument
      const bookmarks = doc?.Bookmarks
      if (!bookmarks || bookmarks.Count === 0) {
        this.bookmarks = []
        return
      }
      const ruleMap = new Map(this.rules.map(rule => [rule.id, rule]))
      const list = []
      for (let i = 1; i <= bookmarks.Count; i += 1) {
        try {
          const bookmark = bookmarks.Item(i)
          if (!bookmark) continue
          const meta = parseBookmarkMeta(bookmark.Name)
          if (!meta.bookmarkName) continue
          const range = bookmark.Range
          const position = Number(range?.Start || 0)
          const end = Number(range?.End || position)
          list.push({
            bookmarkName: meta.bookmarkName,
            name: ruleMap.get(meta.ruleId)?.name || meta.displayName || meta.bookmarkName,
            ruleId: meta.ruleId,
            seq: meta.seq,
            position,
            end,
            content: trimBookmarkText(range?.Text || '')
          })
        } catch (error) {
          console.warn('读取书签失败:', error)
        }
      }
      list.sort((a, b) => {
        const diff = a.position - b.position
        if (diff !== 0) return diff
        return a.bookmarkName.localeCompare(b.bookmarkName, 'zh-Hans-CN')
      })
      this.bookmarks = list
    },
    getRuleBookmarks(ruleId) {
      return this.bookmarksByRuleId[String(ruleId || '')] || []
    },
    getBookmarkCount(ruleId) {
      return this.getRuleBookmarks(ruleId).length
    },
    isRuleExpanded(ruleId) {
      return this.expandedRuleIds[String(ruleId || '')] === true
    },
    toggleRuleExpand(item) {
      const ruleId = String(item?.id || '')
      if (!ruleId) return
      this.selectedId = ruleId
      this.expandedRuleIds = {
        ...this.expandedRuleIds,
        [ruleId]: !this.isRuleExpanded(ruleId)
      }
    },
    getDialogUrl(mode, id) {
      const base = window.Application?.PluginStorage?.getItem('AddinBaseUrl')
      const path = (base || window.location.origin + window.location.pathname.replace(/\/?index\.html$/i, '')).replace(/#.*$/, '')
      const hash = window.location.protocol === 'file:' ? '' : '/#'
      let url = `${path}${hash}/template-form-dialog?mode=${mode}`
      if (id) url += `&id=${encodeURIComponent(id)}`
      return url
    },
    openAddForm() {
      try {
        const url = this.getDialogUrl('add')
        window.Application.ShowDialog(
          url,
          '添加表单项',
          520 * (window.devicePixelRatio || 1),
          800 * (window.devicePixelRatio || 1),
          false
        )
      } catch (error) {
        console.error('打开添加表单失败:', error)
        alert('打开表单失败：' + (error.message || error))
      }
    },
    openSmartExtract() {
      try {
        const base = window.Application?.PluginStorage?.getItem('AddinBaseUrl')
        const path = (base || window.location.origin + window.location.pathname.replace(/\/?index\.html$/i, '')).replace(/#.*$/, '')
        const hash = window.location.protocol === 'file:' ? '' : '/#'
        const url = `${path}${hash}/template-field-extract-dialog`
        window.Application.ShowDialog(
          url,
          '智能提取',
          1360 * (window.devicePixelRatio || 1),
          900 * (window.devicePixelRatio || 1),
          false
        )
      } catch (error) {
        console.error('打开智能提取失败:', error)
        alert('打开智能提取失败：' + (error.message || error))
      }
    },
    openEditForm() {
      if (!this.selectedId) return
      try {
        const url = this.getDialogUrl('edit', this.selectedId)
        window.Application.ShowDialog(
          url,
          '修改表单项',
          520 * (window.devicePixelRatio || 1),
          800 * (window.devicePixelRatio || 1),
          false
        )
      } catch (error) {
        console.error('打开修改表单失败:', error)
        alert('打开表单失败：' + (error.message || error))
      }
    },
    deleteSelected() {
      if (!this.selectedId) return
      const rule = this.rules.find(item => item.id === this.selectedId)
      if (!rule) return
      this.deleteRule(rule)
    },
    deleteRule(rule) {
      const normalizedRule = rule && typeof rule === 'object'
        ? rule
        : this.rules.find(item => item.id === rule)
      if (!normalizedRule?.id) return
      const linkedCount = this.getBookmarkCount(normalizedRule.id)
      const message = linkedCount > 0
        ? `确定删除规则“${normalizedRule.name}”吗？\n\n注意：文档中已存在 ${linkedCount} 个关联书签，删除规则不会自动删除这些书签，它们将保留在文档中。`
        : `确定删除规则“${normalizedRule.name}”吗？`
      if (!confirm(message)) return
      this.rules = this.rules.filter(item => item.id !== normalizedRule.id)
      saveRulesToDoc(this.rules)
      if (this.selectedId === normalizedRule.id) {
        this.selectedId = null
      }
      if (this.expandedRuleIds[normalizedRule.id]) {
        delete this.expandedRuleIds[normalizedRule.id]
        this.expandedRuleIds = { ...this.expandedRuleIds }
      }
      this.refreshAll()
    },
    deleteBookmark(bookmark) {
      const fullName = String(bookmark?.bookmarkName || '').trim()
      if (!fullName) return
      if (!confirm(`确定删除书签“${fullName}”吗？`)) return
      try {
        const doc = window.Application?.ActiveDocument
        const target = doc?.Bookmarks?.Item(fullName)
        target?.Delete?.()
        this.refreshAll()
      } catch (error) {
        console.error('删除书签失败:', error)
        alert('删除书签失败：' + (error.message || error))
      }
    },
    sanitizeBookmarkName(value) {
      return String(value || '').replace(/\s+/g, '_').replace(/[^\w\u4e00-\u9fa5_-]/g, '')
    },
    getBaseBookmarkName(rule) {
      return `${this.sanitizeBookmarkName(rule.name)}_${rule.id}`
    },
    getNextBookmarkSeq(rule) {
      return this.getRuleBookmarks(rule.id).reduce((maxValue, bookmark) => {
        const seq = Number(bookmark.seq || 0)
        return seq > maxValue ? seq : maxValue
      }, 0) + 1
    },
    getSelectionContext() {
      const app = window.Application
      const doc = app?.ActiveDocument
      const selection = app?.Selection
      const range = selection?.Range
      if (!doc || !selection || !range) {
        throw new Error('请先将光标置于文档中要应用书签的位置')
      }
      const start = Number(range.Start || 0)
      const end = Number(range.End || start)
      return {
        app,
        doc,
        selection,
        range,
        start,
        end,
        hasSelectionText: end > start
      }
    },
    findConflictingBookmarks(start, end) {
      return this.bookmarks.filter((bookmark) => {
        const bookmarkStart = Number(bookmark.position || 0)
        const bookmarkEnd = Number(bookmark.end || bookmarkStart)
        if (end > start) {
          if (bookmarkEnd === bookmarkStart) {
            return bookmarkStart >= start && bookmarkStart <= end
          }
          return !(end <= bookmarkStart || start >= bookmarkEnd)
        }
        if (bookmarkEnd > bookmarkStart) {
          return start >= bookmarkStart && start < bookmarkEnd
        }
        return start === bookmarkStart
      })
    },
    insertTag(rule) {
      if (!rule?.id) return
      try {
        this.loadBookmarks()
        const { doc, range, start, end, hasSelectionText } = this.getSelectionContext()
        const conflicts = this.findConflictingBookmarks(start, end)
        if (conflicts.length > 0) {
          const conflictNames = conflicts.slice(0, 3).map(item => item.bookmarkName).join('、')
          const scopeText = hasSelectionText ? '当前选区' : '当前光标位置'
          alert(`${scopeText}已存在书签，不能重复添加。\n\n冲突书签：${conflictNames}${conflicts.length > 3 ? ' 等' : ''}`)
          return
        }
        const tagName = `${this.getBaseBookmarkName(rule)}_${this.getNextBookmarkSeq(rule)}`
        doc.Bookmarks.Add(tagName, range)
        this.expandedRuleIds = {
          ...this.expandedRuleIds,
          [rule.id]: true
        }
        this.selectedId = rule.id
        this.refreshAll()
      } catch (error) {
        console.error('插入标签失败:', error)
        alert('插入标签失败：' + (error.message || error))
      }
    },
    goToBookmark(bookmark) {
      try {
        const doc = window.Application?.ActiveDocument
        if (!doc) return
        const target = doc.Bookmarks.Item(bookmark.bookmarkName)
        target?.Select?.()
      } catch (error) {
        console.error('定位书签失败:', error)
        alert('定位书签失败：' + (error.message || error))
      }
    }
  }
}
</script>

<style scoped>
.template-create {
  font-size: 13px;
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
  flex-shrink: 0;
}
.search-wrap {
  width: 100%;
}
.search-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
}
.search-input::placeholder {
  color: #999;
}
.btn-group {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.btn {
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-primary {
  background: #1890ff;
  color: #fff;
}
.btn-primary:hover:not(:disabled) {
  background: #40a9ff;
}
.btn-secondary {
  background: #f0f0f0;
  color: #333;
}
.btn-secondary:hover:not(:disabled) {
  background: #e0e0e0;
}
.btn-danger {
  background: #ff4d4f;
  color: #fff;
}
.btn-danger:hover:not(:disabled) {
  background: #ff7875;
}
.btn .icon {
  margin-right: 4px;
}
.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
}
.rules-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.rules-table th,
.rules-table td {
  padding: 6px 8px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
  vertical-align: top;
}
.rules-table th {
  background: #fafafa;
  font-weight: 600;
  color: #333;
}
.rules-table tbody tr {
  cursor: pointer;
}
.rules-table tbody tr:hover {
  background: #fafafa;
}
.rules-table tbody tr.selected {
  background: #e6f7ff;
}
.col-action {
  width: 82px;
  text-align: center;
}
.col-name {
  min-width: 180px;
}
.col-required {
  width: 60px;
}
.col-tag {
  min-width: 100px;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #666;
  font-size: 11px;
}
.btn-action {
  padding: 4px 10px;
  border: 1px solid #b7eb8f;
  border-radius: 4px;
  background: #f6ffed;
  color: #389e0d;
  cursor: pointer;
  font-size: 12px;
}
.btn-action:hover {
  background: #d9f7be;
}
.name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.tree-toggle {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #8c8c8c;
  cursor: pointer;
  flex-shrink: 0;
}
.tree-toggle svg {
  transition: transform 0.2s ease;
}
.tree-toggle.expanded svg {
  transform: rotate(90deg);
}
.name-link {
  color: #1890ff;
  text-decoration: underline;
  cursor: pointer;
  min-width: 0;
}
.name-link:hover {
  color: #40a9ff;
}
.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 11px;
  line-height: 1;
  color: #fff;
  background: #1890ff;
  border-radius: 9px;
  flex-shrink: 0;
}
.bookmark-tree-row {
  background: #fcfcfc;
}
.bookmark-tree-row:hover {
  background: #fcfcfc !important;
}
.bookmark-tree-cell {
  padding: 0 !important;
}
.bookmark-tree-panel {
  margin: 0 0 0 12px;
  padding: 10px 12px 12px;
  border-left: 2px solid #d9d9d9;
}
.bookmark-tree-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.bookmark-tree-title {
  font-weight: 600;
  color: #333;
}
.bookmark-tree-count {
  color: #8c8c8c;
}
.bookmark-tree-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bookmark-node {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
}
.bookmark-node-main {
  min-width: 0;
  flex: 1;
}
.bookmark-node-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.bookmark-node-order {
  color: #8c8c8c;
}
.bookmark-link {
  padding: 0;
  border: none;
  background: transparent;
  color: #1890ff;
  text-decoration: underline;
  cursor: pointer;
  text-align: left;
}
.bookmark-link:hover {
  color: #40a9ff;
}
.bookmark-node-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: #666;
  word-break: break-all;
}
.bookmark-node-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.tree-action {
  padding: 3px 8px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
  color: #333;
  cursor: pointer;
  font-size: 12px;
}
.tree-action:hover {
  background: #f5f5f5;
}
.tree-action.danger {
  color: #cf1322;
  border-color: #ffa39e;
  background: #fff1f0;
}
.tree-action.danger:hover {
  background: #ffccc7;
}
.bookmark-empty {
  color: #8c8c8c;
  padding: 4px 0;
}
.empty {
  color: #999;
  text-align: center;
  padding: 16px;
  font-size: 12px;
}
</style>
