import { ensureDir, getEffectiveDataDir, pathJoin, pathSep } from './dataPathSettings.js'
import { findIssueRangeDetailed } from './spellCheckService.js'
import {
  ANALYSIS_SECRET_KEYWORD_EXTRACT_ID,
  buildAnchorOnlyStructuredCommentSkipApplyResult,
  isAnchoredCommentDocumentAction
} from './structuredCommentPolicy.js'

function getApplication() {
  return window.Application || window.opener?.Application || window.parent?.Application
}

function normalizeText(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function toDocumentText(text) {
  return String(text || '').replace(/\r\n/g, '\r').replace(/\n/g, '\r')
}

export function getActiveDocument() {
  return getApplication()?.ActiveDocument || null
}

export function getSelection() {
  return getApplication()?.Selection || null
}

export function getSelectionRange() {
  return getSelection()?.Range || null
}

export function getSelectedText() {
  const sel = getSelection()
  return normalizeText(sel?.Text || '')
}

export function hasMeaningfulSelectionText(text, minLength = 2) {
  return String(text || '').trim().length >= Math.max(1, Number(minLength || 2))
}

export function getDocumentText() {
  const doc = getActiveDocument()
  return normalizeText(doc?.Content?.Text || '')
}

export function resolveDocumentInput(sourceMode = 'selection-preferred') {
  const selectionText = getSelectedText().trim()
  const documentText = getDocumentText().trim()
  const hasMeaningfulSelection = hasMeaningfulSelectionText(selectionText, 2)

  if (sourceMode === 'selection-only') {
    return {
      text: selectionText,
      source: 'selection',
      hasSelection: selectionText.length > 0,
      hasDocument: documentText.length > 0
    }
  }

  if (sourceMode === 'document') {
    return {
      text: documentText,
      source: 'document',
      hasSelection: hasMeaningfulSelection,
      hasDocument: documentText.length > 0
    }
  }

  if (hasMeaningfulSelection) {
    return {
      text: selectionText,
      source: 'selection',
      hasSelection: true,
      hasDocument: documentText.length > 0
    }
  }

  return {
    text: documentText,
    source: 'document',
    hasSelection: false,
    hasDocument: documentText.length > 0
  }
}

function getUsableRange() {
  const doc = getActiveDocument()
  const sel = getSelection()
  const range = sel?.Range
  if (range) return range
  return doc?.Content || null
}

/**
 * 批注需要落在具体段落/选区上；无选区时不要用全文 Content（否则一条批注糊在整篇上）。
 */
function getScopedCommentAnchorRange() {
  const doc = getActiveDocument()
  if (!doc) return null
  const sel = getSelection()
  const selRange = sel?.Range
  if (selRange && hasMeaningfulSelectionText(String(selRange.Text || ''), 1)) {
    return selRange
  }
  if (selRange) {
    try {
      const para = selRange.Paragraphs?.Item(1)
      const pr = para?.Range
      if (pr && Number(pr.End || 0) > Number(pr.Start || 0)) return pr
    } catch (_) {}
  }
  try {
    const paras = doc?.Paragraphs
    const n = Number(paras?.Count || 0)
    if (n > 0) {
      const first = paras.Item(1)
      const fr = first?.Range
      if (fr && Number(fr.End || 0) > Number(fr.Start || 0)) return fr
    }
  } catch (_) {}
  return null
}

function getActionRange(action, options = {}) {
  if (options.targetRange) {
    return options.targetRange
  }
  const doc = getActiveDocument()
  const inputSource = String(options.inputSource || '').trim()
  const act = String(action || '').trim()
  const commentClass = act === 'comment' || act === 'link-comment'
  if (options.preventWholeDocumentComment === true && commentClass) {
    const scoped = getScopedCommentAnchorRange()
    if (scoped) return scoped
    try {
      const content = doc?.Content
      const s = Number(content?.Start ?? 0)
      const e = Number(content?.End ?? 0)
      if (e > s) {
        return doc.Range(s, Math.min(s + 1, e))
      }
    } catch (_) {}
  }
  if (
    inputSource === 'document' &&
    ['replace', 'comment', 'link-comment', 'comment-replace'].includes(act)
  ) {
    return doc?.Content || null
  }
  return getUsableRange()
}

function ensureParagraphSpacing(text) {
  const value = String(text || '').trim()
  return value ? `\n${value}\n` : ''
}

function addCommentToRange(range, text) {
  const doc = getActiveDocument()
  if (!doc?.Comments || !range) {
    throw new Error('无法添加批注')
  }
  doc.Comments.Add(range, text)
}

function createLocateKey(start, end, paragraphIndex = null) {
  const startValue = Number.isFinite(Number(start)) ? Number(start) : null
  const endValue = Number.isFinite(Number(end)) ? Number(end) : null
  const paragraphValue = Number.isFinite(Number(paragraphIndex)) ? Number(paragraphIndex) : null
  return [paragraphValue != null ? `p${paragraphValue}` : '', startValue != null ? `s${startValue}` : '', endValue != null ? `e${endValue}` : '']
    .filter(Boolean)
    .join('_')
}

function normalizeWriteTargetText(text) {
  return stripParagraphEndMark(String(text || ''))
}

function buildWriteTarget(action, payload = {}) {
  const start = Number.isFinite(Number(payload.start)) ? Number(payload.start) : null
  const end = Number.isFinite(Number(payload.end)) ? Number(payload.end) : null
  const paragraphIndex = Number.isFinite(Number(payload.paragraphIndex)) ? Number(payload.paragraphIndex) : null
  return {
    action: String(action || '').trim() || 'none',
    start,
    end,
    paragraphIndex,
    originalText: normalizeWriteTargetText(payload.originalText),
    outputText: normalizeWriteTargetText(payload.outputText),
    downgraded: payload.downgraded === true,
    locateKey: String(payload.locateKey || createLocateKey(start, end, paragraphIndex)).trim()
  }
}

function arrayBufferToBinaryString(arr) {
  const bytes = new Uint8Array(arr)
  let bin = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)))
  }
  return bin
}

function base64ToBinaryString(base64) {
  return atob(String(base64 || '').trim())
}

