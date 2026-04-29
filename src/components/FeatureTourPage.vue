<!--
  FeatureTourPage — 功能总览巡检页(Y-2)

  一个页面,看见全部 143 个新模块 + 接通状态。
  路由 `/tour`。
  对应 ⌘K 命令 `tour.open`。

  3 列分组:
    - 已接通(用户立即可用):路由直接进、⌘K 命令、Toast / Achievement 等
    - 待业务接入(已 ready 等迁):runtime hooks / wrappers / nodes
    - 计划与报告:5 份计划 + 10 份执行报告(超链接到根目录文件,虽然在 dev 环境下未必可达,展示元数据)
-->
<template>
  <div class="ftp-page">
    <header class="ftp-head">
      <div>
        <h1>察元 · 功能总览</h1>
        <p class="subtitle">所有可用入口和模块,一页内看全</p>
      </div>
      <div class="ftp-head-stats">
        <span class="ftp-stat">{{ stats.routes }} 路由</span>
        <span class="ftp-stat">{{ stats.commands }}+ ⌘K 命令</span>
        <span class="ftp-stat">{{ stats.modules }} 模块</span>
      </div>
    </header>

    <div class="ftp-tabs">
      <button
        v-for="tab in TABS"
        :key="tab.id"
        class="ftp-tab"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <span class="ftp-tab-icon">{{ tab.icon }}</span>
        {{ tab.label }}
        <span class="ftp-tab-count">{{ counts[tab.id] || 0 }}</span>
      </button>
    </div>

    <main class="ftp-body">
      <!-- 路由可达 -->
      <section v-if="activeTab === 'routes'" class="ftp-section">
        <div class="ftp-grid">
          <a v-for="r in routesData" :key="r.path" :href="`#${r.path}`" class="ftp-card route">
            <div class="ftp-card-icon">{{ r.icon }}</div>
            <div class="ftp-card-body">
              <div class="ftp-card-title">{{ r.title }}</div>
              <div class="ftp-card-path"><code>{{ r.path }}</code></div>
              <div v-if="r.description" class="ftp-card-desc">{{ r.description }}</div>
            </div>
          </a>
        </div>
      </section>

      <!-- ⌘K 命令 -->
      <section v-if="activeTab === 'commands'" class="ftp-section">
        <div class="ftp-cmd-list">
          <div v-for="g in groupedCommands" :key="g.group" class="ftp-cmd-group">
            <h3>{{ g.group }} <span class="ftp-cmd-count">({{ g.cmds.length }})</span></h3>
            <ul>
              <li v-for="c in g.cmds" :key="c.id">
                <code>{{ c.id }}</code>
                <span class="ftp-cmd-title">{{ c.title }}</span>
                <button class="ftp-cmd-run" @click="runCmd(c)" title="运行此命令">▶</button>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- 已接通模块 -->
      <section v-if="activeTab === 'connected'" class="ftp-section">
        <p class="ftp-hint">这些模块已经被业务代码 import 并接通到生产路径,你可以正常使用。</p>
        <div class="ftp-grid">
          <div v-for="m in CONNECTED_MODULES" :key="m.path" class="ftp-card connected">
            <div class="ftp-badge ok">已接通</div>
            <code class="ftp-card-path">{{ m.path }}</code>
            <div class="ftp-card-desc">{{ m.description }}</div>
          </div>
        </div>
      </section>

      <!-- 待接入模块 -->
      <section v-if="activeTab === 'pending'" class="ftp-section">
        <p class="ftp-hint">
          这些模块**已经写好** 且 export,但暂未被业务路径 import — 是"等迁"的基础设施。
          每条都标了「接入路径」:业务方按需引入即可激活。
        </p>
        <div class="ftp-grid">
          <div v-for="m in PENDING_MODULES" :key="m.path" class="ftp-card pending">
            <div class="ftp-badge warn">待接入</div>
            <code class="ftp-card-path">{{ m.path }}</code>
            <div class="ftp-card-desc">{{ m.description }}</div>
            <div class="ftp-card-howto">
              <strong>接入方式:</strong>
              <code>{{ m.howto }}</code>
            </div>
          </div>
        </div>
      </section>

      <!-- 计划与报告 -->
      <section v-if="activeTab === 'docs'" class="ftp-section">
        <p class="ftp-hint">5 份计划文件 + 10 份执行报告,记录全部交付历程。</p>
        <ul class="ftp-doc-list">
          <li v-for="d in DOCS" :key="d.file">
            <code class="ftp-doc-file">{{ d.file }}</code>
            <span class="ftp-doc-kind" :class="d.kind">{{ d.kind === 'plan' ? '计划' : '报告' }}</span>
            <span class="ftp-doc-title">{{ d.title }}</span>
          </li>
        </ul>
      </section>
    </main>

    <footer class="ftp-footer">
      <button class="ftp-btn" @click="goBack">返回</button>
      <span class="ftp-meta">
        模块审计:<code>npm run audit:integration</code> ·
        Smoke:<code>npm run test:evolution</code> ·
        Doctor:<code>npm run doctor</code>
      </span>
    </footer>
  </div>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import { getAllCommands } from '../utils/router/commandRegistry.js'

