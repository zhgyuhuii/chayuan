<template>
  <div class="template-form-dialog">
    <div class="dialog-body">
      <div class="form-group">
        <label>书签名称 <span class="required">*</span></label>
        <input v-model="form.name" :readonly="isDetail" placeholder="如：姓名、合同编号、签署日期" />
        <p class="hint">填写该项的显示名称，将作为标签的一部分</p>
      </div>
      <div class="form-group">
        <label>语义键</label>
        <input v-model="form.semanticKey" :readonly="isDetail" placeholder="如：partyA、contractAmount" />
        <p class="hint">用于把同类字段按语义归并，建议使用稳定英文键名。</p>
      </div>
      <div class="form-group">
        <label>填写提示</label>
        <input v-model="form.fillHint" :readonly="isDetail" placeholder="填写时给用户的提示语，如格式说明" />
      </div>
      <div class="form-group">
        <label>标签</label>
        <input v-model="form.tag" :readonly="isDetail" placeholder="如：合同, 客户（英文逗号分隔，便于搜索）" />
        <p class="hint">多个标签用英文逗号分隔，用于分类和搜索</p>
      </div>
      <div class="form-group">
        <label>是否必填</label>
        <label class="checkbox-label">
          <input v-model="form.required" type="checkbox" :disabled="isDetail" />
          <span>必填项，填写时不能为空</span>
        </label>
      </div>
      <div class="form-group">
        <label>内容生成策略</label>
        <select v-model="form.sampleContentMode" :disabled="isDetail">
          <option v-for="opt in sampleContentModeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <div v-if="form.sampleContentMode === 'example'" class="form-group">
        <label>样例内容</label>
        <input v-model="form.sampleContent" :readonly="isDetail" placeholder="如：某某科技有限公司、1000000.00" />
      </div>
      <div class="form-group">
        <label>数据类型</label>
        <select v-model="form.dataType" :disabled="isDetail" @change="onDataTypeChange">
          <option v-for="opt in dataTypeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <p class="hint">{{ getDataTypeHint(form.dataType) }}</p>
      </div>

      <div class="constraints-wrap">
        <div v-show="form.dataType === 'string'" class="constraints-block">
          <div class="form-group">
            <label>最小长度</label>
            <input v-model="form.constraints.minLength" type="number" min="0" :readonly="isDetail" placeholder="留空不限制" />
          </div>
          <div class="form-group">
            <label>最大长度</label>
            <input v-model="form.constraints.maxLength" type="number" min="0" :readonly="isDetail" placeholder="留空不限制" />
          </div>
          <div class="form-group">
            <label>须包含</label>
            <input v-model="form.constraints.mustContain" :readonly="isDetail" placeholder="留空不限制" />
          </div>
          <div class="form-group">
            <label>不许包含</label>
            <input v-model="form.constraints.mustNotContain" :readonly="isDetail" placeholder="留空不限制" />
          </div>
          <div class="form-group">
            <label>正则匹配</label>
            <input v-model="form.constraints.pattern" :readonly="isDetail" placeholder="留空不校验" />
          </div>
        </div>
        <div v-show="form.dataType === 'integer' || form.dataType === 'decimal'" class="constraints-block">
          <div class="form-row-2">
            <div class="form-group">
              <label>最小值（≥）</label>
              <input v-model="form.constraints.min" type="number" :step="form.dataType === 'decimal' ? '0.01' : '1'" :readonly="isDetail" placeholder="留空不限制" />
            </div>
            <div class="form-group">
              <label>最大值（≤）</label>
              <input v-model="form.constraints.max" type="number" :step="form.dataType === 'decimal' ? '0.01' : '1'" :readonly="isDetail" placeholder="留空不限制" />
            </div>
          </div>
          <div class="form-group">
            <label>等于（精确值）</label>
            <input v-model="form.constraints.equals" type="number" :step="form.dataType === 'decimal' ? '0.01' : '1'" :readonly="isDetail" placeholder="留空不限制" />
          </div>
          <div class="form-group" v-if="form.dataType === 'decimal'">
            <label>小数位数</label>
            <input v-model="form.constraints.decimalPlaces" type="number" min="0" max="10" :readonly="isDetail" placeholder="留空不限制" />
          </div>
        </div>
        <div v-show="form.dataType === 'date' || form.dataType === 'datetime' || form.dataType === 'time'" class="constraints-block">
          <div class="form-group">
            <label>不早于（≥）</label>
            <input v-model="form.constraints.dateMin" :type="form.dataType === 'datetime' ? 'datetime-local' : form.dataType === 'time' ? 'time' : 'date'" :readonly="isDetail" placeholder="留空不限制" />
          </div>
          <div class="form-group">
            <label>不晚于（≤）</label>
            <input v-model="form.constraints.dateMax" :type="form.dataType === 'datetime' ? 'datetime-local' : form.dataType === 'time' ? 'time' : 'date'" :readonly="isDetail" placeholder="留空不限制" />
          </div>
          <div class="form-group">
            <label>等于（精确值）</label>
            <input v-model="form.constraints.dateEquals" :type="form.dataType === 'datetime' ? 'datetime-local' : form.dataType === 'time' ? 'time' : 'date'" :readonly="isDetail" placeholder="留空不限制" />
          </div>
        </div>
        <div v-show="form.dataType === 'boolean'" class="constraints-block">
          <div class="form-group">
            <label>允许的值</label>
            <input v-model="form.constraints.allowedValues" :readonly="isDetail" placeholder="如：是,否（英文逗号分隔）" />
          </div>
        </div>
        <div v-show="form.dataType === 'select'" class="constraints-block">
          <div class="form-group">
            <label>下拉值</label>
            <input v-model="form.constraints.selectOptions" :readonly="isDetail" placeholder="如：选项A,选项B,选项C（英文逗号分隔）" />
            <p class="hint">多个选项用英文逗号分隔，填写时只能从这些选项中选择</p>
          </div>
        </div>
        <div v-show="['email','phone','idcard','url'].includes(form.dataType)" class="constraints-block">
          <p class="hint type-hint">此类格式由类型自动校验，仅需设置是否必填</p>
        </div>
      </div>

      <div class="form-group">
        <label>审查方式</label>
        <select v-model="form.reviewType" :disabled="isDetail">
          <option v-for="opt in reviewTypeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <p class="hint">{{ getReviewTypeHint(form.reviewType) }}</p>
      </div>
      <div class="form-group">
        <label>实例处理方式</label>
        <select v-model="form.instanceStrategy" :disabled="isDetail">
          <option v-for="opt in instanceStrategyOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <div class="form-group">
        <label>是否参与审计</label>
        <label class="checkbox-label">
          <input v-model="form.auditEnabled" type="checkbox" :disabled="isDetail" />
          <span>启用后会进入文档审计范围</span>
        </label>
      </div>
      <div class="form-group">
        <label>审计优先级</label>
        <input v-model="form.auditPriority" type="number" min="1" max="100" :readonly="isDetail" placeholder="1-100，数值越大越重要" />
      </div>
      <div v-if="form.reviewType !== 'none'" class="form-group">
        <label>审查规则</label>
        <textarea v-model="form.reviewRule" :readonly="isDetail" :placeholder="getReviewRulePlaceholder(form.reviewType)" rows="3" />
        <p class="hint">{{ getReviewRuleHint(form.reviewType) }}</p>
      </div>
      <div class="form-group">
        <label>审查提示</label>
        <input v-model="form.reviewHint" :readonly="isDetail" placeholder="校验不通过时显示的提示语" />
      </div>
      <div class="form-group">
        <label>备注</label>
        <input v-model="form.remark" :readonly="isDetail" placeholder="可选" />
      </div>
      <div class="form-group">
        <label>智能提取提示</label>
        <textarea v-model="form.extractionHints" :readonly="isDetail" rows="3" placeholder="可补充识别线索，如“通常出现在合同首部”“优先识别公司全称”" />
      </div>
    </div>
    <div class="dialog-footer">
      <button v-if="!isDetail" class="btn btn-secondary" @click="onCancel">取消</button>
      <button v-if="!isDetail" class="btn btn-primary" @click="onSubmit">确定</button>
      <button v-if="isDetail" class="btn btn-primary" @click="onCancel">关闭</button>
    </div>
  </div>
