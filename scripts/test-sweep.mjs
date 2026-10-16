import fs from 'node:fs'
import { JSDOM } from 'jsdom'
import { createRequire } from 'node:module'
const req = createRequire(import.meta.url)
globalThis.DOMParser = new JSDOM('').window.DOMParser
globalThis.XMLSerializer = new JSDOM('').window.XMLSerializer
globalThis.window = { Application: null }

const g = await import('../src/utils/templateFileGenerator.js')
const bytes = fs.readFileSync('/Users/zyh/Desktop/模板/软件设计模式.pptx')
const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
const loaded = await g.loadTemplateZip(ab)
const md = fs.readFileSync('/Users/zyh/Desktop/年度工作总结/2025研发部门年度工作总结.md', 'utf8')
const sweep = await g.sweepPlaceholders(loaded.zip, md)
console.log('清扫:', sweep.swept, '处')
const out = await g.exportZipBytes(loaded.zip)
fs.writeFileSync('/tmp/swept.pptx', Buffer.from(out))
console.log('交付:', out.byteLength, 'bytes')
