<template>
  <section
    class="welcome-ad-slots"
    :class="{ 'welcome-ad-slots--embedded': embedded }"
    aria-label="察元产品家族"
  >
    <!-- 五块内容之 1-4:产品卡(2×2) -->
    <div class="welcome-ad-products">
      <article
        v-for="p in products"
        :key="p.id"
        class="welcome-ad-product"
        :class="{ 'welcome-ad-product--soon': p.soon }"
        :style="{ '--p-accent': p.color }"
        role="button"
        tabindex="0"
        @click="onProductClick(p)"
        @keydown.enter.prevent="onProductClick(p)"
      >
        <span class="welcome-ad-product-head">
          <span class="welcome-ad-product-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" v-html="p.icon"></svg>
          </span>
          <strong class="welcome-ad-product-name">{{ p.name }}</strong>
          <span v-if="p.soon" class="welcome-ad-product-soon">建设中</span>
          <span v-else-if="probingId === p.id" class="welcome-ad-product-probing">检测网络…</span>
        </span>
        <span class="welcome-ad-product-desc">{{ p.desc }}</span>
        <span class="welcome-ad-product-chips">
          <span v-for="c in p.chips" :key="c" class="welcome-ad-product-chip">{{ c }}</span>
        </span>
      </article>
    </div>

    <!-- 五块内容之 5:察元AI广场横幅 -->
    <button type="button" class="welcome-ad-plaza" @click="onPlazaClick">
      <span class="welcome-ad-plaza-globe" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <circle cx="12" cy="12" r="8.4" />
          <path d="M3.6 12h16.8" />
          <path d="M12 3.6c3.2 3.4 3.2 13.4 0 16.8M12 3.6c-3.2 3.4-3.2 13.4 0 16.8" />
        </svg>
        <span class="welcome-ad-plaza-orbit"></span>
      </span>
      <span class="welcome-ad-plaza-body">
        <strong class="welcome-ad-plaza-name">{{ plaza.name }}</strong>
        <span class="welcome-ad-plaza-desc">{{ plaza.desc }}</span>
        <span class="welcome-ad-plaza-badges">
          <span
            v-for="b in plaza.badges"
            :key="b.label"
            class="welcome-ad-plaza-badge"
            :class="b.cls"
          >{{ b.label }}</span>
        </span>
      </span>
      <span class="welcome-ad-plaza-cta" :class="{ 'welcome-ad-plaza-cta--busy': probingId === 'plaza' }">
        <template v-if="probingId === 'plaza'">检测网络…</template>
        <template v-else>{{ plaza.cta }}<span class="welcome-ad-plaza-arrow" aria-hidden="true">→</span></template>
      </span>
    </button>

    <!-- 原「离线广告招商」入口保留,收纳为一行小字 -->
    <div class="welcome-ad-legend">
      <button type="button" class="welcome-ad-legend-btn" @click="openDetail('full')">广告 · 招商</button>
    </div>

    <!-- 招商详情弹窗(原有能力,内容不变) -->
    <div
      v-if="detailVisible"
      class="welcome-ad-detail-overlay"
      @click.self="closeDetail"
    >
      <div class="welcome-ad-detail-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-ad-detail-title">
        <div class="welcome-ad-detail-header">
          <h4 id="welcome-ad-detail-title">离线广告招商</h4>
          <button type="button" class="welcome-ad-detail-close" aria-label="关闭" @click="closeDetail">×</button>
        </div>
        <div class="welcome-ad-detail-body">
          <p class="welcome-ad-detail-meta">
            当前规格：{{ activeSpec.name }}
          </p>
          <div class="welcome-ad-detail-sizebox">
            <div class="welcome-ad-detail-size-row">
              <span>展示尺寸</span>
              <strong>{{ activeSpec.display }}</strong>
            </div>
            <div class="welcome-ad-detail-size-row">
              <span>建议素材</span>
              <strong>{{ activeSpec.asset }}</strong>
            </div>
            <div class="welcome-ad-detail-size-row">
              <span>宽 × 高</span>
              <strong>{{ activeSpec.width }} × {{ activeSpec.height }} px</strong>
            </div>
            <p class="welcome-ad-detail-size-note">{{ activeSpec.note }}</p>
          </div>
          <p>
            察元 AI 文档助手开放离线广告合作，面向希望触达<strong>隔离办公与公文办理场景</strong>的品牌方、产品方与解决方案提供商：把展示带到用户写材料、审文件的日常路径里，接触真正在办事的决策者与业务骨干。
          </p>
          <p>
            与普通互联网广告不同，察元可在<strong>完全不联网</strong>的环境中本地运行。这意味着：即便单位内网隔离、禁止外联，用户仍能在软件里看到你的展示——这是外网投放覆盖不到的空白地带。
          </p>
          <p class="welcome-ad-detail-scenes">
            <strong>典型离线 / 隔离场景举例：</strong>
          </p>
          <ul class="welcome-ad-detail-list">
            <li><strong>党政机关与部委</strong>：国务院组成部门、直属机构，地方党委办、政府办、发改、工信、教育、卫健、公安等厅局，以及机要、保密相关办公环境。</li>
            <li><strong>军工与国防科研</strong>：军工集团及下属院所、研究所、总体部、试验场、涉密项目办；内网办公、涉密文档处理场景。</li>
            <li><strong>央企与地方国企</strong>：能源、电力、交通、通信、金融、装备制造等领域的总部与二级单位，常有分区隔离或业务专网。</li>
            <li><strong>教育与科研</strong>：高校机要处、研究生院、实验室、军工特色高校科研团队；部分校园网策略限制外联。</li>
            <li><strong>医疗、司法与关键设施</strong>：医院办公网、法院检察院内网、银行核心办公区、核电与能源基地等“能写文档但不能随便上网”的岗位。</li>
          </ul>
          <p>
            无论在线还是离线，只要用户在用察元处理公文与文档，你的产品就有机会被看见、被了解、被记住。欢迎垂询合作档位与素材规范。
          </p>
          <p class="welcome-ad-detail-contact">
            合作咨询：
            <a href="https://aidooo.com" target="_blank" rel="noreferrer" @click.prevent="openUrl('https://aidooo.com')">aidooo.com</a>
            ·
            <a href="mailto:cmdbird@163.com" @click.prevent="openUrl('mailto:cmdbird@163.com')">cmdbird@163.com</a>
          </p>
        </div>
        <div class="welcome-ad-detail-actions">
          <button type="button" class="welcome-ad-detail-btn" @click="closeDetail">知道了</button>
        </div>
      </div>
    </div>

    <!-- 离线炫酷介绍页:Teleport 到 body —— .welcome-support 的入场动画以 both
         填充残留 transform,会让内部 fixed 元素以它为包含块,逃逸出去才能全屏 -->
    <teleport to="body">
      <div
        v-if="showcaseVisible"
        class="welcome-ad-showcase"
        role="dialog"
        aria-modal="true"
        aria-label="察元AI介绍"
        @click.self="closeShowcase"
      >
        <div class="welcome-ad-sc-aurora welcome-ad-sc-aurora--1" aria-hidden="true"></div>
        <div class="welcome-ad-sc-aurora welcome-ad-sc-aurora--2" aria-hidden="true"></div>
        <div class="welcome-ad-sc-aurora welcome-ad-sc-aurora--3" aria-hidden="true"></div>
        <div class="welcome-ad-sc-stars" aria-hidden="true">
          <span
            v-for="(s, i) in scStars"
            :key="'star-' + i"
            class="welcome-ad-sc-star"
            :style="{ left: s.left, top: s.top, width: s.size, height: s.size, '--star-delay': s.delay, '--star-dur': s.dur }"
          ></span>
        </div>

        <div class="welcome-ad-sc-panel">
          <button type="button" class="welcome-ad-sc-close" aria-label="关闭介绍" @click="closeShowcase">×</button>

          <div class="welcome-ad-sc-brand">
            <span class="welcome-ad-sc-logo">察元AI</span>
            <span class="welcome-ad-sc-tag">把办公场景的 AI 助手做到 · 本地 · 安全 · 可信</span>
          </div>

          <p class="welcome-ad-sc-offline">
            <span class="welcome-ad-sc-offline-dot" aria-hidden="true"></span>
            当前处于离线环境，先带你预览{{ showcaseTitle }} —— 联网后即可直达 aidooo.com
          </p>

          <div
            v-if="showcaseProduct"
            class="welcome-ad-sc-product"
            :style="{ '--p-accent': showcaseProduct.color }"
          >
            <span class="welcome-ad-sc-product-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" v-html="showcaseProduct.icon"></svg>
            </span>
            <span class="welcome-ad-sc-product-copy">
              <strong class="welcome-ad-sc-product-name">{{ showcaseProduct.name }}</strong>
              <span class="welcome-ad-sc-product-desc">{{ showcaseProduct.desc }}</span>
              <span class="welcome-ad-sc-product-chips">
                <span v-for="c in showcaseProduct.chips" :key="c" class="welcome-ad-product-chip">{{ c }}</span>
              </span>
            </span>
          </div>

          <div class="welcome-ad-sc-plaza">
            <div class="welcome-ad-sc-plaza-head">
              <h5 class="welcome-ad-sc-plaza-name">察元AI广场</h5>
              <span class="welcome-ad-sc-plaza-url">aidooo.com</span>
            </div>
            <p class="welcome-ad-sc-count">
              <strong>{{ plazaCountDisplay }}</strong>
              <span>开源能力一站检索 —— 搜索即得安装命令，复制即用，支持一键下载</span>
            </p>
            <div class="welcome-ad-sc-plaza-badges">
              <span
                v-for="b in plaza.badges"
                :key="'sc-' + b.label"
                class="welcome-ad-plaza-badge"
                :class="b.cls"
              >{{ b.label }}</span>
            </div>
          </div>

          <div class="welcome-ad-sc-kinds">
            <div v-for="k in plazaKinds" :key="k.name" class="welcome-ad-sc-kind">
              <em class="welcome-ad-sc-kind-emoji" aria-hidden="true">{{ k.emoji }}</em>
              <strong class="welcome-ad-sc-kind-name">{{ k.name }}</strong>
              <span class="welcome-ad-sc-kind-desc">{{ k.desc }}</span>
            </div>
          </div>

          <p class="welcome-ad-sc-family">
            察元产品家族：察元AI OS · 察元AI Office · 察元AI 工舱 · 指挥调度平台（建设中）
          </p>

          <div class="welcome-ad-sc-actions">
            <button type="button" class="welcome-ad-sc-btn welcome-ad-sc-btn--primary" @click="retryOpen">
              ↗ 尝试直接打开 aidooo.com
            </button>
            <button type="button" class="welcome-ad-sc-btn" @click="copyShowcaseLink">
              {{ copied ? '已复制 ✓' : '复制链接' }}
            </button>
          </div>
          <p class="welcome-ad-sc-hint">联网后点击「进入广场」即可直达完整广场</p>
        </div>
      </div>
    </teleport>
  </section>
