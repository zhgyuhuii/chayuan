function normalizeText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function getFileName(file) {
  return String(file?.name || '').trim()
}

function getExtension(file) {
  const name = getFileName(file).toLowerCase()
  const match = name.match(/\.([a-z0-9]+)$/i)
  return match?.[1] || ''
}

function isDocxLike(file) {
  const ext = getExtension(file)
  return ext === 'docx' || ext === 'aidocx'
}

function isPdf(file) {
  return getExtension(file) === 'pdf'
}

function isSpreadsheet(file) {
  const ext = getExtension(file)
  return ext === 'xlsx' || ext === 'xls' || ext === 'et'
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('文件不存在'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsArrayBuffer(file)
  })
}

async function loadMammoth() {
  const module = await import('mammoth')
  return module?.default && typeof module.default.extractRawText === 'function'
    ? module.default
    : module
}

async function extractDocxText(file) {
  const mammoth = await loadMammoth()
  const arrayBuffer = await readFileAsArrayBuffer(file)
  const result = await mammoth.extractRawText({ arrayBuffer })
  return normalizeText(result?.value || '')
}

async function loadPdfJs() {
  return import('pdfjs-dist/webpack.mjs')
}

async function loadXlsx() {
  const module = await import('xlsx')
  return module?.default && typeof module.default.read === 'function'
    ? module.default
    : module
}

async function extractPdfText(file) {
  const pdfjs = await loadPdfJs()
  const arrayBuffer = await readFileAsArrayBuffer(file)
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: false,
    isEvalSupported: false
  })
  const pdf = await loadingTask.promise
  const pages = []
  for (let index = 1; index <= pdf.numPages; index++) {
    const page = await pdf.getPage(index)
    const content = await page.getTextContent()
    const text = content.items.map(item => String(item?.str || '')).join(' ')
    const normalized = normalizeText(text)
    if (normalized) {
      pages.push(`第 ${index} 页\n${normalized}`)
    }
  }
  return normalizeText(pages.join('\n\n'))
}

function normalizeSheetRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return ''
  const lines = rows
    .map((row) => {
      if (!Array.isArray(row)) return ''
      return row
        .map(cell => normalizeText(cell == null ? '' : String(cell)))
        .filter(Boolean)
        .join(' | ')
    })
    .filter(Boolean)
  return normalizeText(lines.join('\n'))
}

async function extractSpreadsheetText(file) {
  const xlsx = await loadXlsx()
  const arrayBuffer = await readFileAsArrayBuffer(file)
  const workbook = xlsx.read(arrayBuffer, { type: 'array' })
  const sections = []
  ;(workbook?.SheetNames || []).forEach((sheetName) => {
    const sheet = workbook?.Sheets?.[sheetName]
    if (!sheet) return
    const rows = xlsx.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
      defval: ''
    })
    const content = normalizeSheetRows(rows)
    if (content) {
      sections.push(`工作表：${sheetName}\n${content}`)
    }
  })
  return normalizeText(sections.join('\n\n'))
}

export function isStructuredTextAttachment(file) {
  return isDocxLike(file) || isPdf(file) || isSpreadsheet(file)
}

export async function extractStructuredAttachmentText(file) {
  if (isDocxLike(file)) {
    const content = await extractDocxText(file)
    return {
      kind: 'docx',
      content
    }
  }
  if (isPdf(file)) {
    const content = await extractPdfText(file)
    return {
      kind: 'pdf',
      content
    }
  }
  if (isSpreadsheet(file)) {
    const content = await extractSpreadsheetText(file)
    return {
      kind: 'xlsx',
      content
    }
  }
  return {
    kind: '',
    content: ''
  }
}
