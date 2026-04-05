<template>
  <div class="uniform-image-format-dialog">
    <div class="popup-header">
      <h2>统一图像格式</h2>
      <p class="subtitle">设置将应用到文档中所有图片（嵌入式与浮动型）。留空项不修改。</p>
    </div>
    <div class="popup-body">
      <section class="form-section">
        <h3>尺寸（磅）</h3>
        <div class="form-row">
          <div class="form-group">
            <label for="img-width">宽度</label>
            <input
              id="img-width"
              v-model.trim="form.width"
              type="number"
              min="1"
              max="2000"
              step="1"
              placeholder="留空不修改"
              class="input-number"
              @input="errorMsg = ''"
            />
          </div>
          <div class="form-group">
            <label for="img-height">高度</label>
            <input
              id="img-height"
              v-model.trim="form.height"
              type="number"
              min="1"
              max="2000"
              step="1"
              placeholder="留空不修改"
              class="input-number"
              @input="errorMsg = ''"
            />
          </div>
        </div>
        <div class="form-group checkbox-row">
          <label class="checkbox-label">
            <input v-model="form.lockAspectRatio" type="checkbox" />
            <span>锁定纵横比</span>
          </label>
          <p class="hint">仅填宽度或高度时，按原图比例计算另一边</p>
        </div>
      </section>

      <section class="form-section">
        <h3>描边</h3>
        <div class="form-group checkbox-row">
          <label class="checkbox-label">
            <input v-model="form.borderEnabled" type="checkbox" />
            <span>显示描边</span>
          </label>
        </div>
        <template v-if="form.borderEnabled">
          <div class="form-row">
            <div class="form-group">
              <label for="border-weight">线宽（磅）</label>
              <input
                id="border-weight"
                v-model.number="form.borderWeight"
                type="number"
                min="0.25"
                max="20"
                step="0.25"
                placeholder="1"
                class="input-number"
              />
            </div>
            <div class="form-group">
              <label for="border-color">颜色</label>
              <select id="border-color" v-model="form.borderColor" class="input-select">
                <option value="black">黑色</option>
                <option value="gray">灰色</option>
                <option value="silver">银色</option>
                <option value="darkblue">深蓝</option>
                <option value="navy">藏青</option>
              </select>
            </div>
          </div>
        </template>
      </section>

      <section class="form-section">
        <h3>图像效果</h3>
        <div class="form-row">
          <div class="form-group">
            <label for="brightness">亮度（-100～100）</label>
            <input
              id="brightness"
              v-model.trim="form.brightness"
              type="number"
              min="-100"
              max="100"
              step="1"
              placeholder="留空不修改"
              class="input-number"
            />
          </div>
          <div class="form-group">
            <label for="contrast">对比度（-100～100）</label>
            <input
              id="contrast"
              v-model.trim="form.contrast"
              type="number"
              min="-100"
              max="100"
              step="1"
              placeholder="留空不修改"
              class="input-number"
            />
          </div>
        </div>
      </section>

      <section class="form-section">
        <h3>对齐方式</h3>
        <p class="hint">仅影响嵌入式图片所在段落的对齐</p>
        <div class="form-group radio-row">
          <label class="radio-label">
            <input v-model="form.align" type="radio" value="unchanged" name="align" />
            <span>不修改</span>
          </label>
          <label class="radio-label">
            <input v-model="form.align" type="radio" value="left" name="align" />
            <span>左对齐</span>
          </label>
          <label class="radio-label">
            <input v-model="form.align" type="radio" value="center" name="align" />
            <span>居中</span>
          </label>
          <label class="radio-label">
            <input v-model="form.align" type="radio" value="right" name="align" />
            <span>右对齐</span>
          </label>
        </div>
      </section>

      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
      <div v-if="resultMsg" class="result" :class="resultOk ? 'success' : 'error'">{{ resultMsg }}</div>
    </div>
    <div class="popup-footer">
      <button type="button" class="btn btn-primary" :disabled="applying" @click="onConfirm">
        {{ applying ? '处理中…' : '确定' }}
      </button>
      <button type="button" class="btn btn-secondary" :disabled="applying" @click="onCancel">取消</button>
    </div>
  </div>
