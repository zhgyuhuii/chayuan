#!/usr/bin/env node
/**
 * 从 src/assets/ai-assistant/logo-avatar.png 生成 logoAvatarDataUrl.js（data: URL 字符串）。
 * 更换头像图后执行：node scripts/generate-logo-avatar-dataurl.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const pngPath = path.join(root, 'src/assets/ai-assistant/logo-avatar.png')
const outPath = path.join(root, 'src/assets/ai-assistant/logoAvatarDataUrl.js')

const b = fs.readFileSync(pngPath)
const dataUrl = `data:image/png;base64,${b.toString('base64')}`
const body = `/** 由 scripts/generate-logo-avatar-dataurl.mjs 从 logo-avatar.png 生成 */\nexport default ${JSON.stringify(dataUrl)}\n`
fs.writeFileSync(outPath, body, 'utf8')
console.log('Wrote', outPath, `(${Math.round(dataUrl.length / 1024)}k data URL)`)
