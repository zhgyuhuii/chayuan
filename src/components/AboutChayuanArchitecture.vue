<template>
  <!--
    察元 互联架构图:
      - 顶层 4 个产品(SKU)
      - 中层"统一引擎"汇流条(共享:对话引擎 / 知识库结构 / 设计系统)
      - 底层 6 个共享模块(察元智库 / 模型广场 / 察元办公 / 智能空间 / 应用市场 / 训练数据中心)
      - 流动光点的"主流"蓝色实线,以及"反馈/共享"橙色虚线
      - 任意节点点击弹出右侧详情面板;ESC / 点击空白处关闭
    设计要点:
      - viewBox 固定 1280×780,preserveAspectRatio 自适应屏幕
      - 实线动画用 stroke-dashoffset 关键帧驱动"光点流动"
      - 虚线动画方向相反,代表反馈回流
      - 节点 hover 略微抬高 + 阴影增强,点击有焦点框
  -->
  <section class="ca-architecture">
    <header class="ca-arch-head">
      <p class="ca-arch-eyebrow">察元产品互联架构</p>
      <h2 class="ca-arch-title">同一套引擎,四个产品形态</h2>
      <p class="ca-arch-sub">
        所有察元产品共享一套<strong>对话引擎 / 知识库结构 / 设计系统</strong>;
        差异只在<strong>部署形态 / 用户上限 / 模块开放度</strong>。
        点击任意节点查看详细介绍与逻辑关系。
      </p>
      <div class="ca-arch-legend" aria-hidden="true">
        <span class="ca-legend-item"><i class="ca-legend-line ca-legend-line-main"></i>主数据流</span>
        <span class="ca-legend-item"><i class="ca-legend-line ca-legend-line-warm"></i>共享 · 反馈回流</span>
        <span class="ca-legend-item"><i class="ca-legend-dot"></i>可点击 · 查看详情</span>
      </div>
    </header>

    <div class="ca-arch-canvas">
      <svg
        class="ca-arch-svg"
        viewBox="0 0 1280 780"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="察元四产品互联架构拓扑"
      >
        <defs>
          <linearGradient id="caCoolFlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#6ea8ff" stop-opacity="0.12" />
            <stop offset="50%" stop-color="#6ea8ff" stop-opacity="0.95" />
            <stop offset="100%" stop-color="#6ea8ff" stop-opacity="0.12" />
          </linearGradient>
          <linearGradient id="caWarmFlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#ffb27a" stop-opacity="0.10" />
            <stop offset="50%" stop-color="#ffb27a" stop-opacity="0.95" />
            <stop offset="100%" stop-color="#ffb27a" stop-opacity="0.10" />
          </linearGradient>
          <linearGradient id="caProdFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1e293b" />
            <stop offset="100%" stop-color="#0f172a" />
          </linearGradient>
          <linearGradient id="caProdFillHi" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1d4ed8" />
            <stop offset="100%" stop-color="#0f3691" />
          </linearGradient>
          <linearGradient id="caModFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0b3a8c" />
            <stop offset="100%" stop-color="#0a214a" />
          </linearGradient>
          <linearGradient id="caEngineFill" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#7a3bcf" stop-opacity="0.55" />
            <stop offset="50%" stop-color="#4f46e5" stop-opacity="0.95" />
            <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0.55" />
          </linearGradient>
          <filter id="caNodeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
            <feOffset dx="0" dy="3" result="b" />
            <feComponentTransfer><feFuncA type="linear" slope="0.45" /></feComponentTransfer>
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="caGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <!-- ───── 主数据流(蓝色实线 + 光点流动) ───── -->
        <g class="ca-flow-cool" fill="none" stroke="url(#caCoolFlow)" stroke-width="2.4" stroke-linecap="round">
          <!-- 4 个产品 → 引擎条 -->
          <path d="M 200 130 C 200 220 200 220 200 290" />
          <path d="M 480 130 C 480 220 480 220 480 290" />
          <path d="M 800 130 C 800 220 800 220 800 290" />
          <path d="M 1080 130 C 1080 220 1080 220 1080 290" />
          <!-- 引擎条 → 6 个模块 -->
          <path d="M 140 360 C 140 440 140 440 140 510" />
          <path d="M 365 360 C 365 440 365 440 365 510" />
          <path d="M 590 360 C 590 440 590 440 590 510" />
          <path d="M 815 360 C 815 440 815 440 815 510" />
          <path d="M 1040 360 C 1040 440 1040 440 1040 510" />
          <path d="M 1185 360 C 1185 440 1185 440 1185 600" />
        </g>

        <!-- ───── 共享 / 反馈(橙色虚线) ───── -->
        <g class="ca-flow-warm" fill="none" stroke="url(#caWarmFlow)" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="6 8">
          <!-- 训练数据中心 → 模型广场(微调反馈) -->
          <path d="M 1185 600 C 1185 660 365 660 365 600" />
          <!-- 智能空间 → 应用市场(空间编排应用) -->
          <path d="M 815 600 C 850 670 950 670 1040 600" />
          <!-- 察元办公 → 察元智库(办公文档纳入智库) -->
          <path d="M 590 600 C 470 670 290 670 140 600" />
        </g>

        <!-- ───── 节点:Top tier 4 产品 ───── -->
        <g
          v-for="(p, i) in products"
          :key="p.key"
          filter="url(#caNodeShadow)"
          class="ca-node ca-node-product"
          :class="{ 'ca-current': p.current, 'ca-emphasis': p.accent === 'emphasis', 'ca-highlight': p.accent === 'highlight' }"
          tabindex="0"
          role="button"
          :aria-label="`${p.name} — 查看介绍`"
          @click="openNode('product', p.key)"
          @keydown.enter.prevent="openNode('product', p.key)"
          @keydown.space.prevent="openNode('product', p.key)"
        >
          <rect
            :x="productX(i) - 130"
            y="30"
            width="260"
            height="90"
            rx="16"
            :fill="p.current ? 'url(#caProdFillHi)' : 'url(#caProdFill)'"
            :stroke="p.current ? '#60a5fa' : '#3b82f6'"
            :stroke-width="p.current ? 2.5 : 1.4"
          />
          <text :x="productX(i)" y="62" text-anchor="middle" class="ca-node-title">{{ p.icon }} {{ p.name }}</text>
          <text :x="productX(i)" y="82" text-anchor="middle" class="ca-node-sub">{{ p.sub }}</text>
          <text :x="productX(i)" y="103" text-anchor="middle" class="ca-node-faint">{{ p.tagline }}</text>
          <text v-if="p.current" :x="productX(i) + 95" y="50" text-anchor="middle" class="ca-current-pin">当前</text>
        </g>

        <!-- ───── 中层:统一引擎汇流条 ───── -->
        <g
          filter="url(#caNodeShadow)"
          class="ca-node ca-node-engine"
          tabindex="0"
          role="button"
          aria-label="统一引擎 — 查看介绍"
          @click="openNode('engine', 'engine')"
          @keydown.enter.prevent="openNode('engine', 'engine')"
          @keydown.space.prevent="openNode('engine', 'engine')"
        >
          <rect x="60" y="290" width="1160" height="70" rx="16" fill="url(#caEngineFill)" stroke="#a78bfa" stroke-width="1.6" />
          <text x="640" y="320" text-anchor="middle" class="ca-engine-title">⚙️ 统一引擎 · Unified Engine</text>
          <text x="640" y="343" text-anchor="middle" class="ca-engine-sub">
            对话引擎(模型路由 / 助手 / 工具 / MCP) · 知识库结构(doc / src / vec / office / img) · 设计系统(同套 UI 与交互)
          </text>
        </g>

        <!-- ───── 底层:6 个共享模块 ───── -->
        <g
          v-for="(m, i) in modules"
          :key="m.key"
          filter="url(#caNodeShadow)"
          class="ca-node ca-node-module"
          tabindex="0"
          role="button"
          :aria-label="`${m.name} — 查看介绍`"
          @click="openNode('module', m.key)"
          @keydown.enter.prevent="openNode('module', m.key)"
          @keydown.space.prevent="openNode('module', m.key)"
        >
          <rect
            :x="moduleX(i) - 100"
            y="510"
            width="200"
            height="90"
            rx="14"
            fill="url(#caModFill)"
            stroke="#60a5fa"
            stroke-width="1.4"
          />
          <text :x="moduleX(i)" y="538" text-anchor="middle" class="ca-node-title">{{ m.icon }} {{ m.name }}</text>
          <text :x="moduleX(i)" y="558" text-anchor="middle" class="ca-node-sub">{{ m.tagline }}</text>
          <text :x="moduleX(i)" y="580" text-anchor="middle" class="ca-node-faint">{{ m.availability }}</text>
        </g>

        <!-- "点击查看"提示文字 -->
        <text x="640" y="700" text-anchor="middle" class="ca-hint">
          点击任一节点 · 查看详细介绍与逻辑
        </text>
      </svg>

      <!-- ───── 详情侧滑面板 ───── -->
      <transition name="ca-slide">
        <aside
          v-if="activeNode"
          class="ca-detail-panel"
          role="dialog"
          aria-modal="true"
          :aria-label="activeNode.name"
        >
          <header class="ca-detail-head">
            <span class="ca-detail-icon">{{ activeNode.icon }}</span>
            <div class="ca-detail-titles">
              <h3>{{ activeNode.name }}</h3>
              <p>{{ activeNode.tagline }}</p>
            </div>
            <button class="ca-detail-close" aria-label="关闭" @click="closeNode">×</button>
          </header>
          <div class="ca-detail-body">
            <p v-if="activeNode.lead" class="ca-detail-lead">{{ activeNode.lead }}</p>

            <div v-if="activeNode.highlights?.length" class="ca-detail-block">
              <div class="ca-detail-block-title">核心能力</div>
              <ul class="ca-detail-list">
                <li v-for="(h, i) in activeNode.highlights" :key="i">{{ h }}</li>
              </ul>
            </div>

            <div v-if="activeNode.relations?.length" class="ca-detail-block">
              <div class="ca-detail-block-title">与其它产品 / 模块的关系</div>
              <ul class="ca-detail-list ca-detail-list-relation">
                <li v-for="(r, i) in activeNode.relations" :key="i">
                  <span class="ca-rel-arrow">→</span> {{ r }}
                </li>
              </ul>
            </div>

            <div v-if="activeNode.notes" class="ca-detail-note">{{ activeNode.notes }}</div>
          </div>
        </aside>
      </transition>
    </div>
  </section>
