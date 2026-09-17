/**
 * 聊天消息 Markdown 渲染(轻量、XSS 优先)。
 *
 * 背景:agent 车道的模型输出大量使用 Markdown(校对结果表格、**加粗**、标题、
 * 代码块),此前 formatMessage 只做转义+换行,用户看到的是裸 `|---|` 源码。
 * 这里用 marked 解析;防 XSS 策略=先整体 HTML 转义再解析(输入中的任何 `<script>`
 * 在解析前已变成 &lt;script&gt; 字面量,不存在注入路径),渲染后仅注入本项目
 * 白名单元素(知识库引用上标)。
 */
import { marked } from 'marked'

marked.setOptions({
  gfm: true, // 表格/删除线/任务列表(校对卡输出全是 GFM 表格)
  breaks: true // 单换行即 <br>,贴近聊天习惯
})

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 是否疑似 Markdown(有表格/标题/列表/加粗/代码等特征才走 md 解析,普通短句维持旧渲染) */
const MD_HINT_RE = /(^\s{0,3}#{1,6}\s)|(^|\n)\s{0,3}([-*+]|\d+\.)\s|(\*\*[^*]+\*\*)|(`[^`]+`)|(^\s{0,3}>\s)|(\|.+\|\s*\n\s*\|?[-:| ]+\|)|(^\s{0,3}[-*]{3,}\s*$)/m

export function looksLikeMarkdown(text) {
  return MD_HINT_RE.test(String(text || ''))
}

/**
 * Markdown → 安全 HTML。输入先整体转义(见上),知识库引用标记 [^cN] 由调用方注入。
 */
export function renderMarkdownSafe(text) {
  const raw = String(text || '')
  if (!raw.trim()) return ''
  const escaped = escapeHtml(raw)
  try {
    return marked.parse(escaped, { async: false })
  } catch {
    // 解析失败退回旧行为:转义+换行,内容不丢
    return escaped.replace(/\n/g, '<br>')
  }
}
