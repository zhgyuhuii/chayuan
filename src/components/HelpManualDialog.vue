<!--
  HelpManualDialog.vue
  用户手册弹窗：左侧章节目录 + 右侧 Markdown 正文；顶部常驻 MCP 地址。
-->
<template>
  <div
    v-if="visible"
    class="help-manual-overlay"
    @click.self="onClose"
  >
    <div class="help-manual-modal" role="dialog" aria-modal="true" aria-labelledby="help-manual-title">
      <div class="help-manual-header">
        <div class="help-manual-header-main">
          <h4 id="help-manual-title">帮助 · 用户手册</h4>
          <p class="help-manual-subtitle">察元 AI 文档助手 · v{{ appVersion }}</p>
        </div>
        <button type="button" class="btn-close-modal" aria-label="关闭" @click="onClose">×</button>
      </div>

      <div class="help-manual-mcp" role="note">
        <span class="help-manual-mcp-label">MCP 服务地址</span>
        <code class="help-manual-mcp-url" :title="mcpUrl">{{ mcpUrl }}</code>
        <button type="button" class="help-manual-mcp-btn" @click="copyMcpUrl">
          {{ copyHint || '复制' }}
        </button>
        <button type="button" class="help-manual-mcp-btn help-manual-mcp-btn--ghost" @click="goMcpSettings">
          MCP 管理
        </button>
      </div>

      <div class="help-manual-body">
        <nav class="help-manual-toc" aria-label="章节目录">
          <button
            v-for="item in toc"
            :key="item.id"
            type="button"
            class="help-manual-toc-item"
            :class="{ active: item.id === activeId }"
            @click="scrollToSection(item.id)"
          >
            {{ item.title }}
          </button>
        </nav>
        <div class="help-manual-content" ref="contentRef" @scroll="onContentScroll">
          <article class="help-manual-article" v-html="renderedHtml"></article>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import pkg from '../../package.json'
import userManualMarkdown from '@/assets/manuals/user-manual.zh-CN.md?raw'
import { renderManualMarkdown, extractManualToc } from '../utils/manualMarkdown.js'

const DEFAULT_MCP_URL = 'http://127.0.0.1:62588/mcp'

export default {
  name: 'HelpManualDialog',
  props: {
    visible: { type: Boolean, default: false },
    mcpUrl: { type: String, default: DEFAULT_MCP_URL }
  },
  emits: ['close', 'open-mcp-settings'],
  data() {
    return {
      appVersion: String(pkg?.version || '4.0.0'),
      toc: [],
      renderedHtml: '',
      activeId: '',
      copyHint: '',
      _copyTimer: null
    }
  },
  watch: {
    visible(val) {
      if (val) {
        this.prepareManual()
        this.$nextTick(() => {
          const el = this.$refs.contentRef
          if (el) el.scrollTop = 0
          this.activeId = this.toc[0]?.id || ''
        })
      }
    }
  },
  mounted() {
    if (this.visible) this.prepareManual()
  },
  beforeUnmount() {
    if (this._copyTimer) clearTimeout(this._copyTimer)
  },
  methods: {
    prepareManual() {
      const md = String(userManualMarkdown || '')
      this.toc = extractManualToc(md)
      this.renderedHtml = renderManualMarkdown(md)
      this.activeId = this.toc[0]?.id || ''
    },
    onClose() {
      this.$emit('close')
    },
    goMcpSettings() {
      this.$emit('open-mcp-settings')
    },
    scrollToSection(id) {
      this.activeId = id
      const root = this.$refs.contentRef
      if (!root) return
      const safeId = this.escapeSelector(id)
      const target = root.querySelector(`#${safeId}`)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    },
    onContentScroll() {
      const root = this.$refs.contentRef
      if (!root || !this.toc.length) return
      const top = root.scrollTop + 24
      let current = this.toc[0].id
      for (const item of this.toc) {
        const el = root.querySelector(`#${this.escapeSelector(item.id)}`)
        if (el && el.offsetTop <= top) current = item.id
      }
      this.activeId = current
    },
    escapeSelector(value) {
      const text = String(value || '')
      if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(text)
      }
      return text.replace(/([^a-zA-Z0-9_-])/g, '\\$1')
    },
    async copyMcpUrl() {
      const url = String(this.mcpUrl || DEFAULT_MCP_URL).trim()
      let ok = false
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(url)
          ok = true
        }
      } catch (_) { /* fall through */ }
      if (!ok) {
        try {
          const ta = document.createElement('textarea')
          ta.value = url
          ta.setAttribute('readonly', '')
          ta.style.position = 'fixed'
          ta.style.left = '-9999px'
          document.body.appendChild(ta)
          ta.select()
          ok = document.execCommand('copy')
          document.body.removeChild(ta)
        } catch (_) {
          ok = false
        }
      }
      this.copyHint = ok ? '已复制' : '复制失败'
      if (this._copyTimer) clearTimeout(this._copyTimer)
      this._copyTimer = setTimeout(() => {
        this.copyHint = ''
      }, 1600)
    }
  }
}
</script>

