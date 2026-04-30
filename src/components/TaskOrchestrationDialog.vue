<template>
  <div class="workflow-dialog">
    <div
      class="workflow-main"
      :class="{ 'left-collapsed': leftCollapsed, 'right-collapsed': rightCollapsed }"
      :style="workflowMainStyle"
    >
      <aside v-show="!leftCollapsed" class="palette-panel">
        <button
          type="button"
          class="panel-collapse-handle panel-collapse-handle-left"
          :aria-label="leftCollapsed ? '展开工具库' : '收起工具库'"
          title="收起工具库"
          @click="leftCollapsed = true"
        ><span class="panel-collapse-handle-arrow">‹</span></button>
        <div class="palette-toolbar">
          <div class="palette-tabs">
            <button
              type="button"
              class="palette-tab-btn"
              :class="{ active: paletteTab === 'tool' }"
              @click="paletteTab = 'tool'"
            >工具</button>
            <button
              type="button"
              class="palette-tab-btn"
              :class="{ active: paletteTab === 'assistant' }"
              @click="paletteTab = 'assistant'"
            >助手</button>
          </div>
          <input
            v-model.trim="paletteKeyword"
            type="text"
            class="panel-search compact"
            :placeholder="paletteSearchPlaceholder"
          />
        </div>
        <div class="palette-groups">
          <div
            v-for="group in activePaletteGroups"
            :key="group.label"
            class="palette-group"
          >
            <button
              type="button"
              class="palette-group-header"
              :class="{ collapsed: group.collapsed }"
              @click="togglePaletteGroup(group.label)"
            >
              <span class="palette-group-title">{{ group.label }}</span>
              <span class="palette-group-meta">
                <span class="palette-group-count">{{ group.items.length }}</span>
                <span class="palette-group-arrow" :class="{ collapsed: group.collapsed }">⌄</span>
              </span>
            </button>
            <div v-show="!group.collapsed" class="palette-group-items">
              <button
                v-for="item in group.items"
                :key="item.id || item.type"
                type="button"
                class="palette-item"
                :class="{ disabled: !hasActiveWorkflow }"
                :disabled="!hasActiveWorkflow"
                @mousedown.prevent="onPaletteMouseDown(item, $event)"
                @click="onPaletteClick(item)"
              >
                <span class="palette-item-title">{{ item.title }}</span>
                <span class="palette-item-desc">{{ item.description || item.groupLabel }}</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
      <div
        v-if="!leftCollapsed"
        class="panel-resizer panel-resizer-left"
        @mousedown.prevent="startPanelResize('left', $event)"
      ></div>

      <section ref="canvasWrapper" class="canvas-panel">
        <button
          v-if="leftCollapsed"
          type="button"
          class="panel-collapse-handle panel-collapse-handle-left collapsed"
          aria-label="展开工具库"
          title="展开工具库"
          @click="openToolPalette"
        ><span class="panel-collapse-handle-arrow">›</span></button>
        <button
          v-if="rightCollapsed"
          type="button"
          class="panel-collapse-handle panel-collapse-handle-right collapsed"
          aria-label="展开工作流"
          title="展开工作流"
          @click="rightCollapsed = false"
        ><span class="panel-collapse-handle-arrow">‹</span></button>
        <div v-if="hasOpenTabs" class="canvas-tabs">
          <div
            v-for="workflow in openWorkflowTabs"
            :key="`canvas-tab-${workflow.id}`"
            class="canvas-tab"
            :class="{ active: workflow.id === activeWorkflowId }"
            @contextmenu.prevent="openTabContextMenu(workflow, $event)"
          >
            <button
              type="button"
              class="canvas-tab-main"
              :title="workflow.name || '未命名工作流'"
              @click="loadWorkflow(workflow)"
            >
              <span class="canvas-tab-name">{{ workflow.name || '未命名工作流' }}</span>
            </button>
            <button
              type="button"
              class="canvas-tab-close"
              title="关闭"
              @click.stop="closeWorkflowTab(workflow.id)"
            >×</button>
          </div>
        </div>
        <div v-if="hasActiveWorkflow" class="canvas-toolbar">
          <div class="toolbar-section">
            <div class="toolbar-section-title">基础图元</div>
            <div class="toolbar-group">
              <button
                type="button"
                class="canvas-tool-item"
                :class="{ disabled: hasStartNode }"
                :disabled="hasStartNode"
                title="拖动开始到画布"
                @mousedown.prevent="onToolbarNodeMouseDown('start', $event)"
              >
                <svg viewBox="0 0 16 16" class="toolbar-icon stroke-icon" aria-hidden="true">
                  <circle cx="8" cy="8" r="5.5"></circle>
                  <path d="M7 5.8 10 8 7 10.2Z"></path>
                </svg>
                <span class="canvas-tool-item-label">开始</span>
              </button>
              <button
                type="button"
                class="canvas-tool-item end"
                :class="{ disabled: hasEndNode }"
                :disabled="hasEndNode"
                title="拖动结束到画布"
                @mousedown.prevent="onToolbarNodeMouseDown('end', $event)"
              >
                <svg viewBox="0 0 16 16" class="toolbar-icon stroke-icon" aria-hidden="true">
                  <circle cx="8" cy="8" r="5.5"></circle>
                  <path d="M6 6h4v4H6Z"></path>
                </svg>
                <span class="canvas-tool-item-label">结束</span>
              </button>
            </div>
          </div>
          <span class="toolbar-divider" aria-hidden="true"></span>
          <div class="toolbar-section">
            <div class="toolbar-section-title">画布操作</div>
            <div class="toolbar-group compact">
              <button
                type="button"
                class="ghost-btn tiny icon-btn"
                aria-label="编辑信息"
                title="编辑信息"
                @click="openEditWorkflowDialog"
              >
                <svg viewBox="0 0 16 16" class="toolbar-icon stroke-icon" aria-hidden="true">
                  <path d="M3 11.5 2.5 13.5 4.5 13 11.8 5.7 10.3 4.2 3 11.5Z"></path>
                  <path d="M9.8 4.7 11.3 3.2 12.8 4.7 11.3 6.2"></path>
                </svg>
              </button>
              <button
                type="button"
                class="ghost-btn tiny icon-btn minimap-toggle-btn"
                :class="{ inactive: !showMiniMap }"
                :aria-label="showMiniMap ? '收起小地图' : '展开小地图'"
                :title="showMiniMap ? '收起小地图' : '展开小地图'"
                :aria-pressed="showMiniMap"
                @click="showMiniMap = !showMiniMap"
              >
                <svg viewBox="0 0 16 16" class="toolbar-icon" aria-hidden="true">
                  <rect x="2" y="2" width="4" height="4" rx="1"></rect>
                  <rect x="10" y="2" width="4" height="4" rx="1"></rect>
                  <rect x="2" y="10" width="4" height="4" rx="1"></rect>
                  <rect x="10" y="10" width="4" height="4" rx="1"></rect>
                </svg>
              </button>
              <button
                type="button"
                class="ghost-btn tiny icon-btn"
                aria-label="适应画布"
                title="适应画布"
                @click="fitWorkflowView"
              >
                <svg viewBox="0 0 16 16" class="toolbar-icon stroke-icon" aria-hidden="true">
                  <path d="M5 2.5H2.5V5"></path>
                  <path d="M11 2.5H13.5V5"></path>
                  <path d="M5 13.5H2.5V11"></path>
                  <path d="M11 13.5H13.5V11"></path>
                  <path d="M6.5 6.5h3"></path>
                  <path d="M8 5v6"></path>
                </svg>
              </button>
              <button
                type="button"
                class="ghost-btn tiny icon-btn"
                aria-label="校验"
                title="校验"
                @click="validateCurrentWorkflow"
              >
                <svg viewBox="0 0 16 16" class="toolbar-icon stroke-icon" aria-hidden="true">
                  <path d="M3.5 8 6.5 11 12.5 5"></path>
                  <path d="M8 1.8 13.5 4.2v3.7c0 3-2.1 5.3-5.5 6.3-3.4-1-5.5-3.3-5.5-6.3V4.2L8 1.8Z"></path>
                </svg>
              </button>
            </div>
          </div>
          <span class="toolbar-divider" aria-hidden="true"></span>
          <div class="toolbar-section">
            <div class="toolbar-section-title">保存</div>
            <div class="toolbar-group">
              <button type="button" class="primary-btn tiny" @click="saveCurrentWorkflow">保存</button>
              <button type="button" class="ghost-btn tiny" :disabled="isStarting" @click="startCurrentWorkflowDebug">调试启动</button>
              <button type="button" class="ghost-btn tiny" @click="runPathAnalysis">模拟分析</button>
            </div>
          </div>
        </div>
        <div v-if="shouldShowDebugPanel && !debugPanelCollapsed" class="workflow-debug-dock">
          <div class="workflow-debug-dock-header">
            <div>
              <div class="workflow-debug-dock-title">工作流调试</div>
              <div class="workflow-debug-dock-subtitle">
                {{ activeWorkflowDebugTask?.title || workflowName || '当前工作流' }}
                <span v-if="activeWorkflowDebugState?.waitingNodeTitle"> · 当前节点：{{ activeWorkflowDebugState.waitingNodeTitle }}</span>
              </div>
            </div>
            <div class="workflow-debug-dock-actions">
              <span class="workflow-debug-dock-status" :class="{ paused: activeWorkflowDebugState?.paused, running: activeWorkflowDebugTask?.status === 'running' && !activeWorkflowDebugState?.paused }">
                {{ activeWorkflowDebugState?.paused ? '已暂停' : (activeWorkflowDebugTask?.status === 'running' ? '运行中' : '已结束') }}
              </span>
              <button type="button" class="ghost-btn tiny" :disabled="!canResumeDebug" @click="stepActiveDebugRun">单步</button>
              <button type="button" class="primary-btn tiny" :disabled="!canResumeDebug" @click="resumeActiveDebugRun">继续</button>
              <button type="button" class="ghost-btn tiny" :disabled="!canSkipDebugNode" @click="skipActiveDebugNode">跳过当前节点</button>
              <button type="button" class="danger-btn tiny" :disabled="!isWorkflowDebugActive" @click="stopActiveDebugRun">停止</button>
              <button type="button" class="ghost-btn tiny" @click="debugPanelCollapsed = true">收起</button>
            </div>
          </div>
          <div class="workflow-debug-dock-grid">
            <div class="workflow-debug-card">
              <div class="workflow-debug-card-head">
                <div class="workflow-debug-card-title">当前步输入</div>
                <button type="button" class="ghost-btn tiny" @click="copyActiveDebugInput">复制</button>
              </div>
              <div class="workflow-debug-meta">来源：{{ activeWorkflowDebugState?.inputSummary || '—' }} · 类型：{{ activeWorkflowDebugState?.inputValueType || 'empty' }}</div>
              <pre class="workflow-debug-pre">{{ activeWorkflowDebugState?.inputPreview || '—' }}</pre>
              <details v-if="hasStructuredInputValue" class="workflow-debug-json-details">
                <summary>结构化数据</summary>
                <pre class="workflow-debug-pre compact">{{ formatJsonForDebug(activeWorkflowDebugState?.inputValue) }}</pre>
              </details>
              <template v-if="activeWorkflowDebugState?.paused">
                <div class="workflow-debug-meta">可在继续前临时修改本节点输入。</div>
                <textarea
                  v-model="debugInputEditorText"
                  class="field-input workflow-modal-textarea workflow-debug-edit-input"
                  placeholder="在这里修改当前节点输入，点击“应用输入”后再继续/单步"
                ></textarea>
                <div class="workflow-debug-inline-actions">
                  <button type="button" class="ghost-btn tiny" @click="resetActiveDebugInputEdit">恢复原输入</button>
                  <button type="button" class="primary-btn tiny" @click="applyActiveDebugInputEdit">应用输入</button>
                </div>
              </template>
            </div>
            <div class="workflow-debug-card">
              <div class="workflow-debug-card-head">
                <div class="workflow-debug-card-title">当前步输出</div>
                <button type="button" class="ghost-btn tiny" @click="copyActiveDebugOutput">复制</button>
              </div>
              <div v-if="activeWorkflowDebugState?.paused" class="workflow-debug-placeholder">当前停留在节点执行前，继续后会在这里生成该节点输出。</div>
              <div v-else class="workflow-debug-placeholder">调试运行中，输出完成后会回填到这里。</div>
              <div v-if="activeWorkflowDebugState?.lastOutputNodeTitle" class="workflow-debug-meta">最近完成：{{ activeWorkflowDebugState.lastOutputNodeTitle }} · 类型：{{ activeWorkflowDebugState?.lastOutputValueType || 'empty' }}</div>
              <pre class="workflow-debug-pre">{{ activeWorkflowDebugState?.lastOutputText || '—' }}</pre>
              <details v-if="hasStructuredOutputValue" class="workflow-debug-json-details">
                <summary>结构化数据</summary>
                <pre class="workflow-debug-pre compact">{{ formatJsonForDebug(activeWorkflowDebugState?.lastOutputValue) }}</pre>
              </details>
            </div>
          </div>
          <div class="workflow-debug-card">
            <div class="workflow-debug-card-head">
              <div class="workflow-debug-card-title">变量视图</div>
              <button type="button" class="ghost-btn tiny" @click="copyActiveDebugVariables">复制 JSON</button>
            </div>
            <div class="workflow-debug-var-list">
              <div v-for="item in activeWorkflowDebugVariables" :key="item.key" class="workflow-debug-var-item">
                <div class="workflow-debug-var-head">
                  <span class="workflow-debug-var-key">{{ item.key }}</span>
                  <span class="workflow-debug-var-type">{{ item.type }}</span>
                </div>
                <div class="workflow-debug-var-label">{{ item.label }}</div>
                <pre class="workflow-debug-pre compact">{{ formatDebugValue(item.value) }}</pre>
              </div>
            </div>
          </div>
          <div v-if="(activeWorkflowDebugState?.parentOutputs || []).length" class="workflow-debug-card workflow-debug-parents">
            <div class="workflow-debug-card-title">上游输入快照</div>
            <div v-for="parent in activeWorkflowDebugState.parentOutputs" :key="parent.nodeId" class="workflow-debug-parent-item">
              <div class="workflow-debug-parent-title">{{ parent.nodeTitle }} · {{ Array.isArray(parent.value) ? 'array' : (parent.value == null || parent.value === '' ? 'empty' : typeof parent.value === 'object' ? 'object' : typeof parent.value) }}</div>
              <pre class="workflow-debug-pre">{{ parent.text || '—' }}</pre>
            </div>
          </div>
        </div>
        <button v-else-if="shouldShowDebugPanel && debugPanelCollapsed" type="button" class="workflow-debug-expand-btn" @click="debugPanelCollapsed = false">
          展开调试面板
        </button>
        <div v-if="hasActiveWorkflow" class="canvas-workspace">
          <VueFlow
            v-model:nodes="nodes"
            v-model:edges="edges"
            class="workflow-canvas"
            :default-viewport="{ zoom: 1 }"
            :min-zoom="0.3"
            :max-zoom="1.6"
            :fit-view-on-init="true"
            @connect="onConnect"
            @drop="onCanvasDrop"
            @dragover="onCanvasDragOver"
            @dragenter="onCanvasDragOver"
            @pane-click="clearSelection"
            @node-click="onNodeClick"
            @node-double-click="onNodeDoubleClick"
            @edge-click="onEdgeClick"
            @edge-context-menu="onEdgeContextMenu"
          >
            <MiniMap v-if="showMiniMap" pannable zoomable />
            <Background />
            <Controls />
            <template #node-input="{ id, data, selected }">
              <div
                class="canvas-node canvas-node-start"
                :class="{ selected }"
                @contextmenu.prevent.stop="openNodeContextMenu(id, $event)"
              >
                <NodeResizer
                  :is-visible="selected"
                  :min-width="52"
                  :min-height="30"
                  color="#2563eb"
                />
                <input
                  v-if="editingNodeId === id"
                  :id="`node-rename-input-${id}`"
                  v-model="editingNodeTitle"
                  type="text"
                  class="canvas-node-rename-input canvas-node-rename-input-start nodrag nopan"
                  @mousedown.stop
                  @pointerdown.stop
                  @click.stop
                  @dblclick.stop
                  @keydown.enter.stop.prevent="commitNodeRename"
                  @keydown.esc.stop.prevent="cancelNodeRename"
                  @blur="commitNodeRename"
                />
                <div
                  v-else
                  class="canvas-node-start-label"
                  @dblclick.stop="renameNode(id)"
                >{{ data?.title || '开始' }}</div>
                <Handle type="source" :position="Position.Right" class="canvas-handle canvas-handle-start" />
              </div>
            </template>
            <template #node-output="{ id, data, selected }">
              <div
                class="canvas-node canvas-node-end"
                :class="{ selected }"
                @contextmenu.prevent.stop="openNodeContextMenu(id, $event)"
              >
                <NodeResizer
                  :is-visible="selected"
                  :min-width="52"
                  :min-height="30"
                  color="#dc2626"
                />
                <Handle type="target" :position="Position.Left" class="canvas-handle canvas-handle-end" />
                <input
                  v-if="editingNodeId === id"
                  :id="`node-rename-input-${id}`"
                  v-model="editingNodeTitle"
                  type="text"
                  class="canvas-node-rename-input canvas-node-rename-input-end nodrag nopan"
                  @mousedown.stop
                  @pointerdown.stop
                  @click.stop
                  @dblclick.stop
                  @keydown.enter.stop.prevent="commitNodeRename"
                  @keydown.esc.stop.prevent="cancelNodeRename"
                  @blur="commitNodeRename"
                />
                <div
                  v-else
                  class="canvas-node-end-label"
                  @dblclick.stop="renameNode(id)"
                >{{ data?.title || '结束' }}</div>
              </div>
            </template>
            <template #node-default="{ id, data, selected }">
              <div
                class="canvas-node"
                :class="[data?.kind === 'tool' ? 'canvas-node-tool' : 'canvas-node-assistant', { selected, breakpoint: isNodeBreakpoint(id) }, getNodeDebugClass(id)]"
                @contextmenu.prevent.stop="openNodeContextMenu(id, $event)"
              >
                <NodeResizer
                  :is-visible="selected"
                  :min-width="data?.kind === 'tool' ? 150 : 96"
                  :min-height="data?.kind === 'tool' ? 72 : 32"
                  :color="data?.kind === 'tool' ? '#7c3aed' : '#2563eb'"
                />
                <Handle type="target" :position="Position.Left" class="canvas-handle" />
                <input
                  v-if="editingNodeId === id"
                  :id="`node-rename-input-${id}`"
                  v-model="editingNodeTitle"
                  type="text"
                  class="canvas-node-rename-input nodrag nopan"
                  @mousedown.stop
                  @pointerdown.stop
                  @click.stop
                  @dblclick.stop
                  @keydown.enter.stop.prevent="commitNodeRename"
                  @keydown.esc.stop.prevent="cancelNodeRename"
                  @blur="commitNodeRename"
                />
                <div
                  v-else
                  class="canvas-node-body"
                  @dblclick.stop="data?.kind === 'tool' ? openToolConfigDialog(id) : openAssistantConfigDialog(id)"
                >
                  <div class="canvas-node-kind-row">
                    <span class="canvas-node-kind">{{ data?.kind === 'tool' ? '工具' : '助手' }}</span>
                    <div class="canvas-node-kind-actions">
                      <img
                        v-if="data?.kind !== 'tool' && isNodeImageIcon(data?.icon)"
                        :src="getNodeIconSrc(data?.icon)"
                        class="canvas-node-icon-image"
                        alt=""
                      />
                      <span v-else class="canvas-node-icon-text">{{ data?.icon || (data?.kind === 'tool' ? 'TOOL' : '🧠') }}</span>
                      <button
                        type="button"
                        class="canvas-node-breakpoint-btn nodrag nopan"
                        :class="{ active: isNodeBreakpoint(id) }"
                        :title="isNodeBreakpoint(id) ? '取消断点' : '设为断点'"
                        @click.stop="toggleNodeBreakpoint(id)"
                      >●</button>
                    </div>
                  </div>
                  <div class="canvas-node-title compact">{{ data?.title || (data?.kind === 'tool' ? '未命名工具' : '未命名助手') }}</div>
                  <div v-if="data?.kind === 'tool'" class="canvas-node-subtitle">{{ data?.groupLabel || '流程工具' }}</div>
                  <div class="canvas-node-input-hint">{{ getInputBindingSummary(data?.inputBinding, id) }}</div>
                  <div v-if="data?.kind === 'tool'" class="canvas-node-output-hint">{{ getToolOutputHint(data?.toolType) }}</div>
                  <div v-else class="canvas-node-output-hint">{{ getAssistantOutputHint(data?.configOverrides) }}</div>
                  <div v-if="getNodeDebugBadge(id)" class="canvas-node-debug-badge">{{ getNodeDebugBadge(id) }}</div>
                  <div
                    v-if="getNodeDebugStatus(id) === 'running' || getNodeDebugStatus(id) === 'paused'"
                    class="canvas-node-progress"
                    :class="{ paused: getNodeDebugStatus(id) === 'paused' }"
                  >
                    <div class="canvas-node-progress-bar">
                      <div class="canvas-node-progress-fill" :style="{ width: `${getNodeRunProgress(id) || 0}%` }"></div>
                    </div>
                    <div class="canvas-node-progress-text">{{ getNodeRunProgressText(id) || '执行中' }}</div>
                  </div>
                </div>
                <Handle type="source" :position="Position.Right" class="canvas-handle" />
              </div>
            </template>
          </VueFlow>
          <div class="canvas-tip">
            <span>支持分支与汇合，箭头始终指向目标节点。</span>
          </div>
        </div>
        <div v-else class="workflow-welcome">
          <div class="workflow-welcome-card">
            <div class="workflow-welcome-title">欢迎使用任务编排</div>
            <div class="workflow-welcome-desc">从右侧工作流清单打开已有工作流，或新建一个工作流开始编排。</div>
            <div class="workflow-welcome-actions">
              <button type="button" class="primary-btn" @click="openCreateWorkflowDialog">新建工作流</button>
              <button
                v-if="workflows.length > 0"
                type="button"
                class="ghost-btn"
                @click="loadWorkflow(workflows[0])"
              >打开最近工作流</button>
            </div>
            <div v-if="workflows.length > 0" class="workflow-welcome-list">
              <button
                v-for="workflow in workflows.slice(0, 5)"
                :key="`welcome-${workflow.id}`"
                type="button"
                class="workflow-welcome-item"
                @click="loadWorkflow(workflow)"
              >
                <span class="workflow-welcome-item-name">{{ workflow.name }}</span>
                <span class="workflow-welcome-item-desc">{{ workflow.description || '暂无说明' }}</span>
              </button>
            </div>
          </div>
        </div>
      </section>
      <div
        v-if="!rightCollapsed"
        class="panel-resizer panel-resizer-right"
        @mousedown.prevent="startPanelResize('right', $event)"
      ></div>

      <aside v-show="!rightCollapsed" class="sidebar-panel">
        <button
          type="button"
          class="panel-collapse-handle panel-collapse-handle-right"
          :aria-label="rightCollapsed ? '展开工作流' : '收起工作流'"
          title="收起工作流"
          @click="rightCollapsed = true"
        ><span class="panel-collapse-handle-arrow">›</span></button>
        <div class="workflow-list-toolbar">
          <div class="workflow-list-toolbar-card">
            <div class="workflow-list-toolbar-header">
              <div class="workflow-list-toolbar-title">工作流清单</div>
              <div class="workflow-list-toolbar-actions">
                <button
                  type="button"
                  class="ghost-btn tiny icon-btn"
                  aria-label="导入工作流"
                  title="导入工作流"
                  @click="openWorkflowImport"
                >
                  <svg viewBox="0 0 16 16" class="toolbar-icon stroke-icon" aria-hidden="true">
                    <path d="M8 2.5v7"></path>
                    <path d="M5.5 7 8 9.8 10.5 7"></path>
                    <path d="M3 11.5h10"></path>
                  </svg>
                </button>
                <button
                  type="button"
                  class="ghost-btn tiny icon-btn"
                  aria-label="导出工作流"
                  title="导出工作流"
                  :disabled="!canExportCurrentWorkflow && !canExportWorkflows && !canExportAllWorkflows"
                  @click="openExportDialog"
                >
                  <svg viewBox="0 0 16 16" class="toolbar-icon stroke-icon" aria-hidden="true">
                    <path d="M8 10.5v-7"></path>
                    <path d="M5.5 6 8 3.2 10.5 6"></path>
                    <path d="M3 11.5h10"></path>
                  </svg>
                </button>
                <button
                  type="button"
                  class="primary-btn tiny icon-btn"
                  aria-label="新建工作流"
                  title="新建工作流"
                  @click="openCreateWorkflowDialog"
                >
                  <svg viewBox="0 0 16 16" class="toolbar-icon stroke-icon" aria-hidden="true">
                    <path d="M8 3v10"></path>
                    <path d="M3 8h10"></path>
                  </svg>
                </button>
                <button
                  type="button"
                  class="ghost-btn tiny icon-btn"
                  aria-label="编辑工作流"
                  title="编辑工作流"
                  :disabled="!hasActiveWorkflow"
                  @click="openEditWorkflowDialog"
                >
                  <svg viewBox="0 0 16 16" class="toolbar-icon stroke-icon" aria-hidden="true">
                    <path d="M3 11.5 2.5 13.5 4.5 13 11.8 5.7 10.3 4.2 3 11.5Z"></path>
                    <path d="M9.8 4.7 11.3 3.2 12.8 4.7 11.3 6.2"></path>
                  </svg>
                </button>
                <button
                  type="button"
                  class="danger-btn tiny icon-btn"
                  aria-label="删除选中工作流"
                  title="删除选中工作流"
                  :disabled="!hasWorkflowSelection"
                  @click="deleteSelectedWorkflows"
                >
                  <svg viewBox="0 0 16 16" class="toolbar-icon stroke-icon" aria-hidden="true">
                    <path d="M3.5 4.5h9"></path>
                    <path d="M6 4.5V3.2h4v1.3"></path>
                    <path d="M5 6.2v5.3"></path>
                    <path d="M8 6.2v5.3"></path>
                    <path d="M11 6.2v5.3"></path>
                    <path d="M4.2 4.5l.5 8.3h6.6l.5-8.3"></path>
                  </svg>
                </button>
              </div>
            </div>
            <div class="workflow-list-toolbar-search">
              <input
                v-model.trim="workflowKeyword"
                type="text"
                class="panel-search compact workflow-search-input"
                placeholder="搜索工作流"
              />
              <label class="workflow-select-all">
                <input
                  type="checkbox"
                  :checked="allFilteredWorkflowsSelected"
                  :indeterminate.prop="hasWorkflowSelection && !allFilteredWorkflowsSelected"
                  :disabled="filteredWorkflows.length === 0"
                  @change="toggleSelectAllFiltered($event.target.checked)"
                />
                <span>全选</span>
              </label>
            </div>
          </div>
        </div>
        <div class="workflow-list-section">
          <div class="workflow-list">
            <div
              v-for="workflow in filteredWorkflows"
              :key="workflow.id"
              class="workflow-list-item"
              :class="{ active: workflow.id === activeWorkflowId, selected: isWorkflowSelected(workflow.id) }"
            >
              <label class="workflow-list-check" @click.stop>
                <input
                  type="checkbox"
                  :checked="isWorkflowSelected(workflow.id)"
                  @change="toggleWorkflowSelection(workflow.id, $event.target.checked)"
                />
              </label>
              <button type="button" class="workflow-list-main" @click="loadWorkflow(workflow)">
                <span class="workflow-list-name">{{ workflow.name }}</span>
                <span class="workflow-list-meta">{{ workflow.description || '暂无说明' }}</span>
              </button>
              <div class="workflow-list-actions">
                <button
                  type="button"
                  class="success-btn tiny"
                  :disabled="isStarting && workflow.id === startingWorkflowId"
                  @click.stop="startWorkflowFromList(workflow)"
                >{{ isStarting && workflow.id === startingWorkflowId ? '启动中...' : '启动' }}</button>
                <button
                  type="button"
                  class="ghost-btn tiny"
                  :disabled="isStarting && workflow.id === startingWorkflowId"
                  @click.stop="startWorkflowDebugFromList(workflow)"
                >调试</button>
                <button
                  type="button"
                  class="danger-btn tiny icon-btn workflow-list-delete-btn"
                  aria-label="删除工作流"
                  title="删除工作流"
                  @click.stop="deleteWorkflowItem(workflow.id)"
                >
                  <svg viewBox="0 0 16 16" class="toolbar-icon stroke-icon" aria-hidden="true">
                    <path d="M3.5 4.5h9"></path>
                    <path d="M6 4.5V3.2h4v1.3"></path>
                    <path d="M5 6.2v5.3"></path>
                    <path d="M8 6.2v5.3"></path>
                    <path d="M11 6.2v5.3"></path>
                    <path d="M4.2 4.5l.5 8.3h6.6l.5-8.3"></path>
                  </svg>
                </button>
              </div>
            </div>
            <div v-if="filteredWorkflows.length === 0" class="workflow-list-empty">
              {{ workflows.length === 0 ? '暂无工作流' : '未找到匹配的工作流' }}
            </div>
          </div>
          <div class="sidebar-actions">
            <button type="button" class="ghost-btn small" @click="openTaskList">打开任务清单</button>
          </div>
        </div>
      </aside>
    </div>
    <div
      v-if="customDrag.active && customDrag.payload"
      class="assistant-drag-preview"
      :class="{ over: customDrag.overCanvas }"
      :style="{ left: `${customDrag.x}px`, top: `${customDrag.y}px` }"
    >
      <span class="assistant-drag-preview-text">{{ customDrag.payload.title }}</span>
    </div>
    <div
      v-if="createWorkflowDialogVisible"
      class="workflow-modal-mask"
      @click.self="closeCreateWorkflowDialog"
    >
      <div class="workflow-modal" role="dialog" aria-modal="true" :aria-label="workflowDialogTitle">
        <div class="workflow-modal-header">
          <div class="workflow-modal-title">{{ workflowDialogTitle }}</div>
          <button type="button" class="ghost-btn tiny" @click="closeCreateWorkflowDialog">取消</button>
        </div>
        <div class="workflow-modal-body">
          <label class="field-label">名称</label>
          <input
            ref="createWorkflowNameInput"
            v-model.trim="newWorkflowName"
            type="text"
            class="field-input"
            maxlength="60"
            placeholder="请输入工作流名称"
            @keydown.enter.prevent="confirmCreateWorkflow"
          />
          <label class="field-label">说明</label>
          <textarea
            v-model.trim="newWorkflowDescription"
            class="field-input workflow-modal-textarea"
            maxlength="200"
            placeholder="请输入工作流说明或执行目的"
            @keydown.enter.ctrl.prevent="confirmCreateWorkflow"
          ></textarea>
          <div v-if="createWorkflowError" class="workflow-modal-error">{{ createWorkflowError }}</div>
        </div>
        <div class="workflow-modal-actions">
          <button type="button" class="ghost-btn" @click="closeCreateWorkflowDialog">取消</button>
          <button type="button" class="primary-btn" @click="confirmCreateWorkflow">确定</button>
        </div>
      </div>
    </div>
    <div
      v-if="exportDialog.visible"
      class="workflow-modal-mask"
      @click.self="closeExportDialog"
    >
      <div class="workflow-modal export-workflow-modal" role="dialog" aria-modal="true" aria-label="导出工作流">
        <div class="workflow-modal-header">
          <div class="workflow-modal-title">导出工作流</div>
          <button type="button" class="ghost-btn tiny" @click="closeExportDialog">取消</button>
        </div>
        <div class="workflow-modal-body">
          <label class="field-label">导出包名称</label>
          <input
            v-model.trim="exportDialog.packageName"
            type="text"
            class="field-input"
            maxlength="80"
            placeholder="请输入导出包名称"
          />
          <label class="field-label">导出包说明</label>
          <textarea
            v-model.trim="exportDialog.packageDescription"
            class="field-input workflow-modal-textarea export-package-textarea"
            maxlength="200"
            placeholder="请输入导出包说明"
          ></textarea>
          <div class="export-scope-list">
            <label class="export-scope-item" :class="{ disabled: !canExportCurrentWorkflow }">
              <input
                v-model="exportDialog.scope"
                type="radio"
                name="workflow-export-scope"
                value="current"
                :disabled="!canExportCurrentWorkflow"
              />
              <span class="export-scope-label">导出当前工作流</span>
            </label>
            <label class="export-scope-item" :class="{ disabled: !canExportWorkflows }">
              <input
                v-model="exportDialog.scope"
                type="radio"
                name="workflow-export-scope"
                value="selected"
                :disabled="!canExportWorkflows"
              />
              <span class="export-scope-label">导出选中工作流</span>
            </label>
            <label class="export-scope-item" :class="{ disabled: !canExportAllWorkflows }">
              <input
                v-model="exportDialog.scope"
                type="radio"
                name="workflow-export-scope"
                value="all"
                :disabled="!canExportAllWorkflows"
              />
              <span class="export-scope-label">导出全部工作流</span>
            </label>
          </div>
          <div class="import-summary-grid export-summary-grid">
            <div class="import-summary-card">
              <span class="import-summary-value">{{ exportDialogSummary.workflows }}</span>
              <span class="import-summary-label">工作流</span>
            </div>
            <div class="import-summary-card">
              <span class="import-summary-value">{{ exportDialogSummary.customAssistants }}</span>
              <span class="import-summary-label">自定义助手</span>
            </div>
            <div class="import-summary-card">
              <span class="import-summary-value">{{ exportDialogSummary.builtinAssistants }}</span>
              <span class="import-summary-label">系统助手配置</span>
            </div>
          </div>
        </div>
        <div class="workflow-modal-actions">
          <button type="button" class="ghost-btn" @click="closeExportDialog">取消</button>
          <button type="button" class="primary-btn" @click="exportWorkflowsByScope(exportDialog.scope)">导出</button>
        </div>
      </div>
    </div>
    <div
      v-if="tabContextMenu.visible"
      class="workflow-tab-context-menu"
      :style="{ left: `${tabContextMenu.x}px`, top: `${tabContextMenu.y}px` }"
      @click.stop
    >
      <button type="button" class="workflow-tab-context-item" @click="handleTabContextAction('close')">关闭</button>
      <button type="button" class="workflow-tab-context-item" @click="handleTabContextAction('closeOthers')">关闭其他</button>
      <button type="button" class="workflow-tab-context-item" @click="handleTabContextAction('closeAll')">关闭全部</button>
    </div>
    <div
      v-if="nodeContextMenu.visible"
      class="workflow-node-context-menu"
      :style="{ left: `${nodeContextMenu.x}px`, top: `${nodeContextMenu.y}px` }"
      @click.stop
    >
      <button
        type="button"
        class="workflow-tab-context-item"
        @click="handleNodeContextAction('rename')"
      >重命名</button>
      <button
        v-if="nodeContextMenu.canCopy"
        type="button"
        class="workflow-tab-context-item"
        @click="handleNodeContextAction('copy')"
      >复制节点</button>
      <button
        type="button"
        class="workflow-tab-context-item"
        @click="handleNodeContextAction('resetSize')"
      >恢复默认大小</button>
      <button
        v-if="nodeContextMenu.canConfigure"
        type="button"
        class="workflow-tab-context-item"
        @click="handleNodeContextAction('configure')"
      >配置节点</button>
      <button
        v-if="nodeContextMenu.canBreakpoint"
        type="button"
        class="workflow-tab-context-item"
        @click="handleNodeContextAction('breakpoint')"
      >{{ nodeContextMenu.isBreakpoint ? '取消断点' : '设为断点' }}</button>
      <button
        v-if="nodeContextMenu.canDebugFromHere"
        type="button"
        class="workflow-tab-context-item"
        @click="handleNodeContextAction('debugFromHere')"
      >从此节点调试</button>
      <button
        v-if="nodeContextMenu.canDelete"
        type="button"
        class="workflow-tab-context-item danger"
        @click="handleNodeContextAction('delete')"
      >删除节点</button>
    </div>
    <div
      v-if="edgeContextMenu.visible"
      class="workflow-node-context-menu"
      :style="{ left: `${edgeContextMenu.x}px`, top: `${edgeContextMenu.y}px` }"
      @click.stop
    >
      <button
        type="button"
        class="workflow-tab-context-item"
        @click="handleEdgeContextAction('configure')"
      >配置分支</button>
      <button
        type="button"
        class="workflow-tab-context-item danger"
        @click="handleEdgeContextAction('delete')"
      >删除连线</button>
    </div>
  </div>
  <input
    ref="workflowImportInput"
    type="file"
    accept=".json,application/json"
    class="workflow-import-input"
    @change="onWorkflowImportChange"
  />
  <div
    v-if="toolConfigDialog.visible"
    class="workflow-modal-mask"
    @click.self="closeToolConfigDialog"
  >
    <div class="workflow-modal tool-config-modal" role="dialog" aria-modal="true" aria-label="配置工具节点">
      <div class="workflow-modal-header">
        <div class="workflow-modal-title">配置工具节点</div>
        <button type="button" class="ghost-btn tiny" @click="closeToolConfigDialog">取消</button>
      </div>
      <div class="workflow-modal-body">
        <label class="field-label">节点名称</label>
        <input
          v-model.trim="toolConfigDialog.title"
          type="text"
          class="field-input"
          maxlength="60"
          placeholder="请输入工具节点名称"
        />
        <label class="field-label">节点说明</label>
        <textarea
          v-model.trim="toolConfigDialog.description"
          class="field-input workflow-modal-textarea"
          maxlength="200"
          placeholder="请输入工具节点说明"
        ></textarea>
        <label class="field-label">输入来源</label>
        <select v-model="toolConfigDialog.config.inputBinding.mode" class="field-input">
          <option value="auto">自动汇总上游输出</option>
          <option value="single">选择单个上游字段</option>
          <option value="template">使用模板组装输入</option>
        </select>
        <template v-if="toolConfigDialog.config.inputBinding.mode === 'single'">
          <label class="field-label">上游节点</label>
          <select v-model="toolConfigDialog.config.inputBinding.sourceNodeId" class="field-input">
            <option value="">请选择上游节点</option>
            <option v-for="item in getIncomingSourceNodes(toolConfigDialog.nodeId)" :key="item.id" :value="item.id">{{ item.title }}</option>
          </select>
          <label class="field-label">字段路径</label>
          <input v-model.trim="toolConfigDialog.config.inputBinding.valuePath" type="text" class="field-input" placeholder="如 result.score；留空表示使用整个输出" />
          <div v-if="toolConfigDialog.config.inputBinding.sourceNodeId" class="workflow-token-row">
            <button v-for="opt in getSuggestedPathsForNode(toolConfigDialog.config.inputBinding.sourceNodeId)" :key="opt.path" type="button" class="ghost-btn tiny workflow-token-btn" @click="setValuePath(toolConfigDialog, opt.path, true)">{{ opt.label }}</button>
          </div>
        </template>
        <template v-else-if="toolConfigDialog.config.inputBinding.mode === 'template'">
          <label class="field-label">输入模板</label>
          <textarea v-model="toolConfigDialog.config.inputBinding.template" class="field-input workflow-modal-textarea tool-config-textarea" placeholder="例如：请处理以下内容：&#10;{{input}}"></textarea>
          <div class="workflow-token-row">
            <button v-for="token in workflowTemplateTokenOptions" :key="`tool-input-${token}`" type="button" class="ghost-btn tiny workflow-token-btn" @click="insertToolInputTemplateToken(token)">{{ token }}</button>
          </div>
        </template>
        <div v-else class="meta-row">默认会把所有上游节点输出按顺序汇总后传给当前节点。</div>
        <div v-if="toolConfigDialog.nodeId" class="workflow-input-preview">
          <span class="workflow-input-preview-label">输入预览：</span>
          <span class="workflow-input-preview-value">{{ getInputPreviewForNode(toolConfigDialog.nodeId, toolConfigDialog.config?.inputBinding, true) }}</span>
        </div>

        <div v-if="toolConfigDialog.nodeId && getIncomingSourceNodes(toolConfigDialog.nodeId).length" class="workflow-debug-section">
          <label class="field-label">调试上游</label>
          <div class="workflow-debug-desc">粘贴上游节点的示例输出，可模拟当前节点实际收到的输入。</div>
          <div v-for="s in getIncomingSourceNodes(toolConfigDialog.nodeId)" :key="s.id" class="workflow-debug-row">
            <span class="workflow-debug-label">{{ s.title }}：</span>
            <textarea
              :value="workflowDebugInputs[s.id] || ''"
              @input="setWorkflowDebugInput(s.id, $event.target.value)"
              class="field-input workflow-modal-textarea workflow-debug-textarea"
              placeholder="粘贴 JSON 或文本"
              rows="3"
            ></textarea>
          </div>
          <template v-if="Object.values(workflowDebugInputs).some(Boolean)">
            <div class="workflow-debug-result">
              <span class="workflow-debug-result-label">解析后输入：</span>
              <pre class="workflow-debug-result-value">{{ toolDebugResolvedInput ? (typeof toolDebugResolvedInput.text === 'string' ? toolDebugResolvedInput.text : JSON.stringify(toolDebugResolvedInput.text, null, 2)) : '—' }}</pre>
            </div>
            <template v-if="toolConfigDialog.toolType === 'condition-check' && toolDebugExtras">
              <div class="workflow-debug-extras">
                <span class="workflow-debug-result-label">判断结果：</span>
                <span class="workflow-debug-condition">{{ toolDebugExtras.matched ? '命中' : '未命中' }}（{{ toolDebugExtras.resultText }}）</span>
              </div>
            </template>
            <template v-else-if="toolConfigDialog.toolType === 'json-extract'">
              <div class="workflow-debug-extras">
                <span class="workflow-debug-result-label">提取结果：</span>
                <pre v-if="toolDebugExtras?.extracted !== undefined" class="workflow-debug-result-value">{{ JSON.stringify(toolDebugExtras.extracted, null, 2) }}</pre>
                <span v-else class="workflow-debug-condition">—</span>
              </div>
            </template>
          </template>
        </div>

        <template v-if="toolConfigDialog.toolType === 'http-request'">
          <label class="field-label">请求地址</label>
          <input v-model.trim="toolConfigDialog.config.url" type="text" class="field-input" placeholder="https://example.com/webhook" />
          <label class="field-label">请求方法</label>
          <select v-model="toolConfigDialog.config.method" class="field-input">
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="GET">GET</option>
            <option value="DELETE">DELETE</option>
          </select>
          <label class="field-label">内容类型</label>
          <select v-model="toolConfigDialog.config.contentType" class="field-input">
            <option value="json">JSON</option>
            <option value="text">纯文本</option>
          </select>
          <label class="field-label">请求头 JSON</label>
          <textarea v-model.trim="toolConfigDialog.config.headersText" class="field-input workflow-modal-textarea tool-config-textarea" placeholder='{"Authorization":"Bearer xxx"}'></textarea>
          <label class="field-label">请求体模板</label>
          <textarea v-model.trim="toolConfigDialog.config.bodyTemplate" class="field-input workflow-modal-textarea tool-config-textarea" placeholder='留空时默认发送上游输出；支持 {{input}} {{workflowName}} {{nodeTitle}}'></textarea>
        </template>

        <template v-else-if="toolConfigDialog.toolType === 'json-extract'">
          <label class="field-label">字段路径</label>
          <input v-model.trim="toolConfigDialog.config.path" type="text" class="field-input" placeholder="result.data.content" />
          <div class="workflow-token-row">
            <button type="button" class="ghost-btn tiny workflow-token-btn" @click="setJsonExtractPath('result')">result</button>
            <button type="button" class="ghost-btn tiny workflow-token-btn" @click="setJsonExtractPath('result.data')">result.data</button>
            <button type="button" class="ghost-btn tiny workflow-token-btn" @click="setJsonExtractPath('result.data.content')">result.data.content</button>
          </div>
          <label class="field-label">空值回退</label>
          <input v-model="toolConfigDialog.config.fallbackValue" type="text" class="field-input" placeholder="字段不存在时输出内容" />
        </template>

        <template v-else-if="toolConfigDialog.toolType === 'text-template'">
          <label class="field-label">模板内容</label>
          <textarea v-model.trim="toolConfigDialog.config.template" class="field-input workflow-modal-textarea tool-config-textarea" placeholder='支持 {{input}} {{workflowName}} {{nodeTitle}}'></textarea>
        </template>

        <template v-else-if="toolConfigDialog.toolType === 'field-mapper'">
          <label class="field-label">目标字段名</label>
          <input v-model.trim="toolConfigDialog.config.fieldName" type="text" class="field-input" placeholder="payload" />
          <label class="workflow-checkbox-row">
            <input v-model="toolConfigDialog.config.includeMeta" type="checkbox" />
            <span>输出工作流元信息</span>
          </label>
        </template>

        <template v-else-if="toolConfigDialog.toolType === 'content-merge'">
          <label class="field-label">分隔符</label>
          <input v-model="toolConfigDialog.config.separator" type="text" class="field-input" placeholder="\n\n" />
          <label class="field-label">输出模板</label>
          <textarea v-model.trim="toolConfigDialog.config.template" class="field-input workflow-modal-textarea tool-config-textarea" placeholder='留空时直接拼接；支持 {{input}} {{merged}} {{parents.0.text}}'></textarea>
        </template>

        <template v-else-if="toolConfigDialog.toolType === 'text-replace'">
          <label class="field-label">查找内容</label>
          <input v-model.trim="toolConfigDialog.config.searchValue" type="text" class="field-input" placeholder="请输入要查找的文本或正则" />
          <label class="field-label">替换内容</label>
          <input v-model="toolConfigDialog.config.replaceValue" type="text" class="field-input" placeholder="请输入替换后的内容" />
          <label class="workflow-checkbox-row">
            <input v-model="toolConfigDialog.config.useRegex" type="checkbox" />
            <span>使用正则表达式</span>
          </label>
          <label v-if="toolConfigDialog.config.useRegex" class="field-label">正则 Flags</label>
          <input v-if="toolConfigDialog.config.useRegex" v-model.trim="toolConfigDialog.config.regexFlags" type="text" class="field-input" placeholder="g / gi" />
          <label v-else class="workflow-checkbox-row">
            <input v-model="toolConfigDialog.config.caseSensitive" type="checkbox" />
            <span>区分大小写</span>
          </label>
        </template>

        <template v-else-if="toolConfigDialog.toolType === 'regex-extract'">
          <label class="field-label">正则表达式</label>
          <input v-model.trim="toolConfigDialog.config.pattern" type="text" class="field-input" placeholder="如：订单号[:：]\\s*(\\w+)" />
          <label class="field-label">Flags</label>
          <input v-model.trim="toolConfigDialog.config.flags" type="text" class="field-input" placeholder="g / gi" />
          <label class="field-label">提取分组</label>
          <input v-model.number="toolConfigDialog.config.groupIndex" type="number" min="0" class="field-input" placeholder="0 表示整个匹配" />
          <label class="field-label">匹配序号</label>
          <input v-model.number="toolConfigDialog.config.matchIndex" type="number" class="field-input" placeholder="-1 表示全部输出" />
          <label class="field-label">全部输出分隔符</label>
          <input v-model="toolConfigDialog.config.joinSeparator" type="text" class="field-input" placeholder="\n" />
        </template>

        <template v-else-if="toolConfigDialog.toolType === 'condition-check'">
          <label class="field-label">判断方式</label>
          <select v-model="toolConfigDialog.config.mode" class="field-input">
            <option value="contains">包含</option>
            <option value="equals">等于</option>
            <option value="regex">正则匹配</option>
            <option value="not-empty">非空</option>
          </select>
          <label class="field-label">判断字段路径</label>
          <input v-model.trim="toolConfigDialog.config.subjectPath" type="text" class="field-input" placeholder="如 result.approved；留空表示判断整个输入" />
          <div class="workflow-token-row">
            <button type="button" class="ghost-btn tiny workflow-token-btn" @click="setConditionSubjectPath('')">（整段输入）</button>
            <button type="button" class="ghost-btn tiny workflow-token-btn" @click="setConditionSubjectPath('result')">result</button>
            <button type="button" class="ghost-btn tiny workflow-token-btn" @click="setConditionSubjectPath('result.approved')">result.approved</button>
          </div>
          <label v-if="toolConfigDialog.config.mode !== 'not-empty'" class="field-label">目标值 / 规则</label>
          <input v-if="toolConfigDialog.config.mode !== 'not-empty'" v-model.trim="toolConfigDialog.config.expectedValue" type="text" class="field-input" placeholder="请输入判断目标值" />
          <label v-if="toolConfigDialog.config.mode === 'regex'" class="field-label">正则 Flags</label>
          <input v-if="toolConfigDialog.config.mode === 'regex'" v-model.trim="toolConfigDialog.config.regexFlags" type="text" class="field-input" placeholder="i / gi" />
          <label class="workflow-checkbox-row">
            <input v-model="toolConfigDialog.config.trimInput" type="checkbox" />
            <span>判断前去除首尾空白</span>
          </label>
          <label class="field-label">命中输出文案</label>
          <input v-model="toolConfigDialog.config.trueValue" type="text" class="field-input" placeholder="命中" />
          <label class="field-label">未命中输出文案</label>
          <input v-model="toolConfigDialog.config.falseValue" type="text" class="field-input" placeholder="未命中" />
        </template>

        <template v-else-if="toolConfigDialog.toolType === 'delay'">
          <label class="field-label">等待毫秒</label>
          <input v-model.number="toolConfigDialog.config.delayMs" type="number" min="0" step="100" class="field-input" placeholder="1000" />
        </template>

        <template v-else-if="toolConfigDialog.toolType === 'set-variables'">
          <label class="field-label">输出类型</label>
          <select v-model="toolConfigDialog.config.valueType" class="field-input">
            <option value="text">文本</option>
            <option value="json">JSON</option>
          </select>
          <label class="field-label">输出内容</label>
          <textarea v-model.trim="toolConfigDialog.config.valueText" class="field-input workflow-modal-textarea tool-config-textarea" placeholder="请输入固定输出内容"></textarea>
        </template>
        <template v-else-if="toolConfigDialog.toolType === 'capability-bus' || toolConfigDialog.toolType === 'wps-capability'">
          <label class="field-label">能力 Key</label>
          <select v-model="toolConfigDialog.config.capabilityKey" class="field-input">
            <option value="">请选择能力</option>
            <option
              v-for="item in capabilityBusCatalogOptions.filter(option => toolConfigDialog.toolType !== 'wps-capability' || option.namespace === 'wps')"
              :key="item.key"
              :value="item.key"
            >
              {{ item.key }} | {{ item.label }}
            </option>
          </select>
          <div class="meta-row">
            {{ toolConfigDialog.toolType === 'wps-capability'
              ? '兼容旧版 WPS 能力节点；如需调 utility 等第二类 namespace，请改用“能力总线”节点。'
              : '支持执行 wps.* 与 utility.* 等不同 namespace 的统一能力。' }}
          </div>
          <label class="field-label">参数 JSON</label>
          <textarea
            v-model.trim="toolConfigDialog.config.paramsText"
            class="field-input workflow-modal-textarea tool-config-textarea"
            placeholder='支持模板变量，如 {"text":"{{input}}","searchValue":"甲方","replaceValue":"乙方"}'
          ></textarea>
        </template>
      </div>
      <div class="workflow-modal-actions">
        <button type="button" class="ghost-btn" @click="closeToolConfigDialog">取消</button>
        <button type="button" class="primary-btn" @click="saveToolConfigDialog">保存</button>
      </div>
    </div>
  </div>
  <div
    v-if="assistantConfigDialog.visible"
    class="workflow-modal-mask"
    @click.self="closeAssistantConfigDialog"
  >
    <div class="workflow-modal tool-config-modal" role="dialog" aria-modal="true" aria-label="配置助手节点">
      <div class="workflow-modal-header">
        <div class="workflow-modal-title">配置助手节点</div>
        <button type="button" class="ghost-btn tiny" @click="closeAssistantConfigDialog">取消</button>
      </div>
      <div class="workflow-modal-body">
        <label class="field-label">节点名称</label>
        <input
          v-model.trim="assistantConfigDialog.title"
          type="text"
          class="field-input"
          maxlength="60"
          placeholder="请输入助手节点名称"
        />
        <label class="field-label">输入来源</label>
        <select v-model="assistantConfigDialog.inputBinding.mode" class="field-input">
          <option value="auto">自动汇总上游输出</option>
          <option value="single">选择单个上游字段</option>
          <option value="template">使用模板组装输入</option>
        </select>
        <template v-if="assistantConfigDialog.inputBinding.mode === 'single'">
          <label class="field-label">上游节点</label>
          <select v-model="assistantConfigDialog.inputBinding.sourceNodeId" class="field-input">
            <option value="">请选择上游节点</option>
            <option v-for="item in getIncomingSourceNodes(assistantConfigDialog.nodeId)" :key="item.id" :value="item.id">{{ item.title }}</option>
          </select>
          <label class="field-label">字段路径</label>
          <input v-model.trim="assistantConfigDialog.inputBinding.valuePath" type="text" class="field-input" placeholder="如 result.summary；留空表示使用整个输出" />
          <div v-if="assistantConfigDialog.inputBinding.sourceNodeId" class="workflow-token-row">
            <button v-for="opt in getSuggestedPathsForNode(assistantConfigDialog.inputBinding.sourceNodeId)" :key="opt.path" type="button" class="ghost-btn tiny workflow-token-btn" @click="setValuePath(assistantConfigDialog, opt.path, false)">{{ opt.label }}</button>
          </div>
        </template>
        <template v-else-if="assistantConfigDialog.inputBinding.mode === 'template'">
          <label class="field-label">输入模板</label>
          <textarea v-model="assistantConfigDialog.inputBinding.template" class="field-input workflow-modal-textarea tool-config-textarea" placeholder="例如：请基于以下字段生成结论：&#10;{{parents.0.value.summary}}"></textarea>
          <div class="workflow-token-row">
            <button v-for="token in workflowTemplateTokenOptions" :key="`assistant-input-${token}`" type="button" class="ghost-btn tiny workflow-token-btn" @click="insertAssistantInputTemplateToken(token)">{{ token }}</button>
          </div>
        </template>
        <label class="field-label">输出格式</label>
        <select v-model="assistantConfigDialog.configOverrides.outputFormat" class="field-input">
          <option v-for="opt in assistantOutputFormatOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <label class="field-label">附加系统提示词</label>
        <textarea
          v-model.trim="assistantConfigDialog.configOverrides.systemPrompt"
          class="field-input workflow-modal-textarea"
          placeholder="可补充当前节点的角色、边界、约束或输出要求"
        ></textarea>
        <label class="field-label">用户提示词模板</label>
        <textarea
          v-model.trim="assistantConfigDialog.configOverrides.userPromptTemplate"
          class="field-input workflow-modal-textarea tool-config-textarea"
          placeholder="默认使用 {{input}}，也可改成更稳定的节点级提示词模板"
        ></textarea>
        <div class="workflow-token-row">
          <button v-for="token in workflowTemplateTokenOptions" :key="`assistant-prompt-${token}`" type="button" class="ghost-btn tiny workflow-token-btn" @click="insertAssistantPromptTemplateToken(token)">{{ token }}</button>
        </div>
        <template v-if="assistantConfigDialog.configOverrides.outputFormat === 'json'">
          <label class="field-label">JSON 结构约束</label>
          <textarea
            v-model.trim="assistantConfigDialog.configOverrides.workflowJsonSchemaText"
            class="field-input workflow-modal-textarea tool-config-textarea"
            placeholder='可填写期望字段结构，例如：{"result":"","reason":"","confidence":0}'
          ></textarea>
          <div class="workflow-token-row">
            <button type="button" class="ghost-btn tiny workflow-token-btn" @click="insertAssistantSchemaSnippet">插入示例结构</button>
          </div>
          <div class="meta-row">建议为后续要被条件判断或字段提取使用的助手节点开启 JSON 输出，并约束固定字段名。</div>
        </template>
        <div v-if="assistantConfigDialog.nodeId" class="workflow-input-preview">
          <span class="workflow-input-preview-label">输入预览：</span>
          <span class="workflow-input-preview-value">{{ getInputPreviewForNode(assistantConfigDialog.nodeId, assistantConfigDialog.inputBinding, false) }}</span>
        </div>

        <div v-if="assistantConfigDialog.nodeId && getIncomingSourceNodes(assistantConfigDialog.nodeId).length" class="workflow-debug-section">
          <label class="field-label">调试上游</label>
          <div class="workflow-debug-desc">粘贴上游节点的示例输出，可模拟当前节点实际收到的输入。</div>
          <div v-for="s in getIncomingSourceNodes(assistantConfigDialog.nodeId)" :key="s.id" class="workflow-debug-row">
            <span class="workflow-debug-label">{{ s.title }}：</span>
            <textarea
              :value="workflowDebugInputs[s.id] || ''"
              @input="setWorkflowDebugInput(s.id, $event.target.value)"
              class="field-input workflow-modal-textarea workflow-debug-textarea"
              placeholder="粘贴 JSON 或文本"
              rows="3"
            ></textarea>
          </div>
          <template v-if="Object.values(workflowDebugInputs).some(Boolean)">
            <div class="workflow-debug-result">
              <span class="workflow-debug-result-label">解析后输入：</span>
              <pre class="workflow-debug-result-value">{{ assistantDebugResolvedInput ? (typeof assistantDebugResolvedInput.text === 'string' ? assistantDebugResolvedInput.text : JSON.stringify(assistantDebugResolvedInput.text, null, 2)) : '—' }}</pre>
            </div>
          </template>
        </div>

        <div class="meta-row">最佳实践：上游若输出 JSON，可在这里选择具体字段；需要稳定格式时，建议先接“JSON 提取”或“数据映射”节点后再交给助手。</div>
      </div>
      <div class="workflow-modal-actions">
        <button type="button" class="ghost-btn" @click="closeAssistantConfigDialog">取消</button>
        <button type="button" class="primary-btn" @click="saveAssistantConfigDialog">保存</button>
      </div>
    </div>
  </div>
  <div
    v-if="edgeConfigDialog.visible"
    class="workflow-modal-mask"
    @click.self="closeEdgeConfigDialog"
  >
    <div class="workflow-modal edge-config-modal" role="dialog" aria-modal="true" aria-label="配置分支条件">
      <div class="workflow-modal-header">
        <div class="workflow-modal-title">配置分支条件</div>
        <button type="button" class="ghost-btn tiny" @click="closeEdgeConfigDialog">取消</button>
      </div>
      <div class="workflow-modal-body">
        <label class="field-label">执行条件</label>
        <select v-model="edgeConfigDialog.condition" class="field-input">
          <option value="always">始终执行</option>
          <option value="true">条件命中时执行</option>
          <option value="false">条件未命中时执行</option>
        </select>
        <div class="meta-row">如果这条连线来自“条件判断”节点，就可以用这里控制 true / false 分支。</div>
        <div class="meta-row workflow-edge-hint">传递内容：上游节点的输出（文本或结构化数据）将传递给下游节点，下游可配置选择具体字段。</div>
      </div>
      <div class="workflow-modal-actions">
        <button type="button" class="ghost-btn" @click="closeEdgeConfigDialog">取消</button>
        <button type="button" class="primary-btn" @click="saveEdgeConfigDialog">保存</button>
      </div>
    </div>
  </div>
  <div
    v-if="importConflictDialog.visible"
    class="workflow-modal-mask"
    @click.self="closeImportConflictDialog"
  >
    <div class="workflow-modal import-conflict-modal" role="dialog" aria-modal="true" aria-label="助手重名处理">
      <div class="workflow-modal-header">
        <div class="workflow-modal-title">{{ importConflictDialog.duplicates.length > 0 ? '检测到助手重名' : '导入工作流' }}</div>
        <button type="button" class="ghost-btn tiny" @click="closeImportConflictDialog">取消</button>
      </div>
      <div class="workflow-modal-body">
        <div class="import-conflict-desc">
          {{ importConflictDialog.duplicates.length > 0 ? '导入包中的以下助手名称与当前系统重复，请选择导入策略。' : '即将导入以下内容，请确认后继续。' }}
        </div>
        <div class="import-bundle-meta">
          <span v-if="importDialogMeta.packageName">包名：{{ importDialogMeta.packageName }}</span>
          <span v-if="importDialogMeta.packageDescription">说明：{{ importDialogMeta.packageDescription }}</span>
          <span>来源：{{ importDialogMeta.exportedFrom }}</span>
          <span v-if="importDialogMeta.exportedAt">导出时间：{{ importDialogMeta.exportedAt.replace('T', ' ').slice(0, 19) }}</span>
        </div>
        <div class="import-summary-grid">
          <div class="import-summary-card">
            <span class="import-summary-value">{{ importDialogSummary.workflows }}</span>
            <span class="import-summary-label">工作流</span>
          </div>
          <div class="import-summary-card">
            <span class="import-summary-value">{{ importDialogSummary.customAssistants }}</span>
            <span class="import-summary-label">自定义助手</span>
          </div>
          <div class="import-summary-card">
            <span class="import-summary-value">{{ importDialogSummary.builtinAssistants }}</span>
            <span class="import-summary-label">系统助手配置</span>
          </div>
        </div>
        <div v-if="importConflictDialog.duplicates.length > 0" class="import-conflict-list">
          <div
            v-for="item in importConflictDialog.duplicates"
            :key="`${item.name}-${item.targetSource}`"
            class="import-conflict-item"
          >
            <span class="import-conflict-name">{{ item.name }}</span>
            <span class="import-conflict-target">当前存在于：{{ item.targetSource }}</span>
          </div>
        </div>
        <div class="import-conflict-hint">
          {{
            importConflictDialog.duplicates.length > 0
              ? '“覆盖”会优先覆盖同名自定义助手；“新增”会自动重命名后导入；“保留本系统助手”会跳过导入同名助手，并让工作流继续引用当前系统中的助手。'
              : '如果导入包里包含系统助手配置，也会一并导入。'
          }}
        </div>
      </div>
      <div v-if="importConflictDialog.duplicates.length > 0" class="workflow-modal-actions import-conflict-actions">
        <button type="button" class="ghost-btn" @click="applyImportConflictStrategy('keep')">保留本系统助手</button>
        <button type="button" class="ghost-btn" @click="applyImportConflictStrategy('new')">新增并重命名</button>
        <button type="button" class="primary-btn" @click="applyImportConflictStrategy('overwrite')">覆盖</button>
      </div>
      <div v-else class="workflow-modal-actions">
        <button type="button" class="ghost-btn" @click="closeImportConflictDialog">取消</button>
        <button type="button" class="primary-btn" @click="applyImportConflictStrategy('new')">确认导入</button>
      </div>
    </div>
  </div>
  <div
    v-if="importResultDialog.visible"
    class="workflow-modal-mask"
    @click.self="closeImportResultDialog"
  >
    <div class="workflow-modal import-result-modal" role="dialog" aria-modal="true" aria-label="导入结果">
      <div class="workflow-modal-header">
        <div class="workflow-modal-title">导入完成</div>
        <button type="button" class="ghost-btn tiny" @click="closeImportResultDialog">关闭</button>
      </div>
      <div class="workflow-modal-body">
        <div class="import-summary-grid">
          <div class="import-summary-card">
            <span class="import-summary-value">{{ importResultDialog.summary?.workflows?.length || 0 }}</span>
            <span class="import-summary-label">工作流</span>
          </div>
          <div class="import-summary-card">
            <span class="import-summary-value">{{ importResultDialog.summary?.importedCustomCount || 0 }}</span>
            <span class="import-summary-label">新增助手</span>
          </div>
          <div class="import-summary-card">
            <span class="import-summary-value">{{ importResultDialog.summary?.importedBuiltinCount || 0 }}</span>
            <span class="import-summary-label">更新系统配置</span>
          </div>
        </div>
        <div class="import-result-section">
          <div class="import-result-title">工作流</div>
          <div class="import-result-list">
            <div
              v-for="name in importResultDialog.summary?.workflows || []"
              :key="`workflow-${name}`"
              class="import-result-item"
            >{{ name }}</div>
          </div>
        </div>
        <div v-if="(importResultDialog.summary?.renamedAssistants || []).length > 0" class="import-result-section">
          <div class="import-result-title">自动重命名助手</div>
          <div class="import-result-list">
            <div
              v-for="name in importResultDialog.summary?.renamedAssistants || []"
              :key="`renamed-${name}`"
              class="import-result-item"
            >{{ name }}</div>
          </div>
        </div>
        <div v-if="(importResultDialog.summary?.overwrittenAssistants || []).length > 0" class="import-result-section">
          <div class="import-result-title">已覆盖助手</div>
          <div class="import-result-list">
            <div
              v-for="name in importResultDialog.summary?.overwrittenAssistants || []"
              :key="`overwritten-${name}`"
              class="import-result-item"
            >{{ name }}</div>
          </div>
        </div>
        <div v-if="(importResultDialog.summary?.reusedAssistants || []).length > 0" class="import-result-section">
          <div class="import-result-title">复用现有助手</div>
          <div class="import-result-list">
            <div
              v-for="name in importResultDialog.summary?.reusedAssistants || []"
              :key="`reused-${name}`"
              class="import-result-item"
            >{{ name }}</div>
          </div>
        </div>
      </div>
      <div class="workflow-modal-actions import-result-actions">
        <button
          type="button"
          class="ghost-btn"
          :disabled="!importResultDialog.summary?.firstWorkflowId"
          @click="openImportedFirstWorkflow"
        >打开首个工作流</button>
        <button type="button" class="primary-btn" @click="closeImportResultDialog">我知道了</button>
      </div>
    </div>
  </div>
  <div
    v-if="debugStartDialog.visible"
    class="workflow-modal-mask"
    @click.self="closeDebugStartDialog"
  >
    <div class="workflow-modal" role="dialog" aria-modal="true" aria-label="从节点开始调试">
      <div class="workflow-modal-header">
        <div class="workflow-modal-title">从节点开始调试</div>
        <button type="button" class="ghost-btn tiny" @click="closeDebugStartDialog">取消</button>
      </div>
      <div class="workflow-modal-body">
        <div class="meta-row">起点节点：{{ debugStartDialog.nodeTitle || '未命名节点' }}</div>
        <label class="field-label">起始输入</label>
        <textarea
          v-model="debugStartDialog.inputText"
          class="field-input workflow-modal-textarea"
          placeholder="可粘贴文本或 JSON，作为该节点的调试输入"
        ></textarea>
        <div class="meta-row">适合验证某个节点后的下游链路，不必每次都从开始节点重跑。</div>
      </div>
      <div class="workflow-modal-actions">
        <button type="button" class="ghost-btn" @click="closeDebugStartDialog">取消</button>
        <button type="button" class="primary-btn" @click="confirmDebugStartFromNode">开始调试</button>
      </div>
    </div>
  </div>
  <div
    v-if="pathAnalysisDialog.visible"
    class="workflow-modal-mask"
    @click.self="pathAnalysisDialog.visible = false"
  >
    <div class="workflow-modal path-analysis-modal" role="dialog" aria-modal="true" aria-label="路径模拟分析">
      <div class="workflow-modal-header">
        <div class="workflow-modal-title">路径模拟分析</div>
        <button type="button" class="ghost-btn tiny" @click="pathAnalysisDialog.visible = false">关闭</button>
      </div>
      <div class="workflow-modal-body">
        <template v-if="pathAnalysisDialog.result?.valid === false">
          <div class="path-analysis-error">{{ pathAnalysisDialog.result.validationError }}</div>
        </template>
        <template v-else-if="pathAnalysisDialog.result">
          <div class="path-analysis-summary">
            <div class="path-analysis-stat">
              <span class="path-analysis-stat-value">{{ pathAnalysisDialog.result.summary?.totalPaths ?? 0 }}</span>
              <span class="path-analysis-stat-label">总路径数</span>
            </div>
            <div class="path-analysis-stat">
              <span class="path-analysis-stat-value">{{ pathAnalysisDialog.result.summary?.pathsToEnd ?? 0 }}</span>
              <span class="path-analysis-stat-label">可达结束</span>
            </div>
            <div class="path-analysis-verdict" :class="pathAnalysisDialog.result.summary?.allPathsReachEnd ? 'ok' : 'warn'">
              {{ pathAnalysisDialog.result.summary?.allPathsReachEnd ? '✓ 所有路径均可走通' : '⚠ 存在无法到达结束的路径' }}
            </div>
          </div>
          <div class="path-analysis-list">
            <div
              v-for="(path, idx) in pathAnalysisDialog.result.paths"
              :key="path.id"
              class="path-analysis-item"
              :class="{ 'path-dead': !path.reachesEnd }"
            >
              <div class="path-analysis-item-header">
                <span class="path-analysis-item-badge">{{ path.reachesEnd ? '✓' : '✗' }}</span>
                <span class="path-analysis-item-title">路径 {{ idx + 1 }}</span>
                <span v-if="!path.reachesEnd && path.deadEndReason" class="path-analysis-item-reason">{{ path.deadEndReason }}</span>
              </div>
              <div class="path-analysis-item-nodes">
                {{ (path.nodeTitles || []).join(' → ') || '（无）' }}
              </div>
              <div v-if="(path.branchDecisions || []).length" class="path-analysis-item-branches">
                <span v-for="(b, i) in path.branchDecisions" :key="i" class="path-branch-tag">{{ b.nodeTitle }}: {{ b.condition }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
      <div class="workflow-modal-actions">
        <button type="button" class="primary-btn" @click="pathAnalysisDialog.visible = false">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { NodeResizer } from '@vue-flow/node-resizer'
import { Handle, MarkerType, Position, VueFlow, useVueFlow } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/minimap/dist/style.css'
import '@vue-flow/node-resizer/dist/style.css'
import {
  END_NODE_ID,
  START_NODE_ID,
  createEndNode,
  createStartNode,
  createWorkflowDraft,
  deleteWorkflow,
  getWorkflowEligibleAssistants,
  normalizeWorkflow,
  rebuildEdgeOrder,
  saveWorkflow,
  saveWorkflows,
  subscribeWorkflows
} from '../utils/workflowStore.js'
import {
  buildCustomAssistantId,
  createCustomAssistantDraft,
  getAssistantSetting,
  getCustomAssistants,
  loadAssistantSettings,
  saveAssistantSettings,
  saveCustomAssistants
} from '../utils/assistantSettings.js'
import { getBuiltinAssistants, getBuiltinAssistantDefinition, OUTPUT_FORMAT_OPTIONS } from '../utils/assistantRegistry.js'
import { getTaskById, getTasks, subscribe as subscribeTasks } from '../utils/taskListStore.js'
import {
  analyzeWorkflowPaths,
  resumeWorkflowDebug,
  setWorkflowDebugInputOverride,
  setWorkflowRunBreakpoints,
  startWorkflowRun,
  stopWorkflowRun,
  validateWorkflow
} from '../utils/workflowRunner.js'
import {
  createWorkflowToolPayload,
  getWorkflowToolByType,
  getWorkflowTools,
  normalizeWorkflowInputBinding,
  normalizeWorkflowToolData,
  resolveWorkflowNodeInput,
  simulateConditionCheck,
  simulateJsonExtract
} from '../utils/workflowTools.js'
import { getCapabilityBusCatalog } from '../utils/capabilityBus.js'
import { isAssistantImageIcon, normalizeAssistantIcon } from '../utils/assistantIcons.js'
import { createTaskOrchestrationWindowSession } from '../utils/taskOrchestrationWindowManager.js'
import { DEFAULT_TASK_LIST_WINDOW_HEIGHT, DEFAULT_TASK_LIST_WINDOW_WIDTH } from '../utils/taskListWindowManager.js'

const workflowMime = 'application/x-chayuan-workflow-assistant'
const workflowBundleType = 'chayuan-workflow-bundle'
const workflowBundleVersion = 1

const workflows = ref([])
const openWorkflowIds = ref([])
const activeWorkflowId = ref('')
const workflowName = ref('')
const workflowDescription = ref('')
const nodes = ref([])
const edges = ref([])
const paletteKeyword = ref('')
const paletteTab = ref('tool')
const paletteCollapsedGroups = ref({
  tool: {},
  assistant: {}
})
const workflowKeyword = ref('')
const selectedWorkflowIds = ref([])
const selectedEdgeId = ref('')
const editingNodeId = ref('')
const editingNodeTitle = ref('')
const leftCollapsed = ref(false)
const rightCollapsed = ref(false)
const leftPanelWidth = ref(260)
const rightPanelWidth = ref(320)
const validationMessage = ref('')
const saveMessage = ref('')
const isStarting = ref(false)
const startingWorkflowId = ref('')
const showMiniMap = ref(true)
const canvasWrapper = ref(null)
const createWorkflowNameInput = ref(null)
const workflowImportInput = ref(null)
const pendingDraggedAssistant = ref(null)
const suppressPaletteClickUntil = ref(0)
const createWorkflowDialogVisible = ref(false)
const workflowDialogMode = ref('create')
const newWorkflowName = ref('')
const newWorkflowDescription = ref('')
const createWorkflowError = ref('')
const assistantStoreVersion = ref(0)
const exportDialog = ref({
  visible: false,
  scope: 'selected',
  packageName: '',
  packageDescription: ''
})
const importConflictDialog = ref({
  visible: false,
  duplicates: [],
  bundle: null
})
const importResultDialog = ref({
  visible: false,
  summary: null
})
const workflowTasks = ref(getTasks())
const activeRunTaskId = ref('')
const activeDebugTaskId = ref('')
const taskOrchestrationWindowSession = ref(null)
const debugPanelCollapsed = ref(true)
const debugInputEditorText = ref('')
const pathAnalysisDialog = ref({
  visible: false,
  result: null
})
const debugStartDialog = ref({
  visible: false,
  nodeId: '',
  nodeTitle: '',
  inputText: ''
})
const tabContextMenu = ref({
  visible: false,
  workflowId: '',
  x: 0,
  y: 0
})
const nodeContextMenu = ref({
  visible: false,
  nodeId: '',
  canCopy: false,
  canConfigure: false,
  canDelete: false,
  canBreakpoint: false,
  isBreakpoint: false,
  canDebugFromHere: false,
  x: 0,
  y: 0
})
const edgeContextMenu = ref({
  visible: false,
  edgeId: '',
  x: 0,
  y: 0
})
const customDrag = ref({
  active: false,
  payload: null,
  x: 0,
  y: 0,
  overCanvas: false,
  moved: false
})
const toolConfigDialog = ref({
  visible: false,
  nodeId: '',
  toolType: '',
  title: '',
  description: '',
  config: {}
})
const assistantConfigDialog = ref({
  visible: false,
  nodeId: '',
  assistantId: '',
  title: '',
  inputBinding: normalizeWorkflowInputBinding(),
  configOverrides: {
    systemPrompt: '',
    userPromptTemplate: '{{input}}',
    outputFormat: 'markdown',
    workflowJsonSchemaText: ''
  }
})
const workflowDebugInputs = ref({})
const edgeConfigDialog = ref({
  visible: false,
  edgeId: '',
  condition: 'always'
})
let handleViewportResize = null
let handleGlobalClick = null
let handleGlobalKeydown = null
let customDragMoveHandler = null
let customDragUpHandler = null
let panelResizeMoveHandler = null
let panelResizeUpHandler = null
let unsubscribe = null
let unsubscribeTasks = null

const { fitView, screenToFlowCoordinate, setCenter } = useVueFlow()

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function closeWindow() {
  try {
    if (window.close) window.close()
  } catch (_) {}
}

function formatDebugValue(value) {
  if (value == null || value === '') return '—'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch (_) {
    return String(value)
  }
}

function formatJsonForDebug(value) {
  if (value == null || value === '') return '—'
  if (typeof value === 'string') return value
  try {
    const json = JSON.stringify(value, null, 2)
    return json.length > 8000 ? json.slice(0, 8000) + '\n\n… (已截断)' : json
  } catch (_) {
    return String(value)
  }
}

async function copyText(text, successMessage = '已复制') {
  const content = String(text || '')
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(content)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = content
      textarea.setAttribute('readonly', 'readonly')
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    saveMessage.value = successMessage
    validationMessage.value = ''
  } catch (error) {
    validationMessage.value = error?.message || '复制失败'
  }
}

