#!/bin/sh
set -e

# Run Prisma migrations
npx prisma migrate deploy

# Start the application
exec npm run start:prod
