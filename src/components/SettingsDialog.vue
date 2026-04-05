<template>
  <div class="settings-dialog">
    <div v-if="initError" class="init-error">
      <p>加载失败：{{ initError }}</p>
      <p class="hint">请刷新或重新打开设置</p>
    </div>
    <template v-else>
    <div class="dialog-body">
      <!-- 三列布局 -->
      <div class="settings-layout">
        <!-- 第一列：主菜单 -->
        <div class="settings-column column-1">
          <div class="menu-list">
            <div
              v-for="item in mainMenuItems"
              :key="item.key"
              class="menu-item"
              :class="{ active: activeMainMenu === item.key }"
              @click="selectMainMenu(item.key)"
            >
              <img
                v-if="isSettingsMainMenuIconAsset(item.icon)"
                :src="getImageSrc(item.icon)"
                class="menu-icon menu-icon-asset"
                alt=""
                @error="handleImageError"
              />
              <span v-else class="menu-icon">{{ item.icon }}</span>
              <span class="menu-label">{{ item.label }}</span>
            </div>
          </div>
        </div>

        <!-- 第二列：模型清单 / 分类 -->
        <div class="settings-column column-2">
          <!-- 模型设置 → 第二级：模型清单（本地+在线，支持对话/嵌入/图像） -->
          <div v-if="activeMainMenu === 'model-settings'" class="model-list-container">
            <div class="search-box">
              <input
                v-model="modelInventorySearch"
                type="text"
                placeholder="搜索..."
                class="search-input"
              />
            </div>
            <div class="inventory-list" ref="inventoryListRef">
              <div
                v-for="(item, index) in filteredModelInventory"
                :key="item.id"
                class="inventory-row-wrap"
              >
                <div
                  v-if="dragState.dropIndex === index && dragState.dropPosition === 'before'"
                  class="inventory-insert-line"
                />
                <div
                  class="inventory-row inventory-row-draggable"
                  :class="{
                    active: selectedModelId === item.id,
                    'inventory-row-dragging': dragState.fromIndex === index
                  }"
                  draggable="true"
                  @click="selectModel(item)"
                  @contextmenu.prevent="item.isCustom && showContextMenu($event, item)"
                  @dragstart="onDragStart($event, index)"
                  @dragover.prevent="onDragOver($event, index)"
                  @dragleave="onDragLeave($event, index)"
                  @drop.prevent="onDrop($event, index)"
                  @dragend="onDragEnd"
                >
                  <span class="inventory-drag-handle" title="拖动排序">⋮⋮</span>
                  <img
                    v-if="item.icon"
                    :src="getIconSrc(item)"
                    :alt="item.name"
                    class="inventory-icon"
                    @error="handleImageError"
                  />
                  <span class="inventory-name">{{ item.name }}</span>
                  <label class="switch switch-inline" @click.stop>
                    <input
                      type="checkbox"
                      :checked="getModelEnabled(item.id)"
                      @change="toggleModelEnabled(item, $event)"
                    />
                    <span class="slider"></span>
                  </label>
                </div>
                <div
                  v-if="dragState.dropIndex === index && dragState.dropPosition === 'after'"
                  class="inventory-insert-line"
                />
              </div>
            </div>
            <div class="inventory-row inventory-row-add" @click="openAddModelDialog">
              <span class="inventory-add-icon">+</span>
              <span class="inventory-name">添加</span>
            </div>
          </div>

          <!-- 默认设置 → 模型设置项列表（点击后在右侧显示对应设置） -->
          <div v-else-if="activeMainMenu === 'default-settings'" class="default-settings-list-container">
            <div class="column-title">模型设置项</div>
            <div class="default-settings-list">
              <div
                v-for="item in defaultSettingsItems"
                :key="item.key"
                class="default-settings-item"
                :class="{ active: activeDefaultSettingItem === item.key }"
                @click="selectDefaultSettingItem(item)"
              >
                <span class="item-icon">{{ item.icon }}</span>
                <span class="item-label">{{ item.label }}</span>
              </div>
            </div>
          </div>

          <div v-else-if="activeMainMenu === 'assistant-settings'" class="default-settings-list-container">
            <div class="assistant-settings-toolbar">
              <div class="column-title assistant-settings-toolbar-title">助手设置项</div>
              <button type="button" class="btn btn-secondary btn-compact assistant-import-btn" @click="triggerAssistantImport">
                导入助手
              </button>
              <input
                ref="assistantImportInputRef"
                type="file"
                accept=".json,application/json"
                class="icon-file-input"
                @change="onAssistantImportFileChange"
              />
            </div>
            <div
              v-for="group in assistantSettingGroups"
              :key="group.key"
              class="assistant-settings-group"
            >
              <div class="assistant-settings-group-title-row">
                <div class="assistant-settings-group-title">{{ group.label }}</div>
                <div class="assistant-settings-group-hint">可拖拽排序，右键菜单可复制、删除、上移、下移</div>
              </div>
              <div
                class="default-settings-list assistant-settings-list"
                :class="{ 'assistant-settings-list-dragging': assistantDragState.groupKey === group.key }"
              >
                <div
                  v-for="item in group.items"
                  :key="item.key"
                >
                  <div
                    v-if="assistantDragState.groupKey === group.key && assistantDragState.dropKey === item.key && assistantDragState.dropPosition === 'before'"
                    class="assistant-insert-line"
                  />
                  <div
                    class="default-settings-item assistant-settings-item"
                    :class="{
                      active: activeAssistantSettingItem === item.key,
                      'assistant-settings-item-draggable': isAssistantSettingReorderable(item),
                      'assistant-settings-item-dragging': assistantDragState.fromKey === item.key
                    }"
                    :draggable="isAssistantSettingReorderable(item)"
                    @click="selectAssistantSettingItem(item)"
                    @contextmenu.prevent="item.type !== 'create-custom-assistant' && showAssistantContextMenu($event, item)"
                    @dragstart="onAssistantDragStart($event, group.key, item)"
                    @dragover.prevent="onAssistantDragOver($event, group.key, item)"
                    @dragleave="onAssistantDragLeave($event, group.key, item)"
                    @drop.prevent="onAssistantDrop($event, group.key, item)"
                    @dragend="onAssistantDragEnd"
                  >
                    <span class="item-icon">
                      <img
                        v-if="isAssistantIconImage(item.icon)"
                        :src="getAssistantIconSrc(item.icon)"
                        class="assistant-icon-image"
                        alt=""
                      />
                      <span v-else>{{ item.icon }}</span>
                    </span>
                    <span class="item-label">{{ item.shortLabel || item.label }}</span>
                  </div>
                  <div
                    v-if="assistantDragState.groupKey === group.key && assistantDragState.dropKey === item.key && assistantDragState.dropPosition === 'after'"
                    class="assistant-insert-line"
                  />
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="activeMainMenu === 'backup-history'" class="default-settings-list-container">
            <div class="assistant-settings-toolbar">
              <div class="column-title assistant-settings-toolbar-title">历史版本列表</div>
              <button type="button" class="btn btn-secondary btn-compact assistant-import-btn" @click="loadBackupHistoryRecords">
                刷新
              </button>
            </div>
            <div class="backup-history-filters">
              <input
                v-model="backupHistorySearchText"
                type="text"
                class="config-input backup-history-search"
                placeholder="搜索文档名、路径、任务或助手"
              />
              <select v-model="backupHistoryReasonFilter" class="config-input backup-history-filter-select">
                <option value="">全部原因</option>
                <option value="document-processing-apply">文档处理写回前备份</option>
                <option value="document-operation-apply">文档操作执行前备份</option>
                <option value="assistant-task-apply">助手任务写回前备份</option>
              </select>
            </div>
            <div v-if="filteredBackupHistoryRecords.length === 0" class="backup-history-empty">
              当前筛选条件下没有可恢复的文档备份记录
            </div>
            <div v-else class="default-settings-list backup-history-list">
              <div
                v-for="item in filteredBackupHistoryRecords"
                :key="item.id"
                class="default-settings-item backup-history-item"
                :class="{ active: selectedBackupRecordId === item.id }"
                @click="selectBackupRecord(item)"
              >
                <div class="backup-history-item-body">
                  <div class="backup-history-item-title">{{ item.documentName || '未命名文档' }}</div>
                  <div class="backup-history-item-meta">
                    <span>{{ formatBackupRecordTime(item.createdAt) }}</span>
                    <span>{{ getBackupReasonLabel(item.reason) }}</span>
                  </div>
                  <div class="backup-history-item-meta">
                    <span>{{ item.assistantId || '无助手 ID' }}</span>
                    <span>{{ item.taskId || '无任务 ID' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="activeMainMenu === 'evaluation-history'" class="default-settings-list-container">
            <div class="assistant-settings-toolbar">
              <div class="column-title assistant-settings-toolbar-title">评测记录列表</div>
              <button type="button" class="btn btn-secondary btn-compact assistant-import-btn" @click="loadEvaluationHistoryRecords">
                刷新
              </button>
            </div>
            <div class="backup-history-filters">
              <input
                v-model="evaluationHistorySearchText"
                type="text"
                class="config-input backup-history-search"
                placeholder="搜索标题、摘要、输入或输出"
              />
              <select v-model="evaluationHistoryScenarioFilter" class="config-input backup-history-filter-select">
                <option value="">全部场景</option>
                <option value="chat">普通聊天</option>
                <option value="document">文档任务</option>
                <option value="assistant">助手版本</option>
              </select>
            </div>
            <div v-if="evaluationDashboard" class="backup-history-task-summary">
              <div class="backup-history-task-line">总记录数：{{ evaluationDashboard.totalCount || 0 }}</div>
              <div class="backup-history-task-line">平均得分：{{ formatEvaluationScore(evaluationDashboard.averageScore) }}</div>
              <div class="backup-history-task-line">待复核：{{ evaluationDashboard.reviewCount || 0 }}；门禁拦截：{{ evaluationDashboard.blockedCount || 0 }}</div>
              <div class="backup-history-task-line">回归记录：{{ evaluationDashboard.regressionCount || 0 }}</div>
              <div class="backup-history-task-line">
                样本分布：{{
                  (evaluationDashboard.sampleSummary || []).map(item => `${item.key}:${item.count}`).join('；') || '未记录'
                }}
              </div>
            </div>
            <div v-if="filteredEvaluationHistoryRecords.length === 0" class="backup-history-empty">
              当前筛选条件下没有评测记录
            </div>
            <div v-else class="default-settings-list backup-history-list">
              <div
                v-for="item in filteredEvaluationHistoryRecords"
                :key="item.id"
                class="default-settings-item backup-history-item"
                :class="{ active: selectedEvaluationRecordId === item.id }"
                @click="selectEvaluationRecord(item)"
              >
                <div class="backup-history-item-body">
                  <div class="backup-history-item-title">{{ item.title || '未命名评测' }}</div>
                  <div class="backup-history-item-meta">
                    <span>{{ formatBackupRecordTime(item.createdAt) }}</span>
                    <span>{{ getEvaluationScenarioLabel(item.scenarioType) }}</span>
                    <span>{{ formatEvaluationScore(item.score) }}</span>
                  </div>
                  <div class="backup-history-item-meta">
                    <span>{{ item.ownerType || '无归属类型' }}</span>
                    <span>{{ item.ownerId || '无归属 ID' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="activeMainMenu === 'capability-audit'" class="default-settings-list-container">
            <div class="assistant-settings-toolbar">
              <div class="column-title assistant-settings-toolbar-title">能力调用审计</div>
              <div class="backup-history-task-actions">
                <button type="button" class="btn btn-secondary btn-compact assistant-import-btn" @click="loadCapabilityAuditRecords">
                  刷新
                </button>
                <button type="button" class="btn btn-secondary btn-compact" @click="exportCapabilityAuditSnapshot">
                  导出
                </button>
                <button type="button" class="btn btn-secondary btn-compact" @click="exportCapabilityManifestSnapshot">
                  导出 Manifest
                </button>
              </div>
            </div>
            <div class="backup-history-filters">
              <input
                v-model="capabilityAuditSearchText"
                type="text"
                class="config-input backup-history-search"
                placeholder="搜索能力、参数、结果或错误"
              />
              <select v-model="capabilityAuditNamespaceFilter" class="config-input backup-history-filter-select">
                <option value="">全部命名空间</option>
                <option value="wps">WPS 原生</option>
                <option value="utility">Utility 扩展</option>
              </select>
              <select v-model="capabilityAuditStatusFilter" class="config-input backup-history-filter-select">
                <option value="">全部状态</option>
                <option value="completed">已完成</option>
                <option value="failed">失败</option>
                <option value="cancelled">已取消</option>
              </select>
              <select v-model="capabilityAuditRiskFilter" class="config-input backup-history-filter-select">
                <option value="">全部风险</option>
                <option value="low">低风险</option>
                <option value="medium">中风险</option>
                <option value="high">高风险</option>
              </select>
            </div>
            <div v-if="capabilityAuditSummary" class="backup-history-task-summary">
              <div class="backup-history-task-line">总调用：{{ capabilityAuditSummary.totalCount || 0 }}</div>
              <div class="backup-history-task-line">高风险：{{ capabilityAuditSummary.highRiskCount || 0 }}</div>
              <div class="backup-history-task-line">拒绝/待确认：{{ (capabilityAuditSummary.deniedCount || 0) + (capabilityAuditSummary.confirmCount || 0) }}</div>
              <div class="backup-history-task-line">平均耗时：{{ capabilityAuditSummary.averageDurationMs || 0 }} ms</div>
            </div>
            <div v-if="filteredCapabilityAuditRecords.length === 0" class="backup-history-empty">
              当前筛选条件下没有能力审计记录
            </div>
            <div v-else class="default-settings-list backup-history-list">
              <div
                v-for="item in filteredCapabilityAuditRecords"
                :key="item.id"
                class="default-settings-item backup-history-item"
                :class="{ active: selectedCapabilityAuditId === item.id }"
                @click="selectCapabilityAuditRecord(item)"
              >
                <div class="backup-history-item-body">
                  <div class="backup-history-item-title">{{ item.capabilityLabel || item.capabilityKey || '未命名能力' }}</div>
                  <div class="backup-history-item-meta">
                    <span>{{ formatBackupRecordTime(item.createdAt) }}</span>
                    <span>{{ getCapabilityNamespaceLabel(item.namespace) }}</span>
                    <span>{{ getCapabilityAuditStatusLabel(item.status) }}</span>
                  </div>
                  <div class="backup-history-item-meta">
                    <span>{{ getCapabilityAuditEntryLabel(item.entry) }}</span>
                    <span>{{ item.workflowName || item.taskId || '无任务上下文' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 常规设置：数据设置等（无分组标题） -->
          <div v-else-if="activeMainMenu === 'general'" class="submenu-container">
            <div
              v-for="item in generalSubMenusDisplay"
              :key="item.key"
              class="submenu-item"
              :class="{ active: activeSubMenu === item.key }"
              @click="selectSubMenu(item.key)"
            >
              <span class="submenu-icon" aria-hidden="true">{{ item.icon }}</span>
              <span class="submenu-label">{{ item.label }}</span>
            </div>
          </div>
        </div>

        <!-- 第三列：模型设置 / 选择模型 / 配置详情 -->
        <div class="settings-column column-3">
          <!-- 模型设置 → 第三级：模型设置 -->
          <div v-if="activeMainMenu === 'model-settings' && selectedModel" class="config-panel" :class="{ 'form-saved': isFormSaved }">
            <div class="column-title">模型设置</div>
            <div class="config-header">
              <div class="config-header-text">
                <h4>{{ selectedModel.name }}</h4>
                <p v-if="selectedModelDescription" class="config-header-desc">{{ selectedModelDescription }}</p>
              </div>
              <label class="switch">
                <input
                  type="checkbox"
                  v-model="currentModelConfig.enabled"
                  :disabled="isFormSaved"
                  @change="updateModelConfig"
                />
                <span class="slider"></span>
              </label>
            </div>

            <div class="config-content">
              <div class="config-item">
                <label class="config-label">API 密钥</label>
                <div class="input-group">
                  <div class="input-with-clear">
                    <input
                      ref="apiKeyInputRef"
                      v-model="currentModelConfig.apiKey"
                      :type="showApiKey ? 'text' : 'password'"
                      placeholder="请输入 API 密钥"
                      class="config-input"
                      :disabled="isFormSaved"
                      @blur="updateModelConfig"
                      @input="onFormChange"
                      @focus="onApiKeyInputFocus"
                    />
                    <span
                      v-if="currentModelConfig.apiKey && !isFormSaved"
                      class="input-clear-icon"
                      @mousedown.prevent
                      @click="clearApiKey"
                      title="清空"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </span>
                  </div>
                  <button class="btn-icon" :disabled="isFormSaved" @click="toggleApiKeyVisibility">
                    {{ showApiKey ? '👁️' : '👁️‍🗨️' }}
                  </button>
                  <button class="btn-detect btn-detect-icon" :disabled="isFormSaved" @click="detectApiKey" title="检测 API 密钥和地址是否可用">
                    <img :src="getImageSrc('images/refresh.svg')" class="btn-detect-icon-img" alt="检测" />
                  </button>
                </div>
                <p class="config-hint">
                  多个密钥使用逗号分隔
                  <a
                    v-if="getProviderApiKeyUrl(selectedModel?.id)"
                    href="#"
                    class="config-hint-link"
                    @click.prevent="openApiKeyUrl"
                  >获取秘钥</a>
                </p>
              </div>

              <div class="config-item">
                <label class="config-label">API 地址</label>
                <div class="input-group">
                  <div class="input-with-clear">
                    <input
                      v-model="currentModelConfig.apiUrl"
                      type="text"
                      placeholder="请输入 API 地址"
                      class="config-input"
                      :disabled="isFormSaved"
                      @blur="updateModelConfig"
                      @input="onFormChange"
                      @focus="onApiKeyInputFocus"
                    />
                    <span
                      v-if="currentModelConfig.apiUrl && !isFormSaved"
                      class="input-clear-icon"
                      @mousedown.prevent
                      @click="clearApiUrl"
                      title="清空"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </span>
                  </div>
                </div>
                <p v-if="currentModelConfig.apiUrl" class="config-preview">
                  对话接口预览: {{ getApiPreviewUrl() }}
                </p>
              </div>

              <div class="config-item">
                <label class="config-label">模型</label>
                <p v-if="getProviderDocsUrl(selectedModel?.id)" class="config-hint config-docs-hint">
                  查看
                  <a href="#" class="config-hint-link" @click.prevent="openDocsUrl">{{ selectedModel?.name }}</a>
                  文档和模型获取更多详情
                </p>
                <div class="model-series-container">
                  <div v-if="currentModelConfig.modelSeries && currentModelConfig.modelSeries.length > 0" class="model-series-list">
                    <div
                      v-for="(series, index) in currentModelConfig.modelSeries"
                      :key="index"
                      class="model-series-item"
                    >
                      <span class="series-name">{{ series.name || series }}</span>
                      <span v-if="series.id" class="series-id">{{ series.id }}</span>
                      <span class="series-type">{{ getModelTypeLabel(series.type || inferModelType(series.id || series)) }}</span>
                    </div>
                  </div>
                  <div v-else class="no-models">
                    <p>暂无模型</p>
                    <p class="config-hint">配置 API 地址后，点击"刷新模型"按钮获取可用模型</p>
                  </div>
                  <div class="model-series-actions">
                    <button class="btn-refresh" :disabled="isFormSaved" @click="refreshModelSeries">刷新模型</button>
                    <button class="btn-manage" :disabled="isFormSaved" @click="manageModelSeries">管理</button>
                  </div>
                </div>
                <p v-if="!getProviderDocsUrl(selectedModel?.id)" class="config-hint">
                  查看 {{ selectedModel.name }} 文档获取更多模型详情
                </p>
              </div>
            </div>
          </div>

          <!-- 默认设置 → 右侧：模型选择（选中模型类项时） -->
          <div
            v-else-if="activeMainMenu === 'default-settings' && currentDefaultSettingItem?.type === 'model'"
            class="config-panel"
          >
            <div class="column-title">设置</div>
            <div class="config-header">
              <h4>
                <span class="category-icon">{{ currentDefaultSettingItem?.icon }}</span>
                {{ currentDefaultSettingItem?.label }}
              </h4>
            </div>
            <div class="config-content">
              <div class="config-item">
                <label class="config-label">默认模型</label>
                <div class="default-model-select-wrap" ref="defaultModelSelectRef">
                  <button
                    type="button"
                    class="default-model-select-btn"
                    @click="defaultModelDropdownOpen = !defaultModelDropdownOpen"
                    @blur="onDefaultModelDropdownBlur"
                    :title="selectedDefaultModelDisplayName"
                  >
                    <img
                      v-if="selectedDefaultModel"
                      :src="getImageSrc(selectedDefaultModelIcon)"
                      class="default-model-select-icon"
                      alt=""
                    />
                    <span v-else class="default-model-select-placeholder">未设置</span>
                    <span v-if="selectedDefaultModel" class="default-model-select-text">{{ selectedDefaultModelDisplayName }}</span>
                    <span class="default-model-select-arrow">▾</span>
                  </button>
                  <div v-show="defaultModelDropdownOpen" class="default-model-dropdown">
                    <div v-if="modelGroupsForCurrentCategory.length === 0" class="default-model-dropdown-empty">
                      请先在模型设置中配置：开启提供商、填写 API 地址与密钥、刷新模型清单
                    </div>
                    <template v-else>
                      <div
                        class="default-model-option default-model-option-clear"
                        :class="{ active: !defaultModelsByCategory[activeDefaultSettingItem] }"
                        @mousedown.prevent="selectDefaultModelFromDropdown(null)"
                      >
                        <span>未设置</span>
                      </div>
                      <div
                        v-for="group in modelGroupsForCurrentCategory"
                        :key="group.providerId || group.label"
                        class="default-model-group"
                      >
                        <div
                          class="default-model-group-label"
                          :class="{ collapsed: isModelGroupCollapsed(group.providerId) }"
                          @mousedown.prevent="toggleModelGroupCollapsed(group.providerId)"
                        >
                          <span class="default-model-group-arrow">▾</span>
                          <img :src="getImageSrc(group.icon)" class="default-model-group-icon" alt="" />
                          <span>{{ group.label }}</span>
                        </div>
                        <div
                          v-show="!isModelGroupCollapsed(group.providerId)"
                          class="default-model-group-models"
                        >
                          <div
                            v-for="m in group.models"
                            :key="m.id"
                            class="default-model-option"
                            :class="{ active: defaultModelsByCategory[activeDefaultSettingItem] === m.id }"
                            @mousedown.prevent="selectDefaultModelFromDropdown(m)"
                          >
                            <img :src="getImageSrc(getModelLogoPath(m.providerId))" class="default-model-option-icon" alt="" />
                            <span>{{ m.name || m.modelId }}</span>
                          </div>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
                <p class="config-hint">
                  仅显示在模型设置中已开启且已配置的对应类型模型（对话/图像/视频/语音）
                </p>
              </div>
            </div>
          </div>

          <!-- 默认设置 → 右侧：段落截取设置 -->
          <div
            v-else-if="activeMainMenu === 'default-settings' && activeDefaultSettingItem === 'chunk'"
            class="config-panel"
            :class="{ 'form-saved': isFormSaved }"
          >
            <div class="column-title">设置</div>
            <div class="config-header">
              <h4>
                <span class="category-icon">📄</span>
                段落截取设置
              </h4>
            </div>
            <div class="config-content">
              <p class="config-desc">
                大文档（如百万字）无法一次性送入大模型，需分段处理。设置截取长度与重叠长度，保证上下文连贯。
              </p>
              <div class="config-item">
                <label class="config-label">截取长度（字符）</label>
                <input
                  v-model.number="chunkSettings.chunkLength"
                  type="number"
                  min="500"
                  max="16000"
                  step="100"
                  class="config-input"
                  placeholder="4000"
                  @input="onFormChange"
                />
                <p class="config-hint">建议 2000–8000，默认 4000。单块不宜超过模型上下文限制。</p>
              </div>
              <div class="config-item">
                <label class="config-label">上下重叠长度（字符）</label>
                <input
                  v-model.number="chunkSettings.overlapLength"
                  type="number"
                  min="0"
                  :max="Math.floor(chunkSettings.chunkLength * 0.5)"
                  step="50"
                  class="config-input"
                  placeholder="200"
                  @input="onFormChange"
                />
                <p class="config-hint">建议为截取长度的 10%–25%，默认 200。重叠可避免分界处语义断裂。</p>
              </div>
              <div class="config-item">
                <label class="config-label">分段策略</label>
                <select v-model="chunkSettings.splitStrategy" class="config-input" @change="onFormChange">
                  <option value="paragraph">按段落（优先在段落边界切分）</option>
                  <option value="sentence">按句子（优先在句号处切分）</option>
                  <option value="char">按字符（严格按长度切分）</option>
                </select>
                <p class="config-hint">按段落/句子分块可更好保持语义完整。</p>
              </div>
              <div class="config-item">
                <label class="config-label">建议复核问题写入批注</label>
                <label class="switch">
                  <input
                    v-model="spellCheckCommentPolicy.writeReviewComments"
                    type="checkbox"
                    @change="onFormChange"
                  />
                  <span class="slider"></span>
                </label>
                <p class="config-hint">默认关闭。关闭后，可信等级为“建议复核”的问题只展示在任务详情中，不自动写入文档批注。</p>
              </div>
            </div>
          </div>

          <div
            v-else-if="activeMainMenu === 'assistant-settings' && currentAssistantSettingItem"
            class="config-panel"
          >
            <div class="column-title">助手设置</div>
            <div class="config-header">
              <div class="config-header-text">
                <h4>
                  <span class="category-icon">
                    <img
                      v-if="isAssistantIconImage(currentAssistantSettingItem.icon)"
                      :src="getAssistantIconSrc(currentAssistantSettingItem.icon)"
                      class="assistant-icon-image assistant-icon-image-large"
                      alt=""
                    />
                    <span v-else>{{ currentAssistantSettingItem.icon }}</span>
                  </span>
                  {{ currentAssistantSettingItem.label }}
                </h4>
                <p v-if="currentAssistantSettingItem.description" class="config-header-desc">
                  {{ currentAssistantSettingItem.description }}
                </p>
              </div>
              <div class="config-header-actions">
                <label v-if="currentAssistantSettingItem.type === 'system-assistant'" class="switch">
                  <input
                    type="checkbox"
                    v-model="assistantForm.enabled"
                    @change="onAssistantFormChange"
                  />
                  <span class="slider"></span>
                </label>
              </div>
            </div>
            <div class="config-content">
              <div class="config-item">
                <label class="config-label">{{ currentAssistantSettingItem.type === 'system-assistant' ? '显示名称' : '助手名称' }}</label>
                <input
                  v-model="assistantForm.title"
                  v-if="currentAssistantSettingItem.type === 'system-assistant'"
                  type="text"
                  class="config-input"
                  placeholder="请输入显示名称"
                  @input="onAssistantFormChange"
                />
                <input
                  v-else
                  v-model="assistantForm.name"
                  type="text"
                  class="config-input"
                  placeholder="请输入助手名称"
                  @input="onAssistantFormChange"
                />
              </div>

              <div v-if="currentAssistantSettingItem.type !== 'system-assistant'" class="config-item">
                <label class="config-label">助手图标</label>
                <div
                  class="assistant-icon-picker assistant-icon-picker-clickable"
                  @click="openAssistantIconPickerDialog"
                >
                  <div class="assistant-icon-current">
                    <span class="assistant-icon-current-label">当前图标</span>
                    <div class="assistant-icon-current-preview">
                      <img :src="getAssistantIconSrc(assistantForm.icon)" class="assistant-icon-current-image" alt="" />
                    </div>
                  </div>
                </div>
                <p class="config-hint">图标设置后会同步显示在列表、顶部“更多”菜单和右键菜单；外部图标会在选择时转换为离线 SVG 数据并保存到当前助手配置。</p>
              </div>

              <div class="config-item">
                <label class="config-label">功能说明</label>
                <textarea
                  v-model="assistantForm.description"
                  class="config-input config-textarea"
                  rows="3"
                  placeholder="请输入这个助手的用途说明"
                  @input="onAssistantFormChange"
                ></textarea>
              </div>

              <div v-if="currentAssistantSettingItem.type !== 'system-assistant'" class="config-item">
                <label class="config-label">助手类型</label>
                <select v-model="assistantForm.modelType" class="config-input" @change="onAssistantFormChange">
                  <option value="chat">分析型（对话模型）</option>
                  <option value="image">图像生成型</option>
                  <option value="video">视频生成型</option>
                  <option value="voice">语音生成型</option>
                </select>
                <p class="config-hint">根据助手用途选择类型，执行模型下拉将只显示对应类型的模型。</p>
              </div>

              <div class="config-item">
                <label class="config-label">输入范围</label>
                <select v-model="assistantForm.inputSource" class="config-input" @change="onAssistantFormChange">
                  <option
                    v-for="opt in inputSourceOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >{{ opt.label }}</option>
                </select>
              </div>

              <div class="config-item">
                <label class="config-label">执行模型</label>
                <div class="default-model-select-wrap" ref="assistantModelSelectRef">
                  <button
                    type="button"
                    class="default-model-select-btn"
                    @click="assistantModelDropdownOpen = !assistantModelDropdownOpen"
                    @blur="onAssistantModelDropdownBlur"
                    :title="selectedAssistantModelDisplayName"
                  >
                    <img
                      v-if="selectedAssistantModel"
                      :src="getImageSrc(selectedAssistantModelIcon)"
                      class="default-model-select-icon"
                      alt=""
                    />
                    <span v-else class="default-model-select-placeholder">跟随默认设置</span>
                    <span v-if="selectedAssistantModel" class="default-model-select-text">{{ selectedAssistantModelDisplayName }}</span>
                    <span class="default-model-select-arrow">▾</span>
                  </button>
                  <div v-show="assistantModelDropdownOpen" class="default-model-dropdown">
                    <div v-if="assistantModelGroupsForCurrentItem.length === 0" class="default-model-dropdown-empty">
                      请先在模型设置中配置：开启提供商、填写 API 地址与密钥、刷新模型清单
                    </div>
                    <template v-else>
                      <div
                        class="default-model-option default-model-option-clear"
                        :class="{ active: !assistantForm.modelId }"
                        @mousedown.prevent="selectAssistantModelFromDropdown(null)"
                      >
                        <span>跟随默认设置</span>
                      </div>
                      <div
                        v-for="group in assistantModelGroupsForCurrentItem"
                        :key="group.providerId || group.label"
                        class="default-model-group"
                      >
                        <div
                          class="default-model-group-label"
                          :class="{ collapsed: isModelGroupCollapsed(group.providerId) }"
                          @mousedown.prevent="toggleModelGroupCollapsed(group.providerId)"
                        >
                          <span class="default-model-group-arrow">▾</span>
                          <img :src="getImageSrc(group.icon)" class="default-model-group-icon" alt="" />
                          <span>{{ group.label }}</span>
                        </div>
                        <div
                          v-show="!isModelGroupCollapsed(group.providerId)"
                          class="default-model-group-models"
                        >
                          <div
                            v-for="m in group.models"
                            :key="m.id"
                            class="default-model-option"
                            :class="{ active: assistantForm.modelId === m.id }"
                            @mousedown.prevent="selectAssistantModelFromDropdown(m)"
                          >
                            <img :src="getImageSrc(getModelLogoPath(m.providerId))" class="default-model-option-icon" alt="" />
                            <span>{{ m.name || m.modelId }}</span>
                          </div>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
                <p class="config-hint">{{ assistantModelTypeRestrictionHint }}</p>
                <p class="config-hint">{{ assistantModelHint }}</p>
              </div>

              <div v-if="canRecommendCustomAssistantPrompt" class="config-item assistant-recommend-card">
                <div class="assistant-recommend-head">
                  <div>
                    <label class="config-label">智能推荐提示词</label>
                    <p class="config-hint assistant-recommend-hint">{{ assistantPromptRecommendationModelHint }}</p>
                  </div>
                  <button
                    type="button"
                    class="btn btn-secondary assistant-recommend-btn"
                    @click="openAssistantPromptRecommendDialog"
                  >{{ assistantPromptRecommendationActionLabel }}</button>
                </div>
                <textarea
                  v-model="assistantForm.recommendationRequirement"
                  class="config-input config-textarea assistant-recommend-inline-textarea"
                  rows="4"
                  :placeholder="assistantRecommendationRequirementPlaceholder"
                  @input="onAssistantRecommendationRequirementInput"
                ></textarea>
                <p class="config-hint">输入你想要的助手能力、语气、输出方式或使用场景，系统会调用已配置的对话模型生成系统提示词、用户提示词模板和推荐设置，并自动回填到当前助手表单。</p>
              </div>

              <div class="config-item">
                <label class="config-label">角色设定</label>
                <input
                  v-model="assistantForm.persona"
                  type="text"
                  class="config-input"
                  placeholder="例如：审校专家、公文写作助手、会议纪要助手"
                  @input="onAssistantFormChange"
                />
              </div>

              <div class="config-item">
                <label class="config-label">系统提示词</label>
                <textarea
                  v-model="assistantForm.systemPrompt"
                  class="config-input config-textarea"
                  rows="5"
                  placeholder="请输入系统提示词"
                  @input="onAssistantFormChange"
                ></textarea>
              </div>

              <div class="config-item">
                <label class="config-label">用户提示词模板</label>
                <textarea
                  v-model="assistantForm.userPromptTemplate"
                  class="config-input config-textarea"
                  rows="8"
                  placeholder="可使用 {{input}}、{{targetLanguage}} 等变量"
                  @input="onAssistantFormChange"
                ></textarea>
                <p class="config-hint">可用变量：&#123;&#123;input&#125;&#125;、&#123;&#123;targetLanguage&#125;&#125;、&#123;&#123;assistantName&#125;&#125;</p>
              </div>

              <div class="config-item" v-if="currentAssistantSettingItem.key === 'translate'">
                <label class="config-label">默认目标语言</label>
                <input
                  v-model="assistantForm.targetLanguage"
                  type="text"
                  class="config-input"
                  placeholder="例如：英文、日文、法文"
                  @input="onAssistantFormChange"
                />
              </div>

              <div class="config-item">
                <label class="config-label">输出格式</label>
                <select v-model="assistantForm.outputFormat" class="config-input" @change="onAssistantFormChange">
                  <option
                    v-for="opt in outputFormatOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >{{ opt.label }}</option>
                </select>
              </div>

              <div v-if="supportsReportSettings" class="config-item">
                <label class="config-label">输出报告</label>
                <div class="assistant-inline-actions">
                  <label class="switch">
                    <input
                      type="checkbox"
                      :checked="normalizedAssistantReportSettings.enabled"
                      @change="toggleAssistantReportEnabled($event.target.checked)"
                    />
                    <span class="slider"></span>
                  </label>
                  <select
                    v-if="normalizedAssistantReportSettings.enabled"
                    v-model="assistantForm.reportSettings.type"
                    class="config-input"
                    @change="onAssistantReportTypeChange"
                  >
                    <optgroup
                      v-for="group in reportTypeGroups"
                      :key="group.key"
                      :label="group.label"
                    >
                      <option
                        v-for="option in group.options"
                        :key="option.value"
                        :value="option.value"
                      >{{ option.label }}</option>
                    </optgroup>
                  </select>
                </div>
                <p class="config-hint">开启后会优先按全文生成结构化报告，默认更适合放在任务清单详情中查看，也可继续配合下方文档动作写回文档。</p>
              </div>

              <div
                v-if="supportsReportSettings && normalizedAssistantReportSettings.enabled"
                class="config-item"
              >
                <label class="config-label">自定义报告类型</label>
                <input
                  v-model="assistantForm.reportSettings.customType"
                  :disabled="assistantForm.reportSettings.type !== 'custom'"
                  type="text"
                  class="config-input"
                  placeholder="例如：招投标审查报告、数据治理审计报告"
                  @input="onAssistantFormChange"
                />
                <p class="config-hint">若预设类型不满足需求，可切换为“自定义报告类型”后自行输入。</p>
              </div>

              <div
                v-if="supportsReportSettings && normalizedAssistantReportSettings.enabled"
                class="config-item"
              >
                <label class="config-label">报告格式</label>
                <textarea
                  v-model="assistantForm.reportSettings.template"
                  class="config-input config-textarea"
                  rows="12"
                  placeholder="可粘贴你希望模型遵循的报告格式"
                  @input="onAssistantFormChange"
                ></textarea>
                <p class="config-hint">支持使用 &#123;&#123;reportType&#125;&#125;、&#123;&#123;assistantName&#125;&#125;、&#123;&#123;targetLanguage&#125;&#125; 变量；建议保留一级标题，便于直接审阅。</p>
              </div>

              <div
                v-if="supportsReportSettings && normalizedAssistantReportSettings.enabled"
                class="config-item"
              >
                <label class="config-label">报告提示词</label>
                <textarea
                  v-model="assistantForm.reportSettings.prompt"
                  class="config-input config-textarea"
                  rows="5"
                  placeholder="可补充报告口径、评判标准、写作风格、风险分级方式等"
                  @input="onAssistantFormChange"
                ></textarea>
                <p class="config-hint">最佳实践是把通用能力放在原有系统/用户提示词里，把“只对报告输出生效”的要求放在这里，避免维护两套重复提示词。</p>
              </div>

              <div class="config-item">
                <label class="config-label">文档动作</label>
                <select v-model="assistantForm.documentAction" class="config-input" @change="onAssistantFormChange">
                  <option
                    v-for="opt in currentAssistantDocumentActionOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >{{ opt.label }}</option>
                </select>
              </div>

              <div class="config-item">
                <label class="config-label">温度</label>
                <input
                  v-model.number="assistantForm.temperature"
                  type="number"
                  min="0"
                  max="1.5"
                  step="0.1"
                  class="config-input"
                  @input="onAssistantFormChange"
                />
              </div>

              <div
                v-if="['text-to-image', 'text-to-audio', 'text-to-video'].includes(currentAssistantSettingItem.key)"
                class="config-item"
              >
                <label class="config-label">多模态输出偏好</label>
                <div class="assistant-inline-actions">
                  <input
                    v-if="currentAssistantSettingItem.key === 'text-to-image' || currentAssistantSettingItem.key === 'text-to-video'"
                    v-model="assistantForm.mediaOptions.aspectRatio"
                    type="text"
                    class="config-input"
                    placeholder="画幅比例，如 16:9"
                    @input="onAssistantFormChange"
                  />
                  <input
                    v-if="currentAssistantSettingItem.key === 'text-to-audio' || currentAssistantSettingItem.key === 'text-to-video'"
                    v-model="assistantForm.mediaOptions.duration"
                    type="text"
                    class="config-input"
                    placeholder="时长，如 30s"
                    @input="onAssistantFormChange"
                  />
                  <input
                    v-if="currentAssistantSettingItem.key === 'text-to-audio'"
                    v-model="assistantForm.mediaOptions.voiceStyle"
                    type="text"
                    class="config-input"
                    placeholder="音色风格"
                    @input="onAssistantFormChange"
                  />
                </div>
              </div>

              <div class="config-item">
                <label class="config-label">显示位置</label>
                <div class="assistant-location-grid">
                  <label
                    v-for="opt in assistantDisplayLocationOptions"
                    :key="opt.value"
                    class="assistant-location-option"
                  >
                    <input
                      type="checkbox"
                      :checked="isAssistantDisplayLocationSelected(opt.value)"
                      @change="toggleAssistantDisplayLocation(opt.value, $event.target.checked)"
                    />
                    <span>{{ opt.label }}</span>
                  </label>
                </div>
                <p class="config-hint">可多选；`顶部主菜单` 与 `顶部“更多”菜单` 互斥，右键菜单位置可与其中任一组合。</p>
              </div>

              <div class="config-item">
                <label class="config-label">显示优先级</label>
                <input
                  v-model.number="assistantForm.displayOrder"
                  type="number"
                  class="config-input"
                  placeholder="留空则按系统默认顺序"
                  @input="onAssistantFormChange"
                />
                <p class="config-hint">数值越小越靠前。可用于控制顶部主菜单、更多菜单和右键菜单中的先后顺序。</p>
              </div>

              <div v-if="canApplyReportAssistantPreset" class="assistant-preset-panel">
                <div class="assistant-preset-panel-head">
                  <div>
                    <label class="config-label">快捷模板</label>
                    <p class="config-hint">已按工程、软件、教育、管理、风控、医疗、政府、制造、科研、法务等类型分组，支持搜索筛选，模板会预置更稳妥的报告配置。</p>
                  </div>
                  <div class="assistant-preset-head-actions">
                    <input
                      v-model="reportAssistantPresetSearchText"
                      type="text"
                      placeholder="搜索分组或模板..."
                      class="assistant-preset-search-input"
                    />
                    <button
                      type="button"
                      class="btn btn-secondary assistant-preset-toggle-all"
                      @click="toggleAllReportAssistantPresetGroups"
                    >{{ reportAssistantPresetCollapsedAll ? '全部展开' : '全部收起' }}</button>
                  </div>
                </div>
                <p v-if="(reportAssistantPresetSearchText || '').trim() && filteredReportAssistantPresetGroups.length === 0" class="assistant-preset-empty">
                  未找到匹配「{{ reportAssistantPresetSearchText }}」的分组或模板，请尝试其他关键词。
                </p>
                <div
                  v-for="group in filteredReportAssistantPresetGroups"
                  :key="group.key"
                  class="assistant-preset-group"
                >
                  <button
                    type="button"
                    class="assistant-preset-group-toggle"
                    @click="toggleReportAssistantPresetGroup(group.key)"
                  >
                    <span
                      class="assistant-preset-group-arrow"
                      :class="{ collapsed: isReportAssistantPresetGroupCollapsed(group.key) }"
                    >▾</span>
                    <span class="assistant-preset-group-title">{{ group.label }}</span>
                    <span class="assistant-preset-group-count">{{ group.presets.length }} 个模板</span>
                  </button>
                  <p
                    v-if="!isReportAssistantPresetGroupCollapsed(group.key) && group.description"
                    class="assistant-preset-group-desc"
                  >{{ group.description }}</p>
                  <div
                    v-if="!isReportAssistantPresetGroupCollapsed(group.key)"
                    class="assistant-preset-grid"
                  >
                    <button
                      v-for="preset in group.presets"
                      :key="preset.id"
                      type="button"
                      class="btn btn-secondary assistant-preset-btn"
                      :title="preset.description"
                      @click="applyReportAssistantPreset(preset.id)"
                    >{{ preset.label }}</button>
                  </div>
                </div>
              </div>

              <div
                v-if="currentAssistantSettingItem.type === 'create-custom-assistant' && assistantPrefillNotice"
                class="assistant-prefill-notice"
              >
                <div class="assistant-prefill-notice-title">
                  当前草稿来自能力问答预填
                </div>
                <div class="assistant-prefill-notice-text">
                  建议优先检查助手名称、模型类型、输入范围、写回方式、提示词模板与输出格式。
                </div>
                <div v-if="assistantPrefillNotice.title || assistantPrefillNotice.note" class="assistant-prefill-notice-meta">
                  <span v-if="assistantPrefillNotice.title">来源：{{ assistantPrefillNotice.title }}</span>
                  <span v-if="assistantPrefillNotice.note">需求：{{ assistantPrefillNotice.note }}</span>
                </div>
              </div>

              <div class="assistant-inline-actions">
                <button
                  v-if="currentAssistantSettingItem.type === 'system-assistant'"
                  class="btn btn-secondary"
                  @click="restoreAssistantDefaults"
                >恢复默认模板</button>
                <button
                  v-if="currentAssistantSettingItem.type === 'create-custom-assistant'"
                  class="btn btn-primary"
                  @click="createCustomAssistant"
                >创建智能助手</button>
                <button
                  v-if="currentAssistantSettingItem.type === 'custom-assistant'"
                  class="btn btn-danger"
                  @click="deleteCurrentCustomAssistant"
                >删除当前助手</button>
              </div>
            </div>
          </div>

          <div
            v-else-if="activeMainMenu === 'backup-history'"
            class="config-panel"
          >
            <div class="config-header backup-history-header">
              <div class="config-header-text">
                <h4>{{ selectedBackupRecord?.documentName || '文档备份历史' }}</h4>
                <p class="config-header-desc">查看历史备份版本，并手动恢复指定版本到源文件。</p>
              </div>
              <button
                class="btn btn-primary"
                :disabled="!selectedBackupRecord || isRestoringBackupRecord"
                @click="restoreSelectedBackupRecord"
              >
                {{ isRestoringBackupRecord ? '恢复中...' : '恢复此版本' }}
              </button>
            </div>
            <div v-if="selectedBackupRecord" class="config-content backup-history-detail">
              <div class="backup-history-grid">
                <div class="backup-history-field">
                  <div class="backup-history-field-label">备份时间</div>
                  <div class="backup-history-field-value">{{ formatBackupRecordTime(selectedBackupRecord.createdAt) }}</div>
                </div>
                <div class="backup-history-field">
                  <div class="backup-history-field-label">备份原因</div>
                  <div class="backup-history-field-value">{{ getBackupReasonLabel(selectedBackupRecord.reason) }}</div>
                </div>
                <div class="backup-history-field">
                  <div class="backup-history-field-label">任务来源</div>
                  <div class="backup-history-field-value">{{ getBackupLaunchSourceLabel(selectedBackupRecord.launchSource) }}</div>
                </div>
                <div class="backup-history-field">
                  <div class="backup-history-field-label">任务 ID</div>
                  <div class="backup-history-field-value">{{ selectedBackupRecord.taskId || '未记录' }}</div>
                </div>
                <div class="backup-history-field">
                  <div class="backup-history-field-label">助手 ID</div>
                  <div class="backup-history-field-value">{{ selectedBackupRecord.assistantId || '未记录' }}</div>
                </div>
                <div class="backup-history-field">
                  <div class="backup-history-field-label">备份 ID</div>
                  <div class="backup-history-field-value">{{ selectedBackupRecord.id }}</div>
                </div>
              </div>
              <div class="backup-history-field backup-history-field-block">
                <div class="backup-history-field-label">源文件路径</div>
                <div class="backup-history-path">{{ selectedBackupRecord.sourcePath || '未记录' }}</div>
              </div>
              <div class="backup-history-field backup-history-field-block">
                <div class="backup-history-field-label">备份文件路径</div>
                <div class="backup-history-path">{{ selectedBackupRecord.backupPath || '未记录' }}</div>
              </div>
              <div v-if="selectedBackupLinkedTask" class="backup-history-field backup-history-field-block">
                <div class="backup-history-field-label">关联任务摘要</div>
                <div class="backup-history-task-summary">
                  <div class="backup-history-task-line">任务标题：{{ selectedBackupLinkedTask.title || '未记录' }}</div>
                  <div class="backup-history-task-line">任务状态：{{ getBackupTaskStatusLabel(selectedBackupLinkedTask.status) }}</div>
                  <div class="backup-history-task-line">执行类型：{{ selectedBackupLinkedTask.type || '未记录' }}</div>
                  <div class="backup-history-task-line">结果摘要：{{ selectedBackupLinkedTask.data?.resultSummary || selectedBackupLinkedTask.data?.outputPreview || '未记录' }}</div>
                </div>
                <div class="backup-history-task-actions">
                  <button
                    type="button"
                    class="btn btn-secondary btn-compact"
                    @click="openTaskProgressWindow(selectedBackupLinkedTask.id, selectedBackupLinkedTask.title || '任务进度')"
                  >
                    查看关联任务
                  </button>
                  <button
                    v-if="selectedBackupReplayMode"
                    type="button"
                    class="btn btn-secondary btn-compact"
                    :disabled="isReplayingBackupRecord"
                    @click="replaySelectedBackupLinkedTask"
                  >
                    {{ isReplayingBackupRecord ? '重放中...' : '一键重放' }}
                  </button>
                </div>
              </div>
              <div class="backup-history-field backup-history-field-block">
                <div class="backup-history-field-label">版本差异预览</div>
                <div v-if="selectedBackupDiffPreviewLines.length > 0" class="backup-history-diff-list">
                  <div
                    v-for="(line, index) in selectedBackupDiffPreviewLines"
                    :key="`backup-diff-${index}`"
                    class="backup-history-diff-line"
                  >
                    {{ line }}
                  </div>
                </div>
                <div v-else class="backup-history-path">当前没有可预览的结构化差异信息。</div>
              </div>
              <div v-if="selectedBackupOperationBatch" class="backup-history-field backup-history-field-block">
                <div class="backup-history-field-label">逐操作回放账本</div>
                <div class="backup-history-task-summary">
                  <div class="backup-history-task-line">操作数：{{ selectedBackupOperationEntries.length }}</div>
                  <div class="backup-history-task-line">样式风险：{{ selectedBackupOperationBatch.styleValidation?.severity || 'none' }}</div>
                  <div class="backup-history-task-line">质量门禁：{{ selectedBackupOperationBatch.qualityGate?.riskLevel || '未记录' }}</div>
                </div>
                <div class="backup-history-filters">
                  <select v-model="selectedBackupOperationId" class="config-input backup-history-filter-select">
                    <option value="">自动选择当前操作</option>
                    <option
                      v-for="item in selectedBackupOperationEntries"
                      :key="item.id"
                      :value="item.id"
                    >
                      {{ `${item.action || 'none'} | ${item.locateKey || item.id}` }}
                    </option>
                  </select>
                </div>
                <div v-if="selectedBackupOperationPreviewLines.length > 0" class="backup-history-diff-list">
                  <div
                    v-for="(line, index) in selectedBackupOperationPreviewLines"
                    :key="`backup-operation-preview-${index}`"
                    class="backup-history-diff-line"
                  >
                    {{ line }}
                  </div>
                </div>
                <div class="backup-history-task-actions">
                  <button
                    type="button"
                    class="btn btn-secondary btn-compact"
                    :disabled="selectedBackupOperationEntry?.replayable === false"
                    @click="replaySelectedBackupOperation"
                  >
                    重放当前操作
                  </button>
                  <button type="button" class="btn btn-secondary btn-compact" @click="replayAllBackupOperations">
                    逐步回放全部操作
                  </button>
                  <button type="button" class="btn btn-secondary btn-compact" @click="exportSelectedBackupOperationBatch">
                    导出操作账本
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="config-content">
              <p class="config-desc">请先从左侧选择一条备份记录。</p>
            </div>
          </div>

          <div
            v-else-if="activeMainMenu === 'evaluation-history'"
            class="config-panel"
          >
            <div class="config-header backup-history-header">
              <div class="config-header-text">
                <h4>{{ selectedEvaluationRecord?.title || '评测记录' }}</h4>
                <p class="config-header-desc">查看普通聊天、文档任务和助手版本的统一评测记录。</p>
              </div>
              <div class="backup-history-task-actions">
                <button
                  v-if="canRunSelectedAssistantRegression"
                  class="btn btn-secondary btn-compact"
                  :disabled="isRunningAssistantRegression"
                  @click="runSelectedAssistantRegression"
                >
                  {{ isRunningAssistantRegression ? '运行中...' : '运行版本双跑' }}
                </button>
                <button
                  v-if="canRunSelectedAssistantFamilyRegression"
                  class="btn btn-secondary btn-compact"
                  :disabled="isRunningFamilyRegression"
                  @click="runSelectedAssistantFamilyRegression"
                >
                  {{ isRunningFamilyRegression ? '批量运行中...' : '运行家族批量回归' }}
                </button>
                <button
                  v-if="selectedEvaluationLinkedTask"
                  class="btn btn-secondary btn-compact"
                  @click="openTaskProgressWindow(selectedEvaluationLinkedTask.id, selectedEvaluationLinkedTask.title || '任务进度')"
                >
                  查看关联任务
                </button>
              </div>
            </div>
            <div v-if="selectedEvaluationRecord" class="config-content backup-history-detail">
              <div class="backup-history-grid">
                <div class="backup-history-field">
                  <div class="backup-history-field-label">记录时间</div>
                  <div class="backup-history-field-value">{{ formatBackupRecordTime(selectedEvaluationRecord.createdAt) }}</div>
                </div>
                <div class="backup-history-field">
                  <div class="backup-history-field-label">评测场景</div>
                  <div class="backup-history-field-value">{{ getEvaluationScenarioLabel(selectedEvaluationRecord.scenarioType) }}</div>
                </div>
                <div class="backup-history-field">
                  <div class="backup-history-field-label">当前状态</div>
                  <div class="backup-history-field-value">{{ getEvaluationStatusLabel(selectedEvaluationRecord.status) }}</div>
                </div>
                <div class="backup-history-field">
                  <div class="backup-history-field-label">评测得分</div>
                  <div class="backup-history-field-value">{{ formatEvaluationScore(selectedEvaluationRecord.score) }}</div>
                </div>
                <div class="backup-history-field">
                  <div class="backup-history-field-label">样本类型</div>
                  <div class="backup-history-field-value">{{ getEvaluationSampleTypeLabel(selectedEvaluationRecord.sampleType) }}</div>
                </div>
                <div class="backup-history-field">
                  <div class="backup-history-field-label">归属类型</div>
                  <div class="backup-history-field-value">{{ selectedEvaluationRecord.ownerType || '未记录' }}</div>
                </div>
                <div class="backup-history-field">
                  <div class="backup-history-field-label">归属 ID</div>
                  <div class="backup-history-field-value">{{ selectedEvaluationRecord.ownerId || '未记录' }}</div>
                </div>
              </div>
              <div class="backup-history-field backup-history-field-block">
                <div class="backup-history-field-label">评测结论</div>
                <div class="backup-history-path">{{ selectedEvaluationRecord.summary || '未记录' }}</div>
              </div>
              <div class="backup-history-field backup-history-field-block">
                <div class="backup-history-field-label">输入摘要</div>
                <div class="backup-history-path">{{ selectedEvaluationRecord.inputPreview || '未记录' }}</div>
              </div>
              <div class="backup-history-field backup-history-field-block">
                <div class="backup-history-field-label">输出摘要</div>
                <div class="backup-history-path">{{ selectedEvaluationRecord.outputPreview || '未记录' }}</div>
              </div>
              <div v-if="selectedEvaluationRecord.metadata?.releaseGate?.reason" class="backup-history-field backup-history-field-block">
                <div class="backup-history-field-label">发布门禁</div>
                <div class="backup-history-path">
                  {{ selectedEvaluationRecord.metadata?.releaseGate?.allowed === true ? '已通过' : '未通过' }}：{{ selectedEvaluationRecord.metadata?.releaseGate?.reason }}
                </div>
              </div>
              <div v-if="selectedEvaluationSummaryAuditLines.length > 0" class="backup-history-field backup-history-field-block">
                <div class="backup-history-field-label">摘要抽检信息</div>
                <div class="backup-history-diff-list">
                  <div
                    v-for="(line, index) in selectedEvaluationSummaryAuditLines"
                    :key="`evaluation-summary-audit-${index}`"
                    class="backup-history-diff-line"
                  >
                    {{ line }}
                  </div>
                </div>
              </div>
              <div v-if="selectedEvaluationRegressionLines.length > 0" class="backup-history-field backup-history-field-block">
                <div class="backup-history-field-label">版本回归对比</div>
                <div class="backup-history-diff-list">
                  <div
                    v-for="(line, index) in selectedEvaluationRegressionLines"
                    :key="`evaluation-regression-${index}`"
                    class="backup-history-diff-line"
                  >
                    {{ line }}
                  </div>
                </div>
              </div>
              <div class="backup-history-field backup-history-field-block">
                <div class="backup-history-field-label">核心指标</div>
                <div v-if="selectedEvaluationMetricLines.length > 0" class="backup-history-diff-list">
                  <div
                    v-for="(line, index) in selectedEvaluationMetricLines"
                    :key="`evaluation-metric-${index}`"
                    class="backup-history-diff-line"
                  >
                    {{ line }}
                  </div>
                </div>
                <div v-else class="backup-history-path">当前没有可展示的指标明细。</div>
              </div>
              <div class="backup-history-field backup-history-field-block">
                <div class="backup-history-field-label">黄金样本工作台</div>
                <div class="backup-history-task-summary">
                  <div class="backup-history-task-line">当前作用域：{{ selectedEvaluationAssistantId || '全局样本' }}</div>
                  <div class="backup-history-task-line">可用样本数：{{ filteredRegressionSampleRecords.length }}</div>
                  <div class="backup-history-task-line">批量版本上限：{{ regressionFamilyMaxVersions }}</div>
                </div>
                <div class="backup-history-filters">
                  <select v-model="selectedRegressionSampleId" class="config-input backup-history-filter-select" @change="loadSelectedRegressionSampleDraft">
                    <option value="">新建黄金样本</option>
                    <option
                      v-for="item in filteredRegressionSampleRecords"
                      :key="`golden-sample-${item.id}`"
                      :value="item.id"
                    >
                      {{ `${item.label || '未命名样本'}${item.critical ? ' | 关键' : ''}` }}
                    </option>
                  </select>
                  <select v-model="regressionSampleGroupFilter" class="config-input backup-history-filter-select">
                    <option value="">全部分组</option>
                    <option v-for="group in regressionSampleGroupOptions" :key="`sample-group-${group}`" :value="group">
                      {{ group }}
                    </option>
                  </select>
                  <select v-model="regressionSampleRiskFilter" class="config-input backup-history-filter-select">
                    <option value="">全部风险</option>
                    <option value="low">低风险</option>
                    <option value="medium">中风险</option>
                    <option value="high">高风险</option>
                  </select>
                  <input
                    v-model.number="regressionFamilyMaxVersions"
                    type="number"
                    min="2"
                    max="10"
                    class="config-input backup-history-filter-select"
                    placeholder="批量版本数"
                  />
                </div>
                <div class="backup-history-grid">
                  <div class="backup-history-field">
                    <div class="backup-history-field-label">样本名称</div>
                    <input v-model="regressionSampleDraft.label" class="config-input" placeholder="例如：合同摘要稳定性" />
                  </div>
                  <div class="backup-history-field">
                    <div class="backup-history-field-label">作用域助手</div>
                    <input v-model="regressionSampleDraft.assistantId" class="config-input" placeholder="留空表示全局样本" />
                  </div>
                  <div class="backup-history-field">
                    <div class="backup-history-field-label">样本分组</div>
                    <input v-model="regressionSampleDraft.groupKey" class="config-input" placeholder="例如：contract-summary" />
                  </div>
                  <div class="backup-history-field">
                    <div class="backup-history-field-label">风险等级</div>
                    <select v-model="regressionSampleDraft.riskLevel" class="config-input">
                      <option value="low">低风险</option>
                      <option value="medium">中风险</option>
                      <option value="high">高风险</option>
                    </select>
                  </div>
                  <div class="backup-history-field">
                    <div class="backup-history-field-label">预期文档动作</div>
                    <input v-model="regressionSampleDraft.expectedDocumentAction" class="config-input" placeholder="例如：insert / comment" />
                  </div>
                  <div class="backup-history-field">
                    <div class="backup-history-field-label">标签</div>
                    <input v-model="regressionSampleTagsText" class="config-input" placeholder="多个标签用逗号分隔" />
                  </div>
                  <div class="backup-history-field">
                    <div class="backup-history-field-label">预期输入源</div>
                    <input v-model="regressionSampleDraft.expectedInputSource" class="config-input" placeholder="例如：selection-preferred" />
                  </div>
                  <div class="backup-history-field">
                    <div class="backup-history-field-label">预期语言</div>
                    <input v-model="regressionSampleDraft.expectedTargetLanguage" class="config-input" placeholder="例如：中文" />
                  </div>
                  <div class="backup-history-field">
                    <div class="backup-history-field-label">预期输出格式</div>
                    <input v-model="regressionSampleDraft.expectedOutputFormat" class="config-input" placeholder="例如：markdown / json" />
                  </div>
                </div>
                <div class="backup-history-task-summary">
                  <label class="switch switch-inline" @click.stop>
                    <input v-model="regressionSampleDraft.critical" type="checkbox" />
                    <span class="slider"></span>
                  </label>
                  <span class="backup-history-task-line">标记为关键样本</span>
                </div>
                <div class="backup-history-field backup-history-field-block">
                  <div class="backup-history-field-label">样本输入</div>
                  <textarea
                    v-model="regressionSampleDraft.inputText"
                    class="config-input config-textarea"
                    rows="5"
                    placeholder="请输入用于回归的标准输入文本"
                  />
                </div>
                <div class="backup-history-field backup-history-field-block">
                  <div class="backup-history-field-label">备注</div>
                  <textarea
                    v-model="regressionSampleDraft.notes"
                    class="config-input config-textarea"
                    rows="3"
                    placeholder="记录适用场景、失败模式或人工检查重点"
                  />
                </div>
                <div class="backup-history-task-actions">
                  <button type="button" class="btn btn-secondary btn-compact" @click="resetRegressionSampleDraft">
                    新建
                  </button>
                  <button type="button" class="btn btn-secondary btn-compact" @click="exportRegressionSampleSnapshot">
                    导出样本
                  </button>
                  <button type="button" class="btn btn-secondary btn-compact" @click="exportRegressionSampleTemplateSnapshot">
                    导出模板
                  </button>
                  <button type="button" class="btn btn-secondary btn-compact" @click="triggerRegressionSampleImport">
                    导入模板
                  </button>
                  <button type="button" class="btn btn-secondary btn-compact" :disabled="!selectedRegressionSampleId" @click="removeSelectedRegressionSample">
                    删除样本
                  </button>
                  <button type="button" class="btn btn-primary btn-compact" @click="saveRegressionSampleDraft">
                    保存样本
                  </button>
                </div>
                <input
                  ref="regressionSampleImportInput"
                  type="file"
                  accept="application/json,.json"
                  style="display: none;"
                  @change="onRegressionSampleImportFileChange"
                />
              </div>
            </div>
            <div v-else class="config-content">
              <p class="config-desc">请先从左侧选择一条评测记录。</p>
            </div>
          </div>

          <div
            v-else-if="activeMainMenu === 'capability-audit'"
            class="config-panel"
          >
            <div class="config-header backup-history-header">
              <div class="config-header-text">
                <h4>{{ selectedCapabilityAuditRecord?.capabilityLabel || selectedCapabilityAuditRecord?.capabilityKey || '能力调用审计' }}</h4>
                <p class="config-header-desc">查看 capability bus 与 WPS 能力执行的来源、参数、结果和失败原因。</p>
              </div>
              <button
                v-if="selectedCapabilityAuditLinkedTask"
                class="btn btn-secondary"
                @click="openTaskProgressWindow(selectedCapabilityAuditLinkedTask.id, selectedCapabilityAuditLinkedTask.title || '任务进度')"
              >
                查看关联任务
              </button>
            </div>
            <div class="config-content backup-history-detail">
              <div class="backup-history-field backup-history-field-block">
                <div class="backup-history-field-label">策略配置</div>
                <div class="backup-history-grid">
                  <div class="backup-history-field">
                    <div class="backup-history-field-label">命名空间</div>
                    <select v-model="capabilityPolicyNamespace" class="config-input backup-history-filter-select">
                      <option
                        v-for="namespace in capabilityPolicyNamespaceOptions"
                        :key="`policy-namespace-${namespace}`"
                        :value="namespace"
                      >
                        {{ getCapabilityNamespaceLabel(namespace) }}
                      </option>
                    </select>
                  </div>
                  <div class="backup-history-field">
                    <div class="backup-history-field-label">能力策略</div>
                    <select v-model="capabilityPolicyKey" class="config-input backup-history-filter-select">
                      <option value="">仅编辑命名空间默认策略</option>
                      <option
                        v-for="item in capabilityPolicyOptions"
                        :key="`policy-capability-${item.namespace}-${item.key}`"
                        :value="item.key"
                      >
                        {{ item.label || item.key }}
                      </option>
                    </select>
                  </div>
                  <div class="backup-history-field">
                    <div class="backup-history-field-label">风险等级</div>
                    <div class="backup-history-field-value">{{ getCapabilityAuditRiskLabel(capabilityPolicyResolvedRiskLevel) }}</div>
                  </div>
                  <div class="backup-history-field">
                    <div class="backup-history-field-label">默认决策</div>
                    <select v-model="capabilityPolicyForm.defaultDecision" class="config-input backup-history-filter-select">
                      <option value="allow">允许</option>
                      <option value="confirm">确认后执行</option>
                      <option value="deny">拒绝</option>
                      <option value="throttled">稍后重试</option>
                    </select>
                  </div>
                  <div class="backup-history-field">
                    <div class="backup-history-field-label">每分钟限额</div>
                    <input v-model.number="capabilityPolicyForm.perMinuteLimit" type="number" min="0" class="config-input" placeholder="0 表示不限" />
                  </div>
                  <div class="backup-history-field">
                    <div class="backup-history-field-label">每日限额</div>
                    <input v-model.number="capabilityPolicyForm.perDayLimit" type="number" min="0" class="config-input" placeholder="0 表示不限" />
                  </div>
                </div>
                <div class="backup-history-task-summary">
                  <label class="switch switch-inline" @click.stop>
                    <input v-model="capabilityPolicyForm.enabled" type="checkbox" />
                    <span class="slider"></span>
                  </label>
                  <span class="backup-history-task-line">启用当前策略</span>
                  <label class="switch switch-inline" @click.stop>
                    <input v-model="capabilityPolicyForm.requireConfirmationForHighRisk" type="checkbox" />
                    <span class="slider"></span>
                  </label>
                  <span class="backup-history-task-line">高风险必须确认</span>
                </div>
                <div class="backup-history-field backup-history-field-block">
                  <div class="backup-history-field-label">允许入口列表</div>
                  <textarea
                    v-model="capabilityPolicyForm.allowedEntriesText"
                    class="config-input config-textarea"
                    rows="2"
                    placeholder="每行一个入口 key；留空表示不限制"
                  />
                </div>
                <div class="backup-history-field backup-history-field-block">
                  <div class="backup-history-field-label">阻止入口列表</div>
                  <textarea
                    v-model="capabilityPolicyForm.blockedEntriesText"
                    class="config-input config-textarea"
                    rows="2"
                    placeholder="每行一个入口 key；命中后直接阻止"
                  />
                </div>
                <div class="backup-history-task-actions">
                  <button type="button" class="btn btn-secondary btn-compact" @click="loadCapabilityPolicyEditor">
                    重置
                  </button>
                  <button type="button" class="btn btn-secondary btn-compact" @click="exportCapabilityPolicySnapshotText">
                    导出策略
                  </button>
                  <button type="button" class="btn btn-secondary btn-compact" @click="removeCapabilityPolicyEditor" :disabled="!capabilityPolicyKey">
                    删除能力级覆盖
                  </button>
                  <button type="button" class="btn btn-primary btn-compact" @click="saveCapabilityPolicyEditor">
                    保存策略
                  </button>
                </div>
              </div>
            </div>
            <div v-if="selectedCapabilityAuditRecord" class="config-content backup-history-detail">
              <div class="backup-history-grid">
                <div class="backup-history-field">
                  <div class="backup-history-field-label">记录时间</div>
                  <div class="backup-history-field-value">{{ formatBackupRecordTime(selectedCapabilityAuditRecord.createdAt) }}</div>
                </div>
                <div class="backup-history-field">
                  <div class="backup-history-field-label">命名空间</div>
                  <div class="backup-history-field-value">{{ getCapabilityNamespaceLabel(selectedCapabilityAuditRecord.namespace) }}</div>
                </div>
                <div class="backup-history-field">
                  <div class="backup-history-field-label">调用入口</div>
                  <div class="backup-history-field-value">{{ getCapabilityAuditEntryLabel(selectedCapabilityAuditRecord.entry) }}</div>
                </div>
                <div class="backup-history-field">
                  <div class="backup-history-field-label">执行状态</div>
                  <div class="backup-history-field-value">{{ getCapabilityAuditStatusLabel(selectedCapabilityAuditRecord.status) }}</div>
                </div>
                <div class="backup-history-field">
                  <div class="backup-history-field-label">风险等级</div>
                  <div class="backup-history-field-value">{{ getCapabilityAuditRiskLabel(selectedCapabilityAuditRecord.riskLevel) }}</div>
                </div>
                <div class="backup-history-field">
                  <div class="backup-history-field-label">策略结果</div>
                  <div class="backup-history-field-value">{{ getCapabilityAuditDecisionLabel(selectedCapabilityAuditRecord.decision) }}</div>
                </div>
                <div class="backup-history-field">
                  <div class="backup-history-field-label">能力 Key</div>
                  <div class="backup-history-field-value">{{ selectedCapabilityAuditRecord.capabilityKey || '未记录' }}</div>
                </div>
                <div class="backup-history-field">
                  <div class="backup-history-field-label">耗时</div>
                  <div class="backup-history-field-value">{{ `${selectedCapabilityAuditRecord.durationMs || 0} ms` }}</div>
                </div>
                <div class="backup-history-field">
                  <div class="backup-history-field-label">启动来源</div>
                  <div class="backup-history-field-value">{{ selectedCapabilityAuditRecord.launchSource || '未记录' }}</div>
                </div>
                <div class="backup-history-field">
                  <div class="backup-history-field-label">工作流</div>
                  <div class="backup-history-field-value">{{ selectedCapabilityAuditRecord.workflowName || selectedCapabilityAuditRecord.workflowId || '未记录' }}</div>
                </div>
              </div>
              <div class="backup-history-field backup-history-field-block">
                <div class="backup-history-field-label">关联任务</div>
                <div class="backup-history-path">{{ selectedCapabilityAuditRecord.taskId || '未记录' }}</div>
              </div>
              <div class="backup-history-field backup-history-field-block">
                <div class="backup-history-field-label">策略说明</div>
                <div class="backup-history-path">{{ selectedCapabilityAuditRecord.decisionReason || '未记录' }}</div>
              </div>
              <div class="backup-history-field backup-history-field-block">
                <div class="backup-history-field-label">执行摘要</div>
                <div v-if="selectedCapabilityAuditPreviewLines.length > 0" class="backup-history-diff-list">
                  <div
                    v-for="(line, index) in selectedCapabilityAuditPreviewLines"
                    :key="`capability-audit-preview-${index}`"
                    class="backup-history-diff-line"
                  >
                    {{ line }}
                  </div>
                </div>
                <div v-else class="backup-history-path">当前没有可展示的参数或结果摘要。</div>
              </div>
            </div>
            <div v-else class="config-content">
              <p class="config-desc">请先从左侧选择一条能力审计记录。</p>
            </div>
          </div>

          <!-- 数据配置界面 -->
          <div
            v-else-if="activeMainMenu === 'general' && activeSubMenu === 'data'"
            class="config-panel"
            :class="{ 'form-saved': isFormSaved }"
          >
            <div class="config-header">
              <h4>数据路径设置</h4>
            </div>
            <div class="config-content">
              <div class="config-item">
                <p class="config-desc">
                  设置后，规则数据（relus.aidooo）、导入的文档模板等本地数据将统一保存到此路径下。留空则规则不写入本地文件。
                </p>
                <div class="path-row">
                  <input
                    v-model="dataPath"
                    class="path-input"
                    placeholder="请选择或输入数据目录，规则将保存为 relus.aidooo"
                    type="text"
                    :disabled="isFormSaved"
                    @input="onFormChange"
                  />
                  <button class="btn btn-secondary btn-browse" :disabled="isFormSaved" @click="browseFolder">
                    选择文件夹
                  </button>
                </div>
                <p class="path-hint">默认路径：{{ defaultPath }}</p>
                <p class="config-desc">
                  全局错误会写入下方目录中的按日日志文件（如 2026-3-30.log）。留空数据路径时使用各系统默认日志位置。
                </p>
                <p class="path-hint">错误日志目录（只读）：{{ errorLogDirectoryDisplay }}</p>
                <p class="path-hint">
                  若该目录下没有生成 .log：多为路径不可写或相对路径未被 WPS 接受。此时最近错误会缓存在插件存储键
                  NdErrorLogFallback；进程闪退、原生崩溃可能在落盘前终止，磁盘上仍可能没有文件。
                </p>
                <button class="btn-link" :disabled="isFormSaved" @click="useDefault">使用默认路径</button>
              </div>
              <div class="config-item">
                <h5>多模态服务端 Fallback</h5>
                <p class="config-desc">
                  当长视频或本地抽帧能力不足时，允许自动调用服务端分析链路。建议仅在可信服务端环境下开启。
                </p>
                <div class="backup-history-task-summary">
                  <label class="switch switch-inline" @click.stop>
                    <input v-model="multimodalServerFallback.enabled" type="checkbox" @change="onFormChange" />
                    <span class="slider"></span>
                  </label>
                  <span class="backup-history-task-line">启用服务端视频分析 fallback</span>
                </div>
                <div class="backup-history-field backup-history-field-block">
                  <div class="backup-history-field-label">服务端接口地址</div>
                  <input
                    v-model="multimodalServerFallback.endpoint"
                    class="config-input"
                    placeholder="例如：https://your-host/api/multimodal/video-analysis"
                    type="text"
                    :disabled="isFormSaved"
                    @input="onFormChange"
                  />
                </div>
                <div class="backup-history-field backup-history-field-block">
                  <div class="backup-history-field-label">接口密钥</div>
                  <input
                    v-model="multimodalServerFallback.apiKey"
                    class="config-input"
                    placeholder="可选：服务端鉴权 Token"
                    type="password"
                    :disabled="isFormSaved"
                    @input="onFormChange"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 其他常规设置 -->
          <div
            v-else-if="activeMainMenu === 'general' && activeSubMenu"
            class="config-panel"
          >
            <div class="config-header">
              <h4>{{ getSubMenuLabel() }}</h4>
            </div>
            <div class="config-content">
              <p class="config-desc">此功能正在开发中...</p>
            </div>
          </div>

          <!-- 默认提示 -->
          <div v-else class="config-panel empty">
            <div class="empty-state">
              <p>请从左侧选择一项进行配置</p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="message" class="message" :class="message.type">{{ message.text }}</div>
    </div>

    <!-- 添加/编辑模型供应商弹窗 -->
    <div v-if="showAddModelDialog" class="modal-overlay" @click.self="closeAddModelDialog">
      <div class="modal-content add-model-modal">
        <div class="modal-header">
          <h4>{{ addModelMode === 'edit' ? '编辑模型供应商' : '添加模型供应商' }}</h4>
          <button class="btn-close" @click="closeAddModelDialog">×</button>
        </div>
        <div class="modal-body">
          <div class="config-item">
            <label class="config-label">图标</label>
            <div class="add-model-icon-wrap">
              <div class="add-model-icon-preview" @click="triggerIconUpload">
                <img
                  v-if="addModelForm.icon"
                  :src="addModelForm.icon"
                  alt="图标"
                  class="add-model-icon"
                  @error="handleImageError"
                />
                <span v-else class="add-model-icon-placeholder">点击上传</span>
              </div>
              <input
                ref="iconFileInputRef"
                type="file"
                accept="image/*"
                class="icon-file-input"
                @change="onIconFileChange"
              />
              <button v-if="addModelForm.icon" type="button" class="btn-clear-icon" @click="clearAddModelIcon">清除</button>
            </div>
          </div>
          <div class="config-item">
            <label class="config-label">供应商名称</label>
            <input
              v-model="addModelForm.name"
              type="text"
              placeholder="请输入供应商名称"
              class="config-input"
            />
          </div>
          <div class="config-item">
            <label class="config-label">供应商类型</label>
            <select v-model="addModelForm.type" class="config-input">
              <option
                v-for="opt in vendorTypeOptions"
                :key="opt.id"
                :value="opt.id"
              >{{ opt.name }}</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeAddModelDialog">取消</button>
          <button class="btn btn-primary" @click="confirmAddOrEditModel">确定</button>
        </div>
      </div>
    </div>

    <!-- 管理模型弹窗 -->
    <div v-if="showManageModal" class="modal-overlay" @click.self="closeManageModal">
      <div class="modal-content manage-modal">
        <div class="modal-header">
          <h4>管理模型</h4>
          <button class="btn-close" @click="closeManageModal">×</button>
        </div>
        <div class="modal-body">
          <div class="manage-list">
            <div
              v-for="(m, idx) in manageModelList"
              :key="idx"
              class="manage-item"
            >
              <span class="manage-item-name">{{ m.name || m.id }}</span>
              <span class="manage-item-id">{{ m.id }}</span>
              <span class="manage-item-type">{{ getModelTypeLabel(m.type || inferModelType(m.id)) }}</span>
              <button class="btn-remove" @click="removeManageModel(idx)" title="删除">✕</button>
            </div>
          </div>
          <div class="manage-add">
            <input v-model="manageNewId" placeholder="模型 ID" class="manage-input" />
            <input v-model="manageNewName" placeholder="显示名称（可选）" class="manage-input" />
            <button class="btn btn-primary" @click="addManageModel">添加</button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeManageModal">取消</button>
          <button class="btn btn-primary" @click="confirmManageModels">确定</button>
        </div>
      </div>
    </div>

    <div v-if="showAssistantPromptRecommendDialog" class="modal-overlay" @click.self="closeAssistantPromptRecommendDialog">
      <div class="modal-content assistant-recommend-modal">
        <div class="modal-header">
          <h4>{{ assistantPromptRecommendationActionLabel }}提示词与设置</h4>
          <button class="btn-close" @click="closeAssistantPromptRecommendDialog">×</button>
        </div>
        <div class="modal-body">
          <div class="config-item">
            <label class="config-label">你的要求</label>
            <textarea
              ref="assistantPromptRequirementRef"
              v-model="assistantPromptRecommendationRequirement"
              class="config-input config-textarea assistant-recommend-textarea"
              rows="8"
              :placeholder="assistantRecommendationRequirementPlaceholder"
              @input="onAssistantPromptRecommendationRequirementChange"
            ></textarea>
            <p class="config-hint">建议写清楚：助手用途、目标用户、输入范围、输出格式、是否写回文档、典型使用场景；如果是报告类场景，也请写清楚报告类型、章节结构、风险分级和写作口径。系统会结合当前助手已有配置一起优化。</p>
          </div>
          <div class="assistant-recommend-model-note">
            <div class="assistant-recommend-model-title">本次推荐将使用</div>
            <div class="default-model-select-wrap" ref="assistantPromptRecommendationModelSelectRef">
              <button
                type="button"
                class="default-model-select-btn"
                @click="assistantPromptRecommendationModelDropdownOpen = !assistantPromptRecommendationModelDropdownOpen"
                @blur="onAssistantPromptRecommendationModelDropdownBlur"
                :title="selectedAssistantPromptRecommendationModelDisplayName"
              >
                <img
                  v-if="selectedAssistantPromptRecommendationModel"
                  :src="getImageSrc(selectedAssistantPromptRecommendationModelIcon)"
                  class="default-model-select-icon"
                  alt=""
                />
                <span v-else class="default-model-select-placeholder">继承当前助手解析模型</span>
                <span v-if="selectedAssistantPromptRecommendationModel" class="default-model-select-text">{{ selectedAssistantPromptRecommendationModelDisplayName }}</span>
                <span class="default-model-select-arrow">▾</span>
              </button>
              <div v-show="assistantPromptRecommendationModelDropdownOpen" class="default-model-dropdown">
                <div v-if="assistantPromptRecommendationModelGroups.length === 0" class="default-model-dropdown-empty">
                  请先在模型设置中配置：开启提供商、填写 API 地址与密钥、刷新模型清单
                </div>
                <template v-else>
                  <div
                    class="default-model-option default-model-option-clear"
                    :class="{ active: !assistantPromptRecommendationModelId }"
                    @mousedown.prevent="selectAssistantPromptRecommendationModelFromDropdown(null)"
                  >
                    <span>继承当前助手解析模型</span>
                  </div>
                  <div
                    v-for="group in assistantPromptRecommendationModelGroups"
                    :key="`recommend-${group.providerId || group.label}`"
                    class="default-model-group"
                  >
                    <div
                      class="default-model-group-label"
                      :class="{ collapsed: isModelGroupCollapsed(group.providerId) }"
                      @mousedown.prevent="toggleModelGroupCollapsed(group.providerId)"
                    >
                      <span class="default-model-group-arrow">▾</span>
                      <img :src="getImageSrc(group.icon)" class="default-model-group-icon" alt="" />
                      <span>{{ group.label }}</span>
                    </div>
                    <div
                      v-show="!isModelGroupCollapsed(group.providerId)"
                      class="default-model-group-models"
                    >
                      <div
                        v-for="m in group.models"
                        :key="`recommend-model-${m.id}`"
                        class="default-model-option"
                        :class="{ active: assistantPromptRecommendationModelId === m.id }"
                        @mousedown.prevent="selectAssistantPromptRecommendationModelFromDropdown(m)"
                      >
                        <img :src="getImageSrc(getModelLogoPath(m.providerId))" class="default-model-option-icon" alt="" />
                        <span>{{ m.name || m.modelId }}</span>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </div>
            <div class="assistant-recommend-model-value">{{ assistantPromptRecommendationModelHint }}</div>
          </div>
          <div class="assistant-recommend-tips">
            <div class="assistant-recommend-tip">系统会自动生成系统提示词、用户提示词模板以及输入范围、输出格式、文档动作、温度、显示位置等推荐设置。</div>
            <div class="assistant-recommend-tip">当前目标：{{ assistantPromptRecommendationTargetLabel }}。点击确定后会创建任务、显示进度条，并同步进入任务清单；推荐完成后会自动回填到当前助手表单，包含系统提示词、用户提示词模板，以及报告类型、报告格式、报告提示词等设置，但仍需你手动点击保存。</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeAssistantPromptRecommendDialog">取消</button>
          <button class="btn btn-primary" @click="confirmAssistantPromptRecommendation">确定并{{ assistantPromptRecommendationActionLabel }}</button>
        </div>
      </div>
    </div>

    <div v-if="showAssistantIconPickerDialog" class="modal-overlay" @click.self="closeAssistantIconPickerDialog">
      <div class="modal-content assistant-icon-picker-modal">
        <div class="modal-header">
          <h4>选择助手图标</h4>
          <button class="btn-close" @click="closeAssistantIconPickerDialog">×</button>
        </div>
        <div class="modal-body">
          <div class="assistant-icon-picker-toolbar">
            <div class="assistant-icon-library-tabs">
              <button
                v-for="library in assistantIconPickerLibraries"
                :key="library.id"
                type="button"
                class="assistant-icon-library-tab"
                :class="{ active: assistantIconPickerActiveLibraryId === library.id }"
                @click="switchAssistantIconPickerLibrary(library.id)"
              >
                {{ library.label }}
              </button>
            </div>
            <input
              v-model="assistantIconPickerSearchText"
              type="text"
              class="config-input assistant-icon-search-input"
              placeholder="搜索图标名称"
            />
          </div>
          <div v-if="activeAssistantIconPickerLibrary?.note" class="assistant-icon-library-note">
            {{ activeAssistantIconPickerLibrary.note }}
          </div>
          <div v-if="assistantIconPickerLoading" class="assistant-icon-picker-empty">正在加载图标库...</div>
          <div v-else-if="assistantIconPickerError" class="assistant-icon-picker-empty assistant-icon-picker-empty-error">
            {{ assistantIconPickerError }}
          </div>
          <div v-else-if="visibleAssistantIconPickerOptions.length === 0" class="assistant-icon-picker-empty">
            当前图标库没有匹配结果
          </div>
          <div v-else class="assistant-icon-grid assistant-icon-grid-modal">
            <button
              v-for="icon in visibleAssistantIconPickerOptions"
              :key="icon.id"
              type="button"
              class="assistant-icon-option"
              :class="{ active: assistantIconPickerSelectedValue === getAssistantIconOptionSrc(icon) }"
              :title="icon.label"
              @click="selectAssistantIconOption(icon)"
            >
              <img :src="getAssistantIconOptionSrc(icon)" class="assistant-icon-option-image" alt="" />
              <span class="assistant-icon-option-label">{{ icon.label }}</span>
            </button>
          </div>
          <div v-if="canLoadMoreAssistantIconPickerOptions && !assistantIconPickerLoading" class="assistant-icon-picker-more">
            <button type="button" class="btn btn-secondary" @click="loadMoreAssistantIconPickerOptions">加载更多</button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeAssistantIconPickerDialog">取消</button>
          <button class="btn btn-primary" @click="confirmAssistantIconPickerDialog">确定</button>
        </div>
      </div>
    </div>

    <!-- 右键菜单 -->
    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    >
      <template v-if="contextMenu.menuType === 'model'">
        <div class="context-menu-item" @click="editCustomModel">编辑</div>
        <div class="context-menu-item context-menu-item-danger" @click="deleteCustomModel">删除</div>
      </template>
      <template v-else-if="contextMenu.menuType === 'assistant'">
        <div class="context-menu-item" @click="duplicateAssistantFromContextMenu">复制为新助手</div>
        <div class="context-menu-item" @click="exportAssistantFromContextMenu">导出助手</div>
        <div
          class="context-menu-item"
          :class="{ 'context-menu-item-disabled': !canMoveAssistantContextMenuItem('up') }"
          @click="moveAssistantFromContextMenu('up')"
        >上移</div>
        <div
          class="context-menu-item"
          :class="{ 'context-menu-item-disabled': !canMoveAssistantContextMenuItem('down') }"
          @click="moveAssistantFromContextMenu('down')"
        >下移</div>
        <div
          class="context-menu-item context-menu-item-danger"
          :class="{ 'context-menu-item-disabled': !canDeleteAssistantContextMenuItem }"
          @click="deleteAssistantFromContextMenu"
        >删除</div>
      </template>
    </div>

    <div class="dialog-footer">
      <button class="btn btn-secondary" @click="onClose">取消</button>
      <button class="btn btn-primary" @click="onSave">保存</button>
    </div>
    </template>
  </div>
</template>

<script>
import { getDataPath, setDataPath, getDefaultDataPath } from '../utils/dataPathSettings.js'
import { getErrorLogDirectoryForDataPath } from '../utils/globalErrorLogger.js'
import { loadGlobalSettings, saveGlobalSettings } from '../utils/globalSettings.js'
import {
  getModelConfig,
  saveModelConfig,
  deleteModelConfig,
  getDefaultModelId,
  setDefaultModelId,
  getModelGroupsFromSettings,
  getFlatModelsFromSettings,
  parseModelCompositeId,
  getProviderApiKeyUrl,
  getProviderDocsUrl,
  getCustomModelProviders,
  saveCustomModelProviders,
  getModelOrder,
  saveModelOrder
} from '../utils/modelSettings.js'
import { getModelLogoPath } from '../utils/modelLogos.js'
import { publicAssetUrl } from '../utils/publicAssetUrl.js'
import { inferModelType, getModelTypeLabel } from '../utils/modelTypeUtils.js'
import { getChunkSettings, saveChunkSettings } from '../utils/chunkSettings.js'
import {
  DEFAULT_ASSISTANT_ICON_LIBRARY_ID,
  DEFAULT_ASSISTANT_ICON,
  getAssistantIconPickerLibraries,
  getAssistantIconOptionValueSync,
  loadAssistantIconLibraryOptions,
  isAssistantImageIcon,
  normalizeAssistantIcon
} from '../utils/assistantIcons.js'
import {
  loadAssistantSettings,
  saveAssistantSettings,
  getCustomAssistants,
  saveCustomAssistants,
  createCustomAssistantDraft,
  buildCustomAssistantId
} from '../utils/assistantSettings.js'
import { consumeAssistantPrefillDraft } from '../utils/assistantPrefillDraftStore.js'
import { startAssistantPromptRecommendationTask } from '../utils/assistantPromptRecommendationService.js'
import {
  readAssistantRecommendationApplyRequest,
  clearAssistantRecommendationApplyRequest,
  getAssistantRecommendationApplyStorageKey
} from '../utils/assistantRecommendationApplyBridge.js'
import {
  CONTEXT_MENU_DYNAMIC_SLOT_COUNT,
  FIXED_MAIN_ASSISTANT_IDS,
  FIXED_MAIN_ASSISTANT_LABELS,
  RIBBON_DYNAMIC_SLOT_COUNT,
  getAssistantSettingItems,
  getAssistantDefaultConfig,
  getAssistantResolvedIcon,
  getBuiltinAssistantDefinition,
  getDocumentActionOptions,
  ASSISTANT_DISPLAY_LOCATION_OPTIONS,
  OUTPUT_FORMAT_OPTIONS,
  INPUT_SOURCE_OPTIONS,
  getAssistantGroupLabel
} from '../utils/assistantRegistry.js'
import {
  createDefaultReportSettings,
  getReportTypeGroups,
  getReportTypeLabel,
  normalizeReportSettings,
  renderReportTemplate
} from '../utils/reportSettings.js'
import {
  buildReportAssistantPresetDraft,
  getReportAssistantPresetGroups
} from '../utils/reportAssistantPresets.js'
import { createSettingsWindowSession } from '../utils/settingsWindowManager.js'
import { getDocumentBackupRecords, restoreDocumentBackupRecordById } from '../utils/documentBackupStore.js'
import { getTaskById } from '../utils/taskListStore.js'
import { applyAssistantTaskPlan, startAssistantTask } from '../utils/assistantTaskRunner.js'
import { buildEvaluationDashboard, listEvaluationRecords } from '../utils/evaluationStore.js'
import { aggregateCapabilityAuditRecords, exportCapabilityAuditRecords, listCapabilityAuditRecords } from '../utils/capabilityAuditStore.js'
import { exportDocumentOperationBatch, getDocumentOperationBatchById, replayDocumentOperationBatch } from '../utils/documentOperationLedger.js'
import {
  exportCapabilityPolicySnapshot,
  getCapabilityPolicySnapshot,
  listNamespacePolicies,
  removeCapabilityPolicy,
  upsertCapabilityPolicy,
  upsertNamespacePolicy
} from '../utils/capabilityPolicyStore.js'
import { exportCapabilityBusManifest, getCapabilityBusCatalog, getCapabilityRiskLevel } from '../utils/capabilityBus.js'
import { listChatMemoryRecords } from '../utils/chatMemoryStore.js'
import { runAssistantFamilyRegression, runAssistantVersionRegression } from '../utils/assistantRegressionService.js'
import {
  buildRegressionSampleTemplate,
  createRegressionSampleRecord,
  exportRegressionSamples,
  importRegressionSamples,
  listRegressionSamples,
  removeRegressionSample,
  upsertRegressionSample
} from '../utils/assistantRegressionSampleStore.js'
import { getMultimodalServerFallbackConfig } from '../utils/multimodalServerBridge.js'

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value))
}

const ASSISTANT_PROMPT_RECOMMENDATION_DRAFT_KEY = 'NdAssistantPromptRecommendationDraft'
const DEFAULT_REPORT_PRESET_COLLAPSED_GROUPS = getReportAssistantPresetGroups().reduce((acc, group, index) => {
  acc[group.key] = index >= 2
  return acc
}, {})

/** 设置左侧主菜单中隐藏的项（界面不展示，代码与路由仍保留便于以后恢复） */
const HIDDEN_SETTINGS_MAIN_MENU_KEYS = new Set(['backup-history', 'capability-audit', 'evaluation-history'])

// 模型设置子菜单下的固定清单项：仅显示名称+图标；功能性描述放在右侧提示
// 默认开启（察元AI助理下拉可选）：OPENAI/ChatGPT、OLLAMA、DEEPSEEK、baidu-qianfan/百度云千帆、aliyun-bailian/千问
const MODEL_INVENTORY = [
  { id: 'OPENAI', name: 'OpenAI', description: 'ChatGPT' },
  { id: 'OLLAMA', name: 'Ollama' },
  { id: 'aliyun-bailian', name: '通义千问', description: '阿里云百炼' },
  { id: 'DEEPSEEK', name: 'DeepSeek' },
  { id: 'baidu-qianfan', name: '百度云千帆', description: '文心大模型' },
  { id: 'XINFERENCE', name: 'Xinference' },
  { id: 'ONEAPI', name: 'One API' },
  { id: 'FASTCHAT', name: 'FastChat', description: 'vLLM' },
  { id: 'OPENAI_COMPATIBLE', name: 'Custom OpenAI', description: '任意兼容 API' },
  { id: 'GEMINI', name: 'Google Gemini' },
  { id: 'ZHIPU', name: '智谱 GLM' },
  { id: 'REPLICATE_FAL_AI', name: 'Replicate', description: 'FAL.ai' }
]

export default {
  name: 'SettingsDialog',
  data() {
    return {
      // 主菜单
      activeMainMenu: 'model-settings',
      activeSubMenu: null,
      mainMenuItems: [
        { key: 'model-settings', label: '模型设置', icon: 'images/settings-model.svg' },
        { key: 'default-settings', label: '默认设置', icon: '⭐' },
        { key: 'assistant-settings', label: '助手设置', icon: '🧠' },
        { key: 'general', label: '常规设置', icon: '⚙️' }
      ],
      generalSubMenus: [
        { key: 'data', label: '数据设置' }
      ],
      // 模型设置用的清单：固定清单 + getDefaultModels 全部，带图标
      allModels: [],
      selectedModelId: null,
      selectedModel: null,
      settingsWindowSession: null,
      modelSearchText: '',
      modelInventorySearch: '',
      defaultModelId: null,
      // 默认模型分类（与 modelType 对应，仅显示设置中已开启的模型）
      modelCategories: [
        { key: 'chat', label: '对话模型', icon: '💬', modelType: 'chat' },
        { key: 'image', label: '图像生成模型', icon: '🎨', modelType: 'image' },
        { key: 'video', label: '视频生成模型', icon: '🎬', modelType: 'video' },
        { key: 'voice', label: '语音转换模型', icon: '🔊', modelType: 'voice' }
      ],
      activeCategory: 'chat',
      // 默认设置下选中的项：model category key 或 'chunk'
      activeDefaultSettingItem: 'chat',
      defaultModelsByCategory: {
        chat: null,
        image: null,
        video: null,
        voice: null
      },
      currentModelConfig: {
        apiKey: '',
        apiUrl: '',
        enabled: false,
        modelSeries: [] // 模型系列列表
      },
      showApiKey: false,
      // 数据路径
      dataPath: '',
      defaultPath: '',
      // 消息提示
      message: null,
      // 表单保存状态
      isFormSaved: false,
      // 添加模型供应商弹窗
      showAddModelDialog: false,
      addModelForm: {
        name: '',
        type: 'OPENAI',
        icon: ''
      },
      addModelMode: 'add',
      editingModelId: null,
      contextMenu: {
        visible: false,
        x: 0,
        y: 0,
        item: null,
        menuType: ''
      },
      dragState: {
        fromIndex: -1,
        dropIndex: -1,
        dropPosition: 'before'
      },
      assistantDragState: {
        groupKey: '',
        fromKey: '',
        dropKey: '',
        dropPosition: 'before'
      },
      customProvidersVersion: 0,
      modelOrder: [],
      modelInventoryList: [],
      vendorTypeOptions: [
        { id: 'OPENAI', name: 'OpenAI' },
        { id: 'OPENAI_RESPONSE', name: 'OpenAI-Response' },
        { id: 'GEMINI', name: 'Gemini' },
        { id: 'anthropic', name: 'Anthropic' },
        { id: 'azure-openai', name: 'Azure OpenAI' },
        { id: 'new-api', name: 'New API' },
        { id: 'CherryIN', name: 'CherryIN' },
        { id: 'OLLAMA', name: 'Ollama' }
      ],
      // 管理模型弹窗
      showManageModal: false,
      manageModelList: [],
      manageNewId: '',
      manageNewName: '',
      // 初始化错误（用于显示加载失败提示）
      initError: null,
      // 默认模型下拉是否展开
      defaultModelDropdownOpen: false,
      // 分组折叠状态：providerId -> true 表示折叠
      modelGroupCollapsed: {},
      // 段落截取设置（大文档分批处理）
      chunkSettings: {
        chunkLength: 4000,
        overlapLength: 200,
        splitStrategy: 'paragraph'
      },
      spellCheckCommentPolicy: {
        writeReviewComments: true
      },
      multimodalServerFallback: {
        enabled: false,
        endpoint: '',
        apiKey: ''
      },
      activeAssistantSettingItem: 'spell-check',
      assistantSettingsMap: {},
      customAssistants: [],
      assistantForm: createCustomAssistantDraft(),
      assistantPrefillNotice: null,
      assistantModelDropdownOpen: false,
      assistantPreviewInput: '',
      assistantPreviewTargetLanguage: '英文',
      assistantPreviewInputSource: 'selection-preferred',
      assistantPreviewDocumentAction: 'insert',
      showAssistantPromptRecommendDialog: false,
      assistantPromptRecommendationRequirement: '',
      assistantPromptRecommendationModelId: '',
      assistantPromptRecommendationModelDropdownOpen: false,
      latestAssistantPromptRecommendationTaskId: '',
      latestAssistantPromptRecommendationTargetKey: '',
      latestAppliedRecommendationRequestId: '',
      showAssistantIconPickerDialog: false,
      assistantIconPickerLibraries: getAssistantIconPickerLibraries(),
      assistantIconPickerActiveLibraryId: DEFAULT_ASSISTANT_ICON_LIBRARY_ID,
      assistantIconPickerOptionsByLibrary: {},
      assistantIconPickerLoading: false,
      assistantIconPickerError: '',
      assistantIconPickerSearchText: '',
      assistantIconPickerSelectedValue: DEFAULT_ASSISTANT_ICON,
      assistantIconPickerSelectedLabel: '',
      assistantIconPickerVisibleCount: 120,
      assistantDisplayLocationOptions: ASSISTANT_DISPLAY_LOCATION_OPTIONS,
      outputFormatOptions: OUTPUT_FORMAT_OPTIONS,
      inputSourceOptions: INPUT_SOURCE_OPTIONS,
      reportTypeGroups: getReportTypeGroups(),
      reportAssistantPresetGroups: getReportAssistantPresetGroups(),
      reportAssistantPresetCollapsedGroups: cloneValue(DEFAULT_REPORT_PRESET_COLLAPSED_GROUPS),
      reportAssistantPresetSearchText: '',
      backupHistoryRecords: [],
      selectedBackupRecordId: '',
      backupHistorySearchText: '',
      backupHistoryReasonFilter: '',
      evaluationHistoryRecords: [],
      selectedEvaluationRecordId: '',
      evaluationHistorySearchText: '',
      evaluationHistoryScenarioFilter: '',
      evaluationDashboard: null,
      regressionSampleRecords: [],
      selectedRegressionSampleId: '',
      regressionSampleGroupFilter: '',
      regressionSampleRiskFilter: '',
      regressionSampleTagsText: '',
      regressionSampleDraft: createRegressionSampleRecord({
        id: '',
        label: '',
        groupKey: 'default',
        riskLevel: 'medium',
        inputText: '',
        expectedDocumentAction: '',
        expectedInputSource: '',
        expectedTargetLanguage: '',
        expectedOutputFormat: '',
        critical: false,
        assistantId: '',
        tags: [],
        notes: ''
      }),
      isRunningFamilyRegression: false,
      regressionFamilyMaxVersions: 3,
      capabilityAuditRecords: [],
      selectedCapabilityAuditId: '',
      capabilityAuditSearchText: '',
      capabilityAuditNamespaceFilter: '',
      capabilityAuditStatusFilter: '',
      capabilityAuditRiskFilter: '',
      capabilityAuditSummary: null,
      capabilityPolicyCatalog: [],
      capabilityPolicyNamespace: 'wps',
      capabilityPolicyKey: '',
      capabilityPolicyForm: {
        enabled: true,
        defaultDecision: 'allow',
        requireConfirmationForHighRisk: false,
        perMinuteLimit: 0,
        perDayLimit: 0,
        allowedEntriesText: '',
        blockedEntriesText: ''
      },
      selectedBackupOperationId: '',
      isRunningAssistantRegression: false,
      isReplayingBackupRecord: false,
      isRestoringBackupRecord: false
    }
  },
  watch: {
    backupHistorySearchText() {
      this.syncSelectedBackupRecordWithFilters()
    },
    backupHistoryReasonFilter() {
      this.syncSelectedBackupRecordWithFilters()
    },
    evaluationHistorySearchText() {
      this.syncSelectedEvaluationRecordWithFilters()
    },
    evaluationHistoryScenarioFilter() {
      this.syncSelectedEvaluationRecordWithFilters()
    },
    capabilityAuditSearchText() {
      this.syncSelectedCapabilityAuditRecordWithFilters()
    },
    capabilityAuditNamespaceFilter() {
      this.syncSelectedCapabilityAuditRecordWithFilters()
    },
    capabilityAuditStatusFilter() {
      this.syncSelectedCapabilityAuditRecordWithFilters()
    },
    capabilityAuditRiskFilter() {
      this.syncSelectedCapabilityAuditRecordWithFilters()
    },
    capabilityPolicyNamespace() {
      this.capabilityPolicyKey = ''
      this.loadCapabilityPolicyEditor()
    },
    capabilityPolicyKey() {
      this.loadCapabilityPolicyEditor()
    }
  },
  computed: {
    generalSubMenusDisplay() {
      return this.generalSubMenus.map((item) => ({
        ...item,
        icon: this.resolveAutoGeneralSubmenuIcon(item)
      }))
    },
    errorLogDirectoryDisplay() {
      return getErrorLogDirectoryForDataPath(this.dataPath)
    },
    filteredModels() {
      if (!this.modelSearchText) {
        return this.allModels
      }
      const search = this.modelSearchText.toLowerCase()
      return this.allModels.filter(
        model => model.name.toLowerCase().includes(search) || model.id.toLowerCase().includes(search)
      )
    },
    // 模型设置左侧清单（用于默认模型选择等，只读）
    modelListForSettings() {
      this.customProvidersVersion
      return this.modelInventoryList
    },
    selectedModelDescription() {
      return this.selectedModel?.description || ''
    },
    filteredModelInventory() {
      if (!this.modelInventorySearch) return this.modelInventoryList
      const search = this.modelInventorySearch.toLowerCase()
      return this.modelInventoryList.filter(
        m => m.name.toLowerCase().includes(search) || m.id.toLowerCase().includes(search)
      )
    },
    // 默认设置下的设置项列表（模型分类 + 段落截取设置）
    defaultSettingsItems() {
      const modelItems = this.modelCategories.map(c => ({
        key: c.key,
        label: c.label,
        icon: c.icon,
        modelType: c.modelType,
        type: 'model'
      }))
      return [
        ...modelItems,
        { key: 'chunk', label: '段落截取设置', icon: '📄', type: 'chunk' }
      ]
    },
    // 当前选中的默认设置项
    currentDefaultSettingItem() {
      return this.defaultSettingsItems.find(i => i.key === this.activeDefaultSettingItem)
    },
    // 当前分类的模型分组（按 provider 分组，带图标，按类型过滤）
    modelGroupsForCurrentCategory() {
      const modelType = this.currentDefaultSettingItem?.modelType
      if (!modelType) return []
      return getModelGroupsFromSettings(modelType)
    },
    // 当前选中的默认模型（用于下拉展示）
    selectedDefaultModel() {
      const modelId = this.defaultModelsByCategory[this.activeDefaultSettingItem]
      if (!modelId) return null
      for (const g of this.modelGroupsForCurrentCategory) {
        const m = g.models.find(x => x.id === modelId)
        if (m) return m
      }
      return null
    },
    selectedDefaultModelDisplayName() {
      const m = this.selectedDefaultModel
      return m ? (m.name || m.modelId) : '未设置'
    },
    selectedDefaultModelIcon() {
      const m = this.selectedDefaultModel
      if (!m) return ''
      return getModelLogoPath(m.providerId) || 'images/ai-assistant.svg'
    },
    assistantSettingsItems() {
      return getAssistantSettingItems(this.customAssistants, this.assistantSettingsMap)
    },
    assistantSettingGroups() {
      const groups = {}
      this.assistantSettingsItems.forEach(item => {
        if (!groups[item.group]) groups[item.group] = []
        groups[item.group].push(item)
      })
      return Object.keys(groups).map(key => ({
        key,
        label: getAssistantGroupLabel(key),
        items: this.sortAssistantItems(groups[key])
      }))
    },
    currentAssistantSettingItem() {
      return this.assistantSettingsItems.find(item => item.key === this.activeAssistantSettingItem) || null
    },
    assistantContextMenuItem() {
      return this.contextMenu.menuType === 'assistant' ? this.contextMenu.item : null
    },
    canDeleteAssistantContextMenuItem() {
      return this.assistantContextMenuItem?.type === 'custom-assistant'
    },
    currentAssistantDefinition() {
      if (this.currentAssistantSettingItem?.type !== 'system-assistant') return null
      return getBuiltinAssistantDefinition(this.currentAssistantSettingItem.key)
    },
    selectedBackupRecord() {
      return this.backupHistoryRecords.find(item => item.id === this.selectedBackupRecordId) || null
    },
    selectedEvaluationRecord() {
      return this.evaluationHistoryRecords.find(item => item.id === this.selectedEvaluationRecordId) || null
    },
    selectedCapabilityAuditRecord() {
      return this.capabilityAuditRecords.find(item => item.id === this.selectedCapabilityAuditId) || null
    },
    filteredBackupHistoryRecords() {
      const search = String(this.backupHistorySearchText || '').trim().toLowerCase()
      const reasonFilter = String(this.backupHistoryReasonFilter || '').trim()
      return this.backupHistoryRecords.filter(item => {
        if (reasonFilter && String(item?.reason || '').trim() !== reasonFilter) {
          return false
        }
        if (!search) return true
        const haystack = [
          item?.documentName,
          item?.sourcePath,
          item?.backupPath,
          item?.assistantId,
          item?.taskId,
          item?.reason,
          item?.launchSource,
          item?.metadata?.summary
        ]
          .map(value => String(value || '').toLowerCase())
          .join('\n')
        return haystack.includes(search)
      })
    },
    filteredEvaluationHistoryRecords() {
      const search = String(this.evaluationHistorySearchText || '').trim().toLowerCase()
      const scenarioFilter = String(this.evaluationHistoryScenarioFilter || '').trim()
      return this.evaluationHistoryRecords.filter(item => {
        if (scenarioFilter && String(item?.scenarioType || '').trim() !== scenarioFilter) {
          return false
        }
        if (!search) return true
        const haystack = [
          item?.title,
          item?.summary,
          item?.scenarioType,
          item?.ownerType,
          item?.ownerId,
          item?.inputPreview,
          item?.outputPreview
        ].map(value => String(value || '').toLowerCase()).join('\n')
        return haystack.includes(search)
      })
    },
    filteredCapabilityAuditRecords() {
      const search = String(this.capabilityAuditSearchText || '').trim().toLowerCase()
      const namespaceFilter = String(this.capabilityAuditNamespaceFilter || '').trim()
      const statusFilter = String(this.capabilityAuditStatusFilter || '').trim()
      const riskFilter = String(this.capabilityAuditRiskFilter || '').trim()
      return this.capabilityAuditRecords.filter(item => {
        if (namespaceFilter && String(item?.namespace || '').trim() !== namespaceFilter) {
          return false
        }
        if (statusFilter && String(item?.status || '').trim() !== statusFilter) {
          return false
        }
        if (riskFilter && String(item?.riskLevel || '').trim() !== riskFilter) {
          return false
        }
        if (!search) return true
        const haystack = [
          item?.capabilityKey,
          item?.capabilityLabel,
          item?.namespace,
          item?.entry,
          item?.launchSource,
          item?.status,
          item?.workflowName,
          item?.taskId,
          item?.requirementText,
          item?.paramsPreview,
          item?.resultPreview,
          item?.errorMessage
        ].map(value => String(value || '').toLowerCase()).join('\n')
        return haystack.includes(search)
      })
    },
    capabilityPolicyNamespaceOptions() {
      const namespaceList = listNamespacePolicies()
      const dynamicNamespaces = new Set((this.capabilityPolicyCatalog || []).map(item => String(item?.namespace || '').trim()).filter(Boolean))
      namespaceList.forEach(item => dynamicNamespaces.add(String(item?.namespace || '').trim()))
      return [...dynamicNamespaces].filter(Boolean)
    },
    capabilityPolicyOptions() {
      return (this.capabilityPolicyCatalog || [])
        .filter(item => String(item?.namespace || '').trim() === String(this.capabilityPolicyNamespace || '').trim())
        .sort((a, b) => String(a?.label || a?.key || '').localeCompare(String(b?.label || b?.key || '')))
    },
    capabilityPolicyResolvedRiskLevel() {
      const key = String(this.capabilityPolicyKey || '').trim()
      if (!key) return 'low'
      return getCapabilityRiskLevel(`${this.capabilityPolicyNamespace}.${key}`)
    },
    selectedBackupLinkedTask() {
      const taskId = String(this.selectedBackupRecord?.taskId || '').trim()
      if (!taskId) return null
      return getTaskById(taskId)
    },
    selectedBackupReplayMode() {
      const task = this.selectedBackupLinkedTask
      if (!task) return ''
      if (task?.data?.pendingApply === true || String(task?.data?.progressStage || '').trim() === 'awaiting_confirmation') {
        return 'apply-plan'
      }
      if (task?.data?.retryPayload?.assistantId || task?.data?.assistantId) {
        return 'retry-task'
      }
      return ''
    },
    selectedBackupOperationBatch() {
      const linkedTask = this.selectedBackupLinkedTask
      const batchId = String(linkedTask?.data?.operationLedgerBatch?.id || '').trim()
      if (!batchId) return null
      return getDocumentOperationBatchById(batchId)
    },
    selectedBackupOperationEntries() {
      return Array.isArray(this.selectedBackupOperationBatch?.operations) ? this.selectedBackupOperationBatch.operations : []
    },
    selectedBackupOperationEntry() {
      return this.selectedBackupOperationEntries.find(item => item.id === this.selectedBackupOperationId) || this.selectedBackupOperationEntries[0] || null
    },
    selectedEvaluationLinkedTask() {
      if (String(this.selectedEvaluationRecord?.ownerType || '').trim() !== 'task') return null
      const taskId = String(this.selectedEvaluationRecord?.ownerId || '').trim()
      if (!taskId) return null
      return getTaskById(taskId)
    },
    selectedEvaluationAssistantId() {
      const ownerType = String(this.selectedEvaluationRecord?.ownerType || '').trim()
      if (ownerType === 'assistant-version' || ownerType === 'assistant-regression') {
        return String(this.selectedEvaluationRecord?.metadata?.assistantId || '').trim()
      }
      return ''
    },
    filteredRegressionSampleRecords() {
      const assistantId = this.selectedEvaluationAssistantId
      const groupFilter = String(this.regressionSampleGroupFilter || '').trim()
      const riskFilter = String(this.regressionSampleRiskFilter || '').trim()
      return (this.regressionSampleRecords || []).filter((item) => {
        const itemAssistantId = String(item?.assistantId || '').trim()
        if (!assistantId) {
          if (itemAssistantId) return false
        } else if (itemAssistantId && itemAssistantId !== assistantId) {
          return false
        }
        if (groupFilter && String(item?.groupKey || '').trim() !== groupFilter) return false
        if (riskFilter && String(item?.riskLevel || '').trim() !== riskFilter) return false
        return true
      })
    },
    regressionSampleGroupOptions() {
      const assistantId = this.selectedEvaluationAssistantId
      const values = new Set()
      ;(this.regressionSampleRecords || []).forEach((item) => {
        const itemAssistantId = String(item?.assistantId || '').trim()
        if (assistantId) {
          if (itemAssistantId && itemAssistantId !== assistantId) return
        } else if (itemAssistantId) {
          return
        }
        const groupKey = String(item?.groupKey || '').trim()
        if (groupKey) values.add(groupKey)
      })
      return [...values].sort((a, b) => a.localeCompare(b))
    },
    selectedRegressionSample() {
      return this.filteredRegressionSampleRecords.find(item => item.id === this.selectedRegressionSampleId) || null
    },
    canRunSelectedAssistantFamilyRegression() {
      const ownerType = String(this.selectedEvaluationRecord?.ownerType || '').trim()
      return (ownerType === 'assistant-version' || ownerType === 'assistant-regression') && !this.isRunningFamilyRegression
    },
    selectedCapabilityAuditLinkedTask() {
      const taskId = String(this.selectedCapabilityAuditRecord?.taskId || '').trim()
      if (!taskId) return null
      return getTaskById(taskId)
    },
    selectedEvaluationMetricLines() {
      const metrics = this.selectedEvaluationRecord?.metrics
      if (!metrics || typeof metrics !== 'object') return []
      return Object.keys(metrics)
        .filter(key => metrics[key] !== undefined && metrics[key] !== null && metrics[key] !== '')
        .map(key => `${this.getEvaluationMetricLabel(key)}：${this.formatEvaluationMetricValue(metrics[key])}`)
    },
    selectedEvaluationSummaryAuditLines() {
      const record = this.selectedEvaluationRecord
      const contextMeta = record?.metadata?.contextMeta
      if (!record || record?.sampleType !== 'summary-audit' || !contextMeta || typeof contextMeta !== 'object') return []
      const memoryRecords = listChatMemoryRecords({
        chatId: record?.metadata?.chatId,
        scopeKey: contextMeta?.scopeKey || ''
      }).slice(0, 4)
      return [
        contextMeta?.budgetLevel ? `预算档位：${this.getEvaluationSampleTypeLabel(contextMeta.budgetLevel)}` : '',
        contextMeta?.budgetReason ? `预算原因：${contextMeta.budgetReason}` : '',
        Number.isFinite(Number(contextMeta?.summaryQualityScore)) ? `摘要质量分：${Math.round(Number(contextMeta.summaryQualityScore))}` : '',
        Number.isFinite(Number(contextMeta?.memoryCount)) ? `长期记忆条数：${Math.round(Number(contextMeta.memoryCount))}` : '',
        Number.isFinite(Number(contextMeta?.averageMemoryQualityScore)) ? `记忆平均质量分：${Math.round(Number(contextMeta.averageMemoryQualityScore))}` : '',
        ...memoryRecords.map(item => `记忆命中：${item.title || '聊天记忆'} | 质量 ${Number(item.qualityScore || 0)} | ${item.summary || item.content || '未记录摘要'}`)
      ].filter(Boolean)
    },
    selectedEvaluationRegressionLines() {
      const record = this.selectedEvaluationRecord
      const regressionResults = Array.isArray(record?.metadata?.regressionResults) ? record.metadata.regressionResults : []
      const sampleResults = Array.isArray(record?.metadata?.sampleResults) ? record.metadata.sampleResults : []
      if (!regressionResults.length && !sampleResults.length) return []
      const resultLines = regressionResults.slice(0, 6).map(item => {
        const winner = item?.winner === 'candidate' ? '候选版本' : '基线版本'
        return `${item.label || '对比样本'}：候选 ${item.candidateScore || 0} / 基线 ${item.baselineScore || 0}，当前更优：${winner}`
      })
      const failedLines = sampleResults.filter(item => item?.ok !== true).slice(0, 6).map(item => (
        `${item.label || '样本'}：未通过${item?.critical ? '（关键样本）' : ''}，得分 ${item?.score || 0}`
      ))
      return [...failedLines, ...resultLines].filter(Boolean)
    },
    canRunSelectedAssistantRegression() {
      const ownerType = String(this.selectedEvaluationRecord?.ownerType || '').trim()
      return (ownerType === 'assistant-version' || ownerType === 'assistant-regression') && !this.isRunningAssistantRegression
    },
    selectedCapabilityAuditPreviewLines() {
      const record = this.selectedCapabilityAuditRecord
      if (!record) return []
      return [
        record.riskLevel ? `风险等级：${this.getCapabilityAuditRiskLabel(record.riskLevel)}` : '',
        record.decision ? `策略结果：${this.getCapabilityAuditDecisionLabel(record.decision)}` : '',
        record.requirementText ? `需求摘要：${record.requirementText}` : '',
        record.paramsPreview ? `请求参数：${record.paramsPreview}` : '',
        record.resultPreview ? `执行结果：${record.resultPreview}` : '',
        record.errorMessage ? `错误信息：${record.errorMessage}` : ''
      ].filter(Boolean)
    },
    selectedBackupOperationPreviewLines() {
      const entry = this.selectedBackupOperationEntry
      if (!entry) return []
      return [
        `动作：${entry.action || '未记录'}`,
        entry.replayable === false ? `重放状态：不可重放（${entry.replaySupportReason || '未记录原因'}）` : '重放状态：可重放',
        entry.originalText ? `原文：${entry.originalText}` : '',
        entry.outputText ? `结果：${entry.outputText}` : '',
        Array.isArray(entry.styleIssues) && entry.styleIssues.length > 0 ? `样式风险：${entry.styleIssues.join('、')}` : ''
      ].filter(Boolean)
    },
    selectedBackupDiffPreviewLines() {
      const record = this.selectedBackupRecord
      if (!record) return []
      const linkedTask = this.selectedBackupLinkedTask
      const lines = []
      const metadataAction = String(record?.metadata?.action || '').trim()
      const metadataSummary = String(record?.metadata?.summary || '').trim()
      const resultSummary = String(linkedTask?.data?.resultSummary || linkedTask?.data?.outputPreview || '').trim()
      if (metadataAction) {
        lines.push(`计划动作：${metadataAction}`)
      }
      if (metadataSummary) {
        lines.push(`执行摘要：${metadataSummary}`)
      }
      if (resultSummary) {
        lines.push(`回填结果：${resultSummary}`)
      }
      const writeTargets = Array.isArray(linkedTask?.data?.writeTargets) ? linkedTask.data.writeTargets : []
      writeTargets.slice(0, 8).forEach((target, index) => {
        const scope = String(target?.scopeLabel || target?.scope || target?.targetType || '').trim() || `目标 ${index + 1}`
        const beforeText = String(target?.originalText || target?.sourceText || '').replace(/\s+/g, ' ').trim()
        const afterText = String(target?.replacementText || target?.text || target?.resultText || '').replace(/\s+/g, ' ').trim()
        const summary = String(target?.summary || '').trim()
        if (beforeText || afterText) {
          lines.push(`${scope}：${beforeText || '（原文未记录）'} -> ${afterText || '（结果未记录）'}`)
        } else if (summary) {
          lines.push(`${scope}：${summary}`)
        }
      })
      if (writeTargets.length > 8) {
        lines.push(`其余 ${writeTargets.length - 8} 项改动请打开关联任务查看。`)
      }
      const progressEvents = Array.isArray(linkedTask?.data?.progressEvents) ? linkedTask.data.progressEvents : []
      progressEvents.slice(-2).forEach(item => {
        const text = String(item || '').trim()
        if (text) {
          lines.push(`执行轨迹：${text}`)
        }
      })
      return lines.slice(0, 12)
    },
    currentAssistantDefaultCategoryKey() {
      if (this.currentAssistantDefinition) {
        return this.currentAssistantDefinition.defaultModelCategory || null
      }
      return this.assistantForm?.modelType || this.currentAssistantSettingItem?.modelType || 'chat'
    },
    currentAssistantDefaultCategoryLabel() {
      const key = this.currentAssistantDefaultCategoryKey
      const category = this.modelCategories.find(item => item.key === key)
      return category?.label || '默认模型'
    },
    assistantModelGroupsForCurrentItem() {
      const modelType = this.assistantForm?.modelType || this.currentAssistantSettingItem?.modelType || 'chat'
      return getModelGroupsFromSettings(modelType)
    },
    resolvedAssistantModelState() {
      const modelType = this.assistantForm?.modelType || this.currentAssistantSettingItem?.modelType || 'chat'
      const flatModels = getFlatModelsFromSettings(modelType)
      const shouldFallbackToChat = modelType === 'chat'
      const resolveModel = (modelId) => {
        if (!modelId) return null
        const found = flatModels.find(item => item.id === modelId)
        if (found) return found
        const parsed = parseModelCompositeId(modelId)
        if (!parsed) return null
        if (inferModelType(parsed.modelId) !== modelType) return null
        return {
          id: modelId,
          providerId: parsed.providerId,
          modelId: parsed.modelId,
          name: parsed.modelId,
          type: modelType
        }
      }

      if (this.assistantForm?.modelId) {
        return {
          source: 'explicit',
          model: resolveModel(this.assistantForm.modelId),
          categoryKey: null
        }
      }

      const categoryKey = this.currentAssistantDefaultCategoryKey
      if (categoryKey && this.defaultModelsByCategory[categoryKey]) {
        return {
          source: 'category-default',
          model: resolveModel(this.defaultModelsByCategory[categoryKey]),
          categoryKey
        }
      }

      if (shouldFallbackToChat && this.defaultModelsByCategory.chat) {
        return {
          source: 'chat-default',
          model: resolveModel(this.defaultModelsByCategory.chat),
          categoryKey: 'chat'
        }
      }

      return {
        source: 'unset',
        model: null,
        categoryKey: categoryKey || 'chat'
      }
    },
    selectedAssistantModel() {
      return this.resolvedAssistantModelState.model
    },
    selectedAssistantModelDisplayName() {
      const m = this.selectedAssistantModel
      if (!m) return '跟随默认设置'
      return m.name || m.modelId
    },
    selectedAssistantModelIcon() {
      const m = this.selectedAssistantModel
      if (!m) return ''
      return getModelLogoPath(m.providerId) || 'images/ai-assistant.svg'
    },
    assistantModelTypeRestrictionHint() {
      const modelType = this.assistantForm?.modelType || this.currentAssistantSettingItem?.modelType || 'chat'
      const typeLabel = getModelTypeLabel(modelType)
      return `此助手为${typeLabel}型，仅显示${typeLabel}模型。`
    },
    assistantModelHint() {
      if (this.assistantForm?.modelId) {
        return '当前已为该助手单独指定模型，会优先于默认设置生效。'
      }
      const state = this.resolvedAssistantModelState
      if (!state.model) {
        return `当前未单独指定模型；保存后会自动继承“${this.currentAssistantDefaultCategoryLabel || '默认模型'}”。`
      }
      if (state.source === 'category-default') {
        return `当前未单独指定模型，已自动继承“${this.currentAssistantDefaultCategoryLabel}”。`
      }
      if (state.source === 'chat-default') {
        return '当前未单独指定模型，已自动继承“对话模型”。'
      }
      return '当前模型来源于默认设置。'
    },
    canRecommendCustomAssistantPrompt() {
      return !!this.currentAssistantSettingItem
    },
    assistantPromptRecommendationActionLabel() {
      return this.currentAssistantSettingItem?.type === 'custom-assistant' ? '智能优化' : '智能推荐'
    },
    assistantPromptRecommendationTargetLabel() {
      if (this.currentAssistantSettingItem?.type === 'system-assistant') {
        return this.assistantForm?.title?.trim() || this.currentAssistantSettingItem?.label || '当前内置助手'
      }
      if (this.currentAssistantSettingItem?.type === 'custom-assistant') {
        return this.assistantForm?.name?.trim() || this.currentAssistantSettingItem?.label || '当前自定义助手'
      }
      return this.assistantForm?.name?.trim() || '新增助手草稿'
    },
    assistantPromptRecommendationModelGroups() {
      return getModelGroupsFromSettings('chat')
    },
    resolvedAssistantPromptRecommendationModelState() {
      const flatModels = getFlatModelsFromSettings('chat')
      const resolveModel = (modelId) => {
        if (!modelId) return null
        const found = flatModels.find(item => item.id === modelId)
        if (found) return found
        const parsed = parseModelCompositeId(modelId)
        if (!parsed) return null
        return {
          id: modelId,
          providerId: parsed.providerId,
          modelId: parsed.modelId,
          name: parsed.modelId,
          type: 'chat'
        }
      }
      if (this.assistantPromptRecommendationModelId) {
        return {
          source: 'explicit',
          model: resolveModel(this.assistantPromptRecommendationModelId)
        }
      }
      return this.resolvedAssistantModelState
    },
    selectedAssistantPromptRecommendationModel() {
      return this.resolvedAssistantPromptRecommendationModelState.model
    },
    selectedAssistantPromptRecommendationModelDisplayName() {
      const model = this.selectedAssistantPromptRecommendationModel
      if (!model) return '继承当前助手解析模型'
      return model.name || model.modelId
    },
    selectedAssistantPromptRecommendationModelIcon() {
      const model = this.selectedAssistantPromptRecommendationModel
      if (!model) return ''
      return getModelLogoPath(model.providerId) || 'images/ai-assistant.svg'
    },
    assistantPromptRecommendationModelSourceLabel() {
      const source = this.resolvedAssistantPromptRecommendationModelState?.source
      if (source === 'explicit') return '本次单独指定'
      if (source === 'category-default') return `继承${this.currentAssistantDefaultCategoryLabel}`
      if (source === 'chat-default') return '继承对话模型'
      return '继承当前助手解析模型'
    },
    assistantPromptRecommendationModelHint() {
      const model = this.selectedAssistantPromptRecommendationModel
      if (!model) {
        return '当前没有可用的对话模型，请先在默认设置或当前助手中指定模型后再进行智能推荐。'
      }
      return `将使用 ${model.name || model.modelId}（${model.providerId}，${this.assistantPromptRecommendationModelSourceLabel}）为你自动生成提示词与推荐设置。`
    },
    activeAssistantIconPickerLibrary() {
      return this.assistantIconPickerLibraries.find(item => item.id === this.assistantIconPickerActiveLibraryId) || null
    },
    activeAssistantIconPickerOptions() {
      return this.assistantIconPickerOptionsByLibrary[this.assistantIconPickerActiveLibraryId] || []
    },
    filteredAssistantIconPickerOptions() {
      const keyword = String(this.assistantIconPickerSearchText || '').trim().toLowerCase()
      if (!keyword) return this.activeAssistantIconPickerOptions
      return this.activeAssistantIconPickerOptions.filter(item => (
        String(item.label || '').toLowerCase().includes(keyword) ||
        String(item.keywords || '').includes(keyword)
      ))
    },
    visibleAssistantIconPickerOptions() {
      return this.filteredAssistantIconPickerOptions.slice(0, this.assistantIconPickerVisibleCount)
    },
    canLoadMoreAssistantIconPickerOptions() {
      return this.filteredAssistantIconPickerOptions.length > this.visibleAssistantIconPickerOptions.length
    },
    currentAssistantDocumentActionOptions() {
      const systemId = this.currentAssistantSettingItem?.type === 'system-assistant'
        ? this.currentAssistantSettingItem.key
        : null
      return getDocumentActionOptions(systemId)
    },
    supportsReportSettings() {
      const modelType = this.assistantForm?.modelType || this.currentAssistantSettingItem?.modelType || 'chat'
      const outputFormat = String(this.assistantForm?.outputFormat || '').trim().toLowerCase()
      return modelType === 'chat' && outputFormat !== 'json'
    },
    canApplyReportAssistantPreset() {
      return this.currentAssistantSettingItem?.type === 'create-custom-assistant'
    },
    filteredReportAssistantPresetGroups() {
      const kw = String(this.reportAssistantPresetSearchText || '').trim().toLowerCase()
      if (!kw) return this.reportAssistantPresetGroups
      return this.reportAssistantPresetGroups
        .map(group => {
          const groupMatch = (group.label + ' ' + (group.description || '')).toLowerCase().includes(kw)
          const filteredPresets = group.presets.filter(p =>
            (p.label + ' ' + (p.description || '')).toLowerCase().includes(kw)
          )
          if (groupMatch) return { ...group, presets: group.presets }
          if (filteredPresets.length) return { ...group, presets: filteredPresets }
          return null
        })
        .filter(Boolean)
    },
    reportAssistantPresetCollapsedAll() {
      return this.filteredReportAssistantPresetGroups.every(group => this.isReportAssistantPresetGroupCollapsed(group.key))
    },
    normalizedAssistantReportSettings() {
      return normalizeReportSettings(this.assistantForm?.reportSettings, createDefaultReportSettings())
    },
    assistantPreviewReportTypeLabel() {
      const reportSettings = this.normalizedAssistantReportSettings
      return getReportTypeLabel(reportSettings.type, reportSettings.customType)
    },
    assistantPreviewName() {
      return this.assistantForm?.title || this.assistantForm?.name || this.currentAssistantSettingItem?.shortLabel || this.currentAssistantSettingItem?.label || '智能助手'
    },
    assistantRecommendationRequirementExample() {
      return this.buildAssistantRecommendationRequirementExample(this.currentAssistantSettingItem, this.assistantForm)
    },
    assistantRecommendationRequirementPlaceholder() {
      const example = String(this.assistantRecommendationRequirementExample || '').trim()
      if (!example) {
        return '可先写下这个助手长期要做什么、适合什么场景、希望怎样输出。'
      }
      return `例如：${example}`
    },
    assistantPreviewEffectiveTargetLanguage() {
      return this.assistantPreviewTargetLanguage || this.assistantForm?.targetLanguage || '英文'
    },
    assistantResolvedModelSourceLabel() {
      const state = this.resolvedAssistantModelState
      if (state.source === 'explicit') return '单独指定'
      if (state.source === 'category-default') return `继承${this.currentAssistantDefaultCategoryLabel}`
      if (state.source === 'chat-default') return '继承对话模型'
      return '未解析'
    },
    assistantResolvedModelDescription() {
      const model = this.selectedAssistantModel
      if (!model) {
        return '当前尚未解析到可用模型，请先在默认设置或当前助手中指定模型。'
      }
      return `${model.name || model.modelId}（${model.providerId}）`
    },
    assistantPreviewInputSourceLabel() {
      const found = this.inputSourceOptions.find(item => item.value === this.assistantPreviewInputSource)
      return found?.label || this.assistantPreviewInputSource
    },
    assistantPreviewDocumentActionLabel() {
      const found = this.currentAssistantDocumentActionOptions.find(item => item.value === this.assistantPreviewDocumentAction)
      return found?.label || this.assistantPreviewDocumentAction
    },
    renderedAssistantSystemPrompt() {
      const parts = []
      if (this.assistantForm?.persona) {
        parts.push(`角色设定：${this.assistantForm.persona}`)
      }
      if (this.assistantForm?.systemPrompt) {
        parts.push(this.assistantForm.systemPrompt)
      }
      if (this.supportsReportSettings && this.normalizedAssistantReportSettings.enabled) {
        parts.push(
          `当前输出模式：生成${this.assistantPreviewReportTypeLabel}。\n请保持专业、克制、可审阅；结论需要与原文证据对应，缺失信息需明确写明“原文未说明”或“需人工复核”。`
        )
        if (this.normalizedAssistantReportSettings.prompt) {
          parts.push(`报告附加要求：${this.normalizedAssistantReportSettings.prompt}`)
        }
      }
      return parts.join('\n\n').trim() || '未设置系统提示词'
    },
    renderedAssistantUserPrompt() {
      const template = String(this.assistantForm?.userPromptTemplate || '{{input}}')
      const variables = {
        input: this.assistantPreviewInput || '请在此输入一段测试文本，预览这里会显示实际传给模型的用户提示词。',
        targetLanguage: this.assistantPreviewEffectiveTargetLanguage,
        assistantName: this.assistantPreviewName,
        source: this.assistantPreviewInputSource || this.assistantForm?.inputSource || 'selection-preferred',
        aspectRatio: this.assistantForm?.mediaOptions?.aspectRatio || '16:9',
        duration: this.assistantForm?.mediaOptions?.duration || '8s',
        voiceStyle: this.assistantForm?.mediaOptions?.voiceStyle || '专业自然',
        reportType: this.assistantPreviewReportTypeLabel
      }
      const basePromptVariables = this.supportsReportSettings && this.normalizedAssistantReportSettings.enabled
        ? { ...variables, input: '【材料全文见下方，不要在本节重复转述原文】' }
        : variables
      const basePrompt = template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
        const value = basePromptVariables[key]
        return value == null ? '' : String(value)
      })
      if (!(this.supportsReportSettings && this.normalizedAssistantReportSettings.enabled)) {
        return basePrompt
      }
      const renderedTemplate = renderReportTemplate(this.normalizedAssistantReportSettings.template, {
        ...variables,
        reportType: this.assistantPreviewReportTypeLabel
      }).trim()
      return [
        `请基于全文材料生成一份${this.assistantPreviewReportTypeLabel}。`,
        '报告格式：',
        renderedTemplate || `# ${this.assistantPreviewReportTypeLabel}`,
        '',
        '原始任务要求：',
        basePrompt,
        '',
        '材料全文：',
        '---',
        variables.input,
        '---'
      ].join('\n')
    }
  },
  mounted() {
    this.settingsWindowSession = createSettingsWindowSession((query) => {
      this.handleSettingsWindowRequest(query)
    })
    const claimed = this.settingsWindowSession.claimOwnership(this.$route?.query || {})
    if (!claimed.ok && claimed.reason === 'duplicate') {
      window.setTimeout(() => {
        this.closeWindow()
      }, 80)
      return
    }
    try {
      this.refreshModelInventoryList()
      this.loadModels()
      this.loadDataPath()
      this.loadDefaultModel()
      this.loadChunkSettings()
      this.loadSpellCheckCommentPolicy()
      this.loadAssistantConfigData()
      this.loadAssistantPromptRecommendationDraft()
      this.applyInitialMenuSelection()
      this.normalizeActiveMainMenuIfHidden()
      // 模型设置下默认选中清单第一项；默认模型下不在此处选中
      this.$nextTick(() => {
        try {
          const list = this.modelListForSettings
          if (this.activeMainMenu === 'model-settings' && list && list.length > 0) {
            this.selectModel(list[0])
          }
        } catch (e) {
          console.warn('selectModel failed:', e)
        }
        setTimeout(() => {
          if (window.focus) window.focus()
        }, 100)
      })
    } catch (e) {
      console.error('SettingsDialog mounted error:', e)
      this.initError = (e && e.message) || String(e)
    }
    window.addEventListener('focus', this.onWindowFocus)
    window.addEventListener('blur', this.onWindowBlur)
    window.addEventListener('storage', this.onAssistantRecommendationApplyStorage)
    this.consumeAssistantRecommendationApplyRequest()
  },
  beforeDestroy() {
    window.removeEventListener('focus', this.onWindowFocus)
    window.removeEventListener('blur', this.onWindowBlur)
    window.removeEventListener('storage', this.onAssistantRecommendationApplyStorage)
    document.removeEventListener('click', this.hideContextMenu)
    this.settingsWindowSession?.releaseOwnership?.()
    this.settingsWindowSession = null
  },
  methods: {
    getModelTypeLabel,
    inferModelType,
    getModelLogoPath,
    getAssistantGroupLabel,
    getProviderApiKeyUrl,
    closeWindow() {
      try {
        if (window.close) window.close()
      } catch (_) {}
    },
    handleSettingsWindowRequest(query = {}) {
      const menu = String(query?.menu || '').trim()
      const item = String(query?.item || '').trim()
      const nextQuery = {}
      if (menu) nextQuery.menu = menu
      if (item) nextQuery.item = item
      const currentMenu = String(this.$route?.query?.menu || '').trim()
      const currentItem = String(this.$route?.query?.item || '').trim()
      const sameQuery = currentMenu === String(nextQuery.menu || '') && currentItem === String(nextQuery.item || '')
      if (!sameQuery) {
        this.$router.replace({ path: this.$route?.path || '/settings', query: nextQuery }).catch(() => {})
      }
      if (menu === 'assistant-settings') {
        this.activeMainMenu = 'assistant-settings'
        if (item) {
          this.activeAssistantSettingItem = item
        }
        this.$nextTick(() => {
          this.loadAssistantFormForItem(this.activeAssistantSettingItem)
        })
      } else if (menu === 'model-settings') {
        this.selectMainMenu('model-settings')
      } else if (!menu) {
        this.$nextTick(() => {
          this.applyInitialMenuSelection()
        })
      }
    },
    isAssistantIconImage(icon) {
      return isAssistantImageIcon(icon)
    },
    getAssistantIconSrc(icon) {
      const normalized = normalizeAssistantIcon(icon || DEFAULT_ASSISTANT_ICON)
      return /^data:image\//.test(normalized) ? normalized : this.getImageSrc(normalized)
    },
    async ensureAssistantIconPickerLibraryOptions(libraryId) {
      const normalizedLibraryId = String(libraryId || '').trim() || DEFAULT_ASSISTANT_ICON_LIBRARY_ID
      if (this.assistantIconPickerOptionsByLibrary[normalizedLibraryId]) {
        return this.assistantIconPickerOptionsByLibrary[normalizedLibraryId]
      }
      this.assistantIconPickerLoading = true
      this.assistantIconPickerError = ''
      try {
        const options = await loadAssistantIconLibraryOptions(normalizedLibraryId)
        this.assistantIconPickerOptionsByLibrary = {
          ...this.assistantIconPickerOptionsByLibrary,
          [normalizedLibraryId]: options
        }
        return options
      } catch (error) {
        this.assistantIconPickerError = error?.message || '加载图标库失败，请稍后重试'
        return []
      } finally {
        this.assistantIconPickerLoading = false
      }
    },
    async openAssistantIconPickerDialog() {
      this.assistantIconPickerSearchText = ''
      this.assistantIconPickerVisibleCount = 120
      this.assistantIconPickerSelectedValue = normalizeAssistantIcon(this.assistantForm.icon || DEFAULT_ASSISTANT_ICON)
      this.assistantIconPickerSelectedLabel = '当前助手图标'
      this.assistantIconPickerActiveLibraryId = DEFAULT_ASSISTANT_ICON_LIBRARY_ID
      this.showAssistantIconPickerDialog = true
      await this.ensureAssistantIconPickerLibraryOptions(this.assistantIconPickerActiveLibraryId)
    },
    closeAssistantIconPickerDialog() {
      this.showAssistantIconPickerDialog = false
      this.assistantIconPickerError = ''
    },
    async switchAssistantIconPickerLibrary(libraryId) {
      const nextLibraryId = String(libraryId || '').trim()
      if (!nextLibraryId || nextLibraryId === this.assistantIconPickerActiveLibraryId) return
      this.assistantIconPickerActiveLibraryId = nextLibraryId
      this.assistantIconPickerSearchText = ''
      this.assistantIconPickerVisibleCount = 120
      await this.ensureAssistantIconPickerLibraryOptions(nextLibraryId)
    },
    getAssistantIconOptionSrc(option) {
      if (!option) return this.getAssistantIconSrc(DEFAULT_ASSISTANT_ICON)
      const value = getAssistantIconOptionValueSync(option)
      return this.getAssistantIconSrc(value)
    },
    selectAssistantIconOption(option) {
      const value = getAssistantIconOptionValueSync(option)
      this.assistantIconPickerSelectedValue = normalizeAssistantIcon(value)
      this.assistantIconPickerSelectedLabel = option?.label || ''
    },
    confirmAssistantIconPickerDialog() {
      this.assistantForm.icon = normalizeAssistantIcon(this.assistantIconPickerSelectedValue)
      this.onAssistantFormChange()
      this.closeAssistantIconPickerDialog()
    },
    loadMoreAssistantIconPickerOptions() {
      this.assistantIconPickerVisibleCount += 120
    },
    loadAssistantConfigData() {
      this.assistantSettingsMap = loadAssistantSettings()
      this.customAssistants = getCustomAssistants()
      if (!this.activeAssistantSettingItem) {
        this.activeAssistantSettingItem = 'spell-check'
      }
      this.loadAssistantFormForItem(this.activeAssistantSettingItem)
    },
    normalizeActiveMainMenuIfHidden() {
      if (HIDDEN_SETTINGS_MAIN_MENU_KEYS.has(this.activeMainMenu)) {
        this.activeMainMenu = 'model-settings'
        this.activeSubMenu = null
      }
    },
    resolveAutoGeneralSubmenuIcon(item) {
      const pool = ['💾', '🗄️', '📂', '🧮', '🔐', '📦', '⚙️', '🗃️']
      const s = `${String(item?.key || '')}\0${String(item?.label || '')}`
      let h = 2166136261
      for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i)
        h = Math.imul(h, 16777619)
      }
      return pool[Math.abs(h) % pool.length]
    },
    applyInitialMenuSelection() {
      try {
        const hashQuery = (window.location.hash || '').split('?')[1] || ''
        const searchQuery = String(window.location.search || '').replace(/^\?/, '')
        const params = new URLSearchParams(hashQuery || searchQuery)
        const menu = params.get('menu')
        const item = params.get('item')
        if (menu && HIDDEN_SETTINGS_MAIN_MENU_KEYS.has(menu)) {
          this.selectMainMenu('model-settings')
          return
        }
        if (menu === 'assistant-settings') {
          this.activeMainMenu = 'assistant-settings'
          if (item) {
            this.activeAssistantSettingItem = item
          }
          this.$nextTick(() => {
            this.loadAssistantFormForItem(this.activeAssistantSettingItem)
          })
        } else if (menu === 'model-settings') {
          this.selectMainMenu('model-settings')
        }
      } catch (e) {
        console.warn('applyInitialMenuSelection:', e)
      }
    },
    buildAssistantForm(item) {
      if (!item) return createCustomAssistantDraft()
      if (item.type === 'create-custom-assistant') {
        const draft = createCustomAssistantDraft()
        draft.sortOrder = this.customAssistants.length
        draft.displayOrder = this.getNextAssistantDisplayOrder('custom')
        draft.icon = normalizeAssistantIcon(draft.icon)
        draft.reportSettings = normalizeReportSettings(draft.reportSettings, createDefaultReportSettings())
        return draft
      }
      if (item.type === 'system-assistant') {
        const definition = getBuiltinAssistantDefinition(item.key)
        const base = this.assistantSettingsMap[item.key] || getAssistantDefaultConfig(definition)
        const form = cloneValue(base)
        form.modelType = definition?.modelType || 'chat'
        form.reportSettings = normalizeReportSettings(form.reportSettings, createDefaultReportSettings())
        form.icon = getAssistantResolvedIcon(item.key, form.icon || definition?.icon)
        return form
      }
      const custom = this.customAssistants.find(entry => entry.id === item.key)
      if (custom) {
        const draft = cloneValue(custom)
        draft.icon = normalizeAssistantIcon(draft.icon)
        draft.reportSettings = normalizeReportSettings(draft.reportSettings, createDefaultReportSettings())
        return draft
      }
      return createCustomAssistantDraft()
    },
    applyAssistantPrefillDraftIfNeeded(item, form) {
      if (item?.type !== 'create-custom-assistant') {
        this.assistantPrefillNotice = null
        return form
      }
      const payload = consumeAssistantPrefillDraft()
      if (!payload?.draft || typeof payload.draft !== 'object') {
        this.assistantPrefillNotice = null
        return form
      }
      const merged = {
        ...form,
        ...payload.draft,
        reportSettings: normalizeReportSettings(
          payload.draft?.reportSettings,
          form?.reportSettings || createDefaultReportSettings()
        ),
        mediaOptions: {
          ...(form?.mediaOptions || {}),
          ...(payload.draft?.mediaOptions || {})
        }
      }
      this.assistantPrefillNotice = {
        source: String(payload.source || 'local-capability-faq').trim() || 'local-capability-faq',
        title: String(payload.title || '').trim(),
        note: String(payload.note || '').trim()
      }
      return merged
    },
    loadAssistantFormForItem(key) {
      const item = this.assistantSettingsItems.find(entry => entry.key === key)
      this.assistantForm = this.applyAssistantPrefillDraftIfNeeded(item, this.buildAssistantForm(item))
      this.assistantPromptRecommendationRequirement = String(this.assistantForm?.recommendationRequirement || '')
      this.assistantModelDropdownOpen = false
      this.assistantPreviewInput = this.getAssistantPreviewSample(item)
      this.assistantPreviewTargetLanguage = this.assistantForm?.targetLanguage || '英文'
      this.assistantPreviewInputSource = this.assistantForm?.inputSource || 'selection-preferred'
      this.assistantPreviewDocumentAction = this.assistantForm?.documentAction || 'insert'
    },
    getAssistantPreviewSample(item) {
      const key = item?.key || ''
      if (key === 'translate') {
        return '请将本通知转发至各部门，并于本周五前反馈执行情况。'
      }
      if (key === 'summary') {
        return '项目已完成需求调研、原型设计和技术预研，当前主要风险在于接口联调周期较长，建议优先锁定数据协议并安排联合测试。'
      }
      if (key === 'spell-check') {
        return '请对这段文字进行拼写和语法检查，看看有那些表述不准确的地方。'
      }
      if (String(key).startsWith('analysis.')) {
        return '本次会议重点讨论了预算收缩、排期调整和风险兜底方案，请根据具体功能选择合适的处理方式。'
      }
      if (key === 'text-to-image') {
        return '生成一张现代科技感的城市夜景海报，蓝紫色主调，带有霓虹灯和未来交通元素。'
      }
      if (key === 'text-to-audio') {
        return '欢迎收听今天的项目进展播报，以下将介绍本周完成事项、存在风险及下周计划。'
      }
      if (key === 'text-to-video') {
        return '制作一个 30 秒的产品宣传短视频，突出高效协作、智能总结和跨团队沟通场景。'
      }
      return '请在这里输入测试内容，用于预览该助手最终发送给模型的提示词。'
    },
    buildAssistantRecommendationRequirementExample(item, form = {}) {
      const currentItem = item || {}
      const currentForm = form && typeof form === 'object' ? form : {}
      const key = String(currentItem?.key || '').trim()
      const name = String(
        currentForm?.title ||
        currentForm?.name ||
        currentItem?.shortLabel ||
        currentItem?.label ||
        '当前助手'
      ).trim() || '当前助手'
      const modelType = String(currentForm?.modelType || currentItem?.modelType || 'chat').trim()
      const inputSource = String(currentForm?.inputSource || 'selection-preferred').trim()
      const outputFormat = String(currentForm?.outputFormat || 'markdown').trim()
      const documentAction = String(currentForm?.documentAction || 'insert').trim()
      const reportSettings = normalizeReportSettings(currentForm?.reportSettings, createDefaultReportSettings())
      const reportTypeLabel = getReportTypeLabel(reportSettings.type, reportSettings.customType)
      const inputSourceText = inputSource === 'document'
        ? '按全文处理'
        : inputSource === 'selection-only'
          ? '只处理选中内容'
          : '优先处理选中内容，没有选区时再结合全文'
      const documentActionText = documentAction === 'replace'
        ? '结果默认直接替换原文'
        : documentAction === 'comment'
          ? '结果默认以批注方式写回'
          : documentAction === 'append'
            ? '结果默认追加到文档末尾'
            : documentAction === 'none'
              ? '结果默认只返回，不写回文档'
              : '结果默认插入到当前位置'
      if (reportSettings.enabled) {
        return `我想把“${name}”优化成一个${reportTypeLabel}助手，${inputSourceText}，输出 Markdown，${documentActionText}，请同时推荐系统提示词、用户提示词模板、报告格式和报告附加要求。`
      }
      if (key === 'translate') {
        return `我想把“${name}”优化成一个稳定的翻译助手，优先处理选中内容，默认翻译成${currentForm?.targetLanguage || '英文'}，保持术语统一和原文结构，不要额外发挥，并给我推荐更合适的提示词。`
      }
      if (key === 'summary') {
        return `我想把“${name}”优化成一个摘要助手，${inputSourceText}，输出简洁清晰的要点总结，重点突出结论、风险和下一步动作，并推荐更适合总结场景的提示词。`
      }
      if (key === 'spell-check' || key === 'analysis.correct-spell') {
        return `我想把“${name}”优化成一个审校助手，优先检查错别字、语法、标点和表达不准确的内容，结论要克制清楚，尽量给出修改建议，并推荐合适的提示词和输出方式。`
      }
      if (String(key).startsWith('analysis.')) {
        return `我想把“${name}”优化成一个文档分析助手，${inputSourceText}，输出${outputFormat === 'plain' ? '纯文本' : outputFormat === 'json' ? '结构化结果' : 'Markdown'}结果，回答要专业、可复核，并推荐更适合这个分析场景的提示词。`
      }
      if (modelType === 'image' || key === 'text-to-image') {
        return `我想把“${name}”优化成一个图像生成助手，用于根据文字需求生成更稳定的图像提示词，默认画幅比例是${currentForm?.mediaOptions?.aspectRatio || '16:9'}，风格偏专业统一，请推荐系统提示词、用户模板和参数设置。`
      }
      if (modelType === 'voice' || key === 'text-to-audio') {
        return `我想把“${name}”优化成一个语音生成助手，用于把文本转换成更自然的播报内容，默认时长控制在${currentForm?.mediaOptions?.duration || '30s'}左右，语音风格偏${currentForm?.mediaOptions?.voiceStyle || '专业自然'}，请推荐合适的提示词和参数。`
      }
      if (modelType === 'video' || key === 'text-to-video') {
        return `我想把“${name}”优化成一个视频生成助手，用于根据文案生成短视频提示词，默认比例${currentForm?.mediaOptions?.aspectRatio || '16:9'}、时长${currentForm?.mediaOptions?.duration || '30s'}，请推荐更适合视频生成的系统提示词、用户模板和参数设置。`
      }
      return `我想把“${name}”优化成一个更稳定的智能助手，${inputSourceText}，输出${outputFormat === 'plain' ? '纯文本' : outputFormat === 'json' ? '结构化结果' : 'Markdown'}结果，${documentActionText}，请根据这个场景推荐系统提示词、用户提示词模板和更合适的设置。`
    },
    isAssistantDisplayLocationSelected(location) {
      return Array.isArray(this.assistantForm?.displayLocations) &&
        this.assistantForm.displayLocations.includes(location)
    },
    toggleAssistantDisplayLocation(location, checked) {
      const current = Array.isArray(this.assistantForm?.displayLocations)
        ? this.assistantForm.displayLocations.slice()
        : []
      let next = current.filter(item => item !== location)
      if (checked) {
        next.push(location)
      }
      if (location === 'ribbon-main' && checked) {
        next = next.filter(item => item !== 'ribbon-more')
      }
      if (location === 'ribbon-more' && checked) {
        next = next.filter(item => item !== 'ribbon-main')
      }
      this.assistantForm.displayLocations = Array.from(new Set(next))
      this.onAssistantFormChange()
    },
    getAssistantItemDisplayOrder(item) {
      if (!item) return Number.POSITIVE_INFINITY
      if (item.type === 'system-assistant') {
        const value = this.assistantSettingsMap?.[item.key]?.displayOrder
        return Number.isFinite(Number(value)) ? Number(value) : Number.POSITIVE_INFINITY
      }
      if (item.type === 'custom-assistant') {
        const found = this.customAssistants.find(entry => entry.id === item.key)
        const value = found?.displayOrder
        return Number.isFinite(Number(value)) ? Number(value) : Number.POSITIVE_INFINITY
      }
      return Number.POSITIVE_INFINITY
    },
    sortAssistantItems(items) {
      const list = Array.isArray(items) ? items.slice() : []
      return list.sort((a, b) => {
        if (a.type === 'create-custom-assistant' && b.type !== 'create-custom-assistant') return -1
        if (b.type === 'create-custom-assistant' && a.type !== 'create-custom-assistant') return 1
        const aOrder = this.getAssistantItemDisplayOrder(a)
        const bOrder = this.getAssistantItemDisplayOrder(b)
        if (aOrder !== bOrder) return aOrder - bOrder
        return String(a.shortLabel || a.label || '').localeCompare(String(b.shortLabel || b.label || ''))
      })
    },
    isAssistantSettingReorderable(item) {
      return item?.type === 'system-assistant' || item?.type === 'custom-assistant'
    },
    getReorderableAssistantItemsByGroup(groupKey) {
      const items = this.assistantSettingsItems.filter(item => (
        item.group === groupKey && this.isAssistantSettingReorderable(item)
      ))
      return this.sortAssistantItems(items)
    },
    getNextAssistantDisplayOrder(groupKey) {
      return this.getReorderableAssistantItemsByGroup(groupKey).length
    },
    canMoveAssistantSettingItem(item, direction) {
      if (!this.isAssistantSettingReorderable(item)) return false
      const items = this.getReorderableAssistantItemsByGroup(item.group)
      const index = items.findIndex(entry => entry.key === item.key)
      if (index < 0) return false
      if (direction === 'up') return index > 0
      if (direction === 'down') return index < items.length - 1
      return false
    },
    applyAssistantDisplayOrder(groupItems) {
      groupItems.forEach((entry, index) => {
        if (entry.type === 'system-assistant') {
          this.assistantSettingsMap = {
            ...this.assistantSettingsMap,
            [entry.key]: {
              ...(this.assistantSettingsMap?.[entry.key] || {}),
              displayOrder: index
            }
          }
          if (this.activeAssistantSettingItem === entry.key && this.assistantForm) {
            this.assistantForm.displayOrder = index
          }
        } else if (entry.type === 'custom-assistant') {
          this.customAssistants = this.customAssistants.map(custom => (
            custom.id === entry.key
              ? { ...custom, displayOrder: index }
              : custom
          ))
          if (this.activeAssistantSettingItem === entry.key && this.assistantForm) {
            this.assistantForm.displayOrder = index
          }
        }
      })
    },
    moveAssistantSettingItem(item, direction) {
      if (!this.canMoveAssistantSettingItem(item, direction)) return
      this.commitAssistantForm()
      const items = this.getReorderableAssistantItemsByGroup(item.group)
      const currentIndex = items.findIndex(entry => entry.key === item.key)
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= items.length) return
      const reordered = items.slice()
      const [moved] = reordered.splice(currentIndex, 1)
      reordered.splice(targetIndex, 0, moved)
      this.applyAssistantDisplayOrder(reordered)
      this.isFormSaved = false
      this.notifyRibbonRefreshAssistantMenu()
    },
    onAssistantDragStart(e, groupKey, item) {
      if (!this.isAssistantSettingReorderable(item)) return
      this.assistantDragState = {
        groupKey,
        fromKey: item.key,
        dropKey: '',
        dropPosition: 'before'
      }
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(item.key))
    },
    onAssistantDragOver(e, groupKey, item) {
      if (!this.isAssistantSettingReorderable(item)) return
      if (!this.assistantDragState.fromKey || this.assistantDragState.groupKey !== groupKey) return
      if (this.assistantDragState.fromKey === item.key) return
      e.dataTransfer.dropEffect = 'move'
      const rect = e.currentTarget.getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      this.assistantDragState.dropKey = item.key
      this.assistantDragState.dropPosition = e.clientY < midY ? 'before' : 'after'
    },
    onAssistantDragLeave(e, groupKey, item) {
      if (this.assistantDragState.groupKey !== groupKey) return
      if (this.assistantDragState.dropKey === item.key) {
        this.assistantDragState.dropKey = ''
      }
    },
    onAssistantDrop(e, groupKey, item) {
      if (!this.isAssistantSettingReorderable(item)) {
        this.onAssistantDragEnd()
        return
      }
      const { fromKey, dropPosition } = this.assistantDragState
      this.assistantDragState = {
        groupKey: '',
        fromKey: '',
        dropKey: '',
        dropPosition: 'before'
      }
      if (!fromKey || fromKey === item.key) return
      const items = this.getReorderableAssistantItemsByGroup(groupKey)
      const fromIndex = items.findIndex(entry => entry.key === fromKey)
      const targetIndex = items.findIndex(entry => entry.key === item.key)
      if (fromIndex < 0 || targetIndex < 0) return
      const reordered = items.slice()
      const [moved] = reordered.splice(fromIndex, 1)
      const baseIndex = dropPosition === 'after' ? targetIndex + 1 : targetIndex
      const insertIndex = fromIndex < baseIndex ? baseIndex - 1 : baseIndex
      reordered.splice(insertIndex, 0, moved)
      this.commitAssistantForm()
      this.applyAssistantDisplayOrder(reordered)
      this.isFormSaved = false
      this.notifyRibbonRefreshAssistantMenu()
    },
    onAssistantDragEnd() {
      this.assistantDragState = {
        groupKey: '',
        fromKey: '',
        dropKey: '',
        dropPosition: 'before'
      }
    },
    commitAssistantForm() {
      const item = this.currentAssistantSettingItem
      if (!item || !this.assistantForm) return
      if (item.type === 'system-assistant') {
        this.assistantSettingsMap = {
          ...this.assistantSettingsMap,
          [item.key]: cloneValue(this.assistantForm)
        }
      } else if (item.type === 'custom-assistant') {
        this.customAssistants = this.customAssistants.map(entry => (
          entry.id === item.key ? cloneValue(this.assistantForm) : entry
        ))
      }
    },
    selectAssistantSettingItem(item) {
      this.commitAssistantForm()
      this.activeAssistantSettingItem = item.key
      this.loadAssistantFormForItem(item.key)
      this.isFormSaved = false
    },
    onAssistantFormChange() {
      this.assistantPreviewTargetLanguage = this.assistantForm?.targetLanguage || '英文'
      this.assistantPreviewInputSource = this.assistantForm?.inputSource || 'selection-preferred'
      this.assistantPreviewDocumentAction = this.assistantForm?.documentAction || 'insert'
      this.isFormSaved = false
    },
    toggleAssistantReportEnabled(enabled) {
      const current = normalizeReportSettings(this.assistantForm?.reportSettings, createDefaultReportSettings())
      this.assistantForm.reportSettings = {
        ...current,
        enabled
      }
      if (enabled) {
        this.assistantForm.inputSource = 'document'
        this.assistantPreviewInputSource = 'document'
        if (!this.assistantForm.outputFormat || this.assistantForm.outputFormat === 'plain' || this.assistantForm.outputFormat === 'json') {
          this.assistantForm.outputFormat = 'markdown'
        }
        if (!this.assistantForm.documentAction || this.assistantForm.documentAction === 'insert') {
          this.assistantForm.documentAction = 'none'
        }
        this.assistantPreviewDocumentAction = this.assistantForm.documentAction || 'none'
      }
      this.onAssistantFormChange()
    },
    onAssistantReportTypeChange() {
      this.assistantForm.reportSettings = normalizeReportSettings(
        this.assistantForm?.reportSettings,
        createDefaultReportSettings()
      )
      this.onAssistantFormChange()
    },
    loadAssistantPromptRecommendationDraft() {
      try {
        const raw = localStorage.getItem(ASSISTANT_PROMPT_RECOMMENDATION_DRAFT_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw)
        this.assistantPromptRecommendationRequirement = String(parsed?.requirement || '')
        this.assistantPromptRecommendationModelId = String(parsed?.modelId || '')
      } catch (_) {
        // ignore invalid local draft
      }
    },
    saveAssistantPromptRecommendationDraft() {
      try {
        localStorage.setItem(ASSISTANT_PROMPT_RECOMMENDATION_DRAFT_KEY, JSON.stringify({
          requirement: this.assistantPromptRecommendationRequirement || this.assistantForm?.recommendationRequirement || '',
          modelId: this.assistantPromptRecommendationModelId
        }))
      } catch (_) {
        // ignore storage failures
      }
    },
    onAssistantRecommendationRequirementInput() {
      this.assistantPromptRecommendationRequirement = String(this.assistantForm?.recommendationRequirement || '')
      this.onAssistantFormChange()
      this.saveAssistantPromptRecommendationDraft()
    },
    onAssistantPromptRecommendationRequirementChange() {
      if (this.assistantForm) {
        this.assistantForm.recommendationRequirement = String(this.assistantPromptRecommendationRequirement || '')
        this.onAssistantFormChange()
      }
      this.saveAssistantPromptRecommendationDraft()
    },
    openAssistantPromptRecommendDialog() {
      if (!this.canRecommendCustomAssistantPrompt) return
      this.assistantPromptRecommendationRequirement = String(
        this.assistantForm?.recommendationRequirement ||
        this.assistantPromptRecommendationRequirement ||
        ''
      )
      if (!this.assistantPromptRecommendationRequirement) {
        this.assistantPromptRecommendationRequirement = String(this.assistantRecommendationRequirementExample || '')
      }
      this.showAssistantPromptRecommendDialog = true
      this.$nextTick(() => {
        this.$refs.assistantPromptRequirementRef?.focus?.()
      })
    },
    closeAssistantPromptRecommendDialog() {
      this.showAssistantPromptRecommendDialog = false
      this.assistantPromptRecommendationModelDropdownOpen = false
      this.saveAssistantPromptRecommendationDraft()
    },
    selectAssistantPromptRecommendationModelFromDropdown(model) {
      this.assistantPromptRecommendationModelId = model ? model.id : ''
      this.assistantPromptRecommendationModelDropdownOpen = false
      this.saveAssistantPromptRecommendationDraft()
    },
    onAssistantPromptRecommendationModelDropdownBlur() {
      setTimeout(() => { this.assistantPromptRecommendationModelDropdownOpen = false }, 150)
    },
    applyRecommendedAssistantConfig(config) {
      if (!config || typeof config !== 'object') return
      const current = cloneValue(this.assistantForm || createCustomAssistantDraft())
      this.assistantForm = {
        ...current,
        ...cloneValue(config),
        id: current.id || '',
        icon: current.icon || '🧠',
        modelType: current.modelType || 'chat',
        modelId: current.modelId || null,
        visibleInRibbon: current.visibleInRibbon !== false,
        sortOrder: current.sortOrder || 0,
        recommendationRequirement: current.recommendationRequirement || this.assistantPromptRecommendationRequirement || '',
        reportSettings: normalizeReportSettings(config?.reportSettings || current.reportSettings, createDefaultReportSettings())
      }
      this.assistantPreviewTargetLanguage = this.assistantForm?.targetLanguage || '英文'
      this.assistantPreviewInputSource = this.assistantForm?.inputSource || 'selection-preferred'
      this.assistantPreviewDocumentAction = this.assistantForm?.documentAction || 'insert'
      this.onAssistantFormChange()
    },
    onAssistantRecommendationApplyStorage(event) {
      if (event?.key !== getAssistantRecommendationApplyStorageKey()) return
      this.consumeAssistantRecommendationApplyRequest()
    },
    consumeAssistantRecommendationApplyRequest() {
      const request = readAssistantRecommendationApplyRequest()
      if (!request?.requestId) return false
      if (this.latestAppliedRecommendationRequestId === request.requestId) return false
      const targetKey = String(request.targetKey || '')
      const item = this.assistantSettingsItems.find(entry => entry.key === targetKey)
      if (!item) return false
      this.latestAppliedRecommendationRequestId = request.requestId
      this.activeMainMenu = 'assistant-settings'
      if (this.activeAssistantSettingItem !== targetKey) {
        this.selectAssistantSettingItem(item)
      }
      this.applyRecommendedAssistantConfig(request.recommendedConfig)
      if (request.requirementText) {
        this.assistantPromptRecommendationRequirement = String(request.requirementText)
        if (this.assistantForm) {
          this.assistantForm.recommendationRequirement = String(request.requirementText)
          this.onAssistantFormChange()
        }
        this.saveAssistantPromptRecommendationDraft()
      }
      clearAssistantRecommendationApplyRequest(request.requestId)
      const targetLabel = String(request.targetLabel || item.label || '当前助手')
      this.showMessage(`已将任务清单中的推荐结果应用到“${targetLabel}”，记得点击保存`)
      try {
        if (window.focus) window.focus()
      } catch (_) {}
      return true
    },
    openTaskProgressWindow(taskId, title = '任务进度') {
      if (!taskId) return
      try {
        const href = String(window.location.href || '')
        const base = href.split('#')[0] || href
        const url = `${base}#/task-progress-dialog?taskId=${encodeURIComponent(taskId)}`
        if (window.Application?.ShowDialog) {
          window.Application.ShowDialog(
            url,
            title,
            520 * (window.devicePixelRatio || 1),
            260 * (window.devicePixelRatio || 1),
            false
          )
          return
        }
        window.open(url, '_blank')
      } catch (_) {
        this.showMessage('打开进度窗失败，可在任务清单查看执行过程', 'error')
      }
    },
    async confirmAssistantPromptRecommendation() {
      const requirementText = String(this.assistantPromptRecommendationRequirement || '').trim()
      if (!requirementText) {
        this.showMessage('请先输入你的需求，再进行智能推荐', 'error')
        return
      }
      const resolvedModelState = this.resolvedAssistantPromptRecommendationModelState
      if (!resolvedModelState?.model) {
        this.showMessage('当前没有可用的对话模型，请先配置模型', 'error')
        return
      }
      if (this.assistantForm) {
        this.assistantForm.recommendationRequirement = requirementText
        this.onAssistantFormChange()
      }
      this.saveAssistantPromptRecommendationDraft()
      const targetKey = String(this.currentAssistantSettingItem?.key || '')
      const taskTitle = `${this.assistantPromptRecommendationActionLabel}：${this.assistantPromptRecommendationTargetLabel}`
      const draftSnapshot = cloneValue(this.assistantForm || createCustomAssistantDraft())
      const { taskId, promise } = startAssistantPromptRecommendationTask({
        taskTitle,
        requirementText,
        draftSnapshot,
        resolvedModelState,
        targetKey,
        targetLabel: this.assistantPromptRecommendationTargetLabel,
        modelSelectionMode: this.assistantPromptRecommendationModelId ? 'manual' : 'inherit'
      })
      this.latestAssistantPromptRecommendationTaskId = taskId
      this.latestAssistantPromptRecommendationTargetKey = targetKey
      this.closeAssistantPromptRecommendDialog()
      this.showMessage('已开始智能推荐，可在进度窗或任务清单中查看过程', 'info')
      this.openTaskProgressWindow(taskId, taskTitle)
      try {
        const result = await promise
        if (this.latestAssistantPromptRecommendationTaskId !== result.taskId) return
        if (String(this.currentAssistantSettingItem?.key || '') !== targetKey || this.latestAssistantPromptRecommendationTargetKey !== targetKey) {
          this.showMessage('智能推荐已完成，结果已进入任务清单；返回发起推荐的那个助手页可继续使用', 'info')
          return
        }
        this.applyRecommendedAssistantConfig(result.appliedConfig)
        this.showMessage(`智能推荐已完成，推荐设置已回填到“${this.assistantPromptRecommendationTargetLabel}”，记得点击保存`)
      } catch (error) {
        if (error?.name === 'TaskCancelledError') {
          this.showMessage('智能推荐已停止', 'info')
          return
        }
        this.showMessage(error?.message || '智能推荐失败，请检查模型配置后重试', 'error')
      } finally {
        if (this.latestAssistantPromptRecommendationTaskId === taskId) {
          this.latestAssistantPromptRecommendationTargetKey = ''
        }
      }
    },
    restoreAssistantDefaults() {
      if (!this.currentAssistantDefinition) return
      this.assistantForm = getAssistantDefaultConfig(this.currentAssistantDefinition)
      this.onAssistantFormChange()
    },
    isReportAssistantPresetGroupCollapsed(groupKey) {
      return this.reportAssistantPresetCollapsedGroups[groupKey] === true
    },
    toggleReportAssistantPresetGroup(groupKey) {
      this.reportAssistantPresetCollapsedGroups = {
        ...this.reportAssistantPresetCollapsedGroups,
        [groupKey]: !this.isReportAssistantPresetGroupCollapsed(groupKey)
      }
    },
    toggleAllReportAssistantPresetGroups() {
      const nextValue = !this.reportAssistantPresetCollapsedAll
      const next = { ...this.reportAssistantPresetCollapsedGroups }
      this.filteredReportAssistantPresetGroups.forEach(group => {
        next[group.key] = nextValue
      })
      this.reportAssistantPresetCollapsedGroups = next
    },
    applyReportAssistantPreset(presetId) {
      if (!this.canApplyReportAssistantPreset) return
      const current = cloneValue(this.assistantForm || createCustomAssistantDraft())
      const presetDraft = buildReportAssistantPresetDraft(presetId)
      this.assistantForm = {
        ...current,
        ...presetDraft,
        id: current.id || '',
        icon: presetDraft.icon || current.icon || '🧠',
        modelType: 'chat',
        modelId: current.modelId || null,
        visibleInRibbon: current.visibleInRibbon !== false,
        sortOrder: current.sortOrder || 0,
        displayOrder: Number.isFinite(Number(current.displayOrder))
          ? Number(current.displayOrder)
          : Number.isFinite(Number(presetDraft.displayOrder))
            ? Number(presetDraft.displayOrder)
            : current.displayOrder
      }
      this.assistantPreviewInput = this.getAssistantPreviewSample(this.currentAssistantSettingItem)
      this.onAssistantFormChange()
      this.showMessage(`已应用“${this.assistantForm.name || '报告助手'}”快捷模板，可继续微调后创建`)
    },
    createCustomAssistant() {
      const name = String(this.assistantForm?.name || '').trim()
      if (!name) {
        this.showMessage('请先输入助手名称', 'error')
        return
      }
      const newAssistant = {
        ...cloneValue(this.assistantForm),
        id: buildCustomAssistantId(name),
        name,
        icon: normalizeAssistantIcon(this.assistantForm?.icon),
        sortOrder: this.customAssistants.length,
        displayOrder: Number.isFinite(Number(this.assistantForm?.displayOrder))
          ? Number(this.assistantForm.displayOrder)
          : this.getNextAssistantDisplayOrder('custom')
      }
      this.customAssistants = [...this.customAssistants, newAssistant]
      this.activeAssistantSettingItem = newAssistant.id
      this.assistantForm = cloneValue(newAssistant)
      this.isFormSaved = false
      if (!saveCustomAssistants(this.customAssistants)) {
        this.showMessage('智能助手已创建，但同步到顶部菜单失败，请稍后点击保存重试', 'error')
        return
      }
      this.notifyRibbonRefreshAssistantMenu()
      this.showMessage('智能助手已创建，并已同步到顶部“更多”菜单')
    },
    buildUniqueAssistantCopyName(baseName) {
      const sourceName = String(baseName || '智能助手').trim() || '智能助手'
      const existingNames = new Set(
        this.customAssistants
          .map(item => String(item?.name || '').trim())
          .filter(Boolean)
      )
      if (!existingNames.has(sourceName)) return sourceName
      let index = 1
      while (existingNames.has(`${sourceName}${index}`)) {
        index += 1
      }
      return `${sourceName}${index}`
    },
    getAssistantSourceForItem(item) {
      if (!item || item.type === 'create-custom-assistant') return null
      if (this.activeAssistantSettingItem === item.key && this.assistantForm) {
        this.commitAssistantForm()
        return cloneValue(this.assistantForm)
      }
      return cloneValue(this.buildAssistantForm(item))
    },
    duplicateAssistantWithSource(item, source) {
      if (!item || item.type === 'create-custom-assistant' || !source) return
      const name = this.buildUniqueAssistantCopyName(source.name || item.shortLabel || item.label || '智能助手')
      const newAssistant = {
        ...source,
        id: buildCustomAssistantId(name),
        name,
        title: source.title ? this.buildUniqueAssistantCopyName(source.title) : '',
        icon: normalizeAssistantIcon(source.icon),
        sortOrder: this.customAssistants.length,
        displayOrder: Number.isFinite(Number(source.displayOrder))
          ? Number(source.displayOrder)
          : this.getNextAssistantDisplayOrder('custom')
      }
      this.customAssistants = [...this.customAssistants, newAssistant]
      this.activeAssistantSettingItem = newAssistant.id
      this.assistantForm = cloneValue(newAssistant)
      this.isFormSaved = false
      if (!saveCustomAssistants(this.customAssistants)) {
        this.showMessage('复制助手成功，但同步到顶部菜单失败，请稍后点击保存重试', 'error')
        return
      }
      this.notifyRibbonRefreshAssistantMenu()
      this.showMessage(`已复制助手，默认名称为“${name}”`)
    },
    duplicateCurrentAssistant() {
      const item = this.currentAssistantSettingItem
      if (!item || item.type === 'create-custom-assistant' || !this.assistantForm) return
      this.duplicateAssistantWithSource(item, this.getAssistantSourceForItem(item))
    },
    duplicateAssistantFromList(item) {
      if (!item || item.type === 'create-custom-assistant') return
      this.duplicateAssistantWithSource(item, this.getAssistantSourceForItem(item))
    },
    buildAssistantExportPayload(item, source) {
      return {
        type: 'chayuan-assistant',
        version: 1,
        exportedAt: new Date().toISOString(),
        sourceType: item?.type || 'unknown',
        sourceKey: item?.key || '',
        assistant: cloneValue({
          ...source,
          name: source?.name || source?.title || item?.shortLabel || item?.label || '智能助手',
          icon: normalizeAssistantIcon(source?.icon),
          reportSettings: normalizeReportSettings(source?.reportSettings, createDefaultReportSettings())
        })
      }
    },
    downloadAssistantExport(payload, baseName) {
      const filenameBase = String(baseName || '智能助手')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '-')
      const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${filenameBase || '智能助手'}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    },
    exportAssistantItem(item) {
      if (!item || item.type === 'create-custom-assistant') return
      const source = this.getAssistantSourceForItem(item)
      if (!source) return
      const exportName = source.name || source.title || item.shortLabel || item.label || '智能助手'
      const payload = this.buildAssistantExportPayload(item, source)
      this.downloadAssistantExport(payload, exportName)
      this.showMessage(`已导出助手“${exportName}”`)
    },
    triggerAssistantImport() {
      this.$refs.assistantImportInputRef?.click?.()
    },
    onAssistantImportFileChange(event) {
      const file = event?.target?.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (loadEvent) => {
        try {
          const text = String(loadEvent?.target?.result || '')
          this.importAssistantFromText(text)
        } catch (error) {
          this.showMessage(error?.message || '导入助手失败，请检查 JSON 内容', 'error')
        } finally {
          if (event?.target) event.target.value = ''
        }
      }
      reader.onerror = () => {
        this.showMessage('读取导入文件失败，请重试', 'error')
        if (event?.target) event.target.value = ''
      }
      reader.readAsText(file, 'utf-8')
    },
    importAssistantFromText(text) {
      const parsed = JSON.parse(String(text || '').trim() || '{}')
      const rawAssistant =
        parsed?.type === 'chayuan-assistant' || parsed?.type === 'niudang-assistant'
          ? parsed.assistant
          : parsed
      if (!rawAssistant || typeof rawAssistant !== 'object' || Array.isArray(rawAssistant)) {
        throw new Error('导入文件不是有效的助手配置')
      }
      const baseDraft = createCustomAssistantDraft()
      const rawName = String(rawAssistant.name || rawAssistant.title || '').trim() || '智能助手'
      const name = this.buildUniqueAssistantCopyName(rawName)
      const importedAssistant = {
        ...baseDraft,
        ...cloneValue(rawAssistant),
        id: buildCustomAssistantId(name),
        name,
        title: '',
        icon: normalizeAssistantIcon(rawAssistant.icon || baseDraft.icon),
        sortOrder: this.customAssistants.length,
        displayOrder: Number.isFinite(Number(rawAssistant.displayOrder))
          ? Number(rawAssistant.displayOrder)
          : this.getNextAssistantDisplayOrder('custom'),
        reportSettings: normalizeReportSettings(rawAssistant.reportSettings, baseDraft.reportSettings)
      }
      this.customAssistants = [...this.customAssistants, importedAssistant]
      this.activeAssistantSettingItem = importedAssistant.id
      this.assistantForm = cloneValue(importedAssistant)
      this.isFormSaved = false
      if (!saveCustomAssistants(this.customAssistants)) {
        this.showMessage('助手已导入，但同步到顶部菜单失败，请稍后点击保存重试', 'error')
        return
      }
      this.notifyRibbonRefreshAssistantMenu()
      this.showMessage(`已导入助手“${name}”`)
    },
    async copyTextToClipboard(text, successMessage) {
      const value = String(text || '')
      if (!value.trim()) {
        this.showMessage('没有可复制的内容', 'error')
        return
      }
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(value)
        } else {
          const textarea = document.createElement('textarea')
          textarea.value = value
          textarea.setAttribute('readonly', 'readonly')
          textarea.style.position = 'fixed'
          textarea.style.left = '-9999px'
          document.body.appendChild(textarea)
          textarea.select()
          document.execCommand('copy')
          document.body.removeChild(textarea)
        }
        this.showMessage(successMessage || '已复制')
      } catch (e) {
        console.warn('copyTextToClipboard:', e)
        this.showMessage('复制失败，请手动复制', 'error')
      }
    },
    restoreAssistantPreviewSample() {
      this.assistantPreviewInput = this.getAssistantPreviewSample(this.currentAssistantSettingItem)
      this.assistantPreviewTargetLanguage = this.assistantForm?.targetLanguage || '英文'
      this.showMessage('已恢复示例文本')
    },
    deleteCurrentCustomAssistant() {
      const item = this.currentAssistantSettingItem
      if (!item || item.type !== 'custom-assistant') return
      this.deleteAssistantItem(item)
    },
    selectAssistantModelFromDropdown(model) {
      this.assistantForm.modelId = model ? model.id : null
      this.assistantModelDropdownOpen = false
      this.onAssistantFormChange()
    },
    onAssistantModelDropdownBlur() {
      setTimeout(() => { this.assistantModelDropdownOpen = false }, 150)
    },
    notifyRibbonRefreshAssistantMenu() {
      try {
        if (window.Application?.ribbonUI?.InvalidateControl) {
          const controls = [
            'menuMoreAssistants',
            'menuContextAssistantMore',
            'btnSpellGrammar',
            'menuTextAnalysis',
            'menuTranslate',
            'btnGenerateSummary',
            'btnRewrite',
            'btnExpand',
            'btnAbbreviate',
            'btnParagraphNumberingCheck',
            'btnAiTraceCheck',
            'btnCommentExplain',
            'btnHyperlinkExplain',
            'btnCorrectSpellGrammar',
            'btnExtractKeywords',
            'btnDocumentDeclassifyCheck',
            'btnTextToImage',
            'btnTextToAudio',
            'btnTextToVideo',
            'btnAssistantPrimarySlot1',
            'btnAssistantPrimarySlot2',
            'btnAssistantPrimarySlot3',
            'btnAssistantPrimarySlot4',
            'btnContextAssistantSlot1',
            'btnContextAssistantSlot2',
            'btnContextAssistantSlot3',
            'btnContextAssistantSlot4'
          ]
          controls.forEach(id => window.Application.ribbonUI.InvalidateControl(id))
        }
      } catch (e) {
        console.warn('刷新 ribbon 助手菜单失败:', e)
      }
    },
    refreshModelInventoryList() {
      const seen = new Set()
      const list = []
      getCustomModelProviders().forEach(m => {
        const id = m.id || (m.type + '-custom')
        if (!seen.has(id.toLowerCase())) {
          seen.add(id.toLowerCase())
          list.push({
            id,
            name: m.name || m.type,
            icon: m.icon || getModelLogoPath(m.type),
            description: undefined,
            isCustom: true,
            type: m.type
          })
        }
      })
      MODEL_INVENTORY.forEach(m => {
        if (seen.has(m.id.toLowerCase())) return
        seen.add(m.id.toLowerCase())
        list.push({ id: m.id, name: m.name, icon: getModelLogoPath(m.id), description: m.description })
      })
      this.getDefaultModels().forEach(m => {
        if (seen.has(m.id.toLowerCase())) return
        seen.add(m.id.toLowerCase())
        list.push({ id: m.id, name: m.name, icon: getModelLogoPath(m.id), description: undefined })
      })
      const order = getModelOrder()
      if (order.length > 0) {
        const idToItem = new Map(list.map(x => [x.id.toLowerCase(), x]))
        const ordered = []
        for (const id of order) {
          const item = idToItem.get(String(id).toLowerCase())
          if (item) {
            ordered.push(item)
            idToItem.delete(String(id).toLowerCase())
          }
        }
        idToItem.forEach(item => ordered.push(item))
        this.modelInventoryList = ordered
        this.modelOrder = ordered.map(m => m.id)
      } else {
        this.modelInventoryList = list
        this.modelOrder = []
      }
    },
    getIconSrc(item) {
      if (!item?.icon) return ''
      if (typeof item.icon === 'string' && item.icon.startsWith('data:')) return item.icon
      return this.getImageSrc(item.icon)
    },
    getProviderDocsUrl,
    // 在系统默认浏览器中打开 URL
    // WPS 桌面版：OAAssist.ShellExecute 专用于打开网页，FollowHyperlink 可能无法唤起外部浏览器
    // ShowDialog 内 window.open 可能被拦截，需优先使用 WPS 提供的 ShellExecute
    openExternalUrl(url) {
      if (!url) return
      const app = window.Application || window.opener?.Application || window.parent?.Application
      try {
        if (app?.OAAssist?.ShellExecute) {
          app.OAAssist.ShellExecute(url)
          return
        }
        if (app?.FollowHyperlink) {
          app.FollowHyperlink(url, '', true)
          return
        }
      } catch (e) {
        console.warn('WPS 打开链接失败:', e)
      }
      try {
        window.open(url, '_blank', 'noopener,noreferrer')
      } catch (e2) {
        console.warn('打开链接失败:', e2)
      }
    },
    openApiKeyUrl() {
      const url = getProviderApiKeyUrl(this.selectedModel?.id)
      this.openExternalUrl(url)
    },
    openDocsUrl() {
      const url = getProviderDocsUrl(this.selectedModel?.id)
      this.openExternalUrl(url)
    },
    // 加载模型列表
    loadModels() {
      try {
        // 优先从存储中读取
        const stored = window.Application?.PluginStorage?.getItem('modelList')
        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            if (Array.isArray(parsed) && parsed.length > 0) {
              this.allModels = parsed
              console.log('从存储加载模型列表，共', this.allModels.length, '个模型')
              return
            }
          } catch (e) {
            console.warn('解析存储的模型列表失败:', e)
          }
        }
        // 使用默认模型列表
        this.allModels = this.getDefaultModels()
        console.log('使用默认模型列表，共', this.allModels.length, '个模型')
        // 保存到存储以便下次使用
        if (window.Application?.PluginStorage && this.allModels.length > 0) {
          try {
            window.Application.PluginStorage.setItem('modelList', JSON.stringify(this.allModels))
          } catch (e) {
            console.warn('保存模型列表到存储失败:', e)
          }
        }
      } catch (e) {
        console.error('加载模型列表失败:', e)
        this.allModels = this.getDefaultModels()
      }
    },
    // 获取默认模型列表（模型提供商列表）
    getDefaultModels() {
      // 返回模型提供商列表，每个提供商作为一个独立的配置项
      return [
        { id: 'nvidia', name: '英伟达', icon: 'images/models/nvidia.svg', provider: true },
        { id: 'grok', name: 'Grok', icon: 'images/models/grok.svg', provider: true },
        { id: 'hyperbolic', name: 'Hyperbolic', icon: 'images/models/hyperbolic.svg', provider: true },
        { id: 'mistral', name: 'Mistral', icon: 'images/models/mistral.svg', provider: true },
        { id: 'jina', name: 'Jina', icon: 'images/models/jina.svg', provider: true },
        { id: 'perplexity', name: 'Perplexity', icon: 'images/models/perplexity.svg', provider: true },
        { id: 'modelscope', name: 'ModelScope 魔搭', icon: 'images/models/modelscope.svg', provider: true },
        { id: 'tianyi-xirang', name: '天翼云息壤', icon: 'images/models/tianyi.svg', provider: true },
        { id: 'tencent-hunyuan', name: '腾讯混元', icon: 'images/models/hunyuan.svg', provider: true },
        { id: 'tencent-cloud-ti', name: '腾讯云 TI', icon: 'images/models/tencent-cloud.svg', provider: true },
        { id: 'baidu-qianfan', name: '百度云千帆', icon: 'images/models/logos/qianfan.svg', provider: true },
        { id: 'gpustack', name: 'GPUStack', icon: 'images/models/gpustack.svg', provider: true },
        { id: 'voyage-ai', name: 'Voyage AI', icon: 'images/models/voyage.svg', provider: true },
        { id: 'aws-bedrock', name: 'AWS Bedrock', icon: 'images/models/aws.svg', provider: true },
        { id: 'poe', name: 'Poe', icon: 'images/models/poe.svg', provider: true },
        { id: 'totoro', name: '龙猫', icon: 'images/models/logos/longcat_logo.png', provider: true },
        { id: 'huggingface', name: 'Hugging Face', icon: 'images/models/huggingface.svg', provider: true },
        { id: 'vercel-ai', name: 'Vercel AI Gateway', icon: 'images/models/vercel.svg', provider: true },
        { id: 'cerebras', name: 'Cerebras AI', icon: 'images/models/cerebras.svg', provider: true },
        { id: 'xiaomi-mimo', name: 'Xiaomi MiMo', icon: 'images/models/xiaomi.svg', provider: true },
        { id: 'new-api', name: 'New API', icon: 'images/models/new-api.svg', provider: true },
        { id: 'lm-studio', name: 'LM Studio', icon: 'images/models/lm-studio.svg', provider: true },
        { id: 'anthropic', name: 'Anthropic', icon: 'images/models/claude.svg', provider: true },
        { id: 'openai', name: 'OpenAI', icon: 'images/models/openai.svg', provider: true },
        { id: 'azure-openai', name: 'Azure OpenAI', icon: 'images/models/azure.svg', provider: true },
        { id: 'gemini', name: 'Gemini', icon: 'images/models/gemini.svg', provider: true },
        { id: 'vertex-ai', name: 'Vertex AI', icon: 'images/models/vertex.svg', provider: true },
        { id: 'github-models', name: 'GitHub Models', icon: 'images/models/github.svg', provider: true },
        { id: 'github-copilot', name: 'GitHub Copilot', icon: 'images/models/github.svg', provider: true },
        { id: 'lingyi-wanwu', name: '零一万物', icon: 'images/models/yi.svg', provider: true },
        { id: 'moonshot', name: '月之暗面', icon: 'images/models/kimi.svg', provider: true },
        { id: 'baichuan', name: '百川', icon: 'images/models/baichuan.svg', provider: true },
        { id: 'aliyun-bailian', name: '阿里云百炼', icon: 'images/models/qwen.svg', provider: true },
        { id: 'step-ai', name: '阶跃星辰', icon: 'images/models/step.svg', provider: true },
        { id: 'volcengine', name: '火山引擎', icon: 'images/models/volcengine.svg', provider: true },
        { id: 'wuwen-xinqiong', name: '无问芯穹', icon: 'images/models/wuwen.svg', provider: true },
        { id: 'minimax', name: 'MiniMax', icon: 'images/models/minimax.svg', provider: true },
        { id: 'groq', name: 'Groq', icon: 'images/models/groq.svg', provider: true },
        { id: 'together', name: 'Together', icon: 'images/models/together.svg', provider: true },
        { id: 'fireworks', name: 'Fireworks', icon: 'images/models/fireworks.svg', provider: true },
        { id: 'aihubmix', name: 'AiHubMix', icon: 'images/models/aihubmix.svg', provider: true },
        { id: 'ocoolai', name: 'ocoolAI', icon: 'images/models/ocoolai.svg', provider: true },
        { id: 'zhipu', name: '智谱开放平台', icon: 'images/models/zhipu.svg', provider: true },
        { id: 'deepseek', name: '深度求索', icon: 'images/models/deepseek.svg', provider: true },
        { id: 'alaya-new', name: 'Alaya NeW', icon: 'images/models/alaya.svg', provider: true },
        { id: 'dmxapi', name: 'DMXAPI', icon: 'images/models/dmxapi.svg', provider: true },
        { id: 'aionly', name: '唯一AI', icon: 'images/models/aionly.svg', provider: true },
        { id: 'burncloud', name: 'BurnCloud', icon: 'images/models/burncloud.svg', provider: true },
        { id: 'tokenflux', name: 'TokenFlux', icon: 'images/models/tokenflux.svg', provider: true },
        { id: '302-ai', name: '302.AI', icon: 'images/models/logos/302ai-OYnezl-B.webp', provider: true },
        { id: 'cephalon', name: 'Cephalon', icon: 'images/models/cephalon.svg', provider: true },
        { id: 'lanyun', name: '蓝耘科技', icon: 'images/models/lanyun.svg', provider: true },
        { id: 'ph8', name: 'PH8 大模型开放平台', icon: 'images/models/ph8.svg', provider: true },
        { id: 'sophnet', name: 'SophNet', icon: 'images/models/sophnet.svg', provider: true },
        { id: 'ppio', name: 'PPIO 派欧云', icon: 'images/models/ppio.svg', provider: true },
        { id: 'qiniu', name: '七牛云 AI 推理', icon: 'images/models/qiniu.svg', provider: true },
        { id: 'openrouter', name: 'OpenRouter', icon: 'images/models/openrouter.svg', provider: true },
        { id: 'ollama', name: 'Ollama', icon: 'images/models/ollama.svg', provider: true }
      ]
    },
    // 主菜单选择
    selectMainMenu(key) {
      if (HIDDEN_SETTINGS_MAIN_MENU_KEYS.has(key)) {
        this.selectMainMenu('model-settings')
        return
      }
      if (this.activeMainMenu === 'assistant-settings') {
        this.commitAssistantForm()
      }
      this.activeMainMenu = key
      this.activeSubMenu = null
      this.isFormSaved = false // 切换菜单时重置保存状态
      // 切换到模型设置时，如果没有选中，选中清单第一项
      if (key === 'model-settings') {
        this.$nextTick(() => {
          const list = this.modelListForSettings
          if (list.length > 0 && (!this.selectedModel || !list.some(m => m.id === this.selectedModel?.id))) {
            this.selectModel(list[0])
          }
        })
      }
      if (key === 'default-settings') {
        this.activeDefaultSettingItem = this.activeDefaultSettingItem || 'chat'
      }
      if (key === 'assistant-settings') {
        this.activeAssistantSettingItem = this.activeAssistantSettingItem || 'spell-check'
        this.loadAssistantFormForItem(this.activeAssistantSettingItem)
      }
      if (key === 'general') {
        this.activeSubMenu = 'data'
        this.loadSpellCheckCommentPolicy()
      }
      if (key === 'backup-history') {
        this.loadBackupHistoryRecords()
      }
      if (key === 'evaluation-history') {
        this.loadEvaluationHistoryRecords()
        this.loadRegressionSampleRecords()
      }
      if (key === 'capability-audit') {
        this.loadCapabilityAuditRecords()
        this.refreshCapabilityPolicyCatalog()
      }
    },
    // 子菜单选择
    selectSubMenu(key) {
      this.activeSubMenu = key
      this.isFormSaved = false // 切换子菜单时重置保存状态
      if (key === 'data') {
        this.loadSpellCheckCommentPolicy()
      }
    },
    // 表单内容变化
    onFormChange() {
      this.isFormSaved = false // 表单内容变化时重置保存状态
    },
    // 获取模型是否已开启（用于左侧清单开关显示）
    getModelEnabled(providerId) {
      const config = getModelConfig(providerId)
      return !!config.enabled
    },
    // 切换模型启用状态（左侧清单开关）
    toggleModelEnabled(item, event) {
      const enabled = !!event?.target?.checked
      saveModelConfig(item.id, { enabled })
      if (this.selectedModel?.id === item.id) {
        this.currentModelConfig.enabled = enabled
      }
      this.$forceUpdate()
      this.notifyRibbonRefreshModelMenu()
    },
    // 通知 ribbon 刷新模型选择菜单
    notifyRibbonRefreshModelMenu() {
      try {
        if (window.Application?.ribbonUI?.InvalidateControl) {
          window.Application.ribbonUI.InvalidateControl('menuModelSelect')
        }
      } catch (e) {
        console.warn('刷新 ribbon 模型菜单失败:', e)
      }
    },
    // 选择模型（模型设置下为清单项 id/name，默认模型下为 allModels 项）
    selectModel(model) {
      this.selectedModelId = model.id
      this.selectedModel = model
      this.isFormSaved = false // 重置保存状态
      const config = getModelConfig(model.id)
      this.currentModelConfig = {
        apiKey: config.apiKey || '',
        apiUrl: config.apiUrl || this.getDefaultApiUrl(model.id),
        enabled: config.enabled || false,
        modelSeries: config.modelSeries || config.models || [] // 兼容旧版本
      }
    },
    // 选择默认模型（旧逻辑，保留兼容）
    selectDefaultModel(modelId) {
      this.defaultModelsByCategory[this.activeCategory] = modelId
      if (this.activeCategory === 'chat') {
        this.defaultModelId = modelId
      }
      this.saveDefaultModelsToStorage()
    },
    // 从下拉选择默认模型（分组带图标）
    selectDefaultModelFromDropdown(m) {
      this.selectDefaultModelForCategory(this.activeDefaultSettingItem, m ? m.id : null)
      this.defaultModelDropdownOpen = false
    },
    onDefaultModelDropdownBlur() {
      setTimeout(() => { this.defaultModelDropdownOpen = false }, 150)
    },
    isModelGroupCollapsed(providerId) {
      return !!this.modelGroupCollapsed[providerId]
    },
    toggleModelGroupCollapsed(providerId) {
      this.modelGroupCollapsed = {
        ...this.modelGroupCollapsed,
        [providerId]: !this.modelGroupCollapsed[providerId]
      }
    },
    // 选择默认设置项（中间列点击）
    selectDefaultSettingItem(item) {
      this.activeDefaultSettingItem = item.key
      this.defaultModelDropdownOpen = false
      if (item.type === 'chunk') {
        this.loadChunkSettings()
        this.loadSpellCheckCommentPolicy()
      }
    },
    // 加载段落截取设置
    loadChunkSettings() {
      const s = getChunkSettings()
      this.chunkSettings = { ...s }
    },
    loadSpellCheckCommentPolicy() {
      const settings = loadGlobalSettings()
      const raw = settings?.spellCheckCommentPolicy?.writeReviewComments
      this.spellCheckCommentPolicy = {
        writeReviewComments: raw !== false
      }
      this.multimodalServerFallback = getMultimodalServerFallbackConfig()
    },
    loadRegressionSampleRecords() {
      this.regressionSampleRecords = listRegressionSamples({})
      const filtered = this.filteredRegressionSampleRecords
      if (!filtered.length) {
        this.selectedRegressionSampleId = ''
        this.resetRegressionSampleDraft()
        return
      }
      if (!filtered.some(item => item.id === this.selectedRegressionSampleId)) {
        this.selectedRegressionSampleId = filtered[0].id
      }
      this.loadSelectedRegressionSampleDraft()
    },
    resetRegressionSampleDraft() {
      this.regressionSampleDraft = createRegressionSampleRecord({
        id: '',
        assistantId: this.selectedEvaluationAssistantId,
        label: '',
        groupKey: 'default',
        riskLevel: 'medium',
        inputText: '',
        expectedDocumentAction: '',
        expectedInputSource: '',
        expectedTargetLanguage: '',
        expectedOutputFormat: '',
        critical: false,
        source: 'golden',
        tags: [],
        notes: ''
      })
      this.regressionSampleTagsText = ''
    },
    loadSelectedRegressionSampleDraft() {
      const sample = this.selectedRegressionSample
      if (!sample) {
        this.resetRegressionSampleDraft()
        return
      }
      this.regressionSampleDraft = createRegressionSampleRecord({
        ...sample,
        assistantId: sample.assistantId || this.selectedEvaluationAssistantId
      })
      this.regressionSampleTagsText = Array.isArray(sample?.tags) ? sample.tags.join(', ') : ''
    },
    // 按分类选择默认模型（新逻辑，下拉变更时调用）
    selectDefaultModelForCategory(categoryKey, value) {
      this.defaultModelsByCategory[categoryKey] = value || null
      if (categoryKey === 'chat') {
        this.defaultModelId = value || null
      }
      this.saveDefaultModelsToStorage()
    },
    // 获取某分类可选的模型列表（从设置中已开启的模型，按类型过滤）
    getModelsForCategory(modelType) {
      return getFlatModelsFromSettings(modelType)
    },
    // 获取当前分类标签
    getCurrentCategoryLabel() {
      const category = this.modelCategories.find(c => c.key === this.activeCategory)
      return category ? category.label : '模型'
    },
    // 根据分类获取默认模型名称
    getDefaultModelNameByCategory(categoryKey) {
      const modelId = this.defaultModelsByCategory[categoryKey]
      if (!modelId) return null
      const category = this.modelCategories.find(c => c.key === categoryKey)
      const models = category ? this.getModelsForCategory(category.modelType) : []
      const model = models.find(m => m.id === modelId)
      return model ? (model.name || model.modelId) : modelId
    },
    // 获取默认 API URL（支持模型清单 id 与原有提供商 id）
    getDefaultApiUrl(modelId) {
      const defaultUrls = {
        OPENAI: 'https://api.openai.com/v1',
        OPENAI_RESPONSE: 'https://api.openai.com/v1',
        OLLAMA: 'http://localhost:11434',
        XINFERENCE: 'http://localhost:9997/v1',
        ONEAPI: '',
        FASTCHAT: 'http://localhost:8000/v1',
        OPENAI_COMPATIBLE: '',
        DEEPSEEK: 'https://api.deepseek.com/v1',
        GEMINI: 'https://generativelanguage.googleapis.com/v1',
        ZHIPU: 'https://open.bigmodel.cn/api/paas/v4',
        REPLICATE_FAL_AI: '',
        ollama: 'http://localhost:11434',
        openai: 'https://api.openai.com/v1',
        'azure-openai': 'https://your-resource.openai.azure.com',
        anthropic: 'https://api.anthropic.com/v1',
        gemini: 'https://generativelanguage.googleapis.com/v1',
        'vertex-ai': 'https://us-central1-aiplatform.googleapis.com/v1',
        'tencent-hunyuan': 'https://hunyuan.tencentcloudapi.com',
        'baidu-qianfan': 'https://qianfan.baidubce.com/v2',
        'aliyun-bailian': 'https://dashscope.aliyuncs.com/api/v1',
        zhipu: 'https://open.bigmodel.cn/api/paas/v4',
        deepseek: 'https://api.deepseek.com/v1',
        minimax: 'https://api.minimax.chat/v1',
        'step-ai': 'https://api.stepfun.com/v1',
        'moonshot': 'https://api.moonshot.cn/v1',
        baichuan: 'https://api.baichuan-ai.com/v1',
        'lingyi-wanwu': 'https://api.lingyiwanwu.com/v1',
        groq: 'https://api.groq.com/openai/v1',
        together: 'https://api.together.xyz/v1',
        fireworks: 'https://api.fireworks.ai/inference/v1',
        openrouter: 'https://openrouter.ai/api/v1',
        'aws-bedrock': 'https://bedrock-runtime.us-east-1.amazonaws.com',
        'huggingface': 'https://api-inference.huggingface.co',
        'vercel-ai': 'https://gateway.ai.cloudflare.com/v1',
        'lm-studio': 'http://localhost:1234/v1',
        'tencent-cloud-ti': 'https://ti.tencentcloudapi.com',
        'tianyi-xirang': 'https://api.ctyun.cn',
        'qiniu': 'https://ai.qiniuapi.com/v1',
        'ppio': 'https://api.ppio.cloud/v1',
        'lanyun': 'https://api.lanyun.com/v1',
        'ph8': 'https://api.ph8.com/v1',
        'sophnet': 'https://api.sophnet.com/v1',
        'cephalon': 'https://api.cephalon.ai/v1',
        '302-ai': 'https://api.302.ai/v1',
        'tokenflux': 'https://api.tokenflux.com/v1',
        'burncloud': 'https://api.burncloud.com/v1',
        'aionly': 'https://api.aionly.com/v1',
        'dmxapi': 'https://api.dmxapi.com/v1',
        'alaya-new': 'https://api.alaya.com/v1',
        'ocoolai': 'https://api.ocoolai.com/v1',
        'aihubmix': 'https://api.aihubmix.com/v1',
        'volcengine': 'https://ark.cn-beijing.volces.com/api/v3',
        'wuwen-xinqiong': 'https://api.wuwen.com/v1',
        'xiaomi-mimo': 'https://api.mimo.mi.com/v1',
        'cerebras': 'https://api.cerebras.ai/v1',
        'totoro': 'https://api.longcat.chat/openai',
        longcat: 'https://api.longcat.chat/openai',
        poe: 'https://api.poe.com/v1',
        'voyage-ai': 'https://api.voyageai.com/v1',
        'gpustack': 'https://api.gpustack.com/v1',
        'modelscope': 'https://api.modelscope.cn/v1',
        hyperbolic: 'https://api.hyperbolic.com/v1',
        jina: 'https://api.jina.ai/v1',
        grok: 'https://api.x.ai/v1',
        nvidia: 'https://integrate.api.nvidia.com/v1',
        'github-models': 'https://api.github.com/models',
        'github-copilot': 'https://api.githubcopilot.com/v1',
        'new-api': '',
        CherryIN: ''
      }
      return defaultUrls[modelId] || ''
    },
    // 更新模型配置
    updateModelConfig() {
      if (!this.selectedModel) return
      saveModelConfig(this.selectedModel.id, this.currentModelConfig)
      this.notifyRibbonRefreshModelMenu()
    },
    // 切换 API 密钥显示
    toggleApiKeyVisibility() {
      this.showApiKey = !this.showApiKey
    },
    // 粘贴 API 密钥（WPS ShowDialog 中 Ctrl+V 可能被主文档捕获，用此按钮粘贴）
    async pasteApiKey() {
      try {
        if (navigator.clipboard?.readText) {
          const text = (await navigator.clipboard.readText()).trim()
          const cur = (this.currentModelConfig.apiKey || '').trim()
          this.currentModelConfig.apiKey = cur ? cur + ',' + text : text
          this.updateModelConfig()
          this.onFormChange()
          this.showMessage('已粘贴')
          return
        }
        // 备用：聚焦输入框后执行 paste 命令（部分环境如 file:// 可能不支持 Clipboard API）
        const el = this.$refs.apiKeyInputRef
        if (el) {
          el.focus()
          const ok = document.execCommand('paste')
          if (ok) {
            this.updateModelConfig()
            this.onFormChange()
            this.showMessage('已粘贴')
          } else {
            this.showMessage('请手动输入 API 密钥', 'info')
          }
        } else {
          this.showMessage('请手动输入 API 密钥', 'info')
        }
      } catch (e) {
        console.warn('粘贴失败:', e)
        this.showMessage('粘贴失败，请手动输入', 'error')
      }
    },
    // API 密钥/地址输入框获得焦点时，尝试让对话框窗口获得焦点（改善 Ctrl+V 等快捷键）
    onApiKeyInputFocus() {
      try {
        if (window.focus) window.focus()
      } catch (e) {}
    },
    // 粘贴 API 地址
    async pasteApiUrl() {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = (await navigator.clipboard.readText()).trim()
          this.currentModelConfig.apiUrl = text
          this.updateModelConfig()
          this.onFormChange()
          this.showMessage('已粘贴')
        } else {
          this.showMessage('当前环境不支持剪贴板读取，请手动输入', 'error')
        }
      } catch (e) {
        console.warn('粘贴失败:', e)
        this.showMessage('粘贴失败，请手动输入', 'error')
      }
    },
    // 检测 API 密钥和地址
    async detectApiKey() {
      const apiUrl = (this.currentModelConfig.apiUrl || '').trim()
      const apiKey = (this.currentModelConfig.apiKey || '').trim()
      if (!apiUrl) {
        this.showMessage('请先填写 API 地址', 'error')
        return
      }
      if (!apiKey && !this.isOllamaLikeProvider(this.selectedModel?.id)) {
        this.showMessage('请先填写 API 密钥', 'error')
        return
      }
      this.showMessage('正在检测连接...', 'info')
      try {
        const base = apiUrl.replace(/\/+$/, '')
        const isOllama = this.isOllamaLikeProvider(this.selectedModel?.id)
        let url, options
        if (isOllama) {
          url = base + '/api/tags'
          options = { method: 'GET' }
        } else {
          const isQianfan = base.includes('qianfan.baidubce.com') || /\/v\d+$/.test(base)
          const modelsPath = isQianfan || base.endsWith('/v1') ? '/models' : '/v1/models'
          url = base + modelsPath
          const firstKey = apiKey.split(',')[0].trim()
          options = {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${firstKey}`,
              'Content-Type': 'application/json'
            }
          }
        }
        const res = await fetch(url, options)
        if (res.ok) {
          this.showMessage('连接成功，API 可用', 'success')
        } else {
          const text = await res.text()
          let msg = `连接失败: ${res.status} ${res.statusText}`
          if (res.status === 401) {
            msg = '401 未授权：请检查 API 密钥是否正确、是否已过期，或该密钥是否有访问权限'
          } else if (res.status === 403) {
            msg = '403 禁止访问：API 密钥可能无权限访问此接口'
          } else if (text) {
            try {
              const err = JSON.parse(text)
              if (err?.error?.message) msg += ' - ' + err.error.message
            } catch (_) {}
          }
          this.showMessage(msg, 'error')
        }
      } catch (e) {
        console.error('API 检测失败:', e)
        this.showMessage('连接失败: ' + (e.message || '网络错误'), 'error')
      }
    },
    // 判断是否为 Ollama 类（无需密钥）的提供商
    isOllamaLikeProvider(providerId) {
      const ids = ['OLLAMA', 'ollama', 'XINFERENCE', 'xinference', 'FASTCHAT', 'lm-studio']
      return ids.some(id => String(providerId || '').toLowerCase() === id.toLowerCase())
    },
    // 清除 API 密钥
    clearApiKey() {
      this.currentModelConfig.apiKey = ''
      this.updateModelConfig()
      this.onFormChange()
    },
    // 清除 API 地址
    clearApiUrl() {
      this.currentModelConfig.apiUrl = ''
      this.updateModelConfig()
      this.onFormChange()
    },
    // 获取 API 预览 URL（实际调用的 chat 接口）
    getApiPreviewUrl() {
      if (!this.currentModelConfig.apiUrl) return ''
      const url = this.currentModelConfig.apiUrl.trim().replace(/\/+$/, '')
      if (/\/v\d+$/.test(url) || url.includes('qianfan.baidubce.com')) {
        return url + '/chat/completions'
      }
      if (url.endsWith('/v1')) {
        return url + '/chat/completions'
      }
      return url + '/v1/chat/completions'
    },
    // 刷新模型系列（真实调用 API）
    async refreshModelSeries() {
      const apiUrl = (this.currentModelConfig.apiUrl || '').trim()
      const apiKey = (this.currentModelConfig.apiKey || '').trim()
      if (!apiUrl) {
        this.showMessage('请先配置 API 地址', 'error')
        return
      }
      if (!apiKey && !this.isOllamaLikeProvider(this.selectedModel?.id)) {
        this.showMessage('请先配置 API 密钥', 'error')
        return
      }
      this.showMessage('正在获取模型列表...', 'info')
      try {
        const base = apiUrl.replace(/\/+$/, '')
        const isOllama = this.isOllamaLikeProvider(this.selectedModel?.id)
        let url, options
        if (isOllama) {
          url = base + '/api/tags'
          options = { method: 'GET' }
        } else {
          const isQianfan = base.includes('qianfan.baidubce.com') || /\/v\d+$/.test(base)
          const modelsPath = isQianfan || base.endsWith('/v1') ? '/models' : '/v1/models'
          url = base + modelsPath
          const firstKey = apiKey.split(',')[0].trim()
          options = {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${firstKey}`,
              'Content-Type': 'application/json'
            }
          }
        }
        const res = await fetch(url, options)
        if (!res.ok) {
          // LongCat 等部分 API 不支持 GET /v1/models，404 时使用预设模型
          const pid = this.selectedModel?.id
          const noModelsApi = ['totoro', 'longcat']
          if (res.status === 404 && noModelsApi.some(p => String(pid || '').toLowerCase() === p.toLowerCase())) {
            const defaults = this.getExampleModelSeries(pid)
            if (defaults && defaults.length > 0 && defaults[0].id !== 'default-model') {
              this.currentModelConfig.modelSeries = defaults.map(m => ({ ...m, type: inferModelType(m.id) }))
              this.updateModelConfig()
              this.showMessage(`已加载 ${defaults.length} 个预设模型（该 API 不支持模型列表接口）`, 'success')
              return
            }
          }
          const text = await res.text()
          this.showMessage(`获取模型列表失败: ${res.status}`, 'error')
          return
        }
        const data = await res.json()
        const models = this.parseModelsFromResponse(data, isOllama)
        if (models.length > 0) {
          this.currentModelConfig.modelSeries = models
          this.updateModelConfig()
          this.showMessage(`已获取 ${models.length} 个模型`, 'success')
        } else {
          this.showMessage('未解析到可用模型，请检查 API 格式', 'error')
        }
      } catch (e) {
        console.error('刷新模型失败:', e)
        this.showMessage('获取失败: ' + (e.message || '网络错误'), 'error')
      }
    },
    // 解析 API 返回的模型列表（兼容 OpenAI / Ollama 格式），并推断模型类型
    parseModelsFromResponse(data, isOllama) {
      if (isOllama) {
        const list = data.models || data
        if (!Array.isArray(list)) return []
        return list.map(m => {
          const id = m.name || m.id || m
          const name = (m.name || m.id || m) + (m.details?.parameter_size ? ` (${m.details.parameter_size})` : '')
          return { id, name, type: inferModelType(id) }
        })
      }
      const list = data.data || data.models || (Array.isArray(data) ? data : [])
      if (!Array.isArray(list)) return []
      return list.map(m => {
        const id = m.id || m.name || String(m)
        const name = m.id || m.name || String(m)
        return { id, name, type: inferModelType(id) }
      })
    },
    // 获取示例模型系列（实际应该从API获取）
    getExampleModelSeries(providerId) {
      const examples = {
        openai: [
          { id: 'gpt-4o', name: 'GPT-4o' },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
          { id: 'gpt-4', name: 'GPT-4' },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
        ],
        anthropic: [
          { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
          { id: 'claude-3-opus', name: 'Claude 3 Opus' },
          { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet' },
          { id: 'claude-3-haiku', name: 'Claude 3 Haiku' }
        ],
        ollama: [
          { id: 'llama3', name: 'Llama 3' },
          { id: 'mistral', name: 'Mistral' },
          { id: 'codellama', name: 'CodeLlama' }
        ],
        'tencent-hunyuan': [
          { id: 'hunyuan-lite', name: '混元-Lite' },
          { id: 'hunyuan-standard', name: '混元-Standard' },
          { id: 'hunyuan-pro', name: '混元-Pro' }
        ],
        'aliyun-bailian': [
          { id: 'qwen-turbo', name: '通义千问-Turbo' },
          { id: 'qwen-plus', name: '通义千问-Plus' },
          { id: 'qwen-max', name: '通义千问-Max' }
        ],
        zhipu: [
          { id: 'glm-4', name: 'GLM-4' },
          { id: 'glm-4-all', name: 'GLM-4-All' },
          { id: 'chatglm3-6b', name: 'ChatGLM3-6B' }
        ],
        totoro: [
          { id: 'LongCat-Flash-Chat', name: 'LongCat-Flash-Chat' },
          { id: 'LongCat-Flash-Thinking', name: 'LongCat-Flash-Thinking' },
          { id: 'LongCat-Flash-Thinking-2601', name: 'LongCat-Flash-Thinking-2601' },
          { id: 'LongCat-Flash-Lite', name: 'LongCat-Flash-Lite' }
        ],
        longcat: [
          { id: 'LongCat-Flash-Chat', name: 'LongCat-Flash-Chat' },
          { id: 'LongCat-Flash-Thinking', name: 'LongCat-Flash-Thinking' },
          { id: 'LongCat-Flash-Thinking-2601', name: 'LongCat-Flash-Thinking-2601' },
          { id: 'LongCat-Flash-Lite', name: 'LongCat-Flash-Lite' }
        ]
      }
      return examples[providerId] || examples[String(providerId || '').toLowerCase()] || [
        { id: 'default-model', name: '默认模型' }
      ]
    },
    // 管理模型系列（编辑、添加、删除）
    manageModelSeries() {
      this.manageModelList = [...(this.currentModelConfig.modelSeries || [])].map(m => {
        if (typeof m === 'string') return { id: m, name: m, type: inferModelType(m) }
        return { id: m.id || m.name, name: m.name || m.id || '', type: m.type || inferModelType(m.id || m.name) }
      })
      this.manageNewId = ''
      this.manageNewName = ''
      this.showManageModal = true
    },
    // 打开添加模型对话框
    openAddModelDialog() {
      this.addModelMode = 'add'
      this.editingModelId = null
      this.addModelForm = { name: '', type: 'OPENAI', icon: '' }
      this.showAddModelDialog = true
    },
    // 关闭添加模型对话框
    closeAddModelDialog() {
      this.showAddModelDialog = false
    },
    triggerIconUpload() {
      this.$refs.iconFileInputRef?.click()
    },
    onIconFileChange(e) {
      const file = e.target?.files?.[0]
      if (!file || !file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        this.addModelForm.icon = ev.target?.result || ''
      }
      reader.readAsDataURL(file)
      e.target.value = ''
    },
    clearAddModelIcon() {
      this.addModelForm.icon = ''
    },
    confirmAddOrEditModel() {
      if (this.addModelMode === 'edit') {
        this.confirmEditModel()
      } else {
        this.confirmAddModel()
      }
    },
    // 确认添加模型供应商
    confirmAddModel() {
      const name = (this.addModelForm.name || '').trim()
      const type = this.addModelForm.type || 'OPENAI'
      if (!name) {
        this.showMessage('请输入供应商名称', 'error')
        return
      }
      const customList = getCustomModelProviders()
      const id = type + '-' + Date.now()
      const newItem = { id, name, type, icon: this.addModelForm.icon || '' }
      const updated = [newItem, ...customList]
      saveCustomModelProviders(updated)
      const newOrder = [id, ...this.modelOrder.filter(x => x !== id)]
      saveModelOrder(newOrder)
      this.modelOrder = newOrder
      this.refreshModelInventoryList()
      saveModelConfig(id, {
        apiKey: '',
        apiUrl: this.getDefaultApiUrl(type),
        enabled: false,
        modelSeries: []
      })
      this.closeAddModelDialog()
      this.selectModel({ id, name, icon: this.addModelForm.icon || getModelLogoPath(type), isCustom: true })
      this.showMessage('已添加，显示在列表第一位')
      this.notifyRibbonRefreshModelMenu()
    },
    // 确认编辑模型供应商
    confirmEditModel() {
      const name = (this.addModelForm.name || '').trim()
      const type = this.addModelForm.type || 'OPENAI'
      const id = this.editingModelId
      if (!name || !id) return
      const customList = getCustomModelProviders()
      const idx = customList.findIndex(m => m.id === id)
      if (idx < 0) return
      const oldItem = customList[idx]
      const updatedItem = { ...oldItem, name, type, icon: this.addModelForm.icon || '' }
      const updated = [...customList]
      updated[idx] = updatedItem
      saveCustomModelProviders(updated)
      this.refreshModelInventoryList()
      const config = getModelConfig(id)
      saveModelConfig(id, {
        ...config,
        apiUrl: config.apiUrl || this.getDefaultApiUrl(type)
      })
      this.closeAddModelDialog()
      this.selectModel({ id, name, icon: updatedItem.icon || getModelLogoPath(type), isCustom: true })
      this.showMessage('已更新')
      this.notifyRibbonRefreshModelMenu()
    },
    showContextMenu(e, item) {
      this.contextMenu = { visible: true, x: e.clientX, y: e.clientY, item, menuType: 'model' }
      this.$nextTick(() => {
        document.addEventListener('click', this.hideContextMenu)
      })
    },
    showAssistantContextMenu(e, item) {
      this.contextMenu = { visible: true, x: e.clientX, y: e.clientY, item, menuType: 'assistant' }
      this.$nextTick(() => {
        document.addEventListener('click', this.hideContextMenu)
      })
    },
    hideContextMenu() {
      this.contextMenu = { visible: false, x: 0, y: 0, item: null, menuType: '' }
      document.removeEventListener('click', this.hideContextMenu)
    },
    editCustomModel() {
      const item = this.contextMenu.item
      this.hideContextMenu()
      if (!item) return
      this.addModelMode = 'edit'
      this.editingModelId = item.id
      const customList = getCustomModelProviders()
      const m = customList.find(x => x.id === item.id)
      this.addModelForm = {
        name: m?.name || item.name,
        type: m?.type || 'OPENAI',
        icon: m?.icon || ''
      }
      this.showAddModelDialog = true
    },
    deleteCustomModel() {
      const item = this.contextMenu.item
      this.hideContextMenu()
      if (!item) return
      const customList = getCustomModelProviders().filter(m => m.id !== item.id)
      saveCustomModelProviders(customList)
      this.refreshModelInventoryList()
      deleteModelConfig(item.id)
      if (this.selectedModelId === item.id) {
        const list = this.modelListForSettings.filter(m => m.id !== item.id)
        if (list.length > 0) {
          this.selectModel(list[0])
        } else {
          this.selectedModelId = null
          this.selectedModel = null
        }
      }
      this.showMessage('已删除')
      this.notifyRibbonRefreshModelMenu()
    },
    canMoveAssistantContextMenuItem(direction) {
      return this.canMoveAssistantSettingItem(this.assistantContextMenuItem, direction)
    },
    duplicateAssistantFromContextMenu() {
      const item = this.assistantContextMenuItem
      this.hideContextMenu()
      if (!item) return
      this.duplicateAssistantFromList(item)
    },
    exportAssistantFromContextMenu() {
      const item = this.assistantContextMenuItem
      this.hideContextMenu()
      if (!item) return
      this.exportAssistantItem(item)
    },
    moveAssistantFromContextMenu(direction) {
      const item = this.assistantContextMenuItem
      this.hideContextMenu()
      if (!item || !this.canMoveAssistantSettingItem(item, direction)) return
      this.moveAssistantSettingItem(item, direction)
    },
    deleteAssistantItem(item) {
      if (!item || item.type !== 'custom-assistant') return
      this.customAssistants = this.customAssistants.filter(entry => entry.id !== item.key)
      if (this.activeAssistantSettingItem === item.key) {
        this.activeAssistantSettingItem = 'create-custom-assistant'
        const draftItem = this.assistantSettingsItems.find(entry => entry.key === 'create-custom-assistant')
        this.assistantForm = this.buildAssistantForm(draftItem)
      }
      this.isFormSaved = false
      if (!saveCustomAssistants(this.customAssistants)) {
        this.showMessage('智能助手已删除，但顶部菜单同步失败，请稍后点击保存重试', 'error')
        return
      }
      this.notifyRibbonRefreshAssistantMenu()
      this.showMessage('智能助手已删除，并已同步顶部“更多”菜单')
    },
    deleteAssistantFromContextMenu() {
      const item = this.assistantContextMenuItem
      this.hideContextMenu()
      if (!item || item.type !== 'custom-assistant') return
      this.deleteAssistantItem(item)
    },
    onDragStart(e, index) {
      this.dragState = { fromIndex: index, dropIndex: -1, dropPosition: 'before' }
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(index))
      e.dataTransfer.setData('application/json', JSON.stringify({ index }))
    },
    onDragOver(e, index) {
      e.dataTransfer.dropEffect = 'move'
      const from = this.dragState.fromIndex
      if (from < 0 || from === index) return
      const rect = e.currentTarget.getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      const position = e.clientY < midY ? 'before' : 'after'
      this.dragState.dropIndex = index
      this.dragState.dropPosition = position
    },
    onDragLeave(e, index) {
      if (this.dragState.dropIndex === index) {
        this.dragState.dropIndex = -1
      }
    },
    onDrop(e, toIndex) {
      const fromIndex = this.dragState.fromIndex
      const dropPosition = this.dragState.dropPosition
      this.dragState = { fromIndex: -1, dropIndex: -1, dropPosition: 'before' }
      if (fromIndex < 0) return
      const list = [...this.modelInventoryList]
      const filtered = this.filteredModelInventory
      const fromItem = filtered[fromIndex]
      const toItem = filtered[toIndex]
      if (!fromItem || !toItem || fromItem.id === toItem.id) return
      const fromIdx = list.findIndex(m => m.id === fromItem.id)
      let toIdx = list.findIndex(m => m.id === toItem.id)
      if (fromIdx < 0 || toIdx < 0) return
      if (dropPosition === 'after') toIdx += 1
      const [removed] = list.splice(fromIdx, 1)
      const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx
      list.splice(insertIdx, 0, removed)
      this.modelInventoryList = list
      const newOrder = list.map(m => m.id)
      saveModelOrder(newOrder)
      this.modelOrder = newOrder
    },
    onDragEnd(e) {
      this.dragState = { fromIndex: -1, dropIndex: -1, dropPosition: 'before' }
    },
    // 关闭管理弹窗
    closeManageModal() {
      this.showManageModal = false
    },
    // 从管理列表中删除模型
    removeManageModel(index) {
      this.manageModelList.splice(index, 1)
    },
    // 添加模型到管理列表
    addManageModel() {
      const id = (this.manageNewId || '').trim()
      const name = (this.manageNewName || '').trim() || id
      if (!id) {
        this.showMessage('请输入模型 ID', 'error')
        return
      }
      this.manageModelList.push({ id, name, type: inferModelType(id) })
      this.manageNewId = ''
      this.manageNewName = ''
    },
    // 确认管理结果，写回 modelSeries（保留 type 便于按类型过滤）
    confirmManageModels() {
      this.currentModelConfig.modelSeries = this.manageModelList.map(m => ({
        id: m.id,
        name: m.name || m.id,
        type: m.type || inferModelType(m.id)
      }))
      this.updateModelConfig()
      this.closeManageModal()
      this.showMessage('模型列表已更新', 'success')
    },
    // 加载数据路径
    loadDataPath() {
      const savedPath = getDataPath()
      this.dataPath = savedPath !== null ? savedPath : ''
      this.defaultPath = getDefaultDataPath()
    },
    // 加载默认模型（校验存储的 id 是否仍在当前可选列表中）
    loadDefaultModel() {
      const settings = this.loadDefaultModelsFromStorage()
      const chatFromLegacy = settings.chat || settings.spell || settings.summary || settings.analysis || settings.translate || null
      const raw = {
        chat: chatFromLegacy,
        image: settings.image || null,
        video: settings.video || null,
        voice: settings.voice || null
      }
      this.defaultModelsByCategory = {}
      for (const [key, val] of Object.entries(raw)) {
        const cat = this.modelCategories.find(c => c.key === key)
        if (!cat) continue
        if (!val) {
          this.defaultModelsByCategory[key] = null
          continue
        }
        const models = getFlatModelsFromSettings(cat.modelType)
        const exists = models.some(m => m.id === val)
        this.defaultModelsByCategory[key] = exists ? val : null
      }
      this.defaultModelId = this.defaultModelsByCategory.chat || getDefaultModelId()
    },
    // 从存储加载默认模型配置
    loadDefaultModelsFromStorage() {
      try {
        let stored = window.Application?.PluginStorage?.getItem('defaultModelsByCategory')
        if (!stored && typeof localStorage !== 'undefined') {
          stored = localStorage.getItem('defaultModelsByCategory')
        }
        if (stored) {
          return JSON.parse(stored)
        }
      } catch (e) {
        console.warn('加载默认模型分类配置失败:', e)
      }
      const oldDefaultId = getDefaultModelId()
      return {
        chat: oldDefaultId,
        image: null,
        video: null,
        voice: null
      }
    },
    // 保存默认模型配置
    saveDefaultModelsToStorage() {
      const key = 'defaultModelsByCategory'
      const val = JSON.stringify(this.defaultModelsByCategory)
      try {
        if (window.Application?.PluginStorage) {
          window.Application.PluginStorage.setItem(key, val)
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, val)
        }
        if (this.defaultModelsByCategory.chat) {
          setDefaultModelId(this.defaultModelsByCategory.chat)
        }
        return true
      } catch (e) {
        console.error('保存默认模型配置失败:', e)
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, val)
            return true
          }
        } catch (e2) {}
        return false
      }
    },
    // 浏览文件夹
    browseFolder() {
      try {
        const app = window.Application
        if (!app?.FileDialog) return
        
        // 使用 setTimeout 确保窗口焦点正确
        setTimeout(() => {
          try {
            const fd = app.FileDialog(4)
            fd.Title = '选择数据存储路径'
            fd.InitialFileName = this.dataPath || this.defaultPath
            
            const result = fd.Show()
            if (result === -1) {
              const item = fd.SelectedItems.Item(1)
              if (item) {
                this.dataPath = String(item)
                  .replace(/^file:\/\//i, '')
                  .replace(/\\/g, '/')
                  .replace(/\/+$/, '')
                // 重置保存状态，允许继续编辑
                this.isFormSaved = false
              }
            }
            
            // 确保窗口重新获得焦点
            setTimeout(() => {
              if (window.focus) {
                window.focus()
              }
            }, 100)
          } catch (e) {
            console.warn('选择文件夹失败:', e)
            this.showMessage('选择文件夹失败，请手动输入路径', 'error')
            // 确保窗口重新获得焦点
            setTimeout(() => {
              if (window.focus) {
                window.focus()
              }
            }, 100)
          }
        }, 50)
      } catch (e) {
        console.warn('选择文件夹失败:', e)
        this.showMessage('选择文件夹失败，请手动输入路径', 'error')
      }
    },
    // 使用默认路径
    useDefault() {
      this.dataPath = this.defaultPath
    },
    // 获取默认模型名称（当前分类）
    getDefaultModelName() {
      const modelId = this.defaultModelsByCategory[this.activeCategory]
      if (!modelId) return '未设置'
      return this.getDefaultModelNameByCategory(this.activeCategory) || '未设置'
    },
    loadBackupHistoryRecords() {
      const records = getDocumentBackupRecords()
      this.backupHistoryRecords = Array.isArray(records)
        ? [...records].sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')))
        : []
      if (!this.backupHistoryRecords.length) {
        this.selectedBackupRecordId = ''
        return
      }
      this.syncSelectedBackupRecordWithFilters()
    },
    loadEvaluationHistoryRecords() {
      const records = listEvaluationRecords()
      this.evaluationHistoryRecords = Array.isArray(records) ? records : []
      this.evaluationDashboard = buildEvaluationDashboard()
      if (!this.evaluationHistoryRecords.length) {
        this.selectedEvaluationRecordId = ''
        return
      }
      this.syncSelectedEvaluationRecordWithFilters()
    },
    loadCapabilityAuditRecords() {
      const records = listCapabilityAuditRecords()
      this.capabilityAuditRecords = Array.isArray(records) ? records : []
      this.refreshCapabilityPolicyCatalog()
      this.capabilityAuditSummary = aggregateCapabilityAuditRecords({
        namespace: this.capabilityAuditNamespaceFilter,
        status: this.capabilityAuditStatusFilter,
        riskLevel: this.capabilityAuditRiskFilter
      })
      if (!this.capabilityAuditRecords.length) {
        this.selectedCapabilityAuditId = ''
        return
      }
      this.syncSelectedCapabilityAuditRecordWithFilters()
    },
    refreshCapabilityPolicyCatalog() {
      this.capabilityPolicyCatalog = getCapabilityBusCatalog()
      if (!this.capabilityPolicyNamespace) {
        this.capabilityPolicyNamespace = 'wps'
      }
      this.loadCapabilityPolicyEditor()
    },
    parsePolicyEntryText(text) {
      return String(text || '')
        .split('\n')
        .map(item => String(item || '').trim())
        .filter(Boolean)
    },
    loadCapabilityPolicyEditor() {
      const snapshot = getCapabilityPolicySnapshot(this.capabilityPolicyNamespace, this.capabilityPolicyKey)
      const capabilityPolicy = snapshot?.capabilityPolicy && typeof snapshot.capabilityPolicy === 'object'
        ? snapshot.capabilityPolicy
        : {}
      const hasCapabilityOverride = Object.keys(capabilityPolicy).length > 0
      const base = this.capabilityPolicyKey && hasCapabilityOverride
        ? capabilityPolicy
        : (snapshot?.namespacePolicy || {})
      this.capabilityPolicyForm = {
        enabled: base?.enabled !== false,
        defaultDecision: String(base?.defaultDecision || 'allow').trim() || 'allow',
        requireConfirmationForHighRisk: base?.requireConfirmationForHighRisk === true,
        perMinuteLimit: Number(base?.perMinuteLimit || 0),
        perDayLimit: Number(base?.perDayLimit || 0),
        allowedEntriesText: Array.isArray(base?.allowedEntries) ? base.allowedEntries.join('\n') : '',
        blockedEntriesText: Array.isArray(base?.blockedEntries) ? base.blockedEntries.join('\n') : ''
      }
    },
    saveCapabilityPolicyEditor() {
      const payload = {
        enabled: this.capabilityPolicyForm.enabled === true,
        defaultDecision: String(this.capabilityPolicyForm.defaultDecision || 'allow').trim() || 'allow',
        requireConfirmationForHighRisk: this.capabilityPolicyForm.requireConfirmationForHighRisk === true,
        perMinuteLimit: Math.max(0, Number(this.capabilityPolicyForm.perMinuteLimit || 0)),
        perDayLimit: Math.max(0, Number(this.capabilityPolicyForm.perDayLimit || 0)),
        allowedEntries: this.parsePolicyEntryText(this.capabilityPolicyForm.allowedEntriesText),
        blockedEntries: this.parsePolicyEntryText(this.capabilityPolicyForm.blockedEntriesText)
      }
      if (this.capabilityPolicyKey) {
        upsertCapabilityPolicy(`${this.capabilityPolicyNamespace}.${this.capabilityPolicyKey}`, payload)
      } else {
        upsertNamespacePolicy(this.capabilityPolicyNamespace, payload)
      }
      this.loadCapabilityPolicyEditor()
      this.showMessage('能力策略已保存')
    },
    removeCapabilityPolicyEditor() {
      if (!this.capabilityPolicyKey) return
      const removed = removeCapabilityPolicy(`${this.capabilityPolicyNamespace}.${this.capabilityPolicyKey}`)
      if (!removed) {
        this.showMessage('当前没有可删除的能力级覆盖策略', 'error')
        return
      }
      this.loadCapabilityPolicyEditor()
      this.showMessage('已删除能力级覆盖策略')
    },
    exportCapabilityPolicySnapshotText() {
      this.copyTextToClipboard(exportCapabilityPolicySnapshot(), '已复制能力策略 JSON')
    },
    exportCapabilityManifestSnapshot() {
      this.copyTextToClipboard(exportCapabilityBusManifest(), '已复制 capability manifest')
    },
    selectBackupRecord(record) {
      this.selectedBackupRecordId = String(record?.id || '')
      this.selectedBackupOperationId = ''
    },
    selectEvaluationRecord(record) {
      this.selectedEvaluationRecordId = String(record?.id || '')
      this.loadRegressionSampleRecords()
    },
    selectCapabilityAuditRecord(record) {
      this.selectedCapabilityAuditId = String(record?.id || '')
      this.capabilityPolicyNamespace = String(record?.namespace || 'wps').trim() || 'wps'
      this.capabilityPolicyKey = String(record?.capabilityKey || '').trim()
    },
    syncSelectedBackupRecordWithFilters() {
      if (!this.backupHistoryRecords.length) {
        this.selectedBackupRecordId = ''
        return
      }
      const filtered = this.filteredBackupHistoryRecords
      if (!filtered.length) {
        this.selectedBackupRecordId = ''
        return
      }
      const hasSelected = filtered.some(item => item.id === this.selectedBackupRecordId)
      if (!hasSelected) {
        this.selectedBackupRecordId = filtered[0].id
        this.selectedBackupOperationId = ''
      }
    },
    syncSelectedEvaluationRecordWithFilters() {
      if (!this.evaluationHistoryRecords.length) {
        this.selectedEvaluationRecordId = ''
        return
      }
      const filtered = this.filteredEvaluationHistoryRecords
      if (!filtered.length) {
        this.selectedEvaluationRecordId = ''
        return
      }
      const hasSelected = filtered.some(item => item.id === this.selectedEvaluationRecordId)
      if (!hasSelected) {
        this.selectedEvaluationRecordId = filtered[0].id
      }
    },
    syncSelectedCapabilityAuditRecordWithFilters() {
      if (!this.capabilityAuditRecords.length) {
        this.selectedCapabilityAuditId = ''
        return
      }
      const filtered = this.filteredCapabilityAuditRecords
      if (!filtered.length) {
        this.selectedCapabilityAuditId = ''
        return
      }
      const hasSelected = filtered.some(item => item.id === this.selectedCapabilityAuditId)
      if (!hasSelected) {
        this.selectedCapabilityAuditId = filtered[0].id
      }
      this.capabilityAuditSummary = aggregateCapabilityAuditRecords({
        namespace: this.capabilityAuditNamespaceFilter,
        status: this.capabilityAuditStatusFilter,
        riskLevel: this.capabilityAuditRiskFilter
      })
    },
    formatBackupRecordTime(value) {
      const date = value ? new Date(value) : null
      if (!date || Number.isNaN(date.getTime())) return '未记录'
      return date.toLocaleString()
    },
    formatEvaluationScore(score) {
      if (!Number.isFinite(Number(score))) return '未评分'
      return `${Math.round(Number(score))} 分`
    },
    getEvaluationScenarioLabel(scenarioType) {
      const normalized = String(scenarioType || '').trim()
      const mapping = {
        chat: '普通聊天',
        document: '文档任务',
        assistant: '助手版本'
      }
      return mapping[normalized] || normalized || '未记录'
    },
    getEvaluationStatusLabel(status) {
      const normalized = String(status || '').trim()
      const mapping = {
        completed: '已完成',
        empty: '输出为空',
        'preview-ready': '预览待确认',
        published: '已发布',
        promoted: '已晋升',
        review: '待复核'
      }
      return mapping[normalized] || normalized || '未记录'
    },
    getEvaluationSampleTypeLabel(sampleType) {
      const normalized = String(sampleType || '').trim()
      const mapping = {
        standard: '标准样本',
        balanced: '均衡预算',
        tight: '紧预算',
        'summary-audit': '摘要抽检',
        'release-ready': '可发布版本',
        'release-blocked': '门禁拦截版本',
        'regression-suite': '双跑回归'
      }
      return mapping[normalized] || normalized || '未记录'
    },
    getCapabilityAuditEntryLabel(entry) {
      const normalized = String(entry || '').trim()
      const mapping = {
        dialog: '对话框',
        workflow: '工作流',
        'workflow-tool': '工作流工具',
        'wps-task': 'WPS 任务',
        assistant: '助手'
      }
      return mapping[normalized] || normalized || '未记录'
    },
    getCapabilityAuditStatusLabel(status) {
      const normalized = String(status || '').trim()
      const mapping = {
        completed: '已完成',
        failed: '失败',
        cancelled: '已取消',
        denied: '已拒绝'
      }
      return mapping[normalized] || normalized || '未记录'
    },
    getCapabilityAuditDecisionLabel(decision) {
      const normalized = String(decision || '').trim()
      const mapping = {
        allow: '允许执行',
        confirmed: '已确认执行',
        confirm: '等待确认',
        deny: '拒绝执行',
        throttled: '稍后重试'
      }
      return mapping[normalized] || normalized || '未记录'
    },
    getCapabilityAuditRiskLabel(riskLevel) {
      const normalized = String(riskLevel || '').trim()
      const mapping = {
        low: '低',
        medium: '中',
        high: '高'
      }
      return mapping[normalized] || normalized || '未记录'
    },
    getCapabilityNamespaceLabel(namespace) {
      const normalized = String(namespace || '').trim()
      const mapping = {
        wps: 'WPS 原生',
        utility: 'Utility 扩展'
      }
      return mapping[normalized] || normalized || '未记录'
    },
    getEvaluationMetricLabel(key) {
      const mapping = {
        overlapScore: '语义重合',
        outputLength: '输出长度',
        attachmentCount: '附件数量',
        trimmedMessageCount: '裁剪消息数',
        batchCount: '批次数',
        validBatchCount: '有效批次',
        operationCount: '结构化操作数',
        writeTargetCount: '写回目标数',
        pendingApply: '待确认写回',
        backupCreated: '是否已备份',
        downgradeReason: '降级原因',
        benchmarkScore: '基准得分',
        realComparisonCount: '真实对比样本',
        sampleCount: '评测样本数',
        healthScore: '健康分',
        samplePassRate: '样本通过率',
        criticalFailureCount: '关键样本失败数',
        baselineAverageScore: '基线平均分',
        candidateAverageScore: '候选平均分',
        regressionDetected: '检测到回归',
        version: '版本号',
        isPromoted: '是否晋升',
        memoryCount: '长期记忆条数',
        summaryQualityScore: '摘要质量分',
        budgetLevel: '预算档位',
        summaryAuditRequired: '是否需要抽检',
        averageMemoryQualityScore: '记忆平均质量分',
        qualityGateRiskLevel: '质量门禁风险',
        estimatedCostUnits: '估算成本',
        releaseGateAllowed: '发布门禁通过',
        releaseGateReason: '门禁说明'
      }
      return mapping[String(key || '').trim()] || String(key || '').trim()
    },
    exportCapabilityAuditSnapshot() {
      const text = exportCapabilityAuditRecords({
        namespace: this.capabilityAuditNamespaceFilter,
        status: this.capabilityAuditStatusFilter,
        riskLevel: this.capabilityAuditRiskFilter
      })
      this.copyTextToClipboard(text, '已复制能力审计导出内容')
    },
    replaySelectedBackupOperation() {
      const batch = this.selectedBackupOperationBatch
      const entry = this.selectedBackupOperationEntry
      if (!batch?.id || !entry?.id) {
        this.showMessage('当前没有可重放的操作', 'error')
        return
      }
      try {
        const result = replayDocumentOperationBatch(batch.id, { operationId: entry.id })
        this.showMessage(result?.results?.[0]?.message || '已重放所选操作')
      } catch (error) {
        this.showMessage(error?.message || '操作重放失败', 'error')
      }
    },
    replayAllBackupOperations() {
      const batch = this.selectedBackupOperationBatch
      if (!batch?.id) {
        this.showMessage('当前没有可重放的操作账本', 'error')
        return
      }
      try {
        const result = replayDocumentOperationBatch(batch.id)
        this.showMessage(`已按顺序重放 ${Number(result?.replayedCount || 0)} 个操作，跳过 ${Number(result?.skippedCount || 0)} 个`)
      } catch (error) {
        this.showMessage(error?.message || '逐步回放失败', 'error')
      }
    },
    exportSelectedBackupOperationBatch() {
      const batch = this.selectedBackupOperationBatch
      if (!batch?.id) {
        this.showMessage('当前没有可导出的操作账本', 'error')
        return
      }
      this.copyTextToClipboard(exportDocumentOperationBatch(batch.id), '已复制操作账本 JSON')
    },
    async runSelectedAssistantRegression() {
      if (!this.canRunSelectedAssistantRegression) return
      this.isRunningAssistantRegression = true
      try {
        const result = await runAssistantVersionRegression({
          candidateVersionId: this.selectedEvaluationRecord?.ownerId
        })
        this.loadEvaluationHistoryRecords()
        if (result?.record?.id) {
          this.selectedEvaluationRecordId = result.record.id
        }
        this.showMessage(result?.record?.summary || '已完成版本双跑回归')
      } catch (error) {
        this.showMessage(error?.message || '版本双跑回归失败', 'error')
      } finally {
        this.isRunningAssistantRegression = false
      }
    },
    async runSelectedAssistantFamilyRegression() {
      if (!this.canRunSelectedAssistantFamilyRegression) return
      this.isRunningFamilyRegression = true
      try {
        const result = await runAssistantFamilyRegression({
          candidateVersionId: this.selectedEvaluationRecord?.ownerId,
          maxVersions: this.regressionFamilyMaxVersions
        })
        this.loadEvaluationHistoryRecords()
        this.showMessage(`已完成 ${Number(result?.executedCount || 0)} 个版本的批量回归`)
      } catch (error) {
        this.showMessage(error?.message || '家族批量回归失败', 'error')
      } finally {
        this.isRunningFamilyRegression = false
      }
    },
    saveRegressionSampleDraft() {
      if (!String(this.regressionSampleDraft?.label || '').trim() || !String(this.regressionSampleDraft?.inputText || '').trim()) {
        this.showMessage('请至少填写样本名称和样本输入', 'error')
        return
      }
      const tags = String(this.regressionSampleTagsText || '')
        .split(/[,\n，]/)
        .map(item => String(item || '').trim())
        .filter(Boolean)
      const record = upsertRegressionSample({
        ...this.regressionSampleDraft,
        groupKey: String(this.regressionSampleDraft?.groupKey || 'default').trim() || 'default',
        riskLevel: String(this.regressionSampleDraft?.riskLevel || 'medium').trim() || 'medium',
        assistantId: String(this.regressionSampleDraft?.assistantId || this.selectedEvaluationAssistantId || '').trim(),
        tags
      })
      this.loadRegressionSampleRecords()
      this.selectedRegressionSampleId = record.id
      this.loadSelectedRegressionSampleDraft()
      this.showMessage('黄金样本已保存')
    },
    removeSelectedRegressionSample() {
      if (!this.selectedRegressionSampleId) return
      const removed = removeRegressionSample(this.selectedRegressionSampleId)
      if (!removed) {
        this.showMessage('未找到可删除的黄金样本', 'error')
        return
      }
      this.loadRegressionSampleRecords()
      this.showMessage('黄金样本已删除')
    },
    exportRegressionSampleSnapshot() {
      this.copyTextToClipboard(exportRegressionSamples({
        assistantId: this.selectedEvaluationAssistantId
      }), '已复制黄金样本 JSON')
    },
    exportRegressionSampleTemplateSnapshot() {
      this.copyTextToClipboard(buildRegressionSampleTemplate({
        assistantId: this.selectedEvaluationAssistantId
      }), '已复制黄金样本模板 JSON')
    },
    triggerRegressionSampleImport() {
      const input = this.$refs.regressionSampleImportInput
      if (input) {
        input.value = ''
        input.click()
      }
    },
    async onRegressionSampleImportFileChange(event) {
      const file = event?.target?.files?.[0]
      if (!file) return
      try {
        const payload = await file.text()
        const result = importRegressionSamples(payload, {
          mode: 'merge',
          assistantId: this.selectedEvaluationAssistantId
        })
        this.loadRegressionSampleRecords()
        this.showMessage(`已导入 ${Number(result?.importedCount || 0)} 条黄金样本`)
      } catch (error) {
        this.showMessage(error?.message || '黄金样本导入失败', 'error')
      } finally {
        if (event?.target) event.target.value = ''
      }
    },
    formatEvaluationMetricValue(value) {
      if (typeof value === 'boolean') return value ? '是' : '否'
      if (value == null || value === '') return '未记录'
      if (Array.isArray(value)) return value.join('、') || '未记录'
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)
    },
    getBackupReasonLabel(reason) {
      const normalized = String(reason || '').trim()
      if (!normalized) return '未记录'
      const mapping = {
        'document-processing-preview-apply': '文档处理写回前备份',
        'document-operation-apply': '文档操作执行前备份',
        'assistant-task-apply': '助手任务写回前备份'
      }
      return mapping[normalized] || normalized
    },
    getBackupLaunchSourceLabel(source) {
      const normalized = String(source || '').trim()
      if (!normalized) return '未记录'
      const mapping = {
        dialog: '对话框',
        settings: '设置面板',
        workflow: '工作流'
      }
      return mapping[normalized] || normalized
    },
    getBackupTaskStatusLabel(status) {
      const normalized = String(status || '').trim()
      if (!normalized) return '未记录'
      const mapping = {
        pending: '待执行',
        running: '执行中',
        completed: '已完成',
        failed: '失败',
        cancelled: '已取消'
      }
      return mapping[normalized] || normalized
    },
    emitBackupRestoreSignal(payload = {}) {
      const signal = {
        ...payload,
        restoredAt: new Date().toISOString()
      }
      try {
        localStorage.setItem('NdDocumentBackupRestoreSignal', JSON.stringify(signal))
      } catch (_) {
        // ignore storage sync failures
      }
    },
    async restoreSelectedBackupRecord() {
      if (!this.selectedBackupRecord || this.isRestoringBackupRecord) return
      const confirmed = window.confirm(`确认恢复备份版本「${this.selectedBackupRecord.documentName || '文档'}」吗？这会覆盖源文件当前内容。`)
      if (!confirmed) return
      this.isRestoringBackupRecord = true
      try {
        const result = await restoreDocumentBackupRecordById(this.selectedBackupRecord.id)
        this.emitBackupRestoreSignal({
          backupId: this.selectedBackupRecord.id,
          sourcePath: this.selectedBackupRecord.sourcePath || '',
          taskId: this.selectedBackupRecord.taskId || ''
        })
        this.loadBackupHistoryRecords()
        this.showMessage(result?.message || '已恢复所选备份版本。')
      } catch (error) {
        this.showMessage(error?.message || '恢复备份失败，请稍后重试。', 'error')
      } finally {
        this.isRestoringBackupRecord = false
      }
    },
    async replaySelectedBackupLinkedTask() {
      if (this.isReplayingBackupRecord) return
      const task = this.selectedBackupLinkedTask
      if (!task) {
        this.showMessage('当前备份没有关联可重放的任务', 'error')
        return
      }
      const replayMode = this.selectedBackupReplayMode
      if (!replayMode) {
        this.showMessage('当前关联任务不支持一键重放', 'error')
        return
      }
      this.isReplayingBackupRecord = true
      try {
        if (replayMode === 'apply-plan') {
          const result = await applyAssistantTaskPlan(task.id)
          this.showMessage(result?.message || '已重新应用当前文档计划')
          this.openTaskProgressWindow(task.id, task.title || '任务进度')
          return
        }
        const retryPayload = task?.data?.retryPayload || {}
        const assistantId = String(retryPayload?.assistantId || task?.data?.assistantId || '').trim()
        if (!assistantId) {
          throw new Error('未找到可重放的助手任务参数')
        }
        const overrides = {
          taskTitle: String(retryPayload?.taskTitle || task?.title || '助手任务').trim(),
          inputText: String(retryPayload?.inputText || task?.data?.fullInput || '').trim(),
          inputSource: String(retryPayload?.inputSource || '').trim(),
          documentAction: String(retryPayload?.documentAction || '').trim(),
          targetLanguage: String(retryPayload?.targetLanguage || '').trim(),
          launchSource: 'settings',
          strictAssistantDefaults: retryPayload?.strictAssistantDefaults === true,
          previewOnly: retryPayload?.previewOnly === true,
          reportSettings: retryPayload?.reportSettings && typeof retryPayload.reportSettings === 'object'
            ? JSON.parse(JSON.stringify(retryPayload.reportSettings))
            : undefined,
          taskData: {
            ...(retryPayload?.taskData && typeof retryPayload.taskData === 'object' ? retryPayload.taskData : {}),
            originRequirementText: String(
              retryPayload?.requirementText ||
              retryPayload?.taskData?.originRequirementText ||
              task?.data?.originRequirementText ||
              ''
            ).trim(),
            retrySourceTaskId: String(task?.id || '').trim(),
            replaySourceBackupId: String(this.selectedBackupRecord?.id || '').trim()
          }
        }
        const { taskId } = startAssistantTask(assistantId, overrides)
        if (!taskId) {
          throw new Error('未能创建新的重放任务')
        }
        this.showMessage('已基于历史备份关联任务重新发起处理')
        this.openTaskProgressWindow(taskId, overrides.taskTitle || '助手任务')
      } catch (error) {
        this.showMessage(error?.message || '一键重放失败，请稍后重试', 'error')
      } finally {
        this.isReplayingBackupRecord = false
      }
    },
    // 获取子菜单标签
    getSubMenuLabel() {
      const item = this.generalSubMenus.find(item => item.key === this.activeSubMenu)
      return item ? item.label : ''
    },
    // 显示消息
    showMessage(text, type = 'success') {
      this.message = { text, type }
      setTimeout(() => {
        this.message = null
      }, 3000)
    },
    // 图片路径（兼容 base: './' 与绝对路径）
    isSettingsMainMenuIconAsset(icon) {
      return typeof icon === 'string' && /^images\/.+\.(svg|png|webp|gif|jpe?g)$/i.test(icon.trim())
    },
    getImageSrc(icon) {
      if (!icon) return ''
      return publicAssetUrl(String(icon).replace(/^\/+/, ''))
    },
    // 处理图片加载错误
    handleImageError(event) {
      if (event?.target) event.target.style.display = 'none'
    },
    // 保存
    onSave() {
      let hasError = false
      this.commitAssistantForm()
      // 1. 保存数据路径
      const path = (this.dataPath || '').trim()
      if (path) {
        if (!setDataPath(path)) {
          this.showMessage('数据路径保存失败', 'error')
          hasError = true
        }
        if (!hasError) saveGlobalSettings({ dataPath: path })
      } else {
        setDataPath('')
      }
      // 2. 保存默认模型（按分类）
      if (!this.saveDefaultModelsToStorage()) {
        this.showMessage('默认模型保存失败', 'error')
        hasError = true
      }
      // 3. 保存段落截取设置
      saveChunkSettings(this.chunkSettings)
      saveGlobalSettings({
        spellCheckCommentPolicy: {
          writeReviewComments: this.spellCheckCommentPolicy.writeReviewComments === true
        },
        multimodalServerFallback: {
          enabled: this.multimodalServerFallback.enabled === true,
          endpoint: String(this.multimodalServerFallback.endpoint || '').trim(),
          apiKey: String(this.multimodalServerFallback.apiKey || '').trim()
        }
      })
      // 4. 保存助手设置与自定义助手
      if (!saveAssistantSettings(this.assistantSettingsMap)) {
        this.showMessage('助手设置保存失败', 'error')
        hasError = true
      }
      if (!saveCustomAssistants(this.customAssistants)) {
        this.showMessage('智能助手保存失败', 'error')
        hasError = true
      } else {
        this.notifyRibbonRefreshAssistantMenu()
      }
      // 5. 保存当前模型配置（API 密钥、API 地址、enabled、modelSeries）
      if (this.selectedModel) {
        const ok = saveModelConfig(this.selectedModel.id, this.currentModelConfig)
        if (!ok) {
          this.showMessage('模型配置保存失败', 'error')
          hasError = true
        }
        this.notifyRibbonRefreshModelMenu()
      }
      if (hasError) return
      this.isFormSaved = true
      this.showMessage('设置已保存')
      setTimeout(() => {
        if (window.focus) window.focus()
        this.onClose()
      }, 800)
    },
    // 窗口获得焦点
    onWindowFocus() {
      // 窗口重新获得焦点时，确保界面可操作
      // 如果表单已保存，可以选择是否重置状态
      // 这里我们保持保存状态，但确保界面响应
      console.log('窗口获得焦点')
    },
    // 窗口失去焦点
    onWindowBlur() {
      console.log('窗口失去焦点')
    },
    // 关闭
    onClose() {
      try {
        // 如果是通过 window.open 打开的窗口，使用 window.close()
        // 如果是通过 ShowDialog 打开的，也需要关闭
        if (window.opener) {
          // 这是通过 window.open 打开的窗口
          window.close()
        } else if (window.close) {
          // 尝试关闭窗口
          window.close()
        }
      } catch (e) {
        console.warn('关闭窗口失败:', e)
      }
    },
  }
}
</script>

