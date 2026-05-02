# 察元知识库整合 · 架构设计与开发计划

> 目标：把 `chayuan-server` 提供的企业知识库（RAG）能力一等公民地接入 `chayuan`（WPS 加载项），让用户在文档里"圈段→去知识库找证据→由本地大模型总结/核对/问答"，并保证在大用户量下接口/服务承载得住。
>
> 范围：跨 `chayuan`（前端）+ `chayuan-server`（后端）的端到端方案。
>
> 文档版本：v1.3（实施期勘误 — 复用现有 ai_app + AppAuthMiddleware）。
>
> v1.3 关键修订（**实施前调研触发**）：
> - **❌ 抛弃 v1.2 的"在 AuthMiddleware 加 HMAC 旁路"方案**：项目已有完整的 `/openapi/v1/*` 前缀 + `AppAuthMiddleware` (ASGI 层) + `AppSpec` + `apps_store` (yaml/config_center) + scopes 机制 (`kb:read`/`kb:write`/`admin:write`)。
> - **✅ 改为"双前缀对称"架构**：JWT 客户端打 `/knowledge_base/*`，HMAC 客户端打 `/openapi/v1/kb/*`；两个端点接收同一份 body，调用同一个内部实现 `chayuan/server/file_rag/batch_search.py:run_batch(user, ...)`，差别只在"如何拿到 user"。
> - **❌ 抛弃 v1.2 的 `chayuan_apps` / `chayuan_app_audit_log`**：复用现有 `apps_store.AppSpec`（yaml 持久化、secret 已加密、CRUD 已就绪、`rotate_secret` 已实现）+ 现有 `chayuan_audit_log` 表（已有 `user_id`/`action`/`target_type`/`target_id`/`status`/`payload`，足够记录 app 行为，user_id 留 NULL，username 写 `app:{app_id}`）。
> - **✅ 仅新建 1 张表 `app_kb_grant`**（替代 v1.2 的 `chayuan_app_kb_grants`，命名与现有 `kb_access_grants` / `ai_app_grant` 保持一致）。schema：`(id, app_id VARCHAR, kb_id INT, role VARCHAR, granted_at, granted_by, expires_at)`，`app_id` 是字符串 FK 不到 DB（apps 在 yaml/config_center），`kb_id` FK 到 `knowledge_base.id`。
> - **✅ 仅新建 1 个 ACL 模块 `auth/app_acl.py`**：`app_can_read_kb`/`app_can_write_kb`/`list_app_accessible_kbs`/`add_grant`/`remove_grant`/`list_grants_for_app`；并扩 `auth/access.py` 的 `kb_access_for` / `list_accessible_kbs` 识别 `user.id == "app:xxx"` 时改走 `app_acl`。
> - **✅ Admin 端点直接挂 `/openapi/v1/admin/apps/{app_id}/kb_grants`**：复用现有 `require_scopes("admin:write")` 依赖，无需 JWT-only 限制；apps CRUD（创建/rotate/列表）继续走配置面板已有的 yaml CRUD。
> - **✅ Download token**：新建 `auth/download_token.py:sign_download/verify_download`，JWT payload `{u, k, f, aud, scope:"kb_download", exp:30m}`；`u` 字段用 `int(user_id)` (jwt) 或 `f"app:{app_id}"` (hmac)；下载时 verify_download 强制 aud 与 `request.state.user`/`request.state.app` 匹配。
> - **✅ allow_public_kbs**：实现为一个**专用 scope `kb:public-read`**，AppSpec.scopes 没这个 scope 的应用不能访问 visibility=public 的 KB（默认安全）。
>
> 工作量影响：后端代码量从 ~1200 行降到 ~600 行（复用比新建多）；新建文件从 12 个降到 5 个；零侵入 AuthMiddleware/AppAuthMiddleware（不动那两个核心组件）。
>
> ---
>
> v1.2 历史变更（已被 v1.3 修订替代）：双轨 ACL 完整设计，新增三张表；扩 `auth/access.py` 全部 ACL 函数兼容 `app:xxx` 主体 + 新增 `get_kb_role_for_subject`；中间件加 HMAC 旁路（含 secret 解密派生方案）；新增 7 个 admin 端点；错误码细化（4011-4014 / 4031-4033 / 4291-4293）；前端 §2.1/§2.2 必须显示主体类型和角色徽章；§6 安全章节同步加入"应用账号高危操作"小节；新增 4 个 todo。
>
> v1.1 变更要点：§3.2.5 重写为四层漏斗（结构切分 → 自适应归并 → 语义聚类 → LLM 蒸馏）+ 6 档硬预算表；§3.1 新增 `splitters.js / clusterer.js / localDistiller.js`；§3.2.6 改为整批走 `/search_batch`，新增 `bySection` 输出供 verify 模式；§4.1 接口契约新增 `tag` / `section_ids` 严格透传 + 入参硬约束（≤32 queries / ≤24k 总字 / ≤8 KBs）+ `fuse_with_provenance` 新辅助；§4.2 SSE 帧扩为 6 阶段；§8/§11/§12 同步更新；Phase 3 工时 +1d。

---

## 0. 摸到的现状（必读，定义了所有设计前提）

### 0.1 chayuan（WPS 加载项）

| 模块 | 现状 | 与本方案关系 |
|---|---|---|
| `src/components/SettingsDialog.vue:2397` | `generalSubMenus = [{ key: 'data', label: '数据设置' }]`，第三列对应 `:1903` 是 "功能开发中" 占位 | 在"数据设置"下追加"知识库设置"子项；右侧第三列接管渲染 |
| `src/components/AIAssistantDialog.vue:1798` `openKnowledgeBaseDialog` | 已有按钮，弹窗 `:1925` 是"功能开发中"占位 + 公众号二维码 | 替换为真实的知识库树形选择器 |
| `src/utils/modelSettings.js` + `globalSettings.js` | 用 `loadGlobalSettings/saveGlobalSettings`（OPFS / localStorage 兜底）持久化模型供应商配置（`modelConfigs` namespace） | 知识库连接配置复用同一存储层，新增 `kbConnections` namespace |
| `src/services/index.js` | 业务级聚合层，组件只依赖 `services.*`；目前已有 `documentIntelligence`、`sendPipeline`、`router`、`host` 等子树 | 新增 `services.kb`（连接管理 + 列表 + 检索 + 下载 + 凭据测试） |
| `src/services/documentIntelligence/ragStore.js` | 已有本地 RAG 索引（`ragIndex`），用于"对话当前文档" | **不替换**，新远程 KB 与本地 RAG 并存；让 sendPipeline 的 retrieval 阶段决定走哪条 |
| `src/services/sendPipeline/{intentRouter,chatFlow,documentFlow,assistantFlow}.js` | 发送链路已经按"意图 → flow"分层 | KB 检索作为 flow 中的 **retrieval middleware** 注入，**不改动消息核心结构**，只丰富 system prompt 和气泡的"sources"字段 |
| `src/utils/host/opfsStorage.js` + `chatCompletionWithShadow.js` | 主机层有 OPFS、限速、撤销、影子对话 | 凭据加密落 OPFS；KB 检索/对话都走 host.rateLimiter 防止滥用 |

### 0.2 chayuan-server（FastAPI + LangChain）

| 模块 | 现状 | 与本方案关系 |
|---|---|---|
| `kb_routes.py:415` `GET /knowledge_base/list_knowledge_bases` | 列表带 ACL 过滤 | 直接复用 |
| `kb_routes.py:701` `POST /knowledge_base/search_docs` | 单次向量检索（top_k + score_threshold + 文件名 + metadata 过滤） | 主力检索接口 |
| `kb_routes.py:727` `POST /knowledge_base/hybrid_search` | SSE 流式：plan → hyde → route_start → fuse → rerank → results → done | 给"分批分段搜索"提供进度反馈，前端可消费用作"思考过程" UI |
| `kb_routes.py:342` `POST /knowledge_base/{mode}/{param}/chat/completions` | OpenAI 兼容的 KB 对话（自动拼 retrieval + LLM）；带语义缓存 | 备选：直接服务端做 retrieval+answer；本方案默认 **客户端拼装**（让用户的本地大模型做总结），保留这个接口给"完全云上"模式 |
| `kb_routes.py:1052` `GET /knowledge_base/download_doc` | 下载/预览原文 | 知识清单里"附件下载"链接的 URL 模板 |
| `kb_routes.py:1411` `GET .../build_progress/{task_id}` SSE | 任务进度 | 后续大文件入库可复用 |
| `auth_routes.py` | JWT 登录 / cookie + Bearer + 刷新 token | 对应"用户名/密码"模式 |
| `openapi_routes.py:120` `x-app-id` / `x-timestamp` / `x-sign`（HMAC） | 已有 OpenAPI 签名鉴权 | 对应"APPID + AppKey/AppSecret"模式 |
| `kb_universe_routes.py`（已存在） | 把多 KB 组织为 universe（树/分组） | 树形展示数据源 |
| `auth/access.py` `list_accessible_kbs` | 按用户/可见性/grant 算可见列表 | 树形 UI 直接消费 |
| `resilience.py` `semcache_get/set` | 基于 Redis 的语义缓存 | 高并发命中加速；本方案的 search_batch 也接入 |

**结论**：后端 80% 接口已经在，**本方案的服务端工作集中在 1) 一个面向"圈段批量检索 + 信任度评分"的聚合接口；2) 把 OpenAPI 签名扩到 KB 路由白名单；3) 限速、配额、并发。**

---

## 1. 总体架构

### 1.1 数据/调用流

