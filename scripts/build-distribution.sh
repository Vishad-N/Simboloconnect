#!/bin/bash
# scripts/build-distribution.sh
# Automates clean copying, scrubbing of credentials/node_modules/logs, and zipping the white-label package.

set -e

WORKSPACE="/Users/abhisheksharma/Downloads/whatsapp-panel 3"
DIST_DIR="$WORKSPACE/whatsapp-panel-distribution"
VERSION=$(grep -v '^#' "$DIST_DIR/VERSION.md" 2>/dev/null | tr -d ' \r\n' || echo "1.0.0")
ZIP_NAME="whatsapp_panel_16june.zip"

echo "====================================================="
echo " Building White-Label Distribution Package v$VERSION"
echo "====================================================="

# Step 1: Clean and recreate distribution folder structure
echo "Cleaning old build files..."
rm -rf "$DIST_DIR/frontend-user" "$DIST_DIR/frontend-admin" "$DIST_DIR/backend"
rm -f "$WORKSPACE/$ZIP_NAME"

mkdir -p "$DIST_DIR/frontend-user"
mkdir -p "$DIST_DIR/frontend-admin"
mkdir -p "$DIST_DIR/backend"

# Step 2: Copy backend source
echo "Copying clean backend codebase..."
rsync -av --quiet \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='logs/' \
  --exclude='*.log' \
  --exclude='*.db' \
  --exclude='*mock*' \
  --exclude='prisma/dev.db*' \
  --exclude='test_*.js' \
  --exclude='test-*.js' \
  --exclude='*_orchestrator*.js' \
  --exclude='scratch_debug.js' \
  --exclude='final_test.js' \
  --exclude='create_test_user.js' \
  --exclude='get_smtp.js' \
  --exclude='query_smtp.js' \
  --exclude='seed.js' \
  "/$WORKSPACE/backend/" "$DIST_DIR/backend/"

# Step 3: Copy user frontend source
echo "Copying clean user frontend codebase..."
rsync -av --quiet \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='dist.tar.gz' \
  "$WORKSPACE/frontend/" "$DIST_DIR/frontend-user/"

# Step 4: Copy admin frontend source
echo "Copying clean admin frontend codebase..."
rsync -av --quiet \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='.env' \
  --exclude='.env.local' \
  "$WORKSPACE/admin-frontend/" "$DIST_DIR/frontend-admin/"

# Step 5: Scrub any left credentials or local development configs
echo "Scrubbing development database files and local logs..."
find "$DIST_DIR/backend" -name "*.db" -delete
find "$DIST_DIR/backend" -name "*.log" -delete
rm -f "$DIST_DIR/backend/prisma/dev.db"
rm -f "$DIST_DIR/backend/prisma/dev.db-journal"

# Step 6: Generate example configurations
echo "Adding example configuration files to code folders..."
cp "$DIST_DIR/env/backend.env.example" "$DIST_DIR/backend/.env.example"
cp "$DIST_DIR/env/frontend-user.env.example" "$DIST_DIR/frontend-user/.env.example"
cp "$DIST_DIR/env/frontend-admin.env.example" "$DIST_DIR/frontend-admin/.env.example"

# Step 7: Create distribution zip archive
echo "Zipping distribution package to: $ZIP_NAME..."
cd "$WORKSPACE"
zip -r "$ZIP_NAME" whatsapp-panel-distribution -x "whatsapp-panel-distribution/frontend-user/node_modules/*" "whatsapp-panel-distribution/frontend-admin/node_modules/*" "whatsapp-panel-distribution/backend/node_modules/*"

echo "====================================================="
echo " Distribution build complete!"
echo " Package: $WORKSPACE/$ZIP_NAME"
echo "====================================================="