<style scoped>
/* 整体不滚动，仅中间模型清单可滚动 */
.settings-dialog {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', sans-serif;
  font-size: 13px;
  background: #fff;
  overflow: hidden;
}


.dialog-header {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.dialog-header h3 {
  margin: 0;
  font-size: 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
  padding: 0 4px;
  line-height: 1;
}

.btn-close:hover {
  color: #333;
}

.dialog-body {
  flex: 1;
  min-height: 200px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.init-error {
  padding: 24px;
  color: #ff4d4f;
  text-align: center;
}

.init-error .hint {
  margin-top: 8px;
  font-size: 12px;
  color: #999;
}

.settings-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.settings-column {
  border-right: 1px solid #f0f0f0;
}

.column-1 {
  width: 22%;
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 第二列：模型清单，加宽避免拥挤 */
.column-2 {
  width: 32%;
  flex-shrink: 0;
  min-height: 0;
  overflow-y: auto;
}

.column-3 {
  width: 46%;
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 第一列：主菜单，不滚动 */
.column-1 .menu-list {
  padding: 8px 0;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.menu-item:hover {
  background-color: #f5f5f5;
}

.menu-item.active {
  background-color: #e6f7ff;
  border-right: 2px solid #1890ff;
}

.menu-icon {
  margin-right: 8px;
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
}

.menu-icon-asset {
  display: block;
  width: 20px;
  height: 20px;
  object-fit: contain;
  font-size: 0;
}

.menu-label {
  font-size: 14px;
}

/* 第二列：模型列表 */
.category-tabs {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid #f0f0f0;
}

.category-tab {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-left: 2px solid transparent;
}

.category-tab:hover {
  background-color: #f5f5f5;
}

.category-tab.active {
  background-color: #e6f7ff;
  border-left-color: #1890ff;
}

.category-icon {
  margin-right: 8px;
  font-size: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.category-label {
  font-size: 13px;
}

.search-box {
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.search-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
}

.search-input:focus {
  outline: none;
  border-color: #1890ff;
}

/* 模型清单容器：flex 布局，添加按钮固定在底部 */
.model-list-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.model-list-container .search-box {
  flex-shrink: 0;
}

.inventory-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 0;
}

.model-list-container .inventory-row-add {
  flex-shrink: 0;
}

.inventory-row {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  transition: background-color 0.2s;
}

.inventory-row:hover {
  background-color: #f5f5f5;
}

.inventory-row.active {
  background-color: #e6f7ff;
}

.inventory-icon {
  width: 20px;
  height: 20px;
  margin-right: 8px;
  object-fit: contain;
  flex-shrink: 0;
}

.inventory-name {
  flex: 1;
  min-width: 0;
}

.inventory-row-add {
  color: #1890ff;
  border-top: 1px solid #e8e8e8;
  padding: 10px 16px;
  margin-top: 0;
}

.inventory-row-add:hover {
  background-color: #e6f7ff;
}

.inventory-add-icon {
  width: 20px;
  height: 20px;
  margin-right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 300;
  flex-shrink: 0;
}

/* 默认模型：分类行 + 下拉 */
.default-model-rows {
  padding: 8px 0;
}

.default-model-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.default-model-row:last-child {
  border-bottom: none;
}

.default-model-label {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #333;
}

.default-model-label .category-icon {
  margin-right: 8px;
}

.default-model-select-wrap {
  flex-shrink: 0;
  min-width: 180px;
}

.default-model-select {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
  background: #fff;
  cursor: pointer;
}

.default-model-select:focus {
  outline: none;
  border-color: #1890ff;
}

.model-list {
  padding: 8px 0;
}

.model-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.model-item:hover {
  background-color: #f5f5f5;
}

.model-item.active {
  background-color: #e6f7ff;
}

.model-icon {
  width: 20px;
  height: 20px;
  margin-right: 8px;
  object-fit: contain;
}

.model-name {
  flex: 1;
  font-size: 13px;
}

.model-status {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 2px;
}

.model-status.enabled {
  background-color: #52c41a;
  color: #fff;
}

.model-status.selected {
  color: #1890ff;
  font-weight: bold;
}

/* 默认设置：模型设置项列表 */
.default-settings-list-container {
  padding: 8px 0;
}

.assistant-settings-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px 8px;
}

.assistant-settings-toolbar-title {
  margin: 0;
}

.assistant-import-btn {
  flex: 0 0 auto;
  white-space: nowrap;
}

.default-settings-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.default-settings-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.default-settings-item:hover {
  background-color: #f5f5f5;
}

.default-settings-item.active {
  background-color: #e6f7ff;
  border-right: 2px solid #1890ff;
}

.default-settings-item .item-icon {
  margin-right: 8px;
  font-size: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
}

.default-settings-item .item-label {
  font-size: 14px;
}

.assistant-settings-item .item-label {
  flex: 1;
  min-width: 0;
}

.backup-history-empty {
  padding: 20px 16px;
  color: #64748b;
  font-size: 13px;
}

.backup-history-filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 12px 12px;
}

.backup-history-search,
.backup-history-filter-select {
  width: 100%;
}

.backup-history-list {
  padding-top: 0;
}

.backup-history-item {
  align-items: flex-start;
  gap: 10px;
}

.backup-history-item-body {
  flex: 1;
  min-width: 0;
}

.backup-history-item-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  word-break: break-word;
}

.backup-history-item-meta {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: #64748b;
}

.backup-history-header {
  align-items: flex-start;
}

.backup-history-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.backup-history-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.backup-history-field {
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #f8fafc;
}

.backup-history-field-block {
  background: #fff;
}

.backup-history-field-label {
  font-size: 12px;
  color: #64748b;
}

.backup-history-field-value,
.backup-history-path {
  margin-top: 6px;
  font-size: 13px;
  color: #0f172a;
  word-break: break-all;
}

.backup-history-task-summary {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.backup-history-task-line {
  font-size: 13px;
  color: #0f172a;
  word-break: break-word;
}

.backup-history-task-actions {
  margin-top: 10px;
}

.backup-history-diff-list {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.backup-history-diff-line {
  padding: 8px 10px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  font-size: 12px;
  color: #334155;
  line-height: 1.6;
  word-break: break-word;
}

.assistant-icon-image {
  width: 18px;
  height: 18px;
  object-fit: contain;
  display: block;
}

.assistant-icon-image-large {
  width: 20px;
  height: 20px;
}

.assistant-settings-item-draggable {
  cursor: grab;
}

.assistant-settings-list-dragging .assistant-settings-item-draggable:not(.assistant-settings-item-dragging) {
  background: #f8fafc;
}

.assistant-settings-item-dragging {
  opacity: 0.52;
  transform: scale(0.992);
}

.assistant-insert-line {
  height: 3px;
  background: linear-gradient(90deg, #60a5fa 0%, #2563eb 100%);
  margin: 4px 12px;
  border-radius: 999px;
  flex-shrink: 0;
  box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.08), 0 2px 8px rgba(37, 99, 235, 0.22);
}

.assistant-item-actions {
  display: flex;
  align-items: center;
  gap: 0;
  margin-left: 8px;
  padding: 2px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.assistant-order-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #475569;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.assistant-order-btn + .assistant-order-btn {
  margin-left: 2px;
}

.assistant-copy-btn {
  margin-right: 2px;
}

.assistant-order-btn:hover:not(:disabled) {
  background: #eff6ff;
  color: #2563eb;
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.18);
}

.assistant-order-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.assistant-order-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18);
}

.assistant-order-btn:disabled {
  color: #cbd5e1;
  background: transparent;
  cursor: not-allowed;
}

.assistant-order-icon {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
}

.assistant-order-icon-arrow {
  fill: currentColor;
  stroke: none;
}

.assistant-settings-group {
  padding-top: 8px;
}

.assistant-settings-group:first-of-type {
  padding-top: 0;
}

.assistant-icon-picker {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #f8fafc;
}

.assistant-icon-picker-clickable {
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.assistant-icon-picker-clickable:hover {
  border-color: #93c5fd;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.08);
  background: #eff6ff;
}

.assistant-icon-current {
  display: flex;
  align-items: center;
  gap: 12px;
}

.assistant-icon-current-label {
  font-size: 13px;
  color: #64748b;
}

.assistant-icon-current-preview {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  border: 1px solid #dbeafe;
  background: #f8fbff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.assistant-icon-current-image {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.assistant-icon-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.assistant-icon-inline-hint {
  font-size: 12px;
  color: #64748b;
}

.assistant-icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
  gap: 10px;
}

.assistant-icon-empty,
.assistant-icon-picker-empty {
  grid-column: 1 / -1;
  padding: 12px;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  background: #f8fafc;
  color: #94a3b8;
  font-size: 12px;
  text-align: center;
}

.assistant-icon-picker-empty-error {
  color: #b91c1c;
  border-color: rgba(239, 68, 68, 0.2);
  background: rgba(254, 242, 242, 0.9);
}

.assistant-icon-option {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.assistant-icon-option:hover {
  border-color: #93c5fd;
  background: #f8fbff;
}

.assistant-icon-option.active {
  border-color: #2563eb;
  background: #eff6ff;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
}

.assistant-icon-option-image {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.assistant-icon-option-label {
  font-size: 12px;
  color: #334155;
  line-height: 1.3;
  text-align: center;
}

.assistant-icon-picker-modal {
  width: min(980px, 92vw);
}

.assistant-icon-picker-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.assistant-icon-library-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  overflow-x: auto;
  padding-bottom: 4px;
}

.assistant-icon-library-tab {
  border: 1px solid #dbe3ee;
  background: #fff;
  color: #334155;
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.18s ease;
}

.assistant-icon-library-tab:hover {
  border-color: #93c5fd;
  background: #f8fbff;
}

.assistant-icon-library-tab.active {
  color: #1d4ed8;
  border-color: rgba(37, 99, 235, 0.35);
  background: rgba(239, 246, 255, 0.95);
}

.assistant-icon-search-input {
  width: min(260px, 100%);
}

.assistant-icon-library-note {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 6px;
}

.assistant-icon-grid-modal {
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  max-height: 460px;
  overflow-y: auto;
  padding-right: 4px;
  margin-top: 6px;
}

.assistant-icon-picker-more {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

.assistant-settings-group-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
  gap: 12px;
  padding: 8px 16px 6px;
}

.assistant-settings-group-title {
  font-size: 12px;
  color: #888;
  font-weight: 600;
  white-space: nowrap;
  flex: 0 0 auto;
}

.assistant-settings-group-hint {
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
  flex: 1 1 auto;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
}

.default-model-select.full-width {
  width: 100%;
  padding: 8px 12px;
}

/* 默认模型分组下拉 */
.default-model-select-wrap {
  position: relative;
  width: 100%;
}

.default-model-select-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}

.default-model-select-btn:hover {
  border-color: #1890ff;
}

.default-model-select-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  flex-shrink: 0;
}

