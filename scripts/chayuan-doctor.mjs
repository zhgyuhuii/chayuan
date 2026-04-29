#!/usr/bin/env node
/**
 * chayuan-doctor — 察元加载项的"自检脚本"
 *
 * 检查项目当前的工程状态:
 *   - P0/P1/P2/P3 各阶段交付的关键文件是否在位 + 语法合法
 *   - 关键集成点是否已接线(main.js / App.vue)
 *   - 是否还有遗留的 alert+console.error 模式(说明 codemod 没跑全)
 *   - 文件体积健康度(单文件 > 1000 行会标注,> 5000 行警告)
 *   - 进化系统所需依赖是否齐全
 *
 * 用法:
 *   node scripts/chayuan-doctor.mjs           # 完整自检
 *   node scripts/chayuan-doctor.mjs --quick   # 跳过逐文件 node --check(快 5x)
 *   node scripts/chayuan-doctor.mjs --json    # 输出 JSON,便于 CI 消费
 *
 * 退出码:
 *   0  全部通过
 *   1  有 ⚠ 警告(不影响运行)
 *   2  有 ✗ 错误(可能影响功能)
 */

import { readFile, readdir, stat } from 'node:fs/promises'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

const args = process.argv.slice(2)
const QUICK = args.includes('--quick')
const JSON_OUT = args.includes('--json')

/* ────────── 必检文件清单(按阶段分组) ────────── */

