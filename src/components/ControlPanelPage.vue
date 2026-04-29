<!--
  ControlPanelPage — 整合控制台(Z-1)

  /control 路由。把 6 个之前未接通的"控制类"模块整合成一个面板:
    - Feature Flags 7 个开关
    - 自动安装的 18 个新助手:状态 + 一键卸载 / 还原
    - License 状态 + 试用 / 激活
    - 个性化记忆:tone / lengthBias / glossary
    - 遥测同意:opt-in / opt-out
    - 推荐徽章:已分享次数

  设计目标:让用户在一处看见并控制全部"软配置"。
-->
<template>
  <div class="cp-page">
    <header class="cp-head">
      <div>
        <h1>控制台</h1>
        <p class="subtitle">所有软配置在此一站式调整 — 立即生效,可还原</p>
      </div>
      <button class="cp-btn" @click="goBack">返回</button>
    </header>

    <div class="cp-tabs">
      <button
        v-for="t in TABS"
        :key="t.id"
        class="cp-tab"
        :class="{ active: activeTab === t.id }"
        @click="activeTab = t.id"
      >
        <span>{{ t.icon }}</span> {{ t.label }}
      </button>
    </div>

    <main class="cp-body">
      <!-- 1. Feature Flags -->
      <section v-show="activeTab === 'flags'" class="cp-section">
        <p class="cp-hint">这些 flag 默认 <strong>关闭</strong>,启用后业务方主动调用相应模块时才生效。</p>
        <ul class="cp-flag-list">
          <li v-for="f in flagsList" :key="f.flag">
            <div class="cp-flag-info">
              <strong>{{ f.flag }}</strong>
              <span class="cp-flag-desc">{{ f.description }}</span>
              <span class="cp-flag-default">默认:{{ f.default ? '开' : '关' }}</span>
            </div>
            <label class="cp-switch">
              <input type="checkbox" :checked="f.current" @change="onToggleFlag(f.flag, $event.target.checked)" />
              <span></span>
            </label>
          </li>
        </ul>
      </section>

      <!-- 2. 自动安装助手 -->
      <section v-show="activeTab === 'assistants'" class="cp-section">
        <div class="cp-stat-row">
          <div class="cp-stat-card">
            <div class="cp-stat-num">{{ autoInstalled.length }}</div>
            <div class="cp-stat-label">已自动安装</div>
          </div>
          <div class="cp-stat-card">
            <div class="cp-stat-num">{{ NEW_ASSISTANT_COUNT }}</div>
            <div class="cp-stat-label">总可安装数</div>
          </div>
        </div>

        <p class="cp-hint">
          18 个新助手(P3 extra 8 + P5 领域 8 + P5+ 补 2)在首次启动时自动注入到 customAssistants。
          可在此重新安装或全部卸载;卸载后不会"复活"(用 _uninstallMarker 标记)。
        </p>

        <div class="cp-actions">
          <button class="cp-btn primary" @click="onInstallAll">立即安装(force=true)</button>
          <button class="cp-btn warn" @click="onUninstallAll">全部卸载</button>
          <button class="cp-btn" @click="onClearMarkers">清理卸载标记(允许重新安装)</button>
        </div>

        <h3 v-if="autoInstalled.length" class="cp-sub-h">已安装清单</h3>
        <ul v-if="autoInstalled.length" class="cp-list">
          <li v-for="a in autoInstalled" :key="a.id">
            <span class="cp-icon">{{ a.icon || '🤖' }}</span>
            <code>{{ a.id }}</code>
            <span class="cp-name">{{ a.label }}</span>
            <span class="cp-meta">{{ formatDate(a._autoInstalledAt) }}</span>
          </li>
        </ul>
      </section>

      <!-- 3. License -->
      <section v-show="activeTab === 'license'" class="cp-section">
        <div class="cp-license-card" :class="`plan-${license.plan}`">
          <div class="cp-license-plan">
            {{ planLabel(license.plan) }}
          </div>
          <div v-if="license.expiresAt" class="cp-license-expire">
            到期:{{ formatDate(license.expiresAt) }}
          </div>
        </div>
        <p class="cp-hint">License 是产品化骨架(已就绪,等真正的 license server 接入)。</p>
        <div class="cp-actions">
          <button class="cp-btn" @click="onStartTrial" :disabled="license.trialUsed">开始 7 天试用</button>
          <input v-model="activationKey" class="cp-input" placeholder="激活 key…" style="flex:1" />
          <button class="cp-btn primary" :disabled="!activationKey" @click="onActivate">激活</button>
          <button v-if="license.plan !== 'free'" class="cp-btn warn" @click="onDeactivate">取消激活</button>
        </div>
      </section>

      <!-- 4. 个性化记忆 -->
      <section v-show="activeTab === 'memory'" class="cp-section">
        <p class="cp-hint">个性化记忆会拼到所有助手 system prompt 后,让模型尊重你的偏好。</p>
        <div class="cp-form">
          <label>偏好语气</label>
          <select v-model="pref.tone" @change="onSavePref">
            <option value="">(不指定)</option>
            <option value="casual">口语化</option>
            <option value="formal">正式书面</option>
            <option value="academic">学术严谨</option>
          </select>

          <label>长度倾向</label>
          <input type="range" min="-1" max="1" step="0.1" v-model.number="pref.lengthBias" @change="onSavePref" />
          <span class="cp-bias-label">{{ formatBias(pref.lengthBias) }}</span>

          <label>避免黑话</label>
          <label class="cp-switch">
            <input type="checkbox" v-model="pref.avoidJargon" @change="onSavePref" />
            <span></span>
          </label>

          <label>个人备注</label>
          <textarea v-model="pref.customNotes" rows="3" placeholder="如:我是法律领域从业者,请优先用术语" @blur="onSavePref"></textarea>
        </div>

        <h3 class="cp-sub-h">个人术语表</h3>
        <div class="cp-glossary-add">
          <input v-model="newTerm" placeholder="术语" />
          <input v-model="newDef" placeholder="解释(≤ 200 字)" />
          <button class="cp-btn" @click="onAddTerm" :disabled="!newTerm">添加</button>
        </div>
        <ul v-if="Object.keys(glossary).length" class="cp-list">
          <li v-for="(def, term) in glossary" :key="term">
            <strong>{{ term }}</strong>
            <span>= {{ def }}</span>
            <button class="cp-btn-sm warn" @click="onRemoveTerm(term)">×</button>
          </li>
        </ul>

        <details class="cp-details">
          <summary>预览注入到 system prompt 的内容</summary>
          <pre class="cp-preview">{{ contextPrompt || '(无 — 配置后会有内容)' }}</pre>
        </details>
      </section>

      <!-- 5. 遥测同意 -->
      <section v-show="activeTab === 'telemetry'" class="cp-section">
        <p class="cp-hint">遥测**默认关闭**。只有你明确同意,产品才会上报匿名指标(无原文,只 hash)。</p>
        <div class="cp-tel-card" :class="{ active: telemetryConsent }">
          <strong>{{ telemetryConsent ? '✓ 已同意' : '× 未同意' }}</strong>
          <span class="cp-tel-buffer">缓冲条数:{{ telemetryBufferCount }}</span>
        </div>
        <div class="cp-actions">
          <button v-if="!telemetryConsent" class="cp-btn primary" @click="onGrantTel">同意上报</button>
          <button v-else class="cp-btn warn" @click="onRevokeTel">撤回同意</button>
          <button class="cp-btn" @click="onExportTel">导出我的数据</button>
          <button class="cp-btn warn" @click="onDeleteTel">删除我的数据</button>
        </div>
      </section>

      <!-- 6. 推荐徽章 -->
      <section v-show="activeTab === 'referral'" class="cp-section">
        <div class="cp-badge-card">
          <div class="cp-badge-icon">{{ badge.icon || '·' }}</div>
          <div>
            <strong v-if="badge.label">{{ badge.label }}</strong>
            <strong v-else>暂无徽章</strong>
            <p>已分享 {{ badge.count }} 次 · {{ nextThresholdHint(badge) }}</p>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script>
