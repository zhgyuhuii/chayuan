/**
 * file_parse（文件解析）真机场景运行器。
 *
 * 用法：
 *   node run-file-parse.mjs              # 跑全部 FP 场景
 *   node run-file-parse.mjs FP-1,FP-3    # 只跑指定场景
 *
 * 场景定义见 ./scenarios-file-parse.mjs；任意宿主车道可挂（当前挂在 wps 车道）。
 */
import { runLane } from './harness.mjs'
import { SCENARIOS } from './scenarios-file-parse.mjs'

const ONLY = (process.argv[2] || '').split(',').filter(Boolean)
const list = ONLY.length ? SCENARIOS.filter(s => ONLY.includes(s.id)) : SCENARIOS
if (!list.length) {
  console.error('没有匹配的场景：', ONLY.join(','))
  process.exit(2)
}
const results = await runLane('file-parse', list, { jsonlName: 'results-file-parse.jsonl' })
process.exit(results.every(r => r.pass) ? 0 : 1)