</template>

<script>
import { inAppAlert } from '../../utils/inAppDialog.js'

const SITE_URL = 'https://aidooo.com'
// 官网暂不支持各产品深链,统一落到产品家族页(与 chayuan-office 欢迎页共识一致)
const PRODUCTS_URL = `${SITE_URL}/products`
// 探测用小资源;no-cors 拿 opaque 响应,resolve 即视为联网
const PROBE_URL = `${SITE_URL}/favicon.ico`
const PROBE_CACHE_MS = 60000

// 文案口径:chayuan-office 欢迎页共识文案 + chayuan-harness 卖点(数据不出域/
// 单机跑模型/离线安全)+ 官网 chatopCopy(工舱「一个容器一名数字员工」)
const PRODUCTS = [
  {
    id: 'os',
    name: '察元AI OS',
    url: PRODUCTS_URL,
    desc: '装进电脑的 AI 智能体工作站，断网也能单机跑大模型',
    chips: ['数据不出域', '单机跑模型', '安全离线'],
    color: '#38bdf8',
    icon: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'
  },
  {
    id: 'office',
    name: '察元AI Office',
    url: PRODUCTS_URL,
    desc: '一句话完成文档 / 表格 / 演示稿的编写与校对',
    chips: ['文档·表格·演示稿', '对话直驱', '开源免费'],
    color: '#34d399',
    icon: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 12h5M10 16h5"/>'
  },
  {
    id: 'pod',
    name: '察元AI 工舱',
    url: PRODUCTS_URL,
    desc: '浏览器一开，AI 员工到岗 —— 一个容器一名数字员工',
    chips: ['预装 AI 智能体', '单端口安全', '开箱即用'],
    color: '#a78bfa',
    icon: '<path d="M4 11h16v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 11l2.5-4h11L20 11"/><path d="M11 15h2"/>'
  },
  {
    id: 'cmd',
    name: '察元AI指挥调度平台',
    soon: true,
    desc: '一块大屏指挥所有工舱，多智能体编排与调度',
    chips: ['一句话派活', '任务调度', '多舱协同'],
    color: '#fbbf24',
    icon: '<circle cx="12" cy="12" r="2.4"/><circle cx="5.5" cy="5.5" r="2"/><circle cx="18.5" cy="5.5" r="2"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/><path d="M7.2 6.7l2.7 2.7M16.8 6.7l-2.7 2.7M7.2 17.3l2.7-2.7M16.8 17.3l-2.7-2.7"/>'
  }
]

