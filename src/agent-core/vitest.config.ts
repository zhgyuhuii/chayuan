// 上游 tests 以 '../src/xxx' 引用包内模块（上游布局 packages/agent-core/{src,tests}）；
// 本目录为平铺 vendored（*.ts 与 tests/ 同级），把该前缀别名回本目录，
// 即可字节级复用上游测试（tests/ 不做任何本地改动）。
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const here = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: [{ find: '../src', replacement: here.replace(/\/$/, '') }]
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
