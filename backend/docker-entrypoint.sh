#!/bin/sh
set -e

# Run Prisma generate to ensure client is up to date
echo "Running Prisma generate..."
npx prisma generate

# Run Prisma migrations if needed
echo "Checking if migrations need to be applied..."
npx prisma migrate deploy

# Run seed if AUTO_SEED_ON_EMPTY_DB is true (seed script is idempotent)
if [ "${AUTO_SEED_ON_EMPTY_DB:-false}" = "true" ]; then
  echo "Seeding database..."
  npx prisma db seed
else
  echo "AUTO_SEED_ON_EMPTY_DB is not set to true, skipping seed."
fi

# Execute the main container command
exec "$@"