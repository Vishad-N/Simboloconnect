#!/bin/bash
# production_backup.sh
# Dynamic daily Postgres DB & Redis backup script for prebuiltapi.com.

# Variables
BACKUP_DIR="/var/backups/prebuiltapi"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME="whatsapp_saas"
DB_USER="postgres"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

echo "=== Backup Started: $TIMESTAMP ==="

# 1. Backup PostgreSQL
echo "[1/3] Executing PostgreSQL Database Dump..."
PGPASSWORD="$DATABASE_PASSWORD" pg_dump -U "$DB_USER" -h "127.0.0.1" "$DB_NAME" | gzip > "$BACKUP_DIR/db_${DB_NAME}_${TIMESTAMP}.sql.gz"
if [ $? -eq 0 ]; then
    echo "PostgreSQL backup completed successfully."
else
    echo "PostgreSQL backup FAILED." >&2
fi

# 2. Backup Redis State
echo "[2/3] Executing Redis Database Save & Dump..."
redis-cli save
cp /var/lib/redis/dump.rdb "$BACKUP_DIR/redis_dump_${TIMESTAMP}.rdb"
gzip "$BACKUP_DIR/redis_dump_${TIMESTAMP}.rdb"
if [ $? -eq 0 ]; then
    echo "Redis state backup completed successfully."
else
    echo "Redis state backup FAILED." >&2
fi

# 3. Progressive Purging of Old Backups (>7 days)
echo "[3/3] Scanning for expired backups to purge..."
find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -name "*.gz" -exec rm {} \;
echo "Pruning complete."

echo "=== Backup Process Concluded ==="