const PLAZA = {
  id: 'plaza',
  name: '察元AI广场',
  url: SITE_URL,
  desc: '插件 · 技能 · MCP · 大模型 · 技能包，2.5万+ 资源一站检索',
  cta: '进入广场',
  badges: [
    { label: '免费模型榜', cls: '--b0' },
    { label: '智力排行', cls: '--b1' },
    { label: 'API 比价', cls: '--b2' },
    { label: '厂商折扣', cls: '--b3' }
  ]
}

// 广场八大资源板块(口径来自官网 server/market/kinds.js)
const PLAZA_KINDS = [
  { emoji: '🧩', name: 'Harness 插件', desc: '一行命令安装的桌面插件' },
  { emoji: '⚡', name: 'Skills 技能', desc: '装进 Harness 的技能包' },
  { emoji: '🔌', name: 'MCP 服务器', desc: '标准协议工具服务' },
  { emoji: '💬', name: '提示词', desc: '高质量提示词模板' },
  { emoji: '🤖', name: '智能体应用', desc: '智能体应用与工作流' },
  { emoji: '🧠', name: '大模型', desc: '目录 · 价格 · 能力' },
  { emoji: '🏢', name: '模型厂商', desc: '免费 / 免 key / 本地' },
  { emoji: '📰', name: '资讯', desc: '生态动态与新闻' }
]

// 固定种子伪随机星点:避免每次重渲染位置跳变
const SC_STARS = Array.from({ length: 18 }, (_, i) => {
  const r = (n) => {
    const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453
    return x - Math.floor(x)
  }
  return {
    left: (r(1) * 100).toFixed(2) + '%',
    top: (r(2) * 100).toFixed(2) + '%',
    size: (1 + r(3) * 1.8).toFixed(2) + 'px',
    delay: (r(4) * 4).toFixed(2) + 's',
    dur: (2.4 + r(5) * 2.8).toFixed(2) + 's'
  }
})