```text
┌──────────────────── WPS 加载项 (chayuan) ────────────────────┐
│                                                              │
│  SettingsDialog                AIAssistantDialog              │
│  └─知识库设置(新)              ├─选择知识库(新, 树形)          │
│    ├─URL/账号/密码                ├─发送时 retrieval-middleware  │
│    └─APPID/AppKey                 └─气泡顶部 sources 折叠条     │
│         │                                  │                  │
│         ▼                                  ▼                  │
│  services.kb (新模块, 见 §3.1)                                 │
│  ├─connectionStore   (凭据加密落 OPFS)                         │
│  ├─authClient        (双模:JWT / HMAC)                         │
│  ├─kbCatalog         (列表/树形/缓存)                          │
│  ├─searchOrchestrator(分批分段+并发+去重+证据评分)              │
│  ├─attachmentClient  (下载链接拼装+短期 token)                 │
│  └─healthProbe       (连通性测试)                              │
│         │                                                      │
│         └──向 services.sendPipeline.kbRetrievalMiddleware 注入  │
│             检索结果 → 拼 system prompt → 调本地 LLM           │
└────────────────────────┬─────────────────────────────────────┘
                         │  HTTPS (双模鉴权)
                         ▼
┌──────────────────── chayuan-server ──────────────────────────┐
│                                                              │
│  middleware.py     ──> 双模鉴权:                              │
│                       JWT Bearer(已有) | OpenAPI HMAC(扩白名单) │
│                  ──> RateLimiter(已有)+ KB 专用配额(新)       │
│                                                              │
│  kb_routes.py     /list_knowledge_bases       (复用)          │
│                   /list_files                  (复用)         │
│                   /download_doc / preview_doc  (复用)         │
│                   /search_docs                 (复用)         │
│                   /hybrid_search   (SSE 进度)  (复用)         │
│                   /search_batch    (新, §4.1)  ←━━━━━━━━━━━━━━┓│
│                   /search_batch_stream (SSE)   (新, §4.2)    ┃│
│                                                              ┃│
│  knowledge_universe_routes.py /tree            (复用/微调)    ┃│
│                                                              ┃│
│  shared/app_signing.py + openapi_deps.py 现仅服务 /openapi/* ┃│
│  → 把 KB 路由组扩入 HMAC 接受白名单(opt-in via header)        ┃│
│                                                              ┃│
│  resilience.semcache + Redis  (复用,语义缓存)                  ┃│
│  ingest_queue (Arq) 复用,新增 search_batch 排队回退          ┃│
└──────────────────────────────────────────────────────────────┘
                         │
                         ▼
                ┌─────────────────────┐
                │ Vector Store        │  Milvus / PGVector / FAISS / Chroma
                │ + KB metadata DB    │  (Postgres / SQLite)
                │ + Redis (cache+job) │
                │ + Object storage    │  (Local / MinIO)
                └─────────────────────┘
```

### 1.2 设计原则

1. **接口最小化、流式优先**：一切批量/检索/SSE，避免长阻塞 + 浏览器超时。
2. **客户端不存秘文**：APPID/AppSecret 等敏感串以 AES-GCM + 设备绑定密钥（OPFS-derived）落 OPFS；导出 / 重启需重新解密。绝不写 localStorage 明文。
3. **答案与证据分离**：本地大模型只接收"知识片段(text + 元数据 + 引用 id)"，最终答案中通过 `[^c1]` `[^c2]` 标注引用 id；前端把引用 id 还原为可点击的证据卡。**不让大模型自己拼链接**，避免幻觉链接。
4. **可证伪 → 才能可信**：每条引用必须有 `kb_name + file_name + chunk_id + score + page/section`，UI 卡片可一键打开/下载原文，做到"AI 说 → 我验"。
5. **复用胜于重造**：服务端 90% 已有，主战场是前端 + 一个聚合 endpoint。
6. **降级链路**：远程 KB 不通 → 自动回落到本地 ragIndex（如有），并在气泡上明示"未连接到知识库"。

---

## 2. UI / UX 详细设计（贴合需求 1–8）

### 2.1 设置 → 数据设置 → 知识库设置（需求 1、2、3）

**位置**：`SettingsDialog.vue` `generalSubMenus` 增加 `{ key: 'kb', label: '知识库设置', icon: '📚' }`；右侧第三列在 `activeMainMenu === 'general' && activeSubMenu === 'kb'` 时渲染新组件 `<KbSettingsPanel />`（**新建独立 SFC**，避免再往 8937 行的祖传文件里塞代码）。

**布局（单连接 → 多连接 兼容版）**：

```
┌ 知识库设置 ────────────────────────────────────────┐
│  连接列表 [+新增]                                  │
│  ┌──────────────────────────────────────────────┐ │
│  │ ● 总部知识中心  api.kb.acme.com   [✏️] [🗑️] │ │
│  │ ○ 部门 KB     pri-kb.intra/...   [✏️] [🗑️] │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  当前连接：总部知识中心                             │
│  ┌─ 基本信息 ────────────────────────────────────┐ │
│  │ 名称       [总部知识中心        ]             │ │
│  │ 服务地址   [https://kb.acme.com ] [测试连通]  │ │
│  │ 鉴权方式   ● 用户名密码  ○ APPID/APPKEY       │ │
│  │   [用户名]   [密码 ●●●●●●]                  │ │
│  │   ─或─                                         │ │
│  │   [APPID  ]  [APPKEY/AppSecret ●●●●●●]        │ │
│  │ 连接状态   ✅ 已连通  延迟 87ms  v0.3.6        │ │
│  └────────────────────────────────────────────────┘ │
│                                                    │
│  ┌─ 知识库清单（树形）───────────────────────────┐ │
│  │ ▾ 全部知识库                                   │ │
│  │   ▾ 📂 法务（2）                               │ │
│  │     · 合同模板库      Milvus  56 文件           │ │
│  │     · 法规速查        FAISS   1.2k 文件         │ │
│  │   ▾ 📂 工程                                    │ │
│  │     · 设计规范        PGVector 312 文件         │ │
│  │     · API 文档        Chroma   78 文件          │ │
│  │ [刷新] [按 universe 分组 ✓]                    │ │
│  └────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

**关键交互**：

* "测试连通"：调用 `services.kb.healthProbe.run({ url, auth })`，背后：
  1. `GET /healthz`（无鉴权，看服务在不在）
  2. `GET /auth/me`（JWT）或 `POST /openapi/ping`（HMAC）→ 验凭据
  3. `GET /knowledge_base/list_knowledge_bases?limit=1` → 验 KB 权限链路
  - 三步聚合状态：**地址 / 凭据 / 知识库**，每步独立给出 ✅ ⚠️ ❌ + 中文文案。失败要把 HTTP code、`request_id` 一并展示，便于运维。
* "新增连接"：弹一个抽屉，与基本信息表单同字段；保存时调一次 `healthProbe.run`，全绿才允许保存。
* "保存"：把连接数据 deep-clone 后**先加密再写 OPFS**（key 派生自 `chayuan-device-secret`，详见 §3.2.4）。
* 树形清单：列表来自 `kbCatalog.fetchTree()`，按 `kb_universe` 分组；如服务端没分组返回则 fallback 到 "全部"。每行 hover 显示 `vector_store / file_count / size / updated_at` tooltip。
* **多连接**：先做"单连接"，组件结构按"列表 + 当前选中"实现，预留多连接扩展接口；不在 v1 暴露多连接 UI（需求 1 没明说）。但数据模型从一开始就是数组。

### 2.2 察元 AI 助手 → 选择知识库（需求 4）

**位置**：替换 `AIAssistantDialog.vue:1925-1947` 的占位弹窗。

```
┌ 选择知识库 (来自:总部知识中心)  [⚙ 切换连接]   [✕]┐
│  搜索 [_______________]                            │
│  ┌────────────────────────────────────────────────┐│
│  │ ☐ ▾ 全部                                       ││
│  │   ☐ ▾ 法务                                     ││
│  │     ☑   合同模板库   Milvus  56          [👁] ││
│  │     ☐   法规速查     FAISS   1.2k        [👁] ││
│  │   ☐ ▾ 工程                                     ││
│  │     ☐   设计规范     PGVector 312        [👁] ││
│  └────────────────────────────────────────────────┘│
│  已选:1 个                                          │
│  检索策略:[向量+BM25 混合]  Top-K:[6 ▾]            │
│  [取消]                              [应用到对话]  │
└────────────────────────────────────────────────────┘
```

**关键交互**：

* **多选 + 树形**（需求 4 明确"树形"），勾选父节点 = 勾全部子节点。
* 选择后回写到 currentChat 的 `kbBindings: { connectionId, kbNames: [], topK, hybrid }`，并在输入框下挂一个**绿色徽章**"📚 已绑定 法务/合同模板库（+1）"。
* 不切换知识库就保持上一次绑定（按 chatId 持久化），新建对话默认沿用上一次。
* 没配置任何连接时，整个弹窗变成"前往设置"引导。

### 2.3 选段/全文 → 去 KB 检索（需求 5）

**触发方式**（三入口，全部走同一个 service）：

1. **右键菜单**：在文档选区右键 → "知识库检索本段" / "知识库核对本段"。
2. **Ribbon 按钮**：选区/全文激活时点击 "📚 KB 核对"。
3. **对话框内手动**：在输入框点 "📎+知识库" 把当前选区作为 query 发去检索。

**触发后行为**（**不直接发给大模型**）：

```
selection (text)
   │
   ▼
services.kb.searchOrchestrator.run({
  query: text,
  kbBindings,
  mode: 'qa' | 'verify' | 'summarize',  // 三种"任务模板"
})
   │
   ├── 1) 切片(见 §3.3) → N 个子查询
   ├── 2) 对每个子查询:
   │      a. 命中本地 LRU? → 直出
   │      b. 否则并发调 /search_docs（受令牌桶限速）
   │      c. SSE 进度回灌输入框上方"思考过程"小条
   ├── 3) 跨子查询去重 + 重排 + 信任度评分(§3.4)
   ├── 4) 包装为 messageMeta.kbSources[]
   └── 5) 调 sendPipeline.{chat|document|assistant}Flow,
         附带 system prompt + sources，再走本地 LLM
```

### 2.4 引用气泡（需求 7、8）

气泡顶部新增一条**横线 + 折叠条**（独立子组件 `KbSourceStrip.vue`）：

```
─────────────────────────────────────────────────────
▸ 📚 引用了 5 条知识  ·  来自 法务/合同模板库  ·  平均可信度 0.82
─────────────────────────────────────────────────────
（默认折叠，点 ▸ 展开）
─────────────────────────────────────────────────────
▾ 📚 引用了 5 条知识  ·  来自 法务/合同模板库  ·  平均可信度 0.82
─────────────────────────────────────────────────────
[c1] 0.91 ★★★★☆   合同模板.docx  §3.2 第 4 段        [📎下载]
     "甲方应在签订之日起 30 日内……"
[c2] 0.84 ★★★★☆   合同模板.docx  §3.2 第 5 段        [📎下载]
     "如发生违约，违约金按总价的 2% 计……"