function normalizeNodeSize(value) {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? Math.round(num) : null
}

function getNodeSize(node, key) {
  const direct = normalizeNodeSize(node?.[key])
  if (direct) return direct
  const dimension = normalizeNodeSize(node?.dimensions?.[key])
  if (dimension) return dimension
  const styleValue = normalizeNodeSize(String(node?.style?.[key] || '').replace(/px$/i, ''))
  return styleValue
}

function buildNodeStyle(node) {
  const width = getNodeSize(node, 'width')
  const height = getNodeSize(node, 'height')
  if (!width && !height) return undefined
  return {
    ...(width ? { width: `${width}px` } : {}),
    ...(height ? { height: `${height}px` } : {})
  }
}

function getImageSrc(icon) {
  if (!icon) return ''
  const base = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : ''
  return (base + icon).replace(/\/+/g, '/')
}

function isNodeImageIcon(icon) {
  return isAssistantImageIcon(icon)
}

function getNodeIconSrc(icon) {
  const normalized = normalizeAssistantIcon(icon || '')
  if (/^data:image\//i.test(normalized)) return normalized
  return getImageSrc(normalized)
}

function createCanvasNodeId(prefix = 'node') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function getDefaultNodeSize(node) {
  const kind = node?.data?.kind || (node?.id === START_NODE_ID ? 'start' : node?.id === END_NODE_ID ? 'end' : 'assistant')
  if (kind === 'start' || kind === 'end') {
    return { width: 74, height: 36 }
  }
  if (kind === 'tool') {
    return { width: 150, height: 72 }
  }
  return { width: 96, height: 32 }
}

const eligibleAssistants = computed(() => {
  assistantStoreVersion.value
  return getWorkflowEligibleAssistants()
})

const workflowTools = computed(() => getWorkflowTools())
const capabilityBusCatalogOptions = computed(() => {
  return getCapabilityBusCatalog()
    .map(item => ({
      key: item.namespace ? `${item.namespace}.${item.key}` : item.key,
      namespace: item.namespace || 'wps',
      label: item.label,
      description: item.description,
      category: item.category
    }))
    .sort((a, b) => a.key.localeCompare(b.key, 'zh-Hans-CN'))
})

const groupedTools = computed(() => {
  const keyword = paletteKeyword.value.toLowerCase()
  const groups = new Map()
  workflowTools.value.forEach(item => {
    if (keyword) {
      const haystack = `${item.title} ${item.description} ${item.groupLabel}`.toLowerCase()
      if (!haystack.includes(keyword)) return
    }
    const key = item.groupLabel || '其他工具'
    const list = groups.get(key) || []
    list.push(item)
    groups.set(key, list)
  })
  return [...groups.entries()].map(([label, items]) => ({ label, items }))
})

const groupedAssistants = computed(() => {
  const keyword = paletteKeyword.value.toLowerCase()
  const groups = new Map()
  eligibleAssistants.value.forEach(item => {
    if (keyword) {
      const haystack = `${item.title} ${item.description} ${item.groupLabel}`.toLowerCase()
      if (!haystack.includes(keyword)) return
    }
    const key = item.groupLabel || '其他助手'
    const list = groups.get(key) || []
    list.push(item)
    groups.set(key, list)
  })
  return [...groups.entries()].map(([label, items]) => ({ label, items }))
})
const activePaletteGroups = computed(() => {
  const groups = paletteTab.value === 'tool' ? groupedTools.value : groupedAssistants.value
  const collapsedMap = paletteCollapsedGroups.value[paletteTab.value] || {}
  const hasKeyword = Boolean(paletteKeyword.value.trim())
  return groups.map(group => ({
    ...group,
    collapsed: hasKeyword ? false : Boolean(collapsedMap[group.label])
  }))
})
const paletteSearchPlaceholder = computed(() => (paletteTab.value === 'tool' ? '搜索工具' : '搜索助手'))

function getNodeById(nodeId) {
  return nodes.value.find(item => item.id === nodeId) || null
}

function getIncomingSourceNodes(nodeId) {
  if (!nodeId) return []
  const incomingEdges = edges.value.filter(edge => edge.target === nodeId)
  return incomingEdges
    .map(edge => getNodeById(edge.source))
    .filter(node => node && node.id !== START_NODE_ID)
    .map(node => ({
      id: node.id,
      title: node.data?.title || node.label || node.id,
      kind: node.data?.kind || 'assistant'
    }))
}

function getInputBindingSummary(inputBinding, nodeId) {
  const normalized = normalizeWorkflowInputBinding(inputBinding)
  if (normalized.mode === 'template') return '模板输入'
  if (normalized.mode === 'single') {
    const sourceNode = getNodeById(normalized.sourceNodeId)
    const sourceTitle = sourceNode?.data?.title || sourceNode?.label || normalized.sourceNodeId || '指定节点'
    return normalized.valuePath ? `输入: ${sourceTitle}.${normalized.valuePath}` : `输入: ${sourceTitle}`
  }
  const sourceCount = getIncomingSourceNodes(nodeId).length
  return sourceCount > 1 ? `输入: 自动汇总 ${sourceCount} 路上游` : '输入: 自动使用上游'
}

function getToolOutputHint(toolType) {
  const type = String(toolType || '').trim()
  if (type === 'condition-check') return '输出: matched / input / resultText'
  if (type === 'json-extract') return '输出: 选中字段值'
  if (type === 'field-mapper') return '输出: 包装后的对象'
  if (type === 'http-request') return '输出: 接口响应'
  if (type === 'set-variables') return '输出: 固定文本或 JSON'
  return '输出: 当前节点结果'
}

const assistantOutputFormatOptions = OUTPUT_FORMAT_OPTIONS

const workflowTemplateTokenOptions = [
  '{{input}}',
  '{{workflow.name}}',
  '{{node.title}}',
  '{{parents.0.text}}',
  '{{parents.0.value}}'
]

function appendText(targetRef, path, token, suffix = '') {
  if (!targetRef?.value) return
  const segments = String(path || '').split('.').filter(Boolean)
  if (!segments.length) return
  let cursor = targetRef.value
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i]
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {}
    cursor = cursor[key]
  }
  const lastKey = segments[segments.length - 1]
  const current = String(cursor[lastKey] || '')
  cursor[lastKey] = `${current}${current ? suffix : ''}${token}`
}

