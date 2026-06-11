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
        <div v-else class="about-hero-logo-fallback" />
      </div>
    </header>

    <section class="about-section">
      <h2 class="about-h2">察元是什么</h2>
      <div class="about-intro-card">
        <p>
          <strong>察元(Chayuan)</strong>不是一个孤立工具,而是一组共享同一套<strong>对话引擎 / 知识库结构 / 设计系统</strong>的 AI 办公产品。
          按部署形态和模块边界分为 <strong>4 档</strong>:WPS 加载项、单机桌面版、服务版(团队)、至臻版(企业)。
          你现在使用的就是<strong>WPS 加载项</strong> — 把大模型直接写进 WPS Writer,在不离开文档的情况下完成对话、检索、审校与写回。
        </p>
        <p>
          四个产品的"差异"只在<strong>部署位置 / 用户上限 / 模块开放度</strong>,引擎层完全一致。这意味着:
          团队从 WPS 加载项迁到桌面版,助手 / 模型 / 知识库设置几乎零迁移成本;
          再到服务版,只是把"单机"变成"≤50 人服务化";
          再升到至臻版,补齐<strong>在线办公 / 智能空间 / 应用市场 / 训练数据中心</strong>四个企业级模块。
        </p>
        <p class="about-intro-offline">
          <strong>离线模型与数据边界:</strong>无论哪一档,察元都把<strong>离线 / 本地大模型</strong>列为一等公民 —
          可接 Ollama / LM Studio / Xinference / OneAPI / vLLM 等 OpenAI 兼容网关;
          密钥、对话、知识库、向量索引全部落在<strong>本机或单位内网</strong>,适合<strong>外网隔离、数据不出域、合规审计</strong>场景。
          云端 API 与离线模型可以同时配置,按会话或助手灵活切换。
        </p>
        <p>
          下方架构图把四个产品和六大共享模块的关系画出来 —
          点任意节点能看到它的核心能力以及和其它产品 / 模块之间的连接关系。
        </p>
      </div>

      <!-- ───── 至臻版 4 大模块实景截图(取自 aidooo.com 官方) ───── -->
      <div class="about-modules-gallery">
        <p class="about-modules-gallery-eyebrow">至臻版(企业版)四大独有模块 · 实景</p>
        <p class="about-muted about-modules-gallery-lead">
          以下截图来自官方网站
          <a class="about-inline-link" href="https://aidooo.com" target="_blank" rel="noreferrer" @click.prevent="openAidooo">aidooo.com</a>,
          展示<strong>至臻版客户端</strong>独有的四个企业级模块。当前 WPS 加载项 / 桌面版 / 服务版均不含这些模块;
          需要的话可联系商务定制。
        </p>
        <div class="about-modules-grid">
          <figure
            v-for="m in premiumModuleShots"
            :key="m.key"
            class="about-module-shot"
            tabindex="0"
            role="button"
            :aria-label="`${m.title} · 点击放大`"
            @click="openShotLightbox({ src: m.src, alt: m.title, caption: m.caption })"
            @keydown.enter.prevent="openShotLightbox({ src: m.src, alt: m.title, caption: m.caption })"
            @keydown.space.prevent="openShotLightbox({ src: m.src, alt: m.title, caption: m.caption })"
          >
            <div class="about-module-shot-frame">
              <div class="about-module-shot-bar" aria-hidden="true">
                <span class="about-module-shot-dot is-r"></span>
                <span class="about-module-shot-dot is-y"></span>
                <span class="about-module-shot-dot is-g"></span>
                <span class="about-module-shot-url">aidooo.com / {{ m.urlPath }}</span>
              </div>
              <img
                v-if="!moduleShotErr[m.key]"
                class="about-module-shot-img"
                :src="publicAssetUrl(m.src)"
                :alt="m.title"
                loading="lazy"
                @error="onModuleShotError(m.key)"
              />
              <div v-else class="about-module-shot-placeholder">{{ m.title }}</div>
            </div>
            <figcaption>
              <span class="about-module-shot-tag">模块 0{{ m.idx }} · {{ m.tag }}</span>
              <strong>{{ m.title }}</strong>
              <span class="about-module-shot-desc">{{ m.caption }}</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>

    <!-- ───── 察元产品家族(4 SKU 关系图) ───── -->
    <section class="about-section about-family">
      <h2 class="about-h2">察元产品家族</h2>
      <p class="about-muted">
        同一套设计 / 知识库结构 / 对话引擎,按部署形态和模块边界分 4 档。
        <strong>你正在使用的是左侧第一档</strong> — 限量免费、数据可本地 / 内网的 WPS 加载项。
      </p>
      <div class="about-family-grid">
        <article
          v-for="sku in productFamily"
          :key="sku.key"
          class="about-family-card"
          :class="[`is-${sku.tone}`, { 'is-current': sku.current }]"
        >
          <header class="about-family-head">
            <span class="about-family-icon">{{ sku.icon }}</span>
            <div>
              <h3 class="about-family-name">{{ sku.name }}</h3>
              <p class="about-family-sub">{{ sku.sub }}</p>
            </div>
            <span v-if="sku.current" class="about-family-badge">当前在用</span>
            <span v-else-if="sku.tone === 'highlight'" class="about-family-badge about-family-badge-warm">推荐企业</span>
          </header>
          <p class="about-family-pitch">{{ sku.pitch }}</p>
          <ul class="about-family-points">
            <li v-for="(p, i) in sku.points" :key="i">{{ p }}</li>
          </ul>
          <footer class="about-family-foot">
            <span class="about-family-price">{{ sku.price }}</span>
            <span class="about-family-cta">{{ sku.cta }}</span>
          </footer>
        </article>
      </div>
      <p class="about-muted about-family-foot-note">
        想了解服务版 / 至臻版?发邮件到
        <a class="about-inline-link" href="mailto:cmdbird@163.com" @click.prevent="openExternal('mailto:cmdbird@163.com')">cmdbird@163.com</a>
        或访问
        <a class="about-inline-link" href="https://aidooo.com" target="_blank" rel="noreferrer" @click.prevent="openAidooo">aidooo.com</a>
        按部署形态 / 模块 / 用户数定制授权。
      </p>
    </section>

    <!-- ───── 互联架构拓扑(炫酷可点击) ───── -->
    <section class="about-section about-architecture-wrap">
      <AboutChayuanArchitecture />
    </section>

    <section class="about-section">
      <h2 class="about-h2">主要功能</h2>
      <ul class="about-features">
        <li v-for="f in featureList" :key="f.title" class="about-feature-card">
          <img class="about-feature-icon" :src="iconUrl(f.icon)" alt="" />
          <div>
            <div class="about-feature-title">{{ f.title }}</div>
            <p class="about-feature-desc">{{ f.desc }}</p>
          </div>
        </li>
      </ul>
    </section>

    <section class="about-section">
      <h2 class="about-h2">界面掠影</h2>
      <p class="about-muted">
        以下为察元在 WPS 文字中的主要界面示意；图片随版本更新。
      </p>
      <div class="about-shots">
        <figure v-for="s in screenshotSlots" :key="s.key" class="about-shot">
          <img
            v-if="!shotErr[s.key]"
            class="about-shot-thumb"
            :src="publicAssetUrl(s.src)"
            :alt="s.alt"
            :title="'点击放大预览'"
            role="button"
            tabindex="0"
            loading="lazy"
            @error="onShotError(s.key)"
            @click="openShotLightbox(s)"
            @keydown.enter.prevent="openShotLightbox(s)"
            @keydown.space.prevent="openShotLightbox(s)"
          />
          <div v-else class="about-shot-placeholder">
            <span class="about-shot-ph-title">{{ s.alt }}</span>
            <span class="about-shot-ph-hint">{{ s.hint }}</span>
          </div>
          <figcaption>{{ s.caption }}</figcaption>
        </figure>
      </div>
    </section>

    <section class="about-section">
      <h2 class="about-h2">支持的模型与平台</h2>
      <div class="about-models-offline-note" role="note">
        <span class="about-models-offline-label">离线优先</span>
        <span class="about-models-offline-text">除下列云端系列外，察元<strong>完整支持离线模型</strong>：典型如 <strong>Ollama</strong> 本机模型，以及 <strong>LM Studio、Xinference、OneAPI、New API</strong> 等提供的 OpenAI 兼容接口（内网地址即可）。无需公网密钥亦可完成对话与助手流程。</span>
      </div>
      <p class="about-muted">
        下列为内置清单中的模型系列（具体可用性取决于您在设置中启用的供应商与密钥）。任意兼容 OpenAI API 的网关（含<strong>纯内网部署</strong>）均可接入。
      </p>
      <div class="about-model-grid">
        <div v-for="g in modelGroups" :key="g.label" class="about-model-card">
          <div class="about-model-card-head">
            <img
              class="about-model-icon"
              :src="modelGroupIconUrl(g)"
              alt=""
              loading="lazy"
              decoding="async"
            />
            <span class="about-model-label">{{ g.label }}</span>
          </div>
          <ul class="about-model-subs">
            <li v-for="m in g.models.slice(0, 4)" :key="m.id">{{ m.name }}</li>
            <li v-if="g.models.length > 4" class="about-model-more">等 {{ g.models.length }} 个型号…</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="about-section about-open">
      <h2 class="about-h2">授权与许可</h2>
      <div class="about-open-card">
        <div>
          <p>
            察元 AI 文档助手为<strong>北京智灵鸟科技中心</strong>开发的软件产品，采用<strong>限量免费</strong>方式提供：可免费下载安装，使用察元自带服务有免费额度，<strong>自带 / 本地模型不限量</strong>；软件版权及相关权利归北京智灵鸟科技中心所有。
          </p>
          <p class="about-muted about-open-foot">
            使用许可、额度与商业授权（服务版 / 至臻版）详情见
            <a
              class="about-inline-link"
              href="https://aidooo.com"
              target="_blank"
              rel="noreferrer"
              @click.prevent="openAidooo"
            >aidooo.com</a>
            或联系商务。
          </p>
        </div>
      </div>
    </section>

    <section class="about-section">
      <h2 class="about-h2">开发者与联系</h2>
      <div class="about-dev-card">
        <p class="about-dev-title">北京智灵鸟科技中心</p>
        <p class="about-muted about-dev-desc">
          察元 AI 文档助手由<strong>北京智灵鸟科技中心</strong>研发与运营。我们专注于办公场景下的 AI 工具与可落地工作流，欢迎通过官网与公众号了解更新、提交需求或商务合作咨询。
        </p>
        <p class="about-muted">
          官网：<a
            class="about-inline-link"
            href="https://aidooo.com"
            target="_blank"
            rel="noreferrer"
            @click.prevent="openAidooo"
          >aidooo.com</a>
        </p>
      </div>
    </section>

    <section class="about-section">
      <h2 class="about-h2">关注我们 · 购买授权</h2>
      <p class="about-muted">
        关注公众号可获取版本更新与使用技巧；如需购买使用授权 / 额度，可扫码下单，或联系商务获取服务版 / 至臻版。
      </p>
      <div class="about-support-grid">
        <div class="about-support-block">
          <h3 class="about-h3">关注我们</h3>
          <ul class="about-support-list">
            <li>微信公众号：<strong>智灵鸟科技</strong></li>
            <li>官网动态与反馈：<a class="about-inline-link" href="#" @click.prevent="openAidooo">aidooo.com</a></li>
          </ul>
          <div v-if="showFollowQr" class="about-qr-wrap">
            <img
              class="about-qr"
              :src="publicAssetUrl('images/pay/follow.png')"
              alt="微信公众号"
              loading="lazy"
              decoding="async"
              @error="onFollowQrError"
            />
          </div>
        </div>
        <div class="about-support-block">
          <h3 class="about-h3">扫码购买</h3>
          <p class="about-muted about-support-note">
            扫码即可购买使用授权 / 额度，微信、支付宝任选；需要服务版 / 至臻版请联系商务。
          </p>
          <p class="about-muted about-support-note" style="margin-top: 6px;">
            独立团队，认真做产品。当支持够团队吃饭，全部功能即免费开源、回馈所有人。谢谢你成为其中一份力量。
          </p>
          <div class="about-support-qr-row">
            <div class="about-qr-wrap">
              <img
                v-if="purchaseQrDataUrl"
                class="about-qr"
                :src="purchaseQrDataUrl"
                alt="扫码购买"
                decoding="async"
              />
              <div v-else class="about-qr about-qr--placeholder">加载中…</div>
              <span class="about-qr-label">扫码购买（解除次数限制）</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="about-section">
      <h2 class="about-h2">免责声明 · 使用须知</h2>
      <div class="about-open-card about-disclaimer-card">
        <div>
          <p>
            察元 AI 文档助手是一款<strong>办公辅助工具</strong>。其输出由大语言模型生成，受<strong>模型能力、提示词、参数设置、输入文档质量及检索资料</strong>等多种因素影响，<strong>可能出现错误、遗漏、过时或不准确的内容</strong>。使用前请充分知悉以下条款。
          </p>
          <ol class="about-disclaimer-list">
            <li><strong>结果仅供参考，须自行核对。</strong>所有生成、改写、审查、核查、抽取等结果<strong>均需您逐项人工复核</strong>后再使用；合同审查、保密核查、公文校对、财税与法律等内容，请以现行法律法规、正式文件、权威资料及专业人员意见为准。</li>
            <li><strong>不具法律效力，不构成专业意见。</strong>本程序出具的任何内容<strong>不具有法律效力</strong>，也不构成法律、财务、税务、医疗、安全等专业意见或承诺，不能作为决策、定密、签署、申报或诉讼的直接依据。</li>
            <li><strong>结果不理想时如何调整。</strong>若输出不准确，您可自行：①更换或升级所用大模型；②改写、细化提示词（System / 用户提示模板），写明角色、范围与要求；③调整温度等参数（核查类宜调低、创作类可调高）；④补充上下文、绑定更贴合的知识库、缩小输入范围分段处理；⑤多次生成并交叉核验。以上均可在「助手设置 / 模型设置」中自助调整。</li>
            <li><strong>工具仅提供帮助，决策与责任在您。</strong>察元仅就文档处理提供效率辅助，<strong>不替代</strong>您的独立判断与法定职责；因采纳、传播或依赖本程序输出而产生的一切后果与责任，由使用者自行承担。</li>
            <li><strong>购买性质说明。</strong>您所付费用<strong>仅为获得本工具的使用许可 / 额度</strong>，并非为生成结果的准确性、完整性或特定用途付费。在法律允许范围内，对因使用本工具及其输出导致的任何直接或间接损失，我们不承担责任。</li>
            <li><strong>涉密与合规场景。</strong>在政务、涉密及合规场景使用时，请严格遵守保密及相关法规，由<strong>定密责任人、保密审查及专业人员</strong>依法定程序最终把关；本工具不处理、不判定具体密级，仅作辅助提示。</li>
          </ol>
          <p class="about-muted about-open-foot">
            继续使用即表示您已阅读并理解上述条款。
          </p>
        </div>
      </div>
    </section>

    <div
      v-if="shotLightbox"
      class="about-shot-lightbox"
      role="dialog"
      aria-modal="true"
      :aria-label="shotLightbox.alt || '图片预览'"
      @click="closeShotLightbox"
    >
      <button
        type="button"
        class="about-shot-lightbox-close"
        aria-label="关闭预览"
        @click.stop="closeShotLightbox"
      >
        ×
      </button>
      <figure class="about-shot-lightbox-figure" @click.stop>
        <img
          class="about-shot-lightbox-img"
          :src="shotLightbox.url"
          :alt="shotLightbox.alt"
        />
        <figcaption v-if="shotLightbox.caption" class="about-shot-lightbox-caption">
          {{ shotLightbox.caption }}
        </figcaption>
      </figure>
    </div>

    <footer class="about-footer">
      <p class="about-footer-brand">北京智灵鸟科技中心</p>
      <p class="about-footer-sub">察元 AI 文档助手 · {{ appVersion }}</p>
      <p class="about-footer-links">
        <a href="https://aidooo.com" target="_blank" rel="noreferrer" @click.prevent="openAidooo">aidooo.com</a>
        <span class="about-dot">·</span>
        <span>版权所有</span>
      </p>
    </footer>
  </div>
