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

        <!-- 二维码 tab:默认「扫码购买」,另一个「分享」,只显示一个(参考 chayuan-desktop) -->
        <div class="purchase-guide-qr-tabs">
          <button
            type="button"
            class="purchase-guide-qr-tab"
            :class="{ active: qrTab === 'buy' }"
            @click="qrTab = 'buy'"
          >扫码购买</button>
          <button
            type="button"
            class="purchase-guide-qr-tab"
            :class="{ active: qrTab === 'share' }"
            @click="qrTab = 'share'"
          >分享获取次数</button>
        </div>

        <!-- 购买二维码 -->
        <div v-if="qrTab === 'buy'" class="purchase-guide-qr-section">
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
          <p class="purchase-guide-qr-hint">扫码购买（解除次数限制），或</p>
          <a
            class="purchase-guide-link"
            :href="buyUrl"
            target="_blank"
            rel="noopener noreferrer"
            @click.prevent="openInBrowser(buyUrl)"
          >在电脑浏览器中打开</a>
          <p class="purchase-guide-url">{{ buyUrl }}</p>
        </div>

        <!-- 分享二维码:分享给好友,双方各得次数 -->
        <div v-else class="purchase-guide-qr-section">
          <div class="purchase-guide-qr-wrap">
            <img
              v-if="shareQrDataUrl"
              :src="shareQrDataUrl"
              alt="分享二维码"
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
          <p class="purchase-guide-qr-hint">好友扫码安装并首次使用后，你和好友各得该功能使用次数</p>
        </div>

        <!-- 本机指纹条 -->
        <div v-if="fingerprint" class="purchase-guide-fp">
          <span class="purchase-guide-fp-label">本机指纹</span>
          <code class="purchase-guide-fp-code">{{ fingerprint }}</code>
          <button type="button" class="purchase-guide-fp-copy" @click="copyFingerprint">{{ fpCopied ? '已复制' : '复制' }}</button>
        </div>

        <!-- 公众号关注折叠 -->
        <div class="purchase-guide-follow">
          <button type="button" class="purchase-guide-follow-head" @click="followOpen = !followOpen">
            <span>关注「智灵鸟科技」公众号查询序列号</span>
            <span>{{ followOpen ? '▲' : '▼' }}</span>
          </button>
          <div v-if="followOpen" class="purchase-guide-follow-body">
            <img src="/images/pay/follow.png" alt="智灵鸟科技公众号" width="96" height="96" />
            <p>购买后如未记录序列号，可凭本机指纹查询。</p>
          </div>
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

        <!-- 用户协议小字（参考 chayuan-desktop LicenseDialog） -->
        <p class="purchase-guide-agreement-tip">
          购买即视为同意
          <button type="button" class="purchase-guide-agreement-link" @click="agreeOpen = true">《{{ AGREEMENT_TITLE }}》</button>
        </p>
      </div>
    </div>

    <!-- 本地用户协议弹窗 -->
    <div v-if="agreeOpen" class="purchase-agreement-overlay" @click.self="agreeOpen = false">
      <div class="purchase-agreement-modal" role="dialog" aria-modal="true">
        <div class="purchase-guide-header">
          <h4 class="purchase-guide-title">{{ AGREEMENT_TITLE }}</h4>
          <button type="button" class="btn-close-modal" @click="agreeOpen = false">×</button>
        </div>
        <div class="purchase-agreement-body">{{ AGREEMENT_BODY }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import { activate, getQuotaRemaining, getQuotaLimit } from '../utils/licenseStore.js'
import { getFingerprint } from '../utils/license/fingerprint.js'
import { toDataUrl as buildQrDataUrl } from '../utils/qrcode.js'

// 用户协议文案：与 chayuan-desktop 的 features/license/userAgreement.ts 保持一致
const USER_AGREEMENT_TITLE = '察元 AI 购买与使用协议'
const USER_AGREEMENT_BODY = `完成付款即视为您已阅读、理解并同意本协议全部条款。

1. 商品性质：本产品为数字软件授权（序列号/授权码），非实物商品。
2. 不退款：序列号一经签发并发送至您的设备指纹即视为交付完成；鉴于数字商品特殊性，序列号一经发出或激活，概不退款，请购买前确认商品、档位、本机指纹无误。
3. 授权范围与设备绑定：序列号与本机设备指纹绑定，仅限本机使用，不得转售/共享/在其他设备激活；更换设备、重装系统或系统重置导致设备指纹变化的，原序列号即失效，需重新购买，本产品不支持换机迁移、跨设备转移或找回。
4. 序列号保管：请购买后及时记录妥善保管；如未记录，可关注「智灵鸟科技」公众号凭指纹查询。
5. 使用规范：不得利用本产品从事违法违规活动。
6. 协议变更：我们可能不时更新本协议，更新后自公布之日起生效。`

/** 按池剩余次数生成标题：有剩余=提醒「还可用 X 次」，耗尽=「已用完」。 */
function _poolTitle(pool, label) {
  const rem = getQuotaRemaining(pool)
  const lim = getQuotaLimit(pool)
  return rem > 0
    ? `今日还可免费使用 ${rem} / ${lim} 次（${label}）`
    : `今日免费次数已用完（0 / ${lim}）`
}

export default {
  name: 'PurchaseGuideDialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    reason: {
      // 'chat_quota' | 'assistant_quota' | 'quota_exceeded' | 'declassify' | 'declassify_restore' | 'security_check' | 'secret_keyword'
      type: String,
      default: 'quota_exceeded'
    }
  },
  emits: ['close', 'activated'],
  data() {
    return {
      fingerprint: '',
      qrDataUrl: '',
      shareQrDataUrl: '',
      serialInput: '',
      activating: false,
      activateMsg: '',
      activateOk: false,
      fpCopied: false,
      followOpen: false,
      agreeOpen: false,
      qrTab: 'buy'
    }
  },
  computed: {
    AGREEMENT_TITLE() { return USER_AGREEMENT_TITLE },
    AGREEMENT_BODY() { return USER_AGREEMENT_BODY },
    meta() {
      // reason -> { title, desc, pool }；pool 有值则显示剩余次数
      const M = {
        chat_quota: {
          pool: 'chat',
          title: _poolTitle('chat', '对话'),
          desc: '免费版每日可对话 30 次。购买授权后不限次数；也可分享给好友，双方各得次数。',
        },
        assistant_quota: {
          pool: 'assistant',
          title: _poolTitle('assistant', '执行助手/脱密/涉密检查'),
          desc: '免费版每日 2 次（执行助手、脱密、脱密还原、涉密检查、涉密关键词提取共用）。购买后不限次数；也可分享给好友，双方各得次数。',
        },
        quota_exceeded: {
          pool: 'assistant',
          title: _poolTitle('assistant', '执行助手/脱密/涉密检查'),
          desc: '免费版每日 2 次（执行助手、脱密、脱密还原、涉密检查、涉密关键词提取共用）。购买后不限次数；也可分享给好友，双方各得次数。',
        },
        declassify: { pool: null, title: '文档脱密需购买后使用', desc: '文档脱密（涉密关键词提取 + 占位符替换 + 加密）属于付费功能，购买授权后即可使用。' },
        declassify_restore: { pool: null, title: '脱密复原需购买后使用', desc: '脱密复原功能属于付费功能，购买授权后即可使用。' },
        security_check: { pool: null, title: '涉密检查需购买后使用', desc: '涉密/保密风险检查属于付费功能，购买授权后即可使用。' },
        secret_keyword: { pool: null, title: '涉密关键词提取需购买后使用', desc: '涉密关键词提取属于付费功能，购买授权后即可使用。' },
        activate: { pool: null, title: '激活授权 · 输入授权码', desc: '已购买？扫描下方购买二维码下单，或在最下方「输入序列号激活」框填入授权码核验；也可分享给好友，双方各得次数。' },
      }
      return M[this.reason] || { pool: null, title: '购买察元 AI 文档助手', desc: '购买授权后可无限次使用执行助手及全部高级功能。' }
    },
    title() { return this.meta.title },
    desc() { return this.meta.desc },
    buyUrl() {
      if (!this.fingerprint) return 'https://aidooo.com/buy?app=wps'
      return `https://aidooo.com/buy?app=wps&mid=${encodeURIComponent(this.fingerprint)}`
    },
    shareUrl() {
      // 分享裂变链接：mid=本机指纹(与购买码一致,确保扫码后能带上分享者指纹),
      // ref=1 标识这是分享链接;好友安装/购买后双方各得次数。
      // 与 chayuan-desktop LicenseDialog 一致:分享链接 = <origin>/share?mid=<本机指纹>。
      // 路径是 /share(分享页,不是 /buy 购买页),参数 mid 携带分享者指纹。
      if (!this.fingerprint) return 'https://aidooo.com/share?app=wps'
      return `https://aidooo.com/share?app=wps&mid=${encodeURIComponent(this.fingerprint)}`
    }
  },
  watch: {
    visible(val) {
      if (val) {
        this.serialInput = ''
        this.activateMsg = ''
        this.activateOk = false
        this.activating = false
        this.fpCopied = false
        this.followOpen = false
        this.agreeOpen = false
        this.qrTab = 'buy'
        this.loadFingerprintAndQr()
      }
    }
  },
  mounted() {
    // 独立路由窗（PurchaseGuideDialogPage）里 visible 恒为 true，
    // watch 不会在初始 true 时触发，故 mounted 时若已可见则主动加载指纹+二维码。
    if (this.visible) {
      this.loadFingerprintAndQr()
    }
  },
  methods: {
    onClose() {
      this.$emit('close')
    },
    // 在系统浏览器打开指定地址。WPS ShowDialog 里 <a target=_blank>/window.open 常被拦截,
    // 需走 WPS 的 OAAssist.ShellExecute / FollowHyperlink,失败再回退 window.open。
    openInBrowser(url) {
      const target = String(url || '').trim()
      if (!target) return
      const app = window.Application || window.opener?.Application || window.parent?.Application
      try {
        if (app?.OAAssist?.ShellExecute) { app.OAAssist.ShellExecute(target); return }
        if (app?.FollowHyperlink) { app.FollowHyperlink(target, '', true); return }
      } catch (e) { /* 回退 window.open */ }
      try { window.open(target, '_blank', 'noopener,noreferrer') } catch (e) { /* 静默 */ }
    },
    async copyFingerprint() {
      if (!this.fingerprint) return
      try {
        await navigator.clipboard.writeText(this.fingerprint)
        this.fpCopied = true
        setTimeout(() => { this.fpCopied = false }, 2000)
      } catch (e) {
        // 剪贴板不可用时静默
      }
    },
    async loadFingerprintAndQr() {
      this.qrDataUrl = ''
      try {
        this.fingerprint = await getFingerprint()
      } catch (e) {
        this.fingerprint = ''
      }
      // 购买二维码（含 mid）+ 分享二维码（含 ref），均本地生成、离线可用
      try {
        this.qrDataUrl = await buildQrDataUrl(this.buyUrl, 160)
      } catch (e) {
        this.qrDataUrl = ''
      }
      try {
        this.shareQrDataUrl = await buildQrDataUrl(this.shareUrl, 160)
      } catch (e) {
        this.shareQrDataUrl = ''
      }
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
  max-height: calc(100vh - 24px);
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
  overflow-y: auto;
}

.purchase-guide-desc {
  margin: 0;
  font-size: 13px;
  color: #475569;
  line-height: 1.6;
}

.purchase-guide-qr-tabs {
  display: flex;
  gap: 6px;
  background: #f1f5f9;
  border-radius: 10px;
  padding: 4px;
}
.purchase-guide-qr-tab {
  flex: 1;
  border: none;
  background: transparent;
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 13px;
  color: #64748b;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.purchase-guide-qr-tab.active {
  background: #fff;
  color: #2563eb;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1);
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
.purchase-guide-url {
  margin: 2px 0 0;
  font-size: 11px;
  color: #94a3b8;
  word-break: break-all;
  text-align: center;
  line-height: 1.5;
}

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

.purchase-guide-fp {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;
  font-size: 12px;
}
.purchase-guide-fp-label { color: #64748b; flex-shrink: 0; }
.purchase-guide-fp-code { flex: 1; min-width: 0; font-family: 'Courier New', monospace; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.purchase-guide-fp-copy { flex-shrink: 0; border: none; background: transparent; color: #3b82f6; cursor: pointer; font-size: 12px; }
.purchase-guide-follow { border: 1px solid #f1f5f9; border-radius: 8px; }
.purchase-guide-follow-head { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border: none; background: transparent; cursor: pointer; font-size: 12px; color: #64748b; }
.purchase-guide-follow-body { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 8px 0 12px; }
.purchase-guide-follow-body img { border-radius: 6px; background: #fff; padding: 4px; }
.purchase-guide-follow-body p { margin: 0; font-size: 11px; color: #94a3b8; text-align: center; }

.purchase-guide-agreement-tip {
  margin: 4px 0 0;
  text-align: center;
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.6;
}
.purchase-guide-agreement-link {
  border: none;
  background: transparent;
  padding: 0;
  font-size: 11px;
  color: #3b82f6;
  cursor: pointer;
}
.purchase-guide-agreement-link:hover { text-decoration: underline; }

.purchase-agreement-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}
.purchase-agreement-modal {
  width: min(460px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.25);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.purchase-agreement-body {
  padding: 16px 18px 20px;
  overflow-y: auto;
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.7;
  color: #334155;
}
</style>
