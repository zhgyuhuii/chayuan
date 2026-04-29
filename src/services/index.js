/**
 * services/index — 统一 service 层入口
 *
 * 解决 P6 问题:utils/ 直接被 components/ 调用,缺 API 边界。
 * 这层不动 utils,而是在 services 提供「业务级」聚合 API:
 *
 *   import services from '@/services'
 *   await services.evolution.runCycle()
 *   await services.assistant.list()
 *   services.toast.success('已保存')
 *
 * 优点:
 *   - 组件只依赖 services.*,内部实现可换(local → remote)
 *   - 集中处理跨模块组合(如 reboot 需要同时调 evolutionBoot + commandRegistry)
 *   - 自带错误兜底 + telemetry hook
 */

import {
  triggerEvaluation as evoTrigger,
  runDailyEvaluationCycle,
  getFlowSnapshot,
  rollbackByUser
} from '../utils/assistant/evolution/promotionFlow.js'
import {
  getCurrentEvolutionDeps,
  getEvolutionStatus
} from '../utils/assistant/evolution/evolutionBoot.js'
import { listAllSovereignty, pauseSuggestion, freezeAtVersion, setNeverSuggest, clearSovereignty } from '../utils/assistant/evolution/sovereigntyStore.js'
import { getStats as getPerfStats, clear as clearPerfStats } from '../utils/perfTracker.js'
import { getCustomAssistants } from '../utils/assistantSettings.js'
import { listExternalAssistants } from '../utils/assistant/externalAssistants.js'
import { listInstalled as listInstalledMarketplace, install as installMarketplacePackage, uninstall as uninstallMarketplacePackage } from '../utils/assistant/marketplaceManager.js'
import { isEnabled as flagEnabled, setFlag, listFlags } from '../utils/featureFlags.js'
import toastSvc from '../utils/toastService.js'

/* ────────── evolution ────────── */

const evolution = {
  status:     getEvolutionStatus,
  snapshot:   () => {
    const deps = getCurrentEvolutionDeps()
    return deps ? getFlowSnapshot({ deps }) : []
  },
  runCycle:   async () => {
    const deps = getCurrentEvolutionDeps()
    if (!deps) throw new Error('进化系统未启动')
    return runDailyEvaluationCycle({ deps })
  },
  triggerOne: async (assistantId) => {
    const deps = getCurrentEvolutionDeps()
    if (!deps) throw new Error('进化系统未启动')
    return evoTrigger(assistantId, { deps })
  },
  rollback:   async (assistantId) => {
    const deps = getCurrentEvolutionDeps()
    if (!deps) throw new Error('进化系统未启动')
    return rollbackByUser(assistantId, { deps })
  },
  // 主权
  sovereignty: {
    list: listAllSovereignty,
    pause: pauseSuggestion,
    freeze: freezeAtVersion,
    setNever: setNeverSuggest,
    clear: clearSovereignty
  }
}

/* ────────── assistant ────────── */

const assistant = {
  listCustom:   () => getCustomAssistants() || [],
  listExternal: listExternalAssistants,
  marketplace: {
    listInstalled: listInstalledMarketplace,
    install: installMarketplacePackage,
    uninstall: uninstallMarketplacePackage
  }
}

/* ────────── perf ────────── */

const perf = {
  stats: getPerfStats,
  clear: clearPerfStats
}

/* ────────── feature flags ────────── */

const flags = {
  isEnabled: flagEnabled,
  setFlag,
  list: listFlags
}

/* ────────── toast(直通) ────────── */

const toast = toastSvc

/* ────────── 主机层(WPS 加载项)────────── */
import * as opQueueLib from '../utils/host/opQueue.js'
import * as rateLimiterLib from '../utils/host/rateLimiter.js'
import * as undoChainLib from '../utils/host/undoChainBundle.js'
import * as opfsStorageLib from '../utils/host/opfsStorage.js'
import { chatCompletionWithShadow } from '../utils/host/chatCompletionWithShadow.js'
import * as createDialogSessionLib from '../utils/host/createDialogSession.js'
import * as leaderElectionLib from '../utils/host/leaderElection.js'

const host = {
  opQueue: opQueueLib,
  rateLimiter: rateLimiterLib,
  undoChain: undoChainLib,
  opfs: opfsStorageLib,
  chatCompletionWithShadow,
  createDialogSession: createDialogSessionLib.createDialogSession,
  leaderElection: leaderElectionLib
}

/* ────────── 路由层 ────────── */
import * as routerModelSettingsLib from '../utils/router/routerModelSettings.js'
import * as routerParallelDeciderLib from '../utils/router/routerParallelDecider.js'
import * as taskProgressBroadcastLib from '../utils/router/taskProgressBroadcast.js'
import * as enhancedSendLib from '../utils/router/enhancedSend.js'
import * as enhancedSendIntegrationLib from '../utils/router/enhancedSendIntegration.js'
import * as ribbonBusDispatcherLib from '../utils/router/ribbonBusDispatcher.js'

const router = {
  modelSettings: routerModelSettingsLib,
  parallelDecider: routerParallelDeciderLib,
  taskProgress: taskProgressBroadcastLib,
  enhancedSend: enhancedSendLib,
  enhancedSendIntegration: enhancedSendIntegrationLib,
  busDispatcher: ribbonBusDispatcherLib
}

/* ────────── 发送链路服务层 ────────── */
import * as intentRouterLib from './sendPipeline/intentRouter.js'
import * as chatFlowLib from './sendPipeline/chatFlow.js'
import * as documentFlowLib from './sendPipeline/documentFlow.js'
import * as assistantFlowLib from './sendPipeline/assistantFlow.js'
import * as generatedOutputFlowLib from './sendPipeline/generatedOutputFlow.js'

