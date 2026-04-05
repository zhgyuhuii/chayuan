<template>
  <div class="form-audit-dialog">
    <div class="popup-body">
      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

      <div class="filter-bar">
        <input
          v-model.trim="searchText"
          type="text"
          class="search-input"
          placeholder="搜索规则名称、标签、审计规则"
        />
        <label class="filter-item">
          <span>风险</span>
          <select v-model="riskFilter" class="filter-select compact-select">
            <option value="all">全部</option>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
        </label>
        <label class="filter-item">
          <span>数据类型</span>
          <select v-model="dataTypeFilter" class="filter-select compact-select">
            <option value="all">全部</option>
            <option v-for="type in availableDataTypes" :key="type" :value="type">{{ getDataTypeLabel(type) }}</option>
          </select>
        </label>
        <button type="button" class="btn btn-secondary btn-compact" @click="resetFilters">重置筛选</button>
        <button type="button" class="btn btn-secondary btn-compact" @click="refreshAll">刷新</button>
        <button type="button" class="btn btn-secondary btn-compact" @click="toggleSelectAll(true)">全选</button>
        <button type="button" class="btn btn-secondary btn-compact" @click="toggleSelectAll(false)">清空</button>
      </div>

      <div class="table-wrap">
        <table class="rules-table">
          <thead>
            <tr>
              <th class="col-check">选择</th>
              <th class="col-name">规则名称</th>
              <th class="col-required">必填</th>
              <th class="col-review">审计规则</th>
              <th class="col-type">数据类型</th>
              <th class="col-issue-count">异常问题数</th>
              <th class="col-issue-text">问题内容</th>
              <th class="col-action">详情</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="rule in pagedRuleRows" :key="rule.id">
              <tr class="rule-row" :class="{ selected: isRuleSelected(rule.id) }">
                <td class="col-check">
                  <input v-model="selectedRuleIds" type="checkbox" :value="rule.id" @click.stop />
                </td>
                <td class="col-name">
                  <div class="name-cell">
                    <button
                      type="button"
                      class="tree-toggle"
                      :class="{ expanded: isRuleExpanded(rule.id) }"
                      :title="isRuleExpanded(rule.id) ? '折叠关联书签' : '展开关联书签'"
                      @click.stop="toggleRuleExpand(rule.id)"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14">
                        <path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="name-link"
                      :title="isRuleExpanded(rule.id) ? '点击折叠关联书签' : '点击展开关联书签'"
                      @click.stop="toggleRuleExpand(rule.id)"
                    >{{ rule.name || '未命名规则' }}</button>
                    <span v-if="getBookmarkCount(rule.id) > 0" class="count-badge">{{ getBookmarkCount(rule.id) }}</span>
                  </div>
                </td>
                <td class="col-required">{{ rule.required ? '是' : '否' }}</td>
                <td class="col-review" :title="rule.reviewRule || rule.reviewHint || '-'">{{ rule.reviewRule || rule.reviewHint || '-' }}</td>
                <td class="col-type">{{ getDataTypeLabel(rule.dataType) }}</td>
                <td class="col-issue-count">
                  <div class="rule-issue-summary">
                    <span
                      v-if="getRuleAuditRiskLevel(rule.id)"
                      class="audit-mini-badge"
                      :class="getRuleAuditRiskLevel(rule.id)"
                    >
                      {{ riskLabel(getRuleAuditRiskLevel(rule.id)) }}
                    </span>
                    <button
                      type="button"
                      class="issue-count-badge"
                      :class="{ active: getRuleIssueCount(rule.id) > 0 }"
                      :title="getRuleIssueCount(rule.id) > 0 ? '点击展开查看异常书签' : '当前无异常问题'"
                      @click.stop="handleIssueCountClick(rule.id)"
                    >
                      {{ getRuleIssueCount(rule.id) }}
                    </button>
                  </div>
                </td>
                <td class="col-issue-text">
                  <button
                    type="button"
                    class="issue-summary-cell issue-summary-btn"
                    :class="{ active: getRuleIssueCount(rule.id) > 0 }"
                    :title="getRuleIssueDetailTitle(rule.id)"
                    @click.stop="handleIssueSummaryClick(rule.id)"
                  >
                    {{ getRuleIssueSummary(rule.id) }}
                  </button>
                </td>
                <td class="col-action">
                  <button type="button" class="btn btn-secondary btn-compact" @click.stop="openRuleDetail(rule)">详情</button>
                </td>
              </tr>
              <tr v-if="isRuleExpanded(rule.id)" class="bookmark-tree-row">
                <td></td>
                <td colspan="7" class="bookmark-tree-cell">
                  <div class="bookmark-tree-panel">
                    <div class="bookmark-tree-header">
                      <span class="bookmark-tree-title">关联书签</span>
                      <span class="bookmark-tree-count">共 {{ getBookmarkCount(rule.id) }} 处</span>
                      <span class="bookmark-tree-count">异常问题 {{ getRuleIssueCount(rule.id) }} 项</span>
                    </div>
                    <div v-if="getRuleBookmarks(rule.id).length === 0" class="bookmark-empty">当前规则没有关联书签。</div>
                    <div v-if="getRuleBookmarks(rule.id).length > 0" class="bookmark-table-wrap">
                      <table class="bookmark-table">
                      <thead>
                        <tr>
                          <th class="bookmark-col-name">书签名称</th>
                          <th class="bookmark-col-value">值</th>
                          <th class="bookmark-col-type">值类型</th>
                          <th v-if="showBookmarkAuditColumn" class="bookmark-col-audit">审查意见</th>
                          <th class="bookmark-col-issue">问题详情</th>
                          <th class="bookmark-col-risk">风险级别</th>
                          <th class="bookmark-col-reason">原因</th>
                          <th class="bookmark-col-suggestion">建议</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="bookmark in getRuleBookmarks(rule.id)" :key="bookmark.bookmarkName">
                          <td class="bookmark-name-cell">
                            <button
                              type="button"
                              class="bookmark-link"
                              :title="`定位到 ${bookmark.displayName || bookmark.bookmarkName}`"
                              @click.stop="goToBookmark(bookmark)"
                            >{{ buildBookmarkLabel(bookmark) }}</button>
                          </td>
                          <td class="bookmark-value-cell" :title="bookmark.content || '（空）'">{{ getBookmarkPreviewText(bookmark.content) }}</td>
                          <td class="bookmark-type-cell">{{ getDataTypeLabel(bookmark.dataType || rule.dataType) }}</td>
                          <td v-if="showBookmarkAuditColumn" class="bookmark-audit-cell">
                            <div
                              class="bookmark-audit-summary"
                              :title="getBookmarkAuditComment(bookmark.bookmarkName)"
                            >
                              <span
                                class="audit-mini-badge"
                                :class="getBookmarkAuditInfo(bookmark.bookmarkName).riskLevel || 'low'"
                              >
                                {{ riskLabel(getBookmarkAuditInfo(bookmark.bookmarkName).riskLevel || 'low') }}
                              </span>
                              <span class="bookmark-audit-text">{{ getBookmarkAuditComment(bookmark.bookmarkName) }}</span>
                            </div>
                          </td>
                          <td class="bookmark-issue-cell" :title="getBookmarkIssueDetails(bookmark.bookmarkName)">
                            {{ getBookmarkIssueDetails(bookmark.bookmarkName) }}
                          </td>
                          <td class="bookmark-risk-cell">
                            <span
                              class="audit-mini-badge"
                              :class="getBookmarkIssueRiskLevel(bookmark.bookmarkName)"
                            >
                              {{ riskLabel(getBookmarkIssueRiskLevel(bookmark.bookmarkName)) }}
                            </span>
                          </td>
                          <td class="bookmark-reason-cell" :title="getBookmarkIssueReasons(bookmark.bookmarkName)">
                            {{ getBookmarkIssueReasons(bookmark.bookmarkName) }}
                          </td>
                          <td class="bookmark-suggestion-cell" :title="getBookmarkIssueSuggestions(bookmark.bookmarkName)">
                            {{ getBookmarkIssueSuggestions(bookmark.bookmarkName) }}
                          </td>
                        </tr>
                      </tbody>
                      </table>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
            <tr v-if="filteredRuleRows.length === 0">
              <td colspan="8" class="empty">{{ emptyTableMessage }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="filteredRuleRows.length > 0" class="pagination-bar">
        <div class="pagination-summary">
          共 {{ filteredRuleRows.length }} 项规则，第 {{ currentPage }} / {{ totalPages }} 页
        </div>
        <div class="pagination-actions">
          <select v-model.number="pageSize" class="filter-select page-size-select" @change="handlePageSizeChange">
            <option :value="10">10 条/页</option>
            <option :value="20">20 条/页</option>
            <option :value="50">50 条/页</option>
            <option :value="100">100 条/页</option>
          </select>
          <button type="button" class="btn btn-secondary" :disabled="currentPage <= 1" @click="changePage(currentPage - 1)">
            上一页
          </button>
          <button type="button" class="btn btn-secondary" :disabled="currentPage >= totalPages" @click="changePage(currentPage + 1)">
            下一页
          </button>
        </div>
      </div>

      <div v-if="result" class="result-section">
        <div class="result-card">
          <div class="result-title">审计摘要</div>
          <div class="result-conclusion">{{ result.summary.conclusion }}</div>
          <div class="result-meta">
            <span>问题数：{{ result.issues.length }}</span>
            <span>批注数：{{ result.commentStats?.successCount || 0 }}</span>
          </div>
        </div>

        <div v-if="result.bookmarkAudits?.length" class="panel">
          <div class="panel-title">书签审计意见</div>
          <div class="bookmark-audit-list">
            <div v-for="item in result.bookmarkAudits" :key="item.bookmarkName" class="bookmark-audit-item">
              <div class="issue-header">
                <span class="issue-name">{{ item.fieldName || formatBookmarkDisplayName(item.bookmarkName) }}</span>
                <span class="issue-badge" :class="item.riskLevel">{{ riskLabel(item.riskLevel) }}</span>
              </div>
              <div class="issue-row">书签：{{ formatBookmarkDisplayName(item.bookmarkName) }}</div>
              <div class="issue-row">审计意见：{{ item.comment || item.conclusion || '-' }}</div>
              <div class="issue-row">问题数：{{ item.issues?.length || 0 }}</div>
            </div>
          </div>
        </div>

        <div v-if="result.recommendations.length" class="panel">
          <div class="panel-title">改进建议</div>
          <ul class="recommend-list">
            <li v-for="(item, idx) in result.recommendations" :key="`rec-${idx}`">{{ item }}</li>
          </ul>
        </div>

        <div class="panel">
          <div class="panel-title">问题列表</div>
          <div v-if="result.issues.length === 0" class="empty-state">未发现明显问题</div>
          <div v-else class="issue-list">
            <div v-for="(issue, idx) in result.issues" :key="`issue-${idx}`" class="issue-item">
              <div class="issue-header">
                <span class="issue-name">{{ issue.fieldName || '未命名字段' }}</span>
                <span class="issue-badge" :class="issue.riskLevel">{{ riskLabel(issue.riskLevel) }}</span>
              </div>
              <div class="issue-row">书签：{{ formatBookmarkDisplayName(issue.bookmarkName) }}</div>
              <div class="issue-row">字段值：{{ issue.instanceValue || '-' }}</div>
              <div class="issue-row">问题类型：{{ issue.issueType || '-' }}</div>
              <div class="issue-row">判断依据：{{ issue.reason || '-' }}</div>
              <div class="issue-row">改进建议：{{ issue.suggestion || '-' }}</div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-title-row">
            <div class="panel-title">报告预览</div>
            <button type="button" class="btn btn-secondary btn-compact" @click="copyReportMarkdown">复制报告</button>
          </div>
          <div class="report-preview">
            <template v-for="(block, idx) in reportPreviewBlocks" :key="`report-${idx}`">
              <h1 v-if="block.type === 'h1'" class="report-h1">{{ block.text }}</h1>
              <h2 v-else-if="block.type === 'h2'" class="report-h2">{{ block.text }}</h2>
              <h3 v-else-if="block.type === 'h3'" class="report-h3">{{ block.text }}</h3>
              <div v-else-if="block.type === 'list'" class="report-list-item">{{ block.text }}</div>
              <p v-else-if="block.type === 'p'" class="report-paragraph">{{ block.text }}</p>
              <div v-else class="report-spacer"></div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="popup-footer">
      <button type="button" class="btn btn-primary" :disabled="auditing || selectedRuleIds.length === 0" @click="startAudit">
        {{ auditing ? '审计中...' : '开始审计' }}
      </button>
      <button type="button" class="btn btn-secondary" @click="onClose">关闭</button>
    </div>
  </div>
</template>

<script>
import { loadRulesFromDoc, onRulesStorageSync, DATA_TYPES } from '../utils/templateRules.js'
import { startFormAuditTask } from '../utils/formAuditService.js'

function getApplication() {
  return window.Application || window.opener?.Application || window.parent?.Application || null
}

function getApplicationStatus() {
  return {
    window: window.Application ? 'ok' : 'none',
    opener: window.opener?.Application ? 'ok' : 'none',
    parent: window.parent?.Application ? 'ok' : 'none'
  }
}

function trimBookmarkText(value) {
  return String(value || '')
    .replace(/\r\n$/g, '')
    .replace(/\r$/g, '')
    .replace(/\n$/g, '')
    .replace(/\x07$/g, '')
    .trim()
}

function getRangePageNumber(range) {
  if (!range) return 0
  const pageConstants = [3, 7, 8, 1]
  try {
    let targetRange = range
    if (typeof range.Duplicate === 'function') {
      const duplicatedRange = range.Duplicate()
      if (duplicatedRange) {
        targetRange = duplicatedRange
        if (typeof duplicatedRange.Collapse === 'function') duplicatedRange.Collapse(1)
      }
    }
    if (!targetRange || typeof targetRange.Information !== 'function') return 0
    for (const pageConst of pageConstants) {
      try {
        const pageInfo = targetRange.Information(pageConst)
        const pageNumber = parseInt(pageInfo, 10)
        if (!Number.isNaN(pageNumber) && pageNumber > 0) return pageNumber
      } catch (_) {}
    }
  } catch (_) {}
  return 0
}

function parseBookmarkMeta(fullName) {
  const normalized = String(fullName || '').trim()
  if (!normalized) {
    return { bookmarkName: '', displayName: '', ruleId: '', seq: null }
  }
  const parts = normalized.split('_')
  if (parts.length >= 3 && /^\d+$/.test(parts[parts.length - 1])) {
    return {
      bookmarkName: normalized,
      displayName: parts.slice(0, -2).join('_') || normalized,
      ruleId: String(parts[parts.length - 2] || ''),
      seq: Number(parts[parts.length - 1])
    }
  }
  if (parts.length >= 2) {
    return {
      bookmarkName: normalized,
      displayName: parts.slice(0, -1).join('_') || normalized,
      ruleId: String(parts[parts.length - 1] || ''),
      seq: null
    }
  }
  return {
    bookmarkName: normalized,
    displayName: normalized,
    ruleId: '',
    seq: null
  }
}

function getDialogBaseUrl() {
  const app = getApplication()
  const base = app?.PluginStorage?.getItem('AddinBaseUrl')
  const path = (base || window.location.origin + window.location.pathname.replace(/\/?index\.html$/i, '')).replace(/#.*$/, '')
  const hash = window.location.protocol === 'file:' ? '' : '/#'
  return `${path}${hash}`
}

const FORM_AUDIT_RESULT_STORAGE_PREFIX = 'NdFormAuditLastResult'

function splitBookmarkNames(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function getCurrentDocumentStorageKey() {
  const doc = getApplication()?.ActiveDocument
  const fullName = String(doc?.FullName || '').trim()
  if (fullName) return `${FORM_AUDIT_RESULT_STORAGE_PREFIX}:${fullName}`
  const path = String(doc?.Path || '').trim()
  const name = String(doc?.Name || '').trim()
  const fallback = [path, name].filter(Boolean).join('/')
  return `${FORM_AUDIT_RESULT_STORAGE_PREFIX}:${fallback || 'active-document'}`
}

function normalizeStoredIssue(item) {
  return {
    fieldName: String(item?.fieldName || '').trim(),
    semanticKey: String(item?.semanticKey || '').trim(),
    instanceValue: String(item?.instanceValue || '').trim(),
    groupLabel: String(item?.groupLabel || '').trim(),
    issueType: String(item?.issueType || '').trim(),
    riskLevel: String(item?.riskLevel || 'low').trim() || 'low',
    reason: String(item?.reason || '').trim(),
    suggestion: String(item?.suggestion || '').trim(),
    bookmarkName: String(item?.bookmarkName || '').trim(),
    ruleId: String(item?.ruleId || '').trim()
  }
}

function normalizeStoredBookmarkAudit(item) {
  return {
    bookmarkName: String(item?.bookmarkName || '').trim(),
    fieldName: String(item?.fieldName || '').trim(),
    semanticKey: String(item?.semanticKey || '').trim(),
    instanceValue: String(item?.instanceValue || '').trim(),
    dataType: String(item?.dataType || '').trim(),
    reviewType: String(item?.reviewType || '').trim(),
    riskLevel: String(item?.riskLevel || 'low').trim() || 'low',
    passed: item?.passed === true,
    conclusion: String(item?.conclusion || '').trim(),
    comment: String(item?.comment || '').trim(),
    issues: Array.isArray(item?.issues) ? item.issues.map(normalizeStoredIssue) : [],
    position: Number(item?.position || 0)
  }
}

function normalizeAuditResult(result) {
  const source = result && typeof result === 'object' ? result : {}
  return {
    summary: {
      overallRisk: String(source?.summary?.overallRisk || 'low').trim() || 'low',
      conclusion: String(source?.summary?.conclusion || '未发现明显问题').trim() || '未发现明显问题'
    },
    issues: Array.isArray(source?.issues) ? source.issues.map(normalizeStoredIssue) : [],
    bookmarkAudits: Array.isArray(source?.bookmarkAudits) ? source.bookmarkAudits.map(normalizeStoredBookmarkAudit) : [],
    recommendations: Array.isArray(source?.recommendations)
      ? source.recommendations.map(item => String(item || '').trim()).filter(Boolean)
      : [],
    reportMarkdown: String(source?.reportMarkdown || '').trim(),
    commentStats: {
      successCount: Number(source?.commentStats?.successCount || 0),
      failedCount: Number(source?.commentStats?.failedCount || 0),
      failures: Array.isArray(source?.commentStats?.failures)
        ? source.commentStats.failures.map(item => String(item || '').trim()).filter(Boolean)
        : []
    },
    savedAt: Number(source?.savedAt || Date.now())
  }
}

export default {
  name: 'FormAuditDialog',
  data() {
    return {
      ruleRows: [],
      bookmarks: [],
      selectedRuleIds: [],
      expandedRuleIds: {},
      currentPage: 1,
      pageSize: 20,
      lastLoadRuleCount: 0,
      applicationStatus: getApplicationStatus(),
      searchText: '',
      riskFilter: 'all',
      dataTypeFilter: 'all',
      auditing: false,
      errorMsg: '',
      result: null,
      auditResultStorageKey: '',
      refreshRetryTimerIds: []
    }
  },
  mounted() {
    this.refreshAll()
    this.restorePersistedResult()
    this.scheduleRefreshRetries()
    window.addEventListener('focus', this.refreshAll)
    this._unsubStorage = onRulesStorageSync(this.refreshAll)
  },
  beforeUnmount() {
    window.removeEventListener('focus', this.refreshAll)
    if (this._unsubStorage) this._unsubStorage()
    this.refreshRetryTimerIds.forEach(id => window.clearTimeout(id))
  },
  watch: {
    riskFilter() {
      this.currentPage = 1
    },
    searchText() {
      this.currentPage = 1
    },
    dataTypeFilter() {
      this.currentPage = 1
    },
    filteredRuleRows() {
      this.clampCurrentPage()
    }
  },
  computed: {
    filteredRuleRows() {
      const keyword = String(this.searchText || '').trim().toLowerCase()
      return this.ruleRows.filter((rule) => {
        if (this.riskFilter !== 'all' && rule.riskLevel !== this.riskFilter) return false
        if (this.dataTypeFilter !== 'all' && rule.dataType !== this.dataTypeFilter) return false
        if (!keyword) return true
        const fields = [
          String(rule.name || '').toLowerCase(),
          String(rule.tag || '').toLowerCase(),
          String(rule.reviewRule || '').toLowerCase(),
          String(rule.reviewHint || '').toLowerCase(),
          String(rule.semanticKey || '').toLowerCase()
        ]
        return fields.some(item => item.includes(keyword))
      })
    },
    bookmarksByRuleId() {
      return this.bookmarks.reduce((map, bookmark) => {
        const key = String(bookmark.ruleId || '').trim()
        if (!key) return map
        if (!map[key]) map[key] = []
        map[key].push(bookmark)
        return map
      }, {})
    },
    bookmarkRuleIdMap() {
      return this.bookmarks.reduce((map, bookmark) => {
        const bookmarkName = String(bookmark.bookmarkName || '').trim()
        const ruleId = String(bookmark.ruleId || '').trim()
        if (bookmarkName && ruleId) map[bookmarkName] = ruleId
        return map
      }, {})
    },
    bookmarkAuditMap() {
      const list = Array.isArray(this.result?.bookmarkAudits) ? this.result.bookmarkAudits : []
      return list.reduce((map, item) => {
        const key = String(item?.bookmarkName || '').trim()
        if (key) map[key] = item
        return map
      }, {})
    },
    bookmarkMergedIssueMap() {
      const result = {}
      const directIssues = Array.isArray(this.result?.issues) ? this.result.issues : []
      this.bookmarks.forEach((bookmark) => {
        const bookmarkName = String(bookmark?.bookmarkName || '').trim()
        if (!bookmarkName) return
        const bookmarkAuditIssues = Array.isArray(this.bookmarkAuditMap[bookmarkName]?.issues)
          ? this.bookmarkAuditMap[bookmarkName].issues
          : []
        const bookmarkDirectIssues = directIssues.filter((issue) => splitBookmarkNames(issue?.bookmarkName).includes(bookmarkName))
        const seen = new Set()
        result[bookmarkName] = [...bookmarkDirectIssues, ...bookmarkAuditIssues].filter((item) => {
          const dedupeKey = [
            String(item?.issueType || '').trim(),
            String(item?.riskLevel || '').trim(),
            String(item?.reason || '').trim(),
            String(item?.suggestion || '').trim()
          ].join('||')
          if (!dedupeKey || seen.has(dedupeKey)) return false
          seen.add(dedupeKey)
          return true
        })
      })
      return result
    },
    ruleIssueCountMap() {
      const map = {}
      this.bookmarks.forEach((bookmark) => {
        const ruleId = String(bookmark?.ruleId || '').trim()
        const bookmarkName = String(bookmark?.bookmarkName || '').trim()
        if (!ruleId || !bookmarkName) return
        map[ruleId] = Number(map[ruleId] || 0) + (this.bookmarkMergedIssueMap[bookmarkName]?.length || 0)
      })
      return map
    },
    ruleIssueSummaryMap() {
      const map = {}
      this.bookmarks.forEach((bookmark) => {
        const ruleId = String(bookmark?.ruleId || '').trim()
        const bookmarkName = String(bookmark?.bookmarkName || '').trim()
        if (!ruleId || !bookmarkName) return
        const reasons = (this.bookmarkMergedIssueMap[bookmarkName] || [])
          .map(issue => String(issue?.reason || issue?.suggestion || issue?.issueType || '').trim())
          .filter(Boolean)
        if (!map[ruleId]) map[ruleId] = []
        reasons.forEach((reason) => {
          if (!map[ruleId].includes(reason)) map[ruleId].push(reason)
        })
      })
      return map
    },
    ruleAuditRiskLevelMap() {
      const result = {}
      const rank = { high: 3, medium: 2, low: 1 }
      const bookmarkAudits = Array.isArray(this.result?.bookmarkAudits) ? this.result.bookmarkAudits : []
      bookmarkAudits.forEach((item) => {
        const bookmarkName = String(item?.bookmarkName || '').trim()
        const ruleId = this.bookmarkRuleIdMap[bookmarkName] || ''
        const riskLevel = String(item?.riskLevel || '').trim()
        if (!ruleId || !riskLevel) return
        const current = result[ruleId]
        if (!current || (rank[riskLevel] || 0) > (rank[current] || 0)) {
          result[ruleId] = riskLevel
        }
      })
      const issues = Array.isArray(this.result?.issues) ? this.result.issues : []
      issues.forEach((item) => {
        const explicitRuleId = String(item?.ruleId || '').trim()
        const riskLevel = String(item?.riskLevel || '').trim()
        const ruleIds = explicitRuleId
          ? [explicitRuleId]
          : [...new Set(splitBookmarkNames(item?.bookmarkName).map(bookmarkName => this.bookmarkRuleIdMap[bookmarkName]).filter(Boolean))]
        ruleIds.forEach((ruleId) => {
          if (!ruleId || !riskLevel) return
          const current = result[ruleId]
          if (!current || (rank[riskLevel] || 0) > (rank[current] || 0)) {
            result[ruleId] = riskLevel
          }
        })
      })
      return result
    },
    showBookmarkAuditColumn() {
      return Object.keys(this.bookmarkAuditMap).length > 0
    },
    reportPreviewBlocks() {
      const markdown = String(this.result?.reportMarkdown || '')
      if (!markdown.trim()) return [{ type: 'p', text: '暂无报告内容。' }]
      return markdown.split(/\r?\n/).map((line) => {
        const text = String(line || '')
        if (!text.trim()) return { type: 'blank', text: '' }
        if (text.startsWith('### ')) return { type: 'h3', text: text.slice(4).trim() }
        if (text.startsWith('## ')) return { type: 'h2', text: text.slice(3).trim() }
        if (text.startsWith('# ')) return { type: 'h1', text: text.slice(2).trim() }
        if (text.startsWith('- ')) return { type: 'list', text }
        return { type: 'p', text }
      })
    },
    availableDataTypes() {
      return [...new Set(this.ruleRows.map(rule => rule.dataType).filter(Boolean))].sort()
    },
    emptyTableMessage() {
      if (this.ruleRows.length === 0) {
        return '当前未加载到规则库。'
      }
      if (this.filteredRuleRows.length === 0) {
        return '当前筛选条件下没有规则。'
      }
      return ''
    },
    totalPages() {
      return Math.max(1, Math.ceil(this.filteredRuleRows.length / this.pageSize))
    },
    pagedRuleRows() {
      const start = (this.currentPage - 1) * this.pageSize
      return this.filteredRuleRows.slice(start, start + this.pageSize)
    }
  },
  methods: {
    getDataTypeLabel(type) {
      return DATA_TYPES.find(item => item.value === type)?.label || type || '-'
    },
    inferRiskLevel(rule) {
      const semanticKey = String(rule?.semanticKey || '').trim()
      const name = String(rule?.name || '').trim()
      const reviewType = String(rule?.reviewType || 'none')
      const priority = Number(rule?.auditPriority) || 50
      const required = rule?.required === true

      const highSemanticKeys = new Set([
        'partyA',
        'partyB',
        'partyC',
        'contractAmount',
        'signDate',
        'startDate',
        'endDate',
        'contractNumber'
      ])
      const mediumSemanticKeys = new Set([
        'contractAddress',
        'contactPerson',
        'contactPhone',
        'contactEmail',
        'projectName',
        'website'
      ])
      const highNamePattern = /甲方|乙方|丙方|金额|价款|总价|合同价|合同编号|合同号|编号|签署日期|签订日期|签约日期|开始日期|起始日期|生效日期|结束日期|截止日期|终止日期|到期日期|主体|单位名称/
      const mediumNamePattern = /地址|住址|所在地|联系人|联系电话|电话|手机|邮箱|项目名称|项目|网址|网站|开户行|银行账号|税号|统一社会信用代码/

      let score = 0

      if (highSemanticKeys.has(semanticKey) || highNamePattern.test(name)) score += 3
      else if (mediumSemanticKeys.has(semanticKey) || mediumNamePattern.test(name)) score += 2
      else score += 1

      if (required) score += 1

      if (['llm', 'logic', 'crossref', 'consistency'].includes(reviewType)) score += 2
      else if (['range', 'regex', 'format', 'sensitive'].includes(reviewType)) score += 1

      if (priority <= 20) score += 2
      else if (priority <= 60) score += 1

      if (score >= 6) return 'high'
      if (score >= 4) return 'medium'
      return 'low'
    },
    riskLabel(level) {
      if (level === 'high') return '高'
      if (level === 'medium') return '中'
      return '低'
    },
    formatBookmarkDisplayName(bookmarkName) {
      const value = String(bookmarkName || '').trim()
      if (!value) return '-'
      const parts = value.split('_')
      if (parts.length >= 3 && /^\d+$/.test(parts[parts.length - 1])) {
        return parts.slice(0, -2).join('_') || value
      }
      if (parts.length >= 2) {
        return parts.slice(0, -1).join('_') || value
      }
      return value
    },
    loadBookmarks(rules) {
      const doc = getApplication()?.ActiveDocument
      const bookmarks = doc?.Bookmarks
      if (!bookmarks || bookmarks.Count === 0) {
        this.bookmarks = []
        return
      }
      const ruleMap = new Map(rules.map(rule => [String(rule.id), rule]))
      const list = []
      for (let i = 1; i <= bookmarks.Count; i += 1) {
        try {
          const bookmark = bookmarks.Item(i)
          if (!bookmark) continue
          const meta = parseBookmarkMeta(bookmark.Name)
          if (!meta.bookmarkName || !meta.ruleId) continue
          const linkedRule = ruleMap.get(meta.ruleId)
          if (!linkedRule) continue
          const range = bookmark.Range
          list.push({
            bookmarkName: meta.bookmarkName,
            displayName: meta.displayName || this.formatBookmarkDisplayName(meta.bookmarkName),
            ruleId: meta.ruleId,
            seq: meta.seq,
            bookmarkIndex: meta.seq,
            pageNumber: getRangePageNumber(range),
            position: Number(range?.Start || 0),
            end: Number(range?.End || 0),
            content: trimBookmarkText(range?.Text || ''),
            dataType: linkedRule.dataType || 'string'
          })
        } catch (_) {}
      }
      list.sort((a, b) => {
        const diff = a.position - b.position
        if (diff !== 0) return diff
        return a.bookmarkName.localeCompare(b.bookmarkName, 'zh-Hans-CN')
      })
      this.bookmarks = list
    },
    refreshAll() {
      const previousSelectedIds = new Set(this.selectedRuleIds)
      const nextStorageKey = getCurrentDocumentStorageKey()
      const storageKeyChanged = this.auditResultStorageKey !== nextStorageKey
      this.auditResultStorageKey = nextStorageKey
      this.applicationStatus = getApplicationStatus()
      const rawRules = loadRulesFromDoc()
      this.lastLoadRuleCount = Array.isArray(rawRules) ? rawRules.length : 0
      const rules = rawRules
        .map(rule => ({
          ...rule,
          reviewType: rule.reviewType || 'none',
          tag: rule.tag || '',
          auditPriority: Number(rule.auditPriority) || 50,
          riskLevel: this.inferRiskLevel(rule)
        }))
      rules.sort((a, b) => {
        const priorityDiff = a.auditPriority - b.auditPriority
        if (priorityDiff !== 0) return priorityDiff
        return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN')
      })
      this.ruleRows = rules
      this.loadBookmarks(rules)
      this.selectedRuleIds = rules
        .map(rule => rule.id)
        .filter(ruleId => previousSelectedIds.size === 0 || previousSelectedIds.has(ruleId))
      if (this.selectedRuleIds.length === 0 && rules.length > 0) {
        this.selectedRuleIds = rules.map(rule => rule.id)
      }
      Object.keys(this.expandedRuleIds).forEach((ruleId) => {
        if (!rules.find(rule => String(rule.id) === String(ruleId))) {
          delete this.expandedRuleIds[ruleId]
        }
      })
      this.expandedRuleIds = { ...this.expandedRuleIds }
      this.clampCurrentPage()
      if (storageKeyChanged) this.restorePersistedResult()
    },
    scheduleRefreshRetries() {
      ;[300, 1000, 2500].forEach((delay) => {
        const timerId = window.setTimeout(() => {
          if (this.ruleRows.length === 0) this.refreshAll()
        }, delay)
        this.refreshRetryTimerIds.push(timerId)
      })
    },
    toggleSelectAll(flag) {
      const filteredIds = this.filteredRuleRows.map(rule => rule.id)
      if (flag) {
        this.selectedRuleIds = [...new Set([...this.selectedRuleIds, ...filteredIds])]
        return
      }
      const filteredSet = new Set(filteredIds)
      this.selectedRuleIds = this.selectedRuleIds.filter(id => !filteredSet.has(id))
    },
    resetFilters() {
      this.riskFilter = 'all'
      this.dataTypeFilter = 'all'
      this.currentPage = 1
    },
    isRuleSelected(ruleId) {
      return this.selectedRuleIds.includes(ruleId)
    },
    isRuleExpanded(ruleId) {
      return this.expandedRuleIds[String(ruleId || '')] === true
    },
    getRuleBookmarks(ruleId) {
      return this.bookmarksByRuleId[String(ruleId || '')] || []
    },
    getBookmarkCount(ruleId) {
      return this.getRuleBookmarks(ruleId).length
    },
    getRuleIssueCount(ruleId) {
      return Number(this.ruleIssueCountMap[String(ruleId || '')] || 0)
    },
    getRuleIssueSummary(ruleId) {
      const items = this.ruleIssueSummaryMap[String(ruleId || '')] || []
      if (items.length === 0) return '暂无问题'
      const preview = items.slice(0, 2).join('；')
      return items.length > 2 ? `${preview} 等 ${items.length} 项问题` : preview
    },
    getRuleIssues(ruleId) {
      const key = String(ruleId || '')
      const issues = Array.isArray(this.result?.issues) ? this.result.issues : []
      return issues.filter((issue) => {
        const explicitRuleId = String(issue?.ruleId || '').trim()
        if (explicitRuleId) return explicitRuleId === key
        const ruleIds = splitBookmarkNames(issue?.bookmarkName)
          .map(bookmarkName => this.bookmarkRuleIdMap[bookmarkName])
          .filter(Boolean)
        return ruleIds.includes(key)
      })
    },
    getRuleIssueDetailTitle(ruleId) {
      const count = this.getRuleIssueCount(ruleId)
      return count > 0 ? '点击展开查看完整问题详情' : '当前无异常问题'
    },
    getRuleAuditRiskLevel(ruleId) {
      return this.ruleAuditRiskLevelMap[String(ruleId || '')] || ''
    },
    handleIssueCountClick(ruleId) {
      if (this.getRuleIssueCount(ruleId) <= 0) return
      if (!this.isRuleExpanded(ruleId)) this.toggleRuleExpand(ruleId)
    },
    handleIssueSummaryClick(ruleId) {
      if (this.getRuleIssueCount(ruleId) <= 0) return
      if (!this.isRuleExpanded(ruleId)) this.toggleRuleExpand(ruleId)
    },
    buildBookmarkLabel(bookmark) {
      const name = bookmark?.displayName || bookmark?.bookmarkName || '未命名书签'
      const indexText = bookmark?.bookmarkIndex ? `#${bookmark.bookmarkIndex}` : ''
      const pageText = bookmark?.pageNumber ? `第${bookmark.pageNumber}页` : '页码未知'
      return [name, indexText, pageText].filter(Boolean).join(' ')
    },
    getBookmarkAuditComment(bookmarkName) {
      const item = this.bookmarkAuditMap[String(bookmarkName || '').trim()]
      return item?.comment || item?.conclusion || '-'
    },
    getBookmarkAuditInfo(bookmarkName) {
      return this.bookmarkAuditMap[String(bookmarkName || '').trim()] || {}
    },
    getBookmarkPreviewText(value) {
      const text = String(value || '').trim()
      if (!text) return '（空）'
      return text.length > 20 ? `${text.slice(0, 20)}...` : text
    },
    getBookmarkMergedIssues(bookmarkName) {
      const key = String(bookmarkName || '').trim()
      return key ? (this.bookmarkMergedIssueMap[key] || []) : []
    },
    getBookmarkIssueDetails(bookmarkName) {
      const details = this.getBookmarkMergedIssues(bookmarkName)
        .map(item => String(item?.issueType || item?.reason || item?.suggestion || '').trim())
        .filter(Boolean)
        .filter((item, index, list) => list.indexOf(item) === index)
      return details.length > 0 ? details.join('；') : '未发现问题'
    },
    getBookmarkIssueRiskLevel(bookmarkName) {
      const levels = this.getBookmarkMergedIssues(bookmarkName)
        .map(item => String(item?.riskLevel || '').trim())
        .filter(Boolean)
      if (levels.includes('high')) return 'high'
      if (levels.includes('medium')) return 'medium'
      const auditRiskLevel = String(this.getBookmarkAuditInfo(bookmarkName)?.riskLevel || '').trim()
      if (auditRiskLevel === 'high' || auditRiskLevel === 'medium') return auditRiskLevel
      return 'low'
    },
    getBookmarkIssueReasons(bookmarkName) {
      const details = this.getBookmarkMergedIssues(bookmarkName)
        .map(item => String(item?.reason || '').trim())
        .filter(Boolean)
        .filter((item, index, list) => list.indexOf(item) === index)
      return details.length > 0 ? details.join('；') : '未发现明显问题'
    },
    getBookmarkIssueSuggestions(bookmarkName) {
      const details = this.getBookmarkMergedIssues(bookmarkName)
        .map(item => String(item?.suggestion || '').trim())
        .filter(Boolean)
        .filter((item, index, list) => list.indexOf(item) === index)
      return details.length > 0 ? details.join('；') : '建议人工复核'
    },
    toggleRuleExpand(ruleId) {
      const key = String(ruleId || '')
      if (!key) return
      this.expandedRuleIds = {
        ...this.expandedRuleIds,
        [key]: !this.isRuleExpanded(key)
      }
    },
    changePage(page) {
      const nextPage = Math.min(this.totalPages, Math.max(1, Number(page) || 1))
      this.currentPage = nextPage
    },
    handlePageSizeChange() {
      this.currentPage = 1
      this.clampCurrentPage()
    },
    clampCurrentPage() {
      if (this.currentPage > this.totalPages) this.currentPage = this.totalPages
      if (this.currentPage < 1) this.currentPage = 1
    },
    goToBookmark(bookmark) {
      try {
        const doc = getApplication()?.ActiveDocument
        if (!doc) return
        const target = doc.Bookmarks.Item(bookmark.bookmarkName)
        if (typeof target?.Select === 'function') target.Select()
        else target?.Range?.Select?.()
      } catch (error) {
        this.errorMsg = '定位书签失败：' + (error?.message || error)
      }
    },
    openRuleDetail(rule) {
      try {
        const url = `${getDialogBaseUrl()}/template-form-dialog?mode=detail&id=${encodeURIComponent(rule.id)}&_ts=${Date.now()}`
        getApplication()?.ShowDialog(
          url,
          '规则详情',
          520 * (window.devicePixelRatio || 1),
          800 * (window.devicePixelRatio || 1),
          false
        )
      } catch (error) {
        this.errorMsg = '打开规则详情失败：' + (error?.message || error)
      }
    },
    async copyReportMarkdown() {
      const text = String(this.result?.reportMarkdown || '').trim()
      if (!text) {
        this.errorMsg = '当前没有可复制的报告内容'
        return
      }
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
        } else {
          const textarea = document.createElement('textarea')
          textarea.value = text
          textarea.setAttribute('readonly', 'readonly')
          textarea.style.position = 'fixed'
          textarea.style.left = '-9999px'
          document.body.appendChild(textarea)
          textarea.select()
          document.execCommand('copy')
          document.body.removeChild(textarea)
        }
      } catch (error) {
        this.errorMsg = '复制报告失败：' + (error?.message || error)
      }
    },
    restorePersistedResult() {
      try {
        const app = getApplication()
        const key = this.auditResultStorageKey || getCurrentDocumentStorageKey()
        this.auditResultStorageKey = key
        const raw = app?.PluginStorage?.getItem(key)
        if (!raw) return
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        const payload = parsed?.result && typeof parsed.result === 'object' ? parsed.result : parsed
        this.result = normalizeAuditResult(payload)
      } catch (error) {
        console.warn('restorePersistedResult failed:', error)
      }
    },
    persistAuditResult(result) {
      try {
        const app = getApplication()
        const key = this.auditResultStorageKey || getCurrentDocumentStorageKey()
        this.auditResultStorageKey = key
        const normalizedResult = normalizeAuditResult(result)
        normalizedResult.savedAt = Date.now()
        app?.PluginStorage?.setItem(key, JSON.stringify({
          savedAt: normalizedResult.savedAt,
          result: normalizedResult
        }))
        this.result = normalizedResult
      } catch (error) {
        console.warn('persistAuditResult failed:', error)
        this.result = normalizeAuditResult(result)
      }
    },
    openTaskProgress(taskId) {
      try {
        const base = window.location.href.split('#')[0] || window.location.href
        const url = `${base}#/task-progress-dialog?taskId=${encodeURIComponent(taskId)}`
        window.Application.ShowDialog(
          url,
          '任务进度',
          520 * (window.devicePixelRatio || 1),
          260 * (window.devicePixelRatio || 1),
          false
        )
      } catch (_) {}
    },
    async startAudit() {
      this.errorMsg = ''
      if (this.selectedRuleIds.length === 0) {
        this.errorMsg = '请至少选择一项规则'
        return
      }
      this.auditing = true
      try {
        const { taskId, promise } = startFormAuditTask({
          ruleIds: this.selectedRuleIds,
          title: '文档审计'
        })
        this.openTaskProgress(taskId)
        const auditResult = await promise
        this.persistAuditResult(auditResult)
      } catch (error) {
        this.errorMsg = error?.message || '文档审计失败'
      } finally {
        this.auditing = false
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
.form-audit-dialog{display:flex;flex-direction:column;height:100vh;overflow:hidden;background:#f8fafc;color:#1f2937;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif}
.popup-body{flex:1;min-height:0;padding:8px 10px 10px;overflow:auto}
.popup-footer{position:sticky;bottom:0;display:flex;justify-content:flex-end;gap:6px;padding:8px 10px;background:#fff;border-top:1px solid #e5e7eb;box-shadow:0 -4px 12px rgba(15,23,42,.06);z-index:2}
.filter-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px;padding:8px;background:#fff;border:1px solid #e5e7eb;border-radius:8px}
.search-input{flex:1;min-width:180px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;background:#fff}
.filter-item{display:flex;align-items:center;gap:6px;color:#475569}
.filter-select{padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;background:#fff}
.compact-select{min-width:92px}
.table-wrap{overflow-x:auto;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;background:#fff}
.rules-table{width:100%;min-width:1220px;border-collapse:collapse;table-layout:fixed;font-size:12px}
.rules-table th,.rules-table td{padding:6px 8px;text-align:left;border-bottom:1px solid #f0f0f0;vertical-align:top}
.rules-table th{position:sticky;top:0;background:#fafafa;font-weight:600;color:#334155;z-index:1}
.rules-table tbody tr:last-child td{border-bottom:none}
.rule-row{background:#fff}
.rules-table tbody tr.selected{background:#eff6ff}
.col-check{width:56px;text-align:center}
.col-name{width:220px}
.col-required{width:68px}
.col-review{width:300px;color:#475569}
.col-type{width:96px}
.col-issue-count{width:104px;text-align:center}
.col-issue-text{width:260px}
.col-action{width:72px;text-align:center}
.name-cell{display:flex;align-items:center;gap:6px;min-width:0}
.tree-toggle{width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;border:none;background:transparent;color:#8c8c8c;cursor:pointer;flex-shrink:0}
.tree-toggle svg{transition:transform .2s ease}
.tree-toggle.expanded svg{transform:rotate(90deg)}
.name-link{padding:0;border:none;background:transparent;color:#2563eb;text-decoration:underline;cursor:pointer;min-width:0;max-width:100%;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.name-link:hover,.bookmark-link:hover{color:#1d4ed8}
.count-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#2563eb;color:#fff;font-size:11px;flex-shrink:0}
.rule-issue-summary{display:flex;align-items:center;justify-content:center;gap:4px;flex-wrap:wrap}
.issue-count-badge{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:20px;padding:0 8px;border:none;border-radius:999px;background:#f3f4f6;color:#6b7280;font-size:11px;font-weight:600;cursor:pointer}
.issue-count-badge.active{background:#fef2f2;color:#b91c1c}
.issue-summary-cell{color:#475569;line-height:1.5;word-break:break-word}
.issue-summary-btn{display:block;width:100%;padding:0;border:none;background:transparent;text-align:left;cursor:pointer}
.issue-summary-btn.active{color:#1f2937}
.issue-summary-btn:hover{color:#1d4ed8}
.col-review,.col-type,.col-issue-text{word-break:break-word}
.bookmark-tree-row{background:#fcfcfc}
.bookmark-tree-row:hover{background:#fcfcfc !important}
.bookmark-tree-cell{padding:0 !important}
.bookmark-tree-panel{margin:0 0 0 12px;padding:8px 10px 10px;border-left:2px solid #dbeafe}
.bookmark-tree-header{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.bookmark-tree-title{font-weight:600;color:#334155}
.bookmark-tree-count,.bookmark-empty{color:#64748b}
.bookmark-table-wrap{overflow-x:auto;overflow-y:hidden;padding-bottom:2px}
.bookmark-table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb}
.bookmark-table{min-width:1500px}
.bookmark-table th,.bookmark-table td{padding:6px 8px;border-bottom:1px solid #eef2f7;text-align:left;vertical-align:top}
.bookmark-table th{background:#f8fafc;color:#475569;font-weight:600}
.bookmark-table tr:last-child td{border-bottom:none}
.bookmark-col-name{width:180px}
.bookmark-col-value{width:160px}
.bookmark-col-type{width:96px}
.bookmark-col-audit{width:220px}
.bookmark-col-issue{width:150px}
.bookmark-col-risk{width:88px}
.bookmark-col-reason{width:320px}
.bookmark-col-suggestion{width:286px}
.bookmark-link{padding:0;border:none;background:transparent;color:#2563eb;text-decoration:underline;cursor:pointer;text-align:left}
.bookmark-value-cell{max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#475569}
.bookmark-type-cell{white-space:nowrap;color:#64748b}
.bookmark-audit-cell{word-break:break-word;color:#334155}
.bookmark-audit-summary{display:flex;align-items:flex-start;gap:6px}
.bookmark-audit-text{line-height:1.5;word-break:break-word}
.bookmark-issue-cell{min-width:150px;line-height:1.5;word-break:break-word;color:#7c2d12}
.bookmark-risk-cell{min-width:88px;text-align:center}
.bookmark-reason-cell{min-width:320px;line-height:1.5;word-break:break-word;color:#7c2d12}
.bookmark-suggestion-cell{min-width:286px;line-height:1.5;word-break:break-word;color:#7c2d12}
.audit-mini-badge{display:inline-flex;align-items:center;justify-content:center;min-width:24px;padding:1px 6px;border-radius:999px;font-size:11px;font-weight:600;flex-shrink:0}
.audit-mini-badge.high{background:#fef2f2;color:#b91c1c}
.audit-mini-badge.medium{background:#fffbeb;color:#92400e}
.audit-mini-badge.low{background:#eff6ff;color:#1d4ed8}
.empty{text-align:center;color:#6b7280}
.pagination-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;padding:8px;background:#fff;border:1px solid #e5e7eb;border-radius:8px}
.pagination-summary{color:#475569}
.pagination-actions{display:flex;align-items:center;gap:6px}
.page-size-select{min-width:96px}
.risk-badge{display:inline-flex;align-items:center;justify-content:center;min-width:28px;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600}
.risk-badge.high{background:#fef2f2;color:#b91c1c}
.risk-badge.medium{background:#fffbeb;color:#92400e}
.risk-badge.low{background:#eff6ff;color:#1d4ed8}
.issue-list,.bookmark-audit-list{display:flex;flex-direction:column;gap:10px}
.bookmark-audit-item,.issue-item,.result-card,.panel{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px}
.result-section{margin-top:16px;display:flex;flex-direction:column;gap:12px}
.result-title,.panel-title{font-size:13px;font-weight:600;margin-bottom:8px}
.panel-title-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.result-conclusion{line-height:1.6}
.result-meta{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;color:#6b7280}
.issue-header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px}
.issue-name{font-weight:600}
.issue-row{line-height:1.7;word-break:break-word}
.issue-badge{padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600}
.issue-badge.high{background:#fef2f2;color:#b91c1c}
.issue-badge.medium{background:#fffbeb;color:#92400e}
.issue-badge.low{background:#eff6ff;color:#1d4ed8}
.recommend-list{margin:0;padding-left:18px}
.report-preview{background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:12px}
.report-h1,.report-h2,.report-h3{margin:0 0 8px;color:#111827}
.report-h1{font-size:16px}
.report-h2{font-size:14px;margin-top:10px}
.report-h3{font-size:13px;margin-top:8px}
.report-paragraph,.report-list-item{margin:0 0 6px;line-height:1.7;color:#374151;word-break:break-word}
.report-list-item{padding-left:2px}
.report-spacer{height:6px}
.empty-state{color:#6b7280}
.error{margin:0 0 8px;padding:8px 10px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#b91c1c}
.btn{padding:6px 10px;border-radius:6px;border:1px solid transparent;cursor:pointer;font-size:12px;line-height:1.2}
.btn-compact{padding:5px 8px}
.btn:disabled{opacity:.6;cursor:not-allowed}
.btn-primary{background:#2563eb;color:#fff}
.btn-secondary{background:#fff;border-color:#d1d5db;color:#374151}
</style>
