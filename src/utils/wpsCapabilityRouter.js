import { chatCompletion } from './chatApi.js'
import { getWpsCapabilityCatalog, getWpsCapabilityByKey } from './wpsCapabilityCatalog.js'

function parseJsonCandidate(raw) {
  const text = String(raw || '').trim()
  if (!text) return null
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = block?.[1] ? block[1].trim() : text
  try {
    return JSON.parse(candidate)
  } catch (_) {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1))
      } catch (_) {
        return null
      }
    }
    return null
  }
}

export function routeWpsCapabilityByRule(text = '') {
  const normalized = String(text || '').trim()
  if (!normalized) return null
  if (/(另存为|另存文档|保存到|导出到).{0,24}(文档|文件)?/.test(normalized)) {
    return { capabilityKey: 'save-document-as', confidence: 'high', reason: '命中了另存为/保存到路径的直接操作表述。' }
  }
  if (/(弹出|打开|选择).{0,12}(保存框|保存窗口|保存路径|另存为窗口)/.test(normalized)) {
    return { capabilityKey: 'save-document-with-dialog', confidence: 'high', reason: '命中了先选择保存路径再执行文档保存的直接操作表述。' }
  }
  if (/(保存文档|保存文件|保存当前文档|保存一下文档|保存一下文件)/.test(normalized)) {
    return { capabilityKey: 'save-document', confidence: 'high', reason: '命中了保存文档的直接操作表述。' }
  }
  if (/(加密文档|给文档加密|设置文档密码|给文档设置密码)/.test(normalized)) {
    return { capabilityKey: 'encrypt-document', confidence: 'high', reason: '命中了文档加密/设置密码的直接操作表述。' }
  }
  if (/(解密文档|移除文档密码|取消文档密码|去掉文档密码|取消加密保护)/.test(normalized)) {
    return { capabilityKey: 'decrypt-document', confidence: 'high', reason: '命中了文档解密/移除密码的直接操作表述。' }
  }
  if (/(选择路径|弹出保存框|另存为).{0,12}(加密|密码保护)/.test(normalized)) {
    return { capabilityKey: 'encrypt-document-with-dialog', confidence: 'high', reason: '命中了先选择保存路径再加密保存的直接操作表述。' }
  }
  if (/(插入|新增|加一个).{0,12}(表格)/.test(normalized)) {
    return { capabilityKey: 'insert-table', confidence: 'high', reason: '命中了插入表格的直接操作表述。' }
  }
  if (/(插入|新增|加一个).{0,8}(分页符)/.test(normalized)) {
    return { capabilityKey: 'insert-page-break', confidence: 'high', reason: '命中了插入分页符的直接操作表述。' }
  }
  if (/(插入|新增|加一个).{0,8}(空白页|新页)/.test(normalized)) {
    return { capabilityKey: 'insert-blank-page', confidence: 'high', reason: '命中了插入空白页的直接操作表述。' }
  }
  if (/(替换|改成|修改成).{0,12}(选中|当前选中|这段文字)/.test(normalized)) {
    return { capabilityKey: 'replace-selection-text', confidence: 'high', reason: '命中了替换当前选中内容的直接操作表述。' }
  }
  if (/(插入|粘贴|追加).{0,12}(文字|文本|内容)/.test(normalized)) {
    return { capabilityKey: /(文末|最后)/.test(normalized) ? 'append-text-to-document' : 'paste-text', confidence: 'high', reason: '命中了插入或追加文本的直接操作表述。' }
  }
  if (/(复制).{0,12}(当前段落|这段|本段)/.test(normalized)) {
    return { capabilityKey: 'copy-current-paragraph', confidence: 'high', reason: '命中了复制当前段落的直接操作表述。' }
  }
  if (/(复制|拷贝|再插入一份|重复插入).{0,12}(当前选中|选中文本|这段文字)/.test(normalized)) {
    return { capabilityKey: 'duplicate-selection-text', confidence: 'high', reason: '命中了复制当前选中文本并插入的直接操作表述。' }
  }
  if (/(字体).{0,8}(改为|设为)/.test(normalized)) {
    return { capabilityKey: 'set-font-name', confidence: 'high', reason: '命中了设置字体的直接操作表述。' }
  }
  if (/(字号|字体大小).{0,8}(改为|设为)|改成.{0,6}号字/.test(normalized)) {
    return { capabilityKey: 'set-font-size', confidence: 'high', reason: '命中了设置字号的直接操作表述。' }
  }
  if (/(文字颜色|字色|字体颜色|颜色).{0,8}(改为|设为)/.test(normalized)) {
    return { capabilityKey: 'set-font-color', confidence: 'high', reason: '命中了设置文字颜色的直接操作表述。' }
  }
  if (/(背景色|高亮|底色).{0,8}(改为|设为|标成)/.test(normalized)) {
    return { capabilityKey: 'set-background-color', confidence: 'high', reason: '命中了设置背景色或高亮的直接操作表述。' }
  }
  if (/(加粗)/.test(normalized)) {
    return { capabilityKey: 'toggle-bold', confidence: 'high', reason: '命中了加粗的直接操作表述。' }
  }
  if (/(斜体)/.test(normalized)) {
    return { capabilityKey: 'toggle-italic', confidence: 'high', reason: '命中了斜体的直接操作表述。' }
  }
  if (/(下划线)/.test(normalized)) {
    return { capabilityKey: 'toggle-underline', confidence: 'high', reason: '命中了下划线的直接操作表述。' }
  }
  if (/(左对齐|右对齐|居中|两端对齐)/.test(normalized)) {
    return { capabilityKey: 'set-alignment', confidence: 'high', reason: '命中了段落对齐的直接操作表述。' }
  }
  if (/(行距)/.test(normalized)) {
    return { capabilityKey: 'set-line-spacing', confidence: 'high', reason: '命中了设置行距的直接操作表述。' }
  }
  return null
}

