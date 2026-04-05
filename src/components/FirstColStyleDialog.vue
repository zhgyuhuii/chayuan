<template>
  <div class="first-col-style-dialog">
    <div v-if="loading" class="loading-mask">
      <div class="loading-content">
        <span class="loading-text">正在加载样式，请稍后......</span>
      </div>
    </div>
    <div class="popup-header">
      <h2>{{ isFirstRow ? '第一行指定样式' : '第一列指定样式' }}</h2>
      <p class="subtitle">选择一种样式，将应用于文档所有表格的{{ isFirstRow ? '第一行' : '第一列' }}（类似开始菜单样式）</p>
      <div v-if="step === 'select' && !loading && !errorMsg" class="search-row">
        <input
          v-model="searchKeyword"
          type="text"
          class="search-input"
          placeholder="输入关键词筛选样式…"
          @input="onSearchInput"
        />
        <span v-if="searchKeyword" class="search-hint">共 {{ filteredList.length }} 个匹配</span>
      </div>
    </div>
    <div class="popup-body">
      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
      <div v-else-if="step === 'done'" class="result success">
        {{ resultMsg }}
      </div>
      <template v-else>
        <div v-if="filteredList.length === 0" class="no-match">无匹配样式，请修改关键词</div>
        <div v-else class="style-grid">
          <div
            v-for="item in filteredList"
            :key="item.id"
            class="style-card"
            :class="{ selected: selectedId === item.id }"
            :style="previewStyle(item)"
            @click="selectedId = item.id"
          >
            <span class="style-preview">{{ item.nameLocal || item.name || item.id }}</span>
            <span v-if="selectedId === item.id" class="selected-hint">已选中</span>
          </div>
        </div>
      </template>
    </div>
    <div class="popup-footer">
      <template v-if="step === 'done'">
        <button type="button" class="btn btn-primary" @click="onClose">关闭</button>
      </template>
      <template v-else>
        <button type="button" class="btn btn-primary" :disabled="!selectedId" @click="onConfirm">确定</button>
        <button type="button" class="btn btn-secondary" @click="onClose">取消</button>
      </template>
    </div>
  </div>
</template>

<script>
// Word: wdStyleTypeParagraph = 1
const WdStyleTypeParagraph = 1

