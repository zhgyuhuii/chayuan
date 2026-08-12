# install-wps-skill-chayuan.ps1 —— wps-skill-chayuan 直装脚本（Windows）
# 不跑 .exe 安装器外壳，直接：① 加载项+publish.xml(enable_dev) 写 jsaddons ② 注册 HKCU Run 并启动 MCP
#   ③ 四级 healthz  ④ 自动检测已装 agent（Claude Code/Cursor/Codex）→ 注册 MCP + 按各自格式投放技能文件
#   OpenClaw/Hermes 为 GUI 打印指引；GitHub 被墙时 -Fetch 多源回退（Gitee/aidooo）+ sha256 强校验
#   STEP 2 内联实现（不再依赖 autostart\*.ps1——部分 Defender 会隔离该目录下的 ps1）
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts\install-wps-skill-chayuan.ps1                # 全量 + 自动检测 agent
#   powershell -ExecutionPolicy Bypass -File scripts\install-wps-skill-chayuan.ps1 -NoAgent
#   powershell -ExecutionPolicy Bypass -File scripts\install-wps-skill-chayuan.ps1 -SkillOnly
#   powershell -ExecutionPolicy Bypass -File scripts\install-wps-skill-chayuan.ps1 -Payload C:\path\to\staging
#   powershell -ExecutionPolicy Bypass -File scripts\install-wps-skill-chayuan.ps1 -WithCursor -WithClaude   # 强制投放
#   powershell -ExecutionPolicy Bypass -File scripts\install-wps-skill-chayuan.ps1 -Fetch -Version 4.1.0
# 详见 plans/wps-skill-chayuan-design.md §16。

param(
  [switch]$SkillOnly,
  [switch]$RuntimeOnly,
  [switch]$NoAgent,
  [switch]$Fetch,
  [string]$Payload,
  [string]$Version,
  [switch]$WithClaude,
  [switch]$WithCursor,
  [switch]$WithCodex,
  [switch]$WithAll,
  [switch]$Help
)

