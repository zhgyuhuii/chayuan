import { getCurrentDocumentSavePath } from './documentFileActions.js'
import { getSelectionContextSnapshot } from './documentContext.js'

function parseRequestedPageNumber(text = '') {
  const matched = String(text || '').match(/第\s*([0-9]{1,4})\s*页/)
  return matched ? Number(matched[1]) : 0
}

function parseTableShape(text = '') {
  const normalized = String(text || '')
  const matched = normalized.match(/([0-9]{1,3})\s*[xX＊*]\s*([0-9]{1,3})/)
  if (matched) {
    return {
      rows: Math.max(1, Number(matched[1] || 0)),
      columns: Math.max(1, Number(matched[2] || 0))
    }
  }
  const rowsMatched = normalized.match(/([0-9]{1,3})\s*行/)
  const columnsMatched = normalized.match(/([0-9]{1,3})\s*列/)
  return {
    rows: Math.max(1, Number(rowsMatched?.[1] || 3)),
    columns: Math.max(1, Number(columnsMatched?.[1] || 3))
  }
}

function buildPageNumberDefault(text = '') {
  const parsed = parseRequestedPageNumber(text)
  if (parsed > 0) return parsed
  const snapshot = getSelectionContextSnapshot()
  const currentPage = Number(snapshot?.documentStats?.currentPage || 0)
  return currentPage > 0 ? currentPage : 1
}

function buildSavePathDefault() {
  return getCurrentDocumentSavePath() || ''
}

