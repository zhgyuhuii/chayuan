function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

function uniqueList(list = []) {
  return Array.from(new Set((Array.isArray(list) ? list : []).map(item => normalizeString(item)).filter(Boolean)))
}

function truncateText(text = '', maxLength = 120) {
  const normalized = normalizeString(text)
  if (!normalized) return ''
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized
}

function splitPlanSegments(text = '', limit = 3) {
  return uniqueList(
    String(text || '')
      .split(/[\n。！？!?；;，,]/)
      .map(item => item.trim())
      .filter(item => item.length >= 2)
  ).slice(0, Math.max(1, Number(limit || 3)))
}

function detectAspectRatio(text = '', fallback = '16:9') {
  const normalized = String(text || '').toLowerCase()
  if (/9\s*[:：]\s*16|竖屏|手机封面|短视频封面/.test(normalized)) return '9:16'
  if (/1\s*[:：]\s*1|方图|方形/.test(normalized)) return '1:1'
  if (/4\s*[:：]\s*3/.test(normalized)) return '4:3'
  if (/3\s*[:：]\s*4/.test(normalized)) return '3:4'
  if (/21\s*[:：]\s*9|超宽/.test(normalized)) return '21:9'
  if (/16\s*[:：]\s*9|横版|横屏/.test(normalized)) return '16:9'
  return normalizeString(fallback, '16:9')
}

function detectDuration(text = '', fallback = '8s') {
  const normalized = String(text || '').toLowerCase()
  const matched = normalized.match(/([0-9]{1,3})\s*(秒|s|sec|secs|分钟|min)/)
  if (!matched) return normalizeString(fallback, '8s')
  const value = Number(matched[1] || 0)
  if (!Number.isFinite(value) || value <= 0) return normalizeString(fallback, '8s')
  if (/分钟|min/.test(matched[2])) return `${value}min`
  return `${value}s`
}

function detectByKeywords(text = '', rules = [], fallback = '') {
  const normalized = String(text || '')
  const matched = (Array.isArray(rules) ? rules : []).find(rule => (rule.keywords || []).some(keyword => normalized.includes(keyword)))
  return matched?.value || fallback
}

function buildImagePlan(options = {}) {
  const requestText = normalizeString(options.prompt || options.input)
  const style = detectByKeywords(requestText, [
    { keywords: ['海报', '宣传'], value: '品牌海报' },
    { keywords: ['插画', '绘本'], value: '插画风' },
    { keywords: ['写实', '真实'], value: '写实风格' },
    { keywords: ['科技', '数字化', '未来'], value: '科技感' },
    { keywords: ['简约', '极简'], value: '极简风格' }
  ], '专业写实')
  const industry = detectByKeywords(requestText, [
    { keywords: ['教育', '课程'], value: '教育培训' },
    { keywords: ['政务', '政策', '政府'], value: '政务公文' },
    { keywords: ['电商', '商品', '带货'], value: '电商营销' },
    { keywords: ['医疗', '医院'], value: '医疗健康' },
    { keywords: ['金融', '银行'], value: '金融服务' }
  ], '通用场景')
  const useCase = detectByKeywords(requestText, [
    { keywords: ['封面'], value: '封面图' },
    { keywords: ['配图'], value: '文章配图' },
    { keywords: ['海报'], value: '宣传海报' },
    { keywords: ['图标'], value: '图标素材' }
  ], '图片素材')
  const visualFocus = splitPlanSegments(requestText, 4)
  const subject = truncateText(visualFocus[0] || requestText, 60)
  const aspectRatio = detectAspectRatio(requestText, options.aspectRatio || '16:9')
  const executionPrompt = [
    `任务：生成${useCase}`,
    `主体：${subject || '按用户描述生成主体'}`,
    `风格：${style}`,
    `行业：${industry}`,
    `画幅：${aspectRatio}`,
    visualFocus.length ? `重点元素：${visualFocus.join('；')}` : ''
  ].filter(Boolean).join('\n')
  return {
    kind: 'image',
    requestText,
    useCase,
    style,
    industry,
    aspectRatio,
    subject,
    visualFocus,
    executionPrompt
  }
}