function getGeneratedMediaDir() {
  const app = getApplication()
  const fs = app?.FileSystem
  if (!fs) throw new Error('FileSystem 不可用，无法保存生成媒体')
  let dir = ''
  if (app?.Env?.GetTempPath) {
    dir = String(app.Env.GetTempPath() || '').replace(/^file:\/\//i, '').replace(/\\/g, '/').replace(/\/+$/, '')
  }
  if (!dir && getEffectiveDataDir()) {
    dir = pathJoin(getEffectiveDataDir(), '_generated_media')
  }
  if (!dir) {
    dir = pathJoin(pathSep() === '\\' ? 'C:\\Temp' : '/tmp', 'chayuan_generated_media')
  }
  ensureDir(fs, dir)
  return pathSep() === '\\' ? dir.replace(/\//g, '\\') : dir.replace(/\\/g, '/')
}

function buildGeneratedMediaPath(extension = 'bin', prefix = 'chayuan_media') {
  const dir = getGeneratedMediaDir()
  const ext = String(extension || 'bin').replace(/^\.+/, '') || 'bin'
  return pathJoin(dir, `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`)
}

export function saveGeneratedAssetToFile(asset, options = {}) {
  const app = getApplication()
  const fs = app?.FileSystem
  if (!fs?.writeAsBinaryString) {
    throw new Error('当前环境不支持保存生成媒体文件')
  }
  const filePath = buildGeneratedMediaPath(asset?.extension || options.extension || 'bin', options.prefix || 'chayuan_media')
  const content = asset?.bytes
    ? arrayBufferToBinaryString(asset.bytes)
    : base64ToBinaryString(asset?.base64 || '')
  if (!content) {
    throw new Error('生成媒体内容为空，无法保存')
  }
  const ok = fs.writeAsBinaryString(filePath, content)
  if (!ok) {
    throw new Error('保存生成媒体文件失败')
  }
  return filePath
}

function splitReplacementParagraphs(text) {
  const parts = normalizeText(text).split('\n')
  while (parts.length > 1 && parts[parts.length - 1] === '') {
    parts.pop()
  }
  return parts
}

function collapseInlineBreaks(text) {
  return normalizeText(text).split('\n').join(' ')
}

function trimWritableRangeEnd(doc, start, end) {
  let cursor = Number(end)
  const min = Number(start)
  while (cursor > min) {
    let marker = ''
    try {
      marker = String(doc.Range(cursor - 1, cursor)?.Text || '')
    } catch (_) {
      break
    }
    if (marker === '\r' || marker === '\n' || marker === '\u0007') {
      cursor -= 1
      continue
    }
    break
  }
  return cursor
}

function getSelectedParagraphRanges(doc, range) {
  if (!doc || !range?.Paragraphs) return []
  const rangeStart = Number(range.Start)
  const rangeEnd = Number(range.End)
  const paragraphs = range.Paragraphs
  const items = []
  for (let i = 1; i <= paragraphs.Count; i++) {
    try {
      const para = paragraphs.Item(i)
      const paraRange = para?.Range
      if (!paraRange) continue
      const paraStart = Number(paraRange.Start)
      const paraEnd = Number(paraRange.End)
      const writableParaEnd = trimWritableRangeEnd(doc, paraStart, paraEnd)
      const start = Math.max(rangeStart, paraStart)
      const end = Math.min(rangeEnd, paraEnd)
      if (end < start) continue
      items.push({
        start,
        end: trimWritableRangeEnd(doc, start, end),
        isWholeParagraph: start <= paraStart && trimWritableRangeEnd(doc, start, end) >= writableParaEnd
      })
    } catch (_) {}
  }
  return items
}

function alignReplacementParagraphs(parts, targetCount) {
  const n = Math.max(0, Math.floor(Number(targetCount)))
  if (n <= 0) return []
  if (parts.length === n) return parts
  if (n === 1) return [collapseInlineBreaks(parts.join('\n'))]
  if (parts.length > n) {
    return [
      ...parts.slice(0, n - 1),
      collapseInlineBreaks(parts.slice(n - 1).join('\n'))
    ]
  }
  const pad = n - parts.length
  if (!Number.isFinite(pad) || pad < 0 || pad > 100000) {
    return parts
  }
  return [...parts, ...Array.from({ length: pad }, () => '')]
}

function replaceRangePreservingParagraphs(doc, range, text) {
  const paragraphRanges = getSelectedParagraphRanges(doc, range)
  if (paragraphRanges.length === 0) {
    return false
  }

  const writableRangeEnd = trimWritableRangeEnd(doc, range.Start, range.End)
  const allWholeParagraphs = paragraphRanges.every(item => item.isWholeParagraph)

  if (!allWholeParagraphs) {
    const target = doc.Range(range.Start, writableRangeEnd)
    target.Text = toDocumentText(collapseInlineBreaks(text))
    return true
  }

  if (paragraphRanges.length === 1) {
    const target = doc.Range(paragraphRanges[0].start, paragraphRanges[0].end)
    target.Text = toDocumentText(splitReplacementParagraphs(text).join(' '))
    return true
  }

  const replacementParts = alignReplacementParagraphs(
    splitReplacementParagraphs(text),
    paragraphRanges.length
  )

  // 倒序写回，避免前面段落长度变化影响后续 Range 坐标。
  for (let i = paragraphRanges.length - 1; i >= 0; i--) {
    const targetRange = paragraphRanges[i]
    const target = doc.Range(targetRange.start, targetRange.end)
    target.Text = toDocumentText(replacementParts[i] || '')
  }
  return true
}

function stripParagraphEndMark(text) {
  return String(text || '').replace(/[\r\n\u0007]+$/g, '')
}

function normalizePrefixText(text) {
  return String(text || '').replace(/\s+/g, '')
}

function extractProtectedPrefix(text) {
  const raw = stripParagraphEndMark(text)
  const match = raw.match(/^(\s*(?:第[0-9一二三四五六七八九十百千]+[章节篇部卷]|[一二三四五六七八九十百千]+、|（[一二三四五六七八九十百千]+）|\([一二三四五六七八九十百千]+\)|\d+(?:\.\d+)*(?:[、.．)）])?|[A-Za-z](?:[.)、])|[IVXLCM]+(?:[.)、]))(?:\s+)?)/)
  if (!match) {
    return {
      prefix: '',
      body: raw,
      hasProtectedPrefix: false
    }
  }
  const prefix = String(match[1] || '')
  return {
    prefix,
    body: raw.slice(prefix.length),
    hasProtectedPrefix: true
  }
}

function getParagraphDescriptors(doc, range) {
  if (!doc || !range?.Paragraphs) return []
  const rangeStart = Number(range.Start)
  const rangeEnd = Number(range.End)
  const paragraphs = range.Paragraphs
  const items = []
  for (let i = 1; i <= paragraphs.Count; i += 1) {
    try {
      const para = paragraphs.Item(i)
      const paraRange = para?.Range
      if (!paraRange) continue
      const paraStart = Number(paraRange.Start)
      const paraEnd = Number(paraRange.End)
      const writableEnd = trimWritableRangeEnd(doc, paraStart, paraEnd)
      const overlapStart = Math.max(rangeStart, paraStart)
      const overlapEnd = Math.min(rangeEnd, writableEnd)
      if (overlapEnd < overlapStart) continue
      const rawText = stripParagraphEndMark(String(paraRange.Text || ''))
      const prefixInfo = extractProtectedPrefix(rawText)
      const bodyStart = Math.min(writableEnd, paraStart + prefixInfo.prefix.length)
      items.push({
        start: paraStart,
        end: paraEnd,
        writableEnd,
        overlapStart,
        overlapEnd,
        rawText,
        prefix: prefixInfo.prefix,
        bodyText: prefixInfo.body,
        bodyStart,
        bodyEnd: writableEnd,
        hasProtectedPrefix: prefixInfo.hasProtectedPrefix
      })
    } catch (_) {}
  }
  return items
}

function applyStructuredIssueReplacements(doc, range, options = {}) {
  const issues = Array.isArray(options.issues) ? options.issues : []
  const chunkText = String(options.originalText || '').trim()
  const baseStart = Number(range?.Start || 0)
  if (!doc || !range || !chunkText || issues.length === 0) {
    return {
      ok: true,
      action: 'none',
      message: '未发现可安全替换的问题片段，原文未改动',
      replacedCount: 0,
      skippedCount: issues.length
    }
  }
  const safeReasonCodes = new Set([
    'direct_match',
    'compact_match',
    'single_candidate',
    'context_match',
    'sentence_context_match',
    'best_candidate'
  ])
  const candidates = issues
    .map((issue) => {
      const match = findIssueRangeDetailed(chunkText, issue)
      const suggestion = String(issue?.suggestion || '').trim()
      if (!match?.ok || !match.range || !safeReasonCodes.has(String(match.reasonCode || '')) || !suggestion) {
        return null
      }
      return {
        issue,
        suggestion,
        start: match.range.start,
        end: match.range.end
      }
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.start) - Number(a.start))
  const accepted = []
  let lastStart = Number.POSITIVE_INFINITY
  candidates.forEach((item) => {
    if (item.end <= lastStart) {
      accepted.push(item)
      lastStart = item.start
    }
  })
  const writeTargets = []
  accepted.forEach((item) => {
    const target = doc.Range(baseStart + Number(item.start || 0), baseStart + Number(item.end || 0))
    const originalText = String(target?.Text || '')
    target.Text = toDocumentText(item.suggestion)
    writeTargets.push(buildWriteTarget('replace', {
      start: baseStart + Number(item.start || 0),
      end: baseStart + Number(item.end || 0),
      originalText,
      outputText: item.suggestion
    }))
  })
  return {
    ok: true,
    action: accepted.length > 0 ? 'replace' : 'none',
    message: accepted.length > 0
      ? `已局部替换 ${accepted.length} 处问题，原段落样式已尽量保留`
      : '未发现可安全替换的问题片段，原文未改动',
    replacedCount: accepted.length,
    skippedCount: Math.max(0, issues.length - accepted.length),
    protectionMode: 'issue-range',
    protectionApplied: true,
    writeTargets
  }
}

