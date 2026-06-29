# Direct VPS Installation Guide

This guide details steps to install the WhatsApp Panel distribution package directly on an Ubuntu VPS.

---

## 1. System Setup

Update your host system and install the required dependencies:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git unzip rsync build-essential checkinstall libssl-dev
```

---

## 2. Docker & Compose Setup

If Docker is not yet configured, install it via the official repository script:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```
Log out and log back in to activate user groups permissions.

Verify the installations:
```bash
docker --version
docker compose version
```

---

## 3. Extracting and Configuring

1. Copy the white-labeled zip package onto your VPS and extract it:
   ```bash
   sudo mkdir -p /var/www/whatsapp-panel
   sudo unzip whatsapp-panel-distribution-v*.zip -d /var/www/whatsapp-panel
   sudo chown -R $USER:$USER /var/www/whatsapp-panel
   cd /var/www/whatsapp-panel
   ```
2. Configure your environment properties:
   ```bash
   cp env/docker.env.example .env
   nano .env
   ```
3. Run the installer script:
   ```bash
   chmod +x scripts/install.sh
   ./scripts/install.sh
   ```

---

## 4. Launching the App

1. Run the compose environment using the production configurations:
   ```bash
   docker compose -f deployment/docker-compose.yml up -d
   ```
2. Initialize database schema tables:
   ```bash
   docker compose exec backend npx prisma db push
   docker compose exec backend node scripts/migrate_user_limits.js
   ```
3. Verify that all 6 containers are running:
   ```bash
   docker compose ps
   ```
4. View real-time container log updates if troubleshooting connection errors:
   ```bash
   docker compose logs -f backend
   ```
