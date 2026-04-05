<template>
  <div class="manual-col-width">
    <div class="popup-header">
      <h2>统一表格列宽</h2>
      <p class="subtitle">列宽（磅，5～500）</p>
    </div>
    <div class="popup-body">
      <div class="form-group">
        <label for="col-width">列宽</label>
        <input
          id="col-width"
          v-model.number="widthInput"
          type="number"
          min="5"
          max="500"
          step="1"
          placeholder="60"
          class="input-number"
          @input="errorMsg = ''"
          @keydown.enter="onConfirm"
        />
        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
      </div>
      <div class="result" v-if="resultMsg">{{ resultMsg }}</div>
    </div>
    <div class="popup-footer">
      <button type="button" class="btn btn-primary" @click="onConfirm">确定</button>
      <button type="button" class="btn btn-secondary" @click="onCancel">取消</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ManualColWidth',
  data() {
    return {
      widthInput: 60,
      errorMsg: '',
      resultMsg: ''
    }
  },
  methods: {
    validate() {
      this.errorMsg = ''
      const v = this.widthInput
      if (v === '' || v === null || v === undefined) {
        this.errorMsg = '请输入列宽数值'
        return null
      }
      const num = Number(v)
      if (Number.isNaN(num)) {
        this.errorMsg = '请输入有效数字'
        return null
      }
      if (num < 5 || num > 500) {
        this.errorMsg = '列宽须在 5～500 磅之间'
        return null
      }
      return Math.round(num)
    },
    applyColumnWidth(widthPt) {
      const doc = window.Application && window.Application.ActiveDocument
      if (!doc) {
        return { ok: false, msg: '当前没有打开任何文档' }
      }
      const tables = doc.Tables
      if (!tables || tables.Count === 0) {
        return { ok: false, msg: '文档中没有表格' }
      }
      let tableCount = 0
      let columnCount = 0
      try {
        for (let t = 1; t <= tables.Count; t++) {
          const table = tables.Item(t)
          const cols = table.Columns
          if (!cols) continue
          tableCount++
          for (let c = 1; c <= cols.Count; c++) {
            try {
              const col = cols.Item(c)
              if (col) {
                if (typeof col.SetWidth === 'function') {
                  col.SetWidth(widthPt, 0)
                } else if (typeof col.Width !== 'undefined') {
                  col.Width = widthPt
                }
                columnCount++
              }
            } catch (e) {
              console.warn('设置列宽失败:', e)
            }
          }
        }
        return { ok: true, tableCount, columnCount }
      } catch (e) {
        console.error('applyColumnWidth:', e)
        return { ok: false, msg: e.message || '设置失败' }
      }
    },
    onConfirm() {
      const widthPt = this.validate()
      if (widthPt == null) return
      const res = this.applyColumnWidth(widthPt)
      if (res.ok) {
        this.errorMsg = ''
        try {
          if (window.close) window.close()
        } catch (e) {}
      } else {
        this.errorMsg = res.msg || '操作失败'
        this.resultMsg = ''
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
.manual-col-width {
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
  margin-bottom: 8px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #334155;
}

.input-number {
  display: block;
  width: 100%;
  max-width: 120px;
  padding: 6px 10px;
  font-size: 13px;
  line-height: 1.3;
  color: #1e293b;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  box-sizing: border-box;
}

.input-number:focus {
  outline: none;
  border-color: #3b82f6;
}

.input-number::placeholder {
  color: #94a3b8;
}

.error {
  margin: 4px 0 0 0;
  font-size: 11px;
  color: #dc2626;
}

.result {
  margin-top: 8px;
  padding: 8px 10px;
  font-size: 11px;
  color: #166534;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 6px;
  line-height: 1.4;
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