function applySafeParagraphBodyReplacement(doc, range, text) {
  const descriptors = getParagraphDescriptors(doc, range)
  const nextParagraphs = splitReplacementParagraphs(text)
  if (!descriptors.length) {
    return {
      ok: false,
      downgradeAction: 'comment',
      message: '未找到可安全替换的段落'
    }
  }
  if (descriptors.length !== nextParagraphs.length) {
    return {
      ok: false,
      downgradeAction: 'comment',
      message: '检测到输出段落数量与原文不一致，为保护编号和样式，未直接替换原文'
    }
  }
  const hasPartialBodySelection = descriptors.some((descriptor) => {
    const bodyStart = Math.max(Number(descriptor.bodyStart || 0), Number(descriptor.start || 0))
    const bodyEnd = Math.max(bodyStart, Number(descriptor.bodyEnd || 0))
    const overlapStart = Number(descriptor.overlapStart || 0)
    const overlapEnd = Number(descriptor.overlapEnd || 0)
    return overlapStart > bodyStart || overlapEnd < bodyEnd
  })
  if (hasPartialBodySelection) {
    return {
      ok: false,
      downgradeAction: 'comment',
      message: '当前仅安全支持整段正文替换；所选内容不是完整正文段落，已改为批注建议'
    }
  }
  const plans = []
  for (let i = 0; i < descriptors.length; i += 1) {
    const descriptor = descriptors[i]
    const nextText = stripParagraphEndMark(nextParagraphs[i] || '')
    const nextPrefix = extractProtectedPrefix(nextText)
    if (
      descriptor.hasProtectedPrefix &&
      nextPrefix.hasProtectedPrefix &&
      normalizePrefixText(descriptor.prefix) !== normalizePrefixText(nextPrefix.prefix)
    ) {
      return {
        ok: false,
        downgradeAction: 'comment',
        message: '检测到章节编号或条款前缀变化，为保护原编号和样式，未直接替换原文'
      }
    }
    if (!descriptor.hasProtectedPrefix && nextPrefix.hasProtectedPrefix) {
      return {
        ok: false,
        downgradeAction: 'comment',
        message: '检测到新结果引入了编号前缀，为保护原样式和结构，未直接替换原文'
      }
    }
    plans.push({
      ...descriptor,
      nextBodyText: collapseInlineBreaks(nextPrefix.hasProtectedPrefix ? nextPrefix.body : nextText)
    })
  }
  let changedCount = 0
  let protectedParagraphCount = 0
  const writeTargets = []
  for (let i = plans.length - 1; i >= 0; i -= 1) {
    const plan = plans[i]
    const currentBody = collapseInlineBreaks(plan.bodyText)
    if (plan.hasProtectedPrefix) protectedParagraphCount += 1
    if (currentBody === plan.nextBodyText) continue
    const target = doc.Range(plan.bodyStart, plan.bodyEnd)
    const originalText = String(target?.Text || '')
    target.Text = toDocumentText(plan.nextBodyText)
    changedCount += 1
    writeTargets.push(buildWriteTarget('replace', {
      start: plan.bodyStart,
      end: plan.bodyEnd,
      paragraphIndex: i + 1,
      originalText,
      outputText: plan.nextBodyText
    }))
  }
  return {
    ok: true,
    action: changedCount > 0 ? 'replace' : 'none',
    message: changedCount > 0
      ? `已安全替换 ${changedCount} 段正文，章节编号与原段落样式已尽量保留`
      : '未发现需要替换的正文内容，原文未改动',
    replacedCount: changedCount,
    protectedParagraphCount,
    protectionMode: 'paragraph-body',
    protectionApplied: protectedParagraphCount > 0,
    writeTargets
  }
}

function applySafeDocumentReplacement(doc, range, text, options = {}) {
  const payload = options.safeReplacePayload && typeof options.safeReplacePayload === 'object'
    ? options.safeReplacePayload
    : null
  if (!payload || !doc || !range) return null
  if (payload.mode === 'structured-edits') {
    return applyStructuredIssueReplacements(doc, range, payload)
  }
  if (payload.mode === 'paragraph-body') {
    return applySafeParagraphBodyReplacement(doc, range, text)
  }
  return null
}

function insertTextAtDocumentStart(doc, text) {
  const content = doc?.Content
  if (!content) {
    throw new Error('无法获取文档内容范围')
  }
  const range = doc.Range(Number(content.Start || 0), Number(content.Start || 0))
  range.InsertAfter(toDocumentText(`${stripParagraphEndMark(text)}\r`))
}

export function applyParagraphResultsAction(action, paragraphResults = [], options = {}) {
  const finalAction = String(action || '').trim()
  const doc = getActiveDocument()
  if (!doc) {
    throw new Error('当前没有打开文档')
  }
  const items = Array.isArray(paragraphResults) ? paragraphResults : []
  if (finalAction === 'none') {
    return { ok: true, action: 'none', message: '已生成结果，未写回文档', insertedParagraphCount: 0, replacedCount: 0, writeTargets: [] }
  }
  if (finalAction === 'insert-after') {
    const insertedTargets = []
    const orderedItems = items
      .filter(item => String(item?.outputText || '').trim())
      .slice()
      .sort((a, b) => Number(b.end || 0) - Number(a.end || 0))
    orderedItems.forEach((item, index) => {
      const range = doc.Range(Number(item.end || 0), Number(item.end || 0))
      range.InsertAfter(toDocumentText(`${stripParagraphEndMark(item.outputText || '')}\r`))
      insertedTargets.push(buildWriteTarget('insert-after', {
        start: Number(item.end || 0),
        end: Number(item.end || 0),
        paragraphIndex: Number.isFinite(Number(item.paragraphIndex)) ? Number(item.paragraphIndex) : orderedItems.length - index,
        originalText: String(item.inputText || ''),
        outputText: String(item.outputText || '')
      }))
    })
    const insertedCount = insertedTargets.length
    return {
      ok: true,
      action: 'insert-after',
      message: insertedCount > 0 ? `已在 ${insertedCount} 段后插入对应结果` : '未找到可插入的段落结果',
      insertedParagraphCount: insertedCount,
      writeTargets: insertedTargets
    }
  }
  if (finalAction === 'replace') {
    if (String(options.chunkMode || '').trim() === 'sentence-range') {
      const orderedSentenceItems = items
        .filter(item => String(item?.outputText || '').trim())
        .slice()
        .sort((a, b) => Number(b.start || 0) - Number(a.start || 0))
      const writeTargets = []
      orderedSentenceItems.forEach((item) => {
        const range = doc.Range(Number(item.start || 0), Number(item.end || 0))
        const originalText = String(range?.Text || '')
        range.Text = toDocumentText(String(item.outputText || '').trim())
        writeTargets.push(buildWriteTarget('replace', {
          start: Number(item.start || 0),
          end: Number(item.end || 0),
          paragraphIndex: Number.isFinite(Number(item.paragraphIndex)) ? Number(item.paragraphIndex) : null,
          originalText,
          outputText: String(item.outputText || '').trim()
        }))
      })
      return {
        ok: true,
        action: orderedSentenceItems.length > 0 ? 'replace' : 'none',
        message: orderedSentenceItems.length > 0
          ? `已按对应句子安全替换 ${orderedSentenceItems.length} 处内容`
          : '未发现需要替换的句子内容，原文未改动',
        replacedCount: orderedSentenceItems.length,
        protectionMode: 'sentence-range',
        protectionApplied: orderedSentenceItems.length > 0,
        writeTargets
      }
    }
    const ordered = items.slice().sort((a, b) => Number(b.start || 0) - Number(a.start || 0))
    let replacedCount = 0
    let protectedParagraphCount = 0
    let downgradedReason = ''
    const writeTargets = []
    for (const item of ordered) {
      const range = doc.Range(Number(item.start || 0), Number(item.end || 0))
      const safeResult = applySafeParagraphBodyReplacement(doc, range, String(item.outputText || ''))
      if (!safeResult?.ok) {
        downgradedReason = safeResult?.message || '逐段安全替换失败'
        break
      }
      replacedCount += Number(safeResult.replacedCount || 0)
      protectedParagraphCount += Number(safeResult.protectedParagraphCount || 0)
      if (Array.isArray(safeResult.writeTargets)) {
        writeTargets.push(...safeResult.writeTargets)
      }
    }
    if (downgradedReason) {
      const firstRange = items[0] ? doc.Range(Number(items[0].start || 0), Number(items[0].end || 0)) : getUsableRange()
      const preview = items.map(item => String(item.outputText || '').trim()).filter(Boolean).join('\n')
      addCommentToRange(firstRange, `${String(options.commentText || '').trim()}\n\n建议内容：\n${preview}`.trim())
      return {
        ok: true,
        action: 'comment',
        downgradedFrom: 'replace',
        downgradeReason: downgradedReason,
        message: downgradedReason,
        writeTargets: [
          buildWriteTarget('comment', {
            start: Number(firstRange?.Start || 0),
            end: Number(firstRange?.End || 0),
            originalText: String(firstRange?.Text || ''),
            outputText: preview,
            downgraded: true
          })
        ]
      }
    }
    return {
      ok: true,
      action: replacedCount > 0 ? 'replace' : 'none',
      message: replacedCount > 0
        ? `已安全替换 ${replacedCount} 段对应正文，保留原编号与段落样式`
        : '未发现需要替换的段落内容，原文未改动',
      replacedCount,
      protectedParagraphCount,
      protectionMode: 'paragraph-body',
      protectionApplied: protectedParagraphCount > 0,
      writeTargets
    }
  }
  if (finalAction === 'comment-replace') {
    const firstRange = items[0] ? doc.Range(Number(items[0].start || 0), Number(items[0].end || 0)) : getUsableRange()
    addCommentToRange(firstRange, String(options.commentText || '').trim())
    const replaceResult = applyParagraphResultsAction('replace', items, options)
    if (replaceResult?.action === 'comment') {
      return replaceResult
    }
    return {
      ...replaceResult,
      action: replaceResult?.action === 'none' ? 'comment' : 'comment-replace',
      message: replaceResult?.action === 'none'
        ? '已添加批注，原文未改动'
        : `已添加批注并${String(replaceResult?.message || '完成逐段安全替换').replace(/^已/, '')}`,
      writeTargets: [
        buildWriteTarget('comment', {
          start: Number(firstRange?.Start || 0),
          end: Number(firstRange?.End || 0),
          originalText: String(firstRange?.Text || ''),
          outputText: String(options.commentText || '').trim()
        }),
        ...(Array.isArray(replaceResult?.writeTargets) ? replaceResult.writeTargets : [])
      ]
    }
  }
  throw new Error(`当前不支持逐段结果动作: ${finalAction}`)
}

