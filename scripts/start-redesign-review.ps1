[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$stateRoot = Join-Path $repoRoot ".redesign-review"
$stateFile = Join-Path $stateRoot "processes.json"
$firebaseLog = Join-Path $stateRoot "firebase.log"
$firebaseErrorLog = Join-Path $stateRoot "firebase-error.log"
$appLog = Join-Path $stateRoot "app.log"
$appErrorLog = Join-Path $stateRoot "app-error.log"

function Test-Port([int]$Port) {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync("127.0.0.1", $Port)
    if (-not $task.Wait(350)) { return $false }
    return $client.Connected
  } catch { return $false } finally { $client.Dispose() }
}

function Wait-Port([int]$Port, [int]$TimeoutSeconds = 120) {
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (Test-Port $Port) { return }
    Start-Sleep -Milliseconds 350
  }
  throw "Timed out waiting for local port $Port."
}

function Stop-ReviewTree([int]$ProcessId) {
  if ($ProcessId -le 0) { return }
  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if (-not $process) { return }
  & taskkill.exe /PID $ProcessId /T /F | Out-Null
}

if ((Resolve-Path $repoRoot).Path -ne (Get-Location).Path) {
  Set-Location $repoRoot
}

foreach ($port in @(3304, 9099, 8080)) {
  if (Test-Port $port) {
    throw "Port $port is already in use. Run .\scripts\stop-redesign-review.ps1 if it belongs to an earlier review session."
  }
}

$javaVersion = (& cmd.exe /c "java -version 2>&1" | Select-Object -First 1)
if (-not $javaVersion) { throw "Java is required for the Firestore emulator." }
if (-not (Test-Path $stateRoot)) { New-Item -ItemType Directory -Path $stateRoot | Out-Null }

$env:FIREBASE_PROJECT_ID = "demo-fuelphysique"
$env:GCLOUD_PROJECT = "demo-fuelphysique"
$env:FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
$env:FUELPHYSIQUE_LOCAL_DEMO = "1"
$env:PORT = "3304"

$firebase = $null
$app = $null
try {
  $firebaseArgs = @(
    "/c", "npx", "--yes", "firebase-tools@13.35.1", "emulators:start",
    "--config", "firebase.local.json", "--project", "demo-fuelphysique",
    "--only", "auth,firestore"
  )
  $firebase = Start-Process -FilePath "cmd.exe" -ArgumentList $firebaseArgs -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput $firebaseLog -RedirectStandardError $firebaseErrorLog -PassThru
  Wait-Port 9099
  Wait-Port 8080

  & node (Join-Path $PSScriptRoot "seed-redesign-review.js")
  if ($LASTEXITCODE -ne 0) { throw "Local review seed failed with exit code $LASTEXITCODE." }

  $app = Start-Process -FilePath (Get-Command node).Source -ArgumentList "server.js" -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput $appLog -RedirectStandardError $appErrorLog -PassThru
  Wait-Port 3304 45

  @{
    repo = $repoRoot
    project = "demo-fuelphysique"
    startedAt = [DateTime]::UtcNow.ToString("o")
    firebasePid = $firebase.Id
    appPid = $app.Id
  } | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8

  & node (Join-Path $PSScriptRoot "verify-redesign-review.js")
  if ($LASTEXITCODE -ne 0) { throw "Local review verification failed with exit code $LASTEXITCODE." }
} catch {
  if ($app) { Stop-ReviewTree $app.Id }
  if ($firebase) { Stop-ReviewTree $firebase.Id }
  throw
}

Write-Host ""
Write-Host "FuelPhysique Ultramarine review is running:" -ForegroundColor Green
Write-Host "  App:       http://127.0.0.1:3304"
Write-Host "  Auth:      127.0.0.1:9099"
Write-Host "  Firestore: 127.0.0.1:8080"
Write-Host "  User A:    review-athlete-a@example.test / FuelReview-2026-A!"
Write-Host "  User B:    review-athlete-b@example.test / FuelReview-2026-B!"
Write-Host "  Stop:      .\scripts\stop-redesign-review.ps1"
