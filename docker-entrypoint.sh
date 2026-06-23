#!/bin/sh
set -e

wait_for_db() {
  echo "Waiting for database at $DATABASE_URL..."
  until node - <<'NODE'
const { Client } = require('pg')
const client = new Client({ connectionString: process.env.DATABASE_URL })
client.connect()
  .then(() => client.end())
  .catch(() => process.exit(1))
NODE
  do
    echo "Database unavailable, sleeping 2 seconds..."
    sleep 2
  done
}

wait_for_db

echo "Generating Prisma client..."
npx prisma generate

if [ -d ./prisma/migrations ] && [ "$(ls -A prisma/migrations)" ]; then
  echo "Applying database migrations..."
  npx prisma migrate deploy
else
  echo "No migrations found, pushing schema to database..."
  npx prisma db push --accept-data-loss
fi

if [ "$NODE_ENV" != "production" ]; then
  echo "Running seed script..."
  node prisma/seed.ts
fi

echo "Starting backend server..."
exec "$@"