function normalizeComparableWritableText(text) {
  return normalizeText(String(text || '')).replace(/[\n\u0007]+$/g, '').trim()
}

const SAFE_STRUCTURED_REPLACE_REASON_CODES = new Set([
  'direct_match',
  'compact_match',
  'single_candidate',
  'context_match',
  'sentence_context_match',
  'best_candidate'
])

function buildStructuredOperationCommentText(operation, fallbackCommentText = '') {
  const fb = String(fallbackCommentText || '').trim()
  const safeFb = textLooksLikePlanStatsJson(fb) ? '' : fb
  const lines = [
    String(operation?.commentText || '').trim(),
    String(operation?.reason || '').trim(),
    String(operation?.suggestion || '').trim() && String(operation?.replacementText || '').trim()
      ? `建议改为：${String(operation.replacementText).trim()}`
      : '',
    safeFb
  ].filter(Boolean)
  return Array.from(new Set(lines)).join('\n')
}

function resolveStructuredOperationRange(doc, operation) {
  const start = Number(operation?.start)
  const end = Number(operation?.end)
  const expectedText = String(operation?.originalText || '').trim()
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    if (!expectedText) {
      return {
        start,
        end,
        matchedBy: 'absolute-range',
        reasonCode: 'absolute_range_without_expected_text',
        reasonLabel: '缺少原文锚点，不能直接替换',
        safeForReplace: false
      }
    }
    try {
      const currentText = normalizeComparableWritableText(doc.Range(start, end)?.Text || '')
      if (currentText === normalizeComparableWritableText(expectedText)) {
        return {
          start,
          end,
          paragraphIndex: Number.isFinite(Number(operation?.paragraphIndex)) ? Number(operation.paragraphIndex) : null,
          matchedBy: 'absolute-range',
          reasonCode: 'absolute_range_exact_match',
          reasonLabel: '绝对坐标与原文完全匹配',
          safeForReplace: true
        }
      }
    } catch (_) {}
  }
  const chunkStart = Number(operation?.chunkStart)
  const chunkEnd = Number(operation?.chunkEnd)
  if (
    Number.isFinite(chunkStart) &&
    Number.isFinite(chunkEnd) &&
    chunkEnd > chunkStart &&
    expectedText
  ) {
    try {
      const liveChunkText = normalizeText(doc.Range(chunkStart, chunkEnd)?.Text || '')
      const match = findIssueRangeDetailed(liveChunkText, {
        text: expectedText,
        prefix: String(operation?.prefix || ''),
        suffix: String(operation?.suffix || ''),
        sentence: String(operation?.sentence || '')
      })
      if (match?.ok && match.range) {
        return {
          start: chunkStart + Number(match.range.start || 0),
          end: chunkStart + Number(match.range.end || 0),
          paragraphIndex: Number.isFinite(Number(operation?.paragraphIndex)) ? Number(operation.paragraphIndex) : null,
          matchedBy: 'text-anchor',
          reasonCode: String(match.reasonCode || ''),
          reasonLabel: String(match.reasonLabel || ''),
          safeForReplace: SAFE_STRUCTURED_REPLACE_REASON_CODES.has(String(match.reasonCode || ''))
        }
      }
    } catch (_) {}
  }
  return null
}

function canSafelyApplyStructuredReplacement(operation, resolvedRange) {
  if (!resolvedRange || resolvedRange.safeForReplace !== true) {
    return false
  }
  const confidence = String(operation?.confidence || '').trim().toLowerCase()
  if (confidence === 'low') {
    return false
  }
  const validationStatus = String(operation?.validationStatus || '').trim().toLowerCase()
  if (validationStatus && !['exact', 'normalized', 'range_only'].includes(validationStatus)) {
    return false
  }
  return String(operation?.originalText || '').trim().length > 0
}

function applyStructuredEditOperations(doc, finalAction, operations = [], options = {}) {
  const fallbackCommentText = String(options.commentText || '').trim()
  const candidates = (Array.isArray(operations) ? operations : [])
    .map((operation) => ({
      operation,
      resolvedRange: resolveStructuredOperationRange(doc, operation)
    }))
    .filter(item => item.resolvedRange && Number(item.resolvedRange.end || 0) > Number(item.resolvedRange.start || 0))
    .sort((left, right) => Number(right.resolvedRange.start || 0) - Number(left.resolvedRange.start || 0))

  let replacedCount = 0
  let commentCount = 0
  let downgradedCount = 0
  let skippedCount = Math.max(0, (Array.isArray(operations) ? operations.length : 0) - candidates.length)
  let lastStart = Number.POSITIVE_INFINITY
  const writeTargets = []

  candidates.forEach(({ operation, resolvedRange }) => {
    if (Number(resolvedRange.end || 0) > lastStart) {
      skippedCount += 1
      return
    }
    const range = doc.Range(Number(resolvedRange.start || 0), Number(resolvedRange.end || 0))
    let commentAdded = false
    const commentText = buildStructuredOperationCommentText(operation, fallbackCommentText)
    const isLinkComment = finalAction === 'link-comment'
    if (finalAction === 'comment' || finalAction === 'comment-replace' || isLinkComment) {
      if (commentText) {
        const body = isLinkComment
          ? `${commentText}\n\n参考：可在任务清单中查看完整结果。`.trim()
          : commentText
        addCommentToRange(range, body)
        commentCount += 1
        commentAdded = true
        writeTargets.push(buildWriteTarget(isLinkComment ? 'link-comment' : 'comment', {
          start: Number(resolvedRange.start || 0),
          end: Number(resolvedRange.end || 0),
          paragraphIndex: resolvedRange.paragraphIndex,
          originalText: String(range?.Text || ''),
          outputText: body
        }))
      }
    }
    if (finalAction === 'replace' || finalAction === 'comment-replace') {
      const replacementText = String(operation?.replacementText || operation?.suggestion || '').trim()
      if (!replacementText) {
        skippedCount += 1
        return
      }
      if (!canSafelyApplyStructuredReplacement(operation, resolvedRange)) {
        if (!commentAdded && commentText) {
          addCommentToRange(range, commentText)
          commentCount += 1
          commentAdded = true
        } else if (!commentText) {
          skippedCount += 1
        }
        downgradedCount += 1
        if (commentAdded) {
          const lastIndex = writeTargets.length - 1
          if (lastIndex >= 0) {
            writeTargets[lastIndex] = {
              ...writeTargets[lastIndex],
              downgraded: true
            }
          }
        }
        lastStart = Number(resolvedRange.start || 0)
        return
      }
      const originalText = String(range?.Text || '')
      range.Text = toDocumentText(replacementText)
      replacedCount += 1
      writeTargets.push(buildWriteTarget(finalAction === 'comment-replace' ? 'replace' : 'replace', {
        start: Number(resolvedRange.start || 0),
        end: Number(resolvedRange.end || 0),
        paragraphIndex: resolvedRange.paragraphIndex,
        originalText,
        outputText: replacementText
      }))
    }
    lastStart = Number(resolvedRange.start || 0)
  })

  const action = finalAction === 'comment-replace'
    ? (replacedCount > 0 ? 'comment-replace' : commentCount > 0 ? 'comment' : 'none')
    : finalAction === 'replace'
      ? (replacedCount > 0 ? 'replace' : commentCount > 0 ? 'comment' : 'none')
      : finalAction === 'link-comment'
        ? (commentCount > 0 ? 'link-comment' : 'none')
        : finalAction === 'comment'
          ? (commentCount > 0 ? 'comment' : 'none')
          : 'none'

  const downgradedMessage = downgradedCount > 0
    ? `；其中 ${downgradedCount} 处因定位不稳定已降级为批注`
    : ''
  return {
    ok: true,
    action,
    message: action === 'comment-replace'
      ? `已按定位信息添加 ${commentCount} 条批注，并替换 ${replacedCount} 处内容${downgradedMessage}`
      : action === 'replace'
        ? `已按定位信息替换 ${replacedCount} 处内容${downgradedMessage}`
        : action === 'link-comment'
          ? `已按定位信息添加 ${commentCount} 条链接形式批注${downgradedMessage}`
          : action === 'comment'
            ? `已按定位信息添加 ${commentCount} 条批注${downgradedMessage}`
            : '未发现可安全执行的结构化定位操作，原文未改动',
    replacedCount,
    commentCount,
    downgradedCount,
    skippedCount,
    operationCount: Array.isArray(operations) ? operations.length : 0,
    resolvedOperationCount: candidates.length,
    protectionMode: 'structured-execution-plan',
    protectionApplied: true,
    downgradedFrom: downgradedCount > 0 && finalAction !== action ? finalAction : '',
    downgradeReason: downgradedCount > 0 ? 'strict-structured-replace-safety' : '',
    writeTargets
  }
}

