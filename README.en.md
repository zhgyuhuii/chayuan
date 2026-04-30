<div align="center">

<img src="public/images/ai-assistant.svg" alt="Chayuan AI" width="120" height="120" />

# Chayuan AI Document Assistant — Full Manual

**[简体中文（完整说明）](README.md#简体中文完整说明)** · **[日本語](README.ja.md)** · **[Русский](README.ru.md)** · **[Deutsch](README.de.md)** · **[Español](README.es.md)** · **[Français](README.fr.md)** · **[主文档 README.md](README.md)**

</div>

---

## 1. Copyright and license

**Software name:** Chayuan AI Document Assistant (Chinese product name **察元 AI 文档助手**, npm package **`chayuan`**).

**Open-source license:** Source code in this repository is licensed under the **[Apache License, Version 2.0](LICENSE)**. Subject to that license, you may use, modify, merge, publish, sublicense, and **use the software commercially** (e.g. internal deployment, integration, managed services). If you have a separate written agreement (commercial license, OEM, exclusivity, etc.), **that agreement prevails** where it applies; otherwise Apache 2.0 remains the baseline.

**Rights holder / publisher:** Beijing Zhilingniao Technology Center. **Website:** [https://aidooo.com](https://aidooo.com) · WeChat public account: 智灵鸟科技.

**Disclaimer (summary):** The software is provided “as is.” Model output may be wrong or unsuitable. Security, compliance, and legal judgments remain human responsibilities. Confidentiality checks and “AI trace” checks are **assistive only**, not forensic or official classification conclusions.

---

## 2. Special rule: do not alter the “察元” (Chayuan) branding in UI

For end-user clarity and honest sourcing, the following **fixed branding strings** must not be replaced, removed, obscured, diluted, or misleadingly rewritten **without written permission** from the rights holder:

- **Ribbon** group titles, button labels, dropdowns, and dynamic menus in WPS Writer.
- **Context menu** entries.
- **Dialogs, task panes, About page, welcome text** where the product is identified as **察元**, **察元 AI**, **察元 AI 文档助手**, **察元 AI 助手**, **察元 AI 编审**, **关于察元**, **添加到察元 AI 助手**, and related user-visible names.
- File-type descriptions such as **察元模板**, **察元规则**, **察元文档**, etc.

This does **not** forbid modifying source code under Apache 2.0 for internal engineering. It **does** require that **redistributable builds** that still present the official UI retain those branding strings **unless** you have a separate written authorization (e.g. white-label terms).

---

## 3. Commercial use (exceptions in one place)

| Situation | Guidance |
|-----------|----------|
| Internal / intranet use | Generally allowed under Apache 2.0; mind keys and data policies. |
| Commercial redistribution or integration | Allowed under Apache 2.0; comply with license obligations; respect **Section 2** branding. |
| Additional contract with the publisher | Follow the contract for support, trademark scope, liability, etc. |
| Third-party models | Separate terms and billing from this project’s license. |

Voluntary donations are **not** proof of a commercial license purchase.

---

## 4. Overview

Chayuan is a **WPS Writer** add-in built with **Vue 3** and **Vite**. It connects LLMs with document operations: chat, review, translation, multimodal generation, security & declassification, batch tools for documents/tables/images, forms, templates & rules, task lists and orchestration—with **insert / replace / comment / linked comment / append** write-back.

**Design:** **Offline and intranet first** via **Ollama** or any **OpenAI-compatible** gateway (LM Studio, Xinference, OneAPI, New API, …). Cloud providers are optional.

---

## 4.1 Version 2.0.0: major refactor and stability release

**Current version: `2.0.0`.** This release consolidates the architecture and documentation work described across all Markdown planning/status files in this repository: v2 evolution planning, P0-P6 execution reports, workflow orchestration W1-W7, task-system redesign, runtime gap closure, assistant form layout, and the project status index.

Highlights:

- Assistant dialog refinements: the knowledge-base selector is now an icon button, and assistants with runtime parameters ask for those parameters before execution.
- Translation assistants ask for the target language; image/video/audio assistants ask for aspect ratio, duration, voice style, and other relevant values.
- Model selection is type-safe: the chat dialog shows chat models only; default settings and assistant settings filter by model type; model settings group models by chat, embedding, image, voice, video, and related categories.
- Offline / intranet deployment remains a first-class path through Ollama, LM Studio, Xinference, OneAPI, New API, and other OpenAI-compatible endpoints.
- Stability work covers task execution, retries, parameter propagation, model type matching, progress windows, and document write-back.

The **named-product summary matrix** and the full **60-dimension** comparison are in the main Chinese README: [README.md § 4.2](README.md#42-60-项竞品能力对比察元-200-vs-常见办公-ai--文档-ai-工具). They cover WPS AI, Microsoft 365 Copilot, Google Workspace Gemini, Feishu, Tencent Docs, Notion AI, general LLM web apps, plus Chayuan-specific topics such as custom assistants, report templates, multi-model gateways, offline deployment, workflow orchestration, declassification, and WPS write-back.

---

## 5. Screenshots

| AI assistant & chat | Tasks & review | Settings & models |
|:---:|:---:|:---:|
| ![Main](public/images/about/screen-1.png) | ![Tasks](public/images/about/screen-2.png) | ![Settings](public/images/about/screen-3.png) |

<p align="center"><sub>More UI</sub><br /><img src="public/images/about/screen-4.png" alt="Screenshot" width="720" /></p>

---

## 6. Feature map (module level)

- **About Chayuan:** product intro and model overview.
- **Chayuan AI Assistant:** main chat, model picker, spelling & grammar, summary, write-back toolbar.
- **Text analysis:** rewrite, expand, abbreviate, paragraph numbering check, AI-trace check, comment explain, hyperlink explain, spelling & grammar correction, keyword extraction, …
- **Translation:** target languages from configuration.
- **Multimodal:** text-to-image / audio / video (provider-dependent).
- **Smart assistants (More / context menu):** overflow assistants; create / manage custom assistants.
- **Security:** confidentiality check, declassify, restore; secret keyword extraction.
- **Document batch:** unused style cleanup, style statistics, blank line removal, …
- **Table batch:** export/delete tables, column width, style refresh, row/column ops, captions, …
- **Image batch:** export/delete images, uniform format, captions, …
- **Chayuan AI Review:** forms, preview, audit, templates & rules import/export, …
- **Settings:** task list, models, paths, assistant display locations, …
- **Context menu:** add to Chayuan assistant, analysis, translation, assistant shortcuts.

**Extensibility:** **Custom assistants** (prompts, templates, write-back, Ribbon / context placement), **task orchestration**, **report mode** for long structured outputs.

---

## 7. Built-in assistants (overview → detail)

Each item: **role** · **behavior** · **typical write-back** (configurable in Settings).

### 7.1 Core

1. **Spelling & grammar check** — Structured JSON issues; default **comments**; good for first-pass review.  
2. **Summary** — Compress selection or full doc; optional **report mode**.  
3. **Translate** — Preserve structure and terms; target language configurable.  
4. **Text-to-image** — Illustrations; insert/comment paths.  
5. **Text-to-speech** — Audio generation; provider-dependent.  
6. **Text-to-video** — Short video drafts; media options in assistant settings.

### 7.2 Text analysis (common Ribbon items)

7. **Rewrite** — Same meaning, new wording; often **replace**.  
8. **Expand** — Add detail without drifting topic.  
9. **Abbreviate** — Shorter, keep key facts.  
10. **Comment explain** — Marginal explanations for reviewers.  
11. **Hyperlink explain** — Explain references/links.  
12. **Correct spelling & grammar** — Full corrected text; differs from JSON check flow.  
13. **Keyword extraction** — Tags and concepts as lists.  
14. **Paragraph numbering check** — Numbering consistency for formal docs.  
15. **AI trace check** — Conservative heuristics + locate-able snippets; **not** a legal “AI detector” verdict.  
16. **Confidentiality check** — Tiered risk hints for secrets, military-related wording, org IDs, contacts, project codes, trade secrets, etc.

### 7.3 More-menu / review-related

17. **Secret keyword extraction** — JSON for declassification placeholders.  
18. **Form field smart extract** — Structured fields from contracts/agreements.  
19. **Document audit assistant** — Per-bookmark audit with JSON + report-friendly defaults.  
20. **Polish** — Fluency and professionalism.  
21. **Formalize** — Oral → formal written style.  
22. **Simplify** — Technical → plain language.  
23. **Action items** — TODOs, owners, dates.  
24. **Conclusions & risks** — Exec summary style.  
25. **Terminology unify** — Consistent names/terms.  
26. **Title generation** — Multiple headline candidates.  
27. **Paragraph structure** — Reorder logic flow.  
28. **Meeting minutes** — Standard minutes layout.  
29. **Policy / official-doc style** — Tone for policy or gov-style writing.

### 7.4 Custom assistants

Create assistants with your own system prompts, user templates, model type (chat/image/voice/video), input source, output format, write-back action, and display locations (**Ribbon main**, **Ribbon more**, **context menu**, **context more**). Use them for **reports**, **annotations**, **revision pipelines**, domain checks, bid consistency, and more.

---

## 8. Models (summary)

Effective models depend on **Settings** (API keys, base URL, provider). Offline-only setups are supported. Default groups live in `src/utils/defaultModelGroups.js`; enablement logic includes `src/utils/modelSettings.js`.

---

## 9. Environment & commands

- Node.js + npm (LTS recommended), WPS Writer, **wpsjs** for debugging.

```bash
npm install
npm run dev              # port 3889
npm run build
npm run preview
npm run build:wps
npm run build:wps-online
npm run build:wps-offline
npm run lint
npm run format
```

Use **`wpsjs debug`** to attach the add-in to dev server or build output.

---

## 10. Donations

Voluntary support via **[aidooo.com](https://aidooo.com)** or in-app instructions; follow the [GitHub Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) when posting donation content.

---

<div align="center">

**Chayuan AI Document Assistant** · Vue 3 + Vite · Apache-2.0 · Branding rule: **do not change 察元 branding in dialogs, Ribbon, or menus without authorization**; **commercial use is allowed** under Apache 2.0 except where a separate contract or Section 2 applies.

</div>
