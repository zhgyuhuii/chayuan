<template>
  <div class="unused-styles-cleaner-dialog">
    <div class="dialog-header-compact">
      <button class="btn-close" @click="onCancel">×</button>
    </div>
    <div class="dialog-body">
      <div v-if="loading" class="loading">
        <div>正在扫描未使用的样式...</div>
        <div v-if="progressText" class="progress-text">{{ progressText }}</div>
      </div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else>
        <p class="hint">以下样式在文档中未被任何段落使用，可勾选后清除。</p>
        <div v-if="unusedList.length > 0" class="select-all-row">
          <label class="select-all-label">
            <input
              type="checkbox"
              :checked="isAllSelected"
              :indeterminate="isIndeterminate"
              @change="toggleSelectAll"
            />
            <span>全选</span>
          </label>
          <span class="selected-count">已选 {{ selectedCount }} / {{ unusedList.length }}</span>
        </div>
        <div class="style-list-container">
          <ul v-if="unusedList.length > 0" class="style-list">
            <li v-for="item in unusedList" :key="item.name" class="style-item">
              <label class="style-item-label">
                <input type="checkbox" :checked="item.selected" @change="toggleItem(item)" />
                <span class="style-name">{{ item.name }}</span>
              </label>
            </li>
          </ul>
          <div v-else class="empty-hint">未发现未使用的样式</div>
        </div>
      </div>
    </div>
    <div class="dialog-footer">
      <button type="button" class="btn btn-secondary" @click="onCancel">取消</button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="clearing || selectedCount === 0"
        @click="onConfirmClear"
      >
        {{ clearing ? '清除中...' : '确定清除' }}
      </button>
    </div>
  </div>
</template>

<script>
// Word: wdStyleTypeParagraph = 1
const WdStyleTypeParagraph = 1