</template>

<script>
import {
  DATA_TYPES,
  SAMPLE_CONTENT_MODE_OPTIONS,
  INSTANCE_STRATEGY_OPTIONS,
  REVIEW_TYPES,
  genId,
  buildDefaultRule,
  getDefaultConstraints,
  loadRulesFromDoc,
  saveRulesToDoc,
  normalizeConstraints,
  normalizeRule
} from '../utils/templateRules.js'

const REVIEW_PLACEHOLDERS = {
  regex: '如：^[\\u4e00-\\u9fa5]{2,4}$',
  range: '如：0,100',
  enum: '如：是,否',
  llm: '如：判断是否为合理的人名',
  sensitive: '敏感词列表，逗号分隔'
}

const REVIEW_HINTS = {
  regex: '正则表达式',
  range: '最小,最大',
  enum: '英文逗号分隔'
}

export default {
  name: 'TemplateFormDialog',
  data() {
    const q = this.$route?.query || {}
    const mode = q.mode || 'add'
    const editId = q.id || ''
    const isDetail = mode === 'detail'
    const rules = loadRulesFromDoc()
    const item = (mode === 'edit' || mode === 'detail') && editId ? rules.find(r => r.id === editId) : null

    const isEdit = !!item
    const defaults = buildDefaultRule()
    const normalizedItem = item ? normalizeRule(item) : defaults
    const c = normalizedItem.constraints || {}
    const form = {
      name: normalizedItem.name,
      semanticKey: normalizedItem.semanticKey,
      tag: normalizedItem.tag,
      required: normalizedItem.required,
      dataType: normalizedItem.dataType,
      reviewType: normalizedItem.reviewType,
      reviewRule: normalizedItem.reviewRule,
      reviewHint: normalizedItem.reviewHint,
      fillHint: normalizedItem.fillHint,
      remark: normalizedItem.remark,
      sampleContentMode: normalizedItem.sampleContentMode,
      sampleContent: normalizedItem.sampleContent,
      auditEnabled: normalizedItem.auditEnabled,
      auditPriority: normalizedItem.auditPriority,
      instanceStrategy: normalizedItem.instanceStrategy,
      extractionHints: normalizedItem.extractionHints,
      constraints: { ...defaults.constraints, ...c }
    }

    return {
      isEdit,
      isDetail,
      editId,
      form,
      dataTypeOptions: DATA_TYPES,
      reviewTypeOptions: REVIEW_TYPES,
      sampleContentModeOptions: SAMPLE_CONTENT_MODE_OPTIONS,
      instanceStrategyOptions: INSTANCE_STRATEGY_OPTIONS
    }
  },
  methods: {
    getDataTypeHint(val) {
      return DATA_TYPES.find(o => o.value === val)?.hint || ''
    },
    getReviewTypeHint(val) {
      return REVIEW_TYPES.find(o => o.value === val)?.hint || ''
    },
    getReviewRulePlaceholder(type) {
      return REVIEW_PLACEHOLDERS[type] || ''
    },
    getReviewRuleHint(type) {
      return REVIEW_HINTS[type] || ''
    },
    onDataTypeChange() {
      const defaults = getDefaultConstraints(this.form.dataType)
      this.form.constraints = Object.assign({}, defaults, normalizeConstraints(this.form.constraints, this.form.dataType))
    },
    onCancel() {
      try {
        if (window.close) window.close()
      } catch (e) {}
    },
    onSubmit() {
      const name = (this.form.name || '').trim()
      if (!name) {
        alert('请输入书签名称')
        return
      }
      const rules = loadRulesFromDoc().map(r => ({ ...r, reviewType: r.reviewType || 'none' }))
      const newItem = {
        id: this.isEdit ? this.editId : genId(),
        name,
        semanticKey: (this.form.semanticKey || '').trim(),
        tag: (this.form.tag || '').trim(),
        required: !!this.form.required,
        dataType: this.form.dataType || 'string',
        reviewType: this.form.reviewType || 'none',
        reviewRule: (this.form.reviewRule || '').trim(),
        reviewHint: (this.form.reviewHint || '').trim(),
        fillHint: (this.form.fillHint || '').trim(),
        remark: (this.form.remark || '').trim(),
        sampleContentMode: this.form.sampleContentMode || 'keep',
        sampleContent: (this.form.sampleContent || '').trim(),
        auditEnabled: this.form.auditEnabled !== false,
        auditPriority: Number(this.form.auditPriority) || 50,
        instanceStrategy: this.form.instanceStrategy || 'semantic-group',
        extractionHints: (this.form.extractionHints || '').trim(),
        constraints: normalizeConstraints(this.form.constraints, this.form.dataType)
      }
      const normalizedItem = normalizeRule(newItem)

      if (this.isEdit) {
        const idx = rules.findIndex(r => r.id === this.editId)
        if (idx >= 0) rules.splice(idx, 1, normalizedItem)
      } else {
        rules.push(normalizedItem)
      }
      saveRulesToDoc(rules)
      this.onCancel()
    }
  }
}
</script>

<style scoped>
.template-form-dialog {
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
  overflow-y: auto;
  flex: 1;
}

.dialog-footer {
  padding: 8px 12px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

.form-group {
  margin-bottom: 8px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
}

.form-group .required {
  color: #ff4d4f;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
}

.form-group textarea {
  resize: vertical;
  min-height: 52px;
}

.form-group .hint {
  margin: 4px 0 0;
  font-size: 11px;
  color: #999;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: normal;
  cursor: pointer;
}

.checkbox-label input {
  width: auto;
}

.form-row-2 {
  display: flex;
  gap: 12px;
}

.form-row-2 .form-group {
  flex: 1;
}

.type-hint {
  background: #f6ffed;
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid #b7eb8f;
  margin: 0 0 8px 0;
}

.btn {
  padding: 5px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.btn-primary {
  background: #1890ff;
  color: #fff;
}

.btn-primary:hover {
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
