<template>
  <div class="document-template-select">
    <div class="dialog-header">
      <h3>{{ hostTitle }}</h3>
      <button class="btn-close" @click="onClose">×</button>
    </div>
    <div class="dialog-body">
      <p class="select-desc">选择模板将复制一份打开并标记为新建；保存时会提示另存为新文件</p>
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
          <button class="item-delete" title="删除模板" @click.stop="onDelete(t)">×</button>
        </div>
        <div
          class="template-item template-item-blank"
          :class="{ selected: selectedId === '__blank__' }"
          @click="selectedId = '__blank__'"
        >
          <span class="item-name">空白{{ hostLabel }}</span>
        </div>
      </div>
      <div v-if="!templates.length" class="empty-hint">
        暂无本类模板，可直接创建空白{{ hostLabel }}，或在「导入模板」中添加
      </div>
      <div v-if="message" class="message" :class="message.type">
        {{ message.text }}
      </div>
    </div>
    <div class="dialog-footer">
      <button class="btn btn-secondary" @click="onClose">取消</button>
      <button class="btn btn-primary" :disabled="!selectedId || creating" @click="onConfirm">
        {{ creating ? '创建中...' : '新建' }}
      </button>
    </div>
  </div>
</template>

<script>
import { loadDocumentTemplates, removeDocumentTemplate } from '../utils/documentTemplates.js'
import { createFromTemplate, detectHostKind } from '../utils/documentCreateFromTemplate.js'

export default {
  name: 'DocumentTemplateSelect',
  data() {
    return {
      hostKind: 'doc',
      templates: [],
      selectedId: '__blank__',
      creating: false,
      message: null
    }
  },
  computed: {
    hostLabel() {
      return { doc: '文档', sheet: '表格', slide: '演示' }[this.hostKind] || '文档'
    },
    hostTitle() {
      return `从模板新建${this.hostLabel}`
    }
  },
  mounted() {
    // 同宿主约束：模板库对话框只展示与当前宿主匹配的 kind
    this.hostKind = detectHostKind()
    this.refreshList()
  },
  methods: {
    refreshList() {
      this.templates = loadDocumentTemplates().filter(t => t.kind === this.hostKind)
      if (this.selectedId !== '__blank__' && !this.templates.some(t => t.id === this.selectedId)) {
        this.selectedId = '__blank__'
      }
    },
    showMessage(text, type = 'error') {
      this.message = { text, type }
      setTimeout(() => {
        this.message = null
      }, 4000)
    },
    async onDelete(t) {
      if (!t?.id) return
      if (!window.confirm(`删除模板「${t.name}」？（不删除磁盘上的模板文件）`)) return
      removeDocumentTemplate(t.id)
      this.refreshList()
    },
    async onConfirm() {
      if (!this.selectedId || this.creating) return
      this.creating = true
      this.message = null
      try {
        const result = await createFromTemplate(
          this.selectedId === '__blank__'
            ? { blank: this.hostKind }
            : { templateId: this.selectedId }
        )
        if (!result.ok) {
          this.showMessage(result.error || '创建失败')
          return
        }
        this.showMessage(`已创建：${result.name}${result.viaOs ? '（系统打开，请点击该文档继续）' : ''}`, 'info')
        setTimeout(() => this.onClose(), result.viaOs ? 2500 : 600)
      } catch (e) {
        this.showMessage('创建失败：' + (e?.message || '未知错误'))
      } finally {
        this.creating = false
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
  max-height: 260px;
  overflow-y: auto;
  margin-bottom: 12px;
}
.template-item {
  position: relative;
  padding: 10px 32px 10px 12px;
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
.item-delete {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #bbb;
  font-size: 16px;
  cursor: pointer;
  padding: 2px 6px;
  line-height: 1;
}
.item-delete:hover {
  color: #ff4d4f;
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
