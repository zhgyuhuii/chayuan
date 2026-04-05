<template>
  <div class="document-declassify-dialog">
    <div class="popup-header">
      <h2>文档脱密</h2>
      <p class="subtitle">自动提取涉密关键词，确认后将原文替换为占位符，并把恢复载荷加密保存到当前文档。</p>
    </div>

    <div class="popup-body">
      <template v-if="step === 'done'">
        <div class="result success">
          已完成占位符脱密，共替换 {{ successInfo.replacementCount }} 处，涉及 {{ successInfo.matchedKeywordCount }} 个关键词。
        </div>
        <p class="confirm-hint">当前文档已标记为脱密状态，可通过“密码复原”输入密码恢复原文。</p>
      </template>

      <template v-else>
        <div v-if="loading" class="loading-panel">
          <div class="loading-title">正在调用“涉密关键词提取”助手...</div>
          <div class="loading-hint">请稍候，系统正在分析全文并生成关键词与占位符映射。</div>
        </div>

        <template v-else>
          <p v-if="assistantError" class="warning">{{ assistantError }}</p>
          <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

          <div class="summary-grid">
            <div class="summary-card">
              <div class="summary-label">命中关键词</div>
              <div class="summary-value">{{ previewInfo.matchedKeywordCount }}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">占位替换次数</div>
              <div class="summary-value">{{ previewInfo.replacementCount }}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">未命中关键词</div>
              <div class="summary-value">{{ previewInfo.unmatchedKeywordEntries.length }}</div>
            </div>
          </div>

          <div class="section-header">
            <div>
              <div class="section-title">涉密关键词确认</div>
              <div class="section-hint">可修改、追加、删除关键词和占位符。</div>
            </div>
            <button type="button" class="btn btn-secondary" @click="addRow">添加关键词</button>
          </div>

          <div class="keyword-table">
            <div class="keyword-table-header">
              <span>关键词</span>
              <span>占位符</span>
              <span>类别</span>
              <span>风险级别</span>
              <span>操作</span>
            </div>
            <div
              v-for="(row, index) in keywordRows"
              :key="`keyword-${index}`"
              class="keyword-table-row"
            >
              <input
                v-model="row.term"
                type="text"
                class="input-text"
                placeholder="如：解放军"
                @input="onKeywordInput"
              />
              <input
                v-model="row.replacementToken"
                type="text"
                class="input-text"
                placeholder="留空则自动生成随机占位符"
                @input="onKeywordInput"
              />
              <input
                v-model="row.category"
                type="text"
                class="input-text"
                placeholder="类别"
                @input="onKeywordInput"
              />
              <select v-model="row.riskLevel" class="input-text" @change="onKeywordInput">
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
              <button
                type="button"
                class="btn btn-danger btn-small"
                :disabled="keywordRows.length === 1"
                @click="removeRow(index)"
              >
                删除
              </button>
            </div>
          </div>

          <div v-if="previewInfo.unmatchedKeywordEntries.length > 0" class="warning-block">
            下列关键词当前未在文档中命中，将不会参与替换：
            {{ previewInfo.unmatchedKeywordEntries.map(item => item.term).join('、') }}
          </div>

          <div v-if="previewInfo.matchedKeywordEntries.length > 0" class="preview-block">
            <div class="preview-title">命中预览</div>
            <div
              v-for="item in previewInfo.matchedKeywordEntries"
              :key="`matched-${item.term}`"
              class="preview-item"
            >
              <div class="preview-item-head">
                <code>{{ item.term }}</code>
                <span>命中 {{ item.occurrenceCount }} 次</span>
              </div>
              <div v-if="Array.isArray(item.hitPreviews) && item.hitPreviews.length" class="preview-item-snippets">
                {{ item.hitPreviews.map(hit => hit.snippet).join('；') }}
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>保存密码</label>
            <input
              v-model="password"
              type="password"
              class="input-text"
              placeholder="至少 8 位，需包含大小写、数字和特殊字符"
            />
          </div>
          <div class="form-group">
            <label>确认密码</label>
            <input
              v-model="confirmPassword"
              type="password"
              class="input-text"
              placeholder="再次输入密码"
              @keydown.enter="onConfirm"
            />
          </div>
          <p class="password-hint">
            密码规则：至少 8 位，必须同时包含大写字母、小写字母、数字和特殊字符。
          </p>
        </template>
      </template>
    </div>

    <div class="popup-footer">
      <template v-if="step === 'done'">
        <button type="button" class="btn btn-primary" @click="onClose">关闭</button>
      </template>
      <template v-else>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="loading || saving"
          @click="onConfirm"
        >
          {{ saving ? '正在脱密...' : '确定脱密' }}
        </button>
        <button type="button" class="btn btn-secondary" :disabled="saving" @click="onClose">取消</button>
      </template>
    </div>
  </div>
</template>

<script>
import { validateDeclassifyPassword } from '../utils/documentDeclassifyCrypto.js'
import {
  applyDocumentDeclassify,
  buildDeclassifyPreview,
  extractSecretKeywordsFromDocument,
  getCurrentDeclassifyStatus
} from '../utils/documentDeclassifyService.js'

function createEmptyRow() {
  return {
    term: '',
    category: '其他',
    riskLevel: 'medium',
    reason: '',
    replacementToken: ''
  }
}

