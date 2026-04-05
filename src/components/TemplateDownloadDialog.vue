<template>
  <div class="template-download-dialog">
    <div class="dialog-header">
      <h3>下载模板</h3>
      <button class="btn-close" @click="onClose">×</button>
    </div>
    <div class="dialog-body">
      <p class="select-desc">从列表中选择一个模板，点击确定后选择保存位置</p>
      <div class="template-list">
        <div
          v-for="t in templates"
          :key="t.id"
          class="template-item"
          :class="{ selected: selectedId === t.id }"
          :title="t.path"
          @click="selectedId = t.id"
        >
          <span class="item-name">{{ t.name }}</span>
        </div>
        <div v-if="!templates.length" class="empty-hint">
          暂无模板，请先在「导入模板」中添加 .aidocx 模板
        </div>
      </div>
      <div v-if="message" class="message" :class="message.type">
        {{ message.text }}
      </div>
    </div>
    <div class="dialog-footer">
      <button class="btn btn-secondary" @click="onClose">取消</button>
      <button class="btn btn-primary" :disabled="!selectedId || downloading" @click="onConfirm">
        {{ downloading ? '下载中...' : '确定' }}
      </button>
    </div>
  </div>
</template>

<script>
import { loadDocumentTemplates, copyFile } from '../utils/documentTemplates.js'

export default {
  name: 'TemplateDownloadDialog',
  data() {
    return {
      templates: [],
      selectedId: null,
      downloading: false,
      message: null
    }
  },
  mounted() {
    this.templates = loadDocumentTemplates()
  },
  methods: {
    showMessage(text, type = 'error') {
      this.message = { text, type }
      setTimeout(() => {
        this.message = null
      }, 3000)
    },
    async onConfirm() {
      if (!this.selectedId || this.downloading) return
      
      const t = this.templates.find(x => x.id === this.selectedId)
      if (!t?.path) {
        this.showMessage('模板路径无效')
        return
      }

      this.downloading = true
      this.message = null

      try {
        const app = window.Application
        if (!app) {
          this.showMessage('Application 不可用')
          return
        }

        const templatePath = t.path
        const templateName = t.name || 'template'
        const baseName = templateName.replace(/\.(aidocx|docx)$/i, '')
        const defaultFileName = baseName + '.docx'

        // 弹出文件另存为对话框
        let savePath = null

        // 优先使用 GetSaveAsFileName
        if (typeof app.GetSaveAsFileName === 'function') {
          try {
            const fileFilter = 'Word文档 (*.docx), *.docx'
            const path = app.GetSaveAsFileName(defaultFileName, fileFilter, 1, '下载模板', '保存')
            if (path && path !== false && String(path).trim()) {
              savePath = String(path).replace(/^file:\/\//i, '').replace(/\\\\/g, '/')
            }
          } catch (e) {
            console.warn('GetSaveAsFileName 失败，尝试 FileDialog:', e?.message)
          }
        }

        // 回退到 FileDialog(2) msoFileDialogSaveAs
        if (!savePath) {
          try {
            const fd = app.FileDialog(2) // 2 = msoFileDialogSaveAs
            fd.Title = '下载模板'
            fd.InitialFileName = defaultFileName
            fd.Filters.Clear()
            fd.Filters.Add('Word文档 (*.docx)', '*.docx', 1)
            fd.FilterIndex = 1

            if (fd.Show() === -1) {
              const item = fd.SelectedItems.Item(1)
              if (item) {
                savePath = String(item).replace(/^file:\/\//i, '').replace(/\\\\/g, '/')
              }
            }
          } catch (e) {
            console.error('FileDialog 失败:', e)
            this.showMessage('无法打开文件保存对话框：' + (e?.message || '未知错误'))
            return
          }
        }

        if (!savePath) {
          // 用户取消了保存
          this.downloading = false
          return
        }

        // 确保保存路径的后缀是 .docx
        let finalSavePath = savePath
        if (!finalSavePath.toLowerCase().endsWith('.docx')) {
          if (finalSavePath.endsWith('.')) {
            finalSavePath = finalSavePath + 'docx'
          } else {
            finalSavePath = finalSavePath + '.docx'
          }
        }

        console.log('准备复制模板:', { from: templatePath, to: finalSavePath })

        // 复制文件到目标位置
        const isWin = typeof ActiveXObject !== 'undefined'
        const srcForFs = isWin ? templatePath.replace(/\//g, '\\') : templatePath.replace(/\\/g, '/')
        const destForFs = isWin ? finalSavePath.replace(/\//g, '\\') : finalSavePath.replace(/\\/g, '/')

        const copySuccess = copyFile(srcForFs, destForFs)
        
        if (copySuccess) {
          this.showMessage('模板下载成功：' + finalSavePath.split(/[/\\]/).pop(), 'success')
          setTimeout(() => {
            this.onClose()
          }, 1500)
        } else {
          this.showMessage('复制模板失败，请检查源文件是否存在或目标位置是否有写入权限')
        }
      } catch (e) {
        console.error('下载模板失败:', e)
        this.showMessage('下载模板失败：' + (e?.message || '未知错误'))
      } finally {
        this.downloading = false
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
.template-download-dialog {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 400px;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
}

.dialog-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
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
  padding: 16px;
  overflow-y: auto;
}

.select-desc {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #666;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.template-item {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.template-item:hover {
  border-color: #4a90e2;
  background-color: #f5f8ff;
}

.template-item.selected {
  border-color: #4a90e2;
  background-color: #e8f2ff;
}

.item-name {
  font-size: 14px;
  color: #333;
  word-break: break-all;
}

.empty-hint {
  padding: 20px;
  text-align: center;
  color: #999;
  font-size: 13px;
}

.message {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
}

.message.error {
  background-color: #fee;
  color: #c33;
}

.message.success {
  background-color: #efe;
  color: #3c3;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
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

.btn-secondary {
  background-color: #fff;
  color: #333;
}

.btn-secondary:hover {
  background-color: #f5f5f5;
}

.btn-primary {
  background-color: #4a90e2;
  color: #fff;
  border-color: #4a90e2;
}

.btn-primary:hover:not(:disabled) {
  background-color: #357abd;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