</template>

<script>
/*
 * 拓扑数据 — 文案对齐 /work/website/src/config/productCopy.js 的 EDITION_COMPARE 与 FEATURES_COPY。
 * highlights 取自官方网站,relations 写明本产品(WPS 文档助手)在家族里的相对定位与共享边界。
 */
const PRODUCTS = [
  {
    key: 'wps',
    name: '察元 WPS AI 文档助手',
    icon: '📄',
    sub: '开源 · 免费 · Apache-2.0',
    tagline: '装到 WPS 里,文档级 AI',
    accent: 'plain',
    current: true,
    lead: '你现在使用的就是这个产品 — 一个开源、可自托管、零成本的 WPS Writer 加载项。它把对话、检索、审校与写回都留在编辑器里,不需要切换窗口。',
    highlights: [
      '20+ 内置助手:摘要 / 改写 / 翻译 / 关键词 / AI 痕迹 / 保密检查',
      '远程知识库 RAG:问题改写 → 批量召回 → 去重 → 重排 → 引用 prompt',
      '8 种写回方式:替换 / 插入 / 追加 / 批注 / 链接批注 / 报告模式 等',
      '深度集成 wpsjs / WPS JS API / 文档原子能力',
      '与桌面版 / 服务版 / 至臻版 共享一套对话引擎与知识库结构'
    ],
    relations: [
      '与"桌面版"共享:对话引擎 / 知识库结构 / 助手模板;桌面版额外有 Model Arena 对抗与五类知识源统一查询',
      '与"服务版"共享:相同的助手与提示词;服务版多了团队配额、共享 KB、基础审计',
      '与"至臻版"共享:相同的引擎;至臻版多了在线办公 / 智能空间 / 应用市场 / 训练数据中心 整套企业模块'
    ]
  },
  {
    key: 'desktop',
    name: '察元 AI 桌面版',
    icon: '💻',
    sub: '单机 · 免费',
    tagline: '装到电脑里,离线 AI',
    accent: 'plain',
    lead: '一个 Tauri 原生壳 + 嵌入式 Python sidecar。装机即离线可用,密钥与文档不出域,适配国产化操作系统与 CPU 架构。',
    highlights: [
      '离线优先:嵌入式 Python + sqlite-vec + bge-m3 ONNX + RapidOCR 全部装进安装包',
      '察元智库:doc / src / vec / office / img 五类知识源,一个端点统一查询',
      'Model Arena 多泳道对抗 · 18+ 家 LLM 网关 · MCP 双角色(server + client)',
      '30+ 内置工具:Text2SQL / 17 种 SQL 方言 · Web 搜索 · 图像生成 · 钉钉飞书',
      '国产化:Kylin V10 / UOS / openKylin / deepin · x86_64 / aarch64 / loongarch64'
    ],
    relations: [
      '与"WPS 文档助手"(你正在用的)共享:对话引擎 / 知识库结构 / 设计系统',
      '与"服务版 / 至臻版"共享:同一份桌面端能力,服务版/至臻版把它升级为多人服务化部署',
      '不依赖云:可以全程内网 / 断网运行 — 政企可用'
    ]
  },
  {
    key: 'service',
    name: '察元 AI 服务版',
    icon: '🏢',
    sub: '团队 · ≤ 50 人 · 商业',
    tagline: '服务化部署,团队协作',
    accent: 'emphasis',
    lead: '把桌面版的能力升级成服务化部署,支持 ≤ 50 人的团队规模,带基础配额与审计,适合中小团队/部门级使用。',
    highlights: [
      '部署形态:服务化(non-单机);团队成员共享 KB / 模型 / 助手',
      '账户与权限:团队 + 角色;基础审计与配额',
      '继承桌面版全部能力:Knowledge Universe / Model Arena / 30+ 工具 / MCP',
      '与至臻版的核心差异:不含在线办公 / 智能空间 / 应用市场 / 训练数据中心'
    ],
    relations: [
      '⬆ 上面那条线:与桌面版相同的引擎与功能,只是把"单机 1 人"变成"服务化 N 人"',
      '⬇ 与至臻版相比:模块边界更紧,价格更友好',
      '商务咨询:cmdbird@163.com 或 aidooo.com'
    ]
  },
  {
    key: 'premium',
    name: '察元 AI 至臻版',
    icon: '👑',
    sub: '企业 · ≤ 500 人 · 推荐',
    tagline: '全模块齐全,企业级 AI 工作台',
    accent: 'highlight',
    lead: '面向 ≤ 500 人的企业;在服务版基础上,补齐"在线办公 / 智能空间 / 应用市场 / 训练数据中心"四大模块,提供完整审计 / SSO / BI 看板。',
    highlights: [
      '部署形态:服务化;企业组织 + SSO + 审计',
      '在线办公:Word / Excel / PPT 在线编辑(本图右上角"察元办公"节点)',
      '智能空间 + 应用市场:工作流 / Notebook / 业务应用插件',
      '训练数据中心:标注 / 微调 / 反馈闭环(本图右下角"训练数据中心"节点)',
      '配额 / 审计 / BI 看板 完整'
    ],
    relations: [
      '继承:服务版的全部能力(团队配额 / 多人 KB / 桌面版引擎)',
      '独家:训练数据中心可微调企业自有模型,反馈回流到模型广场(本图橙色虚线)',
      '商务咨询:cmdbird@163.com 或 aidooo.com'
    ]
  }
]

