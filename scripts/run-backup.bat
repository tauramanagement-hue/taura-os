@echo off
REM TAURA OS — Wrapper per Task Scheduler Windows
REM Esegue il backup PowerShell ogni 24h

REM === CONFIGURA QUI ===
SET BACKUP_DIR=E:\Backups\Taura
SET KEEP_DAYS=30

REM Opzionale: imposta per dump completo PostgreSQL
REM SET SUPABASE_DB_URL=postgresql://postgres.[ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres

powershell -ExecutionPolicy Bypass -File "%~dp0backup.ps1" -BackupRoot "%BACKUP_DIR%" -KeepDays %KEEP_DAYS%

IF %ERRORLEVEL% NEQ 0 (
    echo [ERRORE] Backup fallito con codice %ERRORLEVEL% >> "%BACKUP_DIR%\backup-errors.log"
)
