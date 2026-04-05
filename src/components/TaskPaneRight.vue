<template>
  <div class="taskpane-right">
    <!-- 表单模式：右侧始终显示表单编辑框，根据文档中光标所在书签动态切换内容 -->
    <div v-if="isFormMode" class="form-edit-panel">
      <!-- 左侧书签列表区域 -->
      <div class="bookmark-left" :style="{ width: bookmarkWidth > 0 ? bookmarkWidth + 'px' : '32%', display: bookmarkCollapsed ? 'none' : 'flex' }">
        <div class="bookmark-header">
          <span class="bookmark-title">书签列表</span>
          <button class="btn-collapse" @click="toggleBookmarkCollapse" title="折叠/展开">
            <svg viewBox="0 0 24 24" width="16" height="16" :class="{ rotated: bookmarkCollapsed }">
              <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
            </svg>
          </button>
        </div>
        <div class="bookmark-body">
          <div v-if="bookmarksLoading" class="loading">
            正在加载书签...
          </div>
          <div v-else-if="!bookmarks || bookmarks.length === 0" class="empty-hint">
            暂无书签
          </div>
          <div v-else class="bookmark-list-wrapper">
            <div class="bookmark-tree">
              <div
                v-for="group in bookmarkGroups"
                :key="group.groupKey"
                class="bookmark-group"
              >
                <button
                  type="button"
                  class="bookmark-group-header"
                  :class="{ active: selectedRule?.id ? selectedRule.id === group.ruleId : selectedBookmarkId && group.bookmarks.some(item => item.bookmarkName === selectedBookmarkId) }"
                  @click.stop="toggleBookmarkGroup(group.ruleId)"
                >
                  <span class="bookmark-group-toggle" :class="{ expanded: isBookmarkGroupExpanded(group.ruleId) }">
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
                    </svg>
                  </span>
                  <span class="bookmark-group-name">{{ group.ruleName }}</span>
                  <span class="bookmark-group-count">{{ group.bookmarks.length }}</span>
                </button>
                <div v-if="isBookmarkGroupExpanded(group.ruleId)" class="bookmark-group-children">
                  <button
                    v-for="(item, idx) in group.bookmarks"
                    :key="item.bookmarkName + '-' + idx"
                    type="button"
                    :class="['bookmark-item', { active: selectedBookmarkId === item.bookmarkName }]"
                    :title="buildBookmarkItemTitle(item)"
                    @click.stop="onBookmarkItemClick(item)"
                    @dblclick.stop="onBookmarkItemDblClick(item)"
                  >
                    <div class="bookmark-name">{{ item.name }}</div>
                    <div class="bookmark-meta">
                      <span>书签编号 {{ item.bookmarkIndex || '—' }}</span>
                      <span>{{ item.pageNumber ? `第${item.pageNumber}页` : '页码未知' }}</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 可拖拽分割线 -->
      <div 
        v-if="!bookmarkCollapsed"
        class="resizer" 
        @mousedown="startResize"
        :title="'拖拽调整宽度'"
      ></div>

      <!-- 折叠按钮（当书签列表折叠时显示） -->
      <div v-if="bookmarkCollapsed" class="collapse-button-wrapper">
        <button class="btn-collapse-expand" @click="toggleBookmarkCollapse" title="展开书签列表">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
          </svg>
        </button>
      </div>

      <!-- 右侧表单编辑区域 -->
      <div class="form-right" :style="{ width: bookmarkCollapsed ? '100%' : (bookmarkWidth > 0 ? 'calc(100% - ' + bookmarkWidth + 'px - 4px)' : '68%') }">
        <!-- 无书签或光标不在书签内时的提示 -->
        <div v-if="!selectedBookmark" class="form-edit-section">
          <div class="cursor-hint">
            <p>将光标移入文档中的书签区域，此处将显示该处的表单编辑。</p>
          </div>
        </div>

        <!-- 表单编辑区域：第一行书签名称，下方类型、填写提示、备注，再为输入控件 -->
        <div v-else class="form-edit-section">
          <div class="form-container">
          <!-- 第一行：书签名称 -->
          <div class="form-info">
            <div class="info-item info-name">{{ selectedBookmark.name }}</div>
            <div v-if="selectedRule" class="info-item info-action">
              <button type="button" class="btn-rule-edit" @click="openSelectedRuleEditor">编辑规则</button>
            </div>
            <div class="info-item">
              <label>类型：</label>
              <span>{{ selectedRule ? getDataTypeLabel(selectedRule.dataType) : '—' }}</span>
            </div>
            <div v-if="selectedRule?.semanticKey" class="info-item">
              <label>语义键：</label>
              <span>{{ selectedRule.semanticKey }}</span>
            </div>
            <div v-if="selectedRule?.fillHint" class="info-item">
              <label>填写提示：</label>
              <span>{{ selectedRule.fillHint }}</span>
            </div>
            <div v-if="selectedRule?.remark" class="info-item">
              <label>备注：</label>
              <span>{{ selectedRule.remark }}</span>
            </div>
          </div>

          <!-- 表单字段 -->
          <div v-if="selectedRule" class="form-fields">
            <!-- 字符串类型 -->
            <div v-if="selectedRule.dataType === 'string'" class="form-field">
              <label>
                <span v-if="selectedRule.required" class="required">*</span> 填写内容
              </label>
              <textarea
                v-if="selectedRule.constraints?.maxLength && selectedRule.constraints.maxLength > 100"
                v-model="formData.value"
                :placeholder="selectedRule.fillHint || '请输入' + selectedBookmark.name"
                class="form-input textarea"
                rows="4"
                @blur="validateField"
                @input="onFieldInput"
              />
              <input
                v-else
                v-model="formData.value"
                type="text"
                :placeholder="selectedRule.fillHint || '请输入' + selectedBookmark.name"
                class="form-input"
                @blur="validateField"
                @input="onFieldInput"
              />
              <div v-if="fieldError" class="error-message">{{ fieldError }}</div>
              <div v-if="selectedRule.fillHint && !fieldError" class="hint-message">{{ selectedRule.fillHint }}</div>
            </div>

            <!-- 日期类型 -->
            <div v-else-if="selectedRule.dataType === 'date'" class="form-field">
              <label>
                <span v-if="selectedRule.required" class="required">*</span> 填写内容
              </label>
              <input
                v-model="formData.value"
                type="date"
                :placeholder="selectedRule.fillHint || '请选择日期'"
                class="form-input"
                @blur="validateField"
                @change="onFieldInput"
              />
              <div v-if="fieldError" class="error-message">{{ fieldError }}</div>
              <div v-if="selectedRule.fillHint && !fieldError" class="hint-message">{{ selectedRule.fillHint }}</div>
            </div>

            <!-- 日期时间类型 -->
            <div v-else-if="selectedRule.dataType === 'datetime'" class="form-field">
              <label>
                <span v-if="selectedRule.required" class="required">*</span> 填写内容
              </label>
              <input
                v-model="formData.value"
                type="datetime-local"
                step="1"
                :placeholder="selectedRule.fillHint || '请选择日期时间'"
                class="form-input"
                @blur="validateField"
                @change="onFieldInput"
              />
              <div v-if="fieldError" class="error-message">{{ fieldError }}</div>
              <div v-if="selectedRule.fillHint && !fieldError" class="hint-message">{{ selectedRule.fillHint }}</div>
            </div>

            <!-- 时间类型 -->
            <div v-else-if="selectedRule.dataType === 'time'" class="form-field">
              <label>
                <span v-if="selectedRule.required" class="required">*</span> 填写内容
              </label>
              <input
                v-model="formData.value"
                type="time"
                :placeholder="selectedRule.fillHint || '请选择时间'"
                class="form-input"
                @blur="validateField"
                @change="onFieldInput"
              />
              <div v-if="fieldError" class="error-message">{{ fieldError }}</div>
              <div v-if="selectedRule.fillHint && !fieldError" class="hint-message">{{ selectedRule.fillHint }}</div>
            </div>

            <!-- 整数类型 -->
            <div v-else-if="selectedRule.dataType === 'integer'" class="form-field">
              <label>
                <span v-if="selectedRule.required" class="required">*</span> 填写内容
              </label>
              <input
                v-model.number="formData.value"
                type="number"
                step="1"
                :placeholder="selectedRule.fillHint || '请输入整数'"
                class="form-input"
                @blur="validateField"
                @input="onFieldInput"
              />
              <div v-if="fieldError" class="error-message">{{ fieldError }}</div>
              <div v-if="selectedRule.fillHint && !fieldError" class="hint-message">{{ selectedRule.fillHint }}</div>
            </div>

            <!-- 小数类型 -->
            <div v-else-if="selectedRule.dataType === 'decimal'" class="form-field">
              <label>
                <span v-if="selectedRule.required" class="required">*</span> 填写内容
              </label>
              <input
                v-model.number="formData.value"
                type="number"
                step="0.01"
                :placeholder="selectedRule.fillHint || '请输入小数'"
                class="form-input"
                @blur="validateField"
                @input="onFieldInput"
              />
              <div v-if="fieldError" class="error-message">{{ fieldError }}</div>
              <div v-if="selectedRule.fillHint && !fieldError" class="hint-message">{{ selectedRule.fillHint }}</div>
            </div>

            <!-- 布尔类型 -->
            <div v-else-if="selectedRule.dataType === 'boolean'" class="form-field">
              <label>
                <span v-if="selectedRule.required" class="required">*</span> 填写内容
              </label>
              <select
                v-model="formData.value"
                class="form-input"
                @blur="validateField"
                @change="onFieldInput"
              >
                <option value="">请选择</option>
                <option
                  v-for="opt in getBooleanOptions(selectedRule)"
                  :key="opt"
                  :value="opt"
                >
                  {{ opt }}
                </option>
              </select>
              <div v-if="fieldError" class="error-message">{{ fieldError }}</div>
              <div v-if="selectedRule.fillHint && !fieldError" class="hint-message">{{ selectedRule.fillHint }}</div>
            </div>

            <!-- 下拉选项类型 - 使用tag按钮形式 -->
            <div v-else-if="selectedRule.dataType === 'select'" class="form-field">
              <label>
                <span v-if="selectedRule.required" class="required">*</span> 填写内容
              </label>
              <div class="tag-options-container">
                <button
                  v-for="opt in getSelectOptions(selectedRule)"
                  :key="opt"
                  type="button"
                  class="tag-option"
                  :class="{ 'tag-selected': isTagSelected(opt) }"
                  @click="toggleTag(opt)"
                >
                  {{ opt }}
                </button>
                <div v-if="getSelectOptions(selectedRule).length === 0" class="no-options-hint">
                  暂无选项
                </div>
              </div>
              <div v-if="selectedTags.length > 0" class="selected-tags-hint">
                已选择：{{ selectedTags.join('、') }}
              </div>
              <div v-if="fieldError" class="error-message">{{ fieldError }}</div>
              <div v-if="selectedRule.fillHint && !fieldError" class="hint-message">{{ selectedRule.fillHint }}</div>
            </div>

            <!-- 邮箱类型 -->
            <div v-else-if="selectedRule.dataType === 'email'" class="form-field">
              <label>
                <span v-if="selectedRule.required" class="required">*</span> 填写内容
              </label>
              <input
                v-model="formData.value"
                type="email"
                :placeholder="selectedRule.fillHint || '请输入邮箱地址'"
                class="form-input"
                @blur="validateField"
                @input="onFieldInput"
              />
              <div v-if="fieldError" class="error-message">{{ fieldError }}</div>
              <div v-if="selectedRule.fillHint && !fieldError" class="hint-message">{{ selectedRule.fillHint }}</div>
            </div>

            <!-- 电话类型 -->
            <div v-else-if="selectedRule.dataType === 'phone'" class="form-field">
              <label>
                <span v-if="selectedRule.required" class="required">*</span> 填写内容
              </label>
              <input
                v-model="formData.value"
                type="tel"
                :placeholder="selectedRule.fillHint || '请输入电话号码'"
                class="form-input"
                @blur="validateField"
                @input="onFieldInput"
              />
              <div v-if="fieldError" class="error-message">{{ fieldError }}</div>
              <div v-if="selectedRule.fillHint && !fieldError" class="hint-message">{{ selectedRule.fillHint }}</div>
            </div>

            <!-- 身份证类型 -->
            <div v-else-if="selectedRule.dataType === 'idcard'" class="form-field">
              <label>
                <span v-if="selectedRule.required" class="required">*</span> 填写内容
              </label>
              <input
                v-model="formData.value"
                type="text"
                maxlength="18"
                :placeholder="selectedRule.fillHint || '请输入18位身份证号'"
                class="form-input"
                @blur="validateField"
                @input="onFieldInput"
              />
              <div v-if="fieldError" class="error-message">{{ fieldError }}</div>
              <div v-if="selectedRule.fillHint && !fieldError" class="hint-message">{{ selectedRule.fillHint }}</div>
            </div>

            <!-- 网址类型 -->
            <div v-else-if="selectedRule.dataType === 'url'" class="form-field">
              <label>
                <span v-if="selectedRule.required" class="required">*</span> 填写内容
              </label>
              <input
                v-model="formData.value"
                type="url"
                :placeholder="selectedRule.fillHint || '请输入网址'"
                class="form-input"
                @blur="validateField"
                @input="onFieldInput"
              />
              <div v-if="fieldError" class="error-message">{{ fieldError }}</div>
              <div v-if="selectedRule.fillHint && !fieldError" class="hint-message">{{ selectedRule.fillHint }}</div>
            </div>

            <!-- 操作按钮 -->
            <div class="form-actions">
              <button class="btn btn-primary" @click="saveFormData">保存</button>
              <button class="btn btn-secondary" @click="goToBookmark">定位到书签</button>
            </div>
          </div>

          <!-- 未找到规则提示 -->
          <div v-else class="no-rule-hint">
            <p>未找到该书签对应的规则配置</p>
            <p class="hint-text">请在「规则制作」中为该书签配置规则</p>
          </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 非表单模式下的默认内容 -->
    <div v-else class="default-content">
      <div class="header">
        <h2>规则库</h2>
      </div>
      <div class="content">
        <p>请先进入表单模式以使用表单编辑功能</p>
      </div>
    </div>
  </div>
