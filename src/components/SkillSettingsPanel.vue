<template>
  <div class="skill-settings-panel">
    <div class="skill-title-row">
      <div class="column-title">技能设置</div>
      <button
        type="button"
        class="skill-help-btn"
        title="技能使用帮助"
        aria-label="技能使用帮助"
        @click="helpOpen = true"
      >?</button>
    </div>
    <p class="skill-lead">
      技能是随版本内置的「专家工作流」：在对话发送前勾选附加，AI 会按该技能的角色与方法完成任务
      （收割自上游 GenOffice 推荐技能库，v{{ libraryVersion }}）。停用的技能不会出现在对话的技能附加列表中。
    </p>

    <!-- 段落切换：推荐技能 / 我的技能 -->
    <div class="skill-head">
      <div class="skill-section-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          class="skill-seg"
          :class="{ active: section === 'recommended' }"
          @click="section = 'recommended'"
        >推荐技能（{{ builtinSkills.length }}）</button>
        <button
          type="button"
          role="tab"
          class="skill-seg"
          :class="{ active: section === 'mine' }"
          @click="section = 'mine'"
        >我的技能（{{ customSkills.length }}）</button>
      </div>
      <input
        v-model.trim="search"
        class="skill-search"
        type="search"
        placeholder="搜索技能名称 / 描述 / 分类…"
      >
    </div>

    <!-- 分类 tab（仅推荐技能段） -->
    <div v-if="section === 'recommended'" class="skill-category-tabs" role="tablist">
      <button
        type="button"
        class="skill-cat"
        :class="{ active: activeCategory === 'all' }"
        @click="activeCategory = 'all'"
      >全部</button>
      <button
        v-for="[key, label] in categories"
        :key="key"
        type="button"
        class="skill-cat"
        :class="{ active: activeCategory === key }"
        @click="activeCategory = key"
      >{{ label }}</button>
    </div>

    <!-- ============ 推荐技能卡片列表 ============ -->
    <div v-if="section === 'recommended'" class="skill-cards">
      <div v-if="!filteredBuiltin.length" class="skill-empty">没有匹配「{{ search }}」的技能。</div>
      <div
        v-for="s in filteredBuiltin"
        :key="s.name"
        class="skill-card"
        :class="{ disabled: !s.enabled }"
        @click="viewing = s"
      >
        <div class="skill-card-main">
          <div class="skill-card-title">
            <span class="skill-name">{{ s.name }}</span>
            <span class="skill-badge">{{ categoryLabel(s.category) }}</span>
            <span v-if="s.version" class="skill-version">v{{ s.version }}</span>
          </div>
          <div class="skill-desc" :title="s.description">{{ s.description }}</div>
        </div>
        <label class="skill-toggle" @click.stop>
          <input
            type="checkbox"
            :checked="s.enabled"
            @change="onToggleBuiltin(s, $event)"
          >
          <span>{{ s.enabled ? '已启用' : '已停用' }}</span>
        </label>
      </div>
    </div>

    <!-- ============ 我的技能 ============ -->
    <template v-else>
      <div class="skill-import-row">
        <button class="skill-btn" :disabled="importing" @click="pickImport">
          {{ importing ? '导入中…' : '导入 SKILL.md' }}
        </button>
        <button class="skill-btn" :disabled="importing" @click="pickImportZip">
          导入 ZIP
        </button>
        <button class="skill-btn" :disabled="importing" @click="pickImportDir">
          导入文件夹
        </button>
        <span class="skill-import-hint">
          支持 SKILL.md 单文件、整包 zip 或文件夹（SKILL.md 需在包根或恰一个顶层文件夹下，
          需含 name 与 description frontmatter，整包 ≤2MB）。导入后与内置技能使用方式一致。
        </span>
        <input
          ref="importInput"
          type="file"
          accept=".md,.markdown,text/markdown"
          style="display: none"
          @change="onImportFile"
        >
        <input
          ref="importZipInput"
          type="file"
          accept=".zip,application/zip"
          style="display: none"
          @change="onImportZip"
        >
        <input
          ref="importDirInput"
          type="file"
          webkitdirectory
          multiple
          style="display: none"
          @change="onImportDir"
        >
      </div>
      <div v-if="notice" class="skill-notice" :class="notice.kind">
        {{ notice.text }}
      </div>
      <div class="skill-cards">
        <div v-if="!filteredCustom.length" class="skill-empty">还没有导入技能。</div>
        <div
          v-for="s in filteredCustom"
          :key="s.name"
          class="skill-card"
          @click="viewing = s"
        >
          <div class="skill-card-main">
            <div class="skill-card-title">
              <span class="skill-name">{{ s.name }}</span>
              <span class="skill-badge">{{ categoryLabel(s.category) }}</span>
              <span v-if="s.entries?.length > 1" class="skill-badge">{{ s.entries.length }} 个文件</span>
            </div>
            <div class="skill-desc" :title="s.description">{{ s.description || '（无描述）' }}</div>
          </div>
          <button class="skill-btn skill-btn-danger" @click.stop="onRemoveCustom(s)">删除</button>
        </div>
      </div>
    </template>

    <!-- ============ 正文预览浮层 ============ -->
    <div v-if="viewing" class="skill-viewer-mask" @click.self="viewing = null">
      <div class="skill-viewer">
        <div class="skill-viewer-head">
          <div>
            <span class="skill-name">{{ viewing.name }}</span>
            <span class="skill-badge">{{ categoryLabel(viewing.category) }}</span>
          </div>
          <button class="skill-btn" @click="viewing = null">关闭</button>
        </div>
        <div class="skill-viewer-desc">{{ viewing.description }}</div>
        <div class="skill-viewer-body" v-html="viewingBodyHtml"></div>
      </div>
    </div>

    <!-- ============ 技能使用帮助浮层(内容内置打包,离线可用) ============ -->
    <div v-if="helpOpen" class="skill-viewer-mask" @click.self="helpOpen = false">
      <div class="skill-viewer skill-help-viewer">
        <div class="skill-viewer-head">
          <div>
            <span class="skill-name">技能使用帮助</span>
            <span class="skill-badge">随版本内置</span>
          </div>
          <button class="skill-btn" @click="helpOpen = false">关闭</button>
        </div>
        <div class="skill-viewer-body" v-html="helpBodyHtml"></div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * SkillSettingsPanel — 技能设置页（设置 → 技能设置）
 *
 * 参照上游 GenOffice 设置页 Integrations→Skills（FoundSkills）的界面骨架：
 * mine / recommended 两段 + category 分 tab + 卡片列表。差异（本项目是 WPS
 * jsaddons webview，无主进程文件系统）：
 *  - 推荐技能 = 随版本内置的 src/skill-library（全量分发，启停状态存 PluginStorage，
 *    对应上游 install 状态机的「installed/disabled」二态；无 outdated 概念——
 *    版本随产品升级整体替换）。
 *  - 我的技能 = 用户导入的单个 SKILL.md（上游 importSkillMd 的 webview 等价物：
 *    File API 读文本 → parseSkillFrontmatter 校验 → 存 PluginStorage；上游的
 *    目录/zip 导入与 symlink/zip-slip 防护是主进程能力，webview 天然不涉及，
 *    大小护栏在此处自把）。
 * 正文预览走 renderMarkdownSafe（先整体转义再解析，无注入路径）。
 */
