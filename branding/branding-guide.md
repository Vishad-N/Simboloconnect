# Branding and Static Assets Customization Guide

This folder contains asset templates and configuration scripts to customize the branding for your white-labeled deployment.

## Contents of this Directory

1. `logo-placeholder.svg`: A clean, modern SVG vector logo template.
2. `favicon-placeholder.ico`: Favicon indicator template.

## Steps to Apply Branding

To configure the application with your custom logo and assets:

### Step 1: Prepare Your Asset Files
* **Logo**: Recommended format is `.svg` or `.png` with transparent background (dimensions around 500x120px).
* **Favicon**: Standard `.ico` file (16x16 or 32x32px).

### Step 2: Replace the Placeholders
Save your assets into the `branding/` folder on your server:
* Overwrite `branding/logo-placeholder.svg` with your logo.
* Overwrite `branding/favicon-placeholder.ico` with your favicon.

### Step 3: Copy to Frontend Dist Directories
If compiling from source, run:
```bash
cp branding/logo-placeholder.svg frontend-user/public/logo.svg
cp branding/logo-placeholder.svg frontend-admin/public/logo.svg
cp branding/favicon-placeholder.ico frontend-user/public/favicon.ico
cp branding/favicon-placeholder.ico frontend-admin/public/favicon.ico
```

If using running containers, copy assets directly into active volumes:
```bash
docker cp branding/logo-placeholder.svg whatsapp_panel_frontend:/usr/share/nginx/html/logo.svg
docker cp branding/favicon-placeholder.ico whatsapp_panel_frontend:/usr/share/nginx/html/favicon.ico
```

### Step 4: Update Environment Variables
Configure your brand meta titles and copyrights in `.env`:
```env
VITE_BRAND_NAME="Your Brand Name"
VITE_SUPPORT_EMAIL="support@yourbrand.com"
VITE_LOGO_URL="/logo.svg"
VITE_FAVICON_URL="/favicon.ico"
VITE_FOOTER_COPYRIGHT="© 2026 Your Brand Name. All rights reserved."
```
