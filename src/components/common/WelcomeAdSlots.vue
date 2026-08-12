<template>
  <section
    class="welcome-ad-slots"
    :class="{ 'welcome-ad-slots--embedded': embedded }"
    aria-label="离线广告招商"
  >
    <!-- 一行一个 -->
    <div class="welcome-ad-row welcome-ad-row--full">
      <article
        class="welcome-ad-card welcome-ad-card--full"
        role="button"
        tabindex="0"
        @click="openDetail('full')"
        @keydown.enter.prevent="openDetail('full')"
      >
        <div class="welcome-ad-card-badge">广告位</div>
        <div class="welcome-ad-card-body">
          <div class="welcome-ad-card-copy">
            <strong class="welcome-ad-card-name">离线广告招商 · 通栏</strong>
            <span class="welcome-ad-card-size">{{ specs.full.label }}</span>
          </div>
          <span class="welcome-ad-card-cta">点击详情</span>
        </div>
      </article>
    </div>

    <!-- 一行两个 -->
    <div class="welcome-ad-row welcome-ad-row--pair">
      <article
        v-for="n in 2"
        :key="'half-' + n"
        class="welcome-ad-card welcome-ad-card--half"
        role="button"
        tabindex="0"
        @click="openDetail('half')"
        @keydown.enter.prevent="openDetail('half')"
      >
        <div class="welcome-ad-card-badge">广告位</div>
        <div class="welcome-ad-card-body">
          <div class="welcome-ad-card-copy">
            <strong class="welcome-ad-card-name">离线广告招商 · 半栏</strong>
            <span class="welcome-ad-card-size">{{ specs.half.label }}</span>
          </div>
          <span class="welcome-ad-card-cta">点击详情</span>
        </div>
      </article>
    </div>

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
  </section>
</template>

<script>
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
      specs: AD_SPECS
    }
  },
  computed: {
    activeSpec() {
      return this.specs[this.activeLayout] || this.specs.full
    }
  },
  methods: {
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

.welcome-ad-row {
  display: flex;
  width: 100%;
  gap: 6px;
}

.welcome-ad-row--full {
  flex-direction: column;
}

.welcome-ad-row--pair {
  flex-direction: row;
}

.welcome-ad-card {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  border: 1px dashed rgba(148, 163, 184, 0.42);
  border-radius: 8px;
  background:
    linear-gradient(145deg, rgba(30, 41, 59, 0.88), rgba(15, 23, 42, 0.82)),
    repeating-linear-gradient(
      -45deg,
      rgba(148, 163, 184, 0.05) 0 8px,
      rgba(148, 163, 184, 0) 8px 16px
    );
  color: #e2e8f0;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.welcome-ad-card--full {
  width: 100%;
  height: 80px;
  min-height: 80px;
  box-sizing: border-box;
}

.welcome-ad-card--half {
  flex: 1 1 0;
  min-width: 0;
  height: 100px;
  min-height: 100px;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 4px;
  padding: 8px 10px;
  box-sizing: border-box;
}

.welcome-ad-card:hover,
.welcome-ad-card:focus-visible {
  outline: none;
  border-color: rgba(56, 189, 248, 0.65);
  transform: translateY(-1px);
}

.welcome-ad-card-badge {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(251, 191, 36, 0.18);
  color: #fbbf24;
  font-size: 10px;
  font-weight: 700;
}

.welcome-ad-card-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.welcome-ad-card-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.welcome-ad-card--half .welcome-ad-card-body {
  width: 100%;
}

.welcome-ad-card-name {
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.welcome-ad-card-size {
  color: rgba(148, 163, 184, 0.95);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.welcome-ad-card-cta {
  flex-shrink: 0;
  padding: 2px 7px;
  border-radius: 6px;
  background: rgba(14, 165, 233, 0.18);
  color: #7dd3fc;
  font-size: 10px;
  font-weight: 600;
}

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
</style>