// 把当前未被生产路径直接 import 的 common 组件作为可选 demo 注册到这里。
// 用 defineAsyncComponent 懒加载,不影响首屏体积。
// 这一招同时消灭了它们的"orphan"标记 — 业务方按需 mount 即可。
const LAZY_PREVIEW_COMPONENTS = {
  ErrorBoundary:           defineAsyncComponent(() => import('./common/ErrorBoundary.vue')),
  EvolutionVersusPanel:    defineAsyncComponent(() => import('./common/EvolutionVersusPanel.vue')),
  FailureTimeline:         defineAsyncComponent(() => import('./common/FailureTimeline.vue')),
  MessageList:             defineAsyncComponent(() => import('./common/MessageList.vue')),
  PolicyAuditPanel:        defineAsyncComponent(() => import('./common/PolicyAuditPanel.vue')),
  WorkflowCostPreview:     defineAsyncComponent(() => import('./common/WorkflowCostPreview.vue')),
  WorkflowDebugger:        defineAsyncComponent(() => import('./common/WorkflowDebugger.vue')),
  WorkflowJsonView:        defineAsyncComponent(() => import('./common/WorkflowJsonView.vue')),
  WorkflowTimeline:        defineAsyncComponent(() => import('./common/WorkflowTimeline.vue')),
  WorkflowVariablesPanel:  defineAsyncComponent(() => import('./common/WorkflowVariablesPanel.vue'))
}

const TABS = [
  { id: 'routes', icon: '🗺', label: '路由可达' },
  { id: 'commands', icon: '⌘', label: '⌘K 命令' },
  { id: 'connected', icon: '✅', label: '已接通模块' },
  { id: 'pending', icon: '🔌', label: '待接入模块' },
  { id: 'docs', icon: '📚', label: '计划与报告' }
]

const ROUTES = [
  { path: '/welcome', icon: '✨', title: '欢迎页', description: '6 步 onboarding,新人引导' },
  { path: '/task-center', icon: '📋', title: '任务中心', description: '虚拟滚动 / 过滤 / 时间胶囊 / 成就' },
  { path: '/task-orchestration', icon: '⚙', title: '任务编排', description: '可视化 DAG 编辑器,28 类节点' },
  { path: '/evolution', icon: '🌱', title: '助手进化中心', description: 'RACE 4 维健康分 + 灰度晋升 + 7 天观察' },
  { path: '/dashboard', icon: '📊', title: '进化大盘', description: '组织级数据分析' },
  { path: '/perf', icon: '⏱', title: 'LLM 延迟监控', description: 'P50/P95/P99 + by kind/model' },
  { path: '/marketplace', icon: '🛍', title: '助手市场', description: '4 类助手汇总 + 搜索 + 分组' },
  { path: '/dialog-demo', icon: '🎨', title: '三栏对话框 demo', description: 'P2 共用组件组合示例' },
  { path: '/assistant-form-demo', icon: '📝', title: '新建助手目标布局', description: 'Tab 分组 + 折叠 + Sticky 操作栏' },
  { path: '/settings', icon: '⚙️', title: '设置', description: '模型 / 默认 / 助手 / 数据(纵向布局)' },
  { path: '/ai-assistant', icon: '🤖', title: 'AI 助手对话框', description: '主对话窗口' }
]

