<template>
  <div class="kb-settings-panel">
    <!-- 顶部:灰度开关状态提示 -->
    <div v-if="!kbFlagEnabled" class="kb-flag-banner">
      ⚠ 远程知识库集成当前已通过功能开关 <code>kbRemoteIntegration</code> 关闭。
      连接和绑定仍可配置,但发送消息时不会触发知识库检索。
      <button class="btn-link" @click="enableKbFlag">立即启用</button>
    </div>

    <div class="kb-three-cols">
      <!-- ============ 左:连接列表 ============ -->
      <aside class="kb-col-conn-list">
        <div class="kb-col-header">
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
              <span class="kb-conn-host" :title="c.baseUrl">{{ shortHost(c.baseUrl) }}</span>
            </div>
          </li>
          <li v-if="!connections.length" class="kb-conn-empty">
            还没有连接，点击右上角 <b>＋</b> 新增
          </li>
        </ul>
      </aside>

      <!-- ============ 中:详情 + 操作 + 测试结果 ============ -->
      <section class="kb-col-detail" :class="{ empty: !selected }">
        <div v-if="!selected" class="kb-detail-empty-hint">
          请在左侧选择连接，或点击 <b>＋</b> 新增。
        </div>

        <template v-else>
          <header class="kb-detail-head">
            <div class="kb-detail-title-block">
              <h3 class="kb-detail-title" :title="selected.name">
                {{ selected.name || '(未命名连接)' }}
                <span v-if="currentId === selected.id" class="kb-conn-current-badge">当前</span>
              </h3>
              <div class="kb-detail-subtitle" :title="selected.baseUrl">
                <span class="kb-conn-mode">{{ selected.authMode === 'hmac' ? 'APPID' : '账号' }}</span>
                <span class="kb-detail-host">{{ selected.baseUrl }}</span>
              </div>
            </div>
            <div class="kb-actions">
              <button v-if="selected.id !== currentId" class="btn-secondary" @click="setCurrent">设为当前</button>
              <button class="btn-secondary" @click="onTest" :disabled="testing">
                {{ testing ? '测试中…' : '测试连通' }}
              </button>
              <button class="btn-secondary" @click="onEdit">编辑</button>
              <button class="btn-danger" @click="onDelete">删除</button>
            </div>
          </header>

          <!-- 身份/状态摘要 -->
          <div class="kb-detail-summary">
            <span class="kb-summary-item">
              <span class="kb-summary-key">主体</span>
              <span class="kb-summary-val" v-if="selected.authMode === 'jwt'">
                用户 · {{ selected.jwt?.username || '-' }}
              </span>
              <span class="kb-summary-val" v-else>
                APP · {{ shortAppId(selected.hmac?.appId) }}
              </span>
            </span>
            <span v-if="testResult" class="kb-summary-item">
              <span class="kb-summary-key">连通</span>
              <span class="kb-summary-val" :class="testResult.ok ? 'ok' : 'fail'">
                {{ testResult.ok ? '✓ 正常' : '✗ 异常' }}
              </span>
            </span>
            <span v-if="catalog.length" class="kb-summary-item">
              <span class="kb-summary-key">可见 KB</span>
              <span class="kb-summary-val ok">{{ countKbs }} 个</span>
            </span>
          </div>

          <!-- 测试连通详情(三步) -->
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
            <div v-if="testResult.summary?.aclHint" class="kb-acl-hint">
              ⚠ {{ testResult.summary.aclHint }}
              <template v-if="selected.authMode === 'hmac' && selected.hmac?.appId">
                <button class="btn-link" @click="copyGrantsCurl">复制管理员授权命令</button>
              </template>
            </div>
            <div v-if="!testResult.ok && testResult.hint" class="kb-test-hint">{{ testResult.hint }}</div>
          </div>
        </template>
      </section>

      <!-- ============ 右:KB 树 ============ -->
      <aside class="kb-col-tree">
        <div class="kb-col-header">
          <span>可访问的知识库</span>
          <button v-if="selected" class="btn-link" @click="loadCatalog(true)" :disabled="loadingCatalog">
            {{ loadingCatalog ? '加载中…' : '刷新' }}
          </button>
        </div>
        <div v-if="!selected" class="kb-tree-empty">请先在左侧选择连接</div>
        <div v-else-if="catalogError" class="kb-tree-error">{{ catalogError }}</div>
        <div v-else-if="loadingCatalog && !catalog.length" class="kb-tree-empty">加载中…</div>
        <ul v-else-if="catalog.length" class="kb-tree">
          <li v-for="group in catalog" :key="group.id" class="kb-tree-group">
            <div class="kb-tree-group-name" :class="{ collapsible: true, collapsed: collapsedGroups[group.id] }"
                 @click="toggleGroup(group.id)">
              <span class="kb-tree-caret">{{ collapsedGroups[group.id] ? '▶' : '▼' }}</span>
              <span class="kb-tree-group-text">{{ group.name }}</span>
              <span class="kb-tree-group-count">{{ group.children?.length || 0 }}</span>
            </div>
            <ul v-show="!collapsedGroups[group.id]">
              <li v-for="kb in group.children" :key="kb.id" class="kb-tree-item" :title="kb.name">
                <span class="kb-tree-icon">📚</span>
                <span class="kb-tree-name">{{ kb.name }}</span>
                <span v-if="kb.role" class="kb-role-badge" :data-role="kb.role" :title="roleFullLabel(kb.role)">
                  {{ roleLabel(kb.role) }}
                </span>
                <span v-if="kb.kb?.visibility === 'public'" class="kb-vis-badge" title="公开知识库">公</span>
              </li>
              <li v-if="!group.children?.length" class="kb-tree-empty-row">该分组暂无可见知识库</li>
            </ul>
          </li>
        </ul>
        <div v-else-if="!loadingCatalog" class="kb-tree-empty">
          <div>暂无可见的知识库</div>
          <div class="kb-tree-empty-sub">先点中栏的"测试连通"或"刷新",或联系管理员授权。</div>
        </div>
      </aside>
    </div>

    <!-- 新增/编辑弹窗 -->
    <KbConnectionFormDialog
      :visible="formDialog.visible"
      :connection="formDialog.connection"
      @close="formDialog.visible = false"
      @saved="onDialogSaved"
    />

    <transition name="fade">
      <div v-if="toast" class="kb-toast" :class="toast.kind">{{ toast.msg }}</div>
    </transition>
  </div>
