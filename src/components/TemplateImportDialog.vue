<template>
  <div class="template-import-dialog">
    <div class="dialog-header">
      <h3>规则导入</h3>
      <button class="btn-close" @click="onClose">×</button>
    </div>
    <div class="dialog-body">
      <p class="import-desc">选择 .aidooo 格式的规则文件，将导入其中的规则项。ID 与现有规则重复的项将被跳过。</p>
      <div class="import-buttons">
        <input
          ref="fileInputRef"
          type="file"
          accept=".aidooo,application/json"
          style="display:none"
          @change="onFileInputChange"
        />
        <button class="btn btn-primary" :disabled="importing" @click="triggerFileInput">
          {{ importing ? '导入中...' : '从本机选择文件' }}
        </button>
      </div>
      <div v-if="result" class="import-result" :class="result.hasFail ? 'has-fail' : 'all-ok'">
        <p class="result-title">导入完成</p>
        <p class="result-stat success">成功：{{ result.success }} 项</p>
        <p class="result-stat fail">失败（ID重复跳过）：{{ result.failed }} 项</p>
      </div>
    </div>
    <div class="dialog-footer">
      <button class="btn btn-secondary" @click="onClose">关闭</button>
    </div>
  </div>
</template>

<script>
import { loadRulesFromDoc, saveRulesToDoc, RULES_SYNC_KEY } from '../utils/templateRules.js'

function rawToString(raw) {
  if (typeof raw === 'string') return raw
  if (raw instanceof ArrayBuffer) {
    return new TextDecoder('utf-8').decode(raw)
  }
  if (raw instanceof Uint8Array) {
    return new TextDecoder('utf-8').decode(raw)
  }
  return String(raw)
}

function parseAidoooFile(raw) {
  const str = rawToString(raw)
  if (!str) throw new Error('无效的 aidooo 格式')
  let s = str.trim()
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)
  let data
  try {
    data = JSON.parse(s)
  } catch (e) {
    throw new Error('无效的 aidooo 格式')
  }
  if (!data) throw new Error('无效的 aidooo 格式')
  if (Array.isArray(data)) return data
  if (data.rules && Array.isArray(data.rules)) return data.rules
  throw new Error('无效的 aidooo 格式')
}

export default {
  name: 'TemplateImportDialog',
  data() {
    return {
      importing: false,
      result: null
    }
  },
  methods: {
    triggerFileInput() {
      this.$refs.fileInputRef?.click()
    },
    onFileInputChange(e) {
      const file = e.target?.files?.[0]
      if (!file) return
      this.doImportWithFile(file)
      e.target.value = ''
    },
    doImportWithFile(file) {
      if (this.importing) return
      this.importing = true
      this.result = null
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const raw = reader.result
          this.doImportWithRaw(raw)
        } catch (err) {
          alert('导入失败：' + (err?.message || '未知错误'))
        } finally {
          this.importing = false
        }
      }
      reader.onerror = () => {
        alert('读取文件失败')
        this.importing = false
      }
      reader.readAsText(file, 'UTF-8')
    },
    doImportWithRaw(raw) {
      let fileRules
      try {
        fileRules = parseAidoooFile(raw)
      } catch (e) {
        alert('文件格式无效，请选择正确的 .aidooo 规则文件')
        return
      }
      const existingRules = loadRulesFromDoc()
      const existingIds = new Set(existingRules.map(r => r.id))
      const toImport = []
      let failed = 0
      for (const rule of fileRules) {
        const id = rule?.id
        if (!id) {
          failed++
          continue
        }
        if (existingIds.has(id)) {
          failed++
          continue
        }
        toImport.push(rule)
        existingIds.add(id)
      }
      const merged = [...existingRules, ...toImport]
      saveRulesToDoc(merged)
      try {
        localStorage.setItem(RULES_SYNC_KEY, Date.now().toString())
      } catch (e) {}
      this.result = {
        success: toImport.length,
        failed,
        hasFail: failed > 0
      }
    },
    onClose() {
      try {
        if (window.close) window.close()
      } catch (e) {}
    }
  }
}
</script>

<style scoped>
.template-import-dialog {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', sans-serif;
  font-size: 13px;
  background: #fff;
}

.dialog-header {
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.dialog-header h3 {
  margin: 0;
  font-size: 15px;
}

.btn-close {
  font-size: 20px;
  line-height: 1;
  background: none;
  border: none;
  cursor: pointer;
  color: #999;
}

.btn-close:hover {
  color: #333;
}

.dialog-body {
  padding: 16px 12px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.import-desc {
  margin: 0;
  color: #666;
  line-height: 1.6;
}

.import-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.import-result {
  margin-top: 8px;
  padding: 12px;
  border-radius: 4px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
}

.import-result.has-fail {
  background: #fffbe6;
  border-color: #ffe58f;
}

.result-title {
  margin: 0 0 8px 0;
  font-weight: 600;
  font-size: 14px;
}

.result-stat {
  margin: 4px 0;
  font-size: 13px;
}

.result-stat.success {
  color: #52c41a;
}

.result-stat.fail {
  color: #fa8c16;
}

.dialog-footer {
  padding: 8px 12px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid #d9d9d9;
  background: #fff;
}

.btn:hover:not(:disabled) {
  border-color: #1890ff;
  color: #1890ff;
}

.btn-primary {
  background: #1890ff;
  border-color: #1890ff;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #40a9ff;
  border-color: #40a9ff;
  color: #fff;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
