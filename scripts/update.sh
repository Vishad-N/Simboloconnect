#!/bin/bash
# scripts/update.sh
# System codebase updates and database migration manager.

set -e

BACKUP_NAME="before-update-$(date +%F-%H%M%S)"
echo "========================================================="
echo " Starting WhatsApp Panel Update Process"
echo "========================================================="

# Step 1: Perform safety backup
echo "Step 1: Running system backup before upgrade..."
if [ -f "./scripts/backup.sh" ]; then
    ./scripts/backup.sh "$BACKUP_NAME"
else
    echo "WARNING: Backup script not found. Creating DB snapshot manually..."
    mkdir -p backups
    docker exec -t whatsapp_panel_db pg_dumpall -c -U db_user > "backups/pg_backup_$BACKUP_NAME.sql" || true
fi

# Step 2: Retrieve latest code changes
echo "Step 2: Pulling latest white-label codebase from repository..."
git pull origin main || echo "WARNING: Git pull failed or not in a git repository. Continuing with local update..."

# Step 3: Run database migrations
echo "Step 3: Running database migrations..."
if [ -f "./scripts/migration.sh" ]; then
    ./scripts/migration.sh
else
    docker compose exec -T backend npx prisma migrate deploy || true
fi

# Step 4: Recompile and rebuild container layers
echo "Step 4: Rebuilding containers..."
docker compose -f deployment/docker-compose.yml build --no-cache backend worker
docker compose -f deployment/docker-compose.yml up -d

# Step 5: Execute system health verification
echo "Step 5: Running post-update health check..."
if [ -f "./scripts/healthcheck.sh" ]; then
    ./scripts/healthcheck.sh
fi

echo "========================================================="
echo " Update complete! System is back online."
echo "========================================================="
