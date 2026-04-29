<template>
  <WelcomeBanner v-if="!isDialog" />
  <RouterView :key="$route.fullPath" />
  <CommandPaletteHost v-if="!isDialog" />
  <ToastContainer />
  <TaskCelebration v-if="!isDialog" />
  <WorkflowResumeDialog v-if="!isDialog" @resume="onWorkflowResume" @discard="onWorkflowDiscard" />
</template>

<style scoped></style>

<script>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import ribbon from './components/ribbon.js'
import { syncAddonBaseUrlToPluginStorage } from './utils/publicAssetUrl.js'
import { schedulePreloadAiAssistantRouteChunk } from './utils/preloadAiAssistantChunk.js'
import { registerRibbonCommands } from './utils/router/ribbonCommands.js'
import { registerEvolutionCommands } from './utils/router/evolutionCommands.js'
import { registerModelCommands } from './utils/router/modelCommands.js'
import { tryAutoBoot } from './utils/assistant/evolution/bootHelpers.js'
import { installAllEvolutionTimers } from './utils/assistant/evolution/installEvolutionScheduler.js'
import CommandPaletteHost from './components/common/CommandPaletteHost.vue'
import WelcomeBanner from './components/common/WelcomeBanner.vue'
import ToastContainer from './components/common/ToastContainer.vue'
import WorkflowResumeDialog from './components/common/WorkflowResumeDialog.vue'
import TaskCelebration from './components/common/TaskCelebration.vue'
import { installTelemetryBridge } from './utils/workflow/workflowTelemetryBridge.js'
import { registerTaskCommands } from './utils/router/taskCommands.js'
import { installAchievementListener } from './utils/task/taskAchievement.js'
import { installRuntimeAssistants } from './utils/assistant/runtimeAssistantsInstaller.js'
import { ensureSpellCheckPerfWrapper } from './utils/spellCheckPerfWrapper.js'

const DIALOG_ROUTES = ['/settings', '/dialog', '/ad-popup', '/manual-col-width', '/dialog-delete-text',
  '/append-replace-text', '/dialog-first-col-style', '/dialog-uniform-image-format', '/table-caption',
  '/document-declassify-dialog', '/document-declassify-restore-dialog', '/template-import-dialog',
  '/template-export-dialog', '/template-download-dialog', '/document-template-import',
  '/template-field-extract-dialog', '/form-content-preview', '/form-audit-dialog',
  '/unused-styles-cleaner-dialog', '/style-statistics-dialog', '/ai-assistant', '/task-orchestration',
  '/about-chayuan']

export default {
  components: { CommandPaletteHost, WelcomeBanner, ToastContainer, WorkflowResumeDialog, TaskCelebration },
  setup() {
    const message = ref('你好，wps加载项')
    const route = useRoute()
    const isDialog = ref(false)

    function updateDialogPageClass() {
      const path = (route.path || '').replace(/\/$/, '') || '/'
      const dialog = DIALOG_ROUTES.some(r => path === r || path.startsWith(r + '/'))
      isDialog.value = dialog
      document.body.classList.toggle('dialog-page', dialog)
      const appEl = document.getElementById('app')
      if (appEl) appEl.classList.toggle('dialog-page', dialog)
    }

    onMounted(() => {
      window.ribbon = ribbon
      try { registerRibbonCommands({ ribbon }) } catch (_) { /* 注册失败不阻塞主流程 */ }
      try { registerEvolutionCommands() } catch (_) { /* 注册失败不阻塞主流程 */ }
      try { registerModelCommands() } catch (_) { /* 注册失败不阻塞主流程 */ }
      try { tryAutoBoot() } catch (_) { /* 启动失败不阻塞主流程,用户可手动从 ⌘K 触发 */ }
      try { installAllEvolutionTimers() } catch (_) { /* timer 失败不阻塞 */ }
      try { installTelemetryBridge() } catch (_) { /* telemetry 失败不阻塞 */ }
      try { registerTaskCommands() } catch (_) { /* task ⌘K 失败不阻塞 */ }
      try { installAchievementListener() } catch (_) { /* 成就监听失败不阻塞 */ }
      // 异步执行,失败静默不阻塞
      installRuntimeAssistants().catch(() => {})
      try { ensureSpellCheckPerfWrapper() } catch (_) { /* 拼写检查包装失败不阻塞 */ }
      updateDialogPageClass()
      syncAddonBaseUrlToPluginStorage()
      schedulePreloadAiAssistantRouteChunk()
    })

    watch(() => route.path, updateDialogPageClass, { immediate: true })

    function onWorkflowResume(inst) {
      // 占位:由 workflowRunner 后续实现 resume 入口
      if (typeof console !== 'undefined') console.info('[App] workflow resume requested', inst.id)
    }
    function onWorkflowDiscard(inst) {
      if (typeof console !== 'undefined') console.info('[App] workflow discarded', inst.id)
    }

    return {
      message,
      isDialog,
      onWorkflowResume,
      onWorkflowDiscard
    }
  }
}
</script>

