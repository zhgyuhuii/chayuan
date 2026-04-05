<template>
  <div class="append-replace">
    <div class="popup-header">
      <h2>追加或替换文字</h2>
      <p class="subtitle">在文档全部表格中查找并替换或追加</p>
    </div>
    <div class="popup-body">
      <div class="form-group">
        <label for="find">查找内容</label>
        <input
          id="find"
          v-model.trim="findContent"
          type="text"
          placeholder="要查找的字符串"
          class="input-text"
          @input="errorMsg = ''"
        />
      </div>
      <div class="form-group radio-row">
        <label class="radio-label">
          <input v-model="mode" type="radio" value="replace" name="mode" />
          <span>替换</span>
        </label>
        <label class="radio-label">
          <input v-model="mode" type="radio" value="append" name="mode" />
          <span>追加</span>
        </label>
      </div>
      <div v-if="mode === 'replace'" class="form-group">
        <label for="replace">替换内容</label>
        <input
          id="replace"
          v-model="replaceContent"
          type="text"
          placeholder="替换成的字符串"
          class="input-text"
        />
      </div>
      <div v-if="mode === 'append'" class="form-group">
        <label for="append">追加内容</label>
        <input
          id="append"
          v-model="appendContent"
          type="text"
          placeholder="在匹配内容后追加的字符串"
          class="input-text"
        />
      </div>
      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    </div>
    <div class="popup-footer">
      <button type="button" class="btn btn-primary" @click="onConfirm">确定</button>
      <button type="button" class="btn btn-secondary" @click="onCancel">取消</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AppendReplaceText',
  data() {
    return {
      findContent: '',
      mode: 'replace',
      replaceContent: '',
      appendContent: '',
      errorMsg: ''
    }
  },
  methods: {
    validate() {
      this.errorMsg = ''
      if (!this.findContent) {
        this.errorMsg = '请输入查找内容'
        return false
      }
      if (this.mode !== 'replace' && this.mode !== 'append') {
        this.errorMsg = '请选择“替换”或“追加”'
        return false
      }
      return true
    },
    normalizeCellText(s) {
      if (s == null || typeof s !== 'string') return ''
      return s.replace(/\r\n$/, '').replace(/\r$/, '').replace(/\n$/, '').replace(/\x07$/, '')
    },
    applyInDocument() {
      const doc = window.Application && window.Application.ActiveDocument
      if (!doc) {
        return { ok: false, msg: '当前没有打开任何文档' }
      }
      const tables = doc.Tables
      if (!tables || tables.Count === 0) {
        return { ok: false, msg: '文档中没有表格' }
      }
      const findStr = this.findContent
      let replaceCount = 0
      let cellCount = 0
      try {
        for (let t = 1; t <= tables.Count; t++) {
          const table = tables.Item(t)
          const rowCount = table.Rows.Count
          const colCount = table.Columns.Count
          for (let row = 1; row <= rowCount; row++) {
            for (let col = 1; col <= colCount; col++) {
              try {
                const cell = table.Cell(row, col)
                if (!cell || !cell.Range) continue
                cellCount++
                let text = cell.Range.Text
                if (text == null) text = ''
                const raw = this.normalizeCellText(text)
                if (raw.indexOf(findStr) === -1) continue
                let newText
                if (this.mode === 'replace') {
                  newText = raw.split(findStr).join(this.replaceContent)
                } else {
                  newText = raw.split(findStr).join(findStr + this.appendContent)
                }
                cell.Range.Text = newText
                replaceCount++
              } catch (e) {
                console.warn('处理单元格失败:', e)
              }
            }
          }
        }
        return { ok: true, replaceCount, cellCount, tableCount: tables.Count }
      } catch (e) {
        console.error('applyInDocument:', e)
        return { ok: false, msg: e.message || '操作失败' }
      }
    },
    onConfirm() {
      if (!this.validate()) return
      const res = this.applyInDocument()
      if (res.ok) {
        this.errorMsg = ''
        try {
          if (window.close) window.close()
        } catch (e) {}
      } else {
        this.errorMsg = res.msg || '操作失败'
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
.append-replace {
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
  margin-bottom: 10px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #334155;
}

.radio-row {
  margin-bottom: 8px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 20px;
}

.radio-label {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  font-weight: 400;
}

.radio-label input {
  margin-right: 6px;
}

.input-text {
  display: block;
  width: 100%;
  padding: 6px 10px;
  font-size: 13px;
  line-height: 1.3;
  color: #1e293b;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  box-sizing: border-box;
}

.input-text:focus {
  outline: none;
  border-color: #3b82f6;
}

.input-text::placeholder {
  color: #94a3b8;
}

.error {
  margin: 6px 0 0 0;
  font-size: 11px;
  color: #dc2626;
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
