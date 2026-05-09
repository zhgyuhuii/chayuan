<template>
  <teleport to="body">
    <transition name="kb-fade">
      <div v-if="visible" class="kb-conn-modal-mask" @click.self="onCancel">
        <div class="kb-conn-modal" :class="{ 'is-edit': mode === 'edit' }">
          <header class="kb-modal-head">
            <span class="kb-modal-title">{{ mode === 'edit' ? '编辑连接' : '新增知识库连接' }}</span>
            <button class="kb-modal-close" type="button" title="关闭" @click="onCancel">×</button>
          </header>

          <section class="kb-modal-body">
            <div class="kb-form-grid">
              <label class="kb-form-row span-2">
                <span class="kb-form-label">连接名称<em>*</em></span>
                <input
                  ref="firstFocus"
                  v-model="form.name"
                  class="kb-input"
                  placeholder="如：公司知识中心"
                  maxlength="64"
                />
                <small class="kb-form-tip">在左侧"知识库连接"列表里显示的名字。</small>
              </label>

              <label class="kb-form-row span-2">
                <span class="kb-form-label">服务地址<em>*</em></span>
                <input
                  v-model="form.baseUrl"
                  class="kb-input"
                  placeholder="https://kb.example.com 或 localhost / 127.0.0.1"
                  @blur="onBaseUrlBlur"
                />
                <small class="kb-form-tip">chayuan-server 的根地址(不含具体路径)。未填写协议时默认 http;本地地址未填写端口时默认 62581。</small>
              </label>

              <label class="kb-form-row span-2">
                <span class="kb-form-label">鉴权方式</span>
                <select v-model="form.authMode" class="kb-input" @change="onAuthModeChange">
                  <option value="jwt">账号密码（JWT）— 个人账号</option>
                  <option value="hmac">应用接入（APPID + AppKey）— 部门/服务级</option>
                </select>
              </label>

              <template v-if="form.authMode === 'jwt'">
                <label class="kb-form-row">
                  <span class="kb-form-label">用户名<em>*</em></span>
                  <input v-model="form.jwt.username" class="kb-input" autocomplete="off" />
                </label>
                <label class="kb-form-row">
                  <span class="kb-form-label">密码<em v-if="mode !== 'edit'">*</em></span>
                  <input
                    v-model="passwordInput"
                    type="password"
                    class="kb-input"
                    autocomplete="new-password"
                    :placeholder="mode === 'edit' ? '保留空白则使用上次保存的值' : '账号密码'"
                  />
                </label>
              </template>

              <template v-else>
                <label class="kb-form-row">
                  <span class="kb-form-label">APPID<em>*</em></span>
                  <input v-model="form.hmac.appId" class="kb-input" autocomplete="off" placeholder="32 位 hex 应用 ID" />
                </label>
                <label class="kb-form-row">
                  <span class="kb-form-label">AppKey / AppSecret<em v-if="mode !== 'edit'">*</em></span>
                  <input
                    v-model="appSecretInput"
                    type="password"
                    class="kb-input"
                    autocomplete="new-password"
                    :placeholder="mode === 'edit' ? '保留空白则使用上次保存的值' : '应用密钥'"
                  />
                </label>
              </template>
            </div>

            <!-- 表单内"先测一下"区域:可选,但能让用户在保存前确认凭据正确 -->
            <div class="kb-modal-test">
              <button type="button" class="btn-secondary" :disabled="testing" @click="onTest">
                {{ testing ? '测试中…' : '测试连通' }}
              </button>
              <span class="kb-modal-test-tip">保存前可先测试,失败也可以保存(便于离线配置)</span>
            </div>

            <div v-if="testResult" class="kb-test-result" :class="{ ok: testResult.ok, fail: !testResult.ok }">
              <ol class="kb-test-steps">
                <li v-for="s in testResult.steps" :key="s.name" :class="{ ok: s.ok, fail: !s.ok }">
                  <span class="kb-step-icon">{{ s.ok ? '✓' : '✗' }}</span>
                  <span class="kb-step-label">{{ s.label }}</span>
                  <span v-if="s.latencyMs" class="kb-step-latency">{{ s.latencyMs }}ms</span>
                  <span v-if="s.error" class="kb-step-error">{{ s.error }}</span>
                  <span v-else-if="s.name === 'kb' && s.kbCount !== undefined" class="kb-step-extra">
                    已授权 {{ s.kbCount }} 个知识库
                  </span>
                </li>
              </ol>
              <div v-if="!testResult.ok && testResult.hint" class="kb-test-hint">{{ testResult.hint }}</div>
            </div>
          </section>

          <footer class="kb-modal-foot">
            <button type="button" class="btn-secondary" @click="onCancel">取消</button>
            <button type="button" class="btn-primary" :disabled="saving || !canSave" @click="onSave">
              {{ saving ? '保存中…' : (mode === 'edit' ? '保存修改' : '创建连接') }}
            </button>
          </footer>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script>
