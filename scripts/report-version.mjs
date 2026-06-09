#!/usr/bin/env node
/**
 * 把本项目(察元AI文档助手 / chayuan-wps)的当前版本自动上报给官网。
 * 官网落库到 reportedVersions.chayuan,首页据此显示真实版本(无需手填、无需写死)。
 *
 * 用法(发布 / CI 时执行):
 *   CHAYUAN_REPORT_URL=https://aidooo.com \
 *   CHAYUAN_REPORT_TOKEN=<与官网服务端 CHAYUAN_REPORT_TOKEN 一致的密钥> \
 *   node scripts/report-version.mjs
 *
 * 版本来源:package.json 的 version 字段。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'))
const version = pkg.version

const base = (process.env.CHAYUAN_REPORT_URL || 'https://aidooo.com').replace(/\/+$/, '')
const token = process.env.CHAYUAN_REPORT_TOKEN
if (!token) {
  console.error('[report-version] 缺少 CHAYUAN_REPORT_TOKEN 环境变量,跳过上报')
  process.exit(0) // 非致命:不阻断构建
}

const url = `${base}/api/version/report`
try {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Report-Token': token },
    body: JSON.stringify({ product: 'chayuan', version })
  })
  const data = await res.json().catch(() => ({}))
  if (res.ok) {
    console.log(`[report-version] ✅ 已上报 chayuan v${version} → ${base}`)
  } else {
    console.error(`[report-version] ❌ 上报失败 ${res.status}:`, data)
    process.exitCode = 1
  }
} catch (e) {
  console.error('[report-version] ❌ 上报异常:', e.message)
  process.exitCode = 1
}
