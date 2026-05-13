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
import { bootMark, bootMeasure, bootDump } from './utils/bootPerf.js'
bootMark('App.vue script 顶部 import 解析中')
import ribbon from './components/ribbon.js'
import { syncAddonBaseUrlToPluginStorage } from './utils/publicAssetUrl.js'
import { schedulePreloadAiAssistantRouteChunk } from './utils/preloadAiAssistantChunk.js'
import { registerRibbonCommands } from './utils/router/ribbonCommands.js'
import CommandPaletteHost from './components/common/CommandPaletteHost.vue'
import WelcomeBanner from './components/common/WelcomeBanner.vue'
import ToastContainer from './components/common/ToastContainer.vue'
import WorkflowResumeDialog from './components/common/WorkflowResumeDialog.vue'
import TaskCelebration from './components/common/TaskCelebration.vue'
bootMark('App.vue script 顶部 import 全部解析完')
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
        // ⚠️ 自动进化系统(tryAutoBoot + installAllEvolutionTimers)已暂时关闭:
        //   - 它会拉入 promotionFlow / raceEvaluator / judge / candidateGenerator 等
        //     大子图,在每个 webview 冷启动都额外解析,且会在每个 WPS 弹窗里重复
        //     装 daily 03:00 + 每 2h rollback tick 的定时器;
        //   - 用户反馈"打开文档加载慢",请求先关掉自动入口;
        //   - 需要时可以从 ⌘K 输入 `evo.boot` 或在设置页手动启动。
        // 恢复办法:把下面这块注释解开。
        // safeImport(() => import('./utils/assistant/evolution/bootHelpers.js'), m => {
        //   try { m.tryAutoBoot() } catch (_) { /* auto-boot 失败不影响其余 idle 任务 */ }
        //   return import('./utils/assistant/evolution/installEvolutionScheduler.js')
        //     .then(s => {
        //       try { s.installAllEvolutionTimers() } catch (_) { /* timer 安装失败不影响其余 idle 任务 */ }
        //     })
        //     .catch(() => {})
        // })
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
      bootMark(`App.vue onMounted 进入 (isDialog=${isDialog.value}, path=${route.path})`)
      window.ribbon = ribbon
      // 首屏必须的同步工作:路由 dialog 标记 + addon base url 同步(廉价)
      bootMeasure('updateDialogPageClass', updateDialogPageClass)
      bootMeasure('syncAddonBaseUrlToPluginStorage', syncAddonBaseUrlToPluginStorage)
      // 弹窗 webview 不需要 ribbon 命令面板/AI 助手预加载/后台 boot —
      // 它们既无 ribbon 可挂,也不应在每个弹窗里再装一份定时器+监听器。
      if (!isDialog.value) {
        bootMeasure('registerRibbonCommands', () => {
          try { registerRibbonCommands({ ribbon }) } catch (_) { /* 注册失败不阻塞主流程 */ }
        })
        bootMark('schedulePreloadAiAssistantRouteChunk 调用')
        schedulePreloadAiAssistantRouteChunk()
        bootMark('scheduleNonCriticalBoot 调用')
        scheduleNonCriticalBoot()
      } else {
        bootMark('isDialog=true,跳过 registerRibbonCommands / preload / scheduleNonCriticalBoot')
      }
      bootMark('App.vue onMounted 退出')
      // 让首屏所有 mounted 都跑完之后,统一 dump 一次时间线
      setTimeout(() => bootDump(`route=${route.path}`), 1500)
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