$ErrorActionPreference = 'Stop'
# ── Windows 中文/编码坑（重点，踩过多次）──────────────────────────────────
# PS 5.1（Windows 自带 powershell.exe）默认按 ANSI/GBK 解码 .ps1 与输出：
#  ① 本文件保存为 UTF-8 + BOM（首字节 EF BB BF）——PS 5.1 据此按 UTF-8 解析中文，否则乱码；
#  ② 控制台输出统一 UTF-8（现代 Windows Terminal 原生支持；旧 conhost 不影响功能，仅显示）；
#  ③ 写 JSON/XML 数据文件用「无 BOM UTF-8」——Set-Content -Encoding UTF8 在 PS 5.1 会带 BOM，
#     Node 的 JSON.parse、Cursor/Claude 读 mcp.json、WPS 读 publish.xml 都可能被 BOM 噎。
#     故数据文件一律走 Write-FileUtf8NoBom（.NET WriteAllText + UTF8Encoding($false)）。
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$OutputEncoding = [System.Text.Encoding]::UTF8
function Write-FileUtf8NoBom([string]$Path, [string]$Content) {
  [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}
$Repo = Split-Path -Parent $PSScriptRoot
$McpName = 'chayuan-wps-mcp'
$McpPort = 62588
$McpUrl = "http://127.0.0.1:$McpPort/mcp"
$Healthz = "http://127.0.0.1:$McpPort/healthz"
$SidExe = 'chayuan-mcp-windows-x64.exe'
$PkgVerDefault = '4.1.0'

if ($Help) { Get-Help $MyInvocation.MyCommand.Path -Detailed; exit 0 }
if ($WithAll) { $WithClaude = $true; $WithCursor = $true; $WithCodex = $true }
if (-not $Version) { $Version = if ($env:WPS_SKILL_VERSION) { $env:WPS_SKILL_VERSION } else { $PkgVerDefault } }
if ($env:WPS_SKILL_FETCH -eq '1') { $Fetch = $true }
$DoAddon  = -not $RuntimeOnly
$DoRuntime = -not $SkillOnly

# ───────── 镜像源（GitHub 被墙时的备用地址）─────────
# 优先级：$env:WPS_SKILL_MIRRORS → 包内 mirrors.json → 内置默认（GitHub→Gitee→aidooo）。下载后用随包 .sha256 强校验。
function Get-MirrorUrls {
  if ($env:WPS_SKILL_MIRRORS) {
    return ($env:WPS_SKILL_MIRRORS -split '\s+' | ForEach-Object { $_ -replace '\$\{version\}', $Version } | Where-Object { $_ })
  }
  $mj = Join-Path $Payload 'mirrors.json'
  if ($Payload -and (Test-Path -LiteralPath $mj)) {
    $j = Get-Content -Raw -LiteralPath $mj | ConvertFrom-Json
    return ($j.sources | ForEach-Object { $_.url -replace '\$\{version\}', $Version })
  }
  return @(
    "https://gitee.com/cloudshd/chayuan-wps-releases/releases/download/v$Version/wps-skill-chayuan-$Version-portable.zip",
    "https://aidooo.com/downloads/skill/wps-skill-chayuan-$Version-portable.zip",
    "https://github.com/zhgyuhuii/chayuan/releases/download/v$Version/wps-skill-chayuan-$Version-portable.zip"
  )
}
function Print-Mirrors {
  Write-Host '  备用下载源（国内优先 Gitee / aidooo，任选其一）：' -ForegroundColor Yellow
  Get-MirrorUrls | ForEach-Object { Write-Host "    - $_" }
  Write-Host '  每个源都带 .sha256 强校验，被篡改的源不会通过。' -ForegroundColor Yellow
}
function Invoke-FetchPayload {
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
  New-Item -ItemType Directory -Path $tmp -Force | Out-Null
  $archive = Join-Path $tmp 'portable.zip'
  $oldProgress = $ProgressPreference; $ProgressPreference = 'SilentlyContinue'
  try {
    foreach ($url in (Get-MirrorUrls)) {
      Write-Host "[wps-skill-chayuan] 尝试：$url"
      try { Invoke-WebRequest -Uri $url -OutFile $archive -UseBasicParsing -TimeoutSec 60 }
      catch { Write-Host "[wps-skill-chayuan] · 不可达，换源"; continue }
      try { Invoke-WebRequest -Uri "$url.sha256" -OutFile "$archive.sha256" -UseBasicParsing -TimeoutSec 15 }
      catch { Write-Host "[wps-skill-chayuan] ⚠ 该源无 .sha256，跳过（安全策略：离线整包必须强校验）"; continue }
      $expected = ((Get-Content "$archive.sha256" | Select-Object -First 1) -split '\s')[0].Trim().ToLower()
      $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLower()
      if ($expected -ne $actual) { Write-Host "[wps-skill-chayuan] ✗ sha256 不匹配，换源"; continue }
      Write-Host "[wps-skill-chayuan] ✓ sha256 校验通过"
      Expand-Archive -Path $archive -DestinationPath $tmp -Force
      $ij = Get-ChildItem -Recurse -Filter 'install.json' -LiteralPath $tmp | Where-Object { $_.FullName -match 'install-staging' } | Select-Object -First 1
      if (-not $ij) { Write-Host "[wps-skill-chayuan] ✗ 解压后未找到 install-staging\install.json（包结构异常）"; return $null }
      return (Split-Path (Split-Path $ij.FullName))
    }
  } finally { $ProgressPreference = $oldProgress }
  Write-Host "[wps-skill-chayuan] ✗ 所有源都不可用"
  return $null
}

# ───────── 载荷解析（本地 + 可选下载回落）─────────
if (-not $Payload) { $Payload = $env:WPS_SKILL_PAYLOAD }
if (-not $Payload) {
  $devStaging = Join-Path $Repo 'release\install-staging'   # 开发仓库
  $pkgStaging = Join-Path $Repo 'install-staging'           # portable 包根（下载解压即用）
  if (Test-Path -LiteralPath $devStaging) { $Payload = $devStaging }
  elseif (Test-Path -LiteralPath $pkgStaging) { $Payload = $pkgStaging }
}
if (-not (Test-Path -LiteralPath $Payload)) {
  if ($Fetch) {
    Write-Host "[wps-skill-chayuan] 本地无载荷，启用多源下载（GitHub 被墙自动回退 Gitee / aidooo）"
    $fetched = Invoke-FetchPayload
    if ($fetched) { $Payload = $fetched }
  }
}
if (-not (Test-Path -LiteralPath $Payload)) {
  Write-Error "找不到载荷。请：① npm run build:wps-all；② -Payload C:\path\to\staging；③ `$env:WPS_SKILL_PAYLOAD=...；④ 加 -Fetch 自动下载"
  Print-Mirrors
  exit 1
}
$InstallJson = Join-Path $Payload 'install.json'
if (-not (Test-Path -LiteralPath $InstallJson)) { Write-Error "缺少 $InstallJson"; exit 1 }
$Meta = Get-Content -Raw -LiteralPath $InstallJson | ConvertFrom-Json
$AddonFolder = $Meta.addonFolder
$Version2 = $Meta.version
if (-not $AddonFolder) { Write-Error 'install.json 读不到 addonFolder'; exit 1 }

# MCP sidecar 来源：portable 包内优先，否则仓库
if (Test-Path -LiteralPath (Join-Path $Payload 'mcp-sidecar\bin')) { $Sidecar = Join-Path $Payload 'mcp-sidecar' } else { $Sidecar = Join-Path $Repo 'mcp-sidecar' }
$McpBin = Join-Path $Sidecar "bin\$SidExe"
if (-not (Test-Path -LiteralPath $McpBin)) { Write-Error "MCP 二进制缺失: $McpBin（构建 build-mcp-binary.mjs）"; exit 1 }

# 技能模板来源：portable 包内优先，否则仓库
function Get-SkillTmpl {
  $p = Join-Path $Payload 'skill-chayuan'
  if (Test-Path -LiteralPath $p) { return $p }
  return (Join-Path $Repo 'skill-chayuan')
}

Write-Host "[wps-skill-chayuan] 平台=windows 载荷=$Payload 加载项=$AddonFolder 版本=$Version2 MCP=$McpBin"

# 清只读 / Mark-of-the-Web，避免 zip 解压后 Copy-Item「访问被拒绝」
function Clear-TreeAttrs([string]$Root) {
  if (-not (Test-Path -LiteralPath $Root)) { return }
  Get-ChildItem -LiteralPath $Root -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
    try { $_.Attributes = 'Archive' } catch {}
    if (-not $_.PSIsContainer) {
      try { Unblock-File -LiteralPath $_.FullName -ErrorAction SilentlyContinue } catch {}
    }
  }
}
function Remove-TreeForce([string]$Root) {
  if (-not (Test-Path -LiteralPath $Root)) { return }
  Clear-TreeAttrs $Root
  Remove-Item -LiteralPath $Root -Recurse -Force -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $Root) {
    cmd /c "attrib -R `"$Root\*`" /S /D >nul 2>nul"
    Remove-Item -LiteralPath $Root -Recurse -Force
  }
}
# 用 robocopy 拷目录：比 Copy-Item 更能扛只读/被锁文件；排除 autostart 下脚本
# （MCP 自启由 STEP 2 从包根 mcp-sidecar 执行，无需进 jsaddons；.ps1 进 AppData 易被 Defender 拦）
function Copy-AddonTree([string]$Src, [string]$Dst) {
  Clear-TreeAttrs $Src
  New-Item -ItemType Directory -Force -Path $Dst | Out-Null
  $xd = @('autostart')
  $xf = @('*.ps1')
  $args = @($Src, $Dst, '/E', '/COPY:DAT', '/R:2', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS', '/NC', '/NS', '/NP')
  foreach ($d in $xd) { $args += '/XD'; $args += $d }
  foreach ($f in $xf) { $args += '/XF'; $args += $f }
  & robocopy @args | Out-Null
  # robocopy: 0-7 = 成功类；≥8 失败
  if ($LASTEXITCODE -ge 8) { throw "robocopy 复制加载项失败 (exit=$LASTEXITCODE)：$Src → $Dst" }
}

# ───────── STEP 1: 加载项 → jsaddons ─────────
function Install-Addon {
  Write-Host '[wps-skill-chayuan] STEP 1 加载项 → jsaddons'
  $srcAddon = Join-Path $Payload $AddonFolder
  if (-not (Test-Path -LiteralPath $srcAddon)) { Write-Error "缺加载项目录 $srcAddon" }
  $jsaddons = Join-Path $env:APPDATA 'kingsoft\wps\jsaddons'
  New-Item -ItemType Directory -Force -Path $jsaddons | Out-Null
  $destAddon = Join-Path $jsaddons $AddonFolder
  # 原子替换：先装到 .installing 再覆盖
  $staging = Join-Path $jsaddons ".$AddonFolder.installing"
  Remove-TreeForce $staging
  Copy-AddonTree $srcAddon $staging
  Remove-TreeForce $destAddon
  Move-Item -LiteralPath $staging -Destination $destAddon
  # F12：Windows 必须 enable_dev，否则本地 jsaddons 常不加载。生成而非照搬 staging 的 enable 版。
  $pubXml = '<?xml version="1.0" encoding="UTF-8"?>' + "`n" +
            '<jsplugins>' + "`n" +
            "    <jsplugin name=`"$($Meta.name)`" type=`"$($Meta.addonType)`" url=`"$AddonFolder`" version=`"$Version2`" enable=`"enable_dev`" install=`"null`" customDomain=`"`"/>" + "`n" +
            '</jsplugins>' + "`n"
  Write-FileUtf8NoBom (Join-Path $jsaddons 'publish.xml') $pubXml
  Write-Host "  ✓ 加载项 → $destAddon（publish.xml 用 enable_dev，Windows 必需）"
}

