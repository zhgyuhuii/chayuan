<!--
  AssistantHelpDialog.vue
  助手分步使用说明书弹窗：面板/设置里点助手条目的「?」帮助图标弹出。
  内容取自配方 manual（hostAssistantManuals.js）：准备 → 分步操作 → 小贴士。
-->
<template>
  <div
    v-if="visible && assistant"
    class="assistant-help-overlay"
    @click.self="onClose"
  >
    <div class="assistant-help-modal" role="dialog" aria-modal="true" :aria-label="`${title} 使用说明`">
      <div class="assistant-help-header">
        <div class="assistant-help-icon">
          <img
            v-if="isImageIcon"
            :src="assistant.icon"
            alt=""
          />
          <span v-else>{{ assistant.icon || '🧠' }}</span>
        </div>
        <div class="assistant-help-title-main">
          <h4>{{ title }}</h4>
          <div class="assistant-help-tags">
            <span v-if="groupLabel" class="assistant-help-tag">{{ groupLabel }}</span>
            <span class="assistant-help-tag" :class="mode === 'send' ? 'tag-send' : 'tag-prefill'">
              {{ mode === 'send' ? '点击直接执行' : '填入提示词·补充后发送' }}
            </span>
          </div>
        </div>
        <button type="button" class="assistant-help-close" aria-label="关闭" @click="onClose">×</button>
      </div>

      <div class="assistant-help-body">
        <p v-if="description" class="assistant-help-desc">{{ description }}</p>

        <section v-if="manual.prep" class="assistant-help-section">
          <h5>使用前准备</h5>
          <p class="assistant-help-prep">{{ manual.prep }}</p>
        </section>

        <section class="assistant-help-section">
          <h5>操作步骤</h5>
          <ol class="assistant-help-steps">
            <li v-for="(step, idx) in manual.steps" :key="idx">{{ step }}</li>
          </ol>
        </section>

        <section v-if="manual.tips && manual.tips.length" class="assistant-help-section">
          <h5>小贴士</h5>
          <ul class="assistant-help-tips">
            <li v-for="(tip, idx) in manual.tips" :key="idx">{{ tip }}</li>
          </ul>
        </section>
      </div>

      <div class="assistant-help-footer">
        <button type="button" class="assistant-help-ok" @click="onClose">知道了</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AssistantHelpDialog',
  props: {
    visible: { type: Boolean, default: false },
    assistant: { type: Object, default: null }
  },
  emits: ['close'],
  computed: {
    manual() {
      const m = this.assistant?.manual
      return {
        prep: String(m?.prep || ''),
        steps: Array.isArray(m?.steps) ? m.steps : [],
        tips: Array.isArray(m?.tips) ? m.tips : []
      }
    },
    title() {
      return this.assistant?.label || this.assistant?.shortLabel || '助手使用说明'
    },
    description() {
      return String(this.assistant?.description || '').trim()
    },
    groupLabel() {
      return String(this.assistant?.group || '').trim()
    },
    mode() {
      return this.assistant?.mode === 'send' ? 'send' : 'prefill'
    },
    isImageIcon() {
      const icon = String(this.assistant?.icon || '')
      return /^(https?:|data:|\.\/|\/)/.test(icon)
    }
  },
  mounted() {
    window.addEventListener('keydown', this.onKeydown)
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.onKeydown)
  },
  methods: {
    onClose() {
      this.$emit('close')
    },
    onKeydown(e) {
      if (e.key === 'Escape' && this.visible) this.onClose()
    }
  }
}
</script>

<style scoped>
.assistant-help-overlay {
  position: fixed;
  inset: 0;
  z-index: 95;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.45);
}

.assistant-help-modal {
  display: flex;
  flex-direction: column;
  width: min(560px, calc(100vw - 24px));
  max-height: min(680px, calc(100vh - 32px));
  overflow: hidden;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.28);
}

.assistant-help-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.22);
}

.assistant-help-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: rgba(14, 165, 233, 0.1);
  font-size: 20px;
  overflow: hidden;
}

.assistant-help-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.assistant-help-title-main {
  flex: 1;
  min-width: 0;
}

.assistant-help-title-main h4 {
  margin: 0;
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.3;
}

.assistant-help-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 5px;
}

.assistant-help-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #475569;
  font-size: 11px;
  line-height: 1.5;
}

.assistant-help-tag.tag-send {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
}

.assistant-help-tag.tag-prefill {
  background: rgba(14, 165, 233, 0.12);
  color: #0369a1;
}

.assistant-help-close {
  flex: 0 0 auto;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.assistant-help-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px;
}

.assistant-help-desc {
  margin: 0 0 10px;
  color: #334155;
  font-size: 13px;
  line-height: 1.6;
}

.assistant-help-section {
  margin: 0 0 12px;
}

.assistant-help-section h5 {
  margin: 0 0 6px;
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
}

.assistant-help-prep {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(239, 246, 255, 0.85);
  color: #1e3a8a;
  font-size: 12.5px;
  line-height: 1.6;
}

.assistant-help-steps {
  margin: 0;
  padding-left: 1.4em;
  color: #1e293b;
  font-size: 12.5px;
  line-height: 1.7;
}

.assistant-help-steps li + li {
  margin-top: 5px;
}

.assistant-help-tips {
  margin: 0;
  padding-left: 1.2em;
  color: #92400e;
  font-size: 12.5px;
  line-height: 1.6;
  list-style: none;
}

.assistant-help-tips li {
  position: relative;
  padding-left: 14px;
}

.assistant-help-tips li::before {
  content: '💡';
  position: absolute;
  left: -8px;
  font-size: 11px;
}

.assistant-help-footer {
  display: flex;
  justify-content: flex-end;
  padding: 10px 16px 12px;
  border-top: 1px solid rgba(148, 163, 184, 0.22);
}

.assistant-help-ok {
  height: 30px;
  padding: 0 18px;
  border: none;
  border-radius: 8px;
  background: #0ea5e9;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.assistant-help-ok:hover {
  background: #0284c7;
}
</style>
