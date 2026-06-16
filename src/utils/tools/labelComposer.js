// 标签合成：码图在上、文字逐行居中在下,合成一张 PNG dataURL。浏览器 canvas,仅在 WPS/浏览器运行。

const SIZE_PRESET = {
  small: { code: 80, font: 11, pad: 6, line: 15, width: 120 },
  medium: { code: 120, font: 14, pad: 8, line: 19, width: 170 },
  large: { code: 170, font: 18, pad: 10, line: 24, width: 230 }
}

// 按码图原始宽高比,以 codeH 为高算出绘制宽高(保持比例,不压扁)。纯函数,可单测。
export function fitLabelCodeDims(natW, natH, codeH) {
  const h = Math.max(1, Number(codeH) || 1)
  const nw = Number(natW) > 0 ? Number(natW) : h
  const nh = Number(natH) > 0 ? Number(natH) : h
  return { drawH: h, drawW: Math.max(1, Math.round(h * (nw / nh))) }
}

// { codeDataUrl, textLines:string[], size } -> Promise<dataURL>
export function composeLabel({ codeDataUrl, textLines, size }) {
  return new Promise((resolve, reject) => {
    const p = SIZE_PRESET[size] || SIZE_PRESET.medium
    const lines = (textLines || []).filter((t) => t != null && String(t).length > 0).map(String)
    const img = new Image()
    img.onload = () => {
      try {
        const { drawW, drawH } = fitLabelCodeDims(img.naturalWidth || img.width, img.naturalHeight || img.height, p.code)
        const w = Math.max(p.width, drawW + p.pad * 2)
        const h = p.pad * 2 + drawH + (lines.length ? p.pad + lines.length * p.line : 0)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, (w - drawW) / 2, p.pad, drawW, drawH)
        ctx.fillStyle = '#000000'
        ctx.font = `${p.font}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        let y = p.pad + drawH + p.pad
        lines.forEach((t) => { ctx.fillText(t, w / 2, y); y += p.line })
        resolve(canvas.toDataURL('image/png'))
      } catch (e) {
        reject(e instanceof Error ? e : new Error('标签合成失败'))
      }
    }
    img.onerror = () => reject(new Error('码图加载失败'))
    img.src = codeDataUrl
  })
}
