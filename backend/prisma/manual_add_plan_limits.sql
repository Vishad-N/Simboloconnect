-- Migration: add_plan_limits
-- Run this on BOTH servers (prebuiltapi.com and invitesindia.com)
-- File: backend/prisma/migrations/manual_add_plan_limits.sql

-- Add new limit columns to User table
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "campaigns_limit"     INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "bot_replies_limit"   INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS "bot_flows_limit"     INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "team_members_limit"  INTEGER NOT NULL DEFAULT 3;

-- Add new limit columns to Plan table
ALTER TABLE "Plan"
  ADD COLUMN IF NOT EXISTS "contacts_limit"      INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS "campaigns_limit"     INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "bot_replies_limit"   INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS "bot_flows_limit"     INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "team_members_limit"  INTEGER NOT NULL DEFAULT 3;
