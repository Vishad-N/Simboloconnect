# System Settings Reference Manual

This manual details the keys and values stored inside the `SystemSetting` database table which dictate system-wide behaviors.

---

## 1. Meta / Graph API Configurations

These keys dictate how the panel communicates with Meta's WhatsApp Cloud API services:
- **`META_API_VERSION`**: Mapped to the version prefix in Graph API endpoints (e.g. `v20.0`).
- **`WEBHOOK_VERIFY_TOKEN`**: The validation token submitted to Meta when configuring webhooks.
- **`DEFAULT_META_APP_ID`**: The default Meta App ID used to upload media files for templates when a workspace-specific app ID is not provided.
- **`META_JS_SDK_VERSION`**: Mapped to the version of the JavaScript SDK loaded in Embedded Signup modules.

---

## 2. SMTP Configurations

Used by the backend to send login OTPs, invitation links, and subscription alert emails:
- **`SMTP_HOST`**: Host name of the outbound SMTP server.
- **`SMTP_PORT`**: Server port (typically `587` for TLS, `465` for SSL).
- **`SMTP_USER`**: Username (e.g. support email).
- **`SMTP_PASS`**: Password / App Password.
- **`SMTP_FROM`**: Sender email address.

---

## 3. Global AI Provider Settings

Default models and fallback parameters:
- **`DEFAULT_AI_PROVIDER`**: Default provider (e.g. `openai`, `gemini`, `openrouter`).
- **`DEFAULT_AI_MODEL`**: Default model used by the AI Agent (e.g. `gpt-4o-mini`).
- **`OPENROUTER_REFERRER`**: Custom site URL header passed to OpenRouter (default: `https://prebuiltapi.com`).

---

## 4. Payment Gateway Settings

For billing and balance credit top-ups:
- **`PAYMENT_GATEWAY`**: Gateway choice (e.g. `razorpay`, `stripe`).
- **`PAYMENT_GATEWAY_KEY`**: Key ID.
- **`PAYMENT_GATEWAY_SECRET`**: Secret Key.