export async function inferWpsCapabilityWithModel(text = '', model = null) {
  if (!model?.providerId || !model?.modelId) return null
  const catalog = getWpsCapabilityCatalog().map(item => ({
    capabilityKey: item.capabilityKey,
    label: item.label,
    category: item.category,
    description: item.description,
    routingPromptHint: item.routingPromptHint
  }))
  const systemPrompt = [
    '你是一个 WPS 直接操作能力路由器，负责判断用户是否在要求直接调用 WPS API，而不是让 AI 生成内容。',
    '只输出合法 JSON，不要输出解释。',
    '如果用户是在要求“保存、另存为、选择路径后保存、加密、选择路径后加密、插入表格、插入空白页、插入分页符”等直接操作，请返回 capabilityKey。',
    '如果不是直接操作，请返回 capabilityKey 为空字符串。',
    'JSON 格式：{"capabilityKey":"","confidence":"high|medium|low","reason":""}'
  ].join('\n')
  const userPrompt = [
    '【用户输入】',
    String(text || '').trim(),
    '',
    '【可用直接操作能力】',
    JSON.stringify(catalog, null, 2)
  ].join('\n')
  try {
    const raw = await chatCompletion({
      providerId: model.providerId,
      modelId: model.modelId,
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
    const parsed = parseJsonCandidate(raw)
    const capabilityKey = String(parsed?.capabilityKey || '').trim()
    if (!capabilityKey || !getWpsCapabilityByKey(capabilityKey)) return null
    return {
      capabilityKey,
      confidence: String(parsed?.confidence || 'low').trim() || 'low',
      reason: String(parsed?.reason || '').trim()
    }
  } catch (_) {
    return null
  }
}

export async function resolveWpsCapabilityRoute(text = '', model = null) {
  const byRule = routeWpsCapabilityByRule(text)
  if (byRule) return byRule
  return inferWpsCapabilityWithModel(text, model)
}
