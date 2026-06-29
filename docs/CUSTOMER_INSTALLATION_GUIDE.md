# Customer Installation Guide

This guide describes how to install and connect your self-hosted instance of the WhatsApp Automation Panel.

---

## 1. Prerequisites

Before installing, ensure your server meets the following requirements:
- **Operating System**: Ubuntu 20.04 LTS or newer.
- **Hardware**: Minimum 2 Cores CPU, 4 GB RAM, and 40 GB SSD.
- **Software**: Docker Engine 20.10+ and Docker Compose v2.0+.
- **Domain Names**: A minimum of three configured subdomains pointing to your server's IP:
  - `panel.yourdomain.com` (User Frontend)
  - `admin.yourdomain.com` (Admin Panel)
  - `api.yourdomain.com` (Backend Server & Webhooks)

---

## 2. Fast Setup Steps

### Step 1: Copy Distribution Files
Extract the zip package onto your server:
```bash
unzip whatsapp-panel-distribution-v*.zip -d /var/www/whatsapp-panel
cd /var/www/whatsapp-panel
```

### Step 2: Configure Environment
Copy the environment template files and populate your keys:
```bash
cp env/docker.env.example .env
nano .env
```
Ensure you provide SMTP credentials, your encryption secret keys, and JWT secrets inside this file.

### Step 3: Launch Installation Script
Run the installer to verify pre-requisites and setup directories:
```bash
chmod +x scripts/install.sh
./scripts/install.sh
```

### Step 4: Run the System
Compile and start your container stack:
```bash
docker compose -f deployment/docker-compose.yml up -d
```

### Step 5: Initialize Database Schema
Run migrations inside the backend container:
```bash
docker compose exec backend npx prisma db push
docker compose exec backend node scripts/migrate_user_limits.js
```

---

## 3. Web Proxy Configuration
Use the provided `deployment/nginx.conf` file template to configure Nginx on your host server to act as a secure reverse proxy with Let's Encrypt SSL.
Refer to `deployment/ssl-setup-guide.md` for certificate registration.