</template>

<script>
import pkg from '../../package.json'
import { MODEL_GROUPS } from '@/utils/defaultModelGroups.js'
import { getModelLogoPath } from '@/utils/modelLogos.js'
import { publicAssetUrl } from '@/utils/publicAssetUrl.js'
import { toDataUrl as buildPurchaseQrDataUrl } from '@/utils/qrcode.js'
import { getFingerprint } from '@/utils/license/fingerprint.js'
import AboutChayuanArchitecture from './AboutChayuanArchitecture.vue'

/*
 * productFamily 文案对齐 /work/website/src/config/productCopy.js 的 EDITION_COMPARE,
 * 让本加载项里的"关于"页与官方网站完全同源,以后官网改了文案,搬过来就好。
 */
const PRODUCT_FAMILY = [
  {
    key: 'wps',
    name: '察元 WPS AI 文档助手',
    sub: '限量免费 · 自带模型不限量',
    icon: '📄',
    tone: 'plain',
    current: true,
    pitch: '装到 WPS 里,文档级 AI 写作 / 改写 / 摘要 / 引用,内置域内知识库。',
    points: [
      '2000+ 内置助手 · 200+ 行业,8 种写回',
      '域内知识库 RAG · 引用气泡 · 原文下载',
      '完全本地化 / 内网部署 · 密钥不出域'
    ],
    price: '限量免费',
    cta: '免费下载'
  },
  {
    key: 'desktop',
    name: '察元 AI 桌面版',
    sub: '单机 · 限量免费',
    icon: '💻',
    tone: 'plain',
    pitch: '装到本机即用,个人 / 单机,离线可跑、数据不出域。',
    points: [
      'Tauri + 嵌入式 Python · 装机离线',
      '五类知识源统一查询 · Model Arena',
      '30+ 工具 · MCP 双角色 · 国产化适配'
    ],
    price: '限量免费',
    cta: '下载桌面版'
  },
  {
    key: 'service',
    name: '察元 AI 服务版',
    sub: '团队 · ≤ 50 人 · 商业',
    icon: '🏢',
    tone: 'emphasis',
    pitch: '服务化部署 ≤ 50 人,桌面版能力 + 团队协作 + 基础配额审计。',
    points: [
      '服务化部署 · 团队 + 角色',
      '继承桌面版全部能力',
      '基础配额 / 审计'
    ],
    price: '联系商务',
    cta: 'cmdbird@163.com'
  },
  {
    key: 'premium',
    name: '察元 AI 至臻版',
    sub: '企业 · ≤ 500 人 · 推荐',
    icon: '👑',
    tone: 'highlight',
    pitch: '服务化部署 ≤ 500 人,在线办公 / 智能空间 / 训练数据中心全模块齐全。',
    points: [
      '在线 Office + 智能空间 + 应用市场',
      '训练数据中心 · 微调反馈闭环',
      'SSO · 审计 · BI 看板'
    ],
    price: '联系商务',
    cta: 'aidooo.com'
  }
]