const MODULES = [
  {
    key: 'zhiku',
    name: '察元智库',
    icon: '📚',
    tagline: 'Knowledge Universe',
    availability: 'WPS / 桌面 / 服务 / 至臻',
    lead: '"察元智库"是把五类异构知识源(文档 / 结构化数据 / 外部向量 / 办公库 / 图像)统一到一个 RAG 入口的引擎层。',
    highlights: [
      '`doc:` 文档库:PDF / Word / Excel / Markdown / HTML / 图像 自动解析 + 切片 + 嵌入',
      '`src:` 结构化数据:MySQL / PG / Oracle / 达梦 / 金仓 / Doris … Text2SQL 17 方言',
      '`vec:` 外部向量库:Milvus / Chroma / Zilliz / PGVector / Relyt',
      '`office:owner[:group]` 企业 / 团队 / 个人三层办公私库',
      '`img:` 图像 CLIP 嵌入 + OCR 文字提取',
      '一个端点 `POST /api/v1/kb-query/search`,自动路由到对应 adapter'
    ],
    relations: [
      '本产品(WPS 助手)可直接消费远程智库,带引用气泡和原文下载',
      '桌面版/服务版/至臻版的"察元智库"是同一套 schema 与 API,只是部署位置不同',
      '与"训练数据中心"的橙色虚线:标注样本回流到智库,改善检索质量'
    ]
  },
  {
    key: 'moxing',
    name: '模型广场',
    icon: '🤖',
    tagline: '170+ 模型 · 18+ 厂商',
    availability: 'WPS / 桌面 / 服务 / 至臻',
    lead: '把"对话 / 视觉 / 嵌入 / 语音 / 图像"五类模型分类配置,所有助手按 capability 继承默认模型,密钥本地落盘。',
    highlights: [
      '云端:DeepSeek / 通义 / 文心 / 智谱 / Kimi / 豆包 / OpenAI / Anthropic / Gemini',
      '离线:Ollama / LM Studio / Xinference / OneAPI / vLLM(OpenAI 兼容)',
      '填 API Key 后自动拉 `/v1/models`,密钥 AES 加密本地落盘',
      '与"训练数据中心"形成微调闭环'
    ],
    relations: [
      '本产品里的"设置 → 模型清单"就是这个模块的 UI',
      '桌面版/至臻版多了 Model Arena 多泳道对抗',
      '橙色虚线:训练数据中心反馈微调 → 模型广场更新'
    ]
  },
  {
    key: 'bangong',
    name: '察元办公',
    icon: '📝',
    tagline: '在线 Office 编辑',
    availability: '至臻版',
    lead: '完整的 Word / Excel / PPT 在线编辑能力,直接接入察元智库的 RAG 与多模型路由,适合企业内的"边写边问"场景。',
    highlights: [
      '在线 Word / Excel / PPT 编辑',
      '与 WPS 加载项(本产品)互通文档,但部署形态不同',
      '深度结合智库与模型广场,文档自动纳入 office 库统一查询',
      '至臻版独占模块(服务版与桌面版不含)'
    ],
    relations: [
      '本产品(WPS 加载项)是"桌面 Office + AI"的方案;察元办公是"在线 Office + AI"的方案 — 两条路径互补',
      '橙色虚线:办公文档自动纳入察元智库,统一被检索'
    ]
  },
  {
    key: 'kongjian',
    name: '智能空间',
    icon: '🧩',
    tagline: '工作流 / Notebook',
    availability: '至臻版',
    lead: '面向团队的工作流 / Notebook / 应用编排空间;把"对话 + 工具 + RAG"做成可复用、可分发的工作面。',
    highlights: [
      '可视化工作流编排 + Notebook 风格的数据探索',
      '与应用市场打通:应用作为工作流的节点存在',
      '团队可见 / 私有 / 模板复用',
      '至臻版独占模块'
    ],
    relations: [
      '本产品(WPS 助手)有"任务编排"是简化版的同一类概念',
      '橙色虚线:智能空间 → 应用市场,空间编排里直接拉应用作为节点'
    ]
  },
  {
    key: 'shichang',
    name: '应用市场',
    icon: '📦',
    tagline: '业务应用 · 插件',
    availability: '至臻版',
    lead: '企业内 / 跨企业的应用与插件市场:把业务流程(报销审批 / 合同模板 / 数据查询)做成可分发的"应用"。',
    highlights: [
      '应用库:可发布 / 订阅 / 灰度',
      '可被智能空间作为工作流节点直接调用',
      '可挂载到我的待办 / Office / WPS 入口',
      '至臻版独占模块'
    ],
    relations: [
      '橙色虚线:智能空间编排应用、训练数据中心反哺应用质量',
      '本产品(WPS 助手)的"自定义助手"是简化版的应用 — 都是把 prompt + 输入 + 输出 + 写回打包'
    ]
  },
  {
    key: 'xunlian',
    name: '训练数据中心',
    icon: '🎯',
    tagline: '标注 · 微调 · 反馈闭环',
    availability: '至臻版',
    lead: '把企业里日常使用产生的对话 / 修订 / 反馈,沉淀成可微调的训练数据,构成"使用 → 标注 → 微调 → 上线"的反馈闭环。',
    highlights: [
      '对话与修订自动捕获 → 标注界面 → 训练样本',
      '微调结果回流到模型广场,可在所有产品里直接使用',
      '标注样本可入库到察元智库,改善检索',
      '至臻版独占模块 — 是真正把"AI 越用越好"做出来的环节'
    ],
    relations: [
      '橙色虚线 1:训练数据中心 → 模型广场(微调后的模型可被任意产品调用)',
      '橙色虚线 2:训练数据中心 → 察元智库(高质量标注样本反哺检索)'
    ]
  }
]

