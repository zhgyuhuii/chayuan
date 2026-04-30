<template>
  <div class="task-progress-dialog">
    <div class="header">
      <div class="header-main">
        <div class="title-row">
          <h2>{{ task?.title || '任务进度' }}</h2>
          <span class="status-badge" :class="status">{{ statusBadgeText }}</span>
        </div>
        <p class="header-subtitle">{{ headerSubtitle }}</p>
      </div>
      <div class="header-actions">
        <button
          v-if="taskId"
          type="button"
          class="icon-btn"
          :title="showDetails ? '收起处理详情' : '查看处理详情'"
          :aria-label="showDetails ? '收起处理详情' : '查看处理详情'"
          @click="toggleDetails"
        >
          <svg v-if="!showDetails" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 5c5.5 0 9.5 4.5 10.5 6c-1 1.5-5 6-10.5 6S2.5 12.5 1.5 11C2.5 9.5 6.5 5 12 5m0 2C8.73 7 5.94 9.38 4.13 11C5.94 12.62 8.73 15 12 15s6.06-2.38 7.87-4C18.06 9.38 15.27 7 12 7m0 1.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 0 1 0-5"/></svg>
          <svg v-else viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M19 13H5v-2h14z"/></svg>
        </button>
        <button
          v-if="canApplyPlan"
          type="button"
          class="icon-btn success"
          title="确认写回"
          aria-label="确认写回"
          @click="applyTaskPlan"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M9.55 18L3.85 12.3l1.4-1.4l4.3 4.3l9.2-9.2l1.4 1.4z"/></svg>
        </button>
        <button
          v-if="canUndo"
          type="button"
          class="icon-btn"
          title="撤销本次改动"
          aria-label="撤销本次改动"
          @click="undoTask"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12.5 8A6.5 6.5 0 0 1 19 14.5A6.5 6.5 0 0 1 8.27 19.46l1.5-1.5A4.5 4.5 0 1 0 12.5 10H7.83l2.08 2.09L8.5 13.5L4 9l4.5-4.5l1.41 1.41L7.83 8z"/></svg>
        </button>
        <button
          v-if="canStop"
          type="button"
          class="icon-btn danger"
          title="停止处理"
          aria-label="停止处理"
          @click="stopTask"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M6 6h12v12H6z"/></svg>
        </button>
        <button type="button" class="icon-btn subtle" title="关闭窗口" aria-label="关闭窗口" @click="closeWindow">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M18.3 5.71L12 12l6.3 6.29l-1.41 1.42L10.59 13.4L4.29 19.71L2.88 18.3L9.17 12L2.88 5.71L4.29 4.29l6.3 6.3l6.29-6.3z"/></svg>
        </button>
      </div>
    </div>
    <div class="body">
      <div class="progress-meta">
        <div class="progress-text" :class="{ error: status === 'error' }">{{ statusText }}</div>
        <div v-if="task" class="progress-percent">{{ progressPercent }}%</div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <div v-if="launchGuardNotice" class="preview-card guard-notice-card">
        <div class="preview-label">写回保护提示</div>
        <div class="preview-content details-content">
          <div class="detail-item">{{ launchGuardNotice }}</div>
        </div>
      </div>
      <div
        v-if="pendingRevisionModePrompt"
        class="preview-card revision-mode-card"
        @mouseenter="pauseRevisionModePrompt"
        @mouseleave="resumeRevisionModePrompt"
        @focusin="pauseRevisionModePrompt('focus')"
        @focusout="handleRevisionModePromptFocusOut"
      >
        <div class="preview-label">写回前确认</div>
        <div class="preview-content details-content">
          <div class="detail-item">{{ pendingRevisionModePrompt.summaryText }}</div>
          <div class="detail-item">{{ pendingRevisionModePrompt.confirmPrompt }}</div>
        </div>
        <div class="revision-mode-countdown">
          <div class="revision-mode-countdown-text">{{ revisionModePromptCountdownText }}</div>
          <div class="revision-mode-countdown-track">
            <div class="revision-mode-countdown-fill" :style="revisionModePromptProgressStyle"></div>
          </div>
        </div>
        <div class="revision-mode-actions">
          <button
            type="button"
            class="icon-text-btn success"
            :disabled="pendingRevisionModePrompt.status === 'applying'"
            @click="confirmRevisionModePrompt"
          >
            {{ pendingRevisionModePrompt.status === 'applying' ? '处理中...' : '开启修订并继续' }}
          </button>
          <button
            type="button"
            class="icon-text-btn"
            :disabled="pendingRevisionModePrompt.status === 'applying'"
            @click="continueRevisionModePrompt"
          >
            直接继续
          </button>
        </div>
        <div v-if="pendingRevisionModePrompt.statusMessage" class="detail-item revision-mode-status">
          {{ pendingRevisionModePrompt.statusMessage }}
        </div>
      </div>
      <div v-if="resultSummaryLines.length" class="preview-card">
        <div class="preview-label">结果汇总</div>
        <div class="preview-content details-content">
          <div v-for="line in resultSummaryLines" :key="line" class="detail-item">{{ line }}</div>
        </div>
      </div>
      <div v-if="generatedArtifacts.length" class="preview-card">
        <div class="preview-label">生成附件</div>
        <div class="preview-content details-content">
          <div v-for="artifact in generatedArtifacts" :key="`${artifact.name}-${artifact.path}`" class="detail-item">
            {{ artifact.name || artifact.path || '未命名附件' }}<span v-if="artifact.path"> · {{ artifact.path }}</span>
          </div>
        </div>
      </div>
      <div v-if="writeTargetPreviewLines.length" class="preview-card">
        <div class="preview-label">定位结果</div>
        <div class="preview-content details-content">
          <div v-for="line in writeTargetPreviewLines" :key="line" class="detail-item">{{ line }}</div>
        </div>
      </div>
      <div v-if="requestPreview" class="preview-card">
        <div class="preview-label">批注要求</div>
        <div class="preview-content">{{ requestPreview }}</div>
      </div>
      <div v-if="previewText" class="preview-card">
        <div class="preview-label">{{ previewLabel }}</div>
        <div class="preview-content">{{ previewText }}</div>
      </div>
      <div v-if="showDetails && hasDetails" class="preview-card details-card">
        <div class="preview-label">处理详情</div>
        <div class="preview-content details-content">
          <div v-for="(detail, index) in detailItems" :key="`${index}-${detail}`" class="detail-item">{{ detail }}</div>
        </div>
      </div>
      <div v-if="showDetails && finalResultText" class="preview-card details-card">
        <div class="preview-label">最终结果</div>
        <div class="preview-content details-content final-result-content">{{ finalResultText }}</div>
      </div>
      <div v-if="shouldShowBottomResult" class="preview-card details-card">
        <div class="preview-label">结果展示</div>
        <div class="preview-content details-content final-result-content">{{ bottomResultText }}</div>
      </div>
      <div v-if="task?.data?.applyResult?.message" class="result-note">
        文档动作：{{ task.data.applyResult.message }}
      </div>
      <div class="task-footer">
        <div class="task-footer-main">
          <p class="task-list-hint">可在「任务清单」中查看详细结果与完整输出。</p>
          <div class="task-footer-actions">
            <button v-if="taskId" type="button" class="detail-link-btn" @click="openTaskDetail">查看任务详情</button>
          </div>
          <div v-if="taskTimeLines.length" class="task-time-list">
            <div v-for="line in taskTimeLines" :key="line">{{ line }}</div>
          </div>
        </div>
        <span v-if="showAutoCloseHint" class="auto-close-hint">{{ autoCloseSecondsLeft }} 秒后自动关闭窗口</span>
      </div>
    </div>
  </div>
