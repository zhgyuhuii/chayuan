<!--
  TaskCelebration — 任务完成时的微动效(T-2.1)

  设计:
    - 屏幕右下角弹一个小卡片(150×60px)
    - chy-finish-sweep 扫光 + chy-pop 缩放
    - 800ms 后自动消失
    - 同时多个完成 → 排队 600ms 间隔依次播放
    - 失败的不弹(交给 toast 处理)

  挂在 App.vue 顶层(类似 ToastContainer)。订阅 taskEventBus,task:completed 触发。
-->
<template>
  <Teleport to="body">
    <transition-group name="tc-card" tag="div" class="tc-stack">
      <div
        v-for="card in cards"
        :key="card.id"
        class="tc-card chy-finish-sweep chy-pop"
      >
        <span class="tc-icon">✓</span>
        <div class="tc-body">
          <div class="tc-title">{{ card.title }}</div>
          <div v-if="card.duration" class="tc-meta">{{ formatDur(card.duration) }}</div>
        </div>
      </div>
    </transition-group>
  </Teleport>
</template>

<script>
import { onlyEvent } from '../../utils/task/taskEventBus.js'

const DISPLAY_MS = 1600  // 单卡显示时长
const STAGGER_MS = 400   // 多卡间隔

export default {
  name: 'TaskCelebration',
  data() {
    return { cards: [] }
  },
  mounted() {
    this._unsub = onlyEvent('task:completed', msg => {
      // 失败 / 取消 不弹
      if (msg.success === false) return
      this.enqueue({
        id: msg.taskId + '_celebrate',
        title: msg.title || '任务已完成',
        duration: msg.duration || 0
      })
    })
  },
  beforeUnmount() {
    this._unsub?.()
  },
  methods: {
    enqueue(card) {
      // 限制最多同屏 3 张,超过 squash
      if (this.cards.length >= 3) {
        this.cards = this.cards.slice(-2)
      }
      this.cards.push(card)
      setTimeout(() => {
        this.cards = this.cards.filter(c => c.id !== card.id)
      }, DISPLAY_MS)
    },
    formatDur(ms) {
      if (ms < 1000) return `${ms}ms`
      if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
      return `${Math.floor(ms / 60000)}m`
    }
  }
}
</script>

<style scoped>
.tc-stack {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9997;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.tc-card {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 999px;
  background: linear-gradient(
    100deg,
    rgba(63, 174, 130, 0.95) 0%,
    rgba(99, 195, 154, 0.95) 100%
  );
  color: #fff;
  font-family: var(--font-base);
  font-size: 12px;
  font-weight: 500;
  box-shadow: 0 6px 20px rgba(63, 174, 130, 0.30);
  pointer-events: auto;
  position: relative;
  overflow: hidden;
}

.tc-icon {
  width: 20px; height: 20px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 11px;
  flex-shrink: 0;
}

.tc-body { display: flex; flex-direction: column; gap: 1px; }
.tc-title { line-height: 1.3; white-space: nowrap; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
.tc-meta { font-size: 10px; opacity: 0.85; font-family: var(--font-mono); }

/* transition */
.tc-card-enter-active {
  transition: transform 320ms var(--chy-ease-out-spring, cubic-bezier(.34,1.56,.64,1)),
              opacity 320ms;
}
.tc-card-leave-active {
  transition: transform 280ms var(--chy-ease-out, cubic-bezier(.32,.72,0,1)),
              opacity 280ms;
}
.tc-card-enter-from {
  transform: translateY(16px) scale(0.85);
  opacity: 0;
}
.tc-card-leave-to {
  transform: translateY(-8px) scale(0.95);
  opacity: 0;
}
</style>
