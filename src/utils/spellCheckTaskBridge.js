import {
  startSpellCheckAllTask,
  startSpellCheckSelectionTask,
  stopSpellCheckTask
} from './spellCheckService.js'

const SPELL_CHECK_BRIDGE_KEY = '__ndSpellCheckTaskBridge'

function getCurrentWindow() {
  return typeof window !== 'undefined' ? window : null
}

export function registerSpellCheckTaskBridge() {
  const currentWindow = getCurrentWindow()
  if (!currentWindow) return
  currentWindow[SPELL_CHECK_BRIDGE_KEY] = {
    start(mode = 'all') {
      const runner = mode === 'selection' ? startSpellCheckSelectionTask : startSpellCheckAllTask
      const { taskId, promise } = runner()
      Promise.resolve(promise).catch((error) => {
        console.error('spellCheck bridge task failed:', error)
      })
      return { taskId }
    },
    stop(taskId) {
      return stopSpellCheckTask(taskId)
    }
  }
}

export function getSpellCheckTaskBridge() {
  const currentWindow = getCurrentWindow()
  if (!currentWindow) return null
  return currentWindow.opener?.[SPELL_CHECK_BRIDGE_KEY]
    || currentWindow.parent?.[SPELL_CHECK_BRIDGE_KEY]
    || currentWindow[SPELL_CHECK_BRIDGE_KEY]
    || null
}
