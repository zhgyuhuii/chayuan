/**
 * Preloads the `/ai-assistant` lazy route chunk so opening the dialog from the
 * ribbon does not wait on fetch + parse of the large bundle on first use.
 * Must use the same specifier as `src/router/index.js` so Vite emits one chunk.
 */
export function preloadAiAssistantRouteChunk() {
  return import('../components/AIAssistantDialog.vue')
}

export function schedulePreloadAiAssistantRouteChunk() {
  const run = () => {
    preloadAiAssistantRouteChunk().catch(() => {})
  }
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 4000 })
  } else {
    window.setTimeout(run, 1500)
  }
}
