/**
 * providerFetch 直连失败自动回落 sidecar /proxy/chat 的回归锁定
 * （收割 chayuan-office 桌面版模型代理机制：预检死厂商经本机 Node 转发）
 *
 * relay 标记是 chatApi.js 模块级 Set（会话级记忆），因此每个用例用独立
 * providerId 串行推进，互相不串扰。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const fetchMock = vi.fn()
const sidecarPostRawMock = vi.fn()

vi.mock('./modelSettings.js', () => ({
  getModelConfig: vi.fn(() => ({ apiKey: 'test-key', apiUrl: 'https://open.bigmodel.cn/api/paas/v4', enabled: true })),
  RIBBON_MODEL_TO_PROVIDER: {},
  parseModelCompositeId: vi.fn(() => null)
}))

vi.mock('../services/desktop/desktopStore.js', () => ({
  getBaseUrl: vi.fn(() => 'http://127.0.0.1:62581'),
  isDesktopProviderId: vi.fn((id) => String(id || '').startsWith('CHAYUAN_DESKTOP::'))
}))

vi.mock('../services/mcpBridge/mcpHttpClient.js', () => ({
  sidecarPostRaw: (...args) => sidecarPostRawMock(...args)
}))

// chatApi 在 mock 生效后引入（vitest 会 hoist vi.mock）
const { chatCompletion, streamChatCompletion, relayAwareFetch } = await import('./chatApi.js')

const MSGS = [{ role: 'user', content: 'hi' }]

/** 直连 fetch 的典型预检死亡：浏览器网络层 TypeError */
const CORS_DEAD = () => { throw new TypeError('Failed to fetch') }

/** 够用的最小 Response 形状（非流式：text()；流式：body.getReader()） */
function fakeResponse({ ok = true, status = 200, text = '', sseChunks = [] } = {}) {
  if (sseChunks.length) {
    const encoder = new TextEncoder()
    let i = 0
    return {
      ok, status,
      body: { getReader: () => ({ read: async () => i < sseChunks.length ? { done: false, value: encoder.encode(sseChunks[i++]) } : { done: true, value: undefined } }) }
    }
  }
  return { ok, status, text: async () => text, body: null }
}

const UPSTREAM_JSON = JSON.stringify({
  choices: [{ message: { role: 'assistant', content: 'OK' } }]
})
const SIDECAR_RELAY_RES = () => fakeResponse({ text: UPSTREAM_JSON })

beforeEach(() => {
  fetchMock.mockReset()
  sidecarPostRawMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

describe('chatCompletion 回落链', () => {
  it('直连成功 → 不触碰 sidecar（正常厂商零行为变化）', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ text: UPSTREAM_JSON }))
    const out = await chatCompletion({ providerId: 'P-DIRECT-OK', modelId: 'glm-4.6', messages: MSGS })
    expect(out).toBe('OK')
    expect(sidecarPostRawMock).not.toHaveBeenCalled()
  })

  it('直连 TypeError（预检死）→ 自动经 sidecar 转发并成功', async () => {
    fetchMock.mockImplementationOnce(CORS_DEAD)
    sidecarPostRawMock.mockResolvedValueOnce(SIDECAR_RELAY_RES())
    const out = await chatCompletion({ providerId: 'P-RELAY-1', modelId: 'glm-4.6', messages: MSGS })
    expect(out).toBe('OK')
    expect(sidecarPostRawMock).toHaveBeenCalledTimes(1)
    const [path, payload] = sidecarPostRawMock.mock.calls[0]
    expect(path).toBe('/proxy/chat')
    expect(payload.url).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions')
    expect(payload.headers.Authorization).toBe('Bearer test-key')
    expect(payload.body.model).toBe('glm-4.6')
    expect(payload.stream).toBe(false)
  })

  it('relay 记忆：第二次调用不再尝试直连', async () => {
    // providerId 与上一用例相同 → _relayProviders 已标记
    sidecarPostRawMock.mockResolvedValueOnce(SIDECAR_RELAY_RES())
    const callsBefore = fetchMock.mock.calls.length
    await chatCompletion({ providerId: 'P-RELAY-1', modelId: 'glm-4.6', messages: MSGS })
    expect(fetchMock.mock.calls.length).toBe(callsBefore)
    expect(sidecarPostRawMock).toHaveBeenCalledTimes(1)
  })

  it('sidecar 也不可达 → 抛带行动指引的错误', async () => {
    fetchMock.mockImplementationOnce(CORS_DEAD)
    sidecarPostRawMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(chatCompletion({ providerId: 'P-SIDECAR-DOWN', modelId: 'glm-4.6', messages: MSGS }))
      .rejects.toThrow(/sidecar.*62588/)
  })

  it('sidecar 转发层 502（上游真不可达）→ 透出 sidecar 侧原因', async () => {
    fetchMock.mockImplementationOnce(CORS_DEAD)
    sidecarPostRawMock.mockResolvedValueOnce(fakeResponse({ ok: false, status: 502, text: JSON.stringify({ error: 'upstream_unreachable', message: 'connect ECONNRESET' }) }))
    await expect(chatCompletion({ providerId: 'P-UPSTREAM-DOWN', modelId: 'glm-4.6', messages: MSGS }))
      .rejects.toThrow(/无法连接上游.*ECONNRESET/)
  })

  it('本地类 provider 直连失败 → 不回落（连不上本地服务应直说）', async () => {
    fetchMock.mockImplementationOnce(CORS_DEAD)
    await expect(chatCompletion({ providerId: 'ollama', modelId: 'qwen2.5', messages: MSGS }))
      .rejects.toThrow(TypeError)
    expect(sidecarPostRawMock).not.toHaveBeenCalled()
  })

  it('直连 HTTP 4xx/5xx（非网络层死亡）→ 不回落，走原有错误翻译', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ ok: false, status: 401, text: JSON.stringify({ error: { message: 'bad key' } }) }))
    await expect(chatCompletion({ providerId: 'P-AUTH-FAIL', modelId: 'glm-4.6', messages: MSGS }))
      .rejects.toThrow(/bad key|密钥|失败/)
    expect(sidecarPostRawMock).not.toHaveBeenCalled()
  })
})