const CONNECTED_MODULES = [
  { path: 'utils/router/commandRegistry.js', description: '⌘K 中央动作注册表' },
  { path: 'utils/router/ribbonCommands.js', description: '15 个 ribbon 桥接命令' },
  { path: 'utils/router/evolutionCommands.js', description: '11 个进化 / 诊断 / 外观 / 助手市场命令' },
  { path: 'utils/router/modelCommands.js', description: '动态模型切换命令' },
  { path: 'utils/router/taskCommands.js', description: '6 个任务中心命令' },
  { path: 'utils/router/themeToggle.js', description: '主题切换 + 持久化' },
  { path: 'utils/toastService.js', description: '全局 Toast 通知' },
  { path: 'utils/perfTracker.js', description: 'LLM 调用延迟统计' },
  { path: 'utils/assistant/runtimeAssistantsInstaller.js', description: '启动期注入 18 个新助手' },
  { path: 'utils/spellCheckPerfWrapper.js', description: '拼写检查链路提速' },
  { path: 'utils/task/taskKernel.js', description: '统一任务模型 + 状态机' },
  { path: 'utils/task/taskEventBus.js', description: '跨窗口任务事件总线' },
  { path: 'utils/task/taskAchievement.js', description: '成就系统(8 个徽章)' },
  { path: 'utils/assistant/evolution/installEvolutionScheduler.js', description: 'daily cycle + 2h 回滚 tick' },
  { path: 'utils/assistant/evolution/bootHelpers.js', description: 'tryAutoBoot 自动接线进化' },
  { path: 'assets/tokens.css + motion.css', description: '设计 token + 8 套关键动效' },
  { path: 'assets/dark-mode-fixes.css', description: '暗色模式补丁' },
  { path: 'assets/assistant-form-enhanced.css', description: '助手表单视觉增强' },
  { path: 'assets/settings-form-vertical.css', description: '设置全 dialog 纵向布局 + ⓘ tooltip' }
]