/**
 * 站点可达性探测:no-cors 模式下无 CORS 头的目标站也能 resolve(opaque 响应),
 * 只有请求根本落不了地(DNS 失败/连接拒绝/超时)才 reject —— 以此区分在线/离线,
 * 与 localEngineSetup.isSourceReachable 的"只看落地"口径一致但不受 CORS 头限制。
 */
function probeSiteReachable(url, timeoutMs = 4500) {
  return new Promise((resolve) => {
    let settled = false
    let ctrl = null
    try { ctrl = new AbortController() } catch (_) { ctrl = null }
    const finish = (ok) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(ok)
    }
    const timer = setTimeout(() => {
      try { ctrl?.abort() } catch (_) { /* ignore */ }
      finish(false)
    }, timeoutMs)
    fetch(url, { mode: 'no-cors', cache: 'no-store', signal: ctrl?.signal })
      .then(() => finish(true), () => finish(false))
  })
}

const AD_SPECS = {
  full: {
    name: '一行一个（通栏）',
    label: '640 × 80 px',
    width: 640,
    height: 80,
    display: '通栏，宽 100%，高 80px',
    asset: '640 × 80 px（JPG / PNG / WebP）',
    note: '素材按 640×80 设计；界面按容器宽度等比缩放，高度固定 80px。'
  },
  half: {
    name: '一行两个（半栏）',
    label: '312 × 100 px',
    width: 312,
    height: 100,
    display: '半栏，宽约 50%（含间距），高 100px',
    asset: '312 × 100 px（JPG / PNG / WebP）',
    note: '同行两个广告位；素材按 312×100 设计，高度固定 100px，左右各占一半宽度。'
  }
}

export default {
  name: 'WelcomeAdSlots',
  props: {
    embedded: { type: Boolean, default: false }
  },
  data() {
    return {
      detailVisible: false,
      activeLayout: 'full',
      specs: AD_SPECS,
      // 当前正在探测联网的板块 id('' = 空闲)
      probingId: '',
      showcaseVisible: false,
      // 离线介绍页由哪块内容唤起:null=广场,'os'/'office'/'pod'=产品卡
      showcaseProductId: null,
      // 联网探测结果缓存(60s 内复用,避免连点重复等 4.5s)
      netCache: { online: null, at: 0 },
      // 广场资源量数字滚动(0 → 2.5,展示为 x.x万+)
      plazaCount: 0,
      copied: false,
      products: PRODUCTS,
      plaza: PLAZA,
      plazaKinds: PLAZA_KINDS,
      scStars: SC_STARS
    }
  },
  computed: {
    activeSpec() {
      return this.specs[this.activeLayout] || this.specs.full
    },
    showcaseProduct() {
      if (!this.showcaseProductId) return null
      return PRODUCTS.find(p => p.id === this.showcaseProductId) || null
    },
    showcaseTitle() {
      return this.showcaseProduct ? this.showcaseProduct.name : '广场'
    },
    showcaseUrl() {
      return this.showcaseProduct?.url || this.plaza.url
    },
    plazaCountDisplay() {
      return `${this.plazaCount.toFixed(1)}万+`
    }
  },
  beforeUnmount() {
    this.removeShowcaseEscGuard()
    this.cancelCountUp()
  },
  methods: {
    onProductClick(p) {
      if (p.soon) {
        // 与 chayuan-office 欢迎页一致:待建产品不跳转,toast 提示
        inAppAlert(`${p.name} 建设中，敬请期待。`, { title: '建设中' })
        return
      }
      this.handleLinkClick(p)
    },
    onPlazaClick() {
      this.handleLinkClick(this.plaza)
    },
    /** 点击外链板块:探测联网 → 在线打开官网,离线弹介绍页 */
    async handleLinkClick(item) {
      if (this.probingId) return
      this.probingId = item.id
      try {
        const online = await this.probeNetworkOnline()
        if (online) {
          // 打开动作交给宿主:复用 openExternalWebsite 的
          // ShellExecute→FollowHyperlink→window.open→剪贴板多重回退
          this.$emit('open-external', item.url)
        } else {
          this.openShowcase(item.id === 'plaza' ? null : item.id)
        }
      } finally {
        this.probingId = ''
      }
    },
    async probeNetworkOnline() {
      // navigator.onLine 为 false 是确定性离线,直接短路
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
      const now = Date.now()
      if (this.netCache.online !== null && now - this.netCache.at < PROBE_CACHE_MS) {
        return this.netCache.online
      }
      const ok = await probeSiteReachable(PROBE_URL)
      this.netCache = { online: ok, at: Date.now() }
      return ok
    },
    openShowcase(productId) {
      this.showcaseProductId = productId
      this.showcaseVisible = true
      this.copied = false
      this.startCountUp()
      this.addShowcaseEscGuard()
    },
    closeShowcase() {
      this.showcaseVisible = false
      this.removeShowcaseEscGuard()
      this.cancelCountUp()
    },
    /** 探测误判(如防火墙拦 fetch 但浏览器其实能开)时的逃生通道:不探测直接多重回退打开 */
    retryOpen() {
      this.$emit('open-external', this.showcaseUrl)
    },
    async copyShowcaseLink() {
      const url = this.showcaseUrl
      try {
        const textarea = document.createElement('textarea')
        textarea.value = url
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        this.copied = true
        inAppAlert(`链接已复制，可在浏览器中粘贴打开：\n${url}`, { title: '复制链接' })
      } catch (_) {
        inAppAlert(`复制失败，请手动记录链接：\n${url}`, { title: '复制链接' })
      }
    },
    startCountUp() {
      this.cancelCountUp()
      const reduce = typeof matchMedia === 'function' &&
        matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduce) {
        this.plazaCount = 2.5
        return
      }
      const duration = 900
      const t0 = performance.now()
      // easeOutCubic
      const tick = () => {
        const k = Math.min(1, (performance.now() - t0) / duration)
        this.plazaCount = 2.5 * (1 - Math.pow(1 - k, 3))
        if (k < 1) {
          this._scRaf = this._rafOk ? requestAnimationFrame(tick) : setTimeout(tick, 16)
        } else {
          this._scRaf = null
        }
      }
      // 个别嵌入式 webview 不产渲染帧、rAF 永不回调:启动前探测一次,
      // 不可用则降级 setTimeout 驱动,保证任何环境都能数完
      if (this._rafOk !== undefined) {
        if (this._rafOk && typeof requestAnimationFrame === 'function') tick()
        else if (!this._rafOk) tick()
        return
      }
      if (typeof requestAnimationFrame !== 'function') {
        this._rafOk = false
        tick()
        return
      }
      let fired = false
      requestAnimationFrame(() => { fired = true })
      setTimeout(() => {
        this._rafOk = fired
        if (this.showcaseVisible) tick()
      }, 150)
    },
    cancelCountUp() {
      if (this._scRaf == null) return
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._scRaf)
      clearTimeout(this._scRaf)
      this._scRaf = null
    },
    addShowcaseEscGuard() {
      if (this._scEscBound) return
      this._scEscBound = (e) => {
        if (e.key === 'Escape') this.closeShowcase()
      }
      document.addEventListener('keydown', this._scEscBound)
    },
    removeShowcaseEscGuard() {
      if (!this._scEscBound) return
      document.removeEventListener('keydown', this._scEscBound)
      this._scEscBound = null
    },
    openDetail(layout) {
      this.activeLayout = layout
      this.detailVisible = true
    },
    closeDetail() {
      this.detailVisible = false
    },
    openUrl(url) {
      const normalizedUrl = String(url || '').trim()
      if (!normalizedUrl) return
      const app = window.Application || window.opener?.Application || window.parent?.Application
      try {
        if (app?.OAAssist?.ShellExecute) {
          app.OAAssist.ShellExecute(normalizedUrl)
          return
        }
        if (app?.FollowHyperlink) {
          app.FollowHyperlink(normalizedUrl, '', true)
          return
        }
      } catch (_) { /* fall through */ }
      if (normalizedUrl.startsWith('mailto:')) {
        window.location.href = normalizedUrl
        return
      }
      window.open(normalizedUrl, '_blank', 'noopener,noreferrer')
    }
  }
}
</script>

