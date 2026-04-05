import { ensureDir, getEffectiveDataDir, pathJoin, pathSep } from './dataPathSettings.js'

function getApplication() {
  return window.Application || window.opener?.Application || window.parent?.Application || null
}

function getFileSystem() {
  return getApplication()?.FileSystem || null
}

function buildTempDir() {
  const app = getApplication()
  const fs = getFileSystem()
  if (!fs) throw new Error('FileSystem 不可用，无法导出图片')
  let dir = ''
  if (app?.Env?.GetTempPath) {
    dir = String(app.Env.GetTempPath() || '').replace(/^file:\/\//i, '').replace(/\\/g, '/').replace(/\/+$/, '')
  }
  if (!dir && getEffectiveDataDir()) {
    dir = pathJoin(getEffectiveDataDir(), '_exported_images')
  }
  if (!dir) {
    dir = pathJoin(pathSep() === '\\' ? 'C:\\Temp' : '/tmp', 'chayuan_exported_images')
  }
  ensureDir(fs, dir)
  return pathSep() === '\\' ? dir.replace(/\//g, '\\') : dir.replace(/\\/g, '/')
}

function buildTempFilePath(extension = 'png', prefix = 'document_image') {
  const dir = buildTempDir()
  const ext = String(extension || 'png').replace(/^\.+/, '') || 'png'
  return pathJoin(dir, `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`)
}

function guessMimeType(extension) {
  const ext = String(extension || '').toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'bmp') return 'image/bmp'
  if (ext === 'emf') return 'image/emf'
  return 'application/octet-stream'
}

function readBinaryString(path) {
  const fs = getFileSystem()
  if (!fs) return ''
  if (typeof fs.readAsBinaryString === 'function') {
    return fs.readAsBinaryString(path) || ''
  }
  if (typeof fs.ReadFileAsArrayBuffer === 'function') {
    const arr = fs.ReadFileAsArrayBuffer(path)
    if (!arr) return ''
    const bytes = new Uint8Array(arr)
    let binary = ''
    const chunk = 8192
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)))
    }
    return binary
  }
  return ''
}

function tryExportWithApi(target, fullPath, formatLabel) {
  if (!target) return { ok: false, error: '没有导出目标对象' }
  const errors = []
  const tryCall = (fn, method) => {
    try {
      fn()
      return { ok: true, method }
    } catch (error) {
      errors.push(`${method}: ${error?.message || error}`)
      return null
    }
  }
  if (typeof target.SaveAsPicture === 'function') {
    const res = tryCall(() => target.SaveAsPicture(fullPath), 'SaveAsPicture')
    if (res) return res
  }
  if (target.PictureFormat && typeof target.PictureFormat.Export === 'function') {
    const res = tryCall(() => target.PictureFormat.Export(fullPath), 'PictureFormat.Export')
    if (res) return res
    const resWithFormat = tryCall(
      () => target.PictureFormat.Export(fullPath, formatLabel),
      'PictureFormat.Export(format)'
    )
    if (resWithFormat) return resWithFormat
  }
  if (typeof target.Export === 'function') {
    const res = tryCall(() => target.Export(fullPath), 'Shape.Export')
    if (res) return res
  }
  return { ok: false, error: errors.join('; ') }
}

