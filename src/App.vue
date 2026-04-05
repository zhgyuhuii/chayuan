<template>
  <RouterView :key="$route.fullPath" />
</template>

<style scoped></style>

<script>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import ribbon from './components/ribbon.js'

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
      // 供 ribbon 打开对话框时使用：WPS 中 ribbon 与页面可能不同源，需保存当前页面地址
      try {
        if (window.Application && window.Application.PluginStorage) {
          const base = window.location.origin + window.location.pathname.replace(/\/?index\.html$/i, '') || ''
          window.Application.PluginStorage.setItem('AddinBaseUrl', base || window.location.href)
        }
      } catch (e) {}
    })

    watch(() => route.path, updateDialogPageClass, { immediate: true })

    return {
      message
    }
  }
}
</script>

