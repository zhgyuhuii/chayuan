<template>
  <!--
    KB 设置页"零连接"空态:用一张铺满面板的拓扑图展示察元的全链路。
      Stage 0:知识问答(用户入口)
      Stage 1:察元 AI 助手(中枢编排)
      Stage 2:7 个并列模块 — 智库 / 办公 / 模型广场 / 智能空间 / 应用市场 /
              训练数据中心 / 我的待办
      Stage 3:9 个具体能力源
        ├ 智库下:文档 / 结构化 / 搜索引擎 / 半结构化 / 向量 / 图像
        ├ 模型广场下:离线模型(Ollama/vLLM) / 云厂商模型(DeepSeek/阿里百炼)
        └ 应用市场下:应用库(被智能空间 / 我的待办共用)

    线条语义:
      - 实线蓝(冷色) = 主数据流(用户问题 → 助手 → 模块 → 能力源)
      - 虚线橙(暖色) = 跨模块引用 / 反馈回流(察元办公 → 文档 / 智库,训练中心 → 智库 / 模型广场,
        智能空间 / 我的待办 → 应用库)
  -->
  <section class="kb-empty-topology">
    <header class="kb-empty-topology-head">
      <div class="kb-empty-topology-title">
        <h3>知识库连接</h3>
        <p class="kb-empty-topology-sub">还没配置任何连接。点击右上角「新建连接」开始 — 拓扑图展示察元如何把多类能力串成统一路径。</p>
        <!-- 特色徽章:让用户一眼看见察元的差异化定位 -->
        <div class="kb-empty-topology-badges">
          <span class="kb-empty-badge kb-empty-badge-blue">WPS 原生加载项</span>
          <span class="kb-empty-badge kb-empty-badge-violet">统一智库</span>
          <span class="kb-empty-badge kb-empty-badge-emerald">反馈闭环 / 微调</span>
          <span class="kb-empty-badge kb-empty-badge-amber">国产化 / 信创就绪</span>
          <span class="kb-empty-badge kb-empty-badge-slate">开源核心 BSL</span>
        </div>
      </div>
      <button class="btn-primary kb-empty-topology-new" @click="$emit('create')">＋ 新建连接</button>
    </header>

    <!-- 能力支持清单:展示察元接通的全部模型 / 多模态能力,
         让客户一眼看到"模型广场"不是空名头,而是真的接通了对话、ASR、TTS、OCR、T2I、T2V 等。 -->
    <div class="kb-empty-capabilities" aria-label="支持的模型与多模态能力">
      <span class="kb-empty-cap-group-label">模型 · 多模态能力</span>
      <span class="kb-empty-cap-pill" title="LLM 对话:GPT / Claude / 通义 / 文心 / DeepSeek 等">💬 LLM 对话</span>
      <span class="kb-empty-cap-pill" title="嵌入 + 重排序:bge / m3e / cohere-rerank 等">🧠 嵌入 / 重排</span>
      <span class="kb-empty-cap-pill" title="语音模型:ASR 语音转文字">🎙️ 语音→文字 (ASR)</span>
      <span class="kb-empty-cap-pill" title="语音合成:TTS 文字转语音">🔊 文字→语音 (TTS)</span>
      <span class="kb-empty-cap-pill" title="视觉语言:OCR 文字识别 / VLM 图像理解">👁️ 图像→文字 (OCR / VLM)</span>
      <span class="kb-empty-cap-pill" title="生图:Text-to-Image / SDXL 等">🎨 文字→图像</span>
      <span class="kb-empty-cap-pill" title="生视频:Text-to-Video">🎬 文字→视频</span>
      <span class="kb-empty-cap-pill kb-empty-cap-pill-em" title="本地化部署:Ollama / vLLM / TGI">🖥️ 离线模型</span>
      <span class="kb-empty-cap-pill kb-empty-cap-pill-em" title="云上 API:DeepSeek / 阿里百炼 / 火山方舟 / 智谱 / 字节豆包">☁️ 云厂商模型</span>
      <span class="kb-empty-cap-pill" title="同时接入多模型,自动路由 / 故障切换 / 用户级配额">🔁 多模型路由</span>
    </div>

    <div class="kb-empty-topology-canvas">
      <!-- 公众号二维码:右下角浮卡。
           qrCodeSrc 通过 prop 透传(默认指向 chayuan/public/wechat-qrcode.png);
           如果项目没放图,会自动 fallback 到 SVG 占位图案,不会显示破图。 -->
      <aside class="kb-empty-qrcode" :title="'扫码关注察元公众号 — 同一个码也是支持我们的入口'">
        <div class="kb-empty-qrcode-image">
          <img
            v-if="qrLoaded"
            :src="qrCodeSrc"
            alt="察元公众号二维码"
            @error="onQrError"
          />
          <!-- placeholder:用 SVG 画一个仿真 QR pattern,等用户放真实图后会被覆盖 -->
          <svg v-else viewBox="0 0 84 84" class="kb-empty-qrcode-fake">
            <rect width="84" height="84" fill="#fff" />
            <!-- 三个定位角(top-left / top-right / bottom-left) -->
            <g fill="#1f2a44">
              <rect x="6"  y="6"  width="20" height="20" />
              <rect x="58" y="6"  width="20" height="20" />
              <rect x="6"  y="58" width="20" height="20" />
            </g>
            <g fill="#fff">
              <rect x="10" y="10" width="12" height="12" />
              <rect x="62" y="10" width="12" height="12" />
              <rect x="10" y="62" width="12" height="12" />
            </g>
            <g fill="#1f2a44">
              <rect x="13" y="13" width="6" height="6" />
              <rect x="65" y="13" width="6" height="6" />
              <rect x="13" y="65" width="6" height="6" />
            </g>
            <!-- 数据区(伪随机块,装饰用) -->
            <g fill="#1f2a44">
              <rect x="32" y="6"  width="4" height="4" /><rect x="40" y="6"  width="4" height="4" />
              <rect x="48" y="6"  width="4" height="4" /><rect x="32" y="14" width="4" height="4" />
              <rect x="44" y="14" width="4" height="4" /><rect x="32" y="22" width="4" height="4" />
              <rect x="40" y="22" width="4" height="4" /><rect x="48" y="22" width="4" height="4" />
              <rect x="6"  y="32" width="4" height="4" /><rect x="14" y="32" width="4" height="4" />
              <rect x="22" y="32" width="4" height="4" /><rect x="36" y="32" width="4" height="4" />
              <rect x="48" y="32" width="4" height="4" /><rect x="60" y="32" width="4" height="4" />
              <rect x="68" y="32" width="4" height="4" /><rect x="76" y="32" width="4" height="4" />
              <rect x="14" y="40" width="4" height="4" /><rect x="26" y="40" width="4" height="4" />
              <rect x="36" y="40" width="4" height="4" /><rect x="44" y="40" width="4" height="4" />
              <rect x="52" y="40" width="4" height="4" /><rect x="64" y="40" width="4" height="4" />
              <rect x="76" y="40" width="4" height="4" /><rect x="6"  y="48" width="4" height="4" />
              <rect x="22" y="48" width="4" height="4" /><rect x="38" y="48" width="4" height="4" />
              <rect x="46" y="48" width="4" height="4" /><rect x="58" y="48" width="4" height="4" />
              <rect x="70" y="48" width="4" height="4" /><rect x="32" y="58" width="4" height="4" />
              <rect x="40" y="58" width="4" height="4" /><rect x="52" y="58" width="4" height="4" />
              <rect x="60" y="58" width="4" height="4" /><rect x="72" y="58" width="4" height="4" />
              <rect x="36" y="68" width="4" height="4" /><rect x="44" y="68" width="4" height="4" />
              <rect x="56" y="68" width="4" height="4" /><rect x="64" y="68" width="4" height="4" />
              <rect x="76" y="68" width="4" height="4" /><rect x="32" y="76" width="4" height="4" />
              <rect x="48" y="76" width="4" height="4" /><rect x="56" y="76" width="4" height="4" />
              <rect x="68" y="76" width="4" height="4" />
            </g>
          </svg>
        </div>
        <div class="kb-empty-qrcode-cap">
          <strong>关注我们 · 支持我们</strong>
          <span>同一二维码 · 进察元公众号</span>
        </div>
      </aside>

      <svg
        class="kb-topo-svg"
        viewBox="0 0 1280 780"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="察元全链路拓扑"
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

        <!-- ────────────── 主流(蓝色实线) ────────────── -->
        <g class="kb-topo-flows-cool" fill="none" stroke="url(#kbFlowGrad)" stroke-width="2.4" stroke-linecap="round">
          <!-- S0 → S1 -->
          <path d="M 180 400 L 320 400" />

          <!-- S1 → 7 个 Stage 2 模块 -->
          <path d="M 490 395 C 555 395 555 52  620 52"  /> <!-- → 察元智库 -->
          <path d="M 490 395 C 555 395 555 145 620 145" /> <!-- → 察元办公 -->
          <path d="M 490 395 C 555 395 555 235 620 235" /> <!-- → 模型广场 -->
          <path d="M 490 395 C 555 395 555 325 620 325" /> <!-- → 智能空间 -->
          <path d="M 490 395 C 555 395 555 415 620 415" /> <!-- → 应用市场 -->
          <path d="M 490 395 C 555 395 555 505 620 505" /> <!-- → 训练数据中心 -->
          <path d="M 490 395 C 555 395 555 595 620 595" /> <!-- → 我的待办 -->

          <!-- 察元智库 → 6 类知识源 -->
          <path d="M 810 52 C 875 52 875 25  940 25" />
          <path d="M 810 52 C 875 52 875 65  940 65" />
          <path d="M 810 52 C 875 52 875 105 940 105" />
          <path d="M 810 52 C 875 52 875 145 940 145" />
          <path d="M 810 52 C 875 52 875 185 940 185" />
          <path d="M 810 52 C 875 52 875 225 940 225" />

          <!-- 模型广场 → 2 类模型源 -->
          <path d="M 810 235 C 875 235 875 282 940 282" /> <!-- → 离线模型 -->
          <path d="M 810 235 C 875 235 875 322 940 322" /> <!-- → 云厂商模型 -->

          <!-- 应用市场 → 应用库 -->
          <path d="M 810 415 C 875 415 875 432 940 432" />
        </g>

        <!-- ────────────── 跨模块引用 / 反馈(橙色虚线) ────────────── -->
        <g class="kb-topo-flows-warm" fill="none" stroke="url(#kbFlowGradWarm)" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="5 7">
          <!-- 察元办公 → 文档(共用 Office 文档源) -->
          <path d="M 810 145 C 870 145 870 25  940 25" />
          <!-- 察元办公 → 察元智库(把办公文档纳入智库统一查询;走右侧 U 形) -->
          <path d="M 810 165 C 880 165 880 70  810 70" />

          <!-- 训练数据中心 → 模型广场(微调反馈,走左侧) -->
          <path d="M 620 505 C 580 505 580 235 620 235" />
          <!-- 训练数据中心 → 察元智库(标注样本反哺到智库;走左侧长 U) -->
          <path d="M 620 525 C 540 525 540 70  620 70" />

          <!-- 智能空间 → 应用库(智能空间编排应用) -->
          <path d="M 810 345 C 880 345 880 432 940 432" />
          <!-- 我的待办 → 应用库(待办事件触发应用) -->
          <path d="M 810 575 C 880 575 880 432 940 432" />
        </g>

        <!-- ────────────── 节点层 ────────────── -->
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

        <!-- Stage 2.1:察元智库 -->
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
          <text x="715" y="161" text-anchor="middle" class="kb-node-sub">Office · Word / Excel / PPT</text>
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
          <text x="715" y="341" text-anchor="middle" class="kb-node-sub">工作流 · Notebook · 应用编排</text>
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
          <text x="715" y="611" text-anchor="middle" class="kb-node-sub">任务清单 · 提醒 · 触发应用</text>
        </g>

        <!-- ────────────── Stage 3 ────────────── -->
        <!-- 智库 owns(6 KB types) -->
        <g filter="url(#kbNodeShadow)">
          <rect x="940" y="8"   width="150" height="34" rx="9" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.3" />
          <text x="1015" y="30" text-anchor="middle" class="kb-node-title-sm">📄 文档 · Word/PDF/MD</text>
        </g>
        <g filter="url(#kbNodeShadow)">
          <rect x="940" y="48"  width="150" height="34" rx="9" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.3" />
          <text x="1015" y="70" text-anchor="middle" class="kb-node-title-sm">🗄️ 结构化 · MySQL/Oracle</text>
        </g>
        <g filter="url(#kbNodeShadow)">
          <rect x="940" y="88"  width="150" height="34" rx="9" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.3" />
          <text x="1015" y="110" text-anchor="middle" class="kb-node-title-sm">🔎 搜索引擎 · ES</text>
        </g>
        <g filter="url(#kbNodeShadow)">
          <rect x="940" y="128" width="150" height="34" rx="9" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.3" />
          <text x="1015" y="150" text-anchor="middle" class="kb-node-title-sm">🍃 半结构化 · MongoDB</text>
        </g>
        <g filter="url(#kbNodeShadow)">
          <rect x="940" y="168" width="150" height="34" rx="9" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.3" />
          <text x="1015" y="190" text-anchor="middle" class="kb-node-title-sm">🧬 向量 · Milvus</text>
        </g>
        <g filter="url(#kbNodeShadow)">
          <rect x="940" y="208" width="150" height="34" rx="9" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.3" />
          <text x="1015" y="230" text-anchor="middle" class="kb-node-title-sm">🖼️ 图像 · JPG/PNG</text>
        </g>

        <!-- 模型广场 owns(2 模型源) -->
        <g filter="url(#kbNodeShadow)">
          <rect x="940" y="265" width="150" height="34" rx="9" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.3" />
          <text x="1015" y="287" text-anchor="middle" class="kb-node-title-sm">🖥️ 离线模型 · Ollama/vLLM</text>
        </g>
        <g filter="url(#kbNodeShadow)">
          <rect x="940" y="305" width="150" height="34" rx="9" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.3" />
          <text x="1015" y="327" text-anchor="middle" class="kb-node-title-sm">☁️ 云厂商 · DeepSeek/百炼</text>
        </g>

        <!-- 应用市场 owns,智能空间 / 我的待办 共用 — 加大尺寸标识 hub -->
        <g filter="url(#kbNodeShadow)">
          <rect x="940" y="395" width="150" height="74" rx="13" fill="url(#kbHubFill)" stroke="url(#kbNodeStroke)" stroke-width="1.6" />
          <text x="1015" y="421" text-anchor="middle" class="kb-node-title-sm kb-node-title-strong-sm">📦 应用库</text>
          <text x="1015" y="441" text-anchor="middle" class="kb-node-sub-sm">业务应用集合</text>
          <text x="1015" y="458" text-anchor="middle" class="kb-node-sub-sm kb-node-sub-faint">市场 / 空间 / 待办 共用</text>
        </g>

        <!-- 标签:微调反馈(暖色虚线对应) -->
        <text x="558" y="370" text-anchor="end" class="kb-flow-label">微调反馈</text>
      </svg>
    </div>

    <!-- 醒目广告语:流式逐字打出,模拟 LLM 输出,带闪烁光标 -->
    <div class="kb-empty-tagline" role="banner">
      <h2 class="kb-empty-tagline-main">
        <span class="kb-empty-tagline-text">{{ taglineMainShown }}</span>
        <span
          v-if="!taglineMainDone || !taglineSubDone"
          class="kb-empty-tagline-cursor"
          :class="{ 'on-main': !taglineMainDone, 'on-sub': taglineMainDone }"
          aria-hidden="true"
        />
      </h2>
      <p class="kb-empty-tagline-sub" v-show="taglineMainDone">
        {{ taglineSubShown }}
      </p>
    </div>

    <footer class="kb-empty-topology-foot">
      <span class="kb-empty-topology-tip">
        <span class="kb-empty-dot" />
        <strong>蓝色实线</strong>:用户问题 → 助手编排 → 模块 → 具体能力源(知识源 / 模型源 / 应用源)
        <span class="kb-empty-dot kb-empty-dot-warm" />
        <strong>橙色虚线</strong>:跨模块引用 / 反馈回流(办公↔智库,训练↔智库/模型,空间/待办→应用库)
      </span>
    </footer>
  </section>
