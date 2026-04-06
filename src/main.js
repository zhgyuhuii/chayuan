import './assets/main.css'
import './utils/publicAssetUrl.js'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { registerSpellCheckTaskBridge } from './utils/spellCheckTaskBridge.js'
import { installGlobalErrorLogger } from './utils/globalErrorLogger.js'
import { prepareDialogDisplayText } from './utils/dialogTextDisplay.js'

const app = createApp(App)

app.config.globalProperties.$cdt = (value) => prepareDialogDisplayText(value == null ? '' : String(value))

registerSpellCheckTaskBridge()
installGlobalErrorLogger(app)

app.use(router)

router.isReady().then(() => {
  app.mount('#app')
}).catch((e) => {
  console.error('Router ready failed:', e)
  app.mount('#app')
})