export default {
  name: 'AboutChayuanPanel',
  components: { AboutChayuanArchitecture },
  data() {
    return {
      appVersion: pkg.version || '',
      heroLogoOk: true,
      shotErr: {},
      showFollowQr: true,
      purchaseQrDataUrl: '',
      shotLightbox: null,
      modelGroups: MODEL_GROUPS,
      productFamily: PRODUCT_FAMILY,
      moduleShotErr: {},
      /*
       * 至臻版独占的 4 大模块实景图,来源:/work/website/public/images/business/。
       * 文案对齐 /work/website/src/components/BusinessShowcaseSection.vue 的 CARDS_ZH。
       */
      premiumModuleShots: [
        {
          key: 'office', idx: 1, tag: 'OFFICE',
          title: '察元办公 · 在线文档协同',
          urlPath: 'office',
          src: 'images/about/business/office.jpg',
          caption: '浏览器内 Word / Excel / PPT 兼容编辑;我的 / 组织 / 共享给我 / 收藏 / 回收站五库归一,文档级 ACL + 评论 + 版本。'
        },
        {
          key: 'space', idx: 2, tag: 'SPACE',
          title: '智能空间 · 应用工作台',
          urlPath: 'space',
          src: 'images/about/business/space.jpg',
          caption: 'AppStudio(prompt + 资源 + 工具 + Flow)→ AppRuntime(沙箱 + 配额 + 审计)→ AppGallery 团队画廊;密钥集中 + 授权 + 操作日志。'
        },
        {
          key: 'market', idx: 3, tag: 'MARKET',
          title: '应用市场 · 公开 / 内部双轨',
          urlPath: 'market',
          src: 'images/about/business/market.jpg',
          caption: '已发布应用列入公开市场,匿名访客也能用;内部应用走企业内市场。PublishDialog 四态阶梯发布,管理员审核 + 灰度。'
        },
        {
          key: 'anno', idx: 4, tag: 'ANNOTATION',
          title: '训练数据中心 · 标注 + 数据挂载',
          urlPath: 'annotation',
          src: 'images/about/business/annotation.png',
          caption: '多人协同标注任务(RAG 评测 / Office 抽取 / 通用 QA),Data Mounts 把外部数据源一站挂载到标注工序,导出直接喂 SFT / DPO 训练管线。'
        }
      ],
      featureList: [
        {
          title: '离线与本地模型',
          desc: '支持 Ollama 及 OpenAI 兼容的本地/内网网关（如 LM Studio、Xinference、OneAPI 等），对话与文档处理可不依赖公网大模型，便于涉密、内网与数据不出域场景。',
          icon: 'images/models/logos/ollama.png'
        },
        {
          title: 'AI 对话与文档助手',
          desc: '多轮对话、选区/全文上下文、摘要翻译改写、结构化写回与批注。',
          icon: 'images/ai-assistant.svg'
        },
        {
          title: '审查与合规',
          desc: '保密检查、AI 痕迹检查、拼写语法、样式与表单等办公审查能力。',
          icon: 'images/review.svg'
        },
        {
          title: '任务编排与清单',
          desc: '任务进度、工作流编排、结果汇总导出，适合批量文档处理场景。',
          icon: 'images/task-orchestration.svg'
        },
        {
          title: '模型与数据设置',
          desc: '多云商与多模态模型、API 与密钥、模型清单刷新；与离线/内网供应商并列配置，按需切换。',
          icon: 'images/settings-model.svg'
        },
        {
          title: '模板与规则',
          desc: '规则导入导出、文档模板、表格与图片等批量处理能力。',
          icon: 'images/template-create.svg'
        },
        {
          title: '安全与脱敏',
          desc: '文档脱密检查与还原流程，便于在协作前后控制敏感信息。',
          icon: 'images/declassify.svg'
        }
      ],
      screenshotSlots: [
        {
          key: 's1',
          src: 'images/about/screen-1.png',
          alt: 'AI 助手主界面',
          caption: '对话、助手与写回',
          hint: '界面示意'
        },
        {
          key: 's2',
          src: 'images/about/screen-2.png',
          alt: '任务与审查',
          caption: '任务清单与审查结果',
          hint: '界面示意'
        },
        {
          key: 's3',
          src: 'images/about/screen-3.png',
          alt: '模型设置',
          caption: '模型与供应商配置',
          hint: '界面示意'
        },
        {
          key: 's4',
          src: 'images/about/screen-4.png',
          alt: '知识库连接',
          caption: '域内知识库连接管理',
          hint: '界面示意'
        }
      ]
    }
  },
  mounted() {
    this._shotLightboxOnKeydown = (e) => {
      if (e.key === 'Escape' && this.shotLightbox) this.closeShotLightbox()
    }
    window.addEventListener('keydown', this._shotLightboxOnKeydown)
    this.loadPurchaseQr()
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this._shotLightboxOnKeydown)
  },
  methods: {
    openShotLightbox(slot) {
      if (!slot || this.shotErr[slot.key]) return
      this.shotLightbox = {
        url: this.publicAssetUrl(slot.src),
        alt: slot.alt || '',
        caption: slot.caption || ''
      }
    },
    closeShotLightbox() {
      this.shotLightbox = null
    },
    onShotError(key) {
      this.shotErr = { ...this.shotErr, [key]: true }
    },
    onModuleShotError(key) {
      this.moduleShotErr = { ...this.moduleShotErr, [key]: true }
    },
    onFollowQrError() {
      this.showFollowQr = false
    },
    // 生成「扫码购买（解除次数限制）」二维码：含本机指纹，离线本地生成，指向官方购买页。
    async loadPurchaseQr() {
      let fp = ''
      try { fp = await getFingerprint() } catch (_) { fp = '' }
      const url = fp
        ? `https://aidooo.com/buy?app=wps&mid=${encodeURIComponent(fp)}`
        : 'https://aidooo.com/buy?app=wps'
      try {
        this.purchaseQrDataUrl = await buildPurchaseQrDataUrl(url, 160)
      } catch (_) {
        this.purchaseQrDataUrl = ''
      }
    },
    publicAssetUrl,
    iconUrl(icon) {
      const v = String(icon || '').trim()
      if (!v) return ''
      if (v.startsWith('http')) return v
      return publicAssetUrl(v.replace(/^\/+/, ''))
    },
    /** defaultModelGroups 里的 icon 多为已废弃路径；与 Ribbon 一致用 logos 映射 */
    modelGroupIconUrl(group) {
      const first = Array.isArray(group?.models)
        ? group.models.find((m) => m && String(m.id || '').trim())
        : null
      if (first) {
        const rel = getModelLogoPath(first.id)
        if (rel) return this.iconUrl(rel)
      }
      const legacy = String(group?.icon || '').trim()
      if (legacy) return this.iconUrl(legacy)
      return this.iconUrl('images/ai-assistant.svg')
    },
    openAidooo() {
      window.open('https://aidooo.com', '_blank', 'noopener,noreferrer')
    },
    openExternal(url) {
      const u = String(url || '').trim()
      if (u) window.open(u, '_blank', 'noopener,noreferrer')
    }
  }
}
</script>

