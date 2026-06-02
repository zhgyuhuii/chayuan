<template>
  <div>
    <h1>{{ msg }}</h1>
  </div>
</template>

<script>
export default {
  name: 'HelloWps',
  data() {
    return {
      msg: '欢迎来到wps加载项的世界!'
    }
  }
  // 说明(2026-06-02 性能优化):此前 mounted() 会在挂载后 180ms 自动
  // window.Application.ShowDialog 拉起「察元 AI 助手」窗口，导致打开文档时
  // 立即加载并挂载约 2 万行的 AIAssistantDialog，造成启动卡顿。
  // 现已移除自动弹窗，AI 助手改由功能区按钮 / 右键菜单按需打开。
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped></style>
