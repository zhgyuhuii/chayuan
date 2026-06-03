import { bootMark } from './utils/bootPerf.js'
bootMark('main.js 顶部')

import './assets/main.css'
import './assets/tokens.css'
import './assets/motion.css'
import './assets/dark-mode-fixes.css'
import './assets/assistant-form-enhanced.css'
import './assets/settings-form-vertical.css'
import './utils/publicAssetUrl.js'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { registerSpellCheckTaskBridge } from './utils/spellCheckTaskBridge.js'
import { installGlobalErrorLogger } from './utils/globalErrorLogger.js'
import { prepareDialogDisplayText } from './utils/dialogTextDisplay.js'
import { installGlobalShortcut } from './utils/router/commandRegistry.js'
import { applyStoredTheme } from './utils/router/themeToggle.js'
import { initRuntimeSync } from './utils/runtimeSync.js'
import { activateHostWindow } from './utils/windowActivation.js'
bootMark('main.js: 所有顶层 import + 顶层模块 evaluation 完成')

// 全局兜底:任何 ShowDialog 子窗口(任务进度/设置/模板/脱密…)关闭时——无论点
// 「关闭」按钮还是标题栏 X——都把 WPS 主窗口重新激活到前台,否则关窗后 OS 会把
// 前台焦点交给后面的其它应用,表现为「WPS 主窗口跑到后台、被别的应用遮住」。
try {
  window.addEventListener('beforeunload', () => {
    try { activateHostWindow() } catch (_) {}
  })
} catch (_) {}

const app = createApp(App)
bootMark('createApp 完成')

app.config.globalProperties.$cdt = (value) => prepareDialogDisplayText(value == null ? '' : String(value))

registerSpellCheckTaskBridge()
bootMark('registerSpellCheckTaskBridge 完成')
installGlobalErrorLogger(app)
bootMark('installGlobalErrorLogger 完成')
installGlobalShortcut()
bootMark('installGlobalShortcut 完成')
applyStoredTheme()
bootMark('applyStoredTheme 完成')

app.use(router)
bootMark('app.use(router) 完成')

router.isReady().then(() => {
  bootMark('router.isReady resolve')
  app.mount('#app')
  bootMark('app.mount(#app) 同步部分完成')
}).catch((e) => {
  console.error('Router ready failed:', e)
  app.mount('#app')
  bootMark('app.mount(#app) 兜底分支完成')
})

try { initRuntimeSync() } catch { /* 静默 */ }

