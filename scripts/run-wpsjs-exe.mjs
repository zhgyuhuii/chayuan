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
 *
 * 编码陷阱（已踩过）：Windows cmd 默认 OEM 代码页（中文系统 CP936），UTF-8 中文写进 .bat
 * 会被拆坏换行/命令，表现为「脚本乱码」且 xcopy/copy 失败 → WPS 不加载插件。
 * 因此 copy.bat 必须纯 ASCII；安装对话框文案走 SFX 的 UTF-8 配置段。
 * publish.xml 与官方 wpsjs 离线包一致使用 enable_dev，否则 Windows 常不加载本地 jsaddons。
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
	// 与官方 wpsjs/build.js 对齐：Title 用 ASCII，BeginPrompt 少量中文（SFX UTF-8 段可正确显示）
	return Buffer.from(
		`
  ;!@Install@!UTF-8!
  Title="Install WPS jsaddons"
  BeginPrompt="确定要安装 ${displayName}？"
  RunProgram="copy.bat"
  ;!@InstallEnd@!
`,
		'utf-8'
	)
}

/**
 * Windows 离线包 publish.xml：必须用 enable_dev（与官方 wpsjs CreatePublishXml 一致）。
 * enable=enable 在部分 Windows WPS 下不会加载本地 jsaddons 目录。
 */
function publishXmlForWindowsOffline(pkg) {
	const type = pkg.addonType || 'wps'
	return Buffer.from(
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
			`<jsplugins>\n` +
			`    <jsplugin name="${pkg.name}" type="${type}" url="${pkg.name}_${pkg.version}" version="${pkg.version}" enable="enable_dev" install="null" customDomain=""/>\n` +
			`</jsplugins>\n`,
		'utf-8'
	)
}

/** 目标机执行的安装脚本：纯 ASCII，避免 CP936 下 UTF-8 中文拆坏命令。 */
function buildCopyBat(pkg) {
	const folder = `${pkg.name}_${pkg.version}`
	// Keep every character ASCII. Chinese comments here WILL break cmd.exe on CP936.
	return Buffer.from(
		`@echo off
setlocal EnableExtensions
set "LOG=%TEMP%\\chayuan-wps-install.log"
set "source_folder=${folder}"
set "destination_folder=%APPDATA%\\kingsoft\\wps\\jsaddons"
set "sidecar_runtime=%LOCALAPPDATA%\\chayuan-wps\\mcp\\runtime"
set "sidecar_exe=%sidecar_runtime%\\${SIDECAR_EXE_NAME}"

echo [%DATE% %TIME%] install start> "%LOG%"
echo source=%source_folder%>> "%LOG%"
echo dest=%destination_folder%>> "%LOG%"

if not exist "%destination_folder%" mkdir "%destination_folder%"
if errorlevel 1 goto :fail_mkdir
if not exist "%destination_folder%\\%source_folder%" mkdir "%destination_folder%\\%source_folder%"

echo copying addon...>> "%LOG%"
xcopy /E /I /Y /Q "%source_folder%" "%destination_folder%\\%source_folder%" >> "%LOG%" 2>&1
if errorlevel 1 goto :fail_addon

echo copying publish.xml...>> "%LOG%"
copy /Y "publish.xml" "%destination_folder%\\publish.xml" >> "%LOG%" 2>&1
if errorlevel 1 goto :fail_publish

if not exist "%sidecar_runtime%" mkdir "%sidecar_runtime%"
if not exist "%sidecar_runtime%\\bin" mkdir "%sidecar_runtime%\\bin"
echo copying sidecar...>> "%LOG%"
copy /Y "${SIDECAR_EXE_NAME}" "%sidecar_exe%" >> "%LOG%" 2>&1
copy /Y "${SIDECAR_EXE_NAME}" "%sidecar_runtime%\\bin\\${SIDECAR_EXE_NAME}" >> "%LOG%" 2>&1
> "%sidecar_runtime%\\start-mcp.cmd" echo @echo off
>> "%sidecar_runtime%\\start-mcp.cmd" echo powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%%~dp0${SIDECAR_EXE_NAME}' -WindowStyle Hidden"
rem HKCU Run points to the generated start-mcp.cmd (hidden launch); launching the exe
rem directly would open a persistent console window at every logon
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v ChayuanWpsMcp /t REG_SZ /d "\\"%sidecar_runtime%\\start-mcp.cmd\\"" /f >> "%LOG%" 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%sidecar_exe%' -WindowStyle Hidden"

echo [%DATE% %TIME%] install ok>> "%LOG%"
echo.
echo Install OK. Please fully quit and restart WPS.
echo Log: %LOG%
ping -n 4 127.0.0.1 >nul
exit /b 0

:fail_mkdir
echo FAILED: cannot create jsaddons dir>> "%LOG%"
echo ERROR: cannot create %%APPDATA%%\\kingsoft\\wps\\jsaddons
echo See log: %LOG%
pause
exit /b 1

:fail_addon
echo FAILED: xcopy addon>> "%LOG%"
echo ERROR: failed to copy addon files
echo See log: %LOG%
pause
exit /b 1

:fail_publish
echo FAILED: copy publish.xml>> "%LOG%"
echo ERROR: failed to copy publish.xml
echo See log: %LOG%
pause
exit /b 1
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
	// Windows exe 专用 publish.xml（enable_dev），不复用 staging 里可能给 Linux 用的 enable
	fs.writeFileSync(path.join(tmp, 'publish.xml'), publishXmlForWindowsOffline(pkg))
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

	// 5. 拼接 SFX：一次写完，避免 WriteStream 多次 write 大缓冲时截断
	const arch = 'x64' // 当前仅产出 windows-x64 sidecar 二进制
	const outExe = path.join(root, 'release', releaseArtifactFilename(name, version, 'windows', arch, '.exe'))
	fsEx.ensureDirSync(path.dirname(outExe))
	fs.writeFileSync(
		outExe,
		Buffer.concat([
			fs.readFileSync(SFX_STUB),
			sfxConfigBuffer(displayName),
			fs.readFileSync(archive7z),
		])
	)
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
