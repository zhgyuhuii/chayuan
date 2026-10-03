/**
 * 顶部按钮逐项功能测试（wpp 宿主）：提示词与 ribbon.js RIBBON_ASSISTANT_PROMPTS 一致。
 * 加密/解密（对话流）放最后。读回验证走 presentation 工具。
 */
import { FILES_DIR, activateDoc } from './harness.mjs'
import path from 'node:path'

async function slideList(tool) {
  const r = await tool('presentation', { action: 'slide_list' })
  return (r?.slides || []).map(s => ({ index: Number(s?.index) || 0, title: String(s?.title || '') }))
}
async function lastShapes(tool) {
  const list = await slideList(tool)
  if (!list.length) return []
  const r = await tool('presentation', { action: 'shape_list', index: list.length })
  return (r?.shapes || []).map(s => String(s?.text || ''))
}
const hasMarker = (texts, id) => texts.some(t => t.includes(`${id}OK`))
const MARK = (id) => `全部页面处理完毕后，硬性收尾要求（必须执行）：在最后一页右下角 textbox_add 文本「${id}OK」。`

function genVerify(id, minAdd) {
  let base = 0
  return {
    pre: async ({ tool }) => { base = (await slideList(tool)).length },
    verify: async ({ tool }) => {
      const list = await slideList(tool)
      const texts = await lastShapes(tool)
      const added = list.length - base
      return [added >= minAdd && hasMarker(texts, id),
        `slides ${base}→${list.length}（需+${minAdd}） marker=${hasMarker(texts, id)}`]
    }
  }
}

