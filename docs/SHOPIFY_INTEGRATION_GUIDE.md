# Shopify Integration Guide

This guide explains how to connect your Shopify store to the self-hosted WhatsApp Automation Panel and activate automated notifications.

---

## 1. Shopify App Setup

To sync orders, products, and customers, configure a Custom App inside your Shopify admin portal:

1. In Shopify Admin, navigate to **Settings > App and sales channels**.
2. Click **Develop apps**, then click **Create an app**.
3. Choose an app name (e.g. `WaDesk Integration`) and select your developer account.
4. Click **Configure Admin API scopes** and grant the following permissions:
   - `read_orders`, `write_orders`
   - `read_products`
   - `read_customers`
   - `read_draft_orders`
5. Click **Install app** and copy your **Admin API access token** (starts with `shpat_`). *Note: This token is only displayed once.*

---

## 2. Connecting the Store

In the user panel:
1. Navigate to **Ecommerce > Stores**.
2. Click **Add Store**, choose **Shopify** as the platform.
3. Input your store domain (e.g. `your-store.myshopify.com`) and paste the **Admin API access token**.
4. Click **Connect**. The system will validate credentials and sync your catalog.

---

## 3. Webhook Automations Setup

To trigger real-time notification alerts (e.g. Abandoned Carts recovery):
1. In Shopify Admin, go to **Settings > Notifications**.
2. Scroll down to **Webhooks** and click **Create webhook**.
3. Configure the following webhooks pointing to your panel's API address:
   - **Topic**: `Orders creation` -> `https://api.yourdomain.com/api/ecommerce/webhooks/shopify`
   - **Topic**: `Cart update` -> `https://api.yourdomain.com/api/ecommerce/webhooks/shopify`
   - **Format**: JSON
   - **API Version**: Select the latest stable version.
4. Save webhooks. The panel will now automatically intercept cart abandonment and dispatch recovery templates after 30 minutes.
