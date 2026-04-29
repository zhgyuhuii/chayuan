<!--
  AssistantFormDemoPage — /assistant-form-demo

  目标布局 demo:Tab 分组 + 折叠 + Sticky 操作栏。
  团队评审本页面后,再决定要不要把 SettingsDialog 主面板切到此布局。

  布局示意(已与 plan-assistant-form-layout.md 一致):
    ┌─────────────────────────────────────────────────────────┐
    │ [📝 基础] [🎯 能力] [📤 输出] [⚙️ 高级]    [创建助手]   │  sticky
    ├─────────────────────────────────────────────────────────┤
    │  当前 Tab 表单内容(密度提升、hint 折叠、必填 *)        │
    └─────────────────────────────────────────────────────────┘
-->
<template>
  <div class="afd-page">
    <header class="afd-head">
      <div>
        <h1>新建助手 — 目标布局 Demo</h1>
        <p class="subtitle">Tab 分组 + 折叠 + Sticky 操作栏 · 待评审后再切到主面板</p>
      </div>
      <button class="afd-back" @click="goBack">返回</button>
    </header>

    <!-- 顶部 Sticky Tabs + 操作栏 -->
    <div class="afd-stickybar">
      <nav class="afd-tabs" role="tablist">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="afd-tab"
          :class="{ active: activeTab === t.id }"
          role="tab"
          :aria-selected="activeTab === t.id"
          @click="activeTab = t.id"
        >
          <span class="afd-tab-icon">{{ t.icon }}</span>
          <span>{{ t.label }}</span>
          <span v-if="t.requiredFilled !== null" class="afd-tab-badge" :class="t.requiredFilled ? 'ok' : 'pending'">
            {{ t.requiredFilled ? '✓' : '!' }}
          </span>
        </button>
      </nav>
      <div class="afd-actions">
        <button class="afd-btn ghost" @click="reset">重置</button>
        <button class="afd-btn primary" :disabled="!canCreate" @click="onCreate">
          {{ canCreate ? '创建智能助手' : '请先填必填项' }}
        </button>
      </div>
    </div>

    <main class="afd-body">
      <!-- ──── Tab 1:基础信息 ──── -->
      <section v-show="activeTab === 'basics'" class="afd-section">
        <div class="afd-row">
          <label class="afd-label" data-required>助手名称</label>
          <div class="afd-field">
            <input v-model="form.name" type="text" class="afd-input" placeholder="如:法务条款审核" />
            <Tooltip text="≤ 12 字最佳;会显示在 ribbon、菜单、消息列表中" />
          </div>
        </div>

        <div class="afd-row">
          <label class="afd-label">图标</label>
          <div class="afd-field afd-icon-row">
            <div class="afd-icon-preview">{{ form.icon || '🤖' }}</div>
            <div class="afd-icon-emojis">
              <button v-for="e in EMOJI_OPTIONS" :key="e" type="button" class="afd-icon-pick" :class="{ active: form.icon === e }" @click="form.icon = e">
                {{ e }}
              </button>
            </div>
          </div>
        </div>

        <div class="afd-row">
          <label class="afd-label">功能说明</label>
          <div class="afd-field">
            <textarea v-model="form.description" class="afd-input afd-textarea" rows="2" placeholder="一句话告诉用户它能做什么"></textarea>
          </div>
        </div>

        <div class="afd-row afd-row-double">
          <label class="afd-label">助手类型</label>
          <div class="afd-field">
            <select v-model="form.modelType" class="afd-input">
              <option value="chat">分析型(对话模型)</option>
              <option value="image">图像生成型</option>
              <option value="video">视频生成型</option>
              <option value="voice">语音生成型</option>
            </select>
          </div>
          <label class="afd-label">输入范围</label>
          <div class="afd-field">
            <select v-model="form.inputSource" class="afd-input">
              <option value="selection-preferred">优先选区,无则全文</option>
              <option value="selection-only">仅选区</option>
              <option value="document">始终全文</option>
            </select>
          </div>
        </div>

        <div class="afd-row">
          <label class="afd-label">执行模型</label>
          <div class="afd-field">
            <select v-model="form.modelId" class="afd-input">
              <option value="">跟随默认设置</option>
              <option value="openai|gpt-4o-mini">openai / gpt-4o-mini</option>
              <option value="anthropic|claude-3-5-sonnet">anthropic / claude-3-5-sonnet</option>
              <option value="aliyun-bailian|qwen-plus">qwen-plus</option>
            </select>
            <Tooltip text="选「跟随默认」可使用全局默认模型;某些助手类型(如图像)只显示对应类型的模型" />
          </div>
        </div>
      </section>

      <!-- ──── Tab 2:能力定义 ──── -->
      <section v-show="activeTab === 'ability'" class="afd-section">
        <div class="afd-row">
          <label class="afd-label">角色设定</label>
          <div class="afd-field">
            <input v-model="form.persona" type="text" class="afd-input" placeholder="例:中文校对专家、合同审核员、会议纪要助手" />
          </div>
        </div>

        <div class="afd-row">
          <label class="afd-label" data-required>系统提示词</label>
          <div class="afd-field">
            <textarea v-model="form.systemPrompt" class="afd-input afd-textarea afd-textarea-prompt" rows="6" placeholder="定义助手的核心行为约束 — 任务、限制、输出格式"></textarea>
            <Tooltip text="决定助手"是什么、做什么、不做什么"。建议含:任务、严格约束、输出格式、边界" />
          </div>
        </div>

        <div class="afd-row">
          <label class="afd-label" data-required>用户提示词模板</label>
          <div class="afd-field">
            <textarea v-model="form.userPromptTemplate" class="afd-input afd-textarea afd-textarea-prompt" rows="6" placeholder="可用变量:{{input}}、{{targetLanguage}}、{{assistantName}}"></textarea>
            <Tooltip text="每次任务执行时填入用户输入。{{input}} 会替换为选区/全文文本" />
          </div>
        </div>

        <div class="afd-recommend-card">
          <div class="afd-recommend-head">
            <span class="afd-recommend-icon">✨</span>
            <div>
              <div class="afd-recommend-title">智能推荐提示词</div>
              <div class="afd-recommend-sub">描述你想要的能力,自动生成 system + user 提示词模板</div>
            </div>
            <button class="afd-btn ghost" @click="onRecommend">推荐</button>
          </div>
          <textarea v-model="form.recommendationRequirement" class="afd-input afd-textarea" rows="3" placeholder="例:写一个识别合同中违约条款的审核助手,输出 JSON,字段含 clause/risk/severity"></textarea>
        </div>
      </section>

      <!-- ──── Tab 3:输出与写回 ──── -->
      <section v-show="activeTab === 'output'" class="afd-section">
        <div class="afd-row afd-row-double">
          <label class="afd-label">输出格式</label>
          <div class="afd-field">
            <select v-model="form.outputFormat" class="afd-input">
              <option value="plain">纯文本</option>
              <option value="markdown">Markdown</option>
              <option value="bullet-list">项目符号列表</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <label class="afd-label">文档动作</label>
          <div class="afd-field">
            <select v-model="form.documentAction" class="afd-input">
              <option value="comment">添加批注</option>
              <option value="replace">替换内容</option>
              <option value="insert-after">段后插入</option>
              <option value="prepend">文档最前插入</option>
              <option value="none">仅生成结果</option>
            </select>
          </div>
        </div>

        <div class="afd-row">
          <label class="afd-label">温度</label>
          <div class="afd-field afd-temperature">
            <input v-model.number="form.temperature" type="range" min="0" max="1.5" step="0.1" />
            <span class="afd-temp-value">{{ form.temperature.toFixed(1) }}</span>
            <span class="afd-temp-hint">{{ tempHint }}</span>
          </div>
        </div>

        <!-- 输出报告 — 折叠 -->
        <Collapsible
          title="输出报告(高级)"
          :default-open="form.reportEnabled"
          icon="📊"
          :badge="form.reportEnabled ? '已启用' : '关闭'"
        >
          <div class="afd-row">
            <label class="afd-label">启用</label>
            <div class="afd-field">
              <label class="afd-switch">
                <input type="checkbox" v-model="form.reportEnabled" />
                <span></span>
              </label>
            </div>
          </div>
          <template v-if="form.reportEnabled">
            <div class="afd-row">
              <label class="afd-label">类型</label>
              <div class="afd-field">
                <select v-model="form.reportType" class="afd-input">
                  <option value="summary">总结报告</option>
                  <option value="audit">审核报告</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
            </div>
            <div class="afd-row">
              <label class="afd-label">报告格式</label>
              <div class="afd-field">
                <textarea v-model="form.reportTemplate" class="afd-input afd-textarea" rows="6" placeholder="可粘贴你希望模型遵循的报告格式"></textarea>
              </div>
            </div>
          </template>
        </Collapsible>
      </section>

      <!-- ──── Tab 4:高级 ──── -->
      <section v-show="activeTab === 'advanced'" class="afd-section">
        <div class="afd-row">
          <label class="afd-label">显示位置</label>
          <div class="afd-field afd-checkboxes">
            <label class="afd-check"><input type="checkbox" v-model="form.locations.ribbonMain" /> 顶部主菜单</label>
            <label class="afd-check"><input type="checkbox" v-model="form.locations.ribbonMore" /> 顶部"更多"菜单</label>
            <label class="afd-check"><input type="checkbox" v-model="form.locations.context" /> 右键菜单</label>
            <Tooltip text="主菜单与"更多"菜单互斥;右键菜单可与任一组合" />
          </div>
        </div>

        <div class="afd-row">
          <label class="afd-label">显示优先级</label>
          <div class="afd-field">
            <input v-model.number="form.displayOrder" type="number" class="afd-input" placeholder="留空 = 默认顺序;数字越小越靠前" />
          </div>
        </div>

        <Collapsible title="快捷模板" badge="11 类">
          <p class="afd-sub-hint">从预设模板快速创建(工程 / 软件 / 教育 / 法务 / 制造 等 11 类共 60+ 个模板)</p>
          <div class="afd-preset-grid">
            <button v-for="p in DEMO_PRESETS" :key="p.id" type="button" class="afd-preset-btn">{{ p.label }}</button>
          </div>
        </Collapsible>
      </section>
    </main>

    <footer class="afd-footnote">
      此为目标布局 demo,数据本地保存到 localStorage(key: chayuanAssistantFormDemo),不影响主助手列表。
    </footer>
  </div>