import { marked } from 'marked'
import { SKILL_HELP_MD } from './skillSettingsHelp.js'
import {
  listBuiltinSkills,
  searchSkills,
  CATEGORY_LABELS,
  CATEGORY_ORDER
} from '../utils/skillLibrary.js'
import {
  readSkillSettings,
  setSkillEnabled,
  listCustomSkills,
  upsertCustomSkill,
  removeCustomSkill
} from '../utils/skillSettings.js'
import {
  parsePackFromMdBytes,
  parsePackFromZipBytes,
  parsePackFromDirFiles,
  MAX_IMPORT_BYTES
} from '../utils/skillPackImport.js'

/** 读取进内存前的体积预检：超限文件直接拒，避免 arrayBuffer 撑爆 webview
 *  （上限放宽到 10GB 后这条是主防线，解析函数内的校验只是最后防线） */
function rejectOversize(size) {
  if (size <= MAX_IMPORT_BYTES) return ''
  return `技能包 ${Math.round(size / 1024 / 1024)}MB 超过导入上限（10GB），未导入。`
}

marked.setOptions({ gfm: true, breaks: true })

export default {
  name: 'SkillSettingsPanel',
  data() {
    return {
      section: 'recommended',
      activeCategory: 'all',
      search: '',
      disabledNames: [],
      customSkills: [],
      viewing: null,
      helpOpen: false,
      importing: false,
      notice: null,
      noticeTimer: null
    }
  },
  computed: {
    libraryVersion() {
      const set = new Set(this.builtinSkills.map(s => s.version).filter(Boolean))
      return set.size === 1 ? [...set][0] : (this.builtinSkills.find(s => s.version)?.version || '1.0.0')
    },
    categories() {
      const present = new Set(listBuiltinSkills().map(s => s.category))
      return CATEGORY_ORDER.filter(k => present.has(k)).map(k => [k, CATEGORY_LABELS[k]])
    },
    builtinSkills() {
      const disabled = new Set(this.disabledNames)
      return listBuiltinSkills().map(s => ({ ...s, enabled: !disabled.has(s.name) }))
    },
    filteredBuiltin() {
      let list = this.builtinSkills
      if (this.activeCategory !== 'all') list = list.filter(s => s.category === this.activeCategory)
      return searchSkills(list, this.search)
    },
    filteredCustom() {
      return searchSkills(this.customSkills, this.search)
    },
    viewingBodyHtml() {
      if (!this.viewing) return ''
      return marked.parse(String(this.viewing.body || ''), { async: false })
    },
    helpBodyHtml() {
      // 帮助内容为本模块内置常量(非用户输入),无注入路径
      return marked.parse(SKILL_HELP_MD, { async: false })
    }
  },
  mounted() {
    this.reload()
  },
  beforeUnmount() {
    if (this.noticeTimer) clearTimeout(this.noticeTimer)
  },
  methods: {
    categoryLabel(key) {
      return CATEGORY_LABELS[key] || CATEGORY_LABELS.other
    },
    reload() {
      this.disabledNames = readSkillSettings().disabledSkills
      this.customSkills = listCustomSkills()
    },
    flashNotice(kind, text) {
      this.notice = { kind, text }
      if (this.noticeTimer) clearTimeout(this.noticeTimer)
      this.noticeTimer = setTimeout(() => { this.notice = null }, 4000)
    },
    onToggleBuiltin(skill, event) {
      const enabled = !!(event?.target?.checked)
      setSkillEnabled(skill.name, enabled)
      this.reload()
    },
    pickImport() {
      this.$refs.importInput?.click()
    },
    pickImportZip() {
      this.$refs.importZipInput?.click()
    },
    pickImportDir() {
      this.$refs.importDirInput?.click()
    },
    /** 入库一个技能包对象（skillPackImport 产出），失败给中文提示 */
    async commitPack(pack) {
      const r = upsertCustomSkill(pack)
      if (!r.ok) {
        const msg = {
          limit: '「我的技能」数量已达上限（32 个）。',
          persist: '写入存储失败：技能包超出面板存储配额，未导入（可精简包内附属文件后重试）。',
          invalid: '导入内容无效。'
        }[r.reason] || '导入内容无效。'
        this.flashNotice('failed', msg)
        return false
      }
      this.reload()
      this.flashNotice('done', `已导入技能「${pack.name}」${pack.entries?.length > 1 ? `（${pack.entries.length} 个文件）` : ''}。`)
      return true
    },
    async onImportFile(event) {
      const file = event?.target?.files?.[0]
      // 复位 input.value，让同一文件可重复选择
      if (event?.target) event.target.value = ''
      if (!file) return
      const oversize = rejectOversize(file.size)
      if (oversize) {
        this.flashNotice('failed', oversize)
        return
      }
      this.importing = true
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const r = parsePackFromMdBytes(file.name, bytes)
        if (!r.ok) {
          this.flashNotice('failed', r.message)
          return
        }
        await this.commitPack(r.pack)
      } catch (e) {
        this.flashNotice('failed', `导入失败：${e?.message || e}`)
      } finally {
        this.importing = false
      }
    },
    async onImportZip(event) {
      const file = event?.target?.files?.[0]
      if (event?.target) event.target.value = ''
      if (!file) return
      const oversize = rejectOversize(file.size)
      if (oversize) {
        this.flashNotice('failed', oversize)
        return
      }
      this.importing = true
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const r = await parsePackFromZipBytes(file.name, bytes)
        if (!r.ok) {
          this.flashNotice('failed', r.message)
          return
        }
        await this.commitPack(r.pack)
      } catch (e) {
        this.flashNotice('failed', `导入失败：${e?.message || e}`)
      } finally {
        this.importing = false
      }
    },
    async onImportDir(event) {
      const files = [...(event?.target?.files || [])]
      if (event?.target) event.target.value = ''
      if (!files.length) return
      const oversize = rejectOversize(files.reduce((n, f) => n + (f.size || 0), 0))
      if (oversize) {
        this.flashNotice('failed', oversize)
        return
      }
      this.importing = true
      try {
        const entries = []
        for (const f of files) {
          const rel = String(f.webkitRelativePath || f.name)
          entries.push({ relativePath: rel, bytes: new Uint8Array(await f.arrayBuffer()) })
        }
        const r = parsePackFromDirFiles(entries)
        if (!r.ok) {
          this.flashNotice('failed', r.message)
          return
        }
        await this.commitPack(r.pack)
      } catch (e) {
        this.flashNotice('failed', `导入失败：${e?.message || e}`)
      } finally {
        this.importing = false
      }
    },
    onRemoveCustom(skill) {
      if (!window.confirm(`删除技能「${skill.name}」？该操作不可恢复。`)) return
      removeCustomSkill(skill.name)
      if (this.viewing?.name === skill.name) this.viewing = null
      this.reload()
      this.flashNotice('done', `已删除技能「${skill.name}」。`)
    }
  }
}
</script>