</template>

<script>
import { loadRulesFromDoc } from '../utils/templateRules.js'
import { DATA_TYPES } from '../utils/templateRules.js'

export default {
  name: 'TaskPaneRight',
  data() {
    return {
      isFormMode: false,
      bookmarks: [],
      bookmarksLoading: false,
      bookmarkGroupExpandedMap: {},
      selectedBookmarkId: null,
      selectedBookmark: null,
      selectedRule: null,
      formData: {
        value: ''
      },
      fieldError: '',
      checkInterval: null,
      bookmarkCheckInterval: null,
      autoSaveTimer: null,
      isAutoSaving: false,
      selectedTags: [], // 下拉选项类型选中的tag列表
      bookmarkWidth: 0, // 书签列表宽度，0表示使用25%比例（1/4）
      bookmarkCollapsed: false, // 书签列表是否折叠
      isResizing: false // 是否正在调整大小
    }
  },
  computed: {
    bookmarkGroups() {
      const groupsMap = new Map()
      ;(this.bookmarks || []).forEach((bookmark) => {
        const groupKey = String(bookmark.ruleId || '__ungrouped__')
        const existing = groupsMap.get(groupKey)
        if (existing) {
          existing.bookmarks.push(bookmark)
          existing.firstPosition = Math.min(existing.firstPosition, Number(bookmark.position || 0))
          return
        }
        groupsMap.set(groupKey, {
          groupKey,
          ruleId: groupKey === '__ungrouped__' ? '' : groupKey,
          ruleName: bookmark.rule?.name || bookmark.name || '未匹配规则',
          firstPosition: Number(bookmark.position || 0),
          bookmarks: [bookmark]
        })
      })
      return Array.from(groupsMap.values())
        .map((group) => ({
          ...group,
          bookmarks: group.bookmarks.slice().sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
        }))
        .sort((a, b) => a.firstPosition - b.firstPosition)
    }
  },
  mounted() {
    console.log('TaskPaneRight mounted, 开始检查表单模式')
    // 立即检查表单模式状态
    this.checkFormMode()
    // 定期检查表单模式状态（每500ms检查一次）
    this.checkInterval = setInterval(() => {
      this.checkFormMode()
    }, 500)
    // 监听文档变化
    this.setupDocumentListener()
    // 监听窗口激活事件，确保表单模式状态同步
    try {
      if (window.Application?.ApiEvent) {
        window.Application.ApiEvent.AddApiEventListener('WindowActivate', () => {
          console.log('窗口激活，重新检查表单模式')
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
    this.stopBookmarkCheckInterval()
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer)
      this.autoSaveTimer = null
    }
    this.isAutoSaving = false
    // 移除拖拽事件监听
    document.removeEventListener('mousemove', this.handleResize)
    document.removeEventListener('mouseup', this.stopResize)
  },
  methods: {
    // 检查表单模式状态
    checkFormMode() {
      try {
        const doc = window.Application?.ActiveDocument
        if (!doc) {
          const wasFormMode = this.isFormMode
          this.isFormMode = false
          if (wasFormMode) {
            this.bookmarks = []
            this.bookmarkGroupExpandedMap = {}
            this.selectedBookmarkId = null
            this.selectedBookmark = null
            this.selectedRule = null
          }
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
        console.log('检查表单模式:', { 
          protectionType: pt, 
          isFormProtected, 
          varFormMode, 
          newFormMode, 
          currentIsFormMode: this.isFormMode 
        })
        // 只有状态变化时才更新
        if (this.isFormMode !== newFormMode) {
          console.log('表单模式状态变化:', this.isFormMode, '->', newFormMode)
          this.isFormMode = newFormMode
          if (this.isFormMode) {
            console.log('进入表单模式，根据光标位置确定当前书签')
            this.loadBookmarks()
            this.$nextTick(() => this.checkCurrentBookmark())
            this.startBookmarkCheckInterval()
          } else {
            console.log('退出表单模式，清空数据')
            this.stopBookmarkCheckInterval()
            this.bookmarks = []
            this.bookmarkGroupExpandedMap = {}
            this.selectedBookmarkId = null
            this.selectedBookmark = null
            this.selectedRule = null
          }
        } else if (this.isFormMode) {
          const shouldRefresh = !this.bookmarks.length || this.bookmarks.length === 0
          if (shouldRefresh) {
            this.loadBookmarks()
          }
        }
      } catch (e) {
        console.error('检查表单模式失败:', e)
        const wasFormMode = this.isFormMode
        this.isFormMode = false
        if (wasFormMode) {
          this.bookmarks = []
          this.bookmarkGroupExpandedMap = {}
          this.selectedBookmarkId = null
          this.selectedBookmark = null
          this.selectedRule = null
        }
      }
    },
    // 设置文档监听
    setupDocumentListener() {
      try {
        if (window.Application?.ApiEvent) {
          window.Application.ApiEvent.AddApiEventListener('DocumentSelectionChange', () => {
            this.checkCurrentBookmark()
          })
        }
      } catch (e) {
        console.warn('设置文档监听失败:', e)
      }
    },
    // 表单模式下短周期轮询当前书签，使点击书签时右侧编辑框立马展示
    startBookmarkCheckInterval() {
      this.stopBookmarkCheckInterval()
      this.bookmarkCheckInterval = setInterval(() => {
        if (this.isFormMode) this.checkCurrentBookmark()
      }, 180)
    },
    stopBookmarkCheckInterval() {
      if (this.bookmarkCheckInterval) {
        clearInterval(this.bookmarkCheckInterval)
        this.bookmarkCheckInterval = null
      }
    },
    // 根据文档中光标（选区）位置确定当前书签，动态切换右侧编辑表单
    checkCurrentBookmark() {
      if (!this.isFormMode) return
      // 如果正在自动保存，延迟检查，避免干扰用户操作
      if (this.autoSaveTimer || this.isAutoSaving) return
      try {
        const app = window.Application
        const doc = app?.ActiveDocument
        if (!doc) {
          this.clearBookmarkSelection()
          return
        }
        // WPS/Word 中选区优先用 Application.Selection，部分环境需用 ActiveWindow.Selection 或 doc.Selection
        const selection = app.Selection || (app.ActiveWindow && app.ActiveWindow.Selection) || doc.Selection
        if (!selection) {
          this.clearBookmarkSelection()
          return
        }
        const bookmarks = doc.Bookmarks
        if (!bookmarks || bookmarks.Count === 0) {
          this.clearBookmarkSelection()
          return
        }
        let selStart = null
        let selEnd = null
        try {
          selStart = selection.Start
          selEnd = selection.End
        } catch (e1) {
          try {
            if (selection.Range) {
              selStart = selection.Range.Start
              selEnd = selection.Range.End
            }
          } catch (e2) {}
        }
        if (selStart == null || selEnd == null) {
          this.clearBookmarkSelection()
          return
        }
        selStart = Number(selStart)
        selEnd = Number(selEnd)
        if (isNaN(selStart) || isNaN(selEnd)) {
          this.clearBookmarkSelection()
          return
        }
        const rules = loadRulesFromDoc()
        for (let i = 1; i <= bookmarks.Count; i++) {
          try {
            const bm = bookmarks.Item(i)
            if (!bm || bm.Empty) continue
            const rng = bm.Range
            if (!rng) continue
            const rngStart = Number(rng.Start)
            const rngEnd = Number(rng.End)
            if (isNaN(rngStart) || isNaN(rngEnd)) continue
            // 选区或光标在书签内即匹配：选区完全在书签内，或光标（Start）在书签内
            const inside = (selStart >= rngStart && selEnd <= rngEnd) ||
              (selStart >= rngStart && selStart <= rngEnd)
            if (inside) {
              const fullName = (bm.Name || '').trim()
              if (!fullName || fullName.indexOf('_') === 0) continue
              // 如果当前选中的书签就是检测到的书签，不重复切换
              if (this.selectedBookmarkId === fullName) {
                return
              }
              const firstUnderscore = fullName.indexOf('_')
              const name = firstUnderscore >= 0 ? fullName.substring(0, firstUnderscore).trim() : fullName
              const parts = fullName.split('_')
              const ruleId = parts.length >= 2 ? parts[1] : null
              const rule = ruleId ? rules.find(r => r.id === ruleId) : null
              let content = ''
              if (!bm.Empty && bm.Range) {
                content = (bm.Range.Text || '')
                  .replace(/\r\n$/g, '')
                  .replace(/\r$/g, '')
                  .replace(/\n$/g, '')
                  .replace(/\x07$/g, '')
                  .trim()
              }
              const bookmark = {
                bookmarkName: fullName,
                name: name || fullName,
                content,
                ruleId,
                rule,
                bookmarkIndex: this.parseBookmarkIndex(fullName),
                pageNumber: this.getRangePageNumber(bm.Range)
              }
              this.selectBookmark(bookmark)
              return
            }
          } catch (e) {}
        }
        // 如果光标不在任何书签内，清空选择（但保留当前表单内容，避免用户正在编辑时被打断）
        // 只有当确实需要切换时才清空
        if (this.selectedBookmarkId) {
          // 检查光标是否真的不在当前书签内
          const currentBm = doc.Bookmarks.Item(this.selectedBookmarkId)
          if (currentBm && currentBm.Range) {
            const rngStart = Number(currentBm.Range.Start)
            const rngEnd = Number(currentBm.Range.End)
            const stillInside = (selStart >= rngStart && selEnd <= rngEnd) ||
              (selStart >= rngStart && selStart <= rngEnd)
            if (!stillInside) {
              this.clearBookmarkSelection()
            }
          } else {
            this.clearBookmarkSelection()
          }
        }
      } catch (e) {
        console.warn('检查当前书签失败:', e)
        // 出错时不清空选择，避免打断用户操作
      }
    },
    clearBookmarkSelection() {
      if (this.selectedBookmarkId != null || this.selectedBookmark != null || this.selectedRule != null) {
        // 如果正在自动保存，先取消
        if (this.autoSaveTimer) {
          clearTimeout(this.autoSaveTimer)
          this.autoSaveTimer = null
        }
        this.selectedBookmarkId = null
        this.selectedBookmark = null
        this.selectedRule = null
        this.formData.value = ''
        this.selectedTags = []
        this.fieldError = ''
        this.isAutoSaving = false
      }
    },
    parseBookmarkIndex(fullName) {
      const parts = String(fullName || '')
        .split('_')
        .map(part => part.trim())
        .filter(Boolean)
      if (parts.length < 3) return ''
      return parts[parts.length - 1] || ''
    },
    buildBookmarkItemTitle(item) {
      const name = item?.name || item?.bookmarkName || '未命名书签'
      const indexText = item?.bookmarkIndex ? `书签编号 ${item.bookmarkIndex}` : '书签编号 未知'
      const pageText = item?.pageNumber ? `第${item.pageNumber}页` : '页码未知'
      return `${name} ${indexText} ${pageText}`
    },
    getRangePageNumber(range) {
      if (!range) return 0
      const pageConstants = [3, 7, 8, 1]
      try {
        let targetRange = range
        if (typeof range.Duplicate === 'function') {
          const duplicatedRange = range.Duplicate()
          if (duplicatedRange) {
            targetRange = duplicatedRange
            if (typeof duplicatedRange.Collapse === 'function') {
              duplicatedRange.Collapse(1)
            }
          }
        }
        if (!targetRange || typeof targetRange.Information !== 'function') return 0
        for (const pageConst of pageConstants) {
          try {
            const pageInfo = targetRange.Information(pageConst)
            const pageNumber = parseInt(pageInfo, 10)
            if (!isNaN(pageNumber) && pageNumber > 0) {
              return pageNumber
            }
          } catch (e) {
            continue
          }
        }
      } catch (e) {}
      return 0
    },
    getBookmarkGroupKey(ruleId) {
      return String(ruleId || '__ungrouped__')
    },
    isBookmarkGroupExpanded(ruleId) {
      return this.bookmarkGroupExpandedMap[this.getBookmarkGroupKey(ruleId)] !== false
    },
    toggleBookmarkGroup(ruleId) {
      const key = this.getBookmarkGroupKey(ruleId)
      this.bookmarkGroupExpandedMap = {
        ...this.bookmarkGroupExpandedMap,
        [key]: !this.isBookmarkGroupExpanded(ruleId)
      }
    },
    // 加载书签列表（按文档位置排序）
    loadBookmarks() {
      if (!this.isFormMode) return
      this.bookmarksLoading = true
      try {
        const doc = window.Application?.ActiveDocument
        if (!doc) {
          this.bookmarks = []
          this.bookmarkGroupExpandedMap = {}
          this.bookmarksLoading = false
          return
        }
        const bookmarks = doc.Bookmarks
        if (!bookmarks || bookmarks.Count === 0) {
          this.bookmarks = []
          this.bookmarkGroupExpandedMap = {}
          this.bookmarksLoading = false
          return
        }
        const rules = loadRulesFromDoc()
        const list = []
        
        // 第一步：快速收集所有书签的基本信息和位置
        for (let i = 1; i <= bookmarks.Count; i++) {
          try {
            const bm = bookmarks.Item(i)
            if (!bm) continue
            const fullName = (bm.Name || '').trim()
            if (!fullName || fullName.indexOf('_') === 0) continue
            
            // 获取书签位置（Range.Start），用于排序
            let position = 0
            try {
              if (bm.Range) {
                position = Number(bm.Range.Start) || 0
              }
            } catch (e) {
              // 如果获取位置失败，使用索引作为备选
              position = i * 1000000
            }
            
            // 书签格式：名称_id_编号，取第一个 _ 前的部分作为显示名称
            const firstUnderscore = fullName.indexOf('_')
            const name = firstUnderscore >= 0 ? fullName.substring(0, firstUnderscore).trim() : fullName
            
            // 解析规则ID
            const parts = fullName.split('_')
            const ruleId = parts.length >= 2 ? parts[1] : null
            const rule = ruleId ? rules.find(r => r.id === ruleId) : null
            
            // 获取书签内容（延迟获取，避免性能问题）
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
              content,
              ruleId,
              rule,
              bookmarkIndex: this.parseBookmarkIndex(fullName),
              pageNumber: this.getRangePageNumber(bm.Range),
              position // 添加位置信息用于排序
            })
          } catch (e) {
            console.warn('读取书签失败:', e)
          }
        }
        
        // 第二步：按位置排序（从文档开始到最后）
        list.sort((a, b) => {
          return a.position - b.position
        })
        
        this.bookmarks = list
        const nextExpandedMap = {}
        list.forEach((item) => {
          const key = this.getBookmarkGroupKey(item.ruleId)
          if (Object.prototype.hasOwnProperty.call(nextExpandedMap, key)) return
          if (Object.prototype.hasOwnProperty.call(this.bookmarkGroupExpandedMap, key)) {
            nextExpandedMap[key] = this.bookmarkGroupExpandedMap[key]
          } else {
            nextExpandedMap[key] = true
          }
        })
        this.bookmarkGroupExpandedMap = nextExpandedMap
        // 如果当前选中的书签还在列表中，保持选中状态
        if (this.selectedBookmarkId) {
          const stillExists = list.find(b => b.bookmarkName === this.selectedBookmarkId)
          if (!stillExists) {
            this.selectedBookmarkId = null
            this.selectedBookmark = null
            this.selectedRule = null
          }
        }
      } catch (e) {
        console.error('loadBookmarks:', e)
        this.bookmarks = []
      }
      this.bookmarksLoading = false
    },
    openSelectedRuleEditor() {
      if (!this.selectedRule?.id) return
      try {
        const base = window.Application?.PluginStorage?.getItem('AddinBaseUrl')
        const path = (base || window.location.origin + window.location.pathname.replace(/\/?index\.html$/i, '')).replace(/#.*$/, '')
        const hash = window.location.protocol === 'file:' ? '' : '/#'
        const url = `${path}${hash}/template-form-dialog?mode=edit&id=${encodeURIComponent(this.selectedRule.id)}`
        window.Application.ShowDialog(
          url,
          '修改表单项',
          520 * (window.devicePixelRatio || 1),
          860 * (window.devicePixelRatio || 1),
          false
        )
      } catch (e) {
        console.error('打开规则编辑失败:', e)
      }
    },
    // 选择书签
    selectBookmark(bookmark) {
      const groupKey = this.getBookmarkGroupKey(bookmark?.ruleId)
      this.bookmarkGroupExpandedMap = {
        ...this.bookmarkGroupExpandedMap,
        [groupKey]: true
      }
      // 如果切换的是同一个书签，不重复加载
      if (this.selectedBookmarkId === bookmark.bookmarkName) {
        // 即使同一个书签，也重新加载内容以确保同步
        this.$nextTick(() => {
          this.loadBookmarkContent(bookmark)
          // 确保表单输入框获得焦点
          this.focusFormInput()
        })
        return
      }
      this.selectedBookmarkId = bookmark.bookmarkName
      this.selectedBookmark = bookmark
      this.selectedRule = bookmark.rule || null
      this.fieldError = ''
      this.formData.value = ''
      this.selectedTags = [] // 重置选中的tag
      // 等视图切换到新书签的编辑控件后再从文档加载内容，避免内容不刷新
      this.$nextTick(() => {
        this.loadBookmarkContent(bookmark)
        // 加载完成后，确保表单输入框获得焦点
        setTimeout(() => {
          this.focusFormInput()
        }, 50)
      })
    },
    // 聚焦到表单输入框
    focusFormInput() {
      try {
        // 查找当前活动的表单输入框
        const formSection = this.$el.querySelector('.form-edit-section')
        if (!formSection) return
        
        // 查找第一个可用的输入框（优先查找 input，然后是 textarea，最后是 select）
        let input = formSection.querySelector('input[type="text"], input[type="number"], input[type="email"], input[type="tel"], input[type="url"], input[type="date"], input[type="datetime-local"], input[type="time"]')
        if (!input) {
          input = formSection.querySelector('textarea')
        }
        if (!input) {
          input = formSection.querySelector('select')
        }
        
        if (input && typeof input.focus === 'function') {
          // 延迟聚焦，确保DOM已更新且内容已加载
          setTimeout(() => {
            try {
              input.focus()
              // 如果是文本输入框，将光标移到末尾
              if (input.setSelectionRange && input.value) {
                const len = input.value.length
                input.setSelectionRange(len, len)
              }
            } catch (e) {
              console.warn('聚焦输入框失败:', e)
            }
          }, 50)
        }
      } catch (e) {
        console.warn('聚焦表单输入框失败:', e)
      }
    },
    // 加载书签内容到编辑框
    loadBookmarkContent(bookmark) {
      try {
        // 设置加载标志，防止触发输入事件
        this.isAutoSaving = true
        const doc = window.Application?.ActiveDocument
        if (!doc) {
          this.isAutoSaving = false
          return
        }
        const bm = doc.Bookmarks.Item(bookmark.bookmarkName)
        if (!bm || !bm.Range) {
          this.isAutoSaving = false
          return
        }
        let content = ''
        if (!bm.Empty) {
          content = (bm.Range.Text || '')
            .replace(/\r\n$/g, '')
            .replace(/\r$/g, '')
            .replace(/\n$/g, '')
            .replace(/\x07$/g, '')
            .trim()
        }
        const rule = this.selectedRule || bookmark.rule
        if (rule) {
          if (rule.dataType === 'date' && content) {
            // 如果是"年月日"格式，转换为输入框格式
            content = this.formatDateForInput(content, 'date')
          } else if (rule.dataType === 'datetime' && content) {
            // 如果是"年月日 时分秒"格式，转换为datetime-local格式
            content = this.formatDateForInput(content, 'datetime')
          } else if (rule.dataType === 'time' && content) {
            content = this.formatDateForInput(content, 'time')
          }
        }
        // 对于下拉选项类型，解析逗号分隔的字符串并设置选中的tag
        if (rule && rule.dataType === 'select') {
          const options = this.getSelectOptions(rule)
          if (content) {
            // 解析逗号分隔的字符串
            const tags = content.split(',').map(t => t.trim()).filter(t => t)
            // 过滤出在选项列表中的tag
            this.selectedTags = tags.filter(tag => options.includes(tag))
            // 更新formData.value
            content = this.selectedTags.join(',')
          } else {
            this.selectedTags = []
            content = ''
          }
        }
        // 对于布尔类型，确保值在选项列表中
        if (rule && rule.dataType === 'boolean' && content) {
          const options = this.getBooleanOptions(rule)
          if (!options.includes(content)) {
            // 如果书签中的值不在选项列表中，清空值
            content = ''
          }
        }
        // 对于下拉选项类型，如果内容没有变化，不需要更新
        if (rule && rule.dataType === 'select') {
          const currentValue = this.selectedTags.join(',')
          if (this.formData.value === currentValue && currentValue === content) {
            this.isAutoSaving = false
            return
          }
        } else {
          // 其他类型，如果内容没有变化，不需要更新
          if (this.formData.value === content) {
            this.isAutoSaving = false
            return
          }
        }
        // 使用 $nextTick 确保 Vue 正确更新表单的值
        this.$nextTick(() => {
          if (rule && rule.dataType === 'select') {
            // 下拉选项类型已经通过selectedTags更新，只需要更新formData.value
            this.formData.value = content
          } else {
            this.formData.value = content
          }
          // 立即重置标志，允许用户输入
          this.isAutoSaving = false
          // 确保输入框获得焦点
          setTimeout(() => {
            this.focusFormInput()
          }, 50)
        })
      } catch (e) {
        console.error('加载书签内容失败:', e)
        this.isAutoSaving = false
      }
    },
    // 格式化日期为输入框格式
    formatDateForInput(dateStr, type) {
      if (!dateStr) return ''
      try {
        let date = null
        // 如果是"年月日 时分秒"格式，先解析
        if (type === 'datetime' && dateStr.includes('年') && dateStr.includes('月') && dateStr.includes('日')) {
          date = this.parseChineseDateTime(dateStr)
        } else {
          date = new Date(dateStr)
        }
        
        if (!date || isNaN(date.getTime())) {
          // 如果无法解析，尝试其他格式
          return dateStr
        }
        
        if (type === 'date') {
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        } else if (type === 'datetime') {
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          const hours = String(date.getHours()).padStart(2, '0')
          const minutes = String(date.getMinutes()).padStart(2, '0')
          const seconds = String(date.getSeconds()).padStart(2, '0')
          return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
        } else if (type === 'time') {
          const hours = String(date.getHours()).padStart(2, '0')
          const minutes = String(date.getMinutes()).padStart(2, '0')
          return `${hours}:${minutes}`
        }
        return dateStr
      } catch (e) {
        return dateStr
      }
    },
    // 解析"年月日 时分秒"格式的日期时间字符串
    parseChineseDateTime(dateStr) {
      try {
        // 格式：2024年01月01日 12:30:45 或 2024年1月1日 12:30:45
        const match = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/)
        if (match) {
          const year = parseInt(match[1], 10)
          const month = parseInt(match[2], 10) - 1 // 月份从0开始
          const day = parseInt(match[3], 10)
          const hours = parseInt(match[4], 10)
          const minutes = parseInt(match[5], 10)
          const seconds = parseInt(match[6], 10)
          return new Date(year, month, day, hours, minutes, seconds)
        }
        // 如果没有秒，尝试：2024年01月01日 12:30
        const match2 = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{1,2})/)
        if (match2) {
          const year = parseInt(match2[1], 10)
          const month = parseInt(match2[2], 10) - 1
          const day = parseInt(match2[3], 10)
          const hours = parseInt(match2[4], 10)
          const minutes = parseInt(match2[5], 10)
          return new Date(year, month, day, hours, minutes, 0)
        }
        return null
      } catch (e) {
        return null
      }
    },
    // 格式化日期时间为"年月日 时分秒"格式（用于保存到书签）
    formatDateTimeForBookmark(dateStr, type) {
      if (!dateStr) return ''
      try {
        let date = null
        // 如果是datetime-local格式（YYYY-MM-DDTHH:mm:ss 或 YYYY-MM-DDTHH:mm）
        if (type === 'datetime' && dateStr.includes('T')) {
          date = new Date(dateStr)
        } else {
          date = new Date(dateStr)
        }
        
        if (!date || isNaN(date.getTime())) {
          return dateStr
        }
        
        if (type === 'datetime') {
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          const hours = String(date.getHours()).padStart(2, '0')
          const minutes = String(date.getMinutes()).padStart(2, '0')
          const seconds = String(date.getSeconds()).padStart(2, '0')
          return `${year}年${month}月${day}日 ${hours}:${minutes}:${seconds}`
        } else if (type === 'date') {
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          return `${year}年${month}月${day}日`
        }
        return dateStr
      } catch (e) {
        return dateStr
      }
    },
    // 获取数据类型标签
    getDataTypeLabel(dataType) {
      const type = DATA_TYPES.find(t => t.value === dataType)
      return type ? type.label : dataType || '未知'
    },
    // 获取布尔选项
    getBooleanOptions(rule) {
      const allowedValues = rule.constraints?.allowedValues || '是,否'
      return allowedValues.split(',').map(v => v.trim()).filter(v => v)
    },
    // 获取下拉选项
    getSelectOptions(rule) {
      const options = rule.constraints?.selectOptions || ''
      return options.split(',').map(v => v.trim()).filter(v => v)
    },
    // 字段输入事件
    onFieldInput(event) {
      // 输入时清除错误
      if (this.fieldError) {
        this.fieldError = ''
      }
      // 如果正在加载内容，不处理自动保存
      if (this.isAutoSaving) {
        // 确保输入框保持焦点
        if (event && event.target) {
          event.target.focus()
        }
        return
      }
      // 布尔类型下拉选择后立即保存到书签（自动保存）
      // 下拉选项类型改为tag按钮形式，不再自动保存
      if (this.selectedRule && this.selectedRule.dataType === 'boolean') {
        // 延迟保存，避免频繁操作
        if (this.autoSaveTimer) {
          clearTimeout(this.autoSaveTimer)
        }
        this.autoSaveTimer = setTimeout(() => {
          this.saveFormDataToBookmark()
        }, 500)
      }
    },
    // 切换tag选中状态
    toggleTag(tag) {
      if (!this.selectedRule || this.selectedRule.dataType !== 'select') return
      const index = this.selectedTags.indexOf(tag)
      if (index > -1) {
        // 取消选中
        this.selectedTags.splice(index, 1)
      } else {
        // 选中
        this.selectedTags.push(tag)
      }
      // 更新formData.value为逗号分隔的字符串
      this.formData.value = this.selectedTags.join(',')
      // 清除错误提示
      if (this.fieldError) {
        this.fieldError = ''
      }
    },
    // 检查tag是否被选中
    isTagSelected(tag) {
      return this.selectedTags.includes(tag)
    },
    // 验证字段
    validateField() {
      if (!this.selectedRule) return true
      const value = this.formData.value
      const rule = this.selectedRule
      this.fieldError = ''

      // 必填校验
      if (rule.required) {
        // 对于下拉选项类型，检查是否有选中的tag
        if (rule.dataType === 'select') {
          if (!this.selectedTags || this.selectedTags.length === 0) {
            this.fieldError = '此项为必填项，请至少选择一个选项'
            return false
          }
        } else {
          if (!value || (typeof value === 'string' && !value.trim())) {
            this.fieldError = '此项为必填项'
            return false
          }
        }
      }

      // 如果为空且非必填，直接通过
      if (!value || (typeof value === 'string' && !value.trim())) {
        return true
      }

      const constraints = rule.constraints || {}

      // 字符串类型校验
      if (rule.dataType === 'string') {
        const strValue = String(value).trim()
        // 长度校验
        if (constraints.minLength !== null && constraints.minLength !== undefined && strValue.length < constraints.minLength) {
          this.fieldError = `长度不能少于 ${constraints.minLength} 个字符`
          return false
        }
        if (constraints.maxLength !== null && constraints.maxLength !== undefined && strValue.length > constraints.maxLength) {
          this.fieldError = `长度不能超过 ${constraints.maxLength} 个字符`
          return false
        }
        // 必须包含
        if (constraints.mustContain && !strValue.includes(constraints.mustContain)) {
          this.fieldError = `必须包含 "${constraints.mustContain}"`
          return false
        }
        // 不能包含
        if (constraints.mustNotContain && strValue.includes(constraints.mustNotContain)) {
          this.fieldError = `不能包含 "${constraints.mustNotContain}"`
          return false
        }
        // 正则匹配
        if (constraints.pattern) {
          try {
            const regex = new RegExp(constraints.pattern)
            if (!regex.test(strValue)) {
              this.fieldError = rule.reviewHint || '格式不正确'
              return false
            }
          } catch (e) {
            console.warn('正则表达式错误:', e)
          }
        }
      }

      // 整数类型校验
      if (rule.dataType === 'integer') {
        const numValue = Number(value)
        if (isNaN(numValue) || !Number.isInteger(numValue)) {
          this.fieldError = '请输入有效的整数'
          return false
        }
        if (constraints.min !== null && constraints.min !== undefined && numValue < constraints.min) {
          this.fieldError = `值不能小于 ${constraints.min}`
          return false
        }
        if (constraints.max !== null && constraints.max !== undefined && numValue > constraints.max) {
          this.fieldError = `值不能大于 ${constraints.max}`
          return false
        }
        if (constraints.equals !== null && constraints.equals !== undefined && numValue !== constraints.equals) {
          this.fieldError = `值必须等于 ${constraints.equals}`
          return false
        }
      }

      // 小数类型校验
      if (rule.dataType === 'decimal') {
        const numValue = Number(value)
        if (isNaN(numValue)) {
          this.fieldError = '请输入有效的小数'
          return false
        }
        if (constraints.min !== null && constraints.min !== undefined && numValue < constraints.min) {
          this.fieldError = `值不能小于 ${constraints.min}`
          return false
        }
        if (constraints.max !== null && constraints.max !== undefined && numValue > constraints.max) {
          this.fieldError = `值不能大于 ${constraints.max}`
          return false
        }
        if (constraints.equals !== null && constraints.equals !== undefined && numValue !== constraints.equals) {
          this.fieldError = `值必须等于 ${constraints.equals}`
          return false
        }
        // 小数位数校验
        if (constraints.decimalPlaces !== null && constraints.decimalPlaces !== undefined) {
          const parts = String(value).split('.')
          if (parts.length > 1 && parts[1].length > constraints.decimalPlaces) {
            this.fieldError = `小数位数不能超过 ${constraints.decimalPlaces} 位`
            return false
          }
        }
      }

      // 日期类型校验
      if (rule.dataType === 'date') {
        const dateValue = new Date(value)
        if (isNaN(dateValue.getTime())) {
          this.fieldError = '请输入有效的日期'
          return false
        }
        if (constraints.dateMin) {
          const minDate = new Date(constraints.dateMin)
          if (dateValue < minDate) {
            this.fieldError = `日期不能早于 ${constraints.dateMin}`
            return false
          }
        }
        if (constraints.dateMax) {
          const maxDate = new Date(constraints.dateMax)
          if (dateValue > maxDate) {
            this.fieldError = `日期不能晚于 ${constraints.dateMax}`
            return false
          }
        }
        if (constraints.dateEquals) {
          const equalsDate = new Date(constraints.dateEquals)
          if (dateValue.getTime() !== equalsDate.getTime()) {
            this.fieldError = `日期必须等于 ${constraints.dateEquals}`
            return false
          }
        }
      }

      // 日期时间类型校验
      if (rule.dataType === 'datetime') {
        const dateValue = new Date(value)
        if (isNaN(dateValue.getTime())) {
          this.fieldError = '请输入有效的日期时间'
          return false
        }
        if (constraints.dateMin) {
          const minDate = new Date(constraints.dateMin)
          if (dateValue < minDate) {
            this.fieldError = `日期时间不能早于 ${constraints.dateMin}`
            return false
          }
        }
        if (constraints.dateMax) {
          const maxDate = new Date(constraints.dateMax)
          if (dateValue > maxDate) {
            this.fieldError = `日期时间不能晚于 ${constraints.dateMax}`
            return false
          }
        }
      }

      // 邮箱类型校验
      if (rule.dataType === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(String(value).trim())) {
          this.fieldError = '请输入有效的邮箱地址'
          return false
        }
      }

      // 电话类型校验
      if (rule.dataType === 'phone') {
        const phoneRegex = /^1[3-9]\d{9}$|^0\d{2,3}-?\d{7,8}$/
        if (!phoneRegex.test(String(value).trim())) {
          this.fieldError = '请输入有效的电话号码'
          return false
        }
      }

      // 身份证类型校验
      if (rule.dataType === 'idcard') {
        const idcardRegex = /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/
        if (!idcardRegex.test(String(value).trim())) {
          this.fieldError = '请输入有效的18位身份证号'
          return false
        }
      }

      // 网址类型校验
      if (rule.dataType === 'url') {
        try {
          new URL(String(value).trim())
        } catch (e) {
          this.fieldError = '请输入有效的网址'
          return false
        }
      }

      // 下拉选项类型校验（tag按钮形式，支持多选）
      if (rule.dataType === 'select') {
        const options = this.getSelectOptions(rule)
        if (value) {
          const tags = String(value).split(',').map(t => t.trim()).filter(t => t)
          // 检查所有选中的tag是否都在选项列表中
          const invalidTags = tags.filter(tag => !options.includes(tag))
          if (invalidTags.length > 0) {
            this.fieldError = `包含无效选项：${invalidTags.join('、')}`
            return false
          }
        }
      }
      // 布尔类型校验
      if (rule.dataType === 'boolean') {
        const options = this.getBooleanOptions(rule)
        if (value && !options.includes(String(value).trim())) {
          this.fieldError = '请从选项中选择'
          return false
        }
      }

      return true
    },
    // 保存表单数据到书签（内部方法，不显示提示）
    saveFormDataToBookmark() {
      if (!this.selectedBookmark || this.isAutoSaving) return
      // 先验证
      if (!this.validateField()) {
        return
      }
      try {
        this.isAutoSaving = true
        const doc = window.Application?.ActiveDocument
        if (!doc) {
          this.isAutoSaving = false
          return
        }
        const bmName = this.selectedBookmark.bookmarkName
        let bm = null
        try {
          bm = doc.Bookmarks.Item(bmName)
        } catch (e) {
          // 书签不存在，跳过自动保存
          this.isAutoSaving = false
          return
        }
        
        if (!bm || !bm.Range) {
          this.isAutoSaving = false
          return
        }
        
        // 对于日期时间类型，转换为"年月日 时分秒"格式保存
        let newText = String(this.formData.value || '').trim()
        if (this.selectedRule) {
          if (this.selectedRule.dataType === 'datetime') {
            newText = this.formatDateTimeForBookmark(newText, 'datetime')
          } else if (this.selectedRule.dataType === 'date') {
            newText = this.formatDateTimeForBookmark(newText, 'date')
          }
        }
        // 如果内容没有变化，不需要保存
        if (this.selectedBookmark.content === newText) {
          this.isAutoSaving = false
          return
        }
        
        // 完全替换书签内容
        const start = bm.Range.Start
        const end = bm.Range.End
        
        // 先删除旧书签
        try {
          bm.Delete()
        } catch (e1) {
          console.warn('删除旧书签失败:', e1)
        }
        
        // 获取替换范围并替换内容
        const rng = doc.Range(start, end)
        rng.Text = newText
        
        // 重新添加书签
        try {
          const newEnd = start + newText.length
          const newRng = doc.Range(start, newEnd)
          doc.Bookmarks.Add(bmName, newRng)
        } catch (e2) {
          console.warn('重新添加书签失败，内容已更新:', e2)
        }
        
        // 更新本地数据
        this.selectedBookmark.content = newText
        this.fieldError = ''
        // 延迟重置标志，确保文档更新完成
        setTimeout(() => {
          this.isAutoSaving = false
        }, 200)
      } catch (e) {
        console.error('自动保存失败:', e)
        this.isAutoSaving = false
      }
    },
    // 保存表单数据
    saveFormData() {
      if (!this.selectedBookmark) return
      // 对于下拉选项类型，确保formData.value是最新的选中tag值
      if (this.selectedRule && this.selectedRule.dataType === 'select') {
        this.formData.value = this.selectedTags.join(',')
      }
      // 先验证
      if (!this.validateField()) {
        return
      }
      try {
        const doc = window.Application?.ActiveDocument
        if (!doc) {
          alert('当前没有打开任何文档')
          return
        }
        const bmName = this.selectedBookmark.bookmarkName
        let bm = null
        try {
          bm = doc.Bookmarks.Item(bmName)
        } catch (e) {
          // 书签不存在，尝试创建新书签
          console.warn('书签不存在，将创建新书签:', e)
        }
        
        // 对于日期时间类型，转换为"年月日 时分秒"格式保存
        let newText = String(this.formData.value || '').trim()
        if (this.selectedRule) {
          if (this.selectedRule.dataType === 'datetime') {
            newText = this.formatDateTimeForBookmark(newText, 'datetime')
          } else if (this.selectedRule.dataType === 'date') {
            newText = this.formatDateTimeForBookmark(newText, 'date')
          }
        }
        
        if (bm && bm.Range) {
          // 书签存在，完全替换内容
          const start = bm.Range.Start
          const end = bm.Range.End
          
          // 先删除旧书签
          try {
            bm.Delete()
          } catch (e1) {
            console.warn('删除旧书签失败:', e1)
          }
          
          // 获取替换范围
          const rng = doc.Range(start, end)
          // 完全替换书签范围内的内容
          rng.Text = newText
          
          // 重新添加书签
          try {
            const newEnd = start + newText.length
            const newRng = doc.Range(start, newEnd)
            doc.Bookmarks.Add(bmName, newRng)
          } catch (e2) {
            console.warn('重新添加书签失败，内容已更新:', e2)
          }
        } else {
          // 书签不存在，在当前位置创建新书签
          const selection = doc.Application?.Selection || doc.Selection
          if (selection && selection.Range) {
            const start = selection.Range.Start
            const rng = doc.Range(start, start)
            rng.Text = newText
            const newEnd = start + newText.length
            const newRng = doc.Range(start, newEnd)
            doc.Bookmarks.Add(bmName, newRng)
          } else {
            alert('无法确定插入位置，请先点击书签位置')
            return
          }
        }
        
        // 更新本地数据
        this.selectedBookmark.content = newText
        this.fieldError = ''
        alert('保存成功')
      } catch (e) {
        console.error('保存失败:', e)
        alert('保存失败：' + (e.message || e))
      }
    },
    // 定位到书签（不激活文档窗口，避免失去焦点）
    goToBookmark(bookmark = null) {
      const targetBookmark = bookmark || this.selectedBookmark
      if (!targetBookmark) return
      try {
        const doc = window.Application?.ActiveDocument
        if (!doc) {
          console.warn('当前没有打开任何文档')
          return
        }
        // 不激活文档窗口，避免失去焦点
        // try {
        //   doc.Activate()
        // } catch (e) {
        //   console.warn('激活文档失败:', e)
        // }
        const bm = doc.Bookmarks.Item(targetBookmark.bookmarkName)
        if (!bm) {
          console.warn('书签不存在:', targetBookmark.bookmarkName)
          return
        }
        // 选中书签（但不激活窗口）
        if (typeof bm.Select === 'function') {
          bm.Select()
        } else if (bm.Range) {
          // 如果没有 Select 方法，使用 Range 选中
          const rng = bm.Range
          if (rng && typeof rng.Select === 'function') {
            rng.Select()
          }
        }
      } catch (e) {
        console.error('定位书签失败:', e)
        // 不显示 alert，避免打断用户操作
      }
    },
    // 点击书签项（选中并定位到文档，同时展开右侧表单）
    onBookmarkItemClick(item) {
      this.selectBookmark(item)
      this.$nextTick(() => {
        setTimeout(() => {
          this.goToBookmark(item)
        }, 60)
      })
    },
    // 双击书签项（选中并定位）
    onBookmarkItemDblClick(item) {
      this.selectBookmark(item)
      this.$nextTick(() => {
        setTimeout(() => {
          this.goToBookmark(item)
        }, 100)
      })
    },
    // 切换书签列表折叠状态
    toggleBookmarkCollapse() {
      this.bookmarkCollapsed = !this.bookmarkCollapsed
    },
    // 开始调整大小
    startResize(e) {
      this.isResizing = true
      document.addEventListener('mousemove', this.handleResize)
      document.addEventListener('mouseup', this.stopResize)
      e.preventDefault()
    },
    // 处理调整大小
    handleResize(e) {
      if (!this.isResizing) return
      const panelRect = this.$el.querySelector('.form-edit-panel')?.getBoundingClientRect()
      if (!panelRect) return
      const newWidth = e.clientX - panelRect.left
      const totalWidth = panelRect.width
      // 限制最小和最大宽度（最小22%，最大48%）
      const minWidth = Math.max(totalWidth * 0.22, 320)
      const maxWidth = totalWidth * 0.48
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        this.bookmarkWidth = newWidth
      }
    },
    // 停止调整大小
    stopResize() {
      this.isResizing = false
      document.removeEventListener('mousemove', this.handleResize)
      document.removeEventListener('mouseup', this.stopResize)
    }
  }
}
</script>

