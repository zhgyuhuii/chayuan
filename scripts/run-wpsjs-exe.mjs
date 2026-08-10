#!/usr/bin/env node
/**
 * 构建 Windows 自解压安装器：release/<name>-<version>-windows-x64.exe
 *
 * 不再依赖 `wpsjs build --exe`（仅 Windows 可跑且不含 sidecar）。改为自建 SFX：
 *   exe = 7zSD.sfx + SFX 配置缓冲 + 7z(copy.bat + publish.xml + 插件目录 + sidecar 二进制)
 * 7z 压缩与字节拼接均跨平台 → 本安装器可在任意平台构建（输出仍是合法 Windows 自解压 exe）。
 *
 * copy.bat 在目标机执行：装插件到 jsaddons + 释放 sidecar 二进制到 %LOCALAPPDATA% +
 * 写 HKCU\...\Run 自启 + 立即启动 → 零 Node 依赖、零弹窗、登录即常驻。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { releaseArtifactFilename, installHint } from './lib/release-platform.mjs'

const require = createRequire(import.meta.url)
const _7z = require('node-7z')
const _7zBin = require('7zip-bin')
const fsEx = require('fs-extra')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SIDECAR_EXE_NAME = 'chayuan-mcp-windows-x64.exe'
const SIDECAR_EXE = path.join(root, 'mcp-sidecar', 'bin', SIDECAR_EXE_NAME)
const WPSJS_DIR = path.join(root, 'node_modules', 'wpsjs')
const SFX_STUB = path.join(WPSJS_DIR, 'src', 'lib', 'res', '7zSD.sfx')

function add7z(archivePath, inputPaths) {
	if (process.platform !== 'win32' && _7zBin.path7za && fs.existsSync(_7zBin.path7za)) {
		try { fs.chmodSync(_7zBin.path7za, 0o755) } catch { /* ignore */ }
	}
	return new Promise((resolve, reject) => {
		const stream = _7z.add(archivePath, inputPaths, { recursive: false, $bin: _7zBin.path7za })
		stream.on('end', resolve)
		stream.on('error', reject)
	})
}

/** 自解压运行时配置（与 wpsjs 同结构：;!@Install@!UTF-8! … ;!@InstallEnd@!）。 */
function sfxConfigBuffer(displayName) {
	return Buffer.from(
`\n  ;!@Install@!UTF-8!
  Title="安装 ${displayName}"
  BeginPrompt="确定要安装 ${displayName}？（将一并配置本机文档智能体服务为开机自启）"
  RunProgram="copy.bat"
  ;!@InstallEnd@!\n`,
		'utf-8'
	)
}

/** 目标机执行的安装脚本：插件 + sidecar 二进制 + HKCU Run 自启 + 立即启动。 */
function buildCopyBat(pkg) {
	const folder = `${pkg.name}_${pkg.version}`
	const runtimeDir = '%LOCALAPPDATA%\\chayuan-wps\\mcp\\runtime'
	const exePath = `${runtimeDir}\\${SIDECAR_EXE_NAME}`
	return Buffer.from(
`@echo off
set source_folder=${folder}
set destination_folder=%appdata%\\kingsoft\\wps\\jsaddons
set sidecar_runtime=${runtimeDir}
set sidecar_exe=${exePath}

if not exist "%destination_folder%" mkdir "%destination_folder%"
if not exist "%destination_folder%\\%source_folder%" mkdir "%destination_folder%\\%source_folder%"
xcopy /E /I /Y /Q "%source_folder%" "%destination_folder%\\%source_folder%"
copy /Y "publish.xml" "%destination_folder%\\publish.xml"

rem --- 察元 MCP sidecar：释放单文件二进制 + 注册开机自启 + 立即启动（无需 Node.js）---
if not exist "%sidecar_runtime%" mkdir "%sidecar_runtime%"
copy /Y "${SIDECAR_EXE_NAME}" "%sidecar_exe%"
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v ChayuanWpsMcp /t REG_SZ /d "\\"%sidecar_exe%\\"" /f >nul 2>nul
start "" "%sidecar_exe%"
`,
		'utf-8'
	)
}

