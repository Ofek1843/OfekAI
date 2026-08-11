[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$stateFile = Join-Path $repoRoot ".redesign-review\processes.json"

if (-not (Test-Path -LiteralPath $stateFile)) {
  Write-Host "No recorded Ultramarine review processes are running."
  exit 0
}

$state = Get-Content -Raw -LiteralPath $stateFile | ConvertFrom-Json
if ((Resolve-Path $state.repo).Path -ne (Resolve-Path $repoRoot).Path -or $state.project -ne "demo-fuelphysique") {
  throw "The process record does not belong to this isolated review environment. Nothing was stopped."
}

foreach ($processId in @([int]$state.appPid, [int]$state.firebasePid)) {
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if (-not $process) { continue }
  & taskkill.exe /PID $processId /T /F | Out-Null
}

Remove-Item -LiteralPath $stateFile -Force
Write-Host "FuelPhysique app and Firebase review emulators stopped safely."