const FILE_PLAN = {
  'P0 — host bridge + 进化骨架': [
    'src/utils/host/hostBridge.js',
    'src/utils/host/selectionToken.js',
    'src/utils/host/showAdaptiveDialog.js',
    'src/utils/host/withScreenLock.js',
    'src/utils/assistant/evolution/signalStore.js',
    'src/utils/assistant/evolution/gateProfiles.js',
    'src/utils/assistant/evolution/anchorPrompt.js',
    'src/utils/assistant/evolution/raceEvaluator.js',
    'src/utils/throttledPersist.js',
    'src/utils/reportError.js'
  ],
  'P1 — 并发 + 评测': [
    'src/utils/concurrentRunner.js',
    'src/utils/chatApiEnhancers.js',
    'src/utils/router/localIntentClassifier.js',
    'src/utils/assistant/evolution/failureCluster.js',
    'src/utils/assistant/evolution/candidateGenerator.js',
    'src/utils/assistant/evolution/judge.js',
    'src/utils/assistant/evolution/shadowRunner.js',
    'src/utils/assistant/evolution/rollbackMonitor.js'
  ],
  'P2 — UI/UE': [
    'src/assets/tokens.css',
    'src/assets/motion.css',
    'src/components/common/DialogShell.vue',
    'src/components/common/SelectionContextChip.vue',
    'src/components/common/IntentPill.vue',
    'src/components/common/DiffPreviewCard.vue',
    'src/components/common/CommandPalette.vue',
    'src/components/common/AssistantHealthSparkline.vue',
    'src/utils/router/sendMessageEnhanced.js',
    'scripts/codemod-alert-to-reportError.mjs'
  ],
  'P3 — 编排闭环 + ⌘K': [
    'src/utils/assistant/evolution/promotionFlow.js',
    'src/utils/assistant/evolution/registryAdapter.js',
    'src/utils/assistant/evolution/scheduler.js',
    'src/utils/assistant/evolution/evolutionBoot.js',
    'src/components/common/EvolutionStatusPanel.vue',
    'src/utils/router/commandRegistry.js',
    'src/components/common/CommandPaletteHost.vue',
    'src/utils/router/ribbonCommands.js',
    'src/utils/router/evolutionCommands.js',
    'src/utils/assistant/builtinAssistantsExtra.js',
    'src/components/common/AssistantBadgeRow.vue',
    'src/utils/router/enhancedChatApi.js',
    'src/utils/perfTracker.js',
    'src/components/common/PerfStatsPanel.vue',
    'src/components/EvolutionPage.vue',
    'src/components/PerfPage.vue',
    'src/utils/assistant/evolution/bootHelpers.js',
    'src/utils/router/themeToggle.js',
    'src/utils/router/modelCommands.js',
    'src/components/common/WelcomeBanner.vue'
  ],
  'P4 — 真集成 / 性能落地': [
    'src/utils/router/enhancedSend.js',
    'src/components/ribbon/modelHelpers.js'
  ],
  'P5 — 生态扩展': [
    'src/utils/assistant/builtinAssistantsP5.js',
    'src/utils/i18n.js',
    'src/utils/assistant/externalAssistants.js',
    'src/components/MarketplacePage.vue'
  ],
  '缺口闭合 — P0 补全': [
    'src/utils/router/routerModelSettings.js',
    'src/components/ribbon/visibilityHelpers.js',
    'scripts/find-dead-cases.mjs'
  ],
  '缺口闭合 — P1 补全': [
    'src/utils/router/routerParallelDecider.js',
    'src/utils/host/undoChainBundle.js',
    'src/utils/router/taskProgressBroadcast.js'
  ],
  '缺口闭合 — P2 补全': [
    'src/components/DialogDemoPage.vue',
    'src/components/WelcomePage.vue'
  ],
  '缺口闭合 — P3 进化 UI 补全': [
    'src/components/common/EvolutionVersusPanel.vue',
    'src/components/common/FailureTimeline.vue',
    'src/utils/assistant/evolution/sovereigntyStore.js'
  ],
  '缺口闭合 — P3 模块化最小可行版': [
    'src/utils/router/dialogPlugins.js',
    'src/components/ribbon/actionHelpers.js',
    'src/utils/host/createDialogSession.js'
  ],
  '缺口闭合 — P4 能力总线': [
    'src/utils/router/capabilityBus.js',
    'src/utils/router/ribbonBusDispatcher.js',
    'src/utils/host/opQueue.js',
    'scripts/build-capability-catalog.mjs',
    'src/components/common/PolicyAuditPanel.vue',
    'src/utils/assistant/teamShare.js'
  ],
  '缺口闭合 — P5 生态扩展': [
    'src/utils/assistant/evolution/rolloutBucketing.js',
    'src/utils/assistant/builtinAssistantsP5Plus.js',
    'src/utils/assistant/skillScanner.js',
    'src/utils/assistant/marketplaceManager.js',
    'src/components/EvolutionDashboard.vue',
    'src/utils/personalMemory.js'
  ],
  'P6 Tier 1 — 必须立即做': [
    'src/utils/router/enhancedSendIntegration.js',
    'src/utils/featureFlags.js',
    'src/utils/host/chatCompletionWithShadow.js',
    'src/utils/toastService.js',
    'src/components/common/ToastContainer.vue',
    'src/components/common/MessageList.vue',
    'src/utils/assistant/evolution/installEvolutionScheduler.js'
  ],
  'P6 Tier 2 — 短期改进': [
    'src/assets/dark-mode-fixes.css',
    'scripts/audit-dark-mode.mjs',
    'src/utils/assistant/evolution/judgeFallback.js',
    'src/utils/assistant/evolution/signalStoreIDB.js',
    'src/components/common/ErrorBoundary.vue',
    'src/utils/assistant/anchorAutoRegister.js',
    'src/utils/host/rateLimiter.js',
    'src/components/common/Collapsible.vue',
    'src/utils/router/focusTrap.js'
  ],
  'P6 Tier 3 — 平台演进': [
    'src/types/index.d.ts',
    'src/utils/host/leaderElection.js',
    'src/workers/clusterWorker.js',
    'src/workers/clusterClient.js',
    'src/utils/chatApiAbortAware.js',
    'src/utils/host/opfsStorage.js',
    'src/router/guards.js',
    'src/services/index.js'
  ],
  'P6 Tier 4 — 长期 / 产品化': [
    'src/utils/licenseStore.js',
    'src/utils/assistant/ragIndex.js',
    'src/utils/chatApiMultimodal.js',
    'src/utils/telemetryPipeline.js',
    'src/utils/assistant/marketplaceCryptoSigner.js',
    'src/utils/assistant/evolution/abTestStats.js',
    'scripts/audit-i18n.mjs',
    'src/utils/referralEngine.js'
  ],
  'W1 — 工作流基础修复': [
    'src/utils/workflow/workflowInstanceStore.js',
    'src/utils/workflow/workflowProgressChannel.js',
    'src/utils/workflow/workflowTelemetryBridge.js',
    'src/components/common/WorkflowResumeDialog.vue'
  ],
  'W2 — 工作流 P0 节点': [
    'src/utils/workflow/workflowToolsExtra.js'
  ],
  'W3 — 工作流 P1 节点 + 错误处理': [
    'src/utils/workflow/workflowToolsP1.js',
    'src/utils/workflow/retryPolicy.js'
  ],
  'W4 — 工作流编辑器增强': [
    'src/components/common/WorkflowCostPreview.vue',
    'src/components/common/WorkflowVariablesPanel.vue',
    'src/components/common/WorkflowTimeline.vue',
    'src/components/common/WorkflowJsonView.vue',
    'src/components/common/WorkflowDebugger.vue'
  ],
  'W5 — 工作流模板与共享': [
    'src/utils/workflow/workflowTemplates.js',
    'src/utils/workflow/workflowShare.js',
    'src/utils/workflow/workflowMarketCommands.js',
    'src/utils/workflow/workflowDiff.js'
  ],
  'W6 — 工作流进化集成': [
    'src/utils/workflow/workflowEvolution.js'
  ],
  'W7 — 工作流高级特性': [
    'src/utils/workflow/codeSandbox.js',
    'src/utils/workflow/workflowToolsP2.js',
    'src/utils/workflow/workflowTrigger.js',
    'src/utils/workflow/workflowReplay.js'
  ],
  'T — 任务系统重设计': [
    'src/utils/task/taskKernel.js',
    'src/utils/task/taskEventBus.js',
    'src/utils/task/taskTieredStorage.js',
    'src/utils/task/taskAchievement.js',
    'src/utils/task/taskTimeCapsule.js',
    'src/utils/router/taskCommands.js',
    'src/components/common/TaskCelebration.vue',
    'src/components/common/TaskFilters.vue',
    'src/components/common/TaskDetailCard.vue',
    'src/components/common/TaskBatchActions.vue',
    'src/components/common/TaskListVirtual.vue',
    'src/components/TaskCenterPage.vue'
  ],
  'X — 运行性缺口闭合': [
    'src/utils/assistant/runtimeAssistantsInstaller.js',
    'src/assets/settings-form-vertical.css',
    'src/utils/spellCheckPerfWrapper.js'
  ],
  'Y — 集成审计 + 功能总览': [
    'scripts/integration-audit.mjs',
    'src/components/FeatureTourPage.vue',
    'STATUS.md'
  ],
  'Z — 整合控制台': [
    'src/components/ControlPanelPage.vue'
  ]
}