<style scoped>
.about-chayuan-panel {
  --about-bg: linear-gradient(165deg, #0f172a 0%, #1e293b 42%, #0f172a 100%);
  --about-card: rgba(255, 255, 255, 0.06);
  --about-border: rgba(255, 255, 255, 0.1);
  --about-text: #e2e8f0;
  --about-muted: #94a3b8;
  --about-accent: #38bdf8;
  --about-accent2: #a78bfa;
  background: var(--about-bg);
  color: var(--about-text);
  min-height: min-content;
  padding: 28px 24px 36px;
  box-sizing: border-box;
}

.about-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 24px 32px;
  margin-bottom: 36px;
  padding-bottom: 28px;
  border-bottom: 1px solid var(--about-border);
}

.about-hero-text {
  min-width: 0;
}

.about-kicker {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--about-accent);
}

.about-title {
  margin: 0 0 12px;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0.02em;
  background: linear-gradient(90deg, #f8fafc, #bae6fd);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.about-lead {
  margin: 0;
  max-width: 520px;
  line-height: 1.65;
  font-size: 15px;
  color: var(--about-muted);
}

.about-lead-sub {
  margin: 12px 0 0;
  max-width: 520px;
  font-size: 13px;
  line-height: 1.55;
  color: #64748b;
}

.about-lead-sub code {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.35);
  color: #cbd5e1;
}