.default-model-select-placeholder {
  color: #999;
}

.default-model-select-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.default-model-select-arrow {
  font-size: 10px;
  color: #999;
  flex-shrink: 0;
}

.default-model-dropdown {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  margin-top: 4px;
  max-height: 280px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 100;
}

.default-model-dropdown-empty {
  padding: 16px;
  font-size: 12px;
  color: #999;
  line-height: 1.5;
}

.default-model-group {
  padding: 6px 0;
  border-bottom: 1px solid #f0f0f0;
}

.default-model-group:last-child {
  border-bottom: none;
}


.default-model-group-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 12px;
  color: #666;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
}

.default-model-group-label:hover {
  background: #f9f9f9;
}

.default-model-group-arrow {
  font-size: 10px;
  color: #999;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.default-model-group-label.collapsed .default-model-group-arrow {
  transform: rotate(-90deg);
}

.default-model-group-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  flex-shrink: 0;
}

.default-model-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 8px 32px;
  cursor: pointer;
  font-size: 13px;
  color: #333;
}

.default-model-option:hover {
  background: #f5f5f5;
}

.default-model-option.active {
  background: #e6f7ff;
  color: #1890ff;
}

.default-model-option-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  flex-shrink: 0;
}

.default-model-option-clear {
  border-bottom: 1px solid #f0f0f0;
  color: #999;
}

