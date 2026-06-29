#!/bin/bash
# scripts/migration.sh
# Runs Prisma database migrations safely.

set -e

echo "========================================================="
echo " Running Database Migrations"
echo "========================================================="

# Run prisma migration deploy inside the backend container
if docker ps --format '{{.Names}}' | grep -q "^whatsapp_panel_backend$"; then
    echo "Running Prisma migrations inside backend container..."
    docker exec -t whatsapp_panel_backend npx prisma migrate deploy
    echo "✔ Database migrations completed."
else
    echo "WARNING: Backend container (whatsapp_panel_backend) is not running."
    echo "Running migrations locally (requires node and DATABASE_URL in environment)..."
    npx prisma migrate deploy
    echo "✔ Local database migrations completed."
fi

echo "========================================================="
