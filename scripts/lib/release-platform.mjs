/**
 * Canonical OS/arch IDs for release filenames and manifests.
 * Web 资源各平台相同；文件名区分架构用于 Release 资产与用户选型。
 *
 * Windows：不能用 process.arch 代表「本机系统架构」。ARM64 Windows 上常安装 x64 版 Node，
 * process.arch 为 x64，但系统实为 ARM64。此处用 CIM / wmic 读 Win32_ComputerSystem.SystemType
 *（及 OS 架构）得到主机类型，与当前 Node 是否模拟运行无关。
 */
import { execFileSync } from 'node:child_process'
import os from 'node:os'

/** @param {string} machine */
export function normalizeArchFromUname(machine) {
	const m = String(machine || '').toLowerCase()
	if (m === 'arm64' || m === 'aarch64') return 'arm64'
	if (m === 'x86_64' || m === 'amd64') return 'x64'
	if (m === 'i386' || m === 'i686') return 'ia32'
	return m || 'unknown'
}

export function platformFamily() {
	if (process.platform === 'darwin') return 'macos'
	if (process.platform === 'linux') return 'linux'
	if (process.platform === 'win32') return 'windows'
	return process.platform
}

/** Node-style arch → canonical (win/linux/mac consistent) */
export function normalizeNodeArch(arch = process.arch) {
	const a = String(arch || '').toLowerCase()
	if (a === 'arm64') return 'arm64'
	if (a === 'x64') return 'x64'
	if (a === 'ia32') return 'ia32'
	if (a === 'arm') return 'arm'
	return a || 'unknown'
}

/**
 * Map Win32_ComputerSystem.SystemType (localized or en) / similar strings → release arch id.
 * @param {string} raw
 */
function mapWindowsSystemTypeToArch(raw) {
	const t = String(raw || '').trim()
	if (!t) return null
	// 英/中常见：ARM64-based PC、基于 ARM64 的 PC；须先于含 “ARM” 的泛匹配
	if (/ARM\s*64|ARM64/i.test(t)) return 'arm64'
	if (/x64|AMD64|WOW64|基于\s*x64/i.test(t)) return 'x64'
	if (/x86|i686|i386|基于\s*x86/i.test(t) && !/x86[_-]?64|AMD64/i.test(t)) return 'ia32'
	return null
}

/**
 * Windows 安装包命名用的「主机」架构（与 Node 可执行文件架构脱钩）。
 */
export function windowsHostArchForRelease() {
	if (process.arch === 'arm64') {
		return 'arm64'
	}

	try {
		const psOut = execFileSync(
			'powershell.exe',
			[
				'-NoProfile',
				'-ExecutionPolicy',
				'Bypass',
				'-Command',
				'(Get-CimInstance -ClassName Win32_ComputerSystem).SystemType',
			],
			{
				encoding: 'utf8',
				timeout: 15000,
				windowsHide: true,
				stdio: ['ignore', 'pipe', 'pipe'],
			},
		)
		const mapped = mapWindowsSystemTypeToArch(psOut)
		if (mapped) return mapped
	} catch {
		/* PowerShell 不可用或策略限制 */
	}

	try {
		const wm = execFileSync('cmd.exe', ['/d', '/s', '/c', 'wmic os get osarchitecture /value'], {
			encoding: 'utf8',
			timeout: 15000,
			windowsHide: true,
			stdio: ['ignore', 'pipe', 'pipe'],
		})
		const m = wm.match(/OSArchitecture=([^\r\n]+)/i)
		if (m) {
			const v = m[1].trim()
			if (/ARM\s*64|ARM64/i.test(v)) return 'arm64'
			if (/64/.test(v) && /ARM/i.test(v)) return 'arm64'
			if (/64/.test(v)) return 'x64'
			if (/32/.test(v)) return 'ia32'
		}
	} catch {
		/* wmic 在新版 Windows 可能未安装 */
	}

	return normalizeNodeArch()
}

export function currentReleaseTriple() {
	const family = platformFamily()
	const arch =
		family === 'windows' ? windowsHostArchForRelease() : normalizeArchFromUname(os.machine())
	return { platform: family, arch, suffix: `${family}-${arch}` }
}

/**
 * 安装包文件名：{name}-{version}-{platform}-{arch}{ext}
 * platform/arch 与 {@link currentReleaseTriple} 一致（由当前构建机决定）。
 * @param {string} ext 含点，如 ".deb"
 */
export function releaseArtifactFilename(pkgName, version, platform, arch, ext) {
	const dot = ext.startsWith('.') ? ext : `.${ext}`
	return `${pkgName}-${version}-${platform}-${arch}${dot}`
}

const INSTALL_HINTS = {
	'macos-arm64': 'macOS Apple Silicon (arm64)：双击 .pkg；未签名时可能需右键 → 打开。',
	'macos-x64': 'macOS Intel (x64)：双击 .pkg；未签名时可能需右键 → 打开。',
	'linux-arm64': 'Linux arm64：sudo dpkg -i *.deb 后重启 WPS。',
	'linux-x64': 'Linux x64 (amd64)：sudo dpkg -i *.deb 后重启 WPS。',
	'windows-arm64': 'Windows ARM64：双击 .exe 自解压到本机 WPS jsaddons。',
	'windows-x64': 'Windows x64：双击 .exe 自解压到本机 WPS jsaddons。',
}

export function installHint(platform, arch) {
	const key = `${platform}-${arch}`
	return INSTALL_HINTS[key] || `${platform} ${arch}：按对应平台说明安装。`
}