[c3] 0.71 ★★★☆☆   法规速查.pdf   §第 12 条           [📎下载]
…
─────────────────────────────────────────────────────
答案正文（含 [^c1] [^c3] 上标，hover 高亮对应卡片）
```

* 气泡正文里 `[^cN]` 是引用占位符，前端 markdown 渲染器把它替换成 `<sup class="kb-cite" data-id="cN">cN</sup>`，hover 时高亮上方对应卡片。
* 每条卡片"📎下载"= `services.kb.attachmentClient.buildDownloadUrl(source)` →
  `${baseURL}/knowledge_base/download_doc?knowledge_base_name=...&file_name=...&token=<short-lived>`（JWT 模式下走 `query-token` 白名单，HMAC 模式重新签名一遍）。
* 折叠状态/展开状态写在 messageMeta 上，刷新对话能保留。

---

## 3. 前端模块设计

### 3.1 services.kb 子树（落在 `chayuan/src/services/kb/`）

```
src/services/kb/
├── index.js                  // 聚合导出 + 注入 services.kb.*
├── connectionStore.js        // 多连接 CRUD + 当前连接 + 监听器
├── connectionCipher.js       // 凭据 AES-GCM + 设备绑定 key 派生
├── authClient.js             // 双模:JwtAuth / HmacAuth，统一 fetch 包装
├── kbCatalog.js              // /list_knowledge_bases + /universe 树形
├── kbCatalogCache.js         // ETag / If-None-Match + TTL LRU
├── healthProbe.js            // 连通性三步聚合
├── attachmentClient.js       // download URL 拼装 / 短 token 续签
├── searchOrchestrator.js     // 入口:run({ query, kbBindings, mode })
├── queryPlanner.js           // 四层漏斗 T1/T2/T3/T4 总入口(§3.2.5)
├── splitters.js              // T1/T2:结构/段落/句滑窗 + 自适应归并
├── clusterer.js              // T3:本地小 embedding + 层次聚类
├── localDistiller.js         // T4:本地 LLM batch 蒸馏检索短语
├── searchClient.js           // /search_docs + /search_batch + 重试
├── credibilityScorer.js      // 多信号融合给出 0..1 可信度
├── deduper.js                // 跨批次 chunk 去重 + 同源段合并
├── retrievalMiddleware.js    // 给 sendPipeline 用的 hook
├── promptBuilder.js          // 三种 mode (qa/verify/summarize) 的 prompt
└── __tests__/                // 单测
```

**与 `services/index.js` 的接驳**：在 `services.kb = { connection, catalog, search, attachment, health }` 暴露；`services.documentIntelligence.ragStore` 不动，`services.kb` 是远程线，未来再统一抽象 `RetrievalProvider` 接口。

### 3.2 关键模块细节

#### 3.2.1 connectionStore.js

数据形态：
```js
{
  version: 1,
  current: 'conn-uuid-xxx',
  list: [{
    id: 'conn-uuid-xxx',
    name: '总部知识中心',
    baseUrl: 'https://kb.acme.com',
    authMode: 'jwt' | 'hmac',
    jwt: { username, ciphertext_password, accessToken?, refreshToken?, expAt? },
    hmac: { appId, ciphertext_appSecret },
    healthSnapshot: { okAt, latencyMs, kbCount, version },
    createdAt, updatedAt
  }]
}
```

落地点：`chayuan-settings` 这个 OPFS 文件，namespace 用 `kbConnections`。

#### 3.2.2 authClient.js

```js
// 统一签名:auth.fetch(path, { method, body, headers })
// JWT  : 自动加 Authorization: Bearer <access>;401 自动 refresh 一次
// HMAC : 按 chayuan-server openapi 现有约定
//        x-app-id, x-timestamp, x-sign = base64(HMAC-SHA256(secret, ts + body))
//        body 必须为 stringified JSON(空体用 "{}")
//        headers + body 严格一致才不签错
```

参考 `chayuan-server/api_server/openapi_routes.py:120` 的入参顺序：必须 `app_id + ts + body_bytes`，已经 verified 过。

#### 3.2.3 healthProbe.js

```
step1: GET /healthz       -> ok/latency
step2: 按 authMode:
        jwt  -> POST /auth/login, 用得到的 access 再 GET /auth/me
        hmac -> POST /openapi/ping (现有), HMAC 签
step3: GET /knowledge_base/list_knowledge_bases?limit=1
返回 { ok, steps: [{ name, ok, latency, error?, requestId }] }
```

避免一次性大请求；任何一步失败立刻短路返回。

#### 3.2.4 connectionCipher.js（凭据加密）

```
deviceKey = HKDF(
  ikm: SHA-256(navigator.userAgent + screen.size + opfs/'.chayuan-salt'),
  info: 'chayuan-kb-cipher-v1'
)
密钥永不写 OPFS,永不出进程;每次启动重派生一次。
encrypt(plaintext) = AES-GCM(deviceKey, randomIv12, plaintext)
存储格式: base64(iv) + ':' + base64(ciphertext)
```

副作用：换设备后凭据需重新输入，**这是 feature 不是 bug**（不希望凭据随 OPFS 复制泄露）。

#### 3.2.5 queryPlanner.js（需求 6 的核心：长文检索的"四层漏斗"）

输入：`text`（几十字的选区 / 几千字的段 / 10 万字的全文）+ `mode` (`qa` / `verify` / `summarize`) + `budget`（最终子查询数硬上限）。

##### 3.2.5.1 为什么不能"按段切"或"按字数切"了之

| 单一方案 | 为什么不行 |
|---|---|
| **整段 1 个 embedding** | 嵌入模型 token 上限 512–8k；超出截断；即使没截，长文向量"取平均"→ 主题被稀释，召回崩盘（RAG 第一坑） |
| **固定字符滑窗（如 500/50）** | 切到句中、跨章节，语义破碎；10 万字 = 200+ 查询，全打过去既慢又噪声盖过信号 |
| **纯段落切** | 段落长度方差极大（一句话 vs 几百字）；短段不成查询、长段又稀释；遇到 PDF→TXT 那种无空行的退化为 1 个超长段 |
| **纯句子切** | 单句缺上下文，命中全是泛化同义；查询数爆表 |

**根因**：检索质量 ∝ "查询短语的语义密度"。10 万字直接嵌入 = 一锅粥；切太细 = 每勺都没味道。**必须分层组合**。

##### 3.2.5.2 四层漏斗

```
Tier 1  结构切分  (无 LLM, O(N) 字符扫描)
        优先 H1/H2/H3 / Markdown heading
        退化:按 \n\n+ 段落
        再退化:按句子 (中文 。！？；) 滑窗
        输出 N 个 unit
            │
            ▼
Tier 2  自适应归并  (无 LLM)
        短 unit (<120 字) 与相邻同级合并
        长 unit (>800 字) 用句子滑窗再切;窗口 400 字 / overlap 80
        目标长度区间 [200, 600]
        输出 M 个 passage
            │
            ▼
Tier 3  语义聚类去冗  (本地小 embedding, 如 bge-small 384 维)
        余弦相似度 > 0.85 视为重复主题;层次聚类成 K 簇
        K = min(budget, ceil(M / 5))
        输出 K 个 cluster
            │
            ▼
Tier 4  LLM 查询蒸馏  (本地 LLM, 一次 batch prompt 出 K 组)
        对每簇喂代表性 passage,要求 LLM 输出 1–3 条
        "8–30 字的检索短语 + mode 标签"
        输出 Q 条最终 query (Q ≤ budget)
