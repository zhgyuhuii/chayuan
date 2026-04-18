# 软件设计说明与源码结构

**软件全称**：察元 AI 文档助手
**版本号**：1.0.1
**著作权人**：（请填写并与申请表一致）

## 一、编写目的与范围
本文档介绍本软件的总体结构、主要目录与各源文件职责，并列出各文件开头的若干行源码，便于对照程序组成与模块位置。文档不替代完整用户手册；操作说明请参阅产品内帮助与 README。

## 二、技术栈与运行形态
本软件为 WPS 文字加载项：前端采用 Vue 3 与 Vite 构建；通过 WPS JSAPI 与宿主文档交互；通过 HTTP 调用 OpenAI 兼容的大模型接口。源码主要位于 `src/` 目录。

## 三、总体架构（逻辑分层）
1. 入口层：`main.js` 创建应用、安装路由与全局桥接。
2. 壳层：`App.vue`、`router` 管理多路由对话框与页面。
3. 宿主集成层：`ribbon.js` 等，对接 WPS Ribbon/右键与窗口 API。
4. 业务能力层：`utils/*` 与各业务 `*.vue`，实现模型请求、文档写回、助手任务等。
5. 资源层：`public/`、`assets/` 中静态资源（本说明正文不展开二进制资源）。


## 附录 A：src 目录树（一级与二级）

src/.DS_Store
src/App.vue
src/assets/
  src/assets/ai-assistant/
  src/assets/base.css
  src/assets/logo.svg
  src/assets/main.css
src/components/
  src/components/AboutChayuanPage.vue
  src/components/AboutChayuanPanel.vue
  src/components/AIAssistantDialog.vue
  src/components/AppendReplaceText.vue
  src/components/DeleteTextDialog.vue
  src/components/Dialog.vue
  src/components/DocumentDeclassifyDialog.vue
  src/components/DocumentDeclassifyRestoreDialog.vue
  src/components/DocumentTemplateImport.vue
  src/components/DocumentTemplateSelect.vue
  src/components/FirstColStyleDialog.vue
  src/components/FormAuditDialog.vue
  src/components/FormContentPreview.vue
  src/components/FormEditDialog.vue
  src/components/js/
  src/components/LongTaskRunCard.vue
  src/components/ManualColWidth.vue
  src/components/Popup.vue
  src/components/ribbon.js
  src/components/Root.vue
  src/components/SettingsDialog.vue
  src/components/SpellCheckDialog.vue
  src/components/StyleStatisticsDialog.vue
  src/components/TableCaptionDialog.vue
  src/components/TaskOrchestrationDialog.vue
  src/components/TaskPane.vue
  src/components/TaskPaneBottom.vue
  src/components/TaskPaneLeft.vue
  src/components/TaskPaneRight.vue
  src/components/TaskPaneTop.vue
  src/components/TaskProgressDialog.vue
  src/components/TemplateCreate.vue
  src/components/TemplateDownloadDialog.vue
  src/components/TemplateExportDialog.vue
  src/components/TemplateFieldExtractDialog.vue
  src/components/TemplateFormDialog.vue
  src/components/TemplateImportDialog.vue
  src/components/UniformImageFormatDialog.vue
  src/components/UnusedStylesCleanerDialog.vue
src/main.js
src/router/
  src/router/index.js
src/utils/
  src/utils/aiAssistantSelfIntro.js
  src/utils/aiAssistantWelcomePrompts.js
  src/utils/aiAssistantWindowManager.js
  src/utils/artifactRenderer.js
  src/utils/artifactStore.js
  src/utils/artifactTypes.js
  src/utils/assistantCapabilityFaq.js
  src/utils/assistantEvaluationService.js
  src/utils/assistantIcons.js
  src/utils/assistantPrefillDraftStore.js
  src/utils/assistantPromptRecommendationService.js
  src/utils/assistantRecommendationApplyBridge.js
  src/utils/assistantRegistry.js
  src/utils/assistantRegressionSampleStore.js
  src/utils/assistantRegressionService.js
  src/utils/assistantRepairService.js
  src/utils/assistantSettings.js
  src/utils/assistantStructuredPipeline.js
  src/utils/assistantTaskRunner.js
  src/utils/assistantVersionStore.js
  src/utils/attachmentTextParser.js
  src/utils/capabilityAuditStore.js
  src/utils/capabilityBus.js
  src/utils/capabilityPolicyStore.js
  src/utils/capabilityQuotaStore.js
  src/utils/chatApi.js
  src/utils/chatContextBuilder.js
  src/utils/chatMemoryStore.js
  src/utils/chunkSettings.js
  src/utils/dataPathSettings.js
  src/utils/defaultModelGroups.js
  src/utils/dialogTextDisplay.js
  src/utils/documentActions.js
  src/utils/documentBackupStore.js
  src/utils/documentChunker.js
  src/utils/documentCommentService.js
  src/utils/documentContext.js
  src/utils/documentDeclassifyCrypto.js
  src/utils/documentDeclassifyService.js
  src/utils/documentDeclassifyStore.js
  …（其余条目已省略）

## 四、源文件逐文件说明与摘录

以下按「关键路径优先、其余字典序」排列；每节给出路径、行数、职责简述及文件开头的若干行源码。