/* ────────── 集成点(关键字符串必须存在) ────────── */

const INTEGRATION_CHECKS = [
  {
    file: 'src/main.js',
    must: [
      `import './assets/tokens.css'`,
      `import './assets/motion.css'`,
      `installGlobalShortcut`
    ],
    label: 'main.js 已加载 tokens / motion / ⌘K shortcut'
  },
  {
    file: 'src/App.vue',
    must: ['CommandPaletteHost', 'registerRibbonCommands'],
    label: 'App.vue 已挂 CommandPaletteHost + ribbonCommands'
  }
]

/* ────────── 工具 ────────── */

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', gray: '\x1b[90m'
}
const ICON_OK = `${C.green}✓${C.reset}`
const ICON_WARN = `${C.yellow}⚠${C.reset}`
const ICON_BAD = `${C.red}✗${C.reset}`

const out = (msg) => { if (!JSON_OUT) process.stdout.write(msg) }
const log = (msg = '') => out(msg + '\n')

const report = {
  files: {},
  integration: [],
  codemod: { remainingMatches: 0, files: [] },
  largeFiles: [],
  summary: { ok: 0, warn: 0, bad: 0 }
}

async function exists(p) {
  try { await stat(p); return true } catch { return false }
}

async function checkSyntax(absPath) {
  if (QUICK) return { ok: true, skipped: true }
  const ext = absPath.split('.').pop().toLowerCase()
  if (ext === 'css' || ext === 'md') return { ok: true, skipped: true }
  try {
    if (ext === 'vue') {
      const src = await readFile(absPath, 'utf-8')
      const m = src.match(/<script[^>]*>([\s\S]*?)<\/script>/)
      if (!m) return { ok: true, skipped: true, note: 'no <script>' }
      const tmp = `/tmp/_doctor_${Date.now()}_${Math.random().toString(36).slice(2,8)}.mjs`
      const { writeFile, unlink } = await import('node:fs/promises')
      await writeFile(tmp, m[1])
      try {
        execSync(`node --input-type=module --check < "${tmp}"`, { stdio: 'pipe' })
        await unlink(tmp).catch(() => {})
        return { ok: true }
      } catch (e) {
        await unlink(tmp).catch(() => {})
        return { ok: false, error: String(e.stderr || e.message || e).split('\n').slice(0, 3).join(' | ') }
      }
    }
    execSync(`node --check "${absPath}"`, { stdio: 'pipe' })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e.stderr || e.message || e).split('\n').slice(0, 3).join(' | ') }
  }
}

