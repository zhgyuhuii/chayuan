<template>
  <div class="table-caption-dialog">
    <div class="popup-header">
      <h2>添加或修改题注</h2>
      <p class="subtitle">{{ isImageMode ? '在正文中图像的上一行或下一行插入题注，居中显示' : '在正文中表格的上一行或下一行插入题注，不进入表格内部，居中显示' }}</p>
    </div>
    <div class="popup-body">
      <div class="form-group">
        <label for="label">标签</label>
        <input
          id="label"
          v-model.trim="labelText"
          type="text"
          placeholder="例如：表"
          class="input-text"
          @input="errorMsg = ''"
        />
        <p class="hint">题注序号自动生成：{{ isImageMode ? '图1、图2、图3…' : '表1、表2、表3…' }}</p>
      </div>
      <div class="form-group">
        <label for="caption">题注内容（可选）</label>
        <input
          id="caption"
          v-model.trim="captionSuffix"
          type="text"
          placeholder="例如：说明"
          class="input-text"
        />
        <p class="hint">接在序号后，无空格，如「表1说明」</p>
      </div>
      <div class="form-group radio-row">
        <label class="radio-label">
          <input v-model="position" type="radio" value="above" name="position" />
          <span>上方</span>
        </label>
        <label class="radio-label">
          <input v-model="position" type="radio" value="below" name="position" />
          <span>下方</span>
        </label>
      </div>
      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    </div>
    <div class="popup-footer">
      <button type="button" class="btn btn-primary" @click="onConfirm">确定</button>
      <button type="button" class="btn btn-secondary" @click="onCancel">取消</button>
    </div>
  </div>
</template>

<script>
// Word 枚举：wdCollapseStart=1, wdCollapseEnd=0, wdParagraph=4, wdAlignParagraphCenter=1
const wdCollapseStart = 1
const wdCollapseEnd = 0
const wdParagraph = 4
const wdAlignParagraphCenter = 1

