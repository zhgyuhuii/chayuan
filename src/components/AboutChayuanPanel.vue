<template>
  <div class="about-chayuan-panel">
    <header class="about-hero">
      <div class="about-hero-text">
        <p class="about-kicker">WPS 智能加载项</p>
        <h1 class="about-title">察元 AI 文档助手</h1>
        <p class="about-lead">
          在 WPS 文字中完成对话、审查、任务编排与文档写回；对接主流大模型与本地模型，兼顾办公效率与数据边界。
        </p>
        <p class="about-lead-sub">
          与官网演示页（如本地 <code>http://localhost:3890/</code>）同源资源，可在浏览器打开独立「关于」路由浏览同一介绍。
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
      <h2 class="about-h2">核心能力</h2>
      <ul class="about-features">
        <li v-for="f in featureList" :key="f.title" class="about-feature-card">
          <img class="about-feature-icon" :src="f.icon" alt="" />
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
        将截图放入 <code>public/images/about/screen-1.png</code>～<code>screen-3.png</code> 后自动显示；未放置时显示占位示意。
      </p>
      <div class="about-shots">
        <figure v-for="s in screenshotSlots" :key="s.key" class="about-shot">
          <img
            v-if="!shotErr[s.key]"
            :src="publicAssetUrl(s.src)"
            :alt="s.alt"
            loading="lazy"
            @error="onShotError(s.key)"
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
      <p class="about-muted">
        下列为内置清单中的模型系列（具体可用性取决于您在设置中启用的供应商与密钥）。兼容 OpenAI API 的网关均可接入。
      </p>
      <div class="about-model-grid">
        <div v-for="g in modelGroups" :key="g.label" class="about-model-card">
          <div class="about-model-card-head">
            <img class="about-model-icon" :src="iconUrl(g.icon)" alt="" />
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
      <h2 class="about-h2">开源与协作</h2>
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
            察元倡导<strong>开放接口</strong>与<strong>可扩展助手</strong>：支持自定义助手、任务编排与本地/私有部署模型。若您参与内部或社区版共建，源码托管与许可证说明以出品方发布为准。
          </p>
          <p class="about-muted about-open-foot">
            欢迎通过官方渠道反馈需求与贡献插件能力；具体仓库地址与协议请咨询北京智灵鸟科技中心。
          </p>
        </div>
      </div>
    </section>

    <footer class="about-footer">
      <p class="about-footer-brand">北京智灵鸟科技中心 出品</p>
      <p class="about-footer-links">
        <a href="https://aidooo.com" target="_blank" rel="noreferrer" @click.prevent="openAidooo">aidooo.com</a>
        <span class="about-dot">·</span>
        <span>察元 AI 文档助手</span>
      </p>
    </footer>
  </div>
</template>

<script>
import { MODEL_GROUPS } from '@/utils/defaultModelGroups.js'
import { publicAssetUrl } from '@/utils/publicAssetUrl.js'

export default {
  name: 'AboutChayuanPanel',
  data() {
    return {
      heroLogoOk: true,
      shotErr: {},
      modelGroups: MODEL_GROUPS,
      featureList: [
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
          desc: '多供应商、多模态模型配置，数据路径与助手设置一站式管理。',
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
          hint: '可替换为实际产品截图'
        },
        {
          key: 's2',
          src: 'images/about/screen-2.png',
          alt: '任务与审查',
          caption: '任务清单与审查结果',
          hint: '可替换为实际产品截图'
        },
        {
          key: 's3',
          src: 'images/about/screen-3.png',
          alt: '模型设置',
          caption: '模型与供应商配置',
          hint: '可替换为实际产品截图'
        }
      ]
    }
  },
  methods: {
    onShotError(key) {
      this.shotErr = { ...this.shotErr, [key]: true }
    },
    publicAssetUrl,
    iconUrl(icon) {
      const v = String(icon || '').trim()
      if (!v) return ''
      if (v.startsWith('http')) return v
      return publicAssetUrl(v.replace(/^\/+/, ''))
    },
    openAidooo() {
      window.open('https://aidooo.com', '_blank', 'noopener,noreferrer')
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
  min-height: 100%;
  padding: 28px 24px 36px;
  box-sizing: border-box;
}

.about-hero {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 36px;
  padding-bottom: 28px;
  border-bottom: 1px solid var(--about-border);
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

.about-shot img {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid var(--about-border);
  background: rgba(0, 0, 0, 0.25);
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
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 10px;
  max-height: 320px;
  overflow-y: auto;
  padding-right: 4px;
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
</style>
