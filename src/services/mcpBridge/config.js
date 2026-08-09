/** MCP Bridge shared config (WPS addon side). */

export const MCP_PROTOCOL_VERSION = 1
export const MCP_DEFAULT_PORT = 62588
export const MCP_BASE_URL = `http://127.0.0.1:${MCP_DEFAULT_PORT}`
export const MCP_HEALTHZ_URL = `${MCP_BASE_URL}/healthz`
export const MCP_URL = `${MCP_BASE_URL}/mcp`

export const PLUGIN_STORAGE_TOKEN_KEY = 'chayuan_mcp_token'
export const PLUGIN_STORAGE_AGENT_ID_KEY = 'chayuan_mcp_agent_id'

export function getAddonVersion() {
  try {
    // vite-injected or package — fall back
    return String(import.meta.env?.VITE_APP_VERSION || '3.0.12')
  } catch {
    return '3.0.12'
  }
}
