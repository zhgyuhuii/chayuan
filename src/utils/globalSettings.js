/**
 * 全局设置 - 持久化存储
 * 注意：WPS PluginStorage 在加载项关闭后不持久化，必须使用文件或 localStorage
 * 策略：优先文件（数据路径下 settings.json），备用 localStorage（跨会话持久化）
 */

import { getEffectiveDataDir, joinDataPath, ensureDir, getDefaultDataPath } from './dataPathSettings.js'

const FILE_NAME = 'settings.json'
const PLUGIN_STORAGE_KEY = 'NdGlobalSettings'
const LOCAL_STORAGE_KEY = 'NdGlobalSettings'

function getSettingsBaseDir() {
  return getEffectiveDataDir() || getDefaultDataPath()
}

function getSettingsPath() {
  const base = getSettingsBaseDir()
  if (!base) return null
  const sep = base.includes('\\') ? '\\' : '/'
  const part = (FILE_NAME || '').replace(/^[/\\]+/, '').replace(/[/\\]+/g, sep)
  return base + sep + part
}

function loadFromFile() {
  try {
    const path = joinDataPath(FILE_NAME) || getSettingsPath()
    if (!path) return null
    const fs = window.Application?.FileSystem
    if (!fs?.readFileString && !fs?.ReadFile) return null
    const raw = fs.readFileString ? fs.readFileString(path) : fs.ReadFile(path)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

function loadFromLocalStorage() {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw === null || raw === '') return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch (e) {
    return null
  }
}

function loadFromPluginStorage() {
  try {
    const raw = window.Application?.PluginStorage?.getItem(PLUGIN_STORAGE_KEY)
    if (raw === undefined || raw === null || raw === '') return null
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch (e) {
    return null
  }
}

function loadRaw() {
  return loadFromFile() || loadFromLocalStorage() || loadFromPluginStorage()
}

function isAbsolutePath(p) {
  if (!p || typeof p !== 'string') return false
  const s = p.trim()
  return s.startsWith('/') || /^[A-Za-z]:[\\/]/.test(s)
}

function saveToFile(obj) {
  try {
    const path = joinDataPath(FILE_NAME) || getSettingsPath()
    if (!path) return false
    if (!isAbsolutePath(path)) return false
    const base = getSettingsBaseDir()
    if (!base) return false
    const fs = window.Application?.FileSystem
    if (!fs?.writeFileString && !fs?.WriteFile) return false
    ensureDir(fs, base)
    const json = JSON.stringify(obj, null, 2)
    return !!(fs.writeFileString ? fs.writeFileString(path, json) : fs.WriteFile(path, json))
  } catch (e) {
    console.warn('globalSettings saveToFile:', e)
    return false
  }
}

function saveToLocalStorage(obj) {
  try {
    if (typeof localStorage === 'undefined') return false
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(obj))
    return true
  } catch (e) {
    return false
  }
}

function saveToPluginStorage(obj) {
  try {
    if (!window.Application?.PluginStorage) return false
    window.Application.PluginStorage.setItem(PLUGIN_STORAGE_KEY, JSON.stringify(obj))
    return true
  } catch (e) {
    return false
  }
}

/**
 * 加载全局设置
 */
export function loadGlobalSettings() {
  const raw = loadRaw()
  return raw && typeof raw === 'object' ? raw : {}
}

/**
 * 保存全局设置（合并到现有设置）
 * 同时写入文件和 localStorage，确保关闭 WPS 后数据不丢失
 */
export function saveGlobalSettings(partial) {
  const current = loadGlobalSettings()
  const merged = { ...current, ...(partial && typeof partial === 'object' ? partial : {}) }
  let fileOk = false
  let storageOk = false
  fileOk = saveToFile(merged)
  storageOk = saveToLocalStorage(merged)
  saveToPluginStorage(merged)
  if (!fileOk && !storageOk) {
    console.error('globalSettings: 保存失败（文件和 localStorage 均不可用）')
    return false
  }
  if (!fileOk) console.warn('globalSettings: 文件保存失败，已保存到 localStorage')
  return true
}
