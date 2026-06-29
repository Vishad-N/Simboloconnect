# Required Seeds & System Settings Setup

To initialize a new self-hosted installation of the WhatsApp Automation Panel, the database must be seeded with default configurations.

---

## 1. Default Voice Providers Seeding

Seeding initializes Twilio, Retell, Vapi, and Bland AI voice providers inside the database so users can immediately select them when setting up AI Voice campaigns.

Run the voice seeding script inside the backend directory:
```bash
docker compose exec backend node seed_voice.js
```
*Note: This script skips creation if default records are already detected, preventing database duplicates.*

---

## 2. System Settings Reference

Initialize default system settings required by the web application for its core operations.
Ensure these records exist inside your `SystemSetting` table:

| Key | Default Value | Description |
| :--- | :--- | :--- |
| `DEFAULT_META_APP_ID` | `""` | Fallback Facebook Developer App ID used during sign-up. |
| `META_API_VERSION` | `"v20.0"` | Facebook Graph API version used for routing calls. |
| `WEBHOOK_VERIFY_TOKEN` | `"whatchamp"` | Verification token matched against Meta Webhooks GET request. |
| `SMTP_HOST` | `""` | Outbound mail server hostname. |
| `SMTP_PORT` | `587` | Port used for secure SMTP transaction. |

To seed these parameters automatically, run:
```bash
docker compose exec backend node scripts/seed_system_settings.js
```
