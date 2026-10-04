/**
 * T1 三维探针（临时排查工具，结论回填后移除）：
 * 探测 ET/WPP/Writer 宿主对象是否具备可承担"文档身份"的 Variables 属性——
 * ①存在 ②可写（Add 后读回） ③持久（另存→关闭→重开再读回）。
 * ③是 load-bearing：Variables 若不随文件落盘，与不可写等价（另存即断链）。
 *
 * 短路铁律（WPP 真机教训：SaveAs 无格式枚举会弹模态框卡死 webview 派发队列）：
 * ①不过（typeof !== 'object'）直接判 ②③ 失败，绝不进入文档闭环——Variables
 * 都不存在，持久性测试无对象。①的证据含活动对象全属性枚举（WPS JS 对象
 * JSON 序列化即属性名清单，ET 实测可 dump 出 130+ 属性名）。
 * 只有 ① 过才跑闭环，且全程 DisplayAlerts=false + 显式格式枚举。
 */

const PROBE_VAR = 'chayuan_t1_probe'

/** Variables 不可用宿主的原生替代载体（C2 身份设计候选）：
 *  ET=CustomDocumentProperties（xlsx docProps/custom.xml），WPP=Tags
 *  （PPT 对象模型原生键值对，设计用途即文档标签/身份）。读写器含防御式回退：
 *  Tags 的 Item(name) 在部分实现里只收索引，回退按 Count 遍历 Name(i)/Value(i)。 */
const NATIVE_CARRIERS = {
  et: {
    prop: 'CustomDocumentProperties',
    add: (doc, marker) => doc.CustomDocumentProperties.Add(PROBE_VAR, false, 4, marker),
    add2: (doc, marker) => doc.CustomDocumentProperties.Add(PROBE_VAR, marker),
    read: (doc) => {
      try {
        return String(doc.CustomDocumentProperties.Item(PROBE_VAR).Value)
      } catch (_) {
        const n = doc.CustomDocumentProperties.Count
        for (let i = 1; i <= n; i++) {
          if (String(doc.CustomDocumentProperties.Item(i).Name) === PROBE_VAR) {
            return String(doc.CustomDocumentProperties.Item(i).Value)
          }
        }
        return ''
      }
    }
  },
  etNames: {
    prop: 'Names',
    // Names.Add 第二参是 RefersTo（公式/区域引用），裸字符串会造出非法名称并
    // 毒化工作簿（SaveAs 序列化时炸 WPS 写盘器，真机实证）——必须用字符串
    // 字面量公式形式 ="value"
    add: (doc, marker) => doc.Names.Add(PROBE_VAR, `="${marker}"`),
    read: (doc) => {
      try {
        const raw = String(doc.Names.Item(PROBE_VAR).Value || doc.Names.Item(PROBE_VAR).RefersTo || '')
        return raw.replace(/^=/, '').replace(/^"/, '').replace(/"$/, '')
      } catch (_) {
        return ''
      }
    }
  },
  wpp: {
    prop: 'Tags',
    add: (doc, marker) => doc.Tags.Add(PROBE_VAR, marker),
    // 真机实证：Item(name) 不抛错但 .Value 为 undefined——WPS 绑定里 Item(name)
    // 直接返回值字符串；另 tag 名落盘被大写化（大小写不敏感），回退遍历按
    // toUpperCase 比对
    read: (doc) => {
      try {
        const got = doc.Tags.Item(PROBE_VAR)
        if (typeof got === 'string') return got
        if (got && typeof got === 'object' && got.Value !== undefined) return String(got.Value)
      } catch (_) { /* 落入回退遍历 */ }
      try {
        const n = doc.Tags.Count
        for (let i = 1; i <= n; i++) {
          if (String(doc.Tags.Name(i)).toUpperCase() === PROBE_VAR.toUpperCase()) {
            return String(doc.Tags.Value(i))
          }
        }
      } catch (_) { /* ignore */ }
      return ''
    }
  }
  // wps 不设：Writer 的 Variables 生产可用（docLinkId v5.1.5 已部署）
}

/** 遥测心跳：fetch 到本地诊断服务器（不 await，fire-and-forget）。
 *  webview 静默掉线时（无崩溃报告），最后一条心跳即死亡现场。 */
function tell(tag, extra) {
  try {
    const q = extra ? `&e=${encodeURIComponent(String(extra).slice(0, 120))}` : ''
    fetch(`http://127.0.0.1:8888/t?tag=${encodeURIComponent(tag)}${q}`).catch(() => {})
  } catch (_) { /* ignore */ }
}

