-- ============================================================
-- Google Drive Integration Tables
-- Run this migration in Supabase SQL Editor
-- ============================================================

-- 1. user_connections: stores OAuth tokens per user per service
--    (google_drive is stored here separately from platform_connections)
CREATE TABLE IF NOT EXISTS user_connections (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    service                 TEXT NOT NULL,           -- e.g. 'google_drive'
    access_token_encrypted  TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at        TIMESTAMPTZ,
    account_email           TEXT,
    account_name            TEXT,
    is_active               BOOLEAN DEFAULT TRUE,
    connected_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    metadata                JSONB DEFAULT '{}'::JSONB,
    UNIQUE (user_id, service)
);

-- 2. drive_processed_files: tracks files already processed to prevent duplicates
CREATE TABLE IF NOT EXISTS drive_processed_files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    drive_file_id   TEXT NOT NULL,
    file_name       TEXT,
    mime_type       TEXT,
    processed_at    TIMESTAMPTZ DEFAULT NOW(),
    status          TEXT DEFAULT 'processed',  -- 'processed' | 'skipped' | 'failed'
    error_message   TEXT,
    UNIQUE (user_id, drive_file_id)
);

-- 3. content_queue: holds auto-generated posts awaiting publish or manual approval
CREATE TABLE IF NOT EXISTS content_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    platform        TEXT NOT NULL,              -- 'facebook' | 'instagram' | 'wordpress' | etc.
    caption         TEXT,
    media_url       TEXT,
    file_name       TEXT,
    drive_file_id   TEXT,
    status          TEXT DEFAULT 'draft',       -- 'draft' | 'scheduled' | 'posted' | 'failed'
    auto_post       BOOLEAN DEFAULT FALSE,
    scheduled_at    TIMESTAMPTZ,
    posted_at       TIMESTAMPTZ,
    mime_type       TEXT,                   -- 'image/jpeg', 'video/mp4', etc.
    folder_source   TEXT,                   -- Name of the folder file was found in
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_connections_user_service ON user_connections(user_id, service);
CREATE INDEX IF NOT EXISTS idx_drive_processed_user        ON drive_processed_files(user_id);
CREATE INDEX IF NOT EXISTS idx_drive_processed_file_id     ON drive_processed_files(user_id, drive_file_id);
CREATE INDEX IF NOT EXISTS idx_content_queue_user_status   ON content_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_content_queue_scheduled     ON content_queue(user_id, scheduled_at) WHERE status = 'scheduled';
