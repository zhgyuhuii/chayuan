import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { copyFile } from "wpsjs/vite_plugins"
import { readFileSync } from 'node:fs'
import { syncUserManual } from './scripts/sync-user-manual.mjs'

// 版本真源:package.json(打包脚本 build-linux-deb / build-macos-pkg 也从这里取)。
// 注入到前端 __APP_VERSION__,供心跳(runtimeSync)上报真实版本,避免硬编码漂移。
const pkgVersion = (() => {
  try {
    return JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version || '0.0.0'
  } catch {
    return '0.0.0'
  }
})()

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

function createUserManualSyncPlugin() {
  return {
    name: 'sync-user-manual',
    buildStart() {
      syncUserManual()
    },
    configureServer() {
      syncUserManual()
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  base:'./',
  define: {
    __APP_VERSION__: JSON.stringify(pkgVersion),
  },
  plugins: [
    createUserManualSyncPlugin(),
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
  assetsInclude: ['**/*.md'],
  build: {
    target: 'es2018',
    rollupOptions: {
      output: {
        // 仅拆 node_modules 供应商，不拆 src(拆 src 易因共享依赖反复打包而适得其反)。
        // 目的:把体积大且仅在弹窗路由用的 @vue-flow 从首屏 vue 核心里分出，
        // 让 vue 核心可长缓存、首屏入口 chunk 更小。src 由 rollup 自行决定。
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@vue-flow')) return 'vendor-vueflow'
          if (id.includes('/vue/') || id.includes('/@vue/') || id.includes('vue-router')) return 'vendor-vue'
          return undefined
        }
      }
    }
  },
  server: {
    host: '0.0.0.0'
  }
})
