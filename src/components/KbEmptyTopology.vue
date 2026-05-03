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
        <g filter="url(#kbNodeShadow)" class="kb-topo-clickable" @click="showModule('zhiku')" tabindex="0" role="button" aria-label="察元智库 — 查看介绍">
          <rect x="620" y="15" width="190" height="75" rx="16" fill="url(#kbHubFill)" stroke="url(#kbNodeStroke)" stroke-width="2" />
          <text x="715" y="42" text-anchor="middle" class="kb-node-title kb-node-title-strong">📚 察元智库</text>
          <text x="715" y="60" text-anchor="middle" class="kb-node-sub">Knowledge Universe</text>
          <text x="715" y="78" text-anchor="middle" class="kb-node-sub kb-node-sub-faint">点击查看 · 统一查询 / 权限 / 引用</text>
        </g>

        <!-- Stage 2.2:察元办公 -->
        <g filter="url(#kbNodeShadow)" class="kb-topo-clickable" @click="showModule('bangong')" tabindex="0" role="button" aria-label="察元办公 — 查看介绍">
          <rect x="620" y="115" width="190" height="60" rx="14" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.5" />
          <text x="715" y="140" text-anchor="middle" class="kb-node-title">📝 察元办公</text>
          <text x="715" y="161" text-anchor="middle" class="kb-node-sub">点击查看 · 在线编辑 / 智能改写 / 脱密</text>
        </g>

        <!-- Stage 2.3:模型广场 -->
        <g filter="url(#kbNodeShadow)" class="kb-topo-clickable" @click="showModule('moxing')" tabindex="0" role="button" aria-label="模型广场 — 查看介绍">
          <rect x="620" y="205" width="190" height="60" rx="14" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.5" />
          <text x="715" y="230" text-anchor="middle" class="kb-node-title">🤖 模型广场</text>
          <text x="715" y="251" text-anchor="middle" class="kb-node-sub">点击查看 · 多模型 / 多模态 / 路由</text>
        </g>

        <!-- Stage 2.4:智能空间 -->
        <g filter="url(#kbNodeShadow)" class="kb-topo-clickable" @click="showModule('kongjian')" tabindex="0" role="button" aria-label="智能空间 — 查看介绍">
          <rect x="620" y="295" width="190" height="60" rx="14" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.5" />
          <text x="715" y="320" text-anchor="middle" class="kb-node-title">🧩 智能空间</text>
          <text x="715" y="341" text-anchor="middle" class="kb-node-sub">点击查看 · 工作流 / Notebook / 编排</text>
        </g>

        <!-- Stage 2.5:应用市场 -->
        <g filter="url(#kbNodeShadow)" class="kb-topo-clickable" @click="showModule('shichang')" tabindex="0" role="button" aria-label="应用市场 — 查看介绍">
          <rect x="620" y="385" width="190" height="60" rx="14" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.5" />
          <text x="715" y="410" text-anchor="middle" class="kb-node-title">📦 应用市场</text>
          <text x="715" y="431" text-anchor="middle" class="kb-node-sub">点击查看 · 业务应用 / 插件 / 私有库</text>
        </g>

        <!-- Stage 2.6:训练数据中心 -->
        <g filter="url(#kbNodeShadow)" class="kb-topo-clickable" @click="showModule('xunlian')" tabindex="0" role="button" aria-label="训练数据中心 — 查看介绍">
          <rect x="620" y="475" width="190" height="60" rx="14" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.5" />
          <text x="715" y="500" text-anchor="middle" class="kb-node-title">🎯 训练数据中心</text>
          <text x="715" y="521" text-anchor="middle" class="kb-node-sub">点击查看 · 标注 / 微调 / 反馈闭环</text>
        </g>

        <!-- Stage 2.7:我的待办 -->
        <g filter="url(#kbNodeShadow)" class="kb-topo-clickable" @click="showModule('daiban')" tabindex="0" role="button" aria-label="我的待办 — 查看介绍">
          <rect x="620" y="565" width="190" height="60" rx="14" fill="url(#kbNodeFill)" stroke="url(#kbNodeStroke)" stroke-width="1.5" />
          <text x="715" y="590" text-anchor="middle" class="kb-node-title">✅ 我的待办</text>
          <text x="715" y="611" text-anchor="middle" class="kb-node-sub">点击查看 · 任务清单 / 提醒 / 触发应用</text>
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
        点击拓扑中的任意 <strong>模块节点</strong> 查看它解决什么痛点、有哪些能力、可接入哪些数据源
      </span>
    </footer>

    <!-- 模块介绍弹窗:点击 Stage 2 节点后展示 -->
    <transition name="kb-modal">
      <div
        v-if="activeModuleData"
        class="kb-empty-modal-overlay"
        @click.self="closeModule"
        role="dialog"
        aria-modal="true"
      >
        <div class="kb-empty-modal" @click.stop>
          <header class="kb-empty-modal-head">
            <span class="kb-empty-modal-icon">{{ activeModuleData.icon }}</span>
            <div class="kb-empty-modal-title">
              <h3>{{ activeModuleData.name }}</h3>
              <p>{{ activeModuleData.tagline }}</p>
            </div>
            <button
              type="button"
              class="kb-empty-modal-close"
              @click="closeModule"
              aria-label="关闭"
            >×</button>
          </header>

          <section class="kb-empty-modal-section">
            <h4><span class="kb-empty-modal-pin">🎯</span>切入痛点</h4>
            <ul class="kb-empty-modal-list kb-empty-modal-list-pain">
              <li v-for="p in activeModuleData.painPoints" :key="p">{{ p }}</li>
            </ul>
          </section>

          <section class="kb-empty-modal-section">
            <h4><span class="kb-empty-modal-pin">🔧</span>核心能力</h4>
            <ul class="kb-empty-modal-list kb-empty-modal-list-feat">
              <li v-for="f in activeModuleData.features" :key="f">{{ f }}</li>
            </ul>
          </section>

          <section class="kb-empty-modal-section">
            <h4><span class="kb-empty-modal-pin">🔌</span>可接入</h4>
            <p class="kb-empty-modal-line">{{ activeModuleData.dataSources }}</p>
          </section>

          <section class="kb-empty-modal-section kb-empty-modal-solves">
            <h4><span class="kb-empty-modal-pin">✨</span>解决什么问题</h4>
            <p class="kb-empty-modal-line">{{ activeModuleData.solves }}</p>
          </section>
        </div>
      </div>
    </transition>
  </section>