import services from '../services/index.js'
const { connectionStore, connectionCipher, healthProbe } = services.kb

const DEFAULT_LOCAL_PORT = '62581'

// 把用户输入的服务地址规范化:
//   1. 缺协议 → 补 http://
//   2. host 是 localhost / IPv4 / IPv6 且没填端口 → 补默认端口 62581
//      (chayuan-server 默认端口;域名场景保持原样,走 80/443)
function normalizeBaseUrl(input) {
  let s = String(input || '').trim()
  if (!s) return s
  if (!/^https?:\/\//i.test(s)) {
    s = 'http://' + s
  }
  let u
  try { u = new URL(s) } catch (e) { return s.replace(/\/+$/, '') }
  if (!u.port) {
    // 浏览器实现的 hostname 对 IPv6 不带方括号,但 Node 的 WHATWG URL 会保留,这里两种都处理
    const host = u.hostname.replace(/^\[|\]$/g, '')
    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1'
    const isIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
    const isIPv6 = host.includes(':') && /^[0-9a-fA-F:]+$/.test(host)
    if (isLocalhost || isIPv4 || isIPv6) {
      u.port = DEFAULT_LOCAL_PORT
    }
  }
  const path = u.pathname.replace(/\/+$/, '')
  return path && path !== '/' ? `${u.origin}${path}` : u.origin
}

function blank() {
  return {
    id: '',
    name: '',
    baseUrl: '',
    authMode: 'jwt',
    jwt: { username: '', ciphertext_password: '' },
    hmac: { appId: '', ciphertext_appSecret: '' },
  }
}

