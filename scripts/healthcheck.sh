#!/bin/bash
# scripts/healthcheck.sh
# Performs health checks on services, databases, ports, and API endpoints.

echo "========================================================="
echo " System Health Check"
echo "========================================================="

# Step 1: Check Docker Container Statuses
echo "1. Checking Docker containers..."
services=("whatsapp_panel_db" "whatsapp_panel_redis" "whatsapp_panel_backend" "whatsapp_panel_worker" "whatsapp_panel_frontend")
all_healthy=true

for service in "${services[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${service}$"; then
        status=$(docker inspect --format '{{.State.Status}}' "$service")
        echo "   ✔ Container '$service' is running (Status: $status)"
    else
        echo "   ✘ Container '$service' is NOT running!"
        all_healthy=false
    fi
done

# Step 2: Check Database Connection
echo "2. Verifying database connection..."
if docker exec -t whatsapp_panel_db pg_isready -U db_user &>/dev/null; then
    echo "   ✔ PostgreSQL is accepting connections."
else
    echo "   ✘ PostgreSQL is not responding!"
    all_healthy=false
fi

# Step 3: Check Backend API Endpoint
echo "3. Testing Backend API health endpoint..."
if command -v curl &>/dev/null; then
    # Adjust port/path as defined in your setup. 
    # Docker internal port is typically 3000.
    response=$(docker exec -t whatsapp_panel_backend curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health || curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health || echo "failed")
    if [ "$response" = "200" ]; then
         echo "   ✔ Backend API is healthy (HTTP 200)"
    else
         echo "   ✘ Backend API health check failed! (HTTP Response: $response)"
         all_healthy=false
    fi
else
    echo "   - curl is not installed on host. Skipping API curl check."
fi

echo "========================================================="
if [ "$all_healthy" = true ]; then
    echo " STATUS: HEALTHY"
    exit 0
else
    echo " STATUS: UNHEALTHY (Check logs: docker compose logs)"
    exit 1
fi
echo "========================================================="
