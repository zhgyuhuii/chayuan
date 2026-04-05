<template>
  <div class="document-template-import">
    <div class="dialog-header">
      <h3>导入模板</h3>
      <button class="btn-close" @click="onClose">×</button>
    </div>
    <div class="dialog-body">
      <p class="import-desc">选择 .aidocx 格式的模板文件，将添加到本地模板库，新建文档时可从此处选择。</p>
      <div class="import-actions">
        <input
          ref="fileInputRef"
          type="file"
          accept=".aidocx"
          style="display:none"
          @change="onFileInputChange"
        />
        <button class="btn btn-primary" :disabled="importing" @click="onSelectFile">
          {{ importing ? '添加中...' : '选择模板文件' }}
        </button>
      </div>
      <div v-if="message" class="message" :class="message.type">
        {{ message.text }}
      </div>
      <div class="template-list" v-if="templates.length">
        <p class="list-title">已保存的模板（共 {{ templates.length }} 个）</p>
        <ul class="list">
          <li v-for="t in templates" :key="t.id" class="list-item">
            <span class="item-name" :title="t.path">{{ t.name }}</span>
            <button class="btn-remove" type="button" title="删除" @click="removeTemplate(t.id)">×</button>
          </li>
        </ul>
      </div>
      <div v-else class="empty-hint">暂无模板，请点击上方按钮添加</div>
    </div>
    <div class="dialog-footer">
      <button class="btn btn-secondary" @click="onClose">关闭</button>
    </div>
  </div>
</template>

<script>
import {
  loadDocumentTemplates,
  addDocumentTemplate,
  addDocumentTemplateFromFile,
  removeDocumentTemplate,
  pickAidocFile,
  shouldUseFileInputForImport
} from '../utils/documentTemplates.js'

export default {
  name: 'DocumentTemplateImport',
  data() {
    return {
      templates: [],
      importing: false,
      message: null
    }
  },
  mounted() {
    this.refreshList()
  },
  methods: {
    refreshList() {
      this.templates = loadDocumentTemplates()
    },
    showMessage(text, type = 'success') {
      this.message = { text, type }
      setTimeout(() => {
        this.message = null
      }, 3000)
    },
    onSelectFile() {
      if (this.importing) return
      if (shouldUseFileInputForImport()) {
        this.$refs.fileInputRef?.click()
      } else {
        this.doImportByPath()
      }
    },
    async onFileInputChange(e) {
      const file = e.target?.files?.[0]
      if (!file) return
      e.target.value = ''
      await this.doImportFromFile(file)
    },
    async doImportFromFile(file) {
      if (this.importing) return
      this.importing = true
      this.message = null
      try {
        const result = await addDocumentTemplateFromFile(file)
        if (result.ok) {
          this.refreshList()
          this.showMessage('模板已添加到本地模板库', 'success')
        } else {
          this.showMessage(result.error || '添加失败', 'error')
        }
      } catch (e) {
        this.showMessage('添加失败：' + (e?.message || '未知错误'), 'error')
      } finally {
        this.importing = false
      }
    },
    async doImportByPath() {
      if (this.importing) return
      this.importing = true
      this.message = null
      try {
        const path = await pickAidocFile()
        if (!path) {
          this.importing = false
          return
        }
        const result = addDocumentTemplate(path)
        if (result.ok) {
          this.refreshList()
          this.showMessage('模板已添加到本地模板库', 'success')
        } else {
          this.showMessage(result.error || '添加失败', 'error')
        }
      } catch (e) {
        this.showMessage('添加失败：' + (e?.message || '未知错误'), 'error')
      } finally {
        this.importing = false
      }
    },
    removeTemplate(id) {
      if (!confirm('确定要删除此模板吗？')) return
      if (removeDocumentTemplate(id)) {
        this.refreshList()
        this.showMessage('已删除', 'success')
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
.document-template-import {
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
.import-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: #666;
  line-height: 1.5;
}
.import-actions {
  margin-bottom: 12px;
}
.btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid #ddd;
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
.message {
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  margin-bottom: 12px;
}
.message.success {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}
.message.error {
  background: #fff2f0;
  color: #ff4d4f;
  border: 1px solid #ffccc7;
}
.list-title {
  font-size: 13px;
  margin: 0 0 8px;
  color: #333;
}
.list {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
}
.list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
}
.list-item:last-child {
  border-bottom: none;
}
.item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.btn-remove {
  background: none;
  border: none;
  color: #999;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.btn-remove:hover {
  color: #ff4d4f;
}
.empty-hint {
  font-size: 13px;
  color: #999;
  text-align: center;
  padding: 24px 0;
}
.dialog-footer {
  padding: 12px 16px;
  border-top: 1px solid #e0e0e0;
  text-align: right;
}
.dialog-footer .btn {
  margin-left: 8px;
}
</style>
