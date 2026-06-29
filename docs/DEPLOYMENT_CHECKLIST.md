# Deployment Checklist

Follow this checklist to verify that all systems are fully prepared before opening the panel to users.

## 1. Domain Configuration
- [ ] Subdomains configured (`panel.`, `admin.`, `api.`).
- [ ] DNS A-records pointing to the target server IP.
- [ ] Traefik or Nginx rules mapped to the correct containers and ports.

## 2. Security & SSL
- [ ] SSL active and verified via Let's Encrypt for all three domains.
- [ ] Non-SSL HTTP traffic redirected to HTTPS.
- [ ] Firewall limits configured (allow port 80, 443, block database ports 5432, 6379 from the internet).
- [ ] Default postgres password replaced inside `.env`.
- [ ] Default `JWT_SECRET` replaced.
- [ ] Default `ENCRYPTION_KEY` changed.

## 3. Core Credentials
- [ ] SMTP Credentials configured and tested.
- [ ] Meta Developer App ID and App Secret defined.
- [ ] Redis caching connection verified.

## 4. Lifecycle Verification
- [ ] Automated backups enabled via cron task scheduler.
- [ ] Healthcheck script scheduled to run periodically.
- [ ] Docker compose restart policy set to `unless-stopped` or `always`.
