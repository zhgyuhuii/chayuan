<template>
  <div class="document-template-select">
    <div class="dialog-header">
      <h3>新建文档</h3>
      <button class="btn-close" @click="onClose">×</button>
    </div>
    <div class="dialog-body">
      <p class="select-desc">从列表中选择一个文件，将复制一份打开并标记为新建</p>
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
        <div
          class="template-item template-item-blank"
          :class="{ selected: selectedId === '__blank__' }"
          @click="selectedId = '__blank__'"
        >
          <span class="item-name">空白文档</span>
        </div>
      </div>
      <div v-if="!templates.length && !selectedId" class="empty-hint">
        暂无模板，请先在「导入模板」中添加 .aidocx 模板
      </div>
      <div v-if="message" class="message" :class="message.type">
        {{ message.text }}
      </div>
    </div>
    <div class="dialog-footer">
      <button class="btn btn-secondary" @click="onClose">取消</button>
      <button class="btn btn-primary" :disabled="!selectedId || creating" @click="onConfirm">
        {{ creating ? '创建中...' : '确定' }}
      </button>
    </div>
  </div>
</template>

<script>
import { loadDocumentTemplates, setNewFileMarker, copyTemplateToDesktop } from '../utils/documentTemplates.js'

export default {
  name: 'DocumentTemplateSelect',
  data() {
    return {
      templates: [],
      selectedId: '__blank__',
      creating: false,
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
      if (!this.selectedId || this.creating) return
      this.creating = true
      this.message = null
      try {
        const app = window.Application
        if (!app || !app.Documents) {
          this.showMessage('无法访问 WPS 文档对象')
          return
        }
        if (this.selectedId === '__blank__') {
          const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform) || /Macintosh/.test(navigator.userAgent)
          if (isMac) {
            this.showMessage('Mac 版暂不支持空白文档，请选择模板创建')
            this.creating = false
            return
          }
          app.Documents.Add()
          const doc = app.ActiveDocument
          if (doc) setNewFileMarker(doc, true)
          this.onClose()
          return
        }
        const t = this.templates.find(x => x.id === this.selectedId)
        if (!t?.path) {
          this.showMessage('模板路径无效')
          return
        }
        const templatePath = t.path
        const copyResult = copyTemplateToDesktop(templatePath)
        if (!copyResult.ok) {
          this.showMessage(copyResult.error || '复制模板到桌面失败')
          return
        }
        
        // 将本地路径转换为 file:// URL 格式
        const convertToFileUrl = (localPath) => {
          if (!localPath) return null
          let path = String(localPath).replace(/\\/g, '/')
          // 如果路径不是以 / 开头（Windows 路径如 C:/），需要添加 /
          if (path.match(/^[A-Za-z]:/)) {
            path = '/' + path
          }
          // 确保路径以 / 开头
          if (!path.startsWith('/')) {
            path = '/' + path
          }
          return 'file://' + encodeURI(path)
        }
        
        const fileUrl = convertToFileUrl(copyResult.path)
        console.log('准备打开文档:', { localPath: copyResult.path, fileUrl })
        
        const openDocument = () => {
          try {
            // 优先使用 OpenFromUrl（参考 systemdemo.js 的实现）
            if (typeof app.Documents.OpenFromUrl === 'function' && fileUrl) {
              console.log('使用 OpenFromUrl 打开:', fileUrl)
              app.Documents.OpenFromUrl(fileUrl)
              // OpenFromUrl 是异步的，等待一下再获取文档
              setTimeout(() => {
                const doc = app.ActiveDocument
                if (doc) {
                  setNewFileMarker(doc, true)
                  this.onClose()
                } else {
                  console.warn('OpenFromUrl 后未找到活动文档，尝试其他方法')
                  this.tryAlternativeOpen(copyResult.path)
                }
              }, 300)
            } else if (typeof app.Documents.Open === 'function') {
              console.log('使用 Documents.Open 打开:', copyResult.path)
              const doc = app.Documents.Open(copyResult.path, false, false, true)
              if (doc) {
                setNewFileMarker(doc, true)
                this.onClose()
              } else {
                this.showMessage('打开文档失败：无法获取文档对象')
              }
            } else {
              this.showMessage('当前环境不支持打开文档')
            }
          } catch (e) {
            console.error('打开文档失败:', e)
            // 如果 OpenFromUrl 失败，尝试备用方法
            this.tryAlternativeOpen(copyResult.path)
          }
        }
        
        // 延迟打开，确保文件已完全写入
        setTimeout(openDocument, 100)
      } catch (e) {
        this.showMessage('创建文档失败：' + (e?.message || '未知错误'))
      } finally {
        this.creating = false
      }
    },
    tryAlternativeOpen(localPath) {
      try {
        const app = window.Application
        if (!app) {
          this.showMessage('Application 不可用')
          return
        }
        console.log('尝试备用打开方法:', localPath)
        if (typeof app.Documents.Open === 'function') {
          const doc = app.Documents.Open(localPath, false, false, true)
          if (doc) {
            setNewFileMarker(doc, true)
            this.onClose()
            return
          }
        }
        this.showMessage('打开文档失败：所有方法都失败')
      } catch (e) {
        console.error('备用打开方法失败:', e)
        this.showMessage('打开文档失败：' + (e?.message || '未知错误'))
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
.document-template-select {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 280px;
}
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
}
.dialog-header h3 {
  margin: 0;
  font-size: 16px;
}
.btn-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
  padding: 0 4px;
  line-height: 1;
}
.btn-close:hover {
  color: #333;
}
.dialog-body {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}
.select-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: #666;
  line-height: 1.5;
}
.template-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 240px;
  overflow-y: auto;
  margin-bottom: 12px;
}
.template-item {
  padding: 10px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}
.template-item:hover {
  border-color: #1890ff;
  background: #f0f8ff;
}
.template-item.selected {
  border-color: #1890ff;
  background: #e6f7ff;
}
.template-item-blank {
  border-style: dashed;
}
.item-name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.empty-hint {
  font-size: 13px;
  color: #999;
  text-align: center;
  padding: 24px 0;
}
.message {
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  margin-bottom: 12px;
}
.message.error {
  background: #fff2f0;
  color: #ff4d4f;
  border: 1px solid #ffccc7;
}
.message.info {
  background: #e6f7ff;
  color: #1890ff;
  border: 1px solid #91d5ff;
}
.dialog-footer {
  padding: 12px 16px;
  border-top: 1px solid #e0e0e0;
  text-align: right;
}
.btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid #ddd;
  margin-left: 8px;
}
.btn-primary {
  background: #1890ff;
  color: #fff;
  border-color: #1890ff;
}
.btn-primary:hover:not(:disabled) {
  background: #40a9ff;
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-secondary {
  background: #fff;
  color: #333;
}
.btn-secondary:hover {
  background: #f5f5f5;
}
</style>
