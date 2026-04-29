/**
 * Ribbon 与「关于察元」等处的默认模型分组（分组名、图标、子模型）。
 */
export const MODEL_GROUPS = [
  {
    label: 'ChatGPT',
    icon: 'images/models/openai.svg',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', icon: 'images/models/openai.svg' },
      { id: 'gpt-4', name: 'GPT-4', icon: 'images/models/openai.svg' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', icon: 'images/models/openai.svg' },
      { id: 'o3', name: 'o3', icon: 'images/models/openai.svg' },
      { id: 'gpt_o1', name: 'GPT-o1', icon: 'images/models/openai.svg' },
      { id: 'gpt-5', name: 'GPT-5', icon: 'images/models/openai.svg' },
      { id: 'gpt-3.5', name: 'GPT-3.5', icon: 'images/models/openai.svg' }
    ]
  },
  {
    label: 'Claude',
    icon: 'images/models/claude.svg',
    models: [
      { id: 'claude-3.5', name: 'Claude 3.5', icon: 'images/models/claude.svg' },
      { id: 'claude-3', name: 'Claude 3', icon: 'images/models/claude.svg' },
      { id: 'claude', name: 'Claude', icon: 'images/models/claude.svg' }
    ]
  },
  {
    label: 'Gemini',
    icon: 'images/models/gemini.svg',
    models: [
      { id: 'gemini-pro', name: 'Gemini Pro', icon: 'images/models/gemini.svg' },
      { id: 'gemini', name: 'Gemini', icon: 'images/models/gemini.svg' }
    ]
  },
  {
    label: 'DeepSeek',
    icon: 'images/models/deepseek.svg',
    models: [
      { id: 'deepseek-v3', name: 'DeepSeek V3', icon: 'images/models/deepseek.svg' },
      { id: 'deepseek-r1', name: 'DeepSeek R1', icon: 'images/models/deepseek.svg' },
      { id: 'deepseek-coder', name: 'DeepSeek Coder', icon: 'images/models/deepseek.svg' }
    ]
  },
  {
    label: '豆包',
    icon: 'images/models/doubao.svg',
    models: [
      { id: 'doubao', name: '豆包', icon: 'images/models/doubao.svg' },
      { id: 'doubao-pro', name: '豆包 Pro', icon: 'images/models/doubao.svg' }
    ]
  },
  {
    label: '阿里百炼',
    icon: 'images/models/qwen.svg',
    models: [
      { id: 'qwen-max', name: '通义千问-Max', icon: 'images/models/qwen.svg' },
      { id: 'qwen-plus', name: '通义千问-Plus', icon: 'images/models/qwen.svg' },
      { id: 'qwen', name: '通义千问', icon: 'images/models/qwen.svg' }
    ]
  },
  {
    label: '百度云千帆',
    icon: 'images/models/logos/qianfan.svg',
    models: [
      { id: 'ernie-4.0-8k', name: '文心 4.0', icon: 'images/models/logos/qianfan.svg' },
      { id: 'ernie-3.5-8k', name: '文心 3.5', icon: 'images/models/logos/qianfan.svg' }
    ]
  },
  {
    label: 'ChatGLM',
    icon: 'images/models/chatglm.svg',
    models: [
      { id: 'chatglm-4', name: 'ChatGLM-4', icon: 'images/models/chatglm.svg' },
      { id: 'glm-4', name: 'GLM-4', icon: 'images/models/chatglm.svg' }
    ]
  },
  {
    label: 'Kimi',
    icon: 'images/models/kimi.svg',
    models: [
      { id: 'kimi', name: 'Kimi (K1.5)', icon: 'images/models/kimi.svg' },
      { id: 'moonshot', name: 'Moonshot', icon: 'images/models/kimi.svg' }
    ]
  },
  {
    label: '零一万物 Yi',
    icon: 'images/models/yi.svg',
    models: [
      { id: 'yi-large', name: 'Yi-Large', icon: 'images/models/yi.svg' },
      { id: 'yi-medium', name: 'Yi-Medium', icon: 'images/models/yi.svg' },
      { id: 'yi', name: '零一万物', icon: 'images/models/yi.svg' }
    ]
  },
  {
    label: 'Ollama',
    icon: 'images/models/ollama.svg',
    models: [{ id: 'ollama', name: 'Ollama 本地模型', icon: 'images/models/ollama.svg' }]
  },
  {
    label: '其他模型',
    icon: 'images/ai-assistant.svg',
    models: [
      { id: 'baichuan', name: '百川大模型', icon: 'images/models/baichuan.svg' },
      { id: 'mistral-large', name: 'Mistral Large', icon: 'images/models/mistral.svg' },
      { id: 'mixtral', name: 'Mixtral', icon: 'images/models/mistral.svg' },
      { id: 'llama-3', name: 'Llama 3', icon: 'images/models/llama.svg' },
      { id: 'hunyuan', name: '腾讯混元', icon: 'images/models/hunyuan.svg' },
      { id: 'xinghuo', name: '讯飞星火', icon: 'images/models/xinghuo.svg' },
      { id: 'minimax', name: 'MiniMax', icon: 'images/models/minimax.svg' },
      { id: 'step', name: '阶跃星辰 Step', icon: 'images/models/step.svg' },
      { id: 'grok', name: 'Grok (xAI)', icon: 'images/models/grok.svg' },
      { id: 'perplexity', name: 'Perplexity', icon: 'images/models/perplexity.svg' },
      { id: 'coze', name: 'Coze 豆包', icon: 'images/models/coze.svg' },
      { id: 'internlm', name: '书生·浦语', icon: 'images/models/internlm.svg' },
      { id: 'openrouter', name: 'OpenRouter', icon: 'images/models/openrouter.svg' },
      { id: 'groq', name: 'Groq', icon: 'images/models/groq.svg' },
      { id: 'together', name: 'Together', icon: 'images/models/together.svg' },
      { id: 'fireworks', name: 'Fireworks', icon: 'images/models/fireworks.svg' },
      { id: 'cohere', name: 'Cohere', icon: 'images/models/cohere.svg' },
      { id: 'poe', name: 'Poe', icon: 'images/models/poe.svg' },
      { id: 'huggingface', name: 'Hugging Face', icon: 'images/models/huggingface.svg' },
      { id: 'modelscope', name: 'ModelScope 魔搭', icon: 'images/models/modelscope.svg' },
      { id: 'volcengine', name: '火山引擎', icon: 'images/models/volcengine.svg' },
      { id: 'wuwen-xinqiong', name: '无问芯穹', icon: 'images/models/wuwen.svg' },
      { id: 'oneapi', name: 'OneAPI', icon: 'images/models/oneapi.svg' },
      { id: 'xinference', name: 'Xinference', icon: 'images/models/xinference.svg' },
      { id: 'new-api', name: 'New API', icon: 'images/models/new-api.svg' },
      { id: 'lm-studio', name: 'LM Studio', icon: 'images/models/lm-studio.svg' },
      { id: 'api-compatible', name: 'OpenAI 兼容', icon: 'images/models/api-compatible.svg' },
      { id: 'netease-youdao', name: '网易有道', icon: 'images/models/netease-youdao.svg' },
      { id: 'pangu', name: '华为盘古', icon: 'images/models/pangu.svg' },
      { id: 'sensetime', name: '商汤', icon: 'images/models/sensetime.svg' },
      { id: 'hailuo', name: '海螺 AI', icon: 'images/models/hailuo.svg' },
      { id: '360', name: '360 智脑', icon: 'images/models/360.svg' }
    ]
  }
]

export function getDefaultModelsFlat() {
  const flat = []
  for (const g of MODEL_GROUPS) {
    for (const m of g.models) {
      flat.push({ ...m })
    }
  }
  return flat
}
