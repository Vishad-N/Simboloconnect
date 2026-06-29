# WhatsApp Cloud API Onboarding Guide

This document describes how to connect custom WhatsApp Business numbers to the self-hosted Automation Panel using the Meta Cloud API.

---

## 1. Setup Meta Developer Account

To send messages, you must register a Meta developer application:

1. Go to [developers.facebook.com](https://developers.facebook.com) and log in.
2. Click **My Apps** and select **Create App**.
3. Choose **Other** -> **Business** as the application type.
4. Input your App Name and connect your Facebook Business Manager account.
5. In the App Dashboard, scroll down to **WhatsApp** and click **Set up**.

---

## 2. Obtain Credentials

Configure the following credentials inside the panel settings:

1. **Temporary / Permanent Access Token**: Locate this on the WhatsApp Getting Started page. For production, generate a permanent System User Token inside your Facebook Business Manager dashboard with `whatsapp_business_messaging` and `whatsapp_business_management` permissions.
2. **Phone Number ID**: Mapped to the specific phone number used to dispatch outbound messages.
3. **WhatsApp Business Account (WABA) ID**: Mapped to the business account owning the number.

---

## 3. Configure Webhooks in Meta Portal

To receive incoming messages and delivery receipt statuses:

1. In the Meta Developer Portal, go to **WhatsApp > Configuration**.
2. Click **Edit** next to webhook settings.
3. Input your Webhook Address:
   - **Callback URL**: `https://api.yourdomain.com/api/webhooks`
   - **Verify Token**: Input the token configured in your `WEBHOOK_VERIFY_TOKEN` system settings.
4. Click **Verify and Save**.
5. Scroll down to Webhook Fields, and click **Subscribe** to the following event topics:
   - `messages` (for incoming messages)
   - `message_template_status_update` (for template approval changes)
