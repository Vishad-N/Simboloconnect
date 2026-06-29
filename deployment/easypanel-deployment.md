# Easypanel Deployment Guide

This guide explains how to deploy the white-labeled WhatsApp Panel using **Easypanel** (a modern panel server powered by Docker).

---

## 1. Create a New Project

1. Open your Easypanel dashboard.
2. Click **Create Project**, choose a project name (e.g. `whatsapp-automation`).

---

## 2. Set Up Services

Inside your Easypanel project, you will create:
1. **Database Service (PostgreSQL)**:
   - Click **Add Service > Database > PostgreSQL**.
   - Easypanel generates the credentials and exposes host port mappings if needed. Keep internal docker names for linkings.
2. **Database Service (Redis)**:
   - Click **Add Service > Database > Redis**.
3. **App Service (Backend API)**:
   - Click **Add Service > App**.
   - Under **Source**, connect your Git repository and set the **Build Path** to `/backend`.
   - Set **Build Method** to `Dockerfile`.
   - Under **Environment**, specify `DATABASE_URL` (using PostgreSQL connection details), `REDIS_HOST`, `REDIS_PORT`, `JWT_SECRET`, and `ENCRYPTION_KEY`.
   - Map domains (e.g. `api.yourdomain.com`).
4. **App Service (Worker)**:
   - Create another App service using the same git repository and `/backend` path.
   - Set the startup command override to `node workers/workflowWorker.js`.
   - Do not map any domains.
5. **App Services (Frontend User & Admin)**:
   - Create two separate App services for `frontend-user` and `frontend-admin`.
   - Set the source to point to their paths.
   - Pass build arguments (e.g. `VITE_API_URL=https://api.yourdomain.com`).
   - Map domains (e.g. `panel.yourdomain.com` and `admin.yourdomain.com`).

Easypanel handles SSL registration, proxy configuration, and deployment callbacks automatically.
