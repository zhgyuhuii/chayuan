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

const app = createApp(App)

app.config.globalProperties.$cdt = (value) => prepareDialogDisplayText(value == null ? '' : String(value))

registerSpellCheckTaskBridge()
installGlobalErrorLogger(app)
installGlobalShortcut()
applyStoredTheme()

app.use(router)

router.isReady().then(() => {
  app.mount('#app')
}).catch((e) => {
  console.error('Router ready failed:', e)
  app.mount('#app')
})

