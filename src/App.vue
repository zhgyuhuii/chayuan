<template>
  <RouterView :key="$route.fullPath" />
</template>

<style scoped></style>

<script>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import ribbon from './components/ribbon.js'
import { syncAddonBaseUrlToPluginStorage } from './utils/publicAssetUrl.js'
import { schedulePreloadAiAssistantRouteChunk } from './utils/preloadAiAssistantChunk.js'

const DIALOG_ROUTES = ['/settings', '/dialog', '/ad-popup', '/manual-col-width', '/dialog-delete-text',
  '/append-replace-text', '/dialog-first-col-style', '/dialog-uniform-image-format', '/table-caption',
  '/document-declassify-dialog', '/document-declassify-restore-dialog', '/template-import-dialog',
  '/template-export-dialog', '/template-download-dialog', '/document-template-import',
  '/template-field-extract-dialog', '/form-content-preview', '/form-audit-dialog',
  '/unused-styles-cleaner-dialog', '/style-statistics-dialog', '/ai-assistant', '/task-orchestration',
  '/about-chayuan']

export default {
  setup() {
    const message = ref('你好，wps加载项')
    const route = useRoute()

    function updateDialogPageClass() {
      const path = (route.path || '').replace(/\/$/, '') || '/'
      const isDialog = DIALOG_ROUTES.some(r => path === r || path.startsWith(r + '/'))
      document.body.classList.toggle('dialog-page', isDialog)
      const appEl = document.getElementById('app')
      if (appEl) appEl.classList.toggle('dialog-page', isDialog)
    }

    onMounted(() => {
      window.ribbon = ribbon
      updateDialogPageClass()
      syncAddonBaseUrlToPluginStorage()
      schedulePreloadAiAssistantRouteChunk()
    })

    watch(() => route.path, updateDialogPageClass, { immediate: true })

    return {
      message
    }
  }
}
</script>