const ENGINE = {
  key: 'engine',
  name: '统一引擎(Unified Engine)',
  icon: '⚙️',
  tagline: '所有察元产品共享的中枢',
  lead: '统一引擎不是一个 SKU,它是被所有 4 个产品共同使用的"底层":同一套对话引擎、同一套知识库结构、同一套设计系统。这也是为什么从 WPS 助手切换到桌面版/服务版/至臻版时,你的助手、KB、模型几乎"零迁移成本"。',
  highlights: [
    '对话引擎:模型路由 / 助手系统 / 工具调用 / MCP 协议',
    '知识库结构:doc / src / vec / office / img 五类知识源 schema 一致',
    '设计系统:同一套 UI、同一套交互、同一套术语',
    '权限与凭据:AES-GCM 加密落盘,跨产品复用'
  ],
  relations: [
    '⬆ 上层:4 个产品的 SKU 边界只在"部署形态 / 用户上限 / 模块开放度"',
    '⬇ 下层:6 个共享模块都直接构建在统一引擎之上'
  ]
}

export default {
  name: 'AboutChayuanArchitecture',
  data() {
    return {
      products: PRODUCTS,
      modules: MODULES,
      engine: ENGINE,
      activeNode: null,
      onEscape: null
    }
  },
  mounted() {
    this.onEscape = (e) => {
      if (e.key === 'Escape' && this.activeNode) this.closeNode()
    }
    window.addEventListener('keydown', this.onEscape)
  },
  beforeUnmount() {
    if (this.onEscape) window.removeEventListener('keydown', this.onEscape)
  },
  methods: {
    productX(i) {
      // 4 个产品横向均匀分布,viewBox=1280;留两侧 200 边距 → 中心点:200, 480, 800, 1080
      const xs = [200, 480, 800, 1080]
      return xs[i] || 200
    },
    moduleX(i) {
      // 6 个模块横向分布,左 140 / 右 1185(最后一个为训练数据中心,偏下凸显反馈关系)
      const xs = [140, 365, 590, 815, 1040, 1185]
      return xs[i] || 140
    },
    openNode(kind, key) {
      if (kind === 'product') this.activeNode = this.products.find(p => p.key === key) || null
      else if (kind === 'module') this.activeNode = this.modules.find(m => m.key === key) || null
      else if (kind === 'engine') this.activeNode = this.engine
    },
    closeNode() {
      this.activeNode = null
    }
  }
}
</script>

