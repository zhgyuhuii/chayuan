import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { copyFile } from "wpsjs/vite_plugins"

function createDashscopeDevProxy() {
  return {
    name: 'dashscope-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/__dev_proxy__/remote', async (req, res) => {
        try {
          const method = String(req.method || 'GET').toUpperCase()
          const url = new URL(req.url || '', 'http://localhost')
          const target = url.searchParams.get('url') || ''
          if (!target) {
            res.statusCode = 400
            res.end('missing target url')
            return
          }
          const parsed = new URL(target)
          if (!/aliyuncs\.com$/i.test(parsed.hostname)) {
            res.statusCode = 403
            res.end('forbidden target host')
            return
          }

          const chunks = []
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          }
          const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined

          const headers = {}
          const passHeaders = [
            'authorization',
            'content-type',
            'x-dashscope-async'
          ]
          passHeaders.forEach((key) => {
            const value = req.headers[key]
            if (value) headers[key] = value
          })

          const upstream = await fetch(target, {
            method,
            headers,
            body: ['GET', 'HEAD'].includes(method) ? undefined : body
          })

          res.statusCode = upstream.status
          upstream.headers.forEach((value, key) => {
            if (key.toLowerCase() === 'content-encoding') return
            res.setHeader(key, value)
          })
          const arrayBuffer = await upstream.arrayBuffer()
          res.end(Buffer.from(arrayBuffer))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({
            error: error?.message || String(error)
          }))
        }
      })
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  base:'./',
  plugins: [
    copyFile({
      src: 'manifest.xml',
      dest: 'manifest.xml',
    }),
    vue(),
    createDashscopeDevProxy()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0'
  }
})
