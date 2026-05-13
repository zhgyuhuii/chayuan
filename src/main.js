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
bootMark('main.js: 所有顶层 import + 顶层模块 evaluation 完成')

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

