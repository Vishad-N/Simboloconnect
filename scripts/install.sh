#!/bin/bash
# scripts/install.sh
# System environment check and configuration setup tool.

set -e

echo "========================================================="
# Check pre-requisites
echo "Checking dependencies..."
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed. Please install it first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "ERROR: Docker Compose is not installed."
    exit 1
fi

echo "✔ Docker and Docker Compose are available."

# Initialize configuration files
echo "Initializing configuration files..."
if [ ! -f ".env" ]; then
    if [ -f "env/docker.env.example" ]; then
        cp env/docker.env.example .env
        echo "✔ Created .env from env/docker.env.example"
        echo "IMPORTANT: Open .env and fill in your keys (JWT_SECRET, SMTP, Meta credentials, etc.) before running docker compose."
    else
        echo "WARNING: env/docker.env.example not found. Please create .env manually."
    fi
else
    echo "✔ .env already exists. Skipping initialization."
fi

# Create persistent data folders
echo "Creating persistent storage folders..."
mkdir -p storage/postgres
mkdir -p storage/redis
mkdir -p storage/logs
mkdir -p backups

# Set execution rights
chmod +x scripts/update.sh 2>/dev/null || true
chmod +x scripts/backup.sh 2>/dev/null || true
chmod +x scripts/restore.sh 2>/dev/null || true
chmod +x scripts/healthcheck.sh 2>/dev/null || true
chmod +x scripts/migration.sh 2>/dev/null || true

echo "========================================================="
echo " System installation check passed successfully!"
echo " Next steps: "
echo " 1. Configure the '.env' file."
echo " 2. Deploy services: docker compose -f deployment/docker-compose.yml up -d"
echo "========================================================="
