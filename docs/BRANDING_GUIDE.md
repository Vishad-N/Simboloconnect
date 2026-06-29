# Branding & Customization Guide

This document details the configuration keys and steps required to customize the logo, favicon, naming, and colors of the WhatsApp Panel for resellers.

---

## 1. Environment Configurations

All branding attributes are managed dynamically through `.env` configurations. To change defaults, configure the following environment keys inside your front-end and backend `.env` files.

### Frontend Configurations (`frontend-user/.env` and `frontend-admin/.env`)
- `VITE_BRAND_NAME`: Change this to customize the text logos and title tags.
  - *Example*: `VITE_BRAND_NAME=WaDesk`
- `VITE_SUPPORT_EMAIL`: Support email displayed in onboarding, plan details, and footers.
  - *Example*: `VITE_SUPPORT_EMAIL=support@mybrand.com`
- `VITE_LOGO_URL`: URL to your hosted brand logo (used on Login and Sidebar headers).
  - *Example*: `VITE_LOGO_URL=https://mybrand.com/logo.svg`
- `VITE_FAVICON_URL`: URL to your custom favicon asset.
  - *Example*: `VITE_FAVICON_URL=https://mybrand.com/favicon.ico`
- `VITE_FOOTER_COPYRIGHT`: Copyright string displayed on login and footer bars.
  - *Example*: `VITE_FOOTER_COPYRIGHT="© 2026 MyBrand Inc. All rights reserved."`

### Backend Configurations (`backend/.env`)
- `PUBLIC_URL`: Primary front-end domain URL (used for callback referrals and voice transfers).
  - *Example*: `PUBLIC_URL=https://panel.mybrand.com`
- `SUPPORT_EMAIL`: Support email for contact alerts and recovery processes.
  - *Example*: `SUPPORT_EMAIL=support@mybrand.com`
- `SMTP_SENDER_NAME`: Custom name displayed when transactional emails are sent to users.
  - *Example*: `SMTP_SENDER_NAME="WaDesk Support"`
- `WHATSAPP_VERIFIED_NAME_DEFAULT`: Default verified display name used during onboarding tutorials.
  - *Example*: `WHATSAPP_VERIFIED_NAME_DEFAULT="MyBrand Messenger"`

---

## 2. Replacing Static Assets (Optional)

If you do not want to host your logo and favicon on external URLs:
1. Replace `branding/logo-placeholder.svg` with your company logo file (e.g. `logo.svg`).
2. Replace `branding/favicon-placeholder.ico` with your company favicon file (e.g. `favicon.ico`).
3. Copy these files directly to `frontend-user/public/logo.svg` and `frontend-user/public/favicon.ico`.
4. Update the `.env` settings to refer to local relative assets:
   ```env
   VITE_LOGO_URL=/logo.svg
   VITE_FAVICON_URL=/favicon.ico
   ```

---

## 3. UI Color Themes Customization

To customize color palettes (e.g. changing the default green/teal branding color):
1. Open the tailwind configuration file inside your front-end repository: `tailwind.config.js` or `index.css`.
2. Locate the custom theme mapping for colors:
   ```javascript
   theme: {
     extend: {
       colors: {
         brand: {
           50: '#f0fdf4',
           400: '#4ade80',
           500: '#22c55e', // Replace this hex color with your primary color
           600: '#16a34a',
         }
       }
     }
   }
   ```
3. Rebuild the frontend using `npm run build` to compile the new style mappings.
