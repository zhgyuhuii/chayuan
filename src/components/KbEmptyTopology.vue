<template>
  <!--
    KB 设置页"零连接"空态:用一张铺满面板的拓扑图展示察元的知识查询全链路。
    左→右:知识问答 → 察元 AI 助手 → 察元智库 → 6 类知识源(文档 / 结构化 / 搜索引擎 / 半结构化 / 向量 / 图像)。
    每条连接线用 stroke-dasharray + stroke-dashoffset 做"流光"动画,让用户对数据流向一目了然。
    顶部右上角保留"新建连接"按钮,点击触发同名 emit 让父组件打开连接表单。
  -->
  <section class="kb-empty-topology">
    <header class="kb-empty-topology-head">
      <div class="kb-empty-topology-title">
        <h3>知识库连接</h3>
        <p class="kb-empty-topology-sub">还没配置任何连接。点击右上角「新建连接」开始,或浏览下方拓扑了解察元如何把多类知识源串起来。</p>
      </div>
      <button class="btn-primary kb-empty-topology-new" @click="$emit('create')">＋ 新建连接</button>
    </header>

    <div class="kb-empty-topology-canvas">
      <svg
        class="kb-topo-svg"
        viewBox="0 0 1000 600"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="察元知识查询拓扑"
      >
        <!-- ─── 渐变 / 滤镜定义 ─── -->
        <defs>
          <linearGradient id="kbFlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#6ea8ff" stop-opacity="0.15" />
            <stop offset="50%" stop-color="#6ea8ff" stop-opacity="0.95" />
            <stop offset="100%" stop-color="#6ea8ff" stop-opacity="0.15" />
          </linearGradient>
          <linearGradient id="kbNodeFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="100%" stop-color="#eef3ff" />
          </linearGradient>
          <linearGradient id="kbNodeStroke" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#a8c0ff" />
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

        <!-- ─── 主干连线:每条 path 用 stroke-dasharray + 动画 stroke-dashoffset 形成"流光" ─── -->
        <g class="kb-topo-flows" fill="none" stroke="url(#kbFlowGrad)" stroke-width="2.4" stroke-linecap="round">
          <path d="M 175 300 L 320 300" />
          <path d="M 460 300 L 605 300" />

          <!-- 中心智库 → 6 类知识源(贝塞尔曲线) -->
          <path d="M 760 300 C 830 300 850 90  900 90" />
          <path d="M 760 300 C 830 300 850 174 900 174" />
          <path d="M 760 300 C 830 300 850 258 900 258" />
          <path d="M 760 300 C 830 300 850 342 900 342" />
          <path d="M 760 300 C 830 300 850 426 900 426" />
          <path d="M 760 300 C 830 300 850 510 900 510" />
        </g>

        <!-- ─── 节点 ─── -->
        <!-- 阶段 0:用户的知识问答 -->
        <g filter="url(#kbNodeShadow)">
          <rect x="40" y="270" width="135" height="60" rx="14" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.5" />
          <text x="107.5" y="295" text-anchor="middle" class="kb-node-title">知识问答</text>
          <text x="107.5" y="316" text-anchor="middle" class="kb-node-sub">User</text>
        </g>

        <!-- 阶段 1:察元 AI 助手 -->
        <g filter="url(#kbNodeShadow)">
          <rect x="320" y="270" width="140" height="60" rx="14" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.5" />
          <text x="390" y="295" text-anchor="middle" class="kb-node-title">察元 AI 助手</text>
          <text x="390" y="316" text-anchor="middle" class="kb-node-sub">Agent / WPS 加载项</text>
        </g>

        <!-- 阶段 2:察元智库(中枢) -->
        <g filter="url(#kbNodeShadow)">
          <rect x="605" y="262" width="155" height="76" rx="18" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="2" />
          <text x="682.5" y="291" text-anchor="middle" class="kb-node-title kb-node-title-strong">察元智库</text>
          <text x="682.5" y="310" text-anchor="middle" class="kb-node-sub">Knowledge Universe</text>
          <text x="682.5" y="327" text-anchor="middle" class="kb-node-sub kb-node-sub-faint">统一查询 / 权限 / 引用</text>
        </g>

        <!-- 阶段 3:6 类知识源 -->
        <g filter="url(#kbNodeShadow)">
          <rect x="900" y="60"  width="92" height="60" rx="12" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.4" />
          <text x="946" y="85"  text-anchor="middle" class="kb-node-title-sm">📄 文档</text>
          <text x="946" y="105" text-anchor="middle" class="kb-node-sub-sm">Word / PDF / MD</text>
        </g>
        <g filter="url(#kbNodeShadow)">
          <rect x="900" y="144" width="92" height="60" rx="12" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.4" />
          <text x="946" y="169" text-anchor="middle" class="kb-node-title-sm">🗄️ 结构化</text>
          <text x="946" y="189" text-anchor="middle" class="kb-node-sub-sm">MySQL / Oracle</text>
        </g>
        <g filter="url(#kbNodeShadow)">
          <rect x="900" y="228" width="92" height="60" rx="12" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.4" />
          <text x="946" y="253" text-anchor="middle" class="kb-node-title-sm">🔎 搜索引擎</text>
          <text x="946" y="273" text-anchor="middle" class="kb-node-sub-sm">ES</text>
        </g>
        <g filter="url(#kbNodeShadow)">
          <rect x="900" y="312" width="92" height="60" rx="12" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.4" />
          <text x="946" y="337" text-anchor="middle" class="kb-node-title-sm">🍃 半结构化</text>
          <text x="946" y="357" text-anchor="middle" class="kb-node-sub-sm">MongoDB</text>
        </g>
        <g filter="url(#kbNodeShadow)">
          <rect x="900" y="396" width="92" height="60" rx="12" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.4" />
          <text x="946" y="421" text-anchor="middle" class="kb-node-title-sm">🧬 向量</text>
          <text x="946" y="441" text-anchor="middle" class="kb-node-sub-sm">Milvus</text>
        </g>
        <g filter="url(#kbNodeShadow)">
          <rect x="900" y="480" width="92" height="60" rx="12" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.4" />
          <text x="946" y="505" text-anchor="middle" class="kb-node-title-sm">🖼️ 图像</text>
          <text x="946" y="525" text-anchor="middle" class="kb-node-sub-sm">JPG / PNG</text>
        </g>

        <!-- ─── 箭头小三角(在每条主干末端 -1px,纯装饰) ─── -->
        <g class="kb-topo-arrows" fill="#6e8ce0" opacity="0.9">
          <polygon points="316,300 308,295 308,305" />
          <polygon points="601,300 593,295 593,305" />
        </g>
      </svg>
    </div>

    <footer class="kb-empty-topology-foot">
      <span class="kb-empty-topology-tip">
        <span class="kb-empty-dot" /> 数据流方向:用户问题 → 助手编排 → 智库统一查询 → 各类知识源并行检索后汇总。
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
  max-width: 540px;
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
.kb-empty-topology-new:hover {
  background: #1452c4;
  transform: translateY(-1px);
}

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
  max-width: 1100px;
  max-height: 100%;
}

