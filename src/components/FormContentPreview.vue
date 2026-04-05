<template>
  <div class="form-content-preview">
     
    <div class="popup-body">
      <div v-if="loading" class="loading-state">
        <span class="loading-spinner"></span>
        <span>正在加载…</span>
      </div>
      <div v-else-if="errorMsg" class="error-state">
        <p>{{ errorMsg }}</p>
      </div>
      <div v-else-if="!items.length" class="empty-state">
        <p>文档中暂无表单标签（书签）</p>
        <p class="hint">请先在「规则制作」中创建表单项并插入标签到文档</p>
      </div>
      <div v-else class="list-wrap">
        <table class="preview-table">
          <thead>
            <tr>
              <th class="col-name">名称</th>
              <th class="col-content">内容</th>
              <th class="col-fill-hint">填写提示</th>
              <th class="col-action">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, idx) in items"
              :key="item.bookmarkName + '-' + idx"
              class="preview-row"
              title="双击进入编辑并定位到文档"
              @dblclick="onRowDblClick(item, idx)"
            >
              <td class="col-name" :title="item.name">{{ item.name }}</td>
              <td class="col-content">
                <input
                  v-if="editingKey === item.bookmarkName + '-' + idx"
                  ref="editInput"
                  v-model="editContent"
                  class="edit-input"
                  @blur="onEditBlur(item, idx)"
                  @keydown.enter="blurAndMaybeSave(item, idx)"
                />
                <span v-else class="content-text">{{ item.content || '(空)' }}</span>
              </td>
              <td class="col-fill-hint" :title="getFillHint(item)">{{ getFillHint(item) }}</td>
              <td class="col-action">
                <button
                  class="btn-delete"
                  title="删除标签及内容"
                  @click.stop="onDeleteItem(item, idx)"
                >
                  删除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="popup-footer">
      <button type="button" class="btn btn-secondary" @click="onClose">关闭</button>
    </div>
  </div>
</template>

<script>
import { loadRulesFromDoc } from '../utils/templateRules.js'

export default {
  name: 'FormContentPreview',
  data() {
    return {
      loading: true,
      errorMsg: '',
      items: [],
      editingKey: null,
      editContent: '',
      editOriginalContent: ''
    }
  },
  mounted() {
    this.loadBookmarks()
  },
  methods: {
    /** 从书签全名 名称_id_序号 中解析出规则 id，再从规则库取填写提示；查不到则返回空字符串 */
    getFillHint(item) {
      const fullName = (item.bookmarkName || '').trim()
      const parts = fullName.split('_')
      const ruleId = parts.length >= 2 ? parts[1] : null
      if (!ruleId) return ''
      const rules = loadRulesFromDoc()
      const rule = rules.find(r => r.id === ruleId)
      return rule && rule.fillHint ? String(rule.fillHint).trim() : ''
    },
    loadBookmarks() {
      this.loading = true
      this.errorMsg = ''
      this.items = []
      try {
        const doc = window.Application && window.Application.ActiveDocument
        if (!doc) {
          this.errorMsg = '当前没有打开任何文档'
          this.loading = false
          return
        }
        const bookmarks = doc.Bookmarks
        if (!bookmarks || bookmarks.Count === 0) {
          this.loading = false
          return
        }
        const list = []
        for (let i = 1; i <= bookmarks.Count; i++) {
          try {
            const bm = bookmarks.Item(i)
            if (!bm) continue
            const fullName = (bm.Name || '').trim()
            if (!fullName || fullName.indexOf('_') === 0) continue
            // 书签格式：名称_id_编号，取第一个 _ 前的部分作为显示名称
            const firstUnderscore = fullName.indexOf('_')
            const name = firstUnderscore >= 0 ? fullName.substring(0, firstUnderscore).trim() : fullName
            let content = ''
            try {
              if (bm.Range && !bm.Empty) {
                content = (bm.Range.Text || '')
                  .replace(/\r\n$/g, '')
                  .replace(/\r$/g, '')
                  .replace(/\n$/g, '')
                  .replace(/\x07$/g, '')
                  .trim()
              }
            } catch (e) {}
            list.push({
              bookmarkName: fullName,
              name: name || fullName,
              content
            })
          } catch (e) {
            console.warn('读取书签失败:', e)
          }
        }
        this.items = list
      } catch (e) {
        console.error('loadBookmarks:', e)
        this.errorMsg = (e.message || e) + ''
      }
      this.loading = false
    },
    onRowDblClick(item, idx) {
      this.editingKey = item.bookmarkName + '-' + idx
      this.editContent = item.content || ''
      this.editOriginalContent = item.content || ''
      this.goToBookmark(item)
      this.$nextTick(() => {
        const el = this.$refs.editInput
        const input = Array.isArray(el) ? el[0] : el
        if (input) input.focus()
      })
    },
    onEditBlur(item, idx) {
      const key = item.bookmarkName + '-' + idx
      if (this.editingKey !== key) return
      const current = (this.editContent || '').trim()
      const original = (this.editOriginalContent || '').trim()
      if (current !== original) {
        const ok = window.confirm('内容有编辑，是否替换原有内容？')
        if (ok) {
          this.doReplaceBookmark(item, current)
        } else {
          item.content = this.editOriginalContent
        }
      }
      this.editingKey = null
      this.editContent = ''
      this.editOriginalContent = ''
    },
    blurAndMaybeSave(item, idx) {
      const input = this.$refs.editInput
      const el = Array.isArray(input) ? input[0] : input
      if (el) el.blur()
    },
    doReplaceBookmark(item, newText) {
      try {
        const doc = window.Application?.ActiveDocument
        if (!doc) {
          this.errorMsg = '当前没有打开任何文档'
          return
        }
        const bm = doc.Bookmarks.Item(item.bookmarkName)
        if (!bm || !bm.Range) {
          this.errorMsg = '书签不存在或已被删除'
          return
        }
        const bmName = item.bookmarkName
        const start = bm.Range.Start
        bm.Range.Text = newText
        try {
          const end = start + newText.length
          const rng = doc.Range(start, end)
          doc.Bookmarks.Add(bmName, rng)
        } catch (e2) {
          console.warn('重新添加书签失败，内容已更新:', e2)
        }
        item.content = newText
        this.errorMsg = ''
      } catch (e) {
        console.error('保存到书签失败:', e)
        this.errorMsg = '保存失败：' + (e.message || e)
      }
    },
    goToBookmark(item) {
      try {
        const doc = window.Application && window.Application.ActiveDocument
        if (!doc) return
        const bm = doc.Bookmarks.Item(item.bookmarkName)
        if (bm && typeof bm.Select === 'function') {
          bm.Select()
        }
      } catch (e) {
        console.error('定位书签失败:', e)
        this.errorMsg = '定位失败：' + (e.message || e)
      }
    },
    onDeleteItem(item, idx) {
      if (!window.confirm('确定要删除该标签及其内容吗？')) return
      try {
        const doc = window.Application?.ActiveDocument
        if (!doc) {
          this.errorMsg = '当前没有打开任何文档'
          return
        }
        const bm = doc.Bookmarks.Item(item.bookmarkName)
        if (!bm || !bm.Range) {
          this.errorMsg = '书签不存在或已被删除'
          this.items.splice(idx, 1)
          return
        }
        bm.Range.Text = ''
        this.items.splice(idx, 1)
        this.errorMsg = ''
        if (this.editingKey === item.bookmarkName + '-' + idx) {
          this.editingKey = null
          this.editContent = ''
          this.editOriginalContent = ''
        }
      } catch (e) {
        console.error('删除标签失败:', e)
        this.errorMsg = '删除失败：' + (e.message || e)
      }
    },
    onClose() {
      try {
        if (window.close) window.close()
      } catch (e) {}
    }
  }
}
</script>

