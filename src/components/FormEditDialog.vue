<template>
  <div class="form-edit-dialog">
    <div v-if="!isFormMode" class="form-mode-hint">
      <div class="hint-content">
        <h3>当前文档未处于表单模式</h3>
        <p>请先进入表单模式以使用表单编辑功能</p>
      </div>
    </div>
    <div v-else class="form-edit-panel">
      <!-- 左侧表单编辑区域 -->
      <div class="form-left">
        <div class="form-body">
          <div v-if="!selectedBookmark" class="empty-state">
            <p>请从右侧选择书签进行编辑</p>
          </div>
          <div v-else class="form-content">
            <div class="form-group">
              <label>书签名称 <span class="required">*</span></label>
              <input v-model="form.name" placeholder="如：姓名、合同编号、签署日期" />
              <p class="hint">填写该项的显示名称，将作为标签的一部分</p>
            </div>
            <div class="form-group">
              <label>填写提示</label>
              <input v-model="form.fillHint" placeholder="填写时给用户的提示语，如格式说明" />
            </div>
            <div class="form-group">
              <label>标签</label>
              <input v-model="form.tag" placeholder="如：合同, 客户（英文逗号分隔，便于搜索）" />
              <p class="hint">多个标签用英文逗号分隔，用于分类和搜索</p>
            </div>
            <div class="form-group">
              <label>是否必填</label>
              <label class="checkbox-label">
                <input v-model="form.required" type="checkbox" />
                <span>必填项，填写时不能为空</span>
              </label>
            </div>
            <div class="form-group">
              <label>数据类型</label>
              <select v-model="form.dataType" @change="onDataTypeChange">
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
                  <input v-model="form.constraints.minLength" type="number" min="0" placeholder="留空不限制" />
                </div>
                <div class="form-group">
                  <label>最大长度</label>
                  <input v-model="form.constraints.maxLength" type="number" min="0" placeholder="留空不限制" />
                </div>
                <div class="form-group">
                  <label>须包含</label>
                  <input v-model="form.constraints.mustContain" placeholder="留空不限制" />
                </div>
                <div class="form-group">
                  <label>不许包含</label>
                  <input v-model="form.constraints.mustNotContain" placeholder="留空不限制" />
                </div>
                <div class="form-group">
                  <label>正则匹配</label>
                  <input v-model="form.constraints.pattern" placeholder="留空不校验" />
                </div>
              </div>
              <div v-show="form.dataType === 'integer' || form.dataType === 'decimal'" class="constraints-block">
                <div class="form-row-2">
                  <div class="form-group">
                    <label>最小值（≥）</label>
                    <input v-model="form.constraints.min" type="number" :step="form.dataType === 'decimal' ? '0.01' : '1'" placeholder="留空不限制" />
                  </div>
                  <div class="form-group">
                    <label>最大值（≤）</label>
                    <input v-model="form.constraints.max" type="number" :step="form.dataType === 'decimal' ? '0.01' : '1'" placeholder="留空不限制" />
                  </div>
                </div>
                <div class="form-group">
                  <label>等于（精确值）</label>
                  <input v-model="form.constraints.equals" type="number" :step="form.dataType === 'decimal' ? '0.01' : '1'" placeholder="留空不限制" />
                </div>
                <div class="form-group" v-if="form.dataType === 'decimal'">
                  <label>小数位数</label>
                  <input v-model="form.constraints.decimalPlaces" type="number" min="0" max="10" placeholder="留空不限制" />
                </div>
              </div>
              <div v-show="form.dataType === 'date' || form.dataType === 'datetime' || form.dataType === 'time'" class="constraints-block">
                <div class="form-group">
                  <label>不早于（≥）</label>
                  <input v-model="form.constraints.dateMin" :type="form.dataType === 'datetime' ? 'datetime-local' : form.dataType === 'time' ? 'time' : 'date'" placeholder="留空不限制" />
                </div>
                <div class="form-group">
                  <label>不晚于（≤）</label>
                  <input v-model="form.constraints.dateMax" :type="form.dataType === 'datetime' ? 'datetime-local' : form.dataType === 'time' ? 'time' : 'date'" placeholder="留空不限制" />
                </div>
                <div class="form-group">
                  <label>等于（精确值）</label>
                  <input v-model="form.constraints.dateEquals" :type="form.dataType === 'datetime' ? 'datetime-local' : form.dataType === 'time' ? 'time' : 'date'" placeholder="留空不限制" />
                </div>
              </div>
              <div v-show="form.dataType === 'boolean'" class="constraints-block">
                <div class="form-group">
                  <label>允许的值</label>
                  <input v-model="form.constraints.allowedValues" placeholder="如：是,否（英文逗号分隔）" />
                </div>
              </div>
              <div v-show="form.dataType === 'select'" class="constraints-block">
                <div class="form-group">
                  <label>下拉值</label>
                  <input v-model="form.constraints.selectOptions" placeholder="如：选项A,选项B,选项C（英文逗号分隔）" />
                  <p class="hint">多个选项用英文逗号分隔，填写时只能从这些选项中选择</p>
                </div>
              </div>
              <div v-show="['email','phone','idcard','url'].includes(form.dataType)" class="constraints-block">
                <p class="hint type-hint">此类格式由类型自动校验，仅需设置是否必填</p>
              </div>
            </div>

            <div class="form-group">
              <label>审查方式</label>
              <select v-model="form.reviewType">
                <option v-for="opt in reviewTypeOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
              <p class="hint">{{ getReviewTypeHint(form.reviewType) }}</p>
            </div>
            <div v-if="form.reviewType !== 'none'" class="form-group">
              <label>审查规则</label>
              <textarea v-model="form.reviewRule" :placeholder="getReviewRulePlaceholder(form.reviewType)" rows="3" />
              <p class="hint">{{ getReviewRuleHint(form.reviewType) }}</p>
            </div>
            <div class="form-group">
              <label>审查提示</label>
              <input v-model="form.reviewHint" placeholder="校验不通过时显示的提示语" />
            </div>
            <div class="form-group">
              <label>备注</label>
              <input v-model="form.remark" placeholder="可选" />
            </div>
          </div>
        </div>
        <div class="form-footer">
          <button v-if="selectedBookmark" class="btn btn-primary" @click="onSave">保存</button>
          <button class="btn btn-secondary" @click="onCancel">关闭</button>
        </div>
      </div>

      <!-- 右侧书签列表区域 -->
      <div class="bookmark-right">
        <div class="bookmark-header">
          <button class="btn-refresh" @click="loadBookmarks" title="刷新">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
          </button>
        </div>
        <div class="bookmark-body">
          <div v-if="loading" class="loading-state">
            <span class="loading-spinner"></span>
            <span>正在加载…</span>
          </div>
          <div v-else-if="errorMsg" class="error-state">
            <p>{{ errorMsg }}</p>
          </div>
          <div v-else-if="!bookmarks.length" class="empty-state">
            <p>文档中暂无书签</p>
            <p class="hint">请先在「规则制作」中创建表单项并插入标签到文档</p>
          </div>
          <div v-else class="bookmark-list">
            <div
              v-for="(item, idx) in bookmarks"
              :key="item.bookmarkName + '-' + idx"
              :class="['bookmark-item', { active: selectedBookmark?.bookmarkName === item.bookmarkName }]"
              title="单击选中，双击定位到文档"
              @click="onBookmarkClick(item)"
              @dblclick="onBookmarkDblClick(item)"
            >
              <div class="bookmark-name">{{ item.name }}</div>
              <div class="bookmark-content">{{ item.content || '(空)' }}</div>
              <div class="bookmark-hint">{{ getFillHint(item) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  DATA_TYPES,
  REVIEW_TYPES,
  genId,
  getDefaultConstraints,
  loadRulesFromDoc,
  saveRulesToDoc,
  normalizeConstraints
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
  name: 'FormEditDialog',
  data() {
    return {
      isFormMode: false,
      loading: true,
      errorMsg: '',
      bookmarks: [],
      selectedBookmark: null,
      form: {
        name: '',
        tag: '',
        required: false,
        dataType: 'string',
        reviewType: 'none',
        reviewRule: '',
        reviewHint: '',
        fillHint: '',
        remark: '',
        constraints: getDefaultConstraints('string')
      },
      dataTypeOptions: DATA_TYPES,
      reviewTypeOptions: REVIEW_TYPES,
      checkInterval: null
    }
  },
  mounted() {
    this.checkFormMode()
    // 定期检查表单模式状态
    this.checkInterval = setInterval(() => {
      this.checkFormMode()
    }, 500)
    // 监听窗口激活事件
    try {
      if (window.Application?.ApiEvent) {
        window.Application.ApiEvent.AddApiEventListener('WindowActivate', () => {
          this.checkFormMode()
        })
      }
    } catch (e) {
      console.warn('添加窗口激活监听失败:', e)
    }
  },
  beforeUnmount() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }
  },
  methods: {
    // 检查表单模式状态
    checkFormMode() {
      try {
        const doc = window.Application?.ActiveDocument
        if (!doc) {
          this.isFormMode = false
          return
        }
        const wdAllowOnlyFormFields = window.Application.Enum?.wdAllowOnlyFormFields ?? 2
        const pt = doc.ProtectionType
        const isFormProtected = (pt === wdAllowOnlyFormFields || pt === 2)
        const FORM_MODE_VAR_NAME = 'NdFormMode'
        let varFormMode = false
        try {
          const vars = doc.Variables
          if (vars) {
            const v = vars.Item(FORM_MODE_VAR_NAME)
            varFormMode = v && String(v.Value || '') === '1'
          }
        } catch (e) {}
        const newFormMode = isFormProtected || varFormMode
        if (this.isFormMode !== newFormMode) {
          this.isFormMode = newFormMode
          if (this.isFormMode) {
            this.loadBookmarks()
          } else {
            this.bookmarks = []
            this.selectedBookmark = null
          }
        } else if (this.isFormMode && this.bookmarks.length === 0) {
          this.loadBookmarks()
        }
      } catch (e) {
        console.error('检查表单模式失败:', e)
        this.isFormMode = false
      }
    },
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
      this.form.constraints = Object.assign({}, this.form.constraints, defaults)
    },
    /** 从书签全名 名称_id_序号 中解析出规则 id，再从规则库取填写提示；查不到则返回空字符串 */
    getFillHint(item) {
      const fullName = (item.bookmarkName || '').trim()
      const parts = fullName.split('_')
      const ruleId = parts.length >= 2 ? parts[1] : null
      if (!ruleId) return ''
      const rules = loadRulesFromDoc()
      const rule = rules.find(r => r.id === ruleId)
      return rule && rule.fillHint ? String(rule.fillHint).trim() : ''
    },
    loadBookmarks() {
      this.loading = true
      this.errorMsg = ''
      this.bookmarks = []
      try {
        const doc = window.Application && window.Application.ActiveDocument
        if (!doc) {
          this.errorMsg = '当前没有打开任何文档'
          this.loading = false
          return
        }
        const bookmarks = doc.Bookmarks
        if (!bookmarks || bookmarks.Count === 0) {
          this.loading = false
          return
        }
        const list = []
        for (let i = 1; i <= bookmarks.Count; i++) {
          try {
            const bm = bookmarks.Item(i)
            if (!bm) continue
            const fullName = (bm.Name || '').trim()
            if (!fullName || fullName.indexOf('_') === 0) continue
            // 书签格式：名称_id_编号，取第一个 _ 前的部分作为显示名称
            const firstUnderscore = fullName.indexOf('_')
            const name = firstUnderscore >= 0 ? fullName.substring(0, firstUnderscore).trim() : fullName
            let content = ''
            try {
              if (bm.Range && !bm.Empty) {
                content = (bm.Range.Text || '')
                  .replace(/\r\n$/g, '')
                  .replace(/\r$/g, '')
                  .replace(/\n$/g, '')
                  .replace(/\x07$/g, '')
                  .trim()
              }
            } catch (e) {}
            list.push({
              bookmarkName: fullName,
              name: name || fullName,
              content
            })
          } catch (e) {
            console.warn('读取书签失败:', e)
          }
        }
        this.bookmarks = list
        // 如果有书签且当前没有选中，自动选择第一个书签
        if (list.length > 0 && !this.selectedBookmark) {
          this.$nextTick(() => {
            this.onBookmarkClick(list[0])
            // 定位到第一个书签
            this.goToBookmark(list[0])
          })
        }
      } catch (e) {
        console.error('loadBookmarks:', e)
        this.errorMsg = (e.message || e) + ''
      }
      this.loading = false
    },
    onBookmarkClick(item) {
      this.selectedBookmark = item
      this.loadFormData(item)
    },
    onBookmarkDblClick(item) {
      this.selectedBookmark = item
      this.loadFormData(item)
      this.goToBookmark(item)
    },
    loadFormData(item) {
      try {
        const fullName = (item.bookmarkName || '').trim()
        const parts = fullName.split('_')
        const ruleId = parts.length >= 2 ? parts[1] : null
        
        if (!ruleId) {
          // 如果没有规则ID，使用默认值
          this.form = {
            name: item.name,
            tag: '',
            required: false,
            dataType: 'string',
            reviewType: 'none',
            reviewRule: '',
            reviewHint: '',
            fillHint: '',
            remark: '',
            constraints: getDefaultConstraints('string')
          }
          return
        }
        
        const rules = loadRulesFromDoc()
        const rule = rules.find(r => r.id === ruleId)
        
        if (rule) {
          const c = rule.constraints || {}
          this.form = {
            name: rule.name ?? item.name,
            tag: rule.tag ?? '',
            required: rule.required ?? false,
            dataType: rule.dataType ?? 'string',
            reviewType: rule.reviewType ?? 'none',
            reviewRule: rule.reviewRule ?? '',
            reviewHint: rule.reviewHint ?? '',
            fillHint: rule.fillHint ?? '',
            remark: rule.remark ?? '',
            constraints: { ...getDefaultConstraints(rule.dataType ?? 'string'), ...c }
          }
        } else {
          // 规则不存在，使用默认值
          this.form = {
            name: item.name,
            tag: '',
            required: false,
            dataType: 'string',
            reviewType: 'none',
            reviewRule: '',
            reviewHint: '',
            fillHint: '',
            remark: '',
            constraints: getDefaultConstraints('string')
          }
        }
      } catch (e) {
        console.error('加载表单数据失败:', e)
        this.errorMsg = '加载表单数据失败：' + (e.message || e)
      }
    },
    goToBookmark(item) {
      try {
        const doc = window.Application && window.Application.ActiveDocument
        if (!doc) return
        const bm = doc.Bookmarks.Item(item.bookmarkName)
        if (bm && typeof bm.Select === 'function') {
          bm.Select()
        }
      } catch (e) {
        console.error('定位书签失败:', e)
        this.errorMsg = '定位失败：' + (e.message || e)
      }
    },
    onSave() {
      if (!this.selectedBookmark) return
      
      const name = (this.form.name || '').trim()
      if (!name) {
        alert('请输入书签名称')
        return
      }
      
      try {
        const fullName = (this.selectedBookmark.bookmarkName || '').trim()
        const parts = fullName.split('_')
        const ruleId = parts.length >= 2 ? parts[1] : null
        
        const rules = loadRulesFromDoc().map(r => ({ ...r, reviewType: r.reviewType || 'none' }))
        
        const newItem = {
          id: ruleId || genId(),
          name,
          tag: (this.form.tag || '').trim(),
          required: !!this.form.required,
          dataType: this.form.dataType || 'string',
          reviewType: this.form.reviewType || 'none',
          reviewRule: (this.form.reviewRule || '').trim(),
          reviewHint: (this.form.reviewHint || '').trim(),
          fillHint: (this.form.fillHint || '').trim(),
          remark: (this.form.remark || '').trim(),
          constraints: normalizeConstraints(this.form.constraints, this.form.dataType)
        }
        if (!newItem.reviewType) newItem.reviewType = 'none'
        
        if (ruleId) {
          // 更新现有规则
          const idx = rules.findIndex(r => r.id === ruleId)
          if (idx >= 0) {
            rules.splice(idx, 1, newItem)
          } else {
            rules.push(newItem)
          }
        } else {
          // 创建新规则
          rules.push(newItem)
        }
        
        saveRulesToDoc(rules)
        alert('保存成功')
        this.loadBookmarks()
      } catch (e) {
        console.error('保存失败:', e)
        alert('保存失败：' + (e.message || e))
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
.form-edit-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 13px;
  color: #1e293b;
  background: #fff;
  overflow: hidden;
}

.form-edit-panel {
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.form-left {
  flex: 3;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e2e8f0;
  min-width: 0;
  background: #fff;
  overflow: hidden;
}

.form-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px;
}

.form-footer {
  padding: 12px 16px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
  background: #fff;
}

.bookmark-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  min-width: 0;
  overflow: hidden;
  flex-shrink: 0;
}

