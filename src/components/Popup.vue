<template>
  <div class="popup task-list-popup">
    <div class="header">
      <h2>任务清单</h2>
      <div class="header-actions">
        <button v-if="hasFailedTasks" type="button" class="btn-clear" @click="clearFailed">清空失败与异常</button>
        <button v-if="hasCompletedTasks" type="button" class="btn-clear" @click="clearCompleted">清空已完成</button>
      </div>
    </div>
    <div class="content">
      <div v-if="tasks.length === 0" class="empty-state">
        <p>暂无任务</p>
        <p class="hint">点击「检查全部」或「检查当前选中」开始拼写与语法检查，任务将显示在此处</p>
      </div>
      <div v-else>
        <div v-if="hasSecurityTasks" class="overview-wrap">
          <div class="overview-scope-switch">
            <button
              type="button"
              class="overview-scope-btn"
              :class="{ active: overviewScope === 'all' }"
              @click="overviewScope = 'all'"
            >统计全部任务</button>
            <button
              type="button"
              class="overview-scope-btn"
              :class="{ active: overviewScope === 'filtered' }"
              @click="overviewScope = 'filtered'"
            >仅统计当前筛选结果</button>
          </div>
        <div class="overview-bar">
          <button type="button" class="overview-card high" :class="{ active: riskFilter === 'high_only' }" @click="applyOverviewFilter('high_only')">
            <div class="overview-label">高危任务</div>
            <div class="overview-value">{{ securityOverview.highRiskTasks }}</div>
          </button>
          <button type="button" class="overview-card medium" :class="{ active: riskFilter === 'medium_only' }" @click="applyOverviewFilter('medium_only')">
            <div class="overview-label">中危任务</div>
            <div class="overview-value">{{ securityOverview.mediumRiskTasks }}</div>
          </button>
          <button type="button" class="overview-card keyword" :class="{ active: riskFilter === 'keyword_hit' }" @click="applyOverviewFilter('keyword_hit')">
            <div class="overview-label">关键词命中任务</div>
            <div class="overview-value">{{ securityOverview.keywordHitTasks }}</div>
          </button>
          <button type="button" class="overview-card clean" :class="{ active: riskFilter === 'clean_only' }" @click="applyOverviewFilter('clean_only')">
            <div class="overview-label">未见明显风险</div>
            <div class="overview-value">{{ securityOverview.cleanTasks }}</div>
          </button>
          <button type="button" class="overview-card latest" :class="{ active: riskFilter === 'all' && sortBy === 'updated_desc' }" @click="focusLatestSecurityChecks">
            <div class="overview-label">最近保密检查</div>
            <div class="overview-value small">{{ securityOverview.latestSecurityCheckAt || '暂无' }}</div>
          </button>
        </div>
        </div>
        <div class="filter-bar">
          <input
            v-model.trim="searchText"
            type="text"
            class="filter-input"
            placeholder="搜索任务标题、根因、摘要"
          />
          <select v-model="statusFilter" class="filter-select">
            <option value="all">全部状态</option>
            <option value="running">进行中</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
            <option value="cancelled">已取消</option>
            <option value="abnormal">异常结束</option>
          </select>
          <select v-model="sourceFilter" class="filter-select">
            <option value="all">全部范围</option>
            <option value="document">全文</option>
            <option value="selection">选中文本</option>
          </select>
          <select v-model="causeFilter" class="filter-select">
            <option value="all">全部根因</option>
            <option
              v-for="cause in availableCauseOptions"
              :key="cause"
              :value="cause"
            >{{ cause }}</option>
          </select>
          <select v-model="resultFilter" class="filter-select">
            <option value="all">全部审查结论</option>
            <option
              v-for="result in availableGenericBadgeOptions"
              :key="result"
              :value="result"
            >{{ result }}</option>
          </select>
          <select v-model="riskFilter" class="filter-select">
            <option value="all">全部风险视图</option>
            <option value="high_only">仅高危任务</option>
            <option value="medium_only">仅中危任务</option>
            <option value="keyword_hit">仅关键词命中</option>
            <option value="clean_only">仅未见明显风险</option>
          </select>
          <select v-model="anchorFilter" class="filter-select">
            <option value="all">全部定位质量</option>
            <option value="precise_only">仅精确命中</option>
            <option value="has_fallback">包含整句回退</option>
            <option value="has_failed">包含定位失败</option>
            <option value="risky">高风险任务</option>
          </select>
          <select v-model="sortBy" class="filter-select">
            <option value="updated_desc">最新更新时间</option>
            <option value="updated_asc">最早更新时间</option>
            <option value="status">按状态</option>
            <option value="chunk_desc">按分块数降序</option>
          </select>
          <button
            v-if="clearableFilteredCount > 0"
            type="button"
            class="btn-filter-clear"
            @click="clearFilteredTasks"
          >清理筛选结果（{{ clearableFilteredCount }}）</button>
          <button
            v-if="filteredTasks.length > 0"
            type="button"
            class="btn-filter-export"
            @click="copyFilteredTasksMarkdownReport"
          >复制汇总 Markdown（{{ filteredTasks.length }}）</button>
          <button
            v-if="filteredTasks.length > 0"
            type="button"
            class="btn-filter-export"
            @click="downloadFilteredTasksJson"
          >下载汇总 JSON（{{ filteredTasks.length }}）</button>
        </div>
        <div v-if="filteredTasks.length === 0" class="empty-state compact-empty">
          <p>没有匹配的任务</p>
          <p class="hint">调整搜索词或筛选条件后重试</p>
        </div>
        <div v-else class="task-list">
        <div
          v-for="task in filteredTasks"
          :key="task.id"
          class="task-item"
          :class="[task.status, { expanded: expandedId === task.id }]"
          @click="toggleExpand(task.id)"
        >
          <div class="task-header">
            <span class="task-status-icon">{{ statusIcon(task.status) }}</span>
            <span class="task-title">{{ task.title }}</span>
            <span class="task-progress" v-if="task.total > 0">
              {{ task.current }}/{{ task.total }}
            </span>
            <button
              v-if="task.status === 'running'"
              type="button"
              class="btn-stop"
              title="停止任务"
              @click.stop="stopTask(task.id)"
            >停止</button>
            <button
              type="button"
              class="btn-detail"
              title="查看详情"
              @click.stop="openDetail(task)"
            >详情</button>
          </div>
          <div class="task-summary-row">
            <span class="task-chip">{{ formatChunkSource(isWorkflowTask(task) ? 'workflow' : task.data?.chunkSource) }}</span>
            <span class="task-chip" v-if="task.data?.chunkCount">分块 {{ task.data.chunkCount }}</span>
            <span v-if="getAnchorStats(task).precise > 0" class="task-chip anchor precise">精确 {{ getAnchorStats(task).precise }}</span>
            <span v-if="getAnchorStats(task).fallback > 0" class="task-chip anchor fallback">回退 {{ getAnchorStats(task).fallback }}</span>
            <span v-if="getAnchorStats(task).failed > 0" class="task-chip anchor failed">失败 {{ getAnchorStats(task).failed }}</span>
            <span v-if="getAnchorStats(task).skipped > 0" class="task-chip anchor skipped">跳过 {{ getAnchorStats(task).skipped }}</span>
            <span v-if="getSecurityRiskCounts(task).high > 0" class="task-chip risk-count high">高危 {{ getSecurityRiskCounts(task).high }}</span>
            <span v-if="getSecurityRiskCounts(task).medium > 0" class="task-chip risk-count medium">中危 {{ getSecurityRiskCounts(task).medium }}</span>
            <span v-if="getAiTraceLikelihoodCounts(task).high > 0" class="task-chip risk-count high">高疑似 {{ getAiTraceLikelihoodCounts(task).high }}</span>
            <span v-if="getAiTraceLikelihoodCounts(task).medium > 0" class="task-chip risk-count medium">中疑似 {{ getAiTraceLikelihoodCounts(task).medium }}</span>
            <span v-if="getSecurityKeywordCount(task) > 0" class="task-chip risk-count keyword">关键词 {{ getSecurityKeywordCount(task) }}</span>
            <span
              v-if="getGenericTaskBadge(task)"
              class="task-chip generic"
              :class="getGenericTaskBadgeClass(task)"
            >{{ getGenericTaskBadge(task) }}</span>
            <span
              v-if="getTaskCauseLabel(task)"
              class="task-chip cause"
              :class="causeClass(getTaskDiagnostic(task))"
            >{{ getTaskCauseLabel(task) }}</span>
          </div>
          <div v-if="getTaskListPrimarySummary(task)" class="task-summary-text">{{ getTaskListPrimarySummary(task) }}</div>
          <div v-if="getTaskCauseSummary(task)" class="task-summary-text">{{ getTaskCauseSummary(task) }}</div>
          <div v-if="getTaskListSecondarySummary(task)" class="task-risk-text">{{ getTaskListSecondarySummary(task) }}</div>
          <div v-if="getAnchorRiskSummary(task)" class="task-risk-text">{{ getAnchorRiskSummary(task) }}</div>
          <div v-if="isWorkflowTask(task)" class="workflow-tree">
            <div class="workflow-tree-title">工作流任务树</div>
            <div
              v-for="nodeRun in getWorkflowNodeRuns(task)"
              :key="`workflow-node-run-${task.id}-${nodeRun.nodeId}`"
              class="workflow-tree-item"
              @click.stop="openWorkflowChildDetail(nodeRun)"
            >
              <div class="workflow-tree-item-head">
                <span class="workflow-tree-status" :class="getWorkflowNodeRunStatus(nodeRun)">{{ statusIcon(getWorkflowNodeRunStatus(nodeRun)) }}</span>
                <span class="workflow-tree-name">{{ nodeRun.title || '未命名节点' }}</span>
                <span class="workflow-tree-time" v-if="getWorkflowNodeRunDuration(nodeRun)">{{ getWorkflowNodeRunDuration(nodeRun) }}</span>
              </div>
              <div class="workflow-tree-item-sub">{{ getWorkflowNodeRunPathLabel(task, nodeRun) }}</div>
              <div v-if="getWorkflowNodeRunSummary(nodeRun)" class="workflow-tree-item-summary">{{ getWorkflowNodeRunSummary(nodeRun) }}</div>
            </div>
          </div>
          <div v-if="task.status === 'running'" class="task-progress-bar">
            <div class="progress-fill" :style="{ width: (task.progress || 0) + '%' }"></div>
          </div>
          <div v-if="expandedId === task.id" class="task-detail">
            <template v-if="isWorkflowTask(task)">
              <div class="detail-row">工作流标识：{{ task.data?.workflowName || task.title }}</div>
              <div class="detail-row" v-if="task.total > 0">执行进度：{{ task.current }}/{{ task.total }}</div>
              <div class="detail-row" v-if="task.data?.currentNodeTitle">当前节点：{{ task.data.currentNodeTitle }}</div>
              <div class="detail-row" v-if="task.error">失败原因：{{ task.error }}</div>
              <div v-if="getWorkflowDebugState(task)?.enabled" class="workflow-detail-debug-card">
                <div class="workflow-detail-debug-title">调试状态</div>
                <div class="workflow-detail-item-summary">
                  {{ getWorkflowDebugState(task)?.paused ? '已暂停' : (task.status === 'running' ? '运行中' : '已结束') }}
                  <template v-if="getWorkflowDebugState(task)?.waitingReason"> · {{ getWorkflowDebugState(task).waitingReason }}</template>
                </div>
                <div v-if="getWorkflowDebugState(task)?.waitingNodeTitle" class="workflow-detail-item-summary">
                  当前节点：{{ getWorkflowDebugState(task).waitingNodeTitle }}
                </div>
                <div v-if="getWorkflowDebugState(task)?.inputPreview" class="detail-section">
                  <div class="detail-section-label">当前步输入</div>
                  <pre class="detail-section-content output-box">{{ getWorkflowDebugState(task).inputPreview }}</pre>
                </div>
                <div v-if="getWorkflowDebugState(task)?.lastOutputText" class="detail-section">
                  <div class="detail-section-label">最近一步输出</div>
                  <pre class="detail-section-content output-box">{{ getWorkflowDebugState(task).lastOutputText }}</pre>
                </div>
              </div>
              <div class="workflow-detail-list">
                <div
                  v-for="nodeRun in getWorkflowNodeRuns(task)"
                  :key="`workflow-detail-${task.id}-${nodeRun.nodeId}`"
                  class="workflow-detail-item"
                >
                  <div class="workflow-detail-item-title">
                    <span>{{ nodeRun.title || '未命名节点' }}</span>
                    <span class="task-chip generic">{{ taskStatusLabel(getWorkflowNodeRunStatus(nodeRun)) }}</span>
                  </div>
                  <div class="workflow-detail-item-meta">{{ getWorkflowNodeRunPathLabel(task, nodeRun) }}</div>
                  <div v-if="getWorkflowNodeRunSummary(nodeRun)" class="workflow-detail-item-summary">{{ getWorkflowNodeRunSummary(nodeRun) }}</div>
                  <div v-if="nodeRun.inputSummary" class="workflow-detail-item-summary">输入来源：{{ nodeRun.inputSummary }}</div>
                  <div v-if="nodeRun.pauseReason" class="workflow-detail-item-summary workflow-detail-item-paused">暂停原因：{{ nodeRun.pauseReason }}</div>
                  <div v-if="nodeRun.inputPreview" class="detail-section">
                    <div class="detail-section-label">节点输入</div>
                    <pre class="detail-section-content output-box">{{ nodeRun.inputPreview }}</pre>
                  </div>
                  <div v-if="nodeRun.outputText" class="detail-section">
                    <div class="detail-section-label">节点输出文本</div>
                    <pre class="detail-section-content output-box">{{ nodeRun.outputText }}</pre>
                  </div>
                  <div v-if="shouldShowWorkflowNodeOutputValue(nodeRun)" class="detail-section">
                    <div class="detail-section-label">节点输出结构</div>
                    <pre class="detail-section-content output-box">{{ formatJson(nodeRun.outputValue) }}</pre>
                  </div>
                  <div v-if="nodeRun.branchDecisions?.length" class="detail-section">
                    <div class="detail-section-label">分支决策</div>
                    <div v-for="decision in nodeRun.branchDecisions" :key="decision.edgeId" class="workflow-detail-item-summary">
                      {{ decision.taken ? '进入' : '跳过' }} {{ decision.targetNodeTitle || decision.targetNodeId }} · {{ decision.reason }}
                    </div>
                  </div>
                  <button
                    v-if="getWorkflowChildTask(nodeRun)"
                    type="button"
                    class="btn-detail workflow-detail-link"
                    @click.stop="openWorkflowChildDetail(nodeRun)"
                  >查看子任务详情</button>
                </div>
              </div>
            </template>
            <div v-if="!isWorkflowTask(task)" class="detail-row">
              范围：{{ formatChunkSource(task.data?.chunkSource) }}
            </div>
            <div class="detail-row" v-if="!isWorkflowTask(task) && task.data?.chunkCount != null">
              分块数：{{ task.data.chunkCount }}
            </div>
            <div class="detail-row" v-if="!isWorkflowTask(task) && hasAnchorStats(task)">
              定位汇总：精确 {{ getAnchorStats(task).precise }} / 回退 {{ getAnchorStats(task).fallback }} / 失败 {{ getAnchorStats(task).failed }} / 跳过 {{ getAnchorStats(task).skipped }}
            </div>
            <div class="detail-row" v-if="!isWorkflowTask(task) && getTaskCauseLabel(task)">
              根因：{{ getTaskCauseLabel(task) }}
            </div>
            <div class="detail-row" v-if="!isWorkflowTask(task) && getTaskCauseSummary(task)">
              说明：{{ getTaskCauseSummary(task) }}
            </div>
            <div class="detail-row" v-if="!isWorkflowTask(task) && task.data?.assistantVersion">
              助手版本：{{ task.data.assistantVersion }}
            </div>
            <div class="detail-row" v-if="!isWorkflowTask(task) && task.data?.benchmarkScore != null">
              评估得分：{{ task.data.benchmarkScore }}
            </div>
            <div class="detail-row" v-if="!isWorkflowTask(task) && task.data?.evaluation?.summary">
              评测结论：{{ task.data.evaluation.summary }}
            </div>
            <div v-if="!isWorkflowTask(task) && task.data?.currentChunk" class="current-content">
              <div class="detail-label">正在检查：</div>
              <div class="content-preview">{{ task.data.currentChunk }}</div>
            </div>
            <div v-if="!isWorkflowTask(task) && task.data?.commentCount != null" class="detail-row">
              已添加批注：{{ task.data.commentCount }} 处
            </div>
            <div v-if="task.createdAt" class="detail-row">
              创建时间：{{ formatTime(task.createdAt) }}
            </div>
            <div v-if="task.startedAt" class="detail-row">
              开始时间：{{ formatTime(task.startedAt) }}
            </div>
            <div v-if="task.endedAt" class="detail-row">
              结束时间：{{ formatTime(task.endedAt) }}
            </div>
            <div class="detail-row">
              更新时间：{{ formatTime(task.updatedAt) }}
            </div>
            <div v-if="task.status === 'running'" class="detail-actions">
              <button type="button" class="btn-stop" @click.stop="stopTask(task.id)">停止当前任务</button>
              <button type="button" class="btn-detail" @click.stop="openTaskProgress(task.id)">打开进度窗</button>
            </div>
            <div v-if="task.error" class="detail-error">{{ task.error }}</div>
          </div>
        </div>
      </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="detailTask" class="detail-modal-overlay" @click.self="closeDetail">
      <div class="detail-modal">
        <div class="detail-modal-header">
          <div class="detail-modal-header-main">
            <div class="detail-modal-title-row">
              <h3>{{ detailTask.title }} - 详情</h3>
              <span class="detail-status-badge" :class="detailTask.status">{{ taskStatusLabel(detailTask.status) }}</span>
            </div>
            <p class="detail-modal-subtitle">{{ isWorkflowTask(detailTask) ? '查看工作流执行树、节点状态和子任务详情。' : '查看任务明细、诊断信息和逐段输出记录。' }}</p>
          </div>
          <div class="detail-modal-actions">
            <button
              v-if="detailTask.status === 'running' || detailTask.progress != null"
              type="button"
              class="btn-detail modal-action-btn modal-action-btn-primary"
              @click="openTaskProgress(detailTask.id)"
            >打开进度窗</button>
            <button
              type="button"
              class="btn-copy-diagnostic modal-action-btn modal-action-btn-secondary"
              @click="copyTaskDebugSnapshot(detailTask)"
            >复制排障快照</button>
            <button
              type="button"
              class="btn-copy-diagnostic modal-action-btn modal-action-btn-secondary"
              @click="copyTaskSanitizedDebugSnapshot(detailTask)"
            >复制脱敏快照</button>
            <button
              type="button"
              class="btn-copy-diagnostic modal-action-btn modal-action-btn-secondary"
              @click="copyTaskMarkdownReport(detailTask)"
            >复制 Markdown 报告</button>
            <button
              type="button"
              class="btn-copy-diagnostic modal-action-btn modal-action-btn-secondary"
              @click="downloadTaskDebugJson(detailTask)"
            >下载 JSON</button>
            <button
              v-if="getAnchorStats(detailTask).skipped > 0 && detailTask.status !== 'running'"
              type="button"
              class="btn-apply-comment modal-action-btn modal-action-btn-warn"
              :disabled="isApplyingSkippedTask(detailTask.id)"
              @click="openBatchApplyPreview(detailTask.id)"
            >{{ isApplyingSkippedTask(detailTask.id) ? '批量写入中...' : `批量写入跳过项（${getAnchorStats(detailTask).skipped}）` }}</button>
            <button
              v-if="detailTask.status === 'running'"
              type="button"
              class="btn-stop modal-action-btn modal-action-btn-danger"
              @click="stopTask(detailTask.id)"
            >停止任务</button>
            <button type="button" class="btn-close modal-close-btn" title="关闭详情" aria-label="关闭详情" @click="closeDetail">×</button>
          </div>
        </div>
        <div ref="detailModalBody" class="detail-modal-body" @scroll="handleDetailBodyScroll">
          <div class="task-meta-panel">
            <div class="task-meta-row" v-if="detailTask.createdAt">
              <span class="task-meta-label">创建时间：</span>
              <span class="task-meta-value">{{ formatTime(detailTask.createdAt) }}</span>
            </div>
            <div class="task-meta-row" v-if="detailTask.startedAt">
              <span class="task-meta-label">开始时间：</span>
              <span class="task-meta-value">{{ formatTime(detailTask.startedAt) }}</span>
            </div>
            <div class="task-meta-row" v-if="detailTask.endedAt">
              <span class="task-meta-label">结束时间：</span>
              <span class="task-meta-value">{{ formatTime(detailTask.endedAt) }}</span>
            </div>
            <div class="task-meta-row">
              <span class="task-meta-label">更新时间：</span>
              <span class="task-meta-value">{{ formatTime(detailTask.updatedAt) }}</span>
            </div>
            <div class="task-meta-row" v-if="detailTask.data?.assistantVersion">
              <span class="task-meta-label">助手版本：</span>
              <span class="task-meta-value">{{ detailTask.data.assistantVersion }}</span>
            </div>
            <div class="task-meta-row" v-if="detailTask.data?.benchmarkScore != null">
              <span class="task-meta-label">评估得分：</span>
              <span class="task-meta-value">{{ detailTask.data.benchmarkScore }}</span>
            </div>
            <div class="task-meta-row" v-if="detailTask.data?.evaluation?.summary">
              <span class="task-meta-label">评测结论：</span>
              <span class="task-meta-value">{{ detailTask.data.evaluation.summary }}</span>
            </div>
          </div>
          <div v-if="isWorkflowTask(detailTask)" class="workflow-visual-panel">
            <div class="workflow-visual-card">
              <div class="workflow-visual-title">工作流快照</div>
              <div class="workflow-visual-subtitle">保存时的节点位置与连线路径，可用于回看编排结构。</div>
              <div class="workflow-snapshot">
                <svg class="workflow-snapshot-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <line
                    v-for="edge in getWorkflowSnapshotEdges(detailTask)"
                    :key="`workflow-edge-${detailTask.id}-${edge.id}`"
                    :x1="getWorkflowSnapshotEdgeLine(detailTask, edge).x1"
                    :y1="getWorkflowSnapshotEdgeLine(detailTask, edge).y1"
                    :x2="getWorkflowSnapshotEdgeLine(detailTask, edge).x2"
                    :y2="getWorkflowSnapshotEdgeLine(detailTask, edge).y2"
                    class="workflow-snapshot-edge"
                    :class="getWorkflowSnapshotEdgeClass(detailTask, edge)"
                  />
                </svg>
                <div
                  v-for="node in getWorkflowSnapshotNodes(detailTask)"
                  :key="`workflow-node-${detailTask.id}-${node.id}`"
                  class="workflow-snapshot-node"
                  :class="[getWorkflowSnapshotNodeClass(detailTask, node), { selected: detailTask.data?.currentNodeId === node.id }]"
                  :style="getWorkflowSnapshotNodeStyle(detailTask, node)"
                >
                  <div class="workflow-snapshot-node-title">{{ getWorkflowSnapshotNodeTitle(node) }}</div>
                  <div v-if="node.id !== 'workflow_start'" class="workflow-snapshot-node-status">
                    {{ taskStatusLabel(getWorkflowSnapshotNodeStatus(detailTask, node.id)) }}
                  </div>
                </div>
              </div>
            </div>
            <div class="workflow-visual-card">
              <div class="workflow-visual-title">执行路径</div>
              <div class="workflow-visual-subtitle">按运行时间展示节点推进顺序，便于定位停滞点与失败点。</div>
              <div class="workflow-sequence">
                <div
                  v-for="item in getWorkflowExecutionSequence(detailTask)"
                  :key="`workflow-seq-${detailTask.id}-${item.nodeId}`"
                  class="workflow-sequence-item"
                  :class="item.status"
                >
                  <div class="workflow-sequence-index">{{ item.order }}</div>
                  <div class="workflow-sequence-content">
                    <div class="workflow-sequence-title">{{ item.title }}</div>
                    <div class="workflow-sequence-meta">{{ item.pathLabel }} · {{ taskStatusLabel(item.status) }}</div>
                    <div v-if="item.summary" class="workflow-sequence-summary">{{ item.summary }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="task-meta-panel" v-if="detailTask.data?.chunkSource || detailTask.data?.chunkSettings">
            <div class="task-meta-row">
              <span class="task-meta-label">分块来源：</span>
              <span class="task-meta-value">{{ formatChunkSource(detailTask.data?.chunkSource) }}</span>
            </div>
            <div class="task-meta-row" v-if="detailTask.data?.chunkSettings">
              <span class="task-meta-label">分块参数：</span>
              <span class="task-meta-value">
                chunkLength={{ detailTask.data.chunkSettings.chunkLength }},
                overlapLength={{ detailTask.data.chunkSettings.overlapLength }},
                splitStrategy={{ detailTask.data.chunkSettings.splitStrategy }}
              </span>
            </div>
            <div class="task-meta-row" v-if="hasAnchorStats(detailTask)">
              <span class="task-meta-label">定位汇总：</span>
              <span class="task-meta-badges">
                <span class="task-chip anchor precise">精确 {{ getAnchorStats(detailTask).precise }}</span>
                <span class="task-chip anchor fallback">回退 {{ getAnchorStats(detailTask).fallback }}</span>
                <span class="task-chip anchor failed">失败 {{ getAnchorStats(detailTask).failed }}</span>
                <span class="task-chip anchor skipped">跳过 {{ getAnchorStats(detailTask).skipped }}</span>
              </span>
            </div>
            <div class="task-meta-row" v-if="hasQualityStats(detailTask)">
              <span class="task-meta-label">质量汇总：</span>
              <span class="task-meta-badges">
                <span class="task-chip quality high">高 {{ getQualityStats(detailTask).high }}</span>
                <span class="task-chip quality medium">中 {{ getQualityStats(detailTask).medium }}</span>
                <span class="task-chip quality review">复核 {{ getQualityStats(detailTask).review }}</span>
              </span>
            </div>
            <div class="task-meta-row" v-if="hasAnchorStats(detailTask)">
              <span class="task-meta-label">问题视图：</span>
              <select v-model="detailIssueFilter" class="filter-select detail-filter-select">
                <option value="all">全部问题</option>
                <option value="failed">仅定位失败</option>
                <option value="fallback">仅整句回退</option>
                <option value="risky">高风险问题</option>
                <option value="precise">仅精确命中</option>
                <option value="skipped">仅已跳过批注</option>
                <option value="review">仅建议复核</option>
                <option value="high_quality">仅高可信</option>
              </select>
            </div>
            <div v-if="detailTask.data?.items?.length" class="task-meta-row task-meta-search-row">
              <span class="task-meta-label">详情搜索：</span>
              <div class="task-meta-search-wrap">
                <div class="detail-search-scope-group">
                  <button
                    v-for="option in getDetailSearchScopeOptions()"
                    :key="option.value"
                    type="button"
                    class="detail-search-scope-btn"
                    :class="{ active: detailSearchScope === option.value }"
                    @click="detailSearchScope = option.value"
                  >{{ option.label }}</button>
                </div>
                <input
                  v-model.trim="detailSearchText"
                  type="text"
                  class="filter-input detail-search-input"
                  placeholder="搜索原片段 / 建议 / 根因 / 诊断 / 输出"
                />
                <button
                  v-if="detailSearchText"
                  type="button"
                  class="btn-mode-toggle detail-section-toggle"
                  @click="detailSearchText = ''"
                >清空</button>
                <button
                  v-if="detailSearchText && getFilteredDetailItems(detailTask).length > 0"
                  type="button"
                  class="btn-mode-toggle detail-section-toggle"
                  @click="copyDetailSearchReport(detailTask)"
                >复制搜索摘要</button>
                <button
                  v-if="detailSearchText && getFilteredDetailItems(detailTask).length > 0"
                  type="button"
                  class="btn-mode-toggle detail-section-toggle"
                  @click="downloadDetailSearchReport(detailTask)"
                >下载搜索摘要</button>
                <button
                  v-if="detailSearchText && getFilteredDetailItems(detailTask).length > 0"
                  type="button"
                  class="btn-mode-toggle detail-section-toggle"
                  @click="jumpToDetailSearchMatch(detailTask, -1)"
                >上一个</button>
                <button
                  v-if="detailSearchText && getFilteredDetailItems(detailTask).length > 0"
                  type="button"
                  class="btn-mode-toggle detail-section-toggle"
                  @click="jumpToDetailSearchMatch(detailTask, 1)"
                >下一个</button>
                <span class="task-meta-search-summary">
                  匹配 {{ getFilteredDetailItems(detailTask).length }} / {{ (detailTask.data?.items || []).length }} 段
                  <template v-if="detailSearchText && getFilteredDetailItems(detailTask).length > 0">
                    ，当前 {{ getCurrentDetailSearchPosition(detailTask) }} / {{ getFilteredDetailItems(detailTask).length }}
                  </template>
                </span>
                <span
                  v-if="detailSearchText"
                  class="task-meta-search-breakdown"
                >{{ getDetailSearchBreakdownText(detailTask) }}</span>
              </div>
            </div>
            <div
              v-if="detailSearchText && getFilteredDetailItems(detailTask).length > 0"
              class="task-meta-row task-meta-search-map-row"
            >
              <span class="task-meta-label">命中分布：</span>
              <div class="detail-search-map-wrap">
                <div class="detail-search-map-hint">
                  按整任务 {{ (detailTask.data?.items || []).length }} 个分块的序号分布展示，点击标记可直接跳转。
                </div>
                <div class="detail-search-map">
                  <div class="detail-search-map-rail"></div>
                  <div ref="detailSearchMapViewport" class="detail-search-map-viewport"></div>
                  <button
                    v-for="marker in getDetailSearchMarkers(detailTask)"
                    :key="`detail-search-marker-${marker.itemIndex}`"
                    type="button"
                    class="detail-search-map-marker"
                    :class="{ active: marker.itemIndex === detailSearchCurrentIndex }"
                    :style="{ left: `${marker.position}%` }"
                    :title="`跳转到第 ${marker.itemIndex + 1} 段（命中 ${marker.matchOrder}/${marker.totalMatches}）`"
                    @click="jumpToDetailSearchMarker(marker.itemIndex)"
                  ></button>
                </div>
                <div class="detail-search-map-meta">
                  <span>首段</span>
                  <span>末段</span>
                </div>
              </div>
            </div>
            <div v-if="detailTask.data?.items?.length" class="task-meta-row task-meta-actions">
              <span class="task-meta-label">区块操作：</span>
              <div class="task-meta-action-list">
                <button type="button" class="btn-mode-toggle detail-section-toggle" @click="expandAllDetailSections(detailTask)">一键展开全部</button>
                <button type="button" class="btn-mode-toggle detail-section-toggle" @click="collapseAllDetailSections(detailTask)">一键收起全部</button>
                <button type="button" class="btn-mode-toggle detail-section-toggle" @click="expandDiagnosticsOnlyForTask(detailTask)">仅展开全部诊断</button>
              </div>
            </div>
          </div>
          <div v-if="getTaskDetailSegments(detailTask).length" class="detail-section detail-section-card task-segment-overview">
            <div class="detail-section-label-row">
              <span class="detail-section-label">分段执行信息</span>
            </div>
            <div class="task-segment-meta-grid">
              <div class="task-segment-meta-item">
                <div class="task-segment-meta-label">总共分段</div>
                <div class="task-segment-meta-value">{{ getTaskDetailSegmentTotal(detailTask) }} 段</div>
              </div>
              <div class="task-segment-meta-item">
                <div class="task-segment-meta-label">当前执行到</div>
                <div class="task-segment-meta-value">{{ getTaskDetailCurrentSegmentLabel(detailTask) }}</div>
              </div>
              <div class="task-segment-meta-item">
                <div class="task-segment-meta-label">当前状态</div>
                <div class="task-segment-meta-value">{{ taskStatusLabel(detailTask.status) }}</div>
              </div>
            </div>
            <div class="task-segment-list">
              <div
                v-for="(segment, idx) in getTaskDetailSegments(detailTask)"
                :key="`task-segment-${detailTask.id}-${idx}`"
                class="task-segment-item"
                :class="{
                  current: isTaskDetailCurrentSegment(detailTask, idx),
                  done: segment.status === 'done',
                  pending: segment.status === 'pending'
                }"
              >
                <div class="task-segment-item-head">
                  <span class="task-segment-item-index">第 {{ idx + 1 }} 段</span>
                  <span class="task-segment-item-status">{{ getTaskDetailSegmentStatusLabel(detailTask, idx, segment) }}</span>
                </div>
                <div class="task-segment-item-text">{{ getTaskDetailSegmentText(segment) }}</div>
              </div>
            </div>
          </div>
          <div v-if="isBatchApplyPreviewOpen(detailTask.id)" class="batch-apply-panel">
            <div class="batch-apply-header">
              <div>
                <div class="batch-apply-title">批量写入预览</div>
                <div class="batch-apply-subtitle">
                  共 {{ getSkippedIssueEntries(detailTask).length }} 条跳过项，当前筛选 {{ getFilteredBatchApplyEntries(detailTask).length }} 条，已选 {{ getSelectedBatchApplyCount(detailTask.id) }} 条
                </div>
              </div>
              <div class="batch-apply-actions">
                <button type="button" class="btn-copy-diagnostic" @click="selectAllBatchApply(detailTask.id)">全选当前筛选</button>
                <button type="button" class="btn-copy-diagnostic" @click="clearBatchApplySelection()">清空</button>
                <button
                  type="button"
                  class="btn-apply-comment"
                  :disabled="isApplyingSkippedTask(detailTask.id) || getSelectedBatchApplyCount(detailTask.id) <= 0"
                  @click="applySkippedComments(detailTask.id)"
                >{{ isApplyingSkippedTask(detailTask.id) ? '批量写入中...' : `写入选中项（${getSelectedBatchApplyCount(detailTask.id)}）` }}</button>
                <button type="button" class="btn-mode-toggle" @click="closeBatchApplyPreview">收起</button>
              </div>
            </div>
            <div class="batch-apply-filters">
              <select v-model="batchApplyQuickFilter" class="filter-select detail-filter-select">
                <option value="all">全部跳过项</option>
                <option value="with_suggestion">仅有明确建议</option>
                <option value="exclude_punctuation">排除纯标点</option>
              </select>
              <select v-model="batchApplyReasonFilter" class="filter-select detail-filter-select">
                <option value="all">全部原因</option>
                <option
                  v-for="reason in getBatchApplyReasonOptions(detailTask)"
                  :key="reason"
                  :value="reason"
                >{{ reason }}</option>
              </select>
              <input
                v-model.trim="batchApplySearchText"
                type="text"
                class="search-input batch-apply-search"
                placeholder="搜索原片段 / 建议 / 整句"
              />
            </div>
            <div class="batch-apply-list">
              <div
                v-for="group in getBatchApplyGroups(detailTask)"
                :key="`batch-group-${group.itemIndex}`"
                class="batch-apply-group"
              >
                <div class="batch-apply-group-header">
                  <label class="batch-apply-group-select">
                    <input
                      type="checkbox"
                      :checked="isBatchApplyGroupFullySelected(detailTask.id, group)"
                      @change="toggleBatchApplyGroupSelection(detailTask.id, group, $event.target.checked)"
                    />
                    <span class="batch-apply-group-title">第 {{ group.itemIndex + 1 }} 段</span>
                    <span class="batch-apply-group-count">{{ group.entries.length }} 条</span>
                  </label>
                  <button
                    type="button"
                    class="btn-mode-toggle"
                    @click="toggleBatchApplyGroup(detailTask.id, group.itemIndex)"
                  >{{ isBatchApplyGroupCollapsed(detailTask.id, group.itemIndex) ? '展开' : '折叠' }}</button>
                </div>
                <div v-if="!isBatchApplyGroupCollapsed(detailTask.id, group.itemIndex)" class="batch-apply-group-list">
                  <label
                    v-for="entry in group.entries"
                    :key="`batch-${entry.itemIndex}-${entry.issueIndex}`"
                    class="batch-apply-item"
                  >
                    <input
                      type="checkbox"
                      :checked="isBatchApplySelected(detailTask.id, entry.itemIndex, entry.issueIndex)"
                      @change="toggleBatchApplySelection(detailTask.id, entry.itemIndex, entry.issueIndex, $event.target.checked)"
                    />
                    <div class="batch-apply-item-main">
                      <div class="batch-apply-item-head">
                        <span class="batch-apply-item-index">问题 {{ entry.issueIndex + 1 }}</span>
                        <span v-if="entry.reason" class="task-chip cause warning">{{ entry.reason }}</span>
                        <span v-if="entry.qualityLabel" class="task-chip quality review">{{ entry.qualityLabel }}</span>
                      </div>
                      <div class="batch-apply-item-text">
                        <code>{{ entry.text || '（空）' }}</code>
                        <span v-if="entry.suggestion"> -> </span>
                        <code v-if="entry.suggestion">{{ entry.suggestion }}</code>
                      </div>
                      <div v-if="entry.sentence" class="batch-apply-item-sentence">{{ entry.sentence }}</div>
                    </div>
                  </label>
                </div>
              </div>
              <div v-if="getFilteredBatchApplyEntries(detailTask).length === 0" class="detail-empty-inline">
                当前筛选条件下没有可写入的跳过项
              </div>
            </div>
          </div>
          <div
            v-for="{ item, idx } in detailTaskDetailItemsFiltered"
            :key="`detail-item-${detailTask.id}-${idx}`"
            :ref="el => setDetailItemRef(idx, el)"
            class="detail-item"
            :class="{
              'search-current': detailSearchText && detailSearchCurrentIndex === idx,
              'search-flash': detailSearchText && detailSearchFlashIndex === idx
            }"
          >
            <div class="detail-item-header">
              <span class="detail-item-title">第 {{ idx + 1 }} 段</span>
              <span v-if="item.commentCount != null" class="detail-item-meta">批注 {{ item.commentCount }} 处</span>
              <button
                v-if="item.diagnostic"
                type="button"
                class="btn-mode-toggle detail-section-toggle detail-item-inline-action"
                @click="expandDiagnosticsOnlyForItem(detailTask.id, idx)"
              >仅展开诊断</button>
            </div>
            <div v-if="item.diagnostic?.rootCauseLabel" class="detail-cause-row">
              <span class="cause-badge" :class="causeClass(item.diagnostic)">{{ item.diagnostic.rootCauseLabel }}</span>
              <span v-if="item.diagnostic?.rootCauseSummary" class="cause-summary" v-html="highlightDetailText(item.diagnostic.rootCauseSummary, 'diagnostic')"></span>
            </div>
            <div v-if="item.diagnostic?.strategyTrace?.length" class="strategy-row">
              <span class="strategy-label">修复路径：</span>
              <span
                v-for="step in item.diagnostic.strategyTrace"
                :key="step"
                class="strategy-badge"
              >{{ strategyLabel(step) }}</span>
            </div>
            <div class="detail-item-main-grid">
              <div class="detail-section detail-section-card">
                <div class="detail-section-label-row">
                  <span class="detail-section-label">请求参数（发给大模型的完整 JSON）</span>
                  <div class="detail-section-controls">
                    <button
                      type="button"
                      class="btn-mode-toggle"
                      @click="toggleRequestMode(detailTask.id, idx)"
                    >{{ isRequestEditMode(detailTask.id, idx) ? '树形视图' : '编辑' }}</button>
                    <button
                      type="button"
                      class="btn-mode-toggle detail-section-toggle"
                      @click="toggleDetailSection(detailTask.id, idx, 'request')"
                    >{{ isDetailSectionCollapsed(detailTask.id, idx, 'request') ? '展开' : '收起' }}</button>
                  </div>
                </div>
                <template v-if="!isDetailSectionCollapsed(detailTask.id, idx, 'request')">
                <div v-if="isRequestEditMode(detailTask.id, idx)" class="json-edit-wrap">
                  <textarea
                    class="detail-section-content input-box"
                    :value="getRequestJson(detailTask.id, idx, item)"
                    @input="setRequestJson(detailTask.id, idx, $event.target.value)"
                    spellcheck="false"
                  ></textarea>
                </div>
                <div v-else class="json-tree-wrap">
                  <JsonViewer
                    v-if="getRequestParsed(detailTask.id, idx, item)"
                    :value="getRequestParsed(detailTask.id, idx, item)"
                    :expand-depth="2"
                    theme="light"
                    sort
                    boxed
                    class="json-viewer-custom"
                  />
                  <pre v-else class="detail-section-content input-box" v-html="highlightDetailText(getRequestJson(detailTask.id, idx, item), 'request')"></pre>
                </div>
                </template>
              </div>
              <div class="detail-section detail-section-card detail-section-toolbar">
                <div class="detail-section-label">操作与排障</div>
                <div class="retry-row">
                  <button
                    type="button"
                    class="btn-retry"
                    :disabled="retryingIndex === idx"
                    @click="retryChunk(detailTask.id, idx)"
                  >{{ retryingIndex === idx ? '重试中...' : '重试' }}</button>
                  <button
                    v-if="item.diagnostic || item.error || item.parseError"
                    type="button"
                    class="btn-copy-diagnostic"
                    @click="copyDiagnostic(item)"
                  >复制排障信息</button>
                </div>
              </div>
              <div class="detail-section detail-section-card">
                <div class="detail-section-label-row">
                  <span class="detail-section-label">输出（大模型返回内容）</span>
                  <div class="detail-section-controls">
                    <button
                      v-if="getOutputParsed(item)"
                      type="button"
                      class="btn-mode-toggle"
                      @click="toggleOutputMode(detailTask.id, idx)"
                    >{{ isOutputTreeMode(detailTask.id, idx) ? '原始文本' : '树形视图' }}</button>
                    <button
                      type="button"
                      class="btn-mode-toggle detail-section-toggle"
                      @click="toggleDetailSection(detailTask.id, idx, 'output')"
                    >{{ isDetailSectionCollapsed(detailTask.id, idx, 'output') ? '展开' : '收起' }}</button>
                  </div>
                </div>
                <template v-if="!isDetailSectionCollapsed(detailTask.id, idx, 'output')">
                <div v-if="isOutputTreeMode(detailTask.id, idx) && getOutputParsed(item)" class="json-tree-wrap">
                  <JsonViewer
                    :value="getOutputParsed(item)"
                    :expand-depth="2"
                    theme="light"
                    sort
                    boxed
                    class="json-viewer-custom"
                  />
                </div>
                <pre v-else class="detail-section-content output-box" v-html="highlightDetailText(formatOutput(item), 'output')"></pre>
                </template>
              </div>
              <div v-if="item.parsedOutput || item.parseError" class="detail-section detail-section-card">
                <div class="detail-section-label-row">
                  <span class="detail-section-label">解析结果（结构化输出）</span>
                  <button
                    type="button"
                    class="btn-mode-toggle detail-section-toggle"
                    @click="toggleDetailSection(detailTask.id, idx, 'parsed')"
                  >{{ isDetailSectionCollapsed(detailTask.id, idx, 'parsed') ? '展开' : '收起' }}</button>
                </div>
                <template v-if="!isDetailSectionCollapsed(detailTask.id, idx, 'parsed')">
                <div v-if="getParsedResultObject(item)" class="json-tree-wrap">
                  <JsonViewer
                    :value="getParsedResultObject(item)"
                    :expand-depth="2"
                    theme="light"
                    sort
                    boxed
                    class="json-viewer-custom"
                  />
                </div>
                <pre v-else class="detail-section-content output-box" v-html="highlightDetailText(formatParsedOutput(item), 'output')"></pre>
                </template>
              </div>
              <div v-if="item.repairRequest" class="detail-section detail-section-card">
                <div class="detail-section-label-row">
                  <span class="detail-section-label">结构化修复请求</span>
                  <button
                    type="button"
                    class="btn-mode-toggle detail-section-toggle"
                    @click="toggleDetailSection(detailTask.id, idx, 'repair')"
                  >{{ isDetailSectionCollapsed(detailTask.id, idx, 'repair') ? '展开' : '收起' }}</button>
                </div>
                <pre
                  v-if="!isDetailSectionCollapsed(detailTask.id, idx, 'repair')"
                  class="detail-section-content output-box"
                  v-html="highlightDetailText(formatJson(item.repairRequest), 'diagnostic')"
                ></pre>
              </div>
              <div v-if="item.diagnostic" class="detail-section detail-section-card detail-section-diagnostic">
                <div class="detail-section-label-row">
                  <span class="detail-section-label">诊断信息</span>
                  <button
                    type="button"
                    class="btn-mode-toggle detail-section-toggle"
                    @click="toggleDetailSection(detailTask.id, idx, 'diagnostic')"
                  >{{ isDetailSectionCollapsed(detailTask.id, idx, 'diagnostic') ? '展开' : '收起' }}</button>
                </div>
                <template v-if="!isDetailSectionCollapsed(detailTask.id, idx, 'diagnostic')">
                <div v-if="getDiagnosticObject(item)" class="json-tree-wrap">
                  <JsonViewer
                    :value="getDiagnosticObject(item)"
                    :expand-depth="2"
                    theme="light"
                    sort
                    boxed
                    class="json-viewer-custom"
                  />
                </div>
                <pre v-else class="detail-section-content output-box" v-html="highlightDetailText(formatDiagnostic(item), 'diagnostic')"></pre>
                </template>
              </div>
            </div>
            <div v-if="item.parsedItems?.length" class="detail-section detail-section-card detail-section-full detail-section-issues">
              <div class="detail-section-label-row">
                <span class="detail-section-label">问题锚点（用于定位排查）</span>
                <button
                  type="button"
                  class="btn-mode-toggle detail-section-toggle"
                  @click="toggleDetailSection(detailTask.id, idx, 'issues')"
                >{{ isDetailSectionCollapsed(detailTask.id, idx, 'issues') ? '展开' : '收起' }}</button>
              </div>
              <template v-if="!isDetailSectionCollapsed(detailTask.id, idx, 'issues')">
              <div v-if="getFilteredIssues(item).length" class="issue-anchor-list">
                <div
                  v-for="(issue, issueIdx) in getFilteredIssues(item)"
                  :key="`${idx}-${issueIdx}`"
                  class="issue-anchor-card"
                >
                  <div class="issue-anchor-header">
                    <span class="issue-anchor-index">问题 {{ issueIdx + 1 }}</span>
                    <div class="issue-anchor-badges">
                      <span class="issue-anchor-type">{{ issue.reason || '未分类' }}</span>
                      <span
                        v-if="issue.qualityLabel"
                        class="issue-quality-badge"
                        :class="issue.qualityLevel || 'medium'"
                      >{{ issue.qualityLabel }}</span>
                      <span
                        v-if="issue.anchorStatus"
                        class="issue-anchor-status"
                        :class="issue.anchorStatus"
                      >{{ anchorStatusLabel(issue) }}</span>
                      <span
                        v-if="issue.anchorStatus === 'success' && issue.anchorReasonCode"
                        class="issue-anchor-mode"
                        :class="anchorModeClass(issue)"
                      >{{ anchorModeLabel(issue) }}</span>
                    </div>
                  </div>
                  <div class="issue-anchor-row">
                    <span class="issue-anchor-label">原片段</span>
                    <code class="issue-anchor-code" v-html="highlightDetailText(issue.text || '（空）', 'issues')"></code>
                  </div>
                  <div class="issue-anchor-row" v-if="issue.suggestion">
                    <span class="issue-anchor-label">建议</span>
                    <code class="issue-anchor-code" v-html="highlightDetailText(issue.suggestion, 'issues')"></code>
                  </div>
                  <div class="issue-anchor-row" v-if="issue.sentence">
                    <span class="issue-anchor-label">整句</span>
                    <div class="issue-anchor-block" v-html="highlightDetailText(issue.sentence, 'issues')"></div>
                  </div>
                  <div class="issue-anchor-row" v-if="issue.prefix || issue.suffix">
                    <span class="issue-anchor-label">上下文</span>
                    <div class="issue-anchor-inline">
                      <span class="issue-anchor-context">{{ issue.prefix || '' }}</span>
                      <code class="issue-anchor-hit">{{ issue.text || '' }}</code>
                      <span class="issue-anchor-context">{{ issue.suffix || '' }}</span>
                    </div>
                  </div>
                  <div class="issue-anchor-row" v-if="issue.anchorReasonLabel">
                    <span class="issue-anchor-label">定位结果</span>
                    <div class="issue-anchor-result" :class="issue.anchorStatus || 'failed'">
                      {{ issue.anchorReasonLabel }}
                    </div>
                  </div>
                  <div class="issue-anchor-row" v-if="issue.qualityReason">
                    <span class="issue-anchor-label">质量说明</span>
                    <div class="issue-anchor-quality-note" v-html="highlightDetailText(issue.qualityReason, 'issues')"></div>
                  </div>
                  <div v-if="canApplyIssueComment(issue)" class="issue-anchor-actions">
                    <button
                      type="button"
                      class="btn-apply-comment"
                      :disabled="isApplyingIssue(detailTask.id, idx, getIssueOriginalIndex(item, issue))"
                      @click="applyIssueComment(detailTask.id, idx, getIssueOriginalIndex(item, issue))"
                    >{{ isApplyingIssue(detailTask.id, idx, getIssueOriginalIndex(item, issue)) ? '写入中...' : '写入批注' }}</button>
                  </div>
                </div>
              </div>
              <div v-else class="detail-empty-inline">当前筛选条件下无匹配问题</div>
              </template>
            </div>
          </div>
          <div
            v-if="detailTask.data?.items?.length && getFilteredDetailItems(detailTask).length === 0"
            class="detail-empty-inline detail-search-empty"
          >
            当前搜索条件下没有匹配的分块结果
          </div>
          <div v-if="!detailTask.data?.items?.length" class="detail-empty">
            <div v-if="hasGenericTaskRecord(detailTask)" class="generic-task-detail">
              <div v-if="shouldShowGenericSummary(detailTask)" class="generic-summary-card">
                <div class="generic-summary-title">结论摘要</div>
                <div v-if="getGenericTaskCommentPreview(detailTask)" class="generic-summary-row">
                  <span class="generic-summary-label">文档写入</span>
                  <div class="generic-summary-value">{{ getGenericTaskCommentPreview(detailTask) }}</div>
                </div>
                <div v-if="getGenericTaskConclusion(detailTask)" class="generic-summary-row">
                  <span class="generic-summary-label">任务结论</span>
                  <div class="generic-summary-value">{{ getGenericTaskConclusion(detailTask) }}</div>
                </div>
                <div v-if="getGenericTaskRiskHint(detailTask)" class="generic-summary-row">
                  <span class="generic-summary-label">重点提示</span>
                  <div class="generic-summary-value risk">{{ getGenericTaskRiskHint(detailTask) }}</div>
                </div>
                <div v-if="getGenericTaskKeywords(detailTask)" class="generic-summary-row">
                  <span class="generic-summary-label">可疑关键词</span>
                  <div class="generic-summary-value">{{ getGenericTaskKeywords(detailTask) }}</div>
                </div>
              </div>
              <div v-if="hasGenericTaskMetadata(detailTask)" class="generic-meta-grid">
                <div v-if="detailTask.data?.entry" class="generic-meta-item">
                  <div class="generic-meta-label">入口</div>
                  <div class="generic-meta-value">{{ formatTaskEntry(detailTask.data.entry) }}</div>
                </div>
                <div v-if="detailTask.data?.primaryIntent" class="generic-meta-item">
                  <div class="generic-meta-label">主意图</div>
                  <div class="generic-meta-value">{{ formatPrimaryIntent(detailTask.data.primaryIntent) }}</div>
                </div>
                <div v-if="detailTask.data?.executionMode" class="generic-meta-item">
                  <div class="generic-meta-label">执行模式</div>
                  <div class="generic-meta-value">{{ formatExecutionMode(detailTask.data.executionMode) }}</div>
                </div>
                <div v-if="detailTask.data?.taskPhase" class="generic-meta-item">
                  <div class="generic-meta-label">任务阶段</div>
                  <div class="generic-meta-value">{{ formatTaskPhase(detailTask.data.taskPhase) }}</div>
                </div>
                <div v-if="detailTask.data?.modelDisplayName" class="generic-meta-item">
                  <div class="generic-meta-label">最终模型</div>
                  <div class="generic-meta-value">{{ detailTask.data.modelDisplayName }}（{{ detailTask.data.modelProviderId || '未知提供商' }}）</div>
                </div>
                <div v-if="getRecommendationModelSourceLabel(detailTask)" class="generic-meta-item">
                  <div class="generic-meta-label">推荐模型来源</div>
                  <div class="generic-meta-value">{{ getRecommendationModelSourceLabel(detailTask) }}</div>
                </div>
                <div v-if="detailTask.data?.modelSource" class="generic-meta-item">
                  <div class="generic-meta-label">模型来源</div>
                  <div class="generic-meta-value">{{ formatModelSource(detailTask.data?.modelSource) }}</div>
                </div>
                <div v-if="detailTask.data?.configuredInputSource" class="generic-meta-item">
                  <div class="generic-meta-label">配置输入来源</div>
                  <div class="generic-meta-value">{{ formatInputSource(detailTask.data?.configuredInputSource) }}</div>
                </div>
                <div v-if="detailTask.data?.inputSource" class="generic-meta-item">
                  <div class="generic-meta-label">实际输入来源</div>
                  <div class="generic-meta-value">{{ formatChunkSource(detailTask.data?.inputSource) }}</div>
                </div>
                <div v-if="detailTask.data?.documentAction" class="generic-meta-item">
                  <div class="generic-meta-label">文档动作</div>
                  <div class="generic-meta-value">{{ formatDocumentAction(detailTask.data?.documentAction) }}</div>
                </div>
                <div v-if="detailTask.data?.launchSource" class="generic-meta-item">
                  <div class="generic-meta-label">执行入口</div>
                  <div class="generic-meta-value">{{ formatLaunchSource(detailTask.data?.launchSource) }}</div>
                </div>
                <div v-if="detailTask.data?.entry" class="generic-meta-item">
                  <div class="generic-meta-label">统一入口</div>
                  <div class="generic-meta-value">{{ formatTaskEntry(detailTask.data?.entry) }}</div>
                </div>
                <div v-if="detailTask.data?.primaryIntent" class="generic-meta-item">
                  <div class="generic-meta-label">主意图</div>
                  <div class="generic-meta-value">{{ formatPrimaryIntent(detailTask.data?.primaryIntent) }}</div>
                </div>
                <div v-if="detailTask.data?.executionMode" class="generic-meta-item">
                  <div class="generic-meta-label">执行模式</div>
                  <div class="generic-meta-value">{{ formatExecutionMode(detailTask.data?.executionMode) }}</div>
                </div>
                <div v-if="detailTask.data?.taskPhase" class="generic-meta-item">
                  <div class="generic-meta-label">任务阶段</div>
                  <div class="generic-meta-value">{{ formatTaskPhase(detailTask.data?.taskPhase) }}</div>
                </div>
                <div v-if="detailTask.data?.strictAssistantDefaults === true" class="generic-meta-item">
                  <div class="generic-meta-label">严格默认策略</div>
                  <div class="generic-meta-value">已启用</div>
                </div>
                <div v-if="detailTask.data?.reportSettings?.enabled" class="generic-meta-item">
                  <div class="generic-meta-label">输出报告</div>
                  <div class="generic-meta-value">已启用</div>
                </div>
                <div v-if="getTaskReportTypeLabel(detailTask)" class="generic-meta-item">
                  <div class="generic-meta-label">报告类型</div>
                  <div class="generic-meta-value">{{ getTaskReportTypeLabel(detailTask) }}</div>
                </div>
                <div v-if="detailTask.data?.targetLanguage" class="generic-meta-item">
                  <div class="generic-meta-label">目标语言</div>
                  <div class="generic-meta-value">{{ detailTask.data.targetLanguage }}</div>
                </div>
                <div v-if="detailTask.data?.outputFormat" class="generic-meta-item">
                  <div class="generic-meta-label">输出格式</div>
                  <div class="generic-meta-value">{{ detailTask.data.outputFormat }}</div>
                </div>
                <div v-if="detailTask.data?.temperature != null" class="generic-meta-item">
                  <div class="generic-meta-label">温度</div>
                  <div class="generic-meta-value">{{ detailTask.data.temperature }}</div>
                </div>
                <div v-if="detailTask.data?.generatedMediaKind" class="generic-meta-item">
                  <div class="generic-meta-label">生成媒体</div>
                  <div class="generic-meta-value">{{ detailTask.data.generatedMediaKind }}</div>
                </div>
                <div v-if="detailTask.data?.generatedMediaPath" class="generic-meta-item">
                  <div class="generic-meta-label">文件位置</div>
                  <div class="generic-meta-value">{{ detailTask.data.generatedMediaPath }}</div>
                </div>
                <div v-if="detailTask.data?.generatedFileName" class="generic-meta-item">
                  <div class="generic-meta-label">文件名</div>
                  <div class="generic-meta-value">{{ detailTask.data.generatedFileName }}</div>
                </div>
                <div v-if="detailTask.data?.generatedMediaMimeType" class="generic-meta-item">
                  <div class="generic-meta-label">媒体类型</div>
                  <div class="generic-meta-value">{{ detailTask.data.generatedMediaMimeType }}</div>
                </div>
                <div v-if="detailTask.data?.sourceScope" class="generic-meta-item">
                  <div class="generic-meta-label">处理范围</div>
                  <div class="generic-meta-value">
                    {{ detailTask.data.sourceScope === 'document' ? '全文' : detailTask.data.sourceScope === 'selection' ? '当前选中内容' : '当前请求或附件' }}
                  </div>
                </div>
                <div v-if="detailTask.data?.mediaOptions?.aspectRatio" class="generic-meta-item">
                  <div class="generic-meta-label">画幅比例</div>
                  <div class="generic-meta-value">{{ detailTask.data.mediaOptions.aspectRatio }}</div>
                </div>
                <div v-if="detailTask.data?.mediaOptions?.duration" class="generic-meta-item">
                  <div class="generic-meta-label">视频时长</div>
                  <div class="generic-meta-value">{{ detailTask.data.mediaOptions.duration }}</div>
                </div>
                <div v-if="detailTask.data?.mediaOptions?.voiceStyle" class="generic-meta-item">
                  <div class="generic-meta-label">语音风格</div>
                  <div class="generic-meta-value">{{ detailTask.data.mediaOptions.voiceStyle }}</div>
                </div>
                <div v-if="detailTask.data?.relatedTaskId" class="generic-meta-item">
                  <div class="generic-meta-label">关联任务</div>
                  <div class="generic-meta-value">
                    <button type="button" class="linked-task-btn" @click="openLinkedTaskDetail(detailTask.data.relatedTaskId)">
                      {{ detailTask.data.relatedTaskId }}
                    </button>
                  </div>
                </div>
              </div>
              <div v-if="getSecretKeywordEntries(detailTask).length > 0" class="detail-section">
                <div class="detail-section-label">涉密关键词列表（共 {{ getSecretKeywordEntries(detailTask).length }} 项）</div>
                <div class="secret-keyword-table-wrap">
                  <table class="secret-keyword-table">
                    <thead>
                      <tr>
                        <th>序号</th>
                        <th>原文关键词</th>
                        <th>占位符</th>
                        <th>分类</th>
                        <th>风险</th>
                        <th>脱密原因</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(kw, kwIdx) in getSecretKeywordEntries(detailTask)" :key="kwIdx">
                        <td>{{ kwIdx + 1 }}</td>
                        <td><code class="kw-term">{{ kw.term || '-' }}</code></td>
                        <td><code class="kw-token">{{ kw.replacementToken || '-' }}</code></td>
                        <td>{{ kw.category || '-' }}</td>
                        <td><span class="risk-badge" :class="kw.riskLevel || 'low'">{{ kw.riskLevel || 'low' }}</span></td>
                        <td class="kw-reason">{{ kw.reason || '-' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div v-if="getFormAuditIssueGroups(detailTask).length > 0" class="detail-section">
                <div class="detail-section-label">按字段分组问题：</div>
                <div class="audit-group-list">
                  <div v-for="group in getFormAuditIssueGroups(detailTask)" :key="group.key" class="audit-group-card">
                    <div class="audit-group-title-row">
                      <div class="audit-group-title">{{ group.fieldName }}</div>
                      <div class="audit-group-count">问题 {{ group.items.length }}</div>
                    </div>
                    <div v-for="(issue, idx) in group.items" :key="`${group.key}-${idx}`" class="audit-group-issue">
                      <div class="audit-group-issue-row">
                        <span class="audit-issue-badge" :class="issue.riskLevel">{{ issue.riskLevel }}</span>
                        <span>{{ issue.issueType || '-' }}</span>
                      </div>
                      <div class="audit-group-issue-row">字段值：{{ issue.instanceValue || '-' }}</div>
                      <div class="audit-group-issue-row">依据：{{ issue.reason || '-' }}</div>
                      <div class="audit-group-issue-row">建议：{{ issue.suggestion || '-' }}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="detailTask.data?.promptVariables" class="detail-section">
                <div class="detail-section-label">变量值：</div>
                <pre class="detail-section-content output-box">{{ formatJson(detailTask.data.promptVariables) }}</pre>
              </div>
              <div v-if="detailTask.data?.recommendedConfig" class="detail-section">
                <div class="detail-section-label">推荐设置：</div>
                <pre class="detail-section-content output-box">{{ formatJson(detailTask.data.recommendedConfig) }}</pre>
              </div>
              <div v-if="detailTask.data?.inputPreview" class="detail-section">
                <div class="detail-section-label">输入预览：</div>
                <pre class="detail-section-content output-box">{{ detailTask.data.inputPreview }}</pre>
              </div>
              <div v-if="getTaskPreviewBlocks(detailTask).length > 0" class="detail-section">
                <div class="detail-section-label">预览前后对比：</div>
                <div class="task-segment-list">
                  <div v-for="block in getTaskPreviewBlocks(detailTask)" :key="block.id || block.title" class="task-segment-item done">
                    <div class="task-segment-item-head">
                      <span class="task-segment-item-index">{{ block.title || '预览块' }}</span>
                      <span class="task-segment-status">{{ block.qualityLevel || '预览' }}</span>
                    </div>
                    <div class="task-segment-text">原文：{{ block.inputText || '（空）' }}</div>
                    <div class="task-segment-text">结果：{{ block.outputText || '（空）' }}</div>
                  </div>
                </div>
              </div>
              <div v-if="getTaskWriteTargets(detailTask).length > 0" class="detail-section">
                <div class="detail-section-label">定位结果列表：</div>
                <pre class="detail-section-content output-box">{{ formatJson(getTaskWriteTargets(detailTask)) }}</pre>
              </div>
              <div v-if="getTaskGeneratedArtifacts(detailTask).length > 0" class="detail-section">
                <div class="detail-section-label">生成附件：</div>
                <pre class="detail-section-content output-box">{{ formatJson(getTaskGeneratedArtifacts(detailTask)) }}</pre>
              </div>
              <div v-if="getStructuredExecutionSummary(detailTask)" class="detail-section">
                <div class="detail-section-label">结构化执行摘要：</div>
                <pre class="detail-section-content output-box">{{ formatJson(getStructuredExecutionSummary(detailTask)) }}</pre>
              </div>
              <div v-if="getStructuredExecutionBlocks(detailTask).length > 0" class="detail-section">
                <div class="detail-section-label">结构化块定位信息：</div>
                <pre class="detail-section-content output-box">{{ formatJson(getStructuredExecutionBlocks(detailTask)) }}</pre>
              </div>
              <div v-if="getStructuredOperationValidation(detailTask).length > 0" class="detail-section">
                <div class="detail-section-label">结构化操作校验：</div>
                <pre class="detail-section-content output-box">{{ formatJson(getStructuredOperationValidation(detailTask)) }}</pre>
              </div>
              <div v-if="getStructuredRejectedOperations(detailTask).length > 0" class="detail-section">
                <div class="detail-section-label">结构化冲突淘汰操作：</div>
                <pre class="detail-section-content output-box">{{ formatJson(getStructuredRejectedOperations(detailTask)) }}</pre>
              </div>
              <div v-if="detailTask.data?.structuredTaskSnapshot" class="detail-section">
                <div class="detail-section-label">结构化任务快照：</div>
                <pre class="detail-section-content output-box">{{ formatJson(detailTask.data.structuredTaskSnapshot) }}</pre>
              </div>
              <div v-if="detailTask.data?.renderedSystemPrompt" class="detail-section">
                <div class="detail-section-label">系统提示词：</div>
                <pre class="detail-section-content output-box">{{ detailTask.data.renderedSystemPrompt }}</pre>
              </div>
              <div v-if="detailTask.data?.renderedUserPrompt" class="detail-section">
                <div class="detail-section-label">用户提示词：</div>
                <pre class="detail-section-content output-box">{{ detailTask.data.renderedUserPrompt }}</pre>
              </div>
              <div v-if="detailTask.data?.reportSettings?.template" class="detail-section">
                <div class="detail-section-label">报告格式：</div>
                <pre class="detail-section-content output-box">{{ detailTask.data.reportSettings.template }}</pre>
              </div>
              <div v-if="detailTask.data?.reportSettings?.prompt" class="detail-section">
                <div class="detail-section-label">报告提示词：</div>
                <pre class="detail-section-content output-box">{{ detailTask.data.reportSettings.prompt }}</pre>
              </div>
              <div v-if="detailTask.data?.fullOutput" class="detail-section">
                <div class="detail-section-label">输出结果：</div>
                <pre class="detail-section-content output-box">{{ detailTask.data.fullOutput }}</pre>
              </div>
              <div v-if="detailTask.data?.errorDetail" class="detail-section">
                <div class="detail-section-label">错误详情：</div>
                <pre class="detail-section-content output-box">{{ formatJson(detailTask.data.errorDetail) }}</pre>
              </div>
              <div v-if="detailTask.data?.errorDetail?.suggestion" class="detail-row">
                排障建议：{{ detailTask.data.errorDetail.suggestion }}
              </div>
              <div v-if="detailTask.data?.applyResult?.message" class="detail-row">
                文档动作：{{ detailTask.data.applyResult.message }}
              </div>
            </div>
            <span v-else>暂无输入输出记录</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { JsonViewer } from 'vue3-json-viewer'
import 'vue3-json-viewer/dist/vue3-json-viewer.css'
import { subscribe, getTasks, clearCompletedTasks, initSync, getTaskById, removeTask, syncTasksFromStorage, updateTask } from '../utils/taskListStore.js'
import { retrySpellCheckChunk, stopSpellCheckTask, applySpellCheckIssueComment, applySkippedSpellCheckComments } from '../utils/spellCheckService.js'
import { stopAssistantTask } from '../utils/assistantTaskRunner.js'
import { stopAssistantPromptRecommendationTask } from '../utils/assistantPromptRecommendationService.js'
import { stopFormAuditTask } from '../utils/formAuditService.js'
import { stopWorkflowRun } from '../utils/workflowRunner.js'
import { stopMultimodalTask } from '../utils/multimodalTaskRunner.js'
import { stopWpsCapabilityTask } from '../utils/wpsCapabilityExecutor.js'
import { dispatchAssistantRecommendationApplyRequest } from '../utils/assistantRecommendationApplyBridge.js'
import { openSettingsWindow } from '../utils/settingsWindowManager.js'
import { createTaskListWindowSession } from '../utils/taskListWindowManager.js'
import { INPUT_SOURCE_OPTIONS, DOCUMENT_ACTION_OPTIONS } from '../utils/assistantRegistry.js'
import { getReportTypeLabel, normalizeReportSettings } from '../utils/reportSettings.js'
import { reportError } from '../utils/reportError.js'

const BATCH_APPLY_UI_STATE_KEY = 'NdSpellCheckBatchApplyUiState'
const TASK_LIST_UI_STATE_KEY = 'NdTaskListUiState'

export default {
  name: 'TaskListPopup',
  components: { JsonViewer },
  data() {
    return {
      tasks: [],
      expandedId: null,
      detailTask: null,
      retryingIndex: -1,
      applyingIssueKey: '',
      applyingSkippedTaskId: '',
      batchApplyPreviewTaskId: '',
      batchApplySelection: {},
      batchApplyCollapsedGroups: {},
      batchApplyQuickFilter: 'all',
      batchApplyReasonFilter: 'all',
      batchApplySearchText: '',
      editedRequests: {}, // key: `${taskId}-${itemIdx}` -> 编辑后的 JSON 字符串
      requestEditMode: {}, // key: `${taskId}-${itemIdx}` -> true=编辑, false=树形
      outputTreeMode: {}, // key: `${taskId}-${itemIdx}` -> true=树形, false=原始
      detailSectionCollapsed: {},
      detailSearchText: '',
      detailSearchScope: 'all',
      detailSearchCurrentIndex: -1,
      detailSearchFlashIndex: -1,
      detailSearchFlashTimer: null,
      detailScrollTopByTask: {},
      detailScrollSaveTimer: null,
      searchText: '',
      statusFilter: 'all',
      sourceFilter: 'all',
      causeFilter: 'all',
      resultFilter: 'all',
      riskFilter: 'all',
      overviewScope: 'all',
      anchorFilter: 'all',
      detailIssueFilter: 'all',
      sortBy: 'updated_desc',
      pendingDetailTaskId: '',
      taskListWindowSession: null,
      suppressRouteDetailTaskId: '',
      /** requestAnimationFrame id，用于详情「命中分布」视口条，避免与 updated 递归 */
      detailViewportRafId: null
    }
  },
  created() {
    /** 详情分段 DOM，非响应式；勿放 data，避免 :ref 回调写响应式触发「递归更新」 */
    this._detailItemEls = Object.create(null)
  },
  computed: {
    topLevelTasks() {
      return this.tasks.filter(task => !this.isWorkflowChildTask(task))
    },
    hasCompletedTasks() {
      return this.topLevelTasks.some(t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled' || t.status === 'abnormal')
    },
    hasFailedTasks() {
      return this.topLevelTasks.some(t => t.status === 'failed' || t.status === 'abnormal')
    },
    availableCauseOptions() {
      const set = new Set()
      for (const task of this.topLevelTasks) {
        const label = this.getTaskCauseLabel(task)
        if (label) set.add(label)
      }
      return [...set]
    },
    availableGenericBadgeOptions() {
      const set = new Set()
      for (const task of this.topLevelTasks) {
        const badge = this.getGenericTaskBadge(task)
        if (badge) set.add(badge)
      }
      return [...set]
    },
    hasSecurityTasks() {
      return this.topLevelTasks.some(task => this.getTaskAssistantId(task) === 'analysis.security-check')
    },
    securityOverview() {
      const sourceTasks = this.overviewScope === 'filtered' ? this.filteredTasks : this.topLevelTasks
      const summary = {
        highRiskTasks: 0,
        mediumRiskTasks: 0,
        keywordHitTasks: 0,
        cleanTasks: 0,
        latestSecurityCheckAt: ''
      }
      let latestTask = null
      for (const task of sourceTasks) {
        if (this.getTaskAssistantId(task) !== 'analysis.security-check') continue
        const counts = this.getSecurityRiskCounts(task)
        const keywordCount = this.getSecurityKeywordCount(task)
        const badge = this.getGenericTaskBadge(task)
        if (counts.high > 0) summary.highRiskTasks++
        if (counts.medium > 0) summary.mediumRiskTasks++
        if (keywordCount > 0) summary.keywordHitTasks++
        if (badge === '未见明显风险') summary.cleanTasks++
        if (!latestTask || String(task.updatedAt || '') > String(latestTask.updatedAt || '')) {
          latestTask = task
        }
      }
      summary.latestSecurityCheckAt = latestTask ? this.formatTime(latestTask.updatedAt) : ''
      return summary
    },
    filteredTasks() {
      const filtered = this.topLevelTasks.filter(task => {
        if (this.statusFilter !== 'all' && task.status !== this.statusFilter) return false
        const resolvedSource = this.isWorkflowTask(task) ? 'document' : (task.data?.chunkSource || 'document')
        if (this.sourceFilter !== 'all' && resolvedSource !== this.sourceFilter) return false
        const causeLabel = this.getTaskCauseLabel(task)
        if (this.causeFilter !== 'all' && causeLabel !== this.causeFilter) return false
        const genericBadge = this.getGenericTaskBadge(task)
        if (this.resultFilter !== 'all' && genericBadge !== this.resultFilter) return false
        const securityCounts = this.getSecurityRiskCounts(task)
        const keywordCount = this.getSecurityKeywordCount(task)
        if (this.riskFilter === 'high_only' && securityCounts.high <= 0) return false
        if (this.riskFilter === 'medium_only' && securityCounts.medium <= 0) return false
        if (this.riskFilter === 'keyword_hit' && keywordCount <= 0) return false
        if (this.riskFilter === 'clean_only' && this.getGenericTaskBadge(task) !== '未见明显风险') return false
        const anchorStats = this.getAnchorStats(task)
        if (this.anchorFilter === 'precise_only' && (anchorStats.precise <= 0 || anchorStats.fallback > 0 || anchorStats.failed > 0)) return false
        if (this.anchorFilter === 'has_fallback' && anchorStats.fallback <= 0) return false
        if (this.anchorFilter === 'has_failed' && anchorStats.failed <= 0) return false
        if (this.anchorFilter === 'risky' && !this.getAnchorRiskSummary(task)) return false
        if (!this.searchText) return true
        const keyword = this.searchText.toLowerCase()
        const haystack = [
          task.title,
          causeLabel,
          this.getTaskCauseSummary(task),
          this.formatChunkSource(task.data?.chunkSource),
          this.getAnchorRiskSummary(task),
          this.getGenericTaskBadge(task),
          this.getTaskListPrimarySummary(task),
          this.getTaskListSecondarySummary(task),
          this.getGenericTaskKeywords(task),
          this.getWorkflowSearchText(task)
        ].join(' ').toLowerCase()
        return haystack.includes(keyword)
      })
      const statusOrder = { running: 0, pending: 1, failed: 2, abnormal: 3, completed: 4, cancelled: 5 }
      return filtered.slice().sort((a, b) => {
        if (this.sortBy === 'updated_asc') {
          return String(a.updatedAt || '').localeCompare(String(b.updatedAt || ''))
        }
        if (this.sortBy === 'status') {
          const diff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
          if (diff !== 0) return diff
          return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
        }
        if (this.sortBy === 'chunk_desc') {
          const diff = Number(b.data?.chunkCount || 0) - Number(a.data?.chunkCount || 0)
          if (diff !== 0) return diff
          return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
        }
        return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
      })
    },
    clearableFilteredCount() {
      return this.filteredTasks.filter(task => task.status !== 'running' && task.status !== 'pending').length
    },
    /** 详情分段（先过滤再渲染，避免 v-for 与 v-if 同节点） */
    detailTaskDetailItemsFiltered() {
      const task = this.detailTask
      const items = task?.data?.items
      if (!task || !Array.isArray(items)) return []
      const taskId = task.id
      const out = []
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx]
        if (this.detailItemMatchesSearch(taskId, idx, item)) {
          out.push({ item, idx })
        }
      }
      return out
    }
  },
  mounted() {
    this.loadTaskListUiState()
    this.loadBatchApplyUiState()
    initSync()
    this.taskListWindowSession = createTaskListWindowSession((query) => {
      this.handleTaskListWindowRequest(query)
    })
    const claimed = this.taskListWindowSession.claimOwnership(this.$route?.query || {})
    if (!claimed.ok && claimed.reason === 'duplicate') {
      window.setTimeout(() => {
        this.closeWindow()
      }, 80)
      return
    }
    this.tasks = getTasks()
    if (!this.syncRouteTaskFocus(true)) {
      this.restorePersistedTaskFocus(true)
    }
    this.handleViewportResize = () => {
      this.scheduleDetailViewportUpdate()
    }
    window.addEventListener('resize', this.handleViewportResize)
    this.unsub = subscribe((list) => {
      this.tasks = list
      if (this.detailTask) {
        const next = getTaskById(this.detailTask.id) || this.detailTask
        if (next !== this.detailTask) {
          this.detailTask = next
        }
      }
      if (!this.syncRouteTaskFocus()) {
        this.restorePersistedTaskFocus()
      }
      this.scheduleDetailViewportUpdate()
    })
  },
  beforeUnmount() {
    this.persistCurrentDetailScroll(true)
    if (this.detailScrollSaveTimer) {
      clearTimeout(this.detailScrollSaveTimer)
      this.detailScrollSaveTimer = null
    }
    if (this.detailViewportRafId != null) {
      cancelAnimationFrame(this.detailViewportRafId)
      this.detailViewportRafId = null
    }
    if (this.detailSearchFlashTimer) {
      clearTimeout(this.detailSearchFlashTimer)
      this.detailSearchFlashTimer = null
    }
    if (this.handleViewportResize) {
      window.removeEventListener('resize', this.handleViewportResize)
      this.handleViewportResize = null
    }
    this.unsub?.()
    this.taskListWindowSession?.releaseOwnership?.()
    this.taskListWindowSession = null
  },
  watch: {
    '$route.fullPath'() {
      if (!this.syncRouteTaskFocus(true)) {
        this.restorePersistedTaskFocus(true)
      }
    },
    searchText() {
      this.saveTaskListUiState()
    },
    statusFilter() {
      this.saveTaskListUiState()
    },
    sourceFilter() {
      this.saveTaskListUiState()
    },
    causeFilter() {
      this.saveTaskListUiState()
    },
    resultFilter() {
      this.saveTaskListUiState()
    },
    riskFilter() {
      this.saveTaskListUiState()
    },
    overviewScope() {
      this.saveTaskListUiState()
    },
    anchorFilter() {
      this.saveTaskListUiState()
    },
    detailIssueFilter() {
      this.saveTaskListUiState()
    },
    sortBy() {
      this.saveTaskListUiState()
    },
    expandedId() {
      this.saveTaskListUiState()
    },
    batchApplyQuickFilter() {
      this.saveBatchApplyUiState()
    },
    batchApplyReasonFilter() {
      this.saveBatchApplyUiState()
    },
    batchApplySearchText() {
      this.saveBatchApplyUiState()
    },
    batchApplyCollapsedGroups: {
      deep: true,
      handler() {
        this.saveBatchApplyUiState()
      }
    },
    detailSectionCollapsed: {
      deep: true,
      handler() {
        this.saveTaskListUiState()
      }
    },
    detailSearchText() {
      this.syncDetailSearchSelection(true)
      this.saveTaskListUiState()
    },
    detailSearchScope() {
      this.syncDetailSearchSelection(true)
      this.saveTaskListUiState()
    },
    'detailTask.id'() {
      this.$nextTick(() => this.scheduleDetailViewportUpdate())
    }
  },
  methods: {
    closeWindow() {
      try {
        if (window.close) window.close()
      } catch (e) {
        void e
      }
    },
    handleTaskListWindowRequest(query = {}) {
      this.suppressRouteDetailTaskId = ''
      const nextQuery = {}
      const taskId = String(query?.taskId || '').trim()
      const detail = String(query?.detail || '').trim()
      if (taskId) nextQuery.taskId = taskId
      if (detail === '1') nextQuery.detail = '1'
      if (!Object.keys(nextQuery).length) return
      const currentTaskId = String(this.$route?.query?.taskId || '').trim()
      const currentDetail = String(this.$route?.query?.detail || '').trim()
      if (currentTaskId === String(nextQuery.taskId || '') && currentDetail === String(nextQuery.detail || '')) {
        if (!this.syncRouteTaskFocus(true)) {
          this.restorePersistedTaskFocus(true)
        }
        return
      }
      this.$router.replace({ path: this.$route?.path || '/popup', query: nextQuery }).catch(() => {})
    },
    applyOverviewFilter(mode) {
      this.riskFilter = this.riskFilter === mode ? 'all' : mode
      this.resultFilter = 'all'
      this.sortBy = 'updated_desc'
    },
    focusLatestSecurityChecks() {
      this.riskFilter = 'all'
      this.resultFilter = 'all'
      this.sortBy = 'updated_desc'
      this.searchText = ''
    },
    scheduleTaskListUiStateSave() {
      if (this.detailScrollSaveTimer) {
        clearTimeout(this.detailScrollSaveTimer)
      }
      this.detailScrollSaveTimer = setTimeout(() => {
        this.detailScrollSaveTimer = null
        this.saveTaskListUiState()
      }, 120)
    },
    /** 避免在 updated() 里读 DOM 写状态，与详情内「命中分布」条样式形成递归更新 */
    scheduleDetailViewportUpdate() {
      if (this.detailViewportRafId != null) return
      this.detailViewportRafId = requestAnimationFrame(() => {
        this.detailViewportRafId = null
        this.updateDetailViewportState()
      })
    },
    updateDetailViewportState() {
      const detailBody = this.$refs.detailModalBody
      const viewportEl = this.$refs.detailSearchMapViewport
      if (!detailBody || !viewportEl) return
      const clientHeight = Math.max(0, Number(detailBody.clientHeight) || 0)
      const scrollHeight = Math.max(clientHeight, Number(detailBody.scrollHeight) || 0)
      const maxScrollTop = Math.max(scrollHeight - clientHeight, 0)
      const scrollTop = Math.max(0, Math.min(maxScrollTop, Number(detailBody.scrollTop) || 0))
      const topRatio = maxScrollTop > 0 ? Number((scrollTop / maxScrollTop).toFixed(4)) : 0
      const heightRatio = scrollHeight > 0 ? Number((clientHeight / scrollHeight).toFixed(4)) : 1
      const usableRange = 96
      const width = Math.min(usableRange, Math.max(8, usableRange * heightRatio))
      const left = 2 + Math.min(usableRange - width, usableRange * topRatio)
      viewportEl.style.left = `${Number(left.toFixed(2))}%`
      viewportEl.style.width = `${Number(width.toFixed(2))}%`
    },
    handleDetailBodyScroll() {
      const taskId = String(this.detailTask?.id || '')
      const detailBody = this.$refs.detailModalBody
      if (!taskId || !detailBody) return
      const nextScrollTop = Math.max(0, Math.round(Number(detailBody.scrollTop) || 0))
      const currentScrollTopByTask = this.detailScrollTopByTask && typeof this.detailScrollTopByTask === 'object'
        ? this.detailScrollTopByTask
        : {}
      if (currentScrollTopByTask[taskId] === nextScrollTop) return
      this.detailScrollTopByTask = {
        ...currentScrollTopByTask,
        [taskId]: nextScrollTop
      }
      this.scheduleDetailViewportUpdate()
      this.scheduleTaskListUiStateSave()
    },
    persistCurrentDetailScroll(flush = false) {
      const taskId = String(this.detailTask?.id || '')
      const detailBody = this.$refs.detailModalBody
      if (!taskId || !detailBody) return
      const nextScrollTop = Math.max(0, Math.round(Number(detailBody.scrollTop) || 0))
      const currentScrollTopByTask = this.detailScrollTopByTask && typeof this.detailScrollTopByTask === 'object'
        ? this.detailScrollTopByTask
        : {}
      if (currentScrollTopByTask[taskId] !== nextScrollTop) {
        this.detailScrollTopByTask = {
          ...currentScrollTopByTask,
          [taskId]: nextScrollTop
        }
      }
      if (flush) {
        if (this.detailScrollSaveTimer) {
          clearTimeout(this.detailScrollSaveTimer)
          this.detailScrollSaveTimer = null
        }
        this.saveTaskListUiState()
        return
      }
      this.scheduleTaskListUiStateSave()
    },
    restoreDetailScroll(taskId) {
      const normalizedTaskId = String(taskId || '')
      this.$nextTick(() => {
        const detailBody = this.$refs.detailModalBody
        if (!detailBody) return
        if (String(this.detailTask?.id || '') !== normalizedTaskId) return
        const savedScrollTop = Number(this.detailScrollTopByTask?.[normalizedTaskId])
        detailBody.scrollTop = Number.isFinite(savedScrollTop) && savedScrollTop >= 0 ? savedScrollTop : 0
        this.scheduleDetailViewportUpdate()
      })
    },
    loadTaskListUiState() {
      try {
        if (typeof localStorage === 'undefined') return
        const raw = localStorage.getItem(TASK_LIST_UI_STATE_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw)
        this.searchText = String(parsed?.searchText || '')
        this.statusFilter = String(parsed?.statusFilter || 'all')
        this.sourceFilter = String(parsed?.sourceFilter || 'all')
        this.causeFilter = String(parsed?.causeFilter || 'all')
        this.resultFilter = String(parsed?.resultFilter || 'all')
        this.riskFilter = String(parsed?.riskFilter || 'all')
        this.overviewScope = String(parsed?.overviewScope || 'all')
        this.anchorFilter = String(parsed?.anchorFilter || 'all')
        this.detailIssueFilter = String(parsed?.detailIssueFilter || 'all')
        this.detailSearchText = String(parsed?.detailSearchText || '')
        this.detailSearchScope = String(parsed?.detailSearchScope || 'all')
        this.sortBy = String(parsed?.sortBy || 'updated_desc')
        this.expandedId = parsed?.expandedId ? String(parsed.expandedId) : null
        this.pendingDetailTaskId = parsed?.detailTaskId ? String(parsed.detailTaskId) : ''
        this.detailSectionCollapsed = parsed?.detailSectionCollapsed && typeof parsed.detailSectionCollapsed === 'object'
          ? { ...parsed.detailSectionCollapsed }
          : {}
      } catch (_) {
        // ignore invalid persisted UI state
      }
    },
    saveTaskListUiState() {
      try {
        if (typeof localStorage === 'undefined') return
        localStorage.setItem(TASK_LIST_UI_STATE_KEY, JSON.stringify({
          searchText: this.searchText,
          statusFilter: this.statusFilter,
          sourceFilter: this.sourceFilter,
          causeFilter: this.causeFilter,
          resultFilter: this.resultFilter,
          riskFilter: this.riskFilter,
          overviewScope: this.overviewScope,
          anchorFilter: this.anchorFilter,
          detailIssueFilter: this.detailIssueFilter,
          detailSearchText: this.detailSearchText,
          detailSearchScope: this.detailSearchScope,
          sortBy: this.sortBy,
          expandedId: this.expandedId || '',
          detailTaskId: this.pendingDetailTaskId || this.detailTask?.id || '',
          detailSectionCollapsed: this.detailSectionCollapsed
        }))
      } catch (_) {
        // ignore storage failures
      }
    },
    loadBatchApplyUiState() {
      try {
        if (typeof localStorage === 'undefined') return
        const raw = localStorage.getItem(BATCH_APPLY_UI_STATE_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw)
        this.batchApplyQuickFilter = String(parsed?.quickFilter || 'all')
        this.batchApplyReasonFilter = String(parsed?.reasonFilter || 'all')
        this.batchApplySearchText = String(parsed?.searchText || '')
        this.batchApplyCollapsedGroups = parsed?.collapsedGroups && typeof parsed.collapsedGroups === 'object'
          ? { ...parsed.collapsedGroups }
          : {}
      } catch (_) {
        // ignore invalid persisted UI state
      }
    },
    saveBatchApplyUiState() {
      try {
        if (typeof localStorage === 'undefined') return
        localStorage.setItem(BATCH_APPLY_UI_STATE_KEY, JSON.stringify({
          quickFilter: this.batchApplyQuickFilter,
          reasonFilter: this.batchApplyReasonFilter,
          searchText: this.batchApplySearchText,
          collapsedGroups: this.batchApplyCollapsedGroups
        }))
      } catch (_) {
        // ignore storage failures
      }
    },
    isWorkflowTask(task) {
      return task?.type === 'workflow' || task?.data?.kind === 'workflow'
    },
    isWorkflowChildTask(task) {
      return Boolean(task?.data?.parentWorkflowTaskId)
    },
    getWorkflowNodeRuns(task) {
      if (!this.isWorkflowTask(task)) return []
      return (task?.data?.nodeRuns || []).slice().sort((a, b) => {
        return String(a.startedAt || '').localeCompare(String(b.startedAt || ''))
      })
    },
    getWorkflowChildTask(nodeRun) {
      const childTaskId = String(nodeRun?.childTaskId || '')
      if (!childTaskId) return null
      return getTaskById(childTaskId) || this.tasks.find(item => item.id === childTaskId) || null
    },
    getWorkflowNodeRunStatus(nodeRun) {
      return this.getWorkflowChildTask(nodeRun)?.status || nodeRun?.status || 'pending'
    },
    getWorkflowDebugState(task) {
      return task?.data?.debugState && typeof task.data.debugState === 'object' ? task.data.debugState : null
    },
    getWorkflowNodeRunSummary(nodeRun) {
      const childTask = this.getWorkflowChildTask(nodeRun)
      return String(
        childTask?.data?.outputPreview ||
        childTask?.data?.commentPreview ||
        nodeRun?.outputSummary ||
        childTask?.error ||
        nodeRun?.error ||
        ''
      ).trim()
    },
    shouldShowWorkflowNodeOutputValue(nodeRun) {
      return nodeRun?.outputValue != null && typeof nodeRun.outputValue === 'object'
    },
    getWorkflowNodeRunDuration(nodeRun) {
      const childTask = this.getWorkflowChildTask(nodeRun)
      const startedAt = String(nodeRun?.startedAt || childTask?.createdAt || '')
      const endedAt = String(nodeRun?.endedAt || childTask?.updatedAt || '')
      if (!startedAt || !endedAt) return ''
      const start = new Date(startedAt).getTime()
      const end = new Date(endedAt).getTime()
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return ''
      const seconds = Math.max(0, Math.round((end - start) / 1000))
      if (seconds < 60) return `${seconds} 秒`
      const minutes = Math.floor(seconds / 60)
      const remain = seconds % 60
      return remain > 0 ? `${minutes} 分 ${remain} 秒` : `${minutes} 分`
    },
    getWorkflowNodeRunPathLabel(task, nodeRun) {
      const parents = Array.isArray(nodeRun?.parentNodeIds) ? nodeRun.parentNodeIds : []
      if (!parents.length) return '开始分支'
      const titles = parents.map(nodeId => {
        const parentRun = this.getWorkflowNodeRuns(task).find(item => item.nodeId === nodeId)
        return parentRun?.title || nodeId
      }).filter(Boolean)
      return titles.length ? `来自 ${titles.join('、')}` : '等待前驱完成'
    },
    getWorkflowSearchText(task) {
      if (!this.isWorkflowTask(task)) return ''
      return this.getWorkflowNodeRuns(task).map(item => {
        const childTask = this.getWorkflowChildTask(item)
        return [
          item.title,
          item.outputSummary,
          item.error,
          childTask?.title,
          childTask?.error,
          childTask?.data?.outputPreview
        ].filter(Boolean).join(' ')
      }).join(' ')
    },
    getWorkflowSnapshot(task) {
      return task?.data?.snapshot && typeof task.data.snapshot === 'object' ? task.data.snapshot : null
    },
    getWorkflowSnapshotNodes(task) {
      const snapshot = this.getWorkflowSnapshot(task)
      return Array.isArray(snapshot?.nodes) ? snapshot.nodes : []
    },
    getWorkflowSnapshotEdges(task) {
      const snapshot = this.getWorkflowSnapshot(task)
      return Array.isArray(snapshot?.edges) ? snapshot.edges : []
    },
    getWorkflowSnapshotBounds(task) {
      const nodes = this.getWorkflowSnapshotNodes(task)
      if (!nodes.length) {
        return { minX: 0, minY: 0, width: 1, height: 1 }
      }
      let minX = Number.POSITIVE_INFINITY
      let minY = Number.POSITIVE_INFINITY
      let maxX = Number.NEGATIVE_INFINITY
      let maxY = Number.NEGATIVE_INFINITY
      nodes.forEach((node) => {
        const x = Number(node?.position?.x || 0)
        const y = Number(node?.position?.y || 0)
        const width = node?.id === 'workflow_start' ? 84 : 190
        const height = node?.id === 'workflow_start' ? 44 : 92
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x + width)
        maxY = Math.max(maxY, y + height)
      })
      return {
        minX,
        minY,
        width: Math.max(maxX - minX, 1),
        height: Math.max(maxY - minY, 1)
      }
    },
    getWorkflowSnapshotNodeTitle(node) {
      return String(node?.data?.title || node?.label || (node?.id === 'workflow_start' ? '开始' : '未命名节点'))
    },
    getWorkflowSnapshotNodeStyle(task, node) {
      const bounds = this.getWorkflowSnapshotBounds(task)
      const width = node?.id === 'workflow_start' ? 10 : 21
      const height = node?.id === 'workflow_start' ? 8 : 16
      const x = Number(node?.position?.x || 0) - bounds.minX
      const y = Number(node?.position?.y || 0) - bounds.minY
      return {
        left: `${(x / bounds.width) * 100}%`,
        top: `${(y / bounds.height) * 100}%`,
        width: `${width}%`,
        minHeight: `${height}%`
      }
    },
    getWorkflowSnapshotNodeClass(task, node) {
      if (node?.id === 'workflow_start') return 'start'
      return this.getWorkflowSnapshotNodeStatus(task, node.id)
    },
    getWorkflowSnapshotNodeStatus(task, nodeId) {
      const nodeRun = this.getWorkflowNodeRuns(task).find(item => item.nodeId === nodeId)
      return this.getWorkflowNodeRunStatus(nodeRun)
    },
    getWorkflowSnapshotEdgeClass(task, edge) {
      const debugState = this.getWorkflowDebugState(task)
      const currentNodeId = String(debugState?.waitingNodeId || task?.data?.currentNodeId || '').trim()
      if (currentNodeId && edge?.target === currentNodeId) return 'incoming'
      const nodeRuns = this.getWorkflowNodeRuns(task)
      for (const run of nodeRuns) {
        const decision = (run?.branchDecisions || []).find(item => item.edgeId === edge?.id)
        if (!decision) continue
        return decision.taken ? 'taken' : 'skipped'
      }
      return ''
    },
    getWorkflowSnapshotEdgeLine(task, edge) {
      const bounds = this.getWorkflowSnapshotBounds(task)
      const nodes = this.getWorkflowSnapshotNodes(task)
      const source = nodes.find(item => item.id === edge?.source)
      const target = nodes.find(item => item.id === edge?.target)
      if (!source || !target) {
        return { x1: '0%', y1: '0%', x2: '0%', y2: '0%' }
      }
      const sourceWidth = source.id === 'workflow_start' ? 84 : 190
      const sourceHeight = source.id === 'workflow_start' ? 44 : 92
      const targetHeight = target.id === 'workflow_start' ? 44 : 92
      const x1 = (((Number(source.position?.x || 0) + sourceWidth) - bounds.minX) / bounds.width) * 100
      const y1 = (((Number(source.position?.y || 0) + sourceHeight / 2) - bounds.minY) / bounds.height) * 100
      const x2 = ((Number(target.position?.x || 0) - bounds.minX) / bounds.width) * 100
      const y2 = (((Number(target.position?.y || 0) + targetHeight / 2) - bounds.minY) / bounds.height) * 100
      return {
        x1: `${x1}%`,
        y1: `${y1}%`,
        x2: `${x2}%`,
        y2: `${y2}%`
      }
    },
    getWorkflowExecutionSequence(task) {
      return this.getWorkflowNodeRuns(task).map((item, index) => ({
        nodeId: item.nodeId,
        order: index + 1,
        title: item.title || '未命名节点',
        status: this.getWorkflowNodeRunStatus(item),
        pathLabel: this.getWorkflowNodeRunPathLabel(task, item),
        summary: this.getWorkflowNodeRunSummary(item)
      }))
    },
    openWorkflowChildDetail(nodeRun) {
      const childTask = this.getWorkflowChildTask(nodeRun)
      if (childTask) this.openDetail(childTask)
    },
    removeTaskWithChildren(taskId) {
      removeTask(taskId)
      if (this.detailTask && !getTaskById(this.detailTask.id)) {
        this.closeDetail()
      }
    },
    getTaskAssistantId(task) {
      return String(task?.data?.assistantId || '')
    },
    canApplyRecommendationToSettings(task) {
      return this.getTaskAssistantId(task) === 'settings.custom-assistant-recommendation' &&
        task?.status === 'completed' &&
        Boolean(task?.data?.recommendedConfig) &&
        Boolean(task?.data?.recommendationTargetKey)
    },
    getGenericTaskBadge(task) {
      const assistantId = this.getTaskAssistantId(task)
      const operationKind = String(task?.data?.operationKind || '')
      const output = String(task?.data?.fullOutput || '').trim()
      if (assistantId === 'settings.custom-assistant-recommendation') {
        return task?.status === 'completed' ? '已推荐' : ''
      }
      if (operationKind === 'form-audit') {
        if (task?.status === 'failed') return '审计失败'
        if (task?.status === 'running') return '审计中'
        const high = Number(task?.data?.highRiskCount || 0)
        const medium = Number(task?.data?.mediumRiskCount || 0)
        if (high > 0) return '高风险'
        if (medium > 0) return '中风险'
        return '未见明显问题'
      }
      if (operationKind === 'document-declassify') {
        return task?.status === 'completed' ? '已占位脱密' : task?.status === 'failed' ? '脱密失败' : '脱密中'
      }
      if (operationKind === 'document-declassify-restore') {
        return task?.status === 'completed' ? '已密码复原' : task?.status === 'failed' ? '复原失败' : '复原中'
      }
      if (operationKind === 'secret-keyword-extract') {
        return task?.status === 'completed' ? '已提取' : task?.status === 'failed' ? '提取失败' : '提取中'
      }
      if (!output) return ''
      if (assistantId === 'analysis.ai-trace-check') {
        const highSec = this.getMarkdownSection(output, '高疑似项')
        if (highSec && highSec !== '无') return '高疑似'
        const medSec = this.getMarkdownSection(output, '中疑似项')
        if (medSec && medSec !== '无') return '中疑似'
        if (/未发现明显\s*AI\s*痕迹|未发现明显的\s*AI\s*生成痕迹|未见明显\s*AI\s*痕迹/u.test(output)) return '未见明显AI痕迹'
        return '待复核'
      }
      if (assistantId === 'analysis.security-check') {
        const highRisk = this.getMarkdownSection(output, '高风险项')
        if (highRisk && highRisk !== '无') return '高风险'
        const mediumRisk = this.getMarkdownSection(output, '中风险项')
        if (mediumRisk && mediumRisk !== '无') return '中风险'
        if (/未发现明显保密风险/.test(output)) return '未见明显风险'
        return '待复核'
      }
      if (assistantId === 'analysis.paragraph-numbering-check') {
        if (/未发现明显的段落序号格式问题/.test(output)) return '序号正常'
        return '发现编号问题'
      }
      if (assistantId === 'analysis.comment-explain') return '已解释'
      if (assistantId === 'analysis.hyperlink-explain') return '已解释'
      return ''
    },
    getGenericTaskBadgeClass(task) {
      const badge = this.getGenericTaskBadge(task)
      if (badge === '高风险' || badge === '高疑似' || badge === '发现编号问题' || badge === '脱密失败' || badge === '复原失败' || badge === '审计失败') return 'error'
      if (badge === '中风险' || badge === '中疑似' || badge === '待复核' || badge === '脱密中' || badge === '复原中' || badge === '审计中' || badge === '提取中') return 'warning'
      if (badge === '未见明显风险' || badge === '未见明显AI痕迹' || badge === '序号正常' || badge === '已占位脱密' || badge === '已密码复原' || badge === '已提取' || badge === '未见明显问题') return 'success'
      return 'info'
    },
    shouldShowGenericSummary(task) {
      return Boolean(
        this.getGenericTaskCommentPreview(task) ||
        this.getGenericTaskConclusion(task) ||
        this.getGenericTaskRiskHint(task) ||
        this.getGenericTaskKeywords(task) ||
        this.getTaskWriteTargets(task).length > 0 ||
        this.getTaskGeneratedArtifacts(task).length > 0 ||
        this.getTaskPreviewBlocks(task).length > 0
      )
    },
    hasGenericTaskRecord(task) {
      return Boolean(
        task?.data?.inputPreview ||
        task?.data?.renderedSystemPrompt ||
        task?.data?.renderedUserPrompt ||
        task?.data?.fullOutput ||
        this.getTaskWriteTargets(task).length > 0 ||
        this.getTaskGeneratedArtifacts(task).length > 0 ||
        this.getTaskPreviewBlocks(task).length > 0 ||
        this.hasGenericTaskMetadata(task)
      )
    },
    hasGenericTaskMetadata(task) {
      return Boolean(
        task?.data?.entry ||
        task?.data?.primaryIntent ||
        task?.data?.executionMode ||
        task?.data?.taskPhase ||
        task?.data?.modelDisplayName ||
        task?.data?.modelSource ||
        task?.data?.configuredInputSource ||
        task?.data?.documentAction ||
        task?.data?.launchSource ||
        task?.data?.strictAssistantDefaults === true ||
        task?.data?.reportSettings?.enabled ||
        task?.data?.reportTypeLabel ||
        task?.data?.relatedTaskId ||
        task?.data?.targetLanguage ||
        task?.data?.outputFormat ||
        task?.data?.temperature != null
      )
    },
    getGenericTaskCommentPreview(task) {
      return String(task?.data?.commentPreview || '').trim()
    },
    formatModelSource(source) {
      const map = {
        explicit: '单独指定',
        'category-default': '继承默认分类模型',
        'chat-default': '继承对话模型',
        'fallback-first-available': '回退到首个可用模型'
      }
      return map[String(source || '')] || String(source || '-')
    },
    getRecommendationModelSourceLabel(task) {
      if (this.getTaskAssistantId(task) !== 'settings.custom-assistant-recommendation') return ''
      const selectionMode = String(task?.data?.recommendationModelSelectionMode || '')
      const resolvedSource = String(task?.data?.recommendationModelResolvedSource || task?.data?.modelSource || '')
      if (selectionMode === 'manual') return '本次单独指定推荐模型'
      if (resolvedSource === 'explicit') return '继承当前助手单独指定模型'
      if (resolvedSource === 'category-default') return '继承当前助手默认分类模型'
      if (resolvedSource === 'chat-default') return '继承对话模型'
      if (resolvedSource === 'fallback-first-available') return '回退到首个可用对话模型'
      if (resolvedSource) return this.formatModelSource(resolvedSource)
      return '继承当前助手解析模型'
    },
    formatInputSource(source) {
      const found = INPUT_SOURCE_OPTIONS.find(item => item.value === source)
      if (found) return found.label
      return this.formatChunkSource(source)
    },
    formatDocumentAction(action) {
      const found = DOCUMENT_ACTION_OPTIONS.find(item => item.value === action)
      return found?.label || String(action || '-')
    },
    formatTaskEntry(entry) {
      const normalized = String(entry || '').trim()
      if (normalized === 'dialog') return '对话框'
      if (normalized === 'ribbon-direct') return '顶部菜单'
      if (normalized === 'wps-capability') return 'WPS 能力入口'
      return normalized || '-'
    },
    formatPrimaryIntent(intent) {
      const normalized = String(intent || '').trim()
      if (normalized === 'chat') return '普通对话'
      if (normalized === 'document-operation') return '文档处理'
      if (normalized === 'assistant-task') return '助手任务'
      if (normalized === 'wps-capability') return 'WPS 能力'
      if (normalized === 'generated-output') return '生成输出'
      return normalized || '-'
    },
    formatExecutionMode(mode) {
      const normalized = String(mode || '').trim()
      if (normalized === 'direct-chat') return '直接对话'
      if (normalized === 'runner-task') return '助手执行'
      if (normalized === 'wps-task') return 'WPS 执行'
      if (normalized === 'generated-file-task') return '生成文件'
      return normalized || '-'
    },
    formatTaskPhase(phase) {
      const normalized = String(phase || '').trim()
      if (normalized === 'echoed') return '已回显'
      if (normalized === 'routing') return '路由中'
      if (normalized === 'collecting-params') return '收集参数'
      if (normalized === 'planning') return '生成计划'
      if (normalized === 'previewing') return '预览确认'
      if (normalized === 'applying') return '写回处理中'
      if (normalized === 'completed') return '已完成'
      if (normalized === 'failed') return '失败'
      if (normalized === 'cancelled') return '已停止'
      if (normalized === 'abnormal') return '异常结束'
      return normalized || '-'
    },
    formatLaunchSource(source) {
      const normalized = String(source || '').trim()
      if (normalized === 'ribbon-direct') return '顶部菜单直接执行'
      if (normalized === 'dialog') return '对话框'
      if (normalized === 'wps-capability') return 'WPS 能力入口'
      if (normalized === 'document-declassify-dialog') return '脱密对话框'
      return normalized || '-'
    },
    getTaskPreviewBlocks(task) {
      const blocks = Array.isArray(task?.data?.previewBlocks) ? task.data.previewBlocks : []
      return blocks.slice(0, 12).map((block, index) => ({
        id: String(block?.id || `preview_${index + 1}`),
        title: String(block?.title || `第 ${index + 1} 段`),
        inputText: String(block?.inputText || '').trim(),
        outputText: String(block?.outputText || '').trim(),
        qualityLevel: String(block?.qualityLevel || '').trim(),
        paragraphIndex: Number.isFinite(Number(block?.paragraphIndex)) ? Number(block.paragraphIndex) : null,
        locateKey: String(block?.locateKey || '').trim()
      })).filter(block => block.inputText || block.outputText)
    },
    getTaskWriteTargets(task) {
      const targets = Array.isArray(task?.data?.writeTargets) ? task.data.writeTargets : []
      return targets.slice(0, 40).map((target, index) => ({
        index: index + 1,
        action: String(target?.action || '').trim(),
        start: Number.isFinite(Number(target?.start)) ? Number(target.start) : null,
        end: Number.isFinite(Number(target?.end)) ? Number(target.end) : null,
        paragraphIndex: Number.isFinite(Number(target?.paragraphIndex)) ? Number(target.paragraphIndex) : null,
        originalText: String(target?.originalText || '').trim(),
        outputText: String(target?.outputText || '').trim(),
        downgraded: target?.downgraded === true,
        locateKey: String(target?.locateKey || '').trim()
      }))
    },
    getTaskGeneratedArtifacts(task) {
      const artifacts = Array.isArray(task?.data?.generatedArtifacts) ? task.data.generatedArtifacts : []
      return artifacts.slice(0, 20).map((artifact, index) => ({
        index: index + 1,
        kind: String(artifact?.kind || '').trim(),
        name: String(artifact?.name || '').trim(),
        path: String(artifact?.path || '').trim(),
        mimeType: String(artifact?.mimeType || '').trim(),
        extension: String(artifact?.extension || '').trim(),
        status: String(artifact?.status || '').trim()
      })).filter(artifact => artifact.name || artifact.path)
    },
    getTaskReportTypeLabel(task) {
      const reportSettings = normalizeReportSettings(task?.data?.reportSettings)
      if (!reportSettings.enabled && !task?.data?.reportTypeLabel) return ''
      return String(task?.data?.reportTypeLabel || getReportTypeLabel(reportSettings.type, reportSettings.customType)).trim()
    },
    getMarkdownSection(text, title) {
      const source = String(text || '')
      if (!source || !title) return ''
      const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const match = source.match(new RegExp(`##\\s*${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`))
      return match?.[1]?.trim() || ''
    },
    normalizeSummaryText(text) {
      return String(text || '')
        .replace(/^[-*]\s*/gm, '')
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    },
    getGenericTaskConclusion(task) {
      const assistantId = this.getTaskAssistantId(task)
      const operationKind = String(task?.data?.operationKind || '')
      if (assistantId === 'settings.custom-assistant-recommendation') {
        return this.normalizeSummaryText(task?.data?.recommendationSummary || '')
      }
      if (operationKind === 'form-audit') {
        const output = String(task?.data?.fullOutput || '').trim()
        if (output) {
          return this.normalizeSummaryText(this.getMarkdownSection(output, '总体结论'))
        }
        return ''
      }
      if (operationKind === 'document-declassify') {
        const matched = Number(task?.data?.matchedKeywordCount || 0)
        const replacements = Number(task?.data?.replacementCount || 0)
        if (task?.status === 'completed') {
          return `已完成占位符脱密，命中 ${matched} 个关键词，执行 ${replacements} 处替换。`
        }
        return ''
      }
      if (operationKind === 'document-declassify-restore') {
        const replacements = Number(task?.data?.replacementCount || 0)
        if (task?.status === 'completed') {
          return `已完成密码复原，恢复 ${replacements} 处替换并还原原文。`
        }
        return ''
      }
      if (operationKind === 'secret-keyword-extract') {
        const matched = Number(task?.data?.matchedKeywordCount || 0)
        const replacements = Number(task?.data?.replacementCount || 0)
        if (task?.status === 'completed') {
          return `已完成涉密关键词提取，命中 ${matched} 个关键词，可覆盖 ${replacements} 处正文替换。`
        }
        return ''
      }
      const output = String(task?.data?.fullOutput || '').trim()
      if (!output) return ''
      if (assistantId === 'analysis.security-check' || assistantId === 'analysis.paragraph-numbering-check' || assistantId === 'analysis.ai-trace-check') {
        return this.normalizeSummaryText(this.getMarkdownSection(output, '总体结论'))
      }
      if (assistantId === 'analysis.comment-explain' || assistantId === 'analysis.hyperlink-explain') {
        return this.normalizeSummaryText(output).slice(0, 180)
      }
      if (this.getTaskReportTypeLabel(task) && task?.status === 'completed') {
        return `已生成${this.getTaskReportTypeLabel(task)}。`
      }
      return ''
    },
    getGenericTaskRiskHint(task) {
      const assistantId = this.getTaskAssistantId(task)
      const operationKind = String(task?.data?.operationKind || '')
      if (assistantId === 'settings.custom-assistant-recommendation') {
        const notes = this.normalizeSummaryText(task?.data?.recommendationNotes || '')
        if (notes) return notes
        if (task?.status === 'completed') return '推荐结果已自动写入当前新增助手草稿，但仍需要你手动点击保存。'
        return ''
      }
      if (operationKind === 'form-audit') {
        const high = Number(task?.data?.highRiskCount || 0)
        const medium = Number(task?.data?.mediumRiskCount || 0)
        if (high > 0) return `存在 ${high} 项高风险问题，建议优先人工复核关键字段。`
        if (medium > 0) return `存在 ${medium} 项中风险问题，建议结合规则继续核验。`
        return task?.error || ''
      }
      if (operationKind === 'document-declassify') {
        if (task?.status === 'completed') {
          return '占位符映射、命中位置和原文恢复载荷已加密写入当前文档，可随文档一起保存和移动。'
        }
        return task?.error || ''
      }
      if (operationKind === 'document-declassify-restore') {
        if (task?.status === 'completed') {
          return '若后续再次执行脱密，将重新生成新的占位符和加密载荷。'
        }
        return task?.error || ''
      }
      if (operationKind === 'secret-keyword-extract') {
        return task?.data?.strategyTrace?.includes?.('drop_response_format')
          ? '当前模型不支持结构化 response_format，系统已回退为普通 JSON 提取。'
          : (task?.error || '')
      }
      const output = String(task?.data?.fullOutput || '').trim()
      if (!output) return ''
      if (assistantId === 'analysis.ai-trace-check') {
        const highSec = this.getMarkdownSection(output, '高疑似项')
        if (highSec && highSec !== '无') return '存在高疑似 AI 生成片段，建议优先通读并改写套话或补充具体信息。'
        const medSec = this.getMarkdownSection(output, '中疑似项')
        if (medSec && medSec !== '无') return '存在中疑似片段，建议结合写作场景判断是否保留。'
        return ''
      }
      if (assistantId === 'analysis.security-check') {
        const highRisk = this.getMarkdownSection(output, '高风险项')
        if (highRisk && highRisk !== '无') return '存在高风险项，建议优先人工复核并评估是否需要立即脱敏。'
        const mediumRisk = this.getMarkdownSection(output, '中风险项')
        if (mediumRisk && mediumRisk !== '无') return '存在中风险项，建议结合上下文继续人工研判。'
        return ''
      }
      if (assistantId === 'analysis.paragraph-numbering-check' && !/未发现明显的段落序号格式问题/.test(output)) {
        return '已发现可疑序号或层级问题，建议先统一编号规则后再批量修改。'
      }
      return ''
    },
    countStructuredBulletItems(sectionText) {
      const source = String(sectionText || '').trim()
      if (!source || source === '无') return 0
      const lines = source
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
      return lines.filter(line => /^-\s*命中片段[:：]/.test(line)).length
    },
    getSecurityRiskCounts(task) {
      if (this.getTaskAssistantId(task) !== 'analysis.security-check') {
        return { high: 0, medium: 0 }
      }
      const output = String(task?.data?.fullOutput || '').trim()
      if (!output) return { high: 0, medium: 0 }
      return {
        high: this.countStructuredBulletItems(this.getMarkdownSection(output, '高风险项')),
        medium: this.countStructuredBulletItems(this.getMarkdownSection(output, '中风险项'))
      }
    },
    getAiTraceLikelihoodCounts(task) {
      if (this.getTaskAssistantId(task) !== 'analysis.ai-trace-check') {
        return { high: 0, medium: 0 }
      }
      const output = String(task?.data?.fullOutput || '').trim()
      if (!output) return { high: 0, medium: 0 }
      return {
        high: this.countStructuredBulletItems(this.getMarkdownSection(output, '高疑似项')),
        medium: this.countStructuredBulletItems(this.getMarkdownSection(output, '中疑似项'))
      }
    },
    getSecretKeywordEntries(task) {
      if (this.getTaskAssistantId(task) !== 'analysis.secret-keyword-extract') return []
      const output = String(task?.data?.fullOutput || '').trim()
      if (!output) return []
      let raw = output
      const fenced = output.match(/```(?:json)?\s*([\s\S]*?)```/i)
      if (fenced?.[1]) raw = fenced[1].trim()
      else if (output.startsWith('{') || output.startsWith('[')) raw = output
      else {
        const start = Math.max(output.indexOf('{'), output.indexOf('['))
        const end = Math.max(output.lastIndexOf('}'), output.lastIndexOf(']'))
        if (start >= 0 && end > start) raw = output.slice(start, end + 1)
      }
      try {
        const parsed = JSON.parse(raw)
        const keywords = Array.isArray(parsed?.keywords) ? parsed.keywords : []
        return keywords.map(k => ({
          term: String(k?.term || '').trim(),
          replacementToken: String(k?.replacementToken || '').trim(),
          category: String(k?.category || '').trim(),
          riskLevel: String(k?.riskLevel || 'low').toLowerCase(),
          reason: String(k?.reason || '').trim(),
          occurrenceCount: Number(k?.occurrenceCount || 0),
          hitPreviews: Array.isArray(k?.hitPreviews) ? k.hitPreviews : []
        }))
      } catch (_) {
        return []
      }
    },
    getGenericTaskKeywords(task) {
      const operationKind = String(task?.data?.operationKind || '')
      if (operationKind === 'document-declassify' || operationKind === 'document-declassify-restore') {
        return String(task?.data?.keywordSummary || '').trim()
      }
      if (operationKind === 'form-audit') {
        const issues = Array.isArray(task?.data?.auditResults) ? task.data.auditResults : []
        return [...new Set(issues.map(item => String(item.fieldName || '').trim()).filter(Boolean))].join('、')
      }
      if (this.getTaskAssistantId(task) === 'analysis.secret-keyword-extract') {
        const entries = this.getSecretKeywordEntries(task)
        return entries.length > 0 ? `共 ${entries.length} 个涉密关键词` : ''
      }
      if (this.getTaskAssistantId(task) !== 'analysis.security-check') return ''
      const output = String(task?.data?.fullOutput || '').trim()
      if (!output) return ''
      const keywords = this.normalizeSummaryText(this.getMarkdownSection(output, '可疑关键词汇总'))
      return keywords === '无' ? '' : keywords
    },
    getFormAuditIssueGroups(task) {
      if (String(task?.data?.operationKind || '') !== 'form-audit') return []
      const issues = Array.isArray(task?.data?.auditResults) ? task.data.auditResults : []
      const map = new Map()
      issues.forEach((issue) => {
        const fieldName = String(issue?.fieldName || '未命名字段').trim()
        const key = `${fieldName}::${String(issue?.semanticKey || '')}`
        if (!map.has(key)) {
          map.set(key, {
            key,
            fieldName,
            items: []
          })
        }
        map.get(key).items.push(issue)
      })
      return Array.from(map.values()).sort((a, b) => {
        const riskScore = (items) => items.reduce((score, issue) => {
          if (issue?.riskLevel === 'high') return score + 3
          if (issue?.riskLevel === 'medium') return score + 2
          return score + 1
        }, 0)
        const diff = riskScore(b.items) - riskScore(a.items)
        if (diff !== 0) return diff
        return b.items.length - a.items.length
      })
    },
    getSecurityKeywordCount(task) {
      const keywords = this.getGenericTaskKeywords(task)
      if (!keywords) return 0
      return keywords
        .split(/[，,、；;\s]+/)
        .map(item => item.trim())
        .filter(Boolean).length
    },
    getTaskListPrimarySummary(task) {
      if (this.isWorkflowTask(task)) {
        const nodeRuns = this.getWorkflowNodeRuns(task)
        if (task.status === 'running' && this.getWorkflowDebugState(task)?.paused && this.getWorkflowDebugState(task)?.waitingNodeTitle) {
          return `工作流暂停在节点“${this.getWorkflowDebugState(task).waitingNodeTitle}”，已完成 ${task.current || 0}/${task.total || nodeRuns.length || 0} 个助手任务。`
        }
        if (task.status === 'running' && task?.data?.currentNodeTitle) {
          return `正在执行节点“${task.data.currentNodeTitle}”，已完成 ${task.current || 0}/${task.total || nodeRuns.length || 0} 个助手任务。`
        }
        if (task.status === 'completed') {
          return `工作流已完成，共执行 ${nodeRuns.length} 个助手节点。`
        }
        if (task.status === 'failed') {
          return `工作流执行失败，已完成 ${task.current || 0}/${task.total || nodeRuns.length || 0} 个助手节点。`
        }
        if (task.status === 'abnormal') {
          return `工作流异常结束，已完成 ${task.current || 0}/${task.total || nodeRuns.length || 0} 个助手节点。`
        }
        if (task.status === 'cancelled') {
          return `工作流已停止，已完成 ${task.current || 0}/${task.total || nodeRuns.length || 0} 个助手节点。`
        }
        return `工作流包含 ${task.total || nodeRuns.length || 0} 个助手节点。`
      }
      return this.getGenericTaskConclusion(task) || ''
    },
    getTaskListSecondarySummary(task) {
      if (this.isWorkflowTask(task)) {
        const nodeRuns = this.getWorkflowNodeRuns(task)
        const failedCount = nodeRuns.filter(item => this.getWorkflowNodeRunStatus(item) === 'failed').length
        const completedCount = nodeRuns.filter(item => this.getWorkflowNodeRunStatus(item) === 'completed').length
        if (failedCount > 0) return `失败节点 ${failedCount} 个，成功节点 ${completedCount} 个。`
        if (completedCount > 0) return `成功节点 ${completedCount} 个，等待或运行中的节点 ${Math.max(nodeRuns.length - completedCount, 0)} 个。`
        return ''
      }
      if (this.getTaskAssistantId(task) === 'settings.custom-assistant-recommendation') {
        const modelName = String(task?.data?.modelDisplayName || '').trim()
        const modelSource = this.getRecommendationModelSourceLabel(task)
        if (modelName && modelSource) return `推荐模型：${modelName} · ${modelSource}`
        if (modelName) return `推荐模型：${modelName}`
        if (modelSource) return `推荐模型来源：${modelSource}`
      }
      return this.getGenericTaskRiskHint(task) || ''
    },
    getTaskDiagnostic(task) {
      const items = task?.data?.items || []
      const ranked = ['error', 'warning', 'info']
      let best = null
      for (const item of items) {
        const diag = item?.diagnostic
        if (!diag) continue
        if (!best) {
          best = diag
          continue
        }
        const bestIdx = ranked.indexOf(best.severity || 'warning')
        const currentIdx = ranked.indexOf(diag.severity || 'warning')
        if (currentIdx !== -1 && (bestIdx === -1 || currentIdx < bestIdx)) {
          best = diag
        }
      }
      return best || null
    },
    getTaskCauseLabel(task) {
      return this.getTaskDiagnostic(task)?.rootCauseLabel || ''
    },
    getTaskCauseSummary(task) {
      if (this.isWorkflowTask(task)) {
        return String(task?.error || '').trim()
      }
      return this.getTaskDiagnostic(task)?.rootCauseSummary || ''
    },
    getAnchorStats(task) {
      const stats = { precise: 0, fallback: 0, failed: 0, skipped: 0 }
      const items = task?.data?.items || []
      for (const item of items) {
        const parsedItems = item?.parsedItems || []
        for (const issue of parsedItems) {
          if (issue?.anchorStatus === 'success') {
            if (this.anchorModeClass(issue) === 'fallback') stats.fallback++
            else stats.precise++
          } else if (issue?.anchorStatus === 'failed') {
            stats.failed++
          } else if (issue?.anchorStatus === 'skipped') {
            stats.skipped++
          }
        }
      }
      return stats
    },
    getQualityStats(task) {
      const stats = { high: 0, medium: 0, review: 0 }
      const items = task?.data?.items || []
      for (const item of items) {
        const parsedItems = item?.parsedItems || []
        for (const issue of parsedItems) {
          const level = String(issue?.qualityLevel || '')
          if (level === 'high') stats.high++
          else if (level === 'review') stats.review++
          else if (level === 'medium') stats.medium++
        }
      }
      if (stats.high === 0 && stats.medium === 0 && stats.review === 0) {
        const batchRecords = Array.isArray(task?.data?.batchRecords) ? task.data.batchRecords : []
        for (const record of batchRecords) {
          const level = String(record?.response?.quality?.level || '')
          if (level === 'high') stats.high++
          else if (level === 'medium') stats.medium++
          else if (level === 'review') stats.review++
        }
      }
      return stats
    },
    hasAnchorStats(task) {
      const stats = this.getAnchorStats(task)
      return stats.precise > 0 || stats.fallback > 0 || stats.failed > 0 || stats.skipped > 0
    },
    hasQualityStats(task) {
      const stats = this.getQualityStats(task)
      return stats.high > 0 || stats.medium > 0 || stats.review > 0
    },
    getAnchorRiskSummary(task) {
      const stats = this.getAnchorStats(task)
      if (stats.failed > 0) {
        return `存在 ${stats.failed} 条定位失败，建议优先复核。`
      }
      if (stats.skipped > 0) {
        return `有 ${stats.skipped} 条建议复核问题未自动写入批注。`
      }
      if (stats.fallback > stats.precise && stats.fallback > 0) {
        return `整句回退较多（${stats.fallback} 条），定位精度偏保守。`
      }
      if (stats.fallback > 0) {
        return `包含 ${stats.fallback} 条整句回退，可重点关注标点类问题。`
      }
      return ''
    },
    getSkippedIssueEntries(task) {
      const items = task?.data?.items || []
      const entries = []
      for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
        const parsedItems = items[itemIndex]?.parsedItems || []
        for (let issueIndex = 0; issueIndex < parsedItems.length; issueIndex++) {
          const issue = parsedItems[issueIndex]
          if (issue?.anchorStatus !== 'skipped') continue
          entries.push({
            itemIndex,
            issueIndex,
            text: issue?.text || '',
            suggestion: issue?.suggestion || '',
            reason: issue?.reason || '',
            sentence: issue?.sentence || '',
            qualityLabel: issue?.qualityLabel || ''
          })
        }
      }
      return entries
    },
    isPunctuationOnlyText(text) {
      const s = String(text || '').trim()
      if (!s) return false
      return /^[\p{P}\p{S}]+$/u.test(s)
    },
    getBatchApplyReasonOptions(task) {
      return [...new Set(
        this.getSkippedIssueEntries(task)
          .map(entry => String(entry.reason || '').trim())
          .filter(Boolean)
      )]
    },
    getFilteredBatchApplyEntries(task) {
      const entries = this.getSkippedIssueEntries(task)
      const keyword = String(this.batchApplySearchText || '').trim().toLowerCase()
      return entries.filter(entry => {
        if (this.batchApplyQuickFilter === 'with_suggestion' && !String(entry.suggestion || '').trim()) {
          return false
        }
        if (this.batchApplyQuickFilter === 'exclude_punctuation' && this.isPunctuationOnlyText(entry.text)) {
          return false
        }
        if (this.batchApplyReasonFilter !== 'all' && String(entry.reason || '') !== this.batchApplyReasonFilter) {
          return false
        }
        if (keyword) {
          const haystack = [entry.text, entry.suggestion, entry.reason, entry.sentence].join(' ').toLowerCase()
          if (!haystack.includes(keyword)) return false
        }
        return true
      })
    },
    getBatchApplyGroups(task) {
      const groups = []
      const grouped = new Map()
      for (const entry of this.getFilteredBatchApplyEntries(task)) {
        if (!grouped.has(entry.itemIndex)) {
          const group = { itemIndex: entry.itemIndex, entries: [] }
          grouped.set(entry.itemIndex, group)
          groups.push(group)
        }
        grouped.get(entry.itemIndex).entries.push(entry)
      }
      return groups
    },
    getSkippedIssuePreview(task, limit = 8) {
      const entries = this.getSkippedIssueEntries(task)
      const preview = entries.slice(0, limit)
      const total = entries.length
      return { total, preview }
    },
    buildSkippedIssueConfirmMessage(task) {
      const { total, preview } = this.getSkippedIssuePreview(task)
      if (total <= 0) return '当前任务没有可写入的跳过项。'
      const lines = [
        `即将写入 ${total} 条已跳过批注的问题。`,
        `任务：${task?.title || '拼写与语法检查'}`,
        `范围：${this.formatChunkSource(task?.data?.chunkSource)}`,
        '',
        '预览：'
      ]
      preview.forEach(item => {
        const text = item.text || '（空）'
        const suggestion = item.suggestion ? ` -> ${item.suggestion}` : ''
        const reason = item.reason ? `（${item.reason}）` : ''
        lines.push(`第 ${item.itemIndex + 1} 段 / 问题 ${item.issueIndex + 1}：${text}${suggestion}${reason}`)
      })
      if (total > preview.length) {
        lines.push(`... 其余 ${total - preview.length} 条将在确认后继续写入`)
      }
      lines.push('', '确认继续写入吗？')
      return lines.join('\n')
    },
    getFilteredIssues(item) {
      const issues = item?.parsedItems || []
      let filtered = issues
      if (this.detailIssueFilter === 'all') {
        filtered = issues
      } else if (this.detailIssueFilter === 'failed') {
        filtered = issues.filter(issue => issue?.anchorStatus === 'failed')
      } else if (this.detailIssueFilter === 'fallback') {
        filtered = issues.filter(issue => issue?.anchorStatus === 'success' && this.anchorModeClass(issue) === 'fallback')
      } else if (this.detailIssueFilter === 'precise') {
        filtered = issues.filter(issue => issue?.anchorStatus === 'success' && this.anchorModeClass(issue) === 'precise')
      } else if (this.detailIssueFilter === 'skipped') {
        filtered = issues.filter(issue => issue?.anchorStatus === 'skipped')
      } else if (this.detailIssueFilter === 'risky') {
        filtered = issues.filter(issue => issue?.anchorStatus === 'failed' || this.anchorModeClass(issue) === 'fallback')
      } else if (this.detailIssueFilter === 'review') {
        filtered = issues.filter(issue => issue?.qualityLevel === 'review')
      } else if (this.detailIssueFilter === 'high_quality') {
        filtered = issues.filter(issue => issue?.qualityLevel === 'high')
      }
      const keyword = String(this.detailSearchText || '').trim().toLowerCase()
      if (!this.isDetailSearchScopeEnabled('issues')) return filtered
      if (!keyword) return filtered
      return filtered.filter(issue => this.buildIssueSearchText(issue).includes(keyword))
    },
    getDetailSearchScopeOptions() {
      return [
        { value: 'all', label: '搜全部' },
        { value: 'issues', label: '仅搜问题' },
        { value: 'diagnostic', label: '仅搜诊断' },
        { value: 'output', label: '仅搜输出' },
        { value: 'request', label: '仅搜请求' }
      ]
    },
    getDetailSearchScopeLabel(scope = this.detailSearchScope) {
      const found = this.getDetailSearchScopeOptions().find(option => option.value === scope)
      return found?.label || '搜全部'
    },
    isDetailSearchScopeEnabled(sectionName) {
      const scope = String(this.detailSearchScope || 'all')
      if (scope === 'all') return true
      return scope === String(sectionName || '')
    },
    buildIssueSearchText(issue) {
      return [
        issue?.text,
        issue?.suggestion,
        issue?.reason,
        issue?.sentence,
        issue?.prefix,
        issue?.suffix,
        issue?.anchorReasonLabel,
        issue?.anchorStatus,
        issue?.qualityLabel,
        issue?.qualityReason
      ].filter(Boolean).join(' ').toLowerCase()
    },
    getDetailSearchKeyword() {
      return String(this.detailSearchText || '').trim().toLowerCase()
    },
    textMatchesDetailKeyword(value) {
      const keyword = this.getDetailSearchKeyword()
      if (!keyword) return false
      return String(value || '').toLowerCase().includes(keyword)
    },
    itemMatchesDetailSearchSection(taskId, itemIndex, item, sectionName) {
      if (sectionName === 'request') {
        return this.textMatchesDetailKeyword(this.getRequestJson(taskId, itemIndex, item))
      }
      if (sectionName === 'output') {
        return this.textMatchesDetailKeyword([
          this.formatOutput(item),
          this.formatParsedOutput(item)
        ].join(' '))
      }
      if (sectionName === 'diagnostic') {
        return this.textMatchesDetailKeyword([
          item?.diagnostic?.rootCauseLabel,
          item?.diagnostic?.rootCauseSummary,
          Array.isArray(item?.diagnostic?.strategyTrace) ? item.diagnostic.strategyTrace.join(' ') : '',
          item?.repairRequest ? this.formatJson(item.repairRequest) : '',
          this.formatDiagnostic(item)
        ].join(' '))
      }
      if (sectionName === 'issues') {
        return (item?.parsedItems || []).some(issue => this.textMatchesDetailKeyword(this.buildIssueSearchText(issue)))
      }
      return false
    },
    buildDetailItemSearchText(taskId, itemIndex, item) {
      const segments = []
      if (this.isDetailSearchScopeEnabled('diagnostic')) {
        segments.push(
          item?.diagnostic?.rootCauseLabel,
          item?.diagnostic?.rootCauseSummary,
          Array.isArray(item?.diagnostic?.strategyTrace) ? item.diagnostic.strategyTrace.join(' ') : '',
          item?.repairRequest ? this.formatJson(item.repairRequest) : '',
          this.formatDiagnostic(item)
        )
      }
      if (this.isDetailSearchScopeEnabled('request')) {
        segments.push(this.getRequestJson(taskId, itemIndex, item))
      }
      if (this.isDetailSearchScopeEnabled('output')) {
        segments.push(this.formatOutput(item), this.formatParsedOutput(item))
      }
      if (this.isDetailSearchScopeEnabled('issues')) {
        const issueText = (item?.parsedItems || []).map(issue => this.buildIssueSearchText(issue)).join(' ')
        segments.push(issueText)
      }
      return segments.filter(Boolean).join(' ').toLowerCase()
    },
    detailItemMatchesSearch(taskId, itemIndex, item) {
      const keyword = String(this.detailSearchText || '').trim().toLowerCase()
      if (!keyword) return true
      return this.buildDetailItemSearchText(taskId, itemIndex, item).includes(keyword)
    },
    getFilteredDetailItems(task) {
      const taskId = String(task?.id || '')
      const items = Array.isArray(task?.data?.items) ? task.data.items : []
      return items.filter((item, itemIndex) => this.detailItemMatchesSearch(taskId, itemIndex, item))
    },
    getDetailSearchStats(task) {
      const stats = {
        matchedChunks: 0,
        issueMatches: 0,
        diagnosticMatches: 0,
        outputMatches: 0,
        requestMatches: 0
      }
      const keyword = this.getDetailSearchKeyword()
      const taskId = String(task?.id || '')
      const items = Array.isArray(task?.data?.items) ? task.data.items : []
      if (!keyword || items.length <= 0) return stats
      items.forEach((item, itemIndex) => {
        if (this.detailItemMatchesSearch(taskId, itemIndex, item)) {
          stats.matchedChunks++
        }
        const filteredIssues = this.getFilteredIssues(item)
        stats.issueMatches += filteredIssues.filter(issue => this.textMatchesDetailKeyword(this.buildIssueSearchText(issue))).length
        if (this.itemMatchesDetailSearchSection(taskId, itemIndex, item, 'diagnostic')) stats.diagnosticMatches++
        if (this.itemMatchesDetailSearchSection(taskId, itemIndex, item, 'output')) stats.outputMatches++
        if (this.itemMatchesDetailSearchSection(taskId, itemIndex, item, 'request')) stats.requestMatches++
      })
      return stats
    },
    getDetailSearchBreakdownText(task) {
      const keyword = this.getDetailSearchKeyword()
      if (!keyword) return ''
      const stats = this.getDetailSearchStats(task)
      const parts = []
      if (stats.issueMatches > 0) parts.push(`问题 ${stats.issueMatches} 处`)
      if (stats.diagnosticMatches > 0) parts.push(`诊断 ${stats.diagnosticMatches} 段`)
      if (stats.outputMatches > 0) parts.push(`输出 ${stats.outputMatches} 段`)
      if (stats.requestMatches > 0) parts.push(`请求 ${stats.requestMatches} 段`)
      if (parts.length <= 0) return '细分：当前关键词尚未命中问题、诊断、输出或请求内容'
      return `细分：${parts.join(' / ')}`
    },
    buildDetailSearchReport(task) {
      const keyword = String(this.detailSearchText || '').trim()
      const scopeLabel = this.getDetailSearchScopeLabel()
      const matchedItems = this.getFilteredDetailItems(task)
      const stats = this.getDetailSearchStats(task)
      const lines = [
        '# 搜索排障摘要',
        '',
        `- 任务：${task?.title || '未命名任务'}`,
        `- 任务ID：${task?.id || '-'}`,
        `- 搜索词：${keyword || '（空）'}`,
        `- 搜索范围：${scopeLabel}`,
        `- 命中分块：${matchedItems.length} / ${Array.isArray(task?.data?.items) ? task.data.items.length : 0}`,
        `- 细分统计：问题 ${stats.issueMatches} 处 / 诊断 ${stats.diagnosticMatches} 段 / 输出 ${stats.outputMatches} 段 / 请求 ${stats.requestMatches} 段`,
        ''
      ]
      if (matchedItems.length <= 0) {
        lines.push('当前搜索条件下没有匹配结果。')
        return lines.join('\n')
      }
      lines.push('## 命中分块')
      matchedItems.forEach((item, itemIndex) => {
        const originalIndex = (task?.data?.items || []).indexOf(item)
        const issueMatches = this.getFilteredIssues(item).filter(issue => this.textMatchesDetailKeyword(this.buildIssueSearchText(issue)))
        const summaryParts = []
        if (item?.diagnostic?.rootCauseLabel) summaryParts.push(`根因：${item.diagnostic.rootCauseLabel}`)
        if (item?.diagnostic?.rootCauseSummary) summaryParts.push(`说明：${this.normalizeSummaryText(item.diagnostic.rootCauseSummary)}`)
        if (issueMatches.length > 0) {
          const issuePreview = issueMatches.slice(0, 3).map(issue => {
            const text = issue?.text || '（空）'
            const suggestion = issue?.suggestion ? ` -> ${issue.suggestion}` : ''
            const reason = issue?.reason ? `（${issue.reason}）` : ''
            return `${text}${suggestion}${reason}`
          }).join('；')
          summaryParts.push(`问题命中：${issuePreview}`)
        }
        if (this.itemMatchesDetailSearchSection(task?.id, originalIndex, item, 'diagnostic') && item?.diagnostic?.rootCauseSummary) {
          summaryParts.push(`诊断命中：${this.normalizeSummaryText(item.diagnostic.rootCauseSummary)}`)
        }
        if (this.itemMatchesDetailSearchSection(task?.id, originalIndex, item, 'output')) {
          summaryParts.push(`输出命中：${this.normalizeSummaryText(this.formatOutput(item)).slice(0, 120)}`)
        }
        if (this.itemMatchesDetailSearchSection(task?.id, originalIndex, item, 'request')) {
          summaryParts.push(`请求命中：${this.normalizeSummaryText(this.getRequestJson(task?.id, originalIndex, item)).slice(0, 120)}`)
        }
        lines.push(`### 第 ${originalIndex + 1} 段`)
        lines.push(summaryParts.length > 0 ? summaryParts.join('\n') : '命中，但暂无可提炼摘要。')
        if (itemIndex < matchedItems.length - 1) {
          lines.push('')
        }
      })
      return lines.join('\n')
    },
    formatChunkSource(source) {
      if (source === 'workflow') return '工作流'
      return source === 'selection' ? '选中文本' : '全文'
    },
    getTaskDetailSegments(task) {
      const items = Array.isArray(task?.data?.items) ? task.data.items : []
      if (items.length > 0) {
        return items.map((item, index) => ({
          index,
          status: String(item?.status || '').trim() || 'pending',
          chunkText: String(item?.chunkText || '').trim(),
          output: String(item?.output || '').trim(),
          outputSummary: String(item?.outputSummary || '').trim()
        }))
      }
      const batchRecords = Array.isArray(task?.data?.batchRecords) ? task.data.batchRecords : []
      return batchRecords.map((record, index) => ({
        index,
        status: record?.response?.valid === true ? 'done' : 'pending',
        chunkText: String(record?.chunk?.normalizedText || record?.chunk?.rawText || '').trim(),
        output: String(record?.response?.parsed?.content || record?.response?.parsed?.summary || '').trim(),
        outputSummary: record?.response?.valid === true
          ? `已解析 ${Array.isArray(record?.operations) ? record.operations.length : 0} 条结构化操作`
          : String(record?.response?.error || '').trim()
      }))
    },
    getTaskDetailSegmentTotal(task) {
      const segments = this.getTaskDetailSegments(task)
      if (segments.length > 0) return segments.length
      const total = Number(task?.total || 0)
      return total > 0 ? total : 0
    },
    getTaskDetailCurrentSegmentIndex(task) {
      const current = Number(task?.current || 0)
      const total = this.getTaskDetailSegmentTotal(task)
      if (current > 0) return Math.min(current, total || current)
      if (task?.status === 'completed' && total > 0) return total
      return 0
    },
    getTaskDetailCurrentSegmentLabel(task) {
      const current = this.getTaskDetailCurrentSegmentIndex(task)
      const total = this.getTaskDetailSegmentTotal(task)
      if (current > 0 && total > 0) return `第 ${current} / ${total} 段`
      if (total > 0) return `共 ${total} 段`
      return '暂无分段信息'
    },
    isTaskDetailCurrentSegment(task, idx) {
      const current = this.getTaskDetailCurrentSegmentIndex(task)
      return current > 0 && Number(idx) === current - 1
    },
    getTaskDetailSegmentStatusLabel(task, idx, segment) {
      if (this.isTaskDetailCurrentSegment(task, idx) && task?.status === 'running') {
        return '执行中'
      }
      if (segment?.status === 'done') return '已完成'
      if (segment?.status === 'running') return '执行中'
      if (task?.status === 'completed') return '已完成'
      return '待处理'
    },
    getTaskDetailSegmentText(segment) {
      const primary = String(segment?.chunkText || '').trim()
      if (primary) return primary
      const fallback = String(segment?.outputSummary || segment?.output || '').trim()
      return fallback || '暂无该段内容预览'
    },
    getStructuredExecutionSummary(task) {
      const plan = task?.data?.executionPlan
      if (!plan?.summary) return null
      return {
        documentContext: plan.documentContext || {},
        requestContext: plan.requestContext || {},
        summary: plan.summary || {},
        operationArbitration: plan.operationArbitration?.summary || {}
      }
    },
    getStructuredExecutionBlocks(task) {
      const blocks = Array.isArray(task?.data?.executionPlan?.contentBlocks)
        ? task.data.executionPlan.contentBlocks
        : []
      return blocks.slice(0, 20).map((block) => ({
        chunkIndex: Number(block?.chunkIndex || 0) + 1,
        absoluteStart: Number(block?.start || 0),
        absoluteEnd: Number(block?.end || 0),
        quality: block?.quality || null,
        riskProfile: block?.riskProfile || null,
        riskSummary: String(block?.riskProfile?.message || '').trim(),
        qualitySummary: String(block?.quality?.message || '').trim(),
        paragraphRefs: Array.isArray(block?.paragraphRefs) ? block.paragraphRefs : [],
        relativeRangeMap: Array.isArray(block?.relativeRangeMap) ? block.relativeRangeMap : [],
        inputPreview: String(block?.inputText || '').trim().slice(0, 180),
        outputPreview: String(block?.outputText || '').trim().slice(0, 180)
      }))
    },
    getStructuredOperationValidation(task) {
      const operations = Array.isArray(task?.data?.executionPlan?.operations)
        ? task.data.executionPlan.operations
        : []
      return operations.slice(0, 40).map((operation) => ({
        operationId: String(operation?.operationId || '').trim(),
        type: String(operation?.type || '').trim(),
        target: String(operation?.target || '').trim(),
        start: Number(operation?.start || 0),
        end: Number(operation?.end || 0),
        paragraphIndex: Number.isFinite(Number(operation?.paragraphIndex)) ? Number(operation.paragraphIndex) : null,
        arbitrationStatus: String(operation?.arbitrationStatus || '').trim(),
        arbitrationReason: String(operation?.arbitrationReason || '').trim(),
        validationStatus: String(operation?.validationStatus || '').trim(),
        validationMessage: String(operation?.validationMessage || '').trim(),
        exactTextMatch: operation?.exactTextMatch === true,
        originalText: String(operation?.originalText || '').trim(),
        matchedText: String(operation?.matchedText || '').trim(),
        replacementText: String(operation?.replacementText || '').trim()
      }))
    },
    getStructuredRejectedOperations(task) {
      const rejected = Array.isArray(task?.data?.executionPlan?.operationArbitration?.rejectedOperations)
        ? task.data.executionPlan.operationArbitration.rejectedOperations
        : []
      return rejected.slice(0, 40).map((operation) => ({
        operationId: String(operation?.operationId || '').trim(),
        type: String(operation?.type || '').trim(),
        target: String(operation?.target || '').trim(),
        start: Number(operation?.start || 0),
        end: Number(operation?.end || 0),
        arbitrationReason: String(operation?.arbitrationReason || '').trim(),
        conflictWithOperationId: String(operation?.conflictWithOperationId || '').trim(),
        validationStatus: String(operation?.validationStatus || '').trim(),
        originalText: String(operation?.originalText || '').trim(),
        replacementText: String(operation?.replacementText || '').trim()
      }))
    },
    formatTime(value) {
      if (!value) return '-'
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return String(value)
      const pad = n => String(n).padStart(2, '0')
      return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    },
    strategyLabel(step) {
      const map = {
        drop_stream: '关闭流式',
        drop_response_format: '移除结构化参数',
        constrained_retry: '二次约束重试',
        json_repair: 'JSON 修复'
      }
      return map[step] || step
    },
    causeClass(diagnostic) {
      const severity = diagnostic?.severity || 'warning'
      return {
        info: severity === 'info',
        warning: severity === 'warning',
        error: severity === 'error'
      }
    },
    anchorModeClass(issue) {
      const code = String(issue?.anchorReasonCode || '')
      if (code.startsWith('sentence_fallback_')) return 'fallback'
      return 'precise'
    },
    anchorModeLabel(issue) {
      const code = String(issue?.anchorReasonCode || '')
      if (code.startsWith('sentence_fallback_')) return '整句回退'
      return '精确命中'
    },
    anchorStatusLabel(issue) {
      const status = String(issue?.anchorStatus || '')
      if (status === 'success') return '定位成功'
      if (status === 'skipped') return '已跳过批注'
      return '定位失败'
    },
    statusIcon(status) {
      const map = { pending: '⏳', running: '🔄', paused: '⏸', completed: '✅', failed: '❌', cancelled: '⊘', abnormal: '⚠' }
      return map[status] || '•'
    },
    taskStatusLabel(status) {
      const map = {
        pending: '待执行',
        running: '进行中',
        paused: '已暂停',
        completed: '已完成',
        failed: '失败',
        cancelled: '已停止',
        abnormal: '异常结束'
      }
      return map[String(status || '')] || '未知状态'
    },
    toggleExpand(id) {
      this.expandedId = this.expandedId === id ? null : id
      this.saveTaskListUiState()
    },
    clearCompleted() {
      clearCompletedTasks()
    },
    clearFailed() {
      const ids = this.topLevelTasks.filter(t => t.status === 'failed' || t.status === 'abnormal').map(t => t.id)
      ids.forEach(id => this.removeTaskWithChildren(id))
    },
    clearFilteredTasks() {
      const removable = this.filteredTasks.filter(task => task.status !== 'running' && task.status !== 'pending')
      if (removable.length === 0) return
      removable.map(task => task.id).forEach(id => this.removeTaskWithChildren(id))
    },
    stopTask(taskId) {
      const task = getTaskById(taskId) || this.tasks.find(item => item.id === taskId)
      const ok = this.isWorkflowTask(task)
        ? stopWorkflowRun(taskId)
        : task?.type === 'spell-check'
        ? stopSpellCheckTask(taskId)
        : task?.type === 'assistant-prompt-recommendation'
          ? stopAssistantPromptRecommendationTask(taskId)
          : task?.type === 'form-audit'
            ? stopFormAuditTask(taskId)
            : task?.type === 'wps-capability'
              ? stopWpsCapabilityTask(taskId)
          : String(task?.type || '').startsWith('multimodal-')
            ? stopMultimodalTask(taskId)
          : stopAssistantTask(taskId)
      syncTasksFromStorage()
      let latestTask = getTaskById(taskId) || this.tasks.find(item => item.id === taskId)
      if (!ok) {
        if (latestTask && (latestTask.status === 'running' || latestTask.status === 'pending')) {
          updateTask(taskId, {
            status: 'abnormal',
            error: latestTask.error || '任务已结束或进程已退出，已标记为异常结束'
          })
          syncTasksFromStorage()
          latestTask = getTaskById(taskId) || latestTask
        }
        if (this.detailTask?.id === taskId && latestTask) {
          this.detailTask = latestTask
        }
        return
      }
      this.detailTask = this.detailTask?.id === taskId ? (latestTask || this.detailTask) : this.detailTask
    },
    openTaskProgress(taskId) {
      const task = getTaskById(taskId) || this.tasks.find(item => item.id === taskId)
      if (!taskId || !task) return
      try {
        const href = String(window.location.href || '')
        const base = href.split('#')[0] || href
        const url = `${base}#/task-progress-dialog?taskId=${encodeURIComponent(taskId)}`
        if (window.Application?.ShowDialog) {
          window.Application.ShowDialog(
            url,
            task.title || '任务进度',
            520 * (window.devicePixelRatio || 1),
            260 * (window.devicePixelRatio || 1),
            false
          )
          return
        }
        window.open(url, '_blank')
      } catch (_) {
        alert('打开进度窗失败')
      }
    },
    openLinkedTaskDetail(taskId) {
      const normalized = String(taskId || '').trim()
      if (!normalized) return
      const task = getTaskById(normalized) || this.tasks.find(item => item.id === normalized)
      if (task) {
        this.openDetail(task)
        return
      }
      try {
        const href = String(window.location.href || '')
        const base = href.split('#')[0] || href
        const url = `${base}#/popup?taskId=${encodeURIComponent(normalized)}&detail=1`
        if (window.Application?.ShowDialog) {
          window.Application.ShowDialog(
            url,
            '任务清单',
            980 * (window.devicePixelRatio || 1),
            760 * (window.devicePixelRatio || 1),
            false
          )
          return
        }
        window.open(url, '_blank')
      } catch (e) {
        void e
      }
    },
    openAssistantSettings(taskKey = '') {
      const normalizedTaskKey = String(taskKey || 'create-custom-assistant')
      try {
        return openSettingsWindow({ menu: 'assistant-settings', item: normalizedTaskKey }, { title: '助手设置' })
      } catch (_) {
        return false
      }
    },
    applyRecommendationToSettings(task) {
      if (!this.canApplyRecommendationToSettings(task)) {
        alert('当前任务没有可应用的推荐设置')
        return
      }
      try {
        const targetKey = String(task?.data?.recommendationTargetKey || 'create-custom-assistant')
        const targetLabel = String(task?.data?.recommendationTargetLabel || '当前助手')
        dispatchAssistantRecommendationApplyRequest({
          taskId: task.id,
          taskTitle: task.title,
          targetKey,
          targetLabel,
          requirementText: String(task?.data?.recommendationRequirement || ''),
          recommendedConfig: task?.data?.recommendedConfig || null
        })
        const opened = this.openAssistantSettings(targetKey)
        alert(opened
          ? `已将推荐结果发送到“${targetLabel}”的设置页，请在设置页确认并保存。`
          : `已发送应用请求，请切换到“${targetLabel}”的设置页查看并保存。`)
      } catch (error) {
        alert(`应用失败：${error?.message || error}`)
      }
    },
    syncRouteTaskFocus(force = false) {
      const routeTaskId = String(this.$route?.query?.taskId || '')
      const shouldOpenDetail = String(this.$route?.query?.detail || '') === '1'
      if (!routeTaskId) {
        this.suppressRouteDetailTaskId = ''
        return false
      }
      if (this.suppressRouteDetailTaskId && this.suppressRouteDetailTaskId !== routeTaskId) {
        this.suppressRouteDetailTaskId = ''
      }
      if (shouldOpenDetail && this.suppressRouteDetailTaskId === routeTaskId) {
        return false
      }
      if (!force && this.detailTask?.id === routeTaskId) return true
      const task = getTaskById(routeTaskId) || this.tasks.find(item => item.id === routeTaskId)
      if (!task) return false
      this.expandedId = routeTaskId
      if (shouldOpenDetail) {
        this.openDetail(task)
      }
      return true
    },
    restorePersistedTaskFocus(force = false) {
      if (this.$route?.query?.taskId) return false
      if (this.expandedId) {
        const expandedTask = getTaskById(this.expandedId) || this.tasks.find(item => item.id === this.expandedId)
        if (!expandedTask) {
          this.expandedId = null
        }
      }
      if (!this.pendingDetailTaskId) return false
      const currentDetailTask = this.detailTask?.id
        ? (getTaskById(this.detailTask.id) || this.tasks.find(item => item.id === this.detailTask.id))
        : null
      if (!force && currentDetailTask?.id === this.pendingDetailTaskId) {
        this.detailTask = { ...currentDetailTask }
        return true
      }
      const task = getTaskById(this.pendingDetailTaskId) || this.tasks.find(item => item.id === this.pendingDetailTaskId)
      if (!task) {
        if (this.detailTask?.id === this.pendingDetailTaskId) {
          this.detailTask = null
          this.retryingIndex = -1
          this.closeBatchApplyPreview()
        }
        const currentScrollTopByTask = this.detailScrollTopByTask && typeof this.detailScrollTopByTask === 'object'
          ? this.detailScrollTopByTask
          : {}
        if (currentScrollTopByTask[this.pendingDetailTaskId] != null) {
          const nextScrollTopByTask = { ...currentScrollTopByTask }
          delete nextScrollTopByTask[this.pendingDetailTaskId]
          this.detailScrollTopByTask = nextScrollTopByTask
        }
        this.pendingDetailTaskId = ''
        this.saveTaskListUiState()
        return false
      }
      this.openDetail(task)
      return true
    },
    openDetail(task) {
      this.suppressRouteDetailTaskId = ''
      this.persistCurrentDetailScroll(true)
      this.expandedId = task?.id || this.expandedId
      this.detailTask = { ...task }
      this._detailItemEls = Object.create(null)
      this.pendingDetailTaskId = String(task?.id || '')
      this.closeBatchApplyPreview()
      this.saveTaskListUiState()
      this.restoreDetailScroll(task?.id)
      this.syncDetailSearchSelection(false)
      this.$nextTick(() => {
        this.scheduleDetailViewportUpdate()
      })
    },
    closeDetail() {
      this.suppressRouteDetailTaskId = String(this.$route?.query?.taskId || this.detailTask?.id || '')
      this.persistCurrentDetailScroll(true)
      this.detailTask = null
      this.detailSearchCurrentIndex = -1
      this.detailSearchFlashIndex = -1
      this._detailItemEls = Object.create(null)
      this.pendingDetailTaskId = ''
      this.retryingIndex = -1
      this.closeBatchApplyPreview()
      this.saveTaskListUiState()
      if (this.$route?.query?.taskId) {
        this.$router.replace({ path: this.$route.path, query: {} }).catch(() => {})
      }
    },
    formatRequestJson(item) {
      if (item?.request) {
        return this.formatJson(item.request)
      }
      if (item?.input != null) {
        return String(item.input)
      }
      return '（无请求参数）'
    },
    formatJson(value) {
      try {
        return JSON.stringify(value, null, 2)
      } catch (_) {
        return String(value)
      }
    },
    escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    },
    escapeRegExp(value) {
      return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    },
    highlightDetailText(value, sectionName = 'all') {
      const source = String(value ?? '')
      const escapedSource = this.escapeHtml(source)
      const keyword = String(this.detailSearchText || '').trim()
      if (!keyword) return escapedSource
      if (sectionName !== 'all' && !this.isDetailSearchScopeEnabled(sectionName)) return escapedSource
      const escapedKeyword = this.escapeRegExp(keyword)
      if (!escapedKeyword) return escapedSource
      const regex = new RegExp(`(${escapedKeyword})`, 'ig')
      return escapedSource.replace(regex, '<mark class="detail-search-highlight">$1</mark>')
    },
    setDetailItemRef(itemIndex, el) {
      const key = String(itemIndex)
      if (!this._detailItemEls) this._detailItemEls = Object.create(null)
      if (!el) {
        delete this._detailItemEls[key]
        return
      }
      this._detailItemEls[key] = el
    },
    getFilteredDetailItemIndexes(task) {
      const taskId = String(task?.id || '')
      const items = Array.isArray(task?.data?.items) ? task.data.items : []
      return items.reduce((acc, item, itemIndex) => {
        if (this.detailItemMatchesSearch(taskId, itemIndex, item)) {
          acc.push(itemIndex)
        }
        return acc
      }, [])
    },
    getCurrentDetailSearchPosition(task) {
      const indexes = this.getFilteredDetailItemIndexes(task)
      if (indexes.length <= 0) return 0
      const currentPos = indexes.indexOf(this.detailSearchCurrentIndex)
      return currentPos >= 0 ? currentPos + 1 : 1
    },
    getDetailSearchMarkers(task) {
      const indexes = this.getFilteredDetailItemIndexes(task)
      const totalItems = Array.isArray(task?.data?.items) ? task.data.items.length : 0
      const denominator = Math.max(totalItems - 1, 1)
      return indexes.map((itemIndex, markerIndex) => ({
        itemIndex,
        matchOrder: markerIndex + 1,
        totalMatches: indexes.length,
        position: Number((Math.min(98, Math.max(2, ((itemIndex / denominator) || 0) * 100))).toFixed(2))
      }))
    },
    syncDetailSearchSelection(shouldScroll = false) {
      const task = this.detailTask
      if (!task?.id) {
        this.detailSearchCurrentIndex = -1
        return
      }
      const indexes = this.getFilteredDetailItemIndexes(task)
      if (indexes.length <= 0) {
        this.detailSearchCurrentIndex = -1
        return
      }
      if (!indexes.includes(this.detailSearchCurrentIndex)) {
        this.detailSearchCurrentIndex = indexes[0]
      }
      if (shouldScroll) {
        this.scrollToDetailItem(this.detailSearchCurrentIndex)
      }
    },
    jumpToDetailSearchMarker(itemIndex) {
      const normalizedIndex = Number(itemIndex)
      if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0) return
      this.detailSearchCurrentIndex = normalizedIndex
      this.scrollToDetailItem(normalizedIndex)
    },
    scrollToDetailItem(itemIndex) {
      this.detailSearchFlashIndex = itemIndex
      if (this.detailSearchFlashTimer) {
        clearTimeout(this.detailSearchFlashTimer)
      }
      this.detailSearchFlashTimer = setTimeout(() => {
        this.detailSearchFlashIndex = -1
        this.detailSearchFlashTimer = null
      }, 1400)
      this.$nextTick(() => {
        const el = this._detailItemEls && this._detailItemEls[String(itemIndex)]
        if (!el || !el.scrollIntoView) return
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' })
        } catch (_) {
          el.scrollIntoView()
        }
      })
    },
    jumpToDetailSearchMatch(task, direction = 1) {
      const indexes = this.getFilteredDetailItemIndexes(task)
      if (indexes.length <= 0) return
      const currentPos = indexes.indexOf(this.detailSearchCurrentIndex)
      const basePos = currentPos >= 0 ? currentPos : 0
      const nextPos = (basePos + (direction >= 0 ? 1 : -1) + indexes.length) % indexes.length
      this.detailSearchCurrentIndex = indexes[nextPos]
      this.scrollToDetailItem(this.detailSearchCurrentIndex)
    },
    async copyTextToClipboard(text, successMessage = '已复制') {
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(String(text || ''))
        } else {
          const textarea = document.createElement('textarea')
          textarea.value = String(text || '')
          textarea.setAttribute('readonly', 'readonly')
          textarea.style.position = 'fixed'
          textarea.style.left = '-9999px'
          document.body.appendChild(textarea)
          textarea.select()
          document.execCommand('copy')
          document.body.removeChild(textarea)
        }
        alert(successMessage)
      } catch (e) {
        reportError('复制失败', e)
      }
    },
    getRequestJson(taskId, itemIdx, item) {
      const key = `${taskId}-${itemIdx}`
      if (this.editedRequests[key] !== undefined) return this.editedRequests[key]
      return this.formatRequestJson(item)
    },
    setRequestJson(taskId, itemIdx, value) {
      const key = `${taskId}-${itemIdx}`
      this.editedRequests = { ...this.editedRequests, [key]: value }
    },
    isRequestEditMode(taskId, itemIdx) {
      const key = `${taskId}-${itemIdx}`
      return this.requestEditMode[key] === true
    },
    toggleRequestMode(taskId, itemIdx) {
      const key = `${taskId}-${itemIdx}`
      this.requestEditMode = { ...this.requestEditMode, [key]: !this.requestEditMode[key] }
    },
    isOutputTreeMode(taskId, itemIdx) {
      const key = `${taskId}-${itemIdx}`
      return this.outputTreeMode[key] === true
    },
    toggleOutputMode(taskId, itemIdx) {
      const key = `${taskId}-${itemIdx}`
      this.outputTreeMode = { ...this.outputTreeMode, [key]: !this.outputTreeMode[key] }
    },
    getRequestParsed(taskId, itemIdx, item) {
      const key = `${taskId}-${itemIdx}`
      let str = this.editedRequests[key]
      if (str === undefined) str = this.formatRequestJson(item)
      if (!str || str === '（无请求参数）') return null
      try {
        const parsed = JSON.parse(str)
        return parsed && (typeof parsed === 'object' || Array.isArray(parsed)) ? parsed : null
      } catch (_) {
        return null
      }
    },
    getOutputParsed(item) {
      const out = item?.output
      if (out == null || out === '') return null
      try {
        const parsed = JSON.parse(String(out))
        return parsed && (typeof parsed === 'object' || Array.isArray(parsed)) ? parsed : null
      } catch (_) {
        return null
      }
    },
    getParsedResultObject(item) {
      const out = item?.parsedOutput
      if (out == null || out === '') return null
      try {
        const parsed = JSON.parse(String(out))
        return parsed && typeof parsed === 'object' ? parsed : null
      } catch (_) {
        return null
      }
    },
    getDiagnosticObject(item) {
      const val = item?.diagnostic
      if (!val) return null
      return typeof val === 'object' ? val : null
    },
    formatOutput(item) {
      if (item?.error) return item.error
      if (item?.output != null && item.output !== '') return String(item.output)
      return '（请求完成后显示）'
    },
    formatParsedOutput(item) {
      if (item?.parseError) return item.parseError
      if (item?.parsedOutput != null && item.parsedOutput !== '') return String(item.parsedOutput)
      return '（暂无解析结果）'
    },
    formatDiagnostic(item) {
      if (item?.diagnostic) return this.formatJson(item.diagnostic)
      const fallback = {
        error: item?.error || null,
        parseError: item?.parseError || null,
        request: item?.request || null,
        output: item?.output || '',
        parsedOutput: item?.parsedOutput || ''
      }
      return this.formatJson(fallback)
    },
    maskText(text, options = {}) {
      const value = String(text || '')
      const limit = Number(options.limit || 120)
      if (!value.trim()) return ''
      return `[已脱敏，原文长度 ${value.length} 字符，仅保留前 ${Math.min(limit, value.length)} 字符预览] ${value.slice(0, limit)}`
    },
    sanitizeSnapshotValue(value, context = {}) {
      if (value == null) return value
      if (typeof value === 'string') {
        if (context.maskText || value.length > 200) {
          return this.maskText(value, { limit: context.limit || 120 })
        }
        return value
      }
      if (Array.isArray(value)) {
        const limit = context.arrayLimit || value.length
        const items = value.slice(0, limit).map(item => this.sanitizeSnapshotValue(item, context.childContext || {}))
        if (value.length > limit) {
          items.push(`[已截断，剩余 ${value.length - limit} 项未导出]`)
        }
        return items
      }
      if (typeof value === 'object') {
        const next = {}
        Object.keys(value).forEach((key) => {
          const lowerKey = String(key || '').toLowerCase()
          const shouldMask = (
            lowerKey.includes('prompt') ||
            lowerKey.includes('input') ||
            lowerKey.includes('output') ||
            lowerKey.includes('text') ||
            lowerKey.includes('content') ||
            lowerKey.includes('sentence') ||
            lowerKey.includes('suggestion') ||
            lowerKey.includes('comment')
          )
          next[key] = this.sanitizeSnapshotValue(value[key], {
            maskText: shouldMask,
            limit: shouldMask ? 120 : 160,
            arrayLimit: 10,
            childContext: {}
          })
        })
        return next
      }
      return value
    },
    getTaskDebugSnapshotObject(task) {
      const data = task?.data || {}
      return {
        exportedAt: new Date().toISOString(),
        task: {
          id: task?.id || '',
          title: task?.title || '',
          type: task?.type || '',
          status: task?.status || '',
          progress: task?.progress ?? null,
          current: task?.current ?? null,
          total: task?.total ?? null,
          createdAt: task?.createdAt || null,
          updatedAt: task?.updatedAt || null,
          error: task?.error || null
        },
        execution: {
          assistantId: this.getTaskAssistantId(task),
          entry: data.entry || null,
          primaryIntent: data.primaryIntent || null,
          executionMode: data.executionMode || null,
          taskPhase: data.taskPhase || null,
          source: data.source || null,
          launchSource: this.formatLaunchSource(data.launchSource),
          strictAssistantDefaults: data.strictAssistantDefaults === true,
          modelId: data.modelId || null,
          modelDisplayName: data.modelDisplayName || null,
          modelProviderId: data.modelProviderId || null,
          modelSource: this.formatModelSource(data.modelSource),
          configuredInputSource: this.formatInputSource(data.configuredInputSource),
          actualInputSource: this.formatChunkSource(data.inputSource || data.chunkSource),
          chunkSource: this.formatChunkSource(data.chunkSource),
          documentAction: this.formatDocumentAction(data.documentAction),
          outputFormat: data.outputFormat || null,
          targetLanguage: data.targetLanguage || null,
          temperature: data.temperature ?? null,
          generatedMediaKind: data.generatedMediaKind || null,
          generatedMediaPath: data.generatedMediaPath || null,
          progressStage: data.progressStage || null
        },
        diagnostics: {
          genericBadge: this.getGenericTaskBadge(task) || null,
          genericConclusion: this.getGenericTaskConclusion(task) || null,
          genericRiskHint: this.getGenericTaskRiskHint(task) || null,
          genericKeywords: this.getGenericTaskKeywords(task) || null,
          rootCauseLabel: this.getTaskCauseLabel(task) || null,
          rootCauseSummary: this.getTaskCauseSummary(task) || null,
          anchorStats: this.hasAnchorStats(task) ? this.getAnchorStats(task) : null,
          qualityStats: this.hasQualityStats(task) ? this.getQualityStats(task) : null
        },
        promptVariables: data.promptVariables || null,
        prompts: {
          system: data.renderedSystemPrompt || '',
          user: data.renderedUserPrompt || ''
        },
        previews: {
          inputPreview: data.inputPreview || '',
          outputPreview: data.outputPreview || '',
          commentPreview: data.commentPreview || ''
        },
        workflow: this.isWorkflowTask(task) ? {
          workflowId: data.workflowId || null,
          workflowName: data.workflowName || task?.title || '',
          snapshot: data.snapshot || null,
          nodeRuns: Array.isArray(data.nodeRuns) ? data.nodeRuns : [],
          nodeOutputs: Array.isArray(data.nodeOutputs) ? data.nodeOutputs : []
        } : null,
        applyResult: data.applyResult || null,
        previewBlocks: this.getTaskPreviewBlocks(task),
        writeTargets: this.getTaskWriteTargets(task),
        generatedArtifacts: this.getTaskGeneratedArtifacts(task),
        structuredTaskSnapshot: data.structuredTaskSnapshot || null,
        fullOutput: data.fullOutput || '',
        items: Array.isArray(data.items) ? data.items : []
      }
    },
    buildTaskDebugSnapshot(task) {
      return this.formatJson(this.getTaskDebugSnapshotObject(task))
    },
    buildTaskSanitizedDebugSnapshot(task) {
      const snapshot = this.getTaskDebugSnapshotObject(task)
      const sanitized = {
        ...snapshot,
        exportMode: 'sanitized',
        prompts: this.sanitizeSnapshotValue(snapshot.prompts, { maskText: true, limit: 120 }),
        promptVariables: this.sanitizeSnapshotValue(snapshot.promptVariables, { maskText: true, limit: 80 }),
        previews: this.sanitizeSnapshotValue(snapshot.previews, { maskText: true, limit: 80 }),
        applyResult: this.sanitizeSnapshotValue(snapshot.applyResult, { maskText: true, limit: 80 }),
        structuredTaskSnapshot: this.sanitizeSnapshotValue(snapshot.structuredTaskSnapshot, {
          maskText: true,
          limit: 100,
          arrayLimit: 20,
          childContext: { maskText: true, limit: 80 }
        }),
        fullOutput: this.maskText(snapshot.fullOutput, { limit: 120 }),
        items: this.sanitizeSnapshotValue(snapshot.items, { arrayLimit: 10, childContext: { maskText: true, limit: 80 } })
      }
      return this.formatJson(sanitized)
    },
    formatMarkdownCodeBlock(text) {
      const value = String(text || '').trim()
      return value || '（空）'
    },
    buildTaskMarkdownReport(task) {
      const snapshot = JSON.parse(this.buildTaskSanitizedDebugSnapshot(task))
      const lines = [
        `# 任务排障报告`,
        '',
        `## 任务信息`,
        `- 标题：${snapshot.task?.title || '-'}`,
        `- ID：${snapshot.task?.id || '-'}`,
        `- 类型：${snapshot.task?.type || '-'}`,
        `- 状态：${snapshot.task?.status || '-'}`,
        `- 进度：${snapshot.task?.progress ?? '-'}`,
        `- 创建时间：${snapshot.task?.createdAt || '-'}`,
        `- 更新时间：${snapshot.task?.updatedAt || '-'}`,
        `- 错误：${snapshot.task?.error || '无'}`,
        '',
        `## 执行参数`,
        `- 助手ID：${snapshot.execution?.assistantId || '-'}`,
        `- 最终模型：${snapshot.execution?.modelDisplayName || '-'}（${snapshot.execution?.modelProviderId || '-'}）`,
        `- 模型来源：${snapshot.execution?.modelSource || '-'}`,
        `- 执行入口：${snapshot.execution?.launchSource || '-'}`,
        `- 严格默认策略：${snapshot.execution?.strictAssistantDefaults ? '已启用' : '未启用'}`,
        `- 配置输入来源：${snapshot.execution?.configuredInputSource || '-'}`,
        `- 实际输入来源：${snapshot.execution?.actualInputSource || '-'}`,
        `- 文档动作：${snapshot.execution?.documentAction || '-'}`,
        `- 目标语言：${snapshot.execution?.targetLanguage || '-'}`,
        `- 输出格式：${snapshot.execution?.outputFormat || '-'}`,
        `- 温度：${snapshot.execution?.temperature ?? '-'}`,
        `- 执行阶段：${snapshot.execution?.progressStage || '-'}`,
        '',
        `## 诊断摘要`,
        `- 结论标签：${snapshot.diagnostics?.genericBadge || '无'}`,
        `- 任务结论：${snapshot.diagnostics?.genericConclusion || '无'}`,
        `- 风险提示：${snapshot.diagnostics?.genericRiskHint || '无'}`,
        `- 关键词：${snapshot.diagnostics?.genericKeywords || '无'}`,
        `- 根因标签：${snapshot.diagnostics?.rootCauseLabel || '无'}`,
        `- 根因说明：${snapshot.diagnostics?.rootCauseSummary || '无'}`,
        ''
      ]
      if (snapshot.diagnostics?.anchorStats) {
        lines.push(`- 定位统计：${this.formatJson(snapshot.diagnostics.anchorStats)}`)
      }
      if (snapshot.diagnostics?.qualityStats) {
        lines.push(`- 质量统计：${this.formatJson(snapshot.diagnostics.qualityStats)}`)
      }
      lines.push(
        '',
        `## 变量值`,
        '```json',
        this.formatMarkdownCodeBlock(this.formatJson(snapshot.promptVariables || {})),
        '```',
        '',
        `## 提示词`,
        `### System Prompt`,
        '```text',
        this.formatMarkdownCodeBlock(snapshot.prompts?.system || ''),
        '```',
        '',
        `### User Prompt`,
        '```text',
        this.formatMarkdownCodeBlock(snapshot.prompts?.user || ''),
        '```',
        '',
        `## 结果预览`,
        `### 输入预览`,
        '```text',
        this.formatMarkdownCodeBlock(snapshot.previews?.inputPreview || ''),
        '```',
        '',
        `### 输出预览`,
        '```text',
        this.formatMarkdownCodeBlock(snapshot.previews?.outputPreview || ''),
        '```',
        '',
        `### 写回结果`,
        '```json',
        this.formatMarkdownCodeBlock(this.formatJson(snapshot.applyResult || {})),
        '```',
        '',
        `### 结构化任务快照`,
        '```json',
        this.formatMarkdownCodeBlock(this.formatJson(snapshot.structuredTaskSnapshot || {})),
        '```',
        '',
        `### 完整输出（脱敏）`,
        '```text',
        this.formatMarkdownCodeBlock(snapshot.fullOutput || ''),
        '```',
        '',
        `## 明细项`,
        '```json',
        this.formatMarkdownCodeBlock(this.formatJson(snapshot.items || [])),
        '```'
      )
      return lines.join('\n')
    },
    getCurrentFilterSnapshot() {
      return {
        searchText: this.searchText || '',
        statusFilter: this.statusFilter,
        sourceFilter: this.sourceFilter,
        causeFilter: this.causeFilter,
        resultFilter: this.resultFilter,
        riskFilter: this.riskFilter,
        anchorFilter: this.anchorFilter,
        sortBy: this.sortBy,
        overviewScope: this.overviewScope
      }
    },
    getBatchTaskDebugSnapshotObject(tasks, options = {}) {
      const list = Array.isArray(tasks) ? tasks : []
      const exportMode = options.exportMode || 'full'
      const taskSnapshots = list.map(task => {
        if (exportMode === 'sanitized') {
          return JSON.parse(this.buildTaskSanitizedDebugSnapshot(task))
        }
        return this.getTaskDebugSnapshotObject(task)
      })
      return {
        exportedAt: new Date().toISOString(),
        exportMode,
        summary: {
          totalTasks: list.length,
          completed: list.filter(task => task.status === 'completed').length,
          failed: list.filter(task => task.status === 'failed').length,
          running: list.filter(task => task.status === 'running').length,
          cancelled: list.filter(task => task.status === 'cancelled').length,
          abnormal: list.filter(task => task.status === 'abnormal').length
        },
        filters: this.getCurrentFilterSnapshot(),
        tasks: taskSnapshots
      }
    },
    buildFilteredTasksMarkdownReport(tasks) {
      const snapshot = this.getBatchTaskDebugSnapshotObject(tasks, { exportMode: 'sanitized' })
      const lines = [
        '# 任务汇总排障报告',
        '',
        '## 汇总信息',
        `- 任务总数：${snapshot.summary.totalTasks}`,
        `- 已完成：${snapshot.summary.completed}`,
        `- 失败：${snapshot.summary.failed}`,
        `- 进行中：${snapshot.summary.running}`,
        `- 已取消：${snapshot.summary.cancelled}`,
        `- 异常结束：${snapshot.summary.abnormal ?? 0}`,
        '',
        '## 当前筛选条件',
        '```json',
        this.formatMarkdownCodeBlock(this.formatJson(snapshot.filters)),
        '```',
        '',
        '## 任务列表'
      ]
      snapshot.tasks.forEach((taskSnapshot, index) => {
        lines.push(
          '',
          `### ${index + 1}. ${taskSnapshot.task?.title || '未命名任务'}`,
          `- 任务ID：${taskSnapshot.task?.id || '-'}`,
          `- 状态：${taskSnapshot.task?.status || '-'}`,
          `- 类型：${taskSnapshot.task?.type || '-'}`,
          `- 最终模型：${taskSnapshot.execution?.modelDisplayName || '-'}（${taskSnapshot.execution?.modelProviderId || '-'}）`,
          `- 模型来源：${taskSnapshot.execution?.modelSource || '-'}`,
          `- 输入来源：${taskSnapshot.execution?.actualInputSource || '-'}`,
          `- 文档动作：${taskSnapshot.execution?.documentAction || '-'}`,
          `- 任务结论：${taskSnapshot.diagnostics?.genericConclusion || '无'}`,
          `- 风险提示：${taskSnapshot.diagnostics?.genericRiskHint || '无'}`,
          `- 根因说明：${taskSnapshot.diagnostics?.rootCauseSummary || '无'}`,
          '',
          '```json',
          this.formatMarkdownCodeBlock(this.formatJson({
            diagnostics: taskSnapshot.diagnostics,
            previews: taskSnapshot.previews,
            applyResult: taskSnapshot.applyResult
          })),
          '```'
        )
      })
      return lines.join('\n')
    },
    normalizeDownloadFileName(name) {
      const value = String(name || 'task-debug')
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
      return value || 'task-debug'
    },
    downloadTextFile(content, filename, mimeType = 'application/json;charset=utf-8') {
      const blob = new Blob([String(content || '')], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    },
    async copyDiagnostic(item) {
      const text = this.formatDiagnostic(item)
      await this.copyTextToClipboard(text, '排障信息已复制')
    },
    async copyTaskDebugSnapshot(task) {
      const text = this.buildTaskDebugSnapshot(task)
      await this.copyTextToClipboard(text, '排障快照已复制')
    },
    async copyTaskSanitizedDebugSnapshot(task) {
      const text = this.buildTaskSanitizedDebugSnapshot(task)
      await this.copyTextToClipboard(text, '脱敏排障快照已复制')
    },
    async copyTaskMarkdownReport(task) {
      const text = this.buildTaskMarkdownReport(task)
      await this.copyTextToClipboard(text, 'Markdown 报告已复制')
    },
    async copyDetailSearchReport(task) {
      const text = this.buildDetailSearchReport(task)
      await this.copyTextToClipboard(text, '搜索排障摘要已复制')
    },
    downloadDetailSearchReport(task) {
      const text = this.buildDetailSearchReport(task)
      const keyword = String(this.detailSearchText || '').trim() || 'keyword'
      const scope = this.getDetailSearchScopeLabel(this.detailSearchScope)
      const filename = `${this.normalizeDownloadFileName(task?.title || 'task-search-report')}-${this.normalizeDownloadFileName(scope)}-${this.normalizeDownloadFileName(keyword)}.md`
      this.downloadTextFile(text, filename, 'text/markdown;charset=utf-8')
      alert('搜索摘要 Markdown 文件已开始下载')
    },
    downloadTaskDebugJson(task) {
      const filename = `${this.normalizeDownloadFileName(task?.title || 'task-debug')}-${task?.id || 'snapshot'}.json`
      this.downloadTextFile(this.buildTaskDebugSnapshot(task), filename)
      alert('JSON 文件已开始下载')
    },
    async copyFilteredTasksMarkdownReport() {
      const text = this.buildFilteredTasksMarkdownReport(this.filteredTasks)
      await this.copyTextToClipboard(text, '筛选结果 Markdown 汇总已复制')
    },
    downloadFilteredTasksJson() {
      const payload = this.formatJson(this.getBatchTaskDebugSnapshotObject(this.filteredTasks, { exportMode: 'full' }))
      const filename = `task-list-filtered-${this.filteredTasks.length}-${Date.now()}.json`
      this.downloadTextFile(payload, filename)
      alert('筛选结果 JSON 文件已开始下载')
    },
    isOutputEmptyArray(output) {
      if (!output) return false
      const s = String(output).trim()
      if (s === '[]') return true
      try {
        const arr = JSON.parse(s)
        return Array.isArray(arr) && arr.length === 0
      } catch (_) {
        return false
      }
    },
    async retryChunk(taskId, itemIndex) {
      const key = `${taskId}-${itemIndex}`
      let requestOverride = null
      const edited = this.editedRequests[key]
      if (edited && edited.trim()) {
        try {
          const parsed = JSON.parse(edited)
          if (parsed?.messages && Array.isArray(parsed.messages) && parsed.providerId && parsed.modelId) {
            requestOverride = { ...parsed }
          } else if (parsed?.messages && Array.isArray(parsed.messages)) {
            alert('请求参数需包含 providerId、modelId 和 messages，请检查后重试')
            return
          }
        } catch (_) {
          alert('请求参数 JSON 格式无效，请检查后重试')
          return
        }
      }
      this.retryingIndex = itemIndex
      try {
        await retrySpellCheckChunk(taskId, itemIndex, requestOverride)
        this.detailTask = getTaskById(taskId) || this.detailTask
      } catch (e) {
        reportError('重试失败', e)
      } finally {
        this.retryingIndex = -1
      }
    },
    canApplyIssueComment(issue) {
      return issue?.anchorStatus === 'skipped'
    },
    getIssueOriginalIndex(item, issue) {
      return Array.isArray(item?.parsedItems) ? item.parsedItems.indexOf(issue) : -1
    },
    getIssueActionKey(taskId, itemIndex, issueIndex) {
      return `${taskId}-${itemIndex}-${issueIndex}`
    },
    isBatchApplyPreviewOpen(taskId) {
      return this.batchApplyPreviewTaskId === taskId
    },
    isApplyingIssue(taskId, itemIndex, issueIndex) {
      return this.applyingIssueKey === this.getIssueActionKey(taskId, itemIndex, issueIndex)
    },
    isApplyingSkippedTask(taskId) {
      return this.applyingSkippedTaskId === taskId
    },
    openBatchApplyPreview(taskId) {
      const task = getTaskById(taskId) || this.detailTask
      const entries = this.getSkippedIssueEntries(task)
      if (entries.length <= 0) {
        alert('当前任务没有可写入的跳过项')
        return
      }
      const nextSelection = {}
      entries.forEach(entry => {
        nextSelection[this.getIssueActionKey(taskId, entry.itemIndex, entry.issueIndex)] = true
      })
      this.batchApplyPreviewTaskId = taskId
      this.batchApplySelection = nextSelection
    },
    closeBatchApplyPreview() {
      this.batchApplyPreviewTaskId = ''
      this.batchApplySelection = {}
    },
    getBatchApplyGroupKey(taskId, itemIndex) {
      return `${taskId}-${itemIndex}`
    },
    getDetailSectionKey(taskId, itemIndex, sectionName) {
      return `${String(taskId || '')}-${Number(itemIndex)}-${String(sectionName || '')}`
    },
    getManagedDetailSectionNames() {
      return ['request', 'output', 'parsed', 'repair', 'diagnostic', 'issues']
    },
    isDetailSectionCollapsed(taskId, itemIndex, sectionName) {
      const key = this.getDetailSectionKey(taskId, itemIndex, sectionName)
      const stored = this.detailSectionCollapsed[key]
      if (typeof stored === 'boolean') return stored
      return sectionName === 'repair' || sectionName === 'diagnostic'
    },
    toggleDetailSection(taskId, itemIndex, sectionName) {
      const key = this.getDetailSectionKey(taskId, itemIndex, sectionName)
      this.detailSectionCollapsed = {
        ...this.detailSectionCollapsed,
        [key]: !this.isDetailSectionCollapsed(taskId, itemIndex, sectionName)
      }
    },
    setDetailSectionsForItem(taskId, itemIndex, collapsedSectionMap) {
      const nextState = { ...this.detailSectionCollapsed }
      Object.entries(collapsedSectionMap).forEach(([sectionName, isCollapsed]) => {
        const key = this.getDetailSectionKey(taskId, itemIndex, sectionName)
        nextState[key] = Boolean(isCollapsed)
      })
      this.detailSectionCollapsed = nextState
    },
    expandAllDetailSections(task) {
      const taskId = String(task?.id || '')
      const items = Array.isArray(task?.data?.items) ? task.data.items : []
      if (!taskId || items.length <= 0) return
      const nextState = { ...this.detailSectionCollapsed }
      items.forEach((_, itemIndex) => {
        this.getManagedDetailSectionNames().forEach((sectionName) => {
          nextState[this.getDetailSectionKey(taskId, itemIndex, sectionName)] = false
        })
      })
      this.detailSectionCollapsed = nextState
    },
    collapseAllDetailSections(task) {
      const taskId = String(task?.id || '')
      const items = Array.isArray(task?.data?.items) ? task.data.items : []
      if (!taskId || items.length <= 0) return
      const nextState = { ...this.detailSectionCollapsed }
      items.forEach((_, itemIndex) => {
        this.getManagedDetailSectionNames().forEach((sectionName) => {
          nextState[this.getDetailSectionKey(taskId, itemIndex, sectionName)] = true
        })
      })
      this.detailSectionCollapsed = nextState
    },
    expandDiagnosticsOnlyForItem(taskId, itemIndex) {
      if (!taskId || itemIndex == null) return
      const collapsedSectionMap = {}
      this.getManagedDetailSectionNames().forEach((sectionName) => {
        collapsedSectionMap[sectionName] = sectionName !== 'diagnostic'
      })
      this.setDetailSectionsForItem(taskId, itemIndex, collapsedSectionMap)
    },
    expandDiagnosticsOnlyForTask(task) {
      const taskId = String(task?.id || '')
      const items = Array.isArray(task?.data?.items) ? task.data.items : []
      if (!taskId || items.length <= 0) return
      items.forEach((item, itemIndex) => {
        if (item?.diagnostic) {
          this.expandDiagnosticsOnlyForItem(taskId, itemIndex)
          return
        }
        const collapsedSectionMap = {}
        this.getManagedDetailSectionNames().forEach((sectionName) => {
          collapsedSectionMap[sectionName] = sectionName !== 'issues'
        })
        this.setDetailSectionsForItem(taskId, itemIndex, collapsedSectionMap)
      })
    },
    isBatchApplyGroupCollapsed(taskId, itemIndex) {
      return this.batchApplyCollapsedGroups[this.getBatchApplyGroupKey(taskId, itemIndex)] === true
    },
    toggleBatchApplyGroup(taskId, itemIndex) {
      const key = this.getBatchApplyGroupKey(taskId, itemIndex)
      this.batchApplyCollapsedGroups = {
        ...this.batchApplyCollapsedGroups,
        [key]: !this.batchApplyCollapsedGroups[key]
      }
    },
    isBatchApplySelected(taskId, itemIndex, issueIndex) {
      return this.batchApplySelection[this.getIssueActionKey(taskId, itemIndex, issueIndex)] === true
    },
    toggleBatchApplySelection(taskId, itemIndex, issueIndex, checked) {
      const key = this.getIssueActionKey(taskId, itemIndex, issueIndex)
      this.batchApplySelection = {
        ...this.batchApplySelection,
        [key]: checked === true
      }
    },
    isBatchApplyGroupFullySelected(taskId, group) {
      return group.entries.length > 0 && group.entries.every(entry =>
        this.isBatchApplySelected(taskId, entry.itemIndex, entry.issueIndex)
      )
    },
    toggleBatchApplyGroupSelection(taskId, group, checked) {
      const nextSelection = { ...this.batchApplySelection }
      group.entries.forEach(entry => {
        nextSelection[this.getIssueActionKey(taskId, entry.itemIndex, entry.issueIndex)] = checked === true
      })
      this.batchApplySelection = nextSelection
    },
    selectAllBatchApply(taskId) {
      const task = getTaskById(taskId) || this.detailTask
      const entries = this.getFilteredBatchApplyEntries(task)
      const nextSelection = {}
      entries.forEach(entry => {
        nextSelection[this.getIssueActionKey(taskId, entry.itemIndex, entry.issueIndex)] = true
      })
      this.batchApplySelection = {
        ...this.batchApplySelection,
        ...nextSelection
      }
    },
    clearBatchApplySelection() {
      this.batchApplySelection = {}
    },
    getSelectedBatchApplyTargets(taskId) {
      const task = getTaskById(taskId) || this.detailTask
      return this.getSkippedIssueEntries(task)
        .filter(entry => this.isBatchApplySelected(taskId, entry.itemIndex, entry.issueIndex))
        .map(entry => ({ itemIndex: entry.itemIndex, issueIndex: entry.issueIndex }))
    },
    getSelectedBatchApplyCount(taskId) {
      return this.getSelectedBatchApplyTargets(taskId).length
    },
    async applyIssueComment(taskId, itemIndex, issueIndex) {
      if (issueIndex < 0) {
        alert('未找到对应的问题项，请刷新后重试')
        return
      }
      this.applyingIssueKey = this.getIssueActionKey(taskId, itemIndex, issueIndex)
      try {
        await applySpellCheckIssueComment(taskId, itemIndex, issueIndex)
        this.detailTask = getTaskById(taskId) || this.detailTask
      } catch (e) {
        this.detailTask = getTaskById(taskId) || this.detailTask
        reportError('写入批注失败', e)
      } finally {
        this.applyingIssueKey = ''
      }
    },
    async applySkippedComments(taskId) {
      const targets = this.getSelectedBatchApplyTargets(taskId)
      if (targets.length <= 0) {
        alert('请先选择至少一条跳过项')
        return
      }
      this.applyingSkippedTaskId = taskId
      try {
        const result = await applySkippedSpellCheckComments(taskId, targets)
        this.detailTask = getTaskById(taskId) || this.detailTask
        this.closeBatchApplyPreview()
        const summary = `已写入 ${result.appliedCount} 条`
        if (result.failedCount > 0) {
          const preview = result.failedIssues
            .slice(0, 5)
            .map(item => `第 ${item.itemIndex + 1} 段 / 问题 ${item.issueIndex + 1}：${item.reasonLabel}`)
            .join('\n')
          alert(`${summary}，失败 ${result.failedCount} 条。\n${preview}${result.failedCount > 5 ? '\n...' : ''}`)
        } else {
          alert(`${summary}，全部写入成功。`)
        }
      } catch (e) {
        this.detailTask = getTaskById(taskId) || this.detailTask
        reportError('批量写入失败', e)
      } finally {
        this.applyingSkippedTaskId = ''
      }
    }
  }
}
</script>