<style scoped>
.form-content-preview {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 13px;
  color: #1e293b;
  background: #fff;
}

.popup-body {
  flex: 1;
  min-height: 0;
  padding: 0;
  margin: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.loading-state,
.error-state,
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: #64748b;
  text-align: center;
}

.loading-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 8px;
  vertical-align: middle;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state p {
  margin: 0;
  color: #dc2626;
}

.empty-state .hint {
  margin: 8px 0 0 0;
  font-size: 12px;
  color: #94a3b8;
}

.list-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: #fff;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.preview-table thead {
  position: sticky;
  top: 0;
  background: #f1f5f9;
  z-index: 1;
}

.preview-table th {
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.col-name {
  width: 18%;
  min-width: 70px;
}

.col-content {
  width: 42%;
}

.col-fill-hint {
  width: 28%;
  min-width: 80px;
  color: #64748b;
  font-size: 12px;
}

.col-action {
  width: 14%;
  min-width: 56px;
  padding: 4px 8px !important;
  text-align: center;
  vertical-align: middle !important;
}

.btn-delete {
  padding: 4px 10px;
  font-size: 12px;
  color: #dc2626;
  background: transparent;
  border: 1px solid #fecaca;
  border-radius: 4px;
  cursor: pointer;
}

.btn-delete:hover {
  background: #fef2f2;
  border-color: #f87171;
}

.preview-row {
  cursor: pointer;
  transition: background 0.15s ease;
}

.preview-row:hover {
  background: #f8fafc;
}

.preview-row:active {
  background: #f1f5f9;
}

.preview-table td {
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.5;
  border-bottom: 1px solid #f1f5f9;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  vertical-align: top;
}

.preview-table .col-name {
  color: #334155;
  font-weight: 500;
}

.preview-table .col-content {
  color: #475569;
}

.preview-table .col-fill-hint {
  color: #64748b;
}

.content-text {
  display: block;
  min-height: 1.5em;
}

.edit-input {
  width: 100%;
  padding: 6px 8px;
  font-size: 13px;
  line-height: 1.5;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  box-sizing: border-box;
}

.preview-table tbody tr:last-child td {
  border-bottom: none;
}

.popup-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid #e2e8f0;
  background: #fff;
  flex-shrink: 0;
}

.btn {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.btn-secondary {
  color: #475569;
  background: #f1f5f9;
}

.btn-secondary:hover {
  background: #e2e8f0;
}
</style>