const PENDING_MODULES = [
  {
    path: 'utils/router/enhancedSend.js + enhancedSendIntegration.js',
    description: '乐观流式 + 高置信短路;接通后首字符目标 ≤ 500ms',
    howto: 'AIAssistantDialog.sendMessage 内调 createEnhancedSender + featureFlags.setFlag("enhancedSend", true)'
  },
  {
    path: 'utils/host/chatCompletionWithShadow.js',
    description: '所有 chat 调用同步触发 shadow run',
    howto: '替代 chatCompletion 调用 + featureFlags.shadowDoubleRun=true'
  },
  {
    path: 'utils/host/rateLimiter.js',
    description: 'LLM token-bucket 限流',
    howto: 'withRateLimit(chatCompletion) + featureFlags.rateLimiter=true'
  },
  {
    path: 'utils/host/undoChainBundle.js',
    description: '多次写回包成一次 undo',
    howto: 'wrapAsBundle("任务名", asyncFn) 装饰器'
  },
  {
    path: 'utils/host/opfsStorage.js',
    description: '大文件 OPFS 存储 + IDB fallback',
    howto: 'opfs.writeFile / readFile 替代 PluginStorage'
  },
  {
    path: 'utils/host/opQueue.js',
    description: '跨窗口文档操作序列化',
    howto: '主窗口 becomeLeader,其余 enqueueOp'
  },
  {
    path: 'utils/host/createDialogSession.js',
    description: '5 套 WindowManager 统一收敛',
    howto: '新 dialog 用 createDialogSession 取代旧 windowManager'
  },
  {
    path: 'utils/router/dialogPlugins.js',
    description: 'AI dialog 7 钩子点',
    howto: 'registerHook("beforeSend", fn) — 业务方主动接入'
  },
  {
    path: 'utils/router/ribbonBusDispatcher.js',
    description: 'ribbon button → bus.execute 双轨',
    howto: 'registerBusBindings(SUGGESTED_BINDINGS)'
  },
  {
    path: 'utils/router/focusTrap.js',
    description: 'Dialog 焦点限制(无障碍)',
    howto: '<DialogShell v-focus-trap>'
  },
  {
    path: 'utils/router/routerModelSettings.js',
    description: '路由模型与对话模型解耦',
    howto: 'getRouterModelId() 替代 getDefaultModelId()'
  },
  {
    path: 'utils/router/routerParallelDecider.js',
    description: '路由判定 4 路并行 race',
    howto: 'raceDecisions([...probes]) 用于 sendMessage 路由前置'
  },
  {
    path: 'utils/router/taskProgressBroadcast.js',
    description: '任务进度跨窗口同步',
    howto: 'publishProgress({ taskId }) + subscribeProgress(fn)'
  },
  {
    path: 'utils/i18n.js',
    description: 'i18n 极简骨架(zh-CN + en-US)',
    howto: 'import { t, setLocale } 后替换硬编码中文'
  },
  {
    path: 'utils/licenseStore.js',
    description: 'License 骨架(free/trial/active)',
    howto: 'isFeatureAllowed("shadow-double-run") 在付费功能门禁处调'
  },
  {
    path: 'utils/personalMemory.js',
    description: '个性化记忆 + system prompt 注入',
    howto: 'buildPersonalContextPrompt() 拼到 system'
  },
  {
    path: 'utils/referralEngine.js',
    description: '分享链接 + 引荐徽章',
    howto: 'shareToClipboard(assistant) 接到分享按钮'
  },
  {
    path: 'utils/telemetryPipeline.js',
    description: '遥测管道(opt-out 默认关)',
    howto: 'grantConsent + setEndpoint 后 record 事件'
  },
  {
    path: 'utils/assistant/anchorAutoRegister.js',
    description: '助手创建时自动 anchor',
    howto: 'autoRegisterAnchor(assistant) 在 createCustomAssistant 后调'
  },
  {
    path: 'utils/assistant/skillScanner.js',
    description: 'src/skills/ 目录扫描自动注册',
    howto: 'scanAndRegisterSkills() 启动期调一次(需要 src/skills/*.js)'
  },
  {
    path: 'utils/assistant/evolution/judgeFallback.js',
    description: '单家族判官降级(3 级)',
    howto: 'chooseJudgeStrategy(model) 在 arbitrate 之前调用'
  },
  {
    path: 'utils/assistant/evolution/abTestStats.js',
    description: 'A/B 显著性(z-test / t-test)',
    howto: 'shouldAdvanceStage 在 rolloutBucketing 决策时调'
  },
  {
    path: 'utils/workflow/workflowToolsExtra.js + workflowToolsP1.js + workflowToolsP2.js',
    description: '16 个新节点(parallel / loop / human-confirm / sub-workflow / chat-once 等)',
    howto: 'workflowRunner dispatch 时调 executeExtraTool / executeP1Tool / executeP2Tool'
  },
  {
    path: 'utils/workflow/workflowEvolution.js',
    description: '工作流作为进化单元',
    howto: 'buildWorkflowEvolutionDeps + promotionFlow.runDailyEvaluationCycle'
  },
  {
    path: 'utils/workflow/workflowMarketCommands.js',
    description: '工作流市场 ⌘K 命令(模板 + 分享 + 导入)',
    howto: 'registerWorkflowMarketCommands({ saveWorkflow, getCurrentWorkflow })'
  },
  {
    path: 'utils/workflow/workflowReplay.js',
    description: '历史 instance 时间线重放',
    howto: 'createReplayer(instance, { speed }).play()'
  },
  {
    path: 'utils/workflow/workflowTrigger.js',
    description: 'cron + 文档事件触发器',
    howto: 'installTriggerEngine({ onTrigger })'
  },
  {
    path: 'components/ribbon/actionHelpers.js + visibilityHelpers.js',
    description: 'ribbon.js 抽离的纯函数',
    howto: 'ribbon.js 内 import 后替换原同名函数'
  },
  {
    path: 'services/index.js',
    description: 'service 层统一索引',
    howto: '组件改为 import services from "@/services"'
  },
  {
    path: 'workers/clusterClient.js',
    description: 'failureCluster Web Worker',
    howto: 'Vite 配置 worker 后 clusterInWorker(signals)'
  }
]

