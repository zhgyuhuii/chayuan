/* eslint-env node */
/**
 * dev-debug - 三宿主（文字/表格/演示）本地调试一键脚本。
 *
 * 为什么不用 `wpsjs debug`（2026-10-06 实测结论）：
 *   1. 它写入 jsaddons/publish.xml 的注册只有一条 `type=addonType`（本项目为 wps），
 *      表格(et)/演示(wpp)宿主完全不加载 → 顶部没有察元菜单；
 *   2. 它自带 express 静态服务直接伺服工程根目录，vite 工程（.vue 源码）根本跑不起来；
 *   3. WPS 的 authaddin.json 信任表也按宿主分开记录，只从文字宿主登记过的 URL
 *      加载项，表格/演示宿主首次加载可能弹信任确认（属正常，确认即可）。
 *
 * 本脚本做四件事：
 *   A. 确保 vite dev server 在指定端口（默认 3889）可用，没起就替你起（复用已有实例）；
 *   B. 备份 jsaddons/publish.xml → publish.xml.chayuan-dev.bak（仅首次，保留的是你原本的安装态）；
 *   C. 写入三条 jspluginonline（wps/et/wpp）注册，url 全指向 vite；
 *   D. 尽力拉起 WPS（已运行则提示完全退出后重开，不替用户杀进程）。
 *
 * 用法：
 *   npm run dev:debug                  # 起服务 + 写注册 + 开 WPS（macOS 自动，其余平台打印指引）
 *   npm run dev:debug -- --restore     # 还原 publish.xml 备份（退出调试时恢复正式安装）
 *   npm run dev:debug -- --port 3891   # 指定端口
 *   npm run dev:debug -- --no-open     # 只写注册，不拉起 WPS
 *
 * 调试结束：Ctrl+C 停掉 vite 后，WPS 里的加载项会指向已关闭的服务；
 * 运行 `npm run dev:debug -- --restore` 恢复原 publish.xml，再重启 WPS 即回到正式安装。
 */

import { spawn, execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const HOST_ENTRIES = [
  { name: 'chayuan', type: 'wps' },
  { name: 'chayuan-et', type: 'et' },
  { name: 'chayuan-wpp', type: 'wpp' }
]

const BACKUP_NAME = 'publish.xml.chayuan-dev.bak'

function parseArgs(argv) {
  const portFlag = argv.indexOf('--port')
  const port = portFlag !== -1 ? Number(argv[portFlag + 1]) : Number(process.env.CHAYUAN_DEV_PORT || 3889)
  return {
    restore: argv.includes('--restore'),
    open: !argv.includes('--no-open'),
    port: Number.isFinite(port) && port > 0 ? port : 3889
  }
}

function jsaddonsDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || '', 'kingsoft', 'wps', 'jsaddons')
  }
  if (process.platform === 'darwin') {
    return path.join(
      os.homedir(),
      'Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons'
    )
  }
  return path.join(os.homedir(), '.local/share/Kingsoft/wps/jsaddons')
}

async function isHttpAlive(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) })
    return res.ok || res.status === 404 // 404 也算活着：服务在，只是该路径不存在
  } catch {
    return false
  }
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isHttpAlive(url)) return true
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

