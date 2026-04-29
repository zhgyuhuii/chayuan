<!--
  WelcomePage — /welcome 路由

  v2 计划 P2「欢迎页重构」。比 WelcomeBanner 更完整,做 5 步 onboarding:
    1. 选默认模型(从 /settings 跳转)
    2. 启动进化系统(evo.boot)
    3. 浏览市场(/marketplace)
    4. 看进化中心(/evolution)
    5. 看延迟监控(/perf)

  顺序步骤推进,每步可以"跳过";所有步骤完成后写入 localStorage 永久 dismiss。
-->
<template>
  <div class="wp">
    <header class="wp-head">
      <div class="wp-logo chy-ai-aura" data-ai-state="streaming">✨</div>
      <h1>欢迎使用察元</h1>
      <p>5 步配置完成后,你将获得「键盘可达 + 自我进化 + 实时观测」的 AI 文档助手。</p>
    </header>

    <ol class="wp-steps">
      <li
        v-for="(step, idx) in steps"
        :key="step.id"
        class="wp-step"
        :class="{ active: idx === currentIdx, done: step.done, future: idx > currentIdx }"
      >
        <div class="wp-step-num">{{ step.done ? '✓' : (idx + 1) }}</div>
        <div class="wp-step-body">
          <h3>{{ step.title }}</h3>
          <p>{{ step.detail }}</p>
          <div v-if="idx === currentIdx" class="wp-step-actions">
            <button class="wp-btn primary" @click="step.action">{{ step.actionLabel }}</button>
            <button class="wp-btn ghost" @click="onSkip(idx)">跳过</button>
          </div>
        </div>
      </li>
    </ol>

    <footer v-if="allDone" class="wp-done">
      <h2>完成 ✨</h2>
      <p>本页不会再次显示。任何时候可在 ⌘K 输入 “welcome” 重新打开本指引。</p>
      <button class="wp-btn primary" @click="onFinish">进入主界面</button>
    </footer>
    <footer v-else class="wp-skip-all">
      <button class="wp-btn link" @click="onSkipAll">全部跳过</button>
    </footer>
  </div>
</template>

<script>
import { resolveCurrentModel, tryAutoBoot } from '../utils/assistant/evolution/bootHelpers.js'
import { getEvolutionStatus } from '../utils/assistant/evolution/evolutionBoot.js'
import { t } from '../utils/i18n.js'

const STORAGE_KEY = 'chayuanWelcomePage_v1'

export default {
  name: 'WelcomePage',
  computed: {
    steps() {
      const arr = [
        {
          id: 'pick-model',
          title: '1. 选默认模型',
          detail: '在设置中选一个 chat 模型(OpenAI / Claude / Qwen / DeepSeek / 等)。后续所有助手默认使用此模型。',
          actionLabel: '前往设置',
          action: () => this.goto('/settings')
        },
        {
          id: 'boot-evolution',
          title: '2. 启动进化系统',
          detail: '基于刚选的默认模型自动接线;失败则提示。进化系统会跟踪助手健康分,在跌破阈值时自动迭代。',
          actionLabel: '立即启动',
          action: this.onBoot
        },
        {
          id: 'visit-marketplace',
          title: '3. 浏览助手市场',
          detail: '查看 18 + 个内置助手 + 第三方扩展;按需启用。每条助手都标注了适用场景。',
          actionLabel: '打开市场',
          action: () => this.goto('/marketplace')
        },
        {
          id: 'visit-evolution',
          title: '4. 进化中心总览',
          detail: '看每个助手的 R/A/C/E 健康分 + 14 天心电图;一键触发评估或回滚。',
          actionLabel: '打开进化中心',
          action: () => this.goto('/evolution')
        },
        {
          id: 'visit-perf',
          title: '5. LLM 延迟监控',
          detail: 'enhancedChatApi 每次调用的 P50/P95/P99,按 kind 和 model 分维度。配 parallelChunks 后能看到并发收益。',
          actionLabel: '打开延迟监控',
          action: () => this.goto('/perf')
        },
        {
          id: 'visit-orchestration',
          title: '6. 多助手任务编排',
          detail: '把多个助手 / 工作流串成一条流水线,一键跑出报告。28 类节点(并行 / 循环 / 条件 / 子工作流 / 沙箱代码 / RAG / 多模态)随用随接。',
          actionLabel: '打开任务编排',
          action: () => this.goto('/task-orchestration')
        }
      ]
      return arr.map((s, i) => ({ ...s, done: this.stepDone[i] }))
    },
    allDone() {
      return this.stepDone.every(Boolean)
    }
  },
  data() {
    return {
      currentIdx: 0,
      stepDone: [false, false, false, false, false, false]
    }
  },
  mounted() {
    // 自动检测已完成的步骤(模型已选 → step1 done;evolution 已 boot → step2 done)
    if (resolveCurrentModel()) this.markDone(0)
    if (getEvolutionStatus().booted) this.markDone(1)
    this.advanceCursor()
  },
  methods: {
    advanceCursor() {
      const idx = this.stepDone.findIndex(d => !d)
      this.currentIdx = idx < 0 ? this.stepDone.length : idx
    },
    markDone(idx) {
      const next = [...this.stepDone]
      next[idx] = true
      this.stepDone = next
      this.advanceCursor()
    },
    onSkip(idx) {
      this.markDone(idx)
    },
    onSkipAll() {
      this.stepDone = [true, true, true, true, true]
      this.advanceCursor()
    },
    /** i18n 入口暴露给 template(给后续国际化迁移用) */
    tt(key) { return t(key) },
    onBoot() {
      const stop = tryAutoBoot()
      if (stop) this.markDone(1)
      else this.goto('/settings')   // 没 model → 跳设置
    },
    goto(path) {
      // 标记当前步骤为完成,然后导航
      const idx = this.steps.findIndex(s => {
        if (s.id === 'pick-model') return path === '/settings'
        if (s.id === 'visit-marketplace') return path === '/marketplace'
        if (s.id === 'visit-evolution') return path === '/evolution'
        if (s.id === 'visit-perf') return path === '/perf'
        return false
      })
      if (idx >= 0) this.markDone(idx)
      this.$router.push(path)
    },
    onFinish() {
      try { window?.localStorage?.setItem(STORAGE_KEY, '1') } catch {}
      this.$router.push('/')
    }
  }
}
</script>

