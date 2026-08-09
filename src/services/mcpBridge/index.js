export { gateCapability } from './licenseGate.js'
export { dispatchMcpJob } from './dispatch.js'
export {
  startMcpAgent,
  stopMcpAgent,
  isMcpAgentRunning,
  probeSidecar,
  syncTokenFromSidecar,
  getMcpBridgeStatus,
  getStoredToken,
  setStoredToken
} from './agentClient.js'
export {
  startSidecarBestEffort,
  stopSidecarHint,
  getManualStartCommand
} from './sidecarLauncher.js'
export {
  runMcpSpikes,
  getLastSpikeResults,
  getAgentAliveProbe,
  resetAgentAliveProbe,
  spikeWebSocket,
  spikeShellExecute
} from './spikes.js'
export {
  MCP_BASE_URL,
  MCP_URL,
  MCP_HEALTHZ_URL,
  MCP_DEFAULT_PORT,
  MCP_PROTOCOL_VERSION
} from './config.js'
export {
  CHAYUAN_SERVER_ID,
  MCP_ENABLED_STORAGE_KEY,
  MCP_SERVERS_STORAGE_KEY,
  getBuiltinChayuanServer,
  getEnabledMcpServers,
  loadMcpEnabled,
  loadMcpServersWithBuiltinFlag,
  removeMcpServer,
  saveMcpEnabled,
  setMcpServerEnabled,
  upsertMcpServer
} from './mcpServerRegistry.js'
export {
  healthz as mcpHealthz,
  probeMcpHealthBundle,
  probeUpstream,
  syncUpstreamAllowlist
} from './mcpHttpClient.js'
export {
  applyProofreadComments,
  applyProofreadTextFixes,
  runMcpChatOrchestrator
} from './mcpChatOrchestrator.js'
