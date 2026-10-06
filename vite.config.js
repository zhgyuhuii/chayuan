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


// dev:debug 三宿主 ribbon 分发：WPS 在线模式对每个宿主都拉 origin/ribbon.xml（同一份
// 文字版）——ET/WPP 顶部 tab 由 getVisible 按 detectAddonType 判定，但 ribbon 回调运行前
// tab 已按"不可见"被裁剪（在线模式裁剪时机早于 webview JS），顶部助手全消失（实测）。
// 此中间件按查询参数伺服对应宿主的 ribbon XML：注册 URL 带 ?ribbon=et 时 WPS 拉到的
// 就是 ribbon-et.xml。
function ribbonByHostDevPlugin() {
  return {
    name: 'chayuan-ribbon-by-host',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost')
        const host = url.searchParams.get('ribbon')
        if (!host || !['wps', 'et', 'wpp'].includes(host)) return next()
        const file = host === 'wps' ? 'ribbon.xml' : `ribbon-${host}.xml`
        try {
          const xml = readFileSync(new URL(`./public/${file}`, import.meta.url), 'utf8')
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/xml; charset=utf-8')
          res.end(xml)
        } catch {
          res.statusCode = 404
          res.end('ribbon xml not found')
        }
      })
    }
  }
}

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
    ribbonByHostDevPlugin(),
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