</template>

<script>
// 广告语候选池 — 每次 mount 随机挑一对(主标 + 副标)。
// 全部基于察元的真实能力面:Agent 编排 / 统一智库 / 多模态 / 反馈闭环 / 模型自由。
// 不出现 WPS 字样,保持中立的 "现代化 AI 办公平台" 定位。
const TAGLINE_VARIANTS = [
  {
    main: '现代化 AI 办公平台',
    sub:  'Agent 编排 · 多模态接入 · 闭环进化',
  },
  {
    main: '新一代企业知识中枢',
    sub:  '文档 · 数据 · 模型 · 应用,一以贯之 · 从一句问询到完整产出',
  },
  {
    main: '让每一份资料都拥有大脑',
    sub:  '多源知识统一查询 · 多模态能力一站接入 · 反馈闭环越用越好用',
  },
  {
    main: '知识统一 · 模型自由 · 反馈进化',
    sub:  '搜索 → 思考 → 行动 · 一个入口,完成办公全流程',
  },
  {
    main: '懂数据,会写文档的 AI 助手',
    sub:  '结构化 / 向量 / 图像 / 文档,一个智库就够了',
  },
  {
    main: '面向办公场景的 AI 中枢',
    sub:  'Agent 编排 · 知识统一 · 模型自由 · 应用闭环',
  },
  {
    main: '从问答到产出的 AI 平台',
    sub:  '意图识别 · 多源检索 · 任务编排 · 引用回链',
  },
  {
    main: '把 AI 真正接到企业的每一份资料上',
    sub:  '不止检索,还能行动 · 不止回答,还能产出',
  },
]

