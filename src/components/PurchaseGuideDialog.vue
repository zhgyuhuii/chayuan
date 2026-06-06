<!--
  PurchaseGuideDialog.vue
  购买引导对话框 - 执行助手次数用完 / 脱密付费门控 共用
-->
<template>
  <div
    v-if="visible"
    class="purchase-guide-overlay"
    @click.self="onClose"
  >
    <div class="purchase-guide-modal" role="dialog" aria-modal="true">
      <div class="purchase-guide-header">
        <h4 class="purchase-guide-title">{{ title }}</h4>
        <button type="button" class="btn-close-modal" @click="onClose">×</button>
      </div>

      <div class="purchase-guide-body">
        <!-- 说明文案 -->
        <p class="purchase-guide-desc">{{ desc }}</p>

        <!-- 二维码区域 -->
        <div class="purchase-guide-qr-section">
          <div class="purchase-guide-qr-wrap">
            <img
              v-if="qrDataUrl"
              :src="qrDataUrl"
              alt="扫码购买"
              class="purchase-guide-qr-img"
              width="160"
              height="160"
            />
            <div v-else class="purchase-guide-qr-placeholder">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#94a3b8" stroke-width="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <circle cx="17.5" cy="17.5" r="2.5"/>
              </svg>
              <span>加载中...</span>
            </div>
          </div>
          <p class="purchase-guide-qr-hint">用手机扫码购买，或</p>
          <a
            class="purchase-guide-link"
            :href="buyUrl"
            target="_blank"
            rel="noopener noreferrer"
          >在电脑浏览器中打开</a>
        </div>

        <!-- 序列号激活 -->
        <div class="purchase-guide-activate-section">
          <p class="purchase-guide-activate-label">已购买？输入序列号激活：</p>
          <div class="purchase-guide-activate-row">
            <input
              v-model="serialInput"
              class="purchase-guide-serial-input"
              type="text"
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX-X"
              :disabled="activating"
              @keydown.enter="doActivate"
            />
            <button
              type="button"
              class="purchase-guide-activate-btn"
              :disabled="activating || !serialInput.trim()"
              @click="doActivate"
            >
              {{ activating ? '验证中...' : '激活' }}
            </button>
          </div>
          <p v-if="activateMsg" class="purchase-guide-activate-msg" :class="activateOk ? 'is-ok' : 'is-err'">
            {{ activateMsg }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { activate, getDailyFreeRemaining } from '../utils/licenseStore.js'
import { getFingerprint } from '../utils/license/fingerprint.js'

// 通过 qrserver.com 生成二维码图片 URL（img src 不跨域）
function buildQrImgUrl(text, size = 160) {
  const encoded = encodeURIComponent(String(text || ''))
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`
}

export default {
  name: 'PurchaseGuideDialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    reason: {
      // 'quota_exceeded' | 'declassify' | 'declassify_restore'
      type: String,
      default: 'quota_exceeded'
    }
  },
  emits: ['close', 'activated'],
  data() {
    return {
      fingerprint: '',
      qrDataUrl: '',
      serialInput: '',
      activating: false,
      activateMsg: '',
      activateOk: false
    }
  },
  computed: {
    title() {
      if (this.reason === 'quota_exceeded') {
        const rem = getDailyFreeRemaining()
        return `今日免费次数已用完（剩余 ${rem} / 5 次）`
      }
      if (this.reason === 'declassify') return '脱密功能需购买后使用'
      if (this.reason === 'declassify_restore') return '脱密复原功能需购买后使用'
      return '购买察元 AI 文档助手'
    },
    desc() {
      if (this.reason === 'quota_exceeded') {
        return '免费版每日可使用 5 次执行助手。购买授权后不限次数，同时解锁脱密/脱密还原等高级功能。'
      }
      if (this.reason === 'declassify') {
        return '文档脱密功能（占位符替换+密码加密）属于付费功能，购买授权后即可使用。'
      }
      if (this.reason === 'declassify_restore') {
        return '脱密复原功能属于付费功能，购买授权后即可使用。'
      }
      return '购买授权后可无限次使用执行助手及全部高级功能。'
    },
    buyUrl() {
      if (!this.fingerprint) return 'https://aidooo.com/buy?app=wps'
      return `https://aidooo.com/buy?app=wps&mid=${encodeURIComponent(this.fingerprint)}`
    }
  },
  watch: {
    visible(val) {
      if (val) {
        this.serialInput = ''
        this.activateMsg = ''
        this.activateOk = false
        this.activating = false
        this.loadFingerprintAndQr()
      }
    }
  },
  methods: {
    onClose() {
      this.$emit('close')
    },
    async loadFingerprintAndQr() {
      this.qrDataUrl = ''
      try {
        this.fingerprint = await getFingerprint()
      } catch (e) {
        this.fingerprint = ''
      }
      // 使用 buyUrl（含 mid 参数）生成二维码
      this.qrDataUrl = buildQrImgUrl(this.buyUrl, 160)
    },
    async doActivate() {
      const serial = this.serialInput.trim()
      if (!serial) return
      this.activating = true
      this.activateMsg = ''
      this.activateOk = false
      try {
        const result = await activate(serial)
        if (result.ok) {
          this.activateOk = true
          this.activateMsg = '激活成功！授权已生效，窗口将自动关闭。'
          setTimeout(() => {
            this.$emit('activated')
            this.$emit('close')
          }, 1200)
        } else {
          this.activateOk = false
          this.activateMsg = result.error || '序列号无效，请检查后重试。'
        }
      } catch (e) {
        this.activateOk = false
        this.activateMsg = e?.message || '激活失败，请稍后重试。'
      } finally {
        this.activating = false
      }
    }
  }
}
</script>

