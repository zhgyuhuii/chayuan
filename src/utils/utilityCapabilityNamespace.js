function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

function safeParseJson(raw, fallback = null) {
  if (raw == null || raw === '') return fallback
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(String(raw))
  } catch (_) {
    return fallback
  }
}

function getByPath(source, path) {
  const normalized = normalizeString(path)
  if (!normalized) return source
  return normalized
    .split('.')
    .filter(Boolean)
    .reduce((acc, key) => {
      if (acc == null) return undefined
      return acc[key]
    }, source)
}

function interpolateTemplate(template, variables = {}) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, rawKey) => {
    const value = getByPath(variables, rawKey)
    return value == null ? '' : String(value)
  })
}

const UTILITY_CAPABILITIES = [
  {
    capabilityKey: 'render-template',
    label: '模板渲染',
    category: 'text',
    description: '按模板与变量输出文本，可在 workflow 中复用统一模板协议。',
    requiredParams: [
      { key: 'template', label: '模板内容', type: 'text', required: true }
    ],
    optionalParams: [
      { key: 'variables', label: '模板变量', type: 'object', required: false },
      { key: 'input', label: '输入文本', type: 'text', required: false }
    ]
  },
  {
    capabilityKey: 'replace-text',
    label: '文本替换',
    category: 'text',
    description: '按普通文本或正则规则替换内容，适合脱敏、字段标准化和格式清洗。',
    requiredParams: [
      { key: 'text', label: '原始文本', type: 'text', required: true },
      { key: 'searchValue', label: '查找内容', type: 'text', required: true }
    ],
    optionalParams: [
      { key: 'replaceValue', label: '替换内容', type: 'text', required: false },
      { key: 'useRegex', label: '是否正则', type: 'boolean', required: false },
      { key: 'regexFlags', label: '正则标记', type: 'text', required: false },
      { key: 'caseSensitive', label: '区分大小写', type: 'boolean', required: false }
    ]
  },
  {
    capabilityKey: 'regex-extract',
    label: '正则提取',
    category: 'text',
    description: '从文本中提取编号、日期、链接等结构化片段。',
    requiredParams: [
      { key: 'text', label: '原始文本', type: 'text', required: true },
      { key: 'pattern', label: '正则表达式', type: 'text', required: true }
    ],
    optionalParams: [
      { key: 'flags', label: '匹配标记', type: 'text', required: false },
      { key: 'matchIndex', label: '匹配序号', type: 'number', required: false },
      { key: 'groupIndex', label: '分组序号', type: 'number', required: false },
      { key: 'joinSeparator', label: '拼接分隔符', type: 'text', required: false }
    ]
  },
  {
    capabilityKey: 'json-extract',
    label: 'JSON 字段提取',
    category: 'data',
    description: '从 JSON 文本或对象中提取指定字段，适合结构化结果复用。',
    requiredParams: [
      { key: 'path', label: '字段路径', type: 'text', required: true }
    ],
    optionalParams: [
      { key: 'jsonText', label: 'JSON 文本', type: 'text', required: false },
      { key: 'payload', label: 'JSON 对象', type: 'object', required: false },
      { key: 'fallbackValue', label: '回退值', type: 'text', required: false }
    ]
  }
]

export function getUtilityCapabilityCatalog() {
  return UTILITY_CAPABILITIES.map(item => ({ ...item }))
}

export function getUtilityCapabilityByKey(key = '') {
  const normalized = normalizeString(key)
  if (!normalized) return null
  return UTILITY_CAPABILITIES.find(item => item.capabilityKey === normalized) || null
}

export function executeUtilityCapabilityDirect(key, params = {}) {
  const capabilityKey = normalizeString(key)
  if (capabilityKey === 'render-template') {
    const variables = params?.variables && typeof params.variables === 'object'
      ? params.variables
      : {}
    const input = params?.input == null ? '' : params.input
    return interpolateTemplate(String(params?.template || ''), {
      ...variables,
      input
    })
  }

  if (capabilityKey === 'replace-text') {
    const text = String(params?.text || '')
    const searchValue = String(params?.searchValue || '')
    if (!searchValue) {
      throw new Error('utility.replace-text 缺少 searchValue')
    }
    const replaceValue = String(params?.replaceValue || '')
    if (params?.useRegex === true) {
      const regex = new RegExp(searchValue, String(params?.regexFlags || 'g') || 'g')
      return text.replace(regex, replaceValue)
    }
    if (params?.caseSensitive === false) {
      const escaped = searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return text.replace(new RegExp(escaped, 'gi'), replaceValue)
    }
    return text.split(searchValue).join(replaceValue)
  }

  if (capabilityKey === 'regex-extract') {
    const text = String(params?.text || '')
    const pattern = String(params?.pattern || '').trim()
    if (!pattern) {
      throw new Error('utility.regex-extract 缺少 pattern')
    }
    const rawFlags = String(params?.flags || 'g')
    const flags = rawFlags.includes('g') ? rawFlags : `${rawFlags}g`
    const regex = new RegExp(pattern, flags)
    const matches = [...text.matchAll(regex)]
    if (!matches.length) return ''
    const groupIndex = Math.max(0, Number(params?.groupIndex || 0))
    const values = matches
      .map(match => match?.[groupIndex] ?? match?.[0] ?? '')
      .filter(Boolean)
    const matchIndex = Number(params?.matchIndex ?? 0)
    return matchIndex === -1
      ? values.join(String(params?.joinSeparator ?? '\n'))
      : (values[matchIndex] ?? '')
  }

  if (capabilityKey === 'json-extract') {
    const payload = params?.payload && typeof params.payload === 'object'
      ? params.payload
      : safeParseJson(params?.jsonText, null)
    if (payload == null) {
      return params?.fallbackValue == null ? '' : params.fallbackValue
    }
    const extracted = getByPath(payload, params?.path)
    return extracted == null || extracted === ''
      ? (params?.fallbackValue == null ? '' : params.fallbackValue)
      : extracted
  }

  throw new Error(`暂未实现 utility 能力：${capabilityKey || 'unknown'}`)
}