<style scoped>
.taskpane-right {
  font-size: 14px;
  height: 100vh;
  height: 100dvh;
  min-height: 100vh;
  min-height: 100dvh;
  max-height: 100vh;
  max-height: 100dvh;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  margin-bottom: 12px;
  border-bottom: 1px solid #ddd;
  padding: 10px 12px;
  flex-shrink: 0;
}

.header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.form-edit-panel {
  display: flex;
  flex-direction: row;
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

/* 左侧书签列表 */
.bookmark-left {
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  min-width: 320px;
  height: 100%;
  overflow: hidden;
  border-right: 1px solid #e2e8f0;
  transition: width 0.2s ease;
  flex-shrink: 0;
}

.bookmark-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #e2e8f0;
  background: #fff;
  flex-shrink: 0;
}

.bookmark-title {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}

.btn-collapse {
  padding: 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.btn-collapse:hover {
  background: #f1f5f9;
  color: #334155;
}

.btn-collapse svg {
  transition: transform 0.2s ease;
}

.btn-collapse svg.rotated {
  transform: rotate(180deg);
}

.bookmark-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 8px;
  display: flex;
  flex-direction: column;
}

.bookmark-list-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 可拖拽分割线 */
.resizer {
  width: 4px;
  background: #e2e8f0;
  cursor: col-resize;
  flex-shrink: 0;
  position: relative;
  transition: background 0.2s ease;
}

