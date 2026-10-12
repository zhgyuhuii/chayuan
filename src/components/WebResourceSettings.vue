<template>
  <div class="wr-panel">
    <!-- 头部：标题 + 说明 + 全局操作 -->
    <div class="wr-header">
      <div class="wr-header-text">
        <div class="wr-title">
          <span class="wr-title-icon">🌐</span>
          网络资源搜索
        </div>
        <div class="wr-subtitle">
          三级生图的中坚：生图模型不可用时按此清单网络搜图，搜图不通再由大模型绘制 SVG。
          Key 只保存在本机，搜索经本机服务执行。
        </div>
      </div>
      <div class="wr-header-actions">
        <button class="wr-btn wr-btn-ghost" :disabled="testingAll" @click="onTestAll">
          {{ testingAll ? '测活中…' : '⚡ 全部测活' }}
        </button>
        <button class="wr-btn wr-btn-ghost" :disabled="syncing" title="把启用清单同步到本机服务" @click="onSync(true)">
          {{ syncing ? '同步中…' : '⇄ 同步本机服务' }}
        </button>
      </div>
    </div>

    <!-- 状态条 -->
    <div class="wr-status-strip">
      <span class="wr-chip wr-chip-on">已启用 {{ enabledCount }}</span>
      <span class="wr-chip">已配 Key {{ keyedCount }}</span>
      <span class="wr-chip">免 Key 恒可用 {{ freeCount }}</span>
      <span class="wr-chip wr-chip-sync" :class="syncState.ok === false ? 'is-err' : ''" :title="syncState.detail">
        {{ syncLabel }}
      </span>
      <span v-if="lastTestedAt" class="wr-chip wr-chip-time">上次测活 {{ shortTime(lastTestedAt) }}</span>
    </div>

    <!-- 分组卡片 -->
    <div class="wr-groups">
      <section v-for="group in groups" :key="group.kind" class="wr-group">
        <div class="wr-group-head">
          <span class="wr-group-icon">{{ group.icon }}</span>
          <span class="wr-group-name">{{ group.label }}</span>
          <span class="wr-group-count">{{ group.items.length }} 项</span>
        </div>
        <div class="wr-cards">
          <div
            v-for="r in group.items"
            :key="r.id"
            class="wr-card"
            :class="{ 'is-on': r.enabled }"
          >
            <!-- 行 1：徽标 + 名称 + 标签 + 测活点 + 开关（永不换行，窄卡名称截断） -->
            <div class="wr-card-head">
              <span class="wr-badge" :style="{ background: r.color }">{{ r.label.slice(0, 1) }}</span>
              <div class="wr-card-title" :title="r.label">
                <span class="wr-card-name">{{ r.label }}</span>
                <span class="wr-card-tags">
                  <span v-if="r.imageSearch" class="wr-tag wr-tag-img" title="可供三级生图网络搜图使用">搜图</span>
                  <span v-if="r.needsKey" class="wr-tag">需 Key</span>
                  <span v-else class="wr-tag wr-tag-free">免 Key</span>
                </span>
              </div>
              <span
                v-if="r.tested"
                class="wr-test-dot"
                :class="r.tested.ok ? 'is-ok' : 'is-fail'"
                :title="r.tested.ok ? `${r.tested.latencyMs}ms 连通` : (r.tested.error || '失败')"
              >{{ r.tested.ok ? '✓' : '✗' }}</span>
              <button
                type="button"
                class="wr-switch"
                :class="{ 'is-on': r.enabled }"
                role="switch"
                :aria-checked="r.enabled"
                :aria-label="`启用 ${r.label}`"
                @click="toggleEnabled(r)"
              ><span class="wr-switch-knob" /></button>
            </div>

            <!-- 行 2：一句话说明（单行省略，完整内容 title 悬浮） -->
            <div class="wr-card-desc" :title="r.docsZh">{{ r.docsZh }}</div>

            <!-- 行 3+：唯一凭据框（启用或已填过才展开）。
                 SearXNG 的"Key 位"=实例地址（存 baseUrl，其余源默认地址内置，不设地址栏） -->
            <div v-if="r.needsKey && (r.enabled || r.apiKey || r.baseUrl)" class="wr-card-config wr-card-config-single">
              <label class="wr-field">
                <span class="wr-field-label">{{ r.id === 'searxng' ? '实例地址' : 'API Key' }}</span>
                <span class="wr-field-input-wrap">
                  <input
                    v-if="r.id === 'searxng'"
                    v-model="drafts[r.id].baseUrl"
                    class="wr-input"
                    type="text"
                    placeholder="https://searx.example.com"
                    :disabled="!r.enabled"
                    @input="scheduleSave(r.id)"
                  />
                  <template v-else>
                    <input
                      v-model="drafts[r.id].apiKey"
                      class="wr-input"
                      :type="reveal[r.id] ? 'text' : 'password'"
                      placeholder="粘贴 API Key"
                      :disabled="!r.enabled"
                      @input="scheduleSave(r.id)"
                    />
                    <button
                      type="button"
                      class="wr-eye"
                      :title="reveal[r.id] ? '隐藏' : '显示'"
                      @click="reveal[r.id] = !reveal[r.id]"
                    >{{ reveal[r.id] ? '🙈' : '👁' }}</button>
                  </template>
                </span>
              </label>
            </div>

            <!-- 末行：申请 Key | 测试 | 结果（结果右对齐省略，悬浮看全文） -->
            <div class="wr-card-foot">
              <button
                v-if="r.keyUrl"
                type="button"
                class="wr-link"
                :title="r.keyUrl"
                @click="openExternalUrl(r.keyUrl)"
              >申请 Key ↗</button>
              <span v-else class="wr-free-note">{{ r.needsKey ? '' : '内置兜底源，无需配置' }}</span>
              <span class="wr-foot-spacer" />
              <button
                type="button"
                class="wr-btn wr-btn-test"
                :disabled="testing[r.id] || (r.needsKey && !r.enabled)"
                @click="onTest(r)"
              >
                {{ testing[r.id] ? '测试中…' : '测试' }}
              </button>
              <span
                v-if="r.tested"
                class="wr-test-result"
                :class="r.tested.ok ? 'is-ok' : 'is-fail'"
                :title="r.tested.ok ? `${r.tested.latencyMs}ms 连通` : (r.tested.error || '失败')"
              >{{ r.tested.ok ? `✓ ${r.tested.latencyMs}ms` : `✗ ${shortErr(r.tested.error)}` }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <transition name="wr-fade">
      <div v-if="toast" class="wr-toast" :class="toast.kind">{{ toast.msg }}</div>
    </transition>
  </div>
</template>

<script>
import services from '../services/index.js'

export default {
  name: 'WebResourceSettings',
  data() {
    return {
      resources: [],
      drafts: {},
      reveal: {},
      testing: {},
      testingAll: false,
      syncing: false,
      syncState: { ok: null, detail: '' },
      saveTimers: {},
      toast: null,
      toastTimer: 0
    }
  },
  computed: {
    groups() {
      const defs = [
        { kind: 'web', label: '网页搜索', icon: '🔎' },
        { kind: 'stock', label: '图片图库', icon: '🖼️' },
        { kind: 'keyless', label: '免 Key 兜底', icon: '🛟' }
      ]
      return defs
        .map(d => ({ ...d, items: this.resources.filter(r => r.kind === d.kind) }))
        .filter(g => g.items.length)
    },
    enabledCount() {
      return this.resources.filter(r => r.enabled).length
    },
    keyedCount() {
      return this.resources.filter(r => r.needsKey && r.enabled && (r.apiKey || r.baseUrl)).length
    },
    freeCount() {
      return this.resources.filter(r => !r.needsKey).length
    },
    lastTestedAt() {
      const times = this.resources.map(r => r.tested?.at).filter(Boolean).sort()
      return times.length ? times[times.length - 1] : ''
    },
    syncLabel() {
      if (this.syncState.ok === true) return '✓ 已同步本机服务'
      if (this.syncState.ok === false) return '⚠ 本机服务未同步'
      return '○ 未同步'
    }
  },
  async mounted() {
    await this.reload()
    this.onSync(false)
  },
  beforeUnmount() {
    if (this.toastTimer) clearTimeout(this.toastTimer)
    Object.values(this.saveTimers).forEach(t => clearTimeout(t))
  },
  methods: {
    async reload() {
      try {
        this.resources = services.webResources.listWebResources()
        this.drafts = Object.fromEntries(this.resources.map(r => [r.id, {
          apiKey: r.apiKey,
          baseUrl: r.baseUrl
        }]))
        this.reveal = Object.fromEntries(this.resources.map(r => [r.id, false]))
      } catch (e) {
        this.showToast('error', `加载失败：${e.message || e}`)
      }
    },
    toggleEnabled(r) {
      this.resources = services.webResources.saveWebResource(r.id, { enabled: !r.enabled })
      this.persistAndSync(r.id, !r.enabled ? '已启用' : '已停用')
    },
    scheduleSave(id) {
      if (this.saveTimers[id]) clearTimeout(this.saveTimers[id])
      this.saveTimers[id] = setTimeout(() => {
        const d = this.drafts[id] || {}
        this.resources = services.webResources.saveWebResource(id, {
          apiKey: String(d.apiKey || '').trim(),
          baseUrl: String(d.baseUrl || '').trim()
        })
        this.persistAndSync(id, '已保存')
      }, 500)
    },
    /** 落 sidecar（image_search 消费）+ 状态条反馈 */
    async persistAndSync(changedId, word) {
      this.showToast('success', `${word}（${changedId}）`)
      await this.onSync(false)
    },
    async onSync(manual) {
      if (this.syncing) return
      this.syncing = true
      try {
        const res = await services.webResources.syncWebResourcesToSidecar()
        this.syncState = res.synced
          ? { ok: true, detail: '启用清单已同步到本机服务' }
          : { ok: false, detail: `本机服务未同步：${res.error || '离线'}（设置仍保存在本地）` }
        if (manual) {
          this.showToast(res.synced ? 'success' : 'error',
            res.synced ? '已同步到本机服务' : `同步失败：${res.error || '服务离线'}`)
        }
      } finally {
        this.syncing = false
      }
    },
    async onTest(r) {
      if (this.testing[r.id]) return
      this.testing = { ...this.testing, [r.id]: true }
      try {
        const res = await services.webResources.testWebResource(r.id)
        this.resources = services.webResources.listWebResources()
        this.showToast(res.ok ? 'success' : 'error',
          res.ok ? `${r.label} 连通（${res.latencyMs}ms）` : `${r.label} 测试失败：${res.error || '未知原因'}`)
      } catch (e) {
        this.showToast('error', `${r.label} 测试失败：${e.message || e}`)
      } finally {
        this.testing = { ...this.testing, [r.id]: false }
      }
    },
    async onTestAll() {
      if (this.testingAll) return
      this.testingAll = true
      try {
        const targets = this.resources.filter(r => r.enabled || !r.needsKey)
        let ok = 0
        for (const r of targets) {
          const res = await services.webResources.testWebResource(r.id)
          this.resources = services.webResources.listWebResources()
          if (res.ok) ok += 1
        }
        this.showToast(ok === targets.length ? 'success' : 'error',
          `测活完成：${ok}/${targets.length} 连通`)
      } finally {
        this.testingAll = false
      }
    },
    shortTime(iso) {
      try { return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }
      catch { return '' }
    },
    /** 在系统默认浏览器打开外链：WPS ShellExecute → FollowHyperlink → window.open */
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
        console.warn('打开链接失败:', e)
      }
      try {
        window.open(url, '_blank', 'noopener,noreferrer')
      } catch (e) {
        console.warn('打开链接失败:', e)
      }
    },
    shortErr(msg) {
      const s = String(msg || '失败')
      if (/abort/i.test(s)) return '超时'
      if (/401|403/.test(s)) return 'Key 无效'
      if (/network|failed to fetch/i.test(s)) return '网络不可达'
      return s.slice(0, 24)
    },
    showToast(kind, msg) {
      this.toast = { kind, msg }
      if (this.toastTimer) clearTimeout(this.toastTimer)
      this.toastTimer = setTimeout(() => { this.toast = null }, 3000)
    }
  }
}
</script>

