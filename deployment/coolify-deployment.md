# Coolify Deployment Guide

This guide explains how to deploy the white-labeled WhatsApp Panel package using the **Coolify** self-hosted Heroku/Netlify alternative.

---

## 1. Create a New Project

1. Open your Coolify Dashboard and go to **Projects**.
2. Click **Add New Project**, choose a project name (e.g. `WaDesk Panel`).
3. Click **Add New Environment** (e.g. `production`).

---

## 2. Set Up Postgres and Redis Databases

Instead of running Postgres and Redis inside your main build container, deploy them as separate Coolify Services:
1. Inside your Environment, click **New Resource > Database > PostgreSQL**.
2. Choose a database name (e.g. `whatsapp_panel`) and set persistent volume mounts.
3. Save configurations. Note down the internal network **ConnectionString** (e.g. `postgresql://postgres:password@postgres:5432/whatsapp_panel`).
4. Click **New Resource > Database > Redis**. Set internal connection parameters.

---

## 3. Deploy the Backend & Worker

1. Click **New Resource > Application > Private Repository / Git**. Connect your backend repository.
2. Set build destination ports to expose port `5005`.
3. Configure the **Build Pack** as `Docker` pointing to your backend `Dockerfile`.
4. Define Environment Variables:
   - `DATABASE_URL`: Set to your internal PostgreSQL connection string.
   - `REDIS_HOST`: Set to your internal Redis service name/IP.
   - `REDIS_PORT`: `6379`
   - `JWT_SECRET`, `ENCRYPTION_KEY`: Set secure random hashes.
5. Create a duplicate application resource for the **Worker** service:
   - Point to the same repository and backend `Dockerfile`.
   - Set the startup command override to `node workers/workflowWorker.js`.
   - Do not expose ports or bind public domains for the worker.

---

## 4. Deploy User and Admin Frontends

1. Click **New Resource > Application > Git** to configure your frontend repositories.
2. Expose port `80` (the prebuilt static containers run Nginx internally on port 80).
3. Set the **Build Pack** to `Docker` pointing to the Dockerfile.
4. Pass Build Arguments:
   - `VITE_API_URL`: `https://api.yourdomain.com` (your backend URL).
5. Expose public domain rules (e.g. `https://panel.yourdomain.com` and `https://admin.yourdomain.com`). Coolify will automatically configure Let's Encrypt SSL and proxy connections to the containers.
