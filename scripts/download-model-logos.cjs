/**
 * 从 LobeHub Icons 自动下载缺失的模型图标到 public/images/models/logos
 * 来源: https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg
 *
 * 运行: node scripts/download-model-logos.cjs
 */
const fs = require('fs')
const path = require('path')
const https = require('https')

const LOGOS_DIR = path.join(__dirname, '../public/images/models/logos')
const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.82.0/icons'

// logos 目录下的 basename（与 modelLogos.js 一致）-> lobe-icons 中的 id
// 若 lobe 无对应图标则留空，脚本会跳过
const MODEL_TO_LOBE_ID = {
  coze: 'coze',
  internlm: 'internlm',
  openrouter: 'openrouter',
  groq: 'groq',
  together: 'together',
  fireworks: 'fireworks',
  cohere: 'cohere',
  'netease-youdao': null,
  pangu: null,
  sensetime: null,
  hailuo: 'hailuo',
  o3: null,
  gpt_o1: null,
  'gpt-5': null,
  xinference: 'xinference',
  oneapi: null,
  vllm: 'vllm',
  newapi: 'newapi',
  lmstudio: 'lmstudio',
  'api-compatible': null,
  '360-D7q-rf3l': 'ai360',
  'volcengine-la_PI8m-': 'volcengine',
  ling: null,
  huggingface: 'huggingface',
  modelscope: 'modelscope',
  poe: 'poe',
  openai: 'openai',
  anthropic: 'anthropic',
  gemini: 'gemini',
  deepseek: 'deepseek',
  doubao: 'doubao',
  bailian: 'bailian',
  'wenxin-PRX-yHSt': null,
  zhipu: 'zhipu',
  moonshot: 'moonshot',
  yi: 'yi',
  ollama: 'ollama',
  baichuan: 'baichuan',
  mistral: 'mistral',
  llama: null,
  hunyuan: 'hunyuan',
  sparkdesk: 'spark',
  'minimax-B0Eo-1V9': 'minimax',
  'zero-one': 'zeroone',
  grok: 'grok',
  perplexity: 'perplexity'
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    }).on('error', reject)
  })
}

function fileExists(basename) {
  for (const ext of ['png', 'svg', 'webp']) {
    const p = path.join(LOGOS_DIR, `${basename}.${ext}`)
    if (fs.existsSync(p)) return ext
  }
  return null
}

async function main() {
  if (!fs.existsSync(LOGOS_DIR)) {
    fs.mkdirSync(LOGOS_DIR, { recursive: true })
  }

  let downloaded = 0
  let skipped = 0
  let failed = 0

  for (const [basename, lobeId] of Object.entries(MODEL_TO_LOBE_ID)) {
    const existing = fileExists(basename)
    if (existing) {
      skipped++
      continue
    }
    // 无 lobe 映射时，尝试从同组图标复制（如 o3/gpt-5 用 openai）
    let fetchId = lobeId
    if (!fetchId) {
      const fallback = { o3: 'openai', gpt_o1: 'openai', 'gpt-5': 'openai', llama: 'ollama' }
      fetchId = fallback[basename]
    }
    if (!fetchId) {
      console.log(`跳过 (无 lobe 映射): ${basename}`)
      failed++
      continue
    }

    const url = `${CDN_BASE}/${fetchId}.svg`
    const dest = path.join(LOGOS_DIR, `${basename}.svg`)

    try {
      const buf = await fetchUrl(url)
      fs.writeFileSync(dest, buf, 'utf8')
      console.log(`下载: ${basename}.svg <- ${fetchId}.svg`)
      downloaded++
    } catch (e) {
      console.warn(`失败: ${basename} (${url}): ${e.message}`)
      failed++
    }
  }

  console.log('---')
  console.log(`下载: ${downloaded}, 已存在跳过: ${skipped}, 失败/跳过: ${failed}`)
}

main().catch(console.error)