function insertToolInputTemplateToken(token) {
  appendText(toolConfigDialog, 'config.inputBinding.template', token, '\n')
}

function insertAssistantInputTemplateToken(token) {
  appendText(assistantConfigDialog, 'inputBinding.template', token, '\n')
}

function insertAssistantPromptTemplateToken(token) {
  appendText(assistantConfigDialog, 'configOverrides.userPromptTemplate', token, '\n')
}

function insertAssistantSchemaSnippet() {
  const snippet = '{\n  "result": "",\n  "reason": "",\n  "confidence": 0\n}'
  appendText(assistantConfigDialog, 'configOverrides.workflowJsonSchemaText', snippet, '\n')
}

function getAssistantOutputHint(configOverrides = {}) {
  const format = String(configOverrides?.outputFormat || 'markdown').trim().toLowerCase()
  if (format === 'json') return '输出: JSON 结构'
  if (format === 'bullet-list') return '输出: 列表项'
  if (format === 'plain') return '输出: 纯文本'
  return '输出: Markdown'
}

function getSuggestedPathsForNode(nodeId) {
  const node = getNodeById(nodeId)
  if (!node) return []
  const kind = node.data?.kind || 'assistant'
  const toolType = String(node.data?.toolType || '').trim()
  if (kind === 'tool') {
    if (toolType === 'condition-check') return [{ path: '', label: '（完整输出）' }, { path: 'matched', label: 'matched' }, { path: 'input', label: 'input' }, { path: 'resultText', label: 'resultText' }]
    if (toolType === 'json-extract') return [{ path: '', label: '（完整输出）' }]
    if (toolType === 'field-mapper') {
      const field = String(node.data?.config?.fieldName || 'payload').trim() || 'payload'
      return [{ path: '', label: '（完整输出）' }, { path: field, label: field }, { path: '_meta', label: '_meta' }]
    }
    if (toolType === 'http-request') return [{ path: '', label: '（完整响应）' }]
    if (toolType === 'set-variables') return [{ path: '', label: '（完整输出）' }]
    return [{ path: '', label: '（完整输出）' }]
  }
  const schema = String(node.data?.configOverrides?.workflowJsonSchemaText || '').trim()
  const keys = []
  if (schema) {
    try {
      const parsed = JSON.parse(schema)
      if (parsed && typeof parsed === 'object') {
        Object.keys(parsed).forEach(k => keys.push({ path: k, label: k }))
      }
    } catch (_) {}
  }
  if (keys.length) return [{ path: '', label: '（完整输出）' }, ...keys]
  return [{ path: '', label: '（完整输出）' }, { path: 'result', label: 'result' }, { path: 'data', label: 'data' }, { path: 'content', label: 'content' }]
}