export default {
  name: 'KbConnectionFormDialog',
  props: {
    visible: { type: Boolean, default: false },
    // 传入 null/undefined → 新增;传入对象 → 编辑
    connection: { type: Object, default: null },
  },
  emits: ['close', 'saved'],
  data() {
    return {
      form: blank(),
      passwordInput: '',
      appSecretInput: '',
      testing: false,
      testResult: null,
      saving: false,
    }
  },
  computed: {
    mode() { return this.connection?.id ? 'edit' : 'create' },
    canSave() {
      if (!this.form.name?.trim() || !this.form.baseUrl?.trim()) return false
      if (this.form.authMode === 'jwt') {
        if (!this.form.jwt.username?.trim()) return false
        // 新建时必须填密码;编辑时可以保留空白
        if (this.mode === 'create' && !this.passwordInput) return false
      } else {
        if (!this.form.hmac.appId?.trim()) return false
        if (this.mode === 'create' && !this.appSecretInput) return false
      }
      return true
    },
  },
  watch: {
    visible(v) {
      if (v) {
        this._resetFromProps()
        this.$nextTick(() => {
          try { this.$refs.firstFocus?.focus() } catch (e) { /* noop */ }
        })
      }
    },
    connection() { if (this.visible) this._resetFromProps() },
  },
  mounted() { if (this.visible) this._resetFromProps() },
  methods: {
    _resetFromProps() {
      if (this.connection) {
        this.form = JSON.parse(JSON.stringify(this.connection))
        if (!this.form.jwt) this.form.jwt = { username: '', ciphertext_password: '' }
        if (!this.form.hmac) this.form.hmac = { appId: '', ciphertext_appSecret: '' }
      } else {
        this.form = blank()
        this.form.id = `kb-conn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      }
      this.passwordInput = ''
      this.appSecretInput = ''
      this.testResult = null
    },
    onAuthModeChange() {
      this.testResult = null
      // 切换鉴权方式时清掉对面字段密文,防止误用
      if (this.form.authMode === 'jwt') {
        this.form.hmac = { appId: '', ciphertext_appSecret: '' }
        this.appSecretInput = ''
      } else {
        this.form.jwt = { username: '', ciphertext_password: '' }
        this.passwordInput = ''
      }
    },
    onCancel() { this.$emit('close') },
    onBaseUrlBlur() {
      const next = normalizeBaseUrl(this.form.baseUrl)
      if (next !== this.form.baseUrl) this.form.baseUrl = next
    },
    async onTest() {
      if (!this.form.baseUrl) return
      this.form.baseUrl = normalizeBaseUrl(this.form.baseUrl)
      this.testing = true
      this.testResult = null
      try {
        const probe = JSON.parse(JSON.stringify(this.form))
        if (this.form.authMode === 'jwt' && this.passwordInput) {
          probe.jwt.ciphertext_password = await connectionCipher.encrypt(this.passwordInput)
        }
        if (this.form.authMode === 'hmac' && this.appSecretInput) {
          probe.hmac.ciphertext_appSecret = await connectionCipher.encrypt(this.appSecretInput)
        }
        this.testResult = await healthProbe.run(probe)
      } catch (e) {
        this.testResult = { ok: false, steps: [], hint: e.message || String(e) }
      } finally {
        this.testing = false
      }
    },
    async onSave() {
      if (!this.canSave) return
      this.form.baseUrl = normalizeBaseUrl(this.form.baseUrl)
      this.saving = true
      try {
        const draft = JSON.parse(JSON.stringify(this.form))
        if (draft.authMode === 'jwt' && this.passwordInput) {
          draft.jwt.ciphertext_password = await connectionCipher.encrypt(this.passwordInput)
        }
        if (draft.authMode === 'hmac' && this.appSecretInput) {
          draft.hmac.ciphertext_appSecret = await connectionCipher.encrypt(this.appSecretInput)
        }
        await connectionStore.upsertConnection(draft)
        this.$emit('saved', { id: draft.id, mode: this.mode })
      } catch (e) {
        // 保存失败不关闭弹窗,把错误显示在测试区域
        this.testResult = { ok: false, steps: [], hint: `保存失败：${e.message || e}` }
      } finally {
        this.saving = false
      }
    },
  },
}
</script>

<style scoped>
.kb-conn-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}
.kb-conn-modal {
  width: min(620px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 13px;
  color: #2a2a2a;
}
.kb-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #e6e8ec;
  font-weight: 600;
  font-size: 14px;
}
.kb-modal-close {
  background: transparent;
  border: none;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  color: #888;
  padding: 0 4px;
}
.kb-modal-close:hover { color: #333; }
.kb-modal-body {
  padding: 16px 18px;
  overflow-y: auto;
}
.kb-modal-foot {
  padding: 12px 18px;
  border-top: 1px solid #e6e8ec;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.kb-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
}
.kb-form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.kb-form-row.span-2 { grid-column: span 2; }
.kb-form-label { font-size: 12px; color: #555; }
.kb-form-label em { color: #d25; font-style: normal; margin-left: 2px; }
.kb-form-tip { color: #999; font-size: 11px; margin-top: 2px; }

.kb-input {
  border: 1px solid #cfd4db;
  border-radius: 4px;
  padding: 7px 10px;
  font-size: 13px;
  outline: none;
  background: #fff;
}
.kb-input:focus { border-color: #2a6ddf; box-shadow: 0 0 0 2px rgba(42,109,223,.12); }

.kb-modal-test {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.kb-modal-test-tip { color: #888; font-size: 11px; }

.kb-test-result {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid #e6e8ec;
  background: #fafbfc;
}
.kb-test-result.ok { border-color: #b6e0c2; background: #f4fbf6; }
.kb-test-result.fail { border-color: #f0c8c4; background: #fcf3f2; }
.kb-test-steps { list-style: none; margin: 0; padding: 0; }
.kb-test-steps li { display: flex; gap: 8px; align-items: center; padding: 3px 0; }
.kb-step-icon { width: 16px; text-align: center; }
.kb-test-steps li.ok .kb-step-icon { color: #2aa353; }
.kb-test-steps li.fail .kb-step-icon { color: #c0392b; }
.kb-step-label { min-width: 70px; font-weight: 500; }
.kb-step-latency { font-size: 11px; color: #888; }
.kb-step-error { color: #c0392b; font-size: 12px; }
.kb-step-extra { color: #2aa353; font-size: 12px; }
.kb-test-hint { margin-top: 6px; font-size: 12px; color: #888; }

.btn-primary, .btn-secondary {
  border-radius: 4px;
  padding: 7px 16px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid transparent;
}
.btn-primary { background: #2a6ddf; color: white; border-color: #2a6ddf; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary { background: white; color: #333; border-color: #cfd4db; }
.btn-secondary:hover:not(:disabled) { background: #f0f4fa; }
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

.kb-fade-enter-active, .kb-fade-leave-active { transition: opacity .18s; }
.kb-fade-enter-from, .kb-fade-leave-to { opacity: 0; }

@media (max-width: 560px) {
  .kb-form-grid { grid-template-columns: 1fr; }
  .kb-form-row.span-2 { grid-column: span 1; }
}
</style>