export default {
  name: 'FirstColStyleDialog',
  data() {
    return {
      styleList: [],
      searchKeyword: '',
      selectedId: null,
      loading: true,
      errorMsg: '',
      step: 'select', // select | done
      resultMsg: ''
    }
  },
  computed: {
    isFirstRow() {
      const t = this.$route && this.$route.query && this.$route.query.target
      return t === 'row'
    },
    filteredList() {
      const kw = (this.searchKeyword + '').trim().toLowerCase()
      if (!kw) return this.styleList
      return this.styleList.filter((item) => {
        const name = (item.nameLocal || item.name || item.id || '').toLowerCase()
        return name.indexOf(kw) !== -1
      })
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.loadStyles()
    })
  },
  methods: {
    onSearchInput() {
      if (this.filteredList.length > 0 && !this.filteredList.some((item) => item.id === this.selectedId)) {
        this.selectedId = this.filteredList[0].id
      }
    },
    loadStyles() {
      this.loading = true
      this.errorMsg = ''
      const run = () => {
        const ret = this.getDocumentStyles()
        this.loading = false
        if (ret.msg) {
          this.errorMsg = ret.msg
          this.styleList = []
          return
        }
        this.styleList = ret.list || []
        if (this.styleList.length > 0 && !this.selectedId) {
          this.selectedId = this.styleList[0].id
        }
      }
      this.$nextTick(() => {
        setTimeout(run, 50)
      })
    },
    getDocumentStyles() {
      try {
        const doc = window.Application && window.Application.ActiveDocument
        if (!doc) return { list: [], msg: '当前没有打开任何文档' }
        const styles = doc.Styles
        if (!styles || !styles.Count) return { list: [], msg: '文档中无可用样式' }

        const list = []
        const count = styles.Count
        for (let i = 1; i <= count; i++) {
          try {
            const s = styles.Item(i)
            if (!s) continue
            const type = typeof s.Type !== 'undefined' ? s.Type : 1
            if (type !== WdStyleTypeParagraph) continue
            const nameLocal = (s.NameLocal != null && s.NameLocal !== '') ? String(s.NameLocal) : null
            const name = (s.Name != null && s.Name !== '') ? String(s.Name) : null
            const id = nameLocal || name || ('Style' + i)
            let fontName = ''
            let fontSize = 0
            try {
              if (s.Font) {
                if (s.Font.Name) fontName = String(s.Font.Name)
                if (typeof s.Font.Size === 'number') fontSize = s.Font.Size
              }
            } catch (e) {}
            list.push({ id, nameLocal, name, fontName, fontSize })
          } catch (e) {
            console.warn('读取样式失败:', e)
          }
        }
        return { list }
      } catch (e) {
        console.error('getDocumentStyles:', e)
        return { list: [], msg: (e.message || e) + '' }
      }
    },
    previewStyle(item) {
      const style = {}
      if (item.fontName) style.fontFamily = item.fontName
      if (item.fontSize > 0) style.fontSize = Math.min(item.fontSize, 24) + 'px'
      return style
    },
    onConfirm() {
      if (!this.selectedId) return
      this.errorMsg = ''
      const ret = this.isFirstRow
        ? this.applyStyleToFirstRow(this.selectedId)
        : this.applyStyleToFirstColumn(this.selectedId)
      if (ret.msg) {
        this.errorMsg = ret.msg
        return
      }
      const unit = this.isFirstRow ? '第一行' : '第一列'
      this.resultMsg = ret.cellCount != null
        ? '已应用到 ' + ret.cellCount + ' 个单元格，文档所有表格' + unit + '已使用所选样式。'
        : '已应用所选样式到文档所有表格' + unit + '。'
      this.step = 'done'
    },
    applyStyleToFirstRow(styleName) {
      try {
        const doc = window.Application && window.Application.ActiveDocument
        if (!doc) return { msg: '当前没有打开任何文档' }
        const tables = doc.Tables
        if (!tables || tables.Count === 0) return { msg: '文档中没有表格' }

        let cellCount = 0
        for (let ti = 1; ti <= tables.Count; ti++) {
          try {
            const table = tables.Item(ti)
            const colCount = table.Columns.Count
            for (let c = 1; c <= colCount; c++) {
              try {
                const cell = table.Cell(1, c)
                if (!cell || !cell.Range) continue
                try {
                  cell.Range.Style = styleName
                  cellCount++
                } catch (e1) {
                  try {
                    const styleObj = doc.Styles.Item(styleName)
                    if (styleObj) cell.Range.Style = styleObj
                    cellCount++
                  } catch (e2) {
                    console.warn('设置单元格样式失败:', e2)
                  }
                }
              } catch (e) {
                console.warn('获取单元格失败:', e)
              }
            }
          } catch (e) {
            console.warn('获取表格失败:', e)
          }
        }
        return { cellCount }
      } catch (e) {
        console.error('applyStyleToFirstRow:', e)
        return { msg: (e.message || e) + '' }
      }
    },
    applyStyleToFirstColumn(styleName) {
      try {
        const doc = window.Application && window.Application.ActiveDocument
        if (!doc) return { msg: '当前没有打开任何文档' }
        const tables = doc.Tables
        if (!tables || tables.Count === 0) return { msg: '文档中没有表格' }

        let cellCount = 0
        for (let ti = 1; ti <= tables.Count; ti++) {
          try {
            const table = tables.Item(ti)
            const rowCount = table.Rows.Count
            for (let r = 1; r <= rowCount; r++) {
              try {
                const cell = table.Cell(r, 1)
                if (!cell || !cell.Range) continue
                try {
                  cell.Range.Style = styleName
                  cellCount++
                } catch (e1) {
                  try {
                    const styleObj = doc.Styles.Item(styleName)
                    if (styleObj) cell.Range.Style = styleObj
                    cellCount++
                  } catch (e2) {
                    console.warn('设置单元格样式失败:', e2)
                  }
                }
              } catch (e) {
                console.warn('获取单元格失败:', e)
              }
            }
          } catch (e) {
            console.warn('获取表格失败:', e)
          }
        }
        return { cellCount }
      } catch (e) {
        console.error('applyStyleToFirstColumn:', e)
        return { msg: (e.message || e) + '' }
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
.first-col-style-dialog {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 280px;
  padding: 0;
  padding-bottom: 52px;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  color: #333;
  background: #f8fafc;
}

.loading-mask {
  position: absolute;
  inset: 0;
  z-index: 100;
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(248, 250, 252, 0.95);
  border-radius: 0 0 8px 8px;
}

.loading-content {
  padding: 16px 24px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.loading-text {
  font-size: 14px;
  color: #475569;
}

.popup-header {
  flex-shrink: 0;
  padding: 10px 14px 8px;
  border-bottom: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 0 0 8px 8px;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.search-input {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  font-size: 13px;
  line-height: 1.3;
  color: #1e293b;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  box-sizing: border-box;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.search-input::placeholder {
  color: #94a3b8;
}

.search-hint {
  flex-shrink: 0;
  font-size: 11px;
  color: #64748b;
}

.popup-header h2 {
  margin: 0 0 2px 0;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.subtitle {
  margin: 0;
  font-size: 11px;
  color: #64748b;
}

.popup-body {
  flex: 1;
  min-height: 0;
  padding: 12px 14px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.error {
  margin: 0;
  font-size: 12px;
  color: #dc2626;
}

.style-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}

.style-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 56px;
  padding: 8px 10px;
  background: #fff;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.style-card:hover {
  border-color: #94a3b8;
  background: #f8fafc;
}

.style-card.selected {
  border-color: #3b82f6;
  background: #eff6ff;
  box-shadow: 0 0 0 1px #3b82f6;
}

.style-preview {
  font-size: 13px;
  color: #1e293b;
  text-align: center;
  word-break: break-all;
  line-height: 1.3;
}

.style-card.selected .style-preview {
  color: #1e40af;
  font-weight: 500;
}

.selected-hint {
  margin-top: 4px;
  font-size: 11px;
  color: #2563eb;
  font-weight: 600;
}

.result.success {
  margin: 0;
  padding: 12px;
  font-size: 13px;
  color: #166534;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 8px;
  line-height: 1.5;
}

.no-match {
  margin: 12px 0 0 0;
  font-size: 12px;
  color: #64748b;
}

.popup-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  flex-shrink: 0;
  display: flex;
  gap: 8px;
  padding: 10px 14px 12px;
  border-top: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 8px 8px 0 0;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
}

.btn {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  color: #fff;
  background: #3b82f6;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  color: #475569;
  background: #f1f5f9;
}

.btn-secondary:hover {
  background: #e2e8f0;
}
</style>
