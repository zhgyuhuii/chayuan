<template>
  <!--
    KB 设置页"零连接"空态:用一张铺满面板的拓扑图展示察元的全链路。
      Stage 0:知识问答(用户入口)
      Stage 1:察元 AI 助手(中枢编排)
      Stage 2:7 个并列模块 — 察元智库 / 察元办公 / 模型广场 / 智能空间 / 应用市场 /
              训练数据中心 / 我的待办(每个模块下都有具体的知识/能力来源)
      Stage 3:仅在察元智库下展开 6 类知识源 — 文档 / 结构化 / 搜索引擎 / 半结构化 /
              向量 / 图像
    每条连线用 stroke-dasharray + stroke-dashoffset 的 CSS 动画形成"流光",让数据流向
    一目了然。
  -->
  <section class="kb-empty-topology">
    <header class="kb-empty-topology-head">
      <div class="kb-empty-topology-title">
        <h3>知识库连接</h3>
        <p class="kb-empty-topology-sub">还没配置任何连接。点击右上角「新建连接」开始;下方拓扑展示了察元如何把"知识问答 → AI 助手 → 多类能力"串成一条统一路径。</p>
      </div>
      <button class="btn-primary kb-empty-topology-new" @click="$emit('create')">＋ 新建连接</button>
    </header>

    <div class="kb-empty-topology-canvas">
      <svg
        class="kb-topo-svg"
        viewBox="0 0 1280 780"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="察元知识查询全链路拓扑"
      >
        <defs>
          <linearGradient id="kbFlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stop-color="#6ea8ff" stop-opacity="0.15" />
            <stop offset="50%"  stop-color="#6ea8ff" stop-opacity="0.95" />
            <stop offset="100%" stop-color="#6ea8ff" stop-opacity="0.15" />
          </linearGradient>
          <linearGradient id="kbFlowGradWarm" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stop-color="#ffb27a" stop-opacity="0.15" />
            <stop offset="50%"  stop-color="#ffb27a" stop-opacity="0.95" />
            <stop offset="100%" stop-color="#ffb27a" stop-opacity="0.15" />
          </linearGradient>
          <linearGradient id="kbNodeFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stop-color="#ffffff" />
            <stop offset="100%" stop-color="#eef3ff" />
          </linearGradient>
          <linearGradient id="kbHubFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stop-color="#eef3ff" />
            <stop offset="100%" stop-color="#dde7ff" />
          </linearGradient>
          <linearGradient id="kbNodeStroke" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stop-color="#a8c0ff" />
            <stop offset="100%" stop-color="#6e8ce0" />
          </linearGradient>
          <filter id="kbNodeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="2" result="offsetblur" />
            <feComponentTransfer><feFuncA type="linear" slope="0.18" /></feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <!-- ─────────────────────────────────────────────
             连线层(流光)
             - 第 1 类:Stage0→Stage1, Stage1→7 模块 — 主流(蓝)
             - 第 2 类:智库→6 类知识源 — 子流(蓝)
             - 第 3 类:训练数据中心 →(反馈)→ 模型广场 — 反馈流(暖)
             ───────────────────────────────────────────── -->
        <g class="kb-topo-flows-cool" fill="none" stroke="url(#kbFlowGrad)" stroke-width="2.4" stroke-linecap="round">
          <!-- Stage 0 → Stage 1 -->
          <path d="M 180 400 L 320 400" />

          <!-- Stage 1 (右边 x=490, 中心 y=395) → 7 个 Stage 2 模块 (左边 x=620) -->
          <path d="M 490 395 C 555 395 555 52  620 52"  />  <!-- → 察元智库 (y center 52) -->
          <path d="M 490 395 C 555 395 555 145 620 145" />  <!-- → 察元办公 -->
          <path d="M 490 395 C 555 395 555 235 620 235" />  <!-- → 模型广场 -->
          <path d="M 490 395 C 555 395 555 325 620 325" />  <!-- → 智能空间 -->
          <path d="M 490 395 C 555 395 555 415 620 415" />  <!-- → 应用市场 -->
          <path d="M 490 395 C 555 395 555 505 620 505" />  <!-- → 训练数据中心 -->
          <path d="M 490 395 C 555 395 555 595 620 595" />  <!-- → 我的待办 -->

          <!-- Stage 2.察元智库 (右边 x=810, 中心 y=52) → 6 类知识源 (左边 x=940) -->
          <path d="M 810 52 C 875 52 875 30  940 30" />
          <path d="M 810 52 C 875 52 875 80  940 80" />
          <path d="M 810 52 C 875 52 875 130 940 130" />
          <path d="M 810 52 C 875 52 875 180 940 180" />
          <path d="M 810 52 C 875 52 875 230 940 230" />
          <path d="M 810 52 C 875 52 875 280 940 280" />
        </g>

        <!-- 反馈流:训练数据中心 → 模型广场(虚线 + 暖色,提示这是"训练 / 微调"反馈) -->
        <g class="kb-topo-flows-warm" fill="none" stroke="url(#kbFlowGradWarm)" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="4 6">
          <path d="M 620 505 C 580 505 580 235 620 235" />
        </g>

        <!-- ─────────────────────────────────────────────
             节点层
             ───────────────────────────────────────────── -->
        <!-- Stage 0:知识问答 -->
        <g filter="url(#kbNodeShadow)">
          <rect x="40" y="370" width="140" height="60" rx="14" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.5" />
          <text x="110" y="395" text-anchor="middle" class="kb-node-title">知识问答</text>
          <text x="110" y="416" text-anchor="middle" class="kb-node-sub">User Query</text>
        </g>

        <!-- Stage 1:察元 AI 助手 -->
        <g filter="url(#kbNodeShadow)">
          <rect x="320" y="355" width="170" height="80" rx="16" fill="url(#kbHubFill)" stroke="url(#kbNodeStroke)" stroke-width="2" />
          <text x="405" y="382" text-anchor="middle" class="kb-node-title kb-node-title-strong">察元 AI 助手</text>
          <text x="405" y="402" text-anchor="middle" class="kb-node-sub">Agent / 编排中枢</text>
          <text x="405" y="420" text-anchor="middle" class="kb-node-sub kb-node-sub-faint">意图识别 · 任务编排 · 引用回链</text>
        </g>

        <!-- Stage 2.1:察元智库(中枢级,稍大) -->
        <g filter="url(#kbNodeShadow)">
          <rect x="620" y="15" width="190" height="75" rx="16" fill="url(#kbHubFill)" stroke="url(#kbNodeStroke)" stroke-width="2" />
          <text x="715" y="42" text-anchor="middle" class="kb-node-title kb-node-title-strong">察元智库</text>
          <text x="715" y="60" text-anchor="middle" class="kb-node-sub">Knowledge Universe</text>
          <text x="715" y="78" text-anchor="middle" class="kb-node-sub kb-node-sub-faint">统一查询 / 权限 / 引用</text>
        </g>

        <!-- Stage 2.2:察元办公 -->
        <g filter="url(#kbNodeShadow)">
          <rect x="620" y="115" width="190" height="60" rx="14" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.5" />
          <text x="715" y="140" text-anchor="middle" class="kb-node-title">察元办公</text>
          <text x="715" y="161" text-anchor="middle" class="kb-node-sub">Office · WPS / Word / Excel / PPT / PDF</text>
        </g>

        <!-- Stage 2.3:模型广场 -->
        <g filter="url(#kbNodeShadow)">
          <rect x="620" y="205" width="190" height="60" rx="14" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.5" />
          <text x="715" y="230" text-anchor="middle" class="kb-node-title">模型广场</text>
          <text x="715" y="251" text-anchor="middle" class="kb-node-sub">LLM · 嵌入 · 重排 · 多模态</text>
        </g>

        <!-- Stage 2.4:智能空间 -->
        <g filter="url(#kbNodeShadow)">
          <rect x="620" y="295" width="190" height="60" rx="14" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.5" />
          <text x="715" y="320" text-anchor="middle" class="kb-node-title">智能空间</text>
          <text x="715" y="341" text-anchor="middle" class="kb-node-sub">工作流 · Notebook · 协作</text>
        </g>

        <!-- Stage 2.5:应用市场 -->
        <g filter="url(#kbNodeShadow)">
          <rect x="620" y="385" width="190" height="60" rx="14" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.5" />
          <text x="715" y="410" text-anchor="middle" class="kb-node-title">应用市场</text>
          <text x="715" y="431" text-anchor="middle" class="kb-node-sub">业务应用 · 插件 · 自定义助手</text>
        </g>

        <!-- Stage 2.6:训练数据中心 -->
        <g filter="url(#kbNodeShadow)">
          <rect x="620" y="475" width="190" height="60" rx="14" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.5" />
          <text x="715" y="500" text-anchor="middle" class="kb-node-title">训练数据中心</text>
          <text x="715" y="521" text-anchor="middle" class="kb-node-sub">标注样本 · 反馈 · 微调任务</text>
        </g>

        <!-- Stage 2.7:我的待办 -->
        <g filter="url(#kbNodeShadow)">
          <rect x="620" y="565" width="190" height="60" rx="14" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.5" />
          <text x="715" y="590" text-anchor="middle" class="kb-node-title">我的待办</text>
          <text x="715" y="611" text-anchor="middle" class="kb-node-sub">任务清单 · 跟踪 · 提醒</text>
        </g>

        <!-- Stage 3:6 类知识源(仅在 察元智库 下展开) -->
        <g filter="url(#kbNodeShadow)">
          <rect x="940" y="10"  width="140" height="40" rx="10" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.3" />
          <text x="1010" y="35" text-anchor="middle" class="kb-node-title-sm">📄 文档 · Word/PDF/MD</text>
        </g>
        <g filter="url(#kbNodeShadow)">
          <rect x="940" y="60"  width="140" height="40" rx="10" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.3" />
          <text x="1010" y="85" text-anchor="middle" class="kb-node-title-sm">🗄️ 结构化 · MySQL/Oracle</text>
        </g>
        <g filter="url(#kbNodeShadow)">
          <rect x="940" y="110" width="140" height="40" rx="10" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.3" />
          <text x="1010" y="135" text-anchor="middle" class="kb-node-title-sm">🔎 搜索引擎 · ES</text>
        </g>
        <g filter="url(#kbNodeShadow)">
          <rect x="940" y="160" width="140" height="40" rx="10" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.3" />
          <text x="1010" y="185" text-anchor="middle" class="kb-node-title-sm">🍃 半结构化 · MongoDB</text>
        </g>
        <g filter="url(#kbNodeShadow)">
          <rect x="940" y="210" width="140" height="40" rx="10" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.3" />
          <text x="1010" y="235" text-anchor="middle" class="kb-node-title-sm">🧬 向量 · Milvus</text>
        </g>
        <g filter="url(#kbNodeShadow)">
          <rect x="940" y="260" width="140" height="40" rx="10" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.3" />
          <text x="1010" y="285" text-anchor="middle" class="kb-node-title-sm">🖼️ 图像 · JPG/PNG</text>
        </g>

        <!-- 反馈流标签:微调反馈(暖色虚线对应) -->
        <text x="558" y="370" text-anchor="end" class="kb-flow-label">微调反馈</text>
      </svg>
    </div>

    <footer class="kb-empty-topology-foot">
      <span class="kb-empty-topology-tip">
        <span class="kb-empty-dot" />
        蓝色实线:用户问题 → 助手编排 → 多类能力(智库 / 办公 / 模型 / 空间 / 应用 / 训练 / 待办)。
        <span class="kb-empty-dot kb-empty-dot-warm" />
        橙色虚线:训练数据 → 模型微调反馈回流。
      </span>
    </footer>
  </section>
