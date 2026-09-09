#!/usr/bin/env node

/**
 * starPrompt 状态机冒烟测试 — 移植 chayuan-office 语义的行为锁定。
 * 用法：node scripts/test-star-prompt-smoke.mjs
 */

globalThis.localStorage = (() => {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  }
})()

const mod = await import('../src/utils/starPrompt.js')
const {
  asStarPromptState, withChatOpen, shouldShowStarPrompt, withShown, withResolved,
  recordDialogOpen, markShown, resolveStarPrompt, isStarredResolved,
  MIN_OPENS, MAX_SHOWS, GITHUB_REPO_URL
} = mod

let failures = 0
function assert(name, cond) {
  if (cond) console.log(`✓ ${name}`)
  else { console.log(`✗ ${name}`); failures += 1 }
}

// S1 价值门槛：MIN_OPENS 前不出现
{
  localStorage.removeItem('nd_github_star_prompt')
  let s = asStarPromptState(null)
  for (let i = 0; i < MIN_OPENS - 1; i++) s = withChatOpen(s)
  assert('S1 未达门槛不出现', shouldShowStarPrompt(s) === false)
  s = withChatOpen(s)
  assert('S1 达到门槛出现', shouldShowStarPrompt(s) === true)
}

// S2 recordDialogOpen 集成：第 MIN_OPENS 次打开触发
{
  localStorage.removeItem('nd_github_star_prompt')
  let show = false
  for (let i = 0; i < MIN_OPENS; i++) show = recordDialogOpen().show
  assert('S2 第 N 次对话页打开触发提示', show === true)
}

// S3 明确表态永久解决，后续打开不再出现
{
  resolveStarPrompt('starred')
  assert('S3 已点赞后不再出现', recordDialogOpen().show === false && isStarredResolved() === true)
}

// S4 终身最多 MAX_SHOWS 次（「以后再说」不解决）
{
  localStorage.removeItem('nd_github_star_prompt')
  let s = asStarPromptState(null)
  for (let i = 0; i < MIN_OPENS; i++) s = withChatOpen(s)
  s = withShown(s) // 第 1 次展示
  s = withResolved(s, 'dismissed') // 以后再说
  const t0 = Date.now()
  assert('S4 静默期内不出现', shouldShowStarPrompt(s, t0) === false)
  const after14d = t0 + 15 * 24 * 60 * 60 * 1000
  assert('S4 静默期过后再出现一次', shouldShowStarPrompt(s, after14d) === true)
  s = withShown(s) // 第 2 次展示
  assert('S4 达到终身上限后不再出现', shouldShowStarPrompt(s, after14d + 1000) === false)
  assert('S4 上限即 MAX_SHOWS', MAX_SHOWS === 2)
}

// S5 计数在已解决后冻结
{
  localStorage.removeItem('nd_github_star_prompt')
  let s = withResolved(asStarPromptState({ chatOpens: 1 }), 'starred')
  s = withChatOpen(s)
  assert('S5 已解决不再计数', (s.chatOpens ?? 0) === 1)
}

// S6 容错：损坏数据不炸
{
  localStorage.setItem('nd_github_star_prompt', '{bad json')
  assert('S6 损坏数据返回空态', JSON.stringify(asStarPromptState(JSON.parse('null'))) === '{}')
  const r = recordDialogOpen()
  assert('S6 recordDialogOpen 容错', r.show === false && r.chatOpens === 1)
}

// S7 仓库地址正确
assert('S7 仓库地址', GITHUB_REPO_URL === 'https://github.com/zhgyuhuii/chayuan')

console.log(failures === 0 ? '\n全部通过 ✓' : `\n${failures} 项失败 ✗`)
process.exit(failures === 0 ? 0 : 1)