</template>

<script>
// 广告语原文 — 流式打字机驱动逐字渲染 taglineMainShown / taglineSubShown
const TAGLINE_MAIN = '现代化 AI 办公平台'
const TAGLINE_SUB  = 'WPS 原生 · 文档 + 数据 + 模型 + 应用,一以贯之 · 从一句问询,到完整产出'
const TYPE_INTERVAL_MAIN_MS = 90  // 主标节奏(慢一点,有仪式感)
const TYPE_INTERVAL_SUB_MS  = 35  // 副标节奏(快一点,顺着阅读流)
const TAGLINE_PAUSE_BETWEEN_MS = 280  // 主标完→副标开始 之间的小停顿

export default {
  name: 'KbEmptyTopology',
  emits: ['create'],
  props: {
    // 公众号二维码图片 src;调用方可传任意可访问 URL。
    // 默认指向项目 public/ 下的 wechat-qrcode.png — 把图片放到那里即可显示。
    // 图片加载失败时自动 fallback 到 SVG 占位图案,不会显示破图。
    qrCodeSrc: {
      type: String,
      default: '/wechat-qrcode.png',
    },
  },
  data() {
    return {
      qrLoaded: true,        // @error 触发后置 false 走 SVG 占位
      taglineMainShown: '',
      taglineSubShown: '',
      taglineMainDone: false,
      taglineSubDone: false,
    }
  },
  mounted() {
    this._typeTimers = []
    // 检测 prefers-reduced-motion,直接定稿不打字
    const reduce = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      this.taglineMainShown = TAGLINE_MAIN
      this.taglineSubShown = TAGLINE_SUB
      this.taglineMainDone = true
      this.taglineSubDone = true
      return
    }
    this.startTypingMain()
  },
  beforeUnmount() {
    if (Array.isArray(this._typeTimers)) {
      this._typeTimers.forEach(t => clearTimeout(t))
      this._typeTimers = []
    }
  },
  methods: {
    onQrError() {
      this.qrLoaded = false
    },
    startTypingMain() {
      let i = 0
      const tick = () => {
        if (i >= TAGLINE_MAIN.length) {
          this.taglineMainDone = true
          // 主标打完,延迟一拍再打副标
          const t = setTimeout(() => this.startTypingSub(), TAGLINE_PAUSE_BETWEEN_MS)
          this._typeTimers.push(t)
          return
        }
        // Array.from 处理 emoji / 多字节字符;TAGLINE_MAIN 全是 BMP 字符也安全
        this.taglineMainShown = Array.from(TAGLINE_MAIN).slice(0, i + 1).join('')
        i += 1
        const t = setTimeout(tick, TYPE_INTERVAL_MAIN_MS)
        this._typeTimers.push(t)
      }
      tick()
    },
    startTypingSub() {
      let i = 0
      const chars = Array.from(TAGLINE_SUB)
      const tick = () => {
        if (i >= chars.length) {
          this.taglineSubDone = true
          return
        }
        this.taglineSubShown = chars.slice(0, i + 1).join('')
        i += 1
        const t = setTimeout(tick, TYPE_INTERVAL_SUB_MS)
        this._typeTimers.push(t)
      }
      tick()
    },
  },
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