<style scoped>
.popup {
  font-size: 14px;
  min-height: 95%;
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', sans-serif;
}
.header {
  margin-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
.btn-clear {
  padding: 4px 10px;
  font-size: 12px;
  color: #6b7280;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  cursor: pointer;
}
.btn-clear:hover {
  background: #e5e7eb;
}
.empty-state {
  color: #6b7280;
  text-align: center;
  padding: 32px 16px;
}
.empty-state .hint {
  font-size: 12px;
  margin-top: 8px;
}
.compact-empty {
  padding: 16px;
  margin-bottom: 8px;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  background: #fafafa;
}
.filter-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.filter-input,
.filter-select {
  height: 32px;
  padding: 0 10px;
  font-size: 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #111827;
}
.filter-input {
  flex: 1 1 220px;
  min-width: 180px;
}
.filter-select {
  flex: 0 0 auto;
}
.btn-filter-clear {
  height: 32px;
  padding: 0 10px;
  font-size: 12px;
  color: #92400e;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 6px;
  cursor: pointer;
}
.btn-filter-clear:hover {
  background: #fde68a;
}
.btn-filter-export {
  height: 32px;
  padding: 0 10px;
  font-size: 12px;
  color: #1d4ed8;
  background: #eff6ff;
  border: 1px solid #93c5fd;
  border-radius: 6px;
  cursor: pointer;
}
.btn-filter-export:hover {
  background: #dbeafe;
}
.overview-wrap {
  margin-bottom: 12px;
}
.overview-scope-switch {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.overview-scope-btn {
  padding: 6px 10px;
  font-size: 12px;
  color: #4b5563;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  cursor: pointer;
}
.overview-scope-btn.active {
  color: #1d4ed8;
  background: #eff6ff;
  border-color: #93c5fd;
}
.overview-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}
.overview-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px 12px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.overview-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.overview-card.active {
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
  border-color: #2563eb;
}
.overview-card.high {
  background: #fef2f2;
  border-color: #fca5a5;
}
.overview-card.medium {
  background: #fffbeb;
  border-color: #fcd34d;
}
.overview-card.keyword {
  background: #eff6ff;
  border-color: #93c5fd;
}
.overview-card.clean {
  background: #f0fdf4;
  border-color: #86efac;
}
.overview-card.latest {
  background: #f9fafb;
}
.overview-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}
.overview-value {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
}
.overview-value.small {
  font-size: 13px;
  font-weight: 600;
}
.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.task-item {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  background: #fff;
  cursor: pointer;
  transition: box-shadow 0.2s, border-color 0.2s, background 0.2s;
}
.task-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.task-item.expanded {
  border-color: #2563eb;
  box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.08);
}
.task-item.running {
  border-color: #3b82f6;
  background: #eff6ff;
}
.task-item.completed {
  border-color: #22c55e;
  background: #f0fdf4;
}
.task-item.failed {
  border-color: #ef4444;
  background: #fef2f2;
}
.task-item.abnormal {
  border-color: #d97706;
  background: #fffbeb;
}
.task-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.task-summary-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.task-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  color: #374151;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
}
.task-chip.cause.info {
  color: #166534;
  background: #dcfce7;
  border-color: #86efac;
}
.task-chip.cause.warning {
  color: #92400e;
  background: #fef3c7;
  border-color: #fcd34d;
}
.task-chip.cause.error {
  color: #991b1b;
  background: #fee2e2;
  border-color: #fca5a5;
}
.task-chip.generic.success {
  color: #166534;
  background: #dcfce7;
  border-color: #86efac;
}
.task-chip.generic.warning {
  color: #92400e;
  background: #fef3c7;
  border-color: #fcd34d;
}
.task-chip.generic.error {
  color: #991b1b;
  background: #fee2e2;
  border-color: #fca5a5;
}
.task-chip.generic.info {
  color: #1d4ed8;
  background: #dbeafe;
  border-color: #93c5fd;
}
.task-chip.anchor.precise {
  color: #1d4ed8;
  background: #dbeafe;
  border-color: #93c5fd;
}
.task-chip.anchor.fallback {
  color: #92400e;
  background: #fef3c7;
  border-color: #fcd34d;
}
.task-chip.anchor.failed {
  color: #991b1b;
  background: #fee2e2;
  border-color: #fca5a5;
}
.task-chip.anchor.skipped {
  color: #92400e;
  background: #fffbeb;
  border-color: #fcd34d;
}
.task-chip.quality.high {
  color: #166534;
  background: #dcfce7;
  border-color: #86efac;
}
.task-chip.quality.medium {
  color: #1d4ed8;
  background: #dbeafe;
  border-color: #93c5fd;
}
.task-chip.quality.review {
  color: #92400e;
  background: #fef3c7;
  border-color: #fcd34d;
}
.task-summary-text {
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.4;
}
.task-risk-text {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.4;
  color: #92400e;
}
.task-status-icon {
  font-size: 16px;
}
.task-title {
  flex: 1;
  font-weight: 500;
}
.task-progress {
  font-size: 12px;
  color: #6b7280;
}
.task-progress-bar {
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  margin-top: 8px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: #3b82f6;
  transition: width 0.2s;
}
.task-detail {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
  font-size: 12px;
  color: #4b5563;
}
.detail-label {
  font-weight: 500;
  margin-bottom: 4px;
}
.content-preview {
  max-height: 80px;
  overflow-y: auto;
  background: #f9fafb;
  padding: 8px;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-all;
}
.detail-row {
  margin-top: 8px;
}
.detail-error {
  color: #ef4444;
  margin-top: 8px;
}
.detail-actions {
  margin-top: 10px;
}
.btn-stop {
  padding: 2px 8px;
  font-size: 12px;
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #ef4444;
  border-radius: 4px;
  cursor: pointer;
}
.btn-stop:hover {
  background: #fee2e2;
}
.btn-detail {
  padding: 2px 8px;
  font-size: 12px;
  color: #3b82f6;
  background: transparent;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  cursor: pointer;
}
.btn-detail:hover {
  background: #eff6ff;
}
.detail-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.34);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.detail-modal {
  background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
  border-radius: 18px;
  width: 92vw;
  max-width: 1200px;
  height: 88vh;
  max-height: 88vh;
  border: 1px solid rgba(219, 234, 254, 0.9);
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
}
.detail-modal-header {
  padding: 16px 18px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  background: rgba(255, 255, 255, 0.94);
  border-top-left-radius: 18px;
  border-top-right-radius: 18px;
}
.detail-modal-header-main {
  min-width: 0;
  flex: 1;
}
.detail-modal-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.detail-modal-header h3 {
  margin: 0;
  font-size: 18px;
  line-height: 1.35;
}
.detail-modal-subtitle {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
}
.detail-status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
}
.detail-status-badge.pending {
  color: #4b5563;
  background: #f3f4f6;
  border-color: #e5e7eb;
}
.detail-status-badge.running {
  color: #1d4ed8;
  background: #dbeafe;
  border-color: #bfdbfe;
}
.detail-status-badge.completed {
  color: #047857;
  background: #d1fae5;
  border-color: #a7f3d0;
}
.detail-status-badge.failed {
  color: #b91c1c;
  background: #fee2e2;
  border-color: #fecaca;
}
.detail-status-badge.cancelled {
  color: #92400e;
  background: #fef3c7;
  border-color: #fde68a;
}
.detail-status-badge.abnormal {
  color: #b45309;
  background: #fef3c7;
  border-color: #fcd34d;
}
.detail-modal-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.modal-action-btn {
  min-height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}