</template>

<script>
export default {
  name: 'KbEmptyTopology',
  emits: ['create'],
}
</script>

<style scoped>
.kb-empty-topology {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(180deg, #f7faff 0%, #ffffff 100%);
  font-size: 13px;
  color: #2a2a2a;
  overflow: hidden;
}

.kb-empty-topology-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px 10px;
  border-bottom: 1px solid #e6ecf6;
  flex-shrink: 0;
  background: rgba(247, 250, 255, 0.92);
}

.kb-empty-topology-title h3 {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: #1f2a44;
}
.kb-empty-topology-sub {
  margin: 0;
  max-width: 580px;
  font-size: 12.5px;
  line-height: 1.55;
  color: #5b6783;
}

.kb-empty-topology-new {
  flex-shrink: 0;
  border: 1px solid #2a6ddf;
  background: #2a6ddf;
  color: #fff;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.18s ease, transform 0.18s ease;
}
.kb-empty-topology-new:hover { background: #1452c4; transform: translateY(-1px); }

.kb-empty-topology-canvas {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 18px;
}
.kb-topo-svg {
  width: 100%;
  height: 100%;
  max-width: 1300px;
  max-height: 100%;
}

/* 流光:在 stroke-dasharray 上滚 stroke-dashoffset */
.kb-topo-flows-cool path {
  stroke-dasharray: 8 14;
  animation: kbFlow 1.6s linear infinite;
  filter: drop-shadow(0 0 4px rgba(110, 168, 255, 0.45));
}
.kb-topo-flows-cool path:nth-child(1) { animation-delay: 0s; }
.kb-topo-flows-cool path:nth-child(2) { animation-delay: 0.18s; }
.kb-topo-flows-cool path:nth-child(3) { animation-delay: 0.30s; }
.kb-topo-flows-cool path:nth-child(4) { animation-delay: 0.42s; }
.kb-topo-flows-cool path:nth-child(5) { animation-delay: 0.54s; }
.kb-topo-flows-cool path:nth-child(6) { animation-delay: 0.66s; }
.kb-topo-flows-cool path:nth-child(7) { animation-delay: 0.78s; }
.kb-topo-flows-cool path:nth-child(8) { animation-delay: 0.90s; }
.kb-topo-flows-cool path:nth-child(9)  { animation-delay: 0.05s; }
.kb-topo-flows-cool path:nth-child(10) { animation-delay: 0.20s; }
.kb-topo-flows-cool path:nth-child(11) { animation-delay: 0.35s; }
.kb-topo-flows-cool path:nth-child(12) { animation-delay: 0.50s; }
.kb-topo-flows-cool path:nth-child(13) { animation-delay: 0.65s; }
.kb-topo-flows-cool path:nth-child(14) { animation-delay: 0.80s; }

.kb-topo-flows-warm path {
  animation: kbFlowWarm 2.2s linear infinite;
  filter: drop-shadow(0 0 3px rgba(255, 178, 122, 0.55));
}

@keyframes kbFlow      { to { stroke-dashoffset: -22; } }
@keyframes kbFlowWarm  { to { stroke-dashoffset: -20; } }

/* 节点文字 */
.kb-topo-svg text { font-family: inherit; pointer-events: none; }
.kb-node-title          { font-size: 13.5px; font-weight: 600; fill: #1f2a44; }
.kb-node-title-strong   { font-size: 14.5px; }
.kb-node-title-sm       { font-size: 11.5px; font-weight: 600; fill: #1f2a44; }
.kb-node-sub            { font-size: 10.5px; fill: #6b7891; }
.kb-node-sub-faint      { fill: #97a2bd; }
.kb-flow-label          { font-size: 10.5px; fill: #c97b4a; font-weight: 500; }

.kb-empty-topology-foot {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding: 8px 18px 14px;
  border-top: 1px solid #eef2f8;
}
.kb-empty-topology-tip {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: #6b7891;
}

.kb-empty-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6ea8ff;
  box-shadow: 0 0 6px rgba(110, 168, 255, 0.85);
  animation: kbDotPulse 1.4s ease-in-out infinite;
}
.kb-empty-dot-warm {
  background: #ffb27a;
  box-shadow: 0 0 6px rgba(255, 178, 122, 0.85);
  margin-left: 8px;
}

@keyframes kbDotPulse {
  0%, 100% { opacity: 0.55; transform: scale(0.85); }
  50%      { opacity: 1;    transform: scale(1.15); }
}

@media (prefers-reduced-motion: reduce) {
  .kb-topo-flows-cool path,
  .kb-topo-flows-warm path,
  .kb-empty-dot { animation: none; }
}
</style>
