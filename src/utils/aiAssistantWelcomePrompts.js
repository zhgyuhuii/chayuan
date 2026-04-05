const CONFIGURED_OPENINGS = [
  '欢迎使用察元 AI 文档助手。',
  '欢迎回来，察元 AI 文档助手已准备就绪。',
  '你好，我是察元 AI 文档助手。',
  '欢迎来到察元 AI 文档助手。',
  '察元 AI 文档助手已启动。',
  '今天也由察元 AI 文档助手陪你处理文档。',
  '欢迎进入察元 AI 文档助手。',
  '当前智能写作能力已准备完成。'
]

const CONFIGURED_ABILITIES = [
  '我可以帮你编写文档、润色内容、修改错别字，也能协助审核与优化表达。',
  '无论是写材料、改方案，还是统一现有文本风格，我都可以继续协助你完成。',
  '你可以让我起草通知、总结、请示、方案，也可以直接修改当前文档内容。',
  '我可以帮你生成初稿、整理结构、提炼重点，并让表达更清晰、更正式。',
  '写作、润色、校对、审阅、改写，都可以从一句简单的话开始。',
  '我既能帮你处理内容，也能按自然语言执行常见格式修改。',
  '当前文档、选中内容和附件信息都可以成为参考上下文，帮助我给出更贴近场景的结果。',
  '从阅读理解到结果输出，我会尽量把写作、分析、修改这些动作串成连续流程。'
]

const CONFIGURED_ACTIONS = [
  '现在就可以开始。',
  '把你的目标告诉我，我来帮你整理成文。',
  '你可以直接输入需求，或者让我修改当前文档。',
  '从一句“帮我写”或“帮我总结”开始就可以。',
  '先让我给你一个版本，再继续细化也很方便。',
  '现在开始，让文档处理更轻松一些。',
  '你负责思路，我负责整理和优化表达。',
  '随时开始，让写作、审阅和修改都更高效。'
]

const CONFIGURED_SUPPORT_MESSAGES = [
  '软件可长期免费使用，如果你觉得好用，欢迎支持我们。',
  '如果本工具对你有帮助，欢迎支持我们持续优化。',
  '感谢你的使用与信任，欢迎支持我们继续迭代。',
  '若你认可察元 AI 文档助手，欢迎通过下方方式支持我们。'
]

const NOT_CONFIGURED_OPENINGS = [
  '欢迎使用察元 AI 文档助手。',
  '你好，欢迎来到察元 AI 文档助手。',
  '察元 AI 文档助手已准备好。',
  '欢迎进入察元 AI 文档助手。',
  '开始使用前，请先完成模型配置。',
  '当前尚未检测到可用模型。',
  '你好，很高兴见到你。',
  '先配置模型，再开启智能写作。'
]

const NOT_CONFIGURED_GUIDES = [
  '请先前往设置页面完成模型配置。',
  '请先进入模型设置，开启提供商、填写 API 地址与密钥，并刷新模型清单。',
  '请先连接可用模型，连接成功后再开始使用。',
  '请先完成模型连接，然后我就可以帮你处理文档。',
  '请先完成提供商启用和模型清单刷新。',
  '请先完成模型设置后再开始对话。'
]

const NOT_CONFIGURED_VALUES = [
  '配置完成后，即可开始智能写作。',
  '配置完成后，即可体验文档编写、润色、校对和审核等能力。',
  '连接成功后，我就可以帮你写文档、改错别字、优化表达和整理材料。',
  '模型可用后，即可开始对话、生成内容并处理当前文档。',
  '配置成功后，你就可以直接开始常见办公写作任务。',
  '完成这一步后，我才能为你提供完整的 AI 文档处理能力。'
]

function buildConfiguredPrompts() {
  return CONFIGURED_OPENINGS.flatMap((opening, openingIndex) =>
    CONFIGURED_ABILITIES.map((ability, abilityIndex) => {
      const action = CONFIGURED_ACTIONS[(openingIndex + abilityIndex) % CONFIGURED_ACTIONS.length]
      const shouldAppendSupport = (openingIndex * CONFIGURED_ABILITIES.length + abilityIndex) % 7 === 0
      const support = shouldAppendSupport
        ? ` ${CONFIGURED_SUPPORT_MESSAGES[(openingIndex + abilityIndex) % CONFIGURED_SUPPORT_MESSAGES.length]}`
        : ''
      return `${opening}${ability}${action}${support}`
    })
  )
}

function buildNotConfiguredPrompts() {
  return NOT_CONFIGURED_OPENINGS.flatMap((opening, openingIndex) =>
    NOT_CONFIGURED_GUIDES.map((guide, guideIndex) => {
      const value = NOT_CONFIGURED_VALUES[(openingIndex + guideIndex) % NOT_CONFIGURED_VALUES.length]
      return `${opening}${guide}${value}`
    })
  )
}

const CONFIGURED_WELCOME_PROMPTS = buildConfiguredPrompts()
const NOT_CONFIGURED_WELCOME_PROMPTS = buildNotConfiguredPrompts()

function normalizeWelcomeOptions(options = {}) {
  if (typeof options === 'number') {
    return {
      previousIndex: options,
      hasConfiguredModel: true
    }
  }
  return {
    previousIndex: Number.isInteger(options.previousIndex) ? options.previousIndex : -1,
    hasConfiguredModel: options.hasConfiguredModel !== false
  }
}

function getPromptPool(hasConfiguredModel) {
  return hasConfiguredModel ? CONFIGURED_WELCOME_PROMPTS : NOT_CONFIGURED_WELCOME_PROMPTS
}

function getFallbackPrompt(hasConfiguredModel) {
  if (hasConfiguredModel) {
    return '你好，我是察元 AI 文档助手。请告诉我你现在想写什么、看什么，或者准备怎么修改文档。'
  }
  return '欢迎使用察元 AI 文档助手。检测到你尚未配置模型，请先进入设置完成模型配置后再开始使用。'
}

export function getRandomWelcomePrompt(options = {}) {
  const { previousIndex, hasConfiguredModel } = normalizeWelcomeOptions(options)
  const prompts = getPromptPool(hasConfiguredModel)
  if (prompts.length === 0) {
    return {
      index: -1,
      text: getFallbackPrompt(hasConfiguredModel)
    }
  }
  let index = Math.floor(Math.random() * prompts.length)
  if (prompts.length > 1 && index === previousIndex) {
    index = (index + 1) % prompts.length
  }
  return {
    index,
    text: prompts[index]
  }
}