function writeDebugPublish(dir, origin) {
  const publishPath = path.join(dir, 'publish.xml')
  const backupPath = path.join(dir, BACKUP_NAME)
  if (fs.existsSync(publishPath) && !fs.existsSync(backupPath)) {
    fs.copyFileSync(publishPath, backupPath)
    console.log(`已备份原 publish.xml → ${BACKUP_NAME}`)
  }
  // 每宿主 url 路径分段（/et/ /wpp/ /）：WPS 拉 <url>/ribbon.xml 自然命中
  // 各宿主 ribbon 文件（vite 中间件伺服）。不能放查询串——会破坏 WPS 的
  // ribbon.xml 相对路径拼接（2026-10 实测）
  const entries = HOST_ENTRIES.map(
    (h) =>
      `    <jspluginonline name="${h.name}" type="${h.type}" url="${origin}/${h.type === 'wps' ? '' : h.type + '/'}" debug="code" customDomain=""/>`
  ).join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<jsplugins>\n${entries}\n</jsplugins>\n`
  fs.writeFileSync(publishPath, xml, 'utf8')
  console.log(`已写入调试注册（文字/表格/演示 三宿主 → ${origin}/）：`)
  HOST_ENTRIES.forEach((h) => console.log(`  - ${h.type.padEnd(3)} ${h.name}`))
}

function restorePublish(dir) {
  const publishPath = path.join(dir, 'publish.xml')
  const backupPath = path.join(dir, BACKUP_NAME)
  if (!fs.existsSync(backupPath)) {
    console.log(`没有找到备份 ${BACKUP_NAME}，无需还原。`)
    return
  }
  fs.copyFileSync(backupPath, publishPath)
  fs.rmSync(backupPath)
  console.log('已还原 publish.xml（正式安装态）。请完全退出并重新打开 WPS 生效。')
}

function launchWps() {
  try {
    if (process.platform === 'darwin') {
      const app = '/Applications/wpsoffice.app'
      if (!fs.existsSync(app)) {
        console.log('未找到 /Applications/wpsoffice.app，请手动打开 WPS。')
        return
      }
      let running = false
      try {
        execSync('pgrep -x wpsoffice', { stdio: 'ignore' })
        running = true
      } catch { /* pgrep 无匹配时退出码非 0，即未运行 */ }
      if (running) {
        console.log('⚠️  WPS 正在运行：jsaddons 注册只在启动时读取，请完全退出 WPS（⌘Q）后重新打开。')
        console.log('   （不会替你杀 WPS 进程，避免丢未保存文档。）')
        return
      }
      spawn('open', ['-a', app], { detached: true, stdio: 'ignore' }).unref()
      console.log('已拉起 WPS。')
      return
    }
    if (process.platform === 'win32') {
      console.log('请手动启动 WPS（注册表定位 wps.exe 的逻辑未内置；wpsjs debug 同款路径可用）。')
      return
    }
    const candidates = [
      '/opt/kingsoft/wps-office/office6/wpsoffice',
      '/opt/apps/cn.wps.wps-office-pro/files/kingsoft/wps-office/office6/wpsoffice'
    ]
    const bin = candidates.find((p) => fs.existsSync(p))
    if (bin) {
      spawn(bin, { detached: true, stdio: 'ignore' }).unref()
      console.log(`已拉起 WPS：${bin}`)
    } else {
      console.log('未找到 Linux WPS 可执行文件，请手动启动 WPS。')
    }
  } catch (e) {
    console.log(`拉起 WPS 失败（${e?.message || e}），请手动打开 WPS。`)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const dir = jsaddonsDir()
  if (!fs.existsSync(dir)) {
    console.error(`未找到 WPS jsaddons 目录：${dir}\n请确认已安装 WPS（或本加载项至少安装过一次）。`)
    process.exit(1)
  }

  if (options.restore) {
    restorePublish(dir)
    return
  }

  const origin = `http://127.0.0.1:${options.port}`
  let viteChild = null
  if (await isHttpAlive(origin)) {
    console.log(`端口 ${options.port} 已有服务在跑，直接复用：${origin}`)
  } else {
    console.log(`启动 vite dev server（${origin}）...`)
    viteChild = spawn('npm', ['run', 'dev', '--', '--port', String(options.port), '--strictPort'], {
      cwd: root,
      stdio: 'inherit'
    })
    const ok = await waitForHttp(origin, 30_000)
    if (!ok) {
      console.error(`vite 30s 内未就绪（${origin}）。请手动确认 npm run dev 可用后重试。`)
      viteChild.kill('SIGINT')
      process.exit(1)
    }
  }

  writeDebugPublish(dir, origin)

  if (options.open) launchWps()

  console.log('')
  console.log('调试就绪：')
  console.log('  · 文字/表格/演示 三宿主都会加载本加载项（顶部出现「察元AI助理」）')
  console.log('  · 表格/演示宿主首次加载若弹「信任加载项」确认，选信任即可（authaddin.json 按宿主分记）')
  console.log('  · 结束调试：Ctrl+C 停 vite → npm run dev:debug -- --restore → 重启 WPS')
  console.log('')

  if (viteChild) {
    viteChild.on('exit', () => process.exit(0))
    const forward = (sig) => {
      viteChild.kill(sig)
    }
    process.on('SIGINT', () => forward('SIGINT'))
    process.on('SIGTERM', () => forward('SIGTERM'))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