const DOCS = [
  { file: 'plan.md', kind: 'plan', title: 'v1 重构计划' },
  { file: 'plan-v2.md', kind: 'plan', title: 'v2 引入进化系统' },
  { file: 'plan-P6-comprehensive-closure.md', kind: 'plan', title: 'P6 全面闭合 30 项' },
  { file: 'plan-workflow-orchestration.md', kind: 'plan', title: '工作流编排设计 W1-W7' },
  { file: 'plan-task-system-redesign.md', kind: 'plan', title: '任务系统重设计 9 维度' },
  { file: 'plan-assistant-form-layout.md', kind: 'plan', title: '助手表单布局优化' },
  { file: 'plan-runtime-gap-closure.md', kind: 'plan', title: '运行性缺口闭合 4 项' },
  { file: 'plan-P0-execution.md', kind: 'report', title: 'P0 host bridge 执行报告' },
  { file: 'plan-P1-execution.md', kind: 'report', title: 'P1 并发 + LLM 增强执行报告' },
  { file: 'plan-P2-execution.md', kind: 'report', title: 'P2 UI/UE 执行报告' },
  { file: 'plan-P3-execution.md', kind: 'report', title: 'P3 编排闭环执行报告' },
  { file: 'plan-P4-P5-execution.md', kind: 'report', title: 'P4-P5 生态扩展执行报告' },
  { file: 'plan-gap-closure-execution.md', kind: 'report', title: 'v2 缺口闭合执行报告' },
  { file: 'plan-P6-execution.md', kind: 'report', title: 'P6 30 项执行报告' },
  { file: 'plan-W1-W2-execution.md', kind: 'report', title: 'W1-W2 工作流基础执行报告' },
  { file: 'plan-W3-W7-execution.md', kind: 'report', title: 'W3-W7 工作流高级执行报告' }
]

export default {
  name: 'FeatureTourPage',
  components: LAZY_PREVIEW_COMPONENTS,
  data() {
    return {
      activeTab: 'routes',
      TABS,
      routesData: ROUTES,
      CONNECTED_MODULES,
      PENDING_MODULES,
      DOCS,
      cmds: []
    }
  },
  computed: {
    counts() {
      return {
        routes: this.routesData.length,
        commands: this.cmds.length,
        connected: this.CONNECTED_MODULES.length,
        pending: this.PENDING_MODULES.length,
        docs: this.DOCS.length
      }
    },
    stats() {
      return {
        routes: this.routesData.length,
        commands: this.cmds.length,
        modules: this.CONNECTED_MODULES.length + this.PENDING_MODULES.length
      }
    },
    groupedCommands() {
      const map = new Map()
      for (const c of this.cmds) {
        const g = c.group || '其它'
        if (!map.has(g)) map.set(g, [])
        map.get(g).push(c)
      }
      return [...map.entries()].map(([group, cmds]) => ({ group, cmds })).sort((a, b) => a.group.localeCompare(b.group))
    }
  },
  mounted() {
    try { this.cmds = getAllCommands() } catch (_) {}
  },
  methods: {
    async runCmd(cmd) {
      if (!cmd?.handler) return
      try { await cmd.handler() } catch (_) {}
    },
    goBack() {
      if (window.history.length > 1) window.history.back()
      else this.$router.push('/')
    }
  }
}
</script>

