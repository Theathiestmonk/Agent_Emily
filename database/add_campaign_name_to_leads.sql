-- Migration: add campaign_name to leads table
-- Run this in Supabase SQL Editor (or via psql)
-- Safe to run multiple times (uses IF NOT EXISTS guard)

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS campaign_name TEXT;

-- Optional index for filtering leads by campaign
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON leads(campaign_id);