const sendPipeline = {
  intentRouter: intentRouterLib,
  chatFlow: chatFlowLib,
  documentFlow: documentFlowLib,
  assistantFlow: assistantFlowLib,
  generatedOutputFlow: generatedOutputFlowLib
}

/* ────────── 工作流(剩余 6 模块) ────────── */
import * as workflowEvolutionLib from '../utils/workflow/workflowEvolution.js'
import * as workflowReplayLib from '../utils/workflow/workflowReplay.js'
import * as workflowTriggerLib from '../utils/workflow/workflowTrigger.js'
import * as workflowMarketCommandsLib from '../utils/workflow/workflowMarketCommands.js'
import * as workflowToolsExtraLib from '../utils/workflow/workflowToolsExtra.js'
import * as workflowToolsP2Lib from '../utils/workflow/workflowToolsP2.js'

const workflow = {
  evolution: workflowEvolutionLib,
  replay: workflowReplayLib,
  trigger: workflowTriggerLib,
  marketCommands: workflowMarketCommandsLib,
  toolsExtra: workflowToolsExtraLib,
  toolsP2: workflowToolsP2Lib
}

/* ────────── 进化辅助 ────────── */
import * as abTestStatsLib from '../utils/assistant/evolution/abTestStats.js'

/* ────────── 其它助手层 ────────── */
import * as skillScannerLib from '../utils/assistant/skillScanner.js'

const evolutionExtras = {
  abTestStats: abTestStatsLib,
  skillScanner: skillScannerLib
}

/* ────────── 文档智能层 ────────── */
import * as documentReaderLib from './documentIntelligence/documentReader.js'
import * as chunkPlannerLib from './documentIntelligence/chunkPlanner.js'
import * as coverageLedgerLib from './documentIntelligence/coverageLedger.js'
import * as exactToolsLib from './documentIntelligence/exactTools.js'
import * as semanticExtractorLib from './documentIntelligence/semanticExtractor.js'
import * as synthesizerLib from './documentIntelligence/synthesizer.js'
import * as verifierLib from './documentIntelligence/verifier.js'
import * as ragStoreLib from './documentIntelligence/ragStore.js'
import * as documentIntelligenceStorageLib from './documentIntelligence/storage.js'

const documentIntelligence = {
  reader: documentReaderLib,
  chunkPlanner: chunkPlannerLib,
  coverageLedger: coverageLedgerLib,
  exactTools: exactToolsLib,
  semanticExtractor: semanticExtractorLib,
  synthesizer: synthesizerLib,
  verifier: verifierLib,
  ragStore: ragStoreLib,
  storage: documentIntelligenceStorageLib
}

/* ────────── 工具注册层 ────────── */
import * as toolRegistryLib from './toolRegistry/toolRegistry.js'
import * as toolExecutionPolicyLib from './toolRegistry/toolExecutionPolicy.js'
import * as wpsDocumentToolsLib from './toolRegistry/wpsDocumentTools.js'
import * as toolAuditLib from './toolRegistry/toolAudit.js'

const toolRegistry = {
  registry: toolRegistryLib,
  policy: toolExecutionPolicyLib,
  wpsDocumentTools: wpsDocumentToolsLib,
  audit: toolAuditLib
}

/* ────────── 工作流服务层 ────────── */
import * as workflowValidatorLib from './workflowOrchestration/workflowValidator.js'

const workflowOrchestration = {
  validator: workflowValidatorLib
}

/* ────────── 助手进化治理层 ────────── */
import * as assistantEvolutionAuditLib from './assistantEvolution/auditLedger.js'
import * as assistantEvolutionSuiteLib from './assistantEvolution/evaluationSuite.js'
import * as assistantEvolutionPolicyLib from './assistantEvolution/evolutionPolicy.js'
import * as assistantEvolutionPersistenceLib from './assistantEvolution/evolutionPersistence.js'

const assistantEvolution = {
  audit: assistantEvolutionAuditLib,
  evaluationSuite: assistantEvolutionSuiteLib,
  policy: assistantEvolutionPolicyLib,
  persistence: assistantEvolutionPersistenceLib
}

/* ────────── Schema 层 ────────── */
import * as jsonSchemaValidatorLib from './schema/jsonSchemaValidator.js'

const schema = {
  jsonSchemaValidator: jsonSchemaValidatorLib
}

/* ────────── UI 服务层 ────────── */
import * as virtualListLib from './ui/virtualList.js'

const ui = {
  virtualList: virtualListLib
}

/* ────────── ribbon 辅助 ────────── */
import * as ribbonActionHelpersLib from '../components/ribbon/actionHelpers.js'
import * as ribbonVisibilityHelpersLib from '../components/ribbon/visibilityHelpers.js'

const ribbonHelpers = {
  actions: ribbonActionHelpersLib,
  visibility: ribbonVisibilityHelpersLib
}

/* ────────── 默认导出 ────────── */

export default {
  evolution,
  evolutionExtras,
  assistant,
  perf,
  flags,
  toast,
  host,
  router,
  sendPipeline,
  workflow,
  documentIntelligence,
  toolRegistry,
  workflowOrchestration,
  assistantEvolution,
  schema,
  ui,
  ribbonHelpers
}

export {
  evolution, assistant, perf, flags, toast,
  host, router, workflow, ribbonHelpers, evolutionExtras,
  documentIntelligence, toolRegistry, workflowOrchestration,
  assistantEvolution, schema, ui, sendPipeline
}
