<template>
  <div class="document-declassify-restore-dialog">
    <div class="popup-header">
      <h2>密码复原</h2>
      <p class="subtitle">输入执行占位符脱密时设置的密码，验证通过后恢复当前文档原文。</p>
    </div>

    <div class="popup-body">
      <template v-if="step === 'done'">
        <div class="result success">
          已完成复原，共恢复 {{ successInfo.replacementCount }} 处替换，涉及 {{ successInfo.keywordCount }} 个关键词。
        </div>
        <p class="confirm-hint">当前文档已恢复为未脱密状态。</p>
      </template>

      <template v-else>
        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

        <div class="summary-card">
          <div class="summary-label">当前状态</div>
          <div class="summary-value">{{ stateSummary.statusText }}</div>
          <div class="summary-hint">
            关键词 {{ stateSummary.keywordCount }} 个，替换 {{ stateSummary.replacementCount }} 处。
          </div>
        </div>

        <div class="form-group">
          <label>复原密码</label>
          <input
            v-model="password"
            type="password"
            class="input-text"
            placeholder="请输入执行占位符脱密时设置的密码"
            @keydown.enter="onConfirm"
          />
        </div>
        <p class="password-hint">若当前文档内容在脱密后被人工修改，系统会阻止直接复原以避免错位恢复。</p>
      </template>
    </div>

    <div class="popup-footer">
      <template v-if="step === 'done'">
        <button type="button" class="btn btn-primary" @click="onClose">关闭</button>
      </template>
      <template v-else>
        <button type="button" class="btn btn-primary" :disabled="restoring" @click="onConfirm">
          {{ restoring ? '正在复原...' : '确定复原' }}
        </button>
        <button type="button" class="btn btn-secondary" :disabled="restoring" @click="onClose">取消</button>
      </template>
    </div>
  </div>
</template>

<script>
import {
  getCurrentDeclassifyStatus,
  restoreDocumentDeclassify
} from '../utils/documentDeclassifyService.js'

export default {
  name: 'DocumentDeclassifyRestoreDialog',
  data() {
    return {
      password: '',
      restoring: false,
      errorMsg: '',
      step: 'form',
      stateSummary: {
        statusText: '未脱密',
        keywordCount: 0,
        replacementCount: 0
      },
      successInfo: {
        keywordCount: 0,
        replacementCount: 0
      }
    }
  },
  mounted() {
    const status = getCurrentDeclassifyStatus()
    if (!status.isDeclassified) {
      this.errorMsg = '当前文档不是脱密状态，无法执行复原'
      this.stateSummary.statusText = '未脱密'
      return
    }
    this.stateSummary = {
      statusText: '已占位脱密',
      keywordCount: Number(status.state?.keywordCount || 0),
      replacementCount: Number(status.state?.replacementCount || 0)
    }
  },
  methods: {
    async onConfirm() {
      this.errorMsg = ''
      if (!this.password) {
        this.errorMsg = '请输入复原密码'
        return
      }
      this.restoring = true
      try {
        const result = await restoreDocumentDeclassify(this.password)
        this.successInfo = result
        this.step = 'done'
      } catch (error) {
        this.errorMsg = error?.message || '复原失败，请稍后重试'
      } finally {
        this.restoring = false
      }
    },
    onClose() {
      try {
        if (window.close) window.close()
      } catch (_) {}
    }
  }
}
</script>

<style scoped>
.document-declassify-restore-dialog {
  box-sizing: border-box;
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f8fafc;
  color: #1f2937;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
}

.popup-header {
  flex-shrink: 0;
  padding: 12px 16px 10px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}

.popup-header h2 {
  margin: 0;
  font-size: 16px;
}

.subtitle {
  margin: 6px 0 0;
  color: #6b7280;
  line-height: 1.5;
}

.popup-body {
  flex: 1;
  min-height: 0;
  padding: 16px;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.popup-footer {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  background: #fff;
  border-top: 1px solid #e5e7eb;
  box-shadow: 0 -4px 12px rgba(15, 23, 42, 0.06);
}

.summary-card,
.result {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #fff;
}

.summary-label {
  color: #6b7280;
}

.summary-value {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 700;
}

.summary-hint,
.confirm-hint,
.password-hint {
  margin-top: 6px;
  color: #6b7280;
  line-height: 1.6;
}

.form-group {
  margin-top: 14px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
}

.input-text {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
}

.btn {
  padding: 8px 14px;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-primary {
  color: #fff;
  background: #2563eb;
}

.btn-secondary {
  color: #374151;
  background: #fff;
  border-color: #d1d5db;
}

.error {
  margin: 0 0 12px;
  padding: 10px 12px;
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  line-height: 1.6;
}

.success {
  color: #166534;
  background: #f0fdf4;
  border-color: #bbf7d0;
}
</style>
