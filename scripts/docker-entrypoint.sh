#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
node scripts/wait-for-db.js

echo "Applying database schema..."
if [ "${SKIP_DB_PUSH}" = "true" ]; then
  echo "SKIP_DB_PUSH=true — schema step skipped"
elif [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null | grep -v README)" ]; then
  npx prisma migrate deploy
else
  npx prisma db push
fi

if [ "${RUN_SEED}" = "true" ]; then
  echo "Seeding database (RUN_SEED=true)..."
  npm run prisma:seed
else
  node scripts/seed-if-empty.js
fi

echo "Starting application..."
exec "$@"