/* 特色徽章 */
.kb-empty-topology-badges {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.kb-empty-badge {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid;
  font-weight: 500;
  letter-spacing: 0.01em;
}
.kb-empty-badge-blue    { background: #eef3ff; border-color: #b7c8f3; color: #2a4cb4; }
.kb-empty-badge-violet  { background: #f3eefb; border-color: #c8b7e8; color: #6635b6; }
.kb-empty-badge-emerald { background: #e8f7ee; border-color: #a5d8b9; color: #1f7a45; }
.kb-empty-badge-amber   { background: #fdf3e6; border-color: #e8c486; color: #8a5a18; }
.kb-empty-badge-slate   { background: #eef1f6; border-color: #c5cdda; color: #475569; }

/* 能力支持清单 */
.kb-empty-capabilities {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  padding: 10px 18px;
  border-bottom: 1px solid #eef2f8;
  background: linear-gradient(180deg, rgba(247, 250, 255, 0.5), transparent);
}
.kb-empty-cap-group-label {
  font-size: 11.5px;
  font-weight: 600;
  color: #4a5878;
  margin-right: 4px;
}
.kb-empty-cap-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 999px;
  background: #ffffff;
  border: 1px solid #d8e0ec;
  color: #1f2a44;
  white-space: nowrap;
  cursor: default;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}
.kb-empty-cap-pill:hover {
  border-color: #6ea8ff;
  box-shadow: 0 2px 6px rgba(110, 168, 255, 0.18);
  transform: translateY(-1px);
}
.kb-empty-cap-pill-em {
  background: linear-gradient(135deg, #e7efff 0%, #f5e9ff 100%);
  border-color: #b9c8ff;
  color: #2a4cb4;
  font-weight: 600;
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
  max-width: 1300px;
  max-height: 100%;
}

/* 流光:在 stroke-dasharray 上滚 stroke-dashoffset */
.kb-topo-flows-cool path {
  stroke-dasharray: 8 14;
  animation: kbFlow 1.6s linear infinite;
  filter: drop-shadow(0 0 4px rgba(110, 168, 255, 0.45));
}
.kb-topo-flows-cool path:nth-child(1)  { animation-delay: 0s; }
.kb-topo-flows-cool path:nth-child(2)  { animation-delay: 0.10s; }
.kb-topo-flows-cool path:nth-child(3)  { animation-delay: 0.20s; }
.kb-topo-flows-cool path:nth-child(4)  { animation-delay: 0.30s; }
.kb-topo-flows-cool path:nth-child(5)  { animation-delay: 0.40s; }
.kb-topo-flows-cool path:nth-child(6)  { animation-delay: 0.50s; }
.kb-topo-flows-cool path:nth-child(7)  { animation-delay: 0.60s; }
.kb-topo-flows-cool path:nth-child(8)  { animation-delay: 0.70s; }
.kb-topo-flows-cool path:nth-child(9)  { animation-delay: 0.05s; }
.kb-topo-flows-cool path:nth-child(10) { animation-delay: 0.20s; }
.kb-topo-flows-cool path:nth-child(11) { animation-delay: 0.35s; }
.kb-topo-flows-cool path:nth-child(12) { animation-delay: 0.50s; }
.kb-topo-flows-cool path:nth-child(13) { animation-delay: 0.65s; }
.kb-topo-flows-cool path:nth-child(14) { animation-delay: 0.80s; }
.kb-topo-flows-cool path:nth-child(15) { animation-delay: 0.10s; }
.kb-topo-flows-cool path:nth-child(16) { animation-delay: 0.30s; }
.kb-topo-flows-cool path:nth-child(17) { animation-delay: 0.20s; }

.kb-topo-flows-warm path {
  animation: kbFlowWarm 2.2s linear infinite;
  filter: drop-shadow(0 0 3px rgba(255, 178, 122, 0.55));
}
.kb-topo-flows-warm path:nth-child(odd)  { animation-delay: 0s; }
.kb-topo-flows-warm path:nth-child(even) { animation-delay: 0.4s; }

@keyframes kbFlow      { to { stroke-dashoffset: -22; } }
@keyframes kbFlowWarm  { to { stroke-dashoffset: -24; } }

/* 节点文字 */
.kb-topo-svg text { font-family: inherit; pointer-events: none; }
.kb-node-title              { font-size: 13.5px; font-weight: 600; fill: #1f2a44; }
.kb-node-title-strong       { font-size: 14.5px; }
.kb-node-title-sm           { font-size: 11.5px; font-weight: 600; fill: #1f2a44; }
.kb-node-title-strong-sm    { font-size: 12.5px; }
.kb-node-sub                { font-size: 10.5px; fill: #6b7891; }
.kb-node-sub-sm             { font-size: 10px;   fill: #6b7891; }
.kb-node-sub-faint          { fill: #97a2bd; }
.kb-flow-label              { font-size: 10.5px; fill: #c97b4a; font-weight: 500; }

/* 醒目广告语 — 流式打字机 */
.kb-empty-tagline {
  flex-shrink: 0;
  text-align: center;
  padding: 14px 18px 6px;
  /* 预留副标行高,避免打字过程中布局上下抖动 */
  min-height: 70px;
}
.kb-empty-tagline-main {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0.04em;
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
}
.kb-empty-tagline-text {
  background: linear-gradient(90deg, #2a6ddf 0%, #6635b6 50%, #c97b4a 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  animation: kbTaglineSheen 6s ease-in-out infinite;
  background-size: 200% 100%;
}
.kb-empty-tagline-sub {
  margin: 4px 0 0;
  font-size: 12.5px;
  letter-spacing: 0.04em;
  color: #6b7891;
}
/* 打字机闪烁光标 — 主标和副标共用,通过 .on-main/.on-sub 切换尺寸 */
.kb-empty-tagline-cursor {
  display: inline-block;
  width: 2px;
  background: #6635b6;
  vertical-align: -3px;
  margin-left: 4px;
  animation: kbCursorBlink 0.85s steps(1, end) infinite;
  border-radius: 1px;
}
.kb-empty-tagline-cursor.on-main { height: 26px; }
.kb-empty-tagline-cursor.on-sub  { height: 14px; background: #6b7891; vertical-align: -1px; }

@keyframes kbTaglineSheen {
  0%, 100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}
@keyframes kbCursorBlink {
  0%, 50%   { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* 公众号二维码:固定在 canvas 右下角 */
.kb-empty-qrcode {
  position: absolute;
  right: 16px;
  bottom: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 10px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #d8e0ec;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
  z-index: 5;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.kb-empty-qrcode:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
}
.kb-empty-qrcode-image {
  width: 96px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 6px;
  overflow: hidden;
}
.kb-empty-qrcode-image img,
.kb-empty-qrcode-fake {
  width: 100%;
  height: 100%;
  display: block;
}
.kb-empty-qrcode-cap {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 11px;
  line-height: 1.4;
  color: #475569;
}
.kb-empty-qrcode-cap strong {
  font-size: 12px;
  color: #1f2a44;
  font-weight: 600;
}
.kb-empty-qrcode-cap span { color: #94a3b8; font-size: 10px; }

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
  gap: 6px;
  font-size: 12px;
  color: #6b7891;
  max-width: 100%;
}
.kb-empty-topology-tip strong { color: #4a5878; font-weight: 600; }

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
  margin-left: 6px;
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