.modal-action-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.modal-action-btn:focus-visible,
.modal-close-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.16);
}
.modal-action-btn-primary {
  color: #ffffff;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  border-color: #1d4ed8;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.18);
}
.modal-action-btn-primary:hover:not(:disabled) {
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.22);
}
.modal-action-btn-secondary {
  color: #334155;
  background: #f8fafc;
  border-color: #d1d5db;
}
.modal-action-btn-secondary:hover:not(:disabled) {
  background: #f1f5f9;
  border-color: #94a3b8;
}
.modal-action-btn-warn {
  color: #92400e;
  background: #fffbeb;
  border-color: #fcd34d;
}
.modal-action-btn-warn:hover:not(:disabled) {
  background: #fef3c7;
  border-color: #f59e0b;
}
.modal-action-btn-danger {
  color: #b91c1c;
  background: #fef2f2;
  border-color: #fca5a5;
}
.modal-action-btn-danger:hover:not(:disabled) {
  background: #fee2e2;
  border-color: #ef4444;
}
.modal-close-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  font-size: 20px;
  line-height: 1;
  color: #64748b;
  background: #f8fafc;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  cursor: pointer;
}
.modal-close-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
  border-color: #94a3b8;
}
.detail-modal-body {
  padding: 18px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
.task-meta-panel {
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.94);
  padding: 14px;
  margin-bottom: 14px;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04);
}
.task-segment-overview {
  margin-bottom: 14px;
}
.task-segment-meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}
.task-segment-meta-item {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f8fafc;
  padding: 10px 12px;
}
.task-segment-meta-label {
  font-size: 12px;
  color: #64748b;
}
.task-segment-meta-value {
  margin-top: 4px;
  font-size: 13px;
  color: #0f172a;
  font-weight: 600;
}
.task-segment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
}
.task-segment-item {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  padding: 10px 12px;
}
.task-segment-item.current {
  border-color: #38bdf8;
  background: #f0f9ff;
}
.task-segment-item.done {
  background: #f8fafc;
}
.task-segment-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.task-segment-item-index {
  font-size: 12px;
  font-weight: 600;
  color: #0f172a;
}
.task-segment-item-status {
  font-size: 12px;
  color: #0369a1;
}
.task-segment-item-text {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: #334155;
  white-space: pre-wrap;
  word-break: break-word;
}
.batch-apply-panel {
  border: 1px solid #fcd34d;
  border-radius: 8px;
  background: #fffbeb;
  padding: 12px;
  margin-bottom: 12px;
}
.batch-apply-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.batch-apply-title {
  font-size: 14px;
  font-weight: 600;
  color: #92400e;
}
.batch-apply-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}
.batch-apply-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.batch-apply-list {
  max-height: 280px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.batch-apply-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  border: 1px solid #fde68a;
  border-radius: 6px;
  background: #fff;
  padding: 10px;
  cursor: pointer;
}
.batch-apply-item input[type="checkbox"] {
  margin-top: 2px;
}
.batch-apply-item-main {
  flex: 1;
  min-width: 0;
}
.batch-apply-item-head {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
.batch-apply-item-index {
  font-size: 12px;
  font-weight: 600;
  color: #111827;
}
.batch-apply-item-text {
  margin-top: 6px;
  font-size: 12px;
  color: #111827;
  word-break: break-all;
}
.batch-apply-item-sentence {
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
  background: #f9fafb;
  border-radius: 4px;
  padding: 6px 8px;
  white-space: pre-wrap;
  word-break: break-word;
}
.task-meta-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
}
.task-meta-row + .task-meta-row {
  margin-top: 8px;
}
.task-meta-label {
  color: #64748b;
  font-weight: 500;
}
.task-meta-value {
  color: #111827;
  font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace;
}
.task-meta-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.task-meta-actions {
  align-items: flex-start;
}
.task-meta-search-row {
  align-items: flex-start;
}
.task-meta-search-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}
.detail-search-scope-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  background: #f8fbff;
  flex-wrap: wrap;
}
.detail-search-scope-btn {
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}
.detail-search-scope-btn:hover {
  background: #eff6ff;
  color: #1d4ed8;
}
.detail-search-scope-btn.active {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #ffffff;
  border-color: #1d4ed8;
}
.detail-search-input {
  flex: 1 1 320px;
  min-width: 220px;
}
.task-meta-search-summary {
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
}
.task-meta-search-breakdown {
  font-size: 12px;
  color: #475569;
}
.task-meta-search-wrap .btn-mode-toggle {
  flex-shrink: 0;
}
.task-meta-search-map-row {
  align-items: flex-start;
}
.detail-search-map-wrap {
  flex: 1;
  min-width: 0;
}
.detail-search-map-hint {
  font-size: 12px;
  color: #64748b;
}
.detail-search-map {
  position: relative;
  margin-top: 10px;
  height: 34px;
  border-radius: 12px;
  background: linear-gradient(180deg, #f8fafc 0%, #eef4ff 100%);
  border: 1px solid #dbeafe;
  overflow: hidden;
}
.detail-search-map-rail {
  position: absolute;
  left: 12px;
  right: 12px;
  top: 50%;
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.18), rgba(37, 99, 235, 0.3));
  transform: translateY(-50%);
  z-index: 0;
}
.detail-search-map-viewport {
  position: absolute;
  top: 6px;
  height: calc(100% - 12px);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(59, 130, 246, 0.12), rgba(37, 99, 235, 0.18));
  border: 1px solid rgba(59, 130, 246, 0.22);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.38);
  pointer-events: none;
  transition: left 0.18s ease, width 0.18s ease;
  z-index: 1;
}
.detail-search-map-marker {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 18px;
  padding: 0;
  border: 1px solid #ffffff;
  border-radius: 999px;
  background: linear-gradient(180deg, #60a5fa 0%, #2563eb 100%);
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2);
  cursor: pointer;
  transform: translate(-50%, -50%);
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  z-index: 2;
}
.detail-search-map-marker:hover {
  transform: translate(-50%, -50%) scale(1.12);
  box-shadow: 0 6px 14px rgba(37, 99, 235, 0.28);
}
.detail-search-map-marker.active {
  width: 14px;
  height: 24px;
  background: linear-gradient(180deg, #1d4ed8 0%, #1e40af 100%);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18), 0 8px 16px rgba(29, 78, 216, 0.28);
}
.detail-search-map-meta {
  margin-top: 6px;
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #94a3b8;
}
.task-meta-action-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.detail-filter-select {
  min-width: 140px;
}
@media (max-width: 900px) {
  .detail-modal {
    width: 96vw;
    height: 92vh;
    max-height: 92vh;
  }
  .detail-modal-header {
    flex-direction: column;
  }
  .detail-modal-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
.detail-item {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 14px;
  margin-bottom: 14px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.04);
  transition: border-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease, background 0.22s ease;
}
.detail-item:last-child {
  margin-bottom: 0;
}
.detail-item.search-current {
  border-color: #60a5fa;
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.96), rgba(255, 255, 255, 0.98));
  box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.22), 0 16px 34px rgba(59, 130, 246, 0.14);
}
.detail-item.search-flash {
  animation: detailItemSearchPulse 1.1s ease-out;
}
@keyframes detailItemSearchPulse {
  0% {
    transform: translateY(0) scale(1);
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.34), 0 16px 34px rgba(59, 130, 246, 0.12);
  }
  35% {
    transform: translateY(-1px) scale(1.008);
    box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.14), 0 20px 38px rgba(59, 130, 246, 0.2);
  }
  100% {
    transform: translateY(0) scale(1);
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0), 0 16px 34px rgba(59, 130, 246, 0.12);
  }
}
.detail-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.detail-item-inline-action {
  margin-left: auto;
}
.detail-cause-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.strategy-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.strategy-label {
  font-size: 12px;
  color: #6b7280;
}
.strategy-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  color: #1d4ed8;
  background: #dbeafe;
  border: 1px solid #93c5fd;
}
.cause-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid transparent;
}
.cause-badge.info {
  color: #166534;
  background: #dcfce7;
  border-color: #86efac;
}
.cause-badge.warning {
  color: #92400e;
  background: #fef3c7;
  border-color: #fcd34d;
}
.cause-badge.error {
  color: #991b1b;
  background: #fee2e2;
  border-color: #fca5a5;
}
.cause-summary {
  font-size: 12px;
  color: #6b7280;
}
:deep(.detail-search-highlight) {
  background: #fef08a;
  color: inherit;
  border-radius: 4px;
  padding: 0 2px;
  box-shadow: inset 0 0 0 1px rgba(234, 179, 8, 0.22);
}
.detail-item-title {
  font-weight: 600;
  font-size: 14px;
  color: #0f172a;
}
.detail-item-meta {
  font-size: 12px;
  color: #475569;
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
}
.detail-item-main-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.retry-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.btn-retry {
  padding: 4px 12px;
  font-size: 12px;
  color: #3b82f6;
  background: #eff6ff;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  cursor: pointer;
}
.btn-retry:hover:not(:disabled) {
  background: #dbeafe;
}
.btn-copy-diagnostic {
  padding: 4px 12px;
  font-size: 12px;
  color: #6b7280;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  cursor: pointer;
}
.btn-copy-diagnostic:hover {
  background: #e5e7eb;
}
.btn-retry:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-apply-comment {
  padding: 4px 12px;
  font-size: 12px;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #f59e0b;
  border-radius: 4px;
  cursor: pointer;
}
.btn-apply-comment:hover:not(:disabled) {
  background: #fef3c7;
}
.btn-apply-comment:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.detail-section {
  margin-top: 8px;
}
.detail-section-card {
  margin-top: 0;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #fbfdff;
}
.detail-section-toolbar {
  background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
}
.detail-section-diagnostic {
  background: linear-gradient(180deg, #fcfcfd 0%, #f8fafc 100%);
}
.detail-section-full {
  margin-top: 12px;
}
.detail-section-issues {
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
}
.issue-anchor-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.issue-anchor-card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fcfcfd;
  padding: 12px;
}
.issue-anchor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.issue-anchor-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.issue-anchor-index {
  font-size: 12px;
  font-weight: 600;
  color: #111827;
}
.issue-anchor-type {
  font-size: 11px;
  color: #92400e;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 999px;
  padding: 2px 8px;
}
.issue-quality-badge {
  font-size: 11px;
  border-radius: 999px;
  padding: 2px 8px;
  border: 1px solid transparent;
}
.issue-quality-badge.high {
  color: #166534;
  background: #dcfce7;
  border-color: #86efac;
}
.issue-quality-badge.medium {
  color: #1d4ed8;
  background: #dbeafe;
  border-color: #93c5fd;
}
.issue-quality-badge.review {
  color: #92400e;
  background: #fef3c7;
  border-color: #fcd34d;
}
.issue-quality-badge.filtered {
  color: #6b7280;
  background: #f3f4f6;
  border-color: #d1d5db;
}
.issue-anchor-status {
  font-size: 11px;
  border-radius: 999px;
  padding: 2px 8px;
  border: 1px solid transparent;
}
.issue-anchor-status.success {
  color: #166534;
  background: #dcfce7;
  border-color: #86efac;
}
.issue-anchor-status.failed {
  color: #991b1b;
  background: #fee2e2;
  border-color: #fca5a5;
}
.issue-anchor-status.skipped {
  color: #92400e;
  background: #fef3c7;
  border-color: #fcd34d;
}
.issue-anchor-mode {
  font-size: 11px;
  border-radius: 999px;
  padding: 2px 8px;
  border: 1px solid transparent;
}
.issue-anchor-mode.precise {
  color: #1d4ed8;
  background: #dbeafe;
  border-color: #93c5fd;
}
.issue-anchor-mode.fallback {
  color: #92400e;
  background: #fef3c7;
  border-color: #fcd34d;
}
.issue-anchor-row + .issue-anchor-row {
  margin-top: 8px;
}
.issue-anchor-label {
  display: block;
  margin-bottom: 4px;
  font-size: 11px;
  color: #6b7280;
}
.issue-anchor-code,
.issue-anchor-hit {
  font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace;
  font-size: 12px;
  background: #f3f4f6;
  border-radius: 4px;
  padding: 2px 6px;
  color: #111827;
}
.issue-anchor-hit {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
}
.issue-anchor-block {
  white-space: pre-wrap;
  word-break: break-word;
  padding: 8px;
  border-radius: 4px;
  background: #f9fafb;
  color: #111827;
  font-size: 12px;
}
.issue-anchor-inline {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  padding: 8px;
  border-radius: 4px;
  background: #f9fafb;
}
.issue-anchor-context {
  white-space: pre-wrap;
  word-break: break-word;
  color: #374151;
  font-size: 12px;
}
.issue-anchor-result {
  font-size: 12px;
  padding: 8px;
  border-radius: 4px;
}
.issue-anchor-result.success {
  color: #166534;
  background: #f0fdf4;
  border: 1px solid #86efac;
}
.issue-anchor-result.failed {
  color: #991b1b;
  background: #fef2f2;
  border: 1px solid #fca5a5;
}
.issue-anchor-quality-note {
  font-size: 12px;
  color: #6b7280;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  padding: 8px;
}
.issue-anchor-actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}
.detail-section-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.detail-section-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.detail-section-label {
  font-size: 12px;
  color: #475569;
  font-weight: 600;
}
.detail-section-toggle {
  color: #475569;
  border-color: #cbd5e1;
  background: #f8fafc;
}
.detail-section-toggle:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}
.btn-mode-toggle {
  padding: 2px 8px;
  font-size: 11px;
  color: #3b82f6;
  background: transparent;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  cursor: pointer;
}
.btn-mode-toggle:hover {
  background: #eff6ff;
}
.json-edit-wrap,
.json-tree-wrap {
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f8fafc;
}
.json-viewer-custom {
  padding: 10px;
  font-size: 12px;
  max-height: 320px;
  overflow: auto;
}
.json-viewer-custom :deep(.jv-container) {
  font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace;
}
.detail-section-content {
  font-size: 12px;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 10px;
  max-height: 280px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace;
  line-height: 1.6;
}
.input-box {
  border: 1px solid #e5e7eb;
  resize: vertical;
  display: block;
  width: 100%;
  box-sizing: border-box;
}
.output-box {
  min-height: 40px;
  border: 1px solid #e5e7eb;
}
.output-error {
  color: #ef4444;
}
.output-placeholder {
  color: #9ca3af;
}
.output-ok {
  color: #22c55e;
}
.detail-empty {
  color: #9ca3af;
  text-align: center;
  padding: 24px;
}
.detail-empty-inline {
  color: #9ca3af;
  text-align: center;
  padding: 12px;
  border: 1px dashed #d1d5db;
  border-radius: 10px;
  background: #fafafa;
}
.workflow-tree {
  margin-top: 10px;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  background: #f8fbff;
  padding: 10px;
}
.workflow-tree-title {
  font-size: 12px;
  font-weight: 700;
  color: #1d4ed8;
  margin-bottom: 8px;
}
.workflow-tree-item {
  border-left: 2px solid #93c5fd;
  padding: 8px 10px;
  margin-left: 6px;
  background: #ffffff;
  border-radius: 8px;
  cursor: pointer;
}
.workflow-tree-item + .workflow-tree-item {
  margin-top: 8px;
}
.workflow-tree-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.workflow-tree-status {
  font-size: 12px;
}
.workflow-tree-name {
  flex: 1;
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
}
.workflow-tree-time,
.workflow-tree-item-sub {
  font-size: 11px;
  color: #64748b;
}
.workflow-tree-item-summary {
  margin-top: 4px;
  font-size: 12px;
  color: #334155;
  white-space: pre-wrap;
  word-break: break-word;
}
.workflow-detail-list {
  margin: 10px 0 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.workflow-detail-debug-card {
  margin-top: 10px;
  margin-bottom: 12px;
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 10px 12px;
  background: #fffbeb;
}
.workflow-detail-debug-title {
  font-size: 13px;
  font-weight: 700;
  color: #92400e;
}
.workflow-detail-item {
  border: 1px solid #dbeafe;
  border-radius: 10px;
  padding: 10px 12px;
  background: #f8fbff;
}
.workflow-detail-item-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
}
.workflow-detail-item-meta,
.workflow-detail-item-summary {
  margin-top: 6px;
  font-size: 12px;
  color: #475569;
  white-space: pre-wrap;
  word-break: break-word;
}
.workflow-detail-item-paused {
  color: #b45309;
  font-weight: 600;
}
.workflow-snapshot-edge.incoming {
  stroke: #f59e0b;
  stroke-width: 2.8px;
}
.workflow-snapshot-edge.taken {
  stroke: #2563eb;
  stroke-width: 2.8px;
}
.workflow-snapshot-edge.skipped {
  stroke: #cbd5e1;
  stroke-dasharray: 5 4;
}
.workflow-detail-link {
  margin-top: 8px;
}
.detail-search-empty {
  margin-bottom: 12px;
}
@media (max-width: 900px) {
  .detail-item-main-grid {
    grid-template-columns: 1fr;
  }
  .detail-item-inline-action {
    margin-left: 0;
  }
  .task-meta-search-summary {
    white-space: normal;
  }
}