</template>

<script>
// Word/WPS 常用常量
const msoTrue = -1
const msoFalse = 0
const msoPicture = 13
// 颜色 BGR
const BORDER_COLORS = {
  black: 0x000000,
  gray: 0x808080,
  silver: 0xc0c0c0,
  darkblue: 0x8b0000,
  navy: 0x800000
}
const wdAlignParagraphLeft = 0
const wdAlignParagraphCenter = 1
const wdAlignParagraphRight = 2

function canApplyToInlineShape(inlineShape) {
  if (!inlineShape) return false
  try {
    const t = inlineShape.Type
    // 3=图片 4=链接图片 6=横线 7=图片横线 8=链接图片横线 9=图片项目符 12=图表 等
    if (t === 3 || t === 4) return true
    if (inlineShape.PictureFormat) return true
    if (typeof inlineShape.SaveAsPicture === 'function') return true
    if (inlineShape.Range && inlineShape.Range.EnhMetaFileBits) return true
  } catch (e) {}
  return false
}

export default {
  name: 'UniformImageFormatDialog',
  data() {
    return {
      form: {
        width: '',
        height: '',
        lockAspectRatio: false,
        borderEnabled: false,
        borderWeight: 1,
        borderColor: 'black',
        brightness: '',
        contrast: '',
        align: 'unchanged'
      },
      errorMsg: '',
      resultMsg: '',
      resultOk: true,
      applying: false
    }
  },
  methods: {
    validate() {
      this.errorMsg = ''
      const w = this.form.width.trim()
      const h = this.form.height.trim()
      if (w) {
        const n = Number(w)
        if (Number.isNaN(n) || n < 1 || n > 2000) {
          this.errorMsg = '宽度须在 1～2000 磅之间'
          return false
        }
      }
      if (h) {
        const n = Number(h)
        if (Number.isNaN(n) || n < 1 || n > 2000) {
          this.errorMsg = '高度须在 1～2000 磅之间'
          return false
        }
      }
      if (this.form.borderEnabled) {
        const bw = Number(this.form.borderWeight)
        if (Number.isNaN(bw) || bw < 0.25 || bw > 20) {
          this.errorMsg = '描边线宽须在 0.25～20 磅之间'
          return false
        }
      }
      const br = this.form.brightness.trim()
      if (br) {
        const n = Number(br)
        if (Number.isNaN(n) || n < -100 || n > 100) {
          this.errorMsg = '亮度须在 -100～100 之间'
          return false
        }
      }
      const co = this.form.contrast.trim()
      if (co) {
        const n = Number(co)
        if (Number.isNaN(n) || n < -100 || n > 100) {
          this.errorMsg = '对比度须在 -100～100 之间'
          return false
        }
      }
      const hasAny =
        !!this.form.width.trim() ||
        !!this.form.height.trim() ||
        this.form.borderEnabled ||
        !!this.form.brightness.trim() ||
        !!this.form.contrast.trim() ||
        this.form.align !== 'unchanged'
      if (!hasAny) {
        this.errorMsg = '请至少设置一项'
        return false
      }
      return true
    },
    applyToAllImages() {
      const doc = window.Application && window.Application.ActiveDocument
      if (!doc) return { ok: false, msg: '当前没有打开任何文档' }

      const widthPt = this.form.width.trim() ? Math.round(Number(this.form.width)) : null
      const heightPt = this.form.height.trim() ? Math.round(Number(this.form.height)) : null
      const lockRatio = !!this.form.lockAspectRatio
      const borderOn = !!this.form.borderEnabled
      const borderWeight = borderOn ? Math.max(0.25, Math.min(20, Number(this.form.borderWeight) || 1)) : 0
      const borderColorBgr = BORDER_COLORS[this.form.borderColor] ?? BORDER_COLORS.black
      const brightnessVal = this.form.brightness.trim() ? Number(this.form.brightness) : null
      const contrastVal = this.form.contrast.trim() ? Number(this.form.contrast) : null
      const align = this.form.align

      // Word/WPS PictureFormat 亮度、对比度为 0~1，0.5 为默认。-100~100 映射为 0~1
      const toPicture01 = (v) => Math.max(0, Math.min(1, 0.5 + (v / 100) * 0.5))

      let appliedInline = 0
      let appliedShape = 0
      const errors = []

      function setSize(obj, w, h, lock) {
        try {
          if (lock && typeof obj.LockAspectRatio !== 'undefined') obj.LockAspectRatio = msoTrue
          else if (typeof obj.LockAspectRatio !== 'undefined') obj.LockAspectRatio = msoFalse
          if (w != null && typeof obj.Width !== 'undefined') obj.Width = w
          if (h != null && typeof obj.Height !== 'undefined') obj.Height = h
        } catch (e) {
          errors.push('尺寸: ' + (e.message || e))
        }
      }

      function setBorder(obj) {
        try {
          if (!obj.Line) return
          obj.Line.Visible = borderOn ? msoTrue : msoFalse
          if (borderOn) {
            if (typeof obj.Line.Weight !== 'undefined') obj.Line.Weight = borderWeight
            if (obj.Line.ForeColor && typeof obj.Line.ForeColor.RGB !== 'undefined') {
              obj.Line.ForeColor.RGB = borderColorBgr
            }
          }
        } catch (e) {
          errors.push('描边: ' + (e.message || e))
        }
      }

      function setPictureFormat(obj) {
        try {
          const pf = obj.PictureFormat
          if (!pf) return
          if (brightnessVal != null && typeof pf.Brightness !== 'undefined') {
            pf.Brightness = toPicture01(brightnessVal)
          }
          if (contrastVal != null && typeof pf.Contrast !== 'undefined') {
            pf.Contrast = toPicture01(contrastVal)
          }
        } catch (e) {
          errors.push('亮度/对比度: ' + (e.message || e))
        }
      }

      function setParagraphAlignment(para, a) {
        if (!para || !para.Range || a === 'unchanged') return
        try {
          const r = para.Range
          if (a === 'left') r.ParagraphFormat.Alignment = wdAlignParagraphLeft
          else if (a === 'center') r.ParagraphFormat.Alignment = wdAlignParagraphCenter
          else if (a === 'right') r.ParagraphFormat.Alignment = wdAlignParagraphRight
        } catch (e) {}
      }

      try {
        const inlineShapes = doc.InlineShapes
        if (inlineShapes && inlineShapes.Count > 0) {
          for (let i = 1; i <= inlineShapes.Count; i++) {
            try {
              const s = inlineShapes.Item(i)
              if (!canApplyToInlineShape(s)) continue
              const w = widthPt
              let h = heightPt
              if (lockRatio && (w || h) && s.Width && s.Height) {
                if (w && !h) h = (s.Height / s.Width) * w
                else if (h && !w) {
                  const ratioW = (s.Width / s.Height) * h
                  setSize(s, ratioW, h, lockRatio)
                  setBorder(s)
                  setPictureFormat(s)
                  if (align !== 'unchanged' && s.Range && s.Range.Paragraphs && s.Range.Paragraphs.Count >= 1) {
                    setParagraphAlignment(s.Range.Paragraphs.Item(1), align)
                  }
                  appliedInline++
                  continue
                }
              }
              setSize(s, w, h, lockRatio)
              setBorder(s)
              setPictureFormat(s)
              if (align !== 'unchanged' && s.Range && s.Range.Paragraphs && s.Range.Paragraphs.Count >= 1) {
                setParagraphAlignment(s.Range.Paragraphs.Item(1), align)
              }
              appliedInline++
            } catch (e) {
              errors.push(`内嵌图 ${i}: ${e.message || e}`)
            }
          }
        }

        const shapes = doc.Shapes
        if (shapes && shapes.Count > 0) {
          for (let i = 1; i <= shapes.Count; i++) {
            try {
              const s = shapes.Item(i)
              if (s.Type !== msoPicture) continue
              const w = widthPt
              let h = heightPt
              if (lockRatio && (w || h) && s.Width && s.Height) {
                if (w && !h) h = (s.Height / s.Width) * w
                else if (h && !w) {
                  const ratioW = (s.Width / s.Height) * h
                  setSize(s, ratioW, h, lockRatio)
                  setBorder(s)
                  setPictureFormat(s)
                  appliedShape++
                  continue
                }
              }
              setSize(s, w, h, lockRatio)
              setBorder(s)
              setPictureFormat(s)
              appliedShape++
            } catch (e) {
              errors.push(`浮动图 ${i}: ${e.message || e}`)
            }
          }
        }

        const total = appliedInline + appliedShape
        if (total === 0 && errors.length === 0) {
          return { ok: true, msg: '文档中未找到可处理的图片', count: 0 }
        }
        const errStr = errors.length ? '\n部分错误: ' + errors.slice(0, 3).join('; ') : ''
        return {
          ok: true,
          msg: `已处理 ${total} 张图片（嵌入式 ${appliedInline}，浮动型 ${appliedShape}）${errStr}`,
          count: total
        }
      } catch (e) {
        return { ok: false, msg: (e.message || e) + '' }
      }
    },
    onConfirm() {
      if (!this.validate()) return
      this.applying = true
      this.errorMsg = ''
      this.resultMsg = ''
      this.$nextTick(() => {
        setTimeout(() => {
          const res = this.applyToAllImages()
          this.applying = false
          this.resultOk = res.ok
          this.resultMsg = res.msg || (res.ok ? '操作完成' : '操作失败')
          if (res.ok && res.count !== undefined && res.count > 0) {
            try {
              if (window.close) window.close()
            } catch (e) {}
          }
        }, 50)
      })
    },
    onCancel() {
      try {
        if (window.close) window.close()
      } catch (e) {}
    }
  }
}
</script>