<style scoped>
.wp {
  max-width: 720px;
  margin: 0 auto;
  padding: 40px 24px 60px;
  font-family: var(--font-base);
  color: var(--color-text-primary);
}
.wp-head {
  text-align: center;
  margin-bottom: 32px;
}
.wp-head h1 { margin: 12px 0 8px; font-size: 28px; font-weight: 700; letter-spacing: -0.01em; }
.wp-head p { margin: 0; color: var(--color-text-secondary); font-size: 14px; }

.wp-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  font-size: 28px;
  border-radius: 50%;
  background: rgba(124, 108, 220, 0.10);
  border: 1px solid rgba(124, 108, 220, 0.25);
}

.wp-steps {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.wp-step {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 10px;
  background: var(--color-bg-elevated, #fff);
  transition: opacity 200ms, border-color 200ms;
}
.wp-step.future { opacity: 0.55; }
.wp-step.active { border-color: var(--chy-violet-400, #a397e8); box-shadow: 0 2px 8px rgba(124, 108, 220, 0.06); }
.wp-step.done { opacity: 0.8; }

.wp-step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 13px;
  background: var(--chy-ink-100, #f0f1f4);
  color: var(--color-text-muted);
}
.wp-step.active .wp-step-num { background: var(--chy-violet-500, #7c6cdc); color: #fff; }
.wp-step.done .wp-step-num { background: var(--chy-celadon-500, #3fae82); color: #fff; }

.wp-step-body h3 { margin: 0 0 4px; font-size: 15px; font-weight: 600; }
.wp-step-body p { margin: 0; font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; }

.wp-step-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.wp-btn {
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 160ms;
}
.wp-btn:hover { background: var(--chy-ink-50, #f6f7f9); }
.wp-btn.primary { background: var(--chy-violet-500, #7c6cdc); border-color: var(--chy-violet-500, #7c6cdc); color: #fff; }
.wp-btn.primary:hover { background: var(--chy-violet-600, #6f5fd0); }
.wp-btn.link { border: none; background: transparent; color: var(--color-text-muted); padding: 4px 8px; }
.wp-btn.link:hover { color: var(--color-text-primary); text-decoration: underline; }

.wp-done, .wp-skip-all {
  text-align: center;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--chy-ink-200, #e6e8ec);
}
.wp-done h2 { margin: 0 0 8px; font-size: 22px; }
.wp-done p { margin: 0 0 16px; font-size: 13px; color: var(--color-text-secondary); }
</style>
