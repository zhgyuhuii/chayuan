<template>
  <div class="model-select-wrap" :class="{ compact }">
    <button type="button" class="model-select-btn" @click="open = !open" @blur="onBlur">
      <img v-if="selectedIcon" :src="selectedIcon" class="model-select-icon" alt="" width="16" height="16" />
      <span class="model-select-name">{{ selectedName || '选择模型' }}</span>
      <span class="model-select-arrow">▾</span>
    </button>
    <div v-if="open" class="model-dropdown">
      <div v-for="group in groups" :key="group.providerId" class="model-group">
        <div class="model-group-label" @mousedown.prevent="toggleGroup(group.providerId)">
          <img v-if="group.icon" :src="group.icon" class="model-group-icon" alt="" width="14" height="14" />
          <span>{{ group.label }}</span>
        </div>
        <template v-if="!collapsed[group.providerId]">
          <button
            v-for="m in group.models"
            :key="m.id"
            type="button"
            class="model-option"
            :class="{ active: m.id === modelId }"
            @mousedown.prevent="select(m)"
          >{{ m.name }}</button>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
import { getModelGroupsFromSettings } from '../../utils/modelSettings.js'
import { MODEL_TYPE_CHAT } from '../../utils/modelTypeUtils.js'

export default {
  name: 'ModelSelector',
  props: {
    modelId: { type: String, default: '' },
    compact: { type: Boolean, default: false }
  },
  emits: ['update:modelId', 'change'],
  data() {
    return { open: false, collapsed: {}, version: 0 }
  },
  computed: {
    groups() {
      void this.version
      return getModelGroupsFromSettings(MODEL_TYPE_CHAT) || []
    },
    flat() {
      return this.groups.flatMap(g => g.models || [])
    },
    selected() {
      return this.flat.find(m => m.id === this.modelId) || null
    },
    selectedName() {
      return this.selected?.name || ''
    },
    selectedIcon() {
      return this.selected?.icon || ''
    }
  },
  methods: {
    refresh() { this.version += 1 },
    toggleGroup(pid) { this.collapsed = { ...this.collapsed, [pid]: !this.collapsed[pid] } },
    onBlur() { setTimeout(() => { this.open = false }, 150) },
    select(m) {
      this.open = false
      if (!m || m.id === this.modelId) return
      this.$emit('update:modelId', m.id)
      this.$emit('change', m.id)
    }
  }
}
</script>

<style scoped>
.model-select-wrap { position: relative; display: inline-block; }
.model-select-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border: 1px solid var(--color-border, #e2e4e9);
  border-radius: 8px; background: var(--color-surface, #fff);
  color: var(--color-text-primary, #2b2f38); cursor: pointer; font-size: 13px;
}
.model-select-wrap.compact .model-select-btn { padding: 2px 8px; font-size: 12px; }
.model-select-arrow { color: var(--color-text-muted, #8a8f99); font-size: 10px; }
.model-dropdown {
  position: absolute; top: 100%; right: 0; margin-top: 4px; z-index: 50;
  min-width: 220px; max-height: 320px; overflow: auto;
  background: var(--color-surface, #fff); border: 1px solid var(--color-border, #e2e4e9);
  border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); padding: 6px;
}
.model-group-label {
  display: flex; align-items: center; gap: 6px; padding: 6px 8px;
  font-size: 12px; color: var(--color-text-secondary, #5a5f6b); cursor: pointer; user-select: none;
}
.model-option {
  display: block; width: 100%; text-align: left; padding: 6px 12px;
  border: none; background: transparent; border-radius: 6px; cursor: pointer;
  font-size: 13px; color: var(--color-text-primary, #2b2f38);
}
.model-option:hover { background: rgba(124,108,220,0.08); }
.model-option.active { background: rgba(124,108,220,0.14); color: var(--chy-violet-700, #5d4ec0); }
</style>