export default {
  name: 'DocumentDeclassifyDialog',
  data() {
    return {
      loading: true,
      saving: false,
      step: 'form',
      assistantError: '',
      errorMsg: '',
      assistantOutput: '',
      extractionTaskId: '',
      keywordRows: [createEmptyRow()],
      password: '',
      confirmPassword: '',
      previewInfo: {
        matchedKeywordCount: 0,
        replacementCount: 0,
        unmatchedKeywordEntries: [],
        matchedKeywordEntries: []
      },
      successInfo: {
        matchedKeywordCount: 0,
        replacementCount: 0
      }
    }
  },
  mounted() {
    this.loadSuggestions()
  },
  methods: {
    async loadSuggestions() {
      this.loading = true
      this.errorMsg = ''
      this.assistantError = ''
      try {
        const status = getCurrentDeclassifyStatus()
        if (status.isDeclassified) {
          throw new Error('当前文档已经处于脱密状态，请使用“密码复原”恢复后再操作')
        }
        const result = await extractSecretKeywordsFromDocument()
        this.assistantOutput = result.assistantOutput
        this.extractionTaskId = result.extractionTaskId || ''
        this.keywordRows = result.keywordEntries.length
          ? result.keywordEntries.map(item => ({ ...item }))
          : [createEmptyRow()]
        if (result.keywordEntries.length === 0) {
          this.assistantError = '智能助手未识别到明确涉密关键词，请手工补充后再确认。'
        }
      } catch (error) {
        this.keywordRows = [createEmptyRow()]
        this.assistantError = error?.message
          ? `智能助手提取失败：${error.message}。你仍可手工补充关键词后继续。`
          : '智能助手提取失败，你仍可手工补充关键词后继续。'
      } finally {
        this.loading = false
        this.refreshPreview()
      }
    },
    addRow() {
      this.keywordRows.push(createEmptyRow())
      this.refreshPreview()
    },
    removeRow(index) {
      if (this.keywordRows.length === 1) return
      this.keywordRows.splice(index, 1)
      this.refreshPreview()
    },
    onKeywordInput() {
      this.errorMsg = ''
      this.refreshPreview()
    },
    refreshPreview() {
      try {
        const preview = buildDeclassifyPreview(this.keywordRows)
        if (preview.keywordEntries.length > 0) {
          this.keywordRows = preview.keywordEntries.map(item => ({ ...item }))
        }
        this.previewInfo = {
          matchedKeywordCount: preview.matchedKeywordEntries.length,
          replacementCount: preview.replacementMap.length,
          unmatchedKeywordEntries: preview.unmatchedKeywordEntries,
          matchedKeywordEntries: preview.matchedKeywordEntries
        }
      } catch (_) {
        this.previewInfo = {
          matchedKeywordCount: 0,
          replacementCount: 0,
          unmatchedKeywordEntries: [],
          matchedKeywordEntries: []
        }
      }
    },
    getCleanKeywordRows() {
      return this.keywordRows
        .map(item => ({
          term: String(item.term || '').trim(),
          replacementToken: String(item.replacementToken || '').trim(),
          category: String(item.category || '').trim(),
          riskLevel: String(item.riskLevel || 'medium').trim(),
          reason: String(item.reason || '').trim()
        }))
        .filter(item => item.term)
    },
    async onConfirm() {
      this.errorMsg = ''
      const cleanRows = this.getCleanKeywordRows()
      if (cleanRows.length === 0) {
        this.errorMsg = '请至少保留一个涉密关键词'
        return
      }
      if (this.password !== this.confirmPassword) {
        this.errorMsg = '两次输入的密码不一致'
        return
      }
      const validation = validateDeclassifyPassword(this.password)
      if (!validation.ok) {
        this.errorMsg = validation.errors[0] || '密码强度不符合要求'
        return
      }

      this.saving = true
      try {
        const result = await applyDocumentDeclassify({
          password: this.password,
          keywordEntries: cleanRows,
          assistantOutput: this.assistantOutput,
          extractionTaskId: this.extractionTaskId
        })
        this.successInfo = result
        this.step = 'done'
      } catch (error) {
        this.errorMsg = error?.message || '脱密失败，请稍后重试'
      } finally {
        this.saving = false
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
.document-declassify-dialog {
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
  padding: 14px 16px;
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

.loading-panel,
.result,
.warning-block,
.preview-block {
  border-radius: 8px;
  padding: 12px;
  line-height: 1.6;
}

.loading-panel {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
}

.loading-title {
  font-weight: 600;
}

.loading-hint,
.confirm-hint,
.password-hint {
  color: #6b7280;
  line-height: 1.6;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.summary-card {
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.summary-label {
  color: #6b7280;
}

.summary-value {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 700;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
}

.section-hint {
  margin-top: 4px;
  color: #6b7280;
}

.keyword-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.keyword-table-header,
.keyword-table-row {
  display: grid;
  grid-template-columns: 1.3fr 1.2fr 1fr 0.8fr 72px;
  gap: 8px;
  align-items: center;
}

.keyword-table-header {
  color: #6b7280;
  font-weight: 600;
}

.input-text {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
}

.form-group {
  margin-top: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
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

.btn-danger {
  color: #b91c1c;
  background: #fff1f2;
  border-color: #fecdd3;
}

.btn-small {
  padding: 7px 10px;
}

.error,
.warning {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 8px;
  line-height: 1.6;
}

.error {
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.warning,
.warning-block {
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fde68a;
}

.preview-block {
  margin-top: 12px;
  background: #fff;
  border: 1px solid #dbeafe;
}

.preview-title {
  font-weight: 600;
  margin-bottom: 8px;
}

.preview-item + .preview-item {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #dbeafe;
}

.preview-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.preview-item-snippets {
  margin-top: 4px;
  color: #475569;
  font-size: 12px;
}

.success {
  color: #166534;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}
</style>