.generic-task-detail {
  text-align: left;
  color: inherit;
}
.generic-summary-card {
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #f8fbff;
}
.generic-summary-title {
  font-size: 13px;
  font-weight: 600;
  color: #1d4ed8;
  margin-bottom: 8px;
}
.generic-summary-row + .generic-summary-row {
  margin-top: 8px;
}
.generic-summary-label {
  display: inline-block;
  min-width: 72px;
  font-size: 12px;
  color: #6b7280;
  vertical-align: top;
}
.generic-summary-value {
  display: inline-block;
  width: calc(100% - 76px);
  font-size: 12px;
  line-height: 1.5;
  color: #111827;
  white-space: pre-wrap;
  word-break: break-word;
}
.generic-summary-value.risk {
  color: #92400e;
}
.generic-meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}
.generic-meta-item {
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}
.generic-meta-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}
.generic-meta-value {
  font-size: 12px;
  line-height: 1.5;
  color: #111827;
  word-break: break-word;
}
.linked-task-btn {
  padding: 0;
  border: none;
  background: none;
  color: #2563eb;
  cursor: pointer;
  text-align: left;
}
.secret-keyword-table-wrap {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}
.secret-keyword-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.secret-keyword-table th,
.secret-keyword-table td {
  padding: 8px 10px;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
  vertical-align: top;
}
.secret-keyword-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #475569;
}
.secret-keyword-table tbody tr:last-child td {
  border-bottom: none;
}
.secret-keyword-table .kw-term,
.secret-keyword-table .kw-token {
  font-family: ui-monospace, 'Cascadia Code', monospace;
  font-size: 11px;
  padding: 2px 6px;
  background: #f1f5f9;
  border-radius: 4px;
}
.secret-keyword-table .kw-reason {
  max-width: 180px;
  word-break: break-word;
  color: #64748b;
}
.secret-keyword-table .risk-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}
.secret-keyword-table .risk-badge.high {
  background: #fef2f2;
  color: #b91c1c;
}
.secret-keyword-table .risk-badge.medium {
  background: #fffbeb;
  color: #b45309;
}
.secret-keyword-table .risk-badge.low {
  background: #f0fdf4;
  color: #15803d;
}
.audit-group-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.audit-group-card {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
}
.audit-group-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}
.audit-group-title {
  font-weight: 600;
}
.audit-group-count {
  color: #6b7280;
}
.audit-group-issue {
  padding: 8px 0;
  border-top: 1px dashed #e5e7eb;
}
.audit-group-issue:first-of-type {
  border-top: none;
  padding-top: 0;
}
.audit-group-issue-row {
  margin-top: 4px;
  line-height: 1.6;
}
.audit-issue-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  padding: 2px 8px;
  margin-right: 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}
.audit-issue-badge.high {
  background: #fef2f2;
  color: #b91c1c;
}
.audit-issue-badge.medium {
  background: #fffbeb;
  color: #92400e;
}
.audit-issue-badge.low {
  background: #eff6ff;
  color: #1d4ed8;
}
</style>