async function main() {
	const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
	const { name, version } = pkg
	const displayName = pkg.displayName || '察元AI文档助手'

	// 1. 确保 release/install-staging 存在（插件目录 + publish.xml + mcp-sidecar）
	const staging = path.join(root, 'release', 'install-staging')
	if (!fs.existsSync(path.join(staging, 'install.json'))) {
		console.log('release/install-staging 缺失，运行 build:wps-all ...')
		execSync('npm run build:wps-all', { cwd: root, stdio: 'inherit' })
	}

	// 2. 前置检查：sidecar 二进制 + SFX 桩
	if (!fs.existsSync(SIDECAR_EXE)) {
		console.error(`✗ 缺 sidecar 二进制：${path.relative(root, SIDECAR_EXE)}（先跑 npm run mcp:build-binary）`)
		process.exit(1)
	}
	if (!fs.existsSync(SFX_STUB)) {
		console.error(`✗ 缺 7-Zip SFX 桩：${path.relative(root, SFX_STUB)}（确认 wpsjs 已安装）`)
		process.exit(1)
	}

	// 3. 组装临时载荷：插件目录(去掉 mcp-sidecar/bin 平台二进制) + publish.xml + sidecar exe + copy.bat
	const tmp = path.join(root, 'release', '.wps-sfx-build')
	fsEx.removeSync(tmp)
	fsEx.ensureDirSync(tmp)
	const sep = path.sep
	const addonSrc = path.join(staging, `${name}_${version}`)
	if (!fs.existsSync(addonSrc)) {
		console.error(`✗ staging 内插件目录缺失：${path.relative(root, addonSrc)}`)
		process.exit(1)
	}
	const addonDst = path.join(tmp, `${name}_${version}`)
	fsEx.copySync(addonSrc, addonDst, {
		// 排除 mcp-sidecar/bin（平台相关二进制由 copy.bat 单独释放到 %LOCALAPPDATA%）
		filter: (src) => !src.includes(`${sep}bin${sep}`) && !src.endsWith(`${sep}bin`)
	})
	fsEx.copySync(path.join(staging, 'publish.xml'), path.join(tmp, 'publish.xml'))
	fs.copyFileSync(SIDECAR_EXE, path.join(tmp, SIDECAR_EXE_NAME))
	fs.writeFileSync(path.join(tmp, 'copy.bat'), buildCopyBat(pkg))

	// 4. 7z 压缩载荷
	const archive7z = path.join(tmp, `${name}.7z`)
	console.log('压缩 7z 载荷 ...')
	await add7z(archive7z, [
		path.join(tmp, 'copy.bat'),
		path.join(tmp, 'publish.xml'),
		path.join(tmp, SIDECAR_EXE_NAME),
		addonDst,
	])

	// 5. 拼接 SFX：7zSD.sfx + 配置 + 7z
	const arch = 'x64' // 当前仅产出 windows-x64 sidecar 二进制
	const outExe = path.join(root, 'release', releaseArtifactFilename(name, version, 'windows', arch, '.exe'))
	fsEx.ensureDirSync(path.dirname(outExe))
	await new Promise((resolve, reject) => {
		const out = fs.createWriteStream(outExe)
		out.on('error', reject)
		out.write(fs.readFileSync(SFX_STUB), () => {})
		out.write(sfxConfigBuffer(displayName), () => {})
		out.write(fs.readFileSync(archive7z), () => {})
		out.end(resolve)
	})
	fsEx.removeSync(tmp)

	const rel = path.relative(root, outExe).split(path.sep).join('/')
	console.log(`✓ Windows SFX built: ${rel} (${fs.statSync(outExe).size} bytes)`)

	// 6. 写发布清单（直接写，标真实目标三元组 windows/x64，而非构建机平台）
	const manifest = {
		version,
		platform: 'windows',
		arch,
		suffix: `windows-${arch}`,
		artifact: rel,
		installSummary: installHint('windows', arch),
	}
	fs.writeFileSync(path.join(path.dirname(outExe), '.chayuan-last-build.json'), JSON.stringify(manifest, null, 2), 'utf8')
	console.log(`Wrote release/.chayuan-last-build.json`)
	console.log(manifest.installSummary)
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