</template>

<script>
import Collapsible from './common/Collapsible.vue'

const Tooltip = {
  name: 'AfdTooltip',
  props: { text: { type: String, default: '' } },
  template: '<span class="afd-tooltip" :title="text">ⓘ</span>'
}

const EMOJI_OPTIONS = ['🤖', '🎭', '💡', '⚖️', '📋', '✏️', '📊', '🌐', '💼', '🏥', '📜', '🎓']

const DEMO_PRESETS = [
  { id: 'p1', label: '合同审核' },
  { id: 'p2', label: '会议纪要' },
  { id: 'p3', label: '招投标' },
  { id: 'p4', label: '代码审查' },
  { id: 'p5', label: '论文摘要' },
  { id: 'p6', label: '财务对账' }
]

const STORAGE_KEY = 'chayuanAssistantFormDemo'
const TAB_STORAGE_KEY = 'chayuanAssistantFormDemoTab'

function defaultForm() {
  return {
    name: '',
    icon: '🤖',
    description: '',
    modelType: 'chat',
    inputSource: 'selection-preferred',
    modelId: '',
    persona: '',
    systemPrompt: '',
    userPromptTemplate: '',
    recommendationRequirement: '',
    outputFormat: 'plain',
    documentAction: 'comment',
    temperature: 0.3,
    reportEnabled: false,
    reportType: 'summary',
    reportTemplate: '',
    locations: { ribbonMain: false, ribbonMore: true, context: false },
    displayOrder: null
  }
}

