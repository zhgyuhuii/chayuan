<!--
  WorkflowResumeDialog — 启动期检测未完成工作流并提示用户

  挂在 App.vue 顶层(类似 ToastContainer),mount 时自动扫一次。
  扫到可恢复的 instance(status=running 且 ownerWindow 已死)→ 弹对话框,
  让用户选择 [恢复] / [丢弃] / [稍后再说]。

  用户决策:
    - 恢复:把 instance 的 status 维持 running,owner 改为本窗口,触发 workflowRunner.resume
    - 丢弃:setStatus 'cancelled' + 清 undo bundle
    - 稍后:不动,instance 保持原状,下次启动再问
-->
<template>
  <Teleport v-if="show" to="body">
    <div class="wfr-overlay" @click.self="onClose">
      <div class="wfr-dialog" role="dialog" aria-labelledby="wfr-title">
        <header class="wfr-head">
          <span class="wfr-icon">⏸</span>
          <h3 id="wfr-title">检测到 {{ resumable.length }} 个未完成的工作流</h3>
        </header>

        <div class="wfr-body">
          <p class="wfr-hint">
            上次会话期间这些工作流没有跑完。可以选择恢复继续,或者丢弃(已写入文档的部分会被回滚)。
          </p>

          <ul class="wfr-list">
            <li
              v-for="inst in resumable"
              :key="inst.id"
              class="wfr-item"
              :class="{ selected: selected === inst.id }"
              @click="selected = inst.id"
            >
              <div class="wfr-item-head">
                <span class="wfr-item-name">{{ resolveName(inst) }}</span>
                <span class="wfr-item-time">{{ formatTime(inst.startedAt) }}</span>
              </div>
              <div class="wfr-item-meta">
                <span class="wfr-meta-tag">{{ countDone(inst) }}/{{ countTotal(inst) }} 节点已完成</span>
                <span v-if="inst.metadata?.docPath" class="wfr-meta-doc">{{ inst.metadata.docPath }}</span>
              </div>
            </li>
          </ul>
        </div>

        <footer class="wfr-actions">
          <button class="wfr-btn ghost" @click="onLater">稍后再说</button>
          <button class="wfr-btn warn" :disabled="!selected" @click="onDiscard">丢弃选中</button>
          <button class="wfr-btn primary" :disabled="!selected" @click="onResume">恢复选中</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script>
import store from '../../utils/workflow/workflowInstanceStore.js'
import { getMyInstanceId } from '../../utils/host/leaderElection.js'

const STORAGE_DEFER_KEY = 'workflowResumeDeferUntil'
const DEFER_MS = 4 * 60 * 60_000  // 用户点"稍后" → 4 小时内不再问

