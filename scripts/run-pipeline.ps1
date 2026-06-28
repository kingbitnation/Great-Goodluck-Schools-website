# SchoolPilot — full deploy pipeline (Windows)
# Usage: .\scripts\run-pipeline.ps1
#        .\scripts\run-pipeline.ps1 -Native   # skip Docker, use local Node processes

param(
    [switch]$Native
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Step($label, [scriptblock]$Action) {
    Write-Host "`n==================================================" -ForegroundColor Cyan
    Write-Host ">> $label" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    & $Action
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw "$label failed (exit $LASTEXITCODE)" }
}

Step "1/4 deploy:preflight" { npm run deploy:preflight }

$backendJob = $null
$frontendJob = $null

try {
    if (-not $Native) {
        Step "2/4 deploy:prod (Docker)" {
            npm run deploy:prod
            if ($LASTEXITCODE -ne 0) {
                Write-Host "`nDocker failed. Try:" -ForegroundColor Yellow
                Write-Host "  1. Open Docker Desktop and wait until it says 'Running'"
                Write-Host "  2. Docker Desktop -> Troubleshoot -> Restart"
                Write-Host "  3. Re-run: .\scripts\run-pipeline.ps1"
                Write-Host "  Or use native mode: .\scripts\run-pipeline.ps1 -Native`n"
                exit 1
            }
            Start-Sleep -Seconds 45
            npm run health:monitor
        }
    } else {
        Step "2/4 database setup" {
            $dockerOk = $false
            try { docker ps 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { $dockerOk = $true } } catch {}
            if ($dockerOk) {
                docker compose up -d db
                Start-Sleep -Seconds 8
            } else {
                Write-Host "Docker unavailable — ensure PostgreSQL is running on localhost:5432" -ForegroundColor Yellow
            }
            npm run db:setup
        }

        Step "2b/4 start backend + frontend" {
            $backendJob = Start-Job -ScriptBlock {
                Set-Location $using:Root
                npm run dev:backend 2>&1
            }
            Start-Sleep -Seconds 3
            $frontendJob = Start-Job -ScriptBlock {
                Set-Location $using:Root
                npm run dev:frontend 2>&1
            }
            node scripts/wait-for-backend.js
            $deadline = (Get-Date).AddMinutes(3)
            do {
                try {
                    $r = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
                    if ($r.StatusCode -eq 200) { break }
                } catch {}
                Start-Sleep -Seconds 3
            } while ((Get-Date) -lt $deadline)
        }
    }

    Step "3/4 test:e2e:staging" {
        $env:STAGING_API_URL = "http://localhost:4000"
        $env:STAGING_BASE_URL = "http://localhost:3000"
        npm run test:e2e:staging
    }

    Step "4/4 lighthouse" {
        $env:BASE_URL = "http://localhost:3000"
        npm run lighthouse
    }

    Write-Host "`n==================================================" -ForegroundColor Green
    Write-Host "Pipeline complete." -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green
}
finally {
    if ($backendJob) { Stop-Job $backendJob -ErrorAction SilentlyContinue; Remove-Job $backendJob -Force -ErrorAction SilentlyContinue }
    if ($frontendJob) { Stop-Job $frontendJob -ErrorAction SilentlyContinue; Remove-Job $frontendJob -Force -ErrorAction SilentlyContinue }
}
