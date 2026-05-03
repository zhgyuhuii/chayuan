#!/usr/bin/env node
/**
 * audit-kb-prompts — promptBuilder 三 mode 静态审计 + 示例输出 dump
 *
 * 目的:
 *   1. 用 12 个典型 fixture 跑 promptBuilder.build,断言 prompt 包含必要约束
 *   2. 把每条最终 prompt dump 到 stdout,便于人工"眼审"是否合理
 *   3. 可作 CI 一道闸门:断言失败 = prompt 工程退化
 *
 * 跑法:
 *   node scripts/audit-kb-prompts.mjs           # 简洁报告
 *   node scripts/audit-kb-prompts.mjs --dump    # 同时打印每条 prompt 全文
 */
const dump = process.argv.includes('--dump')

const repoRoot = new URL('..', import.meta.url).href
const pb = await import(repoRoot + 'src/services/kb/promptBuilder.js')

// ---------- 通用 fixture 工厂 ----------
const mkSource = (i, opts = {}) => ({
  text: opts.text || `这是知识片段 ${i} 的内容,用来测试 prompt 渲染。`,
  kb_name: opts.kb_name || `kb-${i}`,
  file_name: opts.file_name || `doc-${i}.pdf`,
  metadata: opts.metadata || { section_path: ['第一章', `节${i}`] },
  trust: opts.trust ?? (0.9 - i * 0.1),
  stars: opts.stars ?? Math.max(1, 5 - i),
})

