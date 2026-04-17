# TAURA OS - Backup Automatico
# Salva: Locale + OneDrive
# Politica: min 2 backup, elimina dopo 2gg se numero > 2

param(
    [string]$BackupLocal = "E:\Backups\Taura",
    [string]$BackupCloud = "C:\Users\aless\OneDrive\Backups\Taura",
    [int]$MinBackups = 2,
    [int]$DeleteAfterDays = 2
)

$ErrorActionPreference = "Continue"
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$projectDir = "E:\Taura\Taura\Sport Management\Code SaaS\roster-rise-ai-main\roster-rise-ai-main"

Write-Host "=== TAURA BACKUP $timestamp ===" -ForegroundColor Cyan
Write-Host ""

# TEMP DIR
$tempBackupDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "taura-backup-$timestamp")
New-Item -ItemType Directory -Path $tempBackupDir -Force | Out-Null

# 1. BACKUP CODICE
Write-Host "[1/3] Backup codice..." -ForegroundColor Yellow
Push-Location $projectDir
try {
    git bundle create (Join-Path $tempBackupDir "taura-os-repo.bundle") --all --quiet 2>$null
    Write-Host "      OK - Repo salvata" -ForegroundColor Green
} catch {
    Write-Host "      ERRORE - Git: $_" -ForegroundColor Red
}
Pop-Location

# 2. BACKUP DB
Write-Host "[2/3] Backup database Supabase..." -ForegroundColor Yellow

$supabaseUrl = "https://zywifoacnzpnuvhjlmzj.supabase.co"
$supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5d2lmb2FjbnpwbnV2aGpsbXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTYzNTMsImV4cCI6MjA4Nzk3MjM1M30.-MmwWm7f-ylItxDuxLYQ27bNMlAEko2hmwFlE-sdc9E"

$headers = @{
    "apikey" = $supabaseKey
    "Authorization" = "Bearer $supabaseKey"
}

$tables = @("agencies", "profiles", "athletes", "contracts", "deals", "campaigns", "campaign_deliverables", "conflicts", "notifications", "activities", "chat_messages")

$csvDir = Join-Path $tempBackupDir "csv"
$jsonDir = Join-Path $tempBackupDir "json"
New-Item -ItemType Directory -Path $csvDir, $jsonDir -Force | Out-Null

$successCount = 0
foreach ($table in $tables) {
    try {
        # CSV
        $csvHeaders = $headers.Clone()
        $csvHeaders["Accept"] = "text/csv"
        $csv = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/$table?select=*" -Headers $csvHeaders -Method Get -TimeoutSec 30
        if ($csv) {
            $csv | Out-File -FilePath (Join-Path $csvDir "$table.csv") -Encoding UTF8
        }

        # JSON
        $jsonHeaders = $headers.Clone()
        $jsonHeaders["Accept"] = "application/json"
        $json = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/$table?select=*" -Headers $jsonHeaders -Method Get -TimeoutSec 30
        if ($json) {
            $json | ConvertTo-Json -Depth 10 | Out-File -FilePath (Join-Path $jsonDir "$table.json") -Encoding UTF8
        }
        $successCount++
        Write-Host "      $table OK" -ForegroundColor Gray
    } catch {
        Write-Host "      $table SKIP" -ForegroundColor DarkYellow
    }
}
Write-Host "      OK - Esportate $successCount tabelle" -ForegroundColor Green

# 3. COMPRIMI E SALVA
Write-Host "[3/3] Compressione e salvataggio..." -ForegroundColor Yellow

$zipFileName = "taura-backup-$timestamp.zip"
$zipPath = Join-Path $tempBackupDir $zipFileName

Compress-Archive -Path (Get-ChildItem -Path $tempBackupDir -Exclude $zipFileName) -DestinationPath $zipPath -Force

# Salva LOCALE
New-Item -ItemType Directory -Path $BackupLocal -Force | Out-Null
Copy-Item -Path $zipPath -Destination (Join-Path $BackupLocal $zipFileName) -Force
$localSize = [math]::Round((Get-Item (Join-Path $BackupLocal $zipFileName)).Length / 1MB, 2)
Write-Host "      OK - Locale: $localSize MB" -ForegroundColor Green

# Salva ONEDRIVE
if (Test-Path $BackupCloud) {
    Copy-Item -Path $zipPath -Destination (Join-Path $BackupCloud $zipFileName) -Force
    Write-Host "      OK - OneDrive sincronizzato" -ForegroundColor Green
} else {
    New-Item -ItemType Directory -Path $BackupCloud -Force | Out-Null
    Copy-Item -Path $zipPath -Destination (Join-Path $BackupCloud $zipFileName) -Force
    Write-Host "      OK - OneDrive creato e sincronizzato" -ForegroundColor Green
}

Remove-Item -Path $tempBackupDir -Recurse -Force

# CLEANUP
Write-Host ""
Write-Host "Cleanup backup vecchi..." -ForegroundColor DarkGray

$cutoffDate = (Get-Date).AddDays(-$DeleteAfterDays)

foreach ($location in @($BackupLocal, $BackupCloud)) {
    if (Test-Path $location) {
        $backups = Get-ChildItem -Path $location -Filter "taura-backup-*.zip" -ErrorAction SilentlyContinue | Sort-Object -Property LastWriteTime -Descending

        if ($backups.Count -gt $MinBackups) {
            foreach ($backup in $backups | Select-Object -Skip $MinBackups) {
                if ($backup.LastWriteTime -lt $cutoffDate) {
                    Remove-Item $backup.FullName -Force
                    Write-Host "      Rimosso: $($backup.Name)" -ForegroundColor DarkGray
                }
            }
        }
    }
}

# REPORT
Write-Host ""
Write-Host "=== BACKUP COMPLETATO ===" -ForegroundColor Cyan

$localBackups = @(Get-ChildItem -Path $BackupLocal -Filter "taura-backup-*.zip" -ErrorAction SilentlyContinue | Measure-Object).Count
$cloudBackups = @(Get-ChildItem -Path $BackupCloud -Filter "taura-backup-*.zip" -ErrorAction SilentlyContinue | Measure-Object).Count

Write-Host "Backup locali: $localBackups (min: $MinBackups)" -ForegroundColor White
Write-Host "Backup OneDrive: $cloudBackups" -ForegroundColor White
Write-Host "Dimensione: $localSize MB" -ForegroundColor White
Write-Host ""
