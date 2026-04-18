#!/usr/bin/env node
/**
 * Windows only: wpsjs embeds 7-Zip SFX + copy.bat → %AppData%\Kingsoft\wps\jsaddons
 * Requires package.json "name" to be ASCII-only.
 * 产物复制为 release/<package name>-<version>-windows-<arch>.exe（x64 / arm64）。
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { currentReleaseTriple, releaseArtifactFilename } from './lib/release-platform.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
if (process.platform !== 'win32') {
	console.error('build:wps-exe only runs on Windows (wpsjs --exe).')
	process.exit(1)
}

execSync('npx wpsjs build --exe', { cwd: root, stdio: 'inherit' })

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const version = String(pkg.version || '0.0.0')
const name = String(pkg.name || 'addon')
const { arch } = currentReleaseTriple()
const builtExe = path.join(root, 'wps-addon-build', `${name}.exe`)
if (!fs.existsSync(builtExe)) {
	console.error(`Expected wpsjs output missing: ${builtExe}`)
	process.exit(1)
}

const releaseDir = path.join(root, 'release')
fs.mkdirSync(releaseDir, { recursive: true })
const outExe = path.join(
	releaseDir,
	releaseArtifactFilename(name, version, 'windows', arch, '.exe'),
)
fs.copyFileSync(builtExe, outExe)
console.log(`Copied to ${path.relative(root, outExe)}`)

const relArtifact = path.relative(root, outExe).split(path.sep).join('/')
execSync('node', [path.join(root, 'scripts', 'write-release-manifest.mjs'), relArtifact], {
	cwd: root,
	stdio: 'inherit',
})
