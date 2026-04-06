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
          察元（Chayuan）是专为 WPS 文字环境设计的加载项产品，将大语言模型能力嵌入选区感知、全文上下文、模板与规则、任务清单等工作流中。您可在<strong>不离开文档</strong>的情况下完成对话、生成与修改建议，并按需将结果写回正文或批注。
        </p>
        <p class="about-intro-offline">
          <strong>离线模型与数据边界：</strong>察元将「支持离线/本地大模型」作为核心能力之一。在设置中启用 Ollama 或填写内网 OpenAI 兼容地址后，推理流量可限制在<strong>本机或单位内网</strong>，适合对<strong>外网隔离、数据不出域、合规审计</strong>有要求的场景；与云端 API 模式可同时配置，按会话或助手灵活选用。
        </p>
        <p>
          产品持续迭代<strong>审查与合规</strong>、<strong>任务编排</strong>、<strong>多模态与多供应商模型</strong>等能力，并欢迎通过官网与公众号反馈需求，与我们共同完善「察元」在真实办公场景中的表现。
        </p>
      </div>
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
      <h2 class="about-h2">开源协议</h2>
      <div class="about-open-card">
        <div class="about-open-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
            <path
              d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.1.39-1.99 1.03-2.69a3.6 3.6 0 0 1 .1-2.64s.84-.27 2.75 1.02a9.58 9.58 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.4.1 2.64.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.73c0 .27.16.59.67.5A10 10 0 0 0 22 12 10 10 0 0 0 12 2z"
            />
          </svg>
        </div>
        <div>
          <p>
            本加载项<strong>源代码</strong>以 <strong>Apache License 2.0</strong> 授权发布。在遵守许可证条款的前提下，您可以自由使用、修改与再分发；衍生作品需保留原有版权声明与许可说明。
          </p>
          <p class="about-muted about-open-foot">
            完整条款见：
            <a
              class="about-inline-link"
              href="https://www.apache.org/licenses/LICENSE-2.0"
              target="_blank"
              rel="noreferrer"
              @click.prevent="openExternal('https://www.apache.org/licenses/LICENSE-2.0')"
            >Apache License 2.0（英文全文）</a>
            。仓库内亦附有 <code>LICENSE</code> 文件供离线查阅。
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
      <h2 class="about-h2">关注我们 · 支持察元</h2>
      <p class="about-muted">
        关注公众号可获取版本更新与使用技巧；若您认可察元带来的效率提升，也欢迎通过下列方式支持我们持续开发与维护。
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
          <h3 class="about-h3">支持我们</h3>
          <p class="about-muted about-support-note">
            您的支持将用于服务器、模型测试与功能迭代。若构建中已包含赞赏二维码，将显示在下方。
          </p>
          <div v-if="showWxQr || showAliQr" class="about-support-qr-row">
            <div v-if="showWxQr" class="about-qr-wrap">
              <img
                class="about-qr"
                :src="publicAssetUrl('images/pay/wxpay.png')"
                alt="微信支持"
                loading="lazy"
                decoding="async"
                @error="onWxQrError"
              />
              <span class="about-qr-label">微信</span>
            </div>
            <div v-if="showAliQr" class="about-qr-wrap">
              <img
                class="about-qr"
                :src="publicAssetUrl('images/pay/alipay.png')"
                alt="支付宝支持"
                loading="lazy"
                decoding="async"
                @error="onAliQrError"
              />
              <span class="about-qr-label">支付宝</span>
            </div>
          </div>
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

export default {
  name: 'AboutChayuanPanel',
  data() {
    return {
      appVersion: pkg.version || '',
      heroLogoOk: true,
      shotErr: {},
      showFollowQr: true,
      showWxQr: true,
      showAliQr: true,
      shotLightbox: null,
      modelGroups: MODEL_GROUPS,
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
        }
      ]
    }
  },
  mounted() {
    this._shotLightboxOnKeydown = (e) => {
      if (e.key === 'Escape' && this.shotLightbox) this.closeShotLightbox()
    }
    window.addEventListener('keydown', this._shotLightboxOnKeydown)
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
    onFollowQrError() {
      this.showFollowQr = false
    },
    onWxQrError() {
      this.showWxQr = false
    },
    onAliQrError() {
      this.showAliQr = false
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
</style>
