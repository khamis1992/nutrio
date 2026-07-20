$ErrorActionPreference = 'Stop'

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$tempBase = [IO.Path]::GetFullPath($env:TEMP).TrimEnd([IO.Path]::DirectorySeparatorChar)
$expectedPrefix = $tempBase + [IO.Path]::DirectorySeparatorChar
$authoritativeBaselineCutoff = 20260720184000L
$migrationSource = Join-Path $repoRoot 'supabase\migrations'
$testSource = Join-Path $repoRoot 'supabase\tests'
$baselineBootstrap = Join-Path $repoRoot 'supabase\baseline\phase-one-bootstrap.sql'
$baselineSchema = Join-Path $repoRoot 'supabase\baseline\phase-one-schema.sql'
$migrationRegistryPath = Join-Path $repoRoot 'docs\architecture\phase-one-migration-registry.md'
$competitiveGapTests = @(
  "supabase/tests/nutrio-verified-view-security.sql",
  'family-profiles-and-safeguards.sql',
  'corporate-benefits-foundation.sql',
  'subscription-schedule-operations.sql'
)

function Assert-TemporaryPath([string]$Path) {
  $resolved = [IO.Path]::GetFullPath($Path)
  if (-not $resolved.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to use a database gate path outside the temporary directory: $resolved"
  }
  return $resolved
}

function Invoke-Supabase([string[]]$Arguments, [string]$FailureMessage) {
  & npx.cmd --yes supabase @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FailureMessage (exit code $LASTEXITCODE)."
  }
}

function Get-MigrationTimestamp([IO.FileInfo]$File) {
  if ($File.BaseName -notmatch '^(\d{14})') { return $null }
  return [int64]$Matches[1]
}

function Copy-AuthoritativeBaseline([string]$Destination) {
  if (-not (Test-Path -LiteralPath $baselineBootstrap) -or -not (Test-Path -LiteralPath $baselineSchema)) {
    throw 'The authoritative supabase/baseline bootstrap and schema files are required.'
  }
  Copy-Item -LiteralPath $baselineBootstrap -Destination (Join-Path $Destination '20260720184998_phase_one_baseline_bootstrap.sql')
  Copy-Item -LiteralPath $baselineSchema -Destination (Join-Path $Destination '20260720184999_phase_one_authoritative_schema.sql')
}

function Copy-PhaseOneClosureMigrations([string]$Destination) {
  $registry = [IO.File]::ReadAllText($migrationRegistryPath)
  $registeredTimestamps = [regex]::Matches(
    $registry,
    '(?m)^\| `(\d{14})` \| Integration closure \|'
  ) | ForEach-Object { [int64]$_.Groups[1].Value }
  if ($registeredTimestamps.Count -eq 0) {
    throw 'No Integration closure migrations are registered.'
  }

  $registeredSet = [Collections.Generic.HashSet[int64]]::new()
  foreach ($timestamp in $registeredTimestamps) { [void]$registeredSet.Add($timestamp) }

  Get-ChildItem -LiteralPath $migrationSource -Filter '*.sql' -File |
    Sort-Object Name |
    Where-Object {
      $timestamp = Get-MigrationTimestamp $_
      $null -ne $timestamp -and $registeredSet.Contains($timestamp)
    } |
    ForEach-Object {
      Copy-Item -LiteralPath $_.FullName -Destination $Destination
    }

  $copiedTimestamps = @(Get-ChildItem -LiteralPath $Destination -Filter '*.sql' -File |
    ForEach-Object { Get-MigrationTimestamp $_ } |
    Where-Object { $registeredSet.Contains($_) })
  $missing = @($registeredTimestamps | Where-Object { $_ -notin $copiedTimestamps })
  if ($missing.Count -gt 0) {
    throw "Registered phase-one closure migrations are missing: $($missing -join ', ')."
  }
  Write-Host "[phase1-db] Prepared $($copiedTimestamps.Count) registry-owned phase-one closure migrations after authoritative cutoff $authoritativeBaselineCutoff."
}

function Get-ReleaseSqlTests {
  return @(Get-ChildItem -LiteralPath $testSource -Filter '*.sql' -File |
    Where-Object { $_.Name -like 'phase-one-*.sql' -or $_.Name -in $competitiveGapTests } |
    Sort-Object Name)
}