```

##### 3.2.5.3 按文本长度自动选档（硬预算表）

| 长度 | 启用层 | 子查询数上限 | 总耗时目标 (P95) | 备注 |
|---|---|---|---|---|
| ≤ 200 字 | T1 | **1** | < 600ms | 服务端 HyDE 扩写 |
| ≤ 800 字 | T1+T2 | **≤ 4** | < 1s | 句滑窗 |
| ≤ 4 000 字 | T1+T2 | **≤ 10** | < 1.5s | 段落 |
| ≤ 20 000 字 | T1+T2+T3 | **≤ 16** | < 2.5s | 聚类后跳过蒸馏 |
| ≤ 100 000 字 | T1+T2+T3+T4 | **≤ 24** | < 4s | 强制蒸馏 |
| > 100 000 字 | 全启 + 多轮 | ≤ 32（≤ 16/轮） | 流式增量 | 分轮发送，UI 渐进展示 |

**为什么是 24 而不是 200**：实测 RAG 拼 prompt 给 8k 模型，每条 chunk ≈ 300 字 × Top-12 ≈ 3 600 字，加上指令和原文已吃满；再多 chunk 反而被噪声淹没，答案质量下降。**多查询 → 聚合后只留 Top-K**，K 才是真瓶颈。

##### 3.2.5.4 三种 mode 的差异（重要 — 长文 verify 必读）

| 模式 | 切分关注点 | 蒸馏指令 | 结果回灌 |
|---|---|---|---|
| **qa** | 用户输入通常短；若长，提取核心问题 | "把这段里用户真正想问的 1–3 个问题列出来" | 全局 Top-K → 一次答 |
| **verify** | 必须**全覆盖**，按段保留 tag | "提取这段所有可被知识库证实/证伪的事实声明" | **按 section 分别核对**，最终汇总不一致项 + 一致率 |
| **summarize** | 按主题聚类，保留覆盖度 | "这段需要从知识库补充的 1–2 个查询词" | Map-reduce：每簇局部总结 → 全局合并 |

verify 模式尤其关键：10 万字核对结果必须告诉用户**第几段第几句不一致**，所以子查询的 `tag = section_id`、`sectionIds = [unit_id, ...]` 必须**一路保留**到 UI（聚类只去 query 重复，不去 section 关联）。

##### 3.2.5.5 算法骨架

```js
async function plan(text, mode, budget = 24) {
  // T1
  let units = splitByStructure(text)
        || splitByParagraph(text)
        || splitBySentenceWindow(text, 400, 80)

  // T2
  units = mergeShort(units, minLen=120)
  units = splitLong(units, maxLen=800, window=400, overlap=80)

  if (units.length <= 4) {
    return units.map((u,i) => ({ tag:`u${i}`, sectionIds:[i], text:u.text, weight:1 }))
  }

  // T3:本地小 embedding(384 维) + 层次聚类
  const embs = await localEmbed(units.map(u => u.text))
  const clusters = hierarchicalCluster(embs, simThreshold=0.85,
                                       maxK=Math.min(budget, Math.ceil(units.length/5)))

  // 中等长度可跳过蒸馏:每簇直接选代表段做 query
  if (units.length * 1 <= 20_000 /* chars */) {
    return clusters.flatMap(c => {
      const rep = pickRepresentative(c, units)  // 最长 + 最居中
      return [{
        tag: `c${c.id}`, sectionIds: c.unitIds,
        text: rep.text.slice(0, 280),           // 截断保护
        weight: c.size / units.length,
      }]
    }).slice(0, budget)
  }

  // T4:LLM 蒸馏(批量 prompt,一次给所有簇,省 K-1 次 RTT)
  const reps = clusters.map(c => pickRepresentatives(c, units, 2))
  const distilled = await localLlmDistillBatch(reps, mode, /*maxPhrasesPerCluster*/ 3)

  const queries = []
  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i]
    for (const phrase of distilled[i].phrases) {
      queries.push({
        tag: `c${c.id}`,
        sectionIds: c.unitIds,
        text: phrase,
        weight: c.size / units.length,
      })
      if (queries.length >= budget) return queries
    }
  }
  return queries
}
```

复杂度：T1/T2 O(N) 字符扫描；T3 O(M²) 但 M < 500 可接受；T4 是 LLM 调用，真正大头 — 所以 **T4 仅在 > 4 000 字时启用**，且 batch prompt 一次出 K 组短语（不是 K 次 RTT）。

##### 3.2.5.6 工程边界与坑位

1. **蒸馏短语 ≠ 摘要**。蒸馏目标是召回友好的检索词（含关键实体、专有名词、条款号），不是给人读的；prompt 必须明示"输出可以直接喂搜索引擎的短语，不要写完整句子，不要泛化"。
2. **`sectionIds` 一路保留到 UI**。每条返回 chunk 带 `from_query_tags + from_section_ids`，折叠卡片可告诉用户"这条证据是支撑你原文第 3 章 / 第 12 段"。verify 模式没这个串联就废了。
3. **聚类阈值 0.85 经验值**。太高 → 几乎不去重，查询数爆；太低 → 不同主题被合并，召回缺失。可在设置里露 `kb.advanced.clusterSimThreshold`，默认 0.85，区间 [0.78, 0.92]。
4. **嵌入模型分两套**：T3 的本地小 embedding 不必和 KB 服务端同款 — T3 只判同去冗，384 维小模型即可（如 `bge-small`，可走 ollama / web-llm / wasm），T4 的查询语义匹配交给服务端正式 embedding。
5. **蒸馏失败兜底**：本地 LLM 不在 / 超时 / JSON parse 失败 → 退到 T3 同款"取代表段前 280 字作 query"，比不查好。
6. **流式反馈**：> 10 万字时 plan 阶段可能 5s+，UI 必须分阶段反馈：`splitting → clustering → distilling (3/8) → searching → reranking`。这一路状态从 queryPlanner 通过 `emit()` 透出，正好接 §4.2 的服务端 SSE 帧形成"端到端思考过程"。
7. **Worker 化**：T1/T2 字符扫描和 T3 聚类放进 `chayuan/src/workers/`，避免在 10 万字时阻塞主线程造成 WPS 卡顿。
8. **重复触发去重**：用户连续两次对同一段文本触发检索 → 用 `signature = sha1(normalizedText + mode + budget)` 命中前一次的 query plan + 结果 LRU，不重新蒸馏。

#### 3.2.6 searchOrchestrator.js（核心调度）

> 注意：v1 起 **整批走服务端 `/search_batch`**（§4.1），客户端不再循环 `/search_docs`。客户端 pLimit 仅在服务端旧版兜底时启用。

```js
async run({ query, kbBindings, mode = 'qa', signal, budget }) {
  // T1–T4 切分(已透出 splitting/clustering/distilling 进度帧)
  const queries = await queryPlanner.plan(query, mode, {
    budget: budget ?? autoBudget(query.length),
    onPhase: (p, info) => emit('plan_phase', { phase: p, ...info }),
    signal,
  })
  emit('plan_done', { count: queries.length, queries: queries.map(q => q.text) })

  // 整批级签名缓存(避免同段重复触发)
  const sig = sha1(JSON.stringify({ queries, kbs: kbBindings.kbNames, mode }))
  const cached = batchLru.get(sig)
  if (cached) { emit('cache_hit'); return cached }

  // 单次 RPC: /search_batch(SSE 版可消费 query_done 帧)
  const limiter = host.rateLimiter.acquire('kb-search')
  await limiter.wait()
  const resp = await searchClient.searchBatch({
    queries,                            // [{tag, sectionIds, text, weight}]
    knowledge_base_names: kbBindings.kbNames,
    top_k_per_query: 6,
    score_threshold: 0.3,
    use_hybrid: true,
    use_rerank: true,
    merge_strategy: 'rrf',
    dedup_by: 'chunk_id',
    signal,
    onFrame: (f) => emit(f.type, f),    // 透传 plan/query_done/rerank
  })

  // 跨批次再去一遍重(服务端已 dedup_by=chunk_id,这里只为兜底)
  const merged = deduper.merge(resp.merged, queries)

  // 信任度评分 + Top-K 裁剪
      } catch (e) {
        emit('batch_error', { i, error: e.message })   // 单批失败不致命
      }
    })
  const ranked = credibilityScorer.score(merged, { query, mode, queries })
  const final = ranked.slice(0, FINAL_TOP_K)

  // verify 模式:按 sectionId 二次分桶,UI 渲染"按段核对结果"
  const result = mode === 'verify'
    ? { chunks: final, bySection: groupBy(final, c => c.from_section_ids) }
    : { chunks: final }

  batchLru.set(sig, result, 5 * 60_000)
  emit('done', { kept: final.length, dropped: merged.length - final.length })
  return result
}
```

整体超时 20s、`/search_batch` 单次超时 8s、AbortController 一停全停。

**旧版服务端兜底**：检测到 `/search_batch` 返回 404 → 自动退化为客户端 `pLimit(4)` 循环 `/search_docs`，逐 query 串通同样的字段（`tag`/`sectionIds`），UI 表现一致，仅 `did_fallback: true` 标记打到日志。

#### 3.2.7 credibilityScorer.js（需求 7：可信度）

可信度是**多信号融合**，不是单看向量分。每个 chunk：

```
trust = w1·norm(score)            // 向量分 / rerank 分
      + w2·titleHit                // chunk 所在文件名/标题命中 query 关键词
      + w3·sectionHit              // chunk 元数据 section_path 命中
      + w4·queryRecall             // chunk 文本对原 query 的 char-n-gram 召回率
      + w5·sourceQuality           // KB 自带 metadata.confidence(可选)
      + w6·crossBatchAgreement     // 同一 chunk 被多个子查询命中 → 加权
      − p1·staleness               // updated_at 距今越久越扣
权重 w*, p* 可在设置里露出"高级配置";默认 0.4/0.1/0.1/0.2/0.1/0.1/0.05
```

最终归一到 [0, 1]，再分桶：
* `0.85+ ★★★★★`、`0.7+ ★★★★☆`、`0.55+ ★★★☆☆`、`0.4+ ★★☆☆☆`、`其余 ★☆☆☆☆`。

**这个分数是给 UI 展示用的**；更重要的是它会作为 chunk 排序依据 + LLM prompt 中"参考时优先 X 条"的明示信号。

#### 3.2.8 promptBuilder.js（喂给 LLM 的关键，需求 7 的"分析总结"）

三种模板（mode）：

**a) 知识问答 (qa)** — 让 LLM 回答用户问题
```
你是基于知识库的助手。下面是检索到的若干"知识片段",
请只用这些片段回答问题;遇到不足以回答的部分,请明确说"知识库未覆盖"。
回答时,**必须在每个事实结尾用 [^c<id>] 标注来源**;不要编造来源 id。

【片段】
[c1] (kb=合同模板库, file=合同模板.docx, sec=§3.2, score=0.91)
甲方应在签订之日起 30 日内……
[c2] (kb=合同模板库, file=合同模板.docx, sec=§3.2, score=0.84)
如发生违约……

【问题】
{user_query}
```

**b) 内容核对 (verify)** — 给定原文段，让 LLM 对比知识库判断是否准确
```
任务:核对下面"待核对原文"是否与"知识库片段"一致。逐句给出:
- 一致(✓) / 不一致(✗) / 未覆盖(?)
- 不一致时,引用 [^cN] 给出依据并写出"应为 …"
- 末尾给整体一致率(%)。

【待核对原文】 {selection}
【知识库片段】 [c1]…[c2]…
```

**c) 知识总结 (summarize)** — 把检索到的多个片段总结为新内容
```
请把以下知识片段整理为一篇结构清晰的中文总结,
- 用 H2/H3 章节
- 每个事实后用 [^cN] 标注来源
- 末尾给"参考清单"段落,引用全部使用过的 [c*]。
不要凭空补充未在片段中出现的信息。
【片段】 …
```

**关键 prompt 设计要点**：
1. **强约束 citation 必现** — 否则前端找不到 hover 锚点；如果模型不听话，前端会自动把"未引用句"打灰显示告警。
2. **明确说"知识库未覆盖"** — 防止模型 hallucinate 兜底答案。
3. **片段元数据进 prompt 但不进答案** — 答案只出现 `[^cN]`；下载链接/路径只在 UI 卡片，绝不让模型生成 URL。

#### 3.2.9 retrievalMiddleware.js（接进 sendPipeline）

```js
// 在 sendPipeline.intentRouter 解析出 intent 后,
// 由 chatFlow / documentFlow / assistantFlow 调用:
export async function applyKbRetrievalIfBound(ctx) {
  const binding = ctx.chat?.kbBindings
  if (!binding?.kbNames?.length) return ctx              // 未绑 KB 直通
  const sources = await services.kb.search.run({
    query: ctx.kbQueryText || ctx.userMessage.content,
    kbBindings: binding,
    mode: ctx.kbMode || 'qa',
    signal: ctx.abortSignal,
  })
  if (!sources.length) return ctx                        // 0 命中 → 也明示
  const sysPrompt = services.kb.promptBuilder.build({
    mode: ctx.kbMode || 'qa',
    sources,
    userQuery: ctx.userMessage.content,
  })
  ctx.messagesForApi = [
    { role: 'system', content: sysPrompt },
    ...ctx.messagesForApi.filter(m => m.role !== 'system'),
  ]
  ctx.assistantMessageMeta.kbSources = sources           // 给气泡 UI 用
  ctx.assistantMessageMeta.kbBatchPlan = ctx._kbPlan     // 给"思考过程"用
  return ctx
}
```

接入位置（不改 chatFlow 主路径）：在 `chatFlow.buildChatFlowRequestContext` 后、调模型前加一句 `await retrievalMiddleware.applyKbRetrievalIfBound(ctx)`。`documentFlow` / `assistantFlow` 同位置加。

---

## 4. 后端（chayuan-server）改动

> 后端绝大多数已就绪，本节只列**新增 / 微调**。

### 4.1 新增：`POST /knowledge_base/search_batch`（需求 6 + 9 的核心）

**为什么不直接让前端循环调 `/search_docs`**：
1. 前端循环 N 次 = N 次 HTTP 往返、N 次鉴权、N 次 LLM 嵌入；
2. 服务端可以一次性 batch embedding，向量库一次 multi-query；
3. 服务端可以共享 query 计划缓存、语义缓存、限速桶；
4. 流量收敛，前端 1 个 SSE/HTTP 即可；监控/限流也好做。

**接口契约**：

```
POST /knowledge_base/search_batch
Headers:  Authorization: Bearer ...   (或 x-app-id/x-timestamp/x-sign)
Body:
{
  "queries": [
    {
      "tag": "c3",                    // 客户端给的批次标识(必填,建议用簇 id)
      "text": "违约金 30 日 履约期限",   // 真正的检索短语(蒸馏后)
      "weight": 0.8,                  // 簇大小占比,影响 RRF/加权融合
      "section_ids": ["u12","u13"]   // 此查询源自原文哪些段(可选,verify 必填)
    },
    ...
  ],
  "knowledge_base_names": ["合同模板库", "法规速查"],
  "top_k_per_query": 6,
  "score_threshold": 0.3,
  "use_hybrid": true,
  "use_rerank": true,
  "merge_strategy": "rrf",            // rrf | weighted | max
  "dedup_by": "chunk_id",
  "final_top_k": 12,
  "include": ["text", "metadata", "score"],
  "request_id": "..."                 // 客户端透传便于排查
}

