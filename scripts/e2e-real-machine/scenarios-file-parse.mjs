/**
 * file_parse（文件解析）真机场景（任意宿主车道可挂）：
 *   FP-1 纯文本 md：auto 档预算内全文直出 + outline 命中
 *   FP-2 chunk 翻页确定性：cursor 只前进、fingerprint 一致、块长受控
 *   FP-3 结构化多路径：docx + pdf 一次解析，kind/meta.tokenEstimate 就位
 *   FP-4 记忆清单：action=remembered 返回合法形状（条目可为空）
 *
 * fixture 由本模块 import 时自建（md 长文），docx/pdf 复用仓库 artifacts 稳定文件。
 */
import { FILES_DIR } from './harness.mjs'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const MD_FIXTURE = path.join(FILES_DIR, 'fp-素材.md')
const MARKER_HEAD = '察元AI文件解析冒烟'
function ensureFixtures() {
  try {
    fs.mkdirSync(FILES_DIR, { recursive: true })
    if (!fs.existsSync(MD_FIXTURE)) {
      const parts = [`# ${MARKER_HEAD}`, '', '面向政企场景的安全可控一体化办公智能体。']
      for (let i = 1; i <= 120; i++) {
        parts.push(`## 第${i}节 要点${i}`, '', `第${i}节正文：` + '数据不出域、句句带引用。'.repeat(8))
      }
      fs.writeFileSync(MD_FIXTURE, parts.join('\n'), 'utf8')
    }
  } catch (_) { /* fixture 建失败由场景自身报错 */ }
}
ensureFixtures()

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DOCX_FIXTURE = path.join(REPO, 'artifacts', 'copyright-documentation-identification-front30-back30.docx')
const PDF_FIXTURE = path.join(REPO, 'artifacts', 'copyright-documentation-identification-front30-back30.pdf')

async function fp(tool, args) {
  return tool('file_parse', args, 180000)
}

export const SCENARIOS = [
  {
    id: 'FP-1', desc: 'file_parse·纯文本 auto 全文直出',
    prompt: `请用 file_parse 读取文件 ${MD_FIXTURE}（mode 用默认 auto），告诉我第一级标题是什么、共多少节。只读取分析，不要写任何文档。`,
    timeout: 240,
    verify: async ({ tool }) => {
      const r = await fp(tool, { paths: MD_FIXTURE })
      const f = r?.files?.[0]
      const okAll = r?.ok === true && f?.ok === true && f?.kind === 'markdown'
        && String(f?.text || '').includes(MARKER_HEAD)
        && Number(f?.meta?.tokenEstimate) > 0
        && f?.truncated === false
      return [!!okAll, `kind=${f?.kind} tokens=${f?.meta?.tokenEstimate} truncated=${f?.truncated} outline=${(f?.meta?.outline || []).length}`]
    }
  },
  {
    id: 'FP-2', desc: 'file_parse·chunk 翻页确定性',
    prompt: `请用 file_parse 以 mode=chunk 读取文件 ${MD_FIXTURE}（chunkTokens=800，先 cursor=0 limit=2 读第一批，再用 nextCursor 继续）。只读取分析，不要写任何文档。`,
    timeout: 240,
    verify: async ({ tool }) => {
      const a = await fp(tool, { paths: MD_FIXTURE, mode: 'chunk', chunkTokens: 800, cursor: 0, limit: 2 })
      const b = await fp(tool, {
        paths: MD_FIXTURE, mode: 'chunk', chunkTokens: 800,
        cursor: a?.nextCursor, limit: 2, expectedFingerprint: a?.fingerprint
      })
      const okAll = a?.ok === true && b?.ok === true
        && a.totalChunks === b.totalChunks && a.totalChunks > 10
        && (a.chunks || []).length === 2 && (b.chunks || []).length === 2
        && a.chunks[0].text !== b.chunks[0].text
        && b.fileChanged !== true && b.hasMore !== undefined
      return [!!okAll, `totalChunks=${a?.totalChunks} next=${a?.nextCursor}→cursor=${b?.cursor} fileChanged=${b?.fileChanged}`]
    }
  },
  {
    id: 'FP-3', desc: 'file_parse·docx+pdf 多路径',
    prompt: `请用 file_parse 一次解析两个文件：${DOCX_FIXTURE} 和 ${PDF_FIXTURE}（budgetTokens 4000，mode 默认）。告诉我两份文件各自的主题大意。只读取分析，不要写任何文档。`,
    timeout: 300,
    verify: async ({ tool }) => {
      const r = await fp(tool, { paths: [DOCX_FIXTURE, PDF_FIXTURE], budgetTokens: 4000 })
      const fsx = r?.files || []
      const docx = fsx.find(f => (f?.ext || '').toLowerCase() === 'docx')
      const pdf = fsx.find(f => (f?.ext || '').toLowerCase() === 'pdf')
      const okAll = r?.ok === true && docx?.ok === true && docx?.kind === 'docx' && Number(docx?.meta?.tokenEstimate) > 0
        && pdf?.ok === true && pdf?.kind === 'pdf' && Number(pdf?.meta?.pages) > 0
      return [!!okAll, `docx tokens=${docx?.meta?.tokenEstimate} pdf pages=${pdf?.meta?.pages} consumed=${r?.consumedTokens}`]
    }
  },
  {
    id: 'FP-4', desc: 'file_parse·附件记忆清单形状',
    prompt: '请用 file_parse 的 action=remembered 查看当前附件记忆清单并原样报告（没有附件就说没有）。只读取，不要写任何文档。',
    timeout: 120,
    verify: async ({ tool }) => {
      const r = await fp(tool, { action: 'remembered' })
      const okAll = r?.ok === true && Array.isArray(r?.entries)
      return [!!okAll, `entries=${(r?.entries || []).length}`]
    }
  }
]

export default { SCENARIOS }