function buildParagraphResultsFromExecutionPlan(plan) {
  return (Array.isArray(plan?.contentBlocks) ? plan.contentBlocks : [])
    .filter(item => String(item?.outputText || '').trim())
    .map(item => ({
      start: Number(item?.start || 0),
      end: Number(item?.end || 0),
      paragraphIndex: Number.isFinite(Number(item?.paragraphIndex)) ? Number(item.paragraphIndex) : null,
      inputText: String(item?.inputText || '').trim(),
      outputText: String(item?.outputText || '').trim(),
      qualityLevel: String(item?.quality?.level || '').trim(),
      qualityMessage: String(item?.quality?.message || '').trim()
    }))
}

function applyLowQualityParagraphResultComment(doc, lowQualityParagraphResults = [], options = {}) {
  const items = Array.isArray(lowQualityParagraphResults) ? lowQualityParagraphResults : []
  if (items.length === 0) return { count: 0, range: null }
  const commentRange = items[0]
    ? doc.Range(Number(items[0].start || 0), Number(items[0].end || 0))
    : getUsableRange()
  const reviewPreview = items
    .slice(0, 3)
    .map((item, index) => `第 ${index + 1} 个低质量批次：${String(item.qualityMessage || item.outputText || '').trim()}`)
    .filter(Boolean)
    .join('\n')
  if (!reviewPreview) return { count: 0, range: commentRange }
  addCommentToRange(commentRange, [
    String(options.commentText || '').trim(),
    '以下批次因结果质量不足，未直接写回正文：',
    reviewPreview
  ].filter(Boolean).join('\n\n'))
  return { count: items.length, range: commentRange }
}

function safeReadValue(getter, fallback = '') {
  try {
    const value = getter()
    return value == null ? fallback : value
  } catch (_) {
    return fallback
  }
}

function resolvePlanSnapshotRange(plan) {
  const candidates = []
  ;(Array.isArray(plan?.operations) ? plan.operations : []).forEach((item) => {
    const start = Number(item?.start)
    const end = Number(item?.end)
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      candidates.push({ start, end })
    }
  })
  ;(Array.isArray(plan?.contentBlocks) ? plan.contentBlocks : []).forEach((item) => {
    const start = Number(item?.start)
    const end = Number(item?.end)
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      candidates.push({ start, end })
    }
  })
  const contextStart = Number(plan?.documentContext?.rangeStart)
  const contextEnd = Number(plan?.documentContext?.rangeEnd)
  if (candidates.length === 0 && Number.isFinite(contextStart) && Number.isFinite(contextEnd) && contextEnd > contextStart) {
    candidates.push({ start: contextStart, end: contextEnd })
  }
  if (candidates.length === 0) return null
  return {
    start: Math.min(...candidates.map(item => item.start)),
    end: Math.max(...candidates.map(item => item.end))
  }
}

export function captureDocumentRangeStyleSnapshot(range) {
  if (!range) return null
  const font = safeReadValue(() => range.Font, null)
  const paragraphFormat = safeReadValue(() => range.ParagraphFormat, null)
  return {
    fontName: String(safeReadValue(() => font?.Name, '') || '').trim(),
    fontSize: Number(safeReadValue(() => font?.Size, 0) || 0),
    bold: safeReadValue(() => font?.Bold, false) === true || Number(safeReadValue(() => font?.Bold, 0)) === 1,
    italic: safeReadValue(() => font?.Italic, false) === true || Number(safeReadValue(() => font?.Italic, 0)) === 1,
    underline: Number(safeReadValue(() => font?.Underline, 0) || 0),
    color: String(safeReadValue(() => font?.Color, '') || '').trim(),
    highlight: String(safeReadValue(() => font?.HighlightColorIndex, '') || '').trim(),
    alignment: String(safeReadValue(() => paragraphFormat?.Alignment, '') || '').trim(),
    lineSpacing: Number(safeReadValue(() => paragraphFormat?.LineSpacing, 0) || 0)
  }
}

function compareDocumentStyleSnapshots(before, after) {
  if (!before || !after) {
    return {
      ok: true,
      issues: [],
      reviewRequired: false,
      severity: 'none'
    }
  }
  const issues = []
  if (before.alignment && after.alignment && before.alignment !== after.alignment) {
    issues.push('段落对齐发生变化')
  }
  if (before.lineSpacing > 0 && after.lineSpacing > 0 && Math.abs(before.lineSpacing - after.lineSpacing) > 0.1) {
    issues.push('行距发生变化')
  }
  if (before.fontName && after.fontName && before.fontName !== after.fontName) {
    issues.push('字体发生变化')
  }
  if (before.fontSize > 0 && after.fontSize > 0 && Math.abs(before.fontSize - after.fontSize) >= 0.5) {
    issues.push('字号发生变化')
  }
  if (before.bold !== after.bold) {
    issues.push('加粗状态发生变化')
  }
  if (before.italic !== after.italic) {
    issues.push('斜体状态发生变化')
  }
  if (String(before.underline) !== String(after.underline)) {
    issues.push('下划线状态发生变化')
  }
  if (before.color && after.color && before.color !== after.color) {
    issues.push('字体颜色发生变化')
  }
  if (before.highlight && after.highlight && before.highlight !== after.highlight) {
    issues.push('高亮颜色发生变化')
  }
  const severity = issues.length >= 3 ? 'high' : issues.length > 0 ? 'medium' : 'none'
  return {
    ok: issues.length === 0,
    issues,
    reviewRequired: severity === 'high',
    severity
  }
}

const STRUCTURED_SUMMARY_STATS_KEYS = new Set([
  'batchCount',
  'contentBlockCount',
  'operationCount',
  'candidateOperationCount',
  'deduplicatedOperationCount',
  'resolvedOperationCount',
  'unresolvedOperationCount',
  'invalidBatchCount',
  'exactValidatedOperationCount',
  'normalizedValidatedOperationCount',
  'mismatchedOperationCount',
  'highQualityBatchCount',
  'mediumQualityBatchCount',
  'reviewQualityBatchCount',
  'highRiskBatchCount',
  'mediumRiskBatchCount',
  'arbitrationSelectedOperationCount',
  'arbitrationRejectedOperationCount',
  'arbitrationConflictRejectedCount',
  'arbitrationUnresolvedRejectedCount'
])

/** 检测是否为结构化执行计划统计 JSON（禁止当作批注正文或模型输出展示） */
export function textLooksLikePlanStatsJson(value) {
  const t = String(value || '').trim()
  if (!t || t.length < 2 || t[0] !== '{') return false
  if (!/"(?:batchCount|operationCount)"\s*:/.test(t)) return false
  try {
    const o = JSON.parse(t)
    if (!o || typeof o !== 'object') return false
    let hits = 0
    STRUCTURED_SUMMARY_STATS_KEYS.forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(o, k)) hits += 1
    })
    return hits >= 3
  } catch (_) {
    return false
  }
}

function isCommentClassDocumentAction(action) {
  return action === 'comment' || action === 'link-comment'
}

function resolveBatchModelPayload(batch) {
  const root = batch?.response?.parsed
  if (!root || typeof root !== 'object') return null
  // 归一化结果形如 { operations, summary, parsed: <模型原始 JSON> }，keywords 等在原始 JSON 上
  const inner = root.parsed && typeof root.parsed === 'object' ? root.parsed : null
  return inner || root
}

