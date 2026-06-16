<template>
  <div class="tool-panel" v-if="toolDef">
    <div class="tool-panel__header">
      <span class="tool-panel__title">{{ toolDef.label }}</span>
      <button type="button" class="tool-panel__back" @click="$emit('close')">返回对话</button>
    </div>

    <div class="tool-panel__form">
      <template v-for="field in visibleFields" :key="field.key">
        <label class="tool-field">
          <span class="tool-field__label">{{ field.label }}</span>

          <input v-if="field.type === 'text'" type="text" v-model="params[field.key]" />

          <input v-else-if="field.type === 'number'" type="number"
                 :min="field.min" :max="field.max"
                 v-model.number="params[field.key]" />

          <textarea v-else-if="field.type === 'textarea'" rows="6" v-model="params[field.key]"></textarea>

          <select v-else-if="field.type === 'select'" v-model="params[field.key]">
            <option v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>

          <span v-else-if="field.type === 'radio'" class="tool-field__radios">
            <label v-for="opt in field.options" :key="opt.value" class="tool-radio">
              <input type="radio" :value="opt.value" v-model="params[field.key]" />{{ opt.label }}
            </label>
          </span>

          <input v-else-if="field.type === 'checkbox'" type="checkbox" v-model="params[field.key]" />
        </label>
      </template>
    </div>

    <div class="tool-panel__actions">
      <button :disabled="busy" @click="onPreview">生成预览</button>
      <button :disabled="busy || validCount === 0" @click="onInsert">插入到文档</button>
    </div>

    <div v-if="invalidCount > 0" class="tool-panel__warn">
      {{ invalidCount }} 个编号非法，将跳过：{{ invalidSummary }}
    </div>

    <div class="tool-panel__preview" v-if="previewItems.length">
      <div class="tool-preview-grid" :style="gridStyle">
        <div v-for="(it, idx) in previewItems" :key="idx"
             class="tool-preview-cell" :class="{ 'is-invalid': !it.ok }">
          <img v-if="it.ok" :src="it.dataUrl" alt="" />
          <span v-else class="tool-preview-cell__err">{{ it.value }}：{{ it.error }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getToolDefinition, buildDefaultParams, isFieldVisible } from '../utils/tools/toolDefinitions.js'

export default {
  name: 'ToolAssistantPanel',
  props: {
    toolId: { type: String, required: true }
  },
  data() {
    const toolDef = getToolDefinition(this.toolId)
    return {
      toolDef,
      params: toolDef ? buildDefaultParams(toolDef) : {},
      previewItems: [],
      invalidCount: 0,
      busy: false
    }
  },
  computed: {
    visibleFields() {
      if (!this.toolDef) return []
      return this.toolDef.formSchema.filter((f) => isFieldVisible(f, this.params))
    },
    validCount() {
      return this.previewItems.filter((it) => it.ok).length
    },
    invalidSummary() {
      return this.previewItems.filter((it) => !it.ok).map((it) => it.value).slice(0, 5).join('、')
    },
    gridStyle() {
      const cols = Math.max(1, Number(this.params.columns) || 1)
      return { gridTemplateColumns: `repeat(${cols}, 1fr)` }
    }
  },
  watch: {
    toolId(newId) {
      this.toolDef = getToolDefinition(newId)
      this.params = this.toolDef ? buildDefaultParams(this.toolDef) : {}
      this.previewItems = []
      this.invalidCount = 0
    },
    params: {
      deep: true,
      handler() {
        this.previewItems = []
        this.invalidCount = 0
      }
    }
  },
  methods: {
    async onPreview() {
      if (!this.toolDef || this.busy) return
      this.busy = true
      try {
        const result = await this.toolDef.generate(this.params)
        this.previewItems = result.items || []
        this.invalidCount = result.invalidCount || 0
      } catch (e) {
        this.$emit('error', e?.message || '生成失败')
      } finally {
        this.busy = false
      }
    },
    async onInsert() {
      if (!this.toolDef || this.busy) return
      this.busy = true
      try {
        const result = { items: this.previewItems, invalidCount: this.invalidCount }
        const written = await this.toolDef.writeBack(result, this.params)
        this.$emit('inserted', written)
      } catch (e) {
        this.$emit('error', e?.message || '插入失败')
      } finally {
        this.busy = false
      }
    }
  }
}
</script>

<style scoped>
.tool-panel { display: flex; flex-direction: column; gap: 12px; padding: 12px; overflow: auto; }
.tool-panel__header { display: flex; align-items: center; justify-content: space-between; }
.tool-panel__title { font-weight: 600; font-size: 15px; }
.tool-panel__back {
  border: 1px solid #d9d9d9; background: #fff; color: #555;
  border-radius: 4px; padding: 4px 10px; font-size: 12px; cursor: pointer;
}
.tool-panel__back:hover { border-color: #1677ff; color: #1677ff; }
.tool-panel__form { display: flex; flex-direction: column; gap: 8px; }
.tool-field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.tool-field__label { color: #555; }
.tool-field input[type="text"], .tool-field input[type="number"], .tool-field select, .tool-field textarea {
  border: 1px solid #d9d9d9; border-radius: 4px; padding: 6px 8px; font-size: 13px;
}
.tool-field__radios { display: flex; gap: 16px; }
.tool-radio { display: inline-flex; align-items: center; gap: 4px; }
.tool-panel__actions { display: flex; gap: 8px; }
.tool-panel__actions button {
  flex: 1; padding: 8px 12px; border-radius: 4px; border: 1px solid #1677ff;
  background: #1677ff; color: #fff; cursor: pointer;
}
.tool-panel__actions button:disabled { opacity: .5; cursor: not-allowed; }
.tool-panel__warn { color: #d4380d; font-size: 12px; }
.tool-preview-grid { display: grid; gap: 8px; }
.tool-preview-cell {
  border: 1px solid #eee; border-radius: 4px; padding: 6px; text-align: center; background: #fff;
}
.tool-preview-cell img { max-width: 100%; }
.tool-preview-cell.is-invalid { border-color: #ffccc7; background: #fff2f0; }
.tool-preview-cell__err { color: #d4380d; font-size: 12px; }
</style>
