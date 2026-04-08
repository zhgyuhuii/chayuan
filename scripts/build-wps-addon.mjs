/**
 * Non-interactive WPS JS add-in packager (replaces `wpsjs build` prompts).
 * Web 资源各平台相同；离线包为 7z（与 wpsjs 一致）。Windows 自解压 exe 需在本机执行 wpsjs build --exe（仅 Windows，且 package name 须 ASCII）。
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { currentReleaseTriple, releaseArtifactFilename } from './lib/release-platform.mjs'

const require = createRequire(import.meta.url)
const fsEx = require('fs-extra')
const _7z = require('node-7z')
const _7zBin = require('7zip-bin')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const DISPLAY_NAME = '察元AI文档助手'
const BUILD_DIR = 'wps-addon-build'
const RELEASE_DIR = 'release'

function readPkg() {
	const p = path.join(root, 'package.json')
	return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function parseArgs(argv) {
	const skipVite = argv.includes('--skip-vite')
	const online = argv.includes('--online')
	const offline = argv.includes('--offline')
	const only = online || offline
	return {
		skipVite,
		online: !only || online,
		offline: !only || offline,
	}
}

function copyDistToOnlineTarget(distDir, targetRoot) {
	fsEx.ensureDirSync(targetRoot)
	fsEx.emptyDirSync(targetRoot)
	const skip = new Set([
		BUILD_DIR,
		'node_modules',
		'.vscode',
		'.git',
		'package.json',
		'package-lock.json',
		RELEASE_DIR,
	])
	for (const name of fs.readdirSync(distDir)) {
		if (skip.has(name)) continue
		fsEx.copySync(path.join(distDir, name), path.join(targetRoot, name))
	}
}

function add7z(archivePath, inputPaths) {
	if (process.platform !== 'win32' && _7zBin.path7za && fs.existsSync(_7zBin.path7za)) {
		try {
			fs.chmodSync(_7zBin.path7za, 0o755)
		} catch {
			/* ignore */
		}
	}
	return new Promise((resolve, reject) => {
		const stream = _7z.add(archivePath, inputPaths, {
			recursive: false,
			$bin: _7zBin.path7za,
		})
		stream.on('end', resolve)
		stream.on('error', reject)
	})
}

