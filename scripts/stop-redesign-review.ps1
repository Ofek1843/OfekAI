[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$stateRoot = Join-Path $repoRoot ".redesign-review"
$stateFile = Join-Path $stateRoot "processes.json"

function Get-RecordedCommandLine([int]$ProcessId) {
  $record = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
  return [string]$record.CommandLine
}

if (-not (Test-Path -LiteralPath $stateFile)) {
  Write-Host "No recorded Ultramarine review processes are running."
  exit 0
}

$state = Get-Content -Raw -LiteralPath $stateFile | ConvertFrom-Json
if ((Resolve-Path $state.repo).Path -ne (Resolve-Path $repoRoot).Path -or $state.project -ne "demo-fuelphysique") {
  throw "The process record does not belong to this isolated review environment. Nothing was stopped."
}

foreach ($entry in @(
  @{ Id = [int]$state.appPid; Kind = "app" },
  @{ Id = [int]$state.firebasePid; Kind = "firebase" }
)) {
  $processId = $entry.Id
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if (-not $process) { continue }
  $commandLine = Get-RecordedCommandLine $processId
  $expected = if ($entry.Kind -eq "app") {
    $commandLine -match "server\.js" -and $commandLine -match [regex]::Escape($repoRoot)
  } else {
    $commandLine -match "firebase\.js" -and $commandLine -match "emulators:start" -and $commandLine -match "demo-fuelphysique"
  }
  if (-not $expected) {
    throw "Recorded PID $processId no longer matches the isolated $($entry.Kind) review process. Nothing was stopped."
  }
  & taskkill.exe /PID $processId /T /F | Out-Null
}

Remove-Item -LiteralPath $stateFile -Force
$voiceRoot = if ($state.voiceRoot) { [string]$state.voiceRoot } else { Join-Path $stateRoot "voice" }
$resolvedStateRoot = [System.IO.Path]::GetFullPath($stateRoot).TrimEnd('\')
$resolvedVoiceRoot = [System.IO.Path]::GetFullPath($voiceRoot).TrimEnd('\')
if ($resolvedVoiceRoot -ne (Join-Path $resolvedStateRoot "voice")) {
  throw "The recorded voice directory is outside the isolated review state. It was not removed."
}
if (Test-Path -LiteralPath $resolvedVoiceRoot) {
  Remove-Item -LiteralPath $resolvedVoiceRoot -Recurse -Force
}
Write-Host "FuelPhysique app, Firebase review emulators and isolated local voice assets stopped safely."