<style scoped>
.welcome-ad-slots {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  margin-top: 12px;
  flex-shrink: 0;
}

.welcome-ad-slots--embedded {
  margin-top: 8px;
}

/* ---------- 产品卡(2×2,窄面板自动降为单列) ---------- */

.welcome-ad-products {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.welcome-ad-product {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 92px;
  padding: 9px 10px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  border-radius: 10px;
  background: linear-gradient(150deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.84));
  color: #e2e8f0;
  cursor: pointer;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
  /* 入场只做淡入:若带 transform 会以 fill 留存,压掉 hover 的位移 */
  animation: welcome-ad-fade-in 0.45s ease both;
}

.welcome-ad-product:nth-child(1) { animation-delay: 0.02s; }
.welcome-ad-product:nth-child(2) { animation-delay: 0.08s; }
.welcome-ad-product:nth-child(3) { animation-delay: 0.14s; }
.welcome-ad-product:nth-child(4) { animation-delay: 0.2s; }

.welcome-ad-product:hover,
.welcome-ad-product:focus-visible {
  outline: none;
  border-color: var(--p-accent, rgba(56, 189, 248, 0.65));
  transform: translateY(-2px);
  box-shadow: 0 8px 20px -8px var(--p-accent, rgba(56, 189, 248, 0.6));
}

.welcome-ad-product--soon {
  cursor: default;
  filter: saturate(0.75) brightness(0.88);
}

.welcome-ad-product--soon:hover {
  transform: none;
  box-shadow: none;
  border-color: rgba(148, 163, 184, 0.26);
}

.welcome-ad-product-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.welcome-ad-product-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--p-accent, #38bdf8);
  background: rgba(148, 163, 184, 0.1);
  color: var(--p-accent, #38bdf8);
}

.welcome-ad-product-icon svg {
  width: 17px;
  height: 17px;
}

.welcome-ad-product-name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.welcome-ad-product-soon {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(251, 191, 36, 0.16);
  color: #fbbf24;
  font-size: 10px;
  font-weight: 700;
}