<style scoped>
.ca-architecture {
  background: linear-gradient(180deg, #0b1226 0%, #0f172a 100%);
  border-radius: 16px;
  padding: 28px 24px;
  color: #e2e8f0;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(96, 165, 250, 0.18);
  box-shadow: 0 12px 40px -16px rgba(15, 23, 42, 0.55);
}

.ca-arch-head { margin-bottom: 18px; }
.ca-arch-eyebrow {
  color: #60a5fa;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin: 0 0 6px;
}
.ca-arch-title { margin: 0 0 8px; font-size: 22px; color: #f8fafc; }
.ca-arch-sub { margin: 0 0 14px; font-size: 13.5px; line-height: 1.7; color: #cbd5e1; }
.ca-arch-sub strong { color: #f1f5f9; }

.ca-arch-legend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; color: #94a3b8; }
.ca-legend-item { display: inline-flex; align-items: center; gap: 6px; }
.ca-legend-line { display: inline-block; width: 22px; height: 2.4px; border-radius: 2px; }
.ca-legend-line-main { background: #6ea8ff; }
.ca-legend-line-warm { background: #ffb27a; }
.ca-legend-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #a78bfa; box-shadow: 0 0 8px #a78bfa; }

.ca-arch-canvas {
  position: relative;
  width: 100%;
  aspect-ratio: 1280 / 780;
  background: radial-gradient(ellipse at 50% 40%, rgba(99, 102, 241, 0.12), transparent 60%);
  border-radius: 12px;
  overflow: hidden;
}
.ca-arch-svg { display: block; width: 100%; height: 100%; }

/* 节点字号 / 颜色 */
.ca-node-title { font-size: 14px; font-weight: 600; fill: #f8fafc; }
.ca-node-sub { font-size: 11.5px; fill: #93c5fd; }
.ca-node-faint { font-size: 10.5px; fill: #94a3b8; }
.ca-engine-title { font-size: 16px; font-weight: 700; fill: #ffffff; letter-spacing: 0.02em; }
.ca-engine-sub { font-size: 11px; fill: rgba(255,255,255,0.85); }
.ca-current-pin {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  fill: #fef3c7;
  paint-order: stroke;
  stroke: #b45309;
  stroke-width: 0.6;
}
.ca-hint { font-size: 11.5px; fill: #64748b; letter-spacing: 0.08em; }

/* 节点交互 — 悬停抬升 */
.ca-node { cursor: pointer; transition: transform 0.18s ease, filter 0.18s ease; transform-origin: center; transform-box: fill-box; }
.ca-node:hover { transform: translateY(-2px); filter: drop-shadow(0 8px 18px rgba(96, 165, 250, 0.35)); }
.ca-node:focus { outline: none; }
.ca-node:focus-visible rect { stroke: #fbbf24; stroke-width: 3; }
.ca-node-product.ca-current rect { filter: drop-shadow(0 0 14px rgba(96, 165, 250, 0.7)); }
.ca-node-product.ca-highlight rect { filter: drop-shadow(0 0 12px rgba(251, 191, 36, 0.45)); }

/* 主流(蓝色)光点流动:stroke-dasharray + dashoffset 关键帧 */
.ca-flow-cool path {
  stroke-dasharray: 6 10;
  animation: caFlowCool 3.2s linear infinite;
}
@keyframes caFlowCool {
  to { stroke-dashoffset: -160; }
}

/* 共享 / 反馈(橙色)光点反向 */
.ca-flow-warm path {
  animation: caFlowWarm 5s linear infinite;
}
@keyframes caFlowWarm {
  to { stroke-dashoffset: 160; }
}

/* ───── 详情侧滑面板 ───── */
.ca-detail-panel {
  position: absolute;
  top: 12px;
  right: 12px;
  width: min(420px, calc(100% - 24px));
  max-height: calc(100% - 24px);
  background: rgba(15, 23, 42, 0.96);
  border: 1px solid rgba(96, 165, 250, 0.35);
  border-radius: 14px;
  box-shadow: 0 24px 60px -18px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: 5;
  backdrop-filter: blur(6px);
}
.ca-detail-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(96, 165, 250, 0.18);
  background: linear-gradient(120deg, rgba(99, 102, 241, 0.22), rgba(14, 165, 233, 0.12));
}
.ca-detail-icon { font-size: 24px; }
.ca-detail-titles { flex: 1; min-width: 0; }
.ca-detail-titles h3 { margin: 0; font-size: 16px; color: #f8fafc; }
.ca-detail-titles p { margin: 2px 0 0; font-size: 12px; color: #93c5fd; }
.ca-detail-close {
  background: transparent; border: none; color: #cbd5e1;
  font-size: 22px; line-height: 1; cursor: pointer; padding: 0 4px;
}
.ca-detail-close:hover { color: #f8fafc; }

.ca-detail-body { padding: 14px 16px 18px; overflow-y: auto; font-size: 13px; line-height: 1.7; }
.ca-detail-lead { margin: 0 0 14px; color: #e2e8f0; font-size: 13px; line-height: 1.75; }

.ca-detail-block { margin-top: 14px; }
.ca-detail-block:first-of-type { margin-top: 0; }
.ca-detail-block-title {
  font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
  color: #93c5fd; margin-bottom: 6px;
}
.ca-detail-list { margin: 0; padding-left: 18px; color: #cbd5e1; }
.ca-detail-list li { margin: 4px 0; }
.ca-detail-list-relation { padding-left: 0; list-style: none; }
.ca-detail-list-relation li { padding-left: 0; }
.ca-rel-arrow { color: #60a5fa; margin-right: 6px; }
.ca-detail-note {
  margin-top: 14px;
  padding: 10px 12px;
  background: rgba(96, 165, 250, 0.08);
  border-left: 3px solid #60a5fa;
  border-radius: 4px;
  font-size: 12px;
  color: #93c5fd;
}

.ca-slide-enter-active, .ca-slide-leave-active { transition: opacity 0.18s, transform 0.22s cubic-bezier(.2,.8,.4,1); }
.ca-slide-enter-from, .ca-slide-leave-to { opacity: 0; transform: translateY(8px) scale(0.985); }

/* 窄屏:面板变全宽底贴 */
@media (max-width: 720px) {
  .ca-detail-panel {
    top: auto;
    left: 8px;
    right: 8px;
    bottom: 8px;
    width: auto;
    max-height: 60%;
  }
}
</style>
