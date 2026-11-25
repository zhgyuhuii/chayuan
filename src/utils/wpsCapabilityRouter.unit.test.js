/**
 * 能力路由宿主守卫回归锁定（2026-11-25 表格宿主劫持治理）：
 * 「生成一张飞机图 插入表格中」在 ET 宿主曾被规则劫持成 Writer 的 insert-table
 * →「当前环境不支持插入表格」。本文件锁死三类口径：
 *  1. ET/WPP：Writer 文档域 + 保存/加密族（执行器 getActiveDocument，Writer 专属，
 *     后台开着 Writer 文档时还会静默保存错对象）全部短路；模板族保留（执行器宿主感知）
 *  2. wps：Writer 规则原语义不变；「导出到X」不再劫持为另存（export 语义归 MCP 工具）
 *  3. 缺省 host='wps'：旧调用方零改动
 */
import { describe, it, expect } from 'vitest'
import { routeWpsCapabilityByRule, WRITER_ONLY_CAPABILITY_KEYS } from './wpsCapabilityRouter.js'

describe('能力路由宿主守卫', () => {
  it('ET：用户原句/插入表格/保存族/加密族全部不劫持（落 MCP agent 轨）', () => {
    expect(routeWpsCapabilityByRule('使用模型生成图像生成一架飞机 插入表格中', { host: 'et' })).toBe(null)
    expect(routeWpsCapabilityByRule('插入表格', { host: 'et' })).toBe(null)
    expect(routeWpsCapabilityByRule('保存文档', { host: 'et' })).toBe(null)
    expect(routeWpsCapabilityByRule('另存为', { host: 'et' })).toBe(null)
    expect(routeWpsCapabilityByRule('给文档加密', { host: 'et' })).toBe(null)
    expect(routeWpsCapabilityByRule('给这段加粗', { host: 'et' })).toBe(null)
  })

  it('ET：模板族保留（执行器宿主感知）', () => {
    expect(routeWpsCapabilityByRule('把这张表存为模板', { host: 'et' })?.capabilityKey).toBe('save-current-as-template')
    expect(routeWpsCapabilityByRule('用模板生成一份报告', { host: 'et' })?.capabilityKey).toBe('generate-from-template')
    expect(routeWpsCapabilityByRule('确认执行模板计划', { host: 'et' })?.capabilityKey).toBe('execute-template-plan')
    expect(routeWpsCapabilityByRule('用模板新建一份空白表', { host: 'et' })?.capabilityKey).toBe('new-document-from-template')
  })

  it('WPP：与 ET 同口径', () => {
    expect(routeWpsCapabilityByRule('给这段加粗', { host: 'wpp' })).toBe(null)
    expect(routeWpsCapabilityByRule('插入表格', { host: 'wpp' })).toBe(null)
    expect(routeWpsCapabilityByRule('用模板生成一份PPT', { host: 'wpp' })?.capabilityKey).toBe('generate-from-template')
  })

  it('wps：Writer 规则原语义不变', () => {
    expect(routeWpsCapabilityByRule('插入表格', { host: 'wps' })?.capabilityKey).toBe('insert-table')
    expect(routeWpsCapabilityByRule('保存文档', { host: 'wps' })?.capabilityKey).toBe('save-document')
    expect(routeWpsCapabilityByRule('给文档加密', { host: 'wps' })?.capabilityKey).toBe('encrypt-document')
    expect(routeWpsCapabilityByRule('插入分页符', { host: 'wps' })?.capabilityKey).toBe('insert-page-break')
  })

  it('wps：「导出到X」不再劫持为另存（export 语义归 MCP export 工具）', () => {
    expect(routeWpsCapabilityByRule('把这个文档导出到PDF', { host: 'wps' })).toBe(null)
    expect(routeWpsCapabilityByRule('导出到CSV', { host: 'wps' })).toBe(null)
    // 「另存为」语义保留
    expect(routeWpsCapabilityByRule('另存为', { host: 'wps' })?.capabilityKey).toBe('save-document-as')
  })

  it('缺省 host=wps：旧调用方零改动', () => {
    expect(routeWpsCapabilityByRule('插入表格')?.capabilityKey).toBe('insert-table')
    expect(routeWpsCapabilityByRule('保存文档')?.capabilityKey).toBe('save-document')
  })

  it('WRITER_ONLY 名单覆盖保存/加密族（LLM 路由同口径过滤依据）', () => {
    for (const key of [
      'insert-table', 'insert-page-break', 'insert-blank-page',
      'save-document', 'save-document-as', 'save-document-with-dialog',
      'encrypt-document', 'encrypt-document-with-dialog', 'decrypt-document'
    ]) {
      expect(WRITER_ONLY_CAPABILITY_KEYS.has(key), `缺少 ${key}`).toBe(true)
    }
    // 宿主感知能力不在名单（模板族在 ET 可用）
    for (const key of ['save-current-as-template', 'generate-from-template', 'new-document-from-template', 'execute-template-plan']) {
      expect(WRITER_ONLY_CAPABILITY_KEYS.has(key), `${key} 不应标记为 Writer 专属`).toBe(false)
    }
  })
})