// 硬约束(超出直接 400):
//   queries.length        ≤ 32          (对齐 §3.2.5.3 的最大档)
//   每条 text.length       ≤ 4 000       (蒸馏后通常 ≤ 30 字,这是兜底)
//   sum(text.length)       ≤ 24 000      (限总 token,防滥用)
//   knowledge_base_names   ≤ 8           (单次跨 KB 数)

Response 200:
{
  "code": 0,
  "data": {
    "request_id": "...",
    "took_ms": 432,
    "queries": [
      {
        "tag": "c3",
        "section_ids": ["u12","u13"],
        "kb_hits": [{ "kb": "合同模板库", "count": 6, "took_ms": 87 }],
        "errors": []                  // 单查询失败不致命,记在这里
      }
    ],
    "merged": [
      {
        "chunk_id": "...",
        "text": "...",
        "metadata": { "source": "...", "page": 4, "section_path": [...] },
        "kb_name": "合同模板库",
        "file_name": "合同模板.docx",
        "score": 0.91,
        "rerank_score": 0.93,
        "from_query_tags": ["c3","c7"],         // 跨查询共现 → 信任度加权
        "from_section_ids": ["u12","u13","u20"],// 串到原文 → verify UI 锚点
        "download_token": "<short-lived signed>"
      },
      ...
    ],
    "summary": {
      "total_unique": 14,
      "after_top_k": 12,
      "rerank_applied": true,
      "fallback_no_rerank_reason": ""          // rerank 失败原因(可空)
    }
  }
}
```

**关键设计：`tag` 和 `section_ids` 严格不丢**。`tag` 是客户端 queryPlanner 给的批次 id（`c3` 表第 3 簇）；`section_ids` 表这个查询源自原文哪些 unit；服务端**不解析、不修改**这两个字段，仅在融合时把跨查询命中合并为 `from_query_tags + from_section_ids` 数组返回。这条契约让 verify 模式能在 UI 上把"知识库证据"精确锚回到"用户原文第 X 段"。

**实现要点**（落在 `chayuan/server/file_rag/batch_search.py` 新模块 + `kb_routes.py:search_batch_endpoint`）：

```python
@kb_router.post("/search_batch")
async def search_batch_endpoint(body: SearchBatchIn, user=Depends(require_auth_enabled())):
    # 0. 入参硬约束(对齐前端 §3.2.5.3 budget)
    _validate_batch_limits(body)                       # ≤32 queries / ≤24k 总字
    for kb in body.knowledge_base_names:
        _require_read(user, kb)                        # 复用现有 ACL

    # 1. semcache 整批级 hash 命中? 直接出
    cache_key = hash_canonical({
        "q": [q.text for q in body.queries],           # tag/section_ids 不入 cache key
        "kbs": sorted(body.knowledge_base_names),
        "k": body.top_k_per_query, "rerank": body.use_rerank,
        "hybrid": body.use_hybrid, "merge": body.merge_strategy,
    })
    cached = semcache_get(cache_key, user_id=_uid(user))
    if cached:
        return _attach_tags(cached, body.queries)      # tag/section_ids 不进 cache,出来再贴

    # 2. 批量 embedding(异步、单 round trip)
    embs = await embed_texts([q.text for q in body.queries])

    # 3. 对每个 (query, kb) 并发执行向量检索
    sem = asyncio.Semaphore(MAX_KB_PARALLEL)           # 默认 8
    tasks = [
        _search_one(qi, embs[qi], kb, body, sem)
        for qi in range(len(body.queries))
        for kb in body.knowledge_base_names
    ]
    raw = await asyncio.gather(*tasks, return_exceptions=True)

    # 4. 融合(RRF / weighted / max);保留 from_query_tags + from_section_ids
    merged = fuse_with_provenance(
        raw, body.queries,
        strategy=body.merge_strategy,
        dedup=body.dedup_by,
    )

    # 5. rerank(可选);用首查询作 anchor 还是用拼接 query 由 reranker 决定
    if body.use_rerank:
        try:
            merged = await rerank(_anchor_query(body), merged, top_k=body.final_top_k)
        except Exception as e:
            logger.warning("rerank failed, fallback: %r", e)
            merged = merged[: body.final_top_k]
    else:
        merged = merged[: body.final_top_k]

    # 6. 短期下载 token(30 分钟,复用 §4.5)
    for c in merged:
        c["download_token"] = sign_download(user, c)

    out = _build_response(body, merged, took_ms=...)
    semcache_set(cache_key, _strip_tags(out), ttl=300, user_id=_uid(user))
    return out
```

依赖现有：`file_rag.hybrid_progress` 的 fuse 函数（需扩 `fuse_with_provenance` 保留 tag）、`reranker/` 模块、`resilience.semcache_*`。

**新增辅助**：
* `fuse_with_provenance(raw, queries, ...)` — 在原 fuse 基础上为每个合并后的 chunk 累积 `from_query_tags = list(set(...))`、`from_section_ids = list(set(...))`。
* `_anchor_query(body)` — rerank 的 query：默认拼接所有 `text` 用 ` / ` 分隔，截到 256 字；可改为"权重最大簇的 query"。
* `_attach_tags / _strip_tags` — semcache 存的是与 tag 无关的"纯检索结果"，不同 plan 命中同样的 query 集合时仍能复用缓存。

### 4.2 新增：`POST /knowledge_base/search_batch_stream`（SSE 版）

逻辑同 4.1，但每个子查询/每步流式吐；**配合前端 queryPlanner 的 splitting/clustering/distilling 阶段**，端到端 6 阶段进度：

```
// 服务端阶段(本接口)
event: embed_done  data: { "count": 8, "took_ms": 41 }
event: query_start data: { "tag": "c3", "kb": "合同模板库" }
event: query_done  data: { "tag": "c3", "kb": "合同模板库", "count": 6, "took_ms": 87 }
event: fuse_done   data: { "total_unique": 14 }
event: rerank_done data: { "kept": 12, "took_ms": 124 }
event: results     data: { "merged": [ ... ] }     // 与 §4.1 同 schema
event: done        data: { "took_ms": 432 }
event: error       data: { "tag": "c5", "message": "..." }   // 单查询失败,不致命
```

复用 `kb_routes.py:hybrid_search_endpoint` 的 SSE 模板（`StreamingResponse(_event_stream(), media_type="text/event-stream")`）。

**前端 UI 进度条会拼接"客户端阶段 + 服务端阶段"**：

```
[1/6] 切分原文     splitting    (T1+T2)
[2/6] 主题聚类     clustering   (T3)
[3/6] 蒸馏检索词   distilling   (T4, 可选,本地 LLM)
[4/6] 向量化       embed_done   (服务端)
[5/6] 检索 + 融合   query_done * N + fuse_done
[6/6] 重排         rerank_done
```

10 万字场景下，前 3 阶段在客户端跑（~2-3s），后 3 阶段在服务端跑（~1-2s），用户在等待时一直有可见反馈，不会"卡 5 秒不动"。

### 4.3 双轨 ACL：用户态(JWT) + 应用态(HMAC)

> 这是整个权限模型的核心。**v1 必须做完才能上线**，否则要么所有 APP 看见 public KB（漏密），要么 KB 完全看不到（不可用）。

#### 4.3.1 模型概览

```
┌────────────── 主体 (Subject) ──────────────┐
│  Human User    ←─ JWT (chayuan_users)      │
│  Application   ←─ HMAC (chayuan_apps NEW)  │
│  Admin         ←─ role='admin' on either   │
└────────────────────────────────────────────┘
                     │
                     ▼
┌────────────── 客体 (Object) ───────────────┐
│  KnowledgeBase (knowledge_bases)            │
└─────────────────────────────────────────────┘
                     │
                     ▼
┌────────────── 动作 (Action) ───────────────┐
│  read   list / search / download           │
│  write  upload / update / reindex          │
│  own    delete kb / change visibility      │
└─────────────────────────────────────────────┘
```

| 维度 | User (JWT) | App (HMAC) |
|---|---|---|
| 鉴权 | Authorization: Bearer | x-app-id / x-timestamp / x-sign |
| 角色 | admin / user (+ owner 派生) | app（无 owner） |
| 凭据存储 | `users.password_hash` (bcrypt) | `chayuan_apps.app_secret_hash` (bcrypt) |
| 默认看 public KB | 是 | **否**（必须 admin 显式 `allow_public_kbs=true`） |
| 显式授权表 | `chayuan_kb_grants` (已有) | `chayuan_app_kb_grants` (**新建**) |
| 可拥有 KB | 是 | **永不** |
| 限速桶 | per-user | per-app（独立桶） |
| 凭据失效后 | refresh token 续 | 直接 401，要求重输 |

#### 4.3.2 数据模型（新增 3 张表）

```sql
-- (1) 应用账号注册表
CREATE TABLE chayuan_apps (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id             VARCHAR(64)  UNIQUE NOT NULL,        -- 客户端可见 ID
    app_secret_hash    VARCHAR(255) NOT NULL,               -- bcrypt(secret)
    name               VARCHAR(128) NOT NULL,
    description        TEXT,
    role               VARCHAR(16)  NOT NULL DEFAULT 'app', -- 预留扩展
    enabled            BOOLEAN      NOT NULL DEFAULT TRUE,
    allow_public_kbs   BOOLEAN      NOT NULL DEFAULT FALSE, -- 关键安全开关
    rate_limit_per_min INTEGER      DEFAULT 60,
    daily_quota        INTEGER      DEFAULT NULL,            -- NULL=不限
    created_at         TIMESTAMP    NOT NULL,
    updated_at         TIMESTAMP    NOT NULL,
    last_used_at       TIMESTAMP,
    created_by         INTEGER      REFERENCES chayuan_users(id),
    revoked_at         TIMESTAMP                              -- 软删
);

-- (2) APP 对 KB 的访问授权（与 chayuan_kb_grants 等价语义）
CREATE TABLE chayuan_app_kb_grants (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id      INTEGER NOT NULL REFERENCES chayuan_apps(id) ON DELETE CASCADE,
    kb_id       INTEGER NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    role        VARCHAR(16) NOT NULL,                       -- 'reader' | 'editor'
    granted_at  TIMESTAMP   NOT NULL,
    granted_by  INTEGER     REFERENCES chayuan_users(id),
    expires_at  TIMESTAMP,                                  -- 可选，过期失效
    UNIQUE (app_id, kb_id)
);