/** 崩溃容忍日志：每步增量落 PluginStorage（渲染器被 COM 调用炸掉时，
 *  返回值全丢，但重载后 phase=log 仍能读到崩溃前的步骤序列） */
function pluginLogAppend(entry) {
  try {
    const ps = window.Application?.PluginStorage
    if (!ps) return
    const raw = ps.getItem('t1b_probe_log')
    const arr = raw ? (JSON.parse(raw) || []) : []
    arr.push(entry)
    ps.setItem('t1b_probe_log', JSON.stringify(arr.slice(-40)))
  } catch (_) { /* PluginStorage 不可用则降级为无痕 */ }
}

/** 步骤值安全化：COM 代理对象不能进响应（WPP Presentation 循环引用，
 *  响应序列化爆栈 Maximum call stack——真机实证），降级为占位描述 */
function safeStepValue(v) {
  if (v === undefined) return null
  const t = typeof v
  if (t === 'string' || t === 'number' || t === 'boolean') return v
  try {
    JSON.parse(JSON.stringify(v))
    return v
  } catch (_) {
    return '{object:不可序列化}'
  }
}

function probeStep(log, name, fn) {
  tell('step:' + name, 'pre')
  try {
    const rawValue = fn()
    tell('step:' + name, 'post-ok')
    const value = safeStepValue(rawValue)
    log.steps.push({ name, ok: true, value })
    pluginLogAppend({ name, ok: true, brief: String(value).slice(0, 60) })
    return rawValue
  } catch (e) {
    log.steps.push({ name, ok: false, error: String(e?.message || e).slice(0, 300) })
    pluginLogAppend({ name, ok: false, error: String(e?.message || e).slice(0, 300) })
    return undefined
  }
}

/** COM 代理对象的可枚举属性名清单（枚举值恒为 null，但属性名即证据；循环引用时爆栈降级为空） */
function dumpPropNames(obj) {
  try {
    const dumped = JSON.parse(JSON.stringify(obj))
    return { propCount: Object.keys(dumped || {}).length, props: Object.keys(dumped || {}) }
  } catch (e) {
    return { dumpError: String(e?.message || e).slice(0, 120) }
  }
}

/** 定向探测可承载"文档身份"的候选属性（typeof 级，无递归风险）——
 *  Variables 三维判定之外的替代载体清单，直接喂 C2 身份设计 */
const IDENTITY_CANDIDATES = [
  'Variables',
  'CustomDocumentProperties',
  'BuiltinDocumentProperties',
  'Names',
  'CustomXMLParts',
  'ContentTypeProperties',
  'Tags'
]

function probeIdentityCandidates(obj) {
  const out = {}
  for (const key of IDENTITY_CANDIDATES) {
    try {
      const t = typeof obj[key]
      out[key] = t === 'object' ? 'object(有)' : t
    } catch (e) {
      out[key] = 'throw:' + String(e?.message || e).slice(0, 60)
    }
  }
  return out
}

