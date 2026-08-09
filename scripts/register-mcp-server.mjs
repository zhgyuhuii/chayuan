#!/usr/bin/env node
/**
 * Write mcp-server.json into fixed data dir (discovery for settings / installers).
 */
import { writeMcpServerJson, findWpsExecutable } from '../mcp-sidecar/lib/platformBridge.mjs'
import { getDataDir, getPort, ensureDataDir } from '../mcp-sidecar/lib/config.mjs'

ensureDataDir()
const { file, config } = writeMcpServerJson(getDataDir(), getPort())
console.log('[register-mcp-server]', file)
console.log(JSON.stringify(config, null, 2))
if (!config.wpsExecutable) {
  console.warn('[register-mcp-server] wpsExecutable empty — set manually in mcp-server.json if launch needed')
} else {
  console.log('[register-mcp-server] wpsExecutable=', config.wpsExecutable)
  console.log('[register-mcp-server] resolve check=', findWpsExecutable(file))
}