-- (3) APP 审计日志
CREATE TABLE chayuan_app_audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id      INTEGER REFERENCES chayuan_apps(id),
    action      VARCHAR(32) NOT NULL,                       -- login|search|download|denied|grant|revoke|rotate
    kb_name     VARCHAR(128),
    request_id  VARCHAR(64),
    ip          VARCHAR(64),
    error       TEXT,
    occurred_at TIMESTAMP   NOT NULL
);
CREATE INDEX idx_app_audit_app_time ON chayuan_app_audit_log(app_id, occurred_at DESC);
```

alembic 迁移脚本：1 个 revision 一次性建 3 张表 + 索引；回滚走 `op.drop_table`。

#### 4.3.3 鉴权中间件改动

```python
# chayuan/server/api_server/middleware.py
# 新增:HMAC 旁路(只对配置项 OPENAPI_HMAC_ROUTE_PREFIXES 命中的路径生效)

OPENAPI_HMAC_ROUTE_PREFIXES = [
    "/knowledge_base",
    "/knowledge_universe",   # 树形/分组接口也要支持
]

async def _try_hmac_auth(request: Request) -> Optional[dict]:
    if request.state.user is not None:
        return request.state.user                  # 已被 JWT 鉴过

    if not any(request.url.path.startswith(p) for p in OPENAPI_HMAC_ROUTE_PREFIXES):
        return None                                # 路径不在白名单

    app_id     = request.headers.get("x-app-id", "").strip()
    timestamp  = request.headers.get("x-timestamp", "").strip()
    given_sign = request.headers.get("x-sign", "").strip()
    if not (app_id and timestamp and given_sign):
        return None                                # 不像 HMAC 请求,放行让后续 401

    app = get_app_by_app_id(app_id)                # 来自 chayuan_apps,带 1min Redis 缓存
    if app is None or not app.enabled or app.revoked_at:
        _audit("denied", app_id=None, error=f"unknown_or_revoked: {app_id}",
               request_id=request.state.request_id, ip=_client_ip(request))
        raise HTTPException(401, detail={"code": 4013, "msg": "unknown app_id"})

    body_bytes = await _peek_body(request)         # 不消费 body,要 hook 出来
    ok, reason = app_signing.verify(
        secret=_lookup_secret_for_verify(app),     # bcrypt 不可解,用纯字符串 cache
        timestamp=timestamp, body=body_bytes, sign=given_sign,
    )
    if not ok:
        code = 4012 if "expired" in (reason or "") else 4011
        _audit("denied", app_id=app.id, error=reason or "bad_sig",
               request_id=request.state.request_id, ip=_client_ip(request))
        raise HTTPException(401, detail={"code": code, "msg": f"invalid signature: {reason}"})

    user = {
        "id":                f"app:{app.id}",
        "role":              app.role,             # 'app'
        "app_id":            app.id,
        "app_id_str":        app.app_id,
        "name":              app.name,
        "allow_public_kbs":  bool(app.allow_public_kbs),
        "rate_limit_per_min": app.rate_limit_per_min,
        "daily_quota":       app.daily_quota,
    }
    request.state.user = user
    update_app_last_used(app.id)                   # 异步,不阻塞
    return user
```

> **secret 怎么验签**：bcrypt 是单向的，不能拿来 HMAC。两种做法二选一：
> 1. **app_secret 同时存 bcrypt + 加密的明文**（用 `JWT_SECRET` 派生 KEK 加密）→ 验签时解密拿明文 → 安全性 ≈ JWT_SECRET 的强度
> 2. **每次 rotate 时返回明文一次**，服务端只存 bcrypt → 验签时用客户端发来的"前导密钥派生"... → **不可行**，HMAC 必须双方都持有同一 secret
>
> v1 选 **方案 1**（解密派生），并在 README 强调 "JWT_SECRET 必须强随机 ≥ 32 字节，泄露=所有 APP secret 泄露"。

#### 4.3.4 ACL 函数（auth/access.py 扩展）

```python
def _is_app_user(user: dict) -> bool:
    return isinstance(user, dict) and str(user.get("id", "")).startswith("app:")

def can_read_kb(user, kb_name) -> bool:
    if user is None:        return True             # 单机 / AUTH_REQUIRED=false
    if user.get("role") == "admin":                 return True

    if _is_app_user(user):
        kb = _load_kb(kb_name)
        if kb is None: return False
        if kb.visibility == "public" and user.get("allow_public_kbs"):
            return True
        return _app_has_grant(user["app_id"], kb.id, roles={"reader", "editor"})

    # 现有人类用户路径(不动)
    return _user_has_kb_access(user, kb_name, mode="read")

def can_write_kb(user, kb_name) -> bool:
    if user is None: return True
    if user.get("role") == "admin": return True
    if _is_app_user(user):
        kb = _load_kb(kb_name)
        if kb is None: return False
        return _app_has_grant(user["app_id"], kb.id, roles={"editor"})
    return _user_has_kb_access(user, kb_name, mode="write")

def is_kb_owner(user, kb_name) -> bool:
    if _is_app_user(user):
        return False                                # 应用永不是 owner
    # 现有路径
    ...

def list_accessible_kbs(user) -> list[str]:
    if user.get("role") == "admin":
        return _all_kb_names()
    if _is_app_user(user):
        names = set()
        if user.get("allow_public_kbs"):
            names.update(_list_public_kb_names())
        names.update(_list_app_granted_kb_names(user["app_id"]))
        return list(names)
    # 现有路径
    ...

def get_kb_role_for_subject(user, kb_name) -> str | None:
    """返回 'owner' | 'editor' | 'reader' | None — 给前端显示徽章用"""
    if user is None or user.get("role") == "admin":
        return "admin"
    if _is_app_user(user):
        kb = _load_kb(kb_name)
        if kb is None: return None
        if kb.visibility == "public" and user.get("allow_public_kbs"):
            return "reader"                         # 默认 reader,grant 可升级
        return _app_grant_role(user["app_id"], kb.id)
    return _user_grant_role(user, kb_name)
```

`_load_kb` / `_app_has_grant` / `_app_grant_role` / `_list_app_granted_kb_names` 都加 **Redis 1 分钟缓存**，避免每个请求 hit DB；**写操作（grant/revoke/rotate）必须 invalidate** 这一层缓存。

#### 4.3.5 Admin 端点（chayuan-server 自带 webui / CLI 管理）

> v1 **不在 chayuan WPS 加载项里做 admin UI**；用户只能"用"和"看自己有权限的"。Admin 操作通过下列端点 + chayuan-server 既有的 webui_pages 入口或 `chayuan` CLI 完成。

```
POST   /openapi/apps                          创建 app(返回 app_id + 一次性明文 secret)
GET    /openapi/apps                          列表 [{ id, app_id, name, enabled, allow_public_kbs, last_used_at, kb_grant_count }]
GET    /openapi/apps/{id}                     详情(含完整 grants)
PATCH  /openapi/apps/{id}                     改 enabled / allow_public_kbs / limits / name
POST   /openapi/apps/{id}/rotate_secret       吊销旧 secret, 返回新 secret
DELETE /openapi/apps/{id}                     软删(revoked_at + enabled=false)

GET    /openapi/apps/{id}/kb_grants           查授权列表
POST   /openapi/apps/{id}/kb_grants           批量授权 [{ kb_name, role, expires_at? }]
DELETE /openapi/apps/{id}/kb_grants/{kb_name} 撤销