function Invoke-PhaseOneSqlTests([string]$Worktree) {
  $tests = Get-ReleaseSqlTests
  if ($tests.Count -eq 0) {
    throw 'No release database tests were found.'
  }

  $failedTests = [Collections.Generic.List[string]]::new()
  foreach ($test in $tests) {
    $relativeTest = "supabase/tests/$($test.Name)"
    Write-Host "[phase1-db] Running $relativeTest"
    & npx.cmd --yes supabase test db $relativeTest --workdir $Worktree
    if ($LASTEXITCODE -ne 0) {
      $failedTests.Add("$($test.Name) (exit code $LASTEXITCODE)")
      Write-Error "[phase1-db] Database assertions failed in $($test.Name)." -ErrorAction Continue
    }
  }

  if ($failedTests.Count -gt 0) {
    throw "Phase-one SQL tests failed:`n - $($failedTests -join "`n - ")"
  }
}

function Invoke-DatabaseScenario([ValidateSet('fresh', 'upgraded')] [string]$Scenario) {
  $runId = ([guid]::NewGuid().ToString('N')).Substring(0, 12)
  $tempRoot = Assert-TemporaryPath (Join-Path $tempBase "nutrio-phase-one-$Scenario-$runId")
  $supabaseRoot = Join-Path $tempRoot 'supabase'
  $migrationRoot = Join-Path $supabaseRoot 'migrations'
  $testRoot = Join-Path $supabaseRoot 'tests'
  $started = $false

  try {
    New-Item -ItemType Directory -Path $migrationRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
    [IO.File]::WriteAllText(
      (Join-Path $supabaseRoot 'config.toml'),
      "project_id = `"nutrio-phase-one-$Scenario-$runId`"`n"
    )

    Get-ReleaseSqlTests |
      ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $testRoot }

    Copy-AuthoritativeBaseline $migrationRoot
    if ($Scenario -eq 'fresh') {
      Copy-PhaseOneClosureMigrations $migrationRoot
      Write-Host '[phase1-db] Starting fresh/current schema from the authoritative baseline plus all closure migrations.'
    }
    else {
      Write-Host "[phase1-db] Starting the authoritative upgraded baseline at cutoff $authoritativeBaselineCutoff."
    }

    Invoke-Supabase @('start', '--workdir', $tempRoot) `
      "Supabase failed to start for the $Scenario phase-one database gate"
    $started = $true

    if ($Scenario -eq 'upgraded') {
      Copy-PhaseOneClosureMigrations $migrationRoot
      Write-Host '[phase1-db] Applying all phase-one migrations to the upgraded baseline.'
      Invoke-Supabase @('migration', 'up', '--local', '--workdir', $tempRoot) `
        'Phase-one migrations failed on the upgraded baseline'
    }

    Invoke-PhaseOneSqlTests $tempRoot
    Write-Host "[phase1-db] $Scenario scenario passed."
  }
  finally {
    if ($started) {
      & npx.cmd --yes supabase stop --workdir $tempRoot --no-backup
      if ($LASTEXITCODE -ne 0) {
        Write-Warning "Supabase cleanup failed for $tempRoot (exit code $LASTEXITCODE)."
      }
    }

    $resolvedTempRoot = Assert-TemporaryPath $tempRoot
    if (Test-Path -LiteralPath $resolvedTempRoot) {
      Remove-Item -LiteralPath $resolvedTempRoot -Recurse -Force
    }
  }
}

$previousNpmCache = $env:NPM_CONFIG_CACHE
$env:NPM_CONFIG_CACHE = Join-Path $tempBase 'nutrio-npm-cache'
try {
  $failures = [Collections.Generic.List[string]]::new()
  foreach ($scenario in @('fresh', 'upgraded')) {
    try {
      Invoke-DatabaseScenario $scenario
    }
    catch {
      $failures.Add("$scenario`: $($_.Exception.Message)")
      Write-Error "[phase1-db] $scenario scenario failed: $($_.Exception.Message)" -ErrorAction Continue
    }
  }

  if ($failures.Count -gt 0) {
    throw "Phase-one database gate failed:`n - $($failures -join "`n - ")"
  }
}
finally {
  $env:NPM_CONFIG_CACHE = $previousNpmCache
}
