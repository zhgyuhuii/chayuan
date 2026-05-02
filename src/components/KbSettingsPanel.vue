<template>
  <div class="kb-settings-panel">
    <!-- 顶部:灰度开关状态提示 -->
    <div v-if="!kbFlagEnabled" class="kb-flag-banner">
      ⚠ 远程知识库集成当前已通过功能开关 <code>kbRemoteIntegration</code> 关闭。
      连接和绑定仍可配置,但发送消息时不会触发知识库检索。
      <button class="btn-link" @click="enableKbFlag">立即启用</button>
    </div>
    <!-- 左侧:连接列表 + 新增按钮 -->
    <aside class="kb-conn-list">
      <div class="kb-conn-list-header">
        <span>知识库连接</span>
        <button class="btn-icon" title="新增连接" @click="onCreate">＋</button>
      </div>
      <ul class="kb-conn-items">
        <li
          v-for="c in connections"
          :key="c.id"
          :class="{ active: selectedId === c.id, 'is-current': currentId === c.id }"
          @click="selectConnection(c.id)"
        >
          <div class="kb-conn-name">
            {{ c.name || '(未命名连接)' }}
            <span v-if="currentId === c.id" class="kb-conn-current-badge">当前</span>
          </div>
          <div class="kb-conn-meta">
            <span class="kb-conn-mode">{{ c.authMode === 'hmac' ? 'APPID' : '账号' }}</span>
            <span class="kb-conn-host">{{ shortHost(c.baseUrl) }}</span>
          </div>
        </li>
        <li v-if="!connections.length" class="kb-conn-empty">
          还没有连接，点击右上角 <b>＋</b> 新增
        </li>
      </ul>
    </aside>

    <!-- 右侧:表单 + 树形清单 -->
    <section v-if="form" class="kb-conn-detail">
      <header class="kb-detail-head">
        <input
          v-model="form.name"
          class="kb-input"
          placeholder="连接名称（如：公司知识中心）"
          maxlength="64"
          @input="markDirty"
        />
        <div class="kb-actions">
          <button v-if="form.id !== currentId" class="btn-secondary" @click="setCurrent">设为当前</button>
          <button class="btn-secondary" @click="onTest" :disabled="testing">
            {{ testing ? '测试中…' : '测试连通' }}
          </button>
          <button class="btn-primary" @click="onSave" :disabled="!dirty || saving">
            {{ saving ? '保存中…' : '保存' }}
          </button>
          <button v-if="form.id" class="btn-danger" @click="onDelete">删除</button>
        </div>
      </header>

      <div class="kb-form-grid">
        <label>
          <span>服务地址</span>
          <input v-model="form.baseUrl" class="kb-input" placeholder="https://kb.example.com" @input="markDirty" />
        </label>
        <label>
          <span>鉴权方式</span>
          <select v-model="form.authMode" class="kb-input" @change="onAuthModeChange">
            <option value="jwt">账号密码（JWT）</option>
            <option value="hmac">应用接入（APPID + AppKey）</option>
          </select>
        </label>

        <template v-if="form.authMode === 'jwt'">
          <label>
            <span>用户名</span>
            <input v-model="form.jwt.username" class="kb-input" autocomplete="off" @input="markDirty" />
          </label>
          <label>
            <span>密码</span>
            <input v-model="passwordInput" type="password" class="kb-input" autocomplete="new-password" placeholder="保留空白则使用上次保存的值" @input="markDirty" />
          </label>
        </template>

        <template v-else>
          <label>
            <span>APPID</span>
            <input v-model="form.hmac.appId" class="kb-input" autocomplete="off" placeholder="32 位 hex 应用 ID" @input="markDirty" />
          </label>
          <label>
            <span>AppKey / AppSecret</span>
            <input v-model="appSecretInput" type="password" class="kb-input" autocomplete="new-password" placeholder="保留空白则使用上次保存的值" @input="markDirty" />
          </label>
        </template>
      </div>

      <!-- 测试连通结果 -->
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
        <div v-if="testResult.summary" class="kb-test-summary">
          <span v-if="testResult.summary.subjectKind === 'app'">
            主体类型：APP
            <template v-if="testResult.summary.identity?.name"> · {{ testResult.summary.identity.name }}</template>
            <template v-if="testResult.summary.identity?.allowPublicKbs"> · 已开启公开 KB 访问</template>
            <template v-else> · 未开启公开 KB 访问</template>
          </span>
          <span v-else>主体类型：用户 ({{ testResult.summary.identity?.username || '-' }})</span>
        </div>
        <div v-if="testResult.summary?.aclHint" class="kb-acl-hint">
          ⚠ {{ testResult.summary.aclHint }}
          <template v-if="form.authMode === 'hmac' && form.hmac?.appId">
            <button class="btn-link" @click="copyGrantsCurl">复制管理员授权命令</button>
          </template>
        </div>
        <div v-if="!testResult.ok && testResult.hint" class="kb-test-hint">{{ testResult.hint }}</div>
      </div>

      <!-- 知识库清单(树形) -->
      <div class="kb-tree-section">
        <div class="kb-tree-header">
          <span>可访问的知识库</span>
          <button class="btn-link" @click="loadCatalog(true)" :disabled="loadingCatalog">
            {{ loadingCatalog ? '加载中…' : '刷新' }}
          </button>
        </div>
        <div v-if="catalogError" class="kb-tree-error">{{ catalogError }}</div>
        <ul v-else-if="catalog.length" class="kb-tree">
          <li v-for="group in catalog" :key="group.id" class="kb-tree-group">
            <div class="kb-tree-group-name">{{ group.name }}</div>
            <ul>
              <li v-for="kb in group.children" :key="kb.id" class="kb-tree-item">
                <span class="kb-tree-icon">📚</span>
                <span class="kb-tree-name">{{ kb.name }}</span>
                <span v-if="kb.role" class="kb-role-badge" :data-role="kb.role">
                  {{ roleLabel(kb.role) }}
                </span>
                <span v-if="kb.kb?.visibility === 'public'" class="kb-vis-badge">公开</span>
              </li>
              <li v-if="!group.children.length" class="kb-tree-empty">该分组暂无可见知识库</li>
            </ul>
          </li>
        </ul>
        <div v-else-if="!loadingCatalog && testResult?.ok" class="kb-tree-empty">
          暂无可见的知识库；请联系管理员授权。
        </div>
      </div>
    </section>

    <section v-else class="kb-conn-detail kb-conn-detail-empty">
      请在左侧选择连接，或点击 <b>＋</b> 新增。
    </section>

    <transition name="fade">
      <div v-if="toast" class="kb-toast" :class="toast.kind">{{ toast.msg }}</div>
    </transition>
  </div>
