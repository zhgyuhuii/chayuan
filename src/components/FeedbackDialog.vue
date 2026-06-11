<!--
  FeedbackDialog.vue
  Chat-style feedback & suggestion dialog for WPS add-in.
  Props: visible (Boolean). Emits: close.
-->
<template>
  <div
    v-if="visible"
    class="feedback-overlay"
    @click.self="onClose"
  >
    <div class="feedback-modal" role="dialog" aria-modal="true">
      <!-- Header -->
      <div class="feedback-header">
        <div class="feedback-header-main">
          <h4 class="feedback-title">反馈及建议</h4>
          <p class="feedback-subtitle">软件「察元AI文档助手」· 版本 {{ appVersion }}</p>
        </div>
        <button type="button" class="btn-close-modal" @click="onClose">×</button>
      </div>

      <!-- Conversation thread -->
      <div class="feedback-thread" ref="threadRef">
        <!-- Loading -->
        <div v-if="loading" class="feedback-thread-loading">加载中...</div>

        <!-- Empty -->
        <div v-else-if="displayItems.length === 0" class="feedback-thread-empty">
          还没有反馈，欢迎把问题和建议告诉我们
        </div>

        <!-- Items -->
        <template v-else>
          <div
            v-for="item in displayItems"
            :key="item.id || item._localId"
            class="feedback-item-group"
          >
            <!-- User bubble (right) -->
            <div class="feedback-bubble-row feedback-bubble-row--user">
              <div class="feedback-bubble feedback-bubble--user">
                <p class="feedback-bubble-text">{{ item.content }}</p>
                <div v-if="item.attachments && item.attachments.length" class="feedback-attachments">
                  <a
                    v-for="(att, ai) in item.attachments"
                    :key="ai"
                    :href="att.url || '#'"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="feedback-attachment-link"
                  >{{ att.name || ('附件' + (ai + 1)) }}</a>
                </div>
                <span v-if="item._pending" class="feedback-bubble-status feedback-bubble-status--pending">发送中...</span>
                <span v-if="item._draft" class="feedback-bubble-status feedback-bubble-status--draft">已存草稿，联网后自动重发</span>
              </div>
            </div>

            <!-- Reply or status (left) -->
            <div v-if="item.reply" class="feedback-bubble-row feedback-bubble-row--service">
              <div class="feedback-service-avatar">客服</div>
              <div class="feedback-bubble feedback-bubble--service">
                <p class="feedback-bubble-text">{{ item.reply }}</p>
              </div>
            </div>
            <div v-else-if="!item._pending && !item._draft" class="feedback-bubble-row feedback-bubble-row--service">
              <div class="feedback-status-chip">
                {{ item.status === 'processing' ? '处理中' : '待处理' }}
              </div>
            </div>

            <!-- Grant card (left) -->
            <div v-if="item.grant && item.grant.serial" class="feedback-bubble-row feedback-bubble-row--service">
              <div
                class="feedback-grant-card"
                :class="{ 'is-expanded': expandedGrants[item.id] }"
                @click="toggleGrant(item)"
              >
                <template v-if="!expandedGrants[item.id]">
                  <span class="feedback-grant-icon">&#x1F9E7;</span>
                  <span class="feedback-grant-collapsed-text">来自察元的奖励，点击领取</span>
                </template>
                <template v-else>
                  <div class="feedback-grant-expanded">
                    <p class="feedback-grant-desc">
                      已为你充值
                      <strong>{{ item.grant.value }} {{ item.grant.kind === 'count' ? '次' : '天' }}</strong>
                      （{{ item.grant.module }}）· 已自动到账
                    </p>
                    <div class="feedback-grant-serial-row">
                      <code class="feedback-grant-serial">{{ item.grant.serial }}</code>
                      <button
                        type="button"
                        class="feedback-grant-copy-btn"
                        @click.stop="copySerial(item.grant.serial, item.id)"
                      >{{ copiedGrantId === item.id ? '已复制' : '复制' }}</button>
                    </div>
                    <p v-if="grantActivateMsg[item.id]" class="feedback-grant-activate-msg" :class="grantActivateOk[item.id] ? 'is-ok' : 'is-err'">
                      {{ grantActivateMsg[item.id] }}
                    </p>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Offline notice -->
      <div v-if="offlineNotice" class="feedback-offline-notice">
        已存草稿，联网后自动重发
      </div>

      <!-- Error notice -->
      <div v-if="sendError" class="feedback-send-error">
        {{ sendError }}
      </div>

      <!-- Input area -->
      <div class="feedback-input-area">
        <!-- Pending attachments -->
        <div v-if="pendingAttachments.length" class="feedback-pending-attachments">
          <div
            v-for="(att, ai) in pendingAttachments"
            :key="ai"
            class="feedback-pending-att"
          >
            <span class="feedback-pending-att-name">{{ att.name || '附件' }}</span>
            <button type="button" class="feedback-pending-att-remove" @click="removePendingAttachment(ai)">×</button>
          </div>
        </div>
        <div class="feedback-input-row">
          <textarea
            v-model="inputText"
            class="feedback-textarea"
            placeholder="描述你的问题或建议…"
            rows="3"
            :disabled="sending"
            @keydown.ctrl.enter.prevent="doSend"
          ></textarea>
        </div>
        <div class="feedback-input-actions">
          <label class="feedback-attach-btn" :class="{ disabled: uploading }">
            <input
              type="file"
              multiple
              accept="image/*,application/pdf,.doc,.docx,.txt"
              style="display:none"
              :disabled="uploading"
              @change="handleFileSelect"
            />
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
            <span>{{ uploading ? '上传中...' : '附件' }}</span>
          </label>
          <button
            type="button"
            class="feedback-send-btn"
            :disabled="sending || !inputText.trim()"
            @click="doSend"
          >{{ sending ? '发送中...' : '发送' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import pkg from '../../package.json'
import { listMyFeedback, submitFeedback, uploadAttachment, retryDrafts } from '../utils/feedbackClient.js'
import { activate } from '../utils/licenseStore.js'

export default {
  name: 'FeedbackDialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close'],
  data() {
    return {
      appVersion: pkg.version || '',
      loading: false,
      items: [],
      // Optimistic pending items not yet confirmed from server
      pendingItems: [],
      inputText: '',
      pendingAttachments: [],
      uploading: false,
      sending: false,
      offlineNotice: false,
      sendError: '',
      expandedGrants: {},
      copiedGrantId: null,
      grantActivateMsg: {},
      grantActivateOk: {}
    }
  },
  computed: {
    displayItems() {
      return [...this.items, ...this.pendingItems]
    }
  },
  watch: {
    visible(val) {
      if (val) {
        this.offlineNotice = false
        this.sendError = ''
        this.onOpen()
      }
    }
  },
  methods: {
    onClose() {
      this.$emit('close')
    },
    async onOpen() {
      // Retry drafts best-effort
      retryDrafts().catch(() => {})
      await this.fetchThread()
    },
    async fetchThread() {
      this.loading = true
      try {
        const fetched = await listMyFeedback()
        this.items = Array.isArray(fetched) ? fetched : []
        this.pendingItems = []
        // Auto-claim grants
        await this.autoClaimGrants()
      } catch (e) {
        // Silently keep empty
      } finally {
        this.loading = false
        this.$nextTick(() => this.scrollToBottom())
      }
    },
    async autoClaimGrants() {
      for (const item of this.items) {
        if (!item.grant || !item.grant.serial) continue
        const grantId = item.id
        // Skip if we already have a message for this grant
        if (this.grantActivateMsg[grantId]) continue
        try {
          const result = await activate(item.grant.serial)
          if (result.ok) {
            this.$set(this.grantActivateMsg, grantId, '已自动激活到账')
            this.$set(this.grantActivateOk, grantId, true)
            // Auto-expand so user sees the confirmation
            this.$set(this.expandedGrants, grantId, true)
          }
          // If not ok (e.g., already activated or wrong module), silently ignore
        } catch (e) {
          // Silent — grant reveal still available manually
        }
      }
    },
    toggleGrant(item) {
      const id = item.id
      const current = this.expandedGrants[id]
      this.$set(this.expandedGrants, id, !current)
    },
    async copySerial(serial, id) {
      try {
        await navigator.clipboard.writeText(serial)
        this.copiedGrantId = id
        setTimeout(() => { this.copiedGrantId = null }, 2000)
      } catch (e) {
        // Clipboard unavailable — silent
      }
    },
    removePendingAttachment(index) {
      this.pendingAttachments.splice(index, 1)
    },
    async handleFileSelect(e) {
      const files = Array.from(e.target.files || [])
      if (!files.length) return
      // Reset input so same file can be selected again
      e.target.value = ''
      this.uploading = true
      for (const file of files) {
        try {
          const att = await uploadAttachment(file)
          this.pendingAttachments.push({
            name: att.name || file.name,
            url: att.url || '',
            kind: att.kind || 'file',
            size: att.size || file.size
          })
        } catch (err) {
          // Failed uploads: silently skip individual files
        }
      }
      this.uploading = false
    },
    async doSend() {
      const text = this.inputText.trim()
      if (!text) return
      if (this.sending) return

      this.sending = true
      this.offlineNotice = false
      this.sendError = ''

      const attachmentsCopy = this.pendingAttachments.slice()
      const localId = '_pending_' + Date.now()

      // Optimistic bubble
      const optimistic = {
        _localId: localId,
        content: text,
        attachments: attachmentsCopy,
        _pending: true
      }
      this.pendingItems.push(optimistic)
      this.inputText = ''
      this.pendingAttachments = []
      this.$nextTick(() => this.scrollToBottom())

      try {
        await submitFeedback({ content: text, attachments: attachmentsCopy })
        // Success: remove optimistic, re-fetch real thread
        this.pendingItems = this.pendingItems.filter(p => p._localId !== localId)
        await this.fetchThread()
      } catch (err) {
        if (err && err.offline) {
          // Mark as draft
          const idx = this.pendingItems.findIndex(p => p._localId === localId)
          if (idx !== -1) {
            this.$set(this.pendingItems, idx, { ...this.pendingItems[idx], _pending: false, _draft: true })
          }
          this.offlineNotice = true
        } else {
          // Other error: remove optimistic, restore input
          this.pendingItems = this.pendingItems.filter(p => p._localId !== localId)
          this.inputText = text
          this.pendingAttachments = attachmentsCopy
          this.sendError = (err && err.message) ? err.message : '发送失败，请稍后重试'
        }
      } finally {
        this.sending = false
        this.$nextTick(() => this.scrollToBottom())
      }
    },
    scrollToBottom() {
      const el = this.$refs.threadRef
      if (el) el.scrollTop = el.scrollHeight
    }
  }
}
</script>

<style scoped>
.feedback-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.feedback-modal {
  width: min(420px, calc(100vw - 32px));
  max-height: calc(100vh - 24px);
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.feedback-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.feedback-header-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.feedback-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.4;
}

.feedback-subtitle {
  margin: 0;
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.4;
}

.btn-close-modal {
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 20px;
  color: #94a3b8;
  cursor: pointer;
  line-height: 1;
  flex-shrink: 0;
}
.btn-close-modal:hover { color: #1e293b; }

/* Thread */
.feedback-thread {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.feedback-thread-loading,
.feedback-thread-empty {
  font-size: 13px;
  color: #94a3b8;
  text-align: center;
  padding: 32px 0;
}

.feedback-item-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Bubble rows */
.feedback-bubble-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.feedback-bubble-row--user {
  flex-direction: row-reverse;
}

.feedback-bubble-row--service {
  flex-direction: row;
}

/* Bubbles */
.feedback-bubble {
  max-width: 78%;
  border-radius: 12px;
  padding: 8px 12px;
}

.feedback-bubble--user {
  background: #2563eb;
  color: #fff;
  border-bottom-right-radius: 3px;
}

.feedback-bubble--service {
  background: #f1f5f9;
  color: #1e293b;
  border-bottom-left-radius: 3px;
}

.feedback-bubble-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.feedback-bubble--user .feedback-bubble-text {
  color: #fff;
}

.feedback-attachments {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.feedback-attachment-link {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.85);
  text-decoration: underline;
}

.feedback-bubble--service .feedback-attachment-link {
  color: #3b82f6;
}

.feedback-bubble-status {
  display: block;
  margin-top: 4px;
  font-size: 11px;
}

.feedback-bubble-status--pending {
  color: rgba(255, 255, 255, 0.65);
}

.feedback-bubble-status--draft {
  color: rgba(255, 200, 100, 0.9);
}

/* Service avatar */
.feedback-service-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e0e7ff;
  color: #4f46e5;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Status chip */
.feedback-status-chip {
  font-size: 11px;
  color: #64748b;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  padding: 3px 10px;
  align-self: flex-start;
  margin-left: 36px;
}

/* Grant card */
.feedback-grant-card {
  margin-left: 36px;
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  border-radius: 12px;
  padding: 12px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 85%;
  transition: opacity 0.15s;
  user-select: none;
}

.feedback-grant-card:hover {
  opacity: 0.92;
}

.feedback-grant-card.is-expanded {
  cursor: default;
  align-items: flex-start;
  flex-direction: column;
  gap: 0;
}

.feedback-grant-icon {
  font-size: 22px;
  flex-shrink: 0;
}

.feedback-grant-collapsed-text {
  color: #fff;
  font-size: 13px;
  font-weight: 500;
}

.feedback-grant-expanded {
  color: #fff;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feedback-grant-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}

.feedback-grant-serial-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 6px 10px;
}

.feedback-grant-serial {
  flex: 1;
  min-width: 0;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feedback-grant-copy-btn {
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: transparent;
  color: #fff;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.feedback-grant-copy-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.feedback-grant-activate-msg {
  margin: 0;
  font-size: 12px;
}

.feedback-grant-activate-msg.is-ok { color: #bbf7d0; }
.feedback-grant-activate-msg.is-err { color: #fca5a5; }

/* Notices */
.feedback-offline-notice,
.feedback-send-error {
  padding: 6px 16px;
  font-size: 12px;
  text-align: center;
  flex-shrink: 0;
}

.feedback-offline-notice {
  color: #92400e;
  background: #fef3c7;
}

.feedback-send-error {
  color: #dc2626;
  background: #fee2e2;
}

/* Input area */
.feedback-input-area {
  border-top: 1px solid #e2e8f0;
  padding: 10px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.feedback-pending-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.feedback-pending-att {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #f1f5f9;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 12px;
  color: #475569;
  max-width: 180px;
}

.feedback-pending-att-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feedback-pending-att-remove {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
}

.feedback-pending-att-remove:hover { color: #dc2626; }

.feedback-input-row {
  display: flex;
}

.feedback-textarea {
  flex: 1;
  resize: none;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 13px;
  color: #1e293b;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
  line-height: 1.55;
}

.feedback-textarea:focus { border-color: #3b82f6; }
.feedback-textarea:disabled { background: #f8fafc; color: #94a3b8; }

.feedback-input-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.feedback-attach-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
  padding: 5px 8px;
  border-radius: 6px;
  transition: background 0.15s;
  user-select: none;
}

.feedback-attach-btn:hover { background: #f1f5f9; }
.feedback-attach-btn.disabled { opacity: 0.5; cursor: not-allowed; }

.feedback-send-btn {
  padding: 7px 18px;
  border: none;
  border-radius: 8px;
  background: #2563eb;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.feedback-send-btn:hover:not(:disabled) { background: #1d4ed8; }
.feedback-send-btn:disabled { background: #93c5fd; cursor: not-allowed; }
</style>