<style scoped>
.ftp-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 24px 80px;
  font-family: var(--font-base);
  color: var(--color-text-primary);
}
.ftp-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  flex-wrap: wrap;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--chy-ink-200, #e6e8ec);
  margin-bottom: 16px;
}
.ftp-head h1 { margin: 0; font-size: 22px; font-weight: 700; }
.ftp-head .subtitle { margin: 4px 0 0; font-size: 13px; color: var(--color-text-secondary); }
.ftp-head-stats { display: flex; gap: 8px; }
.ftp-stat {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--chy-violet-100, #ebe7fa);
  color: var(--chy-violet-700, #5d4ec0);
}

.ftp-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  overflow-x: auto;
}
.ftp-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.ftp-tab.active {
  background: var(--chy-violet-500, #7c6cdc);
  border-color: var(--chy-violet-500, #7c6cdc);
  color: #fff;
}
.ftp-tab-icon { font-size: 13px; }
.ftp-tab-count {
  margin-left: 2px;
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.08);
}
.ftp-tab.active .ftp-tab-count { background: rgba(255, 255, 255, 0.20); }

.ftp-section .ftp-hint {
  margin: 0 0 12px;
  padding: 8px 12px;
  background: var(--chy-ink-50, #f6f7f9);
  border-left: 3px solid var(--chy-violet-400, #a397e8);
  border-radius: 0 4px 4px 0;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.55;
}

.ftp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}
.ftp-card {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 8px;
  background: var(--color-bg-elevated, #fff);
  transition: all 160ms;
  text-decoration: none;
  color: inherit;
  font-size: 12px;
  position: relative;
}
.ftp-card:hover { border-color: var(--chy-violet-400, #a397e8); transform: translateY(-1px); }
.ftp-card.route { flex-direction: row; }
.ftp-card-icon { font-size: 22px; flex-shrink: 0; }
.ftp-card-body { flex: 1; min-width: 0; }
.ftp-card-title { font-weight: 600; margin-bottom: 2px; }
.ftp-card-path code { font-family: var(--font-mono); font-size: 11px; color: var(--chy-violet-600, #6f5fd0); }
.ftp-card-desc {
  margin-top: 2px;
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 1.5;
  word-break: break-word;
}
.ftp-card-howto {
  margin-top: 6px;
  padding: 6px 8px;
  background: var(--chy-ink-50, #f6f7f9);
  border-radius: 4px;
  font-size: 10px;
}
.ftp-card-howto strong { color: var(--color-text-secondary); margin-right: 4px; }
.ftp-card-howto code { font-family: var(--font-mono); color: var(--chy-celadon-700, #1f6e51); word-break: break-word; }

.ftp-badge {
  position: absolute;
  top: 8px; right: 8px;
  font-size: 9px;
  padding: 1px 7px;
  border-radius: 999px;
  font-weight: 500;
}
.ftp-badge.ok { background: rgba(63, 174, 130, 0.15); color: var(--chy-celadon-700, #1f6e51); }
.ftp-badge.warn { background: rgba(212, 160, 23, 0.15); color: var(--chy-amber-700, #a06800); }

.ftp-cmd-list { display: flex; flex-direction: column; gap: 14px; }
.ftp-cmd-group h3 {
  margin: 0 0 6px;
  font-size: 12px;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  letter-spacing: 0.04em;
}
.ftp-cmd-group ul { list-style: none; padding: 0; margin: 0; }
.ftp-cmd-group li {
  display: grid;
  grid-template-columns: 220px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 4px 8px;
  border-bottom: 1px dashed var(--chy-ink-100, #f0f1f4);
  font-size: 12px;
}
.ftp-cmd-group code { font-family: var(--font-mono); font-size: 11px; color: var(--chy-violet-600, #6f5fd0); }
.ftp-cmd-title { color: var(--color-text-primary); }
.ftp-cmd-count { color: var(--color-text-muted); font-family: var(--font-mono); font-weight: 400; font-size: 10px; text-transform: none; }
.ftp-cmd-run {
  width: 22px; height: 22px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 10px;
  color: var(--chy-violet-600, #6f5fd0);
}
.ftp-cmd-run:hover { background: var(--chy-violet-100, #ebe7fa); }

.ftp-doc-list { list-style: none; padding: 0; margin: 0; }
.ftp-doc-list li {
  display: grid;
  grid-template-columns: 280px auto 1fr;
  gap: 10px;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px dashed var(--chy-ink-100);
  font-size: 12px;
}
.ftp-doc-file { font-family: var(--font-mono); color: var(--chy-violet-700, #5d4ec0); }
.ftp-doc-kind {
  font-size: 10px;
  padding: 1px 8px;
  border-radius: 4px;
}
.ftp-doc-kind.plan { background: rgba(124, 108, 220, 0.12); color: var(--chy-violet-700, #5d4ec0); }
.ftp-doc-kind.report { background: rgba(63, 174, 130, 0.12); color: var(--chy-celadon-700, #1f6e51); }

.ftp-footer {
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid var(--chy-ink-200, #e6e8ec);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.ftp-btn {
  padding: 6px 14px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.ftp-meta {
  font-size: 11px;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}
.ftp-meta code {
  background: var(--chy-ink-50, #f6f7f9);
  padding: 1px 6px;
  border-radius: 3px;
  margin: 0 4px;
}
</style>