.default-model-option-clear:hover {
  background: #f5f5f5;
  color: #666;
}

/* 第二列：子菜单 */
.submenu-container {
  padding: 8px 0;
}

.submenu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submenu-icon {
  flex-shrink: 0;
  width: 22px;
  text-align: center;
  font-size: 16px;
  line-height: 1;
}

.submenu-item:hover {
  background-color: #f5f5f5;
}

.submenu-item.active {
  background-color: #e6f7ff;
  border-right: 2px solid #1890ff;
}

.submenu-label {
  font-size: 14px;
}

/* 第三列：配置面板 */
/* 第三块：模式参数/配置表单，不随整页滚动，仅内部表单区域可滚动 */
.config-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px;
  transition: opacity 0.3s ease;
}

.config-panel.form-saved {
  opacity: 0.6;
  pointer-events: none;
}

.config-panel.form-saved .config-input,
.config-panel.form-saved .path-input {
  background-color: #f5f5f5;
  color: #999;
  cursor: not-allowed;
}

.config-panel.form-saved .btn-icon,
.config-panel.form-saved .btn-detect,
.config-panel.form-saved .btn-refresh,
.config-panel.form-saved .btn-manage,
.config-panel.form-saved .btn-browse,
.config-panel.form-saved .btn-link,
.config-panel.form-saved .config-hint-link {
  opacity: 0.5;
  cursor: not-allowed;
}

