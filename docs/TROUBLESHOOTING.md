# Troubleshooting Guide

This guide details resolutions for common problems encountered during setup, sync, or campaign execution.

---

## 1. Container Memory Exhaustion (OOM)

### Symptom
Frontend or Admin container build freezes the host server, or the container crashes with exit code 137.

### Resolution
The server VPS is running out of memory during frontend Vite compilation.
- **Do not compile on the server**. Use pre-compiled files. Our default `Dockerfile` under `frontend-user/` and `frontend-admin/` are configured to copy pre-compiled `dist` folders directly to an Nginx server, completely bypassing on-server build commands.
- Run `npm run build` locally inside your development environment, and then push the static `dist/` folders to your production server before launching `docker compose build`.

---

## 2. PostgreSQL Connection Refused / Prisma Errors

### Symptom
Prisma reports `P1001: Can't reach database server at postgres:5432`.

### Resolution
- Verify the Postgres database container is healthy:
  ```bash
  docker compose ps
  ```
- Ensure the database url configuration inside `.env` matches the postgres container name, port, and credentials:
  ```env
  DATABASE_URL=postgresql://user:password@postgres:5432/whatsapp_panel?schema=public
  ```
- If the database is starting up slowly, increase the wait limit inside your launch script before triggering prisma migrations.

---

## 3. Meta API Verification / Webhook Issues

### Symptom
Facebook WhatsApp Webhook verify requests fail, or inbound user messages don't appear in Live Chat.

### Resolution
- **Verify Subscription Token**: Check `WEBHOOK_VERIFY_TOKEN` inside your backend environment and match it exactly inside your Facebook Developer console.
- **WABA IDs Whitelist**: Ensure that the WABA ID of your WhatsApp phone number is registered correctly.
- **Queue Check**: Sockets and messages are queued in Redis. Ensure the Redis container is running and healthy:
  ```bash
  docker logs whatsapp_panel_redis
  docker logs whatsapp_panel_worker
  ```

---

## 4. Campaigns Stuck in PENDING

### Symptom
Broadcast campaigns remain stuck in `PENDING` or `RUNNING` status without sending.

### Resolution
- Check if your worker container is active:
  ```bash
  docker compose logs worker
  ```
- Verify Redis is running and there are no blocked jobs in the `campaign-queue` or `webhook.inbound` queues.
- Ensure the user's wallet balance has not run out of credits, as campaigns pause automatically if credits run low.
