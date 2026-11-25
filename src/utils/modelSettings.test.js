/**
 * 模型「默认启用 + 配置密钥自动启用」回归锁定（2026-11-21）：
 * 启用默认值从「仅 5 家默认厂商」改为全厂商默认启用；已配置密钥但历史停在
 * enabled:false 的存量配置由 migrateAutoEnableConfiguredModels 一次性翻转。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => ({ data: {} }))

vi.mock('./globalSettings.js', () => ({
  loadGlobalSettings: () => h.data,
  saveGlobalSettings: (patch) => {
    Object.assign(h.data, patch)
    return true
  },
  getLastSaveFailureReason: () => ''
}))

vi.mock('../services/desktop/desktopStore.js', () => ({
  getDesktopModels: () => [],
  DESKTOP_PROVIDER_PREFIX: 'cy-desktop.'
}))

import {
  getModelConfig,
  saveModelConfig,
  migrateAutoEnableConfiguredModels,
  isRibbonModelEnabled,
  getModelGroupsFromSettings
} from './modelSettings.js'

const CONFIGS_KEY = 'modelConfigs'
const MIGRATED_KEY = 'modelEnabledAutoMigratedAt'

beforeEach(() => { h.data = {} })

describe('getModelConfig · 启用默认值', () => {
  it('未配置过的厂商默认启用', () => {
    expect(getModelConfig('kimi').enabled).toBe(true)
    expect(getModelConfig('some-unknown-vendor').enabled).toBe(true)
  })

  it('存量配置未显式存过 enabled → 默认启用', () => {
    h.data[CONFIGS_KEY] = { kimi: { apiKey: 'sk-x', apiUrl: 'https://x/v1' } }
    expect(getModelConfig('kimi').enabled).toBe(true)
  })

  it('用户显式勾掉的（enabled:false）保持停用', () => {
    h.data[CONFIGS_KEY] = { kimi: { apiKey: 'sk-x', enabled: false } }
    expect(getModelConfig('kimi').enabled).toBe(false)
  })
})

describe('migrateAutoEnableConfiguredModels · 一次性迁移', () => {
  it('已配置密钥但停用的存量配置被翻转启用', () => {
    h.data[CONFIGS_KEY] = {
      kimi: { apiKey: 'sk-x', apiUrl: 'https://x/v1', enabled: false },
      deepseek: { apiKey: '', apiUrl: '', enabled: false },
      ollama: { apiKey: '', apiUrl: 'http://127.0.0.1:11434/v1', enabled: false }
    }
    expect(migrateAutoEnableConfiguredModels()).toBe(true)
    const configs = h.data[CONFIGS_KEY]
    expect(configs.kimi.enabled).toBe(true)
    // 未配置密钥/地址的不翻转
    expect(configs.deepseek.enabled).toBe(false)
    // 本地类（ollama）填了地址即算已配置
    expect(configs.ollama.enabled).toBe(true)
  })

  it('幂等：迁移过写标记，重复调用不再翻转', () => {
    h.data[CONFIGS_KEY] = { kimi: { apiKey: 'sk-x', enabled: false } }
    expect(migrateAutoEnableConfiguredModels()).toBe(true)
    // 迁移后用户又手动停用 → 再次调用不得翻回
    h.data[CONFIGS_KEY].kimi.enabled = false
    expect(migrateAutoEnableConfiguredModels()).toBe(false)
    expect(h.data[CONFIGS_KEY].kimi.enabled).toBe(false)
    expect(typeof h.data[MIGRATED_KEY]).toBe('string')
  })

  it('迁移后已配置厂商进入模型下拉分组', () => {
    h.data[CONFIGS_KEY] = {
      kimi: { apiKey: 'sk-x', apiUrl: 'https://x/v1', enabled: false, modelSeries: ['moonshot-v1-8k'] }
    }
    expect(getModelGroupsFromSettings('chat')).toHaveLength(0)
    migrateAutoEnableConfiguredModels()
    expect(getModelGroupsFromSettings('chat')).toHaveLength(1)
  })
})

describe('isRibbonModelEnabled · 默认启用语义', () => {
  it('无配置/未显式停用的 provider 视为启用', () => {
    expect(isRibbonModelEnabled('unknown-model')).toBe(true)
  })

  it('显式停用 → false', () => {
    h.data[CONFIGS_KEY] = { DEEPSEEK: { apiKey: 'sk-x', enabled: false } }
    expect(isRibbonModelEnabled('deepseek-v3')).toBe(false)
  })

  it('大小写无关：存量键为小写 deepseek 也能命中停用状态', () => {
    h.data[CONFIGS_KEY] = { deepseek: { apiKey: 'sk-x', enabled: false } }
    expect(isRibbonModelEnabled('deepseek-v3')).toBe(false)
  })
})

describe('saveModelConfig · 停用状态落盘', () => {
  it('勾掉后保存，enabled:false 显式持久化不被默认值覆盖', () => {
    saveModelConfig('kimi', { apiKey: 'sk-x', enabled: false })
    expect(getModelConfig('kimi').enabled).toBe(false)
    saveModelConfig('kimi', { apiKey: 'sk-x', enabled: true })
    expect(getModelConfig('kimi').enabled).toBe(true)
  })
})