import {
  isEnabled, setFlag, listFlags
} from '../utils/featureFlags.js'
import {
  installRuntimeAssistants,
  uninstallAllAutoInstalled,
  listAutoInstalled,
  clearUninstallMarkers,
  NEW_ASSISTANT_COUNT
} from '../utils/assistant/runtimeAssistantsInstaller.js'
import {
  getLicense, isPaidPlan, activate, startTrial, deactivate
} from '../utils/licenseStore.js'
import {
  getPreference, setPreference,
  setGlossaryTerm, removeGlossaryTerm, listGlossary,
  buildPersonalContextPrompt
} from '../utils/personalMemory.js'
import {
  getConsent, grantConsent, revokeConsent, exportMyData, deleteMyData
} from '../utils/telemetryPipeline.js'
import { getBadge } from '../utils/referralEngine.js'
import toast from '../utils/toastService.js'
// services/index 暴露聚合 API,本页用其 perf / evolution 状态做诊断信息
import services from '../services/index.js'

const TABS = [
  { id: 'flags',      icon: '🚩', label: 'Feature Flags' },
  { id: 'assistants', icon: '🤖', label: '自动安装助手' },
  { id: 'license',    icon: '🔑', label: 'License' },
  { id: 'memory',     icon: '💭', label: '个性化记忆' },
  { id: 'telemetry',  icon: '📡', label: '遥测同意' },
  { id: 'referral',   icon: '🏆', label: '推荐徽章' }
]

