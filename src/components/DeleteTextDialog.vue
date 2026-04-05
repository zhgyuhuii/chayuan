<template>
  <div class="delete-text-dialog">
    <div class="popup-header">
      <h2>删除文字所在行/列</h2>
      <p class="subtitle">在文档全部表格中查找包含关键词的单元格，删除其所在行或列</p>
    </div>
    <div class="popup-body">
      <template v-if="step === 'form'">
        <div class="form-group">
          <label>关键词</label>
          <input
            v-model="keyword"
            type="text"
            class="input-text"
            placeholder="输入要查找的文字"
            @keydown.enter="onSearch"
          />
        </div>
        <div class="form-group radio-group">
          <label>删除方式</label>
          <div class="radio-row">
            <label class="radio-item">
              <input v-model="deleteMode" type="radio" value="row" />
              <span>删除行</span>
            </label>
            <label class="radio-item">
              <input v-model="deleteMode" type="radio" value="column" />
              <span>删除列</span>
            </label>
          </div>
        </div>
        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
      </template>
      <template v-else-if="step === 'confirm'">
        <p class="confirm-msg">共找到 <strong>{{ resultCount }}</strong> 个相同的数据，是否删除每个文字所在的{{ deleteMode === 'row' ? '行' : '列' }}？</p>
        <p class="confirm-hint">点击“确定删除”将执行删除并关闭窗口。</p>
      </template>
      <template v-else-if="step === 'done'">
        <div class="result success">已删除 {{ deletedCount }} {{ deleteMode === 'row' ? '行' : '列' }}</div>
        <p class="confirm-hint">请点击“关闭”退出。</p>
      </template>
    </div>
    <div class="popup-footer">
      <template v-if="step === 'form'">
        <button type="button" class="btn btn-primary" @click="onSearch">确定</button>
        <button type="button" class="btn btn-secondary" @click="onClose">取消</button>
      </template>
      <template v-else-if="step === 'confirm'">
        <button type="button" class="btn btn-primary" @click="onConfirmDelete">确定删除</button>
        <button type="button" class="btn btn-secondary" @click="step = 'form'; errorMsg = ''">取消</button>
      </template>
      <template v-else>
        <button type="button" class="btn btn-primary" @click="onClose">关闭</button>
      </template>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DeleteTextDialog',
  data() {
    return {
      keyword: '',
      deleteMode: 'row',
      step: 'form', // form | confirm | done
      errorMsg: '',
      resultCount: 0,
      resultKeys: [],
      deletedCount: 0
    }
  },
  created() {
    const mode = this.$route && this.$route.query && this.$route.query.mode
    if (mode === 'column') this.deleteMode = 'column'
  },
  watch: {
    '$route.query.mode'(val) {
      this.deleteMode = val === 'column' ? 'column' : 'row'
    }
  },
  methods: {
    onSearch() {
      this.errorMsg = ''
      const trimmed = (this.keyword + '').trim()
      if (!trimmed) {
        this.errorMsg = '请输入关键词'
        return
      }
      const ret = this.searchInTables(trimmed, this.deleteMode === 'row')
      if (ret.msg) {
        this.errorMsg = ret.msg
        return
      }
      if (ret.count === 0) {
        this.errorMsg = '未找到包含“' + trimmed + '”的文字'
        return
      }
      this.resultCount = ret.count
      this.resultKeys = ret.keys
      this.step = 'confirm'
    },
    onConfirmDelete() {
      this.deletedCount = this.doDelete(this.resultKeys, this.deleteMode === 'row')
      this.step = 'done'
    },
    searchInTables(searchText, isRow) {
      try {
        const doc = window.Application && window.Application.ActiveDocument
        if (!doc) return { count: 0, keys: [], msg: '当前没有打开任何文档' }
        const tables = doc.Tables
        if (!tables || tables.Count === 0) return { count: 0, keys: [], msg: '文档中没有表格' }

        const keys = new Set()
        for (let ti = 1; ti <= tables.Count; ti++) {
          try {
            const table = tables.Item(ti)
            const rowCount = table.Rows.Count
            const colCount = table.Columns.Count
            if (isRow) {
              for (let r = 1; r <= rowCount; r++) {
                for (let c = 1; c <= colCount; c++) {
                  try {
                    const cell = table.Cell(r, c)
                    if (cell && cell.Range && cell.Range.Text) {
                      let cellText = cell.Range.Text
                      cellText = cellText.replace(/\r\n$/, '').replace(/\r$/, '').replace(/\n$/, '').replace(/\x07$/, '')
                      if (cellText.indexOf(searchText) !== -1) {
                        keys.add(`${ti},${r}`)
                        break
                      }
                    }
                  } catch (e) {}
                }
              }
            } else {
              for (let c = 1; c <= colCount; c++) {
                for (let r = 1; r <= rowCount; r++) {
                  try {
                    const cell = table.Cell(r, c)
                    if (cell && cell.Range && cell.Range.Text) {
                      let cellText = cell.Range.Text
                      cellText = cellText.replace(/\r\n$/, '').replace(/\r$/, '').replace(/\n$/, '').replace(/\x07$/, '')
                      if (cellText.indexOf(searchText) !== -1) {
                        keys.add(`${ti},${c}`)
                        break
                      }
                    }
                  } catch (e) {}
                }
              }
            }
          } catch (e) {
            console.warn('遍历表格失败:', e)
          }
        }
        return { count: keys.size, keys: Array.from(keys), msg: null }
      } catch (e) {
        console.error('searchInTables:', e)
        return { count: 0, keys: [], msg: (e.message || e) + '' }
      }
    },
    doDelete(keys, isRow) {
      try {
        const doc = window.Application && window.Application.ActiveDocument
        const tables = doc && doc.Tables
        if (!tables) return 0

        const byTable = new Map()
        for (const key of keys) {
          const [ti, val] = key.split(',').map(Number)
          if (!byTable.has(ti)) byTable.set(ti, [])
          byTable.get(ti).push(val)
        }

        let deleted = 0
        for (const [ti, indices] of byTable) {
          indices.sort((a, b) => b - a)
          const table = tables.Item(ti)
          const collection = isRow ? table.Rows : table.Columns
          for (let idx = 0; idx < indices.length; idx++) {
            try {
              collection.Item(indices[idx]).Delete()
              deleted++
            } catch (e) {
              console.error('删除失败:', e)
            }
          }
        }
        return deleted
      } catch (e) {
        console.error('doDelete:', e)
        return 0
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
.delete-text-dialog {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  color: #333;
  background: #f8fafc;
}

.popup-header {
  padding: 10px 14px 8px;
  border-bottom: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 0 0 8px 8px;
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
  padding: 12px 14px;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #334155;
}

.input-text {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 6px 10px;
  font-size: 13px;
  line-height: 1.3;
  color: #1e293b;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
}

.input-text:focus {
  outline: none;
  border-color: #3b82f6;
}

.radio-group .radio-row {
  display: flex;
  gap: 16px;
  margin-top: 4px;
}

.radio-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #334155;
}

.radio-item input {
  margin: 0;
  cursor: pointer;
}

.error {
  margin: 8px 0 0 0;
  font-size: 11px;
  color: #dc2626;
}

.confirm-msg {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: #1e293b;
}

.confirm-msg strong {
  color: #dc2626;
}

.confirm-hint {
  margin: 0;
  font-size: 11px;
  color: #64748b;
}

.result.success {
  margin: 0 0 8px 0;
  padding: 8px 10px;
  font-size: 13px;
  color: #166534;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 6px;
}

.popup-footer {
  display: flex;
  gap: 8px;
  padding: 10px 14px 12px;
  border-top: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 8px 8px 0 0;
}

.btn {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.btn-primary {
  color: #fff;
  background: #3b82f6;
}

.btn-primary:hover {
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