export default {
  name: 'UnusedStylesCleanerDialog',
  data() {
    return {
      unusedList: [],
      loading: true,
      error: null,
      progressText: '',
      clearing: false
    }
  },
  computed: {
    selectedCount() {
      return this.unusedList.filter((item) => item.selected).length
    },
    isAllSelected() {
      return this.unusedList.length > 0 && this.selectedCount === this.unusedList.length
    },
    isIndeterminate() {
      const n = this.selectedCount
      return n > 0 && n < this.unusedList.length
    }
  },
  mounted() {
    this.scanUnusedStyles()
  },
  methods: {
    toggleSelectAll() {
      const target = !this.isAllSelected
      this.unusedList.forEach((item) => {
        item.selected = target
      })
    },
    toggleItem(item) {
      item.selected = !item.selected
    },
    async scanUnusedStyles() {
      try {
        this.loading = true
        this.error = null
        this.unusedList = []

        const app = window.Application
        if (!app) {
          this.error = 'Application 不可用'
          return
        }

        const doc = app.ActiveDocument
        if (!doc) {
          this.error = '当前没有打开任何文档'
          return
        }

        const styles = doc.Styles
        if (!styles || styles.Count === 0) {
          this.loading = false
          return
        }

        // 1) 收集文档中已使用的段落样式名称
        const usedNames = new Set()
        const paragraphs = doc.Paragraphs
        const totalParas = paragraphs ? paragraphs.Count : 0
        const BATCH_SIZE = 200

        for (let batchStart = 1; batchStart <= totalParas; batchStart += BATCH_SIZE) {
          await new Promise((r) => setTimeout(r, 0))
          const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalParas)
          for (let i = batchStart; i <= batchEnd; i++) {
            try {
              const para = paragraphs.Item(i)
              if (!para || !para.Style) continue
              const style = para.Style
              const name = style.NameLocal || style.Name
              if (name != null && name !== '') usedNames.add(String(name))
            } catch (e) {
              // 忽略单段错误
            }
          }
          if (batchEnd % 500 === 0 || batchEnd === totalParas) {
            this.progressText = `已扫描段落 ${batchEnd}/${totalParas}`
          }
        }

        // 2) 收集所有段落样式，未在 usedNames 中的即为未使用
        const count = styles.Count
        for (let i = 1; i <= count; i++) {
          try {
            const s = styles.Item(i)
            if (!s) continue
            const type = typeof s.Type !== 'undefined' ? s.Type : 1
            if (type !== WdStyleTypeParagraph) continue
            const nameLocal = s.NameLocal != null && s.NameLocal !== '' ? String(s.NameLocal) : null
            const name = s.Name != null && s.Name !== '' ? String(s.Name) : null
            const displayName = nameLocal || name
            if (!displayName) continue
            if (!usedNames.has(displayName)) {
              this.unusedList.push({ name: displayName, selected: true })
            }
          } catch (e) {
            console.warn('读取样式失败:', e)
          }
        }

        this.unusedList.sort((a, b) => a.name.localeCompare(b.name))
      } catch (e) {
        console.error('scanUnusedStyles:', e)
        this.error = '扫描失败：' + (e?.message || String(e))
      } finally {
        this.loading = false
        this.progressText = ''
      }
    },
    onConfirmClear() {
      const toDelete = this.unusedList.filter((item) => item.selected)
      if (toDelete.length === 0 || this.clearing) return
      this.clearing = true
      try {
        const app = window.Application
        const doc = app && app.ActiveDocument
        if (!doc) {
          alert('当前没有打开任何文档')
          return
        }
        const styles = doc.Styles
        let deleted = 0
        let failed = 0
        for (const item of toDelete) {
          const name = item.name
          try {
            const styleObj = styles.Item(name)
            if (styleObj && typeof styleObj.Delete === 'function') {
              styleObj.Delete()
              deleted++
              this.unusedList = this.unusedList.filter((x) => x.name !== name)
            }
          } catch (e) {
            failed++
            console.warn('删除样式失败:', name, e)
          }
        }
        const msg =
          `已删除 ${deleted} 个样式。` +
          (failed > 0 ? ` 有 ${failed} 个样式无法删除（可能为内置样式）。` : '')
        alert(msg)
        if (this.unusedList.length === 0) {
          this.onCancel()
        }
      } catch (e) {
        console.error('清除未使用样式失败:', e)
        alert('清除失败：' + (e?.message || String(e)))
      } finally {
        this.clearing = false
      }
    },
    onCancel() {
      try {
        if (window.close) window.close()
      } catch (e) {}
    }
  }
}
</script>

<style scoped>
.unused-styles-cleaner-dialog {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 400px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
}

.dialog-header-compact {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 4px 8px;
  border-bottom: 1px solid #e0e0e0;
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-close:hover {
  color: #000;
}

.dialog-body {
  flex: 1;
  padding: 8px 12px;
  overflow-y: auto;
}

.hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: #666;
}

.select-all-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  padding: 6px 10px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 12px;
}

.select-all-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.select-all-label input {
  cursor: pointer;
}

.selected-count {
  color: #666;
  font-size: 12px;
}

.loading,
.error {
  padding: 20px;
  text-align: center;
  font-size: 14px;
}

.loading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-text {
  font-size: 12px;
  color: #666;
}

.error {
  color: #c33;
}

.style-list-container {
  max-height: 360px;
  overflow-y: auto;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  background: #fafafa;
}

.style-list {
  margin: 0;
  padding: 8px 12px;
  list-style: none;
  font-size: 13px;
}

.style-item {
  border-bottom: 1px solid #f0f0f0;
}

.style-item:last-child {
  border-bottom: none;
}

.style-item-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  cursor: pointer;
  user-select: none;
}

.style-item-label input {
  flex-shrink: 0;
  cursor: pointer;
}

.style-name {
  flex: 1;
}

.empty-hint {
  padding: 24px;
  text-align: center;
  color: #999;
  font-size: 14px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid #e0e0e0;
}

.btn {
  padding: 6px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #1890ff;
  color: #fff;
  border-color: #1890ff;
}

.btn-primary:hover:not(:disabled) {
  background-color: #40a9ff;
  border-color: #40a9ff;
}

.btn-secondary {
  background: #fff;
  color: #333;
}

.btn-secondary:hover {
  background: #f5f5f5;
}
</style>
