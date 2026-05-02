<template>
  <div v-if="hasSources" class="kb-source-strip" :class="{ collapsed: localCollapsed }">
    <div class="kb-strip-bar" @click="toggle">
      <button
        type="button"
        class="kb-strip-collapse"
        :title="localCollapsed ? '展开知识来源' : '折叠知识来源'"
        :aria-expanded="!localCollapsed"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" :class="{ rotated: !localCollapsed }">
          <path fill="currentColor" d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
        </svg>
      </button>
      <span class="kb-strip-line"></span>
      <span class="kb-strip-label">
        <span class="kb-strip-icon">📚</span>
        知识来源 · {{ sources.length }} 条
        <template v-if="kbBindings?.kbNames?.length">
          · {{ kbBindings.kbNames.join('、') }}
        </template>
      </span>
      <span v-if="kbError" class="kb-strip-warn" :title="kbError">⚠ 检索异常</span>
    </div>

    <div v-if="!localCollapsed" class="kb-strip-body">
      <ul class="kb-source-list">
        <li
          v-for="(s, idx) in sources"
          :key="`${s.kb_name}-${s.file_name}-${idx}`"
          class="kb-source-card"
          :data-citation-id="`c${idx + 1}`"
          @mouseenter="onHover(`c${idx + 1}`)"
          @mouseleave="onHover('')"
          :class="{ highlighted: hoveredCitationId === `c${idx + 1}` }"
        >
          <div class="kb-source-head">
            <span class="kb-source-cite">[c{{ idx + 1 }}]</span>
            <span class="kb-source-stars" :title="`信任度: ${trustValue(s)}`">
              <span v-for="n in 5" :key="n" :class="['kb-star', n <= starsOf(s) ? 'on' : 'off']">★</span>
            </span>
            <span class="kb-source-kb" :title="s.kb_name">{{ s.kb_name }}</span>
            <a
              v-if="downloadUrl(s)"
              class="kb-source-dl"
              :href="downloadUrl(s)"
              target="_blank"
              rel="noopener noreferrer"
              :title="`下载附件: ${s.file_name}`"
              @click.prevent="onDownload(s, $event)"
            >📎 {{ shortFileName(s.file_name) }}</a>
            <span v-else class="kb-source-noattachment">{{ shortFileName(s.file_name) }}</span>
          </div>
          <div class="kb-source-snippet">{{ snippet(s) }}</div>
          <div v-if="s.metadata?.section_title || s.from_section_ids?.length" class="kb-source-meta">
            <template v-if="s.metadata?.section_title">
              §{{ s.metadata.section_title }}
            </template>
            <template v-if="s.from_query_tags?.length">
              · 命中查询: {{ s.from_query_tags.join(', ') }}
            </template>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import services from '../services/index.js'

const { attachmentClient, credibilityScorer } = services.kb