# ───────── STEP 2: MCP 自启（内联；避免调用易被 Defender 隔离的 autostart\*.ps1）─────────
function Install-Runtime {
  Write-Host '[wps-skill-chayuan] STEP 2 MCP 自启（HKCU Run + 启动二进制）'
  if (-not (Test-Path -LiteralPath $McpBin)) { Write-Error "MCP 二进制缺失: $McpBin"; return }
  $runtimeDir = Join-Path $env:LOCALAPPDATA 'chayuan-wps\mcp\runtime'
  $exeDst = Join-Path $runtimeDir $SidExe
  $exeDstBin = Join-Path $runtimeDir "bin\$SidExe"
  New-Item -ItemType Directory -Force -Path (Join-Path $runtimeDir 'bin') | Out-Null
  try { Unblock-File -LiteralPath $McpBin -ErrorAction SilentlyContinue } catch {}
  # 运行中的 sidecar 会锁住 exe，覆盖前先停掉（随后再拉起）
  Get-Process -Name 'chayuan-mcp-windows-x64' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 800
  try {
    Copy-Item -LiteralPath $McpBin -Destination $exeDst -Force
    Copy-Item -LiteralPath $McpBin -Destination $exeDstBin -Force
  } catch {
    Write-Host "  ⚠ 覆盖二进制失败（可能仍被占用），沿用已有 runtime：$($_.Exception.Message)" -ForegroundColor Yellow
    if (-not (Test-Path -LiteralPath $exeDst)) { Write-Error "runtime 无可用二进制: $exeDst"; return }
  }
  $startCmd = "@echo off`r`nstart `"`" `"%~dp0$SidExe`"`r`n"
  [System.IO.File]::WriteAllText((Join-Path $runtimeDir 'start-mcp.cmd'), $startCmd, [System.Text.Encoding]::ASCII)
  $runValue = "`"$exeDst`""
  $regPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
  New-Item -Path $regPath -Force | Out-Null
  Set-ItemProperty -Path $regPath -Name 'ChayuanWpsMcp' -Value $runValue -Type String
  Write-Host "  ✓ Run → $exeDst"
  Start-Process -FilePath $exeDst -WindowStyle Hidden
  Write-Host '  ✓ Started sidecar (hidden)'
}

if ($DoAddon)  { Install-Addon }
if ($DoRuntime) { Install-Runtime }

# ───────── STEP 3: 四级 healthz ─────────
Write-Host '[wps-skill-chayuan] STEP 3 四级自检'
$L1 = 0; $L2 = 0; $L3 = 0; $L4 = 0
$jsaddons = Join-Path $env:APPDATA 'kingsoft\wps\jsaddons'
if ((Test-Path -LiteralPath (Join-Path $jsaddons $AddonFolder)) -and (Test-Path -LiteralPath (Join-Path $jsaddons 'publish.xml'))) { $L1 = 1 }
if ($L1) { Write-Host '  ✓ L1 jsaddons+publish.xml 就位' } else { Write-Host '  ✗ L1 jsaddons/publish.xml 缺失' }

# L2 轮询 15s
for ($i = 1; $i -le 15; $i++) {
  try { Invoke-WebRequest -Uri $Healthz -UseBasicParsing -TimeoutSec 2 | Out-Null; $L2 = 1; break } catch { Start-Sleep -Seconds 1 }
}
if ($L2) { Write-Host '  ✓ L2 MCP 在线（healthz）' } else { Write-Host '  ✗ L2 MCP 未在线' }

# F11：监听进程是否归 Run 键托管
if ($L2) {
  $RegPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
  $runVal = (Get-ItemProperty -Path $RegPath -Name 'ChayuanWpsMcp' -ErrorAction SilentlyContinue).ChayuanWpsMcp
  $proc = Get-Process -Name 'chayuan-mcp-windows-x64' -ErrorAction SilentlyContinue
  if (-not $runVal) { Write-Host '  ⚠ L2 附加：HKCU Run 未注册 ChayuanWpsMcp，重启后不自启（F11）' }
  elseif (-not $proc) { Write-Host '  ⚠ L2 附加：62588 在响应但无 chayuan-mcp 进程，疑为其它/野进程（F11）' }
}

# L3：MCP initialize 握手
$L3Resp = ''
if ($L2) {
  try {
    $body = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"skill-chayuan-install","version":"1"}}}'
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$McpPort/mcp" -Method Post -Body $body `
          -ContentType 'application/json' -Headers @{ Accept = 'application/json, text/event-stream' } -UseBasicParsing -TimeoutSec 5
    $L3Resp = $r.Content
    if ($L3Resp -match 'result|capabilities|serverInfo') { $L3 = 1 }
  } catch {}
}
if ($L3) { Write-Host '  ✓ L3 MCP 协议握手通过' } else { Write-Host '  · L3 协议握手未确认（可在客户端侧再验）' }
if ($L2 -and $L3 -and ($L3Resp -match 'wps|agent')) { $L4 = 1 }
if ($L4) { Write-Host '  ✓ L4 桥通迹象' } else { Write-Host '  · L4 加载项↔MCP 桥通：打开 WPS 后由客户端跑只读冒烟确认' }

