-- ================================================================
-- ECOMMERCE INTEGRATION MODULE — Database Migration
-- Run this SQL directly on your PostgreSQL database
-- OR use: npx prisma migrate dev --name ecommerce_module
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- TABLE: EcomStore — Connected ecommerce stores
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "EcomStore" (
    "id"            TEXT        NOT NULL,
    "userId"        TEXT        NOT NULL,
    "platform"      TEXT        NOT NULL,
    "storeName"     TEXT        NOT NULL,
    "domain"        TEXT        NOT NULL,
    "storeOwner"    TEXT,
    "currency"      TEXT        DEFAULT 'INR',
    "timezone"      TEXT        DEFAULT 'Asia/Kolkata',
    "status"        TEXT        NOT NULL DEFAULT 'connected',
    "accessToken"   TEXT,
    "apiKey"        TEXT,
    "apiSecret"     TEXT,
    "syncStatus"    TEXT        DEFAULT 'pending',
    "webhookStatus" TEXT        DEFAULT 'pending',
    "lastSyncedAt"  TIMESTAMP(3),
    "connectedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcomStore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EcomStore_userId_domain_key" ON "EcomStore"("userId", "domain");
CREATE INDEX IF NOT EXISTS "EcomStore_userId_idx" ON "EcomStore"("userId");
CREATE INDEX IF NOT EXISTS "EcomStore_userId_platform_idx" ON "EcomStore"("userId", "platform");

-- ────────────────────────────────────────────────────────────────
-- TABLE: EcomOrder — Synced orders from connected stores
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "EcomOrder" (
    "id"              TEXT        NOT NULL,
    "userId"          TEXT        NOT NULL,
    "storeId"         TEXT        NOT NULL,
    "externalOrderId" TEXT        NOT NULL,
    "customerName"    TEXT,
    "customerPhone"   TEXT,
    "customerEmail"   TEXT,
    "orderStatus"     TEXT        NOT NULL DEFAULT 'pending',
    "paymentStatus"   TEXT        NOT NULL DEFAULT 'pending',
    "paymentMethod"   TEXT,
    "totalAmount"     DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency"        TEXT        NOT NULL DEFAULT 'INR',
    "trackingNumber"  TEXT,
    "trackingUrl"     TEXT,
    "shippingAddress" JSONB,
    "lineItems"       JSONB,
    "whatsappStatus"  TEXT        DEFAULT 'pending',
    "lastNotifiedAt"  TIMESTAMP(3),
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcomOrder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EcomOrder_storeId_fkey" FOREIGN KEY ("storeId")
        REFERENCES "EcomStore"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "EcomOrder_userId_idx" ON "EcomOrder"("userId");
CREATE INDEX IF NOT EXISTS "EcomOrder_userId_storeId_idx" ON "EcomOrder"("userId", "storeId");
CREATE INDEX IF NOT EXISTS "EcomOrder_userId_orderStatus_idx" ON "EcomOrder"("userId", "orderStatus");
CREATE INDEX IF NOT EXISTS "EcomOrder_storeId_externalOrderId_idx" ON "EcomOrder"("storeId", "externalOrderId");

-- ────────────────────────────────────────────────────────────────
-- TABLE: EcomProduct — Synced product catalog
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "EcomProduct" (
    "id"                TEXT        NOT NULL,
    "userId"            TEXT        NOT NULL,
    "storeId"           TEXT        NOT NULL,
    "externalProductId" TEXT        NOT NULL,
    "title"             TEXT        NOT NULL,
    "description"       TEXT,
    "sku"               TEXT,
    "price"             DECIMAL(65,30) NOT NULL DEFAULT 0,
    "comparePrice"      DECIMAL(65,30),
    "stock"             INTEGER     NOT NULL DEFAULT 0,
    "stockStatus"       TEXT        NOT NULL DEFAULT 'active',
    "category"          TEXT,
    "imageUrl"          TEXT,
    "productUrl"        TEXT,
    "rating"            DECIMAL(65,30) DEFAULT 0,
    "totalSold"         INTEGER     NOT NULL DEFAULT 0,
    "syncedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcomProduct_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EcomProduct_storeId_fkey" FOREIGN KEY ("storeId")
        REFERENCES "EcomStore"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "EcomProduct_storeId_externalProductId_key" ON "EcomProduct"("storeId", "externalProductId");
CREATE INDEX IF NOT EXISTS "EcomProduct_userId_idx" ON "EcomProduct"("userId");
CREATE INDEX IF NOT EXISTS "EcomProduct_storeId_idx" ON "EcomProduct"("storeId");
CREATE INDEX IF NOT EXISTS "EcomProduct_userId_stockStatus_idx" ON "EcomProduct"("userId", "stockStatus");

-- ────────────────────────────────────────────────────────────────
-- TABLE: EcomCustomer — Synced customers
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "EcomCustomer" (
    "id"                 TEXT        NOT NULL,
    "userId"             TEXT        NOT NULL,
    "storeId"            TEXT        NOT NULL,
    "externalCustomerId" TEXT        NOT NULL,
    "name"               TEXT        NOT NULL,
    "phone"              TEXT,
    "email"              TEXT,
    "whatsappNumber"     TEXT,
    "city"               TEXT,
    "country"            TEXT        DEFAULT 'India',
    "segment"            TEXT        NOT NULL DEFAULT 'new',
    "tags"               TEXT[]      NOT NULL DEFAULT '{}',
    "totalOrders"        INTEGER     NOT NULL DEFAULT 0,
    "totalSpent"         DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lastOrderAt"        TIMESTAMP(3),
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcomCustomer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EcomCustomer_storeId_fkey" FOREIGN KEY ("storeId")
        REFERENCES "EcomStore"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "EcomCustomer_storeId_externalCustomerId_key" ON "EcomCustomer"("storeId", "externalCustomerId");
CREATE INDEX IF NOT EXISTS "EcomCustomer_userId_idx" ON "EcomCustomer"("userId");
CREATE INDEX IF NOT EXISTS "EcomCustomer_storeId_idx" ON "EcomCustomer"("storeId");
CREATE INDEX IF NOT EXISTS "EcomCustomer_userId_segment_idx" ON "EcomCustomer"("userId", "segment");

-- ────────────────────────────────────────────────────────────────
-- TABLE: EcomAbandonedCart — Abandoned cart recovery
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "EcomAbandonedCart" (
    "id"              TEXT        NOT NULL,
    "userId"          TEXT        NOT NULL,
    "storeId"         TEXT        NOT NULL,
    "externalCartId"  TEXT,
    "customerName"    TEXT,
    "customerPhone"   TEXT,
    "customerEmail"   TEXT,
    "cartValue"       DECIMAL(65,30) NOT NULL DEFAULT 0,
    "itemCount"       INTEGER     NOT NULL DEFAULT 0,
    "products"        JSONB,
    "checkoutUrl"     TEXT,
    "recoveryStatus"  TEXT        NOT NULL DEFAULT 'pending',
    "reminderCount"   INTEGER     NOT NULL DEFAULT 0,
    "lastReminderAt"  TIMESTAMP(3),
    "recoveredAt"     TIMESTAMP(3),
    "recoveredAmount" DECIMAL(65,30),
    "abandonedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcomAbandonedCart_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EcomAbandonedCart_storeId_fkey" FOREIGN KEY ("storeId")
        REFERENCES "EcomStore"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "EcomAbandonedCart_userId_idx" ON "EcomAbandonedCart"("userId");
CREATE INDEX IF NOT EXISTS "EcomAbandonedCart_userId_recoveryStatus_idx" ON "EcomAbandonedCart"("userId", "recoveryStatus");
CREATE INDEX IF NOT EXISTS "EcomAbandonedCart_storeId_idx" ON "EcomAbandonedCart"("storeId");

-- ────────────────────────────────────────────────────────────────
-- TABLE: EcomAutomation — Automation flows
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "EcomAutomation" (
    "id"          TEXT        NOT NULL,
    "userId"      TEXT        NOT NULL,
    "name"        TEXT        NOT NULL,
    "triggerType" TEXT        NOT NULL,
    "storeScope"  TEXT        NOT NULL DEFAULT 'all',
    "flowJson"    JSONB       NOT NULL DEFAULT '{}',
    "status"      TEXT        NOT NULL DEFAULT 'draft',
    "totalRuns"   INTEGER     NOT NULL DEFAULT 0,
    "successRuns" INTEGER     NOT NULL DEFAULT 0,
    "lastRunAt"   TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcomAutomation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EcomAutomation_userId_idx" ON "EcomAutomation"("userId");
CREATE INDEX IF NOT EXISTS "EcomAutomation_userId_status_idx" ON "EcomAutomation"("userId", "status");
CREATE INDEX IF NOT EXISTS "EcomAutomation_userId_triggerType_idx" ON "EcomAutomation"("userId", "triggerType");

-- ────────────────────────────────────────────────────────────────
-- TABLE: EcomCampaign — Ecommerce WhatsApp campaigns
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "EcomCampaign" (
    "id"                TEXT        NOT NULL,
    "userId"            TEXT        NOT NULL,
    "storeId"           TEXT,
    "name"              TEXT        NOT NULL,
    "campaignType"      TEXT        NOT NULL DEFAULT 'promotional',
    "audienceSegment"   TEXT        NOT NULL DEFAULT 'all',
    "templateName"      TEXT,
    "status"            TEXT        NOT NULL DEFAULT 'draft',
    "audienceCount"     INTEGER     NOT NULL DEFAULT 0,
    "sentCount"         INTEGER     NOT NULL DEFAULT 0,
    "deliveredCount"    INTEGER     NOT NULL DEFAULT 0,
    "readCount"         INTEGER     NOT NULL DEFAULT 0,
    "clickCount"        INTEGER     NOT NULL DEFAULT 0,
    "revenueAttributed" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "scheduledAt"       TIMESTAMP(3),
    "startedAt"         TIMESTAMP(3),
    "completedAt"       TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcomCampaign_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EcomCampaign_storeId_fkey" FOREIGN KEY ("storeId")
        REFERENCES "EcomStore"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "EcomCampaign_userId_idx" ON "EcomCampaign"("userId");
CREATE INDEX IF NOT EXISTS "EcomCampaign_userId_status_idx" ON "EcomCampaign"("userId", "status");

-- ────────────────────────────────────────────────────────────────
-- TABLE: EcomTemplate — Ecommerce WhatsApp templates
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "EcomTemplate" (
    "id"          TEXT        NOT NULL,
    "userId"      TEXT        NOT NULL,
    "name"        TEXT        NOT NULL,
    "displayName" TEXT        NOT NULL,
    "category"    TEXT        NOT NULL DEFAULT 'order',
    "body"        TEXT        NOT NULL,
    "language"    TEXT        NOT NULL DEFAULT 'en',
    "variables"   TEXT[]      NOT NULL DEFAULT '{}',
    "status"      TEXT        NOT NULL DEFAULT 'PENDING',
    "usageCount"  INTEGER     NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcomTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EcomTemplate_userId_name_key" ON "EcomTemplate"("userId", "name");
CREATE INDEX IF NOT EXISTS "EcomTemplate_userId_idx" ON "EcomTemplate"("userId");
CREATE INDEX IF NOT EXISTS "EcomTemplate_userId_category_idx" ON "EcomTemplate"("userId", "category");

-- ────────────────────────────────────────────────────────────────
-- TABLE: EcomWebhookLog — Incoming webhook event log
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "EcomWebhookLog" (
    "id"          TEXT        NOT NULL,
    "userId"      TEXT        NOT NULL,
    "storeId"     TEXT,
    "platform"    TEXT        NOT NULL,
    "topic"       TEXT        NOT NULL,
    "payload"     JSONB       NOT NULL,
    "status"      TEXT        NOT NULL DEFAULT 'received',
    "error"       TEXT,
    "retries"     INTEGER     NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "EcomWebhookLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EcomWebhookLog_storeId_fkey" FOREIGN KEY ("storeId")
        REFERENCES "EcomStore"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "EcomWebhookLog_userId_idx" ON "EcomWebhookLog"("userId");
CREATE INDEX IF NOT EXISTS "EcomWebhookLog_userId_platform_idx" ON "EcomWebhookLog"("userId", "platform");
CREATE INDEX IF NOT EXISTS "EcomWebhookLog_userId_status_idx" ON "EcomWebhookLog"("userId", "status");
CREATE INDEX IF NOT EXISTS "EcomWebhookLog_createdAt_idx" ON "EcomWebhookLog"("createdAt");
