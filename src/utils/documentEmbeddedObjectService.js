function getApplication() {
  return window.Application || window.opener?.Application || window.parent?.Application || null
}

function safeCall(getter, fallback = null) {
  try {
    const value = getter()
    return value == null ? fallback : value
  } catch (_) {
    return fallback
  }
}

function getFileSystem() {
  return getApplication()?.FileSystem || null
}

function normalizePath(value) {
  return String(value || '').replace(/^file:\/\//i, '').trim()
}

function getPathExtension(path) {
  const match = String(path || '').match(/\.([a-zA-Z0-9_-]+)$/)
  return match?.[1]?.toLowerCase() || 'bin'
}

function getPathBaseName(path, fallback = '导出文件') {
  const normalized = normalizePath(path)
  if (!normalized) return fallback
  const parts = normalized.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || fallback
}

function binaryStringFromArrayBuffer(arr) {
  const bytes = new Uint8Array(arr)
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)))
  }
  return binary
}

function readFileAsBase64(path) {
  const fs = getFileSystem()
  const normalizedPath = normalizePath(path)
  if (!fs || !normalizedPath) return ''
  if (typeof fs.readAsBinaryString === 'function') {
    const binary = fs.readAsBinaryString(normalizedPath)
    return binary ? btoa(binary) : ''
  }
  if (typeof fs.ReadFileAsArrayBuffer === 'function') {
    const arr = fs.ReadFileAsArrayBuffer(normalizedPath)
    if (!arr) return ''
    return btoa(binaryStringFromArrayBuffer(arr))
  }
  return ''
}

function detectObjectType(target) {
  const classType = String(safeCall(() => target.OLEFormat.ClassType, '') || '').trim()
  const progId = String(safeCall(() => target.OLEFormat.ProgID, '') || '').trim()
  if (/excel|ket/i.test(classType) || /excel|ket/i.test(progId)) return 'spreadsheet'
  if (/word|wps/i.test(classType) || /word|wps/i.test(progId)) return 'document'
  if (/pdf/i.test(classType) || /pdf/i.test(progId)) return 'pdf'
  if (/package/i.test(classType) || /package/i.test(progId)) return 'package'
  return 'object'
}

function buildDescriptor(target, containerKind, index) {
  const sourcePath = normalizePath(
    safeCall(() => target.LinkFormat.SourceFullName, '') ||
    safeCall(() => target.OLEFormat.SourceFullName, '') ||
    safeCall(() => target.OLEFormat.Object.FullName, '') ||
    ''
  )
  const classType = String(safeCall(() => target.OLEFormat.ClassType, '') || '').trim()
  const progId = String(safeCall(() => target.OLEFormat.ProgID, '') || '').trim()
  const iconLabel = String(
    safeCall(() => target.OLEFormat.IconLabel, '') ||
    safeCall(() => target.AlternativeText, '') ||
    ''
  ).trim()
  const rangeStart = Number(safeCall(() => target.Range.Start, 0) || 0)
  const rangeEnd = Number(safeCall(() => target.Range.End, 0) || 0)
  return {
    id: `${containerKind}-${index}`,
    containerKind,
    index,
    type: detectObjectType(target),
    classType,
    progId,
    iconLabel,
    sourcePath,
    rangeStart,
    rangeEnd
  }
}

function collectInlineObjects(collection, descriptors) {
  if (!collection || !collection.Count) return
  for (let i = 1; i <= collection.Count; i++) {
    const target = safeCall(() => collection.Item(i), null)
    if (!target) continue
    const hasOle = !!safeCall(() => target.OLEFormat, null)
    const hasLink = !!safeCall(() => target.LinkFormat, null)
    if (!hasOle && !hasLink) continue
    descriptors.push(buildDescriptor(target, 'inline', i))
  }
}

function collectShapeObjects(collection, descriptors) {
  if (!collection || !collection.Count) return
  for (let i = 1; i <= collection.Count; i++) {
    const target = safeCall(() => collection.Item(i), null)
    if (!target) continue
    const hasOle = !!safeCall(() => target.OLEFormat, null)
    const hasLink = !!safeCall(() => target.LinkFormat, null)
    if (!hasOle && !hasLink) continue
    descriptors.push(buildDescriptor(target, 'shape', i))
  }
}

function descriptorToAsset(descriptor, assetIndex) {
  if (!descriptor?.sourcePath) return null
  const base64 = readFileAsBase64(descriptor.sourcePath)
  if (!base64) return null
  const extension = getPathExtension(descriptor.sourcePath)
  return {
    base64,
    extension,
    mimeType: 'application/octet-stream',
    baseName: `${getPathBaseName(descriptor.sourcePath, '导出文件').replace(/\.[^.]+$/, '') || '导出文件'}_${assetIndex}`
  }
}

export function exportDocumentEmbeddedObjects(scope = 'document') {
  const app = getApplication()
  const doc = app?.ActiveDocument
  if (!doc) {
    throw new Error('当前没有打开文档')
  }
  const descriptors = []
  if (scope === 'selection') {
    collectInlineObjects(app?.Selection?.InlineShapes, descriptors)
    collectShapeObjects(app?.Selection?.ShapeRange, descriptors)
  } else {
    collectInlineObjects(doc.InlineShapes, descriptors)
    collectShapeObjects(doc.Shapes, descriptors)
  }

  const assets = []
  const unresolved = []
  descriptors.forEach((descriptor, index) => {
    const asset = descriptorToAsset(descriptor, index + 1)
    if (asset) {
      assets.push(asset)
    } else {
      unresolved.push(descriptor)
    }
  })

  return {
    descriptors,
    assets,
    unresolved
  }
}