export default {
  name: 'AssistantFormDemoPage',
  components: { Collapsible, Tooltip },
  data() {
    return {
      activeTab: 'basics',
      form: defaultForm(),
      EMOJI_OPTIONS,
      DEMO_PRESETS
    }
  },
  computed: {
    tabs() {
      return [
        {
          id: 'basics', icon: '📝', label: '基础',
          requiredFilled: this.form.name.trim().length > 0
        },
        {
          id: 'ability', icon: '🎯', label: '能力',
          requiredFilled: this.form.systemPrompt.trim().length > 0 && this.form.userPromptTemplate.trim().length > 0
        },
        {
          id: 'output', icon: '📤', label: '输出',
          requiredFilled: null   // 无必填
        },
        {
          id: 'advanced', icon: '⚙️', label: '高级',
          requiredFilled: null
        }
      ]
    },
    canCreate() {
      return this.form.name.trim() && this.form.systemPrompt.trim() && this.form.userPromptTemplate.trim()
    },
    tempHint() {
      const t = this.form.temperature
      if (t <= 0.2) return '严格 / 稳定输出'
      if (t <= 0.5) return '平衡(推荐)'
      if (t <= 0.9) return '有创造力'
      return '随机性高,输出不稳定'
    }
  },
  watch: {
    activeTab(val) {
      try { window?.localStorage?.setItem(TAB_STORAGE_KEY, val) } catch {}
    },
    form: {
      deep: true,
      handler(val) {
        try { window?.localStorage?.setItem(STORAGE_KEY, JSON.stringify(val)) } catch {}
      }
    }
  },
  mounted() {
    // 恢复
    try {
      const saved = window?.localStorage?.getItem(STORAGE_KEY)
      if (saved) Object.assign(this.form, JSON.parse(saved))
      const tab = window?.localStorage?.getItem(TAB_STORAGE_KEY)
      if (tab && this.tabs.find(t => t.id === tab)) this.activeTab = tab
    } catch {}
  },
  methods: {
    reset() {
      this.form = defaultForm()
      this.activeTab = 'basics'
      try { window?.localStorage?.removeItem(STORAGE_KEY) } catch {}
    },
    onCreate() {
      // demo:仅 console + toast
      try {
        import('../utils/toastService.js').then(m => {
          m.default.success(`已创建(demo)`, { detail: this.form.name })
        })
      } catch {}
      // eslint-disable-next-line no-console
      console.info('[AssistantFormDemo] 创建', this.form)
    },
    onRecommend() {
      try {
        import('../utils/toastService.js').then(m => {
          m.default.info('推荐功能在主面板生效', { detail: '本 demo 仅展示布局' })
        })
      } catch {}
    },
    goBack() {
      if (window.history.length > 1) window.history.back()
      else this.$router.push('/')
    }
  }
}
</script>