.config-panel.form-saved .switch {
  opacity: 0.5;
  cursor: not-allowed;
}

.config-panel.empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-state {
  text-align: center;
  color: #999;
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.config-header-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.config-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.config-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.config-header-desc {
  margin: 0;
  font-size: 12px;
  color: #888;
  font-weight: 400;
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 22px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch input:disabled + .slider {
  opacity: 0.5;
  cursor: not-allowed;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
  border-radius: 22px;
}

.slider:before {
  position: absolute;
  content: '';
  height: 18px;
  width: 18px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #1890ff;
}

input:checked + .slider:before {
  transform: translateX(22px);
}

.config-panel .column-title,
.config-panel .config-header {
  flex-shrink: 0;
}

.config-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-label {
  font-size: 13px;
  font-weight: 500;
  color: #333;
}

.config-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
  transition: all 0.3s ease;
}

.config-input:focus {
  outline: none;
  border-color: #1890ff;
}

.config-input:disabled {
  background-color: #f5f5f5;
  color: #999;
  cursor: not-allowed;
}

.config-textarea {
  min-height: 96px;
  resize: vertical;
  line-height: 1.6;
  font-family: inherit;
}

.assistant-inline-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.assistant-prefill-notice {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
  padding: 12px 14px;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  background: #eff6ff;
}

.assistant-prefill-notice-title {
  font-size: 13px;
  font-weight: 600;
  color: #1d4ed8;
}

.assistant-prefill-notice-text {
  font-size: 12px;
  line-height: 1.6;
  color: #334155;
}

.assistant-prefill-notice-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #475569;
  word-break: break-word;
}

