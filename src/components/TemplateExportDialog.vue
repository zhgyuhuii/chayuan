<template>
  <div class="template-export-dialog">
    <div class="dialog-header">
      <h3>导出规则</h3>
      <button class="btn-close" @click="onCancel">×</button>
    </div>
    <div class="dialog-body">
      <div class="search-wrap">
        <input
          v-model="searchText"
          class="search-input"
          placeholder="按名称、标签搜索..."
          type="text"
        />
      </div>
      <div class="toolbar">
        <label class="select-all-label">
          <input
            type="checkbox"
            :checked="isAllFilteredSelected"
            :indeterminate="isSomeFilteredSelected"
            @change="toggleSelectAll"
          />
          <span>全选</span>
        </label>
        <span class="selected-count">已选 {{ selectedIds.size }} 项</span>
      </div>
      <div class="list-wrap">
        <div
          v-for="item in filteredRules"
          :key="item.id"
          class="list-row"
          :class="{ selected: selectedIds.has(item.id) }"
          @click="toggleSelect(item.id)"
        >
          <input
            type="checkbox"
            :checked="selectedIds.has(item.id)"
            class="row-checkbox"
            @click.stop
            @change="toggleSelect(item.id)"
          />
          <div class="row-content">
            <span class="row-name">{{ item.name }}</span>
            <span class="row-tag">{{ item.tag || '-' }}</span>
          </div>
        </div>
        <div v-if="!filteredRules.length" class="empty">
          {{ searchText ? '无匹配结果' : '暂无规则项，请先在规则制作中添加' }}
        </div>
      </div>
      <div class="export-options">
        <label class="filename-label">保存文件名：</label>
        <input
          v-model="exportFileName"
          class="filename-input"
          placeholder="chayuan_template.aidooo"
          type="text"
        />
        <span class="filename-hint">（将保存为 .aidooo 格式）</span>
      </div>
    </div>
    <div class="dialog-footer">
      <button class="btn btn-secondary" @click="onCancel">取消</button>
      <button class="btn btn-primary" :disabled="selectedIds.size === 0 || exporting" @click="onExport">
        {{ exporting ? '导出中...' : '确定导出' }}
      </button>
    </div>
  </div>
</template>

<script>
import { loadRulesFromDoc } from '../utils/templateRules.js'

const AIDOOO_FORMAT = 'aidooo'
const AIDOOO_VERSION = '1.0'

function toAidoooExport(rules) {
  return JSON.stringify({
    format: AIDOOO_FORMAT,
    version: AIDOOO_VERSION,
    exportedAt: new Date().toISOString(),
    rules: rules.map(r => ({
      ...r,
      reviewType: r.reviewType || 'none'
    }))
  }, null, 2)
}