export default {
  name: 'WorkflowResumeDialog',
  data() {
    return {
      resumable: [],
      selected: '',
      show: false
    }
  },
  emits: ['resume', 'discard'],
  async mounted() {
    // 检测"稍后再说"是否还在窗口期
    try {
      const deferUntil = Number(window?.localStorage?.getItem(STORAGE_DEFER_KEY) || 0)
      if (deferUntil > Date.now()) return
    } catch {}

    // 扫描可恢复 instance
    try {
      const myId = getMyInstanceId() || ''
      const list = await store.listResumable({ aliveWindowIds: [myId] })
      if (list.length === 0) return
      this.resumable = list
      this.selected = list[0]?.id || ''
      this.show = true
    } catch (_) { /* 失败静默 */ }
  },
  methods: {
    resolveName(inst) {
      return inst.metadata?.workflowName || inst.definitionId || `instance ${inst.id.slice(-6)}`
    },
    countDone(inst) {
      const snap = inst.snapshot || {}
      return Object.values(snap).filter(s => s?.status === 'done').length
    },
    countTotal(inst) {
      return Object.keys(inst.snapshot || {}).length || '?'
    },
    formatTime(ts) {
      if (!ts) return '—'
      const d = new Date(ts)
      const now = Date.now()
      const ago = now - ts
      if (ago < 3600_000) return `${Math.floor(ago / 60_000)} 分钟前`
      if (ago < 86400_000) return `${Math.floor(ago / 3600_000)} 小时前`
      return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    },
    async onResume() {
      const inst = this.resumable.find(i => i.id === this.selected)
      if (!inst) return
      try {
        await store.updateInstanceStatus(inst.id, 'running', { ownerWindow: getMyInstanceId() || '' })
      } catch (_) {}
      this.$emit('resume', inst)
      this.removeOne(inst.id)
    },
    async onDiscard() {
      const inst = this.resumable.find(i => i.id === this.selected)
      if (!inst) return
      try {
        await store.updateInstanceStatus(inst.id, 'cancelled', {
          ownerWindow: getMyInstanceId() || '',
          metadata: { ...(inst.metadata || {}), discardReason: 'user-resume-dialog' }
        })
      } catch (_) {}
      this.$emit('discard', inst)
      this.removeOne(inst.id)
    },
    onLater() {
      try {
        window?.localStorage?.setItem(STORAGE_DEFER_KEY, String(Date.now() + DEFER_MS))
      } catch {}
      this.show = false
    },
    onClose() {
      this.onLater()
    },
    removeOne(id) {
      this.resumable = this.resumable.filter(i => i.id !== id)
      if (this.resumable.length === 0) {
        this.show = false
      } else {
        this.selected = this.resumable[0]?.id || ''
      }
    }
  }
}
</script>

<style scoped>
.wfr-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9998;
  backdrop-filter: blur(4px);
}
.wfr-dialog {
  width: min(540px, 92vw);
  max-height: 85vh;
  overflow-y: auto;
  background: var(--color-bg-elevated, #fff);
  border-radius: 12px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  font-family: var(--font-base);
  color: var(--color-text-primary);
  animation: wfr-in 240ms var(--chy-ease-out, cubic-bezier(.32,.72,0,1));
}
@keyframes wfr-in {
  from { opacity: 0; transform: scale(0.96) translateY(-8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
.wfr-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px 12px;
  border-bottom: 1px solid var(--chy-ink-100, #f0f1f4);
}
.wfr-icon {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: var(--chy-amber-100, #faecd0);
  color: var(--chy-amber-700, #a06800);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}
.wfr-head h3 { margin: 0; font-size: 15px; font-weight: 600; }
.wfr-body { padding: 12px 20px; }
.wfr-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}
.wfr-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}
.wfr-item {
  padding: 10px 12px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  border-radius: 8px;
  cursor: pointer;
  transition: all 160ms;
}
.wfr-item:hover { background: var(--chy-ink-50, #f6f7f9); }
.wfr-item.selected {
  border-color: var(--chy-violet-500, #7c6cdc);
  background: var(--chy-violet-100, #ebe7fa);
}
.wfr-item-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 13px;
}
.wfr-item-name { font-weight: 500; }
.wfr-item-time { font-size: 11px; color: var(--color-text-muted); font-family: var(--font-mono); }
.wfr-item-meta {
  display: flex;
  gap: 10px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--color-text-muted);
}
.wfr-meta-tag {
  font-family: var(--font-mono);
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--chy-ink-100, #f0f1f4);
}
.wfr-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px;
  border-top: 1px solid var(--chy-ink-100, #f0f1f4);
}
.wfr-btn {
  padding: 6px 14px;
  border: 1px solid var(--chy-ink-200, #e6e8ec);
  background: transparent;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 160ms;
}
.wfr-btn:hover:not(:disabled) { background: var(--chy-ink-50, #f6f7f9); }
.wfr-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.wfr-btn.primary {
  background: var(--chy-violet-500, #7c6cdc);
  border-color: var(--chy-violet-500, #7c6cdc);
  color: #fff;
}
.wfr-btn.warn {
  color: var(--chy-rouge-600, #c44b3a);
  border-color: var(--chy-rouge-300, #f0bcb3);
}
.wfr-btn.warn:hover:not(:disabled) { background: var(--chy-rouge-50, #fdf3f1); }
</style>
