#!/bin/bash
# scripts/restore.sh
# Restores PostgreSQL and Redis databases from compressed backups.

set -e

BACKUP_ID=$1

if [ -z "$BACKUP_ID" ]; then
    echo "ERROR: Missing Backup ID argument."
    echo "Usage: ./scripts/restore.sh [BACKUP_ID]"
    echo "Available backups in backups/ folder:"
    ls -lh backups/ 2>/dev/null || echo "  (no backups found)"
    exit 1
fi

echo "========================================================="
echo " Restoring Database State (Backup ID: $BACKUP_ID)"
echo "========================================================="

# Step 1: Restore Postgres
PG_FILE="backups/postgres_backup_$BACKUP_ID.sql.gz"
if [ -f "$PG_FILE" ]; then
    echo "Restoring PostgreSQL database..."
    gunzip -c "$PG_FILE" > /tmp/postgres_restore.sql
    docker cp /tmp/postgres_restore.sql whatsapp_panel_db:/tmp/restore.sql
    docker exec -it whatsapp_panel_db psql -U db_user -d whatsapp_panel_db -f /tmp/restore.sql
    rm -f /tmp/postgres_restore.sql
    echo "✔ PostgreSQL restore completed."
else
    echo "ERROR: PostgreSQL backup archive not found: $PG_FILE"
    exit 1
fi

# Step 2: Restore Redis
REDIS_FILE="backups/redis_backup_$BACKUP_ID.rdb.gz"
if [ -f "$REDIS_FILE" ]; then
    echo "Restoring Redis database..."
    gunzip -c "$REDIS_FILE" > /tmp/dump.rdb
    docker compose stop redis || docker stop whatsapp_panel_redis
    docker cp /tmp/dump.rdb whatsapp_panel_redis:/data/dump.rdb
    rm -f /tmp/dump.rdb
    docker compose start redis || docker start whatsapp_panel_redis
    echo "✔ Redis restore completed."
else
    echo "WARNING: Redis backup archive not found: $REDIS_FILE. Skipping Redis restore."
fi

echo "========================================================="
echo " System restore complete!"
echo "========================================================="