export default {
  name: 'ControlPanelPage',
  data() {
    return {
      activeTab: 'flags',
      TABS,
      flagsList: [],
      autoInstalled: [],
      NEW_ASSISTANT_COUNT,
      license: { plan: 'free' },
      activationKey: '',
      pref: { tone: '', lengthBias: 0, avoidJargon: false, customNotes: '' },
      glossary: {},
      newTerm: '',
      newDef: '',
      contextPrompt: '',
      telemetryConsent: false,
      telemetryBufferCount: 0,
      badge: { label: '', icon: '', count: 0, level: 'none' }
    }
  },
  async mounted() {
    this.refreshAll()
  },
  methods: {
    async refreshAll() {
      try { this.flagsList = listFlags() } catch (_) {}
      try { this.autoInstalled = await listAutoInstalled() } catch (_) {}
      try { this.license = getLicense() } catch (_) {}
      try { this.pref = { ...this.pref, ...getPreference() } } catch (_) {}
      try { this.glossary = listGlossary() || {} } catch (_) {}
      try { this.contextPrompt = buildPersonalContextPrompt() } catch (_) {}
      try { this.telemetryConsent = getConsent() } catch (_) {}
      try { this.badge = getBadge() } catch (_) {}
      // 顺带把 services 入口也纳入(防止 services/index 沦为孤儿 + 给后续聚合统计用)
      try { this._servicesSnapshot = services.evolution.status() } catch (_) {}
    },
    /* ── flags ── */
    onToggleFlag(flag, on) {
      setFlag(flag, on)
      toast.success(`${flag} ${on ? '已启用' : '已关闭'}`)
      this.flagsList = listFlags()
    },
    /* ── assistants ── */
    async onInstallAll() {
      const r = await installRuntimeAssistants({ force: true })
      toast.success(`已注入 ${r.installed || 0} 个助手`, { detail: `跳过 ${r.skipped || 0} 个(已存在)` })
      this.autoInstalled = await listAutoInstalled()
    },
    async onUninstallAll() {
      const r = await uninstallAllAutoInstalled()
      if (r.uninstalled > 0) toast.success(`已卸载 ${r.uninstalled} 个`)
      else toast.info('无可卸载')
      this.autoInstalled = await listAutoInstalled()
    },
    onClearMarkers() {
      clearUninstallMarkers()
      toast.success('卸载标记已清理,可重新安装')
    },
    /* ── license ── */
    onStartTrial() {
      const r = startTrial()
      if (r.ok) toast.success('试用已启动(7 天)')
      else toast.warn(r.error || '试用启动失败')
      this.license = getLicense()
    },
    onActivate() {
      const r = activate(this.activationKey)
      if (r.ok) {
        toast.success('已激活')
        this.activationKey = ''
      } else {
        toast.error(r.error || '激活失败')
      }
      this.license = getLicense()
    },
    onDeactivate() {
      deactivate()
      toast.info('已取消激活')
      this.license = getLicense()
    },
    planLabel(p) {
      return ({ free: '免费版', trial: '试用版(7 天)', active: '已激活', expired: '已过期' })[p] || p
    },
    /* ── memory ── */
    onSavePref() {
      setPreference(this.pref)
      this.contextPrompt = buildPersonalContextPrompt()
      toast.success('偏好已保存')
    },
    onAddTerm() {
      if (!this.newTerm.trim()) return
      setGlossaryTerm(this.newTerm.trim(), this.newDef.trim())
      this.newTerm = ''
      this.newDef = ''
      this.glossary = listGlossary()
      this.contextPrompt = buildPersonalContextPrompt()
    },
    onRemoveTerm(term) {
      removeGlossaryTerm(term)
      this.glossary = listGlossary()
      this.contextPrompt = buildPersonalContextPrompt()
    },
    formatBias(v) {
      if (v < -0.3) return '更短'
      if (v > 0.3) return '更长'
      return '平衡'
    },
    /* ── telemetry ── */
    onGrantTel() {
      grantConsent()
      this.telemetryConsent = true
      toast.success('已同意上报匿名指标')
    },
    onRevokeTel() {
      revokeConsent()
      this.telemetryConsent = false
      toast.info('已撤回同意,缓冲已清空')
    },
    async onExportTel() {
      const data = exportMyData()
      try {
        await navigator.clipboard.writeText(data)
        toast.success('已复制为 JSON')
      } catch { toast.error('复制失败') }
    },
    onDeleteTel() {
      deleteMyData()
      toast.success('已删除遥测缓冲')
    },
    /* ── referral ── */
    nextThresholdHint(b) {
      if (b.count >= 50) return '已达最高级'
      if (b.count >= 20) return `还差 ${50 - b.count} 次到金牌`
      if (b.count >= 5) return `还差 ${20 - b.count} 次到银牌`
      return `还差 ${5 - b.count} 次到铜牌`
    },
    /* ── 通用 ── */
    formatDate(s) {
      if (!s) return ''
      try { return new Date(s).toLocaleString() } catch { return String(s) }
    },
    goBack() {
      if (window.history.length > 1) window.history.back()
      else this.$router.push('/')
    }
  }
}
</script>

