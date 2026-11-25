/**
 * 工具面快照锁定（2026-11-25 审计 P3 治理）：页内智能体每回合能看到的工具面
 * 由「sidecar 目录 53+N → isToolAllowedCrossHost 过滤 → skill.tools」三道闸组成，
 * 任何一道静默变化（新工具漏过滤、内部工具泄漏、收割能力被误删）此前都无人看守。
 * 本文件在纯 node/vitest 跑，断言：
 *  1. 目录总量（新增/删除工具必须有意更新本快照）
 *  2. 被禁名单恰好等于预期（chat_turn 内部工具泄漏回归锁）
 *  3. 收割能力代表工具在列（能力不丢）
 *  4. 聚合域 enum ↔ 路由映射表一致（声明了但不可路由的形同虚设工具现形）
 *  5. 只读 action 全部无 confirmed 要求（漏配会被当写操作注入 confirmed/身份探针）
 */
import { describe, it, expect } from 'vitest'
import { TOOLS } from '../../../mcp-sidecar/lib/toolCatalog.mjs'
import { AGGREGATE_TOOL_NAMES, resolveAggregateCall } from '../../../mcp-sidecar/lib/aggregateTools.mjs'
import { isToolAllowedCrossHost, isChayuanToolAllowed } from './mcpServerRegistry.js'
import { AGGREGATE_READ_ACTIONS } from './agentCoreSkill.js'

const catalogNames = () => TOOLS.map(t => t.name)

describe('工具面快照', () => {
  it('目录总量 = 55（53 基线 + web_search + footnote；增删工具须有意更新此快照）', () => {
    expect(TOOLS.length).toBe(55)
    // 无重名
    expect(new Set(catalogNames()).size).toBe(TOOLS.length)
  })

  it('页内被禁名单恰好等于预期（chat_turn 泄漏回归锁）', () => {
    const expectedBlocked = [
      // INTERNAL：面板→基座回合派发通道，模型调它会嵌套再起回合
      'chat_turn',
      // 隐私脱敏族：页内智能体明令禁止
      'declassify_status', 'declassify_preview', 'declassify_apply', 'declassify_restore',
      // 文档生命周期：页内智能体不得换宿主窗口（document_new 已整体摘出目录，
      // 不在本快照断言范围）
      'document_open', 'document_ensure_open', 'document_activate', 'wps_launch'
    ]
    const blocked = catalogNames().filter(n => !isToolAllowedCrossHost(n))
    expect(blocked.sort()).toEqual([...expectedBlocked].sort())
  })

  it('收割能力代表工具在目录里（能力不丢）', () => {
    const representatives = [
      'web_search',       // P1 收割：网页文本搜索
      'generate_image',   // 三级生图 Tier1/Tier2
      'image_search',     // 网络搜图
      'kb_retrieve',      // 知识库
      'file_parse',       // 文件/附件
      'assistants_search',// 助手配方
      'proofread_run',    // 校对
      'template_generate',// 模板生成
      'system_fonts_list',// 系统字体
      'wps_status',       // 宿主状态
      'spreadsheet',      // ET 域
      'presentation',     // WPP 域
      'footnote'          // P2 收割：Writer 脚注/尾注
    ]
    for (const n of representatives) {
      expect(catalogNames(), `缺少能力代表工具：${n}`).toContain(n)
    }
  })

  it('聚合域 enum ↔ 路由映射一致（声明了但不可路由的形同虚设工具现形）', () => {
    expect(catalogNames()).toEqual(expect.arrayContaining(AGGREGATE_TOOL_NAMES))
    for (const domain of AGGREGATE_TOOL_NAMES) {
      const def = TOOLS.find(t => t.name === domain)
      expect(def, `聚合域缺目录定义：${domain}`).toBeTruthy()
      const actions = def.inputSchema?.properties?.action?.enum || []
      expect(actions.length, `${domain} 无 action enum`).toBeGreaterThan(0)
      for (const action of actions) {
        const spec = resolveAggregateCall(domain, { action })
        expect(spec.method, `${domain}.${action} 不可路由`).toBeTruthy()
        // 前缀一般同域，但存在有意复用（comment.add → document.add_comment 走
        // Writer 批注处理器）——只断言路由存在，不断言前缀
      }
    }
  })

  it('只读 action 全部可路由且不要求 confirmed（漏配会被当写操作）', () => {
    for (const [domain, actions] of Object.entries(AGGREGATE_READ_ACTIONS)) {
      for (const action of actions) {
        const spec = resolveAggregateCall(domain, { action })
        expect(spec.requireConfirmed, `${domain}.${action} 是只读 action 但映射带 requireConfirmed`).toBeUndefined()
      }
    }
  })

  it('宿主域归属（死代码 isChayuanToolAllowed 与前缀路由口径一致）', () => {
    expect(isChayuanToolAllowed('footnote', 'wps')).toBe(true)
    expect(isChayuanToolAllowed('footnote', 'et')).toBe(false)
    expect(isChayuanToolAllowed('spreadsheet', 'et')).toBe(true)
    expect(isChayuanToolAllowed('spreadsheet', 'wps')).toBe(false)
    expect(isChayuanToolAllowed('presentation', 'wpp')).toBe(true)
    expect(isChayuanToolAllowed('web_search', 'wps')).toBe(false) // 宿主无关工具不在域表（跨宿主面由 isToolAllowedCrossHost 管）
  })
})
