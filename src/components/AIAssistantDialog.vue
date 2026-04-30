<template>
  <div class="ai-assistant-dialog">
    <!-- 左侧边栏：会话 / 助手 -->
    <aside
      class="sidebar"
      :class="{ collapsed: sidebarCollapsed, resizing: isResizingSidebar }"
      :style="sidebarStyle"
    >
      <div class="sidebar-tabbar">
        <div
          class="sidebar-tab"
          :class="{ active: activeSidebarTab === 'chats' }"
          @click="activeSidebarTab = 'chats'"
        >
          <span>对话</span>
          <span class="sidebar-tab-badge">{{ chatHistory.length }}</span>
        </div>
        <div
          class="sidebar-tab"
          :class="{ active: activeSidebarTab === 'assistants' }"
          @click="activeSidebarTab = 'assistants'"
        >
          <span>助手</span>
          <span class="sidebar-tab-badge">{{ assistantVisibleCount }}</span>
        </div>
      </div>

      <div v-if="activeSidebarTab === 'chats'" class="sidebar-pane">
        <div class="tab-toolbar chat-toolbar">
          <div class="assistant-search chat-search">
            <svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5A6.5 6.5 0 1 0 9.5 16a6.47 6.47 0 0 0 4.23-1.57l.27.28v.79L20 21.5L21.5 20zM9.5 14A4.5 4.5 0 1 1 14 9.5A4.5 4.5 0 0 1 9.5 14"/></svg>
            <input v-model.trim="chatSearchText" type="text" placeholder="搜索对话" />
          </div>
          <button type="button" class="toolbar-action-btn" @click="newChat" title="新建对话">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 11H13V5h-2v6H5v2h6v6h2v-6h6z"/></svg>
            <span>新建</span>
          </button>
        </div>
        <div class="history-list">
          <div
            v-for="(chat, idx) in filteredChatHistory"
            :key="chat.id"
            class="history-item"
            :class="{ active: currentChatId === chat.id }"
            @click="switchChat(chat.id)"
          >
            <span class="history-title">{{ chat.title || `对话 ${idx + 1}` }}</span>
            <button
              type="button"
              class="icon-action-btn danger"
              title="删除会话"
              @click.stop="deleteChat(chat.id)"
            >
              <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 7h12v2H6zm2 3h8l-.7 9H8.7zm3-6h2l1 1h4v2H6V5h4z"/></svg>
            </button>
          </div>
          <div v-if="filteredChatHistory.length === 0" class="history-empty">暂无对话</div>
        </div>
      </div>
      <div v-else class="sidebar-pane">
        <div class="tab-toolbar assistant-toolbar">
          <button
            type="button"
            class="toolbar-icon-btn"
            @click="openAssistantSettings('create-custom-assistant')"
            title="添加助手"
          >
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 11H13V5h-2v6H5v2h6v6h2v-6h6z"/></svg>
          </button>
          <div class="assistant-search">
            <svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5A6.5 6.5 0 1 0 9.5 16a6.47 6.47 0 0 0 4.23-1.57l.27.28v.79L20 21.5L21.5 20zM9.5 14A4.5 4.5 0 1 1 14 9.5A4.5 4.5 0 0 1 9.5 14"/></svg>
            <input v-model.trim="assistantSearchText" type="text" placeholder="搜索助手" />
          </div>
        </div>
        <div ref="assistantListRef" class="assistant-list">
          <div
            v-for="group in assistantGroups"
            :key="group.key"
            class="assistant-group"
          >
            <div
              class="assistant-group-title"
              :class="{ collapsed: isAssistantGroupCollapsed(group.key) }"
              @click="toggleAssistantGroup(group.key)"
            >
              <span class="assistant-group-arrow">▾</span>
              <span class="assistant-group-label">{{ group.label }}</span>
              <span class="assistant-group-count">{{ group.items.length }}</span>
            </div>
            <div v-show="!isAssistantGroupCollapsed(group.key)" class="assistant-group-items">
              <div
                v-for="item in group.items"
                :key="item.key"
                class="assistant-item"
                :class="{ 'assistant-item--highlighted': assistantHighlightedKey === item.key }"
                :data-assistant-key="item.key"
              >
                <div class="assistant-item-header">
                  <div class="assistant-item-main">
                    <div class="assistant-item-icon">
                      <img
                        v-if="isImageIcon(item.icon)"
                        :src="resolveIconUrl(item.icon)"
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                      <span v-else>{{ item.icon || '🧠' }}</span>
                    </div>
                    <div class="assistant-item-text">
                      <div class="assistant-item-name-row">
                        <div class="assistant-item-name">{{ item.shortLabel || item.label }}</div>
                        <span class="assistant-item-kind">{{ isCustomAssistant(item) ? '自定义' : '内置' }}</span>
                      </div>
                      <div v-if="item.description" class="assistant-item-desc">{{ item.description }}</div>
                      <div v-if="isCustomAssistant(item) && getAssistantListCreatedAt(item)" class="assistant-item-meta">
                        创建时间：{{ getAssistantListCreatedAt(item) }}
                      </div>
                    </div>
                  </div>
                  <div class="assistant-item-actions">
                    <button
                      type="button"
                      class="icon-action-btn primary"
                      :disabled="assistantRunLoadingKey === item.key"
                      @click="runAssistant(item)"
                      :title="assistantRunLoadingKey === item.key ? '执行中' : '执行助手'"
                    >
                      <svg v-if="assistantRunLoadingKey !== item.key" viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
                      <svg v-else viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 6h5v12H6zm7 0h5v12h-5z"/></svg>
                    </button>
                    <button
                      type="button"
                      class="icon-action-btn"
                      title="编辑助手"
                      @click="openAssistantSettings(item.key)"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zm14.71-9.04a1.003 1.003 0 0 0 0-1.42l-2.5-2.5a1.003 1.003 0 0 0-1.42 0L11.92 6.16l3.75 3.75z"/></svg>
                    </button>
                    <button
                      v-if="isCustomAssistant(item)"
                      type="button"
                      class="icon-action-btn danger"
                      title="删除助手"
                      @click="deleteCustomAssistant(item)"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 7h12v2H6zm2 3h8l-.7 9H8.7zm3-6h2l1 1h4v2H6V5h4z"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="assistantGroups.length === 0" class="assistant-empty">暂无可用助手</div>
        </div>
      </div>
      <div class="sidebar-footer">
        <button
          type="button"
          class="sidebar-settings-btn"
          title="设置"
          @click="openSettingsDialog"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.41 1.05.73 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64zm-7.14 2.56A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>
        </button>
        <div class="sidebar-footer-content">
          <div class="sidebar-footer-brand">
            <div class="sidebar-footer-brand-name">北京智灵鸟科技中心</div>
            <a
              href="https://aidooo.com"
              target="_blank"
              rel="noreferrer"
              class="sidebar-footer-brand-link"
              @click.prevent="openExternalWebsite('https://aidooo.com')"
            >aidooo.com</a>
          </div>
          <div class="sidebar-footer-actions">
            <button type="button" class="sidebar-footer-text-btn" @click="openSidebarFooterSupportDialog('follow')">关注我们</button>
            <button type="button" class="sidebar-footer-text-btn" @click="openSidebarFooterSupportDialog('support')">支持我们</button>
          </div>
        </div>
      </div>
    </aside>

    <div
      class="layout-divider"
      :class="{ collapsed: sidebarCollapsed, dragging: isResizingSidebar }"
      @mousedown="startSidebarResize"
    >
      <button
        type="button"
        class="layout-divider-toggle"
        :title="sidebarCollapsed ? '展开左栏' : '折叠左栏'"
        @mousedown.stop
        @click.stop="toggleSidebar"
      >
        <svg v-if="sidebarCollapsed" viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M10 17l5-5-5-5v10z"/></svg>
        <svg v-else viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M14 7l-5 5 5 5V7z"/></svg>
      </button>
    </div>

    <div
      v-if="sidebarFooterSupportDialogVisible"
      class="assistant-recommend-modal-overlay"
      @click.self="closeSidebarFooterSupportDialog"
    >
      <div class="sidebar-footer-support-modal">
        <div class="modal-header">
          <h4>{{ sidebarFooterSupportDialogTitle }}</h4>
          <button type="button" class="btn-close-modal" @click="closeSidebarFooterSupportDialog">×</button>
        </div>
        <div class="modal-body sidebar-footer-support-modal-body">
          <div v-if="sidebarFooterSupportDialogMode === 'follow'">
            <div v-if="showFollowDonationQrCode" class="sidebar-footer-support-cards sidebar-footer-support-cards--single">
              <div class="welcome-support-card">
                <div class="welcome-support-qr-wrap">
                  <img
                    :src="followDonationQrCode()"
                    alt="关注我们的微信公众号"
                    class="welcome-support-qr"
                    loading="lazy"
                    decoding="async"
                    @error="handleDonationQrCodeError('follow')"
                  />
                </div>
                <span class="welcome-support-label">关注我们的微信公众号</span>
              </div>
            </div>
            <p v-else class="welcome-support-hint">公众号二维码暂不可用，请访问 aidooo.com 了解关注我们。</p>
          </div>
          <div v-else>
            <div v-if="showWechatDonationQrCode || showAlipayDonationQrCode" class="sidebar-footer-support-cards">
              <div v-if="showWechatDonationQrCode" class="welcome-support-card">
                <div class="welcome-support-qr-wrap">
                  <img
                    :src="wechatDonationQrCode()"
                    alt="微信支持"
                    class="welcome-support-qr"
                    loading="lazy"
                    decoding="async"
                    @error="handleDonationQrCodeError('wechat')"
                  />
                   
                </div>
                <span class="welcome-support-label">微信支持</span>
              </div>
              <div v-if="showAlipayDonationQrCode" class="welcome-support-card">
                <div class="welcome-support-qr-wrap">
                  <img
                    :src="alipayDonationQrCode()"
                    alt="支付宝支持"
                    class="welcome-support-qr"
                    loading="lazy"
                    decoding="async"
                    @error="handleDonationQrCodeError('alipay')"
                  />
              
                </div>
                <span class="welcome-support-label">支付宝支持</span>
              </div>
            </div>
            <p v-else class="welcome-support-hint">赞赏入口暂不可用，感谢支持；详情见 aidooo.com。</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧主区域 -->
    <main class="main-area">
      <!-- 消息区域 -->
      <div class="messages-container" ref="messagesRef">
        <div
          v-if="displayedWelcomePrompt"
          class="welcome-inline-banner"
          :class="{ 'welcome-inline-banner--setup': !hasConfiguredChatModels }"
        >
          <span class="welcome-inline-label">{{ hasConfiguredChatModels ? '察元 AI' : '模型配置' }}</span>
          <span class="welcome-inline-text">
            {{ $cdt(displayedWelcomePrompt) }}
            <span v-if="isWelcomePromptTyping" class="welcome-cursor">▊</span>
          </span>
        </div>
        <div
          v-if="assistantEvolutionSuggestion"
          class="assistant-evolution-banner"
          :class="{ 'is-applying': assistantEvolutionSuggestion.status === 'applying' }"
        >
          <div class="assistant-evolution-banner-main">
            <div class="assistant-evolution-banner-head">
              <div class="assistant-evolution-badge">进化建议</div>
              <div class="assistant-evolution-banner-title">发现一组能力高度接近的助手</div>
            </div>
            <div class="assistant-evolution-banner-desc">
              {{ $cdt(assistantEvolutionSuggestion.message) }}
            </div>
            <div
              v-if="assistantEvolutionSuggestion.status !== 'completed'"
              class="assistant-evolution-banner-actions"
            >
              <button
                type="button"
                class="assistant-evolution-action secondary"
                :disabled="assistantEvolutionSuggestion.status === 'applying'"
                @click.stop="dismissAssistantEvolutionSuggestion()"
              >
                暂不处理
              </button>
              <button
                type="button"
                class="assistant-evolution-action primary"
                :disabled="assistantEvolutionSuggestion.status === 'applying'"
                @click.stop="confirmAssistantEvolutionSuggestion()"
              >
                {{
                  assistantEvolutionSuggestion.status === 'applying'
                    ? '进化中...'
                    : assistantEvolutionSuggestion.status === 'review'
                      ? '确认发布进化版'
                      : '立即进化'
                }}
              </button>
            </div>
            <div v-else class="assistant-evolution-banner-actions">
              <button
                type="button"
                class="assistant-evolution-action primary"
                @click.stop="dismissAssistantEvolutionSuggestion()"
              >
                我知道了
              </button>
            </div>
            <div
              v-if="Array.isArray(assistantEvolutionSuggestion.reasonDetails) && assistantEvolutionSuggestion.reasonDetails.length"
              class="assistant-evolution-reason-list"
            >
              <div
                v-for="(detail, index) in assistantEvolutionSuggestion.reasonDetails"
                :key="`evolution-reason-${index}`"
                class="assistant-evolution-reason-item"
              >
                {{ $cdt(detail) }}
              </div>
            </div>
            <div
              v-if="Array.isArray(assistantEvolutionSuggestion.previewResults) && assistantEvolutionSuggestion.previewResults.length"
              class="assistant-evolution-preview-list"
            >
              <div
                v-for="(sample, index) in assistantEvolutionSuggestion.previewResults"
                :key="`evolution-preview-${index}`"
                class="assistant-evolution-preview-item"
              >
                <div class="assistant-evolution-preview-title">{{ $cdt(sample.label) }}</div>
                <div class="assistant-evolution-preview-text">旧版：{{ $cdt(sample.baselineOutput) }}</div>
                <div class="assistant-evolution-preview-text">新版：{{ $cdt(sample.candidateOutput) }}</div>
              </div>
            </div>
            <div
              v-if="assistantEvolutionSuggestion.status === 'applying' || assistantEvolutionSuggestion.status === 'completed'"
              class="assistant-evolution-progress"
            >
              <div class="assistant-evolution-progress-track">
                <div
                  class="assistant-evolution-progress-fill"
                  :style="{ width: `${Math.max(0, Math.min(100, Number(assistantEvolutionSuggestion.progress || 0)))}%` }"
                ></div>
              </div>
              <div class="assistant-evolution-progress-text">
                {{ $cdt(assistantEvolutionSuggestion.progressLabel || (assistantEvolutionSuggestion.status === 'completed' ? '已完成 100%' : '正在进化...')) }}
              </div>
            </div>
            <div class="assistant-evolution-banner-list">
              <span
                v-for="item in assistantEvolutionSuggestion.assistants"
                :key="item.id"
                class="assistant-evolution-chip"
              >
                {{ $cdt(item.name) }}
              </span>
              <span
                v-if="assistantEvolutionSuggestion.assistants.length > 1"
                class="assistant-evolution-arrow"
              >
                可以进化为一个
              </span>
            </div>
          </div>
        </div>
        <div
          v-if="welcomeExitGhost.visible"
          class="welcome-support-ghost"
          :class="[`welcome-exit-${welcomeExitGhost.variant}`]"
          :style="welcomeExitGhost.style"
          @animationend.self="finishWelcomeSupportExitAnimation"
        >
          <span class="welcome-ghost-trail" aria-hidden="true"></span>
          <span class="welcome-ghost-particle welcome-ghost-particle--1" aria-hidden="true"></span>
          <span class="welcome-ghost-particle welcome-ghost-particle--2" aria-hidden="true"></span>
          <span class="welcome-ghost-particle welcome-ghost-particle--3" aria-hidden="true"></span>
          <span class="welcome-ghost-particle welcome-ghost-particle--4" aria-hidden="true"></span>
          <span class="welcome-ghost-particle welcome-ghost-particle--5" aria-hidden="true"></span>
          <div class="welcome-support-ghost-body" v-html="welcomeExitGhost.html"></div>
        </div>
        <template v-if="currentMessages.length === 0">
          <div class="welcome">
            <p class="welcome-title">{{ welcomeTitle }}</p>
            <p class="welcome-subtitle">{{ welcomeSubtitle }}</p>
            <button
              v-if="!hasConfiguredChatModels"
              type="button"
              class="welcome-action-btn"
              @click="openModelSettings"
            >
              立即配置模型
            </button>
            <div
              :key="`welcome-support-${welcomeEntryAnimation}-${welcomeEntryCycle}`"
              ref="welcomeSupportRef"
              class="welcome-support"
              :class="[`welcome-entry-${welcomeEntryAnimation}`]"
            >
              <p class="welcome-support-text">欢迎关注我们的微信公众号，便于提需求，帮助我持续进化成你想要的样子。</p>
              <div v-if="hasDonationQrCode" class="welcome-support-codes">
                <div v-if="showFollowDonationQrCode" class="welcome-support-card">
                  <div class="welcome-support-qr-wrap">
                    <img
                      :src="followDonationQrCode()"
                      alt="关注我们的微信公众号"
                      class="welcome-support-qr"
                      loading="lazy"
                      decoding="async"
                      @error="handleDonationQrCodeError('follow')"
                    />
                  </div>
                  <span class="welcome-support-label">关注我们的微信公众号</span>
                </div>
                <div v-if="showWechatDonationQrCode" class="welcome-support-card">
                  <div class="welcome-support-qr-wrap">
                    <img
                      :src="wechatDonationQrCode()"
                      alt="微信支持"
                      class="welcome-support-qr"
                      loading="lazy"
                      decoding="async"
                      @error="handleDonationQrCodeError('wechat')"
                    />
                    
                  </div>
                  <span class="welcome-support-label">微信支持</span>
                </div>
                <div v-if="showAlipayDonationQrCode" class="welcome-support-card">
                  <div class="welcome-support-qr-wrap">
                    <img
                      :src="alipayDonationQrCode()"
                      alt="支付宝支持"
                      class="welcome-support-qr"
                      loading="lazy"
                      decoding="async"
                      @error="handleDonationQrCodeError('alipay')"
                    />
                   
                  </div>
                  <span class="welcome-support-label">支付宝支持</span>
                </div>
              </div>
              <p v-else class="welcome-support-hint">
                欢迎关注微信公众号「智灵鸟科技」并访问 <a href="https://aidooo.com" target="_blank" rel="noreferrer" class="welcome-support-link" @click.prevent="openExternalWebsite('https://aidooo.com')">aidooo.com</a>；关注与支持二维码在可用时将显示在上方。
              </p>
              <p class="welcome-support-copyright">
                版权所有 北京智灵鸟科技中心
                <a
                  href="https://aidooo.com"
                  target="_blank"
                  rel="noreferrer"
                  class="welcome-support-link"
                  @click.prevent="openExternalWebsite('https://aidooo.com')"
                >aidooo.com</a>
              </p>
              <span class="welcome-support-floor" aria-hidden="true"></span>
            </div>
          </div>
        </template>
        <template v-else>
          <div
            v-for="(msg, i) in currentMessages"
            :key="msg.id"
            class="message-row"
            :class="[msg.role, getMessageEntryEffectClass(msg)]"
          >
            <div class="message-avatar">
              <span v-if="msg.role === 'user'">👤</span>
              <span
                v-else
                class="assistant-bird-avatar"
                :class="{
                  'is-animated': isAssistantMessagePending(msg, i),
                  'is-static': !isAssistantMessagePending(msg, i)
                }"
                aria-hidden="true"
              >
                <img
                  v-if="!isAssistantMessagePending(msg, i)"
                  :src="aiDialogAssetsInline.logo"
                  alt=""
                  class="assistant-logo-static"
                  width="36"
                  height="36"
                  decoding="async"
                />
                <span v-else class="assistant-logo-fold" aria-hidden="true">
                  <span
                    class="assistant-logo-fold-half assistant-logo-fold-half--left"
                    :style="{ backgroundImage: `url(${aiDialogAssetsInline.logo})` }"
                  ></span>
                  <span
                    class="assistant-logo-fold-half assistant-logo-fold-half--right"
                    :style="{ backgroundImage: `url(${aiDialogAssetsInline.logo})` }"
                  ></span>
                  <span class="assistant-logo-fold-axis"></span>
                </span>
              </span>
            </div>
            <div class="message-content">
              <div
                class="message-text"
                :class="{
                  'streaming-text': isStreaming && msg.role === 'assistant' && i === currentMessages.length - 1,
                  'message-text-waiting': isAssistantMessagePending(msg, i) && !String(msg.content || '').trim(),
                  'has-user-context-meta': msg.role === 'user' && !!getUserMessageContextLabel(msg),
                  'message-text-error': msg.role === 'assistant' && isAssistantErrorMessage(msg)
                }"
              >
                <template v-if="isAssistantMessagePending(msg, i) && !String(msg.content || '').trim()">
                  <div class="message-waiting-state">
                    <div class="message-waiting-head">
                      <span class="message-waiting-title">{{ getAssistantLoadingLabel(msg) }}</span>
                      <span class="message-waiting-percent">{{ getAssistantLoadingPercent(msg) }}%</span>
                    </div>
                    <div class="message-waiting-detail">{{ getAssistantLoadingDetail(msg) }}</div>
                    <div class="message-waiting-progress" aria-hidden="true">
                      <span
                        class="message-waiting-progress-bar"
                        :style="{ width: `${getAssistantLoadingPercent(msg)}%` }"
                      ></span>
                    </div>
                    <LongTaskRunCard
                      v-for="taskRun in getMessageLongTaskRunEntries(msg, { onlyRunning: true })"
                      :key="`${msg.id}-${taskRun.key}-inline`"
                      :run="taskRun.run"
                      mode="inline"
                      @apply="handleLongTaskRunApply(taskRun.stopAction, msg)"
                      @stop="handleLongTaskRunStop(taskRun.stopAction, msg)"
                      @undo="handleLongTaskRunUndo(taskRun.stopAction, msg)"
                      @open-task-detail="handleLongTaskRunOpenDetail(taskRun.stopAction, msg)"
                      @toggle-details="toggleDocumentRevisionDetails(taskRun.run)"
                      @toggle-backup="handleLongTaskRunToggleBackup(taskRun.stopAction, msg, $event)"
                    />
                  </div>
                </template>
                <template v-else>
                  <span v-html="formatMessage(msg.content)"></span>
                  <span v-if="isStreaming && msg.role === 'assistant' && i === currentMessages.length - 1 && String(msg.content || '').trim()" class="cursor">▊</span>
                  <div v-if="msg.role === 'assistant' && isAssistantErrorMessage(msg)" class="message-error-actions">
                    <button
                      type="button"
                      class="message-error-action-btn primary"
                      :disabled="isStreaming"
                      @click.stop="handleAssistantErrorPrimaryAction(msg)"
                    >
                      {{ getAssistantErrorPrimaryActionLabel(msg) }}
                    </button>
                    <button
                      type="button"
                      class="message-error-action-btn"
                      :disabled="isStreaming && shouldRetryAssistantError(msg)"
                      @click.stop="handleAssistantErrorSecondaryAction(msg)"
                    >
                      {{ getAssistantErrorSecondaryActionLabel(msg) }}
                    </button>
                  </div>
                </template>
                <div v-if="shouldShowAssistantFooter(msg)" class="message-footer">
                  <div
                    v-if="msg.role === 'assistant' && getMessagePrimaryRouteLabel(msg)"
                    class="message-route-hint"
                    :title="getMessagePrimaryRouteDetail(msg)"
                  >
                    已识别为：{{ getMessagePrimaryRouteLabel(msg) }}
                  </div>
                  <div v-if="!isAssistantErrorMessage(msg) && msg.recommendations && msg.recommendations.length" class="message-recommend-inline">
                    <span class="message-recommend-inline-prefix">通过感知，你需要</span>
                    <span class="message-recommend-inline-list">
                      <template v-for="(rec, recIdx) in msg.recommendations" :key="`${msg.id}-${rec.key}`">
                        <span v-if="recIdx > 0" class="message-recommend-inline-separator">、</span>
                        <span class="message-recommend-inline-quote">“</span>
                        <button
                          type="button"
                          class="message-recommend-tag-link"
                          :title="getRecommendationTooltip(rec)"
                          @click="openAssistantRecommendPanel({ items: [rec], sourceText: rec.shortLabel || rec.label, forceFallback: false })"
                        >
                          {{ getRecommendationDisplayName(rec) }}
                        </button>
                        <span class="message-recommend-inline-quote">”</span>
                      </template>
                    </span>
                  </div>
                  <div v-if="!isAssistantErrorMessage(msg) && msg.missingSkillNotice" class="message-skill-empty-card">
                    <div class="message-skill-empty-brand">
                      <img
                        :src="aiDialogAssetsInline.logo"
                        alt="aidooo"
                        class="message-skill-empty-brand-logo"
                        width="40"
                        height="40"
                        decoding="async"
                      />
                      <div class="message-skill-empty-brand-text">
                        <span class="message-skill-empty-brand-name">aidooo</span>
                        <span class="message-skill-empty-brand-subtitle">技能招募中</span>
                      </div>
                    </div>
                    <div class="message-skill-empty-title">暂无匹配的专项助手</div>
                    <div class="message-skill-empty-text">
                      {{ $cdt(msg.missingSkillNoticeDisplayText || msg.missingSkillNoticeText || defaultMissingSkillNoticeText) }}
                      <span v-if="msg.missingSkillNoticeTyping" class="cursor">▊</span>
                    </div>
                    <div class="message-skill-empty-links">
                      <a href="https://aidooo.com" target="_blank" rel="noreferrer" @click.prevent="openExternalWebsite('https://aidooo.com')">aidooo.com</a>
                      <span>微信公众号：智灵鸟科技</span>
                    </div>
                    <div class="message-skill-empty-actions">
                      <a
                        href="https://aidooo.com"
                        target="_blank"
                        rel="noreferrer"
                        class="message-skill-empty-btn"
                        @click.prevent="openExternalWebsite('https://aidooo.com')"
                      >
                        前往官网提技能需求
                      </a>
                    </div>
                    <div v-if="showFollowDonationQrCode" class="message-skill-empty-qr">
                      <div class="welcome-support-qr-wrap">
                        <img
                          :src="followDonationQrCode()"
                          alt="智灵鸟科技公众号二维码"
                          class="welcome-support-qr"
                          loading="lazy"
                          decoding="async"
                          @error="handleDonationQrCodeError('follow')"
                        />
                      </div>
                      <span class="message-skill-empty-qr-label">关注我们的微信公众号</span>
                    </div>
                  </div>
                  <div v-if="msg.pendingDocumentFormatAction" class="message-confirm-card" :class="`is-${msg.pendingDocumentFormatAction.status || 'pending'}`">
                    <div class="message-confirm-summary">
                      将执行：{{ $cdt((msg.pendingDocumentFormatAction.changeSummary || []).join('、')) }}
                    </div>
                    <div v-if="getDocumentFormatActionTags(msg.pendingDocumentFormatAction).length" class="message-confirm-tags">
                      <span
                        v-for="tag in getDocumentFormatActionTags(msg.pendingDocumentFormatAction)"
                        :key="`${msg.id}-${tag.key}`"
                        class="message-confirm-tag"
                      >
                        {{ $cdt(tag.label) }}
                      </span>
                    </div>
                    <div v-if="msg.pendingDocumentFormatAction.canApply" class="message-confirm-prompt">
                      {{ $cdt(msg.pendingDocumentFormatAction.confirmPrompt) }}
                    </div>
                    <div v-if="msg.pendingDocumentFormatAction.canApply && msg.pendingDocumentFormatAction.status !== 'applied'" class="message-confirm-secondary-actions">
                      <button
                        type="button"
                        class="message-confirm-btn subtle"
                        :disabled="msg.pendingDocumentFormatAction.status === 'applying'"
                        @click.stop="rerunPendingDocumentFormatPreview(msg)"
                      >
                        重新预览
                      </button>
                      <button
                        type="button"
                        class="message-confirm-btn subtle"
                        :disabled="msg.pendingDocumentFormatAction.status === 'applying'"
                        @click.stop="clearPendingDocumentFormatPreview(msg)"
                      >
                        清除预览
                      </button>
                    </div>
                    <div v-if="msg.pendingDocumentFormatAction.canApply && msg.pendingDocumentFormatAction.status !== 'applied'" class="message-confirm-actions">
                      <button
                        type="button"
                        class="message-confirm-btn primary"
                        :disabled="msg.pendingDocumentFormatAction.status === 'applying'"
                        @click.stop="confirmPendingDocumentFormatAction(msg)"
                      >
                        {{ msg.pendingDocumentFormatAction.status === 'applying' ? '执行中...' : '确定' }}
                      </button>
                      <button
                        type="button"
                        class="message-confirm-btn"
                        :disabled="msg.pendingDocumentFormatAction.status === 'applying'"
                        @click.stop="cancelPendingDocumentFormatAction(msg)"
                      >
                        取消
                      </button>
                    </div>
                    <div v-if="msg.pendingDocumentFormatAction.statusMessage" class="message-confirm-status">
                      {{ $cdt(msg.pendingDocumentFormatAction.statusMessage) }}
                    </div>
                  </div>
                  <div v-if="msg.pendingDocumentRelocationAction" class="message-confirm-card" :class="`is-${msg.pendingDocumentRelocationAction.status || 'pending'}`">
                    <div class="message-confirm-summary">
                      将执行：{{ $cdt((msg.pendingDocumentRelocationAction.changeSummary || []).join('、')) }}
                    </div>
                    <div v-if="getDocumentRelocationActionTags(msg.pendingDocumentRelocationAction).length" class="message-confirm-tags">
                      <span
                        v-for="tag in getDocumentRelocationActionTags(msg.pendingDocumentRelocationAction)"
                        :key="`${msg.id}-${tag.key}`"
                        class="message-confirm-tag"
                      >
                        {{ $cdt(tag.label) }}
                      </span>
                    </div>
                    <div v-if="msg.pendingDocumentRelocationAction.canApply" class="message-confirm-prompt">
                      {{ $cdt(msg.pendingDocumentRelocationAction.confirmPrompt) }}
                    </div>
                    <div v-if="msg.pendingDocumentRelocationAction.canApply && msg.pendingDocumentRelocationAction.status !== 'applied'" class="message-confirm-actions">
                      <button
                        type="button"
                        class="message-confirm-btn primary"
                        :disabled="msg.pendingDocumentRelocationAction.status === 'applying'"
                        @click.stop="confirmPendingDocumentRelocationAction(msg)"
                      >
                        {{ msg.pendingDocumentRelocationAction.status === 'applying' ? '执行中...' : '确定' }}
                      </button>
                      <button
                        type="button"
                        class="message-confirm-btn"
                        :disabled="msg.pendingDocumentRelocationAction.status === 'applying'"
                        @click.stop="cancelPendingDocumentRelocationAction(msg)"
                      >
                        取消
                      </button>
                    </div>
                    <div v-if="msg.pendingDocumentRelocationAction.statusMessage" class="message-confirm-status">
                      {{ $cdt(msg.pendingDocumentRelocationAction.statusMessage) }}
                    </div>
                  </div>
                  <div v-if="msg.pendingDocumentTextEditAction" class="message-confirm-card" :class="`is-${msg.pendingDocumentTextEditAction.status || 'pending'}`">
                    <div class="message-confirm-summary">
                      将执行：{{ $cdt((msg.pendingDocumentTextEditAction.changeSummary || []).join('、')) }}
                    </div>
                    <div v-if="getDocumentTextEditActionTags(msg.pendingDocumentTextEditAction).length" class="message-confirm-tags">
                      <span
                        v-for="tag in getDocumentTextEditActionTags(msg.pendingDocumentTextEditAction)"
                        :key="`${msg.id}-${tag.key}`"
                        class="message-confirm-tag"
                      >
                        {{ $cdt(tag.label) }}
                      </span>
                    </div>
                    <div v-if="msg.pendingDocumentTextEditAction.canApply" class="message-confirm-prompt">
                      {{ $cdt(msg.pendingDocumentTextEditAction.confirmPrompt) }}
                    </div>
                    <div v-if="msg.pendingDocumentTextEditAction.canApply && msg.pendingDocumentTextEditAction.status !== 'applied'" class="message-confirm-actions">
                      <button
                        type="button"
                        class="message-confirm-btn primary"
                        :disabled="msg.pendingDocumentTextEditAction.status === 'applying'"
                        @click.stop="confirmPendingDocumentTextEditAction(msg)"
                      >
                        {{ msg.pendingDocumentTextEditAction.status === 'applying' ? '执行中...' : '确定' }}
                      </button>
                      <button
                        type="button"
                        class="message-confirm-btn"
                        :disabled="msg.pendingDocumentTextEditAction.status === 'applying'"
                        @click.stop="cancelPendingDocumentTextEditAction(msg)"
                      >
                        取消
                      </button>
                    </div>
                    <div v-if="msg.pendingDocumentTextEditAction.statusMessage" class="message-confirm-status">
                      {{ $cdt(msg.pendingDocumentTextEditAction.statusMessage) }}
                    </div>
                  </div>
                  <div v-if="msg.pendingDocumentDeleteAction" class="message-confirm-card" :class="`is-${msg.pendingDocumentDeleteAction.status || 'pending'}`">
                    <div class="message-confirm-summary">
                      将执行：{{ $cdt((msg.pendingDocumentDeleteAction.changeSummary || []).join('、')) }}
                    </div>
                    <div v-if="getDocumentDeleteActionTags(msg.pendingDocumentDeleteAction).length" class="message-confirm-tags">
                      <span
                        v-for="tag in getDocumentDeleteActionTags(msg.pendingDocumentDeleteAction)"
                        :key="`${msg.id}-${tag.key}`"
                        class="message-confirm-tag"
                      >
                        {{ $cdt(tag.label) }}
                      </span>
                    </div>
                    <div v-if="msg.pendingDocumentDeleteAction.canApply" class="message-confirm-prompt">
                      {{ $cdt(msg.pendingDocumentDeleteAction.confirmPrompt) }}
                    </div>
                    <div v-if="msg.pendingDocumentDeleteAction.canApply && msg.pendingDocumentDeleteAction.status !== 'applied'" class="message-confirm-actions">
                      <button
                        type="button"
                        class="message-confirm-btn primary"
                        :disabled="msg.pendingDocumentDeleteAction.status === 'applying'"
                        @click.stop="confirmPendingDocumentDeleteAction(msg)"
                      >
                        {{ msg.pendingDocumentDeleteAction.status === 'applying' ? '执行中...' : '确定' }}
                      </button>
                      <button
                        type="button"
                        class="message-confirm-btn"
                        :disabled="msg.pendingDocumentDeleteAction.status === 'applying'"
                        @click.stop="cancelPendingDocumentDeleteAction(msg)"
                      >
                        取消
                      </button>
                    </div>
                    <div v-if="msg.pendingDocumentDeleteAction.statusMessage" class="message-confirm-status">
                      {{ $cdt(msg.pendingDocumentDeleteAction.statusMessage) }}
                    </div>
                  </div>
                  <div v-if="msg.pendingDocumentRevisionAction" class="message-confirm-card" :class="`is-${msg.pendingDocumentRevisionAction.status || 'pending'}`">
                    <div class="message-confirm-summary">
                      将执行：{{ $cdt((msg.pendingDocumentRevisionAction.changeSummary || []).join('、')) }}
                    </div>
                    <div v-if="getDocumentRevisionActionTags(msg.pendingDocumentRevisionAction).length" class="message-confirm-tags">
                      <span
                        v-for="tag in getDocumentRevisionActionTags(msg.pendingDocumentRevisionAction)"
                        :key="`${msg.id}-${tag.key}`"
                        class="message-confirm-tag"
                      >
                        {{ $cdt(tag.label) }}
                      </span>
                    </div>
                    <div v-if="msg.pendingDocumentRevisionAction.previewBefore || msg.pendingDocumentRevisionAction.previewAfter" class="message-confirm-status">
                      <div v-if="msg.pendingDocumentRevisionAction.previewBefore">原文预览：{{ $cdt(msg.pendingDocumentRevisionAction.previewBefore) }}</div>
                      <div v-if="msg.pendingDocumentRevisionAction.previewAfter">修订预览：{{ $cdt(msg.pendingDocumentRevisionAction.previewAfter) }}</div>
                    </div>
                    <label
                      v-if="msg.pendingDocumentRevisionAction.canApply && msg.pendingDocumentRevisionAction.backupSupported"
                      class="message-confirm-checkbox"
                    >
                      <input
                        type="checkbox"
                        :checked="msg.pendingDocumentRevisionAction.backupRequested === true"
                        :disabled="msg.pendingDocumentRevisionAction.status === 'applying'"
                        @change="updatePendingDocumentRevisionBackup(msg, $event.target.checked)"
                      />
                      <span>写回前备份源文件</span>
                    </label>
                    <div v-if="msg.pendingDocumentRevisionAction.canApply" class="message-confirm-prompt">
                      {{ $cdt(msg.pendingDocumentRevisionAction.confirmPrompt) }}
                    </div>
                    <div v-if="msg.pendingDocumentRevisionAction.canApply && msg.pendingDocumentRevisionAction.status !== 'applied'" class="message-confirm-actions">
                      <button
                        type="button"
                        class="message-confirm-btn primary"
                        :disabled="msg.pendingDocumentRevisionAction.status === 'applying'"
                        @click.stop="confirmPendingDocumentRevisionAction(msg)"
                      >
                        {{ msg.pendingDocumentRevisionAction.status === 'applying' ? '执行中...' : '确定' }}
                      </button>
                      <button
                        type="button"
                        class="message-confirm-btn"
                        :disabled="msg.pendingDocumentRevisionAction.status === 'applying'"
                        @click.stop="cancelPendingDocumentRevisionAction(msg)"
                      >
                        取消
                      </button>
                    </div>
                    <div v-if="msg.pendingDocumentRevisionAction.statusMessage" class="message-confirm-status">
                      {{ $cdt(msg.pendingDocumentRevisionAction.statusMessage) }}
                    </div>
                    <div v-if="Array.isArray(msg.pendingDocumentRevisionAction.processingDetails) && msg.pendingDocumentRevisionAction.processingDetails.length" class="message-confirm-secondary-actions">
                      <button
                        type="button"
                        class="message-confirm-btn subtle"
                        @click.stop="toggleDocumentRevisionDetails(msg.pendingDocumentRevisionAction)"
                      >
                        {{ msg.pendingDocumentRevisionAction.showDetails ? '收起详情' : '查看处理详情' }}
                      </button>
                    </div>
                    <div v-if="msg.pendingDocumentRevisionAction.showDetails && Array.isArray(msg.pendingDocumentRevisionAction.processingDetails) && msg.pendingDocumentRevisionAction.processingDetails.length" class="message-confirm-status">
                      <div v-for="detail in msg.pendingDocumentRevisionAction.processingDetails" :key="detail.id">{{ $cdt(detail.text) }}</div>
                    </div>
                  </div>
                  <div v-if="msg.pendingRevisionModePrompt" class="message-confirm-card" :class="`is-${msg.pendingRevisionModePrompt.status || 'pending'}`" @mouseenter="pausePendingAutoContinue(msg, 'pendingRevisionModePrompt')" @mouseleave="resumePendingRevisionModePromptAutoContinue(msg)" @focusin="handlePendingAutoContinueFocusIn(msg, 'pendingRevisionModePrompt')" @focusout="handlePendingAutoContinueFocusOut(msg, 'pendingRevisionModePrompt', $event)">
                    <div class="message-confirm-summary">
                      {{ $cdt(msg.pendingRevisionModePrompt.summaryText) }}
                    </div>
                    <div v-if="getPendingConfirmPrompt(msg.pendingRevisionModePrompt)" class="message-confirm-prompt">
                      {{ getPendingConfirmPrompt(msg.pendingRevisionModePrompt) }}
                    </div>
                    <div v-if="shouldShowPendingAutoContinue(msg.pendingRevisionModePrompt)" class="message-confirm-countdown">
                      <div class="message-confirm-countdown-text">{{ getPendingAutoContinueText(msg.pendingRevisionModePrompt) }}</div>
                      <div class="message-confirm-countdown-track">
                        <div class="message-confirm-countdown-fill" :style="getPendingAutoContinueProgressStyle(msg.pendingRevisionModePrompt)"></div>
                      </div>
                    </div>
                    <div class="message-confirm-actions">
                      <button
                        type="button"
                        class="message-confirm-btn primary"
                        :disabled="msg.pendingRevisionModePrompt.status === 'applying'"
                        @click.stop="confirmPendingRevisionModePrompt(msg)"
                      >
                        {{ msg.pendingRevisionModePrompt.status === 'applying' ? '处理中...' : '开启修订并继续' }}
                      </button>
                      <button
                        type="button"
                        class="message-confirm-btn"
                        :disabled="msg.pendingRevisionModePrompt.status === 'applying'"
                        @click.stop="continuePendingRevisionModePrompt(msg)"
                      >
                        直接继续
                      </button>
                    </div>
                    <div v-if="msg.pendingRevisionModePrompt.statusMessage" class="message-confirm-status">
                      {{ $cdt(msg.pendingRevisionModePrompt.statusMessage) }}
                    </div>
                  </div>
                  <div v-if="msg.pendingDocumentOperationChoice" class="message-confirm-card" :class="`is-${msg.pendingDocumentOperationChoice.status || 'pending'}`" @mouseenter="pausePendingAutoContinue(msg, 'pendingDocumentOperationChoice')" @mouseleave="resumePendingDocumentOperationChoiceAutoContinue(msg)" @focusin="handlePendingAutoContinueFocusIn(msg, 'pendingDocumentOperationChoice')" @focusout="handlePendingAutoContinueFocusOut(msg, 'pendingDocumentOperationChoice', $event)">
                    <div class="message-confirm-summary">
                      {{ $cdt(msg.pendingDocumentOperationChoice.summaryText || '已识别到文档操作，请确认要继续执行的类型。') }}
                    </div>
                    <div v-if="Array.isArray(msg.pendingDocumentOperationChoice.options) && msg.pendingDocumentOperationChoice.options.length" class="message-confirm-tags">
                      <button
                        v-for="option in msg.pendingDocumentOperationChoice.options"
                        :key="`${msg.id}-${option.key}`"
                        type="button"
                        class="message-confirm-tag message-confirm-tag-button"
                        :class="{ 'is-selected': msg.pendingDocumentOperationChoice.selectedKeys?.includes(option.key) }"
                        :disabled="msg.pendingDocumentOperationChoice.status === 'applying'"
                        @click.stop="togglePendingDocumentOperationChoiceOption(msg, option.key)"
                      >
                        {{ $cdt(option.label) }}<span v-if="option.apiLabel"> · {{ $cdt(option.apiLabel) }}</span>
                      </button>
                    </div>
                    <div v-if="getPendingConfirmPrompt(msg.pendingDocumentOperationChoice)" class="message-confirm-prompt">
                      {{ getPendingConfirmPrompt(msg.pendingDocumentOperationChoice) }}
                    </div>
                    <div v-if="shouldShowPendingAutoContinue(msg.pendingDocumentOperationChoice)" class="message-confirm-countdown">
                      <div class="message-confirm-countdown-text">{{ getPendingAutoContinueText(msg.pendingDocumentOperationChoice) }}</div>
                      <div class="message-confirm-countdown-track">
                        <div class="message-confirm-countdown-fill" :style="getPendingAutoContinueProgressStyle(msg.pendingDocumentOperationChoice)"></div>
                      </div>
                    </div>
                    <div v-if="msg.pendingDocumentOperationChoice.status !== 'applied'" class="message-confirm-actions">
                      <button
                        type="button"
                        class="message-confirm-btn primary"
                        :disabled="msg.pendingDocumentOperationChoice.status === 'applying'"
                        @click.stop="confirmPendingDocumentOperationChoice(msg)"
                      >
                        {{ msg.pendingDocumentOperationChoice.status === 'applying' ? '执行中...' : '继续处理' }}
                      </button>
                      <button
                        type="button"
                        class="message-confirm-btn"
                        :disabled="msg.pendingDocumentOperationChoice.status === 'applying'"
                        @click.stop="cancelPendingDocumentOperationChoice(msg)"
                      >
                        取消
                      </button>
                    </div>
                    <div v-if="msg.pendingDocumentOperationChoice.statusMessage" class="message-confirm-status">
                      {{ $cdt(msg.pendingDocumentOperationChoice.statusMessage) }}
                    </div>
                  </div>
                  <div v-if="msg.pendingWpsCapabilityForm" class="message-confirm-card" :class="`is-${msg.pendingWpsCapabilityForm.status || 'pending'}`" @mouseenter="pausePendingAutoContinue(msg, 'pendingWpsCapabilityForm')" @mouseleave="resumePendingWpsCapabilityAutoContinue(msg)" @focusin="handlePendingAutoContinueFocusIn(msg, 'pendingWpsCapabilityForm')" @focusout="handlePendingAutoContinueFocusOut(msg, 'pendingWpsCapabilityForm', $event)">
                    <div class="message-confirm-summary">
                      {{ $cdt(msg.pendingWpsCapabilityForm.summaryText) }}
                    </div>
                    <div v-if="getPendingConfirmPrompt(msg.pendingWpsCapabilityForm)" class="message-confirm-prompt">
                      {{ getPendingConfirmPrompt(msg.pendingWpsCapabilityForm) }}
                    </div>
                    <div v-if="shouldShowPendingAutoContinue(msg.pendingWpsCapabilityForm)" class="message-confirm-countdown">
                      <div class="message-confirm-countdown-text">{{ getPendingAutoContinueText(msg.pendingWpsCapabilityForm) }}</div>
                      <div class="message-confirm-countdown-track">
                        <div class="message-confirm-countdown-fill" :style="getPendingAutoContinueProgressStyle(msg.pendingWpsCapabilityForm)"></div>
                      </div>
                    </div>
                    <div class="assistant-inline-form">
                      <label
                        v-for="field in msg.pendingWpsCapabilityForm.fields"
                        :key="`${msg.id}-wps-capability-field-${field.key}`"
                        class="assistant-inline-field"
                      >
                        <span class="assistant-inline-field-label">{{ $cdt(field.label) }}</span>
                        <select
                          v-if="field.type === 'select'"
                          :value="field.value"
                          class="assistant-inline-input"
                          :disabled="msg.pendingWpsCapabilityForm.status === 'applying'"
                          @change="updatePendingWpsCapabilityField(msg, field.key, $event.target.value)"
                        >
                          <option
                            v-for="option in field.options || []"
                            :key="`${msg.id}-wps-capability-option-${field.key}-${option.value}`"
                            :value="option.value"
                          >
                            {{ $cdt(option.label) }}
                          </option>
                        </select>
                        <input
                          v-else
                          :value="field.value"
                          :type="field.type === 'password' ? 'password' : (field.type === 'number' || field.type === 'page-selector' ? 'number' : 'text')"
                          class="assistant-inline-input"
                          :placeholder="field.placeholder"
                          :disabled="msg.pendingWpsCapabilityForm.status === 'applying'"
                          @input="updatePendingWpsCapabilityField(msg, field.key, $event.target.value)"
                        />
                      </label>
                    </div>
                    <div class="message-confirm-actions">
                      <button
                        type="button"
                        class="message-confirm-btn primary"
                        :disabled="msg.pendingWpsCapabilityForm.status === 'applying'"
                        @click.stop="confirmPendingWpsCapabilityForm(msg)"
                      >
                        {{ msg.pendingWpsCapabilityForm.status === 'applying' ? '执行中...' : '执行 WPS 操作' }}
                      </button>
                      <button
                        type="button"
                        class="message-confirm-btn"
                        :disabled="msg.pendingWpsCapabilityForm.status === 'applying'"
                        @click.stop="cancelPendingWpsCapabilityForm(msg)"
                      >
                        取消
                      </button>
                    </div>
                    <div v-if="msg.pendingWpsCapabilityForm.statusMessage" class="message-confirm-status">
                      {{ $cdt(msg.pendingWpsCapabilityForm.statusMessage) }}
                    </div>
                  </div>
                  <div v-if="msg.pendingAssistantIntentChoice" class="message-confirm-card" :class="`is-${msg.pendingAssistantIntentChoice.status || 'pending'}`" @mouseenter="pausePendingAutoContinue(msg, 'pendingAssistantIntentChoice')" @mouseleave="resumePendingAssistantIntentChoiceAutoContinue(msg)" @focusin="handlePendingAutoContinueFocusIn(msg, 'pendingAssistantIntentChoice')" @focusout="handlePendingAutoContinueFocusOut(msg, 'pendingAssistantIntentChoice', $event)">
                    <div class="message-confirm-summary">
                      {{ $cdt(msg.pendingAssistantIntentChoice.summaryText) }}
                    </div>
                    <div v-if="Array.isArray(msg.pendingAssistantIntentChoice.options) && msg.pendingAssistantIntentChoice.options.length" class="message-confirm-tags">
                      <button
                        v-for="option in msg.pendingAssistantIntentChoice.options"
                        :key="`${msg.id}-assistant-intent-${option.key}`"
                        type="button"
                        class="message-confirm-tag message-confirm-tag-button"
                        :class="{ 'is-selected': msg.pendingAssistantIntentChoice.selectedKeys?.includes(option.key) }"
                        :disabled="msg.pendingAssistantIntentChoice.status === 'applying'"
                        @click.stop="togglePendingAssistantIntentChoiceOption(msg, option.key)"
                      >
                        {{ $cdt(option.label) }}<span v-if="option.apiLabel"> · {{ $cdt(option.apiLabel) }}</span>
                      </button>
                    </div>
                    <div v-if="getPendingConfirmPrompt(msg.pendingAssistantIntentChoice)" class="message-confirm-prompt">
                      {{ getPendingConfirmPrompt(msg.pendingAssistantIntentChoice) }}
                    </div>
                    <div v-if="shouldShowPendingAutoContinue(msg.pendingAssistantIntentChoice)" class="message-confirm-countdown">
                      <div class="message-confirm-countdown-text">{{ getPendingAutoContinueText(msg.pendingAssistantIntentChoice) }}</div>
                      <div class="message-confirm-countdown-track">
                        <div class="message-confirm-countdown-fill" :style="getPendingAutoContinueProgressStyle(msg.pendingAssistantIntentChoice)"></div>
                      </div>
                    </div>
                    <div v-if="msg.pendingAssistantIntentChoice.status !== 'applied'" class="message-confirm-actions">
                      <button
                        type="button"
                        class="message-confirm-btn primary"
                        :disabled="msg.pendingAssistantIntentChoice.status === 'applying'"
                        @click.stop="confirmPendingAssistantIntentChoice(msg)"
                      >
                        {{ msg.pendingAssistantIntentChoice.status === 'applying' ? '处理中...' : '继续匹配助手' }}
                      </button>
                      <button
                        type="button"
                        class="message-confirm-btn"
                        :disabled="msg.pendingAssistantIntentChoice.status === 'applying'"
                        @click.stop="cancelPendingAssistantIntentChoice(msg)"
                      >
                        取消
                      </button>
                    </div>
                    <div v-if="msg.pendingAssistantIntentChoice.statusMessage" class="message-confirm-status">
                      {{ $cdt(msg.pendingAssistantIntentChoice.statusMessage) }}
                    </div>
                  </div>
                  <div v-if="msg.pendingAssistantParameterCollection" class="message-confirm-card" :class="`is-${msg.pendingAssistantParameterCollection.status || 'pending'}`" @mouseenter="pausePendingAutoContinue(msg, 'pendingAssistantParameterCollection')" @mouseleave="resumePendingAssistantParameterAutoContinue(msg)" @focusin="handlePendingAutoContinueFocusIn(msg, 'pendingAssistantParameterCollection')" @focusout="handlePendingAutoContinueFocusOut(msg, 'pendingAssistantParameterCollection', $event)">
                    <div class="message-confirm-summary">
                      {{ $cdt(msg.pendingAssistantParameterCollection.summaryText) }}
                    </div>
                    <div v-if="getPendingConfirmPrompt(msg.pendingAssistantParameterCollection)" class="message-confirm-prompt">
                      {{ getPendingConfirmPrompt(msg.pendingAssistantParameterCollection) }}
                    </div>
                    <div v-if="shouldShowPendingAutoContinue(msg.pendingAssistantParameterCollection)" class="message-confirm-countdown">
                      <div class="message-confirm-countdown-text">{{ getPendingAutoContinueText(msg.pendingAssistantParameterCollection) }}</div>
                      <div class="message-confirm-countdown-track">
                        <div class="message-confirm-countdown-fill" :style="getPendingAutoContinueProgressStyle(msg.pendingAssistantParameterCollection)"></div>
                      </div>
                    </div>
                    <div
                      v-if="getPendingAssistantScopeHint(msg.pendingAssistantParameterCollection)"
                      class="assistant-scope-hint"
                    >
                      <div class="assistant-scope-hint-title">
                        {{ getPendingAssistantScopeHint(msg.pendingAssistantParameterCollection).summary }}
                      </div>
                      <div class="assistant-scope-hint-detail">
                        {{ getPendingAssistantScopeHint(msg.pendingAssistantParameterCollection).detail }}
                      </div>
                    </div>
                    <div class="assistant-inline-form">
                      <label
                        v-for="field in msg.pendingAssistantParameterCollection.fields"
                        :key="`${msg.id}-assistant-param-${field.key}`"
                        class="assistant-inline-field"
                      >
                        <span class="assistant-inline-field-label">{{ $cdt(field.label) }}</span>
                        <select
                          v-if="field.type === 'select'"
                          :value="field.value"
                          class="assistant-inline-input"
                          :disabled="msg.pendingAssistantParameterCollection.status === 'applying'"
                          @change="updatePendingAssistantParameterField(msg, field.key, $event.target.value)"
                        >
                          <option
                            v-for="option in field.options || []"
                            :key="`${msg.id}-assistant-param-option-${field.key}-${option.value}`"
                            :value="option.value"
                          >
                            {{ $cdt(option.label) }}
                          </option>
                        </select>
                        <input
                          v-else
                          :value="field.value"
                          type="text"
                          class="assistant-inline-input"
                          :placeholder="field.placeholder"
                          :disabled="msg.pendingAssistantParameterCollection.status === 'applying'"
                          @input="updatePendingAssistantParameterField(msg, field.key, $event.target.value)"
                        />
                      </label>
                    </div>
                    <div v-if="Array.isArray(msg.pendingAssistantCreationDraft?.previewResults) && msg.pendingAssistantCreationDraft.previewResults.length" class="assistant-comparison-preview-list">
                      <div
                        v-for="(sample, index) in msg.pendingAssistantCreationDraft.previewResults"
                        :key="`${msg.id}-assistant-preview-${index}`"
                        class="assistant-comparison-preview-item"
                      >
                        <div class="assistant-comparison-preview-title">{{ sample.label }}</div>
                        <div class="assistant-comparison-preview-text">输入：{{ sample.inputText }}</div>
                        <div class="assistant-comparison-preview-text">旧版：{{ sample.baselineOutput }}</div>
                        <div class="assistant-comparison-preview-text">新版：{{ sample.candidateOutput }}</div>
                        <div class="assistant-comparison-preview-note">{{ sample.summary }}</div>
                      </div>
                    </div>
                    <div class="message-confirm-actions">
                      <button
                        type="button"
                        class="message-confirm-btn primary"
                        :disabled="msg.pendingAssistantParameterCollection.status === 'applying'"
                        @click.stop="confirmPendingAssistantParameterCollection(msg)"
                      >
                        {{ msg.pendingAssistantParameterCollection.status === 'applying' ? '处理中...' : '继续' }}
                      </button>
                      <button
                        type="button"
                        class="message-confirm-btn"
                        :disabled="msg.pendingAssistantParameterCollection.status === 'applying'"
                        @click.stop="cancelPendingAssistantParameterCollection(msg)"
                      >
                        取消
                      </button>
                    </div>
                    <div v-if="msg.pendingAssistantParameterCollection.statusMessage" class="message-confirm-status">
                      {{ $cdt(msg.pendingAssistantParameterCollection.statusMessage) }}
                    </div>
                  </div>
                  <div v-if="msg.pendingLocalFaqAction" class="message-confirm-card" :class="`is-${msg.pendingLocalFaqAction.status || 'pending'}`">
                    <div class="message-confirm-summary">
                      {{ $cdt(msg.pendingLocalFaqAction.summaryText) }}
                    </div>
                    <div v-if="getPendingConfirmPrompt(msg.pendingLocalFaqAction)" class="message-confirm-prompt">
                      {{ getPendingConfirmPrompt(msg.pendingLocalFaqAction) }}
                    </div>
                    <div class="message-confirm-actions">
                      <button
                        type="button"
                        class="message-confirm-btn primary"
                        :disabled="msg.pendingLocalFaqAction.status === 'applying'"
                        @click.stop="confirmPendingLocalFaqAction(msg)"
                      >
                        {{ msg.pendingLocalFaqAction.suggestedAction?.label || '去创建助手' }}
                      </button>
                      <button
                        type="button"
                        class="message-confirm-btn"
                        :disabled="msg.pendingLocalFaqAction.status === 'applying'"
                        @click.stop="viewPendingLocalFaqAction(msg)"
                      >
                        {{ msg.pendingLocalFaqAction.suggestedAction?.viewLabel || '查看现有功能入口' }}
                      </button>
                      <button
                        type="button"
                        class="message-confirm-btn"
                        :disabled="msg.pendingLocalFaqAction.status === 'applying'"
                        @click.stop="dismissPendingLocalFaqAction(msg)"
                      >
                        {{ msg.pendingLocalFaqAction.suggestedAction?.dismissLabel || '暂不需要' }}
                      </button>
                    </div>
                    <div v-if="msg.pendingLocalFaqAction.statusMessage" class="message-confirm-status">
                      {{ $cdt(msg.pendingLocalFaqAction.statusMessage) }}
                    </div>
                  </div>
                  <div v-if="msg.pendingAssistantRepairChoice" class="message-confirm-card" :class="`is-${msg.pendingAssistantRepairChoice.status || 'pending'}`">
                    <div class="message-confirm-summary">
                      {{ $cdt(msg.pendingAssistantRepairChoice.summaryText) }}
                    </div>
                    <div v-if="Array.isArray(msg.pendingAssistantRepairChoice.assistantOptions) && msg.pendingAssistantRepairChoice.assistantOptions.length" class="message-confirm-tags">
                      <button
                        v-for="option in msg.pendingAssistantRepairChoice.assistantOptions"
                        :key="`${msg.id}-repair-assistant-option-${option.assistantId}`"
                        type="button"
                        class="message-confirm-tag message-confirm-tag-button"
                        :class="{ 'is-selected': msg.pendingAssistantRepairChoice.selectedAssistantId === option.assistantId }"
                        :disabled="msg.pendingAssistantRepairChoice.status === 'applying'"
                        @click.stop="selectPendingAssistantRepairChoice(msg, option.assistantId)"
                      >
                        {{ $cdt(option.label) }}
                      </button>
                    </div>
                    <div v-if="getSelectedAssistantExecutionOption(msg.pendingAssistantRepairChoice)" class="assistant-choice-detail">
                      <div class="assistant-choice-title">
                        {{ getSelectedAssistantExecutionOption(msg.pendingAssistantRepairChoice).title }}
                      </div>
                      <div class="assistant-choice-desc">
                        {{ getSelectedAssistantExecutionOption(msg.pendingAssistantRepairChoice).description }}
                      </div>
                      <div class="assistant-choice-reason">
                        匹配原因：{{ getSelectedAssistantExecutionOption(msg.pendingAssistantRepairChoice).reasonText }}
                      </div>
                    </div>
                    <div v-if="getPendingConfirmPrompt(msg.pendingAssistantRepairChoice)" class="message-confirm-prompt">
                      {{ getPendingConfirmPrompt(msg.pendingAssistantRepairChoice) }}
                    </div>
                    <div class="message-confirm-actions">
                      <button
                        type="button"
                        class="message-confirm-btn primary"
                        :disabled="msg.pendingAssistantRepairChoice.status === 'applying'"
                        @click.stop="confirmPendingAssistantRepairChoice(msg)"
                      >
                        {{ msg.pendingAssistantRepairChoice.status === 'applying' ? '处理中...' : '按所选助手生成修复版' }}
                      </button>
                      <button
                        type="button"
                        class="message-confirm-btn"
                        :disabled="msg.pendingAssistantRepairChoice.status === 'applying'"
                        @click.stop="cancelPendingAssistantRepairChoice(msg)"
                      >
                        取消
                      </button>
                    </div>
                    <div v-if="msg.pendingAssistantRepairChoice.statusMessage" class="message-confirm-status">
                      {{ $cdt(msg.pendingAssistantRepairChoice.statusMessage) }}
                    </div>
                  </div>
                  <div v-if="msg.pendingAssistantExecutionChoice" class="message-confirm-card" :class="`is-${msg.pendingAssistantExecutionChoice.status || 'pending'}`" @mouseenter="pausePendingAutoContinue(msg, 'pendingAssistantExecutionChoice')" @mouseleave="resumePendingAssistantExecutionChoiceAutoContinue(msg)" @focusin="handlePendingAutoContinueFocusIn(msg, 'pendingAssistantExecutionChoice')" @focusout="handlePendingAutoContinueFocusOut(msg, 'pendingAssistantExecutionChoice', $event)">
                    <div class="message-confirm-summary">
                      {{ $cdt(msg.pendingAssistantExecutionChoice.summaryText) }}
                    </div>
                    <div v-if="Array.isArray(msg.pendingAssistantExecutionChoice.assistantOptions) && msg.pendingAssistantExecutionChoice.assistantOptions.length" class="message-confirm-tags">
                      <button
                        v-for="option in msg.pendingAssistantExecutionChoice.assistantOptions"
                        :key="`${msg.id}-assistant-option-${option.assistantId}`"
                        type="button"
                        class="message-confirm-tag message-confirm-tag-button"
                        :class="{ 'is-selected': msg.pendingAssistantExecutionChoice.selectedAssistantId === option.assistantId }"
                        :disabled="msg.pendingAssistantExecutionChoice.status === 'applying'"
                        @click.stop="selectPendingAssistantExecutionOption(msg, option.assistantId)"
                      >
                        {{ $cdt(option.label) }}
                      </button>
                    </div>
                    <div v-if="getSelectedAssistantExecutionOption(msg.pendingAssistantExecutionChoice)" class="assistant-choice-detail">
                      <div class="assistant-choice-title">
                        {{ getSelectedAssistantExecutionOption(msg.pendingAssistantExecutionChoice).title }}
                      </div>
                      <div class="assistant-choice-desc">
                        {{ getSelectedAssistantExecutionOption(msg.pendingAssistantExecutionChoice).description }}
                      </div>
                      <div class="assistant-choice-reason">
                        匹配原因：{{ getSelectedAssistantExecutionOption(msg.pendingAssistantExecutionChoice).reasonText }}
                      </div>
                      <div class="assistant-choice-features">
                        <div
                          v-for="feature in getSelectedAssistantExecutionOption(msg.pendingAssistantExecutionChoice).featureLines"
                          :key="feature"
                          class="assistant-choice-feature"
                        >
                          {{ feature }}
                        </div>
                      </div>
                    </div>
                    <div v-if="getPendingConfirmPrompt(msg.pendingAssistantExecutionChoice)" class="message-confirm-prompt">
                      {{ getPendingConfirmPrompt(msg.pendingAssistantExecutionChoice) }}
                    </div>
                    <div v-if="shouldShowPendingAutoContinue(msg.pendingAssistantExecutionChoice)" class="message-confirm-countdown">
                      <div class="message-confirm-countdown-text">{{ getPendingAutoContinueText(msg.pendingAssistantExecutionChoice) }}</div>
                      <div class="message-confirm-countdown-track">
                        <div class="message-confirm-countdown-fill" :style="getPendingAutoContinueProgressStyle(msg.pendingAssistantExecutionChoice)"></div>
                      </div>
                    </div>
                    <div class="message-confirm-actions">
                      <button
                        type="button"
                        class="message-confirm-btn primary"
                        :disabled="msg.pendingAssistantExecutionChoice.status === 'applying'"
                        @click.stop="confirmPendingAssistantExecutionChoice(msg)"
                      >
                        {{ msg.pendingAssistantExecutionChoice.status === 'applying' ? '启动中...' : '执行所选助手' }}
                      </button>
                      <button
                        type="button"
                        class="message-confirm-btn"
                        :disabled="msg.pendingAssistantExecutionChoice.status === 'applying'"
                        @click.stop="declinePendingAssistantExecutionChoice(msg)"
                      >
                        否，创建新助手
                      </button>
                      <button
                        type="button"
                        class="message-confirm-btn"
                        :disabled="msg.pendingAssistantExecutionChoice.status === 'applying'"
                        @click.stop="cancelPendingAssistantExecutionChoice(msg)"
                      >
                        取消
                      </button>
                    </div>
                    <div v-if="msg.pendingAssistantExecutionChoice.statusMessage" class="message-confirm-status">
                      {{ $cdt(msg.pendingAssistantExecutionChoice.statusMessage) }}
                    </div>
                  </div>
                  <div v-if="msg.pendingAssistantCreationDraft" class="message-confirm-card" :class="`is-${msg.pendingAssistantCreationDraft.status || 'pending'}`" @mouseenter="pausePendingAutoContinue(msg, 'pendingAssistantCreationDraft')" @mouseleave="resumePendingAssistantCreationDraftAutoContinue(msg)" @focusin="handlePendingAutoContinueFocusIn(msg, 'pendingAssistantCreationDraft')" @focusout="handlePendingAutoContinueFocusOut(msg, 'pendingAssistantCreationDraft', $event)">
                    <div class="message-confirm-summary">
                      {{ $cdt(msg.pendingAssistantCreationDraft.summaryText) }}
                    </div>
                    <div v-if="getPendingConfirmPrompt(msg.pendingAssistantCreationDraft)" class="message-confirm-prompt">
                      {{ getPendingConfirmPrompt(msg.pendingAssistantCreationDraft) }}
                    </div>
                    <div v-if="shouldShowPendingAutoContinue(msg.pendingAssistantCreationDraft)" class="message-confirm-countdown">
                      <div class="message-confirm-countdown-text">{{ getPendingAutoContinueText(msg.pendingAssistantCreationDraft) }}</div>
                      <div class="message-confirm-countdown-track">
                        <div class="message-confirm-countdown-fill" :style="getPendingAutoContinueProgressStyle(msg.pendingAssistantCreationDraft)"></div>
                      </div>
                    </div>
                    <div class="assistant-inline-form">
                      <label class="assistant-inline-field">
                        <span class="assistant-inline-field-label">助手名称</span>
                        <input
                          :value="msg.pendingAssistantCreationDraft.assistantName"
                          type="text"
                          class="assistant-inline-input"
                          placeholder="请输入助手名称"
                          :disabled="msg.pendingAssistantCreationDraft.status === 'applying'"
                          @input="updatePendingAssistantCreationDraftField(msg, 'assistantName', $event.target.value)"
                        />
                      </label>
                      <label class="assistant-inline-field">
                        <span class="assistant-inline-field-label">功能说明</span>
                        <input
                          :value="msg.pendingAssistantCreationDraft.description"
                          type="text"
                          class="assistant-inline-input"
                          placeholder="请输入助手的功能说明"
                          :disabled="msg.pendingAssistantCreationDraft.status === 'applying'"
                          @input="updatePendingAssistantCreationDraftField(msg, 'description', $event.target.value)"
                        />
                      </label>
                      <label class="assistant-inline-field assistant-inline-field--full">
                        <span class="assistant-inline-field-label">助手要求</span>
                        <textarea
                          :value="msg.pendingAssistantCreationDraft.requirementText"
                          class="assistant-inline-textarea"
                          placeholder="可在这里补充或修改助手要求"
                          :disabled="msg.pendingAssistantCreationDraft.status === 'applying'"
                          @input="updatePendingAssistantCreationDraftField(msg, 'requirementText', $event.target.value)"
                        ></textarea>
                      </label>
                    </div>
                    <div class="message-confirm-actions">
                      <button
                        type="button"
                        class="message-confirm-btn primary"
                        :disabled="msg.pendingAssistantCreationDraft.status === 'applying'"
                        @click.stop="confirmPendingAssistantCreationDraft(msg)"
                      >
                        {{ msg.pendingAssistantCreationDraft.status === 'applying' ? '创建中...' : '创建并执行助手' }}
                      </button>
                      <button
                        type="button"
                        class="message-confirm-btn"
                        :disabled="msg.pendingAssistantCreationDraft.status === 'applying'"
                        @click.stop="cancelPendingAssistantCreationDraft(msg)"
                      >
                        取消
                      </button>
                    </div>
                    <div v-if="msg.pendingAssistantCreationDraft.statusMessage" class="message-confirm-status">
                      {{ $cdt(msg.pendingAssistantCreationDraft.statusMessage) }}
                    </div>
                  </div>
                  <div v-if="msg.pendingReportGenerationForm" class="message-confirm-card" :class="`is-${msg.pendingReportGenerationForm.status || 'pending'}`" @mouseenter="pausePendingAutoContinue(msg, 'pendingReportGenerationForm', 'report')" @mouseleave="resumePendingReportGenerationAutoContinue(msg)" @focusin="handlePendingAutoContinueFocusIn(msg, 'pendingReportGenerationForm', 'report')" @focusout="handlePendingAutoContinueFocusOut(msg, 'pendingReportGenerationForm', $event, 'report')">
                    <div class="message-confirm-summary">
                      {{ $cdt(msg.pendingReportGenerationForm.summaryText) }}
                    </div>
                    <div v-if="getPendingConfirmPrompt(msg.pendingReportGenerationForm)" class="message-confirm-prompt">
                      {{ getPendingConfirmPrompt(msg.pendingReportGenerationForm) }}
                    </div>
                    <div v-if="shouldShowPendingAutoContinue(msg.pendingReportGenerationForm)" class="message-confirm-countdown">
                      <div class="message-confirm-countdown-text">{{ getPendingAutoContinueText(msg.pendingReportGenerationForm) }}</div>
                      <div class="message-confirm-countdown-track">
                        <div class="message-confirm-countdown-fill" :style="getPendingAutoContinueProgressStyle(msg.pendingReportGenerationForm)"></div>
                      </div>
                    </div>
                    <div class="assistant-inline-form">
                      <label
                        v-for="field in msg.pendingReportGenerationForm.fields"
                        :key="`${msg.id}-report-field-${field.key}`"
                        class="assistant-inline-field"
                      >
                        <span class="assistant-inline-field-label">{{ $cdt(field.label) }}</span>
                        <select
                          v-if="field.type === 'select'"
                          :value="field.value"
                          class="assistant-inline-input"
                          :disabled="msg.pendingReportGenerationForm.status === 'applying'"
                          @change="updatePendingReportGenerationField(msg, field.key, $event.target.value)"
                        >
                          <option
                            v-for="option in field.options || []"
                            :key="`${msg.id}-report-option-${field.key}-${option.value}`"
                            :value="option.value"
                          >
                            {{ $cdt(option.label) }}
                          </option>
                        </select>
                        <input
                          v-else
                          :value="field.value"
                          type="text"
                          class="assistant-inline-input"
                          :placeholder="field.placeholder"
                          :disabled="msg.pendingReportGenerationForm.status === 'applying'"
                          @input="updatePendingReportGenerationField(msg, field.key, $event.target.value)"
                        />
                      </label>
                    </div>
                    <div class="message-confirm-actions">
                      <button
                        type="button"
                        class="message-confirm-btn primary"
                        :disabled="msg.pendingReportGenerationForm.status === 'applying'"
                        @click.stop="confirmPendingReportGenerationForm(msg)"
                      >
                        {{ msg.pendingReportGenerationForm.status === 'applying' ? '起草中...' : msg.pendingReportGenerationForm.status === 'failed' ? '重试起草' : '起草报告草稿' }}
                      </button>
                      <button
                        type="button"
                        class="message-confirm-btn"
                        :disabled="msg.pendingReportGenerationForm.status === 'applying'"
                        @click.stop="cancelPendingReportGenerationForm(msg)"
                      >
                        取消
                      </button>
                    </div>
                    <div v-if="msg.pendingReportGenerationForm.statusMessage" class="message-confirm-status">
                      {{ $cdt(msg.pendingReportGenerationForm.statusMessage) }}
                    </div>
                  </div>
                  <div v-if="msg.pendingMultimodalGenerationForm" class="message-confirm-card" :class="`is-${msg.pendingMultimodalGenerationForm.status || 'pending'}`" @mouseenter="pausePendingAutoContinue(msg, 'pendingMultimodalGenerationForm')" @mouseleave="resumePendingMultimodalGenerationAutoContinue(msg)" @focusin="handlePendingAutoContinueFocusIn(msg, 'pendingMultimodalGenerationForm')" @focusout="handlePendingAutoContinueFocusOut(msg, 'pendingMultimodalGenerationForm', $event)">
                    <div class="message-confirm-summary">
                      {{ $cdt(msg.pendingMultimodalGenerationForm.summaryText) }}
                    </div>
                    <div v-if="getPendingConfirmPrompt(msg.pendingMultimodalGenerationForm)" class="message-confirm-prompt">
                      {{ getPendingConfirmPrompt(msg.pendingMultimodalGenerationForm) }}
                    </div>
                    <div v-if="shouldShowPendingAutoContinue(msg.pendingMultimodalGenerationForm)" class="message-confirm-countdown">
                      <div class="message-confirm-countdown-text">{{ getPendingAutoContinueText(msg.pendingMultimodalGenerationForm) }}</div>
                      <div class="message-confirm-countdown-track">
                        <div class="message-confirm-countdown-fill" :style="getPendingAutoContinueProgressStyle(msg.pendingMultimodalGenerationForm)"></div>
                      </div>
                    </div>
                    <div class="assistant-inline-form">
                      <label
                        v-for="field in msg.pendingMultimodalGenerationForm.fields"
                        :key="`${msg.id}-multimodal-field-${field.key}`"
                        class="assistant-inline-field"
                      >
                        <span class="assistant-inline-field-label">{{ $cdt(field.label) }}</span>
                        <select
                          v-if="field.type === 'select'"
                          :value="field.value"
                          class="assistant-inline-input"
                          :disabled="msg.pendingMultimodalGenerationForm.status === 'applying'"
                          @change="updatePendingMultimodalGenerationField(msg, field.key, $event.target.value)"
                        >
                          <option
                            v-for="option in field.options || []"
                            :key="`${msg.id}-multimodal-option-${field.key}-${option.value}`"
                            :value="option.value"
                          >
                            {{ $cdt(option.label) }}
                          </option>
                        </select>
                        <input
                          v-else
                          :value="field.value"
                          type="text"
                          class="assistant-inline-input"
                          :placeholder="field.placeholder"
                          :disabled="msg.pendingMultimodalGenerationForm.status === 'applying'"
                          @input="updatePendingMultimodalGenerationField(msg, field.key, $event.target.value)"
                        />
                      </label>
                    </div>
                    <div class="message-confirm-actions">
                      <button
                        type="button"
                        class="message-confirm-btn primary"
                        :disabled="msg.pendingMultimodalGenerationForm.status === 'applying'"
                        @click.stop="confirmPendingMultimodalGenerationForm(msg)"
                      >
                        {{ msg.pendingMultimodalGenerationForm.status === 'applying' ? '生成中...' : '开始生成' }}
                      </button>
                      <button
                        type="button"
                        class="message-confirm-btn"
                        :disabled="msg.pendingMultimodalGenerationForm.status === 'applying'"
                        @click.stop="cancelPendingMultimodalGenerationForm(msg)"
                      >
                        取消
                      </button>
                    </div>
                    <div v-if="msg.pendingMultimodalGenerationForm.statusMessage" class="message-confirm-status">
                      {{ $cdt(msg.pendingMultimodalGenerationForm.statusMessage) }}
                    </div>
                  </div>
                  <div v-if="msg.pendingReportDraftConfirmation" class="message-confirm-card" :class="`is-${msg.pendingReportDraftConfirmation.status || 'pending'}`" @mouseenter="pausePendingAutoContinue(msg, 'pendingReportDraftConfirmation', 'report')" @mouseleave="resumePendingReportDraftConfirmationAutoContinue(msg)" @focusin="handlePendingAutoContinueFocusIn(msg, 'pendingReportDraftConfirmation', 'report')" @focusout="handlePendingAutoContinueFocusOut(msg, 'pendingReportDraftConfirmation', $event, 'report')">
                    <div class="message-confirm-summary">
                      {{ $cdt(msg.pendingReportDraftConfirmation.summaryText) }}
                    </div>
                    <div v-if="getPendingConfirmPrompt(msg.pendingReportDraftConfirmation)" class="message-confirm-prompt">
                      {{ getPendingConfirmPrompt(msg.pendingReportDraftConfirmation) }}
                    </div>
                    <div v-if="shouldShowPendingAutoContinue(msg.pendingReportDraftConfirmation)" class="message-confirm-countdown">
                      <div class="message-confirm-countdown-text">{{ getPendingAutoContinueText(msg.pendingReportDraftConfirmation) }}</div>
                      <div class="message-confirm-countdown-track">
                        <div class="message-confirm-countdown-fill" :style="getPendingAutoContinueProgressStyle(msg.pendingReportDraftConfirmation)"></div>
                      </div>
                    </div>
                    <div class="assistant-choice-detail report-draft-meta-card">
                      <div class="assistant-choice-title">{{ $cdt(msg.pendingReportDraftConfirmation.reportName || '未命名报告') }}</div>
                      <div class="assistant-choice-features">
                        <div class="assistant-choice-feature">行业：{{ $cdt(msg.pendingReportDraftConfirmation.industry || '待确认') }}</div>
                        <div class="assistant-choice-feature">类型：{{ getReportTypeLabel(msg.pendingReportDraftConfirmation.reportType || 'general-analysis-report') }}</div>
                        <div class="assistant-choice-feature">格式：{{ (msg.pendingReportDraftConfirmation.outputFormat || 'md').toUpperCase() }}</div>
                        <div class="assistant-choice-feature">范围：{{ getGeneratedOutputScopeLabel(msg.pendingReportDraftConfirmation.scope) }}</div>
                      </div>
                    </div>
                    <div class="assistant-inline-form">
                      <label class="assistant-inline-field">
                        <span class="assistant-inline-field-label">报告名称</span>
                        <input
                          :value="msg.pendingReportDraftConfirmation.reportName"
                          type="text"
                          class="assistant-inline-input"
                          :disabled="msg.pendingReportDraftConfirmation.status === 'applying'"
                          @input="updatePendingReportDraftField(msg, 'reportName', $event.target.value)"
                        />
                      </label>
                      <label class="assistant-inline-field">
                        <span class="assistant-inline-field-label">所属行业</span>
                        <input
                          :value="msg.pendingReportDraftConfirmation.industry"
                          type="text"
                          class="assistant-inline-input"
                          :disabled="msg.pendingReportDraftConfirmation.status === 'applying'"
                          @input="updatePendingReportDraftField(msg, 'industry', $event.target.value)"
                        />
                      </label>
                      <label class="assistant-inline-field assistant-inline-field--full">
                        <span class="assistant-inline-field-label">报告大纲</span>
                        <textarea
                          :value="msg.pendingReportDraftConfirmation.outlineText"
                          class="assistant-inline-textarea"
                          :disabled="msg.pendingReportDraftConfirmation.status === 'applying'"
                          @input="updatePendingReportDraftField(msg, 'outlineText', $event.target.value)"
                        ></textarea>
                      </label>
                      <label class="assistant-inline-field assistant-inline-field--full">
                        <span class="assistant-inline-field-label">写作口径</span>
                        <textarea
                          :value="msg.pendingReportDraftConfirmation.writingGuidance"
                          class="assistant-inline-textarea"
                          :disabled="msg.pendingReportDraftConfirmation.status === 'applying'"
                          @input="updatePendingReportDraftField(msg, 'writingGuidance', $event.target.value)"
                        ></textarea>
                      </label>
                      <label class="assistant-inline-field assistant-inline-field--full">
                        <span class="assistant-inline-field-label">生成要求</span>
                        <textarea
                          :value="msg.pendingReportDraftConfirmation.generationPrompt"
                          class="assistant-inline-textarea"
                          :disabled="msg.pendingReportDraftConfirmation.status === 'applying'"
                          @input="updatePendingReportDraftField(msg, 'generationPrompt', $event.target.value)"
                        ></textarea>
                      </label>
                    </div>
                    <div class="message-confirm-actions">
                      <button
                        type="button"
                        class="message-confirm-btn primary"
                        :disabled="msg.pendingReportDraftConfirmation.status === 'applying'"
                        @click.stop="confirmPendingReportDraftConfirmation(msg)"
                      >
                        {{ msg.pendingReportDraftConfirmation.status === 'applying' ? '生成中...' : '确认并生成文件' }}
                      </button>
                      <button
                        type="button"
                        class="message-confirm-btn"
                        :disabled="msg.pendingReportDraftConfirmation.status === 'applying'"
                        @click.stop="cancelPendingReportDraftConfirmation(msg)"
                      >
                        取消
                      </button>
                    </div>
                    <div v-if="msg.pendingReportDraftConfirmation.statusMessage" class="message-confirm-status">
                      {{ $cdt(msg.pendingReportDraftConfirmation.statusMessage) }}
                    </div>
                  </div>
                  <LongTaskRunCard
                    v-for="taskRun in getMessageLongTaskRunEntries(msg)"
                    :key="`${msg.id}-${taskRun.key}-card`"
                    :run="taskRun.run"
                    :summary-text="taskRun.summaryText"
                    @apply="handleLongTaskRunApply(taskRun.stopAction, msg)"
                    @stop="handleLongTaskRunStop(taskRun.stopAction, msg)"
                    @undo="handleLongTaskRunUndo(taskRun.stopAction, msg)"
                    @retry="handleLongTaskRunRetry(taskRun.stopAction, msg)"
                    @open-task-detail="handleLongTaskRunOpenDetail(taskRun.stopAction, msg)"
                    @toggle-details="toggleDocumentRevisionDetails(taskRun.run)"
                    @toggle-backup="handleLongTaskRunToggleBackup(taskRun.stopAction, msg, $event)"
                  />
                  <div v-if="hasMessageGeneratedFiles(msg)" class="message-generated-files">
                    <a
                      v-for="file in msg.generatedFiles"
                      :key="file.id"
                      href="#"
                      class="message-generated-file-link"
                      :class="{ 'is-pending': isGeneratedFilePending(file) }"
                      :title="getGeneratedFileDisplayTitle(file)"
                      @click.prevent="downloadGeneratedFile(file)"
                    >
                      <span class="message-generated-file-link-icon">{{ getGeneratedFileIcon(file) }}</span>
                      <span class="message-generated-file-link-name">{{ file.name }}</span>
                    </a>
                  </div>
                  <div v-if="shouldShowGuardQuickActions(msg)" class="message-guard-quick-actions">
                    <span class="message-guard-quick-label">已仅生成结果，可一键写回：</span>
                    <button type="button" class="message-confirm-btn primary" @click.stop="openResultActionModal('insert', msg.content)">
                      插入到文档
                    </button>
                    <button type="button" class="message-confirm-btn" @click.stop="openResultActionModal('replace', msg.content)">
                      替换选中
                    </button>
                  </div>
                  <div v-if="shouldShowAssistantActions(msg)" class="message-actions">
                    <button type="button" class="btn-action-icon" @click.stop="openResultActionModal('replace', msg.content)" title="替换文档内容">
                      <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 7V4H5v3H3v2h18V7zm-2 4H7v9h10zm-8 2h6v5H9z"/></svg>
                    </button>
                    <button type="button" class="btn-action-icon" @click.stop="openResultActionModal('insert', msg.content)" title="插入到文档（替换选中或插入到光标）">
                      <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                    </button>
                    <button type="button" class="btn-action-icon" @click.stop="openResultActionModal('append', msg.content)" title="追加到文末">
                      <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg>
                    </button>
                    <button type="button" class="btn-action-icon" @click.stop="openResultActionModal('comment', msg.content)" title="插入批注（在选中或光标处添加批注）">
                      <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
                    </button>
                  </div>
                </div>
              </div>
              <div v-if="msg.role === 'user' && getUserMessageAttachments(msg).length" class="message-user-attachments">
                <div
                  v-for="item in getUserMessageAttachments(msg)"
                  :key="`${msg.id}-${item.id || item.ordinal || item.name}`"
                  class="composer-hover-card message-user-attachment-card"
                  @mouseenter="updateTooltipLayout(getUserMessageAttachmentTooltipKey(msg, item), $event)"
                  @focusin="updateTooltipLayout(getUserMessageAttachmentTooltipKey(msg, item), $event)"
                >
                  <div class="message-user-attachment-chip" :title="item.name || getUserMessageAttachmentLabel(item)">
                    <span class="message-user-attachment-badge">{{ getUserMessageAttachmentLabel(item) }}</span>
                    <span class="message-user-attachment-name">{{ item.name || '未命名附件' }}</span>
                  </div>
                  <div
                    class="composer-tooltip composer-tooltip-attachment"
                    :style="getTooltipInlineStyle(getUserMessageAttachmentTooltipKey(msg, item))"
                  >
                    <div class="composer-tooltip-title">{{ getUserMessageAttachmentLabel(item) }}</div>
                    <div>{{ getUserMessageAttachmentTooltip(item) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- 底部输入区：单行 模型选择|输入框|附件|发送 -->
      <div class="input-area">
        <div class="composer-shell" :class="{ 'composer-shell--model-open': modelDropdownOpen }">
          <div v-if="attachments.length" class="composer-meta-row">
            <div
              v-if="selectionHintLabel"
              class="composer-hover-card composer-selection-hint-card"
              @mouseenter="updateTooltipLayout('selection', $event)"
              @focusin="updateTooltipLayout('selection', $event)"
            >
              <div class="composer-selection-hint">
                <img :src="aiDialogAssetsInline.chatSelection" alt="" class="composer-meta-icon-image" />
                <span>{{ selectionHintLabel }}</span>
              </div>
              <div
                v-if="selectionHintTooltip"
                class="composer-tooltip composer-tooltip-selection"
                :style="getTooltipInlineStyle('selection')"
              >
                <div class="composer-tooltip-title">{{ selectionHintLabel }}</div>
                <div>{{ selectionHintTooltip }}</div>
              </div>
            </div>
            <div class="composer-attachment-icons">
              <div
                v-for="item in attachments"
                :key="item.id"
                class="composer-hover-card"
                @mouseenter="updateTooltipLayout(item.id, $event)"
                @focusin="updateTooltipLayout(item.id, $event)"
              >
                <div class="composer-attachment-chip">
                  <button
                    type="button"
                    class="composer-attachment-ref-btn"
                    :title="`点击插入 ${formatShortAttachmentReference(item)}，右键插入 ${formatAttachmentReference(item)}`"
                    @click="insertAttachmentReference(item, 'short')"
                    @contextmenu.prevent="insertAttachmentReference(item, 'full')"
                  >
                    <img :src="aiDialogAssetsInline.chatAttach" alt="" class="composer-meta-icon-image" />
                    <span class="composer-attachment-ref-text">附件{{ item.ordinal || 0 }}</span>
                    <span class="composer-attachment-ref-name">{{ $cdt(item.name) }}</span>
                  </button>
                  <button
                    type="button"
                    class="composer-attachment-remove-btn"
                    :title="`移除 ${item.name}`"
                    @click.stop="removeAttachment(item.id)"
                  >
                    ×
                  </button>
                </div>
                <div
                  class="composer-tooltip composer-tooltip-attachment"
                  :style="getTooltipInlineStyle(item.id)"
                >
                  {{ formatAttachmentReference(item) }}
                </div>
              </div>
            </div>
          </div>
          <div v-if="attachments.length" class="composer-attachment-tip">
            点击附件标签插入“附件N”，右键插入“附件N（文件名）”。
          </div>
          <div class="input-row">
          <input
            ref="attachmentInputRef"
            type="file"
            class="chat-attachment-input"
            multiple
            @change="onAttachmentChange"
          />
          <button
            type="button"
            class="knowledge-base-btn"
            title="选择知识库"
            aria-label="选择知识库"
            @click="openKnowledgeBaseDialog"
          >
            <svg class="knowledge-base-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v15.5A2.5 2.5 0 0 1 17.5 20H7.5A2.5 2.5 0 0 1 5 17.5zm2.5-.5a.5.5 0 0 0-.5.5v13a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V4zm2 3H16v1.8H9.5zm0 3.8H16v1.8H9.5zm-4 9.2A2.5 2.5 0 0 1 3 16.5V7h2v9.5a.5.5 0 0 0 .5.5z"/>
            </svg>
          </button>
          <div class="model-select-wrap" ref="modelSelectRef">
            <button type="button" class="model-select-btn" @click="modelDropdownOpen = !modelDropdownOpen" @blur="onModelSelectBlur" :title="selectedModelName">
              <img :src="publicAssetUrl(selectedModelIcon)" class="model-select-icon" alt="" decoding="async" />
              <span class="model-select-arrow">▾</span>
            </button>
            <div v-if="modelDropdownOpen" class="model-dropdown">
              <div v-if="filteredModelGroups.length === 0" class="model-dropdown-empty">
                <p class="model-dropdown-empty-text">请先在设置中配置模型：开启提供商、填写 API 地址与密钥、刷新模型清单</p>
                <button type="button" class="model-dropdown-empty-btn" @mousedown.prevent="openModelSettings">
                  立即配置模型
                </button>
              </div>
              <template v-else>
                <div v-for="group in filteredModelGroups" :key="group.providerId || group.label" class="model-group">
                  <div
                    class="model-group-label"
                    :class="{ collapsed: isModelGroupCollapsed(group.providerId) }"
                    @mousedown.prevent="toggleModelGroupCollapsed(group.providerId)"
                  >
                    <span class="model-group-arrow">▾</span>
                    <img
                      :src="publicAssetUrl(group.icon || getModelLogoPath(group.providerId))"
                      class="model-group-icon"
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                    <span>{{ group.label }}</span>
                  </div>
                  <div v-show="!isModelGroupCollapsed(group.providerId)" class="model-group-models">
                    <div
                      v-for="m in group.models"
                      :key="m.id"
                      class="model-option"
                      :class="{ active: selectedModelId === m.id }"
                      @mousedown.prevent="selectModel(m)"
                    >
                      <img
                        :src="publicAssetUrl(getModelLogoPath(m.providerId))"
                        class="model-option-icon"
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                      <span>{{ m.name || m.modelId }}</span>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
          <textarea
            ref="composerInputRef"
            v-model="userInput"
            :placeholder="composerPlaceholder"
            class="text-input"
            rows="1"
            @input="handleComposerInput"
            @keydown="handleComposerKeydown"
          />
          <button
            type="button"
            class="tool-icon-btn"
            title="选择附件"
            @click="openAttachmentPicker"
          >
            <img :src="aiDialogAssetsInline.chatAttach" alt="" class="tool-icon-image" />
          </button>
          <button
            v-if="selectionContextSnapshot"
            type="button"
            class="tool-icon-btn"
            :title="selectionContextCollapsed ? '展开文档感知' : '收起文档感知'"
            @click="selectionContextCollapsed = !selectionContextCollapsed"
          >
            <img
              :src="aiDialogAssetsInline.chatToggle"
              alt=""
              class="tool-icon-image tool-icon-toggle"
              :class="{ expanded: !selectionContextCollapsed }"
            />
          </button>
          <button
            type="button"
            class="tool-icon-btn send"
            :class="{ 'is-launching': sendLaunchEffect.active }"
            :disabled="isStreaming || !hasPendingInput"
            @click="sendMessage"
            title="发送"
          >
            <img :src="aiDialogAssetsInline.chatSend" alt="" class="tool-icon-image" />
          </button>
        </div>
        </div>
        <div v-if="selectionContextSnapshot" class="context-sense-panel" :class="{ collapsed: selectionContextCollapsed }">
          <div v-if="!selectionContextCollapsed" class="context-sense-bar">
            <div class="context-sense-main">
              <div v-if="contextInfoChips.length" class="context-sense-chips">
                <span
                  v-for="chip in contextInfoChips"
                  :key="chip"
                  class="context-sense-chip"
                >
                  {{ chip }}
                </span>
              </div>
              <div v-if="contextPreviewText" class="context-sense-preview">{{ contextPreviewText }}</div>
            </div>
            <button type="button" class="context-sense-icon-btn" title="刷新感知" @click="refreshSelectionContext">
              <svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M12 6V3L8 7l4 4V8c2.21 0 4 1.79 4 4a4 4 0 0 1-7.46 2H6.26A6 6 0 1 0 12 6z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </main>

    <div v-if="showKnowledgeBaseDialog" class="assistant-recommend-modal-overlay" @click.self="closeKnowledgeBaseDialog">
      <div class="knowledge-base-modal">
        <div class="knowledge-base-modal-header">
          <h4>选择知识库</h4>
          <button type="button" class="btn-close-modal" @click="closeKnowledgeBaseDialog">×</button>
        </div>
        <div class="knowledge-base-modal-body">
          <div class="knowledge-base-modal-title">功能开发中</div>
          <p class="knowledge-base-modal-text">详情请关注我们的公众号</p>
          <div v-if="showFollowDonationQrCode" class="knowledge-base-qr-wrap">
            <img
              :src="followDonationQrCode()"
              alt="智灵鸟科技公众号二维码"
              class="knowledge-base-qr"
              loading="lazy"
              decoding="async"
              @error="handleDonationQrCodeError('follow')"
            />
          </div>
          <p v-else class="knowledge-base-modal-hint">公众号二维码暂不可用，请访问 aidooo.com 了解详情。</p>
        </div>
      </div>
    </div>

    <div v-if="showAssistantRecommendModal" class="assistant-recommend-modal-overlay" @click.self="showAssistantRecommendModal = false">
      <div class="assistant-recommend-modal">
        <div class="assistant-recommend-modal-header">
          <div>
            <h4>助手推荐</h4>
            <p>{{ assistantRecommendModalContext }}</p>
          </div>
          <button type="button" class="btn-close-modal" @click="showAssistantRecommendModal = false">×</button>
        </div>
        <div class="assistant-recommend-modal-body">
          <div v-if="assistantRecommendModalItems.length === 0" class="assistant-recommend-modal-empty">
            <div class="message-skill-empty-card">
              <div class="message-skill-empty-brand">
                <img
                  :src="aiDialogAssetsInline.logo"
                  alt="aidooo"
                  class="message-skill-empty-brand-logo"
                  width="40"
                  height="40"
                  decoding="async"
                />
                <div class="message-skill-empty-brand-text">
                  <span class="message-skill-empty-brand-name">aidooo</span>
                  <span class="message-skill-empty-brand-subtitle">技能招募中</span>
                </div>
              </div>
              <div class="message-skill-empty-title">暂无匹配的专项助手</div>
              <div class="message-skill-empty-text">
                {{ assistantRecommendModalEmptyDisplayText || assistantRecommendModalEmptyText || defaultMissingSkillModalNoticeText }}
                <span v-if="assistantRecommendModalEmptyTyping" class="cursor">▊</span>
              </div>
              <div class="message-skill-empty-links">
                <a href="https://aidooo.com" target="_blank" rel="noreferrer" @click.prevent="openExternalWebsite('https://aidooo.com')">aidooo.com</a>
                <span>微信公众号：智灵鸟科技</span>
              </div>
              <div class="message-skill-empty-actions">
                <a
                  href="https://aidooo.com"
                  target="_blank"
                  rel="noreferrer"
                  class="message-skill-empty-btn"
                  @click.prevent="openExternalWebsite('https://aidooo.com')"
                >
                  前往官网提技能需求
                </a>
              </div>
              <div v-if="showFollowDonationQrCode" class="message-skill-empty-qr">
                <div class="welcome-support-qr-wrap">
                  <img
                    :src="followDonationQrCode()"
                    alt="智灵鸟科技公众号二维码"
                    class="welcome-support-qr"
                    loading="lazy"
                    decoding="async"
                    @error="handleDonationQrCodeError('follow')"
                  />
                </div>
                <span class="message-skill-empty-qr-label">关注我们的微信公众号</span>
              </div>
            </div>
          </div>
          <div v-else class="assistant-recommend-modal-list">
            <div
              v-for="item in assistantRecommendModalItems"
              :key="`recommend-modal-${item.key}`"
              class="assistant-recommend-modal-card"
            >
              <div class="assistant-recommend-modal-main">
                <div class="assistant-recommend-modal-icon">
                  <img
                    v-if="isImageIcon(item.icon)"
                    :src="resolveIconUrl(item.icon)"
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                  <span v-else>{{ item.icon || '🧠' }}</span>
                </div>
                <div class="assistant-recommend-modal-text">
                  <div class="assistant-recommend-modal-name-row">
                    <div class="assistant-recommend-modal-name">{{ item.shortLabel || item.label }}</div>
                    <span v-if="item.reasonText" class="assistant-recommend-modal-badge">{{ item.reasonText }}</span>
                  </div>
                  <div class="assistant-recommend-modal-desc">{{ item.description || '暂无介绍' }}</div>
                </div>
              </div>
              <div class="assistant-recommend-modal-actions">
                <button type="button" class="assistant-recommend-run-btn" @click="runRecommendedAssistant(item)">执行</button>
                <button type="button" class="assistant-recommend-window-btn" @click="openRecommendedAssistantWindow(item)">窗口</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 插入内容确认弹窗：可编辑，点击确定后插入 -->
    <div v-if="showInsertModal" class="insert-modal-overlay" @click.self="showInsertModal = false">
      <div class="insert-modal">
        <div class="insert-modal-header">
          <h4>{{ getInsertModalTitle() }}</h4>
          <button type="button" class="btn-close-modal" @click="showInsertModal = false">×</button>
        </div>
        <div class="insert-modal-body">
          <textarea v-model="insertModalContent" class="insert-modal-textarea" placeholder="可在此修改要插入的内容..." rows="12"></textarea>
        </div>
        <div class="insert-modal-footer">
          <button type="button" class="btn-modal-cancel" @click="showInsertModal = false">取消</button>
          <button type="button" class="btn-modal-confirm" @click="confirmInsert">{{ getInsertModalTitle() }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import JSZip from 'jszip'
import { chatCompletion, streamChatCompletion } from '../utils/chatApi.js'
import { getModelGroupsFromSettings, setDefaultModelId } from '../utils/modelSettings.js'
import { getModelLogoPath } from '../utils/modelLogos.js'
import { publicAssetUrl } from '../utils/publicAssetUrl.js'
import { reportError } from '../utils/reportError.js'
/** 工具栏 SVG 用 Vite ?inline 打进 data: URL；头像 PNG 用预生成模块避免产物再拆出独立 png 请求 */
import logoAvatarDataUrl from '../assets/ai-assistant/logoAvatarDataUrl.js'
import chatAttachSvgInline from '../assets/ai-assistant/chat-attach.svg?inline'
import chatSelectionSvgInline from '../assets/ai-assistant/chat-selection.svg?inline'
import chatSendSvgInline from '../assets/ai-assistant/chat-send.svg?inline'
import chatToggleSvgInline from '../assets/ai-assistant/chat-toggle.svg?inline'

const AI_DIALOG_ASSETS_INLINE = {
  logo: logoAvatarDataUrl,
  chatAttach: chatAttachSvgInline,
  chatSelection: chatSelectionSvgInline,
  chatSend: chatSendSvgInline,
  chatToggle: chatToggleSvgInline
}
import {
  MODEL_TYPE_CHAT,
  MODEL_TYPE_IMAGE_GENERATION,
  MODEL_TYPE_VIDEO_GENERATION,
  MODEL_TYPE_TTS
} from '../utils/modelTypeUtils.js'
import { applyDocumentAction, getActiveDocument, getDocumentText, resolveDocumentInput, textLooksLikePlanStatsJson } from '../utils/documentActions.js'
import { prepareDialogDisplayText } from '../utils/dialogTextDisplay.js'
import { resolveDocumentTaskInputScope } from '../utils/documentTaskScope.js'
import {
  clearDocumentFormatPreview,
  createDocumentFormatPreview,
  executeDocumentFormatAction,
  normalizeDocumentFormatIntent,
  previewDocumentFormatMatches
} from '../utils/documentFormatActions.js'
import {
  createDocumentDeletePreview,
  executeDocumentDeleteAction,
  normalizeDocumentDeleteIntent
} from '../utils/documentDeleteActions.js'
import {
  createDocumentTextEditPreview,
  executeDocumentTextEditAction,
  normalizeDocumentTextEditIntent
} from '../utils/documentTextEditActions.js'
import {
  createDocumentRelocationPreview,
  executeDocumentRelocationAction,
  normalizeDocumentRelocationIntent
} from '../utils/documentRelocationActions.js'
import { buildSelectionContextPrompt, getSelectionContextSnapshot } from '../utils/documentContext.js'
import {
  getAssistantSettingItems,
  getAssistantGroupLabel,
  getBuiltinAssistantDefinition,
  getDocumentActionOptions,
  INPUT_SOURCE_OPTIONS,
  DOCUMENT_ACTION_OPTIONS
} from '../utils/assistantRegistry.js'
import {
  loadAssistantSettings,
  getAssistantSetting,
  getCustomAssistants,
  getCustomAssistantById,
  saveCustomAssistants,
  createCustomAssistantDraft,
  buildCustomAssistantId
} from '../utils/assistantSettings.js'
import {
  appendAssistantVersion,
  getLatestAssistantVersion,
  listAssistantVersions,
  listAssistantVersionFamily,
  promoteAssistantVersion,
  restoreAssistantVersion
} from '../utils/assistantVersionStore.js'
import { buildAssistantCapabilityFingerprint, buildAssistantEvaluationSamples, buildAssistantRealComparison, evaluateAssistantCandidate } from '../utils/assistantEvaluationService.js'
import { buildAssistantRepairDraft } from '../utils/assistantRepairService.js'
import { applyAssistantTaskPlan, getAssistantLaunchInfo, startAssistantTask, stopAssistantTask } from '../utils/assistantTaskRunner.js'
import { startAssistantPromptRecommendationTask, stopAssistantPromptRecommendationTask } from '../utils/assistantPromptRecommendationService.js'
import { startDocumentCommentTask, stopDocumentCommentTask, undoDocumentCommentTask } from '../utils/documentCommentService.js'
import { initSync as initTaskListSync, subscribe as subscribeTaskList, getTaskById, updateTask } from '../utils/taskListStore.js'
import { exportDocumentImagesAsAssets } from '../utils/documentImageExportService.js'
import { exportDocumentEmbeddedObjects } from '../utils/documentEmbeddedObjectService.js'
import { createAIAssistantWindowSession } from '../utils/aiAssistantWindowManager.js'
import { openSettingsWindow } from '../utils/settingsWindowManager.js'
import { DEFAULT_TASK_LIST_WINDOW_HEIGHT, DEFAULT_TASK_LIST_WINDOW_WIDTH, focusExistingTaskListWindow } from '../utils/taskListWindowManager.js'
import { startMultimodalTask, stopMultimodalTask } from '../utils/multimodalTaskRunner.js'
import { extractStructuredAttachmentText, isStructuredTextAttachment } from '../utils/attachmentTextParser.js'
import { isRecognizableMultimodalAttachment, recognizeMultimodalAttachment } from '../utils/multimodalRecognitionRunner.js'
import { getRandomWelcomePrompt } from '../utils/aiAssistantWelcomePrompts.js'
import { buildRandomAssistantSelfIntro, isAssistantIdentityQuestion, resolveAssistantLocalFaq } from '../utils/aiAssistantSelfIntro.js'
import { saveAssistantPrefillDraft } from '../utils/assistantPrefillDraftStore.js'
import { resolveWpsCapabilityRoute } from '../utils/wpsCapabilityRouter.js'
import { getWpsCapabilityByKey } from '../utils/wpsCapabilityCatalog.js'
import { startWpsCapabilityTask, stopWpsCapabilityTask } from '../utils/wpsCapabilityExecutor.js'
import { getCurrentDocumentSavePath } from '../utils/documentFileActions.js'
import { canCreateDocumentBackup, createDocumentBackupRecord, restoreDocumentBackupRecordById } from '../utils/documentBackupStore.js'
import { REPORT_TYPE_OPTIONS, getReportTypeLabel, createDefaultReportSettings, normalizeReportSettings } from '../utils/reportSettings.js'
import { getReportAssistantPresetGroups, buildReportAssistantPresetDraft } from '../utils/reportAssistantPresets.js'
import { buildReportDraftWithModel } from '../utils/reportDraftBuilder.js'
import { createRenderedArtifact } from '../utils/artifactRenderer.js'
import { createArtifactRecord } from '../utils/artifactTypes.js'
import { bindArtifactsToOwner } from '../utils/artifactStore.js'
import { getCapabilityBusItem } from '../utils/capabilityBus.js'
import { appendEvaluationRecord, buildChatEvaluationRecord } from '../utils/evaluationStore.js'
import { appendChatMemoryRecord } from '../utils/chatMemoryStore.js'
import { createThrottledPersister } from '../utils/throttledPersist.js'
import { record as recordPerf } from '../utils/perfTracker.js'
import {
  getCachedModelRouteIntent,
  resolveLocalIntentShortcut,
  setCachedModelRouteIntent
} from '../services/sendPipeline/intentRouter.js'
import { buildChatFlowRequestContext } from '../services/sendPipeline/chatFlow.js'
import { readCurrentDocumentPayload } from '../services/documentIntelligence/documentReader.js'
import { planTextChunks } from '../services/documentIntelligence/chunkPlanner.js'
import { resolveExactToolRequest } from '../services/documentIntelligence/exactTools.js'
import LongTaskRunCard from './LongTaskRunCard.vue'
const STORAGE_KEY_HISTORY = 'ai_assistant_chat_history'
const STORAGE_KEY_CURRENT = 'ai_assistant_current_chat_id'
const STORAGE_KEY_DOC_CHAT_LINK_ID = 'chayuan_ai_chat_link_id'
const STORAGE_KEY_HISTORY_SCOPE_PREFIX = 'ai_assistant_chat_history_scope'
const STORAGE_KEY_CURRENT_SCOPE_PREFIX = 'ai_assistant_current_chat_id_scope'
const STORAGE_KEY_LEGACY_HISTORY_MIGRATED = 'ai_assistant_chat_history_legacy_migrated'
const STORAGE_KEY_SELECTED_ID = 'ai_assistant_selected_model_id'
const STORAGE_KEY_SELECTED_CONTENT = 'assistant_selected_content'
const STORAGE_KEY_SELECTED_CONTEXT = 'assistant_selected_context'
const STORAGE_KEY_WELCOME_PROMPT_INDEX = 'ai_assistant_welcome_prompt_index'
const STORAGE_KEY_SIDEBAR_WIDTH = 'ai_assistant_sidebar_width'
const STORAGE_KEY_SIDEBAR_COLLAPSED = 'ai_assistant_sidebar_collapsed'
const DONATION_FOLLOW_QR_CODE = 'images/pay/follow.png'
const DONATION_WECHAT_QR_CODE = 'images/pay/wxpay.png'
const DONATION_ALIPAY_QR_CODE = 'images/pay/alipay.png'
const SIDEBAR_MIN_WIDTH = 240
const SIDEBAR_MAX_WIDTH_FALLBACK = 460
const MAIN_AREA_MIN_WIDTH = 420

const TRANSLATION_TARGET_LANGUAGE_RULES = [
  { label: '英文', pattern: /(英文|英语|english)/i },
  { label: '中文', pattern: /(中文|汉语|chinese)/i },
  { label: '日文', pattern: /(日文|日语|japanese)/i },
  { label: '韩文', pattern: /(韩文|韩语|korean)/i },
  { label: '法文', pattern: /(法文|法语|french)/i },
  { label: '德文', pattern: /(德文|德语|german)/i }
]

const ACTIVE_DOCUMENT_REFERENCE_PATTERN = /(我选中的|选中的|当前选中|当前内容|这段|这一段|这个段落|当前段落|本段|鼠标所在|光标所在|当前位置)/
const FULL_DOCUMENT_REFERENCE_PATTERN = /(全文|全篇|整篇|整份|整个文档|当前文档|这份文档|文档全文|整篇文章|整篇材料|整份材料)/
const DOCUMENT_KEYWORD_PATTERN = /(文档|材料|文章|全文)/
const DOCUMENT_ACTION_PATTERN = /(翻译|译成|翻成|总结|摘要|概括|提炼|分析|解读|润色|改写|重写|校对|检查|审查|生成|整理|输出|处理|扩展|扩充|展开|丰富|续写|扩写|补充|延伸|细化|写详细|写完整|详细描述|详细内容|review|review一下)/
const DOCUMENT_FORMAT_TRIGGER_PATTERN = /(搜索|查找|匹配|加粗|粗体|字体|字号|字色|颜色|背景色|高亮|行间距|下划线|斜体|宋体|黑体|仿宋|楷体|微软雅黑|arial|times|calibri|标红|红字|蓝字|绿字|黄字|五号|小四|小五|六号|标题|正文|表格|单元格)/i
const DOCUMENT_DELETE_TRIGGER_PATTERN = /(删除|删掉|移除|去掉|清空|清除)/
const DOCUMENT_DELETE_TARGET_PATTERN = /(选中|选区|当前选择|所选|当前段落|本段|这段|这一段|全文|全篇|整个文档|当前文档|当前表格|这个表格|该表格|所在表格|全部表格|所有表格|当前图片|这张图片|该图片|所在图片|全部图片|所有图片|全部图像|所有图像|当前批注|这个批注|该批注|所在批注|全部批注|所有批注|表格|图片|图像|配图|插图|批注|注释|第\s*[一二三四五六七八九十两\d]+\s*段)/
const DOCUMENT_TEXT_EDIT_TRIGGER_PATTERN = /(替换|改成|改为|换成).{0,60}|(?:删除|删掉|移除|去掉).{0,40}(关键词|关键字|字样|文本|内容|段落|[“"'《]|中|里|所在)/
const DOCUMENT_RELOCATION_TRIGGER_PATTERN = /(移动到|移动至|移到|移至|挪到|挪至|复制到|复制至|拷贝到|拷贝至|复制.*到|拷贝.*到)/
const DOCUMENT_REVISION_TRIGGER_PATTERN = /(修正|修改|改正|纠正|校正|修订|改写|润色|优化|检查|查查|校对|审校|筛查).{0,40}(错别字|病句|语法|标点|歧义|不清|不明确|不准确|不正确|有误|错误|问题|文字|表述|描述|文章|文档|内容|书写|文笔)|(?:错别字|病句|语法|标点|歧义|不清|不明确|不准确|不正确|有误|错误|问题).{0,24}(修正|修改|改正|纠正|校正|修订|改写|润色|优化|检查|校对|审校)|更正式|更通顺|统一术语|统一称谓|统一简称|(?:书写|文笔|措辞|用词).{0,32}(检查|校对|审校|筛查)|(?:检查|校对|审校|筛查).{0,32}(书写|文笔|措辞|用词)/
const DOCUMENT_OPERATION_ROUTER_TRIGGER_PATTERN = /(修正|修改|改正|纠正|校正|修订|润色|优化|删除|替换|移动|复制|批注|批示|评论|导出|提取|翻译|总结|分析|格式|加粗|标红|统一术语|歧义|错误|问题|文章|文档|全文|段落|表格|图片|批注|扩展|扩充|展开|丰富|续写|扩写|补充|延伸|细化|章节|详细|脱密|脱敏|涉密|去标识|敏感词|占位符|密码复原|复原原文)/
const MAX_ATTACHMENT_COUNT = 5
const MAX_ATTACHMENT_FILE_SIZE = 5 * 1024 * 1024
const MAX_ATTACHMENT_TEXT_LENGTH = 12000
const DIRECT_DOCUMENT_CHAR_LIMIT = 12000
const STYLE_COLOR_VALUE_PATTERN = '(?:#[0-9a-fA-F]{6}|黑色|白色|红色|蓝色|绿色|黄色|橙色|紫色|灰色|黑|白|红|蓝|绿|黄|橙|紫|灰)'
const CHINESE_FONT_SIZE_MAP = {
  初号: 42,
  小初: 36,
  一号: 26,
  小一: 24,
  二号: 22,
  小二: 18,
  三号: 16,
  小三: 15,
  四号: 14,
  小四: 12,
  五号: 10.5,
  小五: 9,
  六号: 7.5,
  小六: 6.5,
  七号: 5.5,
  八号: 5
}
const TARGET_SELECTOR_PATTERNS = [
  { pattern: /(标题一|一级标题|1级标题|heading\s*1)/i, selector: { kind: 'heading', level: 1 } },
  { pattern: /(标题二|二级标题|2级标题|heading\s*2)/i, selector: { kind: 'heading', level: 2 } },
  { pattern: /(标题三|三级标题|3级标题|heading\s*3)/i, selector: { kind: 'heading', level: 3 } },
  { pattern: /(标题四|四级标题|4级标题|heading\s*4)/i, selector: { kind: 'heading', level: 4 } },
  { pattern: /(标题五|五级标题|5级标题|heading\s*5)/i, selector: { kind: 'heading', level: 5 } },
  { pattern: /(标题六|六级标题|6级标题|heading\s*6)/i, selector: { kind: 'heading', level: 6 } },
  { pattern: /(所有标题|全部标题|各级标题|标题样式|标题格式)/i, selector: { kind: 'heading' } },
  { pattern: /(正文段落|正文内容|正文文字|正文)/i, selector: { kind: 'body' } },
  { pattern: /(表格单元格|所有单元格|单元格内容|单元格)/i, selector: { kind: 'table-cell' } },
  { pattern: /(所有表格|表格内容|表格)/i, selector: { kind: 'table' } }
]
const GENERATED_OUTPUT_TRIGGER_PATTERN = /(报告|总结|纪要|周报|月报|年报|调研|模板|json|JSON|csv|CSV|excel|Excel|xlsx|XLSX|表格|文件|附件|导出|下载|图片|图像|配图|插图|海报|视频|语音|音频|朗读|播报)/
const REPORT_REQUEST_PATTERN = /(报告|简报|总结|纪要|周报|月报|年报|调研报告|分析报告|审查报告|汇报材料|关键词报告|情况报告|研究报告|生成报告|起草)/
const REPORT_TEMPLATE_PATTERN = /(模板|参考附件|参考附[件录]|按附件|参照附件|模板请参考附件|根据附件)/
const JSON_REQUEST_PATTERN = /(^|[\s，。；、:(（【])json([\s，。；、:)}）】]|$)|\.json|JSON/
const CSV_REQUEST_PATTERN = /(^|[\s，。；、:(（【])csv([\s，。；、:)}）】]|$)|\.csv|CSV|excel|Excel|xlsx|XLSX|表格/
const TEXT_FILE_REQUEST_PATTERN = /(^|[\s，。；、:(（【])txt([\s，。；、:)}）】]|$)|\.txt|TXT|文本文件|纯文本文件/
const EXTRACTION_REQUEST_PATTERN = /(提炼|提取|抽取|整理|汇总|导出|输出|生成|形成|归纳)/
const FILE_EXPORT_REQUEST_PATTERN = /(表格|excel|Excel|xlsx|XLSX|csv|CSV|文件|附件|下载)/
const IMAGE_EXTRACTION_REQUEST_PATTERN = /((提炼|提取|抽取|整理).{0,8}(图像|图片|配图|插图))|((图像|图片|配图|插图).{0,8}(提炼|提取|抽取|整理))/
const DOCUMENT_IMAGE_EXPORT_REQUEST_PATTERN = /((导出|提取|抽取|下载|另存为|保存).{0,10}(文档|全文|文章|材料).{0,6}(图片|图像|配图|插图))|((文档|全文|文章|材料).{0,10}(图片|图像|配图|插图).{0,10}(导出|提取|抽取|下载|另存为|保存))|((导出|提取|抽取|下载|另存为|保存).{0,8}(图片|图像|配图|插图))/i
const DOCUMENT_OBJECT_EXPORT_REQUEST_PATTERN = /((导出|提取|抽取|下载|另存为|保存).{0,12}(附件|文件|对象|嵌入文件|内嵌文件|OLE|对象附件))|((附件|文件|对象|嵌入文件|内嵌文件|OLE).{0,12}(导出|提取|抽取|下载|另存为|保存))/i
const REPORT_FILE_REQUEST_PATTERN = /(报告|总结|简报|纪要|汇报材料|研究报告|分析报告|审查报告|周报|月报|年报|调研报告|起草|写一份|做一份)/
const IMAGE_REQUEST_PATTERN = /((生成|输出|制作|画|做|创建).{0,10}(图片|图像|配图|插图|海报))|((图片|图像|配图|插图|海报).{0,10}(生成|输出|制作|创建))/
const VIDEO_REQUEST_PATTERN = /((生成|输出|制作|创建).{0,10}(视频|短片|短视频))|((视频|短片|短视频).{0,10}(生成|输出|制作|创建))/
const AUDIO_REQUEST_PATTERN = /((生成|输出|制作|创建|转换|朗读|播报).{0,10}(语音|音频|配音))|((语音|音频|配音|朗读|播报).{0,10}(生成|输出|制作|创建|转换))/
const EXPLICIT_ASSISTANT_REQUEST_PATTERN = /(助手|智能助手|自定义助手|调用助手|创建助手|生成助手|用.+助手|使用.+助手|按.+助手)/
const DIRECT_CHAT_REQUEST_PATTERN = /(写一首|写首|作一首|作首|写一段|写篇|写个|帮我写|给我写|诗歌|诗|散文|故事|小说|文案|祝福语|祝福词|朋友圈文案|解释一下|解释下|什么是|为什么|聊聊|说说|头脑风暴|想几个|给我几个|帮我想|回答我)/
const PROMPT_ONLY_CREATION_PATTERN = /(帮我|请|给我|麻烦)?\s*(写|撰写|起草|创作|生成|输出|制作|列出|设计).{0,40}(教程|指南|说明|手册|文档|文章|方案|计划|提纲|大纲|模板|报告|材料|内容)|(?:教程|指南|说明|手册).{0,16}(写出来|生成|输出|怎么写|如何写)/
const EXISTING_DOCUMENT_MATERIAL_PATTERN = /(基于|根据|依据|参考|结合|围绕|针对|对|把|将|总结|摘要|概括|提炼|分析|解读|翻译|润色|改写|校对|检查|审查|提取|统计|查找|批注|脱密|修订|修改|删除|替换).{0,16}(当前文档|这份文档|这个文档|全文|全篇|整篇|文档全文|选中|选区|这段|本段)/

const MISSING_SKILL_CHAT_NOTICE_VARIANTS = [
  '欢迎关注我们的微信公众号，便于随时提需求，帮助我持续进化成你想要的样子。',
  '可以关注我们的微信公众号来提需求，你的反馈会帮助我一步步进化成你想要的样子。',
  '欢迎关注我们的微信公众号，提需求会更方便，也能帮助我更快进化成你想要的样子。',
  '关注我们的微信公众号，把你想要的能力告诉我，我会朝着你期待的样子持续进化。',
  '如果你有新的技能需求，欢迎关注我们的微信公众号告诉我们，帮助我自动进化成你想要的样子。'
]

const MISSING_SKILL_MODAL_NOTICE_VARIANTS = [
  '欢迎关注我们的微信公众号提交需求，我们会持续完善能力，帮助我进化成更接近你期待的样子。',
  '如果你有新的技能需求，欢迎通过我们的微信公众号反馈，帮助我逐步进化成你想要的样子。',
  '关注我们的微信公众号后，提需求会更直接，你的反馈也会帮助我持续自动进化。',
  '欢迎关注我们的微信公众号告诉我们你想要的新能力，这会帮助我更快成长为你需要的样子。',
  '你可以通过我们的微信公众号提出技能需求，你的每一次反馈，都会帮助我向你想要的方向继续进化。'
]

const WELCOME_ENTRY_ANIMATION_VARIANTS = [
  'meteor-drop',
  'orbital-swing',
  'galaxy-flip',
  'nebula-slide',
  'gravity-bounce',
  'warp-zoom',
  'cosmic-tilt',
  'satellite-arc',
  'starfall-fold',
  'prism-descend'
]

const WELCOME_EXIT_ANIMATION_VARIANTS = [
  'bird-soar',
  'sky-pop',
  'comet-escape',
  'feather-drift',
  'spiral-lift',
  'warp-fold',
  'rocket-rise',
  'aurora-swerve',
  'stardust-burst',
  'spring-fling'
]

const USER_MESSAGE_ENTRY_ANIMATION_VARIANTS = [
  'bird-pop',
  'wing-rise',
  'comet-bubble',
  'spring-burst',
  'sky-hop'
]

const ASSISTANT_MESSAGE_ENTRY_ANIMATION_VARIANTS = [
  'glide-in',
  'nebula-drop',
  'halo-settle',
  'orbit-arrive',
  'feather-float'
]

function pickRandomVariant(variants = [], previous = '') {
  const candidateList = Array.isArray(variants) ? variants.filter(Boolean) : []
  if (candidateList.length === 0) return ''
  if (candidateList.length === 1) return candidateList[0]
  const filtered = previous ? candidateList.filter(item => item !== previous) : candidateList
  const nextList = filtered.length > 0 ? filtered : candidateList
  return nextList[Math.floor(Math.random() * nextList.length)] || nextList[0]
}

function createAttachmentId() {
  return `attachment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function createGeneratedFileId() {
  return `generated_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function formatAttachmentSize(size) {
  const value = Number(size || 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function sanitizeDownloadFileName(name, fallback = '生成结果') {
  const value = String(name || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return value || fallback
}

function resolveChineseFontSizeLabel(text) {
  const raw = String(text || '').trim()
  if (!raw) return ''
  return CHINESE_FONT_SIZE_MAP[raw] != null ? String(CHINESE_FONT_SIZE_MAP[raw]) : ''
}

function cleanDocumentFormatSearchText(value) {
  let text = String(value || '').trim()
  if (!text) return ''
  text = text
    .replace(/^[“"'《]+/, '')
    .replace(/[”"'》]+$/, '')
    .replace(/[“”"'《》]/g, '')
    .trim()
  const prefixPatterns = [
    /^(?:全文|全篇|整个文档|当前文档|文档|这份文档|整篇文章|整篇材料|整份材料)(?:中|里)?(?:所有|全部)?的?/,
    /^(?:全文|全篇|整个文档|当前文档|文档|这份文档)(?:中|里)/,
    /^(?:所有|全部|其中所有|里面所有|文中所有|文档中所有|文档里所有)的?/,
    /^(?:当前段落|本段|这段|这一段|当前选中|选中的|所选|选区)(?:中|里)?(?:所有|全部)?的?/
  ]
  prefixPatterns.forEach((pattern) => {
    text = text.replace(pattern, '').trim()
  })
  text = text
    .replace(/^(?:关于|有关|其中|里面|中的|里的)/, '')
    .replace(/[，。；、,:：]+$/, '')
    .trim()
  return text
}

function inferDocumentFormatTargetSelector(text) {
  const normalized = String(text || '').trim()
  if (!normalized) return null
  const matched = TARGET_SELECTOR_PATTERNS.find(item => item.pattern.test(normalized))
  return matched ? { ...matched.selector } : null
}

function isTextLikeAttachment(file) {
  const type = String(file?.type || '').toLowerCase()
  const name = String(file?.name || '').toLowerCase()
  if (type.startsWith('text/')) return true
  return /\.(txt|md|markdown|json|csv|tsv|js|ts|jsx|tsx|vue|html|htm|xml|yaml|yml|log|ini|cfg)$/i.test(name)
}

function normalizeAttachmentLookupText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

function parseChineseNumberToken(rawValue) {
  const token = String(rawValue || '').trim()
  if (!token) return NaN
  if (/^\d+$/.test(token)) return Number(token)
  const normalized = token.replace(/两/g, '二')
  const directMap = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10
  }
  if (directMap[normalized] != null) return directMap[normalized]
  if (/^十[一二三四五六七八九]$/.test(normalized)) {
    return 10 + directMap[normalized.slice(1)]
  }
  if (/^[一二三四五六七八九]十$/.test(normalized)) {
    return directMap[normalized[0]] * 10
  }
  if (/^[一二三四五六七八九]十[一二三四五六七八九]$/.test(normalized)) {
    return directMap[normalized[0]] * 10 + directMap[normalized[2]]
  }
  return NaN
}

function readBrowserFileAsText(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('文件不存在'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsText(file, 'utf-8')
  })
}

function interpolateAssistantTemplate(template, variables) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = variables[key]
    return value == null ? '' : String(value)
  })
}

function safeParsePluginJson(raw) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (_) {
    return null
  }
}

function createScopedStorageSuffix(value) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return 'default'
  return text.replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120) || 'default'
}

function buildRandomDocumentChatLinkId() {
  return `docchat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function readDocumentVariable(doc, variableName) {
  if (!doc?.Variables || !variableName) return ''
  try {
    const variable = doc.Variables.Item(variableName)
    return String(variable?.Value || '').trim()
  } catch (_) {
    return ''
  }
}

function writeDocumentVariable(doc, variableName, value) {
  if (!doc?.Variables || !variableName) return false
  const normalizedValue = String(value || '').trim()
  if (!normalizedValue) return false
  try {
    const variable = doc.Variables.Item(variableName)
    if (variable) {
      variable.Value = normalizedValue
      return true
    }
  } catch (_) {
    // Fall through to create the variable when it does not exist.
  }
  try {
    doc.Variables.Add(variableName, normalizedValue)
    return true
  } catch (_) {
    return false
  }
}

function ensureDocumentChatLinkId(doc) {
  const existing = readDocumentVariable(doc, STORAGE_KEY_DOC_CHAT_LINK_ID)
  if (existing) return existing
  const created = buildRandomDocumentChatLinkId()
  return writeDocumentVariable(doc, STORAGE_KEY_DOC_CHAT_LINK_ID, created) ? created : ''
}

function resolveTranslationTargetLanguage(text, fallback = '英文') {
  const sourceText = String(text || '')
  const matched = TRANSLATION_TARGET_LANGUAGE_RULES.find(item => item.pattern.test(sourceText))
  return matched?.label || fallback
}

function detectSelectionTranslateIntent(text, fallbackLanguage = '英文') {
  const normalized = String(text || '').trim()
  if (!normalized) return null
  if (FULL_DOCUMENT_REFERENCE_PATTERN.test(normalized)) return null
  const containsTranslateVerb = /(翻译|译成|翻成|中译英|英译中)/.test(normalized)
  if (!containsTranslateVerb) return null
  const hasExplicitTargetLanguage = TRANSLATION_TARGET_LANGUAGE_RULES.some(item => item.pattern.test(normalized))
  const hasDirectionPhrase = /(中译英|英译中|翻译成|翻译为|译成|译为|翻成|翻为)/.test(normalized)
  if (!hasExplicitTargetLanguage && !hasDirectionPhrase) return null
  const targetLanguage = resolveTranslationTargetLanguage(normalized, fallbackLanguage)
  const explicitReference = ACTIVE_DOCUMENT_REFERENCE_PATTERN.test(normalized)
  const shortCommand = normalized.length <= 24 && !/\n/.test(normalized)
  if (!explicitReference && !shortCommand) return null
  return {
    targetLanguage
  }
}

function isPromptOnlyCreationRequest(text) {
  const normalized = String(text || '').trim()
  if (!normalized) return false
  return PROMPT_ONLY_CREATION_PATTERN.test(normalized) &&
    !EXISTING_DOCUMENT_MATERIAL_PATTERN.test(normalized)
}

function detectDocumentScopeIntent(text) {
  const normalized = String(text || '').trim()
  if (!normalized) return null
  if (ACTIVE_DOCUMENT_REFERENCE_PATTERN.test(normalized)) return null
  if (isPromptOnlyCreationRequest(normalized)) return null
  if (FULL_DOCUMENT_REFERENCE_PATTERN.test(normalized)) {
    return {
      targetLanguage: resolveTranslationTargetLanguage(normalized, '英文')
    }
  }
  if (DOCUMENT_KEYWORD_PATTERN.test(normalized) && DOCUMENT_ACTION_PATTERN.test(normalized)) {
    return {
      targetLanguage: resolveTranslationTargetLanguage(normalized, '英文')
    }
  }
  return null
}

function detectDocumentCommentIntent(text) {
  const normalized = String(text || '').trim()
  if (!normalized) return null
  if (!/(批注|注释)/.test(normalized)) return null
  if (/(批注解释|解释批注|解释这.*批注|这个批注.*什么意思|comment explain)/i.test(normalized)) {
    return null
  }
  const hasCommentVerb = /(添加|加上|加个|写上|插入|标上|加为|做成|改成|生成|补上|写入|打上).{0,4}(批注|注释)|(批注|注释).{0,4}(添加|加上|写上|插入|标上|写入|出来|一下|下|标出|标记)|批注一下|加批注|做批注|批注出来|注释出来/.test(normalized)
  const hasBatchTarget = /(全文|全篇|整篇|文章|文档|选中|选区|这段|本段|当前选择|当前选中|段落|句子|文字|文本|内容)/.test(normalized)
  const hasCriteria = /(有.+?(段落|句子|文字|文本|内容)|包含.+?(段落|句子|文字|文本|内容)|出现.+?(段落|句子|文字|文本|内容)|涉及.+?(段落|句子|文字|文本|内容)|命中|找出|筛出|定位)/.test(normalized)
  const hasCommentAliasTarget = /(国家名(?:称)?|国家地区名(?:称)?|国家和地区(?:名(?:称)?)?|国别(?:名称|信息)?|国名)/.test(normalized)
  const isShortDirectCommentCommand = normalized.length <= 28 &&
    !/[？?]/.test(normalized) &&
    (
      /^(请|请帮我|帮我|麻烦|需要)?\s*(批注|注释)/.test(normalized) ||
      /(?:批注|注释).{1,24}$/.test(normalized) ||
      /^(请|请帮我|帮我|麻烦)?\s*(把|将)?[^，。！？?]{1,24}(?:批注|注释)(?:一下)?$/.test(normalized)
    )
  if (!hasCommentVerb && !hasCriteria && !isShortDirectCommentCommand && !hasCommentAliasTarget) return null
  const scope = FULL_DOCUMENT_REFERENCE_PATTERN.test(normalized) || /(全篇|整篇|全文|文章|文档)/.test(normalized)
    ? 'document'
    : ACTIVE_DOCUMENT_REFERENCE_PATTERN.test(normalized) || /(选中|选区|这段|本段|当前选择|当前选中)/.test(normalized)
      ? 'selection'
      : 'document'
  if (!hasBatchTarget && !hasCriteria && !isShortDirectCommentCommand && !hasCommentAliasTarget && scope !== 'selection') return null
  return {
    scope
  }
}

function detectDeleteParagraphIndex(text) {
  const normalized = String(text || '').trim()
  const matched = normalized.match(/第\s*([一二三四五六七八九十两\d]+)\s*段/)
  if (!matched?.[1]) return null
  const index = parseChineseNumberToken(matched[1])
  return Number.isFinite(index) && index > 0 ? index : null
}

function cleanDocumentKeywordText(value) {
  let text = String(value || '').trim()
  if (!text) return ''
  text = text
    .replace(/^[“"'《]+/, '')
    .replace(/[”"'》]+$/, '')
    .trim()
  text = text
    .replace(/^(?:全文|全篇|整个文档|当前文档|文档|这份文档|当前段落|本段|这段|这一段|当前选中|选中的|所选|选区)(?:中|里)?(?:所有|全部)?的?/, '')
    .replace(/^(?:包含|含有|有|出现|提到)/, '')
    .replace(/^(?:关键词|关键字|字样|文本|内容)/, '')
    .replace(/(?:所在的段落|所在段落|的段落|段落)$/g, '')
    .replace(/[，。；、,:：]+$/, '')
    .trim()
  return text
}

function cleanQuotedCommandText(value) {
  return String(value || '')
    .trim()
    .replace(/^[“"'《]+/, '')
    .replace(/[”"'》]+$/, '')
    .trim()
}

function extractKeywordListFromText(value) {
  const cleaned = cleanDocumentKeywordText(value)
  if (!cleaned) return []
  const parts = cleaned
    .split(/\s*(?:和|及|并且|并|以及|、|,|，)\s*/)
    .map(item => cleanDocumentKeywordText(item))
    .filter(Boolean)
  return parts.length > 0 ? Array.from(new Set(parts)) : [cleaned]
}

function parseTargetModeFromText(value) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return {
      targetMode: 'all',
      limitCount: null
    }
  }
  const firstCountMatch = normalized.match(/前\s*([一二三四五六七八九十两\d]+)\s*个?/)
  if (firstCountMatch?.[1]) {
    const count = parseChineseNumberToken(firstCountMatch[1])
    if (Number.isFinite(count) && count > 0) {
      return {
        targetMode: 'first',
        limitCount: count
      }
    }
  }
  const lastCountMatch = normalized.match(/后\s*([一二三四五六七八九十两\d]+)\s*个?/)
  if (lastCountMatch?.[1]) {
    const count = parseChineseNumberToken(lastCountMatch[1])
    if (Number.isFinite(count) && count > 0) {
      return {
        targetMode: 'last',
        limitCount: count
      }
    }
  }
  if (/(第一个|首个|第1个|首段)/.test(normalized)) {
    return {
      targetMode: 'first',
      limitCount: 1
    }
  }
  if (/(最后一个|最后1个|末个)/.test(normalized)) {
    return {
      targetMode: 'last',
      limitCount: 1
    }
  }
  return {
    targetMode: 'all',
    limitCount: null
  }
}

function parseKeywordRelationFromText(value) {
  const normalized = String(value || '').trim()
  return /(同时包含|都包含|并且包含|且包含|和.*和|及)/.test(normalized) ? 'all' : 'any'
}

function parseRelocationPlaceholderText(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return ''
  const matched = normalized.match(
    /(?:原(?:位置|处)(?:替换为|改为|保留为)|替换原(?:位置|处)为|在原(?:位置|处)保留)\s*[“"'《]?([^“”"'《》\n]+)[”"'》]?/i
  )
  return cleanQuotedCommandText(matched?.[1] || '')
}

function parseRelocationPreserveFormatting(value) {
  const normalized = String(value || '').trim()
  if (/(纯文本|不要格式|不保留格式|去掉格式|仅文本|只保留文字)/.test(normalized)) return false
  if (/(保留格式|保持格式|保留原格式|保持原格式|连同格式|带格式)/.test(normalized)) return true
  return true
}

function trimRelocationDestinationText(value) {
  return String(value || '')
    .trim()
    .replace(/(?:[，,]\s*|(?:并|且)\s*)?(?:(?:在)?原(?:位置|处)|保留格式|保持格式|保留原格式|保持原格式|纯文本|不要格式|不保留格式).+$/i, '')
    .trim()
}

function toDocumentText(text) {
  return String(text || '').replace(/\r\n/g, '\r').replace(/\n/g, '\r')
}

function getCurrentParagraphRangeForRevision() {
  const selection = window.Application?.Selection || window.opener?.Application?.Selection || window.parent?.Application?.Selection
  try {
    if (selection?.Paragraphs?.Item?.(1)?.Range) return selection.Paragraphs.Item(1).Range
    if (selection?.Range?.Paragraphs?.Item?.(1)?.Range) return selection.Range.Paragraphs.Item(1).Range
  } catch (_) {
    return null
  }
  return null
}

function getSelectionRangeForRevision() {
  const selection = window.Application?.Selection || window.opener?.Application?.Selection || window.parent?.Application?.Selection
  try {
    return selection?.Range || null
  } catch (_) {
    return null
  }
}

function isDocumentTrackRevisionsEnabled() {
  const doc = getActiveDocument()
  try {
    return doc?.TrackRevisions === true
  } catch (_) {
    return false
  }
}

function enableDocumentTrackRevisions() {
  const doc = getActiveDocument()
  if (!doc) {
    return {
      ok: false,
      message: '当前没有打开文档，无法开启修订模式。'
    }
  }
  try {
    doc.TrackRevisions = true
  } catch (error) {
    return {
      ok: false,
      message: error?.message || '开启修订模式失败'
    }
  }
  try {
    if (typeof doc.ShowRevisions !== 'undefined') {
      doc.ShowRevisions = true
    }
  } catch (_) {}
  return {
    ok: isDocumentTrackRevisionsEnabled(),
    message: isDocumentTrackRevisionsEnabled()
      ? '已开启文档修订模式。'
      : '未能确认修订模式是否已开启，将按当前文档状态继续处理。'
  }
}

function duplicateDocumentRange(range) {
  if (!range) return null
  try {
    return typeof range.Duplicate === 'function' ? range.Duplicate() : range
  } catch (_) {
    return range
  }
}

function escapeRegexPattern(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function detectDocumentRevisionConstraints(text) {
  const normalized = String(text || '').trim()
  return {
    typoOnly: /(只改错别字|仅改错别字|只修正错别字|仅修正错别字)/.test(normalized),
    grammarOnly: /(只改病句|仅改病句|只改语病|仅改语病|只改语法|仅改语法)/.test(normalized),
    punctuationOnly: /(只改标点|仅改标点|只修正标点|仅修正标点)/.test(normalized),
    preserveWording: /(不改措辞|不要改措辞|不改变措辞|不改表达方式|不改变表达|只纠错不改写)/.test(normalized),
    preservePunctuation: /(不改标点|标点别改|不要改标点|不修改标点)/.test(normalized),
    preserveTone: /(不改语气|不要改语气|保持语气)/.test(normalized)
  }
}

function detectDocumentRevisionKeywordFilter(text) {
  const normalized = String(text || '').trim()
  if (!normalized || !/段落/.test(normalized)) return null
  const patterns = [
    /(?:只|仅)?(?:修改|修正|改正|纠正|优化|润色|改写|统一).{0,24}?(?:包含|含有|提到|涉及)\s*[“"'《]?([^“”"'《》\n]+)[”"'》]?\s*(?:的)?段落/i,
    /(?:只|仅)?(?:修改|修正|改正|纠正|优化|润色|改写|统一).{0,24}?[“"'《]?([^“”"'《》\n]+)[”"'》]?\s*所在的段落/i,
    /(?:包含|含有|提到|涉及)\s*[“"'《]?([^“”"'《》\n]+)[”"'》]?\s*(?:的)?段落(?:中|里)?/i
  ]
  for (const pattern of patterns) {
    const matched = normalized.match(pattern)
    if (!matched?.[1]) continue
    const keywordList = extractKeywordListFromText(matched[1])
    if (keywordList.length === 0) continue
    return {
      keywordList,
      keywordRelation: parseKeywordRelationFromText(matched[1])
    }
  }
  return null
}

function getRevisionParagraphTargetsByKeywords(keywordList = [], keywordRelation = 'any') {
  const doc = getActiveDocument()
  const paragraphs = doc?.Paragraphs
  const total = Number(paragraphs?.Count || 0)
  if (!doc || !paragraphs || total <= 0 || keywordList.length === 0) return []
  const regexes = keywordList
    .map(keyword => new RegExp(escapeRegexPattern(keyword), 'i'))
    .filter(Boolean)
  const targets = []
  for (let i = 1; i <= total; i++) {
    try {
      const range = duplicateDocumentRange(paragraphs.Item(i)?.Range)
      const text = String(range?.Text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
      if (!text) continue
      const hitCount = regexes.reduce((count, regex) => count + (regex.test(text) ? 1 : 0), 0)
      const matched = keywordRelation === 'all' ? hitCount === regexes.length : hitCount > 0
      if (!matched) continue
      targets.push({
        index: i,
        start: Number(range?.Start || 0),
        end: Number(range?.End || 0),
        text,
        range
      })
    } catch (_) {
      continue
    }
  }
  return targets
}

function detectDocumentRevisionIntent(text) {
  const normalized = String(text || '').trim()
  if (!normalized) return null
  if (!DOCUMENT_REVISION_TRIGGER_PATTERN.test(normalized)) return null
  const constraints = detectDocumentRevisionConstraints(normalized)
  const keywordTarget = detectDocumentRevisionKeywordFilter(normalized)
  const scope = FULL_DOCUMENT_REFERENCE_PATTERN.test(normalized) || /(文档|全文|全篇|整篇|文章|材料)/.test(normalized)
    ? 'document'
    : /(当前段落|本段|这段|这一段|光标所在|当前位置|鼠标所在)/.test(normalized)
      ? 'paragraph'
      : /(选中|选区|当前选择|所选|选中文字|选中的内容)/.test(normalized)
        ? 'selection'
        : 'selection-preferred'
  if (/(错别字|病句|语法|标点|拼写|文错|别字)/.test(normalized)) {
    return {
      scope,
      revisionType: 'proofread',
      assistantId: 'analysis.correct-spell',
      constraints,
      keywordTarget
    }
  }
  if (/(书写|文笔|措辞|用词).{0,24}(检查|校对|审校|筛查)|(?:检查|校对|审校|筛查).{0,24}(书写|文笔|措辞|用词)/.test(normalized)) {
    return {
      scope,
      revisionType: 'proofread',
      assistantId: 'analysis.correct-spell',
      constraints,
      keywordTarget
    }
  }
  if (/(歧义|有歧义|不清晰|不清楚|不明确|表达不清|语义不清|指代不清|含混)/.test(normalized)) {
    return {
      scope,
      revisionType: 'clarify',
      assistantId: 'analysis.rewrite',
      constraints,
      keywordTarget
    }
  }
  if (/(描述不正确|描述有误|表述不正确|表述不准确|文字描述不正确|文字描述有误|表达有误|不严谨|不准确)/.test(normalized)) {
    return {
      scope,
      revisionType: 'correct-description',
      assistantId: 'analysis.rewrite',
      constraints,
      keywordTarget
    }
  }
  if (/(更正式|正式一点|书面一些|公文风|正式表达|规范表达)/.test(normalized)) {
    return {
      scope,
      revisionType: 'formalize',
      assistantId: 'analysis.formalize',
      constraints,
      keywordTarget
    }
  }
  if (/(更通顺|润色|优化表达|更自然|更流畅)/.test(normalized)) {
    return {
      scope,
      revisionType: 'polish',
      assistantId: 'analysis.polish',
      constraints,
      keywordTarget
    }
  }
  if (/(统一术语|统一称谓|统一简称|术语统一|称谓统一)/.test(normalized)) {
    return {
      scope,
      revisionType: 'term-unify',
      assistantId: 'analysis.term-unify',
      constraints,
      keywordTarget
    }
  }
  return null
}

function parseRelocationSourceSpec(text) {
  const normalized = String(text || '').trim()
  if (!normalized) return null
  const paragraphIndex = detectDeleteParagraphIndex(normalized)
  if (paragraphIndex) {
    return {
      sourceType: 'paragraph-index',
      sourceIndex: paragraphIndex,
      searchText: ''
    }
  }
  if (/(当前段落|本段|这段|这一段)/.test(normalized)) {
    return {
      sourceType: 'current-paragraph',
      sourceIndex: null,
      searchText: ''
    }
  }
  if (/(所在的段落|所在段落|的段落|段落)/.test(normalized)) {
    const keywordList = extractKeywordListFromText(normalized)
    const modeSpec = parseTargetModeFromText(normalized)
    if (keywordList.length > 0) {
      return {
        sourceType: 'paragraph-keyword',
        sourceIndex: null,
        searchText: keywordList[0] || '',
        keywordList,
        keywordRelation: parseKeywordRelationFromText(normalized),
        targetMode: modeSpec.targetMode,
        limitCount: modeSpec.limitCount
      }
    }
  }
  return null
}

function parseRelocationDestinationSpec(text) {
  const normalized = trimRelocationDestinationText(text)
  if (!normalized) return null
  if (/(文首|开头|最前面|首部)/.test(normalized)) {
    return {
      destinationType: 'document-start',
      destinationIndex: null,
      placement: 'before'
    }
  }
  if (/(文末|末尾|最后面|结尾)/.test(normalized)) {
    return {
      destinationType: 'document-end',
      destinationIndex: null,
      placement: 'after'
    }
  }
  const placement = /(后|后面|之后)$/.test(normalized) ? 'after' : 'before'
  const paragraphIndex = detectDeleteParagraphIndex(normalized)
  if (paragraphIndex) {
    return {
      destinationType: 'paragraph-index',
      destinationIndex: paragraphIndex,
      placement
    }
  }
  if (/(当前段落|本段|这段|这一段)/.test(normalized)) {
    return {
      destinationType: 'current-paragraph',
      destinationIndex: null,
      placement
    }
  }
  return null
}

function classifyDocumentRequestStrategy(text) {
  const normalized = String(text || '').trim()
  if (/(翻译|译成|翻成|中译英|英译中|改写|重写|润色|正式化|通俗化|缩写|扩写|术语统一|公文风|政策)/.test(normalized)) {
    return 'transform'
  }
  if (/(摘要|总结|概括|提炼|关键词|风险|分析|审查|检查|纪要|标题|待办|行动项|结构)/.test(normalized)) {
    return 'synthesize'
  }
  return 'synthesize'
}

const ASSISTANT_RECOMMENDATION_RULES = {
  'spell-check': ['拼写', '语法', '错别字', '病句', '校对', '纠错', '标点'],
  summary: ['摘要', '文档摘要', '生成摘要', '生成文档摘要', '总结', '总结文档', '概括', '提炼', '提炼摘要', '概要', '概述', '内容总结', '文档总结', '梳理要点'],
  translate: ['翻译', '英文', '英文版', '中译英', '英译中', '日语', '日文', '韩语', '法语', '德语'],
  'text-to-image': ['配图', '画图', '图片', '海报', '图像', '插图'],
  'text-to-audio': ['语音', '朗读', '播报', '音频', '配音'],
  'text-to-video': ['视频', '短片', '分镜', '镜头', '旁白视频'],
  'analysis.rewrite': ['改写', '重写', '换种说法', '换一种表达', '改个说法'],
  'analysis.expand': ['扩写', '展开', '补充细节', '详细一点', '丰富内容'],
  'analysis.abbreviate': ['缩写', '精简', '压缩', '简化篇幅', '简短一点'],
  'analysis.comment-explain': ['批注', '解释', '说明一下', '注释'],
  'analysis.hyperlink-explain': ['链接', '超链接', '网址', '引用说明', '参考链接'],
  'analysis.correct-spell': ['修正', '纠正语法', '修正文案', '改正文错'],
  'analysis.extract-keywords': ['关键词', '主题词', '核心词', '标签'],
  'analysis.paragraph-numbering-check': ['序号', '编号', '层级编号', '条款编号', '编号格式'],
  'analysis.ai-trace-check': ['AI 痕迹', 'AI生成', '机器生成', '套话', '机翻', '鉴伪', '人机协同'],
  'analysis.security-check': ['保密', '涉密', '敏感', '合规', '泄密', '机密'],
  'analysis.secret-keyword-extract': ['脱密', '敏感词', '涉密关键词', '占位符'],
  'analysis.form-field-extract': ['表单', '字段', '抽取字段', '合同字段', '书签字段'],
  'analysis.form-field-audit': ['审计', '审核', '校验', '合规审查', '复核报告'],
  'analysis.polish': ['润色', '优化表达', '润色一下', '提升文笔'],
  'analysis.formalize': ['正式化', '书面化', '公文表达', '正式措辞'],
  'analysis.simplify': ['通俗', '易懂', '白话', '解释给小白'],
  'analysis.action-items': ['行动项', '待办', '下一步', '责任人', 'todo'],
  'analysis.risks': ['风险', '结论', '建议', '风险点'],
  'analysis.term-unify': ['术语统一', '统一术语', '统一称谓', '统一简称'],
  'analysis.title': ['标题', '题目', '标题建议', '拟题'],
  'analysis.structure': ['结构', '层次', '逻辑', '段落顺序', '重组内容'],
  'analysis.minutes': ['会议纪要', '纪要', '会议记录', '整理会议'],
  'analysis.policy-style': ['公文风格', '政策风格', '汇报材料', '正式汇报']
}

const ASSISTANT_INTENT_PATTERNS = {
  summary: [
    /生成.{0,8}(摘要|概要|概述)/,
    /(文档|材料|内容|全文).{0,8}(摘要|概要|概述|总结|概括)/,
    /(总结|概括|提炼).{0,8}(文档|材料|内容|全文|要点)/,
    /(帮我|请|麻烦).{0,6}(总结|概括|提炼).{0,8}(一下|一下这份|这个|这份)?(文档|材料|内容)?/,
    /(梳理|提炼).{0,6}(要点|重点|核心内容)/
  ],
  translate: [
    /(翻译).{0,8}(文档|材料|内容|全文)/,
    /(帮我|请|麻烦).{0,6}翻译/,
    /(中译英|英译中|翻成英文|翻成中文|译成英文|译成中文)/,
    /把.{0,20}翻译成/
  ],
  'analysis.rewrite': [
    /(改写|重写|换个说法|换一种说法|换一种表达)/,
    /(帮我|请|麻烦).{0,6}(改写|重写)/
  ],
  'analysis.expand': [
    /(扩写|展开写|丰富内容|补充细节)/,
    /(帮我|请|麻烦).{0,6}扩写/
  ],
  'analysis.abbreviate': [
    /(缩写|精简|压缩|简写|简短一点)/,
    /(帮我|请|麻烦).{0,6}(缩写|精简|压缩)/
  ],
  'analysis.polish': [
    /(润色|优化表达|优化文笔|润一下)/,
    /(帮我|请|麻烦).{0,6}润色/
  ],
  'analysis.minutes': [
    /(会议纪要|整理纪要|生成纪要|会议记录整理)/,
    /(帮我|请|麻烦).{0,6}(整理|生成).{0,6}纪要/
  ],
  'analysis.title': [
    /(生成标题|拟标题|起标题|想个标题)/,
    /(帮我|请|麻烦).{0,6}(起|拟|生成).{0,6}标题/
  ],
  'analysis.security-check': [
    /(保密检查|涉密检查|敏感检查|合规审查|泄密风险)/,
    /(帮我|请|麻烦).{0,6}(检查).{0,10}(保密|涉密|敏感|合规)/
  ],
  'analysis.ai-trace-check': [
    /(AI\s*痕迹|AI生成|机器生成|大模型|ChatGPT|GPT|机翻痕迹|套话检查|鉴伪)/i,
    /(帮我|请|麻烦).{0,8}(检查|看看).{0,12}(是不是|是否).{0,8}(AI|机器|模型)/i
  ]
}

const ASSISTANT_MODEL_ROUTING_HINTS = {
  summary: '当用户要求生成摘要、总结文档、概括内容、提炼要点、输出概要或概述时，优先选择该助手。',
  translate: '只有在用户明确要求翻译、指定目标语言、提到中译英/英译中/译成某语言时，才选择该助手。不要因为用户提到文档、内容、文本就误判为翻译。',
  'analysis.security-check': '当用户要求检查文档中的保密风险、涉密风险、敏感信息、合规问题时，优先选择该助手。',
  'analysis.ai-trace-check': '当用户怀疑正文像 AI 生成、希望检查套话/机翻痕迹、或在文档中标注可疑片段供复核时，优先选择该助手；默认在原文锚点添加批注。',
  'analysis.secret-keyword-extract': '当用户要求对文档做脱密、脱敏、敏感词替换、生成占位符、抽取涉密关键词用于脱密处理时，优先选择该助手，而不是翻译或摘要。',
  'analysis.rewrite': '当用户要求改写、重写、换种说法但保持原意时，优先选择该助手。',
  'analysis.expand': '当用户要求扩写、补充细节、展开内容时，优先选择该助手。',
  'analysis.abbreviate': '当用户要求缩写、精简、压缩篇幅时，优先选择该助手。',
  'analysis.polish': '当用户要求润色、优化表达、提升文笔时，优先选择该助手。',
  'analysis.minutes': '当用户要求整理会议纪要、生成会议纪要、整理会议记录时，优先选择该助手。',
  'analysis.title': '当用户要求拟标题、生成标题、起标题时，优先选择该助手。'
}

const DEFAULT_ASSISTANT_RECOMMENDATION_KEYS = [
  'summary',
  'analysis.polish',
  'translate',
  'analysis.risks'
]

function normalizeRecommendationText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function trimAssistantRecommendationSuffix(value) {
  return String(value || '')
    .replace(/(智能)?助手$/g, '')
    .replace(/设置$/g, '')
    .trim()
}

function dedupeRecommendationKeywords(list = []) {
  const unique = []
  list.forEach((item) => {
    const value = String(item || '').trim()
    if (!value || unique.includes(value)) return
    unique.push(value)
  })
  return unique
}

function createRecommendationBigrams(value) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '')
  const result = []
  for (let i = 0; i < normalized.length - 1; i++) {
    const chunk = normalized.slice(i, i + 2)
    if (chunk && !result.includes(chunk)) result.push(chunk)
  }
  return result
}

const ASSISTANT_EVOLUTION_CAPABILITY_TERMS = [
  '语气', '口吻', '风格', '正式', '礼貌', '通俗', '术语', '列表', '段落', '改写',
  '润色', '摘要', '翻译', '扩写', '缩写', '保密', '脱密', '批注', '标题', '目录',
  '表格', '格式', '校对', '病句', '错别字', '合同', '审查', '报告', '解释', '提取',
  '关键词', '续写', '总结', '检查', '优化', '美化', '问答', '分类'
]

function createAssistantEvolutionCapabilityTerms(value) {
  const normalized = String(value || '').toLowerCase()
  const terms = []
  ASSISTANT_EVOLUTION_CAPABILITY_TERMS.forEach((term) => {
    if (normalized.includes(term) && !terms.includes(term)) terms.push(term)
  })
  const englishWords = normalized.match(/[a-z][a-z0-9-]{2,}/g) || []
  englishWords.forEach((word) => {
    if (!terms.includes(word)) terms.push(word)
  })
  return terms
}

function uniqueAssistantAliases(list = []) {
  const unique = []
  list.forEach((item) => {
    const value = trimAssistantRecommendationSuffix(item)
    if (!value || value.length < 2 || unique.includes(value)) return
    unique.push(value)
  })
  return unique
}

function extractRecommendationJsonCandidate(raw) {
  const text = String(raw || '').trim()
  if (!text) return ''
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (codeBlockMatch?.[1]) return codeBlockMatch[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) return text.slice(start, end + 1).trim()
  return text
}

function parseAssistantIntentResult(raw) {
  const candidate = extractRecommendationJsonCandidate(raw)
  if (!candidate) return null
  try {
    return JSON.parse(candidate)
  } catch (_) {
    return null
  }
}

function parseGeneratedAspectRatio(text) {
  const normalized = String(text || '').trim()
  if (!normalized) return ''
  if (/(1:1|正方形|方图)/i.test(normalized)) return '1:1'
  if (/(3:4|竖版|竖图|海报竖版)/i.test(normalized)) return '3:4'
  if (/(4:3)/i.test(normalized)) return '4:3'
  if (/(9:16|竖屏)/i.test(normalized)) return '9:16'
  if (/(16:9|横屏|宽屏)/i.test(normalized)) return '16:9'
  return ''
}

function parseGeneratedVideoDuration(text) {
  const normalized = String(text || '').trim()
  if (!normalized) return ''
  const secondMatch = normalized.match(/(\d+)\s*(秒|s\b)/i)
  if (secondMatch?.[1]) return `${Math.max(1, Number(secondMatch[1]))}s`
  const minuteMatch = normalized.match(/(\d+)\s*(分钟|分|min\b)/i)
  if (minuteMatch?.[1]) return `${Math.max(1, Number(minuteMatch[1]))}m`
  if (/短视频|短片|口播视频/.test(normalized)) return '8s'
  return ''
}

function parseGeneratedVoiceStyle(text) {
  const normalized = String(text || '').trim()
  if (!normalized) return ''
  if (/(温柔|柔和|轻柔)/.test(normalized)) return '温柔自然'
  if (/(童声|儿童)/.test(normalized)) return '童声活泼'
  if (/(新闻|播音|播报)/.test(normalized)) return '新闻播报'
  if (/(正式|专业|严肃)/.test(normalized)) return '专业正式'
  if (/(自然|口语|日常)/.test(normalized)) return '自然口语'
  return ''
}

function normalizeGeneratedOutputIntent(value, fallback = {}) {
  const source = value && typeof value === 'object' ? value : {}
  const fallbackValue = fallback && typeof fallback === 'object' ? fallback : {}
  const rawAction = String(source.action || fallbackValue.action || 'chat').trim().toLowerCase()
  const action = ['chat', 'report', 'image', 'video', 'audio', 'image-export', 'object-export'].includes(rawAction) ? rawAction : 'chat'
  const rawScope = String(source.scope || fallbackValue.scope || 'selection').trim().toLowerCase()
  const scope = ['document', 'selection', 'prompt'].includes(rawScope) ? rawScope : 'selection'
  const rawFormat = String(source.outputFormat || fallbackValue.outputFormat || 'md').trim().toLowerCase()
  const outputFormat = ['json', 'md', 'csv', 'txt'].includes(rawFormat) ? rawFormat : 'md'
  const fileBaseName = String(source.fileBaseName || fallbackValue.fileBaseName || '').trim()
  const aspectRatio = String(source.aspectRatio || fallbackValue.aspectRatio || '').trim()
  const duration = String(source.duration || fallbackValue.duration || '').trim()
  const voiceStyle = String(source.voiceStyle || fallbackValue.voiceStyle || '').trim()
  return {
    action,
    scope,
    outputFormat,
    fileBaseName,
    aspectRatio,
    duration,
    voiceStyle
  }
}

function normalizePrimaryConversationIntent(value, fallback = {}) {
  const source = value && typeof value === 'object' ? value : {}
  const fallbackValue = fallback && typeof fallback === 'object' ? fallback : {}
  const rawKind = String(source.kind || fallbackValue.kind || 'chat').trim().toLowerCase()
  const kind = ['chat', 'document-operation', 'wps-capability', 'generated-output', 'assistant-task'].includes(rawKind)
    ? rawKind
    : 'chat'
  const rawConfidence = String(source.confidence || fallbackValue.confidence || 'low').trim().toLowerCase()
  const confidence = ['high', 'medium', 'low'].includes(rawConfidence) ? rawConfidence : 'low'
  return {
    kind,
    confidence,
    reason: String(source.reason || fallbackValue.reason || '').trim()
  }
}

function normalizeDocumentOperationRouterResult(value) {
  const source = value && typeof value === 'object' ? value : {}
  const confidence = ['high', 'medium', 'low'].includes(String(source.confidence || '').toLowerCase())
    ? String(source.confidence).toLowerCase()
    : 'low'
  const primaryAction = String(source.primaryAction || source.action || 'chat').trim().toLowerCase()
  const supportedPrimaryActions = [
    'document-revision',
    'document-revision:proofread',
    'document-revision:clarify',
    'document-revision:correct-description',
    'document-revision:formalize',
    'document-revision:polish',
    'document-revision:term-unify',
    'document-delete',
    'document-text-edit',
    'document-relocation',
    'document-format',
    'document-comment',
    'document-aware',
    'selection-translate',
    'document-declassify',
    'document-declassify-restore',
    'secret-keyword-extract',
    'unsupported',
    'chat'
  ]
  const normalizedPrimaryAction = supportedPrimaryActions.includes(primaryAction) ? primaryAction : 'chat'
  const revisionType = [
    'proofread',
    'clarify',
    'correct-description',
    'formalize',
    'polish',
    'term-unify'
  ].includes(String(source.revisionType || '').trim())
    ? String(source.revisionType).trim()
    : ''
  const scope = ['selection', 'paragraph', 'document', 'selection-preferred'].includes(String(source.scope || '').trim())
    ? String(source.scope).trim()
    : 'selection-preferred'
  const candidateActions = Array.isArray(source.candidateActions)
    ? source.candidateActions.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const supported = source.supported === false
    ? false
    : normalizedPrimaryAction !== 'unsupported'
  return {
    isDocumentOperation: source.isDocumentOperation !== false && normalizedPrimaryAction !== 'chat',
    supported,
    confidence,
    primaryAction: normalizedPrimaryAction,
    revisionType,
    scope,
    candidateActions,
    reason: String(source.reason || '').trim(),
    unsupportedNeed: String(source.unsupportedNeed || '').trim()
  }
}

function maybeNeedsGeneratedOutputAnalysis(text, attachmentCount = 0) {
  const normalized = String(text || '').trim()
  if (!normalized) return false
  if (GENERATED_OUTPUT_TRIGGER_PATTERN.test(normalized)) return true
  return attachmentCount > 0 && REPORT_TEMPLATE_PATTERN.test(normalized)
}

function inferGeneratedOutputIntentByRule(text, attachmentCount = 0) {
  const normalized = String(text || '').trim()
  const aspectRatio = parseGeneratedAspectRatio(normalized)
  const duration = parseGeneratedVideoDuration(normalized)
  const voiceStyle = parseGeneratedVoiceStyle(normalized)
  if (!normalized) {
    return {
      action: 'chat',
      scope: 'selection',
      outputFormat: 'md',
      fileBaseName: '',
      aspectRatio,
      duration,
      voiceStyle
    }
  }

  const documentIntent = detectDocumentScopeIntent(normalized)
  const scope = documentIntent ? 'document' : (ACTIVE_DOCUMENT_REFERENCE_PATTERN.test(normalized) ? 'selection' : 'prompt')

  if (VIDEO_REQUEST_PATTERN.test(normalized)) {
    return {
      action: 'video',
      scope,
      outputFormat: 'md',
      fileBaseName: '生成视频',
      aspectRatio,
      duration: duration || '8s',
      voiceStyle
    }
  }
  if (AUDIO_REQUEST_PATTERN.test(normalized)) {
    return {
      action: 'audio',
      scope,
      outputFormat: 'md',
      fileBaseName: '生成语音',
      aspectRatio,
      duration,
      voiceStyle: voiceStyle || '专业自然'
    }
  }
  if (IMAGE_REQUEST_PATTERN.test(normalized)) {
    return {
      action: 'image',
      scope,
      outputFormat: 'md',
      fileBaseName: '生成图片',
      aspectRatio: aspectRatio || '16:9',
      duration,
      voiceStyle
    }
  }
  if (DOCUMENT_IMAGE_EXPORT_REQUEST_PATTERN.test(normalized) && /(图片|图像|配图|插图)/.test(normalized)) {
    return {
      action: 'image-export',
      scope: FULL_DOCUMENT_REFERENCE_PATTERN.test(normalized) || /(文档|全文|文章|材料)/.test(normalized) ? 'document' : 'selection',
      outputFormat: 'md',
      fileBaseName: '文档图片',
      aspectRatio,
      duration,
      voiceStyle
    }
  }
  if (DOCUMENT_OBJECT_EXPORT_REQUEST_PATTERN.test(normalized)) {
    return {
      action: 'object-export',
      scope: FULL_DOCUMENT_REFERENCE_PATTERN.test(normalized) || /(文档|全文|文章|材料)/.test(normalized) ? 'document' : 'selection',
      outputFormat: 'json',
      fileBaseName: '文档附件对象',
      aspectRatio,
      duration,
      voiceStyle
    }
  }

  const wantsStructuredFile = EXTRACTION_REQUEST_PATTERN.test(normalized) && (
    FILE_EXPORT_REQUEST_PATTERN.test(normalized) ||
    IMAGE_EXTRACTION_REQUEST_PATTERN.test(normalized)
  )
  if (wantsStructuredFile) {
    const outputFormat = JSON_REQUEST_PATTERN.test(normalized)
      ? 'json'
      : CSV_REQUEST_PATTERN.test(normalized)
        ? 'csv'
        : TEXT_FILE_REQUEST_PATTERN.test(normalized)
          ? 'txt'
          : 'md'
    const fileBaseName = CSV_REQUEST_PATTERN.test(normalized)
      ? '提炼结果表格'
      : IMAGE_EXTRACTION_REQUEST_PATTERN.test(normalized)
        ? '图像提炼结果'
        : '提炼结果'
    return {
      action: 'report',
      scope,
      outputFormat,
      fileBaseName,
      aspectRatio,
      duration,
      voiceStyle
    }
  }

  const wantsReport = REPORT_REQUEST_PATTERN.test(normalized) || (attachmentCount > 0 && REPORT_TEMPLATE_PATTERN.test(normalized))
  if (wantsReport) {
    const outputFormat = JSON_REQUEST_PATTERN.test(normalized)
      ? 'json'
      : CSV_REQUEST_PATTERN.test(normalized)
        ? 'csv'
        : TEXT_FILE_REQUEST_PATTERN.test(normalized)
          ? 'txt'
          : 'md'
    const fileBaseName = /关键词/.test(normalized)
      ? '关键词报告'
      : CSV_REQUEST_PATTERN.test(normalized)
        ? '提炼结果表格'
      : /周报/.test(normalized)
        ? '周报'
        : /月报/.test(normalized)
          ? '月报'
          : /年报/.test(normalized)
            ? '年报'
            : /调研/.test(normalized)
              ? '调研报告'
              : /纪要/.test(normalized)
                ? '生成纪要'
                : '生成报告'
    return {
      action: 'report',
      scope,
      outputFormat,
      fileBaseName,
      aspectRatio,
      duration,
      voiceStyle
    }
  }

  return {
    action: 'chat',
    scope,
    outputFormat: 'md',
    fileBaseName: '',
    aspectRatio,
    duration,
    voiceStyle
  }
}

function getFilteredModelGroups() {
  return getModelGroupsFromSettings(MODEL_TYPE_CHAT)
}

function getSelectedModelId() {
  const groups = getFilteredModelGroups()
  const flat = groups.flatMap(g => g.models)
  const stored = window.Application?.PluginStorage?.getItem(STORAGE_KEY_SELECTED_ID)
  if (stored && flat.some(m => m.id === stored)) return stored
  const legacyStored = window.Application?.PluginStorage?.getItem('selectedModelId')
  if (legacyStored && flat.some(m => m.id === legacyStored)) return legacyStored
  return flat[0]?.id || null
}

export default {
  name: 'AIAssistantDialog',
  components: {
    LongTaskRunCard
  },
  data() {
    return {
      aiDialogAssetsInline: AI_DIALOG_ASSETS_INLINE,
      activeSidebarTab: 'chats',
      sidebarWidth: 300,
      sidebarCollapsed: false,
      lastExpandedSidebarWidth: 300,
      isResizingSidebar: false,
      chatHistory: [],
      currentChatId: null,
      assistantItems: [],
      assistantGroupCollapsed: {},
      chatSearchText: '',
      assistantSearchText: '',
      assistantRunLoadingKey: '',
      userInput: '',
      attachments: [],
      selectedModelId: null,
      modelGroupsVersion: 0,
      modelDropdownOpen: false,
      showKnowledgeBaseDialog: false,
      modelGroupCollapsed: {},
      isStreaming: false,
      streamingContent: '',
      selectionContextSnapshot: null,
      selectionContextCollapsed: true,
      tooltipLayouts: {},
      aiAssistantWindowSession: null,
      welcomePromptIndex: -1,
      displayedWelcomePrompt: '',
      fullWelcomePrompt: '',
      isWelcomePromptTyping: false,
      welcomePromptTimer: null,
      missingSkillNoticeTimers: {},
      assistantParameterAutoTimers: {},
      dialogAutoContinueIntervals: {},
      assistantRecommendModalEmptyText: '',
      assistantRecommendModalEmptyDisplayText: '',
      assistantRecommendModalEmptyTyping: false,
      assistantRecommendModalEmptyTimer: null,
      showInsertModal: false,
      insertModalMode: 'insert',
      insertModalContent: '',
      showFollowDonationQrCode: true,
      showWechatDonationQrCode: true,
      showAlipayDonationQrCode: true,
      sidebarFooterSupportDialogMode: '',
      showAssistantRecommendModal: false,
      assistantRecommendModalItems: [],
      assistantRecommendModalContext: '根据当前输入和最近对话，为你推荐可直接执行的助手。',
      assistantLoadingTimer: null,
      assistantLoadingMessageId: '',
      historyStorageScopeKey: '',
      historyStorageDocumentLinkId: '',
      historyStorageSource: '',
      historySavePersister: null,
      pendingHistorySavePayload: null,
      taskListUnsubscribe: null,
      assistantEvolutionSuggestion: null,
      assistantEvolutionCheckTimer: null,
      assistantEvolutionProgressTimer: null,
      welcomeEntryAnimation: WELCOME_ENTRY_ANIMATION_VARIANTS[0],
      welcomeEntryCycle: 0,
      lastWelcomeEntryAnimation: '',
      lastWelcomeExitAnimation: '',
      welcomeExitGhost: {
        visible: false,
        variant: '',
        html: '',
        style: null
      },
      welcomeExitCleanupTimer: null,
      sendLaunchEffect: {
        active: false
      },
      sendLaunchEffectTimer: null,
      lastUserMessageEntryAnimation: '',
      lastAssistantMessageEntryAnimation: '',
      messageEntryEffects: {},
      messageEntryEffectTimers: {},
      assistantEvolutionDismissedSignatures: [],
      activeDocumentRevisionRunContext: null,
      activeDocumentAwareRunContext: null,
      activeGeneratedOutputRunContext: null,
      reportGenerationAutoTimers: {},
      assistantSelfIntroTimer: null,
      assistantHighlightedKey: '',
      assistantHighlightTimer: null
    }
  },
  computed: {
    filteredModelGroups() {
      void this.modelGroupsVersion
      return getFilteredModelGroups()
    },
    filteredModelList() {
      return this.filteredModelGroups.flatMap(g => g.models)
    },
    hasConfiguredChatModels() {
      return this.filteredModelList.length > 0
    },
    hasPendingInput() {
      return !!String(this.userInput || '').trim() || this.attachments.length > 0
    },
    selectionHintLabel() {
      return this.getSelectionHintLabel(this.selectionContextSnapshot)
    },
    selectionHintTooltip() {
      return this.getSelectionHintTooltip(this.selectionContextSnapshot)
    },
    selectedModel() {
      return this.filteredModelList.find(m => m.id === this.selectedModelId) || this.filteredModelList[0]
    },
    selectedModelName() {
      return this.selectedModel?.name || this.selectedModel?.modelId || (this.hasConfiguredChatModels ? '选择模型' : '配置模型')
    },
    selectedModelIcon() {
      return this.selectedModel ? (getModelLogoPath(this.selectedModel.providerId) || 'images/ai-assistant.svg') : 'images/ai-assistant.svg'
    },
    welcomeTitle() {
      if (this.hasConfiguredChatModels) {
        return '你好，我是察元 AI 文档助手。'
      }
      return '先配置模型，再开启智能写作。'
    },
    welcomeSubtitle() {
      if (this.hasConfiguredChatModels) {
        return '你可以直接让我写文档、审文档、生成报告、参考附件模板，或者按自然语言帮你改格式。'
      }
      return '当前未检测到可用模型。请先前往模型设置完成提供商启用、API 地址与密钥配置，并刷新模型清单后再开始使用。'
    },
    defaultMissingSkillNoticeText() {
      return MISSING_SKILL_CHAT_NOTICE_VARIANTS[0]
    },
    defaultMissingSkillModalNoticeText() {
      return MISSING_SKILL_MODAL_NOTICE_VARIANTS[0]
    },
    composerPlaceholder() {
      if (this.hasConfiguredChatModels) {
        return '输入消息，Enter 发送，Ctrl+Enter 或 Alt+Enter 换行'
      }
      return '请先配置模型后再开始对话'
    },
    hasDonationQrCode() {
      return this.showFollowDonationQrCode || this.showWechatDonationQrCode || this.showAlipayDonationQrCode
    },
    sidebarFooterSupportDialogVisible() {
      return this.sidebarFooterSupportDialogMode === 'follow' || this.sidebarFooterSupportDialogMode === 'support'
    },
    sidebarFooterSupportDialogTitle() {
      return this.sidebarFooterSupportDialogMode === 'follow' ? '关注我们' : '支持我们'
    },
    currentChat() {
      return this.chatHistory.find(c => c.id === this.currentChatId)
    },
    currentMessages() {
      return this.currentChat?.messages || []
    },
    currentMessageCount() {
      return this.currentMessages.length
    },
    sidebarStyle() {
      return {
        width: this.sidebarCollapsed ? '0px' : `${this.sidebarWidth}px`
      }
    },
    filteredChatHistory() {
      const search = String(this.chatSearchText || '').trim().toLowerCase()
      if (!search) return this.chatHistory
      return this.chatHistory.filter((chat) => {
        const title = String(chat?.title || '').toLowerCase()
        const contents = Array.isArray(chat?.messages)
          ? chat.messages.map(msg => String(msg?.content || '')).join('\n').toLowerCase()
          : ''
        return title.includes(search) || contents.includes(search)
      })
    },
    assistantVisibleCount() {
      return this.assistantItems.filter(item => item?.type !== 'create-custom-assistant').length
    },
    assistantGroups() {
      const search = String(this.assistantSearchText || '').trim().toLowerCase()
      const groups = []
      this.assistantItems
        .filter(item => item?.type !== 'create-custom-assistant')
        .filter((item) => {
          if (!search) return true
          const text = [
            item.shortLabel,
            item.label,
            item.description,
            getAssistantGroupLabel(item.group || 'custom')
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          return text.includes(search)
        })
        .forEach((item) => {
          const groupKey = item.group || 'custom'
          let group = groups.find(entry => entry.key === groupKey)
          if (!group) {
            group = {
              key: groupKey,
              label: getAssistantGroupLabel(groupKey),
              items: []
            }
            groups.push(group)
          }
          group.items.push(item)
        })
      return groups
    },
    lastAssistantMessage() {
      const msgs = this.currentMessages
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') return msgs[i].content
      }
      return this.isStreaming ? this.streamingContent : ''
    },
    contextInfoChips() {
      const snapshot = this.selectionContextSnapshot
      if (!snapshot) return []
      const chips = []
      const kind = String(snapshot.kind || '').trim()
      const stats = snapshot.documentStats || {}
      if (kind === 'selection') chips.push('当前选区')
      else if (kind === 'paragraph') chips.push('当前段落')
      else if (kind === 'table-cell') chips.push('当前单元格')
      else if (kind === 'range') chips.push('当前范围')
      if (snapshot.position?.paragraphLabel) chips.push(snapshot.position.paragraphLabel)
      if (stats.currentPage > 0 && stats.totalPages > 0) chips.push(`第 ${stats.currentPage}/${stats.totalPages} 页`)
      else if (stats.currentPage > 0) chips.push(`第 ${stats.currentPage} 页`)
      else if (stats.totalPages > 0) chips.push(`共 ${stats.totalPages} 页`)
      if (stats.characterCount > 0) chips.push(`${stats.characterCount} 字`)
      if (stats.paragraphCount > 0) chips.push(`${stats.paragraphCount} 段`)
      if (snapshot.formatting?.styleName) chips.push(`样式 ${snapshot.formatting.styleName}`)
      if (snapshot.formatting?.fontName) chips.push(`字体 ${snapshot.formatting.fontName}`)
      return chips.slice(0, 6)
    },
    contextPreviewText() {
      const text = String(this.selectionContextSnapshot?.text || '').replace(/\s+/g, ' ').trim()
      if (!text) return ''
      return text.length > 88 ? `${text.slice(0, 88)}...` : text
    }
  },
  watch: {
    userInput() {
      this.$nextTick(() => this.adjustComposerHeight())
    },
    selectedModelId(val) {
      if (!val) return
      try {
        window.Application?.PluginStorage?.setItem(STORAGE_KEY_SELECTED_ID, val)
        window.localStorage?.setItem(STORAGE_KEY_SELECTED_ID, val)
        window.Application?.PluginStorage?.setItem('defaultModelId', val)
        setDefaultModelId(val)
        const storedDefaults = window.Application?.PluginStorage?.getItem('defaultModelsByCategory') ||
          window.localStorage?.getItem('defaultModelsByCategory')
        const defaults = storedDefaults ? JSON.parse(storedDefaults) : {}
        const nextDefaults = { ...defaults, chat: val }
        window.Application?.PluginStorage?.setItem('defaultModelsByCategory', JSON.stringify(nextDefaults))
        window.localStorage?.setItem('defaultModelsByCategory', JSON.stringify(nextDefaults))
      } catch (e) {
        console.debug('保存当前模型失败:', e)
      }
    },
    currentChatId() {
      this.$nextTick(() => {
        this.refreshWelcomePrompt()
        if (this.currentMessages.length === 0) {
          this.prepareWelcomeSupportEntryAnimation()
        } else {
          this.finishWelcomeSupportExitAnimation()
        }
      })
    },
    currentMessageCount(count, previousCount) {
      if (count === 0 && previousCount > 0) {
        this.finishWelcomeSupportExitAnimation()
        this.$nextTick(() => this.prepareWelcomeSupportEntryAnimation())
      }
      if (count > 0 && previousCount === 0) {
        this.stopWelcomePromptTyping()
      }
    }
  },
  mounted() {
    this.aiAssistantWindowSession = createAIAssistantWindowSession((request) => {
      this.handleAIAssistantWindowRequest(request)
    })
    const claimed = this.aiAssistantWindowSession.claimOwnership(this.$route?.query || {})
    if (!claimed.ok && claimed.reason === 'duplicate') {
      window.setTimeout(() => {
        this.closeWindow()
      }, 80)
      return
    }
    this.loadHistory()
    this.loadSidebarLayout()
    this.loadAssistantItems()
    this.requestAssistantEvolutionSuggestionCheck()
    this.refreshModelSelection()
    const hashPart = (window.location.hash || '').split('?')[1] || ''
    const fromContext = new URLSearchParams(hashPart || window.location.search || '').get('from') === 'context'
    const selectedContext = safeParsePluginJson(
      window.Application?.PluginStorage?.getItem(STORAGE_KEY_SELECTED_CONTEXT)
    )
    const selectedContent = window.Application?.PluginStorage?.getItem(STORAGE_KEY_SELECTED_CONTENT) || selectedContext?.text || ''
    if (fromContext && selectedContent) {
      // 仅保留为感知上下文，不回填到输入框，避免大段内容挤占输入区域
    }
    this.consumeExternalPromptQuery(this.$route?.query || {})
    this.refreshSelectionContext()
    this.refreshWelcomePrompt()
    if (this.currentMessages.length === 0) {
      this.prepareWelcomeSupportEntryAnimation()
    }
    this.$nextTick(() => this.adjustComposerHeight())
    initTaskListSync()
    this.taskListUnsubscribe = subscribeTaskList(() => {
      this.syncGeneratedOutputTaskRuns()
      this.syncAssistantTaskRuns()
      this.syncWpsCapabilityTaskRuns()
      this.syncDocumentCommentTaskRuns()
    })
    window.addEventListener('focus', this.handleWindowFocus)
    window.addEventListener('storage', this.handleStorageEvent)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    window.addEventListener('mousemove', this.handleSidebarResize)
    window.addEventListener('mouseup', this.stopSidebarResize)
  },
  beforeUnmount() {
    window.removeEventListener('focus', this.handleWindowFocus)
    window.removeEventListener('storage', this.handleStorageEvent)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    window.removeEventListener('mousemove', this.handleSidebarResize)
    window.removeEventListener('mouseup', this.stopSidebarResize)
    this.stopWelcomePromptTyping()
    this.stopAllMissingSkillNoticeTyping()
    Object.values(this.assistantParameterAutoTimers || {}).forEach((timer) => window.clearTimeout(timer))
    this.assistantParameterAutoTimers = {}
    Object.values(this.dialogAutoContinueIntervals || {}).forEach((timer) => window.clearInterval(timer))
    this.dialogAutoContinueIntervals = {}
    Object.values(this.reportGenerationAutoTimers || {}).forEach((timer) => window.clearTimeout(timer))
    this.reportGenerationAutoTimers = {}
    if (this.assistantHighlightTimer) {
      window.clearTimeout(this.assistantHighlightTimer)
      this.assistantHighlightTimer = null
    }
    if (this.assistantEvolutionCheckTimer) {
      window.clearTimeout(this.assistantEvolutionCheckTimer)
      this.assistantEvolutionCheckTimer = null
    }
    if (this.assistantEvolutionProgressTimer) {
      window.clearInterval(this.assistantEvolutionProgressTimer)
      this.assistantEvolutionProgressTimer = null
    }
    this.finishWelcomeSupportExitAnimation()
    if (this.sendLaunchEffectTimer) {
      window.clearTimeout(this.sendLaunchEffectTimer)
      this.sendLaunchEffectTimer = null
    }
    Object.values(this.messageEntryEffectTimers || {}).forEach((timer) => {
      if (timer) window.clearTimeout(timer)
    })
    this.messageEntryEffectTimers = {}
    this.messageEntryEffects = {}
    this.stopAssistantRecommendModalEmptyTyping()
    this.stopAssistantLoadingProgress()
    this.stopAssistantSelfIntroStreaming()
    this.taskListUnsubscribe?.()
    this.taskListUnsubscribe = null
    this.cancelActiveDocumentRevisionRun()
    this.cancelActiveDocumentAwareRun()
    this.cancelActiveGeneratedOutputRun()
    this.aiAssistantWindowSession?.releaseOwnership?.()
    this.aiAssistantWindowSession = null
    this.flushHistorySave()
  },
  methods: {
    getModelLogoPath,
    publicAssetUrl,
    followDonationQrCode() {
      return publicAssetUrl(DONATION_FOLLOW_QR_CODE)
    },
    wechatDonationQrCode() {
      return publicAssetUrl(DONATION_WECHAT_QR_CODE)
    },
    alipayDonationQrCode() {
      return publicAssetUrl(DONATION_ALIPAY_QR_CODE)
    },
    handleStorageEvent(event) {
      if (event?.key !== 'NdDocumentBackupRestoreSignal' || !event?.newValue) return
      try {
        const payload = JSON.parse(event.newValue)
        this.handleBackupRestoreSignal(payload)
      } catch (_) {
        // ignore malformed cross-window sync payload
      }
    },
    handleBackupRestoreSignal(payload = {}) {
      const taskId = String(payload?.taskId || '').trim()
      const sourcePath = String(payload?.sourcePath || '').trim()
      const restoredAt = String(payload?.restoredAt || new Date().toISOString()).trim()
      const stateKeys = [
        'activeAssistantTaskRun',
        'activeGeneratedOutputRun',
        'activeWpsCapabilityRun',
        'activeDocumentCommentRun'
      ]
      let updated = false
      this.chatHistory.forEach((chat) => {
        const messages = Array.isArray(chat?.messages) ? chat.messages : []
        messages.forEach((message) => {
          stateKeys.forEach((stateKey) => {
            const run = message?.[stateKey]
            if (!run) return
            const matchedTask = taskId && String(run.taskId || '').trim() === taskId
            const alreadySynced = String(run.backupRestoredAt || '').trim() === restoredAt
            if (!matchedTask || alreadySynced) return
            run.backupRestoredAt = restoredAt
            run.statusMessage = '关联文档已从历史备份恢复，请重新检查当前结果。'
            this.appendDocumentRevisionDetail(run, sourcePath
              ? `已检测到历史备份恢复：${sourcePath}`
              : '已检测到历史备份恢复，请重新检查当前结果。')
            updated = true
          })
        })
      })
      if (updated) {
        const targetChat = this.currentChat || this.chatHistory[0]
        if (targetChat && Array.isArray(targetChat.messages)) {
          targetChat.messages.push({
            id: `a${Date.now()}`,
            role: 'assistant',
            content: sourcePath
              ? `已同步检测到文档恢复操作，源文件已从历史备份恢复：${sourcePath}。建议重新检查相关任务结果后再继续编辑。`
              : '已同步检测到文档恢复操作，建议重新检查相关任务结果后再继续编辑。',
            recommendations: [],
            generatedFiles: []
          })
        }
        this.saveHistory()
      }
    },
    stopAssistantSelfIntroStreaming() {
      if (this.assistantSelfIntroTimer) {
        window.clearTimeout(this.assistantSelfIntroTimer)
        this.assistantSelfIntroTimer = null
      }
    },
    getAssistantSelfIntroNextChunkSize() {
      return 6 + Math.floor(Math.random() * 11)
    },
    getAssistantSelfIntroNextDelay() {
      return 24 + Math.floor(Math.random() * 46)
    },
    createPendingLocalFaqAction(faq = {}) {
      const supportLevel = String(faq?.supportLevel || '').trim() || 'assistant-buildable'
      const actionType = String(faq?.suggestedAction?.type || '').trim()
      const summaryMap = {
        direct: '当前项目已具备这类能力，也可以继续沉淀成专用助手。',
        partial: '当前项目能覆盖这类需求的一部分，建议按专用助手方式固化流程。',
        'assistant-buildable': '当前更适合通过创建自定义助手来沉淀这类需求。',
        unsupported: '当前没有完全对应的现成功能，但你仍可整理需求后尝试构建专用助手。'
      }
      const actionSummaryMap = {
        'open-model-settings': '当前问题更适合先查看模型配置、接入方式或联网边界。',
        'open-assistant-settings': '当前项目已有比较贴近的现成功能入口，可以先直接查看。',
        'open-assistants-sidebar': '当前项目已有相关功能入口，你可以先查看现有能力。'
      }
      const confirmPromptMap = {
        'open-prefill-assistant': '你可以直接去创建助手并带着预填草稿过去，也可以先查看当前已有功能入口。',
        'open-model-settings': '你可以先去模型设置查看配置和接入方式，也可以继续查看助手列表。',
        'open-assistant-settings': '你可以先打开最相关的现成功能入口，也可以继续查看助手列表。',
        'open-assistants-sidebar': '你可以先去看现有功能入口，也可以继续浏览助手列表。'
      }
      const statusMessageMap = {
        'open-prefill-assistant': '已根据当前问题生成一份可编辑的助手草稿。',
        'open-model-settings': '已为当前问题准备好更贴近的模型配置入口。',
        'open-assistant-settings': '已为当前问题准备好更贴近的现成功能入口。',
        'open-assistants-sidebar': '已为当前问题准备好更贴近的功能入口。'
      }
      return {
        status: 'pending',
        summaryText: actionSummaryMap[actionType] || summaryMap[supportLevel] || summaryMap['assistant-buildable'],
        confirmPrompt: confirmPromptMap[actionType] || confirmPromptMap['open-prefill-assistant'],
        statusMessage: statusMessageMap[actionType] || statusMessageMap['open-prefill-assistant'],
        faq,
        suggestedAction: faq?.suggestedAction || null
      }
    },
    getPendingLocalFaqAssistantTargetKey(pending) {
      const actionKey = String(pending?.suggestedAction?.targetItemKey || '').trim()
      if (actionKey && actionKey !== 'create-custom-assistant') return actionKey

      const faq = pending?.faq || {}
      const hints = Array.isArray(faq?.existingAssistantHints)
        ? faq.existingAssistantHints.map(item => String(item || '').trim()).filter(Boolean)
        : []
      if (hints.length > 0) return hints[0]

      const category = String(faq?.capabilityCategory || '').trim()
      if (category === 'translation') return 'translate'
      if (category === 'report-generation') return 'summary'
      if (category === 'security-audit') return 'analysis.security-check'
      if (category === 'multimodal') return 'text-to-image'
      if (category === 'revision') return 'analysis.rewrite'

      const type = String(faq?.type || '').trim()
      if (type === 'security') return 'analysis.security-check'
      return ''
    },
    clearAssistantItemHighlight() {
      if (this.assistantHighlightTimer) {
        window.clearTimeout(this.assistantHighlightTimer)
        this.assistantHighlightTimer = null
      }
      this.assistantHighlightedKey = ''
    },
    focusAssistantListItem(key = '') {
      const normalizedKey = String(key || '').trim()
      if (!normalizedKey) {
        this.clearAssistantItemHighlight()
        return
      }
      const item = this.getAssistantItemByKey(normalizedKey)
      if (item?.group) {
        this.assistantGroupCollapsed = {
          ...this.assistantGroupCollapsed,
          [item.group]: false
        }
      }
      this.$nextTick(() => {
        const listEl = this.$refs.assistantListRef
        const selectorKey = normalizedKey.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        const targetEl = listEl?.querySelector?.(`[data-assistant-key="${selectorKey}"]`)
        if (!targetEl) return
        this.assistantHighlightedKey = normalizedKey
        targetEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        })
        if (this.assistantHighlightTimer) {
          window.clearTimeout(this.assistantHighlightTimer)
        }
        this.assistantHighlightTimer = window.setTimeout(() => {
          this.assistantHighlightedKey = ''
          this.assistantHighlightTimer = null
        }, 2200)
      })
    },
    focusPendingLocalFaqAssistant(pending) {
      const targetKey = this.getPendingLocalFaqAssistantTargetKey(pending)
      if (!targetKey) {
        this.clearAssistantItemHighlight()
        return
      }
      this.focusAssistantListItem(targetKey)
    },
    openAssistantSettingsWithPrefillDraft(prefillDraft = {}, options = {}) {
      const payload = {
        source: String(options.source || 'local-capability-faq').trim() || 'local-capability-faq',
        title: String(options.title || '').trim(),
        note: String(options.note || '').trim(),
        createdAt: new Date().toISOString(),
        draft: prefillDraft && typeof prefillDraft === 'object' ? JSON.parse(JSON.stringify(prefillDraft)) : {}
      }
      saveAssistantPrefillDraft(payload)
      this.openAssistantSettings(options.itemKey || 'create-custom-assistant')
    },
    confirmPendingLocalFaqAction(message) {
      const pending = message?.pendingLocalFaqAction
      if (!pending || pending.status === 'applying') return
      const actionType = String(pending?.suggestedAction?.type || '').trim()
      if (actionType === 'open-model-settings') {
        pending.status = 'applied'
        pending.statusMessage = '已打开模型设置入口。'
        this.saveHistory()
        this.openModelSettings()
        return
      }
      if (actionType === 'open-assistant-settings') {
        pending.status = 'applied'
        pending.statusMessage = '已打开相关功能入口。'
        this.saveHistory()
        this.openAssistantSettings(String(pending?.suggestedAction?.targetItemKey || 'create-custom-assistant').trim() || 'create-custom-assistant')
        return
      }
      if (actionType === 'open-assistants-sidebar') {
        pending.status = 'applied'
        this.activeSidebarTab = 'assistants'
        this.assistantSearchText = String(pending?.suggestedAction?.searchText || this.getPendingLocalFaqSearchText(pending) || '')
        this.loadAssistantItems()
        this.focusPendingLocalFaqAssistant(pending)
        pending.statusMessage = this.assistantSearchText
          ? `已切换到助手列表，并按“${this.assistantSearchText}”帮你筛出更相关的入口。`
          : '已切换到助手列表。'
        this.saveHistory()
        this.$nextTick(() => this.scrollToBottom())
        return
      }
      const prefillDraft = pending?.suggestedAction?.prefillDraft
      if (!prefillDraft || typeof prefillDraft !== 'object') {
        pending.status = 'failed'
        pending.statusMessage = '当前没有可预填的助手草稿，请稍后重试。'
        this.saveHistory()
        return
      }
      pending.status = 'applied'
      pending.statusMessage = '已打开创建智能助手页面，并带入当前需求的预填草稿。'
      this.saveHistory()
      this.openAssistantSettingsWithPrefillDraft(prefillDraft, {
        source: 'local-capability-faq',
        title: String(pending?.faq?.title || '能力问答预填').trim(),
        note: String(message?.content || '').trim(),
        itemKey: String(pending?.suggestedAction?.targetItemKey || 'create-custom-assistant').trim() || 'create-custom-assistant'
      })
    },
    getPendingLocalFaqViewTarget(pending) {
      const faq = pending?.faq || {}
      const actionType = String(pending?.suggestedAction?.type || '').trim()
      const category = String(faq?.capabilityCategory || '').trim()
      const hints = Array.isArray(faq?.existingAssistantHints)
        ? faq.existingAssistantHints.map(item => String(item || '').trim()).filter(Boolean)
        : []
      if (actionType === 'open-model-settings' || actionType === 'open-assistant-settings') return { type: 'assistants-sidebar' }
      if (category === 'translation') return { type: 'assistant-settings', itemKey: hints[0] || 'translate' }
      if (category === 'report-generation') return { type: 'assistant-settings', itemKey: hints[0] || 'summary' }
      if (category === 'security-audit') return { type: 'assistant-settings', itemKey: hints[0] || 'analysis.security-check' }
      if (category === 'multimodal') return { type: 'assistant-settings', itemKey: hints[0] || 'text-to-image' }
      if (category === 'revision') return { type: 'assistant-settings', itemKey: hints[0] || 'analysis.rewrite' }
      if (category === 'document-operation') return { type: 'assistants-sidebar' }
      if (category === 'custom-assistant') return { type: 'assistants-sidebar' }
      if (faq?.type === 'model-setup' || faq?.type === 'model-support') return { type: 'model-settings' }
      if (hints.length > 0) return { type: 'assistant-settings', itemKey: hints[0] }
      return { type: 'assistants-sidebar' }
    },
    getPendingLocalFaqSearchText(pending) {
      const faq = pending?.faq || {}
      const hints = Array.isArray(faq?.existingAssistantHints)
        ? faq.existingAssistantHints.map(item => String(item || '').trim()).filter(Boolean)
        : []
      for (const key of hints) {
        const matchedItem = this.getAssistantItemByKey(key)
        if (matchedItem?.type !== 'create-custom-assistant') {
          return matchedItem.shortLabel || matchedItem.label || ''
        }
      }

      const category = String(faq?.capabilityCategory || '').trim()
      if (category === 'report-generation') return '报告'
      if (category === 'document-operation') return '文档'
      if (category === 'translation') return '翻译'
      if (category === 'revision') return '润色'
      if (category === 'security-audit') return '审查'
      if (category === 'multimodal') return '多模态'
      if (category === 'structured-extraction') return '提取'

      const type = String(faq?.type || '').trim()
      if (type === 'export-support') return '导出'
      if (type === 'security') return '保密'
      if (type === 'file-types') return '附件'
      return ''
    },
    viewPendingLocalFaqAction(message) {
      const pending = message?.pendingLocalFaqAction
      if (!pending || pending.status === 'applying') return
      const target = this.getPendingLocalFaqViewTarget(pending)
      pending.statusMessage = target.type === 'assistant-settings'
        ? '已打开更贴近当前问题的功能入口，你也可以继续创建专用助手。'
        : target.type === 'model-settings'
          ? '已打开模型设置入口，你也可以继续创建专用助手。'
          : '已切换到助手列表，你可以查看现有能力或继续创建专用助手。'
      this.saveHistory()
      if (target.type === 'assistant-settings') {
        this.openAssistantSettings(target.itemKey || 'create-custom-assistant')
        return
      }
      if (target.type === 'model-settings') {
        this.openModelSettings()
        return
      }
      this.activeSidebarTab = 'assistants'
      this.assistantSearchText = this.getPendingLocalFaqSearchText(pending)
      this.loadAssistantItems()
      this.focusPendingLocalFaqAssistant(pending)
      pending.statusMessage = this.assistantSearchText
        ? `已切换到助手列表，并按“${this.assistantSearchText}”帮你筛出更相关的入口。`
        : '已切换到助手列表，你可以查看现有能力或继续创建专用助手。'
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
    },
    dismissPendingLocalFaqAction(message) {
      const pending = message?.pendingLocalFaqAction
      if (!pending || pending.status === 'applying') return
      message.pendingLocalFaqAction = null
      this.saveHistory()
    },
    startAssistantLocalFaqMessage(prepared, faq) {
      const assistantMsg = prepared?.assistantMsg
      if (!assistantMsg) return

      this.stopAssistantSelfIntroStreaming()
      this.clearAssistantRecommendations(assistantMsg)
      assistantMsg.pendingLocalFaqAction = null
      const faqTitle = String(faq?.title || '本地问答')
      const faqDetail = String(faq?.detail || '本次将直接返回本程序介绍，不再请求大模型。')
      const faqReason = String(faq?.reason || '已识别为本地产品问答，直接返回本程序介绍。')
      assistantMsg.primaryRoute = {
        kind: 'chat',
        confidence: 'high',
        reason: faqReason
      }
      assistantMsg.content = ''
      assistantMsg.isLoading = true
      this.isStreaming = true
      this.streamingContent = ''
      this.startAssistantLoadingProgress(assistantMsg, {
        label: `已识别为${faqTitle}...`,
        detail: faqDetail,
        percent: 18
      })
      this.saveHistory()

      const fullText = this.normalizePlainTextIntroOutput(String(faq?.text || buildRandomAssistantSelfIntro()))
      let cursor = 0
      const step = () => {
        if (cursor >= fullText.length) {
          this.stopAssistantSelfIntroStreaming()
          this.stopAssistantLoadingProgress(assistantMsg)
          assistantMsg.isLoading = false
          this.isStreaming = false
          this.streamingContent = ''
          if (faq?.suggestedAction?.type) {
            assistantMsg.pendingLocalFaqAction = this.createPendingLocalFaqAction(faq)
          }
          this.requestAssistantEvolutionSuggestionCheck()
          this.saveHistory()
          this.$nextTick(() => this.scrollToBottom())
          return
        }

        const chunkSize = this.getAssistantSelfIntroNextChunkSize()
        cursor = Math.min(fullText.length, cursor + chunkSize)
        this.stopAssistantLoadingProgress(assistantMsg)
        assistantMsg.isLoading = false
        this.streamingContent = fullText.slice(0, cursor)
        assistantMsg.content = this.streamingContent
        this.$nextTick(() => this.scrollToBottom())
        this.assistantSelfIntroTimer = window.setTimeout(step, this.getAssistantSelfIntroNextDelay())
      }

      this.$nextTick(() => this.scrollToBottom())
      this.assistantSelfIntroTimer = window.setTimeout(step, 120)
    },
    startAssistantSelfIntroMessage(prepared) {
      this.startAssistantLocalFaqMessage(prepared, {
        type: 'identity',
        title: '助手介绍',
        detail: '本次将直接介绍察元AI文档助手，不再请求大模型自我介绍。',
        reason: '已识别为助手身份介绍请求，直接返回本程序介绍。',
        text: buildRandomAssistantSelfIntro()
      })
    },
    getMessageLongTaskRunEntries(message, options = {}) {
      const includeRevision = !message?.pendingDocumentRevisionAction
      const entries = [
        includeRevision ? {
          key: 'document-revision',
          run: message?.activeDocumentRevisionRun || null,
          summaryText: message?.activeDocumentRevisionRun?.status === 'cancelled'
            ? '文档修订已停止'
            : '正在生成文档修订预览...',
          stopAction: 'document-revision'
        } : null,
        {
          key: 'document-aware',
          run: message?.activeDocumentAwareRun || null,
          summaryText: message?.activeDocumentAwareRun?.summaryText || '正在处理整篇文档...',
          stopAction: 'document-aware'
        },
        {
          key: 'generated-output',
          run: message?.activeGeneratedOutputRun || null,
          summaryText: message?.activeGeneratedOutputRun?.summaryText || '正在生成文件...',
          stopAction: 'generated-output'
        },
        {
          key: 'assistant-task',
          run: message?.activeAssistantTaskRun || null,
          summaryText: message?.activeAssistantTaskRun?.summaryText || '正在执行助手任务...',
          stopAction: 'assistant-task'
        },
        {
          key: 'wps-capability',
          run: message?.activeWpsCapabilityRun || null,
          summaryText: message?.activeWpsCapabilityRun?.summaryText || '正在执行 WPS 操作...',
          stopAction: 'wps-capability'
        },
        {
          key: 'document-comment',
          run: message?.activeDocumentCommentRun || null,
          summaryText: message?.activeDocumentCommentRun?.summaryText || '正在处理批注任务...',
          stopAction: 'document-comment'
        }
      ].filter(item => item?.run)
      if (options.onlyRunning) {
        return entries.filter(item => item.run?.status === 'running')
      }
      return entries
    },
    handleLongTaskRunStop(stopAction, message) {
      if (stopAction === 'document-revision') {
        this.stopDocumentRevisionRun(message)
        return
      }
      if (stopAction === 'document-aware') {
        this.stopDocumentAwareRun(message)
        return
      }
      if (stopAction === 'generated-output') {
        this.stopGeneratedOutputRun(message)
        return
      }
      if (stopAction === 'assistant-task') {
        this.stopAssistantTaskRun(message)
        return
      }
      if (stopAction === 'wps-capability') {
        this.stopWpsCapabilityRun(message)
        return
      }
      if (stopAction === 'document-comment') {
        this.stopDocumentCommentRun(message)
      }
    },
    handleLongTaskRunUndo(stopAction, message) {
      if (stopAction === 'generated-output') {
        this.undoGeneratedOutputRun(message)
        return
      }
      if (stopAction === 'assistant-task') {
        this.undoAssistantTaskRun(message)
        return
      }
      if (stopAction === 'document-comment') {
        this.undoDocumentCommentRun(message)
      }
    },
    handleLongTaskRunRetry(stopAction, message) {
      if (stopAction === 'generated-output') {
        this.retryGeneratedOutputRun(message)
        return
      }
      if (stopAction === 'assistant-task') {
        this.retryAssistantTaskRun(message)
      }
    },
    handleLongTaskRunApply(stopAction, message) {
      if (stopAction !== 'assistant-task') return
      this.applyPendingAssistantTaskPlan(message)
    },
    handleLongTaskRunToggleBackup(stopAction, message, enabled) {
      if (stopAction !== 'assistant-task') return
      const taskId = String(message?.activeAssistantTaskRun?.taskId || '').trim()
      if (!taskId) return
      const task = getTaskById(taskId)
      if (!task) return
      const nextEnabled = enabled === true
      updateTask(taskId, {
        data: {
          ...(task.data || {}),
          documentBackupRequested: nextEnabled
        }
      })
      message.activeAssistantTaskRun = {
        ...(message.activeAssistantTaskRun || {}),
        backupEnabled: nextEnabled
      }
      this.saveHistory()
    },
    handleLongTaskRunOpenDetail(stopAction, message) {
      const taskId = stopAction === 'generated-output'
        ? String(message?.activeGeneratedOutputRun?.taskId || '')
        : stopAction === 'assistant-task'
          ? String(message?.activeAssistantTaskRun?.taskId || '')
          : stopAction === 'wps-capability'
            ? String(message?.activeWpsCapabilityRun?.taskId || '')
            : stopAction === 'document-comment'
              ? String(message?.activeDocumentCommentRun?.taskId || '')
              : ''
      if (!taskId) {
        return
      }
      this.openTaskDetailById(taskId)
    },
    applyPendingAssistantTaskPlan(message) {
      const taskId = String(message?.activeAssistantTaskRun?.taskId || '').trim()
      if (!taskId) return
      if (message?.pendingRevisionModePrompt) return
      const task = getTaskById(taskId)
      if (this.promptRevisionModeBeforeApply(message, 'assistant-task-apply', {
        taskId,
        task,
        summaryText: '检测到即将写回文档，你可以先开启修订模式。',
        confirmPrompt: '点击“开启修订并继续”后，将自动开启文档修订模式，再继续写回；如果不需要，可直接继续。'
      })) {
        return
      }
      this.executePendingAssistantTaskPlan(message)
    },
    async executePendingAssistantTaskPlan(message) {
      const taskId = String(message?.activeAssistantTaskRun?.taskId || '').trim()
      if (!taskId) return
      try {
        const result = await applyAssistantTaskPlan(taskId)
        const latestTask = getTaskById(taskId)
        if (latestTask) {
          message.activeAssistantTaskRun = {
            ...(message.activeAssistantTaskRun || {}),
            status: latestTask.status === 'completed' ? 'completed' : 'running',
            statusMessage: latestTask.data?.applyResult?.message || '已确认写回文档。',
            canApplyPlan: latestTask.data?.pendingApply === true
          }
        }
        if (result?.applyResult?.message) {
          message.content = result.applyResult.message
          this.appendDocumentRevisionDetail(message.activeAssistantTaskRun, `已确认写回：${result.applyResult.message}`)
        }
        this.saveHistory()
      } catch (error) {
        message.content = `[错误] ${this.formatAssistantTaskError(error?.message || '确认写回失败')}`
        this.saveHistory()
      }
    },
    openTaskDetailById(taskId) {
      const normalizedTaskId = String(taskId || '').trim()
      if (!normalizedTaskId) return
      try {
        if (focusExistingTaskListWindow({ taskId: normalizedTaskId, detail: '1' })) {
          return
        }
        this.openDialogRoute('/popup', { taskId: normalizedTaskId, detail: '1' }, '任务清单', DEFAULT_TASK_LIST_WINDOW_WIDTH, DEFAULT_TASK_LIST_WINDOW_HEIGHT)
      } catch (error) {
        console.warn('打开任务详情失败:', error)
      }
    },
    isAssistantMessagePending(msg, index) {
      return msg?.role === 'assistant' && index === this.currentMessages.length - 1 && (this.isStreaming || msg?.isLoading)
    },
    getAssistantLoadingPercent(msg) {
      const value = Number(msg?.loadingState?.percent)
      if (!Number.isFinite(value)) return 0
      return Math.max(0, Math.min(99, Math.round(value)))
    },
    getAssistantLoadingLabel(msg) {
      return prepareDialogDisplayText(String(msg?.loadingState?.label || '已发送，正在思考...'))
    },
    getAssistantLoadingDetail(msg) {
      return prepareDialogDisplayText(String(msg?.loadingState?.detail || '内容已加入会话，正在整理上下文与请求。'))
    },
    getMessagePrimaryRouteLabel(message) {
      const kind = String(message?.primaryRoute?.kind || '').trim()
      if (kind === 'chat') return '普通对话'
      if (kind === 'document-operation') return '文档处理'
      if (kind === 'wps-capability') return 'WPS 操作'
      if (kind === 'generated-output') return '报告或文件生成'
      if (kind === 'assistant-task') return '助手任务'
      return ''
    },
    getMessagePrimaryRouteDetail(message) {
      const label = this.getMessagePrimaryRouteLabel(message)
      const confidence = String(message?.primaryRoute?.confidence || '').trim()
      const reason = String(message?.primaryRoute?.reason || '').trim()
      const parts = [
        label ? `路由结果：${label}` : '',
        confidence ? `置信度：${confidence}` : '',
        reason ? `原因：${reason}` : ''
      ].filter(Boolean)
      return prepareDialogDisplayText(parts.join(' | '))
    },
    appendPrimaryRouteDetail(target, message) {
      const label = this.getMessagePrimaryRouteLabel(message)
      const confidence = String(message?.primaryRoute?.confidence || '').trim()
      const reason = String(message?.primaryRoute?.reason || '').trim()
      if (!target || !label) return
      this.appendDocumentRevisionDetail(target, `主路由：${label}${confidence ? `（置信度：${confidence}）` : ''}`)
      if (reason) {
        this.appendDocumentRevisionDetail(target, `路由说明：${reason}`)
      }
    },
    startAssistantLoadingProgress(message, initialState = {}) {
      this.stopAssistantLoadingProgress()
      if (!message) return
      message.loadingState = {
        label: '已发送，正在准备请求...',
        detail: '内容已加入会话，正在整理上下文与附件信息。',
        percent: 8,
        ...initialState
      }
      this.assistantLoadingMessageId = message.id || ''
      this.assistantLoadingTimer = window.setInterval(() => {
        if (!message?.isLoading || this.assistantLoadingMessageId !== (message.id || '')) {
          this.stopAssistantLoadingProgress(message, { keepState: true })
          return
        }
        const current = Number(message.loadingState?.percent || 0)
        const delta = current < 24 ? 3 : current < 48 ? 2 : current < 72 ? 1 : 0.4
        const next = Math.min(93, Math.round((current + delta) * 10) / 10)
        message.loadingState = {
          ...message.loadingState,
          percent: next
        }
      }, 280)
    },
    updateAssistantLoadingProgress(message, patch = {}) {
      if (!message) return
      const currentPercent = Number(message.loadingState?.percent || 0)
      const nextPercent = Number(patch.percent)
      message.loadingState = {
        ...(message.loadingState || {
          label: '已发送，正在思考...',
          detail: '',
          percent: 0
        }),
        ...patch,
        percent: Number.isFinite(nextPercent)
          ? Math.max(currentPercent, Math.min(99, nextPercent))
          : currentPercent
      }
    },
    stopAssistantLoadingProgress(message = null, options = {}) {
      if (this.assistantLoadingTimer) {
        window.clearInterval(this.assistantLoadingTimer)
        this.assistantLoadingTimer = null
      }
      const keepState = !!options.keepState
      if (message && !keepState) {
        message.loadingState = null
      }
      this.assistantLoadingMessageId = ''
    },
    createCancellableRunError(messageText, code) {
      const error = new Error(String(messageText || '任务已停止'))
      error.code = String(code || 'RUN_CANCELLED')
      return error
    },
    isCancellableRunError(error, code) {
      return error?.code === code
    },
    startCancellableRun(options = {}) {
      const contextKey = String(options.contextKey || '').trim()
      const stateKey = String(options.stateKey || '').trim()
      if (!contextKey || !stateKey) return null
      this.cancelCancellableRun(contextKey, { silent: true })
      const context = {
        messageId: options.message?.id || '',
        cancelled: false,
        abortController: typeof AbortController !== 'undefined' ? new AbortController() : null
      }
      this[contextKey] = context
      if (options.message) {
        options.message[stateKey] = {
          status: 'running',
          summaryText: String(options.summaryText || '').trim(),
          statusMessage: String(options.statusMessage || '').trim(),
          showDetails: false,
          details: []
        }
      }
      return context
    },
    appendDocumentRevisionDetail(target, text) {
      if (!target || !String(text || '').trim()) return
      const cleaned = prepareDialogDisplayText(String(text || '').trim())
      if (!cleaned) return
      const current = Array.isArray(target.details)
        ? target.details
        : Array.isArray(target.processingDetails)
          ? target.processingDetails
          : []
      const next = [
        ...current,
        {
          id: `revision_detail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          text: cleaned
        }
      ]
      if (Array.isArray(target.details)) {
        target.details = next
      } else {
        target.processingDetails = next
      }
    },
    toggleDocumentRevisionDetails(target) {
      if (!target || typeof target !== 'object') return
      target.showDetails = target.showDetails !== true
      this.saveHistory()
    },
    getActiveRunContext(contextKey, message) {
      const context = this[contextKey]
      if (!context || !message?.id) return null
      return context.messageId === message.id ? context : null
    },
    ensureCancellableRunActive(options = {}) {
      const contextKey = String(options.contextKey || '').trim()
      const stateKey = String(options.stateKey || '').trim()
      const context = options.context
      const message = options.message || null
      if (!contextKey || !stateKey) {
        throw this.createCancellableRunError('任务已停止', 'RUN_CANCELLED')
      }
      if (!context || context.cancelled || this[contextKey] !== context) {
        if (message?.[stateKey]) {
          message[stateKey] = {
            ...message[stateKey],
            status: 'cancelled',
            statusMessage: String(options.cancelStatusMessage || '已停止本次任务。')
          }
        }
        throw this.createCancellableRunError(options.cancelErrorMessage, options.cancelErrorCode)
      }
    },
    finishCancellableRun(options = {}) {
      const contextKey = String(options.contextKey || '').trim()
      const stateKey = String(options.stateKey || '').trim()
      const keepContext = !!options.keepContext
      const message = options.message || null
      if (message?.[stateKey]) {
        if (options.status) {
          message[stateKey] = {
            ...message[stateKey],
            status: options.status,
            statusMessage: options.statusMessage || message[stateKey].statusMessage || ''
          }
        } else if (!keepContext) {
          message[stateKey] = null
        }
      }
      if (!keepContext && contextKey) {
        this[contextKey] = null
      }
    },
    cancelCancellableRun(contextKey, options = {}) {
      const key = String(contextKey || '').trim()
      if (!key) return false
      const context = this[key]
      if (!context) return false
      context.cancelled = true
      try {
        context.abortController?.abort()
      } catch (_) {}
      if (!options.silent) {
        this[key] = null
      }
      return true
    },
    stopCancellableRun(options = {}) {
      const contextKey = String(options.contextKey || '').trim()
      const stateKey = String(options.stateKey || '').trim()
      const message = options.message || null
      const context = this.getActiveRunContext(contextKey, message)
      if (!context) return
      context.cancelled = true
      try {
        context.abortController?.abort()
      } catch (_) {}
      if (message?.[stateKey]) {
        message[stateKey] = {
          ...message[stateKey],
          status: 'cancelled',
          statusMessage: String(options.stoppingStatusMessage || '正在停止本次任务...')
        }
        if (options.detailText) {
          this.appendDocumentRevisionDetail(message[stateKey], options.detailText)
        }
      }
      this.saveHistory()
    },
    createDocumentRevisionCancelError() {
      return this.createCancellableRunError('文档修订已停止', 'DOCUMENT_REVISION_CANCELLED')
    },
    isDocumentRevisionCancelledError(error) {
      return this.isCancellableRunError(error, 'DOCUMENT_REVISION_CANCELLED')
    },
    startActiveDocumentRevisionRun(message) {
      return this.startCancellableRun({
        contextKey: 'activeDocumentRevisionRunContext',
        stateKey: 'activeDocumentRevisionRun',
        message,
        statusMessage: '正在生成修订预览...'
      })
    },
    getActiveDocumentRevisionRun(message) {
      return this.getActiveRunContext('activeDocumentRevisionRunContext', message)
    },
    ensureDocumentRevisionRunActive(context, message = null) {
      this.ensureCancellableRunActive({
        contextKey: 'activeDocumentRevisionRunContext',
        stateKey: 'activeDocumentRevisionRun',
        context,
        message,
        cancelStatusMessage: '已停止本次文档修订。',
        cancelErrorMessage: '文档修订已停止',
        cancelErrorCode: 'DOCUMENT_REVISION_CANCELLED'
      })
    },
    finishActiveDocumentRevisionRun(message = null, options = {}) {
      this.finishCancellableRun({
        contextKey: 'activeDocumentRevisionRunContext',
        stateKey: 'activeDocumentRevisionRun',
        message,
        ...options
      })
    },
    cancelActiveDocumentRevisionRun(options = {}) {
      return this.cancelCancellableRun('activeDocumentRevisionRunContext', options)
    },
    stopDocumentRevisionRun(message) {
      this.stopCancellableRun({
        contextKey: 'activeDocumentRevisionRunContext',
        stateKey: 'activeDocumentRevisionRun',
        message,
        stoppingStatusMessage: '正在停止本次文档修订...',
        detailText: '用户手动停止了本次文档修订。'
      })
    },
    createDocumentAwareCancelError() {
      return this.createCancellableRunError('整篇文档处理已停止', 'DOCUMENT_AWARE_CANCELLED')
    },
    isDocumentAwareCancelledError(error) {
      return this.isCancellableRunError(error, 'DOCUMENT_AWARE_CANCELLED')
    },
    startActiveDocumentAwareRun(message, summaryText = '') {
      return this.startCancellableRun({
        contextKey: 'activeDocumentAwareRunContext',
        stateKey: 'activeDocumentAwareRun',
        message,
        summaryText: summaryText || '正在处理整篇文档...',
        statusMessage: '正在准备整篇文档任务...'
      })
    },
    getActiveDocumentAwareRun(message) {
      return this.getActiveRunContext('activeDocumentAwareRunContext', message)
    },
    ensureDocumentAwareRunActive(context, message = null) {
      this.ensureCancellableRunActive({
        contextKey: 'activeDocumentAwareRunContext',
        stateKey: 'activeDocumentAwareRun',
        context,
        message,
        cancelStatusMessage: '已停止本次整篇文档处理。',
        cancelErrorMessage: '整篇文档处理已停止',
        cancelErrorCode: 'DOCUMENT_AWARE_CANCELLED'
      })
    },
    finishActiveDocumentAwareRun(message = null, options = {}) {
      this.finishCancellableRun({
        contextKey: 'activeDocumentAwareRunContext',
        stateKey: 'activeDocumentAwareRun',
        message,
        ...options
      })
    },
    cancelActiveDocumentAwareRun(options = {}) {
      return this.cancelCancellableRun('activeDocumentAwareRunContext', options)
    },
    stopDocumentAwareRun(message) {
      this.stopCancellableRun({
        contextKey: 'activeDocumentAwareRunContext',
        stateKey: 'activeDocumentAwareRun',
        message,
        stoppingStatusMessage: '正在停止本次整篇文档处理...',
        detailText: '用户手动停止了本次整篇文档处理。'
      })
    },
    createGeneratedOutputCancelError() {
      return this.createCancellableRunError('文件生成已停止', 'GENERATED_OUTPUT_CANCELLED')
    },
    isGeneratedOutputCancelledError(error) {
      return this.isCancellableRunError(error, 'GENERATED_OUTPUT_CANCELLED')
    },
    startActiveGeneratedOutputRun(message, summaryText = '') {
      return this.startCancellableRun({
        contextKey: 'activeGeneratedOutputRunContext',
        stateKey: 'activeGeneratedOutputRun',
        message,
        summaryText: summaryText || '正在生成文件...',
        statusMessage: '正在准备文件生成任务...'
      })
    },
    getActiveGeneratedOutputRun(message) {
      return this.getActiveRunContext('activeGeneratedOutputRunContext', message)
    },
    ensureGeneratedOutputRunActive(context, message = null) {
      this.ensureCancellableRunActive({
        contextKey: 'activeGeneratedOutputRunContext',
        stateKey: 'activeGeneratedOutputRun',
        context,
        message,
        cancelStatusMessage: '已停止本次文件生成。',
        cancelErrorMessage: '文件生成已停止',
        cancelErrorCode: 'GENERATED_OUTPUT_CANCELLED'
      })
    },
    finishActiveGeneratedOutputRun(message = null, options = {}) {
      this.finishCancellableRun({
        contextKey: 'activeGeneratedOutputRunContext',
        stateKey: 'activeGeneratedOutputRun',
        message,
        ...options
      })
    },
    cancelActiveGeneratedOutputRun(options = {}) {
      return this.cancelCancellableRun('activeGeneratedOutputRunContext', options)
    },
    stopGeneratedOutputRun(message) {
      const taskId = String(message?.activeGeneratedOutputRun?.taskId || '')
      if (taskId && message?.activeGeneratedOutputRun?.status === 'running') {
        stopMultimodalTask(taskId)
        message.activeGeneratedOutputRun = {
          ...message.activeGeneratedOutputRun,
          status: 'cancelled',
          statusMessage: '正在停止本次文件生成...'
        }
        this.appendDocumentRevisionDetail(message.activeGeneratedOutputRun, '用户手动停止了本次文件生成任务。')
        this.saveHistory()
        return
      }
      this.stopCancellableRun({
        contextKey: 'activeGeneratedOutputRunContext',
        stateKey: 'activeGeneratedOutputRun',
        message,
        stoppingStatusMessage: '正在停止本次文件生成...',
        detailText: '用户手动停止了本次文件生成任务。'
      })
    },
    waitForUiCommit() {
      return new Promise((resolve) => {
        this.$nextTick(() => {
          const schedule = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 16))
          schedule(() => resolve())
        })
      })
    },
    prepareWelcomeSupportEntryAnimation() {
      const nextVariant = pickRandomVariant(WELCOME_ENTRY_ANIMATION_VARIANTS, this.lastWelcomeEntryAnimation)
      this.welcomeEntryAnimation = nextVariant || WELCOME_ENTRY_ANIMATION_VARIANTS[0]
      this.lastWelcomeEntryAnimation = this.welcomeEntryAnimation
      this.welcomeEntryCycle += 1
    },
    clearWelcomeSupportExitAnimationTimer() {
      if (this.welcomeExitCleanupTimer) {
        window.clearTimeout(this.welcomeExitCleanupTimer)
        this.welcomeExitCleanupTimer = null
      }
    },
    startWelcomeSupportExitAnimation() {
      if (this.currentMessages.length !== 0) return
      const containerEl = this.$refs.messagesRef
      const supportEl = this.$refs.welcomeSupportRef
      if (!containerEl || !supportEl || typeof supportEl.cloneNode !== 'function') return
      const containerRect = containerEl.getBoundingClientRect?.()
      const supportRect = supportEl.getBoundingClientRect?.()
      if (!containerRect || !supportRect || !supportRect.width || !supportRect.height) return

      const clone = supportEl.cloneNode(true)
      if (clone?.classList) {
        Array.from(clone.classList).forEach((className) => {
          if (String(className || '').startsWith('welcome-entry-')) {
            clone.classList.remove(className)
          }
        })
      }

      const variant = pickRandomVariant(WELCOME_EXIT_ANIMATION_VARIANTS, this.lastWelcomeExitAnimation) || WELCOME_EXIT_ANIMATION_VARIANTS[0]
      this.lastWelcomeExitAnimation = variant
      this.clearWelcomeSupportExitAnimationTimer()
      this.welcomeExitGhost = {
        visible: true,
        variant,
        html: clone.outerHTML,
        style: {
          left: `${supportRect.left - containerRect.left + containerEl.scrollLeft}px`,
          top: `${supportRect.top - containerRect.top + containerEl.scrollTop}px`,
          width: `${supportRect.width}px`,
          height: `${supportRect.height}px`
        }
      }
      this.welcomeExitCleanupTimer = window.setTimeout(() => {
        this.finishWelcomeSupportExitAnimation()
      }, 1600)
    },
    finishWelcomeSupportExitAnimation() {
      this.clearWelcomeSupportExitAnimationTimer()
      this.welcomeExitGhost = {
        visible: false,
        variant: '',
        html: '',
        style: null
      }
    },
    startSendLaunchEffect() {
      if (this.sendLaunchEffectTimer) {
        window.clearTimeout(this.sendLaunchEffectTimer)
        this.sendLaunchEffectTimer = null
      }
      this.sendLaunchEffect.active = false
      this.$nextTick(() => {
        this.sendLaunchEffect.active = true
        this.sendLaunchEffectTimer = window.setTimeout(() => {
          this.sendLaunchEffect.active = false
          this.sendLaunchEffectTimer = null
        }, 760)
      })
    },
    startMessageEntryEffect(messageId, role = 'user') {
      const normalizedId = String(messageId || '').trim()
      if (!normalizedId) return
      const normalizedRole = String(role || 'user').trim()
      const variantList = normalizedRole === 'assistant'
        ? ASSISTANT_MESSAGE_ENTRY_ANIMATION_VARIANTS
        : USER_MESSAGE_ENTRY_ANIMATION_VARIANTS
      const previousVariant = normalizedRole === 'assistant'
        ? this.lastAssistantMessageEntryAnimation
        : this.lastUserMessageEntryAnimation
      const variant = pickRandomVariant(variantList, previousVariant) || variantList[0]
      if (normalizedRole === 'assistant') {
        this.lastAssistantMessageEntryAnimation = variant
      } else {
        this.lastUserMessageEntryAnimation = variant
      }
      const existingTimer = this.messageEntryEffectTimers?.[normalizedId]
      if (existingTimer) {
        window.clearTimeout(existingTimer)
      }
      this.messageEntryEffects = {
        ...(this.messageEntryEffects || {}),
        [normalizedId]: {
          role: normalizedRole,
          variant
        }
      }
      this.messageEntryEffectTimers = {
        ...(this.messageEntryEffectTimers || {}),
        [normalizedId]: window.setTimeout(() => {
          const nextEffects = { ...(this.messageEntryEffects || {}) }
          const nextTimers = { ...(this.messageEntryEffectTimers || {}) }
          delete nextEffects[normalizedId]
          delete nextTimers[normalizedId]
          this.messageEntryEffects = nextEffects
          this.messageEntryEffectTimers = nextTimers
        }, 1150)
      }
    },
    getMessageEntryEffectClass(message) {
      const messageId = String(message?.id || '').trim()
      if (!messageId) return ''
      const effect = this.messageEntryEffects?.[messageId]
      const variant = typeof effect === 'string' ? effect : effect?.variant
      if (!variant) return ''
      return `message-entry-${variant}`
    },
    stopWelcomePromptTyping() {
      if (this.welcomePromptTimer) {
        window.clearTimeout(this.welcomePromptTimer)
        this.welcomePromptTimer = null
      }
      this.isWelcomePromptTyping = false
    },
    getRandomMissingSkillNoticeText(scene = 'chat') {
      const variants = scene === 'modal'
        ? MISSING_SKILL_MODAL_NOTICE_VARIANTS
        : MISSING_SKILL_CHAT_NOTICE_VARIANTS
      const index = Math.floor(Math.random() * variants.length)
      return variants[index] || variants[0]
    },
    stopMissingSkillNoticeTyping(message) {
      const messageId = String(message?.id || '')
      if (!messageId) return
      const timer = this.missingSkillNoticeTimers?.[messageId]
      if (timer) {
        window.clearTimeout(timer)
      }
      if (this.missingSkillNoticeTimers) {
        delete this.missingSkillNoticeTimers[messageId]
      }
      if (message) {
        message.missingSkillNoticeTyping = false
      }
    },
    stopAllMissingSkillNoticeTyping() {
      Object.values(this.missingSkillNoticeTimers || {}).forEach((timer) => {
        if (timer) {
          window.clearTimeout(timer)
        }
      })
      this.missingSkillNoticeTimers = {}
    },
    startMissingSkillNoticeTyping(message, fullText = '') {
      if (!message) return
      const text = String(fullText || '').trim()
      this.stopMissingSkillNoticeTyping(message)
      message.missingSkillNoticeText = text
      message.missingSkillNoticeDisplayText = ''
      message.missingSkillNoticeTyping = !!text
      if (!text) return
      const step = () => {
        const current = String(message.missingSkillNoticeDisplayText || '')
        const nextLength = Math.min(text.length, current.length + 3)
        message.missingSkillNoticeDisplayText = text.slice(0, nextLength)
        if (nextLength >= text.length) {
          message.missingSkillNoticeTyping = false
          this.stopMissingSkillNoticeTyping(message)
          return
        }
        this.missingSkillNoticeTimers = {
          ...(this.missingSkillNoticeTimers || {}),
          [message.id]: window.setTimeout(step, 30)
        }
      }
      this.missingSkillNoticeTimers = {
        ...(this.missingSkillNoticeTimers || {}),
        [message.id]: window.setTimeout(step, 120)
      }
    },
    stopAssistantRecommendModalEmptyTyping() {
      if (this.assistantRecommendModalEmptyTimer) {
        window.clearTimeout(this.assistantRecommendModalEmptyTimer)
        this.assistantRecommendModalEmptyTimer = null
      }
      this.assistantRecommendModalEmptyTyping = false
    },
    startAssistantRecommendModalEmptyTyping(fullText = '') {
      const text = String(fullText || '').trim()
      this.stopAssistantRecommendModalEmptyTyping()
      this.assistantRecommendModalEmptyText = text
      this.assistantRecommendModalEmptyDisplayText = ''
      this.assistantRecommendModalEmptyTyping = !!text
      if (!text) return
      const step = () => {
        const current = String(this.assistantRecommendModalEmptyDisplayText || '')
        const nextLength = Math.min(text.length, current.length + 3)
        this.assistantRecommendModalEmptyDisplayText = text.slice(0, nextLength)
        if (nextLength >= text.length) {
          this.stopAssistantRecommendModalEmptyTyping()
          this.assistantRecommendModalEmptyDisplayText = text
          return
        }
        this.assistantRecommendModalEmptyTimer = window.setTimeout(step, 30)
      }
      this.assistantRecommendModalEmptyTimer = window.setTimeout(step, 120)
    },
    readLastWelcomePromptIndex() {
      try {
        const raw = window.Application?.PluginStorage?.getItem(STORAGE_KEY_WELCOME_PROMPT_INDEX)
        const value = Number(raw)
        return Number.isInteger(value) ? value : -1
      } catch (e) {
        return -1
      }
    },
    writeLastWelcomePromptIndex(index) {
      try {
        window.Application?.PluginStorage?.setItem(STORAGE_KEY_WELCOME_PROMPT_INDEX, String(index))
      } catch (e) {
        console.debug('保存欢迎语索引失败:', e)
      }
    },
    startWelcomePromptTyping() {
      this.stopWelcomePromptTyping()
      const previousIndex = this.readLastWelcomePromptIndex()
      const { index, text } = getRandomWelcomePrompt({
        previousIndex,
        hasConfiguredModel: this.hasConfiguredChatModels
      })
      this.welcomePromptIndex = index
      this.fullWelcomePrompt = prepareDialogDisplayText(String(text || '').trim())
      this.displayedWelcomePrompt = ''
      this.isWelcomePromptTyping = true
      this.writeLastWelcomePromptIndex(index)

      const step = () => {
        const fullText = this.fullWelcomePrompt
        const nextLength = Math.min(fullText.length, this.displayedWelcomePrompt.length + 3)
        this.displayedWelcomePrompt = fullText.slice(0, nextLength)
        if (nextLength >= fullText.length) {
          this.isWelcomePromptTyping = false
          this.welcomePromptTimer = null
          return
        }
        this.welcomePromptTimer = window.setTimeout(step, 28)
      }

      this.welcomePromptTimer = window.setTimeout(step, 140)
    },
    refreshWelcomePrompt() {
      this.startWelcomePromptTyping()
    },
    handleDonationQrCodeError(kind) {
      if (kind === 'follow') {
        this.showFollowDonationQrCode = false
        return
      }
      if (kind === 'wechat') {
        this.showWechatDonationQrCode = false
        return
      }
      if (kind === 'alipay') {
        this.showAlipayDonationQrCode = false
      }
    },
    refreshModelSelection(options = {}) {
      this.modelGroupsVersion += 1
      this.selectedModelId = getSelectedModelId()
      if (options.refreshWelcomePrompt && this.currentMessages.length === 0) {
        this.refreshWelcomePrompt()
      }
    },
    getConversationModelTaskOverrides() {
      const modelId = String(this.selectedModel?.id || this.selectedModelId || '').trim()
      return modelId ? { conversationModelId: modelId } : {}
    },
    getTooltipInlineStyle(key) {
      const layout = this.tooltipLayouts?.[key]
      if (!layout) return null
      return {
        '--tooltip-shift-x': `${Number(layout.shiftX || 0)}px`,
        '--tooltip-arrow-left': `${Number(layout.arrowLeft || 14)}px`
      }
    },
    updateTooltipLayout(key, event) {
      const host = event?.currentTarget
      if (!host || !key) return
      this.$nextTick(() => {
        const tooltip = host.querySelector('.composer-tooltip')
        if (!tooltip) return
        const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 0
        const margin = 16
        const hostRect = host.getBoundingClientRect()
        const tooltipRect = tooltip.getBoundingClientRect()
        const maxShiftLeft = Math.max(0, hostRect.left - margin)
        const maxShiftRight = Math.max(0, viewportWidth - margin - hostRect.left - tooltipRect.width)
        let shiftX = 0
        const rightOverflow = hostRect.left + tooltipRect.width - (viewportWidth - margin)
        if (rightOverflow > 0) {
          shiftX = -Math.min(rightOverflow, maxShiftLeft)
        } else {
          const leftOverflow = margin - hostRect.left
          if (leftOverflow > 0) {
            shiftX = Math.min(leftOverflow, maxShiftRight)
          }
        }
        const anchorCenter = hostRect.width / 2 - shiftX
        const arrowLeft = Math.max(12, Math.min(tooltipRect.width - 12, anchorCenter))
        this.tooltipLayouts = {
          ...this.tooltipLayouts,
          [key]: {
            shiftX,
            arrowLeft
          }
        }
      })
    },
    closeWindow() {
      try {
        if (window.close) window.close()
      } catch (_) {
        // Ignore window close failures in embedded dialogs.
      }
    },
    handleAIAssistantWindowRequest(request = {}) {
      const action = String(request?.action || 'focus')
      const query = request?.query || {}
      if (String(query?.from || '').trim() === 'context') {
        this.refreshSelectionContext()
      }
      if (action === 'reopen') {
        this.aiAssistantWindowSession?.releaseOwnership?.()
        this.aiAssistantWindowSession = null
        window.setTimeout(() => {
          this.closeWindow()
        }, 30)
        return
      }
      this.consumeExternalPromptQuery(query)
      this.handleWindowFocus()
    },
    consumeExternalPromptQuery(query = {}) {
      const prompt = String(query?.prompt || '').trim()
      if (!prompt) return
      this.userInput = prompt
      this.$nextTick(() => this.adjustComposerHeight())
      if (String(query?.autoSend || '').trim() === '1') {
        window.setTimeout(() => {
          if (String(this.userInput || '').trim() === prompt && !this.isStreaming) {
            this.sendMessage()
          }
        }, 80)
      }
    },
    loadSidebarLayout() {
      try {
        const storedWidth = Number(window.Application?.PluginStorage?.getItem(STORAGE_KEY_SIDEBAR_WIDTH))
        if (Number.isFinite(storedWidth) && storedWidth >= SIDEBAR_MIN_WIDTH) {
          this.sidebarWidth = storedWidth
          this.lastExpandedSidebarWidth = storedWidth
        }
        const collapsedValue = window.Application?.PluginStorage?.getItem(STORAGE_KEY_SIDEBAR_COLLAPSED)
        this.sidebarCollapsed = collapsedValue === true || collapsedValue === 'true'
      } catch (e) {
        console.debug('读取侧栏布局失败:', e)
      }
    },
    saveSidebarLayout() {
      try {
        window.Application?.PluginStorage?.setItem(STORAGE_KEY_SIDEBAR_WIDTH, String(this.sidebarWidth))
        window.Application?.PluginStorage?.setItem(STORAGE_KEY_SIDEBAR_COLLAPSED, String(this.sidebarCollapsed))
      } catch (e) {
        console.debug('保存侧栏布局失败:', e)
      }
    },
    getSidebarMaxWidth() {
      const rootRect = this.$el?.getBoundingClientRect?.()
      const containerWidth = Number(rootRect?.width || 0)
      if (!containerWidth) return SIDEBAR_MAX_WIDTH_FALLBACK
      return Math.max(SIDEBAR_MIN_WIDTH, containerWidth - MAIN_AREA_MIN_WIDTH)
    },
    clampSidebarWidth(width) {
      const maxWidth = this.getSidebarMaxWidth()
      return Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), maxWidth)
    },
    toggleSidebar() {
      if (this.sidebarCollapsed) {
        this.sidebarCollapsed = false
        this.sidebarWidth = this.clampSidebarWidth(this.lastExpandedSidebarWidth || 300)
      } else {
        this.lastExpandedSidebarWidth = this.sidebarWidth
        this.sidebarCollapsed = true
      }
      this.saveSidebarLayout()
    },
    startSidebarResize(event) {
      if (event.button !== 0) return
      event.preventDefault()
      if (this.sidebarCollapsed) {
        this.sidebarCollapsed = false
        this.sidebarWidth = this.clampSidebarWidth(this.lastExpandedSidebarWidth || 300)
      }
      this.isResizingSidebar = true
    },
    handleSidebarResize(event) {
      if (!this.isResizingSidebar) return
      const rootRect = this.$el?.getBoundingClientRect?.()
      if (!rootRect) return
      const nextWidth = this.clampSidebarWidth(event.clientX - rootRect.left)
      this.sidebarWidth = nextWidth
      this.lastExpandedSidebarWidth = nextWidth
    },
    stopSidebarResize() {
      if (!this.isResizingSidebar) return
      this.isResizingSidebar = false
      this.saveSidebarLayout()
    },
    handleWindowFocus() {
      this.syncHistoryScopeWithActiveDocument()
      this.loadAssistantItems()
      this.requestAssistantEvolutionSuggestionCheck()
      this.refreshModelSelection({ refreshWelcomePrompt: true })
      this.refreshSelectionContext()
    },
    handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        this.handleWindowFocus()
      }
    },
    loadAssistantItems() {
      this.assistantItems = getAssistantSettingItems(
        getCustomAssistants(),
        loadAssistantSettings()
      )
    },
    getAssistantEvolutionComparableText(assistant) {
      if (!assistant || typeof assistant !== 'object') return ''
      return [
        assistant.name,
        assistant.description,
        assistant.persona,
        assistant.systemPrompt,
        assistant.userPromptTemplate,
        assistant.reportSettings?.prompt
      ].map(item => String(item || '').trim()).filter(Boolean).join(' ')
    },
    computeAssistantEvolutionSimilarity(left, right) {
      return Number(this.getAssistantEvolutionSimilarityBreakdown(left, right).total || 0)
    },
    getAssistantEvolutionSimilarityBreakdown(left, right) {
      if (!left || !right) {
        return {
          total: 0,
          tokenOverlap: 0,
          nameOverlap: 0,
          capabilityOverlap: 0,
          fingerprintScore: 0,
          fingerprintContribution: 0,
          matchedFingerprintFields: []
        }
      }
      const leftComparableText = this.getAssistantEvolutionComparableText(left)
      const rightComparableText = this.getAssistantEvolutionComparableText(right)
      const leftTokens = createRecommendationBigrams(leftComparableText)
      const rightTokens = createRecommendationBigrams(rightComparableText)
      const leftNameText = String(left.name || '').trim()
      const rightNameText = String(right.name || '').trim()
      const leftNameTokens = createRecommendationBigrams(leftNameText)
      const rightNameTokens = createRecommendationBigrams(rightNameText)
      const leftCapabilityTerms = createAssistantEvolutionCapabilityTerms(`${leftNameText} ${leftComparableText}`)
      const rightCapabilityTerms = createAssistantEvolutionCapabilityTerms(`${rightNameText} ${rightComparableText}`)
      const tokenOverlap = leftTokens.length > 0 && rightTokens.length > 0
        ? leftTokens.filter(item => rightTokens.includes(item)).length / Math.max(1, Math.min(leftTokens.length, rightTokens.length))
        : 0
      const nameOverlap = leftNameTokens.length > 0 && rightNameTokens.length > 0
        ? leftNameTokens.filter(item => rightNameTokens.includes(item)).length / Math.max(1, Math.min(leftNameTokens.length, rightNameTokens.length))
        : 0
      const capabilityOverlap = leftCapabilityTerms.length > 0 && rightCapabilityTerms.length > 0
        ? leftCapabilityTerms.filter(item => rightCapabilityTerms.includes(item)).length / Math.max(1, Math.min(leftCapabilityTerms.length, rightCapabilityTerms.length))
        : 0
      const leftFingerprint = buildAssistantCapabilityFingerprint(left)
      const rightFingerprint = buildAssistantCapabilityFingerprint(right)
      let matchedFingerprintWeight = 0
      let fingerprintWeightTotal = 0
      const matchedFingerprintFields = []
      const directKeys = ['modelType', 'outputFormat', 'documentAction', 'inputSource', 'targetLanguage']
      const keyLabels = {
        modelType: '模型类型',
        outputFormat: '输出格式',
        documentAction: '写回动作',
        inputSource: '输入来源',
        targetLanguage: '目标语言'
      }
      directKeys.forEach((key) => {
        fingerprintWeightTotal += 1
        if (String(leftFingerprint?.[key] || '') && String(leftFingerprint?.[key] || '') === String(rightFingerprint?.[key] || '')) {
          matchedFingerprintWeight += 1
          matchedFingerprintFields.push(keyLabels[key] || key)
        }
      })
      fingerprintWeightTotal += 1
      if (JSON.stringify(leftFingerprint?.reportSettings || {}) === JSON.stringify(rightFingerprint?.reportSettings || {})) {
        matchedFingerprintWeight += 1
        matchedFingerprintFields.push('报告配置')
      }
      fingerprintWeightTotal += 1
      if (JSON.stringify(leftFingerprint?.mediaOptions || {}) === JSON.stringify(rightFingerprint?.mediaOptions || {})) {
        matchedFingerprintWeight += 1
        matchedFingerprintFields.push('媒体配置')
      }
      const fingerprintScore = fingerprintWeightTotal > 0 ? matchedFingerprintWeight / fingerprintWeightTotal : 0
      const fingerprintContribution = fingerprintScore * 0.08
      const total = Math.min(1, tokenOverlap * 0.38 + nameOverlap * 0.28 + capabilityOverlap * 0.26 + fingerprintContribution)
      const hasStrongIntentSignal = nameOverlap >= 0.34 || capabilityOverlap >= 0.5 || tokenOverlap >= 0.72
      return {
        total: hasStrongIntentSignal ? total : Math.min(total, 0.59),
        tokenOverlap,
        nameOverlap,
        capabilityOverlap,
        fingerprintScore,
        fingerprintContribution,
        matchedFingerprintFields
      }
    },
    buildAssistantEvolutionReasonDetails(assistants = []) {
      const items = Array.isArray(assistants) ? assistants.filter(Boolean) : []
      if (items.length < 2) return []
      const pairs = []
      for (let i = 0; i < items.length; i += 1) {
        for (let j = i + 1; j < items.length; j += 1) {
          const left = items[i]
          const right = items[j]
          const detail = this.getAssistantEvolutionSimilarityBreakdown(left, right)
          pairs.push({
            leftName: String(left?.name || '未命名助手').trim(),
            rightName: String(right?.name || '未命名助手').trim(),
            detail
          })
        }
      }
      return pairs
        .sort((a, b) => Number(b.detail?.total || 0) - Number(a.detail?.total || 0))
        .slice(0, 3)
        .map((pair) => {
          const score = Number(pair.detail?.total || 0)
          const tokenPct = Math.round(Number(pair.detail?.tokenOverlap || 0) * 100)
          const namePct = Math.round(Number(pair.detail?.nameOverlap || 0) * 100)
          const capabilityPct = Math.round(Number(pair.detail?.capabilityOverlap || 0) * 100)
          const fingerprintPct = Math.round(Number(pair.detail?.fingerprintScore || 0) * 100)
          const fields = Array.isArray(pair.detail?.matchedFingerprintFields) && pair.detail.matchedFingerprintFields.length
            ? `；基础设置相同：${pair.detail.matchedFingerprintFields.join('、')}`
            : ''
          return `${pair.leftName} 与 ${pair.rightName}：推荐强度 ${Math.round(score * 100)}%（能力意图 ${capabilityPct}%、名称 ${namePct}%、提示词 ${tokenPct}%、基础配置 ${fingerprintPct}%）${fields}。基础配置只作辅助，不会单独触发进化。`
        })
    },
    getAssistantEvolutionSignature(list = []) {
      return (Array.isArray(list) ? list : [])
        .map(item => `${String(item.id || '').trim()}:${String(item.updatedAt || item.createdAt || '').trim()}`)
        .filter(Boolean)
        .sort()
        .join('|')
    },
    getNextAssistantVersion(version = '1.0.0') {
      const parts = String(version || '1.0.0').trim().split('.').map(item => Number(item))
      const major = Number.isFinite(parts[0]) ? parts[0] : 1
      const minor = Number.isFinite(parts[1]) ? parts[1] : 0
      return `${major}.${minor + 1}.0`
    },
    buildAssistantEvolutionSuggestion() {
      const customAssistants = getCustomAssistants()
      if (customAssistants.length < 2) return null
      const edges = new Map()
      customAssistants.forEach((assistant) => {
        edges.set(assistant.id, new Set([assistant.id]))
      })
      for (let i = 0; i < customAssistants.length; i++) {
        for (let j = i + 1; j < customAssistants.length; j++) {
          const score = this.computeAssistantEvolutionSimilarity(customAssistants[i], customAssistants[j])
          if (score >= 0.72) {
            edges.get(customAssistants[i].id)?.add(customAssistants[j].id)
            edges.get(customAssistants[j].id)?.add(customAssistants[i].id)
          }
        }
      }
      const visited = new Set()
      const groups = []
      customAssistants.forEach((assistant) => {
        if (visited.has(assistant.id)) return
        const queue = [assistant.id]
        const ids = []
        while (queue.length > 0) {
          const currentId = queue.shift()
          if (!currentId || visited.has(currentId)) continue
          visited.add(currentId)
          ids.push(currentId)
          ;(edges.get(currentId) || []).forEach((nextId) => {
            if (!visited.has(nextId)) queue.push(nextId)
          })
        }
        if (ids.length >= 2) {
          const assistants = ids
            .map(id => customAssistants.find(item => item.id === id))
            .filter(Boolean)
            .slice(0, 3)
          groups.push(assistants)
        }
      })
      if (groups.length === 0) return null
      const bestGroup = groups.sort((a, b) => {
        const avg = (items) => {
          if (!Array.isArray(items) || items.length < 2) return 0
          let total = 0
          let count = 0
          for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
              total += this.computeAssistantEvolutionSimilarity(items[i], items[j])
              count += 1
            }
          }
          return count > 0 ? total / count : 0
        }
        return avg(b) - avg(a)
      })[0]
      const signature = this.getAssistantEvolutionSignature(bestGroup)
      if (!signature || this.assistantEvolutionDismissedSignatures.includes(signature)) return null
      return {
        signature,
        status: 'pending',
        progress: 0,
        progressLabel: '',
        message: '系统只在核心能力、名称或任务提示词高度接近时建议进化；模型、写回动作、语言等基础配置只作为辅助判断。确认后会生成一个更稳定的进化版，原助手仍会保留。',
        reasonDetails: this.buildAssistantEvolutionReasonDetails(bestGroup),
        assistants: bestGroup.map(item => ({
          id: item.id,
          name: item.name || '未命名助手'
        }))
      }
    },
    requestAssistantEvolutionSuggestionCheck() {
      if (this.assistantEvolutionCheckTimer) {
        window.clearTimeout(this.assistantEvolutionCheckTimer)
      }
      this.assistantEvolutionCheckTimer = window.setTimeout(() => {
        this.assistantEvolutionCheckTimer = null
        const nextSuggestion = this.buildAssistantEvolutionSuggestion()
        if (!nextSuggestion) {
          this.stopAssistantEvolutionProgress()
          if (this.assistantEvolutionSuggestion?.status !== 'completed') {
            this.assistantEvolutionSuggestion = null
          }
          return
        }
        if (this.assistantEvolutionSuggestion?.signature === nextSuggestion.signature) return
        this.assistantEvolutionSuggestion = nextSuggestion
        this.saveHistory()
      }, 240)
    },
    startAssistantEvolutionProgress(suggestion) {
      if (!suggestion) return
      if (this.assistantEvolutionProgressTimer) {
        window.clearInterval(this.assistantEvolutionProgressTimer)
        this.assistantEvolutionProgressTimer = null
      }
      suggestion.progress = Math.max(8, Number(suggestion.progress || 0))
      suggestion.progressLabel = suggestion.progress >= 100
        ? '已完成 100%'
        : `正在进化... ${Math.round(Number(suggestion.progress || 0))}%`
      this.assistantEvolutionProgressTimer = window.setInterval(() => {
        if (!this.assistantEvolutionSuggestion || this.assistantEvolutionSuggestion !== suggestion || suggestion.status !== 'applying') {
          window.clearInterval(this.assistantEvolutionProgressTimer)
          this.assistantEvolutionProgressTimer = null
          return
        }
        const current = Number(suggestion.progress || 0)
        const next = current < 72
          ? current + 8
          : current < 88
            ? current + 3
            : current < 94
              ? current + 1
              : current
        suggestion.progress = Math.min(94, next)
        suggestion.progressLabel = `正在进化... ${Math.round(Number(suggestion.progress || 0))}%`
      }, 360)
    },
    stopAssistantEvolutionProgress() {
      if (this.assistantEvolutionProgressTimer) {
        window.clearInterval(this.assistantEvolutionProgressTimer)
        this.assistantEvolutionProgressTimer = null
      }
    },
    dismissAssistantEvolutionSuggestion() {
      this.stopAssistantEvolutionProgress()
      const signature = String(this.assistantEvolutionSuggestion?.signature || '').trim()
      if (signature && !this.assistantEvolutionDismissedSignatures.includes(signature)) {
        this.assistantEvolutionDismissedSignatures = [
          ...this.assistantEvolutionDismissedSignatures,
          signature
        ]
      }
      this.assistantEvolutionSuggestion = null
      this.saveHistory()
    },
    normalizeMergedAssistantConfig(source = {}, assistants = []) {
      const base = createCustomAssistantDraft()
      const first = assistants[0] || {}
      const latestVersion = getLatestAssistantVersion(String(first?.id || '').trim())
      const sourceVersion = String(latestVersion?.version || first?.version || '1.0.0').trim() || '1.0.0'
      const commonModelType = assistants.reduce((acc, item) => {
        const key = String(item?.modelType || 'chat')
        acc[key] = Number(acc[key] || 0) + 1
        return acc
      }, {})
      const selectedModelType = Object.keys(commonModelType).sort((a, b) => commonModelType[b] - commonModelType[a])[0] || 'chat'
      const displayLocations = Array.from(new Set(
        assistants.flatMap(item => Array.isArray(item?.displayLocations) ? item.displayLocations : [])
      ))
      return {
        ...base,
        ...source,
        name: String(source?.name || `${String(first?.name || '智能助手').trim()}（进化版）`).trim(),
        description: String(source?.description || '').trim(),
        persona: String(source?.persona || '').trim(),
        systemPrompt: String(source?.systemPrompt || base.systemPrompt).trim() || base.systemPrompt,
        userPromptTemplate: String(source?.userPromptTemplate || base.userPromptTemplate).trim() || base.userPromptTemplate,
        temperature: Number.isFinite(Number(source?.temperature)) ? Number(source.temperature) : base.temperature,
        modelType: selectedModelType,
        modelId: String(source?.modelId || first?.modelId || '').trim() || null,
        outputFormat: String(source?.outputFormat || first?.outputFormat || base.outputFormat).trim() || base.outputFormat,
        documentAction: String(source?.documentAction || first?.documentAction || base.documentAction).trim() || base.documentAction,
        inputSource: String(source?.inputSource || first?.inputSource || base.inputSource).trim() || base.inputSource,
        targetLanguage: String(source?.targetLanguage || first?.targetLanguage || base.targetLanguage).trim() || base.targetLanguage,
        version: String(source?.version || this.getNextAssistantVersion(sourceVersion)).trim() || '1.1.0',
        parentAssistantIds: assistants.map(item => String(item?.id || '').trim()).filter(Boolean),
        repairReason: '',
        benchmarkScore: null,
        isPromoted: false,
        reportSettings: normalizeReportSettings(source?.reportSettings, first?.reportSettings || createDefaultReportSettings()),
        mediaOptions: {
          ...base.mediaOptions,
          ...(first?.mediaOptions || {}),
          ...(source?.mediaOptions || {})
        },
        displayLocations: displayLocations.length > 0 ? displayLocations : ['ribbon-more'],
        visibleInRibbon: true
      }
    },
    async buildMergedAssistantConfigWithModel(assistants = []) {
      const model = this.selectedModel
      if (!model?.providerId || !model?.modelId) {
        throw new Error('当前没有可用模型，无法完成助手进化')
      }
      const raw = await chatCompletion({
        providerId: model.providerId,
        modelId: model.modelId,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: [
              '你是一位“自定义助手进化器”，负责将多个功能相近的自定义助手合并为一个更强、更稳定的助手。',
              '你的任务是保留这些助手的经验、角色设定、输出要求和关键属性，输出一个合法 JSON。',
              '只输出 JSON，不要输出 Markdown、解释或额外说明。',
              '输出字段：{"name":"","description":"","persona":"","systemPrompt":"","userPromptTemplate":"","temperature":0.3,"outputFormat":"plain|markdown|bullet-list|json","documentAction":"replace|insert|comment|link-comment|comment-replace|append|none","inputSource":"selection-preferred|selection-only|document","targetLanguage":"中文","reportSettings":{"enabled":false,"type":"general-analysis-report","customType":"","template":"","prompt":""},"mediaOptions":{"aspectRatio":"16:9","duration":"30s","voiceStyle":"专业自然"}}',
              '要求：',
              '1. 合并多个助手的能力边界，避免重复、冲突和空泛描述。',
              '2. systemPrompt 要更完整，userPromptTemplate 要能承接原有要求。',
              '3. 优先保留更稳定、更明确的输出格式和写回方式。',
              '4. name 应体现“进化后更通用但仍清晰”的能力，不要太长。'
            ].join('\n')
          },
          {
            role: 'user',
            content: [
              '请将以下自定义助手合并为一个：',
              JSON.stringify(assistants.map(item => ({
                name: item.name,
                description: item.description,
                persona: item.persona,
                systemPrompt: item.systemPrompt,
                userPromptTemplate: item.userPromptTemplate,
                temperature: item.temperature,
                outputFormat: item.outputFormat,
                documentAction: item.documentAction,
                inputSource: item.inputSource,
                targetLanguage: item.targetLanguage,
                reportSettings: item.reportSettings,
                mediaOptions: item.mediaOptions,
                displayLocations: item.displayLocations
              })), null, 2)
            ].join('\n\n')
          }
        ]
      })
      const parsed = parseAssistantIntentResult(raw)
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('模型未返回可解析的助手进化结果')
      }
      return this.normalizeMergedAssistantConfig(parsed, assistants)
    },
    async confirmAssistantEvolutionSuggestion() {
      const suggestion = this.assistantEvolutionSuggestion
      if (!suggestion || suggestion.status === 'applying') return
      const previousStatus = suggestion.status
      const assistants = suggestion.assistants
        .map(item => getCustomAssistantById(item.id))
        .filter(Boolean)
      if (assistants.length < 2) {
        this.assistantEvolutionSuggestion = null
        return
      }
      suggestion.status = 'applying'
      suggestion.progress = 12
      suggestion.progressLabel = '正在分析可进化能力... 12%'
      suggestion.message = previousStatus === 'review'
        ? '正在发布已确认的进化版本...'
        : '正在合并这些助手的角色、提示词、输出要求和属性...'
      this.startAssistantEvolutionProgress(suggestion)
      try {
        const currentList = getCustomAssistants()
        const now = new Date().toISOString()
        const mergedConfig = suggestion.draftAssistant || await this.buildMergedAssistantConfigWithModel(assistants)
        const evaluationSamples = this.buildAssistantVersionEvaluationSamples(
          assistants.map(item => `${item.name || '未命名助手'}：${item.description || item.persona || ''}`).join('\n'),
          {
            baseline: assistants[0] || {},
            sourceAssistants: assistants,
            documentAction: mergedConfig.documentAction,
            inputSource: mergedConfig.inputSource,
            targetLanguage: mergedConfig.targetLanguage,
            outputFormat: mergedConfig.outputFormat
          }
        )
        const realComparison = suggestion.realComparisonResults?.length
          ? { results: suggestion.realComparisonResults }
          : await this.buildAssistantVersionRealComparison(
              assistants.map(item => `${item.name || '未命名助手'}：${item.description || item.persona || ''}`).join('\n'),
              {
                baseline: assistants[0] || {},
                candidate: mergedConfig,
                sourceAssistants: assistants,
                samples: evaluationSamples,
                documentAction: mergedConfig.documentAction,
                inputSource: mergedConfig.inputSource,
                targetLanguage: mergedConfig.targetLanguage,
                outputFormat: mergedConfig.outputFormat
              }
            )
        const evaluation = suggestion.cachedEvaluation || evaluateAssistantCandidate(mergedConfig, {
          baseline: assistants[0] || {},
          samples: evaluationSamples,
          sourceAssistants: assistants,
          realComparisonResults: realComparison.results
        })
        if (evaluation?.releaseGate?.allowed === false) {
          throw new Error(evaluation.releaseGate.reason || '当前进化版本未通过发布门禁，请先补齐样本或提升健康分。')
        }
        const savedAssistant = {
          ...mergedConfig,
          id: buildCustomAssistantId(mergedConfig.name || '进化助手'),
          sortOrder: currentList.length,
          createdAt: now,
          updatedAt: now,
          version: String(mergedConfig.version || '1.0.0').trim() || '1.0.0',
          parentAssistantIds: assistants.map(item => String(item?.id || '').trim()).filter(Boolean),
          benchmarkScore: evaluation.totalScore,
          releaseGate: evaluation.releaseGate || null,
          isPromoted: false,
          description: [
            String(mergedConfig.description || '').trim(),
            `由 ${assistants.map(item => item.name || '未命名助手').join('、')} 进化而来`
          ].filter(Boolean).join('；')
        }
        if (previousStatus !== 'review' && Array.isArray(realComparison.results) && realComparison.results.length > 0) {
          this.stopAssistantEvolutionProgress()
          this.assistantEvolutionSuggestion = {
            ...suggestion,
            status: 'review',
            progress: 0,
            progressLabel: '已生成发布前预览',
            message: `已生成 ${realComparison.results.length} 个真实对比样本，请先查看旧版/新版差异，再确认发布进化版。`,
            previewResults: realComparison.results,
            draftAssistant: savedAssistant,
            cachedEvaluation: evaluation,
            realComparisonResults: realComparison.results
          }
          this.saveHistory()
          return
        }
        appendAssistantVersion({
          assistantId: savedAssistant.id,
          version: savedAssistant.version,
          sourceAssistantIds: savedAssistant.parentAssistantIds,
          benchmarkScore: evaluation.totalScore,
          isPromoted: false,
          changeSummary: `由 ${assistants.map(item => item.name || '未命名助手').join('、')} 进化生成`,
          evaluation,
          snapshot: savedAssistant
        })
        saveCustomAssistants([...currentList, savedAssistant])
        this.loadAssistantItems()
        this.stopAssistantEvolutionProgress()
        this.assistantEvolutionDismissedSignatures = this.assistantEvolutionDismissedSignatures.filter(item => item !== suggestion.signature)
        this.assistantEvolutionSuggestion = {
          signature: '',
          status: 'completed',
          progress: 100,
          progressLabel: '已完成 100%',
          message: `已完成助手进化，已发布新版本《${savedAssistant.name}》；原助手已保留，评估得分 ${evaluation.totalScore}，真实对比样本 ${evaluation.realComparisonCount || 0} 个。`,
          assistants: [{ id: savedAssistant.id, name: savedAssistant.name }]
        }
        window.setTimeout(() => {
          if (this.assistantEvolutionSuggestion?.status === 'completed') {
            this.assistantEvolutionSuggestion = null
          }
        }, 5000)
      } catch (error) {
        this.stopAssistantEvolutionProgress()
        suggestion.status = 'failed'
        suggestion.progressLabel = ''
        suggestion.message = error?.message || '助手进化失败，原助手已保留，可稍后重试。'
      }
      this.saveHistory()
    },
    isAssistantGroupCollapsed(groupKey) {
      if (this.assistantSearchText) return false
      return !!this.assistantGroupCollapsed[groupKey]
    },
    toggleAssistantGroup(groupKey) {
      this.assistantGroupCollapsed = {
        ...this.assistantGroupCollapsed,
        [groupKey]: !this.assistantGroupCollapsed[groupKey]
      }
    },
    resolveHistoryStorageScope() {
      const doc = getActiveDocument()
      const docLinkId = ensureDocumentChatLinkId(doc)
      const fullName = String(doc?.FullName || '').trim()
      const name = String(doc?.Name || '').trim()
      if (docLinkId) {
        return {
          scopeKey: `doc_${createScopedStorageSuffix(docLinkId)}`,
          documentLinkId: docLinkId,
          source: 'document-variable'
        }
      }
      if (fullName) {
        return {
          scopeKey: `path_${createScopedStorageSuffix(fullName)}`,
          documentLinkId: '',
          source: 'document-path'
        }
      }
      if (name) {
        return {
          scopeKey: `name_${createScopedStorageSuffix(name)}`,
          documentLinkId: '',
          source: 'document-name'
        }
      }
      return {
        scopeKey: 'no_active_document',
        documentLinkId: '',
        source: 'fallback'
      }
    },
    applyHistoryStorageScope(scopeInfo = {}) {
      const scopeKey = String(scopeInfo.scopeKey || 'no_active_document').trim() || 'no_active_document'
      this.historyStorageScopeKey = scopeKey
      this.historyStorageDocumentLinkId = String(scopeInfo.documentLinkId || '').trim()
      this.historyStorageSource = String(scopeInfo.source || '').trim()
      return scopeKey
    },
    getHistoryStorageKeys(scopeKey = '') {
      const normalizedScope = String(scopeKey || this.historyStorageScopeKey || 'no_active_document').trim() || 'no_active_document'
      return {
        history: `${STORAGE_KEY_HISTORY_SCOPE_PREFIX}:${normalizedScope}`,
        current: `${STORAGE_KEY_CURRENT_SCOPE_PREFIX}:${normalizedScope}`
      }
    },
    ensureHistoryStorageScope() {
      return this.applyHistoryStorageScope(this.resolveHistoryStorageScope())
    },
    syncHistoryScopeWithActiveDocument() {
      const nextScope = this.resolveHistoryStorageScope()
      const nextScopeKey = String(nextScope.scopeKey || '').trim()
      if (!nextScopeKey) return false
      if (!this.historyStorageScopeKey) {
        this.applyHistoryStorageScope(nextScope)
        this.loadHistory({ skipScopeResolve: true })
        return true
      }
      if (nextScopeKey === this.historyStorageScopeKey) return false
      this.saveHistory({ skipScopeResolve: true, immediate: true })
      this.applyHistoryStorageScope(nextScope)
      this.loadHistory({ skipScopeResolve: true })
      return true
    },
    isCustomAssistant(item) {
      return item?.type === 'custom-assistant'
    },
    loadHistory(options = {}) {
      try {
        if (!options.skipScopeResolve) {
          this.ensureHistoryStorageScope()
        }
        const storage = window.Application?.PluginStorage
        const storageKeys = this.getHistoryStorageKeys()
        const stored = storage?.getItem(storageKeys.history)
        let parsed = safeParsePluginJson(stored)
        let currentId = storage?.getItem(storageKeys.current)

        if (!Array.isArray(parsed)) {
          const legacyMigrated = storage?.getItem(STORAGE_KEY_LEGACY_HISTORY_MIGRATED)
          if (!legacyMigrated) {
            const legacyHistory = safeParsePluginJson(storage?.getItem(STORAGE_KEY_HISTORY))
            const legacyCurrentId = storage?.getItem(STORAGE_KEY_CURRENT)
            if (Array.isArray(legacyHistory) && legacyHistory.length > 0) {
              parsed = legacyHistory
              currentId = legacyCurrentId
              storage?.setItem(storageKeys.history, JSON.stringify(legacyHistory))
              if (legacyCurrentId) {
                storage?.setItem(storageKeys.current, legacyCurrentId)
              } else {
                storage?.removeItem(storageKeys.current)
              }
            }
            storage?.setItem(STORAGE_KEY_LEGACY_HISTORY_MIGRATED, 'true')
            storage?.removeItem(STORAGE_KEY_HISTORY)
            storage?.removeItem(STORAGE_KEY_CURRENT)
          }
        }

        this.chatHistory = Array.isArray(parsed) ? parsed : []
        if (currentId && this.chatHistory.some(c => c.id === currentId)) {
          this.currentChatId = currentId
        } else if (this.chatHistory.length > 0) {
          this.currentChatId = this.chatHistory[0].id
        } else {
          this.currentChatId = null
        }
      } catch (e) {
        console.warn('加载对话历史失败:', e)
      }
    },
    buildHistorySavePayload(options = {}) {
      const storageKeys = this.getHistoryStorageKeys(options.scopeKey)
      return {
        storageKeys,
        historyJson: JSON.stringify(this.chatHistory),
        currentChatId: this.currentChatId || ''
      }
    },
    writeHistorySavePayload(payload) {
      if (!payload?.storageKeys) return
      const storage = window.Application?.PluginStorage
      storage?.setItem(payload.storageKeys.history, payload.historyJson || '[]')
      if (payload.currentChatId) {
        storage?.setItem(payload.storageKeys.current, payload.currentChatId)
      } else {
        storage?.removeItem(payload.storageKeys.current)
      }
    },
    ensureHistorySavePersister() {
      if (this.historySavePersister) return this.historySavePersister
      this.historySavePersister = createThrottledPersister({
        key: 'ai-assistant-chat-history',
        wait: 320,
        idle: true,
        leading: false,
        getValue: () => this.pendingHistorySavePayload,
        serialize: (payload) => payload
          ? `${payload.storageKeys?.history || ''}\n${payload.currentChatId || ''}\n${payload.historyJson || '[]'}`
          : '',
        write: () => {
          this.writeHistorySavePayload(this.pendingHistorySavePayload)
        },
        onError: (e) => {
          console.debug('保存对话历史失败:', e)
        }
      })
      return this.historySavePersister
    },
    flushHistorySave() {
      try {
        this.historySavePersister?.flush?.()
      } catch (e) {
        console.debug('刷新对话历史保存失败:', e)
      }
    },
    saveHistory(options = {}) {
      try {
        if (!options.skipScopeResolve && !this.historyStorageScopeKey) {
          this.ensureHistoryStorageScope()
        }
        this.pendingHistorySavePayload = this.buildHistorySavePayload(options)
        if (options.immediate === true || options.flush === true) {
          this.writeHistorySavePayload(this.pendingHistorySavePayload)
          return
        }
        this.ensureHistorySavePersister()()
      } catch (e) {
        console.debug('保存对话历史失败:', e)
      }
    },
    newChat() {
      const id = 'chat_' + Date.now()
      this.chatHistory.unshift({ id, title: '新对话', messages: [] })
      this.currentChatId = id
      this.saveHistory()
    },
    switchChat(id) {
      this.currentChatId = id
      this.saveHistory()
    },
    deleteChat(id) {
      const targetIndex = this.chatHistory.findIndex(chat => chat.id === id)
      if (targetIndex < 0) return
      const confirmed = window.confirm('确认删除这个会话吗？删除后无法恢复。')
      if (!confirmed) return
      const remaining = this.chatHistory.filter(chat => chat.id !== id)
      this.chatHistory = remaining
      if (this.currentChatId === id) {
        this.currentChatId = remaining[targetIndex]?.id || remaining[targetIndex - 1]?.id || remaining[0]?.id || null
      }
      this.saveHistory()
    },
    formatMessage(text) {
      if (!text) return ''
      const raw = prepareDialogDisplayText(String(text))
      return raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
    },
    hasMessageGeneratedFiles(message) {
      return Array.isArray(message?.generatedFiles) && message.generatedFiles.length > 0
    },
    persistMessageArtifacts(message, route = 'chat-generated-output') {
      const ownerId = String(message?.id || '').trim()
      const files = Array.isArray(message?.generatedFiles) ? message.generatedFiles.filter(Boolean) : []
      if (!ownerId || files.length === 0) return
      bindArtifactsToOwner('chat-message', ownerId, files.map(file => ({
        ...file,
        ownerType: 'chat-message',
        ownerId,
        route
      })))
    },
    hasAssistantSupplementaryBlocks(message) {
      if (!message || message.role !== 'assistant') return false
      return !!message.pendingLocalFaqAction ||
        !!message.pendingDocumentFormatAction ||
        !!message.pendingDocumentRelocationAction ||
        !!message.pendingDocumentTextEditAction ||
        !!message.pendingDocumentDeleteAction ||
        !!message.pendingRevisionModePrompt ||
        !!message.pendingDocumentOperationChoice ||
        !!message.pendingWpsCapabilityForm ||
        !!message.pendingAssistantIntentChoice ||
        !!message.pendingAssistantRepairChoice ||
        !!message.pendingAssistantParameterCollection ||
        !!message.pendingAssistantExecutionChoice ||
        !!message.pendingAssistantCreationDraft ||
        !!message.pendingReportGenerationForm ||
        !!message.pendingMultimodalGenerationForm ||
        !!message.pendingReportDraftConfirmation ||
        !!message.pendingDocumentRevisionAction ||
        this.getMessageLongTaskRunEntries(message).length > 0
    },
    shouldShowAssistantFooter(message) {
      if (message?.role !== 'assistant') return false
      if (this.isAssistantErrorMessage(message)) return false
      return !!String(message?.content || '').trim() ||
        this.hasMessageGeneratedFiles(message) ||
        this.hasAssistantSupplementaryBlocks(message)
    },
    shouldShowAssistantActions(message) {
      if (!message || this.isAssistantErrorMessage(message)) return false
      return !message.pendingLocalFaqAction &&
        !message.pendingDocumentFormatAction &&
        !message.pendingDocumentRelocationAction &&
        !message.pendingDocumentTextEditAction &&
        !message.pendingDocumentDeleteAction &&
        !message.pendingRevisionModePrompt &&
        !message.pendingDocumentOperationChoice &&
        !message.pendingWpsCapabilityForm &&
        !message.pendingAssistantIntentChoice &&
        !message.pendingAssistantRepairChoice &&
        !message.pendingAssistantParameterCollection &&
        !message.pendingAssistantExecutionChoice &&
        !message.pendingAssistantCreationDraft &&
        !message.pendingReportGenerationForm &&
        !message.pendingMultimodalGenerationForm &&
        !message.pendingReportDraftConfirmation &&
        !message.pendingDocumentRevisionAction &&
        message.activeAssistantTaskRun?.status !== 'running' &&
        message.activeWpsCapabilityRun?.status !== 'running' &&
        message.activeDocumentAwareRun?.status !== 'running' &&
        message.activeGeneratedOutputRun?.status !== 'running' &&
        message.activeDocumentCommentRun?.status !== 'running' &&
        !this.hasMessageGeneratedFiles(message)
    },
    shouldShowGuardQuickActions(message) {
      if (!message || message?.role !== 'assistant') return false
      if (this.isAssistantErrorMessage(message)) return false
      const guardReason = String(message?.activeAssistantTaskRun?.launchGuardReason || '').trim()
      const action = String(message?.activeAssistantTaskRun?.applyAction || '').trim()
      const text = String(message?.content || '').trim()
      return !!guardReason && action === 'none' && !!text
    },
    getGeneratedFileIcon(file) {
      const kind = String(file?.kind || '').toLowerCase()
      if (kind === 'recognition' || kind === 'transcript') return '🧠'
      if (kind === 'image') return '🖼️'
      if (kind === 'video') return '🎬'
      if (kind === 'audio') return '🔊'
      if (String(file?.extension || '').toLowerCase() === 'zip') return '🗜️'
      if (String(file?.extension || '').toLowerCase() === 'json') return '{}'
      if (String(file?.extension || '').toLowerCase() === 'csv') return '🧾'
      if (String(file?.extension || '').toLowerCase() === 'xlsx') return '📊'
      return '📄'
    },
    getGeneratedFileLabel(file) {
      if (this.isGeneratedFilePending(file)) return '生成中'
      if (String(file?.status || '').toLowerCase() === 'error') return '生成失败'
      const extension = String(file?.extension || '').toLowerCase()
      if (extension === 'zip') return 'ZIP 压缩包'
      if (extension === 'json') return 'JSON 文件'
      if (extension === 'csv') return 'CSV 文件'
      if (extension === 'xlsx') return 'Excel 文件'
      if (extension === 'md') return 'Markdown 文件'
      if (extension === 'txt') return '文本文件'
      const kind = String(file?.kind || '').toLowerCase()
      if (kind === 'recognition') return '识别结果'
      if (kind === 'transcript') return '转写结果'
      if (kind === 'image') return '图片文件'
      if (kind === 'video') return '视频文件'
      if (kind === 'audio') return '语音文件'
      return '生成文件'
    },
    isGeneratedFilePending(file) {
      return String(file?.status || '').toLowerCase() === 'pending'
    },
    getGeneratedFileDisplayTitle(file) {
      if (!file) return ''
      return `${file.name}${this.getGeneratedFileLabel(file) ? ` · ${this.getGeneratedFileLabel(file)}` : ''}${file.sizeLabel ? ` · ${file.sizeLabel}` : ''}`
    },
    releaseGeneratedFiles(files = []) {
      ;(Array.isArray(files) ? files : []).forEach((file) => {
        const url = String(file?.downloadUrl || '').trim()
        if (!url || typeof URL?.revokeObjectURL !== 'function') return
        try {
          URL.revokeObjectURL(url)
        } catch (_) {}
      })
    },
    ensureGeneratedFileDownloadUrl(file) {
      if (!file || typeof file !== 'object') return ''
      if (file.downloadUrl) return file.downloadUrl
      if (file.textContent != null) {
        const extension = String(file.extension || '').toLowerCase()
        const mimeType = extension === 'json'
          ? 'application/json;charset=utf-8'
          : extension === 'csv'
            ? 'text/csv;charset=utf-8'
            : extension === 'xlsx'
              ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : extension === 'txt'
              ? 'text/plain;charset=utf-8'
              : 'text/markdown;charset=utf-8'
        const blob = new Blob([String(file.textContent || '')], { type: mimeType })
        file.downloadUrl = URL.createObjectURL(blob)
        file.size = blob.size
        file.sizeLabel = formatAttachmentSize(blob.size)
        return file.downloadUrl
      }
      return ''
    },
    normalizeGeneratedSavePath(path) {
      if (!path || path === false) return ''
      return String(path).replace(/^file:\/\//i, '').replace(/\\\\/g, '/').trim()
    },
    ensureGeneratedFileSaveName(file) {
      const rawName = String(file?.name || '').trim() || '生成结果'
      const extension = String(file?.extension || '').trim().replace(/^\.+/, '')
      if (!extension || rawName.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) {
        return rawName
      }
      return `${rawName}.${extension}`
    },
    arrayBufferToBinaryString(buffer) {
      const bytes = new Uint8Array(buffer)
      let result = ''
      const chunk = 8192
      for (let i = 0; i < bytes.length; i += chunk) {
        result += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)))
      }
      return result
    },
    getGeneratedFileFilter(fileName, extension) {
      const ext = String(extension || '').toLowerCase()
      if (ext === 'zip') return 'ZIP 压缩包 (*.zip), *.zip'
      if (ext === 'md') return 'Markdown (*.md), *.md'
      if (ext === 'json') return 'JSON (*.json), *.json'
      if (ext === 'txt') return '文本文件 (*.txt), *.txt'
      if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return '图片文件 (*.*), *.*'
      if (['mp4', 'webm', 'mov'].includes(ext)) return '视频文件 (*.*), *.*'
      if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return '音频文件 (*.*), *.*'
      const suffix = ext ? `*.${ext}` : '*.*'
      return `${fileName} (${suffix}), ${suffix}`
    },
    getGeneratedFileSavePath(file) {
      const app = window.Application
      if (!app) return ''
      const fileName = this.ensureGeneratedFileSaveName(file)
      const extension = String(file?.extension || '').trim().replace(/^\.+/, '')
      const fileFilter = this.getGeneratedFileFilter(fileName, extension)

      try {
        if (typeof app.GetSaveAsFileName === 'function') {
          const path = app.GetSaveAsFileName(fileName, fileFilter, 1, '保存生成文件', '保存')
          const normalized = this.normalizeGeneratedSavePath(path)
          if (normalized) return normalized
        }
      } catch (error) {
        console.warn('GetSaveAsFileName 失败，尝试 FileDialog:', error?.message || error)
      }

      try {
        const fileDialog = app.FileDialog(2)
        fileDialog.Title = '保存生成文件'
        fileDialog.InitialFileName = fileName
        try {
          fileDialog.Filters.Clear()
          fileDialog.Filters.Add(extension ? `${extension.toUpperCase()} 文件` : '所有文件', extension ? `*.${extension}` : '*.*', 1)
          fileDialog.FilterIndex = 1
        } catch (filterError) {
          console.warn('FileDialog.Filters 不可用:', filterError?.message || filterError)
        }
        if (fileDialog.Show() === -1) {
          return this.normalizeGeneratedSavePath(fileDialog.SelectedItems.Item(1))
        }
      } catch (error) {
        console.warn('FileDialog 失败:', error?.message || error)
      }
      return ''
    },
    async writeGeneratedFileToPath(file, savePath, url) {
      const app = window.Application
      const fs = app?.FileSystem
      if (!fs) return false

      const winPath = savePath.replace(/\//g, '\\')
      const unixPath = savePath.replace(/\\/g, '/')
      const pathsToTry = Array.from(new Set([savePath, winPath, unixPath].filter(Boolean)))

      for (const targetPath of pathsToTry) {
        try {
          if (file?.textContent != null && typeof fs.writeFileString === 'function') {
            if (fs.writeFileString(targetPath, String(file.textContent || ''))) {
              return true
            }
          }
        } catch (error) {
          // Continue trying other filesystem APIs/paths.
        }

        try {
          if (file?.textContent != null && typeof fs.WriteFile === 'function') {
            if (fs.WriteFile(targetPath, String(file.textContent || ''))) {
              return true
            }
          }
        } catch (error) {
          // Continue trying other filesystem APIs/paths.
        }

        try {
          if (typeof fs.writeAsBinaryString === 'function') {
            const buffer = file?.textContent != null
              ? new TextEncoder().encode(String(file.textContent || '')).buffer
              : await fetch(url).then(response => response.arrayBuffer())
            if (fs.writeAsBinaryString(targetPath, this.arrayBufferToBinaryString(buffer))) {
              return true
            }
          }
        } catch (error) {
          // Continue trying other filesystem APIs/paths.
        }
      }

      return false
    },
    triggerGeneratedFileBrowserDownload(url, fileName) {
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    },
    async downloadGeneratedFile(file) {
      if (this.isGeneratedFilePending(file)) {
        alert('附件仍在生成中，请稍候下载')
        return
      }
      const url = this.ensureGeneratedFileDownloadUrl(file)
      if (!url) {
        alert('当前文件下载链接不可用，请重新生成一次')
        return
      }
      const fileName = this.ensureGeneratedFileSaveName(file)
      const savePath = this.getGeneratedFileSavePath(file)
      if (savePath) {
        const saved = await this.writeGeneratedFileToPath(file, savePath, url)
        if (saved) {
          alert('文件已保存：' + savePath.split(/[/\\]/).pop())
          return
        }
        console.warn('WPS API 写入失败，回退到浏览器下载:', savePath)
      }
      this.triggerGeneratedFileBrowserDownload(url, fileName)
    },
    createGeneratedTextFile(content, options = {}) {
      const artifact = createRenderedArtifact(String(content || ''), {
        kind: options.kind || 'report',
        format: options.extension || 'md',
        baseName: sanitizeDownloadFileName(options.baseName || '生成结果', '生成结果')
      })
      return {
        ...artifact,
        status: 'completed',
        sizeLabel: formatAttachmentSize(artifact.size),
        textContent: String(artifact.textContent || '')
      }
    },
    createPendingGeneratedFile(options = {}) {
      const requestedExtension = String(options.extension || 'md').toLowerCase()
      const extension = ['json', 'md', 'csv', 'txt', 'xlsx'].includes(requestedExtension) ? requestedExtension : 'md'
      return {
        id: createGeneratedFileId(),
        kind: options.kind || 'report',
        status: 'pending',
        name: `${sanitizeDownloadFileName(options.baseName || '生成结果', '生成结果')}.${extension}`,
        extension,
        mimeType: '',
        size: 0,
        sizeLabel: '生成中'
      }
    },
    createGeneratedBlobFile(blob, options = {}) {
      const extension = String(options.extension || 'bin').replace(/^\.+/, '') || 'bin'
      const mimeType = String(options.mimeType || blob?.type || 'application/octet-stream').trim() || 'application/octet-stream'
      const artifact = createArtifactRecord({
        id: createGeneratedFileId(),
        kind: options.kind || 'file',
        name: `${sanitizeDownloadFileName(options.baseName || '生成结果', '生成结果')}.${extension}`,
        extension,
        mimeType,
        size: Number(blob?.size || 0),
        downloadUrl: URL.createObjectURL(blob)
      })
      return {
        ...artifact,
        sizeLabel: formatAttachmentSize(blob?.size || 0)
      }
    },
    createGeneratedMediaFile(asset, options = {}) {
      const mimeType = String(asset?.mimeType || options.mimeType || 'application/octet-stream').trim() || 'application/octet-stream'
      const extension = String(asset?.extension || options.extension || 'bin').replace(/^\.+/, '') || 'bin'
      const parts = []
      if (asset?.bytes) {
        parts.push(asset.bytes)
      } else if (asset?.base64) {
        const binary = atob(String(asset.base64 || ''))
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
        parts.push(bytes)
      }
      const blob = new Blob(parts, { type: mimeType })
      const artifact = createArtifactRecord({
        id: createGeneratedFileId(),
        kind: options.kind || 'file',
        name: `${sanitizeDownloadFileName(options.baseName || '生成结果', '生成结果')}.${extension}`,
        extension,
        mimeType,
        size: blob.size,
        downloadUrl: URL.createObjectURL(blob),
        previewText: String(asset?.prompt || '').trim()
      })
      return {
        ...artifact,
        sizeLabel: formatAttachmentSize(blob.size)
      }
    },
    makeArchiveEntryName(rawName, usedNames) {
      const sourceName = String(rawName || '').trim() || '文件'
      const dotIndex = sourceName.lastIndexOf('.')
      const basePart = dotIndex > 0 ? sourceName.slice(0, dotIndex) : sourceName
      const extPart = dotIndex > 0 ? sourceName.slice(dotIndex) : ''
      const safeBase = sanitizeDownloadFileName(basePart, '文件')
      const safeExt = extPart.replace(/[\\/:*?"<>|]+/g, '')
      let candidate = `${safeBase}${safeExt}`
      let counter = 2
      while (usedNames.has(candidate.toLowerCase())) {
        candidate = `${safeBase}-${counter}${safeExt}`
        counter += 1
      }
      usedNames.add(candidate.toLowerCase())
      return candidate
    },
    async createGeneratedZipFile(files, options = {}) {
      const validFiles = Array.isArray(files) ? files.filter(Boolean) : []
      if (validFiles.length === 0) return null
      const signal = options.signal || null
      const zip = new JSZip()
      const usedNames = new Set()
      for (const file of validFiles) {
        if (signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError')
        }
        const entryName = this.makeArchiveEntryName(this.ensureGeneratedFileSaveName(file), usedNames)
        if (file?.textContent != null) {
          zip.file(entryName, String(file.textContent || ''))
          continue
        }
        const url = this.ensureGeneratedFileDownloadUrl(file)
        if (!url) continue
        const response = await fetch(url, { signal })
        zip.file(entryName, await response.arrayBuffer())
      }
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      return this.createGeneratedBlobFile(blob, {
        kind: options.kind || 'archive',
        extension: 'zip',
        mimeType: 'application/zip',
        baseName: options.baseName || '导出结果'
      })
    },
    getFirstConfiguredModelByType(modelType) {
      const groups = getModelGroupsFromSettings(modelType)
      return groups.flatMap(group => group.models || [])[0] || null
    },
    async inferGeneratedOutputIntentWithModel(text, model) {
      try {
        const raw = await chatCompletion({
          providerId: model.providerId,
          modelId: model.modelId,
          temperature: 0,
          messages: [
            {
              role: 'system',
              content: [
                '你是一个 AI 对话请求路由器，只负责判断当前请求是否需要生成可下载文件。',
                '你必须只输出合法 JSON，不要输出 markdown、解释或多余文字。',
                'JSON 格式如下：',
                '{"action":"chat|report|image|video|audio|image-export|object-export","scope":"document|selection|prompt","outputFormat":"md|json|csv|txt|xlsx","fileBaseName":"简短文件名","aspectRatio":"如16:9或1:1","duration":"如8s","voiceStyle":"如专业正式"}',
                '规则：',
                '1. 若用户要求生成报告、并提到模板/参考附件/按附件格式输出，action 设为 report。',
                '2. 若用户明确要求把提炼结果整理成表格、Excel、CSV、清单或台账，action 设为 report；如果明确提到 Excel/xlsx，则 outputFormat 设为 xlsx，否则设为 csv。',
                '3. 若用户要求把提炼/抽取结果以文件、附件、下载文件形式返回，action 设为 report；outputFormat 可根据请求选择 md、txt、json、csv、xlsx。',
                '4. 若用户要求导出/提取文档中的现有图片并作为附件下载，action 设为 image-export，而不是 image。',
                '5. 若用户要求导出/提取文档中的现有附件、文件对象、嵌入对象、OLE 对象，action 设为 object-export。',
                '6. 若用户要求生成图片、图像、海报、插图，action 设为 image。',
                '7. 若用户要求生成视频，action 设为 video；若要求生成语音、音频、朗读、播报，action 设为 audio。',
                '8. 若用户明确说全文、整篇、当前文档，scope= document；若说当前选中/这段/本段，scope= selection；否则 scope= prompt。',
                '9. fileBaseName 保持简短，例如“关键词报告”“提炼结果表格”“提炼结果”“生成图片”“文档图片”“文档附件对象”。',
                '10. 若用户提到画幅比例、横版、竖版、正方形，请补充 aspectRatio；若提到视频时长，请补充 duration；若提到播音风格、音色、语气，请补充 voiceStyle。'
              ].join('\n')
            },
            {
              role: 'user',
              content: [
                `用户请求：${String(text || '').trim()}`,
                `当前是否有上传附件：${this.attachments.length > 0 ? '是' : '否'}`,
                `当前是否存在选区上下文：${this.resolveBestSelectionContext()?.text ? '是' : '否'}`
              ].join('\n')
            }
          ]
        })
        return normalizeGeneratedOutputIntent(parseAssistantIntentResult(raw))
      } catch (error) {
        console.warn('生成文件意图识别失败:', error)
        return null
      }
    },
    async resolveGeneratedOutputIntent(text, model) {
      const ruleIntent = inferGeneratedOutputIntentByRule(text, this.attachments.length)
      if (!maybeNeedsGeneratedOutputAnalysis(text, this.attachments.length) && ruleIntent.action === 'chat') {
        return null
      }
      const modelIntent = maybeNeedsGeneratedOutputAnalysis(text, this.attachments.length)
        ? await this.inferGeneratedOutputIntentWithModel(text, model)
        : null
      const finalIntent = modelIntent?.action && modelIntent.action !== 'chat'
        ? normalizeGeneratedOutputIntent(modelIntent, ruleIntent)
        : ruleIntent
      return finalIntent.action === 'chat' ? null : finalIntent
    },
    selectModel(m) {
      this.selectedModelId = m.id
      this.modelDropdownOpen = false
    },
    onModelSelectBlur() {
      setTimeout(() => { this.modelDropdownOpen = false }, 150)
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
    isImageIcon(icon) {
      const value = String(icon || '').trim()
      return !!value && (
        value.startsWith('images/') ||
        value.startsWith('/images/') ||
        value.startsWith('data:') ||
        value.startsWith('http://') ||
        value.startsWith('https://') ||
        /\.(svg|png|jpe?g|gif|webp)$/i.test(value)
      )
    },
    resolveIconUrl(icon) {
      const value = String(icon || '').trim()
      if (!value) return ''
      if (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://')) {
        return value
      }
      return publicAssetUrl(value.replace(/^\/+/, ''))
    },
    buildDialogUrl(routePath, query = {}) {
      const normalizedRoute = routePath.startsWith('/') ? routePath : `/${routePath}`
      const queryString = new URLSearchParams(query).toString()
      const routeWithQuery = `${normalizedRoute}${queryString ? `?${queryString}` : ''}`
      let base = ''
      try {
        base = window.Application?.PluginStorage?.getItem('AddinBaseUrl') || ''
      } catch (e) {
        console.debug('读取插件基地址失败:', e)
      }
      if (!base) {
        if (window.location.protocol === 'file:') {
          base = window.location.href.replace(/#.*$/, '').replace(/\/index\.html$/i, '')
        } else {
          base = `${window.location.origin}${window.location.pathname}`.replace(/\/index\.html$/i, '')
        }
      }
      const clean = String(base || '')
        .replace(/#.*$/, '')
        .replace(/\/index\.html$/i, '')
        .replace(/\/+$/, '')
      if (clean.startsWith('file:')) {
        return `${clean}/index.html#${routeWithQuery}`
      }
      return `${clean}/#${routeWithQuery}`
    },
    openDialogRoute(routePath, query, title, width, height) {
      const url = this.buildDialogUrl(routePath, query)
      if (window.Application?.ShowDialog) {
        window.Application.ShowDialog(
          url,
          title,
          width * (window.devicePixelRatio || 1),
          height * (window.devicePixelRatio || 1),
          false
        )
        return
      }
      window.open(url, '_blank', 'noopener')
    },
    openAssistantSettings(itemKey = 'create-custom-assistant') {
      openSettingsWindow({ menu: 'assistant-settings', item: itemKey }, { title: '助手设置' })
    },
    openSettingsDialog() {
      openSettingsWindow()
    },
    openExternalWebsite(url) {
      const normalizedUrl = String(url || '').trim()
      if (!normalizedUrl) return
      const app = window.Application || window.opener?.Application || window.parent?.Application
      try {
        if (app?.OAAssist?.ShellExecute) {
          app.OAAssist.ShellExecute(normalizedUrl)
          return
        }
        if (app?.FollowHyperlink) {
          app.FollowHyperlink(normalizedUrl, '', true)
          return
        }
      } catch (e) {
        console.warn('系统浏览器打开链接失败:', e)
      }
      window.open(normalizedUrl, '_blank', 'noopener,noreferrer')
    },
    openSidebarFooterSupportDialog(mode = 'follow') {
      this.sidebarFooterSupportDialogMode = mode === 'support' ? 'support' : 'follow'
    },
    closeSidebarFooterSupportDialog() {
      this.sidebarFooterSupportDialogMode = ''
    },
    openKnowledgeBaseDialog() {
      this.modelDropdownOpen = false
      this.showKnowledgeBaseDialog = true
    },
    closeKnowledgeBaseDialog() {
      this.showKnowledgeBaseDialog = false
    },
    openModelSettings() {
      this.modelDropdownOpen = false
      openSettingsWindow({ menu: 'model-settings' }, { title: '模型设置' })
    },
    deleteCustomAssistant(item) {
      if (!this.isCustomAssistant(item)) return
      const name = item.shortLabel || item.label || '未命名助手'
      const confirmed = window.confirm(`确认删除助手“${name}”吗？删除后无法恢复。`)
      if (!confirmed) return
      const next = getCustomAssistants().filter(entry => entry.id !== item.key)
      const saved = saveCustomAssistants(next)
      if (!saved) {
        alert('删除助手失败，请稍后重试')
        return
      }
      this.loadAssistantItems()
    },
    getRecommendationContextText(seedText = '') {
      const transcript = this.currentMessages
        .slice(-6)
        .map((msg) => {
          const content = String(msg?.content || '').trim()
          if (!content) return ''
          return `${msg.role === 'assistant' ? '助手' : '用户'}：${content}`
        })
        .filter(Boolean)
      const seed = String(seedText || '').trim()
      if (seed) transcript.push(`用户：${seed}`)
      const draft = String(this.userInput || '').trim()
      if (draft && !seed) transcript.push(`用户：${draft}`)
      return transcript.join('\n')
    },
    getAssistantRecommendationPriority(key) {
      const index = DEFAULT_ASSISTANT_RECOMMENDATION_KEYS.indexOf(key)
      return index >= 0 ? index : 999
    },
    getAssistantRecommendationAliases(item) {
      return uniqueAssistantAliases([
        item.shortLabel,
        item.label,
        trimAssistantRecommendationSuffix(item.shortLabel),
        trimAssistantRecommendationSuffix(item.label),
        ...(ASSISTANT_RECOMMENDATION_RULES[item.key] || [])
      ])
    },
    getAssistantRecommendationConfig(item) {
      if (!item?.key) return null
      if (item.type === 'custom-assistant') {
        return getCustomAssistantById(item.key)
      }
      return getAssistantSetting(item.key) || getBuiltinAssistantDefinition(item.key)
    },
    getAssistantRecommendationCorpus(item) {
      const config = this.getAssistantRecommendationConfig(item)
      return [
        item.shortLabel,
        item.label,
        trimAssistantRecommendationSuffix(item.shortLabel),
        trimAssistantRecommendationSuffix(item.label),
        item.description,
        config?.description,
        config?.persona,
        config?.systemPrompt,
        config?.userPromptTemplate
      ]
        .filter(Boolean)
        .join(' ')
    },
    getAssistantRecommendationTerms(item) {
      const fieldTerms = [
        item.shortLabel,
        item.label,
        item.description,
        this.getAssistantRecommendationConfig(item)?.persona,
        this.getAssistantRecommendationConfig(item)?.systemPrompt,
        this.getAssistantRecommendationConfig(item)?.userPromptTemplate,
        trimAssistantRecommendationSuffix(item.shortLabel),
        trimAssistantRecommendationSuffix(item.label)
      ]
        .filter(Boolean)
        .flatMap(text => String(text)
          .split(/[\s,，。；、/｜|（）()]+/)
          .map(part => part.trim())
          .filter(part => part.length >= 2))
      return dedupeRecommendationKeywords([
        ...(ASSISTANT_RECOMMENDATION_RULES[item.key] || []),
        ...fieldTerms
      ])
    },
    getAssistantDirectIntentScore(item, baseText = '') {
      const normalizedText = normalizeRecommendationText(baseText)
      if (!normalizedText) return 0
      const aliases = this.getAssistantRecommendationAliases(item)
      let bestScore = 0
      aliases.forEach((alias) => {
        const normalizedAlias = normalizeRecommendationText(alias)
        if (!normalizedAlias || !normalizedText.includes(normalizedAlias)) return
        if (normalizedAlias === '翻译') {
          bestScore = Math.max(bestScore, 10)
          return
        }
        if ((item.shortLabel && normalizedAlias === normalizeRecommendationText(item.shortLabel)) ||
          (item.label && normalizedAlias === normalizeRecommendationText(trimAssistantRecommendationSuffix(item.label)))) {
          bestScore = Math.max(bestScore, 9)
          return
        }
        bestScore = Math.max(bestScore, normalizedAlias.length >= 4 ? 7 : 6)
      })
      return bestScore
    },
    getAssistantPatternIntentScore(item, baseText = '') {
      const text = String(baseText || '').trim()
      if (!text) return 0
      const patterns = ASSISTANT_INTENT_PATTERNS[item.key] || []
      let bestScore = 0
      patterns.forEach((pattern) => {
        if (!pattern?.test?.(text)) return
        bestScore = Math.max(bestScore, 10)
      })
      return bestScore
    },
    getAssistantFuzzyMatchScore(item, baseText = '') {
      const queryBigrams = createRecommendationBigrams(baseText)
      if (queryBigrams.length === 0) return 0
      const assistantBigrams = createRecommendationBigrams(this.getAssistantRecommendationCorpus(item))
      if (assistantBigrams.length === 0) return 0
      const overlap = queryBigrams.filter(chunk => assistantBigrams.includes(chunk)).length
      if (overlap >= 6) return 6
      if (overlap >= 4) return 4
      if (overlap >= 2) return 2
      return 0
    },
    getAssistantRecommendationConfidence(score, matchedKeywords = [], item = null) {
      if (matchedKeywords.length >= 2 || score >= 10) return 'high'
      if (score >= 6) return 'medium'
      if (item?.type === 'custom-assistant' && score >= 4) return 'medium'
      return 'low'
    },
    createAssistantRecommendationItem(item, score, matchedKeywords = [], fallback = false) {
      const keywords = dedupeRecommendationKeywords(matchedKeywords).slice(0, 3)
      const confidence = fallback ? 'low' : this.getAssistantRecommendationConfidence(score, keywords, item)
      const reasonText = fallback
        ? '常用助手'
        : keywords.length > 0
          ? `匹配：${keywords.join('、')}`
          : '智能推荐'
      return {
        key: item.key,
        label: item.label,
        shortLabel: item.shortLabel || item.label,
        description: item.description || '',
        icon: item.icon,
        type: item.type,
        score,
        confidence,
        matchedKeywords: keywords,
        reasonText,
        reasonDetail: fallback
          ? '当前未命中明确意图，作为常用助手兜底展示。'
          : keywords.length > 0
            ? `命中了这些关键词：${keywords.join('、')}`
            : '根据当前对话语义综合推荐。'
      }
    },
    getInlineAssistantRecommendations(baseText = '') {
      return this.getAssistantRecommendations(baseText, {
        limit: 3,
        allowFallback: false,
        minScore: 6
      })
        .filter(item => item.confidence === 'high')
        .slice(0, 3)
    },
    getRecommendationDisplayName(recommendation) {
      const name = String(recommendation?.shortLabel || recommendation?.label || '').trim()
      if (!name) return '该助手'
      let out
      if (/助手$/.test(name)) out = name
      else if (/设置$/.test(name)) out = name.replace(/设置$/, '助手')
      else out = `${name}助手`
      return prepareDialogDisplayText(out)
    },
    getRecommendationTooltip(recommendation) {
      const lines = [
        this.getRecommendationDisplayName(recommendation)
      ]
      if (recommendation?.description) {
        lines.push(String(recommendation.description).trim())
      }
      if (recommendation?.reasonDetail) {
        lines.push(`推荐原因：${String(recommendation.reasonDetail).trim()}`)
      } else if (recommendation?.reasonText) {
        lines.push(`推荐原因：${String(recommendation.reasonText).trim()}`)
      }
      return prepareDialogDisplayText(lines.filter(Boolean).join('\n'))
    },
    buildAssistantIntentCatalog() {
      return this.assistantItems
        .filter(item => item?.type !== 'create-custom-assistant')
        .map((item) => {
          const config = this.getAssistantRecommendationConfig(item)
          return {
            key: item.key,
            name: this.getRecommendationDisplayName(item),
            description: String(item.description || config?.description || '').trim(),
            aliases: this.getAssistantRecommendationAliases(item).slice(0, 8),
            routingHint: ASSISTANT_MODEL_ROUTING_HINTS[item.key] || '',
            promptHint: String([
              config?.persona,
              config?.systemPrompt,
              config?.userPromptTemplate
            ].filter(Boolean).join(' '))
              .replace(/\s+/g, ' ')
              .slice(0, 180)
          }
        })
    },
    async inferAssistantRecommendationWithModel(baseText = '', model = null) {
      const normalizedText = String(baseText || '').trim()
      if (!normalizedText || !model?.providerId || !model?.modelId) return []
      const catalog = this.buildAssistantIntentCatalog()
      if (catalog.length === 0) return []

      const systemPrompt = [
        '你是一个“智能助手路由器”，负责根据用户当前需求，从可用助手列表中挑选最匹配的 1 到 3 个助手。',
        '判断原则：',
        '1. 只有当用户意图与某个助手高度匹配时，才返回 high。',
        '2. 如果只是弱相关、模糊相关或无法确定，请返回 low，并将 assistantKey 置空。',
        '3. 你必须结合整段对话上下文，而不是只看最后一句。',
        '4. 不要因为助手描述中出现“文档”“内容”“文本”等通用词就误判。',
        '5. 只有用户明确要“翻译/译成某语言/中译英/英译中”时，才选择翻译助手。',
        '6. 用户要求“生成文档摘要/总结文档/概括内容/提炼要点/概要/概述”时，应优先选择摘要助手。',
        '7. 用户要求“对文档进行脱密/脱敏/敏感词替换/抽取涉密关键词用于脱密处理”时，应优先选择涉密关键词提取助手。',
        '8. 用户要求“检查保密风险/涉密风险/敏感信息/合规风险”时，应优先选择保密检查助手。',
        '9. 最多返回 3 个高匹配助手，按匹配度从高到低排序。',
        '10. 返回必须是 JSON，不要输出解释，不要输出 Markdown。',
        'JSON 格式：{"assistantKeys":[""],"confidence":"high|medium|low","reason":""}'
      ].join('\n')

      const userPrompt = [
        '【最近对话内容】',
        normalizedText,
        '',
        '【可用助手列表】',
        JSON.stringify(catalog, null, 2),
        '',
        '请从中选择 1 到 3 个最匹配的助手；如果没有足够把握，请返回 low 且 assistantKeys 为空数组。'
      ].join('\n')

      try {
        const raw = await chatCompletion({
          providerId: model.providerId,
          modelId: model.modelId,
          temperature: 0.1,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
        const parsed = parseAssistantIntentResult(raw)
        const assistantKeys = Array.isArray(parsed?.assistantKeys)
          ? parsed.assistantKeys.map(item => String(item || '').trim()).filter(Boolean)
          : String(parsed?.assistantKey || '').trim()
            ? [String(parsed.assistantKey).trim()]
            : []
        const confidence = String(parsed?.confidence || '').trim().toLowerCase()
        if (!assistantKeys.length || confidence !== 'high') {
          return []
        }
        return assistantKeys
          .map((assistantKey, index) => {
            const matchedItem = this.assistantItems.find(item => item.key === assistantKey && item?.type !== 'create-custom-assistant')
            if (!matchedItem) return null
            return {
              ...this.createAssistantRecommendationItem(
                matchedItem,
                Math.max(12 - index, 9),
                [],
                false
              ),
              confidence,
              reasonText: '模型判定',
              reasonDetail: String(parsed?.reason || '').trim() || '大模型结合最近对话与助手信息综合判断推荐。'
            }
          })
          .filter(Boolean)
          .slice(0, 3)
      } catch (error) {
        console.warn('助手意图分析失败:', error)
        return []
      }
    },
    async resolveAssistantRecommendationsForMessage(contextText, model, assistantMsg) {
      if (this.isAssistantErrorMessage(assistantMsg)) {
        this.clearAssistantRecommendations(assistantMsg)
        return
      }
      assistantMsg.missingSkillNotice = false
      this.stopMissingSkillNoticeTyping(assistantMsg)
      const inferredRecommendations = await this.inferAssistantRecommendationWithModel(contextText, model)
      if (this.isAssistantErrorMessage(assistantMsg)) {
        this.clearAssistantRecommendations(assistantMsg)
        return
      }
      if (inferredRecommendations.length > 0) {
        assistantMsg.recommendations = inferredRecommendations
        this.saveHistory()
        this.$nextTick(() => this.scrollToBottom())
        return
      }
      const directRecommendations = this.getInlineAssistantRecommendations(contextText)
      if (this.isAssistantErrorMessage(assistantMsg)) {
        this.clearAssistantRecommendations(assistantMsg)
        return
      }
      if (directRecommendations.length > 0) {
        assistantMsg.recommendations = directRecommendations
        this.saveHistory()
        return
      }
      assistantMsg.recommendations = []
      assistantMsg.missingSkillNotice = true
      this.startMissingSkillNoticeTyping(assistantMsg, this.getRandomMissingSkillNoticeText('chat'))
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
    },
    scheduleAssistantRecommendationsForMessage(contextText, model, assistantMsg, delay = 900) {
      window.setTimeout(() => {
        if (!assistantMsg || this.isAssistantErrorMessage(assistantMsg)) return
        this.resolveAssistantRecommendationsForMessage(contextText, model, assistantMsg)
      }, Math.max(0, Number(delay) || 0))
    },
    isAssistantErrorMessage(message) {
      return String(message?.content || '').trim().startsWith('[错误]')
    },
    getAssistantErrorKind(message) {
      const normalized = String(message?.content || '').toLowerCase()
      if (/余额不足|insufficient balance|credit balance|quota exceeded|欠费/.test(normalized)) return 'balance'
      if (/api 密钥|api key|鉴权|unauthorized|authentication|auth|令牌/.test(normalized)) return 'auth'
      if (/模型不存在|模型未找到|model not found|not found/.test(normalized)) return 'model'
      if (/请求过于频繁|限流|too many requests|rate limit|额度已用尽/.test(normalized)) return 'rate-limit'
      if (/网络请求失败|network request failed|failed to fetch|fetch failed/.test(normalized)) return 'network'
      if (/服务暂时不可用|稍后重试|5\\d\\d|server error/.test(normalized)) return 'server'
      return 'general'
    },
    shouldRetryAssistantError(message) {
      return ['rate-limit', 'network', 'server', 'general'].includes(this.getAssistantErrorKind(message))
    },
    getAssistantErrorDetailTaskId(message) {
      return String(
        message?.activeGeneratedOutputRun?.taskId ||
        message?.activeAssistantTaskRun?.taskId ||
        message?.activeWpsCapabilityRun?.taskId ||
        message?.activeDocumentCommentRun?.taskId ||
        ''
      ).trim()
    },
    getAssistantErrorRunType(message) {
      if (String(message?.activeGeneratedOutputRun?.taskId || '').trim()) return 'generated-output'
      if (String(message?.activeAssistantTaskRun?.taskId || '').trim()) return 'assistant-task'
      if (String(message?.activeWpsCapabilityRun?.taskId || '').trim()) return 'wps-capability'
      if (String(message?.activeDocumentCommentRun?.taskId || '').trim()) return 'document-comment'
      return ''
    },
    getAssistantErrorPrimaryActionLabel(message) {
      if (this.getAssistantErrorDetailTaskId(message)) return '查看详情'
      const kind = this.getAssistantErrorKind(message)
      if (kind === 'auth') return '检查密钥'
      if (kind === 'model') return '切换模型'
      if (kind === 'balance') return '模型设置'
      return '重试'
    },
    getAssistantErrorSecondaryActionLabel(message) {
      if (this.getAssistantErrorDetailTaskId(message)) {
        return this.shouldRetryAssistantError(message) ? '重试' : '模型设置'
      }
      return this.shouldRetryAssistantError(message) ? '模型设置' : '重试'
    },
    handleAssistantErrorPrimaryAction(message) {
      const detailTaskId = this.getAssistantErrorDetailTaskId(message)
      if (detailTaskId) {
        this.openTaskDetailById(detailTaskId)
        return
      }
      if (this.shouldRetryAssistantError(message)) {
        this.retryAssistantMessage(message)
        return
      }
      this.openModelSettings()
    },
    handleAssistantErrorSecondaryAction(message) {
      if (this.getAssistantErrorDetailTaskId(message)) {
        if (this.shouldRetryAssistantError(message)) {
          const runType = this.getAssistantErrorRunType(message)
          if (runType === 'generated-output') {
            this.handleLongTaskRunRetry(runType, message)
          } else {
            this.retryAssistantMessage(message)
          }
          return
        }
        this.openModelSettings()
        return
      }
      if (this.shouldRetryAssistantError(message)) {
        this.openModelSettings()
        return
      }
      this.retryAssistantMessage(message)
    },
    clearAssistantRecommendations(message) {
      if (!message) return
      message.recommendations = []
      message.missingSkillNotice = false
      message.missingSkillNoticeText = ''
      message.missingSkillNoticeDisplayText = ''
      this.stopMissingSkillNoticeTyping(message)
    },
    findPreviousUserMessage(message) {
      const messages = this.currentMessages
      const index = messages.findIndex(item => item?.id === message?.id)
      if (index <= 0) return null
      for (let i = index - 1; i >= 0; i--) {
        if (messages[i]?.role === 'user') return messages[i]
      }
      return null
    },
    restoreSelectionContextForRetry(snapshot = null) {
      const clonedSnapshot = this.cloneSelectionSnapshot(snapshot)
      this.selectionContextSnapshot = clonedSnapshot
      try {
        if (clonedSnapshot?.text) {
          window.Application?.PluginStorage?.setItem(STORAGE_KEY_SELECTED_CONTEXT, JSON.stringify(clonedSnapshot))
          window.Application?.PluginStorage?.setItem(STORAGE_KEY_SELECTED_CONTENT, String(clonedSnapshot.text || ''))
        } else {
          window.Application?.PluginStorage?.removeItem(STORAGE_KEY_SELECTED_CONTEXT)
          window.Application?.PluginStorage?.removeItem(STORAGE_KEY_SELECTED_CONTENT)
        }
      } catch (_) {
        // Ignore retry context restore failures.
      }
    },
    retryAssistantMessage(message) {
      if (this.isStreaming) return
      const userMessage = this.findPreviousUserMessage(message)
      if (!userMessage) {
        alert('未找到可重试的上一条请求')
        return
      }
      const text = String(userMessage?.content || '').trim()
      const attachments = this.cloneAttachmentSnapshot(userMessage?.messageMeta?.attachments || [])
      this.userInput = text
      this.attachments = this.reindexAttachments(attachments)
      this.restoreSelectionContextForRetry(userMessage?.messageMeta?.selectionSnapshot || null)
      this.$nextTick(() => this.sendMessage())
    },
    getAssistantRecommendations(baseText = '', options = {}) {
      const limit = Number(options.limit || 4)
      const allowFallback = options.allowFallback === true
      const minScore = Number(options.minScore || 1)
      const normalizedText = normalizeRecommendationText(baseText)
      const items = this.assistantItems.filter(item => item?.type !== 'create-custom-assistant')
      const scored = items
        .map((item) => {
          const matchedKeywords = []
          let score = 0
          this.getAssistantRecommendationTerms(item).forEach((term) => {
            const normalizedTerm = normalizeRecommendationText(term)
            if (!normalizedTerm || !normalizedText || !normalizedText.includes(normalizedTerm)) return
            matchedKeywords.push(term)
            score += normalizedTerm.length >= 4 ? 5 : 3
          })
          if (normalizedText) {
            score += this.getAssistantDirectIntentScore(item, normalizedText)
          }
          if (normalizedText) {
            score += this.getAssistantPatternIntentScore(item, baseText)
          }
          if (normalizedText) {
            score += this.getAssistantFuzzyMatchScore(item, normalizedText)
          }
          return {
            item,
            score,
            matchedKeywords: dedupeRecommendationKeywords(matchedKeywords)
          }
        })
        .filter(entry => entry.score >= minScore)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score
          return this.getAssistantRecommendationPriority(a.item.key) - this.getAssistantRecommendationPriority(b.item.key)
        })
        .slice(0, limit)
        .map(entry => this.createAssistantRecommendationItem(entry.item, entry.score, entry.matchedKeywords))

      if (scored.length > 0 || !allowFallback) {
        return scored
      }

      return DEFAULT_ASSISTANT_RECOMMENDATION_KEYS
        .map(key => items.find(item => item.key === key))
        .filter(Boolean)
        .slice(0, limit)
        .map(item => this.createAssistantRecommendationItem(item, 0, [], true))
    },
    getTextSnippet(text, limit = 28) {
      const value = String(text || '').replace(/\s+/g, ' ').trim()
      if (!value) return ''
      return value.length > limit ? `${value.slice(0, limit)}...` : value
    },
    getInsertModalTitle() {
      if (this.insertModalMode === 'replace') return '替换文档内容'
      if (this.insertModalMode === 'append') return '追加到文末'
      if (this.insertModalMode === 'comment') return '插入批注'
      return '插入到文档'
    },
    openAssistantRecommendPanel(options = {}) {
      this.loadAssistantItems()
      this.stopAssistantRecommendModalEmptyTyping()
      const sourceText = String(options.sourceText || '').trim()
      const items = Array.isArray(options.items) && options.items.length > 0
        ? options.items
        : this.getAssistantRecommendations(
          this.getRecommendationContextText(sourceText),
          { limit: 6, allowFallback: options.forceFallback !== false }
        )
      this.assistantRecommendModalItems = items
      if (sourceText) {
        this.assistantRecommendModalContext = `已根据“${this.getTextSnippet(sourceText, 24)}”推荐以下助手。`
      } else if (items.some(item => item.reasonText && item.reasonText !== '常用助手')) {
        this.assistantRecommendModalContext = '已根据当前输入和最近对话推荐以下助手。'
      } else {
        this.assistantRecommendModalContext = items.length > 0
          ? '当前未识别出明确助手意图，先为你展示常用助手。'
          : '可直接在对话中继续描述需求，或通过下方渠道反馈专项能力需求。'
      }
      if (items.length === 0) {
        this.startAssistantRecommendModalEmptyTyping(this.getRandomMissingSkillNoticeText('modal'))
      } else {
        this.assistantRecommendModalEmptyText = ''
        this.assistantRecommendModalEmptyDisplayText = ''
        this.assistantRecommendModalEmptyTyping = false
      }
      this.showAssistantRecommendModal = true
    },
    getAssistantItemByKey(key) {
      return this.assistantItems.find(item => item.key === key) || null
    },
    runRecommendedAssistant(recommendation) {
      const item = this.getAssistantItemByKey(recommendation?.key)
      if (!item) {
        alert('未找到对应助手')
        return
      }
      this.showAssistantRecommendModal = false
      this.runAssistant(item)
    },
    openRecommendedAssistantWindow(recommendation) {
      if (!recommendation?.key) return
      this.showAssistantRecommendModal = false
      this.openAssistantSettings(recommendation.key)
    },
    shouldTryDocumentFormatIntent(text) {
      const normalized = String(text || '').trim()
      if (!normalized) return false
      if (!DOCUMENT_FORMAT_TRIGGER_PATTERN.test(normalized)) return false
      return /(段落|全文|文档|选中|文字|文本|搜索|查找|匹配|加粗|字体|字号|颜色|背景色|高亮|行间距|对齐|缩进|段前|段后|标红|红字|蓝字|绿字|黄字|五号|小四|小五|六号|标题|正文|表格|单元格)/.test(normalized)
    },
    shouldTryDocumentRelocationIntent(text) {
      const normalized = String(text || '').trim()
      if (!normalized) return false
      if (!DOCUMENT_RELOCATION_TRIGGER_PATTERN.test(normalized)) return false
      return /(段落|文首|文末|开头|末尾|第\s*[一二三四五六七八九十两\d]+\s*段)/.test(normalized)
    },
    inferDocumentRelocationIntentByRule(text) {
      const normalized = String(text || '').trim()
      if (!this.shouldTryDocumentRelocationIntent(normalized)) return null
      const matched = normalized.match(/^(.*?)\s*(移动到|移动至|移到|移至|挪到|挪至|复制到|复制至|拷贝到|拷贝至)\s*(.+)$/)
      if (!matched?.[1] || !matched?.[2] || !matched?.[3]) return null
      const source = parseRelocationSourceSpec(matched[1])
      const destination = parseRelocationDestinationSpec(matched[3])
      const placeholderText = parseRelocationPlaceholderText(normalized)
      const preserveFormatting = parseRelocationPreserveFormatting(normalized)
      if (!source || !destination) return null
      return normalizeDocumentRelocationIntent({
        intent: 'document-relocation',
        operation: /(复制|拷贝)/.test(matched[2]) ? 'copy' : 'move',
        sourceType: source.sourceType,
        sourceIndex: source.sourceIndex,
        searchText: source.searchText,
        keywordList: source.keywordList,
        keywordRelation: source.keywordRelation,
        targetMode: source.targetMode,
        limitCount: source.limitCount,
        placeholderText,
        preserveFormatting,
        destinationType: destination.destinationType,
        destinationIndex: destination.destinationIndex,
        placement: destination.placement
      })
    },
    shouldTryDocumentTextEditIntent(text) {
      const normalized = String(text || '').trim()
      if (!normalized) return false
      if (!DOCUMENT_TEXT_EDIT_TRIGGER_PATTERN.test(normalized)) return false
      return /替换|改成|改为|换成|删除|删掉|移除|去掉/.test(normalized)
    },
    inferDocumentTextEditIntentByRule(text) {
      const normalized = String(text || '').trim()
      if (!this.shouldTryDocumentTextEditIntent(normalized)) return null
      const hasDocumentScope = FULL_DOCUMENT_REFERENCE_PATTERN.test(normalized) || /(全文|全篇|整个文档|当前文档|文档全文)/.test(normalized)
      const hasSelectionScope = /(选中|选区|当前选择|所选|选中文字|选中的内容)/.test(normalized)
      const hasParagraphScope = /(当前段落|本段|这段|这一段)/.test(normalized)
      const targetsParagraphByKeyword = /(所在的段落|所在段落|包含.*段落|含有.*段落|有.*段落)/.test(normalized)
      const keywordRelation = parseKeywordRelationFromText(normalized)
      const targetModeSpec = parseTargetModeFromText(normalized)
      const scope = hasDocumentScope
        ? 'document'
        : hasSelectionScope
          ? 'selection'
          : hasParagraphScope
            ? 'paragraph'
            : 'selection'
      const targetUnit = targetsParagraphByKeyword ? 'paragraph' : 'text'
      const replaceMatch = normalized.match(
        /(?:把|将)?(.+?)\s*(?:替换为|替换成|改为|改成|换成)\s*[“"'《]?([^“”"'《》\n]+)[”"'》]?$/i
      )
      if (replaceMatch?.[1] && replaceMatch?.[2]) {
        const searchText = cleanDocumentKeywordText(replaceMatch[1])
        const replacementText = cleanDocumentKeywordText(replaceMatch[2])
        if (searchText && replacementText) {
          const keywordList = extractKeywordListFromText(searchText)
          return normalizeDocumentTextEditIntent({
            intent: 'document-text-edit',
            operation: 'replace',
            scope,
            searchText,
            keywordList: keywordList.length > 0 ? keywordList : [searchText],
            keywordRelation,
            replacementText,
            targetUnit,
            targetMode: targetsParagraphByKeyword ? targetModeSpec.targetMode : 'all',
            limitCount: targetsParagraphByKeyword ? targetModeSpec.limitCount : null
          })
        }
      }
      const deleteMatch = normalized.match(
        /(?:删除|删掉|移除|去掉)(?:.*?(?:关键词|关键字|字样|文本|内容))?(?:.*?(?:中|里))?\s*[“"'《]?([^“”"'《》\n，。；;]+)[”"'》]?\s*$/i
      )
      if (deleteMatch?.[1]) {
        const searchText = cleanDocumentKeywordText(deleteMatch[1])
        if (searchText && !/^(?:表格|图片|图像|配图|插图|批注|注释|当前段落|本段|这段|这一段|全文|全篇|整个文档|当前文档)$/.test(searchText)) {
          const keywordList = extractKeywordListFromText(searchText)
          return normalizeDocumentTextEditIntent({
            intent: 'document-text-edit',
            operation: 'delete',
            scope,
            searchText,
            keywordList: keywordList.length > 0 ? keywordList : [searchText],
            keywordRelation,
            replacementText: '',
            targetUnit,
            targetMode: targetsParagraphByKeyword ? targetModeSpec.targetMode : 'all',
            limitCount: targetsParagraphByKeyword ? targetModeSpec.limitCount : null
          })
        }
      }
      return null
    },
    shouldTryDocumentDeleteIntent(text) {
      const normalized = String(text || '').trim()
      if (!normalized) return false
      if (!DOCUMENT_DELETE_TRIGGER_PATTERN.test(normalized)) return false
      return DOCUMENT_DELETE_TARGET_PATTERN.test(normalized) || /(清空全文|清空文档|删除全文|删除整个文档|删除当前文档)/.test(normalized)
    },
    inferDocumentDeleteIntentByRule(text) {
      const normalized = String(text || '').trim()
      if (!this.shouldTryDocumentDeleteIntent(normalized)) return null
      const paragraphIndex = detectDeleteParagraphIndex(normalized)
      const hasDocumentScope = FULL_DOCUMENT_REFERENCE_PATTERN.test(normalized) || /(全文|全篇|整个文档|当前文档|文档全文)/.test(normalized)
      const hasSelectionScope = /(选中|选区|当前选择|所选|选中文字|选中的内容)/.test(normalized)
      const hasParagraphScope = /(当前段落|本段|这段|这一段)/.test(normalized)
      const hasCurrentObjectScope = /(当前表格|这个表格|该表格|所在表格|当前图片|这张图片|该图片|所在图片|当前批注|这个批注|该批注|所在批注)/.test(normalized)
      const hasAllObjectScope = /(所有表格|全部表格|所有图片|全部图片|所有图像|全部图像|所有批注|全部批注)/.test(normalized)
      let target = ''
      if (paragraphIndex) {
        target = 'paragraph-index'
      } else if (/(批注|注释)/.test(normalized)) {
        target = 'comment'
      } else if (/(图片|图像|配图|插图)/.test(normalized)) {
        target = 'image'
      } else if (/(表格)/.test(normalized)) {
        target = 'table'
      } else if (hasParagraphScope) {
        target = 'paragraph'
      } else if (hasSelectionScope) {
        target = 'selection'
      } else if (hasDocumentScope || /(清空全文|清空文档|删除全文|删除整个文档|删除当前文档)/.test(normalized)) {
        target = 'document'
      }
      if (!target) return null
      const scope = target === 'document'
        ? 'document'
        : target === 'paragraph'
          ? 'paragraph'
          : target === 'selection'
            ? 'selection'
            : target === 'paragraph-index'
              ? 'document'
              : hasAllObjectScope
                ? 'document'
              : hasDocumentScope
                ? 'document'
                : (hasParagraphScope && !hasCurrentObjectScope)
                  ? 'paragraph'
                  : 'selection'
      return normalizeDocumentDeleteIntent({
        intent: 'document-delete',
        target,
        scope,
        paragraphIndex
      })
    },
    inferDocumentFormatIntentByRule(text) {
      const normalized = String(text || '').trim()
      if (!this.shouldTryDocumentFormatIntent(normalized)) return null
      const genericColorRegex = new RegExp(`(?:改为|设为|设置为|变成)\\s*(${STYLE_COLOR_VALUE_PATTERN})`, 'i')
      const markFontColorRegex = /(标红|红字|标蓝|蓝字|标绿|绿字|标黄|黄字|标紫|紫字|标灰|灰字)/i
      const searchMatch = normalized.match(
        /(?:搜索|查找|匹配)\s*[“"'《]?([^“”"'《》\s，。；;,]+)/i
      ) || normalized.match(
        /对\s*[“"'《]?([^“”"'《》\s，。；;,]+)[”"'》]?\s*(?:进行|做)?(?:加粗|粗体|设置|改成|改为|变成|设为)/i
      ) || normalized.match(
        /(?:把|将|所有|全文里所有|全文中所有)\s*[“"'《]?([^“”"'《》\s，。；;,]+)[”"'》]?\s*(?:改成|改为|设为|变成|标红|红字|标蓝|蓝字|标绿|绿字|标黄|黄字|标紫|紫字|标灰|灰字|高亮|加粗|粗体)/i
      )
      const fontMatch = normalized.match(
        /(?:字体(?:改为|设为|设置为)?|改为|设为)\s*(宋体|黑体|仿宋|楷体|微软雅黑|Arial|Calibri|Times New Roman)/i
      ) || normalized.match(/(宋体|黑体|仿宋|楷体|微软雅黑|Arial|Calibri|Times New Roman)/i)
      const namedFontSizeMatch = normalized.match(/(小初|初号|小一|一号|小二|二号|小三|三号|小四|四号|小五|五号|小六|六号|七号|八号)/i)
      const fontColorMatch = normalized.match(
        new RegExp(`(?:文字颜色|字体颜色|字色|颜色)(?:改为|设为|设置为)?\\s*(${STYLE_COLOR_VALUE_PATTERN})`, 'i')
      )
      const backgroundColorMatch = normalized.match(
        new RegExp(`(?:背景色|高亮|底纹)(?:改为|设为|设置为)?\\s*(${STYLE_COLOR_VALUE_PATTERN})`, 'i')
      )
      const genericColorMatch = normalized.match(genericColorRegex)
      const targetSelector = inferDocumentFormatTargetSelector(normalized)
      const markFontColorMap = {
        标红: '红色',
        红字: '红色',
        标蓝: '蓝色',
        蓝字: '蓝色',
        标绿: '绿色',
        绿字: '绿色',
        标黄: '黄色',
        黄字: '黄色',
        标紫: '紫色',
        紫字: '紫色',
        标灰: '灰色',
        灰字: '灰色'
      }
      const resolvedFontColor = fontColorMatch?.[1]
        || (backgroundColorMatch ? '' : (genericColorMatch?.[1] || ''))
        || markFontColorMap[markFontColorRegex.exec(normalized)?.[1] || '']
        || ''
      const fontSizeMatch = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:磅|pt|号)/i)
      const resolvedFontSize = fontSizeMatch?.[1] || resolveChineseFontSizeLabel(namedFontSizeMatch?.[1] || '')
      const lineSpacingMatch = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*倍行间距/i) ||
        normalized.match(/行间距(?:改为|设为|设置为)?\s*([0-9]+(?:\.[0-9]+)?)/i)
      const fixedLineSpacingMatch = normalized.match(/固定行间距(?:改为|设为|设置为)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:磅|pt)?/i)
      const matchMode = /正则|regex/i.test(normalized)
        ? 'regex'
        : /整词|完整单词/.test(normalized)
          ? 'whole-word'
          : 'plain'
      const caseSensitive = /区分大小写|大小写敏感/.test(normalized)
      const alignment = /居中对齐|居中|居中显示/.test(normalized)
        ? 'center'
        : /右对齐|居右/.test(normalized)
          ? 'right'
          : /两端对齐/.test(normalized)
            ? 'justify'
            : /左对齐|居左/.test(normalized)
              ? 'left'
              : ''
      const firstLineIndentMatch = normalized.match(/首行缩进(?:改为|设为|设置为)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:字符|字|个字符)?/i)
      const spaceBeforeMatch = normalized.match(/段前(?:间距)?(?:改为|设为|设置为)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:磅|pt)?/i)
      const spaceAfterMatch = normalized.match(/段后(?:间距)?(?:改为|设为|设置为)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:磅|pt)?/i)
      const scope = FULL_DOCUMENT_REFERENCE_PATTERN.test(normalized)
        ? 'document'
        : /(选中|选择的文字|选区|当前选择)/.test(normalized)
          ? 'selection'
          : ACTIVE_DOCUMENT_REFERENCE_PATTERN.test(normalized)
            ? 'paragraph'
            : targetSelector
              ? 'document'
              : 'selection'
      return normalizeDocumentFormatIntent({
        intent: 'document-format',
        scope,
        searchText: cleanDocumentFormatSearchText(searchMatch?.[1] || ''),
        targetSelector,
        matchMode,
        caseSensitive,
        styleChanges: {
          bold: /取消加粗/.test(normalized) ? false : (/(加粗|粗体)/.test(normalized) ? true : null),
          italic: /取消斜体/.test(normalized) ? false : (/(斜体)/.test(normalized) ? true : null),
          underline: /取消下划线/.test(normalized) ? false : (/(下划线)/.test(normalized) ? true : null),
          fontName: fontMatch?.[1] || '',
          fontSize: resolvedFontSize,
          fontColor: resolvedFontColor,
          backgroundColor: backgroundColorMatch?.[1] || '',
          lineSpacing: fixedLineSpacingMatch?.[1]
            ? { mode: 'fixed', value: Number(fixedLineSpacingMatch[1]) }
            : lineSpacingMatch?.[1]
              ? { mode: 'multiple', value: Number(lineSpacingMatch[1]) }
              : null,
          alignment,
          firstLineIndent: firstLineIndentMatch?.[1] || '',
          spaceBefore: spaceBeforeMatch?.[1] || '',
          spaceAfter: spaceAfterMatch?.[1] || ''
        }
      })
    },
    sanitizeDocumentFormatIntent(text, intent) {
      const normalized = String(text || '').trim()
      if (!intent || typeof intent !== 'object') return intent
      const genericColorRegex = new RegExp(`(?:改为|设为|设置为|变成)\\s*${STYLE_COLOR_VALUE_PATTERN}`, 'i')
      const markFontColorRegex = /(标红|红字|标蓝|蓝字|标绿|绿字|标黄|黄字|标紫|紫字|标灰|灰字)/i
      const styleChanges = intent.styleChanges && typeof intent.styleChanges === 'object'
        ? { ...intent.styleChanges }
        : {}
      const mentions = {
        bold: /(加粗|粗体|取消加粗|不要加粗)/.test(normalized),
        italic: /(斜体|取消斜体)/.test(normalized),
        underline: /(下划线|取消下划线)/.test(normalized),
        fontName: /(字体|宋体|黑体|仿宋|楷体|微软雅黑|Arial|Calibri|Times New Roman)/i.test(normalized),
        fontSize: /(字号|字体大小|磅|pt|号字|号|小初|小一|小二|小三|小四|小五|小六|初号|一号|二号|三号|四号|五号|六号|七号|八号)/i.test(normalized),
        fontColor: /(文字颜色|字体颜色|字色|颜色)/.test(normalized) || genericColorRegex.test(normalized) || markFontColorRegex.test(normalized),
        backgroundColor: /(背景色|高亮|底纹)/.test(normalized),
        lineSpacing: /(行间距)/.test(normalized),
        alignment: /(对齐|居中|居左|居右|两端对齐)/.test(normalized),
        firstLineIndent: /(首行缩进)/.test(normalized),
        spaceBefore: /(段前)/.test(normalized),
        spaceAfter: /(段后)/.test(normalized)
      }
      if (!mentions.bold) styleChanges.bold = null
      if (!mentions.italic) styleChanges.italic = null
      if (!mentions.underline) styleChanges.underline = null
      if (!mentions.fontName) styleChanges.fontName = ''
      if (!mentions.fontSize) styleChanges.fontSize = null
      if (!mentions.fontColor) styleChanges.fontColor = ''
      if (!mentions.backgroundColor) styleChanges.backgroundColor = ''
      if (!mentions.lineSpacing) styleChanges.lineSpacing = null
      if (!mentions.alignment) styleChanges.alignment = ''
      if (!mentions.firstLineIndent) styleChanges.firstLineIndent = null
      if (!mentions.spaceBefore) styleChanges.spaceBefore = null
      if (!mentions.spaceAfter) styleChanges.spaceAfter = null
      const targetSelector = inferDocumentFormatTargetSelector(normalized) || intent.targetSelector || null
      return normalizeDocumentFormatIntent({
        ...intent,
        targetSelector,
        styleChanges
      })
    },
    getDocumentFormatActionTags(action) {
      if (!action || typeof action !== 'object') return []
      const tags = []
      const scopeLabel = String(action.scopeLabel || '').trim()
      const searchText = String(action.searchText || '').trim()
      const targetSelectorLabel = String(action.targetSelectorLabel || '').trim()
      const matchMode = String(action.matchMode || '').trim()
      if (scopeLabel) {
        tags.push({ key: 'scope', label: `范围：${scopeLabel}` })
      }
      if (targetSelectorLabel) {
        tags.push({ key: 'targetSelector', label: `对象：${targetSelectorLabel}` })
      }
      if (searchText) {
        tags.push({ key: 'search', label: `关键词：${searchText}` })
      }
      if (matchMode === 'regex') {
        tags.push({ key: 'matchMode', label: '搜索：正则匹配' })
      } else if (matchMode === 'whole-word') {
        tags.push({ key: 'matchMode', label: '搜索：整词匹配' })
      } else if (searchText) {
        tags.push({ key: 'matchMode', label: '搜索：普通匹配' })
      }
      if (action.caseSensitive === true) {
        tags.push({ key: 'caseSensitive', label: '大小写：敏感' })
      } else if (searchText) {
        tags.push({ key: 'caseSensitive', label: '大小写：不敏感' })
      }
      return tags
    },
    getDocumentDeleteActionTags(action) {
      if (!action || typeof action !== 'object') return []
      const tags = []
      const scopeLabel = String(action.scopeLabel || '').trim()
      const targetLabel = String(action.targetLabel || '').trim()
      const paragraphIndex = Number(action.paragraphIndex || 0)
      if (scopeLabel) {
        tags.push({ key: 'scope', label: `范围：${scopeLabel}` })
      }
      if (targetLabel) {
        tags.push({ key: 'target', label: `对象：${targetLabel}` })
      }
      if (paragraphIndex > 0) {
        tags.push({ key: 'paragraphIndex', label: `段落：第 ${paragraphIndex} 段` })
      }
      if (Number(action.targetCount || 0) > 0 && !['document', 'paragraph', 'selection', 'paragraph-index'].includes(String(action.intent?.target || action.target || ''))) {
        tags.push({ key: 'count', label: `命中：${Number(action.targetCount)} 个` })
      }
      return tags
    },
    getDocumentTextEditActionTags(action) {
      if (!action || typeof action !== 'object') return []
      const tags = []
      const scopeLabel = String(action.scopeLabel || '').trim()
      const searchText = String(action.searchText || '').trim()
      const replacementText = String(action.replacementText || '').trim()
      const targetUnit = String(action.targetUnit || '').trim()
      const matchMode = String(action.matchMode || '').trim()
      if (scopeLabel) tags.push({ key: 'scope', label: `范围：${scopeLabel}` })
      if (targetUnit === 'paragraph') tags.push({ key: 'targetUnit', label: '处理：整段' })
      if (Array.isArray(action.keywordList) && action.keywordList.length > 1) {
        tags.push({ key: 'keywords', label: `关键词：${action.keywordList.join('、')}` })
      }
      if (targetUnit === 'paragraph' && action.targetMode === 'first' && Number(action.limitCount || 0) > 0) {
        tags.push({ key: 'targetMode', label: `选择：前 ${Number(action.limitCount)} 个` })
      } else if (targetUnit === 'paragraph' && action.targetMode === 'last' && Number(action.limitCount || 0) > 0) {
        tags.push({ key: 'targetMode', label: `选择：后 ${Number(action.limitCount)} 个` })
      }
      if (searchText) tags.push({ key: 'search', label: `关键词：${searchText}` })
      if (replacementText) tags.push({ key: 'replace', label: `替换为：${replacementText}` })
      if (matchMode === 'regex') {
        tags.push({ key: 'matchMode', label: '搜索：正则匹配' })
      } else if (matchMode === 'whole-word') {
        tags.push({ key: 'matchMode', label: '搜索：整词匹配' })
      } else if (searchText) {
        tags.push({ key: 'matchMode', label: '搜索：普通匹配' })
      }
      if (action.caseSensitive === true) {
        tags.push({ key: 'caseSensitive', label: '大小写：敏感' })
      }
      const hitCount = Number(action.targetUnit === 'paragraph' ? (action.targetCount || 0) : (action.matchCount || 0))
      if (hitCount > 0) {
        tags.push({ key: 'count', label: `命中：${hitCount}${action.targetUnit === 'paragraph' ? ' 段' : ' 处'}` })
      }
      return tags
    },
    getDocumentRelocationActionTags(action) {
      if (!action || typeof action !== 'object') return []
      const tags = []
      const sourceLabel = String(action.sourceLabel || '').trim()
      const destinationLabel = String(action.destinationLabel || '').trim()
      const count = Number(action.targetCount || 0)
      if (sourceLabel) tags.push({ key: 'source', label: `来源：${sourceLabel}` })
      if (destinationLabel) tags.push({ key: 'destination', label: `目标：${destinationLabel}` })
      if (Array.isArray(action.intent?.keywordList) && action.intent.keywordList.length > 1) {
        tags.push({ key: 'keywords', label: `关键词：${action.intent.keywordList.join('、')}` })
      }
      if (action.intent?.targetMode === 'first' && Number(action.intent?.limitCount || 0) > 0) {
        tags.push({ key: 'targetMode', label: `选择：前 ${Number(action.intent.limitCount)} 个` })
      } else if (action.intent?.targetMode === 'last' && Number(action.intent?.limitCount || 0) > 0) {
        tags.push({ key: 'targetMode', label: `选择：后 ${Number(action.intent.limitCount)} 个` })
      }
      if (String(action.intent?.placeholderText || '').trim()) {
        tags.push({ key: 'placeholder', label: `原位置：替换为 ${String(action.intent.placeholderText).trim()}` })
      }
      if (action.intent?.preserveFormatting === false) {
        tags.push({ key: 'formatMode', label: '格式：转纯文本' })
      }
      if (count > 0) tags.push({ key: 'count', label: `命中：${count} 段` })
      return tags
    },
    async inferDocumentRelocationIntentWithModel(text, model) {
      if (!model?.providerId || !model?.modelId) return null
      const snapshot = this.resolveBestSelectionContext()
      const systemPrompt = [
        '你是一个 WPS 文档段落移动与复制指令解析器，负责把自然语言解析为结构化 JSON。',
        '只有当用户明确要求移动、挪动、复制、拷贝段落内容到另一位置时，才返回 intent=document-relocation；否则返回 {"intent":"other"}。',
        'operation 只能是 move 或 copy。',
        'sourceType 只能是 paragraph-index、current-paragraph、paragraph-keyword。',
        'destinationType 只能是 paragraph-index、current-paragraph、document-start、document-end。',
        'placement 只能是 before 或 after；如果用户没说前后，移动到某段默认 before。',
        '当 sourceType=paragraph-keyword 时，可额外输出 keywordList（字符串数组）、keywordRelation（any|all）、targetMode（all|first|last）、limitCount（正整数或 null）。',
        '可额外输出 placeholderText（原位置替换文本）和 preserveFormatting（是否尽量保留原格式，默认 true）。',
        '如果用户说“第3段移动到第5段”，sourceType=paragraph-index sourceIndex=3，destinationType=paragraph-index destinationIndex=5。',
        '如果用户说“当前段落移动到文末”，sourceType=current-paragraph，destinationType=document-end。',
        '如果用户说“包含中国的段落复制到第2段后面”或“中国所在的段落移动到第4段”，sourceType=paragraph-keyword，searchText=中国。',
        '如果用户说“第一个包含中国的段落移动到文末”，targetMode=first，limitCount=1。',
        '如果用户说“前3个同时包含甲方和乙方的段落复制到第5段后”，keywordList=["甲方","乙方"]，keywordRelation=all，targetMode=first，limitCount=3。',
        '如果用户说“复制到第5段后，并替换原位置为‘此处已迁移’”，则输出 placeholderText="此处已迁移"。',
        '如果用户说“移动后保留格式”“复制时保持原格式”，则 preserveFormatting=true；如果说“按纯文本复制”“不要格式”，则 preserveFormatting=false。',
        '只输出 JSON，不要解释。',
        'JSON 格式：{"intent":"document-relocation|other","operation":"move|copy","sourceType":"paragraph-index|current-paragraph|paragraph-keyword","sourceIndex":null,"searchText":"","keywordList":[],"keywordRelation":"any","targetMode":"all","limitCount":null,"placeholderText":"","preserveFormatting":true,"destinationType":"paragraph-index|current-paragraph|document-start|document-end","destinationIndex":null,"placement":"before|after"}'
      ].join('\n')
      const userPrompt = [
        '【用户输入】',
        String(text || '').trim(),
        '',
        '【当前文档上下文】',
        snapshot?.text ? buildSelectionContextPrompt(snapshot) : '当前没有可用的选区上下文'
      ].join('\n')
      try {
        const raw = await chatCompletion({
          providerId: model.providerId,
          modelId: model.modelId,
          temperature: 0.1,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
        return normalizeDocumentRelocationIntent(parseAssistantIntentResult(raw))
      } catch (error) {
        console.warn('移动复制指令解析失败:', error)
        return null
      }
    },
    async inferDocumentTextEditIntentWithModel(text, model) {
      if (!model?.providerId || !model?.modelId) return null
      const snapshot = this.resolveBestSelectionContext()
      const systemPrompt = [
        '你是一个 WPS 文档关键词编辑指令解析器，负责把自然语言中的关键词删除或替换操作解析为结构化 JSON。',
        '只有当用户明确要求删除某个关键词、移除某个关键字，或把一个词替换成另一个词，或者删除/替换包含某词的整段时，才返回 intent=document-text-edit；否则返回 {"intent":"other"}。',
        'operation 只能是 delete 或 replace。',
        'scope 只能是 selection、paragraph、document。',
        'targetUnit 只能是 text 或 paragraph。',
        'searchText 表示需要查找的原词，replacementText 表示替换后的词；当 operation=delete 时，replacementText 必须为空字符串。',
        '可额外输出 keywordList（字符串数组）、keywordRelation（any|all）、targetMode（all|first|last）、limitCount（正整数或 null）。当 targetUnit=text 时通常保持默认值；当 targetUnit=paragraph 时可用于“第一个/最后一个/前3个命中段落”一类请求。',
        '如果用户说“删除中国所在的段落”“把包含中国的段落替换为……”这类按关键词定位整段的要求，targetUnit=paragraph。',
        '如果用户说“删除第一个包含中国的段落”，targetUnit=paragraph，targetMode=first，limitCount=1。',
        '如果用户说“把前3个同时包含甲方和乙方的段落替换为……”则 keywordList=["甲方","乙方"]，keywordRelation=all，targetMode=first，limitCount=3。',
        '如果用户只是说“删除中国”“把甲方替换为乙方”，targetUnit=text。',
        '如果用户说全文/整个文档，则 scope=document；如果说当前段落/本段/这段，则 scope=paragraph；如果说选中/选区，则 scope=selection；否则优先 scope=selection。',
        '只有明确是“删除某个词”或“把A替换成B”时才返回结果，不要把“删除全文”“删除表格”“删除图片”识别成这个意图。',
        '只输出 JSON，不要输出解释，不要输出 Markdown。',
        'JSON 格式：{"intent":"document-text-edit|other","operation":"delete|replace","scope":"selection|paragraph|document","targetUnit":"text|paragraph","searchText":"","keywordList":[],"keywordRelation":"any","replacementText":"","targetMode":"all","limitCount":null,"matchMode":"plain","caseSensitive":false}'
      ].join('\n')
      const userPrompt = [
        '【用户输入】',
        String(text || '').trim(),
        '',
        '【当前文档上下文】',
        snapshot?.text ? buildSelectionContextPrompt(snapshot) : '当前没有可用的选区上下文'
      ].join('\n')
      try {
        const raw = await chatCompletion({
          providerId: model.providerId,
          modelId: model.modelId,
          temperature: 0.1,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
        return normalizeDocumentTextEditIntent(parseAssistantIntentResult(raw))
      } catch (error) {
        console.warn('关键词编辑指令解析失败:', error)
        return null
      }
    },
    async inferDocumentDeleteIntentWithModel(text, model) {
      if (!model?.providerId || !model?.modelId) return null
      const snapshot = this.resolveBestSelectionContext()
      const systemPrompt = [
        '你是一个 WPS 文档删除指令解析器，负责把自然语言删除操作解析为结构化 JSON。',
        '只有当用户明确要求执行删除、移除、去掉、清空时，才返回 intent=document-delete；否则返回 {"intent":"other"}。',
        'target 只能是 selection、paragraph、document、table、image、comment、paragraph-index。',
        'scope 只能是 selection、paragraph、document。',
        '如果用户说“删除当前段落/本段/这段”，target=paragraph，scope=paragraph。',
        '如果用户说“删除选中的内容/选中文字/选区”，target=selection，scope=selection。',
        '如果用户说“删除全文/清空全文/删除整个文档”，target=document，scope=document。',
        '如果用户说“删除第3段/删除第十段”，target=paragraph-index，paragraphIndex 输出数字，scope=document。',
        '如果用户说“删除当前表格/这个表格/当前图片/这个批注”等，target 分别输出 table、image、comment，scope=selection。',
        '如果用户说“删除所有表格/所有图片/所有批注”，target 分别输出 table、image、comment，scope=document。',
        '如果用户说“删除表格/图片/批注”，请结合范围判断：明确说全文则 scope=document；明确说当前段落则 scope=paragraph；否则优先输出 scope=selection。',
        'paragraphIndex 只在 target=paragraph-index 时输出正整数，其余情况输出 null。',
        '只输出 JSON，不要输出解释，不要输出 Markdown。',
        'JSON 格式：{"intent":"document-delete|other","target":"selection|paragraph|document|table|image|comment|paragraph-index","scope":"selection|paragraph|document","paragraphIndex":null}'
      ].join('\n')
      const userPrompt = [
        '【用户输入】',
        String(text || '').trim(),
        '',
        '【当前文档上下文】',
        snapshot?.text ? buildSelectionContextPrompt(snapshot) : '当前没有可用的选区上下文'
      ].join('\n')
      try {
        const raw = await chatCompletion({
          providerId: model.providerId,
          modelId: model.modelId,
          temperature: 0.1,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
        return normalizeDocumentDeleteIntent(parseAssistantIntentResult(raw))
      } catch (error) {
        console.warn('删除指令解析失败:', error)
        return null
      }
    },
    async inferDocumentFormatIntentWithModel(text, model) {
      if (!model?.providerId || !model?.modelId) return null
      const snapshot = this.resolveBestSelectionContext()
      const systemPrompt = [
        '你是一个 WPS 文档格式指令解析器，负责把自然语言格式操作解析为结构化 JSON。',
        '只有当用户明确要求执行文档格式修改时，才返回 intent=document-format；否则返回 {"intent":"other"}。',
        'scope 只能是 selection、paragraph、document。',
        '如果用户说“当前段落/本段”，scope=paragraph；如果说“当前选择/选中文字/选区”，scope=selection；如果说“全文/整个文档”，scope=document。',
        'searchText 表示需要先搜索/匹配的文本，例如“搜索中国并加粗”，searchText 应输出为“中国”。',
        'matchMode 只能是 plain、whole-word、regex；用户提到“整词匹配”时用 whole-word，提到“正则/regex”时用 regex，其他情况用 plain。',
        'caseSensitive 表示是否区分大小写；用户提到“区分大小写/大小写敏感”时为 true。',
        '如果用户没有指定搜索词，只是要对整个范围改格式，可以让 searchText 为空字符串。',
        'styleChanges 只能包含：bold、italic、underline、fontName、fontSize、fontColor、backgroundColor、lineSpacing、alignment、firstLineIndent、spaceBefore、spaceAfter。',
        '非常重要：未被用户明确提到的字段必须保持 null、空字符串或空值，绝对不要填 0，也不要猜测默认格式。',
        '例如用户只说“加粗”，就只能输出 bold=true；fontSize、firstLineIndent、spaceBefore、spaceAfter 等都必须为空。',
        'fontColor 与 backgroundColor 优先输出 #RRGGBB；无法确定时也可以输出常见中文颜色名。',
        'lineSpacing 输出 null，或者 {"mode":"multiple","value":1.5}，或者 {"mode":"fixed","value":18}。',
        'alignment 只能输出 left、center、right、justify 之一，无法确定则输出空字符串。',
        'firstLineIndent 表示首行缩进字符数；spaceBefore/spaceAfter 表示段前段后间距，单位按磅输出数字。',
        '只输出 JSON，不要输出解释，不要输出 Markdown。',
        'JSON 格式：{"intent":"document-format|other","scope":"selection|paragraph|document","searchText":"","matchMode":"plain","caseSensitive":false,"styleChanges":{"bold":true,"italic":null,"underline":null,"fontName":"","fontSize":null,"fontColor":"","backgroundColor":"","lineSpacing":null,"alignment":"","firstLineIndent":null,"spaceBefore":null,"spaceAfter":null}}'
      ].join('\n')
      const userPrompt = [
        '【用户输入】',
        String(text || '').trim(),
        '',
        '【当前文档上下文】',
        snapshot?.text ? buildSelectionContextPrompt(snapshot) : '当前没有可用的选区上下文'
      ].join('\n')
      try {
        const raw = await chatCompletion({
          providerId: model.providerId,
          modelId: model.modelId,
          temperature: 0.1,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
        return this.sanitizeDocumentFormatIntent(text, normalizeDocumentFormatIntent(parseAssistantIntentResult(raw)))
      } catch (error) {
        console.warn('格式指令解析失败:', error)
        return null
      }
    },
    getOrCreateWritableChat() {
      if (!this.currentChat) {
        this.newChat()
      }
      const chatId = this.currentChatId || this.chatHistory[0]?.id
      return this.chatHistory.find(c => c.id === chatId) || null
    },
    prepareOutgoingMessages(text, options = {}) {
      const chatObj = this.getOrCreateWritableChat()
      if (!chatObj) return null
      const visibleUserContent = this.buildVisibleUserMessage(text, options)
      const selectionSnapshot = options.scope === 'document' ? null : this.getBufferedSelectionContext()
      const attachmentsSnapshot = this.cloneAttachmentSnapshot()
      const userMessageMeta = this.buildUserMessageMeta({
        ...options,
        selectionSnapshot,
        attachmentsSnapshot
      })
      const userMessageId = 'u' + Date.now()
      const assistantMessageId = 'a' + Date.now()
      chatObj.messages.push({
        id: userMessageId,
        role: 'user',
        content: visibleUserContent,
        messageMeta: userMessageMeta
      })
      chatObj.messages.push({
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        recommendations: [],
        missingSkillNotice: false,
        generatedFiles: []
      })
      if (!chatObj.title || chatObj.title === '新对话') {
        const titleSource = String(text || this.attachments[0]?.name || '新对话')
        chatObj.title = titleSource.slice(0, 20) + (titleSource.length > 20 ? '...' : '')
      }
      this.userInput = ''
      this.clearAttachments()
      this.clearSelectionBridgeStorage()
      return {
        chatObj,
        visibleUserContent,
        userMessageId,
        assistantMsg: chatObj.messages[chatObj.messages.length - 1],
        selectionSnapshot,
        attachmentsSnapshot
      }
    },
    startDocumentFormatMessage(text, model, prepared = null) {
      const resolvedPrepared = prepared || this.prepareOutgoingMessages(text)
      if (!resolvedPrepared) return
      const { assistantMsg } = resolvedPrepared
      assistantMsg.content = ''
      assistantMsg.isLoading = true
      this.startAssistantLoadingProgress(assistantMsg, {
        label: '正在识别格式指令...',
        detail: '正在分析处理范围、关键词和格式要求。',
        percent: 12
      })
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
      this.handleDocumentFormatMessage(text, model, null, resolvedPrepared)
    },
    async handleDocumentFormatMessage(text, model, intent, prepared = null) {
      const resolvedPrepared = prepared || this.prepareOutgoingMessages(text)
      if (!resolvedPrepared) return
      const { assistantMsg } = resolvedPrepared
      try {
        const resolvedIntent = this.sanitizeDocumentFormatIntent(
          text,
          intent || await this.inferDocumentFormatIntentWithModel(text, model) || this.inferDocumentFormatIntentByRule(text)
        )
        if (!resolvedIntent) {
          this.stopAssistantLoadingProgress(assistantMsg)
          assistantMsg.content = '未识别到明确的文档格式操作，请补充要处理的范围、关键词和格式要求。'
          assistantMsg.isLoading = false
          this.saveHistory()
          this.scrollToBottom()
          return
        }
        const preview = createDocumentFormatPreview(resolvedIntent)
        let previewStatusMessage = preview.intent?.searchText
          ? '已完成匹配统计，等待确认。'
          : '已识别格式要求，等待确认。'
        if (preview.canApply && preview.intent?.searchText) {
          try {
            const previewResult = previewDocumentFormatMatches(preview.intent)
            if (previewResult.previewedCount > 0) {
              previewStatusMessage = `已高亮预览 ${previewResult.previewedCount} 处匹配结果。`
            } else {
              previewStatusMessage = '已完成匹配统计，当前环境暂不支持临时高亮预览。'
            }
          } catch (_) {
            // Ignore preview failures and keep the confirmation flow usable.
          }
        }
        assistantMsg.content = `${preview.summaryText}\n将执行：${preview.changeSummary.join('、')}。`
        assistantMsg.pendingDocumentFormatAction = {
          ...preview,
          status: preview.canApply ? 'pending' : 'unavailable',
          previewActive: !!previewStatusMessage,
          statusMessage: preview.canApply
            ? previewStatusMessage
            : `未找到与“${preview.searchText}”匹配的结果，暂不能执行。`
        }
        this.stopAssistantLoadingProgress(assistantMsg)
        assistantMsg.isLoading = false
      } catch (error) {
        this.stopAssistantLoadingProgress(assistantMsg)
        assistantMsg.content = '[错误] ' + (error?.message || '文档格式任务预览失败')
        assistantMsg.isLoading = false
      }
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
    },
    async confirmPendingDocumentFormatAction(message) {
      const pending = message?.pendingDocumentFormatAction
      if (!pending || !pending.canApply || pending.status === 'applying' || pending.status === 'applied') return
      pending.status = 'applying'
      pending.statusMessage = '正在执行格式修改...'
      this.saveHistory()
      try {
        try {
          clearDocumentFormatPreview(pending.intent)
          pending.previewActive = false
        } catch (_) {
          // Ignore preview cleanup failures before final apply.
        }
        const result = executeDocumentFormatAction(pending.intent)
        pending.status = 'applied'
        pending.statusMessage = result.message
        this.refreshSelectionContext()
      } catch (error) {
        pending.status = 'failed'
        pending.statusMessage = error?.message || '格式修改失败'
      }
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
    },
    rerunPendingDocumentFormatPreview(message) {
      const pending = message?.pendingDocumentFormatAction
      if (!pending || !pending.canApply || (!pending.intent?.searchText && !pending.intent?.targetSelector) || pending.status === 'applying') return
      try {
        const previewResult = previewDocumentFormatMatches(pending.intent)
        pending.previewActive = previewResult.previewedCount > 0
        pending.statusMessage = previewResult.previewedCount > 0
          ? `已高亮预览 ${previewResult.previewedCount} 处匹配结果。`
          : '当前环境暂不支持临时高亮预览。'
      } catch (error) {
        pending.previewActive = false
        pending.statusMessage = error?.message || '重新预览失败'
      }
      this.saveHistory()
    },
    clearPendingDocumentFormatPreview(message) {
      const pending = message?.pendingDocumentFormatAction
      if (!pending || (!pending.intent?.searchText && !pending.intent?.targetSelector) || pending.status === 'applying') return
      try {
        const result = clearDocumentFormatPreview(pending.intent)
        pending.previewActive = false
        pending.statusMessage = result.clearedCount > 0
          ? `已清除 ${result.clearedCount} 处预览高亮。`
          : '预览高亮已清除。'
      } catch (error) {
        pending.statusMessage = error?.message || '清除预览失败'
      }
      this.saveHistory()
    },
    cancelPendingDocumentFormatAction(message) {
      const pending = message?.pendingDocumentFormatAction
      if (!pending || pending.status === 'applying' || pending.status === 'applied') return
      try {
        clearDocumentFormatPreview(pending.intent)
        pending.previewActive = false
      } catch (_) {
        // Ignore preview cleanup failures on cancel.
      }
      pending.status = 'cancelled'
      pending.canApply = false
      pending.statusMessage = '已取消本次格式修改。'
      this.saveHistory()
    },
    startDocumentRelocationMessage(text, model, prepared = null) {
      const resolvedPrepared = prepared || this.prepareOutgoingMessages(text)
      if (!resolvedPrepared) return
      const { assistantMsg } = resolvedPrepared
      assistantMsg.content = ''
      assistantMsg.isLoading = true
      this.startAssistantLoadingProgress(assistantMsg, {
        label: '正在识别移动指令...',
        detail: '正在分析来源内容、命中条件和目标位置。',
        percent: 12
      })
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
      this.handleDocumentRelocationMessage(text, model, null, resolvedPrepared)
    },
    async handleDocumentRelocationMessage(text, model, intent, prepared = null) {
      const resolvedPrepared = prepared || this.prepareOutgoingMessages(text)
      if (!resolvedPrepared) return
      const { assistantMsg } = resolvedPrepared
      try {
        const resolvedIntent = normalizeDocumentRelocationIntent(
          intent || await this.inferDocumentRelocationIntentWithModel(text, model) || this.inferDocumentRelocationIntentByRule(text)
        )
        if (!resolvedIntent) {
          this.stopAssistantLoadingProgress(assistantMsg)
          assistantMsg.content = '未识别到明确的移动或复制要求，请补充来源段落和目标位置。'
          assistantMsg.isLoading = false
          this.saveHistory()
          this.scrollToBottom()
          return
        }
        const preview = createDocumentRelocationPreview(resolvedIntent)
        assistantMsg.content = `${preview.summaryText}\n将执行：${preview.changeSummary.join('、')}。`
        assistantMsg.pendingDocumentRelocationAction = {
          ...preview,
          status: preview.canApply ? 'pending' : 'unavailable',
          statusMessage: preview.canApply
            ? '已识别移动/复制对象，等待确认。'
            : '当前未找到可移动或复制的段落。'
        }
        this.stopAssistantLoadingProgress(assistantMsg)
        assistantMsg.isLoading = false
      } catch (error) {
        this.stopAssistantLoadingProgress(assistantMsg)
        assistantMsg.content = '[错误] ' + (error?.message || '移动/复制任务预览失败')
        assistantMsg.isLoading = false
      }
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
    },
    async confirmPendingDocumentRelocationAction(message) {
      const pending = message?.pendingDocumentRelocationAction
      if (!pending || !pending.canApply || pending.status === 'applying' || pending.status === 'applied') return
      pending.status = 'applying'
      pending.statusMessage = pending.intent?.operation === 'copy' ? '正在复制段落...' : '正在移动段落...'
      this.saveHistory()
      try {
        const result = executeDocumentRelocationAction(pending.intent)
        pending.status = 'applied'
        pending.statusMessage = result.message
        this.refreshSelectionContext()
      } catch (error) {
        pending.status = 'failed'
        pending.statusMessage = error?.message || '移动/复制失败'
      }
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
    },
    cancelPendingDocumentRelocationAction(message) {
      const pending = message?.pendingDocumentRelocationAction
      if (!pending || pending.status === 'applying' || pending.status === 'applied') return
      pending.status = 'cancelled'
      pending.canApply = false
      pending.statusMessage = '已取消本次移动/复制操作。'
      this.saveHistory()
    },
    startDocumentTextEditMessage(text, model, prepared = null) {
      const resolvedPrepared = prepared || this.prepareOutgoingMessages(text)
      if (!resolvedPrepared) return
      const { assistantMsg } = resolvedPrepared
      assistantMsg.content = ''
      assistantMsg.isLoading = true
      this.startAssistantLoadingProgress(assistantMsg, {
        label: '正在识别文本修改要求...',
        detail: '正在分析关键词、替换内容和处理范围。',
        percent: 12
      })
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
      this.handleDocumentTextEditMessage(text, model, null, resolvedPrepared)
    },
    async handleDocumentTextEditMessage(text, model, intent, prepared = null) {
      const resolvedPrepared = prepared || this.prepareOutgoingMessages(text)
      if (!resolvedPrepared) return
      const { assistantMsg } = resolvedPrepared
      try {
        const resolvedIntent = normalizeDocumentTextEditIntent(
          intent || await this.inferDocumentTextEditIntentWithModel(text, model) || this.inferDocumentTextEditIntentByRule(text)
        )
        if (!resolvedIntent) {
          this.stopAssistantLoadingProgress(assistantMsg)
          assistantMsg.content = '未识别到明确的关键词删除或替换操作，请补充原词、目标词和范围。'
          assistantMsg.isLoading = false
          this.saveHistory()
          this.scrollToBottom()
          return
        }
        const preview = createDocumentTextEditPreview(resolvedIntent)
        assistantMsg.content = `${preview.summaryText}\n将执行：${preview.changeSummary.join('、')}。`
        assistantMsg.pendingDocumentTextEditAction = {
          ...preview,
          status: preview.canApply ? 'pending' : 'unavailable',
          statusMessage: preview.canApply
            ? '已识别关键词操作，等待确认。'
            : `未找到与“${preview.searchText || ''}”匹配的结果，暂不能执行。`
        }
        this.stopAssistantLoadingProgress(assistantMsg)
        assistantMsg.isLoading = false
      } catch (error) {
        this.stopAssistantLoadingProgress(assistantMsg)
        assistantMsg.content = '[错误] ' + (error?.message || '关键词操作预览失败')
        assistantMsg.isLoading = false
      }
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
    },
    async confirmPendingDocumentTextEditAction(message) {
      const pending = message?.pendingDocumentTextEditAction
      if (!pending || !pending.canApply || pending.status === 'applying' || pending.status === 'applied') return
      pending.status = 'applying'
      pending.statusMessage = pending.intent?.operation === 'delete' ? '正在删除关键词...' : '正在替换关键词...'
      this.saveHistory()
      try {
        const result = executeDocumentTextEditAction(pending.intent)
        pending.status = 'applied'
        pending.statusMessage = result.message
        this.refreshSelectionContext()
      } catch (error) {
        pending.status = 'failed'
        pending.statusMessage = error?.message || '关键词操作失败'
      }
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
    },
    cancelPendingDocumentTextEditAction(message) {
      const pending = message?.pendingDocumentTextEditAction
      if (!pending || pending.status === 'applying' || pending.status === 'applied') return
      pending.status = 'cancelled'
      pending.canApply = false
      pending.statusMessage = '已取消本次关键词操作。'
      this.saveHistory()
    },
    startDocumentDeleteMessage(text, model, prepared = null) {
      const resolvedPrepared = prepared || this.prepareOutgoingMessages(text)
      if (!resolvedPrepared) return
      const { assistantMsg } = resolvedPrepared
      assistantMsg.content = ''
      assistantMsg.isLoading = true
      this.startAssistantLoadingProgress(assistantMsg, {
        label: '正在识别删除要求...',
        detail: '正在分析删除对象、作用范围和命中条件。',
        percent: 12
      })
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
      this.handleDocumentDeleteMessage(text, model, null, resolvedPrepared)
    },
    async handleDocumentDeleteMessage(text, model, intent, prepared = null) {
      const resolvedPrepared = prepared || this.prepareOutgoingMessages(text)
      if (!resolvedPrepared) return
      const { assistantMsg } = resolvedPrepared
      try {
        const resolvedIntent = normalizeDocumentDeleteIntent(
          intent || await this.inferDocumentDeleteIntentWithModel(text, model) || this.inferDocumentDeleteIntentByRule(text)
        )
        if (!resolvedIntent) {
          this.stopAssistantLoadingProgress(assistantMsg)
          assistantMsg.content = '未识别到明确的删除对象，请补充删除范围，例如“删除当前段落”“删除第3段”“删除全文图片”。'
          assistantMsg.isLoading = false
          this.saveHistory()
          this.scrollToBottom()
          return
        }
        const preview = createDocumentDeletePreview(resolvedIntent)
        assistantMsg.content = `${preview.summaryText}\n将执行：${preview.changeSummary.join('、')}。`
        assistantMsg.pendingDocumentDeleteAction = {
          ...preview,
          status: preview.canApply ? 'pending' : 'unavailable',
          statusMessage: preview.canApply
            ? '已识别删除对象，等待确认。'
            : `当前未找到可删除的${preview.targetLabel || '对象'}。`
        }
        this.stopAssistantLoadingProgress(assistantMsg)
        assistantMsg.isLoading = false
      } catch (error) {
        this.stopAssistantLoadingProgress(assistantMsg)
        assistantMsg.content = '[错误] ' + (error?.message || '删除任务预览失败')
        assistantMsg.isLoading = false
      }
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
    },
    async confirmPendingDocumentDeleteAction(message) {
      const pending = message?.pendingDocumentDeleteAction
      if (!pending || !pending.canApply || pending.status === 'applying' || pending.status === 'applied') return
      pending.status = 'applying'
      pending.statusMessage = '正在执行删除...'
      this.saveHistory()
      try {
        const result = executeDocumentDeleteAction(pending.intent)
        pending.status = 'applied'
        pending.statusMessage = result.message
        this.refreshSelectionContext()
      } catch (error) {
        pending.status = 'failed'
        pending.statusMessage = error?.message || '删除失败'
      }
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
    },
    cancelPendingDocumentDeleteAction(message) {
      const pending = message?.pendingDocumentDeleteAction
      if (!pending || pending.status === 'applying' || pending.status === 'applied') return
      pending.status = 'cancelled'
      pending.canApply = false
      pending.statusMessage = '已取消本次删除操作。'
      this.saveHistory()
    },
    confirmAssistantRun(launchInfo) {
      if (!launchInfo?.requiresFullDocumentConfirm) return true
      const length = Number(launchInfo.inputLength || 0)
      return window.confirm(
        `“${launchInfo.title || '该助手'}”将处理全文内容（约 ${length} 字），是否继续执行？`
      )
    },
    getGeneratedOutputTaskStatusText(task) {
      if (!task) return ''
      const mediaLabel = task.data?.generatedMediaKind === 'image'
        ? '图片'
        : task.data?.generatedMediaKind === 'video'
          ? '视频'
          : task.data?.generatedMediaKind === 'audio'
            ? '语音'
            : '文件'
      let out = ''
      if (task.status === 'completed') {
        out = `已生成${mediaLabel}文件，可在当前会话中下载。`
      } else if (task.status === 'cancelled') {
        out = task.error || `${mediaLabel}生成已停止`
      } else if (task.status === 'failed') {
        const hint = String(task.data?.errorDetail?.suggestion || '').trim()
        out = [this.formatAssistantTaskError(task.error || ''), hint].filter(Boolean).join(' ')
      } else if (task.status === 'abnormal') {
        out = task.error || `${mediaLabel}生成异常结束`
      } else {
        const stage = String(task.data?.progressStage || '')
        const modelLabel = String(task.data?.modelDisplayName || task.data?.modelId || '').trim()
        if (stage === 'calling_model') out = `正在调用${mediaLabel}模型${modelLabel ? `：${modelLabel}` : ''}...`
        else if (stage === 'preparing') out = `正在准备${mediaLabel}生成任务...`
        else out = `正在生成${mediaLabel}文件...`
      }
      return prepareDialogDisplayText(out)
    },
    getAssistantTaskStatusText(task) {
      if (!task) return ''
      let out = ''
      if (task.status === 'completed') {
        out = this.buildAssistantTaskCompletionSummary(task) || task.data?.applyResult?.message || '助手任务已完成'
      } else if (task.status === 'cancelled') {
        out = task.error || '助手任务已停止'
      } else if (task.status === 'failed') {
        out = this.formatAssistantTaskError(task.error || '')
      } else if (task.status === 'abnormal') {
        out = task.error || '助手任务异常结束'
      } else {
        const stage = String(task.data?.progressStage || '')
        const current = Number(task.current || 0)
        const total = Number(task.total || 0)
        if (total > 0) {
          out = `正在处理：第 ${current} / ${total} 段`
        } else if (stage === 'calling_model') out = '正在调用模型生成结果...'
        else if (stage === 'applying_result') out = '正在写回文档或整理输出...'
        else out = '助手任务正在执行中...'
      }
      return prepareDialogDisplayText(out)
    },
    getWpsCapabilityTaskStatusText(task) {
      if (!task) return ''
      let out = ''
      if (task.status === 'completed') {
        out = task.data?.applyResult?.message || 'WPS 操作已完成'
      } else if (task.status === 'cancelled') {
        out = task.error || 'WPS 操作已停止'
      } else if (task.status === 'failed') {
        out = this.formatAssistantTaskError(task.error || '')
      } else if (task.status === 'abnormal') {
        out = task.error || 'WPS 操作异常结束'
      } else {
        const current = Number(task.current || 0)
        const total = Number(task.total || 0)
        if (total > 0) {
          out = `正在执行步骤：${current} / ${total}`
        } else {
          out = '正在执行 WPS 直接操作...'
        }
      }
      return prepareDialogDisplayText(out)
    },
    syncGeneratedOutputTaskRuns() {
      this.chatHistory.forEach((chat) => {
        const messages = Array.isArray(chat?.messages) ? chat.messages : []
        messages.forEach((message) => {
          const run = message?.activeGeneratedOutputRun
          const taskId = String(run?.taskId || '')
          if (!taskId) return
          const task = getTaskById(taskId)
          if (!task) return
          const nextStatus = task.status === 'completed'
            ? 'completed'
            : task.status === 'failed' || task.status === 'abnormal'
              ? 'error'
              : task.status === 'cancelled'
                ? 'cancelled'
                : 'running'
          const nextStatusMessage = this.getGeneratedOutputTaskStatusText(task)
          message.activeGeneratedOutputRun = {
            ...run,
            taskId,
            status: nextStatus,
            statusMessage: nextStatusMessage,
            progress: Number(task.progress || 0),
            current: Number(task.current || 0),
            total: Number(task.total || 0),
            estimatedRemainingMs: Number(task.data?.estimatedRemainingMs || 0),
            canRetry: task.status === 'failed' || task.status === 'cancelled' || task.status === 'abnormal',
            canUndo: task.status === 'completed' && Array.isArray(message.generatedFiles) && message.generatedFiles.length > 0,
            previewText: String(task.data?.outputPreview || task.data?.inputPreview || '').trim(),
            metaLines: [
              task.data?.sourceScope === 'document'
                ? '处理范围：全文'
                : task.data?.sourceScope === 'selection'
                  ? '处理范围：当前选中内容'
                  : '处理范围：当前请求或附件',
              task.data?.modelDisplayName ? `模型：${task.data.modelDisplayName}` : '',
              task.data?.mediaOptions?.aspectRatio ? `画幅比例：${task.data.mediaOptions.aspectRatio}` : '',
              task.data?.mediaOptions?.duration ? `视频时长：${task.data.mediaOptions.duration}` : '',
              task.data?.mediaOptions?.voiceStyle ? `语音风格：${task.data.mediaOptions.voiceStyle}` : '',
              task.startedAt ? `开始时间：${this.formatDateTime(task.startedAt)}` : '',
              task.endedAt ? `结束时间：${this.formatDateTime(task.endedAt)}` : '',
              task.data?.generatedFileName ? `文件名：${task.data.generatedFileName}` : ''
            ].filter(Boolean)
          }
          const progressKey = `${task.status}_${task.data?.progressStage || ''}_${task.progress || 0}`
          if (run._lastProgressKey !== progressKey && task.status === 'running') {
            this.appendDocumentRevisionDetail(message.activeGeneratedOutputRun, nextStatusMessage)
            message.activeGeneratedOutputRun._lastProgressKey = progressKey
          } else if (!run._lastProgressKey) {
            message.activeGeneratedOutputRun._lastProgressKey = progressKey
          }
          if (task.status === 'completed') {
            if (run._lastTerminalKey !== progressKey) {
              this.appendDocumentRevisionDetail(message.activeGeneratedOutputRun, `任务完成：${nextStatusMessage}`)
              message.activeGeneratedOutputRun._lastTerminalKey = progressKey
            }
            message.isLoading = false
            this.stopAssistantLoadingProgress(message)
          } else if (task.status === 'cancelled') {
            if (run._lastTerminalKey !== progressKey) {
              this.appendDocumentRevisionDetail(message.activeGeneratedOutputRun, `任务停止：${nextStatusMessage}`)
              message.activeGeneratedOutputRun._lastTerminalKey = progressKey
            }
            message.content = '文件生成已停止。'
            message.isLoading = false
            this.stopAssistantLoadingProgress(message)
          } else if (task.status === 'abnormal') {
            if (run._lastTerminalKey !== progressKey) {
              this.appendDocumentRevisionDetail(message.activeGeneratedOutputRun, `任务异常结束：${nextStatusMessage}`)
              message.activeGeneratedOutputRun._lastTerminalKey = progressKey
            }
            message.content = `[异常结束] ${nextStatusMessage}`
            message.isLoading = false
            this.stopAssistantLoadingProgress(message)
          } else if (task.status === 'failed') {
            if (run._lastTerminalKey !== progressKey) {
              this.appendDocumentRevisionDetail(message.activeGeneratedOutputRun, `任务失败：${nextStatusMessage}`)
              if (task.data?.errorDetail?.rawMessage && task.data.errorDetail.rawMessage !== task.error) {
                this.appendDocumentRevisionDetail(message.activeGeneratedOutputRun, `底层报错：${task.data.errorDetail.rawMessage}`)
              }
              message.activeGeneratedOutputRun._lastTerminalKey = progressKey
            }
            message.content = `[错误] ${this.formatAssistantTaskError(task.error || '')}`
            message.isLoading = false
            this.stopAssistantLoadingProgress(message)
          } else {
            message.isLoading = true
          }
        })
      })
      this.saveHistory()
    },
    syncAssistantTaskRuns() {
      this.chatHistory.forEach((chat) => {
        const messages = Array.isArray(chat?.messages) ? chat.messages : []
        messages.forEach((message) => {
          const run = message?.activeAssistantTaskRun
          const taskId = String(run?.taskId || '')
          if (!taskId) return
          const task = getTaskById(taskId)
          if (!task) return
          const nextStatus = task.status === 'completed'
            ? 'completed'
            : task.status === 'failed' || task.status === 'abnormal'
              ? 'error'
              : task.status === 'cancelled'
                ? 'cancelled'
                : 'running'
          const nextStatusMessage = this.getAssistantTaskStatusText(task)
          message.activeAssistantTaskRun = {
            ...run,
            status: nextStatus,
            statusMessage: nextStatusMessage,
            launchGuardReason: prepareDialogDisplayText(String(task.data?.launchGuardReason || '').trim()),
            applyAction: String(task.data?.applyResult?.action || task.data?.documentAction || '').trim(),
            progress: Number(task.progress || 0),
            taskTitle: prepareDialogDisplayText(String(task.title || run?.taskTitle || '').trim()),
            current: Number(task.current || 0),
            total: Number(task.total || 0),
            estimatedRemainingMs: Number(task.data?.estimatedRemainingMs || 0),
            previewText: prepareDialogDisplayText(String(task.data?.outputPreview || task.data?.inputPreview || '').trim()),
            metaLines: this.getAssistantTaskCardMetaLines(task),
            showBackupOption: task.data?.pendingApply === true && task.data?.backupPolicy?.allowUserToggle === true,
            backupEnabled: task.data?.documentBackupRequested === true,
            backupLabel: '写回前备份源文件',
            rollbackCandidate: task.data?.rollbackCandidate || null,
            retryPayload: task.data?.retryPayload || null,
            canUndo: task.status === 'completed' && !!task.data?.rollbackCandidate?.backupId && !task.data?.rollbackAppliedAt,
            canRetry: (task.status === 'failed' || task.status === 'cancelled' || task.status === 'abnormal') && !!task.data?.retryPayload?.assistantId
          }
          const progressKey = `${task.status}_${task.data?.progressStage || ''}_${task.progress || 0}`
          if (run._lastProgressKey !== progressKey && task.status === 'running') {
            this.appendDocumentRevisionDetail(message.activeAssistantTaskRun, nextStatusMessage)
            message.activeAssistantTaskRun._lastProgressKey = progressKey
          } else if (!run._lastProgressKey) {
            message.activeAssistantTaskRun._lastProgressKey = progressKey
          }
          if (task.status === 'completed') {
            if (run._lastTerminalKey !== progressKey) {
              this.appendDocumentRevisionDetail(message.activeAssistantTaskRun, `任务完成：${nextStatusMessage}`)
              this.getAssistantTaskResultDetailLines(task).forEach((line) => {
                this.appendDocumentRevisionDetail(message.activeAssistantTaskRun, line)
              })
              const previewSnippet = this.sanitizeAssistantTextForUserDialog(
                String(task.data?.outputPreview || task.data?.fullOutput || '').trim()
              )
              if (previewSnippet) {
                this.appendDocumentRevisionDetail(
                  message.activeAssistantTaskRun,
                  `结果预览：${previewSnippet}`
                )
              }
              message.activeAssistantTaskRun._lastTerminalKey = progressKey
            }
            if (task.data?.pendingApply === true) {
              message.content = `助手“${task.title || '当前任务'}”已生成预览，确认后才会写回文档。`
              message.activeAssistantTaskRun = {
                ...message.activeAssistantTaskRun,
                status: 'completed',
                statusMessage: '已生成预览，等待确认写回。',
                canApplyPlan: true,
                showBackupOption: task.data?.backupPolicy?.allowUserToggle === true,
                backupEnabled: task.data?.documentBackupRequested === true,
                backupLabel: '写回前备份源文件'
              }
            } else {
              message.content = this.resolveAssistantTaskMessageBody(task)
            }
            message.isLoading = false
            this.stopAssistantLoadingProgress(message)
            this.requestAssistantEvolutionSuggestionCheck()
          } else if (task.status === 'cancelled') {
            if (run._lastTerminalKey !== progressKey) {
              this.appendDocumentRevisionDetail(message.activeAssistantTaskRun, `任务停止：${nextStatusMessage}`)
              message.activeAssistantTaskRun._lastTerminalKey = progressKey
            }
            message.content = '助手任务已停止。'
            message.isLoading = false
            this.stopAssistantLoadingProgress(message)
          } else if (task.status === 'abnormal') {
            if (run._lastTerminalKey !== progressKey) {
              this.appendDocumentRevisionDetail(message.activeAssistantTaskRun, `任务异常结束：${nextStatusMessage}`)
              message.activeAssistantTaskRun._lastTerminalKey = progressKey
            }
            message.content = `[异常结束] ${nextStatusMessage}`
            message.isLoading = false
            this.stopAssistantLoadingProgress(message)
          } else if (task.status === 'failed') {
            if (run._lastTerminalKey !== progressKey) {
              this.appendDocumentRevisionDetail(message.activeAssistantTaskRun, `任务失败：${nextStatusMessage}`)
              message.activeAssistantTaskRun._lastTerminalKey = progressKey
            }
            message.content = `[错误] ${this.formatAssistantTaskError(task.error || '')}`
            message.isLoading = false
            this.stopAssistantLoadingProgress(message)
          } else {
            message.isLoading = true
          }
        })
      })
      this.saveHistory()
    },
    syncWpsCapabilityTaskRuns() {
      this.chatHistory.forEach((chat) => {
        const messages = Array.isArray(chat?.messages) ? chat.messages : []
        messages.forEach((message) => {
          const run = message?.activeWpsCapabilityRun
          const taskId = String(run?.taskId || '')
          if (!taskId) return
          const task = getTaskById(taskId)
          if (!task) return
          const nextStatus = task.status === 'completed'
            ? 'completed'
            : task.status === 'failed' || task.status === 'abnormal'
              ? 'error'
              : task.status === 'cancelled'
                ? 'cancelled'
                : 'running'
          const nextStatusMessage = this.getWpsCapabilityTaskStatusText(task)
          message.activeWpsCapabilityRun = {
            ...run,
            status: nextStatus,
            statusMessage: nextStatusMessage,
            progress: Number(task.progress || 0),
            current: Number(task.current || 0),
            total: Number(task.total || 0),
            previewText: String(task.data?.outputPreview || task.data?.inputPreview || '').trim(),
            metaLines: [
              task.startedAt ? `开始时间：${this.formatDateTime(task.startedAt)}` : '',
              task.endedAt ? `结束时间：${this.formatDateTime(task.endedAt)}` : '',
              Number(task.data?.estimatedRemainingMs || 0) > 0
                ? `预计剩余：${Math.max(1, Math.ceil(Number(task.data.estimatedRemainingMs) / 1000))} 秒`
                : ''
            ].filter(Boolean)
          }
          const progressKey = `${task.status}_${task.current || 0}_${task.total || 0}_${task.progress || 0}`
          if (run._lastProgressKey !== progressKey) {
            this.appendDocumentRevisionDetail(message.activeWpsCapabilityRun, nextStatusMessage)
            message.activeWpsCapabilityRun._lastProgressKey = progressKey
          }
          if (task.status === 'completed') {
            message.content = task.data?.applyResult?.message || 'WPS 操作已完成。'
            message.isLoading = false
            this.stopAssistantLoadingProgress(message)
            this.requestAssistantEvolutionSuggestionCheck()
          } else if (task.status === 'cancelled') {
            message.content = 'WPS 操作已停止。'
            message.isLoading = false
            this.stopAssistantLoadingProgress(message)
          } else if (task.status === 'abnormal') {
            message.content = `[异常结束] ${nextStatusMessage}`
            message.isLoading = false
            this.stopAssistantLoadingProgress(message)
          } else if (task.status === 'failed') {
            message.content = `[错误] ${this.formatAssistantTaskError(task.error || '')}`
            message.isLoading = false
            this.stopAssistantLoadingProgress(message)
          } else {
            message.isLoading = true
          }
        })
      })
      this.saveHistory()
    },
    stopAssistantTaskRun(message) {
      const taskId = String(message?.activeAssistantTaskRun?.taskId || '')
      if (!taskId || message?.activeAssistantTaskRun?.status !== 'running') return
      stopAssistantTask(taskId)
      message.activeAssistantTaskRun = {
        ...message.activeAssistantTaskRun,
        status: 'cancelled',
        statusMessage: '正在停止本次助手任务...'
      }
      this.appendDocumentRevisionDetail(message.activeAssistantTaskRun, '用户手动停止了本次助手任务。')
      this.saveHistory()
    },
    stopWpsCapabilityRun(message) {
      const taskId = String(message?.activeWpsCapabilityRun?.taskId || '')
      if (!taskId || message?.activeWpsCapabilityRun?.status !== 'running') return
      stopWpsCapabilityTask(taskId)
      message.activeWpsCapabilityRun = {
        ...message.activeWpsCapabilityRun,
        status: 'cancelled',
        statusMessage: '正在停止本次 WPS 操作...'
      }
      this.appendDocumentRevisionDetail(message.activeWpsCapabilityRun, '用户手动停止了本次 WPS 操作。')
      this.saveHistory()
    },
    getCapabilityFieldValueText(field) {
      if (field?.type === 'select' || field?.type === 'page-selector') {
        const matched = (field.options || []).find(item => String(item.value) === String(field.value))
        if (matched?.label) return matched.label
      }
      return String(field?.value ?? '').trim()
    },
    buildWpsCapabilitySummaryText(capability) {
      const label = String(capability?.label || '未命名操作').trim()
      const desc = String(capability?.description || '').trim()
      return desc
        ? `已识别到可直接调用的 WPS 能力：${label}。${desc} 请确认参数后继续执行。`
        : `已识别到可直接调用的 WPS 能力：${label}。请确认参数后继续执行。`
    },
    buildWpsCapabilityConfirmPrompt(capability) {
      const label = String(capability?.label || '本次操作').trim()
      return `系统已根据当前语义和文档上下文尽量预填 ${label} 所需参数。确认后会直接调用对应 WPS API。`
    },
    createPendingWpsCapabilityForm(capability, text = '', options = {}) {
      const currentSavePath = getCurrentDocumentSavePath() || ''
      const buildField = (field) => {
        const value = field.defaultResolver ? field.defaultResolver(text, options.context || {}) : (field.value ?? '')
        const nextField = {
          ...field,
          value
        }
        if (
          field.key === 'savePath' &&
          ['save-document', 'encrypt-document'].includes(String(capability?.capabilityKey || '')) &&
          !currentSavePath
        ) {
          nextField.required = true
        }
        return nextField
      }
      return {
        status: 'pending',
        summaryText: options.summaryText || this.buildWpsCapabilitySummaryText(capability),
        confirmPrompt: options.confirmPrompt || this.buildWpsCapabilityConfirmPrompt(capability),
        statusMessage: options.statusMessage || '请在会话内确认这次 WPS 操作的参数。',
        autoContinueSecondsLeft: 0,
        capabilityKey: capability?.capabilityKey || '',
        capabilityLabel: capability?.label || '',
        originalText: String(text || '').trim(),
        fields: [
          ...((capability?.requiredParams || []).map(buildField)),
          ...((capability?.optionalParams || []).map(buildField))
        ]
      }
    },
    updatePendingWpsCapabilityField(message, fieldKey, value) {
      const pending = message?.pendingWpsCapabilityForm
      if (!pending || pending.status === 'applying') return
      const field = (pending.fields || []).find(item => item.key === fieldKey)
      if (!field) return
      field.value = value
      this.scheduleWpsCapabilityAutoContinue(message)
      this.saveHistory()
    },
    scheduleWpsCapabilityAutoContinue(message) {
      this.scheduleMessageAutoContinue(
        message,
        'pendingWpsCapabilityForm',
        (targetMessage, options = {}) => this.confirmPendingWpsCapabilityForm(targetMessage, options)
      )
    },
    buildWpsCapabilityParams(pending) {
      const params = {}
      ;(pending?.fields || []).forEach((field) => {
        if (field.type === 'number' || field.type === 'page-selector') {
          const numeric = Number(field.value)
          params[field.key] = Number.isFinite(numeric) ? numeric : field.value
          return
        }
        params[field.key] = field.value
      })
      return params
    },
    async runWpsCapabilityTaskFromMessage(message, capabilityKey, options = {}) {
      const capability = getCapabilityBusItem(capabilityKey) || getWpsCapabilityByKey(capabilityKey)
      if (!capability) throw new Error('未找到对应的 WPS 能力')
      const taskTitle = capability.label || 'WPS 操作'
      const params = options.params && typeof options.params === 'object' ? options.params : {}
      const { taskId, promise } = startWpsCapabilityTask({
        capabilityKey,
        taskTitle,
        requirementText: options.requirementText || '',
        params
      })
      if (!taskId) throw new Error('WPS 任务启动失败，未能创建任务')
      message.isLoading = true
      message.content = `已开始执行 WPS 操作“${taskTitle}”，可在当前消息中查看进度与结果。`
      message.activeWpsCapabilityRun = {
        taskId,
        status: 'running',
        summaryText: `正在执行“${taskTitle}”...`,
        statusMessage: 'WPS 操作已启动，正在执行...',
        showDetails: false,
        details: [],
        progress: 8,
        current: 0,
        total: 3
      }
      this.appendDocumentRevisionDetail(message.activeWpsCapabilityRun, `已启动 WPS 操作“${taskTitle}”。`)
      this.openDialogRoute('/task-progress-dialog', { taskId }, taskTitle, 520, 260)
      promise.catch((error) => {
        if (error?.code === 'TASK_CANCELLED') return
        console.warn('WPS capability task failed:', error)
      })
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
    },
    async confirmPendingWpsCapabilityForm(message, options = {}) {
      const pending = message?.pendingWpsCapabilityForm
      if (!pending || pending.status === 'applying') return
      this.clearAssistantParameterAutoContinue(message?.id)
      const missing = (pending.fields || []).filter(field => field.required !== false && !String(field.value ?? '').trim())
      if (missing.length > 0) {
        pending.statusMessage = `请先填写：${missing.map(item => item.label).join('、')}`
        this.saveHistory()
        return
      }
      pending.status = 'applying'
      pending.statusMessage = options.autoTriggered === true ? '已按当前表单自动继续执行...' : '正在启动 WPS 操作...'
      this.saveHistory()
      const capabilityKey = String(pending.capabilityKey || '').trim()
      const params = this.buildWpsCapabilityParams(pending)
      message.pendingWpsCapabilityForm = null
      await this.runWpsCapabilityTaskFromMessage(message, capabilityKey, {
        requirementText: pending.originalText,
        params
      })
    },
    cancelPendingWpsCapabilityForm(message) {
      const pending = message?.pendingWpsCapabilityForm
      if (!pending || pending.status === 'applying') return
      this.clearAssistantParameterAutoContinue(message?.id)
      message.pendingWpsCapabilityForm = null
      if (!String(message.content || '').trim()) {
        message.content = '已取消本次 WPS 操作。'
      }
      this.saveHistory()
    },
    confirmDocumentCommentRun(intent) {
      if (intent?.scope !== 'document') return true
      const length = Number(String(getDocumentText() || '').trim().length || 0)
      return window.confirm(
        `将按当前要求扫描全文并逐处添加批注（约 ${length} 字），是否继续执行？`
      )
    },
    getDocumentCommentTaskStatusText(task) {
      if (!task) return ''
      let out = ''
      if (task.status === 'completed') {
        out = task.data?.applyResult?.message || `已完成，共添加 ${Number(task.data?.commentCount || 0)} 处批注`
      } else if (task.status === 'cancelled') {
        out = task.error || '批注任务已停止'
      } else if (task.status === 'failed') {
        out = task.error || '批注任务执行失败'
      } else {
        const current = Number(task.current || 0)
        const total = Number(task.total || 0)
        out = total > 0 ? `正在批注：第 ${current} / ${total} 段` : '正在执行智能批注...'
      }
      return prepareDialogDisplayText(out)
    },
    syncDocumentCommentTaskRuns() {
      this.chatHistory.forEach((chat) => {
        const messages = Array.isArray(chat?.messages) ? chat.messages : []
        messages.forEach((message) => {
          const run = message?.activeDocumentCommentRun
          const taskId = String(run?.taskId || '')
          if (!taskId) return
          const task = getTaskById(taskId)
          if (!task) return
          const nextStatus = task.status === 'completed'
            ? 'completed'
            : task.status === 'failed'
              ? 'error'
              : task.status === 'cancelled'
                ? 'cancelled'
                : 'running'
          const nextStatusMessage = this.getDocumentCommentTaskStatusText(task)
          const undoState = task.data?.undo || {}
          message.activeDocumentCommentRun = {
            ...run,
            status: nextStatus,
            statusMessage: nextStatusMessage,
            progress: Number(task.progress || 0),
            current: Number(task.current || 0),
            total: Number(task.total || 0),
            canUndo: task.status === 'completed' && undoState.status === 'available',
            estimatedRemainingMs: Number(task.data?.estimatedRemainingMs || 0),
            previewText: String(task.data?.outputPreview || task.data?.currentChunk || '').trim(),
            metaLines: [
              task.startedAt ? `开始时间：${this.formatDateTime(task.startedAt)}` : '',
              task.endedAt ? `结束时间：${this.formatDateTime(task.endedAt)}` : ''
            ].filter(Boolean)
          }
          const progressKey = `${task.status}_${task.current || 0}_${task.total || 0}`
          if (run._lastProgressKey !== progressKey && task.status === 'running') {
            const detailText = nextStatusMessage
            if (detailText) {
              this.appendDocumentRevisionDetail(message.activeDocumentCommentRun, detailText)
            }
            const currentItem = Array.isArray(task.data?.items)
              ? task.data.items.find(item => Number(item?.chunkIndex || 0) === Number(task.current || 0))
              : null
            if (currentItem?.chunkText) {
              this.appendDocumentRevisionDetail(
                message.activeDocumentCommentRun,
                `当前段内容：${String(currentItem.chunkText || '').trim()}`
              )
            }
            message.activeDocumentCommentRun._lastProgressKey = progressKey
          } else if (!run._lastProgressKey) {
            message.activeDocumentCommentRun._lastProgressKey = progressKey
          }
          if (task.status === 'completed') {
            if (task.data?.outputPreview) {
              this.appendDocumentRevisionDetail(message.activeDocumentCommentRun, `结果预览：${String(task.data.outputPreview).trim()}`)
            }
            message.content = task.data?.applyResult?.message || `已完成批注，共添加 ${Number(task.data?.commentCount || 0)} 处批注。`
            message.isLoading = false
            this.stopAssistantLoadingProgress(message)
            this.requestAssistantEvolutionSuggestionCheck()
          } else if (task.status === 'cancelled') {
            message.content = '批注任务已停止。'
            message.isLoading = false
            this.stopAssistantLoadingProgress(message)
          } else if (task.status === 'failed') {
            message.content = `[错误] ${task.error || '批注任务执行失败'}`
            message.isLoading = false
            this.stopAssistantLoadingProgress(message)
          } else {
            message.isLoading = true
          }
        })
      })
      this.saveHistory()
    },
    stopDocumentCommentRun(message) {
      const taskId = String(message?.activeDocumentCommentRun?.taskId || '')
      if (!taskId || message?.activeDocumentCommentRun?.status !== 'running') return
      stopDocumentCommentTask(taskId)
      message.activeDocumentCommentRun = {
        ...message.activeDocumentCommentRun,
        status: 'cancelled',
        statusMessage: '正在停止本次批注任务...'
      }
      this.appendDocumentRevisionDetail(message.activeDocumentCommentRun, '用户手动停止了本次批注任务。')
      this.saveHistory()
    },
    undoDocumentCommentRun(message) {
      const taskId = String(message?.activeDocumentCommentRun?.taskId || '')
      if (!taskId || message?.activeDocumentCommentRun?.canUndo !== true) return
      try {
        const result = undoDocumentCommentTask(taskId)
        const statusMessage = result?.message || '已撤销本次批注改动。'
        message.content = statusMessage
        message.activeDocumentCommentRun = {
          ...message.activeDocumentCommentRun,
          status: 'completed',
          statusMessage,
          canUndo: false
        }
        this.appendDocumentRevisionDetail(message.activeDocumentCommentRun, statusMessage)
      } catch (error) {
        const statusMessage = error?.message || '撤销批注失败'
        message.activeDocumentCommentRun = {
          ...message.activeDocumentCommentRun,
          statusMessage
        }
        this.appendDocumentRevisionDetail(message.activeDocumentCommentRun, statusMessage)
      }
      this.saveHistory()
    },
    undoGeneratedOutputRun(message) {
      const run = message?.activeGeneratedOutputRun
      const files = Array.isArray(message?.generatedFiles) ? message.generatedFiles : []
      if (!run?.canUndo || files.length === 0) return
      this.releaseGeneratedFiles(files)
      message.generatedFiles = []
      message.content = '已撤销本次生成的附件。'
      message.activeGeneratedOutputRun = {
        ...run,
        status: 'completed',
        statusMessage: '已撤销本次生成的附件。',
        canUndo: false,
        previewText: '附件已从当前会话撤销，可重新发起生成。'
      }
      this.appendDocumentRevisionDetail(message.activeGeneratedOutputRun, '用户撤销了本次生成的附件。')
      this.saveHistory()
    },
    async retryGeneratedOutputRun(message) {
      if (this.isStreaming || message?.activeGeneratedOutputRun?.status === 'running') return
      const retryPayload = message?.activeGeneratedOutputRun?.retryPayload
      if (!retryPayload?.text || !retryPayload?.intent) {
        alert('未找到可重试的生成参数')
        return
      }
      const model = this.filteredModelList.find(item => item.id === retryPayload.modelId) || this.selectedModel
      if (!model) {
        alert('当前没有可用模型，无法重试')
        return
      }
      const previousUserMessage = this.findPreviousUserMessage(message)
      const previousComposerAttachments = this.cloneAttachmentSnapshot(this.attachments)
      const previousSelectionSnapshot = this.cloneSelectionSnapshot(this.selectionContextSnapshot)
      const currentInput = this.userInput
      try {
        this.releaseGeneratedFiles(message.generatedFiles)
        message.generatedFiles = []
        message.content = ''
        message.isLoading = false
        this.clearAssistantRecommendations(message)
        this.attachments = this.reindexAttachments(this.cloneAttachmentSnapshot(previousUserMessage?.messageMeta?.attachments || []))
        this.restoreSelectionContextForRetry(previousUserMessage?.messageMeta?.selectionSnapshot || null)
        await this.handleGeneratedOutputMessage(
          retryPayload.text,
          model,
          JSON.parse(JSON.stringify(retryPayload.intent)),
          { assistantMsg: message }
        )
      } catch (error) {
        message.content = `[错误] ${this.formatAssistantTaskError(error?.message || '重试失败')}`
        this.saveHistory()
      } finally {
        this.userInput = currentInput
        this.attachments = this.reindexAttachments(previousComposerAttachments)
        this.restoreSelectionContextForRetry(previousSelectionSnapshot || null)
      }
    },
    undoAssistantTaskRun(message) {
      const run = message?.activeAssistantTaskRun
      const taskId = String(run?.taskId || '').trim()
      if (!taskId) return
      const task = getTaskById(taskId)
      const rollbackCandidate = task?.data?.rollbackCandidate || run?.rollbackCandidate
      const backupId = String(rollbackCandidate?.backupId || '').trim()
      if (!backupId) {
        alert('当前任务没有可回滚的文档备份')
        return
      }
      try {
        const restoreResult = restoreDocumentBackupRecordById(backupId)
        message.content = restoreResult.message
        message.activeAssistantTaskRun = {
          ...(run || {}),
          status: 'completed',
          statusMessage: restoreResult.message,
          canUndo: false,
          rollbackCandidate
        }
        this.appendDocumentRevisionDetail(message.activeAssistantTaskRun, `已执行文档回滚：${restoreResult.message}`)
        updateTask(taskId, {
          data: {
            ...(task?.data || {}),
            rollbackAppliedAt: new Date().toISOString(),
            rollbackResult: restoreResult
          }
        })
        this.saveHistory()
      } catch (error) {
        message.content = `[错误] ${this.formatAssistantTaskError(error?.message || '文档回滚失败')}`
        this.saveHistory()
      }
    },
    retryAssistantTaskRun(message) {
      if (this.isStreaming || message?.activeAssistantTaskRun?.status === 'running') return
      const previousRun = message?.activeAssistantTaskRun || null
      const previousTaskId = String(previousRun?.taskId || '').trim()
      const previousTask = previousTaskId ? getTaskById(previousTaskId) : null
      const retryPayload = previousTask?.data?.retryPayload || previousRun?.retryPayload
      const assistantId = String(retryPayload?.assistantId || previousTask?.data?.assistantId || '').trim()
      if (!assistantId) {
        alert('未找到可重试的助手任务参数')
        return
      }
      const overrides = {
        taskTitle: String(retryPayload?.taskTitle || previousTask?.title || '助手任务').trim(),
        ...this.getConversationModelTaskOverrides(),
        inputText: String(retryPayload?.inputText || previousTask?.data?.fullInput || '').trim(),
        inputSource: String(retryPayload?.inputSource || '').trim(),
        documentAction: String(retryPayload?.documentAction || '').trim(),
        targetLanguage: String(retryPayload?.targetLanguage || '').trim(),
        launchSource: String(retryPayload?.launchSource || previousTask?.data?.launchSource || 'dialog').trim(),
        strictAssistantDefaults: retryPayload?.strictAssistantDefaults === true,
        previewOnly: retryPayload?.previewOnly === true,
        reportSettings: retryPayload?.reportSettings && typeof retryPayload.reportSettings === 'object'
          ? JSON.parse(JSON.stringify(retryPayload.reportSettings))
          : undefined,
        taskData: {
          ...(retryPayload?.taskData && typeof retryPayload.taskData === 'object' ? retryPayload.taskData : {}),
          originMessageId: String(message?.id || retryPayload?.taskData?.originMessageId || previousTask?.data?.originMessageId || '').trim(),
          originRequirementText: String(
            retryPayload?.requirementText ||
            retryPayload?.taskData?.originRequirementText ||
            previousTask?.data?.originRequirementText ||
            ''
          ).trim(),
          retrySourceTaskId: previousTaskId
        }
      }
      const { taskId, promise } = startAssistantTask(assistantId, overrides)
      if (!taskId) {
        alert('助手任务重试失败，未能创建任务')
        return
      }
      message.isLoading = true
      message.content = `已重新发起助手“${overrides.taskTitle || '当前任务'}”的执行。`
      message.activeAssistantTaskRun = {
        taskId,
        status: 'running',
        summaryText: `正在重试“${overrides.taskTitle || '当前任务'}”...`,
        statusMessage: previousTaskId ? `已基于任务 ${previousTaskId} 的快照重新执行。` : '已按原始参数重新执行当前助手任务。',
        showDetails: false,
        details: []
      }
      this.appendDocumentRevisionDetail(
        message.activeAssistantTaskRun,
        previousTaskId ? `已基于任务 ${previousTaskId} 的输入快照重新启动助手任务。` : '已按保存的参数重新启动助手任务。'
      )
      this.openDialogRoute('/task-progress-dialog', { taskId }, overrides.taskTitle || '助手任务', 520, 260)
      promise.catch((error) => {
        if (error?.code === 'TASK_CANCELLED') return
        console.warn('聊天助手任务重试失败:', error)
      })
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
    },
    async runMultimodalTaskFromMessage(message, intent, context) {
      const kind = String(intent?.action || '').trim()
      const modelType = kind === 'image'
        ? MODEL_TYPE_IMAGE_GENERATION
        : kind === 'video'
          ? MODEL_TYPE_VIDEO_GENERATION
          : MODEL_TYPE_TTS
      const multimodalModel = this.getFirstConfiguredModelByType(modelType)
      if (!multimodalModel) {
        const label = kind === 'image' ? '图片' : kind === 'video' ? '视频' : '语音'
        throw new Error(`未找到可用的${label}模型，请先在设置中配置并启用${label}模型`)
      }
      const taskTitle = String(intent?.fileBaseName || '').trim() || (
        kind === 'image' ? '生成图片' : kind === 'video' ? '生成视频' : '生成语音'
      )
      const { taskId, promise } = startMultimodalTask({
        kind,
        taskTitle,
        providerId: multimodalModel.providerId,
        modelId: multimodalModel.modelId,
        modelDisplayName: multimodalModel.name || multimodalModel.modelId || multimodalModel.id,
        prompt: context.promptText,
        input: context.sourceText,
        aspectRatio: intent?.aspectRatio || (kind === 'video' || kind === 'image' ? '16:9' : ''),
        duration: intent?.duration || (kind === 'video' ? '8s' : ''),
        voiceStyle: intent?.voiceStyle || (kind === 'audio' ? '专业自然' : ''),
        fileBaseName: taskTitle,
        scope: context.scope
      })
      message.activeGeneratedOutputRun = {
        ...message.activeGeneratedOutputRun,
        taskId,
        status: 'running',
        statusMessage: this.getGeneratedOutputTaskStatusText({
          status: 'running',
          data: { progressStage: 'preparing', generatedMediaKind: kind }
        }),
        progress: 8,
        current: 0,
        total: 3,
        _lastProgressKey: ''
      }
      this.appendDocumentRevisionDetail(message.activeGeneratedOutputRun, `已启动${taskTitle}任务，正在调用对应模型。`)
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
      const result = await promise
      message.generatedFiles = [
        this.createGeneratedMediaFile(result.asset, {
          kind,
          baseName: taskTitle
        })
      ]
      this.persistMessageArtifacts(message, 'multimodal-generation')
      message.content = kind === 'image'
        ? '已生成图片文件，点击下方即可下载。'
        : kind === 'video'
          ? '已生成视频文件，点击下方即可下载。'
          : '已生成语音文件，点击下方即可下载。'
      message.isLoading = false
      this.stopAssistantLoadingProgress(message)
      message.activeGeneratedOutputRun = {
        ...message.activeGeneratedOutputRun,
        status: 'completed',
        statusMessage: message.content,
        progress: 100,
        current: 3,
        total: 3,
        canUndo: true,
        canRetry: false,
        previewText: String(result.outputText || '').trim(),
        metaLines: [
          `任务编号：${taskId}`,
          `模型：${multimodalModel.name || multimodalModel.modelId || multimodalModel.id}`,
          context.scope === 'document' ? '处理范围：全文' : context.scope === 'selection' ? '处理范围：当前选中内容' : '处理范围：当前请求或附件',
          kind === 'image' || kind === 'video' ? `画幅比例：${intent?.aspectRatio || '16:9'}` : '',
          kind === 'video' ? `视频时长：${intent?.duration || '8s'}` : '',
          kind === 'audio' ? `语音风格：${intent?.voiceStyle || '专业自然'}` : ''
        ].filter(Boolean)
      }
      this.appendDocumentRevisionDetail(message.activeGeneratedOutputRun, message.content)
      this.finishActiveGeneratedOutputRun(message, {
        status: 'completed',
        statusMessage: message.content,
        keepContext: false
      })
      this.requestAssistantEvolutionSuggestionCheck()
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
      return result
    },
    async startDocumentCommentMessage(text, model, intent, prepared = null) {
      const resolvedPrepared = prepared || this.prepareOutgoingMessages(text, { scope: intent?.scope })
      if (!resolvedPrepared) return
      const { assistantMsg } = resolvedPrepared
      const scope = intent?.scope === 'selection' ? 'selection' : 'document'
      const scopeLabel = scope === 'selection' ? '选中内容' : '全文'
      assistantMsg.isLoading = true
      assistantMsg.content = ''
      this.startAssistantLoadingProgress(assistantMsg, {
        label: `正在准备${scopeLabel}批注...`,
        detail: '内容已加入会话，正在创建批注任务并连接进度状态。',
        percent: 14
      })
      assistantMsg.activeDocumentCommentRun = {
        status: 'running',
        summaryText: `正在处理${scopeLabel}批注...`,
        statusMessage: '正在准备批注任务...',
        showDetails: false,
        details: []
      }
      this.appendPrimaryRouteDetail(assistantMsg.activeDocumentCommentRun, assistantMsg)
      this.appendDocumentRevisionDetail(assistantMsg.activeDocumentCommentRun, `已识别为${scopeLabel}批注任务。`)
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())

      if (!this.confirmDocumentCommentRun(intent)) {
        this.stopAssistantLoadingProgress(assistantMsg)
        assistantMsg.isLoading = false
        assistantMsg.content = '已取消本次批注任务。'
        assistantMsg.activeDocumentCommentRun = {
          ...assistantMsg.activeDocumentCommentRun,
          status: 'cancelled',
          statusMessage: '已取消本次批注任务。'
        }
        this.saveHistory()
        return
      }

      try {
        const taskTitle = scope === 'selection' ? '选区智能批注' : '全文智能批注'
        const { taskId, promise } = startDocumentCommentTask({
          requestText: text,
          scope,
          model,
          taskTitle,
          onTaskCreated: (createdTaskId) => {
            assistantMsg.activeDocumentCommentRun = {
              ...assistantMsg.activeDocumentCommentRun,
              taskId: createdTaskId,
              status: 'running',
              statusMessage: '批注任务已启动，正在分析文档内容...',
              _lastProgressKey: ''
            }
            this.appendDocumentRevisionDetail(assistantMsg.activeDocumentCommentRun, '批注任务已启动，可在当前消息或任务进度窗口中查看状态。')
            this.saveHistory()
          }
        })
        if (!taskId) {
          throw new Error('任务启动失败，未能创建批注任务')
        }
        this.openDialogRoute(
          '/task-progress-dialog',
          { taskId },
          taskTitle,
          520,
          260
        )
        this.stopAssistantLoadingProgress(assistantMsg)
        assistantMsg.isLoading = true
        assistantMsg.content = `已识别为${scopeLabel}批注任务，正在执行。可在任务进度中查看处理状态。`
        assistantMsg.activeDocumentCommentRun = {
          ...assistantMsg.activeDocumentCommentRun,
          taskId,
          status: 'running',
          statusMessage: '批注任务已启动，正在分析文档内容...',
          _lastProgressKey: ''
        }
        this.saveHistory()
        this.$nextTick(() => this.scrollToBottom())

        promise.then((result) => {
          assistantMsg.content = Number(result?.commentCount || 0) > 0
            ? `已完成${scopeLabel}批注，共添加 ${Number(result.commentCount || 0)} 处批注。`
            : `已完成${scopeLabel}批注，未发现需要添加批注的内容。`
          assistantMsg.activeDocumentCommentRun = {
            ...assistantMsg.activeDocumentCommentRun,
            status: 'completed',
            statusMessage: assistantMsg.content
          }
          this.appendDocumentRevisionDetail(assistantMsg.activeDocumentCommentRun, assistantMsg.content)
          this.saveHistory()
          this.$nextTick(() => this.scrollToBottom())
        }).catch((error) => {
          this.stopAssistantLoadingProgress(assistantMsg)
          assistantMsg.content = error?.code === 'TASK_CANCELLED'
            ? '批注任务已停止。'
            : `[错误] ${error?.message || '批注任务执行失败'}`
          assistantMsg.isLoading = false
          assistantMsg.activeDocumentCommentRun = {
            ...assistantMsg.activeDocumentCommentRun,
            status: error?.code === 'TASK_CANCELLED' ? 'cancelled' : 'error',
            statusMessage: assistantMsg.content
          }
          this.appendDocumentRevisionDetail(assistantMsg.activeDocumentCommentRun, assistantMsg.content)
          this.saveHistory()
          this.$nextTick(() => this.scrollToBottom())
        })
      } catch (error) {
        this.stopAssistantLoadingProgress(assistantMsg)
        assistantMsg.isLoading = false
        assistantMsg.content = `[错误] ${error?.message || '批注任务执行失败'}`
        assistantMsg.activeDocumentCommentRun = {
          ...assistantMsg.activeDocumentCommentRun,
          status: 'error',
          statusMessage: assistantMsg.content
        }
        this.appendDocumentRevisionDetail(assistantMsg.activeDocumentCommentRun, assistantMsg.content)
        this.saveHistory()
        this.$nextTick(() => this.scrollToBottom())
      }
    },
    getStoredSelectionContext() {
      const raw = window.Application?.PluginStorage?.getItem(STORAGE_KEY_SELECTED_CONTEXT)
      return safeParsePluginJson(raw)
    },
    getLegacySelectionContext() {
      const legacyText = String(
        window.Application?.PluginStorage?.getItem(STORAGE_KEY_SELECTED_CONTENT) || ''
      ).trim()
      if (!legacyText) return null
      return {
        kind: 'selection',
        text: legacyText,
        selectionText: legacyText,
        currentParagraphText: legacyText,
        previousParagraphText: '',
        nextParagraphText: '',
        documentName: '',
        documentCharCount: legacyText.length,
        documentExcerpt: legacyText,
        position: {
          hasSelection: true,
          rangeStart: 0,
          rangeEnd: legacyText.length,
          paragraphIndex: 0,
          paragraphCount: 0,
          paragraphLabel: ''
        },
        formatting: {}
      }
    },
    getBufferedSelectionContext() {
      if (this.selectionContextSnapshot?.text) return this.selectionContextSnapshot
      const stored = this.getStoredSelectionContext()
      if (stored?.text) return stored
      return this.getLegacySelectionContext()
    },
    refreshSelectionContext() {
      const live = this.getLiveSelectionContext()
      if (live?.text || live?.documentStats?.totalPages || live?.documentStats?.characterCount) {
        this.selectionContextSnapshot = live
        return
      }
      const stored = this.getStoredSelectionContext()
      if (stored?.text || stored?.documentStats?.totalPages || stored?.documentStats?.characterCount) {
        this.selectionContextSnapshot = stored
        return
      }
      this.selectionContextSnapshot = null
    },
    getLiveSelectionContext() {
      try {
        return getSelectionContextSnapshot({ documentExcerptLimit: 900 })
      } catch (_) {
        return null
      }
    },
    resolveBestSelectionContext() {
      const live = this.getLiveSelectionContext()
      if (live?.text) return live
      const stored = this.getStoredSelectionContext()
      if (stored?.text) return stored
      return this.getLegacySelectionContext()
    },
    clearSelectionBridgeStorage() {
      try {
        window.Application?.PluginStorage?.removeItem(STORAGE_KEY_SELECTED_CONTENT)
        window.Application?.PluginStorage?.removeItem(STORAGE_KEY_SELECTED_CONTEXT)
      } catch (e) {
        console.debug('清理选区桥接数据失败:', e)
      }
    },
    openAttachmentPicker() {
      this.$refs.attachmentInputRef?.click?.()
    },
    handleComposerInput() {
      this.adjustComposerHeight()
    },
    handleComposerKeydown(event) {
      if (event.key !== 'Enter') return
      if (event.ctrlKey || event.altKey) {
        event.preventDefault()
        this.insertComposerNewline()
        return
      }
      if (event.shiftKey) return
      if (event.isComposing) return
      event.preventDefault()
      this.sendMessage()
    },
    insertComposerNewline() {
      const textarea = this.$refs.composerInputRef
      const value = String(this.userInput || '')
      if (!textarea) {
        this.userInput = `${value}\n`
        return
      }
      const start = Number(textarea.selectionStart ?? value.length)
      const end = Number(textarea.selectionEnd ?? value.length)
      this.userInput = `${value.slice(0, start)}\n${value.slice(end)}`
      this.$nextTick(() => {
        textarea.focus()
        textarea.setSelectionRange(start + 1, start + 1)
        this.adjustComposerHeight()
      })
    },
    reindexAttachments(list = []) {
      return Array.isArray(list)
        ? list.map((item, index) => ({
            ...item,
            ordinal: index + 1
          }))
        : []
    },
    formatAttachmentReference(item) {
      const ordinal = Number(item?.ordinal || 0) || 0
      const name = String(item?.name || '').trim()
      return name ? `附件${ordinal}（${name}）` : `附件${ordinal}`
    },
    formatShortAttachmentReference(item) {
      const ordinal = Number(item?.ordinal || 0) || 0
      return ordinal > 0 ? `附件${ordinal}` : ''
    },
    insertComposerText(insertedText) {
      const textarea = this.$refs.composerInputRef
      const value = String(this.userInput || '')
      const nextText = String(insertedText || '')
      if (!textarea) {
        this.userInput = `${value}${nextText}`
        this.$nextTick(() => this.adjustComposerHeight())
        return
      }
      const start = Number(textarea.selectionStart ?? value.length)
      const end = Number(textarea.selectionEnd ?? value.length)
      this.userInput = `${value.slice(0, start)}${nextText}${value.slice(end)}`
      this.$nextTick(() => {
        const nextCursor = start + nextText.length
        textarea.focus()
        textarea.setSelectionRange(nextCursor, nextCursor)
        this.adjustComposerHeight()
      })
    },
    insertAttachmentReference(item, mode = 'short') {
      const reference = mode === 'full'
        ? this.formatAttachmentReference(item)
        : this.formatShortAttachmentReference(item)
      if (!reference) return
      const textarea = this.$refs.composerInputRef
      const value = String(this.userInput || '')
      const start = Number(textarea?.selectionStart ?? value.length)
      const end = Number(textarea?.selectionEnd ?? value.length)
      const before = value.slice(0, start)
      const after = value.slice(end)
      const prefix = before && !/[\s(（\[【]$/.test(before) ? ' ' : ''
      const suffix = after && !/^[\s),，。！？；:：\]】）]/.test(after) ? ' ' : ''
      this.insertComposerText(`${prefix}${reference}${suffix}`)
    },
    adjustComposerHeight() {
      const textarea = this.$refs.composerInputRef
      if (!textarea) return
      textarea.style.height = 'auto'
      const nextHeight = Math.min(Math.max(textarea.scrollHeight, 44), 180)
      textarea.style.height = `${nextHeight}px`
      textarea.style.overflowY = textarea.scrollHeight > 180 ? 'auto' : 'hidden'
    },
    async onAttachmentChange(event) {
      const files = Array.from(event?.target?.files || [])
      if (files.length === 0) return
      const remainingCount = MAX_ATTACHMENT_COUNT - this.attachments.length
      if (remainingCount <= 0) {
        alert(`最多只能添加 ${MAX_ATTACHMENT_COUNT} 个附件`)
        event.target.value = ''
        return
      }
      const acceptedFiles = files.slice(0, remainingCount)
      const nextAttachments = []
      for (const file of acceptedFiles) {
        if (file.size > MAX_ATTACHMENT_FILE_SIZE) {
          alert(`文件“${file.name}”超过 ${formatAttachmentSize(MAX_ATTACHMENT_FILE_SIZE)}，暂不支持添加`)
          continue
        }
        const item = {
          id: createAttachmentId(),
          name: file.name || '未命名文件',
          ordinal: this.attachments.length + nextAttachments.length + 1,
          type: file.type || '',
          size: Number(file.size || 0),
          sizeLabel: formatAttachmentSize(file.size || 0),
          isText: false,
          content: '',
          truncated: false,
          parsedKind: ''
        }
        if (isTextLikeAttachment(file)) {
          try {
            const rawText = await readBrowserFileAsText(file)
            item.isText = true
            item.truncated = rawText.length > MAX_ATTACHMENT_TEXT_LENGTH
            item.content = rawText.slice(0, MAX_ATTACHMENT_TEXT_LENGTH)
          } catch (error) {
            console.debug('读取附件文本失败:', error)
          }
        } else if (isStructuredTextAttachment(file)) {
          try {
            const extracted = await extractStructuredAttachmentText(file)
            const rawText = String(extracted?.content || '')
            if (rawText) {
              item.isText = true
              item.parsedKind = String(extracted?.kind || '').trim()
              item.truncated = rawText.length > MAX_ATTACHMENT_TEXT_LENGTH
              item.content = rawText.slice(0, MAX_ATTACHMENT_TEXT_LENGTH)
            }
          } catch (error) {
            console.debug('提取结构化附件文本失败:', error)
          }
        } else if (isRecognizableMultimodalAttachment(file)) {
          try {
            const recognized = await recognizeMultimodalAttachment(file, {
              ownerType: 'attachment',
              ownerId: item.id
            })
            const rawText = String(recognized?.text || '')
            item.parsedKind = String(recognized?.kind || '').trim()
            item.recognition = recognized
            if (rawText) {
              item.isText = true
              item.truncated = rawText.length > MAX_ATTACHMENT_TEXT_LENGTH
              item.content = rawText.slice(0, MAX_ATTACHMENT_TEXT_LENGTH)
            } else {
              item.isText = true
              item.truncated = false
              item.content = String(recognized?.summary || '')
            }
          } catch (error) {
            console.debug('多模态附件识别失败:', error)
            item.content = `已接收多媒体附件：${item.name}，当前无法自动识别内容。`
          }
        }
        nextAttachments.push(item)
      }
      this.attachments = this.reindexAttachments([...this.attachments, ...nextAttachments])
      event.target.value = ''
    },
    removeAttachment(attachmentId) {
      this.attachments = this.reindexAttachments(this.attachments.filter(item => item.id !== attachmentId))
    },
    clearAttachments() {
      this.attachments = []
      const input = this.$refs.attachmentInputRef
      if (input) input.value = ''
    },
    cloneSelectionSnapshot(snapshot = null) {
      if (!snapshot || typeof snapshot !== 'object') return null
      try {
        return JSON.parse(JSON.stringify(snapshot))
      } catch (_) {
        return null
      }
    },
    getSelectionHintLabel(snapshot = null) {
      const text = String(snapshot?.text || '').trim()
      if (!text) return ''
      const kind = String(snapshot?.kind || '').trim()
      const length = text.length
      if (kind === 'selection') return `已选 ${length} 字`
      if (kind === 'table-cell') return `单元格 ${length} 字`
      if (kind === 'paragraph') return `段落 ${length} 字`
      return `上下文 ${length} 字`
    },
    getSelectionHintTooltip(snapshot = null) {
      return String(snapshot?.text || '').trim()
    },
    buildUserMessageMeta(options = {}) {
      const meta = {}
      const scope = String(options.scope || '').trim().toLowerCase()
      const scopeReason = String(options.scopeReason || '').trim()
      const selectionSnapshot = options.selectionSnapshot || null
      const documentSnapshot = options.snapshot || null
      const attachmentsSnapshot = Array.isArray(options.attachmentsSnapshot) ? options.attachmentsSnapshot : []
      if (scope) meta.scope = scope
      if (scopeReason) meta.scopeReason = scopeReason
      if (selectionSnapshot?.text) {
        meta.selectionSnapshot = this.cloneSelectionSnapshot(selectionSnapshot)
      }
      if (scope === 'document') {
        const characterCount = Number(options.documentCharCount || documentSnapshot?.documentStats?.characterCount || 0)
        const details = []
        if (documentSnapshot?.documentName) details.push(`文档名称：${documentSnapshot.documentName}`)
        if (characterCount > 0) details.push(`字符数：${characterCount}`)
        if (Number(documentSnapshot?.documentStats?.totalPages || 0) > 0) {
          details.push(`总页数：${documentSnapshot.documentStats.totalPages}`)
        }
        if (Number(documentSnapshot?.documentStats?.paragraphCount || 0) > 0) {
          details.push(`段落数：${documentSnapshot.documentStats.paragraphCount}`)
        }
        meta.contextLabel = characterCount > 0 ? `全文 ${characterCount} 字` : '全文'
        meta.contextTooltip = details.join('\n') || meta.contextLabel
      } else {
        const label = this.getSelectionHintLabel(selectionSnapshot)
        if (label) {
          meta.contextLabel = label
          meta.contextTooltip = this.getSelectionHintTooltip(selectionSnapshot) || label
        }
      }
      if (attachmentsSnapshot.length > 0) {
        meta.attachments = this.cloneAttachmentSnapshot(attachmentsSnapshot)
      }
      return meta
    },
    applyResolvedUserScopeMeta(chatObj, userMessageId, scopeDecision = {}, options = {}) {
      const messages = Array.isArray(chatObj?.messages) ? chatObj.messages : []
      const userMessage = messages.find(item => item?.id === userMessageId)
      if (!userMessage) return
      const resolvedScope = String(scopeDecision?.resolvedScope || '').trim() || 'selection'
      const scopeLabel = resolvedScope === 'document'
        ? `全文 ${Number(options.documentCharCount || 0) > 0 ? `${Number(options.documentCharCount || 0)} 字` : ''}`.trim()
        : resolvedScope === 'prompt'
          ? '仅输入内容'
          : this.getSelectionHintLabel(options.selectionSnapshot) || '选中内容'
      const scopeTooltip = [
        `本轮输入范围：${resolvedScope === 'document' ? '全文' : resolvedScope === 'prompt' ? '仅输入' : '选中内容'}`,
        String(scopeDecision?.reason || '').trim()
      ].filter(Boolean).join('\n')
      userMessage.messageMeta = {
        ...(userMessage?.messageMeta && typeof userMessage.messageMeta === 'object' ? userMessage.messageMeta : {}),
        scope: resolvedScope,
        scopeReason: String(scopeDecision?.reason || '').trim(),
        contextLabel: scopeLabel,
        contextTooltip: scopeTooltip || scopeLabel
      }
    },
    getUserMessageContextLabel(message) {
      return String(message?.messageMeta?.contextLabel || '').trim()
    },
    getUserMessageContextTooltip(message) {
      return String(message?.messageMeta?.contextTooltip || '').trim() || this.getUserMessageContextLabel(message)
    },
    getUserMessageContextTooltipKey(message) {
      return `message-context-${message?.id || 'unknown'}`
    },
    getUserMessageAttachments(message) {
      return Array.isArray(message?.messageMeta?.attachments) ? message.messageMeta.attachments : []
    },
    getUserMessageAttachmentLabel(item) {
      const ordinal = Number(item?.ordinal || 0)
      return ordinal > 0 ? `附件${ordinal}` : '附件'
    },
    getUserMessageAttachmentTooltip(item) {
      const details = []
      if (item?.name) details.push(`文件名：${item.name}`)
      if (item?.sizeLabel) details.push(`大小：${item.sizeLabel}`)
      if (item?.type) details.push(`类型：${item.type}`)
      if (item?.isText) {
        details.push(item?.truncated ? '已提取部分正文内容' : '已提取正文内容')
      } else {
        details.push('当前仅保留附件元信息')
      }
      return details.join('\n')
    },
    getUserMessageAttachmentTooltipKey(message, item) {
      return `message-attachment-${message?.id || 'unknown'}-${item?.id || item?.ordinal || item?.name || 'item'}`
    },
    buildSelectionContextSupplement(snapshot = null) {
      const resolvedSnapshot = snapshot || this.resolveBestSelectionContext()
      if (!resolvedSnapshot?.text) return ''
      return `【当前选中内容/上下文】\n${buildSelectionContextPrompt(resolvedSnapshot)}`
    },
    cloneAttachmentSnapshot(list = this.attachments) {
      return Array.isArray(list)
        ? list.map(item => ({
          id: item?.id || '',
          ordinal: Number(item?.ordinal || 0) || 0,
          name: item?.name || '',
          type: item?.type || '',
          size: Number(item?.size || 0),
          sizeLabel: item?.sizeLabel || formatAttachmentSize(item?.size || 0),
          isText: item?.isText === true,
          content: item?.content || '',
          truncated: item?.truncated === true,
          parsedKind: item?.parsedKind || '',
          recognition: item?.recognition ? JSON.parse(JSON.stringify(item.recognition)) : null
        }))
        : []
    },
    resolveRequestedAttachments(text, list = this.attachments) {
      const items = Array.isArray(list)
        ? list.map((item, index) => ({
            ...item,
            ordinal: Number(item?.ordinal || 0) || index + 1
          }))
        : []
      if (items.length === 0) {
        return {
          attachments: [],
          explicitlyScoped: false,
          summary: '',
          unmatchedSelectors: []
        }
      }
      const normalized = String(text || '').trim()
      const lookupText = normalizeAttachmentLookupText(normalized)
      const selected = []
      const selectedKeys = new Set()
      const unmatchedSelectors = []
      const addItem = (item) => {
        const key = item?.id || `${item?.ordinal || ''}-${item?.name || ''}`
        if (!key || selectedKeys.has(key)) return
        selectedKeys.add(key)
        selected.push(item)
      }
      const matchByRule = (label, pattern, matcher) => {
        if (!pattern.test(normalized)) return
        const matches = items.filter(matcher)
        if (matches.length === 0) {
          unmatchedSelectors.push(label)
          return
        }
        matches.forEach(addItem)
      }
      Array.from(normalized.matchAll(/(?:第\s*([0-9一二三四五六七八九十两]+)\s*个附件|附件\s*([0-9一二三四五六七八九十两]+))/gi))
        .forEach((match) => {
          const ordinal = parseChineseNumberToken(match?.[1] || match?.[2] || '')
          if (!Number.isFinite(ordinal) || ordinal <= 0) return
          const target = items.find(item => Number(item.ordinal) === ordinal)
          if (target) {
            addItem(target)
          } else {
            unmatchedSelectors.push(`附件${ordinal}`)
          }
        })
      items.forEach((item) => {
        const normalizedName = normalizeAttachmentLookupText(item?.name || '')
        if (normalizedName && normalizedName.length >= 3 && lookupText.includes(normalizedName)) {
          addItem(item)
        }
      })
      matchByRule(
        '表格附件',
        /(表格附件|表格文件|excel附件|excel文件|xlsx附件|xls附件|csv附件|工作表附件|电子表格附件)/i,
        item => /\.(xlsx|xls|et|csv|tsv)$/i.test(String(item?.name || '')) ||
          /sheet|excel|csv|spreadsheet/i.test(String(item?.type || '')) ||
          String(item?.parsedKind || '').toLowerCase() === 'xlsx'
      )
      matchByRule(
        'PDF附件',
        /(pdf附件|pdf文件|pdf材料)/i,
        item => /\.pdf$/i.test(String(item?.name || '')) ||
          String(item?.parsedKind || '').toLowerCase() === 'pdf' ||
          /pdf/i.test(String(item?.type || ''))
      )
      matchByRule(
        'Word附件',
        /(word附件|word文件|doc附件|docx附件|文档附件)/i,
        item => /\.(doc|docx|aidocx)$/i.test(String(item?.name || '')) ||
          String(item?.parsedKind || '').toLowerCase() === 'docx' ||
          /word|document|officedocument/i.test(String(item?.type || ''))
      )
      matchByRule(
        '图片附件',
        /(图片附件|图像附件|配图附件|插图附件|image附件)/i,
        item => /^image\//i.test(String(item?.type || '')) ||
          /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(String(item?.name || ''))
      )
      return {
        attachments: selected.length > 0 ? selected : items,
        explicitlyScoped: selected.length > 0,
        summary: selected.length > 0
          ? `用户已明确指定本次重点使用：${selected.map(item => `附件${item.ordinal}（${item.name || '未命名文件'}）`).join('、')}。${selected.length < items.length ? '除非用户再次提及，其余附件不作为主要依据。' : ''}`
          : '',
        unmatchedSelectors: Array.from(new Set(unmatchedSelectors))
      }
    },
    buildAttachmentPrompt(list = this.attachments) {
      if (!Array.isArray(list) || list.length === 0) return ''
      return list.map((item, index) => {
        const parsedLabel = item?.parsedKind ? `，已提取${String(item.parsedKind).toUpperCase()}文本` : ''
        const recognitionSummary = String(item?.recognition?.summary || '').trim()
        const attachmentOrdinal = Number(item?.ordinal || 0) || index + 1
        const header = `附件${attachmentOrdinal}：${item.name}${item.type ? `（${item.type}）` : ''}，大小 ${item.sizeLabel}${parsedLabel}`
        if (item.isText && String(item.content || '').trim()) {
          return [
            header,
            '可用内容：',
            '---',
            String(item.content || '').trim(),
            item.truncated ? '\n[附件内容已截断]' : '',
            '---'
          ].filter(Boolean).join('\n')
        }
        return `${header}\n说明：${recognitionSummary || '当前版本已附带文件元信息，但未解析该二进制文件内容。'}`
      }).join('\n\n')
    },
    buildAttachmentInstructionPrompt(text, list = this.attachments, resolution = null) {
      if (!Array.isArray(list) || list.length === 0) return ''
      const normalized = String(text || '').trim()
      const resolved = resolution || this.resolveRequestedAttachments(normalized, list)
      const activeList = Array.isArray(resolved?.attachments) && resolved.attachments.length > 0
        ? resolved.attachments
        : list
      const excludedCount = Math.max(0, list.length - activeList.length)
      const unresolvedNames = activeList
        .filter(item => !(item?.isText && String(item.content || '').trim()))
        .map(item => item?.name)
        .filter(Boolean)
      const extractedCount = list.filter(item => item?.isText && String(item.content || '').trim()).length
      const lines = [
        '【附件使用规则】',
        `当前对话已上传 ${list.length} 个附件，其中 ${extractedCount} 个附件可直接引用正文内容。`,
        '除非用户明确排除，否则应把附件内容视为当前任务的可用上下文，并优先结合附件信息完成回答。'
      ]
      if (resolved?.summary) lines.push(resolved.summary)
      if (/(参照|参考|根据|按照|依照|模仿|仿照|例子|示例|样例|模板|样板|格式参照|按附件|照着附件)/.test(normalized)) {
        lines.push('当前请求要求参考附件：请优先学习附件中的结构、字段顺序、标题层级、语气、格式和写法，再生成结果。')
      }
      if (/(对比|比较|比对|核对|差异|不同|一致|变化|对照)/.test(normalized)) {
        lines.push(activeList.length > 1
          ? '当前请求要求比较附件：请优先按附件名称逐项对比，输出相同点、差异点、缺失项和结论。'
          : '当前请求包含比较语义：若只有一个附件，则将该附件与用户当前要求、当前文档或选中内容进行对照分析。')
      }
      if (/(总结|摘要|提炼|分析|审查|解读|梳理|生成|撰写|改写|润色|翻译|问答|回答|说明)/.test(normalized) || !normalized) {
        lines.push(resolved?.explicitlyScoped
          ? '当前请求已限定附件范围，请优先基于被点名的附件作答；若引用附件信息，尽量带上附件名称。'
          : '若用户没有限定只看某一个附件，默认综合所有附件内容作答；引用附件信息时，尽量带上附件名称。')
      }
      if (excludedCount > 0) {
        lines.push(`当前有 ${excludedCount} 个未被点名的附件已暂时降权处理。`)
      }
      if (resolved?.unmatchedSelectors?.length) {
        lines.push(`用户提到了未匹配成功的附件指代：${resolved.unmatchedSelectors.join('、')}。若需要，请提醒用户检查附件名称或序号。`)
      }
      if (unresolvedNames.length > 0) {
        lines.push(`以下附件当前仅提供了文件元信息，未成功提取正文：${unresolvedNames.join('、')}。若结论依赖这些附件的原文，请明确说明信息可能不足。`)
      }
      return lines.join('\n')
    },
    buildAttachmentContext(text, list = this.attachments) {
      const resolution = this.resolveRequestedAttachments(text, list)
      return {
        attachments: resolution.attachments,
        attachmentInstructionPrompt: this.buildAttachmentInstructionPrompt(text, list, resolution),
        attachmentPrompt: this.buildAttachmentPrompt(resolution.attachments),
        resolution
      }
    },
    buildBufferedApiUserContent(text, options = {}) {
      return this.buildApiUserContent(text, {
        ...options,
        selectionSnapshot: options.selectionSnapshot || this.getBufferedSelectionContext(),
        attachmentsSnapshot: options.attachmentsSnapshot || this.cloneAttachmentSnapshot()
      })
    },
    buildSelectionContextSupplementFromBufferedState() {
      const snapshot = this.getBufferedSelectionContext()
      if (!snapshot?.text) return ''
      return this.buildSelectionContextSupplement(snapshot)
    },
    buildDocumentContextSupplement(documentText, snapshot = null) {
      const normalizedText = String(documentText || '').trim()
      if (!normalizedText) return ''
      const resolvedSnapshot = snapshot || this.getLiveSelectionContext() || this.resolveBestSelectionContext()
      const lines = ['【当前整篇文档】']
      if (resolvedSnapshot?.documentName) {
        lines.push(`文档名称：${resolvedSnapshot.documentName}`)
      }
      if (resolvedSnapshot?.documentStats?.totalPages > 0) {
        lines.push(`总页数：${resolvedSnapshot.documentStats.totalPages}`)
      }
      if (resolvedSnapshot?.documentStats?.currentPage > 0) {
        lines.push(`当前页：第 ${resolvedSnapshot.documentStats.currentPage} 页`)
      }
      if (resolvedSnapshot?.documentStats?.wordCount > 0) {
        lines.push(`词数：${resolvedSnapshot.documentStats.wordCount}`)
      }
      if (resolvedSnapshot?.documentStats?.characterCount > 0) {
        lines.push(`字符数：${resolvedSnapshot.documentStats.characterCount}`)
      }
      if (resolvedSnapshot?.documentStats?.paragraphCount > 0) {
        lines.push(`段落数：${resolvedSnapshot.documentStats.paragraphCount}`)
      }
      lines.push('文档全文：')
      lines.push('---')
      lines.push(normalizedText)
      lines.push('---')
      return lines.join('\n')
    },
    buildVisibleUserMessage(text, options = {}) {
      const baseText = String(text || '').trim()
        || (this.attachments.length > 0 ? '请结合附件内容进行处理。' : '请结合当前内容进行处理。')
      return baseText
    },
    resolveUserTaskInputScope(text = '', options = {}) {
      const inputInfo = resolveDocumentInput('selection-preferred')
      return resolveDocumentTaskInputScope(text, {
        routeKind: options.routeKind,
        hasSelection: inputInfo?.hasSelection === true,
        hasDocument: inputInfo?.hasDocument === true
      })
    },
    resolveExactStatsMaterialText(text = '') {
      const normalized = String(text || '').trim()
      if (!normalized) return ''
      if (ACTIVE_DOCUMENT_REFERENCE_PATTERN.test(normalized) || /(选中|选区|这段|本段|当前段落)/.test(normalized)) {
        return String(this.resolveBestSelectionContext()?.text || '').trim()
      }
      if (FULL_DOCUMENT_REFERENCE_PATTERN.test(normalized) || /(当前文档|全文|全篇|整篇|文档全文)/.test(normalized)) {
        return String(getDocumentText() || '').trim()
      }
      return ''
    },
    buildTaskInputScopeSupplement(taskInputScope) {
      if (!taskInputScope || typeof taskInputScope !== 'object') return ''
      const resolved = String(taskInputScope.resolvedScope || '').trim()
      const requested = String(taskInputScope.requestedScope || '').trim()
      const reason = String(taskInputScope.reason || '').trim()
      const scopeLabel = (key) => {
        if (key === 'document') return '整篇文档正文'
        if (key === 'selection') return '当前选区（或单元格/段落上下文块，见下文「当前文档上下文」）'
        if (key === 'prompt') return '仅用户本次输入与附件，不附加文档正文或选区片段'
        if (key === 'selection-preferred') return '自动：有选区用选区，否则全文'
        return key || '未指定'
      }
      const lines = [
        '【本轮材料范围（由系统根据你的表述判定，模型请严格按此执行）】',
        `实际采用：${scopeLabel(resolved)}。`
      ]
      if (requested && requested !== resolved) {
        lines.push(`你的字面倾向：${scopeLabel(requested)}；因当前文档/选区状态已与倾向对齐或做了回退。`)
      }
      if (reason) lines.push(`判定说明：${reason}`)
      if (resolved === 'selection') {
        lines.push('请把下文「当前文档上下文」中的选区正文当作唯一待处理材料，不要改用全文，除非用户明确要求全文。')
      }
      if (resolved === 'document') {
        lines.push('请把下文「当前整篇文档」中的正文当作待处理材料。')
      }
      if (resolved === 'prompt') {
        lines.push('请勿臆造文档原文；若需要文档内容，请提示用户在文档中选中文本或明确说「全文」。')
      }
      return lines.join('\n')
    },
    buildSuggestedDocumentActionSupplement(action = '') {
      const normalized = String(action || '').trim()
      if (!normalized) return ''
      const actionLabel = this.getAssistantDocumentActionLabel(normalized)
      const lines = [
        '【本轮写回动作建议】',
        `用户语义更接近：${actionLabel}。`,
        '若结果需要写回文档，请优先按该动作组织输出；若用户明确改口，以最新指令为准。'
      ]
      return lines.join('\n')
    },
    shouldForcePlainTextIntroResponse(text = '') {
      const normalized = String(text || '').trim()
      if (!normalized) return false
      return /(你是谁|你是做什么的|你能做什么|有什么功能|有哪些能力|这个软件怎么用|介绍一下你|介绍你自己|介绍一下这个软件|介绍一下这个助手|介绍一下当前文档|介绍一下这份文档|说说你自己|讲讲你自己|who are you|introduce yourself|tell me about yourself|what can you do)/i.test(normalized)
    },
    appendPlainTextIntroInstruction(content = '') {
      const base = String(content || '').trim()
      if (!base) return '请用自然、简洁的纯文本短段落回答，不要使用 Markdown、井号标题、星号加粗、项目符号、编号列表、代码块、表格或表情符号。'
      return [
        base,
        '【输出要求】',
        '如果本次是在介绍助手、软件、能力范围或当前文档可处理事项，请像同事介绍产品一样，用 2 到 3 个自然短段落直接回答。',
        '不要使用 Markdown、井号标题、星号加粗、项目符号、编号列表、代码块、表格、表情符号或宣传页式分栏标题。'
      ].join('\n\n')
    },
    appendPlainParagraphDocumentInstruction(content = '') {
      const base = String(content || '').trim()
      const rule = '请用自然段落与完整句子直接作答。不要使用 Markdown、井号标题、星号或短横线开头的列表、项目符号、编号列表、代码块或表格。若需分点说明，请用分号或句号分句写在同一段落中。'
      if (!base) return rule
      return [base, '【输出要求】', rule].join('\n\n')
    },
    normalizePlainTextIntroOutput(text = '') {
      return String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/```+/g, '')
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
        .replace(/^#{1,6}\s*/gm, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/^\s*>\s?/gm, '')
        .replace(/^\s*(?:[-*+•●▪◦▸▶︎►]|(?:\d+|[a-zA-Z])[.)])\s+/gm, '')
        .replace(/^\s*[:：]\s*/gm, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    },
    shouldUseCurrentDocumentIntroLocalFaq(text = '', snapshot = null) {
      const normalized = String(text || '').trim()
      if (!normalized) return false
      if (!/(当前文档|这份文档|这个文档|当前文件|这份文件|这个文件|当前材料|这份材料|这篇文档|这篇文章)/.test(normalized)) return false
      if (!/(介绍|说说|讲讲|能做什么|可以做什么|怎么处理|如何处理|帮我做什么|适合怎么用|有哪些能力|有什么能力|怎么用)/.test(normalized)) return false
      const resolvedSnapshot = snapshot || this.getLiveSelectionContext() || this.resolveBestSelectionContext()
      return !!String(getDocumentText() || '').trim() ||
        !!String(resolvedSnapshot?.documentName || '').trim() ||
        Number(resolvedSnapshot?.documentStats?.totalPages || 0) > 0 ||
        Number(resolvedSnapshot?.documentStats?.characterCount || 0) > 0
    },
    getCurrentDocumentIntroCategory(documentName = '', previewText = '') {
      const corpus = `${String(documentName || '')} ${String(previewText || '')}`
      if (/(教程|手册|指南|说明|入门|使用教程|用户手册|操作手册)/i.test(corpus)) return 'tutorial'
      if (/(合同|协议|制度|规定|规范|办法|条例|章程|合规|审计)/i.test(corpus)) return 'policy'
      if (/(报告|汇报|纪要|总结|方案|计划|材料|简报|周报|月报|年报)/i.test(corpus)) return 'report'
      return 'general'
    },
    buildCurrentDocumentIntroLocalFaq(text = '', snapshot = null) {
      const payload = this.getCurrentDocumentPayload()
      const resolvedSnapshot = snapshot || payload.snapshot || this.resolveBestSelectionContext()
      const documentName = String(resolvedSnapshot?.documentName || '').trim()
      const docLabel = documentName ? `《${documentName}》` : '当前文档'
      const stats = resolvedSnapshot?.documentStats || {}
      const statsParts = []
      if (Number(stats.totalPages || 0) > 0) statsParts.push(`${stats.totalPages} 页`)
      if (Number(stats.paragraphCount || 0) > 0) statsParts.push(`${stats.paragraphCount} 段`)
      if (Number(payload.documentCharCount || stats.characterCount || 0) > 0) {
        statsParts.push(`${Number(payload.documentCharCount || stats.characterCount || 0)} 字`)
      }
      const kind = String(resolvedSnapshot?.kind || '').trim()
      const scopeParts = []
      if (kind === 'selection') scopeParts.push('当前还有选区内容可直接继续处理')
      else if (kind === 'paragraph') scopeParts.push('当前段落也可以单独处理')
      else if (kind === 'table-cell') scopeParts.push('当前单元格内容也可以单独处理')
      if (resolvedSnapshot?.position?.paragraphLabel) scopeParts.push(resolvedSnapshot.position.paragraphLabel)
      if (Number(stats.currentPage || 0) > 0) scopeParts.push(`当前阅读位置大约在第 ${stats.currentPage} 页`)

      const previewText = String(payload.documentText || resolvedSnapshot?.text || '').slice(0, 1200)
      const category = this.getCurrentDocumentIntroCategory(documentName, previewText)
      const abilityParagraph = category === 'tutorial'
        ? `${docLabel}更像教程、手册或说明类材料。我比较适合先帮你做整篇摘要、解释某一章节、提取步骤清单、整理要点，或者围绕术语和具体操作细节做问答。`
        : category === 'policy'
          ? `${docLabel}更像制度、规范、协议或审查类材料。我可以先帮你梳理条款结构、提取关键要求、统一术语、做风险检查，或者按段解释重点内容。`
          : category === 'report'
            ? `${docLabel}更像报告、汇报、纪要或方案类材料。我可以先帮你提炼结论、整理结构、统一表述、润色语气，或者抽取行动项和关键信息。`
            : `${docLabel}适合先从摘要、结构梳理、重点提炼、改写润色、翻译、术语统一和问答解释这些常见处理方式入手。`

      const firstParagraph = `${docLabel}${statsParts.length > 0 ? `目前大约是 ${statsParts.join('，')} 的体量。` : '已经可以直接结合文档内容来处理。'}${scopeParts.length > 0 ? `${scopeParts.join('，')}。` : ''}我可以先根据这份文档的内容和你当前所在位置，给出更贴近现场的处理帮助。`
      const thirdParagraph = `如果你愿意，我现在就可以先做三类高频事情：帮你总结这份文档，解释当前页或当前选区在讲什么，或者把其中的步骤、要点、清单、术语和关键信息整理出来。你也可以直接告诉我想先处理摘要、问答、提取、润色、翻译还是审查。`

      return {
        type: 'current-document-intro',
        title: '当前文档说明',
        detail: '本次将直接根据当前文档状态返回本地说明，不再请求大模型。',
        reason: '已识别为“介绍当前文档 / 当前文档能做什么”类请求，直接返回本地说明。',
        text: this.normalizePlainTextIntroOutput([firstParagraph, abilityParagraph, thirdParagraph].join('\n\n')),
        existingAssistantHints: ['summary', 'analysis.rewrite', 'translate'],
        suggestedAction: {
          type: 'open-assistants-sidebar',
          label: '查看当前文档入口',
          viewLabel: '查看助手列表',
          dismissLabel: '暂不需要',
          targetItemKey: 'summary',
          searchText: category === 'tutorial' || category === 'report' ? '摘要' : category === 'policy' ? '审查' : '文档'
        }
      }
    },
    buildApiUserContent(text, options = {}) {
      const baseText = String(text || '').trim()
        || ((options.attachmentsSnapshot || this.attachments).length > 0 ? '请结合附件内容进行处理。' : '请结合当前内容进行处理。')
      const attachmentsSnapshot = options.attachmentsSnapshot || this.attachments
      const sections = [`【用户要求】\n${baseText}`]
      const taskInputScopePrompt = this.buildTaskInputScopeSupplement(options.taskInputScope)
      const suggestedDocumentActionPrompt = this.buildSuggestedDocumentActionSupplement(options.suggestedDocumentAction)
      const scope = String(options.scope || '').trim() || 'selection'
      const selectionPrompt = scope === 'document'
        ? this.buildDocumentContextSupplement(options.documentText, options.snapshot)
        : scope === 'prompt'
          ? ''
          : this.buildSelectionContextSupplement(options.selectionSnapshot || null)
      const attachmentContext = this.buildAttachmentContext(baseText, attachmentsSnapshot)
      const attachmentInstructionPrompt = attachmentContext.attachmentInstructionPrompt
      const attachmentPrompt = attachmentContext.attachmentPrompt
      if (taskInputScopePrompt) sections.push(taskInputScopePrompt)
      if (suggestedDocumentActionPrompt) sections.push(suggestedDocumentActionPrompt)
      if (attachmentInstructionPrompt) sections.push(attachmentInstructionPrompt)
      if (selectionPrompt) sections.push(selectionPrompt)
      if (attachmentPrompt) sections.push(`【附件】\n${attachmentPrompt}`)
      return sections.filter(Boolean).join('\n\n')
    },
    buildGeneratedOutputContext(text, intent) {
      const requestedScope = String(intent?.scope || 'selection').trim().toLowerCase()
      if (requestedScope === 'document') {
        const { documentText, snapshot, documentCharCount } = this.getCurrentDocumentPayload()
        if (!documentText) {
          throw new Error('当前文档为空，暂时没有可用于生成文件的正文内容')
        }
        return {
          scope: 'document',
          documentText,
          snapshot,
          documentCharCount,
          options: {
            scope: 'document',
            documentText,
            snapshot,
            documentCharCount
          },
          promptText: this.buildApiUserContent(text, {
            scope: 'document',
            documentText,
            snapshot
          }),
          sourceText: documentText
        }
      }

      const selectionContext = this.resolveBestSelectionContext()
      const selectionText = String(selectionContext?.text || '').trim()
      if (requestedScope === 'selection' && selectionText) {
        return {
          scope: 'selection',
          snapshot: selectionContext,
          documentCharCount: selectionText.length,
          options: {},
          promptText: this.buildApiUserContent(text),
          sourceText: selectionText
        }
      }

      const attachmentText = this.attachments
        .filter(item => item?.isText && String(item.content || '').trim())
        .map(item => String(item.content || '').trim())
        .join('\n\n')

      return {
        scope: requestedScope === 'selection' ? 'prompt' : requestedScope,
        snapshot: selectionContext,
        documentCharCount: selectionText.length,
        options: {},
        promptText: this.buildApiUserContent(text),
        sourceText: selectionText || attachmentText || String(text || '').trim()
      }
    },
    getGeneratedOutputProgressText(intent, context) {
      const baseLabel = intent?.action === 'report'
        ? (String(intent?.reportContext?.reportName || '').trim() || '报告文件')
        : intent?.action === 'object-export'
          ? '对象附件'
        : intent?.action === 'image-export'
          ? '图片附件'
        : intent?.action === 'image'
          ? '图片文件'
          : intent?.action === 'video'
            ? '视频文件'
            : '语音文件'
      if (context?.scope === 'document') {
        return `正在基于全文生成${baseLabel}...`
      }
      if (context?.scope === 'selection') {
        return `正在基于当前内容生成${baseLabel}...`
      }
      return `正在生成${baseLabel}...`
    },
    async generateReportFileContent(userText, model, intent, context, assistantMsg, runContext = null, abortSignal = null) {
      const outputFormat = ['json', 'md', 'csv', 'txt', 'xlsx'].includes(String(intent?.outputFormat || '').toLowerCase())
        ? String(intent.outputFormat).toLowerCase()
        : 'md'
      const reportContext = intent?.reportContext || {}
      const reportName = String(reportContext.reportName || intent?.fileBaseName || '生成报告').trim() || '生成报告'
      const reportIndustry = String(reportContext.industry || '').trim()
      const reportTypeLabel = String(reportContext.reportTypeLabel || getReportTypeLabel(reportContext.reportType || 'general-analysis-report')).trim()
      const outlineText = String(reportContext.outlineText || '').trim()
      const writingGuidance = String(reportContext.writingGuidance || '').trim()
      const generationPrompt = String(reportContext.generationPrompt || '').trim()
      const systemPrompt = [
        '你是一位专业报告生成助手。',
        outputFormat === 'json'
          ? '请只输出合法 JSON 文件内容，不要输出 markdown 代码块，不要输出 JSON 之外的说明。'
          : outputFormat === 'csv' || outputFormat === 'xlsx'
            ? '请只输出合法 CSV 文件内容。第一行必须是表头；后续每行一条记录；字段内若包含逗号、双引号或换行，请按 CSV 标准转义；不要输出 Markdown、解释或代码块。'
            : outputFormat === 'txt'
              ? '请直接输出最终纯文本文件内容，不要使用 Markdown 标记，不要添加说明文字或代码块。'
              : '请直接输出最终 Markdown 文件内容，不要添加前言、后记、说明文字，也不要使用 ``` 代码块包裹。',
        `当前要生成的文件名称是：${reportName}。`,
        reportIndustry ? `所属行业：${reportIndustry}。` : '',
        reportTypeLabel ? `报告类型：${reportTypeLabel}。` : '',
        '若用户提供了附件模板、参考格式或示例结构，必须优先遵循附件中的标题层级、字段顺序、格式风格和命名方式。',
        '若用户要求提取关键词并生成报告，请先完成关键词提炼，再将关键词结果和对应解读写入最终文件。',
        outputFormat === 'csv' || outputFormat === 'xlsx'
          ? '当用户要求提炼为表格、Excel、CSV、清单或台账时，请将结果组织成稳定列结构，优先输出适合直接导入表格软件的数据。'
          : '若用户要求提炼内容，请优先输出结构清晰、便于下载保存的最终文件内容。'
      ].join('\n')

      const draftConstraintText = [
        reportIndustry ? `行业：${reportIndustry}` : '',
        reportTypeLabel ? `报告类型：${reportTypeLabel}` : '',
        outlineText ? `报告大纲：\n${outlineText}` : '',
        writingGuidance ? `写作口径：${writingGuidance}` : '',
        generationPrompt ? `生成要求：${generationPrompt}` : ''
      ].filter(Boolean).join('\n\n')

      if (context?.scope === 'document' && String(context.documentText || '').length > DIRECT_DOCUMENT_CHAR_LIMIT) {
        const { chunks } = this.getDocumentChunks(context.documentText, 'synthesize')
        const attachmentPrompt = this.buildAttachmentContext(userText).attachmentPrompt
        const notes = []
        const runStartedAtMs = Date.now()
        for (let i = 0; i < chunks.length; i++) {
          if (runContext) this.ensureGeneratedOutputRunActive(runContext, assistantMsg)
          assistantMsg.content = `正在阅读整篇文档并整理报告素材（第 ${i + 1}/${chunks.length} 段）...`
          if (assistantMsg?.activeGeneratedOutputRun) {
            const elapsedMs = Date.now() - runStartedAtMs
            const avgChunkMs = i > 0 ? Math.round(elapsedMs / i) : 0
            const estimatedRemainingMs = avgChunkMs > 0 ? avgChunkMs * Math.max(0, chunks.length - i) : 0
            assistantMsg.activeGeneratedOutputRun.current = i + 1
            assistantMsg.activeGeneratedOutputRun.total = chunks.length
            assistantMsg.activeGeneratedOutputRun.progress = Math.min(92, Math.max(10, Math.round(((i + 1) / chunks.length) * 92)))
            assistantMsg.activeGeneratedOutputRun.estimatedRemainingMs = estimatedRemainingMs
            assistantMsg.activeGeneratedOutputRun.statusMessage = `正在整理报告素材（第 ${i + 1}/${chunks.length} 段）...`
            this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, `开始读取第 ${i + 1}/${chunks.length} 段报告素材。`)
          }
          const note = await chatCompletion({
            providerId: model.providerId,
            modelId: model.modelId,
            signal: abortSignal,
            temperature: 0.3,
            messages: this.buildDocumentAnalysisChunkMessages(
              userText,
              chunks[i],
              i + 1,
              chunks.length,
              attachmentPrompt
            )
          })
          if (runContext) this.ensureGeneratedOutputRunActive(runContext, assistantMsg)
          notes.push(`第 ${i + 1} 段要点：\n${String(note || '').trim()}`)
          if (assistantMsg?.activeGeneratedOutputRun) {
            this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, `第 ${i + 1}/${chunks.length} 段素材整理完成。`)
          }
        }
        assistantMsg.content = '正在生成最终报告文件...'
        if (assistantMsg?.activeGeneratedOutputRun) {
          assistantMsg.activeGeneratedOutputRun.current = chunks.length
          assistantMsg.activeGeneratedOutputRun.total = chunks.length
          assistantMsg.activeGeneratedOutputRun.progress = 96
          assistantMsg.activeGeneratedOutputRun.estimatedRemainingMs = 0
          assistantMsg.activeGeneratedOutputRun.statusMessage = '分段阅读完成，正在生成最终报告文件...'
          this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, '报告素材整理完成，开始生成最终文件。')
        }
        const synthesisMessages = this.buildDocumentSynthesisMessages(
          `${userText}\n\n最终输出要求：${
            outputFormat === 'json'
              ? '输出合法 JSON 文件内容。'
              : outputFormat === 'csv' || outputFormat === 'xlsx'
                ? '输出合法 CSV 表格内容。'
                : outputFormat === 'txt'
                  ? '输出纯文本文件内容。'
                  : '输出 Markdown 报告文件内容。'
          }\n\n${draftConstraintText}`,
          notes,
          context.snapshot
        )
        return chatCompletion({
          providerId: model.providerId,
          modelId: model.modelId,
          signal: abortSignal,
          temperature: 0.2,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: synthesisMessages?.[1]?.content || context.promptText }
          ]
        })
      }

      if (assistantMsg?.activeGeneratedOutputRun) {
        assistantMsg.activeGeneratedOutputRun.current = 1
        assistantMsg.activeGeneratedOutputRun.total = 1
        assistantMsg.activeGeneratedOutputRun.progress = 42
        assistantMsg.activeGeneratedOutputRun.estimatedRemainingMs = 0
        assistantMsg.activeGeneratedOutputRun.statusMessage = '正在生成最终报告文件...'
        this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, '直接生成最终报告文件内容。')
      }
      return chatCompletion({
        providerId: model.providerId,
        modelId: model.modelId,
        signal: abortSignal,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [context?.promptText || String(userText || '').trim(), draftConstraintText].filter(Boolean).join('\n\n') }
        ]
      })
    },
    async handleGeneratedOutputMessage(text, chatModel, intent, prepared = null) {
      const context = this.buildGeneratedOutputContext(text, intent)
      if (intent?.action === 'report' && context.scope === 'document' && String(context.documentText || '').length > DIRECT_DOCUMENT_CHAR_LIMIT) {
        const { chunks } = this.getDocumentChunks(context.documentText, 'synthesize')
        if (!this.confirmDocumentChunkSubmission(context.documentText, chunks.length)) {
          return
        }
      }

      const resolvedPrepared = prepared || this.prepareOutgoingMessages(text, context.options)
      if (!resolvedPrepared) return
      const { assistantMsg } = resolvedPrepared
      const summaryText = this.getGeneratedOutputProgressText(intent, context)
      const runContext = this.startActiveGeneratedOutputRun(assistantMsg, summaryText)
      const abortSignal = runContext.abortController?.signal || null
      assistantMsg.content = ''
      assistantMsg.isLoading = true
      this.startAssistantLoadingProgress(assistantMsg, {
        label: '正在准备文件生成任务...',
        detail: '内容已加入会话，正在识别输出类型并准备处理。',
        percent: 14
      })
      assistantMsg.activeGeneratedOutputRun.statusMessage = '正在准备文件生成任务...'
      this.appendPrimaryRouteDetail(assistantMsg.activeGeneratedOutputRun, assistantMsg)
      this.appendDocumentRevisionDetail(
        assistantMsg.activeGeneratedOutputRun,
        `已识别为${intent?.action || 'report'}任务，处理范围：${context.scope === 'document' ? '全文' : context.scope === 'selection' ? '当前内容' : '当前请求'}。`
      )
      if (intent?.action === 'report') {
        const pendingExtension = ['json', 'md', 'csv', 'txt', 'xlsx'].includes(String(intent?.outputFormat || '').toLowerCase())
          ? String(intent.outputFormat).toLowerCase()
          : 'md'
        const pendingBaseName = intent?.reportContext?.reportName || intent?.fileBaseName || '生成报告'
        assistantMsg.generatedFiles = [
          this.createPendingGeneratedFile({
            kind: 'report',
            extension: pendingExtension,
            baseName: pendingBaseName
          })
        ]
        this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, `已创建附件占位：${pendingBaseName}.${pendingExtension}`)
      }
      if (intent?.action === 'report' && intent?.reportContext) {
        const reportName = String(intent.reportContext.reportName || intent.fileBaseName || '').trim()
        const industry = String(intent.reportContext.industry || '').trim()
        const reportTypeLabel = String(intent.reportContext.reportTypeLabel || '').trim()
        const outlineText = String(intent.reportContext.outlineText || '').trim()
        const writingGuidance = String(intent.reportContext.writingGuidance || '').trim()
        const generationPrompt = String(intent.reportContext.generationPrompt || '').trim()
        assistantMsg.activeGeneratedOutputRun.previewText = [
          reportName ? `报告名称：${reportName}` : '',
          industry ? `所属行业：${industry}` : '',
          reportTypeLabel ? `报告类型：${reportTypeLabel}` : ''
        ].filter(Boolean).join('\n')
        if (reportName) {
          this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, `报告名称：${reportName}`)
        }
        if (industry) {
          this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, `所属行业：${industry}`)
        }
        if (reportTypeLabel) {
          this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, `报告类型：${reportTypeLabel}`)
        }
        if (outlineText) {
          this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, `报告大纲：\n${outlineText}`)
        }
        if (writingGuidance) {
          this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, `写作口径：${writingGuidance}`)
        }
        if (generationPrompt) {
          this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, `生成要求：${generationPrompt}`)
        }
      }
      assistantMsg.activeGeneratedOutputRun.retryPayload = {
        text: String(text || '').trim(),
        intent: JSON.parse(JSON.stringify(intent || {})),
        modelId: String(chatModel?.id || '').trim()
      }
      assistantMsg.activeGeneratedOutputRun.canRetry = false
      this.saveHistory()
      this.scrollToBottom()

      try {
        this.ensureGeneratedOutputRunActive(runContext, assistantMsg)
        if (intent?.action === 'report') {
          this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, '开始生成报告文件内容。')
          const content = await this.generateReportFileContent(
            text,
            chatModel,
            intent,
            context,
            assistantMsg,
            runContext,
            abortSignal
          )
          this.ensureGeneratedOutputRunActive(runContext, assistantMsg)
          const extension = ['json', 'md', 'csv', 'txt', 'xlsx'].includes(String(intent?.outputFormat || '').toLowerCase())
            ? String(intent.outputFormat).toLowerCase()
            : 'md'
          assistantMsg.generatedFiles = [
            this.createGeneratedTextFile(content, {
              kind: 'report',
              extension,
              baseName: intent?.reportContext?.reportName || intent?.fileBaseName || (
                extension === 'json'
                  ? '生成报告JSON'
                  : extension === 'xlsx'
                    ? '提炼结果表格'
                  : extension === 'csv'
                    ? '提炼结果表格'
                    : extension === 'txt'
                      ? '提炼结果'
                      : '生成报告'
              )
            })
          ]
          this.persistMessageArtifacts(assistantMsg, extension === 'xlsx' ? 'report-xlsx' : 'report-generation')
          const formatLabel = extension === 'json'
            ? 'JSON'
            : extension === 'xlsx'
              ? 'Excel'
            : extension === 'csv'
              ? 'CSV'
              : extension === 'txt'
                ? '文本'
                : 'Markdown'
          const reportName = String(intent?.reportContext?.reportName || intent?.fileBaseName || '生成报告').trim() || '生成报告'
          const industryLabel = String(intent?.reportContext?.industry || '').trim()
          assistantMsg.content = `已生成${formatLabel}文件《${reportName}》${industryLabel ? `，所属行业：${industryLabel}` : ''}，点击下方即可下载。`
          this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, `报告文件《${reportName}》已生成，输出格式：${formatLabel}。`)
        } else if (intent?.action === 'object-export') {
          assistantMsg.activeGeneratedOutputRun.statusMessage = '正在扫描文档中的附件对象...'
          this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, '开始扫描文档中的附件对象和嵌入对象。')
          const exported = exportDocumentEmbeddedObjects(context.scope === 'selection' ? 'selection' : 'document')
          this.ensureGeneratedOutputRunActive(runContext, assistantMsg)
          const files = exported.assets.map((asset, index) => this.createGeneratedMediaFile(asset, {
            kind: 'file',
            baseName: asset.baseName || `${intent?.fileBaseName || '文档附件对象'}_${index + 1}`
          }))
          const manifest = this.createGeneratedTextFile(JSON.stringify({
            totalObjects: exported.descriptors.length,
            exportedFiles: exported.assets.length,
            unresolvedObjects: exported.unresolved
          }, null, 2), {
            kind: 'report',
            extension: 'json',
            baseName: `${intent?.fileBaseName || '文档附件对象'}_清单`
          })
          const bundleFiles = [...files, manifest]
          if (bundleFiles.length > 1) {
            assistantMsg.activeGeneratedOutputRun.statusMessage = '正在打包导出结果...'
            this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, `已识别 ${exported.descriptors.length} 个对象，准备打包 ${bundleFiles.length} 个文件。`)
          }
          assistantMsg.generatedFiles = bundleFiles.length > 1
            ? [await this.createGeneratedZipFile(bundleFiles, {
                baseName: `${intent?.fileBaseName || '文档附件对象'}_导出结果`,
                signal: abortSignal
              })]
            : bundleFiles
          this.persistMessageArtifacts(assistantMsg, 'object-export')
          this.ensureGeneratedOutputRunActive(runContext, assistantMsg)
          if (exported.descriptors.length === 0) {
            assistantMsg.content = '当前范围内未发现可识别的附件对象或嵌入对象。已附上空清单文件。'
          } else if (exported.assets.length > 0) {
            assistantMsg.content = exported.unresolved.length > 0
              ? `已导出 ${exported.assets.length} 个对象附件，另有 ${exported.unresolved.length} 个对象暂无法直接导出，已打包导出结果并附清单。`
              : `已导出 ${exported.assets.length} 个对象附件，已自动打包为 ZIP，点击下方即可下载。`
          } else {
            assistantMsg.content = '已识别到文档中的附件对象，但当前环境无法直接导出原始文件，已附对象清单供查看。'
          }
          this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, `对象导出完成，可导出 ${exported.assets.length} 个，未能直接导出 ${exported.unresolved.length} 个。`)
        } else if (intent?.action === 'image-export') {
          assistantMsg.activeGeneratedOutputRun.statusMessage = '正在扫描文档中的图片...'
          this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, '开始扫描文档中的图片资源。')
          const exported = exportDocumentImagesAsAssets(context.scope === 'selection' ? 'selection' : 'document')
          this.ensureGeneratedOutputRunActive(runContext, assistantMsg)
          if (!Array.isArray(exported.assets) || exported.assets.length === 0) {
            throw new Error(exported.errors?.[0] || '未在当前范围内找到可导出的图片')
          }
          const files = exported.assets.map((asset, index) => this.createGeneratedMediaFile(asset, {
            kind: 'image',
            baseName: `${intent?.fileBaseName || '文档图片'}_${index + 1}`
          }))
          if (files.length > 1) {
            assistantMsg.activeGeneratedOutputRun.statusMessage = '正在打包图片导出结果...'
            this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, `已导出 ${exported.assets.length} 张图片，开始打包 ZIP。`)
          }
          assistantMsg.generatedFiles = files.length > 1
            ? [await this.createGeneratedZipFile(files, {
                baseName: `${intent?.fileBaseName || '文档图片'}_导出结果`,
                signal: abortSignal
              })]
            : files
          this.persistMessageArtifacts(assistantMsg, 'image-export')
          this.ensureGeneratedOutputRunActive(runContext, assistantMsg)
          assistantMsg.content = exported.errors?.length
            ? `已导出 ${exported.assets.length} 张图片附件，另有 ${exported.errors.length} 张处理失败。${files.length > 1 ? '结果已自动打包为 ZIP。' : '点击下方即可下载。'}`
            : files.length > 1
              ? `已导出 ${exported.assets.length} 张图片附件，已自动打包为 ZIP，点击下方即可下载。`
              : `已导出 ${exported.assets.length} 张图片附件，点击下方即可下载。`
          this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, `图片导出完成，共成功 ${exported.assets.length} 张，失败 ${Number(exported.errors?.length || 0)} 张。`)
        } else if (intent?.action === 'image') {
          assistantMsg.activeGeneratedOutputRun.statusMessage = '正在生成图片文件...'
          this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, '开始调用图片模型生成结果。')
          await this.runMultimodalTaskFromMessage(assistantMsg, intent, context)
          return
        } else if (intent?.action === 'video') {
          assistantMsg.activeGeneratedOutputRun.statusMessage = '正在生成视频文件...'
          this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, '开始调用视频模型生成结果。')
          await this.runMultimodalTaskFromMessage(assistantMsg, intent, context)
          return
        } else if (intent?.action === 'audio') {
          assistantMsg.activeGeneratedOutputRun.statusMessage = '正在生成语音文件...'
          this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, '开始调用语音模型生成结果。')
          await this.runMultimodalTaskFromMessage(assistantMsg, intent, context)
          return
        }
        this.stopAssistantLoadingProgress(assistantMsg)
        assistantMsg.isLoading = false
        if (assistantMsg?.activeGeneratedOutputRun) {
          const reportContext = intent?.reportContext || {}
          const reportName = String(reportContext.reportName || intent?.fileBaseName || '').trim()
          const industry = String(reportContext.industry || '').trim()
          const formatLabel = String(intent?.outputFormat || 'md').trim().toUpperCase()
          assistantMsg.activeGeneratedOutputRun.previewText = [
            reportName ? `报告名称：${reportName}` : '',
            industry ? `所属行业：${industry}` : '',
            `输出格式：${formatLabel}`,
            String(assistantMsg.content || '').trim()
          ].filter(Boolean).join('\n')
          assistantMsg.activeGeneratedOutputRun.metaLines = [
            `完成时间：${this.formatDateTime(new Date().toISOString())}`
          ]
          assistantMsg.activeGeneratedOutputRun.canUndo = Array.isArray(assistantMsg.generatedFiles) && assistantMsg.generatedFiles.length > 0
          assistantMsg.activeGeneratedOutputRun.canRetry = false
        }
        this.finishActiveGeneratedOutputRun(assistantMsg, {
          status: 'completed',
          statusMessage: assistantMsg.content || '文件生成已完成。'
        })
      } catch (error) {
        this.stopAssistantLoadingProgress(assistantMsg)
        assistantMsg.isLoading = false
        if (this.isGeneratedOutputCancelledError(error) || error?.name === 'AbortError' || /请求已终止/.test(String(error?.message || ''))) {
          this.releaseGeneratedFiles(assistantMsg.generatedFiles)
          assistantMsg.generatedFiles = []
          assistantMsg.content = '文件生成已停止。'
          this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, '文件生成任务已被停止。')
          this.finishActiveGeneratedOutputRun(assistantMsg, {
            status: 'cancelled',
            statusMessage: '已停止本次文件生成。'
          })
          if (assistantMsg?.activeGeneratedOutputRun) {
            assistantMsg.activeGeneratedOutputRun.canRetry = true
          }
        } else {
          const errorText = this.formatAssistantTaskError(error?.message || '文件生成失败')
          if (Array.isArray(assistantMsg.generatedFiles) && assistantMsg.generatedFiles.length > 0) {
            assistantMsg.generatedFiles = assistantMsg.generatedFiles.map(file => ({
              ...file,
              status: 'error',
              sizeLabel: '生成失败'
            }))
          }
          assistantMsg.content = '[错误] ' + errorText
          this.appendDocumentRevisionDetail(assistantMsg.activeGeneratedOutputRun, `文件生成失败：${errorText}`)
          this.finishActiveGeneratedOutputRun(assistantMsg, {
            status: 'error',
            statusMessage: errorText
          })
          if (assistantMsg?.activeGeneratedOutputRun) {
            assistantMsg.activeGeneratedOutputRun.canRetry = true
          }
        }
      }

      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
    },
    getCurrentDocumentPayload() {
      return readCurrentDocumentPayload({
        getSnapshot: () => this.getLiveSelectionContext() || this.resolveBestSelectionContext()
      })
    },
    inferPrimaryConversationIntentByRule(text = '') {
      const normalized = String(text || '').trim()
      if (!normalized) {
        return {
          kind: 'chat',
          confidence: 'low',
          reason: '未提供有效请求内容，默认按普通对话处理。'
        }
      }
      if (isPromptOnlyCreationRequest(normalized)) {
        return {
          kind: 'chat',
          confidence: 'high',
          reason: '用户是在从零创作内容，不需要读取当前文档正文。'
        }
      }
      if (EXPLICIT_ASSISTANT_REQUEST_PATTERN.test(normalized)) {
        return {
          kind: 'assistant-task',
          confidence: 'high',
          reason: '用户明确提到了助手或创建助手。'
        }
      }
      if (/保存文档|另存为|另存文档|加密文档|文档加密|插入表格|插入空白页|插入分页符|分页符|空白页/.test(normalized)) {
        return {
          kind: 'wps-capability',
          confidence: 'high',
          reason: '请求更像直接调用 WPS 能力。'
        }
      }
      if (
        this.shouldTryDocumentOperationRouting(normalized) ||
        this.shouldTryDocumentRelocationIntent(normalized) ||
        this.shouldTryDocumentTextEditIntent(normalized) ||
        this.shouldTryDocumentDeleteIntent(normalized) ||
        this.shouldTryDocumentFormatIntent(normalized) ||
        this.shouldTryDocumentRevisionIntent(normalized) ||
        !!detectDocumentCommentIntent(normalized) ||
        !!detectDocumentScopeIntent(normalized) ||
        !!detectSelectionTranslateIntent(normalized, getAssistantSetting('translate')?.targetLanguage || '英文')
      ) {
        return {
          kind: 'document-operation',
          confidence: 'high',
          reason: '请求包含明显的文档处理、批注、翻译或全文处理特征。'
        }
      }
      if (
        REPORT_FILE_REQUEST_PATTERN.test(normalized) ||
        IMAGE_REQUEST_PATTERN.test(normalized) ||
        VIDEO_REQUEST_PATTERN.test(normalized) ||
        AUDIO_REQUEST_PATTERN.test(normalized) ||
        DOCUMENT_IMAGE_EXPORT_REQUEST_PATTERN.test(normalized) ||
        DOCUMENT_OBJECT_EXPORT_REQUEST_PATTERN.test(normalized) ||
        maybeNeedsGeneratedOutputAnalysis(normalized, this.attachments.length)
      ) {
        return {
          kind: 'generated-output',
          confidence: 'medium',
          reason: '请求更像生成文件、报告或多媒体结果。'
        }
      }
      if (DIRECT_CHAT_REQUEST_PATTERN.test(normalized) && !DOCUMENT_KEYWORD_PATTERN.test(normalized)) {
        return {
          kind: 'chat',
          confidence: 'high',
          reason: '请求更像普通问答或创作型对话。'
        }
      }
      return {
        kind: 'chat',
        confidence: 'medium',
        reason: '未识别到明确的工具或助手需求，默认按普通对话处理。'
      }
    },
    async inferPrimaryConversationIntentWithModel(text, model) {
      const fallback = this.inferPrimaryConversationIntentByRule(text)
      try {
        const raw = await chatCompletion({
          providerId: model.providerId,
          modelId: model.modelId,
          temperature: 0.1,
          messages: [
            {
              role: 'system',
              content: [
                '你是会话入口路由器，只负责判断当前用户请求应该进入哪条处理链路。',
                '你必须只输出合法 JSON，不要输出解释或 Markdown。',
                '可选 kind 只有：chat、document-operation、wps-capability、generated-output、assistant-task。',
                '判断规则：',
                '1. 普通问答、闲聊、解释、写诗、写文案、写祝福、头脑风暴、普通改写建议，一律归为 chat。',
                '2. 只有明确要处理当前文档/选中内容/段落/批注/全文，或要写回文档时，才归为 document-operation；文档脱密、脱敏、涉密关键词、占位符替换、密码复原等也属于 document-operation。',
                '3. 保存、另存为、加密、插入表格、插入空白页、插入分页符等直接能力，归为 wps-capability。',
                '4. 报告、总结文件、导出文件、图片/视频/语音生成、下载附件，归为 generated-output。',
                '5. 只有明确提到某个助手、要求创建助手，或确实依赖可复用助手配置时，才归为 assistant-task。',
                '6. 如果不确定，默认选择 chat。',
                '7. 若用户明显要操作当前 WPS 文档（纠错别字、翻译选区、全文摘要、脱密、删改格式等）或调用保存/插入等原生能力，或生成报告/图片/音视频，绝不能仅因措辞像“帮我想想”就归为 chat；必须归入对应的 document-operation、wps-capability、generated-output 或 assistant-task。',
                'JSON 格式：{"kind":"","confidence":"high|medium|low","reason":""}'
              ].join('\n')
            },
            {
              role: 'user',
              content: [
                `用户请求：${String(text || '').trim()}`,
                `当前是否有附件：${this.attachments.length > 0 ? '是' : '否'}`,
                `当前是否存在选区上下文：${this.resolveBestSelectionContext()?.text ? '是' : '否'}`
              ].join('\n')
            }
          ]
        })
        return normalizePrimaryConversationIntent(parseAssistantIntentResult(raw), fallback)
      } catch (error) {
        console.warn('主会话意图识别失败:', error)
        return fallback
      }
    },
    async resolvePrimaryConversationIntent(text, model) {
      const ruleIntent = this.inferPrimaryConversationIntentByRule(text)
      const localShortcut = resolveLocalIntentShortcut(text, {
        ruleIntent,
        hasSelection: !!this.resolveBestSelectionContext()?.text,
        attachments: this.attachments
      })
      if (localShortcut.shortcut) {
        return localShortcut
      }
      const routeCacheOptions = {
        providerId: model?.providerId,
        modelId: model?.modelId,
        hasSelection: !!this.resolveBestSelectionContext()?.text,
        attachments: this.attachments
      }
      const cachedIntent = getCachedModelRouteIntent(text, routeCacheOptions)
      if (cachedIntent) return cachedIntent
      const modelIntent = await this.inferPrimaryConversationIntentWithModel(text, model)
      setCachedModelRouteIntent(text, modelIntent, routeCacheOptions)
      const ruleKind = String(ruleIntent?.kind || 'chat').trim()
      const modelKind = String(modelIntent?.kind || 'chat').trim()
      const ruleConf = String(ruleIntent?.confidence || '').trim().toLowerCase()
      // 高置信规则优先于模型的 chat：否则模型常输出 confidence=high 的 chat，堵死文档/WPS/助手等链路（与「先规则命中、再走子路由」的产品逻辑一致）。
      if (modelKind === 'chat' && ruleKind !== 'chat' && ruleConf === 'high') {
        return {
          ...ruleIntent,
          reason: [ruleIntent.reason, modelIntent?.reason ? `模型侧曾判为对话：${modelIntent.reason}` : ''].filter(Boolean).join(' ')
        }
      }
      // 报告/多模态等规则为 medium 时，同样不允许被模型高置信 chat 覆盖。
      if (
        modelKind === 'chat' &&
        ruleKind === 'generated-output' &&
        (ruleConf === 'high' || ruleConf === 'medium')
      ) {
        return {
          ...ruleIntent,
          reason: [ruleIntent.reason, modelIntent?.reason ? `模型侧曾判为对话：${modelIntent.reason}` : ''].filter(Boolean).join(' ')
        }
      }
      if (modelIntent.kind === 'chat' && modelIntent.confidence !== 'high' && ruleIntent.kind !== 'chat') {
        return {
          ...ruleIntent,
          reason: modelIntent.reason || ruleIntent.reason
        }
      }
      if (modelIntent.kind !== 'chat') {
        return modelIntent
      }
      return modelIntent.kind ? modelIntent : ruleIntent
    },
    shouldTryDocumentRevisionIntent(text) {
      return !!detectDocumentRevisionIntent(text)
    },
    shouldTryDocumentOperationRouting(text) {
      return DOCUMENT_OPERATION_ROUTER_TRIGGER_PATTERN.test(String(text || '').trim())
    },
    shouldTryDocumentDeclassifyRestoreIntent(text) {
      return /(密码复原|复原原文|恢复原文|撤销脱密|还原脱密|脱密.{0,8}复原|复原.{0,8}脱密)/.test(String(text || '').trim())
    },
    shouldTryDocumentDeclassifyIntent(text) {
      const t = String(text || '').trim()
      if (!t || this.shouldTryDocumentDeclassifyRestoreIntent(t)) return false
      return /(脱密|文档脱密|占位符脱密|占位脱密|去标识化|脱敏处理|敏感词替换|涉密.{0,8}替换)/.test(t)
    },
    shouldTrySecretKeywordExtractOnlyIntent(text) {
      const t = String(text || '').trim()
      if (!t || this.shouldTryDocumentDeclassifyRestoreIntent(t) || this.shouldTryDocumentDeclassifyIntent(t)) {
        return false
      }
      return /(仅|只).{0,16}(提取|抽取).{0,12}(涉密|敏感).{0,8}(关键词|词)/.test(t) ||
        /(提取|抽取).{0,10}(涉密|敏感).{0,8}(关键词|词)/.test(t)
    },
    shouldOpenDocumentDeclassifyDialogForText(text = '') {
      const t = String(text || '').trim()
      if (!t) return false
      if (/(仅|只).{0,12}(提取|抽取).{0,12}(涉密|敏感).{0,8}(关键词|词)/.test(t)) return false
      return /(文档脱密|占位符|占位脱密|去标识化|脱敏(?!检查)|脱密处理|帮我脱密|脱密助手)/.test(t) ||
        /^.{0,20}脱密/.test(t)
    },
    /**
     * 明确「用/调用××助手」时：单候选直接启动任务；多候选展示执行选择卡片，避免落入普通流式对话导致「助手链路调用失效」。
     */
    async tryExplicitAssistantExecutionAfterRecommendation(assistantMsg, text, demand, assistantOptions = []) {
      if (!assistantMsg || !Array.isArray(assistantOptions) || assistantOptions.length === 0) return false
      if (!EXPLICIT_ASSISTANT_REQUEST_PATTERN.test(String(text || '').trim())) return false
      if (this.isExplicitAssistantCreationRequest(text)) return false

      const top = assistantOptions[0]
      const topId = String(top?.assistantId || '').trim()
      if (!topId) return false

      if (assistantOptions.length > 1) {
        this.stopAssistantLoadingProgress(assistantMsg)
        assistantMsg.isLoading = false
        assistantMsg.content = '已匹配到多个可用助手，请先选择要执行的一项。'
        assistantMsg.pendingAssistantExecutionChoice = this.createPendingAssistantExecutionChoice(
          demand,
          assistantOptions,
          {
            summaryText: '已识别为明确的助手执行需求，请选择一个助手后继续。',
            statusMessage: '请选择一个助手后点击「执行所选助手」。',
            autoContinueLabel: '默认执行列表中的第一项'
          }
        )
        this.scheduleAssistantExecutionChoiceAutoContinue(assistantMsg)
        this.saveHistory()
        this.$nextTick(() => this.scrollToBottom())
        return true
      }

      try {
        if (topId === 'analysis.secret-keyword-extract' && this.shouldOpenDocumentDeclassifyDialogForText(text)) {
          this.stopAssistantLoadingProgress(assistantMsg)
          assistantMsg.isLoading = false
          assistantMsg.content = '已为你打开「文档脱密」对话框，可在其中完成涉密关键词提取与占位符替换。'
          this.openDialogRoute('/document-declassify-dialog', {}, '文档脱密', 860, 720)
          this.saveHistory()
          this.$nextTick(() => this.scrollToBottom())
          return true
        }
        await this.runAssistantTaskFromMessage(assistantMsg, topId, {
          requirementText: String(text || '').trim()
        })
        return true
      } catch (error) {
        this.stopAssistantLoadingProgress(assistantMsg)
        assistantMsg.isLoading = false
        assistantMsg.content = '[错误] ' + (error?.message || '启动助手失败')
        this.saveHistory()
        this.$nextTick(() => this.scrollToBottom())
        return true
      }
    },
    getDocumentOperationChoiceOptionMeta(actionKey) {
      const normalized = String(actionKey || '').trim().toLowerCase()
      const map = {
        'document-revision:proofread': { label: '纠错修正', apiLabel: '文档修订', supported: true },
        'document-revision:clarify': { label: '消除歧义', apiLabel: '文档修订', supported: true },
        'document-revision:correct-description': { label: '纠正描述', apiLabel: '文档修订', supported: true },
        'document-revision:formalize': { label: '改得更正式', apiLabel: '文档修订', supported: true },
        'document-revision:polish': { label: '润色优化', apiLabel: '文档修订', supported: true },
        'document-revision:term-unify': { label: '统一术语', apiLabel: '文档修订', supported: true },
        'document-revision': { label: '文档修订', apiLabel: '文档修订', supported: true },
        'document-delete': { label: '删除内容', apiLabel: '删除', supported: true },
        'document-text-edit': { label: '替换或删除关键词', apiLabel: '文本编辑', supported: true },
        'document-relocation': { label: '移动或复制段落', apiLabel: '段落移动', supported: true },
        'document-format': { label: '修改格式', apiLabel: '格式操作', supported: true },
        'document-comment': { label: '添加批注', apiLabel: '批注', supported: true },
        'document-aware': { label: '整篇处理', apiLabel: '全文处理', supported: true },
        'selection-translate': { label: '翻译内容', apiLabel: '翻译', supported: true },
        'document-declassify': { label: '文档脱密（对话框）', apiLabel: '文档脱密', supported: true },
        'document-declassify-restore': { label: '密码复原', apiLabel: '脱密复原', supported: true },
        'secret-keyword-extract': { label: '涉密关键词提取', apiLabel: '涉密关键词', supported: true },
        unsupported: { label: '当前能力暂不支持', apiLabel: '待扩展', supported: false }
      }
      return map[normalized] || { label: normalized || '待确认操作', apiLabel: '待确认', supported: false }
    },
    isDocumentRevisionChoiceAction(actionKey) {
      return String(actionKey || '').startsWith('document-revision')
    },
    buildRevisionIntentFromChoiceActions(actionKeys = [], fallbackScope = 'selection-preferred') {
      const keys = Array.from(new Set((Array.isArray(actionKeys) ? actionKeys : [actionKeys]).map(item => String(item || '').trim()).filter(Boolean)))
      const revisionTypeMap = {
        'document-revision:proofread': 'proofread',
        'document-revision:clarify': 'clarify',
        'document-revision:correct-description': 'correct-description',
        'document-revision:formalize': 'formalize',
        'document-revision:polish': 'polish',
        'document-revision:term-unify': 'term-unify'
      }
      const revisionTypes = keys
        .map(key => revisionTypeMap[key])
        .filter(Boolean)
      const primaryRevisionType = revisionTypes[0] || 'proofread'
      const assistantIdMap = {
        proofread: 'analysis.correct-spell',
        clarify: 'analysis.rewrite',
        'correct-description': 'analysis.rewrite',
        formalize: 'analysis.formalize',
        polish: 'analysis.polish',
        'term-unify': 'analysis.term-unify'
      }
      return {
        scope: fallbackScope,
        revisionType: primaryRevisionType,
        revisionTypes,
        assistantId: assistantIdMap[primaryRevisionType] || 'analysis.correct-spell',
        constraints: {},
        keywordTarget: null
      }
    },
    async inferDocumentOperationRouteWithModel(text, model) {
      if (!model?.providerId || !model?.modelId) return null
      const snapshot = this.resolveBestSelectionContext()
      const systemPrompt = [
        '你是一个 WPS 文档操作路由器，负责先判断用户想执行哪一种文档操作。',
        '只输出合法 JSON，不要输出解释、代码块或多余文本。',
        'primaryAction 只能是以下之一：document-revision:proofread、document-revision:clarify、document-revision:correct-description、document-revision:formalize、document-revision:polish、document-revision:term-unify、document-delete、document-text-edit、document-relocation、document-format、document-comment、document-aware、selection-translate、document-declassify、document-declassify-restore、secret-keyword-extract、unsupported、chat。',
        '若用户要对全文做占位符脱密、打开脱密流程、替换敏感实体为占位符，primaryAction 选 document-declassify；若已脱密需输入密码恢复原文，选 document-declassify-restore；若仅提取涉密关键词并以批注标注、不强调完整脱密对话框，选 secret-keyword-extract。',
        '当用户明显是在让你修正文档问题但无法准确区分是纠错、纠正描述还是消除歧义时，primaryAction 选最可能的一项，candidateActions 同时列出 2-4 个可能项，confidence=medium 或 low。',
        '像“帮我修正文章错误”“帮我修改一下问题”这类模糊请求，通常属于 document-revision，并优先给出 proofread、clarify、correct-description 等候选项。',
        '若用户要基于选区或全文做扩写、续写、展开、写详细、丰富内容、补充细节、扩展章节、生成更详细说明等，一律视为可用大模型完成的文档需求：请输出 primaryAction=document-aware 或 document-revision:polish（偏润色扩写时），supported=true，不要标为 unsupported。',
        '若用户仅是一般问答、解释概念、与文档无直接关系，可输出 primaryAction=chat、isDocumentOperation=false。',
        'scope 只能是 selection、paragraph、document、selection-preferred。',
        '仅当需求明确依赖当前产品尚未提供的专用接口（例如非常规文件格式导出、与文档无关的系统级操作）时，才使用 primaryAction=unsupported、supported=false；不要因“需要 AI 生成或扩展正文”而标为 unsupported。',
        '如果这不是文档操作，输出 {"isDocumentOperation":false,"supported":true,"confidence":"low","primaryAction":"chat","scope":"selection-preferred","candidateActions":[],"reason":"","unsupportedNeed":""}。',
        'JSON 格式：{"isDocumentOperation":true,"supported":true,"confidence":"high|medium|low","primaryAction":"","scope":"selection|paragraph|document|selection-preferred","candidateActions":[],"reason":"","unsupportedNeed":""}'
      ].join('\n')
      const userPrompt = [
        `用户输入：${String(text || '').trim()}`,
        `当前是否存在选区上下文：${snapshot?.text ? '是' : '否'}`,
        `当前是否明显提到文档/全文/段落：${/(文档|全文|文章|段落|本段|这段|选中|选区)/.test(String(text || '')) ? '是' : '否'}`
      ].join('\n')
      try {
        const raw = await chatCompletion({
          providerId: model.providerId,
          modelId: model.modelId,
          temperature: 0,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
        return normalizeDocumentOperationRouterResult(parseAssistantIntentResult(raw))
      } catch (error) {
        console.warn('文档操作路由识别失败:', error)
        return null
      }
    },
    isAssistantDrivenDocumentAction(actionKey) {
      const normalized = String(actionKey || '').trim().toLowerCase()
      return normalized === 'document-comment' ||
        normalized === 'document-aware' ||
        normalized === 'selection-translate' ||
        normalized === 'document-declassify' ||
        normalized === 'document-declassify-restore' ||
        normalized === 'secret-keyword-extract' ||
        this.isDocumentRevisionChoiceAction(normalized)
    },
    clearAssistantFirstPendingStates(message) {
      if (!message || typeof message !== 'object') return
      this.clearAssistantParameterAutoContinue(message.id)
      message.pendingLocalFaqAction = null
      message.pendingAssistantIntentChoice = null
      message.pendingAssistantRepairChoice = null
      message.pendingAssistantExecutionChoice = null
      message.pendingAssistantCreationDraft = null
      message.pendingAssistantParameterCollection = null
    },
    getAssistantInputSourceLabel(value) {
      return INPUT_SOURCE_OPTIONS.find(item => item.value === value)?.label || value || '未设置'
    },
    getAssistantDocumentActionLabel(value) {
      const normalized = String(value || '').trim()
      if (normalized === 'replace') return '替换原文（仅替换错误文字或正文片段）'
      if (normalized === 'insert') return '插入到当前位置'
      if (normalized === 'insert-after') return '插入到每段后面'
      if (normalized === 'prepend') return '插入到文档最前面'
      if (normalized === 'append') return '插入到文档最后面'
      return DOCUMENT_ACTION_OPTIONS.find(item => item.value === normalized)?.label || normalized || '未设置'
    },
    getAssistantDocumentActionSummaryLabel(value) {
      const normalized = String(value || '').trim()
      if (normalized === 'replace') return '已安全替换原文中的错误文字或正文片段'
      if (normalized === 'insert') return '已插入到当前位置'
      if (normalized === 'insert-after') return '已将结果逐段插入到每段后面'
      if (normalized === 'prepend') return '已插入到文档最前面'
      if (normalized === 'append') return '已追加到文末'
      if (normalized === 'comment') return '已在原文位置写入批注'
      if (normalized === 'link-comment') return '已在原文位置写入链接批注'
      if (normalized === 'comment-replace') return '已批注并同步修正原文'
      if (normalized === 'none') return '未对文档做修改'
      return this.getAssistantDocumentActionLabel(normalized)
    },
    resolveDocumentActionPreferenceFromText(text = '') {
      const normalized = String(text || '').trim()
      if (!normalized) return ''
      if (/(拼写|错别字|语法|病句|标点).*(检查|审校|校对)|(?:检查|审校|校对).*(拼写|错别字|语法|病句|标点)/.test(normalized)) return 'comment'
      if (/(不写回|不修改文档|不要改文档|仅生成结果|只返回结果|只给结果)/.test(normalized)) return 'none'
      if (/(批注|注释|评注)/.test(normalized)) return 'comment'
      if (/(每段后|每一段后|逐段插入|段后插入|原文后面附上译文|双语对照|段后追加译文|段后|段落后面|本段后面)/.test(normalized)) return 'insert-after'
      if (/(段前|段落前|本段前|前面插入|插入到段前)/.test(normalized)) return 'prepend'
      if (/(文档最前面|文首|最前面|开头插入)/.test(normalized)) return 'prepend'
      if (/(文档最后面|文末|最后面|末尾插入|追加到最后)/.test(normalized)) return 'append'
      if (/(当前位置|光标处|当前光标|插入到这|插入这里)/.test(normalized)) return 'insert'
      if (/(替换.{0,8}(原文|原有|原来的|选中的|选中)|代替原文|换掉原文|覆盖.{0,6}(选中|选区|这段)|改写后.{0,6}替换)/.test(normalized)) return 'replace'
      if (/(替换原文|直接替换|修正原文|直接修改原文|覆盖原文)/.test(normalized)) return 'replace'
      return ''
    },
    getAssistantDemandActionProfile(demand, assistantId = '') {
      const requirementText = String(demand?.requirementText || '').trim()
      const explicitPreference = this.resolveDocumentActionPreferenceFromText(requirementText)
      const normalizedAssistantId = String(assistantId || '').trim()
      const correctionLike = demand?.kind === 'revision' || /(错别字|拼写|语法|病句|标点|纠错|修正|术语)/.test(requirementText)
      const translateLike = demand?.kind === 'translate' || normalizedAssistantId === 'translate'
      const summaryLike = normalizedAssistantId === 'summary' || /(摘要|总结|概括|提炼|要点|标题|关键词|行动项|风险|纪要)/.test(requirementText)
      const commentLike = demand?.kind === 'comment' || /(批注|解释|说明|审计|检查|复核|保密)/.test(requirementText)
      const rewriteLike = /(润色|改写|重写|正式|通顺|优化|翻译|统一术语)/.test(requirementText) ||
        ['analysis.rewrite', 'analysis.polish', 'analysis.formalize', 'analysis.simplify', 'analysis.term-unify', 'analysis.policy-style'].includes(normalizedAssistantId)
      if (translateLike) {
        return {
          explicitPreference,
          allowedActions: ['replace', 'insert-after', 'insert', 'prepend', 'append', 'comment', 'none'],
          defaultAction: explicitPreference || 'replace'
        }
      }
      if (correctionLike) {
        const defaultCorrectionAction = normalizedAssistantId === 'analysis.correct-spell' ? 'comment' : 'replace'
        return {
          explicitPreference,
          allowedActions: ['replace', 'comment', 'comment-replace', 'none'],
          defaultAction: explicitPreference || defaultCorrectionAction
        }
      }
      if (commentLike) {
        return {
          explicitPreference,
          allowedActions: ['comment', 'link-comment', 'none'],
          defaultAction: explicitPreference || 'comment'
        }
      }
      if (summaryLike) {
        return {
          explicitPreference,
          allowedActions: ['insert', 'prepend', 'append', 'comment', 'none'],
          defaultAction: explicitPreference || 'insert'
        }
      }
      if (rewriteLike) {
        return {
          explicitPreference,
          allowedActions: ['replace', 'insert-after', 'insert', 'comment', 'none'],
          defaultAction: explicitPreference || 'replace'
        }
      }
      return {
        explicitPreference,
        allowedActions: ['replace', 'insert', 'insert-after', 'prepend', 'append', 'comment', 'link-comment', 'comment-replace', 'none'],
        defaultAction: explicitPreference || String(demand?.documentAction || '').trim() || 'insert'
      }
    },
    getDemandAwareDocumentActionOptions(baseOptions = [], demand, assistantId = '') {
      const profile = this.getAssistantDemandActionProfile(demand, assistantId)
      const allowed = new Set((profile.allowedActions || []).map(item => String(item || '').trim()))
      const filtered = (Array.isArray(baseOptions) ? baseOptions : []).filter((item) => {
        const value = String(item?.value || '').trim()
        return allowed.has(value)
      })
      return filtered.length > 0 ? filtered : (Array.isArray(baseOptions) ? baseOptions : [])
    },
    getDemandAwareDefaultDocumentAction(demand, assistantId = '', fallback = 'insert') {
      const profile = this.getAssistantDemandActionProfile(demand, assistantId)
      const baseOptions = this.getDemandAwareDocumentActionOptions(
        assistantId ? getDocumentActionOptions(assistantId) : DOCUMENT_ACTION_OPTIONS,
        demand,
        assistantId
      )
      const optionValues = new Set(baseOptions.map(item => String(item?.value || '').trim()))
      const candidates = [
        String(profile.defaultAction || '').trim(),
        String(demand?.documentAction || '').trim(),
        String(this.getAssistantRecommendationConfigByKey(assistantId)?.documentAction || '').trim(),
        String(fallback || '').trim()
      ].filter(Boolean)
      return candidates.find(value => optionValues.has(value)) || baseOptions[0]?.value || fallback
    },
    getAssistantTaskCompletionLead(task) {
      const assistantId = String(task?.data?.assistantId || '').trim()
      const title = String(task?.title || '当前助手').trim() || '当前助手'
      if (assistantId === 'spell-check' || assistantId === 'analysis.correct-spell') {
        return `已完成“${title}”`
      }
      if (assistantId === 'translate') {
        const targetLanguage = String(task?.data?.targetLanguage || '').trim()
        return targetLanguage ? `已完成“${title}”，目标语言为${targetLanguage}` : `已完成“${title}”`
      }
      if (/formalize|polish|rewrite|term-unify|simplify/.test(assistantId)) {
        return `已完成“${title}”`
      }
      return `已完成“${title}”`
    },
    sanitizeAssistantTextForUserDialog(text) {
      const t = String(text || '').trim()
      if (!t) return ''
      if (textLooksLikePlanStatsJson(t)) return ''
      if (/^\s*\{/.test(t) && /"schemaVersion"\s*:\s*"/.test(t) && /"operations"\s*:\s*\[/.test(t)) return ''
      return prepareDialogDisplayText(t)
    },
    resolveAssistantTaskMessageBody(task) {
      const finalAction = String(task?.data?.applyResult?.action || task?.data?.documentAction || '').trim()
      const rawOut = String(task?.data?.fullOutput || task?.data?.outputPreview || '').trim()
      const guardReason = String(task?.data?.launchGuardReason || '').trim()
      const safeOut = this.sanitizeAssistantTextForUserDialog(rawOut)
      const fallback = () =>
        this.buildAssistantTaskCompletionSummary(task) ||
        this.sanitizeAssistantTextForUserDialog(String(task?.data?.commentPreview || '').trim()) ||
        String(task?.data?.applyResult?.message || '').trim() ||
        `助手“${String(task?.title || '当前任务').trim()}”已完成。`
      let body = ''
      if (finalAction === 'none') {
        if (safeOut) {
          body = guardReason
            ? `已启用写回保护：${guardReason}。本次仅生成结果，不写回文档。\n\n${safeOut}`
            : safeOut
        } else if (rawOut && !safeOut) {
          body = guardReason
            ? `已启用写回保护：${guardReason}。本次仅生成结果，不写回文档。\n\n${fallback()}`
            : fallback()
        } else {
          body = fallback()
        }
      } else {
        body = fallback()
      }
      return prepareDialogDisplayText(body)
    },
    buildAssistantTaskCompletionSummary(task) {
      if (!task) return ''
      const applyAction = String(task?.data?.applyResult?.action || task?.data?.documentAction || '').trim()
      const lead = this.getAssistantTaskCompletionLead(task)
      const actionSummary = this.getAssistantDocumentActionSummaryLabel(applyAction)
      const resultSummary = task?.data?.resultSummary || {}
      const downgradedFrom = String(resultSummary.downgradedFrom || '').trim()
      const downgradeReason = String(resultSummary.downgradeReason || '').trim()
      const issueCount = Number(resultSummary.issueCount || 0)
      const keywordCount = Number(resultSummary.keywordCount || 0)
      const bookmarkAuditCount = Number(resultSummary.bookmarkAuditCount || 0)
      const changedParagraphCount = Number(resultSummary.changedParagraphCount || 0)
      const paragraphCount = Number(resultSummary.paragraphCount || 0)
      const outputParagraphCount = Number(resultSummary.outputParagraphCount || 0)
      const commentCount = Number(resultSummary.commentCount || 0)
      const replacedCount = Number(resultSummary.replacedCount || 0)
      const insertedParagraphCount = Number(resultSummary.insertedParagraphCount || 0)
      const structuredBatchCount = Number(resultSummary.structuredBatchCount || 0)
      const structuredOperationCount = Number(resultSummary.structuredOperationCount || 0)
      const structuredResolvedOperationCount = Number(resultSummary.structuredResolvedOperationCount || 0)
      const structuredUnresolvedOperationCount = Number(resultSummary.structuredUnresolvedOperationCount || 0)
      const structuredInvalidBatchCount = Number(resultSummary.structuredInvalidBatchCount || 0)
      if (downgradedFrom && downgradeReason) {
        return `${lead}，${downgradeReason}。`
      }
      if (structuredOperationCount > 0 && replacedCount > 0) {
        return `${lead}，共分析 ${structuredBatchCount || 1} 批，识别 ${structuredOperationCount} 条结构化操作，已执行 ${replacedCount} 处写回。`
      }
      if (structuredOperationCount > 0 && commentCount > 0) {
        return `${lead}，共分析 ${structuredBatchCount || 1} 批，识别 ${structuredOperationCount} 条结构化操作，并写入 ${commentCount} 条批注。`
      }
      if (insertedParagraphCount > 0) {
        return `${lead}，共将 ${insertedParagraphCount} 段结果插入到对应段后。`
      }
      if (replacedCount > 0 && issueCount > 0) {
        return `${lead}，共识别 ${issueCount} 处问题，已安全替换其中 ${replacedCount} 处。`
      }
      if (replacedCount > 0) {
        return `${lead}，共安全替换 ${replacedCount} 处对应内容，${actionSummary}。`
      }
      if (issueCount > 0) {
        return `${lead}，共识别 ${issueCount} 处问题，${actionSummary}。`
      }
      if (keywordCount > 0) {
        return `${lead}，共提取 ${keywordCount} 个关键词，${actionSummary}。`
      }
      if (bookmarkAuditCount > 0) {
        return `${lead}，共审计 ${bookmarkAuditCount} 个字段或书签，${actionSummary}。`
      }
      if (changedParagraphCount > 0) {
        return `${lead}，共调整 ${changedParagraphCount} 段内容，${actionSummary}。`
      }
      if (resultSummary.isTranslation && Math.max(paragraphCount, outputParagraphCount) > 0) {
        return `${lead}，共处理 ${Math.max(paragraphCount, outputParagraphCount)} 段内容，${actionSummary}。`
      }
      if (resultSummary.isRevisionLike && Math.max(paragraphCount, outputParagraphCount) > 0) {
        return `${lead}，已处理 ${Math.max(paragraphCount, outputParagraphCount)} 段内容，${actionSummary}。`
      }
      if (commentCount > 0) {
        return `${lead}，已写入 ${commentCount} 条批注。`
      }
      if (lead && actionSummary) return `${lead}，${actionSummary}。`
      if (lead) return `${lead}。`
      return task?.data?.applyResult?.message || '助手任务已完成。'
    },
    getAssistantTaskCardMetaLines(task) {
      if (!task) return []
      const resultSummary = task?.data?.resultSummary || {}
      const lines = [
        task.startedAt ? `开始时间：${this.formatDateTime(task.startedAt)}` : '',
        task.endedAt ? `结束时间：${this.formatDateTime(task.endedAt)}` : ''
      ]
      const structuredBatchCount = Number(resultSummary.structuredBatchCount || 0)
      const structuredHighQualityBatchCount = Number(resultSummary.structuredHighQualityBatchCount || 0)
      const structuredMediumQualityBatchCount = Number(resultSummary.structuredMediumQualityBatchCount || 0)
      const structuredReviewQualityBatchCount = Number(resultSummary.structuredReviewQualityBatchCount || 0)
      const structuredHighRiskBatchCount = Number(resultSummary.structuredHighRiskBatchCount || 0)
      const structuredMediumRiskBatchCount = Number(resultSummary.structuredMediumRiskBatchCount || 0)
      const structuredDeduplicatedOperationCount = Number(resultSummary.structuredDeduplicatedOperationCount || 0)
      const structuredArbitrationRejectedOperationCount = Number(resultSummary.structuredArbitrationRejectedOperationCount || 0)
      const structuredArbitrationConflictRejectedCount = Number(resultSummary.structuredArbitrationConflictRejectedCount || 0)
      const replacedCount = Number(resultSummary.replacedCount || 0)
      const commentCount = Number(resultSummary.commentCount || 0)
      const downgradeReason = String(resultSummary.downgradeReason || '').trim()
      if (structuredBatchCount > 0) {
        lines.push(`结构化批次：${structuredBatchCount} 批`)
      }
      if (
        structuredHighQualityBatchCount > 0 ||
        structuredMediumQualityBatchCount > 0 ||
        structuredReviewQualityBatchCount > 0
      ) {
        lines.push(`批次质量：高 ${structuredHighQualityBatchCount} / 中 ${structuredMediumQualityBatchCount} / 复核 ${structuredReviewQualityBatchCount}`)
      }
      if (structuredHighRiskBatchCount > 0 || structuredMediumRiskBatchCount > 0) {
        lines.push(`文本风险：高 ${structuredHighRiskBatchCount} / 中 ${structuredMediumRiskBatchCount}`)
      }
      if (structuredDeduplicatedOperationCount > 0) {
        lines.push(`跨批去重：${structuredDeduplicatedOperationCount} 条`)
      }
      if (structuredArbitrationRejectedOperationCount > 0 || structuredArbitrationConflictRejectedCount > 0) {
        lines.push(`冲突淘汰：${structuredArbitrationConflictRejectedCount || structuredArbitrationRejectedOperationCount} 条`)
      }
      if (replacedCount > 0) {
        lines.push(`安全写回：${replacedCount} 处`)
      }
      if (commentCount > 0) {
        lines.push(`批注提示：${commentCount} 条`)
      }
      if (task?.data?.pendingApply === true) {
        lines.push('当前阶段：预览已生成，等待确认写回')
        lines.push(`计划动作：${this.formatDocumentAction(String(task?.data?.documentAction || '').trim()) || '文档写回'}`)
        if (task?.data?.backupPolicy?.supported === true) {
          lines.push(task.data?.documentBackupRequested === true ? '源文件备份：已开启' : '源文件备份：未开启')
        } else if (task?.data?.backupPolicy?.unavailableReason) {
          lines.push(`源文件备份：不可用（${task.data.backupPolicy.unavailableReason}）`)
        }
      }
      const artifactCount = Array.isArray(task?.data?.generatedArtifacts) ? task.data.generatedArtifacts.length : 0
      if (artifactCount > 0) {
        lines.push(`生成附件：${artifactCount} 个`)
      }
      const writeTargetCount = Array.isArray(task?.data?.writeTargets) ? task.data.writeTargets.length : 0
      if (writeTargetCount > 0) {
        lines.push(`定位结果：${writeTargetCount} 项`)
      }
      if (task?.data?.backupRef?.backupPath) {
        lines.push(`备份文件：${task.data.backupRef.backupPath}`)
      }
      if (downgradeReason) {
        lines.push(`自动降级：${downgradeReason}`)
      }
      return lines.filter(Boolean).map((line) => prepareDialogDisplayText(line))
    },
    getAssistantTaskResultDetailLines(task) {
      if (!task) return []
      const resultSummary = task?.data?.resultSummary || {}
      const lines = []
      const actionSummary = this.getAssistantDocumentActionSummaryLabel(
        String(task?.data?.applyResult?.action || task?.data?.documentAction || '').trim()
      )
      if (actionSummary) {
        lines.push(`写回方式：${actionSummary}`)
      }
      const issueCount = Number(resultSummary.issueCount || 0)
      const keywordCount = Number(resultSummary.keywordCount || 0)
      const bookmarkAuditCount = Number(resultSummary.bookmarkAuditCount || 0)
      const changedParagraphCount = Number(resultSummary.changedParagraphCount || 0)
      const paragraphCount = Number(resultSummary.paragraphCount || 0)
      const outputParagraphCount = Number(resultSummary.outputParagraphCount || 0)
      const commentCount = Number(resultSummary.commentCount || 0)
      const replacedCount = Number(resultSummary.replacedCount || 0)
      const skippedCount = Number(resultSummary.skippedCount || 0)
      const protectedParagraphCount = Number(resultSummary.protectedParagraphCount || 0)
      const insertedParagraphCount = Number(resultSummary.insertedParagraphCount || 0)
      const structuredBatchCount = Number(resultSummary.structuredBatchCount || 0)
      const structuredOperationCount = Number(resultSummary.structuredOperationCount || 0)
      const structuredResolvedOperationCount = Number(resultSummary.structuredResolvedOperationCount || 0)
      const structuredUnresolvedOperationCount = Number(resultSummary.structuredUnresolvedOperationCount || 0)
      const structuredInvalidBatchCount = Number(resultSummary.structuredInvalidBatchCount || 0)
      const structuredDeduplicatedOperationCount = Number(resultSummary.structuredDeduplicatedOperationCount || 0)
      const structuredHighQualityBatchCount = Number(resultSummary.structuredHighQualityBatchCount || 0)
      const structuredMediumQualityBatchCount = Number(resultSummary.structuredMediumQualityBatchCount || 0)
      const structuredReviewQualityBatchCount = Number(resultSummary.structuredReviewQualityBatchCount || 0)
      const structuredHighRiskBatchCount = Number(resultSummary.structuredHighRiskBatchCount || 0)
      const structuredMediumRiskBatchCount = Number(resultSummary.structuredMediumRiskBatchCount || 0)
      const structuredArbitrationRejectedOperationCount = Number(resultSummary.structuredArbitrationRejectedOperationCount || 0)
      const structuredArbitrationConflictRejectedCount = Number(resultSummary.structuredArbitrationConflictRejectedCount || 0)
      const protectionApplied = resultSummary.protectionApplied === true
      const protectionMode = String(resultSummary.protectionMode || '').trim()
      const downgradeReason = String(resultSummary.downgradeReason || '').trim()
      if (structuredBatchCount > 0) lines.push(`结构化批次：${structuredBatchCount} 批`)
      if (structuredHighQualityBatchCount > 0 || structuredMediumQualityBatchCount > 0 || structuredReviewQualityBatchCount > 0) {
        lines.push(`批次质量：高 ${structuredHighQualityBatchCount} / 中 ${structuredMediumQualityBatchCount} / 复核 ${structuredReviewQualityBatchCount}`)
      }
      if (structuredHighRiskBatchCount > 0 || structuredMediumRiskBatchCount > 0) {
        lines.push(`文本风险：高 ${structuredHighRiskBatchCount} / 中 ${structuredMediumRiskBatchCount}`)
      }
      if (structuredOperationCount > 0) lines.push(`结构化操作：${structuredOperationCount} 条`)
      if (structuredDeduplicatedOperationCount > 0) lines.push(`跨批去重：${structuredDeduplicatedOperationCount} 条`)
      if (structuredResolvedOperationCount > 0) lines.push(`定位成功：${structuredResolvedOperationCount} 条`)
      if (structuredUnresolvedOperationCount > 0) lines.push(`待人工复核：${structuredUnresolvedOperationCount} 条`)
      if (structuredInvalidBatchCount > 0) lines.push(`JSON 解析失败批次：${structuredInvalidBatchCount} 批`)
      if (structuredArbitrationRejectedOperationCount > 0) lines.push(`仲裁淘汰：${structuredArbitrationRejectedOperationCount} 条`)
      if (structuredArbitrationConflictRejectedCount > 0) lines.push(`冲突淘汰：${structuredArbitrationConflictRejectedCount} 条`)
      if (issueCount > 0) lines.push(`识别问题：${issueCount} 处`)
      if (replacedCount > 0) lines.push(`安全替换：${replacedCount} 处`)
      if (insertedParagraphCount > 0) lines.push(`逐段插入：${insertedParagraphCount} 段`)
      if (skippedCount > 0) lines.push(`跳过替换：${skippedCount} 处`)
      if (keywordCount > 0) lines.push(`提取关键词：${keywordCount} 个`)
      if (bookmarkAuditCount > 0) lines.push(`审计字段：${bookmarkAuditCount} 个`)
      if (changedParagraphCount > 0) lines.push(`调整段落：${changedParagraphCount} 段`)
      if ((resultSummary.isTranslation || resultSummary.isRevisionLike) && Math.max(paragraphCount, outputParagraphCount) > 0) {
        lines.push(`处理段落：${Math.max(paragraphCount, outputParagraphCount)} 段`)
      }
      if (commentCount > 0) lines.push(`写入批注：${commentCount} 条`)
      if (protectionApplied) {
        lines.push(`样式保护：已启用${
          protectionMode === 'paragraph-body'
            ? '（保留段首编号与段落属性）'
            : protectionMode === 'sentence-range'
              ? '（按对应句子替换，尽量保留段内样式）'
              : '（按问题片段局部替换）'
        }`)
      }
      if (protectedParagraphCount > 0) {
        lines.push(`保护编号段落：${protectedParagraphCount} 段`)
      }
      if (task?.data?.backupRef?.backupPath) {
        lines.push(`回滚备份：${task.data.backupRef.backupPath}`)
      }
      if (task?.data?.applyResult?.styleValidation?.ok === false) {
        lines.push(`样式校验：${(task.data.applyResult.styleValidation.issues || []).join('、')}`)
        if (task.data.applyResult.styleValidation.reviewRequired === true) {
          lines.push('样式复核：建议人工复核后再继续使用当前写回结果')
        }
      }
      if (downgradeReason) {
        lines.push(`自动降级：${downgradeReason}`)
      }
      return lines.map((line) => prepareDialogDisplayText(line))
    },
    resolveAssistantInputSourceByScope(scope = 'selection-preferred') {
      const normalized = String(scope || 'selection-preferred')
      if (normalized === 'document') return 'document'
      if (normalized === 'selection') return 'selection-only'
      return 'selection-preferred'
    },
    getAssistantDocumentActionFieldOptions(demand, assistantId = '') {
      const config = assistantId ? this.getAssistantRecommendationConfigByKey(assistantId) : null
      const rawBaseOptions = assistantId
        ? getDocumentActionOptions(assistantId)
        : (demand?.kind === 'comment'
            ? [
                { value: 'comment', label: '添加批注' },
                { value: 'comment-replace', label: '批注并替换' },
                { value: 'none', label: '仅生成结果，不写回文档' }
              ]
            : [
                { value: 'replace', label: '替换原文' },
                { value: 'insert', label: '插入到当前位置' },
                { value: 'append', label: '追加到文末' },
                { value: 'comment', label: '写入批注' },
                { value: 'none', label: '仅生成结果，不写回文档' }
              ])
      const baseOptions = this.getDemandAwareDocumentActionOptions(rawBaseOptions, demand, assistantId)
      const orderedValues = Array.from(new Set([
        this.getDemandAwareDefaultDocumentAction(demand, assistantId, String(config?.documentAction || demand?.documentAction || 'insert').trim() || 'insert'),
        String(config?.documentAction || '').trim(),
        String(demand?.documentAction || '').trim(),
        ...baseOptions.map(item => String(item.value || '').trim())
      ].filter(Boolean)))
      return orderedValues
        .map((value) => DOCUMENT_ACTION_OPTIONS.find(item => item.value === value) || baseOptions.find(item => item.value === value))
        .filter(Boolean)
        .map(item => ({
          value: item.value,
          label: item.value === 'replace'
            ? '替换原文（仅替换错误文字或正文片段，保护编号和样式）'
            : item.value === 'insert-after'
              ? '插入到每段后面（逐段写入对应结果）'
              : item.value === 'prepend'
                ? '插入到文档最前面'
            : item.value === 'insert'
              ? '插入到当前位置'
              : item.label
        }))
    },
    getPendingAssistantFieldValue(pending, fieldKey, fallback = '') {
      const target = (pending?.fields || []).find(item => item.key === fieldKey)
      if (target && Object.prototype.hasOwnProperty.call(target, 'value')) {
        return String(target.value ?? '')
      }
      const demandValue = pending?.demand?.[fieldKey]
      if (demandValue !== undefined && demandValue !== null) {
        return String(demandValue)
      }
      return String(fallback || '')
    },
    getPendingAssistantScopeHint(pending) {
      if (!pending || typeof pending !== 'object') return null
      const configuredInputSource = this.getPendingAssistantFieldValue(
        pending,
        'inputSource',
        pending?.demand?.inputSource || 'selection-preferred'
      ).trim() || 'selection-preferred'
      let launchInfo = null
      const executionAssistantId = String(pending?.executionAssistantId || '').trim()
      if (executionAssistantId) {
        try {
          launchInfo = getAssistantLaunchInfo(executionAssistantId, {
            inputSource: configuredInputSource
          })
        } catch (error) {
          console.warn('计算助手执行范围提示失败:', error)
        }
      }
      if (!launchInfo) {
        const inputInfo = resolveDocumentInput(configuredInputSource)
        launchInfo = {
          inputSource: inputInfo?.source || (configuredInputSource === 'document' ? 'document' : 'selection'),
          configuredInputSource,
          hasSelection: inputInfo?.hasSelection === true,
          inputLength: String(inputInfo?.text || '').trim().length
        }
      }
      if (configuredInputSource === 'selection-preferred') {
        if (launchInfo.inputSource === 'selection') {
          return {
            summary: '当前将按选中内容执行',
            detail: '已检测到有效选区，将优先处理你当前选中的内容。'
          }
        }
        return {
          summary: '当前将按全文执行',
          detail: '当前未检测到有效选区，或选区只有 1 个字符，已自动回退为全文处理。'
        }
      }
      if (configuredInputSource === 'document') {
        return {
          summary: '当前将按全文执行',
          detail: '你当前选择的是全文范围，将直接处理整篇文档。'
        }
      }
      if (configuredInputSource === 'selection-only') {
        if (launchInfo.hasSelection || launchInfo.inputLength > 0) {
          return {
            summary: '当前将按选中内容执行',
            detail: '你当前选择的是仅处理选中内容，本次会只处理当前选区。'
          }
        }
        return {
          summary: '当前需要先选中内容',
          detail: '你当前选择的是仅处理选中内容；如果没有选中有效文本，执行时会提示你先选择内容。'
        }
      }
      return null
    },
    getAssistantModelTypeForDemand(assistantId = '', config = {}, demand = {}) {
      return String(demand?.modelType || config?.modelType || this.getAssistantItemByKey(assistantId)?.modelType || 'chat').trim() || 'chat'
    },
    getAssistantTemplateVariables(config = {}) {
      const source = [
        config?.userPromptTemplate,
        config?.systemPrompt,
        config?.description,
        config?.persona
      ].map(value => String(value || '')).join('\n')
      return new Set((source.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || []).map(item =>
        item.replace(/\{\{\s*|\s*\}\}/g, '').trim()
      ).filter(Boolean))
    },
    shouldCollectAssistantField(assistantId = '', config = {}, demand = {}, fieldKey = '') {
      const modelType = this.getAssistantModelTypeForDemand(assistantId, config, demand)
      const variables = this.getAssistantTemplateVariables(config)
      if (fieldKey === 'targetLanguage') {
        return demand?.kind === 'translate' || assistantId === 'translate' || variables.has('targetLanguage')
      }
      if (fieldKey === 'aspectRatio') {
        return modelType === 'image' || modelType === 'video' || variables.has('aspectRatio')
      }
      if (fieldKey === 'duration') {
        return modelType === 'video' || modelType === 'voice' || modelType === 'audio' || variables.has('duration')
      }
      if (fieldKey === 'voiceStyle') {
        return modelType === 'voice' || modelType === 'audio' || variables.has('voiceStyle')
      }
      return variables.has(fieldKey)
    },
    shouldCollectAssistantRunParameters(item) {
      if (!item?.key || item.type === 'create-custom-assistant') return false
      const config = this.getAssistantRecommendationConfig(item) || {}
      const demand = this.createDirectAssistantRunDemand(item, config)
      return ['targetLanguage', 'aspectRatio', 'duration', 'voiceStyle'].some(fieldKey =>
        this.shouldCollectAssistantField(item.key, config, demand, fieldKey)
      )
    },
    createDirectAssistantRunDemand(item, config = {}) {
      const modelType = String(config?.modelType || item?.modelType || 'chat').trim() || 'chat'
      const assistantId = String(item?.key || '').trim()
      const kind = assistantId === 'translate'
        ? 'translate'
        : modelType === 'image'
          ? 'image'
          : modelType === 'video'
            ? 'video'
            : (modelType === 'voice' || modelType === 'audio')
              ? 'audio'
              : 'assistant'
      const mediaOptions = config?.mediaOptions && typeof config.mediaOptions === 'object' ? config.mediaOptions : {}
      return {
        kind,
        label: item?.shortLabel || item?.label || '智能助手',
        requirementText: '',
        inputSource: config?.inputSource || 'selection-preferred',
        documentAction: config?.documentAction || 'insert',
        targetLanguage: config?.targetLanguage || (assistantId === 'translate' ? '英文' : ''),
        aspectRatio: mediaOptions.aspectRatio || '',
        duration: mediaOptions.duration || '',
        voiceStyle: mediaOptions.voiceStyle || '',
        modelType,
        scope: config?.inputSource || 'selection-preferred',
        parametersConfirmed: false
      }
    },
    createPendingAssistantExecutionParameterCollection(demand, selectedOption, options = {}) {
      const assistantId = String(selectedOption?.assistantId || '').trim()
      const config = this.getAssistantRecommendationConfigByKey(assistantId) || {}
      const mediaOptions = config?.mediaOptions && typeof config.mediaOptions === 'object' ? config.mediaOptions : {}
      const fields = []
      if (this.shouldCollectAssistantField(assistantId, config, demand, 'targetLanguage')) {
        fields.push({
          key: 'targetLanguage',
          label: '目标语言',
          type: 'select',
          required: true,
          value: String(demand?.targetLanguage || config?.targetLanguage || '').trim() || '英文',
          options: this.getAssistantTargetLanguageOptions()
        })
      }
      if (this.shouldCollectAssistantField(assistantId, config, demand, 'aspectRatio')) {
        fields.push({
          key: 'aspectRatio',
          label: '画幅比例',
          type: 'select',
          required: true,
          value: String(demand?.aspectRatio || mediaOptions.aspectRatio || '16:9').trim(),
          options: this.getMultimodalAspectRatioFieldOptions()
        })
      }
      if (this.shouldCollectAssistantField(assistantId, config, demand, 'duration')) {
        fields.push({
          key: 'duration',
          label: this.getAssistantModelTypeForDemand(assistantId, config, demand) === 'video' ? '视频时长' : '时长参考',
          type: 'select',
          required: true,
          value: String(demand?.duration || mediaOptions.duration || (this.getAssistantModelTypeForDemand(assistantId, config, demand) === 'video' ? '8s' : '30s')).trim(),
          options: this.getMultimodalDurationFieldOptions()
        })
      }
      if (this.shouldCollectAssistantField(assistantId, config, demand, 'voiceStyle')) {
        fields.push({
          key: 'voiceStyle',
          label: '语音风格',
          type: 'select',
          required: true,
          value: String(demand?.voiceStyle || mediaOptions.voiceStyle || '专业自然').trim(),
          options: this.getMultimodalVoiceStyleFieldOptions()
        })
      }
      fields.push({
        key: 'inputSource',
        label: '文档范围',
        type: 'select',
        required: true,
        value: String(config?.inputSource || demand?.inputSource || this.resolveAssistantInputSourceByScope(demand?.scope)).trim() || 'selection-preferred',
        options: this.getAssistantInputSourceFieldOptions()
      })
      fields.push({
        key: 'documentAction',
        label: '处理完成后的动作',
        type: 'select',
        required: true,
        value: this.getDemandAwareDefaultDocumentAction(
          demand,
          assistantId,
          String(config?.documentAction || demand?.documentAction || 'insert').trim() || 'insert'
        ),
        options: this.getAssistantDocumentActionFieldOptions(demand, assistantId)
      })
      fields.forEach((field) => {
        if (field.type !== 'select' || !String(field.value || '').trim()) return
        const value = String(field.value).trim()
        const options = Array.isArray(field.options) ? field.options : []
        if (!options.some(option => String(option?.value || '') === value)) {
          field.options = [{ value, label: value }, ...options]
        }
      })
      return {
        status: 'pending',
        summaryText: options.summaryText || `已识别到助手“${selectedOption?.label || '智能助手'}”，请先确认本次执行参数。`,
        confirmPrompt: options.confirmPrompt || '系统已结合该助手能力和你当前的需求，自动筛选并预选了更合理的文档动作。你也可以在当前候选范围内调整后再执行。',
        statusMessage: options.statusMessage || '请先确认参数、范围与处理动作。',
        demand,
        fields,
        executionAssistantId: assistantId,
        executionAssistantLabel: selectedOption?.label || '智能助手'
      }
    },
    getAssistantTargetLanguageOptions() {
      return [
        { value: '英文', label: '英文' },
        { value: '中文', label: '中文' },
        { value: '日文', label: '日文' },
        { value: '韩文', label: '韩文' },
        { value: '法文', label: '法文' },
        { value: '德文', label: '德文' },
        { value: '西班牙文', label: '西班牙文' },
        { value: '俄文', label: '俄文' }
      ]
    },
    getReportTypeFieldOptions() {
      return REPORT_TYPE_OPTIONS.map(item => ({
        value: item.value,
        label: item.label
      }))
    },
    getGeneratedOutputScopeFieldOptions() {
      return [
        { value: 'document', label: '全文' },
        { value: 'selection', label: '当前内容' },
        { value: 'prompt', label: '当前请求' }
      ]
    },
    getGeneratedOutputScopeLabel(value) {
      return this.getGeneratedOutputScopeFieldOptions().find(item => item.value === value)?.label || value || '全文'
    },
    getGeneratedOutputFormatFieldOptions() {
      return [
        { value: 'md', label: 'Markdown' },
        { value: 'txt', label: '文本' },
        { value: 'json', label: 'JSON' },
        { value: 'csv', label: 'CSV' }
      ]
    },
    getMultimodalAspectRatioFieldOptions() {
      return [
        { value: '1:1', label: '1:1 正方形' },
        { value: '4:3', label: '4:3 标准横版' },
        { value: '16:9', label: '16:9 宽屏横版' },
        { value: '3:4', label: '3:4 竖版海报' },
        { value: '9:16', label: '9:16 竖屏视频' }
      ]
    },
    getMultimodalDurationFieldOptions() {
      return [
        { value: '5s', label: '5 秒' },
        { value: '8s', label: '8 秒' },
        { value: '10s', label: '10 秒' },
        { value: '15s', label: '15 秒' },
        { value: '30s', label: '30 秒' }
      ]
    },
    getMultimodalVoiceStyleFieldOptions() {
      return [
        { value: '专业自然', label: '专业自然' },
        { value: '专业正式', label: '专业正式' },
        { value: '新闻播报', label: '新闻播报' },
        { value: '自然口语', label: '自然口语' },
        { value: '温柔自然', label: '温柔自然' }
      ]
    },
    shouldUseMultimodalParameterFlow(intent = {}) {
      const action = String(intent?.action || '').trim()
      return ['image', 'audio', 'video'].includes(action)
    },
    createPendingMultimodalGenerationForm(text = '', intent = {}, options = {}) {
      const action = String(intent?.action || '').trim()
      const scope = String(intent?.scope || 'prompt').trim() || 'prompt'
      const fields = [
        {
          key: 'scope',
          label: '处理范围',
          type: 'select',
          required: true,
          value: scope,
          options: this.getGeneratedOutputScopeFieldOptions()
        },
        {
          key: 'fileBaseName',
          label: '结果名称',
          type: 'text',
          required: false,
          value: String(intent?.fileBaseName || '').trim() || (
            action === 'image' ? '生成图片' : action === 'video' ? '生成视频' : '生成语音'
          ),
          placeholder: '请输入结果名称'
        }
      ]
      if (action === 'image' || action === 'video') {
        fields.push({
          key: 'aspectRatio',
          label: '画幅比例',
          type: 'select',
          required: true,
          value: String(intent?.aspectRatio || (action === 'video' ? '16:9' : '16:9')).trim(),
          options: this.getMultimodalAspectRatioFieldOptions()
        })
      }
      if (action === 'video') {
        fields.push({
          key: 'duration',
          label: '视频时长',
          type: 'select',
          required: true,
          value: String(intent?.duration || '8s').trim(),
          options: this.getMultimodalDurationFieldOptions()
        })
      }
      if (action === 'audio') {
        fields.push({
          key: 'voiceStyle',
          label: '语音风格',
          type: 'select',
          required: true,
          value: String(intent?.voiceStyle || '专业自然').trim(),
          options: this.getMultimodalVoiceStyleFieldOptions()
        })
      }
      return {
        status: 'pending',
        summaryText: options.summaryText || `已识别到${action === 'image' ? '图片' : action === 'video' ? '视频' : '语音'}生成需求，请先确认参数。`,
        confirmPrompt: options.confirmPrompt || '已根据当前请求预填默认值。你也可以先调整参数再继续。',
        statusMessage: options.statusMessage || '请确认范围、名称和生成参数。',
        autoContinueSecondsLeft: 0,
        originalText: String(text || '').trim(),
        intent: JSON.parse(JSON.stringify(intent || {})),
        modelId: String(options.modelId || this.selectedModelId || '').trim(),
        fields
      }
    },
    updatePendingMultimodalGenerationField(message, fieldKey, value) {
      const pending = message?.pendingMultimodalGenerationForm
      if (!pending || pending.status === 'applying') return
      const field = (pending.fields || []).find(item => item.key === fieldKey)
      if (!field) return
      field.value = String(value || '').trim()
      this.scheduleMultimodalGenerationAutoContinue(message)
      this.saveHistory()
    },
    clearMultimodalGenerationAutoContinue(messageId = '') {
      const key = String(messageId || '')
      if (!key || !this.assistantParameterAutoTimers[key]) return
      window.clearTimeout(this.assistantParameterAutoTimers[key])
      delete this.assistantParameterAutoTimers[key]
      this.clearDialogAutoContinueInterval(key)
    },
    scheduleMultimodalGenerationAutoContinue(message) {
      this.scheduleMessageAutoContinue(
        message,
        'pendingMultimodalGenerationForm',
        (targetMessage, options = {}) => this.confirmPendingMultimodalGenerationForm(targetMessage, options)
      )
    },
    buildPendingMultimodalIntent(pending) {
      const nextIntent = JSON.parse(JSON.stringify(pending?.intent || {}))
      ;(pending?.fields || []).forEach((field) => {
        nextIntent[field.key] = String(field.value || '').trim()
      })
      return nextIntent
    },
    async confirmPendingMultimodalGenerationForm(message, options = {}) {
      const pending = message?.pendingMultimodalGenerationForm
      if (!pending || pending.status === 'applying') return
      this.clearMultimodalGenerationAutoContinue(message?.id)
      const missing = (pending.fields || []).filter(field => field.required !== false && !String(field.value || '').trim())
      if (missing.length > 0) {
        pending.statusMessage = `请先填写：${missing.map(item => item.label).join('、')}`
        this.saveHistory()
        return
      }
      pending.status = 'applying'
      pending.statusMessage = options.autoTriggered ? '已按当前参数自动开始生成...' : '正在启动多模态生成任务...'
      this.saveHistory()
      const intent = this.buildPendingMultimodalIntent(pending)
      const model = this.filteredModelList.find(item => item.id === pending.modelId) || this.selectedModel
      message.pendingMultimodalGenerationForm = null
      await this.handleGeneratedOutputMessage(pending.originalText, model, intent, { assistantMsg: message })
    },
    cancelPendingMultimodalGenerationForm(message) {
      const pending = message?.pendingMultimodalGenerationForm
      if (!pending || pending.status === 'applying') return
      this.clearMultimodalGenerationAutoContinue(message?.id)
      message.pendingMultimodalGenerationForm = null
      if (!String(message.content || '').trim()) {
        message.content = '已取消本次多模态生成。'
      }
      this.saveHistory()
    },
    getReportPresetCandidates() {
      return getReportAssistantPresetGroups().flatMap(group =>
        (group.presets || []).map(preset => ({
          ...preset,
          groupKey: group.key,
          groupLabel: group.label,
          corpus: `${group.label} ${group.description} ${preset.label} ${preset.description} ${preset.config?.name || ''} ${preset.config?.description || ''} ${preset.config?.persona || ''} ${preset.config?.reportSettings?.prompt || ''}`
        }))
      )
    },
    inferReportPresetFromText(text = '') {
      const normalized = String(text || '').trim()
      if (!normalized) return null
      const candidates = this.getReportPresetCandidates()
      let best = null
      let bestScore = 0
      candidates.forEach((item) => {
        let score = 0
        const corpus = String(item.corpus || '')
        const reportTypeLabel = getReportTypeLabel(item.config?.reportSettings?.type || 'general-analysis-report')
        ;[item.label, item.description, item.config?.name, item.config?.description, item.config?.persona, reportTypeLabel, corpus].forEach((part) => {
          const value = String(part || '').trim()
          if (value && normalized.includes(value)) score += value.length >= 4 ? 5 : 2
        })
        if (item.groupLabel && normalized.includes(item.groupLabel)) score += 4
        if (score > bestScore) {
          bestScore = score
          best = item
        }
      })
      return bestScore > 0 ? best : null
    },
    inferIndustryFromText(text = '') {
      const normalized = String(text || '').trim()
      const preset = this.inferReportPresetFromText(normalized)
      if (preset?.groupLabel) {
        return { industry: preset.groupLabel, confidence: 'high', presetId: preset.id }
      }
      const groups = getReportAssistantPresetGroups()
      const matched = groups.find(group => {
        const haystack = `${group.label} ${group.description} ${group.presets.map(item => `${item.label} ${item.description}`).join(' ')}`
        return /工程|项目|质量|验收/.test(normalized) && group.key === 'engineering' ||
          /软件|研发|测试|缺陷|上线|技术/.test(normalized) && group.key === 'software' ||
          /教学|课程|学情|培训|学生/.test(normalized) && group.key === 'education' ||
          /经营|管理|周报|月报|年报|运营|调研/.test(normalized) && group.key === 'management' ||
          /审计|合规|风险|保密|风控|法务/.test(normalized) && group.key === 'compliance' ||
          /医疗|临床|患者|药品|健康/.test(normalized) && group.key === 'medical' ||
          /政务|政策|公文|行政|督查/.test(normalized) && group.key === 'government' ||
          /制造|生产|供应链|设备/.test(normalized) && group.key === 'manufacturing' ||
          /科研|学术|实验|文献|申报/.test(normalized) && group.key === 'research' ||
          /合同|诉讼|知识产权|法律/.test(normalized) && group.key === 'legal' ||
          haystack.includes(normalized)
      })
      if (!matched) return { industry: '', confidence: 'low', presetId: '' }
      return { industry: matched.label, confidence: 'high', presetId: '' }
    },
    inferReportTypeFromText(text = '') {
      const normalized = String(text || '').trim()
      const preset = this.inferReportPresetFromText(normalized)
      if (preset?.config?.reportSettings?.type) {
        return preset.config.reportSettings.type
      }
      const matched = REPORT_TYPE_OPTIONS.find(item => normalized.includes(item.label))
      if (matched) return matched.value
      if (/周报/.test(normalized)) return 'weekly-report'
      if (/月报/.test(normalized)) return 'monthly-report'
      if (/年报/.test(normalized)) return 'annual-report'
      if (/纪要/.test(normalized)) return 'briefing-report'
      if (/调研/.test(normalized)) return 'special-research-report'
      if (/审计/.test(normalized)) return 'special-audit-report'
      if (/分析报告|分析/.test(normalized)) return 'general-analysis-report'
      if (/总结/.test(normalized)) return 'review-report'
      return 'general-analysis-report'
    },
    inferReportNameFromText(text = '', reportType = '') {
      const normalized = String(text || '').trim()
      const explicit = normalized.match(/(?:生成|输出|写一份|做一份|起草一份)?([^，。；\n]{2,24}(?:报告|总结|简报|纪要|周报|月报|年报))/)
      if (explicit?.[1]) return explicit[1].trim()
      return getReportTypeLabel(reportType, '')
    },
    shouldUseReportGenerationFlow(intent, text = '') {
      return intent?.action === 'report' && REPORT_FILE_REQUEST_PATTERN.test(String(text || '').trim())
    },
    buildReportGenerationContext(text = '', intent = {}) {
      const industryInfo = this.inferIndustryFromText(text)
      const reportType = this.inferReportTypeFromText(text)
      const reportName = this.inferReportNameFromText(text, reportType)
      const presetDraft = industryInfo?.presetId ? buildReportAssistantPresetDraft(industryInfo.presetId) : null
      return {
        reportKind: /(总结|纪要|简报)/.test(String(text || '')) ? 'summary-file' : 'report-file',
        industry: industryInfo.industry,
        industryConfidence: industryInfo.confidence,
        reportType,
        reportName,
        scope: intent?.scope || 'document',
        outputFormat: intent?.outputFormat || 'md',
        sourceTextMode: intent?.scope || 'document',
        fileBaseName: intent?.fileBaseName || reportName || '生成报告',
        presetId: industryInfo?.presetId || '',
        presetDraft
      }
    },
    clearReportGenerationPendingStates(message) {
      if (!message) return
      this.clearReportGenerationAutoContinue(message.id)
      message.pendingReportGenerationForm = null
      message.pendingReportDraftConfirmation = null
    },
    clearReportGenerationAutoContinue(messageId = '') {
      const key = String(messageId || '')
      if (!key || !this.reportGenerationAutoTimers[key]) return
      window.clearTimeout(this.reportGenerationAutoTimers[key])
      delete this.reportGenerationAutoTimers[key]
      this.clearDialogAutoContinueInterval(key)
    },
    scheduleReportGenerationAutoContinue(message) {
      this.scheduleMessageAutoContinue(
        message,
        'pendingReportGenerationForm',
        (targetMessage, options = {}) => this.confirmPendingReportGenerationForm(targetMessage, options),
        'report'
      )
    },
    scheduleReportDraftConfirmationAutoContinue(message) {
      this.scheduleMessageAutoContinue(
        message,
        'pendingReportDraftConfirmation',
        (targetMessage, options = {}) => this.confirmPendingReportDraftConfirmation(targetMessage, options),
        'report'
      )
    },
    createPendingReportGenerationForm(text = '', intent = {}, options = {}) {
      const context = this.buildReportGenerationContext(text, intent)
      return {
        status: 'pending',
        summaryText: options.summaryText || '已识别到报告/总结文件生成需求，请先确认生成参数。',
        confirmPrompt: options.confirmPrompt || '行业会优先智能猜测；如果你需要，也可以先手动调整当前表单。',
        statusMessage: options.statusMessage || '请确认行业、名称、类型、范围和输出格式。',
        autoContinueSecondsLeft: 0,
        originalText: String(text || '').trim(),
        intent,
        context,
        fields: [
          {
            key: 'industry',
            label: '所属行业',
            type: 'text',
            required: context.industryConfidence !== 'high',
            value: context.industry,
            placeholder: '例如：工程与项目类、政府与公文类、软件与研发类'
          },
          {
            key: 'reportName',
            label: '报告或总结名称',
            type: 'text',
            required: true,
            value: context.reportName,
            placeholder: '例如：项目周报、专项审计报告、会议纪要'
          },
          {
            key: 'reportType',
            label: '报告类型',
            type: 'select',
            required: true,
            value: context.reportType,
            options: this.getReportTypeFieldOptions()
          },
          {
            key: 'scope',
            label: '处理范围',
            type: 'select',
            required: true,
            value: context.scope,
            options: this.getGeneratedOutputScopeFieldOptions()
          },
          {
            key: 'outputFormat',
            label: '输出格式',
            type: 'select',
            required: true,
            value: context.outputFormat,
            options: this.getGeneratedOutputFormatFieldOptions()
          }
        ]
      }
    },
    updatePendingReportGenerationField(message, fieldKey, value) {
      const pending = message?.pendingReportGenerationForm
      if (!pending || pending.status === 'applying') return
      const field = (pending.fields || []).find(item => item.key === fieldKey)
      if (!field) return
      field.value = String(value || '')
      this.scheduleReportGenerationAutoContinue(message)
      this.saveHistory()
    },
    buildReportFormValues(pending) {
      const values = {
        ...(pending?.context || {}),
        originalText: String(pending?.originalText || '').trim()
      }
      ;(pending?.fields || []).forEach((field) => {
        values[field.key] = String(field.value || '').trim()
      })
      values.fileBaseName = values.reportName || values.fileBaseName || '生成报告'
      return values
    },
    createPendingReportDraftConfirmation(values = {}, draft = {}, options = {}) {
      const outlineLines = Array.isArray(draft.outlineSections)
        ? draft.outlineSections.map((section, index) => {
            const title = String(section?.title || '').trim()
            const points = Array.isArray(section?.points) ? section.points.map(point => String(point || '').trim()).filter(Boolean) : []
            const pointText = points.length > 0 ? `\n${points.map(point => `- ${point}`).join('\n')}` : ''
            return `${index + 1}. ${title}${pointText}`
          }).join('\n\n')
        : ''
      return {
        status: 'pending',
        summaryText: options.summaryText || '已起草报告草稿，请确认或修改后再开始正式生成。',
        confirmPrompt: options.confirmPrompt || '你可以在会话中直接修改名称、大纲和写作口径，确认后才会开始正式生成文件。',
        statusMessage: options.statusMessage || '请确认这份报告草稿。',
        autoContinueSecondsLeft: 0,
        originalText: String(values.originalText || '').trim(),
        formValues: values,
        reportName: draft.reportName || values.reportName || '',
        industry: draft.industry || values.industry || '',
        reportType: draft.reportType || values.reportType || '',
        outputFormat: String(values.outputFormat || 'md').trim() || 'md',
        scope: String(values.scope || 'document').trim() || 'document',
        outlineText: outlineLines,
        writingGuidance: draft.writingGuidance || '',
        generationPrompt: draft.generationPrompt || '',
        rawDraft: draft
      }
    },
    updatePendingReportDraftField(message, field, value) {
      const pending = message?.pendingReportDraftConfirmation
      if (!pending || pending.status === 'applying') return
      pending[field] = String(value || '')
      this.scheduleReportDraftConfirmationAutoContinue(message)
      this.saveHistory()
    },
    async confirmPendingReportGenerationForm(message, options = {}) {
      const pending = message?.pendingReportGenerationForm
      if (!pending || pending.status === 'applying') return
      if (pending.status === 'failed') {
        pending.status = 'pending'
        pending.statusMessage = ''
        this.saveHistory()
      }
      this.clearReportGenerationAutoContinue(message?.id)
      const missing = (pending.fields || []).filter(field => field.required !== false && !String(field.value || '').trim())
      if (missing.length > 0) {
        pending.statusMessage = `请先填写：${missing.map(item => item.label).join('、')}`
        this.saveHistory()
        return
      }
      pending.status = 'applying'
      pending.statusMessage = options.autoTriggered === true ? '已按当前表单自动起草报告草稿...' : '正在起草报告草稿...'
      this.saveHistory()
      try {
        const values = this.buildReportFormValues(pending)
        const draft = await buildReportDraftWithModel({
          model: this.selectedModel,
          requirementText: pending.originalText,
          industry: values.industry,
          reportName: values.reportName,
          reportType: values.reportType,
          outputFormat: values.outputFormat,
          scope: values.scope,
          presetPrompt: String(pending.context?.presetDraft?.reportSettings?.prompt || '').trim(),
          presetPersona: String(pending.context?.presetDraft?.persona || '').trim()
        })
        message.pendingReportGenerationForm = null
        message.pendingReportDraftConfirmation = this.createPendingReportDraftConfirmation(values, draft)
        this.scheduleReportDraftConfirmationAutoContinue(message)
        this.saveHistory()
        this.$nextTick(() => this.scrollToBottom())
      } catch (error) {
        pending.status = 'failed'
        pending.statusMessage = error?.message || '报告草稿起草失败'
        this.saveHistory()
      }
    },
    cancelPendingReportGenerationForm(message) {
      const pending = message?.pendingReportGenerationForm
      if (!pending || pending.status === 'applying') return
      this.clearReportGenerationAutoContinue(message?.id)
      message.pendingReportGenerationForm = null
      if (!String(message.content || '').trim()) {
        message.content = '已取消本次报告生成参数确认。'
      }
      this.saveHistory()
    },
    buildConfirmedReportIntent(pending) {
      const values = pending?.formValues || {}
      const outputFormat = String(values.outputFormat || 'md').trim() || 'md'
      const reportType = String(pending?.reportType || values.reportType || 'general-analysis-report').trim() || 'general-analysis-report'
      const reportName = String(pending?.reportName || values.reportName || '生成报告').trim() || '生成报告'
      return {
        action: 'report',
        scope: String(values.scope || 'document').trim() || 'document',
        outputFormat,
        fileBaseName: reportName,
        reportContext: {
          industry: String(pending?.industry || values.industry || '').trim(),
          reportType,
          reportTypeLabel: getReportTypeLabel(reportType, ''),
          reportName,
          outlineText: String(pending?.outlineText || '').trim(),
          writingGuidance: String(pending?.writingGuidance || '').trim(),
          generationPrompt: String(pending?.generationPrompt || '').trim()
        }
      }
    },
    async confirmPendingReportDraftConfirmation(message, options = {}) {
      const pending = message?.pendingReportDraftConfirmation
      if (!pending || pending.status === 'applying') return
      this.clearReportGenerationAutoContinue(message?.id)
      if (!String(pending.reportName || '').trim()) {
        pending.statusMessage = '请先填写报告名称。'
        this.saveHistory()
        return
      }
      if (!String(pending.outlineText || '').trim()) {
        pending.statusMessage = '请先确认报告大纲。'
        this.saveHistory()
        return
      }
      pending.status = 'applying'
      pending.statusMessage = options.autoTriggered === true ? '已按当前草稿自动开始生成文件...' : '正在根据确认后的草稿开始生成文件...'
      this.saveHistory()
      const confirmedIntent = this.buildConfirmedReportIntent(pending)
      message.pendingReportDraftConfirmation = null
      await this.handleGeneratedOutputMessage(
        String(pending.originalText || pending.formValues?.originalText || '').trim(),
        this.selectedModel,
        confirmedIntent,
        { assistantMsg: message }
      )
    },
    cancelPendingReportDraftConfirmation(message) {
      const pending = message?.pendingReportDraftConfirmation
      if (!pending || pending.status === 'applying') return
      this.clearReportGenerationAutoContinue(message?.id)
      message.pendingReportDraftConfirmation = null
      if (!String(message.content || '').trim()) {
        message.content = '已取消本次报告草稿确认。'
      }
      this.saveHistory()
    },
    getAssistantInputSourceFieldOptions() {
      return [
        { value: 'selection-only', label: '选中内容' },
        { value: 'document', label: '全文' },
        { value: 'selection-preferred', label: '自动判断（有选中优先选中）' }
      ]
    },
    getAssistantDemandDocumentActionFieldOptions(demand) {
      return this.getAssistantDocumentActionFieldOptions(demand, '')
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
    getAssistantListCreatedAt(item) {
      return this.formatDateTime(item?.createdAt || '')
    },
    formatAssistantTaskError(errorText = '') {
      const text = String(errorText || '').trim()
      if (!text) return '助手任务执行失败'
      if (/余额不足|insufficient balance|credit balance|quota exceeded|欠费/i.test(text)) {
        return prepareDialogDisplayText(`模型欠费或额度不足：${text}`)
      }
      if (/网络请求失败|network request failed|failed to fetch|fetch failed|network/i.test(text)) {
        return prepareDialogDisplayText(`网络异常：${text}`)
      }
      if (/api 密钥|api key|鉴权|unauthorized|authentication|auth|令牌/i.test(text)) {
        return prepareDialogDisplayText(`鉴权异常：${text}`)
      }
      return prepareDialogDisplayText(text)
    },
    getDialogAutoContinueSeconds() {
      return 5
    },
    shouldPromptEnableRevisionModeForPending(message, actionType = '', task = null) {
      if (message?.pendingRevisionModePrompt) return false
      if (isDocumentTrackRevisionsEnabled()) return false
      const normalized = String(actionType || '').trim()
      if (normalized === 'document-revision-apply') {
        return !!message?.pendingDocumentRevisionAction?.canApply
      }
      if (normalized === 'assistant-task-apply') {
        const documentAction = String(task?.data?.documentAction || '').trim()
        return ['replace', 'comment-replace', 'insert-after', 'insert', 'prepend', 'append'].includes(documentAction)
      }
      return false
    },
    createPendingRevisionModePrompt(actionType = '', options = {}) {
      return {
        status: 'pending',
        summaryText: options.summaryText || '写回文档前，可先开启修订模式。',
        confirmPrompt: options.confirmPrompt || '开启后，本次改动会以修订痕迹写入文档；如果不需要，也可以直接继续处理。',
        statusMessage: options.statusMessage || '若未选择，将按默认方式直接继续处理。',
        autoContinueSecondsLeft: 0,
        autoContinueLabel: '直接继续处理',
        actionType: String(actionType || '').trim(),
        taskId: String(options.taskId || '').trim()
      }
    },
    scheduleRevisionModePromptAutoContinue(message) {
      this.scheduleMessageAutoContinue(
        message,
        'pendingRevisionModePrompt',
        (targetMessage, options = {}) => this.continuePendingRevisionModePrompt(targetMessage, options)
      )
    },
    promptRevisionModeBeforeApply(message, actionType = '', options = {}) {
      if (!this.shouldPromptEnableRevisionModeForPending(message, actionType, options.task || null)) return false
      message.pendingRevisionModePrompt = this.createPendingRevisionModePrompt(actionType, options)
      this.scheduleRevisionModePromptAutoContinue(message)
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
      return true
    },
    isPendingAutoContinuePaused(pending) {
      return pending?.autoContinuePausedByHover === true || pending?.autoContinuePausedByFocus === true
    },
    setPendingAutoContinuePauseState(pending, reason = 'hover', paused = false) {
      if (!pending || !reason) return
      if (reason === 'focus') {
        pending.autoContinuePausedByFocus = paused === true
        return
      }
      pending.autoContinuePausedByHover = paused === true
    },
    clearDialogAutoContinueInterval(messageId = '') {
      const key = String(messageId || '')
      if (!key || !this.dialogAutoContinueIntervals[key]) return
      window.clearInterval(this.dialogAutoContinueIntervals[key])
      delete this.dialogAutoContinueIntervals[key]
    },
    startDialogAutoContinueInterval(messageId = '', pending = null, startSeconds = null) {
      const key = String(messageId || '')
      if (!key || !pending) return
      this.clearDialogAutoContinueInterval(key)
      const seconds = Math.max(1, Number(startSeconds || this.getDialogAutoContinueSeconds() || 5))
      pending.autoContinueSecondsLeft = seconds
      this.dialogAutoContinueIntervals[key] = window.setInterval(() => {
        if (!pending || pending.status !== 'pending') {
          this.clearDialogAutoContinueInterval(key)
          return
        }
        if (this.isPendingAutoContinuePaused(pending)) {
          return
        }
        const nextSeconds = Math.max(0, Number(pending.autoContinueSecondsLeft || seconds) - 1)
        pending.autoContinueSecondsLeft = nextSeconds
        if (nextSeconds <= 0) {
          this.clearDialogAutoContinueInterval(key)
        }
      }, 1000)
    },
    scheduleMessageAutoContinue(message, pendingKey = '', confirmHandler = null, timerBucket = 'assistant', preserveRemaining = false) {
      const messageId = String(message?.id || '')
      const pending = pendingKey ? message?.[pendingKey] : null
      if (!messageId || !pending || pending.status !== 'pending' || typeof confirmHandler !== 'function') return
      const seconds = Math.max(1, Number(preserveRemaining === true ? (pending.autoContinueSecondsLeft || this.getDialogAutoContinueSeconds() || 5) : (this.getDialogAutoContinueSeconds() || 5)))
      if (timerBucket === 'report') {
        this.clearReportGenerationAutoContinue(messageId)
      } else {
        this.clearAssistantParameterAutoContinue(messageId)
      }
      this.setPendingAutoContinuePauseState(pending, 'hover', false)
      this.setPendingAutoContinuePauseState(pending, 'focus', false)
      this.startDialogAutoContinueInterval(messageId, pending, seconds)
      const timers = timerBucket === 'report' ? this.reportGenerationAutoTimers : this.assistantParameterAutoTimers
      timers[messageId] = window.setTimeout(() => {
        this.clearDialogAutoContinueInterval(messageId)
        const nextPending = pendingKey ? message?.[pendingKey] : null
        if (nextPending?.status === 'pending' && !this.isPendingAutoContinuePaused(nextPending)) {
          confirmHandler(message, { autoTriggered: true })
          return
        }
        if (nextPending?.status === 'pending') {
          this.scheduleMessageAutoContinue(message, pendingKey, confirmHandler, timerBucket, true)
        }
      }, seconds * 1000)
    },
    getPendingConfirmPrompt(pending) {
      const basePrompt = String(pending?.confirmPrompt || '').trim()
      return prepareDialogDisplayText(basePrompt)
    },
    shouldShowPendingAutoContinue(pending) {
      return !!pending && pending.status === 'pending' && Number(pending.autoContinueSecondsLeft || 0) > 0
    },
    getPendingAutoContinueText(pending) {
      const seconds = Math.max(0, Number(pending?.autoContinueSecondsLeft || 0))
      const actionLabel = String(pending?.autoContinueLabel || '').trim()
      const finalActionText = actionLabel || '默认确定并继续下一步'
      if (this.isPendingAutoContinuePaused(pending)) {
        return prepareDialogDisplayText(`已暂停自动继续，移出后将在 ${seconds} 秒后${finalActionText}`)
      }
      return prepareDialogDisplayText(`${seconds} 秒后将${finalActionText}`)
    },
    getPendingAutoContinueProgressStyle(pending) {
      const total = Math.max(1, Number(this.getDialogAutoContinueSeconds() || 5))
      const remaining = Math.max(0, Number(pending?.autoContinueSecondsLeft || 0))
      const width = Math.max(0, Math.min(100, (remaining / total) * 100))
      return {
        width: `${width}%`,
        opacity: this.isPendingAutoContinuePaused(pending) ? '0.55' : '1'
      }
    },
    pausePendingAutoContinue(message, pendingKey = '', timerBucket = 'assistant', reason = 'hover') {
      const pending = pendingKey ? message?.[pendingKey] : null
      if (!pending || pending.status !== 'pending' || Number(pending.autoContinueSecondsLeft || 0) <= 0) return
      this.setPendingAutoContinuePauseState(pending, reason, true)
      if (timerBucket === 'report') {
        this.clearReportGenerationAutoContinue(message?.id)
      } else {
        this.clearAssistantParameterAutoContinue(message?.id)
      }
      this.saveHistory()
    },
    resumePendingAutoContinue(message, pendingKey = '', confirmHandler = null, timerBucket = 'assistant', reason = 'hover') {
      const pending = pendingKey ? message?.[pendingKey] : null
      if (!pending || pending.status !== 'pending') return
      this.setPendingAutoContinuePauseState(pending, reason, false)
      if (this.isPendingAutoContinuePaused(pending)) {
        this.saveHistory()
        return
      }
      this.scheduleMessageAutoContinue(message, pendingKey, confirmHandler, timerBucket, true)
      this.saveHistory()
    },
    getPendingAutoContinueConfirmHandler(pendingKey = '') {
      if (pendingKey === 'pendingWpsCapabilityForm') return (targetMessage, options = {}) => this.confirmPendingWpsCapabilityForm(targetMessage, options)
      if (pendingKey === 'pendingAssistantIntentChoice') return (targetMessage, options = {}) => this.confirmPendingAssistantIntentChoice(targetMessage, options)
      if (pendingKey === 'pendingAssistantParameterCollection') return (targetMessage, options = {}) => this.confirmPendingAssistantParameterCollection(targetMessage, options)
      if (pendingKey === 'pendingAssistantExecutionChoice') return (targetMessage, options = {}) => this.confirmPendingAssistantExecutionChoice(targetMessage, options)
      if (pendingKey === 'pendingAssistantCreationDraft') return (targetMessage, options = {}) => this.confirmPendingAssistantCreationDraft(targetMessage, options)
      if (pendingKey === 'pendingRevisionModePrompt') return (targetMessage, options = {}) => this.continuePendingRevisionModePrompt(targetMessage, options)
      if (pendingKey === 'pendingDocumentOperationChoice') return (targetMessage, options = {}) => this.confirmPendingDocumentOperationChoice(targetMessage, options)
      if (pendingKey === 'pendingReportGenerationForm') return (targetMessage, options = {}) => this.confirmPendingReportGenerationForm(targetMessage, options)
      if (pendingKey === 'pendingMultimodalGenerationForm') return (targetMessage, options = {}) => this.confirmPendingMultimodalGenerationForm(targetMessage, options)
      if (pendingKey === 'pendingReportDraftConfirmation') return (targetMessage, options = {}) => this.confirmPendingReportDraftConfirmation(targetMessage, options)
      return null
    },
    handlePendingAutoContinueFocusIn(message, pendingKey = '', timerBucket = 'assistant') {
      this.pausePendingAutoContinue(message, pendingKey, timerBucket, 'focus')
    },
    handlePendingAutoContinueFocusOut(message, pendingKey = '', event = null, timerBucket = 'assistant') {
      const currentTarget = event?.currentTarget || null
      const nextTarget = event?.relatedTarget || null
      if (currentTarget && nextTarget && typeof currentTarget.contains === 'function' && currentTarget.contains(nextTarget)) {
        return
      }
      this.resumePendingAutoContinue(
        message,
        pendingKey,
        this.getPendingAutoContinueConfirmHandler(pendingKey),
        timerBucket,
        'focus'
      )
    },
    resumePendingWpsCapabilityAutoContinue(message) {
      this.resumePendingAutoContinue(message, 'pendingWpsCapabilityForm', (targetMessage, options = {}) => this.confirmPendingWpsCapabilityForm(targetMessage, options))
    },
    resumePendingAssistantIntentChoiceAutoContinue(message) {
      this.resumePendingAutoContinue(message, 'pendingAssistantIntentChoice', (targetMessage, options = {}) => this.confirmPendingAssistantIntentChoice(targetMessage, options))
    },
    resumePendingAssistantParameterAutoContinue(message) {
      this.resumePendingAutoContinue(message, 'pendingAssistantParameterCollection', (targetMessage, options = {}) => this.confirmPendingAssistantParameterCollection(targetMessage, options))
    },
    resumePendingAssistantExecutionChoiceAutoContinue(message) {
      this.resumePendingAutoContinue(message, 'pendingAssistantExecutionChoice', (targetMessage, options = {}) => this.confirmPendingAssistantExecutionChoice(targetMessage, options))
    },
    resumePendingAssistantCreationDraftAutoContinue(message) {
      this.resumePendingAutoContinue(message, 'pendingAssistantCreationDraft', (targetMessage, options = {}) => this.confirmPendingAssistantCreationDraft(targetMessage, options))
    },
    resumePendingDocumentOperationChoiceAutoContinue(message) {
      this.resumePendingAutoContinue(message, 'pendingDocumentOperationChoice', (targetMessage, options = {}) => this.confirmPendingDocumentOperationChoice(targetMessage, options))
    },
    resumePendingReportGenerationAutoContinue(message) {
      this.resumePendingAutoContinue(message, 'pendingReportGenerationForm', (targetMessage, options = {}) => this.confirmPendingReportGenerationForm(targetMessage, options), 'report')
    },
    resumePendingMultimodalGenerationAutoContinue(message) {
      this.resumePendingAutoContinue(message, 'pendingMultimodalGenerationForm', (targetMessage, options = {}) => this.confirmPendingMultimodalGenerationForm(targetMessage, options))
    },
    resumePendingReportDraftConfirmationAutoContinue(message) {
      this.resumePendingAutoContinue(message, 'pendingReportDraftConfirmation', (targetMessage, options = {}) => this.confirmPendingReportDraftConfirmation(targetMessage, options), 'report')
    },
    resumePendingRevisionModePromptAutoContinue(message) {
      this.resumePendingAutoContinue(message, 'pendingRevisionModePrompt', (targetMessage, options = {}) => this.continuePendingRevisionModePrompt(targetMessage, options))
    },
    clearAssistantParameterAutoContinue(messageId = '') {
      const key = String(messageId || '')
      if (!key || !this.assistantParameterAutoTimers[key]) return
      window.clearTimeout(this.assistantParameterAutoTimers[key])
      delete this.assistantParameterAutoTimers[key]
      this.clearDialogAutoContinueInterval(key)
    },
    scheduleAssistantParameterAutoContinue(message) {
      this.scheduleMessageAutoContinue(
        message,
        'pendingAssistantParameterCollection',
        (targetMessage, options = {}) => this.confirmPendingAssistantParameterCollection(targetMessage, options)
      )
    },
    createPendingAssistantIntentChoice(route, text, options = {}) {
      const candidateKeys = Array.from(new Set([
        String(route?.primaryAction || '').trim(),
        ...(Array.isArray(route?.candidateActions) ? route.candidateActions : [])
      ].filter(key => this.isAssistantDrivenDocumentAction(key))))
      const choiceOptions = candidateKeys.map((key) => {
        const meta = this.getDocumentOperationChoiceOptionMeta(key)
        return {
          key,
          label: meta.label,
          apiLabel: meta.apiLabel
        }
      })
      return {
        status: 'pending',
        summaryText: options.summaryText || '已识别到可由 AI 助手处理的文档需求，请先确认要继续执行哪一种处理。',
        confirmPrompt: options.confirmPrompt || '可单选，也可多选组合成一个新的助手任务流程。',
        statusMessage: options.statusMessage || '请从下方选择要继续的处理类型。',
        autoContinueSecondsLeft: 0,
        options: choiceOptions,
        selectedKeys: choiceOptions.length > 0 ? [choiceOptions[0].key] : [],
        originalText: text,
        route,
        scope: route?.scope || 'selection-preferred'
      }
    },
    togglePendingAssistantIntentChoiceOption(message, optionKey) {
      const pending = message?.pendingAssistantIntentChoice
      if (!pending || pending.status === 'applying' || !optionKey) return
      const selected = Array.isArray(pending.selectedKeys) ? [...pending.selectedKeys] : []
      const index = selected.indexOf(optionKey)
      if (index >= 0) {
        selected.splice(index, 1)
      } else {
        selected.push(optionKey)
      }
      pending.selectedKeys = selected
      pending.statusMessage = selected.length > 0
        ? `已选择 ${selected.length} 项处理，下一步将匹配现有助手或创建新助手。`
        : '请至少选择一项处理类型。'
      this.scheduleAssistantIntentChoiceAutoContinue(message)
      this.saveHistory()
    },
    scheduleAssistantIntentChoiceAutoContinue(message) {
      this.scheduleMessageAutoContinue(
        message,
        'pendingAssistantIntentChoice',
        (targetMessage, options = {}) => this.confirmPendingAssistantIntentChoice(targetMessage, options)
      )
    },
    buildAssistantDemandFromActionKeys(actionKeys = [], text = '', route = {}) {
      const keys = Array.from(new Set((Array.isArray(actionKeys) ? actionKeys : [actionKeys]).map(item => String(item || '').trim()).filter(Boolean)))
      const scope = String(route?.scope || 'selection-preferred')
      const requirementText = String(text || '').trim()
      const revisionKeys = keys.filter(key => this.isDocumentRevisionChoiceAction(key))
      const translateIntent = detectSelectionTranslateIntent(requirementText, getAssistantSetting('translate')?.targetLanguage || '')
      const isTranslateLike = /(翻译|译成|译为|中译英|英译中)/.test(requirementText)
      const revisionIntent = revisionKeys.length > 0 ? this.buildRevisionIntentFromChoiceActions(revisionKeys, scope) : null
      const label = keys.map(key => this.getDocumentOperationChoiceOptionMeta(key).label).filter(Boolean).join('、') || '文档处理'
      const preferredAssistantIds = []
      if (revisionIntent?.assistantId) preferredAssistantIds.push(revisionIntent.assistantId)
      if (keys.includes('selection-translate') || (keys.includes('document-aware') && isTranslateLike)) preferredAssistantIds.push('translate')
      if (keys.includes('document-aware') && !isTranslateLike && /(摘要|总结|概括|提炼|要点|概述)/.test(requirementText)) preferredAssistantIds.push('summary')
      if (keys.includes('document-aware') && !isTranslateLike && /(正式|润色|改写|重写|优化)/.test(requirementText)) preferredAssistantIds.push('analysis.rewrite')
      const reportTypeHint = /周报|月报|日报|纪要|审计报告|分析报告|评估报告|报告/.test(requirementText)
        ? (requirementText.match(/(周报|月报|日报|纪要|审计报告|分析报告|评估报告|报告)/)?.[1] || '')
        : ''
      return this.finalizeAssistantDemandDocumentAction({
        kind: keys.includes('selection-translate')
          ? 'translate'
          : keys.includes('document-aware') && isTranslateLike
            ? 'translate'
          : keys.includes('document-comment')
            ? 'comment'
            : keys.includes('document-aware')
              ? 'document-aware'
              : revisionKeys.length > 0
                ? 'revision'
                : 'legacy',
        actionKeys: keys,
        route,
        scope,
        inputSource: this.resolveAssistantInputSourceByScope(scope),
        documentAction: '',
        label,
        requirementText,
        preferredAssistantIds: Array.from(new Set(preferredAssistantIds.filter(Boolean))),
        revisionIntent,
        revisionTypes: revisionIntent?.revisionTypes || [],
        targetLanguage: translateIntent?.targetLanguage || '',
        reportTypeHint
      })
    },
    finalizeAssistantDemandDocumentAction(demand) {
      if (!demand || typeof demand !== 'object') return demand
      return {
        ...demand,
        documentAction: this.getDemandAwareDefaultDocumentAction(demand, demand?.preferredAssistantIds?.[0] || '', 'insert')
      }
    },
    getAssistantDemandMissingFields(demand) {
      if (demand?.parametersConfirmed === true) return []
      const fields = [
        {
          key: 'inputSource',
          label: '文档范围',
          type: 'select',
          required: true,
          value: String(demand?.inputSource || this.resolveAssistantInputSourceByScope(demand?.scope)).trim() || 'selection-preferred',
          options: this.getAssistantInputSourceFieldOptions()
        },
        {
          key: 'documentAction',
          label: '结果写回方式',
          type: 'select',
          required: true,
          value: this.getDemandAwareDefaultDocumentAction(
            demand,
            '',
            String(demand?.documentAction || 'insert').trim() || 'insert'
          ),
          options: this.getAssistantDemandDocumentActionFieldOptions(demand)
        }
      ]
      if (demand?.kind === 'translate') {
        fields.unshift({
          key: 'targetLanguage',
          label: '目标语言',
          type: 'select',
          required: true,
          value: String(demand?.targetLanguage || '').trim() || '英文',
          options: this.getAssistantTargetLanguageOptions()
        })
      }
      if (demand?.kind === 'document-aware' && /报告/.test(String(demand?.requirementText || ''))) {
        fields.push({
          key: 'reportType',
          label: '报告类型',
          type: 'text',
          required: false,
          value: String(demand?.reportTypeHint || '').trim(),
          placeholder: '例如：周报、月报、分析报告'
        })
      }
      return fields
    },
    createPendingAssistantParameterCollection(demand, options = {}) {
      const fields = this.getAssistantDemandMissingFields(demand).map(field => ({
        ...field,
        value: field.value ?? ''
      }))
      return {
        status: 'pending',
        summaryText: options.summaryText || '继续创建或执行助手前，还需要补充少量参数。',
        confirmPrompt: options.confirmPrompt || '已根据当前语义预填参数。你可以直接确认，也可以调整后继续。',
        statusMessage: options.statusMessage || '请确认参数表单，或等待自动继续。',
        autoContinueSecondsLeft: 0,
        demand,
        fields
      }
    },
    updatePendingAssistantParameterField(message, fieldKey, value) {
      const pending = message?.pendingAssistantParameterCollection
      if (!pending || pending.status === 'applying') return
      const target = (pending.fields || []).find(item => item.key === fieldKey)
      if (!target) return
      target.value = String(value || '')
      this.scheduleAssistantParameterAutoContinue(message)
      this.saveHistory()
    },
    getAssistantRecommendationConfigByKey(key) {
      const item = this.getAssistantItemByKey(key)
      if (!item) return null
      return this.getAssistantRecommendationConfig(item)
    },
    isAssistantOptionCompatibleWithDemand(item, config, demand) {
      if (!item || item.type === 'create-custom-assistant') return false
      if (item.modelType && item.modelType !== 'chat') return false
      const requirementText = String(demand?.requirementText || '')
      if (demand?.kind === 'translate') {
        if (item.key === 'translate') return true
        return /(翻译|本地化|译文)/.test(`${item.label} ${item.description} ${config?.systemPrompt || ''} ${config?.userPromptTemplate || ''}`)
      }
      if (demand?.kind === 'revision') {
        const revisionType = String(demand?.revisionIntent?.revisionType || '').trim()
        const isDirectRewriteLikeRequest = /(修改|修正|纠正|改成|改为|直接改|替换原文|全文错别字|修订)/.test(requirementText)
        if (item.key === 'spell-check') {
          return revisionType === 'proofread' && !isDirectRewriteLikeRequest
        }
        if (['analysis.correct-spell', 'analysis.rewrite', 'analysis.formalize', 'analysis.polish', 'analysis.term-unify'].includes(item.key)) return true
        return /(修订|纠错|润色|改写|正式|术语|病句|错别字|歧义)/.test(`${item.label} ${item.description} ${config?.systemPrompt || ''} ${requirementText}`)
      }
      if (demand?.kind === 'comment') {
        return /(批注|注释|comment)/i.test(`${item.label} ${item.description} ${config?.systemPrompt || ''} ${config?.userPromptTemplate || ''}`)
      }
      return true
    },
    createAssistantExecutionOption(item, demand, reasonText = '') {
      const config = this.getAssistantRecommendationConfig(item)
      if (!this.isAssistantOptionCompatibleWithDemand(item, config, demand)) return null
      const featureLines = [
        `处理范围：${this.getAssistantInputSourceLabel(config?.inputSource || demand?.inputSource || 'selection-preferred')}`,
        `写回方式：${this.getAssistantDocumentActionLabel(config?.documentAction || demand?.documentAction || 'insert')}`
      ]
      if (item.type === 'custom-assistant' && this.getAssistantListCreatedAt(item)) {
        featureLines.push(`创建时间：${this.getAssistantListCreatedAt(item)}`)
      }
      if (String(config?.targetLanguage || demand?.targetLanguage || '').trim()) {
        featureLines.push(`目标语言：${String(config?.targetLanguage || demand?.targetLanguage).trim()}`)
      }
      return {
        assistantId: item.key,
        label: item.shortLabel || item.label || '智能助手',
        title: item.label || item.shortLabel || '智能助手',
        description: String(item.description || config?.description || config?.persona || '可基于当前需求直接执行。').trim(),
        source: item.type,
        reasonText: reasonText || '匹配当前需求',
        featureLines
      }
    },
    resolveAssistantOptionsForDemand(demand) {
      this.loadAssistantItems()
      const results = []
      const seen = new Set()
      const pushByKey = (key, reasonText) => {
        const item = this.getAssistantItemByKey(key)
        if (!item || seen.has(item.key)) return
        const option = this.createAssistantExecutionOption(item, demand, reasonText)
        if (!option) return
        seen.add(item.key)
        results.push(option)
      }
      ;(demand?.preferredAssistantIds || []).forEach(key => pushByKey(key, '与当前处理类型高度匹配'))
      this.getAssistantRecommendations(demand?.requirementText || '', {
        limit: 6,
        allowFallback: false,
        minScore: 4
      }).forEach((recommendation) => {
        pushByKey(recommendation.key, recommendation.reasonText || '与当前需求语义匹配')
      })
      return results.slice(0, 4)
    },
    buildAssistantConfigSummary(config = {}) {
      return [
        config.description ? `功能说明：${config.description}` : '',
        config.persona ? `角色设定：${config.persona}` : '',
        config.systemPrompt ? `系统要求：${String(config.systemPrompt).replace(/\s+/g, ' ').slice(0, 140)}` : '',
        config.userPromptTemplate ? `执行模板：${String(config.userPromptTemplate).replace(/\s+/g, ' ').slice(0, 140)}` : ''
      ].filter(Boolean).join('\n')
    },
    isAssistantRepairRequest(text = '') {
      const normalized = String(text || '').trim()
      if (!normalized) return false
      return /(修复|修一下|修正|纠正|优化|升级).{0,12}(助手|智能助手)/.test(normalized)
    },
    isAssistantVersionPromotionRequest(text = '') {
      const normalized = String(text || '').trim()
      if (!normalized) return false
      return /(设为默认|设成默认|晋升|提升为默认|推广).{0,18}(助手|版本)|把.{0,24}(助手|版本).{0,8}(设为默认|设成默认)/.test(normalized)
    },
    isAssistantVersionRollbackRequest(text = '') {
      const normalized = String(text || '').trim()
      if (!normalized) return false
      return /(回滚|恢复到|还原到|退回到).{0,24}(版本|助手)/.test(normalized)
    },
    resolveNamedCustomAssistant(text = '') {
      const candidates = this.resolveNamedCustomAssistantCandidates(text)
      return candidates.length === 1 ? candidates[0].assistant : null
    },
    resolveNamedCustomAssistantCandidates(text = '') {
      const normalized = String(text || '').trim()
      if (!normalized) return []
      const compactText = normalized.toLowerCase().replace(/\s+/g, '')
      const assistants = getCustomAssistants().filter(item => String(item?.name || '').trim())
      return assistants
        .map((assistant) => {
          const name = String(assistant?.name || '').trim()
          const compactName = name.toLowerCase().replace(/\s+/g, '')
          let score = 0
          if (normalized.includes(name)) score += 10
          if (compactName && compactText.includes(compactName)) score += 8
          const nameTokens = name.match(/[\u4e00-\u9fa5a-z0-9]{1,}/ig) || []
          nameTokens.forEach((token) => {
            if (compactText.includes(String(token).toLowerCase())) score += 2
          })
          const description = String(assistant?.description || assistant?.persona || '').trim()
          if (description && normalized.includes(description.slice(0, Math.min(8, description.length)))) score += 1
          return {
            assistant,
            score
          }
        })
        .filter(item => item.score > 0)
        .sort((left, right) => right.score - left.score || String(left.assistant?.name || '').length - String(right.assistant?.name || '').length)
        .slice(0, 3)
    },
    extractRequestedVersionText(text = '') {
      const matched = String(text || '').match(/\b\d+\.\d+\.\d+\b/)
      return matched?.[0] || ''
    },
    resolveRepairTargetAssistant(text = '') {
      return this.resolveNamedCustomAssistant(text)
    },
    buildAssistantRepairEvidence(text = '', assistant = null) {
      return {
        userRequirement: String(text || '').trim(),
        assistantSummary: assistant ? this.buildAssistantConfigSummary(assistant) : '',
        recentTranscript: this.currentMessages
          .slice(-6)
          .map((msg) => `${msg?.role === 'assistant' ? '助手' : '用户'}：${String(msg?.content || '').trim()}`)
          .filter(Boolean)
          .join('\n')
      }
    },
    buildAssistantVersionEvaluationSamples(text = '', options = {}) {
      return buildAssistantEvaluationSamples({
        requirementText: text,
        recentTranscript: this.currentMessages
          .slice(-6)
          .map((msg) => `${msg?.role === 'assistant' ? '助手' : '用户'}：${String(msg?.content || '').trim()}`)
          .filter(Boolean)
          .join('\n'),
        baseline: options.baseline || {},
        sourceAssistants: Array.isArray(options.sourceAssistants) ? options.sourceAssistants : [],
        documentAction: options.documentAction,
        inputSource: options.inputSource,
        targetLanguage: options.targetLanguage,
        outputFormat: options.outputFormat
      })
    },
    async buildAssistantVersionRealComparison(text = '', options = {}) {
      const samples = Array.isArray(options.samples) && options.samples.length > 0
        ? options.samples
        : this.buildAssistantVersionEvaluationSamples(text, options)
      return buildAssistantRealComparison({
        baseline: options.baseline || {},
        candidate: options.candidate || {},
        model: this.selectedModel,
        samples,
        maxSamples: options.maxSamples || 3
      })
    },
    summarizeAssistantComparisonResults(results = []) {
      return (Array.isArray(results) ? results : [])
        .slice(0, 3)
        .map((item) => `${item.label}：旧版「${item.baselineOutput || '无输出'}」；新版「${item.candidateOutput || '无输出'}」`)
    },
    createPendingAssistantRepairChoice(text = '', assistantOptions = []) {
      return {
        status: 'pending',
        summaryText: '检测到修复助手请求，但匹配到了多个候选助手，请先选择一个修复目标。',
        confirmPrompt: '确认后会基于所选助手生成修复草案，并先展示真实对比样本预览。',
        statusMessage: '请先选择一个最接近当前问题的助手。',
        demandText: String(text || '').trim(),
        assistantOptions,
        selectedAssistantId: assistantOptions[0]?.assistantId || ''
      }
    },
    selectPendingAssistantRepairChoice(message, assistantId) {
      const pending = message?.pendingAssistantRepairChoice
      if (!pending || pending.status === 'applying') return
      pending.selectedAssistantId = String(assistantId || '')
      this.saveHistory()
    },
    applyAssistantVersionGovernanceRequest(message, text = '') {
      const targetAssistant = this.resolveNamedCustomAssistant(text)
      if (!targetAssistant) {
        this.showAssistantTaskClarificationNeed(message, text)
        return true
      }
      try {
        if (this.isAssistantVersionPromotionRequest(text)) {
          const familyVersions = listAssistantVersionFamily(targetAssistant.id)
          const requestedVersion = this.extractRequestedVersionText(text)
          const targetVersion = requestedVersion
            ? familyVersions.find(item => String(item?.version || '').trim() === requestedVersion)
            : listAssistantVersions(targetAssistant.id)
              .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0]
          if (!targetVersion) {
            this.finalizeRouteResolutionPrompt(
              message,
              `已识别到版本晋升需求，但没有找到《${targetAssistant.name}》可晋升的版本记录。`
            )
            return true
          }
          const promoted = promoteAssistantVersion(targetVersion.versionId)
          this.loadAssistantItems()
          this.finalizeRouteResolutionPrompt(
            message,
            `已将《${targetAssistant.name}》的版本 ${promoted?.version || targetVersion.version} 设为默认推荐版本。`
          )
          return true
        }
        if (this.isAssistantVersionRollbackRequest(text)) {
          const requestedVersion = this.extractRequestedVersionText(text)
          const versions = listAssistantVersions(targetAssistant.id)
            .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
          const targetVersion = requestedVersion
            ? versions.find(item => String(item?.version || '').trim() === requestedVersion)
            : versions[0]
          if (!targetVersion) {
            this.finalizeRouteResolutionPrompt(
              message,
              `已识别到版本回滚需求，但没有找到《${targetAssistant.name}》的可回滚版本记录。`
            )
            return true
          }
          const restored = restoreAssistantVersion(targetVersion.versionId)
          this.loadAssistantItems()
          this.finalizeRouteResolutionPrompt(
            message,
            `已将《${targetAssistant.name}》回滚到版本 ${targetVersion.version}。${restored?.benchmarkScore != null ? ` 当前记录得分 ${restored.benchmarkScore}。` : ''}`
          )
          return true
        }
      } catch (error) {
        this.finalizeRouteResolutionPrompt(message, `[错误] ${this.formatAssistantTaskError(error?.message || '助手版本治理失败')}`)
        return true
      }
      return false
    },
    createPendingAssistantRepairDraft(text = '', assistant = null) {
      const targetAssistant = assistant || this.resolveRepairTargetAssistant(text)
      if (!targetAssistant) return null
      const requirementText = [
        `请修复自定义助手“${targetAssistant.name}”。`,
        `当前用户要求：${String(text || '').trim()}`,
        '请结合当前助手配置和失败表现，输出一个更稳定的新版本助手配置。'
      ].join('\n')
      return {
        status: 'pending',
        mode: 'repair',
        summaryText: `已识别到“修复助手”需求，将基于《${targetAssistant.name}》生成一个保留旧版本的新修复版助手。`,
        confirmPrompt: '确认后会先生成修复草案与版本候选，再保存为新的自定义助手版本并立即执行。',
        statusMessage: '请确认名称与修复要求，随后进入修复发布流程。',
        autoContinueSecondsLeft: 0,
        demand: {
          label: `${targetAssistant.name} 修复`,
          requirementText,
          inputSource: targetAssistant.inputSource || 'selection-preferred',
          documentAction: targetAssistant.documentAction || 'insert',
          targetLanguage: targetAssistant.targetLanguage || '中文'
        },
        sourceAssistantId: targetAssistant.id,
        assistantName: `${String(targetAssistant.name || '自定义助手').trim()}（修复版）`,
        description: `基于《${targetAssistant.name}》修复生成的新版本助手`,
        requirementText,
        previewResults: [],
        baseDraft: {
          ...createCustomAssistantDraft(),
          ...targetAssistant,
          version: this.getNextAssistantVersion(targetAssistant.version || getLatestAssistantVersion(targetAssistant.id)?.version || '1.0.0'),
          parentAssistantIds: [targetAssistant.id],
          isPromoted: false
        }
      }
    },
    async enrichPendingAssistantRepairDraft(draft, assistant, text = '') {
      if (!draft || !assistant) return draft
      try {
        const repairDraft = await buildAssistantRepairDraft({
          assistant,
          evidence: this.buildAssistantRepairEvidence(text, assistant),
          model: this.selectedModel
        })
        draft.description = String(repairDraft?.candidate?.description || draft.description || '').trim()
        draft.baseDraft = {
          ...(draft.baseDraft || {}),
          ...(repairDraft?.candidate || {}),
          repairReason: String(repairDraft?.repairReason || '').trim(),
          parentAssistantIds: [assistant.id],
          isPromoted: false
        }
        draft.requirementText = [
          String(draft.requirementText || '').trim(),
          Array.isArray(repairDraft?.diffSummary) && repairDraft.diffSummary.length > 0
            ? `\n建议改动预览：\n- ${repairDraft.diffSummary.join('\n- ')}`
            : ''
        ].filter(Boolean).join('\n')
        draft.statusMessage = repairDraft?.repairReason
          ? `修复原因：${repairDraft.repairReason}`
          : '已生成修复草案，请确认后发布为新版本。'
        const previewComparison = await this.buildAssistantVersionRealComparison(text, {
          baseline: assistant,
          candidate: draft.baseDraft,
          sourceAssistants: [assistant],
          documentAction: draft.baseDraft?.documentAction,
          inputSource: draft.baseDraft?.inputSource,
          targetLanguage: draft.baseDraft?.targetLanguage,
          outputFormat: draft.baseDraft?.outputFormat
        })
        draft.previewResults = Array.isArray(previewComparison?.results) ? previewComparison.results : []
        if (draft.previewResults.length > 0) {
          draft.statusMessage = [
            draft.statusMessage,
            `已生成 ${draft.previewResults.length} 个真实对比样本，请先查看旧版/新版差异再确认发布。`
          ].filter(Boolean).join(' ')
        }
      } catch (error) {
        draft.statusMessage = error?.message || '未能提前生成修复草案，可继续手动确认修复需求。'
      }
      return draft
    },
    suggestAssistantDraftName(demand, fallbackName = '') {
      if (String(fallbackName || '').trim()) {
        return `${String(fallbackName).trim()}增强版`
      }
      if (demand?.kind === 'translate') {
        return `文档翻译到${String(demand.targetLanguage || '目标语言').trim()}`
      }
      if (demand?.kind === 'comment') return '文档智能批注'
      if (demand?.kind === 'document-aware') return String(demand.reportTypeHint || '整篇文档处理')
      return String(demand?.label || '自定义智能助手').trim()
    },
    createPendingAssistantExecutionChoice(demand, assistantOptions = [], options = {}) {
      return {
        status: 'pending',
        summaryText: options.summaryText || `已找到可处理“${demand?.label || '当前需求'}”的助手，请确认是否执行。`,
        confirmPrompt: options.confirmPrompt || '先选择一个最合适的助手；确认后还会让你选择处理完成后的具体动作，例如替换原文、插入当前位置或仅生成结果。',
        statusMessage: options.statusMessage || '请先选择一个助手，再确认后续处理动作。',
        autoContinueLabel: options.autoContinueLabel || '未选择则改由大模型直接输出',
        autoContinueSecondsLeft: 0,
        demand,
        assistantOptions,
        selectedAssistantId: assistantOptions[0]?.assistantId || ''
      }
    },
    shouldTryAssistantFirstExecution(text) {
      const normalized = String(text || '').trim()
      if (!normalized) return false
      return EXPLICIT_ASSISTANT_REQUEST_PATTERN.test(normalized)
    },
    isExplicitAssistantCreationRequest(text = '') {
      const normalized = String(text || '').trim()
      if (!normalized) return false
      return /(创建|新建|生成|做一个|配置一个).{0,8}(助手|智能助手|自定义助手)/.test(normalized)
    },
    createGeneralAssistantDemand(text, assistantKeys = []) {
      return {
        kind: 'general',
        label: '助手执行',
        requirementText: String(text || '').trim(),
        inputSource: 'selection-preferred',
        documentAction: 'insert',
        preferredAssistantIds: Array.from(new Set((assistantKeys || []).map(item => String(item || '').trim()).filter(Boolean))),
        route: null,
        scope: 'selection-preferred'
      }
    },
    selectPendingAssistantExecutionOption(message, assistantId) {
      const pending = message?.pendingAssistantExecutionChoice
      if (!pending || pending.status === 'applying') return
      pending.selectedAssistantId = String(assistantId || '')
      this.scheduleAssistantExecutionChoiceAutoContinue(message)
      this.saveHistory()
    },
    createPendingAssistantCreationDraft(demand, options = {}) {
      const inheritedAssistant = options.inheritedAssistant || null
      const baseDraft = {
        ...createCustomAssistantDraft(),
        inputSource: demand?.inputSource || 'selection-preferred',
        documentAction: demand?.documentAction || 'insert',
        targetLanguage: demand?.targetLanguage || '中文'
      }
      if (String(demand?.reportTypeHint || '').trim()) {
        baseDraft.reportSettings = {
          ...baseDraft.reportSettings,
          enabled: true,
          type: 'custom',
          customType: String(demand.reportTypeHint || '').trim()
        }
      }
      const inheritedRequirements = inheritedAssistant
        ? this.buildAssistantConfigSummary(this.getAssistantRecommendationConfigByKey(inheritedAssistant.assistantId) || {})
        : ''
      return {
        status: 'pending',
        mode: options.mode || 'create',
        summaryText: inheritedAssistant
          ? `不执行“${inheritedAssistant.label}”，改为基于当前要求创建新的自定义助手。`
          : '当前没有完全匹配的助手，将自动创建一个新的自定义助手。',
        confirmPrompt: '你可以修改下方要求，确认后会自动创建助手并立即执行。',
        statusMessage: '确认名称与要求后，即可自动创建并执行。',
        autoContinueSecondsLeft: 0,
        demand,
        inheritedAssistantId: inheritedAssistant?.assistantId || '',
        sourceAssistantId: options.sourceAssistantId || '',
        assistantName: options.assistantName || this.suggestAssistantDraftName(demand, inheritedAssistant?.label),
        description: options.description || `${demand?.label || '文档处理'}助手`,
        baseAssistantRequirements: inheritedRequirements,
        currentUserRequirements: String(demand?.requirementText || '').trim(),
        requirementText: inheritedRequirements
          ? `请创建一个新的自定义智能助手，并参考以下已有助手要求：\n${inheritedRequirements}\n\n当前用户要求：\n${String(demand?.requirementText || '').trim()}`
          : `请创建一个新的自定义智能助手，用于处理以下需求：\n${String(demand?.requirementText || '').trim()}`,
        baseDraft
      }
    },
    updatePendingAssistantCreationDraftField(message, field, value) {
      const pending = message?.pendingAssistantCreationDraft
      if (!pending || pending.status === 'applying') return
      pending[field] = String(value || '')
      this.scheduleAssistantCreationDraftAutoContinue(message)
      this.saveHistory()
    },
    async advanceAssistantDemandFlow(message, demand) {
      this.clearAssistantFirstPendingStates(message)
      const assistantOptions = this.resolveAssistantOptionsForDemand(demand)
      if (assistantOptions.length > 0) {
        message.content = '已匹配到可用助手。为减少等待，本轮先直接使用大模型输出结果；你也可以在助手列表中手动执行对应助手。'
        this.saveHistory()
        this.$nextTick(() => this.scrollToBottom())
        return
      }
      message.content = '当前没有匹配到可直接执行的助手。本轮已自动切换为大模型对话处理，结果会直接输出到对话框。'
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
      return
    },
    createPendingDocumentOperationChoice(route, text, options = {}) {
      const candidateKeys = Array.from(new Set([
        String(route?.primaryAction || '').trim(),
        ...(Array.isArray(route?.candidateActions) ? route.candidateActions : [])
      ].filter(Boolean)))
      const choiceOptions = candidateKeys
        .map((key) => {
          const meta = this.getDocumentOperationChoiceOptionMeta(key)
          return {
            key,
            label: meta.label,
            apiLabel: meta.apiLabel,
            supported: meta.supported
          }
        })
        .filter(item => item.supported !== false)
      return {
        status: 'pending',
        summaryText: options.summaryText || '已识别到文档操作，请确认接下来要继续执行哪一种处理。',
        confirmPrompt: options.confirmPrompt || (route?.reason
          ? `模型判断：${route.reason}。可单选，也可多选后继续处理文档。`
          : '可单选，也可多选后继续处理文档。'),
        statusMessage: options.statusMessage || (route?.reason
          ? `模型判断：${route.reason} 请从下方选择要调用的处理能力。`
          : '模型已识别到可能的文档操作，请从下方选择要调用的处理能力。'),
        autoContinueSecondsLeft: 0,
        options: choiceOptions,
        selectedKeys: choiceOptions.length > 0 ? [choiceOptions[0].key] : [],
        originalText: text,
        route,
        scope: route?.scope || 'selection-preferred'
      }
    },
    togglePendingDocumentOperationChoiceOption(message, optionKey) {
      const pending = message?.pendingDocumentOperationChoice
      if (!pending || pending.status === 'applying' || !optionKey) return
      const selected = Array.isArray(pending.selectedKeys) ? [...pending.selectedKeys] : []
      const index = selected.indexOf(optionKey)
      if (index >= 0) {
        selected.splice(index, 1)
      } else {
        selected.push(optionKey)
      }
      pending.selectedKeys = selected
      pending.statusMessage = selected.length > 0
        ? `已选择 ${selected.length} 项操作，确认后继续处理。`
        : '请至少选择一项操作。'
      this.scheduleDocumentOperationChoiceAutoContinue(message)
      this.saveHistory()
    },
    scheduleAssistantExecutionChoiceAutoContinue(message) {
      this.scheduleMessageAutoContinue(
        message,
        'pendingAssistantExecutionChoice',
        (targetMessage, options = {}) => this.confirmPendingAssistantExecutionChoice(targetMessage, options)
      )
    },
    scheduleAssistantCreationDraftAutoContinue(message) {
      this.scheduleMessageAutoContinue(
        message,
        'pendingAssistantCreationDraft',
        (targetMessage, options = {}) => this.confirmPendingAssistantCreationDraft(targetMessage, options)
      )
    },
    scheduleDocumentOperationChoiceAutoContinue(message) {
      this.scheduleMessageAutoContinue(
        message,
        'pendingDocumentOperationChoice',
        (targetMessage, options = {}) => this.confirmPendingDocumentOperationChoice(targetMessage, options)
      )
    },
    async confirmPendingAssistantIntentChoice(message, options = {}) {
      const pending = message?.pendingAssistantIntentChoice
      if (!pending || pending.status === 'applying') return
      this.clearAssistantParameterAutoContinue(message?.id)
      const selectedKeys = Array.from(new Set((pending.selectedKeys || []).map(item => String(item || '').trim()).filter(Boolean)))
      if (selectedKeys.length === 0) {
        pending.statusMessage = '请至少选择一项处理类型。'
        this.saveHistory()
        return
      }
      pending.status = 'applying'
      pending.statusMessage = options.autoTriggered === true ? '已按当前选择自动继续匹配助手...' : '正在根据所选处理匹配现有助手...'
      this.saveHistory()
      const demand = this.buildAssistantDemandFromActionKeys(selectedKeys, pending.originalText || '', pending.route || {})
      await this.advanceAssistantDemandFlow(message, demand)
    },
    cancelPendingAssistantIntentChoice(message) {
      const pending = message?.pendingAssistantIntentChoice
      if (!pending || pending.status === 'applying') return
      this.clearAssistantParameterAutoContinue(message?.id)
      message.pendingAssistantIntentChoice = null
      if (!String(message.content || '').trim()) {
        message.content = '已取消本次助手处理选择。'
      }
      this.saveHistory()
    },
    async confirmPendingAssistantParameterCollection(message, options = {}) {
      const pending = message?.pendingAssistantParameterCollection
      if (!pending || pending.status === 'applying') return
      this.clearAssistantParameterAutoContinue(message?.id)
      const missing = (pending.fields || []).filter(field => field.required !== false && !String(field.value || '').trim())
      if (missing.length > 0) {
        pending.statusMessage = `请先填写：${missing.map(item => item.label).join('、')}`
        this.saveHistory()
        return
      }
      pending.status = 'applying'
      pending.statusMessage = options.autoTriggered === true
        ? '已按当前表单自动继续处理...'
        : '正在应用当前表单配置...'
      const nextDemand = {
        ...(pending.demand || {}),
        parametersConfirmed: true
      }
      ;(pending.fields || []).forEach((field) => {
        nextDemand[field.key] = String(field.value || '').trim()
      })
      if (nextDemand.reportType) {
        nextDemand.reportTypeHint = nextDemand.reportType
      }
      if (String(pending.executionAssistantId || '').trim()) {
        const executionAssistantId = String(pending.executionAssistantId || '').trim()
        this.clearAssistantFirstPendingStates(message)
        const mediaOptions = {
          aspectRatio: String(nextDemand.aspectRatio || '').trim(),
          duration: String(nextDemand.duration || '').trim(),
          voiceStyle: String(nextDemand.voiceStyle || '').trim()
        }
        await this.runAssistantTaskFromMessage(message, executionAssistantId, {
          requirementText: nextDemand.requirementText,
          inputSource: nextDemand.inputSource,
          documentAction: nextDemand.documentAction,
          targetLanguage: nextDemand.targetLanguage,
          reportSettings: nextDemand.reportSettings,
          mediaOptions
        })
        return
      }
      await this.advanceAssistantDemandFlow(message, nextDemand)
    },
    cancelPendingAssistantParameterCollection(message) {
      const pending = message?.pendingAssistantParameterCollection
      if (!pending || pending.status === 'applying') return
      this.clearAssistantParameterAutoContinue(message?.id)
      message.pendingAssistantParameterCollection = null
      if (!String(message.content || '').trim()) {
        message.content = '已取消参数补充。'
      }
      this.saveHistory()
    },
    getSelectedAssistantExecutionOption(pending) {
      const selectedAssistantId = String(pending?.selectedAssistantId || '')
      return (pending?.assistantOptions || []).find(item => item.assistantId === selectedAssistantId) || pending?.assistantOptions?.[0] || null
    },
    async confirmPendingAssistantRepairChoice(message) {
      const pending = message?.pendingAssistantRepairChoice
      if (!pending || pending.status === 'applying') return
      const selectedOption = this.getSelectedAssistantExecutionOption(pending)
      if (!selectedOption?.assistantId) {
        pending.statusMessage = '请先选择一个助手。'
        this.saveHistory()
        return
      }
      pending.status = 'applying'
      pending.statusMessage = '正在生成该助手的修复草案...'
      this.saveHistory()
      const targetAssistant = getCustomAssistantById(selectedOption.assistantId)
      if (!targetAssistant) {
        pending.status = 'failed'
        pending.statusMessage = '未找到所选助手，无法继续修复。'
        this.saveHistory()
        return
      }
      message.pendingAssistantRepairChoice = null
      message.pendingAssistantCreationDraft = await this.enrichPendingAssistantRepairDraft(
        this.createPendingAssistantRepairDraft(pending.demandText || '', targetAssistant),
        targetAssistant,
        pending.demandText || ''
      )
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
    },
    cancelPendingAssistantRepairChoice(message) {
      const pending = message?.pendingAssistantRepairChoice
      if (!pending || pending.status === 'applying') return
      message.pendingAssistantRepairChoice = null
      if (!String(message.content || '').trim()) {
        message.content = '已取消本次助手修复选择。'
      }
      this.saveHistory()
    },
    async runAssistantTaskFromMessage(message, assistantId, options = {}) {
      const assistantItem = this.getAssistantItemByKey(assistantId) || {
        key: assistantId,
        label: getCustomAssistantById(assistantId)?.name || '智能助手',
        shortLabel: getCustomAssistantById(assistantId)?.name || '智能助手'
      }
      const taskTitle = assistantItem.shortLabel || assistantItem.label || '智能助手'
      const savedCfg = this.getAssistantRecommendationConfigByKey(assistantId) || {}
      const effectiveInputSource = String(options.inputSource || savedCfg.inputSource || '').trim()
      const effectiveDocumentAction = String(options.documentAction || savedCfg.documentAction || '').trim()
      const effectiveTargetLanguage = String(options.targetLanguage || savedCfg.targetLanguage || '').trim()
      const overrides = {
        taskTitle,
        ...this.getConversationModelTaskOverrides(),
        taskData: {
          fromChatAssistantFlow: true,
          originMessageId: message?.id || '',
          originRequirementText: String(options.requirementText || '').trim(),
          assistantVersion: String(options.assistantVersion || '').trim(),
          benchmarkScore: Number.isFinite(Number(options.benchmarkScore)) ? Number(options.benchmarkScore) : null,
          evaluation: options.evaluation && typeof options.evaluation === 'object'
            ? JSON.parse(JSON.stringify(options.evaluation))
            : null
        }
      }
      if (effectiveInputSource) overrides.inputSource = effectiveInputSource
      if (effectiveDocumentAction) overrides.documentAction = effectiveDocumentAction
      if (effectiveTargetLanguage) overrides.targetLanguage = effectiveTargetLanguage
      if (options.reportSettings) overrides.reportSettings = options.reportSettings
      if (options.mediaOptions && typeof options.mediaOptions === 'object') {
        overrides.mediaOptions = {
          ...(savedCfg.mediaOptions && typeof savedCfg.mediaOptions === 'object' ? savedCfg.mediaOptions : {}),
          ...options.mediaOptions
        }
      }
      const { taskId, promise } = startAssistantTask(assistantId, overrides)
      if (!taskId) {
        throw new Error('助手任务启动失败，未能创建任务')
      }
      message.isLoading = true
      message.content = `已开始执行助手“${taskTitle}”，可在当前消息或任务进度窗口中查看状态。`
      message.activeAssistantTaskRun = {
        taskId,
        status: 'running',
        summaryText: `正在执行“${taskTitle}”...`,
        statusMessage: '助手任务已启动，正在准备处理内容...',
        showDetails: false,
        details: []
      }
      this.appendDocumentRevisionDetail(message.activeAssistantTaskRun, `已启动助手“${taskTitle}”。`)
      this.openDialogRoute(
        '/task-progress-dialog',
        { taskId },
        taskTitle,
        520,
        260
      )
      promise.catch((error) => {
        if (error?.code === 'TASK_CANCELLED') return
        console.warn('聊天助手任务执行失败:', error)
      })
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
    },
    async confirmPendingAssistantExecutionChoice(message, options = {}) {
      const pending = message?.pendingAssistantExecutionChoice
      if (!pending || pending.status === 'applying') return
      this.clearAssistantParameterAutoContinue(message?.id)
      const selectedOption = this.getSelectedAssistantExecutionOption(pending)
      if (!selectedOption?.assistantId) {
        pending.statusMessage = '请先选择一个助手。'
        this.saveHistory()
        return
      }
      pending.status = 'applying'
      pending.statusMessage = options.autoTriggered === true ? '已按当前选择自动继续执行该助手...' : '正在准备该助手的处理动作配置...'
      this.saveHistory()
      message.pendingAssistantExecutionChoice = null
      message.pendingAssistantParameterCollection = this.createPendingAssistantExecutionParameterCollection(
        pending.demand,
        selectedOption
      )
      this.scheduleAssistantParameterAutoContinue(message)
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
    },
    declinePendingAssistantExecutionChoice(message) {
      const pending = message?.pendingAssistantExecutionChoice
      if (!pending || pending.status === 'applying') return
      this.clearAssistantParameterAutoContinue(message?.id)
      const selectedOption = this.getSelectedAssistantExecutionOption(pending)
      message.pendingAssistantExecutionChoice = null
      message.pendingAssistantCreationDraft = this.createPendingAssistantCreationDraft(pending.demand, {
        inheritedAssistant: selectedOption
      })
      this.scheduleAssistantCreationDraftAutoContinue(message)
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
    },
    cancelPendingAssistantExecutionChoice(message) {
      const pending = message?.pendingAssistantExecutionChoice
      if (!pending || pending.status === 'applying') return
      this.clearAssistantParameterAutoContinue(message?.id)
      message.pendingAssistantExecutionChoice = null
      if (!String(message.content || '').trim()) {
        message.content = '已取消本次助手执行确认。'
      }
      this.saveHistory()
    },
    async confirmPendingAssistantCreationDraft(message, options = {}) {
      const pending = message?.pendingAssistantCreationDraft
      if (!pending || pending.status === 'applying') return
      this.clearAssistantParameterAutoContinue(message?.id)
      const assistantName = String(pending.assistantName || '').trim()
      const requirementText = String(pending.requirementText || '').trim()
      if (!assistantName) {
        pending.statusMessage = '请先填写助手名称。'
        this.saveHistory()
        return
      }
      if (!requirementText) {
        pending.statusMessage = '请先填写或确认助手要求。'
        this.saveHistory()
        return
      }
      pending.status = 'applying'
      pending.statusMessage = options.autoTriggered === true
        ? '已按当前草稿自动继续处理助手版本...'
        : (pending.mode === 'repair' ? '正在生成修复草案并保存新版本助手...' : '正在生成并保存新的自定义助手...')
      this.saveHistory()
      try {
        const taskTitle = `创建助手：${assistantName}`
        const draftSnapshot = {
          ...createCustomAssistantDraft(),
          ...(pending.baseDraft || {}),
          name: assistantName,
          description: String(pending.description || '').trim()
        }
        const nextList = getCustomAssistants()
        const now = new Date().toISOString()
        let appliedConfig = {}
        let evaluation = null
        let realComparison = { results: [] }
        if (pending.mode === 'repair') {
          const sourceAssistant = getCustomAssistantById(pending.sourceAssistantId)
          if (!sourceAssistant) {
            throw new Error('未找到待修复的源助手')
          }
          const repairDraft = await buildAssistantRepairDraft({
            assistant: sourceAssistant,
            evidence: this.buildAssistantRepairEvidence(requirementText, sourceAssistant),
            model: this.selectedModel
          })
          appliedConfig = repairDraft?.candidate || {}
          draftSnapshot.repairReason = repairDraft?.repairReason || ''
          draftSnapshot.parentAssistantIds = [sourceAssistant.id]
        } else {
          const { taskId, promise } = startAssistantPromptRecommendationTask({
            requirementText,
            draftSnapshot,
            taskTitle,
            targetKey: 'create-custom-assistant',
            targetLabel: assistantName,
            resolvedModelState: {
              model: this.selectedModel,
              source: 'chat-assistant-first'
            }
          })
          if (taskId) {
            this.openDialogRoute('/task-progress-dialog', { taskId }, taskTitle, 520, 260)
          }
          const result = await promise
          appliedConfig = result?.appliedConfig || {}
        }
        const savedAssistant = {
          ...draftSnapshot,
          ...appliedConfig,
          id: buildCustomAssistantId(assistantName),
          name: assistantName,
          description: String(pending.description || appliedConfig?.description || '').trim(),
          displayLocations: ['ribbon-more'],
          visibleInRibbon: true,
          sortOrder: nextList.length,
          createdAt: now,
          updatedAt: now,
          version: String(draftSnapshot.version || '1.0.0').trim() || '1.0.0',
          repairReason: String(draftSnapshot.repairReason || '').trim(),
          parentAssistantIds: Array.isArray(draftSnapshot.parentAssistantIds) ? draftSnapshot.parentAssistantIds : []
        }
        if (pending.mode !== 'repair') {
          evaluation = evaluateAssistantCandidate(savedAssistant, {
            baseline: pending.baseDraft || {},
            samples: this.buildAssistantVersionEvaluationSamples(requirementText, {
              baseline: pending.baseDraft || {},
              documentAction: savedAssistant.documentAction,
              inputSource: savedAssistant.inputSource,
              targetLanguage: savedAssistant.targetLanguage,
              outputFormat: savedAssistant.outputFormat
            })
          })
          if (evaluation?.releaseGate?.allowed === false) {
            throw new Error(evaluation.releaseGate.reason || '当前助手版本未通过发布门禁，请先补齐评测后再发布。')
          }
          savedAssistant.benchmarkScore = evaluation.totalScore
          savedAssistant.releaseGate = evaluation.releaseGate || null
          appendAssistantVersion({
            assistantId: savedAssistant.id,
            version: savedAssistant.version,
            sourceAssistantIds: savedAssistant.parentAssistantIds,
            benchmarkScore: evaluation.totalScore,
            isPromoted: savedAssistant.isPromoted === true,
            changeSummary: '创建新的自定义助手版本',
            evaluation,
            snapshot: savedAssistant
          })
        }
        if (pending.mode === 'repair') {
          const sourceAssistant = getCustomAssistantById(pending.sourceAssistantId) || {}
          realComparison = await this.buildAssistantVersionRealComparison(requirementText, {
            baseline: sourceAssistant,
            candidate: savedAssistant,
            sourceAssistants: [sourceAssistant],
            documentAction: savedAssistant.documentAction,
            inputSource: savedAssistant.inputSource,
            targetLanguage: savedAssistant.targetLanguage,
            outputFormat: savedAssistant.outputFormat
          })
          evaluation = evaluateAssistantCandidate(savedAssistant, {
            baseline: sourceAssistant,
            samples: this.buildAssistantVersionEvaluationSamples(requirementText, {
              baseline: sourceAssistant,
              sourceAssistants: [sourceAssistant],
              documentAction: savedAssistant.documentAction,
              inputSource: savedAssistant.inputSource,
              targetLanguage: savedAssistant.targetLanguage,
              outputFormat: savedAssistant.outputFormat
            }),
            realComparisonResults: realComparison.results
          })
          if (evaluation?.releaseGate?.allowed === false) {
            throw new Error(evaluation.releaseGate.reason || '当前修复版本未通过发布门禁，请根据真实对比结果继续修复。')
          }
          savedAssistant.benchmarkScore = evaluation.totalScore
          savedAssistant.releaseGate = evaluation.releaseGate || null
          appendAssistantVersion({
            assistantId: savedAssistant.id,
            version: savedAssistant.version,
            sourceAssistantIds: savedAssistant.parentAssistantIds,
            repairReason: savedAssistant.repairReason,
            benchmarkScore: evaluation.totalScore,
            isPromoted: false,
            changeSummary: `基于 ${String(getCustomAssistantById(pending.sourceAssistantId)?.name || '').trim() || '源助手'} 的修复版本`,
            evaluation,
            snapshot: savedAssistant
          })
        }
        saveCustomAssistants([...nextList, savedAssistant])
        this.loadAssistantItems()
        this.requestAssistantEvolutionSuggestionCheck()
        this.clearAssistantFirstPendingStates(message)
        await this.runAssistantTaskFromMessage(message, savedAssistant.id, {
          requirementText,
          inputSource: savedAssistant.inputSource,
          documentAction: savedAssistant.documentAction,
          targetLanguage: savedAssistant.targetLanguage,
          reportSettings: savedAssistant.reportSettings,
          assistantVersion: savedAssistant.version,
          benchmarkScore: savedAssistant.benchmarkScore,
          evaluation
        })
      } catch (error) {
        pending.status = 'failed'
        pending.statusMessage = error?.message || '自动创建助手失败'
        this.saveHistory()
      }
    },
    cancelPendingAssistantCreationDraft(message) {
      const pending = message?.pendingAssistantCreationDraft
      if (!pending || pending.status === 'applying') return
      this.clearAssistantParameterAutoContinue(message?.id)
      message.pendingAssistantCreationDraft = null
      if (!String(message.content || '').trim()) {
        message.content = '已取消创建新的自定义助手。'
      }
      this.saveHistory()
    },
    finalizeRouteResolutionPrompt(message, content = '', options = {}) {
      if (!message) return
      const clearKeys = Array.isArray(options.clearKeys) ? options.clearKeys : []
      clearKeys.forEach((key) => {
        if (key && Object.prototype.hasOwnProperty.call(message, key)) {
          message[key] = null
        }
      })
      message.content = String(content || '').trim()
      message.isLoading = false
      message.missingSkillNotice = false
      this.stopAssistantLoadingProgress(message)
      this.isStreaming = false
      this.streamingContent = ''
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
    },
    showDocumentOperationClarificationNeed(message, needText = '') {
      const promptText = String(needText || '').trim()
      this.finalizeRouteResolutionPrompt(
        message,
        promptText
          ? `已识别到文档处理需求，但还缺少足够明确的处理动作。请补充：${promptText}`
          : '已识别到文档处理需求，但还需要你补充更明确的范围、动作和写回方式，例如“润色当前选中内容并替换原文”或“给全文生成批注”。',
        { clearKeys: ['pendingDocumentOperationChoice'] }
      )
    },
    showWpsCapabilityClarificationNeed(message, reason = '') {
      const detail = String(reason || '').trim()
      this.finalizeRouteResolutionPrompt(
        message,
        detail
          ? `已识别到 WPS 直接操作需求，但还无法确定具体能力。${detail} 请补充更明确的动作，例如“保存文档”“另存为”“设置字体为宋体”“把选中文字改成红色”。`
          : '已识别到 WPS 直接操作需求，但还无法确定具体能力。请补充更明确的动作，例如“保存文档”“另存为”“设置字体为宋体”“把选中文字改成红色”。',
        { clearKeys: ['pendingWpsCapabilityForm'] }
      )
    },
    showGeneratedOutputClarificationNeed(message, reason = '') {
      const detail = String(reason || '').trim()
      this.finalizeRouteResolutionPrompt(
        message,
        detail
          ? `已识别到文件或多媒体生成需求，但还缺少关键信息。${detail} 请补充结果类型、名称或格式，例如“生成一份 xlsx 问题清单”“生成一张 16:9 封面图”“导出文档中的图片”。`
          : '已识别到文件或多媒体生成需求，但还缺少关键信息。请补充结果类型、名称或格式，例如“生成一份 xlsx 问题清单”“生成一张 16:9 封面图”“导出文档中的图片”。',
        {
          clearKeys: [
            'pendingReportGenerationForm',
            'pendingMultimodalGenerationForm',
            'pendingReportDraftConfirmation'
          ]
        }
      )
    },
    showAssistantTaskClarificationNeed(message, text = '', options = {}) {
      const originalText = String(text || '').trim()
      if (options.createDraft === true) {
        const demand = {
          ...this.createGeneralAssistantDemand(originalText),
          label: '自定义助手'
        }
        message.content = '已识别到创建助手需求，暂未匹配到可直接执行的现有助手，先为你生成一个新的自定义助手草稿。'
        message.pendingAssistantCreationDraft = this.createPendingAssistantCreationDraft(demand)
        message.isLoading = false
        this.stopAssistantLoadingProgress(message)
        this.scheduleAssistantCreationDraftAutoContinue(message)
        this.saveHistory()
        this.$nextTick(() => this.scrollToBottom())
        return
      }
      this.finalizeRouteResolutionPrompt(
        message,
        '已识别到助手相关需求，但暂未匹配到合适的现有助手。你可以补充明确的助手名称，或直接说“创建一个新的自定义助手来处理这个需求”。',
        {
          clearKeys: [
            'pendingAssistantExecutionChoice',
            'pendingAssistantParameterCollection',
            'pendingAssistantCreationDraft'
          ]
        }
      )
    },
    async dispatchDocumentOperationChoice(text, model, actionKey, options = {}) {
      const normalized = String(actionKey || '').trim().toLowerCase()
      const prepared = options.prepared || null
      const scope = options.scope || 'selection-preferred'
      if (this.isDocumentRevisionChoiceAction(normalized)) {
        const revisionIntent = this.buildRevisionIntentFromChoiceActions(
          Array.isArray(options.revisionActionKeys) && options.revisionActionKeys.length > 0
            ? options.revisionActionKeys
            : [normalized],
          scope
        )
        await this.handleDocumentRevisionMessage(text, model, revisionIntent, prepared)
        return true
      }
      if (normalized === 'document-delete') {
        await this.handleDocumentDeleteMessage(text, model, null, prepared)
        return true
      }
      if (normalized === 'document-text-edit') {
        await this.handleDocumentTextEditMessage(text, model, null, prepared)
        return true
      }
      if (normalized === 'document-relocation') {
        await this.handleDocumentRelocationMessage(text, model, null, prepared)
        return true
      }
      if (normalized === 'document-format') {
        await this.handleDocumentFormatMessage(text, model, null, prepared)
        return true
      }
      if (normalized === 'document-comment') {
        const commentIntent = detectDocumentCommentIntent(text) || { scope: scope === 'document' ? 'document' : 'selection' }
        await this.startDocumentCommentMessage(text, model, commentIntent, prepared)
        return true
      }
      if (normalized === 'document-aware') {
        await this.sendDocumentAwareMessage(text, model, prepared)
        return true
      }
      if (normalized === 'selection-translate') {
        const translateIntent = detectSelectionTranslateIntent(text, getAssistantSetting('translate')?.targetLanguage || '英文')
        if (translateIntent) {
          this.sendSelectionAwareTranslateMessage(text, model, translateIntent, prepared)
          return true
        }
      }
      if (normalized === 'document-declassify') {
        const assistantMsg = prepared?.assistantMsg
        if (!assistantMsg) return false
        this.stopAssistantLoadingProgress(assistantMsg)
        assistantMsg.isLoading = false
        assistantMsg.content = '已为你打开「文档脱密」对话框，可在其中完成涉密关键词提取与占位符替换。'
        this.openDialogRoute('/document-declassify-dialog', {}, '文档脱密', 860, 720)
        this.saveHistory()
        this.$nextTick(() => this.scrollToBottom())
        return true
      }
      if (normalized === 'document-declassify-restore') {
        const assistantMsg = prepared?.assistantMsg
        if (!assistantMsg) return false
        this.stopAssistantLoadingProgress(assistantMsg)
        assistantMsg.isLoading = false
        assistantMsg.content = '已为你打开「密码复原」对话框，验证密码后可恢复脱密前的原文。'
        this.openDialogRoute('/document-declassify-restore-dialog', {}, '密码复原', 420, 320)
        this.saveHistory()
        this.$nextTick(() => this.scrollToBottom())
        return true
      }
      if (normalized === 'secret-keyword-extract') {
        const assistantMsg = prepared?.assistantMsg
        if (!assistantMsg) return false
        await this.runAssistantTaskFromMessage(assistantMsg, 'analysis.secret-keyword-extract', {
          requirementText: String(text || '').trim()
        })
        return true
      }
      return false
    },
    async confirmPendingDocumentOperationChoice(message, options = {}) {
      const pending = message?.pendingDocumentOperationChoice
      if (!pending || pending.status === 'applying' || pending.status === 'applied') return
      this.clearAssistantParameterAutoContinue(message?.id)
      const selectedKeys = Array.from(new Set((pending.selectedKeys || []).map(item => String(item || '').trim()).filter(Boolean)))
      if (selectedKeys.length === 0) {
        pending.statusMessage = '请至少选择一项操作。'
        this.saveHistory()
        return
      }
      pending.status = 'applying'
      pending.statusMessage = options.autoTriggered === true ? '已按当前选择自动继续处理文档...' : '正在根据所选操作继续处理文档...'
      this.saveHistory()
      const revisionKeys = selectedKeys.filter(key => this.isDocumentRevisionChoiceAction(key))
      const nonRevisionKeys = selectedKeys.filter(key => !this.isDocumentRevisionChoiceAction(key))
      try {
        const reusablePrepared = { assistantMsg: message }
        message.pendingDocumentOperationChoice = null
        let hasReusedCurrentMessage = false
        if (revisionKeys.length > 0) {
          await this.dispatchDocumentOperationChoice(pending.originalText || '', this.selectedModel, revisionKeys[0], {
            prepared: reusablePrepared,
            scope: pending.scope,
            revisionActionKeys: revisionKeys
          })
          hasReusedCurrentMessage = true
        }
        for (const key of nonRevisionKeys) {
          await this.dispatchDocumentOperationChoice(pending.originalText || '', this.selectedModel, key, {
            prepared: hasReusedCurrentMessage ? null : reusablePrepared,
            scope: pending.scope
          })
          hasReusedCurrentMessage = true
        }
        pending.status = 'applied'
        pending.statusMessage = selectedKeys.length > 1
          ? '已按所选操作继续处理。若包含多项操作，结果会在后续消息中展示。'
          : '已根据所选操作继续处理。'
      } catch (error) {
        pending.status = 'failed'
        pending.statusMessage = error?.message || '继续处理失败'
      }
      this.saveHistory()
    },
    cancelPendingDocumentOperationChoice(message) {
      const pending = message?.pendingDocumentOperationChoice
      if (!pending || pending.status === 'applying' || pending.status === 'applied') return
      this.clearAssistantParameterAutoContinue(message?.id)
      pending.status = 'cancelled'
      pending.statusMessage = '已取消本次操作选择。'
      this.saveHistory()
    },
    getDocumentRevisionPurposeLabel(intent) {
      const revisionTypes = Array.isArray(intent?.revisionTypes) && intent.revisionTypes.length > 0
        ? intent.revisionTypes
        : [intent?.revisionType]
      const labels = revisionTypes.map((type) => {
        if (type === 'proofread') return '错别字与语病修正'
        if (type === 'clarify') return '歧义消解'
        if (type === 'correct-description') return '描述纠正'
        if (type === 'formalize') return '正式化改写'
        if (type === 'polish') return '润色优化'
        if (type === 'term-unify') return '术语统一'
        return ''
      }).filter(Boolean)
      if (labels.length > 1) return labels.join('、')
      if (labels.length === 1) return labels[0]
      return '文稿修订'
    },
    getDocumentRevisionActionTags(action) {
      if (!action || typeof action !== 'object') return []
      const tags = []
      const scopeLabel = String(action.scopeLabel || '').trim()
      const purposeLabel = String(action.purposeLabel || '').trim()
      const chunkCount = Number(action.chunkCount || 0)
      const sourceLength = Number(action.sourceLength || 0)
      const targetCount = Number(action.targetCount || 0)
      if (scopeLabel) tags.push({ key: 'scope', label: `范围：${scopeLabel}` })
      if (purposeLabel) tags.push({ key: 'purpose', label: `修订：${purposeLabel}` })
      if (Array.isArray(action.keywordList) && action.keywordList.length > 0) {
        tags.push({ key: 'keywords', label: `关键词：${action.keywordList.join('、')}` })
      }
      if (targetCount > 0) tags.push({ key: 'targets', label: `命中：${targetCount} 段` })
      if (Array.isArray(action.constraintLabels) && action.constraintLabels.length > 0) {
        action.constraintLabels.slice(0, 3).forEach((label, index) => {
          tags.push({ key: `constraint_${index}`, label: `约束：${label}` })
        })
      }
      if (action.writeComments === true) {
        tags.push({ key: 'comments', label: '说明：写入批注' })
      }
      if (chunkCount > 1) tags.push({ key: 'chunks', label: `分段：${chunkCount} 段` })
      if (sourceLength > 0) tags.push({ key: 'length', label: `长度：${sourceLength} 字` })
      return tags
    },
    getDocumentRevisionConstraintLabels(intent) {
      const constraints = intent?.constraints || {}
      const labels = []
      if (constraints.typoOnly) labels.push('只改错别字')
      if (constraints.grammarOnly) labels.push('只改语病')
      if (constraints.punctuationOnly) labels.push('只改标点')
      if (constraints.preserveWording) labels.push('不改措辞')
      if (constraints.preservePunctuation) labels.push('不改标点')
      if (constraints.preserveTone) labels.push('保持语气')
      return labels
    },
    buildDocumentRevisionPreviewSnippet(text, maxLength = 72) {
      const normalized = String(text || '').replace(/\s+/g, ' ').trim()
      if (!normalized) return ''
      return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized
    },
    normalizeDocumentRevisionResult(raw, fallbackText = '') {
      const parsed = parseAssistantIntentResult(raw)
      if (parsed && typeof parsed === 'object') {
        const revisedText = String(parsed.revisedText || parsed.text || '').trim()
        const comment = String(parsed.comment || parsed.reason || '').trim()
        if (revisedText) {
          return {
            revisedText,
            comment
          }
        }
      }
      return {
        revisedText: String(raw || fallbackText || '').trim(),
        comment: ''
      }
    },
    getDocumentRevisionCommentReason(intent) {
      if (intent?.revisionType === 'proofread') {
        return '该处存在错别字、语法、标点或病句问题，已按原意修正。'
      }
      if (intent?.revisionType === 'clarify') {
        return '该处原表述可能引起歧义或指代不清，已改为更明确的表达。'
      }
      if (intent?.revisionType === 'correct-description') {
        return '该处原描述不够准确或不够严谨，已调整为更稳妥的表述。'
      }
      if (intent?.revisionType === 'formalize') {
        return '该处原表达偏口语或不够正式，已改为更规范的书面表达。'
      }
      if (intent?.revisionType === 'polish') {
        return '该处已在保持原意的前提下优化为更通顺、自然的表达。'
      }
      if (intent?.revisionType === 'term-unify') {
        return '该处术语、简称或称谓前后不一致，已做统一。'
      }
      return '该处已根据当前修订要求完成调整。'
    },
    buildDocumentRevisionCommentText(intent, sourceInfo, sourceText = '', outputText = '', generatedComment = '') {
      const lines = ['【修订说明】', String(generatedComment || '').trim() || this.getDocumentRevisionCommentReason(intent)]
      const constraintLabels = this.getDocumentRevisionConstraintLabels(intent)
      if (constraintLabels.length > 0) {
        lines.push(`处理约束：${constraintLabels.join('、')}`)
      }
      if (Array.isArray(sourceInfo?.keywordList) && sourceInfo.keywordList.length > 0) {
        lines.push(`命中条件：包含“${sourceInfo.keywordList.join('、')}”`)
      }
      const beforeSnippet = this.buildDocumentRevisionPreviewSnippet(sourceText, 28)
      const afterSnippet = this.buildDocumentRevisionPreviewSnippet(outputText, 28)
      if (beforeSnippet && afterSnippet && beforeSnippet !== afterSnippet) {
        lines.push(`原文：${beforeSnippet}`)
        lines.push(`修改后：${afterSnippet}`)
      }
      return lines.filter(Boolean).join('\n')
    },
    addCommentToRevisionRange(range, text) {
      const doc = getActiveDocument()
      if (!doc?.Comments || !range || !String(text || '').trim()) return false
      try {
        doc.Comments.Add(range, String(text || '').trim())
        return true
      } catch (_) {
        return false
      }
    },
    buildDocumentRevisionAggregateComment(commentTexts = [], intent, sourceInfo) {
      const normalized = (Array.isArray(commentTexts) ? commentTexts : [commentTexts])
        .map(item => String(item || '').trim())
        .filter(Boolean)
      if (normalized.length === 0) {
        return this.buildDocumentRevisionCommentText(intent, sourceInfo, sourceInfo?.sourceText, '')
      }
      const unique = Array.from(new Set(normalized))
      return ['【修订说明】', ...unique.slice(0, 3)].join('\n')
    },
    addDocumentRevisionComments(scope, sourceInfo, outputText, intent, commentTexts = []) {
      const doc = getActiveDocument()
      if (!doc?.Comments) return 0
      if (scope === 'document') {
        try {
          const range = duplicateDocumentRange(doc?.Paragraphs?.Item?.(1)?.Range || doc?.Content || null)
          const commentText = this.buildDocumentRevisionAggregateComment(commentTexts, intent, sourceInfo)
          return this.addCommentToRevisionRange(range, commentText) ? 1 : 0
        } catch (_) {
          return 0
        }
      }
      if (scope === 'paragraph') {
        const start = Number(sourceInfo?.rangeStart || 0)
        const revisedLength = String(outputText || '').length
        const range = doc.Range(start, Math.max(start + 1, start + revisedLength))
        const commentText = this.buildDocumentRevisionCommentText(
          intent,
          sourceInfo,
          sourceInfo?.sourceText,
          outputText,
          Array.isArray(commentTexts) ? commentTexts[0] : commentTexts
        )
        return this.addCommentToRevisionRange(range, commentText) ? 1 : 0
      }
      if (scope === 'selection') {
        const start = Number(sourceInfo?.rangeStart || 0)
        const revisedLength = String(outputText || '').length
        const range = doc.Range(start, Math.max(start + 1, start + revisedLength))
        const commentText = this.buildDocumentRevisionCommentText(
          intent,
          sourceInfo,
          sourceInfo?.sourceText,
          outputText,
          Array.isArray(commentTexts) ? commentTexts[0] : commentTexts
        )
        return this.addCommentToRevisionRange(range, commentText) ? 1 : 0
      }
      if (scope === 'keyword-paragraphs') {
        const targets = Array.isArray(sourceInfo?.targets) ? sourceInfo.targets : []
        const outputs = Array.isArray(outputText) ? outputText : []
        let count = 0
        for (let i = targets.length - 1; i >= 0; i--) {
          const target = targets[i]
          const revised = String(outputs[i] || '').trim()
          if (!revised) continue
          const range = doc.Range(Number(target.start || 0), Math.max(Number(target.start || 0) + 1, Number(target.start || 0) + revised.length))
          const commentText = this.buildDocumentRevisionCommentText(
            intent,
            sourceInfo,
            target.text,
            revised,
            Array.isArray(commentTexts) ? commentTexts[i] : ''
          )
          count += this.addCommentToRevisionRange(range, commentText) ? 1 : 0
        }
        return count
      }
      return 0
    },
    hasMeaningfulRevisionChange(sourceText, outputText) {
      const normalize = value => String(value || '').replace(/\s+/g, '').trim()
      return normalize(sourceText) !== normalize(outputText)
    },
    resolveDocumentRevisionSource(intent) {
      const requestedScope = String(intent?.scope || 'selection-preferred')
      if (Array.isArray(intent?.keywordTarget?.keywordList) && intent.keywordTarget.keywordList.length > 0) {
        const targets = getRevisionParagraphTargetsByKeywords(
          intent.keywordTarget.keywordList,
          intent.keywordTarget.keywordRelation
        )
        if (targets.length === 0) {
          throw new Error(`未找到包含“${intent.keywordTarget.keywordList.join('、')}”的段落`)
        }
        return {
          actualScope: 'keyword-paragraphs',
          sourceLabel: '命中段落',
          sourceText: targets.map(item => item.text).join('\n\n'),
          targets,
          keywordList: intent.keywordTarget.keywordList,
          keywordRelation: intent.keywordTarget.keywordRelation
        }
      }
      if (requestedScope === 'document') {
        const { documentText } = this.getCurrentDocumentPayload()
        if (!documentText) throw new Error('当前文档为空，暂时没有可修订的正文内容')
        return {
          actualScope: 'document',
          sourceLabel: '全文',
          sourceText: documentText
        }
      }
      if (requestedScope === 'paragraph') {
        const range = getCurrentParagraphRangeForRevision()
        const text = String(range?.Text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
        if (!text) {
          throw new Error('无法获取当前段落，请先将光标放到需要修订的段落内')
        }
        return {
          actualScope: 'paragraph',
          sourceLabel: '当前段落',
          sourceText: text,
          rangeStart: Number(range?.Start || 0),
          rangeEnd: Number(range?.End || 0)
        }
      }
      const snapshot = this.resolveBestSelectionContext()
      if (snapshot?.text) {
        const hasSelection = snapshot?.position?.hasSelection === true
        const actualScope = requestedScope === 'selection'
          ? 'selection'
          : hasSelection
            ? 'selection'
            : 'paragraph'
        const selectionRange = getSelectionRangeForRevision()
        const paragraphRange = actualScope === 'paragraph' ? getCurrentParagraphRangeForRevision() : null
        return {
          actualScope,
          sourceLabel: actualScope === 'selection' ? '选中内容' : '当前段落',
          sourceText: String(snapshot.text || '').trim(),
          rangeStart: Number((actualScope === 'selection' ? selectionRange?.Start : paragraphRange?.Start) || 0),
          rangeEnd: Number((actualScope === 'selection' ? selectionRange?.End : paragraphRange?.End) || 0)
        }
      }
      if (requestedScope === 'selection') {
        throw new Error('请先选中需要修订的内容')
      }
      const { documentText } = this.getCurrentDocumentPayload()
      if (!documentText) throw new Error('当前文档为空，暂时没有可修订的正文内容')
      return {
        actualScope: 'document',
        sourceLabel: '全文',
        sourceText: documentText
      }
    },
    buildDocumentRevisionMessages(sourceText, intent, options = {}) {
      const definition = getBuiltinAssistantDefinition(intent?.assistantId) || {}
      const config = getAssistantSetting(intent?.assistantId) || {}
      const scopeLabel = String(options.scopeLabel || '文档内容').trim()
      const chunkIndex = Number(options.chunkIndex || 0)
      const totalChunks = Number(options.totalChunks || 0)
      const revisionTypes = Array.isArray(intent?.revisionTypes) && intent.revisionTypes.length > 0
        ? intent.revisionTypes
        : [intent?.revisionType]
      let taskInstruction = '请直接输出修订后的完整文本。'
      if (revisionTypes.length > 1) {
        const goals = revisionTypes.map(type => this.getDocumentRevisionPurposeLabel({ revisionType: type })).filter(Boolean)
        taskInstruction = `请结合以下目标修订下面${scopeLabel}：${goals.join('、')}。在不改变原意和事实的前提下，直接输出修订后的完整文本。`
      } else if (intent?.revisionType === 'proofread') {
        taskInstruction = `请修正下面${scopeLabel}中的错别字、语法、标点和明显病句，并直接输出修正后的完整文本。重点检查明显单字错别字、同音误字、近形误字和固定词误写，不要漏掉“简解”这类应改为正确词语的错误。输出前请再次自检，确认修正后的文本里不再残留明显错别字。`
      } else if (intent?.revisionType === 'clarify') {
        taskInstruction = `请修改下面${scopeLabel}中容易引起歧义、指代不清、表达含混的地方，在不改变原意和事实的前提下使表达更清晰，并直接输出修正后的完整文本。`
      } else if (intent?.revisionType === 'correct-description') {
        taskInstruction = `请修改下面${scopeLabel}中描述不正确、不准确或不严谨的地方，使表述更准确稳妥。若原文事实不足以支撑更具体的改写，不要编造新事实，而应使用更审慎的表达。请直接输出修正后的完整文本。`
      } else if (intent?.revisionType === 'formalize') {
        taskInstruction = `请将下面${scopeLabel}改写得更正式、规范、适合书面文档，直接输出修订后的完整文本。`
      } else if (intent?.revisionType === 'polish') {
        taskInstruction = `请润色下面${scopeLabel}，使表达更流畅、自然、专业，直接输出修订后的完整文本。`
      } else if (intent?.revisionType === 'term-unify') {
        taskInstruction = `请统一下面${scopeLabel}中的术语、简称、称谓和表述方式，直接输出修订后的完整文本。`
      }
      const systemPrompt = [
        config.systemPrompt || definition.systemPrompt || '',
        '你正在处理来自文档编辑器的直接修订任务。',
        '你必须只输出合法 JSON，不要输出解释、列表、备注、代码块或其他多余文字。',
        '必须尽量保持原文事实、数字、主体和逻辑关系，不得凭空添加原文没有的新信息。',
        'JSON 格式：{"revisedText":"","comment":""}',
        'revisedText 必须是修订后的完整文本；comment 必须是一条适合直接写入文档批注的简短说明，说明为什么这样改。',
        chunkIndex > 0 && totalChunks > 1
          ? '当前输入只是全文中的一个连续片段。你只能修订当前片段本身，输出必须能与前后片段直接拼接。'
          : ''
      ].filter(Boolean).join('\n\n')
      const userPrompt = [
        taskInstruction,
        ...this.getDocumentRevisionConstraintLabels(intent).map(label => `约束：${label}`),
        chunkIndex > 0 && totalChunks > 1
          ? `当前是全文第 ${chunkIndex}/${totalChunks} 段，请只处理当前片段。`
          : '',
        '',
        '待修订内容：',
        '---',
        String(sourceText || '').trim(),
        '---'
      ].filter(Boolean).join('\n')
      return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    },
    confirmDocumentRevisionRun(intent, sourceInfo, chunkCount = 1) {
      if (sourceInfo?.actualScope !== 'document') return true
      const scopeLabel = this.getDocumentRevisionPurposeLabel(intent)
      const charCount = Number(String(sourceInfo?.sourceText || '').length || 0)
      if (!window.confirm(`将读取全文并生成“${scopeLabel}”预览（约 ${charCount} 字），确认后才会写回文档。是否继续？`)) {
        return false
      }
      if (chunkCount > 1) {
        return this.confirmDocumentChunkSubmission(sourceInfo?.sourceText || '', chunkCount)
      }
      return true
    },
    createDocumentRevisionPreview(intent, sourceInfo, outputText, chunkCount = 1) {
      const purposeLabel = this.getDocumentRevisionPurposeLabel(intent)
      const changedCount = Array.isArray(outputText)
        ? outputText.filter((item, index) => this.hasMeaningfulRevisionChange(sourceInfo?.targets?.[index]?.text || '', item)).length
        : (this.hasMeaningfulRevisionChange(sourceInfo?.sourceText, outputText) ? 1 : 0)
      const canApply = changedCount > 0
      const previewAfterText = Array.isArray(outputText) ? outputText.filter(Boolean).join('\n\n') : outputText
      return {
        intent,
        outputText,
        actualScope: sourceInfo?.actualScope || 'document',
        scopeLabel: sourceInfo?.sourceLabel || '文档内容',
        purposeLabel,
        chunkCount,
        sourceLength: Number(String(sourceInfo?.sourceText || '').length || 0),
        targetCount: Number(sourceInfo?.targets?.length || 0),
        keywordList: sourceInfo?.keywordList || [],
        constraintLabels: this.getDocumentRevisionConstraintLabels(intent),
        writeComments: true,
        sourceInfo,
        changeSummary: [`修订${sourceInfo?.sourceLabel || '内容'}`, purposeLabel],
        confirmPrompt: `是否确认将修订结果写回${sourceInfo?.sourceLabel || '文档'}？`,
        previewBefore: this.buildDocumentRevisionPreviewSnippet(sourceInfo?.sourceText),
        previewAfter: this.buildDocumentRevisionPreviewSnippet(previewAfterText),
        canApply,
        backupSupported: canCreateDocumentBackup(),
        backupRequested: canCreateDocumentBackup() && sourceInfo?.actualScope === 'document'
      }
    },
    applyDocumentRevisionResult(scope, output, pending = null) {
      const finalText = Array.isArray(output) ? output : String(output || '').trim()
      if ((Array.isArray(finalText) && finalText.length === 0) || (!Array.isArray(finalText) && !finalText)) {
        throw new Error('模型没有返回可写回的修订结果')
      }
      const pendingInfo = pending && typeof pending === 'object' ? pending : {}
      const commentText = this.buildDocumentRevisionAggregateComment(
        pendingInfo.commentTexts || [],
        pendingInfo.intent || {},
        pendingInfo.sourceInfo || {}
      )
      if (scope === 'document') {
        const result = applyDocumentAction('replace', finalText, {
          inputSource: 'document',
          title: '文档修订',
          commentText,
          safeReplacePayload: { mode: 'paragraph-body' },
          strictTargetAction: true
        })
        return result?.message || '已完成全文修订并覆盖原文。'
      }
      if (scope === 'paragraph') {
        const range = getCurrentParagraphRangeForRevision()
        if (!range) {
          throw new Error('无法获取当前段落，请重新定位到需要修订的段落')
        }
        const result = applyDocumentAction('replace', finalText, {
          targetRange: range,
          title: '文档修订',
          commentText,
          safeReplacePayload: { mode: 'paragraph-body' },
          strictTargetAction: true
        })
        return result?.message || '已完成当前段落修订。'
      }
      if (scope === 'keyword-paragraphs') {
        throw new Error('缺少命中段落上下文，无法直接写回')
      }
      const result = applyDocumentAction('replace', finalText, {
        title: '文档修订',
        commentText,
        strictTargetAction: true
      })
      return result?.message || '已完成选中内容修订。'
    },
    applyKeywordParagraphRevisionResult(pending) {
      const doc = getActiveDocument()
      if (!doc) throw new Error('当前没有打开文档')
      const targets = Array.isArray(pending?.targets) ? pending.targets : []
      const outputs = Array.isArray(pending?.outputText) ? pending.outputText : []
      if (targets.length === 0 || outputs.length === 0) {
        throw new Error('缺少段落修订结果，无法写回')
      }
      let processedCount = 0
      let downgradedCount = 0
      for (let i = targets.length - 1; i >= 0; i--) {
        const target = targets[i]
        const revised = String(outputs[i] || '').trim()
        if (!revised) continue
        const result = applyDocumentAction('replace', revised, {
          targetRange: doc.Range(Number(target.start || 0), Number(target.end || 0)),
          title: '文档修订',
          commentText: '',
          safeReplacePayload: { mode: 'paragraph-body' },
          strictTargetAction: true
        })
        if (result?.action === 'comment') {
          downgradedCount += 1
        } else {
          processedCount += 1
        }
      }
      if (downgradedCount > 0) {
        return `已完成 ${processedCount} 个命中段落的替换，另有 ${downgradedCount} 段已降级为批注建议。`
      }
      return `已完成 ${processedCount} 个命中段落的修订。`
    },
    async startDocumentRevisionMessage(text, model, prepared = null) {
      const resolvedPrepared = prepared || this.prepareOutgoingMessages(text)
      if (!resolvedPrepared) return
      const { assistantMsg } = resolvedPrepared
      assistantMsg.content = ''
      assistantMsg.isLoading = true
      this.startAssistantLoadingProgress(assistantMsg, {
        label: '正在准备文档修订...',
        detail: '正在识别修订意图并生成修订预览。',
        percent: 12
      })
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
      await this.handleDocumentRevisionMessage(text, model, null, resolvedPrepared)
    },
    async handleDocumentRevisionMessage(text, model, intent, prepared = null) {
      const resolvedPrepared = prepared || this.prepareOutgoingMessages(text)
      if (!resolvedPrepared) return
      const { assistantMsg } = resolvedPrepared
      const runContext = this.startActiveDocumentRevisionRun(assistantMsg)
      // 与整篇文档处理一致：尽快占用发送锁，避免在 await 模型期间又发一条导致新的修订顶替 AbortController，表现为「已停止本次文档修订」。
      this.isStreaming = true
      this.streamingContent = ''
      try {
        this.appendPrimaryRouteDetail(assistantMsg.activeDocumentRevisionRun, assistantMsg)
        const resolvedIntent = intent || detectDocumentRevisionIntent(text)
        if (!resolvedIntent) {
          this.stopAssistantLoadingProgress(assistantMsg)
          assistantMsg.content = '未识别到明确的修订要求，请补充是要纠错、纠正描述还是消除歧义。'
          assistantMsg.isLoading = false
          this.finishActiveDocumentRevisionRun(assistantMsg)
          this.saveHistory()
          this.scrollToBottom()
          return
        }
        this.appendDocumentRevisionDetail(
          assistantMsg.activeDocumentRevisionRun,
          `已识别修订类型：${this.getDocumentRevisionPurposeLabel(resolvedIntent)}。`
        )
        const sourceInfo = this.resolveDocumentRevisionSource(resolvedIntent)
        this.appendDocumentRevisionDetail(
          assistantMsg.activeDocumentRevisionRun,
          `处理范围：${sourceInfo.sourceLabel}。`
        )
        const purposeLabel = this.getDocumentRevisionPurposeLabel(resolvedIntent)
        const { chunks } = sourceInfo.actualScope === 'document'
          ? this.getDocumentChunks(sourceInfo.sourceText, 'transform')
          : sourceInfo.actualScope === 'keyword-paragraphs'
            ? { chunks: sourceInfo.targets.map(item => item.text) }
          : { chunks: [sourceInfo.sourceText] }
        this.appendDocumentRevisionDetail(
          assistantMsg.activeDocumentRevisionRun,
          chunks.length > 1 ? `本次将按 ${chunks.length} 段依次处理。` : '本次无需分段，直接处理当前内容。'
        )
        if (!this.confirmDocumentRevisionRun(resolvedIntent, sourceInfo, chunks.length)) {
          this.stopAssistantLoadingProgress(assistantMsg)
          assistantMsg.content = '已取消本次文档修订。'
          assistantMsg.isLoading = false
          this.finishActiveDocumentRevisionRun(assistantMsg)
          this.saveHistory()
          this.scrollToBottom()
          return
        }
        const outputs = []
        const commentTexts = []
        for (let i = 0; i < chunks.length; i++) {
          this.ensureDocumentRevisionRunActive(runContext, assistantMsg)
          if (i === 0) {
            this.stopAssistantLoadingProgress(assistantMsg)
          }
          assistantMsg.content = chunks.length > 1
            ? `正在生成${sourceInfo.sourceLabel}${purposeLabel}预览（第 ${i + 1}/${chunks.length} 段）...`
            : `正在生成${sourceInfo.sourceLabel}${purposeLabel}预览...`
          assistantMsg.activeDocumentRevisionRun = {
            ...(assistantMsg.activeDocumentRevisionRun || {}),
            status: 'running',
            statusMessage: chunks.length > 1
              ? `当前进度：第 ${i + 1}/${chunks.length} 段`
              : '当前进度：处理中'
          }
          this.appendDocumentRevisionDetail(
            assistantMsg.activeDocumentRevisionRun,
            chunks.length > 1 ? `开始处理第 ${i + 1}/${chunks.length} 段。` : '开始处理当前内容。'
          )
          this.saveHistory()
          this.$nextTick(() => this.scrollToBottom())
          const result = await chatCompletion({
            providerId: model.providerId,
            modelId: model.modelId,
            temperature: resolvedIntent.revisionType === 'proofread' ? 0.1 : 0.25,
            signal: runContext.abortController?.signal,
            messages: this.buildDocumentRevisionMessages(chunks[i], resolvedIntent, {
              scopeLabel: sourceInfo.sourceLabel,
              chunkIndex: chunks.length > 1 ? i + 1 : 0,
              totalChunks: chunks.length
            })
          })
          this.ensureDocumentRevisionRunActive(runContext, assistantMsg)
          const normalizedResult = this.normalizeDocumentRevisionResult(result, chunks[i])
          outputs.push(normalizedResult.revisedText)
          commentTexts.push(normalizedResult.comment)
          this.appendDocumentRevisionDetail(
            assistantMsg.activeDocumentRevisionRun,
            chunks.length > 1 ? `第 ${i + 1}/${chunks.length} 段处理完成。` : '当前内容处理完成。'
          )
        }
        this.ensureDocumentRevisionRunActive(runContext, assistantMsg)
        const finalOutput = sourceInfo.actualScope === 'keyword-paragraphs'
          ? outputs.map(item => String(item || '').trim())
          : outputs.filter(Boolean).join('\n\n').trim()
        const preview = this.createDocumentRevisionPreview(resolvedIntent, sourceInfo, finalOutput, chunks.length)
        const processingDetails = Array.isArray(assistantMsg.activeDocumentRevisionRun?.details)
          ? assistantMsg.activeDocumentRevisionRun.details.map(item => ({ ...item }))
          : []
        processingDetails.push({
          id: `revision_detail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          text: '修订预览已生成，等待确认写回。'
        })
        assistantMsg.content = `${sourceInfo.sourceLabel}${purposeLabel}预览已生成。\n将执行：${preview.changeSummary.join('、')}。`
        assistantMsg.pendingDocumentRevisionAction = {
          ...preview,
          targets: sourceInfo.targets || [],
          commentTexts,
          processingDetails,
          showDetails: false,
          status: preview.canApply ? 'pending' : 'unavailable',
          statusMessage: preview.canApply
            ? '已生成修订预览，等待确认写回。'
            : '未发现明显需要修改的内容，暂不写回。'
        }
        this.stopAssistantLoadingProgress(assistantMsg)
        assistantMsg.isLoading = false
        this.finishActiveDocumentRevisionRun(assistantMsg)
      } catch (error) {
        this.stopAssistantLoadingProgress(assistantMsg)
        if (this.isDocumentRevisionCancelledError(error) || error?.name === 'AbortError') {
          const superseded = this.activeDocumentRevisionRunContext &&
            this.activeDocumentRevisionRunContext.messageId &&
            this.activeDocumentRevisionRunContext.messageId !== String(assistantMsg?.id || '')
          const stopHint = superseded
            ? '上一次文档修订因新的会话请求被打断（或并发启动了新的修订）。若你只想检查错别字，请等待当前预览完成后再发下一条，或先点击停止再发送。'
            : '已停止本次文档修订，未写回正文或批注。'
          assistantMsg.content = stopHint
          assistantMsg.isLoading = false
          this.appendDocumentRevisionDetail(assistantMsg.activeDocumentRevisionRun, superseded ? '检测到修订上下文已被其他请求取代，本次未继续。' : '本次处理已停止，未继续后续步骤。')
          this.finishActiveDocumentRevisionRun(assistantMsg, {
            status: 'cancelled',
            statusMessage: superseded ? '本次文档修订已被新的请求中断。' : '已停止本次文档修订。'
          })
        } else {
          assistantMsg.content = '[错误] ' + (error?.message || '文档修订失败')
          assistantMsg.isLoading = false
          this.appendDocumentRevisionDetail(
            assistantMsg.activeDocumentRevisionRun,
            `处理失败：${error?.message || '文档修订失败'}`
          )
          this.finishActiveDocumentRevisionRun(assistantMsg)
        }
      } finally {
        this.isStreaming = false
        this.streamingContent = ''
      }
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
    },
    async confirmPendingDocumentRevisionAction(message) {
      const pending = message?.pendingDocumentRevisionAction
      if (!pending || !pending.canApply || pending.status === 'applying' || pending.status === 'applied') return
      if (message?.pendingRevisionModePrompt) return
      if (this.promptRevisionModeBeforeApply(message, 'document-revision-apply', {
        summaryText: '检测到即将把修订结果写回文档，你可以先开启修订模式。',
        confirmPrompt: '点击“开启修订并继续”后，将自动开启文档修订模式，再继续写回；如果不需要，可直接继续。'
      })) {
        return
      }
      await this.executePendingDocumentRevisionAction(message)
    },
    updatePendingDocumentRevisionBackup(message, enabled) {
      const pending = message?.pendingDocumentRevisionAction
      if (!pending || pending.status === 'applying') return
      pending.backupRequested = enabled === true
      this.saveHistory()
    },
    async executePendingDocumentRevisionAction(message) {
      const pending = message?.pendingDocumentRevisionAction
      if (!pending || !pending.canApply || pending.status === 'applying' || pending.status === 'applied') return
      pending.status = 'applying'
      pending.statusMessage = '正在写回修订结果...'
      this.appendDocumentRevisionDetail(pending, '用户已确认，开始写回修订结果。')
      this.saveHistory()
      try {
        if (pending.backupRequested === true && pending.backupSupported === true) {
          const backupRef = createDocumentBackupRecord({
            assistantId: pending?.intent?.assistantId || 'document-revision',
            reason: 'document-revision-apply',
            launchSource: 'dialog',
            metadata: {
              scope: pending.actualScope || 'document',
              sourceLabel: pending.scopeLabel || ''
            }
          })
          pending.backupRef = backupRef
          pending.rollbackCandidate = {
            type: 'document-backup',
            backupId: backupRef.id,
            path: backupRef.backupPath
          }
          this.appendDocumentRevisionDetail(pending, `已备份源文件：${backupRef.backupPath}`)
        }
        const resultMessage = pending.actualScope === 'keyword-paragraphs'
          ? this.applyKeywordParagraphRevisionResult(pending)
          : this.applyDocumentRevisionResult(pending.actualScope || 'document', pending.outputText, pending)
        this.appendDocumentRevisionDetail(pending, resultMessage)
        const commentCount = this.addDocumentRevisionComments(
          pending.actualScope || 'document',
          pending.sourceInfo || {},
          pending.outputText,
          pending.intent || {},
          pending.commentTexts || []
        )
        if (commentCount > 0) {
          this.appendDocumentRevisionDetail(pending, `已写入 ${commentCount} 条修订说明批注。`)
        } else {
          this.appendDocumentRevisionDetail(pending, '当前未写入修订说明批注。')
        }
        pending.status = 'applied'
        pending.statusMessage = commentCount > 0
          ? `${resultMessage} 已写入 ${commentCount} 条修订说明批注。`
          : resultMessage
        this.refreshSelectionContext()
      } catch (error) {
        pending.status = 'failed'
        pending.statusMessage = error?.message || '写回修订结果失败'
        this.appendDocumentRevisionDetail(pending, `写回失败：${pending.statusMessage}`)
      }
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
    },
    cancelPendingDocumentRevisionAction(message) {
      const pending = message?.pendingDocumentRevisionAction
      if (!pending || pending.status === 'applying' || pending.status === 'applied') return
      if (message?.pendingRevisionModePrompt?.actionType === 'document-revision-apply') {
        this.clearAssistantParameterAutoContinue(message?.id)
        message.pendingRevisionModePrompt = null
      }
      pending.status = 'cancelled'
      pending.canApply = false
      pending.statusMessage = '已取消本次文档修订。'
      this.saveHistory()
    },
    async confirmPendingRevisionModePrompt(message) {
      const pending = message?.pendingRevisionModePrompt
      if (!pending || pending.status === 'applying') return
      this.clearAssistantParameterAutoContinue(message?.id)
      pending.status = 'applying'
      pending.statusMessage = '正在开启修订模式并继续处理...'
      this.saveHistory()
      const enableResult = enableDocumentTrackRevisions()
      if (pending.actionType === 'document-revision-apply') {
        if (enableResult?.message) {
          this.appendDocumentRevisionDetail(message?.pendingDocumentRevisionAction, enableResult.message)
        }
      } else if (pending.actionType === 'assistant-task-apply') {
        if (enableResult?.message) {
          this.appendDocumentRevisionDetail(message?.activeAssistantTaskRun, enableResult.message)
        }
      }
      message.pendingRevisionModePrompt = null
      if (!enableResult?.ok && enableResult?.message) {
        message.content = String(message.content || '').trim() || enableResult.message
      }
      if (pending.actionType === 'document-revision-apply') {
        await this.executePendingDocumentRevisionAction(message)
        return
      }
      if (pending.actionType === 'assistant-task-apply') {
        this.executePendingAssistantTaskPlan(message)
      }
    },
    async continuePendingRevisionModePrompt(message, options = {}) {
      const pending = message?.pendingRevisionModePrompt
      if (!pending || pending.status === 'applying') return
      this.clearAssistantParameterAutoContinue(message?.id)
      pending.status = 'applying'
      pending.statusMessage = options.autoTriggered === true ? '已按默认方式直接继续处理...' : '正在按当前文档状态继续处理...'
      this.saveHistory()
      const actionType = String(pending.actionType || '').trim()
      message.pendingRevisionModePrompt = null
      if (actionType === 'document-revision-apply') {
        await this.executePendingDocumentRevisionAction(message)
        return
      }
      if (actionType === 'assistant-task-apply') {
        this.executePendingAssistantTaskPlan(message)
      }
    },
    getDocumentChunks(documentText, strategy = 'synthesize') {
      return planTextChunks(documentText, { strategy })
    },
    confirmDocumentChunkSubmission(documentText, chunkCount) {
      const charCount = Number(documentText?.length || 0)
      if (charCount <= DIRECT_DOCUMENT_CHAR_LIMIT && chunkCount <= 1) return true
      return window.confirm(
        `当前文档约 ${charCount} 字，超出单次推荐长度，将按 ${chunkCount} 段提交处理。\n\n继续后会自动分段并合并结果，耗时会更久。\n\n是否继续？`
      )
    },
    buildDocumentTransformChunkMessages(userText, chunkText, index, total, attachmentPrompt = '') {
      const isTranslate = /(翻译|译成|翻成|中译英|英译中)/.test(String(userText || ''))
      if (isTranslate) {
        const translateDefinition = getBuiltinAssistantDefinition('translate') || {}
        const translateConfig = getAssistantSetting('translate') || {}
        const targetLanguage = resolveTranslationTargetLanguage(
          userText,
          translateConfig.targetLanguage || '英文'
        )
        const systemPrompt = [
          translateConfig.systemPrompt || translateDefinition.systemPrompt || '',
          '你正在分段处理一篇长文档的翻译任务。',
          '你必须只输出当前片段对应的最终译文，不要解释，不要标题，不要备注，不要提到分段。'
        ].filter(Boolean).join('\n\n')
        const userPrompt = [
          `用户要求：${userText}`,
          `当前是全文第 ${index}/${total} 段，请只翻译当前片段，输出结果需要可以直接与前后段拼接。`,
          `目标语言：${targetLanguage}`,
          attachmentPrompt ? `附件补充信息：\n${attachmentPrompt}` : '',
          '当前片段：',
          '---',
          chunkText,
          '---'
        ].filter(Boolean).join('\n')
        return [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }
      return [
        {
          role: 'system',
          content: [
            '你正在分段处理一篇长文档。',
            '请仅处理当前片段，并输出可直接拼接回全文的最终结果。',
            '不要解释，不要标题，不要备注，不要提及“第几段”或“分段处理”。'
          ].join('\n')
        },
        {
          role: 'user',
          content: [
            `用户要求：${userText}`,
            `当前是全文第 ${index}/${total} 段，请只处理当前片段，保持术语、语气、编号与局部结构自然连续。`,
            attachmentPrompt ? `附件补充信息：\n${attachmentPrompt}` : '',
            '当前片段：',
            '---',
            chunkText,
            '---'
          ].filter(Boolean).join('\n')
        }
      ]
    },
    buildDocumentAnalysisChunkMessages(userText, chunkText, index, total, attachmentPrompt = '') {
      return [
        {
          role: 'system',
          content: [
            '你正在为整篇长文档任务做分段阅读。',
            '请只提取当前片段中与用户请求直接相关的事实、观点、结构和证据。',
            '输出简洁要点，不要生成最终答案，不要编造未出现的信息。'
          ].join('\n')
        },
        {
          role: 'user',
          content: [
            `用户原始请求：${userText}`,
            `当前是全文第 ${index}/${total} 段。请输出本段与请求相关的关键信息要点；如基本无关，直接写“无关键内容”。`,
            attachmentPrompt ? `附件补充信息：\n${attachmentPrompt}` : '',
            '当前片段：',
            '---',
            chunkText,
            '---'
          ].filter(Boolean).join('\n')
        }
      ]
    },
    buildDocumentSynthesisMessages(userText, chunkNotes, snapshot = null) {
      const sections = [
        `用户原始请求：${userText}`
      ]
      if (snapshot?.documentName) {
        sections.push(`文档名称：${snapshot.documentName}`)
      }
      if (snapshot?.documentStats?.totalPages > 0 || snapshot?.documentStats?.paragraphCount > 0) {
        sections.push(
          `文档概况：${snapshot.documentStats?.totalPages ? `共 ${snapshot.documentStats.totalPages} 页` : ''}${snapshot.documentStats?.paragraphCount ? `，${snapshot.documentStats.paragraphCount} 段` : ''}${snapshot.documentStats?.characterCount ? `，${snapshot.documentStats.characterCount} 字符` : ''}`.replace(/^，/, '')
        )
      }
      sections.push('以下是按顺序整理的分段阅读笔记，请据此完成最终回答，不要提及这些笔记来自分段处理：')
      sections.push(chunkNotes.join('\n\n'))
      return [
        {
          role: 'system',
          content: '你将基于一组长文档分段笔记完成用户请求。请直接输出最终答案，保持结构清晰，不要提及分段处理过程。'
        },
        {
          role: 'user',
          content: sections.filter(Boolean).join('\n\n')
        }
      ]
    },
    ensureWritableChat(userContent) {
      const inputText = String(userContent || '').trim()
      const existingChat = this.currentChat
      if (!existingChat) {
        this.newChat()
      }
      const chatId = this.currentChatId || this.chatHistory[0]?.id
      const chatObj = this.chatHistory.find(c => c.id === chatId)
      if (!chatObj) return null
      if (!chatObj.title || chatObj.title === '新对话') {
        chatObj.title = inputText.slice(0, 20) + (inputText.length > 20 ? '...' : '')
      }
      return chatObj
    },
    appendChatTurn(chatObj, userContent, userMessageMeta = null) {
      const now = Date.now()
      const userMessage = { id: 'u' + now, role: 'user', content: userContent }
      if (userMessageMeta && Object.keys(userMessageMeta).length > 0) {
        userMessage.messageMeta = userMessageMeta
      }
      chatObj.messages.push(userMessage)
      const assistantMsg = {
        id: 'a' + (now + 1),
        role: 'assistant',
        content: '',
        recommendations: [],
        generatedFiles: []
      }
      chatObj.messages.push(assistantMsg)
      return assistantMsg
    },
    buildSelectionTranslateMessages(selectionContext, targetLanguage) {
      const translateDefinition = getBuiltinAssistantDefinition('translate') || {}
      const translateConfig = getAssistantSetting('translate') || {}
      const finalTargetLanguage = String(
        targetLanguage || translateConfig.targetLanguage || '英文'
      ).trim() || '英文'
      const systemPrompt = [
        translateConfig.systemPrompt || translateDefinition.systemPrompt || '',
        '你正在处理来自文档编辑器的即时翻译请求。',
        '上下文仅用于消歧和保持结构，不得把未被选中的上下文内容混入结果。',
        '你必须只输出最终译文，不要解释、不要前言、不要代码块、不要引号、不要备注。',
        '如果来源文本中包含标题、编号、项目符号、表格单元格或强调语气，请尽量在译文中保留对应结构和语气。'
      ].filter(Boolean).join('\n\n')
      const baseUserPrompt = interpolateAssistantTemplate(
        translateConfig.userPromptTemplate || translateDefinition.userPromptTemplate || '{{input}}',
        {
          input: selectionContext?.text || '',
          targetLanguage: finalTargetLanguage,
          assistantName: translateDefinition.shortLabel || translateDefinition.label || '翻译'
        }
      )
      const contextPrompt = buildSelectionContextPrompt(selectionContext)
      const userPrompt = [
        baseUserPrompt,
        '补充要求：',
        '1. 只能翻译“来源文本”本身，不要扩写，不要总结。',
        '2. 上下文仅用于理解歧义、指代、术语和语气。',
        '3. 若来源文本本身就是目标语言，请输出忠实润色后的结果。',
        '',
        '文档上下文：',
        contextPrompt
      ].filter(Boolean).join('\n')
      return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    },
    sendSelectionAwareTranslateMessage(userContent, model, intent, prepared = null) {
      const selectionContext = this.resolveBestSelectionContext()
      if (!selectionContext?.text) {
        alert('请先选中文本，或将光标放到需要翻译的段落中')
        return
      }

      let assistantMsg = prepared?.assistantMsg || null
      if (!assistantMsg) {
        const chatObj = this.ensureWritableChat(userContent)
        if (!chatObj) return
        const attachmentsSnapshot = this.cloneAttachmentSnapshot()
        const userMessageMeta = this.buildUserMessageMeta({
          selectionSnapshot: selectionContext,
          attachmentsSnapshot
        })
        assistantMsg = this.appendChatTurn(chatObj, userContent, userMessageMeta)
        this.userInput = ''
        this.clearAttachments()
        this.clearSelectionBridgeStorage()
      }

      assistantMsg.isLoading = true
      this.isStreaming = true
      this.streamingContent = ''
      this.startAssistantLoadingProgress(assistantMsg, {
        label: '已发送，正在翻译...',
        detail: '正在等待模型返回首段译文。',
        percent: 14
      })

      streamChatCompletion({
        ribbonModelId: model.id,
        providerId: model.providerId,
        modelId: model.modelId,
        temperature: 0.2,
        messages: this.buildSelectionTranslateMessages(selectionContext, intent?.targetLanguage),
        onChunk: (chunk) => {
          this.stopAssistantLoadingProgress(assistantMsg)
          assistantMsg.isLoading = false
          this.streamingContent += chunk
          assistantMsg.content = this.streamingContent
          this.$nextTick(() => this.scrollToBottom())
        },
        onDone: () => {
          this.stopAssistantLoadingProgress(assistantMsg)
          assistantMsg.isLoading = false
          this.isStreaming = false
          this.streamingContent = ''
          this.requestAssistantEvolutionSuggestionCheck()
          this.saveHistory()
          this.$nextTick(() => this.scrollToBottom())
        },
        onError: (err) => {
          this.stopAssistantLoadingProgress(assistantMsg)
          assistantMsg.isLoading = false
          this.isStreaming = false
          this.streamingContent = ''
          this.clearAssistantRecommendations(assistantMsg)
          assistantMsg.content = '[错误] ' + (err || '翻译失败')
          this.saveHistory()
          this.$nextTick(() => this.scrollToBottom())
        }
      })

      this.saveHistory()
      this.scrollToBottom()
    },
    async sendDocumentAwareMessage(userContent, model, prepared = null) {
      const { documentText, snapshot, documentCharCount } = this.getCurrentDocumentPayload()
      if (!documentText) {
        alert('当前文档为空，暂时没有可提交的正文内容')
        return
      }

      const strategy = classifyDocumentRequestStrategy(userContent)
      const { chunks } = this.getDocumentChunks(documentText, strategy)
      if (!this.confirmDocumentChunkSubmission(documentText, chunks.length)) {
        return
      }

      const visibleUserContent = this.buildVisibleUserMessage(userContent, {
        scope: 'document',
        documentCharCount
      })
      const documentApiUserContent = this.buildApiUserContent(userContent, {
        scope: 'document',
        documentText,
        snapshot
      })
      const attachmentPrompt = this.buildAttachmentContext(userContent).attachmentPrompt
      let assistantMsg = prepared?.assistantMsg || null
      if (!assistantMsg) {
        const attachmentsSnapshot = this.cloneAttachmentSnapshot()
        const userMessageMeta = this.buildUserMessageMeta({
          scope: 'document',
          documentCharCount,
          snapshot,
          attachmentsSnapshot
        })
        const chatObj = this.ensureWritableChat(visibleUserContent)
        if (!chatObj) return
        assistantMsg = this.appendChatTurn(chatObj, visibleUserContent, userMessageMeta)
      }
      const summaryText = strategy === 'transform'
        ? `正在处理整篇文档改写（共 ${chunks.length} 段）...`
        : `正在处理整篇文档分析（共 ${chunks.length} 段）...`
      const runContext = this.startActiveDocumentAwareRun(assistantMsg, summaryText)
      const abortSignal = runContext.abortController?.signal || null
      assistantMsg.content = ''
      assistantMsg.isLoading = true
      this.startAssistantLoadingProgress(assistantMsg, {
        label: '正在准备整篇文档任务...',
        detail: '已加入会话，正在整理全文、上下文和分段计划。',
        percent: 14
      })
      this.appendPrimaryRouteDetail(assistantMsg.activeDocumentAwareRun, assistantMsg)
      this.appendDocumentRevisionDetail(assistantMsg.activeDocumentAwareRun, `已识别为整篇文档任务，处理策略：${strategy === 'transform' ? '分段改写/翻译' : '分段阅读后汇总'}。`)
      this.appendDocumentRevisionDetail(assistantMsg.activeDocumentAwareRun, `当前文档约 ${documentCharCount} 字，将按 ${chunks.length} 段处理。`)

      if (!prepared) {
        this.userInput = ''
        this.clearAttachments()
        this.clearSelectionBridgeStorage()
      }

      // 尽快占用「流式/长任务」锁，避免在分段循环开始前又发一条消息，导致新的 startActiveDocumentAwareRun 顶替上下文并被判定为已停止。
      this.isStreaming = true
      this.streamingContent = ''

      if (chunks.length <= 1 && documentCharCount <= DIRECT_DOCUMENT_CHAR_LIMIT && strategy !== 'transform') {
        const recommendationContext = this.getRecommendationContextText(documentApiUserContent)
        this.scheduleAssistantRecommendationsForMessage(recommendationContext, model, assistantMsg, 1200)
        assistantMsg.activeDocumentAwareRun.statusMessage = '正在直接处理整篇文档...'
        this.appendDocumentRevisionDetail(assistantMsg.activeDocumentAwareRun, '文档长度未超出阈值，直接提交整篇文档。')
        streamChatCompletion({
          ribbonModelId: model.id,
          providerId: model.providerId,
          modelId: model.modelId,
          signal: abortSignal,
          messages: [{
            role: 'user',
            content: documentApiUserContent
          }],
          onChunk: (chunk) => {
            if (runContext.cancelled) return
            this.stopAssistantLoadingProgress(assistantMsg)
            assistantMsg.isLoading = false
            this.streamingContent += chunk
            assistantMsg.content = this.streamingContent
            this.$nextTick(() => this.scrollToBottom())
          },
          onDone: () => {
            this.stopAssistantLoadingProgress(assistantMsg)
            assistantMsg.isLoading = false
            this.isStreaming = false
            this.streamingContent = ''
            this.finishActiveDocumentAwareRun(assistantMsg)
            this.requestAssistantEvolutionSuggestionCheck()
            this.saveHistory()
            this.$nextTick(() => this.scrollToBottom())
          },
          onError: (err) => {
            this.stopAssistantLoadingProgress(assistantMsg)
            assistantMsg.isLoading = false
            this.isStreaming = false
            this.streamingContent = ''
            if (runContext.cancelled || String(err || '').includes('已终止')) {
              this.appendDocumentRevisionDetail(assistantMsg.activeDocumentAwareRun, '整篇文档处理已被停止。')
              this.finishActiveDocumentAwareRun(assistantMsg, {
                status: 'cancelled',
                statusMessage: '已停止本次整篇文档处理。'
              })
            } else {
              this.clearAssistantRecommendations(assistantMsg)
              assistantMsg.content = '[错误] ' + (err || '处理失败')
              this.appendDocumentRevisionDetail(assistantMsg.activeDocumentAwareRun, `处理失败：${err || '未知错误'}`)
              this.finishActiveDocumentAwareRun(assistantMsg, {
                status: 'error',
                statusMessage: err || '整篇文档处理失败'
              })
            }
            this.saveHistory()
            this.$nextTick(() => this.scrollToBottom())
          }
        })
        this.saveHistory()
        this.scrollToBottom()
        return
      }

      assistantMsg.activeDocumentAwareRun.statusMessage = `正在准备整篇文档任务，共 ${chunks.length} 段。`
      this.$nextTick(() => this.scrollToBottom())

      try {
        if (strategy === 'transform') {
          const outputs = []
          for (let i = 0; i < chunks.length; i++) {
            this.ensureDocumentAwareRunActive(runContext, assistantMsg)
            if (i === 0) {
              this.stopAssistantLoadingProgress(assistantMsg)
              assistantMsg.isLoading = false
            }
            assistantMsg.content = `正在处理整篇文档（第 ${i + 1}/${chunks.length} 段）...`
            assistantMsg.activeDocumentAwareRun.statusMessage = `正在处理第 ${i + 1}/${chunks.length} 段...`
            this.appendDocumentRevisionDetail(assistantMsg.activeDocumentAwareRun, `开始处理第 ${i + 1}/${chunks.length} 段。`)
            const result = await chatCompletion({
              ribbonModelId: model.id,
              providerId: model.providerId,
              modelId: model.modelId,
              signal: abortSignal,
              temperature: /(翻译|译成|翻成|中译英|英译中)/.test(String(userContent || '')) ? 0.2 : 0.4,
              messages: this.buildDocumentTransformChunkMessages(
                userContent,
                chunks[i],
                i + 1,
                chunks.length,
                attachmentPrompt
              )
            })
            this.ensureDocumentAwareRunActive(runContext, assistantMsg)
            outputs.push(String(result || '').trim())
            this.appendDocumentRevisionDetail(assistantMsg.activeDocumentAwareRun, `第 ${i + 1}/${chunks.length} 段处理完成。`)
            assistantMsg.content = outputs.filter(Boolean).join('\n\n')
            this.$nextTick(() => this.scrollToBottom())
          }
          this.isStreaming = false
          this.streamingContent = ''
          this.stopAssistantLoadingProgress(assistantMsg)
          assistantMsg.isLoading = false
          this.finishActiveDocumentAwareRun(assistantMsg)
          this.saveHistory()
          this.$nextTick(() => this.scrollToBottom())
          return
        }

        const notes = []
        for (let i = 0; i < chunks.length; i++) {
          this.ensureDocumentAwareRunActive(runContext, assistantMsg)
          if (i === 0) {
            this.stopAssistantLoadingProgress(assistantMsg)
            assistantMsg.isLoading = false
          }
          assistantMsg.content = `正在阅读整篇文档（第 ${i + 1}/${chunks.length} 段）...`
          assistantMsg.activeDocumentAwareRun.statusMessage = `正在阅读第 ${i + 1}/${chunks.length} 段...`
          this.appendDocumentRevisionDetail(assistantMsg.activeDocumentAwareRun, `开始阅读第 ${i + 1}/${chunks.length} 段并提取要点。`)
          const note = await chatCompletion({
            ribbonModelId: model.id,
            providerId: model.providerId,
            modelId: model.modelId,
            signal: abortSignal,
            temperature: 0.3,
            messages: this.buildDocumentAnalysisChunkMessages(
              userContent,
              chunks[i],
              i + 1,
              chunks.length,
              attachmentPrompt
            )
          })
          this.ensureDocumentAwareRunActive(runContext, assistantMsg)
          notes.push(`第 ${i + 1} 段要点：\n${String(note || '').trim()}`)
          this.appendDocumentRevisionDetail(assistantMsg.activeDocumentAwareRun, `第 ${i + 1}/${chunks.length} 段阅读完成，已提取要点。`)
          assistantMsg.content = `已完成全文阅读 ${i + 1}/${chunks.length} 段，正在整理结果...`
          this.$nextTick(() => this.scrollToBottom())
        }

        this.scheduleAssistantRecommendationsForMessage(
          this.getRecommendationContextText(`${userContent}\n\n${notes.join('\n\n')}`),
          model,
          assistantMsg,
          1200
        )
        this.streamingContent = ''
        assistantMsg.activeDocumentAwareRun.statusMessage = '分段阅读完成，正在汇总最终结果...'
        this.appendDocumentRevisionDetail(assistantMsg.activeDocumentAwareRun, '全部分段阅读完成，开始汇总最终回答。')
        streamChatCompletion({
          ribbonModelId: model.id,
          providerId: model.providerId,
          modelId: model.modelId,
          signal: abortSignal,
          messages: this.buildDocumentSynthesisMessages(userContent, notes, snapshot),
          onChunk: (chunk) => {
            if (runContext.cancelled) return
            this.stopAssistantLoadingProgress(assistantMsg)
            assistantMsg.isLoading = false
            this.streamingContent += chunk
            assistantMsg.content = this.streamingContent
            this.$nextTick(() => this.scrollToBottom())
          },
          onDone: () => {
            this.stopAssistantLoadingProgress(assistantMsg)
            assistantMsg.isLoading = false
            this.isStreaming = false
            this.streamingContent = ''
            this.appendDocumentRevisionDetail(assistantMsg.activeDocumentAwareRun, '最终结果汇总完成。')
            this.finishActiveDocumentAwareRun(assistantMsg)
            this.requestAssistantEvolutionSuggestionCheck()
            this.saveHistory()
            this.$nextTick(() => this.scrollToBottom())
          },
          onError: (err) => {
            this.stopAssistantLoadingProgress(assistantMsg)
            assistantMsg.isLoading = false
            this.isStreaming = false
            this.streamingContent = ''
            if (runContext.cancelled || String(err || '').includes('已终止')) {
              this.appendDocumentRevisionDetail(
                assistantMsg.activeDocumentAwareRun,
                '最终汇总阶段已被停止。常见原因：点击了对话中的「停止」、关闭了助手窗口、或请求被中止（AbortError）。'
              )
              this.finishActiveDocumentAwareRun(assistantMsg, {
                status: 'cancelled',
                statusMessage: '已停止本次整篇文档处理。'
              })
            } else {
              assistantMsg.content = '[错误] ' + (err || '处理失败')
              this.appendDocumentRevisionDetail(assistantMsg.activeDocumentAwareRun, `最终汇总失败：${err || '未知错误'}`)
              this.finishActiveDocumentAwareRun(assistantMsg, {
                status: 'error',
                statusMessage: err || '整篇文档处理失败'
              })
            }
            this.saveHistory()
            this.$nextTick(() => this.scrollToBottom())
          }
        })
        this.saveHistory()
        this.scrollToBottom()
      } catch (error) {
        this.stopAssistantLoadingProgress(assistantMsg)
        assistantMsg.isLoading = false
        this.isStreaming = false
        this.streamingContent = ''
        if (this.isDocumentAwareCancelledError(error) || error?.name === 'AbortError') {
          this.appendDocumentRevisionDetail(
            assistantMsg.activeDocumentAwareRun,
            '整篇文档处理已停止。常见原因：点击了对话中的「停止」、关闭了助手窗口、或发起了新的同类长任务导致上一次被中断。'
          )
          this.finishActiveDocumentAwareRun(assistantMsg, {
            status: 'cancelled',
            statusMessage: '已停止本次整篇文档处理。'
          })
        } else {
          this.clearAssistantRecommendations(assistantMsg)
          assistantMsg.content = '[错误] ' + (error?.message || '整篇文档处理失败')
          this.appendDocumentRevisionDetail(assistantMsg.activeDocumentAwareRun, `处理失败：${error?.message || '未知错误'}`)
          this.finishActiveDocumentAwareRun(assistantMsg, {
            status: 'error',
            statusMessage: error?.message || '整篇文档处理失败'
          })
        }
        this.saveHistory()
        this.$nextTick(() => this.scrollToBottom())
      }
    },
    showAssistantRunParameterCollection(item) {
      const config = this.getAssistantRecommendationConfig(item) || {}
      const demand = this.createDirectAssistantRunDemand(item, config)
      const option = {
        assistantId: item.key,
        label: item.shortLabel || item.label || '智能助手',
        title: item.label || item.shortLabel || '智能助手',
        description: String(item.description || config?.description || config?.persona || '可基于当前需求直接执行。').trim(),
        source: item.type,
        reasonText: '手动选择执行',
        featureLines: []
      }
      const chatObj = this.getOrCreateWritableChat()
      if (!chatObj) return false
      if (this.currentMessages.length === 0) {
        this.startWelcomeSupportExitAnimation()
      }
      const assistantMessageId = 'a' + Date.now()
      const label = item.shortLabel || item.label || '智能助手'
      chatObj.messages.push({
        id: assistantMessageId,
        role: 'assistant',
        content: `执行“${label}”前，请先确认本次参数。`,
        recommendations: [],
        missingSkillNotice: false,
        generatedFiles: [],
        pendingAssistantParameterCollection: this.createPendingAssistantExecutionParameterCollection(
          demand,
          option,
          {
            summaryText: `即将执行助手“${label}”，请先确认本次执行参数。`,
            confirmPrompt: '确认后将按这些参数启动助手任务。',
            statusMessage: '请确认参数、文档范围与处理完成后的动作。'
          }
        )
      })
      if (!chatObj.title || chatObj.title === '新对话') {
        chatObj.title = `执行${label}`.slice(0, 20)
      }
      this.saveHistory()
      this.$nextTick(() => this.scrollToBottom())
      return true
    },
    async runAssistant(item) {
      if (!item?.key || this.assistantRunLoadingKey) return
      try {
        const launchInfo = getAssistantLaunchInfo(item.key)
        if (!this.confirmAssistantRun(launchInfo)) return
        if (this.shouldCollectAssistantRunParameters(item)) {
          this.showAssistantRunParameterCollection(item)
          return
        }
        this.assistantRunLoadingKey = item.key
        const taskTitle = item.shortLabel || item.label || '任务进度'
        const { taskId, promise } = startAssistantTask(item.key, {
          taskTitle,
          ...this.getConversationModelTaskOverrides()
        })
        if (!taskId) {
          throw new Error('任务启动失败，未能创建任务')
        }
        this.openDialogRoute(
          '/task-progress-dialog',
          { taskId },
          taskTitle,
          520,
          260
        )
        promise.catch((error) => {
          if (error?.code === 'TASK_CANCELLED') return
          alert(error?.message || '助手执行失败')
        }).finally(() => {
          if (this.assistantRunLoadingKey === item.key) {
            this.assistantRunLoadingKey = ''
          }
        })
      } catch (error) {
        this.assistantRunLoadingKey = ''
        alert(error?.message || '助手执行失败')
      }
    },
    async sendMessage() {
      const sendStartedAt = Date.now()
      const text = this.userInput.trim()
      if ((!text && this.attachments.length === 0) || this.isStreaming) return
      if (this.activeDocumentRevisionRunContext?.messageId) {
        window.alert('当前正在生成文档修订预览（已发起模型请求）。请等待本条完成，或先在消息进度区点击「停止」后再发送新内容；否则新消息会中断本次修订。')
        return
      }

      const isFirstConversationMessage = this.currentMessages.length === 0
      this.startSendLaunchEffect()
      if (isFirstConversationMessage) {
        this.startWelcomeSupportExitAnimation()
      }
      const prepared = this.prepareOutgoingMessages(text)
      if (!prepared) return
      const { chatObj, userMessageId, assistantMsg, selectionSnapshot, attachmentsSnapshot } = prepared
      this.startMessageEntryEffect(userMessageId, 'user')
      this.startMessageEntryEffect(assistantMsg?.id, 'assistant')

      const localFaq = this.shouldUseCurrentDocumentIntroLocalFaq(text, selectionSnapshot)
        ? this.buildCurrentDocumentIntroLocalFaq(text, selectionSnapshot)
        : resolveAssistantLocalFaq(text)
      if (localFaq) {
        this.startAssistantLocalFaqMessage(prepared, localFaq)
        return
      }

      const exactTool = resolveExactToolRequest(text, {
        materialText: this.resolveExactStatsMaterialText(text)
      })
      const exactStats = exactTool?.result
      if (exactTool?.answer && exactStats) {
        this.startAssistantLocalFaqMessage(prepared, {
          type: exactStats.kind,
          title: `${exactStats.targetLabel || '条目'}统计`,
          detail: '本次请求已由本地精确统计工具处理，不消耗模型调用。',
          reason: '已识别为计数/统计类请求，使用确定性程序完成。',
          text: exactTool.answer,
          existingAssistantHints: [],
          suggestedAction: null
        })
        recordPerf({
          kind: 'send.local-exact-stats',
          durationMs: Date.now() - sendStartedAt,
          ok: true,
          bytes: Number(exactStats?.materialCharCount || 0),
          note: exactStats.method
        })
        return
      }

      const model = this.selectedModel
      if (!model) {
        const messages = Array.isArray(chatObj?.messages) ? chatObj.messages : []
        const assistantIndex = messages.findIndex(item => item?.id === assistantMsg?.id)
        if (assistantIndex >= 0) {
          messages.splice(assistantIndex, 1)
        }
        const userIndex = messages.findIndex(item => item?.id === userMessageId)
        if (userIndex >= 0) {
          messages.splice(userIndex, 1)
        }
        this.saveHistory()
        const shouldOpenSettings = window.confirm(
          '当前还没有可用模型。请先在设置中开启提供商、填写 API 地址与密钥，并刷新模型清单。是否现在前往模型设置？'
        )
        if (shouldOpenSettings) {
          this.openModelSettings()
        }
        return
      }

      assistantMsg.isLoading = true
      this.startAssistantLoadingProgress(assistantMsg, {
        label: '已发送，正在识别请求...',
        detail: '内容已加入会话，正在分析应走的处理链路。',
        percent: 6
      })
      this.$nextTick(() => this.scrollToBottom())
      this.saveHistory()
      await this.waitForUiCommit()

      try {
        const routeStartedAt = Date.now()
        const primaryIntent = await this.resolvePrimaryConversationIntent(text, model)
        recordPerf({
          kind: 'send.route.primary',
          providerId: model?.providerId,
          modelId: model?.modelId,
          durationMs: Date.now() - routeStartedAt,
          ok: true,
          note: String(primaryIntent?.kind || 'chat')
        })
        const routeKind = String(primaryIntent?.kind || 'chat')
        assistantMsg.primaryRoute = {
          kind: routeKind,
          confidence: String(primaryIntent?.confidence || '').trim() || 'low',
          reason: String(primaryIntent?.reason || '').trim()
        }
        this.updateAssistantLoadingProgress(assistantMsg, {
          label: `已识别为${this.getMessagePrimaryRouteLabel(assistantMsg) || '当前请求'}...`,
          detail: this.getMessagePrimaryRouteDetail(assistantMsg) || '正在根据识别结果选择处理链路。',
          percent: 12
        })
        this.saveHistory()

        if (routeKind === 'wps-capability') {
          const wpsCapabilityRoute = await resolveWpsCapabilityRoute(text, model)
          if (wpsCapabilityRoute?.capabilityKey) {
            assistantMsg.content = '已识别到可直接执行的 WPS 操作，请确认参数后继续。'
            const capability = getCapabilityBusItem(wpsCapabilityRoute.capabilityKey) || getWpsCapabilityByKey(wpsCapabilityRoute.capabilityKey)
            assistantMsg.pendingWpsCapabilityForm = this.createPendingWpsCapabilityForm(capability, text, {
              statusMessage: wpsCapabilityRoute.reason
                ? `识别结果：${wpsCapabilityRoute.reason}`
                : '已识别到 WPS 直接操作能力，请确认参数。'
            })
            assistantMsg.isLoading = false
            this.stopAssistantLoadingProgress(assistantMsg)
            this.scheduleWpsCapabilityAutoContinue(assistantMsg)
            this.saveHistory()
            this.$nextTick(() => this.scrollToBottom())
            return
          }
          this.showWpsCapabilityClarificationNeed(assistantMsg, wpsCapabilityRoute?.reason || primaryIntent?.reason)
          return
        }

        if (routeKind === 'document-operation') {
          this.loadAssistantItems()
          const userScope = this.resolveUserTaskInputScope(text, { routeKind })
          const routedScope = userScope.requestedScope === 'selection-preferred'
            ? null
            : userScope.requestedScope
          const routedOperation = await this.inferDocumentOperationRouteWithModel(text, model)
          if (routedOperation?.isDocumentOperation) {
            const routerSaysUnsupported = routedOperation.supported === false || routedOperation.primaryAction === 'unsupported'
            if (!routerSaysUnsupported) {
              const candidateActions = Array.from(new Set([
                String(routedOperation.primaryAction || '').trim(),
                ...(Array.isArray(routedOperation.candidateActions) ? routedOperation.candidateActions : [])
              ].filter(Boolean)))
              const assistantDrivenActions = candidateActions.filter(key => this.isAssistantDrivenDocumentAction(key))
              const legacyActions = candidateActions.filter(key => !this.isAssistantDrivenDocumentAction(key))
              if (assistantDrivenActions.length > 0 && legacyActions.length === 0) {
                const revisionActionKeys = assistantDrivenActions.filter(key => this.isDocumentRevisionChoiceAction(key))
                if (await this.dispatchDocumentOperationChoice(text, model, assistantDrivenActions[0], {
                  prepared,
                  scope: routedScope || routedOperation.scope,
                  revisionActionKeys
                })) {
                  return
                }
              }
              const needsChoice = routedOperation.confidence !== 'high' || candidateActions.length > 1
              if (needsChoice && !(assistantDrivenActions.length > 0 && legacyActions.length === 0)) {
                assistantMsg.content = '已识别到可能的文档操作，请确认后继续处理。'
                assistantMsg.pendingDocumentOperationChoice = this.createPendingDocumentOperationChoice({
                  ...routedOperation,
                  scope: routedScope || routedOperation.scope
                }, text)
                assistantMsg.isLoading = false
                this.stopAssistantLoadingProgress(assistantMsg)
                this.scheduleDocumentOperationChoiceAutoContinue(assistantMsg)
                this.saveHistory()
                this.$nextTick(() => this.scrollToBottom())
                return
              }
              if (await this.dispatchDocumentOperationChoice(text, model, routedOperation.primaryAction, {
                prepared,
                scope: routedScope || routedOperation.scope
              })) {
                return
              }
            }
          }
        }

        if (routeKind === 'document-operation' && this.shouldTryDocumentDeclassifyRestoreIntent(text)) {
          this.loadAssistantItems()
          if (await this.dispatchDocumentOperationChoice(text, model, 'document-declassify-restore', { prepared })) {
            return
          }
        }
        if (routeKind === 'document-operation' && this.shouldTryDocumentDeclassifyIntent(text)) {
          this.loadAssistantItems()
          if (await this.dispatchDocumentOperationChoice(text, model, 'document-declassify', { prepared })) {
            return
          }
        }
        if (routeKind === 'document-operation' && this.shouldTrySecretKeywordExtractOnlyIntent(text)) {
          this.loadAssistantItems()
          if (await this.dispatchDocumentOperationChoice(text, model, 'secret-keyword-extract', { prepared })) {
            return
          }
        }

        if (routeKind === 'document-operation' && this.shouldTryDocumentRelocationIntent(text)) {
          this.loadAssistantItems()
          this.startDocumentRelocationMessage(text, model, prepared)
          return
        }

        if (routeKind === 'document-operation' && this.shouldTryDocumentTextEditIntent(text)) {
          this.loadAssistantItems()
          this.startDocumentTextEditMessage(text, model, prepared)
          return
        }

        if (routeKind === 'document-operation' && this.shouldTryDocumentDeleteIntent(text)) {
          this.loadAssistantItems()
          this.startDocumentDeleteMessage(text, model, prepared)
          return
        }

        if (routeKind === 'document-operation' && this.shouldTryDocumentFormatIntent(text)) {
          this.loadAssistantItems()
          this.startDocumentFormatMessage(text, model, prepared)
          return
        }

        if (routeKind === 'document-operation' && this.shouldTryDocumentRevisionIntent(text)) {
          this.loadAssistantItems()
          await this.startDocumentRevisionMessage(text, model, prepared)
          return
        }

        const documentCommentIntent = routeKind === 'document-operation'
          ? detectDocumentCommentIntent(text)
          : null
        if (documentCommentIntent) {
          this.loadAssistantItems()
          await this.startDocumentCommentMessage(text, model, documentCommentIntent, prepared)
          return
        }

        const documentScopeIntent = routeKind === 'document-operation'
          ? detectDocumentScopeIntent(text)
          : null
        if (documentScopeIntent) {
          const documentAwareScope = this.resolveUserTaskInputScope(text, { routeKind })
          const canUseDocumentMaterial = documentAwareScope.resolvedScope !== 'prompt'
          if (canUseDocumentMaterial) {
            this.loadAssistantItems()
            await this.sendDocumentAwareMessage(text, model, prepared)
            return
          }
        }

        const translateIntent = routeKind === 'document-operation'
          ? detectSelectionTranslateIntent(
              text,
              getAssistantSetting('translate')?.targetLanguage || '英文'
            )
          : null
        if (translateIntent) {
          this.loadAssistantItems()
          this.sendSelectionAwareTranslateMessage(text, model, translateIntent, prepared)
          return
        }

        if (routeKind === 'assistant-task') {
          this.loadAssistantItems()
          if (this.isAssistantVersionPromotionRequest(text) || this.isAssistantVersionRollbackRequest(text)) {
            if (this.applyAssistantVersionGovernanceRequest(assistantMsg, text)) {
              return
            }
          }
          if (this.isAssistantRepairRequest(text)) {
            const repairCandidates = this.resolveNamedCustomAssistantCandidates(text)
            if (repairCandidates.length > 1) {
              assistantMsg.content = '已识别到修复助手需求，但当前匹配到了多个候选助手。'
              assistantMsg.pendingAssistantRepairChoice = this.createPendingAssistantRepairChoice(
                text,
                repairCandidates.map((item) => ({
                  assistantId: item.assistant.id,
                  label: item.assistant.name,
                  title: item.assistant.name,
                  description: item.assistant.description || item.assistant.persona || '未填写功能说明',
                  reasonText: item.score >= 10 ? '命中完整助手名称' : '名称关键词与当前需求高度接近',
                  featureLines: []
                }))
              )
              assistantMsg.isLoading = false
              this.stopAssistantLoadingProgress(assistantMsg)
              this.saveHistory()
              this.$nextTick(() => this.scrollToBottom())
              return
            }
            const repairTargetAssistant = repairCandidates[0]?.assistant || null
            if (repairTargetAssistant) {
              assistantMsg.content = `已识别到修复助手需求，将基于《${repairTargetAssistant.name}》生成新的修复版。`
              assistantMsg.pendingAssistantCreationDraft = await this.enrichPendingAssistantRepairDraft(
                this.createPendingAssistantRepairDraft(text, repairTargetAssistant),
                repairTargetAssistant,
                text
              )
              assistantMsg.isLoading = false
              this.stopAssistantLoadingProgress(assistantMsg)
              this.scheduleAssistantCreationDraftAutoContinue(assistantMsg)
              this.saveHistory()
              this.$nextTick(() => this.scrollToBottom())
              return
            }
          }
          const inferredAssistantMatches = await this.inferAssistantRecommendationWithModel(text, model)
          if (inferredAssistantMatches.length > 0) {
            const demand = this.createGeneralAssistantDemand(
              text,
              inferredAssistantMatches.map(item => item.key)
            )
            const assistantOptions = this.resolveAssistantOptionsForDemand(demand)
            if (assistantOptions.length > 0) {
              if (await this.tryExplicitAssistantExecutionAfterRecommendation(assistantMsg, text, demand, assistantOptions)) {
                return
              }
              this.updateAssistantLoadingProgress(assistantMsg, {
                label: '已命中助手候选，直接继续...',
                detail: '为减少等待，本轮先直接用大模型对话输出；你仍可在助手面板手动执行助手。',
                percent: 44
              })
            }
          }
          if (this.isExplicitAssistantCreationRequest(text)) {
            this.showAssistantTaskClarificationNeed(assistantMsg, text, {
              createDraft: true
            })
            return
          }
        }

        this.isStreaming = true
        this.streamingContent = ''
        this.updateAssistantLoadingProgress(assistantMsg, {
          label: '已发送，正在准备请求...',
          detail: '内容已加入会话，正在整理上下文、附件和模型参数。',
          percent: 10
        })
        window.setTimeout(() => this.saveHistory(), 0)
        this.updateAssistantLoadingProgress(assistantMsg, {
          label: '正在整理上下文...',
          detail: '已捕获最近对话、选区信息和附件快照。',
          percent: 26
        })
        const taskInputScope = this.resolveUserTaskInputScope(text, { routeKind })
        const suggestedDocumentAction = this.resolveDocumentActionPreferenceFromText(text) || ''
        const wantsPlainIntro = this.shouldForcePlainTextIntroResponse(text)
        const promptOnlyCreation = isPromptOnlyCreationRequest(text)
        const wantsPlainParagraph = (routeKind === 'document-operation' || !!suggestedDocumentAction) && !wantsPlainIntro && !promptOnlyCreation
        const shouldNormalizePlain = wantsPlainIntro || wantsPlainParagraph
        let documentText = ''
        let snapshot = selectionSnapshot || null
        let documentCharCount = 0
        if (taskInputScope.resolvedScope === 'document') {
          const documentPayload = this.getCurrentDocumentPayload()
          documentText = documentPayload.documentText
          snapshot = documentPayload.snapshot
          documentCharCount = documentPayload.documentCharCount
        }
        this.applyResolvedUserScopeMeta(chatObj, userMessageId, taskInputScope, {
          selectionSnapshot,
          documentCharCount
        })
        const apiScopeOptions = {
          selectionSnapshot,
          attachmentsSnapshot,
          taskInputScope,
          suggestedDocumentAction,
          scope: taskInputScope.resolvedScope === 'document'
            ? 'document'
            : taskInputScope.resolvedScope === 'prompt'
              ? 'prompt'
              : 'selection',
          documentText,
          snapshot,
          documentCharCount
        }
        const rawApiUserContent = this.buildBufferedApiUserContent(text, {
          ...apiScopeOptions
        })
        const apiUserContent = shouldNormalizePlain
          ? (wantsPlainIntro
              ? this.appendPlainTextIntroInstruction(rawApiUserContent)
              : this.appendPlainParagraphDocumentInstruction(rawApiUserContent))
          : rawApiUserContent
        this.loadAssistantItems()
        this.updateAssistantLoadingProgress(assistantMsg, {
          label: '正在分析请求...',
          detail: '检查是否需要生成文件、图片、视频或其他特殊输出。',
          percent: 42
        })
        if (routeKind === 'generated-output') {
          const generatedOutputIntent = await this.resolveGeneratedOutputIntent(text, model)
          if (generatedOutputIntent) {
            if (this.shouldUseReportGenerationFlow(generatedOutputIntent, text)) {
              assistantMsg.content = '已识别到报告或总结文件生成需求，请先确认生成参数。'
              assistantMsg.pendingReportGenerationForm = this.createPendingReportGenerationForm(text, generatedOutputIntent)
              assistantMsg.isLoading = false
              this.stopAssistantLoadingProgress(assistantMsg)
              this.isStreaming = false
              this.scheduleReportGenerationAutoContinue(assistantMsg)
              this.saveHistory()
              this.$nextTick(() => this.scrollToBottom())
              return
            }
            if (this.shouldUseMultimodalParameterFlow(generatedOutputIntent)) {
              assistantMsg.content = `已识别到${generatedOutputIntent.action === 'image' ? '图片' : generatedOutputIntent.action === 'video' ? '视频' : '语音'}生成需求，请先确认参数。`
              assistantMsg.pendingMultimodalGenerationForm = this.createPendingMultimodalGenerationForm(text, generatedOutputIntent, {
                modelId: model.id
              })
              assistantMsg.isLoading = false
              this.stopAssistantLoadingProgress(assistantMsg)
              this.isStreaming = false
              this.scheduleMultimodalGenerationAutoContinue(assistantMsg)
              this.saveHistory()
              this.$nextTick(() => this.scrollToBottom())
              return
            }
            assistantMsg.isLoading = false
            this.stopAssistantLoadingProgress(assistantMsg)
            this.isStreaming = false
            this.saveHistory()
            await this.handleGeneratedOutputMessage(text, model, generatedOutputIntent, prepared)
            return
          }
          this.showGeneratedOutputClarificationNeed(assistantMsg, primaryIntent?.reason)
          return
        }

        const recommendationContext = this.getRecommendationContextText(apiUserContent)
        this.scheduleAssistantRecommendationsForMessage(recommendationContext, model, assistantMsg, 1200)
        this.updateAssistantLoadingProgress(assistantMsg, {
          label: '模型已接收请求...',
          detail: '正在等待首段回复返回。',
          percent: 68
        })
        const contextBuildStartedAt = Date.now()
        const { rawMessagesForApi, messagesForApi, contextBuildMeta } = buildChatFlowRequestContext(chatObj, {
          userMessageId,
          apiUserContent,
          chatId: chatObj?.id || this.currentChatId,
          scopeKey: this.historyStorageScopeKey || this.currentChatId || chatObj?.id || '',
          maxContextChars: 12000,
          recentMessageLimit: 10,
          summaryCharLimit: 2200
        })
        recordPerf({
          kind: 'send.context.build',
          providerId: model?.providerId,
          modelId: model?.modelId,
          durationMs: Date.now() - contextBuildStartedAt,
          ok: true,
          bytes: Number(contextBuildMeta?.totalCharsAfter || 0),
          note: String(contextBuildMeta?.budgetLevel || '')
        })
        assistantMsg.messageMeta = {
          ...(assistantMsg.messageMeta && typeof assistantMsg.messageMeta === 'object' ? assistantMsg.messageMeta : {}),
          contextBuildMeta
        }
        this.updateAssistantLoadingProgress(assistantMsg, {
          label: contextBuildMeta?.usedSummary || contextBuildMeta?.wasTrimmed
            ? '已完成上下文治理...'
            : '上下文已就绪...',
          detail: contextBuildMeta?.usedSummary || contextBuildMeta?.wasTrimmed
            ? `本轮共整理 ${contextBuildMeta?.originalMessageCount || 0} 条消息，实际发送 ${contextBuildMeta?.includedMessageCount || 0} 条，预算档位 ${contextBuildMeta?.budgetLevel || 'balanced'}。`
            : `本轮发送 ${contextBuildMeta?.includedMessageCount || rawMessagesForApi.length || 0} 条上下文消息，预算档位 ${contextBuildMeta?.budgetLevel || 'balanced'}。`,
          percent: 76
        })

        let rawStreamText = ''
        let firstChunkRecorded = false
        streamChatCompletion({
          ribbonModelId: model.id,
          providerId: model.providerId,
          modelId: model.modelId,
          messages: messagesForApi,
          onChunk: (chunk) => {
            if (!firstChunkRecorded) {
              firstChunkRecorded = true
              recordPerf({
                kind: 'send.first-chunk',
                providerId: model?.providerId,
                modelId: model?.modelId,
                durationMs: Date.now() - sendStartedAt,
                ok: true,
                bytes: String(chunk || '').length
              })
            }
            this.stopAssistantLoadingProgress(assistantMsg)
            assistantMsg.isLoading = false
            rawStreamText += chunk
            const displayText = shouldNormalizePlain
              ? this.normalizePlainTextIntroOutput(rawStreamText)
              : rawStreamText
            this.streamingContent = displayText
            assistantMsg.content = displayText
            this.$nextTick(() => this.scrollToBottom())
          },
          onDone: () => {
            this.stopAssistantLoadingProgress(assistantMsg)
            assistantMsg.isLoading = false
            this.isStreaming = false
            if (shouldNormalizePlain) {
              assistantMsg.content = this.normalizePlainTextIntroOutput(rawStreamText || assistantMsg.content)
            }
            try {
              if ((contextBuildMeta?.usedSummary || contextBuildMeta?.wasTrimmed) && assistantMsg.content) {
                appendChatMemoryRecord({
                  chatId: chatObj?.id || this.currentChatId,
                  scopeKey: this.historyStorageScopeKey || this.currentChatId || chatObj?.id || '',
                  memoryType: contextBuildMeta?.summaryAuditRequired ? 'summary-audit' : 'summary',
                  title: contextBuildMeta?.summaryAuditRequired ? '会话长期记忆（待抽检）' : '会话长期记忆',
                  summary: assistantMsg.content,
                  content: assistantMsg.content,
                  sourceMessageCount: Number(contextBuildMeta?.originalMessageCount || 0),
                  qualityScore: Number(contextBuildMeta?.summaryQualityScore || 0),
                  budgetLevel: contextBuildMeta?.budgetLevel || '',
                  auditRequired: contextBuildMeta?.summaryAuditRequired === true
                })
              }
            } catch (_) {
              // Ignore long-term memory persistence failures for now.
            }
            try {
              appendEvaluationRecord(buildChatEvaluationRecord({
                title: '普通聊天评测',
                chatId: chatObj?.id || this.currentChatId,
                messageId: assistantMsg?.id,
                inputText: text,
                outputText: assistantMsg.content,
                providerId: model?.providerId,
                modelId: model?.modelId,
                attachmentCount: Array.isArray(attachmentsSnapshot) ? attachmentsSnapshot.length : 0,
                contextMeta: contextBuildMeta
              }))
            } catch (_) {
              // Ignore evaluation persistence failures so the main chat flow stays unaffected.
            }
            this.streamingContent = ''
            this.requestAssistantEvolutionSuggestionCheck()
            recordPerf({
              kind: 'send.total',
              providerId: model?.providerId,
              modelId: model?.modelId,
              durationMs: Date.now() - sendStartedAt,
              ok: true,
              bytes: String(assistantMsg.content || '').length,
              note: routeKind
            })
            this.saveHistory()
            this.$nextTick(() => this.scrollToBottom())
          },
          onError: (err) => {
            this.stopAssistantLoadingProgress(assistantMsg)
            assistantMsg.isLoading = false
            this.isStreaming = false
            this.streamingContent = ''
            this.clearAssistantRecommendations(assistantMsg)
            assistantMsg.content = '[错误] ' + this.formatAssistantTaskError(err || '请求失败')
            recordPerf({
              kind: 'send.total',
              providerId: model?.providerId,
              modelId: model?.modelId,
              durationMs: Date.now() - sendStartedAt,
              ok: false,
              note: String(err?.message || err || '请求失败').slice(0, 80)
            })
            this.saveHistory()
            this.$nextTick(() => this.scrollToBottom())
          }
        })
        this.saveHistory()
        this.scrollToBottom()
      } catch (err) {
        this.stopAssistantLoadingProgress(assistantMsg)
        assistantMsg.isLoading = false
        this.isStreaming = false
        this.clearAssistantRecommendations(assistantMsg)
        assistantMsg.content = '[错误] ' + this.formatAssistantTaskError(err?.message || '处理失败')
        recordPerf({
          kind: 'send.total',
          providerId: model?.providerId,
          modelId: model?.modelId,
          durationMs: Date.now() - sendStartedAt,
          ok: false,
          note: String(err?.message || '处理失败').slice(0, 80)
        })
        this.saveHistory()
        this.$nextTick(() => this.scrollToBottom())
      }
    },
    scrollToBottom() {
      this.$nextTick(() => {
        const el = this.$refs.messagesRef
        if (el) el.scrollTop = el.scrollHeight
      })
    },
    openResultActionModal(mode, messageText = '') {
      const text = String(messageText || '').trim()
      if (!text) return
      this.insertModalMode = mode || 'insert'
      this.insertModalContent = prepareDialogDisplayText(text)
      this.showInsertModal = true
    },
    insertToDocument() {
      this.openResultActionModal('insert', this.lastAssistantMessage)
    },
    replaceDocumentContent() {
      this.openResultActionModal('replace', this.lastAssistantMessage)
    },
    appendToDocument() {
      this.openResultActionModal('append', this.lastAssistantMessage)
    },
    insertAsComment() {
      this.openResultActionModal('comment', this.lastAssistantMessage)
    },
    confirmInsert() {
      const text = prepareDialogDisplayText(this.insertModalContent.trim())
      if (!text) {
        alert('内容不能为空')
        return
      }
      this.showInsertModal = false
      if (this.insertModalMode === 'replace') {
        this.doReplaceDocumentContent(text)
        return
      }
      if (this.insertModalMode === 'append') {
        this.doAppendToDocument(text)
        return
      }
      if (this.insertModalMode === 'comment') {
        this.doInsertAsComment(text)
        return
      }
      this.doInsertToDocument(text)
    },
    doInsertToDocument(text) {
      try {
        applyDocumentAction('insert', text, { title: '察元 AI 助手' })
      } catch (e) {
        reportError('插入到文档失败', e)
      }
    },
    doReplaceDocumentContent(text) {
      try {
        applyDocumentAction('replace', text, { title: '察元 AI 助手' })
      } catch (e) {
        reportError('替换文档内容失败', e)
      }
    },
    doAppendToDocument(text) {
      try {
        applyDocumentAction('append', text, { title: '察元 AI 助手' })
      } catch (e) {
        reportError('追加到文末失败', e)
      }
    },
    doInsertAsComment(text) {
      try {
        applyDocumentAction('comment', text, { title: '察元 AI 助手' })
      } catch (e) {
        reportError('插入批注失败', e)
      }
    }
  }
}
</script>

<style scoped>
.ai-assistant-dialog {
  --ai-bg: #f6f8ff;
  --ai-sidebar-bg: rgba(245, 247, 252, 0.86);
  --ai-border: rgba(219, 226, 239, 0.86);
  --ai-text: #1f2937;
  --ai-text-muted: #6b7280;
  --ai-user-bg: linear-gradient(135deg, rgba(219, 234, 254, 0.96), rgba(224, 242, 254, 0.88));
  --ai-assistant-bg: rgba(255, 255, 255, 0.88);
  --ai-shadow: 0 1px 3px rgba(0,0,0,0.08);
  --ai-radius: 8px;
  --ai-radius-sm: 6px;

  display: flex;
  height: 100vh;
  width: 100%;
  min-width: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', sans-serif;
  font-size: 14px;
  background:
    radial-gradient(circle at 18% 12%, rgba(139, 92, 246, 0.12), transparent 30%),
    radial-gradient(circle at 86% 18%, rgba(74, 108, 247, 0.11), transparent 28%),
    linear-gradient(180deg, #fbfcff 0%, var(--ai-bg) 46%, #f8fafc 100%);
  color: var(--ai-text);
}

.sidebar {
  flex-shrink: 0;
  background: var(--ai-sidebar-bg);
  border-right: 1px solid var(--ai-border);
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  transition: width 0.18s ease;
}

.sidebar.resizing {
  transition: none;
}

.sidebar.collapsed {
  border-right: none;
}

.sidebar-tabbar {
  display: flex;
  padding: 0 16px;
  border-bottom: 1px solid var(--ai-border);
}

.layout-divider {
  position: relative;
  flex-shrink: 0;
  width: 12px;
  cursor: col-resize;
  background: transparent;
}

.layout-divider::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1px;
  transform: translateX(-50%);
  background: var(--ai-border);
}

.layout-divider.dragging::before,
.layout-divider:hover::before {
  background: #0ea5e9;
}

.layout-divider-toggle {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 42px;
  padding: 0;
  border: 1px solid var(--ai-border);
  border-radius: 999px;
  background: #fff;
  color: var(--ai-text-muted);
  box-shadow: var(--ai-shadow);
  cursor: pointer;
}

.layout-divider-toggle:hover {
  color: #0284c7;
  border-color: #0ea5e9;
}

.sidebar-pane {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.sidebar-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  padding: 12px;
  border-top: 1px solid rgba(229, 231, 235, 0.8);
  background: var(--ai-sidebar-bg);
  position: relative;
  z-index: 1;
}

.sidebar-settings-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--ai-border);
  border-radius: 10px;
  background: #fff;
  color: var(--ai-text-muted);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  cursor: pointer;
  transition: all 0.18s ease;
}

.sidebar-settings-btn:hover {
  color: #0369a1;
  border-color: #0ea5e9;
  background: rgba(14, 165, 233, 0.06);
}

.sidebar-footer-brand {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.sidebar-footer-content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sidebar-footer-brand-name {
  font-size: 12px;
  line-height: 1.35;
  color: var(--ai-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-footer-actions {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.sidebar-footer-brand-link {
  font-size: 12px;
  line-height: 1.35;
  color: #0369a1;
  text-decoration: none;
}

.sidebar-footer-brand-link:hover {
  text-decoration: underline;
}

.sidebar-footer-text-btn {
  min-width: 64px;
  padding: 4px 10px;
  border: 1px solid rgba(14, 165, 233, 0.18);
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.08);
  color: #0369a1;
  font-size: 12px;
  line-height: 1.2;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.18s ease;
}

.sidebar-footer-text-btn:hover {
  border-color: rgba(14, 165, 233, 0.34);
  background: rgba(14, 165, 233, 0.14);
  transform: translateY(-1px);
}

.sidebar-footer-support-modal {
  width: min(560px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  overflow: hidden;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.22);
}

.sidebar-footer-support-modal .modal-header {
  position: relative;
  justify-content: center;
}

.sidebar-footer-support-modal .modal-header h4 {
  flex: none;
  width: 100%;
  margin: 0;
  text-align: center;
}

.sidebar-footer-support-modal .btn-close-modal {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
}

.sidebar-footer-support-modal-body {
  padding-top: 4px;
}

.sidebar-footer-support-cards {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.sidebar-footer-support-cards--single {
  justify-content: center;
}

.tab-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px 10px;
  border-bottom: 1px solid rgba(229, 231, 235, 0.8);
}

.sidebar-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 18px;
  padding: 12px 2px 11px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ai-text-muted);
  cursor: pointer;
  user-select: none;
}

.sidebar-tab.active {
  color: #0369a1;
}

.sidebar-tab.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: #0ea5e9;
}

.sidebar-tab-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  color: var(--ai-text-muted);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  box-sizing: border-box;
}

.sidebar-tab.active .sidebar-tab-badge {
  background: rgba(14, 165, 233, 0.14);
  color: #0369a1;
}

.tab-toolbar-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--ai-text);
}

.toolbar-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--ai-border);
  border-radius: 8px;
  background: #fff;
  color: var(--ai-text);
  font-size: 12px;
  cursor: pointer;
}

.toolbar-action-btn:hover,
.toolbar-icon-btn:hover {
  border-color: #0ea5e9;
  color: #0284c7;
}

.assistant-toolbar {
  gap: 10px;
}

.chat-toolbar {
  gap: 10px;
}

.toolbar-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--ai-border);
  border-radius: 8px;
  background: #fff;
  color: var(--ai-text);
  cursor: pointer;
  flex-shrink: 0;
}

.assistant-search {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  height: 32px;
  border: 1px solid var(--ai-border);
  border-radius: 8px;
  background: #fff;
  color: var(--ai-text-muted);
}

.assistant-search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--ai-text);
  font-size: 12px;
}

.chat-search {
  max-width: none;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.assistant-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px 12px;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--ai-text);
}

.history-item:hover {
  background: rgba(0,0,0,0.04);
}

.history-item.active {
  background: var(--ai-user-bg);
  border-right: 2px solid #0ea5e9;
}

.history-empty {
  padding: 16px;
  color: var(--ai-text-muted);
  font-size: 13px;
}

.history-title {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.assistant-group + .assistant-group {
  margin-top: 14px;
}

.assistant-group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ai-text-muted);
  cursor: pointer;
  user-select: none;
}

.assistant-group-label {
  flex: 1;
  min-width: 0;
}

.assistant-group-arrow {
  width: 14px;
  text-align: center;
  transition: transform 0.2s ease;
}

.assistant-group-title.collapsed .assistant-group-arrow {
  transform: rotate(-90deg);
}

.assistant-group-count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  box-sizing: border-box;
}

.assistant-group-items {
  padding-top: 2px;
}

.assistant-item {
  padding: 10px 12px;
  border: 1px solid var(--ai-border);
  border-radius: 10px;
  background: #fff;
  box-shadow: var(--ai-shadow);
  transition: border-color 0.22s ease, box-shadow 0.22s ease, background-color 0.22s ease, transform 0.22s ease;
}

.assistant-item--highlighted {
  border-color: rgba(14, 165, 233, 0.58);
  background: linear-gradient(180deg, rgba(14, 165, 233, 0.12), rgba(255, 255, 255, 0.98));
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.16), 0 12px 24px rgba(14, 165, 233, 0.12);
  transform: translateY(-1px);
}

.assistant-item + .assistant-item {
  margin-top: 8px;
}

.assistant-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.assistant-item-main {
  display: flex;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.assistant-item-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 7px;
  background: rgba(14, 165, 233, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-size: 18px;
}

.assistant-item-icon img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.assistant-item-text {
  min-width: 0;
  flex: 1;
}

.assistant-item-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.assistant-item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ai-text);
  line-height: 1.4;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.assistant-item-kind {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.1);
  color: #0369a1;
  font-size: 11px;
  line-height: 1.5;
}

.assistant-item-desc {
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--ai-text-muted);
  display: -webkit-box;
  line-clamp: 1;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.assistant-item-meta {
  margin-top: 4px;
  font-size: 10.5px;
  line-height: 1.45;
  color: rgba(100, 116, 139, 0.92);
}

.assistant-item-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.icon-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--ai-text-muted);
  cursor: pointer;
  flex-shrink: 0;
}

.icon-action-btn.primary {
  color: #0284c7;
}

.icon-action-btn.danger {
  color: #dc2626;
}

.icon-action-btn:hover:not(:disabled) {
  color: #0284c7;
  background: rgba(14, 165, 233, 0.08);
}

.icon-action-btn.danger:hover:not(:disabled) {
  color: #dc2626;
  background: rgba(239, 68, 68, 0.12);
}

.icon-action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.assistant-empty {
  padding: 16px 4px;
  color: var(--ai-text-muted);
  font-size: 13px;
}

.main-area {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.main-area::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(115deg, transparent 0%, rgba(255, 255, 255, 0.68) 42%, transparent 58%),
    radial-gradient(circle at 78% 8%, rgba(232, 155, 43, 0.08), transparent 26%);
  opacity: 0.58;
  mix-blend-mode: screen;
}

.main-area > * {
  position: relative;
  z-index: 1;
}

.messages-container {
  position: relative;
  flex: 1;
  overflow-y: auto;
  padding: 18px 24px 14px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.52), rgba(248, 250, 252, 0.22)),
    radial-gradient(circle at 50% 0%, rgba(110, 141, 248, 0.08), transparent 38%);
}

.welcome-inline-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid rgba(14, 165, 233, 0.14);
  border-radius: 10px;
  background: rgba(14, 165, 233, 0.05);
}

.welcome-inline-banner--setup {
  border-color: rgba(249, 115, 22, 0.18);
  background: rgba(249, 115, 22, 0.08);
}

.welcome-inline-label {
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.12);
  color: #0369a1;
  font-size: 11px;
  line-height: 1.8;
  font-weight: 600;
}

.welcome-inline-text {
  color: #475569;
  font-size: 12.5px;
  line-height: 1.7;
}

.assistant-evolution-banner {
  display: flex;
  align-items: stretch;
  margin-bottom: 14px;
  padding: 1px;
  border: 1px solid rgba(34, 197, 94, 0.18);
  border-radius: 18px;
  background:
    radial-gradient(circle at 0% 0%, rgba(34, 197, 94, 0.18), transparent 36%),
    radial-gradient(circle at 100% 18%, rgba(14, 165, 233, 0.16), transparent 34%),
    linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(14, 165, 233, 0.16));
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.08);
}

.assistant-evolution-banner.is-applying {
  border-color: rgba(14, 165, 233, 0.2);
}

.assistant-evolution-banner-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  padding: 14px 16px;
  border-radius: 17px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.assistant-evolution-banner-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.assistant-evolution-badge {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  color: #047857;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.16), rgba(14, 165, 233, 0.14));
  border: 1px solid rgba(34, 197, 94, 0.18);
}

.assistant-evolution-banner-title {
  color: #0f172a;
  font-size: 14px;
  font-weight: 700;
}

.assistant-evolution-banner-desc {
  color: #334155;
  font-size: 12.5px;
  line-height: 1.6;
}

.assistant-evolution-reason-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
}

.assistant-evolution-reason-item {
  padding: 9px 10px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(255, 255, 255, 0.88));
  color: #334155;
  font-size: 12px;
  line-height: 1.55;
}

.assistant-evolution-preview-list,
.assistant-comparison-preview-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.assistant-evolution-preview-item,
.assistant-comparison-preview-item {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.78);
}

.assistant-evolution-preview-title,
.assistant-comparison-preview-title {
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
}

.assistant-evolution-preview-text,
.assistant-comparison-preview-text {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: #334155;
}

.assistant-comparison-preview-note {
  margin-top: 6px;
  font-size: 12px;
  color: #166534;
}

.assistant-evolution-banner-list {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.assistant-evolution-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(34, 197, 94, 0.18);
  color: #166534;
  font-size: 12px;
  font-weight: 600;
}

.assistant-evolution-arrow {
  color: #0369a1;
  font-size: 12px;
  white-space: nowrap;
}

.assistant-evolution-banner-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.assistant-evolution-action {
  height: 34px;
  padding: 0 15px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
}

.assistant-evolution-action:hover:not(:disabled) {
  transform: translateY(-1px);
}

.assistant-evolution-action:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.assistant-evolution-action.secondary {
  color: #475569;
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(148, 163, 184, 0.26);
}

.assistant-evolution-action.primary {
  color: #fff;
  background: linear-gradient(135deg, #16a34a, #0284c7);
  box-shadow: 0 10px 22px rgba(14, 165, 233, 0.2);
}

.assistant-evolution-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.assistant-evolution-progress-track {
  width: 220px;
  max-width: 100%;
  height: 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.2);
  overflow: hidden;
}

.assistant-evolution-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #22c55e, #0ea5e9);
  transition: width 180ms ease;
}

.assistant-evolution-progress-text {
  color: #0f766e;
  font-size: 12px;
  white-space: nowrap;
}

.welcome {
  padding: 40px 24px;
  color: var(--ai-text-muted);
  font-size: 14px;
  line-height: 1.6;
  perspective: 1200px;
}

.welcome-title {
  margin: 0 0 6px;
  color: var(--ai-text);
  font-size: 16px;
  font-weight: 600;
}

.welcome-subtitle {
  margin: 0;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.6;
}

.welcome-action-btn {
  margin-top: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 118px;
  height: 34px;
  padding: 0 14px;
  border: 1px solid #0ea5e9;
  border-radius: 8px;
  background: #0ea5e9;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.welcome-action-btn:hover {
  background: #0284c7;
  border-color: #0284c7;
}

.welcome-support {
  margin-top: 18px;
  position: relative;
  padding: 16px 14px 14px;
  overflow: hidden;
  border: 1px solid rgba(96, 165, 250, 0.24);
  border-radius: 14px;
  background:
    radial-gradient(circle at top, rgba(96, 165, 250, 0.22), rgba(96, 165, 250, 0) 40%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(15, 23, 42, 0.84));
  box-shadow:
    0 24px 56px rgba(15, 23, 42, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -1px 0 rgba(59, 130, 246, 0.18);
  isolation: isolate;
  transform-style: preserve-3d;
}

.welcome-support::before,
.welcome-support::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.welcome-support::before {
  inset: -28% -18%;
  background:
    radial-gradient(circle at 22% 24%, rgba(14, 165, 233, 0.36), rgba(14, 165, 233, 0) 28%),
    radial-gradient(circle at 80% 18%, rgba(125, 211, 252, 0.3), rgba(125, 211, 252, 0) 22%),
    radial-gradient(circle at 56% 92%, rgba(59, 130, 246, 0.22), rgba(59, 130, 246, 0) 24%);
  filter: blur(10px);
  opacity: 0.96;
  animation: welcome-space-drift 15s linear infinite;
}

.welcome-support::after {
  background-image:
    radial-gradient(circle at 16% 28%, rgba(255, 255, 255, 0.92) 0 1px, transparent 1.6px),
    radial-gradient(circle at 78% 22%, rgba(255, 255, 255, 0.7) 0 1px, transparent 1.8px),
    radial-gradient(circle at 68% 68%, rgba(191, 219, 254, 0.82) 0 1.2px, transparent 1.9px),
    radial-gradient(circle at 34% 74%, rgba(148, 197, 255, 0.68) 0 1px, transparent 1.7px),
    linear-gradient(120deg, rgba(255, 255, 255, 0) 18%, rgba(255, 255, 255, 0.06) 48%, rgba(255, 255, 255, 0) 78%);
  background-size: 180px 180px, 220px 220px, 260px 260px, 200px 200px, 240px 240px;
  mix-blend-mode: screen;
  opacity: 0.82;
  animation: welcome-star-parallax 18s linear infinite;
}

.welcome-support > * {
  position: relative;
  z-index: 1;
}

.welcome-support-floor {
  position: absolute;
  left: 10%;
  right: 10%;
  bottom: -24px;
  height: 42px;
  z-index: 0;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(14, 165, 233, 0.3), rgba(14, 165, 233, 0) 72%);
  filter: blur(12px);
  opacity: 0.68;
  transform: translateY(0) scaleX(0.92);
  animation: welcome-floor-pulse 6.8s ease-in-out infinite;
}

.welcome-support-text {
  margin: 0 0 12px;
  color: rgba(226, 232, 240, 0.92);
  font-size: 13px;
  line-height: 1.6;
  text-align: center;
  text-shadow: 0 1px 12px rgba(14, 165, 233, 0.16);
}

.welcome-support-codes {
  display: flex;
  flex-wrap: nowrap;
  justify-content: space-between;
  align-items: stretch;
  gap: 10px;
  overflow: visible;
  perspective: 1000px;
}

.welcome-support-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  width: auto;
  min-height: 182px;
  padding: 12px 10px 10px;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(226, 232, 240, 0.78));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.96),
    0 10px 24px rgba(15, 23, 42, 0.16);
  box-sizing: border-box;
  flex: 1 1 0;
  min-width: 0;
  opacity: 0;
  transform-style: preserve-3d;
  animation:
    welcome-card-drop-in 0.78s cubic-bezier(0.2, 0.92, 0.2, 1) 0.24s both,
    welcome-card-float 6.8s ease-in-out 1.02s infinite;
}

.welcome-support-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.48), rgba(255, 255, 255, 0) 42%);
  pointer-events: none;
}

.welcome-support-card:nth-child(2) {
  animation-delay: 0.34s, -1.08s;
}

.welcome-support-card:nth-child(3) {
  animation-delay: 0.44s, -2.16s;
}

.welcome-support-card:first-child {
  animation-delay: 0.24s, 0s;
}

.welcome-support-card:nth-child(odd) {
  transform-origin: center top;
}

.welcome-support-card:hover {
  transform: translate3d(0, -6px, 20px) rotateX(3deg) rotateY(-2deg);
  transition: transform 200ms ease;
}

.welcome-support-qr {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  object-fit: contain;
  background: #fff;
  border: 1px solid rgba(226, 232, 240, 0.9);
}

.welcome-support-qr-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: min(100%, 108px);
  aspect-ratio: 1 / 1;
  flex-shrink: 0;
  transform: translateZ(22px);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.14);
}

.welcome-support-label {
  color: #334155;
  font-size: 11.5px;
  line-height: 1.45;
  text-align: center;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
}

.welcome-support-brand {
  display: flex;
  justify-content: center;
  width: 100%;
}

.welcome-support-brand--overlay {
  position: absolute;
  inset: 0;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.welcome-support-brand-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 10px;
  flex-shrink: 0;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.16);
  border: 2px solid rgba(255, 255, 255, 0.92);
}

.welcome-support-brand-icon--wechat {
  background: #07c160;
  color: #fff;
}

.welcome-support-brand-icon--alipay {
  background: #1677ff;
  color: #fff;
}

.welcome-support-hint {
  margin: 0;
  color: rgba(226, 232, 240, 0.76);
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  text-align: center;
}

.welcome-support-copyright {
  margin: 12px 0 0;
  color: rgba(226, 232, 240, 0.66);
  font-size: 11.5px;
  line-height: 1.6;
  text-align: center;
}

.welcome-support-link {
  margin-left: 6px;
  color: #7dd3fc;
  text-decoration: none;
}

.welcome-support-link:hover {
  color: #bae6fd;
  text-decoration: underline;
}

.welcome-support-ghost {
  position: absolute;
  z-index: 16;
  pointer-events: none;
  transform-origin: center top;
  overflow: visible;
  will-change: transform, opacity, filter;
}

.welcome-support-ghost > * {
  width: 100%;
}

.welcome-support-ghost-body {
  position: relative;
  z-index: 2;
  height: 100%;
}

.welcome-ghost-trail {
  position: absolute;
  left: 50%;
  top: 54%;
  z-index: 1;
  width: 34%;
  height: 180%;
  transform: translate(-50%, -24%) rotate(0deg);
  transform-origin: center top;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(191, 219, 254, 0.86), rgba(59, 130, 246, 0.16), rgba(59, 130, 246, 0));
  filter: blur(12px);
  opacity: 0;
}

.welcome-ghost-particle {
  position: absolute;
  z-index: 1;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.96), rgba(125, 211, 252, 0.82) 48%, rgba(59, 130, 246, 0) 72%);
  box-shadow: 0 0 16px rgba(96, 165, 250, 0.42);
  opacity: 0;
}

.welcome-ghost-particle--1 {
  left: 20%;
  top: 70%;
  --ghost-shift-x: -58px;
  --ghost-shift-y: -92px;
}

.welcome-ghost-particle--2 {
  left: 36%;
  top: 78%;
  --ghost-shift-x: -22px;
  --ghost-shift-y: -128px;
}

.welcome-ghost-particle--3 {
  right: 30%;
  top: 72%;
  --ghost-shift-x: 24px;
  --ghost-shift-y: -104px;
}

.welcome-ghost-particle--4 {
  right: 18%;
  top: 62%;
  --ghost-shift-x: 62px;
  --ghost-shift-y: -138px;
}

.welcome-ghost-particle--5 {
  left: 52%;
  top: 82%;
  --ghost-shift-x: 6px;
  --ghost-shift-y: -156px;
}

.welcome-entry-meteor-drop {
  animation: welcome-entry-meteor-drop 1s cubic-bezier(0.2, 0.9, 0.18, 1) both;
}

.welcome-entry-orbital-swing {
  animation: welcome-entry-orbital-swing 1.02s cubic-bezier(0.24, 0.82, 0.2, 1) both;
}

.welcome-entry-galaxy-flip {
  animation: welcome-entry-galaxy-flip 1.04s cubic-bezier(0.22, 0.88, 0.2, 1) both;
}

.welcome-entry-nebula-slide {
  animation: welcome-entry-nebula-slide 0.98s cubic-bezier(0.2, 0.88, 0.18, 1) both;
}

.welcome-entry-gravity-bounce {
  animation: welcome-entry-gravity-bounce 1.08s cubic-bezier(0.18, 0.9, 0.2, 1) both;
}

.welcome-entry-warp-zoom {
  animation: welcome-entry-warp-zoom 0.96s cubic-bezier(0.2, 0.9, 0.2, 1) both;
}

.welcome-entry-cosmic-tilt {
  animation: welcome-entry-cosmic-tilt 1.02s cubic-bezier(0.2, 0.84, 0.18, 1) both;
}

.welcome-entry-satellite-arc {
  animation: welcome-entry-satellite-arc 1.06s cubic-bezier(0.24, 0.82, 0.18, 1) both;
}

.welcome-entry-starfall-fold {
  animation: welcome-entry-starfall-fold 1.04s cubic-bezier(0.16, 0.96, 0.18, 1) both;
}

.welcome-entry-prism-descend {
  animation: welcome-entry-prism-descend 1s cubic-bezier(0.24, 0.84, 0.18, 1) both;
}

.welcome-exit-bird-soar {
  animation: welcome-exit-bird-soar 1.12s cubic-bezier(0.4, 0, 0.2, 1) both;
}

.welcome-exit-bird-soar .welcome-ghost-trail,
.welcome-exit-sky-pop .welcome-ghost-trail,
.welcome-exit-comet-escape .welcome-ghost-trail,
.welcome-exit-feather-drift .welcome-ghost-trail,
.welcome-exit-spiral-lift .welcome-ghost-trail,
.welcome-exit-warp-fold .welcome-ghost-trail,
.welcome-exit-rocket-rise .welcome-ghost-trail,
.welcome-exit-aurora-swerve .welcome-ghost-trail,
.welcome-exit-stardust-burst .welcome-ghost-trail,
.welcome-exit-spring-fling .welcome-ghost-trail {
  animation: welcome-ghost-trail-rise 1s ease-out both;
}

.welcome-exit-bird-soar .welcome-ghost-particle,
.welcome-exit-sky-pop .welcome-ghost-particle,
.welcome-exit-comet-escape .welcome-ghost-particle,
.welcome-exit-feather-drift .welcome-ghost-particle,
.welcome-exit-spiral-lift .welcome-ghost-particle,
.welcome-exit-warp-fold .welcome-ghost-particle,
.welcome-exit-rocket-rise .welcome-ghost-particle,
.welcome-exit-aurora-swerve .welcome-ghost-particle,
.welcome-exit-stardust-burst .welcome-ghost-particle,
.welcome-exit-spring-fling .welcome-ghost-particle {
  animation: welcome-ghost-particle-burst 0.96s ease-out both;
}

.welcome-exit-bird-soar .welcome-ghost-particle--2,
.welcome-exit-comet-escape .welcome-ghost-particle--4,
.welcome-exit-rocket-rise .welcome-ghost-particle--5 {
  animation-delay: 60ms;
}

.welcome-exit-feather-drift .welcome-ghost-particle--1,
.welcome-exit-spiral-lift .welcome-ghost-particle--3,
.welcome-exit-aurora-swerve .welcome-ghost-particle--4 {
  animation-delay: 110ms;
}

.welcome-exit-stardust-burst .welcome-ghost-trail {
  animation-duration: 0.76s;
  opacity: 0.96;
}

.welcome-exit-warp-fold .welcome-ghost-trail {
  animation-duration: 0.82s;
  transform: translate(-50%, -34%) scaleX(0.64);
}

.welcome-exit-sky-pop {
  animation: welcome-exit-sky-pop 0.98s cubic-bezier(0.36, 0, 0.2, 1) both;
}

.welcome-exit-comet-escape {
  animation: welcome-exit-comet-escape 1.02s cubic-bezier(0.38, 0, 0.2, 1) both;
}

.welcome-exit-feather-drift {
  animation: welcome-exit-feather-drift 1.18s cubic-bezier(0.34, 0, 0.2, 1) both;
}

.welcome-exit-spiral-lift {
  animation: welcome-exit-spiral-lift 1.08s cubic-bezier(0.38, 0, 0.2, 1) both;
}

.welcome-exit-warp-fold {
  animation: welcome-exit-warp-fold 0.94s cubic-bezier(0.4, 0, 0.2, 1) both;
}

.welcome-exit-rocket-rise {
  animation: welcome-exit-rocket-rise 0.96s cubic-bezier(0.34, 0, 0.2, 1) both;
}

.welcome-exit-aurora-swerve {
  animation: welcome-exit-aurora-swerve 1.08s cubic-bezier(0.4, 0, 0.2, 1) both;
}

.welcome-exit-stardust-burst {
  animation: welcome-exit-stardust-burst 0.94s cubic-bezier(0.36, 0, 0.2, 1) both;
}

.welcome-exit-spring-fling {
  animation: welcome-exit-spring-fling 1.06s cubic-bezier(0.34, 0, 0.2, 1) both;
}

@keyframes welcome-space-drift {
  0% {
    transform: translate3d(-2%, -1%, 0) scale(1);
  }
  50% {
    transform: translate3d(3%, 2%, 0) scale(1.05);
  }
  100% {
    transform: translate3d(-2%, -1%, 0) scale(1);
  }
}

@keyframes welcome-star-parallax {
  0% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(-10px, 8px, 0);
  }
  100% {
    transform: translate3d(0, 0, 0);
  }
}

@keyframes welcome-card-float {
  0%,
  100% {
    transform: translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg);
  }
  50% {
    transform: translate3d(0, -8px, 0) rotateX(4deg) rotateY(-3deg);
  }
}

@keyframes welcome-card-drop-in {
  0% {
    opacity: 0;
    transform: translate3d(0, -68px, -60px) rotateX(66deg) scale(0.84);
    filter: blur(8px);
  }
  72% {
    opacity: 1;
    transform: translate3d(0, 8px, 16px) rotateX(-8deg) scale(1.02);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) rotateX(0deg) scale(1);
    filter: blur(0);
  }
}

@keyframes welcome-floor-pulse {
  0%,
  100% {
    opacity: 0.52;
    transform: translateY(2px) scaleX(0.82);
  }
  50% {
    opacity: 0.84;
    transform: translateY(-2px) scaleX(1);
  }
}

@keyframes welcome-ghost-trail-rise {
  0% {
    opacity: 0;
    transform: translate(-50%, -8%) scaleY(0.4);
  }
  22% {
    opacity: 0.92;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -56%) scaleY(1.08);
  }
}

@keyframes welcome-ghost-particle-burst {
  0% {
    opacity: 0;
    transform: translate3d(0, 0, 0) scale(0.4);
  }
  20% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate3d(var(--ghost-shift-x, 0), var(--ghost-shift-y, -84px), 0) scale(1.3);
  }
}

@keyframes welcome-entry-meteor-drop {
  0% {
    opacity: 0;
    transform: translate3d(0, -152px, -260px) scale(0.72) rotateX(70deg) rotateZ(-10deg);
    filter: blur(12px);
  }
  72% {
    opacity: 1;
    transform: translate3d(0, 16px, 18px) scale(1.04) rotateX(-8deg) rotateZ(2deg);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) rotateX(0deg) rotateZ(0deg);
    filter: blur(0);
  }
}

@keyframes welcome-entry-orbital-swing {
  0% {
    opacity: 0;
    transform: translate3d(42px, -144px, -220px) scale(0.78) rotateY(-36deg) rotateZ(16deg);
    filter: blur(10px);
  }
  62% {
    opacity: 1;
    transform: translate3d(-8px, 10px, 24px) scale(1.02) rotateY(8deg) rotateZ(-3deg);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) rotateY(0deg) rotateZ(0deg);
    filter: blur(0);
  }
}

@keyframes welcome-entry-galaxy-flip {
  0% {
    opacity: 0;
    transform: translate3d(0, -132px, -240px) scale(0.74) rotateX(-82deg) rotateY(18deg);
    filter: blur(11px);
  }
  68% {
    opacity: 1;
    transform: translate3d(0, 14px, 30px) scale(1.03) rotateX(10deg) rotateY(-4deg);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) rotateX(0deg) rotateY(0deg);
    filter: blur(0);
  }
}

@keyframes welcome-entry-nebula-slide {
  0% {
    opacity: 0;
    transform: translate3d(-74px, -116px, -210px) scale(0.82) skewX(8deg) rotateZ(-12deg);
    filter: blur(12px);
  }
  58% {
    opacity: 1;
    transform: translate3d(12px, 8px, 16px) scale(1.02) skewX(-2deg) rotateZ(2deg);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) skewX(0deg) rotateZ(0deg);
    filter: blur(0);
  }
}

@keyframes welcome-entry-gravity-bounce {
  0% {
    opacity: 0;
    transform: translate3d(0, -186px, -280px) scale(0.68);
    filter: blur(13px);
  }
  65% {
    opacity: 1;
    transform: translate3d(0, 22px, 18px) scale(1.06);
    filter: blur(0);
  }
  82% {
    transform: translate3d(0, -6px, 0) scale(0.99);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    filter: blur(0);
  }
}

@keyframes welcome-entry-warp-zoom {
  0% {
    opacity: 0;
    transform: translate3d(0, -102px, -420px) scale(0.4);
    filter: blur(16px);
  }
  72% {
    opacity: 1;
    transform: translate3d(0, 10px, 32px) scale(1.05);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    filter: blur(0);
  }
}

@keyframes welcome-entry-cosmic-tilt {
  0% {
    opacity: 0;
    transform: translate3d(22px, -136px, -200px) scale(0.76) rotateX(54deg) rotateY(-24deg) rotateZ(-8deg);
    filter: blur(11px);
  }
  66% {
    opacity: 1;
    transform: translate3d(-4px, 12px, 20px) scale(1.02) rotateX(-6deg) rotateY(6deg) rotateZ(2deg);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) rotateX(0deg) rotateY(0deg) rotateZ(0deg);
    filter: blur(0);
  }
}

@keyframes welcome-entry-satellite-arc {
  0% {
    opacity: 0;
    transform: translate3d(96px, -126px, -210px) scale(0.78) rotateZ(18deg);
    filter: blur(11px);
  }
  58% {
    opacity: 1;
    transform: translate3d(-12px, 12px, 18px) scale(1.03) rotateZ(-4deg);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) rotateZ(0deg);
    filter: blur(0);
  }
}

@keyframes welcome-entry-starfall-fold {
  0% {
    opacity: 0;
    transform: translate3d(0, -166px, -250px) scale(0.7) rotateX(78deg);
    filter: blur(12px);
  }
  55% {
    opacity: 1;
    transform: translate3d(0, 18px, 14px) scale(1.03) rotateX(-12deg);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) rotateX(0deg);
    filter: blur(0);
  }
}

@keyframes welcome-entry-prism-descend {
  0% {
    opacity: 0;
    transform: translate3d(-18px, -154px, -220px) scale(0.74) rotateY(26deg) skewY(-6deg);
    filter: blur(11px);
  }
  62% {
    opacity: 1;
    transform: translate3d(6px, 10px, 18px) scale(1.02) rotateY(-6deg) skewY(1deg);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) rotateY(0deg) skewY(0deg);
    filter: blur(0);
  }
}

@keyframes welcome-exit-bird-soar {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) rotateZ(0deg);
  }
  32% {
    transform: translate3d(-12px, -18px, 18px) scale(1.02) rotateZ(-6deg);
  }
  100% {
    opacity: 0;
    transform: translate3d(78px, -220px, 160px) scale(0.54) rotateZ(22deg);
    filter: blur(10px);
  }
}

@keyframes welcome-exit-sky-pop {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
  28% {
    transform: translate3d(0, -26px, 0) scale(1.06);
  }
  100% {
    opacity: 0;
    transform: translate3d(0, -188px, 120px) scale(0.28);
    filter: blur(12px);
  }
}

@keyframes welcome-exit-comet-escape {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) rotateZ(0deg);
  }
  24% {
    transform: translate3d(16px, -10px, 18px) scale(1.03) rotateZ(4deg);
  }
  100% {
    opacity: 0;
    transform: translate3d(138px, -170px, 180px) scale(0.46) rotateZ(14deg);
    filter: blur(14px);
  }
}

@keyframes welcome-exit-feather-drift {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) rotateZ(0deg);
  }
  30% {
    transform: translate3d(-20px, -24px, 0) scale(1.01) rotateZ(-10deg);
  }
  64% {
    transform: translate3d(28px, -92px, 58px) scale(0.82) rotateZ(10deg);
  }
  100% {
    opacity: 0;
    transform: translate3d(-46px, -210px, 150px) scale(0.42) rotateZ(-18deg);
    filter: blur(10px);
  }
}

@keyframes welcome-exit-spiral-lift {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
  }
  100% {
    opacity: 0;
    transform: translate3d(12px, -198px, 120px) scale(0.34) rotate(250deg);
    filter: blur(12px);
  }
}

@keyframes welcome-exit-warp-fold {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) rotateX(0deg);
  }
  45% {
    transform: translate3d(0, -34px, 40px) scale(0.92) rotateX(28deg);
  }
  100% {
    opacity: 0;
    transform: translate3d(0, -164px, 220px) scale(0.18) rotateX(82deg);
    filter: blur(12px);
  }
}

@keyframes welcome-exit-rocket-rise {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
  20% {
    transform: translate3d(0, -18px, 18px) scale(1.04);
  }
  100% {
    opacity: 0;
    transform: translate3d(0, -258px, 200px) scale(0.36);
    filter: blur(12px);
  }
}

@keyframes welcome-exit-aurora-swerve {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) rotateZ(0deg);
  }
  30% {
    transform: translate3d(20px, -18px, 28px) scale(1.03) rotateZ(7deg);
  }
  68% {
    transform: translate3d(-28px, -102px, 90px) scale(0.78) rotateZ(-8deg);
  }
  100% {
    opacity: 0;
    transform: translate3d(56px, -212px, 150px) scale(0.38) rotateZ(16deg);
    filter: blur(11px);
  }
}

@keyframes welcome-exit-stardust-burst {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
  }
  100% {
    opacity: 0;
    transform: translate3d(0, -144px, 120px) scale(1.18);
    box-shadow: 0 0 72px rgba(96, 165, 250, 0.52);
    filter: blur(16px);
  }
}

@keyframes welcome-exit-spring-fling {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
  24% {
    transform: translate3d(0, 22px, 0) scale(0.96);
  }
  54% {
    transform: translate3d(0, -40px, 24px) scale(1.03);
  }
  100% {
    opacity: 0;
    transform: translate3d(34px, -226px, 130px) scale(0.34);
    filter: blur(11px);
  }
}

@keyframes message-entry-bird-pop {
  0% {
    opacity: 0;
    transform: translate3d(34px, 18px, 0) scale(0.72) rotateZ(6deg);
    filter: blur(8px);
  }
  56% {
    opacity: 1;
    transform: translate3d(-4px, -8px, 0) scale(1.03) rotateZ(-3deg);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) rotateZ(0deg);
    filter: blur(0);
  }
}

@keyframes message-entry-wing-rise {
  0% {
    opacity: 0;
    transform: translate3d(26px, 26px, 0) scale(0.76) rotateZ(-8deg);
    filter: blur(8px);
  }
  52% {
    opacity: 1;
    transform: translate3d(-6px, -12px, 0) scale(1.04) rotateZ(3deg);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) rotateZ(0deg);
    filter: blur(0);
  }
}

@keyframes message-entry-comet-bubble {
  0% {
    opacity: 0;
    transform: translate3d(54px, 6px, 0) scale(0.64);
    filter: blur(10px);
  }
  60% {
    opacity: 1;
    transform: translate3d(-8px, -4px, 0) scale(1.05);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    filter: blur(0);
  }
}

@keyframes message-entry-spring-burst {
  0% {
    opacity: 0;
    transform: translate3d(18px, 28px, 0) scale(0.68);
    filter: blur(8px);
  }
  44% {
    opacity: 1;
    transform: translate3d(-2px, -14px, 0) scale(1.08);
    filter: blur(0);
  }
  72% {
    transform: translate3d(0, 6px, 0) scale(0.98);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    filter: blur(0);
  }
}

@keyframes message-entry-sky-hop {
  0% {
    opacity: 0;
    transform: translate3d(14px, 36px, 0) scale(0.74);
    filter: blur(8px);
  }
  48% {
    opacity: 1;
    transform: translate3d(-2px, -18px, 0) scale(1.02);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    filter: blur(0);
  }
}

@keyframes message-entry-glide-in {
  0% {
    opacity: 0;
    transform: translate3d(-34px, 14px, 0) scale(0.76) rotateZ(-5deg);
    filter: blur(8px);
  }
  58% {
    opacity: 1;
    transform: translate3d(6px, -8px, 0) scale(1.03) rotateZ(2deg);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) rotateZ(0deg);
    filter: blur(0);
  }
}

@keyframes message-entry-nebula-drop {
  0% {
    opacity: 0;
    transform: translate3d(-10px, -34px, 0) scale(0.7) rotateX(42deg);
    filter: blur(10px);
  }
  62% {
    opacity: 1;
    transform: translate3d(0, 8px, 0) scale(1.04) rotateX(-8deg);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) rotateX(0deg);
    filter: blur(0);
  }
}

@keyframes message-entry-halo-settle {
  0% {
    opacity: 0;
    transform: translate3d(-16px, -8px, 0) scale(0.62);
    box-shadow: 0 0 0 rgba(59, 130, 246, 0);
    filter: blur(10px);
  }
  56% {
    opacity: 1;
    transform: translate3d(0, 4px, 0) scale(1.05);
    box-shadow: 0 0 24px rgba(125, 211, 252, 0.34);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    box-shadow: 0 0 0 rgba(59, 130, 246, 0);
    filter: blur(0);
  }
}

@keyframes message-entry-orbit-arrive {
  0% {
    opacity: 0;
    transform: translate3d(-42px, -18px, 0) scale(0.74) rotateZ(8deg);
    filter: blur(10px);
  }
  60% {
    opacity: 1;
    transform: translate3d(8px, 4px, 0) scale(1.03) rotateZ(-3deg);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) rotateZ(0deg);
    filter: blur(0);
  }
}

@keyframes message-entry-feather-float {
  0% {
    opacity: 0;
    transform: translate3d(-18px, -28px, 0) scale(0.72) rotateZ(-10deg);
    filter: blur(9px);
  }
  52% {
    opacity: 1;
    transform: translate3d(4px, 6px, 0) scale(1.02) rotateZ(4deg);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) rotateZ(0deg);
    filter: blur(0);
  }
}

@keyframes send-button-launch {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
    filter: saturate(1);
  }
  30% {
    transform: translate3d(0, -2px, 0) scale(1.16);
    filter: saturate(1.18);
  }
  100% {
    transform: translate3d(0, 0, 0) scale(1);
    filter: saturate(1);
  }
}

@keyframes send-button-wave {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  24% {
    opacity: 0.9;
  }
  100% {
    opacity: 0;
    transform: scale(1.9);
  }
}

@keyframes send-button-ring {
  0% {
    opacity: 0;
    transform: scale(0.7);
  }
  20% {
    opacity: 0.85;
  }
  100% {
    opacity: 0;
    transform: scale(1.75);
  }
}

.welcome-cursor {
  display: inline-block;
  margin-left: 2px;
  color: #0ea5e9;
  animation: blink 1s step-end infinite;
}

.message-row {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
  max-width: min(840px, 92%);
  transform-origin: right bottom;
  will-change: transform, opacity, filter;
}

.message-row.user {
  flex-direction: row-reverse;
}

.message-row.user.message-entry-bird-pop {
  animation: message-entry-bird-pop 0.8s cubic-bezier(0.2, 0.92, 0.2, 1) both;
}

.message-row.user.message-entry-wing-rise {
  animation: message-entry-wing-rise 0.82s cubic-bezier(0.22, 0.9, 0.2, 1) both;
}

.message-row.user.message-entry-comet-bubble {
  animation: message-entry-comet-bubble 0.78s cubic-bezier(0.22, 0.9, 0.18, 1) both;
}

.message-row.user.message-entry-spring-burst {
  animation: message-entry-spring-burst 0.86s cubic-bezier(0.18, 0.96, 0.18, 1) both;
}

.message-row.user.message-entry-sky-hop {
  animation: message-entry-sky-hop 0.8s cubic-bezier(0.2, 0.9, 0.18, 1) both;
}

.message-row.assistant.message-entry-glide-in {
  animation: message-entry-glide-in 0.84s cubic-bezier(0.2, 0.92, 0.18, 1) both;
}

.message-row.assistant.message-entry-nebula-drop {
  animation: message-entry-nebula-drop 0.88s cubic-bezier(0.18, 0.94, 0.18, 1) both;
}

.message-row.assistant.message-entry-halo-settle {
  animation: message-entry-halo-settle 0.82s cubic-bezier(0.22, 0.9, 0.2, 1) both;
}

.message-row.assistant.message-entry-orbit-arrive {
  animation: message-entry-orbit-arrive 0.9s cubic-bezier(0.2, 0.9, 0.16, 1) both;
}

.message-row.assistant.message-entry-feather-float {
  animation: message-entry-feather-float 0.9s cubic-bezier(0.18, 0.94, 0.18, 1) both;
}

.message-avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.assistant-bird-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: transparent;
  border: none;
  box-shadow: none;
  overflow: hidden;
}

.assistant-bird-avatar::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: transparent;
  opacity: 0;
  pointer-events: none;
}

.assistant-logo-static,
.assistant-logo-fold {
  width: 100%;
  height: 100%;
  display: block;
}

.assistant-bird-avatar.is-static {
  opacity: 0.96;
}

.assistant-logo-static {
  object-fit: cover;
  border-radius: inherit;
}

.assistant-bird-avatar.is-animated {
  border-radius: 10px;
  background: transparent;
  box-shadow: none;
}

.assistant-bird-avatar.is-animated::before {
  opacity: 0;
}

.assistant-logo-fold {
  position: relative;
  display: block;
  border-radius: inherit;
  overflow: hidden;
  perspective: 120px;
  transform-style: preserve-3d;
}

.assistant-logo-fold-half {
  position: absolute;
  top: 0;
  width: 50%;
  height: 100%;
  background-repeat: no-repeat;
  background-size: 200% 100%;
  backface-visibility: hidden;
  filter: saturate(1.08) contrast(1.08);
}

.assistant-logo-fold-half--left {
  left: 0;
  background-position: left center;
  transform-origin: right center;
  animation: assistant-logo-fold-left 1.45s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

.assistant-logo-fold-half--right {
  right: 0;
  background-position: right center;
  transform-origin: left center;
  animation: assistant-logo-fold-right 1.45s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

.assistant-logo-fold-axis {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 50%;
  width: 2.5px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(59, 130, 246, 0), rgba(59, 130, 246, 0.75), rgba(59, 130, 246, 0));
  box-shadow: 0 0 14px rgba(59, 130, 246, 0.5);
  animation: assistant-logo-axis-pulse 1.45s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

.message-content {
  flex: 1;
  min-width: 0;
  position: relative;
}

.message-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  margin-left: auto;
  padding: 2px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.08);
}

.message-guard-quick-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-left: auto;
  padding: 6px 8px;
  border-radius: 10px;
  border: 1px solid rgba(245, 158, 11, 0.28);
  background: rgba(255, 251, 235, 0.92);
}

.message-guard-quick-label {
  color: #92400e;
  font-size: 12px;
}

.btn-action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--ai-text-muted);
  cursor: pointer;
}

.btn-action-icon:hover {
  background: var(--ai-sidebar-bg);
  color: #0ea5e9;
}

.message-confirm-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 240px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(14, 165, 233, 0.06);
  border: 1px solid rgba(14, 165, 233, 0.14);
  color: var(--ai-text);
}

.message-confirm-card.is-applied {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.18);
}

.message-confirm-card.is-failed,
.message-confirm-card.is-cancelled,
.message-confirm-card.is-unavailable {
  background: rgba(239, 68, 68, 0.06);
  border-color: rgba(239, 68, 68, 0.16);
}

.message-confirm-summary {
  font-size: 12px;
  line-height: 1.6;
  color: #0f172a;
}

.message-confirm-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.message-confirm-tag {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.1);
  color: #0369a1;
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
}

.message-confirm-tag-button {
  appearance: none;
  border: 1px solid rgba(14, 165, 233, 0.18);
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.message-confirm-tag-button:hover:not(:disabled) {
  background: rgba(14, 165, 233, 0.16);
  border-color: rgba(14, 165, 233, 0.3);
  color: #075985;
}

.message-confirm-tag-button.is-selected {
  background: linear-gradient(180deg, rgba(14, 165, 233, 0.22), rgba(37, 99, 235, 0.18));
  border-color: rgba(37, 99, 235, 0.52);
  color: #1d4ed8;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45), 0 4px 10px rgba(37, 99, 235, 0.14);
}

.message-confirm-tag-button.is-selected:hover:not(:disabled) {
  background: linear-gradient(180deg, rgba(14, 165, 233, 0.28), rgba(37, 99, 235, 0.24));
  border-color: rgba(29, 78, 216, 0.68);
  color: #1e40af;
}

.message-confirm-tag-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.16);
}

.message-confirm-tag-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.message-confirm-countdown {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(59, 130, 246, 0.06);
  border: 1px solid rgba(59, 130, 246, 0.14);
}

.message-confirm-countdown-text {
  font-size: 12px;
  line-height: 1.5;
  color: #1d4ed8;
  font-weight: 600;
}

.message-confirm-countdown-track {
  position: relative;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(148, 163, 184, 0.22);
}

.message-confirm-countdown-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.92), rgba(14, 165, 233, 0.88));
  transition: width 0.22s ease;
}

.assistant-inline-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.assistant-inline-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1 1 180px;
}

.assistant-inline-field--full {
  flex-basis: 100%;
}

.assistant-inline-field-label {
  font-size: 12px;
  line-height: 1.5;
  color: #475569;
  font-weight: 600;
}

.assistant-inline-input,
.assistant-inline-textarea {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.9);
  color: #0f172a;
  font-size: 12px;
  line-height: 1.6;
  padding: 8px 10px;
  box-sizing: border-box;
}

.assistant-inline-input:focus,
.assistant-inline-textarea:focus {
  outline: none;
  border-color: rgba(37, 99, 235, 0.46);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
  background: #fff;
}

.assistant-inline-textarea {
  min-height: 120px;
  resize: vertical;
}

.assistant-choice-detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(14, 165, 233, 0.16);
  background: rgba(248, 250, 252, 0.86);
}

.assistant-scope-hint {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(37, 99, 235, 0.16);
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.05), rgba(248, 250, 252, 0.92));
}

.assistant-scope-hint-title {
  color: #0f172a;
  font-size: 12px;
  line-height: 1.5;
  font-weight: 700;
}

.assistant-scope-hint-detail {
  color: #475569;
  font-size: 12px;
  line-height: 1.6;
}

.assistant-choice-title {
  color: #0f172a;
  font-size: 13px;
  line-height: 1.5;
  font-weight: 700;
}

.assistant-choice-desc,
.assistant-choice-reason {
  color: #475569;
  font-size: 12px;
  line-height: 1.6;
}

.assistant-choice-features {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.assistant-choice-feature {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
  color: #1d4ed8;
  font-size: 11px;
  line-height: 1.4;
}

.report-draft-meta-card {
  border-color: rgba(37, 99, 235, 0.18);
  background: linear-gradient(180deg, rgba(59, 130, 246, 0.06), rgba(248, 250, 252, 0.88));
}

.message-confirm-prompt,
.message-confirm-status {
  font-size: 12px;
  line-height: 1.6;
  color: var(--ai-text-muted);
}

.message-confirm-actions {
  display: flex;
  gap: 8px;
}

.message-confirm-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ai-text-muted);
}

.message-confirm-checkbox input {
  margin: 0;
}

.message-confirm-secondary-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.message-confirm-btn {
  min-width: 64px;
  height: 30px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: #fff;
  color: var(--ai-text);
  cursor: pointer;
}

.message-confirm-btn.primary {
  background: #0ea5e9;
  border-color: #0ea5e9;
  color: #fff;
}

.message-confirm-btn.subtle {
  background: rgba(255, 255, 255, 0.72);
}

.message-confirm-btn:disabled {
  opacity: 0.62;
  cursor: not-allowed;
}

.message-text {
  position: relative;
  padding: 9px 13px;
  border-radius: 14px;
  line-height: 1.58;
  white-space: pre-wrap;
  word-break: break-word;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.message-text.message-text-waiting {
  min-height: 74px;
  display: flex;
  align-items: center;
  background: linear-gradient(180deg, rgba(14, 165, 233, 0.05), rgba(14, 165, 233, 0.02));
}

.message-waiting-state {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(320px, 100%);
}

.message-waiting-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.message-waiting-title {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}

.message-waiting-percent {
  font-size: 12px;
  line-height: 1;
  color: #0284c7;
  font-weight: 700;
}

.message-waiting-detail {
  font-size: 12px;
  line-height: 1.6;
  color: #64748b;
}

.message-waiting-progress {
  position: relative;
  width: 100%;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.12);
}

.message-waiting-progress-bar {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #22d3ee 0%, #0ea5e9 55%, #2563eb 100%);
  box-shadow: 0 0 12px rgba(14, 165, 233, 0.28);
  transition: width 0.24s ease;
}

.message-text.has-inline-actions {
  padding-bottom: 10px;
}

.message-text.has-user-context-meta {
  padding-bottom: 8px;
}

.message-user-meta-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.message-error-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}

.message-error-action-btn {
  min-width: 72px;
  height: 30px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid rgba(248, 113, 113, 0.28);
  background: rgba(255, 255, 255, 0.9);
  color: #b91c1c;
  cursor: pointer;
}

.message-error-action-btn.primary {
  background: #dc2626;
  border-color: #dc2626;
  color: #fff;
}

.message-error-action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.message-user-context-card {
  flex-shrink: 0;
}

.message-user-context-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid rgba(14, 165, 233, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: #0284c7;
  cursor: default;
}

.message-user-context-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.18);
}

.message-recommend-inline {
  color: rgba(107, 114, 128, 0.86);
  font-size: 11px;
  line-height: 1.6;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  min-width: 0;
  flex: 1 1 260px;
}

.message-recommend-inline-prefix {
  color: rgba(107, 114, 128, 0.82);
  margin-right: 4px;
}

.message-recommend-inline-list {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  min-width: 0;
  gap: 2px 0;
}

.message-recommend-inline-separator,
.message-recommend-inline-quote {
  color: rgba(107, 114, 128, 0.82);
}

.message-recommend-tag-link {
  display: inline-flex;
  align-items: center;
  padding: 0;
  border: none;
  background: transparent;
  color: #0369a1;
  font-size: 11px;
  line-height: 1.6;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: rgba(3, 105, 161, 0.28);
  text-underline-offset: 2px;
  white-space: nowrap;
  font-weight: 600;
}

.message-recommend-tag-link:hover {
  color: #075985;
  text-decoration-color: rgba(7, 89, 133, 0.42);
}

.message-skill-empty-card {
  display: flex;
  flex: 1 1 100%;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid rgba(14, 165, 233, 0.16);
  background: linear-gradient(180deg, rgba(14, 165, 233, 0.07), rgba(255, 255, 255, 0.96));
}

.message-skill-empty-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.message-skill-empty-brand-logo {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  object-fit: cover;
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
}

.message-skill-empty-brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.message-skill-empty-brand-name {
  color: #0f172a;
  font-size: 14px;
  line-height: 1.3;
  font-weight: 700;
}

.message-skill-empty-brand-subtitle {
  color: #0284c7;
  font-size: 11px;
  line-height: 1.4;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.message-skill-empty-title {
  color: #0f172a;
  font-size: 14px;
  line-height: 1.5;
  font-weight: 600;
}

.message-skill-empty-text {
  color: #475569;
  font-size: 13px;
  line-height: 1.7;
}

.message-skill-empty-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  align-items: center;
  color: #334155;
  font-size: 12.5px;
  line-height: 1.6;
}

.message-skill-empty-links a {
  color: #0369a1;
  font-weight: 600;
  text-decoration: none;
}

.message-skill-empty-links a:hover {
  text-decoration: underline;
}

.message-skill-empty-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.message-skill-empty-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  background: #0ea5e9;
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1;
  text-decoration: none;
  box-shadow: 0 8px 18px rgba(14, 165, 233, 0.22);
}

.message-skill-empty-btn:hover {
  background: #0284c7;
}

.message-skill-empty-qr {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
}

.message-skill-empty-qr .welcome-support-qr-wrap {
  width: 112px;
}

.message-skill-empty-qr-label {
  color: #475569;
  font-size: 12px;
  line-height: 1.5;
}

.message-footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(229, 231, 235, 0.7);
}

.message-generated-files {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 2px 6px;
  width: auto;
  max-width: 100%;
  margin-left: auto;
  align-self: flex-end;
  min-height: 18px;
  margin-top: 4px;
  text-align: right;
}

.message-generated-file-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 10.5px;
  color: #7c8a9a;
  text-decoration: underline;
  text-decoration-color: rgba(124, 138, 154, 0.18);
  text-underline-offset: 2px;
  cursor: pointer;
  padding: 0;
  border-radius: 0;
  opacity: 0.82;
  transition: color 0.15s, text-decoration-color 0.15s, opacity 0.15s;
}

.message-generated-file-link:hover {
  color: #0284c7;
  text-decoration-color: currentColor;
  opacity: 1;
}

.message-generated-file-link.is-pending {
  color: #94a3b8;
  text-decoration-style: dashed;
  cursor: default;
  opacity: 0.92;
}

.message-generated-file-link.is-pending:hover {
  color: #94a3b8;
  text-decoration-color: rgba(148, 163, 184, 0.32);
}

.message-route-hint {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
  color: #1d4ed8;
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.message-generated-file-link-icon {
  flex-shrink: 0;
  font-size: 10px;
  line-height: 1;
  opacity: 0.72;
}

.message-generated-file-link-name {
  max-width: 124px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 400;
}

.message-user-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.message-row.user .message-user-attachments {
  justify-content: flex-end;
}

.message-user-attachment-card {
  max-width: 100%;
}

.message-user-attachment-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: min(320px, 100%);
  padding: 4px 10px;
  border: 1px solid rgba(14, 165, 233, 0.16);
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.06);
  color: #334155;
}

.message-user-attachment-badge {
  flex-shrink: 0;
  color: #0369a1;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.message-user-attachment-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
}

.message-row.user .message-text {
  background: var(--ai-user-bg);
  color: #0c4a6e;
  border: 1px solid rgba(125, 211, 252, 0.34);
  box-shadow: 0 12px 28px rgba(14, 165, 233, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.66);
}

.message-row.assistant .message-text {
  background: var(--ai-assistant-bg);
  border: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.message-row.assistant .message-text::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg, rgba(74, 108, 247, 0.18), rgba(139, 92, 246, 0.12), rgba(63, 174, 130, 0.08));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

.message-row.assistant .message-text.message-text-error {
  background: linear-gradient(180deg, rgba(254, 242, 242, 0.96), rgba(254, 226, 226, 0.92));
  border: 1px solid rgba(239, 68, 68, 0.22);
  box-shadow: 0 8px 22px rgba(239, 68, 68, 0.08);
  color: #991b1b;
}

.streaming-text {
  min-height: 1em;
}

.streaming-text .cursor {
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}

@keyframes ai-spin {
  to { transform: rotate(360deg); }
}

@keyframes assistant-logo-fold-left {
  0%, 18%, 100% {
    transform: perspective(120px) translateX(0) rotateY(0deg) scaleX(1);
    filter: brightness(1) contrast(1);
  }
  50% {
    transform: perspective(120px) translateX(1px) rotateY(45deg) scaleX(0.94);
    filter: brightness(1.12) contrast(1.08);
  }
  82% {
    transform: perspective(120px) translateX(0.4px) rotateY(8deg) scaleX(0.985);
    filter: brightness(1.03) contrast(1.02);
  }
}

@keyframes assistant-logo-fold-right {
  0%, 18%, 100% {
    transform: perspective(120px) translateX(0) rotateY(0deg) scaleX(1);
    filter: brightness(1) contrast(1);
  }
  50% {
    transform: perspective(120px) translateX(-1px) rotateY(-45deg) scaleX(0.94);
    filter: brightness(1.12) contrast(1.08);
  }
  82% {
    transform: perspective(120px) translateX(-0.4px) rotateY(-8deg) scaleX(0.985);
    filter: brightness(1.03) contrast(1.02);
  }
}

@keyframes assistant-logo-axis-pulse {
  0%, 18%, 100% {
    opacity: 0.34;
    transform: translateX(-50%) scaleY(0.9);
  }
  50% {
    opacity: 0.9;
    transform: translateX(-50%) scaleY(1.08);
  }
  82% {
    opacity: 0.48;
    transform: translateX(-50%) scaleY(0.98);
  }
}

.input-area {
  padding: 12px 24px 18px;
  border-top: 1px solid rgba(226, 232, 240, 0.72);
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.72), rgba(255, 255, 255, 0.9));
  flex-shrink: 0;
  position: relative;
  z-index: 20;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.composer-shell {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(203, 213, 225, 0.78);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 14px 38px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.78);
  padding: 8px 10px 7px;
}

.composer-shell--model-open {
  overflow: visible;
}

.composer-shell::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(115deg, rgba(74, 108, 247, 0.4), rgba(139, 92, 246, 0.18), rgba(63, 174, 130, 0.22));
  opacity: 0;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.composer-shell:focus-within {
  border-color: rgba(110, 141, 248, 0.52);
  box-shadow: 0 18px 46px rgba(74, 108, 247, 0.12), 0 0 0 4px rgba(110, 141, 248, 0.08);
}

.composer-shell:focus-within::before {
  opacity: 1;
}

.composer-meta-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  margin-bottom: 4px;
}

.composer-attachment-tip {
  margin: -1px 0 6px;
  padding-left: 2px;
  color: #94a3b8;
  font-size: 10px;
  line-height: 1.3;
}

.composer-meta-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.08);
  border: 1px solid rgba(14, 165, 233, 0.12);
}

.composer-meta-icon.selection {
  background: rgba(168, 85, 247, 0.08);
  border-color: rgba(168, 85, 247, 0.16);
}

.composer-selection-hint-card {
  min-width: 0;
  max-width: 150px;
}

.composer-selection-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  padding: 0 2px 0 0;
  border-radius: 0;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 10px;
  line-height: 1.2;
  white-space: nowrap;
}

.composer-selection-hint span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.composer-selection-hint .composer-meta-icon-image {
  width: 12px;
  height: 12px;
  opacity: 0.72;
}

.composer-attachment-icons {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
  flex: 1;
}

.composer-hover-card {
  position: relative;
  flex-shrink: 0;
}

.composer-attachment-chip {
  display: inline-flex;
  align-items: stretch;
  max-width: min(320px, 100%);
  border: 1px solid rgba(14, 165, 233, 0.18);
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.08);
  overflow: hidden;
}

.composer-attachment-ref-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  padding: 4px 8px 4px 7px;
  border: none;
  background: transparent;
  color: #0f172a;
  cursor: pointer;
}

.composer-attachment-ref-btn:hover {
  background: rgba(14, 165, 233, 0.12);
}

.composer-attachment-ref-btn:focus-visible,
.composer-attachment-remove-btn:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 1px rgba(14, 165, 233, 0.42);
}

.composer-attachment-ref-text {
  flex-shrink: 0;
  color: #0369a1;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.composer-attachment-ref-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #475569;
  font-size: 11px;
}

.composer-attachment-remove-btn {
  flex-shrink: 0;
  width: 24px;
  border: none;
  border-left: 1px solid rgba(14, 165, 233, 0.14);
  background: rgba(14, 165, 233, 0.04);
  color: #64748b;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.composer-attachment-remove-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.composer-meta-icon-image {
  width: 16px;
  height: 16px;
  display: block;
}

.composer-tooltip {
  --tooltip-shift-x: 0px;
  --tooltip-arrow-left: 14px;
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  z-index: 30;
  min-width: 120px;
  max-width: min(360px, calc(100vw - 48px));
  padding: 8px 10px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.96);
  color: #f8fafc;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.18);
  opacity: 0;
  pointer-events: none;
  transform: translate(var(--tooltip-shift-x), 4px);
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.composer-tooltip::after {
  content: '';
  position: absolute;
  left: var(--tooltip-arrow-left);
  top: 100%;
  width: 8px;
  height: 8px;
  background: rgba(15, 23, 42, 0.96);
  border-right: 1px solid rgba(148, 163, 184, 0.18);
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  transform: translate(-50%, -4px) rotate(45deg);
}

.composer-hover-card:hover .composer-tooltip,
.composer-hover-card:focus-within .composer-tooltip {
  opacity: 1;
  transform: translateY(0);
}

.composer-tooltip-selection {
  left: 0;
  right: auto;
  min-width: 200px;
  max-width: min(360px, calc(100vw - 72px));
}

.composer-tooltip-attachment {
  min-width: 160px;
  max-width: 280px;
  text-align: left;
  white-space: normal;
}

.composer-tooltip-title {
  margin-bottom: 4px;
  color: rgba(248, 250, 252, 0.88);
  font-size: 11px;
}

.context-sense-panel {
  margin-top: 6px;
  border-radius: 10px;
  background: rgba(14, 165, 233, 0.03);
}

.context-sense-panel.collapsed {
  background: transparent;
}

.context-sense-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
}

.context-sense-icon-btn:hover {
  color: #0284c7;
  background: rgba(14, 165, 233, 0.08);
}

.context-sense-bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(14, 165, 233, 0.18);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(14, 165, 233, 0.06), rgba(14, 165, 233, 0.03));
}

.context-sense-main {
  flex: 1;
  min-width: 0;
}

.context-sense-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.context-sense-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.24);
  color: #475569;
  font-size: 11px;
  line-height: 1.5;
}

.context-sense-preview {
  margin-top: 8px;
  color: var(--ai-text-muted);
  font-size: 11px;
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.input-row {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: 8px;
}

.chat-attachment-input {
  display: none;
}

.knowledge-base-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  width: 42px;
  padding: 8px 10px;
  border: 1px solid var(--ai-border);
  border-radius: var(--ai-radius-sm);
  background: #fff;
  color: var(--ai-text);
  cursor: pointer;
  flex-shrink: 0;
}

.knowledge-base-btn:hover {
  border-color: #0ea5e9;
}

.knowledge-base-icon {
  width: 20px;
  height: 20px;
  display: block;
}

.model-select-wrap {
  position: relative;
  flex-shrink: 0;
  z-index: 40;
}

.model-select-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid var(--ai-border);
  border-radius: var(--ai-radius-sm);
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  color: var(--ai-text);
}

.model-select-btn:hover {
  border-color: #0ea5e9;
}

.model-select-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.model-select-arrow {
  font-size: 10px;
  color: var(--ai-text-muted);
}

.model-dropdown {
  position: absolute;
  left: 0;
  bottom: 100%;
  margin-bottom: 6px;
  min-width: 260px;
  max-height: 360px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid var(--ai-border);
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  z-index: 2000;
}

.model-dropdown-empty {
  padding: 20px 16px;
  font-size: 13px;
  color: var(--ai-text-muted);
  line-height: 1.5;
}

.model-dropdown-empty-text {
  margin: 0;
}

.model-dropdown-empty-btn {
  margin-top: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 12px;
  border: 1px solid rgba(14, 165, 233, 0.24);
  border-radius: 8px;
  background: rgba(14, 165, 233, 0.08);
  color: #0284c7;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.model-dropdown-empty-btn:hover {
  background: rgba(14, 165, 233, 0.14);
}

.model-group {
  padding: 4px 0;
}

.model-group:first-child {
  padding-top: 8px;
}

.model-group:last-child {
  padding-bottom: 8px;
}

.model-group-label {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  margin: 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ai-text);
  cursor: pointer;
  user-select: none;
  border-radius: 8px;
  transition: background 0.15s ease, color 0.15s ease;
}

.model-group-label:hover {
  background: rgba(14, 165, 233, 0.06);
  color: #0284c7;
}

.model-group-arrow {
  font-size: 11px;
  color: var(--ai-text-muted);
  transition: transform 0.2s ease;
  flex-shrink: 0;
  width: 14px;
  text-align: center;
}

.model-group-label:hover .model-group-arrow {
  color: #0284c7;
}

.model-group-label.collapsed .model-group-arrow {
  transform: rotate(-90deg);
}

.model-group-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  flex-shrink: 0;
  border-radius: 4px;
}

.model-group-models {
  padding: 2px 0 4px 0;
}

.model-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px 10px 42px;
  margin: 0 8px 2px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--ai-text);
  border-radius: 8px;
  transition: background 0.15s ease, color 0.15s ease;
}

.model-option:hover {
  background: rgba(14, 165, 233, 0.06);
  color: #0284c7;
}

.model-option.active {
  background: rgba(14, 165, 233, 0.12);
  color: #0369a1;
}

.model-option.active:hover {
  background: rgba(14, 165, 233, 0.16);
}

.model-option-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  flex-shrink: 0;
  border-radius: 4px;
}

.model-select {
  width: 100%;
  max-width: 280px;
  padding: 6px 10px;
  border: 1px solid var(--ai-border);
  border-radius: var(--ai-radius-sm);
  font-size: 13px;
  background: #fff;
  cursor: pointer;
}

.input-wrapper {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.text-input {
  flex: 1;
  min-width: 0;
  min-height: 40px;
  max-height: 180px;
  padding: 8px 0 7px;
  border: none;
  border-radius: 0;
  font-size: 14px;
  font-family: inherit;
  background: transparent;
  resize: none;
  line-height: 1.5;
}

.text-input:focus {
  outline: none;
}

.tool-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  position: relative;
  background: rgba(248, 250, 252, 0.72);
  border-radius: 10px;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.15s ease, opacity 0.15s ease, filter 0.15s ease;
}

.tool-icon-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: saturate(1.08);
  background: rgba(239, 246, 255, 0.95);
}

.tool-icon-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
  filter: grayscale(0.25);
}

.tool-icon-image {
  width: 20px;
  height: 20px;
  display: block;
}

.tool-icon-btn.send .tool-icon-image {
  width: 22px;
  height: 22px;
}

.tool-icon-btn.send.is-launching {
  animation: send-button-launch 0.72s cubic-bezier(0.2, 0.9, 0.2, 1) both;
}

.tool-icon-btn.send.is-launching::before,
.tool-icon-btn.send.is-launching::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 999px;
  pointer-events: none;
}

.tool-icon-btn.send.is-launching::before {
  background: radial-gradient(circle, rgba(125, 211, 252, 0.34), rgba(59, 130, 246, 0) 70%);
  animation: send-button-wave 0.72s ease-out both;
}

.tool-icon-btn.send.is-launching::after {
  border: 1px solid rgba(59, 130, 246, 0.42);
  animation: send-button-ring 0.72s ease-out both;
}

.tool-icon-toggle {
  transition: transform 0.18s ease;
}

.tool-icon-toggle.expanded {
  transform: rotate(90deg);
}

.attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.attachment-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 260px;
  padding: 5px 8px;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.08);
  border: 1px solid rgba(14, 165, 233, 0.16);
  color: #334155;
  font-size: 11px;
  line-height: 1.4;
}

.attachment-chip-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-chip-meta {
  color: #64748b;
  flex-shrink: 0;
}

.attachment-chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  border-radius: 999px;
  flex-shrink: 0;
}

.attachment-chip-remove:hover {
  background: rgba(14, 165, 233, 0.12);
  color: #0369a1;
}

.assistant-recommend-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.assistant-recommend-modal {
  width: min(640px, calc(100vw - 32px));
  max-height: min(78vh, 720px);
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.18);
  overflow: hidden;
}

.assistant-recommend-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px 14px;
  border-bottom: 1px solid var(--ai-border);
}

.assistant-recommend-modal-header h4 {
  margin: 0;
  font-size: 16px;
}

.assistant-recommend-modal-header p {
  margin: 6px 0 0;
  color: var(--ai-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.assistant-recommend-modal-body {
  padding: 16px 18px 18px;
  overflow-y: auto;
}

.knowledge-base-modal {
  width: min(320px, calc(100vw - 32px));
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.18);
  overflow: hidden;
}

.knowledge-base-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--ai-border);
}

.knowledge-base-modal-header h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.knowledge-base-modal-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 18px 18px 20px;
  text-align: center;
}

.knowledge-base-modal-title {
  color: var(--ai-text);
  font-size: 17px;
  font-weight: 700;
}

.knowledge-base-modal-text {
  margin: 8px 0 14px;
  color: var(--ai-text-muted);
  font-size: 13px;
  line-height: 1.6;
}

.knowledge-base-qr-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 138px;
  height: 138px;
  padding: 8px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.12);
}

.knowledge-base-qr {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 8px;
}

.knowledge-base-modal-hint {
  margin: 0;
  color: var(--ai-text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.assistant-recommend-modal-empty {
  padding: 8px 4px;
}

.assistant-recommend-modal-empty .message-skill-empty-card {
  margin-top: 0;
}

.assistant-recommend-modal-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.assistant-recommend-modal-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  border: 1px solid var(--ai-border);
  border-radius: 12px;
  background: #f8fafc;
}

.assistant-recommend-modal-main {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.assistant-recommend-modal-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(14, 165, 233, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  font-size: 18px;
}

.assistant-recommend-modal-icon img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.assistant-recommend-modal-text {
  min-width: 0;
  flex: 1;
}

.assistant-recommend-modal-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.assistant-recommend-modal-name {
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ai-text);
}

.assistant-recommend-modal-badge {
  flex-shrink: 0;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.12);
  color: #0369a1;
  font-size: 11px;
  line-height: 1.5;
}

.assistant-recommend-modal-desc {
  margin-top: 4px;
  color: var(--ai-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.assistant-recommend-modal-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.assistant-recommend-run-btn,
.assistant-recommend-window-btn {
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
}

.assistant-recommend-run-btn {
  border: none;
  background: #0ea5e9;
  color: #fff;
}

.assistant-recommend-run-btn:hover {
  background: #0284c7;
}

.assistant-recommend-window-btn {
  border: 1px solid var(--ai-border);
  background: #fff;
  color: var(--ai-text);
}

.assistant-recommend-window-btn:hover {
  border-color: #0ea5e9;
  color: #0284c7;
}

/* 插入内容确认弹窗 */
.insert-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.insert-modal {
  background: var(--ai-assistant-bg);
  border-radius: var(--ai-radius);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 520px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.insert-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--ai-border);
}

.insert-modal-header h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.btn-close-modal {
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 20px;
  color: var(--ai-text-muted);
  cursor: pointer;
  line-height: 1;
}

.btn-close-modal:hover {
  color: var(--ai-text);
}

.insert-modal-body {
  padding: 16px;
  flex: 1;
  min-height: 0;
}

.insert-modal-textarea {
  width: 100%;
  min-height: 200px;
  padding: 12px;
  border: 1px solid var(--ai-border);
  border-radius: var(--ai-radius-sm);
  font-size: 14px;
  font-family: inherit;
  line-height: 1.6;
  resize: vertical;
  box-sizing: border-box;
}

.insert-modal-textarea:focus {
  outline: none;
  border-color: #0ea5e9;
}

.insert-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 18px;
  border-top: 1px solid var(--ai-border);
}

.btn-modal-cancel {
  padding: 8px 18px;
  border: 1px solid var(--ai-border);
  border-radius: var(--ai-radius-sm);
  background: #fff;
  font-size: 14px;
  color: var(--ai-text);
  cursor: pointer;
}

.btn-modal-cancel:hover {
  background: var(--ai-sidebar-bg);
}

.btn-modal-confirm {
  padding: 8px 18px;
  border: none;
  border-radius: var(--ai-radius-sm);
  background: #0ea5e9;
  font-size: 14px;
  color: #fff;
  cursor: pointer;
}

.btn-modal-confirm:hover {
  background: #0284c7;
}
</style>
