#!/bin/sh

set -e

MAX_RETRIES=${MIGRATION_MAX_RETRIES:-10}
SLEEP_SECONDS=${MIGRATION_RETRY_DELAY_SECONDS:-5}

echo "Applying database migrations..."

attempt=1
while [ "$attempt" -le "$MAX_RETRIES" ]; do
	if node node_modules/prisma/build/index.js migrate deploy; then
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

exec node server.js