</template>

<script>
import { initSync, subscribe, getTaskById, syncTasksFromStorage, updateTask } from '../utils/taskListStore.js'
import { stopSpellCheckTask } from '../utils/spellCheckService.js'
import { applyAssistantTaskPlan, stopAssistantTask } from '../utils/assistantTaskRunner.js'
import { stopAssistantPromptRecommendationTask } from '../utils/assistantPromptRecommendationService.js'
import { stopFormAuditTask } from '../utils/formAuditService.js'
import { stopDocumentCommentTask, undoDocumentCommentTask } from '../utils/documentCommentService.js'
import { stopWpsCapabilityTask } from '../utils/wpsCapabilityExecutor.js'
import { stopMultimodalTask } from '../utils/multimodalTaskRunner.js'
import { getSpellCheckTaskBridge } from '../utils/spellCheckTaskBridge.js'
import { DEFAULT_TASK_LIST_WINDOW_HEIGHT, DEFAULT_TASK_LIST_WINDOW_WIDTH, focusExistingTaskListWindow } from '../utils/taskListWindowManager.js'
import { createTaskProgressWindowSession } from '../utils/taskProgressWindowManager.js'

function getActiveDocumentForRevisionMode() {
  return window.Application?.ActiveDocument ||
    window.opener?.Application?.ActiveDocument ||
    window.parent?.Application?.ActiveDocument ||
    null
}

function isDocumentTrackRevisionsEnabledForDialog() {
  const doc = getActiveDocumentForRevisionMode()
  try {
    return doc?.TrackRevisions === true
  } catch (_) {
    return false
  }
}

function enableDocumentTrackRevisionsForDialog() {
  const doc = getActiveDocumentForRevisionMode()
  if (!doc) {
    return { ok: false, message: '当前没有打开文档，无法开启修订模式。' }
  }
  try {
    doc.TrackRevisions = true
  } catch (error) {
    return { ok: false, message: error?.message || '开启修订模式失败' }
  }
  try {
    if (typeof doc.ShowRevisions !== 'undefined') {
      doc.ShowRevisions = true
    }
  } catch (_) {}
  const enabled = isDocumentTrackRevisionsEnabledForDialog()
  return {
    ok: enabled,
    message: enabled
      ? '已开启文档修订模式。'
      : '未能确认修订模式是否已开启，将按当前文档状态继续处理。'
  }
}

