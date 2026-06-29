# Customer Handover Checklist

This checklist is used by resellers and deployment engineers to verify that a client's WhatsApp Automation Panel instance has been successfully configured, secured, and is ready for production handover.

---

## 1. Domain & Network Security
- [ ] **Domain configured**: Primary and subdomains (e.g. `panel.client.com`, `admin.client.com`, `api.client.com`) point correctly to the production server IP via DNS (A/CNAME records).
- [ ] **SSL active**: HTTPS is active on all endpoints. Certificates are issued by Let's Encrypt, verified, and automatic renewal (via Certbot/Traefik) is successfully tested.
- [ ] **CORS configured**: API CORS origin constraints restrict access only to the user and admin front-end subdomains.

---

## 2. Platform Channels & Integrations
- [ ] **SMTP configured**: Outbound transactional email server settings are set (SMTP host, port, credentials, and sender address). Sent verification emails (Login OTPs and invites) successfully.
- [ ] **WhatsApp connected**: Meta WhatsApp Business Account (WABA) is successfully linked. Phone numbers are registered, status shows "Connected," and sandbox/live sending is functional.
- [ ] **Meta webhook verified**: Graph API webhook subscription is verified. Messages sent from Meta correctly reach the backend endpoint (`/api/webhooks`) and show up in live chats.
- [ ] **AI configured**: LLM provider API credentials (e.g. OpenRouter key) are active. Dynamic AI prompt engine and fallback configurations respond with expected messaging structures.
- [ ] **Shopify connected**: Shopify Partner App / Custom App client credentials are set. Sync tests run successfully without payload drops.

---

## 3. System Operations & Admin Verification
- [ ] **Backup enabled**: Daily PostgreSQL database dumps and Redis snapshots are scheduled via cron and run helper backup scripts (`scripts/backup.sh`). Archives verify clean recovery options.
- [ ] **Monitoring enabled**: System resource health (CPU, memory, disk capacity) is connected to a daemon (e.g., Netdata, Coolify, or PM2) and docker logs write cleanly without persistent error dumps.
- [ ] **Admin login verified**: Root administrator access credentials are functional. Old default passwords (and default admin emails like `support@prebuiltapi.com`) are deactivated, replaced by custom client accounts.

---

## Handover Sign-Off
- **Client Name**: ___________________________
- **Reseller Auditor**: ___________________________
- **Date of Verification**: ___________________________
- **System Status**: [  ] APPROVED  /  [  ] REJECTED