<style scoped>
.help-manual-overlay {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.45);
}

.help-manual-modal {
  display: flex;
  flex-direction: column;
  width: min(920px, calc(100vw - 24px));
  height: min(860px, calc(100vh - 32px));
  overflow: hidden;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.28);
}

.help-manual-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.22);
}

.help-manual-header-main h4 {
  margin: 0;
  color: #0f172a;
  font-size: 16px;
  font-weight: 700;
}

.help-manual-subtitle {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
}

.btn-close-modal {
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.help-manual-mcp {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(37, 99, 235, 0.12);
  background: rgba(239, 246, 255, 0.85);
}

.help-manual-mcp-label {
  flex: 0 0 auto;
  color: #1e3a8a;
  font-size: 12px;
  font-weight: 650;
}

.help-manual-mcp-url {
  flex: 1 1 180px;
  min-width: 0;
  padding: 5px 8px;
  border-radius: 7px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(255, 255, 255, 0.95);
  color: #0f172a;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.help-manual-mcp-btn {
  flex: 0 0 auto;
  height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(14, 165, 233, 0.35);
  border-radius: 7px;
  background: #0ea5e9;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.help-manual-mcp-btn--ghost {
  background: #fff;
  color: #0369a1;
}

.help-manual-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.help-manual-toc {
  flex: 0 0 200px;
  overflow-y: auto;
  padding: 10px 8px;
  border-right: 1px solid rgba(148, 163, 184, 0.2);
  background: #f8fafc;
}

.help-manual-toc-item {
  display: block;
  width: 100%;
  margin: 0 0 4px;
  padding: 7px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #334155;
  font-size: 12px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}

.help-manual-toc-item:hover {
  background: rgba(14, 165, 233, 0.08);
}

.help-manual-toc-item.active {
  background: rgba(14, 165, 233, 0.14);
  color: #0369a1;
  font-weight: 650;
}

.help-manual-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 14px 18px 28px;
}

.help-manual-article {
  color: #1e293b;
  font-size: 13px;
  line-height: 1.7;
}

.help-manual-article :deep(h1) {
  margin: 0 0 12px;
  font-size: 20px;
  line-height: 1.35;
}

.help-manual-article :deep(h2) {
  margin: 22px 0 10px;
  padding-top: 4px;
  border-top: 1px solid rgba(148, 163, 184, 0.25);
  font-size: 16px;
  scroll-margin-top: 8px;
}

.help-manual-article :deep(h2:first-of-type) {
  border-top: none;
  margin-top: 8px;
}

.help-manual-article :deep(h3) {
  margin: 14px 0 8px;
  font-size: 14px;
}

.help-manual-article :deep(p),
.help-manual-article :deep(ul),
.help-manual-article :deep(ol) {
  margin: 0 0 10px;
}

.help-manual-article :deep(ul),
.help-manual-article :deep(ol) {
  padding-left: 1.25em;
}

.help-manual-article :deep(li + li) {
  margin-top: 4px;
}

.help-manual-article :deep(blockquote) {
  margin: 0 0 12px;
  padding: 8px 12px;
  border-left: 3px solid #38bdf8;
  background: #f0f9ff;
  color: #0c4a6e;
}

.help-manual-article :deep(pre) {
  margin: 0 0 12px;
  padding: 10px 12px;
  overflow-x: auto;
  border-radius: 8px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 12px;
  line-height: 1.55;
}

.help-manual-article :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.92em;
}

.help-manual-article :deep(:not(pre) > code) {
  padding: 1px 5px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #0f172a;
}

.help-manual-article :deep(table) {
  width: 100%;
  margin: 0 0 12px;
  border-collapse: collapse;
  font-size: 12px;
}

.help-manual-article :deep(th),
.help-manual-article :deep(td) {
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  text-align: left;
  vertical-align: top;
}

.help-manual-article :deep(th) {
  background: #f8fafc;
  font-weight: 650;
}

.help-manual-article :deep(a) {
  color: #0284c7;
  text-decoration: none;
}

.help-manual-article :deep(a:hover) {
  text-decoration: underline;
}

.help-manual-article :deep(hr) {
  margin: 16px 0;
  border: none;
  border-top: 1px solid #e2e8f0;
}

@media (max-width: 720px) {
  .help-manual-body {
    flex-direction: column;
  }

  .help-manual-toc {
    flex: 0 0 auto;
    max-height: 120px;
    border-right: none;
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  }
}
</style>