.about-hero-visual {
  position: relative;
  width: 120px;
  height: 120px;
  flex-shrink: 0;
  justify-self: end;
}

@media (max-width: 420px) {
  .about-hero {
    grid-template-columns: 1fr;
  }

  .about-hero-visual {
    justify-self: end;
  }
}

.about-hero-orbit {
  position: absolute;
  inset: 0;
  border-radius: 28px;
  background: radial-gradient(circle at 30% 30%, rgba(56, 189, 248, 0.35), transparent 55%),
    radial-gradient(circle at 70% 80%, rgba(167, 139, 250, 0.3), transparent 50%);
  border: 1px solid var(--about-border);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}

.about-hero-logo,
.about-hero-logo-fallback {
  position: absolute;
  inset: 18px;
  width: calc(100% - 36px);
  height: calc(100% - 36px);
  object-fit: contain;
  border-radius: 16px;
}

.about-hero-logo-fallback {
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(167, 139, 250, 0.2));
}

.about-section {
  margin-bottom: 32px;
}

.about-h2 {
  margin: 0 0 14px;
  font-size: 18px;
  font-weight: 600;
  color: #f1f5f9;
}

.about-h3 {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 600;
  color: #e2e8f0;
}

.about-intro-card {
  padding: 18px 20px;
  border-radius: 12px;
  background: var(--about-card);
  border: 1px solid var(--about-border);
  font-size: 14px;
  line-height: 1.75;
  color: var(--about-muted);
}

