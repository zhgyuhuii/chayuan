import type { AgentToolCall, AgentToolDef, ToolExecution } from './types'
import type { AgentSkill } from './skill'

/**
 * Media capability skill — the shared factory behind every editor's
 * generate_video / analyze_media / transcribe_audio / generate_speech tools.
 * One implementation, app-agnostic: the host app injects a bridge (its
 * preload's media IPC methods) plus placement hints; capability flags decide
 * which tools exist, so an unconfigured kind is simply absent — never a tool
 * that fails, never a promise the environment cannot keep.
 *
 * Placement stays with the host app: media tools return URLs/paths + guidance
 * text pointing at the app's own insertion tools (insert_image / add_image /
 * insert_web_image / <img> / …). generate_image is intentionally NOT part of
 * this factory — every editor already ships one wired to its own insertion
 * flow; a second definition would collide by name.
 */

export interface MediaCapabilityFlags {
  image: boolean
  video: boolean
  imageUnderstanding: boolean
  videoUnderstanding: boolean
  tts: boolean
  asr: boolean
}

export interface MediaSkillBridge {
  /** live probe against the main process (ai-settings defaults per kind) */
  capabilities(): Promise<MediaCapabilityFlags>
  /** default model's invocation notes per kind (injected into the system prompt) */
  modelNotes?(): Promise<Record<string, string | undefined>>
  generateImage(input: { prompt: string; aspectRatio?: string }): Promise<{
    url?: string
    model?: string
    error?: string
    attempts?: Array<{ model: string; error: string; notes?: string }>
  }>
  generateVideo(input: {
    prompt: string
    aspectRatio?: string
    durationSeconds?: number
  }): Promise<{ url?: string; filePath?: string; model?: string; error?: string }>
  understandMedia(input: {
    kind: 'image' | 'video' | 'auto'
    sources: string[]
    requirements: string
  }): Promise<{ text?: string; error?: string }>
  transcribeAudio(input: { source: string; language?: string }): Promise<{
    text?: string
    error?: string
  }>
  generateSpeech(input: { text: string; voice?: string }): Promise<{
    url?: string
    mime?: string
    error?: string
  }>
  /** web image search for the generation→search→svg fallback chain (optional) */
  searchImages?(query: string, max: number): Promise<Array<{ imageUrl: string }>>
  /** the app ships a generate_svg tool the model can fall back to */
  hasGenerateSvg?: boolean
  /**
   * Per-tool placement guidance appended to outputs — the app's own insertion
   * tools, named exactly as the model sees them.
   */
  placement: {
    image: string
    video: string
    speech: string
    analysis: string
    transcript: string
  }
  /** tools to omit even when capable (the app ships its own, e.g. generate_image) */
  skip?: string[]
  /** activity-chip labels; English defaults, host may localize */
  labels?: Partial<Record<'genImage' | 'genVideo' | 'analyze' | 'transcribe' | 'speech', string>>
}

const DEFAULT_LABELS = {
  genImage: 'Generate image',
  genVideo: 'Generate video',
  analyze: 'Analyze media',
  transcribe: 'Transcribe audio',
  speech: 'Generate speech',
}

function toolDefs(skip: Set<string>): AgentToolDef[] {
  const defs: AgentToolDef[] = [
    {
      name: 'generate_image',
      description:
        'Generate an image with the image-generation model configured in Settings (生图、媒体与搜索). ' +
        'Returns the saved image URL/file path for insertion.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Image description, English works better (subject, style, composition)',
          },
          aspectRatio: { type: 'string', description: 'e.g. "1:1", "16:9", "4:3"' },
        },
        required: ['prompt'],
      },
    },
    {
      name: 'generate_video',
      description:
        'Generate a short video clip with the video-generation model configured in Settings ' +
        '(生图、媒体与搜索). Vendor-billed and slow (often minutes); only when the user asks for ' +
        'video/motion. Returns the saved file path.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Motion description, English works better' },
          aspectRatio: { type: 'string', description: 'e.g. "16:9", "9:16"' },
          durationSeconds: {
            type: 'number',
            description: 'clip length in seconds (vendor limits apply)',
          },
        },
        required: ['prompt'],
      },
    },
    {
      name: 'analyze_media',
      description:
        'Analyze images/video/audio files with the media-understanding models configured in Settings ' +
        '(生图、媒体与搜索, image/video understanding defaults). Pass direct URLs or local file paths; ' +
        'returns analysis text for you to act on (summarize, extract key points, draft content).',
      inputSchema: {
        type: 'object',
        properties: {
          sources: {
            type: 'array',
            items: { type: 'string' },
            description: 'Direct http(s) URLs or local file paths of the media files',
          },
          requirements: {
            type: 'string',
            description: 'What to extract and how the result will be used (English works better)',
          },
        },
        required: ['sources', 'requirements'],
      },
    },
    {
      name: 'transcribe_audio',
      description:
        'Transcribe an audio file to text with the ASR model configured in Settings (生图、媒体与搜索). ' +
        'Pass a direct URL or a local file path; returns the transcript text for you to act on.',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'Direct http(s) URL or local file path of the audio',
          },
          language: {
            type: 'string',
            description: 'ISO language hint, e.g. "zh" / "en"; omit for auto',
          },
        },
        required: ['source'],
      },
    },
    {
      name: 'generate_speech',
      description:
        'Synthesize spoken audio from text with the TTS model configured in Settings (生图、媒体与搜索). ' +
        'Returns the saved audio file path/URL.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The text to speak' },
          voice: { type: 'string', description: 'Vendor voice id; omit for the default voice' },
        },
        required: ['text'],
      },
    },
  ]
  return defs.filter((t) => !skip.has(t.name))
}

