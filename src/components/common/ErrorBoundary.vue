<!--
  ErrorBoundary — Vue 3 错误边界

  捕获子组件抛错,显示友好降级 UI 而非整页白屏。

  用法:
    <ErrorBoundary>
      <SomeComponent />
    </ErrorBoundary>

  Props:
    fallback   error 时显示的 prop(默认内置 UI)
    onError    err 回调(用于上报)
-->
<template>
  <slot v-if="!hasError" />
  <div v-else class="eb-fallback">
    <div class="eb-icon">⚠</div>
    <div class="eb-msg">该模块暂时无法显示</div>
    <div v-if="errorMessage" class="eb-detail">{{ errorMessage }}</div>
    <button class="eb-btn" @click="reset">重试</button>
  </div>
</template>

<script>
import toast from '../../utils/toastService.js'

export default {
  name: 'ErrorBoundary',
  props: {
    onError: { type: Function, default: null }
  },
  data() {
    return {
      hasError: false,
      errorMessage: ''
    }
  },
  errorCaptured(err, instance, info) {
    this.hasError = true
    this.errorMessage = String(err?.message || err || '未知错误').slice(0, 120)
    if (typeof console !== 'undefined') {
      console.error('[ErrorBoundary]', { error: err, info })
    }
    try { this.onError?.(err, info) } catch (_) {}
    try {
      toast.error('页面出错', { detail: this.errorMessage, timeout: 8000 })
    } catch (_) {}
    return false   // 阻止向上冒泡(已被本边界处理)
  },
  methods: {
    reset() {
      this.hasError = false
      this.errorMessage = ''
    }
  }
}
</script>

<style scoped>
.eb-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 20px;
  background: var(--chy-rouge-50, #fdf3f1);
  border: 1px solid var(--chy-rouge-200, #f5c8c0);
  border-radius: 8px;
  margin: 12px;
  font-family: var(--font-base);
  color: var(--chy-rouge-700, #a3392a);
}
.eb-icon {
  font-size: 32px;
  width: 56px; height: 56px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: rgba(226, 106, 88, 0.15);
}
.eb-msg { font-size: 14px; font-weight: 600; }
.eb-detail {
  font-size: 12px;
  color: var(--chy-rouge-600, #c44b3a);
  max-width: 480px;
  text-align: center;
  font-family: var(--font-mono);
  background: rgba(255, 255, 255, 0.5);
  padding: 6px 10px;
  border-radius: 4px;
}
.eb-btn {
  margin-top: 8px;
  padding: 6px 16px;
  border: 1px solid var(--chy-rouge-400, #ed8e7d);
  background: transparent;
  color: var(--chy-rouge-700, #a3392a);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
.eb-btn:hover { background: rgba(226, 106, 88, 0.10); }
</style>
