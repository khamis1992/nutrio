$ErrorActionPreference = "Stop"

$postgresBin = "C:\Program Files\PostgreSQL\18\bin"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$migration = Join-Path $repoRoot "supabase\migrations\20260717110000_secure_signup_provisioning.sql"
$attestationMigration = Join-Path $repoRoot "supabase\migrations\20260717120000_signup_security_attestation.sql"
$prelude = Join-Path $PSScriptRoot "sql\signup-provisioning-prelude.sql"
$assertions = Join-Path $PSScriptRoot "sql\signup-provisioning-assertions.sql"
$tempBase = [System.IO.Path]::GetFullPath("C:\tmp")
$testRoot = [System.IO.Path]::GetFullPath(
  (Join-Path $tempBase ("nutrio-provisioning-pg-" + $PID))
)
$dataDir = Join-Path $testRoot "data"
$logFile = Join-Path $testRoot "postgres.log"
$errorLogFile = Join-Path $testRoot "postgres-error.log"
$port = Get-Random -Minimum 56000 -Maximum 59000
$started = $false
$serverProcess = $null

if (-not $testRoot.StartsWith($tempBase + [System.IO.Path]::DirectorySeparatorChar)) {
  throw "Refusing to create a PostgreSQL test cluster outside C:\tmp"
}

foreach ($path in @($migration, $attestationMigration, $prelude, $assertions)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Required integration-test file is missing: $path"
  }
}

New-Item -ItemType Directory -Path $testRoot | Out-Null

try {
  & (Join-Path $postgresBin "initdb.exe") `
    -D $dataDir `
    -U postgres `
    -A trust `
    --no-locale | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "initdb failed" }

  $serverProcess = Start-Process `
    -FilePath (Join-Path $postgresBin "postgres.exe") `
    -ArgumentList @("-D", $dataDir, "-p", $port, "-h", "127.0.0.1") `
    -RedirectStandardOutput $logFile `
    -RedirectStandardError $errorLogFile `
    -WindowStyle Hidden `
    -PassThru

  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    & (Join-Path $postgresBin "pg_isready.exe") `
      -h 127.0.0.1 `
      -p $port `
      -U postgres | Out-Null
    if ($LASTEXITCODE -eq 0) {
      $started = $true
      break
    }
    if ($serverProcess.HasExited) {
      throw "PostgreSQL exited before becoming ready"
    }
    Start-Sleep -Milliseconds 250
  }
  if (-not $started) { throw "PostgreSQL did not become ready" }

  foreach ($sqlFile in @($prelude, $migration, $attestationMigration, $assertions)) {
    & (Join-Path $postgresBin "psql.exe") `
      -h 127.0.0.1 `
      -p $port `
      -U postgres `
      -d postgres `
      -v ON_ERROR_STOP=1 `
      -f $sqlFile | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "psql failed for $sqlFile" }
  }
}
finally {
  if (Test-Path -LiteralPath (Join-Path $dataDir "postmaster.pid")) {
    & (Join-Path $postgresBin "pg_ctl.exe") -D $dataDir -m fast -w stop | Out-Host
  } elseif ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
  }

  $resolvedRoot = [System.IO.Path]::GetFullPath($testRoot)
  if ($resolvedRoot.StartsWith($tempBase + [System.IO.Path]::DirectorySeparatorChar)) {
    Remove-Item -LiteralPath $resolvedRoot -Recurse -Force
  }
}
