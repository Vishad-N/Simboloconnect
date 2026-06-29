#!/bin/bash
# scripts/backup.sh
# Performs Postgres pg_dumpall + Redis SAVE compressed backups.

set -e

BACKUP_ID=${1:-"auto-$(date +%F-%H%M%S)"}
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

echo "========================================================="
echo " Initiating System Backups (ID: $BACKUP_ID)"
echo "========================================================="

# Step 1: Backup PostgreSQL database
echo "Backing up PostgreSQL..."
PG_FILE="$BACKUP_DIR/postgres_backup_$BACKUP_ID.sql.gz"
if docker ps | grep -q "whatsapp_panel_db"; then
    docker exec -t whatsapp_panel_db pg_dumpall -c -U db_user | gzip > "$PG_FILE"
    echo "✔ PostgreSQL backup saved: $PG_FILE"
else
    echo "ERROR: PostgreSQL container (whatsapp_panel_db) is not running. PostgreSQL backup failed!"
    exit 1
fi

# Step 2: Backup Redis database
echo "Backing up Redis..."
REDIS_FILE="$BACKUP_DIR/redis_backup_$BACKUP_ID.rdb.gz"
if docker ps | grep -q "whatsapp_panel_redis"; then
    # Trigger redis save snapshot
    docker exec -t whatsapp_panel_redis redis-cli -a redis_password SAVE &>/dev/null || docker exec -t whatsapp_panel_redis redis-cli SAVE &>/dev/null
    # Copy RDB snapshot and compress
    docker cp whatsapp_panel_redis:/data/dump.rdb /tmp/redis_dump.rdb
    gzip -c /tmp/redis_dump.rdb > "$REDIS_FILE"
    rm -f /tmp/redis_dump.rdb
    echo "✔ Redis database backup saved: $REDIS_FILE"
else
    echo "WARNING: Redis container (whatsapp_panel_redis) is not running. Redis backup skipped."
fi

echo "========================================================="
echo " Backup complete! All archives saved to: $BACKUP_DIR/"
echo "========================================================="
