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

  // 部分 WPS 版本需要 Application 级激活才能把整个程序窗口带到前台
  try {
    if (typeof app.Activate === 'function') {
      app.Activate()
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

// 仅把 WPS 主窗口激活到前台(不抢焦点到对话框本身)。
// 对话框关闭前调用,否则 ShowDialog 关闭后 OS 会把前台焦点交给后面的其它应用,
// 表现为「关窗后 WPS 主窗口跑到后台、被别的应用遮住」。
export function activateHostWindow() {
  restoreHostWindow()
}