/** analyze_media is live when either understanding kind resolves; the executor routes per file */
function toolsForFlags(defs: AgentToolDef[], flags: MediaCapabilityFlags | null): AgentToolDef[] {
  if (!flags) return []
  const capByTool: Record<string, keyof MediaCapabilityFlags> = {
    generate_image: 'image',
    generate_video: 'video',
    analyze_media: 'imageUnderstanding',
    transcribe_audio: 'asr',
    generate_speech: 'tts',
  }
  return defs.filter((t) => flags[capByTool[t.name]!])
}

export function createMediaSkill(bridge: MediaSkillBridge): AgentSkill {
  const labels = { ...DEFAULT_LABELS, ...bridge.labels }
  const skip = new Set(bridge.skip ?? [])
  const defs = toolDefs(skip)
  let flags: MediaCapabilityFlags | null = null
  let notesCache: Record<string, string | undefined> | null = null
  // fire-and-forget: the loop re-reads `tools`/`systemPrompt` before every
  // request, so the first turn may run without media tools and the next has them
  void bridge.capabilities().then(
    (f) => {
      flags = f
    },
    () => {},
  )
  if (bridge.modelNotes) {
    void bridge
      .modelNotes()
      .then((n) => {
        notesCache = n
      })
      .catch(() => {})
  }
  const fail = (summary: string, output: string): ToolExecution => ({
    output,
    isError: true,
    mutated: false,
    summary,
  })
  const readSource = (call: AgentToolCall): string => String(call.input.source ?? '').trim()
  const readSources = (call: AgentToolCall): string[] =>
    Array.isArray(call.input.sources)
      ? (call.input.sources as unknown[]).map(String).filter((s) => s.trim() !== '')
      : []
  return {
    id: 'media',
    get systemPrompt() {
      const f = flags
      if (!f) return ''
      const lines: string[] = ['## Media models (Settings → 生图、媒体与搜索)']
      // user-authored per-model invocation notes: the agent adapts its inputs
      // (language / ratio / duration) to these constraints before calling
      const noteLine = (kind: string, label: string): string => {
        const n = notesCache?.[kind]
        if (!n) return ''
        return `- ${label}模型说明：${n.length > 500 ? `${n.slice(0, 500)}…` : n}`
      }
      for (const [kind, label] of [
        ['image', '生图'],
        ['video', '视频'],
        ['imageUnderstanding', '图片解析'],
        ['videoUnderstanding', '视频解析'],
        ['tts', '语音合成'],
        ['asr', '语音识别'],
      ] as const) {
        const line = noteLine(kind, label)
        if (line) lines.push(line)
      }
      if (f.video && !skip.has('generate_video')) {
        lines.push(
          '- generate_video makes real AI video clips (vendor-billed, slow); only on explicit video requests.',
        )
      }
      if (f.imageUnderstanding || f.videoUnderstanding) {
        lines.push(
          '- analyze_media understands images/video/audio with the configured analysis models; use it instead of guessing about user-supplied media files.',
        )
      }
      if (f.asr) {
        lines.push('- transcribe_audio turns audio files into text via the configured ASR model.')
      }
      if (f.tts) {
        lines.push('- generate_speech turns text into spoken audio via the configured TTS model.')
      }
      return lines.length > 1 ? `\n${lines.join('\n')}` : ''
    },
    get tools() {
      return toolsForFlags(defs, flags)
    },
    async executeTool(call, signal): Promise<ToolExecution> {
      const aborted = (): ToolExecution => fail(labels.analyze, 'stopped by the user')
      switch (call.name) {
        case 'generate_image': {
          const prompt = String(call.input.prompt ?? '').trim()
          if (!prompt) return fail(labels.genImage, 'prompt must not be empty')
          const aspectRatio = String(call.input.aspectRatio ?? '').trim()
          // Tier 1: every configured image model, server-side priority chain
          const r = await bridge.generateImage({
            prompt,
            ...(aspectRatio ? { aspectRatio } : {}),
          })
          if (signal?.aborted) return aborted()
          if (r.url) {
            return {
              output: `Image generated (${r.model ?? 'configured model'}): ${r.url}\n${bridge.placement.image}`,
              mutated: false,
              summary: labels.genImage,
            }
          }
          // Failure self-diagnosis: per-model errors + invocation notes let the
          // agent fix its inputs (ratio / language / size) or report config issues
          let attemptsText = ''
          if (r.attempts?.length) {
            attemptsText =
              '\n' +
              r.attempts
                .map((a) => `- ${a.model}: ${a.error}${a.notes ? `（说明：${a.notes}）` : ''}`)
                .join('\n')
          }
          // Tier 2: web image search keeps imagery available without any model
          if (bridge.searchImages) {
            try {
              const images = await bridge.searchImages(prompt, 5)
              const pick = images.find((im) => /^https?:\/\//.test(im.imageUrl))
              if (pick) {
                return {
                  output: `All configured image models failed (${r.error ?? 'error'}); a web image was found instead: ${pick.imageUrl}\n${bridge.placement.image}`,
                  mutated: false,
                  summary: labels.genImage,
                }
              }
            } catch {
              /* search failed — hand the slot to the svg tier */
            }
          }
          // Tier 3: the model draws it as SVG
          const svgHint = bridge.hasGenerateSvg
            ? ' Draw the illustration yourself with generate_svg (write SVG markup).'
            : ''
          return fail(
            labels.genImage,
            `${r.error ?? 'image generation failed'} — no web image matched either.${svgHint}${attemptsText}`,
          )
        }
        case 'generate_video': {
          const prompt = String(call.input.prompt ?? '').trim()
          if (!prompt) return fail(labels.genVideo, 'prompt must not be empty')
          const aspectRatio = String(call.input.aspectRatio ?? '').trim()
          const durationSeconds = Number(call.input.durationSeconds) || undefined
          const r = await bridge.generateVideo({
            prompt,
            ...(aspectRatio ? { aspectRatio } : {}),
            ...(durationSeconds ? { durationSeconds } : {}),
          })
          if (signal?.aborted) return aborted()
          if (!r.url && !r.filePath)
            return fail(labels.genVideo, r.error ?? 'video generation failed')
          const where = r.filePath ?? r.url
          return {
            output: `Video generated (${r.model ?? 'configured model'}): ${where}\n${bridge.placement.video}`,
            mutated: false,
            summary: labels.genVideo,
          }
        }
        case 'analyze_media': {
          const sources = readSources(call)
          const requirements = String(call.input.requirements ?? '').trim()
          if (!sources.length) return fail(labels.analyze, 'sources must not be empty')
          if (!requirements) return fail(labels.analyze, 'requirements must not be empty')
          const r = await bridge.understandMedia({ kind: 'auto', sources, requirements })
          if (signal?.aborted) return aborted()
          if (!r.text) return fail(labels.analyze, r.error ?? 'media analysis failed')
          return {
            output: `${r.text}\n\n${bridge.placement.analysis}`,
            mutated: false,
            summary: labels.analyze,
          }
        }
        case 'transcribe_audio': {
          const source = readSource(call)
          if (!source) return fail(labels.transcribe, 'source must not be empty')
          const language = String(call.input.language ?? '').trim()
          const r = await bridge.transcribeAudio({
            source,
            ...(language ? { language } : {}),
          })
          if (signal?.aborted) return aborted()
          if (!r.text) return fail(labels.transcribe, r.error ?? 'transcription failed')
          return {
            output: `Transcript:\n${r.text}\n\n${bridge.placement.transcript}`,
            mutated: false,
            summary: labels.transcribe,
          }
        }
        case 'generate_speech': {
          const text = String(call.input.text ?? '').trim()
          if (!text) return fail(labels.speech, 'text must not be empty')
          const voice = String(call.input.voice ?? '').trim()
          const r = await bridge.generateSpeech({ text, ...(voice ? { voice } : {}) })
          if (signal?.aborted) return aborted()
          if (!r.url) return fail(labels.speech, r.error ?? 'speech synthesis failed')
          return {
            output: `Audio generated: ${r.url}\n${bridge.placement.speech}`,
            mutated: false,
            summary: labels.speech,
          }
        }
        default:
          return fail(call.name, `Unknown media tool: ${call.name}`)
      }
    },
  }
}
