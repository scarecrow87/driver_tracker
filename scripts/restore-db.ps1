param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,
    [switch]$Force,
    [string]$DbUser = "postgres",
    [string]$DbName = "driver_tracker"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
    throw "Backup file not found: $BackupFile"
}

if (-not $Force) {
    $confirmation = Read-Host "This will overwrite database data. Type RESTORE to continue"
    if ($confirmation -ne "RESTORE") {
        Write-Host "Restore cancelled."
        exit 1
    }
}

Write-Host "Dropping and recreating schema..."
$resetCommand = "psql -U '$DbUser' '$DbName' -v ON_ERROR_STOP=1 -c \"DROP SCHEMA public CASCADE; CREATE SCHEMA public;\""
docker compose exec -T db sh -lc $resetCommand
if ($LASTEXITCODE -ne 0) {
    throw "Failed to reset schema"
}

Write-Host "Restoring from $BackupFile..."
$containerTmp = "/tmp/driver_tracker_restore.sql.gz"

docker compose cp "$BackupFile" "db:$containerTmp"
if ($LASTEXITCODE -ne 0) {
    throw "Failed to copy backup file into container"
}

$restoreCommand = "gunzip -c '$containerTmp' | psql -U '$DbUser' '$DbName' -v ON_ERROR_STOP=1"
docker compose exec -T db sh -lc $restoreCommand
if ($LASTEXITCODE -ne 0) {
    throw "Restore failed"
}

docker compose exec -T db sh -lc "rm -f $containerTmp" | Out-Null

Write-Host "Restore complete."
