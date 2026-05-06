# services/kb — 远程知识库前端集成模块

完整设计：`plans/plan-knowledge-base-integration.md` v1.3
最终用户文档：`plans/kb-integration-user-guide.md`

## 模块全景

```
services/kb/
├── connectionStore.js      # 连接 CRUD + 监听器(OPFS / localStorage 落盘)
├── connectionCipher.js     # AES-GCM + HKDF + OPFS 盐加密凭据
├── authClient.js           # JWT refresh + HMAC 签名(x-app-id/x-timestamp/x-sign)
├── pathRouter.js           # JWT → /knowledge_base/*, HMAC → /openapi/v1/kb/*
├── healthProbe.js          # 三步连通测试 + 错误码细化(4011-4033)
├── kbCatalog.js            # GET /list_knowledge_bases + universe 树回退
├── kbCatalogCache.js       # KB 列表本地缓存(LRU + TTL)
│
├── splitters.js            # 四层漏斗 T1+T2:结构切分 + 自适应归并
├── clusterer.js            # T3:ngram 向量 + 层次聚类(localEmbed 暂用 ngram)
├── localDistiller.js       # T4:LLM 关键短语蒸馏(走 chatCompletion 闭包)
├── queryPlanner.js         # 四层漏斗总入口(自动选档:200/800/4k/20k/100k)
│
├── searchClient.js         # POST /search_batch + SSE /search_batch_stream + 旧版 /search_docs 回退
├── searchOrchestrator.js   # plan → batch → dedup → score 编排,LRU + verify bySection
├── deduper.js              # chunk_id 去重 + from_query_tags/from_section_ids 集合并集
├── credibilityScorer.js    # 6 信号 5 档星级(baseScore + titleHit + sectionHit + queryRecall + sourceQuality + crossBatch - staleness)
│
├── promptBuilder.js        # 3 mode (qa / verify / summarize) + [^cN] 引用约束 + extractCitations
├── attachmentClient.js     # buildDownloadUrl(?token=) + humanizeDownloadError
├── retrievalMiddleware.js  # applyKbRetrievalIfBound 注入 sendPipeline.chatFlow
└── index.js                # 整合导出
```

## 调用链速查

### 用户在察元 AI 里发消息
```
AIAssistantDialog.sendMessage()
  → buildChatFlowRequestContext()
  → retrievalMiddleware.applyKbRetrievalIfBound(ctx)        ← KB 检索注入点
       ├─ featureFlags.isEnabled('kbRemoteIntegration') ?    ← 灰度开关
       ├─ ctx.chat.kbBindings.kbNames.length > 0 ?
       ├─ getCurrentConnection()
       ├─ searchOrchestrator.run({ connection, query, kbBindings, mode })
       │   ├─ workers/kbPlannerClient.planKbQueriesViaWorker(...) ← worker T1+T2+T3
       │   ├─ searchClient.searchBatch(connection, body)      ← pathRouter 解逻辑路径 → 实际路径
       │   ├─ deduper.merge(rawMerged)
       │   └─ credibilityScorer.score(merged, { query, mode })
       └─ promptBuilder.build({ mode, sources, userQuery })
            → ctx.messagesForApi += [system: "引用约束 [^cN]..."]
  → streamChatCompletion(messagesForApi)
  → assistantMessageMeta.kbSources = chunks
  → KbSourceStrip 渲染折叠条
```

### 设置面板配置连接
```
SettingsDialog → KbSettingsPanel
  ├─ connectionStore.upsertConnection({ jwt | hmac })
  ├─ connectionCipher.encryptCredential(plain) → 落盘
  └─ healthProbe.run(connection)
       ├─ step 1 GET /healthz                                   (service)
       ├─ step 2 JWT login OR HMAC ping                          (cred)
       └─ step 3 GET /list_knowledge_bases [+ universe/tree fallback] (kb)
```

## 设计原则

1. **签名预留 vs 删除**：未实现的能力保留参数签名（`_options`、`_kbName` 等）+ `eslint-disable + 注释`，方便后续接真实现时不破坏调用方
2. **路径隔离**：`pathRouter` 负责 JWT/HMAC 双模在 URL 层面的硬隔离；上层服务**不**关心走哪条路径
3. **降级优先于报错**：单 KB 挂掉 → `partial`；服务端无 batch → 回退循环 search_docs；worker 超时 → 主线程；缺凭据 → 直通而非 throw
4. **副作用集中在 middleware 入口**：`applyKbRetrievalIfBound` 是唯一改 `messagesForApi` / `assistantMessageMeta` 的地方，方便 trace
5. **数据落盘必须加密**：`connectionCipher` 是凭据写盘的唯一通道；任何"调试存明文"的 PR 必须被拒

## 测试

```bash
npm run test:kb-integration   # 22 项 smoke 断言
npm run lint                  # 关注 services/kb/* 与 components/Kb*.vue
```

服务端契合测试在 `chayuan-server/libs/chayuan-server/tests/unit_tests/`：

```bash
pytest -k "kb or auth or audit or token or scope" tests/unit_tests/   # 78 + 8 = 86 项
```
