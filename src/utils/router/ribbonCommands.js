/**
 * ribbonCommands — 把"高频 ribbon 按钮"批量注册到 ⌘K 命令面板
 *
 * 思路:
 *   ribbon.OnAction({ Id: 'btnXXX' }) 已经是项目里的统一动作分发器,
 *   ⌘K 面板上的命令只是另一种"按钮"。所以这里就是一个清单 + 一行 dispatch。
 *
 *   清单是一个**子集**(选 ~15 个高频项),不是把所有 ribbon 按钮都倒进去 —
 *   全倒进去面板会变成"按钮列表",失去快速操作的优势。
 *
 * 用法:
 *   // 在 App 启动后(ribbon 已加载),调用一次:
 *   import { registerRibbonCommands } from '@/utils/router/ribbonCommands.js'
 *   import ribbon from '@/components/ribbon.js'
 *   registerRibbonCommands({ ribbon })
 *
 * 之后 ⌘K 面板里就能直接搜「校对」「助手」「截图」等命令。
 */

import { registerCommands } from './commandRegistry.js'

/**
 * 高频命令白名单。每条:
 *   { id, btnId, group, title, keywords?, when?, priority? }
 *
 * btnId — ribbon.OnAction({ Id: btnId }) 的目标 button id
 */
export const RIBBON_COMMAND_LIST = Object.freeze([
  // ── 助手 ──
  { id: 'rb.assistant.open',     btnId: 'btnAIAssistant',         group: '助手', title: '打开 AI 助手对话框', keywords: ['ai', 'chat', '对话', 'assistant'], priority: 100 },
  { id: 'rb.assistant.create',   btnId: 'btnCustomAssistantCreate', group: '助手', title: '创建智能助手',       keywords: ['create', '新建', 'new'] },
  { id: 'rb.assistant.manage',   btnId: 'btnCustomAssistantManage', group: '助手', title: '管理智能助手',       keywords: ['manage', '管理', 'list'] },
  { id: 'rb.task.orchestration', btnId: 'btnTaskOrchestration',   group: '助手', title: '任务编排',           keywords: ['task', 'orchestration', 'workflow', '编排'] },
  { id: 'rb.task.list',          btnId: 'btnTaskList',            group: '助手', title: '任务列表',           keywords: ['task', 'list', '任务'] },

  // ── 文档质量 ──
  { id: 'rb.spell.check',        btnId: 'btnSpellCheck',          group: '文档质量', title: '拼写与语法检查',    keywords: ['spell', 'check', '拼写', '错别字', 'grammar'], priority: 90 },
  { id: 'rb.security.check',     btnId: 'btnDocumentCheck',       group: '文档质量', title: '保密合规检查',      keywords: ['security', 'compliance', '保密', '合规'] },
  { id: 'rb.ai.trace.check',     btnId: 'btnAITraceCheck',        group: '文档质量', title: 'AI 痕迹检测',        keywords: ['ai', 'trace', '痕迹', '降重'] },

  // ── 表格 / 图片 ──
  { id: 'rb.table.select-all',   btnId: 'btnSelectAllTables',     group: '表格', title: '选中全部表格',       keywords: ['table', '表格', 'select'] },
  { id: 'rb.table.auto-width',   btnId: 'btnTableAutoWidth',      group: '表格', title: '表格自动列宽',       keywords: ['table', 'width', '宽度'] },
  { id: 'rb.image.select-all',   btnId: 'btnSelectAllImages',     group: '图片', title: '选中全部图片',       keywords: ['image', '图片'] },
  { id: 'rb.image.uniform',      btnId: 'btnUniformImageFormat', group: '图片', title: '统一图片格式',       keywords: ['image', 'format', '格式'] },

  // ── 文本批处理 ──
  { id: 'rb.text.replace',       btnId: 'btnAppendReplaceText',   group: '文本', title: '追加 / 替换文本',    keywords: ['replace', 'append', '替换'] },
  { id: 'rb.text.delete-row',    btnId: 'btnDeleteTextRow',       group: '文本', title: '按规则删除行',       keywords: ['delete', 'row', '删除'] },

  // ── 关于 ──
  { id: 'rb.about',              btnId: 'btnAboutChayuan',        group: '关于', title: '关于察元',           keywords: ['about', '关于'] }
])

/**
 * 把白名单注册到全局 ⌘K 命令注册表。
 * 返回 unregister 函数。
 */
export function registerRibbonCommands(options = {}) {
  const ribbon = options.ribbon || (typeof window !== 'undefined' ? window.ribbon : null)
  if (!ribbon || typeof ribbon.OnAction !== 'function') {
    if (typeof console !== 'undefined') {
      console.warn('[ribbonCommands] ribbon.OnAction 不可用,跳过注册')
    }
    return () => {}
  }

  const list = RIBBON_COMMAND_LIST
    .filter(item => !options.exclude?.includes(item.id))
    .map(item => ({
      id: item.id,
      group: item.group,
      title: item.title,
      keywords: item.keywords || [],
      priority: item.priority || 0,
      handler: () => {
        try {
          ribbon.OnAction({ Id: item.btnId })
        } catch (e) {
          if (typeof console !== 'undefined') {
            console.warn(`[ribbonCommands] OnAction(${item.btnId}) failed:`, e)
          }
        }
      }
    }))

  return registerCommands(list)
}

export default {
  RIBBON_COMMAND_LIST,
  registerRibbonCommands
}
