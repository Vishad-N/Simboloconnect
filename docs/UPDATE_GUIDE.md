# Customer Upgrade Guide

This guide provides technical steps for resellers and self-hosted customers to perform upgrades on the WhatsApp Panel application.

---

## 1. Database Backup Before Upgrade

Before performing any system upgrades, you MUST back up your database and runtime configurations. 

### Automated Backup
Run the backup script inside the `scripts/` directory:
```bash
./scripts/backup.sh
```
This generates compressed database archives (`postgres_backup_*.sql.gz` and `redis_backup_*.rdb.gz`) under the `backups/` folder.

### Manual Backup (Docker Compose)
If the script is not accessible, run:
```bash
# Backup PostgreSQL Database
docker exec -t whatsapp_panel_db pg_dumpall -c -U user > backups/manual_postgres_backup.sql

# Backup Redis Database
docker exec -t whatsapp_panel_redis redis-cli SAVE
docker cp whatsapp_panel_redis:/data/dump.rdb backups/manual_redis_backup.rdb
```

---

## 2. Upgrade Procedures

### Upgrading from v1 to v2 (Database Migration Focus)
v2 introduces user usage limits and voice campaign tables in Prisma.
1. Pull the v2 codebase:
   ```bash
   git pull origin main
   ```
2. Build new container versions:
   ```bash
   docker compose build backend worker
   ```
3. Run database migrations:
   ```bash
   docker exec whatsapp_panel_backend npx prisma migrate deploy
   ```
4. Run user limits seeding to update existing records:
   ```bash
   docker exec whatsapp_panel_backend node scripts/migrate_user_limits.js
   ```
5. Restart containers:
   ```bash
   docker compose up -d
   ```

### Upgrading from v2 to v3 (White-Label Config Focus)
v3 converts all hardcoded references to environment configurations.
1. Check `.env.example` inside the `env/` directory. Copy the new keys (`VITE_BRAND_NAME`, `VITE_SUPPORT_EMAIL`, etc.) into your live `.env` file.
2. Pull the v3 codebase.
3. Run the local assets build (if not using prebuilt containers):
   ```bash
   cd frontend-user && npm install && npm run build
   cd ../frontend-admin && npm install && npm run build
   ```
4. Run container builds:
   ```bash
   docker compose up -d --build
   ```
5. Run the health check script to verify connectivity:
   ```bash
   ./scripts/healthcheck.sh
   ```

---

## 3. Rollback Procedure

If the upgrade fails or triggers system errors, execute this rollback path:

### Step 1: Stop Current Containers
```bash
docker compose down
```

### Step 2: Restore Previous Code Base
Revert git repository state to the pre-upgrade commit hash:
```bash
git reset --hard <PREVIOUS_COMMIT_HASH>
```

### Step 3: Rebuild Old Containers
```bash
docker compose up -d --build
```

### Step 4: Restore Databases
If database schema changes are incompatible with the rolled-back code, restore the database dumps:
```bash
# Restore Postgres
docker cp backups/manual_postgres_backup.sql whatsapp_panel_db:/tmp/
docker exec -t whatsapp_panel_db psql -U user -d whatsapp_panel -f /tmp/manual_postgres_backup.sql

# Restore Redis
docker cp backups/manual_redis_backup.rdb whatsapp_panel_redis:/data/dump.rdb
docker restart whatsapp_panel_redis
```

---

## 4. Zero-Downtime Upgrade Guide

To upgrade the application without disrupting active chat sessions or campaign dispatches:

1. **Keep Database Persistent**: Maintain Postgres and Redis in external docker volumes so they are independent of backend container rebuilds.
2. **Reverse Proxy Load Balancing**: Use Traefik or Nginx proxy in front of your containers.
3. **Rolling Updates (Docker Compose)**:
   - Configure your service deployments with a rolling update strategy:
     ```yaml
     deploy:
       update_config:
         order: start-first
         failure_action: rollback
         delay: 5s
     ```
   - Run deployment rebuild with the `--no-deps` and `--build` flags:
     ```bash
     docker compose up -d --no-deps --build backend worker
     ```
   - This starts the new backend container instances first, validates their health checks, and shifts Traefik routing to the new instances before terminating the old backend containers, ensuring 0ms downtime.