.assistant-preset-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fafafa;
}

.assistant-preset-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.assistant-preset-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.assistant-preset-search-input {
  width: 160px;
  padding: 6px 10px;
  font-size: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
}

.assistant-preset-search-input:focus {
  outline: none;
  border-color: #1890ff;
}

.assistant-preset-search-input::placeholder {
  color: #9ca3af;
}

.assistant-preset-empty {
  margin: 0;
  padding: 12px;
  font-size: 13px;
  color: #6b7280;
  text-align: center;
}

.assistant-preset-toggle-all {
  flex-shrink: 0;
}

.assistant-preset-group {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
}

.assistant-preset-group-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: none;
  background: #fff;
  cursor: pointer;
  text-align: left;
}

.assistant-preset-group-toggle:hover {
  background: #f8fafc;
}

.assistant-preset-group-arrow {
  color: #64748b;
  transition: transform 0.18s ease;
}

.assistant-preset-group-arrow.collapsed {
  transform: rotate(-90deg);
}

.assistant-preset-group-title {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.assistant-preset-group-count {
  margin-left: auto;
  font-size: 12px;
  color: #6b7280;
}

.assistant-preset-group-desc {
  margin: 0;
  padding: 0 12px 10px;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.6;
}

.assistant-preset-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 12px 12px;
}