export const WPS_CAPABILITIES = [
  {
    capabilityKey: 'save-document',
    label: '保存文档',
    category: 'document-file',
    description: '保存当前已打开的文档。',
    routingPromptHint: '当用户明确要求保存当前文档、保存文件时使用。',
    executeMode: 'direct',
    executorKey: 'save-document',
    requiredParams: [],
    optionalParams: [
      {
        key: 'savePath',
        label: '保存路径',
        type: 'path',
        placeholder: '当前文档未保存时，可填写保存路径',
        required: false,
        defaultResolver: () => buildSavePathDefault()
      }
    ]
  },
  {
    capabilityKey: 'save-document-as',
    label: '文档另存为',
    category: 'document-file',
    description: '将当前文档另存为新的路径。',
    routingPromptHint: '当用户要求另存为、保存到某个位置、导出到指定路径时使用。',
    executeMode: 'direct',
    executorKey: 'save-document-as',
    requiredParams: [
      {
        key: 'savePath',
        label: '保存路径',
        type: 'path',
        placeholder: '请输入完整保存路径，例如 /Users/name/Desktop/文档.docx',
        required: true,
        defaultResolver: () => buildSavePathDefault()
      }
    ],
    optionalParams: []
  },
  {
    capabilityKey: 'save-document-with-dialog',
    label: '选择路径后另存',
    category: 'document-file',
    description: '先弹出保存位置选择，再将当前文档另存到指定路径。',
    routingPromptHint: '当用户希望弹出保存框、手动选择路径后再另存时使用。',
    executeMode: 'direct',
    executorKey: 'save-document-with-dialog',
    requiredParams: [],
    optionalParams: []
  },
  {
    capabilityKey: 'encrypt-document',
    label: '加密文档',
    category: 'document-security',
    description: '为当前文档设置密码并保存。',
    routingPromptHint: '当用户要求给文档加密、设置密码、加保护密码保存时使用。',
    executeMode: 'direct',
    executorKey: 'encrypt-document',
    requiredParams: [
      {
        key: 'password',
        label: '文档密码',
        type: 'password',
        placeholder: '请输入文档密码',
        required: true,
        defaultResolver: () => ''
      }
    ],
    optionalParams: [
      {
        key: 'savePath',
        label: '保存路径',
        type: 'path',
        placeholder: '如需另存为加密文档，可填写新路径',
        required: false,
        defaultResolver: () => buildSavePathDefault()
      }
    ]
  },
  {
    capabilityKey: 'encrypt-document-with-dialog',
    label: '选择路径后加密保存',
    category: 'document-security',
    description: '先选择保存位置，再为当前文档设置密码并保存。',
    routingPromptHint: '当用户希望选择路径后再加密保存、另存为加密文档时使用。',
    executeMode: 'direct',
    executorKey: 'encrypt-document-with-dialog',
    requiredParams: [
      {
        key: 'password',
        label: '文档密码',
        type: 'password',
        placeholder: '请输入文档密码',
        required: true,
        defaultResolver: () => ''
      }
    ],
    optionalParams: []
  },
  {
    capabilityKey: 'decrypt-document',
    label: '解密文档',
    category: 'document-security',
    description: '移除当前文档密码并重新保存。',
    routingPromptHint: '当用户要求解密文档、移除文档密码、取消加密保护时使用。',
    executeMode: 'direct',
    executorKey: 'decrypt-document',
    requiredParams: [],
    optionalParams: [
      {
        key: 'savePath',
        label: '保存路径',
        type: 'path',
        placeholder: '如需另存为解密文档，可填写新路径',
        required: false,
        defaultResolver: () => buildSavePathDefault()
      }
    ]
  },
  {
    capabilityKey: 'insert-table',
    label: '插入表格',
    category: 'document-structure',
    description: '在指定位置插入表格。',
    routingPromptHint: '当用户要求插入表格、创建几行几列表格时使用。',
    executeMode: 'direct',
    executorKey: 'insert-table',
    requiredParams: [
      {
        key: 'rows',
        label: '表格行数',
        type: 'number',
        placeholder: '请输入行数',
        required: true,
        defaultResolver: (text) => parseTableShape(text).rows
      },
      {
        key: 'columns',
        label: '表格列数',
        type: 'number',
        placeholder: '请输入列数',
        required: true,
        defaultResolver: (text) => parseTableShape(text).columns
      },
      {
        key: 'pageNumber',
        label: '插入页码',
        type: 'page-selector',
        placeholder: '请输入页码',
        required: true,
        defaultResolver: (text) => buildPageNumberDefault(text)
      }
    ],
    optionalParams: []
  },
  {
    capabilityKey: 'insert-page-break',
    label: '插入分页符',
    category: 'document-structure',
    description: '在指定位置插入分页符。',
    routingPromptHint: '当用户要求插入分页符、分页时使用。',
    executeMode: 'direct',
    executorKey: 'insert-page-break',
    requiredParams: [
      {
        key: 'pageNumber',
        label: '插入页码',
        type: 'page-selector',
        placeholder: '请输入页码',
        required: true,
        defaultResolver: (text) => buildPageNumberDefault(text)
      }
    ],
    optionalParams: []
  },
  {
    capabilityKey: 'insert-blank-page',
    label: '插入空白页',
    category: 'document-structure',
    description: '在指定位置插入空白页。',
    routingPromptHint: '当用户要求插入空白页、新增空白页时使用。',
    executeMode: 'direct',
    executorKey: 'insert-blank-page',
    requiredParams: [
      {
        key: 'pageNumber',
        label: '插入页码',
        type: 'page-selector',
        placeholder: '请输入页码',
        required: true,
        defaultResolver: (text) => buildPageNumberDefault(text)
      }
    ],
    optionalParams: []
  },
  {
    capabilityKey: 'replace-selection-text',
    label: '替换当前选中内容',
    category: 'document-edit',
    description: '用新文本替换当前选中内容。',
    routingPromptHint: '当用户要求把当前选中文字替换成指定内容时使用。',
    executeMode: 'direct',
    executorKey: 'replace-selection-text',
    requiredParams: [
      {
        key: 'text',
        label: '替换内容',
        type: 'textarea',
        placeholder: '请输入替换后的文本',
        required: true,
        defaultResolver: () => ''
      }
    ],
    optionalParams: []
  },
  {
    capabilityKey: 'paste-text',
    label: '插入文本',
    category: 'document-edit',
    description: '在当前光标或选区位置插入文本。',
    routingPromptHint: '当用户要求粘贴、插入一段文字到当前位置时使用。',
    executeMode: 'direct',
    executorKey: 'paste-text',
    requiredParams: [
      {
        key: 'text',
        label: '插入内容',
        type: 'textarea',
        placeholder: '请输入要插入的文本',
        required: true,
        defaultResolver: () => ''
      }
    ],
    optionalParams: []
  },
  {
    capabilityKey: 'append-text-to-document',
    label: '追加文本到文末',
    category: 'document-edit',
    description: '将文本追加到当前文档末尾。',
    routingPromptHint: '当用户要求把文本追加到文末、文档最后时使用。',
    executeMode: 'direct',
    executorKey: 'append-text-to-document',
    requiredParams: [
      {
        key: 'text',
        label: '追加内容',
        type: 'textarea',
        placeholder: '请输入要追加的文本',
        required: true,
        defaultResolver: () => ''
      }
    ],
    optionalParams: []
  },
  {
    capabilityKey: 'copy-current-paragraph',
    label: '复制当前段落',
    category: 'document-edit',
    description: '把当前段落复制到指定段落前后。',
    routingPromptHint: '当用户要求复制当前段落到某个段落前后时使用。',
    executeMode: 'direct',
    executorKey: 'copy-current-paragraph',
    requiredParams: [
      {
        key: 'destinationIndex',
        label: '目标段落序号',
        type: 'number',
        placeholder: '请输入目标段落序号',
        required: true,
        defaultResolver: () => 1
      }
    ],
    optionalParams: [
      {
        key: 'placement',
        label: '插入位置',
        type: 'select',
        options: ['before', 'after'],
        placeholder: 'before 或 after',
        required: false,
        defaultResolver: () => 'after'
      }
    ]
  },
  {
    capabilityKey: 'duplicate-selection-text',
    label: '复制当前选中内容并插入',
    category: 'document-edit',
    description: '读取当前选中文本，并在当前位置再次插入一份。',
    routingPromptHint: '当用户要求复制当前选中内容、把这段话再插入一份时使用。',
    executeMode: 'direct',
    executorKey: 'duplicate-selection-text',
    requiredParams: [],
    optionalParams: []
  },
  {
    capabilityKey: 'set-font-name',
    label: '设置字体',
    category: 'document-format',
    description: '设置当前选区字体。',
    routingPromptHint: '当用户要求把选中文字改成某种字体时使用。',
    executeMode: 'direct',
    executorKey: 'set-font-name',
    requiredParams: [
      {
        key: 'fontName',
        label: '字体名称',
        type: 'text',
        placeholder: '如 宋体、微软雅黑',
        required: true,
        defaultResolver: () => ''
      }
    ],
    optionalParams: []
  },
  {
    capabilityKey: 'set-font-size',
    label: '设置字号',
    category: 'document-format',
    description: '设置当前选区字号。',
    routingPromptHint: '当用户要求把选中文字调成某个字号时使用。',
    executeMode: 'direct',
    executorKey: 'set-font-size',
    requiredParams: [
      {
        key: 'fontSize',
        label: '字号',
        type: 'number',
        placeholder: '如 12',
        required: true,
        defaultResolver: () => 12
      }
    ],
    optionalParams: []
  },
  {
    capabilityKey: 'set-font-color',
    label: '设置文字颜色',
    category: 'document-format',
    description: '设置当前选区文字颜色。',
    routingPromptHint: '当用户要求把选中文字改成某种颜色时使用。',
    executeMode: 'direct',
    executorKey: 'set-font-color',
    requiredParams: [
      {
        key: 'fontColor',
        label: '文字颜色',
        type: 'text',
        placeholder: '如 红色、#FF0000',
        required: true,
        defaultResolver: () => ''
      }
    ],
    optionalParams: []
  },
  {
    capabilityKey: 'set-background-color',
    label: '设置背景色',
    category: 'document-format',
    description: '设置当前选区背景色或高亮色。',
    routingPromptHint: '当用户要求把选中文字背景改色、高亮时使用。',
    executeMode: 'direct',
    executorKey: 'set-background-color',
    requiredParams: [
      {
        key: 'backgroundColor',
        label: '背景颜色',
        type: 'text',
        placeholder: '如 黄色、#FFFF00',
        required: true,
        defaultResolver: () => ''
      }
    ],
    optionalParams: []
  },
  {
    capabilityKey: 'toggle-bold',
    label: '设置加粗',
    category: 'document-format',
    description: '把当前选区设置为加粗或取消加粗。',
    routingPromptHint: '当用户要求加粗、取消加粗时使用。',
    executeMode: 'direct',
    executorKey: 'toggle-bold',
    requiredParams: [],
    optionalParams: [
      {
        key: 'enabled',
        label: '是否加粗',
        type: 'boolean',
        placeholder: 'true / false',
        required: false,
        defaultResolver: () => true
      }
    ]
  },
  {
    capabilityKey: 'toggle-italic',
    label: '设置斜体',
    category: 'document-format',
    description: '把当前选区设置为斜体或取消斜体。',
    routingPromptHint: '当用户要求斜体、取消斜体时使用。',
    executeMode: 'direct',
    executorKey: 'toggle-italic',
    requiredParams: [],
    optionalParams: [
      {
        key: 'enabled',
        label: '是否斜体',
        type: 'boolean',
        placeholder: 'true / false',
        required: false,
        defaultResolver: () => true
      }
    ]
  },
  {
    capabilityKey: 'toggle-underline',
    label: '设置下划线',
    category: 'document-format',
    description: '把当前选区设置为下划线或取消下划线。',
    routingPromptHint: '当用户要求添加下划线、取消下划线时使用。',
    executeMode: 'direct',
    executorKey: 'toggle-underline',
    requiredParams: [],
    optionalParams: [
      {
        key: 'enabled',
        label: '是否加下划线',
        type: 'boolean',
        placeholder: 'true / false',
        required: false,
        defaultResolver: () => true
      }
    ]
  },
  {
    capabilityKey: 'set-alignment',
    label: '设置对齐方式',
    category: 'document-format',
    description: '设置当前选区段落对齐方式。',
    routingPromptHint: '当用户要求左对齐、居中、右对齐、两端对齐时使用。',
    executeMode: 'direct',
    executorKey: 'set-alignment',
    requiredParams: [
      {
        key: 'alignment',
        label: '对齐方式',
        type: 'select',
        options: ['left', 'center', 'right', 'justify'],
        placeholder: 'left / center / right / justify',
        required: true,
        defaultResolver: () => 'left'
      }
    ],
    optionalParams: []
  },
  {
    capabilityKey: 'set-line-spacing',
    label: '设置行距',
    category: 'document-format',
    description: '设置当前选区段落行距。',
    routingPromptHint: '当用户要求设置 1.5 倍行距、双倍行距等时使用。',
    executeMode: 'direct',
    executorKey: 'set-line-spacing',
    requiredParams: [
      {
        key: 'lineSpacing',
        label: '行距',
        type: 'text',
        placeholder: '如 1.5、double',
        required: true,
        defaultResolver: () => '1.5'
      }
    ],
    optionalParams: []
  },
  {
    capabilityKey: 'new-document-from-template',
    label: '从模板新建文档',
    category: 'document-file',
    description: '复制模板库中的模板（或空白模板）为新文件并打开，不做内容改写。同宿主约束：模板类型须与当前宿主一致。',
    routingPromptHint: '当用户要求从模板新建、用模板开一份新文档/表格/PPT（不含内容生成诉求）时使用。',
    executeMode: 'direct',
    executorKey: 'new-document-from-template',
    requiredParams: [
      {
        key: 'templateRef',
        label: '模板名称或路径',
        type: 'text',
        placeholder: '模板库名（如「合同模板」）、完整路径，或填「空白」新建；已上传模板附件时可填「附件」',
        required: true,
        defaultResolver: () => ''
      }
    ],
    optionalParams: []
  },
  {
    capabilityKey: 'generate-from-template',
    label: '从模板生成文档',
    category: 'document-file',
    description: '基于用户模板（库名/路径）生成新文档：剖析模板样式结构 → AI 规划改写 → 在模板副本上就地写入内容（保留样式）→ 质检循环 → 另存交付。同宿主约束：模板类型须与当前宿主一致。',
    routingPromptHint: '当用户要求用/按/基于某个模板生成、制作、写一份新文档、表格或 PPT 时使用（带内容生成诉求）。',
    executeMode: 'direct',
    executorKey: 'generate-from-template',
    requiredParams: [
      {
        key: 'templateRef',
        label: '模板名称或路径',
        type: 'text',
        placeholder: '模板库名（如「项目汇报模板」）、完整路径；已上传模板附件时可填「附件」',
        required: true,
        defaultResolver: () => ''
      },
      {
        key: 'requirement',
        label: '生成需求',
        type: 'textarea',
        placeholder: '描述要生成什么内容：主题、要点、受众等',
        required: true,
        defaultResolver: () => ''
      }
    ],
    optionalParams: [
      {
        key: 'pageTarget',
        label: '目标页数',
        type: 'number',
        placeholder: 'PPT 可填目标页数，文档/表格可留空',
        required: false,
        defaultResolver: () => 0
      },
      {
        key: 'toneFollow',
        label: '文案文风',
        type: 'select',
        options: ['跟随模板文风', '自由发挥'],
        placeholder: '新文案是否模仿模板原文案的语体',
        required: false,
        defaultResolver: () => '跟随模板文风'
      },
      {
        key: 'planOnly',
        label: '执行方式',
        type: 'select',
        options: ['先出计划确认', '直接生成'],
        placeholder: '默认先出改写计划（大纲/页计划）供你过目，确认后再写入；也可选直接生成',
        required: false,
        defaultResolver: () => '先出计划确认'
      },
      {
        key: 'savePath',
        label: '交付路径',
        type: 'path',
        placeholder: '质检通过后另存到此路径；留空则打开新文档手动保存',
        required: false,
        defaultResolver: () => ''
      }
    ]
  },
  {
    capabilityKey: 'execute-template-plan',
    label: '确认执行模板生成计划',
    category: 'document-file',
    description: '执行上一步「先出计划确认」暂存的模板改写计划：打开模板副本写入内容、质检并交付。',
    routingPromptHint: '当用户在模板生成计划出来后回复确认执行、按计划执行、开始写入时使用。',
    executeMode: 'direct',
    executorKey: 'execute-template-plan',
    requiredParams: [],
    optionalParams: [
      {
        key: 'savePath',
        label: '交付路径',
        type: 'path',
        placeholder: '可改交付路径；留空沿用计划时设置',
        required: false,
        defaultResolver: () => ''
      }
    ]
  },
  {
    capabilityKey: 'save-current-as-template',
    label: '存为模板',
    category: 'document-file',
    description: '把当前打开的文档/表格/演示另存为模板并登记进本地模板库，之后可从模板新建或 AI 生成时引用。',
    routingPromptHint: '当用户要求把当前文档存为模板、保存成模板、收进模板库时使用。',
    executeMode: 'direct',
    executorKey: 'save-current-as-template',
    requiredParams: [],
    optionalParams: [
      {
        key: 'name',
        label: '模板名称',
        type: 'text',
        placeholder: '缺省用当前文档名',
        required: false,
        defaultResolver: () => ''
      }
    ]
  }
]

export function getWpsCapabilityCatalog() {
  return WPS_CAPABILITIES.map(item => ({
    ...item,
    requiredParams: (item.requiredParams || []).map(param => ({ ...param })),
    optionalParams: (item.optionalParams || []).map(param => ({ ...param }))
  }))
}

export function getWpsCapabilityByKey(key) {
  const normalized = String(key || '').trim()
  return getWpsCapabilityCatalog().find(item => item.capabilityKey === normalized) || null
}