.bookmark-header {
  padding: 8px 12px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-shrink: 0;
  background: #fff;
}

.btn-refresh {
  padding: 4px 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.btn-refresh:hover {
  background: #f1f5f9;
  color: #334155;
}

.bookmark-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  color: #64748b;
  text-align: center;
}

.empty-state .hint {
  margin: 8px 0 0 0;
  font-size: 12px;
  color: #94a3b8;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: #64748b;
}

.loading-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state {
  padding: 24px;
  color: #dc2626;
  text-align: center;
}

.form-content {
  display: flex;
  flex-direction: column;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #334155;
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

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.form-group textarea {
  resize: vertical;
  min-height: 60px;
}

.form-group .hint {
  margin: 4px 0 0;
  font-size: 11px;
  color: #94a3b8;
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

.constraints-wrap {
  margin-top: 8px;
}

.constraints-block {
  padding: 12px;
  background: #f8fafc;
  border-radius: 4px;
  margin-bottom: 12px;
}

.type-hint {
  background: #f6ffed;
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid #b7eb8f;
  margin: 0;
}

.btn {
  padding: 6px 14px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
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

.bookmark-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bookmark-item {
  padding: 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bookmark-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.bookmark-item.active {
  border-color: #3b82f6;
  background: #eff6ff;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
}

.bookmark-name {
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4px;
  font-size: 14px;
}

.bookmark-content {
  color: #475569;
  font-size: 12px;
  margin-bottom: 4px;
  word-break: break-word;
}

.bookmark-hint {
  color: #94a3b8;
  font-size: 11px;
  font-style: italic;
}

.form-mode-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  background: #fff;
}

.hint-content {
  text-align: center;
  padding: 48px;
}

.hint-content h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #1e293b;
}

.hint-content p {
  margin: 0;
  font-size: 14px;
  color: #64748b;
}
</style>
