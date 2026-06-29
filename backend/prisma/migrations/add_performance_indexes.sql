-- Migration: add_performance_indexes
-- Run this on your VPS database to speed up all slow queries

-- MessageLog indexes (most critical)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "MessageLog_userId_recipient_idx" 
    ON "MessageLog"("userId", "recipient");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "MessageLog_userId_direction_status_idx" 
    ON "MessageLog"("userId", "direction", "status");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "MessageLog_userId_campaignId_idx" 
    ON "MessageLog"("userId", "campaignId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "MessageLog_userId_recipient_direction_status_idx" 
    ON "MessageLog"("userId", "recipient", "direction", "status");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "MessageLog_timestamp_idx" 
    ON "MessageLog"("timestamp");

-- Contact indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Contact_userId_idx" 
    ON "Contact"("userId");