function setValuePath(target, path, isTool) {
  if (isTool) {
    toolConfigDialog.value.config = toolConfigDialog.value.config || {}
    toolConfigDialog.value.config.inputBinding = toolConfigDialog.value.config.inputBinding || {}
    toolConfigDialog.value.config.inputBinding.valuePath = path
  } else {
    assistantConfigDialog.value.inputBinding = assistantConfigDialog.value.inputBinding || {}
    assistantConfigDialog.value.inputBinding.valuePath = path
  }
}

function setJsonExtractPath(path) {
  toolConfigDialog.value.config = toolConfigDialog.value.config || {}
  toolConfigDialog.value.config.path = path
}

function setConditionSubjectPath(path) {
  toolConfigDialog.value.config = toolConfigDialog.value.config || {}
  toolConfigDialog.value.config.subjectPath = path
}

function getInputPreviewForNode(nodeId, binding, isTool) {
  const normalized = normalizeWorkflowInputBinding(binding)
  const sources = getIncomingSourceNodes(nodeId)
  if (normalized.mode === 'template') {
    const vars = { input: '（上游汇总输出）', 'workflow.name': '（工作流名）', 'node.title': '（当前节点）' }
    sources.forEach((s, i) => { vars[`parents.${i}.text`] = `（${s.title} 输出）`; vars[`parents.${i}.value`] = `（${s.title} 结构化）` })
    return (normalized.template || '{{input}}').replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
  }
  if (normalized.mode === 'single') {
    const src = getNodeById(normalized.sourceNodeId)
    const name = src?.data?.title || src?.label || normalized.sourceNodeId || '指定节点'
    return normalized.valuePath ? `来自 ${name} 的 ${normalized.valuePath}` : `来自 ${name} 的完整输出`
  }
  return sources.length > 1 ? `自动汇总 ${sources.length} 个上游输出` : (sources[0] ? `来自 ${sources[0].title}` : '无上游')
}

function setWorkflowDebugInput(nodeId, val) {
  workflowDebugInputs.value = { ...workflowDebugInputs.value, [nodeId]: val }
}

function buildParentOutputsFromDebug(nodeId) {
  const sources = getIncomingSourceNodes(nodeId)
  return sources.map(s => {
    const raw = String(workflowDebugInputs.value[s.id] || '').trim()
    let value = raw
    let text = raw
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        value = parsed
        text = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)
      } catch (_) {
        value = raw
      }
    }
    return { nodeId: s.id, nodeTitle: s.title, text, value }
  })
}

function getDebugResolvedInput(nodeId, inputBinding, isTool) {
  const sources = getIncomingSourceNodes(nodeId)
  if (!sources.length) return null
  const parentOutputs = buildParentOutputsFromDebug(nodeId)
  const defaultInputText = parentOutputs.map(p => p.text).filter(Boolean).join('\n\n')
  const node = getNodeById(nodeId)
  const workflow = workflows.value.find(w => w.id === activeWorkflowId.value) || {}
  const ctx = {
    workflow,
    node,
    parentOutputs,
    defaultInputText,
    inputBinding,
    nodeResults: {}
  }
  return resolveWorkflowNodeInput(node, ctx)
}

function getDebugToolExtras(nodeId, toolType, resolvedInput, configOverride) {
  if (!resolvedInput) return null
  const node = getNodeById(nodeId)
  if (!node) return null
  const virtualNode = configOverride ? { ...node, data: { ...node.data, config: configOverride } } : node
  const ctx = { inputText: resolvedInput.text, inputValue: resolvedInput.value }
  if (toolType === 'condition-check') {
    return simulateConditionCheck(virtualNode, ctx)
  }
  if (toolType === 'json-extract') {
    const extracted = simulateJsonExtract(virtualNode, ctx)
    return extracted !== null ? { extracted } : null
  }
  return null
}

const toolDebugResolvedInput = computed(() => {
  if (!toolConfigDialog.value.nodeId) return null
  return getDebugResolvedInput(toolConfigDialog.value.nodeId, toolConfigDialog.value.config?.inputBinding, true)
})

const toolDebugExtras = computed(() => {
  const r = toolDebugResolvedInput.value
  if (!r || !toolConfigDialog.value.nodeId) return null
  return getDebugToolExtras(toolConfigDialog.value.nodeId, toolConfigDialog.value.toolType, r, toolConfigDialog.value.config)
})

const assistantDebugResolvedInput = computed(() => {
  if (!assistantConfigDialog.value.nodeId) return null
  return getDebugResolvedInput(assistantConfigDialog.value.nodeId, assistantConfigDialog.value.inputBinding, false)
})

const breakpointNodeIds = computed(() => nodes.value
  .filter(node => node.id !== START_NODE_ID && node.id !== END_NODE_ID && node?.data?.breakpoint === true)
  .map(node => node.id))

const activeWorkflowRunTask = computed(() => {
  const taskId = String(activeRunTaskId.value || '').trim()
  if (!taskId || !activeWorkflowId.value) return null
  const task = workflowTasks.value.find(item => item.id === taskId)
  if (!task) return null
  if ((task?.type !== 'workflow' && task?.data?.kind !== 'workflow') || task?.data?.workflowId !== activeWorkflowId.value) {
    return null
  }
  return task
})

const activeWorkflowDebugTask = computed(() => {
  const task = activeWorkflowRunTask.value
  if (!task?.data?.debugState?.enabled) return null
  const debugTaskId = String(activeDebugTaskId.value || '').trim()
  return !debugTaskId || debugTaskId === task.id ? task : null
})

const activeWorkflowDebugState = computed(() => activeWorkflowDebugTask.value?.data?.debugState || null)

const activeWorkflowRunNodeId = computed(() => {
  if (activeWorkflowDebugState.value?.waitingNodeId) return activeWorkflowDebugState.value.waitingNodeId
  return String(activeWorkflowRunTask.value?.data?.currentNodeId || '').trim()
})

const activeWorkflowDebugNodeId = computed(() => activeWorkflowRunNodeId.value)

const activeWorkflowDebugNodeRun = computed(() => {
  const task = activeWorkflowRunTask.value
  const nodeId = activeWorkflowDebugNodeId.value
  if (!task || !nodeId) return null
  return (task?.data?.nodeRuns || []).find(item => item.nodeId === nodeId) || null
})

const activeWorkflowDebugVariables = computed(() => {
  const state = activeWorkflowDebugState.value
  if (!state) return []
  return [
    { key: 'input.text', label: '输入文本', type: 'string', value: state.inputPreview || '' },
    { key: 'input.value', label: '输入结构值', type: state.inputValueType || 'empty', value: state.inputValue },
    { key: 'output.last', label: '最近输出结构值', type: state.lastOutputValueType || 'empty', value: state.lastOutputValue },
    { key: 'debug.reason', label: '暂停原因', type: 'string', value: state.waitingReason || '' }
  ]
})

const shouldShowDebugPanel = computed(() => Boolean(activeWorkflowId.value && activeWorkflowDebugTask.value))
const hasStructuredInputValue = computed(() => {
  const v = activeWorkflowDebugState.value?.inputValue
  return v != null && typeof v === 'object'
})
const hasStructuredOutputValue = computed(() => {
  const v = activeWorkflowDebugState.value?.lastOutputValue
  return v != null && typeof v === 'object'
})
const canResumeDebug = computed(() => Boolean(activeWorkflowDebugTask.value?.status === 'running' && activeWorkflowDebugState.value?.paused))
const canSkipDebugNode = computed(() => canResumeDebug.value)
const isWorkflowDebugActive = computed(() => Boolean(activeWorkflowDebugTask.value?.status === 'running'))

const filteredWorkflows = computed(() => {
  const keyword = workflowKeyword.value.toLowerCase()
  if (!keyword) return workflows.value
  return workflows.value.filter(item => {
    const haystack = `${item.name || ''} ${item.description || ''}`.toLowerCase()
    return haystack.includes(keyword)
  })
})
const hasWorkflowSelection = computed(() => selectedWorkflowIds.value.length > 0)
const allFilteredWorkflowsSelected = computed(() => {
  if (!filteredWorkflows.value.length) return false
  const selectedSet = new Set(selectedWorkflowIds.value)
  return filteredWorkflows.value.every(item => selectedSet.has(item.id))
})
const exportWorkflowIds = computed(() => {
  if (selectedWorkflowIds.value.length > 0) return [...selectedWorkflowIds.value]
  return activeWorkflowId.value ? [activeWorkflowId.value] : []
})
const canExportWorkflows = computed(() => exportWorkflowIds.value.length > 0)
const canExportCurrentWorkflow = computed(() => Boolean(activeWorkflowId.value))
const canExportAllWorkflows = computed(() => workflows.value.length > 0)
const importDialogSummary = computed(() => getBundleSummary(importConflictDialog.value.bundle))
const exportDialogSummary = computed(() => {
  const targets = getExportTargetsByScope(exportDialog.value.scope)
  return getBundleSummary(buildWorkflowExportBundle(targets, {
    packageName: exportDialog.value.packageName,
    packageDescription: exportDialog.value.packageDescription
  }))
})
const importDialogMeta = computed(() => getBundleMeta(importConflictDialog.value.bundle))

const canvasBusinessNodeCount = computed(() => nodes.value.filter(item => ![START_NODE_ID, END_NODE_ID].includes(item.id)).length)
const hasStartNode = computed(() => nodes.value.some(item => item.id === START_NODE_ID || item.data?.kind === 'start'))
const hasEndNode = computed(() => nodes.value.some(item => item.id === END_NODE_ID || item.data?.kind === 'end'))
const openWorkflowTabs = computed(() => openWorkflowIds.value
  .map(id => workflows.value.find(item => item.id === id))
  .filter(Boolean))
const hasOpenTabs = computed(() => openWorkflowTabs.value.length > 0)
const hasActiveWorkflow = computed(() => Boolean(activeWorkflowId.value && openWorkflowTabs.value.some(item => item.id === activeWorkflowId.value)))
const workflowDialogTitle = computed(() => workflowDialogMode.value === 'edit' ? '编辑工作流' : '新建工作流')
const workflowMainStyle = computed(() => {
  if (leftCollapsed.value && rightCollapsed.value) {
    return { gridTemplateColumns: 'minmax(0, 1fr)' }
  }
  if (leftCollapsed.value) {
    return { gridTemplateColumns: `minmax(0, 1fr) 10px ${rightPanelWidth.value}px` }
  }
  if (rightCollapsed.value) {
    return { gridTemplateColumns: `${leftPanelWidth.value}px 10px minmax(0, 1fr)` }
  }
  return {
    gridTemplateColumns: `${leftPanelWidth.value}px 10px minmax(0, 1fr) 10px ${rightPanelWidth.value}px`
  }
})

function createEdgeMarkerEnd(color = '#2563eb') {
  return {
    type: MarkerType.ArrowClosed,
    width: 18,
    height: 18,
    color
  }
}

function getEdgeConditionLabel(condition) {
  const value = String(condition || 'always').trim()
  if (value === 'true') return '命中'
  if (value === 'false') return '未命中'
  return ''
}

function buildEdgeLabel(order, condition = 'always') {
  const orderLabel = String(Number(order ?? 0) + 1)
  const conditionLabel = getEdgeConditionLabel(condition)
  return conditionLabel ? `${orderLabel} ${conditionLabel}` : orderLabel
}

function buildCanvasNode(node) {
  const isStart = node.id === START_NODE_ID || node.data?.kind === 'start'
  const isEnd = node.id === END_NODE_ID || node.data?.kind === 'end'
  if (isStart) {
    return {
      ...createStartNode(),
      position: node.position || { x: 80, y: 220 },
      width: getNodeSize(node, 'width'),
      height: getNodeSize(node, 'height'),
      style: buildNodeStyle(node),
      sourcePosition: Position.Right,
      class: 'workflow-node workflow-start-node'
    }
  }
  if (isEnd) {
    return {
      ...createEndNode(),
      position: node.position || { x: 860, y: 220 },
      width: getNodeSize(node, 'width'),
      height: getNodeSize(node, 'height'),
      style: buildNodeStyle(node),
      targetPosition: Position.Left,
      class: 'workflow-node workflow-end-node'
    }
  }
  if (node.data?.kind === 'tool') {
    const toolMeta = getWorkflowToolByType(node.data?.toolType)
    const toolData = normalizeWorkflowToolData({
      ...(node.data || {}),
      toolType: node.data?.toolType
    })
    return {
      ...node,
      type: 'default',
      label: toolData.title || node.label || toolMeta?.title || '未命名工具',
      width: getNodeSize(node, 'width'),
      height: getNodeSize(node, 'height'),
      style: buildNodeStyle(node),
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      class: 'workflow-node workflow-tool-node',
      data: {
        ...toolData,
        icon: toolData.icon || toolMeta?.icon || 'TOOL',
        groupLabel: toolData.groupLabel || toolMeta?.groupLabel || '流程工具',
        description: toolData.description || toolMeta?.description || '',
        breakpoint: node.data?.breakpoint === true
      }
    }
  }
  const assistantMeta = eligibleAssistants.value.find(item => item.id === node.data?.assistantId)
  return {
    ...node,
    type: 'default',
    label: node.data?.title || node.label || '未命名助手',
    width: getNodeSize(node, 'width'),
    height: getNodeSize(node, 'height'),
    style: buildNodeStyle(node),
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    class: 'workflow-node workflow-assistant-node',
    data: {
      ...(node.data || {}),
      icon: node.data?.icon || assistantMeta?.icon || '🧠',
      groupLabel: node.data?.groupLabel || assistantMeta?.groupLabel || '全文助手',
      description: node.data?.description || assistantMeta?.description || ''
    }
  }
}

function getEdgeLabelTitle(edge) {
  const condition = String(edge?.data?.condition || 'always').trim()
  const sourceNode = getNodeById(edge?.source)
  const targetNode = getNodeById(edge?.target)
  const sourceTitle = sourceNode?.data?.title || sourceNode?.label || edge?.source || '上游'
  const targetTitle = targetNode?.data?.title || targetNode?.label || edge?.target || '下游'
  if (condition === 'true') return `${sourceTitle} → ${targetTitle}：条件命中时传递输出`
  if (condition === 'false') return `${sourceTitle} → ${targetTitle}：条件未命中时传递输出`
  return `${sourceTitle} → ${targetTitle}：传递上游输出`
}

function buildCanvasEdge(edge) {
  return {
    ...edge,
    type: edge.type || 'smoothstep',
    markerEnd: createEdgeMarkerEnd(buildCanvasEdgeMarkerColor(edge)),
    label: buildEdgeLabel(edge.data?.order ?? 0, edge.data?.condition || 'always'),
    data: { ...(edge.data || {}), labelTitle: getEdgeLabelTitle(edge) },
    class: buildCanvasEdgeClass(edge)
  }
}