.assistant-preset-btn {
  white-space: nowrap;
}

.prompt-preview-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  background: #fafafa;
}

.prompt-preview-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prompt-preview-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.prompt-preview-meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  background: #fff;
}

.prompt-preview-meta-label {
  font-size: 12px;
  color: #888;
}

.prompt-preview-meta-value {
  font-size: 12px;
  color: #333;
  line-height: 1.5;
  word-break: break-word;
}

.prompt-preview-input {
  min-height: 96px;
}

.prompt-preview-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.prompt-preview-title {
  font-size: 12px;
  font-weight: 600;
  color: #666;
}

.prompt-preview-content {
  margin: 0;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 280px;
  overflow: auto;
}

.assistant-location-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.assistant-location-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  background: #fafafa;
  cursor: pointer;
  font-size: 13px;
  color: #333;
}

.assistant-location-option:hover {
  border-color: #91caff;
  background: #f0f7ff;
}

.path-input:disabled {
  background-color: #f5f5f5;
  color: #999;
  cursor: not-allowed;
}

.input-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.input-with-clear {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-clear .config-input {
  padding-right: 28px;
}

.input-clear-icon {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  cursor: pointer;
  border-radius: 50%;
  transition: color 0.2s, background 0.2s;
}

.input-clear-icon svg {
  width: 14px;
  height: 14px;
  display: block;
}

.input-clear-icon:hover {
  color: #666;
  background: #f0f0f0;
}

.btn-icon {
  background: none;
  border: 1px solid #d9d9d9;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
}

.btn-icon:hover:not(:disabled) {
  border-color: #1890ff;
}

.btn-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-detect {
  background: #fff;
  border: 1px solid #d9d9d9;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.3s ease;
}

.btn-detect:hover:not(:disabled) {
  border-color: #1890ff;
  color: #1890ff;
}

.btn-detect:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-detect-icon {
  padding: 6px 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-detect-icon-img {
  width: 16px;
  height: 16px;
  display: block;
  opacity: 0.85;
}

.btn-detect-icon:hover:not(:disabled) .btn-detect-icon-img {
  opacity: 1;
  filter: invert(42%) sepia(93%) saturate(1352%) hue-rotate(197deg) brightness(101%) contrast(101%);
}

.config-hint {
  margin: 0;
  font-size: 12px;
  color: #999;
}

.config-hint-link {
  margin-left: 6px;
  color: #1890ff;
  text-decoration: none;
}

.config-hint-link:hover {
  color: #40a9ff;
  text-decoration: underline;
}

.config-preview {
  margin: 0;
  font-size: 12px;
  color: #666;
  font-family: monospace;
}

.config-desc {
  margin: 0;
  font-size: 13px;
  color: #666;
  line-height: 1.5;
}

.category-summary {
  margin-top: 16px;
  padding: 12px;
  background-color: #f9f9f9;
  border-radius: 4px;
}

.category-summary-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
}

.summary-label {
  color: #666;
}

.summary-value {
  color: #333;
  font-weight: 500;
}

.model-series-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.model-series-list {
  min-height: 120px;
  max-height: 300px;
  padding: 8px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.model-series-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: #f9f9f9;
  border-radius: 4px;
  border: 1px solid #e8e8e8;
}

.series-name {
  font-size: 13px;
  font-weight: 500;
  color: #333;
}

.series-id {
  font-size: 12px;
  color: #999;
  font-family: monospace;
  background-color: #f0f0f0;
  padding: 2px 6px;
  border-radius: 2px;
}

.series-type {
  font-size: 11px;
  color: #666;
  background-color: #e8f4ff;
  padding: 2px 8px;
  border-radius: 3px;
  white-space: nowrap;
}

.no-models {
  min-height: 120px;
  padding: 20px;
  text-align: center;
  color: #999;
  font-size: 13px;
}

.no-models p {
  margin: 8px 0;
}

.model-series-actions {
  display: flex;
  gap: 8px;
}

.btn-refresh,
.btn-manage {
  padding: 6px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  background: #fff;
  transition: all 0.3s ease;
}

.btn-refresh:hover:not(:disabled),
.btn-manage:hover:not(:disabled) {
  border-color: #1890ff;
  color: #1890ff;
}

.btn-refresh:disabled,
.btn-manage:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-refresh {
  background: #1890ff;
  color: #fff;
  border-color: #1890ff;
}

.btn-refresh:hover {
  background: #40a9ff;
  border-color: #40a9ff;
  color: #fff;
}

.btn-manage {
  background: #52c41a;
  color: #fff;
  border-color: #52c41a;
}

.btn-manage:hover {
  background: #73d13d;
  border-color: #73d13d;
  color: #fff;
}

.path-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.path-input {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
}

.path-input:focus {
  outline: none;
  border-color: #1890ff;
}

.path-hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: #999;
}

