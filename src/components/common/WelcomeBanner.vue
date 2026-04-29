<!--
  WelcomeBanner — 「新功能引导横幅」

  在用户首次启动 + 还没明确点过"知道了"时,在主任务窗格顶部显示一条横幅,
  介绍 P3 阶段引入的几个新入口:
    - ⌘K 命令面板
    - /evolution 助手进化中心
    - /perf LLM 延迟监控
    - 主题切换

  设计:
    - 永不阻塞操作(下方内容继续可见,只占顶部 ~64px)
    - 一键关闭后,localStorage 记录 → 永不再显示
    - 用 P2 设计系统的色板 + 动效(chy-violet + chy-bubble-in)

  Props:
    storageKey   持久化 key,默认 'chayuanWelcomeBanner_v1'
                 想 force 重显新引导 → 改 v1 → v2 即可

  使用:
    <WelcomeBanner />   <!-- 任何路由顶部都可,自带 v-if="show" -->
-->
<template>
  <transition name="banner">
    <div v-if="show" class="welcome-banner chy-bubble-in" data-from="assistant">
      <div class="wb-icon">
        <span class="wb-icon-glow chy-ai-aura" data-ai-state="streaming">✨</span>
      </div>

      <div class="wb-body">
        <div class="wb-headline">察元焕新升级</div>
        <div class="wb-detail">
          <span class="wb-tip">
            <kbd>⌘</kbd><kbd>K</kbd> 唤起命令面板,所有功能键盘可达
          </span>
          <span class="wb-sep">·</span>
          <a href="#/evolution" class="wb-link">助手进化中心</a>
          <span class="wb-sep">·</span>
          <a href="#/perf" class="wb-link">LLM 延迟监控</a>
          <span class="wb-sep">·</span>
          <button type="button" class="wb-link wb-link-btn" @click.stop="onTryTheme">
            一键切换暗色
          </button>
        </div>
      </div>

      <button class="wb-close" @click="onDismiss" aria-label="知道了">
        <span aria-hidden="true">×</span>
      </button>
    </div>
  </transition>
</template>

<script>
import { toggleTheme } from '../../utils/router/themeToggle.js'

export default {
  name: 'WelcomeBanner',
  props: {
    storageKey: { type: String, default: 'chayuanWelcomeBanner_v1' },
    /** 默认 false:刷新后重新展示;true:首次展示后永久 dismiss */
    persistDismiss: { type: Boolean, default: true }
  },
  data() {
    return {
      show: !this.isDismissed()
    }
  },
  methods: {
    isDismissed() {
      if (!this.persistDismiss) return false
      try {
        return window?.localStorage?.getItem(this.storageKey) === '1'
      } catch { return false }
    },
    onDismiss() {
      this.show = false
      if (!this.persistDismiss) return
      try { window?.localStorage?.setItem(this.storageKey, '1') } catch {}
    },
    onTryTheme() {
      toggleTheme()
      // 不 dismiss — 让用户继续看
    }
  }
}
</script>

<style scoped>
.welcome-banner {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  margin: 12px 16px 0;
  border-radius: 12px;
  background: linear-gradient(
    100deg,
    rgba(124, 108, 220, 0.08) 0%,
    rgba(124, 108, 220, 0.04) 50%,
    rgba(63, 174, 130, 0.06) 100%
  );
  border: 1px solid rgba(124, 108, 220, 0.18);
  font-family: var(--font-base);
  color: var(--color-text-primary);
}

.wb-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wb-icon-glow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 18px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(124, 108, 220, 0.2);
}

.wb-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.wb-headline {
  font-size: var(--fz-13, 13px);
  font-weight: 600;
  letter-spacing: -0.005em;
}
.wb-detail {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: var(--fz-12, 12px);
  color: var(--color-text-secondary);
}
.wb-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.wb-tip kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  color: var(--chy-violet-700, #5d4ec0);
  background: rgba(124, 108, 220, 0.12);
  border: 1px solid rgba(124, 108, 220, 0.25);
  border-radius: 4px;
  line-height: 1;
}
.wb-sep {
  color: var(--chy-ink-300, #c5c8cf);
  user-select: none;
}
.wb-link, .wb-link-btn {
  color: var(--chy-violet-600, #6f5fd0);
  text-decoration: none;
  cursor: pointer;
  font-weight: 500;
  background: transparent;
  border: none;
  padding: 0;
  font: inherit;
  font-size: var(--fz-12, 12px);
}
.wb-link:hover, .wb-link-btn:hover {
  text-decoration: underline;
  color: var(--chy-violet-700, #5d4ec0);
}

.wb-close {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 18px;
  line-height: 1;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background 160ms;
}
.wb-close:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--color-text-primary);
}

/* 进/出场动画(transition name="banner") */
.banner-enter-active, .banner-leave-active {
  transition: opacity 280ms var(--chy-ease-out, cubic-bezier(.32,.72,0,1)),
              transform 280ms var(--chy-ease-out-spring, cubic-bezier(.34,1.56,.64,1));
}
.banner-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}
.banner-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