<style scoped>
.purchase-guide-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.purchase-guide-modal {
  width: min(420px, calc(100vw - 32px));
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.purchase-guide-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid #e2e8f0;
}

.purchase-guide-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
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

.purchase-guide-body {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.purchase-guide-desc {
  margin: 0;
  font-size: 13px;
  color: #475569;
  line-height: 1.6;
}

.purchase-guide-qr-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.purchase-guide-qr-wrap {
  width: 160px;
  height: 160px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
}

.purchase-guide-qr-img {
  display: block;
  width: 160px;
  height: 160px;
  object-fit: contain;
}

.purchase-guide-qr-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #94a3b8;
  font-size: 12px;
}

.purchase-guide-qr-hint {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
}

.purchase-guide-link {
  font-size: 13px;
  color: #3b82f6;
  text-decoration: none;
}
.purchase-guide-link:hover { text-decoration: underline; }

.purchase-guide-activate-section {
  border-top: 1px solid #f1f5f9;
  padding-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.purchase-guide-activate-label {
  margin: 0;
  font-size: 13px;
  color: #64748b;
}

.purchase-guide-activate-row {
  display: flex;
  gap: 8px;
}

.purchase-guide-serial-input {
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  font-family: 'Courier New', Courier, monospace;
  color: #1e293b;
  outline: none;
  transition: border-color 0.15s;
}
.purchase-guide-serial-input:focus { border-color: #3b82f6; }
.purchase-guide-serial-input:disabled { background: #f8fafc; color: #94a3b8; }

.purchase-guide-activate-btn {
  padding: 7px 14px;
  border: none;
  border-radius: 6px;
  background: #3b82f6;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}
.purchase-guide-activate-btn:hover:not(:disabled) { background: #2563eb; }
.purchase-guide-activate-btn:disabled { background: #93c5fd; cursor: not-allowed; }

.purchase-guide-activate-msg {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}
.purchase-guide-activate-msg.is-ok { color: #16a34a; }
.purchase-guide-activate-msg.is-err { color: #dc2626; }
</style>
