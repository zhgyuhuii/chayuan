<template>
  <div class="template-field-extract-dialog">
    <div class="popup-header">
      <div class="header-main">
        <h2>智能提取</h2>
        <p class="subtitle">提取结果先以列表展示，字段编辑与新增统一使用弹窗，确认后再写入规则和书签。</p>
      </div>
      <div class="header-actions">
        <button
          v-if="extractionTaskId"
          type="button"
          class="btn btn-secondary"
          @click="openTaskProgress(extractionTaskId)"
        >查看进度</button>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="loading || saving"
          @click="retryExtract"
        >{{ loading ? '提取中...' : '重试提取' }}</button>
      </div>
    </div>

    <div class="popup-body">
      <template v-if="step === 'done'">
        <div class="result success">
          已保存 {{ successInfo.ruleCount }} 条规则，并生成 {{ successInfo.bookmarkCount }} 个书签。
        </div>
      </template>

      <template v-else>
        <div v-if="loading" class="loading-card">
          <div class="loading-title">正在调用“表单智能提取助手”...</div>
          <div class="loading-hint">系统会分析全文并识别甲方、乙方、金额、地址、日期等字段，进度窗口可单独查看。</div>
        </div>

        <template v-else>
          <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
          <div v-if="assistantError" class="warning warning-card">
            <div class="warning-title">提取失败</div>
            <div>{{ assistantError }}</div>
            <pre v-if="assistantErrorDetail" class="warning-detail">{{ assistantErrorDetail }}</pre>
            <div class="warning-actions">
              <button
                v-if="extractionTaskId"
                type="button"
                class="btn btn-secondary btn-small"
                @click="openTaskProgress(extractionTaskId)"
              >查看进度</button>
              <button
                v-if="extractionTaskId"
                type="button"
                class="btn btn-secondary btn-small"
                @click="openTaskDetail(extractionTaskId)"
              >查看任务详情</button>
            </div>
          </div>

          <div class="toolbar">
            <div class="summary">识别到 {{ fieldRows.length }} 个字段定义</div>
            <div class="toolbar-actions">
              <button type="button" class="btn btn-secondary" @click="openAddDialog">添加字段</button>
            </div>
          </div>

          <div v-if="fieldRows.length === 0" class="empty-state">未识别到可用字段，可点击上方“添加字段”手工补充。</div>
          <div v-else class="field-table-wrap">
            <table class="field-table">
              <thead>
                <tr>
                  <th class="col-index">序号</th>
                  <th class="col-name">字段名称</th>
                  <th class="col-key">语义键</th>
                  <th class="col-type">数据类型</th>
                  <th class="col-review">审查方式</th>
                  <th class="col-required">必填</th>
                  <th class="col-mode">内容策略</th>
                  <th class="col-instance">实例数</th>
                  <th class="col-remark">备注预览</th>
                  <th class="col-action sticky-action">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(field, index) in fieldRows" :key="field.localId">
                  <td class="col-index">{{ index + 1 }}</td>
                  <td class="col-name">{{ field.name || '-' }}</td>
                  <td class="col-key mono">{{ field.semanticKey || '-' }}</td>
                  <td class="col-type">{{ getOptionLabel(dataTypeOptions, field.dataType) }}</td>
                  <td class="col-review">{{ getOptionLabel(reviewTypeOptions, field.reviewType) }}</td>
                  <td class="col-required">{{ field.required ? '是' : '否' }}</td>
                  <td class="col-mode">{{ getOptionLabel(sampleContentModeOptions, field.sampleContentMode) }}</td>
                  <td class="col-instance">{{ Array.isArray(field.detectedInstances) ? field.detectedInstances.length : 0 }}</td>
                  <td class="col-remark" :title="field.remark || field.fillHint || '-'">{{ field.remark || field.fillHint || '-' }}</td>
                  <td class="col-action sticky-action">
                    <div class="action-group">
                      <button type="button" class="btn btn-secondary btn-small" @click="openEditDialog(field.localId)">编辑</button>
                      <button type="button" class="btn btn-danger btn-small" @click="removeRow(index)">删除</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </template>
    </div>

    <div class="popup-footer">
      <template v-if="step === 'done'">
        <button type="button" class="btn btn-primary" @click="onClose">关闭</button>
      </template>
      <template v-else>
        <button type="button" class="btn btn-primary" :disabled="loading || saving" @click="onConfirm">
          {{ saving ? '正在生成规则...' : '确定' }}
        </button>
        <button type="button" class="btn btn-secondary" :disabled="saving" @click="onClose">取消</button>
      </template>
    </div>

    <div v-if="editorVisible" class="editor-modal-mask" @click.self="closeEditorDialog">
      <div class="editor-modal">
        <div class="editor-modal-header">
          <div>
            <div class="editor-modal-title">{{ editorMode === 'add' ? '添加字段' : '编辑字段' }}</div>
            <div class="editor-modal-hint">在弹窗中修改当前字段，点击确定后再写回列表。</div>
          </div>
          <button type="button" class="btn btn-secondary btn-small" @click="closeEditorDialog">关闭</button>
        </div>

        <div class="editor-modal-body">
          <div class="field-grid">
            <div class="form-group">
              <label>字段名称</label>
              <input v-model="editorDraft.name" class="input-text" placeholder="如：甲方" />
            </div>
            <div class="form-group">
              <label>语义键</label>
              <input v-model="editorDraft.semanticKey" class="input-text" placeholder="如：partyA" />
            </div>
            <div class="form-group">
              <label>标签</label>
              <input v-model="editorDraft.tag" class="input-text" placeholder="合同,主体" />
            </div>
            <div class="form-group">
              <label>填写提示</label>
              <input v-model="editorDraft.fillHint" class="input-text" placeholder="请输入合同甲方全称" />
            </div>
            <div class="form-group">
              <label>数据类型</label>
              <select v-model="editorDraft.dataType" class="input-text">
                <option v-for="opt in dataTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>审查方式</label>
              <select v-model="editorDraft.reviewType" class="input-text">
                <option v-for="opt in reviewTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
            <div class="form-group checkbox-group">
              <label>是否必填</label>
              <label class="checkbox-label">
                <input v-model="editorDraft.required" type="checkbox" />
                <span>必填</span>
              </label>
            </div>
            <div class="form-group checkbox-group">
              <label>是否参与审计</label>
              <label class="checkbox-label">
                <input v-model="editorDraft.auditEnabled" type="checkbox" />
                <span>参与审计</span>
              </label>
            </div>
            <div class="form-group">
              <label>审计优先级</label>
              <input v-model="editorDraft.auditPriority" type="number" min="1" max="100" class="input-text" />
            </div>
            <div class="form-group">
              <label>实例处理方式</label>
              <select v-model="editorDraft.instanceStrategy" class="input-text">
                <option v-for="opt in instanceStrategyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>内容策略</label>
              <select v-model="editorDraft.sampleContentMode" class="input-text">
                <option v-for="opt in sampleContentModeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>样例内容</label>
              <input v-model="editorDraft.sampleContent" class="input-text" placeholder="样例内容或保留留空" />
            </div>
            <div class="form-group">
              <label>最小长度</label>
              <input v-model="editorDraft.constraints.minLength" type="number" min="0" class="input-text" />
            </div>
            <div class="form-group">
              <label>最大长度</label>
              <input v-model="editorDraft.constraints.maxLength" type="number" min="0" class="input-text" />
            </div>
            <div class="form-group">
              <label>须包含</label>
              <input v-model="editorDraft.constraints.mustContain" class="input-text" placeholder="留空不限制" />
            </div>
            <div class="form-group">
              <label>不许包含</label>
              <input v-model="editorDraft.constraints.mustNotContain" class="input-text" placeholder="留空不限制" />
            </div>
            <div class="form-group">
              <label>正则匹配</label>
              <input v-model="editorDraft.constraints.pattern" class="input-text" placeholder="留空不校验" />
            </div>
            <div class="form-group full-row">
              <label>审查规则</label>
              <textarea v-model="editorDraft.reviewRule" class="input-text textarea" rows="2" />
            </div>
            <div class="form-group">
              <label>审查提示</label>
              <input v-model="editorDraft.reviewHint" class="input-text" />
            </div>
            <div class="form-group">
              <label>备注</label>
              <input v-model="editorDraft.remark" class="input-text" />
            </div>
            <div class="form-group full-row">
              <label>智能提取提示</label>
              <textarea v-model="editorDraft.extractionHints" class="input-text textarea" rows="2" />
            </div>
          </div>

          <div class="instance-section">
            <div class="instance-title">识别实例</div>
            <div v-if="editorDraft.detectedInstances.length === 0" class="instance-empty">暂无实例，将仅保存规则定义。</div>
            <div v-else class="instance-list">
              <div v-for="(instance, idx) in editorDraft.detectedInstances" :key="`${editorDraft.localId || 'draft'}-instance-${idx}`" class="instance-item">
                <div class="instance-value">{{ instance.value }}</div>
                <div class="instance-meta">
                  <span v-if="instance.groupLabel">分组：{{ instance.groupLabel }}</span>
                  <span v-if="instance.prefix">前文：{{ instance.prefix }}</span>
                  <span v-if="instance.suffix">后文：{{ instance.suffix }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="editor-modal-footer">
          <span v-if="editorError" class="editor-error">{{ editorError }}</span>
          <div class="editor-footer-actions">
            <button type="button" class="btn btn-secondary" @click="closeEditorDialog">取消</button>
            <button type="button" class="btn btn-primary" @click="confirmEditorDialog">确定</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  DATA_TYPES,
  INSTANCE_STRATEGY_OPTIONS,
  REVIEW_TYPES,
  SAMPLE_CONTENT_MODE_OPTIONS
} from '../utils/templateRules.js'
import {
  buildFieldDraftForDialog,
  startFormFieldExtractTask,
  saveExtractedFieldsToRulesAndBookmarks
} from '../utils/formFieldExtractService.js'
import { getTaskById } from '../utils/taskListStore.js'
import { DEFAULT_TASK_LIST_WINDOW_HEIGHT, DEFAULT_TASK_LIST_WINDOW_WIDTH } from '../utils/taskListWindowManager.js'