function formatBatchScopedCommentBody(batch, planAssistantId = '', documentAction = '') {
  const aid = String(planAssistantId || '').trim()
  const parsed = resolveBatchModelPayload(batch)
  // 批注/链接批注：禁止用 summary/长文做分块糊墙；涉密关键词仅允许带 keywords 列表的分块说明
  if (isAnchoredCommentDocumentAction(documentAction)) {
    if (aid !== ANALYSIS_SECRET_KEYWORD_EXTRACT_ID) {
      return ''
    }
    const kws = parsed && typeof parsed === 'object' && Array.isArray(parsed.keywords) ? parsed.keywords : []
    if (kws.length === 0) return ''
  }
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.keywords) && parsed.keywords.length > 0) {
    const lines = parsed.keywords.slice(0, 80).map((kw, i) => {
      const term = String(kw?.term ?? kw?.text ?? '').trim()
      const cat = String(kw?.category || '').trim()
      const reason = String(kw?.reason || '').trim()
      const token = String(kw?.replacementToken || '').trim()
      const head = term || `关键词${i + 1}`
      const tail = [cat && `类别：${cat}`, reason, token && `占位：${token}`].filter(Boolean).join('；')
      return tail ? `${head} — ${tail}` : head
    })
    return ['【本段分析批注】', ...lines.map(l => `· ${l}`)].join('\n').slice(0, 12000)
  }
  const content = String(parsed?.content || '').trim()
  if (content && !textLooksLikePlanStatsJson(content)) return content.slice(0, 12000)
  const summary = String(parsed?.summary || '').trim()
  if (summary && !textLooksLikePlanStatsJson(summary)) return summary.slice(0, 12000)
  const rawSnippet = String(batch?.response?.raw || '').trim()
  if (rawSnippet.length > 24 && !textLooksLikePlanStatsJson(rawSnippet)) {
    return rawSnippet.slice(0, 4000)
  }
  return ''
}

function buildScopedCommentSegmentsFromPlan(plan) {
  const batches = Array.isArray(plan?.batches) ? plan.batches : []
  const planAssistantId = String(plan?.assistantId || '').trim()
  const documentAction = String(plan?.requestContext?.documentAction || '').trim()
  const segments = []
  batches.forEach((batch, idx) => {
    const start = Number(batch?.chunk?.start)
    const end = Number(batch?.chunk?.end)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return
    const body = formatBatchScopedCommentBody(batch, planAssistantId, documentAction)
    if (!body) return
    segments.push({ start, end, body, batchIndex: idx })
  })
  return segments.sort((a, b) => b.start - a.start)
}

function applyScopedCommentSegmentsFromPlan(doc, plan, finalAction, options = {}) {
  const segments = buildScopedCommentSegmentsFromPlan(plan)
  if (segments.length === 0) {
    return {
      ok: true,
      action: 'none',
      message: '没有可分块锚定的批注内容',
      commentCount: 0,
      writeTargets: [],
      protectionMode: 'scoped-chunk-comments',
      protectionApplied: true
    }
  }
  const title = String(options.title || plan?.taskTitle || '').trim()
  const prefix = title ? `【${title}】\n` : ''
  const hintRaw = String(options.commentText || '').trim()
  const hint = hintRaw && !textLooksLikePlanStatsJson(hintRaw) ? hintRaw : ''
  const isLink = finalAction === 'link-comment'
  let commentCount = 0
  const writeTargets = []
  segments.forEach(({ start, end, body }) => {
    try {
      const range = doc.Range(start, end)
      let text = [prefix + body, hint && `说明：${hint}`].filter(Boolean).join('\n\n').trim()
      if (isLink) {
        text = `${text}\n\n参考：可在任务清单中查看完整结果。`.trim()
      }
      if (!text) return
      addCommentToRange(range, text)
      commentCount += 1
      writeTargets.push(buildWriteTarget(isLink ? 'link-comment' : 'comment', {
        start,
        end,
        originalText: String(range?.Text || '').slice(0, 500),
        outputText: text.slice(0, 2000),
        downgraded: true
      }))
    } catch (_) {}
  })
  return {
    ok: commentCount > 0,
    action: commentCount > 0 ? finalAction : 'none',
    message: commentCount > 0
      ? `已在 ${commentCount} 个文档分块范围添加批注（按分块/段落锚定）。`
      : '分块批注写入失败，原文未改动',
    commentCount,
    replacedCount: 0,
    downgradedCount: 0,
    skippedCount: Math.max(0, segments.length - commentCount),
    writeTargets,
    operationCount: segments.length,
    resolvedOperationCount: commentCount,
    protectionMode: 'scoped-chunk-comments',
    protectionApplied: true,
    downgradedFrom: '',
    downgradeReason: ''
  }
}

export function applyStructuredExecutionPlan(plan, options = {}) {
  const finalAction = String(plan?.requestContext?.documentAction || options.action || 'none').trim()
  const doc = getActiveDocument()
  if (!doc) {
    throw new Error('当前没有打开文档')
  }
  const operations = Array.isArray(plan?.operations) ? plan.operations : []
  const paragraphResults = buildParagraphResultsFromExecutionPlan(plan)
  const aggregatedContent = String(plan?.aggregatedContent || '').trim()
  const lowQualityParagraphResults = paragraphResults.filter(item => item.qualityLevel === 'review')
  const safeParagraphResults = paragraphResults.filter(item => item.qualityLevel !== 'review')

  const structuralOpsActions = ['replace', 'comment', 'comment-replace', 'link-comment']

  if (structuralOpsActions.includes(finalAction) && operations.length > 0) {
    const structuredResult = applyStructuredEditOperations(doc, finalAction, operations, options)
    if (structuredResult?.action !== 'none') {
      return structuredResult
    }
    if (isCommentClassDocumentAction(finalAction)) {
      const scoped = applyScopedCommentSegmentsFromPlan(doc, plan, finalAction, options)
      if (scoped.commentCount > 0) {
        return {
          ...scoped,
          downgradedFrom: finalAction,
          downgradeReason: 'structured_operations_unresolved_use_chunk_scoped_comments'
        }
      }
    }
    // 替换类：无稳定定位则不再误写全文；批注类：已尝试分块锚定
    if (finalAction === 'replace' || finalAction === 'comment-replace' || finalAction === 'comment' || finalAction === 'link-comment') {
      return structuredResult
    }
  }

  if (isCommentClassDocumentAction(finalAction) && operations.length === 0) {
    const scoped = applyScopedCommentSegmentsFromPlan(doc, plan, finalAction, options)
    if (scoped.commentCount > 0) {
      return scoped
    }
  }

  if (['replace', 'insert-after', 'comment-replace'].includes(finalAction) && paragraphResults.length > 0) {
    if (lowQualityParagraphResults.length > 0 && ['replace', 'comment-replace', 'insert-after'].includes(finalAction)) {
      const lowQualityCommentResult = applyLowQualityParagraphResultComment(doc, lowQualityParagraphResults, options)
      const lowQualityCount = Number(lowQualityCommentResult?.count || 0)
      if (safeParagraphResults.length === 0) {
        return {
          ok: true,
          action: 'comment',
          downgradedFrom: finalAction,
          downgradeReason: 'low_quality_batches_filtered',
          message: `存在 ${lowQualityCount} 个低质量批次，已改为批注提示，正文未直接改动`,
          writeTargets: [
            buildWriteTarget('comment', {
              start: Number(lowQualityCommentResult?.range?.Start || 0),
              end: Number(lowQualityCommentResult?.range?.End || 0),
              originalText: String(lowQualityCommentResult?.range?.Text || ''),
              outputText: String(options.commentText || '').trim(),
              downgraded: true
            })
          ]
        }
      }
      const safeWriteAction = finalAction === 'insert-after' ? 'insert-after' : 'replace'
      const safeReplaceResult = applyParagraphResultsAction(safeWriteAction, safeParagraphResults, {
        ...options,
        chunkMode: String(options.chunkMode || plan?.requestContext?.chunkWriteMode || '').trim() || 'paragraph-body'
      })
      return {
        ...safeReplaceResult,
        action: safeReplaceResult?.action === 'replace'
          ? 'comment-replace'
          : safeReplaceResult?.action === 'insert-after'
            ? 'insert-after'
            : 'comment',
        downgradedFrom: finalAction,
        downgradeReason: 'partial_low_quality_batches_filtered',
        message: `${String(safeReplaceResult?.message || '已完成安全写回')}；另有 ${lowQualityCount} 个低质量批次已降级为批注`,
        writeTargets: Array.isArray(safeReplaceResult?.writeTargets) ? safeReplaceResult.writeTargets : []
      }
    }
    return applyParagraphResultsAction(finalAction, safeParagraphResults, {
      ...options,
      chunkMode: String(options.chunkMode || plan?.requestContext?.chunkWriteMode || '').trim() || 'paragraph-body'
    })
  }

  const mergedInputSource = options.inputSource || plan?.documentContext?.inputSource || ''
  const commentClass = isCommentClassDocumentAction(finalAction)
  if (commentClass) {
    return buildAnchorOnlyStructuredCommentSkipApplyResult()
  }
  const fallbackText =
    aggregatedContent ||
    String(options.commentText || '').trim() ||
    JSON.stringify(plan?.summary || {}, null, 2)
  return applyDocumentAction(finalAction, fallbackText, {
    ...options,
    inputSource: mergedInputSource,
    preventWholeDocumentComment: false
  })
}