function serializeNodes() {
  return nodes.value.map(node => ({
    id: node.id,
    type: node.id === START_NODE_ID ? 'start' : node.id === END_NODE_ID ? 'end' : 'default',
    label: node.data?.title || node.label || '',
    position: node.position,
    width: getNodeSize(node, 'width'),
    height: getNodeSize(node, 'height'),
    data: {
      kind: node.id === START_NODE_ID ? 'start' : node.id === END_NODE_ID ? 'end' : (node.data?.kind || 'assistant'),
      assistantId: node.data?.assistantId || '',
      toolType: node.data?.toolType || '',
      title: node.data?.title || node.label || '',
      icon: node.data?.icon || '',
      groupLabel: node.data?.groupLabel || '',
      description: node.data?.description || '',
      configOverrides: node.data?.configOverrides || {},
      config: node.data?.config || {},
      inputBinding: normalizeWorkflowInputBinding(node.data?.inputBinding),
      breakpoint: node.data?.breakpoint === true
    }
  }))
}

function serializeEdges() {
  return normalizeEdges(edges.value).map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type || 'smoothstep',
    label: buildEdgeLabel(edge.data?.order ?? 0, edge.data?.condition || 'always'),
    data: {
      order: Number(edge.data?.order ?? 0),
      condition: String(edge.data?.condition || 'always').trim() || 'always'
    }
  }))
}

function normalizeEdges(list) {
  const normalized = list.map(edge => ({
    ...edge,
    markerEnd: createEdgeMarkerEnd(buildCanvasEdgeMarkerColor(edge)),
    class: buildCanvasEdgeClass(edge)
  }))
  const sources = [...new Set(normalized.map(edge => edge.source))]
  let next = normalized
  sources.forEach(sourceId => {
    next = rebuildEdgeOrder(next, sourceId).map(edge => ({
      ...edge,
      markerEnd: createEdgeMarkerEnd(buildCanvasEdgeMarkerColor(edge)),
      label: buildEdgeLabel(edge.data?.order ?? 0, edge.data?.condition || 'always'),
      data: { ...(edge.data || {}), labelTitle: getEdgeLabelTitle(edge) },
      class: buildCanvasEdgeClass(edge)
    }))
  })
  return next
}

function getCurrentWorkflowPayload() {
  return {
    id: activeWorkflowId.value || `workflow_${Date.now()}`,
    name: workflowName.value || '未命名工作流',
    description: workflowDescription.value || '',
    nodes: serializeNodes(),
    edges: serializeEdges(),
    viewport: { x: 0, y: 0, zoom: 1 }
  }
}

function isNodeBreakpoint(nodeId) {
  const node = getNodeById(nodeId)
  return node?.data?.breakpoint === true
}

function toggleNodeBreakpoint(nodeId) {
  const targetNode = nodes.value.find(node => node.id === nodeId)
  if (!targetNode || [START_NODE_ID, END_NODE_ID].includes(nodeId)) return
  nodes.value = nodes.value.map(node => {
    if (node.id !== nodeId) return node
    return {
      ...node,
      data: {
        ...(node.data || {}),
        breakpoint: !(node.data?.breakpoint === true)
      }
    }
  })
  saveMessage.value = ''
  validationMessage.value = ''
}

function getNodeDebugStatus(nodeId) {
  const task = activeWorkflowRunTask.value
  if (!task || !nodeId) return ''
  if (task.status === 'running' && activeWorkflowRunNodeId.value === nodeId) {
    return activeWorkflowDebugState.value?.paused ? 'paused' : 'running'
  }
  const run = (task?.data?.nodeRuns || []).find(item => item.nodeId === nodeId)
  return String(run?.status || '').trim()
}

function getNodeRunRecord(nodeId) {
  if (!nodeId) return null
  return (activeWorkflowRunTask.value?.data?.nodeRuns || []).find(item => item.nodeId === nodeId) || null
}

function getNodeRunChildTask(nodeId) {
  const childTaskId = String(getNodeRunRecord(nodeId)?.childTaskId || '').trim()
  if (!childTaskId) return null
  return getTaskById(childTaskId) || workflowTasks.value.find(item => item.id === childTaskId) || null
}

function getNodeRunProgress(nodeId) {
  const status = getNodeDebugStatus(nodeId)
  if (!status) return null
  if (status === 'completed') return 100
  if (status === 'failed' || status === 'cancelled' || status === 'skipped') return 100
  if (status === 'paused') return Number(getNodeRunRecord(nodeId)?.progress || 0)
  const childTask = getNodeRunChildTask(nodeId)
  if (childTask?.progress != null) return Math.max(6, Math.min(99, Number(childTask.progress || 0)))
  const nodeRun = getNodeRunRecord(nodeId)
  if (nodeRun?.progress != null) return Math.max(6, Math.min(99, Number(nodeRun.progress || 0)))
  return status === 'running' ? 45 : null
}

function getNodeRunProgressText(nodeId) {
  const status = getNodeDebugStatus(nodeId)
  if (status !== 'running' && status !== 'paused') return ''
  const progress = getNodeRunProgress(nodeId)
  const childTask = getNodeRunChildTask(nodeId)
  const stage = String(childTask?.data?.progressStage || getNodeRunRecord(nodeId)?.progressStage || '').trim()
  const stageLabelMap = {
    preparing: '准备中',
    calling_model: '生成中',
    applying_result: '写入中',
    cancelled: '已停止'
  }
  const stageLabel = stageLabelMap[stage] || (status === 'paused' ? '等待继续' : '执行中')
  return Number.isFinite(progress) && progress > 0 ? `${stageLabel} ${Math.round(progress)}%` : stageLabel
}

function getNodeDebugClass(nodeId) {
  const status = getNodeDebugStatus(nodeId)
  if (status === 'paused') return 'debug-paused'
  if (status === 'running') return 'debug-running'
  if (status === 'completed') return 'debug-completed'
  if (status === 'failed') return 'debug-failed'
  if (status === 'cancelled') return 'debug-failed'
  if (status === 'skipped') return 'debug-skipped'
  return ''
}

function getNodeDebugBadge(nodeId) {
  const status = getNodeDebugStatus(nodeId)
  if (status === 'paused') return '已暂停'
  if (status === 'running') return getNodeRunProgressText(nodeId) || '执行中'
  if (status === 'completed') return '已完成'
  if (status === 'failed') return '失败'
  if (status === 'cancelled') return '已停止'
  if (status === 'skipped') return '跳过'
  return ''
}

function getEdgeDebugStatus(edge) {
  const task = activeWorkflowRunTask.value
  if (!task || !edge) return ''
  const currentNodeId = activeWorkflowRunNodeId.value
  const nodeRuns = Array.isArray(task?.data?.nodeRuns) ? task.data.nodeRuns : []
  if (currentNodeId && edge.target === currentNodeId) return 'incoming'
  for (const run of nodeRuns) {
    const decisions = Array.isArray(run?.branchDecisions) ? run.branchDecisions : []
    const decision = decisions.find(item => item.edgeId === edge.id)
    if (!decision) continue
    return decision.taken ? 'taken' : 'skipped'
  }
  const sourceRun = nodeRuns.find(r => r.nodeId === edge.source)
  const targetRun = nodeRuns.find(r => r.nodeId === edge.target)
  const sourceCompleted = edge.source === START_NODE_ID || sourceRun?.status === 'completed'
  const targetInPath = targetRun?.status && ['completed', 'running', 'paused'].includes(targetRun.status)
  if (sourceCompleted && targetInPath) return 'taken'
  return ''
}

function buildCanvasEdgeClass(edge) {
  const status = getEdgeDebugStatus(edge)
  return ['workflow-edge', status ? `workflow-edge-${status}` : ''].filter(Boolean).join(' ')
}

function buildCanvasEdgeMarkerColor(edge) {
  const status = getEdgeDebugStatus(edge)
  if (status === 'incoming') return '#f59e0b'
  if (status === 'taken') return '#2563eb'
  if (status === 'skipped') return '#cbd5e1'
  return '#2563eb'
}

function syncCanvasEdgeDebugState() {
  if (!Array.isArray(edges.value) || edges.value.length === 0) return
  edges.value = edges.value.map(edge => ({
    ...edge,
    markerEnd: createEdgeMarkerEnd(buildCanvasEdgeMarkerColor(edge)),
    class: buildCanvasEdgeClass(edge)
  }))
}

function closeTabContextMenu() {
  tabContextMenu.value = {
    visible: false,
    workflowId: '',
    x: 0,
    y: 0
  }
}

function closeNodeContextMenu() {
  nodeContextMenu.value = {
    visible: false,
    nodeId: '',
    canCopy: false,
    canConfigure: false,
    canDelete: false,
    canBreakpoint: false,
    isBreakpoint: false,
    canDebugFromHere: false,
    x: 0,
    y: 0
  }
}

function closeDebugStartDialog() {
  debugStartDialog.value = {
    visible: false,
    nodeId: '',
    nodeTitle: '',
    inputText: ''
  }
}

function closeEdgeContextMenu() {
  edgeContextMenu.value = {
    visible: false,
    edgeId: '',
    x: 0,
    y: 0
  }
}

function clearActiveWorkflow() {
  activeWorkflowId.value = ''
  workflowName.value = ''
  workflowDescription.value = ''
  nodes.value = []
  edges.value = []
  selectedEdgeId.value = ''
  validationMessage.value = ''
  saveMessage.value = ''
}

function rememberOpenWorkflow(workflowId) {
  if (!workflowId) return
  if (openWorkflowIds.value.includes(workflowId)) return
  openWorkflowIds.value = [...openWorkflowIds.value, workflowId]
}

function syncOpenWorkflowTabs(list) {
  const existingIds = new Set((list || []).map(item => item.id))
  const nextOpenIds = openWorkflowIds.value.filter(id => existingIds.has(id))
  openWorkflowIds.value = nextOpenIds
  if (activeWorkflowId.value && !nextOpenIds.includes(activeWorkflowId.value)) {
    activeWorkflowId.value = ''
  }
}

function loadWorkflow(workflow) {
  if (!workflow) return
  closeTabContextMenu()
  closeNodeContextMenu()
  rememberOpenWorkflow(workflow.id)
  activeRunTaskId.value = ''
  activeDebugTaskId.value = ''
  debugPanelCollapsed.value = true
  activeWorkflowId.value = workflow.id
  workflowName.value = workflow.name || '未命名工作流'
  workflowDescription.value = workflow.description || ''
  nodes.value = (workflow.nodes || []).map(buildCanvasNode)
  edges.value = (workflow.edges || []).map(buildCanvasEdge)
  selectedEdgeId.value = ''
  validationMessage.value = ''
  saveMessage.value = ''
  nextTick(() => {
    fitWorkflowView()
  })
}

function isWorkflowSelected(workflowId) {
  return selectedWorkflowIds.value.includes(workflowId)
}

function toggleWorkflowSelection(workflowId, checked) {
  if (!workflowId) return
  if (checked) {
    if (!selectedWorkflowIds.value.includes(workflowId)) {
      selectedWorkflowIds.value = [...selectedWorkflowIds.value, workflowId]
    }
    return
  }
  selectedWorkflowIds.value = selectedWorkflowIds.value.filter(id => id !== workflowId)
}

function toggleSelectAllFiltered(checked) {
  const filteredIds = filteredWorkflows.value.map(item => item.id)
  if (!filteredIds.length) return
  if (checked) {
    const next = new Set([...selectedWorkflowIds.value, ...filteredIds])
    selectedWorkflowIds.value = [...next]
    return
  }
  const filteredSet = new Set(filteredIds)
  selectedWorkflowIds.value = selectedWorkflowIds.value.filter(id => !filteredSet.has(id))
}

function buildUniqueName(baseName, usedNames) {
  const sourceName = String(baseName || '未命名').trim() || '未命名'
  if (!usedNames.has(sourceName)) {
    usedNames.add(sourceName)
    return sourceName
  }
  let index = 1
  let nextName = `${sourceName}${index}`
  while (usedNames.has(nextName)) {
    index += 1
    nextName = `${sourceName}${index}`
  }
  usedNames.add(nextName)
  return nextName
}

function getCurrentAssistantEntries() {
  const entries = []
  getBuiltinAssistants().forEach(item => {
    const config = getAssistantSetting(item.id)
    const title = String(config?.title || item.shortLabel || item.label || item.id).trim() || item.id
    entries.push({
      id: item.id,
      title,
      source: 'builtin'
    })
  })
  getCustomAssistants().forEach(item => {
    const title = String(item?.name || '').trim() || '未命名助手'
    entries.push({
      id: item.id,
      title,
      source: 'custom'
    })
  })
  return entries
}

function resolveWorkflowExportTargets() {
  if (!exportWorkflowIds.value.length) return []
  return exportWorkflowIds.value
    .map(id => {
      if (id === activeWorkflowId.value && hasActiveWorkflow.value) {
        return normalizeWorkflow(getCurrentWorkflowPayload(), workflowName.value || '未命名工作流')
      }
      const workflow = workflows.value.find(item => item.id === id)
      return workflow ? normalizeWorkflow(workflow, workflow.name || '未命名工作流') : null
    })
    .filter(Boolean)
}

function getExportTargetsByScope(scope = 'selected') {
  if (scope === 'current') {
    if (!activeWorkflowId.value) return []
    if (hasActiveWorkflow.value) {
      return [normalizeWorkflow(getCurrentWorkflowPayload(), workflowName.value || '未命名工作流')]
    }
    const workflow = workflows.value.find(item => item.id === activeWorkflowId.value)
    return workflow ? [normalizeWorkflow(workflow, workflow?.name || '未命名工作流')] : []
  }
  if (scope === 'all') {
    return workflows.value.map(item => {
      if (item.id === activeWorkflowId.value && hasActiveWorkflow.value) {
        return normalizeWorkflow(getCurrentWorkflowPayload(), workflowName.value || '未命名工作流')
      }
      return normalizeWorkflow(item, item?.name || '未命名工作流')
    })
  }
  return resolveWorkflowExportTargets()
}

function buildDefaultExportPackageName(targets) {
  const names = (targets || []).map(item => String(item?.name || '').trim()).filter(Boolean)
  if (names.length === 1) return names[0]
  if (names.length > 1) return `工作流包_${names.length}项`
  return '工作流包'
}

function buildWorkflowExportBundle(targets, options = {}) {
  const targetList = (targets || []).map(item => normalizeWorkflow(item, item?.name || '未命名工作流'))
  const assistantIds = new Set()
  targetList.forEach(workflow => {
    ;(workflow.nodes || []).forEach(node => {
      if (node?.data?.kind === 'assistant' && node.data.assistantId) {
        assistantIds.add(node.data.assistantId)
      }
    })
  })

  const builtin = []
  const custom = []
  const customMap = new Map(getCustomAssistants().map(item => [item.id, item]))
  assistantIds.forEach(id => {
    const builtinDefinition = getBuiltinAssistantDefinition(id)
    if (builtinDefinition) {
      builtin.push({
        id,
        title: String(getAssistantSetting(id)?.title || builtinDefinition.shortLabel || builtinDefinition.label || id).trim() || id,
        settings: deepClone(getAssistantSetting(id) || {})
      })
      return
    }
    const customAssistant = customMap.get(id)
    if (customAssistant) {
      custom.push(deepClone(customAssistant))
    }
  })

  const packageName = String(options?.packageName || '').trim() || buildDefaultExportPackageName(targetList)
  const packageDescription = String(options?.packageDescription || '').trim()

  return {
    type: workflowBundleType,
    version: workflowBundleVersion,
    exportedAt: new Date().toISOString(),
    meta: {
      packageName,
      packageDescription,
      exportedFrom: 'task-orchestration',
      workflowNames: targetList.map(item => item.name || '未命名工作流')
    },
    workflows: targetList,
    assistants: {
      builtin,
      custom
    }
  }
}

function getBundleSummary(bundle) {
  return {
    workflows: Array.isArray(bundle?.workflows) ? bundle.workflows.length : 0,
    builtinAssistants: Array.isArray(bundle?.assistants?.builtin) ? bundle.assistants.builtin.length : 0,
    customAssistants: Array.isArray(bundle?.assistants?.custom) ? bundle.assistants.custom.length : 0
  }
}

function getBundleMeta(bundle) {
  return {
    exportedAt: String(bundle?.exportedAt || '').trim(),
    exportedFrom: String(bundle?.meta?.exportedFrom || '').trim() || '未知来源',
    packageName: String(bundle?.meta?.packageName || '').trim(),
    packageDescription: String(bundle?.meta?.packageDescription || '').trim()
  }
}

