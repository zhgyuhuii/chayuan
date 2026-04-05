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
.about-chayuan-page {
  min-height: 100vh;
  box-sizing: border-box;
  background: #0f172a;
}
</style>