.about-intro-card p {
  margin: 0 0 12px;
}

.about-intro-card p:last-child {
  margin-bottom: 0;
}

.about-intro-card strong {
  color: #cbd5e1;
  font-weight: 600;
}

.about-intro-offline {
  padding: 12px 14px;
  margin: 12px 0 !important;
  border-radius: 8px;
  border-left: 3px solid var(--about-accent);
  background: rgba(56, 189, 248, 0.08);
  color: #cbd5e1;
}

.about-models-offline-note {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px 14px;
  margin: 0 0 14px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid rgba(56, 189, 248, 0.35);
  background: rgba(56, 189, 248, 0.09);
  font-size: 13px;
  line-height: 1.65;
  color: #e2e8f0;
}

.about-models-offline-label {
  flex-shrink: 0;
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: rgba(56, 189, 248, 0.25);
  color: #7dd3fc;
}

.about-models-offline-text {
  flex: 1;
  min-width: 200px;
}

.about-dev-card {
  padding: 18px 20px;
  border-radius: 12px;
  background: var(--about-card);
  border: 1px solid var(--about-border);
}

.about-dev-title {
  margin: 0 0 10px;
  font-size: 16px;
  font-weight: 600;
  color: #f1f5f9;
}

.about-dev-desc {
  margin: 0 0 12px;
  line-height: 1.65;
}

.about-support-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.about-support-block {
  padding: 16px 18px;
  border-radius: 12px;
  background: var(--about-card);
  border: 1px solid var(--about-border);
}

.about-support-list {
  margin: 0 0 8px;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--about-muted);
}

.about-support-list li {
  margin-bottom: 6px;
}

