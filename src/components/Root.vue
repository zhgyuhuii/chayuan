<template>
  <div>
    <h1>{{ msg }}</h1>
  </div>
</template>

<script>
import ribbon from './ribbon.js'

export default {
  name: 'HelloWps',
  data() {
    return {
      msg: '欢迎来到wps加载项的世界!'
    }
  },
  mounted() {
    if (!window.Application?.ShowDialog || typeof ribbon.showAIAssistantDialog !== 'function') {
      return
    }
    // 等首页完成挂载后再自动拉起欢迎窗口，避免启动瞬间竞争导致弹窗丢失。
    window.setTimeout(() => {
      try {
        ribbon.showAIAssistantDialog()
      } catch (error) {
        console.warn('自动打开察元 AI 助手失败:', error)
      }
    }, 180)
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped></style>