export default {
  name: 'TaskProgressDialog',
  data() {
    return {
      currentTaskId: '',
      task: null,
      unsub: null,
      errorMsg: '',
      showDetails: false,
      windowSession: null,
      pollTimer: null,
      autoCloseTimer: null,
      autoCloseSecondsLeft: 0,
      pendingRevisionModePrompt: null,
      revisionModePromptTimer: null,
      revisionModePromptInterval: null
    }
  },
  computed: {
    taskId() {
      return this.currentTaskId || String(this.$route?.query?.taskId || '')
    },
    spellCheckMode() {
      return this.$route?.query?.mode === 'selection' ? 'selection' : 'all'
    },
    shouldAutoStartSpellCheck() {
      return !String(this.$route?.query?.taskId || '') && this.$route?.path === '/spell-check-dialog'
    },
    progressPercent() {
      if (!this.task) return 0
      return Number(this.task.progress || 0)
    },
    status() {
      if (!this.task) return this.errorMsg ? 'error' : 'loading'
      if (this.task.status === 'completed') return 'done'
      if (this.task.status === 'failed') return 'error'
      if (this.task.status === 'abnormal') return 'abnormal'
      if (this.task.status === 'cancelled') return 'cancelled'
      return this.task.status === 'running' ? 'running' : 'loading'
    },
    statusText() {
      if (this.errorMsg) return this.errorMsg
      if (!this.task) return '正在加载任务...'
      const stage = String(this.task.data?.progressStage || '')
      if (this.status === 'running') {
        if (this.task.type === 'spell-check') {
          const current = Number(this.task.current || 0)
          const total = Number(this.task.total || 0)
          if (stage === 'preparing') return '正在准备拼写检查任务...'
          return total > 0 ? `正在检查：第 ${current} / ${total} 段` : '正在初始化拼写检查...'
        }
        if (this.task.type === 'assistant-prompt-recommendation') {
          if (stage === 'calling_model') return '正在调用模型生成推荐设置...'
          if (stage === 'parsing_result') return '正在解析推荐结果...'
          if (stage === 'applying_result') return '正在回填推荐设置...'
          return '正在智能生成提示词与助手设置...'
        }
        if (this.task.type === 'form-audit') {
          if (stage === 'collecting') return '正在收集规则和书签实例...'
          if (stage === 'local_validating') return '正在执行本地规则校验...'
          if (stage === 'calling_model') return '正在执行 AI 审计...'
          return '文档审计执行中...'
        }
        if (this.task.type === 'document-comment') {
          const current = Number(this.task.current || 0)
          const total = Number(this.task.total || 0)
          return total > 0 ? `正在批注：第 ${current} / ${total} 段` : '正在执行智能批注...'
        }
        if (this.task.type === 'wps-capability') {
          const current = Number(this.task.current || 0)
          const total = Number(this.task.total || 0)
          return total > 0 ? `正在执行：第 ${current} / ${total} 步` : '正在执行 WPS 操作...'
        }
        if (stage === 'calling_model') return '正在调用模型...'
        if (stage === 'applying_result') return '正在写回文档...'
        return '任务正在执行中...'
      }
      if (this.status === 'done') {
        if (this.task.type === 'spell-check') {
          return `已完成，共添加 ${Number(this.task.data?.commentCount || 0)} 处批注`
        }
        if (this.task.type === 'form-audit') {
          return this.task.data?.applyResult?.message || '文档审计已完成'
        }
        if (this.task.type === 'document-comment') {
          return this.task.data?.applyResult?.message || `已完成，共添加 ${Number(this.task.data?.commentCount || 0)} 处批注`
        }
        if (this.task.type === 'wps-capability') {
          return this.task.data?.applyResult?.message || 'WPS 操作已完成'
        }
        return this.task.data?.applyResult?.message || '任务已完成'
      }
      if (this.status === 'cancelled') return this.task.error || '任务已停止'
      if (this.status === 'abnormal') return this.task.error || '任务异常结束'
      if (this.status === 'error') return this.task.error || '任务执行失败'
      return '正在准备任务...'
    },
    previewText() {
      if (!this.task) return ''
      if (this.task.type === 'spell-check') {
        return String(this.task.data?.currentChunk || '').trim()
      }
      if (this.task.type === 'document-comment' && this.status !== 'done') {
        return String(this.task.data?.currentChunk || this.task.data?.inputPreview || '').trim()
      }
      if (this.status === 'done') {
        return String(this.task.data?.outputPreview || this.task.data?.fullOutput || '').trim()
      }
      return String(this.task.data?.inputPreview || '').trim()
    },
    previewLabel() {
      if (this.task?.type === 'spell-check') return '当前检查内容'
      if (this.task?.type === 'document-comment') {
        if (this.status === 'done') return '结果预览'
        return this.task?.data?.currentChunk ? '当前批注内容' : '当前任务内容'
      }
      if (this.task?.type === 'wps-capability') {
        return this.status === 'done' ? '执行结果' : '操作参数'
      }
      if (this.task?.type === 'form-audit') return this.status === 'done' ? '报告摘要' : '审计范围'
      return this.status === 'done' ? '结果预览' : '任务内容'
    },
    orchestrationSummary() {
      if (!this.task?.data) return ''
      const entryMap = {
        dialog: '会话入口',
        'ribbon-direct': '顶部菜单',
        'wps-capability': 'WPS 原生能力'
      }
      const intentMap = {
        chat: '普通对话',
        'document-operation': '文档处理',
        'assistant-task': '助手任务',
        'wps-capability': 'WPS 能力',
        'generated-output': '生成输出'
      }
      const executionMap = {
        'direct-chat': '直接对话',
        'runner-task': '助手执行',
        'wps-task': 'WPS 执行',
        'generated-file-task': '生成文件'
      }
      const parts = [
        entryMap[String(this.task.data.entry || '')] || '',
        intentMap[String(this.task.data.primaryIntent || '')] || '',
        executionMap[String(this.task.data.executionMode || '')] || ''
      ].filter(Boolean)
      return parts.join(' / ')
    },
    requestPreview() {
      if (!this.task) return ''
      const inputPreview = String(this.task.data?.inputPreview || '').trim()
      if (!inputPreview) return ''
      if (this.previewText && inputPreview === this.previewText) return ''
      return inputPreview
    },
    launchGuardNotice() {
      if (!this.task?.data) return ''
      const reason = String(this.task.data.launchGuardReason || '').trim()
      if (!reason) return ''
      const action = String(this.task.data?.applyResult?.action || this.task.data?.documentAction || '').trim()
      if (action !== 'none') return ''
      return `${reason}。为避免写回失败或宿主异常，本次已自动切换为“仅生成结果，不写回文档”。`
    },
    detailItems() {
      const details = Array.isArray(this.task?.data?.progressEvents) ? this.task.data.progressEvents.filter(Boolean) : []
      const plan = this.task?.data?.executionPlan
      if (String(this.task?.data?.assistantVersion || '').trim()) {
        details.push(`助手版本：${String(this.task.data.assistantVersion).trim()}`)
      }
      if (Number.isFinite(Number(this.task?.data?.benchmarkScore))) {
        details.push(`评估得分：${Number(this.task.data.benchmarkScore)}`)
      }
      if (String(this.task?.data?.evaluation?.summary || '').trim()) {
        details.push(`评测结论：${String(this.task.data.evaluation.summary).trim()}`)
      }
      if (plan?.summary?.batchCount > 0) {
        details.push(`结构化批次：${Number(plan.summary.batchCount || 0)} 批`)
      }
      if (plan?.summary?.operationCount > 0) {
        details.push(`结构化操作：${Number(plan.summary.operationCount || 0)} 条`)
      }
      if (plan?.summary?.invalidBatchCount > 0) {
        details.push(`JSON 解析失败批次：${Number(plan.summary.invalidBatchCount || 0)} 批`)
      }
      const batchRecords = Array.isArray(this.task?.data?.batchRecords) ? this.task.data.batchRecords : []
      batchRecords.slice(0, 12).forEach((record) => {
        const chunkLabel = `第 ${Number(record?.batchIndex || 0)} 批`
        const summaryText = String(
          record?.response?.parsed?.summary ||
          record?.response?.parsed?.content ||
          record?.response?.error ||
          ''
        ).trim()
        const opCount = Array.isArray(record?.operations) ? record.operations.length : 0
        details.push(`${chunkLabel}：${opCount} 条操作${summaryText ? `，${summaryText}` : ''}`)
      })
      return details
    },
    hasDetails() {
      return this.detailItems.length > 0
    },
    finalResultText() {
      if (!this.task) return ''
      return String(
        this.task.data?.fullOutput ||
        this.task.data?.outputPreview ||
        this.task.data?.applyResult?.message ||
        this.task.error ||
        ''
      ).trim()
    },
    bottomResultText() {
      return this.finalResultText
    },
    shouldShowBottomResult() {
      if (this.status !== 'done') return false
      if (!this.bottomResultText) return false
      const action = String(
        this.task?.data?.applyResult?.action ||
        this.task?.data?.documentAction ||
        ''
      ).trim()
      return action === 'none' || this.task?.data?.pendingApply === true
    },
    generatedArtifacts() {
      return Array.isArray(this.task?.data?.generatedArtifacts)
        ? this.task.data.generatedArtifacts.filter(Boolean).slice(0, 6)
        : []
    },
    writeTargetPreviewLines() {
      const targets = Array.isArray(this.task?.data?.writeTargets) ? this.task.data.writeTargets : []
      return targets.slice(0, 6).map((target, index) => {
        const action = String(target?.action || 'none').trim()
        const originalText = String(target?.originalText || '').replace(/\s+/g, ' ').trim()
        const outputText = String(target?.outputText || '').replace(/\s+/g, ' ').trim()
        const locateKey = String(target?.locateKey || '').trim()
        return `#${index + 1} ${action}${locateKey ? ` · ${locateKey}` : ''}${originalText ? ` · 原文：${originalText.slice(0, 30)}` : ''}${outputText ? ` · 结果：${outputText.slice(0, 30)}` : ''}`
      })
    },
    resultSummaryLines() {
      if (!this.task?.data) return []
      const summary = this.task.data.resultSummary || {}
      const applyResult = this.task.data.applyResult || {}
      const lines = []
      if (this.orchestrationSummary) lines.push(`处理链路：${this.orchestrationSummary}`)
      if (String(this.task.data.taskPhase || '').trim()) lines.push(`当前阶段：${this.task.data.taskPhase}`)
      if (Number(summary.changedParagraphCount || 0) > 0) lines.push(`变更段落：${Number(summary.changedParagraphCount)} 段`)
      if (Number(applyResult.replacedCount || summary.writeTargetCount || 0) > 0) lines.push(`替换内容：${Number(applyResult.replacedCount || summary.writeTargetCount || 0)} 处`)
      if (Number(applyResult.commentCount || 0) > 0) lines.push(`批注内容：${Number(applyResult.commentCount)} 处`)
      if (Number(applyResult.insertedParagraphCount || 0) > 0) lines.push(`插入段落：${Number(applyResult.insertedParagraphCount)} 段`)
      if (this.generatedArtifacts.length > 0) lines.push(`生成附件：${this.generatedArtifacts.length} 个`)
      if (String(this.task.data.assistantVersion || '').trim()) lines.push(`助手版本：${String(this.task.data.assistantVersion).trim()}`)
      if (Number.isFinite(Number(this.task.data.benchmarkScore))) lines.push(`评估得分：${Number(this.task.data.benchmarkScore)}`)
      if (String(this.task.data.evaluation?.summary || '').trim()) lines.push(`评测结论：${String(this.task.data.evaluation.summary).trim()}`)
      if (String(summary.downgradedFrom || applyResult.downgradedFrom || '').trim()) {
        lines.push(`发生降级：${String(summary.downgradedFrom || applyResult.downgradedFrom).trim()} -> ${String(applyResult.action || '').trim() || 'comment'}`)
      }
      if (this.task.data.pendingApply === true) lines.push('当前仅生成预览，尚未写回文档')
      if (lines.length === 0 && this.status === 'done') lines.push(this.task.data.applyResult?.message || '任务已完成')
      return lines
    },
    canUndo() {
      return this.task?.type === 'document-comment' &&
        this.status === 'done' &&
        this.task?.data?.undo?.status === 'available'
    },
    canApplyPlan() {
      return this.task?.data?.pendingApply === true
    },
    canStop() {
      return this.task?.status === 'running'
    },
    headerSubtitle() {
      if (this.canStop) return '关闭此窗口不会停止任务，只有点击停止任务才会中止执行。'
      if (this.task?.data?.pendingApply === true) return '当前任务已生成预览，确认后才会安全写回文档。'
      if (this.status === 'cancelled') return '当前任务已停止，可继续查看详情和最终结果。'
      if (this.status === 'abnormal') return '当前任务已异常结束，可查看说明与处理详情。'
      if (this.status === 'done') return '当前任务已完成，可继续查看详情和最终结果。'
      if (this.status === 'error') return '当前任务已结束，可查看错误信息和处理详情。'
      return '正在加载任务状态...'
    },
    shouldAutoClose() {
      if (this.status !== 'done') return false
      if (this.canUndo) return false
      if (this.generatedArtifacts.length) return false
      if (this.task?.data?.pendingApply === true) return false
      if (this.pendingRevisionModePrompt) return false
      const docAction = String(this.task?.data?.documentAction || '').trim()
      const applied = String(this.task?.data?.applyResult?.action || '').trim()
      if (docAction === 'none' || applied === 'none') return false
      return true
    },
    showAutoCloseHint() {
      return this.shouldAutoClose && this.autoCloseSecondsLeft > 0
    },
    taskTimeLines() {
      if (!this.task) return []
      return [
        this.task.createdAt ? `创建时间：${this.formatDateTime(this.task.createdAt)}` : '',
        this.task.startedAt ? `开始时间：${this.formatDateTime(this.task.startedAt)}` : '',
        this.task.endedAt ? `结束时间：${this.formatDateTime(this.task.endedAt)}` : ''
      ].filter(Boolean)
    },
    statusBadgeText() {
      if (this.status === 'done') return '已完成'
      if (this.status === 'error') return '失败'
      if (this.status === 'abnormal') return '异常结束'
      if (this.status === 'cancelled') return '已停止'
      if (this.status === 'running') return '进行中'
      return '准备中'
    },
    revisionModePromptCountdownText() {
      const pending = this.pendingRevisionModePrompt
      if (!pending) return ''
      const seconds = Math.max(0, Number(pending.secondsLeft || 0))
      const actionText = '直接继续处理'
      if (pending.pausedByHover === true || pending.pausedByFocus === true) {
        return `已暂停自动继续，恢复后将在 ${seconds} 秒后${actionText}`
      }
      return `${seconds} 秒后将${actionText}`
    },
    revisionModePromptProgressStyle() {
      const pending = this.pendingRevisionModePrompt
      const total = 5
      const remaining = Math.max(0, Number(pending?.secondsLeft || 0))
      const width = Math.max(0, Math.min(100, (remaining / total) * 100))
      const paused = pending?.pausedByHover === true || pending?.pausedByFocus === true
      return {
        width: `${width}%`,
        opacity: paused ? '0.55' : '1'
      }
    }
  },
  async mounted() {
    initSync()
    this.unsub = subscribe(() => {
      this.syncTask()
    })
    if (this.shouldAutoStartSpellCheck) {
      await this.startSpellCheckTask()
      return
    }
    if (!this.taskId) {
      this.errorMsg = '缺少任务标识，无法查看进度'
      return
    }
    this.syncTask()
    this.startPolling()
  },
  beforeUnmount() {
    this.unsub?.()
    this.stopPolling()
    this.clearAutoCloseTimer()
    this.clearRevisionModePromptTimers()
    this.releaseWindowSession()
  },
  methods: {
    startPolling() {
      this.stopPolling()
      this.pollTimer = window.setInterval(() => {
        this.syncTask()
      }, 400)
    },
    stopPolling() {
      if (this.pollTimer) {
        window.clearInterval(this.pollTimer)
        this.pollTimer = null
      }
    },
    clearAutoCloseTimer() {
      if (this.autoCloseTimer) {
        window.clearInterval(this.autoCloseTimer)
        this.autoCloseTimer = null
      }
      this.autoCloseSecondsLeft = 0
    },
    clearRevisionModePromptTimers() {
      if (this.revisionModePromptTimer) {
        window.clearTimeout(this.revisionModePromptTimer)
        this.revisionModePromptTimer = null
      }
      if (this.revisionModePromptInterval) {
        window.clearInterval(this.revisionModePromptInterval)
        this.revisionModePromptInterval = null
      }
    },
    shouldPromptEnableRevisionMode() {
      if (!this.canApplyPlan || !this.task?.data) return false
      if (this.pendingRevisionModePrompt) return false
      if (isDocumentTrackRevisionsEnabledForDialog()) return false
      const documentAction = String(this.task.data.documentAction || '').trim()
      return ['replace', 'comment-replace', 'insert-after', 'insert', 'prepend', 'append'].includes(documentAction)
    },
    createRevisionModePrompt() {
      return {
        status: 'pending',
        summaryText: '检测到即将写回文档，你可以先开启修订模式。',
        confirmPrompt: '点击“开启修订并继续”后，将自动开启文档修订模式，再继续写回；如果不需要，可直接继续。',
        statusMessage: '若未选择，将按默认方式直接继续处理。',
        secondsLeft: 5,
        pausedByHover: false,
        pausedByFocus: false
      }
    },
    scheduleRevisionModePromptCountdown(preserveRemaining = false) {
      const pending = this.pendingRevisionModePrompt
      if (!pending || pending.status !== 'pending') return
      const totalSeconds = Math.max(1, preserveRemaining ? Number(pending.secondsLeft || 5) : 5)
      pending.secondsLeft = totalSeconds
      pending.pausedByHover = false
      pending.pausedByFocus = false
      this.clearRevisionModePromptTimers()
      this.revisionModePromptInterval = window.setInterval(() => {
        if (!this.pendingRevisionModePrompt || this.pendingRevisionModePrompt.status !== 'pending') {
          this.clearRevisionModePromptTimers()
          return
        }
        if (this.pendingRevisionModePrompt.pausedByHover === true || this.pendingRevisionModePrompt.pausedByFocus === true) {
          return
        }
        const nextSeconds = Math.max(0, Number(this.pendingRevisionModePrompt.secondsLeft || totalSeconds) - 1)
        this.pendingRevisionModePrompt.secondsLeft = nextSeconds
        if (nextSeconds <= 0) {
          this.clearRevisionModePromptTimers()
        }
      }, 1000)
      this.revisionModePromptTimer = window.setTimeout(() => {
        this.clearRevisionModePromptTimers()
        if (!this.pendingRevisionModePrompt || this.pendingRevisionModePrompt.status !== 'pending') return
        if (this.pendingRevisionModePrompt.pausedByHover === true || this.pendingRevisionModePrompt.pausedByFocus === true) {
          this.scheduleRevisionModePromptCountdown(true)
          return
        }
        this.continueRevisionModePrompt({ autoTriggered: true })
      }, totalSeconds * 1000)
    },
    openRevisionModePrompt() {
      this.pendingRevisionModePrompt = this.createRevisionModePrompt()
      this.scheduleRevisionModePromptCountdown()
    },
    pauseRevisionModePrompt(reason = 'hover') {
      const pending = this.pendingRevisionModePrompt
      if (!pending || pending.status !== 'pending') return
      if (reason === 'focus') {
        pending.pausedByFocus = true
      } else {
        pending.pausedByHover = true
      }
      this.clearRevisionModePromptTimers()
    },
    resumeRevisionModePrompt(reason = 'hover') {
      const pending = this.pendingRevisionModePrompt
      if (!pending || pending.status !== 'pending') return
      if (reason === 'focus') {
        pending.pausedByFocus = false
      } else {
        pending.pausedByHover = false
      }
      if (pending.pausedByHover === true || pending.pausedByFocus === true) return
      this.scheduleRevisionModePromptCountdown(true)
    },
    handleRevisionModePromptFocusOut(event) {
      const currentTarget = event?.currentTarget || null
      const nextTarget = event?.relatedTarget || null
      if (currentTarget && nextTarget && typeof currentTarget.contains === 'function' && currentTarget.contains(nextTarget)) {
        return
      }
      this.resumeRevisionModePrompt('focus')
    },
    async executeApplyTaskPlan() {
      await applyAssistantTaskPlan(this.taskId)
      syncTasksFromStorage()
      this.task = getTaskById(this.taskId)
      this.errorMsg = ''
    },
    async confirmRevisionModePrompt() {
      const pending = this.pendingRevisionModePrompt
      if (!pending || pending.status === 'applying') return
      pending.status = 'applying'
      pending.statusMessage = '正在开启修订模式并继续处理...'
      const result = enableDocumentTrackRevisionsForDialog()
      this.pendingRevisionModePrompt = null
      this.clearRevisionModePromptTimers()
      if (!result.ok && result.message) {
        this.errorMsg = result.message
      }
      try {
        await this.executeApplyTaskPlan()
        if (result.message) {
          this.errorMsg = result.ok ? '' : result.message
        }
      } catch (e) {
        this.errorMsg = e?.message || '确认写回失败'
      }
    },
    async continueRevisionModePrompt(options = {}) {
      const pending = this.pendingRevisionModePrompt
      if (!pending || pending.status === 'applying') return
      pending.status = 'applying'
      pending.statusMessage = options.autoTriggered === true ? '已按默认方式直接继续处理...' : '正在按当前文档状态继续处理...'
      this.pendingRevisionModePrompt = null
      this.clearRevisionModePromptTimers()
      try {
        await this.executeApplyTaskPlan()
      } catch (e) {
        this.errorMsg = e?.message || '确认写回失败'
      }
    },
    formatDateTime(value) {
      if (!value) return ''
      try {
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return String(value)
        return date.toLocaleString('zh-CN', { hour12: false })
      } catch (_) {
        return String(value)
      }
    },
    scheduleAutoClose() {
      if (this.autoCloseTimer || !this.shouldAutoClose) return
      this.autoCloseSecondsLeft = 5
      this.autoCloseTimer = window.setInterval(() => {
        this.autoCloseSecondsLeft = Math.max(0, Number(this.autoCloseSecondsLeft || 0) - 1)
        if (this.autoCloseSecondsLeft <= 0) {
          this.clearAutoCloseTimer()
          this.closeWindow()
        }
      }, 1000)
    },
    bindWindowSession(taskId) {
      const normalizedTaskId = String(taskId || '')
      if (!normalizedTaskId) return true
      if (this.windowSession?.taskId === normalizedTaskId) return true
      this.releaseWindowSession()
      const session = createTaskProgressWindowSession(normalizedTaskId)
      const claimed = session.claimOwnership()
      if (!claimed.ok) {
        if (claimed.reason === 'duplicate') {
          this.errorMsg = '该任务的进度窗已打开，已切换到现有窗口'
          window.setTimeout(() => {
            this.closeWindow()
          }, 80)
          return false
        }
        this.errorMsg = '进度窗状态同步失败'
        return false
      }
      this.windowSession = { taskId: normalizedTaskId, session }
      return true
    },
    releaseWindowSession() {
      this.windowSession?.session?.releaseOwnership?.()
      this.windowSession = null
    },
    async startSpellCheckTask() {
      this.errorMsg = ''
      try {
        const bridge = getSpellCheckTaskBridge()
        const result = bridge?.start
          ? bridge.start(this.spellCheckMode)
          : null
        if (!result?.taskId) {
          throw new Error('任务启动失败，未能创建任务')
        }
        this.currentTaskId = result.taskId
        if (!this.bindWindowSession(result.taskId)) return
        this.syncTask()
        this.startPolling()
      } catch (e) {
        this.errorMsg = e?.message || '拼写检查启动失败'
      }
    },
    syncTask() {
      syncTasksFromStorage()
      if (!this.bindWindowSession(this.taskId)) return
      const task = getTaskById(this.taskId)
      if (!task) {
        return
      }
      this.task = task
      if (this.pendingRevisionModePrompt && task.data?.pendingApply !== true) {
        this.pendingRevisionModePrompt = null
        this.clearRevisionModePromptTimers()
      }
      this.errorMsg = ''
      if (task.status === 'completed' && this.shouldAutoClose) {
        this.scheduleAutoClose()
      } else {
        this.clearAutoCloseTimer()
      }
    },
    toggleDetails() {
      if (!this.hasDetails) return
      this.showDetails = !this.showDetails
    },
    stopTask() {
      if (!this.task || !this.canStop) return
      let ok = false
      if (this.task.type === 'spell-check') {
        ok = stopSpellCheckTask(this.task.id)
      } else if (this.task.type === 'assistant-prompt-recommendation') {
        ok = stopAssistantPromptRecommendationTask(this.task.id)
      } else if (this.task.type === 'form-audit') {
        ok = stopFormAuditTask(this.task.id)
      } else if (this.task.type === 'document-comment') {
        ok = stopDocumentCommentTask(this.task.id)
      } else if (this.task.type === 'wps-capability') {
        ok = stopWpsCapabilityTask(this.task.id)
      } else if (String(this.task.type || '').startsWith('multimodal-')) {
        ok = stopMultimodalTask(this.task.id)
      } else {
        ok = stopAssistantTask(this.task.id)
      }
      syncTasksFromStorage()
      const latestTask = getTaskById(this.task.id)
      if (latestTask) {
        this.task = latestTask
      } else if (ok) {
        this.task = {
          ...this.task,
          status: 'cancelled',
          error: '任务已停止',
          endedAt: this.task.endedAt || new Date().toISOString()
        }
      }
      if (!ok) {
        const latest = getTaskById(this.task.id)
        if (latest && (latest.status === 'running' || latest.status === 'pending')) {
          updateTask(this.task.id, {
            status: 'abnormal',
            error: latest.error || '任务已结束或进程已退出，已标记为异常结束'
          })
          syncTasksFromStorage()
          this.task = getTaskById(this.task.id) || latest
        } else if (latest) {
          this.task = latest
        }
        this.errorMsg = ''
        return
      }
      this.errorMsg = ''
    },
    undoTask() {
      if (!this.canUndo || !this.taskId) return
      try {
        const result = undoDocumentCommentTask(this.taskId)
        syncTasksFromStorage()
        this.task = getTaskById(this.taskId)
        this.errorMsg = ''
        if (result?.message) {
          this.showDetails = true
        }
      } catch (e) {
        this.errorMsg = e?.message || '撤销任务失败'
      }
    },
    async applyTaskPlan() {
      if (!this.canApplyPlan || !this.taskId) return
      if (this.shouldPromptEnableRevisionMode()) {
        this.openRevisionModePrompt()
        return
      }
      try {
        await this.executeApplyTaskPlan()
      } catch (e) {
        this.errorMsg = e?.message || '确认写回失败'
      }
    },
    openTaskDetail() {
      if (!this.taskId) return
      try {
        if (focusExistingTaskListWindow({ taskId: this.taskId, detail: '1' })) {
          return
        }
        const href = String(window.location.href || '')
        const base = href.split('#')[0] || href
        const url = `${base}#/popup?taskId=${encodeURIComponent(this.taskId)}&detail=1`
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
      } catch (e) {
        this.errorMsg = '打开任务详情失败'
      }
    },
    closeWindow() {
      this.clearAutoCloseTimer()
      try {
        if (window.close) window.close()
      } catch (_) {
        // Ignore close failures in restricted dialog hosts.
      }
    }
  }
}
</script>