describe('relayAwareFetch（设置页探测/拉模型等通用入口）', () => {
  it('GET 直连死 → 转发带 method:GET、body:null', async () => {
    fetchMock.mockImplementationOnce(CORS_DEAD)
    sidecarPostRawMock.mockResolvedValueOnce(fakeResponse({ text: JSON.stringify({ data: [{ id: 'glm-4.6' }] }) }))
    const res = await relayAwareFetch('https://open.bigmodel.cn/api/paas/v4/v1/models',
      { method: 'GET', headers: { Authorization: 'Bearer test-key' } },
      { providerId: 'P-GET-RELAY' })
    const data = JSON.parse(await res.text())
    expect(data.data).toHaveLength(1)
    const [path, payload] = sidecarPostRawMock.mock.calls[0]
    expect(path).toBe('/proxy/chat')
    expect(payload.method).toBe('GET')
    expect(payload.body).toBeNull()
    expect(payload.headers.Authorization).toBe('Bearer test-key')
  })

  it('GET 直连成功 → 不触碰 sidecar', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ text: '{"data":[]}' }))
    const res = await relayAwareFetch('https://api.agnes-ai.cn/v1/models',
      { method: 'GET', headers: { Authorization: 'Bearer k' } },
      { providerId: 'P-GET-DIRECT' })
    expect(await res.text()).toBe('{"data":[]}')
    expect(sidecarPostRawMock).not.toHaveBeenCalled()
  })

  it('POST + JSON 字符串 body → 转发按 JSON 桥接', async () => {
    fetchMock.mockImplementationOnce(CORS_DEAD)
    sidecarPostRawMock.mockResolvedValueOnce(SIDECAR_RELAY_RES())
    await relayAwareFetch('https://open.bigmodel.cn/api/paas/v4/chat/completions',
      { method: 'POST', headers: { Authorization: 'Bearer k' }, body: JSON.stringify({ model: 'glm-4.6' }) },
      { providerId: 'P-POST-GENERIC' })
    const [, payload] = sidecarPostRawMock.mock.calls[0]
    expect(payload.method).toBe('POST')
    expect(payload.body).toEqual({ model: 'glm-4.6' })
  })
})

describe('streamChatCompletion 回落链', () => {
  it('直连死 → 转发 stream:true，SSE 逐块解析不受影响', async () => {
    fetchMock.mockImplementationOnce(CORS_DEAD)
    sidecarPostRawMock.mockResolvedValueOnce(fakeResponse({
      sseChunks: [
        'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
        'data: [DONE]\n\n'
      ]
    }))
    const chunks = []
    await new Promise((resolve, reject) => {
      streamChatCompletion({
        providerId: 'P-STREAM-RELAY', modelId: 'glm-4.6', messages: MSGS,
        onChunk: (c) => chunks.push(c),
        onDone: resolve,
        onError: (m) => reject(new Error(m))
      }).catch(reject)
    })
    expect(chunks.join('')).toBe('你好')
    const [, payload] = sidecarPostRawMock.mock.calls[0]
    expect(payload.stream).toBe(true)
    expect(payload.body.stream).toBe(true)
  })
})