----------------------------------------------------------------------------
文件路径：src/main.js
物理行数：27（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const app = createApp(App) 应用入口：挂载 Vue、注册路由与全局桥接。
以下为该文件开头的若干行：
    import './assets/main.css'
    import './utils/publicAssetUrl.js'
    
    import { createApp } from 'vue'
    import App from './App.vue'
    import router from './router'
    import { registerSpellCheckTaskBridge } from './utils/spellCheckTaskBridge.js'
    import { installGlobalErrorLogger } from './utils/globalErrorLogger.js'
    import { prepareDialogDisplayText } from './utils/dialogTextDisplay.js'
    
    const app = createApp(App)
    
    app.config.globalProperties.$cdt = (value) => prepareDialogDisplayText(value == null ? '' : String(value))
    
    registerSpellCheckTaskBridge()
    installGlobalErrorLogger(app)
    
    app.use(router)
    
    router.isReady().then(() => {
      app.mount('#app')
    }).catch((e) => {
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/publicAssetUrl.js
物理行数：144（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
/**；* WPS 加载项 public/ 静态资源 URL（与 dist 根目录下 index.html 同级的 images/ 等）。；*；* 策略（覆盖 wpsjs debug / 离线安装 / 在线子路径部署）：；* 1. 优先用 PluginStorage「AddinBaseUrl」+ location 推导的插件根（Ribbon getImage 回调里 document.baseURI 往往不是加载项目录，不能放在最前）。；* 2. 再用 document.baseURI + URL(relative, base)（任务窗格、对话框等正常 WebView）。；* 3. 再否则当前页 location。；* 4. 最后 import.meta.env.BASE_URL。；*/ 工具与业务子模块。
以下为该文件开头的若干行：
    /**
     * WPS 加载项 public/ 静态资源 URL（与 dist 根目录下 index.html 同级的 images/ 等）。
     *
     * 策略（覆盖 wpsjs debug / 离线安装 / 在线子路径部署）：
     * 1. 优先用 PluginStorage「AddinBaseUrl」+ location 推导的插件根（Ribbon getImage 回调里 document.baseURI 往往不是加载项目录，不能放在最前）。
     * 2. 再用 document.baseURI + URL(relative, base)（任务窗格、对话框等正常 WebView）。
     * 3. 再否则当前页 location。
     * 4. 最后 import.meta.env.BASE_URL。
     */
    
    function stripHash(href) {
    	return String(href || '').split('#')[0]
    }
    
    function getStoredAddonBaseClean() {
    	try {
    		let s = window.Application?.PluginStorage?.getItem('AddinBaseUrl') || ''
    		s = stripHash(s).replace(/\/?index\.html$/i, '').trim().replace(/\/+$/, '')
    		return s
    	} catch {
    		return ''
    	}
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/spellCheckTaskBridge.js
物理行数：39（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
startSpellCheckAllTask, 拼写检查与按锚点添加批注等辅助逻辑。
以下为该文件开头的若干行：
    import {
      startSpellCheckAllTask,
      startSpellCheckSelectionTask,
      stopSpellCheckTask
    } from './spellCheckService.js'
    
    const SPELL_CHECK_BRIDGE_KEY = '__ndSpellCheckTaskBridge'
    
    function getCurrentWindow() {
      return typeof window !== 'undefined' ? window : null
    }
    
    export function registerSpellCheckTaskBridge() {
      const currentWindow = getCurrentWindow()
      if (!currentWindow) return
      currentWindow[SPELL_CHECK_BRIDGE_KEY] = {
        start(mode = 'all') {
          const runner = mode === 'selection' ? startSpellCheckSelectionTask : startSpellCheckAllTask
          const { taskId, promise } = runner()
          Promise.resolve(promise).catch((error) => {
            console.error('spellCheck bridge task failed:', error)
          })
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/globalErrorLogger.js
物理行数：613（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
/** 已配置「数据路径」时，日志放在该目录下的子文件夹名 */ 工具与业务子模块。
以下为该文件开头的若干行：
    import { ensureDir, getDefaultLogDir, getEffectiveDataDir, normalizeDataPath, pathJoin } from './dataPathSettings.js'
    
    /** 已配置「数据路径」时，日志放在该目录下的子文件夹名 */
    const LOG_SUBDIR = 'logs'
    
    /** 单文件最大字节数（超出则同一天的下一个分片：YYYY-M-D.2.log …） */
    const MAX_LOG_FILE_BYTES = 5 * 1024 * 1024
    
    /** 保留最近 N 个自然日的日志文件，更早的删除 */
    const RETENTION_DAYS = 30
    
    /** 自动清理最小间隔，避免每次写日志都扫目录 */
    const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000
    
    /** 同一天最多分片数量（防止异常循环占满磁盘） */
    const MAX_PARTS_PER_DAY = 500
    
    /** 磁盘写入失败时写入 PluginStorage/localStorage，键名（JSON 字符串数组） */
    const FALLBACK_STORAGE_KEY = 'NdErrorLogFallback'
    const MAX_FALLBACK_LINES = 100
    
    /**
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/dialogTextDisplay.js
物理行数：68（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
/**；* Strip markdown-style punctuation from text shown in assistant dialog UI；* so users do not see raw * - # etc. from model output.；*/ 工具与业务子模块。
以下为该文件开头的若干行：
    /**
     * Strip markdown-style punctuation from text shown in assistant dialog UI
     * so users do not see raw * - # etc. from model output.
     */
    export function sanitizeDialogDisplaySymbols(text) {
      if (text == null) return ''
      let s = String(text)
      if (!s) return ''
      s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      s = s.replace(/\*/g, '')
      s = s.replace(/`/g, '')
      s = s.replace(/^#{1,6}\s*/gm, '')
      s = s.replace(/^\s*([-*_])(?:\s*\1){2,}\s*$/gm, '')
      s = s.replace(/^(\s*)[-*+]\s+/gm, '$1')
      s = s.replace(/^(\s*)>\s?/gm, '$1')
      s = s.replace(/~{2}/g, '')
      s = s.replace(/_{2,}/g, '')
      return s
    }
    
    function toHalfWidthDigits(s) {
      return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 48))
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/App.vue
物理行数：51（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const DIALOG_ROUTES = ['/settings', '/dialog', '/ad-popup', '/manual-col-width', '/dialog-delete-text', 根组件与路由出口、Ribbon 挂载到 window。
以下为该文件开头的若干行：
    <template>
      <RouterView :key="$route.fullPath" />
    </template>
    
    
    
    <script>
    import { ref, onMounted, watch } from 'vue'
    import { useRoute } from 'vue-router'
    import ribbon from './components/ribbon.js'
    import { syncAddonBaseUrlToPluginStorage } from './utils/publicAssetUrl.js'
    import { schedulePreloadAiAssistantRouteChunk } from './utils/preloadAiAssistantChunk.js'
    
    const DIALOG_ROUTES = ['/settings', '/dialog', '/ad-popup', '/manual-col-width', '/dialog-delete-text',
      '/append-replace-text', '/dialog-first-col-style', '/dialog-uniform-image-format', '/table-caption',
      '/document-declassify-dialog', '/document-declassify-restore-dialog', '/template-import-dialog',
      '/template-export-dialog', '/template-download-dialog', '/document-template-import',
      '/template-field-extract-dialog', '/form-content-preview', '/form-audit-dialog',
      '/unused-styles-cleaner-dialog', '/style-statistics-dialog', '/ai-assistant', '/task-orchestration',
      '/about-chayuan']
    
    export default {
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/router/index.js
物理行数：181（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
//import HomeView from '../views/HomeView.vue' Vue Router 路由定义，负责各对话框与功能页入口路径。
以下为该文件开头的若干行：
    import { createRouter, createWebHashHistory } from 'vue-router'
    //import HomeView from '../views/HomeView.vue'
    
    const router = createRouter({
      history:  createWebHashHistory(''),
      routes: [
        {
          path: '/',
          name: '默认页',
          component: () => import('../components/Root.vue')
        },
        {
          path: '/dialog',
          name: '对话框',
          component: () => import('../components/Dialog.vue')
        },
        {
          path: '/taskpane',
          name: '任务窗格',
          component: () => import('../components/TaskPane.vue')
        },
        {
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/Root.vue
物理行数：35（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
export default { Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div>
        <h1>{{ msg }}</h1>
      </div>
    </template>
    
    <script>
    import ribbon from './ribbon.js'
    
    export default {
      name: 'HelloWps',
      data() {
        return {
          msg: '欢迎来到wps加载项的世界!'
        }
      },
      mounted() {
        if (!window.Application?.ShowDialog || typeof ribbon.showAIAssistantDialog !== 'function') {
          return
        }
        // 等首页完成挂载后再自动拉起欢迎窗口，避免启动瞬间竞争导致弹窗丢失。
        window.setTimeout(() => {
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/js/util.js
物理行数：66（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
//在后续的wps版本中，wps的所有枚举值都会通过wps.Enum对象来自动支持，现阶段先人工定义 源代码文件，承担具体界面或业务实现。
以下为该文件开头的若干行：
    //在后续的wps版本中，wps的所有枚举值都会通过wps.Enum对象来自动支持，现阶段先人工定义
    var WPS_Enum = {
      msoCTPDockPositionLeft: 0,
      msoCTPDockPositionRight: 2,
      // 文档保护类型
      wdNoProtection: -1,
      wdAllowOnlyFormFields: 2,
      // 内容控件类型与外观
      wdContentControlText: 1,
      wdContentControlHidden: 2
    }
    
    function GetUrlPath() {
      // 在本地网页的情况下获取路径（与 index.html 同目录）
      if (window.location.protocol === 'file:') {
        const path = String(window.location.href || '').split('#')[0]
        return path.substring(0, path.lastIndexOf('/'))
      }
    
      // http(s)：包含 pathname，子路径部署时 ShowDialog 与资源根才正确
      const { protocol, hostname, port, pathname } = window.location
      const portPart = port ? `:${port}` : ''
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/js/systemdemo.js
物理行数：42（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
function openOfficeFileFromSystemDemo(param) { 源代码文件，承担具体界面或业务实现。
以下为该文件开头的若干行：
    function openOfficeFileFromSystemDemo(param) {
      let jsonObj = typeof param == 'string' ? JSON.parse(param) : param
      alert('从业务系统传过来的参数为：' + JSON.stringify(jsonObj))
      return { wps加载项项返回: jsonObj.filepath + ', 这个地址给的不正确' }
    }
    
    function InvokeFromSystemDemo(param) {
      let jsonObj = typeof param == 'string' ? JSON.parse(param) : param
      let handleInfo = jsonObj.Index
      switch (handleInfo) {
        case 'getDocumentName': {
          let docName = ''
          if (window.Application.ActiveDocument) {
            docName = window.Application.ActiveDocument.Name
          }
    
          return { 当前打开的文件名为: docName }
        }
    
        case 'newDocument': {
          let newDocName = ''
          let doc = window.Application.Documents.Add()
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/ribbon.js
物理行数：4273（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
getAssistantsForDisplayLocation, WPS 功能区与右键菜单回调、模型菜单、OnAction 分发及 ribbon 导出。
以下为该文件开头的若干行：
    import Util from './js/util.js'
    import SystemDemo from './js/systemdemo.js'
    import * as XLSX from 'xlsx'
    import { loadRulesFromDoc, saveRulesToDoc } from '../utils/templateRules.js'
    import { setNewFileMarker, isNewFile } from '../utils/documentTemplates.js'
    import { getModelLogoPath } from '../utils/modelLogos.js'
    import { isRibbonModelEnabled } from '../utils/modelSettings.js'
    import {
      getAssistantsForDisplayLocation,
      getAssistantDisplayEntry,
      isAssistantDisplayedInLocation
    } from '../utils/assistantSettings.js'
    import { getRibbonCompatibleAssistantIcon } from '../utils/assistantIcons.js'
    import {
      CONTEXT_MENU_DYNAMIC_SLOT_COUNT,
      FIXED_MAIN_ASSISTANT_IDS,
      GROUP_CONTROL_ASSISTANT_MAP,
      getAssistantResolvedIcon,
      MAIN_CONTROL_ASSISTANT_MAP,
      RIBBON_DYNAMIC_SLOT_COUNT
    } from '../utils/assistantRegistry.js'
    import {
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/chatApi.js
物理行数：384（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
/**；* AI 对话 API - OpenAI 兼容的 /chat/completions 接口；* 支持两种调用方式：；* 1. providerId + modelId：从模型设置中的分组与模型清单；* 2. ribbonModelId（兼容旧逻辑）；*/ OpenAI 兼容 Chat Completions 流式/非流式请求与错误归一化。
以下为该文件开头的若干行：
    /**
     * AI 对话 API - OpenAI 兼容的 /chat/completions 接口
     * 支持两种调用方式：
     * 1. providerId + modelId：从模型设置中的分组与模型清单
     * 2. ribbonModelId（兼容旧逻辑）
     */
    
    import { getModelConfig, RIBBON_MODEL_TO_PROVIDER, parseModelCompositeId } from './modelSettings.js'
    
    const OLLAMA_LIKE = ['ollama', 'OLLAMA', 'xinference', 'XINFERENCE', 'oneapi', 'ONEAPI', 'fastchat', 'FASTCHAT', 'lm-studio', 'new-api']
    
    function isOllamaLike(providerId) {
      return OLLAMA_LIKE.some(id => String(providerId || '').toLowerCase() === id.toLowerCase())
    }
    
    function parseErrorPayload(rawText) {
      const text = String(rawText || '').trim()
      if (!text) return { text: '', payload: null }
      try {
        return {
          text,
          payload: JSON.parse(text)
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/modelSettings.js
物理行数：455（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
/**；* 模型配置管理 - 存储和读取每个模型的配置信息；* 包括 API 密钥、API 地址、模型列表等；*/ 模型与供应商配置读写、Ribbon 模型启用判断、compositeId 解析。
以下为该文件开头的若干行：
    /**
     * 模型配置管理 - 存储和读取每个模型的配置信息
     * 包括 API 密钥、API 地址、模型列表等
     */
    
    import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'
    import { getModelLogoPath } from './modelLogos.js'
    import { inferModelType, matchesModelType } from './modelTypeUtils.js'
    
    const STORAGE_KEY = 'modelConfigs'
    const CUSTOM_PROVIDERS_KEY = 'customModelProviders'
    const MODEL_ORDER_KEY = 'modelOrder'
    
    // 默认在察元AI助理中开启的模型（ChatGPT、Ollama、千问、DeepSeek、百度云千帆）
    const DEFAULT_ENABLED_PROVIDERS = ['OPENAI', 'OLLAMA', 'DEEPSEEK', 'baidu-qianfan', 'aliyun-bailian']
    
    /**
     * 获取所有模型配置
     */
    export function getAllModelConfigs() {
      const settings = loadGlobalSettings()
      return settings[STORAGE_KEY] || {}
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/globalSettings.js
物理行数：137（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
/**；* 全局设置 - 持久化存储；* 注意：WPS PluginStorage 在加载项关闭后不持久化，必须使用文件或 localStorage；* 策略：优先文件（数据路径下 settings.json），备用 localStorage（跨会话持久化）；*/ 工具与业务子模块。
以下为该文件开头的若干行：
    /**
     * 全局设置 - 持久化存储
     * 注意：WPS PluginStorage 在加载项关闭后不持久化，必须使用文件或 localStorage
     * 策略：优先文件（数据路径下 settings.json），备用 localStorage（跨会话持久化）
     */
    
    import { getEffectiveDataDir, joinDataPath, ensureDir, getDefaultDataPath } from './dataPathSettings.js'
    
    const FILE_NAME = 'settings.json'
    const PLUGIN_STORAGE_KEY = 'NdGlobalSettings'
    const LOCAL_STORAGE_KEY = 'NdGlobalSettings'
    
    function getSettingsBaseDir() {
      return getEffectiveDataDir() || getDefaultDataPath()
    }
    
    function getSettingsPath() {
      const base = getSettingsBaseDir()
      if (!base) return null
      const sep = base.includes('\\') ? '\\' : '/'
      const part = (FILE_NAME || '').replace(/^[/\\]+/, '').replace(/[/\\]+/g, sep)
      return base + sep + part
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/defaultModelGroups.js
物理行数：148（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
/**；* Ribbon 与「关于察元」等处的默认模型分组（分组名、图标、子模型）。；*/ 工具与业务子模块。
以下为该文件开头的若干行：
    /**
     * Ribbon 与「关于察元」等处的默认模型分组（分组名、图标、子模型）。
     */
    export const MODEL_GROUPS = [
      {
        label: 'ChatGPT',
        icon: 'images/models/openai.svg',
        models: [
          { id: 'gpt-4o', name: 'GPT-4o', icon: 'images/models/openai.svg' },
          { id: 'gpt-4', name: 'GPT-4', icon: 'images/models/openai.svg' },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', icon: 'images/models/openai.svg' },
          { id: 'o3', name: 'o3', icon: 'images/models/openai.svg' },
          { id: 'gpt_o1', name: 'GPT-o1', icon: 'images/models/openai.svg' },
          { id: 'gpt-5', name: 'GPT-5', icon: 'images/models/openai.svg' },
          { id: 'gpt-3.5', name: 'GPT-3.5', icon: 'images/models/openai.svg' }
        ]
      },
      {
        label: 'Claude',
        icon: 'images/models/claude.svg',
        models: [
          { id: 'claude-3.5', name: 'Claude 3.5', icon: 'images/models/claude.svg' },
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentContext.js
物理行数：461（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const WD_COLLAPSE_END = 0 工具与业务子模块。
以下为该文件开头的若干行：
    import { getApplication, hasMeaningfulSelectionText } from './documentActions.js'
    
    const WD_COLLAPSE_END = 0
    const WD_COLLAPSE_START = 1
    const WD_NUMBER_OF_PAGES_IN_DOCUMENT = 2
    const WD_STATISTIC_WORDS = 0
    const WD_STATISTIC_PAGES = 2
    const WD_STATISTIC_CHARACTERS = 3
    const WD_STATISTIC_PARAGRAPHS = 4
    const WD_STATISTIC_CHARACTERS_WITH_SPACES = 5
    
    const PAGE_NUMBER_INFORMATION_CONSTANTS = [3, 7, 8, 1]
    
    const ALIGNMENT_LABELS = {
      0: '左对齐',
      1: '居中',
      2: '右对齐',
      3: '两端对齐',
      4: '分散对齐',
      5: '中部对齐',
      7: '左对齐',
      8: '两端对齐',
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentChunker.js
物理行数：575（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
/**；* 文档分块 - 根据段落截取设置将文档分块，并保留位置信息（用于后续批注定位）；* 支持大文档：按段落迭代，避免一次性加载全文；*/ 工具与业务子模块。
以下为该文件开头的若干行：
    /**
     * 文档分块 - 根据段落截取设置将文档分块，并保留位置信息（用于后续批注定位）
     * 支持大文档：按段落迭代，避免一次性加载全文
     */
    
    import { getChunkSettings } from './chunkSettings.js'
    import { normalizeTextWithIndexMap, mapNormalizedRangeToRawRange } from './documentPositionUtils.js'
    
    function normalizeRangeText(text) {
      return (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    }
    
    function assessChunkRiskProfile(text) {
      const normalized = normalizeRangeText(text)
      const lineBreakCount = (normalized.match(/\n/g) || []).length
      const slashCount = (normalized.match(/[\\/]/g) || []).length
      const numberingLineCount = normalized
        .split('\n')
        .filter(line => /^\s*(?:第[0-9一二三四五六七八九十百千]+[章节篇部卷]|[一二三四五六七八九十百千]+[、.]|\d+(?:\.\d+)*(?:[、.．)）]))/.test(line))
        .length
      const tableLikeLineCount = normalized
        .split('\n')
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentActions.js
物理行数：1907（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
ANALYSIS_SECRET_KEYWORD_EXTRACT_ID, 文档写回：插入、替换、批注及与 WPS 文档对象模型交互。
以下为该文件开头的若干行：
    import { ensureDir, getEffectiveDataDir, pathJoin, pathSep } from './dataPathSettings.js'
    import { findIssueRangeDetailed } from './spellCheckService.js'
    import {
      ANALYSIS_SECRET_KEYWORD_EXTRACT_ID,
      buildAnchorOnlyStructuredCommentSkipApplyResult,
      isAnchoredCommentDocumentAction
    } from './structuredCommentPolicy.js'
    
    function getApplication() {
      return window.Application || window.opener?.Application || window.parent?.Application
    }
    
    function normalizeText(text) {
      return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    }
    
    function toDocumentText(text) {
      return String(text || '').replace(/\r\n/g, '\r').replace(/\n/g, '\r')
    }
    
    export function getActiveDocument() {
      return getApplication()?.ActiveDocument || null
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentCommentService.js
物理行数：607（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const DOCUMENT_COMMENT_TASK_TYPE = 'document-comment' 智能批注任务：分段、调用模型、解析 JSON、写入批注。
以下为该文件开头的若干行：
    import { chatCompletion } from './chatApi.js'
    import { getApplication } from './documentActions.js'
    import { getDocumentChunksWithPositions, getSelectionChunksWithPositions } from './documentChunker.js'
    import { addTask, getTaskById, updateTask } from './taskListStore.js'
    import { addCommentAtText } from './spellCheckService.js'
    
    const DOCUMENT_COMMENT_TASK_TYPE = 'document-comment'
    const activeDocumentCommentRuns = new Map()
    
    function createCancelError() {
      const err = new Error('任务已停止')
      err.name = 'TaskCancelledError'
      err.code = 'TASK_CANCELLED'
      return err
    }
    
    function isTaskCancelledError(error) {
      return error?.code === 'TASK_CANCELLED' || error?.name === 'TaskCancelledError'
    }
    
    function throwIfCancelled(runState) {
      if (runState?.cancelled) throw createCancelError()
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/spellCheckService.js
物理行数：1825（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
/**；* 拼写与语法检查服务；* - 根据段落截取设置分块；* - 使用设置中的拼写与语法检查模型；* - 分批调用大模型，解析结果并添加批注；* - 支持并发控制与大文档性能优化；*/ 拼写检查与按锚点添加批注等辅助逻辑。
以下为该文件开头的若干行：
    /**
     * 拼写与语法检查服务
     * - 根据段落截取设置分块
     * - 使用设置中的拼写与语法检查模型
     * - 分批调用大模型，解析结果并添加批注
     * - 支持并发控制与大文档性能优化
     */
    
    import { chatCompletion } from './chatApi.js'
    import { getFlatModelsFromSettings } from './modelSettings.js'
    import { getChunkSettings } from './chunkSettings.js'
    import { getAssistantSetting, getConfiguredAssistantModelId } from './assistantSettings.js'
    import { loadGlobalSettings } from './globalSettings.js'
    import {
      collectMatchPositions,
      mapNormalizedRangeToRaw,
      normalizeTextWithIndexMap
    } from './documentPositionUtils.js'
    
    /** WPS ShowDialog 内可能无 Application，从 opener/parent 获取（不赋值 window.Application，避免只读属性报错） */
    function getApplication() {
      return window.Application || window.opener?.Application || window.parent?.Application
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/assistantRegistry.js
物理行数：1376（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred' 工具与业务子模块。
以下为该文件开头的若干行：
    import { DEFAULT_ASSISTANT_ICON, normalizeAssistantIcon } from './assistantIcons.js'
    import { createDefaultReportSettings } from './reportSettings.js'
    
    const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
    const INPUT_SOURCE_SELECTION_ONLY = 'selection-only'
    const INPUT_SOURCE_DOCUMENT = 'document'
    
    export const INPUT_SOURCE_OPTIONS = [
      { value: INPUT_SOURCE_SELECTION_PREFERRED, label: '优先使用当前选中，无选中时回退全文' },
      { value: INPUT_SOURCE_SELECTION_ONLY, label: '仅处理当前选中内容' },
      { value: INPUT_SOURCE_DOCUMENT, label: '始终处理全文' }
    ]
    
    export const DOCUMENT_ACTION_OPTIONS = [
      { value: 'replace', label: '替换文档内容' },
      { value: 'insert', label: '插入到光标处' },
      { value: 'insert-after', label: '插入到每段后面' },
      { value: 'prepend', label: '插入到文档最前面' },
      { value: 'comment', label: '添加批注' },
      { value: 'link-comment', label: '链接形式批注' },
      { value: 'comment-replace', label: '批注 + 替换' },
      { value: 'append', label: '追加到文末' },
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/assistantSettings.js
物理行数：420（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
getAssistantResolvedIcon, 工具与业务子模块。
以下为该文件开头的若干行：
    import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'
    import { DEFAULT_ASSISTANT_ICON, buildAssistantRibbonIconValue, normalizeAssistantIcon } from './assistantIcons.js'
    import { createDefaultReportSettings, normalizeReportSettings } from './reportSettings.js'
    import {
      getAssistantResolvedIcon,
      getBuiltinAssistants,
      getBuiltinAssistantDefinition,
      getAssistantDefaultConfig,
      ASSISTANT_DISPLAY_LOCATION_OPTIONS
    } from './assistantRegistry.js'
    
    const ASSISTANT_SETTINGS_KEY = 'assistantSettings'
    const CUSTOM_ASSISTANTS_KEY = 'customAssistants'
    const VALID_DISPLAY_LOCATIONS = new Set(
      ASSISTANT_DISPLAY_LOCATION_OPTIONS.map(item => item.value)
    )
    
    function deepClone(value) {
      return JSON.parse(JSON.stringify(value))
    }
    
    function ensureObject(value) {
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/assistantIcons.js
物理行数：312（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
export const DEFAULT_ASSISTANT_ICON = 'images/ai-assistant.svg' 工具与业务子模块。
以下为该文件开头的若干行：
    import { getIconData, iconToSVG, iconToHTML } from '@iconify/utils'
    import { ensureDir, getDefaultDataPath, getEffectiveDataDir, pathJoin } from './dataPathSettings.js'
    
    export const DEFAULT_ASSISTANT_ICON = 'images/ai-assistant.svg'
    
    export const ASSISTANT_ICON_LIBRARY = [
      { id: 'assistant', label: '智能助手', category: '通用', path: 'images/ai-assistant.svg' },
      { id: 'summary', label: '摘要报告', category: '写作', path: 'images/report.svg' },
      { id: 'check', label: '检查校对', category: '分析', path: 'images/check.svg' },
      { id: 'rewrite', label: '改写润色', category: '写作', path: 'images/replace-text.svg' },
      { id: 'expand', label: '扩展增强', category: '写作', path: 'images/refresh.svg' },
      { id: 'clean', label: '精简清理', category: '写作', path: 'images/clean.svg' },
      { id: 'translate', label: '翻译语言', category: '语言', path: 'images/ai-websites.svg' },
      { id: 'keyword', label: '重点提炼', category: '分析', path: 'images/select-all.svg' },
      { id: 'number', label: '结构编号', category: '分析', path: 'images/number.svg' },
      { id: 'comment', label: '批注说明', category: '分析', path: 'images/add-caption.svg' },
      { id: 'image', label: '图像创作', category: '多媒体', path: 'images/select-images.svg' },
      { id: 'video', label: '视频生成', category: '多媒体', path: 'images/task-orchestration.svg' },
      { id: 'security', label: '安全审查', category: '安全', path: 'images/declassify-check.svg' },
      { id: 'discussion', label: '协作讨论', category: '协作', path: 'images/discussion-group.svg' },
      { id: 'requirement', label: '需求整理', category: '协作', path: 'images/requirement.svg' },
      { id: 'settings', label: '设置工具', category: '通用', path: 'images/settings.svg' }
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/assistantTaskRunner.js
物理行数：2543（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
applyDocumentAction, 助手任务创建、执行与任务状态更新。
以下为该文件开头的若干行：
    import { buildChatCompletionsRequestSnapshot, chatCompletion } from './chatApi.js'
    import { getFlatModelsFromSettings, parseModelCompositeId } from './modelSettings.js'
    import { addTask, updateTask, getTaskById } from './taskListStore.js'
    import {
      applyDocumentAction,
      applyMediaDocumentAction,
      getActiveDocument,
      getSelection,
      resolveDocumentInput,
      textLooksLikePlanStatsJson
    } from './documentActions.js'
    import { inferModelType } from './modelTypeUtils.js'
    import { getDocumentChunksWithPositions, getSelectionChunksWithPositions } from './documentChunker.js'
    import { getChunkSettings } from './chunkSettings.js'
    import {
      getBuiltinAssistantDefinition,
      getBuiltinRibbonAssistantIds,
      mergeDefinitionRuntimeCapabilities
    } from './assistantRegistry.js'
    import {
      ANALYSIS_AI_TRACE_CHECK_ID,
      ANALYSIS_SECRET_KEYWORD_EXTRACT_ID,
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/taskListStore.js
物理行数：299（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
/**；* 通用任务清单存储 - 支持跨窗口同步（Popup、主窗口等）；* 任务类型：spell-check、translate、summary 等；* 通过 localStorage + storage 事件实现多窗口同步；*/ 工具与业务子模块。
以下为该文件开头的若干行：
    /**
     * 通用任务清单存储 - 支持跨窗口同步（Popup、主窗口等）
     * 任务类型：spell-check、translate、summary 等
     * 通过 localStorage + storage 事件实现多窗口同步
     */
    
    const STORAGE_KEY = 'NdTaskList'
    const STORAGE_VERSION = 1
    const ARCHIVE_LIMIT = 200
    
    /** @typedef {'pending'|'running'|'completed'|'failed'|'cancelled'|'abnormal'} TaskStatus */
    /** @typedef {{ id: string, type: string, title: string, status: TaskStatus, progress?: number, total?: number, current?: number, data?: object, error?: string, createdAt: string, startedAt?: string, endedAt?: string, updatedAt: string }} Task */
    
    let tasks = []
    let archivedTasks = []
    let listeners = new Set()
    
    function parseStoredState(raw) {
      const emptyState = { tasks: [], archivedTasks: [] }
      if (!raw) return emptyState
      try {
        const parsed = JSON.parse(raw)
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/aiAssistantWindowManager.js
物理行数：187（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const LOCK_KEY = 'nd_ai_assistant_window_lock' 工具与业务子模块。
以下为该文件开头的若干行：
    import { activateDialogWindow } from './windowActivation.js'
    
    const LOCK_KEY = 'nd_ai_assistant_window_lock'
    const REQUEST_KEY = 'nd_ai_assistant_window_request'
    const STALE_MS = 15000
    const HEARTBEAT_MS = 5000
    
    function readStorageJson(key) {
      try {
        const raw = window.localStorage.getItem(key)
        return raw ? JSON.parse(raw) : null
      } catch (_) {
        return null
      }
    }
    
    function writeStorageJson(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
        return true
      } catch (_) {
        return false
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/AIAssistantDialog.vue
物理行数：15173（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
class="sidebar" AI 助手主对话框界面与对话、写回交互。
以下为该文件开头的若干行：
    <template>
      <div class="ai-assistant-dialog">
        <!-- 左侧边栏：会话 / 助手 -->
        <aside
          class="sidebar"
          :class="{ collapsed: sidebarCollapsed, resizing: isResizingSidebar }"
          :style="sidebarStyle"
        >
          <div class="sidebar-tabbar">
            <div
              class="sidebar-tab"
              :class="{ active: activeSidebarTab === 'chats' }"
              @click="activeSidebarTab = 'chats'"
            >
              <span>对话</span>
              <span class="sidebar-tab-badge">{{ chatHistory.length }}</span>
            </div>
            <div
              class="sidebar-tab"
              :class="{ active: activeSidebarTab === 'assistants' }"
              @click="activeSidebarTab = 'assistants'"
            >
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/SettingsDialog.vue
物理行数：6169（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
v-for="item in mainMenuItems" 综合设置（模型、助手、路径等）对话框。
以下为该文件开头的若干行：
    <template>
      <div class="settings-dialog">
        <div v-if="initError" class="init-error">
          <p>加载失败：{{ initError }}</p>
          <p class="hint">请刷新或重新打开设置</p>
        </div>
        <template v-else>
        <div class="dialog-body">
          <!-- 三列布局 -->
          <div class="settings-layout">
            <!-- 第一列：主菜单 -->
            <div class="settings-column column-1">
              <div class="menu-list">
                <div
                  v-for="item in mainMenuItems"
                  :key="item.key"
                  class="menu-item"
                  :class="{ active: activeMainMenu === item.key }"
                  @click="selectMainMenu(item.key)"
                >
                  <img
                    v-if="isSettingsMainMenuIconAsset(item.icon)"
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/AboutChayuanPage.vue
物理行数：17（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
export default { Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="about-chayuan-page">
        <AboutChayuanPanel />
      </div>
    </template>
    
    <script>
    import AboutChayuanPanel from './AboutChayuanPanel.vue'
    
    export default {
      name: 'AboutChayuanPage',
      components: { AboutChayuanPanel }
    }
    </script>
    
    
    
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/AboutChayuanPanel.vue
物理行数：403（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
「察元」由北京智灵鸟科技中心开发与维护，面向 WPS 文字的办公场景 AI 助手：在本地文档中完成智能写作、审查与写回。<strong>特别强调支持离线模型</strong>——可通过 Ollama、LM Studio、Xinference、OneAPI 等 <strong>OpenAI 兼容</strong> 的本地或内网网关接入，对话与敏感内容<strong>无需依赖公网大模型 API</strong>；同时也可对接多家云端供应商，在效率与数据可控之间取得平衡。 Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="about-chayuan-panel">
        <header class="about-hero">
          <div class="about-hero-text">
            <p class="about-kicker">WPS 智能加载项 · {{ appVersion }}</p>
            <h1 class="about-title">察元 AI 文档助手</h1>
            <p class="about-lead">
              「察元」由北京智灵鸟科技中心开发与维护，面向 WPS 文字的办公场景 AI 助手：在本地文档中完成智能写作、审查与写回。<strong>特别强调支持离线模型</strong>——可通过 Ollama、LM Studio、Xinference、OneAPI 等 <strong>OpenAI 兼容</strong> 的本地或内网网关接入，对话与敏感内容<strong>无需依赖公网大模型 API</strong>；同时也可对接多家云端供应商，在效率与数据可控之间取得平衡。
            </p>
            <p class="about-lead-sub">
              察元强调<strong>可扩展的助手能力</strong>、<strong>可配置的模型与数据路径</strong>与<strong>离线/内网优先的部署方式</strong>，适合政务、涉密、内网办公及希望数据不出域的用户长期使用。
            </p>
          </div>
          <div class="about-hero-visual" aria-hidden="true">
            <div class="about-hero-orbit"></div>
            <img
              class="about-hero-logo"
              :src="publicAssetUrl('images/logo.png')"
              alt=""
              @error="heroLogoOk = false"
              v-if="heroLogoOk"
            />
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/AppendReplaceText.vue
物理行数：156（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
id="find" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="append-replace">
        <div class="popup-header">
          <h2>追加或替换文字</h2>
          <p class="subtitle">在文档全部表格中查找并替换或追加</p>
        </div>
        <div class="popup-body">
          <div class="form-group">
            <label for="find">查找内容</label>
            <input
              id="find"
              v-model.trim="findContent"
              type="text"
              placeholder="要查找的字符串"
              class="input-text"
              @input="errorMsg = ''"
            />
          </div>
          <div class="form-group radio-row">
            <label class="radio-label">
              <input v-model="mode" type="radio" value="replace" name="mode" />
              <span>替换</span>
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/DeleteTextDialog.vue
物理行数：206（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
v-model="keyword" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="delete-text-dialog">
        <div class="popup-header">
          <h2>删除文字所在行/列</h2>
          <p class="subtitle">在文档全部表格中查找包含关键词的单元格，删除其所在行或列</p>
        </div>
        <div class="popup-body">
          <template v-if="step === 'form'">
            <div class="form-group">
              <label>关键词</label>
              <input
                v-model="keyword"
                type="text"
                class="input-text"
                placeholder="输入要查找的文字"
                @keydown.enter="onSearch"
              />
            </div>
            <div class="form-group radio-group">
              <label>删除方式</label>
              <div class="radio-row">
                <label class="radio-item">
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/Dialog.vue
物理行数：65（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
这是一个网页，按<span style="font-weight: bolder">"F12"</span>可以打开调试器。 Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="hello">
        <div class="global">
          <div class="divItem">
            这是一个网页，按<span style="font-weight: bolder">"F12"</span>可以打开调试器。
          </div>
          <div class="divItem">
            这个示例展示了wps加载项的相关基础能力，与B/S业务系统的交互，请用浏览器打开：
            <span style="font-weight: bolder; color: slateblue; cursor: pointer" @click="onOpenWeb()">{{
              DemoSpan
            }}</span>
          </div>
          <div class="divItem">
            开发文档:
            <span style="font-weight: bolder; color: slateblue">https://open.wps.cn/docs/office</span>
          </div>
          <hr />
          <div class="divItem">
            <button style="margin: 3px" @click="onDocNameClick()">取文件名</button>
            <button style="margin: 3px" @click="onbuttonclick('createTaskPane')">创建任务窗格</button>
            <button style="margin: 3px" @click="onbuttonclick('newDoc')">新建文件</button>
            <button style="margin: 3px" @click="onbuttonclick('addString')">文档开头添加字符串</button>
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/DocumentDeclassifyDialog.vue
物理行数：331（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
已完成占位符脱密，共替换 {{ successInfo.replacementCount }} 处，涉及 {{ successInfo.matchedKeywordCount }} 个关键词。 Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="document-declassify-dialog">
        <div class="popup-header">
          <h2>文档脱密</h2>
          <p class="subtitle">自动提取涉密关键词，确认后将原文替换为占位符，并把恢复载荷加密保存到当前文档。</p>
        </div>
    
        <div class="popup-body">
          <template v-if="step === 'done'">
            <div class="result success">
              已完成占位符脱密，共替换 {{ successInfo.replacementCount }} 处，涉及 {{ successInfo.matchedKeywordCount }} 个关键词。
            </div>
            <p class="confirm-hint">当前文档已标记为脱密状态，可通过“密码复原”输入密码恢复原文。</p>
          </template>
    
          <template v-else>
            <div v-if="loading" class="loading-panel">
              <div class="loading-title">正在调用“涉密关键词提取”助手...</div>
              <div class="loading-hint">请稍候，系统正在分析全文并生成关键词与占位符映射。</div>
            </div>
    
            <template v-else>
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/DocumentDeclassifyRestoreDialog.vue
物理行数：121（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
已完成复原，共恢复 {{ successInfo.replacementCount }} 处替换，涉及 {{ successInfo.keywordCount }} 个关键词。 Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="document-declassify-restore-dialog">
        <div class="popup-header">
          <h2>密码复原</h2>
          <p class="subtitle">输入执行占位符脱密时设置的密码，验证通过后恢复当前文档原文。</p>
        </div>
    
        <div class="popup-body">
          <template v-if="step === 'done'">
            <div class="result success">
              已完成复原，共恢复 {{ successInfo.replacementCount }} 处替换，涉及 {{ successInfo.keywordCount }} 个关键词。
            </div>
            <p class="confirm-hint">当前文档已恢复为未脱密状态。</p>
          </template>
    
          <template v-else>
            <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    
            <div class="summary-card">
              <div class="summary-label">当前状态</div>
              <div class="summary-value">{{ stateSummary.statusText }}</div>
              <div class="summary-hint">
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/DocumentTemplateImport.vue
物理行数：145（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
ref="fileInputRef" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="document-template-import">
        <div class="dialog-header">
          <h3>导入模板</h3>
          <button class="btn-close" @click="onClose">×</button>
        </div>
        <div class="dialog-body">
          <p class="import-desc">选择 .aidocx 格式的模板文件，将添加到本地模板库，新建文档时可从此处选择。</p>
          <div class="import-actions">
            <input
              ref="fileInputRef"
              type="file"
              accept=".aidocx"
              style="display:none"
              @change="onFileInputChange"
            />
            <button class="btn btn-primary" :disabled="importing" @click="onSelectFile">
              {{ importing ? '添加中...' : '选择模板文件' }}
            </button>
          </div>
          <div v-if="message" class="message" :class="message.type">
            {{ message.text }}
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/DocumentTemplateSelect.vue
物理行数：196（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
v-for="t in templates" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="document-template-select">
        <div class="dialog-header">
          <h3>新建文档</h3>
          <button class="btn-close" @click="onClose">×</button>
        </div>
        <div class="dialog-body">
          <p class="select-desc">从列表中选择一个文件，将复制一份打开并标记为新建</p>
          <div class="template-list">
            <div
              v-for="t in templates"
              :key="t.id"
              class="template-item"
              :class="{ selected: selectedId === t.id }"
              :title="t.path"
              @click="selectedId = t.id"
            >
              <span class="item-name">{{ t.name }}</span>
            </div>
            <div
              class="template-item template-item-blank"
              :class="{ selected: selectedId === '__blank__' }"
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/FirstColStyleDialog.vue
物理行数：271（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
v-model="searchKeyword" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="first-col-style-dialog">
        <div v-if="loading" class="loading-mask">
          <div class="loading-content">
            <span class="loading-text">正在加载样式，请稍后......</span>
          </div>
        </div>
        <div class="popup-header">
          <h2>{{ isFirstRow ? '第一行指定样式' : '第一列指定样式' }}</h2>
          <p class="subtitle">选择一种样式，将应用于文档所有表格的{{ isFirstRow ? '第一行' : '第一列' }}（类似开始菜单样式）</p>
          <div v-if="step === 'select' && !loading && !errorMsg" class="search-row">
            <input
              v-model="searchKeyword"
              type="text"
              class="search-input"
              placeholder="输入关键词筛选样式…"
              @input="onSearchInput"
            />
            <span v-if="searchKeyword" class="search-hint">共 {{ filteredList.length }} 个匹配</span>
          </div>
        </div>
        <div class="popup-body">
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/FormAuditDialog.vue
物理行数：1085（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
v-model.trim="searchText" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="form-audit-dialog">
        <div class="popup-body">
          <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    
          <div class="filter-bar">
            <input
              v-model.trim="searchText"
              type="text"
              class="search-input"
              placeholder="搜索规则名称、标签、审计规则"
            />
            <label class="filter-item">
              <span>风险</span>
              <select v-model="riskFilter" class="filter-select compact-select">
                <option value="all">全部</option>
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </label>
            <label class="filter-item">
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/FormContentPreview.vue
物理行数：261（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
v-for="(item, idx) in items" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="form-content-preview">
         
        <div class="popup-body">
          <div v-if="loading" class="loading-state">
            <span class="loading-spinner"></span>
            <span>正在加载…</span>
          </div>
          <div v-else-if="errorMsg" class="error-state">
            <p>{{ errorMsg }}</p>
          </div>
          <div v-else-if="!items.length" class="empty-state">
            <p>文档中暂无表单标签（书签）</p>
            <p class="hint">请先在「规则制作」中创建表单项并插入标签到文档</p>
          </div>
          <div v-else class="list-wrap">
            <table class="preview-table">
              <thead>
                <tr>
                  <th class="col-name">名称</th>
                  <th class="col-content">内容</th>
                  <th class="col-fill-hint">填写提示</th>
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/FormEditDialog.vue
物理行数：536（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
{{ opt.label }} Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="form-edit-dialog">
        <div v-if="!isFormMode" class="form-mode-hint">
          <div class="hint-content">
            <h3>当前文档未处于表单模式</h3>
            <p>请先进入表单模式以使用表单编辑功能</p>
          </div>
        </div>
        <div v-else class="form-edit-panel">
          <!-- 左侧表单编辑区域 -->
          <div class="form-left">
            <div class="form-body">
              <div v-if="!selectedBookmark" class="empty-state">
                <p>请从右侧选择书签进行编辑</p>
              </div>
              <div v-else class="form-content">
                <div class="form-group">
                  <label>书签名称 <span class="required">*</span></label>
                  <input v-model="form.name" placeholder="如：姓名、合同编号、签署日期" />
                  <p class="hint">填写该项的显示名称，将作为标签的一部分</p>
                </div>
                <div class="form-group">
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/js/dialog.js
物理行数：60（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
function onbuttonclick(idStr, param) { 源代码文件，承担具体界面或业务实现。
以下为该文件开头的若干行：
    import Util from './util.js'
    
    function onbuttonclick(idStr, param) {
      switch (idStr) {
        case 'getDocName': {
          let doc = window.Application.ActiveDocument
          if (!doc) {
            return '当前没有打开任何文档'
          }
          return doc.Name
        }
        case 'createTaskPane': {
          let tsId = window.Application.PluginStorage.getItem('taskpane_id')
          if (!tsId) {
            let tskpane = window.Application.CreateTaskPane(
              Util.GetUrlPath() + Util.GetRouterHash() + '/taskpane'
            )
            let id = tskpane.ID
            window.Application.PluginStorage.setItem('taskpane_id', id)
            tskpane.Visible = true
          } else {
            let tskpane = window.Application.GetTaskPane(tsId)
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/js/taskpane.js
物理行数：59（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
function onbuttonclick(idStr, param) { 源代码文件，承担具体界面或业务实现。
以下为该文件开头的若干行：
    import Util from './util.js'
    
    function onbuttonclick(idStr, param) {
      if (typeof window.Application.Enum != 'object') {
        // 如果没有内置枚举值
        window.Application.Enum = Util.WPS_Enum
      }
      switch (idStr) {
        case 'dockLeft': {
          let tsId = window.Application.PluginStorage.getItem('taskpane_id')
          if (tsId) {
            let tskpane = window.Application.GetTaskPane(tsId)
            tskpane.DockPosition = window.Application.Enum.msoCTPDockPositionLeft
          }
          break
        }
        case 'dockRight': {
          let tsId = window.Application.PluginStorage.getItem('taskpane_id')
          if (tsId) {
            let tskpane = window.Application.GetTaskPane(tsId)
            tskpane.DockPosition = window.Application.Enum.msoCTPDockPositionRight
          }
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/LongTaskRunCard.vue
物理行数：252（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
v-if="showApply" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <template v-if="run">
        <div v-if="mode === 'inline'">
          <div v-if="showActionBar" class="message-confirm-actions run-action-bar">
            <button
              v-if="showApply"
              type="button"
              class="run-icon-btn success"
              title="确认写回"
              aria-label="确认写回"
              @click.stop="$emit('apply')"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M9.55 18L3.85 12.3l1.4-1.4l4.3 4.3l9.2-9.2l1.4 1.4z"/></svg>
            </button>
            <button
              v-if="showStop && run.status === 'running'"
              type="button"
              class="run-icon-btn danger"
              title="停止处理"
              aria-label="停止处理"
              @click.stop="$emit('stop')"
            >
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/ManualColWidth.vue
物理行数：125（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
id="col-width" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="manual-col-width">
        <div class="popup-header">
          <h2>统一表格列宽</h2>
          <p class="subtitle">列宽（磅，5～500）</p>
        </div>
        <div class="popup-body">
          <div class="form-group">
            <label for="col-width">列宽</label>
            <input
              id="col-width"
              v-model.number="widthInput"
              type="number"
              min="5"
              max="500"
              step="1"
              placeholder="60"
              class="input-number"
              @input="errorMsg = ''"
              @keydown.enter="onConfirm"
            />
            <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/Popup.vue
物理行数：4215（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
type="button" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="popup task-list-popup">
        <div class="header">
          <h2>任务清单</h2>
          <div class="header-actions">
            <button v-if="hasFailedTasks" type="button" class="btn-clear" @click="clearFailed">清空失败与异常</button>
            <button v-if="hasCompletedTasks" type="button" class="btn-clear" @click="clearCompleted">清空已完成</button>
          </div>
        </div>
        <div class="content">
          <div v-if="tasks.length === 0" class="empty-state">
            <p>暂无任务</p>
            <p class="hint">点击「检查全部」或「检查当前选中」开始拼写与语法检查，任务将显示在此处</p>
          </div>
          <div v-else>
            <div v-if="hasSecurityTasks" class="overview-wrap">
              <div class="overview-scope-switch">
                <button
                  type="button"
                  class="overview-scope-btn"
                  :class="{ active: overviewScope === 'all' }"
                  @click="overviewScope = 'all'"
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/SpellCheckDialog.vue
物理行数：217（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
v-if="task && task.status === 'running'" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="spell-check-dialog">
        <div class="header">
          <div class="header-main">
            <div class="title-row">
              <h2>{{ mode === 'all' ? '拼写与语法检查' : '拼写与语法检查（选中）' }}</h2>
              <span class="status-badge" :class="statusBadgeClass">{{ statusBadgeText }}</span>
            </div>
            <p class="header-subtitle">任务可关闭提示窗继续执行，只有点击停止才会中止任务。</p>
          </div>
          <div class="header-actions">
            <button
              v-if="task && task.status === 'running'"
              type="button"
              class="btn-stop"
              @click="stopTask"
            >停止任务</button>
            <button type="button" class="btn-close" @click="closeWindow">关闭</button>
          </div>
        </div>
        <div class="body">
          <div class="progress-meta">
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/StyleStatisticsDialog.vue
物理行数：413（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
v-for="(location, idx) in styleItem.locations" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="style-statistics-dialog">
        <div class="dialog-header-compact">
          <button class="btn-close" @click="onClose">×</button>
        </div>
        <div class="dialog-body">
          <div v-if="loading" class="loading">
            <div>正在统计样式...</div>
            <div v-if="progressText" class="progress-text">{{ progressText }}</div>
          </div>
          <div v-else-if="error" class="error">{{ error }}</div>
          <div v-else class="style-table-container">
            <table class="style-table">
              <thead>
                <tr>
                  <th class="col-style-name">样式名称</th>
                  <th class="col-page">页码</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="styleItem in styleList" :key="styleItem.styleName">
                  <tr
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/TableCaptionDialog.vue
物理行数：483（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
id="label" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
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
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/TaskOrchestrationDialog.vue
物理行数：4464（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
class="workflow-main" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="workflow-dialog">
        <div
          class="workflow-main"
          :class="{ 'left-collapsed': leftCollapsed, 'right-collapsed': rightCollapsed }"
          :style="workflowMainStyle"
        >
          <aside v-show="!leftCollapsed" class="palette-panel">
            <button
              type="button"
              class="panel-collapse-handle panel-collapse-handle-left"
              :aria-label="leftCollapsed ? '展开工具库' : '收起工具库'"
              title="收起工具库"
              @click="leftCollapsed = true"
            ><span class="panel-collapse-handle-arrow">‹</span></button>
            <div class="palette-toolbar">
              <div class="palette-tabs">
                <button
                  type="button"
                  class="palette-tab-btn"
                  :class="{ active: paletteTab === 'tool' }"
                  @click="paletteTab = 'tool'"
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/TaskPane.vue
物理行数：63（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
这是一个网页，按<span style="font-weight: bolder">"F12"</span>可以打开调试器。 Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="global">
        <div class="divItem">
          这是一个网页，按<span style="font-weight: bolder">"F12"</span>可以打开调试器。
        </div>
        <div class="divItem">
          这个示例展示了wps加载项的相关基础能力，与B/S业务系统的交互，请用浏览器打开：
          <span style="font-weight: bolder; color: slateblue; cursor: pointer" @click="onOpenWeb()">{{
            DemoSpan
          }}</span>
        </div>
        <div class="divItem">
          开发文档:
          <span style="font-weight: bolder; color: slateblue">https://open.wps.cn/docs/office</span>
        </div>
        <hr />
        <div class="divItem">
          <button style="margin: 3px" @click="onbuttonclick('dockLeft')">停靠左边</button>
          <button style="margin: 3px" @click="onbuttonclick('dockRight')">停靠右边</button>
          <button style="margin: 3px" @click="onbuttonclick('hideTaskPane')">隐藏TaskPane</button>
          <button style="margin: 3px" @click="onbuttonclick('addString')">文档开头添加字符串</button>
          <button style="margin: 3px" @click="onDocNameClick()">取文件名</button>
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/TaskPaneBottom.vue
物理行数：36（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
文档文件名为：<span>{{ docName }}</span> Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="taskpane-bottom">
        <div class="header">
          <h2>底部任务窗口</h2>
        </div>
        <div class="content">
          <p>这是底部任务窗口界面</p>
          <div class="divItem">
            <button style="margin: 3px" @click="onDocNameClick()">获取文档名称</button>
          </div>
          <div class="divItem">
            文档文件名为：<span>{{ docName }}</span>
          </div>
        </div>
      </div>
    </template>
    
    <script>
    import taskPane from './js/taskpane.js'
    export default {
      name: 'TaskPaneBottom',
      data() {
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/TaskPaneLeft.vue
物理行数：36（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
文档文件名为：<span>{{ docName }}</span> Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="taskpane-left">
        <div class="header">
          <h2>左侧任务窗口</h2>
        </div>
        <div class="content">
          <p>这是左侧任务窗口界面</p>
          <div class="divItem">
            <button style="margin: 3px" @click="onDocNameClick()">获取文档名称</button>
          </div>
          <div class="divItem">
            文档文件名为：<span>{{ docName }}</span>
          </div>
        </div>
      </div>
    </template>
    
    <script>
    import taskPane from './js/taskpane.js'
    export default {
      name: 'TaskPaneLeft',
      data() {
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/TaskPaneRight.vue
物理行数：1713（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
正在加载书签... Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="taskpane-right">
        <!-- 表单模式：右侧始终显示表单编辑框，根据文档中光标所在书签动态切换内容 -->
        <div v-if="isFormMode" class="form-edit-panel">
          <!-- 左侧书签列表区域 -->
          <div class="bookmark-left" :style="{ width: bookmarkWidth > 0 ? bookmarkWidth + 'px' : '32%', display: bookmarkCollapsed ? 'none' : 'flex' }">
            <div class="bookmark-header">
              <span class="bookmark-title">书签列表</span>
              <button class="btn-collapse" @click="toggleBookmarkCollapse" title="折叠/展开">
                <svg viewBox="0 0 24 24" width="16" height="16" :class="{ rotated: bookmarkCollapsed }">
                  <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                </svg>
              </button>
            </div>
            <div class="bookmark-body">
              <div v-if="bookmarksLoading" class="loading">
                正在加载书签...
              </div>
              <div v-else-if="!bookmarks || bookmarks.length === 0" class="empty-hint">
                暂无书签
              </div>
              <div v-else class="bookmark-list-wrapper">
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/TaskPaneTop.vue
物理行数：36（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
文档文件名为：<span>{{ docName }}</span> Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="taskpane-top">
        <div class="header">
          <h2>顶部任务窗口</h2>
        </div>
        <div class="content">
          <p>这是顶部任务窗口界面</p>
          <div class="divItem">
            <button style="margin: 3px" @click="onDocNameClick()">获取文档名称</button>
          </div>
          <div class="divItem">
            文档文件名为：<span>{{ docName }}</span>
          </div>
        </div>
      </div>
    </template>
    
    <script>
    import taskPane from './js/taskpane.js'
    export default {
      name: 'TaskPaneTop',
      data() {
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/TaskProgressDialog.vue
物理行数：933（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
v-if="taskId" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="task-progress-dialog">
        <div class="header">
          <div class="header-main">
            <div class="title-row">
              <h2>{{ task?.title || '任务进度' }}</h2>
              <span class="status-badge" :class="status">{{ statusBadgeText }}</span>
            </div>
            <p class="header-subtitle">{{ headerSubtitle }}</p>
          </div>
          <div class="header-actions">
            <button
              v-if="taskId"
              type="button"
              class="icon-btn"
              :title="showDetails ? '收起处理详情' : '查看处理详情'"
              :aria-label="showDetails ? '收起处理详情' : '查看处理详情'"
              @click="toggleDetails"
            >
              <svg v-if="!showDetails" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 5c5.5 0 9.5 4.5 10.5 6c-1 1.5-5 6-10.5 6S2.5 12.5 1.5 11C2.5 9.5 6.5 5 12 5m0 2C8.73 7 5.94 9.38 4.13 11C5.94 12.62 8.73 15 12 15s6.06-2.38 7.87-4C18.06 9.38 15.27 7 12 7m0 1.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 0 1 0-5"/></svg>
              <svg v-else viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M19 13H5v-2h14z"/></svg>
            </button>
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/TemplateCreate.vue
物理行数：513（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
v-model="searchText" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="template-create">
        <div class="toolbar">
          <div class="search-wrap">
            <input
              v-model="searchText"
              class="search-input"
              placeholder="按名称、标签搜索..."
              type="text"
            />
          </div>
          <div class="btn-group">
            <button class="btn btn-primary" @click="openAddForm">
              <span class="icon">+</span> 添加
            </button>
            <button class="btn btn-secondary" @click="openSmartExtract">
              智能提取
            </button>
            <button class="btn btn-secondary" :disabled="!selectedId" @click="openEditForm">
              修改
            </button>
            <button class="btn btn-danger" :disabled="!selectedId" @click="deleteSelected">
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/TemplateDownloadDialog.vue
物理行数：173（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
v-for="t in templates" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="template-download-dialog">
        <div class="dialog-header">
          <h3>下载模板</h3>
          <button class="btn-close" @click="onClose">×</button>
        </div>
        <div class="dialog-body">
          <p class="select-desc">从列表中选择一个模板，点击确定后选择保存位置</p>
          <div class="template-list">
            <div
              v-for="t in templates"
              :key="t.id"
              class="template-item"
              :class="{ selected: selectedId === t.id }"
              :title="t.path"
              @click="selectedId = t.id"
            >
              <span class="item-name">{{ t.name }}</span>
            </div>
            <div v-if="!templates.length" class="empty-hint">
              暂无模板，请先在「导入模板」中添加 .aidocx 模板
            </div>
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/TemplateExportDialog.vue
物理行数：306（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
v-model="searchText" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="template-export-dialog">
        <div class="dialog-header">
          <h3>导出规则</h3>
          <button class="btn-close" @click="onCancel">×</button>
        </div>
        <div class="dialog-body">
          <div class="search-wrap">
            <input
              v-model="searchText"
              class="search-input"
              placeholder="按名称、标签搜索..."
              type="text"
            />
          </div>
          <div class="toolbar">
            <label class="select-all-label">
              <input
                type="checkbox"
                :checked="isAllFilteredSelected"
                :indeterminate="isSomeFilteredSelected"
                @change="toggleSelectAll"
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/TemplateFieldExtractDialog.vue
物理行数：539（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
v-if="extractionTaskId" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="template-field-extract-dialog">
        <div class="popup-header">
          <div class="header-main">
            <h2>智能提取</h2>
            <p class="subtitle">提取结果先以列表展示，字段编辑与新增统一使用弹窗，确认后再写入规则和书签。</p>
          </div>
          <div class="header-actions">
            <button
              v-if="extractionTaskId"
              type="button"
              class="btn btn-secondary"
              @click="openTaskProgress(extractionTaskId)"
            >查看进度</button>
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="loading || saving"
              @click="retryExtract"
            >{{ loading ? '提取中...' : '重试提取' }}</button>
          </div>
        </div>
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/TemplateFormDialog.vue
物理行数：320（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
{{ opt.label }} Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="template-form-dialog">
        <div class="dialog-body">
          <div class="form-group">
            <label>书签名称 <span class="required">*</span></label>
            <input v-model="form.name" :readonly="isDetail" placeholder="如：姓名、合同编号、签署日期" />
            <p class="hint">填写该项的显示名称，将作为标签的一部分</p>
          </div>
          <div class="form-group">
            <label>语义键</label>
            <input v-model="form.semanticKey" :readonly="isDetail" placeholder="如：partyA、contractAmount" />
            <p class="hint">用于把同类字段按语义归并，建议使用稳定英文键名。</p>
          </div>
          <div class="form-group">
            <label>填写提示</label>
            <input v-model="form.fillHint" :readonly="isDetail" placeholder="填写时给用户的提示语，如格式说明" />
          </div>
          <div class="form-group">
            <label>标签</label>
            <input v-model="form.tag" :readonly="isDetail" placeholder="如：合同, 客户（英文逗号分隔，便于搜索）" />
            <p class="hint">多个标签用英文逗号分隔，用于分类和搜索</p>
          </div>
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/TemplateImportDialog.vue
物理行数：149（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
ref="fileInputRef" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
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
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/UniformImageFormatDialog.vue
物理行数：439（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
id="img-width" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
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
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/components/UnusedStylesCleanerDialog.vue
物理行数：223（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
type="checkbox" Vue 单文件组件：界面与业务片段。
以下为该文件开头的若干行：
    <template>
      <div class="unused-styles-cleaner-dialog">
        <div class="dialog-header-compact">
          <button class="btn-close" @click="onCancel">×</button>
        </div>
        <div class="dialog-body">
          <div v-if="loading" class="loading">
            <div>正在扫描未使用的样式...</div>
            <div v-if="progressText" class="progress-text">{{ progressText }}</div>
          </div>
          <div v-else-if="error" class="error">{{ error }}</div>
          <div v-else>
            <p class="hint">以下样式在文档中未被任何段落使用，可勾选后清除。</p>
            <div v-if="unusedList.length > 0" class="select-all-row">
              <label class="select-all-label">
                <input
                  type="checkbox"
                  :checked="isAllSelected"
                  :indeterminate="isIndeterminate"
                  @change="toggleSelectAll"
                />
                <span>全选</span>
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/aiAssistantSelfIntro.js
物理行数：1176（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const DIRECT_IDENTITY_PATTERNS = [ 工具与业务子模块。
以下为该文件开头的若干行：
    import { resolveAssistantCapabilityFaq } from './assistantCapabilityFaq.js'
    
    const DIRECT_IDENTITY_PATTERNS = [
      /\bwho\s+are\s+you\b/i,
      /\bwhat\s+are\s+you\b/i,
      /\bintroduce\s+yourself\b/i,
      /\btell\s+me\s+about\s+yourself\b/i,
      /\bwhat\s+can\s+you\s+do\b/i,
      /\bwho\s+(built|made|developed)\s+you\b/i,
      /\bwho\s+(built|made|developed)\s+this\s+(app|tool|program|assistant|plugin)\b/i,
      /\bwhat\s+is\s+this\s+(app|tool|program|assistant|plugin)\b/i,
      /\bare\s+you\s+(chatgpt|gpt|claude|deepseek|gemini|kimi|qwen)\b/i,
      /你是谁/,
      /你是(谁|什么)/,
      /你(是|是不是).{0,8}(chatgpt|gpt|claude|deepseek|kimi|gemini|豆包|通义千问|文心一言|元宝|混元|智谱)/i,
      /介绍一下你自己/,
      /介绍下你自己/,
      /介绍你自己/,
      /介绍一下你/,
      /介绍下你/,
      /说说你自己/,
      /讲讲你自己/,
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/aiAssistantWelcomePrompts.js
物理行数：137（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const CONFIGURED_OPENINGS = [ 工具与业务子模块。
以下为该文件开头的若干行：
    const CONFIGURED_OPENINGS = [
      '欢迎使用察元 AI 文档助手。',
      '欢迎回来，察元 AI 文档助手已准备就绪。',
      '你好，我是察元 AI 文档助手。',
      '欢迎来到察元 AI 文档助手。',
      '察元 AI 文档助手已启动。',
      '今天也由察元 AI 文档助手陪你处理文档。',
      '欢迎进入察元 AI 文档助手。',
      '当前智能写作能力已准备完成。'
    ]
    
    const CONFIGURED_ABILITIES = [
      '我可以帮你编写文档、润色内容、修改错别字，也能协助审核与优化表达。',
      '无论是写材料、改方案，还是统一现有文本风格，我都可以继续协助你完成。',
      '你可以让我起草通知、总结、请示、方案，也可以直接修改当前文档内容。',
      '我可以帮你生成初稿、整理结构、提炼重点，并让表达更清晰、更正式。',
      '写作、润色、校对、审阅、改写，都可以从一句简单的话开始。',
      '我既能帮你处理内容，也能按自然语言执行常见格式修改。',
      '当前文档、选中内容和附件信息都可以成为参考上下文，帮助我给出更贴近场景的结果。',
      '从阅读理解到结果输出，我会尽量把写作、分析、修改这些动作串成连续流程。'
    ]
    
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/artifactRenderer.js
物理行数：217（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
function normalizeString(value, fallback = '') { 工具与业务子模块。
以下为该文件开头的若干行：
    import * as XLSX from 'xlsx'
    import { createArtifactRecord } from './artifactTypes.js'
    
    function normalizeString(value, fallback = '') {
      const normalized = String(value || '').trim()
      return normalized || fallback
    }
    
    function safeJsonParse(raw, fallback = null) {
      if (raw == null || raw === '') return fallback
      if (typeof raw === 'object') return raw
      try {
        return JSON.parse(String(raw))
      } catch (_) {
        return fallback
      }
    }
    
    function parseDelimitedText(text = '') {
      const normalized = String(text || '').trim()
      if (!normalized) return []
      const lines = normalized.split(/\r?\n/).filter(Boolean)
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/artifactStore.js
物理行数：144（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const STORAGE_KEY = 'assistantArtifactStore' 工具与业务子模块。
以下为该文件开头的若干行：
    import { normalizeArtifactList } from './artifactTypes.js'
    
    const STORAGE_KEY = 'assistantArtifactStore'
    const ARCHIVE_LIMIT = 300
    
    function getApplication() {
      return window.Application || window.opener?.Application || window.parent?.Application || null
    }
    
    function safeParse(raw, fallback = null) {
      if (!raw) return fallback
      if (typeof raw === 'object') return raw
      try {
        return JSON.parse(String(raw))
      } catch (_) {
        return fallback
      }
    }
    
    function getStorageBucket() {
      const app = getApplication()
      const localRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : ''
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/artifactTypes.js
物理行数：156（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const DEFAULT_STATUS = 'ready' 工具与业务子模块。
以下为该文件开头的若干行：
    const DEFAULT_STATUS = 'ready'
    
    function randomId(prefix = 'artifact') {
      return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    }
    
    function normalizeString(value, fallback = '') {
      const normalized = String(value || '').trim()
      return normalized || fallback
    }
    
    function normalizeNumber(value, fallback = 0) {
      const numeric = Number(value)
      return Number.isFinite(numeric) ? numeric : fallback
    }
    
    function normalizeStringList(list = []) {
      return (Array.isArray(list) ? list : [])
        .map(item => normalizeString(item))
        .filter(Boolean)
    }
    
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/assistantCapabilityFaq.js
物理行数：277（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const CAPABILITY_QUESTION_PATTERNS = [ 工具与业务子模块。
以下为该文件开头的若干行：
    import { createDefaultReportSettings } from './reportSettings.js'
    
    const CAPABILITY_QUESTION_PATTERNS = [
      /(能不能|能否|可不可以|是否可以|支不支持|是否支持|能否支持).{0,24}/,
      /(怎么做|如何做|怎么实现|如何实现|怎么配置|如何配置|怎么设置|如何设置|怎么建立|如何建立).{0,24}(助手|功能|流程|模板|报告|审计|文档|批注|摘要|翻译|检查|生成)/,
      /(能不能帮我做|能否帮我做|可不可以帮我做).{0,40}/,
      /^(支持|实现|配置|建立).{0,24}(吗|么|呢)?$/,
      /\bcan\s+you\s+(do|handle|support|build|create)\b/i,
      /\bhow\s+to\s+(do|configure|set\s+up|build|create)\b/i,
      /\bis\s+it\s+possible\s+to\b/i,
      /\bdoes\s+it\s+support\b/i
    ]
    
    const EXECUTION_REQUEST_PATTERNS = [
      /^(帮我|请帮我|直接帮我|现在帮我|马上帮我|立即帮我).{0,80}/,
      /^(请|帮我|直接).{0,60}(生成|写|改|润色|总结|翻译|检查|分析|提取|审查|处理)/,
      /(给我|替我).{0,30}(生成|写|改|润色|总结|翻译|检查|分析|提取|审查|处理)/,
      /\bplease\s+(write|generate|translate|summarize|review|analyze|edit)\b/i
    ]
    
    const ASSISTANT_CREATION_HINT_VARIANTS = [
      '如果上面这些能力还不够贴合你的要求，你可以直接告诉我你的具体需要，我可以继续帮你新建一个专用助手来适配。',
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/assistantEvaluationService.js
物理行数：356（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
function normalizeString(value, fallback = '') { 工具与业务子模块。
以下为该文件开头的若干行：
    import { chatCompletion } from './chatApi.js'
    
    function normalizeString(value, fallback = '') {
      const normalized = String(value || '').trim()
      return normalized || fallback
    }
    
    function tokenizeText(value = '') {
      return Array.from(new Set(
        String(value || '')
          .toLowerCase()
          .match(/[\u4e00-\u9fa5a-z0-9]{2,}/g) || []
      ))
    }
    
    function computeTokenOverlap(left = '', right = '') {
      const leftTokens = tokenizeText(left)
      const rightTokens = tokenizeText(right)
      if (leftTokens.length === 0 || rightTokens.length === 0) return 0
      const rightSet = new Set(rightTokens)
      const matched = leftTokens.filter(token => rightSet.has(token)).length
      return matched / Math.max(1, Math.min(leftTokens.length, rightTokens.length))
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/assistantPrefillDraftStore.js
物理行数：83（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const ASSISTANT_PREFILL_DRAFT_STORAGE_KEY = 'assistant_create_prefill_draft' 工具与业务子模块。
以下为该文件开头的若干行：
    const ASSISTANT_PREFILL_DRAFT_STORAGE_KEY = 'assistant_create_prefill_draft'
    
    function getStorage() {
      const app = window.Application || window.opener?.Application || window.parent?.Application
      if (app?.PluginStorage) {
        return {
          getItem(key) {
            return app.PluginStorage.getItem(key)
          },
          setItem(key, value) {
            app.PluginStorage.setItem(key, value)
          },
          removeItem(key) {
            app.PluginStorage.removeItem(key)
          }
        }
      }
      if (typeof localStorage !== 'undefined') {
        return localStorage
      }
      return null
    }
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/assistantPromptRecommendationService.js
物理行数：529（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
INPUT_SOURCE_OPTIONS, 工具与业务子模块。
以下为该文件开头的若干行：
    import { chatCompletion } from './chatApi.js'
    import { addTask, updateTask } from './taskListStore.js'
    import { createCustomAssistantDraft } from './assistantSettings.js'
    import {
      INPUT_SOURCE_OPTIONS,
      OUTPUT_FORMAT_OPTIONS,
      DOCUMENT_ACTION_OPTIONS,
      ASSISTANT_DISPLAY_LOCATION_OPTIONS
    } from './assistantRegistry.js'
    import {
      createDefaultReportSettings,
      DEFAULT_REPORT_TEMPLATE,
      REPORT_TYPE_OPTIONS,
      normalizeReportSettings
    } from './reportSettings.js'
    
    export const ASSISTANT_PROMPT_RECOMMENDATION_ASSISTANT_ID = 'settings.custom-assistant-recommendation'
    export const ASSISTANT_PROMPT_RECOMMENDATION_TASK_TYPE = 'assistant-prompt-recommendation'
    
    const activeRecommendationRuns = new Map()
    const VALID_INPUT_SOURCES = new Set(INPUT_SOURCE_OPTIONS.map(item => item.value))
    const VALID_OUTPUT_FORMATS = new Set(OUTPUT_FORMAT_OPTIONS.map(item => item.value))
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/assistantRecommendationApplyBridge.js
物理行数：60（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const STORAGE_KEY = 'NdAssistantRecommendationApplyRequest' 工具与业务子模块。
以下为该文件开头的若干行：
    const STORAGE_KEY = 'NdAssistantRecommendationApplyRequest'
    
    function readStorageJson(key) {
      try {
        const raw = window.localStorage.getItem(key)
        return raw ? JSON.parse(raw) : null
      } catch (_) {
        return null
      }
    }
    
    function writeStorageJson(key, value) {
      try {
        const serialized = JSON.stringify(value)
        window.localStorage.setItem(key, serialized)
        try {
          window.Application?.PluginStorage?.setItem(key, serialized)
        } catch (_) {}
        return true
      } catch (_) {
        return false
      }
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/assistantRegressionSampleStore.js
物理行数：173（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const STORAGE_KEY = 'assistantRegressionSampleStore' 工具与业务子模块。
以下为该文件开头的若干行：
    import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'
    
    const STORAGE_KEY = 'assistantRegressionSampleStore'
    const ARCHIVE_LIMIT = 120
    const TEMPLATE_VERSION = '1.0.0'
    
    function normalizeString(value, fallback = '') {
      const normalized = String(value || '').trim()
      return normalized || fallback
    }
    
    function safeClone(value, fallback = null) {
      if (value == null) return fallback
      try {
        return JSON.parse(JSON.stringify(value))
      } catch (_) {
        return fallback
      }
    }
    
    export function createRegressionSampleRecord(record = {}) {
      const now = new Date().toISOString()
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/assistantRegressionService.js
物理行数：203（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
buildAssistantEvaluationSamples, 工具与业务子模块。
以下为该文件开头的若干行：
    import { getFlatModelsFromSettings } from './modelSettings.js'
    import {
      buildAssistantEvaluationSamples,
      buildAssistantRealComparison,
      evaluateAssistantCandidate
    } from './assistantEvaluationService.js'
    import { appendEvaluationRecord, createEvaluationRecord } from './evaluationStore.js'
    import { getAssistantVersionById, listAssistantVersions } from './assistantVersionStore.js'
    import { listRegressionSamples } from './assistantRegressionSampleStore.js'
    
    function normalizeString(value, fallback = '') {
      const normalized = String(value || '').trim()
      return normalized || fallback
    }
    
    function pickRegressionModel() {
      return getFlatModelsFromSettings('chat')[0] || null
    }
    
    function getVersionSnapshot(record = {}) {
      return record?.snapshot && typeof record.snapshot === 'object' ? record.snapshot : {}
    }
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/assistantRepairService.js
物理行数：88（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
function normalizeString(value, fallback = '') { 工具与业务子模块。
以下为该文件开头的若干行：
    import { chatCompletion } from './chatApi.js'
    
    function normalizeString(value, fallback = '') {
      const normalized = String(value || '').trim()
      return normalized || fallback
    }
    
    function parseJsonCandidate(raw) {
      const text = String(raw || '').trim()
      if (!text) return null
      const block = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
      const candidate = block?.[1] ? block[1].trim() : text
      const tryParse = (value) => {
        try {
          return JSON.parse(value)
        } catch (_) {
          return null
        }
      }
      const direct = tryParse(candidate)
      if (direct) return direct
      const start = candidate.indexOf('{')
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/assistantStructuredPipeline.js
物理行数：1024（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
collectMatchPositions, 工具与业务子模块。
以下为该文件开头的若干行：
    import { findIssueRangeDetailed } from './spellCheckService.js'
    import {
      collectMatchPositions,
      mapChunkRelativeRangeToAbsolute,
      mapNormalizedRangeToRaw,
      normalizeTextWithIndexMap
    } from './documentPositionUtils.js'
    import {
      ANALYSIS_AI_TRACE_CHECK_ID,
      ANALYSIS_SECRET_KEYWORD_EXTRACT_ID,
      ANALYSIS_SECURITY_CHECK_ID,
      extractHitFragmentsFromSecurityCheckMarkdown,
      getStructuredJsonAnchorExtraRules
    } from './structuredCommentPolicy.js'
    
    export const STRUCTURED_PIPELINE_SCHEMA_VERSION = '2026-03-structured-batch-v1'
    
    /** 仅内置「拼写与语法检查」需结构化 JSON 精确定位；「纠正拼写和语法」走与普通助手相同的单次/分段 plain 链路 */
    const REVISION_ASSISTANTS = new Set([
      'spell-check'
    ])
    
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/assistantVersionStore.js
物理行数：168（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const STORAGE_KEY = 'assistantVersionStore' 工具与业务子模块。
以下为该文件开头的若干行：
    import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'
    import { getCustomAssistants, saveCustomAssistants } from './assistantSettings.js'
    import { appendEvaluationRecord, buildAssistantVersionEvaluationRecord } from './evaluationStore.js'
    
    const STORAGE_KEY = 'assistantVersionStore'
    
    function normalizeString(value, fallback = '') {
      const normalized = String(value || '').trim()
      return normalized || fallback
    }
    
    function safeParseList(value) {
      return Array.isArray(value) ? value.filter(Boolean) : []
    }
    
    function safeNumber(value, fallback = null) {
      const numeric = Number(value)
      return Number.isFinite(numeric) ? numeric : fallback
    }
    
    export function getAssistantVersionStore() {
      const settings = loadGlobalSettings()
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/attachmentTextParser.js
物理行数：161（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
function normalizeText(value) { 工具与业务子模块。
以下为该文件开头的若干行：
    function normalizeText(value) {
      return String(value || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    }
    
    function getFileName(file) {
      return String(file?.name || '').trim()
    }
    
    function getExtension(file) {
      const name = getFileName(file).toLowerCase()
      const match = name.match(/\.([a-z0-9]+)$/i)
      return match?.[1] || ''
    }
    
    function isDocxLike(file) {
      const ext = getExtension(file)
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/capabilityAuditStore.js
物理行数：155（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const STORAGE_KEY = 'NdCapabilityAuditStore' 工具与业务子模块。
以下为该文件开头的若干行：
    const STORAGE_KEY = 'NdCapabilityAuditStore'
    const ARCHIVE_LIMIT = 400
    
    function getApplication() {
      return window.Application || window.opener?.Application || window.parent?.Application || null
    }
    
    function safeParse(raw, fallback = null) {
      if (!raw) return fallback
      if (typeof raw === 'object') return raw
      try {
        return JSON.parse(String(raw))
      } catch (_) {
        return fallback
      }
    }
    
    function normalizeString(value, fallback = '') {
      const normalized = String(value || '').trim()
      return normalized || fallback
    }
    
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/capabilityBus.js
物理行数：406（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
executeUtilityCapabilityDirect, 工具与业务子模块。
以下为该文件开头的若干行：
    import { getWpsCapabilityCatalog, getWpsCapabilityByKey } from './wpsCapabilityCatalog.js'
    import { executeWpsCapabilityDirect } from './wpsCapabilityExecutor.js'
    import {
      executeUtilityCapabilityDirect,
      getUtilityCapabilityByKey,
      getUtilityCapabilityCatalog
    } from './utilityCapabilityNamespace.js'
    import { appendCapabilityAuditRecord } from './capabilityAuditStore.js'
    import { evaluateCapabilityPolicy, inferCapabilityRiskLevel } from './capabilityPolicyStore.js'
    import { appendCapabilityQuotaUsage, evaluateCapabilityQuota } from './capabilityQuotaStore.js'
    
    function normalizeString(value, fallback = '') {
      const normalized = String(value || '').trim()
      return normalized || fallback
    }
    
    function parseParamsCandidate(raw) {
      if (!raw) return {}
      if (typeof raw === 'object' && !Array.isArray(raw)) return raw
      try {
        const parsed = JSON.parse(String(raw))
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/capabilityPolicyStore.js
物理行数：313（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const STORAGE_KEY = 'capabilityPolicyStore' 工具与业务子模块。
以下为该文件开头的若干行：
    import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'
    
    const STORAGE_KEY = 'capabilityPolicyStore'
    
    function normalizeString(value, fallback = '') {
      const normalized = String(value || '').trim()
      return normalized || fallback
    }
    
    function safeClone(value, fallback) {
      if (value == null) return fallback
      try {
        return JSON.parse(JSON.stringify(value))
      } catch (_) {
        return fallback
      }
    }
    
    const HIGH_RISK_CATEGORIES = new Set([
      'document-file',
      'document-security'
    ])
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/capabilityQuotaStore.js
物理行数：147（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const STORAGE_KEY = 'capabilityQuotaUsageStore' 工具与业务子模块。
以下为该文件开头的若干行：
    import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'
    
    const STORAGE_KEY = 'capabilityQuotaUsageStore'
    const MAX_EVENTS_PER_KEY = 240
    
    function normalizeString(value, fallback = '') {
      const normalized = String(value || '').trim()
      return normalized || fallback
    }
    
    function normalizeLimit(value) {
      const numeric = Number(value)
      return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0
    }
    
    function getNowIso() {
      return new Date().toISOString()
    }
    
    function buildQuotaKey(namespace = 'wps', capabilityKey = '') {
      const normalizedNamespace = normalizeString(namespace, 'wps')
      const normalizedCapabilityKey = normalizeString(capabilityKey)
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/chatContextBuilder.js
物理行数：197（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
function normalizeString(value, fallback = '') { 工具与业务子模块。
以下为该文件开头的若干行：
    import { buildChatMemoryContext, listChatMemoryRecords, markChatMemoryRecordsUsed } from './chatMemoryStore.js'
    
    function normalizeString(value, fallback = '') {
      const normalized = String(value || '').trim()
      return normalized || fallback
    }
    
    function getMessageTextLength(message = {}) {
      return normalizeString(message?.content).length
    }
    
    function truncateText(text = '', maxLength = 240) {
      const normalized = normalizeString(text)
      if (!normalized) return ''
      return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized
    }
    
    function buildSummaryMessage(earlierMessages = [], options = {}) {
      const maxEntries = Math.max(1, Number(options.maxEntries || 12))
      const maxLength = Math.max(400, Number(options.maxLength || 2200))
      const lines = earlierMessages
        .filter(item => normalizeString(item?.content))
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/chatMemoryStore.js
物理行数：142（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const STORAGE_KEY = 'NdChatMemoryStore' 工具与业务子模块。
以下为该文件开头的若干行：
    const STORAGE_KEY = 'NdChatMemoryStore'
    const ARCHIVE_LIMIT = 80
    
    function getApplication() {
      return window.Application || window.opener?.Application || window.parent?.Application || null
    }
    
    function safeParse(raw, fallback = null) {
      if (!raw) return fallback
      if (typeof raw === 'object') return raw
      try {
        return JSON.parse(String(raw))
      } catch (_) {
        return fallback
      }
    }
    
    function normalizeString(value, fallback = '') {
      const normalized = String(value || '').trim()
      return normalized || fallback
    }
    
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/chunkSettings.js
物理行数：133（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
/**；* 段落截取设置 - 大文档分批处理（翻译、检查等）时的分块参数；* 用于文档超过模型上下文限制时，按段落/字符分块并带重叠，保证上下文连贯；*/ 工具与业务子模块。
以下为该文件开头的若干行：
    /**
     * 段落截取设置 - 大文档分批处理（翻译、检查等）时的分块参数
     * 用于文档超过模型上下文限制时，按段落/字符分块并带重叠，保证上下文连贯
     */
    
    import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'
    
    const DEFAULT_CHUNK_LENGTH = 4000
    const DEFAULT_OVERLAP_LENGTH = 200
    const MIN_CHUNK_LENGTH = 500
    const MAX_CHUNK_LENGTH = 16000
    const MIN_OVERLAP = 0
    const MAX_OVERLAP_RATIO = 0.5
    
    /**
     * 获取段落截取配置
     * @returns {{ chunkLength: number, overlapLength: number, splitStrategy: string }}
     */
    export function getChunkSettings() {
      const settings = loadGlobalSettings()
      const raw = settings.chunkSettings
      if (!raw || typeof raw !== 'object') {
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/dataPathSettings.js
物理行数：523（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
/**；* 数据路径设置 - 所有本地数据统一保存到此路径；* 存储于固定位置的配置文件（使用文件系统），下次加载时自动读取；*/ 工具与业务子模块。
以下为该文件开头的若干行：
    /**
     * 数据路径设置 - 所有本地数据统一保存到此路径
     * 存储于固定位置的配置文件（使用文件系统），下次加载时自动读取
     */
    
    const STORAGE_KEY = 'NdDataPath'
    const CONFIG_FILE_NAME = 'chayuan_data_path.txt'
    
    function getApplication() {
      return window.Application || window.opener?.Application || window.parent?.Application || null
    }
    
    /**
     * 检测操作系统类型
     */
    function detectOS() {
      // Windows: 通过 ActiveXObject 检测（仅 IE/Windows 特有）
      if (typeof ActiveXObject !== 'undefined') {
        return 'windows'
      }
      
      // Mac: 通过 navigator.platform 或 userAgent 检测
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentBackupStore.js
物理行数：232（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const STORAGE_KEY = 'NdDocumentBackups' 工具与业务子模块。
以下为该文件开头的若干行：
    import { ensureDir, getEffectiveDataDir, pathJoin, pathSep } from './dataPathSettings.js'
    import { getActiveDocument, getApplication } from './documentActions.js'
    import { getCurrentDocumentSavePath, saveActiveDocument } from './documentFileActions.js'
    import { copyFile } from './documentTemplates.js'
    
    const STORAGE_KEY = 'NdDocumentBackups'
    const STORAGE_VERSION = 1
    const ARCHIVE_LIMIT = 120
    
    function normalizePath(path) {
      return String(path || '')
        .replace(/^file:\/\/\/?/i, '')
        .replace(/\\/g, '/')
        .replace(/\/+/g, '/')
        .trim()
    }
    
    function getFileNameWithoutExtension(fileName = '') {
      const normalized = String(fileName || '').trim()
      const lastDot = normalized.lastIndexOf('.')
      if (lastDot <= 0) return normalized || 'document'
      return normalized.slice(0, lastDot)
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentDeclassifyCrypto.js
物理行数：171（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const PASSWORD_MIN_LENGTH = 8 工具与业务子模块。
以下为该文件开头的若干行：
    const PASSWORD_MIN_LENGTH = 8
    const UPPERCASE_REGEX = /[A-Z]/
    const LOWERCASE_REGEX = /[a-z]/
    const DIGIT_REGEX = /\d/
    const SPECIAL_CHAR_REGEX = /[^A-Za-z0-9]/
    const DEFAULT_PBKDF2_ITERATIONS = 210000
    
    function getCryptoApi() {
      const cryptoApi = globalThis.crypto || window?.crypto || null
      if (!cryptoApi?.subtle) {
        throw new Error('当前环境不支持 Web Crypto，无法执行脱密加密')
      }
      return cryptoApi
    }
    
    function toUint8Array(value) {
      if (value instanceof Uint8Array) return value
      return new Uint8Array(value)
    }
    
    function bytesToBase64(bytes) {
      const view = toUint8Array(bytes)
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentDeclassifyService.js
物理行数：903（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
decryptPayload, 工具与业务子模块。
以下为该文件开头的若干行：
    import { chatCompletion } from './chatApi.js'
    import { getActiveDocument, getDocumentText } from './documentActions.js'
    import { addTask, updateTask } from './taskListStore.js'
    import { getBuiltinAssistantDefinition } from './assistantRegistry.js'
    import { getAssistantSetting, getConfiguredAssistantModelId } from './assistantSettings.js'
    import {
      decryptPayload,
      encryptPayload,
      fingerprintText,
      validateDeclassifyPassword
    } from './documentDeclassifyCrypto.js'
    import { getFlatModelsFromSettings, parseModelCompositeId } from './modelSettings.js'
    import { inferModelType } from './modelTypeUtils.js'
    import {
      clearDeclassifyState,
      getDeclassifyEnvelope,
      getDeclassifyState,
      invalidateDeclassifyRibbonControls,
      isDocumentDeclassified,
      saveDeclassifyState
    } from './documentDeclassifyStore.js'
    
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentDeclassifyStore.js
物理行数：117（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
export const DECLASSIFY_STATE_VAR_NAME = 'NdDeclassifyState' 工具与业务子模块。
以下为该文件开头的若干行：
    import { getActiveDocument, getApplication } from './documentActions.js'
    
    export const DECLASSIFY_STATE_VAR_NAME = 'NdDeclassifyState'
    export const DECLASSIFY_PAYLOAD_VAR_NAME = 'NdDeclassifyPayloadV1'
    export const DECLASSIFY_STATE_VERSION = 1
    
    function readVariable(doc, name) {
      if (!doc?.Variables || !name) return ''
      try {
        const variable = doc.Variables.Item(name)
        return String(variable?.Value || '')
      } catch (_) {
        return ''
      }
    }
    
    function writeVariable(doc, name, value) {
      if (!doc?.Variables || !name) {
        throw new Error('当前文档不支持保存脱密元数据')
      }
      const serialized = String(value ?? '')
      try {
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentDeleteActions.js
物理行数：525（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const SCOPE_LABELS = { 工具与业务子模块。
以下为该文件开头的若干行：
    import { getApplication } from './documentActions.js'
    
    const SCOPE_LABELS = {
      selection: '当前选择范围',
      paragraph: '当前段落',
      document: '全文'
    }
    
    const TARGET_LABELS = {
      selection: '选中内容',
      paragraph: '当前段落',
      document: '全文',
      table: '表格',
      image: '图片',
      comment: '批注',
      'paragraph-index': '指定段落'
    }
    
    function normalizeText(text) {
      return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    }
    
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentEmbeddedObjectService.js
物理行数：169（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
function getApplication() { 工具与业务子模块。
以下为该文件开头的若干行：
    function getApplication() {
      return window.Application || window.opener?.Application || window.parent?.Application || null
    }
    
    function safeCall(getter, fallback = null) {
      try {
        const value = getter()
        return value == null ? fallback : value
      } catch (_) {
        return fallback
      }
    }
    
    function getFileSystem() {
      return getApplication()?.FileSystem || null
    }
    
    function normalizePath(value) {
      return String(value || '').replace(/^file:\/\//i, '').trim()
    }
    
    function getPathExtension(path) {
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentFileActions.js
物理行数：143（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
function normalizePath(path) { 工具与业务子模块。
以下为该文件开头的若干行：
    import { getActiveDocument, getApplication } from './documentActions.js'
    
    function normalizePath(path) {
      return String(path || '').replace(/^file:\/\/\/?/i, '').replace(/\\/g, '/').trim()
    }
    
    function getDocumentDefaultFileName(doc, fallbackExtension = 'docx') {
      let docName = String(doc?.Name || '文档').trim() || '文档'
      const lastDot = docName.lastIndexOf('.')
      if (lastDot > 0) {
        docName = docName.slice(0, lastDot)
      }
      return `${docName}.${String(fallbackExtension || 'docx').replace(/^\.+/, '')}`
    }
    
    function getDocumentFormat(doc) {
      const app = getApplication()
      const extension = String(doc?.Name || '').split('.').pop().toLowerCase()
      if (extension === 'doc') return app?.Enum?.wdFormatDocument ?? 0
      return app?.Enum?.wdFormatXMLDocument ?? 12
    }
    
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentFormatActions.js
物理行数：848（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const SCOPE_LABELS = { 工具与业务子模块。
以下为该文件开头的若干行：
    import { getApplication } from './documentActions.js'
    
    const SCOPE_LABELS = {
      selection: '当前选择的文字',
      paragraph: '当前段落',
      document: '全文'
    }
    
    const COLOR_NAME_MAP = {
      黑色: '#000000',
      黑: '#000000',
      白色: '#FFFFFF',
      白: '#FFFFFF',
      红色: '#FF0000',
      红: '#FF0000',
      蓝色: '#0000FF',
      蓝: '#0000FF',
      绿色: '#00AA00',
      绿: '#00AA00',
      黄色: '#FFFF00',
      黄: '#FFFF00',
      橙色: '#FFA500',
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentImageExportService.js
物理行数：263（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
function getApplication() { 工具与业务子模块。
以下为该文件开头的若干行：
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
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentInsertActions.js
物理行数：75（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const WD_COLLAPSE_START = 1 工具与业务子模块。
以下为该文件开头的若干行：
    import { getActiveDocument, getApplication, getSelectionRange } from './documentActions.js'
    
    const WD_COLLAPSE_START = 1
    
    function collapseRangeToStart(range) {
      if (!range) return range
      try {
        if (typeof range.Duplicate === 'function') {
          const duplicated = range.Duplicate()
          duplicated?.Collapse?.(WD_COLLAPSE_START)
          return duplicated
        }
        range.Collapse?.(WD_COLLAPSE_START)
      } catch (_) {}
      return range
    }
    
    function getPageInsertRange(pageNumber) {
      const app = getApplication()
      const doc = getActiveDocument()
      if (!doc) throw new Error('当前没有打开文档')
      const normalizedPage = Number(pageNumber || 0)
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentOperationLedger.js
物理行数：337（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const STORAGE_KEY = 'NdDocumentOperationLedger' 工具与业务子模块。
以下为该文件开头的若干行：
    import { executeDocumentFormatAction } from './documentFormatActions.js'
    import { insertBlankPageAtPosition, insertPageBreakAtPosition, insertTableAtPosition } from './documentInsertActions.js'
    
    const STORAGE_KEY = 'NdDocumentOperationLedger'
    const ARCHIVE_LIMIT = 200
    
    function getApplication() {
      return window.Application || window.opener?.Application || window.parent?.Application || null
    }
    
    function safeParse(raw, fallback = null) {
      if (!raw) return fallback
      if (typeof raw === 'object') return raw
      try {
        return JSON.parse(String(raw))
      } catch (_) {
        return fallback
      }
    }
    
    function normalizeString(value, fallback = '') {
      const normalized = String(value || '').trim()
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentPositionUtils.js
物理行数：89（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
export function normalizeTextWithIndexMap(text) { 工具与业务子模块。
以下为该文件开头的若干行：
    export function normalizeTextWithIndexMap(text) {
      const raw = String(text || '')
      let normalized = ''
      const indexMap = []
      const spanMap = []
      for (let i = 0; i < raw.length; i += 1) {
        const ch = raw[i]
        if (ch === '\r') {
          if (raw[i + 1] === '\n') {
            normalized += '\n'
            indexMap.push(i)
            spanMap.push(2)
            i += 1
          } else {
            normalized += '\n'
            indexMap.push(i)
            spanMap.push(1)
          }
          continue
        }
        normalized += ch
        indexMap.push(i)
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentProcessingPipeline.js
物理行数：229（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
function getPreviewText(text, maxLength = 220) { 工具与业务子模块。
以下为该文件开头的若干行：
    import { canCreateDocumentBackup, createDocumentBackupRecord } from './documentBackupStore.js'
    import { applyDocumentExecutionPlan } from './documentActions.js'
    import { appendDocumentOperationBatch } from './documentOperationLedger.js'
    
    function getPreviewText(text, maxLength = 220) {
      const normalized = String(text || '').replace(/\s+/g, ' ').trim()
      if (!normalized) return ''
      return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized
    }
    
    function getPlanRange(plan) {
      const ranges = []
      ;(Array.isArray(plan?.operations) ? plan.operations : []).forEach((item) => {
        const start = Number(item?.start)
        const end = Number(item?.end)
        if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
          ranges.push({ start, end })
        }
      })
      ;(Array.isArray(plan?.contentBlocks) ? plan.contentBlocks : []).forEach((item) => {
        const start = Number(item?.start)
        const end = Number(item?.end)
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentRelocationActions.js
物理行数：524（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const SOURCE_LABELS = { 工具与业务子模块。
以下为该文件开头的若干行：
    import { getApplication } from './documentActions.js'
    
    const SOURCE_LABELS = {
      'paragraph-index': '指定段落',
      'current-paragraph': '当前段落',
      'paragraph-keyword': '命中段落'
    }
    
    const DESTINATION_LABELS = {
      'paragraph-index': '指定段落',
      'current-paragraph': '当前段落',
      'document-start': '文首',
      'document-end': '文末'
    }
    
    const KEYWORD_RELATION_LABELS = {
      any: '任一关键词',
      all: '全部关键词'
    }
    
    function getActiveDocument() {
      return getApplication()?.ActiveDocument || null
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentSecurityActions.js
物理行数：12（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
export function encryptActiveDocument(options = {}) { 工具与业务子模块。
以下为该文件开头的若干行：
    import { saveActiveDocumentWithPassword, saveActiveDocumentWithoutPassword } from './documentFileActions.js'
    
    export function encryptActiveDocument(options = {}) {
      const password = String(options.password || '').trim()
      if (!password) throw new Error('请提供文档密码')
      return saveActiveDocumentWithPassword(password, options.savePath || '')
    }
    
    export function decryptActiveDocument(options = {}) {
      return saveActiveDocumentWithoutPassword(options.savePath || '')
    }
    
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentTaskScope.js
物理行数：84（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
/**；* 根据用户自然语言与当前文档状态，判定本轮任务应使用的材料范围。；* 纯函数，便于单测与脚本回归；运行时由 AIAssistantDialog 注入 hasSelection / hasDocument。；*；* @param {string} text - 用户输入；* @param {{ routeKind?: string, hasSelection?: boolean, hasDocument?: boolean }} [options]；* @returns {{ requestedScope: string, resolvedScope: string, hasSelection: boolean, hasDocument: boolean, reason: string }}；*/ 工具与业务子模块。
以下为该文件开头的若干行：
    /**
     * 根据用户自然语言与当前文档状态，判定本轮任务应使用的材料范围。
     * 纯函数，便于单测与脚本回归；运行时由 AIAssistantDialog 注入 hasSelection / hasDocument。
     *
     * @param {string} text - 用户输入
     * @param {{ routeKind?: string, hasSelection?: boolean, hasDocument?: boolean }} [options]
     * @returns {{ requestedScope: string, resolvedScope: string, hasSelection: boolean, hasDocument: boolean, reason: string }}
     */
    export function resolveDocumentTaskInputScope(text = '', options = {}) {
      const normalized = String(text || '').trim()
      const routeKind = String(options.routeKind || '').trim()
      const hasSelection = options.hasSelection === true
      const hasDocument = options.hasDocument === true
    
      const useSelectionMaterialCue = /(?:请|要|想|需要|麻烦|帮忙|帮我)?(?:使用|用|基于|针对|对于|对|把|将|依据|参考|结合|围绕|按|按照)\s*(?:我|当前)?\s*(?:选中的|选中(?:的内容|的文字|的文本|的部分)?|选区(?:的内容|的文字)?|所选(?:的内容|的文字)?|当前选中|高亮(?:的|部分)?|这段|本段|这一段|光标(?:处|所在|位置)?|鼠标(?:所在|选中)?)/.test(normalized)
      const useDocumentMaterialCue = /(?:请|要|想|需要|麻烦|帮忙|帮我)?(?:使用|用|基于|针对|对于|对|把|将|依据|参考|结合|围绕|按|按照)\s*(?:全文|全篇|整篇|整个文档|整份文档|全稿|文档全文|本篇|本稿)/.test(normalized)
      const hasSelectionCue = useSelectionMaterialCue ||
        /(选中|选区|所选|当前选中|这段|本段|当前段落|这一段|高亮|划线|圈选|光标处|光标位置|选中文字|圈出来的|以选中(?:内容)?为准|按选中(?:内容)?(?:来|处理|执行)?|按选区(?:内容)?(?:来|处理|执行)?)/i.test(normalized)
      const hasDocumentCue = useDocumentMaterialCue ||
        /(全文|全篇|整篇|整个文档|当前文档|整份|全稿|整份文档|本篇全文|文档全文|通篇|整文|全文内容|以全文为准|按全文(?:来|处理|执行)?|按整篇(?:来|处理|执行)?)/i.test(normalized)
      const preferSelectionCue = /(优先[^，。；;,.!?！？\n]{0,24}(?:选中|选区|这段)|先[^，。；;,.!?！？\n]{0,24}(?:选中|选区|这段)|(?:选中|选区|这段)[^，。；;,.!?！？\n]{0,24}(?:优先|先处理)|以(?:选中|选区|这段)[^，。；;,.!?！？\n]{0,24}为准|按(?:选中|选区|这段)[^，。；;,.!?！？\n]{0,24}为准|(?:选中|选区|这段)[^，。；;,.!?！？\n]{0,24}(?:为准|来|来做|处理即可|为主|主要看)|无论[^，。；;,.!?！？\n]{0,24}都[^，。；;,.!?！？\n]{0,24}(?:选中|选区|这段))/.test(normalized)
      const preferDocumentCue = /(优先[^，。；;,.!?！？\n]{0,24}(?:全文|全篇|整篇|文档)|先[^，。；;,.!?！？\n]{0,24}(?:全文|全篇|整篇|文档)|(?:全文|全篇|整篇|文档)[^，。；;,.!?！？\n]{0,24}(?:优先|先处理)|以(?:全文|全篇|整篇|文档)[^，。；;,.!?！？\n]{0,24}为准|按(?:全文|全篇|整篇|文档)[^，。；;,.!?！？\n]{0,24}为准|(?:全文|全篇|整篇|文档)[^，。；;,.!?！？\n]{0,24}(?:为准|来|来做|处理即可|为主|主要看)|无论[^，。；;,.!?！？\n]{0,24}都[^，。；;,.!?！？\n]{0,24}(?:全文|全篇|整篇|文档))/.test(normalized)
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentTemplates.js
物理行数：593（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
/**；* 文档模板管理 - 导入的 .aidocx 模板存储与读取；* 若设置了数据路径：模板文件复制到 dataPath/model/，清单保存到 dataPath/chayuan_document_templates.json；* 否则使用 PluginStorage 存储清单，模板路径为用户选择的原路径；*/ 工具与业务子模块。
以下为该文件开头的若干行：
    /**
     * 文档模板管理 - 导入的 .aidocx 模板存储与读取
     * 若设置了数据路径：模板文件复制到 dataPath/model/，清单保存到 dataPath/chayuan_document_templates.json
     * 否则使用 PluginStorage 存储清单，模板路径为用户选择的原路径
     */
    
    import { getEffectiveDataDir, getModelDir, joinDataPath, ensureDir, pathJoin, pathSep } from './dataPathSettings.js'
    
    const STORAGE_KEY = 'chayuan_document_templates'
    const LEGACY_STORAGE_KEY = 'niudang_document_templates'
    const FILE_NAME = 'chayuan_document_templates.json'
    const LEGACY_FILE_NAME = 'niudang_document_templates.json'
    const isWin = typeof ActiveXObject !== 'undefined'
    
    /** 文档变量名：标记为从模板新建的未保存文件，保存时需弹出另存为 */
    export const NEW_FILE_VAR_NAME = 'NdNewFile'
    
    /** 设置/清除新文件标记 */
    export function setNewFileMarker(doc, isNew) {
      if (!doc?.Variables) return
      try {
        if (isNew) {
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/documentTextEditActions.js
物理行数：468（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const SCOPE_LABELS = { 工具与业务子模块。
以下为该文件开头的若干行：
    import { getApplication } from './documentActions.js'
    
    const SCOPE_LABELS = {
      selection: '当前选择的文字',
      paragraph: '当前段落',
      document: '全文'
    }
    
    const MATCH_MODE_LABELS = {
      plain: '普通匹配',
      'whole-word': '整词匹配',
      regex: '正则匹配'
    }
    
    const TARGET_UNIT_LABELS = {
      text: '关键词',
      paragraph: '段落'
    }
    
    const KEYWORD_RELATION_LABELS = {
      any: '任一关键词',
      all: '全部关键词'
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/evaluationStore.js
物理行数：342（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const STORAGE_KEY = 'NdEvaluationStore' 工具与业务子模块。
以下为该文件开头的若干行：
    const STORAGE_KEY = 'NdEvaluationStore'
    const ARCHIVE_LIMIT = 400
    
    function getApplication() {
      return window.Application || window.opener?.Application || window.parent?.Application || null
    }
    
    function safeParse(raw, fallback = null) {
      if (!raw) return fallback
      if (typeof raw === 'object') return raw
      try {
        return JSON.parse(String(raw))
      } catch (_) {
        return fallback
      }
    }
    
    function normalizeString(value, fallback = '') {
      const normalized = String(value || '').trim()
      return normalized || fallback
    }
    
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/formAuditService.js
物理行数：1096（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
createDefaultReportSettings, 工具与业务子模块。
以下为该文件开头的若干行：
    import { chatCompletion } from './chatApi.js'
    import { addTask, getTaskById, updateTask } from './taskListStore.js'
    import { getBuiltinAssistantDefinition } from './assistantRegistry.js'
    import { getAssistantSetting, getConfiguredAssistantModelId } from './assistantSettings.js'
    import { getFlatModelsFromSettings, parseModelCompositeId } from './modelSettings.js'
    import { inferModelType } from './modelTypeUtils.js'
    import {
      createDefaultReportSettings,
      getReportTypeLabel,
      normalizeReportSettings,
      renderReportTemplate
    } from './reportSettings.js'
    import { loadRulesFromDoc, normalizeRule, validateRuleValue } from './templateRules.js'
    
    export const FORM_FIELD_AUDIT_ASSISTANT_ID = 'analysis.form-field-audit'
    
    const activeAuditRuns = new Map()
    
    function getApplication() {
      return window.Application || window.opener?.Application || window.parent?.Application || null
    }
    
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/formFieldExtractService.js
物理行数：514（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
genId, 工具与业务子模块。
以下为该文件开头的若干行：
    import { runAssistantTask, startAssistantTask } from './assistantTaskRunner.js'
    import {
      genId,
      loadRulesFromDoc,
      normalizeConstraints,
      normalizeRule,
      saveRulesToDoc,
      validateRuleValue
    } from './templateRules.js'
    
    export const FORM_FIELD_EXTRACT_ASSISTANT_ID = 'analysis.form-field-extract'
    
    function getActiveDocument() {
      return window.Application?.ActiveDocument || null
    }
    
    function getRawDocumentText() {
      return String(getActiveDocument()?.Content?.Text || '')
    }
    
    function buildNormalizedTextMap(rawText) {
      let normalized = ''
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/mediaApi.js
物理行数：621（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const OLLAMA_LIKE = ['ollama', 'OLLAMA', 'xinference', 'XINFERENCE', 'oneapi', 'ONEAPI', 'fastchat', 'FASTCHAT', 'lm-studio', 'new-api'] 工具与业务子模块。
以下为该文件开头的若干行：
    import { getModelConfig } from './modelSettings.js'
    
    const OLLAMA_LIKE = ['ollama', 'OLLAMA', 'xinference', 'XINFERENCE', 'oneapi', 'ONEAPI', 'fastchat', 'FASTCHAT', 'lm-studio', 'new-api']
    
    function isOllamaLike(providerId) {
      return OLLAMA_LIKE.some(id => String(providerId || '').toLowerCase() === id.toLowerCase())
    }
    
    function trimApiUrl(apiUrl) {
      return String(apiUrl || '').trim().replace(/\/+$/, '')
    }
    
    function buildEndpoint(apiUrl, suffix) {
      const base = trimApiUrl(apiUrl)
      if (!base) return ''
      if (base.endsWith(`/${suffix}`)) return base
      if (/\/v\d+$/.test(base) || base.includes('qianfan.baidubce.com')) {
        return `${base}/${suffix}`
      }
      return `${base}/v1/${suffix}`
    }
    
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/modelGroups.js
物理行数：53（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
/**；* 模型分组配置 - 与 ribbon 模型选择、设置中的分组一致；*/ 工具与业务子模块。
以下为该文件开头的若干行：
    /**
     * 模型分组配置 - 与 ribbon 模型选择、设置中的分组一致
     */
    export const MODEL_GROUPS = [
      { label: 'ChatGPT', icon: 'images/models/openai.svg', models: [
        { id: 'gpt-4o', name: 'GPT-4o' }, { id: 'gpt-4', name: 'GPT-4' }, { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
        { id: 'o3', name: 'o3' }, { id: 'gpt_o1', name: 'GPT-o1' }, { id: 'gpt-5', name: 'GPT-5' }, { id: 'gpt-3.5', name: 'GPT-3.5' }
      ]},
      { label: 'Claude', icon: 'images/models/claude.svg', models: [
        { id: 'claude-3.5', name: 'Claude 3.5' }, { id: 'claude-3', name: 'Claude 3' }, { id: 'claude', name: 'Claude' }
      ]},
      { label: 'Gemini', icon: 'images/models/gemini.svg', models: [
        { id: 'gemini-pro', name: 'Gemini Pro' }, { id: 'gemini', name: 'Gemini' }
      ]},
      { label: 'DeepSeek', icon: 'images/models/deepseek.svg', models: [
        { id: 'deepseek-v3', name: 'DeepSeek V3' }, { id: 'deepseek-r1', name: 'DeepSeek R1' }, { id: 'deepseek-coder', name: 'DeepSeek Coder' }
      ]},
      { label: '豆包', icon: 'images/models/doubao.svg', models: [
        { id: 'doubao', name: '豆包' }, { id: 'doubao-pro', name: '豆包 Pro' }
      ]},
      { label: '通义千问', icon: 'images/models/qwen.svg', models: [
        { id: 'qwen-max', name: '通义千问-Max' }, { id: 'qwen-plus', name: '通义千问-Plus' }, { id: 'qwen', name: '通义千问' }
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/modelLogos.js
物理行数：165（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
/**；* 模型图标路径：优先使用 public/images/models/logos 下重命名后的图标；* 根据模型 id 解析为 logos 中的文件名（无则回退到旧路径或占位）；*/ 工具与业务子模块。
以下为该文件开头的若干行：
    /**
     * 模型图标路径：优先使用 public/images/models/logos 下重命名后的图标
     * 根据模型 id 解析为 logos 中的文件名（无则回退到旧路径或占位）
     */
    
    const LOGOS_BASE = 'images/models/logos'
    
    // 模型 id -> logos 中的 basename（不含扩展名），与 logos 目录重命名结果一致
    const MODEL_ID_TO_LOGO_BASENAME = {
      OPENAI: 'openai',
      OLLAMA: 'ollama',
      XINFERENCE: 'xinference',
      ONEAPI: 'oneapi',
      FASTCHAT: 'vllm',
      OPENAI_COMPATIBLE: 'api-compatible',
      DEEPSEEK: 'deepseek',
      GEMINI: 'gemini',
      ZHIPU: 'zhipu',
      BAIDU: 'baidu-ai',
      REPLICATE_FAL_AI: 'stability',
      openai: 'openai',
      ollama: 'ollama',
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/modelTypeUtils.js
物理行数：157（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
/**；* 模型类型推断 - 根据模型 id 判断用途类型；* 用于默认模型设置分类、AI 助手仅显示对话模型等；*/ 工具与业务子模块。
以下为该文件开头的若干行：
    /**
     * 模型类型推断 - 根据模型 id 判断用途类型
     * 用于默认模型设置分类、AI 助手仅显示对话模型等
     */
    
    export const MODEL_TYPE_CHAT = 'chat'
    export const MODEL_TYPE_EMBEDDING = 'embedding'
    export const MODEL_TYPE_IMAGE = 'image'
    export const MODEL_TYPE_VIDEO = 'video'
    export const MODEL_TYPE_VOICE = 'voice'
    export const MODEL_TYPE_TTS = 'tts'
    export const MODEL_TYPE_ASR = 'asr'
    export const MODEL_TYPE_AUDIO_UNDERSTANDING = 'audio-understanding'
    export const MODEL_TYPE_VISION = 'vision'
    export const MODEL_TYPE_IMAGE_GENERATION = 'image-generation'
    export const MODEL_TYPE_VIDEO_GENERATION = 'video-generation'
    export const MODEL_TYPE_VIDEO_UNDERSTANDING = 'video-understanding'
    
    const EMBEDDING_PATTERNS = [
      /^text-embedding-/i,
      /embedding/i,
      /^embed-/i,
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/multimodalPlanning.js
物理行数：184（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
function normalizeString(value, fallback = '') { 工具与业务子模块。
以下为该文件开头的若干行：
    function normalizeString(value, fallback = '') {
      const normalized = String(value || '').trim()
      return normalized || fallback
    }
    
    function uniqueList(list = []) {
      return Array.from(new Set((Array.isArray(list) ? list : []).map(item => normalizeString(item)).filter(Boolean)))
    }
    
    function truncateText(text = '', maxLength = 120) {
      const normalized = normalizeString(text)
      if (!normalized) return ''
      return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized
    }
    
    function splitPlanSegments(text = '', limit = 3) {
      return uniqueList(
        String(text || '')
          .split(/[\n。！？!?；;，,]/)
          .map(item => item.trim())
          .filter(item => item.length >= 2)
      ).slice(0, Math.max(1, Number(limit || 3)))
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/multimodalRecognitionRunner.js
物理行数：539（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
MODEL_TYPE_ASR, 工具与业务子模块。
以下为该文件开头的若干行：
    import { chatCompletion } from './chatApi.js'
    import { getFlatModelsFromSettings } from './modelSettings.js'
    import { transcribeAudioAsset } from './mediaApi.js'
    import {
      MODEL_TYPE_ASR,
      MODEL_TYPE_AUDIO_UNDERSTANDING,
      MODEL_TYPE_CHAT,
      MODEL_TYPE_VIDEO_UNDERSTANDING,
      MODEL_TYPE_VISION
    } from './modelTypeUtils.js'
    import { createArtifactRecord } from './artifactTypes.js'
    import { requestServerSideVideoAnalysis } from './multimodalServerBridge.js'
    
    function normalizeString(value, fallback = '') {
      const normalized = String(value || '').trim()
      return normalized || fallback
    }
    
    function detectAttachmentKind(file = {}) {
      const type = String(file?.type || '').toLowerCase()
      const name = String(file?.name || '').toLowerCase()
      if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)) return 'image'
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/multimodalServerBridge.js
物理行数：79（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
function normalizeString(value, fallback = '') { 工具与业务子模块。
以下为该文件开头的若干行：
    import { loadGlobalSettings } from './globalSettings.js'
    
    function normalizeString(value, fallback = '') {
      const normalized = String(value || '').trim()
      return normalized || fallback
    }
    
    function buildHeaders(apiKey = '') {
      const headers = {}
      const normalized = normalizeString(apiKey)
      if (normalized) {
        headers.Authorization = `Bearer ${normalized}`
      }
      return headers
    }
    
    function parseServerResponse(payload = {}) {
      return {
        ok: payload?.ok !== false,
        summary: normalizeString(payload?.summary),
        text: normalizeString(payload?.text || payload?.analysis || payload?.content),
        ocrText: normalizeString(payload?.ocrText),
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/multimodalTaskRunner.js
物理行数：461（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const activeMultimodalRuns = new Map() 工具与业务子模块。
以下为该文件开头的若干行：
    import { addTask, getTaskById, updateTask } from './taskListStore.js'
    import { generateImageAsset, generateSpeechAsset, generateVideoAsset } from './mediaApi.js'
    import { buildGeneratedArtifactDescriptor, mergeTaskOrchestrationData } from './taskOrchestrationMeta.js'
    import { bindArtifactsToOwner } from './artifactStore.js'
    import { createRenderedArtifact } from './artifactRenderer.js'
    import { buildMultimodalGenerationPlan, summarizeMultimodalGenerationPlan } from './multimodalPlanning.js'
    
    const activeMultimodalRuns = new Map()
    
    function yieldToUI(delay = 0) {
      return new Promise(resolve => setTimeout(resolve, delay))
    }
    
    function createCancelError() {
      const error = new Error('任务已停止')
      error.name = 'TaskCancelledError'
      error.code = 'TASK_CANCELLED'
      return error
    }
    
    function isTaskCancelledError(error) {
      return error?.code === 'TASK_CANCELLED' || error?.name === 'TaskCancelledError'
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/preloadAiAssistantChunk.js
物理行数：20（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
/**；* Preloads the `/ai-assistant` lazy route chunk so opening the dialog from the；* ribbon does not wait on fetch + parse of the large bundle on first use.；* Must use the same specifier as `src/router/index.js` so Vite emits one chunk.；*/ 工具与业务子模块。
以下为该文件开头的若干行：
    /**
     * Preloads the `/ai-assistant` lazy route chunk so opening the dialog from the
     * ribbon does not wait on fetch + parse of the large bundle on first use.
     * Must use the same specifier as `src/router/index.js` so Vite emits one chunk.
     */
    export function preloadAiAssistantRouteChunk() {
      return import('../components/AIAssistantDialog.vue')
    }
    
    export function schedulePreloadAiAssistantRouteChunk() {
      const run = () => {
        preloadAiAssistantRouteChunk().catch(() => {})
      }
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(run, { timeout: 4000 })
      } else {
        window.setTimeout(run, 1500)
      }
    }
    
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/reportAssistantPresets.js
物理行数：1114（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const REPORT_ASSISTANT_PRESET_GROUPS = [ 工具与业务子模块。
以下为该文件开头的若干行：
    import { createCustomAssistantDraft } from './assistantSettings.js'
    import { createDefaultReportSettings } from './reportSettings.js'
    
    const REPORT_ASSISTANT_PRESET_GROUPS = [
      {
        key: 'engineering',
        label: '工程与项目类',
        description: '适合工程建设、项目实施、质量验收、进度跟踪等正式材料。'
      },
      {
        key: 'software',
        label: '软件与研发类',
        description: '适合软件研发、技术评估、测试、缺陷、上线复盘等场景。'
      },
      {
        key: 'education',
        label: '教育与培训类',
        description: '适合教学质量、课程评估、学情分析、培训总结等教育培训材料。'
      },
      {
        key: 'management',
        label: '经营与管理类',
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/reportDraftBuilder.js
物理行数：95（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
function extractJsonCandidate(raw) { 工具与业务子模块。
以下为该文件开头的若干行：
    import { chatCompletion } from './chatApi.js'
    import { getReportTypeLabel, REPORT_TYPE_OPTIONS } from './reportSettings.js'
    
    function extractJsonCandidate(raw) {
      const text = String(raw || '').trim()
      if (!text) return ''
      const block = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
      if (block?.[1]) return block[1].trim()
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start >= 0 && end > start) return text.slice(start, end + 1).trim()
      return text
    }
    
    function parseDraft(raw) {
      const candidate = extractJsonCandidate(raw)
      if (!candidate) throw new Error('模型未返回可解析的报告草稿')
      return JSON.parse(candidate)
    }
    
    function normalizeOutlineSections(value) {
      return (Array.isArray(value) ? value : [])
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/reportSettings.js
物理行数：275（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const REPORT_TYPE_GROUPS = [ 工具与业务子模块。
以下为该文件开头的若干行：
    const REPORT_TYPE_GROUPS = [
      {
        key: 'audit',
        label: '审计与监督',
        options: [
          { value: 'engineering-audit-report', label: '工程审计报告' },
          { value: 'financial-audit-report', label: '财务审计报告' },
          { value: 'internal-control-audit-report', label: '内控审计报告' },
          { value: 'compliance-audit-report', label: '合规审计报告' },
          { value: 'information-system-audit-report', label: '信息系统审计报告' },
          { value: 'procurement-audit-report', label: '采购审计报告' },
          { value: 'project-audit-report', label: '项目审计报告' },
          { value: 'performance-audit-report', label: '绩效审计报告' },
          { value: 'special-audit-report', label: '专项审计报告' },
          { value: 'departure-audit-report', label: '离任审计报告' }
        ]
      },
      {
        key: 'finance',
        label: '财务与经营',
        options: [
          { value: 'financial-analysis-report', label: '财务分析报告' },
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/safeErrorDialog.js
物理行数：225（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
/**；* 在 WPS CEF 内展示错误详情：仅用当前文档内的 DOM，不使用 window.open / document.write，；* 降低触发 CrBrowserMain 宿主崩溃的概率。；*；* 与官方「加载项网页调试」一致：异常处理遵循标准 Web API（见 MDN：error / unhandledrejection）。；* WPS 文档中 InvokeAsHttp 等接口需在回调里判断 res.status；此处为页面内 JS 全局兜底。；*；* 说明：若宿主 native 层已 abort()，JS 无法拦截，只能通过避免危险调用与缩小同步负载来降低概率。；*/ 工具与业务子模块。
以下为该文件开头的若干行：
    /**
     * 在 WPS CEF 内展示错误详情：仅用当前文档内的 DOM，不使用 window.open / document.write，
     * 降低触发 CrBrowserMain 宿主崩溃的概率。
     *
     * 与官方「加载项网页调试」一致：异常处理遵循标准 Web API（见 MDN：error / unhandledrejection）。
     * WPS 文档中 InvokeAsHttp 等接口需在回调里判断 res.status；此处为页面内 JS 全局兜底。
     *
     * 说明：若宿主 native 层已 abort()，JS 无法拦截，只能通过避免危险调用与缩小同步负载来降低概率。
     */
    
    /** CEF 主线程上单次赋值过大字符串或剪贴板 API 可能诱发宿主不稳定，偏小保守上限 */
    const MAX_DETAIL_CHARS = 24000
    const FLUSH_MS = 500
    
    let overlayRoot = null
    let flushTimer = null
    let pendingLines = []
    
    function truncateDetail(text) {
      const s = String(text ?? '')
      if (s.length <= MAX_DETAIL_CHARS) return s
      return `${s.slice(0, MAX_DETAIL_CHARS)}\n\n…[已截断，总长度约 ${s.length} 字符]`
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/settingsWindowManager.js
物理行数：195（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const LOCK_KEY = 'nd_settings_window_lock' 工具与业务子模块。
以下为该文件开头的若干行：
    import { activateDialogWindow } from './windowActivation.js'
    
    const LOCK_KEY = 'nd_settings_window_lock'
    const REQUEST_KEY = 'nd_settings_window_request'
    const STALE_MS = 15000
    const HEARTBEAT_MS = 5000
    
    function readStorageJson(key) {
      try {
        const raw = window.localStorage.getItem(key)
        return raw ? JSON.parse(raw) : null
      } catch (_) {
        return null
      }
    }
    
    function writeStorageJson(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
        return true
      } catch (_) {
        return false
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/structuredCommentPolicy.js
物理行数：150（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
/**；* 结构化分批任务中「仅锚点批注」策略的单一配置源：；* - 凡文档动作为批注 / 链接批注且助手非「修订类」(revision-edits)，均只通过 text-anchor / 坐标等 operations 落点；；* - 禁止全文或大块分块兜底批注、禁止把 plan 统计 JSON 当批注正文。；* 涉密关键词、保密检查等在 getStructuredJsonAnchorExtraRules 中有额外字段要求；其他助手依赖通用批注锚点说明。；*/ 工具与业务子模块。
以下为该文件开头的若干行：
    /**
     * 结构化分批任务中「仅锚点批注」策略的单一配置源：
     * - 凡文档动作为批注 / 链接批注且助手非「修订类」(revision-edits)，均只通过 text-anchor / 坐标等 operations 落点；
     * - 禁止全文或大块分块兜底批注、禁止把 plan 统计 JSON 当批注正文。
     * 涉密关键词、保密检查等在 getStructuredJsonAnchorExtraRules 中有额外字段要求；其他助手依赖通用批注锚点说明。
     */
    
    export const ANALYSIS_SECRET_KEYWORD_EXTRACT_ID = 'analysis.secret-keyword-extract'
    export const ANALYSIS_SECURITY_CHECK_ID = 'analysis.security-check'
    /** AI 痕迹检查：与保密检查共用「命中片段」Markdown 抽取规则，便于结构化批注锚点 */
    export const ANALYSIS_AI_TRACE_CHECK_ID = 'analysis.ai-trace-check'
    
    /** 文档动作为批注类（与 revision-edits 模式组合由调用方判断） */
    export function isAnchoredCommentDocumentAction(documentAction) {
      const a = String(documentAction || '').trim()
      return a === 'comment' || a === 'link-comment'
    }
    
    /**
     * 从保密检查 Markdown（通常在 JSON 的 summary/content 中）提取「命中片段」原文。
     */
    export function extractHitFragmentsFromSecurityCheckMarkdown(markdown) {
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/taskListWindowManager.js
物理行数：149（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const LOCK_KEY = 'nd_task_list_window_lock' 工具与业务子模块。
以下为该文件开头的若干行：
    const LOCK_KEY = 'nd_task_list_window_lock'
    const REQUEST_KEY = 'nd_task_list_window_request'
    const STALE_MS = 15000
    const HEARTBEAT_MS = 5000
    
    function readStorageJson(key) {
      try {
        const raw = window.localStorage.getItem(key)
        return raw ? JSON.parse(raw) : null
      } catch (_) {
        return null
      }
    }
    
    function writeStorageJson(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
        return true
      } catch (_) {
        return false
      }
    }
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/taskOrchestrationMeta.js
物理行数：76（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
function normalizeString(value, fallback = '') { 工具与业务子模块。
以下为该文件开头的若干行：
    import { createArtifactRecord } from './artifactTypes.js'
    
    function normalizeString(value, fallback = '') {
      const normalized = String(value || '').trim()
      return normalized || fallback
    }
    
    export function mapProgressStageToTaskPhase(progressStage = '') {
      const normalized = normalizeString(progressStage)
      if (!normalized) return 'planning'
      if (['preparing', 'collecting', 'validating', 'local_validating'].includes(normalized)) return 'planning'
      if (['calling_model', 'parsing_result'].includes(normalized)) return 'planning'
      if (['collecting_params', 'collecting-params'].includes(normalized)) return 'collecting-params'
      if (['awaiting_confirmation', 'awaiting-confirmation', 'previewing'].includes(normalized)) return 'previewing'
      if (normalized === 'applying_result') return 'applying'
      if (normalized === 'completed') return 'completed'
      if (normalized === 'failed') return 'failed'
      if (normalized === 'cancelled') return 'cancelled'
      return normalized
    }
    
    export function buildTaskOrchestrationMeta(meta = {}) {
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/taskOrchestrationWindowManager.js
物理行数：139（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const LOCK_KEY = 'nd_task_orchestration_window_lock' 工具与业务子模块。
以下为该文件开头的若干行：
    import { activateDialogWindow } from './windowActivation.js'
    
    const LOCK_KEY = 'nd_task_orchestration_window_lock'
    const REQUEST_KEY = 'nd_task_orchestration_window_request'
    const STALE_MS = 15000
    const HEARTBEAT_MS = 5000
    
    function readStorageJson(key) {
      try {
        const raw = window.localStorage.getItem(key)
        return raw ? JSON.parse(raw) : null
      } catch (_) {
        return null
      }
    }
    
    function writeStorageJson(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
        return true
      } catch (_) {
        return false
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/taskProgressWindowManager.js
物理行数：141（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const LOCK_PREFIX = 'nd_task_progress_window_' 工具与业务子模块。
以下为该文件开头的若干行：
    const LOCK_PREFIX = 'nd_task_progress_window_'
    const FOCUS_REQUEST_KEY = 'nd_task_progress_window_focus_request'
    const STALE_MS = 15000
    const HEARTBEAT_MS = 5000
    
    function readStorageJson(key) {
      try {
        const raw = window.localStorage.getItem(key)
        return raw ? JSON.parse(raw) : null
      } catch (_) {
        return null
      }
    }
    
    function writeStorageJson(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
        return true
      } catch (_) {
        return false
      }
    }
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/templateRules.js
物理行数：573（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
export const DATA_TYPES = [ 工具与业务子模块。
以下为该文件开头的若干行：
    export const DATA_TYPES = [
      { value: 'string', label: '字符串', hint: '任意文本，如姓名、地址、备注' },
      { value: 'select', label: '下拉选项', hint: '从预设选项中选择，可输入多个选项，英文逗号分隔' },
      { value: 'integer', label: '整数', hint: '不含小数点的数字，如数量、序号' },
      { value: 'decimal', label: '小数', hint: '含小数点的数字，如金额、比例' },
      { value: 'date', label: '日期', hint: '日期，格式 YYYY-MM-DD' },
      { value: 'time', label: '时间', hint: '时间，格式 HH:mm 或 HH:mm:ss' },
      { value: 'datetime', label: '日期+时间', hint: '日期+时间，格式 YYYY-MM-DD HH:mm' },
      { value: 'boolean', label: '布尔', hint: '是/否、同意/不同意' },
      { value: 'email', label: '邮箱', hint: '电子邮箱地址' },
      { value: 'phone', label: '电话', hint: '手机号或固定电话' },
      { value: 'idcard', label: '身份证号', hint: '18 位身份证' },
      { value: 'url', label: '网址', hint: '网页链接' }
    ]
    
    export const REVIEW_TYPES = [
      { value: 'none', label: '无', hint: '不做额外审查' },
      { value: 'regex', label: '正则审查', hint: '用正则表达式校验格式' },
      { value: 'format', label: '格式校验', hint: '按数据类型做格式校验' },
      { value: 'range', label: '范围校验', hint: '数值或长度在指定范围内' },
      { value: 'enum', label: '枚举校验', hint: '只能是指定选项之一' },
      { value: 'llm', label: '大模型审查', hint: '用 AI 判断内容是否符合描述' },
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/utilityCapabilityNamespace.js
物理行数：175（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
function normalizeString(value, fallback = '') { 工具与业务子模块。
以下为该文件开头的若干行：
    function normalizeString(value, fallback = '') {
      const normalized = String(value || '').trim()
      return normalized || fallback
    }
    
    function safeParseJson(raw, fallback = null) {
      if (raw == null || raw === '') return fallback
      if (typeof raw === 'object') return raw
      try {
        return JSON.parse(String(raw))
      } catch (_) {
        return fallback
      }
    }
    
    function getByPath(source, path) {
      const normalized = normalizeString(path)
      if (!normalized) return source
      return normalized
        .split('.')
        .filter(Boolean)
        .reduce((acc, key) => {
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/windowActivation.js
物理行数：41（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
function getApplication() { 工具与业务子模块。
以下为该文件开头的若干行：
    function getApplication() {
      return window.Application || window.opener?.Application || window.parent?.Application || null
    }
    
    function restoreHostWindow() {
      const app = getApplication()
      const hostWindow = app?.ActiveWindow
      if (!hostWindow) return
    
      try {
        const minimizedState = app?.Enum?.wdWindowStateMinimize ?? 2
        const normalState = app?.Enum?.wdWindowStateNormal ?? 0
        if (hostWindow.WindowState === minimizedState) {
          hostWindow.WindowState = normalState
        }
      } catch (_) {}
    
      try {
        hostWindow.Visible = true
      } catch (_) {}
    
      try {
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/workflowRunner.js
物理行数：1095（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
executeWorkflowTool, 工具与业务子模块。
以下为该文件开头的若干行：
    import { addTask, getTaskById, getTasks, updateTask } from './taskListStore.js'
    import { startAssistantTask, stopAssistantTask } from './assistantTaskRunner.js'
    import { END_NODE_ID, START_NODE_ID, getWorkflowEligibleAssistants, normalizeWorkflow } from './workflowStore.js'
    import {
      executeWorkflowTool,
      getWorkflowToolByType,
      getWorkflowToolOutputText,
      resolveWorkflowNodeInput
    } from './workflowTools.js'
    
    const activeWorkflowRuns = new Map()
    
    function deepClone(value) {
      return JSON.parse(JSON.stringify(value))
    }
    
    function createCancelError() {
      const error = new Error('工作流已停止')
      error.name = 'WorkflowCancelledError'
      error.code = 'WORKFLOW_CANCELLED'
      return error
    }
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/workflowStore.js
物理行数：392（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
getBuiltinAssistants, 工具与业务子模块。
以下为该文件开头的若干行：
    import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'
    import {
      getBuiltinAssistants,
      getBuiltinAssistantDefinition,
      getAssistantGroupLabel
    } from './assistantRegistry.js'
    import {
      getAssistantSetting,
      getCustomAssistants,
      getAssistantDisplayEntry
    } from './assistantSettings.js'
    import { getWorkflowToolByType, normalizeWorkflowInputBinding, normalizeWorkflowToolData } from './workflowTools.js'
    
    const WORKFLOW_STORAGE_KEY = 'workflowDefinitions'
    const WORKFLOW_STORAGE_VERSION = 1
    const START_NODE_ID = 'workflow_start'
    const END_NODE_ID = 'workflow_end'
    
    let listeners = new Set()
    
    function deepClone(value) {
      return JSON.parse(JSON.stringify(value))
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/workflowTools.js
物理行数：775（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
function deepClone(value) { 工具与业务子模块。
以下为该文件开头的若干行：
    import axios from 'axios'
    import { executeCapabilityBusRequest, getCapabilityBusCatalog } from './capabilityBus.js'
    
    function deepClone(value) {
      return JSON.parse(JSON.stringify(value))
    }
    
    function safeParseJson(raw, fallback = null) {
      if (raw == null || raw === '') return fallback
      if (typeof raw === 'object') return raw
      try {
        return JSON.parse(String(raw))
      } catch (_) {
        return fallback
      }
    }
    
    function stringifyOutput(value) {
      if (value == null) return ''
      if (typeof value === 'string') return value
      try {
        return JSON.stringify(value, null, 2)
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/wpsCapabilityCatalog.js
物理行数：531（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
function parseRequestedPageNumber(text = '') { 工具与业务子模块。
以下为该文件开头的若干行：
    import { getCurrentDocumentSavePath } from './documentFileActions.js'
    import { getSelectionContextSnapshot } from './documentContext.js'
    
    function parseRequestedPageNumber(text = '') {
      const matched = String(text || '').match(/第\s*([0-9]{1,4})\s*页/)
      return matched ? Number(matched[1]) : 0
    }
    
    function parseTableShape(text = '') {
      const normalized = String(text || '')
      const matched = normalized.match(/([0-9]{1,3})\s*[xX＊*]\s*([0-9]{1,3})/)
      if (matched) {
        return {
          rows: Math.max(1, Number(matched[1] || 0)),
          columns: Math.max(1, Number(matched[2] || 0))
        }
      }
      const rowsMatched = normalized.match(/([0-9]{1,3})\s*行/)
      const columnsMatched = normalized.match(/([0-9]{1,3})\s*列/)
      return {
        rows: Math.max(1, Number(rowsMatched?.[1] || 3)),
        columns: Math.max(1, Number(columnsMatched?.[1] || 3))
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/wpsCapabilityExecutor.js
物理行数：500（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
const activeCapabilityRuns = new Map() 工具与业务子模块。
以下为该文件开头的若干行：
    import { addTask, updateTask } from './taskListStore.js'
    import { getWpsCapabilityByKey } from './wpsCapabilityCatalog.js'
    import { openDocumentSaveAsDialog, saveActiveDocument, saveActiveDocumentAs } from './documentFileActions.js'
    import { decryptActiveDocument, encryptActiveDocument } from './documentSecurityActions.js'
    import { insertBlankPageAtPosition, insertPageBreakAtPosition, insertTableAtPosition } from './documentInsertActions.js'
    import { applyDocumentAction, getSelectedText } from './documentActions.js'
    import { executeDocumentFormatAction } from './documentFormatActions.js'
    import { executeDocumentRelocationAction } from './documentRelocationActions.js'
    import { buildGeneratedArtifactDescriptor, mergeTaskOrchestrationData } from './taskOrchestrationMeta.js'
    import { appendCapabilityAuditRecord } from './capabilityAuditStore.js'
    import { evaluateCapabilityPolicy, inferCapabilityRiskLevel } from './capabilityPolicyStore.js'
    import { appendCapabilityQuotaUsage, evaluateCapabilityQuota } from './capabilityQuotaStore.js'
    
    const activeCapabilityRuns = new Map()
    
    function createCancelError() {
      const err = new Error('任务已停止')
      err.code = 'TASK_CANCELLED'
      return err
    }
    
    function throwIfCancelled(runState) {
----------------------------------------------------------------------------

----------------------------------------------------------------------------
文件路径：src/utils/wpsCapabilityRouter.js
物理行数：148（生成时统计，不含已剔除的 <style> 块行）
作用与职责简述：
function parseJsonCandidate(raw) { 工具与业务子模块。
以下为该文件开头的若干行：
    import { chatCompletion } from './chatApi.js'
    import { getWpsCapabilityCatalog, getWpsCapabilityByKey } from './wpsCapabilityCatalog.js'
    
    function parseJsonCandidate(raw) {
      const text = String(raw || '').trim()
      if (!text) return null
      const block = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
      const candidate = block?.[1] ? block[1].trim() : text
      try {
        return JSON.parse(candidate)
      } catch (_) {
        const start = candidate.indexOf('{')
        const end = candidate.lastIndexOf('}')
        if (start >= 0 && end > start) {
          try {
            return JSON.parse(candidate.slice(start, end + 1))
          } catch (_) {
            return null
          }
        }
        return null
      }
----------------------------------------------------------------------------