#!/bin/sh

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "This will overwrite data in the current database."
echo "Type RESTORE to continue:"
read -r CONFIRM

if [ "${CONFIRM}" != "RESTORE" ]; then
  echo "Restore cancelled."
  exit 1
fi

echo "Dropping and recreating schema..."
docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'

echo "Restoring from ${BACKUP_FILE}..."
gunzip -c "${BACKUP_FILE}" | docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -v ON_ERROR_STOP=1'

echo "Restore complete."
