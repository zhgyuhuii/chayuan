/**
 * 模型图标路径：优先使用 public/images/models/logos 下重命名后的图标
 * 根据模型 id 解析为 logos 中的文件名（无则回退到旧路径或占位）
 */

const LOGOS_BASE = 'images/models/logos'

// 模型 id -> logos 中的 basename（不含扩展名），与 logos 目录重命名结果一致
const MODEL_ID_TO_LOGO_BASENAME = {
  OPENAI: 'openai',
  OLLAMA: 'ollama',
  XINFERENCE: 'xinference',
  ONEAPI: 'oneapi',
  FASTCHAT: 'vllm',
  OPENAI_COMPATIBLE: 'api-compatible',
  DEEPSEEK: 'deepseek',
  GEMINI: 'gemini',
  ZHIPU: 'zhipu',
  BAIDU: 'baidu-ai',
  REPLICATE_FAL_AI: 'stability',
  openai: 'openai',
  ollama: 'ollama',
  nvidia: 'nvidia',
  grok: 'grok',
  hyperbolic: 'hyperbolic',
  mistral: 'mistral',
  jina: 'jina',
  perplexity: 'perplexity',
  modelscope: 'modelscope',
  'tianyi-xirang': 'xirang-B42-6Dao',
  'tencent-hunyuan': 'hunyuan',
  'tencent-cloud-ti': 'google',
  'baidu-qianfan': 'qianfan',
  gpustack: 'gpustack-D7EptUU-',
  'voyage-ai': 'voyageai',
  'aws-bedrock': 'aws-bedrock',
  poe: 'poe',
  totoro: 'longcat_logo',
  huggingface: 'huggingface',
  'vercel-ai': 'google',
  cerebras: 'cerebras',
  'xiaomi-mimo': 'mimo',
  'new-api': 'newapi',
  'lm-studio': 'lmstudio',
  CherryIN: 'api-compatible',
  OPENAI_RESPONSE: 'openai',
  anthropic: 'anthropic',
  'azure-openai': 'openai',
  gemini: 'gemini',
  'vertex-ai': 'google',
  'github-models': 'github',
  'github-copilot': 'github-copilot',
  'lingyi-wanwu': 'yi',
  moonshot: 'moonshot',
  baichuan: 'baichuan',
  'aliyun-bailian': 'qwen',
  'step-ai': 'zero-one',
  volcengine: 'volcengine-la_PI8m-',
  'wuwen-xinqiong': 'ling',
  minimax: 'minimax-B0Eo-1V9',
  groq: 'groq',
  together: 'together',
  fireworks: 'fireworks',
  aihubmix: 'aihubmix',
  ocoolai: 'ocoolai',
  zhipu: 'zhipu',
  deepseek: 'deepseek',
  'alaya-new': 'alayanew',
  dmxapi: 'DMXAPI',
  aionly: 'aiOnly-CX5LzR-B',
  burncloud: 'burncloud',
  tokenflux: 'tokenflux',
  '302-ai': '302ai-OYnezl-B',
  cephalon: 'anthropic',
  lanyun: 'lanyun',
  ph8: 'ph8',
  sophnet: 'anthropic',
  ppio: 'anthropic',
  qiniu: 'anthropic',
  openrouter: 'openrouter',
  // 察元AI助理 ribbon 模型选择：具体模型 id -> logos basename
  'gpt-4o': 'openai', 'gpt-4': 'openai', 'gpt-4-turbo': 'openai', 'gpt-3.5': 'openai',
  'claude-3.5': 'anthropic', 'claude-3': 'anthropic', claude: 'anthropic',
  'gemini-pro': 'gemini', gemini: 'gemini',
  'deepseek-v3': 'deepseek', 'deepseek-r1': 'deepseek', 'deepseek-coder': 'deepseek',
  doubao: 'doubao', 'doubao-pro': 'doubao',
  'qwen-max': 'qwen', 'qwen-plus': 'qwen', qwen: 'qwen',
  'wenxin-4': 'wenxin-PRX-yHSt', wenxin: 'wenxin-PRX-yHSt',
  'ernie-4.0-8k': 'qianfan', 'ernie-3.5-8k': 'qianfan', 'ernie-speed-128k': 'qianfan',
  'chatglm-4': 'zhipu', 'glm-4': 'zhipu',
  kimi: 'moonshot', moonshot: 'moonshot',
  'yi-large': 'yi', 'yi-medium': 'yi', yi: 'yi',
  ollama: 'ollama',
  baichuan: 'baichuan',
  'mistral-large': 'mistral', mixtral: 'mistral',
  'llama-3': 'llama',
  hunyuan: 'hunyuan',
  xinghuo: 'sparkdesk',
  minimax: 'minimax-B0Eo-1V9',
  step: 'zero-one',
  grok: 'grok',
  perplexity: 'perplexity',
  // 补充模型
  coze: 'coze',
  internlm: 'internlm',
  openrouter: 'openrouter',
  groq: 'groq',
  together: 'together',
  fireworks: 'fireworks',
  cohere: 'cohere',
  'netease-youdao': 'netease-youdao',
  pangu: 'pangu',
  sensetime: 'sensetime',
  hailuo: 'hailuo',
  o3: 'o3',
  'gpt_o1': 'gpt_o1',
  'gpt-5': 'gpt-5',
  'gpt-5.1': 'gpt-5.1-Cbwac6R-',
  xinference: 'xinference',
  oneapi: 'oneapi',
  vllm: 'vllm',
  'new-api': 'newapi',
  'lm-studio': 'lmstudio',
  'api-compatible': 'api-compatible',
  '360': '360-D7q-rf3l',
  '360智脑': '360-D7q-rf3l'
}