.about-support-note {
  margin: 0 0 12px;
  font-size: 12px;
}

.about-support-qr-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-start;
}

.about-qr-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.about-qr {
  width: 120px;
  height: 120px;
  object-fit: contain;
  border-radius: 8px;
  border: 1px solid var(--about-border);
  background: rgba(0, 0, 0, 0.2);
}
.about-qr--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--about-muted);
}

.about-qr-label {
  font-size: 13px;
  color: var(--about-muted);
}

.about-inline-link {
  color: var(--about-accent);
  text-decoration: none;
}

.about-inline-link:hover {
  text-decoration: underline;
}

.about-footer-sub {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--about-muted);
}

.about-muted {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--about-muted);
  line-height: 1.55;
}

.about-muted code {
  font-size: 12px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.35);
}

.about-features {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.about-feature-card {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--about-card);
  border: 1px solid var(--about-border);
}

.about-feature-icon {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  opacity: 0.95;
}

.about-feature-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}

.about-feature-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--about-muted);
}

.about-shots {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.about-shot {
  margin: 0;
}

.about-shot-thumb {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid var(--about-border);
  background: rgba(0, 0, 0, 0.25);
  cursor: zoom-in;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.about-shot-thumb:hover {
  border-color: rgba(56, 189, 248, 0.45);
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.2);
}

.about-shot-thumb:focus-visible {
  outline: 2px solid var(--about-accent);
  outline-offset: 2px;
}

.about-shot-placeholder {
  aspect-ratio: 16 / 10;
  border-radius: 10px;
  border: 1px dashed var(--about-border);
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  text-align: center;
}

.about-shot-ph-title {
  font-size: 13px;
  font-weight: 600;
  color: #cbd5e1;
}

.about-shot-ph-hint {
  font-size: 11px;
  color: #64748b;
}

.about-shot figcaption {
  margin-top: 8px;
  font-size: 12px;
  color: var(--about-muted);
}

.about-model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(152px, 1fr));
  gap: 10px;
}

.about-model-card {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--about-card);
  border: 1px solid var(--about-border);
}

.about-model-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.about-model-icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.about-model-label {
  font-size: 13px;
  font-weight: 600;
}

.about-model-subs {
  margin: 0;
  padding-left: 18px;
  font-size: 11px;
  color: var(--about-muted);
  line-height: 1.45;
}

.about-model-more {
  list-style: none;
  margin-left: -18px;
  margin-top: 4px;
  color: #64748b;
  font-style: italic;
}

.about-open-card {
  display: flex;
  gap: 16px;
  padding: 18px 20px;
  border-radius: 12px;
  background: var(--about-card);
  border: 1px solid var(--about-border);
  line-height: 1.65;
  font-size: 14px;
}

.about-open-card p {
  margin: 0 0 10px;
}

.about-open-card p:last-child {
  margin-bottom: 0;
}

.about-open-icon {
  flex-shrink: 0;
  color: var(--about-accent);
  opacity: 0.9;
}

.about-open-foot {
  margin-top: 8px !important;
}

.about-disclaimer-card {
  display: block;
  border-left: 3px solid var(--about-accent);
}

.about-disclaimer-list {
  margin: 4px 0 0;
  padding-left: 20px;
  list-style: decimal;
}

.about-disclaimer-list li {
  margin: 0 0 9px;
  line-height: 1.7;
}

.about-disclaimer-list li:last-child {
  margin-bottom: 0;
}

.about-footer {
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--about-border);
  text-align: center;
}

.about-footer-brand {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: #f8fafc;
}

.about-footer-links {
  margin: 0;
  font-size: 13px;
  color: var(--about-muted);
}

.about-footer-links a {
  color: var(--about-accent);
  text-decoration: none;
}

.about-footer-links a:hover {
  text-decoration: underline;
}

.about-dot {
  margin: 0 6px;
  opacity: 0.5;
}

.about-shot-lightbox {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px 32px;
  box-sizing: border-box;
  background: rgba(2, 6, 23, 0.92);
  backdrop-filter: blur(6px);
}

.about-shot-lightbox-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.about-shot-lightbox-close:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

.about-shot-lightbox-figure {
  margin: 0;
  max-width: min(96vw, 1200px);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.about-shot-lightbox-img {
  max-width: 100%;
  max-height: calc(90vh - 48px);
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
}

.about-shot-lightbox-caption {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
  text-align: center;
}

/* ───── 察元产品家族(4 SKU 卡片) ───── */
.about-family { /* 继承 about-section 即可,这里只做局部修饰 */ }
.about-family-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-top: 14px;
}
@media (max-width: 1100px) {
  .about-family-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .about-family-grid { grid-template-columns: 1fr; }
}
.about-family-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 16px 14px;
  border-radius: 14px;
  background: linear-gradient(160deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.95));
  border: 1px solid rgba(96, 165, 250, 0.22);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}
