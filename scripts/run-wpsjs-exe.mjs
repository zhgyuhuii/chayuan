#!/usr/bin/env node
/**
 * Windows only: wpsjs embeds 7-Zip SFX + copy.bat → %AppData%\Kingsoft\wps\jsaddons
 * Requires package.json "name" to be ASCII-only.
 */
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
if (process.platform !== 'win32') {
	console.error('build:wps-exe only runs on Windows (wpsjs --exe).')
	process.exit(1)
}
execSync('npx wpsjs build --exe', { cwd: root, stdio: 'inherit' })
