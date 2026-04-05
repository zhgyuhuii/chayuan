function getApplication() {
  return window.Application || window.opener?.Application || window.parent?.Application || null
}

function restoreHostWindow() {
  const app = getApplication()
  const hostWindow = app?.ActiveWindow
  if (!hostWindow) return

  try {
    const minimizedState = app?.Enum?.wdWindowStateMinimize ?? 2
    const normalState = app?.Enum?.wdWindowStateNormal ?? 0
    if (hostWindow.WindowState === minimizedState) {
      hostWindow.WindowState = normalState
    }
  } catch (_) {}

  try {
    hostWindow.Visible = true
  } catch (_) {}

  try {
    if (typeof hostWindow.Activate === 'function') {
      hostWindow.Activate()
    }
  } catch (_) {}
}

function focusDialogWindow() {
  try {
    if (window.focus) window.focus()
  } catch (_) {}
}

export function activateDialogWindow() {
  restoreHostWindow()
  focusDialogWindow()
  window.setTimeout(focusDialogWindow, 30)
  window.setTimeout(focusDialogWindow, 180)
}