.about-family-card:hover {
  transform: translateY(-3px);
  border-color: rgba(96, 165, 250, 0.45);
  box-shadow: 0 14px 36px -16px rgba(99, 102, 241, 0.45);
}
.about-family-card.is-current {
  border-color: #60a5fa;
  background: linear-gradient(160deg, rgba(37, 99, 235, 0.32), rgba(15, 23, 42, 0.95));
  box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.4), 0 14px 36px -14px rgba(96, 165, 250, 0.45);
}
.about-family-card.is-highlight {
  border-color: rgba(251, 191, 36, 0.55);
  background: linear-gradient(160deg, rgba(180, 83, 9, 0.22), rgba(15, 23, 42, 0.95));
}
.about-family-card.is-emphasis {
  border-color: rgba(168, 85, 247, 0.45);
  background: linear-gradient(160deg, rgba(126, 34, 206, 0.22), rgba(15, 23, 42, 0.95));
}

.about-family-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.about-family-icon {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(99, 102, 241, 0.18);
  border: 1px solid rgba(96, 165, 250, 0.3);
  font-size: 20px;
  flex-shrink: 0;
}
.about-family-name {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #f8fafc;
  line-height: 1.35;
}
.about-family-sub {
  margin: 2px 0 0;
  font-size: 11.5px;
  color: #93c5fd;
}
.about-family-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 10px;
  letter-spacing: 0.1em;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.2);
  color: #bfdbfe;
  border: 1px solid rgba(96, 165, 250, 0.45);
  font-weight: 600;
}
.about-family-badge-warm {
  background: rgba(251, 191, 36, 0.18);
  color: #fde68a;
  border-color: rgba(251, 191, 36, 0.5);
}
.about-family-pitch {
  margin: 0;
  font-size: 13px;
  line-height: 1.65;
  color: #cbd5e1;
}
.about-family-points {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.about-family-points li {
  position: relative;
  padding-left: 18px;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.55;
}
.about-family-points li::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 8px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #60a5fa;
  box-shadow: 0 0 6px rgba(96, 165, 250, 0.55);
}
.is-current .about-family-points li::before { background: #fbbf24; box-shadow: 0 0 8px rgba(251, 191, 36, 0.6); }
.is-highlight .about-family-points li::before { background: #fbbf24; }
.is-emphasis .about-family-points li::before { background: #c084fc; }

.about-family-foot {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px dashed rgba(96, 165, 250, 0.2);
  font-size: 12px;
}
.about-family-price {
  font-weight: 700;
  color: #f8fafc;
}
.about-family-cta {
  color: #93c5fd;
}
.about-family-foot-note {
  margin-top: 14px;
  font-size: 12.5px;
}

/* 架构组件外壳 — 只在面板里加一点呼吸空间 */
.about-architecture-wrap { padding-top: 4px; }

/* ───── "察元是什么" 段:至臻版四大模块实景画廊 ───── */
.about-modules-gallery {
  margin-top: 22px;
  padding: 18px 16px 18px;
  border-radius: 14px;
  background: linear-gradient(165deg, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.75));
  border: 1px solid rgba(96, 165, 250, 0.18);
}
.about-modules-gallery-eyebrow {
  margin: 0 0 4px;
  font-size: 12px;
  letter-spacing: 0.16em;
  color: #fbbf24;
  text-transform: uppercase;
}
.about-modules-gallery-lead {
  margin-bottom: 12px !important;
  font-size: 12.5px;
}

.about-modules-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
@media (max-width: 760px) {
  .about-modules-grid { grid-template-columns: 1fr; }
}

.about-module-shot {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 10px 12px 12px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(96, 165, 250, 0.18);
  cursor: zoom-in;
  transition: transform 0.18s ease, border-color 0.18s, box-shadow 0.18s;
}
.about-module-shot:hover {
  transform: translateY(-3px);
  border-color: rgba(96, 165, 250, 0.55);
  box-shadow: 0 12px 30px -14px rgba(96, 165, 250, 0.35);
}
.about-module-shot:focus-visible {
  outline: 2px solid #fbbf24;
  outline-offset: 2px;
}

.about-module-shot-frame {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: #0b1226;
}
.about-module-shot-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: linear-gradient(180deg, #1e293b, #0f172a);
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}
.about-module-shot-dot {
  width: 9px; height: 9px; border-radius: 50%;
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.25);
}
.about-module-shot-dot.is-r { background: #ef4444; }
.about-module-shot-dot.is-y { background: #f59e0b; }
.about-module-shot-dot.is-g { background: #22c55e; }
.about-module-shot-url {
  margin-left: 8px;
  font-size: 10.5px;
  color: #94a3b8;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
  letter-spacing: 0.02em;
}
.about-module-shot-img {
  width: 100%;
  aspect-ratio: 900 / 540;
  object-fit: cover;
  display: block;
}
.about-module-shot-placeholder {
  width: 100%;
  aspect-ratio: 900 / 540;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  font-size: 12px;
  background: rgba(15, 23, 42, 0.6);
}

.about-module-shot figcaption {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12.5px;
  line-height: 1.6;
  color: #cbd5e1;
}
.about-module-shot-tag {
  font-size: 10.5px;
  letter-spacing: 0.12em;
  color: #93c5fd;
  text-transform: uppercase;
}
.about-module-shot figcaption strong {
  color: #f1f5f9;
  font-size: 13.5px;
  font-weight: 700;
}
.about-module-shot-desc {
  color: #94a3b8;
  font-size: 12px;
}
</style>
