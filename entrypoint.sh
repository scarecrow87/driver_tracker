#!/bin/sh

echo "Applying database migrations..."
node node_modules/prisma/build/index.js migrate deploy || exit 1

exec node server.js