</template>

<script>
import services from '../services/index.js'
import { isEnabled as isFlagEnabled, setFlag as setFeatureFlag, subscribe as subscribeFlag } from '../utils/featureFlags.js'

const { connectionStore, connectionCipher, healthProbe, kbCatalog, kbCatalogCache } = services.kb

function blankConnection() {
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
  name: 'KbSettingsPanel',
  data() {
    return {
      connections: [],
      currentId: '',
      selectedId: '',
      form: null,
      passwordInput: '',
      appSecretInput: '',
      dirty: false,
      saving: false,
      testing: false,
      testResult: null,
      catalog: [],
      catalogError: '',
      loadingCatalog: false,
      toast: null,
      toastTimer: 0,
      unsubStore: null,
      unsubFlag: null,
      kbFlagEnabled: true,
    }
  },
  async mounted() {
    this.kbFlagEnabled = isFlagEnabled('kbRemoteIntegration')
    this.unsubFlag = subscribeFlag(({ flag, value }) => {
      if (flag === 'kbRemoteIntegration') this.kbFlagEnabled = !!value
    })
    await this.refreshConnections()
    this.unsubStore = connectionStore.subscribe(() => { this.refreshConnections() })
  },
  beforeUnmount() {
    if (this.unsubStore) try { this.unsubStore() } catch (e) { /* noop */ }
    if (this.unsubFlag) try { this.unsubFlag() } catch (e) { /* noop */ }
  },
  methods: {
    async refreshConnections() {
      try {
        this.connections = await connectionStore.listConnections()
        this.currentId = (await connectionStore.getCurrentConnection())?.id || ''
        if (!this.selectedId && this.connections.length) {
          this.selectedId = this.currentId || this.connections[0].id
        }
        if (this.selectedId) {
          await this.selectConnection(this.selectedId, true)
        }
      } catch (e) {
        this.showToast('error', `加载连接失败：${e.message || e}`)
      }
    },

    async selectConnection(id, silent = false) {
      this.selectedId = id
      const c = await connectionStore.getConnection(id)
      if (!c) {
        this.form = null
        return
      }
      this.form = JSON.parse(JSON.stringify(c))
      // 不要把密文 echo 到输入框,只在用户输入新值时再写
      this.passwordInput = ''
      this.appSecretInput = ''
      this.dirty = false
      this.testResult = null
      this.catalog = []
      this.catalogError = ''
      // 初次进入时如果上次保存过 ok,直接预拉一次清单(不阻塞 UI)
      if (!silent) {
        this.loadCatalog(false).catch(() => {})
      }
    },

    onCreate() {
      this.form = blankConnection()
      this.form.id = `kb-conn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      this.passwordInput = ''
      this.appSecretInput = ''
      this.selectedId = ''
      this.dirty = true
      this.testResult = null
      this.catalog = []
    },

    async onAuthModeChange() {
      this.markDirty()
      this.testResult = null
      this.catalog = []
      // 切换鉴权方式后清掉对面字段的密文,防止误用
      if (this.form.authMode === 'jwt') {
        this.form.hmac = { appId: '', ciphertext_appSecret: '' }
      } else {
        this.form.jwt = { username: '', ciphertext_password: '' }
      }
    },

    markDirty() { this.dirty = true },

    async onSave() {
      if (!this.form?.baseUrl) {
        this.showToast('error', '请填写服务地址')
        return
      }
      this.saving = true
      try {
        const draft = JSON.parse(JSON.stringify(this.form))
        // 即时加密用户输入的明文凭据;空白 = 沿用旧密文
        if (draft.authMode === 'jwt' && this.passwordInput) {
          draft.jwt.ciphertext_password = await connectionCipher.encrypt(this.passwordInput)
        }
        if (draft.authMode === 'hmac' && this.appSecretInput) {
          draft.hmac.ciphertext_appSecret = await connectionCipher.encrypt(this.appSecretInput)
        }
        await connectionStore.upsertConnection(draft)
        this.passwordInput = ''
        this.appSecretInput = ''
        this.dirty = false
        this.showToast('success', '已保存')
        await this.refreshConnections()
        this.selectedId = draft.id
        kbCatalogCache.invalidate(`list:${draft.id}`)
        kbCatalogCache.invalidate(`tree:${draft.id}`)
      } catch (e) {
        this.showToast('error', `保存失败：${e.message || e}`)
      } finally {
        this.saving = false
      }
    },

    async setCurrent() {
      if (!this.form?.id) return
      try {
        await connectionStore.setCurrentConnection(this.form.id)
        await this.refreshConnections()
        this.showToast('success', '已设为当前连接')
      } catch (e) {
        this.showToast('error', `设置失败：${e.message || e}`)
      }
    },

    async onDelete() {
      if (!this.form?.id) return
      if (!confirm(`确认删除连接「${this.form.name || this.form.id}」？此操作不可恢复。`)) return
      try {
        await connectionStore.removeConnection(this.form.id)
        kbCatalogCache.invalidate(`list:${this.form.id}`)
        kbCatalogCache.invalidate(`tree:${this.form.id}`)
        this.form = null
        this.selectedId = ''
        await this.refreshConnections()
        this.showToast('success', '已删除')
      } catch (e) {
        this.showToast('error', `删除失败：${e.message || e}`)
      }
    },

    async onTest() {
      if (!this.form?.baseUrl) {
        this.showToast('error', '请先填写服务地址')
        return
      }
      this.testing = true
      this.testResult = null
      try {
        // 临时合成一个连接用于测试（不写盘）
        const probeConn = JSON.parse(JSON.stringify(this.form))
        if (this.form.authMode === 'jwt' && this.passwordInput) {
          probeConn.jwt.ciphertext_password = await connectionCipher.encrypt(this.passwordInput)
        }
        if (this.form.authMode === 'hmac' && this.appSecretInput) {
          probeConn.hmac.ciphertext_appSecret = await connectionCipher.encrypt(this.appSecretInput)
        }
        this.testResult = await healthProbe.run(probeConn)
        if (this.testResult.ok) {
          // 用同一个 probeConn 拉一次目录,展示
          this.loadCatalog(true, probeConn).catch((e) => {
            this.catalogError = `加载列表失败：${e.message || e}`
          })
        }
      } catch (e) {
        this.testResult = { ok: false, steps: [], hint: e.message || String(e) }
      } finally {
        this.testing = false
      }
    },

    async loadCatalog(force = false, probeConn = null) {
      const conn = probeConn || this.form
      if (!conn?.id || !conn?.baseUrl) return
      this.loadingCatalog = true
      this.catalogError = ''
      try {
        this.catalog = await kbCatalog.fetchTree(conn, { force })
      } catch (e) {
        this.catalogError = `加载列表失败：${e.message || e}`
      } finally {
        this.loadingCatalog = false
      }
    },

    roleLabel(role) {
      switch (role) {
        case 'owner':  return 'O'
        case 'editor': return 'E'
        case 'reader': return 'R'
        case 'admin':  return 'A'
        default:       return '?'
      }
    },

    shortHost(url) {
      try {
        const u = new URL(url)
        return u.host
      } catch (e) { return url || '' }
    },

    async copyGrantsCurl() {
      const appId = this.form?.hmac?.appId
      if (!appId) return
      const cmd = [
        `# 用 admin 身份(JWT)调以下接口给 APP ${appId} 授权一个知识库`,
        `curl -X POST '<KB_BASE>/openapi/v1/admin/apps/${appId}/kb_grants' \\`,
        `  -H 'Authorization: Bearer <ADMIN_JWT>' \\`,
        `  -H 'Content-Type: application/json' \\`,
        `  -d '[{"kb_name":"<KB_NAME>","role":"reader"}]'`,
      ].join('\n')
      try {
        await navigator.clipboard.writeText(cmd)
        this.showToast('success', '管理员授权命令已复制')
      } catch (e) {
        this.showToast('error', '复制失败，请手动复制下方命令')
      }
    },

    showToast(kind, msg) {
      this.toast = { kind, msg }
      if (this.toastTimer) clearTimeout(this.toastTimer)
      this.toastTimer = setTimeout(() => { this.toast = null }, 3500)
    },
    enableKbFlag() {
      setFeatureFlag('kbRemoteIntegration', true)
      this.kbFlagEnabled = true
      this.showToast('success', '已启用远程知识库集成')
    },
  },
}
</script>