</template>

<script>
import services from '../services/index.js'
import { isEnabled as isFlagEnabled, setFlag as setFeatureFlag, subscribe as subscribeFlag } from '../utils/featureFlags.js'
import KbConnectionFormDialog from './KbConnectionFormDialog.vue'

const { connectionStore, healthProbe, kbCatalog, kbCatalogCache } = services.kb

export default {
  name: 'KbSettingsPanel',
  components: { KbConnectionFormDialog },
  data() {
    return {
      connections: [],
      currentId: '',
      selectedId: '',
      selected: null,        // 当前选中连接的完整对象(只读快照)
      testing: false,
      testResult: null,
      catalog: [],
      catalogError: '',
      loadingCatalog: false,
      collapsedGroups: {},
      toast: null,
      toastTimer: 0,
      unsubStore: null,
      unsubFlag: null,
      kbFlagEnabled: true,
      formDialog: { visible: false, connection: null },
    }
  },
  computed: {
    countKbs() {
      return this.catalog.reduce((acc, g) => acc + (g.children?.length || 0), 0)
    },
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
    if (this.toastTimer) clearTimeout(this.toastTimer)
  },
  methods: {
    async refreshConnections() {
      try {
        this.connections = await connectionStore.listConnections()
        this.currentId = (await connectionStore.getCurrentConnection())?.id || ''
        if (!this.selectedId && this.connections.length) {
          await this.selectConnection(this.currentId || this.connections[0].id)
        } else if (this.selectedId) {
          // 当前选中可能被外部 store 改了 → 同步刷新 selected
          await this.selectConnection(this.selectedId, true)
        }
      } catch (e) {
        this.showToast('error', `加载连接失败：${e.message || e}`)
      }
    },

    async selectConnection(id, silent = false) {
      this.selectedId = id
      const c = await connectionStore.getConnection(id)
      this.selected = c ? JSON.parse(JSON.stringify(c)) : null
      this.testResult = null
      this.catalog = []
      this.catalogError = ''
      // 切换连接时尝试预拉一次目录(走缓存,失败不打扰)
      if (!silent && this.selected) {
        this.loadCatalog(false).catch(() => {})
      }
    },

    onCreate() {
      this.formDialog.connection = null
      this.formDialog.visible = true
    },

    onEdit() {
      if (!this.selected) return
      this.formDialog.connection = JSON.parse(JSON.stringify(this.selected))
      this.formDialog.visible = true
    },

    async onDialogSaved({ id, mode }) {
      this.formDialog.visible = false
      this.formDialog.connection = null
      kbCatalogCache.invalidate(`list:${id}`)
      kbCatalogCache.invalidate(`tree:${id}`)
      this.selectedId = id
      await this.refreshConnections()
      this.showToast('success', mode === 'edit' ? '已保存修改' : '已创建连接')
      // 新建后自动尝试拉一次 catalog 让用户立刻看到右栏树
      this.loadCatalog(true).catch(() => {})
    },

    async setCurrent() {
      if (!this.selected?.id) return
      try {
        await connectionStore.setCurrentConnection(this.selected.id)
        await this.refreshConnections()
        this.showToast('success', '已设为当前连接')
      } catch (e) {
        this.showToast('error', `设置失败：${e.message || e}`)
      }
    },

    async onDelete() {
      if (!this.selected?.id) return
      const name = this.selected.name || this.selected.id
      if (!confirm(`确认删除连接「${name}」？此操作不可恢复。`)) return
      try {
        await connectionStore.removeConnection(this.selected.id)
        kbCatalogCache.invalidate(`list:${this.selected.id}`)
        kbCatalogCache.invalidate(`tree:${this.selected.id}`)
        this.selected = null
        this.selectedId = ''
        this.testResult = null
        this.catalog = []
        await this.refreshConnections()
        this.showToast('success', '已删除')
      } catch (e) {
        this.showToast('error', `删除失败：${e.message || e}`)
      }
    },

    async onTest() {
      if (!this.selected?.baseUrl) {
        this.showToast('error', '该连接缺少服务地址')
        return
      }
      this.testing = true
      this.testResult = null
      try {
        this.testResult = await healthProbe.run(this.selected)
        if (this.testResult.ok) {
          this.loadCatalog(true).catch((e) => {
            this.catalogError = `加载列表失败：${e.message || e}`
          })
        }
      } catch (e) {
        this.testResult = { ok: false, steps: [], hint: e.message || String(e) }
      } finally {
        this.testing = false
      }
    },

    async loadCatalog(force = false) {
      if (!this.selected?.id || !this.selected?.baseUrl) return
      this.loadingCatalog = true
      this.catalogError = ''
      try {
        this.catalog = await kbCatalog.fetchTree(this.selected, { force })
      } catch (e) {
        this.catalog = []
        this.catalogError = `加载列表失败：${e.message || e}`
      } finally {
        this.loadingCatalog = false
      }
    },

    toggleGroup(gid) {
      this.collapsedGroups = { ...this.collapsedGroups, [gid]: !this.collapsedGroups[gid] }
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
    roleFullLabel(role) {
      switch (role) {
        case 'owner':  return '所有者(Owner)'
        case 'editor': return '可编辑(Editor)'
        case 'reader': return '只读(Reader)'
        case 'admin':  return '管理员(Admin)'
        default:       return role || '未知'
      }
    },

    shortHost(url) {
      try { return new URL(url).host } catch (e) { return url || '' }
    },
    shortAppId(id) {
      const s = String(id || '')
      if (s.length <= 12) return s
      return `${s.slice(0, 6)}…${s.slice(-4)}`
    },

    async copyGrantsCurl() {
      const appId = this.selected?.hmac?.appId
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
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  font-size: 13px;
  color: #2a2a2a;
}

.kb-three-cols {
  flex: 1;
  display: grid;
  grid-template-columns: 200px minmax(360px, 1fr) minmax(260px, 360px);
  min-height: 0;
}

/* 容器较窄时(< 880px),把"中"和"右"叠起来,中→上,右→下 */
@media (max-width: 880px) {
  .kb-three-cols {
    grid-template-columns: 200px 1fr;
    grid-template-rows: 1fr 1fr;
  }
  .kb-col-conn-list { grid-row: span 2; }
  .kb-col-detail { grid-column: 2; grid-row: 1; }
  .kb-col-tree { grid-column: 2; grid-row: 2; border-top: 1px solid #e6e8ec; }
}

/* ---- 通用 column header ---- */
.kb-col-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  font-weight: 600;
  border-bottom: 1px solid #e6e8ec;
  flex-shrink: 0;
  background: #f7f8fa;
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

/* ---- 左:连接列表 ---- */
.kb-col-conn-list {
  border-right: 1px solid #e6e8ec;
  display: flex;
  flex-direction: column;
  background: #fafbfc;
  min-width: 0;
}
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
  word-break: break-all;
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
  align-items: center;
}
.kb-conn-mode {
  padding: 1px 6px;
  background: #e3e6eb;
  border-radius: 4px;
}
.kb-conn-host {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 110px;
}
.kb-conn-empty {
  padding: 20px 12px;
  color: #888;
  font-size: 12px;
  text-align: center;
}

/* ---- 中:详情 ---- */
.kb-col-detail {
  padding: 16px 20px;
  overflow-y: auto;
  border-right: 1px solid #e6e8ec;
  min-width: 0;
}
.kb-col-detail.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
}
.kb-detail-empty-hint { color: #888; font-size: 13px; }

.kb-detail-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 14px;
}
.kb-detail-title-block {
  flex: 1;
  min-width: 0;
}
.kb-detail-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-detail-subtitle {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #666;
  align-items: center;
}
.kb-detail-host {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-actions { display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }

.kb-detail-summary {
  display: flex;
  gap: 16px;
  padding: 10px 12px;
  border-radius: 6px;
  background: #f7f8fa;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.kb-summary-item { display: flex; gap: 6px; font-size: 12px; }
.kb-summary-key { color: #888; }
.kb-summary-val { font-weight: 500; }
.kb-summary-val.ok { color: #2aa353; }
.kb-summary-val.fail { color: #c0392b; }

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
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
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
  margin-bottom: 14px;
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
.kb-acl-hint {
  margin-top: 6px;
  padding: 6px 10px;
  background: #fff7e6;
  border-left: 3px solid #f0b842;
  font-size: 12px;
  border-radius: 3px;
}
.kb-test-hint { margin-top: 6px; font-size: 12px; color: #888; }

/* ---- 右:KB 树 ---- */
.kb-col-tree {
  display: flex;
  flex-direction: column;
  background: #fff;
  min-width: 0;
  overflow: hidden;
}
.kb-tree {
  list-style: none;
  margin: 0;
  padding: 8px 12px;
  overflow-y: auto;
  flex: 1;
}
.kb-tree-group { margin-bottom: 8px; }
.kb-tree-group-name {
  font-size: 12px;
  color: #555;
  margin-bottom: 4px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}
.kb-tree-group-name:hover { color: #2a6ddf; }
.kb-tree-caret { font-size: 9px; color: #999; width: 10px; }
.kb-tree-group-text { flex: 1; }
.kb-tree-group-count {
  font-size: 10px;
  background: #eef0f3;
  color: #666;
  padding: 1px 6px;
  border-radius: 8px;
}
.kb-tree-group ul { list-style: none; margin: 0; padding: 0 0 0 18px; }
.kb-tree-item {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 4px 6px;
  border-radius: 3px;
  cursor: default;
}
.kb-tree-item:hover { background: #f0f4fa; }
.kb-tree-icon { font-size: 13px; }
.kb-tree-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-tree-empty-row { padding: 4px 6px; color: #aaa; font-size: 11px; }
.kb-role-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 8px;
  background: #e3e6eb;
  color: #555;
  flex-shrink: 0;
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
  flex-shrink: 0;
}
.kb-tree-empty {
  padding: 16px 12px;
  color: #999;
  font-size: 12px;
  text-align: center;
}
.kb-tree-empty-sub { color: #aaa; font-size: 11px; margin-top: 4px; }
.kb-tree-error {
  padding: 12px;
  color: #c0392b;
  font-size: 12px;
  background: #fcf3f2;
  margin: 10px;
  border-radius: 4px;
}

/* ---- toast / banner ---- */
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
  background: #fff7e6;
  border-bottom: 1px solid #f0b842;
  color: #8a5a00;
  padding: 8px 14px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
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
</style>
