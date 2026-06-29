# GitHub Actions Deployment Guide

This guide details how to configure a GitHub Actions CI/CD workflow to compile and deploy the WhatsApp Panel to your production VPS automatically upon code updates.

---

## 1. Setup GitHub Secrets

Inside your GitHub repository, navigate to **Settings > Secrets and variables > Actions** and register the following variables:
- `VPS_SSH_HOST`: IP address of your production VPS.
- `VPS_SSH_USER`: SSH username (e.g. `ubuntu`).
- `VPS_SSH_KEY`: Private key file contents (`.pem`) used to authenticate.
- `VPS_TARGET_DIR`: Target directory path on your server (e.g. `/var/www/whatsapp-panel`).

---

## 2. CI/CD Workflow Setup

Create a file named `.github/workflows/deploy.yml` inside your repository root containing:

```yaml
name: Deploy WhatsApp Panel

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v3

      - name: Install Node.js
        uses: actions/setup-node@v3
        with:
          node-node: 20

      - name: Compile User Frontend
        run: |
          cd frontend-user
          npm install
          npm run build -- --emptyOutDir

      - name: Compile Admin Frontend
        run: |
          cd frontend-admin
          npm install
          npm run build -- --emptyOutDir

      - name: Upload Build Assets to VPS
        uses: appleboy/scp-action@master
        with:
          host: ${{ secrets.VPS_SSH_HOST }}
          username: ${{ secrets.VPS_SSH_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          source: "backend/,frontend-user/dist/,frontend-admin/dist/,deployment/,scripts/,docs/,env/"
          target: ${{ secrets.VPS_TARGET_DIR }}

      - name: Execute Remote Deploy Commands
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_SSH_HOST }}
          username: ${{ secrets.VPS_SSH_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd ${{ secrets.VPS_TARGET_DIR }}
            # Copy env templates if not present
            if [ ! -f .env ]; then
              cp env/docker.env.example .env
            fi
            
            # Rebuild containers
            docker compose -f deployment/docker-compose.yml up -d --build
            
            # Apply DB migrations
            docker compose exec -T backend npx prisma migrate deploy
            docker compose exec -T backend node scripts/migrate_user_limits.js
```
This triggers on every push to the `main` branch, compiling the frontend files locally to avoid server OOM issues, and deploys using SCP/SSH.
