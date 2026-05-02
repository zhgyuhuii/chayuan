/**
 * services/kb — 远程知识库（chayuan-server）整合层
 *
 * 设计参考:
 *   - 计划文档: chayuan/plans/plan-knowledge-base-integration.md §3.1
 *   - 接口契约: docs/kb-search-batch-contract.md
 *
 * 子模块边界(每个文件单一职责):
 *   - connectionStore   多连接 CRUD + 当前选中 + 监听器
 *   - connectionCipher  凭据 AES-GCM + 设备绑定 key
 *   - authClient        双模 fetch 包装(JWT / HMAC)
 *   - healthProbe       三步连通性聚合
 *   - kbCatalog         知识库列表(树形)
 *   - kbCatalogCache    ETag + TTL LRU
 *   - splitters         T1 结构切分 + T2 自适应归并
 *   - clusterer         T3 本地小 embedding + 层次聚类
 *   - localDistiller    T4 本地 LLM 批量蒸馏检索短语
 *   - queryPlanner      四层漏斗总入口(plan)
 *   - searchClient      /search_batch (+ stream) HTTP 客户端
 *   - searchOrchestrator 编排 plan → batch → dedup → score
 *   - deduper           跨批次 chunk 去重
 *   - credibilityScorer 多信号信任度评分
 *   - promptBuilder     3 种 mode 的 LLM prompt
 *   - attachmentClient  下载链接 + 短 token 续签
 *   - retrievalMiddleware sendPipeline 注入点
 *
 * 与 services/index.js 的接驳:
 *   import kb from './kb'
 *   services.kb = kb
 *
 * 注意:本模块所有副作用化 IO(网络/OPFS/LLM)都通过依赖注入或工厂函数,
 * 便于单测 mock;不要在模块顶层抓全局对象(window/document)。
 */

import * as connectionStore from './connectionStore.js'
import * as connectionCipher from './connectionCipher.js'
import * as authClient from './authClient.js'
import * as pathRouter from './pathRouter.js'
import * as healthProbe from './healthProbe.js'
import * as kbCatalog from './kbCatalog.js'
import * as kbCatalogCache from './kbCatalogCache.js'
import * as splitters from './splitters.js'
import * as clusterer from './clusterer.js'
import * as localDistiller from './localDistiller.js'
import * as queryPlanner from './queryPlanner.js'
import * as searchClient from './searchClient.js'
import * as searchOrchestrator from './searchOrchestrator.js'
import * as deduper from './deduper.js'
import * as credibilityScorer from './credibilityScorer.js'
import * as promptBuilder from './promptBuilder.js'
import * as attachmentClient from './attachmentClient.js'
import * as retrievalMiddleware from './retrievalMiddleware.js'

const connection = {
  list: connectionStore.listConnections,
  get: connectionStore.getConnection,
  current: connectionStore.getCurrentConnection,
  setCurrent: connectionStore.setCurrentConnection,
  upsert: connectionStore.upsertConnection,
  remove: connectionStore.removeConnection,
  subscribe: connectionStore.subscribe,
  cipher: connectionCipher,
  auth: authClient
}

const catalog = {
  fetchTree: kbCatalog.fetchTree,
  fetchList: kbCatalog.fetchList,
  invalidate: kbCatalogCache.invalidate,
  cache: kbCatalogCache
}

const search = {
  run: searchOrchestrator.run,
  client: searchClient,
  planner: queryPlanner,
  splitters,
  clusterer,
  localDistiller,
  scorer: credibilityScorer,
  deduper,
  promptBuilder
}

const attachment = {
  buildDownloadUrl: attachmentClient.buildDownloadUrl,
  refreshToken: attachmentClient.refreshToken
}

const health = {
  run: healthProbe.run
}

const middleware = {
  applyKbRetrievalIfBound: retrievalMiddleware.applyKbRetrievalIfBound
}

const kb = {
  connection,
  catalog,
  search,
  attachment,
  health,
  middleware
}

export default kb
export {
  connection, catalog, search, attachment, health, middleware,
  connectionStore, connectionCipher, authClient, pathRouter, healthProbe,
  kbCatalog, kbCatalogCache, splitters, clusterer, localDistiller,
  queryPlanner, searchClient, searchOrchestrator, deduper,
  credibilityScorer, promptBuilder, attachmentClient, retrievalMiddleware
}