<style scoped>
.wr-panel {
  height: 100%;
  overflow-y: auto;
  padding: 16px 20px 24px;
  font-size: 13px;
  color: #2a2a2a;
  box-sizing: border-box;
}

/* ---- 头部 ---- */
.wr-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.wr-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}
.wr-title-icon { font-size: 18px; }
.wr-subtitle {
  margin-top: 6px;
  max-width: 640px;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.6;
}
.wr-header-actions { display: flex; gap: 8px; flex-shrink: 0; }

/* ---- 按钮 ---- */
.wr-btn {
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background .15s, border-color .15s;
}
.wr-btn:disabled { opacity: .5; cursor: not-allowed; }
.wr-btn-ghost {
  background: #fff;
  border-color: #cfd4db;
  color: #2a6ddf;
}
.wr-btn-ghost:hover:not(:disabled) { background: #eff6ff; border-color: #93c5fd; }
.wr-btn-test {
  background: #f0f6ff;
  border-color: #bcd4f7;
  color: #2a6ddf;
  padding: 4px 10px;
}
.wr-btn-test:hover:not(:disabled) { background: #e0edff; }

/* ---- 状态条 ---- */
.wr-status-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0 4px;
}
.wr-chip {
  padding: 3px 10px;
  border-radius: 10px;
  background: #eef0f3;
  color: #555;
  font-size: 11px;
}
.wr-chip-on { background: #e5f3e8; color: #207c3d; }
.wr-chip-sync { background: #e8f0fe; color: #1d4fd7; }
.wr-chip-sync.is-err { background: #fdecea; color: #b3402f; }
.wr-chip-time { background: #f3f0fa; color: #6d28a8; }

/* ---- 分组 ---- */
.wr-groups { margin-top: 12px; display: flex; flex-direction: column; gap: 18px; max-width: 980px; }
.wr-group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 2px;
  font-weight: 600;
}
.wr-group-icon { font-size: 15px; }
.wr-group-count {
  font-size: 10px;
  font-weight: 500;
  background: #eef0f3;
  color: #666;
  padding: 1px 8px;
  border-radius: 8px;
}

/* ---- 卡片：单列宽行（设置第三列窄），超宽屏才分两列 ---- */
.wr-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}
@media (min-width: 1500px) {
  .wr-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 560px) {
  .wr-header { flex-direction: column; }
  .wr-header-actions { align-self: flex-end; }
}
.wr-card {
  border: 1px solid #e6e8ec;
  border-radius: 10px;
  background: #fff;
  padding: 10px 12px;
  transition: border-color .15s, box-shadow .15s;
  min-width: 0;
}
.wr-card:hover { border-color: #cfd9ea; }
.wr-card.is-on { border-color: #b9d0f5; box-shadow: 0 1px 6px rgba(42, 109, 223, .08); }

/* 行 1：徽标 名称 标签 · 测活点 开关 — 单行，窄卡时名称截断 */
.wr-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
  min-width: 0;
}
.wr-badge {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wr-card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  flex-wrap: nowrap;
  overflow: hidden;
}
.wr-card-name {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 1;
  min-width: 0;
}
.wr-card-tags {
  display: inline-flex;
  gap: 4px;
  flex-shrink: 0;
  white-space: nowrap;
}
.wr-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: #eef0f3;
  color: #666;
}
.wr-tag-img { background: #e8f0fe; color: #1d4fd7; }
.wr-tag-free { background: #e5f3e8; color: #207c3d; }

.wr-test-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  flex-shrink: 0;
}
.wr-test-dot.is-ok { background: #e5f3e8; color: #207c3d; }
.wr-test-dot.is-fail { background: #fdecea; color: #b3402f; }

/* 开关 */
.wr-switch {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  border: none;
  background: #d5d9e0;
  position: relative;
  cursor: pointer;
  transition: background .18s;
  flex-shrink: 0;
  padding: 0;
}
.wr-switch.is-on { background: #2a6ddf; }
.wr-switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .25);
  transition: left .18s;
}
.wr-switch.is-on .wr-switch-knob { left: 18px; }

/* 行 2：说明单行省略 */
.wr-card-desc {
  margin: 7px 0 0;
  color: #6b7280;
  font-size: 11.5px;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 行 3：凭据配置（仅启用或已填过的卡片展开），Key/地址双列 */
.wr-card-config {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #eef0f3;
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}
.wr-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.wr-field-label { font-size: 11px; color: #6b7280; }
.wr-field-input-wrap { position: relative; display: flex; }
.wr-input {
  width: 100%;
  border: 1px solid #cfd4db;
  border-radius: 6px;
  padding: 6px 30px 6px 9px;
  font-size: 12px;
  outline: none;
  background: #fff;
  box-sizing: border-box;
}
.wr-input:focus { border-color: #2a6ddf; box-shadow: 0 0 0 2px rgba(42, 109, 223, .12); }
.wr-input:disabled { background: #f5f6f8; color: #aaa; }
.wr-eye {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  padding: 2px 4px;
}

/* 末行：申请 Key |←spacer→| 测试 结果（单行，结果右对齐省略悬浮看全文） */
.wr-card-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 9px;
  min-width: 0;
  flex-wrap: nowrap;
}
.wr-free-note {
  color: #9aa1ac;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.wr-foot-spacer { flex: 1; }
.wr-link {
  border: none;
  background: transparent;
  padding: 0;
  color: #2a6ddf;
  font-size: 11.5px;
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
}
.wr-link:hover { text-decoration: underline; }
.wr-btn-test { flex-shrink: 0; }
.wr-test-result {
  font-size: 11px;
  max-width: 46%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
  flex-shrink: 1;
  min-width: 0;
}
.wr-test-result.is-ok { color: #207c3d; }
.wr-test-result.is-fail { color: #b3402f; }
</style>