const FIXTURES = [
  // ==== QA 模式 (5 个) ====
  { id: 'qa-01-normal',
    mode: 'qa',
    args: {
      mode: 'qa',
      sources: [mkSource(1), mkSource(2)],
      userQuery: 'PostgreSQL 怎么开启行级安全 RLS?'
    },
    musts: [
      ['systemPrompt 含"知识库"', p => /知识库/.test(p.systemPrompt)],
      ['systemPrompt 含 [^cN] 引用约束', p => /\[\^?cN\]/.test(p.systemPrompt) || /\[cN\]/.test(p.systemPrompt)],
      ['systemPrompt 禁编造', p => /不要编造|不许编造/.test(p.systemPrompt)],
      ['systemPrompt 禁 URL', p => /URL|路径/.test(p.systemPrompt)],
      ['userPrompt 含"问题"', p => /问题/.test(p.userPrompt)],
      ['userPrompt 含原始问题', p => p.userPrompt.includes('PostgreSQL')],
      ['citationMap 完整', p => p.citationMap.c1 && p.citationMap.c2],
      ['kept=2 droppedByBudget=0', p => p.kept === 2 && p.droppedByBudget === 0],
    ]
  },
  { id: 'qa-02-empty-sources',
    mode: 'qa',
    args: {
      mode: 'qa',
      sources: [],
      userQuery: '帮我列出所有客户'
    },
    musts: [
      ['空源时 prompt 仍能 build 不抛', p => p && p.systemPrompt],
      ['空源时模型有"未覆盖"指引', p => /未覆盖|没有可用|无可用/.test(p.systemPrompt + p.userPrompt)],
      ['kept=0', p => p.kept === 0],
    ]
  },
  { id: 'qa-03-long-budget-truncation',
    mode: 'qa',
    args: {
      mode: 'qa',
      // 20 个超长片段每个 1000 字 → 触发 8000 字硬上限
      sources: Array.from({ length: 20 }, (_, i) =>
        mkSource(i, { text: '长'.repeat(1000) })),
      userQuery: '总结一下'
    },
    musts: [
      ['硬上限触发 droppedByBudget>0', p => p.droppedByBudget > 0],
      ['kept ≤ 14 (8000/600≈13.3)', p => p.kept <= 14],
      ['每段被裁到 ≤ 600 字', p => Object.values(p.citationMap).every(s => s.text.length <= 600)],
    ]
  },
  { id: 'qa-04-trust-rendered',
    mode: 'qa',
    args: {
      mode: 'qa',
      sources: [
        mkSource(1, { trust: 0.92 }),
        mkSource(2, { trust: 0.31 }),
      ],
      userQuery: '?'
    },
    musts: [
      ['trust 数值出现在 prompt 里供模型参考', p => /trust=0\.92/.test(p.userPrompt)],
      ['低 trust 也照常渲染(由模型/UI 自行加权)', p => /trust=0\.31/.test(p.userPrompt)],
    ]
  },
  { id: 'qa-05-special-chars-in-source',
    mode: 'qa',
    args: {
      mode: 'qa',
      sources: [mkSource(1, { text: '含括号(test)\n含换行\n[c?] 占位' })],
      userQuery: '解释下'
    },
    musts: [
      ['source 文本不被破坏', p => /\(test\)/.test(p.userPrompt)],
      // [c?] 不应被当作真实引用 — citationMap 应只含 c1
      ['citationMap 只有 c1', p => Object.keys(p.citationMap).length === 1 && p.citationMap.c1],
    ]
  },

  // ==== VERIFY 模式 (4 个) ====
  { id: 'verify-01-normal',
    mode: 'verify',
    args: {
      mode: 'verify',
      sources: [mkSource(1, { text: '小米 14 Pro 售价 ¥4999 起。' })],
      selectionText: '小米 14 Pro 起售价为 5999 元。'
    },
    musts: [
      ['systemPrompt 含核对/一致词', p => /核对|一致|不一致/.test(p.systemPrompt)],
      ['systemPrompt 要求"应为"修正提示', p => /应为/.test(p.systemPrompt)],
      ['systemPrompt 要求一致率', p => /一致率|百分比|%/.test(p.systemPrompt)],
      ['userPrompt 含"待核对原文"段', p => /待核对原文/.test(p.userPrompt)],
      ['userPrompt 含"知识库片段"段', p => /知识库片段/.test(p.userPrompt)],
      ['userPrompt 含原始 selectionText', p => p.userPrompt.includes('5999')],
    ]
  },
  { id: 'verify-02-no-selection',
    mode: 'verify',
    args: {
      mode: 'verify',
      sources: [mkSource(1)],
      selectionText: '',
      userQuery: '帮我核对一下'
    },
    musts: [
      // 当前 fallback 行为:selectionText 空 → 用 userQuery
      // 风险:用户问 "帮我核对" 但没选段,落到 verify 会变成"核对 用户的问题",语义错位
      // 该 fixture 暴露这个 bug,审计应失败要求修复
      ['空 selectionText 时拒绝 build (or 显式标记缺待核对原文)',
        p => /缺少待核对原文|没有原文|请先选段/.test(p.userPrompt) ||
             p.error === 'missing_selection'],
    ]
  },
  { id: 'verify-03-conflict-among-sources',
    mode: 'verify',
    args: {
      mode: 'verify',
      sources: [
        mkSource(1, { text: '会议在周三下午 2 点。' }),
        mkSource(2, { text: '会议时间已改到周四上午 10 点。' }),
        mkSource(3, { text: '具体时间以最新通知为准。' }),
      ],
      selectionText: '会议在周三下午 2 点召开。'
    },
    musts: [
      // KB 内多源冲突时,prompt 应让模型感知"片段间也可能不一致"
      ['systemPrompt 提示冲突处理',
        p => /冲突|矛盾|分歧|不同片段|多个片段|多源/.test(p.systemPrompt)],
    ]
  },
  { id: 'verify-04-out-of-scope-question',
    mode: 'verify',
    args: {
      mode: 'verify',
      sources: [mkSource(1)],
      selectionText: '帮我写一首唐诗。'
    },
    musts: [
      // 防角色互窜:user 在选段里塞了任务,verify 模式应坚持核对而非"开始写诗"
      ['systemPrompt 限定只完成核对任务',
        p => /只(进行|执行|完成).*核对|不(要|得).*(其他|其它|额外)|不偏离/.test(p.systemPrompt)],
    ]
  },

  // ==== SUMMARIZE 模式 (3 个) ====
  { id: 'summarize-01-normal',
    mode: 'summarize',
    args: {
      mode: 'summarize',
      sources: [mkSource(1), mkSource(2), mkSource(3)],
    },
    musts: [
      ['systemPrompt 要求章节(##)', p => /##/.test(p.systemPrompt)],
      ['systemPrompt 要求末尾参考清单', p => /参考清单|引用清单|来源清单/.test(p.systemPrompt)],
      ['systemPrompt 禁补充', p => /(不要|禁止).*(凭空|编造|补充|猜测|额外)/.test(p.systemPrompt)],
      ['userPrompt 含 3 段', p =>
        /\[c1\]/.test(p.userPrompt) && /\[c2\]/.test(p.userPrompt) && /\[c3\]/.test(p.userPrompt)],
    ]
  },
  { id: 'summarize-02-length-cap',
    mode: 'summarize',
    args: {
      mode: 'summarize',
      sources: Array.from({ length: 8 }, (_, i) => mkSource(i)),
    },
    musts: [
      ['systemPrompt 限定输出长度上限',
        p => /字以内|字数控制|不超过|长度上限|≤\s*\d+\s*字/.test(p.systemPrompt)],
    ]
  },
  { id: 'summarize-03-empty',
    mode: 'summarize',
    args: { mode: 'summarize', sources: [] },
    musts: [
      ['空源时 prompt 仍能 build', p => p && p.systemPrompt],
      ['空源时不让模型瞎编',
        p => /没有可用|无可用片段|无内容可总结/.test(p.systemPrompt + p.userPrompt)],
    ]
  },
]

// ---------- 跑 ----------
let pass = 0
let fail = 0
const failures = []

for (const fx of FIXTURES) {
  let built
  try {
    built = pb.build(fx.args)
  } catch (e) {
    built = { error: e?.message || String(e) }
  }
  console.log(`\n=== ${fx.id} (${fx.mode}) ===`)
  if (dump) {
    console.log('--- systemPrompt ---')
    console.log(built.systemPrompt || '(none)')
    console.log('--- userPrompt ---')
    console.log(built.userPrompt || '(none)')
    console.log('--- meta ---')
    console.log(`kept=${built.kept ?? '?'}  droppedByBudget=${built.droppedByBudget ?? '?'}  citations=${Object.keys(built.citationMap || {}).length}`)
  }
  for (const [name, fn] of fx.musts) {
    let ok = false
    try { ok = !!fn(built) } catch (e) { ok = false }
    if (ok) {
      pass += 1
      console.log(`  ✓ ${name}`)
    } else {
      fail += 1
      failures.push(`${fx.id}: ${name}`)
      console.log(`  ✗ ${name}`)
    }
  }
}

console.log()
console.log(`通过 ${pass} 项 / 失败 ${fail} 项`)
if (failures.length) {
  console.log('\n失败明细(prompt 工程改进项):')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