function createEmptyField() {
  return buildFieldDraftForDialog({
    name: '',
    semanticKey: '',
    fillHint: '',
    tag: '',
    required: false,
    dataType: 'string',
    reviewType: 'none',
    reviewRule: '',
    reviewHint: '',
    remark: '',
    sampleContentMode: 'keep',
    sampleContent: '',
    auditEnabled: true,
    auditPriority: 50,
    instanceStrategy: 'semantic-group',
    extractionHints: '',
    constraints: {
      minLength: '',
      maxLength: '',
      mustContain: '',
      mustNotContain: '',
      pattern: ''
    },
    detectedInstances: []
  })
}

function cloneDraftField(field, localId = '') {
  const cloned = JSON.parse(JSON.stringify(field || {}))
  const normalized = buildFieldDraftForDialog(cloned)
  return {
    ...normalized,
    localId: String(localId || field?.localId || normalized.localId || '')
  }
}

export default {
  name: 'TemplateFieldExtractDialog',
  data() {
    return {
      loading: true,
      saving: false,
      step: 'form',
      errorMsg: '',
      assistantError: '',
      assistantErrorDetail: '',
      extractionTaskId: '',
      fieldRows: [],
      editorVisible: false,
      editorMode: 'add',
      editorSourceLocalId: '',
      editorDraft: createEmptyField(),
      editorError: '',
      dataTypeOptions: DATA_TYPES,
      reviewTypeOptions: REVIEW_TYPES,
      sampleContentModeOptions: SAMPLE_CONTENT_MODE_OPTIONS,
      instanceStrategyOptions: INSTANCE_STRATEGY_OPTIONS,
      successInfo: {
        ruleCount: 0,
        bookmarkCount: 0
      }
    }
  },
  mounted() {
    this.loadFields()
  },
  methods: {
    async loadFields() {
      this.loading = true
      this.errorMsg = ''
      this.assistantError = ''
      this.assistantErrorDetail = ''
      this.editorVisible = false
      try {
        const { taskId, promise } = startFormFieldExtractTask()
        this.extractionTaskId = String(taskId || '')
        if (this.extractionTaskId) {
          this.openTaskProgress(this.extractionTaskId)
        }
        const result = await promise
        this.fieldRows = result.fields.map(item => buildFieldDraftForDialog(item))
        if (this.fieldRows.length === 0) {
          this.assistantError = '未识别到明确字段，你可以手工添加后继续。'
        }
      } catch (error) {
        this.fieldRows = []
        const task = this.extractionTaskId ? getTaskById(this.extractionTaskId) : null
        this.assistantError = task?.error || error?.message || '智能提取失败，请手工补充字段。'
        this.assistantErrorDetail = this.buildAssistantErrorDetail(task, error)
      } finally {
        this.loading = false
      }
    },
    retryExtract() {
      this.loadFields()
    },
    openTaskProgress(taskId) {
      const normalizedTaskId = String(taskId || '').trim()
      if (!normalizedTaskId) return
      try {
        const href = String(window.location.href || '')
        const base = href.split('#')[0] || href
        const url = `${base}#/task-progress-dialog?taskId=${encodeURIComponent(normalizedTaskId)}`
        if (window.Application?.ShowDialog) {
          window.Application.ShowDialog(
            url,
            '任务进度',
            560 * (window.devicePixelRatio || 1),
            320 * (window.devicePixelRatio || 1),
            false
          )
          return
        }
        window.open(url, '_blank')
      } catch (_) {}
    },
    openTaskDetail(taskId) {
      const normalizedTaskId = String(taskId || '').trim()
      if (!normalizedTaskId) return
      try {
        const href = String(window.location.href || '')
        const base = href.split('#')[0] || href
        const url = `${base}#/popup?taskId=${encodeURIComponent(normalizedTaskId)}&detail=1`
        if (window.Application?.ShowDialog) {
          window.Application.ShowDialog(
            url,
            '任务清单',
            DEFAULT_TASK_LIST_WINDOW_WIDTH * (window.devicePixelRatio || 1),
            DEFAULT_TASK_LIST_WINDOW_HEIGHT * (window.devicePixelRatio || 1),
            false
          )
          return
        }
        window.open(url, '_blank')
      } catch (_) {}
    },
    buildAssistantErrorDetail(task, error) {
      const detailLines = []
      if (this.extractionTaskId) {
        detailLines.push(`任务编号：${this.extractionTaskId}`)
      }
      if (task?.data?.modelDisplayName) {
        detailLines.push(`执行模型：${task.data.modelDisplayName}`)
      }
      if (task?.updatedAt) {
        detailLines.push(`失败时间：${new Date(task.updatedAt).toLocaleString()}`)
      }
      if (task?.data?.progressStage) {
        const stageMap = {
          preparing: '准备任务',
          calling_model: '调用模型',
          applying_result: '写回结果',
          failed: '任务失败',
          cancelled: '任务取消'
        }
        detailLines.push(`失败阶段：${stageMap[task.data.progressStage] || task.data.progressStage}`)
      }
      const rawMessage = String(error?.message || '').trim()
      if (rawMessage && rawMessage !== String(task?.error || '').trim()) {
        detailLines.push(`附加信息：${rawMessage}`)
      }
      return detailLines.join('\n')
    },
    getOptionLabel(options, value) {
      const matched = (options || []).find(item => item.value === value)
      return matched?.label || value || '-'
    },
    openAddDialog() {
      this.editorMode = 'add'
      this.editorSourceLocalId = ''
      this.editorDraft = createEmptyField()
      this.editorError = ''
      this.editorVisible = true
    },
    openEditDialog(localId) {
      const current = this.fieldRows.find(item => item.localId === String(localId || ''))
      if (!current) return
      this.editorMode = 'edit'
      this.editorSourceLocalId = current.localId
      this.editorDraft = cloneDraftField(current, current.localId)
      this.editorError = ''
      this.editorVisible = true
    },
    closeEditorDialog() {
      this.editorVisible = false
      this.editorError = ''
      this.editorSourceLocalId = ''
      this.editorDraft = createEmptyField()
    },
    confirmEditorDialog() {
      const normalizedName = String(this.editorDraft?.name || '').trim()
      if (!normalizedName) {
        this.editorError = '字段名称不能为空'
        return
      }
      const normalizedField = cloneDraftField({
        ...this.editorDraft,
        name: normalizedName
      }, this.editorMode === 'edit' ? this.editorSourceLocalId : '')
      if (this.editorMode === 'edit') {
        const index = this.fieldRows.findIndex(item => item.localId === this.editorSourceLocalId)
        if (index < 0) {
          this.editorError = '未找到原始字段，无法保存'
          return
        }
        this.fieldRows.splice(index, 1, normalizedField)
      } else {
        this.fieldRows.push(normalizedField)
      }
      this.closeEditorDialog()
    },
    removeRow(index) {
      this.fieldRows.splice(index, 1)
    },
    buildPayload() {
      return this.fieldRows
        .map(row => ({
          ...row,
          name: String(row.name || '').trim(),
          semanticKey: String(row.semanticKey || '').trim(),
          fillHint: String(row.fillHint || '').trim(),
          tag: String(row.tag || '').trim(),
          reviewType: String(row.reviewType || 'none'),
          reviewRule: String(row.reviewRule || '').trim(),
          reviewHint: String(row.reviewHint || '').trim(),
          remark: String(row.remark || '').trim(),
          sampleContentMode: String(row.sampleContentMode || 'keep'),
          sampleContent: String(row.sampleContent || '').trim(),
          extractionHints: String(row.extractionHints || '').trim()
        }))
        .filter(row => row.name)
    },
    async onConfirm() {
      this.errorMsg = ''
      const payload = this.buildPayload()
      if (payload.length === 0) {
        this.errorMsg = '请至少保留一个字段'
        return
      }
      this.saving = true
      try {
        const result = saveExtractedFieldsToRulesAndBookmarks(payload)
        this.successInfo = {
          ruleCount: result.resolvedRules.length,
          bookmarkCount: result.bookmarkOperationsCount
        }
        this.step = 'done'
      } catch (error) {
        this.errorMsg = error?.message || '保存失败'
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
.template-field-extract-dialog {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  min-width: 1220px;
  background: #f8fafc;
  color: #1f2937;
  font-size: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.popup-header,.popup-footer{padding:12px 16px;background:#fff;border-color:#e5e7eb}
.popup-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:1px solid #e5e7eb}
.popup-footer{display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #e5e7eb}
.header-main{min-width:0}
.header-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.popup-header h2{margin:0;font-size:16px}
.subtitle{margin:6px 0 0;color:#6b7280;line-height:1.6}
.popup-body{flex:1;padding:14px 16px;overflow:auto}
.toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}
.toolbar-actions{display:flex;gap:8px;flex-wrap:wrap}
.summary{font-weight:600}
.field-table-wrap{background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:auto}
.field-table{width:100%;min-width:1230px;border-collapse:collapse;table-layout:fixed}
.field-table th,.field-table td{padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top}
.field-table th{background:#f8fafc;font-weight:600;color:#475569}
.field-table tbody tr:hover{background:#f8fafc}
.field-table tbody tr:last-child td{border-bottom:none}
.col-index{width:56px}
.col-name{width:150px}
.col-key{width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.col-type{width:90px}
.col-review{width:100px}
.col-required{width:66px}
.col-mode{width:90px}
.col-instance{width:70px}
.col-remark{width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.col-action{width:160px}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.sticky-action{position:sticky;right:0;z-index:1;background:#fff;box-shadow:-8px 0 12px rgba(15,23,42,.05)}
.field-table thead .sticky-action{z-index:2;background:#f8fafc}
.action-group{display:flex;gap:8px;justify-content:flex-end}
.field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.form-group{display:flex;flex-direction:column;gap:6px}
.full-row{grid-column:1 / -1}
.checkbox-group{justify-content:flex-end}
.checkbox-label{display:flex;align-items:center;gap:6px}
.input-text{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;background:#fff}
.textarea{resize:vertical}
.instance-section{margin-top:12px;padding-top:12px;border-top:1px dashed #e5e7eb}
.instance-title{margin-bottom:8px;font-weight:600}
.instance-list{display:flex;flex-direction:column;gap:8px}
.instance-item{padding:8px 10px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px}
.instance-value{font-weight:600}
.instance-meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:4px;color:#6b7280}
.instance-empty,.empty-state{color:#6b7280}
.loading-card,.result,.error,.warning{padding:12px;border-radius:10px;line-height:1.6}
.loading-card{background:#eff6ff;border:1px solid #bfdbfe}
.result.success{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534}
.error{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c}
.warning{background:#fffbeb;border:1px solid #fde68a;color:#92400e}
.warning-card{display:flex;flex-direction:column;gap:8px}
.warning-title{font-weight:600}
.warning-detail{margin:0;padding:10px;border:1px solid #fde68a;border-radius:8px;background:rgba(255,255,255,.55);white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#78350f}
.warning-actions{display:flex;gap:8px;flex-wrap:wrap}
.btn{padding:8px 14px;border-radius:6px;border:1px solid transparent;cursor:pointer}
.btn:disabled{opacity:.6;cursor:not-allowed}
.btn-primary{background:#2563eb;color:#fff}
.btn-secondary{background:#fff;border-color:#d1d5db;color:#374151}
.btn-danger{background:#fff1f2;border-color:#fecdd3;color:#b91c1c}
.btn-small{padding:6px 10px}
.editor-modal-mask{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(15,23,42,.4);z-index:1000}
.editor-modal{width:min(960px,calc(100vw - 48px));max-height:calc(100vh - 48px);display:flex;flex-direction:column;background:#fff;border:1px solid #dbeafe;border-radius:14px;box-shadow:0 20px 50px rgba(15,23,42,.2)}
.editor-modal-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #e5e7eb}
.editor-modal-title{font-size:15px;font-weight:600}
.editor-modal-hint{margin-top:4px;color:#6b7280;line-height:1.6}
.editor-modal-body{padding:16px 18px;overflow:auto}
.editor-modal-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-top:1px solid #e5e7eb}
.editor-footer-actions{display:flex;gap:8px;justify-content:flex-end}
.editor-error{color:#b91c1c}
@media (max-width: 1200px) {
  .template-field-extract-dialog{min-width:0}
  .popup-header,.toolbar,.editor-modal-footer{flex-direction:column;align-items:stretch}
  .header-actions,.toolbar-actions,.editor-footer-actions{justify-content:flex-start}
  .field-grid{grid-template-columns:1fr}
}
</style>
