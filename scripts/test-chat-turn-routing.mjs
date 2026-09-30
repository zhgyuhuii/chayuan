#!/usr/bin/env node
/**
 * chat.turn 路由单测：ribbon:<host> 目标只匹配宿主主页面（ribbon 基座），
 * 聊天面板 agent（windowId 带 /ai-assistant 路由）绝不接chat 回合——
 * 面板页在文档切换时被 WPS 重挂载，不能承载跨切换的后台回合。
 *
 * 纯内存验证，不起 sidecar。
 */
import assert from 'node:assert/strict'
import { createAgentHub } from '../mcp-sidecar/lib/agentHub.mjs'

const logs = []
const hub = createAgentHub({ logger: (e) => logs.push(e) })
// 显式回收所有「预期超时」的 callAgent promise：node 24 下未处理拒绝 = 进程崩溃
const expectedTimeouts = []
const expectTimeout = (promise) => {
  expectedTimeouts.push(promise.catch(function () {}))
  return promise
}

// 1) 注册同一宿主（et）的两个 agent：基座 + 聊天面板
const base = hub.register({ agentId: 'base-et', addonType: 'et', windowId: 'ribbon@#/' })
assert.equal(base.ok, true, '基座注册成功')

const pane = hub.register({
  agentId: 'pane-et',
  addonType: 'et',
  windowId: 'ribbon@#/ai-assistant?mode=taskpane&dock=left'
})
assert.equal(pane.ok, true, '面板注册成功')

// 2) ribbon:et 目标的 job：基座 poll 拿到，面板 poll 拿不到
{
  const p = hub.callAgent('chat.turn', { turnId: 't1' }, { target: 'ribbon:et', timeoutMs: 5000 })
  const got = await hub.poll('base-et', 1000)
  assert.ok(got?.job, '基座收到 chat.turn job')
  assert.equal(got.job.method, 'chat.turn')
  hub.submitResult({ jobId: got.job.jobId, agentId: 'base-et', result: { ok: true, accepted: true } })
  const ack = await p
  assert.equal(ack?.accepted, true, 'ack 回到调用方')
}

// 3) 面板 poll 永远等不到 ribbon: 目标（转空即超时返回 null job）
{
  expectTimeout(hub.callAgent('chat.turn', { turnId: 't2' }, { target: 'ribbon:et', timeoutMs: 3000 }))
  const got = await hub.poll('pane-et', 800)
  assert.equal(got?.job, null, '面板不接 chat.turn')
}

// 4) 宿主路由不受影响：et job 仍可落到面板（旧契约保持）
{
  const p = hub.callAgent('spreadsheet.status', {}, { timeoutMs: 5000 })
  const got = await hub.poll('pane-et', 1000)
  assert.ok(got?.job, 'et 宿主 job 仍可派给面板 agent（旧行为）')
  hub.submitResult({ jobId: got.job.jobId, agentId: 'pane-et', result: { ok: true } })
  await p
}

// 5) 宿主隔离：ribbon:et 的 job 不会被 wpp 基座接走
{
  hub.register({ agentId: 'base-wpp', addonType: 'wpp', windowId: 'ribbon@#/' })
  expectTimeout(hub.callAgent('chat.turn', { turnId: 't3' }, { target: 'ribbon:et', timeoutMs: 3000 }))
  const got = await hub.poll('base-wpp', 800)
  assert.equal(got?.job, null, 'wpp 基座不接 et 的 chat.turn')
}

// 6) 基座忙时面板也不补位：chat.turn 宁可排队/超时，不给面板
{
  // 占住基座：让它有 waiter 之前先注入一个不匹配的 job，再让基座无 waiter
  expectTimeout(hub.callAgent('chat.turn', { turnId: 't4' }, { target: 'ribbon:et', timeoutMs: 500 }))
  const got = await hub.poll('pane-et', 300)
  assert.equal(got?.job, null, '基座无 waiter 时面板不补位接 chat.turn')
}

await Promise.all(expectedTimeouts)
console.log('ALL CHAT-TURN ROUTING TESTS PASSED')
