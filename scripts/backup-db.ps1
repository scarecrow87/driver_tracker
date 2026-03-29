param(
    [string]$BackupDir = ".\backups",
    [string]$DbUser = "postgres",
    [string]$DbName = "driver_tracker"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outputFile = Join-Path $BackupDir "driver_tracker_$timestamp.sql.gz"
$containerTmp = "/tmp/driver_tracker_backup_$timestamp.sql.gz"

Write-Host "Creating backup at $outputFile..."

$dumpCommand = "pg_dump -U '$DbUser' '$DbName' | gzip > '$containerTmp'"
docker compose exec -T db sh -lc $dumpCommand
if ($LASTEXITCODE -ne 0) {
    throw "pg_dump failed"
}

docker compose cp "db:$containerTmp" "$outputFile"
if ($LASTEXITCODE -ne 0) {
    throw "Failed to copy backup file from container"
}

docker compose exec -T db sh -lc "rm -f $containerTmp" | Out-Null

Write-Host "Backup complete: $outputFile"