function writeEnhMetaFile(path, binaryData) {
  if (typeof window === 'undefined' || typeof window.ActiveXObject === 'undefined') {
    throw new Error('当前环境不支持 EMF 回退导出')
  }
  const imageStream = new window.ActiveXObject('ADODB.Stream')
  imageStream.Type = 1
  imageStream.Open()
  imageStream.Write(binaryData)
  imageStream.SaveToFile(path.replace(/\//g, '\\'), 2)
  imageStream.Close()
}

function exportInlineShapeAsset(inlineShape, index) {
  const apiPath = buildTempFilePath('png', `inline_image_${index}`)
  const apiResult = tryExportWithApi(inlineShape, apiPath, 'png')
  if (apiResult.ok) {
    const binary = readBinaryString(apiPath)
    if (binary) {
      return {
        ok: true,
        asset: {
          base64: btoa(binary),
          extension: 'png',
          mimeType: 'image/png',
          baseName: `文档图片_${index}`
        }
      }
    }
  }
  if (!inlineShape?.Range?.EnhMetaFileBits) {
    return { ok: false, error: apiResult.error || '不支持导出当前嵌入式图片' }
  }
  const emfPath = buildTempFilePath('emf', `inline_image_${index}`)
  writeEnhMetaFile(emfPath, inlineShape.Range.EnhMetaFileBits)
  const binary = readBinaryString(emfPath)
  if (!binary) {
    return { ok: false, error: '已导出图片但读取失败' }
  }
  return {
    ok: true,
    asset: {
      base64: btoa(binary),
      extension: 'emf',
      mimeType: guessMimeType('emf'),
      baseName: `文档图片_${index}`
    }
  }
}

function exportFloatingShapeAsset(shape, index) {
  const apiPath = buildTempFilePath('png', `shape_image_${index}`)
  const apiResult = tryExportWithApi(shape, apiPath, 'png')
  if (apiResult.ok) {
    const binary = readBinaryString(apiPath)
    if (binary) {
      return {
        ok: true,
        asset: {
          base64: btoa(binary),
          extension: 'png',
          mimeType: 'image/png',
          baseName: `文档图片_${index}`
        }
      }
    }
  }
  shape.Select?.()
  const selection = getApplication()?.Selection
  const emfBits = selection?.Range?.EnhMetaFileBits
  if (!emfBits) {
    return { ok: false, error: apiResult.error || '不支持导出当前浮动图片' }
  }
  const emfPath = buildTempFilePath('emf', `shape_image_${index}`)
  writeEnhMetaFile(emfPath, emfBits)
  const binary = readBinaryString(emfPath)
  if (!binary) {
    return { ok: false, error: '已导出图片但读取失败' }
  }
  return {
    ok: true,
    asset: {
      base64: btoa(binary),
      extension: 'emf',
      mimeType: guessMimeType('emf'),
      baseName: `文档图片_${index}`
    }
  }
}

export function exportDocumentImagesAsAssets(scope = 'document') {
  const app = getApplication()
  const doc = app?.ActiveDocument
  if (!doc) {
    throw new Error('当前没有打开文档')
  }

  const assets = []
  const errors = []
  let imageIndex = 0

  const inlineShapes = scope === 'selection'
    ? app?.Selection?.InlineShapes
    : doc.InlineShapes
  if (inlineShapes && inlineShapes.Count > 0) {
    for (let i = 1; i <= inlineShapes.Count; i++) {
      try {
        const shape = inlineShapes.Item(i)
        imageIndex += 1
        const result = exportInlineShapeAsset(shape, imageIndex)
        if (result.ok && result.asset) {
          assets.push(result.asset)
        } else {
          errors.push(`嵌入式图片 ${i}: ${result.error || '导出失败'}`)
        }
      } catch (error) {
        errors.push(`嵌入式图片 ${i}: ${error?.message || error}`)
      }
    }
  }

  if (scope === 'selection') {
    const shapeRange = app?.Selection?.ShapeRange
    if (shapeRange && shapeRange.Count > 0) {
      for (let i = 1; i <= shapeRange.Count; i++) {
        try {
          const shape = shapeRange.Item(i)
          imageIndex += 1
          const result = exportFloatingShapeAsset(shape, imageIndex)
          if (result.ok && result.asset) {
            assets.push(result.asset)
          } else {
            errors.push(`浮动图片 ${i}: ${result.error || '导出失败'}`)
          }
        } catch (error) {
          errors.push(`浮动图片 ${i}: ${error?.message || error}`)
        }
      }
    }
  } else {
    const shapes = doc.Shapes
    if (shapes && shapes.Count > 0) {
      for (let i = 1; i <= shapes.Count; i++) {
        try {
          const shape = shapes.Item(i)
          if (shape?.Type !== 13) continue
          imageIndex += 1
          const result = exportFloatingShapeAsset(shape, imageIndex)
          if (result.ok && result.asset) {
            assets.push(result.asset)
          } else {
            errors.push(`浮动图片 ${i}: ${result.error || '导出失败'}`)
          }
        } catch (error) {
          errors.push(`浮动图片 ${i}: ${error?.message || error}`)
        }
      }
    }
  }

  return {
    assets,
    errors,
    totalCount: imageIndex
  }
}