/* ────────── 检查器 ────────── */

async function checkFiles() {
  log(`${C.bold}${C.cyan}┌─ 文件清单${C.reset}`)
  for (const [phase, files] of Object.entries(FILE_PLAN)) {
    log(`${C.cyan}│${C.reset}  ${C.bold}${phase}${C.reset}`)
    const phaseEntry = { ok: 0, missing: [], invalid: [] }
    for (const rel of files) {
      const abs = join(REPO_ROOT, rel)
      const has = await exists(abs)
      if (!has) {
        log(`${C.cyan}│${C.reset}    ${ICON_BAD} ${rel} ${C.dim}(缺失)${C.reset}`)
        phaseEntry.missing.push(rel)
        report.summary.bad += 1
        continue
      }
      const syn = await checkSyntax(abs)
      if (!syn.ok) {
        log(`${C.cyan}│${C.reset}    ${ICON_BAD} ${rel} ${C.dim}— ${syn.error || 'syntax error'}${C.reset}`)
        phaseEntry.invalid.push({ rel, error: syn.error })
        report.summary.bad += 1
        continue
      }
      log(`${C.cyan}│${C.reset}    ${ICON_OK} ${rel}${syn.skipped ? ` ${C.dim}(skipped)${C.reset}` : ''}`)
      phaseEntry.ok += 1
      report.summary.ok += 1
    }
    report.files[phase] = phaseEntry
  }
  log(`${C.cyan}└─${C.reset}`)
  log()
}

async function checkIntegration() {
  log(`${C.bold}${C.cyan}┌─ 集成点${C.reset}`)
  for (const c of INTEGRATION_CHECKS) {
    const abs = join(REPO_ROOT, c.file)
    if (!(await exists(abs))) {
      log(`${C.cyan}│${C.reset}  ${ICON_BAD} ${c.label} ${C.dim}— ${c.file} 不存在${C.reset}`)
      report.integration.push({ file: c.file, status: 'missing' })
      report.summary.bad += 1
      continue
    }
    const src = await readFile(abs, 'utf-8')
    const missing = c.must.filter(s => !src.includes(s))
    if (missing.length === 0) {
      log(`${C.cyan}│${C.reset}  ${ICON_OK} ${c.label}`)
      report.integration.push({ file: c.file, status: 'ok' })
      report.summary.ok += 1
    } else {
      log(`${C.cyan}│${C.reset}  ${ICON_WARN} ${c.label} ${C.dim}— 缺: ${missing.join(', ')}${C.reset}`)
      report.integration.push({ file: c.file, status: 'partial', missing })
      report.summary.warn += 1
    }
  }
  log(`${C.cyan}└─${C.reset}`)
  log()
}

async function checkCodemodLeftovers() {
  log(`${C.bold}${C.cyan}┌─ 错误兜底 codemod 状态${C.reset}`)
  // 用 codemod 自身做 dry-run,统计残留量
  let dryStdout = ''
  try {
    dryStdout = execSync('node scripts/codemod-alert-to-reportError.mjs', { cwd: REPO_ROOT }).toString()
  } catch (e) {
    log(`${C.cyan}│${C.reset}  ${ICON_WARN} codemod 自检失败:${e.message}`)
    report.summary.warn += 1
    log(`${C.cyan}└─${C.reset}\n`)
    return
  }
  const m = dryStdout.match(/汇总:(\d+)\s*个文件,(\d+)\s*处替换/)
  const fileCount = m ? +m[1] : 0
  const matchCount = m ? +m[2] : 0
  report.codemod.remainingMatches = matchCount
  if (matchCount === 0) {
    log(`${C.cyan}│${C.reset}  ${ICON_OK} 无残留 alert+console.error 失败模式`)
    report.summary.ok += 1
  } else {
    log(`${C.cyan}│${C.reset}  ${ICON_WARN} 还有 ${matchCount} 处可被 codemod 处理(${fileCount} 个文件)`)
    log(`${C.cyan}│${C.reset}    ${C.dim}运行: node scripts/codemod-alert-to-reportError.mjs --apply${C.reset}`)
    report.summary.warn += 1
  }
  log(`${C.cyan}└─${C.reset}`)
  log()
}