<style scoped>
.uniform-image-format-dialog {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  color: #333;
  background: #f8fafc;
}

.popup-header {
  padding: 10px 14px 8px;
  border-bottom: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 0 0 8px 8px;
}

.popup-header h2 {
  margin: 0 0 2px 0;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.subtitle {
  margin: 0;
  font-size: 11px;
  color: #64748b;
}

.popup-body {
  flex: 1;
  padding: 12px 14px;
  overflow-y: auto;
}

.form-section {
  margin-bottom: 14px;
}

.form-section h3 {
  margin: 0 0 8px 0;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.form-row {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.form-row .form-group {
  flex: 1;
  min-width: 0;
}

.form-group {
  margin-bottom: 8px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #334155;
}

.input-number,
.input-select,
.input-text {
  display: block;
  width: 100%;
  max-width: 160px;
  padding: 6px 10px;
  font-size: 13px;
  line-height: 1.3;
  color: #1e293b;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  box-sizing: border-box;
}

.input-number:focus,
.input-select:focus,
.input-text:focus {
  outline: none;
  border-color: #3b82f6;
}

.input-number::placeholder,
.input-text::placeholder {
  color: #94a3b8;
}

.input-select {
  max-width: 140px;
  cursor: pointer;
}

.checkbox-row,
.radio-row {
  margin-bottom: 4px;
}

.checkbox-label,
.radio-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 12px;
  font-weight: 400;
  cursor: pointer;
}

.checkbox-label input,
.radio-label input {
  margin: 0;
}

.hint {
  margin: 0 0 6px 0;
  font-size: 11px;
  color: #64748b;
}

.error {
  margin: 8px 0 0 0;
  font-size: 11px;
  color: #dc2626;
}

.result {
  margin-top: 8px;
  padding: 8px 10px;
  font-size: 11px;
  border-radius: 6px;
  line-height: 1.4;
}

.result.success {
  color: #166534;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
}

.result.error {
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.popup-footer {
  display: flex;
  gap: 8px;
  padding: 10px 14px 12px;
  border-top: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 8px 8px 0 0;
}

.btn {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  color: #fff;
  background: #3b82f6;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  color: #475569;
  background: #f1f5f9;
}

.btn-secondary:hover:not(:disabled) {
  background: #e2e8f0;
}
</style>
