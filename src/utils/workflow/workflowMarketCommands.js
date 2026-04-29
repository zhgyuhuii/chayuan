/**
 * workflowMarketCommands — 工作流市场 ⌘K 命令(W5.3)
 *
 * 集成入 ⌘K 命令面板,提供:
 *   - workflow.template.list:列出 8 个内置模板,选中即创建
 *   - workflow.share.copy:把当前工作流复制为 deeplink 到剪贴板
 *   - workflow.share.import:粘贴 deeplink 导入工作流
 *   - workflow.export:导出 JSON
 *   - workflow.market.open:打开市场页(/marketplace)聚焦 workflow tag
 */

import { registerCommands } from '../router/commandRegistry.js'
import { listTemplates } from './workflowTemplates.js'
import { exportWorkflowJSON, importWorkflowJSON, buildShareLink, parseShareLink } from './workflowShare.js'
import toast from '../toastService.js'

const GROUP = '工作流'

export function registerWorkflowMarketCommands(options = {}) {
  const saveWorkflow = options.saveWorkflow   // (workflow) => void
  const getCurrentWorkflow = options.getCurrentWorkflow  // () => workflow|null

  const list = []

  // 模板列表(每个模板一个命令)
  for (const tpl of listTemplates()) {
    list.push({
      id: `workflow.template.${tpl.id}`,
      group: GROUP,
      icon: '📋',
      title: `从模板创建:${tpl.name}`,
      subtitle: tpl.description,
      keywords: ['template', tpl.category, ...(tpl.tags || [])],
      priority: 50,
      handler: () => {
        if (typeof saveWorkflow !== 'function') {
          toast.warn('未注入 saveWorkflow,无法创建', { detail: 'registerWorkflowMarketCommands(options) 缺少 saveWorkflow' })
          return
        }
        try {
          // 浅复制 + 改 id 避免重名
          const newWf = JSON.parse(JSON.stringify(tpl))
          newWf.id = `${tpl.id}__${Date.now().toString(36)}`
          newWf.name = `${tpl.name}(副本)`
          saveWorkflow(newWf)
          toast.success(`已创建工作流`, { detail: newWf.name })
        } catch (e) {
          toast.error('创建失败', { detail: String(e?.message || e) })
        }
      }
    })
  }

  // 共享 / 导入
  list.push({
    id: 'workflow.share.copy',
    group: GROUP,
    icon: '🔗',
    title: '复制当前工作流为分享链接',
    keywords: ['share', 'copy', 'link', '分享'],
    priority: 60,
    handler: async () => {
      const wf = typeof getCurrentWorkflow === 'function' ? getCurrentWorkflow() : null
      if (!wf?.id) { toast.warn('当前没有打开工作流'); return }
      const link = buildShareLink(wf, { publisher: 'local' })
      try { await navigator.clipboard.writeText(link); toast.success('链接已复制') }
      catch (e) { toast.error('复制失败', { detail: String(e?.message || e) }) }
    }
  })

  list.push({
    id: 'workflow.share.import',
    group: GROUP,
    icon: '📥',
    title: '从分享链接 / JSON 导入工作流',
    keywords: ['import', 'install', '导入'],
    priority: 60,
    handler: async () => {
      let raw = ''
      try { raw = await navigator.clipboard.readText() } catch (_) {}
      if (!raw) { toast.warn('剪贴板为空'); return }

      let json = raw
      const parsed = parseShareLink(raw)
      if (parsed) json = JSON.stringify(parsed)

      const result = await importWorkflowJSON(json, { skipSignatureCheck: true })
      if (!result.ok) { toast.error('导入失败', { detail: result.error }); return }
      if (typeof saveWorkflow !== 'function') {
        toast.info('已解析,但未注入 saveWorkflow', { detail: result.workflow.id })
        return
      }
      saveWorkflow(result.workflow)
      toast.success('已导入工作流', { detail: result.workflow.name })
    }
  })

  list.push({
    id: 'workflow.export',
    group: GROUP,
    icon: '📤',
    title: '导出当前工作流为 JSON',
    keywords: ['export', 'json', '导出'],
    handler: async () => {
      const wf = typeof getCurrentWorkflow === 'function' ? getCurrentWorkflow() : null
      if (!wf?.id) { toast.warn('当前没有打开工作流'); return }
      const json = exportWorkflowJSON(wf, { publisher: 'local' })
      try { await navigator.clipboard.writeText(json); toast.success('JSON 已复制') }
      catch (e) { toast.error('复制失败', { detail: String(e?.message || e) }) }
    }
  })

  list.push({
    id: 'workflow.market.open',
    group: GROUP,
    icon: '🛍',
    title: '打开工作流市场',
    keywords: ['market', 'browse', '市场'],
    handler: () => {
      if (typeof window !== 'undefined') {
        const base = window.location.href.split('#')[0]
        window.location.href = base + '#/marketplace?filter=workflow'
      }
    }
  })

  return registerCommands(list)
}

export default {
  registerWorkflowMarketCommands
}