export function runVarsProbe(hostKind, params = {}) {
  tell('enter', hostKind + ' phase=' + (params?.phase || 'full') + ' carrier=' + (params?.carrier || ''))
  const app = window.Application
  const log = {
    probe: 'vars_probe',
    host: hostKind,
    at: new Date().toISOString(),
    steps: []
  }
  if (!app) {
    log.fatal = 'window.Application 不可用'
    return log
  }

  const marker = `t1_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  // 两阶段模式（规避 webview 内 Open 调用挂死风险）：
  // phase=write 建→写→读→存→关（不重开）；重开走 document_open viaOs 既有通道；
  // phase=read 只读当前活动对象上的载体值（持久性判定在调用侧比对 marker）。
  const phase = String(params.phase || 'full')
  // phase=log：读取并清空崩溃容忍日志（webview 被炸掉后取证用）
  if (phase === 'log') {
    tell('log-phase-enter')
    let stored = null
    try {
      const ps = app?.PluginStorage
      tell('log-ps-got')
      tell('log-getitem-pre')
      // key 参数化：默认探针日志，可读任意共享键（如 ai_chat_turn:<id> 回合状态）
      const raw = ps?.getItem(String(params.key || 't1b_probe_log'))
      tell('log-getitem-post')
      stored = raw ? JSON.parse(raw) : null
      if (raw) ps.setItem('t1b_probe_log', '')
    } catch (_) { /* ignore */ }
    return { probe: 'vars_probe', host: hostKind, phase: 'log', crashLog: stored }
  }
  // carrier 选择：et 支持 cdp(4参)/cdp2(2参)/names；wpp 只有 tags；默认 names/tags（主流 API，崩溃风险最低）
  const carrierChoice = String(params.carrier || '').trim()
  // savePath 三原则（真机实证）：①WPS 容器内（沙盒自有目录，写 /tmp 会弹
  // macOS 授权框→SaveAs 调用阻塞不可恢复→webview 表现为掉线）②文件名唯一
  // （覆盖已存在文件弹确认框）③扩展名定格式
  const CONTAINER_DATA = '/Users/zyh/Library/Containers/com.kingsoft.wpsoffice.mac/Data'
  const savePath = String(params.savePath || `${CONTAINER_DATA}/chayuan-t1-${hostKind}-${Date.now()}-probe.${hostKind === 'et' ? 'xlsx' : hostKind === 'wpp' ? 'pptx' : 'docx'}`)

  // 各宿主：活动对象 / 集合 / 新建 / 打开 / 不保存关闭
  const hostApi = {
    et: {
      label: 'ActiveWorkbook',
      getActive: () => app.ActiveWorkbook,
      collection: () => app.Workbooks,
      add: () => app.Workbooks.Add(),
      open: (p) => app.Workbooks.Open(p),
      closeQuiet: (doc) => { try { doc.Saved = true } catch (_) { /* 新建未改或已保存 */ } doc.Close(0) },
      saveAs: (doc, p) => doc.SaveAs(p, app.Enum?.xlOpenXMLWorkbook ?? 51)
    },
    wpp: {
      label: 'ActivePresentation',
      getActive: () => app.ActivePresentation,
      collection: () => app.Presentations,
      add: () => app.Presentations.Add(),
      open: (p) => app.Presentations.Open(p, false, false, true),
      closeQuiet: (doc) => { doc.Close() },
      saveAs: (doc, p) => doc.SaveAs(p, app.Enum?.ppSaveAsOpenXMLPresentation ?? 24)
    },
    wps: {
      label: 'ActiveDocument',
      getActive: () => app.ActiveDocument,
      collection: () => app.Documents,
      add: () => app.Documents.Add(),
      open: (p) => app.Documents.Open(p),
      closeQuiet: (doc) => { try { doc.Saved = true } catch (_) { /* 同上 */ } doc.Close(0) },
      saveAs: (doc, p) => doc.SaveAs2(p, app.Enum?.wdFormatXMLDocument ?? 12)
    }
  }[hostKind]
  if (!hostApi) {
    log.fatal = `未知宿主 ${hostKind}`
    return log
  }

  // ①存在：在用户当前活动对象上只读探测（不创建、不保存任何东西）
  const activeObj = (() => { try { return hostApi.getActive() } catch (_) { return null } })()
  if (!activeObj) {
    log.steps.push({ name: 'vars.exists', ok: false, error: `无活动对象（${hostApi.label}）` })
    log.verdict = { exists: false, writable: false, persistent: false, note: '无活动对象，①②③均无法执行' }
    return log
  }
  let propType = 'undefined'
  try { propType = typeof activeObj.Variables } catch (e) { propType = `throw: ${String(e?.message || e).slice(0, 120)}` }
  const exists = propType === 'object' && !!activeObj.Variables
  log.steps.push({
    name: 'vars.exists',
    ok: exists,
    value: { typeof: propType, identityCandidates: probeIdentityCandidates(activeObj), activeObjectProps: dumpPropNames(activeObj) }
  })

  if (phase === 'read') {
    const wantedKey2 = exists ? null : (hostKind === 'et'
      ? (carrierChoice === 'cdp' || carrierChoice === 'cdp2' ? 'et' : 'etNames')
      : hostKind)
    const readTarget = exists ? 'Variables' : (NATIVE_CARRIERS[wantedKey2]?.prop || null)
    if (!readTarget) {
      log.verdict = { phase: 'read', carrier: null, value: null, note: '无可读载体' }
      return log
    }
    const carrierApi = exists ? null : NATIVE_CARRIERS[wantedKey2]
    const valueRead = probeStep(log, 'carrier.read_active', () => (
      carrierApi ? carrierApi.read(activeObj, PROBE_VAR) : String(activeObj.Variables.Item(PROBE_VAR).Value)
    ))
    log.verdict = { phase: 'read', carrier: readTarget, value: valueRead === undefined ? null : String(valueRead) }
    return log
  }

  // 短路铁律：Variables 不存在 → ②③的 Variables 测试注定失败；但改测
  // 原生替代载体（ET=CustomDocumentProperties、WPP=Tags）——若可写可持久，
  // C2 无需 sidecar 映射表，直接统一三级作用域。仍走同一防弹窗闭环。
  if (!exists) {
    const wanted = hostKind === 'et'
      ? (carrierChoice === 'cdp' || carrierChoice === 'cdp2' ? 'et' : 'etNames')
      : (NATIVE_CARRIERS[hostKind] ? hostKind : null)
    const carrier = wanted ? NATIVE_CARRIERS[wanted] : null
    if (!carrier) {
      log.verdict = { exists: false, writable: false, persistent: false, note: '①未过已短路：Variables 不存在，且本宿主无替代载体可测' }
      return log
    }
    const carrierExists = (() => { try { return typeof activeObj[carrier.prop] === 'object' && !!activeObj[carrier.prop] } catch (_) { return false } })()
    if (!carrierExists) {
      log.verdict = { exists: false, writable: false, persistent: false, note: `Variables 与 ${carrier.prop} 均不存在` }
      return log
    }
    log.carrierProbe = carrier.prop + (carrierChoice === 'cdp2' ? '(2参)' : '')
  }

  // ②③：自建新文档上做写读 + 另存闭环（DisplayAlerts=false + 显式格式枚举）
  // 载体读写器：Variables 优先，否则原生替代载体
  const wantedKey = exists ? null : (hostKind === 'et'
    ? (carrierChoice === 'cdp' || carrierChoice === 'cdp2' ? 'et' : 'etNames')
    : hostKind)
  const carrier = wantedKey ? NATIVE_CARRIERS[wantedKey] : null
  const carrierProp = exists ? 'Variables' : (log.carrierProbe || null)
  const reader = carrierProp === 'Variables'
    ? (doc) => String(doc.Variables.Item(PROBE_VAR).Value)
    : carrierProp && carrier ? (doc) => carrier.read(doc, PROBE_VAR) : null
  const adder = carrierChoice === 'cdp2' && carrier?.add2 ? carrier.add2 : carrier?.add
  const writer = carrierProp === 'Variables'
    ? (doc) => doc.Variables.Add(PROBE_VAR, marker)
    : carrierProp && carrier ? (doc) => adder(doc, marker) : null
  // 内联弹窗抑制（不 import hostDispatch，避免新增模块加载序影响 webview 启动）
  let prevAlerts = null
  try { prevAlerts = app.DisplayAlerts; app.DisplayAlerts = false } catch (_) { /* 宿主不支持则跳过 */ }
  const cycle = (() => {
    const inner = []
    if (!carrierProp || !writer || !reader) {
      inner.push({ verdict: { exists, writable: false, persistent: false, note: '无可测载体' } })
      return { inner }
    }
    const prevName = probeStep({ steps: inner }, 'prev_active', () => String(hostApi.getActive()?.Name || '')) || ''
    const newDoc = probeStep({ steps: inner }, 'doc.create', () => hostApi.add())
    if (!newDoc) {
      inner.push({ verdict: { exists, writable: false, persistent: false, note: '无法创建探针文档' } })
      return { inner, prevName }
    }
    probeStep({ steps: inner }, 'carrier.add', () => writer(newDoc))
    const readBack = probeStep({ steps: inner }, 'carrier.readback', () => reader(newDoc))
    probeStep({ steps: inner }, 'doc.saveas', () => { hostApi.saveAs(newDoc, savePath); return savePath })
    probeStep({ steps: inner }, 'doc.close', () => hostApi.closeQuiet(newDoc))
    let persistRead = null
    if (phase === 'full') {
      const reopened = probeStep({ steps: inner }, 'doc.reopen', () => hostApi.open(savePath))
      if (reopened) {
        persistRead = probeStep({ steps: inner }, 'carrier.persist_read', () => reader(reopened))
        probeStep({ steps: inner }, 'doc.cleanup_close', () => hostApi.closeQuiet(reopened))
      }
    }
    if (prevName) {
      probeStep({ steps: inner }, 'restore_active', () => { hostApi.collection().Item(prevName).Activate(); return prevName })
    }
    const savedOk = inner.some(x => x.name === 'doc.saveas' && x.ok)
    inner.push({
      verdict: {
        phase,
        exists,
        carrier: carrierProp,
        writable: readBack === marker,
        saved: savedOk,
        persistent: phase === 'full' ? persistRead === marker : null,
        savePath
      }
    })
    return { inner, prevName }
  })()
  try { if (prevAlerts !== null) app.DisplayAlerts = prevAlerts } catch (_) { /* ignore */ }
  log.steps.push(...(cycle?.inner || []))
  const innerVerdict = (cycle?.inner || []).find(s => s.verdict)?.verdict
  log.verdict = innerVerdict || { exists, writable: false, persistent: false, note: '闭环异常' }
  return log
}
