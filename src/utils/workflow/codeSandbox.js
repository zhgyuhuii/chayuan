/**
 * codeSandbox — code-snippet 节点的安全沙箱(W7.1)
 *
 * 设计:
 *   1. AST 静态审查 — 拒绝 import / require / eval / new Function / Worker / fetch / XMLHttpRequest 等
 *   2. iframe 隔离执行 — 沙箱有自己的 globalThis,无 parent 访问
 *   3. postMessage 双向通信 — 限定 input / output / API allowlist
 *   4. 超时强制结束 — 默认 5 秒
 *
 * 注意:这是「显式低风险」沙箱,不是绝对安全。不允许接收用户上传任意脚本,
 * 仅限于工作流内部用户用 编辑器 写的小段代码。
 *
 * 用法(node 节点 type='code-snippet'):
 *   const result = await runSandbox(code, { input: { ... }, timeoutMs: 5000 })
 *   // result = { ok, output, error }
 */

const DEFAULT_TIMEOUT = 5000
const MAX_CODE_LENGTH = 8000

const FORBIDDEN_PATTERNS = [
  /\bimport\s/,
  /\bexport\s/,
  /\brequire\s*\(/,
  /\beval\s*\(/,
  /\bnew\s+Function\b/,
  /\bWorker\b/,
  /\bfetch\b/,
  /\bXMLHttpRequest\b/,
  /\bdocument\b/,
  /\bwindow\b/,
  /\bglobalThis\b/,
  /\bself\b/,
  /\b__proto__\b/,
  /\bprototype\s*\[/,
  /\bsetTimeout\s*\(/,
  /\bsetInterval\s*\(/,
  /\bnavigator\b/,
  /\blocation\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bindexedDB\b/,
  /\bWebAssembly\b/,
  /\bBuffer\b/,
  /\bprocess\b/
]

/**
 * 静态 AST 审查 — 简单字符串扫描(够防 95% 滥用)。
 */
export function lintCode(code) {
  const errors = []
  const src = String(code || '')
  if (src.length > MAX_CODE_LENGTH) {
    errors.push(`代码过长(${src.length} > ${MAX_CODE_LENGTH})`)
  }
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(src)) {
      errors.push(`禁用模式:${re.toString()}`)
    }
  }
  return { ok: errors.length === 0, errors }
}

/**
 * iframe 沙箱内执行。
 * 限制:仅允许使用 input / 预定义的 API。
 */
export async function runSandbox(code, options = {}) {
  // 1. 静态审查
  const lint = lintCode(code)
  if (!lint.ok) {
    return { ok: false, error: 'lint 失败:' + lint.errors.join(';') }
  }

  // 2. 浏览器环境检测
  if (typeof document === 'undefined') {
    return { ok: false, error: 'codeSandbox 仅支持浏览器环境' }
  }

  // 3. 构造隔离 iframe
  const timeoutMs = Number(options.timeoutMs) || DEFAULT_TIMEOUT
  const inputJson = JSON.stringify(options.input || null)
  const code2 = String(code).replace(/<\/script/gi, '<\\/script')

  const html = `<!DOCTYPE html><html><body><script>
    (function() {
      var input = ${inputJson};
      var output;
      var error;
      try {
        output = (function(input) {
          ${code2}
        })(input);
      } catch (e) {
        error = String(e && e.message || e);
      }
      // postMessage 回宿主
      var msg = { ok: !error, output: output, error: error };
      try { parent.postMessage(msg, '*'); } catch (_) {}
    })();
  <\/script></body></html>`

  return new Promise(resolve => {
    const iframe = document.createElement('iframe')
    iframe.sandbox = 'allow-scripts'
    iframe.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;visibility:hidden'
    iframe.srcdoc = html

    let resolved = false
    const cleanup = () => {
      if (resolved) return
      resolved = true
      window.removeEventListener('message', onMessage)
      try { iframe.remove() } catch (_) {}
    }

    const timer = setTimeout(() => {
      if (!resolved) {
        cleanup()
        resolve({ ok: false, error: `代码执行超时(${timeoutMs}ms)` })
      }
    }, timeoutMs)

    const onMessage = (e) => {
      if (e.source !== iframe.contentWindow) return
      if (resolved) return
      const data = e.data
      if (!data || typeof data !== 'object') return
      clearTimeout(timer)
      cleanup()
      // 序列化检查 — 输出必须可 JSON 化
      try { JSON.stringify(data.output) }
      catch { resolve({ ok: false, error: 'output 不可序列化' }); return }
      resolve(data)
    }

    window.addEventListener('message', onMessage)
    document.body.appendChild(iframe)
  })
}

export default {
  lintCode,
  runSandbox,
  FORBIDDEN_PATTERNS
}