// 扩展名偏好（logos 中多为 png/webp/svg）
const EXT_ORDER = ['png', 'webp', 'svg']

/**
 * 根据模型 id 得到 logos 目录下的图标路径（优先 logos，无则回退占位）
 * @param {string} modelId - 模型 id（如 openai、tencent-hunyuan）
 * @returns {string} 相对路径，如 images/models/logos/openai.png
 */
export function getModelLogoPath(modelId) {
  if (!modelId) return ''
  const normalized = String(modelId).trim().toLowerCase().replace(/_/g, '-')
  let basename = MODEL_ID_TO_LOGO_BASENAME[modelId] ?? MODEL_ID_TO_LOGO_BASENAME[normalized]
  if (!basename) basename = normalized
  const ext = BASENAME_EXT[basename] || 'png'
  return `${LOGOS_BASE}/${basename}.${ext}`
}

// 部分 logo 为 webp/svg，与 logos 目录一致
const BASENAME_EXT = {
  aihubmix: 'webp', alayanew: 'webp', 'aws-bedrock': 'webp', 'baidu-ai': 'png', 'qianfan': 'svg', bailian: 'png',
  burncloud: 'png', cerebras: 'webp', coze: 'webp', duckduckgo: 'webp', gemini: 'png',
  'github-copilot': 'webp', huggingface: 'webp', lmstudio: 'png', mimo: 'svg', modelscope: 'png',
  moonshot: 'webp', newapi: 'png', ollama: 'png', openrouter: 'png', perplexity: 'png',
  voyageai: 'png', xirang: 'png', nvidia: 'png', deepseek: 'png', openai: 'png', groq: 'png',
  together: 'png', fireworks: 'png', anthropic: 'png', claude: 'png', qwen: 'png', yi: 'png',
  zhipu: 'png', hunyuan: 'png', ph8: 'png', lanyun: 'png', tokenflux: 'png', minimax: 'png',
  xinference: 'svg', oneapi: 'svg', vllm: 'svg', 'api-compatible': 'svg',
  'xirang-B42-6Dao': 'png', 'gpustack-D7EptUU-': 'svg', 'volcengine-la_PI8m-': 'png',
  mistral: 'svg', jina: 'svg', baichuan: 'svg',
  'minimax-B0Eo-1V9': 'png', 'aiOnly-CX5LzR-B': 'webp', poe: 'svg',
  '302ai-OYnezl-B': 'webp', longcat_logo: 'png',
  'wenxin-PRX-yHSt': 'png', sparkdesk: 'png', 'zero-one': 'png', llama: 'png', doubao: 'png',
  coze: 'webp', internlm: 'png', cohere: 'png', 'netease-youdao': 'svg', pangu: 'svg',
  sensetime: 'png', hailuo: 'png', o3: 'png', 'gpt_o1': 'png', 'gpt-5': 'png',
  'gpt-5.1-Cbwac6R-': 'png',   '360-D7q-rf3l': 'png'
}
