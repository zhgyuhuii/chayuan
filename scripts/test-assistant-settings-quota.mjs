// 回归测试：助手设置保存不应因「每次写全量 46 个内置助手(~111KB)」而撑爆 localStorage 配额。
// 复现 bug：小配额下 saveAssistantSettings 写全量 → QuotaExceededError → 返回 false（“助手设置保存失败”）。
// 期望（修复后）：只持久化与默认值的差异 → 体积极小 → 保存成功；且 load 仍能还原完整配置。

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  PASS:', msg) }
  else { console.log('  FAIL:', msg); failures++ }
}

// --- 假 localStorage：带总字节配额，超出即抛 QuotaExceededError（模拟真实浏览器/WPS webview）---
function makeLocalStorage(quotaBytes) {
  const store = new Map()
  const bytes = () => {
    let n = 0
    for (const [k, v] of store) n += Buffer.byteLength(k, 'utf8') + Buffer.byteLength(v, 'utf8')
    return n
  }
  return {
    getItem(k) { return store.has(k) ? store.get(k) : null },
    setItem(k, v) {
      const next = new Map(store); next.set(String(k), String(v))
      let n = 0
      for (const [kk, vv] of next) n += Buffer.byteLength(kk, 'utf8') + Buffer.byteLength(vv, 'utf8')
      if (n > quotaBytes) {
        const e = new Error('quota exceeded'); e.name = 'QuotaExceededError'; e.code = 22
        throw e
      }
      store.set(String(k), String(v))
    },
    removeItem(k) { store.delete(String(k)) },
    _bytes: bytes,
  }
}

// 配额 60KB：放得下「差异(几百字节)+ 其它设置」，放不下全量 111KB 助手配置。
globalThis.localStorage = makeLocalStorage(60_000)
// 最小 window stub：让文件持久化路径(WPS FileSystem)优雅返回 false，模拟“文件不可用、只剩 localStorage”。
globalThis.window = {}

const { saveAssistantSettings, loadAssistantSettings, getBuiltinAssistantSettingsDefaults } =
  await import('../src/utils/assistantSettings.js')
const { _invalidateGlobalSettingsCache } = await import('../src/utils/globalSettings.js')

const defaults = getBuiltinAssistantSettingsDefaults()
const ids = Object.keys(defaults)
const targetId = ids[0]

console.log(`内置助手数: ${ids.length}, 全量 defaults 体积: ${Buffer.byteLength(JSON.stringify(defaults),'utf8')} bytes`)

// 用户只改了一个助手的一个字段
const map = loadAssistantSettings()
const settingsMap = JSON.parse(JSON.stringify(map))
settingsMap[targetId].systemPrompt = '【用户自定义】只改这一个字段'

console.log('\n[场景] 小配额(60KB) localStorage 下保存助手设置:')
const ok = saveAssistantSettings(settingsMap)
assert(ok === true, 'saveAssistantSettings 返回 true（不应因配额失败）')

// 持久化体积应该很小（只存差异，而非 111KB 全量）
const blob = globalThis.localStorage.getItem('NdGlobalSettings') || ''
console.log(`  持久化 NdGlobalSettings 体积: ${Buffer.byteLength(blob,'utf8')} bytes`)
assert(Buffer.byteLength(blob, 'utf8') < 10_000, '持久化体积 < 10KB（仅差异，而非全量）')

const persisted = JSON.parse(blob || '{}')
const storedAssistant = persisted.assistantSettings || {}
assert(Object.keys(storedAssistant).length === 1, `assistantSettings 只持久化被修改的 1 个助手（实际 ${Object.keys(storedAssistant).length}）`)
assert(!!storedAssistant[targetId], '被修改的助手 id 在持久化结果中')

console.log('\n[往返] 失效缓存后重新 load 应还原完整配置:')
_invalidateGlobalSettingsCache()
const reloaded = loadAssistantSettings()
assert(reloaded[targetId].systemPrompt === '【用户自定义】只改这一个字段', '自定义字段被正确读回')
assert(reloaded[targetId].userPromptTemplate === defaults[targetId].userPromptTemplate, '未改字段回落到默认值')
assert(JSON.stringify(reloaded[ids[1]]) === JSON.stringify(defaults[ids[1]]), '未触碰的其它助手等于默认值')
assert(Object.keys(reloaded).length === ids.length, '加载后助手数量完整（46）')

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
