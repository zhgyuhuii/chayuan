<div align="center">

<img src="public/images/ai-assistant.svg" alt="Chayuan 察元 AI" width="120" height="120" />

# 察元 AI 文档助手 · Chayuan AI Document Assistant

**WPS 文字智能加载项** — 在编辑器内完成 AI 对话、审查、表单与文档写回；**优先支持离线 / 内网模型**（Ollama、LM Studio、Xinference、OneAPI 等 OpenAI 兼容端点），亦可对接主流云端大模型。

[![Vue 3](https://img.shields.io/badge/Vue-3-4fc08d?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![WPS JSAPI](https://img.shields.io/badge/WPS-Add--in-217346?logo=microsoftword&logoColor=white)](#)

[简体中文](#简体中文) · [English](#english) · [日本語](#日本語) · [Deutsch](#deutsch) · [Русский](#русский) · [Español](#español) · [Français](#français)

</div>

---

## 界面预览 · Screenshots

| AI 助手与对话 | 任务与审查 | 设置与模型 |
|:---:|:---:|:---:|
| ![主界面](public/images/about/screen-1.png) | ![任务](public/images/about/screen-2.png) | ![设置](public/images/about/screen-3.png) |

<p align="center"><sub>补充界面</sub><br /><img src="public/images/about/screen-4.png" alt="界面预览" width="720" /></p>

---

## 简体中文

### 产品概述

**察元 AI 文档助手**（**Chayuan**，npm 包名 `chayuan`）是基于 **Vue 3** 与 **Vite** 的 **WPS 文字**智能加载项：在 Ribbon 与右键菜单中集成对话、文本分析、翻译、多模态生成、保密与脱敏、文档/表格/图像批量处理、表单辅助、模板与规则管理等能力；生成结果可 **插入、替换、批注** 写回当前文档。产品侧重 **离线办公与内网部署**：通过 **Ollama** 或任意 **OpenAI 兼容** 网关即可在无公网 API 的情况下完成对话与助手流程。

### 官网与渠道

| 项目 | 说明 |
|------|------|
| **官网** | [https://aidooo.com](https://aidooo.com) |
| **出品方** | 北京智灵鸟科技中心 |
| **微信公众号** | 智灵鸟科技 |

自愿赞赏与关注方式以官网及应用内说明为准；**非**购买商业服务或许可的凭证。

### 功能总览

**文档内交互**

- **关于**：产品介绍与能力说明。
- **AI 助手**：主对话、拼写与语法检查、生成摘要。
- **文本分析**：改写、扩写、缩写、段落序号检查、AI 痕迹检查、批注/超链接解释、纠正拼写语法、提炼关键词等。
- **翻译**：多语言翻译（菜单随配置变化）。
- **多模态**：文本转图像、文本转语音、文本转视频。
- **智能助手**：多个可固定入口的主助手 +「更多」动态菜单。
- **安全保密**：保密检查、文档脱密、脱密复原。
- **文档批量**：清理未使用样式、统计已使用样式、删除空白行。
- **表格批量**：导出/删除全部表格、自动行宽、刷新样式、按文字删行列、追加替换、序号与样式、表格题注等。
- **图像批量**：导出/删除全部图像、统一/清除格式、图像题注等。
- **察元 AI 编审**：表单辅助填报、表单内容预览、文档审计。
- **模板 / 规则**：导出/导入/下载模板；规则制作、导入、导出。
- **设置**：任务清单，综合设置（模型、数据路径、助手等）。
- **右键菜单**：添加到察元、文本分析、翻译、智能助手快捷入口。

**扩展能力**

- **自定义智能助手**、**任务编排与任务清单**、报告/审计类生成，以及面向使用场景的能力说明与引导问答。

### 模型与供应商

实际可用模型取决于您在 **设置** 中配置的 **API 密钥、基础 URL 与供应商**。**纯离线**场景可只启用本机或内网的 OpenAI 兼容服务，无需公网密钥。以下为界面中常见的供应商分组（与默认配置一致；维护者可在源码 `src/utils/defaultModelGroups.js` 中查看完整分组定义）：

- **离线 / 本地**：Ollama、LM Studio、Xinference、OneAPI、New API 等（OpenAI 兼容，可部署于内网）。
- **云端**：ChatGPT（GPT-4o、GPT-4、Turbo、o 系列、GPT-5、3.5 等）、Claude、Gemini、DeepSeek、豆包、通义千问、百度云千帆/文心、ChatGLM/GLM、Kimi/Moonshot、零一万物 Yi 等。
- **其他 / 生态**：百川、Mistral、Mixtral、Llama 3、腾讯混元、讯飞星火、MiniMax、阶跃 Step、Grok、Perplexity、Coze、书生·浦语、OpenRouter、Groq、Together、Fireworks、Cohere、Poe、Hugging Face、ModelScope、火山引擎、无问芯穹、网易有道、华为盘古、商汤、海螺、360 智脑等，以及各类 OpenAI 兼容聚合与自托管网关。

### 环境要求

- **Node.js** 与 **npm**（建议使用当前 LTS）。
- **WPS 文字**（用于加载项运行与调试）。
- 推荐安装 **wpsjs** 与 WPS JSAPI 相关工具链（见下方调试说明）。

### 开发与构建

```bash
npm install
```

| 命令 | 说明 |
|------|------|
| `npm run dev` | Vite 开发服务，默认端口 **3889** |
| `npm run build` | 生产构建（`vite build`） |
| `npm run preview` | 本地预览构建结果（默认端口一般为 **4173**，以终端输出为准） |
| `npm run build:wps` | WPS 加载项打包（`scripts/build-wps-addon.mjs`） |
| `npm run build:wps-online` | 在线模式打包 |
| `npm run build:wps-offline` | 离线模式打包 |
| `npm run build:wps-all` | 打包（与 `build:wps` 同源入口，按需选用） |
| `npm run build:wps-exe` | 通过 `wpsjs` 生成可执行相关产物（见 `scripts/run-wpsjs-exe.mjs`） |
| `npm run build:wps-pkg-macos` | macOS 安装包（`scripts/build-macos-pkg.sh`） |
| `npm run build:wps-deb` | Linux `.deb`（`scripts/build-linux-deb.sh`） |
| `npm run lint` | ESLint 检查与自动修复 |
| `npm run format` | Prettier 格式化 `src/` |

其他维护向脚本（如 `verify:task-scope`、`generate:logo-avatar-dataurl`、模型图标相关脚本）见 `package.json` 的 `scripts` 字段。

### WPS 加载项调试

本地开发时通常使用 **`wpsjs debug`**（需本机已安装 WPS 与 wpsjs），将加载项指向开发服务器或构建产物目录。具体步骤以 WPS 与 wpsjs 官方文档为准。

仓库内提供 **GitHub Actions** 工作流（如 `.github/workflows/build-wps-addon.yml`），可用于在 CI 中执行构建校验。

### 捐助说明

感谢支持开源与持续维护。自愿捐助请通过 **[aidooo.com](https://aidooo.com)** 或应用内入口了解；发布捐助信息时请遵守 [GitHub 服务条款](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)。

---

## English

### Overview

**Chayuan AI Document Assistant** is a **WPS Writer** add-in (Vue 3, Vite): AI chat, summarization, text analysis, translation, multimodal outputs (image / audio / video), security & declassification, batch document/table/image tools, forms, templates, and rules—with optional **insert / replace / comment** write-back. **Offline and intranet-first**: **Ollama** or any **OpenAI-compatible** endpoint; cloud providers are optional.

### Official site

**Beijing Zhilingniao Technology Center** · **[aidooo.com](https://aidooo.com)** · WeChat: **智灵鸟科技**.

### Features (summary)

Ribbon: **Chayuan AI Assistant** (chat, spelling & grammar, summary, analysis menu, translation, TTI/TTS/TTV, pinned assistants) and **Chayuan AI Review** (forms, audit, templates, rules, task list, settings). **Security**: confidentiality check, declassification & restore. **Batch**: styles, tables, images. **Context menus**: add to Chayuan, analysis, translation, assistant shortcuts. **Extensibility**: custom assistants, task orchestration, offline/local LLMs and cloud backends.

### Models

Runtime depends on your settings (keys, base URL, provider). **Offline-only** setups are supported. Provider groups align with `src/utils/defaultModelGroups.js`.

### Build

```bash
npm install
npm run dev          # default port 3889
npm run build
npm run preview
npm run build:wps    # add -online / -offline variants via npm run build:wps-online | build:wps-offline
```

Optional: `build:wps-exe`, `build:wps-pkg-macos`, `build:wps-deb`, `lint`, `format`—see `package.json`. Use **`wpsjs debug`** for WPS-side debugging.

### Donations

Voluntary support via **[aidooo.com](https://aidooo.com)** or in-app; follow the [GitHub Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) for donation content.

---

## 日本語

**察元 AI 文書アシスタント**は **WPS Writer** 向け Vue 3 + Vite アドインです。AI チャット、要約、テキスト分析、翻訳、マルチモーダル、セキュリティ、表・画像の一括処理、フォーム、テンプレート／ルールに対応し、必要に応じ文書へ書き戻せます。**Ollama** など OpenAI 互換 API を含み、オフライン／イントラネット利用を重視します。

**公式サイト**：[aidooo.com](https://aidooo.com)（北京智灵鸟科技中心）。ビルドは `npm install` のあと `npm run dev` / `npm run build` / `npm run build:wps` など（詳細は `package.json`）。寄付はサイト・アプリの案内に従い、[GitHub 利用規約](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) を遵守してください。

---

## Deutsch

**Chayuan** ist ein **WPS Writer**-Add-in (Vue 3, Vite) mit KI-Chat, Textanalyse, Übersetzung, multimodalen Ausgaben, Sicherheitsfunktionen sowie Stapelverarbeitung für Tabellen und Bilder—optional mit Rückschreibung ins Dokument. **Ollama** und OpenAI-kompatible APIs werden unterstützt.

**Website**：[aidooo.com](https://aidooo.com). Build: `npm install`, `npm run dev`, `npm run build`, `npm run build:wps` (siehe `package.json`). Spenden freiwillig über die Website; [GitHub-Nutzungsbedingungen](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) beachten.

---

## Русский

**Chayuan** — надстройка для **WPS Writer** (Vue 3, Vite): чат ИИ, анализ и перевод текста, мультимодальные функции, безопасность, пакетная обработка таблиц и изображений, формы и шаблоны, запись в документ. Поддерживаются **Ollama** и OpenAI-совместимые API.

**Сайт**：[aidooo.com](https://aidooo.com). Сборка: `npm install`, `npm run dev`, `npm run build`, `npm run build:wps` — см. `package.json`. Пожертвования — по правилам сайта и [условий GitHub](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service).

---

## Español

Complemento **WPS Writer** (Vue 3 + Vite) con asistente de IA, análisis, traducción, multimodal, seguridad y herramientas por lotes para tablas e imágenes. Modelos configurables; **Ollama** y APIs compatibles con OpenAI.

**Sitio**：[aidooo.com](https://aidooo.com). Compilación: `npm run dev`, `npm run build`, `npm run build:wps`. Donaciones voluntarias según el sitio y los [Términos de GitHub](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service).

---

## Français

Extension **WPS Writer** (Vue 3, Vite) : dialogue IA, analyse, traduction, génération multimédia, confidentialité, traitement par lots, formulaires et modèles. Fournisseurs configurables ; **Ollama** et API compatibles OpenAI.

**Site**：[aidooo.com](https://aidooo.com). Construction : `npm run dev`, `npm run build`, `npm run build:wps`. Dons volontaires conformément aux [conditions GitHub](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service).

---

<div align="center">

**察元 AI 文档助手** · WPS 智能加载项 · Vue 3 + Vite

</div>