export default {
  name: 'TableCaptionDialog',
  data() {
    return {
      labelText: '表',
      captionSuffix: '',
      position: 'above',
      errorMsg: ''
    }
  },
  computed: {
    isImageMode() {
      return this.$route && this.$route.query && this.$route.query.mode === 'image'
    }
  },
  created() {
    if (this.isImageMode) this.labelText = '图'
  },
  methods: {
    validate() {
      this.errorMsg = ''
      const label = (this.labelText || '').trim()
      if (!label) {
        this.errorMsg = '请输入标签（如：表）'
        return false
      }
      if (this.position !== 'above' && this.position !== 'below') {
        this.errorMsg = '请选择“上方”或“下方”'
        return false
      }
      return true
    },
    // 按 WPS 官方 API（如 solution.wps.cn / 客户端集成）实现：先确定表格位置，判断上/下段是否空白；
    // 空白则题注放入该段，否则用 Selection.SetRange + Selection.InsertAfter 在表格前/后插入新段再写题注。
    applyCaptions() {
      const app = window.Application
      const doc = app && app.ActiveDocument
      if (!doc) {
        return { ok: false, msg: '当前没有打开任何文档' }
      }
      const tables = doc.Tables
      if (!tables || tables.Count === 0) {
        return { ok: false, msg: '文档中没有表格' }
      }
      const sel = app.Selection || (app.ActiveWindow && app.ActiveWindow.Selection)
      const label = (this.labelText || '表').trim()
      const suffix = (this.captionSuffix || '').trim()
      const suffixText = suffix || ''
      const isAbove = this.position === 'above'
      const paraBreak = '\r'
      const wdAlignParagraphCenter =
        (app.Enum && app.Enum.wdAlignParagraphCenter) || 1
      const isBlankPara = (para) => {
        if (!para || !para.Range) return true
        const t = (para.Range.Text || '').replace(/\r/g, '').trim()
        return t.length === 0
      }
      const inTable = (para) => {
        try {
          return !!(para.Range.Tables && para.Range.Tables.Count > 0)
        } catch (e) {
          return false
        }
      }
      const getPrevPara = (tStart) => {
        try {
          const pos = Math.max(0, tStart - 1)
          const r = doc.Range(pos, pos)
          r.MoveStart(wdParagraph, -1)
          r.MoveEnd(wdParagraph, 1)
          if (r.Paragraphs && r.Paragraphs.Count > 0) {
            return r.Paragraphs.Item(1)
          }
        } catch (e) {}
        return null
      }
      const getNextPara = (tEnd) => {
        try {
          const r = doc.Range(tEnd, tEnd)
          r.MoveEnd(wdParagraph, 1)
          if (r.Paragraphs && r.Paragraphs.Count > 0) {
            return r.Paragraphs.Item(1)
          }
        } catch (e) {}
        return null
      }
      const setAlignment = (r) => {
        if (r && r.ParagraphFormat) {
          r.ParagraphFormat.Alignment = wdAlignParagraphCenter
        }
      }
      const deleteBlankBelow = (captionEnd) => {
        try {
          const below = getNextPara(captionEnd)
          if (below && !inTable(below) && isBlankPara(below)) {
            below.Range.Delete()
          }
        } catch (e) {}
      }

      const insertCaptionAbove = (table, captionText) => {
        try {
          const tStart = table.Range.Start
          const tEnd = table.Range.End
          let targetPara = null
          const prevPara = getPrevPara(tStart)
          const adjacentHasContent = prevPara && !inTable(prevPara) && !isBlankPara(prevPara)
          if (prevPara && !inTable(prevPara) && isBlankPara(prevPara)) {
            targetPara = prevPara
          }
          if (targetPara && targetPara.Range) {
            targetPara.Range.Text = captionText + paraBreak
            setAlignment(targetPara.Range)
            return
          }
          if (!sel || typeof sel.SetRange !== 'function' || typeof sel.InsertAfter !== 'function') {
            console.warn('Selection.SetRange/InsertAfter 不可用，无法在表格上方插入新段')
            return
          }
          const insertPos = Math.max(0, tStart - 1)
          sel.SetRange(insertPos, insertPos)
          const len = captionText.length + 1
          if (adjacentHasContent) {
            sel.InsertAfter(paraBreak + captionText + paraBreak)
            const r = doc.Range(insertPos + 2, insertPos + 2 + len)
            setAlignment(r)
          } else {
            sel.InsertAfter(captionText + paraBreak)
            const r = doc.Range(insertPos + 1, insertPos + 1 + len)
            setAlignment(r)
          }
        } catch (e) {
          console.warn('insertCaptionAbove 失败:', e)
        }
      }

      const insertCaptionBelow = (table, captionText) => {
        try {
          const tStart = table.Range.Start
          const tEnd = table.Range.End
          let targetPara = null
          const nextPara = getNextPara(tEnd)
          const adjacentHasContent = nextPara && !inTable(nextPara) && !isBlankPara(nextPara)
          if (nextPara && !inTable(nextPara) && isBlankPara(nextPara)) {
            targetPara = nextPara
          }
          if (targetPara && targetPara.Range) {
            targetPara.Range.Text = captionText + paraBreak
            setAlignment(targetPara.Range)
            deleteBlankBelow(targetPara.Range.End)
            return
          }
          if (!sel || typeof sel.SetRange !== 'function' || typeof sel.InsertAfter !== 'function') {
            console.warn('Selection.SetRange/InsertAfter 不可用，无法在表格下方插入新段')
            return
          }
          sel.SetRange(tEnd, tEnd)
          const len = captionText.length + 1
          if (adjacentHasContent) {
            sel.InsertAfter(paraBreak + captionText + paraBreak)
            const r = doc.Range(tEnd + 2, tEnd + 2 + len)
            setAlignment(r)
            deleteBlankBelow(r.End)
          } else {
            sel.InsertAfter(captionText + paraBreak)
            const r = doc.Range(tEnd, tEnd + len)
            setAlignment(r)
            deleteBlankBelow(r.End)
          }
        } catch (e) {
          console.warn('insertCaptionBelow 失败:', e)
        }
      }
      let successCount = 0
      try {
        // 缓存表格引用，避免插入段落引起索引变化
        const tableList = []
        for (let i = 1; i <= tables.Count; i++) tableList.push(tables.Item(i))

        for (let idx = 0; idx < tableList.length; idx++) {
          const caption = label + (idx + 1) + suffixText
          const table = tableList[idx]
          try {
            if (isAbove) {
              insertCaptionAbove(table, caption)
            } else {
              insertCaptionBelow(table, caption)
            }
            successCount++
          } catch (e) {
            console.warn('表格' + (idx + 1) + ' 添加题注失败:', e.message || e)
          }
        }
        return { ok: true, successCount, tableCount: tableList.length }
      } catch (e) {
        console.error('applyCaptions:', e)
        return { ok: false, msg: e.message || '操作失败' }
      }
    },
    // 为文档中所有图像在上一行或下一行插入题注（与表格题注共用同一套插入逻辑）
    applyImageCaptions() {
      const app = window.Application
      const doc = app && app.ActiveDocument
      if (!doc) {
        return { ok: false, msg: '当前没有打开任何文档' }
      }
      const wdParagraph = 4
      const paraBreak = '\r'
      const wdAlignParagraphCenter = (app.Enum && app.Enum.wdAlignParagraphCenter) || 1
      const sel = app.Selection || (app.ActiveWindow && app.ActiveWindow.Selection)
      const label = (this.labelText || '图').trim()
      const suffix = (this.captionSuffix || '').trim()
      const suffixText = suffix || ''
      const isAbove = this.position === 'above'

      function isPictureInlineShape(inlineShape) {
        if (!inlineShape || !inlineShape.Range) return false
        try {
          const t = inlineShape.Type
          if (t === 3 || t === 4) return true
          if (inlineShape.PictureFormat) return true
          return true
        } catch (e) {
          return false
        }
      }

      const imageRanges = []
      const inlineShapes = doc.InlineShapes
      if (inlineShapes && inlineShapes.Count > 0) {
        for (let i = 1; i <= inlineShapes.Count; i++) {
          try {
            const s = inlineShapes.Item(i)
            if (s && s.Range && isPictureInlineShape(s)) {
              imageRanges.push({ start: s.Range.Start, end: s.Range.End })
            }
          } catch (e) {
            console.warn('获取内嵌图片位置失败:', e)
          }
        }
      }
      const shapes = doc.Shapes
      if (shapes && shapes.Count > 0) {
        for (let i = 1; i <= shapes.Count; i++) {
          try {
            const shape = shapes.Item(i)
            if (!shape) continue
            const type = shape.Type
            if (type !== 13 && type !== 1) continue
            const anchor = shape.Anchor
            if (anchor) {
              imageRanges.push({ start: anchor.Start, end: anchor.End })
            }
          } catch (e) {
            console.warn('获取浮动图片位置失败:', e)
          }
        }
      }
      imageRanges.sort((a, b) => a.start - b.start)

      if (imageRanges.length === 0) {
        return { ok: false, msg: '文档中没有图片' }
      }

      const isBlankPara = (para) => {
        if (!para || !para.Range) return true
        const t = (para.Range.Text || '').replace(/\r/g, '').trim()
        return t.length === 0
      }
      const inTable = (para) => {
        try {
          return !!(para.Range.Tables && para.Range.Tables.Count > 0)
        } catch (e) {
          return false
        }
      }
      const getPrevPara = (tStart) => {
        try {
          const pos = Math.max(0, tStart - 1)
          const r = doc.Range(pos, pos)
          r.MoveStart(wdParagraph, -1)
          r.MoveEnd(wdParagraph, 1)
          if (r.Paragraphs && r.Paragraphs.Count > 0) {
            return r.Paragraphs.Item(1)
          }
        } catch (e) {}
        return null
      }
      const getNextPara = (tEnd) => {
        try {
          const r = doc.Range(tEnd, tEnd)
          r.MoveEnd(wdParagraph, 1)
          if (r.Paragraphs && r.Paragraphs.Count > 0) {
            return r.Paragraphs.Item(1)
          }
        } catch (e) {}
        return null
      }
      const setAlignment = (r) => {
        if (r && r.ParagraphFormat) {
          r.ParagraphFormat.Alignment = wdAlignParagraphCenter
        }
      }
      const deleteBlankBelow = (captionEnd) => {
        try {
          const below = getNextPara(captionEnd)
          if (below && !inTable(below) && isBlankPara(below)) {
            below.Range.Delete()
          }
        } catch (e) {}
      }

      const insertCaptionAboveRange = (tStart, tEnd, captionText) => {
        try {
          let targetPara = null
          const prevPara = getPrevPara(tStart)
          const adjacentHasContent = prevPara && !inTable(prevPara) && !isBlankPara(prevPara)
          if (prevPara && !inTable(prevPara) && isBlankPara(prevPara)) {
            targetPara = prevPara
          }
          if (targetPara && targetPara.Range) {
            targetPara.Range.Text = captionText + paraBreak
            setAlignment(targetPara.Range)
            return
          }
          if (!sel || typeof sel.SetRange !== 'function' || typeof sel.InsertAfter !== 'function') {
            console.warn('Selection.SetRange/InsertAfter 不可用，无法在图像上方插入新段')
            return
          }
          const insertPos = Math.max(0, tStart - 1)
          sel.SetRange(insertPos, insertPos)
          const len = captionText.length + 1
          if (adjacentHasContent) {
            sel.InsertAfter(paraBreak + captionText + paraBreak)
            const r = doc.Range(insertPos + 2, insertPos + 2 + len)
            setAlignment(r)
          } else {
            sel.InsertAfter(captionText + paraBreak)
            const r = doc.Range(insertPos + 1, insertPos + 1 + len)
            setAlignment(r)
          }
        } catch (e) {
          console.warn('insertCaptionAboveRange 失败:', e)
        }
      }

      const insertCaptionBelowRange = (tStart, tEnd, captionText) => {
        try {
          let targetPara = null
          const nextPara = getNextPara(tEnd)
          const adjacentHasContent = nextPara && !inTable(nextPara) && !isBlankPara(nextPara)
          if (nextPara && !inTable(nextPara) && isBlankPara(nextPara)) {
            targetPara = nextPara
          }
          if (targetPara && targetPara.Range) {
            targetPara.Range.Text = captionText + paraBreak
            setAlignment(targetPara.Range)
            deleteBlankBelow(targetPara.Range.End)
            return
          }
          if (!sel || typeof sel.SetRange !== 'function' || typeof sel.InsertAfter !== 'function') {
            console.warn('Selection.SetRange/InsertAfter 不可用，无法在图像下方插入新段')
            return
          }
          sel.SetRange(tEnd, tEnd)
          const len = captionText.length + 1
          if (adjacentHasContent) {
            sel.InsertAfter(paraBreak + captionText + paraBreak)
            const r = doc.Range(tEnd + 2, tEnd + 2 + len)
            setAlignment(r)
            deleteBlankBelow(r.End)
          } else {
            sel.InsertAfter(captionText + paraBreak)
            const r = doc.Range(tEnd, tEnd + len)
            setAlignment(r)
            deleteBlankBelow(r.End)
          }
        } catch (e) {
          console.warn('insertCaptionBelowRange 失败:', e)
        }
      }

      let successCount = 0
      try {
        for (let idx = 0; idx < imageRanges.length; idx++) {
          const { start: tStart, end: tEnd } = imageRanges[idx]
          const caption = label + (idx + 1) + suffixText
          try {
            if (isAbove) {
              insertCaptionAboveRange(tStart, tEnd, caption)
            } else {
              insertCaptionBelowRange(tStart, tEnd, caption)
            }
            successCount++
          } catch (e) {
            console.warn('图像' + (idx + 1) + ' 添加题注失败:', e.message || e)
          }
        }
        return { ok: true, successCount, imageCount: imageRanges.length }
      } catch (e) {
        console.error('applyImageCaptions:', e)
        return { ok: false, msg: e.message || '操作失败' }
      }
    },
    onConfirm() {
      if (!this.validate()) return
      const res = this.isImageMode ? this.applyImageCaptions() : this.applyCaptions()
      if (res.ok) {
        this.errorMsg = ''
        try {
          if (window.close) window.close()
        } catch (e) {}
      } else {
        this.errorMsg = res.msg || '操作失败'
      }
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
.table-caption-dialog {
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
}

.form-group {
  margin-bottom: 10px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #334155;
}

.radio-row {
  margin-bottom: 8px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 20px;
}

.radio-label {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  font-weight: 400;
}

.radio-label input {
  margin-right: 6px;
}

.input-text {
  display: block;
  width: 100%;
  padding: 6px 10px;
  font-size: 13px;
  line-height: 1.3;
  color: #1e293b;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  box-sizing: border-box;
}

.input-text:focus {
  outline: none;
  border-color: #3b82f6;
}

.input-text::placeholder {
  color: #94a3b8;
}

.hint {
  margin: 4px 0 0 0;
  font-size: 11px;
  color: #64748b;
}

.error {
  margin: 6px 0 0 0;
  font-size: 11px;
  color: #dc2626;
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

.btn-primary {
  color: #fff;
  background: #3b82f6;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  color: #475569;
  background: #f1f5f9;
}

.btn-secondary:hover {
  background: #e2e8f0;
}
</style>