export function applyDocumentExecutionPlan(plan, options = {}) {
  const normalizedPlan = plan && typeof plan === 'object' ? plan : {}
  const doc = getActiveDocument()
  if (!doc) {
    throw new Error('当前没有打开文档')
  }
  // 仅生成结果（none）不写回正文时，不要做范围样式快照：会强制访问 Range/Font，且 getActionRange 会读 Selection；
  // 任务窗格获得焦点时 WPS 上常见不稳定或异常，与「未写回」语义也无关。
  const effectiveActionForSnapshot = String(
    options.action || normalizedPlan?.requestContext?.documentAction || ''
  ).trim() || 'none'
  const snapshotRangeInfo = effectiveActionForSnapshot === 'none'
    ? null
    : resolvePlanSnapshotRange(normalizedPlan)
  let beforeStyleSnapshot = null
  if (snapshotRangeInfo) {
    try {
      beforeStyleSnapshot = captureDocumentRangeStyleSnapshot(
        doc.Range(snapshotRangeInfo.start, snapshotRangeInfo.end)
      )
    } catch (_) {
      beforeStyleSnapshot = null
    }
  }
  const applyResult = (
    Array.isArray(normalizedPlan?.operations) ||
    Array.isArray(normalizedPlan?.contentBlocks)
  )
    ? applyStructuredExecutionPlan(normalizedPlan, options)
    : applyDocumentAction(
        String(options.action || normalizedPlan?.requestContext?.documentAction || '').trim() || 'none',
        String(normalizedPlan?.aggregatedContent || normalizedPlan?.outputText || '').trim(),
        options
      )
  let afterStyleSnapshot = null
  if (snapshotRangeInfo) {
    try {
      afterStyleSnapshot = captureDocumentRangeStyleSnapshot(
        doc.Range(snapshotRangeInfo.start, snapshotRangeInfo.end)
      )
    } catch (_) {
      afterStyleSnapshot = null
    }
  }
  const styleValidation = compareDocumentStyleSnapshots(beforeStyleSnapshot, afterStyleSnapshot)
  return {
    ...applyResult,
    styleSnapshotBefore: beforeStyleSnapshot,
    styleSnapshotAfter: afterStyleSnapshot,
    styleValidation
  }
}

function replaceOrInsert(text) {
  const app = getApplication()
  const sel = app?.Selection
  const doc = app?.ActiveDocument
  const range = sel?.Range || doc?.Content || null
  if (!range || !doc) {
    throw new Error('无法获取可写入位置')
  }
  const hasSelection = hasMeaningfulSelectionText(sel?.Text, 2)
  if (hasSelection) {
    if (!replaceRangePreservingParagraphs(doc, range, text)) {
      range.Text = toDocumentText(text)
    }
    return 'replace'
  }
  const insertText = toDocumentText(text)
  if (typeof range.Collapse === 'function') {
    try {
      range.Collapse(0)
    } catch (_) {}
  }
  if (typeof range.InsertAfter === 'function') {
    range.InsertAfter(insertText)
  } else if (typeof sel.InsertAfter === 'function') {
    sel.InsertAfter(insertText)
  } else {
    range.Text = insertText
  }
  return 'insert'
}

function replaceRangeStrictly(doc, range, text) {
  if (!doc || !range) {
    return {
      ok: false,
      downgradeAction: 'comment',
      message: '未找到可严格替换的原文范围，已改为批注建议'
    }
  }
  const currentText = String(range.Text || '').replace(/[\r\n\u0007]+$/g, '').trim()
  if (!currentText) {
    return {
      ok: false,
      downgradeAction: 'comment',
      message: '未找到可严格替换的原文范围，已改为批注建议'
    }
  }
  if (!replaceRangePreservingParagraphs(doc, range, text)) {
    range.Text = toDocumentText(text)
  }
  return {
    ok: true,
    action: 'replace',
    message: '已按替换原文模式安全写回文档',
    writeTargets: [
      buildWriteTarget('replace', {
        start: Number(range?.Start || 0),
        end: Number(range?.End || 0),
        originalText: currentText,
        outputText: text
      })
    ]
  }
}

function getMediaRangeForAction(action) {
  const doc = getActiveDocument()
  const sel = getSelection()
  const range = getUsableRange()
  if (!range) {
    throw new Error('无法获取可写入的位置')
  }
  if (action === 'append') {
    const content = doc?.Content
    if (!content) throw new Error('无法获取文档内容范围')
    content.Collapse?.(0)
    return content
  }
  if (action === 'replace' && sel?.Text && String(sel.Text).trim()) {
    range.Text = ''
  }
  range.Collapse?.(0)
  return range
}

function tryAddInlinePicture(source, range) {
  const doc = getActiveDocument()
  const inlineShapes = doc?.InlineShapes
  if (!inlineShapes?.AddPicture) {
    throw new Error('当前环境不支持插入图片')
  }
  const pos = {
    start: Number(range?.Start || 0),
    end: Number(range?.End || 0)
  }
  try {
    return inlineShapes.AddPicture({
      FileName: source,
      LinkToFile: false,
      SaveWithDocument: true,
      Range: pos
    })
  } catch (_) {}
  try {
    return inlineShapes.AddPicture(source, false, true, range)
  } catch (e) {
    throw new Error(e?.message || '插入图片失败')
  }
}

function insertGeneratedImage(asset, action) {
  const range = getMediaRangeForAction(action)
  if (asset?.filePath) {
    try {
      tryAddInlinePicture(asset.filePath, range)
      return
    } catch (_) {}
  }
  if (asset?.dataUrl) {
    tryAddInlinePicture(asset.dataUrl, range)
    return
  }
  throw new Error('缺少可插入的图片内容')
}

