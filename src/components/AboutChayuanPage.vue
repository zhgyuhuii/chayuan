<template>
  <div class="about-chayuan-page">
    <AboutChayuanPanel />
  </div>
</template>

<script>
import AboutChayuanPanel from './AboutChayuanPanel.vue'

export default {
  name: 'AboutChayuanPage',
  components: { AboutChayuanPanel }
}
</script>

<style scoped>
/* dialog 路由下 body 为 overflow:hidden，此处占满视口并自行纵向滚动 */
.about-chayuan-page {
  height: 100vh;
  max-height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  box-sizing: border-box;
  background: #0f172a;
}
</style>