<style scoped>
.afd-page {
  max-width: 920px;
  margin: 0 auto;
  padding: 20px 24px 60px;
  font-family: var(--font-base);
  color: var(--color-text-primary);
}
.afd-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}
.afd-head h1 { margin: 0 0 4px; font-size: 22px; font-weight: 700; }
.afd-head .subtitle { margin: 0; font-size: 13px; color: var(--color-text-secondary); }
.afd-back {
  padding: 6px 12px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

/* sticky 顶部条 */
.afd-stickybar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  background: var(--color-bg-elevated, #fff);
  border-bottom: 1px solid var(--chy-ink-200, #e6e8ec);
  margin-bottom: 16px;
  flex-wrap: wrap;
}

/* tab */
.afd-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
}
.afd-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: all 160ms;
}
.afd-tab:hover { background: var(--chy-ink-50, #f6f7f9); }
.afd-tab.active {
  background: var(--chy-violet-100, #ebe7fa);
  color: var(--chy-violet-700, #5d4ec0);
}
.afd-tab-icon { font-size: 14px; }
.afd-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px; height: 16px;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 700;
}
.afd-tab-badge.ok { background: var(--chy-celadon-500, #3fae82); color: #fff; }
.afd-tab-badge.pending { background: var(--chy-amber-500, #d4a017); color: #fff; }

/* actions */
.afd-actions { display: flex; gap: 8px; }
.afd-btn {
  padding: 7px 14px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 160ms;
}
.afd-btn:hover:not(:disabled) { background: var(--chy-ink-50, #f6f7f9); }
.afd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.afd-btn.ghost { background: transparent; }
.afd-btn.primary {
  background: var(--chy-violet-500, #7c6cdc);
  border-color: var(--chy-violet-500, #7c6cdc);
  color: #fff;
}
.afd-btn.primary:hover:not(:disabled) { background: var(--chy-violet-600, #6f5fd0); }

/* body */
.afd-body { display: block; }
.afd-section { display: flex; flex-direction: column; gap: 14px; }

/* row + label + field */
.afd-row {
  display: grid;
  grid-template-columns: 110px 1fr;
  column-gap: 14px;
  align-items: start;
}
.afd-row-double {
  grid-template-columns: 110px 1fr 110px 1fr;
}
.afd-label {
  padding-top: 9px;
  text-align: right;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}
.afd-label[data-required]::after {
  content: ' *';
  color: var(--chy-rouge-500, #e26a58);
  font-weight: 700;
}
.afd-field {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.afd-input {
  flex: 1;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 6px;
  font-size: 13px;
  background: var(--color-bg-elevated, #fff);
  color: var(--color-text-primary);
  font-family: inherit;
}
.afd-input:focus {
  outline: none;
  border-color: var(--chy-violet-400, #a397e8);
  box-shadow: 0 0 0 3px rgba(124, 108, 220, 0.08);
}
.afd-textarea {
  font-family: var(--font-mono);
  background: var(--chy-ink-50, #fafbfc);
  line-height: 1.55;
  resize: vertical;
}
.afd-textarea-prompt { border-left: 3px solid var(--chy-violet-400, #a397e8); }

/* tooltip */
:deep(.afd-tooltip) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: var(--chy-ink-100, #f0f1f4);
  color: var(--color-text-muted);
  font-size: 11px;
  cursor: help;
  user-select: none;
}
:deep(.afd-tooltip):hover { background: var(--chy-violet-100, #ebe7fa); color: var(--chy-violet-600, #6f5fd0); }

/* icon row */
.afd-icon-row { gap: 12px; }
.afd-icon-preview {
  width: 40px; height: 40px;
  border-radius: 8px;
  background: var(--chy-ink-50, #f6f7f9);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}
.afd-icon-emojis { display: flex; flex-wrap: wrap; gap: 4px; flex: 1; }
.afd-icon-pick {
  width: 32px; height: 32px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
}
.afd-icon-pick.active { border-color: var(--chy-violet-500, #7c6cdc); background: var(--chy-violet-100, #ebe7fa); }
.afd-icon-pick:hover { background: var(--chy-ink-50, #f6f7f9); }

/* recommend card */
.afd-recommend-card {
  grid-column: 1 / -1;
  margin-top: 8px;
  padding: 14px 16px;
  border: 1px solid var(--chy-violet-200, #d4cbf2);
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(124, 108, 220, 0.04), rgba(124, 108, 220, 0.01));
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.afd-recommend-head { display: flex; align-items: center; gap: 12px; }
.afd-recommend-icon { font-size: 22px; }
.afd-recommend-title { font-size: 13px; font-weight: 600; color: var(--chy-violet-700, #5d4ec0); }
.afd-recommend-sub { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }
.afd-recommend-head .afd-btn { margin-left: auto; }

/* temperature */
.afd-temperature { display: flex; align-items: center; gap: 12px; flex: 1; }
.afd-temperature input[type="range"] { flex: 1; }
.afd-temp-value {
  display: inline-block;
  min-width: 30px;
  text-align: center;
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 13px;
  color: var(--chy-violet-600, #6f5fd0);
}
.afd-temp-hint { font-size: 11px; color: var(--color-text-muted); }

/* checkboxes */
.afd-checkboxes { display: flex; flex-wrap: wrap; gap: 12px; }
.afd-check { font-size: 13px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }

/* switch */
.afd-switch { position: relative; display: inline-flex; align-items: center; cursor: pointer; }
.afd-switch input { display: none; }
.afd-switch span {
  width: 36px; height: 20px;
  border-radius: 10px;
  background: var(--chy-ink-300, #c5c8cf);
  position: relative;
  transition: background 200ms;
}
.afd-switch span::after {
  content: '';
  position: absolute;
  top: 2px; left: 2px;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 200ms;
}
.afd-switch input:checked + span { background: var(--chy-violet-500, #7c6cdc); }
.afd-switch input:checked + span::after { transform: translateX(16px); }

/* preset grid */
.afd-preset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px; margin-top: 8px; }
.afd-preset-btn {
  padding: 6px 10px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: var(--color-bg-elevated, #fff);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}
.afd-preset-btn:hover { background: var(--chy-ink-50, #f6f7f9); border-color: var(--chy-violet-400, #a397e8); }

.afd-sub-hint { margin: 0 0 8px; font-size: 11px; color: var(--color-text-muted); }

.afd-footnote {
  margin-top: 28px;
  padding: 10px;
  text-align: center;
  font-size: 11px;
  color: var(--color-text-muted);
  font-style: italic;
}

/* 小屏 fallback 单栏 */
@media (max-width: 720px) {
  .afd-row, .afd-row-double {
    grid-template-columns: 1fr;
  }
  .afd-label { text-align: left; padding-top: 0; }
}
</style>