<style scoped>
.skill-settings-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 12px;
  /* 宿主 config-panel.skill-settings-host 已零内边距满铺，边距由本面板自理 */
  padding: 12px 16px;
  box-sizing: border-box;
}
/* 页首行:标题 + 右上角帮助入口 */
.skill-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.skill-help-btn {
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  border-radius: 50%;
  border: 1px solid var(--border-color, #e0e3e8);
  background: transparent;
  color: var(--text-secondary, #8a8f99);
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.skill-help-btn:hover {
  color: var(--primary-color, #2b6de5);
  border-color: var(--primary-color, #2b6de5);
}
/* 帮助模态:比技能全文查看器略宽(长文档阅读) */
.skill-help-viewer {
  width: min(860px, 94vw);
}
.skill-help-viewer .skill-viewer-body :deep(h1) {
  font-size: 17px;
  margin-top: 0;
}
.skill-help-viewer .skill-viewer-body :deep(h2) {
  font-size: 15px;
  margin-top: 18px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-color, #e0e3e8);
}
.skill-help-viewer .skill-viewer-body :deep(h3) {
  color: var(--primary-color, #2b6de5);
}
.skill-lead {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary, #8a8f99);
  line-height: 1.6;
}
.skill-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.skill-section-tabs {
  display: inline-flex;
  border: 1px solid var(--border-color, #e0e3e8);
  border-radius: 8px;
  overflow: hidden;
}
.skill-seg {
  border: none;
  background: transparent;
  padding: 6px 14px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text-primary, #333);
}
.skill-seg.active {
  background: var(--primary-color, #2b6de5);
  color: #fff;
}
.skill-search {
  flex: 1;
  min-width: 180px;
  max-width: 320px;
  padding: 6px 10px;
  font-size: 12px;
  border: 1px solid var(--border-color, #e0e3e8);
  border-radius: 8px;
  outline: none;
}
.skill-search:focus {
  border-color: var(--primary-color, #2b6de5);
}
.skill-category-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.skill-cat {
  border: 1px solid var(--border-color, #e0e3e8);
  background: transparent;
  border-radius: 14px;
  padding: 3px 12px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text-primary, #333);
}
.skill-cat.active {
  background: var(--primary-color, #2b6de5);
  border-color: var(--primary-color, #2b6de5);
  color: #fff;
}
.skill-cards {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
}
.skill-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--border-color, #e0e3e8);
  border-radius: 10px;
  padding: 10px 14px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.skill-card:hover {
  border-color: var(--primary-color, #2b6de5);
  background: var(--hover-bg, #f5f8ff);
}
.skill-card.disabled {
  opacity: 0.55;
}
.skill-card-main {
  min-width: 0;
  flex: 1;
}
.skill-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.skill-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #333);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.skill-badge {
  flex-shrink: 0;
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 10px;
  background: var(--chip-bg, #eef2fb);
  color: var(--primary-color, #2b6de5);
}
.skill-version {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-secondary, #8a8f99);
}
.skill-desc {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary, #5f6673);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.skill-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary, #5f6673);
  white-space: nowrap;
  cursor: pointer;
}
.skill-empty {
  padding: 32px 0;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary, #8a8f99);
}
.skill-import-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.skill-import-hint {
  font-size: 11px;
  color: var(--text-secondary, #8a8f99);
  line-height: 1.5;
}
.skill-btn {
  border: 1px solid var(--border-color, #e0e3e8);
  background: transparent;
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text-primary, #333);
  white-space: nowrap;
}
.skill-btn:hover {
  border-color: var(--primary-color, #2b6de5);
  color: var(--primary-color, #2b6de5);
}
.skill-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.skill-btn-danger:hover {
  border-color: #d54941;
  color: #d54941;
}
.skill-notice {
  font-size: 12px;
  border-radius: 8px;
  padding: 8px 12px;
  line-height: 1.5;
}
.skill-notice.done {
  background: #eef7ee;
  color: #2e7d32;
}
.skill-notice.failed {
  background: #fdeeec;
  color: #d54941;
}
.skill-viewer-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 18, 25, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}
.skill-viewer {
  width: min(720px, 92vw);
  max-height: 82vh;
  background: var(--bg-primary, #fff);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  padding: 18px 22px;
  gap: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.skill-viewer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.skill-viewer-desc {
  font-size: 12px;
  color: var(--text-secondary, #5f6673);
  line-height: 1.5;
}
.skill-viewer-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--text-primary, #333);
}
.skill-viewer-body :deep(h1),
.skill-viewer-body :deep(h2),
.skill-viewer-body :deep(h3) {
  font-size: 14px;
  margin: 14px 0 6px;
}
.skill-viewer-body :deep(p) {
  margin: 6px 0;
}
.skill-viewer-body :deep(ul),
.skill-viewer-body :deep(ol) {
  margin: 6px 0;
  padding-left: 20px;
}
.skill-viewer-body :deep(code) {
  background: var(--chip-bg, #f0f2f6);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 11.5px;
}
.skill-viewer-body :deep(pre) {
  background: var(--chip-bg, #f0f2f6);
  border-radius: 8px;
  padding: 10px 12px;
  overflow-x: auto;
}
</style>
