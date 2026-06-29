# SSL Setup Guide (Let's Encrypt & Certbot)

To secure your web applications, you should enable SSL (HTTPS) on your subdomains:
- `panel.yourdomain.com` (User Frontend)
- `admin.yourdomain.com` (Admin Panel)
- `api.yourdomain.com` (Backend Server & Webhooks)

This guide walks you through setting up Let's Encrypt certificates using Certbot.

---

## 1. Install Certbot

On Ubuntu servers, run the following commands to install Certbot:
```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

---

## 2. Obtain Certificates (Nginx Reverse Proxy Method)

If you are using Nginx on the host server to proxy requests into the Docker containers:

### Step 1: Set up Temporary Nginx Configs
Create configuration blocks for HTTP (Port 80) for all three domains pointing to a mock/temporary static folder, or configure standard blocks.

### Step 2: Request Certificates
Run Certbot to fetch certificates for all three subdomains:
```bash
sudo certbot certonly --nginx \
  -d panel.yourdomain.com \
  -d admin.yourdomain.com \
  -d api.yourdomain.com
```

Certbot will verify ownership of the domains, fetch the certificates, and save them to:
`/etc/letsencrypt/live/panel.yourdomain.com/`

---

## 3. Obtain Certificates (Webroot Mode / Docker Compose Proxy)

If you are using Traefik or Nginx inside Docker and want to request certificates from the host:

```bash
sudo certbot certonly --standalone \
  -d panel.yourdomain.com \
  -d admin.yourdomain.com \
  -d api.yourdomain.com
```
*Note: Standalone mode requires port 80 to be free. Temporary shut down Nginx/Docker proxy if running.*

---

## 4. Automatic Certificate Renewal

Let's Encrypt certificates are valid for 90 days. Certbot automatically adds a systemd timer or cron job to renew them.
To test renewal, run:
```bash
sudo certbot renew --dry-run
```

---

## 5. Nginx Configuration Integration

In your `/etc/nginx/sites-available/whatsapp-panel` configuration (based on the provided `deployment/nginx.conf` template), uncomment the SSL parameters and point to the path of your certificates:

```nginx
ssl_certificate /etc/letsencrypt/live/panel.yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/panel.yourdomain.com/privkey.pem;
```

Reload Nginx to activate SSL:
```bash
sudo nginx -t && sudo systemctl reload nginx
```
