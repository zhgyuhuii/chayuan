#!/usr/bin/env node
/* eslint-env node */
/**
 * mock chatop-kb — UI 场景测试用的本机知识库替身。
 * 响应形状与 chayuan-harness chatop-kb routes.js 同款,带 CORS + OPTIONS 预检
 * (等价于已合入 harness 的改动)。默认钉在端口梯首位 52582,被占自动 +1。
 */
import { createServer } from 'node:http'

const BASE = Number(process.argv[2] || 52582)

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-private-network': 'true',
}

const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      ...CORS,
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, accept',
      'access-control-max-age': '600',
    })
    res.end()
    return
  }
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const json = (code, body) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', ...CORS })
    res.end(JSON.stringify(body))
  }
  const port = server.address()?.port
  if (req.method === 'GET' && url.pathname === '/health') {
    return json(200, { ok: true, service: 'chatop-kb', port })
  }
  if (req.method === 'GET' && url.pathname === '/status') {
    return json(200, {
      ok: true,
      kbs: [
        { kbId: 'default', docs: [], vecBackend: 'local' },
        { kbId: '产品知识库', docs: [], vecBackend: 'local' },
      ],
      chain: { cloudEmbedding: false, cloudChat: false },
      service: { port, url: `http://127.0.0.1:${port}` },
    })
  }
  if (req.method === 'GET' && url.pathname === '/kbs') {
    return json(200, {
      ok: true,
      kbs: [
        { kbId: 'default', docs: 3, ready: 3, pending: 0, vecBackend: 'local' },
        { kbId: '产品知识库', docs: 2, ready: 2, pending: 0, vecBackend: 'local' },
      ],
    })
  }
  if (req.method === 'GET' && url.pathname === '/search') {
    const q = url.searchParams.get('q') ?? ''
    const kbId = url.searchParams.get('kbId') ?? 'default'
    return json(200, {
      ok: true,
      hits: [{
        chunkId: 1,
        docId: 'doc-1',
        docName: kbId === '产品知识库' ? '产品白皮书.docx' : '操作手册.docx',
        seq: 0,
        headingPath: '常见问题',
        text: `关于「${q}」:察元知识库支持本机自动发现,库「${kbId}」的检索片段。`,
      }],
      mismatch: null,
    })
  }
  if (req.method === 'POST' && url.pathname === '/ask') {
    res.writeHead(200, { 'content-type': 'text/event-stream', ...CORS })
    res.write(`data: ${JSON.stringify({ type: 'citations', citations: [] })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
    return
  }
  json(404, { ok: false })
})

for (let p = BASE; p < BASE + 5; p++) {
  const ok = await new Promise((resolve) => {
    server.once('error', () => resolve(false))
    server.listen(p, '127.0.0.1', () => resolve(true))
  })
  if (ok) {
    console.log(`mock chatop-kb listening at http://127.0.0.1:${p}`)
    break
  }
}