.welcome-ad-product-probing {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.16);
  color: #7dd3fc;
  font-size: 10px;
  font-weight: 600;
}

.welcome-ad-product-desc {
  color: rgba(148, 163, 184, 0.95);
  font-size: 11px;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.welcome-ad-product-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: auto;
}

.welcome-ad-product-chip {
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(148, 163, 184, 0.08);
  color: #cbd5e1;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

/* ---------- 察元AI广场横幅 ---------- */

.welcome-ad-plaza {
  display: flex;
  align-items: center;
  gap: 10px;
  /* button 默认按内容收缩,显式占满整行 */
  width: 100%;
  align-self: stretch;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid rgba(125, 211, 252, 0.26);
  border-radius: 12px;
  /* 官网品牌渐变(靛蓝→紫罗兰)压暗叠在深底上 */
  background:
    linear-gradient(135deg, rgba(91, 124, 250, 0.22), rgba(139, 92, 246, 0.18)),
    linear-gradient(150deg, rgba(30, 41, 59, 0.92), rgba(15, 23, 42, 0.86));
  color: #e2e8f0;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
  animation: welcome-ad-fade-in 0.45s ease 0.26s both;
}

.welcome-ad-plaza:hover {
  border-color: rgba(125, 211, 252, 0.6);
  transform: translateY(-2px);
  box-shadow: 0 10px 24px -10px rgba(91, 124, 250, 0.65);
}

.welcome-ad-plaza-globe {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  color: #7dd3fc;
}

.welcome-ad-plaza-globe > svg {
  width: 30px;
  height: 30px;
}

.welcome-ad-plaza-orbit {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 1px dashed rgba(125, 211, 252, 0.45);
  animation: welcome-ad-spin 14s linear infinite;
}

.welcome-ad-plaza-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.welcome-ad-plaza-name {
  font-size: 13px;
  font-weight: 700;
  color: #f1f5f9;
}

.welcome-ad-plaza-desc {
  color: rgba(148, 163, 184, 0.95);
  font-size: 11px;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.welcome-ad-plaza-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.welcome-ad-plaza-badge {
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

.welcome-ad-plaza-badge--b0 {
  background: rgba(96, 165, 250, 0.16);
  color: #93c5fd;
}

.welcome-ad-plaza-badge--b1 {
  background: rgba(74, 222, 128, 0.14);
  color: #86efac;
}

.welcome-ad-plaza-badge--b2 {
  background: rgba(251, 146, 60, 0.15);
  color: #fdba74;
}

.welcome-ad-plaza-badge--b3 {
  background: rgba(192, 132, 252, 0.16);
  color: #d8b4fe;
}

.welcome-ad-plaza-cta {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(91, 124, 250, 0.24);
  border: 1px solid rgba(125, 211, 252, 0.35);
  color: #bfdbfe;
  font-size: 11px;
  font-weight: 700;
}

.welcome-ad-plaza-cta--busy {
  color: #7dd3fc;
  font-weight: 600;
}

.welcome-ad-plaza-arrow {
  transition: transform 0.16s ease;
}

.welcome-ad-plaza:hover .welcome-ad-plaza-arrow {
  transform: translateX(2px);
}

/* ---------- 招商入口(收纳为一行小字) ---------- */

.welcome-ad-legend {
  display: flex;
  justify-content: flex-end;
}

.welcome-ad-legend-btn {
  border: none;
  background: transparent;
  padding: 1px 2px;
  color: rgba(100, 116, 139, 0.9);
  font-size: 10px;
  cursor: pointer;
}

.welcome-ad-legend-btn:hover {
  color: #94a3b8;
  text-decoration: underline;
}

/* ---------- 招商详情弹窗(原有样式保留) ---------- */

.welcome-ad-detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.55);
}

.welcome-ad-detail-modal {
  width: min(100%, 440px);
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: #0f172a;
  color: #e2e8f0;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.35);
}

.welcome-ad-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 8px;
}

.welcome-ad-detail-header h4 {
  margin: 0;
  font-size: 16px;
}

.welcome-ad-detail-close {
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.welcome-ad-detail-body {
  padding: 4px 16px 8px;
  font-size: 13px;
  line-height: 1.7;
  color: rgba(226, 232, 240, 0.88);
  max-height: min(58vh, 420px);
  overflow-y: auto;
}

.welcome-ad-detail-meta {
  margin: 0 0 10px;
  color: #94a3b8;
  font-size: 12px;
}

.welcome-ad-detail-sizebox {
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid rgba(56, 189, 248, 0.28);
  border-radius: 10px;
  background: rgba(14, 165, 233, 0.08);
}

.welcome-ad-detail-size-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: #94a3b8;
}

.welcome-ad-detail-size-row + .welcome-ad-detail-size-row {
  margin-top: 6px;
}

.welcome-ad-detail-size-row strong {
  color: #e2e8f0;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.welcome-ad-detail-size-note {
  margin: 8px 0 0;
  color: rgba(148, 163, 184, 0.9);
  font-size: 11px;
  line-height: 1.55;
}

.welcome-ad-detail-scenes {
  margin: 12px 0 6px;
  color: #e2e8f0;
}