/* 流光 — 在 stroke-dasharray 上滚动 stroke-dashoffset */
.kb-topo-flows path {
  stroke-dasharray: 8 14;
  animation: kbFlow 1.6s linear infinite;
  filter: drop-shadow(0 0 4px rgba(110, 168, 255, 0.45));
}
.kb-topo-flows path:nth-child(1) { animation-delay: 0s; }
.kb-topo-flows path:nth-child(2) { animation-delay: 0.2s; }
.kb-topo-flows path:nth-child(3) { animation-delay: 0.4s; }
.kb-topo-flows path:nth-child(4) { animation-delay: 0.5s; }
.kb-topo-flows path:nth-child(5) { animation-delay: 0.6s; }
.kb-topo-flows path:nth-child(6) { animation-delay: 0.7s; }
.kb-topo-flows path:nth-child(7) { animation-delay: 0.8s; }
.kb-topo-flows path:nth-child(8) { animation-delay: 0.9s; }

@keyframes kbFlow {
  to { stroke-dashoffset: -22; }
}

/* 节点上的文字 */
.kb-topo-svg text { font-family: inherit; pointer-events: none; }
.kb-node-title    { font-size: 13.5px; font-weight: 600; fill: #1f2a44; }
.kb-node-title-strong { font-size: 14.5px; }
.kb-node-title-sm { font-size: 12px;  font-weight: 600; fill: #1f2a44; }
.kb-node-sub      { font-size: 10.5px; fill: #6b7891; }
.kb-node-sub-sm   { font-size: 9.5px;  fill: #6b7891; }
.kb-node-sub-faint { fill: #97a2bd; }

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

@keyframes kbDotPulse {
  0%, 100% { opacity: 0.55; transform: scale(0.85); }
  50%      { opacity: 1;    transform: scale(1.15); }
}

/* 减弱动画 — 用户开启 prefers-reduced-motion 时静止 */
@media (prefers-reduced-motion: reduce) {
  .kb-topo-flows path,
  .kb-empty-dot { animation: none; }
}
</style>
