/**
 * Ensure a Win7-compatible portable Node runtime at mcp-sidecar/nodejs/.
 *
 * The bun-compiled sidecar binary does not run on Win7/8; the installer bundles
 * a Node 16 x64 portable runtime so the MCP sidecar starts out-of-the-box in
 * offline (intranet) Windows environments with zero user-installed
 * prerequisites. Downloaded once at build time (npmmirror first, nodejs.org
 * fallback), cached in mcp-sidecar/.node-runtime/ (gitignored) and extracted
 * to mcp-sidecar/nodejs/ which the packager ships inside the addon payload.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const _7zBin = require('7zip-bin')

const NODE_VERSION = 'v16.20.2'
const ZIP_NAME = `node-${NODE_VERSION}-win-x64.zip`
const ZIP_MIN_BYTES = 20 * 1024 * 1024
const URLS = [
	`https://registry.npmmirror.com/-/binary/node/${NODE_VERSION}/${ZIP_NAME}`,
	`https://nodejs.org/dist/${NODE_VERSION}/${ZIP_NAME}`,
]

export function winNodeRuntimeDir(root) {
	return path.join(root, 'mcp-sidecar', 'nodejs')
}

export function ensureWinNodeRuntime(root) {
	const dir = winNodeRuntimeDir(root)
	if (fs.existsSync(path.join(dir, 'node.exe'))) return dir
	const cache = path.join(root, 'mcp-sidecar', '.node-runtime')
	fs.mkdirSync(cache, { recursive: true })
	const zip = path.join(cache, ZIP_NAME)
	if (!fs.existsSync(zip) || fs.statSync(zip).size < ZIP_MIN_BYTES) {
		let downloaded = false
		for (const url of URLS) {
			try {
				console.log(`[node-runtime] downloading ${url}`)
				execFileSync('curl', ['-fSL', '--max-time', '600', '-o', zip, url], { stdio: 'inherit' })
				downloaded = fs.existsSync(zip) && fs.statSync(zip).size >= ZIP_MIN_BYTES
				if (downloaded) break
			} catch (e) {
				console.warn(`[node-runtime] download failed from ${url}: ${e.message}`)
			}
		}
		if (!downloaded) throw new Error(`portable node runtime unavailable (${ZIP_NAME})`)
	}
	const extracted = path.join(cache, 'extracted')
	fs.rmSync(extracted, { recursive: true, force: true })
	fs.mkdirSync(extracted, { recursive: true })
	execFileSync(_7zBin.path7za, ['x', zip, `-o${extracted}`, '-y'], { stdio: 'ignore' })
	const inner = path.join(extracted, `node-${NODE_VERSION}-win-x64`)
	if (!fs.existsSync(path.join(inner, 'node.exe'))) {
		throw new Error('unexpected node zip layout (node.exe missing)')
	}
	fs.rmSync(dir, { recursive: true, force: true })
	fs.renameSync(inner, dir)
	fs.rmSync(extracted, { recursive: true, force: true })
	return dir
}