function buildAudioPlan(options = {}) {
  const requestText = normalizeString(options.input || options.prompt)
  const tone = detectByKeywords(requestText, [
    { keywords: ['正式', '汇报'], value: '正式稳重' },
    { keywords: ['亲切', '温柔'], value: '亲和温柔' },
    { keywords: ['激情', '宣传'], value: '有感染力' },
    { keywords: ['客服'], value: '客服播报' }
  ], '专业自然')
  const useCase = detectByKeywords(requestText, [
    { keywords: ['旁白'], value: '旁白配音' },
    { keywords: ['播报'], value: '语音播报' },
    { keywords: ['提醒'], value: '提醒播报' },
    { keywords: ['客服'], value: '客服话术' }
  ], '语音生成')
  const voiceStyle = normalizeString(options.voiceStyle, tone)
  const scriptSegments = splitPlanSegments(requestText, 3)
  const executionInput = scriptSegments.length > 0 ? scriptSegments.join('。') : requestText
  return {
    kind: 'audio',
    requestText,
    useCase,
    tone,
    voiceStyle,
    scriptSummary: truncateText(executionInput, 120),
    scriptSegments,
    executionInput
  }
}

function buildVideoPlan(options = {}) {
  const requestText = normalizeString(options.prompt || options.input)
  const useCase = detectByKeywords(requestText, [
    { keywords: ['宣传', '推广'], value: '宣传短片' },
    { keywords: ['讲解', '教程'], value: '讲解视频' },
    { keywords: ['汇报'], value: '汇报短视频' },
    { keywords: ['预告'], value: '预告视频' }
  ], '短视频')
  const visualStyle = detectByKeywords(requestText, [
    { keywords: ['科技', '未来'], value: '科技质感' },
    { keywords: ['纪实', '真实'], value: '纪实风格' },
    { keywords: ['动画', '卡通'], value: '动画风格' },
    { keywords: ['高级', '电影'], value: '电影感' }
  ], '专业短视频')
  const aspectRatio = detectAspectRatio(requestText, options.aspectRatio || '16:9')
  const duration = detectDuration(requestText, options.duration || '8s')
  const shotSummary = splitPlanSegments(requestText, 4)
  const executionPrompt = [
    `任务：生成${useCase}`,
    `风格：${visualStyle}`,
    `画幅：${aspectRatio}`,
    `时长：${duration}`,
    shotSummary.length ? `镜头摘要：${shotSummary.join('；')}` : ''
  ].filter(Boolean).join('\n')
  return {
    kind: 'video',
    requestText,
    useCase,
    visualStyle,
    aspectRatio,
    duration,
    shotSummary,
    executionPrompt
  }
}

export function buildMultimodalGenerationPlan(options = {}) {
  const kind = normalizeString(options.kind)
  const base = {
    planVersion: 'v1',
    createdAt: new Date().toISOString()
  }
  if (kind === 'image') return { ...base, ...buildImagePlan(options) }
  if (kind === 'audio') return { ...base, ...buildAudioPlan(options) }
  return { ...base, ...buildVideoPlan(options) }
}

export function summarizeMultimodalGenerationPlan(plan = {}) {
  const kind = normalizeString(plan.kind)
  if (kind === 'image') {
    return `风格 ${normalizeString(plan.style, '未指定')} / 画幅 ${normalizeString(plan.aspectRatio, '16:9')} / 用途 ${normalizeString(plan.useCase, '图片素材')}`
  }
  if (kind === 'audio') {
    return `声线 ${normalizeString(plan.voiceStyle, '专业自然')} / 语气 ${normalizeString(plan.tone, '专业自然')} / 用途 ${normalizeString(plan.useCase, '语音生成')}`
  }
  return `风格 ${normalizeString(plan.visualStyle, '专业短视频')} / 画幅 ${normalizeString(plan.aspectRatio, '16:9')} / 时长 ${normalizeString(plan.duration, '8s')}`
}