const TYPE_INTERVAL_MAIN_MS = 90  // 主标节奏(慢一点,有仪式感)
const TYPE_INTERVAL_SUB_MS  = 35  // 副标节奏(快一点,顺着阅读流)
const TAGLINE_PAUSE_BETWEEN_MS = 280  // 主标完→副标开始 之间的小停顿

// ─────────────────────────────────────────────────────────────
// 模块介绍知识库 — 拓扑图中每个 Stage 2 节点点击后弹窗展示
// 文案围绕真实业务痛点 → 能力 → 数据接入 → 解决问题 四档结构
// ─────────────────────────────────────────────────────────────
const MODULES = {
  zhiku: {
    icon: '📚',
    name: '察元智库',
    tagline: 'Knowledge Universe · 把企业散落的知识汇成一个入口',
    painPoints: [
      '企业资料散落在文档库、业务库、ES、向量库、图片里,业务问个问题要切多个系统',
      'IT 部门对接每个数据源都要单独开发权限和接口,维护成本高',
      'AI 给的答案没引用、没溯源,业务用了不敢相信,出错没人背锅',
      '新增一份文件 / 一张表,要跑一堆同步脚本才能"被搜到"',
    ],
    features: [
      '一个 API 接通六类源:文档 / 结构化 / 搜索 / 半结构化 / 向量 / 图像',
      '智能路由:关键词找 ES,聚合走 SQL,语义走向量 + 文档,自动选最优',
      '统一权限:用户 / 角色 / 公开 / 私有 一套规则覆盖所有源',
      '引用回链:每条答案带 [N] 标号,可一键跳回原文 / 原表 / 原图',
      '增量索引:文件入库自动分块、向量化、上线,无需手工刷新',
      '诊断面板:每次检索回包包含 路由 / 召回 / 重排 / 耗时 全程 trace',
    ],
    dataSources: 'Word/PDF/MD/HTML 文档 · MySQL/Oracle/PostgreSQL/达梦 · ElasticSearch · MongoDB · Milvus/向量库 · JPG/PNG 图像',
    solves: '让"问一句拿一答"真正跨越数据孤岛;让 IT 团队从 N 套对接 → 1 套对接;让答案可信、可溯源、可审计。',
  },
  bangong: {
    icon: '📝',
    name: '察元办公',
    tagline: 'Office · 让 AI 真正贴着文档工作',
    painPoints: [
      '写报告 / 标书 / 合同 / 周报靠手工查资料 + 反复改稿,效率低',
      '改一处怕影响别处,全文校对靠人眼,错别字/格式错误难以根治',
      '敏感信息(身份证、合同金额、客户名)泄露风险高,人工脱敏漏检多',
      '术语不统一(同一概念多种说法)、章节编号乱、图表说明缺失',
    ],
    features: [
      '在线编辑 + 多人协作,光标实时同步、版本历史、断点续写',
      '智能改写 / 润色 / 扩写 / 缩写 / 翻译 / 摘要,选段一键完成',
      '自动批注:错别字、语病、歧义、描述不准、术语不统一,挨个标出来',
      '一键脱密:身份证 / 手机号 / 金额 / 客户名 等敏感实体识别 + 占位符替换 + 可逆复原',
      '写作时自动触发智库检索,把相关条款 / 数据 / 历史报告嵌入正文',
      '格式批量处理:章节编号、表格规范、图片说明、目录、参考文献',
    ],
    dataSources: 'Word(.docx)· Excel(.xlsx)· PowerPoint(.pptx)· PDF · Markdown · 富文本',
    solves: '把"查 + 写 + 改 + 审"四件事压成一件事,报告类高频场景提速 5-10 倍;减少格式错误和敏感信息漏检;让团队术语和模板真正落地。',
  },
  moxing: {
    icon: '🤖',
    name: '模型广场',
    tagline: 'Model Marketplace · 模型自由 · 数据不出域',
    painPoints: [
      '不同业务需要不同模型:写文用 Claude,中文用 DeepSeek,代码用 Qwen-Coder,选型混乱',
      '敏感数据出企业网络风险大,合规部门不敢批',
      '云厂商时不时抽风,单点依赖一挂全公司停摆',
      'Token 成本不透明,谁用了多少花了多少没人说得清',
    ],
    features: [
      '一套 OpenAI 兼容协议接通任意模型:GPT / Claude / Gemini / DeepSeek / 通义 / 文心 / 智谱 / 豆包 ...',
      '本地推理引擎并存:Ollama · vLLM · TGI · 自部署模型,敏感任务强制走离线',
      '多模态全覆盖:LLM / 嵌入 / 重排 / ASR / TTS / OCR / VLM / Text-to-Image / Text-to-Video',
      '智能路由:按任务类型 / 成本 / 延迟 / 可用性 自动挑模型;一个挂了切下一个',
      '用户 / 部门级配额 + Token 监控 + 调用审计',
      '模型评测台:Golden Set 自动跑分,选型有数据撑腰',
    ],
    dataSources: '云厂商 API(OpenAI 兼容)· 本地引擎(Ollama / vLLM / TGI)· 自部署模型 · 闭源商业模型',
    solves: '让模型选型自由(不绑死一家);让敏感数据"想留就留"(强制走离线);让单点故障不再瘫痪业务;让算力账单可拆分到部门和个人。',
  },
  kongjian: {
    icon: '🧩',
    name: '智能空间',
    tagline: 'Smart Space · 把"反复做的事"沉淀成 Agent',
    painPoints: [
      '复杂业务要多步流程(查 → 分析 → 生成 → 发送),用户每次都重新写 Prompt',
      '业务人员不会写代码,做不了自定义 Agent;开发外包 → 反应慢 + 维护贵',
      '同事踩过的坑、调好的 Prompt 难分享,组织内每个人都从零开始',
      '同样的工作流跨季度反复做,每次重头来一遍',
    ],
    features: [
      '可视化工作流编排:拖拽节点、连接、条件分支、并发 / 串行,Notebook 风格',
      '内置 30+ 节点:KB 检索 · SQL 查询 · 文档读写 · API 调用 · 模型调用 · 文件批处理 · 邮件 · 飞书 / 企微',
      '模板库:财报分析 / 合同审核 / 周报生成 / 客服话术 / 招投标拆解 ... 开箱即用',
      '团队协作:工作流像代码一样有版本、有 review、可回滚',
      '一键发布:工作流变成应用,直接进应用市场让全公司用',
      'Notebook 模式:数据分析师能边跑边调,把分析流程沉淀给业务',
    ],
    dataSources: '可调用任意 chayuan 模块的能力(智库 / 模型 / 办公 / 应用市场 / 训练中心)+ 任意 HTTP API',
    solves: '把"老员工的隐性经验"显性化为可复用的 Agent;让业务自己能搭流程,不再排队等开发;让组织级生产力沉淀成可分发资产。',
  },
  shichang: {
    icon: '📦',
    name: '应用市场',
    tagline: 'App Market · AI 能做的事变成可发现的产品',
    painPoints: [
      '每个团队都有"写周报 / 做对比 / 生成 PPT / 写邮件"等同质需求,重复开发、重复维护',
      '成熟解决方案分散在某个员工电脑里,新人入职从零摸索',
      '采购的第三方 AI 应用接口不统一,集成难、运维贵',
      'AI 应用没评分、没文档,选型靠口口相传',
    ],
    features: [
      '官方应用 + 第三方 + 企业内私有应用,统一商店',
      '分类齐全:写作 / 数据分析 / 客服 / 财务 / 法务 / 营销 / HR / 运维',
      '一键安装、参数化配置、立即使用,无需 DevOps 介入',
      '评分 + 收藏 + 评论 + 使用统计,选型有真实口碑',
      '插件无处不在:可在 WPS 加载项内 / 对话框内 / 独立页 / 工作流节点 调用',
      '私有应用库:企业内部应用只对本企业可见,商业机密不外泄',
    ],
    dataSources: '工作流(来自智能空间)· Prompt 模板 · 外部 API · 智库检索 · 模型调用',
    solves: '让"造一次,全公司用"变成默认;让外采 AI 应用有统一入口和审计;让组织内的好实践不再靠人传人。',
  },
  xunlian: {
    icon: '🎯',
    name: '训练数据中心',
    tagline: 'Training Center · 让 AI 越用越准 · 反馈即资产',
    painPoints: [
      '通用 LLM 在企业垂直业务里准确率掉一半,但微调数据从哪来?',
      '人工标注成本高、质量参差;采集流程做了一半就废了',
      'AI 答对了没人记下,答错了没人纠正,白白浪费用户的反馈',
      '微调出新模型怎么平稳上线?旧模型怎么对比?评测靠拍脑袋',
    ],
    features: [
      '自动采样:用户的"赞 / 踩 / 批改 / 重写"操作,实时进入样本池',
      '标注台:支持 单选 / 多选 / 排序 / 重写 / 对比打分 / 多人交叉验证',
      '样本治理:自动去重、脏数据过滤、按领域分类、版本控制',
      '微调任务:LoRA / QLoRA / 全量 / DPO / RLHF,一键起跑、监控、回滚',
      '评测体系:Golden Set + Gate 测试 + 评分趋势 + 回归告警',
      '闭环上线:微调好的模型一键发布到模型广场,业务无感切换',
    ],
    dataSources: '用户操作日志(脱敏)· 人工标注 · 外部公开数据集 · 业务文档 / 对话历史',
    solves: '让企业的每一次反馈都变成训练资产;让模型从"通用 60 分"养到"业务 90 分";让微调成本可控、效果可量化、上线可回滚。',
  },
  daiban: {
    icon: '✅',
    name: '我的待办',
    tagline: 'My Tasks · 把 AI 建议变成 AI 执行',
    painPoints: [
      'AI 给了一堆"建议",但人还得手动去做,等于换个地方堆积事项',
      '复杂任务跨天 / 跨部门,容易丢失;状态、依赖、负责人混乱',
      'AI 任务、邮件提醒、Tasks 工具各一个池子,信息分散',
      '任务做完没复盘,经验沉淀不到组织里',
    ],
    features: [
      '从对话 / 文档 / 智库自动识别"待办":"明天 10 点前提交报告" → 自动建任务',
      '分组视图:我的 / 被分配给我 / 我分给别人 / 跟踪我创建的',
      '关联应用 / 工作流:点一下就启动对应 Agent,任务和能力打通',
      '智能提醒:到期、关键节点、依赖任务完成、上下游变化',
      '与日历 / 邮件 / 飞书 / 企微 双向同步,不再信息分散',
      '完成后自动归档为知识资产,反哺到智库供未来检索',
    ],
    dataSources: '对话历史 · 文档识别 · 应用执行结果 · 日历 / 邮件 / 协作工具',
    solves: '让 AI 不再只是"给建议",而是接到落地的执行链路上;让跨人/跨天/跨部门的任务不再丢;让每次完成的任务都成为下次的输入。',
  },
}