.welcome-ad-detail-list {
  margin: 0 0 10px;
  padding-left: 1.15em;
  color: rgba(226, 232, 240, 0.86);
}

.welcome-ad-detail-list li + li {
  margin-top: 6px;
}

.welcome-ad-detail-contact {
  margin-top: 12px;
  color: #94a3b8;
  font-size: 12px;
}

.welcome-ad-detail-contact a {
  color: #7dd3fc;
  text-decoration: none;
}

.welcome-ad-detail-contact a:hover {
  text-decoration: underline;
}

.welcome-ad-detail-actions {
  display: flex;
  justify-content: flex-end;
  padding: 8px 16px 14px;
}

.welcome-ad-detail-btn {
  min-width: 88px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: #0ea5e9;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.welcome-ad-detail-btn:hover {
  background: #0284c7;
}

/* ---------- 离线炫酷介绍页(Teleport 至 body) ---------- */

.welcome-ad-showcase {
  position: fixed;
  inset: 0;
  z-index: 2147482500; /* 低于 inAppAlert(2147483600),提示框可盖在其上 */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  box-sizing: border-box;
  background: radial-gradient(1100px 640px at 18% -8%, #0b1533 0%, #050810 58%) #050810;
  overflow: hidden;
  animation: welcome-ad-sc-fade 0.35s ease both;
}

.welcome-ad-sc-aurora {
  position: absolute;
  border-radius: 50%;
  filter: blur(64px);
  opacity: 0.32;
  pointer-events: none;
}

.welcome-ad-sc-aurora--1 {
  width: 440px;
  height: 440px;
  top: -130px;
  left: -110px;
  background: radial-gradient(circle at 32% 32%, rgba(91, 124, 250, 0.6), transparent 62%);
  animation: welcome-ad-aurora-1 22s ease-in-out infinite alternate;
}

.welcome-ad-sc-aurora--2 {
  width: 480px;
  height: 480px;
  bottom: -160px;
  right: -130px;
  background: radial-gradient(circle at 60% 42%, rgba(168, 85, 247, 0.5), transparent 64%);
  animation: welcome-ad-aurora-2 26s ease-in-out infinite alternate;
}

.welcome-ad-sc-aurora--3 {
  width: 320px;
  height: 320px;
  top: 28%;
  left: 56%;
  background: radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.4), transparent 60%);
  animation: welcome-ad-aurora-3 18s ease-in-out infinite alternate;
}

