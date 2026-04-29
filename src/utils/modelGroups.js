/**
 * 模型分组配置 - 与 ribbon 模型选择、设置中的分组一致
 */
export const MODEL_GROUPS = [
  { label: 'ChatGPT', icon: 'images/models/openai.svg', models: [
    { id: 'gpt-4o', name: 'GPT-4o' }, { id: 'gpt-4', name: 'GPT-4' }, { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'o3', name: 'o3' }, { id: 'gpt_o1', name: 'GPT-o1' }, { id: 'gpt-5', name: 'GPT-5' }, { id: 'gpt-3.5', name: 'GPT-3.5' }
  ]},
  { label: 'Claude', icon: 'images/models/claude.svg', models: [
    { id: 'claude-3.5', name: 'Claude 3.5' }, { id: 'claude-3', name: 'Claude 3' }, { id: 'claude', name: 'Claude' }
  ]},
  { label: 'Gemini', icon: 'images/models/gemini.svg', models: [
    { id: 'gemini-pro', name: 'Gemini Pro' }, { id: 'gemini', name: 'Gemini' }
  ]},
  { label: 'DeepSeek', icon: 'images/models/deepseek.svg', models: [
    { id: 'deepseek-v3', name: 'DeepSeek V3' }, { id: 'deepseek-r1', name: 'DeepSeek R1' }, { id: 'deepseek-coder', name: 'DeepSeek Coder' }
  ]},
  { label: '豆包', icon: 'images/models/doubao.svg', models: [
    { id: 'doubao', name: '豆包' }, { id: 'doubao-pro', name: '豆包 Pro' }
  ]},
  { label: '阿里百炼', icon: 'images/models/qwen.svg', models: [
    { id: 'qwen-max', name: '通义千问-Max' }, { id: 'qwen-plus', name: '通义千问-Plus' }, { id: 'qwen', name: '通义千问' }
  ]},
  { label: '百度云千帆', icon: 'images/models/logos/qianfan.svg', models: [
    { id: 'ernie-4.0-8k', name: '文心 4.0' }, { id: 'ernie-3.5-8k', name: '文心 3.5' }
  ]},
  { label: 'ChatGLM', icon: 'images/models/chatglm.svg', models: [
    { id: 'chatglm-4', name: 'ChatGLM-4' }, { id: 'glm-4', name: 'GLM-4' }
  ]},
  { label: 'Kimi', icon: 'images/models/kimi.svg', models: [
    { id: 'kimi', name: 'Kimi (K1.5)' }, { id: 'moonshot', name: 'Moonshot' }
  ]},
  { label: '零一万物 Yi', icon: 'images/models/yi.svg', models: [
    { id: 'yi-large', name: 'Yi-Large' }, { id: 'yi-medium', name: 'Yi-Medium' }, { id: 'yi', name: '零一万物' }
  ]},
  { label: 'Ollama', icon: 'images/models/ollama.svg', models: [
    { id: 'ollama', name: 'Ollama 本地模型' }
  ]},
  { label: '其他模型', icon: 'images/ai-assistant.svg', models: [
    { id: 'baichuan', name: '百川大模型' }, { id: 'mistral-large', name: 'Mistral Large' }, { id: 'mixtral', name: 'Mixtral' },
    { id: 'llama-3', name: 'Llama 3' }, { id: 'hunyuan', name: '腾讯混元' }, { id: 'xinghuo', name: '讯飞星火' },
    { id: 'minimax', name: 'MiniMax' }, { id: 'step', name: '阶跃星辰 Step' }, { id: 'grok', name: 'Grok (xAI)' },
    { id: 'perplexity', name: 'Perplexity' }, { id: 'coze', name: 'Coze 豆包' }, { id: 'internlm', name: '书生·浦语' },
    { id: 'openrouter', name: 'OpenRouter' }, { id: 'groq', name: 'Groq' }, { id: 'together', name: 'Together' },
    { id: 'fireworks', name: 'Fireworks' }, { id: 'cohere', name: 'Cohere' }, { id: 'poe', name: 'Poe' },
    { id: 'huggingface', name: 'Hugging Face' }, { id: 'modelscope', name: 'ModelScope 魔搭' },
    { id: 'volcengine', name: '火山引擎' }, { id: 'wuwen-xinqiong', name: '无问芯穹' }, { id: 'oneapi', name: 'OneAPI' },
    { id: 'xinference', name: 'Xinference' }, { id: 'new-api', name: 'New API' }, { id: 'lm-studio', name: 'LM Studio' },
    { id: 'api-compatible', name: 'OpenAI 兼容' }, { id: 'netease-youdao', name: '网易有道' },
    { id: 'pangu', name: '华为盘古' }, { id: 'sensetime', name: '商汤' }, { id: 'hailuo', name: '海螺 AI' }, { id: '360', name: '360 智脑' }
  ]}
]