.resizer:hover {
  background: #3b82f6;
}

.resizer::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  background: transparent;
}

/* 折叠按钮包装器 */
.collapse-button-wrapper {
  width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.btn-collapse-expand {
  padding: 8px 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.btn-collapse-expand:hover {
  background: #f1f5f9;
  color: #334155;
}

/* 右侧表单编辑区域 */
.form-right {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  background: #fff;
  transition: width 0.2s ease;
  flex: 1;
}

.default-content {
  padding: 10px;
}

.content {
  margin-top: 10px;
  padding: 0 12px;
}

/* 书签列表 */
.bookmark-list-section {
  padding: 0 12px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.loading,
.empty-hint {
  padding: 8px;
  color: #999;
  font-size: 12px;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bookmark-tree {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.bookmark-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bookmark-group-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.bookmark-group-header:hover {
  background: #f1f5f9;
  border-color: #e2e8f0;
}

.bookmark-group-header.active {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.bookmark-group-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  flex-shrink: 0;
}

.bookmark-group-toggle svg {
  transition: transform 0.2s ease;
}

.bookmark-group-toggle.expanded svg {
  transform: rotate(90deg);
}

.bookmark-group-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  color: #334155;
  word-break: break-word;
}

.bookmark-group-count {
  flex-shrink: 0;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #e2e8f0;
  color: #475569;
  font-size: 11px;
}

.bookmark-group-children {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-left: 12px;
  padding-left: 10px;
  border-left: 2px solid #e2e8f0;
}

.bookmark-item {
  width: 100%;
  padding: 8px 10px;
  cursor: pointer;
  border-radius: 6px;
  background: #fff;
  transition: all 0.15s ease;
  border: 1px solid transparent;
  text-align: left;
}

.bookmark-item:hover {
  background: #f1f5f9;
  border-color: #e2e8f0;
}

.bookmark-item.active {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #1e40af;
}

.bookmark-name {
  font-weight: 500;
  color: #334155;
  font-size: 13px;
  line-height: 1.4;
  word-break: break-word;
}

.bookmark-item.active .bookmark-name {
  color: #1e40af;
  font-weight: 600;
}

.bookmark-meta {
  margin-top: 2px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
}

.bookmark-type {
  font-size: 11px;
  color: #666;
  background: #e0e0e0;
  padding: 2px 6px;
  border-radius: 3px;
}

/* 表单编辑区域 */
.form-edit-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  padding: 10px 12px;
}

.form-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 4px;
  padding: 10px;
  overflow: hidden;
  box-sizing: border-box;
}

.cursor-hint {
  flex: 1;
  padding: 24px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #666;
  font-size: 13px;
  line-height: 1.6;
  box-sizing: border-box;
}

.cursor-hint p {
  margin: 0;
}

.form-info {
  flex-shrink: 0;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e0e0e0;
}

.info-item {
  margin-bottom: 8px;
  font-size: 13px;
}

.info-item.info-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.info-item label {
  font-weight: 500;
  color: #666;
  margin-right: 8px;
}

.info-item span {
  color: #333;
}

.info-item.info-action {
  margin-top: -4px;
}

.btn-rule-edit {
  padding: 5px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
  color: #1f2937;
  cursor: pointer;
}

.form-fields {
  flex: 1;
  min-height: 0;
  margin-top: 12px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
}

.form-field {
  margin-bottom: 12px;
}

.form-field label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #333;
  font-size: 13px;
}

.form-field .required {
  color: #f44336;
  margin-left: 2px;
}

.form-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
  font-family: inherit;
  transition: border-color 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.form-input.textarea {
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
}

.error-message {
  margin-top: 4px;
  color: #f44336;
  font-size: 12px;
}

.hint-message {
  margin-top: 4px;
  color: #666;
  font-size: 12px;
}

/* Tag选项按钮样式 */
.tag-options-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.tag-option {
  padding: 6px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: #fff;
  color: #333;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.tag-option:hover {
  border-color: #2196f3;
  background: #f5f5f5;
}

.tag-option.tag-selected {
  background: #2196f3;
  border-color: #2196f3;
  color: #fff;
}

.tag-option.tag-selected:hover {
  background: #1976d2;
  border-color: #1976d2;
}

.no-options-hint {
  padding: 12px;
  color: #999;
  font-size: 12px;
  text-align: center;
}

.selected-tags-hint {
  margin-top: 8px;
  padding: 8px 12px;
  background: #e3f2fd;
  border-radius: 4px;
  color: #1976d2;
  font-size: 12px;
  line-height: 1.5;
}

.remark-field {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.remark-content {
  color: #666;
  font-size: 12px;
  line-height: 1.6;
}

.form-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.btn {
  padding: 6px 14px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}

.btn-primary {
  background: #3b82f6;
  color: #fff;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.btn-secondary:hover {
  background: #e2e8f0;
  color: #334155;
}

.no-rule-hint {
  flex: 1;
  min-height: 0;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #999;
  overflow: hidden;
  box-sizing: border-box;
}

.no-rule-hint p {
  margin: 8px 0;
}

.hint-text {
  font-size: 12px;
  color: #bbb;
}
</style>
