/* eslint-env node, es2021 */
// fpHome 跨语言 golden:期望值与 desktop Python 端字节级一致(spec 4.1)
globalThis.window = {}
const { normalizeHome, computeFpHome } = await import('../src/utils/license/fingerprint.js')

let pass = 0, fail = 0
const eq = (name, got, want) => { const ok = got === want; (ok ? pass++ : fail++); console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}  got=${got} want=${want}`) }

// 规范化前→后
eq('norm file://+盘符', normalizeHome('file://C:/Users/张三'), 'c:/Users/张三')
eq('norm 反斜杠', normalizeHome('C:\\Users\\张三'), 'c:/Users/张三')
eq('norm 尾斜杠', normalizeHome('/Users/alice/'), '/Users/alice')
eq('norm linux', normalizeHome('/home/alice'), '/home/alice')

// fpHome golden(与 Python 一致)
eq('fp 张三', await computeFpHome('file://C:/Users/张三'), '56cea89e9e6fe544')
eq('fp Alice', await computeFpHome('C:/Users/Alice'), 'd0787d4eae659d04')
eq('fp mac', await computeFpHome('/Users/alice'), '1ac03ebdd106d3fa')
eq('fp linux', await computeFpHome('/home/alice'), '0da135ff2ca62640')

console.log(`\n结果: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