function downloadBundleFile(bundle) {
  const base = String(bundle?.meta?.packageName || '').trim() || buildDefaultExportPackageName(bundle?.workflows || [])
  const filename = `${base.replace(/[\\/:*?"<>|]+/g, '_') || '工作流'}_${new Date().toISOString().slice(0, 10)}.json`
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function openExportDialog() {
  if (!canExportWorkflows.value && !canExportCurrentWorkflow.value && !canExportAllWorkflows.value) {
    validationMessage.value = '暂无可导出的工作流'
    return
  }
  const scope = selectedWorkflowIds.value.length > 0 ? 'selected' : (activeWorkflowId.value ? 'current' : 'all')
  const targets = getExportTargetsByScope(scope)
  exportDialog.value = {
    visible: true,
    scope,
    packageName: buildDefaultExportPackageName(targets),
    packageDescription: targets.length === 1
      ? String(targets[0]?.description || '').trim()
      : ''
  }
}

function closeExportDialog() {
  exportDialog.value = {
    visible: false,
    scope: selectedWorkflowIds.value.length > 0 ? 'selected' : 'current',
    packageName: '',
    packageDescription: ''
  }
}

function exportWorkflowsByScope(scope = 'selected') {
  const targets = getExportTargetsByScope(scope)
  if (!targets.length) {
    validationMessage.value = '请先选择或打开要导出的工作流'
    return
  }
  try {
    const bundle = buildWorkflowExportBundle(targets, {
      packageName: exportDialog.value.packageName,
      packageDescription: exportDialog.value.packageDescription
    })
    downloadBundleFile(bundle)
    closeExportDialog()
    saveMessage.value = `已导出 ${bundle.workflows.length} 个工作流，并打包相关助手配置。`
    validationMessage.value = ''
  } catch (error) {
    validationMessage.value = error?.message || '导出失败'
  }
}

function openWorkflowImport() {
  workflowImportInput.value?.click?.()
}

function closeImportConflictDialog() {
  importConflictDialog.value = {
    visible: false,
    duplicates: [],
    bundle: null
  }
  resetWorkflowImportInput()
}

function resetWorkflowImportInput() {
  if (workflowImportInput.value) {
    workflowImportInput.value.value = ''
  }
}

function closeImportResultDialog() {
  importResultDialog.value = {
    visible: false,
    summary: null
  }
}

function openImportedFirstWorkflow() {
  const workflowId = importResultDialog.value.summary?.firstWorkflowId
  if (!workflowId) return
  const workflow = workflows.value.find(item => item.id === workflowId)
  if (workflow) {
    loadWorkflow(workflow)
  }
  closeImportResultDialog()
}

function parseWorkflowBundle(rawText) {
  let parsed = null
  try {
    parsed = JSON.parse(String(rawText || ''))
  } catch (error) {
    throw new Error('导入文件不是有效的 JSON')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('导入文件格式无效')
  }
  const isBundle = parsed.type === workflowBundleType
  const workflowsFromBundle = isBundle
    ? (Array.isArray(parsed.workflows) ? parsed.workflows : [])
    : ((parsed.type === 'chayuan-workflow' || parsed.type === 'niudang-workflow') && parsed.workflow
        ? [parsed.workflow]
        : Array.isArray(parsed.workflows)
          ? parsed.workflows
          : [])
  if (!workflowsFromBundle.length) {
    throw new Error('导入文件中没有工作流数据')
  }
  return {
    type: parsed.type || workflowBundleType,
    version: Number(parsed.version || workflowBundleVersion) || workflowBundleVersion,
    exportedAt: parsed.exportedAt || '',
    meta: deepClone(parsed.meta || {}),
    workflows: workflowsFromBundle.map(item => normalizeWorkflow(item, item?.name || '导入工作流')),
    assistants: {
      builtin: Array.isArray(parsed.assistants?.builtin) ? parsed.assistants.builtin : [],
      custom: Array.isArray(parsed.assistants?.custom) ? parsed.assistants.custom : []
    }
  }
}

function detectImportConflicts(bundle) {
  const currentEntries = getCurrentAssistantEntries()
  const currentNameMap = new Map()
  const duplicateKeys = new Set()
  currentEntries.forEach(item => {
    const title = String(item?.title || '').trim()
    if (title && !currentNameMap.has(title)) {
      currentNameMap.set(title, item)
    }
  })
  return (bundle?.assistants?.custom || [])
    .map(item => {
      const name = String(item?.name || item?.title || '').trim() || '未命名助手'
      const matched = currentNameMap.get(name)
      if (!matched) return null
      const key = `${name}__${matched.source}`
      if (duplicateKeys.has(key)) return null
      duplicateKeys.add(key)
      return {
        name,
        targetSource: matched.source === 'builtin' ? '系统助手' : '自定义助手'
      }
    })
    .filter(Boolean)
}

function refreshAssistantViews() {
  assistantStoreVersion.value += 1
  try {
    if (window.Application?.ribbonUI?.InvalidateControl) {
      [
        'menuMoreAssistants',
        'menuContextAssistantMore',
        'btnAssistantPrimarySlot1',
        'btnAssistantPrimarySlot2',
        'btnAssistantPrimarySlot3',
        'btnAssistantPrimarySlot4',
        'btnAssistantPrimarySlot5',
        'btnAssistantPrimarySlot6'
      ].forEach(id => window.Application.ribbonUI.InvalidateControl(id))
    }
  } catch (_) {}
}

function ensureWorkflowLoaded(list) {
  if (!Array.isArray(list) || list.length === 0) {
    const draft = createWorkflowDraft('新建工作流')
    saveWorkflow(draft)
    clearActiveWorkflow()
    return
  }
  syncOpenWorkflowTabs(list)
  if (!openWorkflowIds.value.length) {
    clearActiveWorkflow()
    return
  }
  const current = list.find(item => item.id === activeWorkflowId.value)
  const fallbackId = openWorkflowIds.value[openWorkflowIds.value.length - 1]
  const fallbackWorkflow = list.find(item => item.id === fallbackId)
  if (!current && !fallbackWorkflow) {
    clearActiveWorkflow()
    return
  }
  loadWorkflow(current || fallbackWorkflow)
}

function isPointInsideCanvas(clientX, clientY) {
  const bounds = canvasWrapper.value?.getBoundingClientRect?.()
  if (!bounds) return false
  return clientX >= bounds.left && clientX <= bounds.right && clientY >= bounds.top && clientY <= bounds.bottom
}

function stopCustomDrag() {
  if (customDragMoveHandler) {
    window.removeEventListener('mousemove', customDragMoveHandler)
    customDragMoveHandler = null
  }
  if (customDragUpHandler) {
    window.removeEventListener('mouseup', customDragUpHandler)
    customDragUpHandler = null
  }
  customDrag.value = {
    active: false,
    payload: null,
    x: 0,
    y: 0,
    overCanvas: false,
    moved: false
  }
  pendingDraggedAssistant.value = null
}

function beginCustomDrag(payload, event) {
  pendingDraggedAssistant.value = payload
  const startX = Number(event.clientX || 0)
  const startY = Number(event.clientY || 0)
  customDrag.value = {
    active: true,
    payload,
    x: startX,
    y: startY,
    overCanvas: isPointInsideCanvas(startX, startY),
    moved: false
  }

  customDragMoveHandler = (moveEvent) => {
    const x = Number(moveEvent.clientX || 0)
    const y = Number(moveEvent.clientY || 0)
    const moved = Math.abs(x - startX) > 4 || Math.abs(y - startY) > 4 || customDrag.value.moved
    customDrag.value = {
      ...customDrag.value,
      x,
      y,
      overCanvas: isPointInsideCanvas(x, y),
      moved
    }
  }

  customDragUpHandler = (upEvent) => {
    const x = Number(upEvent.clientX || 0)
    const y = Number(upEvent.clientY || 0)
    const droppedOnCanvas = isPointInsideCanvas(x, y)
    const shouldAddByDrag = customDrag.value.moved && droppedOnCanvas
    const droppedPayload = customDrag.value.payload
    stopCustomDrag()
    if (!shouldAddByDrag || !droppedPayload) return
    suppressPaletteClickUntil.value = Date.now() + 250
    const position = screenToFlowCoordinate({ x, y })
    addCanvasPayload(droppedPayload, position)
  }

  window.addEventListener('mousemove', customDragMoveHandler)
  window.addEventListener('mouseup', customDragUpHandler)
}

function stopPanelResize() {
  if (panelResizeMoveHandler) {
    window.removeEventListener('mousemove', panelResizeMoveHandler)
    panelResizeMoveHandler = null
  }
  if (panelResizeUpHandler) {
    window.removeEventListener('mouseup', panelResizeUpHandler)
    panelResizeUpHandler = null
  }
}

function clampPanelWidth(side, width) {
  if (side === 'left') {
    return Math.min(420, Math.max(180, width))
  }
  return Math.min(560, Math.max(240, width))
}

function startPanelResize(side, event) {
  if (event.button !== 0) return
  const startX = Number(event.clientX || 0)
  const startWidth = side === 'left' ? leftPanelWidth.value : rightPanelWidth.value

  panelResizeMoveHandler = (moveEvent) => {
    const currentX = Number(moveEvent.clientX || 0)
    const delta = currentX - startX
    if (side === 'left') {
      leftPanelWidth.value = clampPanelWidth('left', startWidth + delta)
    } else {
      rightPanelWidth.value = clampPanelWidth('right', startWidth - delta)
    }
  }

  panelResizeUpHandler = () => {
    stopPanelResize()
  }

  window.addEventListener('mousemove', panelResizeMoveHandler)
  window.addEventListener('mouseup', panelResizeUpHandler)
}

function buildPalettePayload(item) {
  if (!item) return null
  if (paletteTab.value === 'tool') {
    return createWorkflowToolPayload(item.type)
  }
  return {
    kind: 'assistant',
    assistantId: item.id,
    title: item.title,
    icon: item.icon || '🧠',
    groupLabel: item.groupLabel || '全文助手',
    description: item.description || '',
    inputBinding: normalizeWorkflowInputBinding()
  }
}

function openToolPalette() {
  paletteTab.value = 'tool'
  leftCollapsed.value = false
}

function onPaletteMouseDown(item, event) {
  if (event.button !== 0) return
  const payload = buildPalettePayload(item)
  if (!payload) return
  beginCustomDrag(payload, event)
}

function onToolbarNodeMouseDown(kind, event) {
  if (event.button !== 0) return
  if ((kind === 'start' && hasStartNode.value) || (kind === 'end' && hasEndNode.value)) return
  const title = kind === 'start' ? '开始' : '结束'
  beginCustomDrag({ kind, title }, event)
}

function createAssistantNode(payload, position) {
  return {
    id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: 'default',
    label: payload.title || '未命名助手',
    position,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    class: 'workflow-node workflow-assistant-node',
    data: {
      kind: 'assistant',
      assistantId: payload.assistantId,
      title: payload.title || '未命名助手',
      icon: payload.icon || '🧠',
      groupLabel: payload.groupLabel || '全文助手',
      description: payload.description || '',
      inputBinding: normalizeWorkflowInputBinding(payload.inputBinding),
      configOverrides: {
        userPromptTemplate: '{{input}}',
        outputFormat: 'markdown',
        systemPrompt: '',
        workflowJsonSchemaText: ''
      }
    }
  }
}

function createToolNode(payload, position) {
  const toolData = normalizeWorkflowToolData(payload)
  return {
    id: createCanvasNodeId('tool'),
    type: 'default',
    label: toolData.title || '未命名工具',
    position,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    class: 'workflow-node workflow-tool-node',
    data: toolData
  }
}

function createToolbarNode(kind, position) {
  if (kind === 'start') {
    return {
      ...createStartNode(),
      position
    }
  }
  return {
    ...createEndNode(),
    position
  }
}

function onCanvasDragOver(event) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function resolveCanvasCenterPosition() {
  const bounds = canvasWrapper.value?.getBoundingClientRect?.()
  if (!bounds) {
    return {
      x: 260 + canvasBusinessNodeCount.value * 24,
      y: 180 + canvasBusinessNodeCount.value * 18
    }
  }
  return screenToFlowCoordinate({
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2
  })
}

function addAssistantToCanvas(assistant, preferredPosition = null) {
  addCanvasPayload(buildPalettePayload(assistant), preferredPosition)
}

function addCanvasPayload(payload, preferredPosition = null) {
  if (!payload) return
  if (payload.kind === 'start') {
    if (hasStartNode.value) return
    const position = preferredPosition || { x: 80, y: 220 }
    nodes.value = [...nodes.value, createToolbarNode('start', position)]
    saveMessage.value = ''
    validationMessage.value = ''
    return
  }
  if (payload.kind === 'end') {
    if (hasEndNode.value) return
    const position = preferredPosition || { x: 860, y: 220 }
    nodes.value = [...nodes.value, createToolbarNode('end', position)]
    saveMessage.value = ''
    validationMessage.value = ''
    return
  }
  if (payload.kind === 'tool') {
    const basePosition = preferredPosition || resolveCanvasCenterPosition()
    const offset = canvasBusinessNodeCount.value
    const position = {
      x: Number(basePosition.x || 0) + (offset % 3) * 28,
      y: Number(basePosition.y || 0) + Math.floor(offset / 3) * 22
    }
    const toolNode = createToolNode(payload, position)
    nodes.value = [...nodes.value, toolNode]
    saveMessage.value = ''
    validationMessage.value = ''
    window.setTimeout(() => {
      openToolConfigDialog(toolNode.id)
    }, 0)
    return
  }
  const basePosition = preferredPosition || resolveCanvasCenterPosition()
  const offset = canvasBusinessNodeCount.value
  const position = {
    x: Number(basePosition.x || 0) + (offset % 3) * 28,
    y: Number(basePosition.y || 0) + Math.floor(offset / 3) * 22
  }
  nodes.value = [...nodes.value, createAssistantNode(payload, position)]
  saveMessage.value = ''
  validationMessage.value = ''
}

function onPaletteClick(item) {
  if (Date.now() < suppressPaletteClickUntil.value) return
  addCanvasPayload(buildPalettePayload(item))
}

function onCanvasDrop(event) {
  event.preventDefault()
  if (!canvasWrapper.value) return
  try {
    const raw = event.dataTransfer?.getData?.(workflowMime) || ''
    const payload = raw ? JSON.parse(raw) : pendingDraggedAssistant.value
    if (!payload) return
    const position = screenToFlowCoordinate({
      x: event.clientX,
      y: event.clientY
    })
    addCanvasPayload(payload, position)
  } catch (error) {
    validationMessage.value = error?.message || '拖拽创建节点失败'
  } finally {
    pendingDraggedAssistant.value = null
  }
}

function onConnect(params) {
  if (!params.source || !params.target || params.source === params.target) return
  const hasDuplicate = edges.value.some(edge => edge.source === params.source && edge.target === params.target)
  if (hasDuplicate) return
  const currentOutgoing = edges.value.filter(edge => edge.source === params.source)
  edges.value = [
    ...edges.value,
    {
      id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      source: params.source,
      target: params.target,
      type: 'smoothstep',
      markerEnd: createEdgeMarkerEnd(),
      data: { order: currentOutgoing.length, condition: 'always' },
      label: buildEdgeLabel(currentOutgoing.length, 'always')
    }
  ]
  edges.value = normalizeEdges(edges.value)
  saveMessage.value = ''
}

function onNodeClick(event) {
  selectedEdgeId.value = ''
  closeNodeContextMenu()
  closeEdgeContextMenu()
}

function onNodeDoubleClick(event) {
  const nodeId = event?.node?.id || ''
  if (!nodeId) return
  const targetNode = nodes.value.find(node => node.id === nodeId)
  if (targetNode?.data?.kind === 'tool') {
    openToolConfigDialog(nodeId)
    return
  }
  if (targetNode?.data?.kind === 'assistant') {
    openAssistantConfigDialog(nodeId)
    return
  }
  renameNode(nodeId)
}

function onEdgeClick(event) {
  selectedEdgeId.value = event?.edge?.id || ''
  closeNodeContextMenu()
  closeEdgeContextMenu()
}

function onEdgeContextMenu(event) {
  const edgeId = event?.edge?.id || ''
  if (!edgeId) return
  event?.event?.preventDefault?.()
  event?.event?.stopPropagation?.()
  event?.preventDefault?.()
  event?.stopPropagation?.()
  selectedEdgeId.value = edgeId
  closeNodeContextMenu()
  edgeContextMenu.value = {
    visible: true,
    edgeId,
    x: Number(event?.event?.clientX || event?.clientX || 0),
    y: Number(event?.event?.clientY || event?.clientY || 0)
  }
}

function clearSelection() {
  selectedEdgeId.value = ''
  closeNodeContextMenu()
  closeEdgeContextMenu()
}

function renameNode(nodeId) {
  const targetNode = nodes.value.find(node => node.id === nodeId)
  if (!targetNode) return
  selectedEdgeId.value = ''
  editingNodeId.value = nodeId
  editingNodeTitle.value = String(targetNode.data?.title || targetNode.label || '').trim() || '未命名节点'
  closeNodeContextMenu()
  closeEdgeContextMenu()
  nextTick(() => {
    const input = document.getElementById(`node-rename-input-${nodeId}`)
    input?.focus?.()
    input?.select?.()
  })
}

function commitNodeRename() {
  const nodeId = editingNodeId.value
  if (!nodeId) return
  const title = String(editingNodeTitle.value || '').trim()
  if (!title) {
    cancelNodeRename()
    return
  }
  nodes.value = nodes.value.map(node => {
    if (node.id !== nodeId) return node
    return {
      ...node,
      label: title,
      data: {
        ...(node.data || {}),
        title
      }
    }
  })
  editingNodeId.value = ''
  editingNodeTitle.value = ''
  saveMessage.value = ''
  validationMessage.value = ''
}

function cancelNodeRename() {
  editingNodeId.value = ''
  editingNodeTitle.value = ''
}

function closeToolConfigDialog() {
  toolConfigDialog.value = {
    visible: false,
    nodeId: '',
    toolType: '',
    title: '',
    description: '',
    config: {}
  }
}

function openToolConfigDialog(nodeId) {
  const node = nodes.value.find(item => item.id === nodeId)
  if (!node || node.data?.kind !== 'tool') return
  const normalized = normalizeWorkflowToolData(node.data || {})
  const upstream = getIncomingSourceNodes(nodeId)
  workflowDebugInputs.value = Object.fromEntries(upstream.map(s => [s.id, workflowDebugInputs.value[s.id] || '']))
  toolConfigDialog.value = {
    visible: true,
    nodeId,
    toolType: normalized.toolType,
    title: normalized.title,
    description: normalized.description,
    config: {
      ...deepClone(normalized.config || {}),
      inputBinding: normalizeWorkflowInputBinding(normalized.inputBinding)
    }
  }
}

function saveToolConfigDialog() {
  const nodeId = toolConfigDialog.value.nodeId
  if (!nodeId) return
  const toolMeta = getWorkflowToolByType(toolConfigDialog.value.toolType)
  const title = String(toolConfigDialog.value.title || toolMeta?.title || '未命名工具').trim() || '未命名工具'
  const normalizedData = normalizeWorkflowToolData({
    toolType: toolConfigDialog.value.toolType,
    title,
    description: toolConfigDialog.value.description,
    breakpoint: getNodeById(nodeId)?.data?.breakpoint === true,
    config: {
      ...(toolConfigDialog.value.config || {}),
      inputBinding: undefined
    },
    inputBinding: normalizeWorkflowInputBinding(toolConfigDialog.value.config?.inputBinding)
  })
  nodes.value = nodes.value.map(node => {
    if (node.id !== nodeId) return node
    return {
      ...node,
      label: title,
      data: {
        ...(node.data || {}),
        ...normalizedData
      }
    }
  })
  closeToolConfigDialog()
  saveMessage.value = ''
  validationMessage.value = ''
}

function closeAssistantConfigDialog() {
  assistantConfigDialog.value = {
    visible: false,
    nodeId: '',
    assistantId: '',
    title: '',
    inputBinding: normalizeWorkflowInputBinding(),
    configOverrides: {
      systemPrompt: '',
      userPromptTemplate: '{{input}}',
      outputFormat: 'markdown',
      workflowJsonSchemaText: ''
    }
  }
}

function openAssistantConfigDialog(nodeId) {
  const node = nodes.value.find(item => item.id === nodeId)
  if (!node || node.data?.kind !== 'assistant') return
  const upstream = getIncomingSourceNodes(nodeId)
  workflowDebugInputs.value = Object.fromEntries(upstream.map(s => [s.id, workflowDebugInputs.value[s.id] || '']))
  assistantConfigDialog.value = {
    visible: true,
    nodeId,
    assistantId: String(node.data?.assistantId || '').trim(),
    title: String(node.data?.title || node.label || '未命名助手').trim() || '未命名助手',
    inputBinding: normalizeWorkflowInputBinding(node.data?.inputBinding),
    configOverrides: {
      systemPrompt: String(node.data?.configOverrides?.systemPrompt || ''),
      userPromptTemplate: String(node.data?.configOverrides?.userPromptTemplate || '{{input}}'),
      outputFormat: String(node.data?.configOverrides?.outputFormat || 'markdown'),
      workflowJsonSchemaText: String(node.data?.configOverrides?.workflowJsonSchemaText || '')
    }
  }
}

function saveAssistantConfigDialog() {
  const nodeId = assistantConfigDialog.value.nodeId
  if (!nodeId) return
  const title = String(assistantConfigDialog.value.title || '未命名助手').trim() || '未命名助手'
  nodes.value = nodes.value.map(node => {
    if (node.id !== nodeId) return node
    return {
      ...node,
      label: title,
      data: {
        ...(node.data || {}),
        title,
        inputBinding: normalizeWorkflowInputBinding(assistantConfigDialog.value.inputBinding),
        configOverrides: {
          ...(node.data?.configOverrides || {}),
          ...assistantConfigDialog.value.configOverrides
        }
      }
    }
  })
  closeAssistantConfigDialog()
  saveMessage.value = ''
  validationMessage.value = ''
}

function closeEdgeConfigDialog() {
  edgeConfigDialog.value = {
    visible: false,
    edgeId: '',
    condition: 'always'
  }
}

function openEdgeConfigDialog(edgeId) {
  const edge = edges.value.find(item => item.id === edgeId)
  if (!edge) return
  edgeConfigDialog.value = {
    visible: true,
    edgeId,
    condition: String(edge.data?.condition || 'always').trim() || 'always'
  }
}

function saveEdgeConfigDialog() {
  const edgeId = edgeConfigDialog.value.edgeId
  if (!edgeId) return
  edges.value = normalizeEdges(edges.value.map(edge => {
    if (edge.id !== edgeId) return edge
    const order = Number(edge.data?.order ?? 0)
    const condition = String(edgeConfigDialog.value.condition || 'always').trim() || 'always'
    return {
      ...edge,
      data: {
        ...(edge.data || {}),
        order,
        condition
      },
      label: buildEdgeLabel(order, condition),
      markerEnd: createEdgeMarkerEnd()
    }
  }))
  closeEdgeConfigDialog()
  saveMessage.value = ''
  validationMessage.value = ''
}

function removeNodeById(nodeId) {
  if (!nodeId || nodeId === START_NODE_ID || nodeId === END_NODE_ID) return
  nodes.value = nodes.value.filter(node => node.id !== nodeId)
  edges.value = normalizeEdges(edges.value.filter(edge => edge.source !== nodeId && edge.target !== nodeId))
  closeNodeContextMenu()
  closeEdgeContextMenu()
  saveMessage.value = ''
  validationMessage.value = ''
}

function copyNodeById(nodeId) {
  const sourceNode = nodes.value.find(node => node.id === nodeId)
  if (!sourceNode || !['assistant', 'tool'].includes(sourceNode.data?.kind)) return
  const sourceWidth = getNodeSize(sourceNode, 'width')
  const sourceHeight = getNodeSize(sourceNode, 'height')
  const clonedNode = {
    ...deepClone(sourceNode),
    id: createCanvasNodeId('node'),
    position: {
      x: Number(sourceNode.position?.x || 0) + 48,
      y: Number(sourceNode.position?.y || 0) + 36
    },
    selected: false,
    dragging: false,
    width: sourceWidth,
    height: sourceHeight,
    style: buildNodeStyle({
      width: sourceWidth,
      height: sourceHeight
    }),
    data: {
      ...(deepClone(sourceNode.data) || {}),
      title: sourceNode.data?.title || sourceNode.label || (sourceNode.data?.kind === 'tool' ? '未命名工具' : '未命名助手')
    }
  }
  nodes.value = [...nodes.value, clonedNode]
  closeNodeContextMenu()
  saveMessage.value = ''
  validationMessage.value = ''
}

function resetNodeSize(nodeId) {
  const targetNode = nodes.value.find(node => node.id === nodeId)
  if (!targetNode) return
  const defaultSize = getDefaultNodeSize(targetNode)
  nodes.value = nodes.value.map(node => {
    if (node.id !== nodeId) return node
    return {
      ...node,
      width: defaultSize.width,
      height: defaultSize.height,
      style: buildNodeStyle(defaultSize)
    }
  })
  closeNodeContextMenu()
  saveMessage.value = ''
  validationMessage.value = ''
}

function removeEdgeById(edgeId) {
  const edge = edges.value.find(item => item.id === edgeId)
  if (!edge) return
  edges.value = normalizeEdges(edges.value.filter(item => item.id !== edgeId))
  if (selectedEdgeId.value === edgeId) selectedEdgeId.value = ''
  closeEdgeContextMenu()
  saveMessage.value = ''
  validationMessage.value = ''
}

function moveEdgeOrder(edgeId, delta) {
  const edge = edges.value.find(item => item.id === edgeId)
  if (!edge) return
  const siblings = edges.value
    .filter(item => item.source === edge.source)
    .sort((a, b) => Number(a.data?.order ?? 0) - Number(b.data?.order ?? 0))
  const index = siblings.findIndex(item => item.id === edgeId)
  const targetIndex = index + delta
  if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) return
  const reordered = siblings.slice()
  const [moved] = reordered.splice(index, 1)
  reordered.splice(targetIndex, 0, moved)
  const updated = edges.value.map(item => {
    if (item.source !== edge.source) return item
    const order = reordered.findIndex(edgeItem => edgeItem.id === item.id)
    return {
      ...item,
      data: { ...(item.data || {}), order },
      label: buildEdgeLabel(order, item.data?.condition || 'always'),
      markerEnd: createEdgeMarkerEnd()
    }
  })
  edges.value = normalizeEdges(updated)
  saveMessage.value = ''
}

function getNodeTitle(nodeId) {
  const node = nodes.value.find(item => item.id === nodeId)
  return node?.data?.title || node?.label || '未命名节点'
}

function openNodeContextMenu(nodeId, event) {
  const targetNode = nodes.value.find(node => node.id === nodeId)
  if (!targetNode) return
  const kind = targetNode.data?.kind || (nodeId === START_NODE_ID ? 'start' : nodeId === END_NODE_ID ? 'end' : 'assistant')
  const canCopy = kind === 'assistant' || kind === 'tool'
  const canConfigure = kind === 'assistant' || kind === 'tool'
  const canDelete = kind === 'assistant' || kind === 'tool'
  const canBreakpoint = kind === 'assistant' || kind === 'tool'
  const canDebugFromHere = kind === 'assistant' || kind === 'tool'
  selectedEdgeId.value = ''
  closeEdgeContextMenu()
  nodeContextMenu.value = {
    visible: true,
    nodeId,
    canCopy,
    canConfigure,
    canDelete,
    canBreakpoint,
    isBreakpoint: targetNode.data?.breakpoint === true,
    canDebugFromHere,
    x: Number(event?.clientX || 0),
    y: Number(event?.clientY || 0)
  }
}

function openDebugStartDialog(nodeId) {
  const node = getNodeById(nodeId)
  if (!node || [START_NODE_ID, END_NODE_ID].includes(nodeId)) return
  debugStartDialog.value = {
    visible: true,
    nodeId,
    nodeTitle: node.data?.title || node.label || '未命名节点',
    inputText: ''
  }
}

function handleNodeContextAction(action) {
  const nodeId = nodeContextMenu.value.nodeId
  if (!nodeId) return closeNodeContextMenu()
  if (action === 'configure') {
    const targetNode = nodes.value.find(node => node.id === nodeId)
    if (targetNode?.data?.kind === 'tool') {
      openToolConfigDialog(nodeId)
    } else if (targetNode?.data?.kind === 'assistant') {
      openAssistantConfigDialog(nodeId)
    }
    closeNodeContextMenu()
    return
  }
  if (action === 'rename') {
    renameNode(nodeId)
    closeNodeContextMenu()
    return
  }
  if (action === 'copy') {
    copyNodeById(nodeId)
    return
  }
  if (action === 'resetSize') {
    resetNodeSize(nodeId)
    return
  }
  if (action === 'breakpoint') {
    toggleNodeBreakpoint(nodeId)
    closeNodeContextMenu()
    return
  }
  if (action === 'debugFromHere') {
    openDebugStartDialog(nodeId)
    closeNodeContextMenu()
    return
  }
  if (action === 'delete') {
    removeNodeById(nodeId)
    return
  }
  closeNodeContextMenu()
}

function handleEdgeContextAction(action) {
  const edgeId = edgeContextMenu.value.edgeId
  if (!edgeId) return closeEdgeContextMenu()
  if (action === 'configure') {
    openEdgeConfigDialog(edgeId)
    closeEdgeContextMenu()
    return
  }
  if (action === 'delete') {
    removeEdgeById(edgeId)
    return
  }
  closeEdgeContextMenu()
}

function closeWorkflowTab(workflowId) {
  if (!workflowId) return
  closeTabContextMenu()
  const currentTabs = openWorkflowIds.value.slice()
  const currentIndex = currentTabs.findIndex(id => id === workflowId)
  if (currentIndex < 0) return
  const nextTabs = currentTabs.filter(id => id !== workflowId)
  openWorkflowIds.value = nextTabs
  if (activeWorkflowId.value !== workflowId) return
  const fallbackId = nextTabs[currentIndex] || nextTabs[currentIndex - 1] || ''
  if (!fallbackId) {
    clearActiveWorkflow()
    return
  }
  const workflow = workflows.value.find(item => item.id === fallbackId)
  if (workflow) loadWorkflow(workflow)
}

function closeOtherWorkflowTabs(workflowId) {
  if (!workflowId) return
  openWorkflowIds.value = openWorkflowIds.value.filter(id => id === workflowId)
  closeTabContextMenu()
  const workflow = workflows.value.find(item => item.id === workflowId)
  if (workflow) loadWorkflow(workflow)
}

function closeAllWorkflowTabs() {
  openWorkflowIds.value = []
  closeTabContextMenu()
  clearActiveWorkflow()
}

function openTabContextMenu(workflow, event) {
  if (!workflow?.id) return
  tabContextMenu.value = {
    visible: true,
    workflowId: workflow.id,
    x: Number(event.clientX || 0),
    y: Number(event.clientY || 0)
  }
}

function handleTabContextAction(action) {
  const workflowId = tabContextMenu.value.workflowId
  if (!workflowId) return closeTabContextMenu()
  if (action === 'close') {
    closeWorkflowTab(workflowId)
    return
  }
  if (action === 'closeOthers') {
    closeOtherWorkflowTabs(workflowId)
    return
  }
  if (action === 'closeAll') {
    closeAllWorkflowTabs()
    return
  }
  closeTabContextMenu()
}

function openCreateWorkflowDialog() {
  workflowDialogMode.value = 'create'
  newWorkflowName.value = `新建工作流 ${workflows.value.length + 1}`
  newWorkflowDescription.value = ''
  createWorkflowError.value = ''
  createWorkflowDialogVisible.value = true
  nextTick(() => {
    createWorkflowNameInput.value?.focus?.()
    createWorkflowNameInput.value?.select?.()
  })
}

function openEditWorkflowDialog() {
  if (!hasActiveWorkflow.value) return
  workflowDialogMode.value = 'edit'
  newWorkflowName.value = workflowName.value || ''
  newWorkflowDescription.value = workflowDescription.value || ''
  createWorkflowError.value = ''
  createWorkflowDialogVisible.value = true
  nextTick(() => {
    createWorkflowNameInput.value?.focus?.()
    createWorkflowNameInput.value?.select?.()
  })
}

function closeCreateWorkflowDialog() {
  createWorkflowDialogVisible.value = false
  createWorkflowError.value = ''
}

function confirmCreateWorkflow() {
  const name = String(newWorkflowName.value || '').trim()
  const description = String(newWorkflowDescription.value || '').trim()
  if (!name) {
    createWorkflowError.value = '请先填写工作流名称'
    nextTick(() => createWorkflowNameInput.value?.focus?.())
    return
  }
  const saved = workflowDialogMode.value === 'edit'
    ? saveWorkflow({
      ...getCurrentWorkflowPayload(),
      name,
      description
    })
    : saveWorkflow(createWorkflowDraft(name, description))
  closeCreateWorkflowDialog()
  loadWorkflow(saved)
  saveMessage.value = workflowDialogMode.value === 'edit' ? '工作流信息已更新。' : '工作流已创建。'
  validationMessage.value = ''
}

function deleteWorkflowItems(workflowIds) {
  const ids = [...new Set((workflowIds || []).filter(Boolean))]
  if (!ids.length) return
  const message = ids.length > 1
    ? `确认删除选中的 ${ids.length} 个工作流吗？`
    : '确认删除当前工作流吗？'
  if (!window.confirm(message)) return
  const idSet = new Set(ids)
  openWorkflowIds.value = openWorkflowIds.value.filter(id => !idSet.has(id))
  selectedWorkflowIds.value = selectedWorkflowIds.value.filter(id => !idSet.has(id))
  ids.forEach(id => deleteWorkflow(id))
}