<style scoped>
.kb-settings-panel {
  display: flex;
  height: 100%;
  font-size: 13px;
  color: #2a2a2a;
}

.kb-conn-list {
  width: 220px;
  border-right: 1px solid #e6e8ec;
  display: flex;
  flex-direction: column;
  background: #f7f8fa;
}
.kb-conn-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  font-weight: 600;
  border-bottom: 1px solid #e6e8ec;
}
.btn-icon {
  border: none;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  padding: 0 6px;
  color: #2a6ddf;
}
.btn-icon:hover { color: #1452c4; }

.kb-conn-items {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}
.kb-conn-items li {
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid #eef0f3;
}
.kb-conn-items li:hover { background: #eef4ff; }
.kb-conn-items li.active { background: #e1edff; }
.kb-conn-items li.is-current .kb-conn-name::before {
  content: '●'; color: #2a6ddf; margin-right: 4px;
}
.kb-conn-name {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}
.kb-conn-current-badge {
  font-size: 10px;
  padding: 1px 6px;
  background: #2a6ddf;
  color: white;
  border-radius: 8px;
}
.kb-conn-meta {
  margin-top: 4px;
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #888;
}
.kb-conn-mode {
  padding: 1px 6px;
  background: #e3e6eb;
  border-radius: 4px;
}
.kb-conn-empty {
  padding: 20px 12px;
  color: #888;
  font-size: 12px;
  text-align: center;
}

.kb-conn-detail {
  flex: 1;
  padding: 16px 20px;
  overflow-y: auto;
}
.kb-conn-detail-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
}

.kb-detail-head {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}
.kb-detail-head .kb-input { flex: 1; font-weight: 600; font-size: 14px; }
.kb-actions { display: flex; gap: 8px; }

.kb-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 20px;
  margin-bottom: 16px;
}
.kb-form-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.kb-form-grid label > span {
  font-size: 12px;
  color: #555;
}
.kb-input {
  border: 1px solid #cfd4db;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 13px;
  outline: none;
}
.kb-input:focus { border-color: #2a6ddf; }

.btn-primary, .btn-secondary, .btn-danger, .btn-link {
  border-radius: 4px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid transparent;
}
.btn-primary { background: #2a6ddf; color: white; border-color: #2a6ddf; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary { background: white; color: #333; border-color: #cfd4db; }
.btn-secondary:hover:not(:disabled) { background: #f0f4fa; }
.btn-danger { background: white; color: #c0392b; border-color: #e9b4ad; }
.btn-danger:hover { background: #fbeae8; }
.btn-link {
  background: transparent;
  color: #2a6ddf;
  text-decoration: underline;
  border: none;
  padding: 0;
}

.kb-test-result {
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: 6px;
  border: 1px solid #e6e8ec;
  background: #fafbfc;
}
.kb-test-result.ok { border-color: #b6e0c2; background: #f4fbf6; }
.kb-test-result.fail { border-color: #f0c8c4; background: #fcf3f2; }
.kb-test-steps { list-style: none; margin: 0; padding: 0; }
.kb-test-steps li {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 4px 0;
}
.kb-step-icon { width: 16px; text-align: center; }
.kb-test-steps li.ok .kb-step-icon { color: #2aa353; }
.kb-test-steps li.fail .kb-step-icon { color: #c0392b; }
.kb-step-label { min-width: 80px; font-weight: 500; }
.kb-step-latency { font-size: 11px; color: #888; }
.kb-step-error { color: #c0392b; font-size: 12px; }
.kb-step-extra { color: #2aa353; font-size: 12px; }
.kb-test-summary { margin-top: 6px; font-size: 12px; color: #555; }
.kb-acl-hint {
  margin-top: 6px;
  padding: 6px 10px;
  background: #fff7e6;
  border-left: 3px solid #f0b842;
  font-size: 12px;
  border-radius: 3px;
}
.kb-test-hint { margin-top: 6px; font-size: 12px; color: #888; }

.kb-tree-section {
  border: 1px solid #e6e8ec;
  border-radius: 6px;
  padding: 12px 14px;
  background: #fff;
}
.kb-tree-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-weight: 600;
}
.kb-tree-error {
  color: #c0392b;
  font-size: 12px;
  padding: 8px 0;
}
.kb-tree { list-style: none; margin: 0; padding: 0; }
.kb-tree-group { margin-bottom: 10px; }
.kb-tree-group-name {
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
  font-weight: 500;
}
.kb-tree-group ul { list-style: none; margin: 0; padding: 0 0 0 12px; }
.kb-tree-item {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 4px 0;
}
.kb-tree-icon { font-size: 14px; }
.kb-tree-name { flex: 1; }
.kb-role-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 8px;
  background: #e3e6eb;
  color: #555;
}
.kb-role-badge[data-role='owner'] { background: #ffe9c2; color: #b76e00; }
.kb-role-badge[data-role='editor'] { background: #cfe6ff; color: #1856b2; }
.kb-role-badge[data-role='reader'] { background: #d8f0d8; color: #2aa353; }
.kb-role-badge[data-role='admin'] { background: #f5d6e8; color: #a4337a; }
.kb-vis-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: #f0f4fa;
  color: #555;
}
.kb-tree-empty {
  padding: 12px 0;
  color: #999;
  font-size: 12px;
  text-align: center;
}

.kb-toast {
  position: fixed;
  right: 20px;
  bottom: 20px;
  padding: 10px 16px;
  border-radius: 4px;
  background: #333;
  color: white;
  font-size: 13px;
  z-index: 9999;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
}
.kb-toast.success { background: #2aa353; }
.kb-toast.error { background: #c0392b; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.kb-flag-banner {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  background: #fff7e6;
  border-bottom: 1px solid #f0b842;
  color: #8a5a00;
  padding: 8px 14px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 10;
}
.kb-flag-banner code {
  background: #fff;
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid #f0d6a0;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
  font-size: 11px;
}
.kb-flag-banner .btn-link {
  margin-left: auto;
}
.kb-settings-panel {
  position: relative;
}
</style>