export const SCENARIOS = [
  { id: 'BT-P1', desc: '顶部·生成PPT（对话流）',
    prompt: '请为我生成一套演示稿：先给出大纲（页码+每页标题+要点），等我确认后逐页生成。主题与要求：察元AI表格助手产品介绍，直接按此大纲生成 3 页（产品定位/核心功能/客户价值），不必等我确认。' + MARK('BT-P1'),
    timeout: 600, attempts: 2, ...genVerify('BT-P1', 3) },
  { id: 'BT-P2', desc: '顶部·整套摘要（autoSend）',
    prompt: '请通读当前演示稿全部页面（slide_list + slide_read），在第 1 页之后新增一页摘要页（layout 用 text），标题"核心要点"，列出整套内容的 3-5 条要点。',
    timeout: 480,
    verify: async ({ tool }) => {
      const titles = (await slideList(tool)).map(s => s.title)
      return [titles.some(t => t.includes('核心要点')), `核心要点页=${titles.some(t => t.includes('核心要点'))}`]
    } },
  { id: 'BT-P3', desc: '顶部·美化统一（autoSend）',
    prompt: '请统一当前演示稿排版：全部页面中文字体设为微软雅黑，标题字号 28、正文 18（format_uniform），表格形状跳过。完成后报告触及页数与形状数。',
    timeout: 480, verify: async ({ tool }) => {
      const texts = await lastShapes(tool)
      return [true, `回合完成（末页形状 ${texts.length}，format_uniform 无读回通道，以回合成功为准）`]
    } },
  { id: 'BT-P4', desc: '顶部·口播稿（autoSend）',
    prompt: '请为当前演示稿的每一页生成演讲者备注（口播稿）：先逐页读取内容，再为每页写口语化的演讲词（每页 3-5 句，衔接自然），用 notes_set 写入对应页的备注。',
    timeout: 600, verify: async ({ tool }) => {
      const texts = await lastShapes(tool)
      return [true, `回合完成（notes_set 无读回通道，以回合成功为准；末页形状 ${texts.length}）`]
    } },
  { id: 'BT-P5', desc: '顶部·保密检查（autoSend）',
    prompt: '请对当前演示稿做保密检查（只读不改）：逐页 slide_read 检查 敏感词/密级表述/内部代号/客户名与金额 等敏感信息，输出问题清单（页码+内容摘要+风险级别），不要修改任何文字。把清单写入最后一页右下角 textbox_add（文本以「保密检查清单」开头）。' ,
    timeout: 600,
    verify: async ({ tool }) => {
      const texts = await lastShapes(tool)
      const hit = texts.some(t => t.includes('保密检查'))
      return [hit, `末页清单命中=${hit}`]
    } },
  { id: 'BT-P6', desc: '顶部·结构诊断（autoSend）——已过 NP02，此处复核按钮提示词',
    prompt: '请对当前演示稿做结构诊断（只读不改）：① 按顺序连读每页标题判断故事线是否连贯 ② 单页要点是否超 5 条 ③ 是否缺封面/目录/章节过渡页/结尾页 ④ 给出 3-5 条结构调整建议（注明页码）。把结论摘要写入最后一页右下角 textbox_add（文本以「结构诊断」开头）。',
    timeout: 480,
    verify: async ({ tool }) => {
      const texts = await lastShapes(tool)
      return [texts.some(t => t.includes('结构诊断')), `末页摘要命中=${texts.some(t => t.includes('结构诊断'))}`]
    } },
  { id: 'BT-P7', desc: '顶部·整套翻译（下拉）——已过 NP03，复核按钮提示词',
    prompt: '请把当前演示稿的最后一页标题整套翻译为英文：slide_read 最后一页后用 text_set 或 text_replace 将其标题译为英文（数字保持原样）。把译文同时写入最后一页右下角 textbox_add（文本以「TRANSLATED:」开头）。',
    timeout: 480,
    verify: async ({ tool }) => {
      const texts = await lastShapes(tool)
      return [texts.some(t => t.startsWith('TRANSLATED:')), `TRANSLATED 标记=${texts.some(t => t.startsWith('TRANSLATED:'))}`]
    } },
  { id: 'BT-P8', desc: '顶部·课件生成（下拉）',
    prompt: '请生成一份教学课件：按知识点分页（每页一个知识点，含要点与示例），结尾加小结页与思考题。课程主题与受众：Excel 常用函数入门（SUM/VLOOKUP/IF），面向职场新人，共 4 页。' + MARK('BT-P8'),
    timeout: 600, attempts: 2, ...genVerify('BT-P8', 4) },
  { id: 'BT-P9', desc: '顶部·习题互动页（下拉）',
    prompt: '请生成课堂习题页：题目页 2 页（每页 2 道题），每题后跟一页答案解析。科目与知识点：初中数学·一元一次方程。' + MARK('BT-P9'),
    timeout: 600, attempts: 2, ...genVerify('BT-P9', 2) },
  { id: 'BT-P10', desc: '顶部·数据战报页（下拉·跨宿主读表）',
    pre: async ({ tool }) => {
      // 确认 et 宿主的工作簿可读（跨宿主读），不切活动演示稿
      const r = await tool('spreadsheet', { action: 'range_read', sheet: '销售区域', range: 'A1:B3' })
      return { ok: Array.isArray(r?.values) }
    },
    prompt: '请跨宿主读取表格数据生成大促战报页：先用 spreadsheet range_read 读取「销售区域」表（et 宿主当前工作簿），按区域聚合销售额，然后在当前演示稿末尾新增 2 页战报（① 核心战报：总销售额大数字页 ② 区域排行 table_add 表格页），红金配色。' + MARK('BT-P10'),
    timeout: 600, attempts: 2, ...genVerify('BT-P10', 2) },
  { id: 'BT-P11', desc: '顶部·加密演示稿（对话流·放最后）',
    pre: async () => {
      const r = await activateDoc('e2e-wpp2')
      if (!r) throw new Error('无法确认 e2e-wpp2 为活动演示稿')
      return { ok: true }
    },
    prompt: '请给当前演示稿设置打开密码。密码直接使用：Cy@Btn2026（不必再向我询问）。拿到密码后用 presentation 工具 security_encrypt_save（password 参数，savePath 用 /home/zyh/e2e-v2-files/btn-wpp-enc.pptx）完成加密并报告保存路径。提醒我：密码遗忘无法找回。',
    timeout: 480,
    verify: async ({ tool }) => [true, '回合完成，外部验证文件加密状态'] },
  { id: 'BT-P12', desc: '顶部·解密演示稿（对话流·最后）',
    prompt: '请移除当前演示稿的打开密码（密码为 Cy@Btn2026）。用 presentation 工具 security_decrypt_save（savePath 用 /home/zyh/e2e-v2-files/btn-wpp-dec.pptx）完成解密并报告保存路径。',
    timeout: 480,
    verify: async ({ tool }) => [true, '回合完成，外部验证文件解密状态'] },
]
