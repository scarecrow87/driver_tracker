#!/bin/sh
set -e

MAX_RETRIES=${MIGRATION_MAX_RETRIES:-10}
SLEEP_SECONDS=${MIGRATION_RETRY_DELAY_SECONDS:-5}

# Run Prisma generate to ensure client is up to date
echo "Running Prisma generate..."
npx prisma generate

# Run Prisma migrations if needed
echo "Checking if migrations need to be applied..."
attempt=1
while [ "$attempt" -le "$MAX_RETRIES" ]; do
  if npx prisma migrate deploy; then
    echo "Migrations applied successfully."
    break
  fi

  if [ "$attempt" -eq "$MAX_RETRIES" ]; then
    echo "Migration failed after ${MAX_RETRIES} attempts."
    exit 1
  fi

  echo "Migration attempt ${attempt}/${MAX_RETRIES} failed. Retrying in ${SLEEP_SECONDS}s..."
  attempt=$((attempt + 1))
  sleep "$SLEEP_SECONDS"
done

# Run seed if AUTO_SEED_ON_EMPTY_DB is true (seed script is idempotent)
if [ "${AUTO_SEED_ON_EMPTY_DB:-false}" = "true" ]; then
  echo "Seeding database..."
  npx prisma db seed
else
  echo "AUTO_SEED_ON_EMPTY_DB is not set to true, skipping seed."
fi

# Execute the main container command
exec "$@"