async function checkLargeFiles() {
  log(`${C.bold}${C.cyan}┌─ 大文件健康度${C.reset}`)
  const candidates = [
    'src/components/ribbon.js',
    'src/components/AIAssistantDialog.vue',
    'src/utils/assistantRegistry.js'
  ]
  // 体积大不影响"能不能跑",只是建议项 → 永远不升级到 ✗
  for (const rel of candidates) {
    const abs = join(REPO_ROOT, rel)
    if (!(await exists(abs))) continue
    const src = await readFile(abs, 'utf-8')
    const lines = src.split('\n').length
    let icon = ICON_OK, severity = 'ok', hint = ''
    if (lines > 10000) { icon = ICON_WARN; severity = 'warn'; hint = ' (强烈建议拆分)' }
    else if (lines > 2000) { icon = ICON_WARN; severity = 'warn'; hint = ' (建议拆分)' }
    log(`${C.cyan}│${C.reset}  ${icon} ${rel}: ${C.bold}${lines}${C.reset} 行${C.dim}${hint}${C.reset}`)
    report.largeFiles.push({ rel, lines, severity })
    if (severity === 'ok') report.summary.ok += 1
    else report.summary.warn += 1
  }
  log(`${C.cyan}└─${C.reset}`)
  log()
}

async function checkMemoryDir() {
  log(`${C.bold}${C.cyan}┌─ Claude 记忆系统${C.reset}`)
  const memDir = '/root/.claude/projects/-work-chayuan/memory'
  if (!(await exists(memDir))) {
    log(`${C.cyan}│${C.reset}  ${C.dim}(memory dir 不存在,跳过)${C.reset}`)
  } else {
    try {
      const list = await readdir(memDir)
      const md = list.filter(f => f.endsWith('.md'))
      const idx = md.find(f => f === 'MEMORY.md')
      log(`${C.cyan}│${C.reset}  ${ICON_OK} ${md.length} 条记忆${idx ? '(含 MEMORY.md 索引)' : ''}`)
    } catch (e) {
      log(`${C.cyan}│${C.reset}  ${ICON_WARN} 读取 memory dir 失败:${e.message}`)
    }
  }
  log(`${C.cyan}└─${C.reset}`)
  log()
}

/* ────────── 主流程 ────────── */

async function main() {
  if (!JSON_OUT) {
    log(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗${C.reset}`)
    log(`${C.bold}${C.cyan}║  chayuan-doctor — 察元加载项工程状态自检${'                '} ║${C.reset}`)
    log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════╝${C.reset}`)
    log(`  ${C.dim}repo: ${relative(process.cwd(), REPO_ROOT) || '.'} · 模式: ${QUICK ? 'QUICK' : 'FULL'}${C.reset}`)
    log()
  }

  await checkFiles()
  await checkIntegration()
  await checkCodemodLeftovers()
  await checkLargeFiles()
  await checkMemoryDir()

  const { ok, warn, bad } = report.summary
  const total = ok + warn + bad

  if (JSON_OUT) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  } else {
    log(`${C.bold}总计:${C.reset} ${total} 项检查 · ${C.green}${ok} 通过${C.reset} · ${C.yellow}${warn} 警告${C.reset} · ${C.red}${bad} 错误${C.reset}`)
    if (bad > 0) log(`${C.red}${C.bold}  → 有错误项,请优先修复${C.reset}`)
    else if (warn > 0) log(`${C.yellow}  → 全部关键检查通过,有可优化项${C.reset}`)
    else log(`${C.green}${C.bold}  → 全绿 ✨${C.reset}`)
  }

  process.exit(bad > 0 ? 2 : (warn > 0 ? 1 : 0))
}

main().catch(err => {
  console.error(`${C.red}doctor 自身崩溃:${C.reset}`, err)
  process.exit(3)
})