export default {
  name: 'TemplateExportDialog',
  data() {
    const rules = loadRulesFromDoc().map(r => ({
      ...r,
      reviewType: r.reviewType || 'none',
      tag: r.tag || ''
    }))
    const defaultFileName = 'chayuan_template_' + new Date().toISOString().slice(0, 10) + '.aidooo'
    return {
      rules,
      searchText: '',
      selectedIds: new Set(),
      errorMsg: '',
      exporting: false,
      exportFileName: defaultFileName
    }
  },
  computed: {
    filteredRules() {
      const q = (this.searchText || '').trim().toLowerCase()
      if (!q) return this.rules
      return this.rules.filter(r => {
        const name = (r.name || '').toLowerCase()
        const tag = (r.tag || '').toLowerCase()
        const tags = (tag || '').split(',').map(t => t.trim()).filter(Boolean)
        if (name.includes(q)) return true
        if (tag.includes(q)) return true
        return tags.some(t => t.includes(q))
      })
    },
    isAllFilteredSelected() {
      const filtered = this.filteredRules
      if (!filtered.length) return false
      return filtered.every(r => this.selectedIds.has(r.id))
    },
    isSomeFilteredSelected() {
      const filtered = this.filteredRules
      if (!filtered.length) return false
      const count = filtered.filter(r => this.selectedIds.has(r.id)).length
      return count > 0 && count < filtered.length
    }
  },
  methods: {
    toggleSelect(id) {
      const next = new Set(this.selectedIds)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      this.selectedIds = next
    },
    toggleSelectAll() {
      const filtered = this.filteredRules
      if (!filtered.length) return
      const next = new Set(this.selectedIds)
      if (this.isAllFilteredSelected) {
        filtered.forEach(r => next.delete(r.id))
      } else {
        filtered.forEach(r => next.add(r.id))
      }
      this.selectedIds = next
    },
    onCancel() {
      try {
        if (window.close) window.close()
      } catch (e) {}
    },
    getFileSavePath() {
      const app = window.Application
      if (!app) return null

      let suggestedName = (this.exportFileName || '').trim()
      if (!suggestedName) suggestedName = 'chayuan_template_' + new Date().toISOString().slice(0, 10) + '.aidooo'
      if (!suggestedName.toLowerCase().endsWith('.aidooo')) {
        suggestedName = suggestedName.replace(/\.+$/, '') + '.aidooo'
      }

      function normalizePath(p) {
        if (!p || typeof p !== 'string') return p
        return String(p).replace(/^file:\/\//i, '').replace(/\\\\/g, '/')
      }

      // 优先使用 GetSaveAsFileName：独立的系统另存为对话框，可自定义文件名，仅 aidooo 格式
      // 参数: InitialFilename, FileFilter, FilterIndex, Title, ButtonText
      const fileFilter = '察元规则 (*.aidooo), *.aidooo'
      try {
        if (typeof app.GetSaveAsFileName === 'function') {
          const path = app.GetSaveAsFileName(
            suggestedName,
            fileFilter,
            1,
            '导出规则',
            '保存'
          )
          if (path && path !== false) {
            let p = normalizePath(String(path))
            if (!p.toLowerCase().endsWith('.aidooo')) p = p + (p.endsWith('.') ? '' : '.') + 'aidooo'
            return p
          }
          return null
        }
      } catch (e) {
        console.warn('GetSaveAsFileName 不可用，尝试 FileDialog:', e?.message)
      }

      // 回退到 FileDialog(2) msoFileDialogSaveAs
      try {
        const fileDialog = app.FileDialog(2)
        fileDialog.Title = '导出规则'
        fileDialog.InitialFileName = suggestedName
        fileDialog.Filters.Clear()
        fileDialog.Filters.Add('察元规则', '*.aidooo', 1)
        fileDialog.FilterIndex = 1
        if (fileDialog.Show() === -1) {
          const selectedPath = fileDialog.SelectedItems.Item(1)
          let p = normalizePath(selectedPath)
          if (!p.toLowerCase().endsWith('.aidooo')) p = p + (p.endsWith('.') ? '' : '.') + 'aidooo'
          return p
        }
      } catch (e) {
        console.error('getFileSavePath:', e)
      }
      return null
    },
    writeFile(path, content) {
      const fs = window.Application?.FileSystem
      if (!fs) return { ok: false }
      const tryWrite = (p) => {
        try {
          if (fs.writeFileString) {
            const ok = fs.writeFileString(p, content)
            if (ok) return true
          }
        } catch (e) {}
        try {
          if (fs.WriteFile) {
            const ok = fs.WriteFile(p, content)
            if (ok) return true
          }
        } catch (e) {}
        try {
          if (fs.writeAsBinaryString) {
            const bytes = new TextEncoder().encode(content)
            let bin = ''
            const chunk = 8192
            for (let i = 0; i < bytes.length; i += chunk) {
              bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
            }
            if (fs.writeAsBinaryString(p, bin)) return true
          }
        } catch (e) {}
        return false
      }
      if (tryWrite(path)) return { ok: true }
      const altPath = path.includes('\\') ? path.replace(/\\/g, '/') : path.replace(/\//g, '\\')
      if (altPath !== path && tryWrite(altPath)) return { ok: true }
      return { ok: false }
    },
    downloadAsFile(content, fileName) {
      try {
        const blob = new Blob([content], { type: 'application/x-aidooo;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName || 'chayuan_template.aidooo'
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        setTimeout(() => URL.revokeObjectURL(url), 500)
        return true
      } catch (e) {
        console.warn('Blob 下载失败:', e)
        return false
      }
    },
    onExport() {
      if (this.selectedIds.size === 0) {
        alert('请至少选择一项规则')
        return
      }
      if (this.exporting) return
      this.exporting = true
      try {
        const selectedRules = this.rules.filter(r => this.selectedIds.has(r.id))
        const path = this.getFileSavePath()
        if (!path) {
          alert('未选择保存路径，导出已取消')
          return
        }
        const content = toAidoooExport(selectedRules)
        const fileName = path.split(/[/\\]/).pop() || 'chayuan_template.aidooo'
        const pathForWrite = typeof ActiveXObject !== 'undefined' ? path.replace(/\//g, '\\') : path
        const writeResult = this.writeFile(pathForWrite, content)
        if (writeResult.ok) {
          alert(`已导出 ${selectedRules.length} 项规则到：\n${path}`)
          this.onCancel()
          return
        }
        if (this.downloadAsFile(content, fileName)) {
          alert(`无法直接写入所选路径，已改为下载方式保存。\n已导出 ${selectedRules.length} 项规则\n文件名：${fileName}\n请查看浏览器下载目录`)
          this.onCancel()
        } else {
          alert('无法写入所选路径，请尝试选择其他位置（如桌面或文档文件夹）')
        }
      } finally {
        this.exporting = false
      }
    }
  }
}
</script>

<style scoped>
.template-export-dialog {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', sans-serif;
  font-size: 13px;
  background: #fff;
}

.dialog-header {
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.dialog-header h3 {
  margin: 0;
  font-size: 15px;
}

.btn-close {
  font-size: 20px;
  line-height: 1;
  background: none;
  border: none;
  cursor: pointer;
  color: #999;
}

.btn-close:hover {
  color: #333;
}

.dialog-body {
  padding: 8px 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.search-wrap {
  margin-bottom: 8px;
  flex-shrink: 0;
}

.search-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
}

.search-input:focus {
  outline: none;
  border-color: #1890ff;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.select-all-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-weight: 500;
}

.select-all-label input {
  cursor: pointer;
}

.selected-count {
  font-size: 12px;
  color: #666;
}

.export-options {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  flex-shrink: 0;
}

.filename-label {
  font-size: 13px;
  color: #333;
  white-space: nowrap;
}

.filename-input {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
}

.filename-input:focus {
  outline: none;
  border-color: #1890ff;
}

.filename-hint {
  font-size: 12px;
  color: #999;
}

.list-wrap {
  flex: 1;
  overflow-y: auto;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  min-height: 200px;
}

.list-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  transition: background 0.15s;
}

.list-row:last-child {
  border-bottom: none;
}

.list-row:hover {
  background: #fafafa;
}

.list-row.selected {
  background: #e6f7ff;
}

.row-checkbox {
  flex-shrink: 0;
  cursor: pointer;
}

.row-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row-name {
  font-weight: 500;
  color: #333;
}

.row-tag {
  font-size: 12px;
  color: #999;
}

.empty {
  padding: 24px;
  text-align: center;
  color: #999;
  font-size: 13px;
}

.dialog-footer {
  padding: 8px 12px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

.btn {
  padding: 5px 12px;
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

.btn-secondary:hover {
  background: #e0e0e0;
}
</style>
