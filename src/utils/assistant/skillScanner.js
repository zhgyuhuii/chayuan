/**
 * skillScanner — Skill 插件目录扫描自动注册
 *
 * v2 计划 P5「Skill 插件机制(目录扫描自动注册)」。
 * 约定:src/skills/*.js 文件 default export 一个 skill 对象,
 * 启动期由 scanAndRegisterSkills() 一次性导入并注册到 externalAssistants 系统。
 *
 * Skill 对象 schema:
 *   {
 *     id, label, icon, systemPrompt, userPromptTemplate, ...  // 同 builtin assistant
 *     skill: {
 *       version: '1.0.0',
 *       author?, repoUrl?, description?, tags?
 *     }
 *   }
 *
 * 由于 Vite 不支持运行时动态 import 任意路径,这里使用 import.meta.glob
 * 在编译期把 src/skills/ 目录下的所有 .js 收齐成一个 modules 字典。
 *
 * 用户写新 skill:在 src/skills/ 下加一个 .js 文件,启动后自动注册。
 */

import { registerExternalAssistant } from './externalAssistants.js'

/**
 * 扫描 src/skills/*.js 并注册到 external 系统。
 *
 *   options.namespace        默认 'ext.skill.'(自动加到 id 前)
 *   options.dryRun           true → 不真注册,只返回 metadata
 *
 *   返回 { scanned, registered, errors: [] }
 */
export async function scanAndRegisterSkills(options = {}) {
  const namespace = options.namespace || 'ext.skill.'
  const dryRun = options.dryRun === true

  // Vite 静态 glob:在编译期解析,运行时立即可用
  // 即使目录不存在或没有匹配,也只是返回空 dict
  let modules = {}
  try {
    // eslint-disable-next-line no-undef
    if (typeof import.meta?.glob === 'function') {
      modules = import.meta.glob('/src/skills/*.js', { eager: true })
    }
  } catch (_) {
    // 非 Vite 环境(测试)→ 走空字典
  }

  const summary = { scanned: 0, registered: 0, errors: [], skills: [] }

  for (const [path, mod] of Object.entries(modules || {})) {
    summary.scanned += 1
    const skill = mod?.default
    if (!skill || !skill.id) {
      summary.errors.push({ path, error: '缺少 default export 或 id' })
      continue
    }
    const cloneId = `${namespace}${skill.id}`
    const merged = {
      ...skill,
      id: cloneId,
      _source: 'skill-plugin',
      _path: path
    }
    summary.skills.push({
      path,
      id: cloneId,
      label: skill.label,
      version: skill.skill?.version
    })
    if (dryRun) continue
    const result = registerExternalAssistant(merged)
    if (result.ok) summary.registered += 1
    else summary.errors.push({ path, error: result.error })
  }

  return summary
}

/**
 * 从一个内存中的 skill 对象数组手动批量加载(用于测试或非 Vite 环境)。
 */
export function registerSkillsFromArray(skills, options = {}) {
  const namespace = options.namespace || 'ext.skill.'
  const summary = { scanned: 0, registered: 0, errors: [] }
  for (const skill of (skills || [])) {
    summary.scanned += 1
    if (!skill?.id) {
      summary.errors.push({ skill, error: '缺少 id' })
      continue
    }
    const r = registerExternalAssistant({
      ...skill,
      id: `${namespace}${skill.id}`,
      _source: 'skill-plugin'
    })
    if (r.ok) summary.registered += 1
    else summary.errors.push({ skill, error: r.error })
  }
  return summary
}

export default {
  scanAndRegisterSkills,
  registerSkillsFromArray
}