export default {
  name: 'KbSourceStrip',
  props: {
    sources: { type: Array, default: () => [] },
    kbBindings: { type: Object, default: () => ({ kbNames: [] }) },
    connection: { type: Object, default: null },
    kbError: { type: String, default: '' },
    initialCollapsed: { type: Boolean, default: false },
    hoveredCitationId: { type: String, default: '' },
    queryText: { type: String, default: '' },
  },
  data() {
    return {
      localCollapsed: this.initialCollapsed,
      _scoredCache: null,
    }
  },
  computed: {
    hasSources() {
      return Array.isArray(this.sources) && this.sources.length > 0
    },
    scoredSources() {
      if (this._scoredCache) return this._scoredCache
      try {
        const out = credibilityScorer.score(this.sources, { queryText: this.queryText })
        this._scoredCache = out
        return out
      } catch (e) { return this.sources }
    },
  },
  watch: {
    sources() { this._scoredCache = null },
    queryText() { this._scoredCache = null },
    initialCollapsed(v) { this.localCollapsed = v },
  },
  methods: {
    toggle() {
      this.localCollapsed = !this.localCollapsed
      this.$emit('toggle', this.localCollapsed)
    },
    starsOf(s) {
      const idx = this.sources.indexOf(s)
      const enriched = this.scoredSources?.[idx]
      return Number(enriched?.stars || s?.stars || 3)
    },
    trustValue(s) {
      const idx = this.sources.indexOf(s)
      const enriched = this.scoredSources?.[idx]
      return (enriched?.trust ?? s?.trust ?? 0).toFixed(2)
    },
    snippet(s) {
      const t = String(s?.page_content || s?.text || '').replace(/\s+/g, ' ').trim()
      return t.length > 280 ? `${t.slice(0, 280)}…` : t
    },
    shortFileName(name) {
      const n = String(name || '')
      if (n.length <= 36) return n
      const m = n.match(/^(.+?)(\.[A-Za-z0-9]{1,6})$/)
      if (m) return `${m[1].slice(0, 28)}…${m[2]}`
      return `${n.slice(0, 28)}…${n.slice(-6)}`
    },
    downloadUrl(s) {
      if (!this.connection || !s?.file_name) return ''
      try {
        return attachmentClient.buildDownloadUrl(this.connection, s, { preview: false })
      } catch (e) { return '' }
    },
    async onDownload(s, ev) {
      const url = this.downloadUrl(s)
      if (!url) return
      try {
        const resp = await fetch(url, { method: 'GET', mode: 'cors' })
        if (!resp.ok) {
          const body = await resp.text()
          const msg = attachmentClient.humanizeDownloadError(resp.status, body)
          this.$emit('download-error', { source: s, status: resp.status, message: msg })
          return
        }
        const blob = await resp.blob()
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = s.file_name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(a.href), 5000)
        this.$emit('download-ok', { source: s })
      } catch (e) {
        this.$emit('download-error', { source: s, status: 0, message: e?.message || String(e) })
      }
    },
    onHover(citationId) {
      this.$emit('hover-citation', citationId || '')
    },
  },
}
</script>

<style scoped>
.kb-source-strip {
  margin: 12px 0 8px;
  border-top: 1px dashed #d6dae0;
  padding-top: 6px;
  font-size: 12px;
}

.kb-strip-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  padding: 2px 0;
  color: #555;
}
.kb-strip-bar:hover { color: #2a6ddf; }
.kb-strip-collapse {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  color: inherit;
  display: inline-flex;
  align-items: center;
}
.kb-strip-collapse svg { transition: transform 0.15s ease; }
.kb-strip-collapse svg.rotated { transform: rotate(90deg); }
.kb-strip-line {
  flex: 1;
  border-top: 1px solid #e6e8ec;
  margin: 0 4px;
  height: 1px;
}
.kb-strip-label {
  font-size: 11px;
  font-weight: 500;
}
.kb-strip-icon { margin-right: 2px; }
.kb-strip-warn {
  margin-left: 6px;
  color: #d97706;
  font-size: 11px;
}

.kb-strip-body {
  margin-top: 8px;
  padding: 0 4px;
}

.kb-source-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kb-source-card {
  border: 1px solid #e6e8ec;
  border-radius: 6px;
  padding: 8px 10px;
  background: #fafbfc;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.kb-source-card.highlighted {
  border-color: #2a6ddf;
  background: #f0f6ff;
  box-shadow: 0 0 0 2px rgba(42,109,223,0.15);
}

.kb-source-head {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.kb-source-cite {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
  font-size: 11px;
  font-weight: 600;
  color: #2a6ddf;
  background: #e7eefb;
  padding: 1px 6px;
  border-radius: 4px;
}
.kb-source-stars {
  display: inline-flex;
  font-size: 11px;
  letter-spacing: 1px;
}
.kb-star.on  { color: #f5a623; }
.kb-star.off { color: #ddd; }
.kb-source-kb {
  font-size: 11px;
  color: #555;
  background: #eef0f3;
  padding: 1px 6px;
  border-radius: 4px;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-source-dl {
  margin-left: auto;
  font-size: 11px;
  color: #2a6ddf;
  text-decoration: none;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-source-dl:hover { text-decoration: underline; }
.kb-source-noattachment {
  margin-left: auto;
  font-size: 11px;
  color: #999;
}

.kb-source-snippet {
  font-size: 12px;
  line-height: 1.5;
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
}

.kb-source-meta {
  margin-top: 4px;
  font-size: 11px;
  color: #888;
}
</style>