export function applyDocumentAction(action, text, options = {}) {
  const finalAction = action || 'insert'
  const resultText = String(text || '').trim()
  const title = String(options.title || '').trim()
  const commentBody = String(options.commentText || resultText || '').trim()
  const strictTargetAction = options.strictTargetAction === true || options.strictAssistantDefaults === true
  const app = getApplication()
  const doc = app?.ActiveDocument

  if (!doc) {
    throw new Error('当前没有打开文档')
  }
  if (!resultText && finalAction !== 'none') {
    throw new Error('没有可写回文档的结果')
  }

  if (finalAction === 'none') {
    return { ok: true, action: 'none', message: '已生成结果，未写回文档', writeTargets: [] }
  }

  const range = getActionRange(finalAction, options)
  const commentPrefix = title ? `【${title}】\n` : ''
  const commentText = `${commentPrefix}${commentBody}`.trim()

  switch (finalAction) {
    case 'replace':
    case 'insert': {
      if (finalAction === 'replace') {
        const safeResult = applySafeDocumentReplacement(doc, range, resultText, options)
        if (safeResult?.ok) {
          return safeResult
        }
        if (safeResult?.downgradeAction === 'comment') {
          addCommentToRange(range, `${commentText}\n\n建议内容：\n${resultText}`.trim())
          return {
            ok: true,
            action: 'comment',
            downgradedFrom: 'replace',
            downgradeReason: safeResult.message,
            message: safeResult.message || '已降级为批注建议，未直接替换原文',
            writeTargets: [buildWriteTarget('comment', {
              start: Number(range?.Start || 0),
              end: Number(range?.End || 0),
              originalText: String(range?.Text || ''),
              outputText: resultText,
              downgraded: true
            })]
          }
        }
        if (strictTargetAction) {
          const strictReplaceResult = replaceRangeStrictly(doc, range, resultText)
          if (strictReplaceResult?.ok) {
            return strictReplaceResult
          }
          if (strictReplaceResult?.downgradeAction === 'comment') {
            addCommentToRange(range, `${commentText}\n\n建议内容：\n${resultText}`.trim())
            return {
              ok: true,
              action: 'comment',
              downgradedFrom: 'replace',
              downgradeReason: strictReplaceResult.message,
              message: strictReplaceResult.message || '已降级为批注建议，未直接替换原文',
              writeTargets: [buildWriteTarget('comment', {
                start: Number(range?.Start || 0),
                end: Number(range?.End || 0),
                originalText: String(range?.Text || ''),
                outputText: resultText,
                downgraded: true
              })]
            }
          }
        }
      }
      const mode = replaceOrInsert(resultText)
      return {
        ok: true,
        action: mode,
        message: mode === 'replace' ? '已替换文档内容' : '已插入到文档',
        writeTargets: [buildWriteTarget(mode, {
          start: Number(range?.Start || 0),
          end: Number(range?.End || 0),
          originalText: String(range?.Text || ''),
          outputText: resultText
        })]
      }
    }
    case 'prepend': {
      insertTextAtDocumentStart(doc, resultText)
      return {
        ok: true,
        action: 'prepend',
        message: '已插入到文档最前面',
        writeTargets: [buildWriteTarget('prepend', {
          start: Number(doc?.Content?.Start || 0),
          end: Number(doc?.Content?.Start || 0),
          outputText: resultText
        })]
      }
    }
    case 'comment':
      addCommentToRange(range, commentText)
      return {
        ok: true,
        action: 'comment',
        message: '已添加批注',
        writeTargets: [buildWriteTarget('comment', {
          start: Number(range?.Start || 0),
          end: Number(range?.End || 0),
          originalText: String(range?.Text || ''),
          outputText: commentText
        })]
      }
    case 'link-comment':
      addCommentToRange(range, `${commentText}\n\n参考：可在任务清单中查看完整结果。`)
      return {
        ok: true,
        action: 'link-comment',
        message: '已添加链接形式批注',
        writeTargets: [buildWriteTarget('link-comment', {
          start: Number(range?.Start || 0),
          end: Number(range?.End || 0),
          originalText: String(range?.Text || ''),
          outputText: commentText
        })]
      }
    case 'comment-replace':
      addCommentToRange(range, commentText)
      {
        const safeResult = applySafeDocumentReplacement(doc, range, resultText, options)
        if (safeResult?.ok) {
          return {
            ...safeResult,
            action: safeResult.action === 'none' ? 'comment' : 'comment-replace',
            message: safeResult.action === 'none'
              ? '已添加批注，原文未改动'
              : `已添加批注并${String(safeResult.message || '完成安全替换').replace(/^已/, '')}`,
            writeTargets: [
              buildWriteTarget('comment', {
                start: Number(range?.Start || 0),
                end: Number(range?.End || 0),
                originalText: String(range?.Text || ''),
                outputText: commentText
              }),
              ...(Array.isArray(safeResult?.writeTargets) ? safeResult.writeTargets : [])
            ]
          }
        }
        if (safeResult?.downgradeAction === 'comment') {
          return {
            ok: true,
            action: 'comment',
            downgradedFrom: 'comment-replace',
            downgradeReason: safeResult.message,
            message: safeResult.message || '已添加批注，未直接替换原文',
            writeTargets: [buildWriteTarget('comment', {
              start: Number(range?.Start || 0),
              end: Number(range?.End || 0),
              originalText: String(range?.Text || ''),
              outputText: commentText,
              downgraded: true
            })]
          }
        }
        if (strictTargetAction) {
          const strictReplaceResult = replaceRangeStrictly(doc, range, resultText)
          if (strictReplaceResult?.ok) {
            return {
              ...strictReplaceResult,
              action: 'comment-replace',
              message: '已添加批注并按替换原文模式安全写回文档',
              writeTargets: [
                buildWriteTarget('comment', {
                  start: Number(range?.Start || 0),
                  end: Number(range?.End || 0),
                  originalText: String(range?.Text || ''),
                  outputText: commentText
                }),
                ...(Array.isArray(strictReplaceResult?.writeTargets) ? strictReplaceResult.writeTargets : [])
              ]
            }
          }
          if (strictReplaceResult?.downgradeAction === 'comment') {
            return {
              ok: true,
              action: 'comment',
              downgradedFrom: 'comment-replace',
              downgradeReason: strictReplaceResult.message,
              message: strictReplaceResult.message || '已添加批注，未直接替换原文',
              writeTargets: [buildWriteTarget('comment', {
                start: Number(range?.Start || 0),
                end: Number(range?.End || 0),
                originalText: String(range?.Text || ''),
                outputText: commentText,
                downgraded: true
              })]
            }
          }
        }
      }
      replaceOrInsert(resultText)
      return {
        ok: true,
        action: 'comment-replace',
        message: '已添加批注并替换内容',
        writeTargets: [
          buildWriteTarget('comment', {
            start: Number(range?.Start || 0),
            end: Number(range?.End || 0),
            originalText: String(range?.Text || ''),
            outputText: commentText
          }),
          buildWriteTarget('replace', {
            start: Number(range?.Start || 0),
            end: Number(range?.End || 0),
            originalText: String(range?.Text || ''),
            outputText: resultText
          })
        ]
      }
    case 'append': {
      const content = doc.Content
      if (!content) {
        throw new Error('无法获取文档内容范围')
      }
      const insertText = ensureParagraphSpacing(resultText)
      if (typeof content.InsertAfter === 'function') {
        content.Collapse?.(0)
        content.InsertAfter(toDocumentText(insertText))
      } else {
        content.Text = `${content.Text || ''}${toDocumentText(insertText)}`
      }
      return {
        ok: true,
        action: 'append',
        message: '已追加到文末',
        writeTargets: [buildWriteTarget('append', {
          start: Number(content?.End || 0),
          end: Number(content?.End || 0),
          outputText: insertText
        })]
      }
    }
    default:
      throw new Error(`不支持的文档动作: ${finalAction}`)
  }
}

export function applyMediaDocumentAction(kind, action, asset, options = {}) {
  const finalAction = action || 'none'
  const title = String(options.title || '').trim()
  const commentBody = String(options.commentText || '').trim()
  const range = getUsableRange()
  const commentPrefix = title ? `【${title}】\n` : ''
  const savedAsset = {
    ...asset,
    filePath: asset?.filePath || saveGeneratedAssetToFile(asset, {
      prefix: kind === 'image' ? 'chayuan_image' : kind === 'audio' ? 'chayuan_audio' : 'chayuan_video',
      extension: asset?.extension
    })
  }

  if (kind === 'image') {
    switch (finalAction) {
      case 'none':
        return { ok: true, action: 'none', message: '已生成图片，未写回文档', filePath: savedAsset.filePath, writeTargets: [] }
      case 'insert':
      case 'replace':
      case 'append':
        insertGeneratedImage(savedAsset, finalAction)
        return {
          ok: true,
          action: finalAction,
          message: '已将图片插入文档',
          filePath: savedAsset.filePath,
          writeTargets: [buildWriteTarget(finalAction, {
            start: Number(range?.Start || 0),
            end: Number(range?.End || 0),
            outputText: savedAsset.filePath
          })]
        }
      case 'comment':
        addCommentToRange(range, `${commentPrefix}${commentBody || '已生成图片，请查看任务详情或本地文件。'}\n\n文件：${savedAsset.filePath}`.trim())
        return {
          ok: true,
          action: 'comment',
          message: '已添加图片说明批注',
          filePath: savedAsset.filePath,
          writeTargets: [buildWriteTarget('comment', {
            start: Number(range?.Start || 0),
            end: Number(range?.End || 0),
            outputText: savedAsset.filePath
          })]
        }
      case 'comment-replace':
        addCommentToRange(range, `${commentPrefix}${commentBody || '已生成图片并插入文档。'}\n\n文件：${savedAsset.filePath}`.trim())
        insertGeneratedImage(savedAsset, 'replace')
        return {
          ok: true,
          action: 'comment-replace',
          message: '已添加批注并插入图片',
          filePath: savedAsset.filePath,
          writeTargets: [
            buildWriteTarget('comment', {
              start: Number(range?.Start || 0),
              end: Number(range?.End || 0),
              outputText: savedAsset.filePath
            }),
            buildWriteTarget('replace', {
              start: Number(range?.Start || 0),
              end: Number(range?.End || 0),
              outputText: savedAsset.filePath
            })
          ]
        }
      default:
        throw new Error(`当前不支持图片文档动作: ${finalAction}`)
    }
  }

  if (finalAction === 'none') {
    return { ok: true, action: 'none', message: `已生成${kind === 'audio' ? '音频' : '视频'}文件`, filePath: savedAsset.filePath, writeTargets: [] }
  }
  if (finalAction === 'comment') {
    addCommentToRange(range, `${commentPrefix}${commentBody || `已生成${kind === 'audio' ? '音频' : '视频'}文件。`}\n\n文件：${savedAsset.filePath}`.trim())
    return {
      ok: true,
      action: 'comment',
      message: `已添加${kind === 'audio' ? '音频' : '视频'}文件批注`,
      filePath: savedAsset.filePath,
      writeTargets: [buildWriteTarget('comment', {
        start: Number(range?.Start || 0),
        end: Number(range?.End || 0),
        outputText: savedAsset.filePath
      })]
    }
  }
  throw new Error(`当前版本暂不支持将${kind === 'audio' ? '音频' : '视频'}直接嵌入文档，请使用“仅生成结果”或“添加批注”`)
}

export { getApplication }