function publishXmlForPkg(pkg) {
	const type = pkg.addonType || 'wps'
	// enable_dev 仅供本机 wpsjs debug；正式版 / 麒麟 / UOS 等环境需 enable，否则不加载离线包。
	return (
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<jsplugins>\n` +
		`    <jsplugin name="${pkg.name}" type="${type}" url="${pkg.name}_${pkg.version}" version="${pkg.version}" enable="enable" install="null" customDomain=""/>\n` +
		`</jsplugins>\n`
	)
}

/** Flat layout for offline / installers: publish.xml + name_version/ (same as wpsjs exe 7z). */
function writeInstallStaging(distDir, releaseRoot, pkg) {
	const { name, version } = pkg
	const staging = path.join(releaseRoot, 'install-staging')
	fsEx.emptyDirSync(staging)
	const nested = path.join(staging, `${name}_${version}`)
	fsEx.ensureDirSync(nested)
	const skip = new Set([
		BUILD_DIR,
		'node_modules',
		'.vscode',
		'.git',
		'package.json',
		'package-lock.json',
		RELEASE_DIR,
	])
	for (const file of fs.readdirSync(distDir)) {
		if (skip.has(file)) continue
		fsEx.copySync(path.join(distDir, file), path.join(nested, file))
	}
	fs.writeFileSync(path.join(staging, 'publish.xml'), publishXmlForPkg(pkg), 'utf8')
	const meta = {
		name,
		version,
		addonFolder: `${name}_${version}`,
		addonType: pkg.addonType || 'wps',
	}
	fs.writeFileSync(path.join(staging, 'install.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8')
	return staging
}

async function buildOffline7z({ name, version, staging, out7z }) {
	fsEx.ensureDirSync(path.dirname(out7z))
	const publishPath = path.join(staging, 'publish.xml')
	const nested = path.join(staging, `${name}_${version}`)
	await add7z(out7z, [publishPath, nested])
}

function writeInstallReadme(pkg, releaseDir) {
	const { name, version } = pkg
	const verStamp = `${name}_${version}`
	const lines = [
		`${DISPLAY_NAME}（${name} v${version}）`,
		'',
		'说明：加载项前端为静态资源，Windows / Linux / 麒麟 / macOS（含 Apple Silicon 与 Intel）使用同一套构建产物；',
		'差异仅在于本机 WPS 安装路径与「开发工具 → 加载项」中的部署方式（在线 URL 或离线目录）。',
		'',
		'【在线部署】',
		'将 wps-addon-build/ 目录内文件部署到 HTTPS 静态服务器，并在 WPS 中配置对应加载项 URL。',
		'',
		'【离线部署 · 无需手抄文件】',
		`压缩包 ${name}-<版本>-<平台>-<架构>.7z（与构建机一致）内已含 publish.xml 与 ${verStamp} 文件夹；安装包会自动拷入 WPS jsaddons。`,
		'',
		`一键安装（文件名：${name}-<版本>-<平台>-<架构>.<后缀>，例如 ${name}-1.0.1-macos-arm64.pkg）：`,
		`- Windows：npm run build:wps-exe → release/${name}-<ver>-windows-<x64|arm64>.exe。`,
		`- macOS：npm run build:wps-pkg-macos → release/${name}-<ver>-macos-<arm64|x64>.pkg。`,
		`- Linux：npm run build:wps-deb → release/${name}-<ver>-linux-<arm64|x64>.deb，sudo dpkg -i。`,
		'',
		'常见 jsaddons 位置（安装脚本已覆盖；若手动排查可参考）：',
		'- Windows：%AppData%\\Kingsoft\\wps\\jsaddons',
		'- Linux：~/.local/share/Kingsoft/wps/jsaddons',
		'- 麒麟 / UOS 应用商店专业版：另可能在 /opt/apps/cn.wps.wps-office-pro/.../office6/jsaddons；安装 .deb 后请重启 WPS，必要时执行 quickstartoffice restart（见该路径下 bin）。',
		'- macOS：~/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons',
		'',
	]
	const out = path.join(releaseDir, `${DISPLAY_NAME}-v${version}-安装说明.txt`)
	fs.writeFileSync(out, lines.join('\n'), 'utf8')
	console.log('Written:', out)
}

async function main() {
	const argv = process.argv.slice(2)
	const { skipVite, online, offline } = parseArgs(argv)
	const pkg = readPkg()
	const name = pkg.name
	const version = pkg.version
	const distDir = path.join(root, 'dist')
	const buildRoot = path.join(root, BUILD_DIR)
	const releaseRoot = path.join(root, RELEASE_DIR)

	if (!skipVite) {
		execSync('npm run build', { cwd: root, stdio: 'inherit' })
	}
	if (!fs.existsSync(distDir)) {
		console.error('dist/ missing. Run vite build first.')
		process.exit(1)
	}

	fsEx.ensureDirSync(releaseRoot)

	if (online) {
		copyDistToOnlineTarget(distDir, buildRoot)
		console.log(`Online pack: ${buildRoot}`)
	}

	if (offline) {
		const staging = writeInstallStaging(distDir, releaseRoot, pkg)
		console.log(`Install staging (for .pkg/.deb/.7z): ${staging}`)
		const { platform, arch } = currentReleaseTriple()
		const z7Name = releaseArtifactFilename(name, version, platform, arch, '.7z')
		const release7z = path.join(releaseRoot, z7Name)
		await buildOffline7z({ name, version, staging, out7z: release7z })
		console.log(`Offline 7z: ${release7z}`)
		fsEx.ensureDirSync(buildRoot)
		const build7z = path.join(buildRoot, z7Name)
		fsEx.copySync(release7z, build7z)
		console.log(`Also copied to: ${build7z}`)
	}

	writeInstallReadme(pkg, releaseRoot)
	console.log('Done.')
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