<style scoped>
.task-progress-dialog {
  padding: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', sans-serif;
  min-width: 420px;
  color: #111827;
  background: #f6f8fb;
}
.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
}
.header-main {
  min-width: 0;
  flex: 1;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.header h2 {
  margin: 0;
  font-size: 17px;
  line-height: 1.3;
}
.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  border: 1px solid transparent;
}
.status-badge.running {
  color: #1d4ed8;
  background: #dbeafe;
  border-color: #bfdbfe;
}
.status-badge.done {
  color: #047857;
  background: #d1fae5;
  border-color: #a7f3d0;
}
.status-badge.error {
  color: #b91c1c;
  background: #fee2e2;
  border-color: #fecaca;
}
.status-badge.cancelled {
  color: #92400e;
  background: #fef3c7;
  border-color: #fde68a;
}
.status-badge.abnormal {
  color: #b45309;
  background: #fffbeb;
  border-color: #fcd34d;
}
.status-badge.loading {
  color: #4b5563;
  background: #f3f4f6;
  border-color: #e5e7eb;
}
.header-subtitle {
  margin: 6px 0 0 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.icon-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(255, 255, 255, 0.82);
  color: #64748b;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}
.icon-btn:hover {
  color: #0f172a;
  border-color: rgba(59, 130, 246, 0.26);
  background: rgba(59, 130, 246, 0.08);
}
.icon-btn.danger {
  color: #dc2626;
}
.icon-btn.danger:hover {
  border-color: rgba(239, 68, 68, 0.26);
  background: rgba(239, 68, 68, 0.1);
}
.icon-btn.success {
  color: #16a34a;
}
.icon-btn.success:hover {
  border-color: rgba(34, 197, 94, 0.26);
  background: rgba(34, 197, 94, 0.1);
}
.icon-btn.subtle:hover {
  color: #334155;
  background: rgba(148, 163, 184, 0.08);
  border-color: rgba(148, 163, 184, 0.28);
}
.icon-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);
}
.body {
  padding: 12px 14px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
}
.progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.progress-text {
  font-size: 13px;
  font-weight: 500;
  color: #111827;
  line-height: 1.5;
}
.progress-text.error {
  color: #ef4444;
}
.progress-percent {
  flex-shrink: 0;
  min-width: 44px;
  text-align: right;
  font-size: 12px;
  font-weight: 700;
  color: #1d4ed8;
}
.progress-bar {
  height: 8px;
  background: #edf2f7;
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 12px;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #60a5fa 0%, #2563eb 55%, #1d4ed8 100%);
  transition: width 0.3s;
}
.preview-card {
  margin-bottom: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f8fafc;
  overflow: hidden;
}
.revision-mode-card {
  border-color: rgba(37, 99, 235, 0.22);
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.96), rgba(248, 250, 252, 0.98));
}
.guard-notice-card {
  border-color: rgba(245, 158, 11, 0.34);
  background: linear-gradient(180deg, rgba(255, 251, 235, 0.96), rgba(255, 255, 255, 0.98));
}
.preview-label {
  padding: 8px 10px 0;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 4px;
}
.preview-content {
  max-height: 140px;
  overflow-y: auto;
  padding: 0 10px 10px;
  background: transparent;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.55;
}
.details-card {
  background: #fff;
}
.details-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.detail-item {
  padding: 8px 10px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
}
.revision-mode-countdown {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 10px 10px;
}
.revision-mode-countdown-text {
  font-size: 12px;
  line-height: 1.5;
  color: #1d4ed8;
  font-weight: 600;
}
.revision-mode-countdown-track {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(148, 163, 184, 0.22);
}
.revision-mode-countdown-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.92), rgba(14, 165, 233, 0.88));
  transition: width 0.22s ease;
}
.revision-mode-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 0 10px 10px;
}
.icon-text-btn {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 12px;
  line-height: 1.2;
  cursor: pointer;
  transition: all 0.2s ease;
}
.icon-text-btn:hover:not(:disabled) {
  border-color: #9ca3af;
  background: #f9fafb;
}
.icon-text-btn.success {
  border-color: #bfdbfe;
  background: #2563eb;
  color: #fff;
}
.icon-text-btn.success:hover:not(:disabled) {
  background: #1d4ed8;
  border-color: #93c5fd;
}
.icon-text-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
.revision-mode-status {
  margin: 0 10px 10px;
  color: #475569;
}
.result-note {
  margin-top: 10px;
  padding: 8px 10px;
  font-size: 12px;
  color: #4b5563;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
.task-footer {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.task-footer-actions {
  margin-bottom: 8px;
}
.detail-link-btn {
  border: 1px solid #dbeafe;
  background: #eff6ff;
  color: #2563eb;
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
}
.detail-link-btn:hover {
  background: #dbeafe;
}
.task-footer-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.task-list-hint {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
}
.task-time-list {
  font-size: 11px;
  line-height: 1.55;
  color: #64748b;
}
.auto-close-hint {
  font-size: 12px;
  color: #047857;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 999px;
  padding: 3px 8px;
}
@media (max-width: 640px) {
  .header,
  .progress-meta {
    flex-direction: column;
    align-items: stretch;
  }
  .header-actions {
    justify-content: flex-start;
  }
  .progress-percent {
    text-align: left;
  }
  .task-footer {
    align-items: stretch;
  }
}
</style>