.btn-link {
  background: none;
  border: none;
  color: #1890ff;
  cursor: pointer;
  font-size: 12px;
  padding: 0;
  text-align: left;
  transition: all 0.3s ease;
}

.btn-link:hover:not(:disabled) {
  color: #40a9ff;
}

.btn-link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  color: #999;
}

.btn-browse {
  flex-shrink: 0;
}

.message {
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  margin: 12px 16px;
}

.message.success {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.message.error {
  background: #fff2f0;
  color: #ff4d4f;
  border: 1px solid #ffccc7;
}

.message.info {
  background: #e6f7ff;
  color: #1890ff;
  border: 1px solid #91d5ff;
}

.dialog-footer {
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

.btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid #d9d9d9;
  background: #fff;
}

.btn:hover {
  border-color: #1890ff;
  color: #1890ff;
}

.btn-primary {
  background: #1890ff;
  border-color: #1890ff;
  color: #fff;
}

.btn-primary:hover {
  background: #40a9ff;
  border-color: #40a9ff;
  color: #fff;
}

.btn-secondary {
  background: #fff;
  color: #333;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f5f5f5;
  color: #999;
}

.btn-danger {
  background: #fff2f0;
  border-color: #ffccc7;
  color: #cf1322;
}

.btn-danger:hover {
  border-color: #ff7875;
  color: #a8071a;
  background: #fff1f0;
}

/* 管理模型弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content.add-model-modal,
.modal-content.manage-modal,
.modal-content.assistant-recommend-modal {
  background: #fff;
  border-radius: 8px;
  min-width: 360px;
  max-width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h4 {
  margin: 0;
  font-size: 16px;
}

.modal-body {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}

.manage-list {
  max-height: 240px;
  overflow-y: auto;
  margin-bottom: 12px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
}

.manage-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  gap: 8px;
}

.manage-item:last-child {
  border-bottom: none;
}

.manage-item-name {
  flex: 1;
  font-size: 13px;
}

.manage-item-id {
  font-size: 12px;
  color: #999;
  font-family: monospace;
}

.manage-item-type {
  font-size: 11px;
  color: #666;
  background-color: #e8f4ff;
  padding: 2px 8px;
  border-radius: 3px;
  white-space: nowrap;
}

.btn-remove {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 2px 6px;
  font-size: 14px;
}

.btn-remove:hover {
  color: #ff4d4f;
}

.manage-add {
  display: flex;
  gap: 8px;
  align-items: center;
}

.manage-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
}

.modal-content.assistant-recommend-modal {
  width: 720px;
}

.assistant-recommend-card {
  padding: 14px 16px;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  background: linear-gradient(180deg, #f8fbff 0%, #f3f8ff 100%);
}

.assistant-recommend-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.assistant-recommend-btn {
  flex-shrink: 0;
  min-width: 96px;
}

.assistant-recommend-hint {
  margin-top: 4px;
}

.assistant-recommend-inline-textarea {
  min-height: 96px;
  margin-bottom: 10px;
  background: rgba(255, 255, 255, 0.92);
}

.assistant-recommend-textarea {
  min-height: 180px;
}

.assistant-recommend-model-note {
  margin-top: 4px;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
}

.assistant-recommend-model-title {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.assistant-recommend-model-value {
  font-size: 13px;
  color: #0f172a;
  font-weight: 600;
}

.assistant-recommend-tips {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.assistant-recommend-tip {
  padding: 10px 12px;
  border-radius: 8px;
  background: #f8fafc;
  color: #475569;
  font-size: 12px;
  line-height: 1.6;
  border: 1px solid #e2e8f0;
}

/* 添加模型弹窗 */
.add-model-icon-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.add-model-icon-preview {
  width: 64px;
  height: 64px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #fafafa;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.add-model-icon-preview:hover {
  border-color: #1890ff;
  background: #f0f8ff;
}

.icon-file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  overflow: hidden;
}

.btn-clear-icon {
  margin-top: 8px;
  padding: 4px 12px;
  font-size: 12px;
  color: #666;
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  cursor: pointer;
}

.btn-clear-icon:hover {
  color: #1890ff;
  border-color: #1890ff;
}

.add-model-icon {
  width: 40px;
  height: 40px;
  object-fit: contain;
}

.add-model-icon-placeholder {
  font-size: 12px;
  color: #999;
}

/* 右键菜单 */
.context-menu {
  position: fixed;
  z-index: 2000;
  min-width: 100px;
  padding: 4px 0;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.context-menu-item {
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  color: #333;
}

.context-menu-item:hover {
  background: #f5f5f5;
}

.context-menu-item-disabled,
.context-menu-item-disabled:hover,
.context-menu-item-danger.context-menu-item-disabled:hover {
  color: #bfbfbf;
  background: transparent;
  cursor: not-allowed;
}

.context-menu-item-danger:hover {
  background: #fff2f0;
  color: #ff4d4f;
}

/* 模型清单拖动 */
.inventory-drag-handle {
  margin-right: 4px;
  padding: 0 4px;
  color: #999;
  font-size: 12px;
  cursor: grab;
  user-select: none;
}

.inventory-drag-handle:active {
  cursor: grabbing;
}

.inventory-row-draggable {
  cursor: default;
}

.inventory-row-dragging {
  opacity: 0.6;
}

.inventory-row-wrap {
  display: contents;
}

.inventory-row-dragging {
  opacity: 0.5;
}

.inventory-insert-line {
  height: 2px;
  background: #1890ff;
  margin: 0 8px;
  border-radius: 1px;
  flex-shrink: 0;
  box-shadow: 0 0 4px rgba(24, 144, 255, 0.5);
}
</style>
