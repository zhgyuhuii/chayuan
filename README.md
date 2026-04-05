<div align="center">

<img src="public/images/ai-assistant.svg" alt="Chayuan 察元 AI" width="120" height="120" />

# 察元 AI 文档助手 · Chayuan AI Document Assistant

**WPS 文字智能加载项** — 在编辑器内完成 AI 对话、审查、表单与文档写回，并对接主流大模型与本地/私有部署。

[![Vue 3](https://img.shields.io/badge/Vue-3-4fc08d?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![WPS JSAPI](https://img.shields.io/badge/WPS-Add--in-217346?logo=microsoftword&logoColor=white)](#)

[简体中文](#简体中文) · [English](#english) · [日本語](#日本語) · [Deutsch](#deutsch) · [Русский](#русский) · [Español](#español) · [Français](#français)

</div>

---

## 界面预览 · Screenshots

将产品截图放入仓库后，下列图片会在 GitHub 上正常显示（与应用内「关于」页一致的路径）：

| AI 助手与对话 | 任务与审查 | 设置与模型 |
|:---:|:---:|:---:|
| ![主界面](public/images/about/screen-1.png) | ![任务](public/images/about/screen-2.png) | ![设置](public/images/about/screen-3.png) |

> 若尚未添加图片，上图可能显示为「损坏」占位。请将 `screen-1.png`～`screen-3.png` 放到 `public/images/about/` 后提交；或使用 `wpsjs debug` / 构建产物自行截取。

---

## 简体中文

### 简介

> 顶栏 Logo 使用仓库内 `public/images/ai-assistant.svg`。若需与客户端一致的 PNG 品牌图，请将 `logo.png` 放入 `public/images/` 并把本 README 顶部图片路径改为该文件。

**察元 AI 文档助手**（英文名可写作 **Chayuan**；npm 包名 `chayuan`）是一款面向 **WPS 文字** 的 Vue 3 + Vite 智能加载项：在 Ribbon 与右键菜单中提供 AI 助手、文本分析、翻译、多模态生成、保密与脱敏、表格/图片批量处理、表单辅助与规则模板等功能，并支持将结果 **插入、替换、批注** 写回当前文档。

### 官方介绍与渠道

**察元 AI 文档助手**由北京智灵鸟科技中心出品。在 WPS 文字中可完成对话、审查、任务编排与文档写回；对接主流大模型与本地/私有部署，兼顾办公效率与数据边界。更多产品介绍、在线演示与需求反馈请访问官网。

| 项目 | 说明 |
|------|------|
| **官网** | [https://aidooo.com](https://aidooo.com) |
| **出品方** | 北京智灵鸟科技中心 |

请将下列二维码图片放入 **`public/images/pay/`**（与应用内欢迎页、支持区资源路径一致；PNG 推荐）。未放置时，下表在 GitHub 上可能显示为损坏占位。

| 关注官方（公众号） | 微信赞赏 | 支付宝赞赏 |
|:---:|:---:|:---:|
| ![关注官方公众号](public/images/pay/follow.png) | ![微信收款码](public/images/pay/wxpay.png) | ![支付宝收款码](public/images/pay/alipay.png) |

### 功能清单（Ribbon 与能力概览）

| 区域 | 能力 |
|------|------|
| **关于** | 关于察元 AI 助手 |
| **AI 助手** | 主对话、拼写与语法检查、生成摘要 |
| **文本分析** | 换种方式重写、扩写、缩写、段落序号检查、AI 痕迹检查、批注/超链接解释、纠正拼写语法、提炼关键词 |
| **翻译** | 多语言翻译（动态菜单，依配置） |
| **多模态** | 文本转图像、文本转语音、文本转视频 |
| **智能助手** | 多个可配置主助手入口 +「更多」动态菜单 |
| **安全保密** | 保密检查、文档脱密、脱密复原 |
| **文档批量** | 清理未使用样式、统计已使用样式、删除空白行 |
| **表格批量** | 导出/删除全部表格、自动行宽、刷新样式、按文字删行列、追加替换、序号与样式、表格题注等 |
| **图像批量** | 导出/删除全部图像、统一/清除格式、图像题注等 |
| **察元 AI 编审** | 表单辅助填报、表单内容预览、文档审计 |
| **模板 / 规则** | 导出/导入模板、下载模板；规则制作、导入、导出 |
| **设置** | 任务清单、综合设置（模型、数据路径、助手等） |
| **右键菜单** | 添加到察元、文本分析、翻译、智能助手快捷入口 |

此外，应用支持 **自定义智能助手**、**任务编排与清单**、**报告/审计类生成**、以及面向能力的问答引导（见 `assistantCapabilityFaq` 等模块）。

### 可集成模型与平台（内置分组摘要）

实际可用性取决于您在设置中配置的 **API 密钥、网关与供应商**。下列与源码中 `src/utils/defaultModelGroups.js` 的默认分组一致（含 OpenAI 兼容与聚合平台）：

- **ChatGPT**（GPT-4o、GPT-4、Turbo、o3、o1、GPT-5、3.5 等）
- **Claude** · **Gemini** · **DeepSeek** · **豆包** · **通义千问** · **百度云千帆 / 文心** · **ChatGLM / GLM** · **Kimi / Moonshot** · **零一万物 Yi** · **Ollama**（本地）
- **其他 / 生态**：百川、Mistral、Mixtral、Llama 3、腾讯混元、讯飞星火、MiniMax、阶跃 Step、Grok、Perplexity、Coze、书生·浦语、OpenRouter、Groq、Together、Fireworks、Cohere、Poe、Hugging Face、ModelScope、火山引擎、无问芯穹、OneAPI、Xinference、New API、LM Studio、OpenAI 兼容 API、网易有道、华为盘古、商汤、海螺、360 智脑 等

### 开发与构建

```bash
npm install
npm run dev          # Vite 开发服务（默认端口见 package.json / 项目配置）
npm run build        # 前端构建
npm run build:wps    # WPS 加载项打包（见 scripts/build-wps-addon.mjs）
```

WPS 侧调试常用 `wpsjs debug`（需本机安装 WPS 与 wpsjs 工具链）。

### 捐助说明

感谢支持开源与持续维护。自愿扫码赞赏请见上文 **「官方介绍与渠道」** 中的微信/支付宝二维码（**非购买服务或商业许可**）。

**与 GitHub 政策的关系（简要）**：GitHub 允许在仓库 README 中放置指向捐助渠道的图片或链接；许多项目使用 [GitHub Sponsors](https://github.com/sponsors)、Open Collective 或第三方支付二维码。请确保说明 **真实、自愿、不误导**，且收款用途与描述一致；具体以 [GitHub 服务条款](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) 与适用法律为准。若仅面向特定地区收款，建议在文中注明。

### 相关链接

- 官网：[https://aidooo.com](https://aidooo.com)
- 应用内「关于」面板与浏览器独立「关于」路由展示同一套介绍文案与能力说明（本地演示可参考 `http://localhost:3890/` 等同源地址）。

---

## English

### Overview

**Chayuan AI Document Assistant** is a **WPS Writer** add-in built with **Vue 3** and **Vite**. It brings chat, analysis, translation, multimodal generation (image / audio / video), security & declassification workflows, batch table/image tools, form assistance, and template/rule management into the editor—with optional **insert / replace / comment** write-back to the document.

### Official site & QR codes

Published by **Beijing Zhilingniao Technology Center**. Product information and updates: **[aidooo.com](https://aidooo.com)**.

Place PNG (or other) QR images under **`public/images/pay/`**—same paths as the in-app welcome/support panel: `follow.png`, `wxpay.png`, `alipay.png`.

| Follow (WeChat official) | WeChat Pay | Alipay |
|:---:|:---:|:---:|
| ![Follow](public/images/pay/follow.png) | ![WeChat Pay](public/images/pay/wxpay.png) | ![Alipay](public/images/pay/alipay.png) |

### Feature highlights

- Ribbon tabs: **Chayuan AI Assistant** (AI chat, spelling & grammar, summary, text analysis menu, translation, TTI / TTS / TTV, pinned assistants) and **Chayuan AI Review** (forms, audit, templates, rules, task list, settings).
- **Security**: confidentiality check, document declassification & restore.
- **Batch**: document cleanup, table & image batch operations.
- **Context menus**: add selection to Chayuan, analysis, translation, assistant shortcuts.
- **Extensibility**: custom assistants, task orchestration, OpenAI-compatible and local (e.g. **Ollama**) backends.

### Models & providers

Configured providers drive what works at runtime. Built-in UI groups include **OpenAI**, **Anthropic Claude**, **Google Gemini**, **DeepSeek**, Chinese cloud models (**Doubao**, **Qwen**, **ERNIE**, **GLM**, **Kimi**, **Yi**), **Ollama**, and many aggregators (**OpenRouter**, **Groq**, **OneAPI**, **LM Studio**, **OpenAI-compatible**, etc.)—see `src/utils/defaultModelGroups.js` for the canonical list.

### Donations

Optional tips: use the **WeChat Pay** and **Alipay** QR codes in **Official site & QR codes** above (voluntary, not a product purchase). **GitHub** generally allows such images in READMEs; comply with the [GitHub Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service).

---

## 日本語

### 概要

**察元（チャーユアン）AI 文書アシスタント**は、**WPS Writer** 向けの Vue 3 + Vite 製アドインです。リボンと右クリックメニューから、AI チャット、要約、テキスト分析、翻訳、画像・音声・動画生成、セキュリティチェック、表・画像の一括処理、フォーム支援、テンプレート／ルール管理などを利用でき、必要に応じて文書へ結果を書き戻せます。

**公式サイト**：[aidooo.com](https://aidooo.com)（北京智灵鸟科技中心）。フォロー／寄付用 QR は **`public/images/pay/`** に `follow.png`・`wxpay.png`・`alipay.png` を配置（アプリ内と同じパス）。

| フォロー（WeChat） | WeChat Pay | Alipay |
|:---:|:---:|:---:|
| ![Follow](public/images/pay/follow.png) | ![WeChat](public/images/pay/wxpay.png) | ![Alipay](public/images/pay/alipay.png) |

### 主な機能

- AI アシスタント、スペル・文法、要約、テキスト分析一式、翻訳、マルチモーダル生成、カスタムアシスタント。
- セキュリティ：機密チェック、文書のマスキング／復元。
- 編集・一括：スタイル整理、表・画像のバッチ操作。
- 編集レビュータブ：フォーム、監査、テンプレート、ルール、タスク一覧、設定。

### 接続可能なモデル例

OpenAI、Claude、Gemini、DeepSeek、中国系クラウドモデル（豆包・通義千問・文心・ChatGLM・Kimi・Yi など）、**Ollama**、OpenRouter / Groq / OneAPI など OpenAI 互換ゲートウェイ。詳細は `src/utils/defaultModelGroups.js` を参照してください。

### 寄付・GitHub について

任意の寄付は上表の QR をご利用ください。虚偽や強制を避け、**GitHub 利用規約**に沿ってください。

---

## Deutsch

### Kurzbeschreibung

**Chayuan AI-Dokumentenassistent** ist ein **WPS Writer**-Add-in (Vue 3, Vite). Es bietet KI-Chat, Zusammenfassungen, Textanalyse, Übersetzung, multimodale Ausgaben (Bild/Sprache/Video), Sicherheits- und Entstufungsfunktionen sowie Stapelverarbeitung für Tabellen und Bilder—mit optionaler Rückschreibung in das Dokument.

**Offizielle Website**：[aidooo.com](https://aidooo.com). QR-Codes unter **`public/images/pay/`** (`follow.png`, `wxpay.png`, `alipay.png`) wie in der App.

| Folgen (WeChat) | WeChat Pay | Alipay |
|:---:|:---:|:---:|
| ![Follow](public/images/pay/follow.png) | ![WeChat](public/images/pay/wxpay.png) | ![Alipay](public/images/pay/alipay.png) |

### Funktionen (Auszug)

Ribbon: Assistent, Rechtschreibung & Grammatik, Textanalyse-Menü, Übersetzung, festlegbare Assistenten; Registerkarte für Prüfung/Formulare/Vorlagen/Regeln. Kontextmenüs für schnellen Zugriff.

### Modelle

Über die Einstellungen lassen sich u. a. OpenAI-, Claude-, Gemini-, DeepSeek- und chinesische Cloud-Modelle sowie **Ollama** und OpenAI-kompatible APIs anbinden (`src/utils/defaultModelGroups.js`).

### Spenden & Richtlinien

Freiwillige Spenden über die QR-Codes oben; es gilt die [GitHub-Nutzungsbedingungen](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service).

---

## Русский

### Описание

**Chayuan AI — помощник для документов** — надстройка для **WPS Writer** на Vue 3 и Vite: чат с ИИ, анализ и перевод текста, мультимодальные функции, проверки безопасности, пакетная обработка таблиц и изображений, работа с формами и шаблонами, запись результата в документ.

**Сайт**：[aidooo.com](https://aidooo.com). QR-коды: **`public/images/pay/`** — `follow.png`, `wxpay.png`, `alipay.png`.

| Подписка (WeChat) | WeChat Pay | Alipay |
|:---:|:---:|:---:|
| ![Follow](public/images/pay/follow.png) | ![WeChat](public/images/pay/wxpay.png) | ![Alipay](public/images/pay/alipay.png) |

### Возможности

Лента «察元AI助理»: ассистент, орфография и грамматика, краткое изложение, меню анализа текста, перевод, генерация изображения/речи/видео, закреплённые ассистенты. Вкладка редактирования: формы, аудит, шаблоны, правила, список задач, настройки.

### Модели

Поддерживаются популярные облачные модели и локальные варианты (**Ollama**), а также шлюзы с **совместимостью с OpenAI API** — полный перечень групп в `src/utils/defaultModelGroups.js`.

### Пожертвования и правила GitHub

Добровольные переводы — по QR выше. См. [условия GitHub](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service).

---

## Español

**Chayuan** es un complemento de **WPS Writer** (Vue 3 + Vite) que integra asistente de IA, análisis de texto, traducción, salidas multimodales, seguridad y herramientas por lotes para tablas e imágenes. Los modelos dependen de la configuración (OpenAI, Claude, Gemini, DeepSeek, nubes chinas, **Ollama**, APIs compatibles con OpenAI, etc.).

**Sitio oficial**：[aidooo.com](https://aidooo.com). Códigos QR en **`public/images/pay/`** (`follow.png`, `wxpay.png`, `alipay.png`).

| Seguir (WeChat) | WeChat Pay | Alipay |
|:---:|:---:|:---:|
| ![Follow](public/images/pay/follow.png) | ![WeChat](public/images/pay/wxpay.png) | ![Alipay](public/images/pay/alipay.png) |

Donaciones voluntarias: respeta los [Términos de GitHub](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service).

---

## Français

**Chayuan** est une extension **WPS Writer** (Vue 3, Vite) : dialogue IA, analyse et traduction, génération multimédia, contrôles de confidentialité, traitement par lots des tableaux et images, formulaires et modèles. Les fournisseurs de modèles sont configurables (liste dans `src/utils/defaultModelGroups.js`).

**Site officiel**：[aidooo.com](https://aidooo.com). QR : **`public/images/pay/`** (`follow.png`, `wxpay.png`, `alipay.png`).

| Suivre (WeChat) | WeChat Pay | Alipay |
|:---:|:---:|:---:|
| ![Follow](public/images/pay/follow.png) | ![WeChat](public/images/pay/wxpay.png) | ![Alipay](public/images/pay/alipay.png) |

Dons volontaires : voir les [conditions d’utilisation de GitHub](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service).

---

<div align="center">

**察元 AI 文档助手** · WPS 智能加载项 · Vue 3 + Vite

</div>
