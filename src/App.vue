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
import CommandPaletteHost from './components/common/CommandPaletteHost.vue'
import WelcomeBanner from './components/common/WelcomeBanner.vue'
import ToastContainer from './components/common/ToastContainer.vue'
import WorkflowResumeDialog from './components/common/WorkflowResumeDialog.vue'
import TaskCelebration from './components/common/TaskCelebration.vue'
// 下列模块都是"非首屏关键"的注册/启动器,改为 idle 时动态导入,首屏 JS 不再为它们等待:
//   - evolutionCommands / modelCommands / taskCommands: ⌘K 命令面板条目,首次开面板前都用不上
//   - bootHelpers / installEvolutionScheduler: 进化系统启动 + 长周期定时器(每天 03:00 / 每 2 小时)
//   - workflowTelemetryBridge / taskAchievement: 后台监听,延迟挂上不影响首次任务
//   - runtimeAssistantsInstaller: 远程同步,本来就是 async + .catch(noop)
//   - spellCheckPerfWrapper: 仅在拼写检查路由生效

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

    function scheduleNonCriticalBoot() {
      const run = () => {
        // 每个 dynamic import + 调用都被 try/catch 包裹,任意一项失败不影响其它项。
        const safeImport = (loader, run) => loader().then(run).catch(() => {})
        safeImport(() => import('./utils/router/evolutionCommands.js'), m => m.registerEvolutionCommands())
        safeImport(() => import('./utils/router/modelCommands.js'), m => m.registerModelCommands())
        safeImport(() => import('./utils/router/taskCommands.js'), m => m.registerTaskCommands())
        // bootHelpers + scheduler 串联:auto-boot 之后再装 timer,避免 timer 找不到 deps 直接跳过。
        safeImport(() => import('./utils/assistant/evolution/bootHelpers.js'), m => {
          try { m.tryAutoBoot() } catch (_) { /* auto-boot 失败不影响其余 idle 任务 */ }
          return import('./utils/assistant/evolution/installEvolutionScheduler.js')
            .then(s => {
              try { s.installAllEvolutionTimers() } catch (_) { /* timer 安装失败不影响其余 idle 任务 */ }
            })
            .catch(() => {})
        })
        safeImport(() => import('./utils/workflow/workflowTelemetryBridge.js'), m => m.installTelemetryBridge())
        safeImport(() => import('./utils/task/taskAchievement.js'), m => m.installAchievementListener())
        safeImport(() => import('./utils/assistant/runtimeAssistantsInstaller.js'), m => m.installRuntimeAssistants())
        safeImport(() => import('./utils/spellCheckPerfWrapper.js'), m => m.ensureSpellCheckPerfWrapper())
      }
      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(run, { timeout: 2000 })
      } else {
        setTimeout(run, 200)
      }
    }

    onMounted(() => {
      window.ribbon = ribbon
      // 首屏必须的同步工作:ribbon 命令注册 + 路由 dialog 标记 + addon base url 同步
      try { registerRibbonCommands({ ribbon }) } catch (_) { /* 注册失败不阻塞主流程 */ }
      updateDialogPageClass()
      syncAddonBaseUrlToPluginStorage()
      schedulePreloadAiAssistantRouteChunk()
      // 其余非关键 boot 推迟到 idle,显著降低首屏 JS 解析量
      scheduleNonCriticalBoot()
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