.welcome-ad-sc-stars {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.welcome-ad-sc-star {
  position: absolute;
  border-radius: 50%;
  background: #e2e8f0;
  opacity: 0.2;
  animation: welcome-ad-twinkle var(--star-dur, 3s) ease-in-out var(--star-delay, 0s) infinite;
}

.welcome-ad-sc-panel {
  position: relative;
  width: min(600px, 100%);
  max-height: 92vh;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 22px 22px 18px;
  border-radius: 18px;
  border: 1px solid rgba(125, 211, 252, 0.22);
  background: rgba(10, 16, 32, 0.74);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

/* 面板内各分区错峰升起;子元素容器升起不影响内部交互元素的 hover 位移 */
.welcome-ad-sc-panel > * {
  animation: welcome-ad-sc-rise 0.5s cubic-bezier(0.2, 0.7, 0.3, 1) both;
}

.welcome-ad-sc-panel > *:nth-child(1) { animation-delay: 0.05s; }
.welcome-ad-sc-panel > *:nth-child(2) { animation-delay: 0.11s; }
.welcome-ad-sc-panel > *:nth-child(3) { animation-delay: 0.17s; }
.welcome-ad-sc-panel > *:nth-child(4) { animation-delay: 0.23s; }
.welcome-ad-sc-panel > *:nth-child(5) { animation-delay: 0.29s; }
.welcome-ad-sc-panel > *:nth-child(6) { animation-delay: 0.35s; }
.welcome-ad-sc-panel > *:nth-child(7) { animation-delay: 0.41s; }
.welcome-ad-sc-panel > *:nth-child(8) { animation-delay: 0.47s; }
.welcome-ad-sc-panel > *:nth-child(9) { animation-delay: 0.53s; }
.welcome-ad-sc-panel > *:nth-child(10) { animation-delay: 0.59s; }

.welcome-ad-sc-close {
  position: absolute;
  top: 10px;
  right: 12px;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  z-index: 1;
}

.welcome-ad-sc-close:hover {
  color: #e2e8f0;
}

.welcome-ad-sc-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 4px 0 12px;
}

.welcome-ad-sc-logo {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: 0.14em;
  background: linear-gradient(100deg, #7dd3fc 12%, #c084fc 38%, #7dd3fc 62%, #4ade80 88%);
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: welcome-ad-shimmer 5s linear infinite;
}

.welcome-ad-sc-tag {
  color: #94a3b8;
  font-size: 11.5px;
  letter-spacing: 0.06em;
}

.welcome-ad-sc-offline {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 12px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(251, 191, 36, 0.3);
  background: rgba(251, 191, 36, 0.08);
  color: #fcd34d;
  font-size: 11.5px;
  line-height: 1.5;
}

.welcome-ad-sc-offline-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #fbbf24;
  animation: welcome-ad-pulse 1.6s ease-in-out infinite;
}

.welcome-ad-sc-product {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--p-accent, rgba(125, 211, 252, 0.4));
  border-left: 3px solid var(--p-accent, #7dd3fc);
  background: rgba(148, 163, 184, 0.06);
}

.welcome-ad-sc-product-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid var(--p-accent, #7dd3fc);
  color: var(--p-accent, #7dd3fc);
}

.welcome-ad-sc-product-icon svg {
  width: 20px;
  height: 20px;
}

.welcome-ad-sc-product-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.welcome-ad-sc-product-name {
  font-size: 13.5px;
  font-weight: 700;
  color: #f1f5f9;
}

.welcome-ad-sc-product-desc {
  color: rgba(148, 163, 184, 0.95);
  font-size: 11.5px;
  line-height: 1.5;
}

.welcome-ad-sc-product-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.welcome-ad-sc-plaza {
  margin: 0 0 12px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(125, 211, 252, 0.24);
  background:
    linear-gradient(135deg, rgba(91, 124, 250, 0.16), rgba(139, 92, 246, 0.12)),
    rgba(15, 23, 42, 0.5);
}

.welcome-ad-sc-plaza-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.welcome-ad-sc-plaza-name {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: #f1f5f9;
  letter-spacing: 0.04em;
}

.welcome-ad-sc-plaza-url {
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(125, 211, 252, 0.14);
  color: #7dd3fc;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.welcome-ad-sc-count {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  margin: 0 0 8px;
}

.welcome-ad-sc-count strong {
  font-size: 32px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  background: linear-gradient(120deg, #60a5fa, #c084fc);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 0 24px rgba(96, 165, 250, 0.25);
}

.welcome-ad-sc-count span {
  color: rgba(148, 163, 184, 0.95);
  font-size: 11.5px;
  line-height: 1.5;
}

.welcome-ad-sc-plaza-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.welcome-ad-sc-kinds {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-bottom: 12px;
}

.welcome-ad-sc-kind {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 9px 6px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(148, 163, 184, 0.06);
  text-align: center;
  transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
}

.welcome-ad-sc-kind:hover {
  transform: translateY(-2px);
  border-color: rgba(125, 211, 252, 0.45);
  background: rgba(56, 189, 248, 0.1);
}

.welcome-ad-sc-kind-emoji {
  font-size: 16px;
  font-style: normal;
  line-height: 1.2;
}

.welcome-ad-sc-kind-name {
  font-size: 11px;
  font-weight: 700;
  color: #e2e8f0;
  white-space: nowrap;
}

.welcome-ad-sc-kind-desc {
  color: #94a3b8;
  font-size: 10px;
  line-height: 1.4;
}

.welcome-ad-sc-family {
  margin: 0 0 12px;
  color: rgba(148, 163, 184, 0.9);
  font-size: 11px;
  line-height: 1.6;
  text-align: center;
}

.welcome-ad-sc-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.welcome-ad-sc-btn {
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(148, 163, 184, 0.1);
  color: #e2e8f0;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}

.welcome-ad-sc-btn:hover {
  transform: translateY(-1px);
}

.welcome-ad-sc-btn--primary {
  border: none;
  background: linear-gradient(135deg, #5b7cfa, #8b5cf6);
  box-shadow: 0 8px 22px -8px rgba(91, 124, 250, 0.7);
}

.welcome-ad-sc-btn--primary:hover {
  box-shadow: 0 12px 26px -8px rgba(91, 124, 250, 0.85);
}

.welcome-ad-sc-hint {
  margin: 0;
  color: rgba(100, 116, 139, 0.95);
  font-size: 10.5px;
  text-align: center;
}

/* ---------- 动画 ---------- */

@keyframes welcome-ad-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes welcome-ad-spin {
  to { transform: rotate(360deg); }
}

@keyframes welcome-ad-sc-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes welcome-ad-sc-rise {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
}

@keyframes welcome-ad-shimmer {
  to { background-position: -220% 0; }
}

@keyframes welcome-ad-pulse {
  0%, 100% { opacity: 0.35; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1.1); }
}

@keyframes welcome-ad-twinkle {
  0%, 100% { opacity: 0.12; transform: scale(0.8); }
  50% { opacity: 0.9; transform: scale(1.15); }
}

@keyframes welcome-ad-aurora-1 {
  to { transform: translate(70px, 46px) scale(1.16); }
}

@keyframes welcome-ad-aurora-2 {
  to { transform: translate(-60px, -52px) scale(1.12); }
}

@keyframes welcome-ad-aurora-3 {
  to { transform: translate(-48px, 38px) scale(1.2); }
}

/* ---------- 响应式与无动画偏好 ---------- */

@media (max-width: 350px) {
  .welcome-ad-products {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .welcome-ad-sc-kinds {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .welcome-ad-product,
  .welcome-ad-plaza,
  .welcome-ad-showcase,
  .welcome-ad-sc-panel > *,
  .welcome-ad-sc-logo,
  .welcome-ad-sc-offline-dot,
  .welcome-ad-sc-star,
  .welcome-ad-sc-aurora,
  .welcome-ad-plaza-orbit {
    animation: none !important;
  }
}
</style>