export default {
  name: 'KbEmptyTopology',
  emits: ['create'],
  props: {
    // 公众号二维码图片 src;调用方可传任意可访问 URL。
    // 默认指向项目 public/ 下的 wechat-qrcode.png — 把图片放到那里即可显示。
    // 图片加载失败时自动 fallback 到 SVG 占位图案,不会显示破图。
    qrCodeSrc: {
      type: String,
      default: '/images/pay/follow.png',
    },
  },
  data() {
    // 每次组件初始化随机挑一对 — 用户每次打开 KB 设置看到的广告语都不一样
    const pick = TAGLINE_VARIANTS[Math.floor(Math.random() * TAGLINE_VARIANTS.length)]
    return {
      qrLoaded: true,        // @error 触发后置 false 走 SVG 占位
      taglineMain: pick.main,
      taglineSub: pick.sub,
      taglineMainShown: '',
      taglineSubShown: '',
      taglineMainDone: false,
      taglineSubDone: false,
      activeModule: null,    // 当前打开介绍弹窗的模块 key(zhiku/bangong/...);null = 关闭
    }
  },
  computed: {
    activeModuleData() {
      return this.activeModule ? MODULES[this.activeModule] : null
    },
  },
  mounted() {
    this._typeTimers = []
    // 检测 prefers-reduced-motion,直接定稿不打字
    const reduce = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      this.taglineMainShown = this.taglineMain
      this.taglineSubShown = this.taglineSub
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
    showModule(key) {
      if (MODULES[key]) this.activeModule = key
    },
    closeModule() {
      this.activeModule = null
    },
    startTypingMain() {
      let i = 0
      const chars = Array.from(this.taglineMain)
      const tick = () => {
        if (i >= chars.length) {
          this.taglineMainDone = true
          const t = setTimeout(() => this.startTypingSub(), TAGLINE_PAUSE_BETWEEN_MS)
          this._typeTimers.push(t)
          return
        }
        this.taglineMainShown = chars.slice(0, i + 1).join('')
        i += 1
        const t = setTimeout(tick, TYPE_INTERVAL_MAIN_MS)
        this._typeTimers.push(t)
      }
      tick()
    },
    startTypingSub() {
      let i = 0
      const chars = Array.from(this.taglineSub)
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
  position: relative;
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
  overflow: hidden;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  /* 入场:从下淡入 — stagger 由下面 nth-child 给 delay */
  animation: kbPillIn 0.55s cubic-bezier(.2,.8,.2,1) backwards;
}
/* 鼠标悬停凸显 */
.kb-empty-cap-pill:hover {
  border-color: #6ea8ff;
  box-shadow: 0 2px 8px rgba(110, 168, 255, 0.28);
  transform: translateY(-2px);
  z-index: 1;
}
/* 持续流光:每个胶囊上有一道斜向亮带从左扫到右 */
.kb-empty-cap-pill::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(110deg,
    transparent 30%,
    rgba(110, 168, 255, 0.28) 48%,
    rgba(195, 140, 255, 0.22) 52%,
    transparent 70%);
  transform: translateX(-120%);
  animation: kbPillShimmer 9s linear infinite;
  pointer-events: none;
}
/* 入场 stagger + shimmer 错峰 — 每个胶囊不同节奏避免整齐划一 */
.kb-empty-cap-pill:nth-of-type(1)  { animation-delay: 0.05s; }
.kb-empty-cap-pill:nth-of-type(2)  { animation-delay: 0.13s; }
.kb-empty-cap-pill:nth-of-type(3)  { animation-delay: 0.21s; }
.kb-empty-cap-pill:nth-of-type(4)  { animation-delay: 0.29s; }
.kb-empty-cap-pill:nth-of-type(5)  { animation-delay: 0.37s; }
.kb-empty-cap-pill:nth-of-type(6)  { animation-delay: 0.45s; }
.kb-empty-cap-pill:nth-of-type(7)  { animation-delay: 0.53s; }
.kb-empty-cap-pill:nth-of-type(8)  { animation-delay: 0.61s; }
.kb-empty-cap-pill:nth-of-type(9)  { animation-delay: 0.69s; }
.kb-empty-cap-pill:nth-of-type(10) { animation-delay: 0.77s; }
.kb-empty-cap-pill:nth-of-type(1)::after  { animation-delay: 0s; }
.kb-empty-cap-pill:nth-of-type(2)::after  { animation-delay: 0.9s; }
.kb-empty-cap-pill:nth-of-type(3)::after  { animation-delay: 1.8s; }
.kb-empty-cap-pill:nth-of-type(4)::after  { animation-delay: 2.7s; }
.kb-empty-cap-pill:nth-of-type(5)::after  { animation-delay: 3.6s; }
.kb-empty-cap-pill:nth-of-type(6)::after  { animation-delay: 4.5s; }
.kb-empty-cap-pill:nth-of-type(7)::after  { animation-delay: 5.4s; }
.kb-empty-cap-pill:nth-of-type(8)::after  { animation-delay: 6.3s; }
.kb-empty-cap-pill:nth-of-type(9)::after  { animation-delay: 7.2s; }
.kb-empty-cap-pill:nth-of-type(10)::after { animation-delay: 8.1s; }

.kb-empty-cap-pill-em {
  background: linear-gradient(135deg, #e7efff 0%, #f5e9ff 100%);
  border-color: #b9c8ff;
  color: #2a4cb4;
  font-weight: 600;
}

@keyframes kbPillIn {
  from { opacity: 0; transform: translateY(8px) scale(0.94); }
  to   { opacity: 1; transform: translateY(0)   scale(1);    }
}
@keyframes kbPillShimmer {
  0%   { transform: translateX(-120%); }
  18%  { transform: translateX(120%);  }  /* 短促扫过 */
  100% { transform: translateX(120%);  }  /* 剩下时间静止,等下一轮 */
}

.kb-empty-topology-canvas {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 18px;
  /* 工程蓝图底色:深一点,衬托节点和线条 */
  background:
    radial-gradient(ellipse at top left, rgba(110, 168, 255, 0.06) 0%, transparent 50%),
    radial-gradient(ellipse at bottom right, rgba(195, 140, 255, 0.05) 0%, transparent 55%),
    linear-gradient(180deg, #f3f7fc 0%, #ffffff 100%);
  overflow: hidden;
}

/* 缓慢漂浮的彩色光斑 — 增加纵深感,让画面"活"起来但不抢注意力 */
.kb-empty-topology-canvas::before {
  content: '';
  position: absolute;
  inset: -10%;  /* 向外扩 10% 让光斑边缘漂出去时不留断面 */
  background:
    radial-gradient(circle at 18% 28%, rgba(110, 168, 255, 0.22) 0%, transparent 30%),
    radial-gradient(circle at 78% 72%, rgba(195, 140, 255, 0.20) 0%, transparent 32%),
    radial-gradient(circle at 50% 92%, rgba(122, 220, 200, 0.16) 0%, transparent 28%),
    radial-gradient(circle at 88% 18%, rgba(255, 178, 122, 0.14) 0%, transparent 28%);
  filter: blur(6px);
  animation: kbCanvasFloat 22s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}

/* 工程图纸点阵 — 每 24px 一个微小的暗点,精准透气 */
.kb-empty-topology-canvas::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    /* 主点阵 */
    radial-gradient(circle at 1px 1px, rgba(80, 100, 150, 0.10) 1px, transparent 1.5px),
    /* 次级辅助线(更稀疏,5x 步长) */
    linear-gradient(to right, rgba(80, 100, 150, 0.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(80, 100, 150, 0.04) 1px, transparent 1px);
  background-size: 24px 24px, 120px 120px, 120px 120px;
  background-position: 0 0, 0 0, 0 0;
  /* 边缘渐隐 — 让网格不顶到边框 */
  -webkit-mask-image: radial-gradient(ellipse at center, #000 50%, transparent 95%);
          mask-image: radial-gradient(ellipse at center, #000 50%, transparent 95%);
  pointer-events: none;
  z-index: 0;
}

@keyframes kbCanvasFloat {
  0%, 100% { transform: translate(0, 0) rotate(0deg);     }
  25%      { transform: translate(20px, -12px) rotate(0.3deg); }
  50%      { transform: translate(-10px, 14px) rotate(-0.2deg); }
  75%      { transform: translate(15px, 8px)   rotate(0.2deg); }
}

.kb-topo-svg {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  max-width: 1300px;
  max-height: 100%;
}

/* QR 浮卡保持在最上层,不被光斑遮挡 */
.kb-empty-qrcode { z-index: 5; }

/* SVG 内可点击节点:鼠标手 + hover 抬升 + 焦点环 */
.kb-topo-clickable { cursor: pointer; transition: transform 0.2s ease; transform-origin: center; transform-box: fill-box; }
.kb-topo-clickable:hover rect { stroke: #2a6ddf; stroke-width: 2.4; filter: drop-shadow(0 4px 12px rgba(42, 109, 223, 0.28)); }
.kb-topo-clickable:hover { transform: translateY(-2px); }
.kb-topo-clickable:focus { outline: none; }
.kb-topo-clickable:focus-visible rect { stroke: #6635b6; stroke-width: 2.6; }

/* ─────── 模块介绍弹窗 ─────── */
.kb-empty-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
  padding: 24px;
}
.kb-empty-modal {
  width: 100%;
  max-width: 580px;
  max-height: calc(100vh - 48px);
  overflow: auto;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.32), 0 4px 12px rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(216, 224, 236, 0.8);
}
.kb-empty-modal-head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 14px;
  padding: 20px 22px 16px;
  border-bottom: 1px solid #eef2f8;
  background: linear-gradient(135deg, #f7faff 0%, #ffffff 100%);
}
.kb-empty-modal-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  font-size: 24px;
  border-radius: 12px;
  background: linear-gradient(135deg, #eef3ff 0%, #f5e9ff 100%);
  border: 1px solid #c8d4f0;
}
.kb-empty-modal-title h3 {
  margin: 0 0 2px;
  font-size: 17px;
  font-weight: 700;
  color: #1f2a44;
}
.kb-empty-modal-title p {
  margin: 0;
  font-size: 12px;
  color: #6b7891;
  letter-spacing: 0.02em;
}
.kb-empty-modal-close {
  align-self: flex-start;
  border: none;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.18s ease, color 0.18s ease;
}
.kb-empty-modal-close:hover { background: #f1f5f9; color: #1f2a44; }

.kb-empty-modal-section { padding: 14px 22px; border-top: 1px solid #f4f6fa; }
.kb-empty-modal-section:first-of-type { border-top: none; }
.kb-empty-modal-section h4 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: #1f2a44;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  letter-spacing: 0.02em;
}
.kb-empty-modal-pin { font-size: 14px; }

.kb-empty-modal-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.kb-empty-modal-list li {
  position: relative;
  padding: 6px 10px 6px 26px;
  font-size: 12.5px;
  line-height: 1.55;
  color: #475569;
  border-radius: 8px;
}
.kb-empty-modal-list li::before {
  content: '';
  position: absolute;
  left: 10px;
  top: 13px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.kb-empty-modal-list-pain li {
  background: linear-gradient(90deg, rgba(255, 235, 220, 0.4) 0%, transparent 100%);
}
.kb-empty-modal-list-pain li::before { background: #ff8a4c; }
.kb-empty-modal-list-feat li {
  background: linear-gradient(90deg, rgba(232, 240, 255, 0.55) 0%, transparent 100%);
}
.kb-empty-modal-list-feat li::before { background: #2a6ddf; }

.kb-empty-modal-line {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.7;
  color: #475569;
  padding: 8px 12px;
  background: #f8fafc;
  border-left: 3px solid #6ea8ff;
  border-radius: 6px;
}
.kb-empty-modal-solves .kb-empty-modal-line {
  background: linear-gradient(90deg, #f0fdf6 0%, #ffffff 100%);
  border-left-color: #16a34a;
  color: #1e3a2b;
  font-weight: 500;
}

/* 弹窗过渡 */
.kb-modal-enter-active,
.kb-modal-leave-active { transition: opacity 0.22s ease; }
.kb-modal-enter-active .kb-empty-modal,
.kb-modal-leave-active .kb-empty-modal {
  transition: transform 0.28s cubic-bezier(.2,.8,.2,1), opacity 0.22s ease;
}
.kb-modal-enter-from,
.kb-modal-leave-to { opacity: 0; }
.kb-modal-enter-from .kb-empty-modal,
.kb-modal-leave-to .kb-empty-modal {
  opacity: 0;
  transform: translateY(20px) scale(0.96);
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
  .kb-empty-dot,
  .kb-empty-cap-pill,
  .kb-empty-cap-pill::after,
  .kb-empty-topology-canvas::before,
  .kb-empty-tagline-cursor,
  .kb-empty-tagline-text { animation: none; }
}
</style>