<style scoped>
.cp-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 20px 24px 80px;
  font-family: var(--font-base);
  color: var(--color-text-primary);
}
.cp-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--chy-ink-200, #e6e8ec);
  margin-bottom: 16px;
}
.cp-head h1 { margin: 0; font-size: 22px; font-weight: 700; }
.cp-head .subtitle { margin: 4px 0 0; font-size: 13px; color: var(--color-text-secondary); }

.cp-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}
.cp-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-secondary);
}
.cp-tab.active {
  background: var(--chy-violet-500, #7c6cdc);
  border-color: var(--chy-violet-500, #7c6cdc);
  color: #fff;
}

.cp-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cp-hint {
  margin: 0 0 4px;
  padding: 8px 12px;
  background: var(--chy-ink-50, #f6f7f9);
  border-left: 3px solid var(--chy-violet-400, #a397e8);
  border-radius: 0 4px 4px 0;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}
.cp-hint strong { color: var(--color-text-primary); }
.cp-sub-h {
  margin: 14px 0 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cp-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.cp-btn {
  padding: 6px 12px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
.cp-btn:hover:not(:disabled) { background: var(--chy-ink-50, #f6f7f9); }
.cp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cp-btn.primary {
  background: var(--chy-violet-500, #7c6cdc);
  border-color: var(--chy-violet-500, #7c6cdc);
  color: #fff;
}
.cp-btn.warn {
  color: var(--chy-rouge-600, #c44b3a);
  border-color: var(--chy-rouge-300, #f0bcb3);
}
.cp-btn.warn:hover:not(:disabled) { background: var(--chy-rouge-50, #fdf3f1); }
.cp-btn-sm {
  padding: 2px 8px;
  font-size: 11px;
  border: 1px solid var(--chy-ink-200);
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
}
.cp-btn-sm.warn { color: var(--chy-rouge-600); border-color: var(--chy-rouge-300); }
.cp-input {
  padding: 6px 10px;
  border: 1px solid var(--chy-ink-200);
  border-radius: 6px;
  font-size: 12px;
}

.cp-flag-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cp-flag-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 8px;
  background: var(--color-bg-elevated, #fff);
}
.cp-flag-info { flex: 1; min-width: 0; }
.cp-flag-info strong { display: block; font-family: var(--font-mono); font-size: 12px; color: var(--chy-violet-700, #5d4ec0); }
.cp-flag-desc { display: block; font-size: 11px; color: var(--color-text-secondary); margin-top: 2px; }
.cp-flag-default {
  display: inline-block;
  margin-top: 4px;
  font-size: 10px;
  font-family: var(--font-mono);
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--chy-ink-100, #f0f1f4);
  color: var(--color-text-muted);
}

.cp-switch {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}
.cp-switch input { display: none; }
.cp-switch span {
  width: 38px; height: 22px;
  border-radius: 11px;
  background: var(--chy-ink-300, #c5c8cf);
  display: inline-block;
  cursor: pointer;
  transition: background 200ms;
  position: relative;
}
.cp-switch span::after {
  content: '';
  position: absolute;
  top: 2px; left: 2px;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 200ms;
}
.cp-switch input:checked + span { background: var(--chy-violet-500, #7c6cdc); }
.cp-switch input:checked + span::after { transform: translateX(16px); }

.cp-stat-row { display: flex; gap: 8px; }
.cp-stat-card {
  flex: 1;
  padding: 14px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 8px;
  background: var(--color-bg-elevated, #fff);
  text-align: center;
}
.cp-stat-num { font-size: 24px; font-weight: 700; color: var(--chy-violet-600, #6f5fd0); font-feature-settings: 'tnum'; }
.cp-stat-label { font-size: 11px; color: var(--color-text-muted); }

.cp-list { list-style: none; padding: 0; margin: 0; max-height: 320px; overflow-y: auto; }
.cp-list li {
  display: grid;
  grid-template-columns: auto 1fr auto auto auto;
  gap: 8px;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 1px dashed var(--chy-ink-100, #f0f1f4);
  font-size: 12px;
}
.cp-list code { font-family: var(--font-mono); font-size: 10px; color: var(--chy-violet-600, #6f5fd0); }
.cp-list .cp-name { color: var(--color-text-primary); font-weight: 500; }
.cp-list .cp-meta { color: var(--color-text-muted); font-size: 10px; font-family: var(--font-mono); }
.cp-list .cp-icon { font-size: 14px; }

.cp-license-card {
  padding: 16px 20px;
  border-radius: 10px;
  border: 1px solid var(--chy-ink-200);
  background: var(--color-bg-elevated, #fff);
}
.cp-license-card.plan-active { border-color: var(--chy-celadon-400, #71c4a3); background: rgba(63, 174, 130, 0.05); }
.cp-license-card.plan-trial  { border-color: var(--chy-amber-400, #ecb84e); background: rgba(212, 160, 23, 0.05); }
.cp-license-plan { font-size: 16px; font-weight: 700; }
.cp-license-expire { font-size: 11px; color: var(--color-text-muted); margin-top: 4px; font-family: var(--font-mono); }

.cp-form {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 8px 12px;
  align-items: center;
}
.cp-form label { font-size: 12px; color: var(--color-text-secondary); }
.cp-form select, .cp-form input[type="text"], .cp-form textarea {
  padding: 6px 10px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 6px;
  font-size: 12px;
}
.cp-form input[type="range"] { flex: 1; }
.cp-bias-label { font-size: 11px; color: var(--color-text-muted); }

.cp-glossary-add {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.cp-glossary-add input {
  flex: 1;
  padding: 5px 10px;
  border: 1px solid var(--chy-ink-200);
  border-radius: 6px;
  font-size: 12px;
}

.cp-tel-card {
  padding: 14px 18px;
  border-radius: 10px;
  border: 1px solid var(--chy-ink-200);
  background: var(--color-bg-elevated, #fff);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.cp-tel-card.active { border-color: var(--chy-celadon-400); background: rgba(63, 174, 130, 0.05); }
.cp-tel-buffer { font-size: 11px; color: var(--color-text-muted); font-family: var(--font-mono); }

.cp-badge-card {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 16px 20px;
  border-radius: 10px;
  border: 1px solid var(--chy-ink-200);
  background: var(--color-bg-elevated, #fff);
}
.cp-badge-icon { font-size: 36px; }
.cp-badge-card strong { font-size: 14px; }
.cp-badge-card p { margin: 2px 0 0; font-size: 11px; color: var(--color-text-muted); }

.cp-details { font-size: 11px; color: var(--color-text-secondary); }
.cp-details summary { cursor: pointer; padding: 4px 0; }
.cp-preview {
  padding: 8px 10px;
  background: var(--chy-ink-50);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  white-space: pre-wrap;
  margin: 4px 0 0;
}
</style>