GET    /openapi/apps/{id}/audit?...           审计日志(分页, 默认最近 7 天)
```

权限：所有 `/openapi/apps/*` 端点只接受 **JWT + role=admin**（不能用 HMAC 自管自）。

#### 4.3.6 接口层面感知 ACL（已有路由的兼容）

* `kb_routes.py:list_kbs_endpoint` → 现有的 `accessible = list_accessible_kbs(user)` 已经做对了，**新 `_is_app_user` 路径会自动并入**，无需改 endpoint 本身。
* `search_docs / search_batch / hybrid_search / download_doc / list_files / kb_chat` → 已经走 `_require_read`，自动覆盖。
* `create_kb / delete_kb / upload_docs` → 已经走 `_require_write` / `_require_owner`；APP 永不是 owner 这一约束意味着**应用账号不能创建/删除 KB**（合理）。

#### 4.3.7 安全细节清单

| 项 | 措施 |
|---|---|
| secret 长度 | ≥ 32 字节随机，base64 后 ~44 字符；创建/rotate 时**只显示一次** |
| secret 存储 | bcrypt(成本 12) + AES-GCM 密文（用 `JWT_SECRET` 派生 KEK） |
| secret 泄露应急 | admin 一键 `disable` + `revoke_all_grants`，<1s 全节点生效（清 Redis 缓存） |
| 时钟漂移 | HMAC 容忍 ±300s（沿用现有 `app_signing.verify`） |
| 重放攻击 | timestamp + sign 已防；可选 + nonce + Redis SET NX 5min 兜底（v1 不做） |
| public KB 漏出 | `allow_public_kbs` 默认 false；管理后台显式标 ⚠️ 提醒 admin 注意 |
| 过期 grant | 每天 cron `delete from chayuan_app_kb_grants where expires_at < now()` |
| 限速 | per-app 独立桶（默认 60/min），不与人类用户共桶 |
| 配额 | per-app daily quota；超额 429 + 写审计 |
| 审计 | login(成功/失败) / search(命中 KB) / download(命中文件) / denied(原因) 四类必记 |
| 跨账号串号 | `chunk.download_token` JWT 含 `aud=app:xxx` 或 `aud=user:xxx`，下载时严格匹配当前调用者 |

#### 4.3.8 错误码细化（更新 contract §4）

```
401  4011  invalid_signature        HMAC 签错
401  4012  expired_signature        timestamp 漂移 > 300s
401  4013  unknown_app_id           app_id 不存在 / 已 disable / 已 revoked
401  4014  secret_revoked           rotate 后用旧 secret(可选,需要服务端记 secret 版本)
403  4031  no_read_permission       人类用户无 read 权限
403  4032  app_no_kb_grant          APP 未被授权该 KB（与 4031 区分,UI 文案不同）
403  4033  app_public_kb_disabled   APP 没开 allow_public_kbs，请求的 KB 是 public 但被拒
429  4291  rate_limit_exceeded      触发分钟级令牌桶
429  4292  app_quota_exhausted      触发 APP 日配额
429  4293  user_quota_exhausted     触发用户日配额
```

#### 4.3.9 前端必须配合的调整（影响 §2.1 / §2.2 设计）

1. **健康探测三步**返回值要带 `subject_kind: 'user'|'app'` 和 `accessible_kb_count`，UI 才能区分文案：
   - User: "已连接 / 你可访问 5 个知识库"
   - App: "已连接 / APP `bizapp01` 已被授权 3 个知识库"
2. **KB 树形清单**每条带 `role: 'owner'|'editor'|'reader'` 徽章，hover tooltip 显示 grant 来源（"显式授权" / "public" / "owner"）。
3. **HMAC 模式**的"测试连通"如果 `accessible_kb_count == 0`，UI 显示醒目提示："APP 已连通但未被授权任何知识库，请联系管理员调用 `POST /openapi/apps/{id}/kb_grants`"。
4. **下载链接 token** 验证失败（401 4011 / 4031） → UI 弹"权限已变更，请刷新连接"。
5. **HMAC 模式**禁用"添加 / 删除 KB" 按钮（应用账号没 owner 权限），灰显并 tooltip 解释原因。

### 4.4 限速 / 配额 / 隔离（高并发的前提）

* **令牌桶**：`/search_batch` 复用 `resilience.RateLimiter`，按 `user_id`（或 `app_id`）+ `kb_name` 双维度限速；默认 30 req/min/(user,kb)，可配。
* **整批大小上限**：`queries` 数 ≤ 16，每条 text 长度 ≤ 4000，总 token 估算 ≤ 16k。
* **并发上限**：单实例 `MAX_KB_PARALLEL = 8`；超出走排队，>2s 还没拿到 → 503 + `Retry-After`。
* **熔断**：向量库连不上 → 现有 `_kb_call` 已经给 503；`/search_batch` 单查询失败不致命，仅在 response.queries[i].errors 标记。
* **配额**：在 user_model 上加 `kb_search_quota_per_day`（admin 可调），超额返回 429。
* **观测**：所有 search_batch 请求带 `X-Request-ID`，落到结构化日志；新增 Prometheus 指标 `chayuan_kb_search_batch_total{user, kb, status}` + 直方图 `chayuan_kb_search_batch_latency_ms`。

### 4.5 下载链接的短期 token（前端 §2.4 用）

新增工具函数 `auth/download_token.py`：
```
sign_download(user, { kb, file }) → JWT(payload={u,k,f,exp:30m}, secret=JWT_SECRET)
verify_download(token) → {u,k,f}
```

`/download_doc` 路由扩 query 参数 `?dl_token=...`，验过即放行（无需 Authorization 头），用于浏览器 `<a download>` / `<iframe>` 直链。这条是 `chayuan-server/api_server/middleware.py` `_QUERY_TOKEN_ALLOWED_PATHS` 已经支持的模式（已经给 `/preview_doc` 开过）；同样模式给 `/download_doc` 加。

---

## 5. 性能 / 高并发设计（这部分用户重点提了）

### 5.1 前端

| 维度 | 措施 |
|---|---|
| 请求合并 | `searchOrchestrator` 一次发 `/search_batch`，不要 N 个 `/search_docs` |
| 并发 | 同一对话同一时刻只有 1 个 retrieval 在跑（旧的 abort）；`pLimit(4)` 仅在客户端兜底（不会走到服务端循环） |
| 缓存 | 三层：1) 单查询 LRU 60s；2) 整批 query hash 5min；3) 服务端 semcache（按 user+kb+model 隔离，已有） |
| 限速 | 复用 `host.rateLimiter`，全局 KB 调用 ≤ 30/min；UI 上一直按状态绿/黄/红反馈 |
| 网络 | fetch 全程用 `signal`，AbortController 在 chat 取消/切换时立刻断 |
| 渲染 | 引用气泡虚拟列表（>20 条时）；折叠默认收起，避免一次性 DOM 爆 |
| 拼装 | promptBuilder 输出大小硬上限（chunks 总字符 ≤ 8000），溢出按 trust 降序裁 |
| Worker | queryPlanner 的相似度去重放进 `chayuan/src/workers/`，避免阻塞主线程 |

### 5.2 后端

| 维度 | 措施 | 已有 / 新增 |
|---|---|---|
| Worker 数 | uvicorn `--workers N`，结合 `runtime.py` 的 hot-config | 已有 |
| 连接池 | sqlalchemy + redis 连接池足量；Milvus 客户端 reuse | 已有 |
| 异步 IO | `/search_batch` 全 async，embedding 走 thread-pool 包装 | 新增 |
| 语义缓存 | Redis（已存在 `semcache_*`），按 (user, kb, model, query_hash) | 复用 |
| 任务队列 | 长任务走 Arq（已有 `ingest_queue`）；search_batch 是同步快路径，**不**入队 | 复用 |
| 监控 | `/metrics` 已有；新增 KB 专项指标 | 微增 |
| 隔离 | RateLimiter 按 user_id/app_id；KB 文件下载独立的下载并发桶 | 微增 |
| 降级 | rerank 失败 → 自动跳过；hybrid 失败 → 退到纯向量 | 已有 + 一处补 |

### 5.3 容量目标（v1）

* **单实例**：100 RPS `/search_batch`（每批 ≤ 4 子查询、top_k=6）；P95 < 800ms（带 rerank、Milvus 本地）。
* **横向扩展**：无状态服务（缓存在 Redis、向量库独立），`docker/prod` 模板已经支持 `chayuan-api` 多副本。

---

## 6. 安全 / 合规

1. **凭据加密**：客户端 §3.2.4；服务端用 `JWT_SECRET` 派生下载 token 短期 key + APP secret KEK。
2. **传输**：强烈建议 HTTPS；HTTP 模式仅供内网调试，UI 黄条警告。
3. **租户隔离**：JWT/HMAC 都带 user/app id，KB 列表/检索/下载全链路 ACL 校验（已有 `_require_read` + §4.3 双轨）。
4. **防重放**：HMAC 已校时间戳 ±300s（`openapi/verify`），下载 token 30 分钟；下载 token 带 `aud` 声明，跨账号使用直接 401。
5. **审计**：人类用户 search_batch 的 query 在结构化日志可选记录（默认脱敏，admin 可开启完整）；APP 的 login/search/download/denied 必记 `chayuan_app_audit_log`，保留 ≥ 90 天。
6. **PII**：UI 引用卡片显示原文片段时，前端加"点击展开"，默认只显示前 80 字 + ellipsis，避免敏感信息截屏外泄。
7. **应用账号高危操作**（§4.3.7）：
   - APP 默认**不可见 public KB**（`allow_public_kbs=false`），admin 开启时弹二次确认 + 写审计；
   - APP secret 创建/rotate 时**仅明文返回一次**；
   - admin 一键 `disable + revoke_all_grants` 应急；
   - JWT_SECRET 强随机 ≥ 32 字节（README 强调），泄露 = 所有 APP secret 漏出，必须立即 rotate 全部 APP。
8. **secret 在客户端**：HMAC 模式下 `app_secret` 经 `connectionCipher` AES-GCM 加密落 OPFS；签名时仅在内存解密一次，使用完立即丢弃引用（不在 closure 长期持有）。

---

## 7. 兼容 / 降级 / 回滚

| 场景 | 行为 |
|---|---|
| 服务端是旧版（没有 `/search_batch`） | 前端检测 404 → 自动 fallback 循环 `/search_docs`，但 UI 提示"建议升级服务端获得更好性能" |
| 服务端没启 hybrid/rerank | `use_hybrid/use_rerank` 强制 false；引用卡片显示 "rerank: off" |
| 远程 KB 全失败 | 自动降级到本地 `documentIntelligence/ragStore`；气泡顶部显示"⚠️ 本地知识"标签 |
| 凭据失效 (401) | JWT 模式静默 refresh 一次；HMAC 模式直接弹"请到设置重连" |
| Feature flag | 新增 `kbRemoteIntegration`，默认 `true`（new install）/ 兼容老用户灰度 |
| 回滚 | services.kb 全部新文件，删除即等于关闭功能；SettingsDialog 的注入 + AIAssistantDialog 的弹窗替换都是局部 patch，可一行还原 |

---

## 8. 测试策略

### 8.1 单元测试（vitest）

* `connectionCipher.test.js`：加解密往返、设备 key 派生稳定性。
* `splitters.test.js`：T1 结构识别（heading / 段落 / 句滑窗 fallback 链）；T2 短段合并 + 长段切分目标区间 [200, 600]；中英混排、PDF 导出无空行的退化路径、emoji/表情符号、超宽全角字符。
* `clusterer.test.js`：相似度阈值 [0.78, 0.92] 边界；簇数上限 K = min(budget, ceil(M/5))；同质文本聚成 1 簇；高方差文本不过度合并。
* `localDistiller.test.js`：LLM 输出 JSON parse 失败 → 兜底"代表段截断"；batch prompt 一次出 K 组；超时跳过单簇但不影响其他。
* `queryPlanner.test.js`：6 档预算分级（含 100k 字 + 200k 字），sectionIds 一路保留；同段 sha1 命中 LRU 不重蒸馏；mode 切换（qa/verify/summarize）prompt 不同。
* `credibilityScorer.test.js`：多信号合成、分桶星级、归一化稳定；`crossBatchAgreement` 在 `from_query_tags` 多元素时正确加权。
* `deduper.test.js`：跨批次去重、同源段合并；`from_section_ids` 集合并集正确。
* `promptBuilder.test.js`：3 种 mode 的 prompt 字符串 snapshot；引用 `[^cN]` 占位符替换。
* `authClient.test.js`：HMAC 签名按 server `app_signing.verify` 走的 fixture 验证；JWT 401 自动 refresh。
* `searchOrchestrator.test.js`：`/search_batch` 404 自动回退循环 `/search_docs`；AbortController 在 plan 阶段/网络阶段都能立即停。

### 8.2 集成测试

* mock `chayuan-server` 跑 `searchOrchestrator` E2E：选段 → batch → 信任度排序 → prompt → 引用气泡渲染。
* `e2e/` 加一条 Playwright 用例：在 WPS 模拟器里"打开设置→连通性测试→选 KB→选段→发送→气泡里出现折叠源条→点下载"。

### 8.3 后端

* `tests/test_kb_search_batch.py`：单批 / 多批 / 失败分支 / RRF vs weighted / 缓存命中 / 限速触发。
* `tests/test_openapi_hmac_kb.py`：HMAC 通道走 `/knowledge_base/*` 端到端。
* `pytest tests/load/`（新建）：locust 跑 100 并发 5 分钟，看 P95 / RPS / 错误率，回归 §5.3 容量目标。

### 8.4 灰度 / 上线

* 内部 dogfood 1 周：开启 `kbRemoteIntegration`，配 1 套测试 server。
* 服务端按 docker/prod 模板拉一份独立预发。
* 监控：`chayuan_kb_search_batch_*` 指标 + `error_ratio`，超阈值自动告警。

---

## 9. 开发计划（Phase / 工时 / 交付物）

> 估时按 1 个全栈工程师 + 1 个前端工程师并行；如人数变化按比例缩放。
> 标记 `[FE]=前端 chayuan` `[BE]=后端 chayuan-server` `[共]=两端联调`。

### Phase 0 · 准备（0.5 天）

* [共] 锁定接口契约 v1（参考 §4.1 / §4.2）。
* [共] 划好 PR 边界（前端 4 个 PR、后端 3 个 PR，详 §10）。
* [BE] 拉新分支 `feat/kb-search-batch`，更 `pyproject` 版本号 + CHANGELOG 头条。
* [FE] 新建目录 `src/services/kb/`，挂空 stub 进 `services/index.js`，灯亮即合并。

### Phase 1 · 后端核心：`/search_batch` + HMAC 扩通（3–4 天）

* [BE] §4.1 `search_batch` 同步版（无 SSE） — 1.5d
* [BE] §4.2 SSE 版 — 1d
* [BE] §4.3 HMAC 鉴权扩白名单 + apps/grants 表 — 1d
* [BE] §4.4 限速 / 配额 / 指标 — 0.5d
* [BE] §4.5 download_token — 0.5d
* [BE] 测试 §8.3 + 文档 — 0.5d

**交付**：服务端独立可上线、可压测、可回归。

### Phase 2 · 前端：连接 + 设置面板 + 树形清单（3 天）

* [FE] `services.kb.{connectionStore, connectionCipher, authClient}` — 1d
* [FE] `services.kb.{kbCatalog, kbCatalogCache, healthProbe}` — 0.5d
* [FE] `KbSettingsPanel.vue` 新组件 + 注入 SettingsDialog — 1d
* [FE] 测试 §8.1 部分 + i18n 文案 — 0.5d

**交付**：用户能在设置里配通连接，看到树形知识库清单，按"测试连通"得到三步聚合状态。

### Phase 3 · 前端：选择知识库 + 长文切分 + retrieval middleware（4 天，比原计划+1d）

* [FE] 替换 `AIAssistantDialog.vue` 知识库弹窗为 `KbSelectorDialog.vue`（独立 SFC，多选树）— 1d
* [FE] `kbBindings` 在对话上的持久化 + 输入框徽章 — 0.5d
* [FE] `services.kb.{searchClient, searchOrchestrator, deduper}` — 0.5d
* [FE] **§3.2.5 四层漏斗**：`splitters.js` (T1+T2) + `clusterer.js` (T3) + `localDistiller.js` (T4) + `queryPlanner.js` 总入口 — 1.5d
* [FE] T1/T2/T3 worker 化（`chayuan/src/workers/kbPlannerWorker.js`）— 0.25d
* [FE] `retrievalMiddleware` 接入 chatFlow / documentFlow / assistantFlow — 0.25d

**交付**：能在对话里选 KB，长文（含 10 万字）自动按四层漏斗切分检索；UI 已经能看到 splitting/clustering/distilling 三阶段进度（暂用最朴素 prompt + 不显示 sources）。

### Phase 4 · 前端：可信度 + 引用气泡（折叠 + 下载）（2.5 天）

* [FE] `credibilityScorer` + 单测 — 0.5d
* [FE] `promptBuilder` 三种 mode + Ribbon/右键菜单触发"知识库核对/总结/问答" — 0.5d
* [FE] `KbSourceStrip.vue`（横线 + 折叠条 + 卡片列表 + 下载）— 1d
* [FE] `attachmentClient` + 下载链接安全 — 0.25d
* [FE] markdown 渲染器 `[^cN]` → `<sup>` + hover 高亮 — 0.25d

**交付**：完整闭环 — 选段 → 检索 → 多片段 + 信任度 → LLM 输出带引用 → 气泡顶折叠条 → 点附件下载。

### Phase 5 · 联调 / 压测 / 灰度（2 天）

* [共] E2E §8.2 — 0.5d
* [BE] 压测 §8.3 + 调参（top_k、并发、缓存 TTL）— 0.5d
* [共] 灰度发布 + 监控告警阈值 — 1d

**交付**：可对外开放给试点客户。

### 总工时约 15 人日（2 人并行约 8 自然日）— Phase 3 因四层漏斗 +1d

---

## 10. PR 拆分建议（便于 review / 回滚）

| # | 仓库 | PR 标题 | 包含 |
|---|---|---|---|
| 1 | server | feat(kb): `/search_batch` + tests | §4.1 + §8.3 部分 |
| 2 | server | feat(kb): `/search_batch_stream` SSE | §4.2 |
| 3 | server | feat(auth): OpenAPI HMAC for `/knowledge_base/*` + apps/grants | §4.3 + 迁移 |
| 4 | client(chayuan) | feat(services): `services.kb` skeleton + connection store + cipher | §3.2.1/3.2.4 |
| 5 | client | feat(settings): `KbSettingsPanel` + 树形清单 + 连通测试 | §2.1 + §3.2.2/3.2.3 |
| 6a | client | feat(kb): long-text query planner (4-tier funnel) | §3.2.5 + splitters/clusterer/distiller + worker |
| 6b | client | feat(assistant): KB selector + binding + retrieval middleware | §2.2 + §3.2.6/3.2.9 |
| 7 | client | feat(assistant): credibility scorer + prompt builder + source strip + download | §2.4 + §3.2.7/3.2.8 + §4.5 接入 |

---

## 11. 风险与开放问题

1. **本地大模型上下文窗**：用户用 8k 模型时，分批 + 信任度裁剪后的 chunks 仍可能超长 → §3.2.6 给硬上限；后续考虑 client 侧根据 `selectedModel.contextWindow` 自适应裁剪比例。
2. **Reranker 在没有 GPU 时延迟高**：可在 server 端按 `Settings.kb_settings.RERANK_BACKEND` 走小模型；前端 `use_rerank` 默认 true，但 v1 只在 Top-K > 8 时启用。
3. **多连接并存**：v1 数据模型支持，UI 只露单连接；v1.1 再开多连接（每对话独立绑连接）。
4. **应用账号(HMAC)的 KB 授权 UI**：v1 后端做完，前端管理页放 v1.1（admin-only），先用 SQL/CLI 配。
5. **文档跨段引用合并**：用户问的"段落"如果跨多个 chunk_id，可信度评分的 `crossBatchAgreement` 是否会过分惩罚？需要灰度后看真实数据再调权。
5b. **本地 LLM 蒸馏的可用性**：若用户没装本地 LLM 或调用超时（§3.2.5.6 #5），降级到"代表段截断"作 query，召回质量会下降；指标上要监控 `distill_fallback_ratio`，过高时在设置里红条提示用户启用本地 LLM。
5c. **聚类相似度阈值的领域差异**：法律/技术文档主题切换明显，0.85 通常合适；但散文/新闻类文本主题渐变，0.85 可能聚类过粗。需要灰度后按 KB 类型给出推荐预设。
5d. **LLM 不严格按 [^cN] 引用**：尤其本地小模型（7B 以下）。前端 `promptBuilder` 必须在末尾加"如果不引用，答案将被拒绝"硬约束 + 后处理：把无引用句标灰 + 在气泡顶警告 "⚠️ 该回答未引用知识库，请人工核对"。
6. **WPS 内嵌浏览器对 SSE 的兼容**：少数老版本 IE/旧 webview 不支持 EventSource → 已经有 fetch + ReadableStream 兜底（参考现有 `kbHybridSearch.ts`），WPS 端再做一次回归。
7. **客户端凭据托管的 UX**：换电脑要重输；可考虑后续提供"导出加密包 + 一次性口令"的迁移流程，但 v1 不做。

---

## 12. 验收清单（对照需求逐条勾）

- [ ] 1. 设置 → 数据设置 → "知识库设置"，可填 URL + 用户名密码，亦可填 APPID + AppKey/AppSecret。
- [ ] 2. "测试连通"按钮三步聚合反馈（地址/凭据/KB），含中文错误提示 + request_id。
- [ ] 3. 设置成功后，知识库清单以**树形结构**渲染，按 universe 分组。
- [ ] 4. 察元 AI 助手 → "选择知识库"为**树形多选**，应用后绑定本对话；徽章可见。
- [ ] 5. 选段 / 全文 → 三入口（右键 / Ribbon / 输入框）触发知识库检索。
- [ ] 6. 长文检索走 §3.2.5 的**四层漏斗**（结构切分 → 自适应归并 → 语义聚类 → LLM 蒸馏），按 §3.2.5.3 的硬预算表自动选档；10 万字场景 ≤ 24 子查询、P95 < 4s；UI 端到端 6 阶段进度可见。
- [ ] 7. 每条片段附"信任度分 + 星级"，与原始 metadata 1:1 对应；prompt 强约束本地 LLM 用 `[^cN]` 引用并允许"未覆盖"。
- [ ] 8. 气泡顶部横线 + 左侧折叠图标，展开后每条片段显示文件名/段落/分数 + "📎下载" 链接（短期签名 token）。
- [ ] 9. 服务端提供 `/knowledge_base/search_batch`（同步 + SSE），含限速、缓存、ACL；HMAC 鉴权适配 `/knowledge_base/*`。
- [ ] 10. 双轨 ACL（§4.3）：用户态走 `chayuan_kb_grants`、应用态走 `chayuan_app_kb_grants`；APP 默认不见 public KB，必须 admin 显式开 `allow_public_kbs`；APP 永不是 owner、不能创建/删除 KB。
- [ ] 11. Admin 端点 7 个（apps CRUD + rotate_secret + kb_grants + audit）齐全且只接 JWT+admin。
- [ ] 12. Secret 创建/rotate 时只明文返回一次；服务端只存 bcrypt + AES-GCM 密文；rotate 5 秒内全节点生效（清 Redis 缓存）。
- [ ] 13. 错误码精细到 4011/4012/4013/4031/4032/4033/4291/4292/4293，前端按 code 给中文文案。
- [ ] 14. 健康探测返回 `subject_kind` + `accessible_kb_count` + per-kb `role` 徽章；HMAC 模式 0 grant 时给醒目引导。
- [ ] 15. `chayuan_app_audit_log` 落 login/search/download/denied/grant/revoke/rotate 七类事件，保留 ≥ 90 天。

---

## 13. 一句话总结

> 服务端 80% 接口已经在位，主要补一个**面向选段批量检索 + 信任度的聚合接口**和**HMAC 通道扩白名单**；前端从零搭一个 `services.kb` 子树，把"连接 → 树形清单 → 选 KB → 分批检索 → 可信度 → 折叠引用 → 下载"做成一条干净的中间件，**不动**现有 sendPipeline 主路径，**不动**现有本地 ragIndex，可独立灰度、可一行回滚。