function deleteSelectedWorkflows() {
  deleteWorkflowItems(selectedWorkflowIds.value)
}

function deleteWorkflowItem(workflowId) {
  deleteWorkflowItems([workflowId])
}

function importWorkflowsWithStrategy(bundle, duplicateStrategy = 'new') {
  const parsedBundle = bundle || importConflictDialog.value.bundle
  if (!parsedBundle) return

  const existingCustomAssistants = getCustomAssistants()
  const nextCustomAssistants = existingCustomAssistants.map(item => deepClone(item))
  const customIndexById = new Map(nextCustomAssistants.map((item, index) => [item.id, index]))
  const existingAssistantEntries = getCurrentAssistantEntries()
  const assistantNameMap = new Map()
  existingAssistantEntries.forEach(item => {
    const title = String(item?.title || '').trim()
    if (title && !assistantNameMap.has(title)) {
      assistantNameMap.set(title, {
        id: item.id,
        source: item.source
      })
    }
  })
  const usedAssistantNames = new Set(
    existingAssistantEntries
      .map(item => String(item?.title || '').trim())
      .filter(Boolean)
  )

  const assistantIdMap = new Map()
  const assistantNameMapping = new Map()
  let importedCustomCount = 0
  let overwrittenCustomCount = 0
  let reusedSystemAssistantCount = 0
  const renamedAssistants = []
  const overwrittenAssistants = []
  const reusedAssistants = []

  ;(parsedBundle.assistants?.builtin || []).forEach(item => {
    const id = String(item?.id || '').trim()
    if (!id || !getBuiltinAssistantDefinition(id)) return
    assistantIdMap.set(id, id)
    const currentBuiltinTitle = String(getAssistantSetting(id)?.title || getBuiltinAssistantDefinition(id)?.shortLabel || getBuiltinAssistantDefinition(id)?.label || id).trim() || id
    const importedBuiltinTitle = String(item?.title || currentBuiltinTitle).trim() || currentBuiltinTitle
    assistantNameMapping.set(id, duplicateStrategy === 'keep' ? currentBuiltinTitle : importedBuiltinTitle)
  })

  ;(parsedBundle.assistants?.custom || []).forEach(item => {
    const rawName = String(item?.name || item?.title || '').trim() || '未命名助手'
    const existing = assistantNameMap.get(rawName) || null
    const importedId = String(item?.id || '').trim() || buildCustomAssistantId(rawName)
    const baseDraft = createCustomAssistantDraft()

    if (existing) {
      if (duplicateStrategy === 'keep') {
        assistantIdMap.set(importedId, existing.id)
        assistantNameMapping.set(importedId, rawName)
        reusedSystemAssistantCount += 1
        reusedAssistants.push(`${rawName} -> ${existing.id}`)
        return
      }
      if (duplicateStrategy === 'overwrite' && existing.source === 'custom') {
        const targetIndex = customIndexById.get(existing.id)
        const overwritten = {
          ...baseDraft,
          ...deepClone(item),
          id: existing.id,
          name: rawName,
          sortOrder: Number.isFinite(Number(nextCustomAssistants[targetIndex]?.sortOrder))
            ? Number(nextCustomAssistants[targetIndex].sortOrder)
            : targetIndex
        }
        nextCustomAssistants.splice(targetIndex, 1, overwritten)
        assistantIdMap.set(importedId, existing.id)
        assistantNameMapping.set(importedId, rawName)
        overwrittenCustomCount += 1
        overwrittenAssistants.push(rawName)
        return
      }
      if (duplicateStrategy === 'overwrite' && existing.source === 'builtin') {
        assistantIdMap.set(importedId, existing.id)
        assistantNameMapping.set(importedId, rawName)
        reusedSystemAssistantCount += 1
        reusedAssistants.push(`${rawName} -> 系统助手`)
        return
      }
    }

    const uniqueName = buildUniqueName(rawName, usedAssistantNames)
    const created = {
      ...baseDraft,
      ...deepClone(item),
      id: buildCustomAssistantId(uniqueName),
      name: uniqueName,
      sortOrder: nextCustomAssistants.length
    }
    nextCustomAssistants.push(created)
    customIndexById.set(created.id, nextCustomAssistants.length - 1)
    assistantNameMap.set(uniqueName, {
      id: created.id,
      source: 'custom'
    })
    assistantIdMap.set(importedId, created.id)
    assistantNameMapping.set(importedId, uniqueName)
    importedCustomCount += 1
    if (uniqueName !== rawName) {
      renamedAssistants.push(`${rawName} -> ${uniqueName}`)
    }
  })

  const builtinSettings = loadAssistantSettings()
  let importedBuiltinCount = 0
  if (duplicateStrategy !== 'keep') {
    ;(parsedBundle.assistants?.builtin || []).forEach(item => {
      const id = String(item?.id || '').trim()
      if (!id || !getBuiltinAssistantDefinition(id)) return
      builtinSettings[id] = {
        ...(builtinSettings[id] || {}),
        ...deepClone(item?.settings || {})
      }
      importedBuiltinCount += 1
    })
  }

  if (!saveCustomAssistants(nextCustomAssistants)) {
    throw new Error('导入助手失败，自定义助手保存未成功')
  }
  if (!saveAssistantSettings(builtinSettings)) {
    throw new Error('导入助手失败，系统助手配置保存未成功')
  }
  refreshAssistantViews()

  const existingWorkflowNames = new Set(workflows.value.map(item => String(item?.name || '').trim()).filter(Boolean))
  const importedWorkflows = parsedBundle.workflows.map((item, index) => {
    const normalized = normalizeWorkflow(item, item?.name || `导入工作流 ${index + 1}`)
    const workflowName = buildUniqueName(normalized.name || `导入工作流 ${index + 1}`, existingWorkflowNames)
    const nodeNameMap = new Map()

    ;(parsedBundle.assistants?.builtin || []).forEach(entry => {
      const id = String(entry?.id || '').trim()
      if (id) nodeNameMap.set(id, String(entry?.title || id).trim() || id)
    })
    ;(parsedBundle.assistants?.custom || []).forEach(entry => {
      const id = String(entry?.id || '').trim()
      const name = String(entry?.name || entry?.title || '').trim() || '未命名助手'
      if (id) nodeNameMap.set(id, name)
    })

    const nextNodes = (normalized.nodes || []).map(node => {
      if (node?.data?.kind !== 'assistant' || !node.data.assistantId) return node
      const originalAssistantId = node.data.assistantId
      const mappedAssistantId = assistantIdMap.get(originalAssistantId) || originalAssistantId
      const originalName = nodeNameMap.get(originalAssistantId) || String(node.data?.title || '').trim()
      const mappedName = assistantNameMapping.get(originalAssistantId) || originalName
      const assistantExists = Boolean(getBuiltinAssistantDefinition(mappedAssistantId)) ||
        nextCustomAssistants.some(entry => entry.id === mappedAssistantId)
      if (!assistantExists) {
        throw new Error(`导入失败，工作流引用的助手不存在：${originalName || mappedAssistantId}`)
      }
      const currentTitle = String(node.data?.title || node.label || '').trim()
      const shouldReplaceTitle = !currentTitle || (originalName && currentTitle === originalName)
      return {
        ...node,
        label: shouldReplaceTitle ? mappedName : (node.label || currentTitle),
        data: {
          ...(node.data || {}),
          assistantId: mappedAssistantId,
          title: shouldReplaceTitle ? mappedName : (node.data?.title || currentTitle)
        }
      }
    })

    return normalizeWorkflow({
      ...normalized,
      id: `workflow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: workflowName,
      nodes: nextNodes
    }, workflowName)
  })
  const importedWorkflowNames = importedWorkflows.map(item => item.name || '未命名工作流')

  saveWorkflows([...importedWorkflows, ...workflows.value])
  closeImportConflictDialog()
  resetWorkflowImportInput()
  if (importedWorkflows[0]) {
    loadWorkflow(importedWorkflows[0])
  }
  importResultDialog.value = {
    visible: true,
    summary: {
      strategy: duplicateStrategy,
      firstWorkflowId: importedWorkflows[0]?.id || '',
      workflows: importedWorkflowNames,
      renamedAssistants,
      overwrittenAssistants,
      reusedAssistants,
      importedCustomCount,
      overwrittenCustomCount,
      reusedSystemAssistantCount,
      importedBuiltinCount
    }
  }
  saveMessage.value = `已导入 ${importedWorkflows.length} 个工作流，新增 ${importedCustomCount} 个助手，覆盖 ${overwrittenCustomCount} 个助手，复用 ${reusedSystemAssistantCount} 个系统助手。`
  validationMessage.value = importedBuiltinCount > 0
    ? `同时更新了 ${importedBuiltinCount} 个系统助手配置。`
    : duplicateStrategy === 'keep'
      ? '已保留当前系统中的系统助手配置。'
      : ''
}

function applyImportConflictStrategy(strategy) {
  try {
    importWorkflowsWithStrategy(importConflictDialog.value.bundle, strategy)
  } catch (error) {
    validationMessage.value = error?.message || '导入失败'
  }
}

async function onWorkflowImportChange(event) {
  try {
    const file = event?.target?.files?.[0]
    if (!file) return
    const text = await file.text()
    const bundle = parseWorkflowBundle(text)
    const duplicates = detectImportConflicts(bundle)
    importConflictDialog.value = {
      visible: true,
      duplicates,
      bundle
    }
  } catch (error) {
    validationMessage.value = error?.message || '导入失败'
    resetWorkflowImportInput()
  }
}

function validateCurrentWorkflow() {
  if (!hasActiveWorkflow.value) return
  try {
    validateWorkflow(getCurrentWorkflowPayload())
    validationMessage.value = '工作流结构校验通过。'
    saveMessage.value = ''
  } catch (error) {
    validationMessage.value = error?.message || '工作流校验失败'
  }
}

function saveCurrentWorkflow() {
  if (!hasActiveWorkflow.value) return
  try {
    const validated = validateWorkflow(getCurrentWorkflowPayload())
    const saved = saveWorkflow(validated)
    loadWorkflow(saved)
    saveMessage.value = '工作流已保存。'
    validationMessage.value = ''
  } catch (error) {
    validationMessage.value = error?.message || '保存失败'
  }
}

function runPathAnalysis() {
  if (!hasActiveWorkflow.value) return
  try {
    const payload = getCurrentWorkflowPayload()
    const result = analyzeWorkflowPaths(payload)
    pathAnalysisDialog.value = { visible: true, result }
  } catch (error) {
    pathAnalysisDialog.value = {
      visible: true,
      result: { valid: false, validationError: error?.message || '分析失败', paths: [], summary: {} }
    }
  }
}

async function startCurrentWorkflow() {
  if (!activeWorkflowId.value) return
  const workflow = workflows.value.find(item => item.id === activeWorkflowId.value)
  if (!workflow) return
  return startWorkflowFromList(workflow)
}

async function startCurrentWorkflowDebug() {
  if (!activeWorkflowId.value) return
  const workflow = workflows.value.find(item => item.id === activeWorkflowId.value)
  if (!workflow) return
  return startWorkflowDebugFromList(workflow)
}

async function startWorkflowDebugFromList(workflow) {
  return startWorkflowByMode(workflow, { debug: true })
}

async function startWorkflowFromList(workflow) {
  return startWorkflowByMode(workflow, { debug: false })
}

async function startWorkflowByMode(workflow, options = {}) {
  const debug = options?.debug === true
  try {
    isStarting.value = true
    startingWorkflowId.value = workflow.id
    const target = workflow.id === activeWorkflowId.value
      ? getCurrentWorkflowPayload()
      : workflow
    const validated = validateWorkflow(target)
    const saved = saveWorkflow(validated)
    const debugBreakpointIds = (saved?.nodes || [])
      .filter(node => node.id !== START_NODE_ID && node.id !== END_NODE_ID && node?.data?.breakpoint === true)
      .map(node => node.id)
    loadWorkflow(saved)
    if (debug) {
      rightCollapsed.value = false
    }
    const taskId = await startWorkflowRun(saved, {
      debug,
      breakpointNodeIds: debugBreakpointIds
    })
    activeRunTaskId.value = taskId
    if (debug) {
      activeDebugTaskId.value = taskId
      debugPanelCollapsed.value = true
      saveMessage.value = `调试已启动，任务号：${taskId}`
    } else {
      activeDebugTaskId.value = ''
      saveMessage.value = `工作流已启动，任务号：${taskId}`
    }
    validationMessage.value = ''
    if (!debug) openTaskList(taskId)
  } catch (error) {
    validationMessage.value = error?.message || (debug ? '调试启动失败' : '启动失败')
  } finally {
    isStarting.value = false
    startingWorkflowId.value = ''
  }
}

function resumeActiveDebugRun() {
  const taskId = activeWorkflowDebugTask.value?.id
  if (!taskId) return
  resumeWorkflowDebug(taskId, 'continue')
}

function stepActiveDebugRun() {
  const taskId = activeWorkflowDebugTask.value?.id
  if (!taskId) return
  resumeWorkflowDebug(taskId, 'step')
}

function stopActiveDebugRun() {
  const taskId = activeWorkflowRunTask.value?.id || activeWorkflowDebugTask.value?.id
  if (!taskId) return
  stopWorkflowRun(taskId)
}

function skipActiveDebugNode() {
  const taskId = activeWorkflowDebugTask.value?.id
  if (!taskId) return
  resumeWorkflowDebug(taskId, 'skip')
}

function resetActiveDebugInputEdit() {
  debugInputEditorText.value = String(activeWorkflowDebugState.value?.inputPreview || '')
}

function applyActiveDebugInputEdit() {
  const taskId = activeWorkflowDebugTask.value?.id
  if (!taskId) return
  setWorkflowDebugInputOverride(taskId, debugInputEditorText.value)
  saveMessage.value = '已应用当前节点调试输入'
  validationMessage.value = ''
}

function copyActiveDebugInput() {
  return copyText(activeWorkflowDebugState.value?.inputPreview || '', '当前步输入已复制')
}

function copyActiveDebugOutput() {
  return copyText(activeWorkflowDebugState.value?.lastOutputText || '', '最近一步输出已复制')
}

function copyActiveDebugVariables() {
  const payload = {
    waitingNodeId: activeWorkflowDebugState.value?.waitingNodeId || '',
    waitingNodeTitle: activeWorkflowDebugState.value?.waitingNodeTitle || '',
    waitingReason: activeWorkflowDebugState.value?.waitingReason || '',
    inputSummary: activeWorkflowDebugState.value?.inputSummary || '',
    inputPreview: activeWorkflowDebugState.value?.inputPreview || '',
    inputValue: activeWorkflowDebugState.value?.inputValue,
    lastOutputNodeTitle: activeWorkflowDebugState.value?.lastOutputNodeTitle || '',
    lastOutputText: activeWorkflowDebugState.value?.lastOutputText || '',
    lastOutputValue: activeWorkflowDebugState.value?.lastOutputValue,
    parentOutputs: activeWorkflowDebugState.value?.parentOutputs || []
  }
  return copyText(JSON.stringify(payload, null, 2), '调试变量已复制')
}

function confirmDebugStartFromNode() {
  const nodeId = String(debugStartDialog.value.nodeId || '').trim()
  if (!nodeId || !activeWorkflowId.value) return
  const workflow = workflows.value.find(item => item.id === activeWorkflowId.value)
  if (!workflow) return
  const startInputText = String(debugStartDialog.value.inputText || '')
  closeDebugStartDialog()
  startWorkflowByMode(workflow, {
    debug: true,
    startNodeId: nodeId,
    startInputText
  })
}

function openTaskList(taskId = '') {
  try {
    const href = String(window.location.href || '')
    const base = href.split('#')[0] || href
    const query = taskId ? `?taskId=${encodeURIComponent(taskId)}&detail=1` : ''
    const url = `${base}#/popup${query}`
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
}

function fitWorkflowView() {
  if (!hasActiveWorkflow.value) return
  nextTick(() => {
    fitView({ padding: 0.2 })
  })
}

function scheduleViewportSync() {
  ;[50, 180, 420, 900].forEach(delay => {
    window.setTimeout(() => {
      fitWorkflowView()
    }, delay)
  })
}

function togglePaletteGroup(label) {
  if (!label) return
  const tab = paletteTab.value === 'assistant' ? 'assistant' : 'tool'
  const currentMap = paletteCollapsedGroups.value[tab] || {}
  paletteCollapsedGroups.value = {
    ...paletteCollapsedGroups.value,
    [tab]: {
      ...currentMap,
      [label]: !currentMap[label]
    }
  }
}

watch(
  () => [nodes.value, edges.value, workflowName.value, workflowDescription.value],
  () => {
    saveMessage.value = ''
  },
  { deep: true }
)

watch(
  () => breakpointNodeIds.value.join(','),
  () => {
    const taskId = activeWorkflowDebugTask.value?.id
    if (!taskId || activeWorkflowDebugTask.value?.status !== 'running') return
    setWorkflowRunBreakpoints(taskId, breakpointNodeIds.value)
  }
)

watch(
  () => [
    activeWorkflowRunTask.value?.id || '',
    activeWorkflowRunTask.value?.updatedAt || '',
    activeWorkflowRunNodeId.value,
    activeWorkflowDebugState.value?.paused ? '1' : '0'
  ].join('|'),
  () => {
    syncCanvasEdgeDebugState()
  }
)

watch(
  () => [activeWorkflowRunNodeId.value, activeWorkflowDebugState.value?.paused ? '1' : '0'].join('|'),
  async () => {
    const nodeId = activeWorkflowRunNodeId.value
    if (!nodeId || !activeWorkflowDebugState.value?.paused) return
    const node = getNodeById(nodeId)
    if (!node) return
    const width = Number(getNodeSize(node, 'width') || (node.data?.kind === 'tool' ? 160 : 120))
    const height = Number(getNodeSize(node, 'height') || (node.data?.kind === 'tool' ? 92 : 72))
    await nextTick()
    try {
      setCenter(
        Number(node.position?.x || 0) + width / 2,
        Number(node.position?.y || 0) + height / 2,
        { zoom: 1.15, duration: 300 }
      )
    } catch (_) {}
  }
)

unsubscribe = subscribeWorkflows((list) => {
  workflows.value = list
  const idSet = new Set((list || []).map(item => item.id))
  selectedWorkflowIds.value = selectedWorkflowIds.value.filter(id => idSet.has(id))
  syncOpenWorkflowTabs(list)
  if (!activeWorkflowId.value) {
    ensureWorkflowLoaded(list)
    return
  }
  const exists = list.find(item => item.id === activeWorkflowId.value)
  if (!exists) {
    ensureWorkflowLoaded(list)
  }
})

unsubscribeTasks = subscribeTasks((list) => {
  workflowTasks.value = list
  if (activeRunTaskId.value && !list.some(item => item.id === activeRunTaskId.value)) {
    activeRunTaskId.value = ''
  }
  if (activeDebugTaskId.value && !list.some(item => item.id === activeDebugTaskId.value)) {
    activeDebugTaskId.value = ''
  }
})

onMounted(() => {
  taskOrchestrationWindowSession.value = createTaskOrchestrationWindowSession(() => {
    fitWorkflowView()
  })
  const claimed = taskOrchestrationWindowSession.value.claimOwnership()
  if (!claimed.ok && claimed.reason === 'duplicate') {
    window.setTimeout(() => {
      closeWindow()
    }, 80)
    return
  }
  scheduleViewportSync()
  handleViewportResize = () => fitWorkflowView()
  handleGlobalClick = () => {
    closeTabContextMenu()
    closeNodeContextMenu()
    closeEdgeContextMenu()
  }
  handleGlobalKeydown = (event) => {
    if (event.key === 'Escape') {
      closeTabContextMenu()
      closeNodeContextMenu()
      closeEdgeContextMenu()
    }
  }
  window.addEventListener('resize', handleViewportResize)
  window.addEventListener('click', handleGlobalClick)
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  if (handleViewportResize) {
    window.removeEventListener('resize', handleViewportResize)
    handleViewportResize = null
  }
  if (handleGlobalClick) {
    window.removeEventListener('click', handleGlobalClick)
    handleGlobalClick = null
  }
  if (handleGlobalKeydown) {
    window.removeEventListener('keydown', handleGlobalKeydown)
    handleGlobalKeydown = null
  }
  stopCustomDrag()
  stopPanelResize()
  unsubscribe?.()
  unsubscribeTasks?.()
  taskOrchestrationWindowSession.value?.releaseOwnership?.()
  taskOrchestrationWindowSession.value = null
})
</script>

<style scoped>
.workflow-dialog {
  display: flex;
  flex-direction: column;
  width: 100vw;
  min-width: 0;
  height: 100vh;
  min-height: 100vh;
  background: #f5f7fb;
  color: #1f2937;
  overflow: hidden;
}

.workflow-header-actions,
.sidebar-actions,
.branch-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.workflow-main {
  flex: 1;
  height: 100%;
  min-height: 0;
  min-width: 0;
  display: grid;
  gap: 0;
  padding: 0;
  overflow: hidden;
}

.palette-panel,
.sidebar-panel,
.canvas-panel {
  background: #ffffff;
  border: none;
  border-radius: 0;
  min-height: 0;
  min-width: 0;
}

.palette-panel,
.sidebar-panel {
  display: flex;
  flex-direction: column;
  padding: 8px;
  overflow: hidden;
  position: relative;
}

.canvas-panel {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-left: none;
  border-right: none;
}

.panel-search,
.field-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 9px 10px;
  font-size: 13px;
  outline: none;
}

.panel-search:focus,
.field-input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.palette-toolbar {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 0 0 8px;
  background: rgba(255, 255, 255, 0.98);
  border-bottom: 1px solid #dbe2f0;
}

.panel-search.compact {
  border-color: #e2e8f0;
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 12px;
}

.palette-groups,
.workflow-list {
  overflow: auto;
  min-height: 0;
}

.palette-groups {
  margin-top: 2px;
}

.palette-panel {
  min-width: 0;
}

.sidebar-panel {
  min-width: 0;
}

.palette-group + .palette-group,
.sidebar-section + .sidebar-section {
  margin-top: 10px;
}

.palette-group-title {
  font-size: 11px;
  font-weight: 700;
  color: #475569;
}

.palette-group-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 5px 2px;
  border: none;
  background: transparent;
  cursor: pointer;
}

.palette-group-header:hover .palette-group-title,
.palette-group-header:hover .palette-group-count {
  color: #1d4ed8;
}

.palette-group-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.palette-group-count {
  min-width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  border-radius: 999px;
  background: #e2e8f0;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
}

.palette-group-arrow {
  color: #64748b;
  font-size: 12px;
  line-height: 1;
  transform: rotate(0deg);
  transition: transform 0.18s ease, color 0.18s ease;
}

.palette-group-arrow.collapsed {
  transform: rotate(-90deg);
}

.palette-group-items {
  margin-top: 2px;
}

.palette-tabs {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  margin-bottom: 8px;
}

.palette-tab-btn {
  flex: 0 0 auto;
  min-width: 52px;
  border: 1px solid #dbe2f0;
  border-bottom: none;
  border-radius: 10px 10px 0 0;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
  color: #475569;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.1;
  padding: 6px 12px 5px;
  cursor: pointer;
  margin-bottom: -1px;
  transition: background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.palette-tab-btn:hover {
  color: #1e293b;
  border-color: #bfdbfe;
  background: linear-gradient(180deg, #ffffff 0%, #eff6ff 100%);
}

.palette-tab-btn.active {
  border-color: #93c5fd;
  background: #ffffff;
  color: #1d4ed8;
  box-shadow: 0 -1px 0 rgba(147, 197, 253, 0.25);
}

.palette-item,
.workflow-list-item {
  width: 100%;
  text-align: left;
  border: 1px solid #dbe2f0;
  border-radius: 8px;
  background: #ffffff;
  cursor: grab;
  padding: 7px 10px;
  margin-bottom: 2px;
  position: relative;
}

.palette-item {
  user-select: none;
  display: flex;
  flex-direction: column;
}

.workflow-list-item,
.workflow-list-main {
  cursor: pointer;
}

.workflow-list-item {
  display: flex;
  align-items: flex-start;
}

.palette-item:hover,
.workflow-list-item:hover,
.workflow-list-item.active {
  border-color: #93c5fd;
  background: #eff6ff;
}

.workflow-list-item.selected {
  border-color: #60a5fa;
  box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.32);
}

.palette-item:active {
  cursor: grabbing;
}

.palette-item.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.palette-item-title,
.workflow-list-name {
  display: block;
  font-size: 12px;
  font-weight: 700;
}

.palette-item-desc,
.workflow-list-meta {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}

.assistant-drag-preview {
  position: fixed;
  z-index: 1000;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #93c5fd;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.96);
  color: #0f172a;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.16);
  pointer-events: none;
  transform: translate(14px, 14px);
}

.assistant-drag-preview.over {
  border-color: #2563eb;
  background: rgba(239, 246, 255, 0.98);
}

.assistant-drag-preview-text {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 700;
}

.workflow-canvas {
  width: 100%;
  flex: 1;
  min-height: 480px;
  min-width: 0;
}

.canvas-tip {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 12px;
  z-index: 4;
  background: rgba(15, 23, 42, 0.82);
  color: #ffffff;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12px;
}

.panel-resizer {
  position: relative;
  height: 100%;
  width: 100%;
  z-index: 6;
  cursor: col-resize;
  background: linear-gradient(180deg, transparent 0%, rgba(148, 163, 184, 0.18) 20%, rgba(148, 163, 184, 0.18) 80%, transparent 100%);
}

.panel-resizer::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 120px;
  border-radius: 999px;
  background: #cbd5e1;
  transform: translate(-50%, -50%);
}

.panel-resizer:hover::before {
  background: #2563eb;
}

.panel-collapse-handle {
  position: absolute;
  top: 50%;
  z-index: 7;
  border: 1px solid #cbd5e1;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 999px;
  width: 28px;
  height: 64px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #334155;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
  transform: translateY(-50%);
}

.panel-collapse-handle-left {
  right: -14px;
}

.panel-collapse-handle-right {
  left: -14px;
}

.panel-collapse-handle.collapsed {
  top: 50%;
}

.canvas-panel .panel-collapse-handle-left.collapsed {
  left: 10px;
  right: auto;
}

.canvas-panel .panel-collapse-handle-right.collapsed {
  right: 10px;
  left: auto;
}

.panel-collapse-handle:hover {
  border-color: #93c5fd;
  background: #eff6ff;
}

.panel-collapse-handle-arrow {
  font-size: 16px;
  line-height: 1;
  font-weight: 700;
}

.canvas-editor-tools,
.canvas-editor-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar-group.compact {
  gap: 6px;
}

.toolbar-section {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar-section-title {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: #dbe2f0;
  flex: 0 0 auto;
}

.canvas-tool-item {
  min-width: 72px;
  padding: 6px 10px;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  background: #eff6ff;
  color: #1d4ed8;
  cursor: grab;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.canvas-tool-item.end {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.canvas-tool-item:active {
  cursor: grabbing;
}

.canvas-tool-item.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.canvas-tool-item-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
}

.icon-btn {
  width: 30px;
  height: 30px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.toolbar-icon {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.stroke-icon {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.minimap-toggle-btn {
  color: #334155;
}

.minimap-toggle-btn.inactive {
  color: #94a3b8;
  background: #f8fafc;
}

.canvas-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: 10px 12px 8px;
  position: relative;
  z-index: 5;
  border-bottom: 1px solid #dbe2f0;
  background: rgba(255, 255, 255, 0.96);
  flex-wrap: wrap;
  box-shadow: inset 0 -1px 0 rgba(226, 232, 240, 0.85);
}

.canvas-toolbar::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: -1px;
  height: 1px;
  background: linear-gradient(90deg, rgba(203, 213, 225, 0), rgba(203, 213, 225, 0.95) 10%, rgba(203, 213, 225, 0.95) 90%, rgba(203, 213, 225, 0));
  pointer-events: none;
}

.workflow-debug-dock {
  border-bottom: 1px solid #dbe2f0;
  background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workflow-debug-dock-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.workflow-debug-dock-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.workflow-debug-dock-subtitle {
  margin-top: 2px;
  font-size: 11px;
  color: #64748b;
}

.workflow-debug-dock-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.workflow-debug-dock-status {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 7px;
  background: #e2e8f0;
  color: #334155;
  font-size: 10px;
  font-weight: 700;
}

.workflow-debug-dock-status.running {
  background: #dbeafe;
  color: #1d4ed8;
}

.workflow-debug-dock-status.paused {
  background: #fef3c7;
  color: #b45309;
}

.workflow-debug-dock-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.workflow-debug-card {
  border: 1px solid #dbe2f0;
  border-radius: 10px;
  background: #ffffff;
  padding: 8px;
}

.workflow-debug-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.workflow-debug-card-title {
  font-size: 11px;
  font-weight: 700;
  color: #0f172a;
}

.workflow-debug-meta {
  margin-top: 4px;
  font-size: 10px;
  color: #64748b;
}

.workflow-debug-placeholder {
  margin-top: 6px;
  font-size: 11px;
  color: #64748b;
}

.workflow-debug-pre {
  margin: 6px 0 0;
  padding: 8px;
  max-height: 150px;
  overflow: auto;
  border-radius: 8px;
  background: #0f172a;
  color: #e2e8f0;
  font-family: ui-monospace, monospace;
  font-size: 10px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
}

.workflow-debug-pre.compact {
  max-height: 96px;
}

.workflow-debug-json-details {
  margin-top: 4px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  overflow: hidden;
}

.workflow-debug-json-details summary {
  padding: 5px 8px;
  font-size: 10px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  user-select: none;
}

.workflow-debug-json-details summary:hover {
  color: #1e293b;
}

.workflow-debug-json-details .workflow-debug-pre {
  margin: 0;
  border-radius: 0;
  max-height: 200px;
  overflow: auto;
}

.workflow-debug-edit-input {
  min-height: 74px;
  font-size: 11px;
  line-height: 1.35;
  padding: 8px 10px;
}

.workflow-debug-inline-actions {
  margin-top: 6px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.workflow-debug-dock .tiny {
  padding: 4px 7px;
  font-size: 11px;
}

.workflow-debug-parents {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workflow-debug-var-list {
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.workflow-debug-var-item {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  padding: 8px;
}

.workflow-debug-var-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.workflow-debug-var-key {
  font-family: ui-monospace, monospace;
  font-size: 10px;
  font-weight: 700;
  color: #0f172a;
}

.workflow-debug-var-type {
  font-size: 9px;
  border-radius: 999px;
  padding: 2px 6px;
  background: #dbeafe;
  color: #1d4ed8;
}

.workflow-debug-var-label {
  margin-top: 4px;
  font-size: 10px;
  color: #64748b;
}

.workflow-debug-parent-item + .workflow-debug-parent-item {
  border-top: 1px solid #e2e8f0;
  padding-top: 8px;
}

.workflow-debug-parent-title {
  font-size: 11px;
  font-weight: 600;
  color: #334155;
}

.workflow-debug-expand-btn {
  align-self: flex-start;
  margin: 8px 10px 0;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
  color: #1d4ed8;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
}

.canvas-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding: 10px 12px 0;
  border-bottom: 1px solid #e2e8f0;
  background: rgba(255, 255, 255, 0.98);
}

.canvas-tab {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 120px;
  max-width: 220px;
  border: 1px solid #dbe2f0;
  border-bottom: none;
  border-radius: 12px 12px 0 0;
  background: #f8fafc;
  color: #475569;
  padding: 0 8px 0 10px;
}

.canvas-tab.active {
  background: #ffffff;
  color: #0f172a;
}

.canvas-tab-main {
  min-width: 0;
  flex: 1;
  border: none;
  background: transparent;
  padding: 8px 0;
  text-align: left;
  cursor: pointer;
}

.canvas-tab-name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 700;
}

.canvas-tab-close {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  line-height: 1;
}

.canvas-tab-close:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.canvas-node {
  position: relative;
  min-width: 96px;
  max-width: 160px;
  padding: 6px 10px;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12);
  overflow: visible;
  transition: box-shadow 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}

::deep(.vue-flow__node) {
  padding: 0 !important;
  border: none !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

::deep(.vue-flow__node.selected),
::deep(.vue-flow__node:focus),
::deep(.vue-flow__node:focus-visible),
::deep(.vue-flow__node:active) {
  outline: none !important;
  border: none !important;
  box-shadow: none !important;
}

.canvas-node-start,
.canvas-node-end {
  min-width: 0;
  min-height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0 8px;
}

.canvas-node-start {
  background: linear-gradient(135deg, #eff6ff, #bfdbfe);
  border: 2px solid #2563eb;
}

.canvas-node-end {
  background: linear-gradient(135deg, #fef2f2, #fecaca);
  border: 2px solid #dc2626;
}

.canvas-node-start-label,
.canvas-node-end-label {
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
  cursor: text;
  line-height: 1.1;
}

.canvas-node-start-label {
  color: #1e3a8a;
}

.canvas-node-end-label {
  color: #991b1b;
}

.canvas-node-assistant {
  min-height: 32px;
  border: 1px solid #93c5fd;
  background: #ffffff;
}

.canvas-node-assistant.selected {
  border-color: #2563eb;
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.16);
}

.canvas-node-tool {
  min-height: 72px;
  border: 1px solid #c4b5fd;
  background: linear-gradient(180deg, #ffffff 0%, #f5f3ff 100%);
}

.canvas-node-tool.selected {
  border-color: #7c3aed;
  box-shadow: 0 8px 18px rgba(124, 58, 237, 0.16);
}

.canvas-node.breakpoint::after {
  content: '';
  position: absolute;
  top: -5px;
  right: -5px;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #ef4444;
  box-shadow: 0 0 0 2px #ffffff;
}

.canvas-node.debug-running {
  transform: translateY(-1px);
}

.canvas-node-assistant.debug-running,
.canvas-node-tool.debug-running {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.22), 0 10px 22px rgba(59, 130, 246, 0.16);
}

.canvas-node-assistant.debug-paused,
.canvas-node-tool.debug-paused {
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.28), 0 12px 26px rgba(245, 158, 11, 0.18);
}

.canvas-node.debug-completed {
  opacity: 0.92;
}

.canvas-node.debug-failed {
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.22), 0 12px 26px rgba(239, 68, 68, 0.16);
}

.canvas-node-body {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  min-width: 0;
}

.canvas-node-kind-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.canvas-node-kind-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.canvas-node-kind {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 700;
}

.canvas-node-tool .canvas-node-kind {
  background: rgba(124, 58, 237, 0.12);
  color: #6d28d9;
}

.canvas-node-icon-text {
  font-size: 11px;
  font-weight: 800;
  color: #475569;
}

.canvas-node-breakpoint-btn {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #ffffff;
  color: #cbd5e1;
  font-size: 10px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.canvas-node-breakpoint-btn.active {
  border-color: #ef4444;
  background: #fee2e2;
  color: #dc2626;
}

.canvas-node-icon-image {
  width: 18px;
  height: 18px;
  object-fit: contain;
  flex: 0 0 auto;
}

.canvas-node-start.selected,
.canvas-node-end.selected {
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.16);
}

.canvas-node-title {
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: text;
}

.canvas-node-title.compact {
  text-align: center;
}

.canvas-node-subtitle {
  font-size: 11px;
  color: #6b7280;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.canvas-node-input-hint,
.canvas-node-output-hint {
  font-size: 10px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.canvas-node-output-hint {
  color: #7c3aed;
}

.canvas-node-debug-badge {
  margin-top: 4px;
  align-self: flex-start;
  padding: 2px 6px;
  border-radius: 999px;
  background: #e2e8f0;
  color: #334155;
  font-size: 10px;
  font-weight: 600;
}

.canvas-node-progress {
  margin-top: 4px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.canvas-node-progress-bar {
  width: 100%;
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: #dbe2f0;
}

.canvas-node-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #60a5fa, #2563eb);
  transition: width 160ms ease;
}

.canvas-node-progress.paused .canvas-node-progress-fill {
  background: linear-gradient(90deg, #fbbf24, #f59e0b);
}

.canvas-node-progress-text {
  font-size: 10px;
  line-height: 1.2;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.canvas-node.debug-running .canvas-node-debug-badge {
  background: #dbeafe;
  color: #1d4ed8;
}

.canvas-node.debug-paused .canvas-node-debug-badge {
  background: #fef3c7;
  color: #b45309;
}

.canvas-node.debug-failed .canvas-node-debug-badge {
  background: #fee2e2;
  color: #b91c1c;
}

.canvas-node-rename-input {
  width: 100%;
  min-width: 0;
  border: 1px solid #60a5fa;
  border-radius: 8px;
  background: #ffffff;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
  text-align: center;
  outline: none;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.canvas-node-rename-input-start,
.canvas-node-rename-input-end {
  width: auto;
  min-width: 52px;
  max-width: 120px;
  border-radius: 999px;
}

::deep(.vue-flow__resize-control.handle) {
  width: 10px;
  height: 10px;
  border: 2px solid #ffffff;
  border-radius: 999px;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.18);
}

::deep(.vue-flow__resize-control.line) {
  opacity: 0;
  border-color: transparent;
  background: transparent;
}

:deep(.canvas-handle) {
  width: 9px;
  height: 9px;
  border: 2px solid #ffffff;
  background: #2563eb;
  box-shadow: 0 1px 4px rgba(37, 99, 235, 0.24);
  z-index: 4;
}

:deep(.canvas-handle.vue-flow__handle-left) {
  left: -6px;
}

:deep(.canvas-handle.vue-flow__handle-right) {
  right: -6px;
}

:deep(.canvas-handle-start) {
  background: #1d4ed8;
}

:deep(.canvas-handle-end) {
  background: #dc2626;
}

.sidebar-panel {
  overflow: hidden;
}

.canvas-workspace {
  position: relative;
  flex: 1;
  min-height: 0;
  border-top: 1px solid rgba(241, 245, 249, 0.92);
}

.workflow-welcome {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  border-top: 1px solid rgba(241, 245, 249, 0.92);
}

.workflow-welcome-card {
  width: min(560px, 100%);
  padding: 28px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff, #f8fbff);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.08);
}

.workflow-welcome-title {
  font-size: 22px;
  font-weight: 800;
  color: #0f172a;
}

.workflow-welcome-desc {
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.6;
  color: #64748b;
}

.workflow-welcome-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
  flex-wrap: wrap;
}

.workflow-welcome-list {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workflow-welcome-item {
  width: 100%;
  text-align: left;
  border: 1px solid #dbe2f0;
  border-radius: 12px;
  background: #ffffff;
  padding: 10px 12px;
  cursor: pointer;
}

.workflow-welcome-item:hover {
  border-color: #93c5fd;
  background: #eff6ff;
}

.workflow-welcome-item-name {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.workflow-welcome-item-desc {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}

.workflow-tab-context-menu {
  position: fixed;
  z-index: 1400;
  min-width: 140px;
  padding: 6px;
  border: 1px solid #dbe2f0;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 20px 36px rgba(15, 23, 42, 0.18);
}

.workflow-node-context-menu {
  position: fixed;
  z-index: 1400;
  min-width: 140px;
  padding: 6px;
  border: 1px solid #dbe2f0;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 20px 36px rgba(15, 23, 42, 0.18);
}

.workflow-tab-context-item {
  width: 100%;
  text-align: left;
  border: none;
  border-radius: 8px;
  background: transparent;
  padding: 8px 10px;
  font-size: 13px;
  color: #0f172a;
  cursor: pointer;
}

.workflow-tab-context-item:hover {
  background: #eff6ff;
}

.workflow-tab-context-item.danger {
  color: #b91c1c;
}

.workflow-tab-context-item.danger:hover {
  background: #fef2f2;
}

.workflow-list-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex: 0 0 auto;
  padding: 0 0 8px;
  position: relative;
  z-index: 3;
  background: rgba(255, 255, 255, 0.98);
  border-bottom: 1px solid #eef2f7;
}

.workflow-list-toolbar::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 1px;
  background: linear-gradient(90deg, rgba(226, 232, 240, 0), rgba(226, 232, 240, 0.92) 14%, rgba(226, 232, 240, 0.92) 86%, rgba(226, 232, 240, 0));
  pointer-events: none;
}

.workflow-list-toolbar-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
}

.workflow-list-toolbar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
}

.workflow-list-toolbar-title {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.workflow-list-toolbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.workflow-list-toolbar-search {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  flex-wrap: wrap;
}

.workflow-search-input {
  flex: 1;
  min-width: 0;
}

.workflow-select-all {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
  user-select: none;
}

.workflow-select-all input {
  margin: 0;
}

.workflow-list-toolbar .icon-btn {
  width: 28px;
  height: 28px;
}

.workflow-list-toolbar .primary-btn.icon-btn,
.workflow-list-toolbar .ghost-btn.icon-btn,
.workflow-list-toolbar .danger-btn.icon-btn {
  padding: 0;
}

.workflow-import-input {
  display: none;
}

.workflow-list-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workflow-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.36);
  padding: 20px;
}

.workflow-modal {
  width: min(460px, 100%);
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
  overflow: hidden;
}

.workflow-modal-header,
.workflow-modal-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
}

.workflow-modal-header {
  border-bottom: 1px solid #e2e8f0;
}

.workflow-modal-title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.workflow-modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
}

.workflow-modal-textarea {
  min-height: 96px;
  resize: vertical;
}

.tool-config-modal {
  width: min(560px, 100%);
}

.tool-config-textarea {
  min-height: 88px;
}

.workflow-checkbox-row {
  margin-top: 10px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #334155;
}

.workflow-token-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.workflow-token-btn {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 1.2;
}

.workflow-input-preview {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f1f5f9;
  font-size: 12px;
  color: #475569;
}

.workflow-input-preview-label {
  font-weight: 600;
  margin-right: 6px;
}

.workflow-input-preview-value {
  word-break: break-all;
}

.workflow-debug-section {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid #e2e8f0;
}

.workflow-debug-desc {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 10px;
}

.workflow-debug-row {
  margin-bottom: 10px;
}

.workflow-debug-row:last-of-type {
  margin-bottom: 12px;
}

.workflow-debug-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #475569;
  margin-bottom: 4px;
}

.workflow-debug-textarea {
  min-height: 64px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
}

.workflow-debug-result,
.workflow-debug-extras {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f8fafc;
  font-size: 12px;
}

.workflow-debug-result-label {
  font-weight: 600;
  color: #475569;
  margin-right: 6px;
}

.workflow-debug-result-value {
  margin: 6px 0 0;
  padding: 0;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-all;
  color: #334155;
}

.workflow-debug-condition {
  color: #0f172a;
}

.path-analysis-modal {
  width: min(520px, 100%);
}

.path-analysis-error {
  padding: 12px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 13px;
}

.path-analysis-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #f8fafc;
}

.path-analysis-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.path-analysis-stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.path-analysis-stat-label {
  font-size: 11px;
  color: #64748b;
}

.path-analysis-verdict {
  margin-left: auto;
  font-size: 13px;
  font-weight: 600;
}

.path-analysis-verdict.ok {
  color: #059669;
}

.path-analysis-verdict.warn {
  color: #d97706;
}

.path-analysis-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.path-analysis-item {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
}

.path-analysis-item.path-dead {
  border-color: #fecaca;
  background: #fef2f2;
}

.path-analysis-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.path-analysis-item-badge {
  font-weight: 700;
  font-size: 14px;
}

.path-analysis-item:not(.path-dead) .path-analysis-item-badge {
  color: #059669;
}

.path-analysis-item.path-dead .path-analysis-item-badge {
  color: #dc2626;
}

.path-analysis-item-title {
  font-weight: 600;
  font-size: 13px;
  color: #334155;
}

.path-analysis-item-reason {
  margin-left: auto;
  font-size: 11px;
  color: #b91c1c;
}

.path-analysis-item-nodes {
  font-size: 12px;
  color: #64748b;
  word-break: break-all;
}

.path-analysis-item-branches {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.path-branch-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #e0e7ff;
  color: #4338ca;
}

.workflow-edge-hint {
  margin-top: 12px;
  padding: 8px 10px;
  background: #eff6ff;
  border-radius: 8px;
  color: #1d4ed8;
}

.workflow-modal-error {
  margin-top: 10px;
  font-size: 12px;
  color: #b91c1c;
}

.workflow-modal-actions {
  justify-content: flex-end;
  border-top: 1px solid #e2e8f0;
}

.export-workflow-modal,
.import-conflict-modal {
  width: min(520px, 100%);
}

.export-scope-list {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.export-package-textarea {
  min-height: 80px;
}

.export-scope-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
  color: #0f172a;
  cursor: pointer;
}

.export-scope-item.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.export-scope-item input {
  margin: 0;
}

.export-scope-label {
  font-size: 13px;
  font-weight: 600;
}

.import-conflict-desc {
  font-size: 13px;
  color: #475569;
  line-height: 1.6;
}

.import-bundle-meta {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  font-size: 12px;
  color: #64748b;
}

.import-summary-grid {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.import-summary-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.import-summary-value {
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
}

.import-summary-label {
  font-size: 12px;
  color: #64748b;
}

.export-summary-grid {
  margin-top: 16px;
}

.import-conflict-list {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow: auto;
}

.import-conflict-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.import-conflict-name {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.import-conflict-target,
.import-conflict-hint {
  font-size: 12px;
  color: #64748b;
  line-height: 1.6;
}

.import-conflict-hint {
  margin-top: 14px;
}

.import-conflict-actions {
  gap: 8px;
}

.import-result-modal {
  width: min(560px, 100%);
}

.import-result-actions {
  gap: 8px;
}

.import-result-section {
  margin-top: 16px;
}

.import-result-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.import-result-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 180px;
  overflow: auto;
}

.import-result-item {
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  font-size: 12px;
  color: #334155;
}

.workflow-list-main {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  padding: 0;
  text-align: left;
  cursor: pointer;
}

.workflow-list-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
  flex: 0 0 auto;
}

.workflow-list-check {
  display: inline-flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 2px;
  margin-right: 8px;
  flex: 0 0 auto;
}

.workflow-list-check input {
  margin: 0;
}

.workflow-list-delete-btn {
  width: 28px;
  height: 28px;
}

.workflow-list-empty {
  padding: 14px 10px;
  font-size: 12px;
  color: #94a3b8;
  text-align: center;
}

.sidebar-section {
  border: none;
  border-radius: 0;
  padding: 0;
}

.field-label {
  display: block;
  margin: 10px 0 6px;
  font-size: 12px;
  color: #475569;
  font-weight: 600;
}

.meta-row,
.status-inline,
.empty-inline {
  font-size: 12px;
  color: #475569;
  margin-top: 8px;
}

.status-inline.error {
  color: #b91c1c;
}

.branch-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.branch-item {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px;
  background: #f8fafc;
}

.branch-target {
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 8px;
}

.primary-btn,
.success-btn,
.ghost-btn,
.danger-btn {
  border: none;
  border-radius: 10px;
  padding: 9px 14px;
  font-size: 13px;
  cursor: pointer;
}

.primary-btn {
  background: #2563eb;
  color: #ffffff;
}

.success-btn {
  background: #16a34a;
  color: #ffffff;
}

.ghost-btn {
  background: #eef2ff;
  color: #334155;
}

.danger-btn {
  background: #fee2e2;
  color: #b91c1c;
}

.small {
  padding: 8px 10px;
}

.tiny {
  padding: 6px 8px;
  font-size: 12px;
}

:deep(.vue-flow__edge-path) {
  stroke-width: 2.2px;
  stroke: #3b82f6;
}

:deep(.vue-flow__edge.selected .vue-flow__edge-path) {
  stroke: #1d4ed8;
}

:deep(.vue-flow__edge.workflow-edge-incoming .vue-flow__edge-path) {
  stroke: #f59e0b;
  stroke-width: 3px;
  stroke-dasharray: 8 6;
  animation: workflow-edge-flow 1.2s linear infinite;
}

@keyframes workflow-edge-flow {
  from {
    stroke-dashoffset: 0;
  }
  to {
    stroke-dashoffset: 14;
  }
}

:deep(.vue-flow__edge.workflow-edge-taken .vue-flow__edge-path) {
  stroke: #2563eb;
  stroke-width: 3px;
}

:deep(.vue-flow__edge.workflow-edge-skipped .vue-flow__edge-path) {
  stroke: #cbd5e1;
  stroke-dasharray: 6 4;
}

:deep(.vue-flow__edge-textbg) {
  fill: #ffffff;
}

:deep(.vue-flow__edge-text) {
  fill: #1e3a8a;
  font-size: 12px;
  font-weight: 700;
}

:deep(.vue-flow__controls) {
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.14);
  border-radius: 12px;
  overflow: hidden;
}

:deep(.vue-flow__minimap) {
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #dbe2f0;
  border-radius: 12px;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
}

.workflow-list-section {
  min-height: 240px;
}

.canvas-selection-panel {
  position: absolute;
  right: 14px;
  bottom: 54px;
  z-index: 6;
  width: 300px;
  max-width: calc(100% - 28px);
  padding: 12px;
  border-radius: 14px;
  border: 1px solid #dbe2f0;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.16);
}

.canvas-selection-panel.edge {
  width: 240px;
}

.canvas-selection-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.canvas-selection-meta {
  margin-top: 6px;
  font-size: 12px;
  color: #475569;
}

.canvas-selection-input {
  margin-top: 8px;
}

.canvas-selection-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 10px;
}

.branch-list.compact {
  margin-top: 10px;
  max-height: 180px;
  overflow: auto;
}

@media (max-width: 1100px) {
  .workflow-form {
    grid-template-columns: 1fr;
  }

  .workflow-topbar {
    flex-direction: column;
    align-items: stretch;
  }

  .workflow-main,
  .workflow-main.left-collapsed,
  .workflow-main.right-collapsed,
  .workflow-main.left-collapsed.right-collapsed {
    grid-template-columns: 1fr;
  }

  .import-summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