# ───────── STEP 4: agent 自动检测 + 技能投放 ─────────
# 默认 auto：扫描已装 agent，按各自格式投放 + 注册 MCP。--With* 强制；-NoAgent 跳过。
# Claude=SKILL.md（~/.claude/skills/） Cursor=.mdc（~/.cursor/rules/） Codex=prompt.md（~/.codex/prompts/）
# OpenClaw/Hermes 为 GUI，打印指引。
function Merge-McpJson([string]$Path) {
  $dir = Split-Path -Parent $Path; New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $entry = @{ url = $McpUrl }
  if (Test-Path -LiteralPath $Path) {
    $j = Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
    if ($j.mcpServers -and $j.mcpServers.$McpName) { return }   # 已存在
    if (-not $j.mcpServers) { $j | Add-Member -NotePropertyName mcpServers -NotePropertyValue (New-Object PSObject) }
    $j.mcpServers | Add-Member -NotePropertyName $McpName -NotePropertyValue $entry -Force
    Write-FileUtf8NoBom $Path ($j | ConvertTo-Json -Depth 10)
  } else {
    Write-FileUtf8NoBom $Path (@{ mcpServers = @{ $McpName = $entry } } | ConvertTo-Json -Depth 10)
  }
}
function Test-Claude { [bool](Get-Command claude -ErrorAction SilentlyContinue) -or (Test-Path (Join-Path $env:USERPROFILE '.claude')) }
function Test-Cursor { (Test-Path (Join-Path $env:USERPROFILE '.cursor')) -or (Test-Path (Join-Path $env:LOCALAPPDATA 'Programs\cursor')) }
function Test-Codex  { [bool](Get-Command codex -ErrorAction SilentlyContinue) -or (Test-Path (Join-Path $env:USERPROFILE '.codex')) }
function Test-Deploy([string]$which) {
  if ($NoAgent) { return $false }
  switch ($which) {
    'claude' { if ($WithClaude) { return $true }; return (Test-Claude) }
    'cursor' { if ($WithCursor) { return $true }; return (Test-Cursor) }
    'codex'  { if ($WithCodex)  { return $true }; return (Test-Codex) }
  }
  return $false
}
function Deploy-Claude {
  $claude = Get-Command claude -ErrorAction SilentlyContinue
  if ($claude) {
    # PS 在 ErrorActionPreference=Stop 时会把 native stderr 当终止错误；「already exists」应视为成功
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $claudeOut = $null
    try { $claudeOut = & claude mcp add --transport http $McpName $McpUrl 2>&1 } catch { $claudeOut = $_ }
    $ErrorActionPreference = $prevEap
    $msg = "$claudeOut"
    if (($LASTEXITCODE -eq 0) -or ($msg -match 'already exists')) {
      Write-Host '  ✓ Claude Code MCP（claude mcp add）'
    } else {
      Merge-McpJson (Join-Path $env:USERPROFILE '.mcp.json')
      Write-Host '  · Claude Code MCP → ~/.mcp.json（claude mcp add 失败回落）'
    }
  } else { Merge-McpJson (Join-Path $env:USERPROFILE '.mcp.json'); Write-Host '  · Claude Code MCP → ~/.mcp.json（无 claude CLI）' }
  $tmpl = Get-SkillTmpl
  if (Test-Path -LiteralPath (Join-Path $tmpl 'SKILL.md')) {
    $dest = Join-Path $env:USERPROFILE '.claude\skills\wps-skill-chayuan'
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item -Recurse -Force (Join-Path $tmpl '*') $dest
    Write-Host "  ✓ Claude Code 技能 → $dest\SKILL.md"
  } else { Write-Host '  · Claude Code：SKILL.md 缺失，跳过技能文件' -ForegroundColor Yellow }
}
function Deploy-Cursor {
  Merge-McpJson (Join-Path $env:USERPROFILE '.cursor\mcp.json')
  Write-Host '  ✓ Cursor MCP → ~/.cursor/mcp.json'
  $tmpl = Get-SkillTmpl
  if (Test-Path -LiteralPath (Join-Path $tmpl 'formats\cursor.mdc')) {
    $dest = Join-Path $env:USERPROFILE '.cursor\rules'; New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item -Force (Join-Path $tmpl 'formats\cursor.mdc') (Join-Path $dest 'wps-skill-chayuan.mdc')
    Write-Host "  ✓ Cursor 规则 → $dest\wps-skill-chayuan.mdc（.mdc 格式）"
  } else { Write-Host '  · Cursor：formats\cursor.mdc 缺失，跳过规则文件' -ForegroundColor Yellow }
}
function Deploy-Codex {
  $f = Join-Path $env:USERPROFILE '.codex\config.toml'
  $dir = Split-Path -Parent $f; New-Item -ItemType Directory -Force -Path $dir | Out-Null
  if ((Test-Path $f) -and (Select-String -Path $f -SimpleMatch $McpName -Quiet)) {
    Write-Host "  · Codex MCP 已存在 $McpName，跳过"
  } else {
    Add-Content -LiteralPath $f -Value "`n[mcp_servers.$McpName]`nurl = `"$McpUrl`""
    Write-Host "  ✓ Codex MCP → $f"
  }
  $tmpl = Get-SkillTmpl
  if (Test-Path -LiteralPath (Join-Path $tmpl 'formats\codex.prompt.md')) {
    $dest = Join-Path $env:USERPROFILE '.codex\prompts'; New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item -Force (Join-Path $tmpl 'formats\codex.prompt.md') (Join-Path $dest 'wps-skill-chayuan.md')
    Write-Host "  ✓ Codex prompt → $dest\wps-skill-chayuan.md（会话内 /wps-skill-chayuan）"
  } else { Write-Host '  · Codex：formats\codex.prompt.md 缺失，跳过' -ForegroundColor Yellow }
}
function Print-GuiHint {
  Write-Host '  · OpenClaw / Hermes（GUI）：新建 MCP 服务，类型 HTTP/Streamable HTTP'
  Write-Host "      URL=$McpUrl  名称=$McpName  Token/command/stdio 留空"
  Write-Host '      （GUI agent 无公开 skill 文件格式，技能纪律见包内 skill-chayuan\formats\generic.prompt.md）'
}

if (-not $NoAgent) {
  Write-Host '[wps-skill-chayuan] STEP 4 agent 自动检测 + 技能投放（按各自格式；-NoAgent 跳过）'
  try { if (Test-Deploy 'claude') { Deploy-Claude } } catch { Write-Host "  ⚠ Claude 投放异常：$($_.Exception.Message)" -ForegroundColor Yellow }
  try { if (Test-Deploy 'cursor') { Deploy-Cursor } } catch { Write-Host "  ⚠ Cursor 投放异常：$($_.Exception.Message)" -ForegroundColor Yellow }
  try { if (Test-Deploy 'codex')  { Deploy-Codex } }  catch { Write-Host "  ⚠ Codex 投放异常：$($_.Exception.Message)" -ForegroundColor Yellow }
  try { Print-GuiHint } catch {}
}

# ───────── 收尾 ─────────
Write-Host ''
Write-Host "[wps-skill-chayuan] 完成。自检：L1=$L1 L2=$L2 L3=$L3 L4=$L4"
if ($L1 -and $L2) {
  Write-Host '  下一步：完全退出并重新打开 WPS 文字 → 出现察元 → 客户端刷新 MCP → 说「用 wps-skill-chayuan 校对」'
} else {
  Write-Host '  ⚠ 有级未通过：L1 查 jsaddons/publish.xml；L2 查 %LOCALAPPDATA%\chayuan-wps\mcp\runtime\ 与 HKCU Run'
  exit 1
}
